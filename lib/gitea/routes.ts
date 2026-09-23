import { z } from "zod";
import { GITEA_MAX_PAGE_SIZE, type GiteaServerClient } from "./client";
import { errorResponse, GiteaAdapterError } from "./errors";
import { commitDto, issueDto, pullRequestDto, repositoryDto, reviewDto, userDto } from "./dto";
import type { PaginatedDto, RepositoryDto } from "./types";
import { isWithinRange, type DateRange } from "@/lib/date/range";

const page = z.coerce.number().int().min(1).max(1_000_000);
const limit = z.coerce.number().int().min(1).max(100);
const timestamp = z.string().max(64).refine((value) => Number.isFinite(Date.parse(value)), "Invalid date.");
const repo = { owner: z.string().min(1).max(255), repository: z.string().min(1).max(255) };
const common = { page, limit };

/** A date filter is only meaningful with both bounds; a single bound used to silently return nothing. */
function completeRange<T extends z.ZodRawShape>(shape: T, startKey: string, endKey: string) {
  return z.object(shape).refine((value: Record<string, unknown>) => {
    const start = value[startKey];
    const end = value[endKey];
    if (start === undefined && end === undefined) return true;
    return typeof start === "string" && typeof end === "string" && Date.parse(start) < Date.parse(end);
  }, `${startKey} and ${endKey} must be provided together, with ${startKey} before ${endKey}.`);
}

export const schemas = {
  pagination: z.object(common),
  issues: completeRange({ ...repo, ...common, state: z.enum(["all", "open", "closed"]).optional(), type: z.enum(["all", "issues", "pulls"]).optional(), since: timestamp.optional(), before: timestamp.optional(), created_by: z.string().max(255).optional(), assigned_by: z.string().max(255).optional() }, "since", "before"),
  pullRequests: completeRange({ ...repo, ...common, state: z.enum(["all", "open", "closed"]).optional(), sort: z.string().optional(), base_branch: z.string().optional(), milestone: z.string().optional(), labels: z.string().optional(), poster: z.string().optional(), since: timestamp.optional(), until: timestamp.optional() }, "since", "until"),
  reviews: completeRange({ ...repo, index: z.coerce.number().int().min(1), ...common, since: timestamp.optional(), until: timestamp.optional() }, "since", "until"),
  commits: completeRange({ ...repo, ...common, sha: z.string().optional(), path: z.string().optional(), since: timestamp.optional(), until: timestamp.optional(), verification: z.string().optional() }, "since", "until"),
};

export async function currentUser(client: GiteaServerClient) { return userDto(await client.getCurrentUser()); }
export async function repositories(input: z.infer<typeof schemas.pagination>, client: GiteaServerClient) { return pageResult(input, await client.listRepositories(input.page, input.limit), repositoryDto); }
export async function issues(input: z.infer<typeof schemas.issues>, client: GiteaServerClient) { const { owner, repository, ...query } = input; const values = await client.listIssues(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.before, issueDate), issueDto, hasMore(values, input.limit)); }
export async function pullRequests(input: z.infer<typeof schemas.pullRequests>, client: GiteaServerClient) { const { owner, repository, ...query } = input; const values = await client.listPullRequests(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.until, pullRequestDate), pullRequestDto, hasMore(values, input.limit)); }
export async function reviews(input: z.infer<typeof schemas.reviews>, client: GiteaServerClient) { const { owner, repository, index, page, limit } = input; const values = await client.listReviews(owner, repository, index, page, limit); return pageResult(input, filterByDate(values, input.since, input.until, reviewDate), reviewDto, hasMore(values, input.limit)); }
export async function commits(input: z.infer<typeof schemas.commits>, client: GiteaServerClient) { const { owner, repository, ...query } = input; const values = await client.listCommits(owner, repository, query); return pageResult(input, filterByDate(values, input.since, input.until, commitDate), commitDto, hasMore(values, input.limit)); }

const MAX_REPOSITORY_PAGES = 20;

/** Every repository visible to the user, across all Gitea pages. */
export async function allRepositories(client: GiteaServerClient): Promise<RepositoryDto[]> {
  const items: RepositoryDto[] = [];
  for (let current = 1; current <= MAX_REPOSITORY_PAGES; current += 1) {
    const batch = await client.listRepositories(current, GITEA_MAX_PAGE_SIZE);
    items.push(...batch.map(repositoryDto));
    if (batch.length < GITEA_MAX_PAGE_SIZE) break;
  }
  return items;
}

export function routeError(error: unknown): { body: ReturnType<typeof errorResponse>; status: number } {
  const body = errorResponse(error);
  const status = error instanceof GiteaAdapterError ? error.status ?? (error.code === "GITEA_TIMEOUT" ? 504 : error.code === "GITEA_CONFIGURATION" ? 503 : 502) : 502;
  return { body, status };
}

function pageResult<T>(input: { page: number; limit: number }, values: unknown[], map: (value: unknown) => T, more = hasMore(values, input.limit)): PaginatedDto<T> { return { items: values.map(map), pagination: { page: input.page, limit: input.limit, has_more: more } }; }
function hasMore(values: unknown[], requestedLimit: number): boolean { return values.length >= Math.min(requestedLimit, GITEA_MAX_PAGE_SIZE); }

function filterByDate(values: unknown[], start: string | undefined, end: string | undefined, dateOf: (value: unknown) => string | null): unknown[] {
  if (!start || !end) return values;
  const range: DateRange = { start, end };
  return values.filter((value) => isWithinRange(dateOf(value), range));
}
export function issueDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.created_at ?? raw.updated_at); }
export function pullRequestDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.created_at ?? raw.updated_at); }
export function reviewDate(value: unknown): string | null { const raw = record(value); return stringValue(raw.submitted_at ?? raw.updated_at); }
export function commitDate(value: unknown): string | null { const raw = record(value); const commit = record(raw.commit); const author = record(commit.author); return stringValue(raw.created ?? author.date ?? raw.created_at); }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
