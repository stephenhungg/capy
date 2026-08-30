from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pyarrow.parquet as pq
from mcap.reader import make_reader

from i2rt_recorder.export_lerobot import export_lerobot
from i2rt_recorder.export_mcap import export_mcap
from i2rt_recorder.fixture import create_fixed_geometry_fixture


def _tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def test_mcap_and_lerobot_exports_are_deterministic(tmp_path: Path) -> None:
    recording = create_fixed_geometry_fixture(tmp_path / "recording")
    first_mcap = export_mcap(recording, tmp_path / "first.mcap")
    second_mcap = export_mcap(recording, tmp_path / "second.mcap")
    assert first_mcap.read_bytes() == second_mcap.read_bytes()
    with first_mcap.open("rb") as stream:
        reader = make_reader(stream)
        header = reader.get_header()
        summary = reader.get_summary()
        metadata = {record.name: record.metadata for record in reader.iter_metadata()}
        messages = list(reader.iter_messages())
    assert header.profile == "capy.i2rt.camera_free.v1"
    assert header.library == "capy-i2rt-recorder/0.1.0"
    assert summary is not None
    assert summary.statistics is not None
    assert summary.metadata_indexes
    assert all(schema.encoding == "jsonschema" for schema in summary.schemas.values())
    assert all(channel.message_encoding == "json" for channel in summary.channels.values())
    assert metadata["capy_source_journal"] == {
        "format": "capy.ndjson.camera_free.v1",
        "manifest_digest": f"sha256:{hashlib.sha256((recording / 'manifest.json').read_bytes()).hexdigest()}",
        "events_digest": f"sha256:{hashlib.sha256((recording / 'events.ndjson').read_bytes()).hexdigest()}",
    }
    assert len(messages) == 13
    assert {channel.topic for channel in summary.channels.values()} == {
        "/capy/session_start",
        "/capy/session_end",
        "/capy/frame",
        "/capy/episode_start",
        "/capy/episode_end",
        "/capy/intervention",
        "/capy/safety_event",
    }

    first = export_lerobot(recording, tmp_path / "lerobot-a")
    second = export_lerobot(recording, tmp_path / "lerobot-b")
    assert _tree_hash(first) == _tree_hash(second)


def test_lerobot_export_has_policy_signals_and_no_visual_modality(tmp_path: Path) -> None:
    recording = create_fixed_geometry_fixture(tmp_path / "recording")
    output = export_lerobot(recording, tmp_path / "lerobot")
    info = json.loads((output / "meta/info.json").read_text())
    data = pq.read_table(output / "data/chunk-000/file-000.parquet")
    episodes = pq.read_table(output / "meta/episodes/chunk-000/file-000.parquet")

    assert info["codebase_version"] == "v3.0"
    assert info["video_path"] is None
    assert info["capy"]["camera_streams"] == []
    assert not any(feature["dtype"] in {"image", "video"} for feature in info["features"].values())
    assert not (output / "videos").exists()
    assert data.num_rows == 5
    assert len(data["observation.state"][0].as_py()) == 35
    assert len(data["action"][0].as_py()) == 42
    assert episodes["capy/outcome"][0].as_py() == "success"
