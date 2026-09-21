import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/response";
import { AuthError } from "@/lib/auth/errors";
import { createSession, applySessionCookie } from "@/lib/auth/session";
import { exchangeCode, oauthStateCookie, type OAuthState } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("error")) throw new AuthError("OAUTH_PROVIDER_ERROR");
    const code = params.get("code");
    const state = params.get("state");
    const stored = parseState(request.cookies.get(oauthStateCookie)?.value);
    if (!code || !state || !stored || stored.expiresAt <= Date.now() || !sameValue(state, stored.state)) return fail("OAUTH_STATE_MISMATCH");
    const token = await exchangeCode(code, stored.verifier);
    const response = NextResponse.redirect(new URL("/collaborator", request.url));
    applySessionCookie(response, createSession(token));
    response.cookies.set(oauthStateCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/gitea", maxAge: 0 });
    return response;
  } catch (error) { return authErrorResponse(error); }
}

function parseState(value: string | undefined): OAuthState | null { if (!value) return null; try { const parsed = JSON.parse(value) as OAuthState; return typeof parsed.state === "string" && typeof parsed.verifier === "string" && typeof parsed.expiresAt === "number" ? parsed : null; } catch { return null; } }
function sameValue(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function fail(code: "OAUTH_STATE_MISMATCH"): NextResponse { return NextResponse.json({ error: { code, message: "OAuth state validation failed." } }, { status: 401 }); }
