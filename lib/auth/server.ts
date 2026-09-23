import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GiteaServerClient } from "@/lib/gitea/client";
import { currentUser } from "@/lib/gitea/routes";
import { isAdminUser } from "./authorization";
import { giteaClientForToken } from "./client";
import { devGiteaClient, getDevAuthStatus, getDevRole, type DevRole } from "./dev-auth";
import { sessionCookie } from "./oauth";
import { readSession } from "./session";

export type ServerAuth = { client: GiteaServerClient; devRole: DevRole | null };

/**
 * Authentication for server components, with the same rules as the API routes: the development
 * mode wins when enabled, a production build with the development mode on is refused, and an
 * expired or invalid session sends the user back through the (silent) Gitea OAuth flow.
 */
export async function requireServerAuth(): Promise<ServerAuth> {
  const devStatus = getDevAuthStatus();
  if (devStatus === "forbidden") redirect("/?auth_error=DEV_AUTH_FORBIDDEN");
  if (devStatus === "enabled") return { client: devGiteaClient(), devRole: getDevRole() };
  const session = readSession((await cookies()).get(sessionCookie)?.value);
  if (!session) redirect("/api/auth/gitea/login");
  return { client: giteaClientForToken(session.accessToken), devRole: null };
}

export async function isAdmin(auth: ServerAuth): Promise<boolean> {
  if (auth.devRole) return auth.devRole === "admin";
  try {
    return isAdminUser(await currentUser(auth.client));
  } catch {
    return false;
  }
}
