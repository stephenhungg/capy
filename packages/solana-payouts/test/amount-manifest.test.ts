import { describe, expect, it } from "vitest";
import { formatUsdcAmount, parseUsdcAmount } from "../src/amount.js";
import { validateManifest } from "../src/manifest.js";

const recipient = "EHNQQKabkfjzh7PsUqvJP1z117u4qKCDAEVJfMB83CwT";

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "capy.payout-manifest.v1",
    manifest_id: "pm_0000000000000001",
    created_at: "2026-08-30T20:00:00.000Z",
    network: "devnet",
    currency: "USDC",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
    expected_total_usdc: "1.250000",
    payouts: [
      {
        payout_id: "pay_0000000000000001",
        recipient_wallet: recipient,
        amount_usdc: "1.250000"
      }
    ],
    ...overrides
  };
}

describe("USDC amounts", () => {
  it("round-trips exact six-decimal amounts", () => {
    expect(parseUsdcAmount("123.000042")).toBe(123_000_042n);
    expect(formatUsdcAmount(123_000_042n)).toBe("123.000042");
  });

  it.each(["1", "1.0", "01.000000", "-1.000000", "1.0000001"])(
    "rejects ambiguous amount %s",
    (value) => expect(() => parseUsdcAmount(value)).toThrow()
  );
});

describe("manifest validation", () => {
  it("accepts the allowlisted devnet mint and hashes the normalized manifest", () => {
    const parsed = validateManifest(manifest());
    expect(parsed.totalBaseUnits).toBe(1_250_000n);
    expect(parsed.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects duplicate payout ids", () => {
    const input = manifest({
      expected_total_usdc: "2.500000",
      payouts: [
        { payout_id: "pay_0000000000000001", recipient_wallet: recipient, amount_usdc: "1.250000" },
        { payout_id: "pay_0000000000000001", recipient_wallet: recipient, amount_usdc: "1.250000" }
      ]
    });
    expect(() => validateManifest(input)).toThrow(/duplicate payout_id/);
  });

  it("rejects a declared total that differs from the payout sum", () => {
    expect(() => validateManifest(manifest({ expected_total_usdc: "1.250001" }))).toThrow(
      /total mismatch/
    );
  });

  it("rejects private or arbitrary metadata fields", () => {
    const input = manifest();
    (input.payouts as Array<Record<string, unknown>>)[0]!.email = "private@example.invalid";
    expect(() => validateManifest(input)).toThrow();
  });

  it("rejects a non-circle mint", () => {
    expect(() => validateManifest(manifest({ mint: recipient }))).toThrow(/allowlisted native USDC/);
  });
});
