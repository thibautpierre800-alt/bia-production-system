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
