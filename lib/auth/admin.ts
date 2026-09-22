import type { NextRequest } from "next/server";
import { GiteaServerClient } from "@/lib/gitea/client";
import { currentUser } from "@/lib/gitea/routes";
import { devGiteaClient, getDevAuthStatus, getDevRole } from "@/lib/auth/dev-auth";
import { isAdminUser } from "@/lib/auth/authorization";
import { requireSession } from "@/lib/auth/session";
import { AuthError } from "./errors";

/** Returns a server-only Gitea client after enforcing the Admin role. */
export async function requireAdminGiteaClient(request: NextRequest): Promise<GiteaServerClient> {
  const devStatus = getDevAuthStatus();
  if (devStatus === "forbidden") throw new AuthError("DEV_AUTH_FORBIDDEN", 403);
  if (devStatus === "enabled") {
    if (getDevRole() !== "admin") throw new AuthError("ADMIN_REQUIRED", 403);
    return devGiteaClient();
  }

  const session = requireSession(request);
  const client = new GiteaServerClient(undefined, session.accessToken);
  const user = await currentUser(client);
  if (!isAdminUser(user)) throw new AuthError("ADMIN_REQUIRED", 403);
  return client;
}
