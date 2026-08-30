from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from .stats import (
    gain_ratio_contrast_sample_size,
    interval,
    mean,
    spearman,
    wilson_interval,
)


class ValidationError(ValueError):
    """Raised when an input violates the pre-registered experiment contract."""


REQUIRED_COLUMNS = {
    "baseline_candidates.csv": {
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
    },
    "collection_episodes.csv": {
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
        "command_samples",
        "measured_state_samples",
    },
    "evaluation_trials.csv": {
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
        "completion_time_s",
        "excluded",
        "exclusion_reason",
        "replacement_scenario_id",
        "policy_control_started",
        "incident_timestamp_ns",
        "outcome_reviewer_blinded",
        "scenario_hidden_from_training",
        "trial_seed",
    },
}


REQUIRED_SIGNALS = {
    "joint_pos",
    "joint_vel",
    "joint_eff",
    "gripper_pos",
    "gripper_vel",
    "gripper_eff",
}
SYNTHETIC_SENTINEL = "SYNTHETIC_FIXTURE_DO_NOT_USE_AS_OBSERVED"
SAFETY_COMPONENTS = (
    "protective_stop",
    "limit_violation",
    "contact_force_proxy_breach",
)


def _stable_rng(seed: int, *parts: object) -> random.Random:
    material = ":".join([str(seed), *(str(part) for part in parts)])
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def _expected_trial_seed(seed: int, domain: str, scenario_id: str, policy_id: str) -> int:
    return int.from_bytes(
        hashlib.sha256(
            f"{seed}:{domain}:{scenario_id}:{policy_id}".encode("utf-8")
        ).digest()[:4],
        "big",
    )


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read_csv(data_dir: Path, name: str) -> list[dict[str, str]]:
    path = data_dir / name
    if not path.is_file():
        raise ValidationError(f"missing required input: {path}")
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS[name] - columns
        if missing:
            raise ValidationError(f"{name} missing columns: {sorted(missing)}")
        return list(reader)


def _int(row: dict[str, str], key: str) -> int:
    try:
        return int(row[key])
    except (KeyError, ValueError) as error:
        raise ValidationError(f"invalid integer in {key}: {row.get(key)!r}") from error


def _float(row: dict[str, str], key: str) -> float:
    try:
        return float(row[key])
    except (KeyError, ValueError) as error:
        raise ValidationError(f"invalid number in {key}: {row.get(key)!r}") from error


def _load_and_verify(
    data_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, list[dict[str, str]]]]:
    metadata_path = data_dir / "metadata.json"
    if not metadata_path.is_file():
        raise ValidationError(f"missing required input: {metadata_path}")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("data_class") not in {"synthetic", "observed"}:
        raise ValidationError("metadata data_class must be synthetic or observed")
    sentinel_path = data_dir / SYNTHETIC_SENTINEL
    if metadata["data_class"] == "synthetic":
        expected_sentinel_hash = metadata.get("files", {}).get(SYNTHETIC_SENTINEL)
        actual_sentinel_hash = _sha256(sentinel_path) if sentinel_path.is_file() else None
        if expected_sentinel_hash != actual_sentinel_hash:
            raise ValidationError("synthetic dataset lacks its immutable fixture sentinel")
    elif sentinel_path.exists():
        raise ValidationError("observed dataset contains the synthetic fixture sentinel")
    capture_path = data_dir / "capture_manifest.json"
    expected_capture_hash = metadata.get("files", {}).get("capture_manifest.json")
    actual_capture_hash = _sha256(capture_path) if capture_path.is_file() else None
    if expected_capture_hash != actual_capture_hash:
        raise ValidationError(
            "hash mismatch for capture_manifest.json: "
            f"metadata={expected_capture_hash}, actual={actual_capture_hash}"
        )
    capture = json.loads(capture_path.read_text(encoding="utf-8"))
    if capture.get("data_origin") != metadata["data_class"]:
        raise ValidationError(
            "capture_manifest data_origin does not match metadata; synthetic fixtures "
            "cannot be relabeled as observed"
        )
    sensor_manifest = capture.get("sensor_manifest", {})
    if sensor_manifest.get("camera_stream_count") != 0:
        raise ValidationError("camera-free protocol forbids camera streams")
    if sensor_manifest.get("commanded_action_stream") is not True:
        raise ValidationError("capture manifest lacks a commanded-action stream")
    if not REQUIRED_SIGNALS.issubset(set(sensor_manifest.get("measured_signals", []))):
        raise ValidationError("capture manifest lacks required measured proprioceptive signals")
    for key in (
        "fixture_geometry_hash",
        "calibration_hash",
        "reset_procedure_hash",
        "controller_hash",
    ):
        value = str(capture.get(key, ""))
        digest = value.removeprefix("sha256:")
        if (
            not value.startswith("sha256:")
            or len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
        ):
            raise ValidationError(f"capture manifest lacks a versioned {key}")
    rows: dict[str, list[dict[str, str]]] = {}
    for name in REQUIRED_COLUMNS:
        expected_hash = metadata.get("files", {}).get(name)
        actual_hash = _sha256(data_dir / name) if (data_dir / name).is_file() else None
        if expected_hash != actual_hash:
            raise ValidationError(
                f"hash mismatch for {name}: metadata={expected_hash}, actual={actual_hash}"
            )
        rows[name] = _read_csv(data_dir, name)
    return metadata, capture, rows


def _select_baseline(config: dict[str, Any], rows: list[dict[str, str]]) -> dict[str, Any]:
    policy = config["policy"]
    eligible: list[dict[str, str]] = []
    for row in rows:
        computed_eligible = (
            row["policy_family"] == policy["family"]
            and _int(row, "catastrophic_events") == 0
            and _int(row, "compute_complete") == 1
            and _int(row, "schema_match") == 1
            and _float(row, "safety_event_rate")
            <= policy["visible_validation_safety_ceiling"]
        )
        if computed_eligible != bool(_int(row, "eligible_for_selection")):
            raise ValidationError(
                f"baseline eligibility flag disagrees with frozen rule: {row['policy_id']}"
            )
        if computed_eligible:
            eligible.append(row)
    if not eligible:
        raise ValidationError("no baseline candidate satisfies the frozen eligibility rule")
    eligible.sort(key=lambda row: (-_float(row, "validation_success"), row["policy_id"]))
    selected = eligible[0]
    if selected["policy_id"] != policy["baseline_policy_id"]:
        raise ValidationError(
            "configured baseline does not match the frozen selection rule: "
            f"expected {selected['policy_id']}, got {policy['baseline_policy_id']}"
        )
    return {
        "selected_policy_id": selected["policy_id"],
        "eligible_candidate_count": len(eligible),
        "visible_validation_success": _float(selected, "validation_success"),
        "visible_validation_safety_event_rate": _float(selected, "safety_event_rate"),
        "code_hash": selected["code_hash"],
        "base_data_hash": selected["base_data_hash"],
        "selection_rule": "highest eligible validation success; policy-id tie break",
    }


def _collection_summary(
    config: dict[str, Any], rows: list[dict[str, str]]
) -> dict[str, Any]:
    cohorts = config["collection"]["cohorts"]
    expected_seed = config["randomization"]["collection_seed"]
    expected_modes = set(config["randomization"]["failure_modes"])
    by_cohort: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_block: dict[str, list[dict[str, str]]] = defaultdict(list)
    episode_ids: set[str] = set()
    for row in rows:
        if row["episode_id"] in episode_ids:
            raise ValidationError(f"duplicate collection episode: {row['episode_id']}")
        episode_ids.add(row["episode_id"])
        if row["cohort_id"] not in cohorts:
            raise ValidationError(f"unexpected collection cohort: {row['cohort_id']}")
        if _int(row, "randomization_seed") != expected_seed:
            raise ValidationError("collection row uses an unregistered randomization seed")
        if row["failure_mode"] not in expected_modes:
            raise ValidationError(f"unexpected failure mode: {row['failure_mode']}")
        if _int(row, "accepted") not in {0, 1} or _int(row, "rights_complete") not in {0, 1}:
            raise ValidationError("accepted and rights_complete must be binary")
        if _int(row, "accepted") == 1 and (
            _int(row, "command_samples") <= 0
            or _int(row, "measured_state_samples") <= 0
        ):
            raise ValidationError("accepted episode lacks command or measured-state samples")
        expected_cost = _float(row, "duration_minutes") * _float(
            row, "loaded_rate_per_minute"
        )
        if abs(expected_cost - _float(row, "cost_usd")) > 0.005:
            raise ValidationError(f"episode cost does not reconcile: {row['episode_id']}")
        by_cohort[row["cohort_id"]].append(row)
        by_block[row["assignment_block"]].append(row)
    expected_attempts = config["collection"]["attempts_per_cohort"]
    expected_accepted = config["collection"]["accepted_episodes_per_cohort"]
    summaries: dict[str, Any] = {}
    for cohort in cohorts:
        cohort_rows = by_cohort[cohort]
        accepted_rows = [row for row in cohort_rows if _int(row, "accepted") == 1]
        if len(cohort_rows) != expected_attempts:
            raise ValidationError(
                f"{cohort} has {len(cohort_rows)} attempts, expected {expected_attempts}"
            )
        if len(accepted_rows) != expected_accepted:
            raise ValidationError(
                f"{cohort} has {len(accepted_rows)} accepted episodes, expected {expected_accepted}"
            )
        attempt_mode_counts = {
            mode: sum(row["failure_mode"] == mode for row in cohort_rows)
            for mode in expected_modes
        }
        accepted_mode_counts = {
            mode: sum(row["failure_mode"] == mode for row in accepted_rows)
            for mode in expected_modes
        }
        if len(set(attempt_mode_counts.values())) != 1 or len(
            set(accepted_mode_counts.values())
        ) != 1:
            raise ValidationError(f"{cohort} is not balanced across registered failure modes")
        summaries[cohort] = {
            "attempted_episodes": len(cohort_rows),
            "accepted_episodes": len(accepted_rows),
            "rejected_or_aborted_episodes": len(cohort_rows) - len(accepted_rows),
            "operator_minutes": sum(_float(row, "duration_minutes") for row in cohort_rows),
            "cost_usd": sum(_float(row, "cost_usd") for row in cohort_rows),
            "rights_complete_fraction": mean(
                _int(row, "rights_complete") for row in accepted_rows
            ),
            "attempts_by_failure_mode": dict(sorted(attempt_mode_counts.items())),
            "accepted_by_failure_mode": dict(sorted(accepted_mode_counts.items())),
        }
    for block_index, block in enumerate(sorted(by_block)):
        block_rows = by_block[block]
        orders = sorted(_int(row, "assignment_order") for row in block_rows)
        if orders != list(range(1, len(block_rows) + 1)):
            raise ValidationError(f"collection assignment order is not a permutation: {block}")
        counts = {cohort: sum(row["cohort_id"] == cohort for row in block_rows) for cohort in cohorts}
        if len(set(counts.values())) != 1:
            raise ValidationError(f"collection assignment block is imbalanced: {block}")
        if len({row["operator_id"] for row in block_rows}) != 1 or len(
            {row["session_id"] for row in block_rows}
        ) != 1:
            raise ValidationError(f"collection block crosses operator or session: {block}")
        expected_assignments = [
            cohort for cohort in cohorts for _ in range(counts[cohort])
        ]
        _stable_rng(expected_seed, "block", block_index).shuffle(expected_assignments)
        observed_assignments = [
            row["cohort_id"]
            for row in sorted(block_rows, key=lambda item: _int(item, "assignment_order"))
        ]
        if observed_assignments != expected_assignments:
            raise ValidationError(f"collection assignments do not match the fixed seed: {block}")
    costs = [summaries[cohort]["cost_usd"] for cohort in cohorts]
    imbalance = abs(costs[0] - costs[1]) / max(costs)
    allowed = config["collection"]["allowed_cost_imbalance_fraction"]
    if imbalance > allowed:
        raise ValidationError(
            f"collection cost imbalance {imbalance:.6f} exceeds registered {allowed:.6f}"
        )
    return {
        "cohorts": summaries,
        "assignment_blocks": len(by_block),
        "cost_imbalance_fraction": imbalance,
        "allowed_cost_imbalance_fraction": allowed,
        "equal_cost_valid": True,
    }


def _validate_evaluation(
    config: dict[str, Any], rows: list[dict[str, str]]
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    baseline = config["policy"]["baseline_policy_id"]
    seeds = set(config["policy"]["training_seeds"])
    policy_meta: dict[str, tuple[str, int]] = {}
    trial_ids: set[str] = set()
    registered_modes = set(config["randomization"]["failure_modes"])
    evaluation_seed = config["randomization"]["evaluation_seed"]
    for row in rows:
        if row["trial_id"] in trial_ids:
            raise ValidationError(f"duplicate evaluation trial: {row['trial_id']}")
        trial_ids.add(row["trial_id"])
        if row["split"] != "heldout" or row["domain"] not in {"real", "sim"}:
            raise ValidationError("evaluation table may contain only heldout real/sim trials")
        if row["failure_mode"] not in registered_modes:
            raise ValidationError(f"unregistered evaluation failure mode: {row['failure_mode']}")
        if _int(row, "condition_seed") != evaluation_seed:
            raise ValidationError("evaluation condition uses an unregistered seed")
        policy_id = row["policy_id"]
        meta = (row["cohort_id"], _int(row, "training_seed"))
        if policy_id in policy_meta and policy_meta[policy_id] != meta:
            raise ValidationError(f"policy metadata changes across trials: {policy_id}")
        policy_meta[policy_id] = meta
        if policy_id == baseline:
            if meta != ("baseline", 0):
                raise ValidationError("baseline evaluation metadata is invalid")
        elif meta[0] not in config["collection"]["cohorts"] or meta[1] not in seeds:
            raise ValidationError(f"candidate uses unregistered cohort or seed: {policy_id}")
        for binary in (
            "success",
            "safety_event",
            "protective_stop",
            "limit_violation",
            "contact_force_proxy_breach",
            "catastrophic_event",
            "policy_control_started",
            "outcome_reviewer_blinded",
            "scenario_hidden_from_training",
        ):
            if _int(row, binary) not in {0, 1}:
                raise ValidationError(f"{binary} is not binary")
        component_event = int(
            any(
                _int(row, field)
                for field in SAFETY_COMPONENTS
            )
        )
        if _int(row, "safety_event") != component_event:
            raise ValidationError(f"aggregate safety event disagrees with components: {row['trial_id']}")
        if _int(row, "excluded") not in {0, 1}:
            raise ValidationError("excluded is not binary")
    expected_meta = {("baseline", 0)} | {
        (cohort, seed)
        for cohort in config["collection"]["cohorts"]
        for seed in seeds
    }
    if len(policy_meta) != len(expected_meta) or set(policy_meta.values()) != expected_meta:
        raise ValidationError(
            "evaluation policies do not cover the exact registered cohort-by-seed grid"
        )
    expected_policy_ids = set(policy_meta)
    expected_policies = len(expected_policy_ids)
    allowed_exclusions = set(
        config["evaluation"]["allowed_infrastructure_exclusion_reasons"]
    )
    included_by_domain: dict[str, list[dict[str, str]]] = {}
    for domain, expected_trials in (
        ("real", config["evaluation"]["real_trials_per_policy"]),
        ("sim", config["evaluation"]["sim_trials_per_policy"]),
    ):
        domain_rows = [row for row in rows if row["domain"] == domain]
        by_policy: dict[str, int] = defaultdict(int)
        by_scenario: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in domain_rows:
            by_scenario[row["scenario_id"]].append(row)
            if _int(row, "scenario_hidden_from_training") != 1:
                raise ValidationError(f"held-out scenario leaked in {row['trial_id']}")
            if domain == "real" and _int(row, "outcome_reviewer_blinded") != 1:
                raise ValidationError(f"real outcome was not blinded in {row['trial_id']}")
        excluded_replacements: set[str] = set()
        for scenario_id, scenario_rows in by_scenario.items():
            if len(scenario_rows) != expected_policies or {
                row["policy_id"] for row in scenario_rows
            } != expected_policy_ids:
                raise ValidationError(
                    f"scenario does not contain the full unique policy set: {scenario_id}"
                )
            if len({row["failure_mode"] for row in scenario_rows}) != 1:
                raise ValidationError(f"scenario mixes failure modes: {scenario_id}")
            condition_orders = {_int(row, "condition_order") for row in scenario_rows}
            if len(condition_orders) != 1:
                raise ValidationError(f"scenario mixes condition order: {scenario_id}")
            excluded_values = {_int(row, "excluded") for row in scenario_rows}
            if len(excluded_values) != 1:
                raise ValidationError(f"scenario is only partially excluded: {scenario_id}")
            excluded = excluded_values.pop() == 1
            reasons = {row["exclusion_reason"] for row in scenario_rows}
            replacements = {row["replacement_scenario_id"] for row in scenario_rows}
            if excluded:
                if len(reasons) != 1 or next(iter(reasons)) not in allowed_exclusions:
                    raise ValidationError(f"invalid infrastructure exclusion: {scenario_id}")
                if len(replacements) != 1 or not next(iter(replacements)):
                    raise ValidationError(f"excluded scenario lacks one replacement: {scenario_id}")
                replacement = next(iter(replacements))
                if replacement in excluded_replacements:
                    raise ValidationError(f"replacement scenario reused: {replacement}")
                excluded_replacements.add(replacement)
                if {_int(row, "policy_control_started") for row in scenario_rows} != {0}:
                    raise ValidationError(f"excluded scenario started policy control: {scenario_id}")
                incident_timestamps = {row["incident_timestamp_ns"] for row in scenario_rows}
                if len(incident_timestamps) != 1:
                    raise ValidationError(f"excluded scenario has inconsistent incident time: {scenario_id}")
                try:
                    if int(next(iter(incident_timestamps))) <= 0:
                        raise ValueError
                except ValueError as error:
                    raise ValidationError(
                        f"excluded scenario lacks a pre-control incident timestamp: {scenario_id}"
                    ) from error
                forbidden_post_control_fields = (
                    "success",
                    "intervention",
                    "safety_event",
                    "protective_stop",
                    "limit_violation",
                    "contact_force_proxy_breach",
                    "catastrophic_event",
                )
                if any(
                    _int(row, field) != 0
                    for row in scenario_rows
                    for field in forbidden_post_control_fields
                ) or any(_float(row, "completion_time_s") != 0 for row in scenario_rows):
                    raise ValidationError(
                        f"pre-control exclusion contains post-control outcomes: {scenario_id}"
                    )
            else:
                if reasons != {""} or replacements != {""}:
                    raise ValidationError(
                        f"included scenario carries exclusion metadata: {scenario_id}"
                    )
                if {_int(row, "policy_control_started") for row in scenario_rows} != {1}:
                    raise ValidationError(f"included scenario never started control: {scenario_id}")
                if {row["incident_timestamp_ns"] for row in scenario_rows} != {""}:
                    raise ValidationError(f"included scenario carries incident time: {scenario_id}")
                if any(_float(row, "completion_time_s") <= 0 for row in scenario_rows):
                    raise ValidationError(f"included scenario lacks completion time: {scenario_id}")
            expected_order = sorted(expected_policy_ids)
            _stable_rng(evaluation_seed, domain, scenario_id, "order").shuffle(expected_order)
            observed_order = [
                row["policy_id"]
                for row in sorted(scenario_rows, key=lambda item: _int(item, "policy_order"))
            ]
            if observed_order != expected_order:
                raise ValidationError(f"policy order does not match the fixed seed: {scenario_id}")
            for row in scenario_rows:
                expected_trial_seed = _expected_trial_seed(
                    evaluation_seed, domain, scenario_id, row["policy_id"]
                )
                if _int(row, "trial_seed") != expected_trial_seed:
                    raise ValidationError(f"trial seed mismatch: {row['trial_id']}")
                if not excluded:
                    by_policy[row["policy_id"]] += 1
        for scenario_id, scenario_rows in by_scenario.items():
            if _int(scenario_rows[0], "excluded") == 0:
                continue
            replacement = scenario_rows[0]["replacement_scenario_id"]
            replacement_rows = by_scenario.get(replacement)
            if not replacement_rows or _int(replacement_rows[0], "excluded") != 0:
                raise ValidationError(f"replacement is missing or excluded: {replacement}")
            if replacement_rows[0]["failure_mode"] != scenario_rows[0]["failure_mode"]:
                raise ValidationError(f"replacement changes failure stratum: {replacement}")
            if _int(replacement_rows[0], "condition_order") != _int(
                scenario_rows[0], "condition_order"
            ):
                raise ValidationError(f"replacement changes condition order: {replacement}")
        if expected_trials % len(registered_modes) != 0:
            raise ValidationError("trial count cannot be balanced across registered modes")
        expected_conditions = list(config["randomization"]["failure_modes"]) * (
            expected_trials // len(registered_modes)
        )
        _stable_rng(evaluation_seed, domain, "condition-order").shuffle(
            expected_conditions
        )
        included_scenarios = [
            scenario_rows
            for scenario_rows in by_scenario.values()
            if _int(scenario_rows[0], "excluded") == 0
        ]
        condition_by_order = {
            _int(scenario_rows[0], "condition_order"): scenario_rows[0]["failure_mode"]
            for scenario_rows in included_scenarios
        }
        if len(condition_by_order) != expected_trials or set(condition_by_order) != set(
            range(1, expected_trials + 1)
        ):
            raise ValidationError(f"{domain} condition order is incomplete or duplicated")
        if [condition_by_order[index] for index in range(1, expected_trials + 1)] != expected_conditions:
            raise ValidationError(f"{domain} conditions do not match the sealed seeded schedule")
        if set(by_policy) != expected_policy_ids or set(by_policy.values()) != {expected_trials}:
            raise ValidationError(
                f"{domain} included trial counts per policy do not all equal {expected_trials}"
            )
        included_by_domain[domain] = [
            row for row in domain_rows if _int(row, "excluded") == 0
        ]
    return included_by_domain["real"], included_by_domain["sim"]


def _policy_rates(rows: Iterable[dict[str, str]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["policy_id"]].append(row)
    result: dict[str, dict[str, Any]] = {}
    for policy_id, policy_rows in sorted(grouped.items()):
        successes = sum(_int(row, "success") for row in policy_rows)
        result[policy_id] = {
            "cohort_id": policy_rows[0]["cohort_id"],
            "training_seed": _int(policy_rows[0], "training_seed"),
            "successes": successes,
            "trials": len(policy_rows),
            "success_rate": successes / len(policy_rows),
            "success_rate_wilson_95": list(wilson_interval(successes, len(policy_rows))),
        }
    return result


def _bootstrap_sim_real_rank(
    config: dict[str, Any],
    real_rows: list[dict[str, str]],
    simulation_rows: list[dict[str, str]],
) -> dict[str, Any]:
    grouped: dict[str, dict[str, list[dict[str, str]]]] = {
        "real": defaultdict(list),
        "sim": defaultdict(list),
    }
    strata: dict[str, dict[str, list[str]]] = {
        "real": defaultdict(list),
        "sim": defaultdict(list),
    }
    for domain, rows in (("real", real_rows), ("sim", simulation_rows)):
        for row in rows:
            grouped[domain][row["scenario_id"]].append(row)
        for scenario_id, scenario_rows in grouped[domain].items():
            strata[domain][scenario_rows[0]["failure_mode"]].append(scenario_id)
    policy_ids = sorted({row["policy_id"] for row in real_rows})
    rng = _stable_rng(config["randomization"]["bootstrap_seed"], "sim-real-rank")
    correlations: list[float] = []
    for _ in range(config["evaluation"]["bootstrap_replicates"]):
        sampled_rates: dict[str, list[float]] = {"real": [], "sim": []}
        for domain in ("real", "sim"):
            sampled_rows: list[dict[str, str]] = []
            for mode in sorted(strata[domain]):
                scenario_ids = strata[domain][mode]
                for _ in scenario_ids:
                    sampled_rows.extend(grouped[domain][rng.choice(scenario_ids)])
            sampled_rates[domain] = [
                mean(
                    _int(row, "success")
                    for row in sampled_rows
                    if row["policy_id"] == policy_id
                )
                for policy_id in policy_ids
            ]
        try:
            correlations.append(
                spearman(sampled_rates["sim"], sampled_rates["real"])
            )
        except ValueError:
            continue
    if len(correlations) < config["evaluation"]["bootstrap_replicates"] * 0.95:
        raise ValidationError("too many undefined sim-to-real rank bootstrap replicates")
    return {
        "spearman_policy_rank_95": list(interval(correlations)),
        "bootstrap_replicates_valid": len(correlations),
        "bootstrap_unit": "failure-mode-stratified full scenario blocks within each domain",
        "warning": "only seven related policies; between-cohort separation may dominate rank correlation",
    }


def _scenario_blocks(
    rows: list[dict[str, str]], baseline_policy_id: str
) -> tuple[dict[str, dict[str, Any]], dict[str, list[str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["scenario_id"]].append(row)
    blocks: dict[str, dict[str, Any]] = {}
    strata: dict[str, list[str]] = defaultdict(list)
    for scenario_id, scenario_rows in grouped.items():
        baseline_rows = [row for row in scenario_rows if row["policy_id"] == baseline_policy_id]
        if len(baseline_rows) != 1:
            raise ValidationError(f"scenario lacks exactly one baseline row: {scenario_id}")
        block: dict[str, Any] = {
            "mode": scenario_rows[0]["failure_mode"],
            "baseline_success": _int(baseline_rows[0], "success"),
            "baseline_safety": _int(baseline_rows[0], "safety_event"),
        }
        for component in SAFETY_COMPONENTS:
            block[f"baseline_{component}"] = _int(baseline_rows[0], component)
        for cohort in ("random", "targeted"):
            cohort_rows = [row for row in scenario_rows if row["cohort_id"] == cohort]
            if not cohort_rows:
                raise ValidationError(f"scenario lacks {cohort} candidates: {scenario_id}")
            block[f"{cohort}_success"] = mean(_int(row, "success") for row in cohort_rows)
            block[f"{cohort}_success_by_seed"] = {
                _int(row, "training_seed"): _int(row, "success") for row in cohort_rows
            }
            block[f"{cohort}_safety"] = mean(
                _int(row, "safety_event") for row in cohort_rows
            )
            block[f"{cohort}_catastrophic"] = sum(
                _int(row, "catastrophic_event") for row in cohort_rows
            )
            for component in SAFETY_COMPONENTS:
                block[f"{cohort}_{component}"] = mean(
                    _int(row, component) for row in cohort_rows
                )
        blocks[scenario_id] = block
        strata[block["mode"]].append(scenario_id)
    return blocks, strata


def _bootstrap_primary(
    config: dict[str, Any],
    blocks: dict[str, dict[str, Any]],
    strata: dict[str, list[str]],
    costs: dict[str, float],
) -> dict[str, Any]:
    rng = random.Random(config["randomization"]["bootstrap_seed"])
    replicates = config["evaluation"]["bootstrap_replicates"]
    ratio_threshold = next(
        threshold["value"]
        for threshold in config["thresholds"]
        if threshold["id"] == "targeted_cost_efficiency"
    )
    values = {"random_gain": [], "targeted_gain": [], "threshold_contrast": []}
    nonpositive_random_gain = 0
    for _ in range(replicates):
        sampled: list[dict[str, Any]] = []
        for mode in sorted(strata):
            scenario_ids = strata[mode]
            sampled.extend(blocks[rng.choice(scenario_ids)] for _ in scenario_ids)
        baseline_rate = mean(block["baseline_success"] for block in sampled)
        random_gain = mean(block["random_success"] for block in sampled) - baseline_rate
        targeted_gain = mean(block["targeted_success"] for block in sampled) - baseline_rate
        values["random_gain"].append(random_gain)
        values["targeted_gain"].append(targeted_gain)
        nonpositive_random_gain += int(random_gain <= 0)
        values["threshold_contrast"].append(
            targeted_gain / costs["targeted"]
            - ratio_threshold * random_gain / costs["random"]
        )
    baseline_rate = mean(block["baseline_success"] for block in blocks.values())
    random_gain = mean(block["random_success"] for block in blocks.values()) - baseline_rate
    targeted_gain = mean(block["targeted_success"] for block in blocks.values()) - baseline_rate
    if random_gain <= 0:
        raise ValidationError("primary point ratio is undefined because random gain is non-positive")
    point_ratio = (targeted_gain / costs["targeted"]) / (random_gain / costs["random"])
    return {
        "baseline_success_rate": baseline_rate,
        "random_absolute_gain": random_gain,
        "random_gain_95": list(interval(values["random_gain"])),
        "targeted_absolute_gain": targeted_gain,
        "targeted_gain_95": list(interval(values["targeted_gain"])),
        "random_gain_per_dollar": random_gain / costs["random"],
        "targeted_gain_per_dollar": targeted_gain / costs["targeted"],
        "targeted_to_random_gain_per_dollar_ratio": point_ratio,
        "ratio_95": None,
        "ratio_interval_reason": "not reported: ratios are singular when bootstrap random gain approaches or crosses zero",
        "random_gain_nonpositive_bootstrap_fraction": nonpositive_random_gain / replicates,
        "gain_per_dollar_threshold_contrast": targeted_gain / costs["targeted"]
        - ratio_threshold * random_gain / costs["random"],
        "gain_per_dollar_threshold_contrast_95": list(
            interval(values["threshold_contrast"])
        ),
        "probability_threshold_contrast_positive": mean(
            value > 0 for value in values["threshold_contrast"]
        ),
        "bootstrap_replicates_requested": replicates,
        "bootstrap_unit": "failure-mode-stratified held-out scenario block",
    }


def _safety_summary(
    config: dict[str, Any],
    blocks: dict[str, dict[str, Any]],
    strata: dict[str, list[str]],
) -> dict[str, Any]:
    rng = random.Random(config["randomization"]["bootstrap_seed"] + 1)
    replicates = config["evaluation"]["bootstrap_replicates"]
    margin = next(
        threshold["value"]
        for threshold in config["thresholds"]
        if threshold["id"] == "safety_noninferiority"
    )
    result: dict[str, Any] = {}
    for cohort in ("random", "targeted"):
        differences: list[float] = []
        for _ in range(replicates):
            sampled: list[dict[str, Any]] = []
            for mode in sorted(strata):
                scenario_ids = strata[mode]
                sampled.extend(blocks[rng.choice(scenario_ids)] for _ in scenario_ids)
            differences.append(
                mean(block[f"{cohort}_safety"] for block in sampled)
                - mean(block["baseline_safety"] for block in sampled)
            )
        point = mean(block[f"{cohort}_safety"] for block in blocks.values()) - mean(
            block["baseline_safety"] for block in blocks.values()
        )
        confidence = interval(differences)
        catastrophic = sum(block[f"{cohort}_catastrophic"] for block in blocks.values())
        result[cohort] = {
            "risk_difference_vs_baseline": point,
            "risk_difference_95": list(confidence),
            "noninferiority_margin": margin,
            "catastrophic_event_count": catastrophic,
            "component_event_rates": {
                component: {
                    "baseline": mean(
                        block[f"baseline_{component}"] for block in blocks.values()
                    ),
                    "candidate": mean(
                        block[f"{cohort}_{component}"] for block in blocks.values()
                    ),
                }
                for component in SAFETY_COMPONENTS
            },
            "passes_guardrail": confidence[1] <= margin and catastrophic == 0,
        }
    return result


def _attribution_summary(
    config: dict[str, Any],
    blocks: dict[str, dict[str, Any]],
    strata: dict[str, list[str]],
) -> dict[str, Any]:
    by_replicate: dict[str, dict[str, float]] = {}
    by_cohort: dict[str, list[float]] = defaultdict(list)
    replicates = config["evaluation"]["bootstrap_replicates"]
    for training_seed in config["policy"]["training_seeds"]:
        rng = _stable_rng(
            config["randomization"]["bootstrap_seed"], "attribution", training_seed
        )
        for bootstrap_id in range(replicates):
            sampled: list[dict[str, Any]] = []
            for mode in sorted(strata):
                scenario_ids = strata[mode]
                sampled.extend(blocks[rng.choice(scenario_ids)] for _ in scenario_ids)
            baseline_rate = mean(block["baseline_success"] for block in sampled)
            replicate_id = f"seed_{training_seed}_bootstrap_{bootstrap_id:04d}"
            scores = {
                cohort: mean(
                    block[f"{cohort}_success_by_seed"][training_seed]
                    for block in sampled
                )
                - baseline_rate
                for cohort in config["collection"]["cohorts"]
            }
            by_replicate[replicate_id] = scores
            for cohort, score in scores.items():
                by_cohort[cohort].append(score)
    consensus = sorted(by_cohort, key=lambda cohort: (-mean(by_cohort[cohort]), cohort))
    stable = 0
    top_counts = defaultdict(int)
    for replicate, scores in by_replicate.items():
        ordering = sorted(scores, key=lambda cohort: (-scores[cohort], cohort))
        stable += int(ordering == consensus)
        top_counts[ordering[0]] += 1
    count = len(by_replicate)
    return {
        "replicates": count,
        "bootstrap_replicates_per_training_seed": replicates,
        "training_seeds": config["policy"]["training_seeds"],
        "consensus_order": consensus,
        "bootstrap_consensus_rank_stability": stable / count,
        "cohorts": {
            cohort: {
                "mean_marginal_gain": mean(values),
                "marginal_gain_95": list(interval(values)),
                "probability_ranked_first": top_counts[cohort] / count,
            }
            for cohort, values in sorted(by_cohort.items())
        },
        "lineage": "recomputed from held-out real scenario blocks for every registered training seed",
        "interpretation": "cohort payout-sensitivity diagnostic; not exact per-episode causality",
    }


def _fixture_status(passed: bool, data_class: str) -> str:
    if data_class == "synthetic":
        return "synthetic_fixture_pass" if passed else "synthetic_fixture_fail"
    return "pass" if passed else "fail"


def analyze_dataset(config_path: Path, data_dir: Path) -> dict[str, Any]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    metadata, capture, tables = _load_and_verify(data_dir)
    if metadata.get("protocol_id") != config["protocol_id"]:
        raise ValidationError("metadata protocol does not match experiment config")
    if metadata.get("task_id") != config["task_id"]:
        raise ValidationError("metadata task does not match experiment config")
    if capture.get("protocol_id") != config["protocol_id"] or capture.get(
        "task_id"
    ) != config["task_id"]:
        raise ValidationError("capture manifest does not match the protocol and task")
    baseline = _select_baseline(config, tables["baseline_candidates.csv"])
    collection = _collection_summary(config, tables["collection_episodes.csv"])
    real, simulation = _validate_evaluation(config, tables["evaluation_trials.csv"])
    real_policy_rates = _policy_rates(real)
    sim_policy_rates = _policy_rates(simulation)
    if set(real_policy_rates) != set(sim_policy_rates):
        raise ValidationError("real and simulation policy sets differ")
    policy_ids = sorted(real_policy_rates)
    rank_correlation = spearman(
        [sim_policy_rates[policy_id]["success_rate"] for policy_id in policy_ids],
        [real_policy_rates[policy_id]["success_rate"] for policy_id in policy_ids],
    )
    rank_uncertainty = _bootstrap_sim_real_rank(config, real, simulation)
    blocks, strata = _scenario_blocks(real, baseline["selected_policy_id"])
    costs = {
        cohort: collection["cohorts"][cohort]["cost_usd"]
        for cohort in config["collection"]["cohorts"]
    }
    primary = _bootstrap_primary(config, blocks, strata, costs)
    safety = _safety_summary(config, blocks, strata)
    attribution = _attribution_summary(config, blocks, strata)
    power_config = config["power"]
    powered_n = gain_ratio_contrast_sample_size(
        power_config["baseline_success"],
        power_config["random_success_under_alternative"],
        power_config["targeted_success_under_alternative"],
        power_config["targeted_to_random_gain_ratio_null"],
        power_config["one_sided_alpha"],
        power_config["desired_power"],
    )
    actual_n = config["evaluation"]["real_trials_per_policy"]
    threshold_by_id = {threshold["id"]: threshold for threshold in config["thresholds"]}
    ratio_threshold = threshold_by_id["targeted_cost_efficiency"]["value"]
    sim_threshold = threshold_by_id["sim_real_rank"]["value"]
    attribution_threshold = threshold_by_id["attribution_rank_stability"]["value"]
    safety_pass = all(summary["passes_guardrail"] for summary in safety.values())
    first_task_signal = (
        "provisional_pass"
        if primary["targeted_to_random_gain_per_dollar_ratio"] >= ratio_threshold
        and primary["random_absolute_gain"] > 0
        and primary["targeted_absolute_gain"] > 0
        and collection["equal_cost_valid"]
        and actual_n >= powered_n
        and safety_pass
        else "provisional_fail"
    )
    overall_decision = (
        "synthetic_fixture_only" if metadata["data_class"] == "synthetic" else first_task_signal
    )
    rights_fraction = mean(
        summary["rights_complete_fraction"]
        for summary in collection["cohorts"].values()
    )
    decisions = []
    for threshold in config["thresholds"]:
        threshold_id = threshold["id"]
        evidence: dict[str, Any] = {}
        if threshold_id == "targeted_cost_efficiency":
            status = "not_evaluated"
            evidence = {
                "reason": "criterion requires three tasks; this report contains one",
                "first_task_signal": first_task_signal,
                "first_task_ratio": primary[
                    "targeted_to_random_gain_per_dollar_ratio"
                ],
                "tasks_completed": 1,
                "tasks_required": 3,
            }
        elif threshold_id == "sim_real_rank":
            passed = rank_correlation >= sim_threshold
            status = _fixture_status(passed, metadata["data_class"])
            evidence = {"observed": rank_correlation}
        elif threshold_id == "attribution_rank_stability":
            observed = attribution["bootstrap_consensus_rank_stability"]
            status = _fixture_status(observed >= attribution_threshold, metadata["data_class"])
            evidence = {"observed": observed}
        elif threshold_id == "rights_completeness":
            status = "not_evaluated"
            evidence = {
                "observed_rights_complete_fraction": rights_fraction,
                "reason": "the full criterion also requires public-network supply economics, which this experiment does not measure",
            }
        elif threshold_id in {"world_context_lift", "paid_repeat"}:
            status = "not_evaluated"
            evidence = {"reason": "metric is outside this experiment's data contract"}
        elif threshold_id == "safety_noninferiority":
            status = _fixture_status(safety_pass, metadata["data_class"])
            evidence = {
                cohort: summary["risk_difference_95"][1]
                for cohort, summary in safety.items()
            }
        elif threshold_id == "catastrophic_safety":
            total = sum(summary["catastrophic_event_count"] for summary in safety.values())
            status = _fixture_status(total == 0, metadata["data_class"])
            evidence = {"observed": total}
        else:
            raise ValidationError(f"unhandled decision threshold: {threshold_id}")
        decisions.append({**threshold, "status": status, "evidence": evidence})
    return {
        "schema_version": 1,
        "protocol_id": config["protocol_id"],
        "task_id": config["task_id"],
        "data_class": metadata["data_class"],
        "data_warning": metadata.get("warning"),
        "overall_decision": overall_decision,
        "first_task_signal": first_task_signal,
        "baseline_selection": baseline,
        "power_analysis": {
            **power_config,
            "required_trials_per_policy": powered_n,
            "actual_real_trials_per_policy": actual_n,
            "meets_planned_sample_size": actual_n >= powered_n,
            "primary_estimand_alignment": "linear contrast of targeted and random baseline-relative gains at equal cost",
            "warning": "planning approximation assumes independent binomial proportions; update with hardware pilot block correlation",
        },
        "collection": collection,
        "held_out_real": {
            "policy_results": real_policy_rates,
            "scenario_blocks": len(blocks),
            "failure_mode_strata": {mode: len(ids) for mode, ids in sorted(strata.items())},
        },
        "primary_endpoint": primary,
        "simulation_to_real": {
            "policy_count": len(policy_ids),
            "spearman_policy_rank": rank_correlation,
            **rank_uncertainty,
            "policy_ids": policy_ids,
            "simulation_success_rates": {
                policy_id: sim_policy_rates[policy_id]["success_rate"]
                for policy_id in policy_ids
            },
            "real_success_rates": {
                policy_id: real_policy_rates[policy_id]["success_rate"]
                for policy_id in policy_ids
            },
        },
        "safety": safety,
        "attribution": attribution,
        "evidence_registry": config["claims"],
        "decision_registry": decisions,
        "provenance": {
            "config_sha256": _sha256(config_path),
            "metadata_sha256": _sha256(data_dir / "metadata.json"),
            "input_file_sha256": metadata["files"],
            "capture_contract": capture,
            "source_kinds": {
                "sourced_claim": "narrow statement backed by a primary or official source",
                "proposed_management_threshold": "capy decision rule; not a research fact",
                "design_choice": "frozen experiment choice; not asserted as universally optimal",
            },
        },
        "limitations": [
            "synthetic results are pipeline fixtures and cannot support a product or scientific claim"
            if metadata["data_class"] == "synthetic"
            else "one task cannot establish the inherited across-three-task cost-efficiency criterion",
            "binary fixture success does not capture every trajectory-quality dimension",
            "the normal-approximation power calculation ignores final hardware block correlation",
            "sim-to-real rank uses seven related policies and may be dominated by between-cohort separation",
            "cohort rank stability is not exact per-episode causal attribution",
        ],
    }
