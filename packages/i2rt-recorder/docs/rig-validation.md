# hardware assumptions and rig acceptance

## assumptions encoded by the scaffold

- the user's rig has zero cameras. no camera driver, timestamp, placeholder frame, black image, video folder, or
  visual feature is created.
- a yam-family arm has six actuated arm joints. an actuated gripper, when present, is the final seventh motor;
  teaching-handle/no-gripper configurations may have six motors plus a same-bus passive encoder.
- motor ids, types, directions, offsets, gains, joint limits, gripper limits, gravity factors, and expected rate
  are configuration, not universal constants. `RobotLayout` must be built from the actual robot instance/config.
- the motor feedback effort field is torque in nm, despite one stale i2rt docstring calling it current.
- the only i2rt time on an arm feedback batch is host unix wall time. no device clock, can-frame hardware stamp,
  per-joint acquisition time, or cross-machine synchronization quality is claimed.
- manual outcomes and operator/safety annotations come from a human or explicit external safety system. absence
  of an event does not prove a safe scene.
- fixed task geometry comes from surveyed constants. it is metadata and cannot detect that the fixture moved.
- flow base and linear rail are not assumed installed. their source-visible signals require a separate adapter.

## still requires the physical rig

1. identify the exact arm/gripper variants, can interfaces, motor ids/types, firmware, directions, offsets, limits,
   gains, gravity/friction configuration, force limit, and whether a teaching-handle encoder is fitted.
2. survey the real task geometry in the robot base frame and record tolerance/uncertainty; replace every synthetic
   value in `geometry.json`.
3. verify the error-code nibble against deliberate disabled/recoverable motor conditions because i2rt itself marks
   that parse as needing confirmation. verify temperatures and torque sign/scale against trusted tools.
4. integrate the exact control-cycle hook and upstream command tap; stress it at the configured control rate while
   measuring control jitter, recorder queue depth/overflow behavior, storage latency, and dropped can feedback.
5. characterize source age, wall steps, frame period distribution, and drift for the actual host(s). if leader and
   follower run on different machines, configure and independently verify clock synchronization.
6. confirm normalized gripper direction/endpoints, force-limiter adjustments, passive handle position, and the
   physical meaning/debounce of both handle buttons.
7. inject/observe every safety path available on the rig: physical e-stop, power loss, can loss, motor fault,
   over-temperature policy, joint-limit violation, auto-recovery, application crash, disk full, and operator pause.
8. run repeated fixed-geometry episodes and compare operator outcomes with any task-specific mechanical gauge or
   switch. without cameras or contact sensing, success remains a manual label.
9. load exported data with the exact downstream mcap tooling and pinned lerobot training release, checking feature
   names, dimensions, timestamps, episode offsets, task mapping, stats, and absence of visual modalities.

none of those checks can be honestly completed from this mac without the user's assembled rig.
