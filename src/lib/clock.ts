/**
 * The one place server code reads the current time for attempts and progress, so the
 * database suite can move the clock (e.g. past an exam deadline). Timestamps that
 * matter are written from this clock, never from the database's now().
 */
type Clock = () => Date;

const systemClock: Clock = () => new Date();
let current: Clock = systemClock;

export function now(): Date {
  return current();
}

/** Tests only: replace the clock, or pass null to restore the system clock. */
export function setClockForTests(clock: Clock | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setClockForTests() is only available in tests.");
  }
  current = clock ?? systemClock;
}
