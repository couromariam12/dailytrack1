import type { DateRange } from "@/lib/date/range";
import type { CommitDto, IssueDto, PullRequestDto, ReviewDto } from "@/lib/gitea/types";

/** Activity types shared by the server collector and the browser components. */
export type ActivityKind = "issues" | "pulls" | "commits" | "reviews";
export const activityKinds: ReadonlyArray<ActivityKind> = ["issues", "pulls", "commits", "reviews"];

export type ActivityQuery = {
  owner: string;
  repository: string;
  /** Half-open interval on the creation date of each activity; null means no date filter. */
  range: DateRange | null;
  state?: "all" | "open" | "closed";
  /** Login of the author (issue/PR author, commit author or committer, review author). */
  author?: string;
  /** Login of an issue assignee. Only applies to issues. */
  assignee?: string;
  kinds?: ReadonlyArray<ActivityKind>;
};

export type ActivityWarning = { repository: string; kind: ActivityKind; code: string; message: string };

/**
 * Codes Gitea returns when a repository simply has no such data: pull requests disabled (404),
 * empty repository (409) or code unit not readable by this user (403).
 */
export const UNAVAILABLE_CODES: ReadonlySet<string> = new Set(["GITEA_NOT_FOUND", "GITEA_CONFLICT", "GITEA_FORBIDDEN"]);

export type ActivityBundle = {
  issues: IssueDto[];
  pulls: PullRequestDto[];
  commits: CommitDto[];
  reviews: ReviewDto[];
  warnings: ActivityWarning[];
};
