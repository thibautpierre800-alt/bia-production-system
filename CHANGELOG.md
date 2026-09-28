# Changelog

## 7.3.0 — 28 septembre 2026

- Accueil distinct pour les cinq profils : décisions Groupe, transformation multisite, pilotage site, journée d’équipe ou contribution opérateur.
- Interface Essentielle par défaut hors Responsable Lean, avec bascule persistante vers l’interface Complète sans suppression de droits ni de dossiers.
- Navigation mobile limitée à quatre entrées par rôle et pictogrammes SVG homogènes.
- Control Tower et SQCDP réunis dans Pilotage avec deux modes explicites : **Analyser** et **Décider** ; l’ancienne route SQCDP reste compatible.
- Écran **Aujourd’hui** limité à cinq priorités, dernières relèves visibles et sections escalades/routines/actions repliables ; niveaux N1–N4 limités selon le rôle.
- Deux raccourcis flottants remplacés par une commande « + » unique ouvrant Signal Terrain, Idée Kaizen, Action ou Relève selon les droits.
- Formulaires Signal Terrain et Idée Kaizen préremplis et progressifs ; informations avancées disponibles sans alourdir la première saisie.
- Vue analytique transformée en cartes sur téléphone et listes de Control Tower réduites en interface Essentielle.

La simplification ne change ni le modèle de données ni les limites de mise en service : stockage et profils restent locaux, sans authentification serveur, synchronisation entre appareils ou connexion SEQUOIA/ERP/MES active.

## 7.2.0 — 28 septembre 2026

- Centre d’alertes opérationnelles calculé à partir des signaux critiques, actions en retard, escalades, décisions attendues et relèves non reprises.
- Relève d’équipe structurée dans le management quotidien, avec situation, sécurité, qualité, effectif, priorités, dossiers liés et confirmation de reprise.
- Équipes de relève configurables dans Administration et exemple industriel cohérent intégré au scénario de démonstration.
- Lien profond partageable vers Signal Terrain, prépositionné sur le site et l’atelier actifs.
- File locale et paquet JSON d’échanges pour préparer une future synchronisation serveur sans prétendre qu’elle est déjà active.

La persistance, les lectures d’alertes et la file d’échanges restent locales. Aucune notification poussée, authentification serveur, synchronisation entre appareils ou connexion ERP réelle n’est activée.

## 7.1.1 — 27 septembre 2026

- Raccourcis Signal Terrain et Idée Kaizen réduits à deux commandes compactes, avec libellé accessible et infobulle.
- Profils simplifiés et séparés en cinq rôles : DG, Responsable Lean, Directeur de site, Chef d’équipe et Opérateur.
- Anciens profils locaux automatiquement rapprochés du nouveau rôle équivalent sans supprimer les données.
- Comptes fictifs de démonstration alignés sur ces cinq profils.

## 7.1.0 — 27 septembre 2026

- Scénario industriel fictif cohérent sur six sites, avec tendances, signaux, actions, A3, Kaizen, décisions et transferts reliés.
- Accueil renforcé et signature « D’artisan industriel à industriel artisan. ».
- Control Tower recentrée sur l’analyse ; SQCDP Groupe vertical dédié à la réaction et aux arbitrages.
- Signal Terrain et idée Kaizen accessibles en permanence sur les profils contributeurs.
- Formation complète à BIA Lean OS, matrice par profil, preuves de qualification et livret imprimable.
- Historique de maturité conservé, sélection de date et comparaison de deux campagnes sur le radar.
- Sauvegarde automatique de l’ancien scénario de démonstration avant son actualisation.

La persistance reste locale ; les profils ne constituent pas une authentification et aucun flux SEQUOIA, ERP ou MES n’est actif.

## 7.0.0 — 27 septembre 2026

Transformation progressive de BIA Production System 6.8.0 en BIA Lean Operating System.

- Migration schéma 7, sauvegarde antérieure, référentiels persistants, relations et intégrité.
- Actions et mesures centrales ; liens KPI/objectifs/projets, archivage, recherche et journal.
- Control Tower six sites, sources datées, tendances, écart normalisé et rapprochements de pratiques.
- Routines N1–N4 et escalades paramétrées, explicites et sans doublon.
- Hoshin, X-Matrix, contributions et lecture distincte avancement/résultat.
- VSM graphique actuel/futur : objets, flux, tactile, clavier, zoom, calculs et suites opérationnelles.
- Audits génériques, preuves, photos et actions ; maintien de l’audit historique.
- A3 à douze rubriques, PDCA, DMAIC et Pareto dans le module de résolution.
- Kaizen, avant/après simple, gains, standards et déploiements vérifiés.
- Maturité datée à dix piliers/cinq niveaux, heatmap et radar.
- Huit profils fonctionnels ; administration et dictionnaire KPI/seuils.
- CSV atomique, contrat d’entrée, mock et prérequis ERP documentés.
- Build statique, cache versionné, responsive et tests navigateur.
- Conservation des guides, formations, documents, Gemba et sauvegardes compatibles.

La persistance reste locale. Authentification serveur, synchronisation entre appareils et connexions ERP réelles ne sont pas activées dans cette livraison.
