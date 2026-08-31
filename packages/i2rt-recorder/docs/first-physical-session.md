# first physical YAM session

the computer physically attached to the YAM is the capy edge node. it records beside the control loop, closes and validates the local journal, then uploads immutable artifacts directly to Railway over outbound HTTPS. the edge exposes no inbound port, receives no cloud motion command, and never gets database or object-store credentials.

## hard safety boundary

the checked-in capy CLI does not start or command the robot. the physical i2rt application must integrate `snapshot_from_control_cycle()` into its existing, human-supervised control loop at the exact seam documented in [`architecture.md`](./architecture.md). constructing an i2rt robot object is not a passive discovery action: it starts a control loop and can transmit commands.

before motor power, the human operator must confirm the physical e-stop and hard power cutoff, secure the base, clear the swept volume, retain the factory command timeout, set conservative motion/force/duration limits, survey the real task geometry, and verify the exact arm, gripper, CAN interface, motor configuration, firmware, offsets, gains, limits, and source revision.

the current adapter is accepted only against i2rt revision `47fee5e7dec4e30ca054f798bda1c8894b465ed2`. review and test the adapter before changing that pin.

## friend-computer setup

requirements:

- Linux host beside the YAM with the existing i2rt control application and SocketCAN setup
- outbound HTTPS access to `https://capy-i2rt-production.up.railway.app`
- Python 3.11+, Node.js 22+, and this repository
- the ingest token delivered through a private channel and stored outside git

install and verify the recorder without constructing a robot:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'packages/i2rt-recorder[dev]'
python -m pytest packages/i2rt-recorder/tests

ls -l /sys/class/net/can*
ip -details link show can0
git -C /path/to/i2rt rev-parse HEAD
```

do not bring up CAN, create a robot object, calibrate a gripper, disable a timeout, or apply motor power as part of software discovery. those happen only inside the rig's approved physical procedure.

## required closed recording

the supervised control application must produce one new directory containing:

```text
manifest.json
events.ndjson
geometry.json
```

the manifest must name the exact non-synthetic `rig_id`, the validated i2rt source revision, the real robot layout, and `camera_streams: []`. every accepted frame must use `control_cycle` capture quality. the journal must end with `session_end`, contain at least one completed episode with a manual outcome, and contain no motor fault frames or unresolved validation warnings. `geometry.json` must contain the physical survey method and match every episode's `geometry_id`.

## validate and upload

enter the token without placing it in shell history:

```bash
read -rsp 'capy ingest token: ' CAPY_INGEST_TOKEN
echo
export CAPY_INGEST_TOKEN
export CAPY_INGEST_URL='https://capy-i2rt-production.up.railway.app'

packages/i2rt-recorder/scripts/upload-session.sh \
  /data/capy/<physical-session-directory> \
  cap-yam-fixed-insertion-v1 \
  first-physical-yam-run

unset CAPY_INGEST_TOKEN
```

the command performs four fail-closed stages:

1. validate the raw journal;
2. reject fixture, best-effort, incomplete, faulted, unpinned, unknown-rig, or unsurveyed recordings;
3. produce a deterministic indexed `session.mcap` and byte-addressed `ingest-manifest.json`;
4. register, directly upload, stream-hash every artifact on Railway, and atomically finalize the session.

an exact retry is idempotent. changing any byte under the same session id is rejected. preserve the raw recording and generated envelope after upload.

## acceptance

the run is not physical evidence until all of these are true:

- the local validator returns `valid: true` with no warnings;
- the operator manually confirms the outcome against the mechanical gauge or switch;
- Railway finalization returns `status: verified`;
- the dashboard's verified-session and artifact counts increase;
- Railway control-plane inspection shows the operator-declared metadata `dataClass: physical`, `captureQuality: control_cycle`, and `provenanceClaim: operator_declared_physical`.

`verified` proves that Railway received the exact declared bytes. the physical provenance remains an operator claim until capy adds signed, per-rig attestation and server-side journal validation.
