import { randomInt } from "node:crypto";

/**
 * Source of randomness for the quiz core. Every consumer takes one as a parameter so
 * tests can inject a deterministic generator, and so no module reaches for Math.random.
 * Contract: maxExclusive must be at least 1; the result is in [0, maxExclusive).
 */
export type RandomInt = (maxExclusive: number) => number;

/**
 * Default implementation, backed by node:crypto. Shuffling only ever happens on the
 * server (when an attempt is created), so a crypto source is available and unbiased.
 * An empty range throws (node's own contract) instead of inventing a value.
 */
export const cryptoRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);
