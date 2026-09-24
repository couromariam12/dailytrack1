import { describe, expect, it } from "vitest";
import { buildMilestonesQuery, buildRepositoryActivityQuery, defaultFilters, defaultMilestoneFilters, filterMilestones, isSprintMilestone, milestoneExternalUrl, milestoneProgress, repositoryPeriodRange } from "./repository-detail";
import type { MilestoneDto } from "@/lib/gitea/types";

const milestone = (title: string, overrides: Partial<MilestoneDto> = {}): MilestoneDto => ({ id: null, title, description: null, state: "open", open_issues: 2, closed_issues: 3, due_on: null, created_at: null, updated_at: null, html_url: null, ...overrides });

describe("Repository activity filters", () => {
  it("starts with issues for the requested repository", () => {
    const query = buildRepositoryActivityQuery("MyKreno", "Backend", defaultFilters);

    expect(query.get("owner")).toBe("MyKreno");
    expect(query.get("repository")).toBe("Backend");
    expect(query.get("types")).toBe("issues");
    expect(query.get("state")).toBe("all");
    expect(query.has("since")).toBe(false);
    expect(query.has("until")).toBe(false);
  });

  it("adds both date bounds when a period is selected", () => {
    const query = buildRepositoryActivityQuery("MyKreno", "Backend", { ...defaultFilters, period: "today" });

    expect(query.get("since")).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(query.get("until")).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  });

  it("sends the selected custom dates as a half-open interval", () => {
    const filters = { ...defaultFilters, period: "custom" as const, customStartDate: "2026-09-18", customEndDate: "2026-09-20" };
    const query = buildRepositoryActivityQuery("MyKreno", "Backend", filters);
    expect(query.get("since")).toBe("2026-09-18T00:00:00.000Z");
    expect(query.get("until")).toBe("2026-09-21T00:00:00.000Z");
    expect(repositoryPeriodRange(filters)).toEqual({ start: "2026-09-18T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z" });
  });

  it("does not send a partial custom period", () => {
    const filters = { ...defaultFilters, period: "custom" as const, customStartDate: "2026-09-18", customEndDate: "" };
    const query = buildRepositoryActivityQuery("MyKreno", "Backend", filters);
    expect(query.has("since")).toBe(false);
    expect(query.has("until")).toBe(false);
    expect(repositoryPeriodRange(filters)).toBeNull();
  });

  it("keeps milestone requests scoped to the selected repository", () => {
    const first = buildMilestonesQuery("Yros", "Kavero");
    const second = buildMilestonesQuery("MyKreno", "Backend");
    expect(first.get("owner")).toBe("Yros");
    expect(first.get("repository")).toBe("Kavero");
    expect(second.get("owner")).toBe("MyKreno");
    expect(second.get("repository")).toBe("Backend");
  });

  it("classifies only names that clearly start with Sprint", () => {
    expect(isSprintMilestone(milestone("Sprint 4"))).toBe(true);
    expect(isSprintMilestone(milestone("JA-2026-09"))).toBe(false);
    expect(isSprintMilestone(milestone("SprintReview"))).toBe(false);
  });

  it("calculates progress from real open and closed issue counts", () => {
    expect(milestoneProgress(milestone("Sprint 4"))).toBe(60);
    expect(milestoneProgress(milestone("Empty", { open_issues: 0, closed_issues: 0 }))).toBe(0);
    expect(milestoneProgress(milestone("Unknown", { open_issues: null }))).toBeNull();
  });

  it("filters milestones without merging equal names from different repositories", () => {
    const items = [milestone("Sprint 4", { id: 1 }), milestone("Sprint 4", { id: 2 })];
    expect(filterMilestones(items, defaultMilestoneFilters)).toHaveLength(2);
    expect(filterMilestones(items, { ...defaultMilestoneFilters, search: "sprint" })).toHaveLength(2);
  });

  it("filters closed and due milestones locally", () => {
    const items = [milestone("Open", { state: "open" }), milestone("Closed", { state: "closed", due_on: "2026-09-30T00:00:00Z" })];
    expect(filterMilestones(items, { ...defaultMilestoneFilters, state: "closed", due: "with_due_date" })).toEqual([items[1]]);
  });

  it("exposes only a URL actually supplied by Gitea", () => {
    expect(milestoneExternalUrl(milestone("With link", { html_url: "https://gitea.example/acme/app/milestones/4" }))).toBe("https://gitea.example/acme/app/milestones/4");
    expect(milestoneExternalUrl(milestone("Without link"))).toBeNull();
  });
});
