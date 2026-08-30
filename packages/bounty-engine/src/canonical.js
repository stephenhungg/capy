import { createHash } from "node:crypto";

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("canonical numbers must be safe integers");
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }

  throw new TypeError("canonical values must be json-compatible plain data");
}

export function sha256Hex(value) {
  const encoded = typeof value === "string" ? value : canonicalize(value);
  return createHash("sha256").update(encoded).digest("hex");
}

export function deterministicId(prefix, value) {
  return `${prefix}_${sha256Hex(value).slice(0, 32)}`;
}

export function assertSafeInteger(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be a safe integer from ${minimum} through ${maximum}`);
  }
}

export function assertNonEmpty(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export function parseAtomic(value, name) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`${name} must be a canonical non-negative integer string`);
  }
  const parsed = BigInt(value);
  if (parsed > 18_446_744_073_709_551_615n) {
    throw new RangeError(`${name} exceeds Solana's u64 token amount`);
  }
  return parsed;
}
