# Changelog

## 7.7.0 — 6 novembre 2026

- Rappels : choix « Je suis » (nom du pilote, gardé sur l’appareil). Bandeau « Vos rappels » sur le Plan d’actions et sur l’accueil : en retard, échéance aujourd’hui, demain, sans nouvelle ; un clic ouvre la liste filtrée sur vos actions.
- La cloche d’alertes ajoute les échéances du jour et du lendemain et les actions sans nouvelle (rappel hebdomadaire). « Ouvrir » sur une action mène à la fiche rapide.
- Filtre « Mes actions » dans la liste.
- Agenda Outlook : « Ajouter à mon agenda » dans la fiche, « Ajouter à l’agenda » pour vos échéances à venir et « Agenda (.ics) » pour la vue affichée. Un événement par échéance, rappel la veille à 9 h, identifiant stable : réimporter met l’événement à jour.
- Les rappels ne s’envoient pas application fermée : l’agenda Outlook prend le relais sur téléphone et ordinateur.

Aucun changement de données : le nom choisi reste dans le navigateur (`biaActionMe`).

## 7.6.0 — 6 novembre 2026

- Plan d’actions trouvable en un clic : épinglé en tête du menu avec une pastille rouge des retards, et présent dans la barre du bas sur téléphone pour tous les profils.
- Écran « À traiter » : actions classées par échéance (en retard, cette semaine, ce mois-ci, plus tard, sans date, à vérifier, standby, clôturées récemment), ou regroupées par pilote, famille ou site. Les vues « Liste » et « Par famille » sont remplacées par ce regroupement ; « Par statut » et « Panneau » restent.
- Les compteurs servent de filtres : en retard, cette semaine, à vérifier, sécurité ouvertes, sans nouvelle, standby, toutes ouvertes. Un second clic retire le filtre.
- Fiche rapide en un clic sur une action : statut, pilote, échéance (raccourcis +1 semaine, +2 semaines, fin du mois), priorité, famille, point de la semaine et journal. Standby demande un motif ; la clôture demande une preuve et un vérificateur, avec les mêmes contrôles que la fiche complète (standard et compétences, suivi J30/J60/J90).
- Point de la semaine : une phrase datée par action, affichée sur la ligne ; signal « sans nouvelle » au-delà de 14 jours.
- Reports tracés : la date promise au départ est conservée et chaque report est compté avec son motif, y compris depuis la fiche complète.
- Revue guidée plein écran : sécurité, retards, échéances de la semaine, actions à vérifier et sans nouvelle, une par une. Noter, faite à vérifier, vérifier et clôturer (preuve obligatoire), reporter (motif obligatoire), bloquée, passer. Compte rendu prêt à copier à la fin.
- Saisie rapide d’une action par boutons : quoi, qui, quand, famille, priorité, site. Formulaire complet toujours disponible.
- Panneau corrigé : tenue des délais par rapport à la date promise au départ, glissement, actions sans nouvelle, matrice famille × site ou × pilote (le mot explique la couleur), charge par pilote en points sans barres proportionnelles.
- Famille déduite aussi du type du signal d’origine.

Migration additive : nouveaux champs `updates`, `due_date_initial`, `reschedules`, `category` sur les actions ; aucune donnée supprimée, schéma inchangé.

## 7.5.0 — 5 novembre 2026

- Plan d’actions : indicateurs (actives, en cours, à lancer, Standby, sous 30 jours, en retard, à vérifier, sécurité), quatre vues — Par statut (inchangée, par défaut), Liste, Par famille et Panneau — et filtres par site, responsable et famille.
- Panneau visuel : tuile « Sécurité d’abord », répartition par statut, matrice famille × site (en retard, P1 en cours, en traitement, Standby, clos ; clic vers le détail) et charge par responsable.
- Modification rapide dans la liste limitée au responsable, à l’échéance et à la priorité, avec les garde-fous de la fiche : lecture seule, site hors périmètre, action clôturée, historique. Le statut se change toujours par la fiche, preuve comprise.
- Nouveau statut Standby : motif obligatoire, jamais en retard, exclu des escalades, reprise par « Reprendre ».
- Les actions issues d’un constat de Gemba conservent la famille (catégorie), le constat et l’hypothèse.
- Responsable : liste des personnes et des responsables déjà utilisés, saisie libre conservée.
- Priorités affichées P1 · Critique, P2 · Haute, P3 · Normale ; valeurs stockées inchangées.
- Audits paramétrables : score par pilier et évolution depuis l’audit précédent du même site, questionnaire et périmètre. Ils ne s’affichent plus comme « Ancien format » une fois terminés. Un « | » dans une question ne casse plus l’éditeur de questionnaire.

Migration additive, aucune donnée supprimée, schéma inchangé. Voir [le modèle de données](docs/DATA_MODEL.md).

## 7.4.0 — 28 septembre 2026

- Suivi durable des actions à J30/J60/J90 : calendrier, preuve, vérificateur, contrôles successifs et réouverture après inefficacité ; alertes et agenda intégrés.
- Parcours action → standard versionné → formation du catalogue → compétence nominative. Grilles existantes conservées ; contrôle de la version, de la validité et de l’autonomie avant clôture d’une action ayant un parcours configuré.
- VSM : avant figé, observations CSV prévisualisées et importées atomiquement, historique, comparaison avec l’actuel et le futur distinct.
- Synthèse visuelle des six sites sous BIA Holding dans Pilotage, avec KPI daté, tendance, maturité/couverture et contrôles à faire.
- Réplication d’une pratique validée vers plusieurs sites, en dossiers candidats séparés et sans doublon ; standard local rattachable.
- Escalades des signaux non repris par une action et option de contrôle automatique à l’ouverture/toutes les minutes, application ouverte seulement, pour les managers autorisés.
- Relevés énergie/déchets/CO₂ sourcés, liés aux gaspillages et actions ; ratios par pièce bonne et publication contrôlée dans le registre KPI.
- Assistant d’analyse local et raccordement IA facultatif avec aperçu exact, consentement par envoi, endpoint HTTPS sans secret et résultat inerte non décisionnaire. Aucun modèle externe configuré ou appelé par défaut.

Migration additive, aucune donnée locale supprimée. VSM par saisie/CSV ; aucun flux ERP/MES automatique. Déploiement partagé et authentification restent hors du périmètre statique. Voir [les parcours et limites](docs/LEAN_74.md).

## 7.3.0 — 28 septembre 2026

- Accueil distinct pour les cinq profils : décisions Groupe, transformation multisite, pilotage site, journée d’équipe ou contribution opérateur.
- Interface Essentielle par défaut hors Responsable Lean, avec bascule persistante vers l’interface Complète sans suppression de droits ni de dossiers.
- Navigation mobile limitée à quatre entrées par rôle et pictogrammes SVG homogènes.
- Control Tower et SQCDP réunis dans Pilotage avec deux modes explicites : **Analyser** et **Décider** ; l’ancienne route SQCDP reste compatible.
- Écran **Aujourd’hui** limité à cinq priorités, dernières relèves visibles et sections escalades/routines/actions repliables ; niveaux N1–N4 limités selon le rôle.
- Deux raccourcis flottants remplacés par une commande « + » unique ouvrant Signal Terrain, Idée Kaizen, Action ou Relève selon les droits.
- Formulaires Signal Terrain et Idée Kaizen préremplis et progressifs ; informations avancées disponibles sans alourdir la première saisie.
- Vue analytique transformée en cartes sur téléphone et listes de Control Tower réduites en interface Essentielle.

La simplification ne change ni le modèle de données ni les limites de mise en service : stockage et profils restent locaux, sans authentification serveur, synchronisation entre appareils ou connexion SEQUOIA/ERP/MES active.

## 7.2.0 — 28 septembre 2026

- Centre d’alertes opérationnelles calculé à partir des signaux critiques, actions en retard, escalades, décisions attendues et relèves non reprises.
- Relève d’équipe structurée dans le management quotidien, avec situation, sécurité, qualité, effectif, priorités, dossiers liés et confirmation de reprise.
- Équipes de relève configurables dans Administration et exemple industriel cohérent intégré au scénario de démonstration.
- Lien profond partageable vers Signal Terrain, prépositionné sur le site et l’atelier actifs.
- File locale et paquet JSON d’échanges pour préparer une future synchronisation serveur sans prétendre qu’elle est déjà active.

La persistance, les lectures d’alertes et la file d’échanges restent locales. Aucune notification poussée, authentification serveur, synchronisation entre appareils ou connexion ERP réelle n’est activée.

## 7.1.1 — 27 septembre 2026

- Raccourcis Signal Terrain et Idée Kaizen réduits à deux commandes compactes, avec libellé accessible et infobulle.
- Profils simplifiés et séparés en cinq rôles : DG, Responsable Lean, Directeur de site, Chef d’équipe et Opérateur.
- Anciens profils locaux automatiquement rapprochés du nouveau rôle équivalent sans supprimer les données.
- Comptes fictifs de démonstration alignés sur ces cinq profils.

## 7.1.0 — 27 septembre 2026

- Scénario industriel fictif cohérent sur six sites, avec tendances, signaux, actions, A3, Kaizen, décisions et transferts reliés.
- Accueil renforcé et signature « D’artisan industriel à industriel artisan. ».
- Control Tower recentrée sur l’analyse ; SQCDP Groupe vertical dédié à la réaction et aux arbitrages.
- Signal Terrain et idée Kaizen accessibles en permanence sur les profils contributeurs.
- Formation complète à BIA Lean OS, matrice par profil, preuves de qualification et livret imprimable.
- Historique de maturité conservé, sélection de date et comparaison de deux campagnes sur le radar.
- Sauvegarde automatique de l’ancien scénario de démonstration avant son actualisation.

La persistance reste locale ; les profils ne constituent pas une authentification et aucun flux SEQUOIA, ERP ou MES n’est actif.

## 7.0.0 — 27 septembre 2026

Transformation progressive de BIA Production System 6.8.0 en BIA Lean Operating System.

- Migration schéma 7, sauvegarde antérieure, référentiels persistants, relations et intégrité.
- Actions et mesures centrales ; liens KPI/objectifs/projets, archivage, recherche et journal.
- Control Tower six sites, sources datées, tendances, écart normalisé et rapprochements de pratiques.
- Routines N1–N4 et escalades paramétrées, explicites et sans doublon.
- Hoshin, X-Matrix, contributions et lecture distincte avancement/résultat.
- VSM graphique actuel/futur : objets, flux, tactile, clavier, zoom, calculs et suites opérationnelles.
- Audits génériques, preuves, photos et actions ; maintien de l’audit historique.
- A3 à douze rubriques, PDCA, DMAIC et Pareto dans le module de résolution.
- Kaizen, avant/après simple, gains, standards et déploiements vérifiés.
- Maturité datée à dix piliers/cinq niveaux, heatmap et radar.
- Huit profils fonctionnels ; administration et dictionnaire KPI/seuils.
- CSV atomique, contrat d’entrée, mock et prérequis ERP documentés.
- Build statique, cache versionné, responsive et tests navigateur.
- Conservation des guides, formations, documents, Gemba et sauvegardes compatibles.

La persistance reste locale. Authentification serveur, synchronisation entre appareils et connexions ERP réelles ne sont pas activées dans cette livraison.
