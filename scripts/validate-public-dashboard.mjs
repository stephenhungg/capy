import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getPublicDemoPresentation } from "../lib/public-demo-state.ts";

const repoRoot = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, repoRoot), "utf8"));
}

const [capability, cohort, evaluation, attribution, payout, publicProjection, dashboardSource] = await Promise.all([
  readJson("docs/protocol/examples/01-camera-free-yam-capability.json"),
  readJson("docs/protocol/examples/02-camera-free-yam-cohort.json"),
  readJson("docs/protocol/examples/03-camera-free-yam-evaluation.json"),
  readJson("docs/protocol/examples/04-camera-free-yam-attribution.json"),
  readJson("docs/protocol/examples/05-camera-free-yam-payout.json"),
  readJson("lib/public-demo-fixture.json"),
  readFile(new URL("app/dashboard/page.tsx", repoRoot), "utf8"),
]);

const successMetric = evaluation.payload.metrics.find(
  (metric) => metric.metric_id === "task_success_rate",
);
const contributorAllocation = attribution.payload.allocations.find(
  (allocation) => allocation.roles.includes("operator"),
);
const safetyMetric = evaluation.payload.metrics.find(
  (metric) => metric.metric_id === "safety_violation_rate",
);

assert.equal(cohort.payload.episode_set.episode_count, 120);
assert.equal(cohort.payload.episode_set.successful_episode_count, 113);
assert.equal(cohort.payload.quality.rejected_episode_ids.length, 0);
assert.equal(successMetric?.sample_size, 40);
assert.equal(successMetric?.baseline, "0.35");
assert.equal(successMetric?.candidate, "0.75");
assert.equal(evaluation.payload.decision.passed, true);
assert.equal(safetyMetric?.gates.every((gate) => gate.passed), true);
assert.equal(contributorAllocation?.payout_amount_base_units, "75000000");
assert.equal(contributorAllocation?.eligibility.eligible, true);
assert.equal(payout.payload.asset.symbol, "USDC");
assert.equal(payout.payload.asset.decimals, 6);
assert.equal(payout.payload.settlement.state, "planned");
assert.equal(payout.payload.settlement.transactions.length, 0);

const expectedProjection = {
  job: {
    title: capability.payload.title,
    summary: capability.payload.summary,
    embodiment: `${capability.payload.embodiment.manufacturer} ${capability.payload.embodiment.model} right arm`,
    capture: "camera-free · fixed geometry",
  },
  submission: {
    episodes: cohort.payload.episode_set.episode_count,
    successfulEpisodes: cohort.payload.episode_set.successful_episode_count,
    rejectedEpisodes: cohort.payload.quality.rejected_episode_ids.length,
    cameraStreams: cohort.payload.privacy.camera_free ? 0 : null,
    topicsPresent: cohort.payload.quality.required_topics_present,
    monotonicTimestamps: cohort.payload.quality.timestamp_monotonicity,
    alignmentP95Ms: cohort.payload.quality.action_state_alignment_ms_p95,
  },
  evaluation: {
    baseline: `${Math.round(Number(successMetric.baseline) * 100)}%`,
    candidate: `${Math.round(Number(successMetric.candidate) * 100)}%`,
    liftPercentagePoints: Math.round(Number(successMetric.absolute_delta) * 100),
    trials: successMetric.sample_size,
    safetyViolations: evaluation.payload.safety.violation_count,
    passed: evaluation.payload.decision.passed && safetyMetric.gates.every((gate) => gate.passed),
  },
  payout: {
    contributorEligible: contributorAllocation.eligibility.eligible,
    contributorSharePercent: contributorAllocation.weight_ppm / 10_000,
    projectedAmount: (Number(contributorAllocation.payout_amount_base_units) / 10 ** payout.payload.asset.decimals).toFixed(2),
    poolAmount: (Number(attribution.payload.payout_pool.amount_base_units) / 10 ** payout.payload.asset.decimals).toFixed(2),
    asset: payout.payload.asset.symbol,
    network: `Solana ${payout.payload.cluster.name}`,
    state: payout.payload.settlement.state,
    transactions: payout.payload.settlement.transactions.length,
  },
};

assert.deepEqual(publicProjection, expectedProjection);

const failedPresentation = getPublicDemoPresentation({
  evaluationPassed: false,
  contributorEligible: true,
  payoutState: "planned",
});
assert.equal(failedPresentation.headline, "your submission needs review.");
assert.equal(failedPresentation.payoutVisible, false);
assert.equal(failedPresentation.lifecycle[2].state, "current");
assert.equal(failedPresentation.lifecycle[4].label, "payout locked");

const passingPresentation = getPublicDemoPresentation({
  evaluationPassed: true,
  contributorEligible: true,
  payoutState: "planned",
});
assert.equal(passingPresentation.headline, "your submission passed review.");
assert.equal(passingPresentation.payoutVisible, true);
assert.equal(passingPresentation.lifecycle[4].label, "payout planned");

const forbiddenDashboardPatterns = [
  [/^[\s\S]*["']use client["']/, "client component"],
  [/\bfetch\s*\(/, "network fetch"],
  [/<form\b/i, "form"],
  [/["']use server["']/, "server action"],
  [/\bonClick\s*=/, "click handler"],
  [/\/api\//, "api mutation path"],
  [/wallet address/i, "wallet address"],
];

for (const [pattern, label] of forbiddenDashboardPatterns) {
  assert.doesNotMatch(dashboardSource, pattern, `public dashboard must not contain ${label}`);
}

assert.match(dashboardSource, /<button type="button" disabled>/);
assert.match(dashboardSource, /synthetic fixture only/);
assert.match(dashboardSource, /aria-current=\{step\.state === "current" \? "step" : undefined\}/);

console.log("public dashboard projection and read-only boundary validated");
