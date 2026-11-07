# Mettre BIA Lean OS sur le serveur du Groupe

Ce dossier sert au service informatique. L'étape 1 publie l'application telle qu'elle est, en site web statique HTTPS. Elle ne demande ni base de données, ni code serveur, ni compte de service. L'étape 2, avec des données partagées et la connexion par le compte de l'entreprise, est décrite dans [docs/API.md](../docs/API.md).

## 1. Construire le dossier à publier

```bash
node scripts/build.cjs        # Node.js 20 ou plus, aucune dépendance à installer
```

Le dossier `dist/` contient une quarantaine de fichiers et pèse environ 1,2 Mo. C'est tout ce qu'il faut copier sur le serveur. `dist/release.json` donne le nom et la version publiés. Pierre peut aussi fournir `dist/` sous forme d'archive.

## 2. Publier

L'application fonctionne à la racine d'un nom d'hôte comme dans un sous-dossier, par exemple `https://outils.groupe-bia.fr/bia-lean-os/`. Les chemins sont relatifs et le fonctionnement en sous-dossier est testé.

| Serveur | Fichier fourni | Où le mettre |
|---|---|---|
| IIS (Windows Server) | `iis/web.config` | à la racine du dossier publié, à côté de `index.html` |
| nginx | `nginx/bia-lean-os-map.conf` et `nginx/bia-lean-os.conf` | le premier dans `http { }`, le second dans le `server { }` HTTPS ; adapter le chemin `/var/www/bia-lean-os/` |
| Apache 2.4 | `apache/.htaccess` | à la racine du dossier publié (`mod_headers`, `AllowOverride FileInfo Indexes`) |

Les trois fichiers appliquent les mêmes règles :

- **HTTPS obligatoire.** Le fonctionnement hors ligne, l'installation sur téléphone et l'appareil photo n'existent qu'en HTTPS.
- **`index.html`, `service-worker.js` et `manifest.json` en `no-cache`.** Chaque nouvelle version est ainsi prise à l'ouverture suivante. Les autres fichiers portent un numéro de version (`?v=8.22.0`) et peuvent rester une semaine en cache.
- **Politique de sécurité stricte :**

  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self';
  frame-ancestors 'self'; base-uri 'self'; form-action 'self'
  ```

  Elle a été vérifiée sur tous les écrans et les cinq profils, sans aucun refus. L'application n'a ni script en ligne, ni gestionnaire d'événement dans le HTML, ni ressource externe. `style-src 'unsafe-inline'` couvre les styles posés sur les éléments (largeurs, positions des graphiques). `data:` et `blob:` couvrent les photos et les téléchargements.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Strict-Transport-Security`.

Pour une vérification locale avec les mêmes en-têtes, sans IIS ni nginx :

```bash
BIA_CSP=1 PORT=8080 node scripts/serve.cjs dist   # puis ouvrir http://127.0.0.1:8080/
```

## 3. Vérifier

1. Ouvrir l'adresse sur un PC. La console du navigateur (F12) ne doit afficher aucune erreur.
2. `curl -I https://<hôte>/bia-lean-os/` doit montrer `Content-Security-Policy` et `Cache-Control: no-cache`.
3. Recharger une fois, couper le réseau et recharger : l'application s'ouvre. Le bandeau « Hors ligne » apparaît dès qu'une coupure survient pendant l'utilisation.
4. Sur un téléphone :
   - Android, Chrome : le bouton « Installer le calepin » apparaît dans Observer › Gemba.
   - iPhone, Safari : bouton Partager, puis « Sur l'écran d'accueil ».
5. Prendre une photo dans un Gemba, fermer l'application, la rouvrir : la photo est là.

## 4. Reprendre les données déjà saisies

Le navigateur range les données par adresse de site. À la nouvelle adresse, chaque appareil démarre donc vide.

1. **Sur l'ancienne adresse :** Compte › Sauvegarde locale › « Exporter les données ». Le fichier JSON contient les fiches et, depuis la 8.8, les photos.
2. **Sur la nouvelle adresse,** avec le profil Responsable Lean : Compte › Importer. L'import contrôle le fichier et garde une copie des données qu'il remplace.

Faire cette manipulation appareil par appareil, en commençant par celui de Pierre. Un fichier remplace les données de l'appareil : il ne les fusionne pas. La fusion entre appareils arrive avec l'étape 2.

## 5. Mettre à jour, revenir en arrière

- **Mise à jour :** remplacer le contenu publié par le nouveau `dist/`. Les utilisateurs reçoivent la version à l'ouverture suivante, et leurs données restent sur leur appareil.
- **Retour arrière :** garder le `dist/` précédent (par exemple `bia-lean-os-8.8.0/`) et le republier. Chaque version a aussi sa branche `backup/before-…` dans le dépôt, voir [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
- **Recette :** même procédure dans un second dossier, par exemple `/bia-lean-os-recette/`. Le navigateur garde des données séparées pour chaque adresse.

## 6. Après la bascule

- Fermer GitHub Pages et passer le dépôt en privé, de préférence dans une organisation du Groupe.
- Le plan de déploiement interne (fichier Excel) reste importé sur les appareils et n'est jamais publié avec le code.
