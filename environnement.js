"use strict";
/*
 * BIA Lean OS 8.37 · L'environnement (Voir › Environnement), une brique du Lean management à part entière.
 *  - Saisie mensuelle par site : production (m³, m², pièces ou tonnes), électricité, gaz et chaleur, eau,
 *    déchets non dangereux dont valorisés, déchets dangereux.
 *  - Huit indicateurs : électricité, gaz et chaleur, eau et déchets par unité produite, taux de valorisation, déchets
 *    dangereux, CO₂ de l'énergie par unité (avec les facteurs d'émission du site), incidents environnementaux.
 *    Chacun avec sa référence (saisie, ou moyenne de l'année précédente), son objectif et son dernier mois ;
 *    la courbe des 12 derniers mois, le détail mois par mois.
 *  - Incidents environnementaux (déversement, rejet, plainte, fuite, tri…) et presque-incidents, avec action corrective.
 *  - Obligations réglementaires du site : périodicité, dernière réalisation, prochaine échéance, retards.
 *  - Vue groupe : chaque site face à ses objectifs. Gains environnement validés (Voir › Gains). Revue mensuelle des sites :
 *    bloc Environnement. « À surveiller » : mois non saisi, obligation en retard.
 * Données : envMonths[] { id, site_id, month, prod_qty, elec_kwh, gas_kwh, water_m3, waste_t, waste_valo_t, haz_t, note, by },
 *   envEvents[] { id, site_id, date, kind, severity, text, immediate, action_id, by },
 *   envDuties[] { id, site_id, name, every_months, last_date, owner },
 *   envSites[] { site_id, prod_unit, f_elec, f_gas, ref{}, target{}, cut_pct } — collections non indexées.
 */

const EV_KINDS = ["Déversement, fuite de produit", "Rejet ou dépassement", "Plainte de riverain", "Fuite d’eau, d’air comprimé", "Tri des déchets non respecté", "Bruit, poussières, odeurs", "Presque-incident", "Autre"];
const EV_SEV = ["Mineur", "Significatif", "Majeur"];
const EV_UNITS = ["m³", "m²", "pièces", "tonnes"];
const EV_DUTY_EXAMPLES = [["Registre des déchets à jour", 1], ["Bordereaux de suivi des déchets dangereux classés", 1], ["Contrôle des rejets atmosphériques (poussières, COV)", 12], ["Déclaration annuelle des émissions et déchets", 12], ["Vérification des bacs de rétention et kits antipollution", 3], ["Relevé des compteurs d’eau et d’énergie", 1]];
const EV_IND = [
  { k: "elec", label: "Électricité", unit: (u) => `kWh/${u}`, dir: "low", calc: (m) => (m.prod_qty > 0 && m.elec_kwh != null ? m.elec_kwh / m.prod_qty : null) },
  { k: "heat", label: "Gaz et chaleur", unit: (u) => `kWh/${u}`, dir: "low", calc: (m) => (m.prod_qty > 0 && m.gas_kwh != null ? m.gas_kwh / m.prod_qty : null) },
  { k: "water", label: "Eau", unit: (u) => `L/${u}`, dir: "low", calc: (m) => (m.prod_qty > 0 && m.water_m3 != null ? (m.water_m3 * 1000) / m.prod_qty : null) },
  { k: "waste", label: "Déchets", unit: (u) => `kg/${u}`, dir: "low", calc: (m) => (m.prod_qty > 0 && m.waste_t != null ? ((m.waste_t + (m.haz_t || 0)) * 1000) / m.prod_qty : null) },
  { k: "valo", label: "Déchets valorisés", unit: () => "%", dir: "high", calc: (m) => (m.waste_t > 0 && m.waste_valo_t != null ? Math.min(100, (m.waste_valo_t / m.waste_t) * 100) : null) },
  { k: "haz", label: "Déchets dangereux", unit: () => "t", dir: "low", calc: (m) => (m.haz_t != null ? m.haz_t : null) },
  { k: "co2", label: "CO₂ de l’énergie", unit: (u) => `kgCO₂e/${u}`, dir: "low", calc: (m, s) => { if (!(m.prod_qty > 0) || (!s.f_elec && !s.f_gas)) return null; const e = (m.elec_kwh || 0) * (s.f_elec || 0) + (m.gas_kwh || 0) * (s.f_gas || 0); return e / m.prod_qty; } },
  { k: "inc", label: "Incidents", unit: () => "nombre", dir: "low", calc: null },
];
let evSel = null;

function evCan() { return role().nav.includes("pilotage"); }
function evWritable(siteId) { return !role().readonly && osWritable(siteId); }
function evSite(siteId) { return (data.envSites || []).find((s) => s.site_id === siteId) || { site_id: siteId, prod_unit: "m³", ref: {}, target: {} }; }
function evMonthsOf(siteId) { return (data.envMonths || []).filter((m) => m.site_id === siteId).sort((a, b) => a.month.localeCompare(b.month)); }
function evPrevMonth(month = today().slice(0, 7), n = 1) { const [y, m] = month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 - n, 1)); return d.toISOString().slice(0, 7); }
function evMonthName(month) { const names = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]; return `${names[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`; }
function evIncidents(siteId, month) { return (data.envEvents || []).filter((e) => e.site_id === siteId && String(e.date).slice(0, 7) === month && e.kind !== "Presque-incident").length; }
function evVal(ind, siteId, row) { if (ind.k === "inc") return evIncidents(siteId, row.month); return ind.calc(row, evSite(siteId)); }
function evSeries(ind, siteId, n = 12) {
  const end = today().slice(0, 7), months = Array.from({ length: n }, (_, i) => evPrevMonth(end, n - 1 - i)), rows = evMonthsOf(siteId);
  return months.map((month) => { const r = rows.find((x) => x.month === month); return { month, v: r ? evVal(ind, siteId, r) : ind.k === "inc" && rows.length ? evIncidents(siteId, month) : null }; });
}
function evRef(ind, siteId) {
  const s = evSite(siteId), manual = s.ref?.[ind.k];
  if (manual !== undefined && manual !== null && manual !== "") return { v: Number(manual), label: "référence" };
  const y = String(Number(today().slice(0, 4)) - 1), vals = evMonthsOf(siteId).filter((m) => m.month.startsWith(y)).map((m) => evVal(ind, siteId, m)).filter((v) => v !== null);
  return vals.length >= 3 ? { v: vals.reduce((a, b) => a + b, 0) / vals.length, label: `moyenne ${y}` } : null;
}
function evTarget(ind, siteId) { const t = evSite(siteId).target?.[ind.k]; if (t !== undefined && t !== null && t !== "") return Number(t); return ind.k === "inc" ? 0 : null; }
function evLast(ind, siteId) { const rows = evMonthsOf(siteId); for (let i = rows.length - 1; i >= 0; i--) { const v = evVal(ind, siteId, rows[i]); if (v !== null) return { v, month: rows[i].month }; } return null; }
function evOk(ind, v, t) { if (v === null || t === null) return null; return ind.dir === "low" ? v <= t + 1e-9 : v >= t - 1e-9; }
function evFmt(v) { if (v === null || v === undefined || !Number.isFinite(v)) return "—"; const a = Math.abs(v); return a >= 100 ? Math.round(v).toLocaleString("fr-FR") : a >= 10 ? smNum(Math.round(v * 10) / 10) : smNum(Math.round(v * 100) / 100); }
function evDutyNext(d) { return d.last_date ? auAddMonths(d.last_date, Number(d.every_months) || 12) : null; }
function evDutyState(d) { const n = evDutyNext(d); if (!n) return { k: "todo", label: "Jamais réalisée" }; const days = Math.round((Date.parse(n) - Date.parse(today())) / 864e5); return days < 0 ? { k: "late", label: `En retard depuis le ${shortDate(n)}` } : days <= 30 ? { k: "soon", label: `À faire avant le ${shortDate(n)}` } : { k: "ok", label: `Prochaine le ${shortDate(n)}` }; }
function evMissing(siteId) { const prev = evPrevMonth(); return evMonthsOf(siteId).length && !evMonthsOf(siteId).some((m) => m.month === prev) ? prev : null; }

function evSpark(ser, target, ind) {
  const vals = ser.map((x) => x.v).filter((v) => v !== null);
  if (vals.length < 2) return "";
  const lo = Math.min(...vals, target ?? Infinity), hi = Math.max(...vals, target ?? -Infinity), span = hi - lo || 1, W = 120, H = 34;
  const X = (i) => (i / (ser.length - 1)) * W, Y = (v) => H - 3 - ((v - lo) / span) * (H - 6);
  const pts = ser.map((x, i) => (x.v === null ? null : `${X(i).toFixed(1)},${Y(x.v).toFixed(1)}`)).filter(Boolean).join(" ");
  const last = ser.map((x, i) => [x, i]).filter(([x]) => x.v !== null).at(-1), ok = evOk(ind, last[0].v, target);
  return `<svg class="ev-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${target !== null ? `<line x1="0" x2="${W}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}" class="ev-sp-t"/>` : ""}<polyline points="${pts}" class="ev-sp-l"/><circle cx="${X(last[1]).toFixed(1)}" cy="${Y(last[0].v).toFixed(1)}" r="3" class="${ok === false ? "bad" : ok ? "ok" : ""}"/></svg>`;
}

/* ---------- Page ---------- */

function evPage() {
  if (state.site === "group") return evGroup();
  const siteId = state.site, s = evSite(siteId), u = s.prod_unit || "m³", w = evWritable(siteId), mgr = w && osManager();
  const head = pageHead("Voir", "Environnement", "Énergie, eau, déchets, CO₂ et incidents : chaque mois, par unité produite, face à la référence et à l’objectif du site.",
    `<div class="cs-head-tools">${w ? '<button type="button" class="btn" data-ev-month>Saisir le mois</button><button type="button" class="btn secondary" data-ev-event>Déclarer un incident</button>' : ""}${mgr ? '<button type="button" class="btn ghost" data-ev-settings>Réglages du site</button>' : ""}</div>`);
  const rows = evMonthsOf(siteId), miss = evMissing(siteId);
  if (!rows.length) return `${head}<section class="cs-empty"><h2>Premier mois à saisir</h2><p>La production du mois et les relevés des compteurs et des déchets : électricité, gaz, eau, déchets dont valorisés, déchets dangereux. Les indicateurs par ${esc(u)} produit se calculent seuls ; saisissez aussi quelques mois de l’an dernier pour avoir une référence.</p>${w ? '<button type="button" class="btn" data-ev-month>Saisir le mois</button>' : ""}</section>${evEventsBlock(siteId)}${evDutiesBlock(siteId)}${evHow()}`;
  const lastM = rows.at(-1).month;
  const warn = miss && w ? `<p class="ts-warn">Le mois de ${evMonthName(miss)} n’est pas saisi. <button type="button" class="btn small secondary" data-ev-month="${miss}">Le saisir</button></p>` : "";
  const cards = EV_IND.map((ind) => {
    const last = evLast(ind, siteId), ref = evRef(ind, siteId), t = evTarget(ind, siteId), ok = last ? evOk(ind, last.v, t) : null, ser = evSeries(ind, siteId);
    const vsRef = last && ref && ref.v ? ((last.v - ref.v) / Math.abs(ref.v)) * 100 : null, better = vsRef === null ? null : ind.dir === "low" ? vsRef < 0 : vsRef > 0;
    const noFactor = ind.k === "co2" && !s.f_elec && !s.f_gas;
    return `<button type="button" class="ev-card ${ok === false ? "bad" : ok ? "ok" : ""} ${evSel === ind.k ? "active" : ""}" data-ev-sel="${ind.k}" aria-pressed="${evSel === ind.k}"><span class="ev-c-l">${esc(ind.label)}</span>
      <span class="ev-c-v"><b>${last ? evFmt(last.v) : "—"}</b> <small>${esc(ind.unit(u))}</small></span>
      ${noFactor ? '<small class="hint">Facteurs d’émission à renseigner (réglages)</small>' : `<span class="ev-c-r"><span>Réf. <b>${ref ? evFmt(ref.v) : "—"}</b></span><span>Obj. <b>${t !== null ? evFmt(t) : "—"}</b></span>${vsRef !== null && ind.k !== "valo" ? `<span class="${better ? "ok" : "bad"}">${vsRef > 0 ? "+" : ""}${smNum(Math.round(vsRef))} %</span>` : ind.k === "valo" && last && ref ? `<span class="${better ? "ok" : "bad"}">${last.v - ref.v > 0 ? "+" : ""}${smNum(Math.round((last.v - ref.v) * 10) / 10)} pt</span>` : ""}</span>`}
      ${evSpark(ser, t, ind)}</button>`;
  }).join("");
  const sel = evSel ? EV_IND.find((x) => x.k === evSel) : null;
  const g = typeof gnRows === "function" ? (data.gains || []).filter((x) => !x.archived_at && x.site_id === siteId && x.status === "Validé" && gnFamilyOf(x) === "env") : [];
  const gt = g.length ? Object.entries(g.reduce((o, x) => { const v = gnValue(x); if (v) o[x.unit] = (o[x.unit] || 0) + v.year; return o; }, {})) : [];
  const gainLine = g.length ? `<p class="ev-gains"><b>Gains environnement validés :</b> ${gt.map(([k, v]) => esc(gnQty(v, k))).join(" · ")} par an · <button type="button" class="btn ghost small" data-ev-gains>Voir les gains</button></p>` : "";
  return `${head}${warn}<section class="section"><div class="section-title"><h2>Les indicateurs · dernier mois saisi : ${evMonthName(lastM)}</h2></div><div class="ev-cards">${cards}</div>${gainLine}</section>${sel ? evDetail(sel, siteId) : ""}${evEventsBlock(siteId)}${evDutiesBlock(siteId)}${evHow()}`;
}

function evDetail(ind, siteId) {
  const s = evSite(siteId), u = s.prod_unit || "m³", ser = evSeries(ind, siteId, 24), ref = evRef(ind, siteId), t = evTarget(ind, siteId), vals = ser.map((x) => x.v).filter((v) => v !== null);
  if (!vals.length) return `<section class="section ev-detail"><div class="section-title"><h2>${esc(ind.label)}</h2><button type="button" class="btn ghost small" data-ev-sel="">Fermer</button></div><p class="hint">Pas encore de valeur.</p></section>`;
  const all = [...vals, ...(ref ? [ref.v] : []), ...(t !== null ? [t] : [])], top = Math.max(...all), bot = Math.min(...all), lo = ind.k === "inc" || ind.k === "valo" ? 0 : Math.max(0, bot - (top - bot) * 0.6 - top * 0.02), max = top + (top - lo) * 0.12 || 1;
  const H = (v) => (Math.max(0, (v - lo) / (max - lo)) * 100).toFixed(1);
  const bars = `<div class="ev-dbars">${ref ? `<span class="ev-line ref" style="bottom:${H(ref.v)}%"><small>réf. ${evFmt(ref.v)}</small></span>` : ""}${t !== null ? `<span class="ev-line tgt" style="bottom:${H(t)}%"><small>objectif ${evFmt(t)}</small></span>` : ""}${ser.map((x) => `<span class="ev-dcol"><i style="height:${x.v === null ? 0 : H(x.v)}%" class="${evOk(ind, x.v, t) === false ? "bad" : evOk(ind, x.v, t) ? "ok" : ""}"></i><small>${x.month.slice(5, 7)}</small></span>`).join("")}</div>`;
  const rows = evMonthsOf(siteId).slice(-12).reverse();
  const table = ind.k === "inc" ? "" : `<div class="cn-scroll"><table class="gn-sites ev-table"><thead><tr><th>Mois</th><th>Production (${esc(u)})</th><th>Électricité (kWh)</th><th>Gaz, chaleur (kWh)</th><th>Eau (m³)</th><th>Déchets (t)</th><th>dont valorisés (t)</th><th>Dangereux (t)</th><th>${esc(ind.label)}</th></tr></thead><tbody>${rows.map((m) => `<tr><th><button type="button" class="btn ghost small" data-ev-month="${m.month}">${evMonthName(m.month)}</button></th><td>${evFmt(m.prod_qty)}</td><td>${evFmt(m.elec_kwh)}</td><td>${evFmt(m.gas_kwh)}</td><td>${evFmt(m.water_m3)}</td><td>${evFmt(m.waste_t)}</td><td>${evFmt(m.waste_valo_t)}</td><td>${evFmt(m.haz_t)}</td><td><b>${evFmt(evVal(ind, siteId, m))}</b></td></tr>`).join("")}</tbody></table></div>`;
  return `<section class="section ev-detail"><div class="section-title"><h2>${esc(ind.label)} · ${esc(ind.unit(u))} · 24 mois</h2><button type="button" class="btn ghost small" data-ev-sel="">Fermer</button></div><figure class="ev-dfig" role="img" aria-label="${esc(ser.filter((x) => x.v !== null).map((x) => `${evMonthName(x.month)} ${evFmt(x.v)}`).join(", "))}">${bars}<figcaption>Chaque mois face à la référence${ref ? ` (${esc(ref.label)})` : ""} et à l’objectif. Barre rouge : objectif manqué.${lo > 0 ? ` L’échelle commence à ${evFmt(lo)}.` : ""}</figcaption></figure>${table}</section>`;
}

function evEventsBlock(siteId) {
  const ev = (data.envEvents || []).filter((e) => e.site_id === siteId).sort((a, b) => String(b.date).localeCompare(String(a.date))), y = auAddDays(-365);
  const n12 = ev.filter((e) => e.date >= y && e.kind !== "Presque-incident").length, near = ev.filter((e) => e.date >= y && e.kind === "Presque-incident").length;
  return `<section class="section"><div class="section-title"><h2>Incidents environnementaux</h2>${evWritable(siteId) ? '<button type="button" class="btn small secondary" data-ev-event>Déclarer</button>' : ""}</div><p class="hint">${n12} incident${n12 > 1 ? "s" : ""} et ${near} presque-incident${near > 1 ? "s" : ""} sur 12 mois. Un presque-incident déclaré est une bonne nouvelle : c’est un incident évité.</p>${ev.length ? `<div class="jn-rows">${ev.slice(0, 8).map((e) => `<button type="button" class="jn-row" data-ev-open="${esc(e.id)}"><span class="jn-row-main"><span class="jn-tag ${e.severity === "Majeur" ? "tone-open" : e.kind === "Presque-incident" ? "" : "tone-warn"}">${esc(e.kind === "Presque-incident" ? "Presque-incident" : e.severity)}</span><b>${esc(e.kind)} · ${shortDate(e.date)}</b><span class="hint">${esc(String(e.text || "").slice(0, 120))}${e.action_id ? ` · action ${esc(e.action_id)}` : ""}</span></span></button>`).join("")}</div>` : ""}</section>`;
}

function evDutiesBlock(siteId) {
  const d = (data.envDuties || []).filter((x) => x.site_id === siteId && !x.archived_at).sort((a, b) => String(evDutyNext(a) || "0").localeCompare(String(evDutyNext(b) || "0"))), w = evWritable(siteId), mgr = w && osManager();
  const late = d.filter((x) => evDutyState(x).k === "late" || evDutyState(x).k === "todo").length;
  return `<section class="section"><div class="section-title"><h2>Obligations du site${d.length ? ` · ${d.length - late}/${d.length} à jour` : ""}</h2>${mgr ? '<button type="button" class="btn small secondary" data-ev-duty>Ajouter</button>' : ""}</div>${d.length ? `<div class="jn-rows">${d.map((x) => { const st = evDutyState(x); return `<div class="jn-row ev-duty ${st.k}"><span class="jn-row-main"><b>${esc(x.name)}</b><span class="hint">${st.label} · tous les ${x.every_months} mois${x.owner ? ` · ${esc(x.owner)}` : ""}</span></span>${w ? `<button type="button" class="btn small ${st.k === "late" || st.k === "todo" ? "" : "secondary"}" data-ev-done="${esc(x.id)}">Fait</button>` : ""}${mgr ? `<button type="button" class="btn small ghost" data-ev-duty="${esc(x.id)}" aria-label="Modifier ${esc(x.name)}">Modifier</button>` : ""}</div>`; }).join("")}</div>` : `<p class="hint">Contrôles, déclarations, registres : ce que l’arrêté préfectoral et la réglementation demandent au site, avec leur périodicité.${mgr ? " Exemples à adapter :" : ""}</p>${mgr ? `<div class="filters">${EV_DUTY_EXAMPLES.map(([n, m], i) => `<button type="button" class="chip" data-ev-ex="${i}">+ ${esc(n)}</button>`).join("")}</div>` : ""}`}</section>`;
}

function evGroup() {
  const sites = OPERATIONAL_SITES.filter((s) => allowedSite(s.id));
  const head = pageHead("Voir", "Environnement", "Chaque site face à ses objectifs : énergie, eau, déchets, CO₂ et incidents, au dernier mois saisi.", "");
  const ind = EV_IND;
  const rows = sites.map((s) => { const u = evSite(s.id).prod_unit || "m³", miss = evMissing(s.id), last = evMonthsOf(s.id).at(-1)?.month; const late = (data.envDuties || []).filter((x) => x.site_id === s.id && !x.archived_at && ["late", "todo"].includes(evDutyState(x).k)).length; return `<tr><th><button type="button" class="btn ghost small" data-ev-site="${esc(s.id)}">${esc(s.name)}</button><small>${last ? evMonthName(last) : "rien de saisi"}${miss ? " · mois manquant" : ""}</small></th>${ind.map((i) => { const l = evLast(i, s.id), t = evTarget(i, s.id), ok = l ? evOk(i, l.v, t) : null; return `<td class="${ok === false ? "bad" : ok ? "ok" : ""}">${l ? `${evFmt(l.v)} <small>${esc(i.unit(u))}</small>` : "—"}</td>`; }).join("")}<td class="${late ? "bad" : ""}">${late || "0"}</td></tr>`; }).join("");
  return `${head}<section class="section"><div class="cn-scroll"><table class="gn-sites ev-grid"><thead><tr><th>Site</th>${ind.map((i) => `<th>${esc(i.label)}</th>`).join("")}<th>Obligations en retard</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">Vert : objectif tenu ; rouge : objectif manqué ; sans couleur : pas d’objectif. Choisissez un site pour le détail et la saisie.</p></section>${evHow()}`;
}

function evHow() {
  return `<details class="cs-how section"><summary>L’environnement dans le Lean management</summary><ol class="cs-how-list"><li><b>Un gaspillage comme un autre</b><span>L’énergie d’une machine qui tourne à vide, l’air comprimé qui fuit, la chute de panneau, la colle jetée : ce sont des pertes, qui coûtent et qui se réduisent par les mêmes outils.</span></li><li><b>Rapporter à la production</b><span>Les kWh, m³ et kg par unité produite se comparent d’un mois à l’autre, même quand l’activité varie.</span></li><li><b>Une référence, un objectif</b><span>La référence (l’an dernier) dit d’où l’on part ; l’objectif dit où l’on va ; le mois dit où l’on est.</span></li><li><b>Déclarer les incidents et les presque-incidents</b><span>Comme pour la sécurité : chaque déclaration est une occasion d’éviter le suivant.</span></li><li><b>Tenir les obligations</b><span>Les échéances réglementaires se suivent ici comme des rendez-vous.</span></li></ol></details>`;
}

/* ---------- Formulaires ---------- */

function evMonthForm(month = null) {
  const siteId = state.site; if (!evWritable(siteId)) return;
  const m0 = month || evPrevMonth(), s = evSite(siteId), u = s.prod_unit || "m³";
  const find = (mm) => (data.envMonths || []).find((x) => x.site_id === siteId && x.month === mm);
  const old = find(m0) || {};
  const f = (id, label, k, step = "any", hint = "") => `<label class="field">${label}<input id="${id}" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(old[k] ?? "")}">${hint ? `<small>${hint}</small>` : ""}</label>`;
  modal(`Environnement · ${getSiteName(siteId)}`, `<form id="evMForm" class="jn-form"><label class="field">Mois<input id="evM" type="month" max="${today().slice(0, 7)}" value="${m0}" required></label>
    ${f("evProd", `Production du mois (${esc(u)})`, "prod_qty")}
    <fieldset class="ts-fs"><legend>Énergie et eau</legend><div class="gn-three">${f("evElec", "Électricité (kWh)", "elec_kwh")}${f("evGas", "Gaz, chaleur (kWh)", "gas_kwh", "any", "Gaz, fioul, chaudière bois")}${f("evWater", "Eau (m³)", "water_m3")}</div></fieldset>
    <fieldset class="ts-fs"><legend>Déchets</legend><div class="gn-three">${f("evWaste", "Non dangereux (t)", "waste_t", "any", "Bois, chutes, cartons, DIB")}${f("evValo", "dont valorisés (t)", "waste_valo_t", "any", "Recyclés ou valorisés en énergie")}${f("evHaz", "Dangereux (t)", "haz_t", "any", "Colles, vernis, solvants, huiles")}</div></fieldset>
    <label class="field">Remarque<input id="evNote" maxlength="200" value="${esc(old.note || "")}" autocomplete="off"></label>
    <div class="gn-live" id="evLive" aria-live="polite"></div>
    <div class="form-actions"><button class="btn jn-big">Enregistrer le mois</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const num = (id) => { const v = $(id).value; return v === "" ? null : Number(v); };
  const read = () => ({ month: $("evM").value, prod_qty: num("evProd"), elec_kwh: num("evElec"), gas_kwh: num("evGas"), water_m3: num("evWater"), waste_t: num("evWaste"), waste_valo_t: num("evValo"), haz_t: num("evHaz"), note: $("evNote").value.trim() });
  const live = () => { const r = read(); $("evLive").innerHTML = EV_IND.filter((i) => i.k !== "inc").map((i) => { const v = i.calc(r, s); return v === null ? "" : `<span>${esc(i.label)} <b>${evFmt(v)}</b> <small>${esc(i.unit(u))}</small></span>`; }).join(" · ") + (r.waste_valo_t > r.waste_t ? '<p class="ts-warn">Les déchets valorisés dépassent le total des déchets non dangereux.</p>' : ""); };
  $("evM").addEventListener("change", () => { const o = find($("evM").value); if (o) { [["evProd", "prod_qty"], ["evElec", "elec_kwh"], ["evGas", "gas_kwh"], ["evWater", "water_m3"], ["evWaste", "waste_t"], ["evValo", "waste_valo_t"], ["evHaz", "haz_t"]].forEach(([id, k]) => ($(id).value = o[k] ?? "")); $("evNote").value = o.note || ""; } live(); });
  $("evMForm").addEventListener("input", live); live();
  $("evMForm").onsubmit = (e) => {
    e.preventDefault();
    const r = read();
    if (!/^\d{4}-\d{2}$/.test(r.month) || r.month > today().slice(0, 7)) return toast("Le mois.");
    if (!(r.prod_qty > 0)) return toast(`La production du mois, en ${u}.`);
    if (r.waste_valo_t !== null && r.waste_t !== null && r.waste_valo_t > r.waste_t) return toast("Les déchets valorisés dépassent le total.");
    if ([r.elec_kwh, r.gas_kwh, r.water_m3, r.waste_t, r.haz_t].every((v) => v === null)) return toast("Au moins un relevé : énergie, eau ou déchets.");
    if (!commitData(() => { data.envMonths ||= []; const o = data.envMonths.find((x) => x.site_id === siteId && x.month === r.month); if (o) Object.assign(o, r, { updated_at: now(), by: apMe() || role().label }); else data.envMonths.push({ id: uid("ENVM"), site_id: siteId, ...r, by: apMe() || role().label, created_at: now(), updated_at: now() }); })) return;
    modalDirty = false; closeModal(); render(); toast(`${evMonthName(r.month)} enregistré.`);
  };
}

function evEventForm(id = null) {
  const siteId = state.site === "group" ? null : state.site, old = id ? (data.envEvents || []).find((e) => e.id === id) : null, sid = old?.site_id || siteId;
  if (!sid || !evWritable(sid)) return toast("Choisissez un site de votre périmètre.");
  modal(old ? `${old.id} · Incident environnement` : "Déclarer un incident environnement", `<form id="evEForm" class="jn-form">
    <div class="bp-two"><label class="field">Date<input id="evED" type="date" max="${today()}" value="${esc(old?.date || today())}" required></label><label class="field">Gravité<select id="evES">${EV_SEV.map((x) => `<option ${x === old?.severity ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
    <div class="field"><span class="metric-label">Quoi</span><div class="filters ev-kinds">${EV_KINDS.map((k) => `<button type="button" class="chip ${k === (old?.kind || EV_KINDS[0]) ? "active" : ""}" data-ev-k="${esc(k)}" aria-pressed="${k === (old?.kind || EV_KINDS[0])}">${esc(k)}</button>`).join("")}</div></div>
    <label class="field">Ce qui s’est passé, où<textarea id="evET" rows="3" maxlength="600" required>${esc(old?.text || "")}</textarea></label>
    <label class="field">Mesure immédiate<input id="evEI" maxlength="200" value="${esc(old?.immediate || "")}" placeholder="Ex. Kit antipollution, zone balisée" autocomplete="off"></label>
    ${old?.action_id ? `<p class="hint">Action corrective ${esc(old.action_id)}.</p>` : `<fieldset class="ts-fs"><legend>Action corrective (facultatif)</legend><label class="field">Quoi<input id="evEA" maxlength="160" autocomplete="off"></label><div class="bp-two"><label class="field">Qui<input id="evEW" list="ownerList" value="${esc(apMe() || "")}">${ownerDatalist()}</label><label class="field">Pour quand<input id="evEDue" type="date" min="${today()}" value="${auAddDays(14)}"></label></div></fieldset>`}
    <div class="form-actions"><button class="btn jn-big">${old ? "Enregistrer" : "Déclarer"}</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent"); let kind = old?.kind || EV_KINDS[0];
  root.querySelectorAll("[data-ev-k]").forEach((b) => (b.onclick = () => { kind = b.dataset.evK; root.querySelectorAll("[data-ev-k]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  $("evEForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("evET").value.trim(), date = $("evED").value, act = $("evEA")?.value.trim(), who = $("evEW")?.value.trim(), due = $("evEDue")?.value;
    if (!text || !date) return toast("La date et ce qui s’est passé.");
    if (act && (!who || !due)) return toast("Qui et pour quand, pour l’action.");
    let eid = old?.id, aid = null;
    if (!commitData(() => {
      data.envEvents ||= [];
      if (act) { aid = auNext("A", data.actions); data.actions.unshift({ id: aid, site_id: sid, title: act, description: `Incident environnement · ${kind} · ${shortDate(date)} : ${text}`, owner: who, due_date: due, due_date_initial: due, priority: $("evES").value === "Majeur" ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Environnement", finding: `Environnement · ${kind}`, created_at: now(), updated_at: now() }); }
      const patch = { date, kind, severity: $("evES").value, text, immediate: $("evEI").value.trim(), updated_at: now(), ...(aid ? { action_id: aid } : {}) };
      if (old) Object.assign(data.envEvents.find((x) => x.id === old.id), patch);
      else { eid = uid("ENVI"); data.envEvents.unshift({ id: eid, site_id: sid, by: apMe() || role().label, created_at: now(), ...patch }); }
    })) return;
    modalDirty = false; closeModal(); render(); toast(`${kind === "Presque-incident" ? "Presque-incident" : "Incident"} enregistré${aid ? `, action ${aid} créée` : ""}.`);
  };
}

function evDutyForm(id = null, ex = null) {
  const siteId = state.site, old = id ? (data.envDuties || []).find((d) => d.id === id) : null;
  if (!evWritable(siteId) || !osManager()) return;
  const e = ex !== null ? EV_DUTY_EXAMPLES[ex] : null;
  modal(old ? "Obligation" : "Ajouter une obligation", `<form id="evDForm" class="jn-form"><label class="field">Obligation<input id="evDN" required maxlength="140" value="${esc(old?.name || e?.[0] || "")}" autocomplete="off"></label>
    <div class="bp-two"><label class="field">Tous les (mois)<input id="evDE" type="number" min="1" max="120" value="${esc(old?.every_months ?? e?.[1] ?? 12)}" required></label><label class="field">Dernière réalisation<input id="evDL" type="date" max="${today()}" value="${esc(old?.last_date || "")}"></label></div>
    <label class="field">Responsable<input id="evDO" list="ownerList" value="${esc(old?.owner || "")}">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Enregistrer</button>${old ? '<button type="button" class="btn ghost" data-ev-darch>Retirer</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("modalContent").querySelector("[data-ev-darch]")?.addEventListener("click", () => { if (!commitData(() => { data.envDuties.find((d) => d.id === old.id).archived_at = now(); })) return; modalDirty = false; closeModal(); render(); });
  $("evDForm").onsubmit = (ev) => {
    ev.preventDefault();
    const p = { name: $("evDN").value.trim(), every_months: Number($("evDE").value) || 12, last_date: $("evDL").value || null, owner: $("evDO").value.trim(), updated_at: now() };
    if (!p.name) return toast("L’obligation.");
    if (!commitData(() => { data.envDuties ||= []; if (old) Object.assign(data.envDuties.find((d) => d.id === old.id), p); else data.envDuties.push({ id: uid("ENVO"), site_id: siteId, created_at: now(), ...p }); })) return;
    modalDirty = false; closeModal(); render(); toast("Obligation enregistrée.");
  };
}

function evSettingsForm() {
  const siteId = state.site; if (!evWritable(siteId) || !osManager()) return;
  const s = evSite(siteId), u = s.prod_unit || "m³";
  modal(`Réglages environnement · ${getSiteName(siteId)}`, `<form id="evSForm" class="jn-form">
    <div class="bp-two"><label class="field">Unité de production<select id="evSU">${EV_UNITS.map((x) => `<option ${x === u ? "selected" : ""}>${x}</option>`).join("")}</select></label><label class="field">Baisse visée par rapport à la référence (%)<input id="evSCut" type="number" min="0" max="80" step="0.5" value="${esc(s.cut_pct ?? "")}"><small>Remplit les objectifs laissés vides</small></label></div>
    <fieldset class="ts-fs"><legend>Facteurs d’émission (kgCO₂e par kWh)</legend><div class="bp-two"><label class="field">Électricité<input id="evSFe" type="number" min="0" step="any" value="${esc(s.f_elec ?? "")}"></label><label class="field">Gaz, chaleur<input id="evSFg" type="number" min="0" step="any" value="${esc(s.f_gas ?? "")}"></label></div><small class="hint">Ceux du fournisseur d’énergie ou de la Base Empreinte de l’ADEME, validés par le site.</small></fieldset>
    <fieldset class="ts-fs"><legend>Référence et objectif par indicateur</legend><div class="ev-reftab">${EV_IND.map((i) => { const auto = (() => { const r = evRef({ ...i }, siteId); return r && (s.ref?.[i.k] ?? "") === "" ? r : null; })(); return `<div class="ev-refrow"><span>${esc(i.label)} <small>${esc(i.unit(u))}</small></span><input data-ev-ref="${i.k}" type="number" step="any" min="0" value="${esc(s.ref?.[i.k] ?? "")}" placeholder="${auto ? `auto ${evFmt(auto.v)}` : "référence"}" aria-label="Référence ${esc(i.label)}"><input data-ev-tgt="${i.k}" type="number" step="any" min="0" value="${esc(s.target?.[i.k] ?? "")}" placeholder="${i.k === "inc" ? "0" : "objectif"}" aria-label="Objectif ${esc(i.label)}"></div>`; }).join("")}</div><small class="hint">Référence vide : moyenne de l’an dernier quand au moins trois mois sont saisis.</small></fieldset>
    <div class="form-actions"><button class="btn jn-big">Enregistrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("evSForm").onsubmit = (e) => {
    e.preventDefault();
    const val = (x) => (x === "" ? null : Number(x)), ref = {}, target = {}, cut = val($("evSCut").value);
    document.querySelectorAll("[data-ev-ref]").forEach((x) => { if (x.value !== "") ref[x.dataset.evRef] = Number(x.value); });
    document.querySelectorAll("[data-ev-tgt]").forEach((x) => { if (x.value !== "") target[x.dataset.evTgt] = Number(x.value); });
    if (!commitData(() => {
      data.envSites ||= [];
      let o = data.envSites.find((x) => x.site_id === siteId);
      if (!o) { o = { site_id: siteId }; data.envSites.push(o); }
      Object.assign(o, { prod_unit: $("evSU").value, f_elec: val($("evSFe").value), f_gas: val($("evSFg").value), cut_pct: cut, ref, target, updated_at: now() });
      if (cut) EV_IND.forEach((i) => { if (target[i.k] !== undefined || i.k === "inc") return; const r = evRef(i, siteId); if (!r) return; o.target[i.k] = Math.round((i.dir === "low" ? r.v * (1 - cut / 100) : Math.min(100, r.v + cut)) * 100) / 100; });
    })) return;
    modalDirty = false; closeModal(); render(); toast("Réglages enregistrés.");
  };
}

/* ---------- Branchements : Voir › Pilotage | Gains | Environnement ---------- */

state.pilotTab ??= "";
const evPilotBase = renderUnifiedPilotage;
renderUnifiedPilotage = function () {
  if (state.pilotTab === "gains" && gnCan()) return gnPage();
  if (state.pilotTab === "env" && evCan()) return evPage();
  return evPilotBase.apply(this, arguments);
};
const evSwitchBase = switchView;
switchView = function (view) { if (view !== "pilotage") state.pilotTab = ""; return evSwitchBase.apply(this, arguments); };
const evTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = evTabsBase(stage);
  if (stage?.id !== "voir") return out;
  const i = out.findIndex((t) => t.view === "pilotage" && !t.set?.pilotTab);
  if (i < 0 || out.some((t) => t.key === "gains")) return out;
  out[i] = { ...out[i], set: { ...(out[i].set || {}), pilotTab: "" } };
  out.splice(i + 1, 0, { key: "gains", label: "Gains", view: "pilotage", set: { pilotTab: "gains" } }, { key: "env", label: "Environnement", view: "pilotage", set: { pilotTab: "env" } });
  return out;
};
const evWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = evWatchBase();
  if (!evCan() || role().readonly || state.site === "group" || !evWritable(state.site)) return base;
  const rows = [];
  const miss = evMissing(state.site);
  if (miss) rows.push(`<button type="button" class="jn-row" data-ev-go><span class="jn-row-main"><span class="jn-tag tone-warn">Environnement</span><b>${evMonthName(miss)} à saisir</b><span class="hint">Énergie, eau, déchets du mois</span></span></button>`);
  (data.envDuties || []).filter((d) => d.site_id === state.site && !d.archived_at && evDutyState(d).k === "late").slice(0, 2).forEach((d) => rows.push(`<button type="button" class="jn-row" data-ev-go><span class="jn-row-main"><span class="jn-tag tone-open">Obligation</span><b>${esc(d.name)}</b><span class="hint">${evDutyState(d).label}</span></span></button>`));
  if (!rows.length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows.join("")}`);
};
/* Réunions : bloc Environnement dans la revue mensuelle et le COPIL ; gains en euros. */
if (typeof RE_BLOCKS !== "undefined") {
  RE_BLOCKS.env = "Environnement";
  ["mensuelle", "copil"].forEach((t) => { const a = RE_TYPES[t]?.agenda; if (a && !a.some(([k]) => k === "env")) { const i = a.findIndex(([k]) => k === "gains"); a.splice(i >= 0 ? i + 1 : a.length, 0, ["env", 10]); } });
  const evReBlockBase = reBlock;
  reBlock = function (key, r) {
    if (key === "env") {
      const sites = reSites(r).filter((id) => id !== "group"), lines = sites.map((id) => { const off = EV_IND.filter((i) => { const l = evLast(i, id); return l && evOk(i, l.v, evTarget(i, id)) === false; }), inc = (data.envEvents || []).filter((e) => e.site_id === id && e.date >= auAddDays(-31) && e.kind !== "Presque-incident").length, late = (data.envDuties || []).filter((d) => d.site_id === id && !d.archived_at && evDutyState(d).k === "late").length; return { id, off, inc, late, miss: evMissing(id) }; });
      const n = lines.reduce((s, x) => s + x.off.length + x.inc + x.late, 0);
      return { n, html: lines.length ? `<ul class="re-list">${lines.map((x) => `<li class="${x.off.length || x.inc || x.late ? "late" : ""}"><b>${esc(getSiteName(x.id))}</b> · ${x.off.length ? `hors objectif : ${x.off.map((i) => esc(i.label.toLowerCase())).join(", ")}` : "objectifs tenus ou non fixés"}${x.inc ? ` · ${x.inc} incident${x.inc > 1 ? "s" : ""} sur 31 jours` : ""}${x.late ? ` · ${x.late} obligation${x.late > 1 ? "s" : ""} en retard` : ""}${x.miss ? ` · ${evMonthName(x.miss)} non saisi` : ""}</li>`).join("")}</ul>` : '<p class="re-empty">Aucun site dans le périmètre.</p>' };
    }
    if (key === "gains" && typeof gnTotals === "function") {
      const sites = reSites(r), rows = (data.gains || []).filter((g) => !g.archived_at && (sites.includes(g.site_id) || r.site_id === "group")), t = gnTotals(rows), base = evReBlockBase(key, r);
      const top = rows.filter((g) => g.status === "Validé").sort((a, b) => (gnValue(b)?.euros || 0) - (gnValue(a)?.euros || 0)).slice(0, 5);
      return { n: t.toValidate, html: `<div class="re-gains"><span><b>${gnEuro(t.valid)}</b> par an validés</span><span><b>${gnEuro(t.forecast)}</b> en prévision</span>${t.toValidate ? `<span><b>${t.toValidate}</b> à valider</span>` : ""}</div>${top.length ? `<ul class="re-list">${top.map((g) => { const v = gnValue(g); return `<li>${esc(g.title)} · <b>${v?.euros != null ? gnEuro(v.euros) : esc(gnQty(v.year, g.unit))}</b> · ${esc(getSiteName(g.site_id))}</li>`; }).join("")}</ul>` : ""}${base.html.replace(/<div class="re-gains">[\s\S]*?<\/div>|<p class="re-empty">[^<]*<\/p>/, "")}` };
    }
    return evReBlockBase(key, r);
  };
}

function evBind(root = document) {
  root.querySelectorAll("[data-ev-month]").forEach((b) => (b.onclick = () => evMonthForm(b.dataset.evMonth || null)));
  root.querySelectorAll("[data-ev-event]").forEach((b) => (b.onclick = () => evEventForm()));
  root.querySelectorAll("[data-ev-open]").forEach((b) => (b.onclick = () => evEventForm(b.dataset.evOpen)));
  root.querySelectorAll("[data-ev-settings]").forEach((b) => (b.onclick = evSettingsForm));
  root.querySelectorAll("[data-ev-duty]").forEach((b) => (b.onclick = () => evDutyForm(b.dataset.evDuty || null)));
  root.querySelectorAll("[data-ev-ex]").forEach((b) => (b.onclick = () => evDutyForm(null, Number(b.dataset.evEx))));
  root.querySelectorAll("[data-ev-done]").forEach((b) => (b.onclick = () => { if (!commitData(() => { const d = data.envDuties.find((x) => x.id === b.dataset.evDone); d.last_date = today(); d.updated_at = now(); })) return; render(); toast("Obligation réalisée aujourd’hui."); }));
  root.querySelectorAll("[data-ev-sel]").forEach((b) => (b.onclick = () => { evSel = evSel === b.dataset.evSel || !b.dataset.evSel ? null : b.dataset.evSel; render(); }));
  root.querySelectorAll("[data-ev-site]").forEach((b) => (b.onclick = () => { state.site = b.dataset.evSite; try { localStorage.setItem("biaSite", state.site); } catch { /* stockage indisponible */ } render(); }));
  root.querySelectorAll("[data-ev-gains]").forEach((b) => (b.onclick = () => { gnFamily = "env"; state.pilotTab = "gains"; render(); }));
  root.querySelectorAll("[data-ev-go]").forEach((b) => (b.onclick = () => { state.pilotTab = "env"; switchView("pilotage"); state.pilotTab = "env"; render(); }));
}
const evOsBindBase = osBind;
osBind = function () { const out = evOsBindBase.apply(this, arguments); gnBind(document); evBind(document); return out; };
