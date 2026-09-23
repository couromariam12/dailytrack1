import { config } from "dotenv";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { GiteaClient } from "./client";
import { registerGiteaTools } from "./tools";

// This module is loaded only by the MCP stdio process, never by Next.js client code.
// .env.local takes precedence over .env; variables already set in the environment win over both.
config({ path: [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")], override: false, quiet: true });

function createServer(): McpServer {
  const server = new McpServer({ name: "dailytrack-gitea", version: "0.1.0" });
  const timeoutSeconds = Number(process.env.GITEA_TIMEOUT_SECONDS ?? "10");
  const client = new GiteaClient({ baseUrl: process.env.GITEA_URL ?? "", token: process.env.GITEA_TOKEN ?? "", timeoutMs: timeoutSeconds * 1000 });
  registerGiteaTools(server as unknown as Parameters<typeof registerGiteaTools>[0], client);
  return server;
}

await serveStdio(createServer);
