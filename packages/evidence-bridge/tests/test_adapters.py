from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT / "src"))

from evidence_bridge import (  # noqa: E402
    ClaimStatus,
    EvidenceType,
    I2RTThresholds,
    ProvenanceKind,
    SourceSystem,
    adapt_i2rt_telemetry,
    adapt_vima_episode,
    adapt_world_context_prior,
    build_failure_claims,
    to_dict,
)


FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WorldContextAdapterTests(unittest.TestCase):
    def test_task_label_and_workflow_prior_stay_distinct(self) -> None:
        envelope = adapt_world_context_prior(load_fixture("world_context_task.json"))

        self.assertEqual(envelope.source_system, SourceSystem.WORLD_CONTEXT)
        self.assertEqual(envelope.evidence_type, EvidenceType.TASK_WORKFLOW_PRIOR)
        self.assertEqual(envelope.payload["release_fact"]["provenance"], "observed")
        self.assertEqual(envelope.payload["workflow_prior"]["provenance"], "derived")
        self.assertFalse(envelope.camera_required)
        self.assertIn("panel_flush", envelope.payload["workflow_prior"]["success_predicates"])

    def test_unreleased_workflow_cannot_be_marked_observed(self) -> None:
        fixture = load_fixture("world_context_task.json")
        fixture["workflow_prior"]["provenance"] = "observed"

        with self.assertRaisesRegex(ValueError, "does not release observed workflow"):
            adapt_world_context_prior(fixture)

    def test_approved_procedure_requires_its_own_record(self) -> None:
        fixture = load_fixture("world_context_task.json")
        fixture["workflow_prior"]["provenance"] = "approved_procedure"

        with self.assertRaisesRegex(ValueError, "separate procedure record"):
            adapt_world_context_prior(fixture)


class VimaAdapterTests(unittest.TestCase):
    def adapt(self, fixture: dict):
        return adapt_vima_episode(
            fixture["episode"],
            task_id="construction_masonry@1",
            source_record_id=fixture["capy_source"]["source_record_id"],
            video_uri=fixture["capy_source"]["video_uri"],
            video_sha256=fixture["capy_source"]["video_sha256"],
            vima_artifact_uri=fixture["vima_artifact"]["uri"],
            vima_artifact_sha256=fixture["vima_artifact"]["sha256"],
            phase="execute",
        )

    def test_video_episode_keeps_resolvable_citations(self) -> None:
        fixture = load_fixture("vima_video_memory.json")
        envelope = self.adapt(fixture)

        self.assertTrue(envelope.camera_required)
        self.assertEqual(envelope.provenance, ProvenanceKind.DERIVED)
        self.assertEqual(len(envelope.citations), 2)
        self.assertEqual(envelope.citations[0].frame_reference, "frame_000001.jpg")
        self.assertEqual(envelope.citations[0].sha256, fixture["capy_source"]["video_sha256"])
        self.assertEqual(envelope.payload["event_type"], "masonry_work_candidate")

    def test_uncited_or_unowned_vima_episode_is_rejected(self) -> None:
        fixture = load_fixture("vima_video_memory.json")
        fixture["episode"]["evidence_frames"] = []
        with self.assertRaisesRegex(ValueError, "cited evidence frame"):
            self.adapt(fixture)

        fixture = load_fixture("vima_video_memory.json")
        fixture["capy_source"]["source_record_id"] = ""
        with self.assertRaisesRegex(ValueError, "capy-owned source record"):
            self.adapt(fixture)

    def test_ids_are_stable_and_output_is_json_serializable(self) -> None:
        fixture = load_fixture("vima_video_memory.json")
        first = self.adapt(fixture)
        second = self.adapt(copy.deepcopy(fixture))

        self.assertEqual(first.evidence_id, second.evidence_id)
        json.dumps(to_dict(first))


class I2RTAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.thresholds = I2RTThresholds(
            motor_current_a={"joint_4": 3.0},
            trajectory_error={"joint_4": 0.1},
            min_duration_s=0.2,
            max_sample_gap_s=0.15,
            rule_version="fixture-test.v1",
        )

    def test_camera_free_signals_become_separate_evidence(self) -> None:
        evidence = adapt_i2rt_telemetry(load_fixture("i2rt_camera_free.json"), self.thresholds)
        by_type = {item.evidence_type: item for item in evidence}

        self.assertEqual(
            set(by_type),
            {
                EvidenceType.MOTOR_CURRENT_EVENT,
                EvidenceType.TRAJECTORY_ERROR,
                EvidenceType.FIXTURE_STATE,
                EvidenceType.MANUAL_LABEL,
            },
        )
        self.assertTrue(all(not item.camera_required for item in evidence))
        self.assertEqual(by_type[EvidenceType.MOTOR_CURRENT_EVENT].payload["baseline_a"], 1.2)
        self.assertEqual(by_type[EvidenceType.FIXTURE_STATE].payload["observed_state"], "unseated")
        self.assertEqual(by_type[EvidenceType.MANUAL_LABEL].provenance, ProvenanceKind.MANUAL)
        self.assertEqual(by_type[EvidenceType.MANUAL_LABEL].citations[0].media_kind, "annotation")
        self.assertTrue(by_type[EvidenceType.MANUAL_LABEL].citations[0].uri.endswith("manual-labels.json"))
        self.assertEqual(by_type[EvidenceType.MANUAL_LABEL].citations[0].sha256, "d" * 64)

    def test_claims_never_auto_confirm_and_cross_signal_overlap_corrobates(self) -> None:
        evidence = adapt_i2rt_telemetry(load_fixture("i2rt_camera_free.json"), self.thresholds)
        claims = build_failure_claims(evidence)

        self.assertTrue(any(claim.status is ClaimStatus.CORROBORATED for claim in claims))
        self.assertTrue(all(claim.status is not ClaimStatus.CONFIRMED for claim in claims))
        manual = next(claim for claim in claims if claim.failure_type.startswith("manual_assertion:"))
        self.assertEqual(manual.status, ClaimStatus.CANDIDATE)
        self.assertIn("attributed assertion", manual.limitations[0])

    def test_camera_bearing_run_is_not_silently_accepted_by_camera_free_adapter(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        fixture["camera_present"] = True

        with self.assertRaisesRegex(ValueError, "camera-free"):
            adapt_i2rt_telemetry(fixture, self.thresholds)

    def test_unknown_camera_status_is_not_treated_as_camera_free(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        del fixture["camera_present"]

        with self.assertRaisesRegex(ValueError, "explicitly false"):
            adapt_i2rt_telemetry(fixture, self.thresholds)

    def test_sample_gaps_do_not_create_fake_sustained_events(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        fixture["samples"] = [fixture["samples"][2], fixture["samples"][5]]
        fixture["fixture_expectations"] = []
        fixture["manual_labels"] = []

        evidence = adapt_i2rt_telemetry(fixture, self.thresholds)

        self.assertEqual(evidence, [])

    def test_stale_or_missing_fixture_state_does_not_become_a_mismatch(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        fixture["samples"] = [
            {
                "timestamp_s": 0.4,
                "motor_current_a": {},
                "trajectory_error": {},
                "fixture_state": {"panel_nest": "unseated"},
            },
            {"timestamp_s": 0.6, "motor_current_a": {}, "trajectory_error": {}, "fixture_state": {}},
        ]
        fixture["manual_labels"] = []
        fixture["fixture_expectations"][0]["max_observation_age_s"] = 0.1

        evidence = adapt_i2rt_telemetry(fixture, self.thresholds)

        self.assertNotIn(EvidenceType.FIXTURE_STATE, {item.evidence_type for item in evidence})

    def test_evidence_id_changes_with_provenance_and_temporal_domain(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        original = adapt_i2rt_telemetry(fixture, self.thresholds)[0]
        changed = copy.deepcopy(fixture)
        changed["task_id"] = "place_panel_in_fixture@2"
        changed["clock"] = "different_monotonic_epoch"
        changed["telemetry_uri"] = "mcap:///runs/i2rt_run_001/reprocessed.mcap"

        mutated = adapt_i2rt_telemetry(changed, self.thresholds)[0]

        self.assertNotEqual(original.evidence_id, mutated.evidence_id)


if __name__ == "__main__":
    unittest.main()
