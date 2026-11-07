# Changelog

## 8.20.0 — 7 novembre 2026

**VSM pas à pas, avec les symboles normalisés et l’échelle de temps.**

- Une VSM s’ouvre désormais sur un éditeur pas à pas, pensé pour le téléphone.
  - Demande et temps net ; fournisseur, livraisons, client et pilotage.
  - Pour chaque processus, le stock devant lui (en pièces, converti en jours) et sa boîte de données : temps de cycle, valeur ajoutée, changement de série, disponibilité, opérateurs, rebut.
  - Puis le stock de produits finis. Les étapes se réordonnent et se retirent.
- La carte se dessine toute seule avec les symboles d’usage : usines fournisseur et client, contrôle de production et flux d’information, boîtes processus et boîtes de données, triangles de stock, flèches poussées, éclairs Kaizen.
  - L’échelle de temps montre les jours de stock en haut et les secondes de valeur ajoutée en bas, avec le délai total, la valeur ajoutée et leur rapport.
  - Le goulot est en contour épais, une étape au-dessus du takt en rouge. Carte à afficher en A4 paysage.
- État actuel et état futur (copie de l’actuel), comparés sur le délai, les stocks, la valeur ajoutée et le nombre d’étapes. Chaque éclair Kaizen devient une action datée.
- L’éditeur graphique libre et le tableau restent accessibles depuis la VSM ; les VSM existantes s’ouvrent telles quelles.
- La valeur ajoutée d’une étape ne peut pas dépasser son temps de cycle.

Données : documents VSM existants ; champs ajoutés `supplier`, `customer`, `delivery`, `info`, `fg_wip` et, par processus, `order`, `scrap`, `burst`, `burst_action_id` ; rien n’est retiré.

## 8.19.0 — 7 novembre 2026

**SQCDP au quotidien : le point du jour, les lettres du mois, la tenue du rituel et les escalades.**

- « Le point du jour » en tête de Voir › SQCDP (et du point de pilotage) : pour chaque lettre S, Q, C, D, P, « Bonne journée » ou « Écart » en un geste. Un écart demande ce qui s’est passé, en une phrase, et devient un sujet du TOP 15 (axe de la lettre, priorité haute pour la sécurité).
- Les lettres du mois, comme au tableau de l’atelier : un calendrier par lettre, jours verts, rouges, week-ends et jours à venir ; un jour passé se corrige d’un geste. Mois précédents consultables. Lettres à afficher en A4 paysage.
- Le point se démarre et se clôt : durée, présents (repris du dernier point et des équipes de polyvalence) et sujets ouverts sont enregistrés. Tenue du mois : points tenus, durée moyenne, présence moyenne.
- Escalades en attente de réponse, avec leur niveau et leur âge (en rouge au-delà de 24 heures). « Répondu » les clôt avec la réponse ; délai moyen de réaction du mois.
- Un seul chronomètre de point sur la page.

Données : nouvelles collections `sqcdpDays` et `meetings` ; les sujets créés depuis une lettre portent `source: "SQCDP"` ; les escalades reçoivent `answered_at` ; rien n’est retiré.

## 8.18.0 — 7 novembre 2026

**Équilibrage et goulot : le Yamazumi, du chronomètre au rééquilibrage.**

- Nouvel onglet Résoudre › Équilibrage. Une étude par ligne : demande par jour et temps d’ouverture net (le takt se calcule), postes et nombre d’opérateurs, chantier lié.
- Temps relevés au téléphone, poste par poste : « Fin d’élément », puis « Fin du cycle » ; le chrono reprend si l’appli se ferme. Saisie à la main en secondes ou en minutes:secondes. Chaque élément est valeur ajoutée, nécessaire ou gaspillage, en un geste.
- Yamazumi : une colonne empilée par poste face à la ligne du takt, le goulot entouré, le temps de chaque poste. Capacité par jour face à la demande, efficacité d’équilibrage, opérateurs nécessaires.
- Rééquilibrer : « Figer l’état actuel » garde l’avant. On réduit, supprime ou déplace les éléments du goulot vers un autre poste, et le graphique suit. Le bilan compare avant et après (goulot, capacité, équilibrage, gaspillage).
- Les gaspillages deviennent des actions datées du plan. Yamazumi à afficher en A4 paysage. La fiche guide « Identifier et exploiter un goulot » mène à l’outil.

Données : nouvelle collection `balances` ; les actions portent `balance_id` (origine « Équilibrage ») ; rien n’est retiré.

## 8.17.0 — 7 novembre 2026

**Idées et Kaizen : une idée en 30 secondes, une réponse sous 48 heures, les réalisations à la vue de tous.**

- « Proposer une idée » (accueil, bouton « + », Résoudre › Kaizen) ouvre un formulaire court pour tous les profils, opérateurs compris : photo d’abord, ce qui ne va pas, mon idée, « je peux le faire moi-même » ou « il faut de l’aide », zone, nom (retenu pour la fois suivante).
- Résoudre › Kaizen devient la page des idées.
  - « À répondre », avec le temps d’attente ; au-delà de 48 heures, l’idée passe en rouge et remonte dans « À surveiller ».
  - Deux réponses : « On le fait » (qui, pour quand) ou « Pas maintenant » (avec la raison, obligatoire).
  - « C’est fait » : photo après et ce que ça a changé ; le responsable valide le gain.
- Mur des idées réalisées avec photos avant / après et « Bravo » (un par personne). Fiche Kaizen d’une page à imprimer. Chiffres du mois : idées, en attente, réponses sous 48 h, réalisations.
- L’auteur voit la réponse à ses idées sur l’accueil, sous « Un problème au poste ? ».
- Le registre en neuf étapes et le registre des gains restent dans l’onglet « Registre et gains ». Une idée créée depuis un autre dossier garde le formulaire complet.

Données : `kaizens[]` reçoit `proposer`, `self`, `before_photo`, `after_photo`, `decision`, `done_at`, `kudos` ; rien n’est retiré.

## 8.16.0 — 6 novembre 2026

**Polyvalence : la matrice I-L-U-O par équipe et par poste.**

- Nouvel onglet Pérenniser › Polyvalence. Une matrice par équipe : les postes (repris des standards de poste en un geste, avec une cible d’autonomes par poste) et les personnes.
- Chaque case : pas formé, I (en formation), L (accompagné), U (autonome, qualité et cadence) ou O (formateur), en un geste, avec la date et l’évaluateur. L’historique est gardé.
- À partir de L, la formation peut être enregistrée sur la version en vigueur du standard du poste. La matrice le signale d’un point bleu.
- Lecture immédiate : postes fragiles (une seule personne autonome ou aucune), postes sous la cible, postes tenus par personne, et « À former en priorité » (les personnes les plus proches de U sur les postes en manque).
- Matrice à afficher en A4 paysage. Les postes fragiles remontent dans « À surveiller » pour le chef d’équipe, le directeur de site et le responsable Lean.
- Correction : à l’arrivée sur Audits ou Chantiers, l’onglet du haut est bien surligné (il ne l’était qu’après un passage par 5S ou SMED).

Données : nouvelle collection `skillsMatrix` ; les standards reçoivent les personnes formées dans `structured_data.st.trained` ; rien n’est retiré.

## 8.15.0 — 6 novembre 2026

**TPM et maintenance autonome : les machines tenues par leurs équipes.**

- Nouvel onglet Observer › TPM. Machines par site et zone, avec leur criticité (A, B, C). Les responsables d’équipe, de site et Lean les ajoutent.
- Étiquettes d’anomalie au téléphone, photo d’abord : fuite, saleté, usure, desserrage, bruit, source de saleté, accès difficile, sécurité. Bleue si l’équipe la traite, rouge s’il faut la maintenance ; une anomalie de sécurité est rouge et à traiter le lendemain. On la traite en disant ce qui a été fait, avec la photo après.
- Standard CIL par machine : nettoyer, inspecter, lubrifier, resserrer ; le point, comment, la fréquence, les minutes. Fiche à afficher au pied de la machine.
- Tournée CIL au téléphone : OK ou anomalie point par point, reprise si l’appli se ferme. Chaque anomalie devient une étiquette à la fin. La prochaine tournée se calcule sur la fréquence la plus courte.
- Pannes : arrêt et remise en route (un geste), cause, ce qui a été fait. Par machine sur 90 jours : heures perdues, MTTR et MTBF calendaire ; Pareto des heures perdues.
- « À surveiller » montre les machines à l’arrêt, les étiquettes en retard et les tournées en retard des machines critiques ; « + » propose « Étiquette machine » et « Panne machine ».

Données : nouvelles collections `machines`, `tpmTags`, `cilRuns` et `breakdowns` ; rien n’est retiré.

## 8.14.0 — 6 novembre 2026

**Ishikawa et 5 pourquoi : des post-it, des causes vérifiées par un fait, un arbre des pourquoi.**

- Ishikawa en trois temps.
  - **Causes** : un post-it par idée dans chacune des six familles (méthodes, machines, main-d’œuvre, matières, mesures, milieu), avec une question pour lancer l’équipe. Entrée pour noter la suivante ; on touche un post-it pour le corriger.
  - **Vérifier** : pour chaque cause, comment la vérifier, le résultat, une photo de la preuve, et le statut à vérifier, confirmée ou écartée. Les causes écartées restent tracées.
  - **Bilan** : l’arête de poisson en couleurs ; chaque cause confirmée part en 5 pourquoi ou en action datée.
- 5 pourquoi en arbre.
  - Plusieurs causes par niveau (« Autre cause »), et chaque réponse vérifiée, fausse ou à vérifier, avec sa preuve.
  - La cause racine se choisit sur une feuille, avec sa contre-mesure.
  - Le bilan relit la chaîne à l’envers avec « donc » pour tester la logique, et crée l’action.
- Depuis l’A3, le 8D ou le QRQC, « Faire l’Ishikawa » et « Faire les 5 pourquoi » ouvrent l’analyse liée au dossier. Les cases d’analyse et de cause racine en affichent le résultat.
- Une analyse se valide quand elle est complète ; la modifier ensuite la repasse en révision. Les anciens Ishikawa et 5 pourquoi en texte deviennent des post-it et un arbre à l’ouverture. Fiche imprimable.
- Correction (5S, audit 50 critères, standard de poste, SMED) : la sauvegarde automatique ne fait plus perdre le curseur, et le clavier, au milieu d’une saisie.

Données : `structured_data.ik` (Ishikawa) et `structured_data.why` (5 pourquoi). Les rubriques texte précédentes restent tenues à jour. Les actions portent `origin_id` = le document et `problem_id` = le dossier.

## 8.13.0 — 6 novembre 2026

**SMED : chronométrer un changement au téléphone, séparer interne et externe, transformer et prouver le gain.**

- Nouvel onglet Résoudre › SMED. Une étude par changement (machine, pilote, cible en minutes, changements par semaine, chantier lié).
- Chrono au téléphone : « Démarrer au dernier bon produit », un gros bouton « Fin d’étape » par opération, « Premier bon produit · fin ». Les opérations se nomment pendant ou après, sans que le clavier gêne le chrono. Le chrono continue si l’appli se ferme et réapparaît dans « À surveiller ». Saisie à la main possible (min:s).
- Chaque opération est interne (machine arrêtée) ou externe (machine en marche), en un geste. Puis, pour chaque opération interne : passer en externe, réduire (avec la nouvelle durée), supprimer ou garder, et comment.
- Diagramme avant / après / machine en marche, arrêt observé et visé, gain par changement et en heures par semaine.
- Les transformations deviennent des actions datées du plan (origine SMED). Les changements suivants se mesurent contre la cible, en barres avec la cible en pointillé.
- « Créer le standard de changement » écrit le standard de poste : d’abord ce qui se prépare machine en marche, puis les opérations machine arrêtée. Les chantiers SMED proposent « Chronométrer en SMED ».

Données : nouvelle collection `smed[]` ; les actions portent `smed_id` (pas d’`origin_id`, la collection n’étant pas indexée) ; rien n’est retiré.

## 8.12.0 — 6 novembre 2026

**Standard de poste : des étapes en photo, des points clés et leurs raisons, comme la méthode TWI.**

- Chaque étape importante a sa photo (prise au poste, annotable au doigt), son intitulé, ses points clés typés sécurité ⚠, qualité ✓ ou geste ✋ (un geste pour changer le type), la raison et le temps. « Photo d’abord » crée l’étape à partir de la photo ; les étapes se déplacent et se suppriment au doigt.
- Protections (EPI) en un geste, zone 5S du poste, réaction en cas d’écart (« Arrêter, sécuriser, prévenir le chef d’équipe » par défaut), temps de cycle calculé.
- Validation : qui valide et la date d’entrée en vigueur ; pas de validation sans étapes nommées ni point clé. Modifier un standard validé le remet en révision ; la validation suivante crée une nouvelle version.
- Formation : les personnes formées, par version, avec le rappel des quatre temps de la formation TWI (préparer, montrer, faire faire, suivre).
- Fiche au poste en A4 paysage : EPI, une carte par étape avec photo, points clés et raison, réaction en cas d’écart, version et validation.
- La zone 5S montre ses standards et en crée un ; « + » propose « Standard de poste ». Les anciens standards en texte restent lisibles, et leur séquence peut devenir les étapes en un geste.

Données : `documents[]` de type STANDARD, `structured_data.st` (étapes, points clés, EPI, zone, validation, formés) ; rien n’est retiré.

## 8.11.0 — 6 novembre 2026

**Audit terrain 50 critères : la même ergonomie que le 5S.**

- Un domaine par étape, cinq critères, six gros boutons de 0 à 5 avec le niveau en clair (absent, ponctuel, partiel, appliqué, maîtrisé, durable) ; l’échelle complète est à un geste.
- Une preuve par critère : un fait observé, un document ou une photo. La note se colore sur place, l’écran ne saute pas, le brouillon est gardé à chaque geste ; « Plus tard » ou la croix ne perdent rien.
- Bilan : score /100, radar des 10 domaines et barres par domaine, comparés à l’audit précédent du même périmètre ; les domaines incomplets mènent à leur étape.
- Les critères notés sous 3 deviennent des actions datées du plan, une par critère (0 et 1 cochés d’office ; un 0 ou un 1 en sécurité est prioritaire, sous 7 jours). Fini les actions par domaine sans date.
- Rapport imprimable : score et évolution, radar, synthèse, actions, critères avec leur preuve et leur photo ; « Refaire un audit de ce périmètre ».
- Les audits personnalisés gagnent les mêmes boutons de note à la place de la liste déroulante.

Données inchangées (`audit_data.criteria`, `domain_scores`, score sur 250) ; chaque critère peut porter une photo et les éléments de son action.

## 8.10.0 — 6 novembre 2026

**5S : un vrai outil, zone par zone, pensé pour le téléphone.**

Inspiré de ce que proposent les logiciels 5S du marché (zones, photo de l’état de référence, audit court sur mobile, radar, étiquettes rouges), avec l’ergonomie du terrain.

- Nouvel onglet Observer › 5S (Responsable Lean, directeurs, chefs d’équipe), juste après Gemba ; aussi dans « + » (Audit 5S, Étiquette rouge).
- Des zones : un périmètre tenu par une équipe, avec un pilote, une cible (80 % par défaut), un rythme d’audit (semaine, quinzaine, mois) et jusqu’à trois photos de l’état de référence. Chaque zone a sa carte : score, tendance, les 5 S en barres colorées, prochain audit, étiquettes rouges. Au niveau Groupe, les zones sont rangées par site avec leur moyenne.
- L’audit au téléphone : une étape par S, trois questions concrètes chacune (dont la règle des 30 secondes et les accès sécurité dégagés), trois gros boutons Non / Partiel / Oui ou « Sans objet », la photo de référence sous les yeux. Une note et une photo ne sont demandées qu’en cas d’écart. Le brouillon est gardé à chaque geste ; « Plus tard » ou la croix ne perdent rien. Pour le 5e S, l’appli rappelle la date du dernier audit et l’avancement de ses actions.
- Le bilan : score et radar des 5 S contre la cible et l’audit précédent ; chaque écart peut devenir une action du plan (un « Non » est coché d’office, un écart sécurité est prioritaire et à traiter sous 48 h).
- Étiquettes rouges numérotées (ER-001…) : photo, objet, raison, décision (jeter, déplacer, réparer, garder), responsable et échéance ; étiquette imprimable à poser sur l’objet ; traitement tracé.
- Fiche de zone à afficher au poste : photo de référence, radar, tendance, prochain audit, actions et étiquettes en cours, sur une page A4.
- L’accueil signale les audits 5S en retard et les étiquettes rouges dépassées. Audits renvoie vers le 5S ; les audits 5S n’entrent plus dans les chiffres de l’audit terrain 50 critères. La fiche « 5S utile et maintenu » de la bibliothèque mène au 5S.

Données : `zones[].five_s` (rythme, cible, photos de référence), audits de type « 5S » avec `zone_id` et `five_s` (réponses, scores par S), nouvelle collection `redTags`. Rien n’est retiré : l’ancien modèle de document « Audit 5S » et les audits existants restent lisibles.

## 8.9.0 — 6 novembre 2026

**Rapport d’étonnement : la synthèse des Gemba pour le COMEX, prête à imprimer.**

- Nouvel onglet Observer › Rapport d’étonnement (Responsable Lean, directeurs de site), pour le Groupe ou pour un site, sur une période choisie (par défaut depuis le premier Gemba).
- En tête : visites, sites, notes et photos de la période, et votre « message clé ».
- « Où regarder » : notes par site et par famille, risques immédiats en rouge, points forts et actions ouvertes ; les familles vues sur plusieurs sites sont reprises en « points communs ».
- Un bloc par thème (sécurité d’abord) : le constat site par site, les risques à vérifier, les questions ouvertes, les pistes et jusqu’à trois photos ; à côté, vos mots en quatre cases (analyse, enjeu, recommandation, action 2027), enregistrés au fil de la saisie.
- Points forts à garder et à partager, actions déjà engagées depuis ces visites (retards en rouge), note de méthode : observations à confirmer, pas un plan d’action définitif.
- Impression en A4 sur deux colonnes, sans cases vides ; « Copier le texte » pour un mail, Word ou PowerPoint.

Nouvelle donnée : `data.etonnement`, par périmètre (Groupe ou site), conservée par la sauvegarde exportée.

Pour le service informatique : `deploy/` (configurations IIS, nginx et Apache avec en-têtes de sécurité vérifiés sur tous les écrans, procédure de mise en ligne, de reprise des données et de retour arrière) et `docs/API.md` (contrat proposé pour l’étape 2 : connexion par le compte de l’entreprise, fiches, photos, droits, stockage, reprise). `scripts/serve.cjs` sert les PNG et, avec `BIA_CSP=1`, applique les mêmes en-têtes.

## 8.8.0 — 6 novembre 2026

**Calepin Gemba : noter sur le terrain au téléphone, avec photos, hors ligne.**

- Une note en dix secondes : « Photo d’abord » ouvre l’appareil photo, puis une phrase ; ou « + Note ». Chaque note a sa nature (constat, risque à vérifier, question, piste, point fort), sa famille, son heure, et peut être marquée « Risque immédiat ».
- Jusqu’à trois photos par note, prises à l’appareil ou choisies dans la galerie, annotées au doigt (entourer en rouge, jaune ou blanc).
- Les photos sont rangées dans la base photos du navigateur : des centaines de photos sans saturer la sauvegarde locale. La sauvegarde exportée (Compte) embarque les photos et les restaure à l’import. Le stockage persistant est demandé au navigateur.
- La visite affiche le décompte (constats, risques, questions, pistes, points forts, photos) et les risques immédiats à traiter ; « Avec qui ? » garde les personnes rencontrées.
- Au tri, les risques immédiats passent en premier ; une action qui en sort est prioritaire (Haute), un signal est de gravité Haute. Un point fort est gardé sans tri.
- Compte rendu de visite : risques immédiats, points forts, constats par famille, questions ouvertes, pistes, actions décidées, photos ; imprimable sur une page, copiable pour un mail, partageable depuis le téléphone. Il rappelle que ce sont des observations à confirmer, pas un plan d’action définitif.
- Hors ligne : bandeau « Hors ligne · tout reste enregistré sur cet appareil ». Installation sur l’écran d’accueil (Android : bouton « Installer » ; iPhone : Partager → Sur l’écran d’accueil), icônes du téléphone ajoutées.
- L’accueil signale le Gemba en cours, à reprendre d’un geste.
- Remarques sur l’appli : depuis « + », noter ce qui gêne ou manque sur l’écran concerné ; la liste se copie pour préparer la version suivante.

Champs ajoutés aux constats, sans rien retirer : `kind`, `urgent`, `photos`, `noted_at` ; à la visite : `people`. `photo` reste la première photo.

## 8.7.0 — 6 novembre 2026

**On écrit directement dans les cases du modèle, et chaque outil dit quand et pourquoi l’utiliser.**

- Dès la création d’un problème, on arrive sur la fiche de sa méthode (A3, PDCA, 8D, DMAIC, QRQC), le curseur dans la première case vide : on écrit dedans. Chaque case porte sa consigne en filigrane ; tout s’enregistre au fil de la saisie, sur l’appareil.
- Le sujet et le pilote se corrigent dans l’en-tête de la fiche ; la grille 5W2H (8D D2, QRQC caractérisation) est le formulaire, une case par question ; « + Ajouter une action » est dans la case du plan d’actions.
- Étape du dossier (Cadrage → Clos) et état de la fiche (Brouillon, En révision, Validé) d’un geste, avec les mêmes garde-fous qu’avant : pas de fiche validée ni de problème clos sans toutes les cases remplies et les actions closes ; valider crée une version ; modifier une fiche validée la remet en révision, modifier un dossier clos le rouvre (tracé).
- « Prochaine case » et « Écrire dans cette case ↓ » mènent à la case suivante ; ouvrir le dossier depuis Documents, une recherche ou un lien mène aussi à la fiche.
- Le formulaire question par question reste disponible : « Mode guidé ».
- Quel outil choisir, et pourquoi : en tête de Résoudre, du signal à l’outil (défaut au poste → QRQC, idée à tester → PDCA, problème qui revient → A3, client touché → 8D, complexe et chiffré → DMAIC), puis pour chaque outil quand l’utiliser, pourquoi, la durée, qui l’anime et la suite ; et les outils d’analyse (5W2H, Pareto, Ishikawa, 5 pourquoi). Les cartes du choix de la méthode et l’en-tête de chaque fiche reprennent le « quand » et le « pourquoi ».

Aucun champ nouveau : les cases écrivent dans les mêmes rubriques qu’avant.

## 8.6.1 — 6 novembre 2026

**Les fiches deviennent un résumé graphique de ce qui est écrit et mesuré.**

- Courbe de l’indicateur du dossier, points colorés selon les seuils et cible en pointillé : jusqu’à l’ouverture dans la case de départ (A3 situation actuelle, 8D D2, QRQC caractérisation, PDCA Planifier, DMAIC Mesurer), toute la courbe avec l’ouverture du dossier repérée dans la case des résultats (A3 résultats, 8D D6, QRQC vérification, PDCA Vérifier, DMAIC Contrôler).
- Objectif : départ → cible → aujourd’hui, en couleur (A3 objectif, PDCA Planifier, DMAIC Définir).
- Pareto compact, trié, avec le cumul ; lisible même dans une colonne étroite.
- Causes : la chaîne des 5 pourquoi jusqu’à la cause retenue et les branches renseignées de l’Ishikawa liés au dossier (A3 : Ishikawa et Pareto dans l’analyse, pourquoi dans la cause racine ; 8D D4, QRQC apparition, DMAIC Analyser).
- Sans indicateur ni analyse liée, rien n’est ajouté : pas de graphique vide.
- Impression : l’A3 tient sur une page A4 paysage, graphiques compris.

## 8.6.0 — 6 novembre 2026

**Résoudre : A3, PDCA, 8D, DMAIC et QRQC sur leurs modèles de référence.**

- Chaque dossier s’affiche sur la feuille de sa méthode, remplie, en pleine largeur dans Résoudre :
  - A3 : la feuille en deux moitiés, à gauche comprendre (PLAN : problème, contexte, situation actuelle avec le Pareto s’il existe, objectif, analyse, cause racine), à droite agir, vérifier, pérenniser (DO · CHECK · ACT : contre-mesures, plan d’actions, résultats, efficacité, standard, enseignements) ;
  - 8D : D0 à D8, la description en grille 5W2H, le confinement mis en avant, les causes d’apparition et de non-détection côte à côte, la clôture avec visa ;
  - QRQC : la bande Détecter → Sécuriser → Analyser → Agir → Vérifier (étapes renseignées en couleur), le fait, la sécurisation dans l’heure, la grille 5W2H, apparition et non-détection, l’action, la vérification et l’escalade ;
  - PDCA : la roue de Deming (Planifier, Faire, Vérifier, Agir dans le sens des aiguilles d’une montre) tenue par la cale du standard ;
  - DMAIC : les cinq phases en chevrons (Définir, Mesurer, Analyser, Améliorer, Contrôler), chacune avec ses outils de référence.
- Toucher une case ouvre la rubrique correspondante. Dans le formulaire, « Voir la fiche … complète » montre le modèle avec la case en cours repérée, et chaque case y est aussi accessible.
- Les actions liées au dossier apparaissent dans la case du modèle (plan d’actions, D6, action corrective, Faire, Améliorer) : quoi, qui, quand, état, retard signalé ; la liste en double sous le dossier est retirée.
- 5W2H : une ligne par question (« Quoi : … », « Où : … ») remplit la grille ; un bouton insère la trame.
- Impression / PDF : la fiche seule, à la taille de la page (A3, PDCA et DMAIC en paysage, 8D et QRQC en portrait), couleurs conservées, cases agrandies pour écrire à la main ; le papier, A3 ou A4, reste au choix.
- Nouveau problème : le choix de la méthode se fait sur cinq cartes avec la vignette du modèle et quand l’utiliser, au lieu d’un menu déroulant.

Aucune donnée n’est modifiée : mêmes rubriques, mêmes champs, seule la mise en page change.

## 8.5.0 — 6 novembre 2026

**La Roadmap reprend l’onglet « phases et actions » ; l’accueil ne montre que ce qui sert.**

- Roadmap : la frise des phases dans le temps, en mois calendaires depuis le démarrage (nov. – déc. 2026, janv. – avr. 2027…), avec les bandes BU pilotes, vague 1 et vague 2 et les sites désignés, les jalons de décision et la ligne d’aujourd’hui. Puis le tableau de l’onglet, tel quel : Phase, Période, Actions clés, Livrable(s), Planning détaillé, phase en cours repérée ; les jalons avec leurs critères de passage et leur état, les indicateurs suivis, la gouvernance, les risques et leurs parades. Le Gantt semaine par semaine du planning n’est plus dans la Roadmap.
- Hoshin : chaque étape de site affiche ses semaines du planning (S45–S52) ; les phases et les jalons sont désormais dans la Roadmap.
- Import du fichier : deux cases, cochées par défaut, retirent les exemples fictifs (objectifs et priorités de démonstration archivés, pas supprimés) et créent les objectifs du plan. Le Hoshin et la Roadmap ne montrent plus les données de démonstration après import.
- Lecture du fichier : le début du programme est la première semaine du Gantt, et non la case « Date » (qui vaut AUJOURDHUI()). Les couleurs et la légende du planning sont gardées par semaine ; le calendrier d’intégration est lu (semaines, jours, cases fusionnées sur plusieurs jours, jours grisés). Les tableaux s’arrêtent à un titre de section même sans ligne vide. Numéro de semaine ISO corrigé.
- Accueil « Ma journée » : plus de carte Gemba (il se démarre depuis + ou Observer). Une carte n’apparaît que si elle a du contenu : Cette semaine (calendrier d’intégration, Responsable Lean), Plan de déploiement (phase en cours, prochain jalon et dans combien de jours, étapes en cours des sites, regroupées quand elles sont identiques), Actions, Indicateurs en écart (les quatre plus marqués, chacun ouvre sa courbe), À surveiller (dont les constats à trier et les retours terrain). Sinon : « Rien d’urgent aujourd’hui ».

Le contenu du fichier de déploiement reste hors du code publié : il n’existe que dans les données de l’appareil qui l’a importé.

## 8.4.0 — 6 novembre 2026

**Un seul plan : la Roadmap et les objectifs Hoshin lisent le plan de déploiement.**

- Roadmap : même cap que le Hoshin, puis le calendrier du déploiement (Gantt) : phases, jalons, tâches de pilotage et étapes de chaque site, dans l’ordre des priorités, avec la ligne d’aujourd’hui. Fenêtre 6 mois, 12 mois ou tout le plan, sans menu déroulant. Toucher une étape la fait avancer, ici comme dans le Hoshin (mêmes données, mêmes droits).
- Les dates des étapes viennent du Gantt du fichier : semaines colorées du planning (S45, S1…), année lue au-dessus ; une case rouge signale une tâche en retard.
- Hoshin : « Créer les objectifs à partir du plan » construit la cascade : le cap en axe stratégique, un objectif Groupe par jalon de décision, un objectif par site rattaché au jalon qui suit la fin de son parcours (ou à sa vague). Un nouvel appel met à jour sans doublon ; les objectifs saisis à la main ne sont pas modifiés.
- Les priorités de la roadmap (résultat, propriétaire, indicateur, échéance) restent sous le calendrier.

## 8.3.0 — 6 novembre 2026

**Voir › Hoshin Kanri : le cap, les priorités des sites et le plan, sur le modèle du fichier qui a fixé les priorités.**

- Cap en tête : « D’artisan industriel à industriel artisan », le programme, la phase en cours (mois n sur N) et la fin visée.
- Priorités des sites : matrice pondérée (critères notés de 1 à 5, poids de 1 à 3, total recalculé), sites classés, TOP retenu et vagues (pilote, vague 1, vague 2). Les écarts entre le total du fichier et le total recalculé sont signalés. Le directeur de site voit le rang de son site ; la DG voit tout le classement, sans modifier.
- Plan de déploiement : frise des phases datée à partir du début du programme, phase en cours, fiches de phase (actions clés, livrables, notes), jalons de décision avec critères de passage, indicateurs suivis.
- Avancement par site, dans l’ordre des priorités : étapes du planning de chaque site (à faire → en cours → fait, d’un geste, pour le Responsable Lean ou le directeur du site) et pastilles des macro-étapes de suivi de production.
- Gouvernance, risques et parades, aspects à aborder ; la déclinaison des objectifs et la X-Matrix restent en dessous.
- Import du fichier de déploiement (.xlsx), réservé au Responsable Lean Groupe : lu dans le navigateur, résumé avant enregistrement (ce qui a été reconnu, ce qui est à vérifier), conservé sur l’appareil avec les autres données. Une nouvelle importation garde les étapes suivies, les vagues et les jalons franchis. Sans fichier, la matrice peut être créée et modifiée dans l’appli.

Le contenu du fichier n’est pas intégré au code publié : il n’existe que dans les données de l’appareil qui l’a importé.

## 8.2.0 — 6 novembre 2026

**La trajectoire BIA : d’artisan industriel à industriel artisan.**

- Le mantra d’origine revient : « D’artisan industriel à industriel artisan. » sous le logo et en tête de « Ma journée » sur téléphone.
- Le Moine devient la septième entité, partout (Analyser, Décider, Maturité, saisies, profils). Elle est ajoutée une seule fois aux données déjà enregistrées, sans rien effacer, et n’est pas réimposée si elle est archivée ensuite. Aucun relevé fictif ne lui est attribué : ses cases restent « sans mesure » jusqu’à la première saisie.
- Voir › Maturité devient la trajectoire BIA, en cinq marches : Artisan industriel, Industriel standardisé, Industriel maîtrisé, Industriel connecté (4.0), Industriel artisan (5.0). La 4.0 et la 5.0 sont des niveaux de maturité, pas un audit à part. Chaque site est placé par ses évaluations, selon une règle affichée : pas de 4.0 sans fondations Lean.
- « Prochain pas » par site : les conditions manquantes pour la marche suivante et les piliers ou critères les plus faibles, ouvrables d’un geste. Fiche d’un site : moyennes Lean, connecté et humain, radars et plans d’amélioration.
- Nouveau référentiel « Entreprise connectée et humaine » : dix critères notés de 1 à 5 sur la même échelle que les piliers Lean (données terrain, machines connectées, pilotage en temps réel, systèmes reliés, automatisation, maintenance prédictive, cybersécurité industrielle ; opérateur au centre, durabilité, résilience), chacun avec sa question.
- Comparer les sites : une seule légende (couleurs des niveaux 1 à 5 et numéros des piliers), une matrice sites × piliers colorée du rouge au vert avec la moyenne, les plus grands écarts entre sites (« une pratique à partager ? ») et des radars à zones colorées, points à la couleur du niveau, sans liste répétée sous chaque site. Date de campagne par ‹ › et comparaison à la campagne précédente d’un geste ; plus aucun menu déroulant.
- Propositions pour avancer, classées par marche, avec leur état (dans l’appli, à lancer, avec l’informatique) : une seule saisie, mêmes définitions, standards au poste ; TRS automatique sur le goulot, SEQUOIA source unique, alertes Teams, maintenance sur l’état, cybersécurité des machines ; savoir-faire transmis, pénibilité mesurée, énergie et CO₂, résilience.
- La liste de 180 fiches d’évaluation laisse place aux campagnes datées ; chaque évaluation reste ouvrable depuis sa case.

Aucune donnée existante n’est modifiée ; les droits restent ceux des profils (la DG consulte, sans saisir).

## 8.1.1 — 6 novembre 2026

**Décider et Analyser : mêmes couleurs, mêmes seuils.**

- SQCDP Groupe (Pilotage › Décider) : l’état de chaque case suit désormais la même règle que Voir › Analyser, c’est-à-dire les seuils vert et orange de chaque indicateur fixés dans Paramètres, décalés sur la cible locale. Une valeur sous la cible mais au-dessus du seuil orange passe en « Vigilance » (orange) au lieu de « Écart » (rouge). Exemple de démonstration : Ag Déco TRS 82 % pour une cible de 85 % (orange dès 75 %).
- Gris pour « sans mesure » et « à qualifier » (bordure pointillée) ; l’orange est réservé à la vigilance.
- Flèches d’évolution ↗ ↘ jugées selon le sens du progrès, vertes si favorables, comme dans Analyser.
- Bandeau : écarts, vigilances, cibles atteintes (et, s’il y en a, sans mesure / à qualifier), puis alertes et décisions.
- Les seuils appliqués sont écrits dans le détail d’une case (Décider), dans le détail d’un indicateur (Analyser) et sur chaque courbe. Les courbes portent le même statut que la case.
- Correction : l’unité « nombre » ne s’affiche plus à côté des signaux sécurité dans le SQCDP Groupe.

Aucune donnée ni aucun droit ne change. Les seuils restent modifiables dans Paramètres › Indicateurs.

## 8.1.0 — 6 novembre 2026

**Voir › Analyser : tous les indicateurs d’un coup d’œil, sans menu déroulant.**

- Groupe : une matrice sites × indicateurs (S, Q, C, D, P), plus la maturité et les actions en retard de chaque site. Les six sites et tous les indicateurs sont visibles ensemble, sur téléphone comme sur ordinateur. Chaque case est colorée selon l’état (écart, vigilance, cible atteinte, sans mesure), avec une flèche d’évolution verte si favorable et la tendance sur ordinateur. Toucher une case ouvre la courbe, la cible et les dossiers liés ; toucher un site ouvre ses courbes.
- Un site : une tuile par indicateur (valeur, cible, date, flèche, tendance) et la maturité.
- Le menu « Indicateur » disparaît. La date de la situation se parcourt avec ‹ › (relevé précédent / suivant) ; « + Relevé » reste en haut de la matrice pour les profils autorisés.
- Sous la matrice : actions en retard, problèmes ouverts et alertes critiques (un geste ouvre l’écran concerné), « À creuser » (indicateurs hors cible plusieurs relevés de suite, avec la pratique validée ailleurs), gains vérifiés. Le tableau « Écarts à analyser », redondant avec la matrice, est retiré. Énergie, déchets et CO₂ ne sont plus repliés.
- Courbes d’un site : sites et historique (Tout, 8, 4 relevés) choisis par puces. Le benchmark à un indicateur, remplacé par la matrice, est retiré de cet écran.
- Décider : la période commune du SQCDP Groupe se parcourt aussi avec ‹ ›.

Aucune donnée ni aucun droit ne change : mêmes relevés, mêmes calculs d’état, mêmes profils.

## 8.0.0 — 6 novembre 2026

**Le quotidien : une seule navigation, et ce qui sert chaque jour (Gemba, plan d’actions) en premier.**

- Une seule navigation : le menu de gauche sur ordinateur, la barre du bas sur téléphone (Accueil et les étapes du chemin). La barre d’étapes en haut des pages, le bouton maison et le menu ☰ du téléphone disparaissent ; « Plus » (outils, compte, paramètres) passe dans le bouton de contexte.
- Plus aucune pastille numérotée : ni numéro d’étape, ni compteur dans les menus. Une icône et un mot par étape. La cloche affiche un point, pas un nombre.
- Une seule ligne d’onglets en haut de page, et seulement si l’étape a plusieurs écrans. Écrans et sous-onglets fusionnés : Observer = Gemba · Signaux · Audits · Statistiques. Toucher l’étape en cours ramène à son premier onglet. Titre masqué quand il répète l’onglet actif.
- Accueil « Ma journée », par profil : carte Gemba (démarrer, reprendre la visite en cours, constats à trier, retours terrain prévus), Mes actions (en retard, cette semaine, à vérifier ; un geste ouvre la fiche rapide ; point de la semaine), À surveiller (trois sujets au plus). DG : À décider et actions en retard, sans saisie. Opérateur : Signaler et ses actions. Bandeau, compteurs, tuiles et « Reprendre mon travail » retirés.
- Gemba express : démarrer avec le site et la zone (suggestions des zones déjà visitées), question et retour prévu facultatifs ; un constat = une phrase, une photo, une famille ; « Enregistrer et suivant ». Tri des constats un par un : Action (pilote et échéance en puces, l’action part dans le plan avec sa date promise), Signal, Analyse (A3, 8D, QRQC), Rien à faire, Plus tard. Terminer la visite demande que chaque constat ait une suite. Le « + » propose « Constat de Gemba » en premier. Le formulaire complet reste accessible.
- Liste des Gemba épurée : En cours, À revoir sur le terrain, Terminés (repliés).
- Plan d’actions : la liste commence dès le premier écran du téléphone. Une ligne de filtres (pilote, Toutes, En retard, Cette semaine, À vérifier, Sécurité, Sans nouvelle, Standby ; les filtres vides sont masqués). Regroupement, « Je suis », agenda et recherche rangés derrière « Filtres ». « Faire le point » en bouton secondaire, « + Action » seul bouton principal.

Aucune donnée ni aucun droit ne change : visites, constats et actions gardent le même modèle ; chaque profil garde ses écrans.

## 7.9.0 — 6 novembre 2026

- La barre du bas (téléphone) suit le chemin du profil : Voir, Observer, Résoudre, Agir, Pérenniser (avec l’accueil quand le profil a moins de cinq étapes). Un bouton Accueil rejoint l’en-tête du téléphone. Les retards s’affichent en pastille rouge.
- Une seule hiérarchie sur tous les écrans : chemin → écran → section. Les onglets propres à chaque écran (Analyser/Décider, N1–N4, Signaux/Gemba/Statistiques, Catalogue/Personnes…, Référentiels, vues du plan d’actions) remontent sous la barre du chemin, au même endroit et avec le même style.
- Doublons retirés : lien « Audit Terrain · 50 critères » dans Terrain quand l’onglet Audits existe ; liens vers un écran hors profil supprimés (ils renvoyaient ailleurs).
- En-têtes de page homogènes : sur-titres retirés (le chemin indique l’étape), titres plus courts (« Plan d’actions »), actions regroupées à droite, une seule action principale.
- Longues listes repliées au-delà de 12 éléments (« Voir les N autres ») : la page Maturité passe d’environ 25 000 à quelques milliers de pixels.
- Cartes chiffrées plus compactes, deux par ligne sur téléphone ; champ de recherche allégé ; rappels sous le titre et plus compacts.

Aucun changement de données ni de droits : chaque profil ne voit que ses écrans, et les écrans gardent leurs fonctions.

## 7.8.0 — 6 novembre 2026

- Le chemin d’usage Lean est visible partout : **Voir → Observer → Résoudre → Agir → Pérenniser**. Le menu ne montre plus que l’accueil, ces cinq étapes (avec ce qui attend à chaque étape) et « Plus » pour les ressources et l’administration.
- Barre du chemin en haut de chaque page, avec l’étape en cours, puis les onglets de cette étape (par exemple Pilotage, Aujourd’hui, Écarts, Maturité, Roadmap, Hoshin pour « Voir »).
- Accueil : le chemin en cinq tuiles cliquables (indicateurs en écart, signaux ouverts, problèmes en cours, actions en retard, actions à vérifier), en-tête allégé.
- En-tête épuré : périmètre, atelier, profil et mode d’interface regroupés dans un seul bouton ; le bandeau de version quitte les pages (version visible dans ce panneau et en bas du menu).
- Allègement visuel : fond plus clair, ombres retirées, bordures plus fines, onglets et boutons homogènes.
- Téléphone : en-tête sur une ligne, barre du chemin défilante centrée sur l’étape en cours ; l’écran SQCDP ne déborde plus horizontalement.

Aucun changement de données ni de droits par profil. Tous les écrans restent accessibles.

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
