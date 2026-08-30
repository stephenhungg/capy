from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from i2rt_recorder.model import CaptureQuality, CommandFrame, MeasuredFrame, Snapshot, TeleopFrame


def _floats(values: Any) -> tuple[float, ...]:
    return tuple(float(value) for value in values)


def _error_code(value: Any) -> int:
    if isinstance(value, str):
        return int(value, 0)
    return int(value)


def snapshot_from_control_cycle(
    *,
    robot: Any,
    joint_state: Any,
    joint_commands: Any,
    motor_info: Sequence[Any],
    applied_torque: Any,
    command_source: str,
    upstream_position: Any | None = None,
    teleop: TeleopFrame | None = None,
) -> Snapshot:
    """Translate values available inside `MotorChainRobot._update_joint_state`.

    Call this on the robot control thread immediately after `set_commands` returns. The
    command is the final motor-cycle command, including any gripper force limiting. The
    measured values are the feedback batch returned for that same cycle.
    """
    command_position = robot.remapper.to_command_joint_pos_space(joint_commands.pos)
    command_velocity = robot.remapper.to_command_joint_vel_space(joint_commands.vel)
    controller = {
        "gravity_compensation_enabled": bool(robot.use_gravity_comp),
        "coulomb_friction_enabled": bool(robot.use_coulomb_friction),
        "gripper_force_limit_n": float(getattr(robot, "_limit_gripper_force", -1.0)),
        "gravity_and_friction_torque": [
            float(applied - requested)
            for applied, requested in zip(applied_torque, joint_commands.torques, strict=True)
        ],
    }
    error_codes = tuple(_error_code(info.error_code) for info in motor_info)
    error_messages = tuple(
        str(getattr(info, "error_message", "normal" if code == 1 else f"motor_error_{code:#x}"))
        for info, code in zip(motor_info, error_codes, strict=True)
    )
    return Snapshot(
        command=CommandFrame(
            position=_floats(command_position),
            velocity=_floats(command_velocity),
            feedforward_torque=_floats(joint_commands.torques),
            kp=_floats(joint_commands.kp),
            kd=_floats(joint_commands.kd),
            applied_torque=_floats(applied_torque),
            upstream_position=None if upstream_position is None else _floats(upstream_position),
            source=command_source,
            mode=str(getattr(robot.motor_chain, "control_mode", "MIT")),
        ),
        measured=MeasuredFrame(
            position=_floats(joint_state.pos),
            velocity=_floats(joint_state.vel),
            effort=_floats(joint_state.eff),
            temp_mos_c=_floats(joint_state.temp_mos),
            temp_rotor_c=_floats(joint_state.temp_rotor),
            motor_error_code=error_codes,
            motor_error_message=error_messages,
            chain_running=bool(robot.motor_chain.running),
        ),
        capture_quality=CaptureQuality.CONTROL_CYCLE,
        source_wall_time_ns=int(float(joint_state.timestamp) * 1_000_000_000),
        teleop=teleop,
        controller=controller,
    )


def best_effort_snapshot(
    *,
    robot: Any,
    command_source: str = "unknown",
    teleop: TeleopFrame | None = None,
) -> Snapshot:
    """Poll private i2rt caches when an inline hook is unavailable.

    Command and state locks are acquired separately, so this deliberately cannot claim
    same-cycle synchronization. Prefer `snapshot_from_control_cycle` for real datasets.
    """
    with robot._command_lock:
        commands = robot._commands
        position = robot.remapper.to_command_joint_pos_space(commands.pos.copy())
        velocity = robot.remapper.to_command_joint_vel_space(commands.vel.copy())
        feedforward = commands.torques.copy()
        kp = commands.kp.copy()
        kd = commands.kd.copy()
    with robot._state_lock:
        state = robot._joint_state
        measured_position = state.pos.copy()
        measured_velocity = state.vel.copy()
        effort = state.eff.copy()
        temp_mos = state.temp_mos.copy()
        temp_rotor = state.temp_rotor.copy()
        source_timestamp = state.timestamp
    motor_states = robot.motor_chain.read_states()
    applied = robot.get_motor_torques()
    if applied is None:
        applied = feedforward
    codes = tuple(_error_code(info.error_code) for info in motor_states)
    return Snapshot(
        command=CommandFrame(
            position=_floats(position),
            velocity=_floats(velocity),
            feedforward_torque=_floats(feedforward),
            kp=_floats(kp),
            kd=_floats(kd),
            applied_torque=_floats(applied),
            source=command_source,
            mode=str(getattr(robot.motor_chain, "control_mode", "MIT")),
        ),
        measured=MeasuredFrame(
            position=_floats(measured_position),
            velocity=_floats(measured_velocity),
            effort=_floats(effort),
            temp_mos_c=_floats(temp_mos),
            temp_rotor_c=_floats(temp_rotor),
            motor_error_code=codes,
            motor_error_message=tuple("normal" if code == 1 else f"motor_error_{code:#x}" for code in codes),
            chain_running=bool(robot.motor_chain.running),
        ),
        capture_quality=CaptureQuality.BEST_EFFORT,
        source_wall_time_ns=int(float(source_timestamp) * 1_000_000_000),
        teleop=teleop,
        controller={"warning": "command and measured state were polled under separate locks"},
    )
