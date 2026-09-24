/** Minimum length of AUTH_SECRET, which derives the session encryption key. */
export const AUTH_SECRET_MIN_LENGTH = 32;

export function getServerEnv() {
  return {
    giteaUrl: process.env.GITEA_URL ?? "",
    giteaToken: process.env.GITEA_TOKEN ?? "",
    giteaTimeoutSeconds: Number(process.env.GITEA_TIMEOUT_SECONDS ?? "10"),
    giteaOauthClientId: process.env.GITEA_OAUTH_CLIENT_ID ?? "",
    giteaOauthClientSecret: process.env.GITEA_OAUTH_CLIENT_SECRET ?? "",
    giteaRedirectUri: process.env.GITEA_OAUTH_REDIRECT_URI ?? "",
    giteaOauthScopes: process.env.GITEA_OAUTH_SCOPES ?? "read:user,read:repository,read:issue",
    authSecret: process.env.AUTH_SECRET ?? "",
  } as const;
}
