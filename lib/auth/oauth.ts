import { randomBytes, createHash } from "node:crypto";
import { getServerEnv } from "@/lib/server-env";
import { AuthError } from "./errors";

export const oauthStateCookie = "dailytrack_oauth_state";
export const sessionCookie = "dailytrack_session";
const stateLifetime = 600;

export type OAuthState = { state: string; verifier: string; expiresAt: number };
export type OAuthToken = { accessToken: string; expiresAt: number | null };

export function createOAuthState(): OAuthState { return { state: randomBytes(32).toString("base64url"), verifier: randomBytes(48).toString("base64url"), expiresAt: Date.now() + stateLifetime * 1000 }; }
export function challengeFor(verifier: string): string { return createHash("sha256").update(verifier).digest("base64url"); }

export function authorizationUrl(input: OAuthState): URL {
  const env = getServerEnv();
  if (!env.giteaUrl || !env.giteaOauthClientId || !env.giteaRedirectUri || !env.authSecret) throw new AuthError("AUTH_CONFIGURATION", 503);
  const url = new URL("/login/oauth/authorize", env.giteaUrl);
  url.searchParams.set("client_id", env.giteaOauthClientId); url.searchParams.set("redirect_uri", env.giteaRedirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", env.giteaOauthScopes); url.searchParams.set("state", input.state); url.searchParams.set("code_challenge", challengeFor(input.verifier)); url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeCode(code: string, verifier: string): Promise<OAuthToken> {
  const env = getServerEnv();
  if (!env.giteaUrl || !env.giteaOauthClientId || !env.giteaRedirectUri || !env.authSecret) throw new AuthError("AUTH_CONFIGURATION", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, env.giteaTimeoutSeconds * 1000));
  try {
    const tokenParams = new URLSearchParams({ client_id: env.giteaOauthClientId, code, redirect_uri: env.giteaRedirectUri, grant_type: "authorization_code", code_verifier: verifier });
    if (env.giteaOauthClientSecret) tokenParams.set("client_secret", env.giteaOauthClientSecret);
    const response = await fetch(new URL("/login/oauth/access_token", env.giteaUrl), { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: tokenParams, signal: controller.signal });
    if (!response.ok) throw new AuthError("OAUTH_PROVIDER_ERROR");
    const payload = await response.json() as Record<string, unknown>;
    if (typeof payload.access_token !== "string" || !payload.access_token) throw new AuthError("OAUTH_PROVIDER_ERROR");
    const expires = typeof payload.expires_in === "number" ? Date.now() + payload.expires_in * 1000 : null;
    return { accessToken: payload.access_token, expiresAt: expires };
  } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError("OAUTH_PROVIDER_ERROR"); } finally { clearTimeout(timeout); }
}
