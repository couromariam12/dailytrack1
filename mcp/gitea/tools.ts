import type { CallToolResult } from "@modelcontextprotocol/server";
import { GiteaClient } from "./client";
import { publicError } from "./errors";
import { schemas } from "./schemas";
import type { JsonValue } from "./types";

interface ToolRegistrar { registerTool(name: string, config: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<CallToolResult>): void; }

export function registerGiteaTools(server: ToolRegistrar, client: GiteaClient): void {
  server.registerTool("get_current_user", { description: "Read the authenticated Gitea user.", inputSchema: {} }, async () => run(() => client.getCurrentUser()));
  server.registerTool("list_repositories", { description: "List repositories visible to the authenticated Gitea user.", inputSchema: schemas.repositories }, async (args) => { const input = schemas.repositories.parse(args); return run(() => client.listRepositories(input)); });
  server.registerTool("list_issues", { description: "List issues for a Gitea repository.", inputSchema: schemas.issues }, async (args) => { const { owner, repository, ...filters } = schemas.issues.parse(args); return run(() => client.listIssues({ owner, repository }, filters)); });
  server.registerTool("list_pull_requests", { description: "List pull requests for a Gitea repository.", inputSchema: schemas.pullRequests }, async (args) => { const { owner, repository, ...filters } = schemas.pullRequests.parse(args); return run(() => client.listPullRequests({ owner, repository }, filters)); });
  server.registerTool("list_reviews", { description: "List reviews for a Gitea pull request.", inputSchema: schemas.reviews }, async (args) => { const { owner, repository, index, page, limit } = schemas.reviews.parse(args); return run(() => client.listReviews({ owner, repository, index }, { page, limit })); });
  server.registerTool("list_commits", { description: "List commits for a Gitea repository.", inputSchema: schemas.commits }, async (args) => { const { owner, repository, ...filters } = schemas.commits.parse(args); return run(() => client.listCommits({ owner, repository }, filters)); });
}

async function run(load: () => Promise<unknown>): Promise<CallToolResult> {
  try { return { content: [{ type: "text", text: JSON.stringify(sanitize(await load())) }] }; }
  catch (error) { const safe = publicError(error); return { isError: true, content: [{ type: "text", text: JSON.stringify(safe) }] }; }
}

function sanitize(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === "object") { const result: Record<string, JsonValue> = {}; for (const [key, nested] of Object.entries(value)) if (!/token|secret|password|authorization/i.test(key)) result[key] = sanitize(nested); return result; }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}
