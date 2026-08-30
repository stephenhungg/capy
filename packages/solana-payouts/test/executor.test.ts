import { createHash } from "node:crypto";
import {
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  signTransaction,
  type Address,
  type Transaction
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import { getNetworkPolicy } from "../src/constants.js";
import {
  executePayoutPlan,
  reconcileState,
  verifyJournalIntegrity
} from "../src/executor.js";
import { validateManifest } from "../src/manifest.js";
import {
  buildBatchTransaction,
  createPayoutPlan,
  getPlanHash,
  type PayoutPlan
} from "../src/plan.js";
import type {
  PayoutRpc,
  RpcMintAccount,
  RpcSignatureStatus,
  RpcTokenAccount
} from "../src/rpc.js";
import {
  MemoryStateStore,
  createPayoutState,
  type BatchJournal,
  type StateIdentity
} from "../src/state.js";

async function fixture() {
  const [treasury, sponsor, recipient] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner()
  ]);
  const manifest = validateManifest({
    schema: "capy.payout-manifest.v1",
    manifest_id: "pm_e0ec000000000001",
    created_at: "2026-08-30T20:00:00.000Z",
    network: "devnet",
    currency: "USDC",
    mint: getNetworkPolicy("devnet").usdcMint,
    decimals: 6,
    expected_total_usdc: "2.000000",
    payouts: [
      {
        payout_id: "pay_e0ec000000000001",
        recipient_wallet: recipient.address,
        amount_usdc: "2.000000"
      }
    ]
  });
  const plan = await createPayoutPlan(manifest, {
    treasuryAuthority: treasury.address,
    feePayer: sponsor.address
  });
  return { treasury, sponsor, plan };
}

function identity(plan: PayoutPlan): StateIdentity {
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

async function journalFor(plan: PayoutPlan, keys: CryptoKeyPair[]): Promise<BatchJournal> {
  const batch = plan.batches[0]!;
  const unsigned = buildBatchTransaction(plan, batch, {
    recentBlockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: 100n,
    computeUnitLimit: 200_000
  });
  const transaction = await signTransaction(keys, unsigned);
  const rawBase64 = getBase64EncodedWireTransaction(transaction);
  return {
    batch_id: batch.batchId,
    index: 0,
    payout_ids: batch.payouts.map((payout) => payout.payoutId),
    amount_base_units: batch.amountBaseUnits.toString(),
    raw_transaction_base64: rawBase64,
    raw_transaction_sha256: createHash("sha256")
      .update(Buffer.from(rawBase64, "base64"))
      .digest("hex"),
    signature: getSignatureFromTransaction(transaction),
    blockhash: "11111111111111111111111111111111",
    last_valid_block_height: "100",
    compute_unit_limit: 200_000,
    status: "submitted",
    attempts: 1,
    prepared_at: "2026-08-30T20:00:00.000Z",
    last_submitted_at: "2026-08-30T20:00:01.000Z"
  };
}

class MockRpc implements PayoutRpc {
  sent = false;
  sendCount = 0;
  readonly plan: PayoutPlan;

  constructor(plan: PayoutPlan) {
    this.plan = plan;
  }

  async getGenesisHash() {
    return "mock-genesis";
  }

  async getLatestBlockhash() {
    return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100n };
  }

  async getSignatureStatuses(): Promise<Array<RpcSignatureStatus | null>> {
    return [this.sent ? { err: null, confirmationStatus: "finalized" } : null];
  }

  async getBlockHeight() {
    return 10n;
  }

  async getMintAccount(): Promise<RpcMintAccount> {
    return {
      programAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address,
      decimals: 6
    };
  }

  async getTokenAccounts(addresses: readonly Address[]): Promise<RpcTokenAccount[]> {
    return addresses.map((accountAddress) =>
      accountAddress === this.plan.sourceTokenAccount
        ? {
            exists: true,
            programAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address,
            mint: this.plan.manifest.mint,
            owner: this.plan.treasuryAuthority,
            amount: this.plan.manifest.totalBaseUnits
          }
        : { exists: false }
    );
  }

  async getBalance() {
    return 10_000_000n;
  }

  async getTokenAccountRent() {
    return 2_039_280n;
  }

  async getFeeForTransaction() {
    return 10_000n;
  }

  async simulateTransaction() {
    return { err: null, unitsConsumed: 100_000n };
  }

  async sendTransaction(transaction: Transaction) {
    this.sent = true;
    this.sendCount += 1;
    return getSignatureFromTransaction(transaction);
  }
}

describe("journal and reconciliation", () => {
  it("detects transaction-byte tampering", async () => {
    const { treasury, sponsor, plan } = await fixture();
    const journal = await journalFor(plan, [sponsor.keyPair, treasury.keyPair]);
    expect(() => verifyJournalIntegrity(journal)).not.toThrow();
    const tampered = { ...journal, raw_transaction_sha256: "0".repeat(64) };
    expect(() => verifyJournalIntegrity(tampered)).toThrow(/integrity failure/);
  });

  it("marks an absent expired signature as ambiguous instead of rebuilding", async () => {
    const { treasury, sponsor, plan } = await fixture();
    const journal = await journalFor(plan, [sponsor.keyPair, treasury.keyPair]);
    const state = createPayoutState(identity(plan));
    state.batches.push(journal);
    const store = new MemoryStateStore();
    await store.save(state);
    const rpc = new MockRpc(plan);
    rpc.getBlockHeight = async () => 101n;
    await reconcileState(rpc, state, store);
    expect(state.batches[0]?.status).toBe("expired_unknown");
  });

  it("journals before submission and does not resend a finalized batch", async () => {
    const { treasury, sponsor, plan } = await fixture();
    const rpc = new MockRpc(plan);
    const store = new MemoryStateStore();
    const first = await executePayoutPlan(rpc, plan, store, {
      authority: treasury,
      feePayer: sponsor,
      confirmationPolls: 1,
      confirmationPollIntervalMs: 0
    });
    expect(first.batches[0]?.status).toBe("finalized");
    expect(first.batches[0]?.attempts).toBe(1);
    expect(rpc.sendCount).toBe(1);

    await executePayoutPlan(rpc, plan, store, {
      authority: treasury,
      feePayer: sponsor,
      confirmationPolls: 1,
      confirmationPollIntervalMs: 0
    });
    expect(rpc.sendCount).toBe(1);
  });

  it("refuses to reuse state when the payout plan changes", async () => {
    const { treasury, sponsor, plan } = await fixture();
    const rpc = new MockRpc(plan);
    const store = new MemoryStateStore();
    await executePayoutPlan(rpc, plan, store, {
      authority: treasury,
      feePayer: sponsor,
      confirmationPolls: 1,
      confirmationPollIntervalMs: 0
    });
    const changedPlan = await createPayoutPlan(plan.manifest, {
      treasuryAuthority: treasury.address,
      feePayer: sponsor.address,
      priorityFeeMicroLamports: 1n
    });
    await expect(
      executePayoutPlan(new MockRpc(changedPlan), changedPlan, store, {
        authority: treasury,
        feePayer: sponsor,
        confirmationPolls: 1,
        confirmationPollIntervalMs: 0
      })
    ).rejects.toThrow(/plan_hash mismatch/);
  });
});
