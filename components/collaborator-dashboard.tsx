"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommitDto, GiteaUserDto, IssueDto, PaginatedDto, PullRequestDto, RepositoryDto, ReviewDto } from "@/lib/gitea/types";
import { formatFrenchDate, isoDate, lastWorkday } from "@/lib/date/workday";
import { dayRange, isWithinRange } from "@/lib/date/range";
import { CommitList, DataState, IssueList, MetricCard, PullRequestList, ReviewList, Section } from "./collaborator-ui";

type Result<T> = { data: T | null; error: string | null };
type State<T> = { data: PaginatedDto<T> | null; error: string | null; loading: boolean };
const blank = <T,>(): State<T> => ({ data: null, error: null, loading: false });

export default function CollaboratorDashboard() {
  const defaultDate = isoDate(lastWorkday(new Date()));
  const [me, setMe] = useState<GiteaUserDto | null>(null);
  const [meError, setMeError] = useState("");
  const [repositories, setRepositories] = useState<State<RepositoryDto>>({ ...blank(), loading: true });
  const [repository, setRepository] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<State<IssueDto>>(blank());
  const [pulls, setPulls] = useState<State<PullRequestDto>>(blank());
  const [commits, setCommits] = useState<State<CommitDto>>(blank());
  const [reviews, setReviews] = useState<State<ReviewDto>>(blank());

  useEffect(() => { void loadUser(); void loadRepositories(); }, []);
  // The loader is intentionally recreated with the current filters; the effect dependencies are the filter state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (me && repositories.data) void loadDailyActivity(repositories.data.items, repository, date, page); }, [me, repositories.data, repository, date, page]);

  async function loadUser() { const result = await request<GiteaUserDto>("/api/me"); setMe(result.data); setMeError(result.error ?? ""); }
  async function loadRepositories() { const result = await request<PaginatedDto<RepositoryDto>>("/api/repositories?page=1&limit=100"); setRepositories({ data: result.data, error: result.error, loading: false }); }

  async function loadDailyActivity(allRepositories: RepositoryDto[], selected: string, selectedDate: string, currentPage: number) {
    const selectedRepositories = selected ? allRepositories.filter((item) => item.full_name === selected) : allRepositories;
    setIssues((state) => ({ ...state, loading: true, error: null })); setPulls((state) => ({ ...state, loading: true, error: null })); setCommits((state) => ({ ...state, loading: true, error: null })); setReviews({ data: null, error: null, loading: true });
    const batches = await Promise.all(selectedRepositories.map(async (item) => {
      const [owner, name] = (item.full_name ?? "").split("/", 2);
      if (!owner || !name) return null;
      const range = dayRange(selectedDate);
      const query = new URLSearchParams({ owner, repository: name, page: String(currentPage), limit: "20", since: range.start, until: range.end });
      const issueQuery = new URLSearchParams(query); issueQuery.delete("until"); issueQuery.set("before", range.end);
      const [issue, pull, commit] = await Promise.all([request<PaginatedDto<IssueDto>>(`/api/issues?${issueQuery}&type=issues`), request<PaginatedDto<PullRequestDto>>(`/api/pull-requests?${query}`), request<PaginatedDto<CommitDto>>(`/api/commits?${query}`)]);
      const reviewResults = await Promise.all((pull.data?.items ?? []).filter((entry) => entry.index !== null).map((entry) => request<PaginatedDto<ReviewDto>>(`/api/reviews?${query}&index=${entry.index}`).then((result) => ({ result, parentUrl: entry.html_url }))));
      return { issue, pull, commit, reviews: reviewResults };
    }));
    const valid = batches.filter((batch): batch is NonNullable<typeof batch> => batch !== null);
    const login = me?.login;
    const range = dayRange(selectedDate);
    const mineIssues = valid.flatMap((batch) => batch.issue.data?.items.filter((item) => item.type === "issue" && item.author?.login === login && isWithinRange(item.created_at ?? item.updated_at, range)) ?? []);
    const minePulls = valid.flatMap((batch) => batch.pull.data?.items.filter((item) => item.author?.login === login && isWithinRange(item.created_at ?? item.updated_at, range)) ?? []);
    const mineCommits = valid.flatMap((batch) => batch.commit.data?.items.filter((item) => (item.author?.login === login || item.committer?.login === login) && isWithinRange(item.created_at, range)) ?? []);
    const mineReviews = valid.flatMap((batch) => batch.reviews.flatMap(({ result, parentUrl }) => result.data?.items.filter((item) => item.author?.login === login && isWithinRange(item.submitted_at ?? item.updated_at, range)).map((item) => ({ ...item, pull_request_url: parentUrl })) ?? []));
    setIssues({ data: pageData(mineIssues, currentPage, valid.some((batch) => batch.issue.data?.pagination.has_more)), error: firstError(valid.flatMap((batch) => [batch.issue.error])), loading: false });
    setPulls({ data: pageData(minePulls, currentPage, valid.some((batch) => batch.pull.data?.pagination.has_more)), error: firstError(valid.flatMap((batch) => [batch.pull.error])), loading: false });
    setCommits({ data: pageData(mineCommits, currentPage, valid.some((batch) => batch.commit.data?.pagination.has_more)), error: firstError(valid.flatMap((batch) => [batch.commit.error])), loading: false });
    setReviews({ data: pageData(mineReviews, currentPage, valid.some((batch) => batch.reviews.some(({ result }) => result.data?.pagination.has_more))), error: firstError(valid.flatMap((batch) => batch.reviews.map(({ result }) => result.error))), loading: false });
  }

  const counts = useMemo(() => ({ issues: issues.data?.items.length ?? null, pulls: pulls.data?.items.length ?? null, commits: commits.data?.items.length ?? null, reviews: reviews.data?.items.length ?? null }), [issues.data, pulls.data, commits.data, reviews.data]);
  const updateDate = (value: string) => { setDate(value); setPage(1); }; const updateRepository = (value: string) => { setRepository(value); setPage(1); }; const resetDate = () => updateDate(defaultDate);
  const hasNext = Boolean(issues.data?.pagination.has_more || pulls.data?.pagination.has_more || commits.data?.pagination.has_more || reviews.data?.pagination.has_more);
  return <div className="mx-auto w-full max-w-7xl space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">DailyTrack</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Mon daily</h1><p className="mt-2 text-slate-600">Activité personnelle retournée explicitement par Gitea.</p></div>{me ? <p className="text-sm text-slate-500">{me.login ?? "Utilisateur courant"}</p> : <p className="text-sm text-rose-700">{meError || "Chargement de l’utilisateur…"}</p>}</header><section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Journée analysée</p><h2 className="mt-1 text-xl font-semibold capitalize text-slate-950">{formatFrenchDate(date)}</h2></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="daily-date">Date du daily</label><input id="daily-date" aria-label="Date du daily" type="date" value={date} onChange={(event) => updateDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={resetDate} className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Dernier jour ouvré</button></div></section><section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"><label className="text-sm font-semibold text-slate-700" htmlFor="daily-repository">Repository</label><select id="daily-repository" value={repository} onChange={(event) => updateRepository(event.target.value)} className="max-w-xl rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Tous les repositories accessibles</option>{repositories.data?.items.map((item) => item.full_name ? <option key={item.full_name} value={item.full_name}>{item.full_name}</option> : null)}</select>{repositories.loading && <span className="text-sm text-slate-500">Chargement…</span>}{repositories.error && <span className="text-sm text-rose-700">{repositories.error}</span>}</section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Tickets" value={counts.issues} detail="Issues dont vous êtes explicitement l’auteur." /><MetricCard label="Pull requests" value={counts.pulls} detail="Pull requests dont vous êtes explicitement l’auteur." /><MetricCard label="Commits" value={counts.commits} detail="Commits dont Gitea vous donne comme auteur ou committer." /><MetricCard label="Reviews" value={counts.reviews} detail="Reviews dont vous êtes explicitement l’auteur." /></div><div className="grid gap-4 xl:grid-cols-2"><DailySection title="Tickets" state={issues} empty="Aucun ticket pour cette journée."><IssueList data={issues.data!} currentLogin={me?.login ?? null} /></DailySection><DailySection title="Pull requests" state={pulls} empty="Aucune pull request pour cette journée."><PullRequestList data={pulls.data!} currentLogin={me?.login ?? null} /></DailySection><DailySection title="Commits" state={commits} empty="Aucun commit pour cette journée."><CommitList data={commits.data!} currentLogin={me?.login ?? null} /></DailySection><DailySection title="Reviews" state={reviews} empty="Aucune review retournée pour cette journée."><ReviewList data={reviews.data!} /></DailySection></div><nav className="flex items-center justify-between border-t border-slate-200 pt-4" aria-label="Pagination du daily"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Précédente</button><span className="text-sm text-slate-500">Page {page}</span><button type="button" disabled={!hasNext} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Suivante</button></nav></div>;
}

function DailySection<T>({ title, state, empty, children }: { title: string; state: State<T>; empty: string; children: React.ReactNode }) { return <Section title={title} count={state.data?.items.length}>{state.loading ? <DataState kind="loading" /> : state.data?.items.length ? <>{state.error && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Certaines données Gitea sont indisponibles pour une partie des repositories.</p>}{children}</> : state.error ? <DataState kind="error" message={state.error} /> : <DataState kind="empty" message={empty} />}</Section>; }
function pageData<T>(items: T[], page: number, hasMore: boolean): PaginatedDto<T> { return { items, pagination: { page, limit: 20, has_more: hasMore } }; }
function firstError(errors: Array<string | null>): string | null { return errors.find((value): value is string => Boolean(value)) ?? null; }
async function request<T>(url: string): Promise<Result<T>> { try { const response = await fetch(url); const body: unknown = await response.json(); if (!response.ok) return { data: null, error: response.status === 403 || response.status === 404 ? "Cette capacité Gitea est indisponible pour ce périmètre." : errorMessage(body, response.status) }; return { data: body as T, error: null }; } catch { return { data: null, error: "Impossible de joindre Gitea." }; } }
function errorMessage(value: unknown, status: number): string { if (typeof value === "object" && value !== null && "error" in value) { const error = value.error; if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message; } return `Accès indisponible (${status})`; }
