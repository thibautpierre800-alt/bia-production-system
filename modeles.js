"use strict";

// 8.6 · Résoudre : A3, PDCA, 8D, DMAIC et QRQC au format de leurs modèles de référence.
// Mêmes rubriques, mêmes données (DOCUMENT_SCHEMAS) : seule la mise en page change.
// 8.7 · On écrit directement dans les cases du modèle, dès la création ; le formulaire question par question
// reste disponible (« Mode guidé »). Chaque outil dit quand et pourquoi l’utiliser.

const MD_TYPES = ["QRQC", "PDCA", "A3", "8D", "DMAIC"];
const MD_NAMES = {
  A3: "A3 · Résolution de problème",
  PDCA: "PDCA · Roue de Deming",
  "8D": "8D · Rapport de résolution",
  DMAIC: "DMAIC · Amélioration Six Sigma",
  QRQC: "QRQC · Réaction qualité rapide",
};
const MD_WHEN = {
  QRQC: "Réagir vite à un défaut : sécuriser dans l’heure, analyser, vérifier au poste.",
  PDCA: "Tester une idée simple : planifier, essayer, mesurer, standardiser.",
  A3: "Comprendre et traiter un problème récurrent, sur une seule feuille.",
  "8D": "Problème client : contenir, supprimer l’apparition et la non-détection.",
  DMAIC: "Problème complexe et chiffré : données, causes testées, résultat tenu.",
};
// Pourquoi tel ou tel outil : quand l’utiliser, ce qu’il apporte, sa durée, qui l’anime, et la suite.
const MD_GUIDE = {
  QRQC: {
    signal: "Un défaut vient d’apparaître au poste",
    when: "Un défaut, une réclamation ou un arrêt vient d’apparaître au poste.",
    why: "Réagir dans l’heure sur des faits frais (la pièce, le poste, les personnes), protéger le client, puis chercher la cause tant que les preuves sont là.",
    short: "Protéger le client tout de suite, sur des faits frais.",
    time: "De l’heure à quelques jours",
    who: "Chef d’équipe et opérateurs, au poste",
    next: "Cause non trouvée ou défaut qui revient : passer en A3 (ou en 8D si le client est touché).",
  },
  PDCA: {
    signal: "Une idée ou une cause probable à tester",
    when: "Une idée d’amélioration ou une cause probable à vérifier, sur un périmètre simple.",
    why: "Tester en petit et vite, mesurer avant de généraliser, et faire du résultat un standard. C’est la boucle de base de toute amélioration.",
    short: "Tester petit, mesurer, puis standardiser.",
    time: "Quelques jours à quelques semaines",
    who: "L’équipe du poste ou de l’atelier",
    next: "Le test ne suffit pas ou la cause reste floue : passer en A3.",
  },
  A3: {
    signal: "Un problème qui revient, cause inconnue",
    when: "Un problème récurrent qui pèse sur la performance (rebut, TRS, délai) et dont la cause n’est pas évidente.",
    why: "Tout le raisonnement tient sur une feuille : faits, objectif, cause prouvée, contre-mesures, résultats. On aligne l’équipe et on décide avec la direction sur la même page.",
    short: "Tout le raisonnement sur une feuille, pour aligner et décider.",
    time: "2 à 8 semaines",
    who: "Un pilote et une petite équipe transverse, validé par le responsable",
    next: "Beaucoup de variabilité et de données à exploiter : passer en DMAIC.",
  },
  "8D": {
    signal: "Le client est touché",
    when: "Une réclamation client ou fournisseur, ou un défaut qui est sorti de l’usine.",
    why: "C’est le format attendu par les clients. Il impose de contenir d’abord (D3), de trouver la cause d’apparition et la cause de non-détection (D4), puis d’empêcher la récurrence (D7).",
    short: "Le format client : contenir, apparition et non-détection.",
    time: "Contenir sous 24 à 48 h, clore en 30 à 60 jours",
    who: "Une équipe pluridisciplinaire, pilotée par la qualité",
    next: "Partager la leçon avec les autres sites (D7) et mettre à jour les standards.",
  },
  DMAIC: {
    signal: "Complexe, variable, chiffré",
    when: "Un problème complexe et chiffré, avec beaucoup de variabilité, que les méthodes simples n’ont pas résolu.",
    why: "La démarche Six Sigma fiabilise la mesure, teste les causes sur des données et tient le gain par un plan de contrôle.",
    short: "Données et statistiques, quand les méthodes simples ne suffisent pas.",
    time: "3 à 6 mois",
    who: "Un projet piloté par un Green Belt ou un Black Belt",
    next: "Gain tenu : intégrer le plan de contrôle au standard et au suivi des indicateurs.",
  },
};
// Les outils d’analyse qui servent dans ces modèles.
const MD_TOOLS = [
  ["5W2H", "Décrire le problème par les faits, sans supposer la cause.", "Au départ : QRQC, 8D (D2), A3 (situation actuelle)."],
  ["Pareto", "Concentrer l’effort sur les quelques causes qui font l’essentiel des pertes (règle des 80/20).", "Quand plusieurs types de défauts ou d’arrêts sont comptés."],
  ["Ishikawa (5M)", "Lister en équipe toutes les causes possibles, famille par famille, sans en oublier.", "Avant de tester les causes : A3 (analyse), 8D (D4), DMAIC (Analyser)."],
  ["5 pourquoi", "Remonter d’un fait à une cause sur laquelle on peut agir.", "Sur une cause précise, après l’Ishikawa, ou directement si le problème est simple."],
];
const MD_5W_LABEL = { quoi: "Quoi", qui: "Qui", ou: "Où", quand: "Quand", comment: "Comment", combien: "Combien", pourquoi: "Pourquoi est-ce un problème" };
// Format de page à l’impression (le papier, A3 ou A4, reste au choix de l’imprimante).
const MD_PAGE = { A3: "landscape", PDCA: "landscape", DMAIC: "landscape", "8D": "portrait", QRQC: "portrait" };
const MD_5W2H = [
  ["quoi", "Quoi ?"],
  ["qui", "Qui ?"],
  ["ou", "Où ?"],
  ["quand", "Quand ?"],
  ["comment", "Comment ?"],
  ["combien", "Combien ?"],
  ["pourquoi", "Pourquoi est-ce un problème ?"],
];
const MD_5W2H_TEMPLATE = "Quoi : \nQui : \nOù : \nQuand : \nComment : \nCombien : \nPourquoi est-ce un problème : ";

// Les rubriques 5W2H se remplissent ligne par ligne pour alimenter la grille.
for (const [type, key] of [["8D", "d2"], ["QRQC", "facts"]]) {
  const f = DOCUMENT_SCHEMAS[type]?.fields.find((x) => x[0] === key);
  if (f) f[2] = "Une ligne par question : Quoi, Qui, Où, Quand, Comment, Combien, Pourquoi est-ce un problème.";
}

let mdCtx = null, mdOverviewOpen = false, mdForceGuided = false, mdPending = null, mdTimer = null;

function mdIsModel(type) {
  return MD_TYPES.includes(type) && !!DOCUMENT_SCHEMAS[type];
}
function mdField(type, key) {
  const fields = DOCUMENT_SCHEMAS[type]?.fields || [], i = fields.findIndex((x) => x[0] === key);
  return i < 0 ? null : { i, key, label: fields[i][1], hint: fields[i][2] };
}
function mdLabel(label) {
  return String(label || "").replace(/^\s*(\d+\.|D\d\s*·|[A-Z][a-z]+\s*·)\s*/, "");
}
function mdFold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// « Quoi : … » ligne par ligne → grille 5W2H ; le reste du texte est gardé tel quel.
function md5w2hParse(text) {
  const cells = {}, rest = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^\s*[-•*]?\s*(quoi|qui|où|ou|quand|comment|combien|pourquoi)(?=[\s?:])[^:\n]{0,40}:\s*(.*)$/i);
    if (m) {
      const k = mdFold(m[1]);
      cells[k] = [cells[k], m[2].trim()].filter(Boolean).join(" ");
    } else if (line.trim()) rest.push(line);
  }
  return { cells, rest: rest.join("\n"), found: Object.keys(cells).length };
}
function md5w2h(v) {
  const p = md5w2hParse(v);
  if (v && !p.found) return `<p class="md-text">${esc(v)}</p>`;
  return `${p.rest ? `<p class="md-text">${esc(p.rest)}</p>` : ""}<table class="md-5w"><tbody>${MD_5W2H.map(([k, label]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(p.cells[k] || "")}</td></tr>`).join("")}</tbody></table>`;
}

function md5w2hCompose(rest, cells) {
  return [String(rest || "").trim(), ...MD_5W2H.filter(([k]) => String(cells[k] || "").trim()).map(([k]) => `${MD_5W_LABEL[k]} : ${String(cells[k]).trim()}`)].filter(Boolean).join("\n");
}
// En saisie, la grille 5W2H est le formulaire : une case par question.
function md5w2hEditor(key, v, f, title) {
  const p = md5w2hParse(v);
  return `<textarea class="md-input" id="md-in-${esc(key)}" data-md-5w-of="${esc(key)}" data-md-5w-rest rows="1" placeholder="Le fait en une phrase" aria-label="${esc(title)} : résumé">${esc(p.rest)}</textarea><table class="md-5w md-5w-edit"><tbody>${MD_5W2H.map(([k, label]) => `<tr><th scope="row"><label for="md-5w-${esc(key)}-${k}">${esc(label)}</label></th><td><input id="md-5w-${esc(key)}-${k}" data-md-5w-of="${esc(key)}" data-md-5w="${k}" value="${esc(p.cells[k] || "")}" autocomplete="off"></td></tr>`).join("")}</tbody></table>`;
}
function mdArea(key, v, f, title) {
  return `<textarea class="md-input" id="md-in-${esc(key)}" data-md-field="${esc(key)}" rows="2" placeholder="${esc(f.hint)}" aria-label="${esc(title)}">${esc(v)}</textarea>`;
}

function mdActions(o) {
  const rows = o.pid ? linkedActions(o.pid) : [];
  const add = o.go === "edit" && o.pid ? `<button type="button" class="btn secondary small md-add" data-new-action data-origin-type="Problème" data-origin-id="${esc(o.pid)}">+ Ajouter une action</button>` : "";
  if (!rows.length) return add;
  return `<table class="md-table"><thead><tr><th scope="col">Quoi</th><th scope="col">Qui</th><th scope="col">Quand</th><th scope="col">État</th></tr></thead><tbody>${rows
    .map((a) => {
      const late = isOpenAction(a) && a.due_date && a.due_date < today();
      const title = o.print ? esc(a.title) : `<button type="button" class="md-link" data-open-record="${esc(a.id)}">${esc(a.title)}</button>`;
      return `<tr class="${late ? "late" : ""}"><td>${title}</td><td>${esc(a.owner || "")}</td><td>${a.due_date ? shortDate(a.due_date) : ""}</td><td>${esc(a.status || "")}${late ? " · en retard" : ""}</td></tr>`;
    })
    .join("")}</tbody></table>${add}`;
}

// ——— Résumé graphique : ce qui est écrit et mesuré, mis en image dans la case du modèle.
// Où placer la courbe de l’indicateur du dossier : avant (situation de départ) et après (résultats).
const MD_SLOTS = {
  A3: { before: "current", after: "followup", analysis: "analysis", cause: "root_cause", target: "target" },
  "8D": { before: "d2", after: "d6", cause: "d4_occurrence" },
  QRQC: { before: "facts", after: "verification", cause: "cause" },
  PDCA: { before: "plan", after: "check", target: "plan" },
  DMAIC: { before: "measure", after: "control", cause: "analyze", target: "define" },
};
function mdKpi(o) {
  const p = o.problem, k = p?.kpi_id && typeof osKpi === "function" ? osKpi(p.kpi_id) : null;
  if (!k) return null;
  const rows = osKpiMeasures(p.site_id, k.id).filter((m) => osFinite(m.value));
  return { k, rows, opened: String(p.created_at || "").slice(0, 10), unit: k.unit === "nombre" ? "" : k.unit || "" };
}
function mdFmt(v, unit) {
  return `${osNum(v)}${unit ? (unit === "%" ? " %" : ` ${unit}`) : ""}`;
}
// Courbe de l’indicateur : points colorés selon les seuils, cible en pointillé, ouverture du dossier repérée.
function mdKpiChart(o, mode) {
  const x = mdKpi(o);
  if (!x || x.rows.length < 2) return "";
  const rows = mode === "before" ? x.rows.filter((m) => !x.opened || m.period <= x.opened) : x.rows;
  if (rows.length < 2) return "";
  const target = osFinite(rows.at(-1).target) ? rows.at(-1).target : x.k.target;
  const values = rows.map((r) => r.value).concat(osFinite(target) ? [target] : []);
  let min = Math.min(...values), max = Math.max(...values);
  if (max === min) { max += 1; min -= 1; }
  const pad = (max - min) * 0.15, lo = min - pad, hi = max + pad, W = 300, H = 72, L = 6, R = 6, T = 8, B = 14;
  const px = (i) => L + (i * (W - L - R)) / (rows.length - 1), py = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const line = rows.map((r, i) => `${px(i).toFixed(1)},${py(r.value).toFixed(1)}`).join(" ");
  const dots = rows.map((r, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(r.value).toFixed(1)}" r="3" class="md-dot md-${osStatus(r, x.k)}"><title>${esc(shortDate(r.period))} · ${esc(mdFmt(r.value, x.unit))}</title></circle>`).join("");
  const goal = osFinite(target) ? `<line x1="${L}" x2="${W - R}" y1="${py(target).toFixed(1)}" y2="${py(target).toFixed(1)}" class="md-goal"/><text x="${W - R}" y="${(py(target) - 3).toFixed(1)}" text-anchor="end" class="md-goal-t">cible ${esc(mdFmt(target, x.unit))}</text>` : "";
  const openAt = x.opened && mode === "after" ? rows.findIndex((r) => r.period > x.opened) : -1;
  const mx = openAt > 0 ? (px(openAt - 1) + px(openAt)) / 2 : 0, right = mx > W * 0.6;
  const mark = openAt > 0 ? `<line x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${T}" y2="${H - B}" class="md-open"/><text x="${(mx + (right ? -3 : 3)).toFixed(1)}" y="${T + 8}" text-anchor="${right ? "end" : "start"}" class="md-open-t">ouverture du dossier</text>` : "";
  const first = rows[0], last = rows.at(-1);
  const label = `${x.k.name} : ${mdFmt(first.value, x.unit)} le ${shortDate(first.period)}, ${mdFmt(last.value, x.unit)} le ${shortDate(last.period)}${osFinite(target) ? `, cible ${mdFmt(target, x.unit)}` : ""}`;
  return `<figure class="md-chart"><figcaption><b>${esc(x.k.name)}</b> <span>${esc(mdFmt(last.value, x.unit))}</span> <small>${esc(mode === "before" ? "avant le dossier" : "depuis le début")}</small></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${goal}${mark}<polyline points="${line}" class="md-line"/>${dots}<text x="${L}" y="${H - 3}" class="md-axis">${esc(shortDate(first.period))}</text><text x="${W - R}" y="${H - 3}" text-anchor="end" class="md-axis">${esc(shortDate(last.period))}</text></svg></figure>`;
}
// Pareto compact : une ligne par catégorie (libellé, quantité, cumul), barre pleine largeur ; lisible même en colonne étroite.
function mdPareto(rows) {
  const list = (rows || []).filter((r) => osFinite(r.value)).slice().sort((a, b) => b.value - a.value);
  const total = list.reduce((t, r) => t + r.value, 0);
  if (!list.length || !total) return "";
  let cum = 0;
  return `<figure class="md-pareto"><figcaption><b>Pareto</b> <small>${esc(osNum(total, 0))} au total</small></figcaption>${list.map((r) => {
    cum += r.value;
    const share = (r.value / total) * 100, c = (cum / total) * 100;
    return `<div class="md-par ${c - share < 80 ? "top" : ""}"><span>${esc(r.label)}</span><b>${esc(osNum(r.value))} · ${esc(osNum(c, 0))} %</b><i style="width:${share.toFixed(1)}%"></i></div>`;
  }).join("")}</figure>`;
}
// Objectif : la valeur de départ, la flèche et la cible, d’un coup d’œil.
function mdGoal(o) {
  const x = mdKpi(o);
  if (!x) return "";
  const before = x.rows.filter((m) => !x.opened || m.period <= x.opened).at(-1) || x.rows[0], now = x.rows.at(-1);
  const target = osFinite(now?.target) ? now.target : x.k.target;
  if (!before || !osFinite(target)) return "";
  const cell = (k, v, cls) => `<span class="${cls}"><small>${esc(k)}</small><b>${esc(mdFmt(v, x.unit))}</b></span>`;
  return `<p class="md-goalbar" aria-label="${esc(x.k.name)}">${cell("Départ", before.value, `md-${osStatus(before, x.k)}`)}<i aria-hidden="true">→</i>${cell("Cible", target, "md-ok")}${now !== before ? `${cell("Aujourd’hui", now.value, `md-${osStatus(now, x.k)}`)}` : ""}</p>`;
}
// Causes : la chaîne des 5 pourquoi et les branches renseignées de l’Ishikawa liés au dossier.
function mdCauses(o, types = ["5WHY", "ISHIKAWA"]) {
  if (!o.pid) return "";
  const docs = data.documents.filter((d) => d.problem_id === o.pid && types.includes(d.type) && !d.archived_at);
  return docs.map((d) => {
    const v = documentValues(d), open = o.print ? "" : `<button type="button" class="md-link" data-open-record="${esc(d.id)}">Ouvrir ${esc(d.id)}</button>`;
    if (d.type === "5WHY") {
      const whys = [1, 2, 3, 4, 5].map((n) => String(v[`why${n}`] || "").trim()).filter(Boolean);
      if (!whys.length && !v.root_cause) return `<p class="md-links">5 pourquoi · ${open}</p>`;
      return `<div class="md-why"><p class="md-mini-t">5 pourquoi ${open}</p><ol>${whys.map((w) => `<li>${esc(w)}</li>`).join("")}${v.root_cause ? `<li class="root">${esc(v.root_cause)}</li>` : ""}</ol></div>`;
    }
    const branches = [["method", "Méthodes"], ["machine", "Machines"], ["manpower", "Main-d’œuvre"], ["material", "Matières"], ["measurement", "Mesures"], ["environment", "Milieu"]];
    return `<div class="md-fish"><p class="md-mini-t">Ishikawa ${open}</p><div class="md-fish-grid">${branches.map(([k, l]) => `<span class="${String(v[k] || "").trim() ? "on" : ""}" title="${esc(v[k] || "")}"><b>${esc(l)}</b>${esc(String(v[k] || "").trim().split("\n")[0].slice(0, 60))}</span>`).join("")}</div></div>`;
  }).join("");
}

// Une case du modèle : en-tête (numéro, titre, repère) et contenu ; en saisie, on écrit directement dedans.
function mdBox(o, key, opts = {}) {
  const f = mdField(o.type, key);
  if (!f) return "";
  const v = String(o.values[key] || "").trim(), title = opts.title || mdLabel(f.label);
  const num = opts.num === undefined ? String(f.i + 1) : opts.num;
  const head = `${num ? `<span class="md-num">${esc(num)}</span>` : ""}<b>${esc(title)}</b>${opts.tag ? `<i class="md-tag">${esc(opts.tag)}</i>` : ""}`;
  const example = typeof documentExample === "function" ? documentExample(o.type, key) : "";
  const go = o.go === "doc"
    ? `<button type="button" class="md-head md-go" data-doc-go="${f.i}" title="Compléter cette case">${head}</button>`
    : o.go === "edit"
      ? `<label class="md-head" for="md-in-${esc(key)}" title="${esc(example)}">${head}</label>`
      : `<div class="md-head">${head}</div>`;
  const content = o.go === "edit"
    ? (opts.editor || mdArea)(key, v, f, title)
    : opts.render ? opts.render(v) : v ? `<p class="md-text">${esc(v)}</p>` : `<p class="md-hint">${esc(f.hint)}</p>`;
  // A3 : le Pareto et l’Ishikawa vont dans « Analyse des faits », la chaîne des pourquoi dans « Cause racine ».
  const slot = MD_SLOTS[o.type] || {}, pareto = key === (slot.analysis || slot.before) ? mdPareto(o.problem?.pareto) : "";
  const causes = slot.analysis ? (key === slot.analysis ? mdCauses(o, ["ISHIKAWA"]) : key === slot.cause ? mdCauses(o, ["5WHY"]) : "") : key === slot.cause ? mdCauses(o) : "";
  const graphic = [key === slot.target ? mdGoal(o) : "", key === slot.before ? mdKpiChart(o, "before") : "", pareto, key === slot.after ? mdKpiChart(o, "after") : "", causes].join("");
  return `<section class="md-box ${opts.cls || ""} ${v ? "md-filled" : "md-empty"} ${o.step === f.i ? "current" : ""}" data-md-key="${esc(key)}"${opts.attrs || ""}>${go}<div class="md-body">${opts.before || ""}${content}${graphic ? `<div class="md-graphic">${graphic}</div>` : ""}${opts.after || ""}</div></section>`;
}

function mdHead(o) {
  const p = o.problem, d = o.doc, site = p?.site_id || d?.site_id;
  const shop = p?.workshop_id ? data.workshops?.find((w) => w.id === p.workshop_id)?.name : "";
  const opened = p?.created_at || d?.created_at;
  const cells = [
    ["Réf.", p?.id || d?.id || "—"],
    ["Site", [site ? getSiteName(site) : "", shop].filter(Boolean).join(" · ") || "—"],
    [o.type === "QRQC" ? "Animateur" : "Pilote", d?.owner || p?.owner || (o.go === "edit" ? "" : "—"), "owner"],
    [o.type === "QRQC" ? "Détecté le" : "Ouvert le", opened ? shortDate(opened) : "—"],
    ["Étape", p?.status || d?.status || "Brouillon"],
  ];
  const mark = o.type === "QRQC" ? "QRQC" : o.type;
  const edit = o.go === "edit", name = d?.title || p?.title || "";
  const title = edit ? `<input class="md-title-input" data-md-meta="title" value="${esc(name)}" aria-label="Sujet du dossier" placeholder="Le sujet en quelques mots">` : `<b>${esc(name || "Sujet à préciser")}</b>`;
  return `<header class="md-sheet-head"><div class="md-mark">${esc(mark)}</div><div class="md-title"><small>${esc(MD_NAMES[o.type])}</small>${title}</div><dl class="md-meta">${cells.map(([k, v, meta]) => `<div><dt>${esc(k)}</dt><dd>${edit && meta ? `<input class="md-meta-input" data-md-meta="${meta}" value="${esc(v)}" aria-label="${esc(k)}" placeholder="Nom">` : esc(v)}</dd></div>`).join("")}</dl></header>`;
}
function mdFoot(o) {
  const pr = documentProgress(o.type, o.values), d = o.doc;
  return `<footer class="md-foot"><span>Groupe BIA · Lean Operating System</span><span><span data-md-progress>${pr.done}/${pr.total} cases renseignées</span>${d ? ` · ${esc(d.id)} · version ${esc(d.version || 1)}${d.updated_at ? ` · mis à jour le ${shortDate(d.updated_at)}` : ""}` : ""}</span></footer>`;
}

// A3 (Toyota) : à gauche comprendre (PLAN), à droite agir, vérifier, pérenniser (DO · CHECK · ACT).
function mdA3(o) {
  const t = (k, tag, extra = {}) => mdBox(o, k, { tag, ...extra });
  return `<div class="md-a3-cols"><div class="md-col"><p class="md-col-title"><b>PLAN</b> Comprendre le problème</p>${t("problem", "P", { cls: "md-strong" })}${t("background", "P")}${t("current", "P", { cls: "md-tall" })}${t("target", "P", { cls: "md-target" })}${t("analysis", "P", { cls: "md-tall" })}${t("root_cause", "P", { cls: "md-strong" })}</div><div class="md-col"><p class="md-col-title"><b>DO · CHECK · ACT</b> Agir, vérifier, pérenniser</p>${t("countermeasures", "D")}${t("action_plan", "D", { cls: "md-tall", after: mdActions(o) })}${t("followup", "C")}${t("effectiveness", "C")}${t("standardization", "A")}${t("learning", "A")}</div></div>`;
}

// 8D (Global 8D) : D0 à D8, causes d’apparition et de non-détection côte à côte.
function md8D(o) {
  const d = (k, code, extra = {}) => mdBox(o, k, { num: code, ...extra });
  const sign = `<div class="md-sign"><span>Clôture validée par</span><span>Le</span></div>`;
  return `<div class="md-grid">${d("d0", "D0")}${d("d1", "D1")}${d("d2", "D2", { cls: "md-span", title: "Décrire le problème (5W2H)", render: md5w2h, editor: md5w2hEditor })}${d("d3", "D3", { cls: "md-span md-alert", title: "Contenir : protéger le client tout de suite" })}<section class="md-group md-span"><div class="md-head"><span class="md-num">D4</span><b>Causes racines</b></div><div class="md-split">${d("d4_occurrence", "", { title: "Pourquoi c’est apparu ?", tag: "Apparition" })}${d("d4_escape", "", { title: "Pourquoi ce n’a pas été détecté ?", tag: "Non-détection" })}</div></section>${d("d5", "D5")}${d("d6", "D6", { after: mdActions(o) })}${d("d7", "D7")}${d("d8", "D8", { after: sign })}</div>`;
}

// QRQC : détecter, sécuriser, analyser (apparition / non-détection), agir, vérifier.
function mdQRQC(o) {
  const v = o.values, on = (keys) => keys.some((k) => String(v[k] || "").trim());
  const steps = [["Détecter", ["event", "facts"]], ["Sécuriser", ["containment"]], ["Analyser", ["cause", "escape"]], ["Agir", ["corrective"]], ["Vérifier", ["verification", "escalation"]]];
  const q = (k, tag, extra = {}) => mdBox(o, k, { tag, ...extra });
  return `<ol class="md-steps">${steps.map(([s, keys]) => `<li class="${on(keys) ? "on" : ""}" data-md-keys="${keys.join(" ")}">${esc(s)}</li>`).join("")}</ol><div class="md-grid">${q("event", "Détecter", { title: "Le fait : ce qui a été vu" })}${q("containment", "Sécuriser", { cls: "md-alert", title: "Sécuriser dans l’heure" })}${q("facts", "Détecter", { cls: "md-span", title: "Caractériser (5W2H)", render: md5w2h, editor: md5w2hEditor })}<section class="md-group md-span"><div class="md-head"><span class="md-num">4–5</span><b>Analyser : cause probable, puis prouvée</b><i class="md-tag">Analyser</i></div><div class="md-split">${q("cause", "Apparition", { num: "", title: "Pourquoi c’est apparu ?" })}${q("escape", "Non-détection", { num: "", title: "Pourquoi ce n’a pas été détecté ?" })}</div></section>${q("corrective", "Agir", { cls: "md-span", after: mdActions(o) })}${q("verification", "Vérifier")}${q("escalation", "Vérifier")}</div>`;
}

// PDCA : la roue de Deming, dans le sens des aiguilles d’une montre, tenue par le standard.
function mdPDCA(o) {
  const quad = (k, letter, name, cls, extra = {}) => mdBox(o, k, { num: letter, title: name, tag: mdLabel(mdField(o.type, k)?.label), cls: `md-q ${cls}`, before: `<span class="md-big" aria-hidden="true">${letter}</span>`, ...extra });
  return `<div class="md-wheel">${quad("plan", "P", "Planifier", "md-q-p")}${quad("do", "D", "Faire", "md-q-d", { after: mdActions(o) })}${quad("act", "A", "Agir", "md-q-a")}${quad("check", "C", "Vérifier", "md-q-c")}<div class="md-hub" aria-hidden="true"><b>PDCA</b><span>↻</span></div></div><p class="md-wedge"><span class="md-wedge-shape" aria-hidden="true"></span><b>Standard</b> Ce qui marche devient la nouvelle référence : la roue ne redescend pas.</p>`;
}

// DMAIC : cinq phases enchaînées, chacune avec ses outils de référence.
const MD_DMAIC = [
  ["define", "D", "Définir", "Charte, SIPOC, voix du client (CTQ)"],
  ["measure", "M", "Mesurer", "Plan de collecte, définition opérationnelle, capabilité"],
  ["analyze", "A", "Analyser", "Pareto, Ishikawa, 5 pourquoi, tests d’hypothèses"],
  ["improve", "I", "Améliorer", "Solutions, essai pilote, plan d’actions"],
  ["control", "C", "Contrôler", "Plan de contrôle, standard, carte de contrôle"],
];
function mdDMAIC(o) {
  return `<div class="md-dmaic-row">${MD_DMAIC.map(([k, letter, name, tools], i) => mdBox(o, k, { num: letter, title: name, tag: mdLabel(mdField(o.type, k)?.label), cls: `md-ph md-ph-${i + 1}`, before: `<p class="md-tools">${esc(tools)}</p>`, after: k === "improve" ? mdActions(o) : "" })).join("")}</div>`;
}

const MD_LAYOUTS = { A3: mdA3, "8D": md8D, QRQC: mdQRQC, PDCA: mdPDCA, DMAIC: mdDMAIC };
function mdSheet(type, values = {}, ctx = {}) {
  const o = { type, values: values || {}, go: ctx.go || null, doc: ctx.doc || null, problem: ctx.problem || null, step: ctx.step ?? null, print: !!ctx.print };
  o.pid = o.problem?.id || o.doc?.problem_id || null;
  const css = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  const edit = o.go === "edit" ? ` data-md-edit data-md-problem="${esc(o.pid || "")}"` : "";
  return `<article class="md-sheet md-${css}${o.go ? " md-editable" : ""}" data-md-type="${esc(type)}"${edit}>${mdHead(o)}${MD_LAYOUTS[type](o)}${mdFoot(o)}${o.print ? `<style media="print">@page{size:${MD_PAGE[type]};margin:8mm}</style>` : ""}</article>`;
}

// Vignette du modèle pour le choix de la méthode.
function mdThumb(type) {
  const cells = { A3: 6, "8D": 8, QRQC: 5, PDCA: 4, DMAIC: 5 }[type] || 4;
  return `<span class="md-thumb md-thumb-${type.toLowerCase()}" aria-hidden="true">${Array.from({ length: cells }, () => "<i></i>").join("")}</span>`;
}

// ——— Formulaire : la vue d’ensemble devient la fiche du modèle, chaque case ouvre sa rubrique.
const mdVisualBase = documentVisual;
documentVisual = function (type, values = {}) {
  if (!mdIsModel(type)) return mdVisualBase(type, values);
  const doc = mdCtx?.docId ? data.documents.find((d) => d.id === mdCtx.docId) : null;
  return mdSheet(type, values, { doc, problem: doc ? data.problems.find((p) => p.id === doc.problem_id) : null, go: mdCtx?.go || null });
};
const mdPrintBase = documentPrint;
documentPrint = function (d, values) {
  if (!d || !mdIsModel(d.type)) return mdPrintBase(d, values);
  return mdSheet(d.type, values, { doc: d, problem: data.problems.find((p) => p.id === d.problem_id), print: true });
};
const mdEditBase = editDocument;
// Le dossier principal d’un problème s’ouvre dans sa fiche, dans Résoudre : on écrit dans les cases.
// Le formulaire question par question reste disponible par « Mode guidé » (mdGuided).
function mdWizardOpen() {
  return !$("modal")?.hidden && !!$("modalContent")?.querySelector("#editDocumentForm");
}
function mdInlineTarget(saved) {
  if (!saved || !mdIsModel(saved.type) || !saved.problem_id || mdForceGuided || mdWizardOpen()) return null;
  const p = data.problems.find((x) => x.id === saved.problem_id && !x.archived_at);
  return p && p.method === saved.type && allowedSite(p.site_id) && role().nav.includes("resolution") ? p : null;
}
editDocument = function (id, step) {
  const saved = data.documents.find((x) => x.id === id), p = mdInlineTarget(saved);
  if (p) return mdOpenInline(p, saved, step);
  mdCtx = { docId: id, go: saved && mdIsModel(saved.type) && allowedSite(saved.site_id, true) ? "doc" : null };
  try {
    return mdEditBase.apply(this, arguments);
  } finally {
    mdCtx = null;
    if (saved && mdIsModel(saved.type)) mdWizard(saved);
  }
};
function mdGuided(id, step) {
  mdFlush();
  mdForceGuided = true;
  try {
    return editDocument(id, step);
  } finally {
    mdForceGuided = false;
  }
}
function mdOpenInline(p, doc, step) {
  if (!$("modal").hidden) closeModal();
  if (state.site !== "group" && state.site !== p.site_id) state.site = p.site_id;
  if (state.workshop && p.workshop_id !== state.workshop) state.workshop = "";
  state.view = "resolution";
  state.selectedProblemId = p.id;
  render();
  const fields = DOCUMENT_SCHEMAS[p.method].fields, values = documentValues(doc);
  const key = Number.isInteger(step) && fields[step] ? fields[step][0] : (fields.find(([k]) => !String(values[k] || "").trim()) || fields[0])[0];
  mdFocus(key);
}
function mdFocus(key) {
  const box = document.querySelector(`.md-sheet[data-md-edit] [data-md-key="${key}"]`);
  const el = box?.querySelector("textarea, input");
  box?.scrollIntoView?.({ block: "center" });
  el?.focus?.({ preventScroll: true });
}
function mdWizard(saved) {
  const root = $("modalContent");
  if (!root) return;
  const overview = root.querySelector(".wizard-overview");
  if (overview) {
    const summary = overview.querySelector("summary");
    if (summary) summary.textContent = `Voir la fiche ${saved.type} complète`;
    overview.open = mdOverviewOpen;
    overview.addEventListener("toggle", () => (mdOverviewOpen = overview.open));
    const active = root.querySelector(".wizard-nav .wizard-step.active")?.dataset.docGo;
    if (active !== undefined) overview.querySelector(`.md-box [data-doc-go="${active}"]`)?.closest(".md-box")?.classList.add("current");
  }
  const area = root.querySelector("textarea[data-doc-field]");
  if (area && ["d2", "facts"].includes(area.dataset.docField)) {
    area.placeholder = MD_5W2H_TEMPLATE.replace(/ $/gm, " …");
    if (!root.querySelector("[data-md-5w2h]")) {
      area.closest("label")?.insertAdjacentHTML("afterend", '<button type="button" class="btn ghost small md-5w2h" data-md-5w2h>Insérer la trame 5W2H</button>');
      const b = root.querySelector("[data-md-5w2h]");
      if (b) b.onclick = () => {
        const p = md5w2hParse(area.value), missing = MD_5W2H.filter(([k]) => !p.cells[k]);
        const add = MD_5W2H_TEMPLATE.split("\n").filter((line) => missing.some(([k]) => mdFold(line).startsWith(k)));
        area.value = [area.value.trim(), ...add].filter(Boolean).join("\n");
        area.dispatchEvent(new Event("input", { bubbles: true }));
        area.focus();
      };
    }
  }
}

// ——— Choix de la méthode : des cartes avec la vignette du modèle, plus de menu déroulant.
const mdProblemFormBase = genericProblemForm;
genericProblemForm = function (origin = {}) {
  const out = mdProblemFormBase.apply(this, arguments);
  const select = document.getElementById("problemMethod");
  if (select && select.tagName === "SELECT") {
    const value = select.value || "A3";
    select.closest("label").outerHTML = `<fieldset class="md-pick wide"><legend>Quel outil ?</legend><div class="md-pick-list">${MD_TYPES.map((m) => `<button type="button" class="md-pick-card ${m === value ? "active" : ""}" data-md-method="${m}" aria-pressed="${m === value}">${mdThumb(m)}<b>${esc(m)}</b><small><em>Quand</em> ${esc(MD_GUIDE[m].when)}</small><small><em>Pourquoi</em> ${esc(MD_GUIDE[m].short)}</small></button>`).join("")}</div><input type="hidden" id="problemMethod" value="${esc(value)}"></fieldset>`;
    document.querySelector("#problemForm .method-choice")?.remove();
    const titleField = document.querySelector("#problemForm #problemTitle")?.closest("label");
    const pick = document.querySelector("#problemForm .md-pick");
    if (titleField && pick) titleField.after(pick);
    document.querySelectorAll("[data-md-method]").forEach((b) => (b.onclick = () => {
      $("problemMethod").value = b.dataset.mdMethod;
      document.querySelectorAll("[data-md-method]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
    }));
  }
  return out;
};

// ——— Quel outil choisir, et pourquoi.
function mdGuide(open) {
  const path = MD_TYPES.map((m) => `<li><span>${esc(MD_GUIDE[m].signal)}</span><b>${esc(m)}</b></li>`).join("");
  const cards = MD_TYPES.map((m) => {
    const g = MD_GUIDE[m];
    return `<article class="md-guide-card">${mdThumb(m)}<h4>${esc(MD_NAMES[m])}</h4><dl><div><dt>Quand</dt><dd>${esc(g.when)}</dd></div><div><dt>Pourquoi</dt><dd>${esc(g.why)}</dd></div><div><dt>Durée</dt><dd>${esc(g.time)}</dd></div><div><dt>Qui</dt><dd>${esc(g.who)}</dd></div><div><dt>Et ensuite</dt><dd>${esc(g.next)}</dd></div></dl></article>`;
  }).join("");
  const tools = MD_TOOLS.map(([name, why, when]) => `<div><dt>${esc(name)}</dt><dd><b>Pourquoi</b> ${esc(why)} <b>Quand</b> ${esc(when)}</dd></div>`).join("");
  return `<details class="md-guide section"${open ? " open" : ""}><summary>Quel outil choisir, et pourquoi ?</summary><ol class="md-path" aria-label="Du signal à l’outil">${path}</ol><div class="md-guide-grid">${cards}</div><h4 class="md-guide-sub">Les outils d’analyse dans les fiches</h4><dl class="md-tools-list">${tools}</dl></details>`;
}

const MD_PSTATUS = ["Cadrage", "Analyse", "Actions", "Vérification", "Standardisation", "Clos"];
function mdStatusChips(p, doc) {
  const ds = doc?.status || "Brouillon";
  return `<div class="md-status" role="group" aria-label="Étape du dossier"><span>Étape</span>${MD_PSTATUS.map((s) => `<button type="button" class="${p.status === s ? "active" : ""}" data-md-pstatus="${s}" aria-pressed="${p.status === s}">${esc(s)}</button>`).join("")}</div><div class="md-status" role="group" aria-label="État de la fiche"><span>Fiche</span>${["Brouillon", "En révision", "Validé"].map((s) => `<button type="button" class="${ds === s ? "active" : ""}" data-md-dstatus="${s}" aria-pressed="${ds === s}">${esc(s)}</button>`).join("")}</div>`;
}

// ——— Résoudre : le dossier choisi s’affiche sur son modèle, en pleine largeur, et on écrit dedans.
renderResolution = function () {
  const rows = scoped(data.problems), p = rows.find((x) => x.id === state.selectedProblemId) || rows[0];
  const header = pageHead("Résolution", "A3 · PDCA · 8D · DMAIC · QRQC", "Chaque dossier suit son modèle de référence : on écrit directement dans les cases.", '<button class="btn" data-new-problem>+ Nouveau problème</button>');
  if (!p) return `${header}${mdGuide(true)}${empty("Aucun dossier. Démarrez depuis un signal ou créez un problème.")}`;
  state.selectedProblemId = p.id;
  const doc = data.documents.find((d) => d.problem_id === p.id && d.type === p.method), schema = DOCUMENT_SCHEMAS[p.method];
  const values = doc ? documentValues(doc) : initialDocumentData(p.method, p), progress = documentProgress(p.method, values);
  const next = schema?.fields.find(([key]) => !String(values[key] || "").trim()), can = allowedSite(p.site_id, true) && !role().readonly;
  const list = `<aside class="problem-list">${rows.map((r) => `<button data-select-problem="${r.id}" class="${r.id === p.id ? "active" : ""}"><b>${esc(r.id)} · ${esc(r.method)}</b><br>${esc(r.title)}<br><small>${esc(r.status)}</small></button>`).join("")}</aside>`;
  const go = next && can ? `<button type="button" class="btn" data-md-goto="${esc(next[0])}">Écrire dans cette case ↓</button>` : "";
  const panel = `<section class="panel"><span class="eyebrow">${esc(p.id)} · ${esc(getSiteName(p.site_id))}</span><h2>${esc(p.title)}</h2><p>${esc(p.owner)} · ${esc(p.status)}</p><div class="next-step"><span>PROCHAINE CASE</span><b data-md-next>${esc(next?.[1] || "Relire les preuves et préparer la clôture")}</b><p data-md-progress-panel>${progress.done}/${progress.total} cases renseignées</p>${go}</div>${can ? `<div class="md-statuses" data-md-statuses>${mdStatusChips(p, doc)}</div>` : ""}<div class="row-actions section">${(p.signal_ids || []).map((id) => recordLink(id, "Signal d’origine")).join("")}${recordLink(p.origin_id, "Origine")}</div></section>`;
  const g = MD_GUIDE[p.method];
  const tools = `${can && doc ? `<button type="button" class="btn ghost" data-md-guided="${esc(doc.id)}">Mode guidé</button>` : ""}<button type="button" class="btn secondary" data-md-print="${p.id}">Imprimer / PDF</button>`;
  const sheet = mdIsModel(p.method)
    ? `<section class="md-wrap section"><div class="md-wrap-head"><div><h3>Fiche ${esc(p.method)}</h3>${g ? `<p class="hint md-why-tool"><b>Pourquoi un ${esc(p.method)} :</b> ${esc(g.why)}</p>` : ""}${can ? '<p class="md-save" data-md-save role="status">Écrivez dans les cases : tout est enregistré au fil de la saisie.</p>' : ""}</div><div class="md-wrap-tools">${tools}</div></div><div class="md-scroll">${mdSheet(p.method, values, { doc, problem: p, go: can ? "edit" : null })}</div></section>`
    : "";
  return `${header}${mdGuide(false)}<div class="problem-layout">${list}${panel}</div>${sheet}`;
};

// ——— Enregistrement au fil de la saisie, avec les mêmes règles que le formulaire guidé.
function mdDoc(p) {
  return data.documents.find((d) => d.problem_id === p.id && d.type === p.method);
}
function mdSave(change) {
  const p0 = data.problems.find((x) => x.id === change.pid);
  if (!p0 || !allowedSite(p0.site_id, true)) return false;
  return commitData(() => {
    const p = data.problems.find((x) => x.id === change.pid), fields = DOCUMENT_SCHEMAS[p.method].fields;
    let doc = mdDoc(p);
    if (!doc) {
      doc = { id: nextId("DOC", data.documents), site_id: p.site_id, type: p.method, title: p.title, owner: p.owner, status: "Brouillon", problem_id: p.id, structured_data: initialDocumentData(p.method, p), version: 1, created_at: now(), updated_at: now() };
      data.documents.unshift(doc);
    }
    doc.structured_data = { ...documentValues(doc) };
    let changed = false;
    for (const [k, v] of Object.entries(change.fields || {})) {
      if (String(doc.structured_data[k] || "") !== v) {
        doc.structured_data[k] = v;
        changed = true;
      }
    }
    const title = change.meta?.title?.trim(), owner = change.meta?.owner?.trim();
    if (title && title !== doc.title) { doc.title = title; p.title = title; changed = true; }
    if (owner !== undefined && owner !== (doc.owner || "")) { doc.owner = owner; p.owner = owner; changed = true; }
    if (!changed) return;
    doc.content = doc.structured_data[fields[0][0]] || "";
    doc.updated_at = now();
    if (doc.status === "Validé") doc.status = "En révision";
    syncProblemDocument(p, p.method, doc.structured_data);
    if (p.status === "Clos") {
      p.status = "Analyse";
      recordHistory(p, "Analyse", "Réouverture après modification du document");
    }
    p.updated_at = now();
  });
}
function mdQueue(pid, el) {
  const sheet = el.closest(".md-sheet");
  mdPending ||= { pid, fields: {}, meta: {} };
  if (mdPending.pid !== pid) { mdFlush(); mdPending = { pid, fields: {}, meta: {} }; }
  if (el.dataset.mdField) mdPending.fields[el.dataset.mdField] = el.value;
  else if (el.hasAttribute("data-md-5w-of")) {
    const key = el.getAttribute("data-md-5w-of"), cells = {};
    sheet.querySelectorAll(`[data-md-5w-of="${key}"][data-md-5w]`).forEach((x) => (cells[x.getAttribute("data-md-5w")] = x.value));
    mdPending.fields[key] = md5w2hCompose(sheet.querySelector(`[data-md-5w-of="${key}"][data-md-5w-rest]`)?.value, cells);
  } else if (el.dataset.mdMeta) mdPending.meta[el.dataset.mdMeta] = el.value;
  else return;
  const state_ = document.querySelector("[data-md-save]");
  if (state_) state_.textContent = "Enregistrement…";
  clearTimeout(mdTimer);
  mdTimer = setTimeout(mdFlush, 600);
}
function mdFlush() {
  clearTimeout(mdTimer);
  if (!mdPending) return true;
  const change = mdPending;
  mdPending = null;
  const ok = mdSave(change);
  mdRefresh(change.pid, ok);
  return ok;
}
// Mise à jour sur place (sans redessiner la page, pour ne pas perdre la case en cours).
function mdRefresh(pid, ok) {
  const p = data.problems.find((x) => x.id === pid), sheet = document.querySelector(`.md-sheet[data-md-problem="${pid}"]`);
  const saveState = document.querySelector("[data-md-save]");
  if (saveState) saveState.textContent = ok ? `Enregistré sur cet appareil à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.` : "Non enregistré : vérifiez le message affiché.";
  if (!p || !sheet) return;
  const doc = mdDoc(p), values = doc ? documentValues(doc) : {}, pr = documentProgress(p.method, values);
  sheet.querySelectorAll("[data-md-key]").forEach((box) => {
    const filled = !!String(values[box.dataset.mdKey] || "").trim();
    box.classList.toggle("md-filled", filled);
    box.classList.toggle("md-empty", !filled);
  });
  sheet.querySelectorAll(".md-steps [data-md-keys]").forEach((li) => li.classList.toggle("on", li.dataset.mdKeys.split(" ").some((k) => String(values[k] || "").trim())));
  const text = `${pr.done}/${pr.total} cases renseignées`;
  sheet.querySelectorAll("[data-md-progress]").forEach((x) => (x.textContent = text));
  const panel = document.querySelector("[data-md-progress-panel]");
  if (panel) panel.textContent = text;
  const next = DOCUMENT_SCHEMAS[p.method].fields.find(([k]) => !String(values[k] || "").trim()), nextEl = document.querySelector("[data-md-next]");
  if (nextEl) nextEl.textContent = next?.[1] || "Relire les preuves et préparer la clôture";
  const goto = document.querySelector("[data-md-goto]");
  if (goto) next ? (goto.dataset.mdGoto = next[0]) : goto.remove();
  const chips = document.querySelector("[data-md-statuses]");
  if (chips) { chips.innerHTML = mdStatusChips(p, doc); mdBindStatus(chips, pid); }
}
function mdFit(el) {
  if (el.tagName !== "TEXTAREA" || !el.scrollHeight) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

// Étape du problème et état de la fiche : mêmes garde-fous que « Enregistrer le dossier ».
function mdSetStatus(pid, kind, value) {
  if (!mdFlush()) return;
  const p = data.problems.find((x) => x.id === pid);
  if (!p) return;
  const doc = mdDoc(p), values = doc ? documentValues(doc) : initialDocumentData(p.method, p), complete = documentProgress(p.method, values).pct === 100;
  if (kind === "doc" && value === "Validé" && (!complete || !(doc?.owner || p.owner)))
    return toast("Renseignez toutes les cases et le pilote avant de valider la fiche.");
  if (kind === "problem" && value === "Clos" && (!complete || linkedActions(pid).some(isOpenAction)))
    return toast("Complétez l’analyse, la vérification, la standardisation et clôturez les actions avant le problème.");
  if (!commitData(() => {
    const p2 = data.problems.find((x) => x.id === pid);
    let d = mdDoc(p2);
    if (kind === "problem") {
      p2.status = value;
      p2.updated_at = now();
      return;
    }
    if (!d) {
      d = { id: nextId("DOC", data.documents), site_id: p2.site_id, type: p2.method, title: p2.title, owner: p2.owner, status: "Brouillon", problem_id: p2.id, structured_data: initialDocumentData(p2.method, p2), version: 1, created_at: now(), updated_at: now() };
      data.documents.unshift(d);
    }
    if (d.status !== value && value === "Validé") d.version = (d.version || 1) + 1;
    d.status = value;
    d.updated_at = now();
  })) return;
  render();
}
function mdBindStatus(root, pid) {
  root.querySelectorAll("[data-md-pstatus]").forEach((b) => (b.onclick = () => mdSetStatus(pid, "problem", b.dataset.mdPstatus)));
  root.querySelectorAll("[data-md-dstatus]").forEach((b) => (b.onclick = () => mdSetStatus(pid, "doc", b.dataset.mdDstatus)));
}

function mdPrint(pid) {
  mdFlush();
  const p = data.problems.find((x) => x.id === pid);
  if (!p || !allowedSite(p.site_id)) return;
  const doc = mdDoc(p), values = doc ? documentValues(doc) : initialDocumentData(p.method, p);
  modal(`${p.id} · Fiche ${p.method}`, `<div class="md-preview">${mdSheet(p.method, values, { doc, problem: p, print: true })}</div><div class="form-actions"><button type="button" class="btn" data-print>Imprimer / PDF</button><button type="button" class="btn secondary" data-close-modal>Fermer</button></div>`);
  $("modalContent").querySelector("[data-print]").onclick = () => window.print();
}
function mdBind(root) {
  root.querySelectorAll("[data-md-print]").forEach((b) => (b.onclick = () => mdPrint(b.dataset.mdPrint)));
  root.querySelectorAll("[data-md-guided]").forEach((b) => (b.onclick = () => {
    const d = data.documents.find((x) => x.id === b.dataset.mdGuided), fields = DOCUMENT_SCHEMAS[d?.type]?.fields || [];
    const values = d ? documentValues(d) : {}, i = fields.findIndex(([k]) => !String(values[k] || "").trim());
    mdGuided(b.dataset.mdGuided, i < 0 ? 0 : i);
  }));
  root.querySelectorAll("[data-md-goto]").forEach((b) => (b.onclick = () => mdFocus(b.dataset.mdGoto)));
  const sheet = root.querySelector(".md-sheet[data-md-edit]");
  if (sheet && !sheet.dataset.mdBound) {
    sheet.dataset.mdBound = "1";
    const pid = sheet.dataset.mdProblem;
    sheet.addEventListener("input", (e) => {
      if (e.target.matches("textarea")) mdFit(e.target);
      mdQueue(pid, e.target);
    });
    sheet.addEventListener("change", (e) => {
      mdQueue(pid, e.target);
      mdFlush();
    });
    sheet.querySelectorAll("textarea.md-input").forEach(mdFit);
  }
  const chips = root.querySelector("[data-md-statuses]");
  if (chips && sheet) mdBindStatus(chips, sheet.dataset.mdProblem);
}
const mdOsBindBase = osBind;
osBind = function () {
  const out = mdOsBindBase.apply(this, arguments);
  mdBind(document);
  return out;
};
// Rien ne se perd : ce qui est en cours d’écriture part avant de quitter la page ou d’ouvrir autre chose.
addEventListener("pagehide", () => mdFlush());
const mdRenderBase = render;
render = function () {
  mdFlush();
  return mdRenderBase.apply(this, arguments);
};
