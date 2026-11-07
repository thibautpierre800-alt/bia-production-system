"use strict";
/*
 * BIA Lean OS 8.37 · Les gains (Voir › Gains).
 *  - Une action, un chantier, une idée qui améliore un résultat déclare son gain : avant (référence), objectif, après (mesuré).
 *  - Sept familles : financier (économie réelle au compte de résultat, coût évité, capacité libérée valorisée), productivité,
 *    qualité, délai et service, sécurité et santé, environnement, humain et social. Un gain non financier peut être valorisé
 *    en euros (€ par unité : coût horaire, prix du kWh, coût d'un rebut).
 *  - Annualisé : écart × volume par an pour un gain récurrent ; ponctuel sinon. Coût de mise en œuvre → retour en mois.
 *  - Cycle : Estimé (sur l'objectif) → À valider (l'après est mesuré, avec sa preuve) → Validé par un responsable → tenu
 *    à 3, 6 et 12 mois. Un seul gain par source, famille et unité : pas de double comptage.
 *  - Sommes : euros par an validés et en prévision, par nature, par site, par famille ; objectif annuel du site ou du groupe ;
 *    cumul des validations dans l'année ; résultats sans gain déclaré (chantiers, actions suivies) à transformer d'un geste.
 * Données : gains[] étendus { family, nature, target, per_year, recurring, euro_rate, cost, start_date, validated_at, checks[] },
 *   compatibles avec l'ancien registre (quantity = volume pris en compte, period = « par an » ou « ponctuel »).
 *   gainTargets[] { scope (site ou group), euros } : objectif annuel.
 */

const GN_FAMILIES = [
  { id: "fin", label: "Financier", short: "€", units: ["€"], hint: "Matière, énergie, sous-traitance, heures supplémentaires, rebuts : ce qui se voit au compte de résultat." },
  { id: "prod", label: "Productivité", short: "P", units: ["h", "min", "points de TRS", "pièces/h"], hint: "Heures libérées, temps de changement, TRS, cadence." },
  { id: "qual", label: "Qualité", short: "Q", units: ["% de rebut", "pièces", "réclamations", "ppm"], hint: "Rebuts, retouches, réclamations clients." },
  { id: "delai", label: "Délai et service", short: "D", units: ["jours", "% de service", "h"], hint: "Délai de fabrication, taux de service, stock en jours." },
  { id: "secu", label: "Sécurité et santé", short: "S", units: ["situations dangereuses", "kg portés", "postures pénibles", "accidents", "dB"], hint: "Risques supprimés, charges portées, postures, bruit." },
  { id: "env", label: "Environnement", short: "E", units: ["kWh", "m³ d’eau", "kg de déchets", "kgCO₂e"], hint: "Énergie, eau, déchets, CO₂." },
  { id: "humain", label: "Humain et social", short: "H", units: ["personnes formées", "postes polyvalents", "irritants supprimés", "idées", "h d’absence"], hint: "Compétences, polyvalence, irritants, engagement." },
];
const GN_NATURES = { reel: "Économie réelle", evite: "Coût évité", capacite: "Capacité libérée" };
const GN_STATUSES = ["Estimé", "À valider", "Validé", "Refusé"];
const GN_CHECKS = [3, 6, 12];
let gnFamily = "", gnStatus = "";

function gnCan() { return role().nav.includes("pilotage"); }
function gnWritable(siteId) { return !role().readonly && osWritable(siteId); }
function gnFam(id) { return GN_FAMILIES.find((f) => f.id === id) || null; }
function gnFamilyOf(g) {
  if (g.family) return g.family;
  if (g.unit === "€") return "fin";
  if (["kWh", "kgCO₂e"].includes(g.unit)) return "env";
  if (["min", "h"].includes(g.unit)) return "prod";
  return "qual";
}
function gnNum(v) { return v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null; }
function gnDelta(g, v) { const b = gnNum(g.before), x = gnNum(v); return b === null || x === null ? null : g.direction === "high" ? x - b : b - x; }
function gnVolume(g) { if (g.per_year != null) return g.recurring === false ? 1 : Number(g.per_year) || 1; return gnNum(g.quantity) ?? 1; }
function gnUsesAfter(g) { return ["À valider", "Validé"].includes(g.status) && gnNum(g.after) !== null; }
function gnValue(g) {
  const base = gnUsesAfter(g) ? g.after : g.target ?? g.after, d = gnDelta(g, base);
  if (d === null) return null;
  const year = d * gnVolume(g), rate = gnNum(g.euro_rate);
  return { unit: d, year, euros: g.unit === "€" ? year : rate ? year * rate : null, measured: gnUsesAfter(g) };
}
function gnProgress(g) { const b = gnNum(g.before), t = gnNum(g.target), a = gnNum(g.after); if (b === null || t === null || a === null || t === b) return null; return (a - b) / (t - b); }
function gnPayback(g) { const v = gnValue(g), c = gnNum(g.cost); if (!v?.euros || !c || v.euros <= 0 || g.recurring === false) return null; return c / (v.euros / 12); }
function gnEuro(n) { if (n === null || n === undefined || !Number.isFinite(n)) return "—"; const a = Math.abs(n); return a >= 1e6 ? `${smNum(n / 1e6)} M€` : a >= 1e4 ? `${smNum(Math.round(n / 100) / 10)} k€` : `${Math.round(n).toLocaleString("fr-FR")} €`; }
function gnN(n) { return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("fr-FR") : smNum(Math.round(n * 100) / 100); }
function gnQty(n, unit) { return `${Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("fr-FR") : smNum(Math.round(n * 10) / 10)} ${unit}`; }
function gnRows() { return osScope(data.gains || []).filter((g) => !g.archived_at); }
function gnYear(g) { return String(g.validated_at || g.start_date || g.created_at || "").slice(0, 4); }
function gnTarget(scope = state.site) { const v = (data.gainTargets || []).find((x) => x.scope === scope)?.euros; return gnNum(v); }
function gnChecksDue(g) {
  if (g.status !== "Validé" || !g.start_date) return [];
  return GN_CHECKS.filter((m) => !(g.checks || []).some((c) => c.months === m) && auAddMonths(g.start_date, m) <= today());
}
function auAddMonths(day, m) { const d = new Date(`${day}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); }
function gnHeld(g) { const c = (g.checks || []).slice().sort((a, b) => b.months - a.months)[0]; return c ? { months: c.months, held: c.held } : null; }

function gnTotals(rows) {
  const year = today().slice(0, 4), t = { valid: 0, forecast: 0, byNature: { reel: 0, evite: 0, capacite: 0, autre: 0 }, toValidate: 0, fam: {}, n: 0 };
  rows.forEach((g) => {
    if (g.status === "Refusé") return;
    const v = gnValue(g), f = gnFamilyOf(g);
    if (!v) return;
    t.n++;
    (t.fam[f] ||= { n: 0, euros: 0, units: {} }).n++;
    if (g.status === "Validé") {
      if (v.euros !== null) { t.fam[f].euros += v.euros; if (gnYear(g) === year || g.recurring !== false) { t.valid += v.euros; t.byNature[f === "fin" ? g.nature || "reel" : "autre"] += v.euros; } }
      t.fam[f].units[g.unit] = (t.fam[f].units[g.unit] || 0) + v.year;
    } else { if (v.euros !== null) t.forecast += v.euros; const fu = (t.fam[f].fore ||= {}); fu[g.unit] = (fu[g.unit] || 0) + v.year; }
    if (g.status === "À valider") t.toValidate++;
  });
  return t;
}
/* Résultats chiffrés sans gain déclaré : chantiers et actions suivies. */
function gnCandidates() {
  const declared = new Set((data.gains || []).filter((g) => !g.archived_at).map((g) => g.source_id));
  const out = [];
  (typeof osScope === "function" ? osScope(data.projects || []) : []).forEach((p) => {
    const k = typeof cdKpi === "function" ? cdKpi(p) : null;
    if (!k || declared.has(p.id) || p.archived_at) return;
    const last = typeof cdLast === "function" ? cdLast(p) : null;
    if (!last && p.status !== "Clos") return;
    out.push({ id: p.id, kind: "Chantier", title: p.title, site_id: p.site_id, preset: { title: `${k.label || p.title}`, unit: k.unit || "", before: Number(k.base), target: Number(k.target), after: last ? Number(last.value) : null, direction: Number(k.target) < Number(k.base) ? "low" : "high" } });
  });
  osScope(data.actions || []).forEach((a) => {
    const s = a.sustainment;
    if (!s || declared.has(a.id) || a.archived_at || gnNum(s.before) === null || gnNum(s.target) === null) return;
    out.push({ id: a.id, kind: "Action", title: a.title, site_id: a.site_id, preset: { title: s.criterion || a.title, unit: s.unit || "", before: Number(s.before), target: Number(s.target), after: null, direction: s.direction || "low" } });
  });
  return out.slice(0, 12);
}

/* ---------- Page ---------- */

function gnBullet(g) {
  const b = gnNum(g.before), t = gnNum(g.target), a = gnNum(g.after);
  const vals = [b, t, a].filter((x) => x !== null);
  if (vals.length < 2) return "";
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = (v) => ((g.direction === "high" ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)) * 100).toFixed(1), good = a !== null && gnDelta(g, a) > 0, hit = a !== null && t !== null && gnDelta(g, a) >= gnDelta(g, t) - 1e-9;
  return `<div class="gn-bullet" role="img" aria-label="${esc(`Avant ${b} ${g.unit}${t !== null ? `, objectif ${t}` : ""}${a !== null ? `, après ${a}` : ""}`)}">
    <span class="gn-track"></span>${a !== null && b !== null ? `<span class="gn-move ${good ? (hit ? "hit" : "part") : "bad"}" style="left:${Math.min(X(b), X(a))}%;width:${Math.abs(X(a) - X(b))}%"></span>` : ""}
    ${b !== null ? `<i class="gn-dot gn-before" style="left:${X(b)}%"></i>` : ""}${t !== null ? `<i class="gn-tick" style="left:${X(t)}%"></i>` : ""}${a !== null ? `<i class="gn-dot gn-after ${good ? "" : "bad"}" style="left:${X(a)}%"></i>` : ""}
    <span class="gn-lbl">Avant <b>${b === null ? "—" : gnN(b)}</b>${t !== null ? ` · objectif <b>${gnN(t)}</b>` : ""} · après <b>${a === null ? "à mesurer" : gnN(a)}</b> ${esc(g.unit || "")}</span></div>`;
}

function gnPage() {
  const all = gnRows(), t = gnTotals(all), target = gnTarget(), w = gnWritable(state.site === "group" ? "group" : state.site), mgr = osManager() && !role().readonly;
  const head = pageHead("Voir", "Gains", "Chaque action qui améliore un résultat déclare son gain : avant, objectif, après. Validés, ils s’additionnent par site, par type et sur l’année.",
    `<div class="cs-head-tools">${w ? '<button type="button" class="btn" data-gn-new>Déclarer un gain</button>' : ""}${mgr ? '<button type="button" class="btn secondary" data-gn-target>Objectif annuel</button>' : ""}<button type="button" class="btn ghost" data-gn-csv>Exporter</button></div>`);
  const pct = target ? Math.min(100, (t.valid / target) * 100) : 0, pctF = target ? Math.min(100 - pct, (t.forecast / target) * 100) : 0;
  const goal = `<section class="section gn-goal"><div class="cs-summary"><div class="ok"><b>${gnEuro(t.valid)}</b><span>par an, validés</span></div><div><b>${gnEuro(t.forecast)}</b><span>par an, en prévision</span></div><div><b>${target ? gnEuro(target) : "—"}</b><span>objectif annuel${state.site === "group" ? " du groupe" : " du site"}</span></div><div class="${t.toValidate ? "warn" : ""}"><b>${t.toValidate}</b><span>gain${t.toValidate > 1 ? "s" : ""} à valider</span></div></div>
    ${target ? `<div class="gn-gbar" role="img" aria-label="${esc(`${gnEuro(t.valid)} validés et ${gnEuro(t.forecast)} en prévision sur un objectif de ${gnEuro(target)}`)}"><span class="v" style="width:${pct.toFixed(1)}%"></span><span class="f" style="width:${pctF.toFixed(1)}%"></span></div><p class="hint">${Math.round((t.valid / target) * 100)} % de l’objectif validé · ${Math.round(((t.valid + t.forecast) / target) * 100)} % avec la prévision</p>` : mgr ? '<p class="hint">Fixez l’objectif annuel de gains pour suivre l’avancement.</p>' : ""}
    <div class="gn-nat">${Object.entries(GN_NATURES).map(([k, l]) => `<span><small>${esc(l)}</small><b>${gnEuro(t.byNature[k])}</b></span>`).join("")}<span><small>Valorisation des autres gains</small><b>${gnEuro(t.byNature.autre)}</b></span></div></section>`;
  const fams = `<section class="section"><div class="section-title"><h2>Par type de gain</h2>${gnFamily ? '<button type="button" class="btn ghost small" data-gn-fam="">Tous les types</button>' : ""}</div><div class="gn-fams">${GN_FAMILIES.map((f) => { const x = t.fam[f.id] || { n: 0, euros: 0, units: {} }, u = Object.entries(x.units).filter(([k]) => k !== "€").slice(0, 2); return `<button type="button" class="gn-fam ${gnFamily === f.id ? "active" : ""}" data-gn-fam="${f.id}" aria-pressed="${gnFamily === f.id}"><span class="gn-ico gn-${f.id}">${esc(f.short)}</span><b>${esc(f.label)}</b><span class="gn-famv">${x.euros ? gnEuro(x.euros) : u.length ? u.map(([k, v]) => esc(gnQty(v, k))).join(" · ") : x.fore ? `<small class="gn-prev">prévu : ${Object.entries(x.fore).slice(0, 2).map(([k, v]) => esc(gnQty(v, k))).join(" · ")}</small>` : "—"}</span><small>${x.n} gain${x.n > 1 ? "s" : ""}${x.euros && u.length ? ` · ${u.map(([k, v]) => esc(gnQty(v, k))).join(" · ")}` : ""}</small></button>`; }).join("")}</div></section>`;
  const sites = state.site === "group" ? gnSites() : "";
  const cand = w ? gnCandidates() : [];
  const todo = cand.length ? `<section class="section gn-todo"><div class="section-title"><h2>Résultats sans gain déclaré · ${cand.length}</h2></div><div class="jn-rows">${cand.map((c) => `<div class="jn-row"><span class="jn-row-main"><span class="jn-tag">${esc(c.kind)}</span><b>${esc(c.title)}</b><span class="hint">${esc(getSiteName(c.site_id))} · avant ${smNum(c.preset.before)} → objectif ${smNum(c.preset.target)}${c.preset.after !== null ? ` · mesuré ${smNum(c.preset.after)}` : ""} ${esc(c.preset.unit)}</span></span><button type="button" class="btn small" data-gn-from="${esc(c.id)}">Déclarer le gain</button></div>`).join("")}</div></section>` : "";
  const due = all.filter((g) => gnChecksDue(g).length);
  const dueBlock = due.length ? `<section class="section"><div class="section-title"><h2>Gains à revérifier · ${due.length}</h2></div><p class="hint">Un gain validé se revérifie à 3, 6 et 12 mois : est-il toujours là ?</p><div class="jn-rows">${due.map((g) => `<button type="button" class="jn-row" data-gn-open="${esc(g.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">${gnChecksDue(g).map((m) => `${m} mois`).join(", ")}</span><b>${esc(g.title)}</b><span class="hint">${esc(getSiteName(g.site_id))}</span></span></button>`).join("")}</div></section>` : "";
  const rows = all.filter((g) => (!gnFamily || gnFamilyOf(g) === gnFamily) && (!gnStatus || g.status === gnStatus)).sort((a, b) => (gnValue(b)?.euros || 0) - (gnValue(a)?.euros || 0));
  const filt = `<div class="filters" role="group" aria-label="Statut">${["", ...GN_STATUSES].map((s) => `<button type="button" class="chip ${gnStatus === s ? "active" : ""}" data-gn-st="${esc(s)}" aria-pressed="${gnStatus === s}">${s || "Tous"} <small>${s ? all.filter((g) => g.status === s).length : all.length}</small></button>`).join("")}</div>`;
  const list = `<section class="section"><div class="section-title"><h2>Les gains${gnFamily ? ` · ${esc(gnFam(gnFamily).label)}` : ""}</h2></div>${filt}${rows.length ? `<div class="gn-list">${rows.slice(0, 80).map(gnCard).join("")}</div>` : '<p class="hint">Aucun gain pour ce filtre.</p>'}</section>`;
  return `${head}${goal}${gnCumul(all, target)}${fams}${sites}${todo}${dueBlock}${list}${gnHow()}`;
}

function gnCard(g) {
  const v = gnValue(g), f = gnFam(gnFamilyOf(g)), p = gnProgress(g), pb = gnPayback(g), h = gnHeld(g), src = g.source_id ? osRecord(g.source_id) : null;
  const tone = { "Estimé": "neutral", "À valider": "open", "Validé": "done", "Refusé": "neutral" }[g.status] || "neutral";
  return `<button type="button" class="gn-card" data-gn-open="${esc(g.id)}"><div class="gn-card-top"><span class="gn-ico gn-${f.id}" aria-hidden="true">${esc(f.short)}</span><span class="gn-card-t"><b>${esc(g.title)}</b><small>${esc(getSiteName(g.site_id))}${src ? ` · ${esc(src.row.id)} ${esc(osTitle(src.row) || "")}` : ""}${g.nature ? ` · ${esc(GN_NATURES[g.nature] || "")}` : ""}</small></span>${pill(g.status || "À valider", tone)}</div>
    ${gnBullet(g)}
    <div class="gn-card-foot"><span>${v ? `<b>${v.euros !== null ? `${gnEuro(v.euros)}${g.recurring === false ? "" : " / an"}` : gnQty(v.year, g.unit)}</b>${v.euros !== null && g.unit !== "€" ? ` · ${esc(gnQty(v.year, g.unit))}${g.recurring === false ? "" : " / an"}` : ""}${v.measured ? "" : " · prévision"}` : "Valeurs à compléter"}</span>${p !== null ? `<span>${Math.round(p * 100)} % de l’objectif</span>` : ""}${pb !== null ? `<span>retour en ${smNum(Math.round(pb * 10) / 10)} mois</span>` : ""}${h ? `<span class="${h.held ? "ok" : "bad"}">${h.held ? "tenu" : "non tenu"} à ${h.months} mois</span>` : ""}</div></button>`;
}

function gnCumul(all, target) {
  const year = today().slice(0, 4), months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`), cur = Number(today().slice(5, 7));
  const per = months.map((m) => all.filter((g) => g.status === "Validé" && String(g.validated_at || "").slice(0, 7) === m).reduce((n, g) => n + (gnValue(g)?.euros || 0), 0));
  if (!per.some(Boolean)) return "";
  let c = 0; const cum = per.map((x) => (c += x)), max = Math.max(target || 0, ...cum, 1) * 1.1;
  const names = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `<section class="section"><div class="section-title"><h2>Validés en ${year}, cumulés</h2></div><figure class="gn-cum" role="img" aria-label="${esc(months.slice(0, cur).map((m, i) => `${names[i]} ${gnEuro(cum[i])}`).join(", "))}"><div class="gn-cbars">${target ? `<span class="gn-ctarget" style="bottom:${((target / max) * 100).toFixed(1)}%"><small>objectif ${gnEuro(target)}</small></span><span class="gn-cpace" style="--h:${((target / max) * 100).toFixed(1)}%"></span>` : ""}${cum.map((v, i) => `<span class="gn-ccol ${i >= cur ? "future" : ""}"><i style="height:${i < cur ? ((v / max) * 100).toFixed(1) : 0}%"></i><small>${names[i]}</small></span>`).join("")}</div><figcaption>Euros par an des gains validés, cumulés mois par mois${target ? " ; la diagonale indique le rythme pour atteindre l’objectif" : ""}.</figcaption></figure></section>`;
}

function gnSites() {
  const rows = OPERATIONAL_SITES.filter((s) => allowedSite(s.id)).map((s) => { const r = (data.gains || []).filter((g) => !g.archived_at && g.site_id === s.id), t = gnTotals(r); return { s, t, target: gnTarget(s.id) }; }).filter((x) => x.t.n || x.target);
  if (!rows.length) return "";
  return `<section class="section"><div class="section-title"><h2>Par site</h2></div><div class="cn-scroll"><table class="gn-sites"><thead><tr><th>Site</th><th>Validés / an</th><th>En prévision</th><th>Objectif</th><th>Gains</th><th>À valider</th></tr></thead><tbody>${rows.sort((a, b) => b.t.valid - a.t.valid).map(({ s, t, target }) => `<tr><th>${esc(s.name)}</th><td><b>${gnEuro(t.valid)}</b>${target ? ` <small>${Math.round((t.valid / target) * 100)} %</small>` : ""}</td><td>${gnEuro(t.forecast)}</td><td>${target ? gnEuro(target) : "—"}</td><td>${t.n}</td><td>${t.toValidate || ""}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function gnHow() {
  return `<details class="cs-how section"><summary>Les règles d’un gain qui compte</summary><ol class="cs-how-list">
    <li><b>Une référence avant, figée</b><span>La valeur d’avant, sur une période dite (par exemple les trois mois précédents), avant de commencer.</span></li>
    <li><b>Trois natures de gain financier</b><span>Économie réelle : elle se voit au compte de résultat. Coût évité : une dépense qui aurait eu lieu. Capacité libérée : des heures ou des m² rendus, qui ne deviennent de l’argent que s’ils sont réutilisés.</span></li>
    <li><b>Annualiser</b><span>Un gain récurrent = écart × volume d’une année (changements de série, jours ouvrés, pièces). Un gain ponctuel compte une fois.</span></li>
    <li><b>Valoriser les autres gains</b><span>Une heure au coût horaire du site, un kWh à son prix, un rebut à son coût : le gain garde son unité et gagne une valeur en euros.</span></li>
    <li><b>Un gain, une source</b><span>Un seul gain par action, famille et unité. Deux actions qui jouent sur la même dépense se partagent le gain, sans le compter deux fois.</span></li>
    <li><b>Valider, puis vérifier</b><span>Le responsable valide avec la preuve (relevé, facture, contrôle de gestion). À 3, 6 et 12 mois : le gain est-il toujours là ?</span></li></ol></details>`;
}

/* ---------- Formulaire ---------- */

function gnForm(id = null, preset = {}) {
  const old = id ? (data.gains || []).find((g) => g.id === id) : null, base = { ...preset, ...(old || {}) };
  const siteId = base.site_id || (state.site === "group" ? OPERATIONAL_SITES.find((s) => gnWritable(s.id))?.id : state.site);
  if (!siteId || !gnWritable(siteId)) return toast("Ce site n’est pas dans votre périmètre d’écriture.");
  const mgr = osManager() && !role().readonly;
  let fam = base.family || (old ? gnFamilyOf(old) : "fin");
  const sources = [...osScope(data.projects || []).filter((p) => p.site_id === siteId && !p.archived_at).map((p) => [p.id, `Chantier · ${p.title}`]), ...osScope(data.actions || []).filter((a) => a.site_id === siteId && !a.archived_at).slice(0, 60).map((a) => [a.id, `Action · ${a.title}`]), ...osScope(data.kaizens || []).filter((k) => k.site_id === siteId && !k.archived_at).slice(0, 40).map((k) => [k.id, `Idée · ${k.title}`])];
  const recurring = base.recurring !== false;
  modal(old ? `${old.id} · Gain` : "Déclarer un gain", `<form id="gnForm" class="jn-form gn-form">
    <label class="field">Le gain, en une phrase<input id="gnTitle" required maxlength="140" value="${esc(base.title || "")}" placeholder="Ex. Changement de série plaqueuse réduit de 40 à 18 min" autocomplete="off"></label>
    <div class="bp-two">${state.site === "group" && !old ? `<label class="field">Site<select id="gnSite">${OPERATIONAL_SITES.filter((s) => gnWritable(s.id)).map((s) => `<option value="${esc(s.id)}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}<label class="field">D’où vient-il<select id="gnSource"><option value="">Aucune source</option>${sources.map(([v, l]) => `<option value="${esc(v)}" ${v === base.source_id ? "selected" : ""}>${esc(l.slice(0, 80))}</option>`).join("")}</select></label></div>
    <div class="field"><span class="metric-label">Type de gain</span><div class="gn-famchips">${GN_FAMILIES.map((f) => `<button type="button" class="chip ${f.id === fam ? "active" : ""}" data-gn-ff="${f.id}" aria-pressed="${f.id === fam}"><span class="gn-ico gn-${f.id}">${esc(f.short)}</span>${esc(f.label)}</button>`).join("")}</div><small class="hint" id="gnFamHint"></small></div>
    <div class="field gn-nature" id="gnNatureBox"><span class="metric-label">Nature du gain financier</span><div class="filters">${Object.entries(GN_NATURES).map(([k, l]) => `<button type="button" class="chip ${k === (base.nature || "reel") ? "active" : ""}" data-gn-nat="${k}" aria-pressed="${k === (base.nature || "reel")}">${esc(l)}</button>`).join("")}</div></div>
    <div class="bp-two"><label class="field">Unité<input id="gnUnit" list="gnUnits" required maxlength="40" value="${esc(base.unit || "€")}"><datalist id="gnUnits"></datalist></label><label class="field">Sens du progrès<select id="gnDir"><option value="low" ${base.direction !== "high" ? "selected" : ""}>Moins, c’est mieux</option><option value="high" ${base.direction === "high" ? "selected" : ""}>Plus, c’est mieux</option></select></label></div>
    <div class="gn-three"><label class="field">Avant (référence)<input id="gnBefore" type="number" inputmode="decimal" step="any" required value="${esc(base.before ?? "")}"></label><label class="field">Objectif<input id="gnTargetV" type="number" inputmode="decimal" step="any" value="${esc(base.target ?? "")}"></label><label class="field">Après (mesuré)<input id="gnAfter" type="number" inputmode="decimal" step="any" value="${esc(base.after ?? "")}" placeholder="à mesurer"></label></div>
    <div class="bp-two"><div class="field"><span class="metric-label">Le gain se répète-t-il ?</span><div class="filters"><button type="button" class="chip ${recurring ? "active" : ""}" data-gn-rec="1" aria-pressed="${recurring}">Oui, chaque année</button><button type="button" class="chip ${!recurring ? "active" : ""}" data-gn-rec="0" aria-pressed="${!recurring}">Non, une fois</button></div></div><label class="field" id="gnVolBox">Volume par an<input id="gnPerYear" type="number" inputmode="decimal" min="0" step="any" value="${esc(base.per_year ?? (old && old.per_year == null ? old.quantity ?? "" : ""))}" placeholder="Ex. 250 changements, 220 jours"><small>Combien de fois l’écart se produit dans une année</small></label></div>
    <div class="bp-two"><label class="field" id="gnRateBox">Valeur en € par unité<input id="gnRate" type="number" inputmode="decimal" min="0" step="any" value="${esc(base.euro_rate ?? "")}" placeholder="Ex. coût horaire, prix du kWh"><small>Pour valoriser un gain non financier (facultatif)</small></label><label class="field">Coût de mise en œuvre (€)<input id="gnCost" type="number" inputmode="decimal" min="0" step="any" value="${esc(base.cost ?? "")}"></label></div>
    <div class="bp-two"><label class="field">Mis en place le<input id="gnStart" type="date" max="${today()}" value="${esc(base.start_date || "")}"></label><label class="field">Preuve et méthode<input id="gnEvidence" maxlength="400" value="${esc(base.evidence || "")}" placeholder="Relevé, facture, chrono, contrôle de gestion" autocomplete="off"></label></div>
    <div class="gn-live" id="gnLive" aria-live="polite"></div>
    ${old && old.status === "Validé" && old.start_date ? `<fieldset class="ts-fs"><legend>Tenue du gain</legend><p class="hint">${(old.checks || []).length ? old.checks.map((c) => `${c.months} mois : ${c.held ? "tenu" : "non tenu"} (${smNum(c.after)} ${esc(old.unit)}, ${shortDate(c.at)})`).join(" · ") : "Pas encore revérifié."}</p>${gnChecksDue(old).length ? `<div class="bp-two"><label class="field">Mesure à ${gnChecksDue(old)[0]} mois<input id="gnCheckV" type="number" inputmode="decimal" step="any"></label><div class="field"><span class="metric-label">&nbsp;</span><button type="button" class="btn secondary" data-gn-check="${gnChecksDue(old)[0]}">Enregistrer la vérification</button></div></div>` : ""}</fieldset>` : ""}
    <div class="form-actions"><button class="btn jn-big" data-gn-save="">${old ? "Enregistrer" : "Déclarer le gain"}</button>${mgr && old?.status !== "Validé" ? '<button type="button" class="btn secondary" data-gn-save="Validé">Valider le gain</button>' : ""}${mgr && old && old.status !== "Refusé" && old.status !== "Validé" ? '<button type="button" class="btn ghost" data-gn-save="Refusé">Refuser</button>' : ""}${old ? '<button type="button" class="btn ghost" data-gn-archive>Retirer</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  let nat = base.nature || "reel", rec = recurring;
  const setFam = (f) => {
    fam = f; const F = gnFam(f);
    root.querySelectorAll("[data-gn-ff]").forEach((b) => { b.classList.toggle("active", b.dataset.gnFf === f); b.setAttribute("aria-pressed", String(b.dataset.gnFf === f)); });
    $("gnFamHint").textContent = F.hint;
    $("gnUnits").innerHTML = F.units.map((u) => `<option value="${esc(u)}">`).join("");
    $("gnNatureBox").hidden = f !== "fin";
    if (!old && !preset.unit && !$("gnUnit").dataset.touched) $("gnUnit").value = F.units[0];
    $("gnRateBox").hidden = $("gnUnit").value === "€";
  };
  const read = () => ({ title: $("gnTitle").value.trim(), site_id: $("gnSite")?.value || siteId, source_id: $("gnSource").value || null, family: fam, nature: fam === "fin" ? nat : null, unit: $("gnUnit").value.trim(), direction: $("gnDir").value, before: gnNum($("gnBefore").value), target: gnNum($("gnTargetV").value), after: gnNum($("gnAfter").value), recurring: rec, per_year: rec ? gnNum($("gnPerYear").value) ?? 1 : 1, euro_rate: $("gnUnit").value.trim() === "€" ? null : gnNum($("gnRate").value), cost: gnNum($("gnCost").value), start_date: $("gnStart").value || null, evidence: $("gnEvidence").value.trim() });
  const live = () => {
    const g = { ...read(), status: gnNum($("gnAfter").value) !== null ? "À valider" : "Estimé" }, v = gnValue(g), pb = gnPayback(g), p = gnProgress(g);
    $("gnVolBox").hidden = !rec; $("gnRateBox").hidden = g.unit === "€";
    $("gnLive").innerHTML = v ? `<b>${v.euros !== null ? `${gnEuro(v.euros)}${rec ? " par an" : ""}` : `${gnQty(v.year, g.unit)}${rec ? " par an" : ""}`}</b>${v.euros !== null && g.unit !== "€" ? ` · ${esc(gnQty(v.year, g.unit))}${rec ? " par an" : ""}` : ""}<span class="hint">${v.measured ? "sur la valeur mesurée" : "prévision, sur l’objectif"}${p !== null ? ` · ${Math.round(p * 100)} % de l’objectif` : ""}${pb !== null ? ` · retour sur investissement en ${smNum(Math.round(pb * 10) / 10)} mois` : ""}</span>${v.unit < 0 ? '<p class="ts-warn">L’après est moins bon que l’avant : vérifiez le sens du progrès.</p>' : ""}` : '<span class="hint">Renseignez l’avant et l’objectif ou l’après.</span>';
  };
  root.querySelectorAll("[data-gn-ff]").forEach((b) => (b.onclick = () => { setFam(b.dataset.gnFf); live(); }));
  root.querySelectorAll("[data-gn-nat]").forEach((b) => (b.onclick = () => { nat = b.dataset.gnNat; root.querySelectorAll("[data-gn-nat]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  root.querySelectorAll("[data-gn-rec]").forEach((b) => (b.onclick = () => { rec = b.dataset.gnRec === "1"; root.querySelectorAll("[data-gn-rec]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); live(); }));
  $("gnUnit").addEventListener("input", () => { $("gnUnit").dataset.touched = "1"; });
  $("gnForm").onsubmit = (e) => { e.preventDefault(); root.querySelector('[data-gn-save=""]').click(); };
  $("gnForm").addEventListener("input", live);
  $("gnForm").addEventListener("change", live);
  setFam(fam); live();
  root.querySelector("[data-gn-archive]")?.addEventListener("click", () => { if (!commitData(() => { const g = data.gains.find((x) => x.id === old.id); g.archived_at = now(); g.updated_at = now(); })) return; modalDirty = false; closeModal(); render(); toast("Gain retiré du registre."); });
  root.querySelector("[data-gn-check]")?.addEventListener("click", (e) => {
    const m = Number(e.currentTarget.dataset.gnCheck), v = gnNum($("gnCheckV").value);
    if (v === null) return toast("La mesure du jour.");
    const held = gnDelta(old, v) >= (gnDelta(old, old.after) ?? 0) * 0.8;
    if (!commitData(() => { const g = data.gains.find((x) => x.id === old.id); (g.checks ||= []).push({ months: m, at: today(), after: v, held, by: apMe() || role().label }); g.updated_at = now(); })) return;
    modalDirty = false; closeModal(); render(); toast(held ? `Gain tenu à ${m} mois.` : `Gain non tenu à ${m} mois : à reprendre avec l’équipe.`);
  });
  root.querySelectorAll("[data-gn-save]").forEach((btn) => (btn.onclick = (e) => {
    e.preventDefault();
    const g = read(), want = btn.dataset.gnSave;
    if (!g.title) return toast("Le gain en une phrase.");
    if (!g.unit) return toast("L’unité du gain.");
    if (g.before === null) return toast("La valeur d’avant : c’est la référence.");
    if (g.target === null && g.after === null) return toast("L’objectif ou la valeur mesurée après.");
    if (g.source_id && (data.gains || []).some((x) => !x.archived_at && x.id !== old?.id && x.source_id === g.source_id && gnFamilyOf(x) === g.family && x.unit === g.unit)) return toast("Cette source a déjà un gain de ce type et de cette unité : modifiez-le, sans compter deux fois.");
    let status = want || (g.after !== null ? "À valider" : "Estimé");
    if (want === "" && old?.status === "Validé" && g.after !== null) status = "Validé";
    if (status === "Validé" && (g.after === null || !g.evidence)) return toast("Pour valider : la valeur mesurée après et la preuve.");
    if (status === "Validé" && !(osManager() && !role().readonly)) return toast("Un responsable valide le gain.");
    let gid = old?.id;
    if (!commitData(() => {
      data.gains ||= [];
      const patch = { ...g, status, quantity: gnVolume(g), period: g.recurring ? "par an" : "ponctuel", updated_at: now() };
      if (status === "Validé" && old?.status !== "Validé") Object.assign(patch, { validated_by: apMe() || role().label, validated_at: now() });
      if (status === "Validé" && !g.start_date) patch.start_date = today();
      if (old) Object.assign(data.gains.find((x) => x.id === old.id), patch);
      else { gid = nextId("GAIN", data.gains); data.gains.unshift({ id: gid, created_at: now(), by: apMe() || role().label, ...patch }); }
    })) return;
    modalDirty = false; closeModal(); render();
    const v = gnValue((data.gains || []).find((x) => x.id === gid));
    toast(`${status === "Validé" ? "Gain validé" : status === "Refusé" ? "Gain refusé" : "Gain enregistré"}${v && status !== "Refusé" ? ` : ${v.euros !== null ? gnEuro(v.euros) : gnQty(v.year, g.unit)}${g.recurring ? " par an" : ""}` : ""}.`);
  }));
}

function gnTargetForm() {
  const scope = state.site;
  modal(`Objectif annuel de gains · ${scope === "group" ? "groupe" : getSiteName(scope)}`, `<form id="gnTgForm" class="jn-form"><label class="field">Euros par an à valider<input id="gnTg" type="number" inputmode="numeric" min="0" step="1000" value="${esc(gnTarget(scope) ?? "")}" required></label><p class="hint">Les gains validés de l’année et les gains récurrents comptent pour leur valeur annuelle.</p><div class="form-actions"><button class="btn jn-big">Enregistrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("gnTgForm").onsubmit = (e) => { e.preventDefault(); const v = gnNum($("gnTg").value); if (v === null || v < 0) return toast("Un montant."); if (!commitData(() => { data.gainTargets ||= []; const o = data.gainTargets.find((x) => x.scope === scope); if (o) Object.assign(o, { euros: v, updated_at: now() }); else data.gainTargets.push({ scope, euros: v, by: apMe() || role().label, updated_at: now() }); })) return; modalDirty = false; closeModal(); render(); toast("Objectif enregistré."); };
}

function gnCsv() {
  const head = ["id", "site", "type", "nature", "titre", "source", "unite", "sens", "avant", "objectif", "apres", "recurrent", "volume_an", "euro_par_unite", "gain_an_unite", "gain_an_euros", "cout", "statut", "valide_par", "valide_le"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = gnRows().map((g) => { const v = gnValue(g); return [g.id, getSiteName(g.site_id), gnFam(gnFamilyOf(g)).label, GN_NATURES[g.nature] || "", g.title, g.source_id || "", g.unit, g.direction === "high" ? "plus" : "moins", g.before, g.target, g.after, g.recurring === false ? "non" : "oui", gnVolume(g), g.euro_rate, v ? Math.round(v.year * 100) / 100 : "", v?.euros != null ? Math.round(v.euros) : "", g.cost, g.status, g.validated_by, String(g.validated_at || "").slice(0, 10)].map(q).join(";"); });
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `gains-${state.site}-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function gnBind(root = document) {
  root.querySelectorAll("[data-gn-new]").forEach((b) => (b.onclick = () => gnForm()));
  root.querySelectorAll("[data-gn-open]").forEach((b) => (b.onclick = () => gnForm(b.dataset.gnOpen)));
  root.querySelectorAll("[data-gn-target]").forEach((b) => (b.onclick = gnTargetForm));
  root.querySelectorAll("[data-gn-csv]").forEach((b) => (b.onclick = gnCsv));
  root.querySelectorAll("[data-gn-fam]").forEach((b) => (b.onclick = () => { gnFamily = gnFamily === b.dataset.gnFam ? "" : b.dataset.gnFam; render(); }));
  root.querySelectorAll("[data-gn-st]").forEach((b) => (b.onclick = () => { gnStatus = b.dataset.gnSt; render(); }));
  root.querySelectorAll("[data-gn-from]").forEach((b) => (b.onclick = () => { const c = gnCandidates().find((x) => x.id === b.dataset.gnFrom); if (c) gnForm(null, { ...c.preset, site_id: c.site_id, source_id: c.id, family: ["min", "h"].includes(c.preset.unit) ? "prod" : undefined }); }));
}
