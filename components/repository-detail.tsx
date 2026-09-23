"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ActivityBundle, ActivityKind } from "@/lib/activity/types";
import { periodOptions, periodRange, type Period } from "@/lib/date/range";
import type { RepositoryDto } from "@/lib/gitea/types";
import { request, requestAllPages, warningsFor, type Loadable } from "./api-client";
import { ActivityState, CommitList, DataState, IssueList, Pagination, PullRequestList, ReviewList, Section, pageCount, pageOf } from "./collaborator-ui";

type TypeFilter = "all" | ActivityKind;
type Filters = { type: TypeFilter; state: "all" | "open" | "closed"; period: Period; createdBy: string; assignedBy: string };
const defaultFilters: Filters = { type: "all", state: "all", period: "all", createdBy: "", assignedBy: "" };
const descriptions: Record<TypeFilter, string> = { all: "Toute l’activité du dépôt", issues: "Issues du dépôt", pulls: "Pull requests du dépôt", commits: "Commits du dépôt", reviews: "Reviews du dépôt" };

export default function RepositoryDetail({ owner, repository }: { owner: string; repository: string }) {
  const fullName = `${owner}/${repository}`;
  const [repo, setRepo] = useState<Loadable<RepositoryDto>>({ data: null, error: null, loading: true });
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [people, setPeople] = useState({ createdBy: "", assignedBy: "" });
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [activity, setActivity] = useState<Loadable<ActivityBundle>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    void requestAllPages<RepositoryDto>("/api/repositories?limit=50", controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const found = result.data?.find((item) => item.full_name === fullName) ?? null;
      setRepo({ data: found, error: result.error ?? (found ? null : "Repository non retourné par Gitea."), loading: false });
    });
    return () => controller.abort();
  }, [fullName]);

  useEffect(() => {
    const controller = new AbortController();
    const kind = filters.type;
    const query = new URLSearchParams({ owner, repository, state: filters.state, types: kind === "all" ? "issues,pulls,commits,reviews" : kind });
    const range = periodRange(filters.period);
    if (range) { query.set("since", range.start); query.set("until", range.end); }
    if (filters.createdBy) query.set("created_by", filters.createdBy);
    if (filters.assignedBy) query.set("assigned_by", filters.assignedBy);
    setActivity((current) => ({ ...current, loading: true, error: null }));
    void request<ActivityBundle>(`/api/activity?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setActivity({ data: result.data, error: result.error, loading: false });
      setPage(1);
    });
    return () => controller.abort();
  }, [owner, repository, filters, reload]);

  const data = activity.data;
  const knownUsers = useMemo(() => {
    if (!data) return [];
    const logins = [
      ...data.issues.flatMap((item) => [item.author?.login, ...item.assignees.map((user) => user.login)]),
      ...data.pulls.map((item) => item.author?.login),
      ...data.commits.flatMap((item) => [item.author?.login, item.committer?.login]),
      ...data.reviews.map((item) => item.author?.login),
    ];
    return [...new Set(logins.filter((login): login is string => Boolean(login)))].sort();
  }, [data]);

  const shows = (kind: ActivityKind) => filters.type === "all" || filters.type === kind;
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const applyPeople = () => setFilters((current) => ({ ...current, createdBy: people.createdBy.trim(), assignedBy: people.assignedBy.trim() }));
  const resetFilters = () => { setPeople({ createdBy: "", assignedBy: "" }); setFilters(defaultFilters); };
  const pages = pageCount(data?.issues.length ?? 0, data?.pulls.length ?? 0, data?.commits.length ?? 0, data?.reviews.length ?? 0);
  const state = (kind: ActivityKind) => ({ loading: activity.loading, error: activity.error, warnings: warningsFor(data, kind) });
  const selectClass = "rounded-xl border border-slate-200 px-3 py-2 font-normal text-slate-800";
  const labelClass = "flex flex-col gap-2 text-sm font-medium text-slate-600";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Link href="/collaborator" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:underline">← Retour au daily</Link>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Détail du repository</p>
          <h1 className="mt-2 break-all text-3xl font-semibold tracking-tight text-slate-950">{repo.data?.full_name ?? fullName}</h1>
          <p className="mt-2 max-w-xl text-slate-600">{repo.data?.description || (repo.loading ? "Chargement…" : "Description indisponible.")}</p>
        </div>
        {repo.data?.html_url && <a className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50" href={repo.data.html_url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le repository dans Gitea">Ouvrir dans Gitea ↗</a>}
      </header>
      {repo.error && <DataState kind="error" message={repo.error} />}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Filtres du repository">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Activités du dépôt</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{descriptions[filters.type]}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className={labelClass}>Type
            <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as TypeFilter)} className={selectClass}>
              <option value="all">Tous</option>
              <option value="issues">Issues</option>
              <option value="pulls">Pull requests</option>
              <option value="commits">Commits</option>
              <option value="reviews">Reviews</option>
            </select>
          </label>
          <label className={labelClass}>État (issues et PR)
            <select value={filters.state} onChange={(event) => updateFilter("state", event.target.value as Filters["state"])} className={selectClass}>
              <option value="all">Tous</option>
              <option value="open">Ouverts</option>
              <option value="closed">Fermés</option>
            </select>
          </label>
          <label className={labelClass}>Période (UTC)
            <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as Period)} className={selectClass}>
              {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <form className="mt-4" onSubmit={(event) => { event.preventDefault(); applyPeople(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Auteur
              <input value={people.createdBy} onChange={(event) => setPeople((current) => ({ ...current, createdBy: event.target.value }))} list="repository-users" placeholder="Tous les utilisateurs" maxLength={255} className={selectClass} />
            </label>
            <label className={labelClass}>Assignées à (issues)
              <input value={people.assignedBy} onChange={(event) => setPeople((current) => ({ ...current, assignedBy: event.target.value }))} list="repository-users" placeholder="Tous les utilisateurs" maxLength={255} className={selectClass} />
            </label>
          </div>
          <datalist id="repository-users">{knownUsers.map((user) => <option key={user} value={user} />)}</datalist>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white">Appliquer</button>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Actualiser</button>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Réinitialiser</button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {shows("issues") && <Section title="Issues / tickets" count={activity.loading ? undefined : data?.issues.length}>
          <ActivityState {...state("issues")} count={data?.issues.length ?? 0} empty="Aucun ticket pour les filtres sélectionnés."><IssueList items={pageOf(data?.issues ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>}
        {shows("pulls") && <Section title="Pull requests" count={activity.loading ? undefined : data?.pulls.length}>
          <ActivityState {...state("pulls")} count={data?.pulls.length ?? 0} empty="Aucune pull request pour les filtres sélectionnés."><PullRequestList items={pageOf(data?.pulls ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>}
        {shows("commits") && <Section title="Commits" count={activity.loading ? undefined : data?.commits.length}>
          <ActivityState {...state("commits")} count={data?.commits.length ?? 0} empty="Aucun commit pour les filtres sélectionnés."><CommitList items={pageOf(data?.commits ?? [], page)} currentLogin={null} /></ActivityState>
        </Section>}
        {shows("reviews") && <Section title="Reviews" count={activity.loading ? undefined : data?.reviews.length}>
          <ActivityState {...state("reviews")} count={data?.reviews.length ?? 0} empty="Aucune review pour les filtres sélectionnés."><ReviewList items={pageOf(data?.reviews ?? [], page)} /></ActivityState>
        </Section>}
      </div>
      <Pagination page={page} pages={pages} onChange={setPage} label="Pagination du repository" />
    </div>
  );
}
