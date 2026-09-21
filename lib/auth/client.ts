import { GiteaServerClient } from "@/lib/gitea/client";
import { devGiteaClient, getDevAuthStatus } from "./dev-auth";
import { AuthError } from "./errors";
import { requireSession } from "./session";
import type { NextRequest } from "next/server";

export function authenticatedGiteaClient(request: NextRequest): GiteaServerClient {
  const devStatus = getDevAuthStatus();
  if (devStatus === "forbidden") throw new AuthError("DEV_AUTH_FORBIDDEN", 403);
  if (devStatus === "enabled") return devGiteaClient();
  return new GiteaServerClient(undefined, requireSession(request).accessToken);
}
