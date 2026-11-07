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
