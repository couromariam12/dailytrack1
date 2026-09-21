import { describe, expect, it } from "vitest";
import { registerGiteaTools } from "./tools";

describe("Gitea MCP tools", () => {
  it("registers exactly the six read-only tools", () => {
    const names: string[] = [];
    registerGiteaTools({ registerTool: (name) => names.push(name) }, {} as never);
    expect(names).toEqual(["get_current_user", "list_repositories", "list_issues", "list_pull_requests", "list_reviews", "list_commits"]);
  });
});
