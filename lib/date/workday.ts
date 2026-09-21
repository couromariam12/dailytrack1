export function lastWorkday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const daysBack = day === 1 ? 3 : day === 0 ? 2 : day === 6 ? 1 : 1;
  result.setDate(result.getDate() - daysBack);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
export function formatFrenchDate(value: string): string { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }

