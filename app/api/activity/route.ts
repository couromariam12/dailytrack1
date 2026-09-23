import { handleAuthenticatedQuery } from "@/lib/gitea/handler";
import { activitySchema, repositoryActivity } from "@/lib/activity/service";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return handleAuthenticatedQuery(request, activitySchema, (input, client) => repositoryActivity(input, client)); }
