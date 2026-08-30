import { stat, readFile } from "node:fs/promises";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";

export async function loadDevnetKeypair(path: string): Promise<KeyPairSigner> {
  const file = await stat(path);
  if (!file.isFile()) throw new Error("keypair path must point to a regular file");
  if ((file.mode & 0o077) !== 0) {
    throw new Error("keypair file permissions are too broad; require mode 0600 or stricter");
  }
  const text = await readFile(path, "utf8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    throw new Error("keypair file must contain a JSON byte array");
  }
  if (
    !Array.isArray(decoded) ||
    decoded.length !== 64 ||
    !decoded.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  ) {
    throw new Error("keypair file must contain exactly 64 byte values");
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(decoded as number[]));
}
