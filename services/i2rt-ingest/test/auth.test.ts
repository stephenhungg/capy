import { describe, expect, it } from "vitest";
import { constantTimeTokenEqual } from "../src/auth.js";

describe("bearer token comparison", () => {
  it("accepts only the exact token without throwing on different lengths", () => {
    expect(constantTimeTokenEqual("correct-token", "correct-token")).toBe(true);
    expect(constantTimeTokenEqual("wrong", "correct-token")).toBe(false);
    expect(constantTimeTokenEqual("correct-token-extra", "correct-token")).toBe(false);
  });
});
