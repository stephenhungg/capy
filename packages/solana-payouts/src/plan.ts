import { createHash } from "node:crypto";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction
} from "@solana-program/token";
import {
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getTransactionSize,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Transaction
} from "@solana/kit";
import {
  DEFAULT_MAX_PAYOUTS_PER_BATCH,
  MAX_COMPUTE_UNITS,
  MAX_LEGACY_TRANSACTION_BYTES,
  MAX_PRIORITY_FEE_MICRO_LAMPORTS,
  MAX_TRANSACTION_ACCOUNTS,
  USDC_DECIMALS
} from "./constants.js";
import type { ValidatedManifest, ValidatedPayout } from "./manifest.js";
import { assertProtocolAuthorizationProjection } from "./protocol.js";

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

export interface PlanOptions {
  readonly treasuryAuthority: Address;
  readonly feePayer: Address;
  readonly sourceTokenAccount?: Address;
  readonly maxPayoutsPerBatch?: number;
  readonly priorityFeeMicroLamports?: bigint;
}

export interface PlannedPayout extends ValidatedPayout {
  readonly recipientTokenAccount: Address;
}

export interface PayoutBatch {
  readonly batchId: string;
  readonly index: number;
  readonly payouts: readonly PlannedPayout[];
  readonly amountBaseUnits: bigint;
  readonly estimatedTransactionBytes: number;
  readonly accountCount: number;
}

export interface PayoutPlan {
  readonly manifest: ValidatedManifest;
  readonly treasuryAuthority: Address;
  readonly feePayer: Address;
  readonly sourceTokenAccount: Address;
  readonly priorityFeeMicroLamports: bigint;
  readonly batches: readonly PayoutBatch[];
}

export interface BuildTransactionOptions {
  readonly recentBlockhash: string;
  readonly lastValidBlockHeight: bigint;
  readonly computeUnitLimit: number;
}

export function transactionMetrics(transaction: Transaction): {
  readonly bytes: number;
  readonly accountCount: number;
} {
  try {
    const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
    return {
      bytes: getTransactionSize(transaction),
      accountCount: message.staticAccounts.length
    };
  } catch {
    return { bytes: Number.POSITIVE_INFINITY, accountCount: Number.POSITIVE_INFINITY };
  }
}

function makeBatchId(manifestHash: string, index: number, payouts: readonly PlannedPayout[]): string {
  return createHash("sha256")
    .update(`${manifestHash}:${index}:${payouts.map((payout) => payout.payoutId).join(",")}`)
    .digest("hex")
    .slice(0, 24);
}

export async function createPayoutPlan(
  manifest: ValidatedManifest,
  options: PlanOptions
): Promise<PayoutPlan> {
  const authorization = manifest.authorization;
  if (authorization.source === "protocol-payout-manifest") {
    assertProtocolAuthorizationProjection(manifest);
    if (options.treasuryAuthority !== authorization.treasuryAuthority) {
      throw new Error("treasury authority does not match the protocol payout authorization");
    }
    if (
      options.sourceTokenAccount !== undefined &&
      options.sourceTokenAccount !== authorization.sourceTokenAccount
    ) {
      throw new Error("source token account does not match the protocol payout authorization");
    }
  }
  const maxPayoutsPerBatch = options.maxPayoutsPerBatch ?? DEFAULT_MAX_PAYOUTS_PER_BATCH;
  if (!Number.isSafeInteger(maxPayoutsPerBatch) || maxPayoutsPerBatch < 1 || maxPayoutsPerBatch > 32) {
    throw new Error("maxPayoutsPerBatch must be an integer from 1 through 32");
  }
  const priorityFeeMicroLamports = options.priorityFeeMicroLamports ?? 0n;
  if (priorityFeeMicroLamports < 0n || priorityFeeMicroLamports > MAX_PRIORITY_FEE_MICRO_LAMPORTS) {
    throw new Error(
      `priority fee must be between 0 and ${MAX_PRIORITY_FEE_MICRO_LAMPORTS} micro-lamports per compute unit`
    );
  }

  const [derivedSourceTokenAccount] = await findAssociatedTokenPda({
    mint: manifest.mint,
    owner: options.treasuryAuthority,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });
  const sourceTokenAccount =
    authorization.source === "protocol-payout-manifest"
      ? authorization.sourceTokenAccount
      : (options.sourceTokenAccount ?? derivedSourceTokenAccount);
  const plannedPayouts: PlannedPayout[] = await Promise.all(
    manifest.payouts.map(async (payout) => {
      const [recipientTokenAccount] = await findAssociatedTokenPda({
        mint: manifest.mint,
        owner: payout.recipientWallet,
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      });
      if (authorization.source === "protocol-payout-manifest") {
        const authorizedTransfer = authorization.transfers.find(
          (transfer) => transfer.payoutId === payout.payoutId
        );
        if (!authorizedTransfer || authorizedTransfer.recipientTokenAccount !== recipientTokenAccount) {
          throw new Error(`recipient token account changed for payout ${payout.payoutId}`);
        }
      }
      return { ...payout, recipientTokenAccount };
    })
  );

  const basePlan: Omit<PayoutPlan, "batches"> = {
    manifest,
    treasuryAuthority: options.treasuryAuthority,
    feePayer: options.feePayer,
    sourceTokenAccount,
    priorityFeeMicroLamports
  };
  const batches: PayoutBatch[] = [];
  let current: PlannedPayout[] = [];

  const provisionalBatch = (payouts: readonly PlannedPayout[]): PayoutBatch => ({
    batchId: makeBatchId(manifest.manifestHash, batches.length, payouts),
    index: batches.length,
    payouts,
    amountBaseUnits: payouts.reduce((sum, payout) => sum + payout.amountBaseUnits, 0n),
    estimatedTransactionBytes: 0,
    accountCount: 0
  });
  const measure = (batch: PayoutBatch) =>
    transactionMetrics(
      buildBatchTransaction(
        { ...basePlan, batches: [batch] },
        batch,
        {
          recentBlockhash: PLACEHOLDER_BLOCKHASH,
          lastValidBlockHeight: 1n,
          computeUnitLimit: MAX_COMPUTE_UNITS
        }
      )
    );
  const finalize = (): void => {
    if (current.length === 0) return;
    const provisional = provisionalBatch(current);
    const metrics = measure(provisional);
    if (metrics.bytes > MAX_LEGACY_TRANSACTION_BYTES || metrics.accountCount > MAX_TRANSACTION_ACCOUNTS) {
      throw new Error(`payout ${current[0]?.payoutId ?? "unknown"} cannot fit in one transaction`);
    }
    batches.push({
      ...provisional,
      estimatedTransactionBytes: metrics.bytes,
      accountCount: metrics.accountCount
    });
    current = [];
  };

  for (const payout of plannedPayouts) {
    const candidate = [...current, payout];
    const metrics = measure(provisionalBatch(candidate));
    const exceedsLimit =
      candidate.length > maxPayoutsPerBatch ||
      metrics.bytes > MAX_LEGACY_TRANSACTION_BYTES ||
      metrics.accountCount > MAX_TRANSACTION_ACCOUNTS;
    if (exceedsLimit && current.length > 0) {
      finalize();
      current = [payout];
    } else {
      current = candidate;
    }
  }
  finalize();
  return { ...basePlan, batches };
}

export function buildBatchTransaction(
  plan: PayoutPlan,
  batch: PayoutBatch,
  options: BuildTransactionOptions
): Transaction {
  if (
    !Number.isSafeInteger(options.computeUnitLimit) ||
    options.computeUnitLimit < 1 ||
    options.computeUnitLimit > MAX_COMPUTE_UNITS
  ) {
    throw new Error(`compute unit limit must be between 1 and ${MAX_COMPUTE_UNITS}`);
  }

  const payer = createNoopSigner(plan.feePayer);
  const authority = createNoopSigner(plan.treasuryAuthority);
  const instructions = [
    getSetComputeUnitLimitInstruction({ units: options.computeUnitLimit }),
    ...(plan.priorityFeeMicroLamports > 0n
      ? [getSetComputeUnitPriceInstruction({ microLamports: plan.priorityFeeMicroLamports })]
      : []),
    ...batch.payouts.flatMap((payout) => [
      getCreateAssociatedTokenIdempotentInstruction({
        payer,
        ata: payout.recipientTokenAccount,
        owner: payout.recipientWallet,
        mint: plan.manifest.mint,
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      }),
      getTransferCheckedInstruction({
        source: plan.sourceTokenAccount,
        mint: plan.manifest.mint,
        destination: payout.recipientTokenAccount,
        authority,
        amount: payout.amountBaseUnits,
        decimals: USDC_DECIMALS
      })
    ])
  ];

  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (current) => setTransactionMessageFeePayer(plan.feePayer, current),
    (current) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash(options.recentBlockhash),
          lastValidBlockHeight: options.lastValidBlockHeight
        },
        current
      ),
    (current) => appendTransactionMessageInstructions(instructions, current)
  );
  return compileTransaction(message);
}

export function planToJson(plan: PayoutPlan): object {
  return {
    schema: "capy.payout-plan.v1",
    dry_run: true,
    manifest_id: plan.manifest.manifest.manifest_id,
    manifest_hash: plan.manifest.manifestHash,
    authorization_object_id: plan.manifest.authorization.objectId,
    authorization_digest: plan.manifest.authorization.digest,
    network: plan.manifest.manifest.network,
    mint: plan.manifest.mint,
    treasury_authority: plan.treasuryAuthority,
    source_token_account: plan.sourceTokenAccount,
    fee_payer: plan.feePayer,
    total_base_units: plan.manifest.totalBaseUnits.toString(),
    batches: plan.batches.map((batch) => ({
      batch_id: batch.batchId,
      index: batch.index,
      estimated_transaction_bytes: batch.estimatedTransactionBytes,
      account_count: batch.accountCount,
      amount_base_units: batch.amountBaseUnits.toString(),
      payouts: batch.payouts.map((payout) => ({
        payout_id: payout.payoutId,
        recipient_wallet: payout.recipientWallet,
        recipient_token_account: payout.recipientTokenAccount,
        amount_base_units: payout.amountBaseUnits.toString()
      }))
    }))
  };
}

export function getPlanHash(plan: PayoutPlan): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        manifest_hash: plan.manifest.manifestHash,
        authorization_object_id: plan.manifest.authorization.objectId,
        authorization_digest: plan.manifest.authorization.digest,
        treasury_authority: plan.treasuryAuthority,
        source_token_account: plan.sourceTokenAccount,
        fee_payer: plan.feePayer,
        priority_fee_micro_lamports: plan.priorityFeeMicroLamports.toString(),
        batches: plan.batches.map((batch) => ({
          batch_id: batch.batchId,
          payout_ids: batch.payouts.map((payout) => payout.payoutId)
        }))
      })
    )
    .digest("hex");
}

export { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS, address };
