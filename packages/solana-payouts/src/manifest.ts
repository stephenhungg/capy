import { createHash } from "node:crypto";
import { address, isOffCurveAddress, type Address } from "@solana/kit";
import { z } from "zod";
import { parseUsdcAmount } from "./amount.js";
import { getNetworkPolicy } from "./constants.js";

const opaqueManifestId = z
  .string()
  .min(19)
  .max(64)
  .regex(/^pm_[a-f0-9]{16,61}$/, "must be a pm_ prefixed opaque hex id");

const opaquePayoutId = z
  .string()
  .min(20)
  .max(64)
  .regex(/^pay_[a-f0-9]{16,60}$/, "must be a pay_ prefixed opaque hex id");

const payoutSchema = z
  .object({
    payout_id: opaquePayoutId,
    recipient_wallet: z.string().min(32).max(44),
    amount_usdc: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{6}$/)
  })
  .strict();

export const payoutManifestV1Schema = z
  .object({
    schema: z.literal("capy.payout-manifest.v1"),
    manifest_id: opaqueManifestId,
    created_at: z.string().datetime({ offset: true }),
    network: z.enum(["devnet", "mainnet-beta"]),
    currency: z.literal("USDC"),
    mint: z.string().min(32).max(44),
    decimals: z.literal(6),
    expected_total_usdc: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{6}$/),
    payouts: z.array(payoutSchema).min(1).max(10_000)
  })
  .strict();

export type PayoutManifestV1 = z.infer<typeof payoutManifestV1Schema>;

export interface ValidatedPayout {
  readonly payoutId: string;
  readonly recipientWallet: Address;
  readonly amountBaseUnits: bigint;
}

export interface ValidatedManifest {
  readonly manifest: PayoutManifestV1;
  readonly mint: Address;
  readonly payouts: readonly ValidatedPayout[];
  readonly totalBaseUnits: bigint;
  readonly manifestHash: string;
}

export function validateManifest(input: unknown): ValidatedManifest {
  const manifest = payoutManifestV1Schema.parse(input);
  const policy = getNetworkPolicy(manifest.network);
  let mint: Address;
  try {
    mint = address(manifest.mint);
  } catch {
    throw new Error("manifest mint is not a valid Solana public key");
  }
  if (mint !== policy.usdcMint) {
    throw new Error(
      `mint is not the allowlisted native USDC mint for ${manifest.network}: ${policy.usdcMint}`
    );
  }

  const ids = new Set<string>();
  const payouts = manifest.payouts.map((payout, index): ValidatedPayout => {
    if (ids.has(payout.payout_id)) {
      throw new Error(`duplicate payout_id at index ${index}: ${payout.payout_id}`);
    }
    ids.add(payout.payout_id);

    let recipientWallet: Address;
    try {
      recipientWallet = address(payout.recipient_wallet);
    } catch {
      throw new Error(`invalid recipient_wallet for payout ${payout.payout_id}`);
    }
    if (isOffCurveAddress(recipientWallet)) {
      throw new Error(
        `recipient_wallet for payout ${payout.payout_id} is off-curve; PDA recipients require a separate reviewed flow`
      );
    }

    const amountBaseUnits = parseUsdcAmount(payout.amount_usdc);
    if (amountBaseUnits === 0n) {
      throw new Error(`payout ${payout.payout_id} must be greater than zero`);
    }
    return { payoutId: payout.payout_id, recipientWallet, amountBaseUnits };
  });

  const totalBaseUnits = payouts.reduce((total, payout) => total + payout.amountBaseUnits, 0n);
  const expectedTotal = parseUsdcAmount(manifest.expected_total_usdc);
  if (totalBaseUnits !== expectedTotal) {
    throw new Error(
      `manifest total mismatch: payouts sum to ${totalBaseUnits} base units, expected ${expectedTotal}`
    );
  }
  if (totalBaseUnits > (1n << 64n) - 1n) {
    throw new Error("manifest total exceeds the SPL Token u64 limit");
  }

  const canonical = JSON.stringify(manifest);
  const manifestHash = createHash("sha256").update(canonical).digest("hex");
  return { manifest, mint, payouts, totalBaseUnits, manifestHash };
}
