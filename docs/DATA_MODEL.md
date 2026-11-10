# Modèle de données — schéma 7

Extension 7.4.0 additive : calendrier et preuves `actions.sustainment`, parcours de transmission/qualifications par version, VSM avant figé et observations, `environmentLogs`, mesures dérivées sourcées et options d’escalade/IA. Voir [le détail des champs](LEAN_74.md#données-nouvelles). Les données antérieures et le schéma 7 restent compatibles.

## Identité et relations

Une fiche du registre possède un `id` unique et stable, alphanumérique avec tirets ou soulignements. `site_id`, `workshop_id` et `zone_id` précisent son périmètre lorsque pertinent. `created_at`, `updated_at` et `archived_at` portent son cycle de vie. L’archivage masque une fiche des listes actives, conserve ses relations et reste réversible depuis son dossier/journal.

| Collections | Relations et rôle |
|---|---|
| `sites`, `workshops`, `zones`, `users` | Groupe/site → atelier → zone ; utilisateurs et rôles fonctionnels |
| `kpis`, `measures` | Dictionnaire → valeurs datées ; clé unique site + atelier éventuel + KPI + date |
| `objectives` | `parent_id`, niveau stratégique, KPI, cible, année, responsable, résultat |
| `signals`, `gembas` | Observations, photos, décisions ; constats détaillés dans leur visite Gemba |
| `problems`, `documents` | Dossier de résolution → document de méthode |
| `actions` | Base unique ; origine, KPI, objectif, projet, contributeurs, échéance, vérification |
| `projects`, `roadmap` | Chantiers et priorités ; contributions aux objectifs et résultats |
| `audits`, `auditTemplates` | Questionnaire figé à l’ouverture de l’audit, réponses, preuves, score et actions |
| `kaizens`, `gains` | Idée et étapes de réalisation ; gains rattachés à leur source |
| `practices`, `deployments` | Pratique d’origine → un dossier de transfert par site destinataire |
| `maturity` | Évaluations distinctes par date, site/atelier, pilier, niveau, cible et preuve |
| `routines`, `escalations`, `decisions`, `topics` | Rituels N1–N4, SQCDP et arbitrages |
| `handovers` | Relèves d’équipe : équipe sortante/entrante, faits, priorités, dossiers liés et accusé de reprise |
| `comments`, `activity` | Commentaires rattachés aux dossiers et journal transverse |
| `links` | `from`, `to`, `type`, auteur et date ; navigation dans les deux sens |
| `connectors`, `syncLog`, `syncQueue` | Configuration déclarative, imports exécutés et événements locaux à exporter |

Les collections historiques `people`, `trainingCatalog`, `trainingRecords` et `toolRuns` restent disponibles. Les photos sont des données image filtrées dans les dossiers, sans service distant.

Les clés métier sont notamment `origin_id`, `source_id`, `kpi_id`, `objective_id`, `project_id`, `problem_id`, `practice_id`, `kaizen_id`, `standard_id` et `before_after_id`. Les relations absentes et cycles Hoshin sont refusés lors d’une nouvelle écriture. Les incohérences héritées sont signalées sans supprimer silencieusement les fiches.

## KPI et comparaison

Le dictionnaire conserve code, définition, unité, sens, formule documentée, source prévue, fréquence, propriétaire, niveau, cible et seuils. Une mesure porte date, valeur, périmètre réellement mesuré, source et mode de saisie. La formule est documentaire : l’application n’exécute pas de formule arbitraire issue d’un ERP.

Les couleurs viennent des seuils vert/orange ; au-delà de l’orange, le statut est rouge. La borne rouge décrit l’extrémité défavorable de l’échelle. Une cible locale décale les seuils de la différence avec la cible du dictionnaire. Absence de mesure et définition insuffisante ont des états distincts.

L’écart normalisé vaut `(valeur − cible) / |cible| × 100`, inversé si « moins est mieux ». Positif signifie favorable. Il n’est pas calculé pour une cible nulle ou une mesure non qualifiée. Les pourcentages des sites ne sont pas additionnés ou moyennés sans dénominateurs.

Une mesure d’atelier n’est pas un résultat de site. Les vues de site utilisent les relevés sans `workshop_id` ; celles d’atelier utilisent exactement l’atelier sélectionné. La date de la Control Tower filtre les relevés ; les autres dossiers affichent leur état actuel.

## Résultats et contrôles

- Action clôturée : résultat, vérificateur et date valide requis.
- Problème clos : document complet et actions vérifiées requis.
- Projet clos : résultat et clôture des actions liées requis.
- Audit : une preuve obligatoire manquante empêche la validation.
- Gain validé : preuve et validateur requis ; `(avant − après) × quantité`, inversé selon le sens. Totaux séparés par unité/période. Pas de double comptage pour une même source/unité/période.
- Transfert validé/déployé : résultat local, preuve et validateur requis.
- Hoshin : avancement des actions et résultat KPI affichés séparément.

## VSM

Le document contient `vsm.current` et `vsm.future`, avec objets `nodes`, coordonnées et flux `edges`. Les états sont indépendants. L’état futur peut partir d’une copie explicite de l’actuel. Le retrait d’un objet est annulable.

Takt = temps net/demande. Lead time = cycles + attentes observées, pour un flux séquentiel. VA = somme des temps VA ; NVA = lead time − VA. Capacité théorique = temps net × disponibilité/cycle, arrondie à l’entier inférieur ; le minimum donne le goulot. Charge = cycle/takt. Équilibre = somme des cycles/(nombre de processus × cycle maximal). Le WIP additionne les encours saisis : ne pas renseigner deux fois le même stock.

Les métriques incomplètes affichent « — ». Rebuts, changements de série et branches parallèles ne sont pas automatiquement simulés ; les changements de série restent visibles pour l’analyse. Les hypothèses figurent dans l’écran.

## Relèves, alertes et file d’échanges

Une relève porte `shift_from`, `shift_to`, `period`, `author`, `status`, les faits SQCDP utiles et `linked_ids`. Les liens pointent vers les signaux/actions existants. Le statut `Reprise` ajoute `acknowledged_by` et `acknowledged_at` ; il ne clôt pas automatiquement les dossiers transmis.

Les alertes ne forment pas une collection métier supplémentaire. Elles sont recalculées depuis les signaux critiques ou en retard, actions en retard, escalades ouvertes, décisions arrivées à échéance et relèves transmises non reprises. Les clés lues sont stockées localement par profil et sont limitées aux 500 plus récentes.

`syncQueue` référence les nouveaux événements du journal avec l’identifiant du dossier, le site, l’opération, la révision et le statut `pending`. L’export `bia-lean-os-sync-bundle/v1` contient ces références, les événements et une photographie des dossiers concernés. Aucun acquittement distant ou reprise réseau n’est implémenté.

## Migration et retour

La clé locale reste `biaProductionSystemV5`. La migration 6 → 7 est idempotente : référentiels persistants, rattachement des mesures aux KPI, progression des actions et nouvelles collections. Les anciennes séries quotidiennes sont conservées dans `legacyDailyTrends`, puis retirées des vues de saisie redondantes. Les comptes sont migrés dans `users`, avec copie `legacyAccounts`.

Avant migration, le JSON original est conservé sous `biaProductionSystemV5-before-lean-os`. Compte/Administration permettent d’exporter les sauvegardes. Avant restauration ou changement d’espace, une copie distincte est conservée. Le retour logiciel à 6.8 doit utiliser le JSON de schéma 6 correspondant, jamais un export 7 sans conversion.

## Extension 7.5.0 (additive)

- `actions.status` accepte `Standby`, avec `actions.hold_reason` (motif obligatoire). Une action en Standby n’est ni en retard ni escaladée.
- Les actions créées depuis un constat de Gemba portent `category` (famille), `finding` (constat) et `hypothesis`. Pour les actions plus anciennes, la famille est retrouvée par `origin_id` et `observation_id`, sinon « Non classée ».
- Priorités : P1 = `Critique`, P2 = `Haute`, P3 = `Normale` (affichage seulement).
- `audits.audit_data.domain_scores` (moyenne 0–5 par pilier) et `audits.audit_data.proof_count` sont enregistrés à la validation d’un audit paramétrable.

## Extension 7.6.0 (additive)

- `actions.updates[]` : points d’avancement `{at, text, by}`. Le dernier s’affiche sur la ligne de l’action ; une action Ouverte ou En cours sans point (ni création) depuis plus de 14 jours est signalée « sans nouvelle ».
- `actions.due_date_initial` : date promise au départ. Renseignée à la création, ou au premier report pour les actions plus anciennes.
- `actions.reschedules[]` : reports `{at, from, to, reason, by}`. Le nombre de reports et la date initiale restent visibles ; la tenue des délais du Panneau se calcule par rapport à la date initiale.
- `actions.category` : famille choisie dans la liste paramétrable des catégories. À défaut, la famille est déduite du constat de Gemba, puis du type du signal d’origine, sinon « Non classée ».
- Une action peut être créée sans échéance (saisie rapide « Sans date ») ; elle est alors signalée « Sans date » jusqu’à ce qu’une date soit fixée.

## Extension 8.8.0 (additive)

- `gembas[].observations[]` : `kind` (`fait`, `risque`, `question`, `piste`, `positif` ; absent = `fait`), `urgent` (risque immédiat), `photos` (jusqu’à trois, la première recopiée dans `photo`), `noted_at` (heure de la note).
- `gembas[].people` : personnes rencontrées pendant la visite.
- Photos : une valeur `photo:<id>` désigne une photo de la base photos du navigateur (IndexedDB `bia-photos`). Une sauvegarde exportée ajoute `photos: {<id>: data URL}` ; l’import les range dans la base, ou les réintègre dans la fiche si la base est indisponible. Les anciennes photos intégrées (`data:image/…`) restent valides.
- Remarques sur l’appli : clé locale `biaAppNotes`, hors des données métier.

## Extension 8.9.0 (additive)

- `etonnement` : objet par périmètre (`group` ou identifiant de site) → `{ message, from, to, themes: { <famille>: { analysis, stake, reco, action } }, updated_at }`. Les constats eux-mêmes restent dans les Gemba : le rapport ne recopie que les mots du responsable Lean.

## Extension 8.10.0 (additive)

- `zones[].five_s` : `{ frequency_days (7, 14 ou 30), target (%), ref_photos [jusqu’à 3] }`. Une zone peut être sans atelier (`workshop_id` nul).
- `audits[]` de type « 5S » par zone : `zone_id`, `five_s: { answers: { <critère>: { v: 0|1|2|"na", note, photo, act, what, who, when } }, s_scores: [5 scores %], target }`, `score` (moyenne des S, %), `audit_data.criteria` et `audit_data.domain_scores` (sur 5) pour rester lisibles comme les autres audits. Pas de `template_id` : les quinze critères sont fixés par l’application (`CS_CRITERIA`).
- `redTags[]` : `{ id "ER-001", site_id, zone_id, what, qty, reason, decision, owner, due_date, photo, status ("Ouverte" | "Traitée"), done_at, done_note, author, created_at }`.
- Actions issues d’un audit 5S : `origin_type` « Audit », `origin_id` l’audit, `question_id` le critère, `zone_id`, famille « Standard » (ou « Sécurité » pour les accès dégagés).

## Extension 8.12.0 (additive)

- `documents[]` de type STANDARD : `structured_data.st = { zone_id, ppe[], steps[{ id, title, points[{ kind: "securite"|"qualite"|"geste", text }], reason, photo, time_s }], reaction, approved_by, approved_at, effective_date, trained[{ name, date, by, version }] }`. Le statut du document suit Brouillon → Validé → En révision ; `version` augmente à chaque nouvelle validation. Les six rubriques texte précédentes sont conservées.

## Extension 8.13.0 (additive)

- `smed[]` : `{ id: "SMED-001", site_id, project_id?, title, owner, target_min, per_week, chrono: { started_at, lap_at, ended_at? }, ops[{ id, label, dur_s, type: "interne"|"externe", after?: "externe"|"reduite"|"supprimee"|"inchangee", after_s?, action?, act?, who?, when?, action_id? }], measures[{ date, min, by }], standard_id?, created_at, updated_at }`. Le chrono est enregistré pour survivre à la fermeture de l’appli.
- `actions[]` issues du SMED : `origin_type: "SMED"`, `smed_id`, sans `origin_id`.
- Le standard de changement est un document STANDARD ordinaire (`structured_data.st`).

## Extension 8.14.0 (additive)

- `documents[]` de type ISHIKAWA : `structured_data.ik = { causes[{ id, fam: "method"|"machine"|"manpower"|"material"|"measurement"|"environment", text, status: "verifier"|"confirmee"|"ecartee", test, proof, photo, why_id?, action_id?, action?, who?, when? }] }`. Les rubriques `method`… `environment` et `tests` sont recalculées.
- `documents[]` de type 5WHY : `structured_data.why = { nodes[{ id, parent, text, status: "verifier"|"vrai"|"faux", proof, root?, cm?, who?, when?, action_id? }], from?: { doc, cause } }`. Les rubriques `why1`… `why5` (chemin de la première cause racine), `root_cause` et `countermeasure` sont recalculées.
- Document validé : `validated_at`. Actions : `origin_type` « Ishikawa » ou « 5 pourquoi », `origin_id` = le document, `problem_id` = le dossier.

## Extension 8.15.0 (additive)

- `machines[]` : `{ id: "MA-001", site_id, zone_id?, name, criticality: "A"|"B"|"C", owner, cil[{ id, kind: "nettoyer"|"inspecter"|"lubrifier"|"serrer", what, how, freq: "poste"|"jour"|"semaine"|"mois", minutes }], cil_draft?: { started_at, by, res{ pointId: { v: "ok"|"ano", text?, color? } } }, created_at, updated_at }`.
- `tpmTags[]` : `{ id: "ET-001", site_id, machine_id, kind, color: "bleue"|"rouge", what, photo, status: "ouverte"|"traitee", due_date, cil_point?, created_by, fix?, fix_photo?, fixed_at?, fixed_by?, created_at, updated_at }`.
- `cilRuns[]` : `{ id: "CIL-001", site_id, machine_id, date, started_at, ended_at, by, results{ pointId: "ok"|"ano" }, tag_ids[] }`.
- `breakdowns[]` : `{ id: "PA-001", site_id, machine_id, start, end|null, cause, fix, by, created_at, updated_at }`. MTTR = durée moyenne des pannes closes ; MTBF calendaire = temps moyen entre deux débuts de panne, sur 90 jours.

## Extension 8.16.0 (additive)

- `skillsMatrix[]` : `{ id: "PV-001", site_id, name, zone_id?, stations[{ id, name, standard_id?, target }], people[{ id, name, person_id? }], levels{ "personne|poste": { lvl: 0..4, date, by, hist[{ lvl, date, by }] } }, created_at, updated_at }`. Niveaux : 0 pas formé, 1 I, 2 L, 3 U, 4 O. Un poste est fragile quand une seule personne, ou aucune, y est en U ou O.
- À partir de L, une entrée `{ name, date, by, version }` peut être ajoutée à `structured_data.st.trained` du standard relié.

## Extension 8.17.0 (additive)

- `kaizens[]` : `proposer`, `self` (l’auteur peut le faire), `zone_id`, `before_photo`, `after_photo`, `decision { verdict: "go"|"no", reason, by, at }`, `done_at`, `result`, `validated_by`, `kudos[{ by, at }]`. Statuts utilisés : Idée → Mise en œuvre (« On le fait ») → Mesure (« C’est fait ») → Gain validé. Une idée refusée garde le statut Idée avec `decision.verdict = "no"`.

## Extension 8.18.0 (additive)

- `balances[]` : `{ id: "EQ-001", site_id, project_id?, title, owner, demand_per_day, available_min, stations[{ id, name, operators }], elements[{ id, station_id, label, sec, kind: "va"|"nva"|"muda", act?, who?, when?, action_id? }], chrono?: { station_id, started_at, lap_at, ended_at? }, baseline?: { at, stations, elements }, created_at, updated_at }`.
- Takt = `available_min × 60 / demand_per_day`. Cycle d’un poste = somme des éléments / opérateurs. Efficacité d’équilibrage = contenu total / (opérateurs × cycle du goulot).
- Actions issues d’un gaspillage : `origin_type: "Équilibrage"`, `balance_id`, sans `origin_id`.

## Extension 8.19.0 (additive)

- `sqcdpDays[]` : `{ id, site_id, workshop_id, date, axis: "S"|"Q"|"C"|"D"|"P", status: "ok"|"ko", note, topic_id?, by, created_at, updated_at }`. Un écart avec une note crée un sujet `topics[]` (`source: "SQCDP"`).
- `meetings[]` : `{ id, site_id, workshop_id, date, started_at, ended_at, duration_s, present[], topics, escalated, by }`.
- `escalations[]` : `answered_at` à la réponse ; délai de réaction = `answered_at − created_at`.

## Extension 8.20.0 (additive)

- `documents[]` VSM, `vsm.current` et `vsm.future` : `supplier`, `customer`, `delivery`, `info`, `fg_wip` (stock de produits finis, en pièces).
- Processus : `order`, `scrap` (%), `burst` (éclair Kaizen), `burst_action_id`.
- Jours de stock = pièces / demande par jour (à défaut, attente en minutes / temps net). Délai = Σ jours × temps net + Σ temps de cycle. VA / délai = Σ valeur ajoutée / délai.
- Actions issues d’un éclair : `origin_type: "VSM"`, `origin_id` = la VSM.

## Extension 8.21.0 (additive)

- `practices[]` : `problem`, `res_label`, `res_before`, `res_after`, `res_unit` (résultat avant → après), `effort` (Moins d’un jour, Moins d’une semaine, Un chantier), `cost` (€), `where` (où la voir), `before_photo`, `after_photo`, `published_at`. Statuts inchangés : « À compléter », « À valider », « Publiée ».
- `deployments[]` (une reprise par site) : `interest_at`, `tested_at`, `proven_at`, `deployed_at`, `action_id` (action d’essai du pilote, `origin_type: "Bonne pratique"`, `origin_id` = le déploiement), `local_before`, `local_after`, `local_photo`, `na_reason`, `improvement` (ce que le site a amélioré, affiché sur la fiche d’origine). Étapes inchangées : Candidate, Test, Validée sur autre site, Déployée, Non applicable.
- `opls[]` (non indexée) : `{ id: "OPL-001", site_id, workshop_id, kind: "base"|"securite"|"amelioration"|"probleme", title, station, author, version, status: "brouillon"|"validee", photo_a, photo_b, points[≤ 3], why, minutes, practice_id, validated_by, validated_at, trained[{ name, date, by, version }] }`. Une personne compte comme formée sur la version en vigueur.

## Extension 8.22.0 (additive)

- Aucune collection nouvelle. `lean-library.js` compte 33 fiches (`opl`, `polyvalence`, `kaizen` ajoutées) et 18 situations « J’ai un problème », chacune reliée à une fiche existante par son titre. Les démarches (`toolRuns[]`) sont inchangées.

## Extension 8.23.0 (additive)

- `signals[]` : `ack_due_at` (heure limite de prise en charge : création + 15 min pour Critique, 60 min pour Haute, 240 min sinon), `taken_by`, `stopped` (ça bloque). `taken_at`, `resolution` et `resolved_at` existaient déjà. Le circuit `SIGNAL_STATES` est inchangé.

## Extension 8.24.0 (additive)

- `handovers[]` : `checks` (`securite`, `qualite`, `machines`, `production`, `matiere`, `effectif` → `{ s: "ok"|"watch"|"ko", note }`), `priority_list[]` (trois au plus), `extra`, `ack_note` (question de l’équipe entrante). `situation`, `safety`, `quality`, `production`, `staffing`, `priorities` et `linked_ids` restent remplis pour les écrans existants.

## Extension 8.25.0 (additive)

- `projects[]` :
  - `charter` : `{ problem, scope, team, sponsor }`.
  - `kpi` : `{ label, unit, base, target }`. La cible est plus basse que la référence quand une baisse est recherchée.
  - `steps_done` : `{ cadrer|mesurer|analyser|essayer|standardiser|tenir: "AAAA-MM-JJ" }`. Pour un ancien chantier, il est déduit du statut.
  - `weather` : `[{ at, s: "ok"|"risk"|"block", note, by }]`.
  - `measures` : `[{ date, value, by }]`.
  - `verified` : `{ by, at, text }`.
  - `closed_at`.
- `status` est dérivé de l’étape en cours (« Bloqué » si le dernier point le dit, « Clos » à la clôture). `progress` vaut la part des six étapes faites.

## Extension 8.26.0 (additive)

- `trainingRecords[]` : `session_id` (fiches créées ensemble lors d’une session). Échéance : `expires_at` = date de validation + `validity_months` de la formation. La dernière fiche par personne et par formation fait foi.

## Extension 8.27.0 (additive)

- `roadmapReviews[]` (non indexée) : `{ id: "RV-001", date, by, items[{ kind: "jalon"|"priorite", ref, label, s: "done"|"ok"|"risk"|"late", note, decision, action_id }], learning, next_date, created_at }`. Une action créée en revue porte `origin_type: "Roadmap"` et, pour une priorité, `origin_id` = la priorité.

## Extension 8.28.0 (additive)

- Aucun champ nouveau : `documents[]` de type `BEFORE_AFTER` garde `structured_data.{ before_photo, after_photo, problem, description, gain }` et `kaizen_id`. Une bonne pratique partagée depuis une fiche porte `source_id` = la fiche.

## Extension 8.29.0 (additive)

- `gapReviews[]` (non indexée) : `{ id: "EC-001", site_id, kpi_id, measure_id, decision: "watch", reason, note, by, at, until }`. Une surveillance couvre l’écart jusqu’à `until`, sauf si un nouveau relevé fait apparaître un signal.
- Une action créée depuis un écart porte `kpi_id`, `origin_type: "KPI"`, `origin_id` = l’indicateur et `category: "Performance"`. Un chantier créé depuis un écart porte `kpi_id` et `kpi{ label, unit, base, target }`.

## Extension 8.30.0 (additive)

- `activity[]` : les nouveaux événements portent en plus `person` (nom déclaré sur l’appareil, facultatif) et `role` (profil). Les anciens événements restent lisibles avec `actor`.

## Extension 8.31.0 (additive)

- Aucun champ nouveau. L’état du paramétrage est calculé à partir de `sites`, `workshops`, `users`, `kpis`, `measures` et `settings`.

## Extension 8.32.0 (additive)

- `connectors[].status` : `À spécifier`, `Contrat reçu`, `Test local`, `Import régulier`, `Automatique`.
- `syncLog[]` : `ignored` = nombre de lignes sans valeur ignorées à l’import.

## Extension 8.33.0 (additive)

- `instances[]` (non indexée) : `{ id: "INS-001", type: "comex"|"copil"|"mensuelle"|"hebdo", site_id, title, cadence, time, duration, chair, participants, next_date, last_date }`.
- `instanceSessions[]` (non indexée) : `{ id: "RE-001", instance_id, type, site_id, date, by, present[], notes{ point: texte }, decisions[{ text, decision_id }], action_ids[], counts{}, next_date, created_at }`.
- Une action créée en réunion porte `origin_type: "Réunion"`, `meeting_id` (la séance) et `meeting_series` (l’instance). Une décision attendue tranchée en réunion passe à `status: "Clos"` avec `result`.

## Extension 8.34.0 (additive)

- `topics[]` : `answered_at`, `answered_by` (réponse donnée), `returned_at`, `returned_by` (réponse redite au TOP 5), `carried_by` (escalade qui porte le sujet plus haut).
- `escalations[]` : `origin_level` (niveau qui a remonté), `forum` (« copil » ou « comex » au niveau 4), `path[{ from, to, at, by }]`, `answered_at`, `answered_by`, `answer_level`, `returned_at`, `returned_by`. Une réponse met l’escalade « En cours » ; elle est « Clos » quand la réponse a été redite au niveau d’origine.
- `instances[]` : type `top15` (un par site), cadence « Chaque jour ouvré ».

## Extension 8.35.0 (additive)

- `mlLines[]` : `{ id (LG-…), site_id, workshop_id, name, machine_id, threshold_min, typical_min, opening_min, target_min, causes[], archived_at }`.
- `microStops[]` : `{ id, line_id, site_id, at, cause, dur_s (null si compté), timed, by }`. Les comptages de plus de 120 jours sont retirés à l’écriture.
- Points de TRS perdus = minutes perdues par jour suivi ÷ temps d’ouverture × 100. Un arrêt compté vaut la durée type de la ligne.

## Extension 8.36.0 (additive)

- `trsShifts[]` : `{ id (FP-…), line_id, site_id, workshop_id, date, team, shift_min, planned_min, stops[{ kind, min, note, ref? }], micro_n, micro_min, good, scrap, rate_ph, by }`. Une feuille par ligne, jour et équipe.
- `mlLines[]` : `rate_ph` (cadence théorique, pièces par heure) et `shift_min` (durée d’un poste).
- `measures[]` : un relevé TRS par site et par jour, de source « Feuilles de poste », recalculé à chaque feuille. Un relevé d’une autre source n’est jamais remplacé.

## Extension 8.37.0 (additive)

- `gains[]` : `family` (fin, prod, qual, delai, secu, env, humain), `nature` (reel, evite, capacite), `before`, `target`, `after`, `direction`, `unit`, `recurring`, `per_year`, `euro_rate`, `cost`, `start_date`, `status` (Estimé, À valider, Validé, Refusé), `evidence`, `validated_by`, `validated_at`, `checks[{ months, at, after, held }]`. `quantity` et `period` restent tenus pour l’ancien registre.
- `gainTargets[]` : `{ scope (site ou group), euros }`.
- `envMonths[]` : `{ site_id, month, prod_qty, elec_kwh, gas_kwh, water_m3, waste_t, waste_valo_t, haz_t, note }`.
- `envEvents[]` : `{ site_id, date, kind, severity, text, immediate, action_id }`.
- `envDuties[]` : `{ site_id, name, every_months, last_date, owner }`.
- `envSites[]` : `{ site_id, prod_unit, f_elec, f_gas, ref{}, target{}, cut_pct }`.

## Extension 8.38.0 (additive)

- `orders[]` : `{ no, site_id, client, article, designation, quantity, line, prod_date, lot, due_date, delivered }`, importées de l’ERP.
- `ncs[]` : `{ id (NC-…), site_id, date, order_no, client, article, designation, lot, line, prod_date, origin, defect, qty, severity, text, containment, decision (8D, QRQC, Action), problem_id, action_id, status (Ouverte, En analyse, Close) }`.
- `problems[]` : `nc_id` et `nc_article` pour un dossier ouvert depuis une non-conformité ; `pareto` est prérempli avec les défauts de l’article.

## Extension 8.39.0 (additive)

- `ncs[]`, réclamation client : `claim_ref`, `claim_date`, `returned_qty`, `returned_at`, `cost` (€), `claim_decision` (À décider, Retouche, Rebut, Remplacement, Accepté en l’état, Avoir).
- Jalons : `ack_at`, `cause_at` et `close8d_at`, les dates auxquelles chaque jalon a été fait.

## Extension 8.40.0 (additive)

- `samples[]` : `{ id (ECH-…), scope (group ou site), site_id, client, articles, defect, zone, criterion, tol_max, tol_unit, over, distance_m, lux, seconds, location, photos{ ok, limit, nok }, status (Brouillon, Validée), validated_by, validated_at, review_months, version }`.

## Extension 8.40.1 (additive)

Aucun changement de données en 8.40.1.

## Extension 8.41.0 (additive)

Aucune nouvelle donnée en 8.41 : la tour lit les collections existantes.

## Extension 8.42.0 (additive)

Aucune nouvelle donnée. La clé locale `bia-news-seen` retient la dernière nouveauté vue sur l’appareil.

## Extension 8.43.0 (additive)

Nouvelle collection `infos[]` : `{ id, site_id ("group" | site), workshop_id, title, why, text, from, start, end, relayed[{ site_id, workshop_id, at, by }], created_at, archived_at }`. `meetings[]` reçoit `kind: "top5"`, `letters`, `notes { S, Q, C, D, P, free }`, `raised[]`, `infos[]` et `answers[]`. Le brouillon du point est gardé sur l’appareil (`bia-t5-<site>-<atelier>-<date>`).

## Extension 8.44.0 (additive)

`infos[]` reçoit `urgent`, `photo` et `questions[{ id, site_id, workshop_id, text, at, by, answer, answered_at, answered_by, returned_at, returned_by }]`. `meetings[]` (TOP 5) reçoit `questions[]`.

## Extension 8.45.0 (additive)

Aucune nouvelle donnée.

## Extension 8.45.1 (additive)

Aucune nouvelle donnée.

## Extension 8.46.0 (additive)

`boards[]` : {id, site_id, workshop_id, name, slot, weekday, messages, rows[{id, axis, label, kind (num, text, poles, pair), unit, better, kpi, toKpi}]}. `boardWeeks[]` : {id, board_id, site_id, workshop_id, week (lundi), values, messages[], a3, by, at}. Actions issues du panneau : origin_type « TOP 5 », board_id, pilot, board_status (qualifier, cours, resolu, bloque). Mesures : entry_mode « panneau », board_id. `meta.demo_revision` 5.
