# Installation et vérification

Prérequis : Git et Node.js 24. Aucun secret nécessaire au fonctionnement local.

```bash
git clone https://github.com/thibautpierre800-alt/bia-production-system.git
cd bia-production-system
npm ci --ignore-scripts
npm start
```

Ouvrir `http://127.0.0.1:8080`. `PORT` permet de choisir un autre port. Utiliser HTTP local ou HTTPS, et non `file://`, pour la persistance et le service worker.

## Distribution

```bash
npm run build
npm run preview
```

Le build vérifie les assets et la syntaxe JavaScript, puis produit `dist/`, `404.html`, `.nojekyll` et le manifeste `release.json`. Il ne compile pas de framework et ne charge pas npm dans le navigateur.

## Tests reproductibles

```bash
npm test
npm install --no-save playwright
npx playwright install chromium
npm run build
npm run test:browser
```

`npm test` couvre 40 tests DOM/métier, dont les scénarios A–G, migration, profils, erreurs de stockage, imports, scénario multisite, alertes, relève, accès terrain, paquet d’échanges, formation logicielle et historique de maturité. `tests/regression.cjs` conserve le point d’entrée historique.

Le test navigateur ouvre son serveur sous `/bia-production-system/`, parcourt toutes les combinaisons profil/écran autorisées, contrôle 14 vues à 390/820/1440 px et le SQCDP Groupe vertical à 1080 × 1920, puis vérifie création/relecture, ancres directes, VSM souris/tactile et hors connexion. Captures et rapport vont dans `qa-results/`, ignoré par Git. `BIA_CHROMIUM_EXECUTABLE` permet d’utiliser un Chromium installé ; `BIA_QA_OUTPUT` change le dossier des preuves.

## Premiers pas

1. Compte : exporter toute donnée existante avant expérimentation.
2. Administration : explorer le scénario intégré ou créer un espace vide sauvegardant l’ancien.
3. Configurer sites/ateliers, KPI, responsables, questionnaires et règles.
4. Choisir site et atelier ; saisir un relevé ou un fait terrain.
5. Depuis sa fiche, créer une suite et suivre les mêmes données dans Actions, SQCDP et les vues liées.

Pour travailler à plusieurs appareils sur une même base, terminer la mise en service serveur décrite dans la réception. La sélection d’un profil local n’authentifie pas son utilisateur.
