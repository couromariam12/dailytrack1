import type { ReactNode } from "react";
import { UNAVAILABLE_CODES, type ActivityWarning } from "@/lib/activity/types";
import type { CommitDto, IssueDto, PullRequestDto, ReviewDto } from "@/lib/gitea/types";

export const PAGE_SIZE = 20;

export function DataState({ kind, message }: { kind: "loading" | "error" | "empty"; message?: string }) {
  const labels = { loading: "Chargement…", error: "Données indisponibles", empty: "Aucune donnée" };
  return (
    <div role={kind === "error" ? "alert" : undefined} className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-500">
      <p className="font-semibold text-slate-700">{labels[kind]}</p>
      {message && <p className="mt-1">{message}</p>}
    </div>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.7)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value ?? "—"}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

export function Section({ title, count, children, action, scroll = false }: { title: string; count?: number; children: ReactNode; action?: ReactNode; scroll?: boolean }) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.8)] sm:p-6">
      <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {typeof count === "number" && <p className="mt-1 text-sm text-slate-500">{count} élément{count > 1 ? "s" : ""}</p>}
        </div>
        {action}
      </div>
      <div className={scroll ? "max-h-72 overflow-y-auto pr-2" : undefined}>{children}</div>
    </section>
  );
}

/** Non-blocking notice listing the repositories for which Gitea returned partial data. */
export function WarningNotice({ warnings }: { warnings: ReadonlyArray<ActivityWarning> }) {
  if (!warnings.length) return null;
  const repositories = [...new Set(warnings.map((warning) => warning.repository))];
  const where = repositories.length > 3 ? `${repositories.length} repositories` : repositories.join(", ");
  const message = warnings.every((warning) => warning.code === "TRUNCATED")
    ? `Résultats tronqués aux éléments les plus récents pour ${where}.`
    : warnings.every((warning) => UNAVAILABLE_CODES.has(warning.code))
      ? `Indisponible dans Gitea pour ${where} (fonction désactivée, dépôt vide ou accès refusé).`
      : `Données Gitea partielles pour ${where}.`;
  return <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>;
}

/** Loading, then error, then empty state, then the content. Warnings are shown above partial content. */
export function ActivityState({ loading, error, warnings = [], count, empty, children }: { loading: boolean; error: string | null; warnings?: ReadonlyArray<ActivityWarning>; count: number; empty: string; children: ReactNode }) {
  if (loading) return <DataState kind="loading" />;
  if (error) return <DataState kind="error" message={error} />;
  if (!count) return <>{<WarningNotice warnings={warnings} />}<DataState kind="empty" message={empty} /></>;
  return <><WarningNotice warnings={warnings} />{children}</>;
}

export function pageOf<T>(items: ReadonlyArray<T>, page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export function pageCount(...lengths: number[]): number {
  return Math.max(1, ...lengths.map((length) => Math.ceil(length / PAGE_SIZE)));
}

export function Pagination({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-slate-200 pt-4" aria-label={label}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Précédente</button>
      <span className="text-sm text-slate-500" aria-live="polite">Page {page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Suivante</button>
    </nav>
  );
}

export function IssueList({ items, currentLogin }: { items: ReadonlyArray<IssueDto>; currentLogin: string | null }) {
  return (
    <div className="max-h-[24rem] overflow-y-auto pr-2">
      {items.map((issue, index) => (
        <RecordRow
          key={issue.id ?? issue.html_url ?? index}
          title={<><span className="mr-2 text-slate-400">#{issue.number ?? "—"}</span>{issue.title ?? "Issue sans titre"}</>}
          status={issue.state}
          meta={`${issue.type === "pull_request" ? "Pull request" : "Issue"} · ${authorLabel(issue.author?.login, currentLogin)}${formatDate(issue.created_at ?? issue.updated_at)}`}
          details={<>
            <span>Assignées à : {issue.assignees.length ? issue.assignees.map((user) => user.login ?? "Utilisateur non identifié").join(", ") : "Non assignée"}</span>
            {issue.labels.length > 0 && <span className="flex flex-wrap gap-1">{issue.labels.map((label) => <span key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800">{label}</span>)}</span>}
          </>}
          href={issue.html_url}
        />
      ))}
    </div>
  );
}

export function PullRequestList({ items, currentLogin }: { items: ReadonlyArray<PullRequestDto>; currentLogin: string | null }) {
  return (
    <div className="max-h-[24rem] overflow-y-auto pr-2">
      {items.map((pull, index) => (
        <RecordRow
          key={pull.id ?? pull.html_url ?? index}
          title={<><span className="mr-2 text-slate-400">PR #{pull.index ?? pull.number ?? "—"}</span>{pull.title ?? "Pull request sans titre"}</>}
          status={pull.merged ? "merged" : pull.state}
          meta={`Pull request · ${authorLabel(pull.author?.login, currentLogin)}${formatDate(pull.created_at ?? pull.updated_at)}`}
          href={pull.html_url}
        />
      ))}
    </div>
  );
}

export function CommitList({ items, currentLogin }: { items: ReadonlyArray<CommitDto>; currentLogin: string | null }) {
  return (
    <div className="max-h-[24rem] overflow-y-auto pr-2">
      {items.map((commit, index) => (
        <RecordRow
          key={commit.sha ?? index}
          title={commit.message?.split("\n")[0] ?? "Commit sans message"}
          status={commit.sha ? commit.sha.slice(0, 8) : null}
          meta={`${authorLabel(commit.author?.login ?? commit.committer?.login, currentLogin)}${formatDate(commit.created_at)}`}
          href={commit.html_url}
        />
      ))}
    </div>
  );
}

export function ReviewList({ items }: { items: ReadonlyArray<ReviewDto> }) {
  return (
    <div className="max-h-[24rem] overflow-y-auto pr-2">
      {items.map((review, index) => (
        <RecordRow
          key={review.id ?? index}
          title={`Review · ${review.author?.login ?? "Auteur indisponible"}`}
          status={review.state}
          meta={review.submitted_at ? formatDate(review.submitted_at).slice(3) : "Date indisponible"}
          href={review.pull_request_url ?? null}
        />
      ))}
    </div>
  );
}

function RecordRow({ title, status, meta, details, href }: { title: ReactNode; status: string | null; meta: string; details?: ReactNode; href: string | null }) {
  return (
    <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-slate-900">{title}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{meta}</p>
          {details && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">{details}</div>}
        </div>
        {status && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{status}</span>}
      </div>
      {isExternalUrl(href) && (
        <a className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" href={href} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans Gitea">
          Ouvrir dans Gitea <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );
}

function authorLabel(login: string | null | undefined, currentLogin: string | null): string {
  return `${login ?? "Auteur indisponible"}${login && login === currentLogin ? " · vous" : ""}`;
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

/** Dates are displayed on UTC days, consistently with the daily ranges (see lib/date/range.ts). */
function formatDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return ` · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;
}
