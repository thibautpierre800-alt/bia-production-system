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
