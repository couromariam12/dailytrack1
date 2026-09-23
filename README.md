# DailyTrack Next.js

Nouvelle application DailyTrack indépendante du projet Laravel historique.

## Socle initial

- Next.js avec App Router ;
- TypeScript en mode strict ;
- Tailwind CSS ;
- layouts séparant l’application et les espaces collaborateur/admin ;
- types TypeScript pour l’authentification, Gitea et l’activité ;
- aucune base de données et aucun miroir local des données Gitea ;
- aucune donnée fictive ;
- serveur MCP Gitea local en lecture seule ;
- aucune opération d’écriture vers Gitea.

## Démarrage

Prérequis : Node.js 22 ou supérieur.

```bash
npm install
cp .env.example .env.local   # ou .env
npm run dev
```

Puis ouvrir <http://localhost:3000>.

Vérification de production :

```bash
npm run build
npm start
```

## Configuration

Les variables sont listées dans `.env.example`.

- `GITEA_URL`, `GITEA_TOKEN` et les secrets OAuth sont strictement réservés au serveur.
- Ne jamais préfixer une variable sensible par `NEXT_PUBLIC_`.
- `.env.local` est ignoré par Git.
- le serveur MCP charge `.env.local` puis `.env` uniquement au démarrage du processus MCP ;
- `.env.local` n’est jamais chargé côté navigateur ;
- les endpoints Gitea et l’authentification applicative restent côté serveur.

## Validation réelle MCP Gitea

Validation effectuée le 17 septembre 2026 avec `.env.local`, sans afficher le token ni conserver de contenu Gitea :

| Outil | Statut | Résultat |
| --- | --- | --- |
| `get_current_user` | disponible | réponse valide |
| `list_repositories` | disponible | 16 repositories, page 1, aucune page suivante |
| `list_issues` | disponible | 24 issues, page 1, aucune page suivante |
| `list_pull_requests` | disponible | 7 pull requests, page 1, aucune page suivante |
| `list_reviews` | disponible | pull request accessible, 0 review retournée |
| `list_commits` | disponible | 1 commit retourné |

Tous les appels de cette validation étaient des requêtes `GET`. Aucune opération `POST`, `PUT`, `PATCH` ou `DELETE` n’a été effectuée.

## Pages

- `/` : accueil et connexion Gitea (affiche les erreurs d’authentification) ;
- `/collaborator` : « Mon daily », l’activité personnelle du dernier jour ouvré sur tous les repositories accessibles ;
- `/collaborator/repositories/{owner}/{repository}` : activité d’un repository, filtrable ;
- `/admin` : activité d’un repository par collaborateur (logins listés dans `DAILYTRACK_ADMIN_LOGINS`).

## Règles de calcul

- Les journées et périodes sont des intervalles UTC semi-ouverts (identiques à Africa/Dakar), dans le navigateur comme sur le serveur.
- L’activité est collectée côté serveur (`lib/activity/collect.ts`) en suivant toute la pagination Gitea, dans la limite de 20 pages de 50 éléments par liste ; au-delà, un avertissement « résultats tronqués » est affiché.
- Tickets et pull requests comptent à leur date de création, reviews à leur date de soumission, commits à leur date Gitea (branche par défaut uniquement).
- Une erreur Gitea sur un type d’activité ou un repository n’empêche pas l’affichage du reste : elle est signalée comme donnée partielle.

## Sessions

La session est un cookie HTTP-only chiffré (AES-256-GCM) avec une clé dérivée de `AUTH_SECRET` (32 caractères minimum). Aucune donnée n’est stockée côté serveur : les sessions survivent aux redémarrages et fonctionnent sur plusieurs instances. Une session dure au plus la durée de vie du token OAuth Gitea, et au maximum 8 heures ; à expiration, l’utilisateur repasse par la connexion Gitea. Changer `AUTH_SECRET` déconnecte tout le monde.
