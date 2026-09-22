import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAdminGiteaClient } from "./admin";
import { clearSessionsForTests, createSession } from "./session";
import { AuthError } from "./errors";

function configure() {
  vi.stubEnv("DAILYTRACK_DEV_AUTH", "false");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("GITEA_URL", "https://gitea.example");
  vi.stubEnv("GITEA_TIMEOUT_SECONDS", "5");
  vi.stubEnv("DAILYTRACK_ADMIN_LOGINS", "admin-user");
}

function requestWithSession(login: string) {
  const sessionId = createSession({ accessToken: "opaque-session-token", expiresAt: null, user: { id: 1, login, full_name: null, html_url: null, avatar_url: null }, method: "token" });
  return new NextRequest("http://127.0.0.1:3000/api/admin/export/csv", { headers: { cookie: `dailytrack_session=${sessionId}` } });
}

describe("Admin authorization with personal-token sessions", () => {
  afterEach(() => { clearSessionsForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("allows an authorized token user", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 1, login: "admin-user" }), { status: 200 })));
    await expect(requireAdminGiteaClient(requestWithSession("admin-user"))).resolves.toBeDefined();
  });

  it("returns an explicit Admin-required error for a token collaborator", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 2, login: "collaborator-user" }), { status: 200 })));
    await expect(requireAdminGiteaClient(requestWithSession("collaborator-user"))).rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 });
  });

  it("returns 401 when the token session is absent", async () => {
    configure();
    try {
      await requireAdminGiteaClient(new NextRequest("http://127.0.0.1:3000/api/admin/export/csv"));
      throw new Error("expected authorization failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("SESSION_REQUIRED");
      expect((error as AuthError).status).toBe(401);
    }
  });
});
