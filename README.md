# BIA Operating System V5

Application web progressive (PWA) de pilotage de l'excellence opérationnelle pour sept sites.

## Modules

- Cockpit quotidien et Control Tower Groupe
- Saisie et historique des KPI (TRS, rebuts, OTIF, maturité)
- Plan d'actions en Kanban avec priorités et échéances
- Gemba relié automatiquement aux actions
- Audit Excellence sur 10 domaines avec génération d'actions
- Portefeuille de chantiers A3, PDCA, DMAIC, SMED, VSM et Kaizen
- Partage et déploiement des bonnes pratiques
- Bibliothèque métier de 30 modules
- Sauvegarde locale et import/export JSON
- Installation Android/ordinateur et fonctionnement hors connexion

## Lancer localement

Le service worker nécessite un serveur HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## État de la connexion multisite

Cette livraison fonctionne sur l'appareil. La synchronisation Supabase est
désactivée : aucune base distante ni politique en production n'a été validée.
Le code de connexion est un chantier d'intégration, pas une fonction livrée.
Le schéma SQL décrit une base neuve et ne doit pas être exécuté tel quel sur
la base V4 : inventorier les colonnes et anciennes politiques, puis préparer
et tester une migration avec les trois rôles et deux sites distincts.

Points restant à traiter avant activation : isolation des caches par compte,
file de synchronisation hors ligne, conflits, mises à jour de tous les modules,
tests RLS sur la base réelle et provisionnement des utilisateurs par un administrateur.
Ne pas activer le drapeau v5Validated avant ces validations.

## Préparation Supabase (non activée)

1. Tester `supabase/schema.sql` sur une base neuve isolée.
2. Conserver uniquement la clé publique `anon` dans `config.js`.
3. Activer l'authentification par e-mail dans Supabase.
4. Les profils et sites sont attribués par un administrateur ; l'auto-attribution de droits est interdite.

La clé publique ne permet pas d'administrer la base. Les politiques RLS doivent être contrôlées sur le serveur.

## Validation locale

`node tests/regression.cjs` : rendu des dix écrans et trente outils, stockage,
liens Gemba/actions, séparation des sites, validation d'import, statuts et absence de mesures.
Ces contrôles ne remplacent pas les tests dans un navigateur.
Le nouvel audit synthétique note dix domaines sur 50 avec preuve obligatoire.

## Publication GitHub Pages

La branche `main` peut être publiée directement depuis la racine du dépôt. Après une mise à jour, modifier la constante de cache dans `service-worker.js` pour forcer le renouvellement immédiat des ressources installées.
