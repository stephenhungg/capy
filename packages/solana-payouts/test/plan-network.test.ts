import {
  address,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  MAX_LEGACY_TRANSACTION_BYTES,
  MAX_TRANSACTION_ACCOUNTS,
  assertRpcEndpointAllowed,
  getNetworkPolicy
} from "../src/constants.js";
import { validateManifest } from "../src/manifest.js";
import { assertClusterIdentity } from "../src/network.js";
import { buildBatchTransaction, createPayoutPlan } from "../src/plan.js";

async function manyPayoutManifest(count: number) {
  const recipients = await Promise.all(
    Array.from({ length: count }, () => generateKeyPairSigner())
  );
  return validateManifest({
    schema: "capy.payout-manifest.v1",
    manifest_id: "pm_ba7c000000000001",
    created_at: "2026-08-30T20:00:00.000Z",
    network: "devnet",
    currency: "USDC",
    mint: getNetworkPolicy("devnet").usdcMint,
    decimals: 6,
    expected_total_usdc: `${count}.000000`,
    payouts: recipients.map((recipient, index) => ({
      payout_id: `pay_${index.toString(16).padStart(16, "0")}`,
      recipient_wallet: recipient.address,
      amount_usdc: "1.000000"
    }))
  });
}

describe("size-aware payout planning", () => {
  it("splits a large manifest using measured transaction limits", async () => {
    const treasury = await generateKeyPairSigner();
    const manifest = await manyPayoutManifest(30);
    const plan = await createPayoutPlan(manifest, {
      treasuryAuthority: treasury.address,
      feePayer: treasury.address,
      maxPayoutsPerBatch: 32
    });
    expect(plan.batches.length).toBeGreaterThan(1);
    expect(plan.batches.flatMap((batch) => batch.payouts)).toHaveLength(30);
    for (const batch of plan.batches) {
      expect(batch.estimatedTransactionBytes).toBeLessThanOrEqual(MAX_LEGACY_TRANSACTION_BYTES);
      expect(batch.accountCount).toBeLessThanOrEqual(MAX_TRANSACTION_ACCOUNTS);
    }
  });

  it("puts a distinct sponsor first as fee payer", async () => {
    const [treasury, sponsor] = await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner()
    ]);
    const manifest = await manyPayoutManifest(1);
    const plan = await createPayoutPlan(manifest, {
      treasuryAuthority: treasury.address,
      feePayer: sponsor.address
    });
    const transaction = buildBatchTransaction(plan, plan.batches[0]!, {
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 100n,
      computeUnitLimit: 200_000
    });
    const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
    expect(compiled.staticAccounts[0]).toBe(sponsor.address);
    expect(compiled.staticAccounts).toContain(treasury.address);
    expect(compiled.staticAccounts).toContain(
      address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    );
    expect(compiled.staticAccounts).not.toContain(
      address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
    );
  });
});

describe("network policy", () => {
  it("requires https and an explicit hostname allowlist", () => {
    expect(() => assertRpcEndpointAllowed("devnet", "http://api.devnet.solana.com")).toThrow(
      /https/
    );
    expect(() => assertRpcEndpointAllowed("devnet", "https://rpc.attacker.invalid")).toThrow(
      /not allowlisted/
    );
    expect(
      assertRpcEndpointAllowed("devnet", "https://rpc.vendor.invalid/key", [
        "rpc.vendor.invalid"
      ]).hostname
    ).toBe("rpc.vendor.invalid");
  });

  it("compares custom rpc genesis with the official network reference", async () => {
    await expect(
      assertClusterIdentity(
        { getGenesisHash: async () => "unexpected" },
        "devnet",
        { getGenesisHash: async () => "expected" }
      )
    ).rejects.toThrow(/genesis hash/);
    await expect(
      assertClusterIdentity(
        { getGenesisHash: async () => "same" },
        "devnet",
        { getGenesisHash: async () => "same" }
      )
    ).resolves.toBe("same");
  });

  it("keeps mainnet submission disabled", () => {
    expect(getNetworkPolicy("mainnet-beta").submissionEnabled).toBe(false);
    expect(address(getNetworkPolicy("mainnet-beta").usdcMint)).toBe(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    );
  });
});
