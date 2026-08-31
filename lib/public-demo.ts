import "server-only";

import attributionFixture from "@/docs/protocol/examples/04-camera-free-yam-attribution.json";
import capabilityFixture from "@/docs/protocol/examples/01-camera-free-yam-capability.json";
import cohortFixture from "@/docs/protocol/examples/02-camera-free-yam-cohort.json";
import evaluationFixture from "@/docs/protocol/examples/03-camera-free-yam-evaluation.json";
import payoutFixture from "@/docs/protocol/examples/05-camera-free-yam-payout.json";

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`public demo fixture is missing ${label}`);
  return value;
}

function percent(value: string): string {
  return `${Math.round(Number(value) * 100)}%`;
}

function tokenAmount(baseUnits: string, decimals: number): string {
  return (Number(baseUnits) / 10 ** decimals).toFixed(2);
}

const successMetric = required(
  evaluationFixture.payload.metrics.find((metric) => metric.metric_id === "task_success_rate"),
  "task success metric",
);
const safetyMetric = required(
  evaluationFixture.payload.metrics.find((metric) => metric.metric_id === "safety_violation_rate"),
  "safety metric",
);
const contributorAllocation = required(
  attributionFixture.payload.allocations.find((allocation) => allocation.roles.includes("operator")),
  "contributor allocation",
);
const payoutDecimals = payoutFixture.payload.asset.decimals;

if (!cohortFixture.payload.privacy.camera_free) {
  throw new Error("public demo fixture must remain camera-free");
}

/**
 * A deliberately small, public projection of the canonical synthetic fixtures.
 * Internal ids, people, wallets, artifact locations, digests, and timestamps stay out.
 */
export const publicDemo = {
  job: {
    title: capabilityFixture.payload.title,
    summary: capabilityFixture.payload.summary,
    embodiment: `${capabilityFixture.payload.embodiment.manufacturer} ${capabilityFixture.payload.embodiment.model} right arm`,
    capture: "camera-free · fixed geometry",
  },
  submission: {
    episodes: cohortFixture.payload.episode_set.episode_count,
    successfulEpisodes: cohortFixture.payload.episode_set.successful_episode_count,
    rejectedEpisodes: cohortFixture.payload.quality.rejected_episode_ids.length,
    cameraStreams: 0,
    topicsPresent: cohortFixture.payload.quality.required_topics_present,
    monotonicTimestamps: cohortFixture.payload.quality.timestamp_monotonicity,
    alignmentP95Ms: cohortFixture.payload.quality.action_state_alignment_ms_p95,
  },
  evaluation: {
    baseline: percent(successMetric.baseline),
    candidate: percent(successMetric.candidate),
    liftPercentagePoints: Math.round(Number(successMetric.absolute_delta) * 100),
    trials: successMetric.sample_size,
    safetyViolations: evaluationFixture.payload.safety.violation_count,
    passed: evaluationFixture.payload.decision.passed && safetyMetric.gates.every((gate) => gate.passed),
  },
  payout: {
    contributorEligible: contributorAllocation.eligibility.eligible,
    contributorSharePercent: contributorAllocation.weight_ppm / 10_000,
    projectedAmount: tokenAmount(contributorAllocation.payout_amount_base_units, payoutDecimals),
    poolAmount: tokenAmount(attributionFixture.payload.payout_pool.amount_base_units, payoutDecimals),
    asset: payoutFixture.payload.asset.symbol,
    network: `Solana ${payoutFixture.payload.cluster.name}`,
    state: payoutFixture.payload.settlement.state,
    transactions: payoutFixture.payload.settlement.transactions.length,
  },
} as const;
