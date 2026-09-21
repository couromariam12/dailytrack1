import { GiteaMcpError, errorForStatus } from "./errors";
import type { CommitFilters, GiteaClientConfig, IssueFilters, JsonValue, ListResponse, PullRequestFilters, RepositoryPath } from "./types";

type FetchLike = typeof fetch;

export class GiteaClient {
  public constructor(private readonly config: GiteaClientConfig, private readonly fetchImpl: FetchLike = fetch) {}

  public getCurrentUser(): Promise<JsonValue> { return this.request("/user"); }
  public listRepositories(input: { page: number; limit: number }): Promise<ListResponse<JsonValue>> { return this.list("/user/repos", input); }
  public listIssues(path: RepositoryPath, filters: IssueFilters): Promise<ListResponse<JsonValue>> { return this.list(this.repositoryPath(path, "/issues"), { ...filters }); }
  public listPullRequests(path: RepositoryPath, filters: PullRequestFilters): Promise<ListResponse<JsonValue>> { return this.list(this.repositoryPath(path, "/pulls"), { ...filters }); }
  public listReviews(path: RepositoryPath & { index: number }, pagination: { page: number; limit: number }): Promise<ListResponse<JsonValue>> { return this.list(this.repositoryPath(path, `/pulls/${path.index}/reviews`), pagination); }
  public listCommits(path: RepositoryPath, filters: CommitFilters): Promise<ListResponse<JsonValue>> { return this.list(this.repositoryPath(path, "/commits"), { ...filters }); }

  private async list(path: string, query: Record<string, string | number | undefined>): Promise<ListResponse<JsonValue>> {
    const items = await this.request(path, query);
    if (!Array.isArray(items)) throw new GiteaMcpError("GITEA_INVALID_RESPONSE");
    const page = Number(query.page); const limit = Number(query.limit);
    return { items, page, limit, has_more: items.length === limit };
  }

  private async request(path: string, query: Record<string, string | number | undefined> = {}): Promise<JsonValue> {
    if (!this.config.baseUrl || !this.config.token || !Number.isFinite(this.config.timeoutMs) || this.config.timeoutMs <= 0) throw new GiteaMcpError("GITEA_CONFIGURATION");
    const url = new URL(`/api/v1${path}`, this.config.baseUrl);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { method: "GET", headers: { Accept: "application/json", Authorization: `token ${this.config.token}` }, signal: controller.signal });
      if (!response.ok) throw errorForStatus(response.status);
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new GiteaMcpError("GITEA_INVALID_RESPONSE"); }
      if (!isJsonValue(payload)) throw new GiteaMcpError("GITEA_INVALID_RESPONSE");
      return payload;
    } catch (error) {
      if (error instanceof GiteaMcpError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw new GiteaMcpError("GITEA_TIMEOUT");
      throw new GiteaMcpError("GITEA_NETWORK");
    } finally { clearTimeout(timeout); }
  }

  private repositoryPath(path: RepositoryPath, suffix: string): string { return `/repos/${encodeURIComponent(path.owner)}/${encodeURIComponent(path.repository)}${suffix}`; }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object" && Object.values(value).every(isJsonValue);
}
