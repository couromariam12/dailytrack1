/** Previous business day, computed on UTC calendar days (see lib/date/range.ts). */
export function lastWorkday(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const daysBack = day === 1 ? 3 : day === 0 ? 2 : 1;
  result.setUTCDate(result.getUTCDate() - daysBack);
  return result;
}

export function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }

export function formatFrenchDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
