import type { CommitDto, GiteaUserDto, IssueDto, MilestoneDto, PullRequestDto, RepositoryDto, ReviewDto } from "./types";

type Raw = Record<string, unknown>;

export function userDto(value: unknown): GiteaUserDto | null {
  if (!isRecord(value)) return null;
  return { id: numberOrNull(value.id), login: stringOrNull(value.login ?? value.username), full_name: stringOrNull(value.full_name), html_url: stringOrNull(value.html_url), avatar_url: stringOrNull(value.avatar_url) };
}

export function repositoryDto(value: unknown): RepositoryDto {
  const raw = record(value);
  return { id: numberOrNull(raw.id), name: stringOrNull(raw.name), full_name: stringOrNull(raw.full_name), owner: userDto(raw.owner), description: stringOrNull(raw.description), html_url: stringOrNull(raw.html_url ?? raw.url), private: booleanOrNull(raw.private), archived: booleanOrNull(raw.archived) };
}

export function milestoneDto(value: unknown): MilestoneDto {
  const raw = record(value);
  return {
    id: numberOrNull(raw.id),
    title: stringOrNull(raw.title ?? raw.name),
    description: stringOrNull(raw.description),
    state: stringOrNull(raw.state),
    open_issues: numberOrNull(raw.open_issues),
    closed_issues: numberOrNull(raw.closed_issues),
    due_on: stringOrNull(raw.due_on),
    created_at: stringOrNull(raw.created_at),
    updated_at: stringOrNull(raw.updated_at),
    html_url: stringOrNull(raw.html_url ?? raw.url),
  };
}

export function issueDto(value: unknown): IssueDto {
  const raw = record(value);
  const assigneeValues = Array.isArray(raw.assignees) ? raw.assignees : raw.assignee ? [raw.assignee] : [];
  return { id: numberOrNull(raw.id), number: numberOrNull(raw.number), type: isRecord(raw.pull_request) ? "pull_request" : "issue", title: stringOrNull(raw.title), state: stringOrNull(raw.state), author: userDto(raw.user), assignees: assigneeValues.map(userDto).filter((user): user is GiteaUserDto => user !== null), labels: Array.isArray(raw.labels) ? raw.labels.map((label) => isRecord(label) ? stringOrNull(label.name) : null).filter((label): label is string => label !== null) : [], created_at: stringOrNull(raw.created_at), updated_at: stringOrNull(raw.updated_at), html_url: stringOrNull(raw.html_url ?? raw.url) };
}

export function pullRequestDto(value: unknown): PullRequestDto {
  const raw = record(value);
  return { id: numberOrNull(raw.id), index: numberOrNull(raw.number ?? raw.index), number: numberOrNull(raw.number), title: stringOrNull(raw.title), state: stringOrNull(raw.state), author: userDto(raw.user), created_at: stringOrNull(raw.created_at), updated_at: stringOrNull(raw.updated_at), closed_at: stringOrNull(raw.closed_at), merged: booleanOrNull(raw.merged), merged_at: stringOrNull(raw.merged_at), merged_by: userDto(raw.merged_by), html_url: stringOrNull(raw.html_url ?? raw.url) };
}

export function reviewDto(value: unknown): ReviewDto {
  const raw = record(value);
  return { id: numberOrNull(raw.id), state: stringOrNull(raw.state), author: userDto(raw.user), submitted_at: stringOrNull(raw.submitted_at), updated_at: stringOrNull(raw.updated_at), html_url: stringOrNull(raw.html_url ?? raw.url) };
}

export function commitDto(value: unknown): CommitDto {
  const raw = record(value); const commit = record(raw.commit);
  return { sha: stringOrNull(raw.sha), message: stringOrNull(commit.message ?? raw.message), author: userDto(raw.author), committer: userDto(raw.committer), created_at: stringOrNull(raw.created ?? (commit.author && record(commit.author).date)), html_url: stringOrNull(raw.html_url ?? raw.url) };
}

function record(value: unknown): Raw { return isRecord(value) ? value : {}; }
function isRecord(value: unknown): value is Raw { return value !== null && typeof value === "object" && !Array.isArray(value); }
function stringOrNull(value: unknown): string | null { return typeof value === "string" && value !== "" ? value : null; }
function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null; }
function booleanOrNull(value: unknown): boolean | null { return typeof value === "boolean" ? value : null; }
