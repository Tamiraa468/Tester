import { describe, expect, it } from "vitest";
import { addDays, dayKeysBack, dayOfMonth, formatDayLong, ubDayKey, ubDayStart } from "./date";

describe("ubDayKey", () => {
  it("uses the Ulaanbaatar day, not the server's UTC day", () => {
    // 07:00 in Ulaanbaatar is 23:00 UTC the day before, and counts on the 17th.
    expect(ubDayKey(new Date("2026-09-16T23:00:00.000Z"))).toBe("2026-09-17");
    // 23:30 Ulaanbaatar, still the same local day.
    expect(ubDayKey(new Date("2026-09-17T15:30:00.000Z"))).toBe("2026-09-17");
    // One minute earlier is the previous local day.
    expect(ubDayKey(new Date("2026-09-16T15:59:00.000Z"))).toBe("2026-09-16");
  });

  it("rolls over months and years", () => {
    expect(ubDayKey(new Date("2026-09-30T16:00:00.000Z"))).toBe("2026-10-01");
    expect(ubDayKey(new Date("2026-12-31T16:00:00.000Z"))).toBe("2027-01-01");
  });
});

describe("ubDayStart", () => {
  it("is the UTC instant of 00:00 local time", () => {
    expect(ubDayStart("2026-09-17").toISOString()).toBe("2026-09-16T16:00:00.000Z");
    expect(ubDayStart("2027-01-01").toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("round-trips with ubDayKey", () => {
    for (const day of ["2026-01-01", "2026-06-15", "2026-09-17", "2026-12-31"]) {
      expect(ubDayKey(ubDayStart(day))).toBe(day);
      // One millisecond earlier belongs to the previous day.
      expect(ubDayKey(new Date(ubDayStart(day).getTime() - 1))).toBe(addDays(day, -1));
    }
  });
});

describe("addDays", () => {
  it("moves across months, years and leap days", () => {
    expect(addDays("2026-09-17", 1)).toBe("2026-09-18");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-09-17", 0)).toBe("2026-09-17");
  });
});

describe("dayKeysBack", () => {
  it("returns the window oldest first, ending at the given day", () => {
    expect(dayKeysBack("2026-09-17", 3)).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
    expect(dayKeysBack("2026-09-17", 30)).toHaveLength(30);
    expect(dayKeysBack("2026-09-17", 30)[0]).toBe("2026-08-19");
  });
});

describe("formatDayLong", () => {
  it("writes the day the Mongolian way, from the key itself", () => {
    expect(formatDayLong("2026-09-17")).toBe("9-р сарын 17");
    expect(formatDayLong("2026-12-01")).toBe("12-р сарын 1");
    expect(dayOfMonth("2026-09-07")).toBe(7);
  });
});
