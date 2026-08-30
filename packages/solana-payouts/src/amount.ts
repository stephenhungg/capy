import { USDC_DECIMALS } from "./constants.js";

const U64_MAX = (1n << 64n) - 1n;
const USDC_AMOUNT = /^(0|[1-9][0-9]*)\.([0-9]{6})$/;

export function parseUsdcAmount(value: string): bigint {
  const match = USDC_AMOUNT.exec(value);
  if (!match) {
    throw new Error(`invalid USDC amount ${JSON.stringify(value)}; use an exact 6-decimal string`);
  }
  const whole = BigInt(match[1] ?? "0");
  const fraction = BigInt(match[2] ?? "0");
  const baseUnits = whole * 10n ** BigInt(USDC_DECIMALS) + fraction;
  if (baseUnits > U64_MAX) {
    throw new Error("USDC amount exceeds the SPL Token u64 limit");
  }
  return baseUnits;
}

export function formatUsdcAmount(baseUnits: bigint): string {
  if (baseUnits < 0n || baseUnits > U64_MAX) {
    throw new Error("USDC base units must fit in an unsigned 64-bit integer");
  }
  const scale = 10n ** BigInt(USDC_DECIMALS);
  const whole = baseUnits / scale;
  const fraction = (baseUnits % scale).toString().padStart(USDC_DECIMALS, "0");
  return `${whole}.${fraction}`;
}
