import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }, { status: 401 });
  return NextResponse.json({ user: session.user ?? null, method: session.method ?? "oauth", expiresAt: session.expiresAt }, { status: 200, headers: { "cache-control": "no-store" } });
}
