"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ActivityBundle, ActivityKind } from "@/lib/activity/types";
import { customDateRange, periodOptions, periodRange, type DateRange, type Period } from "@/lib/date/range";
import type { MilestoneDto, RepositoryDto } from "@/lib/gitea/types";
import { request, requestAllPages, warningsFor, type Loadable } from "./api-client";
import { ActivityState, CommitList, DataState, IssueList, Pagination, PullRequestList, ReviewList, Section, pageCount, pageOf } from "./collaborator-ui";

type TypeFilter = "all" | ActivityKind;
type Filters = { type: TypeFilter; state: "all" | "open" | "closed"; period: Period; customStartDate: string; customEndDate: string; createdBy: string; assignedBy: string };
export type MilestoneFilters = { state: "all" | "open" | "closed"; due: "all" | "with_due_date"; search: string };
export const defaultFilters: Filters = { type: "issues", state: "all", period: "all", customStartDate: "", customEndDate: "", createdBy: "", assignedBy: "" };
export const defaultMilestoneFilters: MilestoneFilters = { state: "all", due: "all", search: "" };
const descriptions: Record<TypeFilter, string> = { all: "Toute l’activité du dépôt", issues: "Issues du dépôt", pulls: "Pull requests du dépôt", commits: "Commits du dépôt", reviews: "Reviews du dépôt" };

export default function RepositoryDetail({ owner, repository }: { owner: string; repository: string }) {
  const fullName = `${owner}/${repository}`;
  const [repo, setRepo] = useState<Loadable<RepositoryDto>>({ data: null, error: null, loading: true });
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [people, setPeople] = useState({ createdBy: "", assignedBy: "" });
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [activity, setActivity] = useState<Loadable<ActivityBundle>>({ data: null, error: null, loading: true });
  const [milestones, setMilestones] = useState<Loadable<MilestoneDto[]>>({ data: null, error: null, loading: true });
  const [milestoneFilters, setMilestoneFilters] = useState<MilestoneFilters>(defaultMilestoneFilters);

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
    const query = buildRepositoryActivityQuery(owner, repository, filters);
    const range = repositoryPeriodRange(filters);
    if (filters.period === "custom" && !range) {
      setActivity({ data: null, error: null, loading: false });
      setPage(1);
      return () => controller.abort();
    }
    setActivity((current) => ({ ...current, loading: true, error: null }));
    void request<ActivityBundle>(`/api/activity?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setActivity({ data: result.data, error: result.error, loading: false });
      setPage(1);
    });
    return () => controller.abort();
  }, [owner, repository, filters, reload]);

  useEffect(() => {
    const controller = new AbortController();
    const query = buildMilestonesQuery(owner, repository);
    setMilestones((current) => ({ ...current, loading: true, error: null }));
    void requestAllPages<MilestoneDto>(`/api/milestones?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setMilestones({ data: result.data, error: result.error, loading: false });
    });
    return () => controller.abort();
  }, [owner, repository, reload]);

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
  const visibleMilestones = useMemo(() => filterMilestones(milestones.data ?? [], milestoneFilters), [milestones.data, milestoneFilters]);
  const sprintMilestones = visibleMilestones.filter(isSprintMilestone);
  const otherMilestones = visibleMilestones.filter((item) => !isSprintMilestone(item));
  const customPeriodError = filters.period === "custom" && !repositoryPeriodRange(filters) ? "Sélectionnez une date de début et une date de fin valides." : null;
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
          <label className={labelClass}>Période
            <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as Period)} className={selectClass}>
              {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {filters.period === "custom" && <>
            <label className={labelClass}>Date de début
              <input type="date" value={filters.customStartDate} onChange={(event) => updateFilter("customStartDate", event.target.value)} className={selectClass} aria-label="Date de début de la période" />
            </label>
            <label className={labelClass}>Date de fin
              <input type="date" value={filters.customEndDate} onChange={(event) => updateFilter("customEndDate", event.target.value)} className={selectClass} aria-label="Date de fin de la période" />
            </label>
          </>}
        </div>
        {customPeriodError && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{customPeriodError}</p>}
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

      <Section title="Jalons du repository" count={milestones.loading || milestones.error ? undefined : visibleMilestones.length} scroll>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>État
            <select value={milestoneFilters.state} onChange={(event) => setMilestoneFilters((current) => ({ ...current, state: event.target.value as MilestoneFilters["state"] }))} className={selectClass}>
              <option value="all">Tous les jalons</option>
              <option value="open">Jalons ouverts</option>
              <option value="closed">Jalons fermés</option>
            </select>
          </label>
          <label className={labelClass}>Échéance
            <select value={milestoneFilters.due} onChange={(event) => setMilestoneFilters((current) => ({ ...current, due: event.target.value as MilestoneFilters["due"] }))} className={selectClass}>
              <option value="all">Toutes les échéances</option>
              <option value="with_due_date">Avec une échéance</option>
            </select>
          </label>
          <label className={labelClass}>Rechercher
            <input value={milestoneFilters.search} onChange={(event) => setMilestoneFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nom du jalon" maxLength={255} className={selectClass} />
          </label>
        </div>
        {milestones.loading && <DataState kind="loading" message="Chargement des jalons Gitea…" />}
        {milestones.error && <DataState kind="error" message={milestones.error} />}
        {!milestones.loading && !milestones.error && !milestones.data?.length && <DataState kind="empty" message="Ce repository ne possède aucun jalon retourné par Gitea." />}
        {!milestones.loading && !milestones.error && Boolean(milestones.data?.length) && !visibleMilestones.length ? <DataState kind="empty" message="Aucun jalon ne correspond aux filtres sélectionnés." /> : null}
        {!milestones.loading && !milestones.error && visibleMilestones.length > 0 && <div className="space-y-5">
          {sprintMilestones.length > 0 && <MilestoneGroup title="Jalons commençant par Sprint" repository={fullName} items={sprintMilestones} />}
          {otherMilestones.length > 0 && <MilestoneGroup title="Autres jalons" repository={fullName} items={otherMilestones} />}
        </div>}
      </Section>

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

export function buildRepositoryActivityQuery(owner: string, repository: string, filters: Filters): URLSearchParams {
  const query = new URLSearchParams({ owner, repository, state: filters.state, types: filters.type === "all" ? "issues,pulls,commits,reviews" : filters.type });
  const range = repositoryPeriodRange(filters);
  if (range) { query.set("since", range.start); query.set("until", range.end); }
  if (filters.createdBy) query.set("created_by", filters.createdBy);
  if (filters.assignedBy) query.set("assigned_by", filters.assignedBy);
  return query;
}

export function repositoryPeriodRange(filters: Pick<Filters, "period" | "customStartDate" | "customEndDate">): DateRange | null {
  return filters.period === "custom" ? customDateRange(filters.customStartDate, filters.customEndDate) : periodRange(filters.period);
}

export function filterMilestones(items: ReadonlyArray<MilestoneDto>, filters: MilestoneFilters): MilestoneDto[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesState = filters.state === "all" || item.state === filters.state;
    const matchesDue = filters.due === "all" || Boolean(item.due_on);
    const matchesSearch = !search || (item.title ?? "").toLocaleLowerCase().includes(search);
    return matchesState && matchesDue && matchesSearch;
  });
}

export function buildMilestonesQuery(owner: string, repository: string): URLSearchParams {
  return new URLSearchParams({ owner, repository, state: "all", limit: "50" });
}

export function isSprintMilestone(item: MilestoneDto): boolean {
  return /^sprint(?:\s|$)/i.test(item.title ?? "");
}

export function milestoneProgress(item: MilestoneDto): number | null {
  if (item.open_issues === null || item.closed_issues === null) return null;
  const total = item.open_issues + item.closed_issues;
  return total === 0 ? 0 : Math.round((item.closed_issues / total) * 100);
}

function MilestoneGroup({ title, repository, items }: { title: string; repository: string; items: ReadonlyArray<MilestoneDto> }) {
  return <div>
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
    <div className="space-y-3">
      {items.map((item, index) => <MilestoneCard key={item.id ?? `${repository}-${item.title ?? "milestone"}-${index}`} repository={repository} item={item} />)}
    </div>
  </div>;
}

function MilestoneCard({ repository, item }: { repository: string; item: MilestoneDto }) {
  const progress = milestoneProgress(item);
  const externalUrl = milestoneExternalUrl(item);
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h4 className="break-words font-semibold text-slate-950">{item.title ?? "Jalon sans nom"}</h4>
        <p className="mt-1 text-xs text-slate-500">Repository : {repository}</p>
        {item.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.description}</p>}
      </div>
      <span className="w-fit shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{item.state ?? "État non fourni"}</span>
    </div>
    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
      <span>Issues ouvertes : <strong className="text-slate-900">{item.open_issues ?? "—"}</strong></span>
      <span>Issues fermées : <strong className="text-slate-900">{item.closed_issues ?? "—"}</strong></span>
      {item.due_on && <span>Échéance : <strong className="text-slate-900">{formatMilestoneDate(item.due_on)}</strong></span>}
      {item.created_at && <span>Créé le : <strong className="text-slate-900">{formatMilestoneDate(item.created_at)}</strong></span>}
      {item.updated_at && <span>Mis à jour le : <strong className="text-slate-900">{formatMilestoneDate(item.updated_at)}</strong></span>}
    </div>
    {progress !== null && <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs font-medium text-slate-600"><span>Progression</span><span>{progress}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={`Progression de ${item.title ?? "ce jalon"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-sky-600" style={{ width: `${progress}%` }} /></div>
    </div>}
    {externalUrl && <a className="mt-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600" href={externalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le jalon ${item.title ?? "dans Gitea"} dans Gitea`}>Ouvrir dans Gitea <span aria-hidden="true">↗</span></a>}
  </article>;
}

function formatMilestoneDate(value: string): string {
  if (!Number.isFinite(Date.parse(value))) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function isExternalUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function milestoneExternalUrl(item: MilestoneDto): string | null {
  return isExternalUrl(item.html_url) ? item.html_url : null;
}
