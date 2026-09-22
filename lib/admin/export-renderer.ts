import type { ExportBundle, ExportFilters } from "./export-data";
import { getExportCounts } from "./export-data";

export function renderAdminCsv(bundle: ExportBundle, filters: ExportFilters): string {
  const counts = getExportCounts(bundle);
  const rows: string[][] = [
    ["section", "type", "repository", "collaborateur", "date", "statut", "titre", "identifiant", "url", "valeur"],
    ["kpi", "issues", "", "", "", "", "", "", "", String(counts.issues)],
    ["kpi", "pulls", "", "", "", "", "", "", "", String(counts.pulls)],
    ["kpi", "commits", "", "", "", "", "", "", "", String(counts.commits)],
    ["kpi", "reviews", "", "", "", "", "", "", "", String(counts.reviews)],
    ...bundle.repositories.map((repo) => ["repository", "", repo.full_name ?? repo.name ?? "", "", "", repo.archived ? "archived" : "active", repo.description ?? "", "", repo.html_url ?? "", ""]),
    ...collaboratorRows(bundle),
    ...activityRows(bundle, filters),
    ...Object.entries(bundle.errors).map(([type, message]) => ["error", type, `${filters.owner}/${filters.repository}`, "", "", "", message, "", "", ""]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function renderAdminPdf(bundle: ExportBundle, filters: ExportFilters): Buffer {
  const counts = getExportCounts(bundle);
  const activities = activityItems(bundle, filters);
  const collaborators = collaboratorVolumes(bundle);
  const total = counts.issues + counts.pulls + counts.commits + counts.reviews;
  const activeCollaborators = collaborators.length;
  const scope = `${filters.owner}/${filters.repository}`;
  const repositoriesConcerned = bundle.repositories.some((item) => item.full_name === scope || item.name === filters.repository) ? 1 : 0;
  const pageOne: string[] = [];

  fill(pageOne, 0, 0, 595, 842, "0.97 0.98 1");
  fill(pageOne, 0, 770, 595, 72, "0.11 0.22 0.42");
  text(pageOne, 36, 816, "DailyTrack", 20, "1 1 1", true);
  text(pageOne, 36, 794, "Rapport d'activite", 12, "0.79 0.88 1");
  text(pageOne, 386, 816, `Periode: ${periodLabel(filters)}`, 8, "1 1 1");
  text(pageOne, 386, 800, `Genere le ${generatedAt()}`, 8, "0.79 0.88 1");
  text(pageOne, 386, 784, `Perimetre: ${scope}`, 8, "0.79 0.88 1");

  const cards = [
    ["Tickets", counts.issues, "0.16 0.47 0.75"],
    ["Pull requests", counts.pulls, "0.46 0.29 0.76"],
    ["Commits", counts.commits, "0.12 0.58 0.48"],
    ["Reviews", counts.reviews, "0.88 0.42 0.20"],
    ["Collaborateurs actifs", activeCollaborators, "0.25 0.36 0.55"],
    ["Repositories concernes", repositoriesConcerned, "0.36 0.51 0.33"],
  ] as const;
  cards.forEach(([label, value, color], index) => {
    const firstRow = index < 4;
    const column = firstRow ? index : index - 4;
    const width = firstRow ? 124 : 190;
    const gap = firstRow ? 8 : 10;
    const x = 36 + column * (width + gap);
    const y = firstRow ? 694 : 626;
    fill(pageOne, x, y, width, 54, "1 1 1");
    fill(pageOne, x, y, 5, 54, color);
    text(pageOne, x + 14, y + 34, label, 8, "0.25 0.31 0.42");
    text(pageOne, x + 14, y + 12, String(value), 20, color, true);
  });

  text(pageOne, 36, 585, "Synthese", 13, "0.11 0.22 0.42", true);
  text(pageOne, 36, 565, `Activite totale: ${total}`, 10, "0.18 0.23 0.32");
  if (total > 0 && collaborators[0]) text(pageOne, 36, 547, `Collaborateur le plus actif: ${collaborators[0][0]} (${collaborators[0][1]} activite(s))`, 9, "0.18 0.23 0.32");
  if (total > 0) text(pageOne, 36, 531, `Repository le plus actif: ${scope}`, 9, "0.18 0.23 0.32");
  if (total === 0) text(pageOne, 36, 547, "Aucune activite reelle disponible pour les filtres selectionnes.", 9, "0.55 0.25 0.18");
  Object.entries(bundle.errors).forEach(([type, message], index) => text(pageOne, 36, 512 - index * 14, `Capacite indisponible (${type}): ${message}`, 7, "0.55 0.25 0.18"));

  text(pageOne, 36, 468, "Repartition par type", 11, "0.11 0.22 0.42", true);
  const typeValues = [["Tickets", counts.issues], ["Pull requests", counts.pulls], ["Commits", counts.commits], ["Reviews", counts.reviews]] as const;
  const typeColors = ["0.16 0.47 0.75", "0.46 0.29 0.76", "0.12 0.58 0.48", "0.88 0.42 0.20"];
  const maxType = Math.max(1, ...typeValues.map(([, value]) => value));
  typeValues.forEach(([label, value], index) => {
    const y = 440 - index * 27;
    text(pageOne, 36, y + 4, `${label} (${value})`, 8, "0.18 0.23 0.32");
    fill(pageOne, 150, y, 360, 12, "0.88 0.91 0.96");
    if (value > 0) fill(pageOne, 150, y, Math.max(3, 360 * value / maxType), 12, typeColors[index]);
  });

  text(pageOne, 36, 315, "Evolution de l'activite", 11, "0.11 0.22 0.42", true);
  const timeline = timelineVolumes(activities);
  if (timeline.length === 0) text(pageOne, 36, 290, "Aucune donnee reelle sur la periode.", 9, "0.55 0.25 0.18");
  else {
    const maxDay = Math.max(1, ...timeline.map(([, value]) => value));
    timeline.slice(-8).forEach(([day, value], index, visible) => {
      const x = 48 + index * (500 / Math.max(1, visible.length));
      const height = 120 * value / maxDay;
      fill(pageOne, x, 178, 32, 120, "0.90 0.93 0.98");
      fill(pageOne, x, 178, 32, Math.max(3, height), "0.16 0.47 0.75");
      text(pageOne, x - 5, 164, day.slice(5), 7, "0.30 0.36 0.46");
      text(pageOne, x + 11, 184 + height, String(value), 7, "0.11 0.22 0.42", true);
    });
  }
  text(pageOne, 36, 112, "Les indicateurs sont descriptifs et correspondent aux activites reelles retournees par Gitea.", 8, "0.34 0.40 0.50");
  text(pageOne, 36, 94, "DailyTrack - donnees sans persistance locale", 7, "0.48 0.53 0.62");

  const pageTwo: string[] = [];
  fill(pageTwo, 0, 0, 595, 842, "0.97 0.98 1");
  text(pageTwo, 36, 806, "Activite par collaborateur", 15, "0.11 0.22 0.42", true);
  text(pageTwo, 36, 788, `${scope} - ${periodLabel(filters)}`, 8, "0.34 0.40 0.50");
  if (collaborators.length === 0) text(pageTwo, 36, 750, "Aucun collaborateur reellement identifie sur cette periode.", 10, "0.55 0.25 0.18");
  else {
    const maxCollaborator = Math.max(1, collaborators[0][1]);
    collaborators.slice(0, 8).forEach(([login, value], index) => {
      const y = 750 - index * 30;
      text(pageTwo, 36, y + 4, `${login} (${value})`, 8, "0.18 0.23 0.32");
      fill(pageTwo, 155, y, 360, 13, "0.88 0.91 0.96");
      fill(pageTwo, 155, y, Math.max(3, 360 * value / maxCollaborator), 13, "0.46 0.29 0.76");
    });
    if (collaborators.length > 8) text(pageTwo, 36, 500, `${collaborators.length - 8} collaborateur(s) supplementaire(s) disponible(s) dans Gitea.`, 8, "0.34 0.40 0.50");
  }

  text(pageTwo, 36, 455, "Activites principales", 13, "0.11 0.22 0.42", true);
  const displayed = activities.slice(0, 8);
  if (displayed.length === 0) text(pageTwo, 36, 425, "Aucune activite reelle a afficher.", 10, "0.55 0.25 0.18");
  else {
    displayed.forEach((item, index) => {
      const y = 420 - index * 42;
      fill(pageTwo, 36, y - 20, 523, 34, index % 2 === 0 ? "1 1 1" : "0.93 0.95 0.98");
      text(pageTwo, 46, y + 2, `${item.type} - ${truncate(item.title || item.id, 62)}`, 8, "0.11 0.22 0.42", true);
      text(pageTwo, 46, y - 11, `${item.author || "Auteur non fourni"} | ${item.repository} | ${formatActivityDate(item.date)}`, 7, "0.30 0.36 0.46");
      if (item.url) text(pageTwo, 350, y - 11, truncate(item.url, 35), 6, "0.16 0.47 0.75");
    });
    if (activities.length > displayed.length) text(pageTwo, 36, 65, `${activities.length - displayed.length} activite(s) supplementaire(s) disponible(s) dans Gitea.`, 8, "0.34 0.40 0.50");
  }
  text(pageTwo, 36, 34, "DailyTrack - rapport genere a partir du dataset Admin filtre", 7, "0.48 0.53 0.62");

  return createPdfDocument(total > 0 ? [pageOne, pageTwo] : [pageOne]);
}

function collaboratorRows(bundle: ExportBundle): string[][] {
  return collaboratorVolumes(bundle).map(([login, count]) => ["collaborator", "", "", login, "", "", "", "", "", String(count)]);
}

function collaboratorVolumes(bundle: ExportBundle): Array<[string, number]> {
  const counts = new Map<string, number>();
  const add = (logins: Array<string | null | undefined>) => {
    for (const login of new Set(logins.filter((value): value is string => Boolean(value)))) counts.set(login, (counts.get(login) ?? 0) + 1);
  };
  bundle.issues.forEach((item) => add([item.author?.login, ...item.assignees.map((user) => user.login)]));
  bundle.pulls.forEach((item) => add([item.author?.login]));
  bundle.commits.forEach((item) => add([item.author?.login, item.committer?.login]));
  bundle.reviews.forEach((item) => add([item.author?.login]));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function activityRows(bundle: ExportBundle, filters: ExportFilters): string[][] {
  return activityItems(bundle, filters).map((item) => ["activity", item.type, item.repository, item.author, item.date, item.status, item.title, item.id, item.url, ""]);
}

function activityItems(bundle: ExportBundle, filters: ExportFilters): Array<{ type: string; repository: string; author: string; date: string; status: string; title: string; id: string; url: string }> {
  const repository = `${filters.owner}/${filters.repository}`;
  return [
    ...bundle.issues.map((item) => ({ type: "issue", repository, author: item.author?.login ?? "", date: item.created_at ?? item.updated_at ?? "", status: item.state ?? "", title: item.title ?? "", id: item.number === null ? "" : String(item.number), url: item.html_url ?? "" })),
    ...bundle.pulls.map((item) => ({ type: "pull_request", repository, author: item.author?.login ?? "", date: item.created_at ?? item.updated_at ?? "", status: item.state ?? "", title: item.title ?? "", id: item.index === null ? "" : String(item.index), url: item.html_url ?? "" })),
    ...bundle.commits.map((item) => ({ type: "commit", repository, author: item.author?.login ?? item.committer?.login ?? "", date: item.created_at ?? "", status: "", title: item.message ?? "", id: item.sha ?? "", url: item.html_url ?? "" })),
    ...bundle.reviews.map((item) => ({ type: "review", repository, author: item.author?.login ?? "", date: item.submitted_at ?? item.updated_at ?? "", status: item.state ?? "", title: "Review", id: item.id === null ? "" : String(item.id), url: item.pull_request_url ?? item.html_url ?? "" })),
  ].sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""));
}

function timelineVolumes(activities: ReturnType<typeof activityItems>): Array<[string, number]> {
  const counts = new Map<string, number>();
  activities.forEach((item) => {
    const day = item.date.slice(0, 10);
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function periodLabel(filters: ExportFilters): string {
  if (!filters.since && !filters.until) return "toutes les dates";
  return `${filters.since ? formatPdfDate(filters.since) : "..."} - ${filters.until ? formatPdfDate(filters.until) : "..."}`;
}

function generatedAt(): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar" }).format(new Date());
}

function formatPdfDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value.slice(0, 10) : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Dakar" }).format(date);
}

function formatActivityDate(value: string): string {
  return value ? formatPdfDate(value) : "date non fournie";
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function fill(commands: string[], x: number, y: number, width: number, height: number, color: string): void {
  commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
}

function text(commands: string[], x: number, y: number, value: string, size: number, color: string, bold = false): void {
  commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${pdfEscape(pdfText(value))}) Tj ET`);
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function createPdfDocument(pages: string[][]): Buffer {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageIds: number[] = [];
  pages.forEach((commands) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = commands.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "latin1");
}

function pdfText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?").slice(0, 120);
}

function pdfEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
