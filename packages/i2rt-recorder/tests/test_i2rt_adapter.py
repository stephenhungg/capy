from __future__ import annotations

from types import SimpleNamespace

from i2rt_recorder.i2rt_adapter import snapshot_from_control_cycle


class _Remapper:
    def to_command_joint_pos_space(self, value: list[float]) -> list[float]:
        return [*value[:-1], value[-1] / 2]

    def to_command_joint_vel_space(self, value: list[float]) -> list[float]:
        return [*value[:-1], value[-1] / 2]


def test_control_cycle_adapter_keeps_final_command_faults_and_source_time() -> None:
    robot = SimpleNamespace(
        remapper=_Remapper(),
        use_gravity_comp=True,
        use_coulomb_friction=False,
        _limit_gripper_force=8.0,
        motor_chain=SimpleNamespace(control_mode="MIT", running=True),
    )
    joint_state = SimpleNamespace(
        pos=[0.1, 0.5],
        vel=[0.2, 0.3],
        eff=[0.4, 0.5],
        temp_mos=[30.0, 31.0],
        temp_rotor=[28.0, 29.0],
        timestamp=123.25,
    )
    commands = SimpleNamespace(
        pos=[0.11, 1.0],
        vel=[0.0, 0.2],
        torques=[0.1, 0.2],
        kp=[10.0, 8.0],
        kd=[1.0, 0.5],
    )
    motors = [
        SimpleNamespace(error_code="0x1", error_message="normal"),
        SimpleNamespace(error_code="0xb", error_message="mosfet over temperature"),
    ]
    snapshot = snapshot_from_control_cycle(
        robot=robot,
        joint_state=joint_state,
        joint_commands=commands,
        motor_info=motors,
        applied_torque=[0.3, 0.6],
        command_source="teleop",
        upstream_position=[0.11, 0.7],
    )

    assert snapshot.command.position == (0.11, 0.5)
    assert snapshot.command.upstream_position == (0.11, 0.7)
    assert snapshot.measured.motor_error_code == (1, 11)
    assert snapshot.source_wall_time_ns == 123_250_000_000
    assert snapshot.controller["gravity_and_friction_torque"] == [0.19999999999999998, 0.39999999999999997]
