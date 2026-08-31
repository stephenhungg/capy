#!/usr/bin/env python3
"""Teleop with capy-native episode recording (control-cycle quality).

Wires capy's i2rt-recorder into the robot's control thread via the
`_capy_frame_hook` seam patched into MotorChainRobot._update_joint_state,
exactly as capy's docs/architecture.md specifies. Every frame captures the
command that actually reached the chain (post gripper force limiting), the same
cycle's feedback, the upstream teleop target, and the teleop context — quality
`control_cycle`, which is what capy's ingest requires for physical evidence.

Output: <out_root>/<wall timestamp>/ containing manifest.json + events.ndjson
(+ geometry.json written here). Validate + package with capy's CLI afterwards;
this script runs the validator for you at session close.

Controls (single keypress):
  hold q / w  -> jaws open / close while held, stop on release
  1..9        -> partial grip presets
  p           -> pause/resume mirroring
  r           -> start episode / stop episode (then g=success, b=failure, a=aborted)
  Ctrl+C      -> end session (auto-aborts an in-flight episode), zero torque

For the real upload run: use the rig_id Stephen registers, a genuinely surveyed
geometry (pass --geometry-file), and his capability id in upload-session.sh.
"""

import dataclasses
import json
import subprocess
import sys
import termios
import threading
import time
import tty
from pathlib import Path

import numpy as np
import tyro

from i2rt.robots.get_robot import get_yam_robot
from i2rt.robots.utils import ArmType, GripperType
from i2rt_recorder.i2rt_adapter import snapshot_from_control_cycle
from i2rt_recorder.model import RobotLayout, TeleopFrame
from i2rt_recorder.recorder import Recorder

MIRROR_HZ = 100
GLIDE_T = 3.0
GRIPPER_OPEN = 1.0
GRIPPER_CLOSED = 0.0
GRIPPER_SLEW = 1.2
JOG_NUDGE = 0.06
JOG_BURST_GAP = 0.6
JOG_FIRST_WINDOW = 0.45
JOG_REPEAT_WINDOW = 0.22

old_term = [None]
gripper_target = [None]
gripper_cmd = [None]
jog = {"dir": 0, "count": 0, "deadline": 0.0, "last_t": 0.0}
paused = [False]
last_leader = [None]  # latest leader qpos (6,) for the TeleopFrame
latest_upstream = [None]  # latest pre-clip 7-dof target sent by the mirror loop


@dataclasses.dataclass
class Args:
    task: str  # natural-language instruction, stored on every episode
    rig_id: str = "yam-wsl-bench-01"  # BENCH id; use Stephen's registered rig id for real uploads
    geometry_id: str = "bench-tabletop-v1"
    operator_id: str = "ryan-chen"
    out_root: str = "~/capy_sessions"
    geometry_file: str = ""  # path to a surveyed geometry.json; must carry the same geometry_id
    survey_method: str = "tape measure and base-frame reference on the physical bench"
    geometry_description: str = "tabletop manipulation cell; poses surveyed by hand"
    follower_channel: str = "can0"
    leader_channel: str = "can1"
    target_hz: int = 50  # declared floor, not the achieved rate: the usbipd transport
    # delivers ~136 Hz median but stalls 20-100 ms on CAN retries, and capy's
    # validator warns on any |gap - period| > period. 50 Hz gives 40 ms of honest
    # headroom; the measured rate is documented in the manifest extra block.


class CapySession:
    """One capy Recorder (= one session dir) PER EPISODE.

    capy's validator measures frame gaps across the whole file without resetting
    at episode boundaries, so any multi-episode session false-warns on the idle
    time between episodes. One episode per session makes that structurally
    impossible; each 'r'...'g' cycle yields its own uploadable directory,
    validated on the spot."""

    def __init__(self, args: Args, i2rt_rev: str):
        self.args = args
        self.layout = RobotLayout(
            joint_names=("joint1", "joint2", "joint3", "joint4", "joint5", "joint6", "gripper"),
            motor_ids=(1, 2, 3, 4, 5, 6, 7),
            target_hz=args.target_hz,
            arm_type="yam",
            gripper_type="linear_4310",
            gripper_index=6,
            control_mode="MIT",
            i2rt_source_revision=i2rt_rev,
            rig_id=args.rig_id,
        )
        self.lock = threading.Lock()
        self.rec = None
        self.episode_active = False
        self.episode_n = 0
        self.completed_dirs = []

    def start_episode(self) -> None:
        with self.lock:
            if self.episode_active:
                return
            self.episode_n += 1
            root = (Path(self.args.out_root).expanduser()
                    / f"{time.strftime('%Y%m%d_%H%M%S')}_ep{self.episode_n:02d}")
            self.rec = Recorder(
                root,
                self.layout,
                extra_manifest={
                    "transport": "canable2 gs_usb via usbipd into WSL2 socketcan",
                    "leader_input": "YAM leader arm (teaching-handle encoder offline; "
                                    "gripper + episode keys from keyboard)",
                    "teleop_app": "capy_teleop.py",
                    "target_hz_note": "declared floor; measured median frame period "
                                      "~7.4 ms (~136 Hz) with 20-100 ms stalls under "
                                      "USB/IP retry, see transport",
                },
            )
            self.write_geometry(root)
            self.rec.start_episode(
                task=self.args.task,
                geometry_id=self.args.geometry_id,
                operator_id=self.args.operator_id,
            )
            self.current_dir = root
            self.episode_active = True
        print(f"\n[CAPY] episode {self.episode_n} recording -> {root.name} — perform the task")

    def end_episode(self, outcome: str, reason: str) -> None:
        with self.lock:
            if not self.episode_active:
                return
            self.episode_active = False
            self.rec.end_episode(outcome, reason=reason)
            self.rec.close()
            self.rec = None
            ep_dir = self.current_dir
        print(f"[CAPY] episode {self.episode_n} ended: {outcome} — validating {ep_dir.name}...")
        r = subprocess.run(
            [sys.executable, "-m", "i2rt_recorder.cli", "validate", str(ep_dir)],
            capture_output=True, text=True,
        )
        verdict = r.stdout.strip() or r.stderr.strip()
        clean = '"valid": true' in verdict and '"warnings": []' in verdict
        print(f"[CAPY] {'CLEAN — uploadable' if clean else 'NOT CLEAN:'}")
        if not clean:
            print(verdict)
        if outcome == "success" and clean:
            self.completed_dirs.append(str(ep_dir))

    def write_geometry(self, root: Path) -> None:
        if self.args.geometry_file:
            src = Path(self.args.geometry_file).expanduser()
            geometry = json.loads(src.read_text(encoding="utf-8"))
            if geometry.get("geometry_id") != self.args.geometry_id:
                raise SystemExit(
                    f"--geometry-file geometry_id {geometry.get('geometry_id')!r} "
                    f"!= --geometry-id {self.args.geometry_id!r}"
                )
        else:
            geometry = {
                "geometry_id": self.args.geometry_id,
                "description": self.args.geometry_description,
                "units": {"translation": "m", "rotation": "rad"},
                "base_frame": "robot_base",
                "survey_method": self.args.survey_method,
            }
        (root / "geometry.json").write_text(
            json.dumps(geometry, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    def frame_hook(self, follower):
        """Returns the callable installed as follower._capy_frame_hook."""

        def hook(motor_state, joint_commands, motor_torques) -> None:
            if not self.episode_active:
                return
            leader_pos = last_leader[0]
            teleop = TeleopFrame(
                source="yam_leader_arm+keyboard_gripper",
                enabled=True,
                synchronized=not paused[0],
                leader_joint_position=tuple(float(x) for x in leader_pos)
                if leader_pos is not None else None,
                gripper_command=float(gripper_cmd[0]) if gripper_cmd[0] is not None else None,
            )
            upstream = latest_upstream[0]
            snap = snapshot_from_control_cycle(
                robot=follower,
                joint_state=follower._joint_state,
                joint_commands=joint_commands,
                motor_info=motor_state,
                applied_torque=motor_torques,
                command_source="human_teleop",
                upstream_position=tuple(float(x) for x in upstream)
                if upstream is not None else None,
                teleop=teleop,
            )
            with self.lock:
                if self.episode_active and self.rec is not None:
                    self.rec.record_frame(snap)

        return hook

    def close(self) -> None:
        with self.lock:
            if self.episode_active and self.rec is not None:
                self.episode_active = False
                self.rec.end_episode("aborted", reason="session terminated by operator")
                self.rec.close()
                self.rec = None
                print("[CAPY] in-flight episode marked aborted")


def _i2rt_rev() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True,
            cwd=Path(__file__).parent, timeout=5,
        ).stdout.strip()
    except Exception:
        return "unknown"


def advance_gripper(dt: float) -> float:
    now = time.monotonic()
    if jog["dir"] != 0:
        if jog["count"] >= 2 and now < jog["deadline"]:
            gripper_target[0] = float(np.clip(gripper_cmd[0] + jog["dir"] * 0.1, 0.0, 1.0))
        elif now >= jog["deadline"]:
            jog["dir"] = 0
            gripper_target[0] = gripper_cmd[0]
    step = float(np.clip(gripper_target[0] - gripper_cmd[0], -GRIPPER_SLEW * dt, GRIPPER_SLEW * dt))
    gripper_cmd[0] += step
    return gripper_cmd[0]


def keyboard_thread(session: CapySession) -> None:
    pending_outcome = [False]
    while True:
        ch = sys.stdin.read(1)
        if not ch:
            return
        ch = ch.lower()
        now = time.monotonic()
        if pending_outcome[0]:
            if ch in ("g", "b", "a"):
                session.end_episode(
                    {"g": "success", "b": "failure", "a": "aborted"}[ch],
                    reason=f"operator declared via keypress '{ch}'",
                )
                pending_outcome[0] = False
            else:
                print("(episode stopping — press g=success, b=failure, a=aborted)")
            continue
        if ch == "r":
            if not session.episode_active:
                session.start_episode()
            else:
                print("[CAPY] stopping episode — outcome? g=success, b=failure, a=aborted")
                pending_outcome[0] = True
            continue
        if ch == "p":
            paused[0] = not paused[0]
            print("PAUSED — follower holding; 'p' to re-engage"
                  if paused[0] else "resuming — follower gliding to leader...")
        elif ch in ("q", "w"):
            d = 1 if ch == "q" else -1
            if d != jog["dir"] or now - jog["last_t"] > JOG_BURST_GAP:
                jog["dir"] = d
                jog["count"] = 1
                jog["deadline"] = now + JOG_FIRST_WINDOW
                gripper_target[0] = float(np.clip(gripper_cmd[0] + d * JOG_NUDGE, 0.0, 1.0))
                print("gripper: opening..." if d > 0 else "gripper: closing...")
            else:
                jog["count"] += 1
                jog["deadline"] = now + JOG_REPEAT_WINDOW
            jog["last_t"] = now
        elif ch.isdigit() and ch != "0":
            jog["dir"] = 0
            gripper_target[0] = int(ch) / 10.0
            print(f"gripper -> {gripper_target[0]:.1f}")


def connect(label: str, tries: int = 3, **kwargs):
    for attempt in range(1, tries + 1):
        try:
            return get_yam_robot(**kwargs)
        except (AssertionError, RuntimeError) as e:
            if attempt == tries:
                raise
            print(f"{label}: init hiccup ({e}); retry {attempt + 1}/{tries} in 2 s")
            time.sleep(2.0)


def main(args: Args) -> None:
    print("=== connecting follower — gripper will calibrate ===")
    follower = connect("follower", channel=args.follower_channel,
                       arm_type=ArmType.YAM, gripper_type=GripperType.LINEAR_4310)
    print("=== connecting leader — it will float ===")
    leader = connect("leader", channel=args.leader_channel,
                     arm_type=ArmType.YAM, gripper_type=GripperType.NO_GRIPPER)

    session = CapySession(args, _i2rt_rev())
    print(f"rig_id: {args.rig_id}   task: {args.task!r}"
          "\none capy session dir per episode; each validated as you finish it")

    try:
        follower_now = follower.get_joint_pos().copy()
        gripper_target[0] = float(follower_now[6])
        gripper_cmd[0] = float(follower_now[6])
        leader_now = leader.get_joint_pos().copy()
        last_leader[0] = leader_now.copy()
        print(f"\nfollower gliding to leader pose over {GLIDE_T:.0f} s — clear the workspace")
        steps = int(GLIDE_T * MIRROR_HZ)
        for i in range(steps + 1):
            a = i / steps
            a = a * a * (3 - 2 * a)
            target = np.concatenate(
                [(1 - a) * follower_now[:6] + a * leader_now, [advance_gripper(1.0 / MIRROR_HZ)]]
            )
            latest_upstream[0] = target
            follower.command_joint_pos(target)
            time.sleep(1.0 / MIRROR_HZ)

        # Recording seam: installed only after the glide so episodes never start mid-glide.
        follower._capy_frame_hook = session.frame_hook(follower)

        if sys.stdin.isatty():
            old_term[0] = termios.tcgetattr(sys.stdin.fileno())
            tty.setcbreak(sys.stdin.fileno())
        threading.Thread(target=keyboard_thread, args=(session,), daemon=True).start()

        print("\n=== MIRRORING LIVE (capy recording armed) ===")
        print("HOLD q/w = open/close | 1-9 = partial | p = pause | r = episode start/stop"
              " | Ctrl+C = end session")

        was_paused = False
        t_next = time.monotonic()
        while True:
            if paused[0]:
                if not was_paused:
                    held6 = follower.get_joint_pos()[:6].copy()
                    was_paused = True
                g = advance_gripper(1.0 / MIRROR_HZ)
                target = np.concatenate([held6, [g]])
                latest_upstream[0] = target
                follower.command_joint_pos(target)
            else:
                if was_paused:
                    was_paused = False
                    start = follower.get_joint_pos()[:6].copy()
                    end = leader.get_joint_pos()[:6].copy()
                    steps = int(1.5 * MIRROR_HZ)
                    for i in range(steps + 1):
                        a = i / steps
                        a = a * a * (3 - 2 * a)
                        target = np.concatenate(
                            [(1 - a) * start + a * end, [advance_gripper(1.0 / MIRROR_HZ)]]
                        )
                        latest_upstream[0] = target
                        follower.command_joint_pos(target)
                        time.sleep(1.0 / MIRROR_HZ)
                    t_next = time.monotonic()
                leader_pos = leader.get_joint_pos()[:6]
                last_leader[0] = leader_pos.copy()
                target = np.concatenate([leader_pos, [advance_gripper(1.0 / MIRROR_HZ)]])
                latest_upstream[0] = target
                follower.command_joint_pos(target)
            t_next += 1.0 / MIRROR_HZ
            delay = t_next - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            else:
                t_next = time.monotonic()
    except KeyboardInterrupt:
        print("\nCtrl+C — ending session (support the follower).")
    finally:
        follower._capy_frame_hook = None
        session.close()
        if old_term[0] is not None:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, old_term[0])
        follower.close()
        leader.close()
        if session.completed_dirs:
            print(f"\n[CAPY] {len(session.completed_dirs)} clean successful episode(s), "
                  "each its own uploadable session:")
            for i, d in enumerate(session.completed_dirs, 1):
                print(f"  ~/capy/packages/i2rt-recorder/scripts/upload-session.sh {d}"
                      f" cap-yam-fixed-insertion-v1 physical-yam-run-{i:02d}")
        else:
            print("\n[CAPY] no clean successful episodes recorded — nothing to upload")


if __name__ == "__main__":
    main(tyro.cli(Args))
