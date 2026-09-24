# Authentification DailyTrack avec Gitea OAuth2 + PKCE

DailyTrack utilise les endpoints OAuth2 standards de Gitea :

- autorisation : `https://<gitea>/login/oauth/authorize` ;
- échange du code : `https://<gitea>/login/oauth/access_token` ;
- utilisateur courant : `GET /api/v1/user`.

La callback doit être enregistrée exactement comme la valeur de `GITEA_OAUTH_REDIRECT_URI`, par exemple :

```text
http://127.0.0.1:3001/api/auth/gitea/callback
```

## Configuration locale

Copier `.env.example` vers `.env.local` et renseigner les valeurs OAuth fournies par Gitea :

```env
GITEA_URL=https://gitea.example
GITEA_OAUTH_CLIENT_ID=
# Optional for a public PKCE client.
GITEA_OAUTH_CLIENT_SECRET=
GITEA_OAUTH_REDIRECT_URI=http://127.0.0.1:3001/api/auth/gitea/callback
GITEA_OAUTH_SCOPES=read:user,read:repository,read:issue
AUTH_SECRET=
```

`AUTH_SECRET`, le client secret et les tokens ne doivent jamais être préfixés par `NEXT_PUBLIC_` ni versionnés. `.env.local` est ignoré par Git.

## Flux et sécurité

- `/api/auth/gitea/login` génère `state`, un verifier PKCE et un challenge S256.
- `/api/auth/gitea/callback` valide `state`, échange le code et pose le cookie de session chiffré.
- Pour une application OAuth publique, l’échange PKCE n’envoie pas `client_secret` lorsque la variable est vide.
- `POST /api/auth/gitea/logout` supprime le cookie ; une requête venant d’une autre origine est refusée (403).
- En cas d’échec (configuration, refus Gitea, `state` invalide), le navigateur est renvoyé vers `/?auth_error=<CODE>` avec un message lisible.
- Le cookie de session est HTTP-only, `SameSite=Lax`, `Secure` en production, chiffré en AES-256-GCM avec une clé dérivée de `AUTH_SECRET` (32 caractères minimum).
- Aucune donnée de session n’est stockée côté serveur : les sessions survivent aux redémarrages et fonctionnent en multi-instance.
- La session expire avec le token OAuth Gitea (8 heures au plus). Les routes API répondent alors `401 SESSION_EXPIRED` et l’interface relance la connexion Gitea.
- Les Route Handlers Gitea et l’espace dashboard exigent une session valide ; le client Gitea n’a aucun repli sur `GITEA_TOKEN`.

## Mode d’authentification local de développement

Pour mettre OAuth2 en pause uniquement en développement local, le mode suivant peut être activé :

```env
DAILYTRACK_DEV_AUTH=true
DAILYTRACK_DEV_ROLE=collaborator
GITEA_TOKEN=<token local uniquement>
```

Dans ce mode, les pages protégées utilisent le token `GITEA_TOKEN` uniquement côté serveur pour appeler `GET /api/v1/user`. Le navigateur ne reçoit jamais ce token. `DAILYTRACK_DEV_ROLE` accepte `collaborator` ou `admin` et contrôle l’accès à `/admin`.

Attention : `DAILYTRACK_DEV_AUTH=true` est refusé automatiquement lorsque `NODE_ENV=production`. Ce mode ne doit jamais être utilisé dans un build, un déploiement ou un environnement de production. Il ne remplace pas et ne supprime pas le flux OAuth2 PKCE.

## Port local : ne pas utiliser 3000

Gitea écoute par défaut sur `127.0.0.1:3000` derrière son reverse proxy. Le proxy réécrit tout en-tête `Location: http://127.0.0.1:3000/…` vers `https://gitea.dev.agilicis.com/…` : si DailyTrack utilise aussi `127.0.0.1:3000`, le retour OAuth part vers `https://gitea.dev.agilicis.com/api/auth/gitea/callback` (404). DailyTrack tourne donc sur `127.0.0.1:3001` (`npm run dev`), et c’est cette callback qui doit être enregistrée dans l’application OAuth Gitea.
