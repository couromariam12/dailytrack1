export type GiteaErrorCode = "GITEA_CONFIGURATION" | "GITEA_UNAUTHORIZED" | "GITEA_FORBIDDEN" | "GITEA_NOT_FOUND" | "GITEA_CONFLICT" | "GITEA_TIMEOUT" | "GITEA_INVALID_RESPONSE" | "GITEA_NETWORK";

const messages: Record<GiteaErrorCode, string> = {
  GITEA_CONFIGURATION: "Gitea is not configured.",
  GITEA_UNAUTHORIZED: "Gitea authentication failed.",
  GITEA_FORBIDDEN: "Gitea access was denied.",
  GITEA_NOT_FOUND: "The requested Gitea resource was not found.",
  GITEA_CONFLICT: "Gitea reported a conflict.",
  GITEA_TIMEOUT: "Gitea request timed out.",
  GITEA_INVALID_RESPONSE: "Gitea returned an invalid response.",
  GITEA_NETWORK: "Gitea could not be reached.",
};

export class GiteaMcpError extends Error {
  public constructor(public readonly code: GiteaErrorCode, public readonly status?: number) {
    super(messages[code]);
    this.name = "GiteaMcpError";
  }
}

export function errorForStatus(status: number): GiteaMcpError {
  const code: GiteaErrorCode = status === 401 ? "GITEA_UNAUTHORIZED" : status === 403 ? "GITEA_FORBIDDEN" : status === 404 ? "GITEA_NOT_FOUND" : status === 409 ? "GITEA_CONFLICT" : "GITEA_NETWORK";
  return new GiteaMcpError(code, status);
}

export function publicError(error: unknown): { code: string; message: string; status?: number } {
  if (error instanceof GiteaMcpError) return { code: error.code, message: error.message, ...(error.status === undefined ? {} : { status: error.status }) };
  return { code: "GITEA_NETWORK", message: messages.GITEA_NETWORK };
}
