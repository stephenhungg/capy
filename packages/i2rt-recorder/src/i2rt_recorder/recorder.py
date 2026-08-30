from __future__ import annotations

import time
import uuid
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from i2rt_recorder.clock import ClockMonitor, ClockObservation
from i2rt_recorder.jsonutil import jsonable
from i2rt_recorder.model import SCHEMA_VERSION, ClockPolicy, Outcome, RobotLayout, Snapshot
from i2rt_recorder.rawlog import RawLogWriter

_CURRENT_EPISODE = object()


class Recorder:
    """Stateful episode recorder whose hot path only appends one canonical JSON line."""

    def __init__(
        self,
        root: Path,
        layout: RobotLayout,
        *,
        session_id: str | None = None,
        clock_policy: ClockPolicy | None = None,
        wall_clock_ns: Callable[[], int] = time.time_ns,
        monotonic_clock_ns: Callable[[], int] = time.monotonic_ns,
        fsync: bool = False,
        extra_manifest: dict[str, Any] | None = None,
    ) -> None:
        layout.validate()
        self.layout = layout
        self._wall_clock_ns = wall_clock_ns
        self._monotonic_clock_ns = monotonic_clock_ns
        self._clock_monitor = ClockMonitor(clock_policy)
        self._episode_id: str | None = None
        self._interventions: set[str] = set()
        self._active_safety_events: set[str] = set()
        self._motor_fault_codes: dict[int, int] = {}
        self._chain_fault_active = False
        self._closed = False
        self.session_id = session_id or str(uuid.uuid4())
        manifest = {
            "schema_version": SCHEMA_VERSION,
            "session_id": self.session_id,
            "created_wall_time_ns": self._wall_clock_ns(),
            "robot": jsonable(layout),
            "camera_streams": [],
            "capture_contract": {
                "canonical_time": "recorder_monotonic_time_ns",
                "source_time": "i2rt batch wall timestamp when available",
                "exact_capture_quality": "control_cycle",
            },
        }
        if extra_manifest:
            manifest["extra"] = extra_manifest
        self._writer = RawLogWriter(root, manifest, fsync=fsync)
        self.root = root
        self._append("session_start", {"session_id": self.session_id}, episode_id=None)

    def _append(
        self,
        event_type: str,
        payload: dict[str, Any],
        *,
        episode_id: str | object | None = _CURRENT_EPISODE,
        wall_time_ns: int | None = None,
        monotonic_time_ns: int | None = None,
    ) -> dict[str, Any]:
        if self._closed:
            raise RuntimeError("recorder is closed")
        resolved_episode = self._episode_id if episode_id is _CURRENT_EPISODE else episode_id
        return self._writer.append(
            {
                "event_type": event_type,
                "episode_id": resolved_episode,
                "recorder_monotonic_time_ns": (
                    monotonic_time_ns if monotonic_time_ns is not None else self._monotonic_clock_ns()
                ),
                "recorder_wall_time_ns": wall_time_ns if wall_time_ns is not None else self._wall_clock_ns(),
                "payload": payload,
            }
        )

    def start_episode(
        self,
        *,
        task: str,
        geometry_id: str,
        operator_id: str,
        episode_id: str | None = None,
        notes: str = "",
    ) -> str:
        if self._episode_id is not None:
            raise RuntimeError(f"episode already active: {self._episode_id}")
        if not task.strip() or not geometry_id.strip():
            raise ValueError("task and geometry_id must be non-empty")
        self._episode_id = episode_id or str(uuid.uuid4())
        self._interventions.clear()
        self._active_safety_events.clear()
        self._append(
            "episode_start",
            {"task": task, "geometry_id": geometry_id, "operator_id": operator_id, "notes": notes},
        )
        return self._episode_id

    def record_frame(self, snapshot: Snapshot) -> dict[str, Any]:
        if self._episode_id is None:
            raise RuntimeError("cannot record a frame outside an episode")
        snapshot.validate(self.layout)
        monotonic_ns = self._monotonic_clock_ns()
        wall_ns = self._wall_clock_ns()
        self._record_fault_transitions(snapshot, wall_time_ns=wall_ns, monotonic_time_ns=monotonic_ns)
        clock_health, clock_issues = self._clock_monitor.observe(
            ClockObservation(monotonic_ns, wall_ns, snapshot.source_wall_time_ns)
        )
        payload = {
            **jsonable(snapshot),
            "clock_health": clock_health,
            "intervention_active": bool(self._interventions),
            "active_interventions": sorted(self._interventions),
            "safety_active": bool(self._active_safety_events),
            "active_safety_events": sorted(self._active_safety_events),
        }
        frame = self._append("frame", payload, wall_time_ns=wall_ns, monotonic_time_ns=monotonic_ns)
        for issue in clock_issues:
            self._append(
                "clock_issue",
                issue,
                wall_time_ns=wall_ns,
                monotonic_time_ns=monotonic_ns,
            )
        return frame

    def _record_fault_transitions(
        self,
        snapshot: Snapshot,
        *,
        wall_time_ns: int,
        monotonic_time_ns: int,
    ) -> None:
        current_faults = {
            motor_id: code
            for motor_id, code in zip(self.layout.motor_ids, snapshot.measured.motor_error_code, strict=True)
            if code != 1
        }
        messages = dict(zip(self.layout.motor_ids, snapshot.measured.motor_error_message, strict=True))
        for motor_id, old_code in sorted(self._motor_fault_codes.items()):
            if current_faults.get(motor_id) == old_code:
                continue
            event_code = f"motor_{motor_id}_fault_{old_code:#x}"
            self._active_safety_events.discard(event_code)
            self._append(
                "safety_event",
                {
                    "code": event_code,
                    "active": False,
                    "severity": "info",
                    "message": "motor feedback no longer reports this fault code",
                    "motor_ids": [motor_id],
                    "source": "motor_feedback",
                },
                wall_time_ns=wall_time_ns,
                monotonic_time_ns=monotonic_time_ns,
            )
        for motor_id, code in sorted(current_faults.items()):
            if self._motor_fault_codes.get(motor_id) == code:
                continue
            event_code = f"motor_{motor_id}_fault_{code:#x}"
            self._active_safety_events.add(event_code)
            self._append(
                "safety_event",
                {
                    "code": event_code,
                    "active": True,
                    "severity": "stop",
                    "message": messages[motor_id],
                    "motor_ids": [motor_id],
                    "source": "motor_feedback",
                },
                wall_time_ns=wall_time_ns,
                monotonic_time_ns=monotonic_time_ns,
            )
        self._motor_fault_codes = current_faults

        chain_fault = not snapshot.measured.chain_running
        if chain_fault != self._chain_fault_active:
            if chain_fault:
                self._active_safety_events.add("motor_chain_stopped")
            else:
                self._active_safety_events.discard("motor_chain_stopped")
            self._append(
                "safety_event",
                {
                    "code": "motor_chain_stopped",
                    "active": chain_fault,
                    "severity": "stop" if chain_fault else "info",
                    "message": "i2rt motor chain is not running" if chain_fault else "i2rt motor chain is running",
                    "motor_ids": [],
                    "source": "controller",
                },
                wall_time_ns=wall_time_ns,
                monotonic_time_ns=monotonic_time_ns,
            )
            self._chain_fault_active = chain_fault

    def set_intervention(
        self,
        intervention_id: str,
        *,
        active: bool,
        kind: str,
        actor: str,
        reason: str,
    ) -> None:
        if self._episode_id is None:
            raise RuntimeError("cannot annotate an intervention outside an episode")
        if active:
            self._interventions.add(intervention_id)
        else:
            self._interventions.discard(intervention_id)
        self._append(
            "intervention",
            {"intervention_id": intervention_id, "active": active, "kind": kind, "actor": actor, "reason": reason},
        )

    def safety_event(
        self,
        code: str,
        *,
        active: bool,
        severity: str,
        message: str,
        motor_ids: Sequence[int] = (),
        source: str = "operator",
    ) -> None:
        if self._episode_id is None:
            raise RuntimeError("cannot annotate a safety event outside an episode")
        if active:
            self._active_safety_events.add(code)
        else:
            self._active_safety_events.discard(code)
        self._append(
            "safety_event",
            {
                "code": code,
                "active": active,
                "severity": severity,
                "message": message,
                "motor_ids": list(motor_ids),
                "source": source,
            },
        )

    def end_episode(self, outcome: Outcome | str, *, reason: str, notes: str = "") -> None:
        if self._episode_id is None:
            raise RuntimeError("no active episode")
        resolved = Outcome(outcome)
        self._append(
            "episode_end",
            {
                "outcome": resolved.value,
                "reason": reason,
                "notes": notes,
                "interventions_active_at_end": sorted(self._interventions),
                "safety_events_active_at_end": sorted(self._active_safety_events),
            },
        )
        self._episode_id = None
        self._interventions.clear()
        self._active_safety_events.clear()
        self._motor_fault_codes.clear()
        self._chain_fault_active = False

    def close(self, *, allow_incomplete_episode: bool = False) -> None:
        if self._closed:
            return
        if self._episode_id is not None and not allow_incomplete_episode:
            raise RuntimeError(f"episode is still active: {self._episode_id}")
        self._append("session_end", {"incomplete_episode_id": self._episode_id}, episode_id=None)
        self._writer.close()
        self._closed = True

    def __enter__(self) -> Recorder:
        return self

    def __exit__(self, exc_type: object, _exc: object, _traceback: object) -> None:
        self.close(allow_incomplete_episode=exc_type is not None)
