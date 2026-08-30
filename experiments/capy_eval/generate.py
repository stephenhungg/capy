from __future__ import annotations

import csv
import hashlib
import json
import random
from pathlib import Path
from typing import Any, Iterable

from . import __version__


BASE_DATA_FILES = (
    "baseline_candidates.csv",
    "capture_manifest.json",
    "collection_episodes.csv",
    "evaluation_trials.csv",
)
SYNTHETIC_SENTINEL = "SYNTHETIC_FIXTURE_DO_NOT_USE_AS_OBSERVED"


def _write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _stable_rng(seed: int, *parts: object) -> random.Random:
    material = ":".join([str(seed), *(str(part) for part in parts)])
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _declared_hash(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def write_metadata(
    config_path: Path, output_dir: Path, data_class: str
) -> dict[str, Any]:
    if data_class not in {"synthetic", "observed"}:
        raise ValueError("data_class must be synthetic or observed")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if data_class == "observed" and (output_dir / SYNTHETIC_SENTINEL).exists():
        raise ValueError(
            "synthetic fixture sentinel is present; copy genuine hardware exports into a clean directory"
        )
    required_files = BASE_DATA_FILES + ((SYNTHETIC_SENTINEL,) if data_class == "synthetic" else ())
    missing = [name for name in required_files if not (output_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(f"cannot register dataset; missing files: {missing}")
    capture_manifest = json.loads(
        (output_dir / "capture_manifest.json").read_text(encoding="utf-8")
    )
    if capture_manifest.get("data_origin") != data_class:
        raise ValueError(
            "capture_manifest data_origin must match the registered data class; "
            "synthetic fixtures cannot be relabeled as observed"
        )
    if capture_manifest.get("protocol_id") != config["protocol_id"]:
        raise ValueError("capture_manifest protocol_id does not match config")
    if capture_manifest.get("task_id") != config["task_id"]:
        raise ValueError("capture_manifest task_id does not match config")
    metadata = {
        "schema_version": 1,
        "protocol_id": config["protocol_id"],
        "task_id": config["task_id"],
        "data_class": data_class,
        "warning": (
            "pipeline fixture only; not empirical evidence"
            if data_class == "synthetic"
            else "observed data; interpret only under the registered protocol and exclusions"
        ),
        "generator_version": __version__ if data_class == "synthetic" else None,
        "seeds": config["randomization"],
        "files": {name: _sha256(output_dir / name) for name in required_files},
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return metadata


def _baseline_candidates(config: dict[str, Any]) -> list[dict[str, Any]]:
    family = config["policy"]["family"]
    return [
        {
            "policy_id": "baseline_bc_001",
            "policy_family": family,
            "validation_success": "0.42",
            "safety_event_rate": "0.020",
            "catastrophic_events": 0,
            "compute_complete": 1,
            "schema_match": 1,
            "eligible_for_selection": 1,
            "code_hash": "sha256:code-baseline-v1",
            "base_data_hash": "sha256:base-data-v1",
        },
        {
            "policy_id": "baseline_bc_002",
            "policy_family": family,
            "validation_success": "0.51",
            "safety_event_rate": "0.090",
            "catastrophic_events": 0,
            "compute_complete": 1,
            "schema_match": 1,
            "eligible_for_selection": 0,
            "code_hash": "sha256:code-baseline-v1",
            "base_data_hash": "sha256:base-data-v1",
        },
        {
            "policy_id": "baseline_bc_003",
            "policy_family": family,
            "validation_success": "0.47",
            "safety_event_rate": "0.030",
            "catastrophic_events": 0,
            "compute_complete": 1,
            "schema_match": 1,
            "eligible_for_selection": 1,
            "code_hash": "sha256:code-baseline-v1",
            "base_data_hash": "sha256:base-data-v1",
        },
    ]


def _collection_rows(config: dict[str, Any]) -> list[dict[str, Any]]:
    settings = config["collection"]
    modes = config["randomization"]["failure_modes"]
    seed = config["randomization"]["collection_seed"]
    accepted_per_cohort = settings["accepted_episodes_per_cohort"]
    attempts_per_cohort = settings["attempts_per_cohort"]
    total = attempts_per_cohort * 2
    block_size = 22
    rows: list[dict[str, Any]] = []
    cohort_counts = {"random": 0, "targeted": 0}
    for block_index in range(total // block_size):
        assignments = ["random"] * (block_size // 2) + ["targeted"] * (block_size // 2)
        rng = _stable_rng(seed, "block", block_index)
        rng.shuffle(assignments)
        operator = f"operator_{block_index % 8 + 1:02d}"
        session = f"session_{block_index + 1:02d}"
        for order, cohort in enumerate(assignments, start=1):
            cohort_counts[cohort] += 1
            number = cohort_counts[cohort]
            accepted = int(number <= accepted_per_cohort)
            row_rng = _stable_rng(seed, cohort, number)
            duration = settings["minutes_per_episode"]
            rate = settings["loaded_rate_per_minute"]
            rows.append(
                {
                    "episode_id": f"{cohort}_{number:04d}",
                    "cohort_id": cohort,
                    "operator_id": operator,
                    "session_id": session,
                    "assignment_block": f"block_{block_index + 1:02d}",
                    "assignment_order": order,
                    "failure_mode": modes[(number - 1) % len(modes)],
                    "accepted": accepted,
                    "duration_minutes": f"{duration:.3f}",
                    "loaded_rate_per_minute": f"{rate:.3f}",
                    "cost_usd": f"{duration * rate:.2f}",
                    "rights_complete": 0 if number == accepted_per_cohort else 1,
                    "randomization_seed": seed,
                    "joint_tracking_rmse_rad": f"{row_rng.uniform(0.012, 0.052):.6f}",
                    "peak_joint_effort_nm": f"{row_rng.uniform(2.8, 7.4):.6f}",
                    "gripper_effort_nm": f"{row_rng.uniform(0.3, 1.2):.6f}",
                    "command_samples": 1000,
                    "measured_state_samples": 1000,
                }
            )
    if cohort_counts != {"random": attempts_per_cohort, "targeted": attempts_per_cohort}:
        raise AssertionError("generator failed to balance cohorts")
    return rows


def _policies(config: dict[str, Any]) -> list[dict[str, Any]]:
    policies = [
        {
            "policy_id": config["policy"]["baseline_policy_id"],
            "cohort_id": "baseline",
            "training_seed": 0,
            "real_probability": 0.45,
            "sim_probability": 0.49,
            "safety_probability": 0.055,
        }
    ]
    random_real = [0.58, 0.61, 0.56]
    targeted_real = [0.75, 0.72, 0.78]
    for index, seed in enumerate(config["policy"]["training_seeds"]):
        policies.append(
            {
                "policy_id": f"random_bc_{seed}",
                "cohort_id": "random",
                "training_seed": seed,
                "real_probability": random_real[index],
                "sim_probability": random_real[index] + 0.035,
                "safety_probability": 0.010,
            }
        )
        policies.append(
            {
                "policy_id": f"targeted_bc_{seed}",
                "cohort_id": "targeted",
                "training_seed": seed,
                "real_probability": targeted_real[index],
                "sim_probability": targeted_real[index] + 0.025,
                "safety_probability": 0.008,
            }
        )
    return policies


def _evaluation_rows(config: dict[str, Any]) -> list[dict[str, Any]]:
    seed = config["randomization"]["evaluation_seed"]
    modes = config["randomization"]["failure_modes"]
    policies = _policies(config)
    mode_adjustment = {
        "nominal": 0.06,
        "lateral_offset": -0.03,
        "high_friction": -0.06,
        "compliance_edge": -0.02,
    }
    rows: list[dict[str, Any]] = []
    for domain, trial_count in (
        ("real", config["evaluation"]["real_trials_per_policy"]),
        ("sim", config["evaluation"]["sim_trials_per_policy"]),
    ):
        if trial_count % len(modes) != 0:
            raise ValueError("evaluation trial count must divide evenly across failure modes")
        condition_schedule = modes * (trial_count // len(modes))
        _stable_rng(seed, domain, "condition-order").shuffle(condition_schedule)
        for scenario_index in range(trial_count):
            mode = condition_schedule[scenario_index]
            scenario_id = f"{domain}_scenario_{scenario_index + 1:04d}"
            order = sorted(policy["policy_id"] for policy in policies)
            order_rng = _stable_rng(seed, domain, scenario_id, "order")
            order_rng.shuffle(order)
            order_by_policy = {policy_id: index + 1 for index, policy_id in enumerate(order)}
            for policy in policies:
                policy_id = policy["policy_id"]
                probability = policy[f"{domain}_probability"] + mode_adjustment[mode]
                probability = max(0.02, min(0.98, probability))
                outcome_rng = _stable_rng(seed, domain, scenario_id, policy_id, "outcome")
                safety_rng = _stable_rng(seed, domain, scenario_id, policy_id, "safety")
                success = int(outcome_rng.random() < probability)
                safety_probability = policy["safety_probability"] if domain == "real" else 0.004
                safety_event = int(safety_rng.random() < safety_probability)
                safety_component = (
                    _stable_rng(seed, domain, scenario_id, policy_id, "safety-component").choice(
                        ["protective_stop", "limit_violation", "contact_force_proxy_breach"]
                    )
                    if safety_event
                    else ""
                )
                intervention = int(
                    not success
                    and _stable_rng(seed, domain, scenario_id, policy_id, "intervention").random()
                    < 0.12
                )
                trial_seed = int.from_bytes(
                    hashlib.sha256(
                        f"{seed}:{domain}:{scenario_id}:{policy_id}".encode("utf-8")
                    ).digest()[:4],
                    "big",
                )
                rows.append(
                    {
                        "trial_id": f"{domain}_{scenario_index + 1:04d}_{policy_id}",
                        "domain": domain,
                        "split": "heldout",
                        "scenario_id": scenario_id,
                        "failure_mode": mode,
                        "condition_order": scenario_index + 1,
                        "condition_seed": seed,
                        "policy_id": policy_id,
                        "cohort_id": policy["cohort_id"],
                        "training_seed": policy["training_seed"],
                        "policy_order": order_by_policy[policy_id],
                        "success": success,
                        "safety_event": safety_event,
                        "protective_stop": int(safety_component == "protective_stop"),
                        "limit_violation": int(safety_component == "limit_violation"),
                        "contact_force_proxy_breach": int(
                            safety_component == "contact_force_proxy_breach"
                        ),
                        "catastrophic_event": 0,
                        "intervention": intervention,
                        "completion_time_s": f"{outcome_rng.uniform(8.0, 18.0) if success else outcome_rng.uniform(18.0, 30.0):.6f}",
                        "excluded": 0,
                        "exclusion_reason": "",
                        "replacement_scenario_id": "",
                        "policy_control_started": 1,
                        "incident_timestamp_ns": "",
                        "outcome_reviewer_blinded": 1,
                        "scenario_hidden_from_training": 1,
                        "trial_seed": trial_seed,
                    }
                )
    return rows


def generate_dataset(config_path: Path, output_dir: Path) -> dict[str, Any]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    files = {
        "baseline_candidates.csv": (
            [
                "policy_id",
                "policy_family",
                "validation_success",
                "safety_event_rate",
                "catastrophic_events",
                "compute_complete",
                "schema_match",
                "eligible_for_selection",
                "code_hash",
                "base_data_hash",
            ],
            _baseline_candidates(config),
        ),
        "collection_episodes.csv": (
            [
                "episode_id",
                "cohort_id",
                "operator_id",
                "session_id",
                "assignment_block",
                "assignment_order",
                "failure_mode",
                "accepted",
                "duration_minutes",
                "loaded_rate_per_minute",
                "cost_usd",
                "rights_complete",
                "randomization_seed",
                "joint_tracking_rmse_rad",
                "peak_joint_effort_nm",
                "gripper_effort_nm",
                "command_samples",
                "measured_state_samples",
            ],
            _collection_rows(config),
        ),
        "evaluation_trials.csv": (
            [
                "trial_id",
                "domain",
                "split",
                "scenario_id",
                "failure_mode",
                "condition_order",
                "condition_seed",
                "policy_id",
                "cohort_id",
                "training_seed",
                "policy_order",
                "success",
                "safety_event",
                "protective_stop",
                "limit_violation",
                "contact_force_proxy_breach",
                "catastrophic_event",
                "intervention",
                "completion_time_s",
                "excluded",
                "exclusion_reason",
                "replacement_scenario_id",
                "policy_control_started",
                "incident_timestamp_ns",
                "outcome_reviewer_blinded",
                "scenario_hidden_from_training",
                "trial_seed",
            ],
            _evaluation_rows(config),
        ),
    }
    for name, (fieldnames, rows) in files.items():
        _write_csv(output_dir / name, fieldnames, rows)
    capture_manifest = {
        "schema_version": 1,
        "protocol_id": config["protocol_id"],
        "task_id": config["task_id"],
        "data_origin": "synthetic",
        "fixture_geometry_hash": _declared_hash("synthetic-fixed-fixture-v1"),
        "calibration_hash": _declared_hash("synthetic-yam-calibration-v1"),
        "reset_procedure_hash": _declared_hash("synthetic-reset-procedure-v1"),
        "controller_hash": _declared_hash("synthetic-controller-v1"),
        "sensor_manifest": {
            "camera_stream_count": 0,
            "commanded_action_stream": True,
            "measured_signals": [
                "joint_pos",
                "joint_vel",
                "joint_eff",
                "gripper_pos",
                "gripper_vel",
                "gripper_eff"
            ]
        }
    }
    (output_dir / "capture_manifest.json").write_text(
        json.dumps(capture_manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (output_dir / SYNTHETIC_SENTINEL).write_text(
        "synthetic fixture generated by capy_eval; never register this directory as observed\n",
        encoding="utf-8",
    )
    return write_metadata(config_path, output_dir, "synthetic")
