# Connecteurs — contrat disponible, connexions non activées

## Fonctionnement actuel

Le CSV passe par prévisualisation et confirmation. Toutes les lignes sont validées avant écriture atomique ; une erreur empêche l’import entier. Guillemets, séparateurs virgule/point-virgule, accents UTF-8, décimales françaises et champs multilignes sont traités. Limite : 3 Mo. Les doublons site/atelier/KPI/date sont refusés ; une correction passe par le relevé existant et conserve anciennes/nouvelles valeurs dans le journal.

Excel peut exporter un CSV UTF-8 compatible. La lecture native `.xlsx` n’est pas incluse. L’écran Connecteurs enregistre la configuration nécessaire sans prétendre qu’elle reçoit déjà des données.

## Contrat BIA version 1

`connectors/measure.schema.json` décrit **le format d’entrée BIA**, pas une API SEQUOIA supposée.

| Champ | Règle |
|---|---|
| `site_id` | Identifiant d’un site actif BIA |
| `workshop_id` | Facultatif ; atelier du site. Vide signifie site entier |
| `code` | Code du dictionnaire, par exemple `trs` |
| `period` | Date réelle `AAAA-MM-JJ`, non future |
| `value` | Nombre positif ou nul ; pourcentage entre 0 et 100 |
| `target` | Facultatif ; sinon cible du dictionnaire |
| `definition` | Périmètre et conventions de calcul utilisés |
| `source` | Export, extraction ou relevé d’origine |

La saisie porte `manual`, le scénario `demo`, le CSV `import`. Une ancienne source déclarée automatique reste `legacy-unverified`, jamais promue en flux vérifié.

## Mock exécutable

`connectors/adapter.cjs` expose `read({from,to})` et le sérialiseur CSV. Le mock renvoie un relevé fictif marqué « aucune connexion » :

```bash
node connectors/adapter.cjs 2026-09-01 > mock-mesures.csv
```

Importer dans un espace de démonstration. Le test d’intégration fait passer sa sortie dans le même validateur que l’écran. Aucune requête réseau ou identité SEQUOIA n’est simulée comme réelle.

## Intégration réelle

Il manque le contrat éditeur : extraction autorisée, documentation/version, droits de lecture, échantillon, identifiants des sites/ateliers, unités, numérateurs/dénominateurs, fuseau horaire, fréquence, limites et règles de correction.

Ensuite : implémenter l’adaptateur côté serveur, conserver les secrets côté serveur, tester le mapping en environnement d’essai, comparer à un export validé, puis activer collecte et journal de rejets/reprises. Un service planifié et une base partagée sont nécessaires pour importer navigateurs fermés. Aucune URL d’API, requête SQL ou clé fournisseur n’a été inventée.
