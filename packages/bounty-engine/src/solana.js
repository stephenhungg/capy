const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_INDEX = new Map([...ALPHABET].map((character, index) => [character, index]));

export function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("base58 value must be a non-empty string");
  }

  let numeric = 0n;
  for (const character of value) {
    const digit = ALPHABET_INDEX.get(character);
    if (digit === undefined) {
      throw new TypeError(`invalid base58 character: ${character}`);
    }
    numeric = numeric * 58n + BigInt(digit);
  }

  const bytes = [];
  while (numeric > 0n) {
    bytes.push(Number(numeric % 256n));
    numeric /= 256n;
  }
  bytes.reverse();

  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") {
    leadingZeroes += 1;
  }
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

export function assertSolanaAddress(value, name) {
  let decoded;
  try {
    decoded = decodeBase58(value);
  } catch (error) {
    throw new TypeError(`${name} is not base58: ${error.message}`);
  }
  if (decoded.length !== 32) {
    throw new TypeError(`${name} must decode to 32 bytes`);
  }
}
