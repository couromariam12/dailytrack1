import { currentUser } from "@/lib/gitea/routes";
import { handleAuthenticatedOperation } from "@/lib/gitea/handler";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) { return handleAuthenticatedOperation(request, (client) => currentUser(client)); }
