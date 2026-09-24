import { CAPACITY_UNAVAILABLE_CODES, type ActivityKind } from "@/lib/activity/types";
import type { CommitDto, IssueDto, PullRequestDto, ReviewDto } from "@/lib/gitea/types";
import type { ExportBundle } from "./export-data";
import type { ExportFilters } from "./export-schema";

type ActivityRow = { type: string; repository: string; author: string; date: string; status: string; title: string; id: string; url: string };

export function renderAdminCsv(bundle: ExportBundle, filters: ExportFilters): string {
  const counts = [
    ["issues", metricValue(bundle, "issues")],
    ["pulls", metricValue(bundle, "pulls")],
    ["commits", metricValue(bundle, "commits")],
    ["reviews", metricValue(bundle, "reviews")],
  ] as const;
  const rows: string[][] = [
    ["section", "type", "repository", "collaborateur", "date", "statut", "titre", "identifiant", "url", "valeur"],
    ...counts.map(([type, value]) => ["kpi", type, "", "", "", "", "", "", "", value]),
    ...bundle.repositories.map((repo) => ["repository", "", repo.full_name ?? repo.name ?? "", "", "", repo.archived ? "archived" : "active", repo.description ?? "", "", repo.html_url ?? "", ""]),
    ...collaboratorRows(bundle),
    ...activityRows(bundle, filters),
    ...bundle.warnings.map((warning) => ["warning", warning.kind, warning.repository, "", "", warning.code, warning.message, "", "", ""]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

/** Creates a compact PDF without a runtime dependency; it is intentionally limited to two pages. */
export function renderAdminPdf(bundle: ExportBundle, filters: ExportFilters): Buffer {
  const counts = getCounts(bundle);
  const activities = activityItems(bundle, filters);
  const collaborators = collaboratorVolumes(bundle);
  const total = counts.issues + counts.pulls + counts.commits + counts.reviews;
  const scope = `${filters.owner}/${filters.repository}`;
  const pageOne: string[] = [];
  fill(pageOne, 0, 0, 595, 842, "0.97 0.98 1");
  fill(pageOne, 0, 770, 595, 72, "0.11 0.22 0.42");
  text(pageOne, 36, 816, "DailyTrack", 20, "1 1 1", true);
  text(pageOne, 36, 794, "Rapport d'activite", 12, "0.79 0.88 1");
  text(pageOne, 380, 816, `Periode: ${periodLabel(filters)}`, 8, "1 1 1");
  text(pageOne, 380, 800, `Genere le ${generatedAt()}`, 8, "0.79 0.88 1");
  text(pageOne, 380, 784, `Perimetre: ${scope}`, 8, "0.79 0.88 1");

  const cards = [["Tickets", metricValue(bundle, "issues")], ["Pull requests", metricValue(bundle, "pulls")], ["Commits", metricValue(bundle, "commits")], ["Reviews", metricValue(bundle, "reviews")]] as const;
  const colors = ["0.16 0.47 0.75", "0.46 0.29 0.76", "0.12 0.58 0.48", "0.88 0.42 0.20"];
  cards.forEach(([label, value], index) => { const x = 36 + index * 132; fill(pageOne, x, 694, 124, 54, "1 1 1"); fill(pageOne, x, 694, 5, 54, colors[index]); text(pageOne, x + 14, 728, label, 8, "0.25 0.31 0.42"); text(pageOne, x + 14, 706, value, 20, colors[index], true); });
  text(pageOne, 36, 655, `Collaborateurs actifs: ${collaborators.length}`, 9, "0.18 0.23 0.32");
  text(pageOne, 250, 655, `Repositories concernes: ${bundle.repository ? 1 : 0}`, 9, "0.18 0.23 0.32");
  text(pageOne, 36, 625, "Synthese", 13, "0.11 0.22 0.42", true);
  text(pageOne, 36, 605, `Activite totale: ${total}`, 10, "0.18 0.23 0.32");
  if (total === 0) text(pageOne, 36, 585, "Aucune activite reelle disponible pour les filtres selectionnes.", 9, "0.55 0.25 0.18");
  else {
    if (collaborators[0]) text(pageOne, 36, 585, `Collaborateur le plus actif: ${collaborators[0][0]} (${collaborators[0][1]})`, 9, "0.18 0.23 0.32");
    const repo = bundle.repository?.full_name ?? scope;
    text(pageOne, 36, 569, `Repository du perimetre: ${repo}`, 9, "0.18 0.23 0.32");
  }
  bundle.warnings.forEach((warning, index) => text(pageOne, 36, 545 - index * 13, `Capacite indisponible (${warning.kind}): ${warning.message}`, 7, "0.55 0.25 0.18"));
  text(pageOne, 36, 430, "Repartition par type", 11, "0.11 0.22 0.42", true);
  const typeValues = [["Tickets", metricValue(bundle, "issues"), counts.issues], ["Pull requests", metricValue(bundle, "pulls"), counts.pulls], ["Commits", metricValue(bundle, "commits"), counts.commits], ["Reviews", metricValue(bundle, "reviews"), counts.reviews]] as const;
  const typeColors = ["0.16 0.47 0.75", "0.46 0.29 0.76", "0.12 0.58 0.48", "0.88 0.42 0.20"];
  const maxType = Math.max(1, ...typeValues.map(([, , value]) => value));
  typeValues.forEach(([label, value, numericValue], index) => { const y = 402 - index * 27; text(pageOne, 36, y + 4, `${label} (${value})`, 8, "0.18 0.23 0.32"); fill(pageOne, 170, y, 340, 12, "0.88 0.91 0.96"); if (value !== "—" && numericValue > 0) fill(pageOne, 170, y, Math.max(3, 340 * numericValue / maxType), 12, typeColors[index]); });
  text(pageOne, 36, 270, "Evolution de l'activite", 11, "0.11 0.22 0.42", true);
  const timeline = timelineVolumes(activities);
  if (!timeline.length) text(pageOne, 36, 245, "Aucune donnee reelle sur la periode.", 9, "0.55 0.25 0.18");
  else { const visible = timeline.slice(-8); const maxDay = Math.max(1, ...visible.map(([, value]) => value)); visible.forEach(([day, value], index) => { const x = 48 + index * (500 / Math.max(1, visible.length)); const height = Math.max(3, 100 * value / maxDay); fill(pageOne, x, 125, 38, 100, "0.90 0.93 0.98"); fill(pageOne, x, 125, 38, height, "0.16 0.47 0.75"); text(pageOne, x, 112, day.slice(5), 7, "0.30 0.36 0.46"); text(pageOne, x + 13, 130 + height, String(value), 7, "0.11 0.22 0.42", true); }); }
  text(pageOne, 36, 70, "Les indicateurs sont descriptifs et proviennent des donnees Gitea filtrees.", 8, "0.34 0.40 0.50");

  if (total === 0) return createPdfDocument([pageOne]);
  const pageTwo: string[] = [];
  fill(pageTwo, 0, 0, 595, 842, "0.97 0.98 1");
  text(pageTwo, 36, 806, "Activite par collaborateur", 15, "0.11 0.22 0.42", true);
  text(pageTwo, 36, 788, `${scope} - ${periodLabel(filters)}`, 8, "0.34 0.40 0.50");
  const maxCollaborator = Math.max(1, collaborators[0]?.[1] ?? 1);
  collaborators.slice(0, 8).forEach(([login, value], index) => { const y = 750 - index * 27; text(pageTwo, 36, y, `${login} (${value})`, 8, "0.18 0.23 0.32"); fill(pageTwo, 170, y - 4, 340, 12, "0.88 0.91 0.96"); fill(pageTwo, 170, y - 4, Math.max(3, 340 * value / maxCollaborator), 12, "0.46 0.29 0.76"); });
  if (collaborators.length > 8) text(pageTwo, 36, 520, `${collaborators.length - 8} collaborateur(s) supplementaire(s) disponible(s) dans Gitea.`, 8, "0.34 0.40 0.50");
  text(pageTwo, 36, 470, "Activites principales", 13, "0.11 0.22 0.42", true);
  activities.slice(0, 8).forEach((item, index) => { const y = 435 - index * 40; text(pageTwo, 36, y, `${item.type} - ${truncate(item.title || item.id, 68)}`, 8, "0.11 0.22 0.42", true); text(pageTwo, 36, y - 13, `${item.author || "Auteur non fourni"} | ${item.repository} | ${formatDate(item.date)}`, 7, "0.30 0.36 0.46"); });
  if (activities.length > 8) text(pageTwo, 36, 75, `${activities.length - 8} activite(s) supplementaire(s) disponible(s) dans Gitea.`, 8, "0.34 0.40 0.50");
  return createPdfDocument([pageOne, pageTwo]);
}

function getCounts(bundle: ExportBundle) { return { issues: bundle.issues.length, pulls: bundle.pulls.length, commits: bundle.commits.length, reviews: bundle.reviews.length }; }
function metricValue(bundle: ExportBundle, kind: ActivityKind): string { return bundle.warnings.some((warning) => warning.kind === kind && CAPACITY_UNAVAILABLE_CODES.has(warning.code)) ? "—" : String(getCounts(bundle)[kind]); }
function collaboratorRows(bundle: ExportBundle): string[][] { return collaboratorVolumes(bundle).map(([login, count]) => ["collaborator", "", "", login, "", "", "", "", "", String(count)]); }
function collaboratorVolumes(bundle: ExportBundle): Array<[string, number]> { const counts = new Map<string, number>(); const add = (values: Array<string | null | undefined>) => { for (const login of new Set(values.filter((value): value is string => Boolean(value)))) counts.set(login, (counts.get(login) ?? 0) + 1); }; bundle.issues.forEach((item) => add([item.author?.login, ...item.assignees.map((user) => user.login)])); bundle.pulls.forEach((item) => add([item.author?.login])); bundle.commits.forEach((item) => add([item.author?.login, item.committer?.login])); bundle.reviews.forEach((item) => add([item.author?.login])); return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function activityRows(bundle: ExportBundle, filters: ExportFilters): string[][] { return activityItems(bundle, filters).map((item) => ["activity", item.type, item.repository, item.author, item.date, item.status, item.title, item.id, item.url, ""]); }
function activityItems(bundle: ExportBundle, filters: ExportFilters): ActivityRow[] { const repository = `${filters.owner}/${filters.repository}`; return [
  ...bundle.issues.map((item: IssueDto) => ({ type: "issue", repository, author: item.author?.login ?? "", date: item.created_at ?? item.updated_at ?? "", status: item.state ?? "", title: item.title ?? "", id: item.number === null ? "" : String(item.number), url: item.html_url ?? "" })),
  ...bundle.pulls.map((item: PullRequestDto) => ({ type: "pull_request", repository, author: item.author?.login ?? "", date: item.created_at ?? item.updated_at ?? "", status: item.state ?? "", title: item.title ?? "", id: item.index === null ? "" : String(item.index), url: item.html_url ?? "" })),
  ...bundle.commits.map((item: CommitDto) => ({ type: "commit", repository, author: item.author?.login ?? item.committer?.login ?? "", date: item.created_at ?? "", status: "", title: item.message ?? "", id: item.sha ?? "", url: item.html_url ?? "" })),
  ...bundle.reviews.map((item: ReviewDto) => ({ type: "review", repository, author: item.author?.login ?? "", date: item.submitted_at ?? item.updated_at ?? "", status: item.state ?? "", title: "Review", id: item.id === null ? "" : String(item.id), url: item.pull_request_url ?? item.html_url ?? "" })),
].sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "")); }
function timelineVolumes(items: ActivityRow[]): Array<[string, number]> { const counts = new Map<string, number>(); items.forEach((item) => { const day = item.date.slice(0, 10); if (day) counts.set(day, (counts.get(day) ?? 0) + 1); }); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)); }
function periodLabel(filters: ExportFilters): string { return filters.since && filters.until ? `${formatDate(filters.since)} - ${formatDate(filters.until)}` : "toutes les dates"; }
function generatedAt(): string { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar" }).format(new Date()); }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value.slice(0, 10) : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Dakar" }).format(date); }
function truncate(value: string, length: number): string { return value.length > length ? `${value.slice(0, length - 3)}...` : value; }
function csvEscape(value: string): string { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
function fill(commands: string[], x: number, y: number, width: number, height: number, color: string): void { commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`); }
function text(commands: string[], x: number, y: number, value: string, size: number, color: string, bold = false): void { commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${pdfEscape(pdfText(value))}) Tj ET`); }
function createPdfDocument(pages: string[][]): Buffer { const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]; const pageIds: number[] = []; pages.forEach((commands) => { const pageId = objects.length + 1; const contentId = pageId + 1; pageIds.push(pageId); const stream = commands.join("\n"); objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`); }); objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`; let output = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, "latin1")); output += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = Buffer.byteLength(output, "latin1"); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(output, "latin1"); }
function pdfText(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?").slice(0, 120); }
function pdfEscape(value: string): string { return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"); }
