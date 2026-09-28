# Réception — BIA Lean Operating System 7.3.0

Date : 28 septembre 2026. Version précédente sauvegardée : 7.2.0, commit `c83b46e`, branche `backup/before-7.3.0-2026-09-28`.

## Changements réceptionnés

Le cœur transversal relie les modules conservés et nouveaux : identifiants, relations, base d’actions, mesures canoniques, résultats, preuves, commentaires et historique. La migration conserve les données compatibles et le JSON antérieur. Les écrans sont alimentés par les dossiers enregistrés ; les scénarios fictifs restent explicitement identifiés.

La version 7.3.0 réduit la charge de navigation : accueil adapté à chaque rôle, interface Essentielle/Complète, quatre entrées mobiles, création regroupée et écran Aujourd’hui compact. Le pilotage ne duplique plus Control Tower et SQCDP dans les profils de direction : une seule vue propose les modes Analyser et Décider. L’ancienne route SQCDP reste utilisable pour les liens existants et les profils atelier.

Les parcours existants restent disponibles en interface Complète : Hoshin/X-Matrix, routines/escalades, VSM graphique, Kaizen/gains, déploiement, maturité, audits, résolution, formations, guides et documents historiques. Aucun dossier ni permission métier n’est retiré.

## Vérifications exécutées

| Contrôle | Résultat et portée |
|---|---|
| Tests métier/DOM | 41 tests réussis : intégrité, formulaires, relecture, migration, scénarios, ergonomie par rôle, interface Essentielle/Complète, alertes, relève et non-régression |
| A — Gemba → action → SQCDP → escalade → clôture | Réussi ; une seule action et pas de double escalade |
| B — KPI → problème → A3 → action → résultat | Réussi ; douze rubriques et résultat conservé après rechargement |
| C — VSM → opportunité → projet/action → résultat | Réussi ; calculs numériques et liens persistants |
| D — Kaizen → avant/après → gain → pratique → transfert | Réussi ; preuves et validation du gain/déploiement |
| E — Hoshin → KPI → projet → action → résultat | Réussi ; navigation inverse et avancement distinct du résultat |
| F — audit → écart → action → résolution | Réussi ; preuve obligatoire et score vérifié |
| G — benchmark → site en difficulté → pratique ailleurs | Réussi ; suggestion fondée sur les données, sans causalité prétendue |
| Navigateur Chromium | 75 combinaisons des cinq profils et routes visibles, sans erreur JavaScript ni ressource manquante ; les anciennes routes masquées restent compatibles |
| Responsive | 14 vues contrôlées à 390, 820 et 1440 px, plus le SQCDP Groupe à 1080 × 1920 ; aucun débordement horizontal de la page |
| Saisie navigateur | Gemba créé par formulaire puis retrouvé après rechargement |
| VSM navigateur | Déplacement souris persistant, sélection tactile, édition et lecture seule |
| Navigation/cache | Sous-chemin réel de déploiement, ancre Hoshin directe et rechargement hors connexion |
| Build | 20 ressources statiques, environ 573 Kio avant compression, syntaxe et chemins contrôlés |
| Performance observée | Premier rendu local du scénario mesuré à 0,399 s dans l’environnement de test ; ce n’est pas une mesure de latence réseau en production |

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
- Centre d’alertes filtré par profil/périmètre, sans doublonner les dossiers métier.
- Relève d’équipe avec dossiers liés et confirmation distincte de la clôture des actions.
- Accès Terrain partageable et paquet d’échanges explicitement limités au fonctionnement local/export.
- Accueils, niveaux quotidiens et navigation mobile adaptés aux cinq rôles.
- Pilotage unifié Analyser/Décider, sans double entrée Control Tower/SQCDP pour les profils de direction.
- Création regroupée dans une commande compacte et formulaires progressifs avec préremplissage cohérent.

## Mise en service partagée : éléments non activés

Ces limites ne sont pas dissimulées derrière des boutons « connectés ». Elles sont également indiquées dans l’application.

| Blocage | Cause | Ce qui manque | Comment le terminer |
|---|---|---|---|
| Base partagée et authentification réelle | Hébergement GitHub Pages statique ; données actuelles locales | Environnement serveur/base/stockage autorisé, fournisseur d’identité et politique de droits validée | Implémenter et déployer la persistance serveur et l’authentification, appliquer les droits côté serveur, migrer un export et tester concurrence/restauration sur plusieurs comptes/appareils |
| Connexion SEQUOIA/ERP/MES/SQL | Aucun contrat technique ni accès éditeur fourni | Documentation/version, extraction autorisée, compte de lecture et échantillon métier | Implémenter l’adaptateur correspondant au contrat réel, qualifier les mappings et comparer les résultats à une source validée |
| Collecte et escalades application fermée | Aucun service serveur planifié configuré | Hébergement du traitement et mécanisme d’exploitation/surveillance | Déployer un ordonnanceur utilisant les mêmes règles, avec idempotence, supervision et journal ; le contrôle explicite actuel reste fonctionnel |
| Indicateurs et gains officiellement validés | Les responsables, sources et données de démonstration ne sont pas une validation métier | Définitions et propriétaires approuvés, conventions de calcul, données/preuves du terrain | Configurer le dictionnaire via Administration, importer/saisir les données réelles et faire valider les résultats par leurs responsables |

Le code livré est utilisable en fonctionnement local et démonstration intégrée. La collaboration sécurisée entre appareils et les flux industriels réels restent à mettre en service avec ces éléments externes. Les permissions locales ne doivent pas être présentées comme un contrôle d’accès de production.
