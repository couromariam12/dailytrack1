import { GiteaServerClient } from "@/lib/gitea/client";
import { getServerEnv } from "@/lib/server-env";
import { AuthError } from "./errors";

export type DevRole = "collaborator" | "admin";
export type DevAuthStatus = "disabled" | "enabled" | "forbidden";

export function getDevAuthStatus(): DevAuthStatus {
  if (process.env.DAILYTRACK_DEV_AUTH !== "true") return "disabled";
  return process.env.NODE_ENV === "production" ? "forbidden" : "enabled";
}

export function isDevAuthEnabled(): boolean { return getDevAuthStatus() === "enabled"; }
export function getDevRole(): DevRole { return process.env.DAILYTRACK_DEV_ROLE === "admin" ? "admin" : "collaborator"; }

export function devGiteaClient(): GiteaServerClient {
  if (getDevAuthStatus() === "forbidden") throw new AuthError("DEV_AUTH_FORBIDDEN", 403);
  if (!isDevAuthEnabled() || !getServerEnv().giteaToken) throw new AuthError("AUTH_CONFIGURATION", 503);
  const env = getServerEnv();
  return new GiteaServerClient(env.giteaUrl, env.giteaToken, env.giteaTimeoutSeconds * 1000);
}

