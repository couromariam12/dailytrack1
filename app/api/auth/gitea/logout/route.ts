import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSession } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const redirectUri = process.env.GITEA_OAUTH_REDIRECT_URI ?? request.url;
  const appOrigin = new URL(redirectUri).origin;
  const response = NextResponse.redirect(new URL("/", appOrigin));
  deleteSession(request.cookies.get(sessionCookie)?.value);
  clearSessionCookie(response);
  return response;
}
