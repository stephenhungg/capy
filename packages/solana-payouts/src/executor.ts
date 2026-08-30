import { createHash } from "node:crypto";
import {
  assertIsFullySignedTransaction,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  signTransaction,
  type KeyPairSigner,
  type Transaction
} from "@solana/kit";
import {
  MAX_COMPUTE_UNITS,
  MAX_LEGACY_TRANSACTION_BYTES,
  MAX_TRANSACTION_ACCOUNTS,
  USDC_DECIMALS
} from "./constants.js";
import {
  buildBatchTransaction,
  getPlanHash,
  transactionMetrics,
  type PayoutBatch,
  type PayoutPlan
} from "./plan.js";
import {
  assertOriginalTokenProgram,
  type PayoutRpc,
  type RpcSignatureStatus
} from "./rpc.js";
import {
  assertStateIdentity,
  createPayoutState,
  type BatchStatus,
  type BatchJournal,
  type PayoutStateV1,
  type StateIdentity,
  type StateStore
} from "./state.js";

function stateIdentity(plan: PayoutPlan): StateIdentity {
  return {
    manifestId: plan.manifest.manifest.manifest_id,
    manifestHash: plan.manifest.manifestHash,
    planHash: getPlanHash(plan),
    network: plan.manifest.manifest.network,
    mint: plan.manifest.mint,
    treasuryAuthority: plan.treasuryAuthority,
    sourceTokenAccount: plan.sourceTokenAccount,
    feePayer: plan.feePayer
  };
}

export async function loadOrCreateState(
  plan: PayoutPlan,
  store: StateStore
): Promise<PayoutStateV1> {
  const identity = stateIdentity(plan);
  const existing = await store.load();
  if (existing) {
    assertStateIdentity(existing, identity);
    return existing;
  }
  const state = createPayoutState(identity);
  await store.save(state);
  return state;
}

function signingKeys(authority: KeyPairSigner, feePayer: KeyPairSigner): CryptoKeyPair[] {
  return authority.address === feePayer.address
    ? [authority.keyPair]
    : [feePayer.keyPair, authority.keyPair];
}

async function signPayoutTransaction(
  transaction: Transaction,
  authority: KeyPairSigner,
  feePayer: KeyPairSigner
): Promise<Transaction> {
  return signTransaction(signingKeys(authority, feePayer), transaction);
}

function rawTransactionIdentity(raw: Uint8Array): { signature: string; sha256: string } {
  const transaction = getTransactionDecoder().decode(raw);
  assertIsFullySignedTransaction(transaction);
  return {
    signature: getSignatureFromTransaction(transaction),
    sha256: createHash("sha256").update(raw).digest("hex")
  };
}

export function verifyJournalIntegrity(journal: BatchJournal): Transaction {
  const raw = Buffer.from(journal.raw_transaction_base64, "base64");
  const transaction = getTransactionDecoder().decode(raw);
  assertIsFullySignedTransaction(transaction);
  const compiledMessage = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if (compiledMessage.lifetimeToken !== journal.blockhash) {
    throw new Error(`journal integrity failure for batch ${journal.batch_id}: blockhash mismatch`);
  }
  const identity = rawTransactionIdentity(raw);
  if (identity.sha256 !== journal.raw_transaction_sha256) {
    throw new Error(`journal integrity failure for batch ${journal.batch_id}: transaction hash mismatch`);
  }
  if (identity.signature !== journal.signature) {
    throw new Error(`journal integrity failure for batch ${journal.batch_id}: signature mismatch`);
  }
  return transaction;
}

function applySignatureStatus(
  journal: BatchJournal,
  status: RpcSignatureStatus | null,
  currentBlockHeight: bigint,
  now = new Date()
): void {
  if (journal.status === "finalized") return;
  if (status?.err) {
    journal.status = "failed";
    journal.error = JSON.stringify(status.err).slice(0, 1_000);
    return;
  }
  if (status?.confirmationStatus === "finalized") {
    journal.status = "finalized";
    journal.finalized_at = now.toISOString();
    delete journal.error;
    return;
  }
  if (status !== null) {
    journal.status = "submitted";
    return;
  }
  if (currentBlockHeight > BigInt(journal.last_valid_block_height)) {
    journal.status = "expired_unknown";
    journal.error =
      "signature was not found after blockhash expiry; verify with an archival rpc before authorizing a replacement";
  }
}

function assertJournalMatchesBatch(journal: BatchJournal, batch: PayoutBatch): void {
  const expectedPayoutIds = batch.payouts.map((payout) => payout.payoutId);
  if (
    journal.index !== batch.index ||
    journal.amount_base_units !== batch.amountBaseUnits.toString() ||
    journal.payout_ids.length !== expectedPayoutIds.length ||
    journal.payout_ids.some((payoutId, index) => payoutId !== expectedPayoutIds[index])
  ) {
    throw new Error(`journal metadata does not match planned batch ${batch.batchId}`);
  }
}

export async function reconcileState(
  rpc: PayoutRpc,
  state: PayoutStateV1,
  store: StateStore
): Promise<PayoutStateV1> {
  if (state.batches.length === 0) return state;
  for (const journal of state.batches) verifyJournalIntegrity(journal);
  const [statuses, currentBlockHeight] = await Promise.all([
    rpc.getSignatureStatuses(state.batches.map((batch) => batch.signature)),
    rpc.getBlockHeight()
  ]);
  state.batches.forEach((journal, index) => {
    applySignatureStatus(journal, statuses[index] ?? null, currentBlockHeight);
  });
  await store.save(state);
  return state;
}

export async function preflightPlan(
  rpc: PayoutRpc,
  plan: PayoutPlan,
  state: PayoutStateV1
): Promise<void> {
  const finalizedBatchIds = new Set(
    state.batches.filter((batch) => batch.status === "finalized").map((batch) => batch.batch_id)
  );
  const outstandingBatches = plan.batches.filter((batch) => !finalizedBatchIds.has(batch.batchId));
  if (outstandingBatches.length === 0) return;

  const [mint, sourceAccounts] = await Promise.all([
    rpc.getMintAccount(plan.manifest.mint),
    rpc.getTokenAccounts([plan.sourceTokenAccount])
  ]);
  if (!mint) throw new Error("allowlisted USDC mint account was not found");
  assertOriginalTokenProgram(mint.programAddress);
  if (mint.decimals !== USDC_DECIMALS) {
    throw new Error(`USDC mint decimals mismatch: expected ${USDC_DECIMALS}, got ${mint.decimals}`);
  }
  const source = sourceAccounts[0];
  if (!source?.exists) throw new Error("treasury source token account was not found");
  if (!source.programAddress || !source.mint || !source.owner || source.amount === undefined) {
    throw new Error("treasury source token account response was incomplete");
  }
  assertOriginalTokenProgram(source.programAddress);
  if (source.mint !== plan.manifest.mint) {
    throw new Error("treasury source token account does not hold the allowlisted USDC mint");
  }
  if (source.owner !== plan.treasuryAuthority) {
    throw new Error("treasury authority is not the owner of the source token account");
  }
  const outstandingAmount = outstandingBatches.reduce(
    (sum, batch) => sum + batch.amountBaseUnits,
    0n
  );
  if (source.amount < outstandingAmount) {
    throw new Error(
      `insufficient treasury USDC: need ${outstandingAmount} base units, have ${source.amount}`
    );
  }

  const recipientAddresses = [
    ...new Map(
      outstandingBatches
        .flatMap((batch) => batch.payouts)
        .map((payout) => [payout.recipientTokenAccount, payout.recipientTokenAccount])
    ).values()
  ];
  const recipientAccounts = await rpc.getTokenAccounts(recipientAddresses);
  let missingRecipientAccounts = 0;
  recipientAccounts.forEach((account, index) => {
    if (!account.exists) {
      missingRecipientAccounts += 1;
      return;
    }
    if (!account.programAddress || !account.mint) {
      throw new Error(`recipient ATA ${recipientAddresses[index]} response was incomplete`);
    }
    assertOriginalTokenProgram(account.programAddress);
    if (account.mint !== plan.manifest.mint) {
      throw new Error(`recipient ATA ${recipientAddresses[index]} has the wrong mint`);
    }
  });

  const [latest, rentPerAta, feePayerBalance] = await Promise.all([
    rpc.getLatestBlockhash("confirmed"),
    rpc.getTokenAccountRent(),
    rpc.getBalance(plan.feePayer)
  ]);
  let transactionFees = 0n;
  for (const batch of outstandingBatches) {
    const transaction = buildBatchTransaction(plan, batch, {
      recentBlockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      computeUnitLimit: MAX_COMPUTE_UNITS
    });
    const fee = await rpc.getFeeForTransaction(transaction);
    if (fee === null) throw new Error("rpc could not estimate a payout transaction fee");
    transactionFees += fee;
  }
  const requiredLamports = BigInt(missingRecipientAccounts) * rentPerAta + transactionFees;
  if (feePayerBalance < requiredLamports) {
    throw new Error(
      `fee payer needs at least ${requiredLamports} lamports for fees and ATA rent, has ${feePayerBalance}`
    );
  }
}

function makeJournal(
  batch: PayoutBatch,
  transaction: Transaction,
  blockhashValue: string,
  lastValidBlockHeight: bigint,
  computeUnitLimit: number,
  now = new Date()
): BatchJournal {
  const rawBase64 = getBase64EncodedWireTransaction(transaction);
  const raw = Buffer.from(rawBase64, "base64");
  const identity = rawTransactionIdentity(raw);
  return {
    batch_id: batch.batchId,
    index: batch.index,
    payout_ids: batch.payouts.map((payout) => payout.payoutId),
    amount_base_units: batch.amountBaseUnits.toString(),
    raw_transaction_base64: rawBase64,
    raw_transaction_sha256: identity.sha256,
    signature: identity.signature,
    blockhash: blockhashValue,
    last_valid_block_height: lastValidBlockHeight.toString(),
    compute_unit_limit: computeUnitLimit,
    status: "prepared",
    attempts: 0,
    prepared_at: now.toISOString()
  };
}

async function prepareBatch(
  rpc: PayoutRpc,
  plan: PayoutPlan,
  batch: PayoutBatch,
  authority: KeyPairSigner,
  feePayer: KeyPairSigner
): Promise<BatchJournal> {
  const latest = await rpc.getLatestBlockhash("finalized");
  const simulationUnsigned = buildBatchTransaction(plan, batch, {
    recentBlockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    computeUnitLimit: MAX_COMPUTE_UNITS
  });
  const simulationTransaction = await signPayoutTransaction(
    simulationUnsigned,
    authority,
    feePayer
  );
  const simulation = await rpc.simulateTransaction(simulationTransaction);
  if (simulation.err) {
    throw new Error(`batch ${batch.batchId} simulation failed: ${JSON.stringify(simulation.err)}`);
  }
  if (simulation.unitsConsumed === undefined) {
    throw new Error(`batch ${batch.batchId} simulation did not report compute consumption`);
  }
  const computeUnitLimit = Math.min(
    MAX_COMPUTE_UNITS,
    Math.max(50_000, Math.ceil(Number(simulation.unitsConsumed) * 1.1))
  );
  const unsigned = buildBatchTransaction(plan, batch, {
    recentBlockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    computeUnitLimit
  });
  const transaction = await signPayoutTransaction(unsigned, authority, feePayer);
  const metrics = transactionMetrics(transaction);
  if (metrics.bytes > MAX_LEGACY_TRANSACTION_BYTES || metrics.accountCount > MAX_TRANSACTION_ACCOUNTS) {
    throw new Error(`batch ${batch.batchId} exceeds Solana legacy transaction limits after signing`);
  }
  return makeJournal(
    batch,
    transaction,
    latest.blockhash,
    latest.lastValidBlockHeight,
    computeUnitLimit
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function submitJournaledBatch(
  rpc: PayoutRpc,
  journal: BatchJournal,
  state: PayoutStateV1,
  store: StateStore,
  confirmationPolls: number,
  confirmationPollIntervalMs: number
): Promise<void> {
  const transaction = verifyJournalIntegrity(journal);
  const [statuses, currentBlockHeight] = await Promise.all([
    rpc.getSignatureStatuses([journal.signature]),
    rpc.getBlockHeight()
  ]);
  applySignatureStatus(journal, statuses[0] ?? null, currentBlockHeight);
  await store.save(state);
  if (journal.status === "finalized") return;
  if (journal.status === "failed" || journal.status === "expired_unknown") {
    throw new Error(`batch ${journal.batch_id} is ${journal.status}: ${journal.error ?? "review required"}`);
  }

  journal.status = "submitted";
  journal.attempts += 1;
  journal.last_submitted_at = new Date().toISOString();
  await store.save(state);
  const returnedSignature = await rpc.sendTransaction(transaction);
  if (returnedSignature !== journal.signature) {
    throw new Error("rpc returned a signature that does not match the journaled transaction");
  }

  for (let poll = 0; poll < confirmationPolls; poll += 1) {
    if (poll > 0) await sleep(confirmationPollIntervalMs);
    const [currentStatuses, height] = await Promise.all([
      rpc.getSignatureStatuses([journal.signature]),
      rpc.getBlockHeight()
    ]);
    applySignatureStatus(journal, currentStatuses[0] ?? null, height);
    const currentStatus = journal.status as BatchStatus;
    if (currentStatus === "finalized") {
      await store.save(state);
      return;
    }
    if (currentStatus === "failed" || currentStatus === "expired_unknown") {
      await store.save(state);
      throw new Error(`batch ${journal.batch_id} is ${journal.status}: ${journal.error ?? "review required"}`);
    }
  }
  await store.save(state);
  throw new Error(
    `batch ${journal.batch_id} remains submitted; run reconcile before any replacement attempt`
  );
}

export interface ExecuteOptions {
  readonly authority: KeyPairSigner;
  readonly feePayer: KeyPairSigner;
  readonly confirmationPolls?: number;
  readonly confirmationPollIntervalMs?: number;
}

export async function executePayoutPlan(
  rpc: PayoutRpc,
  plan: PayoutPlan,
  store: StateStore,
  options: ExecuteOptions
): Promise<PayoutStateV1> {
  if (options.authority.address !== plan.treasuryAuthority) {
    throw new Error("treasury signer does not match the planned treasury authority");
  }
  if (options.feePayer.address !== plan.feePayer) {
    throw new Error("fee-payer signer does not match the planned fee payer");
  }
  const confirmationPolls = options.confirmationPolls ?? 30;
  const confirmationPollIntervalMs = options.confirmationPollIntervalMs ?? 1_000;

  const state = await loadOrCreateState(plan, store);
  await reconcileState(rpc, state, store);
  await preflightPlan(rpc, plan, state);
  for (const batch of plan.batches) {
    let journal = state.batches.find((candidate) => candidate.batch_id === batch.batchId);
    if (!journal) {
      journal = await prepareBatch(rpc, plan, batch, options.authority, options.feePayer);
      state.batches.push(journal);
      await store.save(state);
    }
    assertJournalMatchesBatch(journal, batch);
    await submitJournaledBatch(
      rpc,
      journal,
      state,
      store,
      confirmationPolls,
      confirmationPollIntervalMs
    );
  }
  return state;
}

export function stateToSettlementJson(plan: PayoutPlan, state: PayoutStateV1): object {
  const journals = new Map(state.batches.map((batch) => [batch.batch_id, batch]));
  return {
    schema: "capy.payout-settlement.v1",
    manifest_id: plan.manifest.manifest.manifest_id,
    manifest_hash: plan.manifest.manifestHash,
    plan_hash: state.plan_hash,
    network: plan.manifest.manifest.network,
    mint: plan.manifest.mint,
    batches: plan.batches.map((batch) => {
      const journal = journals.get(batch.batchId);
      return {
        batch_id: batch.batchId,
        status: journal?.status ?? "not_prepared",
        transaction_signature: journal?.signature ?? null,
        payouts: batch.payouts.map((payout) => ({ payout_id: payout.payoutId }))
      };
    }),
    receipt_attachments: plan.batches.flatMap((batch) => {
      const journal = journals.get(batch.batchId);
      return batch.payouts.map((payout) => ({
        payout_id: payout.payoutId,
        transaction_signature: journal?.signature ?? null,
        settlement_status: journal?.status ?? "not_prepared"
      }));
    })
  };
}

export function stateToReconciliationJson(state: PayoutStateV1): object {
  return {
    schema: "capy.payout-settlement.v1",
    manifest_id: state.manifest_id,
    manifest_hash: state.manifest_hash,
    plan_hash: state.plan_hash,
    network: state.network,
    mint: state.mint,
    batches: state.batches.map((batch) => ({
      batch_id: batch.batch_id,
      status: batch.status,
      transaction_signature: batch.signature,
      payouts: batch.payout_ids.map((payoutId) => ({ payout_id: payoutId }))
    })),
    receipt_attachments: state.batches.flatMap((batch) =>
      batch.payout_ids.map((payoutId) => ({
        payout_id: payoutId,
        transaction_signature: batch.signature,
        settlement_status: batch.status
      }))
    )
  };
}
