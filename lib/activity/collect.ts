import { mapLimit } from "@/lib/async";
import { isWithinRange, type DateRange } from "@/lib/date/range";
import { GITEA_MAX_PAGE_SIZE, type GiteaServerClient } from "@/lib/gitea/client";
import { commitDto, issueDto, pullRequestDto, reviewDto } from "@/lib/gitea/dto";
import { GiteaAdapterError } from "@/lib/gitea/errors";
import type { PullRequestDto } from "@/lib/gitea/types";
import { activityKinds, type ActivityBundle, type ActivityKind, type ActivityQuery } from "./types";

export { activityKinds, UNAVAILABLE_CODES, type ActivityBundle, type ActivityKind, type ActivityQuery, type ActivityWarning } from "./types";

/** Upper bound per list: 20 pages × 50 items. Beyond that the result is flagged as truncated. */
export const MAX_PAGES = 20;
const REVIEW_CONCURRENCY = 6;

type Pages = { items: unknown[]; truncated: boolean };

async function collectPages(load: (page: number) => Promise<unknown[]>, isLastPage?: (batch: unknown[]) => boolean): Promise<Pages> {
  const items: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await load(page);
    items.push(...batch);
    if (batch.length < GITEA_MAX_PAGE_SIZE || isLastPage?.(batch)) return { items, truncated: false };
  }
  return { items, truncated: true };
}

export function emptyBundle(): ActivityBundle {
  return { issues: [], pulls: [], commits: [], reviews: [], warnings: [] };
}

/**
 * Reads the activity of one repository, following Gitea pagination to the end so that counts and
 * lists are complete. Each kind fails independently and is reported as a warning.
 */
export async function collectRepositoryActivity(client: GiteaServerClient, query: ActivityQuery): Promise<ActivityBundle> {
  const { owner, repository, range } = query;
  const kinds = new Set(query.kinds ?? activityKinds);
  const fullName = `${owner}/${repository}`;
  const result = emptyBundle();
  const inRange = (value: string | null) => !range || isWithinRange(value, range);
  const isAuthor = (...logins: Array<string | null | undefined>) => !query.author || logins.some((login) => sameLogin(login, query.author));
  const matchesState = (state: string | null) => !query.state || query.state === "all" || state === query.state;

  async function guarded(kind: ActivityKind, operation: () => Promise<boolean>): Promise<void> {
    try {
      const truncated = await operation();
      if (truncated) result.warnings.push({ repository: fullName, kind, code: "TRUNCATED", message: `Résultats limités aux ${MAX_PAGES * GITEA_MAX_PAGE_SIZE} éléments les plus récents.` });
    } catch (error) {
      const code = error instanceof GiteaAdapterError ? error.code : "GITEA_NETWORK";
      result.warnings.push({ repository: fullName, kind, code, message: error instanceof Error ? error.message : "Gitea could not be reached." });
    }
  }

  const issueTask = kinds.has("issues") ? guarded("issues", async () => {
    // Gitea filters `since` on the update date, which is never earlier than the creation date.
    // `before` is not sent: an issue created in the range but updated afterwards must stay visible.
    const pages = await collectPages((page) => client.listIssues(owner, repository, { type: "issues", state: query.state ?? "all", since: range?.start, created_by: query.author, assigned_by: query.assignee, page, limit: GITEA_MAX_PAGE_SIZE }));
    result.issues = pages.items.map(issueDto).filter((issue) => issue.type === "issue"
      && inRange(issue.created_at ?? issue.updated_at)
      && isAuthor(issue.author?.login)
      && (!query.assignee || issue.assignees.some((user) => sameLogin(user.login, query.assignee))));
    return pages.truncated;
  }) : Promise.resolve();

  const commitTask = kinds.has("commits") ? guarded("commits", async () => {
    const pages = await collectPages((page) => client.listCommits(owner, repository, { since: range?.start, until: range?.end, stat: "false", verification: "false", files: "false", page, limit: GITEA_MAX_PAGE_SIZE }));
    result.commits = pages.items.map(commitDto).filter((commit) => inRange(commit.created_at) && isAuthor(commit.author?.login, commit.committer?.login));
    return pages.truncated;
  }) : Promise.resolve();

  const pullTask = kinds.has("pulls") || kinds.has("reviews") ? (async () => {
    // Pull requests are listed most recently updated first: once a page ends before the range,
    // no older pull request can hold activity (a review also bumps the pull request update date).
    let candidates: PullRequestDto[] = [];
    let truncated = false;
    try {
      const pages = await collectPages(
        (page) => client.listPullRequests(owner, repository, { state: "all", sort: "recentupdate", page, limit: GITEA_MAX_PAGE_SIZE }),
        (batch) => Boolean(range) && batch.some((item) => isBefore(pullRequestDto(item).updated_at, range)),
      );
      candidates = pages.items.map(pullRequestDto).filter((pull) => !range || !isBefore(pull.updated_at, range));
      truncated = pages.truncated;
    } catch (error) {
      for (const kind of ["pulls", "reviews"] as const) if (kinds.has(kind)) await guarded(kind, () => Promise.reject(error));
      return;
    }
    if (kinds.has("pulls")) await guarded("pulls", async () => {
      result.pulls = candidates.filter((pull) => inRange(pull.created_at ?? pull.updated_at) && matchesState(pull.state) && isAuthor(pull.author?.login));
      return truncated;
    });
    if (kinds.has("reviews")) await guarded("reviews", async () => {
      const withIndex = candidates.filter((pull): pull is PullRequestDto & { index: number } => pull.index !== null);
      const perPull = await mapLimit(withIndex, REVIEW_CONCURRENCY, async (pull) => {
        const pages = await collectPages((page) => client.listReviews(owner, repository, pull.index, page, GITEA_MAX_PAGE_SIZE));
        return pages.items.map(reviewDto).map((review) => ({ ...review, pull_request_url: pull.html_url }));
      });
      result.reviews = perPull.flat().filter((review) => inRange(review.submitted_at ?? review.updated_at) && isAuthor(review.author?.login));
      return truncated;
    });
  })() : Promise.resolve();

  await Promise.all([issueTask, commitTask, pullTask]);
  return sortBundle(result);
}

export function mergeBundles(bundles: ReadonlyArray<ActivityBundle>): ActivityBundle {
  return sortBundle({
    issues: bundles.flatMap((bundle) => bundle.issues),
    pulls: bundles.flatMap((bundle) => bundle.pulls),
    commits: bundles.flatMap((bundle) => bundle.commits),
    reviews: bundles.flatMap((bundle) => bundle.reviews),
    warnings: bundles.flatMap((bundle) => bundle.warnings),
  });
}

function sortBundle(bundle: ActivityBundle): ActivityBundle {
  return {
    ...bundle,
    issues: newestFirst(bundle.issues, (item) => item.created_at ?? item.updated_at),
    pulls: newestFirst(bundle.pulls, (item) => item.created_at ?? item.updated_at),
    commits: newestFirst(bundle.commits, (item) => item.created_at),
    reviews: newestFirst(bundle.reviews, (item) => item.submitted_at ?? item.updated_at),
  };
}

function newestFirst<T>(items: T[], dateOf: (item: T) => string | null): T[] {
  const time = (item: T) => Date.parse(dateOf(item) ?? "") || 0;
  return [...items].sort((left, right) => time(right) - time(left));
}

function isBefore(value: string | null, range: DateRange | null): boolean {
  if (!range || !value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.parse(range.start);
}

function sameLogin(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}
