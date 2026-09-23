import { describe, expect, it } from "vitest";
import { formatFrenchDate, isoDate, lastWorkday } from "./workday";

describe("lastWorkday", () => {
  it.each([["2026-09-14", "2026-09-11"], ["2026-09-15", "2026-09-14"], ["2026-09-19", "2026-09-18"], ["2026-09-20", "2026-09-18"]])("returns the last business day for %s", (input, expected) => expect(isoDate(lastWorkday(new Date(`${input}T12:00:00Z`)))).toBe(expected));

  it.each([["2026-09-22T00:05:00Z", "2026-09-21"], ["2026-09-22T23:55:00Z", "2026-09-21"]])("works on UTC days at the day edges (%s)", (input, expected) => {
    expect(isoDate(lastWorkday(new Date(input)))).toBe(expected);
  });

  it("formats the UTC day in French", () => {
    expect(formatFrenchDate("2026-09-21")).toBe("lundi 21 septembre 2026");
  });
});
