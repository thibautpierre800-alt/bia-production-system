"use strict";
/*
 * BIA Lean OS 8.22 · Bibliothèque : chaque fiche guide mène à son outil.
 *  - La fiche se lit au téléphone : à quoi ça sert, quand, la séquence, les pièges, ce qu'on obtient.
 *  - « Dans l'appli » : les boutons qui ouvrent l'outil refait (5S, SMED, TPM, VSM pas à pas, Yamazumi, Ishikawa,
 *    audit 50 critères, Gemba, SQCDP, idées, OPL, polyvalence, bonnes pratiques…), selon le profil.
 *  - « J'ai un problème » : les 18 situations, chacune avec son premier geste, sa fiche et son outil.
 *  - La démarche suivie (checklist enregistrée par site) reste disponible sous la fiche.
 * Aucune donnée nouvelle : fiches dans lean-library.js, démarches dans toolRuns[] (inchangé).
 */

/* Les outils de l'appli, ouverts depuis une fiche. view : écran qu'il faut avoir ; write : création. */
const LIB_GO = {
  gemba: { label: "Commencer un Gemba", short: "Gemba", hint: "Photo d’abord, notes classées, compte rendu", view: "terrain", write: true, run: () => gembaForm() },
  etonnement: { label: "Ouvrir le rapport d’étonnement", short: "Rapport d’étonnement", hint: "Les constats des Gemba regroupés par thème", view: "terrain", run: () => { state.terrainTab = "etonnement"; switchView("terrain"); } },
  audit50: { label: "Démarrer l’audit 50 critères", short: "Audit 50 critères", hint: "Un domaine par étape, une preuve par critère, le radar", view: "audits", write: true, run: () => auditForm() },
  fives: { label: "Ouvrir le 5S", short: "5S", hint: "Zones, photo de référence, audit au téléphone, étiquettes rouges", view: "audits", run: () => csGo() },
  sqcdp: { label: "Ouvrir le point du jour SQCDP", short: "SQCDP", hint: "Vert ou écart par lettre, TOP 15, escalades", view: "sqcdp", run: () => switchView("sqcdp") },
  pilotage: { label: "Ouvrir le pilotage", short: "Pilotage", hint: "Indicateurs des sites, écarts, décisions", view: "pilotage", run: () => switchView("pilotage") },
  maturity: { label: "Voir la maturité des sites", short: "Maturité", hint: "La trajectoire de chaque site", view: "maturity", run: () => switchView("maturity") },
  hoshin: { label: "Ouvrir le Hoshin", short: "Hoshin", hint: "Objectifs, priorités des sites, revues", view: "hoshin", run: () => switchView("hoshin") },
  roadmap: { label: "Ouvrir la Roadmap", short: "Roadmap", hint: "Les vagues de déploiement et leurs jalons", view: "roadmap", run: () => switchView("roadmap") },
  problem: { label: "Démarrer un A3, 8D ou QRQC", short: "A3 · 8D · QRQC", hint: "Le bon modèle selon le problème, rempli dans les cases", view: "resolution", write: true, run: () => genericProblemForm() },
  ishikawa: { label: "Faire un Ishikawa", short: "Ishikawa", hint: "Causes en post-it, chacune vérifiée par un fait", view: "documents", write: true, run: () => simpleDocument("ISHIKAWA") },
  why: { label: "Faire un 5 pourquoi", short: "5 pourquoi", hint: "Arbre des pourquoi, réponses vérifiées", view: "documents", write: true, run: () => simpleDocument("5WHY") },
  vsm: { label: "Créer une VSM pas à pas", short: "VSM", hint: "Étapes, stocks en jours, carte et échelle de temps", view: "documents", write: true, run: () => simpleDocument("VSM") },
  balance: { label: "Ouvrir l’équilibrage (Yamazumi)", short: "Yamazumi", hint: "Temps par poste face au takt, goulot, rééquilibrage", view: "projects", run: () => { state.projectsTab = "equilibrage"; switchView("projects"); } },
  smed: { label: "Ouvrir le SMED", short: "SMED", hint: "Chrono au téléphone, interne et externe, gain mesuré", view: "projects", run: () => smGo() },
  tpm: { label: "Ouvrir la TPM", short: "TPM", hint: "Étiquettes machine, tournées CIL, pannes, MTBF et MTTR", view: "terrain", run: () => tmGo() },
  standard: { label: "Rédiger un standard de poste", short: "Standard de poste", hint: "Étapes en photo, points clés et leur raison", view: "documents", write: true, run: () => simpleDocument("STANDARD") },
  opl: { label: "Créer une leçon ponctuelle (OPL)", short: "OPL", hint: "Deux photos, trois points clés, personnes formées", view: "training", write: true, run: () => olNew() },
  opls: { label: "Voir les OPL", short: "OPL", hint: "Les leçons en vigueur et qui est formé", view: "training", run: () => { state.oplOn = true; state.pvOn = false; switchView("training"); } },
  polyvalence: { label: "Ouvrir la polyvalence", short: "Polyvalence", hint: "Matrice I-L-U-O, postes fragiles, qui former", view: "training", run: () => { state.pvOn = true; state.oplOn = false; switchView("training"); } },
  idea: { label: "Proposer une idée", short: "Idées", hint: "Une photo, une phrase, une réponse sous 48 heures", view: "kaizen", write: true, run: () => idQuick() },
  ideas: { label: "Voir les idées et Kaizen", short: "Idées", hint: "À répondre, en cours, mur des réalisations", view: "kaizen", run: () => { state.idTab = "idees"; switchView("kaizen"); } },
  practices: { label: "Ouvrir les bonnes pratiques", short: "Bonnes pratiques", hint: "Le catalogue des sites, la reprise par chaque site", view: "practices", run: () => switchView("practices") },
  deployment: { label: "Voir le déploiement entre sites", short: "Déploiement", hint: "Pratiques × sites : qui avance, qui attend", view: "deployment", run: () => switchView("deployment") },
  projects: { label: "Ouvrir les chantiers", short: "Chantiers", hint: "Chantiers, jalons et résultats", view: "projects", run: () => { state.projectsTab = "projects"; switchView("projects"); } },
  actions: { label: "Ouvrir le plan d’actions", short: "Plan d’actions", hint: "À traiter, revue de la semaine", view: "actions", run: () => switchView("actions") },
  documents: { label: "Ouvrir les modèles", short: "Modèles", hint: "A3, 8D, QRQC, standard, avant / après…", view: "documents", run: () => { state.documentTab = "models"; switchView("documents"); } },
};
/* Fiche → outils, du plus utile au moins utile. Une fiche sans outil reste un guide de méthode. */
const LIB_MAP = {
  "audit-terrain": ["audit50"], "diagnostic-360": ["audit50", "gemba", "maturity"], "gemba-60": ["gemba", "etonnement"], "lean-system": ["sqcdp", "pilotage", "actions"],
  sqcdp: ["sqcdp"], obeya: ["pilotage", "hoshin"], kpi: ["pilotage"], "problem-solving": ["problem", "ishikawa", "why"], vsm: ["vsm"], bottleneck: ["balance"],
  "five-s": ["fives"], "standard-work": ["standard", "opl", "polyvalence"], opl: ["opl", "opls"], polyvalence: ["polyvalence"], smed: ["smed"], tpm: ["tpm", "opl"],
  quality: ["problem", "ishikawa", "why"], kaizen: ["idea", "ideas"], industrialization: ["projects", "balance", "standard"], multisite: ["practices", "deployment"],
  benchmark: ["pilotage", "practices"], governance: ["hoshin", "roadmap"], transverse: ["practices", "ideas"], change: ["ideas", "opl"], roadmap: ["roadmap"],
  models: ["documents"], questions: ["gemba"], direction: ["pilotage", "hoshin"], "bia-evidence": ["etonnement", "gemba"],
};

function libGoOk(key) { const g = LIB_GO[key]; return !!g && role().nav.includes(g.view) && (!g.write || !role().readonly); }
function libGoes(id) { return (LIB_MAP[id] || []).filter(libGoOk); }
function libRouteTool(r) { return LEAN_MODULES.find((t) => t.title === r[2]); }
function libChooser() {
  return `<ol class="lib-routes">${LEAN_ROUTES.map((r) => { const t = libRouteTool(r), go = t ? libGoes(t.id)[0] : null;
    return `<li><button type="button" class="lib-route" data-route-tool="${esc(r[0])}"><b>${esc(r[1])}</b><span>${esc(r[3])}</span><small>Fiche : ${esc(r[2])}${go ? ` · outil : ${esc(LIB_GO[go].short)}` : ""}</small></button></li>`; }).join("")}</ol>`;
}
function libGoBlock(tool) {
  if (["start", "decision-tree"].includes(tool.id)) return `<section class="lib-go"><h2>J’ai un problème : par où commencer ?</h2><p class="hint">Partez de ce que vous voyez. Chaque situation donne le premier geste, la fiche et l’outil.</p>${libChooser()}</section>`;
  const goes = libGoes(tool.id);
  if (!goes.length) return `<section class="lib-go quiet"><h2>Dans l’appli</h2><p>${(LIB_MAP[tool.id] || []).length ? "Les outils de cette fiche ne sont pas ouverts à votre profil." : "Cette fiche est un guide de méthode : pas d’écran dédié. Suivez la démarche plus bas pour garder la trace de l’avancement."}</p></section>`;
  return `<section class="lib-go"><h2>Dans l’appli</h2><div class="lib-go-list">${goes.map((k, i) => `<button type="button" class="lib-go-btn ${i ? "" : "main"}" data-lib-go="${k}"><b>${esc(LIB_GO[k].label)}</b><span>${esc(LIB_GO[k].hint)}</span></button>`).join("")}</div></section>`;
}
function libDetail(tool) {
  const site = state.site === "group" ? "marzin" : state.site, siteName = getSiteName(site), run = (data.toolRuns || []).find((r) => r.module_id === tool.id && r.site_id === site);
  const done = new Set(run?.checks || []), pct = Math.round((done.size / Math.max(1, tool.checklist.length)) * 100), nextIndex = tool.checklist.findIndex((_, i) => !done.has(i));
  const nextItem = nextIndex >= 0 ? tool.checklist[nextIndex] : "Démarche terminée : vérifier le résultat et décider de la standardisation.";
  const journey = run ? `<section class="panel section journey-next" id="toolChecklist"><div class="section-title"><div><p class="eyebrow">${esc(run.id)} · ${esc(run.status)} · ${esc(siteName)}</p><h2>${run.status === "Terminé" ? "Démarche terminée" : "À faire maintenant"}</h2></div><span class="badge">${pct} %</span></div><p class="journey-next-action">${nextIndex >= 0 ? `${nextIndex + 1}. ` : ""}${esc(nextItem)}</p><p class="hint">Responsable : ${esc(run.owner || "À attribuer")} <button class="btn ghost small" data-edit-run="${run.id}">Attribuer / modifier</button></p><div class="progress"><span style="width:${pct}%"></span></div><div class="check-list section">${tool.checklist.map((x, i) => `<label class="check"><input type="checkbox" data-tool-check="${i}" data-module="${tool.id}" ${done.has(i) ? "checked" : ""}> ${esc(x)}</label>`).join("")}</div></section>`
    : `<section class="panel section lib-journey"><h2>Suivre la démarche</h2><p class="hint">Une checklist de ${tool.checklist.length} points, enregistrée pour ${esc(siteName)} dans Bibliothèque → Mes démarches.</p><ul class="lib-check">${tool.checklist.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${role().readonly ? "" : `<button class="btn secondary" data-start-tool="${tool.id}">Suivre la démarche sur ${esc(siteName)}</button>`}</section>`;
  return `<div class="lib-top"><button class="btn ghost small" data-back-tools>← Bibliothèque</button></div>
    <header class="lib-head"><p class="eyebrow">${esc(tool.no)} · ${esc(tool.category)}</p><h1>${esc(tool.title)}</h1><p class="lead">${esc(tool.objective)}</p><p class="lib-when"><b>Quand :</b> ${esc(tool.when)}</p></header>
    ${libGoBlock(tool)}
    <div class="lib-grid section"><section class="panel"><h2>La séquence</h2><ol class="lib-steps">${tool.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section>
      <section class="panel"><h2>Pièges à éviter</h2><ul class="lib-pits">${tool.pitfalls.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2 class="section">Ce qu’on obtient</h2><ul class="lib-deliv">${tool.deliverables.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section></div>
    ${journey}
    <div class="lib-tools section">${role().readonly ? "" : `<button class="btn ghost" data-tool-action="${tool.id}">Créer une action</button>`}<button class="btn ghost" data-print>Imprimer la fiche</button></div>`;
}

/* ---------- Branchements ---------- */

const libRenderToolsBase = renderTools;
renderTools = function () {
  if (typeof LEAN_MODULES === "undefined") return libRenderToolsBase.apply(this, arguments);
  if (state.toolId) { const tool = LEAN_MODULES.find((x) => x.id === state.toolId); if (tool) return libDetail(tool); }
  const html = libRenderToolsBase.apply(this, arguments), tpl = document.createElement("template");
  tpl.innerHTML = html.replace("30 outils Lean et industriels", `${LEAN_MODULES.length} fiches Lean et industrielles`).replace("Choisissez un outil, lancez la pratique ou suivez une checklist terrain.", "Chaque fiche explique la méthode et ouvre l’outil de l’appli qui va avec.").replace("Ouvrez un outil ci-dessous puis cliquez sur « Démarrer ».", "Ouvrez une fiche ci-dessous, puis « Suivre la démarche » pour garder la trace de l’avancement.");
  const routes = tpl.content.querySelector("[data-route-tool]")?.closest("section");
  if (routes) routes.innerHTML = `<div class="section-title"><h2>J’ai un problème</h2><span class="badge">${LEAN_ROUTES.length} situations</span></div>${libChooser()}`;
  tpl.content.querySelectorAll(".document-card[data-open-tool]").forEach((card) => {
    const goes = libGoes(card.dataset.openTool), tag = card.querySelector(".btn.secondary");
    if (tag) tag.textContent = goes.length ? `Ouvre : ${[...new Set(goes.map((k) => LIB_GO[k].short))].slice(0, 2).join(", ")} →` : "Lire la fiche →";
  });
  return tpl.innerHTML;
};
/* Les boutons d’outil sont dans la fiche : plus de bandeau au-dessus. */
toolLaunch = function () { return ""; };
function libBind(root = document) {
  root.querySelectorAll("[data-lib-go]").forEach((b) => (b.onclick = () => { const g = LIB_GO[b.dataset.libGo]; if (g && libGoOk(b.dataset.libGo)) g.run(); }));
}
const libOsBindBase = osBind;
osBind = function () { const out = libOsBindBase.apply(this, arguments); libBind(document); return out; };
