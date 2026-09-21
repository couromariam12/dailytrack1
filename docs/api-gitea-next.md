# Adaptateur Gitea serveur Next.js

Cette couche permet à l’application Next.js de lire Gitea directement côté serveur. Elle est indépendante du serveur MCP et ne persiste aucune donnée Gitea.

## Sécurité et transport

- `GITEA_URL`, `GITEA_TOKEN` et `GITEA_TIMEOUT_SECONDS` sont lus depuis `process.env` dans `lib/gitea/client.ts`.
- Les Route Handlers Next.js sont des modules serveur ; aucun composant React ne contacte Gitea.
- Le token est uniquement envoyé dans l’en-tête `Authorization` côté serveur.
- Les erreurs retournées au client sont génériques et ne contiennent pas le token ni la réponse brute Gitea.
- Le client ne construit que des requêtes `GET`.
- Les limites de page sont comprises entre 1 et 100.

## Routes

Toutes les routes retournent des DTO DailyTrack normalisés. Les listes utilisent `page` et `limit` obligatoires.

### Utilisateur courant

```http
GET /api/me
```

Correspond à `GET /api/v1/user`.

### Repositories

```http
GET /api/repositories?page=1&limit=20
```

Correspond à `GET /api/v1/user/repos`.

### Issues

```http
GET /api/issues?owner=acme&repository=app&page=1&limit=20&state=all&type=issues
```

Filtres pris en charge : `state`, `type`, `since`, `before`, `created_by`, `assigned_by`.

### Pull requests

```http
GET /api/pull-requests?owner=acme&repository=app&page=1&limit=20&state=all
```

Filtres pris en charge : `state`, `sort`, `base_branch`, `milestone`, `labels`, `poster`, `since`, `until`.

### Reviews

```http
GET /api/reviews?owner=acme&repository=app&index=12&page=1&limit=20
```

Correspond à `GET /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews`.

### Commits

```http
GET /api/commits?owner=acme&repository=app&page=1&limit=20
```

Filtres pris en charge : `sha`, `path`, `since`, `until`, `verification`.

## Erreurs HTTP

| Situation | HTTP | Code |
| --- | ---: | --- |
| Paramètres invalides | 400 | `INVALID_PARAMETERS` |
| Token invalide | 401 | `GITEA_UNAUTHORIZED` |
| Accès refusé | 403 | `GITEA_FORBIDDEN` |
| Ressource absente | 404 | `GITEA_NOT_FOUND` |
| Conflit Gitea | 409 | `GITEA_CONFLICT` |
| Timeout | 504 | `GITEA_TIMEOUT` |
| Réponse invalide ou erreur réseau | 502 | `GITEA_INVALID_RESPONSE` ou `GITEA_NETWORK` |

## Tests

Les tests utilisent un `fetch` simulé. Aucun test n’appelle l’instance Gitea réelle.

## Smoke test local avec Gitea réel

Effectué le 17 septembre 2026 via le serveur Next.js local, avec des requêtes `GET` uniquement. Les données proviennent de l’instance Gitea configurée dans l’environnement local ; aucune donnée n’a été créée ou modifiée.

| Route | Statut | Résultat |
| --- | ---: | --- |
| `/api/me` | 200 | utilisateur courant accessible ; DTO utilisateur valide |
| `/api/repositories?page=1&limit=100` | 200 | 16 repositories ; `has_more: false` |
| `/api/issues?owner=MyKreno&repository=Backend&page=1&limit=100` | 200 | 24 issues ; `has_more: false` |
| `/api/pull-requests?owner=MyKreno&repository=Backend&page=1&limit=100` | 200 | 7 pull requests ; `has_more: false` |
| `/api/reviews?...&index=7` | 200 | pull request réelle ; 0 review ; `has_more: false` |
| `/api/commits?owner=MyKreno&repository=Backend&page=1&limit=100` | 200 | 1 commit ; `has_more: false` |

Toutes les réponses étaient JSON et conformes à la structure attendue (`items` et `pagination` pour les collections). Deux timeouts transitoires (`504`, `GITEA_TIMEOUT`) ont aussi été observés puis résolus lors de la nouvelle tentative ; le comportement d’erreur est donc confirmé.

Le token n’apparaît ni dans les réponses, ni dans les logs du serveur, ni dans les fichiers de documentation. Le smoke test a effectué zéro opération d’écriture.
