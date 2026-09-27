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

## Retour à 7.0.0

La branche distante `backup/before-7.1.0-2026-09-27` conserve le commit `0afb43f`, correspondant à la version 7.0.0 immédiatement antérieure à cette livraison. La sauvegarde historique `backup/before-lean-os-2026-09-27` reste également disponible.

Créer un nouveau commit rétablissant l’arbre sauvegardé, avec un nouveau numéro de cache ; ne pas forcer `main` ou supprimer l’historique. Publier et revérifier Pages. Sur les appareils, exporter d’abord les données 7.1, puis restaurer la copie de schéma 6 créée avant migration. Ne pas injecter directement un export 7 dans l’ancien logiciel.
