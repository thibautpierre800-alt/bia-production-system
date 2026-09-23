# BIA Production System V5

Application web progressive de management visuel, de pilotage de la performance et d’amélioration continue du Groupe BIA.

## Référentiel

- Niveau Groupe : BIA Holding
- Sites : Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline et Sodeplax
- Profils : Direction Générale Groupe, Responsable Lean Groupe, Directeur de site, Chef d’équipe / Opérateur

## Parcours livrés

- Accueil Groupe et Accueil Site adaptés au rôle
- Pilotage Groupe sans moyenne trompeuse et Pilotage Site avec tendance, cible et source
- SQCDP Atelier S/Q/C/D/P et TOP 15 limité aux sujets réellement utiles
- Signal Terrain rapide avec cycle Nouveau → Pris en compte → Action en cours → Résolu → Vérifié → Clos
- Registre et statistiques Signal Terrain
- Gemba, audits et bonnes pratiques
- Audit Terrain BIA détaillé : 10 domaines, 50 critères, brouillon reprenable, preuve obligatoire et génération d’actions
- Plan d’actions unique avec origine, responsable, échéance et preuve d’efficacité avant clôture
- Transformation sans ressaisie d’un Signal en problème / A3
- Dossiers A3 en 11 étapes, 8D de D0 à D8, QRQC, 5 Pourquoi et Ishikawa : trames guidées, schémas visuels, progression, version et impression
- Portefeuille de chantiers SMED, VSM, DMAIC, Kaizen, PDCA, TPM et industrialisation
- Bibliothèque de 30 outils Lean et industriels avec « Mes démarches », prochaine étape, recherche, checklist et création d’action
- Benchmark contextualisé des six sites sans classement trompeur
- Dossiers A3, 8D et QRQC sélectionnables, plus documents opérationnels ouvrables et versionnés
- Espace Formation : catalogue structuré, programmes, matrice nominative de compétences, niveaux 0 à 5, preuves et fiches individuelles imprimables pour validation RH
- Supports pédagogiques détaillés, parcours VSL, formation Roadmap, cas pratiques et questions de validation
- Roadmap Groupe/Site par horizons 30/60/90 jours et 3-12 mois, avec résultat, KPI, propriétaire et arbitrage
- Fiche d’amélioration Avant/Après remplissable et imprimable
- Navigation et périmètres adaptés aux quatre profils
- Export/import JSON avec sauvegarde préalable

Les données affichées au premier lancement sont des exemples fictifs clairement marqués.

## SEQUOIA

SEQUOIA reste le système maître pour les données transactionnelles qui y existent. Aucune connexion n’est activée et aucune API n’est supposée. L’écran Paramètres expose le futur principe staging → validation → publication, avec secours manuel tracé.

## Lancer localement

Le service worker nécessite un serveur HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Vérification

```bash
node --check v5.js
node tests/regression.cjs
```

Le test contrôle le référentiel des six sites, les écrans, les droits, la persistance locale, le cycle du Signal Terrain, la traçabilité vers problème/document, les trames méthodologiques, la formation, le SQCDP et le cache PWA.

## Fichiers actifs

- `index.html` : coque de l’application
- `v5.css` : identité et responsive PC / tablette / mobile / écran atelier
- `lean-library.js` : bibliothèque métier de 30 outils, sans Plan des 100 premiers jours
- `v5.js` : modèle local et fonctionnalités V5
- `service-worker.js` : cache hors connexion des ressources statiques
- `manifest.json` : installation PWA

La V4 et la précédente V5 locale restent récupérables dans l’historique Git ; elles ne sont plus chargées par l’application.
