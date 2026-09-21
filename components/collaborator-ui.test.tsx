import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { CommitDto, IssueDto, PaginatedDto, PullRequestDto, ReviewDto } from "@/lib/gitea/types";
import { CommitList, DataState, IssueList, PullRequestList, ReviewList } from "./collaborator-ui";

const page = <T,>(items: T[]): PaginatedDto<T> => ({ items, pagination: { page: 1, limit: 20, has_more: false } });

describe("collaborator UI states", () => {
  it("renders explicit loading, error and empty states", () => {
    expect(renderToStaticMarkup(createElement(DataState, { kind: "loading" }))).toContain("Chargement");
    expect(renderToStaticMarkup(createElement(DataState, { kind: "error", message: "Capacité indisponible" }))).toContain("Capacité indisponible");
    expect(renderToStaticMarkup(createElement(DataState, { kind: "empty", message: "Gitea ne retourne aucune donnée." }))).toContain("Aucune donnée");
  });

  it("keeps pull requests distinct from issues in their respective lists", () => {
    const issue: IssueDto = { id: 1, number: 4, type: "pull_request", title: "PR issue payload", state: "open", author: null, assignees: [], labels: [], created_at: null, updated_at: null, html_url: null };
    const issueMarkup = renderToStaticMarkup(createElement(IssueList, { data: page([issue]), currentLogin: null }));
    const pull: PullRequestDto = { id: 2, index: 4, number: 4, title: "Pull request payload", state: "open", author: null, created_at: null, updated_at: null, closed_at: null, merged: null, merged_at: null, merged_by: null, html_url: null };
    const pullMarkup = renderToStaticMarkup(createElement(PullRequestList, { data: page([pull]), currentLogin: null }));
    expect(issueMarkup).toContain("Pull request");
    expect(pullMarkup).toContain("PR #4");
    expect(issueMarkup).not.toContain("Pull request payload");
  });

  it("renders only Gitea-provided activity links with safe target attributes", () => {
    const issue: IssueDto = { id: 1, number: 4, type: "issue", title: "Issue", state: "open", author: null, assignees: [], labels: [], created_at: null, updated_at: null, html_url: "https://gitea.example/issues/4" };
    const pull: PullRequestDto = { id: 2, index: 5, number: 5, title: "Pull", state: "open", author: null, created_at: null, updated_at: null, closed_at: null, merged: null, merged_at: null, merged_by: null, html_url: "https://gitea.example/pulls/5" };
    const commit: CommitDto = { sha: "abc12345", message: "Commit", author: null, committer: null, created_at: null, html_url: "https://gitea.example/commit/abc12345" };
    const review: ReviewDto = { id: 3, state: "APPROVED", author: null, submitted_at: null, updated_at: null, html_url: null, pull_request_url: "https://gitea.example/pulls/5" };
    const markup = [
      renderToStaticMarkup(createElement(IssueList, { data: page([issue]), currentLogin: null })),
      renderToStaticMarkup(createElement(PullRequestList, { data: page([pull]), currentLogin: null })),
      renderToStaticMarkup(createElement(CommitList, { data: page([commit]), currentLogin: null })),
      renderToStaticMarkup(createElement(ReviewList, { data: page([review]) })),
    ].join(" ");
    expect(markup.match(/aria-label="Ouvrir dans Gitea"/g)).toHaveLength(4);
    expect(markup.match(/rel="noopener noreferrer"/g)).toHaveLength(4);
    expect(markup).toContain("https://gitea.example/issues/4");
    expect(markup).toContain("https://gitea.example/pulls/5");
    expect(markup).toContain("https://gitea.example/commit/abc12345");
  });

  it("does not render links when Gitea did not provide URLs", () => {
    const issue: IssueDto = { id: 1, number: 4, type: "issue", title: "Sans lien", state: "open", author: null, assignees: [], labels: [], created_at: null, updated_at: null, html_url: null };
    const review: ReviewDto = { id: 3, state: "COMMENT", author: null, submitted_at: null, updated_at: null, html_url: null };
    const markup = renderToStaticMarkup(createElement(IssueList, { data: page([issue]), currentLogin: null })) + renderToStaticMarkup(createElement(ReviewList, { data: page([review]) }));
    expect(markup).not.toContain("Ouvrir dans Gitea");
    expect(markup).not.toContain("target=\"_blank\"");
  });
});
