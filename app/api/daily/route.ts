import { handleAuthenticatedQuery } from "@/lib/gitea/handler";
import { dailyActivity, dailySchema } from "@/lib/activity/service";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return handleAuthenticatedQuery(request, dailySchema, (input, client) => dailyActivity(input, client)); }
