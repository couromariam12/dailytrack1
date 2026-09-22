import { commits, issues, pullRequests, repositories, reviews } from "@/lib/gitea/routes";
import type { GiteaServerClient } from "@/lib/gitea/client";
import type { CommitDto, IssueDto, PullRequestDto, RepositoryDto, ReviewDto } from "@/lib/gitea/types";

export type ExportActivityType = "all" | "issues" | "pulls" | "commits" | "reviews";
export type ExportFilters = { owner: string; repository: string; type: ExportActivityType; collaborator: string | null; since: string | null; until: string | null };
export type ExportBundle = { repositories: RepositoryDto[]; repository: RepositoryDto | null; issues: IssueDto[]; pulls: PullRequestDto[]; commits: CommitDto[]; reviews: ReviewDto[]; errors: Partial<Record<ExportActivityType, string>> };

const pageLimit = 20;

export async function collectAdminExport(client: GiteaServerClient, filters: ExportFilters): Promise<ExportBundle> {
  const repositoryPage = await collectPages((page) => repositories({ page, limit: 100 }, client));
  const allRepositories = repositoryPage.items;
  const selected = allRepositories.find((item) => item.full_name === `${filters.owner}/${filters.repository}`) ?? null;
  const dateIssue = filters.since && filters.until ? { since: filters.since, before: filters.until } : {};
  const dateActivity = filters.since && filters.until ? { since: filters.since, until: filters.until } : {};
  const [issueResult, pullResult, commitResult] = await Promise.all([
    collectPages((page) => issues({ owner: filters.owner, repository: filters.repository, page, limit: pageLimit, state: "all", type: "issues", ...dateIssue }, client)),
    collectPages((page) => pullRequests({ owner: filters.owner, repository: filters.repository, page, limit: pageLimit, state: "all", ...dateActivity }, client)),
    collectPages((page) => commits({ owner: filters.owner, repository: filters.repository, page, limit: pageLimit, ...dateActivity }, client)),
  ]);

  const reviewsByPull = await Promise.all(pullResult.items.filter((item) => item.index !== null).map(async (pull) => ({
    parentUrl: pull.html_url,
    result: await collectPages((page) => reviews({ owner: filters.owner, repository: filters.repository, index: pull.index!, page, limit: pageLimit, ...dateActivity }, client)),
  })));
  const raw: ExportBundle = {
    repositories: allRepositories,
    repository: selected,
    issues: issueResult.items.filter((item) => item.type === "issue"),
    pulls: pullResult.items,
    commits: commitResult.items,
    reviews: reviewsByPull.flatMap(({ parentUrl, result }) => result.items.map((review) => ({ ...review, pull_request_url: parentUrl }))),
    errors: {
      ...(issueResult.error ? { issues: issueResult.error } : {}),
      ...(pullResult.error ? { pulls: pullResult.error } : {}),
      ...(commitResult.error ? { commits: commitResult.error } : {}),
      ...(reviewsByPull.some(({ result }) => result.error) ? { reviews: reviewsByPull.find(({ result }) => result.error)?.result.error ?? "Reviews indisponibles." } : {}),
    },
  };
  return filterBundle(raw, filters);
}

export function getExportCounts(bundle: ExportBundle) { return { issues: bundle.issues.length, pulls: bundle.pulls.length, commits: bundle.commits.length, reviews: bundle.reviews.length }; }

function filterBundle(bundle: ExportBundle, filters: ExportFilters): ExportBundle {
  const collaborator = filters.collaborator;
  const filterCollaborator = <T extends IssueDto | PullRequestDto | CommitDto | ReviewDto>(items: T[], matches: (item: T) => boolean) => collaborator ? items.filter(matches) : items;
  const filtered: ExportBundle = {
    ...bundle,
    issues: filterCollaborator(bundle.issues, (item) => item.author?.login === collaborator || item.assignees.some((user) => user.login === collaborator)),
    pulls: filterCollaborator(bundle.pulls, (item) => item.author?.login === collaborator),
    commits: filterCollaborator(bundle.commits, (item) => item.author?.login === collaborator || item.committer?.login === collaborator),
    reviews: filterCollaborator(bundle.reviews, (item) => item.author?.login === collaborator),
  };
  if (filters.type === "issues") return { ...filtered, pulls: [], commits: [], reviews: [] };
  if (filters.type === "pulls") return { ...filtered, issues: [], commits: [], reviews: [] };
  if (filters.type === "commits") return { ...filtered, issues: [], pulls: [], reviews: [] };
  if (filters.type === "reviews") return { ...filtered, issues: [], pulls: [], commits: [] };
  return filtered;
}

async function collectPages<T>(fetchPage: (page: number) => Promise<{ items: T[]; pagination: { has_more: boolean } }>): Promise<{ items: T[]; error: string | null }> {
  const items: T[] = [];
  try {
    for (let page = 1; page <= 100; page += 1) {
      const result = await fetchPage(page);
      items.push(...result.items);
      if (!result.pagination.has_more) return { items, error: null };
    }
    return { items, error: "Pagination Gitea interrompue après 100 pages." };
  } catch (error) {
    return { items, error: error instanceof Error ? error.message : "Données Gitea indisponibles." };
  }
}
