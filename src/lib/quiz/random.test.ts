import { describe, expect, it } from "vitest";
import { cryptoRandomInt } from "./random";

describe("cryptoRandomInt", () => {
  it("returns integers within [0, maxExclusive)", () => {
    for (let draw = 0; draw < 500; draw += 1) {
      const value = cryptoRandomInt(4);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(4);
    }
  });

  it("eventually produces every value of a small range", () => {
    const seen = new Set<number>();
    for (let draw = 0; draw < 500; draw += 1) seen.add(cryptoRandomInt(3));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("rejects an empty range instead of inventing a value", () => {
    expect(() => cryptoRandomInt(0)).toThrow();
  });
});
