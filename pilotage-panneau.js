"use strict";
/* BIA Lean OS 8.50 — Le pilotage parle la langue du panneau.
   1. Les indicateurs du panneau TOP 5 remplacent les cinq indicateurs du pilotage (le TRS reste dans Observer › TRS) :
      jours sans accident, NC, SAV, erreurs internes, CA, commandes livrées à temps, commandes en retard, absentéisme.
      Un site : cinq cartes S Q C D P. Le Groupe : une ligne par site (Analyser et Décider).
   2. Cibles : celles du Groupe par défaut (Paramètres › Indicateurs), modifiables usine par usine
      (Paramètres › Cibles par usine). Le CA n’a pas de cible Groupe : chaque site a son objectif, vide au départ.
   3. Rubriques par site (Paramètres › Rubriques par site) : une case cochée = la rubrique est visible pour ce site.
      Installation neuve : TOP 5, plan d’actions, signaux, Gemba et TRS ; on coche le reste quand le site est prêt.
   4. Réunions : le TOP 5 se tient chaque semaine devant le panneau, au jour et à l’heure de chaque site.
   Données : kpis[] « pn_* » ; settings.siteTargets { site: { code: cible } } ; settings.siteRubriques { site: { _default, clé: bool } }. */

const PP_KPIS = [
  { row: "jsa", code: "pn_jsa", name: "Jours sans accident", short: "Sans accident", axis: "S", unit: "jours", direction: "high", target: 7, green: 7, orange: 7, definition: "Jours écoulés depuis le dernier accident avec ou sans arrêt, relevés au panneau. Vert : aucun accident dans la semaine (7 jours ou plus).", formula: "compteur du panneau" },
  { row: "ncpole", code: "pn_nc", name: "Non-conformités de la semaine", short: "NC", axis: "Q", unit: "nombre", direction: "low", target: 8, green: 8, orange: 10, definition: "Non-conformités enregistrées dans la semaine, tous pôles confondus.", formula: "pôle 1 + pôle 2 + pôle 3" },
  { row: "sav", code: "pn_sav", name: "Retours SAV", short: "SAV", axis: "Q", unit: "nombre", direction: "low", target: 3, green: 3, orange: 4, definition: "Retours SAV ouverts dans la semaine. Le montant en euros reste noté sur le panneau.", formula: "comptage" },
  { row: "erreurs", code: "pn_err", name: "Erreurs internes", short: "Erreurs", axis: "Q", unit: "nombre", direction: "low", target: 6, green: 6, orange: 8, definition: "Erreurs détectées avant expédition (préparation, débit, étiquetage…), dans la semaine.", formula: "comptage" },
  { row: "ca", code: "pn_ca", name: "CA réalisé", short: "CA", axis: "C", unit: "k€", direction: "high", target: null, green: null, orange: null, definition: "Chiffre d’affaires facturé dans la semaine, comparé à l’objectif propre au site. Vert dès l’objectif, orange dès 90 %.", formula: "CA facturé de la semaine" },
  { row: "otd", code: "pn_otd", name: "Commandes livrées à temps", short: "À temps", axis: "D", unit: "%", direction: "high", target: 95, green: 95, orange: 90, definition: "Commandes livrées à la date promise / commandes dues dans la semaine × 100.", formula: "livrées à temps / dues × 100" },
  { row: "retard", code: "pn_retard", name: "Commandes en retard", short: "En retard", axis: "D", unit: "nombre", direction: "low", target: 5, green: 5, orange: 8, definition: "Commandes dont la date promise est dépassée, le jour du TOP 5.", formula: "comptage" },
  { row: "abs", code: "pn_abs", name: "Taux d’absentéisme", short: "Absentéisme", axis: "P", unit: "%", direction: "low", target: 4, green: 4, orange: 5, definition: "Heures d’absence / heures prévues × 100, sur la semaine.", formula: "heures d’absence / heures prévues × 100" },
];
const PP_LEGACY = ["trs", "scrap", "safety_signal", "service", "staffing"];
const PP_LEGACY_SQCDP = GROUP_SQCDP.map((x) => ({ ...x }));
Object.assign(IN_SHORT, Object.fromEntries(PP_KPIS.map((p) => [p.code, p.short])));

/* ---------- Les indicateurs du panneau dans le référentiel ---------- */

function ppOn(source = data) { return (source?.kpis || []).some((k) => String(k.code).startsWith("pn_") && !k.archived_at); }
function ppDef(code) { return PP_KPIS.find((p) => p.code === code) || null; }
function ppKpiRow(p) {
  return { id: `KPI-${p.code}`, code: p.code, name: p.name, axis: p.axis, unit: p.unit, direction: p.direction, target: p.target, green: p.green, orange: p.orange, definition: p.definition, formula: p.formula, frequency: "Hebdomadaire", owner: "Directeur de site", level: "Site", source: "Panneau TOP 5 · reporté après la réunion", site_id: "group", active: true };
}
function ppEnsureKpis(base) {
  base.kpis ||= [];
  const at = new Date().toISOString();
  for (const p of PP_KPIS) if (!base.kpis.some((k) => k.code === p.code)) base.kpis.push(ppKpiRow(p));
  for (const k of base.kpis) if (PP_LEGACY.includes(k.code) && !k.archived_at) { k.archived_at = at; k.archive_reason = "Remplacé par les indicateurs du panneau TOP 5 (8.50). Le TRS reste suivi dans Observer › TRS."; }
  base.settings ||= {};
  base.settings.siteTargets ||= {};
  return base;
}
function ppSiteTarget(siteId, code, source = data) { const v = source?.settings?.siteTargets?.[siteId]?.[code]; return typeof v === "number" && Number.isFinite(v) ? v : null; }
function ppTargetOf(siteId, k) { const t = ppSiteTarget(siteId, k.code); return t ?? (osFinite(k.target) ? k.target : null); }

// Chaque report du panneau écrit aussi les mesures du pilotage (le lundi de la semaine : période commune à tous les sites).
const ppMeasuresBase = pnMeasuresFor;
pnMeasuresFor = function (base, b, week, values) {
  ppMeasuresBase.apply(this, arguments);
  if (!ppOn(base)) return;
  base.measures = base.measures.filter((m) => !(m.board_id === b.id && m.period === week && String(m.code).startsWith("pn_")));
  for (const p of PP_KPIS) {
    const k = base.kpis.find((x) => x.code === p.code && !x.archived_at), r = (b.rows || []).find((x) => x.id === p.row);
    const v = r ? pnTotal(r, values?.[r.id]) : null;
    if (!k || v === null) continue;
    base.measures.push({ id: uid("MES"), site_id: b.site_id, kpi_id: k.id, code: k.code, axis: k.axis, unit: k.unit, period: week, value: +Number(v).toFixed(1), target: ppSiteTarget(b.site_id, k.code, base), definition: k.definition, source: `${b.name} · reporté du panneau`, entry_mode: "panneau", board_id: b.id, synced_at: now() });
  }
};
function ppRebuildMeasures(base) { for (const b of base.boards || []) for (const w of (base.boardWeeks || []).filter((x) => x.board_id === b.id)) pnMeasuresFor(base, b, w.week, w.values); }

// Statut : le CA se juge contre l’objectif du site (vert dès l’objectif, orange dès 90 %) ; sans objectif, il reste à qualifier.
const ppStatusBase = osStatus;
osStatus = function (row, kpi = osKpi(row?.kpi_id || row?.code)) {
  if (kpi?.code === "pn_ca" && row && osFinite(row.value)) {
    if (!osFinite(row.target)) return "qualify";
    return row.value >= row.target ? "ok" : row.value >= 0.9 * row.target ? "warn" : "gap";
  }
  return ppStatusBase.call(this, row, kpi);
};
const ppThresholdBase = osThresholdText;
osThresholdText = function (kpi, localTarget = null) {
  if (kpi?.code === "pn_ca") return osFinite(localTarget) ? `Vert dès ${osNum(localTarget)} k€ · orange dès ${osNum(0.9 * localTarget)} k€ · rouge en dessous` : "Objectif du site à saisir (Paramètres › Cibles par usine)";
  return ppThresholdBase.apply(this, arguments);
};
if (typeof pmThresholdsOk === "function") { const b = pmThresholdsOk; pmThresholdsOk = function (k) { return k?.code === "pn_ca" ? true : b.apply(this, arguments); }; }
if (typeof pmScale === "function") { const b = pmScale; pmScale = function (k) { return k?.code === "pn_ca" ? '<div class="pm-scale"><span class="ok">≥ objectif du site</span><span class="warn">90 à 100 %</span><span class="gap">&lt; 90 %</span></div><p class="hint">L’objectif se saisit site par site : Paramètres › Cibles par usine.</p>' : b.apply(this, arguments); }; }

/* ---------- Analyser · un site : cinq cartes, les lignes du panneau ---------- */

function ppTargetText(siteId, k) {
  const t = ppTargetOf(siteId, k), u = inUnit(k);
  if (k.code === "pn_jsa") return "aucun accident";
  if (k.code === "pn_ca") return t === null ? "objectif à saisir" : `obj. ${osNum(t)} k€`;
  return t === null ? "cible à définir" : `${k.direction === "high" ? "≥" : "≤"} ${osNum(t)}${u ? (u === "%" ? " %" : " " + u) : ""}`;
}
function ppBoardWeekAt(siteId, period) {
  const b = (data.boards || []).find((x) => x.site_id === siteId && !x.archived_at);
  if (!b) return { b: null, w: null };
  return { b, w: pnWeeks(b).filter((w) => w.week <= period).pop() || null };
}
function ppExtra(k, b, w) {
  if (!b || !w) return "";
  const v = w.values || {}, row = (id) => (b.rows || []).find((r) => r.id === id);
  if (k.code === "pn_jsa" && pnNum(v.record) !== null) return `record ${osNum(pnNum(v.record))} j`;
  if (k.code === "pn_nc" && Array.isArray(v.ncpole)) return (row("ncpole")?.poles || []).map((p, i) => `${p.replace("Pôle ", "P")} ${pnFmt(v.ncpole[i])}`).join(" · ");
  if (k.code === "pn_sav" && Array.isArray(v.sav) && pnNum(v.sav[1]) !== null) return pnFmt(v.sav[1], "€");
  return "";
}
function ppTiles(s, kpis, period) {
  const { b, w } = ppBoardWeekAt(s.id, period);
  const cards = IN_AXES.split("").map((ax) => {
    const ks = kpis.filter((k) => k.axis === ax);
    if (!ks.length) return "";
    const reads = ks.map((k) => ({ k, r: inReading(s.id, k, period, null) }));
    const gap = reads.filter((x) => x.r.status === "gap").length, warn = reads.filter((x) => x.r.status === "warn").length;
    const badge = gap ? `<span class="pp-badge gap">${gap} hors cible</span>` : warn ? `<span class="pp-badge warn">${warn} à surveiller</span>` : reads.some((x) => x.r.status === "ok") ? '<span class="pp-badge ok">Dans la cible</span>' : reads.some((x) => x.r.status === "qualify") ? `<span class="pp-badge">${ks.some((k) => k.code === "pn_ca") ? "Objectif à saisir" : "À qualifier"}</span>` : '<span class="pp-badge">Sans mesure</span>';
    const rows = reads.map(({ k, r }) => {
      const extra = ppExtra(k, b, w);
      return `<button type="button" class="pp-line ${inTone(r.status)}" data-os="kpiDetail" data-args="${inArgs({ siteId: s.id, kpiId: k.id, period })}" data-in-cell="${esc(s.id)}:${esc(k.code)}" title="${esc(r.label)}" aria-label="${esc(r.label)}"><span class="pp-name">${esc(k.name)}${extra ? `<small>${esc(extra)}</small>` : ""}</span><b class="pp-val">${r.m ? osNum(r.m.value, 1) : "—"}<small>${r.m && r.unit ? esc(r.unit === "jours" ? "j" : r.unit) : ""}</small></b><span class="pp-tr">${inArrow(k, r.trend.delta)}${inSpark(r.trend.rows.slice(-6))}</span><span class="pp-target">${esc(ppTargetText(s.id, k))}</span></button>`;
    }).join("");
    const tops = ax === "C" && w ? ["top1", "top2", "top3"].map((id, i) => w.values?.[id] ? `<li><b>Top ${i + 1}</b> ${esc(w.values[id])}</li>` : "").join("") : "";
    return `<article class="pp-card" style="--pp-ax:${AXES[ax]?.color || "#555"}"><header><span class="pp-ax">${ax}</span><h3>${esc(PN_AXIS[ax]?.label || AXES[ax]?.label || ax)}</h3>${badge}</header>${rows}${tops ? `<ul class="pp-tops" aria-label="Pertes de la semaine">${tops}</ul>` : ""}</article>`;
  }).join("");
  const mat = inMaturity(s.id, period, null);
  const src = w ? `<p class="pp-src">Semaine du ${pnWeekLabel(w.week)} · reporté par ${esc(w.by || "—")}${b?.slot ? ` · TOP 5 du ${esc(b.slot.toLowerCase())}` : ""}${inCan("maturity") ? ` · <button type="button" class="md-link" data-in-nav="maturity">maturité ${mat.value === null ? "non évaluée" : osNum(mat.value) + " / 5"}</button>` : ""}</p>` : '<p class="pp-src">Aucun panneau reporté à cette date.</p>';
  return `${src}<div class="pp-cards">${cards}</div>`;
}
const ppKpisBase = inKpis;
inKpis = function () {
  const rows = ppKpisBase.apply(this, arguments);
  if (!ppOn()) return rows;
  const rank = (k) => { const i = PP_KPIS.findIndex((p) => p.code === k.code); return i < 0 ? 99 : i; };
  return rows.slice().sort((a, b) => IN_AXES.indexOf(a.axis) - IN_AXES.indexOf(b.axis) || rank(a) - rank(b));
};
const ppTilesBase = inTiles;
inTiles = function (s, kpis, period) { return ppOn() ? ppTiles(s, kpis, period) : ppTilesBase.apply(this, arguments); };

const ppUnifiedBase = renderUnifiedPilotage;
renderUnifiedPilotage = function () {
  const html = ppUnifiedBase.apply(this, arguments);
  if (!ppOn()) return html;
  return html.replace("<span>Tous les indicateurs</span>", "<span>Les indicateurs du panneau</span>").replace("<span>SQCDP, réaction et escalade</span>", "<span>Les sites côte à côte</span>")
    .replace("Tous les indicateurs d’un coup d’œil.", state.site === "group" ? "Les indicateurs des panneaux TOP 5, site par site. Le TRS reste dans Observer › TRS." : "Les lignes du panneau TOP 5, reportées chaque semaine. Le TRS reste dans Observer › TRS.");
};
const ppTowerBase = renderOSTower;
renderOSTower = function () {
  const html = ppTowerBase.apply(this, arguments);
  return ppOn() ? html.replace("Couleurs selon les seuils de chaque indicateur (Paramètres).", "Couleurs selon la cible de chaque usine (Paramètres › Cibles par usine) ; le CA se compare à l’objectif du site.") : html;
};

/* ---------- Décider · les sept panneaux côte à côte ---------- */

function ppSyncSqcdp() {
  const list = ppOn() ? PP_KPIS.filter((p) => osKpi(p.code) && !osKpi(p.code).archived_at).map((p) => ({ axis: p.axis, code: p.code, label: `${p.short} · ${p.name.toLowerCase()}`, unit: p.unit === "nombre" ? "" : p.unit === "jours" ? "j" : p.unit, direction: p.direction })) : PP_LEGACY_SQCDP.map((x) => ({ ...x }));
  GROUP_SQCDP.splice(0, GROUP_SQCDP.length, ...list);
}
const ppInitBase = osInit;
osInit = function () {
  if (pnUseClean && data && !data.meta?.demo && Array.isArray(data.kpis) && !ppOn()) { ppEnsureKpis(data); ppRebuildMeasures(data); try { save(); } catch { /* */ } }
  const out = ppInitBase.apply(this, arguments);
  ppSyncSqcdp();
  return out;
};
const ppSqcdpBase = renderGroupSqcdp;
renderGroupSqcdp = function () {
  ppSyncSqcdp();
  const html = ppSqcdpBase.apply(this, arguments);
  if (!ppOn()) return html;
  return html.replace('<div class="sqcdp-matrix"', `<div class="pp-scroll"><div class="sqcdp-matrix pp-sqcdp" style="--pp-cols:${GROUP_SQCDP.length}"`)
    .replace(/<\/div>(\s*)<p class="hint sqcdp-legend">/, '</div></div>$1<p class="hint sqcdp-legend">')
    .replace(/<h2 id="groupSqcdpTitle">SQCDP Groupe · (\d+) sites<\/h2><p>[^<]*<\/p>/, '<h2 id="groupSqcdpTitle">Les $1 panneaux TOP 5, côte à côte</h2><p>Une ligne par site, les indicateurs du panneau en colonnes. Réagir aux écarts, attribuer une suite et escalader au bon niveau.</p>')
    .replace(/(data-sqcdp-code="pn_ca"[^>]*>\s*<b>[\s\S]*?<\/b><span>)À qualifier(<\/span>)/g, "$1Objectif à saisir$2")
    .replace(/S Sécurité · Q Qualité · C Coûts \/ TRS · D Délais · P Personnel\./, "Les indicateurs du panneau TOP 5 de chaque site, sur la même semaine. Le CA se compare à l’objectif du site (gris tant qu’il n’est pas saisi).");
};

/* ---------- Paramètres : cibles par usine, rubriques par site ---------- */

const PP_RUBRIQUES = [
  ["Voir", [["top5", "TOP 5"], ["sqcdp", "SQCDP du jour (chef d’équipe)"], ["meetings", "Réunions"], ["tour", "Tour de contrôle"], ["analysis", "Écarts"], ["gains", "Gains"], ["env", "Environnement"], ["maturity", "Maturité"], ["roadmap", "Roadmap"], ["hoshin", "Hoshin"]]],
  ["Observer", [["gemba", "Gemba"], ["signals", "Signaux"], ["micro", "TRS"], ["tpm", "TPM"], ["5s", "5S"], ["audits", "Audits"], ["etonnement", "Rapport d’étonnement"], ["stats", "Statistiques"]]],
  ["Résoudre", [["nc", "Non-conformités"], ["resolution", "A3 · 8D · QRQC"], ["kaizen", "Kaizen"], ["projects", "Chantiers"], ["smed", "SMED"], ["equilibrage", "Équilibrage"]]],
  ["Agir", [["actions", "Plan d’actions"]]],
  ["Pérenniser", [["documents", "Standards"], ["ech", "Échantillothèque"], ["practices", "Bonnes pratiques"], ["opl", "OPL"], ["training", "Formation"], ["polyvalence", "Polyvalence"], ["deployment", "Déploiement"]]],
];
const PP_BASE = ["top5", "actions", "signals", "gemba", "micro"];
const PP_ALWAYS = new Set(["pilotage", "daily"]);
function ppRubOn(siteId, key) { const m = data.settings?.siteRubriques?.[siteId]; if (!m) return true; return key in m ? m[key] !== false : m._default !== false; }
function ppRubVisible(key) {
  if (PP_ALWAYS.has(key)) return true;
  if (state.site && state.site !== "group") return ppRubOn(state.site, key);
  const sites = OPERATIONAL_SITES.filter((s) => allowedSite(s.id));
  return !sites.length || sites.some((s) => ppRubOn(s.id, key));
}
function ppBaseMap() { return { _default: false, ...Object.fromEntries(PP_BASE.map((k) => [k, true])) }; }

if (typeof PM_TABS !== "undefined") PM_TABS.splice(4, 0, ["targets", "Cibles par usine"], ["rubriques", "Rubriques par site"]);
function ppTargetsTab() {
  const ks = PP_KPIS.filter((p) => p.code !== "pn_jsa").map((p) => osKpi(p.code)).filter((k) => k && !k.archived_at);
  if (!ks.length) return empty("Les indicateurs du panneau ne sont pas actifs.");
  const admin = osIsAdmin() && !role().readonly, u = (k) => (inUnit(k) === "nombre" ? "" : inUnit(k));
  const head = ks.map((k) => `<th scope="col"><span class="pm-axis a-${esc(k.axis)}">${esc(k.axis)}</span> ${esc(inShort(k))}<small>${k.code === "pn_ca" ? "objectif k€ / semaine" : `Groupe ${k.direction === "high" ? "≥" : "≤"} ${osNum(k.target)}${u(k) ? " " + esc(u(k)) : ""}`}</small></th>`).join("");
  const rows = OPERATIONAL_SITES.map((s) => `<tr><th scope="row">${esc(s.name)}</th>${ks.map((k) => { const v = ppSiteTarget(s.id, k.code); return `<td><input type="number" inputmode="decimal" step="any" min="0" name="pp-${esc(s.id)}-${esc(k.code)}" value="${v === null ? "" : esc(String(v))}" placeholder="${k.code === "pn_ca" ? "à saisir" : esc(osNum(k.target))}" aria-label="${esc(`${s.name} · ${k.name}`)}" ${admin ? "" : "disabled"}></td>`; }).join("")}</tr>`).join("");
  return `<form id="ppTargets" class="pp-targets" novalidate><p class="hint pm-note">Case vide : la cible du Groupe (en gris) s’applique. Pour affiner une usine, saisir sa propre cible. Le CA n’a pas de cible Groupe : sans objectif, la case reste grise dans le pilotage. Jours sans accident : vert s’il n’y a pas eu d’accident dans la semaine, partout.</p><div class="pp-scroll"><table class="pp-table"><thead><tr><th scope="col">Usine</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>${admin ? '<div class="form-actions"><button type="submit" class="btn">Enregistrer les cibles</button><span class="hint">Les couleurs du pilotage sont recalculées pour toutes les semaines.</span></div>' : '<p class="hint">Réservé au Responsable Lean.</p>'}</form>`;
}
function ppSaveTargets(form) {
  if (!osIsAdmin()) return;
  const ks = PP_KPIS.filter((p) => p.code !== "pn_jsa").map((p) => p.code), next = {};
  for (const s of OPERATIONAL_SITES) for (const c of ks) {
    const raw = String(form.elements[`pp-${s.id}-${c}`]?.value ?? "").trim().replace(",", ".");
    if (raw === "") continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) { toast(`Valeur invalide : ${getSiteName(s.id)} · ${ppDef(c)?.short}`); return; }
    (next[s.id] ||= {})[c] = v;
  }
  if (!commitData(() => {
    data.settings.siteTargets = next;
    for (const m of data.measures || []) if (String(m.code).startsWith("pn_") && OPERATIONAL_SITES.some((s) => s.id === m.site_id)) m.target = ppSiteTarget(m.site_id, m.code);
  })) return;
  render(); toast("Cibles enregistrées : le pilotage est recalculé.");
}
function ppRubriquesTab() {
  const admin = osIsAdmin() && !role().readonly, sites = OPERATIONAL_SITES;
  const count = (s) => PP_RUBRIQUES.flatMap(([, l]) => l).filter(([k]) => ppRubOn(s.id, k)).length, total = PP_RUBRIQUES.flatMap(([, l]) => l).length;
  const head = sites.map((s) => `<th scope="col"><span>${esc(s.name)}</span><small>${count(s)}/${total}</small>${admin ? `<span class="pp-col-act"><button type="button" class="md-link" data-pp-rub-site="${esc(s.id)}" data-pp-rub-set="base">Base</button> · <button type="button" class="md-link" data-pp-rub-site="${esc(s.id)}" data-pp-rub-set="all">Tout</button></span>` : ""}</th>`).join("");
  const body = PP_RUBRIQUES.map(([stage, list]) => `<tr class="pp-stage"><th scope="rowgroup" colspan="${sites.length + 1}">${esc(stage)}</th></tr>${list.map(([k, l]) => `<tr><th scope="row">${esc(l)}${PP_BASE.includes(k) ? ' <small class="pp-base">base</small>' : ""}</th>${sites.map((s) => `<td><input type="checkbox" data-pp-rub="${esc(s.id)}|${esc(k)}" ${ppRubOn(s.id, k) ? "checked" : ""} ${admin ? "" : "disabled"} aria-label="${esc(`${l} visible pour ${s.name}`)}"></td>`).join("")}</tr>`).join("")}`).join("");
  return `<div class="pp-rub"><p class="hint pm-note">Une case cochée : la rubrique est visible pour ce site. On démarre avec la base (TOP 5, plan d’actions, signaux, Gemba et TRS) et on coche le reste quand le site est prêt. Toujours visibles : Accueil, Pilotage, Aujourd’hui et Paramètres. La vue Groupe montre une rubrique dès qu’un site l’a.</p>${admin ? '<div class="pm-head"><button type="button" class="btn secondary small" data-pp-rub-all="base">Base partout</button><button type="button" class="btn secondary small" data-pp-rub-all="all">Tout afficher partout</button></div>' : ""}<div class="pp-scroll"><table class="pp-table pp-rub-table"><thead><tr><th scope="col">Rubrique</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${admin ? "" : '<p class="hint">Réservé au Responsable Lean.</p>'}</div>`;
}
function ppSetRub(fn, msg) {
  if (!osIsAdmin()) return;
  if (!commitData(() => { data.settings.siteRubriques ||= {}; fn(data.settings.siteRubriques); })) return;
  render(); if (msg) toast(msg);
}
const ppPmPageBase = typeof pmPage === "function" ? pmPage : null;
if (ppPmPageBase) pmPage = function () {
  const tab = pmTab();
  if (!["targets", "rubriques"].includes(tab)) return ppPmPageBase.apply(this, arguments);
  let base = "";
  const keep = state.adminTab;
  try { state.adminTab = "sites"; base = typeof pmAdminBase === "function" ? pmAdminBase() : ""; } catch { base = ""; } finally { state.adminTab = keep; }
  const backups = (base.match(/<section class="panel section"><h2>Données et sauvegardes<\/h2>[\s\S]*<\/section>$/) || [""])[0];
  const tabs = `<div class="tabs pm-tabs" role="tablist">${PM_TABS.map(([k, l]) => `<button type="button" class="tab ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-pm-tab="${k}">${l}</button>`).join("")}</div>`;
  return `${pageHead("Administration", "Paramètres", "Sites, ateliers, personnes, indicateurs et règles : ce que l’appli doit connaître pour dire vrai.")}${pmHealth(tab)}${tabs}<div class="pm-body">${tab === "targets" ? ppTargetsTab() : ppRubriquesTab()}</div>${backups}`;
};

/* ---------- Rubriques masquées : onglets et étapes ---------- */

const ppTabsBase = uxTabs;
uxTabs = function (stage) { return ppTabsBase.apply(this, arguments).filter((t) => ppRubVisible(t.key)); };
const ppStagesBase = uxStages;
uxStages = function () { return ppStagesBase.apply(this, arguments).filter((s) => uxTabs(s).length); };

/* ---------- Réunions : le TOP 5 au jour du panneau ---------- */

function ppBoardsIn(site) { return (data.boards || []).filter((b) => !b.archived_at && OPERATIONAL_SITES.some((s) => s.id === b.site_id) && (!site || b.site_id === site) && allowedSite(b.site_id)); }
function ppNextMeeting(b) { const m = pnMonday(), d = pnMeetingDay(b, m); return d >= today() ? d : pnMeetingDay(b, pnDate(m, 7)); }
function ppBoardLine(b) {
  const m = pnCurrentWeek(b), wk = pnWeek(b, m), next = ppNextMeeting(b), n = reDays(next), open = pnSubjects(b).filter((a) => pnStatusOf(a).key !== "resolu").length;
  const time = String(b.slot || "").replace(/^\S+\s*/, "");
  const when = n === 0 ? `Aujourd’hui${time ? " · " + time : ""}` : n === 1 ? `Demain${time ? " · " + time : ""}` : `${new Date(next + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}${time ? " · " + time : ""}`;
  const done = wk ? `Dernier TOP 5 reporté le ${new Date(wk.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} par ${wk.by || "—"}` : `TOP 5 du ${new Date(pnMeetingDay(b, m) + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} à reporter`;
  return `<li class="${wk ? "" : "late"} ${n <= 1 ? "soon" : ""}"><button type="button" class="re-week-main" data-pp-board="${esc(b.site_id)}"><b class="cg-site">${esc(getSiteName(b.site_id))}</b><span>${esc(when)}</span><small>${esc(done)}${open ? ` · ${jnPlural(open, "sujet ouvert", "sujets ouverts")}` : ""}</small></button></li>`;
}
const ppCgOverviewBase = typeof cgOverview === "function" ? cgOverview : null;
if (ppCgOverviewBase) cgOverview = function () {
  const html = ppCgOverviewBase.apply(this, arguments), site = state.site === "group" ? null : state.site, boards = ppBoardsIn(site);
  if (!boards.length) return html;
  const done = boards.filter((b) => pnWeek(b, pnCurrentWeek(b))).length;
  const slots = [...new Set(boards.map((b) => b.slot).filter(Boolean))];
  const sub = boards.length === 1 && boards[0].slot ? `Atelier · chaque ${boards[0].slot.toLowerCase()} · devant le panneau` : "Atelier · chaque semaine · devant le panneau";
  const out = html.replace(/(<b>TOP 5<\/b><small>)[^<]*(<\/small><\/div><span class="cg-now">)[^<]*(<\/span>)/, `$1${esc(sub)}$2${done}/${boards.length} panneau${boards.length > 1 ? "x" : ""} reporté${done > 1 ? "s" : ""}$3`);
  const list = boards.slice().sort((a, b) => ppNextMeeting(a).localeCompare(ppNextMeeting(b)) || String(a.slot).localeCompare(String(b.slot)));
  return `${out}<section class="section pp-top5-week"><h2 class="re-h2">TOP 5 des ateliers · chaque semaine, devant le panneau</h2><p class="hint">Le TOP 5 se tient au feutre devant le panneau, au jour et à l’heure de chaque site${slots.length > 1 ? "" : slots[0] ? ` (${esc(slots[0].toLowerCase())})` : ""}, puis il est reporté dans l’application. Ce qu’il remonte arrive au TOP 15 du lendemain.</p><ul class="re-week">${list.map(ppBoardLine).join("")}</ul></section>`;
};
if (typeof cgBlock === "function") {
  const ppCgBlockBase = cgBlock;
  cgBlock = function (key, r) {
    const out = ppCgBlockBase.apply(this, arguments);
    if (key !== "lettres" || !out || !r?.site_id) return out;
    const b = ppBoardsIn(r.site_id)[0];
    if (!b) return out;
    const m = pnCurrentWeek(b), wk = pnWeek(b, m), prev = pnPrev(b, m), bad = wk ? (b.rows || []).filter((x) => pnTrend(x, wk.values?.[x.id], prev?.values?.[x.id])?.tone === "bad").length : 0;
    const fact = `<p class="re-fact pp-fact">TOP 5 hebdomadaire au panneau · ${esc(b.slot || "")} · ${wk ? `reporté par ${esc(wk.by || "—")}, ${jnPlural(bad, "indicateur en recul", "indicateurs en recul")}` : "dernier TOP 5 pas encore reporté"}</p>`;
    return { ...out, html: fact + out.html.replace(/TOP 5 tenus? aujourd’hui/, "points SQCDP du jour tenus") };
  };
}

/* ---------- Exemple et installation neuve ---------- */

// 8.50.1 — L’exemple a ses gens : un responsable par site et les personnes de chaque site (noms fictifs).
const PP_DIRECTORS = { "ag-deco": "Christine L.", europlacage: "Olivier M.", "le-moine": "Bruno C.", marzin: "Thomas G.", "oraison-menuiserie": "Stéphane R.", profiline: "Hélène D.", sodeplax: "Frédéric V." };
function ppDemoPeople(base) {
  const bare = (x) => String(x || "").replace(/\s*\(.*\)\s*$/, "").trim();
  const users = [], seen = new Set(), at = new Date().toISOString();
  const add = (name, site_id, role, title) => { const n = bare(name), key = `${site_id}|${n}`; if (!n || seen.has(key)) return; seen.add(key); users.push({ id: `USR-${String(users.length + 1).padStart(3, "0")}`, name: n, site_id, role, title, email: "", active: true, created_at: at, updated_at: at }); };
  add("Responsable Lean Groupe", "group", "lean", "Responsable Lean multisite");
  add("Direction générale", "group", "dg", "Direction générale");
  for (const s of (base.sites || []).filter((x) => x.kind === "site" && !x.archived_at)) {
    const dir = PP_DIRECTORS[s.id] || "Directeur de site";
    s.owner = dir;
    add(dir, s.id, "director", "Directeur de site");
    if (s.id === "marzin" && typeof PN_PEOPLE !== "undefined") {
      const P = PN_PEOPLE;
      [[P.lead, "teamlead"], [P.lead2, "teamlead"], [P.meth, "teamlead"], [P.qual, "teamlead"], [P.maint, "operator"], [P.op1, "operator"], [P.op2, "operator"], [P.op3, "operator"], [P.op4, "operator"]].forEach(([n, r]) => add(n, s.id, r, String(n).match(/\((.*)\)/)?.[1] || ""));
    } else if (typeof EX_SITES !== "undefined" && EX_SITES[s.id]) {
      const X = EX_SITES[s.id];
      add(X.lead, s.id, "teamlead", String(X.lead).match(/\((.*)\)/)?.[1] || "Chef d’équipe");
      add(X.maint, s.id, "operator", "maintenance");
    }
  }
  for (const w of base.workshops || []) if (!w.owner || /^à /i.test(w.owner)) { const s = w.site_id; w.owner = s === "marzin" && typeof PN_PEOPLE !== "undefined" ? bare(PN_PEOPLE.lead) : typeof EX_SITES !== "undefined" && EX_SITES[s] ? bare(EX_SITES[s].lead) : w.owner; }
  base.users = users;
}
const ppCleanBase = pnCleanDemo;
pnCleanDemo = function () {
  const base = ppCleanBase.apply(this, arguments);
  base.meta.demo_revision = 12;
  ppEnsureKpis(base);
  ppDemoPeople(base);
  base.settings.siteRubriques = {};
  ppRebuildMeasures(base);
  return base;
};
const ppFreshBase = osFreshData;
osFreshData = function (demo) {
  const base = ppFreshBase.apply(this, arguments);
  if (!demo && pnUseClean && base?.settings) { ppEnsureKpis(base); base.settings.siteRubriques = Object.fromEntries((base.sites || []).filter((s) => s.kind === "site").map((s) => [s.id, ppBaseMap()])); }
  return base;
};

/* ---------- Branchements ---------- */

function ppBind(root = document) {
  const f = root.querySelector("#ppTargets");
  if (f) f.onsubmit = (e) => { e.preventDefault(); ppSaveTargets(f); };
  root.querySelectorAll("[data-pp-rub]").forEach((c) => (c.onchange = () => { const [s, k] = c.dataset.ppRub.split("|"), on = c.checked; ppSetRub((map) => { map[s] ||= { _default: true }; map[s][k] = on; }); }));
  root.querySelectorAll("[data-pp-rub-site]").forEach((b) => (b.onclick = () => { const s = b.dataset.ppRubSite, all = b.dataset.ppRubSet === "all"; ppSetRub((map) => { map[s] = all ? { _default: true } : ppBaseMap(); }, `${getSiteName(s)} : ${all ? "toutes les rubriques" : "rubriques de base"}.`); }));
  root.querySelectorAll("[data-pp-rub-all]").forEach((b) => (b.onclick = () => { const all = b.dataset.ppRubAll === "all"; ppSetRub((map) => { for (const s of OPERATIONAL_SITES) map[s.id] = all ? { _default: true } : ppBaseMap(); }, all ? "Toutes les rubriques visibles partout." : "Rubriques de base sur tous les sites."); }));
  root.querySelectorAll("[data-pp-board]").forEach((b) => (b.onclick = () => {
    const s = b.dataset.ppBoard;
    if (canGroup() || s === state.site) { state.site = s; try { localStorage.setItem("biaSite", s); } catch { /* */ } }
    state.pnWeek = null; state.pnEdit = null;
    const tab = uxTabs(uxStages().find((x) => x.id === "voir")).find((t) => t.key === "top5");
    if (tab) { uxGo(tab); scrollTo(0, 0); } else render();
  }));
}
const ppOsBindBase = osBind;
osBind = function () { const out = ppOsBindBase.apply(this, arguments); ppBind(document); return out; };

if (typeof ER_NEWS !== "undefined") ER_NEWS.unshift({ v: "8.50", label: "Le pilotage parle la langue du panneau", text: "Les indicateurs du panneau TOP 5 deviennent ceux du pilotage, avec une cible par usine ; chaque site n’affiche que les rubriques cochées pour lui ; le TOP 5 apparaît dans Réunions au jour de son panneau.", nav: "pilotage", set: { pilotageMode: "analysis", osTab: "tower" } });
