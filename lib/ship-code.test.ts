import { describe, expect, it } from "vitest";
import { formatShipCode, hashShipCode, isValidShipCode, normalizeShipCode } from "./ship-code";

describe("ship code helpers", () => {
  it("normalizes and formats codes", () => {
    expect(normalizeShipCode("k7m-9q2")).toBe("K7M9Q2");
    expect(formatShipCode("k7m9q2")).toBe("K7M-9Q2");
  });

  it("rejects confusing characters", () => {
    expect(isValidShipCode("K7M9Q2")).toBe(true);
    expect(isValidShipCode("O0I1L2")).toBe(false);
  });

  it("hashes normalized code deterministically", async () => {
    await expect(hashShipCode("K7M-9Q2", "secret")).resolves.toBe(
      await hashShipCode("k7m9q2", "secret")
    );
  });
});
