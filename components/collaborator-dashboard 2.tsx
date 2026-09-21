"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommitDto, GiteaUserDto, IssueDto, PaginatedDto, PullRequestDto, RepositoryDto, ReviewDto } from "@/lib/gitea/types";
import { formatFrenchDate, isoDate, lastWorkday } from "@/lib/date/workday";
import { CommitList, DataState, IssueList, MetricCard, PullRequestList, RepositoryList, ReviewList, Section } from "./collaborator-ui";

type Dataset<T> = { data: PaginatedDto<T> | null; error: string | null; loading: boolean };
type Result<T> = { data: T | null; error: string | null };
const empty = <T,>(): Dataset<T> => ({ data: null, error: null, loading: false });

export default function CollaboratorDashboard() {
  const defaultDate = isoDate(lastWorkday(new Date()));
  const [me, setMe] = useState<GiteaUserDto | null>(null);
  const [meError, setMeError] = useState("");
  const [repositories, setRepositories] = useState<Dataset<RepositoryDto>>({ ...empty(), loading: true });
  const [selectedRepo, setSelectedRepo] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<Dataset<IssueDto>>(empty());
  const [pulls, setPulls] = useState<Dataset<PullRequestDto>>(empty());
  const [commits, setCommits] = useState<Dataset<CommitDto>>(empty());
  const [reviews, setReviews] = useState<Dataset<ReviewDto>>(empty());

  useEffect(() => { void loadMe(); void loadRepositories(); }, []);
  useEffect(() => { if (me && repositories.data) void loadActivity(repositories.data.items, selectedRepo, date, page); }, [me, repositories.data, selectedRepo, date, page]);

  async function loadMe() { const result = await request<GiteaUserDto>("/api/me"); setMe(result.data); setMeError(result.error ?? ""); }
  async function loadRepositories() { const result = await request<PaginatedDto<RepositoryDto>>("/api/repositories?page=1&limit=100"); setRepositories({ data: result.data, error: result.error, loading: false }); }

  async function loadActivity(all: RepositoryDto[], chosen: string, selectedDate: string, currentPage: number) {
    const repos = chosen ? all.filter((repo) => repo.full_name === chosen) : all;
    setIssues((state) => ({ ...state, loading: true, error: null })); setPulls((state) => ({ ...state, loading: true, error: null })); setCommits((state) => ({ ...state, loading: true, error: null })); setReviews({ data: null, loading: true, error: null });
    const results = await Promise.all(repos.flatMap((repo) => { const fullName = repo.full_name ?? ""; const [owner, repository] = fullName.split("/", 2); if (!owner || !repository) return []; const query = new URLSearchParams({ owner, repository, page: String(currentPage), limit: "20", since: `${selectedDate}T00:00:00Z`, until: `${selectedDate}T23:59:59Z` }); return [{ repo, query, owner, repository }]; }).map(async ({ query, owner, repository }) => Promise.all([request<PaginatedDto<IssueDto>>(`/api/issues?${query}&type=issues`), request<PaginatedDto<PullRequestDto>>(`/api/pull-requests?${query}`), request<PaginatedDto<CommitDto>>(`/api/commits?${query}`), owner, repository])));
    const issueItems = results.flatMap(([result]) => result.data?.items.filter((item) => item.type === "issue") ?? []);
    const pullItems = results.flatMap(([, result]) => result.data?.items ?? []);
    const commitItems = results.flatMap(([, , result]) => result.data?.items ?? []);
    setIssues({ data: pageData(issueItems, currentPage), error: results.find(([result]) => result.error)?.[0].error ?? null, loading: false });
    setPulls({ data: pageData(pullItems, currentPage), error: results.find(([, result]) => result.error)?.[1].error ?? null, loading: false });
    setCommits({ data: pageData(commitItems, currentPage), error: results.find(([, , result]) => result.error)?.[2].error ?? null, loading: false });
    const reviewRequests = pullItems.filter((pull) => pull.index !== null).flatMap((pull) => { const repo = pull.html_url?.match(/gitea[^/]+\/([^/]+\/[^/]+)\/pulls/)?.[1] ?? chosen; const [owner, repository] = repo.split("/", 2); return owner && repository && pull.index ? [request<PaginatedDto<ReviewDto>>(`/api/reviews?owner=${encodeURIComponent(owner)}&repository=${encodeURIComponent(repository)}&index=${pull.index}&page=${currentPage}&limit=20`)] : []; });
    const reviewResults = await Promise.all(reviewRequests); setReviews({ data: pageData(reviewResults.flatMap((result) => result.data?.items ?? []), currentPage), error: reviewResults.find((result) => result.error)?.error ?? null, loading: false });
  }

  const current = date === defaultDate ? "Dernier jour ouvré" : "Date sélectionnée";
  const activeRepo = repositories.data?.items.find((repo) => repo.full_name === selectedRepo) ?? null;
  const login = me?.login ?? null;
  const counts = useMemo(() => ({ issues: issues.data?.items.filter((item) => item.type === "issue" && item.author?.login === login).length ?? null, pulls: pulls.data?.items.filter((item) => item.author?.login === login).length ?? null, reviews: reviews.data?.items.filter((item) => item.author?.login === login).length ?? null, commits: commits.data?.items.filter((item) => item.author?.login === login || item.committer?.login === login).length ?? null }), [issues.data, pulls.data, reviews.data, commits.data, login]);
  const changeDate = (value: string) => { setDate(value); setPage(1); }; const resetDate = () => changeDate(defaultDate); const changeRepo = (value: string) => { setSelectedRepo(value); setPage(1); };
  const next = Boolean(issues.data?.pagination.has_more || pulls.data?.pagination.has_more || commits.data?.pagination.has_more);
  return <div className="mx-auto w-full max-w-7xl space-y-7"><header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Espace collaborateur</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">Mon activité</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Une lecture descriptive des activités que Gitea attribue explicitement à votre compte.</p></div><div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">{me ? `Connecté en tant que ${me.login ?? "utilisateur"}` : meError || "Connexion à Gitea…"}</div></header><section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 sm:p-7"><p className="text-sm font-medium text-sky-700">{current}</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><h2 className="text-2xl font-semibold capitalize text-slate-950">Mon activité du {formatFrenchDate(date)}</h2><div className="flex flex-wrap gap-2"><input aria-label="Sélectionner une date" type="date" value={date} onChange={(event) => changeDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" /><button type="button" onClick={resetDate} className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Dernier jour ouvré</button></div></div></section><Section title="Périmètre Gitea" action={<span className="text-sm text-slate-500">{activeRepo?.full_name ?? "Tous les repositories"}</span>}>{repositories.loading ? <DataState kind="loading" /> : repositories.error ? <DataState kind="error" message={repositories.error} /> : repositories.data?.items.length ? <RepositoryList data={repositories.data} selected={selectedRepo} onSelect={changeRepo} /> : <DataState kind="empty" message="Aucun repository accessible depuis Gitea." />}</Section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Issues" value={counts.issues} detail="Issue attribuée à votre compte, hors pull requests." /><MetricCard label="Pull requests" value={counts.pulls} detail="Pull request attribuée à votre compte." /><MetricCard label="Reviews" value={counts.reviews} detail="Review renvoyée par Gitea et attribuée à votre compte." /><MetricCard label="Commits" value={counts.commits} detail="Commit dont l’auteur ou le committer est votre compte." /></div><div className="grid min-w-0 gap-6 xl:grid-cols-2"><Section title="Issues" count={issues.data?.items.length}>{issues.loading ? <DataState kind="loading" /> : issues.error ? <DataState kind="error" message={issues.error} /> : issues.data?.items.length ? <IssueList data={issues.data} currentLogin={login} /> : <DataState kind="empty" message="Aucune issue attribuée pour cette date." />}</Section><Section title="Pull requests" count={pulls.data?.items.length}>{pulls.loading ? <DataState kind="loading" /> : pulls.error ? <DataState kind="error" message={pulls.error} /> : pulls.data?.items.length ? <PullRequestList data={pulls.data} currentLogin={login} /> : <DataState kind="empty" message="Aucune pull request pour cette date." />}</Section><Section title="Commits" count={commits.data?.items.length}>{commits.loading ? <DataState kind="loading" /> : commits.error ? <DataState kind="error" message={commits.error} /> : commits.data?.items.length ? <CommitList data={commits.data} currentLogin={login} /> : <DataState kind="empty" message="Aucun commit pour cette date." />}</Section><Section title="Reviews" count={reviews.data?.items.length}>{reviews.loading ? <DataState kind="loading" /> : reviews.error ? <DataState kind="error" message={reviews.error} /> : reviews.data?.items.length ? <ReviewList data={reviews.data} /> : <DataState kind="empty" message="Aucune review retournée par Gitea pour cette date." />}</Section></div><nav className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3" aria-label="Pagination de l’activité"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Précédente</button><span className="text-sm text-slate-500">Page {page}</span><button type="button" disabled={!next} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Suivante</button></nav></div>;
}

function pageData<T>(items: T[], page: number): PaginatedDto<T> { return { items, pagination: { page, limit: 20, has_more: items.length === 20 } }; }
async function request<T>(url: string): Promise<Result<T>> { try { const response = await fetch(url); const body: unknown = await response.json(); if (!response.ok) return { data: null, error: response.status === 403 || response.status === 404 ? "Cette capacité Gitea est indisponible pour ce périmètre." : isErrorBody(body) ? body.error?.message ?? `Accès indisponible (${response.status})` : `Accès indisponible (${response.status})` }; return { data: body as T, error: null }; } catch { return { data: null, error: "Impossible de joindre Gitea." }; } }
function isErrorBody(value: unknown): value is { error?: { message?: string } } { return typeof value === "object" && value !== null && "error" in value; }
