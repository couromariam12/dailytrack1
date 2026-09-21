import { GiteaAdapterError, fromGiteaStatus } from "./errors";
import type { JsonValue } from "./types";

type FetchLike = typeof fetch;
type Query = Record<string, string | number | undefined>;

export class GiteaServerClient {
  public constructor(
    private readonly baseUrl: string = process.env.GITEA_URL ?? "",
    private readonly token: string = process.env.GITEA_TOKEN ?? "",
    private readonly timeoutMs: number = Number(process.env.GITEA_TIMEOUT_SECONDS ?? "10") * 1000,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  public getCurrentUser(): Promise<JsonValue> { return this.request("/user"); }
  public listRepositories(page: number, limit: number): Promise<JsonValue[]> { return this.list("/user/repos", { page, limit }); }
  public listIssues(owner: string, repository: string, query: Query): Promise<JsonValue[]> { return this.list(this.repoPath(owner, repository, "/issues"), query); }
  public listPullRequests(owner: string, repository: string, query: Query): Promise<JsonValue[]> { return this.list(this.repoPath(owner, repository, "/pulls"), query); }
  public listReviews(owner: string, repository: string, index: number, page: number, limit: number): Promise<JsonValue[]> { return this.list(this.repoPath(owner, repository, `/pulls/${index}/reviews`), { page, limit }); }
  public listCommits(owner: string, repository: string, query: Query): Promise<JsonValue[]> { return this.list(this.repoPath(owner, repository, "/commits"), query); }

  private async list(path: string, query: Query): Promise<JsonValue[]> {
    const value = await this.request(path, query);
    if (!Array.isArray(value)) throw new GiteaAdapterError("GITEA_INVALID_RESPONSE");
    return value;
  }

  private async request(path: string, query: Query = {}): Promise<JsonValue> {
    if (!this.baseUrl || !this.token || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new GiteaAdapterError("GITEA_CONFIGURATION");
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { method: "GET", headers: { Accept: "application/json", Authorization: `token ${this.token}` }, signal: controller.signal });
      if (!response.ok) throw fromGiteaStatus(response.status);
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new GiteaAdapterError("GITEA_INVALID_RESPONSE"); }
      if (!isJsonValue(payload)) throw new GiteaAdapterError("GITEA_INVALID_RESPONSE");
      return payload;
    } catch (error) {
      if (error instanceof GiteaAdapterError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw new GiteaAdapterError("GITEA_TIMEOUT");
      throw new GiteaAdapterError("GITEA_NETWORK");
    } finally { clearTimeout(timeout); }
  }

  private repoPath(owner: string, repository: string, suffix: string): string { return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`; }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object" && Object.values(value).every(isJsonValue);
}
