import { assertSafeInteger } from "./canonical.js";

function weightedBps(values, weights, name) {
  const fields = Object.keys(weights).sort();
  if (fields.length === 0) {
    throw new TypeError(`${name} weights cannot be empty`);
  }

  let weightedSum = 0n;
  let totalWeight = 0n;
  for (const field of fields) {
    const weight = weights[field];
    const value = values[field];
    assertSafeInteger(weight, `${name}.weights.${field}`, 0, 10_000);
    assertSafeInteger(value, `${name}.values.${field}`, 0, 10_000);
    weightedSum += BigInt(weight) * BigInt(value);
    totalWeight += BigInt(weight);
  }
  if (totalWeight === 0n) {
    throw new TypeError(`${name} weights must contain a positive value`);
  }
  return Number(weightedSum / totalWeight);
}

export function scoreSubmission(signals, rubric) {
  assertSafeInteger(rubric.acceptanceThresholdBps, "acceptanceThresholdBps", 0, 10_000);
  assertSafeInteger(rubric.nearDuplicateThresholdBps, "nearDuplicateThresholdBps", 0, 10_000);
  if (signals.nearDuplicateOf) {
    assertSafeInteger(signals.nearDuplicateSimilarityBps, "nearDuplicateSimilarityBps", 0, 10_000);
  }

  const qualityBps = weightedBps(signals.quality, rubric.qualityWeights, "quality");
  const scarcityBps = weightedBps(signals.scarcity, rubric.scarcityWeights, "scarcity");
  const reasons = [];

  if (!signals.provenanceVerified) reasons.push("provenance_unverified");
  if (!signals.rightsVerified) reasons.push("rights_unverified");
  if (signals.evaluatorLeakSuspected) reasons.push("evaluator_leak_suspected");
  if (signals.exactDuplicateOf) reasons.push("exact_duplicate");
  if (qualityBps < rubric.acceptanceThresholdBps) reasons.push("quality_below_threshold");

  let status = reasons.length === 0 ? "accepted" : "rejected";
  if (
    status === "accepted" &&
    signals.nearDuplicateOf &&
    signals.nearDuplicateSimilarityBps >= rubric.nearDuplicateThresholdBps
  ) {
    status = "quarantined";
    reasons.push("near_duplicate_review");
  }

  return { qualityBps, scarcityBps, status, reasons };
}
