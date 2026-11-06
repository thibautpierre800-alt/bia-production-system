# Étape 2 · Données partagées : le contrat proposé

Ce document s'adresse au service informatique. Il décrit ce que l'application attend d'un serveur pour que les sept sites travaillent sur les mêmes données, avec le compte de l'entreprise. Il ne fixe ni le langage, ni la base, ni l'hébergement : ces choix restent à faire ensemble. Il part de ce que l'application fait déjà :

- chaque fiche a un identifiant stable, un site, une date de mise à jour et un historique ;
- chaque modification produit un événement daté dans une file locale (`syncQueue`). Un paquet d'échange `bia-lean-os-sync-bundle/v1` s'exporte déjà depuis Administration › Connecteurs.

## Principes

1. **Le serveur fait foi, le terrain reste hors ligne.** L'application garde une copie locale pour fonctionner sans réseau dans les ateliers. Elle envoie ses modifications quand le réseau revient et reçoit celles des autres.
2. **Des fiches entières, pas des champs.** L'application envoie et reçoit des fiches complètes (JSON) : action, Gemba, problème, document… Le serveur range chaque fiche telle quelle, sans schéma à maintenir colonne par colonne.
3. **Les droits sont appliqués par le serveur.** Aujourd'hui, le profil choisi dans l'application filtre l'affichage, il ne protège rien. Avec le serveur, chaque compte reçoit un profil et un périmètre, et le serveur ne renvoie ni n'accepte rien en dehors.
4. **Rien n'est écrit dans SEQUOIA.** L'étape 3 lit SEQUOIA. Les mesures entrent par le contrat `connectors/measure.schema.json`.

## Connexion

Recommandation : **l'authentification est portée par le serveur.** L'utilisateur se connecte avec son compte de l'entreprise (par exemple Microsoft Entra ID en OpenID Connect) et le serveur pose un cookie de session `HttpOnly`, `Secure`, `SameSite=Lax`. L'application n'a aucun jeton à gérer : ses appels `fetch` vers `/api/…` sont sur la même adresse et emportent le cookie.

- `GET /api/me` → `{ "name", "email", "role", "site_id", "workshop_id" }`
- `role` vaut `dg`, `lean`, `director`, `teamlead` ou `operator`. Le périmètre est `site_id` (null pour le Groupe) et éventuellement `workshop_id`.
- L'attribution des profils se fait côté serveur, par exemple par des groupes de l'annuaire.

Profils et droits, déjà appliqués à l'écran :

| Profil | Périmètre | Lecture | Écriture |
|---|---|---|---|
| DG (`dg`) | Groupe | pilotage, roadmap, actions, bonnes pratiques | aucune |
| Responsable Lean (`lean`) | Groupe | tout | tout, y compris l'import et l'administration |
| Directeur de site (`director`) | son site | son site | son site |
| Chef d'équipe (`teamlead`) | son atelier | son atelier | signaux, actions, Gemba, SQCDP, audits, documents |
| Opérateur (`operator`) | son atelier | son atelier | signaux, avancement des actions |

Le plan de déploiement (`hoshinPlan`) vient d'un fichier interne. Seul le profil `lean` le modifie ; à confirmer : sa lecture par les directeurs de site, qui voient aujourd'hui la Roadmap.

## Fiches

```
GET  /api/records?since=<revision>
→ 200 { "revision": 1842,
        "records": [ { "collection": "actions", "id": "A-019", "site_id": "marzin",
                       "updated_at": "2026-11-06T18:31:00Z", "updated_by": "p.thibaut@…",
                       "deleted": false, "data": { …fiche complète… } } ] }
```

- `revision` : compteur du serveur. L'application le garde et ne redemande que ce qui a changé depuis.
- `since=0` : chargement complet du périmètre de l'utilisateur, soit quelques centaines de Ko par site.

```
POST /api/changes
{ "contract": "bia-lean-os-changes/v1", "device_revision": 1840,
  "changes": [ { "collection": "gembas", "id": "G-021", "base_updated_at": "2026-11-06T09:00:00Z",
                 "deleted": false, "data": { …fiche complète… } } ] }
→ 200 { "revision": 1843, "applied": ["G-021"],
        "conflicts": [ { "id": "A-019", "server": { …version du serveur… } } ] }
```

- Concurrence optimiste, fiche par fiche. Si `base_updated_at` ne correspond plus à la version du serveur, la fiche n'est pas écrite et la version du serveur revient dans `conflicts`. L'application montre alors les deux versions.
- Le serveur vérifie, pour chaque fiche : le droit d'écrire sur `site_id` et `workshop_id`, une taille raisonnable (moins de 1 Mo, photos à part), un identifiant au bon format.
- Les identifiants sont créés par l'application (`A-019`, `G-021`, `OBS-…`). Le serveur les garde tels quels et refuse un doublon venant d'un autre site.
- Collections : `actions`, `signals`, `gembas`, `problems`, `documents`, `audits`, `projects`, `objectives`, `kaizens`, `practices`, `deployments`, `gains`, `maturity`, `routines`, `handovers`, `escalations`, `decisions`, `topics`, `roadmap`, `toolRuns`, `measures`, `kpis`, `workshops`, `zones`, `users`, `links`, `comments`, `environmentLogs`, `trainingRecords`, `activity`, `redTags`, `smed`. S'y ajoutent les objets `hoshinPlan`, `etonnement` et `settings`, rangés comme une fiche unique par périmètre. Le détail des champs se trouve dans [DATA_MODEL.md](DATA_MODEL.md).

## Photos

Depuis la 8.8, les photos ne sont plus dans les fiches. Une fiche porte une référence `photo:PH-<horodatage>-<aléa>`, et la photo est rangée à part : JPEG d'au plus 1200 px de côté, en général 100 à 300 Ko.

```
PUT /api/photos/PH-1793990000000-k3x9a     (Content-Type: image/jpeg, ≤ 1 Mo)  → 201
GET /api/photos/PH-1793990000000-k3x9a     → 200 image/jpeg   (même droit de lecture que la fiche qui la cite)
```

L'application envoie la photo avant la fiche qui la cite. Sur le serveur, un stockage de fichiers ou une table binaire convient.

## Stockage proposé

Une forme simple, en PostgreSQL ou SQL Server :

```
records(collection, id, site_id, workshop_id, updated_at, updated_by, deleted, data JSON, revision)
  clé (collection, id) ; index (revision), (site_id)
photos(id, content_type, bytes, created_at, created_by)
revisions(revision, at, by, collection, id)   -- journal, déjà tenu par l'application dans activity
```

Volumes attendus, à confirmer :

- **Fiches :** quelques milliers par an pour le Groupe, moins de 100 Mo.
- **Photos :** par site, environ 50 Gemba par an × 10 notes × 1,5 photo × 200 Ko, soit environ 150 Mo par an. Pour les sept sites, environ 1 Go par an.

Sauvegarde quotidienne de la base et des photos, conservée 30 jours. Hébergement en France ou dans l'Union européenne.

## Reprise des données existantes

`POST /api/import`, réservé au profil `lean`, reçoit une sauvegarde exportée depuis Compte (JSON, avec un champ `photos` qui contient les images). Le serveur :

1. range les photos ;
2. ajoute les fiches inconnues ;
3. pour une fiche déjà connue, garde la plus récente (`updated_at`) et signale l'autre.

On importe d'abord l'appareil de Pierre, puis celui de chaque site.

## Ce qui change dans l'application

Rien n'est codé côté application tant que ces choix ne sont pas faits. Une fois le contrat retenu :

- un module de synchronisation remplacera l'export du paquet d'échange par les appels ci-dessus ;
- la base photos du navigateur enverra les photos ;
- l'écran Compte affichera la connexion et l'état de la synchronisation.

Le reste de l'application ne change pas : elle lit et écrit déjà ses fiches par le même chemin (`commitData`).
