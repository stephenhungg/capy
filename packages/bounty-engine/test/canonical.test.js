import test from "node:test";
import assert from "node:assert/strict";

import { allocateProRata, canonicalize, sha256Hex } from "../src/index.js";

test("canonical json ignores object insertion order", () => {
  const left = { z: [3, 2, 1], a: { d: true, c: "value" } };
  const right = { a: { c: "value", d: true }, z: [3, 2, 1] };

  assert.equal(canonicalize(left), canonicalize(right));
  assert.equal(sha256Hex(left), sha256Hex(right));
});

test("largest remainder allocation is exact and uses lexical tie breaks", () => {
  const result = allocateProRata(10n, [
    { id: "c", weight: 1n },
    { id: "b", weight: 1n },
    { id: "a", weight: 1n },
  ]);

  assert.deepEqual(Object.fromEntries(result), { a: 4n, b: 3n, c: 3n });
  assert.equal([...result.values()].reduce((sum, amount) => sum + amount, 0n), 10n);
});

test("canonical json rejects floats instead of introducing numeric ambiguity", () => {
  assert.throws(() => canonicalize({ score: 0.1 }), /safe integers/);
});
