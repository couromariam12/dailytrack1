# Exports Admin

Les exports sont accessibles uniquement depuis l’espace Admin et sont générés côté serveur à partir des données Gitea normalisées.

## Formats

- CSV : KPI, repositories accessibles, collaborateurs identifiés et activités détaillées ;
- PDF : rapport Admin lisible avec les mêmes filtres et les mêmes KPI.

## Routes

Les deux routes sont en lecture seule :

- `/api/admin/export/csv`
- `/api/admin/export/pdf`

Paramètres obligatoires : `owner` et `repository`.

Paramètres optionnels :

- `type` : `all`, `issues`, `pulls`, `commits` ou `reviews` ;
- `collaborator` ;
- `since` et `until`, qui forment un intervalle semi-ouvert `[since, until)`.

Chaque route vérifie le rôle Admin côté serveur. Un Collaborateur reçoit `403 Forbidden`. Les tokens Gitea restent dans le processus serveur et ne figurent ni dans les fichiers ni dans les réponses d’export.

Un export vide produit un fichier valide avec les KPI à zéro et les éventuelles capacités Gitea indisponibles signalées. Les erreurs 403, 404 et 409 ne sont pas converties silencieusement en activité nulle.
