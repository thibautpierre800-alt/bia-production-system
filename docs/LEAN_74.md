# Les huit évolutions — version 7.4.0

Les parcours de la version 7.3.0 restent disponibles. Les nouvelles données sont ajoutées au schéma 7 et à la même clé de stockage : aucune remise à zéro, aucun remplacement automatique du scénario existant.

| Évolution | Où l’utiliser | Fonctionnement et limite |
|---|---|---|
| Escalade N1 → N4 | Aujourd’hui ; Administration → Règles | Actions en retard et signaux non repris par une action. Un niveau à la fois, sans doublon. L’option automatique, désactivée initialement, contrôle à l’ouverture/navigation et toutes les minutes pour les managers. Pas de traitement lorsque l’application est fermée. |
| VSM actualisée | Documents → VSM → Observations et avant / après | Figer l’avant, télécharger le contrat CSV, prévisualiser puis confirmer un relevé. Les données actuelles changent ; le futur et la référence avant sont conservés. Pas de collecte ERP/MES automatique ni simulation complète. |
| Efficacité J30/J60/J90 | Actions → ouvrir → suivi durable ; Aujourd’hui ; Alertes | Date réelle de mise en œuvre, responsable et critère. Une cible numérique reste facultative. Un contrôle exige une preuve et un vérificateur ; une conclusion inefficace rouvre l’action. Historique des recontrôles conservé. |
| Action → standard → formation → compétence | Action → Relier standard et personnes → Former / évaluer | Formation enregistrée dans le catalogue/grilles/dossier individuel existants, liée à l’action, au standard et à sa version. Niveau autonome ≥ 3, validation, preuve et validité exigés. Une version modifiée doit être réévaluée. Une action avec un parcours configuré ne peut plus être clôturée tant qu’il est incomplet. Les anciennes actions sans parcours ne sont pas invalidées rétroactivement. |
| Vue multisite | Pilotage → Analyser | Six sites opérationnels sous BIA Holding, KPI sélectionnable et daté, tendance, maturité et couverture des dix piliers, retards et contrôles à faire. C’est une carte de synthèse, pas une carte géographique. Les inconnues ne deviennent pas des zéros. |
| Réplication | Bonne pratique publiée → Répliquer vers plusieurs sites | Le Responsable Lean sélectionne les destinataires ; un dossier « Candidate » est créé par site, sans recopier les preuves du pilote comme résultats locaux. Les dossiers existants sont conservés. Test, preuve, résultat et validation locaux restent requis. Standard local facultatif, à publier s’il est renseigné. |
| Assistant d’analyse | Action, signal, problème, Kaizen ou bonne pratique | Questions de cadrage locales ; contexte consultable et copiable. Raccordement à un serveur IA facultatif. Aucun modèle n’est activé ou facturé par cette livraison ; aucune décision ni action n’est créée par l’assistant. |
| Environnement et gaspillages | Pilotage → Analyser → Énergie, déchets et CO₂ | Quantités sourcées par période/périmètre, pièces bonnes, gaspillage et dossier lié. Intensités énergie/déchets/CO₂ calculées ; publication explicite dans les KPI une fois les définitions et seuils configurés. Aucune estimation carbone inventée ni somme de ratios entre sites. |

## Contrat VSM

CSV UTF-8, maximum 1 Mo et 500 lignes. Colonnes : `node_id,period,source,ct,va,uptime,wip,wait,changeover,operators`. Les trois premières sont obligatoires ; au moins une mesure par objet est nécessaire. Les champs vides ne changent pas la valeur existante. Le modèle téléchargeable utilise les identifiants réels de la VSM ouverte.

Un import porte sur une seule date et une seule source ; objets inconnus, doublons, dates futures/invalides, disponibilité > 100 et VA > cycle sont refusés. Les imports antérieurs à la dernière observation ne remplacent pas les valeurs actuelles. L’import conserve la photographie précédente et ne modifie pas le futur envisagé. Point et virgule décimale sont acceptés ; pour une virgule décimale, exporter avec le séparateur point-virgule ou des champs CSV entre guillemets.

Les calculs restent ceux d’un flux séquentiel. Le lead time = cycles + attentes ; la capacité est théorique, sans déduction automatique des changements de série ou rebuts. Modifier la demande ou le temps net se fait dans les métadonnées de la VSM.

## Contrat IA facultatif

Administration → Règles accepte une URL HTTPS de serveur autorisé, sans paramètres, identifiant ni secret. Les clés fournisseur restent exclusivement sur ce serveur. Aucun endpoint ni abonnement n’est fourni ou activé.

Le navigateur envoie, uniquement après consentement explicite dans le dossier, un POST JSON `bia-lean-assistant/v1`. Le corps contient le dossier sélectionné (faits/résultat), son KPI et au plus douze relations visibles. Pas de photo, registre RH ou sauvegarde complète ; les textes libres peuvent néanmoins contenir des informations sensibles et sont intégralement consultables avant envoi. Le serveur doit appliquer sa propre authentification/autorisation, filtrer les données, limiter taille/débit/coûts et autoriser l’origine Pages par CORS. La livraison statique n’offre pas d’identité authentifiée et ne doit pas servir de contrôle d’accès au serveur.

Réponse attendue : `{"answer":"Analyse en français..."}`. Délai maximal 30 secondes ; réponse textuelle limitée à 20 000 caractères, insérée comme texte, jamais exécutée comme HTML. Les secrets ne sont jamais demandés au navigateur. Aucun résultat n’est écrit dans le dossier métier, même après réponse réussie. Les tests utilisent un serveur simulé, pas un modèle réel.

## Données nouvelles

- `actions.sustainment` : date de mise en œuvre, responsable, critère, référence/cible/unité/sens facultatifs et historique `checks` (jalon, date, résultat, preuve, vérificateur, réaction).
- `actions.standard_id`, `training_id`, `standard_version`, `required_person_ids` : parcours de transmission.
- `trainingRecords.action_id`, `standard_id`, `standard_version`, `site_id` : qualification inscrite dans les grilles existantes.
- `documents.vsm.baseline`, `observations` et `current.observed_at` : avant figé et historique des actualisations.
- `environmentLogs` : quantités physiques et pièces bonnes, dates de période, source et dossier lié.
- `measures.source_id`, `period_start`, `numerator`, `denominator`, `entry_mode: calculated` : provenance du KPI calculé. Une correction du relevé republié garde le même identifiant de mesure. Le retrait d’une quantité retire sa valeur dérivée, pas son historique.
- `settings.autoEscalation`, `assistantEndpoint` : options explicites, inactives initialement.

Les droits restent fonctionnels et locaux. Les données enregistrées dans chaque navigateur ne sont pas envoyées à GitHub pendant le déploiement du code. Sauvegarder les données via Compte avant un changement de navigateur ou de machine.
