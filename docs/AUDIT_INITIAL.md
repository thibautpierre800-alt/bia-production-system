# Audit initial — 27 septembre 2026

Source vérifiée : `thibautpierre800-alt/bia-production-system`, branche `main`, commit `7a719ed0c3f7138ab02ef7a03d20e98bcf3ba3fc` du 24 septembre. Version déclarée et ressources : **6.8.0**. Deux branches distantes avant intervention : main et backup/v4-before-v5. GitHub Pages : exécution 35992445058 réussie sur ce commit. Aucun workflow de validation versionné.

Point de retour distant créé : `backup/before-lean-os-2026-09-27`. Branche de travail isolée : `feature/bia-lean-os`. Les anciennes copies locales, dont une copie avec modifications non commitées, ne sont pas utilisées comme source et restent intactes.

## Architecture constatée

Application statique JavaScript classique, HTML et CSS, sans framework ni compilation. Huit scripts chargés dans un ordre explicite. Les fonctions partagent `data` et `state`. Dépendance de développement : jsdom 30.1.1 ; Node 24.19.0 utilisé. PWA avec service worker, ressources relatives et navigation par fragment. Le fichier SQL Supabase est une archive explicitement inactive, sans serveur connecté.

Persistance : JSON dans localStorage, clé biaProductionSystemV5, schéma 6. Gestion du quota et du conflit entre onglets présente. Export/import complet avec sauvegarde précédente. Photographies JPEG compressées en data URL. Profils locaux sans authentification. Six sites opérationnels et BIA Holding ; aucun septième site industriel identifié dans le référentiel.

## Cartographie et décisions

| Existant | Décision |
|---|---|
| Signal terrain, visite Gemba multiconstats, preuve et retour terrain | Conserver, relier aux KPI, Kaizen, audits et capitalisation |
| Base unique d’actions, origine et vérification à la clôture | Conserver, compléter liens, progression, contributeurs, archivage et historique |
| A3 à 11 rubriques, 8D, QRQC, 5 Pourquoi et Ishikawa | Conserver, ajouter enseignements A3, PDCA, DMAIC et Pareto |
| Audit 50 critères avec preuves et brouillons | Conserver, compléter moteur générique et questionnaires paramétrables |
| VSM actuel/futur linéaire, CT/attente/WIP | Améliorer en éditeur graphique avec objets, flux et calculs explicites |
| Benchmark et matrice SQCDP Groupe | Conserver, ajouter Control Tower, maturité et rapprochement de pratiques |
| Relevés dupliqués dans mesures et tendances quotidiennes | Refactoriser vers mesures canoniques ; historique hérité préservé |
| Seuils/sens et sites dans le code | Migrer vers dictionnaire et administration persistants |
| Décisions SQCDP manuelles | Compléter routines N1–N4 et escalade paramétrable |
| Roadmap et projets | Relier à la hiérarchie Hoshin et aux résultats |
| Bonnes pratiques | Ajouter validation, gains, standard et matrice de déploiement |
| Formation, 30 guides et documents métier | Conserver |
| Données de démonstration identifiées | Préserver les données déjà enregistrées ; proposer un scénario intégré séparé |
| Recherche et historique partiels | Étendre aux entités et liens transversaux |

Absences constatées : objectifs structurés/Hoshin, Kaizen intégré, registre des gains, matrice de déploiement, maturité historisée, administration réelle du référentiel, connecteurs validés et journal transverse.

## Vérification avant modification

`npm ci --ignore-scripts` puis `npm test` : **21 tests réussis, zéro échec**. Les tests couvrent le DOM et des parcours locaux ; ils ne prouvent pas le responsive ni le fonctionnement dans un navigateur réel. Ces vérifications supplémentaires font partie de la réception finale.

Risques concrets à traiter : duplication des relevés, identifiants/relations peu contrôlés, mélange de versions du cache, plafonnement localStorage avec photos, périmètres et rôles uniquement locaux, absence de sauvegarde distante collaborative. Le passage à un service partagé demande un hébergement et une authentification effectifs ; aucune connexion ERP ne peut être déclarée active sans contrat fourni.
