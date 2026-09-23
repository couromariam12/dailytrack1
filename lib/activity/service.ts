import { z } from "zod";
import { mapLimit } from "@/lib/async";
import { dayRange } from "@/lib/date/range";
import type { GiteaServerClient } from "@/lib/gitea/client";
import { allRepositories, currentUser } from "@/lib/gitea/routes";
import type { GiteaUserDto } from "@/lib/gitea/types";
import { activityKinds, collectRepositoryActivity, mergeBundles, UNAVAILABLE_CODES, type ActivityBundle, type ActivityKind } from "./collect";

const REPOSITORY_CONCURRENCY = 4;
const login = z.string().trim().max(255).optional().transform((value) => value || undefined);
const timestamp = z.string().max(64).refine((value) => Number.isFinite(Date.parse(value)), "Invalid date.");
const fullName = z.string().regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/repository.");

export const activitySchema = z.object({
  owner: z.string().min(1).max(255),
  repository: z.string().min(1).max(255),
  since: timestamp.optional(),
  until: timestamp.optional(),
  state: z.enum(["all", "open", "closed"]).default("all"),
  created_by: login,
  assigned_by: login,
  types: z.string().max(100).optional().transform((value) => value ? value.split(",").filter((kind): kind is ActivityKind => (activityKinds as string[]).includes(kind)) : [...activityKinds]),
}).refine((value) => (value.since === undefined) === (value.until === undefined) && (!value.since || Date.parse(value.since) < Date.parse(value.until ?? "")), "since and until must be provided together, with since before until.");

export const dailySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(`${value}T00:00:00Z`)), "Invalid date."),
  repository: fullName.optional().or(z.literal("").transform(() => undefined)),
});

export async function repositoryActivity(input: z.infer<typeof activitySchema>, client: GiteaServerClient): Promise<ActivityBundle> {
  return collectRepositoryActivity(client, {
    owner: input.owner,
    repository: input.repository,
    range: input.since && input.until ? { start: input.since, end: input.until } : null,
    state: input.state,
    author: input.created_by,
    assignee: input.assigned_by,
    kinds: input.types,
  });
}

export type DailyActivity = ActivityBundle & { user: GiteaUserDto | null; date: string; repositories: number };

/**
 * The signed-in user's own activity for one UTC day, across every accessible repository (archived
 * ones are skipped, they cannot receive new activity) or a single one.
 */
export async function dailyActivity(input: z.infer<typeof dailySchema>, client: GiteaServerClient): Promise<DailyActivity> {
  const user = await currentUser(client);
  const author = user?.login ?? undefined;
  const repositories = input.repository
    ? [input.repository]
    : (await allRepositories(client)).filter((repository) => repository.archived !== true).map((repository) => repository.full_name).filter((name): name is string => Boolean(name));
  if (!author) return { ...mergeBundles([]), user, date: input.date, repositories: repositories.length };
  const range = dayRange(input.date);
  const bundles = await mapLimit(repositories, REPOSITORY_CONCURRENCY, (name) => {
    const [owner = "", repository = ""] = name.split("/", 2);
    return collectRepositoryActivity(client, { owner, repository, range, author });
  });
  const merged = mergeBundles(bundles);
  // Across every repository, a disabled feature or an empty repository is not worth a warning.
  const warnings = merged.warnings.filter((warning) => !UNAVAILABLE_CODES.has(warning.code));
  return { ...merged, warnings, user, date: input.date, repositories: repositories.length };
}
