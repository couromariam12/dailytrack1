import { NextRequest, NextResponse } from "next/server";
import { authenticatePersonalToken } from "@/lib/auth/token";
import { authErrorResponse } from "@/lib/auth/response";
import { applySessionCookie, createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token?: unknown };
    if (typeof body.token !== "string") return NextResponse.json({ error: { code: "TOKEN_REQUIRED", message: "A Gitea personal token is required." } }, { status: 400 });
    const user = await authenticatePersonalToken(body.token);
    const response = NextResponse.json({ user }, { status: 200 });
    applySessionCookie(response, createSession({ accessToken: body.token.trim(), expiresAt: null, user, method: "token" }));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
