"use strict";
// 8.1 — Voir › Pilotage › Analyser : tous les indicateurs d’un coup d’œil.
// Une matrice sites × indicateurs (ou des tuiles pour un seul site), sans menu
// déroulant : chaque case ouvre la courbe et les dossiers liés ; les périodes
// se parcourent avec ‹ › ; les sites et l’historique se choisissent par puces.

const IN_AXES = "SQCDP";
const IN_SHORT = { safety_signal: "Sécurité", scrap: "Rebut", trs: "TRS", service: "Service", staffing: "Compétences" };

function inKpis() {
  const rank = (k) => { const i = IN_AXES.indexOf(k.axis); return i < 0 ? 9 : i; };
  return osActive(data.kpis).slice().sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), "fr"));
}
function inShort(k) {
  return IN_SHORT[k.code] || String(k.name || k.code || "").split(/[ ·(]/)[0];
}
function inUnit(k) {
  return k.unit === "nombre" ? "" : k.unit || "";
}
function inTone(status) {
  return ["gap", "warn", "ok"].includes(status) ? status : "none";
}
function inCan(view) {
  return role().nav.includes(view);
}
function inArgs(args) {
  return esc(JSON.stringify(args));
}
// Évolution depuis le relevé précédent, jugée selon le sens du progrès de l’indicateur.
function inArrow(k, delta) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "";
  if (delta === 0) return '<i class="in-arrow" aria-hidden="true">→</i>';
  const better = k.direction === "high" ? delta > 0 : delta < 0;
  return `<i class="in-arrow ${better ? "up" : "down"}" aria-hidden="true">${delta > 0 ? "↗" : "↘"}</i>`;
}
function inSpark(rows) {
  const values = rows.map((r) => r.value).filter(Number.isFinite);
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => `${2 + (i * 56) / (values.length - 1)},${15 - ((v - min) * 12) / (max - min || 1)}`).join(" ");
  return `<svg class="in-spark" viewBox="0 0 60 18" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function inReading(siteId, k, period, workshopId) {
  const m = osLatest(siteId, k.id, period, workshopId),
    status = osStatus(m, k),
    trend = osKpiTrend(siteId, k.id, workshopId, period),
    target = m ? (osFinite(m.target) ? m.target : k.target) : k.target,
    gap = osNormalizedGap(m, k),
    unit = inUnit(k);
  const label = [
    `${getSiteName(siteId)} · ${k.name}`,
    m ? `${osNum(m.value, 2)}${unit ? " " + unit : ""}` : "aucune mesure",
    osStatusText(status),
    osFinite(target) ? `cible ${osNum(target)}${unit ? " " + unit : ""}` : "cible à définir",
    Number.isFinite(gap) ? `${osNum(Math.abs(gap))} % ${gap >= 0 ? "favorable" : "défavorable"}` : "",
    m ? `relevé du ${shortDate(m.period)}` : "",
    trend.count > 1 ? `${trend.count} relevés hors cible de suite` : "",
  ].filter(Boolean).join(" · ");
  return { m, status, trend, target, gap, unit, label };
}
function inMaturity(siteId, period, workshopId = null) {
  const rows = data.settings.pillars.map((p) => osMaturity(siteId, p, period, workshopId)).filter(Boolean);
  return { value: rows.length ? rows.reduce((n, r) => n + Number(r.level), 0) / rows.length : null, filled: rows.length, total: data.settings.pillars.length };
}
function inLate(siteId) {
  return osActive(data.actions).filter((a) => a.site_id === siteId && isLate(a)).length;
}
function inPeriods(sites) {
  const ids = new Set(sites.map((s) => s.id));
  return [...new Set(osActive(data.measures).filter((m) => ids.has(m.site_id) && osFinite(m.value) && /^\d{4}-\d{2}-\d{2}$/.test(m.period || "") && m.period <= today()).map((m) => m.period))].sort();
}
// ‹ › : parcourir des périodes sans liste déroulante.
function inStepper(kind, label, older, newer, aria) {
  const btn = (to, dir, text) => `<button type="button" class="in-step-btn" data-in-step="${kind}" data-in-to="${esc(to ?? "")}" ${to === null ? "disabled" : ""} aria-label="${dir}">${text}</button>`;
  return `<div class="in-step" role="group" aria-label="${esc(aria)}">${btn(older, "Période précédente", "‹")}<span class="in-step-label">${esc(label)}</span>${btn(newer, "Période suivante", "›")}</div>`;
}
function inDateStepper(sites) {
  const periods = inPeriods(sites), current = state.osPeriod || today(), isToday = current === today();
  const older = periods.filter((p) => p < current).at(-1) || null;
  const later = periods.find((p) => p > current);
  const newer = isToday ? null : later && later < today() ? later : "";
  return inStepper("os", isToday ? `Aujourd’hui · ${shortDate(current)}` : `Au ${shortDate(current)}`, older, newer, "Date de la situation");
}
function inBenchStepper(periods, period) {
  const index = periods.indexOf(period);
  const older = index >= 0 && index + 1 < periods.length ? periods[index + 1] : null;
  const newer = index > 0 ? periods[index - 1] : null;
  return inStepper("bench", period ? `${/^\d{4}-\d{2}-\d{2}$/.test(period) ? shortDate(period) : period}${/^S\d+$/.test(period) ? " · année à qualifier" : ""}` : "Aucune mesure", older, newer, "Période commune");
}

function inCell(site, k, period) {
  const r = inReading(site.id, k, period, null);
  return `<button type="button" role="cell" class="in-cell ${inTone(r.status)}" data-os="kpiDetail" data-args="${inArgs({ siteId: site.id, kpiId: k.id, period })}" data-in-cell="${esc(site.id)}:${esc(k.code)}" title="${esc(r.label)}" aria-label="${esc(r.label)}"><b>${r.m ? osNum(r.m.value, 1) : "—"}</b>${inArrow(k, r.trend.delta)}${inSpark(r.trend.rows.slice(-6))}</button>`;
}
function inMatrix(sites, kpis, period) {
  const head = kpis.map((k) => {
    const unit = inUnit(k);
    return `<span role="columnheader" class="in-col" title="${esc(`${k.name} · cible ${osNum(k.target)}${unit ? " " + unit : ""} · ${k.direction === "high" ? "plus est mieux" : "moins est mieux"}`)}"><b>${esc(k.axis || "·")}</b><em>${esc(inShort(k))}</em><small>${unit ? esc(unit) : "nb"}</small></span>`;
  }).join("");
  const rows = sites.map((s) => {
    const mat = inMaturity(s.id, period), late = inLate(s.id);
    const matLabel = `${s.name} · maturité ${mat.value === null ? "non évaluée" : osNum(mat.value) + " sur 5"} · ${mat.filled}/${mat.total} piliers renseignés`;
    const lateLabel = `${s.name} · ${late} action(s) en retard`;
    const matCell = inCan("maturity") ? `<button type="button" role="cell" class="in-cell in-extra" data-in-nav="maturity" title="${esc(matLabel)}" aria-label="${esc(matLabel)}"><b>${mat.value === null ? "—" : osNum(mat.value)}</b></button>` : `<span role="cell" class="in-cell in-extra" title="${esc(matLabel)}"><b>${mat.value === null ? "—" : osNum(mat.value)}</b></span>`;
    const lateCell = inCan("actions") ? `<button type="button" role="cell" class="in-cell in-extra ${late ? "late" : ""}" data-in-nav="actions" title="${esc(lateLabel)}" aria-label="${esc(lateLabel)}"><b>${late}</b></button>` : `<span role="cell" class="in-cell in-extra ${late ? "late" : ""}" title="${esc(lateLabel)}"><b>${late}</b></span>`;
    return `<div class="in-row" role="row"><button type="button" role="rowheader" class="in-site" data-in-site="${esc(s.id)}" title="Courbes de ${esc(s.name)}">${esc(s.name)}</button>${kpis.map((k) => inCell(s, k, period)).join("")}${matCell}${lateCell}</div>`;
  }).join("");
  return `<div class="in-matrix-wrap"><div class="in-matrix" role="table" aria-label="Indicateurs des ${sites.length} sites" style="--in-cols:${kpis.length + 2}"><div class="in-row in-head" role="row"><span role="columnheader" class="in-corner">Site</span>${head}<span role="columnheader" class="in-col in-col-extra" title="Maturité moyenne des piliers renseignés, sur 5"><b class="in-alt">Mat.</b><em>Maturité</em><small>/5</small></span><span role="columnheader" class="in-col in-col-extra" title="Actions en retard"><b class="in-alt">Ret.</b><em>Retards</em><small>actions</small></span></div>${rows}</div></div>`;
}
function inTiles(s, kpis, period) {
  const ws = state.workshop || null, mat = inMaturity(s.id, period, ws);
  const tiles = kpis.map((k) => {
    const r = inReading(s.id, k, period, ws);
    return `<button type="button" class="in-tile ${inTone(r.status)}" data-os="kpiDetail" data-args="${inArgs({ siteId: s.id, kpiId: k.id, period })}" data-in-cell="${esc(s.id)}:${esc(k.code)}" title="${esc(r.label)}" aria-label="${esc(r.label)}"><span class="in-tile-name"><b>${esc(k.axis || "·")}</b>${esc(k.name)}</span><strong>${r.m ? osNum(r.m.value, 1) : "—"}<small>${esc(r.unit)}</small>${inArrow(k, r.trend.delta)}</strong><span class="in-tile-meta">${osFinite(r.target) ? `cible ${osNum(r.target)}${r.unit ? " " + esc(r.unit) : ""}` : "cible à définir"}${r.m ? ` · ${shortDate(r.m.period)}` : " · aucune mesure"}</span>${inSpark(r.trend.rows.slice(-8))}</button>`;
  }).join("");
  const matTile = `<${inCan("maturity") ? 'button type="button" data-in-nav="maturity"' : "div"} class="in-tile neutral"><span class="in-tile-name">Maturité</span><strong>${mat.value === null ? "—" : osNum(mat.value)}<small>/5</small></strong><span class="in-tile-meta">${mat.filled}/${mat.total} piliers renseignés</span></${inCan("maturity") ? "button" : "div"}>`;
  return `<div class="in-tiles">${tiles}${matTile}</div>`;
}
function inDrifts() {
  const rows = osSuggestions().sort((a, b) => b.basis.length - a.basis.length),
    limit = interfaceMode() === "essential" ? 4 : 6;
  if (!rows.length) return "";
  return `<section class="in-block"><div class="in-block-head"><h2>À creuser</h2><span class="hint">Hors cible plusieurs relevés de suite</span>${rows.length > limit && inCan("analysis") ? `<button type="button" class="btn ghost small" data-in-nav="analysis">Tout voir · ${rows.length}</button>` : ""}</div><div class="in-drifts">${rows.slice(0, limit).map((s) => {
    const k = osKpi(s.kpi_id), status = osStatus(osLatest(s.site_id, s.kpi_id), k);
    return `<article class="in-drift ${inTone(status)}"><button type="button" class="in-drift-main" data-os="kpiDetail" data-args="${inArgs({ siteId: s.site_id, kpiId: s.kpi_id })}"><b>${esc(s.title)}</b><span>${esc(s.detail)}</span></button>${s.practices.length ? `<div class="in-drift-bp"><span>Pratique validée ailleurs</span>${s.practices.map((id) => recordLink(id, osTitle(osRecord(id)?.row) || "Pratique")).join("")}</div>` : ""}</article>`;
  }).join("")}</div></section>`;
}
function inCounters() {
  const items = [
    ["actions", osScope(data.actions).filter(isLate).length, "action en retard", "actions en retard"],
    ["resolution", osScope(data.problems).filter((p) => p.status !== "Clos").length, "problème ouvert", "problèmes ouverts"],
    ["terrain", osScope(data.signals).filter((s) => s.severity === "Critique" && isOpenSignal(s)).length, "alerte critique", "alertes critiques"],
  ];
  return `<div class="in-counters">${items.map(([view, n, one, many]) => {
    const inner = `<strong>${n}</strong><span>${n > 1 ? many : one}</span>`;
    return inCan(view) ? `<button type="button" class="in-counter ${n && view !== "resolution" ? "alert" : ""}" data-in-nav="${view}">${inner}</button>` : `<div class="in-counter ${n && view !== "resolution" ? "alert" : ""}">${inner}</div>`;
  }).join("")}</div>`;
}
function inGains() {
  const gains = Object.entries(osValidatedGains(osScope(data.gains)));
  if (!gains.length) return "";
  return `<section class="in-block"><div class="in-block-head"><h2>Gains vérifiés</h2></div><div class="in-gains">${gains.map(([unit, v]) => `<div class="in-gain"><strong>${esc(osNum(v))}</strong><span>${esc(unit)}</span></div>`).join("")}</div></section>`;
}
function inEnvironment() {
  const rows = osScope(data.environmentLogs);
  if (rows.length) return osEnvironmentPanel().replace('<details class="panel section os-environment">', '<section class="panel section os-environment">').replace(/<summary>([\s\S]*?)<\/summary>/, '<h2 class="os-environment-title">$1</h2>').replace(/<\/details>$/, "</section>");
  if (!osManager() || role().readonly) return "";
  return `<p class="in-env-empty os-environment">Énergie, déchets et CO₂ : aucun relevé. ${os74Button("Saisir un relevé", "environment")}</p>`;
}

// Analyser : la matrice d’abord, puis ce qui demande une suite.
renderOSTower = function () {
  const group = state.site === "group",
    sites = OPERATIONAL_SITES.filter((s) => group || s.id === state.site),
    kpis = inKpis(),
    period = state.osPeriod || today();
  if (!kpis.length || !sites.length) return empty("Aucun indicateur actif. Définissez les KPI dans Paramètres.");
  const statuses = sites.flatMap((s) => kpis.map((k) => osStatus(osLatest(s.id, k.id, period, group ? null : state.workshop || null), k)));
  const count = (status) => statuses.filter((x) => x === status).length;
  const keys = [["gap", "écart", "écarts"], ["warn", "vigilance", "vigilances"], ["ok", "cible atteinte", "cibles atteintes"], ["missing", "sans mesure", "sans mesure"], ["qualify", "à qualifier", "à qualifier"]]
    .filter(([status]) => !["missing", "qualify"].includes(status) || count(status))
    .map(([status, one, many]) => `<span class="in-key ${inTone(status)}"><i aria-hidden="true"></i><b>${count(status)}</b> ${count(status) > 1 ? many : one}</span>`).join("");
  const add = !role().readonly && osManager() ? '<button type="button" class="btn secondary small" data-new-benchmark>+ Relevé</button>' : "";
  return `<section class="panel in-wall" aria-label="Tous les indicateurs"><div class="in-wall-head"><div class="in-keys" role="status">${keys}</div><div class="in-wall-tools">${inDateStepper(sites)}${add}</div></div>${group ? inMatrix(sites, kpis, period) : inTiles(sites[0], kpis, period)}<p class="in-foot">Touchez une case : courbe, cible et dossiers liés.${group ? " Touchez un site : ses courbes." : ""} Couleurs selon les seuils de chaque indicateur (Paramètres). ↗ ↘ évolution depuis le relevé précédent, verte si favorable. Aucune moyenne entre sites.${data.meta.demo ? " Données de démonstration fictives." : ""}</p></section>${inCounters()}${inDrifts()}${inGains()}${inEnvironment()}`;
};

// Courbes d’un site : puces de site et d’historique à la place des menus.
renderPilotage = function () {
  const group = state.site === "group",
    selected = group ? (OPERATIONAL_SITES.some((s) => s.id === state.pilotSite) ? state.pilotSite : OPERATIONAL_SITES[0].id) : state.site,
    decisions = scoped(data.decisions).filter((d) => d.status !== "Clos"),
    critical = scoped(data.signals).filter((s) => s.severity === "Critique" && isOpenSignal(s)),
    hist = state.period === "4" || state.period === "8" ? state.period : "all";
  if (group) state.pilotSite = selected;
  const sitesChips = group ? `<div class="in-chips" role="group" aria-label="Site observé">${OPERATIONAL_SITES.map((s) => `<button type="button" class="in-chip ${s.id === selected ? "active" : ""}" data-in-site="${esc(s.id)}" aria-pressed="${s.id === selected}">${esc(s.name)}</button>`).join("")}</div>` : "";
  const histChips = `<div class="in-chips in-chips-small" role="group" aria-label="Historique affiché">${[["all", "Tout"], ["8", "8 relevés"], ["4", "4 relevés"]].map(([v, l]) => `<button type="button" class="in-chip ${v === hist ? "active" : ""}" data-in-hist="${v}" aria-pressed="${v === hist}">${l}</button>`).join("")}</div>`;
  const add = !role().readonly && osManager() ? '<button type="button" class="btn secondary small" data-new-benchmark>+ Relevé</button>' : "";
  const charts = inKpis().map((k) => pilotageChart(indicatorSeries(selected, k.code), { code: k.code, title: k.name, direction: k.direction === "high" ? "high" : "low", unit: inUnit(k), contextLabel: getSiteName(selected) })).join("");
  return `<div id="pilotDetail" class="in-curves-bar">${sitesChips}<div class="in-curves-tools">${histChips}${add}</div></div>${group ? '<p class="hint in-curves-note">Pas de moyenne Groupe des pourcentages : chaque site garde sa définition et sa source.</p>' : ""}<div class="grid cols-2 section in-curves">${charts}</div><section class="section"><div class="section-title"><h2>Décisions et alertes · ${esc(site().name)}</h2>${!role().readonly ? '<button class="btn secondary" data-new-decision>+ Décision / escalade</button>' : ""}</div><div class="list">${decisions.map((d) => `<article class="row"><div><b>${esc(d.title)}</b><p class="hint">${esc(getSiteName(d.site_id))} · ${esc(d.owner)} · ${shortDate(d.due_date)}</p></div>${recordLink(d.id, "Décider")}</article>`).join("")}${critical.map((s) => `<article class="row"><div>${pill("Critique", "critical")}<b>${esc(s.description)}</b></div>${recordLink(s.id, "Ouvrir")}</article>`).join("")}${!decisions.length && !critical.length ? empty("Aucune décision ouverte ni signal critique sur ce périmètre.") : ""}</div></section>`;
};

const inUnifiedPilotageBase = renderUnifiedPilotage;
renderUnifiedPilotage = function () {
  if (state.pilotageMode === "ritual") return inUnifiedPilotageBase();
  const group = state.site === "group", detailed = state.osTab === "detail";
  const tabs = `<div class="pilotage-switch" role="tablist" aria-label="Mode de pilotage"><button type="button" role="tab" aria-selected="true" class="active" data-pilotage-mode="analysis"><b>Analyser</b><span>Tous les indicateurs</span></button><button type="button" role="tab" aria-selected="false" data-pilotage-mode="ritual"><b>Décider</b><span>SQCDP, réaction et escalade</span></button></div>`;
  if (detailed) {
    const name = getSiteName(group ? (OPERATIONAL_SITES.some((s) => s.id === state.pilotSite) ? state.pilotSite : OPERATIONAL_SITES[0].id) : state.site);
    return `${pageHead("Pilotage · Analyser", `Courbes · ${name}`, "L’historique de chaque indicateur, avec sa cible et sa source.", '<button class="btn secondary" data-os="tower" data-args="{}">← Tous les indicateurs</button>')}${tabs}${renderPilotage(true)}`;
  }
  return `${pageHead("Pilotage · Analyser", group ? "Indicateurs des sites" : `Indicateurs · ${site().name}`, "Tous les indicateurs d’un coup d’œil.")}${tabs}${renderOSTower(true)}`;
};

// Décider : la période commune se parcourt aussi avec ‹ ›.
const inGroupSqcdpBase = renderGroupSqcdp;
renderGroupSqcdp = function (embedded = false) {
  const periods = benchmarkPeriods(), period = periods.includes(state.benchmarkPeriod) ? state.benchmarkPeriod : periods[0] || "";
  return inGroupSqcdpBase(embedded).replace(/<label class="sqcdp-period">[\s\S]*?<\/label>/, `<div class="sqcdp-period">${inBenchStepper(periods, period)}</div>`);
};

function inBind(root = document) {
  root.querySelectorAll("[data-in-site]").forEach((b) => (b.onclick = () => {
    if (!requestCloseModal()) return;
    state.pilotSite = b.dataset.inSite;
    state.pilotageMode = "analysis";
    state.osTab = "detail";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  root.querySelectorAll("[data-in-hist]").forEach((b) => (b.onclick = () => { state.period = b.dataset.inHist; render(); }));
  root.querySelectorAll("[data-in-step]").forEach((b) => (b.onclick = () => {
    const to = b.dataset.inTo;
    if (b.dataset.inStep === "os") state.osPeriod = to && to < today() ? to : null;
    else if (to) state.benchmarkPeriod = to;
    render();
  }));
  root.querySelectorAll("[data-in-nav]").forEach((b) => (b.onclick = () => {
    const view = b.dataset.inNav;
    if (view === "terrain") state.terrainTab = "signals";
    switchView(view);
  }));
}
const inOsBindBase = osBind;
osBind = function () { const out = inOsBindBase.apply(this, arguments); inBind(document); return out; };
