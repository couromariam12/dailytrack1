import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./logout/route";

describe("Gitea logout", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("clears the session cookie and redirects to the configured 127.0.0.1 application origin", async () => {
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/gitea/logout", { method: "POST", headers: { origin: "http://127.0.0.1:3000" } }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/");
    expect(response.headers.get("set-cookie")).toMatch(/dailytrack_session=;.*Max-Age=0/);
  });

  it("refuses a cross-site logout", async () => {
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    const response = await POST(new NextRequest("http://127.0.0.1:3000/api/auth/gitea/logout", { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
