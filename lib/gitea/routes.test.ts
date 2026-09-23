import { describe, expect, it, vi } from "vitest";
import { GiteaAdapterError } from "./errors";
import { allRepositories, commits, currentUser, issues, pullRequests, repositories, routeError, schemas } from "./routes";
import type { GiteaServerClient } from "./client";

const client = {
  getCurrentUser: vi.fn().mockResolvedValue({ id: 7, login: "alice" }),
  listRepositories: vi.fn().mockResolvedValue([{ id: 1, name: "app", owner: { login: "acme" } }]),
  listIssues: vi.fn().mockResolvedValue([{ id: 2, number: 4, title: "Fix", user: { login: "alice" }, labels: [] }]),
  listPullRequests: vi.fn().mockResolvedValue([
    { id: 7, number: 7, title: "In range", user: { login: "alice" }, created_at: "2026-09-18T12:00:00Z", html_url: "https://gitea.example/pulls/7" },
    { id: 8, number: 8, title: "Out of range", user: { login: "alice" }, created_at: "2026-09-17T12:00:00Z", html_url: "https://gitea.example/pulls/8" },
    { id: 9, number: 9, title: "End boundary", user: { login: "alice" }, created_at: "2026-09-19T00:00:00Z", html_url: "https://gitea.example/pulls/9" },
  ]),
  listCommits: vi.fn().mockResolvedValue([{ sha: "abc", commit: { message: "Fix\nDetails", author: { date: "2026-09-17T10:00:00Z" } } }]),
} as unknown as GiteaServerClient;

describe("Next.js Gitea adapter", () => {
  it("normalizes the current user and paginated repositories", async () => {
    await expect(currentUser(client)).resolves.toMatchObject({ login: "alice", id: 7 });
    await expect(repositories({ page: 1, limit: 20 }, client)).resolves.toMatchObject({ pagination: { page: 1, limit: 20, has_more: false }, items: [{ name: "app", owner: { login: "acme" } }] });
  });

  it("forwards repository filters and normalizes issues and commits", async () => {
    await issues({ owner: "acme", repository: "app", page: 1, limit: 20, state: "all", type: "issues", since: "2026-09-18T00:00:00Z", before: "2026-09-19T00:00:00Z" }, client);
    expect(client.listIssues).toHaveBeenCalledWith("acme", "app", expect.objectContaining({ page: 1, limit: 20, state: "all", type: "issues" }));
    expect(client.listIssues).toHaveBeenCalledWith("acme", "app", expect.objectContaining({ before: "2026-09-19T00:00:00Z" }));
    await expect(commits({ owner: "acme", repository: "app", page: 1, limit: 20 }, client)).resolves.toMatchObject({ items: [{ sha: "abc", message: "Fix\nDetails" }] });
  });

  it("keeps pull requests inside the half-open interval only", async () => {
    await expect(pullRequests({ owner: "acme", repository: "app", page: 1, limit: 20, state: "all", since: "2026-09-18T00:00:00Z", until: "2026-09-19T00:00:00Z" }, client)).resolves.toMatchObject({ items: [{ number: 7, html_url: "https://gitea.example/pulls/7" }] });
  });

  it("continues pagination when Gitea caps a requested page at 50 items", async () => {
    const pagedClient = { listPullRequests: vi.fn().mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ number: index + 1 }))) } as unknown as GiteaServerClient;
    await expect(pullRequests({ owner: "acme", repository: "app", page: 1, limit: 100, state: "all" }, pagedClient)).resolves.toMatchObject({ pagination: { limit: 100, has_more: true }, items: expect.any(Array) });
  });

  it("keeps an issue exactly at the start boundary and excludes the end boundary", async () => {
    const issueClient = { listIssues: vi.fn().mockResolvedValue([
      { number: 1, user: { login: "alice" }, created_at: "2026-09-18T00:00:00Z" },
      { number: 2, user: { login: "alice" }, created_at: "2026-09-19T00:00:00Z" },
    ]) } as unknown as GiteaServerClient;
    await expect(issues({ owner: "acme", repository: "app", page: 1, limit: 20, since: "2026-09-18T00:00:00Z", before: "2026-09-19T00:00:00Z" }, issueClient)).resolves.toMatchObject({ items: [{ number: 1 }] });
  });

  it("rejects an incomplete or inverted date range instead of silently returning nothing", () => {
    const base = { owner: "acme", repository: "app", page: "1", limit: "20" };
    expect(schemas.pullRequests.safeParse({ ...base, since: "2026-09-18T00:00:00Z" }).success).toBe(false);
    expect(schemas.commits.safeParse({ ...base, since: "2026-09-19T00:00:00Z", until: "2026-09-18T00:00:00Z" }).success).toBe(false);
    expect(schemas.issues.safeParse({ ...base, since: "2026-09-18T00:00:00Z", before: "2026-09-19T00:00:00Z" }).success).toBe(true);
    expect(schemas.reviews.safeParse({ ...base, index: "1", since: "not-a-date", until: "2026-09-19T00:00:00Z" }).success).toBe(false);
  });

  it("reads every repository page", async () => {
    const listRepositories = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => ({ id: index, full_name: `acme/r${index}` })))
      .mockResolvedValueOnce([{ id: 50, full_name: "acme/r50" }]);
    const result = await allRepositories({ listRepositories } as unknown as GiteaServerClient);
    expect(result).toHaveLength(51);
    expect(listRepositories).toHaveBeenLastCalledWith(2, 50);
  });

  it("maps adapter errors to safe HTTP statuses", () => {
    expect(routeError(new GiteaAdapterError("GITEA_UNAUTHORIZED", 401)).status).toBe(401);
    expect(routeError(new GiteaAdapterError("GITEA_FORBIDDEN", 403)).status).toBe(403);
    expect(routeError(new GiteaAdapterError("GITEA_NOT_FOUND", 404)).status).toBe(404);
    expect(routeError(new GiteaAdapterError("GITEA_CONFLICT", 409)).status).toBe(409);
    expect(routeError(new GiteaAdapterError("GITEA_TIMEOUT")).status).toBe(504);
    expect(routeError(new GiteaAdapterError("GITEA_INVALID_RESPONSE")).status).toBe(502);
  });
});
