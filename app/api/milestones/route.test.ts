import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

function setup() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DAILYTRACK_DEV_AUTH", "true");
  vi.stubEnv("DAILYTRACK_DEV_ROLE", "admin");
  vi.stubEnv("GITEA_URL", "https://gitea.example");
  vi.stubEnv("GITEA_TOKEN", "test-only-token");
  vi.stubEnv("GITEA_TIMEOUT_SECONDS", "1");
}

function request() {
  return new NextRequest("http://127.0.0.1:3001/api/milestones?owner=acme&repository=app&page=1&limit=50&state=all");
}

describe("GET /api/milestones", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("returns normalized milestones from the repository endpoint", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{ id: 4, title: "Sprint 4", state: "open", open_issues: 2, closed_issues: 3 }]), { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ title: "Sprint 4", open_issues: 2, closed_issues: 3 }] });
  });

  it("keeps an empty repository result empty", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [], pagination: { has_more: false } });
  });

  it.each([[403, 403], [404, 404], [409, 409]])("preserves Gitea status %s", async (giteaStatus, expectedStatus) => {
    setup();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: giteaStatus })));
    const response = await GET(request());
    expect(response.status).toBe(expectedStatus);
  });

  it("maps a timeout to 504", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError")));
    const response = await GET(request());
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: "GITEA_TIMEOUT" } });
  });
});
