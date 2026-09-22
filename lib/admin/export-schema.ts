import { z } from "zod";

const date = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid date");
export const exportFilters = z.object({
  owner: z.string().min(1).max(255),
  repository: z.string().min(1).max(255),
  type: z.enum(["all", "issues", "pulls", "commits", "reviews"]).default("all"),
  collaborator: z.string().max(255).optional().transform((value) => value || null),
  since: date.optional().nullable().transform((value) => value ?? null),
  until: date.optional().nullable().transform((value) => value ?? null),
}).refine((value) => Boolean(value.since) === Boolean(value.until), { message: "Both since and until are required together." });
