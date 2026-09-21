# MCP local Gitea de DailyTrack

Serveur MCP local TypeScript connecté à Gitea en lecture seule.

## Variables

Le processus MCP charge explicitement `.env.local` au démarrage avec `dotenv`, puis lit `GITEA_URL`, `GITEA_TOKEN` et `GITEA_TIMEOUT_SECONDS` via `process.env`. Ce chargement existe uniquement dans `mcp/gitea/server.ts` et n’est jamais importé par le navigateur ou l’interface Next.js. Le fichier `.env.example` documente les noms attendus, mais ne contient aucun secret. `.env.local` est ignoré par Git.

Pour un lancement manuel :

```bash
export GITEA_URL="https://gitea.example.com"
export GITEA_TOKEN="<secret local>"
export GITEA_TIMEOUT_SECONDS="10"
npm run mcp:gitea
```

Le token ne doit pas être écrit dans un fichier versionné. Il n’est jamais renvoyé dans les résultats, erreurs ou logs. Sans ces variables, les outils retournent une erreur de configuration sans effectuer de requête réseau.

## Installation et lancement

Depuis la racine :

```bash
npm install
npm run mcp:gitea
```

Le transport est `stdio`. stdout est réservé au protocole MCP ; les logs applicatifs ne doivent pas y être écrits.

## Connexion Codex

Le fichier `.mcp.json` du projet lance directement `tsx` et hérite de l’environnement du processus Codex. Configurer les trois variables dans l’environnement local avant de démarrer la session. Le lancement direct évite que la sortie de npm se mélange à stdout, réservé au protocole MCP.

## Outils disponibles

- `get_current_user` → `GET /api/v1/user` ;
- `list_repositories` → `GET /api/v1/user/repos` ;
- `list_issues` → `GET /api/v1/repos/{owner}/{repo}/issues` ;
- `list_pull_requests` → `GET /api/v1/repos/{owner}/{repo}/pulls` ;
- `list_reviews` → `GET /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews` ;
- `list_commits` → `GET /api/v1/repos/{owner}/{repo}/commits`.

Les outils de liste exigent `page` et `limit`, avec une limite maximale de 100. Aucune opération POST, PUT, PATCH ou DELETE n’est implémentée.

## État de validation réelle

Les six outils sont déclarés dans le serveur MCP. Leur accès à l’instance Gitea doit être validé dans un processus Codex auquel `GITEA_URL`, `GITEA_TOKEN` et `GITEA_TIMEOUT_SECONDS` sont effectivement transmis. Si ces variables sont absentes, le serveur retourne une erreur de configuration sans effectuer de requête.

La validation réelle doit être exécutée avec le `.env.local` présent dans ce projet. Les statuts obtenus et les limites observées sont documentés après chaque validation ; aucun token ni contenu sensible n’est enregistré.

## Tests et vérification

```bash
npm test -- mcp/gitea
npm run typecheck
```

Les tests utilisent des réponses HTTP simulées et ne contactent jamais Gitea.
