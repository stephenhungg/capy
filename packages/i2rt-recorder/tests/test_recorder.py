from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from i2rt_recorder.model import CaptureQuality, CommandFrame, MeasuredFrame, RobotLayout, Snapshot
from i2rt_recorder.rawlog import load_events
from i2rt_recorder.recorder import Recorder


def _snapshot(*, fault_code: int = 1, chain_running: bool = True) -> Snapshot:
    return Snapshot(
        command=CommandFrame(
            position=(0.0, 0.5),
            velocity=(0.0, 0.0),
            feedforward_torque=(0.0, 0.0),
            kp=(10.0, 8.0),
            kd=(1.0, 0.5),
            applied_torque=(0.1, 0.2),
            source="test",
        ),
        measured=MeasuredFrame(
            position=(0.0, 0.5),
            velocity=(0.0, 0.0),
            effort=(0.1, 0.2),
            temp_mos_c=(30.0, 31.0),
            temp_rotor_c=(28.0, 29.0),
            motor_error_code=(1, fault_code),
            motor_error_message=("normal", "normal" if fault_code == 1 else "mosfet over temperature"),
            chain_running=chain_running,
        ),
        capture_quality=CaptureQuality.CONTROL_CYCLE,
        source_wall_time_ns=1_000_000_000,
    )


def test_episode_boundaries_and_fault_transitions_are_explicit(tmp_path: Path) -> None:
    tick = 0

    def clock() -> int:
        nonlocal tick
        tick += 1_000_000
        return tick

    recorder = Recorder(
        tmp_path / "recording",
        RobotLayout(
            joint_names=("joint1", "gripper"),
            motor_ids=(1, 7),
            target_hz=100,
            arm_type="test",
            gripper_type="test",
            gripper_index=1,
        ),
        session_id="test-session",
        wall_clock_ns=clock,
        monotonic_clock_ns=clock,
    )
    with pytest.raises(RuntimeError, match="outside an episode"):
        recorder.record_frame(_snapshot())
    recorder.start_episode(task="test", geometry_id="fixed", operator_id="operator", episode_id="episode-1")
    recorder.record_frame(_snapshot(fault_code=11))
    recorder.record_frame(_snapshot())
    recorder.record_frame(replace(_snapshot(), measured=replace(_snapshot().measured, chain_running=False)))
    recorder.end_episode("failure", reason="injected hardware-free fault")
    recorder.close()

    events = load_events(tmp_path / "recording")
    safety = [event for event in events if event["event_type"] == "safety_event"]
    assert [(event["payload"]["code"], event["payload"]["active"]) for event in safety] == [
        ("motor_7_fault_0xb", True),
        ("motor_7_fault_0xb", False),
        ("motor_chain_stopped", True),
    ]
    frames = [event for event in events if event["event_type"] == "frame"]
    assert frames[0]["payload"]["safety_active"] is True
    assert frames[1]["payload"]["safety_active"] is False
    assert frames[2]["payload"]["safety_active"] is True
