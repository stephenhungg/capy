from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from i2rt_recorder.fixture import create_fixed_geometry_fixture
from i2rt_recorder.prepare_ingest import VALIDATED_I2RT_REVISION, prepare_ingest_manifest


def _physical_recording(root: Path) -> Path:
    recording = create_fixed_geometry_fixture(root)
    session_id = "physical-yam-20260830-001"
    manifest_path = recording / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["session_id"] = session_id
    manifest["robot"]["rig_id"] = "friend-yam-right-01"
    manifest["robot"]["i2rt_source_revision"] = VALIDATED_I2RT_REVISION
    manifest["extra"] = {"fixture": False, "capture_class": "physical"}
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    events_path = recording / "events.ndjson"
    events = [json.loads(line) for line in events_path.read_text(encoding="utf-8").splitlines()]
    for event in events:
        if event["event_type"] == "session_start":
            event["payload"]["session_id"] = session_id
        elif event["event_type"] == "episode_start":
            event["payload"]["operator_id"] = "operator-01"
            event["payload"]["notes"] = "human-supervised physical run"
        elif event["event_type"] == "frame":
            event["payload"]["capture_quality"] = "control_cycle"
        elif event["event_type"] == "episode_end":
            event["payload"]["reason"] = "operator confirmed the mechanical depth gauge"
    events_path.write_text(
        "".join(json.dumps(event, separators=(",", ":"), sort_keys=True) + "\n" for event in events),
        encoding="utf-8",
    )

    geometry_path = recording / "geometry.json"
    geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    geometry["description"] = "fixed square peg insertion on the surveyed physical cell"
    geometry["survey_method"] = "calibrated caliper and base-frame probing with recorded uncertainty"
    geometry_path.write_text(json.dumps(geometry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return recording


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_prepare_ingest_packages_closed_physical_recording(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    output = prepare_ingest_manifest(
        recording,
        capability_id="cap-yam-fixed-insertion-v1",
        run_id="physical-run-001",
    )
    first_bytes = output.read_bytes()
    manifest = json.loads(first_bytes)

    assert manifest["sessionId"] == "physical-yam-20260830-001"
    assert manifest["robotId"] == "friend-yam-right-01"
    assert manifest["cameraFree"] is True
    assert manifest["cameraStreams"] == 0
    assert manifest["metadata"]["dataClass"] == "physical"
    assert manifest["metadata"]["captureQuality"] == "control_cycle"
    assert manifest["metadata"]["provenanceClaim"] == "operator_declared_physical"
    assert manifest["metadata"]["rigConnected"] is True
    assert manifest["metadata"]["synthetic"] is False
    assert {artifact["name"] for artifact in manifest["artifacts"]} == {
        "events.ndjson",
        "geometry.json",
        "manifest.json",
        "session.mcap",
    }
    for artifact in manifest["artifacts"]:
        artifact_path = recording / artifact["name"]
        assert artifact["byteLength"] == artifact_path.stat().st_size
        assert artifact["sha256"] == _sha256(artifact_path)

    assert prepare_ingest_manifest(
        recording,
        capability_id="cap-yam-fixed-insertion-v1",
        run_id="physical-run-001",
    ) == output
    assert output.read_bytes() == first_bytes


def test_prepare_ingest_rejects_synthetic_fixture(tmp_path: Path) -> None:
    recording = create_fixed_geometry_fixture(tmp_path / "recording")

    with pytest.raises(ValueError, match="synthetic fixtures"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")


def test_prepare_ingest_rejects_best_effort_capture(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    events_path = recording / "events.ndjson"
    events = [json.loads(line) for line in events_path.read_text(encoding="utf-8").splitlines()]
    next(event for event in events if event["event_type"] == "frame")["payload"]["capture_quality"] = "best_effort"
    events_path.write_text(
        "".join(json.dumps(event, separators=(",", ":"), sort_keys=True) + "\n" for event in events),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="unresolved warnings"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")


def test_prepare_ingest_rejects_missing_geometry(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    (recording / "geometry.json").unlink()

    with pytest.raises(ValueError, match="surveyed geometry"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")


def test_prepare_ingest_rejects_unvalidated_i2rt_revision(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    manifest_path = recording / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["robot"]["i2rt_source_revision"] = "unreviewed"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="validated only"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")


def test_prepare_ingest_rejects_incomplete_session(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    events_path = recording / "events.ndjson"
    events = [json.loads(line) for line in events_path.read_text(encoding="utf-8").splitlines()]
    events[-1]["payload"]["incomplete_episode_id"] = events[1]["episode_id"]
    events_path.write_text(
        "".join(json.dumps(event, separators=(",", ":"), sort_keys=True) + "\n" for event in events),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="incomplete episode"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")


def test_prepare_ingest_rejects_unknown_rig(tmp_path: Path) -> None:
    recording = _physical_recording(tmp_path / "recording")
    manifest_path = recording / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["robot"]["rig_id"] = "unknown"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="specific non-synthetic rig_id"):
        prepare_ingest_manifest(recording, capability_id="cap-yam-fixed-insertion-v1")
