import { describe, expect, it } from "vitest";
import { dayRange, isWithinRange } from "./range";

describe("daily date ranges", () => {
  it("uses a half-open interval", () => {
    const range = dayRange("2026-09-18");
    expect(range).toEqual({ start: "2026-09-18T00:00:00.000Z", end: "2026-09-19T00:00:00.000Z" });
    expect(isWithinRange("2026-09-18T00:00:00Z", range)).toBe(true);
    expect(isWithinRange("2026-09-18T23:59:59Z", range)).toBe(true);
    expect(isWithinRange("2026-09-19T00:00:00Z", range)).toBe(false);
    expect(isWithinRange("2026-09-17T23:59:59Z", range)).toBe(false);
  });
});
