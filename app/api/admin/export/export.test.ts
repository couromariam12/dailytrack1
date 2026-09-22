import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as exportCsv } from "@/app/api/admin/export/csv/route";
import { GET as exportPdf } from "@/app/api/admin/export/pdf/route";

const env = () => {
  vi.stubEnv("DAILYTRACK_DEV_AUTH", "true");
  vi.stubEnv("DAILYTRACK_DEV_ROLE", "admin");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("GITEA_URL", "https://gitea.example");
  vi.stubEnv("GITEA_TOKEN", "server-only-token");
  vi.stubEnv("GITEA_TIMEOUT_SECONDS", "5");
};

function giteaFetch() {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/user/repos")) return new Response(JSON.stringify([{ id: 1, name: "app", full_name: "acme/app", owner: { login: "acme" }, html_url: "https://gitea.example/acme/app" }]), { status: 200 });
    if (path.endsWith("/issues")) return new Response(JSON.stringify([
      { id: 1, number: 1, title: "Included", user: { login: "alice" }, created_at: "2026-09-18T10:00:00Z", labels: [] },
      { id: 2, number: 2, title: "Other user", user: { login: "bob" }, created_at: "2026-09-18T11:00:00Z", labels: [] },
    ]), { status: 200 });
    if (path.endsWith("/pulls")) return new Response(JSON.stringify([]), { status: 200 });
    if (path.endsWith("/commits")) return new Response(JSON.stringify([]), { status: 200 });
    return new Response(JSON.stringify([]), { status: 200 });
  });
}

describe("Admin exports", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("allows an Admin CSV export and applies the selected filters", async () => {
    env();
    vi.stubGlobal("fetch", giteaFetch());
    const response = await exportCsv(new NextRequest("http://127.0.0.1:3000/api/admin/export/csv?owner=acme&repository=app&type=issues&collaborator=alice&since=2026-09-18T00:00:00Z&until=2026-09-19T00:00:00Z"));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("Included");
    expect(body).not.toContain("Other user");
    expect(body).not.toContain("server-only-token");
  });

  it("rejects a Collaborator before contacting Gitea", async () => {
    env();
    vi.stubEnv("DAILYTRACK_DEV_ROLE", "collaborator");
    const fetchMock = giteaFetch();
    vi.stubGlobal("fetch", fetchMock);
    const response = await exportCsv(new NextRequest("http://127.0.0.1:3000/api/admin/export/csv?owner=acme&repository=app"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ADMIN_REQUIRED" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a PDF report using the same filtered dataset", async () => {
    env();
    vi.stubGlobal("fetch", giteaFetch());
    const response = await exportPdf(new NextRequest("http://127.0.0.1:3000/api/admin/export/pdf?owner=acme&repository=app&type=issues&collaborator=alice"));
    const body = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const pdf = new TextDecoder("latin1").decode(body);
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("Repartition par type");
    expect(pdf).toContain("Activite par collaborateur");
    expect(pdf).not.toContain("Activite par repository");
    expect((pdf.match(/\/Type \/Page /g) ?? []).length).toBeLessThanOrEqual(3);
  });

  it("produces a short explicit empty report without fabricated activity", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 })));
    const response = await exportPdf(new NextRequest("http://127.0.0.1:3000/api/admin/export/pdf?owner=acme&repository=empty"));
    const pdf = new TextDecoder("latin1").decode(new Uint8Array(await response.arrayBuffer()));
    expect(response.status).toBe(200);
    expect(pdf).toContain("Aucune activite reelle disponible");
    expect((pdf.match(/\/Type \/Page /g) ?? []).length).toBe(1);
  });
});
