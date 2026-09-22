import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminUser } from "./authorization";

describe("Admin sidebar authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("shows Admin only for configured Gitea logins", () => {
    vi.stubEnv("DAILYTRACK_ADMIN_LOGINS", "admin-user, other-admin");
    expect(isAdminUser({ id: 1, login: "admin-user", full_name: null, html_url: null, avatar_url: null })).toBe(true);
    expect(isAdminUser({ id: 2, login: "collaborator-user", full_name: null, html_url: null, avatar_url: null })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});
