import { describe, expect, it, vi } from "vitest";
import { GiteaClient } from "./client";

function response(status: number, payload: unknown): Response { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } }); }

describe("GiteaClient", () => {
  it("performs a paginated GET", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(200, [{ id: 1 }]));
    const client = new GiteaClient({ baseUrl: "https://gitea.test", token: "private-token", timeoutMs: 1000 }, fetchMock);
    await expect(client.listRepositories({ page: 2, limit: 20 })).resolves.toMatchObject({ page: 2, limit: 20, has_more: false });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "GET", headers: { Accept: "application/json", Authorization: "token private-token" } }));
  });
  it.each([401, 403, 404, 409])("maps HTTP %s safely", async (status) => {
    const client = new GiteaClient({ baseUrl: "https://gitea.test", token: "private-token", timeoutMs: 1000 }, vi.fn<typeof fetch>().mockResolvedValue(response(status, { token: "must-not-leak" })));
    await expect(client.getCurrentUser()).rejects.toMatchObject({ status });
    await expect(client.getCurrentUser()).rejects.not.toThrow("must-not-leak");
  });
  it("does not call the network without configuration", async () => {
    const fetchMock = vi.fn<typeof fetch>(); const client = new GiteaClient({ baseUrl: "", token: "", timeoutMs: 1000 }, fetchMock);
    await expect(client.getCurrentUser()).rejects.toMatchObject({ code: "GITEA_CONFIGURATION" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps aborts to timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); }));
    await expect(new GiteaClient({ baseUrl: "https://gitea.test", token: "private-token", timeoutMs: 1 }, fetchMock).getCurrentUser()).rejects.toMatchObject({ code: "GITEA_TIMEOUT" });
  });
  it("rejects invalid JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(new GiteaClient({ baseUrl: "https://gitea.test", token: "private-token", timeoutMs: 1000 }, fetchMock).getCurrentUser()).rejects.toMatchObject({ code: "GITEA_INVALID_RESPONSE" });
  });
});
