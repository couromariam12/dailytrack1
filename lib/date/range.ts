export type DateRange = { start: string; end: string };

export type Period = "all" | "today" | "yesterday" | "this_week" | "previous_week" | "this_month" | "previous_month" | "custom";

export const periodOptions: ReadonlyArray<readonly [Period, string]> = [
  ["all", "Toutes les dates"],
  ["today", "Aujourd’hui"],
  ["yesterday", "Hier"],
  ["this_week", "Cette semaine"],
  ["previous_week", "Semaine précédente"],
  ["this_month", "Ce mois"],
  ["previous_month", "Mois précédent"],
  ["custom", "Période personnalisée"],
];

const DAY_MS = 86_400_000;

/**
 * DailyTrack uses UTC day boundaries everywhere (identical to Africa/Dakar), on the server and in
 * the browser, so a date means the same interval whatever the viewer's time zone.
 */
export function dayRange(date: string): DateRange {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + DAY_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** A custom range includes every selected calendar day and ends at the next midnight. */
export function customDateRange(startDate: string, endDate: string): DateRange | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return null;
  const start = dayRange(startDate);
  const end = dayRange(endDate);
  if (Date.parse(start.start) > Date.parse(end.start)) return null;
  return { start: start.start, end: end.end };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isWithinRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}

/** Half-open UTC interval for a named period, or null for "all". */
export function periodRange(period: Period, now: Date = new Date()): DateRange | null {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const range = (start: number, end: number): DateRange => ({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
  switch (period) {
    case "all":
      return null;
    case "today":
      return range(today, today + DAY_MS);
    case "yesterday":
      return range(today - DAY_MS, today);
    case "this_week":
    case "previous_week": {
      const monday = today - ((now.getUTCDay() + 6) % 7) * DAY_MS - (period === "previous_week" ? 7 * DAY_MS : 0);
      return range(monday, monday + 7 * DAY_MS);
    }
    case "this_month":
    case "previous_month": {
      const offset = period === "previous_month" ? -1 : 0;
      return range(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1), Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
    }
    case "custom":
      return null;
  }
}

/** UTC calendar day (YYYY-MM-DD) of an ISO timestamp, whatever offset Gitea used to serialize it. */
export function utcDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}
