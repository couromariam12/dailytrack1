import { handleAuthenticatedQuery } from "@/lib/gitea/handler";
import { reviews, schemas } from "@/lib/gitea/routes";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return handleAuthenticatedQuery(request, schemas.reviews, (input, client) => reviews(input, client)); }
