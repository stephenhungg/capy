from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from i2rt_recorder.jsonutil import pretty_json
from i2rt_recorder.model import (
    CaptureQuality,
    CommandFrame,
    MeasuredFrame,
    Outcome,
    RobotLayout,
    Snapshot,
    TeleopFrame,
)
from i2rt_recorder.recorder import Recorder

FIXTURE_SESSION_ID = "00000000-0000-0000-0000-000000000001"
FIXTURE_EPISODE_ID = "00000000-0000-0000-0000-000000000101"
FIXTURE_GEOMETRY = {
    "geometry_id": "fixed-square-peg-v1",
    "description": "fixed square peg insertion; all poses are surveyed constants, not camera observations",
    "units": {"translation": "m", "rotation": "rad"},
    "base_frame": "robot_base",
    "peg_start_pose_xyz_rpy": [0.34, -0.12, 0.08, 0.0, 0.0, 0.0],
    "socket_pose_xyz_rpy": [0.42, 0.0, 0.035, 0.0, 0.0, 0.0],
    "peg_width": 0.02,
    "socket_clearance": 0.001,
    "success_depth": 0.025,
    "survey_method": "synthetic test fixture; replace with measured rig geometry",
}


@dataclass
class _FixtureClock:
    monotonic_ns: int = 1_000_000_000
    wall_origin_ns: int = 1_900_000_000_000_000_000

    def monotonic(self) -> int:
        return self.monotonic_ns

    def wall(self) -> int:
        return self.wall_origin_ns + self.monotonic_ns

    def advance(self, nanoseconds: int = 50_000_000) -> None:
        self.monotonic_ns += nanoseconds


def _snapshot(step: int, clock: _FixtureClock) -> Snapshot:
    size = 7
    position = (*tuple(0.01 * step * (index + 1) for index in range(size - 1)), 0.8 - 0.1 * step)
    velocity = (*tuple(0.2 * (index + 1) for index in range(size - 1)), -0.1)
    effort = tuple(0.05 * (index + 1) for index in range(size))
    return Snapshot(
        command=CommandFrame(
            position=position,
            velocity=(0.0,) * size,
            feedforward_torque=(0.0,) * size,
            kp=(40.0, 40.0, 30.0, 20.0, 10.0, 10.0, 8.0),
            kd=(2.0, 2.0, 1.5, 1.0, 0.5, 0.5, 0.3),
            applied_torque=effort,
            source="teaching_handle",
            mode="MIT",
            upstream_position=position,
        ),
        measured=MeasuredFrame(
            position=tuple(value - 0.001 for value in position),
            velocity=velocity,
            effort=effort,
            temp_mos_c=tuple(31.0 + index for index in range(size)),
            temp_rotor_c=tuple(29.0 + index for index in range(size)),
            motor_error_code=(1,) * size,
            motor_error_message=("normal",) * size,
            chain_running=True,
        ),
        capture_quality=CaptureQuality.SYNTHETIC_FIXTURE,
        source_wall_time_ns=clock.wall() - 1_000_000,
        teleop=TeleopFrame(
            source="teaching_handle",
            enabled=True,
            synchronized=True,
            leader_joint_position=position[:6],
            gripper_command=position[-1],
            buttons=(False, step >= 2),
        ),
        controller={
            "gravity_compensation_enabled": True,
            "coulomb_friction_enabled": False,
            "gripper_force_limit_n": 10.0,
            "gravity_and_friction_torque": list(effort),
        },
    )


def create_fixed_geometry_fixture(root: Path) -> Path:
    clock = _FixtureClock()
    layout = RobotLayout(
        joint_names=("joint1", "joint2", "joint3", "joint4", "joint5", "joint6", "gripper"),
        motor_ids=(1, 2, 3, 4, 5, 6, 7),
        target_hz=20,
        arm_type="yam",
        gripper_type="linear_4310",
        gripper_index=6,
        i2rt_source_revision="47fee5e7dec4e30ca054f798bda1c8894b465ed2+fixture",
        rig_id="synthetic-fixed-geometry-fixture",
    )
    recorder = Recorder(
        root,
        layout,
        session_id=FIXTURE_SESSION_ID,
        wall_clock_ns=clock.wall,
        monotonic_clock_ns=clock.monotonic,
        extra_manifest={"fixture": True, "geometry": FIXTURE_GEOMETRY},
    )
    recorder.start_episode(
        task="insert the square peg into the fixed socket",
        geometry_id=FIXTURE_GEOMETRY["geometry_id"],
        operator_id="fixture",
        episode_id=FIXTURE_EPISODE_ID,
    )
    for step in range(5):
        clock.advance()
        if step == 1:
            recorder.set_intervention(
                "fixture-guidance",
                active=True,
                kind="operator_guidance",
                actor="fixture_operator",
                reason="demonstrate intervention annotation",
            )
        if step == 2:
            recorder.safety_event(
                "operator_pause",
                active=True,
                severity="stop",
                message="manual pause; no sensor threshold is implied",
                source="operator",
            )
        recorder.record_frame(_snapshot(step, clock))
        if step == 2:
            recorder.safety_event(
                "operator_pause",
                active=False,
                severity="info",
                message="manual pause cleared",
                source="operator",
            )
        if step == 3:
            recorder.set_intervention(
                "fixture-guidance",
                active=False,
                kind="operator_guidance",
                actor="fixture_operator",
                reason="guidance complete",
            )
    clock.advance()
    recorder.end_episode(Outcome.SUCCESS, reason="operator confirmed insertion depth on the synthetic fixture")
    recorder.close()
    (root / "geometry.json").write_text(pretty_json(FIXTURE_GEOMETRY), encoding="utf-8")
    return root
