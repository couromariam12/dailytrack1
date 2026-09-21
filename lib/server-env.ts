export function getServerEnv() {
  return {
    giteaUrl: process.env.GITEA_URL ?? "",
    giteaToken: process.env.GITEA_TOKEN ?? "",
    giteaTimeoutSeconds: Number(process.env.GITEA_TIMEOUT_SECONDS ?? "10"),
    giteaOauthClientId: process.env.GITEA_OAUTH_CLIENT_ID ?? "",
    giteaOauthClientSecret: process.env.GITEA_OAUTH_CLIENT_SECRET ?? "",
    giteaRedirectUri: process.env.GITEA_OAUTH_REDIRECT_URI ?? "",
    giteaOauthScopes: process.env.GITEA_OAUTH_SCOPES ?? "read:user,read:repository",
    authSecret: process.env.AUTH_SECRET ?? "",
  } as const;
}
