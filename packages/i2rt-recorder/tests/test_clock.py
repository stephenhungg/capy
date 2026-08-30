from __future__ import annotations

from i2rt_recorder.clock import ClockMonitor, ClockObservation
from i2rt_recorder.model import ClockPolicy


def test_clock_monitor_detects_regression_wall_step_and_drift() -> None:
    monitor = ClockMonitor(
        ClockPolicy(max_source_age_ms=5, max_wall_step_ms=1, max_drift_ppm=100, min_drift_window_s=1)
    )
    _, first = monitor.observe(ClockObservation(0, 1_000_000_000, 1_000_000_000))
    health, second = monitor.observe(
        ClockObservation(
            1_000_000_000,
            2_010_000_000,
            2_020_000_000,
        )
    )
    _, third = monitor.observe(ClockObservation(2_000_000_000, 3_010_000_000, 2_000_000_000))

    assert first == []
    assert not health["healthy"]
    assert {issue["code"] for issue in second} == {
        "source_clock_age",
        "wall_clock_step",
        "source_clock_drift",
    }
    assert "source_clock_regression" in {issue["code"] for issue in third}
