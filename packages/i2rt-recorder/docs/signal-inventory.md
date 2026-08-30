# observed i2rt signal inventory

this inventory was made against the local i2rt tree at commit
`47fee5e7dec4e30ca054f798bda1c8894b465ed2` on 2026-08-30. that source tree had unrelated local changes,
so the file paths and observed runtime shapes below are the integration contract; the commit id alone is not a
claim that every observed line was pristine.

## yam-family arm and motor chain

| layer | available signal | units / shape | evidence and caveat |
|---|---|---|---|
| motor feedback | motor id | integer per motor | `i2rt/motor_drivers/utils.py::FeedbackFrameInfo.id` |
| motor feedback | error code and decoded message | 4-bit protocol code, text | `parse_recv_message`; `0x1` is normal. the source contains a todo saying the error nibble needs confirmation. |
| motor feedback | position | rad | decoded from the motor response, then direction/offset/unwrapping are applied by `DMChainCanInterface` |
| motor feedback | velocity | rad/s | decoded from the motor response and direction-adjusted |
| motor feedback | effort | nm torque | the source docstring calls this “current,” but the protocol parser decodes the torque field using `TORQUE_MIN/MAX`; it is not a current measurement |
| motor feedback | mos and rotor temperature | degrees celsius as float values | one unsigned byte each in the response |
| motor feedback | batch timestamp | unix wall seconds | one `time.time()` value is assigned to the whole cached `read_states()` batch; there is no device or per-joint timestamp |
| motor feedback | target torque | nm | `MotorInfo.target_torque` is a local copy of the requested torque, not independent feedback |
| unavailable | voltage and current | none | `MotorInfo.voltage` stays at the `-1` sentinel and no current is decoded. neither belongs in training state. |
| joint state | names, position, velocity, effort | one value per joint | `MotorChainRobot.JointStates`; the gripper is renamed `gripper` |
| joint state | temperatures | one mos and rotor value per joint | present on `JointStates`, although `JointStates.asdict()` omits them |
| arm observation | joint position, velocity, effort | arm-only vectors | `get_observations()` excludes the actuated gripper from these keys |
| command | position, velocity, feedforward torque, kp, kd | one value per motor | `JointCommands` and `DMChainCanInterface.set_commands()` |
| applied command | required/applied torque | one value per motor | feedforward + gravity compensation factor + optional coulomb friction, clipped by `clip_motor_torque` |
| control mode | mit or velocity | chain-level enum/string | the encoder implements `MIT` and `VEL`. `POS_VEL` exists as a name but `set_control()` explicitly refuses to encode it. |

the supported arm variants observed in `ArmType` are `yam`, `yam_pro`, `yam_ultra`, `yam_ultra_2`, `big_yam`,
and `no_arm`. motor ids, motor types, direction, offsets, gains, joint limits, gravity factors, and gripper
configuration come from the selected arm/gripper yaml and must be copied into the session manifest from the
actual constructed robot.

## gripper and teaching-handle signals

- actuated grippers observed: `crank_4310`, `linear_3507`, `linear_4310`, and `flexible_4310`; passive/end-effector
  options are `yam_teaching_handle` and `no_gripper`.
- an actuated gripper is the final motor/joint. its configured raw limits are mapped to normalized command-space
  position; `get_observations()` exposes `gripper_pos`, `gripper_vel`, and `gripper_eff` as length-one arrays.
- gripper commands can be changed by `GripperForceLimiter` before the motor cycle. the recorder therefore stores
  both an optional upstream target and the final cycle position whenever both are instrumented.
- the passive teaching-handle encoder exposes id, normalized position, velocity, and two boolean digital inputs.
  i2rt labels those inputs `[SYNC, RECORD]` in the mujoco interface. the gello path computes gripper command as
  `1 - encoder.position`.
- configured gripper limits, force limit, and calibration enablement are controller configuration, not measured
  signals. there is no contact switch, jaw force sensor, or six-axis force/torque sensor in the observed api.

## teleoperation and controller state

- the gello leader path exposes leader arm positions, the passive-handle-derived gripper command, the two handle
  buttons, and a `synchronized` software state. follower setpoints are latest-wins: stale queued commands are
  deliberately discarded.
- the browser/mujoco controller produces joint position setpoints from sliders or inverse kinematics and has an
  explicit enable gate. those UI states are not published by the robot protocol, so the caller must pass them as
  `TeleopFrame`/annotation data.
- the flow-base gamepad exposes three axes `[x, y, theta]` after a `0.05` deadband and buttons named `key_mode`,
  `key_left_2`, and `key_left_1`.
- arm controller configuration available from `get_robot_info()` includes arm/gripper types, kp/kd,
  gravity-comp idle kd, coulomb friction and enable flag, joint and gripper limits, gravity compensation factor,
  gripper index, force limit, and auto-recovery enablement.
- arm runtime state also exposes last applied motor torques and chain `running`. recovery attempts/counts and the
  active gripper force-limiter branch are not published; an inline integration should emit explicit safety or
  controller events if those matter.

## faults and safety-relevant states

motor response codes observed in `MotorErrorCode`:

| code | meaning |
|---:|---|
| `0x0` | disabled |
| `0x1` | normal |
| `0x8` | over voltage |
| `0x9` | under voltage |
| `0xa` | over current |
| `0xb` | mosfet over temperature |
| `0xc` | motor over temperature |
| `0xd` | communication loss |
| `0xe` | overload |

other observable failures are chain `running == false`, command/send exceptions, joint-limit rejection at startup
or during the loop, excessive computed inverse-dynamics torque (`>25 nm` in the observed arm code), writer/queue
failure, and optionally the flow base's latched `CasterFault`. motor auto-recovery can hide a transient from a
later poll, which is another reason exact integration must capture the same returned motor batch inside the cycle.

the physical e-stop circuit, external power state, mechanical collision, cable snag, gripper contact, and human
proximity are not digital signals in the observed arm api. they require explicit operator/safety-system events.

## flow base and linear rail (available in source, not assumed present)

- command: target local/global `[vx, vy, yaw_rate]`, optionally plus linear-rail velocity; base client refreshes at
  50 hz and applies configured clipping.
- state: odometry pose `[x,y,z,yaw]`, world/body velocity, four steer and four drive motor position/velocity/effort
  arrays, and chain running.
- rail state: motor rad/rad-s, calibrated linear m/m-s, motor effort, upper/lower limit inputs, homing/calibration
  state, and brake-related controller behavior.
- controller: default 200 hz ruckig loop, desired operational velocity/position, generated steer/drive velocity,
  actual elapsed loop time, command queue state, and a latched caster steering fault/history.

the initial scaffold targets yam-family arm episodes. these base signals are inventoried so an adapter can be added
without inventing a generic “joint” meaning for odometry or rail limits.

## timing surface

- dm chain nominal send/receive loop: `CONTROL_FREQ = 250` hz; source comments also define an expected measured
  period of `0.007 s`, so the rig must be measured rather than assumed to hit 4 ms.
- `MotorChainRobot` runs its own loop with a 1 ms sleep, reports actual frequency every 10 s, and warns below 100 hz.
- gello workers poll cached state at 2 ms, but that does not increase the underlying hardware update rate.
- legacy trajectory recording uses `time.monotonic()`; the existing i2rt mcap recorder uses the batch wall stamp.
- flow base defaults to 200 hz and integrates odometry with measured elapsed loop time.

capy's canonical ordering clock is recorder monotonic nanoseconds. recorder wall time and the i2rt batch wall time
are retained independently, and clock health reports source age, wall-clock steps, regressions, and rate drift.

## cameras

none were found or assumed on the user's rig. the canonical manifest requires `camera_streams: []`; validation
rejects camera/image/rgb/depth/video payload keys; mcap defines no camera topic; lerobot defines no image/video
feature or `videos/` directory.
