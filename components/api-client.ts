import type { ActivityBundle, ActivityWarning } from "@/lib/activity/types";
import type { PaginatedDto } from "@/lib/gitea/types";

export type Result<T> = { data: T | null; error: string | null };
export type Loadable<T> = { data: T | null; error: string | null; loading: boolean };

const SESSION_ERRORS = new Set(["SESSION_REQUIRED", "SESSION_EXPIRED", "SESSION_INVALID"]);

/**
 * GET a DailyTrack API route. An expired session sends the browser through the Gitea login again.
 * Callers pass an AbortSignal and must ignore the result once it is aborted.
 */
export async function request<T>(url: string, signal?: AbortSignal): Promise<Result<T>> {
  try {
    const response = await fetch(url, { signal, cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return { data: body as T, error: null };
    const code = errorField(body, "code");
    if (response.status === 401 && code && SESSION_ERRORS.has(code) && typeof window !== "undefined") {
      window.location.assign("/api/auth/gitea/login");
      return { data: null, error: "Session expirée, reconnexion…" };
    }
    if (response.status === 403 || response.status === 404 || response.status === 409 || response.status === 504) return { data: null, error: "Cette capacité Gitea est indisponible pour ce périmètre." };
    return { data: null, error: errorField(body, "message") ?? `Accès indisponible (${response.status})` };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { data: null, error: null };
    return { data: null, error: "Impossible de joindre DailyTrack." };
  }
}

/** Follows `pagination.has_more` of a paginated DailyTrack route until the last page. */
export async function requestAllPages<T>(url: string, signal?: AbortSignal, maxPages = 50): Promise<Result<T[]>> {
  const base = new URL(url, "http://dailytrack.local");
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    base.searchParams.set("page", String(page));
    const result = await request<PaginatedDto<T>>(`${base.pathname}?${base.searchParams}`, signal);
    if (result.error || !result.data) return { data: items, error: result.error };
    items.push(...result.data.items);
    if (!result.data.pagination.has_more) return { data: items, error: null };
  }
  return { data: items, error: `Pagination interrompue après ${maxPages} pages.` };
}

export function repositoryHref(fullName: string): string {
  const [owner = "", repository = ""] = fullName.split("/", 2);
  return `/collaborator/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

export function warningsFor(bundle: Pick<ActivityBundle, "warnings"> | null, kind: ActivityWarning["kind"]): ActivityWarning[] {
  return bundle?.warnings.filter((warning) => warning.kind === kind) ?? [];
}

function errorField(body: unknown, field: "code" | "message"): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}
