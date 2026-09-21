import * as z from "zod/v4";

const pagination = { page: z.number().int().min(1), limit: z.number().int().min(1).max(100) };
const repository = { owner: z.string().min(1).max(255), repository: z.string().min(1).max(255) };

export const schemas = {
  repositories: z.object(pagination),
  issues: z.object({ ...repository, ...pagination, state: z.enum(["all", "open", "closed"]).optional(), type: z.enum(["all", "issues", "pulls"]).optional(), since: z.string().optional(), before: z.string().optional(), created_by: z.string().max(255).optional(), assigned_by: z.string().max(255).optional() }),
  pullRequests: z.object({ ...repository, ...pagination, state: z.enum(["all", "open", "closed"]).optional(), sort: z.string().optional(), base_branch: z.string().optional(), milestone: z.string().optional(), labels: z.string().optional(), poster: z.string().optional() }),
  reviews: z.object({ ...repository, index: z.number().int().min(1), ...pagination }),
  commits: z.object({ ...repository, ...pagination, sha: z.string().optional(), path: z.string().optional(), since: z.string().optional(), until: z.string().optional(), verification: z.string().optional() }),
};
