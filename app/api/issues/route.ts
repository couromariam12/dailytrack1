import { handleAuthenticatedQuery } from "@/lib/gitea/handler";
import { issues, schemas } from "@/lib/gitea/routes";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return handleAuthenticatedQuery(request, schemas.issues, (input, client) => issues(input, client)); }
