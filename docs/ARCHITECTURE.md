# Architecture réelle — 7.0.0

## Choix de continuité

L’application reste une PWA statique en JavaScript natif. Aucun framework ou serveur n’a remplacé les parcours déjà opérationnels. Les dépendances npm servent à la vérification ; elles ne sont pas chargées par les navigateurs des utilisateurs.

`index.html` charge les scripts dans cet ordre :

| Fichier | Responsabilité |
|---|---|
| `lean-library.js` | Contenus des guides Lean |
| `v5.js` | Référentiels hérités, écrans, formulaires et fonctions communes |
| `experience.js` | Persistance, transactions, navigation, recherche, import et protection des saisies |
| `workflows.js` | Actions, problèmes, signaux, pratiques et transitions |
| `fieldwork.js` | Gemba et audit historique |
| `documents-ui.js` | Documents guidés, avant/après, éditeur tabulaire VSM conservé |
| `dashboards.js` | SQCDP, benchmark et pilotage historique |
| `os-core.js` | Migration, registre transverse, intégrité, calculs et règles |
| `os-views.js` | Formulaires et vues Control Tower, Hoshin, Kaizen, maturité, administration |
| `os-audits.js` | Questionnaires paramétrables et audits |
| `os-vsm.js` | Éditeur SVG, déplacement, flux et calculs |
| `os-app.js` | Intégration des parcours, profils, liens, commandes et scénario fictif |
| `boot.js` | Initialisation après chargement des fonctions |

Les trois feuilles CSS partagent boutons, champs, cartes, statuts et comportements responsive. Les classes historiques restent compatibles. La navigation regroupe les entrées par espace ; les vues utilisent des ancres, par exemple `#hoshin` et `#pilotage`.

## Écriture et lecture

Toutes les fiches résident dans `data`. Une mutation métier passe par `commitData` : copie de retour, contrôle du profil, modification, validation des identifiants/relations, journalisation, puis sauvegarde locale. En cas d’échec, la mutation est annulée et un message indique la cause. Une notification de succès suit uniquement une sauvegarde réussie.

Les modules relisent les collections centrales. Les actions ne sont pas copiées dans les audits ou les projets. `linkedActions` et le registre de relations retrouvent les fiches par origine, lien métier ou association explicite. Les mesures remplacent les anciennes tendances quotidiennes redondantes.

Le journal conserve auteur local, date, dossier, champs modifiés, statuts et valeurs scalaires avant/après. Les photos et structures volumineuses ne sont pas dupliquées dans ce journal. Les documents gardent également leur historique métier existant. Ce journal n’est pas un audit de sécurité inviolable.

## Permissions et stockage

Les profils Groupe, Site, Manager, Terrain et Lecture seule pilotent navigation et mutations applicatives. La configuration Groupe et certaines validations sont restreintes. Le sélecteur de rôle reste local et déclaratif : ni session authentifiée, ni contrôle d’accès serveur, ni partage automatique entre appareils.

Le stockage reste `localStorage`. Les photographies sont réduites avant enregistrement. Les quotas sont ceux du navigateur ; aucune capacité illimitée n’est promise. Les sauvegardes JSON sont le moyen de transfert et de restauration fourni.

Le service worker installe les ressources ensemble dans un cache versionné. Une version installée utilise ses propres assets pour limiter les mélanges pendant une mise à jour. Rouvrir l’application permet de reprendre la version nouvellement installée. Le cache PWA et les données métier sont distincts.

## Assistance et extensions

Les suggestions reposent sur les relevés qualifiés hors cible, les retards et les relations enregistrées. Une pratique d’un autre site est proposée si elle possède un résultat documenté et le même KPI. Aucune cause racine n’est déduite automatiquement. Il n’y a pas d’appel à une IA distante.

Les escalades avancent d’un niveau après le délai paramétré, depuis l’échéance puis depuis l’escalade précédente. Le bouton de contrôle déclenche leur création ; aucun ordonnanceur ne fonctionne application fermée.

Un serveur partagé devra remplacer la persistance locale par un dépôt transactionnel, authentifier les identités, appliquer les permissions et stocker les pièces jointes. Les contrats d’entrée des mesures sont séparés dans `connectors/`. `supabase/schema.sql` reste un vestige de conception antérieure, non appelé par cette version et insuffisant à lui seul pour héberger le modèle Lean OS complet.
