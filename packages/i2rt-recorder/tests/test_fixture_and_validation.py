from __future__ import annotations

import json
from pathlib import Path

from i2rt_recorder.fixture import create_fixed_geometry_fixture
from i2rt_recorder.rawlog import load_events
from i2rt_recorder.validation import validate_raw_log


def test_fixed_geometry_fixture_is_valid_and_camera_free(tmp_path: Path) -> None:
    recording = create_fixed_geometry_fixture(tmp_path / "recording")
    report = validate_raw_log(recording)

    assert report.valid, report.errors
    assert report.metrics["frames"] == 5
    assert report.metrics["completed_episodes"] == 1
    assert report.metrics["outcomes"] == {
        "00000000-0000-0000-0000-000000000101": "success",
    }
    manifest = json.loads((recording / "manifest.json").read_text())
    assert manifest["camera_streams"] == []
    assert not (recording / "videos").exists()
    assert {event["event_type"] for event in load_events(recording)} >= {
        "episode_start",
        "frame",
        "intervention",
        "safety_event",
        "episode_end",
    }


def test_validator_rejects_a_fabricated_camera_field(tmp_path: Path) -> None:
    recording = create_fixed_geometry_fixture(tmp_path / "recording")
    events_path = recording / "events.ndjson"
    lines = events_path.read_text().splitlines()
    frame = json.loads(lines[2])
    frame["payload"]["camera"] = {"fake": True}
    lines[2] = json.dumps(frame, separators=(",", ":"), sort_keys=True)
    events_path.write_text("\n".join(lines) + "\n")

    report = validate_raw_log(recording)
    assert not report.valid
    assert any("forbidden camera field" in error for error in report.errors)
