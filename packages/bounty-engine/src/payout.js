import { allocateProRata } from "./allocation.js";
import {
  assertNonEmpty,
  assertSafeInteger,
  canonicalize,
  deterministicId,
  parseAtomic,
  sha256Hex,
} from "./canonical.js";
import { assertSolanaAddress } from "./solana.js";

const NETWORKS = new Set(["mainnet-beta", "devnet", "testnet", "localnet"]);
const POOL_NAMES = ["acceptance", "performance", "reuse", "disputeReserve"];

function validateInput(input) {
  assertNonEmpty(input.bountyId, "bountyId");
  assertNonEmpty(input.capabilityReceiptId, "capabilityReceiptId");
  assertNonEmpty(input.protocolHash, "protocolHash");
  assertNonEmpty(input.evaluation.holdoutCommitmentHash, "evaluation.holdoutCommitmentHash");
  assertNonEmpty(input.evaluation.evaluatorCommitmentHash, "evaluation.evaluatorCommitmentHash");
  if (!NETWORKS.has(input.settlement.network)) throw new TypeError("unsupported Solana network");
  assertSolanaAddress(input.settlement.tokenProgram, "settlement.tokenProgram");
  assertSolanaAddress(input.settlement.mint, "settlement.mint");
  assertSolanaAddress(input.settlement.sourceTokenAccount, "settlement.sourceTokenAccount");
  assertSafeInteger(input.settlement.decimals, "settlement.decimals", 0, 18);

  const poolTotal = POOL_NAMES.reduce((sum, name) => {
    assertSafeInteger(input.funding.poolBps[name], `funding.poolBps.${name}`, 0, 10_000);
    return sum + input.funding.poolBps[name];
  }, 0);
  if (poolTotal !== 10_000) throw new TypeError("funding pool bps must sum to 10000");
  parseAtomic(input.funding.totalAtomic, "funding.totalAtomic");

  const aggregate = input.evaluation.aggregate;
  for (const field of [
    "candidateScoreBps",
    "baselineScoreBps",
    "uncertaintyBps",
    "minimumLiftBps",
    "targetLiftBps",
  ]) {
    assertSafeInteger(aggregate[field], `evaluation.aggregate.${field}`, 0, 10_000);
  }
  if (aggregate.targetLiftBps === 0 || aggregate.targetLiftBps < aggregate.minimumLiftBps) {
    throw new TypeError("targetLiftBps must be positive and at least minimumLiftBps");
  }

  const contributionIds = new Set();
  const contentHashes = new Set();
  const contributorAddresses = new Map();
  if (!Array.isArray(input.contributions) || input.contributions.length === 0) {
    throw new TypeError("contributions cannot be empty");
  }
  for (const contribution of input.contributions) {
    assertNonEmpty(contribution.contributionId, "contribution.contributionId");
    assertNonEmpty(contribution.contributorId, "contribution.contributorId");
    assertNonEmpty(contribution.cohortId, "contribution.cohortId");
    assertNonEmpty(contribution.contentHash, "contribution.contentHash");
    assertSolanaAddress(contribution.payoutAddress, "contribution.payoutAddress");
    assertSafeInteger(contribution.acceptedUnits, "contribution.acceptedUnits", 1);
    assertSafeInteger(contribution.qualityBps, "contribution.qualityBps", 0, 10_000);
    assertSafeInteger(contribution.scarcityBps, "contribution.scarcityBps", 0, 10_000);
    assertSafeInteger(contribution.reuseCreditBps, "contribution.reuseCreditBps", 0, 10_000);
    if (contributionIds.has(contribution.contributionId)) {
      throw new TypeError(`duplicate contribution id: ${contribution.contributionId}`);
    }
    if (contentHashes.has(contribution.contentHash)) {
      throw new TypeError(`duplicate content hash: ${contribution.contentHash}`);
    }
    const previousAddress = contributorAddresses.get(contribution.contributorId);
    if (previousAddress && previousAddress !== contribution.payoutAddress) {
      throw new TypeError(`contributor ${contribution.contributorId} has multiple payout addresses`);
    }
    contributionIds.add(contribution.contributionId);
    contentHashes.add(contribution.contentHash);
    contributorAddresses.set(contribution.contributorId, contribution.payoutAddress);
  }
}

function poolAmounts(total, poolBps) {
  const entries = POOL_NAMES.map((name) => ({ id: name, weight: BigInt(poolBps[name]) }));
  return allocateProRata(total, entries);
}

function contributionWeight(contribution) {
  return BigInt(contribution.acceptedUnits) * BigInt(contribution.qualityBps) * BigInt(contribution.scarcityBps);
}

function addLineItem(lineItems, contributionId, pool, amount) {
  if (amount === 0n) return;
  lineItems.push({ contributionId, pool, amountAtomic: amount.toString() });
}

export function calculatePayoutManifest(input) {
  validateInput(input);
  const total = parseAtomic(input.funding.totalAtomic, "funding.totalAtomic");
  const pools = poolAmounts(total, input.funding.poolBps);
  const lineItems = [];
  const contributions = [...input.contributions].sort((a, b) => a.contributionId.localeCompare(b.contributionId));

  const acceptanceAllocation = allocateProRata(
    pools.get("acceptance"),
    contributions.map((contribution) => ({ id: contribution.contributionId, weight: contributionWeight(contribution) })),
  );
  for (const contribution of contributions) {
    addLineItem(lineItems, contribution.contributionId, "acceptance", acceptanceAllocation.get(contribution.contributionId));
  }

  const aggregate = input.evaluation.aggregate;
  const lowerBoundLiftBps = Math.max(
    0,
    aggregate.candidateScoreBps - aggregate.baselineScoreBps - aggregate.uncertaintyBps,
  );
  const performanceEligible = lowerBoundLiftBps >= aggregate.minimumLiftBps;
  const earnedPerformance = performanceEligible
    ? (pools.get("performance") * BigInt(Math.min(lowerBoundLiftBps, aggregate.targetLiftBps))) /
      BigInt(aggregate.targetLiftBps)
    : 0n;

  const cohortLift = new Map();
  for (const evaluation of [...input.evaluation.cohorts].sort((a, b) => a.cohortId.localeCompare(b.cohortId))) {
    for (const field of ["fullScoreBps", "withoutCohortScoreBps", "uncertaintyBps"]) {
      assertSafeInteger(evaluation[field], `evaluation.cohorts.${evaluation.cohortId}.${field}`, 0, 10_000);
    }
    if (cohortLift.has(evaluation.cohortId)) throw new TypeError(`duplicate cohort evaluation: ${evaluation.cohortId}`);
    cohortLift.set(
      evaluation.cohortId,
      Math.max(0, evaluation.fullScoreBps - evaluation.withoutCohortScoreBps - evaluation.uncertaintyBps),
    );
  }

  for (const contribution of contributions) {
    if (!cohortLift.has(contribution.cohortId)) {
      throw new TypeError(`missing evaluation for cohort: ${contribution.cohortId}`);
    }
  }

  const cohortAllocation = allocateProRata(
    earnedPerformance,
    [...cohortLift].map(([id, weight]) => ({ id, weight: BigInt(weight) })),
  );
  for (const [cohortId, cohortAmount] of [...cohortAllocation].sort(([a], [b]) => a.localeCompare(b))) {
    const cohortContributions = contributions.filter((contribution) => contribution.cohortId === cohortId);
    const allocation = allocateProRata(
      cohortAmount,
      cohortContributions.map((contribution) => ({ id: contribution.contributionId, weight: contributionWeight(contribution) })),
    );
    for (const contribution of cohortContributions) {
      addLineItem(lineItems, contribution.contributionId, "performance", allocation.get(contribution.contributionId));
    }
  }

  const reuseAllocation = allocateProRata(
    pools.get("reuse"),
    contributions.map((contribution) => ({
      id: contribution.contributionId,
      weight: BigInt(contribution.acceptedUnits) * BigInt(contribution.reuseCreditBps),
    })),
  );
  for (const contribution of contributions) {
    addLineItem(lineItems, contribution.contributionId, "reuse", reuseAllocation.get(contribution.contributionId));
  }

  const paidByPool = new Map(
    ["acceptance", "performance", "reuse"].map((pool) => [
      pool,
      lineItems
        .filter((item) => item.pool === pool)
        .reduce((sum, item) => sum + BigInt(item.amountAtomic), 0n),
    ]),
  );

  const contributionById = new Map(contributions.map((contribution) => [contribution.contributionId, contribution]));
  const transferMap = new Map();
  for (const item of lineItems) {
    const contribution = contributionById.get(item.contributionId);
    const transfer = transferMap.get(contribution.payoutAddress) ?? {
      recipientOwner: contribution.payoutAddress,
      amount: 0n,
      contributorIds: new Set(),
      lineItems: [],
    };
    transfer.amount += BigInt(item.amountAtomic);
    transfer.contributorIds.add(contribution.contributorId);
    transfer.lineItems.push(item);
    transferMap.set(contribution.payoutAddress, transfer);
  }

  const paid = [...transferMap.values()].reduce((sum, transfer) => sum + transfer.amount, 0n);
  const withheld = total - paid;
  const normalizedInput = {
    ...input,
    contributions,
    evaluation: {
      ...input.evaluation,
      cohorts: [...input.evaluation.cohorts].sort((a, b) => a.cohortId.localeCompare(b.cohortId)),
    },
  };
  const body = {
    schemaVersion: "capy.solana-payout-manifest/0.1",
    bountyId: input.bountyId,
    capabilityReceiptId: input.capabilityReceiptId,
    asset: {
      standard: "spl-token",
      network: input.settlement.network,
      tokenProgram: input.settlement.tokenProgram,
      mint: input.settlement.mint,
      decimals: input.settlement.decimals,
    },
    sourceTokenAccount: input.settlement.sourceTokenAccount,
    calculation: {
      totalAtomic: total.toString(),
      poolAtomic: Object.fromEntries(POOL_NAMES.map((name) => [name, pools.get(name).toString()])),
      aggregateLowerBoundLiftBps: lowerBoundLiftBps,
      earnedPerformanceAtomic: earnedPerformance.toString(),
      cohortLowerBoundLiftBps: Object.fromEntries([...cohortLift].sort(([a], [b]) => a.localeCompare(b))),
      paidAtomic: paid.toString(),
      withheldAtomic: withheld.toString(),
    },
    transfers: [...transferMap.values()]
      .sort((left, right) => left.recipientOwner.localeCompare(right.recipientOwner))
      .map((transfer) => ({
        transferId: deterministicId("transfer", {
          bountyId: input.bountyId,
          recipientOwner: transfer.recipientOwner,
          amountAtomic: transfer.amount.toString(),
        }),
        recipientOwner: transfer.recipientOwner,
        recipientTokenAccount: null,
        amountAtomic: transfer.amount.toString(),
        contributorIds: [...transfer.contributorIds].sort(),
        lineItems: transfer.lineItems.sort(
          (left, right) =>
            left.contributionId.localeCompare(right.contributionId) || left.pool.localeCompare(right.pool),
        ),
      })),
    withheld: {
      amountAtomic: withheld.toString(),
      includesDisputeReserveAtomic: pools.get("disputeReserve").toString(),
      includesUnearnedPerformanceAtomic: (pools.get("performance") - earnedPerformance).toString(),
      includesUnallocatedAcceptanceAtomic: (pools.get("acceptance") - paidByPool.get("acceptance")).toString(),
      includesUnallocatedPerformanceAtomic: (earnedPerformance - paidByPool.get("performance")).toString(),
      includesUnallocatedReuseAtomic: (pools.get("reuse") - paidByPool.get("reuse")).toString(),
      disposition: "remain_in_escrow_pending_dispute_window_or_future_authorized_manifest",
    },
    attestations: {
      protocolHash: input.protocolHash,
      holdoutCommitmentHash: input.evaluation.holdoutCommitmentHash,
      evaluatorCommitmentHash: input.evaluation.evaluatorCommitmentHash,
      inputHash: sha256Hex(normalizedInput),
    },
    execution: {
      instruction: "transferChecked",
      recipientAccountPolicy: "derive_associated_token_account_and_create_idempotently_if_missing",
      status: "unsigned",
    },
  };

  return { ...body, manifestId: deterministicId("manifest", body), canonicalJson: canonicalize(body) };
}
