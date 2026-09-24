# BIA Production System 6.6.0

Application web de management visuel et d'amélioration continue. Le référentiel comprend BIA Holding et six entités : Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline et Sodeplax.

## Parcours

- Accueil adapté au périmètre, recherche des dossiers et reprise des brouillons.
- Pilotage Groupe/Site : benchmark des six sites sur une période identique et cinq indicateurs, sources et définitions visibles, données absentes explicites, relevés manuels datés et graphiques de détail. Aucune moyenne Groupe artificielle ni classement non qualifié.
- SQCDP Atelier S/Q/C/D/P avec TOP 15, sujets du jour, liens aux signaux, actions et décisions, et mode écran atelier.
- Signal Terrain : saisie courte, photo facultative, prise en compte, résolution, vérification et clôture. Les actions et problèmes créés depuis le signal conservent le lien d'origine.
- Gemba : visite avec plusieurs constats, parole de l'équipe, suite par constat, action/signal/A3/8D/QRQC liés et retour terrain avant clôture.
- Audit Terrain : 50 critères répartis en 10 domaines, notes et preuves enregistrées en brouillon, résultat et actions issues des domaines en écart.
- Résolution : A3, 8D et QRQC guidés rubrique par rubrique avec schémas d'ensemble, enregistrement automatique et impression. Les actions créées dans le dossier rejoignent le plan général.
- Documents : fiches Avant/Après avec deux photos, VSM état actuel/futur avec relevés et calculs conditionnés aux données, 5 Pourquoi, Ishikawa, 5S, standards et autres trames.
- Bibliothèque : 30 guides avec démarches retrouvables, checklist et responsable attribuable ; raccourcis vers les outils applicatifs correspondants.
- Formation : contenu pédagogique, parcours VSL, suivi nominatif, compétences, validité, preuves et fiches individuelles imprimables pour validation RH.
- Roadmap, chantiers d'amélioration, bonnes pratiques et export/restauration JSON.

Les premières données sont fictives et identifiées comme telles. Les données saisies sont conservées **uniquement sur l'appareil et le navigateur utilisés**. Les profils sont des vues de démonstration : ils ne constituent pas une authentification ou un contrôle d'accès à des données RH. Les fiches RH nécessitent la validation réelle des personnes et du processus documentaire du Groupe. SEQUOIA n'est pas connecté ; ses possibilités techniques restent à vérifier. Exporter régulièrement les données depuis Compte.

## Développement et vérification

Node.js 24 ou plus récent :

```bash
npm ci
npm test
python3 -m http.server 8080
```

Ouvrir ensuite `http://localhost:8080`. L'ancien point d'entrée `node tests/regression.cjs` lance la même suite DOM.

`index.html` charge `lean-library.js`, `v5.js` (référentiels et écrans historiques), `experience.js` (persistance et navigation), `workflows.js`, `fieldwork.js`, `documents-ui.js`, `dashboards.js` et `boot.js`. `v5.css` et `experience.css` définissent l'interface. Le service worker met en cache ces fichiers pour la PWA. `supabase/schema.sql` reste une piste de travail non utilisée par l'application publiée.
