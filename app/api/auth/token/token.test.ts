import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "./login/route";
import { GET as status } from "./status/route";
import { clearSessionsForTests } from "@/lib/auth/session";

function configure() {
  vi.stubEnv("GITEA_URL", "https://gitea.example");
  vi.stubEnv("GITEA_TIMEOUT_SECONDS", "5");
  vi.stubEnv("NODE_ENV", "development");
}

describe("personal Gitea token authentication", () => {
  afterEach(() => { clearSessionsForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("creates a server session after validating a token", async () => {
    configure();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 7, login: "maick", full_name: null, html_url: "https://gitea.example/maick" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await login(new NextRequest("http://127.0.0.1:3000/api/auth/token/login", { method: "POST", body: JSON.stringify({ token: "personal-secret" }), headers: { "content-type": "application/json" } }));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("maick");
    expect(body).not.toContain("personal-secret");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const cookie = response.headers.get("set-cookie")?.match(/dailytrack_session=([^;]+)/)?.[1];
    expect(cookie).toBeTruthy();
    const statusResponse = await status(new NextRequest("http://127.0.0.1:3000/api/auth/token/status", { headers: { cookie: `dailytrack_session=${cookie}` } }));
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toMatchObject({ user: { login: "maick" }, method: "token" });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET", headers: { Accept: "application/json", Authorization: "token personal-secret" } }));
  });

  it("rejects a missing token without creating a session", async () => {
    configure();
    const response = await login(new NextRequest("http://127.0.0.1:3000/api/auth/token/login", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "TOKEN_REQUIRED" } });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an invalid token without returning it", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: "bad token" }), { status: 401 })));
    const response = await login(new NextRequest("http://127.0.0.1:3000/api/auth/token/login", { method: "POST", body: JSON.stringify({ token: "invalid-secret" }), headers: { "content-type": "application/json" } }));
    const body = await response.text();
    expect(response.status).toBe(401);
    expect(body).toContain("TOKEN_INVALID");
    expect(body).not.toContain("invalid-secret");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 for token status without a session", async () => {
    const response = await status(new NextRequest("http://127.0.0.1:3000/api/auth/token/status"));
    expect(response.status).toBe(401);
  });
});
