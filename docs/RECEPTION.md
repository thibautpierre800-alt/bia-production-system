# Réception — BIA Lean Operating System 7.1.0

Date : 27 septembre 2026. Version précédente sauvegardée : 7.0.0, commit `0afb43f`, branche distante `backup/before-7.1.0-2026-09-27`.

## Changements réceptionnés

Le cœur transversal relie les modules conservés et nouveaux : identifiants, relations, base d’actions, mesures canoniques, résultats, preuves, commentaires et historique. La migration conserve les données compatibles et le JSON antérieur. Les écrans sont alimentés par les dossiers enregistrés ; les scénarios fictifs restent explicitement identifiés.

Les nouveaux parcours comprennent Control Tower, Hoshin/X-Matrix, routines/escalades, VSM graphique, Kaizen/gains, déploiement et maturité. Les audits deviennent paramétrables. A3, PDCA et DMAIC partagent le module de résolution. Les formations, guides et documents historiques restent disponibles.

## Vérifications exécutées

| Contrôle | Résultat et portée |
|---|---|
| Tests métier/DOM | 39 tests réussis : intégrité, formulaires, relecture, migration, scénario réaliste, formation logicielle, maturité historique et non-régression |
| A — Gemba → action → SQCDP → escalade → clôture | Réussi ; une seule action et pas de double escalade |
| B — KPI → problème → A3 → action → résultat | Réussi ; douze rubriques et résultat conservé après rechargement |
| C — VSM → opportunité → projet/action → résultat | Réussi ; calculs numériques et liens persistants |
| D — Kaizen → avant/après → gain → pratique → transfert | Réussi ; preuves et validation du gain/déploiement |
| E — Hoshin → KPI → projet → action → résultat | Réussi ; navigation inverse et avancement distinct du résultat |
| F — audit → écart → action → résolution | Réussi ; preuve obligatoire et score vérifié |
| G — benchmark → site en difficulté → pratique ailleurs | Réussi ; suggestion fondée sur les données, sans causalité prétendue |
| Navigateur Chromium | 155 combinaisons de huit profils et routes, sans erreur JavaScript ni ressource manquante |
| Responsive | 14 vues contrôlées à 390, 820 et 1440 px, plus le SQCDP Groupe à 1080 × 1920 ; aucun débordement horizontal de la page |
| Saisie navigateur | Gemba créé par formulaire puis retrouvé après rechargement |
| VSM navigateur | Déplacement souris persistant, sélection tactile, édition et lecture seule |
| Navigation/cache | Sous-chemin réel de déploiement, ancre Hoshin directe et rechargement hors connexion |
| Build | 20 ressources statiques, 529 Kio avant compression, syntaxe et chemins contrôlés |
| Performance observée | Premier rendu local du scénario inférieur à 0,4 s dans l’environnement de test ; ce n’est pas une mesure de latence réseau en production |

Les scénarios A–G sont des tests d’intégration DOM avec sauvegarde et relecture. Le contrôle Chromium complète ces tests sur les interactions et le rendu. Il ne constitue pas une certification sur tous les navigateurs ou un test de charge multisession. Le script `tests/browser.cjs` reproduit les contrôles et génère les captures.

## Corrections issues de la réception

- Comptes des nouveaux profils et création d’action depuis les anciens graphiques KPI.
- Absence de mélange entre relevés de site et relevés d’atelier ; filtres cohérents.
- Seuils réellement paramétrables, dates réelles et contrôle des doublons CSV.
- Lecture seule VSM, géométries importées contrôlées, ergonomie mobile et zoom.
- Conservation des valeurs scalaires avant/après dans le journal ; pas de duplication des photos.
- Clôture des projets tenant compte de leurs actions liées.
- Escalades N+1 avec délai depuis l’escalade précédente, sans saut de niveaux.
- Cache des ressources cohérent par version et noms PWA actualisés.

## Mise en service partagée : éléments non activés

Ces limites ne sont pas dissimulées derrière des boutons « connectés ». Elles sont également indiquées dans l’application.

| Blocage | Cause | Ce qui manque | Comment le terminer |
|---|---|---|---|
| Base partagée et authentification réelle | Hébergement GitHub Pages statique ; données actuelles locales | Environnement serveur/base/stockage autorisé, fournisseur d’identité et politique de droits validée | Implémenter et déployer la persistance serveur et l’authentification, appliquer les droits côté serveur, migrer un export et tester concurrence/restauration sur plusieurs comptes/appareils |
| Connexion SEQUOIA/ERP/MES/SQL | Aucun contrat technique ni accès éditeur fourni | Documentation/version, extraction autorisée, compte de lecture et échantillon métier | Implémenter l’adaptateur correspondant au contrat réel, qualifier les mappings et comparer les résultats à une source validée |
| Collecte et escalades application fermée | Aucun service serveur planifié configuré | Hébergement du traitement et mécanisme d’exploitation/surveillance | Déployer un ordonnanceur utilisant les mêmes règles, avec idempotence, supervision et journal ; le contrôle explicite actuel reste fonctionnel |
| Indicateurs et gains officiellement validés | Les responsables, sources et données de démonstration ne sont pas une validation métier | Définitions et propriétaires approuvés, conventions de calcul, données/preuves du terrain | Configurer le dictionnaire via Administration, importer/saisir les données réelles et faire valider les résultats par leurs responsables |

Le code livré est utilisable en fonctionnement local et démonstration intégrée. La collaboration sécurisée entre appareils et les flux industriels réels restent à mettre en service avec ces éléments externes. Les permissions locales ne doivent pas être présentées comme un contrôle d’accès de production.
