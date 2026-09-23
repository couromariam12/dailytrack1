export type { JsonObject, JsonPrimitive, JsonValue } from "../../lib/gitea/types";

export interface GiteaClientConfig { baseUrl: string; token: string; timeoutMs: number; }
export interface PaginationInput { page: number; limit: number; }
export interface ListResponse<T> { items: T[]; page: number; limit: number; has_more: boolean; }
export interface IssueFilters extends PaginationInput {
  state?: "all" | "open" | "closed";
  type?: "all" | "issues" | "pulls";
  since?: string;
  before?: string;
  created_by?: string;
  assigned_by?: string;
}
export interface PullRequestFilters extends PaginationInput {
  state?: "all" | "open" | "closed";
  sort?: string;
  base_branch?: string;
  milestone?: string;
  labels?: string;
  poster?: string;
}
export interface CommitFilters extends PaginationInput {
  sha?: string;
  path?: string;
  since?: string;
  until?: string;
  verification?: string;
}
export interface RepositoryPath { owner: string; repository: string; }
