import {
  assertNonEmpty,
  assertSafeInteger,
  canonicalize,
  deterministicId,
  sha256Hex,
} from "./canonical.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function assertHash(value, name) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new TypeError(`${name} must be a lowercase sha-256 hex digest`);
  }
}

export function compileCollectionJob(failure, policy) {
  for (const field of [
    "failureId",
    "observedAt",
    "embodiment",
    "task",
    "failingPredicate",
    "expectedOutcome",
    "observedOutcome",
  ]) {
    assertNonEmpty(failure[field], `failure.${field}`);
  }
  assertHash(failure.evidenceHash, "failure.evidenceHash");
  assertHash(failure.baselineArtifactHash, "failure.baselineArtifactHash");
  assertHash(policy.holdoutCommitmentHash, "policy.holdoutCommitmentHash");
  assertSafeInteger(policy.minimumEpisodeCount, "policy.minimumEpisodeCount", 1);
  assertSafeInteger(policy.maximumEpisodeDurationMs, "policy.maximumEpisodeDurationMs", 1);
  assertSafeInteger(policy.acceptanceThresholdBps, "policy.acceptanceThresholdBps", 0, 10_000);
  assertSafeInteger(policy.minimumDetectableLiftBps, "policy.minimumDetectableLiftBps", 0, 10_000);

  if (!Array.isArray(policy.modalities) || policy.modalities.length === 0) {
    throw new TypeError("policy.modalities cannot be empty");
  }
  if (!Array.isArray(policy.distributionAxes) || policy.distributionAxes.length === 0) {
    throw new TypeError("policy.distributionAxes cannot be empty");
  }

  const specification = {
    schemaVersion: "capy.collection-job/0.1",
    sourceFailure: {
      failureId: failure.failureId,
      evidenceHash: failure.evidenceHash,
      observedAt: failure.observedAt,
      failingPredicate: failure.failingPredicate,
      expectedOutcome: failure.expectedOutcome,
      observedOutcome: failure.observedOutcome,
    },
    capability: {
      embodiment: failure.embodiment,
      task: failure.task,
      successPredicate: policy.successPredicate,
      safetyEnvelope: [...policy.safetyEnvelope].sort(),
    },
    request: {
      modalities: [...policy.modalities].sort(),
      requiredAnnotations: [...policy.requiredAnnotations].sort(),
      minimumEpisodeCount: policy.minimumEpisodeCount,
      maximumEpisodeDurationMs: policy.maximumEpisodeDurationMs,
      distributionAxes: policy.distributionAxes
        .map((axis) => ({ name: axis.name, buckets: [...axis.buckets].sort() }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      license: policy.license,
    },
    acceptance: {
      rubricVersion: policy.rubricVersion,
      acceptanceThresholdBps: policy.acceptanceThresholdBps,
      duplicatePolicy: policy.duplicatePolicy,
    },
    evaluation: {
      metric: policy.metric,
      baselineArtifactHash: failure.baselineArtifactHash,
      holdoutCommitmentHash: policy.holdoutCommitmentHash,
      minimumDetectableLiftBps: policy.minimumDetectableLiftBps,
    },
  };

  const jobId = deterministicId("job", specification);
  const job = { ...specification, jobId };
  return {
    job,
    canonicalJson: canonicalize(job),
    commitmentHash: sha256Hex(job),
  };
}
