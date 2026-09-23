import { NextResponse, type NextRequest } from "next/server";
import { AuthError, type AuthErrorCode } from "./errors";

/** Public origin of the application, taken from the registered OAuth callback when available. */
export function appOrigin(request: NextRequest): string {
  const redirectUri = process.env.GITEA_OAUTH_REDIRECT_URI;
  try {
    if (redirectUri) return new URL(redirectUri).origin;
  } catch {
    // Fall back to the request origin below.
  }
  return new URL(request.url).origin;
}

/** Sends the browser back to the home page with a displayable error code instead of raw JSON. */
export function authErrorRedirect(request: NextRequest, error: unknown): NextResponse {
  const code: AuthErrorCode = error instanceof AuthError ? error.code : "OAUTH_PROVIDER_ERROR";
  const url = new URL("/", appOrigin(request));
  url.searchParams.set("auth_error", code);
  return NextResponse.redirect(url, 303);
}
