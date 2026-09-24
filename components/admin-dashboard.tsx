"use client";

import { useEffect, useMemo, useState } from "react";
import { activityKinds, CAPACITY_UNAVAILABLE_CODES, type ActivityBundle, type ActivityKind } from "@/lib/activity/types";
import { customDateRange, periodOptions, periodRange, utcDay, type DateRange, type Period } from "@/lib/date/range";
import type { RepositoryDto } from "@/lib/gitea/types";
import { request, requestAllPages, warningsFor, type Loadable } from "./api-client";
import { ActivityState, CommitList, DataState, IssueList, MetricCard, Pagination, PullRequestList, ReviewList, Section, pageCount, pageOf } from "./collaborator-ui";

export type Bundle = ActivityBundle;
type DayCounts = { issues: number; pulls: number; commits: number; reviews: number };
type ActivityType = "all" | "issues" | "pulls" | "commits" | "reviews";
const activityTypeOptions: Array<[ActivityType, string]> = [["all", "Tous les types"], ["issues", "Tickets"], ["pulls", "Pull requests"], ["commits", "Commits"], ["reviews", "Reviews"]];

export default function AdminDashboard() {
  const [repositories, setRepositories] = useState<Loadable<RepositoryDto[]>>({ data: null, error: null, loading: true });
  const [selectedRepository, setSelectedRepository] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [period, setPeriod] = useState<Period>("this_week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("all");
  const [page, setPage] = useState(1);
  const [bundle, setBundle] = useState<Loadable<Bundle>>({ data: null, error: null, loading: false });

  useEffect(() => {
    const controller = new AbortController();
    void requestAllPages<RepositoryDto>("/api/repositories?limit=50", controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setRepositories({ data: result.data, error: result.error, loading: false });
      setSelectedRepository((current) => current || result.data?.find((item) => item.full_name)?.full_name || "");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const [owner, repository] = selectedRepository.split("/", 2);
    if (!owner || !repository) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ owner, repository, state: "all" });
    const range = resolveSelectedRange(period, customStartDate, customEndDate);
    if (period === "custom" && !range) {
      setBundle({ data: null, error: null, loading: false });
      setPage(1);
      return () => controller.abort();
    }
    if (range) { query.set("since", range.start); query.set("until", range.end); }
    setBundle((current) => ({ ...current, loading: true, error: null }));
    void request<Bundle>(`/api/activity?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setBundle({ data: result.data, error: result.error, loading: false });
      setPage(1);
    });
    return () => controller.abort();
  }, [selectedRepository, period, customStartDate, customEndDate]);

  const current = bundle.data;
  const collaborators = useMemo(() => (current ? getCollaborators(current) : []), [current]);
  const filtered = useMemo(() => (current ? filterByType(filterBundle(current, selectedCollaborator), activityType) : null), [current, selectedCollaborator, activityType]);
  const counts = filtered ? getCounts(filtered) : { issues: 0, pulls: 0, commits: 0, reviews: 0 };
  const unavailableKinds = filtered ? new Set<ActivityKind>(activityKinds.filter((kind) => kindUnavailable(filtered, kind))) : new Set<ActivityKind>();
  const byDay = filtered ? getByDayAndType(filtered) : {};
  const byCollaborator = filtered ? getCollaboratorVolumes(filtered) : [];
  const byType = [
    { kind: "issues" as const, label: "Tickets", value: unavailableKinds.has("issues") ? null : counts.issues, color: "bg-sky-600" },
    { kind: "pulls" as const, label: "Pull requests", value: unavailableKinds.has("pulls") ? null : counts.pulls, color: "bg-violet-600" },
    { kind: "commits" as const, label: "Commits", value: unavailableKinds.has("commits") ? null : counts.commits, color: "bg-emerald-600" },
    { kind: "reviews" as const, label: "Reviews", value: unavailableKinds.has("reviews") ? null : counts.reviews, color: "bg-amber-500" },
  ];
  const chartTotal = byType.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const pages = pageCount(counts.issues, counts.pulls, counts.commits, counts.reviews);
  const metric = (kind: ActivityKind) => (bundle.loading || !filtered ? null : getMetricValue(filtered, kind));
  const metricDetail = (kind: ActivityKind, normal: string) => unavailableKinds.has(kind) ? "Capacité indisponible dans Gitea." : normal;
  const state = (kind: "issues" | "pulls" | "commits" | "reviews") => ({ loading: bundle.loading, error: bundle.error, warnings: warningsFor(current, kind) });
  const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal";
  const labelClass = "flex flex-col gap-2 text-sm font-semibold text-slate-700";
  const selectedPeriodLabel = period === "custom"
    ? customStartDate && customEndDate ? `${customStartDate} → ${customEndDate}` : "Dates à sélectionner"
    : periodOptions.find(([value]) => value === period)?.[1] ?? period;
  const selectedRange = selectedRangeForExport(period, customStartDate, customEndDate);
  const customRangeError = period === "custom" && !selectedRange ? "Sélectionnez une date de début et une date de fin valides." : null;
  const exportHref = (format: "csv" | "pdf") => {
    const [owner, repository] = selectedRepository.split("/", 2);
    if (!owner || !repository) return undefined;
    const params = new URLSearchParams({ owner, repository, type: activityType });
    if (selectedCollaborator) params.set("collaborator", selectedCollaborator);
    const range = selectedRange;
    if (range) { params.set("since", range.start); params.set("until", range.end); }
    return `/api/admin/export/${format}?${params.toString()}`;
  };
  const filteredTotal = chartTotal;
  const currentTotal = current ? Object.values(getCounts(current)).reduce((sum, value) => sum + value, 0) : 0;
  const emptyMessage = unavailableKinds.size
    ? "Une ou plusieurs capacités Gitea sont indisponibles pour ce périmètre."
    : currentTotal === 0
      ? "Aucune activité réelle n’existe pour ce périmètre."
      : "Aucune activité réelle ne correspond aux filtres sélectionnés.";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Espace Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Activité des repositories</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Une lecture descriptive des activités réellement retournées par Gitea, avec les droits de votre compte.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <label className={labelClass}>Repository
          <select value={selectedRepository} onChange={(event) => { setSelectedRepository(event.target.value); setSelectedCollaborator(""); }} className={selectClass}>
            {repositories.data?.map((item) => item.full_name ? <option key={item.full_name} value={item.full_name}>{item.full_name}{item.archived ? " (archivé)" : ""}</option> : null)}
          </select>
        </label>
        <label className={labelClass}>Collaborateur
          <select value={selectedCollaborator} onChange={(event) => { setSelectedCollaborator(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">Tous les collaborateurs</option>
            {collaborators.map((person) => <option key={person} value={person}>{person}</option>)}
          </select>
        </label>
        <label className={labelClass}>Période
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className={selectClass}>
            {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>Type d’activité
          <select value={activityType} onChange={(event) => { setActivityType(event.target.value as ActivityType); setPage(1); }} className={selectClass}>
            {activityTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {period === "custom" && <div className="col-span-full grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Date de début
            <input type="date" value={customStartDate} onChange={(event) => { setCustomStartDate(event.target.value); setPage(1); }} className={selectClass} aria-label="Date de début" />
          </label>
          <label className={labelClass}>Date de fin
            <input type="date" value={customEndDate} onChange={(event) => { setCustomEndDate(event.target.value); setPage(1); }} className={selectClass} aria-label="Date de fin" />
          </label>
        </div>}
      </section>

      <div className="flex flex-wrap items-center gap-3" aria-label="Exports Admin">
        <a href={exportHref("csv")} download={Boolean(exportHref("csv"))} aria-disabled={!exportHref("csv")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${exportHref("csv") ? "bg-sky-700 text-white hover:bg-sky-800" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}>Exporter CSV</a>
        <a href={exportHref("pdf")} download={Boolean(exportHref("pdf"))} aria-disabled={!exportHref("pdf")} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${exportHref("pdf") ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "cursor-not-allowed border-slate-200 text-slate-400"}`}>Exporter PDF</a>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" aria-label="Périmètre sélectionné">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>Repository sélectionné : <strong>{selectedRepository || "Aucun repository"}</strong></span>
          <span>Période sélectionnée : <strong>{selectedPeriodLabel}</strong></span>
        </div>
      </section>

      {customRangeError && <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{customRangeError}</p>}

      {repositories.loading && <DataState kind="loading" message="Chargement des repositories Gitea…" />}
      {repositories.error && <DataState kind="error" message={repositories.error} />}
      {!repositories.loading && !repositories.error && !repositories.data?.length && <DataState kind="empty" message="Aucun repository accessible depuis Gitea." />}
      {!bundle.loading && filtered && filteredTotal === 0 && <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${unavailableKinds.size ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>{emptyMessage}</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tickets" value={metric("issues")} detail={metricDetail("issues", "Issues créées sur la période.")} />
        <MetricCard label="Pull requests" value={metric("pulls")} detail={metricDetail("pulls", "Pull requests ouvertes sur la période.")} />
        <MetricCard label="Commits" value={metric("commits")} detail={metricDetail("commits", "Commits de la branche par défaut sur la période.")} />
        <MetricCard label="Reviews" value={metric("reviews")} detail={metricDetail("reviews", "Reviews soumises sur la période.")} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Activité dans le temps" scroll>
          <div className="space-y-3">
            {Object.keys(byDay).length ? Object.entries(byDay).map(([day, values]) => (
              <div key={day} className="rounded-xl bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">{day}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <span>Tickets <strong className="text-slate-900">{unavailableKinds.has("issues") ? "—" : values.issues}</strong></span>
                  <span>PR <strong className="text-slate-900">{unavailableKinds.has("pulls") ? "—" : values.pulls}</strong></span>
                  <span>Commits <strong className="text-slate-900">{unavailableKinds.has("commits") ? "—" : values.commits}</strong></span>
                  <span>Reviews <strong className="text-slate-900">{unavailableKinds.has("reviews") ? "—" : values.reviews}</strong></span>
                </div>
              </div>
            )) : <DataState kind={bundle.loading ? "loading" : "empty"} message={bundle.loading ? undefined : "Aucune activité réelle pour cette période."} />}
          </div>
        </Section>
        <Section title="Répartition par type" scroll>
          <div className="space-y-3">
            {chartTotal ? byType.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{item.label}</span><strong>{item.value === null ? "—" : item.value}</strong></div>
                {item.value !== null && <div className="h-2 rounded-full bg-slate-100"><div className={`${item.color} h-2 rounded-full`} style={{ width: `${(item.value / chartTotal) * 100}%` }} /></div>}
                {item.value === null && <p className="text-xs text-amber-700">Capacité indisponible dans Gitea.</p>}
              </div>
            )) : <DataState kind={bundle.loading ? "loading" : "empty"} message={bundle.loading ? undefined : "Aucune activité réelle à répartir."} />}
          </div>
        </Section>
      </div>

      <Section title="Activité par collaborateur" scroll action={<span className="text-sm text-slate-500">Volume descriptif, sans classement de productivité</span>}>
        <div className="space-y-3">
          {byCollaborator.length ? byCollaborator.map((item) => (
            <div key={item.login} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-800">{item.login}</span>
              <span className="text-sm font-semibold text-slate-900">{item.count} activité{item.count > 1 ? "s" : ""}</span>
            </div>
          )) : <DataState kind={bundle.loading ? "loading" : "empty"} message={bundle.loading ? undefined : "Aucun collaborateur identifié dans cette période."} />}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Tickets / issues" count={metric("issues") ?? undefined}>
          <ActivityState {...state("issues")} count={counts.issues} empty="Aucun ticket pour ce périmètre."><IssueList items={pageOf(filtered?.issues ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Pull requests" count={metric("pulls") ?? undefined}>
          <ActivityState {...state("pulls")} count={counts.pulls} empty="Aucune pull request pour ce périmètre."><PullRequestList items={pageOf(filtered?.pulls ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Commits" count={metric("commits") ?? undefined}>
          <ActivityState {...state("commits")} count={counts.commits} empty="Aucun commit pour ce périmètre."><CommitList items={pageOf(filtered?.commits ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Reviews" count={metric("reviews") ?? undefined}>
          <ActivityState {...state("reviews")} count={counts.reviews} empty="Aucune review pour ce périmètre."><ReviewList items={pageOf(filtered?.reviews ?? [], page)} /></ActivityState>
        </Section>
      </div>
      <Pagination page={page} pages={pages} onChange={setPage} label="Pagination admin" />
    </div>
  );
}

function getCollaborators(bundle: Bundle): string[] {
  const logins = [
    ...bundle.issues.flatMap((item) => [item.author?.login, ...item.assignees.map((user) => user.login)]),
    ...bundle.pulls.map((item) => item.author?.login),
    ...bundle.commits.flatMap((item) => [item.author?.login, item.committer?.login]),
    ...bundle.reviews.map((item) => item.author?.login),
  ];
  return [...new Set(logins.filter((value): value is string => Boolean(value)))].sort();
}

export function selectedRangeForExport(period: Period, startDate: string, endDate: string): DateRange | null {
  return period === "custom" ? customDateRange(startDate, endDate) : periodRange(period);
}

function resolveSelectedRange(period: Period, startDate: string, endDate: string): DateRange | null {
  return selectedRangeForExport(period, startDate, endDate);
}

export function getCounts(bundle: Bundle): DayCounts {
  return { issues: bundle.issues.length, pulls: bundle.pulls.length, commits: bundle.commits.length, reviews: bundle.reviews.length };
}

export function kindUnavailable(bundle: Bundle, kind: ActivityKind): boolean {
  return bundle.warnings.some((warning) => warning.kind === kind && CAPACITY_UNAVAILABLE_CODES.has(warning.code));
}

export function getMetricValue(bundle: Bundle, kind: ActivityKind): number | null {
  return kindUnavailable(bundle, kind) ? null : getCounts(bundle)[kind];
}

export function filterBundle(bundle: Bundle, collaborator: string): Bundle {
  if (!collaborator) return bundle;
  return {
    ...bundle,
    issues: bundle.issues.filter((item) => item.author?.login === collaborator || item.assignees.some((user) => user.login === collaborator)),
    pulls: bundle.pulls.filter((item) => item.author?.login === collaborator),
    commits: bundle.commits.filter((item) => item.author?.login === collaborator || item.committer?.login === collaborator),
    reviews: bundle.reviews.filter((item) => item.author?.login === collaborator),
  };
}

export function filterByType(bundle: Bundle, type: ActivityType): Bundle {
  if (type === "all") return bundle;
  return {
    ...bundle,
    issues: type === "issues" ? bundle.issues : [],
    pulls: type === "pulls" ? bundle.pulls : [],
    commits: type === "commits" ? bundle.commits : [],
    reviews: type === "reviews" ? bundle.reviews : [],
  };
}

/** Activity per UTC day, most recent day first. */
export function getByDayAndType(bundle: Bundle): Record<string, DayCounts> {
  const result: Record<string, DayCounts> = {};
  const add = (date: string | null | undefined, type: keyof DayCounts) => {
    const day = utcDay(date);
    if (!day) return;
    result[day] ??= { issues: 0, pulls: 0, commits: 0, reviews: 0 };
    result[day][type] += 1;
  };
  bundle.issues.forEach((item) => add(item.created_at ?? item.updated_at, "issues"));
  bundle.pulls.forEach((item) => add(item.created_at ?? item.updated_at, "pulls"));
  bundle.commits.forEach((item) => add(item.created_at, "commits"));
  bundle.reviews.forEach((item) => add(item.submitted_at ?? item.updated_at, "reviews"));
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => right.localeCompare(left)));
}

export function getCollaboratorVolumes(bundle: Bundle): Array<{ login: string; count: number }> {
  const counts = new Map<string, number>();
  const add = (logins: Array<string | null | undefined>) => {
    for (const login of new Set(logins.filter((value): value is string => Boolean(value)))) counts.set(login, (counts.get(login) ?? 0) + 1);
  };
  bundle.issues.forEach((item) => add([item.author?.login, ...item.assignees.map((user) => user.login)]));
  bundle.pulls.forEach((item) => add([item.author?.login]));
  bundle.commits.forEach((item) => add([item.author?.login, item.committer?.login]));
  bundle.reviews.forEach((item) => add([item.author?.login]));
  return [...counts.entries()].map(([login, count]) => ({ login, count })).sort((left, right) => right.count - left.count || left.login.localeCompare(right.login));
}
