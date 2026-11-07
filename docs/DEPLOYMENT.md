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

## Retour à 8.12.0

La branche `backup/before-8.13.0-2026-11-06` conserve le commit `0bf5436`, correspondant à la version 8.12.0. La 8.13.0 ajoute l’onglet SMED (`smed.js`) et la collection `smed`, que la 8.12.0 ignore et conserve. Les actions issues du SMED restent dans le plan d’actions ; les standards de changement restent des standards de poste.

## Retour à 8.13.0

La branche `backup/before-8.14.0-2026-11-06` conserve le commit `9da7f57`, correspondant à la version 8.13.0. La 8.14.0 ajoute `causes.js` et les champs `structured_data.ik` et `structured_data.why` des documents Ishikawa et 5 pourquoi. La 8.13.0 les ignore et affiche les rubriques texte, que la 8.14.0 tient à jour.

## Retour à 8.14.0

La branche `backup/before-8.15.0-2026-11-06` conserve le commit `feee7a6`, correspondant à la version 8.14.0. La 8.15.0 ajoute l’onglet TPM (`tpm.js`) et les collections `machines`, `tpmTags`, `cilRuns` et `breakdowns`, que la 8.14.0 ignore et conserve.

## Retour à 8.15.0

La branche `backup/before-8.16.0-2026-11-06` conserve le commit `d1399f0`, correspondant à la version 8.15.0. La 8.16.0 ajoute l’onglet Polyvalence (`polyvalence.js`) et la collection `skillsMatrix`, que la 8.15.0 ignore et conserve. Les formations enregistrées sur les standards restent visibles dans l’éditeur de standard.

## Retour à 8.16.0

La branche `backup/before-8.17.0-2026-11-07` conserve le commit `7c2aff1`, correspondant à la version 8.16.0. La 8.17.0 ajoute `idees.js` et des champs aux fiches Kaizen existantes, que la 8.16.0 ignore et conserve ; les idées y restent visibles dans le registre.

## Retour à 8.17.0

La branche `backup/before-8.18.0-2026-11-07` conserve le commit `d51b4fa`, correspondant à la version 8.17.0. La 8.18.0 ajoute l’onglet Équilibrage (`equilibrage.js`) et la collection `balances`, que la 8.17.0 ignore et conserve.

## Retour à 8.18.0

La branche `backup/before-8.19.0-2026-11-07` conserve le commit `ff33adf`, correspondant à la version 8.18.0. La 8.19.0 ajoute `sqcdp-jour.js` et les collections `sqcdpDays` et `meetings`, que la 8.18.0 ignore et conserve ; les sujets du TOP 15 créés depuis les lettres restent des sujets ordinaires.

## Retour à 8.19.0

La branche `backup/before-8.20.0-2026-11-07` conserve le commit `63fea6c`, correspondant à la version 8.19.0. La 8.20.0 ajoute `vsm-flux.js` et quelques champs aux VSM ; la 8.19.0 ouvre les mêmes VSM dans l’éditeur graphique libre, qui lit l’ordre des étapes par leur position.

## Retour à 8.20.0

La branche `backup/before-8.21.0-2026-11-07` conserve le commit `817ae3e`, qui correspond à la version 8.20.0. La 8.21.0 ajoute `pratiques.js`, des champs aux bonnes pratiques et aux déploiements, et la collection `opls`. La 8.20.0 ouvre les mêmes pratiques dans le formulaire d'origine et ignore les OPL.

## Retour à 8.21.0

La branche `backup/before-8.22.0-2026-11-07` conserve le commit `0ab9fa6`, qui correspond à la version 8.21.0. La 8.22.0 ajoute `bibliotheque.js` et trois fiches dans `lean-library.js`, sans changer les données : les démarches enregistrées (`toolRuns`) restent lisibles par la 8.21.0.

## Retour à 8.22.0

La branche `backup/before-8.23.0-2026-11-07` conserve le commit `7569d1e`, qui correspond à la version 8.22.0. La 8.23.0 ajoute `signaux.js` et trois champs aux signaux. La 8.22.0 ignore ces champs et rouvre les signaux dans le formulaire complet.

## Retour à 8.23.0

La branche `backup/before-8.24.0-2026-11-07` conserve le commit `49a836c`, qui correspond à la version 8.23.0. La 8.24.0 ajoute `releve.js` et quelques champs aux relèves. La 8.23.0 affiche les mêmes relèves à partir de leurs champs d’origine, qui restent remplis.

## Retour à 8.24.0

La branche `backup/before-8.25.0-2026-11-07` conserve le commit `a8ba9cb`, qui correspond à la version 8.24.0. La 8.25.0 ajoute `chantiers.js` et des champs aux chantiers. La 8.24.0 affiche les mêmes chantiers grâce à leurs champs d’origine, qui restent remplis.

## Retour à 8.25.0

La branche `backup/before-8.26.0-2026-11-07` conserve le commit `ed5b695`, qui correspond à la version 8.25.0. La 8.26.0 ajoute `formation.js` et le champ `session_id` aux fiches de formation. La 8.25.0 ignore ce champ.

## Retour à 8.26.0

La branche `backup/before-8.27.0-2026-11-07` conserve le commit `28fe26a`, qui correspond à la version 8.26.0. La 8.27.0 ajoute `roadmap-revue.js` et la collection `roadmapReviews`. La 8.26.0 ignore cette collection.

## Retour à 8.27.0

La branche `backup/before-8.28.0-2026-11-07` conserve le commit `de84657`, qui correspond à la version 8.27.0. La 8.28.0 ajoute `avant-apres.js`, sans nouveau champ : la 8.27.0 rouvre les mêmes fiches dans son formulaire.

## Retour à 8.28.0

La branche `backup/before-8.29.0-2026-11-07` conserve le commit `6fa1ae7`, qui correspond à la version 8.28.0. La 8.29.0 ajoute `ecarts.js` et la collection `gapReviews`. La 8.28.0 ignore cette collection ; les actions créées depuis un écart restent des actions ordinaires.

## Retour à 8.29.0

La branche `backup/before-8.30.0-2026-11-07` conserve le commit `241adee`, qui correspond à la version 8.29.0. La 8.30.0 ajoute `journal.js` ; les champs `person` et `role` des événements sont ignorés par la 8.29.0.

## Retour à 8.30.0

La branche `backup/before-8.31.0-2026-11-07` conserve le commit `d7fc5f0`, qui correspond à la version 8.30.0. La 8.31.0 ajoute `parametres.js`, sans nouveau champ.

## Retour à 8.31.0

La branche `backup/before-8.32.0-2026-11-07` conserve le commit `767a533`, qui correspond à la version 8.31.0. La 8.32.0 ajoute `connecteurs.js`. La 8.31.0 affiche les nouveaux statuts de connecteur tels quels et ignore `syncLog[].ignored`.

## Retour à 8.32.0

La branche `backup/before-8.33.0-2026-11-07` conserve le commit `2a453c0`, qui correspond à la version 8.32.0. La 8.33.0 ajoute `reunions.js` et les collections `instances` et `instanceSessions`. La 8.32.0 les ignore ; les actions nées en réunion restent des actions ordinaires.

## Retour à 8.33.0

La branche `backup/before-8.34.0-2026-11-07` conserve le commit `833e04b`, qui correspond à la version 8.33.0. La 8.34.0 ajoute `cascade.js`. Les champs ajoutés aux sujets et aux escalades sont ignorés par la 8.33.0, et les TOP 15 y apparaissent comme des instances ordinaires.

## Retour à 8.34.0

La branche `backup/before-8.35.0-2026-11-07` conserve le commit `5d6492b`, qui correspond à la version 8.34.0. La 8.35.0 ajoute `microarrets.js` et des règles CSS. Les collections `mlLines` et `microStops` sont ignorées par la 8.34.0.

## Retour à 8.35.0

La branche `backup/before-8.36.0-2026-11-07` conserve le commit `bd71d36`, qui correspond à la version 8.35.0. La 8.36.0 ajoute `trs.js`. La collection `trsShifts` est ignorée par la 8.35.0. Les relevés TRS de source « Feuilles de poste » restent des relevés ordinaires.

## Retour à 8.36.0

La branche `backup/before-8.37.0-2026-11-07` conserve le commit `51b5a1b`, qui correspond à la version 8.36.0. La 8.37.0 ajoute `gains.js` et `environnement.js`. Les gains de l’ancien registre restent compatibles : `quantity` et `period` sont tenus à jour.

## Retour à 8.37.0

La branche `backup/before-8.38.0-2026-11-07` conserve le commit `d04c0ab`, qui correspond à la version 8.37.0. La 8.38.0 ajoute `nc.js`. Les commandes viennent d’une extraction CSV de l’ERP, en attendant un connecteur.

## Retour à 8.38.0

La branche `backup/before-8.39.0-2026-11-07` conserve le commit `14bb6b5`, qui correspond à la version 8.38.0. La 8.39.0 modifie `nc.js` et `ux.css`.

## Retour à 8.39.0

La branche `backup/before-8.40.0-2026-11-07` conserve le commit `4a26665`, qui correspond à la version 8.39.0. La 8.40.0 ajoute `echantillotheque.js` et ouvre `ncForm` à un préremplissage.
