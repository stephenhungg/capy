from __future__ import annotations

from pathlib import Path
from typing import Any

from mcap.writer import CompressionType, IndexType, Writer

from i2rt_recorder import __version__
from i2rt_recorder.jsonutil import canonical_json
from i2rt_recorder.rawlog import load_events, read_manifest
from i2rt_recorder.validation import validate_raw_log

_EVENT_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "capy i2rt camera-free event",
    "type": "object",
    "required": [
        "sequence",
        "event_type",
        "episode_id",
        "recorder_monotonic_time_ns",
        "recorder_wall_time_ns",
        "payload",
    ],
}


def export_mcap(raw_root: Path, output_path: Path) -> Path:
    """Export a byte-stable, unchunked JSON-encoded MCAP from a valid raw log."""
    report = validate_raw_log(raw_root)
    if not report.valid:
        raise ValueError("raw log is invalid: " + "; ".join(report.errors))
    manifest = read_manifest(raw_root)
    events = load_events(raw_root)
    if output_path.exists():
        raise FileExistsError(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("xb") as stream:
        writer = Writer(
            stream,
            compression=CompressionType.NONE,
            index_types=IndexType.ALL,
            repeat_channels=True,
            repeat_schemas=True,
            use_chunking=False,
            use_statistics=True,
            use_summary_offsets=True,
            enable_crcs=True,
            enable_data_crcs=True,
        )
        writer.start(profile=manifest["schema_version"], library=f"capy-i2rt-recorder/{__version__}")
        schema_id = writer.register_schema(
            name="capy.i2rt.Event",
            encoding="jsonschema",
            data=canonical_json(_EVENT_SCHEMA).encode(),
        )
        topics = sorted({str(event["event_type"]) for event in events})
        channels = {
            event_type: writer.register_channel(
                topic=f"/capy/{event_type}",
                message_encoding="json",
                schema_id=schema_id,
                metadata={"schema_version": manifest["schema_version"]},
            )
            for event_type in topics
        }
        writer.add_metadata(name="capy_manifest", data={"json": canonical_json(manifest)})
        for event in events:
            wall_time = int(event["recorder_wall_time_ns"])
            source_wall_time = event.get("payload", {}).get("source_wall_time_ns")
            writer.add_message(
                channel_id=channels[str(event["event_type"])],
                log_time=wall_time,
                publish_time=int(source_wall_time) if source_wall_time is not None else wall_time,
                sequence=int(event["sequence"]),
                data=canonical_json(event).encode(),
            )
        writer.finish()
    return output_path
