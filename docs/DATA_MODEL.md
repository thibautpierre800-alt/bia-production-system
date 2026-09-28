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
