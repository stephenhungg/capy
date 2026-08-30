from __future__ import annotations

import csv
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


EXPERIMENTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EXPERIMENTS))

from capy_eval.analysis import ValidationError, analyze_dataset  # noqa: E402
from capy_eval.generate import generate_dataset, write_metadata  # noqa: E402
from capy_eval.report import render_markdown  # noqa: E402
from capy_eval.stats import gain_ratio_contrast_sample_size, spearman  # noqa: E402


CONFIG = EXPERIMENTS / "config" / "experiment.json"


def directory_hashes(directory: Path) -> dict[str, str]:
    return {
        str(path.relative_to(directory)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(directory.rglob("*"))
        if path.is_file()
    }


class StatsTests(unittest.TestCase):
    def test_power_is_explicit_and_deterministic(self) -> None:
        self.assertEqual(
            gain_ratio_contrast_sample_size(0.45, 0.55, 0.75, 1.25, 0.05, 0.80),
            127,
        )

    def test_spearman_handles_ties(self) -> None:
        self.assertAlmostEqual(spearman([1, 2, 2, 4], [1, 3, 3, 8]), 1.0)


class PipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="capy-eval-test-")
        self.root = Path(self.temporary.name)
        self.data = self.root / "data"
        generate_dataset(CONFIG, self.data)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_generation_is_byte_reproducible(self) -> None:
        second = self.root / "second"
        generate_dataset(CONFIG, second)
        self.assertEqual(directory_hashes(self.data), directory_hashes(second))

    def test_fixture_exercises_registered_paths(self) -> None:
        result = analyze_dataset(CONFIG, self.data)
        self.assertEqual(result["data_class"], "synthetic")
        self.assertEqual(result["overall_decision"], "synthetic_fixture_only")
        self.assertEqual(result["first_task_signal"], "provisional_pass")
        self.assertTrue(result["collection"]["equal_cost_valid"])
        self.assertEqual(result["collection"]["cohorts"]["random"]["attempted_episodes"], 132)
        self.assertEqual(
            result["collection"]["cohorts"]["random"]["rejected_or_aborted_episodes"],
            12,
        )
        self.assertEqual(result["collection"]["cohorts"]["random"]["cost_usd"], 1320.0)
        self.assertTrue(result["power_analysis"]["meets_planned_sample_size"])
        self.assertGreaterEqual(
            result["primary_endpoint"]["targeted_to_random_gain_per_dollar_ratio"],
            1.25,
        )
        self.assertGreaterEqual(result["simulation_to_real"]["spearman_policy_rank"], 0.6)
        self.assertGreaterEqual(
            result["attribution"]["bootstrap_consensus_rank_stability"], 0.7
        )
        self.assertEqual(result["attribution"]["replicates"], 6000)
        self.assertIn("held-out real", result["attribution"]["lineage"])
        self.assertTrue(all(item["passes_guardrail"] for item in result["safety"].values()))
        targeted_gate = next(
            item
            for item in result["decision_registry"]
            if item["id"] == "targeted_cost_efficiency"
        )
        self.assertEqual(targeted_gate["status"], "not_evaluated")
        self.assertEqual(targeted_gate["evidence"]["tasks_completed"], 1)
        rights_gate = next(
            item for item in result["decision_registry"] if item["id"] == "rights_completeness"
        )
        self.assertEqual(rights_gate["status"], "not_evaluated")

    def test_report_labels_synthetic_data_and_thresholds(self) -> None:
        report = render_markdown(analyze_dataset(CONFIG, self.data))
        self.assertIn("synthetic pipeline-fixture output", report)
        self.assertIn("proposed_management_threshold", report)
        self.assertIn("not exact causal credit", report)
        self.assertIn("bootstrap denominator crosses or approaches zero", report)

    def test_hash_tampering_fails_closed(self) -> None:
        path = self.data / "collection_episodes.csv"
        path.write_text(path.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        with self.assertRaisesRegex(ValidationError, "hash mismatch"):
            analyze_dataset(CONFIG, self.data)

    def test_metadata_only_cannot_relabel_synthetic_as_observed(self) -> None:
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["data_class"] = "observed"
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "synthetic fixture sentinel"):
            analyze_dataset(CONFIG, self.data)

    def test_register_observed_refuses_synthetic_fixture_sentinel(self) -> None:
        capture_path = self.data / "capture_manifest.json"
        capture = json.loads(capture_path.read_text(encoding="utf-8"))
        capture["data_origin"] = "observed"
        capture_path.write_text(
            json.dumps(capture, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValueError, "synthetic fixture sentinel"):
            write_metadata(CONFIG, self.data, "observed")

    def test_unpaired_heldout_scenario_fails_closed(self) -> None:
        path = self.data / "evaluation_trials.csv"
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames
            rows = list(reader)
        self.assertIsNotNone(fieldnames)
        rows[0]["scenario_id"] = "real_scenario_unpaired"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["evaluation_trials.csv"] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "full unique policy set"):
            analyze_dataset(CONFIG, self.data)

    def test_posthoc_condition_relabel_fails_closed(self) -> None:
        path = self.data / "evaluation_trials.csv"
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames
            rows = list(reader)
        self.assertIsNotNone(fieldnames)
        scenario_id = rows[0]["scenario_id"]
        original_mode = rows[0]["failure_mode"]
        replacement_mode = "nominal" if original_mode != "nominal" else "high_friction"
        for row in rows:
            if row["scenario_id"] == scenario_id:
                row["failure_mode"] = replacement_mode
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["evaluation_trials.csv"] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "sealed seeded schedule"):
            analyze_dataset(CONFIG, self.data)

    def test_precontrol_exclusion_rejects_postcontrol_outcomes(self) -> None:
        path = self.data / "evaluation_trials.csv"
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames
            rows = list(reader)
        self.assertIsNotNone(fieldnames)
        scenario_id = rows[0]["scenario_id"]
        for row in rows:
            if row["scenario_id"] == scenario_id:
                row["excluded"] = "1"
                row["exclusion_reason"] = "pre_control_fixture_fault"
                row["replacement_scenario_id"] = "placeholder_replacement"
                row["policy_control_started"] = "0"
                row["incident_timestamp_ns"] = "123456789"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["evaluation_trials.csv"] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "post-control outcomes"):
            analyze_dataset(CONFIG, self.data)

    def test_equal_cost_violation_fails_closed(self) -> None:
        path = self.data / "collection_episodes.csv"
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames
            rows = list(reader)
        self.assertIsNotNone(fieldnames)
        rows[0]["duration_minutes"] = "15.000"
        rows[0]["cost_usd"] = "30.00"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["collection_episodes.csv"] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "cost imbalance"):
            analyze_dataset(CONFIG, self.data)

    def test_baseline_shopping_fails_closed(self) -> None:
        path = self.data / "baseline_candidates.csv"
        text = path.read_text(encoding="utf-8").replace(
            "baseline_bc_003,proprioceptive-behavioral-cloning-v1,0.47",
            "baseline_bc_003,proprioceptive-behavioral-cloning-v1,0.41",
        )
        path.write_text(text, encoding="utf-8")
        metadata_path = self.data / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["files"]["baseline_candidates.csv"] = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()
        metadata_path.write_text(
            json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValidationError, "configured baseline"):
            analyze_dataset(CONFIG, self.data)


if __name__ == "__main__":
    unittest.main()
