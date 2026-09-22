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
- exports Admin CSV et PDF générés côté serveur, protégés par le rôle Admin.

## Démarrage

Prérequis : Node.js 22 ou supérieur.

```bash
npm install
cp .env.example .env.local
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
- le serveur MCP charge explicitement `.env.local` uniquement au démarrage du processus MCP ;
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

## Pages initiales

- `/` : accueil du socle ;
- `/collaborator` : espace collaborateur vide ;
- `/admin` : espace administrateur protégé avec filtres et exports CSV/PDF.

La documentation des exports Admin se trouve dans [`docs/admin-exports.md`](docs/admin-exports.md).

Le projet Laravel existant reste dans `/Users/courooo/Documents/dailytrack` et n’est pas modifié par cette application.
