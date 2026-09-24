import { allRepositories } from "@/lib/gitea/routes";
import { collectRepositoryActivity } from "@/lib/activity/collect";
import type { ActivityBundle } from "@/lib/activity/types";
import type { GiteaServerClient } from "@/lib/gitea/client";
import type { RepositoryDto } from "@/lib/gitea/types";
import type { ExportFilters } from "./export-schema";

export type ExportActivityType = ExportFilters["type"];
export type ExportBundle = ActivityBundle & {
  repositories: RepositoryDto[];
  repository: RepositoryDto | null;
};

export async function collectAdminExport(client: GiteaServerClient, filters: ExportFilters): Promise<ExportBundle> {
  const repositories = await allRepositories(client);
  const fullName = `${filters.owner}/${filters.repository}`;
  const repository = repositories.find((item) => item.full_name === fullName) ?? null;
  const activity = await collectRepositoryActivity(client, {
    owner: filters.owner,
    repository: filters.repository,
    range: filters.since && filters.until ? { start: filters.since, end: filters.until } : null,
    state: "all",
  });
  return { ...filterBundle(activity, filters), repositories, repository };
}

export function getExportCounts(bundle: ExportBundle) {
  return { issues: bundle.issues.length, pulls: bundle.pulls.length, commits: bundle.commits.length, reviews: bundle.reviews.length };
}

function filterBundle(bundle: ActivityBundle, filters: ExportFilters): ActivityBundle {
  const collaborator = filters.collaborator;
  const filtered: ActivityBundle = collaborator ? {
    ...bundle,
    issues: bundle.issues.filter((item) => item.author?.login === collaborator || item.assignees.some((user) => user.login === collaborator)),
    pulls: bundle.pulls.filter((item) => item.author?.login === collaborator),
    commits: bundle.commits.filter((item) => item.author?.login === collaborator || item.committer?.login === collaborator),
    reviews: bundle.reviews.filter((item) => item.author?.login === collaborator),
  } : bundle;
  if (filters.type === "issues") return { ...filtered, pulls: [], commits: [], reviews: [] };
  if (filters.type === "pulls") return { ...filtered, issues: [], commits: [], reviews: [] };
  if (filters.type === "commits") return { ...filtered, issues: [], pulls: [], reviews: [] };
  if (filters.type === "reviews") return { ...filtered, issues: [], pulls: [], commits: [] };
  return filtered;
}
