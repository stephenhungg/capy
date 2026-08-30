"""Taxonomy shared by evidence sources without flattening their semantics."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from math import isfinite
from typing import Any, Mapping


class SourceSystem(StrEnum):
    WORLD_CONTEXT = "world_context"
    VIMA = "vima"
    I2RT = "i2rt"


class EvidenceType(StrEnum):
    TASK_WORKFLOW_PRIOR = "task_workflow_prior"
    CITED_VIDEO_MEMORY = "cited_video_memory"
    MOTOR_CURRENT_EVENT = "motor_current_event"
    TRAJECTORY_ERROR = "trajectory_error"
    FIXTURE_STATE = "fixture_state"
    MANUAL_LABEL = "manual_label"


class ProvenanceKind(StrEnum):
    OBSERVED = "observed"
    DERIVED = "derived"
    MANUAL = "manual"
    APPROVED_PROCEDURE = "approved_procedure"


class TemporalPhase(StrEnum):
    SETUP = "setup"
    APPROACH = "approach"
    ENGAGE = "engage"
    EXECUTE = "execute"
    INSPECT = "inspect"
    RECOVER = "recover"
    COMPLETE = "complete"
    UNKNOWN = "unknown"


class ClaimStatus(StrEnum):
    CANDIDATE = "candidate"
    CORROBORATED = "corroborated"
    CONFIRMED = "confirmed"


@dataclass(frozen=True, slots=True)
class TemporalSpan:
    start_s: float
    end_s: float
    clock: str = "source_relative"

    def __post_init__(self) -> None:
        if not isfinite(self.start_s) or not isfinite(self.end_s):
            raise ValueError("timestamps must be finite")
        if self.start_s < 0 or self.end_s < self.start_s:
            raise ValueError("timestamps must satisfy 0 <= start_s <= end_s")
        if not self.clock:
            raise ValueError("clock is required")

    def overlaps(self, other: "TemporalSpan") -> bool:
        return self.clock == other.clock and self.start_s <= other.end_s and other.start_s <= self.end_s


@dataclass(frozen=True, slots=True)
class Citation:
    uri: str
    media_kind: str
    span: TemporalSpan | None = None
    frame_reference: str | None = None
    sha256: str | None = None

    def __post_init__(self) -> None:
        if not self.uri:
            raise ValueError("citation uri is required")
        if self.media_kind == "video" and self.span is None and self.frame_reference is None:
            raise ValueError("video citations require a time span or frame reference")


@dataclass(frozen=True, slots=True)
class EvidenceEnvelope:
    evidence_id: str
    source_system: SourceSystem
    evidence_type: EvidenceType
    source_record_id: str
    task_id: str
    phase: TemporalPhase
    claim: str
    provenance: ProvenanceKind
    camera_required: bool
    span: TemporalSpan | None = None
    confidence: float | None = None
    citations: tuple[Citation, ...] = ()
    payload: Mapping[str, Any] = field(default_factory=dict)
    schema_version: str = "capy.evidence.v1"

    def __post_init__(self) -> None:
        if not self.evidence_id or not self.source_record_id or not self.task_id or not self.claim:
            raise ValueError("evidence id, source record id, task id, and claim are required")
        if self.confidence is not None and not 0 <= self.confidence <= 1:
            raise ValueError("confidence must be in [0, 1]")
        if self.source_system is SourceSystem.VIMA:
            if self.evidence_type is not EvidenceType.CITED_VIDEO_MEMORY:
                raise ValueError("vima is admitted only as cited video memory")
            if not self.camera_required:
                raise ValueError("vima video memory must require a camera-bearing source")
            if not any(c.media_kind == "video" for c in self.citations):
                raise ValueError("vima evidence requires a video citation")
        if self.source_system is SourceSystem.I2RT and self.camera_required:
            raise ValueError("the i2rt telemetry adapter must not require cameras")
        if (
            self.source_system is SourceSystem.WORLD_CONTEXT
            and self.evidence_type is not EvidenceType.TASK_WORKFLOW_PRIOR
        ):
            raise ValueError("world context enters this bridge as task/workflow prior")


@dataclass(frozen=True, slots=True)
class FailureClaim:
    failure_id: str
    failure_type: str
    task_id: str
    phase: TemporalPhase
    span: TemporalSpan
    status: ClaimStatus
    evidence_ids: tuple[str, ...]
    rationale: str
    limitations: tuple[str, ...]
    schema_version: str = "capy.failure-claim.v1"

    def __post_init__(self) -> None:
        if not self.failure_id or not self.failure_type or not self.evidence_ids:
            raise ValueError("failure id, type, and supporting evidence are required")
        if self.status is ClaimStatus.CONFIRMED:
            raise ValueError("this bridge cannot automatically confirm semantic failures")


def to_dict(value: Any) -> dict[str, Any]:
    """Return JSON-compatible dataclass data, preserving enum string values."""

    return asdict(value)
