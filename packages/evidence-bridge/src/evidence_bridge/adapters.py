"""Pure, dependency-free adapters for the first capy evidence sources."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from .taxonomy import (
    Citation,
    ClaimStatus,
    EvidenceEnvelope,
    EvidenceType,
    FailureClaim,
    ProvenanceKind,
    SourceSystem,
    TemporalPhase,
    TemporalSpan,
)


def _stable_id(prefix: str, value: Mapping[str, Any]) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return f"{prefix}_{hashlib.sha256(encoded).hexdigest()[:16]}"


def _phase(value: str | None) -> TemporalPhase:
    try:
        return TemporalPhase(value or "unknown")
    except ValueError as exc:
        raise ValueError(f"unknown temporal phase: {value}") from exc


def adapt_world_context_prior(document: Mapping[str, Any]) -> EvidenceEnvelope:
    """Normalize a World Context task label plus explicitly sourced workflow priors.

    World Context's released label is observed. Phase, object, predicate, and
    workflow concepts are not release annotations, so their provenance must be
    supplied separately and cannot be ``observed``.
    """

    required = ("release", "clip_id", "task_label", "normalized_task_id", "workflow_prior")
    missing = [key for key in required if not document.get(key)]
    if missing:
        raise ValueError(f"world context prior is missing: {', '.join(missing)}")

    workflow = document["workflow_prior"]
    prior_kind = ProvenanceKind(workflow.get("provenance"))
    if prior_kind is ProvenanceKind.OBSERVED:
        raise ValueError("World Context does not release observed workflow, phase, or object annotations")
    if prior_kind is ProvenanceKind.APPROVED_PROCEDURE:
        raise ValueError("approved procedures require a separate procedure record and citation")
    phase_priors = workflow.get("phases", [])
    for item in phase_priors:
        _phase(item.get("phase"))

    payload = {
        "release_fact": {
            "release": document["release"],
            "clip_id": document["clip_id"],
            "task_label": document["task_label"],
            "provenance": ProvenanceKind.OBSERVED.value,
        },
        "workflow_prior": {
            "provenance": prior_kind.value,
            "intent": workflow.get("intent"),
            "task_graph": list(workflow.get("task_graph", [])),
            "phases": list(phase_priors),
            "objects": list(workflow.get("objects", [])),
            "initial_predicates": list(workflow.get("initial_predicates", [])),
            "success_predicates": list(workflow.get("success_predicates", [])),
            "notes": list(workflow.get("notes", [])),
        },
    }
    citation_uri = str(document.get("metadata_uri", f"world-context://{document['release']}/{document['clip_id']}"))
    identity = {
        "release": document["release"],
        "clip_id": document["clip_id"],
        "task_id": document["normalized_task_id"],
        "metadata_uri": citation_uri,
        "payload": payload,
    }
    return EvidenceEnvelope(
        evidence_id=_stable_id("ev_wc", identity),
        source_system=SourceSystem.WORLD_CONTEXT,
        evidence_type=EvidenceType.TASK_WORKFLOW_PRIOR,
        source_record_id=str(document["clip_id"]),
        task_id=str(document["normalized_task_id"]),
        phase=TemporalPhase.UNKNOWN,
        claim=f"task label {document['task_label']} anchors a provenance-tagged human workflow prior",
        provenance=prior_kind,
        camera_required=False,
        citations=(Citation(uri=citation_uri, media_kind="metadata"),),
        payload=payload,
    )


def adapt_vima_episode(
    episode: Mapping[str, Any],
    *,
    task_id: str,
    video_uri: str,
    source_record_id: str,
    video_sha256: str | None = None,
    vima_artifact_uri: str | None = None,
    vima_artifact_sha256: str | None = None,
    phase: str | None = None,
) -> EvidenceEnvelope:
    """Adapt one VIMA episodic-memory row and retain inspectable video citations."""

    if not video_uri:
        raise ValueError("vima evidence requires an explicit video-bearing source uri")
    if not source_record_id:
        raise ValueError("vima evidence requires a capy-owned source record id")
    required = ("episode_id", "event_type", "time_start_s", "time_end_s", "observation")
    missing = [key for key in required if episode.get(key) is None]
    if missing:
        raise ValueError(f"vima episode is missing: {', '.join(missing)}")
    frames = episode.get("evidence_frames") or []
    if not frames:
        raise ValueError("vima evidence requires at least one cited evidence frame")

    span = TemporalSpan(float(episode["time_start_s"]), float(episode["time_end_s"]), "video_relative")
    citations = tuple(
        Citation(
            uri=video_uri,
            media_kind="video",
            span=span,
            frame_reference=str(item["frame"]),
            sha256=video_sha256,
        )
        for item in frames
        if item.get("frame")
    )
    if not citations:
        raise ValueError("vima evidence frames must contain frame references")

    payload = {
        "event_type": episode["event_type"],
        "involved_tracks": list(episode.get("involved_tracks", [])),
        "object_labels": list(episode.get("labels", [])),
        "relations": list(episode.get("relations", [])),
        "spatial_facts": list(episode.get("spatial_facts", [])),
        "citation_votes": {str(item["frame"]): item.get("votes") for item in frames if item.get("frame")},
        "vima_artifact_uri": vima_artifact_uri,
        "vima_artifact_sha256": vima_artifact_sha256,
        "confidence_method": "vima_heuristic_or_model_reported",
    }
    identity = {
        "episode_id": episode["episode_id"],
        "source_record_id": source_record_id,
        "task_id": task_id,
        "video_uri": video_uri,
        "video_sha256": video_sha256,
        "vima_artifact_uri": vima_artifact_uri,
        "vima_artifact_sha256": vima_artifact_sha256,
        "span": [span.start_s, span.end_s],
        "phase": _phase(phase).value,
        "observation": episode["observation"],
        "confidence": episode.get("confidence"),
        "payload": payload,
    }
    return EvidenceEnvelope(
        evidence_id=_stable_id("ev_vima", identity),
        source_system=SourceSystem.VIMA,
        evidence_type=EvidenceType.CITED_VIDEO_MEMORY,
        source_record_id=source_record_id,
        task_id=task_id,
        phase=_phase(phase),
        span=span,
        claim=str(episode["observation"]),
        provenance=ProvenanceKind.DERIVED,
        camera_required=True,
        confidence=float(episode["confidence"]) if episode.get("confidence") is not None else None,
        citations=citations,
        payload=payload,
    )


@dataclass(frozen=True, slots=True)
class I2RTThresholds:
    motor_current_a: Mapping[str, float] = field(default_factory=dict)
    trajectory_error: Mapping[str, float] = field(default_factory=dict)
    min_duration_s: float = 0.2
    max_sample_gap_s: float = 0.15
    rule_version: str = "capy.i2rt-thresholds.v1"

    def __post_init__(self) -> None:
        if self.min_duration_s < 0:
            raise ValueError("minimum event duration cannot be negative")
        if self.max_sample_gap_s <= 0:
            raise ValueError("maximum sample gap must be positive")
        if any(value < 0 for value in (*self.motor_current_a.values(), *self.trajectory_error.values())):
            raise ValueError("thresholds cannot be negative")


def _sustained_windows(
    samples: Sequence[Mapping[str, Any]],
    field_name: str,
    thresholds: Mapping[str, float],
    min_duration_s: float,
    max_sample_gap_s: float,
) -> Iterable[tuple[str, float, float, list[float]]]:
    for channel, threshold in thresholds.items():
        open_window: list[tuple[float, float]] = []
        for sample in samples:
            timestamp = float(sample["timestamp_s"])
            value = sample.get(field_name, {}).get(channel)
            breached = value is not None and abs(float(value)) > threshold
            if open_window and timestamp - open_window[-1][0] > max_sample_gap_s:
                start, end = open_window[0][0], open_window[-1][0]
                if end - start >= min_duration_s:
                    yield channel, start, end, [item[1] for item in open_window]
                open_window = []
            if breached:
                open_window.append((timestamp, float(value)))
            elif open_window:
                start, end = open_window[0][0], open_window[-1][0]
                if end - start >= min_duration_s:
                    yield channel, start, end, [item[1] for item in open_window]
                open_window = []
        if open_window:
            start, end = open_window[0][0], open_window[-1][0]
            if end - start >= min_duration_s:
                yield channel, start, end, [item[1] for item in open_window]


def _telemetry_envelope(
    *,
    run: Mapping[str, Any],
    evidence_type: EvidenceType,
    source_record_id: str,
    phase: TemporalPhase,
    span: TemporalSpan,
    claim: str,
    provenance: ProvenanceKind,
    payload: Mapping[str, Any],
    confidence: float | None = None,
) -> EvidenceEnvelope:
    citation_uri = (
        run.get("annotation_uri", f"i2rt://{run['run_id']}/annotations")
        if evidence_type is EvidenceType.MANUAL_LABEL
        else run.get("telemetry_uri", f"i2rt://{run['run_id']}/telemetry")
    )
    citation_sha256 = (
        run.get("annotation_sha256")
        if evidence_type is EvidenceType.MANUAL_LABEL
        else run.get("telemetry_sha256")
    )
    identity = {
        "run_id": run["run_id"],
        "task_id": run["task_id"],
        "source_record_id": source_record_id,
        "evidence_type": evidence_type.value,
        "phase": phase.value,
        "span": [span.start_s, span.end_s, span.clock],
        "citation_uri": citation_uri,
        "citation_sha256": citation_sha256,
        "payload": payload,
    }
    return EvidenceEnvelope(
        evidence_id=_stable_id("ev_i2rt", identity),
        source_system=SourceSystem.I2RT,
        evidence_type=evidence_type,
        source_record_id=source_record_id,
        task_id=str(run["task_id"]),
        phase=phase,
        span=span,
        claim=claim,
        provenance=provenance,
        camera_required=False,
        confidence=confidence,
        citations=(
            Citation(
                uri=str(citation_uri),
                media_kind="telemetry" if evidence_type is not EvidenceType.MANUAL_LABEL else "annotation",
                span=span,
                sha256=str(citation_sha256) if citation_sha256 else None,
            ),
        ),
        payload={"run_id": run["run_id"], **payload},
    )


def adapt_i2rt_telemetry(run: Mapping[str, Any], thresholds: I2RTThresholds) -> list[EvidenceEnvelope]:
    """Extract conservative failure evidence from a camera-free i2rt run."""

    if not run.get("run_id") or not run.get("task_id"):
        raise ValueError("i2rt run_id and task_id are required")
    if run.get("camera_present") is not False:
        raise ValueError("camera_present must be explicitly false for the camera-free i2rt adapter")
    samples = sorted(run.get("samples", []), key=lambda item: float(item["timestamp_s"]))
    if not samples:
        raise ValueError("i2rt telemetry requires samples")
    clock = str(run.get("clock", "monotonic_relative"))
    phase = _phase(run.get("phase"))
    evidence: list[EvidenceEnvelope] = []

    for channel, start, end, values in _sustained_windows(
        samples,
        "motor_current_a",
        thresholds.motor_current_a,
        thresholds.min_duration_s,
        thresholds.max_sample_gap_s,
    ):
        threshold = thresholds.motor_current_a[channel]
        payload = {
            "actuator": channel,
            "unit": "A",
            "threshold_abs": threshold,
            "peak_abs": max(abs(value) for value in values),
            "baseline_a": run.get("motor_current_baseline_a", {}).get(channel),
            "sample_count": len(values),
            "rule_version": thresholds.rule_version,
        }
        evidence.append(
            _telemetry_envelope(
                run=run,
                evidence_type=EvidenceType.MOTOR_CURRENT_EVENT,
                source_record_id=f"{run['run_id']}:motor-current:{channel}:{start:g}",
                phase=phase,
                span=TemporalSpan(start, end, clock),
                claim=f"{channel} motor current exceeded the declared absolute threshold for a sustained window",
                provenance=ProvenanceKind.DERIVED,
                payload=payload,
            )
        )

    for channel, start, end, values in _sustained_windows(
        samples,
        "trajectory_error",
        thresholds.trajectory_error,
        thresholds.min_duration_s,
        thresholds.max_sample_gap_s,
    ):
        threshold = thresholds.trajectory_error[channel]
        payload = {
            "channel": channel,
            "unit": str(run.get("trajectory_error_unit", "rad")),
            "reference_frame": str(run.get("trajectory_reference_frame", "joint")),
            "threshold_abs": threshold,
            "peak_abs": max(abs(value) for value in values),
            "sample_count": len(values),
            "controller_mode": run.get("controller_mode"),
            "rule_version": thresholds.rule_version,
        }
        evidence.append(
            _telemetry_envelope(
                run=run,
                evidence_type=EvidenceType.TRAJECTORY_ERROR,
                source_record_id=f"{run['run_id']}:trajectory-error:{channel}:{start:g}",
                phase=phase,
                span=TemporalSpan(start, end, clock),
                claim=f"{channel} commanded-to-observed trajectory error exceeded tolerance for a sustained window",
                provenance=ProvenanceKind.DERIVED,
                payload=payload,
            )
        )

    for expectation in run.get("fixture_expectations", []):
        required_expectation = (
            "fixture_id",
            "expected_state",
            "start_s",
            "deadline_s",
            "max_observation_age_s",
            "sensing_method",
            "state_machine_version",
        )
        missing_expectation = [key for key in required_expectation if expectation.get(key) is None]
        if missing_expectation:
            raise ValueError(f"fixture expectation is missing: {', '.join(missing_expectation)}")
        fixture_id = str(expectation["fixture_id"])
        start = float(expectation["start_s"])
        deadline = float(expectation["deadline_s"])
        max_age = float(expectation["max_observation_age_s"])
        eligible = [
            sample
            for sample in samples
            if start <= float(sample["timestamp_s"]) <= deadline
            and fixture_id in sample.get("fixture_state", {})
        ]
        if not eligible:
            continue
        observed_sample = eligible[-1]
        observed_at = float(observed_sample["timestamp_s"])
        observation_age = deadline - observed_at
        if observation_age > max_age:
            continue
        observed = observed_sample["fixture_state"][fixture_id]
        expected = expectation["expected_state"]
        if observed == expected:
            continue
        span = TemporalSpan(start, deadline, clock)
        fixture_payload = {
            "fixture_id": fixture_id,
            "expected_state": expected,
            "observed_state": observed,
            "deadline_s": deadline,
            "observed_at_s": observed_at,
            "observation_age_s": observation_age,
            "max_observation_age_s": max_age,
            "sensing_method": expectation.get("sensing_method", "unspecified"),
            "state_machine_version": expectation.get("state_machine_version"),
        }
        evidence.append(
            _telemetry_envelope(
                run=run,
                evidence_type=EvidenceType.FIXTURE_STATE,
                source_record_id=f"{run['run_id']}:fixture:{fixture_id}:{deadline:g}",
                phase=_phase(expectation.get("phase") or run.get("phase")),
                span=span,
                claim=f"fixture {fixture_id} was {observed!r}, not expected state {expected!r}, at its deadline",
                provenance=ProvenanceKind.DERIVED,
                payload=fixture_payload,
            )
        )

    for label in run.get("manual_labels", []):
        if not label.get("label_id") or not label.get("taxonomy_label") or not label.get("annotator_role"):
            raise ValueError("manual labels require label_id, taxonomy_label, and annotator_role")
        span = TemporalSpan(float(label["start_s"]), float(label["end_s"]), clock)
        label_payload = {
            "taxonomy_label": label["taxonomy_label"],
            "annotator_role": label["annotator_role"],
            "annotator_id": label.get("annotator_id"),
            "notes": label.get("notes"),
            "review_state": label.get("review_state", "unreviewed"),
        }
        evidence.append(
            _telemetry_envelope(
                run=run,
                evidence_type=EvidenceType.MANUAL_LABEL,
                source_record_id=str(label["label_id"]),
                phase=_phase(label.get("phase") or run.get("phase")),
                span=span,
                claim=f"a {label['annotator_role']} labeled this interval {label['taxonomy_label']}",
                provenance=ProvenanceKind.MANUAL,
                confidence=float(label["confidence"]) if label.get("confidence") is not None else None,
                payload=label_payload,
            )
        )

    return evidence


def _failure_type(evidence: EvidenceEnvelope) -> str:
    if evidence.evidence_type is EvidenceType.MOTOR_CURRENT_EVENT:
        return "resistance_or_stall_candidate"
    if evidence.evidence_type is EvidenceType.TRAJECTORY_ERROR:
        return "tracking_deviation_candidate"
    if evidence.evidence_type is EvidenceType.FIXTURE_STATE:
        return "fixture_state_mismatch"
    if evidence.evidence_type is EvidenceType.MANUAL_LABEL:
        return f"manual_assertion:{evidence.payload['taxonomy_label']}"
    raise ValueError(f"evidence type cannot produce a failure claim: {evidence.evidence_type}")


def build_failure_claims(evidence: Sequence[EvidenceEnvelope]) -> list[FailureClaim]:
    """Build candidate claims and cross-signal corroboration, never confirmation."""

    failure_evidence_types = {
        EvidenceType.MOTOR_CURRENT_EVENT,
        EvidenceType.TRAJECTORY_ERROR,
        EvidenceType.FIXTURE_STATE,
        EvidenceType.MANUAL_LABEL,
    }
    eligible = [
        item
        for item in evidence
        if item.source_system is SourceSystem.I2RT
        and item.evidence_type in failure_evidence_types
        and item.span is not None
    ]
    claims: list[FailureClaim] = []
    for item in eligible:
        item_span = item.span
        assert item_span is not None
        limitations = {
            EvidenceType.MOTOR_CURRENT_EVENT: (
                "high current can reflect intended contact or load; it does not identify root cause",
            ),
            EvidenceType.TRAJECTORY_ERROR: (
                "tracking error does not distinguish collision, saturation, control tuning, or bad commands",
            ),
            EvidenceType.FIXTURE_STATE: (
                "fixture sensors report the instrumented state only and may be stale or misconfigured",
            ),
            EvidenceType.MANUAL_LABEL: (
                "a manual label is an attributed assertion, not independent sensor truth",
            ),
        }[item.evidence_type]
        identity = {"type": _failure_type(item), "evidence": [item.evidence_id]}
        claims.append(
            FailureClaim(
                failure_id=_stable_id("failure", identity),
                failure_type=_failure_type(item),
                task_id=item.task_id,
                phase=item.phase,
                span=item_span,
                status=ClaimStatus.CANDIDATE,
                evidence_ids=(item.evidence_id,),
                rationale=item.claim,
                limitations=limitations,
            )
        )

    machine_types = {
        EvidenceType.MOTOR_CURRENT_EVENT,
        EvidenceType.TRAJECTORY_ERROR,
        EvidenceType.FIXTURE_STATE,
    }
    for index, left in enumerate(eligible):
        for right in eligible[index + 1 :]:
            left_span = left.span
            right_span = right.span
            assert left_span is not None and right_span is not None
            if (
                left.task_id != right.task_id
                or left.payload.get("run_id") != right.payload.get("run_id")
                or left.evidence_type == right.evidence_type
                or left.evidence_type not in machine_types
                or right.evidence_type not in machine_types
                or not left_span.overlaps(right_span)
            ):
                continue
            start, end = min(left_span.start_s, right_span.start_s), max(left_span.end_s, right_span.end_s)
            evidence_ids = tuple(sorted((left.evidence_id, right.evidence_id)))
            identity = {"type": "multi_signal_execution_anomaly", "evidence": evidence_ids}
            claims.append(
                FailureClaim(
                    failure_id=_stable_id("failure", identity),
                    failure_type="multi_signal_execution_anomaly",
                    task_id=left.task_id,
                    phase=left.phase if left.phase == right.phase else TemporalPhase.UNKNOWN,
                    span=TemporalSpan(start, end, left_span.clock),
                    status=ClaimStatus.CORROBORATED,
                    evidence_ids=evidence_ids,
                    rationale="two different instrumented signals overlap in time",
                    limitations=(
                        "temporal correlation strengthens anomaly evidence but still does not prove semantic cause",
                    ),
                )
            )
    return claims
