import { afterEach, describe, expect, it, vi } from "vitest";
import { devGiteaClient, getDevAuthStatus, getDevRole } from "./dev-auth";

describe("development authentication", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is enabled only outside production and keeps the configured role", () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "true");
    vi.stubEnv("DAILYTRACK_DEV_ROLE", "admin");
    vi.stubEnv("NODE_ENV", "development");
    expect(getDevAuthStatus()).toBe("enabled");
    expect(getDevRole()).toBe("admin");
  });

  it("refuses the development mode in production", () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(getDevAuthStatus()).toBe("forbidden");
    expect(() => devGiteaClient()).toThrow("Development authentication is disabled in production.");
  });

  it("is disabled unless explicitly enabled", () => {
    vi.stubEnv("DAILYTRACK_DEV_AUTH", "false");
    vi.stubEnv("NODE_ENV", "development");
    expect(getDevAuthStatus()).toBe("disabled");
  });
});
