import { describe, expect, it, vi } from "vitest";
import { dayRange } from "@/lib/date/range";
import type { GiteaServerClient } from "@/lib/gitea/client";
import { GiteaAdapterError } from "@/lib/gitea/errors";
import { collectRepositoryActivity, MAX_PAGES } from "./collect";
import { dailyActivity } from "./service";

const range = dayRange("2026-09-21");
const user = (login: string) => ({ login });
const fullPage = <T,>(make: (index: number) => T) => Array.from({ length: 50 }, (_, index) => make(index));

function fakeClient(overrides: Partial<Record<keyof GiteaServerClient, unknown>> = {}) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, login: "alice" }),
    listRepositories: vi.fn().mockResolvedValue([]),
    listIssues: vi.fn().mockResolvedValue([]),
    listPullRequests: vi.fn().mockResolvedValue([]),
    listReviews: vi.fn().mockResolvedValue([]),
    listCommits: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as GiteaServerClient & Record<string, ReturnType<typeof vi.fn>>;
}

describe("collectRepositoryActivity", () => {
  it("follows every Gitea page so counts are complete", async () => {
    const listCommits = vi.fn()
      .mockResolvedValueOnce(fullPage((index) => ({ sha: `a${index}`, created: "2026-09-21T10:00:00Z", author: user("alice") })))
      .mockResolvedValueOnce([{ sha: "last", created: "2026-09-21T11:00:00Z", author: user("alice") }]);
    const client = fakeClient({ listCommits });
    const result = await collectRepositoryActivity(client, { owner: "acme", repository: "app", range, kinds: ["commits"] });
    expect(result.commits).toHaveLength(51);
    expect(result.commits[0]?.sha).toBe("last");
    expect(listCommits).toHaveBeenCalledWith("acme", "app", expect.objectContaining({ since: range.start, until: range.end, page: 2, limit: 50 }));
    expect(result.warnings).toEqual([]);
  });

  it("keeps an issue created in the range even if it was updated afterwards", async () => {
    const listIssues = vi.fn().mockResolvedValue([
      { id: 1, number: 1, title: "Created that day", user: user("alice"), created_at: "2026-09-21T09:00:00Z", updated_at: "2026-09-23T09:00:00Z" },
      { id: 2, number: 2, title: "Created before", user: user("alice"), created_at: "2026-09-10T09:00:00Z", updated_at: "2026-09-21T09:00:00Z" },
    ]);
    const client = fakeClient({ listIssues });
    const result = await collectRepositoryActivity(client, { owner: "acme", repository: "app", range, author: "alice", kinds: ["issues"] });
    expect(result.issues.map((issue) => issue.number)).toEqual([1]);
    const query = listIssues.mock.calls[0]?.[2];
    expect(query).toMatchObject({ since: range.start, created_by: "alice", type: "issues" });
    expect(query).not.toHaveProperty("before", expect.anything());
  });

  it("stops reading pull requests once they are older than the range and reads reviews of recent ones only", async () => {
    const listPullRequests = vi.fn()
      .mockResolvedValueOnce([
        ...fullPage((index) => ({ number: 100 + index, user: user("bob"), created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-22T00:00:00Z" })).slice(0, 49),
        { number: 7, user: user("alice"), created_at: "2026-09-21T08:00:00Z", updated_at: "2026-09-21T12:00:00Z", html_url: "https://gitea/pulls/7" },
      ])
      .mockResolvedValueOnce([{ number: 3, user: user("alice"), created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-02T00:00:00Z" }, ...fullPage(() => ({ number: 1, updated_at: "2026-08-01T00:00:00Z" })).slice(1)]);
    const listReviews = vi.fn().mockImplementation(async (_owner: string, _repo: string, index: number) => index === 7
      ? [{ id: 70, user: user("carol"), submitted_at: "2026-09-21T13:00:00Z" }, { id: 71, user: user("carol"), submitted_at: "2026-09-20T13:00:00Z" }]
      : []);
    const client = fakeClient({ listPullRequests, listReviews });
    const result = await collectRepositoryActivity(client, { owner: "acme", repository: "app", range });
    expect(listPullRequests).toHaveBeenCalledTimes(2);
    expect(listPullRequests).toHaveBeenCalledWith("acme", "app", expect.objectContaining({ state: "all", sort: "recentupdate" }));
    expect(result.pulls.map((pull) => pull.number)).toEqual([7]);
    expect(result.reviews).toEqual([expect.objectContaining({ id: 70, pull_request_url: "https://gitea/pulls/7" })]);
    expect(listReviews).not.toHaveBeenCalledWith("acme", "app", 3, expect.anything(), expect.anything());
  });

  it("filters pull requests by state and author locally", async () => {
    const listPullRequests = vi.fn().mockResolvedValue([
      { number: 1, state: "open", user: user("Alice"), created_at: "2026-09-21T08:00:00Z", updated_at: "2026-09-21T08:00:00Z" },
      { number: 2, state: "closed", user: user("alice"), created_at: "2026-09-21T09:00:00Z", updated_at: "2026-09-21T09:00:00Z" },
      { number: 3, state: "open", user: user("bob"), created_at: "2026-09-21T10:00:00Z", updated_at: "2026-09-21T10:00:00Z" },
    ]);
    const result = await collectRepositoryActivity(fakeClient({ listPullRequests }), { owner: "acme", repository: "app", range, state: "open", author: "alice", kinds: ["pulls"] });
    expect(result.pulls.map((pull) => pull.number)).toEqual([1]);
  });

  it("reports a failing kind as a warning and keeps the others", async () => {
    const client = fakeClient({
      listIssues: vi.fn().mockRejectedValue(new GiteaAdapterError("GITEA_FORBIDDEN", 403)),
      listCommits: vi.fn().mockResolvedValue([{ sha: "a", created: "2026-09-21T10:00:00Z" }]),
    });
    const result = await collectRepositoryActivity(client, { owner: "acme", repository: "app", range, kinds: ["issues", "commits"] });
    expect(result.commits).toHaveLength(1);
    expect(result.warnings).toEqual([expect.objectContaining({ repository: "acme/app", kind: "issues", code: "GITEA_FORBIDDEN" })]);
  });

  it("flags truncated lists", async () => {
    const listCommits = vi.fn().mockResolvedValue(fullPage((index) => ({ sha: `a${index}`, created: "2026-09-21T10:00:00Z" })));
    const result = await collectRepositoryActivity(fakeClient({ listCommits }), { owner: "acme", repository: "app", range: null, kinds: ["commits"] });
    expect(listCommits).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.warnings).toEqual([expect.objectContaining({ kind: "commits", code: "TRUNCATED" })]);
  });
});

describe("dailyActivity", () => {
  it("reads the signed-in user's activity across all non-archived repositories", async () => {
    const listRepositories = vi.fn().mockResolvedValue([{ full_name: "acme/app" }, { full_name: "acme/old", archived: true }]);
    const listCommits = vi.fn().mockResolvedValue([
      { sha: "mine", created: "2026-09-21T10:00:00Z", author: user("alice") },
      { sha: "other", created: "2026-09-21T10:00:00Z", author: user("bob"), committer: user("bob") },
    ]);
    const client = fakeClient({ listRepositories, listCommits });
    const result = await dailyActivity({ date: "2026-09-21" }, client);
    expect(result.user?.login).toBe("alice");
    expect(result.repositories).toBe(1);
    expect(result.commits.map((commit) => commit.sha)).toEqual(["mine"]);
    expect(listCommits).toHaveBeenCalledTimes(1);
    expect(listCommits).toHaveBeenCalledWith("acme", "app", expect.anything());
  });
});
