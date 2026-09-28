# BIA Lean Operating System 7.4.0

Application de pilotage Lean pour BIA Holding et ses six sites : Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline et Sodeplax. La version 7.4.0 ajoute le suivi durable J30/J60/J90, la transmission des standards, les observations VSM, la synthèse multisite et les relevés environnementaux dans les parcours existants, sans effacer les données ni modifier les profils ou modes Essentiel/Complet.

Les [huit évolutions et leur mode d’emploi](docs/LEAN_74.md) précisent ce qui fonctionne localement et ce qui nécessite un serveur. L’assistant externe reste non connecté ; son raccordement facultatif exige un serveur autorisé et un consentement explicite par envoi. Les escalades automatiques, désactivées initialement, peuvent être activées dans Administration → Règles et ne fonctionnent qu’application ouverte.

## Le parcours métier

Observer → qualifier → analyser → décider → agir → mesurer → vérifier → standardiser → déployer → capitaliser.

Les fiches utilisent une base d’actions et un registre de mesures uniques. Le panneau **Ce dossier dans le système** permet de retrouver les sources, créer une suite, relier un dossier et parcourir les relations dans les deux sens.

| Espace | Fonctions utilisables |
|---|---|
| Pilotage | Une entrée avec deux modes : **Analyser** pour les tendances/écarts et **Décider** pour le SQCDP, le benchmark, les pratiques rapprochées et l’écran Groupe vertical |
| Aujourd’hui | Cinq priorités maximum, niveaux adaptés au rôle, alertes, escalades, routines et relèves reliées aux dossiers actifs |
| Terrain | Signaux, Gemba multiconstats, photos, audits génériques, 5S et audit historique de 50 critères |
| Résolution | QRQC, A3 complet, PDCA, 8D, DMAIC, 5 Pourquoi, Ishikawa et Pareto |
| Amélioration | Actions centrales, Kaizen, avant/après, gains vérifiés, standards et bonnes pratiques |
| Stratégie | Objectifs hiérarchiques, X-Matrix, contributions, KPI, projets, actions et résultats |
| Flux | VSM graphique actuel/futur, déplacement souris/tactile/clavier, zoom, objets, flux et calculs |
| Capitalisation | Matrice pratique × sites, essais locaux, preuves et validation du déploiement |
| Maturité | Dix piliers, cinq niveaux, historique daté, comparaison de campagnes, preuves et radar superposé |
| Administration | Organisation, utilisateurs déclarés, KPI/seuils, catégories, questionnaires, règles et journal |
| Ressources | Trente guides, formation complète à BIA Lean OS, matrice par profil, suivi individuel et livret imprimable |
| Ergonomie | Accueil propre à chaque rôle, interface Essentielle/Complète, quatre entrées mobiles et commande « + » unique pour créer |
| Échanges | Sauvegarde/restauration JSON, CSV contrôlé, lien direct vers Signal Terrain, file exportable et mock documenté |

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

Les données sont enregistrées dans le navigateur utilisé, avec contrôle du quota et des conflits entre onglets. Exporter régulièrement une sauvegarde JSON depuis Compte. Le hors connexion demande une première ouverture connectée réussie. La file locale prépare un paquet JSON exploitable par un futur serveur, mais ne transmet encore aucune donnée.

Les cinq profils — DG, Responsable Lean, Directeur de site, Chef d’équipe et Opérateur — sont des **permissions fonctionnelles locales**, sélectionnables pour les usages et la démonstration. L’interface Essentielle réduit seulement la navigation ; l’interface Complète réaffiche les modules autorisés. Ces profils ne constituent pas une authentification et ne protègent pas une base partagée. Il n’existe pas de synchronisation entre appareils. SEQUOIA, ERP, MES et SQL ne sont pas connectés. Le CSV fonctionne ; les secrets et connexions automatiques devront être gérés par un service serveur autorisé.

## Documentation

- [Audit avant transformation](docs/AUDIT_INITIAL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données et migration](docs/DATA_MODEL.md)
- [Installation et tests](docs/INSTALLATION.md)
- [Déploiement et retour arrière](docs/DEPLOYMENT.md)
- [Contrats de connecteurs](docs/CONNECTORS.md)
- [Réception et limites de mise en service](docs/RECEPTION.md)
- [Changelog](CHANGELOG.md)
