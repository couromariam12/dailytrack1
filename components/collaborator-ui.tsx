import type { ReactNode } from "react";
import type { CommitDto, IssueDto, PaginatedDto, PullRequestDto, RepositoryDto, ReviewDto } from "@/lib/gitea/types";
import Link from "next/link";

export function DataState({ kind, message }: { kind: "loading" | "error" | "empty"; message?: string }) {
  const labels = { loading: "Chargement…", error: "Données indisponibles", empty: "Aucune donnée" };
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-500"><p className="font-semibold text-slate-700">{labels[kind]}</p>{message && <p className="mt-1">{message}</p>}</div>;
}

export function MetricCard({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.7)]"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value ?? "—"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>;
}

export function Section({ title, count, children, action }: { title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  const isAdminChart = title === "Activité dans le temps" || title === "Répartition par type" || title === "Activité par collaborateur";
  return <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.8)] sm:p-6"><div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{typeof count === "number" && <p className="mt-1 text-sm text-slate-500">{count} élément{count > 1 ? "s" : ""}</p>}</div>{action}</div><div className={isAdminChart ? "max-h-72 overflow-y-auto pr-2" : undefined}>{children}</div></section>;
}

export function RepositoryList({ data, selected, onSelect }: { data: PaginatedDto<RepositoryDto>; selected: string; onSelect: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{data.items.map((repository) => { const value = repository.full_name ?? ""; return value ? <Link key={repository.id ?? value} href={`/collaborator/repositories/${value}`} onClick={() => onSelect(value)} className={`rounded-2xl border p-4 text-left transition ${selected === value ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:border-sky-300 hover:bg-slate-50"}`}><span className="block truncate font-semibold text-slate-900">{repository.name ?? "Repository sans nom"}</span><span className="mt-1 block truncate text-sm text-slate-500">{repository.full_name ?? "Nom indisponible"}</span>{repository.private && <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Privé</span>}</Link> : null; })}</div>;
}

export function IssueList({ data, currentLogin }: { data: PaginatedDto<IssueDto>; currentLogin: string | null }) {
  return <div className="max-h-[24rem] overflow-y-auto pr-2">{data.items.map((issue) => <RecordRow key={issue.id ?? issue.number} title={<><span className="mr-2 text-slate-400">#{issue.number ?? "—"}</span>{issue.title ?? "Issue sans titre"}</>} status={issue.state} meta={`${issue.type === "pull_request" ? "Pull request" : "Issue"} · ${issue.author?.login ?? "Auteur indisponible"}${issue.author?.login === currentLogin ? " · vous" : ""}${formatDate(issue.updated_at ?? issue.created_at)}`} details={<><span>Assignées à : {issue.assignees.length ? issue.assignees.map((user) => user.login ?? "Utilisateur non identifié").join(", ") : "Non assignée"}</span>{issue.labels.length > 0 && <span className="flex flex-wrap gap-1">{issue.labels.map((label) => <span key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800">{label}</span>)}</span>}</>} href={issue.html_url} />)}</div>;
}

export function PullRequestList({ data, currentLogin }: { data: PaginatedDto<PullRequestDto>; currentLogin: string | null }) {
  return <div className="max-h-[24rem] overflow-y-auto pr-2">{data.items.map((pull) => <RecordRow key={pull.id ?? pull.index ?? pull.number} title={<><span className="mr-2 text-slate-400">PR #{pull.index ?? pull.number ?? "—"}</span>{pull.title ?? "Pull request sans titre"}</>} status={pull.state} meta={`Pull request · ${pull.author?.login ?? "Auteur indisponible"}${pull.author?.login === currentLogin ? " · vous" : ""}${formatDate(pull.updated_at ?? pull.created_at)}`} href={pull.html_url} />)}</div>;
}

export function CommitList({ data, currentLogin }: { data: PaginatedDto<CommitDto>; currentLogin: string | null }) {
  return <div className="max-h-[24rem] overflow-y-auto pr-2">{data.items.map((commit) => <RecordRow key={commit.sha ?? commit.message} title={commit.message?.split("\n")[0] ?? "Commit sans message"} status={commit.sha ? commit.sha.slice(0, 8) : null} meta={`${commit.author?.login ?? "Auteur indisponible"}${commit.author?.login === currentLogin ? " · vous" : ""}${formatDate(commit.created_at)}`} href={commit.html_url} />)}</div>;
}

export function ReviewList({ data }: { data: PaginatedDto<ReviewDto> }) {
  return <div className="max-h-[24rem] overflow-y-auto pr-2">{data.items.map((review) => <RecordRow key={review.id ?? review.submitted_at} title={`Review · ${review.author?.login ?? "Auteur indisponible"}`} status={review.state} meta={review.submitted_at ? new Date(review.submitted_at).toLocaleDateString("fr-FR") : "Date indisponible"} href={review.pull_request_url ?? null} />)}</div>;
}

function RecordRow({ title, status, meta, details, href }: { title: ReactNode; status: string | null; meta: string; details?: ReactNode; href: string | null }) {
  const content = <div className="min-w-0 flex-1"><p className="break-words font-medium text-slate-900">{title}</p><p className="mt-1 truncate text-sm text-slate-500">{meta}</p>{details && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">{details}</div>}</div>;
  const externalLink = isExternalUrl(href) ? <a className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" href={href} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans Gitea">Ouvrir dans Gitea <span aria-hidden="true">↗</span></a> : null;
  return <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 flex-1 items-start justify-between gap-4">{content}{status && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{status}</span>}</div>{externalLink}</div>;
}

function isExternalUrl(value: string | null): value is string {
  if (!value) return false;
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; } catch { return false; }
}

function formatDate(value: string | null): string { return value ? ` · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(value))}` : ""; }
