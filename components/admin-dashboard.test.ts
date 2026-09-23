import { describe, expect, it } from "vitest";
import type { CommitDto, IssueDto, PullRequestDto, ReviewDto } from "@/lib/gitea/types";
import { filterBundle, getByDayAndType, getCollaboratorVolumes, getCounts, type Bundle } from "./admin-dashboard";

const user = (login: string) => ({ id: null, login, full_name: null, html_url: null, avatar_url: null });
const issue = (type: IssueDto["type"], login: string, date: string): IssueDto => ({ id: null, number: null, type, title: null, state: "open", author: user(login), assignees: [], labels: [], created_at: date, updated_at: date, html_url: null });
const pull = (login: string, date: string): PullRequestDto => ({ id: null, index: 7, number: 7, title: null, state: "open", author: user(login), created_at: date, updated_at: date, closed_at: null, merged: null, merged_at: null, merged_by: null, html_url: null });
const commit = (author: string, committer: string, date: string): CommitDto => ({ sha: author + date, message: null, author: user(author), committer: user(committer), created_at: date, html_url: null });
const review = (login: string, date: string): ReviewDto => ({ id: null, state: "APPROVED", author: user(login), submitted_at: date, updated_at: date, html_url: null });
const bundle = (overrides: Partial<Bundle> = {}): Bundle => ({ issues: [], pulls: [], commits: [], reviews: [], warnings: [], ...overrides });

describe("Admin normalized dataset", () => {
  it("keeps pull requests out of ticket KPI and charts", () => {
    const data = bundle({ issues: [issue("issue", "alice", "2026-09-18T08:00:00Z")], pulls: [pull("alice", "2026-09-18T09:00:00Z")] });
    expect(getCounts(data)).toMatchObject({ issues: 1, pulls: 1 });
    expect(getByDayAndType(data)["2026-09-18"]).toMatchObject({ issues: 1, pulls: 1 });
  });

  it("applies the same collaborator attribution to the filtered KPI dataset", () => {
    const data = bundle({ issues: [issue("issue", "alice", "2026-09-18T08:00:00Z")], pulls: [pull("bob", "2026-09-18T09:00:00Z")], commits: [commit("bob", "alice", "2026-09-18T10:00:00Z")], reviews: [review("alice", "2026-09-18T11:00:00Z")] });
    const filtered = filterBundle(data, "alice");
    expect(getCounts(filtered)).toEqual({ issues: 1, pulls: 0, commits: 1, reviews: 1 });
    expect(getByDayAndType(filtered)["2026-09-18"]).toEqual({ issues: 1, pulls: 0, commits: 1, reviews: 1 });
  });

  it("includes real issue assignees in descriptive collaborator volumes", () => {
    const assigned = issue("issue", "bob", "2026-09-18T08:00:00Z");
    assigned.assignees = [user("alice")];
    expect(getCollaboratorVolumes(bundle({ issues: [assigned] }))).toEqual([{ login: "alice", count: 1 }, { login: "bob", count: 1 }]);
  });

  it("buckets activity on UTC days whatever offset Gitea used", () => {
    const data = bundle({ commits: [commit("alice", "alice", "2026-09-19T00:30:00+02:00")] });
    expect(Object.keys(getByDayAndType(data))).toEqual(["2026-09-18"]);
  });

  it("preserves real empty periods instead of creating activity", () => {
    const data = bundle({ pulls: [pull("alice", "2026-09-17T23:59:59Z")] });
    expect(getCounts(data)).toEqual({ issues: 0, pulls: 1, commits: 0, reviews: 0 });
    expect(getByDayAndType(data)["2026-09-18"]).toBeUndefined();
  });
});
