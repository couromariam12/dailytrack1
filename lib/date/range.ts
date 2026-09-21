export type DateRange = { start: string; end: string };

/** DailyTrack uses UTC boundaries, which are identical to Africa/Dakar boundaries. */
export function dayRange(date: string): DateRange {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function isWithinRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}
