import { NextRequest } from "next/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { GET as getRepositories } from "@/app/api/repositories/route";

describe("protected Gitea routes", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("rejects the current-user route without a session", async () => {
    const response = await getMe(new NextRequest("http://localhost/api/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } });
  });

  it("rejects repository access without a session", async () => {
    const response = await getRepositories(new NextRequest("http://localhost/api/repositories?page=1&limit=20"));
    expect(response.status).toBe(401);
  });

  it("uses the server Gitea token in development auth mode", async () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GITEA_URL", "https://gitea.example");
    vi.stubEnv("GITEA_TOKEN", "server-only-token");
    vi.stubEnv("GITEA_TIMEOUT_SECONDS", "5");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 4, login: "dev-user" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await getMe(new NextRequest("http://127.0.0.1:3000/api/me"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ login: "dev-user" });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "token server-only-token" }) }));
  });
});
