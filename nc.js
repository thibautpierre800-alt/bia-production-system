"use strict";
/*
 * BIA Lean OS 8.38 · Non-conformités (Résoudre › Non-conformités) : scanner la commande, l'analyse se fait seule,
 * le 8D arrive prérempli.
 *  - Déclarer : scanner le numéro de commande (douchette = clavier, ou caméra du téléphone quand le navigateur sait lire
 *    les codes) ou le saisir. La commande est retrouvée dans la base : client, article, désignation, lot, ligne,
 *    date de fabrication, quantité. Origine (client, interne, fournisseur), défaut, quantité, gravité, mesure immédiate.
 *  - Analyse automatique pendant la saisie : récurrence (même article, même client, même défaut sur la même ligne
 *    sur 90 jours, dossiers déjà ouverts), production du jour de fabrication (feuilles de poste : TRS, qualité, arrêts,
 *    micro-arrêts ; pannes TPM ; signaux), autres commandes du même article encore à livrer (à vérifier).
 *  - Proposition de traitement, avec ses raisons : 8D (client touché, gravité critique, récurrence), QRQC (interne majeure),
 *    action simple (mineure, première fois). Le 8D ou le QRQC est créé prérempli : D0 urgence, D1 équipe proposée,
 *    D2 en 5W2H, D3 confinement et commandes à vérifier, D4 pistes tirées des données ; Pareto du défaut sur l'article.
 *  - Lecture : Pareto automatique des non-conformités par défaut, article, client, ligne ou origine (90 jours ou 12 mois),
 *    en nombre ou en pièces ; « les premiers font 80 % ».
 *  - 8.39 · Réclamation client : n° de réclamation, retour physique (pièces, date de réception), décision sur les pièces,
 *    coût ; trois jalons de réponse au client (accusé et confinement sous 1 jour ouvré, causes et actions sous 10 jours
 *    ouvrés, 8D clos sous 60 jours), suivis en retard ou à temps ; rapport 8D à envoyer ; « À surveiller ».
 * Données : orders[] { no, site_id, client, article, designation, quantity, line, prod_date, lot, due_date, delivered }
 *           ncs[] { id, site_id, date, order_no, client, article, designation, lot, line, prod_date, origin, defect, qty,
 *                   severity, text, containment, decision, problem_id, action_id, status, by } — non indexées.
 */

const NC_ORIGINS = ["Client", "Interne", "Fournisseur"];
const NC_DEFECTS = ["Aspect, rayure", "Dimension", "Collage, décollement", "Teinte, finition", "Placage", "Usinage", "Emballage, transport", "Quantité, référence", "Documentation", "Autre"];
const NC_SEV = ["Mineure", "Majeure", "Critique"];
const NC_DIMS = [["defect", "Défaut"], ["article", "Article"], ["client", "Client"], ["line", "Ligne"], ["origin", "Origine"]];
const NC_CLAIM_DEC = ["À décider", "Retouche", "Rebut", "Remplacement", "Accepté en l’état", "Avoir"];
const NC_STEPS = [["ack_at", "Accusé de réception et confinement", 1, "w"], ["cause_at", "Causes et actions correctives", 10, "w"], ["close8d_at", "8D clos et envoyé au client", 60, "d"]];
function ncWorkAdd(day, n) { const d = new Date(`${day}T12:00:00Z`); let k = 0; while (k < n) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) k++; } return d.toISOString().slice(0, 10); }
function ncSteps(nc) {
  if (nc.origin !== "Client") return [];
  const start = nc.claim_date || nc.date || today();
  return NC_STEPS.map(([key, label, n, mode]) => { const due = mode === "w" ? ncWorkAdd(start, n) : auAddMonths(start, 2), done = nc[key] || null; return { key, label, due, done, late: !done && due < today(), lateDone: !!done && done > due }; });
}
function ncNext(nc) { return ncSteps(nc).find((x) => !x.done) || null; }
function ncCost(n) { return Number(n.cost) || 0; }
let ncDim = "defect", ncDays = 90, ncMeasure = "n";

function ncCan() { return role().nav.includes("kaizen") || role().nav.includes("resolution"); }
function ncWritable(siteId) { return !role().readonly && allowedSite(siteId, true); }
function ncNorm(s) { return String(s || "").trim().toUpperCase().replace(/\s+/g, ""); }
function ncOrder(no, siteId = null) { const k = ncNorm(no); return (data.orders || []).find((o) => ncNorm(o.no) === k && (!siteId || o.site_id === siteId)) || null; }
function ncRows(days = ncDays) { const from = auAddDays(-(days - 1)); return osScope(data.ncs || []).filter((n) => !n.archived_at && n.date >= from); }
function ncLine(name, siteId) { const k = mdFold(name); return k ? (data.mlLines || []).find((l) => l.site_id === siteId && !l.archived_at && mdFold(l.name) === k) || null : null; }

/* Pareto : tri décroissant, part cumulée, les premiers qui font 80 %. */
function ncPareto(rows, key, measure = "n") {
  const m = new Map();
  rows.forEach((r) => { const k = String(r[key] || "Non renseigné"); m.set(k, (m.get(k) || 0) + (measure === "qty" ? Number(r.qty) || 0 : 1)); });
  const list = [...m.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v || a.label.localeCompare(b.label, "fr")), tot = list.reduce((s, x) => s + x.v, 0);
  let cum = 0; list.forEach((x) => { cum += x.v; x.cum = tot ? cum / tot : 0; });
  const vital = list.findIndex((x) => x.cum >= 0.8) + 1;
  return { list, tot, vital: vital || list.length };
}

/* Ce que la base sait de la commande et de sa fabrication. */
function ncContext(nc) {
  const siteId = nc.site_id, from90 = auAddDays(-89), others = (data.ncs || []).filter((x) => !x.archived_at && x.id !== nc.id && x.site_id === siteId && x.date >= from90);
  const same = { article: nc.article ? others.filter((x) => ncNorm(x.article) === ncNorm(nc.article)) : [], client: nc.client ? others.filter((x) => mdFold(x.client) === mdFold(nc.client)) : [], defectLine: nc.defect && nc.line ? others.filter((x) => x.defect === nc.defect && mdFold(x.line) === mdFold(nc.line)) : [] };
  const problems = nc.article ? (data.problems || []).filter((p) => p.site_id === siteId && !p.archived_at && (p.nc_article && ncNorm(p.nc_article) === ncNorm(nc.article))) : [];
  const line = ncLine(nc.line, siteId), day = nc.prod_date || null, prod = {};
  if (line && day) {
    const sh = (data.trsShifts || []).filter((s) => s.line_id === line.id && s.date === day);
    if (sh.length && typeof tsAgg === "function") { const a = tsAgg(sh); prod.trs = a; prod.teams = sh.map((s) => s.team); prod.stops = sh.flatMap((s) => s.stops || []); prod.scrap = sh.reduce((n, s) => n + (+s.scrap || 0), 0); prod.made = sh.reduce((n, s) => n + (+s.good || 0) + (+s.scrap || 0), 0); }
    const ms = (data.microStops || []).filter((s) => s.line_id === line.id && mlDate(s.at) === day);
    if (ms.length) { const by = ncPareto(ms, "cause"); prod.micro = { n: ms.length, top: by.list.slice(0, 2) }; }
    if (line.machine_id) prod.downs = (data.breakdowns || []).filter((b) => b.machine_id === line.machine_id && !b.archived_at && String(b.start || "").slice(0, 10) === day);
  }
  if (day) prod.signals = (data.signals || []).filter((s) => s.site_id === siteId && String(s.created_at || s.date || "").slice(0, 10) === day && (!nc.line || mdFold(`${s.zone || ""} ${s.description || ""}`).includes(mdFold(nc.line)))).slice(0, 3);
  const pending = nc.article ? (data.orders || []).filter((o) => o.site_id === siteId && ncNorm(o.article) === ncNorm(nc.article) && ncNorm(o.no) !== ncNorm(nc.order_no) && !o.delivered) : [];
  return { same, problems, line, day, prod, pending };
}
function ncAdvice(nc, ctx) {
  const why = [], rec = ctx.same.article.length + (nc.article ? 0 : 0);
  if (nc.origin === "Client") why.push("le client est touché");
  if (nc.severity === "Critique") why.push("gravité critique");
  if (ctx.same.article.length >= 2) why.push(`${ctx.same.article.length + 1}e non-conformité sur cet article en 90 jours`);
  if (ctx.same.defectLine.length >= 2) why.push(`même défaut ${ctx.same.defectLine.length + 1} fois sur la ligne en 90 jours`);
  if (why.length) return { method: "8D", why, rec };
  if (nc.severity === "Majeure" || ctx.same.article.length || ctx.same.defectLine.length) return { method: "QRQC", why: [nc.severity === "Majeure" ? "gravité majeure" : "le défaut s’est déjà produit", "réaction rapide sur la ligne"], rec };
  return { method: "Action", why: ["mineure, première fois : une action corrective suffit"], rec };
}

function ncContextHtml(nc, ctx) {
  const li = [];
  const r = ctx.same;
  li.push(`<li class="${r.article.length ? "warn" : ""}"><b>Récurrence</b> · même article : ${r.article.length} · même client : ${r.client.length} · même défaut sur la ligne : ${r.defectLine.length} <small>(90 jours)</small>${ctx.problems.length ? ` · dossier déjà ouvert : ${ctx.problems.map((p) => `${esc(p.id)} ${esc(p.method)}`).join(", ")}` : ""}</li>`);
  if (ctx.day) {
    const p = ctx.prod, bits = [];
    if (p.trs) bits.push(`TRS ${tsPct(p.trs.trs)} · qualité ${tsPct(p.trs.q)} · ${p.scrap} rebut${p.scrap > 1 ? "s" : ""} sur ${p.made} pièces (${(p.teams || []).join(", ")})`);
    if (p.stops?.length) bits.push(`arrêts : ${p.stops.slice(0, 3).map((s) => `${esc(s.kind)} ${s.min} min${s.note ? ` (${esc(s.note)})` : ""}`).join(", ")}`);
    if (p.micro) bits.push(`${p.micro.n} micro-arrêts, surtout ${p.micro.top.map((x) => `${esc(x.label.toLowerCase())} (${x.v})`).join(", ")}`);
    if (p.downs?.length) bits.push(`${p.downs.length} panne${p.downs.length > 1 ? "s" : ""} TPM : ${p.downs.map((b) => esc(b.cause || b.id)).join(", ")}`);
    if (p.signals?.length) bits.push(`signal${p.signals.length > 1 ? "s" : ""} : ${p.signals.map((s) => esc(String(s.description || s.id).slice(0, 60))).join(" ; ")}`);
    li.push(`<li><b>Fabrication du ${shortDate(ctx.day)}${ctx.line ? ` · ${esc(ctx.line.name)}` : nc.line ? ` · ${esc(nc.line)}` : ""}</b> · ${bits.length ? bits.join(" · ") : ctx.line ? "aucune feuille de poste ni événement enregistré ce jour" : "ligne non suivie dans l’application"}</li>`);
  }
  if (ctx.pending.length) li.push(`<li class="warn"><b>${ctx.pending.length} autre${ctx.pending.length > 1 ? "s" : ""} commande${ctx.pending.length > 1 ? "s" : ""} du même article à vérifier avant livraison</b> · ${ctx.pending.slice(0, 5).map((o) => `${esc(o.no)}${o.client ? ` (${esc(o.client)})` : ""}`).join(", ")}</li>`);
  return `<ul class="nc-ctx">${li.join("")}</ul>`;
}

/* ---------- Page ---------- */

function ncPage() {
  const rows = ncRows(), w = state.site === "group" ? OPERATIONAL_SITES.some((s) => ncWritable(s.id)) : ncWritable(state.site), mgr = w && osManager();
  const head = pageHead("Résoudre", "Non-conformités", "Scannez la commande : l’application retrouve la fabrication, cherche la récurrence et propose le bon traitement, 8D prérempli compris.",
    `<div class="cs-head-tools">${w ? '<button type="button" class="btn" data-nc-new>Déclarer une non-conformité</button>' : ""}${mgr ? '<button type="button" class="btn ghost" data-nc-orders>Commandes</button>' : ""}</div>`);
  const open = rows.filter((n) => n.status !== "Close"), clients = rows.filter((n) => n.origin === "Client").length, qty = rows.reduce((s, n) => s + (+n.qty || 0), 0), eightD = rows.filter((n) => n.decision === "8D").length;
  const claims = rows.filter((n) => n.origin === "Client"), lateC = osScope(data.ncs || []).filter((n) => !n.archived_at && n.status !== "Close" && ncSteps(n).some((x) => x.late)), cost = rows.reduce((s, n) => s + ncCost(n), 0);
  const strip = `<div class="cs-summary"><div><b>${rows.length}</b><span>non-conformités sur ${ncDays} jours</span></div><div class="${clients ? "bad" : ""}"><b>${clients}</b><span>réclamations client</span></div><div><b>${qty.toLocaleString("fr-FR")}</b><span>pièces concernées</span></div><div><b>${open.length}</b><span>ouvertes · ${eightD} en 8D</span></div><div class="${lateC.length ? "bad" : ""}"><b>${lateC.length}</b><span>réponse${lateC.length > 1 ? "s" : ""} client en retard</span></div><div><b>${cost ? `${Math.round(cost).toLocaleString("fr-FR")} €` : "—"}</b><span>coût des réclamations</span></div></div>`;
  const P = ncPareto(rows, ncDim, ncMeasure), max = P.list[0]?.v || 1;
  const dims = `<div class="filters" role="group" aria-label="Classer par">${NC_DIMS.map(([k, l]) => `<button type="button" class="chip ${ncDim === k ? "active" : ""}" data-nc-dim="${k}" aria-pressed="${ncDim === k}">${l}</button>`).join("")}</div><div class="filters" role="group" aria-label="Période et mesure">${[90, 365].map((d) => `<button type="button" class="chip ${ncDays === d ? "active" : ""}" data-nc-days="${d}" aria-pressed="${ncDays === d}">${d === 90 ? "90 jours" : "12 mois"}</button>`).join("")}${[["n", "Nombre"], ["qty", "Pièces"]].map(([k, l]) => `<button type="button" class="chip ${ncMeasure === k ? "active" : ""}" data-nc-meas="${k}" aria-pressed="${ncMeasure === k}">${l}</button>`).join("")}</div>`;
  const pareto = P.list.length ? `<figure class="sm-trend nc-pareto" role="img" aria-label="${esc(P.list.map((x) => `${x.label} ${x.v}`).join(", "))}"><div class="sm-g">${P.list.slice(0, 10).map((x, i) => `<div class="sm-g-row ${i < P.vital ? "nc-vital" : ""}"><span class="sm-g-l">${esc(x.label)}</span><div class="sm-g-track"><div class="sm-g-in"><span class="sm-tbar ${i < P.vital ? "warn" : ""}" style="width:${((x.v / max) * 62).toFixed(1)}%"></span><b class="sm-g-t" style="left:${((x.v / max) * 62).toFixed(1)}%">${x.v.toLocaleString("fr-FR")} · ${Math.round(x.cum * 100)} %</b></div></div></div>`).join("")}</div><figcaption><b>${P.vital} sur ${P.list.length}</b> font 80 % des non-conformités${ncMeasure === "qty" ? " (en pièces)" : ""} : c’est là que commence l’analyse.</figcaption></figure>` : '<p class="hint">Aucune non-conformité sur la période.</p>';
  const list = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30).map((n) => `<button type="button" class="jn-row" data-nc-open="${esc(n.id)}"><span class="jn-row-main"><span class="jn-tag ${n.origin === "Client" ? "tone-open" : n.severity === "Critique" ? "tone-open" : "tone-warn"}">${esc(n.origin)} · ${esc(n.severity)}</span><b>${esc(n.defect)} · ${esc(n.article || "article ?")}${n.client ? ` · ${esc(n.client)}` : ""}</b><span class="hint">${shortDate(n.date)} · commande ${esc(n.order_no || "—")} · ${n.qty || 0} pièce${(n.qty || 0) > 1 ? "s" : ""}${n.problem_id ? ` · ${esc(n.decision)} ${esc(n.problem_id)}` : n.action_id ? ` · action ${esc(n.action_id)}` : ""} · ${esc(n.status || "Ouverte")}${n.status !== "Close" && ncNext(n) ? ` · <span class="${ncNext(n).late ? "nc-late" : ""}">${esc(ncNext(n).label.toLowerCase())} pour le ${shortDate(ncNext(n).due)}${ncNext(n).late ? " (en retard)" : ""}</span>` : ""}</span></span></button>`).join("");
  const noOrders = !(data.orders || []).some((o) => state.site === "group" || o.site_id === state.site);
  return `${head}${noOrders && mgr ? `<p class="ts-warn">Aucune commande dans la base : importez l’extraction de l’ERP (n° de commande, client, article, lot, ligne, date de fabrication) pour que le scan retrouve tout. <button type="button" class="btn small secondary" data-nc-orders>Importer</button></p>` : ""}<section class="section">${strip}</section><section class="section"><div class="section-title"><h2>Pareto automatique</h2></div>${dims}${pareto}</section><section class="section"><div class="section-title"><h2>Les non-conformités</h2></div>${list ? `<div class="jn-rows">${list}</div>` : '<p class="hint">Rien de déclaré sur la période.</p>'}</section>${ncHow()}`;
}

function ncHow() {
  return `<details class="cs-how section"><summary>Du scan au 8D</summary><ol class="cs-how-list"><li><b>Scanner la commande</b><span>Douchette ou caméra : client, article, lot, ligne et date de fabrication sont retrouvés dans la base.</span></li><li><b>Décrire le défaut</b><span>Origine, type de défaut, quantité, gravité, mesure immédiate.</span></li><li><b>L’analyse se fait seule</b><span>Récurrence, production du jour de fabrication, autres commandes du même article à vérifier.</span></li><li><b>Le bon traitement</b><span>8D si le client est touché, si c’est critique ou si cela se répète ; QRQC sinon ; action simple pour une mineure isolée.</span></li><li><b>Un 8D prérempli</b><span>D0 à D4 remplis avec les faits de la base ; l’équipe complète, confirme les causes et agit.</span></li></ol></details>`;
}

/* ---------- Déclaration ---------- */

function ncForm(id = null) {
  const old = id ? (data.ncs || []).find((n) => n.id === id) : null;
  const siteId = old?.site_id || (state.site === "group" ? OPERATIONAL_SITES.find((s) => ncWritable(s.id))?.id : state.site);
  if (!siteId || !ncWritable(siteId)) return toast("Choisissez un site de votre périmètre.");
  const v = old || { origin: "Client", defect: NC_DEFECTS[0], severity: "Majeure", date: today() };
  const chips = (name, list, cur) => `<div class="filters nc-chips" data-nc-group="${name}">${list.map((x) => `<button type="button" class="chip ${x === cur ? "active" : ""}" data-nc-pick="${esc(x)}" aria-pressed="${x === cur}">${esc(x)}</button>`).join("")}</div>`;
  const cam = typeof window.BarcodeDetector === "function" && navigator.mediaDevices?.getUserMedia;
  modal(old ? `${old.id} · Non-conformité` : "Déclarer une non-conformité", `<form id="ncForm" class="jn-form nc-form">
    <div class="nc-scan"><label class="field">N° de commande<input id="ncOrder" value="${esc(v.order_no || "")}" placeholder="Scannez ou tapez le numéro" autocomplete="off" inputmode="text" enterkeyhint="search"></label>${cam ? '<button type="button" class="btn secondary nc-cam" data-nc-cam>Scanner avec la caméra</button>' : ""}</div>
    <div id="ncOrderCard" class="nc-order" aria-live="polite"></div>
    <div class="bp-two"><label class="field">Client<input id="ncClient" value="${esc(v.client || "")}" autocomplete="off"></label><label class="field">Article<input id="ncArticle" value="${esc(v.article || "")}" autocomplete="off"></label></div>
    <div class="ts-three nc-three"><label class="field">Lot<input id="ncLot" value="${esc(v.lot || "")}" autocomplete="off"></label><label class="field">Ligne<input id="ncLine" list="ncLines" value="${esc(v.line || "")}" autocomplete="off"><datalist id="ncLines">${(data.mlLines || []).filter((l) => l.site_id === siteId && !l.archived_at).map((l) => `<option value="${esc(l.name)}">`).join("")}</datalist></label><label class="field">Fabriqué le<input id="ncProd" type="date" max="${today()}" value="${esc(v.prod_date || "")}"></label></div>
    <div class="field"><span class="metric-label">Origine</span>${chips("origin", NC_ORIGINS, v.origin)}</div>
    <fieldset class="ts-fs nc-claim" id="ncClaim"><legend>Réclamation client</legend>
      <div class="bp-two"><label class="field">N° de réclamation du client<input id="ncClaimRef" value="${esc(v.claim_ref || "")}" autocomplete="off"></label><label class="field">Reçue le<input id="ncClaimDate" type="date" max="${today()}" value="${esc(v.claim_date || today())}"></label></div>
      <div class="ts-three nc-three"><label class="field">Pièces retournées<input id="ncRetQty" type="number" inputmode="numeric" min="0" value="${esc(v.returned_qty ?? "")}"></label><label class="field">Reçues le<input id="ncRetAt" type="date" max="${today()}" value="${esc(v.returned_at || "")}"></label><label class="field">Coût estimé (€)<input id="ncCost" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.cost ?? "")}"><small>Retouche, transport, avoir, remplacement</small></label></div>
      <div class="field"><span class="metric-label">Décision sur les pièces</span>${chips("claim_decision", NC_CLAIM_DEC, v.claim_decision || "À décider")}</div>
      <div class="nc-steps" id="ncSteps"></div>
    </fieldset>
    <div class="field"><span class="metric-label">Défaut</span>${chips("defect", NC_DEFECTS, v.defect)}</div>
    <div class="bp-two"><label class="field">Pièces concernées<input id="ncQty" type="number" inputmode="numeric" min="0" value="${esc(v.qty ?? "")}"></label><div class="field"><span class="metric-label">Gravité</span>${chips("severity", NC_SEV, v.severity)}</div></div>
    <label class="field">Ce qui a été constaté<textarea id="ncText" rows="3" maxlength="800" required>${esc(v.text || "")}</textarea></label>
    <label class="field">Mesure immédiate<input id="ncCont" maxlength="200" value="${esc(v.containment || "")}" placeholder="Ex. lot bloqué, tri du stock, client prévenu" autocomplete="off"></label>
    <section class="nc-auto" aria-live="polite"><h3>Analyse automatique</h3><div id="ncAuto"></div></section>
    <div class="form-actions" id="ncActs"></div></form>`);
  const root = $("modalContent"), pick = { origin: v.origin, defect: v.defect, severity: v.severity, claim_decision: v.claim_decision || "À décider" };
  const stepVals = Object.fromEntries(NC_STEPS.map(([k]) => [k, v[k] || ""]));
  root.querySelectorAll("[data-nc-group]").forEach((g) => g.querySelectorAll("[data-nc-pick]").forEach((b) => (b.onclick = () => { pick[g.dataset.ncGroup] = b.dataset.ncPick; g.querySelectorAll("[data-nc-pick]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); live(); })));
  const read = () => ({ site_id: siteId, order_no: $("ncOrder").value.trim(), client: $("ncClient").value.trim(), article: $("ncArticle").value.trim(), lot: $("ncLot").value.trim(), line: $("ncLine").value.trim(), prod_date: $("ncProd").value || null, origin: pick.origin, defect: pick.defect, severity: pick.severity, qty: Number($("ncQty").value) || 0, text: $("ncText").value.trim(), containment: $("ncCont").value.trim(), designation: old?.designation || "", ...(pick.origin === "Client" ? { claim_ref: $("ncClaimRef").value.trim(), claim_date: $("ncClaimDate").value || today(), returned_qty: Number($("ncRetQty").value) || 0, returned_at: $("ncRetAt").value || null, cost: Number($("ncCost").value) || 0, claim_decision: pick.claim_decision, ...Object.fromEntries(NC_STEPS.map(([k]) => [k, root.querySelector(`[data-nc-step="${k}"]`)?.value || stepVals[k] || null])) } : {}) });
  const lookup = () => {
    const o = ncOrder($("ncOrder").value, siteId) || ncOrder($("ncOrder").value);
    if (!$("ncOrder").value.trim()) { $("ncOrderCard").innerHTML = ""; return; }
    if (!o) { $("ncOrderCard").innerHTML = '<p class="hint">Commande inconnue dans la base : complétez les champs à la main.</p>'; return; }
    $("ncOrderCard").innerHTML = `<div class="nc-ocard"><b>${esc(o.no)}</b> · ${esc(o.client || "")} · ${esc(o.article || "")} ${o.designation ? `<small>${esc(o.designation)}</small>` : ""}<span class="hint">${o.quantity ? `${o.quantity} pièces · ` : ""}${o.lot ? `lot ${esc(o.lot)} · ` : ""}${o.line ? `${esc(o.line)} · ` : ""}${o.prod_date ? `fabriqué le ${shortDate(o.prod_date)}` : ""}${o.site_id !== siteId ? ` · site ${esc(getSiteName(o.site_id))}` : ""}</span></div>`;
    [["ncClient", "client"], ["ncArticle", "article"], ["ncLot", "lot"], ["ncLine", "line"], ["ncProd", "prod_date"]].forEach(([fid, k]) => { if (o[k] && !$(fid).value) $(fid).value = o[k]; });
    live();
  };
  const steps = () => {
    $("ncClaim").hidden = pick.origin !== "Client";
    if (pick.origin !== "Client") return;
    const nc = read();
    $("ncSteps").innerHTML = `<span class="metric-label">Réponse au client</span>${ncSteps(nc).map((x) => `<label class="nc-step ${x.late ? "late" : x.done ? (x.lateDone ? "lated" : "done") : ""}"><span><b>${esc(x.label)}</b><small>pour le ${shortDate(x.due)}${x.late ? " · en retard" : x.done ? (x.lateDone ? " · fait en retard" : " · fait") : ""}</small></span><input type="date" data-nc-step="${x.key}" max="${today()}" value="${esc(x.done || "")}" aria-label="${esc(x.label)} : fait le"></label>`).join("")}<small class="hint">Délais usuels d’une réclamation, à ajuster avec chaque client.</small>`;
    $("ncSteps").querySelectorAll("[data-nc-step]").forEach((i) => (i.onchange = () => { stepVals[i.dataset.ncStep] = i.value; steps(); }));
  };
  const live = () => {
    steps();
    const nc = read(), ctx = ncContext({ ...nc, id: old?.id }), adv = ncAdvice(nc, ctx);
    $("ncAuto").innerHTML = `${ncContextHtml(nc, ctx)}<p class="nc-advice"><b>Proposition : ${adv.method === "Action" ? "une action corrective" : adv.method}</b> · ${adv.why.map(esc).join(", ")}.</p>`;
    const done = old?.problem_id || old?.action_id;
    $("ncActs").innerHTML = done ? `<button class="btn jn-big" data-nc-save="">Enregistrer</button>${old.problem_id ? `<button type="button" class="btn secondary" data-nc-goto="${esc(old.problem_id)}">Ouvrir le ${esc(old.decision)}</button>` : ""}${old.problem_id && old.origin === "Client" && typeof mdPrint === "function" ? `<button type="button" class="btn ghost" data-nc-report="${esc(old.problem_id)}">Rapport ${esc(old.decision)} pour le client</button>` : ""}${old.status !== "Close" ? '<button type="button" class="btn ghost" data-nc-close>Clore</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button>`
      : `<button class="btn jn-big" data-nc-save="${adv.method}">${adv.method === "Action" ? "Enregistrer et créer l’action" : `Enregistrer et ouvrir le ${adv.method} prérempli`}</button>${["8D", "QRQC", "Action"].filter((m) => m !== adv.method).map((m) => `<button type="button" class="btn secondary" data-nc-save="${m}">${m === "Action" ? "Plutôt une action" : `Plutôt un ${m}`}</button>`).join("")}<button type="button" class="btn ghost" data-nc-save="">Enregistrer seulement</button>`;
    $("ncActs").querySelectorAll("[data-nc-save]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); ncSave(old, read(), b.dataset.ncSave); }));
    $("ncActs").querySelector("[data-nc-report]")?.addEventListener("click", (e) => { const pid = e.currentTarget.dataset.ncReport; closeModal(); mdPrint(pid); });
    $("ncActs").querySelector("[data-nc-goto]")?.addEventListener("click", (e) => { closeModal(); state.site = old.site_id; state.selectedProblemId = e.currentTarget.dataset.ncGoto; switchView("resolution"); });
    $("ncActs").querySelector("[data-nc-close]")?.addEventListener("click", () => { if (!commitData(() => { const n = data.ncs.find((x) => x.id === old.id); n.status = "Close"; n.closed_at = now(); })) return; modalDirty = false; closeModal(); render(); toast("Non-conformité close."); });
  };
  $("ncOrder").addEventListener("change", lookup);
  $("ncOrder").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); $("ncText").focus(); } });
  $("ncForm").addEventListener("input", (e) => { if (e.target.id !== "ncOrder" && !e.target.dataset.ncStep) live(); });
  $("ncForm").onsubmit = (e) => e.preventDefault();
  root.querySelector("[data-nc-cam]")?.addEventListener("click", () => ncCamera((code) => { $("ncOrder").value = code; lookup(); }));
  if (v.order_no) lookup(); else live();
  if (!old) setTimeout(() => $("ncOrder")?.focus(), 0);
}

function ncCamera(done) {
  const box = document.createElement("div");
  box.className = "nc-camera";
  box.innerHTML = '<video playsinline muted></video><p>Visez le code-barres de la commande</p><button type="button" class="btn secondary">Annuler</button>';
  $("modalContent").appendChild(box);
  const video = box.querySelector("video"); let stream = null, alive = true;
  const stop = () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); box.remove(); };
  box.querySelector("button").onclick = stop;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (s) => {
    stream = s; video.srcObject = s; await video.play();
    const det = new window.BarcodeDetector();
    const tick = async () => { if (!alive) return; try { const r = await det.detect(video); if (r[0]?.rawValue) { stop(); return done(r[0].rawValue.trim()); } } catch { /* image pas encore prête */ } setTimeout(tick, 250); };
    tick();
  }).catch(() => { stop(); toast("Caméra indisponible : utilisez la douchette ou tapez le numéro."); });
}

function ncSave(old, nc, method) {
  if (!nc.text) return toast("Ce qui a été constaté.");
  if (!nc.order_no && !nc.article) return toast("Le n° de commande ou l’article.");
  const ctx = ncContext({ ...nc, id: old?.id });
  let nid = old?.id, pid = null, aid = null, docId = null;
  if (!commitData(() => {
    data.ncs ||= [];
    const o = ncOrder(nc.order_no, nc.site_id) || ncOrder(nc.order_no);
    if (o) { nc.order_no = o.no; if (!nc.designation) nc.designation = o.designation || ""; }
    if (old) Object.assign(data.ncs.find((x) => x.id === old.id), nc, { updated_at: now() });
    else { nid = auNext("NC", data.ncs); data.ncs.unshift({ id: nid, date: today(), status: "Ouverte", by: apMe() || role().label, created_at: now(), updated_at: now(), ...nc }); }
    const row = data.ncs.find((x) => x.id === nid);
    if (method === "8D" || method === "QRQC") {
      const owner = apMe() || "Qualité · à désigner";
      const title = `${nc.origin === "Client" ? "Réclamation" : "Non-conformité"} ${nc.client ? `${nc.client} · ` : ""}${nc.defect.toLowerCase()} · ${nc.article || nc.order_no}`;
      const created = createProblemRecord({ title, site_id: nc.site_id, method, owner, context: nc.text });
      const p = created.problem, d = created.document;
      pid = p.id; docId = d.id;
      p.nc_id = nid; p.nc_article = nc.article || null;
      const P = ncPareto((data.ncs || []).filter((x) => x.site_id === nc.site_id && ncNorm(x.article) === ncNorm(nc.article) && x.date >= auAddDays(-364)), "defect");
      if (nc.article && P.list.length) p.pareto = P.list.map((x) => ({ label: x.label, value: x.v }));
      d.structured_data = { ...d.structured_data, ...ncPrefill(method, row, ctx) };
      row.decision = method; row.problem_id = pid; row.status = "En analyse";
    } else if (method === "Action") {
      aid = auNext("A", data.actions);
      data.actions.unshift({ id: aid, site_id: nc.site_id, title: `Corriger : ${nc.defect.toLowerCase()} · ${nc.article || nc.order_no}`, description: `${nid} · ${nc.text}${nc.containment ? ` · Mesure immédiate : ${nc.containment}` : ""}`, owner: apMe() || "À désigner", due_date: auAddDays(7), due_date_initial: auAddDays(7), priority: nc.severity === "Mineure" ? "Normale" : "Haute", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Qualité", finding: `Non-conformité · ${nc.defect}`, created_at: now(), updated_at: now() });
      row.decision = "Action"; row.action_id = aid; row.status = "En analyse";
    }
  })) return;
  modalDirty = false; closeModal();
  if (pid) { state.site = nc.site_id; state.selectedProblemId = pid; switchView("resolution"); toast(`${nid} enregistrée · ${method} ${pid} ouvert, prérempli avec les données de la base.`); if (docId && typeof editDocument === "function" && !mdIsModel?.(method)) editDocument(docId); }
  else { render(); toast(aid ? `${nid} enregistrée · action ${aid} créée.` : `${nid} enregistrée.`); }
}

/* Le 8D (ou le QRQC) rempli avec ce que la base sait. */
function ncPrefill(method, nc, ctx) {
  const o = ncOrder(nc.order_no, nc.site_id) || ncOrder(nc.order_no), pct = o?.quantity && nc.qty ? ` (${smNum(Math.round((nc.qty / o.quantity) * 1000) / 10)} % de la commande)` : "";
  const p = ctx.prod || {}, facts = [];
  if (p.trs) facts.push(`Feuilles de poste du ${shortDate(ctx.day)} (${(p.teams || []).join(", ")}) : TRS ${tsPct(p.trs.trs)}, qualité ${tsPct(p.trs.q)}, ${p.scrap} rebuts sur ${p.made} pièces.`);
  if (p.stops?.length) facts.push(`Arrêts ce jour-là : ${p.stops.map((s) => `${s.kind} ${s.min} min${s.note ? ` (${s.note})` : ""}`).join(" ; ")}.`);
  if (p.micro) facts.push(`${p.micro.n} micro-arrêts, surtout ${p.micro.top.map((x) => `${x.label.toLowerCase()} (${x.v})`).join(", ")}.`);
  if (p.downs?.length) facts.push(`Pannes TPM : ${p.downs.map((b) => `${b.cause || b.id}`).join(" ; ")}.`);
  if (p.signals?.length) facts.push(`Signaux : ${p.signals.map((s) => String(s.description || s.id)).join(" ; ")}.`);
  const rec = [ctx.same.article.length ? `${ctx.same.article.length} autre(s) non-conformité(s) sur l’article en 90 jours (${ctx.same.article.slice(0, 4).map((x) => `${x.id} ${x.defect.toLowerCase()}`).join(", ")})` : "", ctx.same.defectLine.length ? `même défaut ${ctx.same.defectLine.length} fois sur la ligne en 90 jours` : ""].filter(Boolean).join(" ; ");
  const team = ["Pilote : qualité", nc.line ? `chef d’équipe ${nc.line}` : "chef d’équipe de la ligne", "méthodes", p.downs?.length || p.stops?.some((s) => s.kind === "Panne") ? "maintenance" : "", nc.origin === "Client" ? "commercial (relation client)" : "", nc.origin === "Fournisseur" ? "achats" : ""].filter(Boolean).join(", ");
  const w5 = [`Quoi : ${nc.defect} — ${nc.text}`, `Qui : ${nc.origin === "Client" ? `détecté par le client ${nc.client || ""}` : nc.origin === "Fournisseur" ? "détecté à réception (fournisseur)" : "détecté en interne"}`.trim(), `Où : ${[getSiteName(nc.site_id), nc.line].filter(Boolean).join(", ")}`, `Quand : ${nc.prod_date ? `fabriqué le ${shortDate(nc.prod_date)}${p.teams?.length ? ` (${p.teams.join(", ")})` : ""}, ` : ""}déclaré le ${shortDate(nc.date || today())}`, `Comment : ${nc.origin === "Client" ? "réclamation client" : "constat au poste ou au contrôle"}, commande ${nc.order_no || "—"}${nc.lot ? `, lot ${nc.lot}` : ""}`, `Combien : ${nc.qty || 0} pièce(s)${pct}`, `Pourquoi c’est un problème : ${[nc.origin === "Client" ? "le client est touché" : "", nc.severity === "Critique" ? "gravité critique" : "", rec ? "le défaut se répète" : ""].filter(Boolean).join(", ") || nc.severity.toLowerCase()}`].join("\n");
  const d3 = [nc.containment ? `Fait : ${nc.containment}.` : "À faire sous 24 h :", `Bloquer${nc.lot ? ` le lot ${nc.lot}` : " les lots concernés"} et trier le stock et les en-cours de l’article ${nc.article || ""}.`.replace(/\s+\./, "."), ctx.pending.length ? `Vérifier avant livraison les commandes du même article : ${ctx.pending.slice(0, 8).map((x) => `${x.no}${x.client ? ` (${x.client})` : ""}`).join(", ")}.` : "", nc.origin === "Client" ? "Informer le client des mesures de confinement." : ""].filter(Boolean).join("\n");
  const d4 = [facts.length ? `Pistes tirées des données (à confirmer en équipe) :\n- ${facts.join("\n- ")}` : "Aucune donnée de production enregistrée pour ce jour : rassembler les feuilles de poste et les réglages.", rec ? `Récurrence : ${rec}.` : "", "Analyser avec l’Ishikawa et les 5 pourquoi."].filter(Boolean).join("\n");
  if (method === "QRQC") return { event: `${nc.defect} · ${nc.article || nc.order_no} · ${nc.text}`, containment: d3, facts: `${w5}${facts.length ? `\n${facts.join("\n")}` : ""}`, cause: rec ? `Récurrence : ${rec}.` : "" };
  return { d0: `${nc.origin === "Client" ? "Réclamation client" : "Non-conformité"} ${nc.id} · gravité ${nc.severity.toLowerCase()} · commande ${nc.order_no || "—"}${nc.client ? ` · ${nc.client}` : ""}. ${nc.containment ? `Action réflexe : ${nc.containment}.` : "Action réflexe à décider."}`, d1: `Équipe proposée : ${team}.`, d2: w5, d3, d4_occurrence: d4, d4_escape: `Pourquoi le défaut n’a-t-il pas été détecté avant ${nc.origin === "Client" ? "l’expédition" : "ce stade"} ? Contrôle au poste, fréquence, moyen de mesure, critère d’acceptation à vérifier.` };
}

/* ---------- Commandes : import de l'extraction ERP ---------- */

function ncOrdersForm() {
  const siteId = state.site === "group" ? OPERATIONAL_SITES.find((s) => ncWritable(s.id))?.id : state.site;
  if (!siteId || !osManager()) return;
  const n = (data.orders || []).filter((o) => o.site_id === siteId).length;
  modal(`Commandes · ${getSiteName(siteId)}`, `<form id="ncOrdForm" class="jn-form"><p class="hint">${n} commande${n > 1 ? "s" : ""} dans la base. Collez l’extraction de l’ERP (CSV, séparateur ; ou ,), première ligne = en-têtes :</p>
    <p class="nc-cols"><code>commande;client;article;designation;quantite;ligne;date_fabrication;lot;livraison;livree</code></p>
    <label class="field">Données<textarea id="ncCsv" rows="8" placeholder="CDE-24518;Client A;PAN-1830;Panneau chêne 18 mm;240;Plaqueuse 2;2026-11-03;L4471;2026-11-12;non"></textarea></label>
    <label class="field">Ou un fichier CSV<input id="ncFile" type="file" accept=".csv,text/csv,text/plain"></label>
    <div class="form-actions"><button class="btn jn-big">Importer</button><button type="button" class="btn ghost" data-nc-demo>Charger des commandes d’exemple</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("ncFile").onchange = async () => { const f = $("ncFile").files[0]; if (f) $("ncCsv").value = await f.text(); };
  $("modalContent").querySelector("[data-nc-demo]").onclick = () => {
    const d = (k) => auAddDays(-k), lines = (data.mlLines || []).filter((l) => l.site_id === siteId).map((l) => l.name);
    const L = lines[0] || "Plaqueuse 2";
    $("ncCsv").value = ["commande;client;article;designation;quantite;ligne;date_fabrication;lot;livraison;livree", `CDE-24501;Client A (fictif);PAN-1830;Panneau chêne 18 mm;240;${L};${d(6)};L4460;${d(-2)};oui`, `CDE-24512;Client B (fictif);PAN-1830;Panneau chêne 18 mm;120;${L};${d(3)};L4468;${d(-6)};non`, `CDE-24518;Client A (fictif);PAN-2210;Panneau noyer 22 mm;80;${L};${d(2)};L4471;${d(-8)};non`, `CDE-24520;Client C (fictif);PAN-1830;Panneau chêne 18 mm;300;${L};${d(1)};L4475;${d(-10)};non`, `CDE-24523;Client B (fictif);CHT-0950;Chant hêtre 1 mm;1500;Encolleuse;${d(1)};L4476;${d(-5)};non`].join("\n");
  };
  $("ncOrdForm").onsubmit = (e) => {
    e.preventDefault();
    const lines = $("ncCsv").value.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast("Les en-têtes et au moins une commande.");
    const sep = lines[0].includes(";") ? ";" : ",", head = lines[0].split(sep).map((h) => mdFold(h).trim().replace(/[\s\-.°]+/g, "_").replace(/[^a-z_]/g, ""));
    const col = (names) => head.findIndex((h) => names.includes(h));
    const ix = { no: col(["commande", "no", "numero", "n_commande", "of"]), client: col(["client"]), article: col(["article", "reference", "ref"]), designation: col(["designation", "libelle"]), quantity: col(["quantite", "qte", "quantity"]), line: col(["ligne", "poste", "machine"]), prod_date: col(["date_fabrication", "fabrication", "date_fab", "date"]), lot: col(["lot"]), due_date: col(["livraison", "date_livraison"]), delivered: col(["livree", "livre", "expediee"]) };
    if (ix.no < 0) return toast("Il faut une colonne « commande ».");
    const iso = (s) => { s = String(s || "").trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
    const rows = lines.slice(1).map((l) => l.split(sep)).map((c) => { const g = (k) => (ix[k] >= 0 ? String(c[ix[k]] ?? "").trim() : ""); return { no: g("no"), site_id: siteId, client: g("client"), article: g("article"), designation: g("designation"), quantity: Number(g("quantity").replace(",", ".")) || null, line: g("line"), prod_date: iso(g("prod_date")), lot: g("lot"), due_date: iso(g("due_date")), delivered: /^(oui|o|1|x|yes|true)$/i.test(g("delivered")) }; }).filter((r) => r.no);
    let added = 0, upd = 0;
    if (!commitData(() => { data.orders ||= []; rows.forEach((r) => { const o = data.orders.find((x) => x.site_id === siteId && ncNorm(x.no) === ncNorm(r.no)); if (o) { Object.assign(o, r, { updated_at: now() }); upd++; } else { data.orders.push({ ...r, created_at: now(), updated_at: now() }); added++; } }); })) return;
    modalDirty = false; closeModal(); render(); toast(`${added} commande${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}, ${upd} mise${upd > 1 ? "s" : ""} à jour.`);
  };
}

/* ---------- Branchements : Résoudre › Non-conformités ---------- */

state.ncOn ??= false;
const ncKaizenBase = renderOSKaizen;
renderOSKaizen = function () { if (state.ncOn && ncCan()) return ncPage(); return ncKaizenBase.apply(this, arguments); };
const ncSwitchBase = switchView;
switchView = function (view) { if (view !== "kaizen") state.ncOn = false; return ncSwitchBase.apply(this, arguments); };
const ncTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = ncTabsBase(stage);
  if (stage?.id !== "resoudre" || !ncCan() || out.some((t) => t.key === "nc")) return out;
  const k = out.findIndex((t) => t.view === "kaizen");
  if (k < 0) return out;
  out[k] = { ...out[k], set: { ...(out[k].set || {}), ncOn: false } };
  out.unshift({ key: "nc", label: "Non-conformités", view: "kaizen", set: { ncOn: true } });
  return out;
};
const ncCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  ncCreateMenuBase.apply(this, arguments);
  if (!ncCan() || role().readonly) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  menu.insertAdjacentHTML("afterbegin", '<button class="create-choice nc-choice" type="button" data-nc-new><span aria-hidden="true"><b>NC</b></span><b>Non-conformité</b><small>Scanner la commande : analyse et 8D préremplis</small></button>');
  menu.querySelector("[data-nc-new]").onclick = () => { closeModal(); ncForm(); };
};
function ncBind(root = document) {
  root.querySelectorAll("[data-nc-new]").forEach((b) => (b.onclick = () => ncForm()));
  root.querySelectorAll("[data-nc-open]").forEach((b) => (b.onclick = () => ncForm(b.dataset.ncOpen)));
  root.querySelectorAll("[data-nc-orders]").forEach((b) => (b.onclick = ncOrdersForm));
  root.querySelectorAll("[data-nc-dim]").forEach((b) => (b.onclick = () => { ncDim = b.dataset.ncDim; render(); }));
  root.querySelectorAll("[data-nc-days]").forEach((b) => (b.onclick = () => { ncDays = Number(b.dataset.ncDays) || 90; render(); }));
  root.querySelectorAll("[data-nc-meas]").forEach((b) => (b.onclick = () => { ncMeasure = b.dataset.ncMeas; render(); }));
}
const ncWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = ncWatchBase();
  if (!ncCan() || role().readonly) return base;
  const late = osScope(data.ncs || []).filter((n) => !n.archived_at && n.status !== "Close" && ncNext(n)?.late).slice(0, 3);
  if (!late.length) return base;
  const rows = late.map((n) => `<button type="button" class="jn-row" data-nc-open="${esc(n.id)}"><span class="jn-row-main"><span class="jn-tag tone-open">Réclamation</span><b>${esc(n.client || "Client")} · ${esc(ncNext(n).label.toLowerCase())}</b><span class="hint">${esc(n.id)}${n.claim_ref ? ` · réf. ${esc(n.claim_ref)}` : ""} · attendu le ${shortDate(ncNext(n).due)}</span></span></button>`).join("");
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows}`);
};
const ncOsBindBase = osBind;
osBind = function () { const out = ncOsBindBase.apply(this, arguments); ncBind(document); return out; };
