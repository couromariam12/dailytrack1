import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/gitea/routes";
import { devGiteaClient, getDevAuthStatus, getDevRole } from "./dev-auth";
import { isAdminUser } from "./authorization";
import { authenticatedGiteaClient } from "./client";
import { AuthError } from "./errors";
import type { GiteaServerClient } from "@/lib/gitea/client";

/** Returns a server-only client after enforcing the configured Admin rule. */
export async function requireAdminGiteaClient(request: NextRequest): Promise<GiteaServerClient> {
  const devStatus = getDevAuthStatus();
  if (devStatus === "forbidden") throw new AuthError("DEV_AUTH_FORBIDDEN", 403);
  if (devStatus === "enabled") {
    if (getDevRole() !== "admin") throw new AuthError("ADMIN_REQUIRED", 403);
    return devGiteaClient();
  }
  const client = authenticatedGiteaClient(request);
  if (!isAdminUser(await currentUser(client))) throw new AuthError("ADMIN_REQUIRED", 403);
  return client;
}
