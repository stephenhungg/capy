from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

SCHEMA_VERSION = "capy.i2rt.camera_free.v1"


class CaptureQuality(StrEnum):
    CONTROL_CYCLE = "control_cycle"
    BEST_EFFORT = "best_effort"
    SYNTHETIC_FIXTURE = "synthetic_fixture"


class Outcome(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
    ABORTED = "aborted"
    INVALID = "invalid"


@dataclass(frozen=True)
class RobotLayout:
    joint_names: tuple[str, ...]
    motor_ids: tuple[int, ...]
    target_hz: int
    arm_type: str
    gripper_type: str
    gripper_index: int | None = None
    control_mode: str = "MIT"
    i2rt_source_revision: str = "unknown"
    rig_id: str = "unknown"

    def validate(self) -> None:
        if not self.joint_names:
            raise ValueError("joint_names must not be empty")
        if len(set(self.joint_names)) != len(self.joint_names):
            raise ValueError("joint_names must be unique")
        if len(self.motor_ids) != len(self.joint_names):
            raise ValueError("motor_ids and joint_names must have equal length")
        if len(set(self.motor_ids)) != len(self.motor_ids):
            raise ValueError("motor_ids must be unique")
        if self.target_hz <= 0:
            raise ValueError("target_hz must be positive")
        if self.gripper_index is not None and not 0 <= self.gripper_index < len(self.joint_names):
            raise ValueError("gripper_index is outside joint_names")


@dataclass(frozen=True)
class CommandFrame:
    position: tuple[float, ...]
    velocity: tuple[float, ...]
    feedforward_torque: tuple[float, ...]
    kp: tuple[float, ...]
    kd: tuple[float, ...]
    applied_torque: tuple[float, ...]
    source: str
    mode: str = "MIT"
    upstream_position: tuple[float, ...] | None = None


@dataclass(frozen=True)
class MeasuredFrame:
    position: tuple[float, ...]
    velocity: tuple[float, ...]
    effort: tuple[float, ...]
    temp_mos_c: tuple[float, ...]
    temp_rotor_c: tuple[float, ...]
    motor_error_code: tuple[int, ...]
    motor_error_message: tuple[str, ...]
    chain_running: bool


@dataclass(frozen=True)
class TeleopFrame:
    source: str
    enabled: bool
    synchronized: bool | None = None
    leader_joint_position: tuple[float, ...] | None = None
    gripper_command: float | None = None
    buttons: tuple[bool, ...] = ()
    axes: tuple[float, ...] = ()


@dataclass(frozen=True)
class Snapshot:
    command: CommandFrame
    measured: MeasuredFrame
    capture_quality: CaptureQuality
    source_wall_time_ns: int | None
    teleop: TeleopFrame | None = None
    controller: dict[str, Any] = field(default_factory=dict)

    def validate(self, layout: RobotLayout) -> None:
        size = len(layout.joint_names)
        fields = {
            "command.position": self.command.position,
            "command.velocity": self.command.velocity,
            "command.feedforward_torque": self.command.feedforward_torque,
            "command.kp": self.command.kp,
            "command.kd": self.command.kd,
            "command.applied_torque": self.command.applied_torque,
            "measured.position": self.measured.position,
            "measured.velocity": self.measured.velocity,
            "measured.effort": self.measured.effort,
            "measured.temp_mos_c": self.measured.temp_mos_c,
            "measured.temp_rotor_c": self.measured.temp_rotor_c,
            "measured.motor_error_code": self.measured.motor_error_code,
            "measured.motor_error_message": self.measured.motor_error_message,
        }
        if self.command.upstream_position is not None:
            fields["command.upstream_position"] = self.command.upstream_position
        for name, values in fields.items():
            if len(values) != size:
                raise ValueError(f"{name} has {len(values)} values; expected {size}")
        numeric_fields = {name: values for name, values in fields.items() if "message" not in name}
        for name, values in numeric_fields.items():
            if not all(math.isfinite(float(value)) for value in values):
                raise ValueError(f"{name} contains a non-finite value")
        for code in self.measured.motor_error_code:
            if not 0 <= code <= 15:
                raise ValueError(f"motor error code is outside the 4-bit protocol field: {code}")


@dataclass(frozen=True)
class ClockPolicy:
    max_source_age_ms: float = 100.0
    max_wall_step_ms: float = 5.0
    max_drift_ppm: float = 1_000.0
    min_drift_window_s: float = 1.0
