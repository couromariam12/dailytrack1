import { describe, expect, it } from "vitest";
import { dayRange, isWithinRange, periodRange, utcDay } from "./range";

describe("daily date ranges", () => {
  it("uses a half-open interval", () => {
    const range = dayRange("2026-09-18");
    expect(range).toEqual({ start: "2026-09-18T00:00:00.000Z", end: "2026-09-19T00:00:00.000Z" });
    expect(isWithinRange("2026-09-18T00:00:00Z", range)).toBe(true);
    expect(isWithinRange("2026-09-18T23:59:59Z", range)).toBe(true);
    expect(isWithinRange("2026-09-19T00:00:00Z", range)).toBe(false);
    expect(isWithinRange("2026-09-17T23:59:59Z", range)).toBe(false);
  });

  it("compares instants, not strings, when Gitea serializes with an offset", () => {
    expect(isWithinRange("2026-09-19T01:00:00+02:00", dayRange("2026-09-18"))).toBe(true);
    expect(utcDay("2026-09-19T01:00:00+02:00")).toBe("2026-09-18");
  });
});

describe("named periods", () => {
  const now = new Date("2026-09-23T10:00:00Z"); // a Wednesday

  it.each([
    ["today", "2026-09-23T00:00:00.000Z", "2026-09-24T00:00:00.000Z"],
    ["yesterday", "2026-09-22T00:00:00.000Z", "2026-09-23T00:00:00.000Z"],
    ["this_week", "2026-09-21T00:00:00.000Z", "2026-09-28T00:00:00.000Z"],
    ["previous_week", "2026-09-14T00:00:00.000Z", "2026-09-21T00:00:00.000Z"],
    ["this_month", "2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
    ["previous_month", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"],
  ] as const)("computes %s on UTC days", (period, start, end) => {
    expect(periodRange(period, now)).toEqual({ start, end });
  });

  it("starts the week on Monday even on a Sunday", () => {
    expect(periodRange("this_week", new Date("2026-09-27T23:00:00Z"))?.start).toBe("2026-09-21T00:00:00.000Z");
  });

  it("has no bounds for all dates", () => {
    expect(periodRange("all", now)).toBeNull();
  });
});
