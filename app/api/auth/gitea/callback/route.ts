import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { appOrigin, authErrorRedirect } from "@/lib/auth/redirect";
import { applySessionCookie, createSession } from "@/lib/auth/session";
import { exchangeCode, oauthStateCookie, type OAuthState } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("error")) throw new AuthError("OAUTH_PROVIDER_ERROR");
    const code = params.get("code");
    const state = params.get("state");
    const stored = parseState(request.cookies.get(oauthStateCookie)?.value);
    if (!code || !state || !stored || stored.expiresAt <= Date.now() || !sameValue(state, stored.state)) throw new AuthError("OAUTH_STATE_MISMATCH");
    const token = await exchangeCode(code, stored.verifier);
    const response = NextResponse.redirect(new URL("/collaborator", appOrigin(request)));
    applySessionCookie(response, createSession(token));
    clearStateCookie(response);
    return response;
  } catch (error) {
    const response = authErrorRedirect(request, error);
    clearStateCookie(response);
    return response;
  }
}

function clearStateCookie(response: NextResponse): void {
  response.cookies.set(oauthStateCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/gitea", maxAge: 0 });
}
function parseState(value: string | undefined): OAuthState | null { if (!value) return null; try { const parsed = JSON.parse(value) as OAuthState; return typeof parsed.state === "string" && typeof parsed.verifier === "string" && typeof parsed.expiresAt === "number" ? parsed : null; } catch { return null; } }
function sameValue(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
