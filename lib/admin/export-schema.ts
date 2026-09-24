import { z } from "zod";

const date = z.string().max(64).refine((value) => Number.isFinite(Date.parse(value)), "Date invalide.");

export const exportFilters = z.object({
  owner: z.string().min(1).max(255),
  repository: z.string().min(1).max(255),
  type: z.enum(["all", "issues", "pulls", "commits", "reviews"]).default("all"),
  collaborator: z.string().max(255).optional().transform((value) => value || null),
  since: date.optional().nullable().transform((value) => value ?? null),
  until: date.optional().nullable().transform((value) => value ?? null),
}).refine((value) => Boolean(value.since) === Boolean(value.until), { message: "Les deux bornes de période sont requises ensemble." })
  .refine((value) => !value.since || !value.until || Date.parse(value.since) < Date.parse(value.until), { message: "La période est invalide." });

export type ExportFilters = z.infer<typeof exportFilters>;
