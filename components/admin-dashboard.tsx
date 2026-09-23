"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityBundle } from "@/lib/activity/types";
import { periodOptions, periodRange, utcDay, type Period } from "@/lib/date/range";
import type { RepositoryDto } from "@/lib/gitea/types";
import { request, requestAllPages, warningsFor, type Loadable } from "./api-client";
import { ActivityState, CommitList, DataState, IssueList, MetricCard, Pagination, PullRequestList, ReviewList, Section, pageCount, pageOf } from "./collaborator-ui";

export type Bundle = ActivityBundle;
type DayCounts = { issues: number; pulls: number; commits: number; reviews: number };

export default function AdminDashboard() {
  const [repositories, setRepositories] = useState<Loadable<RepositoryDto[]>>({ data: null, error: null, loading: true });
  const [selectedRepository, setSelectedRepository] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [period, setPeriod] = useState<Period>("this_week");
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
    const range = periodRange(period);
    if (range) { query.set("since", range.start); query.set("until", range.end); }
    setBundle((current) => ({ ...current, loading: true, error: null }));
    void request<Bundle>(`/api/activity?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setBundle({ data: result.data, error: result.error, loading: false });
      setPage(1);
    });
    return () => controller.abort();
  }, [selectedRepository, period]);

  const current = bundle.data;
  const collaborators = useMemo(() => (current ? getCollaborators(current) : []), [current]);
  const filtered = useMemo(() => (current ? filterBundle(current, selectedCollaborator) : null), [current, selectedCollaborator]);
  const counts = filtered ? getCounts(filtered) : { issues: 0, pulls: 0, commits: 0, reviews: 0 };
  const total = counts.issues + counts.pulls + counts.commits + counts.reviews;
  const byDay = filtered ? getByDayAndType(filtered) : {};
  const byCollaborator = filtered ? getCollaboratorVolumes(filtered) : [];
  const byType = [
    { label: "Tickets", value: counts.issues, color: "bg-sky-600" },
    { label: "Pull requests", value: counts.pulls, color: "bg-violet-600" },
    { label: "Commits", value: counts.commits, color: "bg-emerald-600" },
    { label: "Reviews", value: counts.reviews, color: "bg-amber-500" },
  ];
  const pages = pageCount(counts.issues, counts.pulls, counts.commits, counts.reviews);
  const metric = (value: number) => (bundle.loading || !filtered ? null : value);
  const state = (kind: "issues" | "pulls" | "commits" | "reviews") => ({ loading: bundle.loading, error: bundle.error, warnings: warningsFor(current, kind) });
  const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal";
  const labelClass = "flex flex-col gap-2 text-sm font-semibold text-slate-700";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Espace Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Activité des repositories</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Une lecture descriptive des activités réellement retournées par Gitea, avec les droits de votre compte.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
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
        <label className={labelClass}>Période (UTC)
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className={selectClass}>
            {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      {repositories.loading && <DataState kind="loading" message="Chargement des repositories Gitea…" />}
      {repositories.error && <DataState kind="error" message={repositories.error} />}
      {!repositories.loading && !repositories.error && !repositories.data?.length && <DataState kind="empty" message="Aucun repository accessible depuis Gitea." />}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tickets" value={metric(counts.issues)} detail="Issues créées sur la période." />
        <MetricCard label="Pull requests" value={metric(counts.pulls)} detail="Pull requests ouvertes sur la période." />
        <MetricCard label="Commits" value={metric(counts.commits)} detail="Commits de la branche par défaut sur la période." />
        <MetricCard label="Reviews" value={metric(counts.reviews)} detail="Reviews soumises sur la période." />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Activité dans le temps" scroll>
          <div className="space-y-3">
            {Object.keys(byDay).length ? Object.entries(byDay).map(([day, values]) => (
              <div key={day} className="rounded-xl bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">{day}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <span>Tickets <strong className="text-slate-900">{values.issues}</strong></span>
                  <span>PR <strong className="text-slate-900">{values.pulls}</strong></span>
                  <span>Commits <strong className="text-slate-900">{values.commits}</strong></span>
                  <span>Reviews <strong className="text-slate-900">{values.reviews}</strong></span>
                </div>
              </div>
            )) : <DataState kind={bundle.loading ? "loading" : "empty"} message={bundle.loading ? undefined : "Aucune activité réelle pour cette période."} />}
          </div>
        </Section>
        <Section title="Répartition par type" scroll>
          <div className="space-y-3">
            {total ? byType.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{item.label}</span><strong>{item.value}</strong></div>
                <div className="h-2 rounded-full bg-slate-100"><div className={`${item.color} h-2 rounded-full`} style={{ width: `${(item.value / total) * 100}%` }} /></div>
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
        <Section title="Tickets / issues" count={metric(counts.issues) ?? undefined}>
          <ActivityState {...state("issues")} count={counts.issues} empty="Aucun ticket pour ce périmètre."><IssueList items={pageOf(filtered?.issues ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Pull requests" count={metric(counts.pulls) ?? undefined}>
          <ActivityState {...state("pulls")} count={counts.pulls} empty="Aucune pull request pour ce périmètre."><PullRequestList items={pageOf(filtered?.pulls ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Commits" count={metric(counts.commits) ?? undefined}>
          <ActivityState {...state("commits")} count={counts.commits} empty="Aucun commit pour ce périmètre."><CommitList items={pageOf(filtered?.commits ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>
        <Section title="Reviews" count={metric(counts.reviews) ?? undefined}>
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

export function getCounts(bundle: Bundle): DayCounts {
  return { issues: bundle.issues.length, pulls: bundle.pulls.length, commits: bundle.commits.length, reviews: bundle.reviews.length };
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
