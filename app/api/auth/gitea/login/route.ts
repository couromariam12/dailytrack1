import { NextResponse } from "next/server";
import { authorizationUrl, createOAuthState, oauthStateCookie } from "@/lib/auth/oauth";
import { authErrorResponse } from "@/lib/auth/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(authorizationUrl(state));
    response.cookies.set(oauthStateCookie, JSON.stringify(state), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/gitea", maxAge: 600 });
    return response;
  } catch (error) { return authErrorResponse(error); }
}
