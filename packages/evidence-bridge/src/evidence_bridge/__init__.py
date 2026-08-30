"""Capy's source-neutral evidence bridge."""

from .adapters import (
    I2RTThresholds,
    adapt_i2rt_telemetry,
    adapt_vima_episode,
    adapt_world_context_prior,
    build_failure_claims,
)
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
    to_dict,
)

__all__ = [
    "Citation",
    "ClaimStatus",
    "EvidenceEnvelope",
    "EvidenceType",
    "FailureClaim",
    "I2RTThresholds",
    "ProvenanceKind",
    "SourceSystem",
    "TemporalPhase",
    "TemporalSpan",
    "adapt_i2rt_telemetry",
    "adapt_vima_episode",
    "adapt_world_context_prior",
    "build_failure_claims",
    "to_dict",
]
