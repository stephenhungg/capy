import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { calculatePayoutManifest } from "../src/index.js";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ADDRESS_A = "11111111111111111111111111111111";
const ADDRESS_B = "So11111111111111111111111111111111111111112";
const ADDRESS_C = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

function fixture() {
  return {
    bountyId: "bounty-rack-17",
    capabilityReceiptId: "receipt-rack-17-candidate-3",
    protocolHash: "sha256:protocol-registered-before-collection",
    settlement: {
      network: "devnet",
      tokenProgram: TOKEN_PROGRAM,
      mint: MINT,
      sourceTokenAccount: ADDRESS_C,
      decimals: 6,
    },
    funding: {
      totalAtomic: "1000000",
      poolBps: { acceptance: 3000, performance: 5000, reuse: 1000, disputeReserve: 1000 },
    },
    contributions: [
      {
        allocationId: "allocation-a",
        contributionId: "contribution-a",
        contributorId: "contributor-a",
        payoutAddress: ADDRESS_A,
        cohortId: "cohort-01",
        contentHash: "sha256:episode-a",
        acceptedUnits: 2,
        qualityBps: 9000,
        scarcityBps: 5000,
        reuseCreditBps: 10000,
      },
      {
        allocationId: "allocation-b",
        contributionId: "contribution-b",
        contributorId: "contributor-b",
        payoutAddress: ADDRESS_B,
        cohortId: "cohort-01",
        contentHash: "sha256:episode-b",
        acceptedUnits: 1,
        qualityBps: 8000,
        scarcityBps: 10000,
        reuseCreditBps: 0,
      },
      {
        allocationId: "allocation-c",
        contributionId: "contribution-c",
        contributorId: "contributor-c",
        payoutAddress: ADDRESS_C,
        cohortId: "cohort-02",
        contentHash: "sha256:episode-c",
        acceptedUnits: 1,
        qualityBps: 10000,
        scarcityBps: 2500,
        reuseCreditBps: 5000,
      },
    ],
    evaluation: {
      holdoutCommitmentHash: "sha256:hidden-holdout",
      evaluatorCommitmentHash: "sha256:evaluator-container-and-seed",
      aggregate: {
        candidateScoreBps: 6200,
        baselineScoreBps: 5000,
        uncertaintyBps: 200,
        minimumLiftBps: 300,
        targetLiftBps: 2000,
      },
      cohorts: [
        { cohortId: "cohort-01", fullScoreBps: 6200, withoutCohortScoreBps: 5800, uncertaintyBps: 100 },
        { cohortId: "cohort-02", fullScoreBps: 6200, withoutCohortScoreBps: 6100, uncertaintyBps: 100 },
      ],
    },
  };
}

test("cohort lift deterministically unlocks and reconciles a Solana payout manifest", () => {
  const input = fixture();
  const first = calculatePayoutManifest(input);
  const reordered = calculatePayoutManifest({
    ...input,
    contributions: [...input.contributions].reverse(),
    evaluation: { ...input.evaluation, cohorts: [...input.evaluation.cohorts].reverse() },
  });

  assert.equal(first.manifestId, reordered.manifestId);
  assert.equal(first.canonicalJson, reordered.canonicalJson);
  assert.equal(first.calculation.aggregateLowerBoundLiftBps, 1000);
  assert.equal(first.calculation.earnedPerformanceAtomic, "250000");
  assert.deepEqual(first.calculation.cohortLowerBoundLiftBps, { "cohort-01": 300, "cohort-02": 0 });
  assert.equal(first.calculation.paidAtomic, "650000");
  assert.equal(first.calculation.withheldAtomic, "350000");
  assert.equal(first.transfers.reduce((sum, transfer) => sum + BigInt(transfer.amountAtomic), 0n), 650000n);
  assert.ok(
    first.transfers
      .flatMap((transfer) => transfer.lineItems)
      .filter((item) => item.pool === "performance")
      .every((item) => item.contributionId !== "contribution-c"),
  );
  assert.deepEqual(first.withheld, {
    amountAtomic: "350000",
    includesDisputeReserveAtomic: "100000",
    includesUnearnedPerformanceAtomic: "250000",
    includesUnallocatedAcceptanceAtomic: "0",
    includesUnallocatedPerformanceAtomic: "0",
    includesUnallocatedReuseAtomic: "0",
    disposition: "remain_in_escrow_pending_dispute_window_or_future_authorized_manifest",
  });
});

test("failed lift withholds the full performance pool", () => {
  const input = fixture();
  input.evaluation.aggregate = {
    ...input.evaluation.aggregate,
    candidateScoreBps: 5300,
    uncertaintyBps: 100,
    minimumLiftBps: 300,
  };
  const manifest = calculatePayoutManifest(input);

  assert.equal(manifest.calculation.aggregateLowerBoundLiftBps, 200);
  assert.equal(manifest.calculation.earnedPerformanceAtomic, "0");
  assert.equal(manifest.withheld.includesUnearnedPerformanceAtomic, "500000");
});

test("zero eligible weights remain explicitly unallocated in escrow", () => {
  const input = fixture();
  input.contributions = input.contributions.map((contribution) => ({
    ...contribution,
    qualityBps: 0,
    reuseCreditBps: 0,
  }));
  const manifest = calculatePayoutManifest(input);
  const explainedWithheld = Object.entries(manifest.withheld)
    .filter(([name]) => name.startsWith("includes"))
    .reduce((sum, [, amount]) => sum + BigInt(amount), 0n);

  assert.equal(manifest.calculation.paidAtomic, "0");
  assert.equal(manifest.withheld.includesUnallocatedAcceptanceAtomic, "300000");
  assert.equal(manifest.withheld.includesUnallocatedPerformanceAtomic, "250000");
  assert.equal(manifest.withheld.includesUnallocatedReuseAtomic, "100000");
  assert.equal(explainedWithheld, BigInt(manifest.withheld.amountAtomic));
});

test("duplicate content cannot enter payout under different contributor ids", () => {
  const input = fixture();
  input.contributions[1].contentHash = input.contributions[0].contentHash;
  assert.throws(() => calculatePayoutManifest(input), /duplicate content hash/);
});

test("every contribution requires an attribution allocation id", () => {
  const input = fixture();
  delete input.contributions[0].allocationId;
  assert.throws(() => calculatePayoutManifest(input), /contribution\.allocationId must be a non-empty string/);
});

test("shared wallets preserve one transfer per attribution allocation", () => {
  const input = fixture();
  input.contributions[1].payoutAddress = input.contributions[0].payoutAddress;
  const manifest = calculatePayoutManifest(input);

  const sharedWalletTransfers = manifest.transfers.filter(
    (transfer) => transfer.recipientOwner === input.contributions[0].payoutAddress,
  );
  assert.equal(sharedWalletTransfers.length, 2);
  assert.deepEqual(
    sharedWalletTransfers.map((transfer) => transfer.allocationId),
    ["allocation-a", "allocation-b"],
  );
  assert.notEqual(sharedWalletTransfers[0].transferId, sharedWalletTransfers[1].transferId);
});

test("compatible contributions in one attribution allocation group into one transfer", () => {
  const input = fixture();
  input.contributions.push({
    ...input.contributions[0],
    contributionId: "contribution-a-continued",
    contentHash: "sha256:episode-a-continued",
    acceptedUnits: 1,
  });
  const manifest = calculatePayoutManifest(input);
  const reordered = calculatePayoutManifest({ ...input, contributions: [...input.contributions].reverse() });
  const transfer = manifest.transfers.find((candidate) => candidate.allocationId === "allocation-a");

  assert.equal(manifest.manifestId, reordered.manifestId);
  assert.equal(manifest.canonicalJson, reordered.canonicalJson);
  assert.ok(transfer);
  assert.equal(manifest.transfers.filter((candidate) => candidate.allocationId === "allocation-a").length, 1);
  assert.deepEqual(
    [...new Set(transfer.lineItems.map((item) => item.contributionId))].sort(),
    ["contribution-a", "contribution-a-continued"],
  );
  assert.equal(transfer.contributorId, "contributor-a");
  assert.equal(transfer.cohortId, "cohort-01");
});

test("an attribution allocation cannot cross contributor, cohort, or wallet identities", () => {
  for (const [field, value] of [
    ["contributorId", "different-contributor"],
    ["cohortId", "cohort-02"],
    ["payoutAddress", ADDRESS_B],
  ]) {
    const input = fixture();
    input.contributions.push({
      ...input.contributions[0],
      contributionId: `contribution-mismatch-${field}`,
      contentHash: `sha256:episode-mismatch-${field}`,
      [field]: value,
    });

    assert.throws(
      () => calculatePayoutManifest(input),
      /allocation allocation-a must use one contributor, cohort, and payout address/,
      field,
    );
  }
});

test("allocation-aware transfer grouping conserves every paid and withheld atom", () => {
  const input = fixture();
  input.contributions[1].payoutAddress = input.contributions[0].payoutAddress;
  input.contributions.push({
    ...input.contributions[0],
    contributionId: "contribution-a-continued",
    contentHash: "sha256:episode-a-continued",
    acceptedUnits: 3,
  });
  const manifest = calculatePayoutManifest(input);
  const paid = manifest.transfers.reduce((sum, transfer) => sum + BigInt(transfer.amountAtomic), 0n);
  const lineItems = manifest.transfers
    .flatMap((transfer) => transfer.lineItems)
    .reduce((sum, lineItem) => sum + BigInt(lineItem.amountAtomic), 0n);

  assert.equal(paid, BigInt(manifest.calculation.paidAtomic));
  assert.equal(lineItems, paid);
  assert.equal(paid + BigInt(manifest.calculation.withheldAtomic), BigInt(manifest.calculation.totalAtomic));
});

test("manifest schema is versioned and covers the emitted top-level contract", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schema/payout-manifest.schema.json", import.meta.url), "utf8"),
  );
  const manifest = calculatePayoutManifest(fixture());

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(manifest.schemaVersion, schema.properties.schemaVersion.const);
  for (const property of schema.required) assert.ok(Object.hasOwn(manifest, property), property);
  const transferSchema = schema.properties.transfers.items;
  for (const transfer of manifest.transfers) {
    for (const property of transferSchema.required) assert.ok(Object.hasOwn(transfer, property), property);
  }
});
