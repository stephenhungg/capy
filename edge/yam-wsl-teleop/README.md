# yam-wsl-teleop — physical edge application

The human-supervised i2rt control application for the physical YAM rig
(`friend-yam-right-01`): leader→follower teleoperation on a Windows/WSL2 host,
recording episodes with `i2rt-recorder` at `control_cycle` capture quality via
`snapshot_from_control_cycle()`, integrated at the exact seam documented in
[`packages/i2rt-recorder/docs/architecture.md`](../../packages/i2rt-recorder/docs/architecture.md).

Full rig bringup (WSL2 gs_usb kernel, usbipd, CAN, troubleshooting):
<https://github.com/ryan-chen-git/yam-wsl-teleop>

## Contents

- `capy_teleop.py` — the teleop + recording app. Runs against the pinned i2rt
  revision `47fee5e7` with the one-hunk seam patch below applied. One capy
  session directory **per episode**, each validated with `i2rt-recorder validate`
  the moment the operator declares its outcome.
- `i2rt-capy-control-cycle-seam.patch` — adds an opt-in, per-instance
  `_capy_frame_hook` to `MotorChainRobot._update_joint_state`, called immediately
  after `set_commands` returns. No effect unless a hook is installed.

## Field notes from the first physical sessions

- **One episode per session directory.** `validate` measures frame periods across
  the whole event stream without resetting `last_frame_monotonic` at episode
  boundaries (`validation.py`), so any multi-episode session false-warns on the
  operator's idle time between episodes. Suggested fix upstream: reset the gap
  timer on `episode_start`.
- **Declared `target_hz` on USB/IP transports.** This rig's usbipd→WSL2 SocketCAN
  path delivers a ~7.4 ms median frame period (~136 Hz) with occasional 20–100 ms
  stalls under CAN retry. Against a declared 150 Hz target those stalls breach the
  `|gap − period| > period` warning threshold; the app declares a conservative
  50 Hz floor and documents the measured rates in the manifest `extra` block.
- Real sessions from this rig validate `"valid": true, "warnings": []` with
  0 fault frames under that configuration.
