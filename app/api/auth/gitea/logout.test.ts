import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./logout/route";

describe("Gitea logout", () => {
  it("redirects to the configured 127.0.0.1 application origin", async () => {
    vi.stubEnv("GITEA_OAUTH_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/gitea/callback");
    const response = await GET(new NextRequest("http://localhost:3000/api/auth/gitea/logout"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/");
  });
});
