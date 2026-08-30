import test from "node:test";
import assert from "node:assert/strict";

import { compileCollectionJob, scoreSubmission } from "../src/index.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

test("failure compilation is deterministic and normalizes set-like fields", () => {
  const failure = {
    failureId: "failure-17",
    evidenceHash: HASH_A,
    observedAt: "2026-08-29T21:00:00Z",
    embodiment: "arm-v2",
    task: "place-cup-on-rack",
    failingPredicate: "cup_pose_error_mm > 20",
    expectedOutcome: "cup retained by rack",
    observedOutcome: "cup slipped after release",
    baselineArtifactHash: HASH_B,
  };
  const policy = {
    successPredicate: "cup_pose_error_mm <= 20 && retained_for_ms >= 3000",
    safetyEnvelope: ["force_n <= 30", "speed_mps <= 0.5"],
    modalities: ["wrist_rgb", "actions", "joint_state"],
    requiredAnnotations: ["slip_onset", "object_pose"],
    minimumEpisodeCount: 120,
    maximumEpisodeDurationMs: 30_000,
    distributionAxes: [
      { name: "cup_material", buckets: ["glass", "ceramic"] },
      { name: "lighting", buckets: ["backlit", "diffuse"] },
    ],
    license: "capy-training-v1",
    rubricVersion: "rack-placement/1",
    acceptanceThresholdBps: 8_000,
    duplicatePolicy: "exact-reject-near-quarantine/1",
    metric: "held_out_success_rate_bps",
    holdoutCommitmentHash: HASH_C,
    minimumDetectableLiftBps: 300,
  };

  const first = compileCollectionJob(failure, policy);
  const second = compileCollectionJob(failure, {
    ...policy,
    modalities: [...policy.modalities].reverse(),
    safetyEnvelope: [...policy.safetyEnvelope].reverse(),
    distributionAxes: [...policy.distributionAxes].reverse(),
  });

  assert.equal(first.job.jobId, second.job.jobId);
  assert.equal(first.commitmentHash, second.commitmentHash);
  assert.match(first.job.jobId, /^job_[a-f0-9]{32}$/);
});

test("quality gates before scarcity and near duplicates are quarantined", () => {
  const rubric = {
    acceptanceThresholdBps: 8_000,
    nearDuplicateThresholdBps: 9_500,
    qualityWeights: { sensorHealth: 2, taskIntegrity: 3 },
    scarcityWeights: { bucketGap: 1, transitionNovelty: 1 },
  };
  const signals = {
    provenanceVerified: true,
    rightsVerified: true,
    evaluatorLeakSuspected: false,
    exactDuplicateOf: null,
    nearDuplicateOf: "episode-older",
    nearDuplicateSimilarityBps: 9_700,
    quality: { sensorHealth: 9_000, taskIntegrity: 8_000 },
    scarcity: { bucketGap: 10_000, transitionNovelty: 6_000 },
  };

  assert.deepEqual(scoreSubmission(signals, rubric), {
    qualityBps: 8_400,
    scarcityBps: 8_000,
    status: "quarantined",
    reasons: ["near_duplicate_review"],
  });

  const lowQuality = scoreSubmission(
    { ...signals, nearDuplicateOf: null, quality: { sensorHealth: 2_000, taskIntegrity: 2_000 } },
    rubric,
  );
  assert.equal(lowQuality.status, "rejected");
  assert.ok(lowQuality.reasons.includes("quality_below_threshold"));
  assert.equal(lowQuality.scarcityBps, 8_000);
});
