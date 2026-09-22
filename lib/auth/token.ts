import { GiteaAdapterError } from "@/lib/gitea/errors";
import { GiteaServerClient } from "@/lib/gitea/client";
import { currentUser } from "@/lib/gitea/routes";
import { getServerEnv } from "@/lib/server-env";
import { AuthError } from "./errors";
import type { GiteaUserDto } from "@/lib/gitea/types";

export async function authenticatePersonalToken(token: string): Promise<GiteaUserDto> {
  const value = token.trim();
  if (!value) throw new AuthError("TOKEN_REQUIRED", 400);
  if (value.length > 4096) throw new AuthError("TOKEN_INVALID", 401);
  const env = getServerEnv();
  if (!env.giteaUrl) throw new AuthError("AUTH_CONFIGURATION", 503);
  try {
    const user = await currentUser(new GiteaServerClient(env.giteaUrl, value, env.giteaTimeoutSeconds * 1000));
    if (!user) throw new AuthError("TOKEN_INVALID", 401);
    return user;
  } catch (error) {
    if (error instanceof GiteaAdapterError && error.code === "GITEA_UNAUTHORIZED") throw new AuthError("TOKEN_INVALID", 401);
    if (error instanceof GiteaAdapterError && error.code === "GITEA_TIMEOUT") throw new AuthError("TOKEN_PROVIDER_ERROR", 504);
    throw new AuthError("TOKEN_PROVIDER_ERROR", 502);
  }
}
