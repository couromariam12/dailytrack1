import { GiteaAdapterError, errorResponse } from "../../lib/gitea/errors";

export function publicError(error: unknown): { code: string; message: string; status?: number } {
  const { error: safe } = errorResponse(error);
  return { ...safe, ...(error instanceof GiteaAdapterError && error.status !== undefined ? { status: error.status } : {}) };
}
