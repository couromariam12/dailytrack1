# Authentification DailyTrack avec Gitea OAuth2 + PKCE

DailyTrack utilise les endpoints OAuth2 standards de Gitea :

- autorisation : `https://<gitea>/login/oauth/authorize` ;
- échange du code : `https://<gitea>/login/oauth/access_token` ;
- utilisateur courant : `GET /api/v1/user`.

La callback doit être enregistrée exactement comme la valeur de `GITEA_OAUTH_REDIRECT_URI`, par exemple :

```text
http://127.0.0.1:3000/api/auth/gitea/callback
```

## Configuration locale

Copier `.env.example` vers `.env.local` et renseigner les valeurs OAuth fournies par Gitea :

```env
GITEA_URL=https://gitea.example
GITEA_OAUTH_CLIENT_ID=
# Optional for a public PKCE client.
GITEA_OAUTH_CLIENT_SECRET=
GITEA_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/api/auth/gitea/callback
GITEA_OAUTH_SCOPES=read:user,read:repository
AUTH_SECRET=
```

`AUTH_SECRET`, le client secret et les tokens ne doivent jamais être préfixés par `NEXT_PUBLIC_` ni versionnés. `.env.local` est ignoré par Git.

## Flux et sécurité

- `/api/auth/gitea/login` génère `state`, un verifier PKCE et un challenge S256.
- `/api/auth/gitea/callback` valide `state`, échange le code et crée une session serveur.
- Pour une application OAuth publique, l’échange PKCE n’envoie pas `client_secret` lorsque la variable est vide.
- `/api/auth/gitea/logout` supprime la session et le cookie.
- Le cookie de session est HTTP-only, `SameSite=Lax`, `Secure` en production.
- Le token OAuth est conservé uniquement dans la mémoire serveur du processus ; aucune base de données n’est utilisée.
- Les Route Handlers Gitea et l’espace dashboard exigent une session valide.

La session mémoire convient au développement local. Une exécution multi-instance nécessitera ultérieurement un stockage serveur partagé, sans exposer le token au navigateur.

## Mode d’authentification local de développement

Pour mettre OAuth2 en pause uniquement en développement local, le mode suivant peut être activé :

```env
DAILYTRACK_DEV_AUTH=true
DAILYTRACK_DEV_ROLE=collaborator
GITEA_TOKEN=<token local uniquement>
```

Dans ce mode, les pages protégées utilisent le token `GITEA_TOKEN` uniquement côté serveur pour appeler `GET /api/v1/user`. Le navigateur ne reçoit jamais ce token. `DAILYTRACK_DEV_ROLE` accepte `collaborator` ou `admin` et contrôle l’accès à `/admin`.

Attention : `DAILYTRACK_DEV_AUTH=true` est refusé automatiquement lorsque `NODE_ENV=production`. Ce mode ne doit jamais être utilisé dans un build, un déploiement ou un environnement de production. Il ne remplace pas et ne supprime pas le flux OAuth2 PKCE.

## Dernière vérification locale

La configuration locale contient maintenant la callback exacte `http://127.0.0.1:3000/api/auth/gitea/callback`. Le consentement Gitea en client public PKCE a été accepté, mais l’instance renvoie encore le navigateur vers l’origine `https://gitea.dev.agilicis.com` avec le chemin `/api/auth/gitea/callback`, qui répond 404, au lieu de l’origine locale `http://127.0.0.1:3000`. Les logs Next.js ne montrent aucun appel entrant à la callback et aucune session DailyTrack n’est créée. Aucun code OAuth ni token n’est conservé dans la documentation.
