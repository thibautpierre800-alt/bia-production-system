"use strict";
/*
 * BIA Lean OS 8.19 · SQCDP au quotidien : le point du jour, les lettres, la présence et les escalades.
 *  - « Le point du jour » en tête de Voir › SQCDP : pour chaque lettre, journée bonne (vert) ou écart (rouge) en un geste ;
 *    un écart demande ce qui s'est passé et devient un sujet du TOP 15.
 *  - Les calendriers des lettres S, Q, C, D, P du mois, comme au tableau de l'atelier ; chaque jour se corrige d'un geste.
 *    Version à afficher (A4 paysage).
 *  - Le point se démarre et se clôt : durée, présents, sujets vus et escalades sont enregistrés ;
 *    tenue du rituel du mois (points tenus, durée moyenne, présence).
 *  - Escalades en attente de réponse avec leur âge ; « Répondu » les clôt avec la réponse ; délai moyen de réaction.
 * Données : sqcdpDays[] { id, site_id, workshop_id, date, axis, status: "ok"|"ko", note, topic_id, by } et
 * meetings[] { id, site_id, workshop_id, date, started_at, ended_at, duration_s, present[], topics, escalated } (non indexées).
 */

const SJ_AXES = ["S", "Q", "C", "D", "P"];
const SJ_HINT = { S: "Accident, presque-accident, situation dangereuse ?", Q: "Défaut client, rebut, retouche ?", C: "Panne, arrêt, perte de TRS ?", D: "Retard, rupture, planning non tenu ?", P: "Absence non remplacée, tension, formation ?" };
let sjMonth = null;

function sjCan() { return role().nav.includes("sqcdp"); }
function sjWritable() { return state.site !== "group" && !role().readonly && allowedSite(state.site, true); }
function sjWs() { return state.workshop || null; }
function sjDays(site = state.site, ws = sjWs()) { return (data.sqcdpDays || []).filter((d) => d.site_id === site && (d.workshop_id || null) === ws); }
function sjGet(date, axis) { return sjDays().find((d) => d.date === date && d.axis === axis) || null; }
function sjMonthKey() { return sjMonth || today().slice(0, 7); }
function sjMonthLabel(key) { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 15).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
function sjShift(key, n) { const [y, m] = key.split("-").map(Number), d = new Date(y, m - 1 + n, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function sjMeetings(monthKey = today().slice(0, 7)) { return (data.meetings || []).filter((m) => m.site_id === state.site && (m.workshop_id || null) === sjWs() && String(m.date).startsWith(monthKey)); }
function sjSet(date, axis, status, note = "") {
  let topicId = null;
  const ok = commitData(() => {
    data.sqcdpDays ||= [];
    let row = data.sqcdpDays.find((d) => d.site_id === state.site && (d.workshop_id || null) === sjWs() && d.date === date && d.axis === axis);
    if (!status) { data.sqcdpDays = data.sqcdpDays.filter((d) => d !== row); return; }
    if (!row) { row = { id: uid("SJ"), site_id: state.site, workshop_id: sjWs(), date, axis, created_at: now() }; data.sqcdpDays.push(row); }
    Object.assign(row, { status, note, by: apMe() || role().label, updated_at: now() });
    if (status === "ko" && note && !row.topic_id) {
      topicId = nextId("TOP", data.topics);
      data.topics.unshift({ id: topicId, site_id: state.site, workshop_id: sjWs(), title: note, axis, owner: apMe() || "À désigner", due_date: today(), priority: axis === "S" ? "Haute" : "Normale", linked_id: null, status: "Ouvert", decision: "", source: "SQCDP", created_at: now(), updated_at: now() });
      row.topic_id = topicId;
    }
  });
  if (ok) modalDirty = false;
  return ok ? { topicId } : null;
}

/* ---------- Lettres du mois ---------- */

function sjLetter(axis, key, { big = false } = {}) {
  const [y, m] = key.split("-").map(Number), n = new Date(y, m, 0).getDate(), first = (new Date(y, m - 1, 1).getDay() + 6) % 7, rows = sjDays();
  const cells = [...Array(first).fill('<span class="sj-day pad"></span>'), ...Array.from({ length: n }, (_, i) => {
    const date = `${key}-${String(i + 1).padStart(2, "0")}`, d = rows.find((r) => r.date === date && r.axis === axis), future = date > today(), wd = (first + i) % 7 >= 5;
    const cls = d ? (d.status === "ok" ? "ok" : "ko") : future ? "future" : wd ? "we" : "none";
    return big ? `<span class="sj-day ${cls} ${date === today() ? "today" : ""}">${i + 1}</span>` : `<button type="button" class="sj-day ${cls} ${date === today() ? "today" : ""}" data-sj-day="${date}" data-sj-axis="${axis}" ${future || !sjWritable() ? "disabled" : ""} aria-label="${axis} · ${i + 1} ${esc(sjMonthLabel(key))} : ${d ? (d.status === "ok" ? "bonne journée" : `écart${d.note ? ` — ${esc(d.note)}` : ""}`) : "non renseigné"}">${i + 1}</button>`;
  })].join("");
  const ok = rows.filter((r) => r.axis === axis && r.date.startsWith(key) && r.status === "ok").length, ko = rows.filter((r) => r.axis === axis && r.date.startsWith(key) && r.status === "ko").length;
  return `<article class="sj-letter" style="--axis:${AXES[axis].color}"><header><b class="sj-big" aria-hidden="true">${axis}</b><div><b>${esc(AXES[axis].label)}</b><small>${ok} vert${ok > 1 ? "s" : ""} · ${ko} rouge${ko > 1 ? "s" : ""}</small></div></header><div class="sj-cal" data-letter="${axis}">${cells}</div></article>`;
}

/* ---------- Le point du jour ---------- */

function sjPanel(embedded = false) {
  if (state.site === "group" || !sjCan()) return "";
  const w = sjWritable(), t = today(), ms = sjMeetings(), held = ms.some((m) => m.date === t), running = !!state.timerStarted;
  const done = SJ_AXES.filter((a) => sjGet(t, a)).length;
  const tile = (a) => { const d = sjGet(t, a);
    return `<div class="sj-tile ${d ? d.status : ""}" style="--axis:${AXES[a].color}" data-sj-tile="${a}"><div class="sj-tile-head"><b class="sj-big">${a}</b><span>${esc(AXES[a].label)}</span></div>
      ${w ? `<div class="sj-okko"><button type="button" class="sj-btn ok ${d?.status === "ok" ? "on" : ""}" data-sj-today="${a}" data-sj-v="ok" aria-pressed="${d?.status === "ok"}">Bonne journée</button><button type="button" class="sj-btn ko ${d?.status === "ko" ? "on" : ""}" data-sj-today="${a}" data-sj-v="ko" aria-pressed="${d?.status === "ko"}">Écart</button></div>` : `<p class="hint">${d ? (d.status === "ok" ? "Bonne journée" : "Écart") : "Non renseigné"}</p>`}
      ${d?.status === "ko" ? (d.topic_id ? `<p class="sj-note">${esc(d.note || "")} <button type="button" class="md-link" data-open-record="${esc(d.topic_id)}">${esc(d.topic_id)}</button></p>` : w ? `<form class="ik-add sj-noteform" data-sj-note="${a}"><input data-sj-notein placeholder="${esc(SJ_HINT[a])}" enterkeyhint="send" autocomplete="off"><button class="btn secondary" aria-label="Ajouter au TOP 15">→</button></form>` : "") : ""}</div>`; };
  const stats = (() => { const days = new Set(ms.map((m) => m.date)).size, dur = ms.length ? ms.reduce((n, m) => n + (m.duration_s || 0), 0) / ms.length : null, pres = ms.filter((m) => (m.present || []).length).map((m) => m.present.length); return { days, dur, pres: pres.length ? pres.reduce((a, b) => a + b, 0) / pres.length : null }; })();
  const esc2 = sjEscalations();
  return `<section class="sj-panel section" aria-label="Le point du jour"><div class="sj-head"><div><h2>Le point du jour</h2><p class="hint">${shortDate(t)} · ${done}/5 lettres renseignées${held ? " · point tenu" : ""}</p></div>
      <div class="sj-run">${running ? `<span class="timer sj-timer" aria-live="off">${timerLabel()}</span>${w ? '<button type="button" class="btn" data-sj-close>Clore le point</button>' : ""}` : w ? '<button type="button" class="btn secondary" data-timer>Démarrer le point</button>' : ""}</div></div>
    <div class="sj-tiles">${SJ_AXES.map(tile).join("")}</div>
    <div class="sj-foot"><span><b>${stats.days}</b> point${stats.days > 1 ? "s" : ""} tenu${stats.days > 1 ? "s" : ""} ce mois</span><span>Durée moyenne <b>${stats.dur === null ? "—" : smFmt(stats.dur)}</b></span><span>Présents en moyenne <b>${stats.pres === null ? "—" : smNum(stats.pres)}</b></span><span>Réaction aux escalades <b>${esc2.avg === null ? "—" : `${smNum(esc2.avg)} h`}</b></span></div>
    ${esc2.open.length ? `<div class="sj-esc"><h3>Escalades en attente de réponse · ${esc2.open.length}</h3><ul>${esc2.open.map((e) => `<li class="${e.h > 24 ? "late" : ""}"><span class="jn-tag ${e.h > 24 ? "tone-bad" : "tone-warn"}">N${e.e.level}</span><b>${esc(e.e.title)}</b><span class="hint">${esc(e.e.owner || "")} · depuis ${e.h < 1 ? "moins d’1 h" : e.h < 48 ? `${Math.floor(e.h)} h` : `${Math.floor(e.h / 24)} j`}</span>${osWritable(e.e.site_id) ? `<button type="button" class="btn small secondary" data-sj-answer="${esc(e.e.id)}">Répondu</button>` : ""}</li>`).join("")}</ul></div>` : ""}
    ${embedded ? "" : `<details class="sj-month"><summary>Les lettres du mois</summary><div class="sj-monthbar"><button type="button" class="btn ghost small" data-sj-month="-1" aria-label="Mois précédent">‹</button><b>${esc(sjMonthLabel(sjMonthKey()))}</b><button type="button" class="btn ghost small" data-sj-month="1" aria-label="Mois suivant" ${sjMonthKey() >= today().slice(0, 7) ? "disabled" : ""}>›</button><button type="button" class="btn ghost small" data-sj-print>Lettres à afficher</button></div><div class="sj-letters">${SJ_AXES.map((a) => sjLetter(a, sjMonthKey())).join("")}</div></details>`}</section>`;
}
function sjEscalations() {
  const rows = (data.escalations || []).filter((e) => !e.archived_at && e.site_id === state.site);
  const open = rows.filter((e) => e.status !== "Clos").map((e) => ({ e, h: (Date.now() - Date.parse(e.created_at || e.updated_at || now())) / 36e5 })).sort((a, b) => b.h - a.h).slice(0, 6);
  const closed = rows.filter((e) => e.status === "Clos" && e.created_at && (e.answered_at || e.updated_at) && String(e.answered_at || e.updated_at).startsWith(today().slice(0, 7)));
  const avg = closed.length ? closed.reduce((n, e) => n + Math.max(0, (Date.parse(e.answered_at || e.updated_at) - Date.parse(e.created_at)) / 36e5), 0) / closed.length : null;
  return { open, avg };
}
function sjDayForm(date, axis) {
  if (!sjWritable() || date > today()) return;
  const d = sjGet(date, axis);
  modal(`${axis} · ${AXES[axis].label} · ${shortDate(date)}`, `<form id="sjDayForm" class="jn-form"><div class="tm-colors sj-choice"><button type="button" class="tm-cbtn sj-ok ${d?.status === "ok" ? "on" : ""}" data-sj-pick="ok">Bonne journée</button><button type="button" class="tm-cbtn sj-ko ${d?.status === "ko" ? "on" : ""}" data-sj-pick="ko">Écart</button></div>
    <label class="field">Ce qui s’est passé<input id="sjNote" value="${esc(d?.note || "")}" placeholder="${esc(SJ_HINT[axis])}"></label>
    <div class="form-actions"><button class="btn">Enregistrer</button>${d ? '<button type="button" class="btn ghost" data-sj-clear>Effacer le jour</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  let pick = d?.status || "";
  $("modalContent").querySelectorAll("[data-sj-pick]").forEach((b) => (b.onclick = () => { pick = b.dataset.sjPick; $("modalContent").querySelectorAll("[data-sj-pick]").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("modalContent").querySelector("[data-sj-clear]")?.addEventListener("click", () => { if (sjSet(date, axis, null)) { closeModal(); render(); } });
  $("sjDayForm").onsubmit = (e) => { e.preventDefault(); if (!pick) return toast("Bonne journée ou écart ?"); const note = $("sjNote").value.trim(); if (pick === "ko" && !note) { $("sjNote").focus(); return toast("Dites ce qui s’est passé."); } const r = sjSet(date, axis, pick, note); if (!r) return; closeModal(); render(); if (r.topicId) toast(`Écart ajouté au TOP 15 : ${r.topicId}.`); };
}
function sjCloseForm() {
  if (!sjWritable() || !state.timerStarted) return;
  const dur = Math.round((Date.now() - state.timerStarted) / 1000), team = [...new Set((data.skillsMatrix || []).filter((t) => t.site_id === state.site && !t.archived_at).flatMap((t) => t.people.map((p) => p.name)))].slice(0, 30), last = (data.meetings || []).filter((m) => m.site_id === state.site && (m.workshop_id || null) === sjWs()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const known = [...new Set([...(last?.present || []), ...team])];
  const open = topSubjects().length;
  let present = new Set(last?.present || []);
  modal("Clore le point", `<form id="sjCloseForm" class="jn-form"><p class="jn-lead">Durée : <b>${smFmt(dur)}</b>${dur > 15 * 60 ? " · au-delà des 15 minutes" : ""} · ${jnPlural(open, "sujet ouvert", "sujets ouverts")} au TOP 15</p>
    <div class="ap-field"><span class="metric-label">Présents</span><div class="filters sj-people">${known.map((n) => `<button type="button" class="chip ${present.has(n) ? "active" : ""}" data-sj-p="${esc(n)}" aria-pressed="${present.has(n)}">${esc(n)}</button>`).join("")}</div>
    <div class="ik-add"><input id="sjAddP" placeholder="Ajouter une personne" autocomplete="off"><button type="button" class="btn secondary" data-sj-addp aria-label="Ajouter">+</button></div></div>
    <div class="form-actions"><button class="btn jn-big">Point tenu</button><button type="button" class="btn ghost" data-close-modal>Continuer le point</button></div></form>`);
  const root = $("modalContent");
  const bindChips = () => root.querySelectorAll("[data-sj-p]").forEach((b) => (b.onclick = () => { const n = b.dataset.sjP; present.has(n) ? present.delete(n) : present.add(n); b.classList.toggle("active", present.has(n)); b.setAttribute("aria-pressed", String(present.has(n))); }));
  bindChips();
  root.querySelector("[data-sj-addp]").onclick = () => { const v = $("sjAddP").value.trim(); if (!v || root.querySelector(`[data-sj-p="${CSS.escape(v)}"]`)) return; present.add(v); root.querySelector(".sj-people").insertAdjacentHTML("beforeend", `<button type="button" class="chip active" data-sj-p="${esc(v)}" aria-pressed="true">${esc(v)}</button>`); $("sjAddP").value = ""; bindChips(); $("sjAddP").focus(); };
  $("sjAddP").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); root.querySelector("[data-sj-addp]").click(); } };
  $("sjCloseForm").onsubmit = (e) => {
    e.preventDefault();
    const started = new Date(state.timerStarted).toISOString(), escalated = (data.escalations || []).filter((x) => x.site_id === state.site && Date.parse(x.created_at || 0) >= state.timerStarted).length;
    if (!commitData(() => { data.meetings ||= []; data.meetings.unshift({ id: uid("PT"), site_id: state.site, workshop_id: sjWs(), date: today(), started_at: started, ended_at: now(), duration_s: dur, present: [...present], topics: open, escalated, by: apMe() || role().label }); })) return;
    modalDirty = false; state.timerStarted = null; clearInterval(window.biaTimer); closeModal(); render(); toast(`Point tenu en ${smFmt(dur)} · ${jnPlural(present.size, "présent", "présents")}.`);
  };
}
function sjPrint() {
  const key = sjMonthKey();
  modal("Lettres à afficher", `<article class="pv-sheet sj-sheet"><header><div><small>SQCDP · ${esc(getSiteName(state.site))}${workshop() ? ` · ${esc(workshop().name)}` : ""}</small><h3>${esc(sjMonthLabel(key))}</h3></div></header><div class="sj-letters print">${SJ_AXES.map((a) => sjLetter(a, key, { big: true })).join("")}</div><footer>Vert : bonne journée · Rouge : écart, traité au TOP 15.</footer></article>
    <style media="print">@page{size:A4 landscape;margin:8mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
}

/* ---------- Branchements ---------- */

const sjRenderBase = renderSqcdp;
renderSqcdp = function (embedded = false) {
  let html = sjRenderBase.apply(this, arguments);
  if (state.site === "group" || !sjCan()) return html;
  const panel = sjPanel(embedded);
  if (panel) html = html.replace(/<span class="timer" id="meetingTimer">[^<]*<\/span><button class="btn secondary" data-timer>[^<]*<\/button>/, "");
  return html.includes('<div class="sqcdp-grid') ? html.replace('<div class="sqcdp-grid', `${panel}<div class="sqcdp-grid`) : `${panel}${html}`;
};
function sjBind(root = document) {
  root.querySelectorAll("[data-sj-today]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.sjToday, v = b.dataset.sjV, cur = sjGet(today(), a);
    if (cur?.status === v) { if (sjSet(today(), a, null)) render(); return; }
    if (!sjSet(today(), a, v, v === "ko" ? cur?.note || "" : "")) return;
    render();
    if (v === "ko") document.querySelector(`[data-sj-note="${a}"] [data-sj-notein]`)?.focus();
  }));
  root.querySelectorAll("[data-sj-note]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const note = f.querySelector("[data-sj-notein]").value.trim(); if (!note) return; const r = sjSet(today(), f.dataset.sjNote, "ko", note); if (!r) return; render(); if (r.topicId) toast(`Écart ajouté au TOP 15 : ${r.topicId}.`); }));
  root.querySelectorAll("[data-sj-day]").forEach((b) => (b.onclick = () => sjDayForm(b.dataset.sjDay, b.dataset.sjAxis)));
  root.querySelectorAll("[data-sj-month]").forEach((b) => (b.onclick = () => { sjMonth = sjShift(sjMonthKey(), Number(b.dataset.sjMonth)); if (sjMonth > today().slice(0, 7)) sjMonth = today().slice(0, 7); render(); const d = document.querySelector(".sj-month"); if (d) d.open = true; }));
  root.querySelectorAll("[data-sj-print]").forEach((b) => (b.onclick = sjPrint));
  root.querySelectorAll("[data-sj-close]").forEach((b) => (b.onclick = sjCloseForm));
  root.querySelectorAll("[data-sj-answer]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.sjAnswer, e = (data.escalations || []).find((x) => x.id === id);
    if (!e) return;
    modal("Réponse à l’escalade", `<form id="sjAnsForm" class="jn-form"><p class="jn-lead">${esc(e.title)} <span class="hint">N${e.level} · ${esc(e.owner || "")}</span></p><label class="field">Réponse, décision<input id="sjAns" required placeholder="Ex. technicien détaché demain 7 h"></label><div class="form-actions"><button class="btn jn-big">Répondu</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
    $("sjAnsForm").onsubmit = (ev) => { ev.preventDefault(); const r = $("sjAns").value.trim(); if (!r) return toast("La réponse apportée."); if (!commitData(() => { const x = data.escalations.find((k) => k.id === id); x.status = "Clos"; x.result = r; x.answered_at = now(); x.updated_at = now(); })) return; modalDirty = false; closeModal(); render(); toast("Escalade close : la réponse est tracée."); };
  }));
}
const sjOsBindBase = osBind;
osBind = function () {
  const out = sjOsBindBase.apply(this, arguments);
  sjBind(document);
  clearInterval(window.sjTimerInt);
  if (state.timerStarted && document.querySelector(".sj-timer")) window.sjTimerInt = setInterval(() => { const els = document.querySelectorAll(".sj-timer"); if (!els.length || !state.timerStarted) return clearInterval(window.sjTimerInt); els.forEach((el) => { el.textContent = timerLabel(); }); }, 1000);
  return out;
};
