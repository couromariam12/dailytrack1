import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getMe } from "@/app/api/me/route";
import { createSession, openSession, sealSession, SESSION_MAX_AGE_MS } from "./session";

const secret = "a-test-secret-of-at-least-32-characters";

describe("encrypted session cookie", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", secret));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("round-trips a session without exposing the token", () => {
    const session = createSession({ accessToken: "user-token", expiresAt: Date.now() + 60_000 });
    const sealed = sealSession(session);
    expect(sealed).not.toContain("user-token");
    expect(openSession(sealed)).toEqual(session);
  });

  it("caps the session to the token lifetime and to 8 hours", () => {
    const now = 1_000_000;
    expect(createSession({ accessToken: "t", expiresAt: now + 3_600_000 }, now).expiresAt).toBe(now + 3_600_000);
    expect(createSession({ accessToken: "t", expiresAt: null }, now).expiresAt).toBe(now + SESSION_MAX_AGE_MS);
  });

  it("rejects tampered, foreign and expired cookies", () => {
    const sealed = sealSession({ accessToken: "user-token", expiresAt: Date.now() + 60_000 });
    const tampered = `${sealed.slice(0, 20)}${sealed[20] === "A" ? "B" : "A"}${sealed.slice(21)}`;
    expect(() => openSession(tampered)).toThrow(expect.objectContaining({ code: "SESSION_INVALID" }));
    vi.stubEnv("AUTH_SECRET", "another-secret-of-at-least-32-characters");
    expect(() => openSession(sealed)).toThrow(expect.objectContaining({ code: "SESSION_INVALID" }));
    vi.stubEnv("AUTH_SECRET", secret);
    const expired = sealSession({ accessToken: "user-token", expiresAt: Date.now() - 1 });
    expect(() => openSession(expired)).toThrow(expect.objectContaining({ code: "SESSION_EXPIRED" }));
  });

  it("refuses to seal a session with a short AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "short");
    expect(() => sealSession({ accessToken: "t", expiresAt: Date.now() + 1000 })).toThrow(expect.objectContaining({ code: "AUTH_CONFIGURATION" }));
  });

  it("calls Gitea with the user's own token from the cookie", async () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "false");
    vi.stubEnv("GITEA_URL", "https://gitea.example");
    vi.stubEnv("GITEA_TOKEN", "service-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 4, login: "alice" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const cookie = sealSession({ accessToken: "user-token", expiresAt: Date.now() + 60_000 });
    const response = await getMe(new NextRequest("http://127.0.0.1:3000/api/me", { headers: { cookie: `dailytrack_session=${cookie}` } }));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "token user-token" }) }));
  });

  it("answers 401 SESSION_EXPIRED for an expired cookie", async () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "false");
    const cookie = sealSession({ accessToken: "user-token", expiresAt: Date.now() - 1 });
    const response = await getMe(new NextRequest("http://127.0.0.1:3000/api/me", { headers: { cookie: `dailytrack_session=${cookie}` } }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "SESSION_EXPIRED" } });
  });
});
