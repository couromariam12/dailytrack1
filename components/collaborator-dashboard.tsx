"use client";

import { useEffect, useState } from "react";
import type { DailyActivity } from "@/lib/activity/service";
import type { RepositoryDto } from "@/lib/gitea/types";
import { formatFrenchDate, isoDate, lastWorkday } from "@/lib/date/workday";
import { requestAllPages, request, warningsFor, type Loadable } from "./api-client";
import { ActivityState, CommitList, IssueList, MetricCard, PullRequestList, ReviewList, Section } from "./collaborator-ui";

export default function CollaboratorDashboard() {
  const [defaultDate] = useState(() => isoDate(lastWorkday(new Date())));
  const [date, setDate] = useState(defaultDate);
  const [repository, setRepository] = useState("");
  const [repositories, setRepositories] = useState<Loadable<RepositoryDto[]>>({ data: null, error: null, loading: true });
  const [daily, setDaily] = useState<Loadable<DailyActivity>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    void requestAllPages<RepositoryDto>("/api/repositories?limit=50", controller.signal).then((result) => {
      if (!controller.signal.aborted) setRepositories({ data: result.data, error: result.error, loading: false });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setDaily((current) => ({ ...current, loading: true, error: null }));
    const query = new URLSearchParams({ date });
    if (repository) query.set("repository", repository);
    void request<DailyActivity>(`/api/daily?${query}`, controller.signal).then((result) => {
      if (!controller.signal.aborted) setDaily({ data: result.data, error: result.error, loading: false });
    });
    return () => controller.abort();
  }, [date, repository]);

  const data = daily.data;
  const login = data?.user?.login ?? null;
  const count = (items: unknown[] | undefined) => (daily.loading ? null : items?.length ?? null);
  const state = (kind: "issues" | "pulls" | "commits" | "reviews") => ({ loading: daily.loading, error: daily.error, warnings: warningsFor(data, kind) });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">DailyTrack</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Mon daily</h1>
          <p className="mt-2 text-slate-600">Activité personnelle retournée explicitement par Gitea (journée en UTC).</p>
        </div>
        {login ? <p className="text-sm text-slate-500">{login}</p> : daily.loading ? <p className="text-sm text-slate-500">Chargement de l’utilisateur…</p> : null}
      </header>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Journée analysée</p>
          <h2 className="mt-1 text-xl font-semibold capitalize text-slate-950">{date ? formatFrenchDate(date) : "—"}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="daily-date">Date du daily</label>
          <input id="daily-date" type="date" value={date} max={isoDate(new Date())} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" onClick={() => setDate(defaultDate)} className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Dernier jour ouvré</button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <label className="text-sm font-semibold text-slate-700" htmlFor="daily-repository">Repository</label>
        <select id="daily-repository" value={repository} onChange={(event) => setRepository(event.target.value)} className="max-w-xl rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">Tous les repositories accessibles</option>
          {repositories.data?.map((item) => item.full_name ? <option key={item.full_name} value={item.full_name}>{item.full_name}{item.archived ? " (archivé)" : ""}</option> : null)}
        </select>
        {repositories.loading && <span className="text-sm text-slate-500">Chargement…</span>}
        {repositories.error && <span className="text-sm text-rose-700">{repositories.error}</span>}
        {data && !daily.loading && !repository && <span className="text-sm text-slate-500">{data.repositories} repositories analysés</span>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tickets" value={count(data?.issues)} detail="Issues créées ce jour dont vous êtes l’auteur." />
        <MetricCard label="Pull requests" value={count(data?.pulls)} detail="Pull requests ouvertes ce jour dont vous êtes l’auteur." />
        <MetricCard label="Commits" value={count(data?.commits)} detail="Commits de la branche par défaut dont Gitea vous donne comme auteur ou committer." />
        <MetricCard label="Reviews" value={count(data?.reviews)} detail="Reviews soumises ce jour dont vous êtes l’auteur." />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Tickets" count={count(data?.issues) ?? undefined}>
          <ActivityState {...state("issues")} count={data?.issues.length ?? 0} empty="Aucun ticket pour cette journée."><IssueList items={data?.issues ?? []} currentLogin={login} /></ActivityState>
        </Section>
        <Section title="Pull requests" count={count(data?.pulls) ?? undefined}>
          <ActivityState {...state("pulls")} count={data?.pulls.length ?? 0} empty="Aucune pull request pour cette journée."><PullRequestList items={data?.pulls ?? []} currentLogin={login} /></ActivityState>
        </Section>
        <Section title="Commits" count={count(data?.commits) ?? undefined}>
          <ActivityState {...state("commits")} count={data?.commits.length ?? 0} empty="Aucun commit pour cette journée."><CommitList items={data?.commits ?? []} currentLogin={login} /></ActivityState>
        </Section>
        <Section title="Reviews" count={count(data?.reviews) ?? undefined}>
          <ActivityState {...state("reviews")} count={data?.reviews.length ?? 0} empty="Aucune review pour cette journée."><ReviewList items={data?.reviews ?? []} /></ActivityState>
        </Section>
      </div>
    </div>
  );
}
