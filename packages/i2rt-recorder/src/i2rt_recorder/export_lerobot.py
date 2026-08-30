from __future__ import annotations

import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from i2rt_recorder.jsonutil import pretty_json
from i2rt_recorder.rawlog import load_events, read_manifest
from i2rt_recorder.validation import validate_raw_log

OUTCOME_CODE = {"success": 1, "failure": 0, "aborted": -1, "invalid": -2}


def _feature(dtype: str, shape: list[int], names: list[str] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"dtype": dtype, "shape": shape}
    if names is not None:
        result["names"] = names
    return result


def _stats(rows: list[list[float]]) -> dict[str, list[float] | int]:
    columns = list(zip(*rows, strict=True)) if rows else []
    means = [sum(column) / len(column) for column in columns]
    stds = [
        math.sqrt(sum((value - mean) ** 2 for value in column) / len(column))
        for column, mean in zip(columns, means, strict=True)
    ]

    def quantile(column: tuple[float, ...], fraction: float) -> float:
        ordered = sorted(column)
        position = (len(ordered) - 1) * fraction
        lower = math.floor(position)
        upper = math.ceil(position)
        if lower == upper:
            return ordered[lower]
        return ordered[lower] * (upper - position) + ordered[upper] * (position - lower)

    return {
        "min": [min(column) for column in columns],
        "max": [max(column) for column in columns],
        "mean": means,
        "std": stds,
        "count": [len(rows)],
        "q01": [quantile(column, 0.01) for column in columns],
        "q10": [quantile(column, 0.10) for column in columns],
        "q50": [quantile(column, 0.50) for column in columns],
        "q90": [quantile(column, 0.90) for column in columns],
        "q99": [quantile(column, 0.99) for column in columns],
    }


def _write_table(path: Path, table: pa.Table) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(
        table,
        path,
        compression="zstd",
        compression_level=9,
        use_dictionary=False,
        write_statistics=True,
        data_page_version="2.0",
        version="2.6",
    )


def _fixed_list(values: list[list[float]], size: int) -> pa.Array:
    return pa.array(values, type=pa.list_(pa.float32(), size))


def export_lerobot(raw_root: Path, output_root: Path) -> Path:
    """Export completed episodes to camera-free LeRobotDataset v3 tabular storage."""
    report = validate_raw_log(raw_root)
    if not report.valid:
        raise ValueError("raw log is invalid: " + "; ".join(report.errors))
    if output_root.exists():
        raise FileExistsError(output_root)
    manifest = read_manifest(raw_root)
    events = load_events(raw_root)
    robot = manifest["robot"]
    joint_names = list(robot["joint_names"])
    joint_count = len(joint_names)

    starts: dict[str, dict[str, Any]] = {}
    ends: dict[str, dict[str, Any]] = {}
    frames: dict[str, list[dict[str, Any]]] = defaultdict(list)
    event_rows: list[dict[str, Any]] = []
    for event in events:
        episode_id = event.get("episode_id")
        if event["event_type"] == "episode_start" and episode_id:
            starts[episode_id] = event
        elif event["event_type"] == "episode_end" and episode_id:
            ends[episode_id] = event
        elif event["event_type"] == "frame" and episode_id:
            frames[episode_id].append(event)
        elif event["event_type"] in {"intervention", "safety_event", "clock_issue"} and episode_id:
            event_rows.append(
                {
                    "episode_id": episode_id,
                    "sequence": int(event["sequence"]),
                    "timestamp_ns": int(event["recorder_monotonic_time_ns"]),
                    "event_type": str(event["event_type"]),
                    "payload_json": pretty_json(event["payload"]).strip(),
                }
            )

    complete_ids = [episode_id for episode_id in starts if episode_id in ends]
    if not complete_ids:
        raise ValueError("no completed episodes are available for LeRobot export")
    tasks: list[str] = []
    for episode_id in complete_ids:
        task = str(starts[episode_id]["payload"]["task"])
        if task not in tasks:
            tasks.append(task)
    task_index = {task: index for index, task in enumerate(tasks)}

    state_names = [
        f"{joint}.{signal}"
        for signal in ("position", "velocity", "effort", "temp_mos_c", "temp_rotor_c")
        for joint in joint_names
    ]
    action_names = [
        f"{joint}.{signal}"
        for signal in ("position", "velocity", "feedforward_torque", "kp", "kd", "applied_torque")
        for joint in joint_names
    ]
    state_size = 5 * joint_count
    action_size = 6 * joint_count
    data: dict[str, list[Any]] = defaultdict(list)
    episode_meta: dict[str, list[Any]] = defaultdict(list)
    state_rows: list[list[float]] = []
    action_rows: list[list[float]] = []
    dataset_index = 0

    for episode_index, episode_id in enumerate(complete_ids):
        episode_frames = frames.get(episode_id, [])
        if not episode_frames:
            raise ValueError(f"completed episode has no frames: {episode_id}")
        start_index = dataset_index
        first_time = int(episode_frames[0]["recorder_monotonic_time_ns"])
        task = str(starts[episode_id]["payload"]["task"])
        outcome = str(ends[episode_id]["payload"]["outcome"])
        for frame_index, event in enumerate(episode_frames):
            payload = event["payload"]
            measured = payload["measured"]
            command = payload["command"]
            state = [
                *measured["position"],
                *measured["velocity"],
                *measured["effort"],
                *measured["temp_mos_c"],
                *measured["temp_rotor_c"],
            ]
            action = [
                *command["position"],
                *command["velocity"],
                *command["feedforward_torque"],
                *command["kp"],
                *command["kd"],
                *command["applied_torque"],
            ]
            timestamp = (int(event["recorder_monotonic_time_ns"]) - first_time) / 1_000_000_000
            data["observation.state"].append(state)
            data["action"].append(action)
            data["timestamp"].append(timestamp)
            data["frame_index"].append(frame_index)
            data["episode_index"].append(episode_index)
            data["index"].append(dataset_index)
            data["task_index"].append(task_index[task])
            data["capy.intervention"].append(bool(payload.get("intervention_active")))
            data["capy.safety_active"].append(bool(payload.get("safety_active")))
            data["capy.motor_fault"].append(any(code != 1 for code in measured["motor_error_code"]))
            data["capy.outcome"].append(OUTCOME_CODE[outcome])
            state_rows.append(state)
            action_rows.append(action)
            dataset_index += 1

        episode_meta["episode_index"].append(episode_index)
        episode_meta["episode_id"].append(episode_id)
        episode_meta["tasks"].append([task])
        episode_meta["length"].append(len(episode_frames))
        episode_meta["dataset_from_index"].append(start_index)
        episode_meta["dataset_to_index"].append(dataset_index)
        episode_meta["data/chunk_index"].append(0)
        episode_meta["data/file_index"].append(0)
        episode_meta["meta/episodes/chunk_index"].append(0)
        episode_meta["meta/episodes/file_index"].append(0)
        episode_meta["from_timestamp"].append(0.0)
        episode_meta["to_timestamp"].append(float(data["timestamp"][-1]))
        episode_meta["capy/outcome"].append(outcome)
        episode_meta["capy/geometry_id"].append(str(starts[episode_id]["payload"]["geometry_id"]))

    output_root.mkdir(parents=True)
    data_table = pa.table(
        {
            "observation.state": _fixed_list(data["observation.state"], state_size),
            "action": _fixed_list(data["action"], action_size),
            "timestamp": pa.array(data["timestamp"], type=pa.float32()),
            "frame_index": pa.array(data["frame_index"], type=pa.int64()),
            "episode_index": pa.array(data["episode_index"], type=pa.int64()),
            "index": pa.array(data["index"], type=pa.int64()),
            "task_index": pa.array(data["task_index"], type=pa.int64()),
            "capy.intervention": pa.array(data["capy.intervention"], type=pa.bool_()),
            "capy.safety_active": pa.array(data["capy.safety_active"], type=pa.bool_()),
            "capy.motor_fault": pa.array(data["capy.motor_fault"], type=pa.bool_()),
            "capy.outcome": pa.array(data["capy.outcome"], type=pa.int8()),
        }
    )
    _write_table(output_root / "data/chunk-000/file-000.parquet", data_table)
    _write_table(output_root / "meta/episodes/chunk-000/file-000.parquet", pa.table(episode_meta))
    _write_table(
        output_root / "meta/tasks.parquet",
        pa.table({"task_index": pa.array(range(len(tasks)), type=pa.int64()), "task": tasks}),
    )
    _write_table(
        output_root / "meta/capy_events.parquet",
        pa.Table.from_pylist(event_rows)
        if event_rows
        else pa.table(
            {
                "episode_id": pa.array([], type=pa.string()),
                "sequence": pa.array([], type=pa.int64()),
                "timestamp_ns": pa.array([], type=pa.int64()),
                "event_type": pa.array([], type=pa.string()),
                "payload_json": pa.array([], type=pa.string()),
            }
        ),
    )

    features = {
        "observation.state": _feature("float32", [state_size], state_names),
        "action": _feature("float32", [action_size], action_names),
        "timestamp": _feature("float32", [1]),
        "frame_index": _feature("int64", [1]),
        "episode_index": _feature("int64", [1]),
        "index": _feature("int64", [1]),
        "task_index": _feature("int64", [1]),
        "capy.intervention": _feature("bool", [1]),
        "capy.safety_active": _feature("bool", [1]),
        "capy.motor_fault": _feature("bool", [1]),
        "capy.outcome": _feature("int8", [1]),
    }
    info = {
        "codebase_version": "v3.0",
        "robot_type": "i2rt_camera_free",
        "fps": int(robot["target_hz"]),
        "total_episodes": len(complete_ids),
        "total_frames": dataset_index,
        "total_tasks": len(tasks),
        "splits": {"train": f"0:{len(complete_ids)}"},
        "chunks_size": 1000,
        "data_files_size_in_mb": 100,
        "video_files_size_in_mb": 500,
        "data_path": "data/chunk-{chunk_index:03d}/file-{file_index:03d}.parquet",
        "video_path": None,
        "features": features,
        "capy": {
            "source_schema": manifest["schema_version"],
            "source_session_id": manifest["session_id"],
            "camera_streams": [],
            "event_sidecar": "meta/capy_events.parquet",
            "outcome_codes": OUTCOME_CODE,
        },
    }
    (output_root / "meta/info.json").write_text(pretty_json(info), encoding="utf-8")
    (output_root / "meta/stats.json").write_text(
        pretty_json({"observation.state": _stats(state_rows), "action": _stats(action_rows)}),
        encoding="utf-8",
    )
    return output_root
