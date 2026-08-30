from __future__ import annotations

import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT / "src"))

from evidence_bridge import (
    ClaimStatus,
    EvidenceType,
    I2RTJournalProjection,
    I2RTThresholds,
    ProvenanceKind,
    SourceSystem,
    adapt_i2rt_journal,
    adapt_i2rt_telemetry,
    adapt_vima_episode,
    adapt_world_context_prior,
    build_failure_claims,
    to_dict,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def i2rt_manifest() -> dict:
    return {
        "schema_version": "capy.i2rt.camera_free.v1",
        "session_id": "session-1",
        "created_wall_time_ns": 1_900_000_000_000_000_000,
        "robot": {
            "joint_names": ["joint1", "gripper"],
            "motor_ids": [1, 7],
            "target_hz": 20,
            "arm_type": "yam",
            "gripper_type": "linear_4310",
            "gripper_index": 1,
            "control_mode": "MIT",
            "i2rt_source_revision": "47fee5e7dec4e30ca054f798bda1c8894b465ed2",
            "rig_id": "fixed-geometry-rig-1",
        },
        "camera_streams": [],
        "capture_contract": {
            "canonical_time": "recorder_monotonic_time_ns",
            "source_time": "i2rt batch wall timestamp when available",
            "exact_capture_quality": "control_cycle",
        },
    }


def i2rt_event(
    sequence: int, event_type: str, episode_id: str | None, payload: dict
) -> dict:
    timestamp = 1_000_000_000 + sequence * 50_000_000
    return {
        "sequence": sequence,
        "event_type": event_type,
        "episode_id": episode_id,
        "recorder_monotonic_time_ns": timestamp,
        "recorder_wall_time_ns": 1_900_000_000_000_000_000 + timestamp,
        "payload": payload,
    }


def i2rt_frame(*, interventions: list[str], safety_events: list[str]) -> dict:
    return {
        "command": {
            "position": [0.1, 0.2],
            "velocity": [0.0, 0.0],
            "feedforward_torque": [0.0, 0.0],
            "kp": [40.0, 8.0],
            "kd": [2.0, 0.3],
            "applied_torque": [0.1, 0.2],
            "source": "teaching_handle",
            "mode": "MIT",
            "upstream_position": [0.1, 0.2],
        },
        "measured": {
            "position": [0.099, 0.199],
            "velocity": [0.2, -0.1],
            "effort": [0.1, 0.2],
            "temp_mos_c": [31.0, 32.0],
            "temp_rotor_c": [29.0, 30.0],
            "motor_error_code": [1, 1],
            "motor_error_message": ["normal", "normal"],
            "chain_running": True,
        },
        "capture_quality": "control_cycle",
        "source_wall_time_ns": 1_900_000_001_049_000_000,
        "teleop": {
            "source": "teaching_handle",
            "enabled": True,
            "synchronized": True,
            "leader_joint_position": [0.1],
            "gripper_command": 0.2,
            "buttons": [],
            "axes": [],
        },
        "controller": {"gravity_compensation_enabled": True},
        "clock_health": {
            "source_age_ms": 1.0,
            "source_drift_ppm": None,
            "wall_step_ms": 0.0,
            "healthy": True,
        },
        "intervention_active": bool(interventions),
        "active_interventions": interventions,
        "safety_active": bool(safety_events),
        "active_safety_events": safety_events,
    }


def i2rt_journal_events() -> list[dict]:
    episode_id = "episode-1"
    return [
        i2rt_event(0, "session_start", None, {"session_id": "session-1"}),
        i2rt_event(
            1,
            "episode_start",
            episode_id,
            {
                "task": "insert the keyed peg into the fixed socket",
                "geometry_id": "fixed-keyed-peg-v1",
                "operator_id": "operator-17",
                "notes": "",
            },
        ),
        i2rt_event(
            2, "frame", episode_id, i2rt_frame(interventions=[], safety_events=[])
        ),
        i2rt_event(
            3,
            "intervention",
            episode_id,
            {
                "intervention_id": "guidance-1",
                "active": True,
                "kind": "operator_guidance",
                "actor": "operator-17",
                "reason": "demonstrate a recovery",
            },
        ),
        i2rt_event(
            4,
            "frame",
            episode_id,
            i2rt_frame(interventions=["guidance-1"], safety_events=[]),
        ),
        i2rt_event(
            5,
            "safety_event",
            episode_id,
            {
                "code": "motor_7_fault_0xb",
                "active": True,
                "severity": "stop",
                "message": "mosfet over temperature",
                "motor_ids": [7],
                "source": "motor_feedback",
            },
        ),
        i2rt_event(
            6,
            "frame",
            episode_id,
            i2rt_frame(
                interventions=["guidance-1"], safety_events=["motor_7_fault_0xb"]
            ),
        ),
        i2rt_event(
            7,
            "clock_issue",
            episode_id,
            {
                "code": "source_clock_age",
                "severity": "warning",
                "message": "i2rt source wall timestamp is too far from recorder wall time",
                "value_ms": 140.0,
                "limit_ms": 100.0,
            },
        ),
        i2rt_event(
            8,
            "safety_event",
            episode_id,
            {
                "code": "motor_7_fault_0xb",
                "active": False,
                "severity": "info",
                "message": "motor feedback no longer reports this fault code",
                "motor_ids": [7],
                "source": "motor_feedback",
            },
        ),
        i2rt_event(
            9,
            "intervention",
            episode_id,
            {
                "intervention_id": "guidance-1",
                "active": False,
                "kind": "operator_guidance",
                "actor": "operator-17",
                "reason": "guidance complete",
            },
        ),
        i2rt_event(
            10, "frame", episode_id, i2rt_frame(interventions=[], safety_events=[])
        ),
        i2rt_event(
            11,
            "episode_end",
            episode_id,
            {
                "outcome": "success",
                "reason": "operator confirmed insertion depth",
                "notes": "",
                "interventions_active_at_end": [],
                "safety_events_active_at_end": [],
            },
        ),
        i2rt_event(12, "session_end", None, {"incomplete_episode_id": None}),
    ]


class I2RTJournal:
    def __init__(self, events: list[dict] | None = None) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.root = Path(self._temporary.name)
        manifest_bytes = (
            json.dumps(i2rt_manifest(), sort_keys=True, separators=(",", ":")) + "\n"
        ).encode()
        event_bytes = b"".join(
            (json.dumps(event, sort_keys=True, separators=(",", ":")) + "\n").encode()
            for event in (events if events is not None else i2rt_journal_events())
        )
        (self.root / "manifest.json").write_bytes(manifest_bytes)
        (self.root / "events.ndjson").write_bytes(event_bytes)
        self.manifest_digest = f"sha256:{hashlib.sha256(manifest_bytes).hexdigest()}"
        self.events_digest = f"sha256:{hashlib.sha256(event_bytes).hexdigest()}"

    def close(self) -> None:
        self._temporary.cleanup()


class WorldContextAdapterTests(unittest.TestCase):
    def test_task_label_and_workflow_prior_stay_distinct(self) -> None:
        envelope = adapt_world_context_prior(load_fixture("world_context_task.json"))

        self.assertEqual(envelope.source_system, SourceSystem.WORLD_CONTEXT)
        self.assertEqual(envelope.evidence_type, EvidenceType.TASK_WORKFLOW_PRIOR)
        self.assertEqual(envelope.payload["release_fact"]["provenance"], "observed")
        self.assertEqual(envelope.payload["workflow_prior"]["provenance"], "derived")
        self.assertFalse(envelope.camera_required)
        self.assertIn(
            "panel_flush", envelope.payload["workflow_prior"]["success_predicates"]
        )

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
        self.assertEqual(
            envelope.citations[0].sha256, fixture["capy_source"]["video_sha256"]
        )
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
        evidence = adapt_i2rt_telemetry(
            load_fixture("i2rt_camera_free.json"), self.thresholds
        )
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
        self.assertEqual(
            by_type[EvidenceType.MOTOR_CURRENT_EVENT].payload["baseline_a"], 1.2
        )
        self.assertEqual(
            by_type[EvidenceType.FIXTURE_STATE].payload["observed_state"], "unseated"
        )
        self.assertEqual(
            by_type[EvidenceType.MANUAL_LABEL].provenance, ProvenanceKind.MANUAL
        )
        self.assertEqual(
            by_type[EvidenceType.MANUAL_LABEL].citations[0].media_kind, "annotation"
        )
        self.assertTrue(
            by_type[EvidenceType.MANUAL_LABEL]
            .citations[0]
            .uri.endswith("manual-labels.json")
        )
        self.assertEqual(
            by_type[EvidenceType.MANUAL_LABEL].citations[0].sha256, "d" * 64
        )

    def test_claims_never_auto_confirm_and_cross_signal_overlap_corrobates(
        self,
    ) -> None:
        evidence = adapt_i2rt_telemetry(
            load_fixture("i2rt_camera_free.json"), self.thresholds
        )
        claims = build_failure_claims(evidence)

        self.assertTrue(
            any(claim.status is ClaimStatus.CORROBORATED for claim in claims)
        )
        self.assertTrue(
            all(claim.status is not ClaimStatus.CONFIRMED for claim in claims)
        )
        manual = next(
            claim
            for claim in claims
            if claim.failure_type.startswith("manual_assertion:")
        )
        self.assertEqual(manual.status, ClaimStatus.CANDIDATE)
        self.assertIn("attributed assertion", manual.limitations[0])

    def test_camera_bearing_run_is_not_silently_accepted_by_camera_free_adapter(
        self,
    ) -> None:
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
            {
                "timestamp_s": 0.6,
                "motor_current_a": {},
                "trajectory_error": {},
                "fixture_state": {},
            },
        ]
        fixture["manual_labels"] = []
        fixture["fixture_expectations"][0]["max_observation_age_s"] = 0.1

        evidence = adapt_i2rt_telemetry(fixture, self.thresholds)

        self.assertNotIn(
            EvidenceType.FIXTURE_STATE, {item.evidence_type for item in evidence}
        )

    def test_evidence_id_changes_with_provenance_and_temporal_domain(self) -> None:
        fixture = load_fixture("i2rt_camera_free.json")
        original = adapt_i2rt_telemetry(fixture, self.thresholds)[0]
        changed = copy.deepcopy(fixture)
        changed["task_id"] = "place_panel_in_fixture@2"
        changed["clock"] = "different_monotonic_epoch"
        changed["telemetry_uri"] = "mcap:///runs/i2rt_run_001/reprocessed.mcap"

        mutated = adapt_i2rt_telemetry(changed, self.thresholds)[0]

        self.assertNotEqual(original.evidence_id, mutated.evidence_id)


class I2RTJournalAdapterTests(unittest.TestCase):
    def project(
        self, events: list[dict] | None = None
    ) -> tuple[I2RTJournalProjection, I2RTJournal]:
        journal = I2RTJournal(events)
        self.addCleanup(journal.close)
        return (
            adapt_i2rt_journal(
                journal.root,
                task_ids_by_episode={"episode-1": "insert_keyed_peg@1"},
                phases_by_episode={"episode-1": "execute"},
                source_uri="s3://capy-evidence/session-1/events.ndjson",
            ),
            journal,
        )

    def test_actual_camera_free_journal_projects_boundaries_and_event_evidence(
        self,
    ) -> None:
        projection, journal = self.project()

        self.assertEqual(projection.session_id, "session-1")
        self.assertEqual(projection.profile, "capy.i2rt.camera_free.v1")
        self.assertEqual(projection.clock_basis, "system_time")
        self.assertEqual(projection.canonical_time, "recorder_monotonic_time_ns")
        self.assertEqual(projection.episode_count, 1)
        self.assertEqual(projection.successful_episode_count, 1)
        self.assertEqual(
            projection.source_journal.manifest_digest, journal.manifest_digest
        )
        self.assertEqual(projection.source_journal.events_digest, journal.events_digest)
        self.assertEqual(projection.source_journal.format, "capy.ndjson.camera_free.v1")
        self.assertEqual(
            projection.episode_ids_digest,
            "sha256:" + hashlib.sha256(b'["episode-1"]').hexdigest(),
        )
        self.assertEqual(
            projection.topics,
            (
                "/capy/session_start",
                "/capy/episode_start",
                "/capy/frame",
                "/capy/intervention",
                "/capy/safety_event",
                "/capy/clock_issue",
                "/capy/episode_end",
                "/capy/session_end",
            ),
        )

        episode = projection.episodes[0]
        self.assertEqual(episode.task_id, "insert_keyed_peg@1")
        self.assertEqual(
            episode.task_instruction, "insert the keyed peg into the fixed socket"
        )
        self.assertEqual(episode.geometry_id, "fixed-keyed-peg-v1")
        self.assertEqual((episode.start_sequence, episode.end_sequence), (1, 11))
        self.assertEqual(
            (episode.first_frame_sequence, episode.last_frame_sequence), (2, 10)
        )
        self.assertEqual(episode.frame_count, 4)
        self.assertEqual(episode.capture_quality, {"control_cycle": 4})
        self.assertEqual(episode.intervention_event_count, 2)
        self.assertEqual(episode.safety_event_count, 2)
        self.assertEqual(episode.clock_issue_count, 1)
        self.assertEqual(episode.interventions_active_at_end, ())
        self.assertEqual(episode.safety_events_active_at_end, ())
        self.assertEqual(episode.camera_streams, ())
        self.assertEqual(episode.source_journal, projection.source_journal)

        self.assertEqual(len(projection.evidence), 6)
        by_type: dict[EvidenceType, list] = {}
        for item in projection.evidence:
            by_type.setdefault(item.evidence_type, []).append(item)
            self.assertFalse(item.camera_required)
            self.assertEqual(
                item.payload["source_journal"]["events_digest"], journal.events_digest
            )
            self.assertEqual(
                item.citations[0].sha256, journal.events_digest.removeprefix("sha256:")
            )
            event_json = json.dumps(item.payload["event"]).lower()
            for forbidden_field in (
                '"camera"',
                '"image"',
                '"rgb"',
                '"video"',
            ):
                self.assertNotIn(forbidden_field, event_json)
        self.assertEqual(
            set(by_type),
            {
                EvidenceType.INTERVENTION_EVENT,
                EvidenceType.SAFETY_EVENT,
                EvidenceType.CLOCK_ISSUE,
                EvidenceType.EPISODE_OUTCOME,
            },
        )
        self.assertTrue(
            all(
                item.provenance is ProvenanceKind.MANUAL
                for item in by_type[EvidenceType.INTERVENTION_EVENT]
            )
        )
        self.assertTrue(
            all(
                item.provenance is ProvenanceKind.OBSERVED
                for item in by_type[EvidenceType.SAFETY_EVENT]
            )
        )
        self.assertIs(
            by_type[EvidenceType.CLOCK_ISSUE][0].provenance, ProvenanceKind.DERIVED
        )
        self.assertIs(
            by_type[EvidenceType.EPISODE_OUTCOME][0].provenance, ProvenanceKind.MANUAL
        )
        self.assertEqual(build_failure_claims(projection.evidence), [])
        json.dumps(to_dict(projection))

    def test_missing_episode_end_is_rejected(self) -> None:
        events = i2rt_journal_events()
        events.pop(-2)
        events[-1]["sequence"] = 11
        events[-1]["payload"]["incomplete_episode_id"] = "episode-1"

        with self.assertRaisesRegex(ValueError, "active episode|terminal episode_end"):
            self.project(events)

    def test_missing_session_end_is_rejected(self) -> None:
        events = i2rt_journal_events()[:-1]

        with self.assertRaisesRegex(ValueError, "missing terminal session_end"):
            self.project(events)

    def test_malformed_terminal_outcome_and_state_are_rejected(self) -> None:
        events = i2rt_journal_events()
        del events[-2]["payload"]["outcome"]
        with self.assertRaisesRegex(ValueError, "episode_end 11 payload.outcome"):
            self.project(events)

        events = i2rt_journal_events()
        events[-2]["payload"]["safety_events_active_at_end"] = ["phantom_stop"]
        with self.assertRaisesRegex(ValueError, "safety state does not match"):
            self.project(events)

    def test_event_outside_episode_and_camera_payload_are_rejected(self) -> None:
        events = i2rt_journal_events()
        events[3]["episode_id"] = "other-episode"
        with self.assertRaisesRegex(ValueError, "outside its active episode"):
            self.project(events)

        events = i2rt_journal_events()
        events[2]["payload"]["rgb_image"] = "not-allowed"
        with self.assertRaisesRegex(ValueError, "forbidden camera field"):
            self.project(events)

        journal = I2RTJournal()
        self.addCleanup(journal.close)
        manifest = json.loads((journal.root / "manifest.json").read_text())
        manifest["extra"] = {"rgb_stream": "not-allowed"}
        (journal.root / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaisesRegex(
            ValueError, "manifest contains forbidden camera field"
        ):
            adapt_i2rt_journal(
                journal.root,
                task_ids_by_episode={"episode-1": "insert_keyed_peg@1"},
                source_uri="s3://capy-evidence/session-1/events.ndjson",
            )

    def test_protocol_task_binding_is_never_inferred_from_instruction(self) -> None:
        journal = I2RTJournal()
        self.addCleanup(journal.close)

        with self.assertRaisesRegex(ValueError, "missing explicit protocol task id"):
            adapt_i2rt_journal(
                journal.root,
                task_ids_by_episode={},
                source_uri="s3://capy-evidence/session-1/events.ndjson",
            )


if __name__ == "__main__":
    unittest.main()
