import { NextRequest, NextResponse } from "next/server";
import { authErrorRedirect } from "@/lib/auth/redirect";
import { authorizationUrl, createOAuthState, oauthStateCookie } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(authorizationUrl(state));
    response.cookies.set(oauthStateCookie, JSON.stringify(state), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/gitea", maxAge: 600 });
    return response;
  } catch (error) {
    return authErrorRedirect(request, error);
  }
}
