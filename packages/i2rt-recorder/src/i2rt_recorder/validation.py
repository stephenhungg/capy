from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from i2rt_recorder.model import SCHEMA_VERSION, Outcome
from i2rt_recorder.rawlog import load_events, read_manifest

_CAMERA_KEYS = {"camera", "cameras", "image", "images", "rgb", "depth", "video", "videos"}


@dataclass
class ValidationReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    @property
    def valid(self) -> bool:
        return not self.errors


def _find_camera_key(value: Any, path: str = "payload") -> str | None:
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = str(key).lower().replace("_", ".").split(".")
            if any(part in _CAMERA_KEYS for part in normalized):
                return f"{path}.{key}"
            found = _find_camera_key(item, f"{path}.{key}")
            if found:
                return found
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found = _find_camera_key(item, f"{path}[{index}]")
            if found:
                return found
    return None


def validate_raw_log(root: Path) -> ValidationReport:
    report = ValidationReport()
    try:
        manifest = read_manifest(root)
        events = load_events(root)
    except (OSError, ValueError) as exc:
        report.errors.append(str(exc))
        return report

    if manifest.get("schema_version") != SCHEMA_VERSION:
        report.errors.append(f"unsupported schema_version: {manifest.get('schema_version')!r}")
    if manifest.get("camera_streams") != []:
        report.errors.append("camera_streams must be an explicit empty list for this recorder")
    robot = manifest.get("robot", {})
    joint_names = robot.get("joint_names", [])
    size = len(joint_names)
    if not size:
        report.errors.append("manifest has no robot.joint_names")
    if len(robot.get("motor_ids", [])) != size:
        report.errors.append("manifest motor_ids length does not match joint_names")

    expected_sequence = 0
    active_episode: str | None = None
    completed: dict[str, str] = {}
    frame_count = 0
    last_monotonic: int | None = None
    last_frame_monotonic: int | None = None
    frame_periods: list[int] = []
    capture_quality: dict[str, int] = {}
    fault_frames = 0
    for event in events:
        sequence = event.get("sequence")
        if sequence != expected_sequence:
            report.errors.append(f"expected sequence {expected_sequence}, got {sequence}")
            expected_sequence = sequence if isinstance(sequence, int) else expected_sequence
        expected_sequence += 1
        monotonic = event.get("recorder_monotonic_time_ns")
        if not isinstance(monotonic, int):
            report.errors.append(f"event {sequence} has no integer recorder monotonic timestamp")
        elif last_monotonic is not None and monotonic < last_monotonic:
            report.errors.append(f"event {sequence} regresses recorder monotonic time")
        if isinstance(monotonic, int):
            last_monotonic = monotonic

        event_type = event.get("event_type")
        episode_id = event.get("episode_id")
        payload = event.get("payload", {})
        camera_key = _find_camera_key(payload)
        if camera_key:
            report.errors.append(f"event {sequence} contains forbidden camera field {camera_key}")
        if event_type == "episode_start":
            if active_episode is not None:
                report.errors.append(f"episode {active_episode} was not ended before {episode_id} started")
            if not episode_id:
                report.errors.append(f"episode_start {sequence} has no episode_id")
            active_episode = episode_id
        elif event_type == "episode_end":
            if active_episode != episode_id:
                report.errors.append(f"episode_end {sequence} does not match active episode {active_episode}")
            outcome = payload.get("outcome")
            if outcome not in {item.value for item in Outcome}:
                report.errors.append(f"episode_end {sequence} has invalid manual outcome {outcome!r}")
            if episode_id:
                completed[episode_id] = str(outcome)
            active_episode = None
        elif event_type == "frame":
            frame_count += 1
            if active_episode != episode_id or not episode_id:
                report.errors.append(f"frame {sequence} is outside its active episode")
            for group, fields in {
                "command": ("position", "velocity", "feedforward_torque", "kp", "kd", "applied_torque"),
                "measured": (
                    "position",
                    "velocity",
                    "effort",
                    "temp_mos_c",
                    "temp_rotor_c",
                    "motor_error_code",
                    "motor_error_message",
                ),
            }.items():
                values = payload.get(group, {})
                for field_name in fields:
                    actual = values.get(field_name)
                    if not isinstance(actual, list) or len(actual) != size:
                        report.errors.append(
                            f"frame {sequence} {group}.{field_name} length is not robot joint count {size}"
                        )
            quality = payload.get("capture_quality", "missing")
            capture_quality[quality] = capture_quality.get(quality, 0) + 1
            codes = payload.get("measured", {}).get("motor_error_code", [])
            if any(code != 1 for code in codes):
                fault_frames += 1
            if isinstance(monotonic, int) and last_frame_monotonic is not None:
                frame_periods.append(monotonic - last_frame_monotonic)
            if isinstance(monotonic, int):
                last_frame_monotonic = monotonic
        elif event_type in {"intervention", "safety_event"} and active_episode != episode_id:
            report.errors.append(f"{event_type} {sequence} is outside its active episode")

    if active_episode is not None:
        report.warnings.append(f"incomplete episode is recoverable but not exportable: {active_episode}")
    if not completed:
        report.warnings.append("recording has no completed episodes with manual outcomes")
    if capture_quality.get("best_effort"):
        report.warnings.append("best_effort frames are not same-cycle command/state captures")
    target_hz = robot.get("target_hz")
    if frame_periods and isinstance(target_hz, int) and target_hz > 0:
        expected_period = 1_000_000_000 / target_hz
        largest_error = max(abs(period - expected_period) for period in frame_periods)
        report.metrics["max_period_error_ms"] = largest_error / 1_000_000
        if largest_error > expected_period:
            report.warnings.append("at least one frame gap exceeds two target periods")
    report.metrics.update(
        {
            "events": len(events),
            "frames": frame_count,
            "completed_episodes": len(completed),
            "outcomes": completed,
            "capture_quality": capture_quality,
            "fault_frames": fault_frames,
        }
    )
    return report
