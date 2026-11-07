"use strict";
/*
 * BIA Lean OS 8.36 · Le TRS du poste (Observer › TRS) : la feuille de poste saisie, le TRS calculé, envoyé au pilotage.
 *  - Feuille de poste par ligne, par jour et par équipe, comme la feuille papier : durée du poste, arrêts planifiés,
 *    arrêts (pannes, changements de série, réglages, manques…), micro-arrêts (nombre de bâtons ou minutes),
 *    pièces bonnes et rebuts, cadence théorique. Reprise des pannes déclarées en TPM et des micro-arrêts comptés au poste.
 *  - Calcul selon la NF E60-182 : temps requis = durée du poste − arrêts planifiés ; temps de fonctionnement = requis − arrêts ;
 *    temps net = pièces produites × temps de cycle théorique ; temps utile = pièces bonnes × temps de cycle.
 *    Disponibilité = fonctionnement / requis, performance = net / fonctionnement, qualité = bonnes / produites,
 *    TRS = utile / requis = D × P × Q. La perte de performance se partage entre micro-arrêts et écart de cadence.
 *  - Le TRS du site, jour par jour (temps utiles ÷ temps requis de toutes ses lignes), devient le relevé TRS du pilotage
 *    (source « Feuilles de poste ») ; un relevé venu d'une autre source (SEQUOIA, import) n'est jamais écrasé.
 *  - Où part le temps : temps requis → arrêts → micro-arrêts → écart de cadence → non-qualité → temps utile.
 * Données : trsShifts[] { id, line_id, site_id, workshop_id, date, team, shift_min, planned_min, stops[{ kind, min, note }],
 *           micro_n, micro_min, good, scrap, rate_ph, by } (non indexée). mlLines[] porte en plus rate_ph et shift_min.
 */

const TS_TEAMS = ["Matin", "Après-midi", "Nuit", "Journée"];
const TS_KINDS = ["Panne", "Changement de série", "Réglage", "Manque matière", "Manque personnel", "Attente qualité", "Autre"];
const TS_SOURCE = "Feuilles de poste";
let tsDays = 7;

function tsShifts(lineId, days = 7) { const from = mlFrom(days); return (data.trsShifts || []).filter((s) => s.line_id === lineId && s.date >= from && s.date <= today()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || TS_TEAMS.indexOf(a.team) - TS_TEAMS.indexOf(b.team)); }
function tsPct(x) { return x === null || !Number.isFinite(x) ? "—" : `${smNum(x * 100)} %`; }
function tsCalc(s) {
  const to = +s.shift_min || 0, tr = Math.max(0, to - (+s.planned_min || 0)), stops = (s.stops || []).reduce((n, x) => n + (+x.min || 0), 0);
  const tf = Math.max(0, tr - stops), rate = +s.rate_ph || 0, good = +s.good || 0, scrap = +s.scrap || 0, made = good + scrap;
  const cyc = rate > 0 ? 60 / rate : null; // minutes par pièce
  const tn = cyc ? made * cyc : null, tu = cyc ? good * cyc : null, micro = +s.micro_min || 0;
  const d = tr ? tf / tr : null, p = tf && tn !== null ? tn / tf : null, q = made ? good / made : null, trs = tr && tu !== null ? tu / tr : null;
  const warn = [];
  if (!rate) warn.push("Cadence théorique manquante : le TRS ne peut pas être calculé.");
  if (p !== null && p > 1.02) warn.push("Plus de pièces que la cadence théorique ne le permet : vérifiez la cadence, les quantités ou les arrêts.");
  if (tn !== null && micro > tf - tn + 0.5 && p !== null && p <= 1.02) warn.push("Les micro-arrêts dépassent la perte de performance : vérifiez leur durée.");
  if (stops > tr) warn.push("Les arrêts dépassent le temps requis.");
  return { to, tr, stops, tf, tn, tu, micro, speed: tn === null ? null : Math.max(0, tf - tn - micro), quality: tn === null || tu === null ? null : tn - tu, d, p, q, trs, made, warn };
}
function tsAgg(shifts) {
  const c = shifts.map(tsCalc).filter((x) => x.tu !== null && x.tr > 0);
  if (!c.length) return null;
  const sum = (k) => c.reduce((n, x) => n + (x[k] || 0), 0), tr = sum("tr"), tf = sum("tf"), tn = sum("tn"), tu = sum("tu");
  return { n: c.length, tr, stops: sum("stops"), micro: sum("micro"), speed: sum("speed"), quality: sum("quality"), tf, tn, tu, d: tf / tr, p: tf ? tn / tf : null, q: tn ? tu / tn : null, trs: tu / tr };
}
function tsSiteDay(siteId, date) {
  const ids = new Set((data.mlLines || []).filter((l) => l.site_id === siteId).map((l) => l.id));
  return tsAgg((data.trsShifts || []).filter((s) => ids.has(s.line_id) && s.date === date));
}
/* Le relevé TRS du site pour ce jour, dans le pilotage. Un relevé d'une autre source n'est pas touché. */
function tsPushSite(siteId, date) {
  const k = typeof osKpi === "function" ? osKpi("trs") : null;
  if (!k) return null;
  const a = tsSiteDay(siteId, date), old = (data.measures || []).find((m) => m.site_id === siteId && (m.kpi_id === k.id || m.code === k.code) && !m.workshop_id && m.period === date && !m.archived_at);
  if (old && old.source !== TS_SOURCE) return "kept";
  if (!a) { if (old) data.measures = data.measures.filter((m) => m !== old); return null; }
  const prev = osLatest(siteId, k.id, date), target = old?.target ?? prev?.target ?? k.target ?? null;
  const lines = [...new Set((data.trsShifts || []).filter((s) => s.site_id === siteId && s.date === date).map((s) => mlLine(s.line_id)?.name).filter(Boolean))];
  const res = osValidateMeasurements([{ site_id: siteId, kpi_id: k.id, period: date, value: Math.round(Math.min(100, a.trs * 100) * 10) / 10, target, definition: `Temps utile / temps requis (NF E60-182), ${a.n} feuille${a.n > 1 ? "s" : ""} de poste : ${lines.join(", ")}`, source: TS_SOURCE }], "manual");
  if (!res.accepted.length) return null;
  const m = res.accepted[0];
  if (old) Object.assign(old, m, { id: old.id }); else data.measures.push(m);
  return "sent";
}

/* ---------- Section TRS de la page ---------- */

function tsSection(l) {
  const w = mlWritable(l.site_id), sh = tsShifts(l.id, tsDays), a = tsAgg(sh), k = typeof osKpi === "function" ? osKpi("trs") : null, target = k?.target ?? null;
  const per = `<div class="filters ml-period" role="group" aria-label="Période du TRS">${[7, 30].map((d) => `<button type="button" class="chip ${tsDays === d ? "active" : ""}" data-ts-days="${d}" aria-pressed="${tsDays === d}">${d} jours</button>`).join("")}</div>`;
  const add = w ? `<button type="button" class="btn ts-new" data-ts-new>Saisir une feuille de poste</button>` : "";
  if (!a) return `<section class="section ts-box"><div class="section-title"><div><h2>TRS de la ligne</h2><p class="hint">À partir des feuilles de poste : durée, arrêts, micro-arrêts, pièces bonnes et rebuts.</p></div>${per}</div>${!(+l.rate_ph) ? `<p class="ts-warn">Indiquez la cadence théorique de la ligne (pièces par heure) pour calculer le TRS.${mlManager(l.site_id) ? ` <button type="button" class="btn small secondary" data-ml-edit="${esc(l.id)}">Modifier la ligne</button>` : ""}</p>` : ""}${add}<p class="hint">Aucune feuille de poste sur ${tsDays} jours.</p></section>`;
  const bad = target !== null && a.trs * 100 < target;
  const big = `<div class="ts-head"><div class="ts-trs ${bad ? "bad" : "ok"}"><b>${tsPct(a.trs)}</b><span>TRS · ${a.n} poste${a.n > 1 ? "s" : ""}${target !== null ? ` · cible ${smNum(target)} %` : ""}</span></div><div class="ts-dpq"><span><small>Disponibilité</small><b>${tsPct(a.d)}</b></span><span class="ts-x">×</span><span><small>Performance</small><b>${tsPct(a.p)}</b></span><span class="ts-x">×</span><span><small>Qualité</small><b>${tsPct(a.q)}</b></span></div></div>`;
  const parts = [["ts-u", "Temps utile", a.tu], ["ts-s", "Arrêts", a.stops], ["ts-m", "Micro-arrêts", a.micro], ["ts-c", "Écart de cadence", a.speed], ["ts-q", "Non-qualité", a.quality]].filter((x) => x[2] > 0.05);
  const total = parts.reduce((n, x) => n + x[2], 0) || 1, worst = parts.slice(1).sort((x, y) => y[2] - x[2])[0];
  const bar = `<figure class="ts-where"><figcaption><b>Où part le temps requis</b> · ${mlFmt(a.tr)} sur ${tsDays} jours${worst ? ` · première perte : ${esc(worst[1].toLowerCase())}` : ""}</figcaption><div class="ts-bar" role="img" aria-label="${esc(parts.map((x) => `${x[1]} ${mlFmt(x[2])}`).join(", "))}">${parts.map((x) => `<span class="${x[0]}" style="width:${((x[2] / total) * 100).toFixed(2)}%"></span>`).join("")}</div><ul class="ts-legend">${parts.map((x) => `<li><i class="${x[0]}"></i>${esc(x[1])} <b>${mlFmt(x[2])}</b> <small>${Math.round((x[2] / total) * 100)} %</small></li>`).join("")}</ul></figure>`;
  const row = (s) => { const c = tsCalc(s); return `<button type="button" class="jn-row ts-row" data-ts-open="${esc(s.id)}"><span class="jn-row-main"><b>${shortDate(s.date)} · ${esc(s.team)}</b><span class="hint">D ${tsPct(c.d)} · P ${tsPct(c.p)} · Q ${tsPct(c.q)} · ${c.made} pièces${c.warn.length ? " · à vérifier" : ""}</span></span><span class="ts-rowv ${target !== null && c.trs !== null && c.trs * 100 < target ? "bad" : ""}">${tsPct(c.trs)}</span></button>`; };
  return `<section class="section ts-box"><div class="section-title"><h2>TRS de la ligne</h2>${per}</div>${big}${bar}${add}<div class="jn-rows ts-rows">${sh.slice(0, 4).map(row).join("")}</div>${sh.length > 4 ? `<details class="ts-more"><summary>Toutes les feuilles · ${sh.length}</summary><div class="jn-rows ts-rows">${sh.slice(4, 60).map(row).join("")}</div></details>` : ""}<p class="hint">Le TRS du site, jour par jour, part dans le pilotage (source « ${TS_SOURCE} ») ; un relevé SEQUOIA ou importé du même jour est conservé.</p></section>`;
}

/* ---------- Feuille de poste ---------- */

function tsForm(lineId, id = null) {
  const l = mlLine(lineId), old = id ? (data.trsShifts || []).find((s) => s.id === id) : null;
  if (!l || !mlWritable(l.site_id)) return toast("Cette ligne n’est pas dans votre périmètre d’écriture.");
  const hour = new Date().getHours(), team0 = old?.team || (hour < 13 ? "Matin" : hour < 21 ? "Après-midi" : "Nuit");
  let stops = (old?.stops || []).map((x) => ({ ...x }));
  const st = (x, i) => `<div class="ts-stop" data-ts-i="${i}"><select data-ts-k aria-label="Nature de l’arrêt">${TS_KINDS.map((k) => `<option ${k === x.kind ? "selected" : ""}>${esc(k)}</option>`).join("")}</select><input data-ts-min type="number" inputmode="decimal" min="0" max="1440" step="1" value="${esc(x.min ?? "")}" placeholder="min" aria-label="Minutes"><input data-ts-note value="${esc(x.note || "")}" placeholder="Détail" aria-label="Détail" autocomplete="off"><button type="button" class="btn ghost small" data-ts-del aria-label="Retirer l’arrêt">×</button></div>`;
  modal(old ? `Feuille de poste · ${l.name} · ${shortDate(old.date)}` : `Feuille de poste · ${l.name}`, `<form id="tsForm" class="jn-form ts-form">
    <div class="bp-two"><label class="field">Date<input id="tsDate" type="date" max="${today()}" value="${esc(old?.date || today())}" required></label><div class="field"><span class="metric-label">Équipe</span><div class="filters ts-teams">${TS_TEAMS.map((t) => `<button type="button" class="chip ${t === team0 ? "active" : ""}" data-ts-team="${esc(t)}" aria-pressed="${t === team0}">${esc(t)}</button>`).join("")}</div></div></div>
    <fieldset class="ts-fs"><legend>Temps</legend><div class="bp-two"><label class="field">Durée du poste (min)<input id="tsShift" type="number" inputmode="numeric" min="1" max="1440" value="${esc(old?.shift_min ?? l.shift_min ?? 480)}" required></label><label class="field">Arrêts planifiés (min)<input id="tsPlanned" type="number" inputmode="numeric" min="0" max="1440" value="${esc(old?.planned_min ?? 0)}"><small>Pauses, TOP 5, nettoyage prévu, pas de charge</small></label></div></fieldset>
    <fieldset class="ts-fs"><legend>Arrêts de plus de ${smNum(+l.threshold_min || 5)} min</legend><div id="tsStops">${stops.map(st).join("")}</div><div class="row-actions"><button type="button" class="btn secondary small" data-ts-add>+ Un arrêt</button>${l.machine_id ? '<button type="button" class="btn ghost small" data-ts-tpm>Reprendre les pannes TPM du jour</button>' : ""}</div></fieldset>
    <fieldset class="ts-fs"><legend>Micro-arrêts</legend><div class="bp-two"><label class="field">Nombre (bâtons)<input id="tsMicroN" type="number" inputmode="numeric" min="0" max="5000" value="${esc(old?.micro_n ?? "")}"></label><label class="field">Minutes perdues<input id="tsMicroMin" type="number" inputmode="decimal" min="0" max="1440" step="0.5" value="${esc(old?.micro_min ?? "")}"><small>Par défaut : nombre × ${smNum(+l.typical_min || 1)} min</small></label></div><p class="hint" id="tsMicroHint"></p></fieldset>
    <fieldset class="ts-fs"><legend>Production</legend><div class="ts-three"><label class="field">Pièces bonnes<input id="tsGood" type="number" inputmode="numeric" min="0" max="1000000" value="${esc(old?.good ?? "")}" required></label><label class="field">Rebuts, retouches<input id="tsScrap" type="number" inputmode="numeric" min="0" max="1000000" value="${esc(old?.scrap ?? 0)}"></label><label class="field">Cadence théorique (pièces/h)<input id="tsRate" type="number" inputmode="decimal" min="0.1" max="100000" step="0.1" value="${esc(old?.rate_ph ?? l.rate_ph ?? "")}" required></label></div></fieldset>
    <div class="ts-live" id="tsLive" aria-live="polite"></div>
    <div class="form-actions"><button class="btn jn-big">${old ? "Enregistrer" : "Enregistrer la feuille"}</button>${old ? '<button type="button" class="btn ghost" data-ts-remove>Supprimer</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  let team = team0, microTouched = old?.micro_min != null && old?.micro_min !== "";
  const read = () => {
    root.querySelectorAll(".ts-stop").forEach((r) => { const i = +r.dataset.tsI; stops[i] = { kind: r.querySelector("[data-ts-k]").value, min: r.querySelector("[data-ts-min]").value === "" ? null : Number(r.querySelector("[data-ts-min]").value), note: r.querySelector("[data-ts-note]").value.trim() }; });
    const n = $("tsMicroN").value === "" ? null : Number($("tsMicroN").value);
    let mm = $("tsMicroMin").value === "" ? null : Number($("tsMicroMin").value);
    if (!microTouched && n !== null) { mm = Math.round(n * (+l.typical_min || 1) * 10) / 10; $("tsMicroMin").value = String(mm); }
    return { line_id: l.id, site_id: l.site_id, workshop_id: l.workshop_id || null, date: $("tsDate").value, team, shift_min: Number($("tsShift").value), planned_min: Number($("tsPlanned").value) || 0, stops: stops.filter((x) => x && +x.min > 0), micro_n: n, micro_min: mm || 0, good: Number($("tsGood").value) || 0, scrap: Number($("tsScrap").value) || 0, rate_ph: Number($("tsRate").value) || 0 };
  };
  const live = () => {
    const s = read(), c = tsCalc(s);
    const counted = mlStops(l.id, 400).filter((x) => mlDate(x.at) === s.date);
    $("tsMicroHint").innerHTML = counted.length ? `Comptés au poste ce jour : <b>${counted.length}</b> · ${mlFmt(counted.reduce((n, x) => n + mlMin(x, l), 0))} <button type="button" class="btn ghost small" data-ts-usecount>Reprendre</button>` : "";
    $("tsMicroHint").querySelector("[data-ts-usecount]")?.addEventListener("click", () => { $("tsMicroN").value = String(counted.length); $("tsMicroMin").value = String(Math.round(counted.reduce((n, x) => n + mlMin(x, l), 0) * 10) / 10); microTouched = true; live(); });
    $("tsLive").innerHTML = `<div class="ts-dpq"><span><small>Disponibilité</small><b>${tsPct(c.d)}</b></span><span class="ts-x">×</span><span><small>Performance</small><b>${tsPct(c.p)}</b></span><span class="ts-x">×</span><span><small>Qualité</small><b>${tsPct(c.q)}</b></span><span class="ts-x">=</span><span class="ts-res"><small>TRS</small><b>${tsPct(c.trs)}</b></span></div><p class="hint">Requis ${mlFmt(c.tr)} · arrêts ${mlFmt(c.stops)} · micro-arrêts ${mlFmt(c.micro)}${c.speed !== null ? ` · écart de cadence ${mlFmt(c.speed)}` : ""}${c.quality !== null ? ` · non-qualité ${mlFmt(c.quality)}` : ""}</p>${c.warn.map((x) => `<p class="ts-warn">${esc(x)}</p>`).join("")}`;
  };
  const redraw = () => { read(); $("tsStops").innerHTML = stops.map(st).join(""); bindStops(); live(); };
  const bindStops = () => root.querySelectorAll("[data-ts-del]").forEach((b) => (b.onclick = () => { read(); stops.splice(+b.closest(".ts-stop").dataset.tsI, 1); $("tsStops").innerHTML = stops.map(st).join(""); bindStops(); live(); }));
  bindStops();
  root.querySelectorAll("[data-ts-team]").forEach((b) => (b.onclick = () => { team = b.dataset.tsTeam; root.querySelectorAll("[data-ts-team]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); live(); }));
  root.querySelector("[data-ts-add]").onclick = () => { read(); stops.push({ kind: "Panne", min: null, note: "" }); $("tsStops").innerHTML = stops.map(st).join(""); bindStops(); root.querySelector(".ts-stop:last-child [data-ts-min]")?.focus(); live(); };
  root.querySelector("[data-ts-tpm]")?.addEventListener("click", () => {
    const date = $("tsDate").value, downs = (data.breakdowns || []).filter((b) => b.machine_id === l.machine_id && !b.archived_at && b.end && mlDate(b.start) === date);
    if (!downs.length) return toast("Aucune panne terminée déclarée en TPM ce jour sur cette machine.");
    read();
    downs.forEach((b) => { if (!stops.some((x) => x.ref === b.id)) stops.push({ kind: "Panne", min: Math.round((Date.parse(b.end) - Date.parse(b.start)) / 6e4), note: b.cause || b.id, ref: b.id }); });
    $("tsStops").innerHTML = stops.map(st).join(""); bindStops(); live();
  });
  $("tsMicroMin").addEventListener("input", () => { microTouched = $("tsMicroMin").value !== ""; });
  root.querySelector("#tsForm").addEventListener("input", live);
  root.querySelector("#tsForm").addEventListener("change", live);
  live();
  root.querySelector("[data-ts-remove]")?.addEventListener("click", () => {
    if (!commitData(() => { data.trsShifts = data.trsShifts.filter((s) => s.id !== old.id); tsPushSite(old.site_id, old.date); })) return;
    modalDirty = false; closeModal(); render(); toast("Feuille de poste supprimée ; le TRS du site est recalculé.");
  });
  $("tsForm").onsubmit = (e) => {
    e.preventDefault();
    const s = read(), c = tsCalc(s);
    if (!s.date || s.date > today()) return toast("La date du poste.");
    if (!(s.shift_min > 0)) return toast("La durée du poste.");
    if (!(s.rate_ph > 0)) { $("tsRate").focus(); return toast("La cadence théorique, en pièces par heure."); }
    if (!(s.good + s.scrap > 0)) { $("tsGood").focus(); return toast("Les pièces produites."); }
    if (c.stops > c.tr) return toast("Les arrêts dépassent le temps requis : vérifiez les minutes.");
    const dup = (data.trsShifts || []).find((x) => x.line_id === l.id && x.date === s.date && x.team === s.team && x.id !== old?.id);
    if (dup) return toast(`Une feuille ${s.team.toLowerCase()} existe déjà ce jour : ouvrez-la pour la corriger.`);
    let pushed = null;
    if (!commitData(() => {
      data.trsShifts ||= [];
      if (old) { Object.assign(data.trsShifts.find((x) => x.id === old.id), s, { updated_at: now() }); if (old.date !== s.date) tsPushSite(old.site_id, old.date); }
      else data.trsShifts.unshift({ id: auNext("FP", data.trsShifts), by: apMe() || role().label, created_at: now(), updated_at: now(), ...s });
      if (!(+l.rate_ph)) { const x = data.mlLines.find((k) => k.id === l.id); x.rate_ph = s.rate_ph; }
      pushed = tsPushSite(l.site_id, s.date);
    })) return;
    modalDirty = false; closeModal(); render();
    const day = tsSiteDay(l.site_id, s.date);
    toast(`TRS du poste : ${tsPct(c.trs)}${pushed === "sent" && day ? ` · TRS du site ce jour : ${tsPct(day.trs)}, envoyé au pilotage` : pushed === "kept" ? " · le relevé du pilotage de ce jour vient d’une autre source : conservé" : ""}.`);
  };
}

function tsBind(root = document) {
  root.querySelectorAll("[data-ts-new]").forEach((b) => (b.onclick = () => { const l = mlCur(); if (l) tsForm(l.id); }));
  root.querySelectorAll("[data-ts-open]").forEach((b) => (b.onclick = () => { const s = (data.trsShifts || []).find((x) => x.id === b.dataset.tsOpen); if (s) tsForm(s.line_id, s.id); }));
  root.querySelectorAll("[data-ts-days]").forEach((b) => (b.onclick = () => { tsDays = Number(b.dataset.tsDays) || 7; render(); }));
}
const tsOsBindBase = osBind;
osBind = function () { const out = tsOsBindBase.apply(this, arguments); tsBind(document); return out; };
