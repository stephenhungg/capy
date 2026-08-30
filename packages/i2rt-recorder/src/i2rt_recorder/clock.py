from __future__ import annotations

from dataclasses import dataclass

from i2rt_recorder.model import ClockPolicy


@dataclass(frozen=True)
class ClockObservation:
    recorder_monotonic_ns: int
    recorder_wall_ns: int
    source_wall_ns: int | None


class ClockMonitor:
    """Detect wall-clock steps, stale source batches, regression, and rate drift."""

    def __init__(self, policy: ClockPolicy | None = None) -> None:
        self.policy = policy or ClockPolicy()
        self._first: ClockObservation | None = None
        self._previous: ClockObservation | None = None

    def observe(self, observation: ClockObservation) -> tuple[dict[str, float | bool | None], list[dict[str, object]]]:
        issues: list[dict[str, object]] = []
        source_age_ms: float | None = None
        drift_ppm: float | None = None
        wall_step_ms: float | None = None

        if observation.source_wall_ns is not None:
            source_age_ms = (observation.recorder_wall_ns - observation.source_wall_ns) / 1_000_000
            if abs(source_age_ms) > self.policy.max_source_age_ms:
                issues.append(
                    {
                        "code": "source_clock_age",
                        "severity": "warning",
                        "message": "i2rt source wall timestamp is too far from recorder wall time",
                        "value_ms": source_age_ms,
                        "limit_ms": self.policy.max_source_age_ms,
                    }
                )

        if self._previous is not None:
            mono_delta = observation.recorder_monotonic_ns - self._previous.recorder_monotonic_ns
            wall_delta = observation.recorder_wall_ns - self._previous.recorder_wall_ns
            wall_step_ms = (wall_delta - mono_delta) / 1_000_000
            if mono_delta < 0:
                issues.append(
                    {
                        "code": "recorder_monotonic_regression",
                        "severity": "error",
                        "message": "recorder monotonic time regressed",
                    }
                )
            if abs(wall_step_ms) > self.policy.max_wall_step_ms:
                issues.append(
                    {
                        "code": "wall_clock_step",
                        "severity": "warning",
                        "message": "recorder wall clock stepped relative to monotonic time",
                        "value_ms": wall_step_ms,
                        "limit_ms": self.policy.max_wall_step_ms,
                    }
                )
            if (
                observation.source_wall_ns is not None
                and self._previous.source_wall_ns is not None
                and observation.source_wall_ns < self._previous.source_wall_ns
            ):
                issues.append(
                    {
                        "code": "source_clock_regression",
                        "severity": "error",
                        "message": "i2rt source wall timestamp regressed",
                    }
                )

        if self._first is None:
            self._first = observation
        elif observation.source_wall_ns is not None and self._first.source_wall_ns is not None:
            mono_span = observation.recorder_monotonic_ns - self._first.recorder_monotonic_ns
            source_span = observation.source_wall_ns - self._first.source_wall_ns
            if mono_span >= self.policy.min_drift_window_s * 1_000_000_000:
                drift_ppm = ((source_span / mono_span) - 1.0) * 1_000_000
                if abs(drift_ppm) > self.policy.max_drift_ppm:
                    issues.append(
                        {
                            "code": "source_clock_drift",
                            "severity": "warning",
                            "message": "i2rt source clock rate differs from recorder monotonic clock",
                            "value_ppm": drift_ppm,
                            "limit_ppm": self.policy.max_drift_ppm,
                        }
                    )

        self._previous = observation
        return (
            {
                "source_age_ms": source_age_ms,
                "source_drift_ppm": drift_ppm,
                "wall_step_ms": wall_step_ms,
                "healthy": not issues,
            },
            issues,
        )
