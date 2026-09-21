export type GiteaErrorCode =
  | "GITEA_CONFIGURATION"
  | "GITEA_UNAUTHORIZED"
  | "GITEA_FORBIDDEN"
  | "GITEA_NOT_FOUND"
  | "GITEA_CONFLICT"
  | "GITEA_TIMEOUT"
  | "GITEA_INVALID_RESPONSE"
  | "GITEA_NETWORK";

const safeMessages: Record<GiteaErrorCode, string> = {
  GITEA_CONFIGURATION: "Gitea is not configured.",
  GITEA_UNAUTHORIZED: "Gitea authentication failed.",
  GITEA_FORBIDDEN: "Gitea access was denied.",
  GITEA_NOT_FOUND: "The requested Gitea resource was not found.",
  GITEA_CONFLICT: "Gitea reported a conflict.",
  GITEA_TIMEOUT: "Gitea request timed out.",
  GITEA_INVALID_RESPONSE: "Gitea returned an invalid response.",
  GITEA_NETWORK: "Gitea could not be reached.",
};

export class GiteaAdapterError extends Error {
  public constructor(public readonly code: GiteaErrorCode, public readonly status?: number) {
    super(safeMessages[code]);
    this.name = "GiteaAdapterError";
  }
}

export function fromGiteaStatus(status: number): GiteaAdapterError {
  const code: GiteaErrorCode = status === 401 ? "GITEA_UNAUTHORIZED" : status === 403 ? "GITEA_FORBIDDEN" : status === 404 ? "GITEA_NOT_FOUND" : status === 409 ? "GITEA_CONFLICT" : "GITEA_NETWORK";
  return new GiteaAdapterError(code, status);
}

export function errorResponse(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof GiteaAdapterError) return { error: { code: error.code, message: error.message } };
  return { error: { code: "GITEA_NETWORK", message: safeMessages.GITEA_NETWORK } };
}
