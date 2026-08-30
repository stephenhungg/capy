"""Adapt the canonical camera-free i2rt edge journal into protocol projections.

The recorder journal is the source of truth.  This module validates its actual
``manifest.json`` and ``events.ndjson`` contract, computes digests over the
source bytes, and projects bounded lifecycle evidence without copying frame
arrays or inventing ROS, camera, or semantic-success fields.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .taxonomy import (
    Citation,
    EvidenceEnvelope,
    EvidenceType,
    ProvenanceKind,
    SourceSystem,
    TemporalPhase,
    TemporalSpan,
)

I2RT_PROFILE = "capy.i2rt.camera_free.v1"
I2RT_JOURNAL_FORMAT = "capy.ndjson.camera_free.v1"
_CAMERA_KEYS = {
    "camera",
    "cameras",
    "image",
    "images",
    "rgb",
    "video",
    "videos",
}
_EVENT_TYPES = {
    "session_start",
    "session_end",
    "episode_start",
    "episode_end",
    "frame",
    "intervention",
    "safety_event",
    "clock_issue",
}
_OUTCOMES = {"success", "failure", "aborted", "invalid"}
_CAPTURE_QUALITIES = {"control_cycle", "best_effort", "synthetic_fixture"}


@dataclass(frozen=True, slots=True)
class SourceJournalDigests:
    """Byte digests copied directly into the protocol ``source_journal`` field."""

    manifest_digest: str
    events_digest: str
    format: str = I2RT_JOURNAL_FORMAT

    def __post_init__(self) -> None:
        if self.format != I2RT_JOURNAL_FORMAT:
            raise ValueError(f"unsupported i2rt journal format: {self.format!r}")
        for name, value in (
            ("manifest_digest", self.manifest_digest),
            ("events_digest", self.events_digest),
        ):
            if len(value) != 71 or not value.startswith("sha256:"):
                raise ValueError(f"{name} must be a sha256: digest")
            try:
                int(value[7:], 16)
            except ValueError as exc:
                raise ValueError(f"{name} must be a sha256: digest") from exc


@dataclass(frozen=True, slots=True)
class I2RTEpisodeProjection:
    """Protocol-ready episode-manifest row derived from one completed episode."""

    episode_id: str
    session_id: str
    task_id: str
    task_instruction: str
    geometry_id: str
    operator_id: str
    phase: TemporalPhase
    outcome: str
    outcome_reason: str
    outcome_notes: str
    start_sequence: int
    end_sequence: int
    first_frame_sequence: int
    last_frame_sequence: int
    start_monotonic_time_ns: int
    end_monotonic_time_ns: int
    start_wall_time_ns: int
    end_wall_time_ns: int
    duration_ns: int
    frame_count: int
    capture_quality: Mapping[str, int]
    intervention_event_count: int
    safety_event_count: int
    clock_issue_count: int
    interventions_active_at_end: tuple[str, ...]
    safety_events_active_at_end: tuple[str, ...]
    evidence_ids: tuple[str, ...]
    source_uri: str
    source_journal: SourceJournalDigests
    camera_streams: tuple[str, ...] = ()
    schema_version: str = "capy.i2rt.episode-projection.v1"

    def __post_init__(self) -> None:
        if self.outcome not in _OUTCOMES:
            raise ValueError(f"unsupported i2rt outcome: {self.outcome!r}")
        if self.frame_count <= 0:
            raise ValueError("a projected i2rt episode must contain at least one frame")
        if self.duration_ns < 0:
            raise ValueError("episode duration cannot be negative")
        if self.camera_streams:
            raise ValueError(
                "camera-free i2rt projections cannot contain camera streams"
            )


@dataclass(frozen=True, slots=True)
class I2RTJournalProjection:
    """Validated source lineage plus protocol-ready episode and evidence rows."""

    session_id: str
    source_uri: str
    source_journal: SourceJournalDigests
    episodes: tuple[I2RTEpisodeProjection, ...]
    evidence: tuple[EvidenceEnvelope, ...]
    topics: tuple[str, ...]
    episode_ids_digest: str
    successful_episode_count: int
    profile: str = I2RT_PROFILE
    message_encoding: str = "json"
    schema_encoding: str = "jsonschema"
    clock_basis: str = "system_time"
    canonical_time: str = "recorder_monotonic_time_ns"
    camera_streams: tuple[str, ...] = ()
    schema_version: str = "capy.i2rt.journal-projection.v1"

    @property
    def episode_count(self) -> int:
        return len(self.episodes)

    def __post_init__(self) -> None:
        if not self.episodes:
            raise ValueError(
                "an i2rt journal projection requires at least one completed episode"
            )
        if self.profile != I2RT_PROFILE:
            raise ValueError(f"unsupported i2rt profile: {self.profile!r}")
        if self.camera_streams:
            raise ValueError(
                "camera-free i2rt projections cannot contain camera streams"
            )


@dataclass(slots=True)
class _EpisodeBuilder:
    start_event: Mapping[str, Any]
    task_id: str
    phase: TemporalPhase
    frame_sequences: list[int] = field(default_factory=list)
    capture_quality: Counter[str] = field(default_factory=Counter)
    intervention_sequences: list[int] = field(default_factory=list)
    safety_sequences: list[int] = field(default_factory=list)
    clock_issue_sequences: list[int] = field(default_factory=list)
    evidence_ids: list[str] = field(default_factory=list)
    active_interventions: set[str] = field(default_factory=set)
    active_safety_events: set[str] = field(default_factory=set)


def _sha256_bytes(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _stable_id(prefix: str, value: Mapping[str, Any]) -> str:
    encoded = json.dumps(
        value, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")
    return f"{prefix}_{hashlib.sha256(encoded).hexdigest()[:16]}"


def _as_mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"{label} must be an object")
    return value


def _required_string(
    value: Mapping[str, Any], key: str, label: str, *, allow_empty: bool = False
) -> str:
    item = value.get(key)
    if not isinstance(item, str) or (not allow_empty and not item):
        qualifier = "a string" if allow_empty else "a non-empty string"
        raise ValueError(f"{label}.{key} must be {qualifier}")
    return item


def _required_bool(value: Mapping[str, Any], key: str, label: str) -> bool:
    item = value.get(key)
    if not isinstance(item, bool):
        raise TypeError(f"{label}.{key} must be a boolean")
    return item


def _required_int(value: Mapping[str, Any], key: str, label: str) -> int:
    item = value.get(key)
    if type(item) is not int or item < 0:
        raise ValueError(f"{label}.{key} must be a non-negative integer")
    return item


def _string_tuple(value: Any, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item for item in value
    ):
        raise ValueError(f"{label} must be an array of non-empty strings")
    if len(set(value)) != len(value):
        raise ValueError(f"{label} must not contain duplicates")
    return tuple(value)


def _find_camera_key(value: Any, path: str = "payload") -> str | None:
    if isinstance(value, Mapping):
        for key, item in value.items():
            normalized = str(key).lower().replace("_", ".").split(".")
            if any(part in _CAMERA_KEYS for part in normalized):
                return f"{path}.{key}"
            found = _find_camera_key(item, f"{path}.{key}")
            if found:
                return found
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found = _find_camera_key(item, f"{path}[{index}]")
            if found:
                return found
    return None


def _load_journal(
    raw_root: Path,
) -> tuple[Mapping[str, Any], list[Mapping[str, Any]], SourceJournalDigests]:
    manifest_path = raw_root / "manifest.json"
    events_path = raw_root / "events.ndjson"
    try:
        manifest_bytes = manifest_path.read_bytes()
        events_bytes = events_path.read_bytes()
    except OSError as exc:
        raise ValueError(f"cannot read i2rt source journal: {exc}") from exc
    try:
        manifest = json.loads(manifest_bytes)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid i2rt manifest.json: {exc}") from exc
    if not isinstance(manifest, Mapping):
        raise TypeError("i2rt manifest.json must contain an object")

    events: list[Mapping[str, Any]] = []
    try:
        text = events_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"invalid utf-8 in i2rt events.ndjson: {exc}") from exc
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"invalid JSON on i2rt events line {line_number}: {exc}"
            ) from exc
        if not isinstance(event, Mapping):
            raise TypeError(f"i2rt events line {line_number} must contain an object")
        events.append(event)
    return (
        manifest,
        events,
        SourceJournalDigests(
            manifest_digest=_sha256_bytes(manifest_bytes),
            events_digest=_sha256_bytes(events_bytes),
        ),
    )


def _validate_manifest(manifest: Mapping[str, Any]) -> tuple[str, int]:
    if manifest.get("schema_version") != I2RT_PROFILE:
        raise ValueError(
            f"unsupported i2rt schema_version: {manifest.get('schema_version')!r}"
        )
    if manifest.get("camera_streams") != []:
        raise ValueError("i2rt manifest camera_streams must be an explicit empty list")
    camera_key = _find_camera_key(
        {key: value for key, value in manifest.items() if key != "camera_streams"},
        "manifest",
    )
    if camera_key:
        raise ValueError(f"i2rt manifest contains forbidden camera field {camera_key}")
    session_id = _required_string(manifest, "session_id", "manifest")
    capture_contract = _as_mapping(
        manifest.get("capture_contract"), "manifest.capture_contract"
    )
    if capture_contract.get("canonical_time") != "recorder_monotonic_time_ns":
        raise ValueError(
            "i2rt manifest must use recorder_monotonic_time_ns as canonical time"
        )
    robot = _as_mapping(manifest.get("robot"), "manifest.robot")
    joint_names = _string_tuple(robot.get("joint_names"), "manifest.robot.joint_names")
    motor_ids = robot.get("motor_ids")
    if not isinstance(motor_ids, list) or len(motor_ids) != len(joint_names):
        raise ValueError("manifest.robot.motor_ids length must match joint_names")
    if any(type(item) is not int for item in motor_ids) or len(set(motor_ids)) != len(
        motor_ids
    ):
        raise ValueError("manifest.robot.motor_ids must contain unique integers")
    return session_id, len(joint_names)


def _validate_numeric_array(value: Any, expected_size: int, label: str) -> None:
    if not isinstance(value, list) or len(value) != expected_size:
        raise ValueError(f"{label} must contain {expected_size} values")
    if any(
        isinstance(item, bool)
        or not isinstance(item, (int, float))
        or not math.isfinite(item)
        for item in value
    ):
        raise ValueError(f"{label} must contain finite numeric values")


def _validate_frame(
    payload: Mapping[str, Any],
    *,
    sequence: int,
    joint_count: int,
    builder: _EpisodeBuilder,
) -> str:
    label = f"frame {sequence} payload"
    quality = _required_string(payload, "capture_quality", label)
    if quality not in _CAPTURE_QUALITIES:
        raise ValueError(
            f"frame {sequence} has unsupported capture_quality {quality!r}"
        )
    command = _as_mapping(payload.get("command"), f"{label}.command")
    measured = _as_mapping(payload.get("measured"), f"{label}.measured")
    for key in (
        "position",
        "velocity",
        "feedforward_torque",
        "kp",
        "kd",
        "applied_torque",
    ):
        _validate_numeric_array(command.get(key), joint_count, f"{label}.command.{key}")
    for key in ("position", "velocity", "effort", "temp_mos_c", "temp_rotor_c"):
        _validate_numeric_array(
            measured.get(key), joint_count, f"{label}.measured.{key}"
        )
    codes = measured.get("motor_error_code")
    if (
        not isinstance(codes, list)
        or len(codes) != joint_count
        or any(type(item) is not int or not 0 <= item <= 15 for item in codes)
    ):
        raise ValueError(
            f"{label}.measured.motor_error_code must contain {joint_count} 4-bit integers"
        )
    messages = measured.get("motor_error_message")
    if (
        not isinstance(messages, list)
        or len(messages) != joint_count
        or any(not isinstance(item, str) for item in messages)
    ):
        raise ValueError(
            f"{label}.measured.motor_error_message must contain {joint_count} strings"
        )
    _required_bool(measured, "chain_running", f"{label}.measured")
    _required_string(command, "source", f"{label}.command")
    _required_string(command, "mode", f"{label}.command")
    health = _as_mapping(payload.get("clock_health"), f"{label}.clock_health")
    _required_bool(health, "healthy", f"{label}.clock_health")
    _as_mapping(payload.get("controller"), f"{label}.controller")

    interventions = _string_tuple(
        payload.get("active_interventions"), f"{label}.active_interventions"
    )
    safety_events = _string_tuple(
        payload.get("active_safety_events"), f"{label}.active_safety_events"
    )
    if interventions != tuple(sorted(builder.active_interventions)):
        raise ValueError(
            f"frame {sequence} active_interventions do not match prior intervention events"
        )
    if safety_events != tuple(sorted(builder.active_safety_events)):
        raise ValueError(
            f"frame {sequence} active_safety_events do not match prior safety events"
        )
    if _required_bool(payload, "intervention_active", label) != bool(interventions):
        raise ValueError(
            f"frame {sequence} intervention_active disagrees with active_interventions"
        )
    if _required_bool(payload, "safety_active", label) != bool(safety_events):
        raise ValueError(
            f"frame {sequence} safety_active disagrees with active_safety_events"
        )
    return quality


def _phase_for_episode(
    phases_by_episode: Mapping[str, str] | None, episode_id: str
) -> TemporalPhase:
    value = (phases_by_episode or {}).get(episode_id, TemporalPhase.UNKNOWN.value)
    try:
        return TemporalPhase(value)
    except ValueError as exc:
        raise ValueError(
            f"unknown temporal phase for episode {episode_id}: {value!r}"
        ) from exc


def _journal_evidence(
    *,
    event: Mapping[str, Any],
    builder: _EpisodeBuilder,
    session_id: str,
    source_uri: str,
    source_journal: SourceJournalDigests,
    evidence_type: EvidenceType,
    claim: str,
    provenance: ProvenanceKind,
) -> EvidenceEnvelope:
    sequence = int(event["sequence"])
    episode_id = str(event["episode_id"])
    start_ns = int(builder.start_event["recorder_monotonic_time_ns"])
    event_ns = int(event["recorder_monotonic_time_ns"])
    relative_s = (event_ns - start_ns) / 1_000_000_000
    clock = f"recorder_monotonic_relative:{session_id}:{episode_id}"
    payload = {
        "session_id": session_id,
        "episode_id": episode_id,
        "source_event_sequence": sequence,
        "source_event_type": event["event_type"],
        "source_journal": {
            "format": source_journal.format,
            "manifest_digest": source_journal.manifest_digest,
            "events_digest": source_journal.events_digest,
        },
        "event": dict(_as_mapping(event["payload"], f"event {sequence} payload")),
    }
    identity = {
        "source_uri": source_uri,
        "task_id": builder.task_id,
        "phase": builder.phase.value,
        "evidence_type": evidence_type.value,
        **payload,
    }
    span = TemporalSpan(relative_s, relative_s, clock)
    return EvidenceEnvelope(
        evidence_id=_stable_id("ev_i2rt_journal", identity),
        source_system=SourceSystem.I2RT,
        evidence_type=evidence_type,
        source_record_id=f"{session_id}:{sequence}",
        task_id=builder.task_id,
        phase=builder.phase,
        span=span,
        claim=claim,
        provenance=provenance,
        camera_required=False,
        citations=(
            Citation(
                uri=source_uri,
                media_kind="telemetry",
                span=span,
                sha256=source_journal.events_digest.removeprefix("sha256:"),
            ),
        ),
        payload=payload,
    )


def _episode_ids_digest(episodes: Sequence[I2RTEpisodeProjection]) -> str:
    try:
        episode_ids = sorted(
            (episode.episode_id for episode in episodes),
            key=lambda item: item.encode("utf-16-be"),
        )
    except UnicodeEncodeError as exc:
        raise ValueError("episode ids must be valid unicode scalar strings") from exc
    canonical = json.dumps(
        episode_ids, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    return _sha256_bytes(canonical)


def adapt_i2rt_journal(
    raw_root: str | Path,
    *,
    task_ids_by_episode: Mapping[str, str],
    source_uri: str,
    phases_by_episode: Mapping[str, str] | None = None,
) -> I2RTJournalProjection:
    """Validate and project a canonical camera-free i2rt source journal.

    ``task_ids_by_episode`` is deliberately required: the recorder stores an
    operator-facing instruction, not a capy protocol task id.  The adapter will
    not manufacture that semantic binding from free text.
    """

    if not source_uri:
        raise ValueError("i2rt journal projection requires an explicit source_uri")
    manifest, events, source_journal = _load_journal(Path(raw_root))
    session_id, joint_count = _validate_manifest(manifest)
    if not events:
        raise ValueError("i2rt source journal has no events")
    if events[0].get("event_type") != "session_start":
        raise ValueError("i2rt source journal must begin with session_start")
    if events[-1].get("event_type") != "session_end":
        raise ValueError("i2rt source journal is missing terminal session_end")
    if sum(event.get("event_type") == "session_start" for event in events) != 1:
        raise ValueError("i2rt source journal must contain exactly one session_start")
    if sum(event.get("event_type") == "session_end" for event in events) != 1:
        raise ValueError("i2rt source journal must contain exactly one session_end")

    active: _EpisodeBuilder | None = None
    seen_episode_ids: set[str] = set()
    projections: list[I2RTEpisodeProjection] = []
    evidence: list[EvidenceEnvelope] = []
    observed_event_types: list[str] = []
    previous_monotonic_ns: int | None = None

    for expected_sequence, event in enumerate(events):
        label = f"event {expected_sequence}"
        sequence = _required_int(event, "sequence", label)
        if sequence != expected_sequence:
            raise ValueError(
                f"i2rt source journal expected sequence {expected_sequence}, got {sequence}"
            )
        event_type = _required_string(event, "event_type", label)
        if event_type not in _EVENT_TYPES:
            raise ValueError(
                f"event {sequence} has unsupported event_type {event_type!r}"
            )
        if event_type not in observed_event_types:
            observed_event_types.append(event_type)
        monotonic_ns = _required_int(event, "recorder_monotonic_time_ns", label)
        _required_int(event, "recorder_wall_time_ns", label)
        if previous_monotonic_ns is not None and monotonic_ns < previous_monotonic_ns:
            raise ValueError(f"event {sequence} regresses recorder_monotonic_time_ns")
        previous_monotonic_ns = monotonic_ns
        payload = _as_mapping(event.get("payload"), f"event {sequence} payload")
        camera_key = _find_camera_key(payload)
        if camera_key:
            raise ValueError(
                f"event {sequence} contains forbidden camera field {camera_key}"
            )
        episode_id_value = event.get("episode_id")
        if episode_id_value is not None and (
            not isinstance(episode_id_value, str) or not episode_id_value
        ):
            raise ValueError(
                f"event {sequence}.episode_id must be null or a non-empty string"
            )

        if event_type == "session_start":
            if sequence != 0 or episode_id_value is not None or active is not None:
                raise ValueError(
                    "session_start must be the first event and outside an episode"
                )
            if (
                _required_string(payload, "session_id", "session_start payload")
                != session_id
            ):
                raise ValueError("session_start session_id does not match manifest")
            continue

        if event_type == "session_end":
            if sequence != len(events) - 1 or episode_id_value is not None:
                raise ValueError(
                    "session_end must be the final event and outside an episode"
                )
            if active is not None:
                raise ValueError(
                    f"session ended with active episode {active.start_event['episode_id']}"
                )
            if (
                "incomplete_episode_id" not in payload
                or payload["incomplete_episode_id"] is not None
            ):
                raise ValueError(
                    "terminal session_end must declare incomplete_episode_id: null"
                )
            continue

        if event_type == "episode_start":
            if active is not None:
                raise ValueError(
                    f"episode {active.start_event['episode_id']} is missing terminal episode_end"
                )
            if not isinstance(episode_id_value, str) or not episode_id_value:
                raise ValueError(f"episode_start {sequence} requires an episode_id")
            if episode_id_value in seen_episode_ids:
                raise ValueError(f"duplicate episode_id: {episode_id_value}")
            task_id = task_ids_by_episode.get(episode_id_value)
            if not isinstance(task_id, str) or not task_id:
                raise ValueError(
                    f"missing explicit protocol task id for episode {episode_id_value}"
                )
            _required_string(payload, "task", f"episode_start {sequence} payload")
            _required_string(
                payload, "geometry_id", f"episode_start {sequence} payload"
            )
            _required_string(
                payload,
                "operator_id",
                f"episode_start {sequence} payload",
                allow_empty=True,
            )
            _required_string(
                payload, "notes", f"episode_start {sequence} payload", allow_empty=True
            )
            active = _EpisodeBuilder(
                start_event=event,
                task_id=task_id,
                phase=_phase_for_episode(phases_by_episode, episode_id_value),
            )
            seen_episode_ids.add(episode_id_value)
            continue

        if active is None or episode_id_value != active.start_event["episode_id"]:
            raise ValueError(f"{event_type} {sequence} is outside its active episode")

        if event_type == "frame":
            quality = _validate_frame(
                payload, sequence=sequence, joint_count=joint_count, builder=active
            )
            active.frame_sequences.append(sequence)
            active.capture_quality[quality] += 1
            continue

        if event_type == "intervention":
            intervention_id = _required_string(
                payload, "intervention_id", f"intervention {sequence} payload"
            )
            is_active = _required_bool(
                payload, "active", f"intervention {sequence} payload"
            )
            _required_string(payload, "kind", f"intervention {sequence} payload")
            _required_string(payload, "actor", f"intervention {sequence} payload")
            _required_string(
                payload, "reason", f"intervention {sequence} payload", allow_empty=True
            )
            if is_active:
                active.active_interventions.add(intervention_id)
            else:
                active.active_interventions.discard(intervention_id)
            active.intervention_sequences.append(sequence)
            item = _journal_evidence(
                event=event,
                builder=active,
                session_id=session_id,
                source_uri=source_uri,
                source_journal=source_journal,
                evidence_type=EvidenceType.INTERVENTION_EVENT,
                claim=f"i2rt journal recorded intervention {intervention_id!r} becoming {'active' if is_active else 'inactive'}",
                provenance=ProvenanceKind.MANUAL,
            )
            evidence.append(item)
            active.evidence_ids.append(item.evidence_id)
            continue

        if event_type == "safety_event":
            code = _required_string(payload, "code", f"safety_event {sequence} payload")
            is_active = _required_bool(
                payload, "active", f"safety_event {sequence} payload"
            )
            _required_string(payload, "severity", f"safety_event {sequence} payload")
            _required_string(
                payload, "message", f"safety_event {sequence} payload", allow_empty=True
            )
            _required_string(payload, "source", f"safety_event {sequence} payload")
            motor_ids = payload.get("motor_ids")
            if not isinstance(motor_ids, list) or any(
                type(item) is not int for item in motor_ids
            ):
                raise ValueError(
                    f"safety_event {sequence} payload.motor_ids must be an integer array"
                )
            if is_active:
                active.active_safety_events.add(code)
            else:
                active.active_safety_events.discard(code)
            active.safety_sequences.append(sequence)
            item = _journal_evidence(
                event=event,
                builder=active,
                session_id=session_id,
                source_uri=source_uri,
                source_journal=source_journal,
                evidence_type=EvidenceType.SAFETY_EVENT,
                claim=f"i2rt journal recorded safety event {code!r} becoming {'active' if is_active else 'inactive'}",
                provenance=(
                    ProvenanceKind.OBSERVED
                    if payload["source"] in {"motor_feedback", "controller"}
                    else ProvenanceKind.MANUAL
                ),
            )
            evidence.append(item)
            active.evidence_ids.append(item.evidence_id)
            continue

        if event_type == "clock_issue":
            code = _required_string(payload, "code", f"clock_issue {sequence} payload")
            _required_string(payload, "severity", f"clock_issue {sequence} payload")
            _required_string(payload, "message", f"clock_issue {sequence} payload")
            active.clock_issue_sequences.append(sequence)
            item = _journal_evidence(
                event=event,
                builder=active,
                session_id=session_id,
                source_uri=source_uri,
                source_journal=source_journal,
                evidence_type=EvidenceType.CLOCK_ISSUE,
                claim=f"i2rt recorder derived clock issue {code!r} from source and recorder timestamps",
                provenance=ProvenanceKind.DERIVED,
            )
            evidence.append(item)
            active.evidence_ids.append(item.evidence_id)
            continue

        if event_type != "episode_end":
            raise AssertionError(f"unhandled i2rt event type: {event_type}")

        outcome = _required_string(
            payload, "outcome", f"episode_end {sequence} payload"
        )
        if outcome not in _OUTCOMES:
            raise ValueError(
                f"episode_end {sequence} has invalid manual outcome {outcome!r}"
            )
        reason = _required_string(
            payload, "reason", f"episode_end {sequence} payload", allow_empty=True
        )
        notes = _required_string(
            payload, "notes", f"episode_end {sequence} payload", allow_empty=True
        )
        terminal_interventions = _string_tuple(
            payload.get("interventions_active_at_end"),
            f"episode_end {sequence} payload.interventions_active_at_end",
        )
        terminal_safety = _string_tuple(
            payload.get("safety_events_active_at_end"),
            f"episode_end {sequence} payload.safety_events_active_at_end",
        )
        if terminal_interventions != tuple(sorted(active.active_interventions)):
            raise ValueError(
                f"episode_end {sequence} intervention state does not match the event journal"
            )
        if terminal_safety != tuple(sorted(active.active_safety_events)):
            raise ValueError(
                f"episode_end {sequence} safety state does not match the event journal"
            )
        if not active.frame_sequences:
            raise ValueError(f"completed episode {episode_id_value} has no frames")

        outcome_evidence = _journal_evidence(
            event=event,
            builder=active,
            session_id=session_id,
            source_uri=source_uri,
            source_journal=source_journal,
            evidence_type=EvidenceType.EPISODE_OUTCOME,
            claim=f"i2rt terminal event declared manual episode outcome {outcome!r}",
            provenance=ProvenanceKind.MANUAL,
        )
        evidence.append(outcome_evidence)
        active.evidence_ids.append(outcome_evidence.evidence_id)
        start_payload = _as_mapping(
            active.start_event["payload"], "episode_start payload"
        )
        start_monotonic_ns = int(active.start_event["recorder_monotonic_time_ns"])
        start_wall_ns = int(active.start_event["recorder_wall_time_ns"])
        end_wall_ns = int(event["recorder_wall_time_ns"])
        projections.append(
            I2RTEpisodeProjection(
                episode_id=str(episode_id_value),
                session_id=session_id,
                task_id=active.task_id,
                task_instruction=str(start_payload["task"]),
                geometry_id=str(start_payload["geometry_id"]),
                operator_id=str(start_payload["operator_id"]),
                phase=active.phase,
                outcome=outcome,
                outcome_reason=reason,
                outcome_notes=notes,
                start_sequence=int(active.start_event["sequence"]),
                end_sequence=sequence,
                first_frame_sequence=active.frame_sequences[0],
                last_frame_sequence=active.frame_sequences[-1],
                start_monotonic_time_ns=start_monotonic_ns,
                end_monotonic_time_ns=monotonic_ns,
                start_wall_time_ns=start_wall_ns,
                end_wall_time_ns=end_wall_ns,
                duration_ns=monotonic_ns - start_monotonic_ns,
                frame_count=len(active.frame_sequences),
                capture_quality=dict(sorted(active.capture_quality.items())),
                intervention_event_count=len(active.intervention_sequences),
                safety_event_count=len(active.safety_sequences),
                clock_issue_count=len(active.clock_issue_sequences),
                interventions_active_at_end=terminal_interventions,
                safety_events_active_at_end=terminal_safety,
                evidence_ids=tuple(active.evidence_ids),
                source_uri=source_uri,
                source_journal=source_journal,
            )
        )
        active = None

    if active is not None:
        raise ValueError(
            f"episode {active.start_event['episode_id']} is missing terminal episode_end"
        )
    if not projections:
        raise ValueError("i2rt source journal has no completed episodes")
    return I2RTJournalProjection(
        session_id=session_id,
        source_uri=source_uri,
        source_journal=source_journal,
        episodes=tuple(projections),
        evidence=tuple(evidence),
        topics=tuple(f"/capy/{event_type}" for event_type in observed_event_types),
        episode_ids_digest=_episode_ids_digest(projections),
        successful_episode_count=sum(item.outcome == "success" for item in projections),
    )
