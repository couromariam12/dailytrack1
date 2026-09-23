import { GiteaServerClient } from "@/lib/gitea/client";
import { getServerEnv } from "@/lib/server-env";
import { devGiteaClient, getDevAuthStatus } from "./dev-auth";
import { AuthError } from "./errors";
import { requireSession } from "./session";
import type { NextRequest } from "next/server";

/** Gitea client acting with the signed-in user's own OAuth token. */
export function giteaClientForToken(accessToken: string): GiteaServerClient {
  const env = getServerEnv();
  return new GiteaServerClient(env.giteaUrl, accessToken, env.giteaTimeoutSeconds * 1000);
}

export function authenticatedGiteaClient(request: NextRequest): GiteaServerClient {
  const devStatus = getDevAuthStatus();
  if (devStatus === "forbidden") throw new AuthError("DEV_AUTH_FORBIDDEN", 403);
  if (devStatus === "enabled") return devGiteaClient();
  return giteaClientForToken(requireSession(request).accessToken);
}
