from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from i2rt_recorder.export_mcap import export_mcap
from i2rt_recorder.jsonutil import pretty_json
from i2rt_recorder.rawlog import EVENTS_NAME, MANIFEST_NAME, load_events, read_manifest
from i2rt_recorder.validation import validate_raw_log

VALIDATED_I2RT_REVISION = "47fee5e7dec4e30ca054f798bda1c8894b465ed2"
DEFAULT_MCAP_NAME = "session.mcap"
DEFAULT_INGEST_MANIFEST_NAME = "ingest-manifest.json"

_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_UNTRUSTED_RIG_IDS = {"unknown", "fixture", "synthetic", "synthetic-fixed-geometry-fixture"}


def _require_identifier(label: str, value: object, *, maximum: int = 128) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= maximum or not _SAFE_IDENTIFIER.fullmatch(value):
        raise ValueError(f"{label} must be a safe identifier of at most {maximum} characters")
    return value


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _artifact(artifact_id: str, name: str, kind: str, media_type: str, root: Path) -> dict[str, Any]:
    path = root / name
    size = path.stat().st_size
    if size <= 0:
        raise ValueError(f"artifact is empty: {name}")
    return {
        "id": artifact_id,
        "name": name,
        "kind": kind,
        "mediaType": media_type,
        "byteLength": size,
        "sha256": _sha256(path),
    }


def _iso_utc(timestamp_ns: int) -> str:
    seconds, nanoseconds = divmod(timestamp_ns, 1_000_000_000)
    timestamp = datetime.fromtimestamp(seconds, tz=UTC)
    return f"{timestamp:%Y-%m-%dT%H:%M:%S}.{nanoseconds // 1_000_000:03d}Z"


def _ensure_deterministic_mcap(recording: Path, output: Path) -> None:
    candidate = recording / f".{output.name}.candidate"
    if candidate.exists():
        raise FileExistsError(f"stale packaging candidate exists: {candidate}")
    try:
        export_mcap(recording, candidate)
        if output.exists():
            if output.stat().st_size != candidate.stat().st_size or _sha256(output) != _sha256(candidate):
                raise ValueError(f"existing {output.name} does not match the current source journal")
        else:
            candidate.replace(output)
    finally:
        candidate.unlink(missing_ok=True)


def _read_physical_geometry(recording: Path, expected_ids: set[str]) -> dict[str, Any]:
    geometry_path = recording / "geometry.json"
    try:
        geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError("physical recording requires a surveyed geometry.json") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"geometry.json is invalid: {exc}") from exc
    if not isinstance(geometry, dict):
        raise ValueError("geometry.json must be an object")
    geometry_id = geometry.get("geometry_id")
    if not isinstance(geometry_id, str) or {geometry_id} != expected_ids:
        raise ValueError("geometry.json geometry_id must match every recorded episode")
    survey_method = geometry.get("survey_method")
    if not isinstance(survey_method, str) or not survey_method.strip():
        raise ValueError("geometry.json requires a physical survey_method")
    lowered = survey_method.lower()
    if "synthetic" in lowered or "replace" in lowered:
        raise ValueError("geometry.json still contains synthetic or replacement survey metadata")
    return geometry


def prepare_ingest_manifest(
    recording: Path,
    *,
    capability_id: str,
    run_id: str | None = None,
    output_manifest: Path | None = None,
) -> Path:
    """Package one closed, exact-cycle physical recording for the Railway ingress."""
    recording = recording.resolve()
    output_manifest = (output_manifest or recording / DEFAULT_INGEST_MANIFEST_NAME).resolve()
    if output_manifest.parent != recording:
        raise ValueError("the ingest manifest must live beside its recording artifacts")
    _require_identifier("capability_id", capability_id)
    if run_id is not None:
        _require_identifier("run_id", run_id)

    report = validate_raw_log(recording)
    if not report.valid:
        raise ValueError("raw log is invalid: " + "; ".join(report.errors))

    source_manifest = read_manifest(recording)
    events = load_events(recording)
    extra = source_manifest.get("extra")
    if isinstance(extra, dict) and extra.get("fixture") is True:
        raise ValueError("synthetic fixtures cannot be packaged as physical evidence")

    if report.warnings:
        raise ValueError("physical recording has unresolved warnings: " + "; ".join(report.warnings))
    if report.metrics.get("frames", 0) <= 0 or report.metrics.get("completed_episodes", 0) <= 0:
        raise ValueError("physical recording requires frames and a completed episode")
    if report.metrics.get("fault_frames", 0) != 0:
        raise ValueError("physical recording contains motor fault frames")
    capture_quality = report.metrics.get("capture_quality", {})
    if set(capture_quality) != {"control_cycle"}:
        raise ValueError("every physical frame must be an exact control_cycle capture")

    source_session_id = _require_identifier("source session_id", source_manifest.get("session_id"))
    if events[0].get("event_type") != "session_start":
        raise ValueError("physical journal must begin with session_start")
    if events[0].get("payload", {}).get("session_id") != source_session_id:
        raise ValueError("source manifest and session_start ids do not match")
    if events[-1].get("event_type") != "session_end":
        raise ValueError("physical journal must be closed with session_end")
    if events[-1].get("payload", {}).get("incomplete_episode_id") is not None:
        raise ValueError("physical journal ended with an incomplete episode")

    robot = source_manifest.get("robot")
    if not isinstance(robot, dict):
        raise ValueError("source manifest has no robot configuration")
    robot_id = _require_identifier("robot.rig_id", robot.get("rig_id"))
    if robot_id.lower() in _UNTRUSTED_RIG_IDS:
        raise ValueError("physical recording requires a specific non-synthetic rig_id")
    revision = robot.get("i2rt_source_revision")
    if not isinstance(revision, str) or revision.split("+", 1)[0] != VALIDATED_I2RT_REVISION:
        raise ValueError(f"physical adapter is validated only for i2rt revision {VALIDATED_I2RT_REVISION}")

    episode_starts = [event for event in events if event.get("event_type") == "episode_start"]
    if any(event.get("payload", {}).get("operator_id") == "fixture" for event in episode_starts):
        raise ValueError("physical episodes require a real operator identifier")
    geometry_ids = {
        str(event.get("payload", {}).get("geometry_id", ""))
        for event in episode_starts
        if event.get("payload", {}).get("geometry_id")
    }
    _read_physical_geometry(recording, geometry_ids)

    wall_times = [event.get("recorder_wall_time_ns") for event in events]
    if not all(isinstance(value, int) and value > 0 for value in wall_times):
        raise ValueError("every event requires a positive recorder wall timestamp")
    started_at = _iso_utc(int(wall_times[0]))
    ended_at = _iso_utc(int(wall_times[-1]))

    mcap_path = recording / DEFAULT_MCAP_NAME
    _ensure_deterministic_mcap(recording, mcap_path)
    artifacts = [
        _artifact("journal", EVENTS_NAME, "journal", "application/x-ndjson", recording),
        _artifact("source-manifest", MANIFEST_NAME, "metadata", "application/json", recording),
        _artifact("geometry", "geometry.json", "metadata", "application/json", recording),
        _artifact("telemetry", DEFAULT_MCAP_NAME, "telemetry", "application/octet-stream", recording),
    ]
    outcomes = report.metrics.get("outcomes", {})
    ingest_manifest: dict[str, Any] = {
        "schemaVersion": "1.0",
        "sessionId": source_session_id,
        "robotId": robot_id,
        "capabilityId": capability_id,
        "cameraFree": True,
        "cameraStreams": 0,
        "startedAt": started_at,
        "endedAt": ended_at,
        "eventCount": len(events),
        "artifacts": artifacts,
        "metadata": {
            "dataClass": "physical",
            "captureQuality": "control_cycle",
            "provenanceClaim": "operator_declared_physical",
            "rigConnected": True,
            "synthetic": False,
            "sourceSchema": source_manifest.get("schema_version"),
            "sourceRevision": revision,
            "armType": robot.get("arm_type"),
            "gripperType": robot.get("gripper_type"),
            "targetHz": robot.get("target_hz"),
            "completedEpisodes": report.metrics.get("completed_episodes", 0),
            "successfulEpisodes": sum(value == "success" for value in outcomes.values()),
        },
    }
    if run_id is not None:
        ingest_manifest["runId"] = run_id

    document = pretty_json(ingest_manifest)
    if output_manifest.exists():
        if output_manifest.read_text(encoding="utf-8") != document:
            raise ValueError("existing ingest manifest differs; use a new session id instead of mutating evidence")
        return output_manifest
    with output_manifest.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(document)
    return output_manifest
