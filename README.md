# BIA Lean Operating System 7.1.0

Application de pilotage Lean pour BIA Holding et ses six sites : Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline et Sodeplax. Cette version prolonge la version 7.0.0 issue de la transformation de la 6.8.0 ; elle conserve les outils, documents, formations et données compatibles.

## Le parcours métier

Observer → qualifier → analyser → décider → agir → mesurer → vérifier → standardiser → déployer → capitaliser.

Les fiches utilisent une base d’actions et un registre de mesures uniques. Le panneau **Ce dossier dans le système** permet de retrouver les sources, créer une suite, relier un dossier et parcourir les relations dans les deux sens.

| Espace | Fonctions utilisables |
|---|---|
| Pilotage | Control Tower analytique, SQCDP Groupe vertical, tendances, benchmark, rapprochement de pratiques, sources et écart normalisé |
| Quotidien | Routines N1–N4, décisions, escalades sans doublon, responsables et échéances |
| Terrain | Signaux, Gemba multiconstats, photos, audits génériques, 5S et audit historique de 50 critères |
| Résolution | QRQC, A3 complet, PDCA, 8D, DMAIC, 5 Pourquoi, Ishikawa et Pareto |
| Amélioration | Actions centrales, Kaizen, avant/après, gains vérifiés, standards et bonnes pratiques |
| Stratégie | Objectifs hiérarchiques, X-Matrix, contributions, KPI, projets, actions et résultats |
| Flux | VSM graphique actuel/futur, déplacement souris/tactile/clavier, zoom, objets, flux et calculs |
| Capitalisation | Matrice pratique × sites, essais locaux, preuves et validation du déploiement |
| Maturité | Dix piliers, cinq niveaux, historique daté, comparaison de campagnes, preuves et radar superposé |
| Administration | Organisation, utilisateurs déclarés, KPI/seuils, catégories, questionnaires, règles et journal |
| Ressources | Trente guides, formation complète à BIA Lean OS, matrice par profil, suivi individuel et livret imprimable |
| Échanges | Sauvegarde/restauration JSON, CSV contrôlé, configuration des connecteurs et mock documenté |

## Démarrer

Node.js 24, puis :

```bash
npm ci --ignore-scripts
npm test
npm run build
npm run preview
```

Ouvrir `http://127.0.0.1:8080`. Les fichiers dans `dist/` sont autonomes et peuvent être hébergés sous un sous-chemin. Aucun service tiers n’est nécessaire au fonctionnement local.

Dans Administration, **Explorer le scénario complet** charge un cas industriel fictif relié de bout en bout. **Créer un espace de saisie vide** ouvre un espace sans dossiers métier, avec le référentiel initial. Ces opérations sauvegardent l’espace précédent ; son retour reste accessible dans Administration.

## Périmètre de mise en service

Les données sont enregistrées dans le navigateur utilisé, avec contrôle du quota et des conflits entre onglets. Exporter régulièrement une sauvegarde JSON depuis Compte. Le hors connexion demande une première ouverture connectée réussie.

Les huit profils sont des **permissions fonctionnelles locales**, sélectionnables pour les usages et la démonstration. Ils ne constituent pas une authentification et ne protègent pas une base partagée. Il n’existe pas de synchronisation entre appareils. SEQUOIA, ERP, MES et SQL ne sont pas connectés. Le CSV fonctionne ; les secrets et connexions automatiques devront être gérés par un service serveur autorisé.

## Documentation

- [Audit avant transformation](docs/AUDIT_INITIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données et migration](docs/DATA_MODEL.md)
- [Installation et tests](docs/INSTALLATION.md)
- [Déploiement et retour arrière](docs/DEPLOYMENT.md)
- [Contrats de connecteurs](docs/CONNECTORS.md)
- [Réception et limites de mise en service](docs/RECEPTION.md)
- [Changelog](CHANGELOG.md)
