import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getPublicDemoPresentation } from "../lib/public-demo-state.ts";

const repoRoot = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, repoRoot), "utf8"));
}

const [cohort, evaluation, attribution, payout, dashboardSource] = await Promise.all([
  readJson("docs/protocol/examples/02-camera-free-yam-cohort.json"),
  readJson("docs/protocol/examples/03-camera-free-yam-evaluation.json"),
  readJson("docs/protocol/examples/04-camera-free-yam-attribution.json"),
  readJson("docs/protocol/examples/05-camera-free-yam-payout.json"),
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
