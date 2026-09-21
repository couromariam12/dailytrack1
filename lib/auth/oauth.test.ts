import { describe, expect, it, vi } from "vitest";
import { authorizationUrl, challengeFor, createOAuthState, exchangeCode } from "./oauth";
import { GET as login } from "@/app/api/auth/gitea/login/route";
import { GET as callback } from "@/app/api/auth/gitea/callback/route";
import { NextRequest } from "next/server";

describe("Gitea OAuth PKCE", () => {
  it("creates an S256 authorization URL without a client secret", () => {
    vi.stubEnv("GITEA_URL", "https://gitea.example.test");
    vi.stubEnv("GITEA_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    vi.stubEnv("GITEA_OAUTH_SCOPES", "read:user");
    vi.stubEnv("AUTH_SECRET", "session-secret");
    const state = createOAuthState();
    const url = authorizationUrl(state);
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(challengeFor(state.verifier));
    expect(url.searchParams.get("client_secret")).toBeNull();
  });

  it("exchanges a code with POST and preserves the token server-side", async () => {
    vi.stubEnv("GITEA_URL", "https://gitea.example.test");
    vi.stubEnv("GITEA_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITEA_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    vi.stubEnv("AUTH_SECRET", "session-secret");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ access_token: "opaque-test-value", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await exchangeCode("code", "verifier");
    expect(result.accessToken).toBe("opaque-test-value");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain("code_verifier=verifier");
    expect(body).not.toContain("client_secret");
  });

  it("starts login with an HTTP-only state cookie and rejects an invalid callback", async () => {
    const loginResponse = await login();
    expect(loginResponse.status).toBe(307);
    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly");
    const callbackResponse = await callback(new NextRequest("http://localhost/api/auth/gitea/callback?code=code&state=wrong"));
    expect(callbackResponse.status).toBe(401);
  });
});
