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
    vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters");
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
    vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ access_token: "opaque-test-value", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await exchangeCode("code", "verifier");
    expect(result.accessToken).toBe("opaque-test-value");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain("code_verifier=verifier");
    expect(body).not.toContain("client_secret");
  });

  it("refuses to start login with a short AUTH_SECRET", async () => {
    vi.stubEnv("GITEA_URL", "https://gitea.example.test");
    vi.stubEnv("GITEA_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    vi.stubEnv("AUTH_SECRET", "too-short");
    const response = await login(new NextRequest("http://127.0.0.1:3000/api/auth/gitea/login"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/?auth_error=AUTH_CONFIGURATION");
  });

  it("starts login with an HTTP-only state cookie and redirects an invalid callback to the home page", async () => {
    vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters");
    const loginResponse = await login(new NextRequest("http://127.0.0.1:3000/api/auth/gitea/login"));
    expect(loginResponse.status).toBe(307);
    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly");
    const callbackResponse = await callback(new NextRequest("http://127.0.0.1:3000/api/auth/gitea/callback?code=code&state=wrong"));
    expect(callbackResponse.status).toBe(303);
    expect(callbackResponse.headers.get("location")).toBe("http://127.0.0.1:3000/?auth_error=OAUTH_STATE_MISMATCH");
    expect(callbackResponse.headers.get("set-cookie")).not.toContain("dailytrack_session=");
  });

  it("creates an encrypted session cookie after a valid callback", async () => {
    vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ access_token: "opaque-test-value", expires_in: 3600 }), { status: 200 })));
    const state = { state: "expected", verifier: "verifier", expiresAt: Date.now() + 60_000 };
    const request = new NextRequest("http://127.0.0.1:3000/api/auth/gitea/callback?code=code&state=expected", { headers: { cookie: `dailytrack_oauth_state=${encodeURIComponent(JSON.stringify(state))}` } });
    const response = await callback(request);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/collaborator");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/dailytrack_session=[\w-]+/);
    expect(cookie).not.toContain("opaque-test-value");
    vi.unstubAllGlobals();
  });
});
