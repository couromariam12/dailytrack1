export type AuthErrorCode = "AUTH_CONFIGURATION" | "OAUTH_PROVIDER_ERROR" | "OAUTH_STATE_MISMATCH" | "OAUTH_INVALID_CALLBACK" | "SESSION_REQUIRED" | "SESSION_EXPIRED" | "SESSION_INVALID" | "DEV_AUTH_FORBIDDEN";

const messages: Record<AuthErrorCode, string> = {
  AUTH_CONFIGURATION: "Authentication is not configured.",
  OAUTH_PROVIDER_ERROR: "Gitea OAuth authentication failed.",
  OAUTH_STATE_MISMATCH: "OAuth state validation failed.",
  OAUTH_INVALID_CALLBACK: "The OAuth callback is invalid.",
  SESSION_REQUIRED: "Authentication is required.",
  SESSION_EXPIRED: "The session has expired.",
  SESSION_INVALID: "The session is invalid.",
  DEV_AUTH_FORBIDDEN: "Development authentication is disabled in production.",
};

export class AuthError extends Error {
  public constructor(public readonly code: AuthErrorCode, public readonly status = 401) { super(messages[code]); this.name = "AuthError"; }
}
