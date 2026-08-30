# recorder architecture and integration

## data path

1. the i2rt control thread sends the final motor command and receives one feedback batch.
2. an inline hook builds a `Snapshot` from that exact command, returned motor batch, normalized `JointStates`,
   final applied torque, optional upstream target, and current teleop/controller state.
3. `Recorder.record_frame()` adds recorder monotonic/wall clocks, evaluates clock health, snapshots active
   intervention/safety flags, validates all vector dimensions, and enqueues one canonical event.
4. a single bounded writer thread assigns no new semantics: it writes events in their assigned sequence order to
   `events.ndjson`, flushing each complete line. queue overflow or writer failure is fatal and visible.
5. `manifest.json` is immutable session metadata. an interrupted final line can be discarded; all earlier lines
   remain independently parseable. incomplete episodes validate with a warning and are omitted from lerobot.
6. offline exporters validate the source log, then derive unchunked json-schema mcap and camera-free lerobot v3
   parquet. exporting the same input with the same package/dependency versions is byte deterministic.

the raw log is intentional rather than a shortcut: mcap/parquet compression, schemas, indexes, and episode stats
do not belong in a motor control loop, while newline-delimited canonical json gives straightforward crash recovery
and auditability. for production, put the recording directory on a local ssd and monitor queue/writer failures.

## exact i2rt seam

`snapshot_from_control_cycle()` is designed to be called inside `MotorChainRobot._update_joint_state` immediately
after these existing operations:

```python
motor_state = self.motor_chain.set_commands(...)
self._joint_state = self._motor_state_to_joint_state(motor_state)
```

the integration passes `self`, `self._joint_state`, the local `joint_commands`, `motor_state`, and
`motor_torques`. it then calls `Recorder.record_frame(snapshot)`. this captures the command that actually reached
the chain after gripper force limiting, plus the feedback returned for that same control cycle.

to preserve the upstream teleop/policy target as well, wrap or instrument `command_joint_pos()` and carry its
latest target/sequence into the hook as `upstream_position`. without that tap, i2rt overwrites the previous target
in `_commands`, and the distinction is unrecoverable after gripper limiting.

`best_effort_snapshot()` exists for bench bring-up without patching i2rt. it reads command and state under separate
locks and is always labeled `best_effort`; validation warns about it. do not use it to claim command/observation
alignment in a training dataset.

## event contract

- `session_start` / `session_end`: file-level lifecycle.
- `episode_start`: explicit task, fixed geometry id, operator, notes.
- `frame`: final command, measured state, teleop/controller state, source and recorder clocks, capture quality,
  active intervention and safety flags.
- `intervention`: start/stop with stable id, kind, actor, and reason.
- `safety_event`: start/clear with code, severity, message, source, and affected motor ids.
- `clock_issue`: machine-generated timing anomaly with measured value and configured limit.
- `episode_end`: required manual outcome (`success`, `failure`, `aborted`, or `invalid`) and rationale.

annotations are events rather than overloaded frame fields so boundaries remain exact. active flags are copied
onto frames for policy training convenience. non-normal motor codes and a stopped motor chain automatically create
and clear safety events on state transitions; operator and external-safety events use the same event contract.

## exports

the mcap has one deterministic `/capy/<event_type>` channel per observed type. messages use canonical json and a
single registered json schema; log time is recorder wall time, publish time is i2rt source wall time when present,
and recorder monotonic time remains inside every message.

the lerobot v3 export includes only completed episodes. policy rows contain `observation.state`, `action`, standard
index/time/task columns, intervention/safety/motor-fault flags, and the manual outcome code. `meta/capy_events.parquet`
retains complete annotations. `meta/info.json` explicitly has no video path or visual feature. the layout follows
the official lerobot v3 file-based parquet/metadata design inspected on 2026-08-30; compatibility must still be
run against the exact lerobot version selected for training before data collection is accepted.
