# Déploiement et retour arrière

## Hébergement conservé

Le dépôt utilise GitHub Pages et sa publication existante depuis `main`. Les fichiers applicatifs restent à la racine pour conserver ce fonctionnement. Le dossier `dist/` produit localement est également une distribution statique autonome, publiable sur un autre hébergeur HTTPS.

URL de production : `https://thibautpierre800-alt.github.io/bia-production-system/`.

Scripts, CSS, icône et manifeste utilisent des chemins relatifs. Les vues utilisent des ancres : `/bia-production-system/#hoshin` charge le même point d’entrée. Aucun routage serveur SPA n’est requis.

## Publication

1. Exécuter tests et build indiqués dans INSTALLATION.
2. Aligner versions de `package.json`, `APP_VERSION`, tags des ressources `index.html` et cache `service-worker.js`.
3. Committer sur une branche dédiée, ouvrir une PR et fusionner sans réécrire l’historique.
4. Attendre le succès du workflow Pages.
5. Ouvrir l’URL finale et vérifier version, assets, ancre directe et rechargement dans un navigateur réel.

Aucun identifiant de production ou clé API n’est embarqué. Le build n’active pas de synchronisation distante.

## Cache et données

Le service worker installe un ensemble versionné d’assets avant activation. Les fichiers d’un cache installé restent cohérents. Après téléchargement, fermer les onglets puis rouvrir l’application reprend la nouvelle version. Ne jamais vider le stockage métier pour résoudre un problème de cache.

Les données des appareils ne sont pas dans GitHub : leur sauvegarde JSON est distincte du déploiement logiciel.

## Retour à 7.3.0

La branche `backup/before-7.4.0-2026-09-28` conserve le commit `f5ff277`, correspondant à la version 7.3.0 immédiatement antérieure à cette livraison. Les sauvegardes antérieures restent également disponibles. Exporter les données 7.4 avant retour : les nouveaux champs peuvent être ignorés par l’ancienne interface et ne doivent pas être perdus lors d’une restauration.

Créer un nouveau commit rétablissant l’arbre sauvegardé, avec un nouveau numéro de cache ; ne pas forcer `main` ou supprimer l’historique. Publier et revérifier Pages. Sur les appareils, exporter d’abord les données actuelles avant toute restauration.

## Retour à 7.4.0

La branche `backup/before-7.5.0-2026-11-05` conserve le commit `68826b9`, correspondant à la version 7.4.0 immédiatement antérieure à la 7.5.0. Même méthode que ci-dessus : nouveau commit rétablissant l’arbre sauvegardé, avec un nouveau numéro de cache, sans forcer `main`. La 7.5.0 n’a pas de migration destructive : les données 7.5 (statut Standby, famille, constat) restent lisibles par la 7.4, mais un export JSON préalable reste recommandé.

## Retour à 7.5.0

La branche `backup/before-7.6.0-2026-11-06` conserve le commit `e8ff7fd`, correspondant à la version 7.5.0 immédiatement antérieure à la 7.6.0. Même méthode : nouveau commit rétablissant l’arbre sauvegardé, avec un nouveau numéro de cache, sans forcer `main`. Les champs 7.6 (`updates`, `due_date_initial`, `reschedules`, `category`) sont ignorés par la 7.5 et conservés dans les données ; un export JSON préalable reste recommandé.

## Retour à 7.6.0

La branche `backup/before-7.7.0-2026-11-06` conserve le commit `f6790ce`, correspondant à la version 7.6.0. La 7.7.0 ne modifie pas les données : seul le nom choisi pour les rappels est gardé dans le navigateur (`biaActionMe`).

## Retour à 7.7.0

La branche `backup/before-7.8.0-2026-11-06` conserve le commit `a3dc77e`, correspondant à la version 7.7.0. La 7.8.0 ne modifie que l’interface (menu, en-tête, accueil, styles) : aucune donnée n’est transformée.

## Retour à 7.8.0

La branche `backup/before-7.9.0-2026-11-06` conserve le commit `a2fb3e5`, correspondant à la version 7.8.0. La 7.9.0 ne modifie que l’interface ; aucune donnée n’est transformée.

## Retour à 7.9.0

La branche `backup/before-8.0.0-2026-11-06` conserve le commit `c519ca0`, correspondant à la version 7.9.0. La 8.0.0 ne modifie que l’interface (navigation, accueil, saisie Gemba, plan d’actions) : aucune donnée n’est transformée. Les visites et constats saisis en 8.0 restent lisibles en 7.9.

## Retour à 8.0.0

La branche `backup/before-8.1.0-2026-11-06` conserve le commit `06a207e`, correspondant à la version 8.0.0. La 8.1.0 ne modifie que l’écran Voir › Analyser et ses courbes (nouveau fichier `indicateurs.js`) : aucune donnée n’est transformée. Les relevés saisis en 8.1 restent lisibles en 8.0.

## Retour à 8.1.0

La branche `backup/before-8.1.1-2026-11-06` conserve le commit `9aa5876`, correspondant à la version 8.1.0. La 8.1.1 ne change que le calcul de couleur du SQCDP Groupe et des courbes (même règle de seuils qu’Analyser) : aucune donnée n’est transformée.

## Retour à 8.1.1

La branche `backup/before-8.2.0-2026-11-06` conserve le commit `9e2a23c`, correspondant à la version 8.1.1. La 8.2.0 ajoute l’entité Le Moine (et son atelier principal) aux données enregistrées, une seule fois, et un référentiel « Entreprise connectée et humaine » dans les paramètres ; les évaluations existantes ne sont pas transformées. Revenue en 8.1.1, l’application lit ces ajouts sans erreur : Le Moine reste un site configuré et les évaluations 4.0 / 5.0 restent des fiches de maturité.

## Retour à 8.2.0

La branche `backup/before-8.3.0-2026-11-06` conserve le commit `71979ba`, correspondant à la version 8.2.0. La 8.3.0 ajoute une seule clé de données, `hoshinPlan`, créée lors de l’import du fichier de déploiement ou de la création de la matrice ; aucune donnée existante n’est transformée. Revenue en 8.2.0, l’application ignore cette clé et l’écran Hoshin retrouve sa forme précédente.

## Retour à 8.3.0

La branche `backup/before-8.4.0-2026-11-06` conserve le commit `cbe18dc`, correspondant à la version 8.3.0. La 8.4.0 ajoute des dates aux étapes du plan (`from`, `to`) et des objectifs marqués `plan_key` ; revenue en 8.3.0, l’application les lit comme des données ordinaires.

## Retour à 8.4.0

La branche `backup/before-8.5.0-2026-11-06` conserve le commit `ef2a930`, correspondant à la version 8.4.0. La 8.5.0 ajoute au plan importé des champs de lecture (`agenda`, `legend`, `order`, `segments` des étapes) et marque d’un `archived_at` les exemples fictifs retirés à l’import ; revenue en 8.4.0, l’application ignore ces champs et les éléments archivés restent archivés.

## Retour à 8.5.0

La branche `backup/before-8.6.0-2026-11-06` conserve le commit `0ba1aa3`, correspondant à la version 8.5.0. La 8.6.0 ne change que l’affichage des dossiers de résolution (`modeles.js`, styles dans `ux.css`) et ne crée aucun champ ; revenue en 8.5.0, les dossiers s’ouvrent comme avant.

## Retour à 8.6.0

La branche `backup/before-8.6.1-2026-11-06` conserve le commit `cc353c3`, correspondant à la version 8.6.0. La 8.6.1 n’ajoute que de l’affichage (graphiques dans les fiches) ; aucune donnée n’est créée ni modifiée.

## Retour à 8.6.1

La branche `backup/before-8.7.0-2026-11-06` conserve le commit `c2371ad`, correspondant à la version 8.6.1. La 8.7.0 change la saisie (directement dans les cases de la fiche) sans créer de champ ; revenue en 8.6.1, les dossiers se complètent de nouveau par le formulaire question par question.

## Retour à 8.7.0

La branche `backup/before-8.8.0-2026-11-06` conserve le commit `bf09b03`, correspondant à la version 8.7.0. La 8.8.0 ajoute des champs aux constats (`kind`, `urgent`, `photos`, `noted_at`) et à la visite (`people`), ignorés par la 8.7.0. Les nouvelles photos sont rangées dans la base photos du navigateur (IndexedDB `bia-photos`) et référencées `photo:…` : avant un retour en 8.7.0, exporter une sauvegarde depuis la 8.8.0, puisque la 8.7.0 n’affiche pas ces photos référencées (les données restent lisibles).

## Retour à 8.8.0

La branche `backup/before-8.9.0-2026-11-06` conserve le commit `8c54d79`, correspondant à la version 8.8.0. La 8.9.0 ajoute l’onglet Rapport d’étonnement (`etonnement.js`) et la donnée `data.etonnement`, ignorée par la 8.8.0 et conservée dans les données.

## Retour à 8.9.0

La branche `backup/before-8.10.0-2026-11-06` conserve le commit `3b07fbd`, correspondant à la version 8.9.0 (avec le kit serveur). La 8.10.0 ajoute l’onglet 5S (`cinqs.js`), le champ `five_s` des zones et des audits 5S, et la collection `redTags` ; la 8.9.0 les ignore et les conserve. Revenue en 8.9.0, les audits 5S par zone apparaissent dans la liste des audits sans leur vue dédiée.

## Retour à 8.10.0

La branche `backup/before-8.11.0-2026-11-06` conserve le commit `a4dde7a`, correspondant à la version 8.10.0. La 8.11.0 remplace l’écran de l’audit terrain (`audit50.js`) sans changer ses données ; les champs ajoutés aux critères (`photo`, `act`, `what`, `who`, `when`) sont ignorés par la 8.10.0.

## Retour à 8.11.0

La branche `backup/before-8.12.0-2026-11-06` conserve le commit `10dd828`, correspondant à la version 8.11.0. La 8.12.0 ajoute l’éditeur de standard (`standards.js`) et `structured_data.st` dans les documents STANDARD ; la 8.11.0 ignore ce champ et ouvre ces documents avec l’ancien formulaire en six rubriques.
