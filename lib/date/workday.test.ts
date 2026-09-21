import { describe, expect, it } from "vitest";
import { isoDate, lastWorkday } from "./workday";

describe("lastWorkday", () => {
  it.each([["2026-09-14", "2026-09-11"], ["2026-09-15", "2026-09-14"], ["2026-09-19", "2026-09-18"], ["2026-09-20", "2026-09-18"]])("returns the last business day for %s", (input, expected) => expect(isoDate(lastWorkday(new Date(`${input}T12:00:00Z`)))).toBe(expected));
});

