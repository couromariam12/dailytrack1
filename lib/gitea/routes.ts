import { z } from "zod";
import { GiteaServerClient } from "./client";
import { errorResponse, GiteaAdapterError } from "./errors";
import { commitDto, issueDto, pullRequestDto, repositoryDto, reviewDto, userDto } from "./dto";
import type { PaginatedDto } from "./types";
import { isWithinRange, type DateRange } from "@/lib/date/range";

const page = z.coerce.number().int().min(1).max(1_000_000);
const limit = z.coerce.number().int().min(1).max(100);
/** Gitea caps list responses at 50 items even when a larger limit is requested. */
const GITEA_MAX_PAGE_SIZE = 50;
const repo = { owner: z.string().min(1).max(255), repository: z.string().min(1).max(255) };
const common = { page, limit };

export const schemas = {
  pagination: z.object(common),
  issues: z.object({ ...repo, ...common, state: z.enum(["all", "open", "closed"]).optional(), type: z.enum(["all", "issues", "pulls"]).optional(), since: z.string().optional(), before: z.string().optional(), created_by: z.string().max(255).optional(), assigned_by: z.string().max(255).optional() }),
  pullRequests: z.object({ ...repo, ...common, state: z.enum(["all", "open", "closed"]).optional(), sort: z.string().optional(), base_branch: z.string().optional(), milestone: z.string().optional(), labels: z.string().optional(), poster: z.string().optional(), since: z.string().optional(), until: z.string().optional() }),
  reviews: z.object({ ...repo, index: z.coerce.number().int().min(1), ...common, since: z.string().optional(), until: z.string().optional() }),
  commits: z.object({ ...repo, ...common, sha: z.string().optional(), path: z.string().optional(), since: z.string().optional(), until: z.string().optional(), verification: z.string().optional() }),
};

export async function currentUser(client = new GiteaServerClient()) { return userDto(await client.getCurrentUser()); }
export async function repositories(input: z.infer<typeof schemas.pagination>, client = new GiteaServerClient()) { return pageResult(input, await client.listRepositories(input.page, input.limit), repositoryDto); }
export async function issues(input: z.infer<typeof schemas.issues>, client = new GiteaServerClient()) { const { owner, repository, ...query } = input; const values = await client.listIssues(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.before, issueDate), issueDto, hasMore(values, input.limit)); }
export async function pullRequests(input: z.infer<typeof schemas.pullRequests>, client = new GiteaServerClient()) { const { owner, repository, ...query } = input; const values = await client.listPullRequests(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.until, pullRequestDate), pullRequestDto, hasMore(values, input.limit)); }
export async function reviews(input: z.infer<typeof schemas.reviews>, client = new GiteaServerClient()) { const { owner, repository, index, page, limit } = input; const values = await client.listReviews(owner, repository, index, page, limit); return pageResult(input, filterByDate(values, input.since, input.until, reviewDate), reviewDto, hasMore(values, input.limit)); }
export async function commits(input: z.infer<typeof schemas.commits>, client = new GiteaServerClient()) { const { owner, repository, ...query } = input; const values = await client.listCommits(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.until, commitDate), commitDto, hasMore(values, input.limit)); }

export function routeError(error: unknown): { body: ReturnType<typeof errorResponse>; status: number } {
  const body = errorResponse(error);
  const status = error instanceof GiteaAdapterError ? error.status ?? (error.code === "GITEA_TIMEOUT" ? 504 : error.code === "GITEA_CONFIGURATION" ? 503 : 502) : 502;
  return { body, status };
}

function pageResult<T>(input: { page: number; limit: number }, values: unknown[], map: (value: unknown) => T, hasMore = values.length >= Math.min(input.limit, GITEA_MAX_PAGE_SIZE)): PaginatedDto<T> { return { items: values.map(map), pagination: { page: input.page, limit: input.limit, has_more: hasMore } }; }
function hasMore(values: unknown[], requestedLimit: number): boolean { return values.length >= Math.min(requestedLimit, GITEA_MAX_PAGE_SIZE); }

function filterByDate(values: unknown[], start: string | undefined, end: string | undefined, dateOf: (value: unknown) => string | null): unknown[] {
  if (!start && !end) return values;
  if (!start || !end) return [];
  const range: DateRange = { start, end };
  return values.filter((value) => isWithinRange(dateOf(value), range));
}
function issueDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.created_at ?? raw.updated_at); }
function pullRequestDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.created_at ?? raw.updated_at); }
function reviewDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.submitted_at ?? raw.updated_at); }
function commitDate(value: unknown): string | null { const raw = record(value); const commit = record(raw.commit); const author = record(commit.author); return stringValue(raw.created ?? author.date ?? raw.created_at); }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
