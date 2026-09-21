export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type GiteaUserDto = {
  id: number | null;
  login: string | null;
  full_name: string | null;
  html_url: string | null;
  avatar_url: string | null;
};

export type RepositoryDto = {
  id: number | null;
  name: string | null;
  full_name: string | null;
  owner: GiteaUserDto | null;
  description: string | null;
  html_url: string | null;
  private: boolean | null;
  archived: boolean | null;
};

export type IssueDto = {
  id: number | null;
  number: number | null;
  type: "issue" | "pull_request";
  title: string | null;
  state: string | null;
  author: GiteaUserDto | null;
  assignees: GiteaUserDto[];
  labels: string[];
  created_at: string | null;
  updated_at: string | null;
  html_url: string | null;
};

export type PullRequestDto = {
  id: number | null;
  index: number | null;
  number: number | null;
  title: string | null;
  state: string | null;
  author: GiteaUserDto | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  merged: boolean | null;
  merged_at: string | null;
  merged_by: GiteaUserDto | null;
  html_url: string | null;
};

export type ReviewDto = {
  id: number | null;
  state: string | null;
  author: GiteaUserDto | null;
  submitted_at: string | null;
  updated_at: string | null;
  html_url: string | null;
  /** Set only when the associated Gitea pull request supplied its own URL. */
  pull_request_url?: string | null;
};

export type CommitDto = {
  sha: string | null;
  message: string | null;
  author: GiteaUserDto | null;
  committer: GiteaUserDto | null;
  created_at: string | null;
  html_url: string | null;
};

export type PaginatedDto<T> = {
  items: T[];
  pagination: { page: number; limit: number; has_more: boolean };
};
