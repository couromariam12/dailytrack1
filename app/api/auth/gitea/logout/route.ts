import { NextRequest, NextResponse } from "next/server";
import { appOrigin } from "@/lib/auth/redirect";
import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Logout is a POST so that a third-party page cannot sign the user out with a simple link or image. */
export async function POST(request: NextRequest) {
  const origin = appOrigin(request);
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: { code: "FORBIDDEN_ORIGIN", message: "Cross-site logout is not allowed." } }, { status: 403 });
  }
  const response = NextResponse.redirect(new URL("/", origin), 303);
  clearSessionCookie(response);
  return response;
}
