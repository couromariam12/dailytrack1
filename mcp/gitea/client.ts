import { GITEA_MAX_PAGE_SIZE, GiteaServerClient } from "../../lib/gitea/client";
import type { CommitFilters, GiteaClientConfig, IssueFilters, JsonValue, ListResponse, PullRequestFilters, RepositoryPath } from "./types";

type FetchLike = typeof fetch;

/** MCP view of the shared read-only Gitea client (lib/gitea/client.ts), with explicit pagination metadata. */
export class GiteaClient {
  private readonly client: GiteaServerClient;

  public constructor(config: GiteaClientConfig, fetchImpl: FetchLike = fetch) {
    this.client = new GiteaServerClient(config.baseUrl, config.token, config.timeoutMs, fetchImpl);
  }

  public getCurrentUser(): Promise<JsonValue> { return this.client.getCurrentUser(); }
  public async listRepositories(input: { page: number; limit: number }): Promise<ListResponse<JsonValue>> { return page(input, await this.client.listRepositories(input.page, input.limit)); }
  public async listIssues(path: RepositoryPath, filters: IssueFilters): Promise<ListResponse<JsonValue>> { return page(filters, await this.client.listIssues(path.owner, path.repository, { ...filters })); }
  public async listPullRequests(path: RepositoryPath, filters: PullRequestFilters): Promise<ListResponse<JsonValue>> { return page(filters, await this.client.listPullRequests(path.owner, path.repository, { ...filters })); }
  public async listReviews(path: RepositoryPath & { index: number }, pagination: { page: number; limit: number }): Promise<ListResponse<JsonValue>> { return page(pagination, await this.client.listReviews(path.owner, path.repository, path.index, pagination.page, pagination.limit)); }
  public async listCommits(path: RepositoryPath, filters: CommitFilters): Promise<ListResponse<JsonValue>> { return page(filters, await this.client.listCommits(path.owner, path.repository, { ...filters })); }
}

/** Gitea caps pages at 50 items: a full page of min(limit, 50) means more pages may follow. */
function page(input: { page: number; limit: number }, items: JsonValue[]): ListResponse<JsonValue> {
  return { items, page: input.page, limit: input.limit, has_more: items.length >= Math.min(input.limit, GITEA_MAX_PAGE_SIZE) };
}
