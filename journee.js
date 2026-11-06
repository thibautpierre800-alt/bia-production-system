"use strict";
/*
 * BIA Lean OS 8.0 · « Ma journée » et Gemba express.
 *  - L'accueil montre ce qui sert chaque jour, selon le profil : le Gemba, mes actions, ce qui est à surveiller.
 *  - Gemba express : démarrer en un geste, noter un constat (une phrase, une photo, une famille),
 *    puis trier les constats un par un vers une action du plan, un signal, une analyse, ou rien.
 * Aucun champ nouveau : visites, constats et actions gardent le modèle existant.
 */

const JN_SITE_KEY = "biaGembaSite";

function jnCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function jnToday() { return jnCap(new Date(today() + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })); }
function jnPlural(n, one, many) { return `${n} ${n > 1 ? many : one}`; }
function jnWritableSites() { return OPERATIONAL_SITES.filter((s) => allowedSite(s.id, true)); }
function jnCanGemba() { return !role().readonly && role().nav.includes("terrain") && state.role !== "operator" && jnWritableSites().length > 0; }
function jnGembas() { return scoped(data.gembas || []).filter((g) => !g.archived_at); }
function jnStamp(g) { return String(g.updated_at || g.created_at || ""); }
function jnToSort(g) { return gembaObservations(g).filter((o) => !o.decision || o.decision === "À décider"); }
function jnFamClass(f) { return "fam-" + String(f || "Autre").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-"); }
function jnFam(f) { return `<span class="jn-fam ${jnFamClass(f)}">${esc(f || "Autre")}</span>`; }

/* Visite en cours : la mienne si je me suis identifié, sinon la plus récente de moins de trois jours. */
function jnCurrentVisit() {
  const rows = jnGembas().filter((g) => g.status !== "Clos" && !g.visited_at && allowedSite(g.site_id, true)).sort((a, b) => jnStamp(b).localeCompare(jnStamp(a)));
  const me = apMe(), recent = rows.find((g) => -daysUntil(jnStamp(g).slice(0, 10)) <= 2);
  return (me && rows.find((g) => g.author === me)) || recent || null;
}
function jnSortItems(gid = null) {
  if (role().readonly) return [];
  const rows = gid ? (data.gembas || []).filter((g) => g.id === gid) : jnGembas();
  return rows.filter((g) => g.status !== "Clos" && allowedSite(g.site_id, true)).flatMap((g) => jnToSort(g).map((o) => ({ gid: g.id, oid: o.id })));
}
function jnReturns() {
  const limit = apShiftDay(today(), 7);
  return jnGembas().filter((g) => g.status !== "Clos" && g.visited_at && g.review_date && g.review_date <= limit).sort((a, b) => a.review_date.localeCompare(b.review_date));
}
function jnSuite(o) {
  const d = o.decision || "À décider";
  if (d === "À décider") return { cls: "todo", text: "À trier" };
  if (d === "Conforme") return { cls: "none", text: "Rien à faire" };
  if (d === "Action") {
    const a = data.actions.find((x) => x.id === o.action_id);
    return { cls: "action", text: a ? `Action ${a.id} · ${a.owner || "À désigner"} · ${a.status === "Clôturée" ? "close" : a.due_date ? shortDate(a.due_date) : "sans date"}` : "Action" };
  }
  if (d === "Signal") return { cls: "signal", text: `Signal ${o.signal_id || ""}`.trim() };
  return { cls: "problem", text: `${d} ${o.problem_id || ""}`.trim() };
}
function jnOwners(siteId) {
  const me = apMe(), all = apOwners(scoped(data.actions)), count = new Map();
  data.actions.filter((a) => a.site_id === siteId && !apOwnerless(a)).forEach((a) => count.set(a.owner, (count.get(a.owner) || 0) + 1));
  const ranked = all.slice().sort((x, y) => (count.get(y) || 0) - (count.get(x) || 0) || x.localeCompare(y, "fr"));
  return [...new Set([me, ...ranked].filter(Boolean))].slice(0, 6);
}

/* ---------- Accueil « Ma journée » ---------- */

// Mantra du Groupe, repris de la signature d’origine (7.1).
const BIA_MANTRA = "D’artisan industriel à industriel artisan.";

function jnHead() {
  const where = state.site === "group" ? "BIA Holding" : `${site().name}${workshop() ? " · " + workshop().name : ""}`;
  return `<div class="page-head jn-head"><div><p class="jn-mantra">${esc(BIA_MANTRA)}</p><h1>Ma journée</h1><p class="jn-date">${esc(jnToday())} · ${esc(where)}</p></div></div>`;
}
function jnGembaCard() {
  const cur = jnCurrentVisit(), sort = jnSortItems(), back = jnReturns();
  let main = cur
    ? `<div class="jn-now"><span class="jn-kicker">Visite en cours</span><b>${esc(cur.zone || "Visite")}</b><span class="hint">${esc(getSiteName(cur.site_id))} · ${jnPlural(gembaObservations(cur).length, "constat", "constats")}</span></div>
       <div class="jn-buttons"><button type="button" class="btn jn-big" data-jn-constat="${esc(cur.id)}">+ Constat</button><button type="button" class="btn secondary" data-jn-open="${esc(cur.id)}">Reprendre la visite</button></div>`
    : `<p class="jn-lead">Voir le travail réel avec l’équipe, noter les faits sur place, décider ensuite.</p><div class="jn-buttons"><button type="button" class="btn jn-big" data-new-gemba>Démarrer un Gemba</button>${state.role === "teamlead" ? '<button type="button" class="btn secondary" data-new-signal>Signaler</button>' : ""}</div>`;
  const lines = [];
  if (sort.length) lines.push(`<button type="button" class="jn-line warn" data-jn-sort>${jnPlural(sort.length, "constat à trier", "constats à trier")}<span>Trier</span></button>`);
  back.slice(0, 2).forEach((g) => lines.push(`<button type="button" class="jn-line ${g.review_date < today() ? "late" : ""}" data-jn-open="${esc(g.id)}">Retour terrain · ${esc(g.zone || "")} · ${esc(getSiteName(g.site_id))}<span>${esc(shortDate(g.review_date))}</span></button>`));
  return `<section class="jn-card jn-gemba" aria-label="Gemba"><div class="jn-card-head"><h2>Gemba</h2><button type="button" class="jn-link" data-jn-tab="gemba">Tous les Gemba</button></div>${main}${lines.length ? `<div class="jn-lines">${lines.join("")}</div>` : ""}</section>`;
}
function jnActionRow(a) {
  const due = apDueBadge(a);
  return `<button type="button" class="jn-row" data-jn-action="${esc(a.id)}"><span class="jn-row-main"><b>${esc(a.title)}</b><span class="hint">${esc(getSiteName(a.site_id))} · ${esc(a.owner || "À désigner")}</span></span><span class="ap-due ${due.cls}">${esc(due.label)}</span></button>`;
}
function jnActionsCard() {
  const ro = role().readonly, me = ro ? "" : apMe(), open = scoped(data.actions).filter(isOpenAction);
  const mine = me ? open.filter((a) => apIsMine(a, me)) : open;
  const late = mine.filter(isLate), week = mine.filter((a) => apInfo(a).week), verify = mine.filter((a) => a.status === "À vérifier" && !isLate(a));
  const list = [...new Map((ro ? late : [...late, ...week, ...verify]).map((a) => [a.id, a])).values()].sort((x, y) => apRank(x) - apRank(y)).slice(0, 5);
  const title = ro ? "Actions en retard" : me ? "Mes actions" : "Actions du périmètre";
  const summary = ro
    ? `${jnPlural(late.length, "action en retard", "actions en retard")} sur ${open.length} ouvertes`
    : `<b class="${late.length ? "jn-bad" : ""}">${late.length} en retard</b> · ${week.length} cette semaine${verify.length ? ` · ${verify.length} à vérifier` : ""}`;
  const who = !ro && !me ? `<div class="jn-me">${apMeSelect("data-jn-me")}</div>` : "";
  const review = !ro && apReviewQueue().length ? '<button type="button" class="btn secondary" data-jn-review>Faire le point de la semaine</button>' : "";
  return `<section class="jn-card jn-actions" aria-label="${esc(title)}"><div class="jn-card-head"><h2>${esc(title)}</h2>${ro ? "" : '<button type="button" class="jn-link" data-jn-new-action>+ Action</button>'}</div>
    <p class="jn-summary">${summary}</p>${who}
    <div class="jn-rows">${list.map(jnActionRow).join("") || `<p class="jn-empty">${ro ? "Aucune action en retard." : "Rien en retard ni à échéance cette semaine."}</p>`}</div>
    <div class="jn-buttons"><button type="button" class="btn secondary" data-nav="actions">Tout le plan d’actions</button>${review}</div></section>`;
}
function jnWatchCard() {
  const items = homePriorityItems().filter((i) => i.kind !== "action").slice(0, 3), dg = state.role === "dg";
  if (!items.length && !dg) return "";
  return `<section class="jn-card jn-watch" aria-label="${dg ? "À décider" : "À surveiller"}"><div class="jn-card-head"><h2>${dg ? "À décider" : "À surveiller"}</h2></div>
    <div class="jn-rows">${items.map((i) => `<button type="button" class="jn-row" data-open-record="${esc(i.id)}"><span class="jn-row-main"><span class="jn-tag tone-${esc(i.tone)}">${esc(i.label)}</span><b>${esc(i.title)}</b><span class="hint">${esc(i.meta)}</span></span></button>`).join("") || '<p class="jn-empty">Rien à arbitrer pour l’instant.</p>'}</div></section>`;
}
function jnSignalCard() {
  const idea = role().nav.includes("kaizen") ? `<button type="button" class="btn secondary" data-os="new" data-args="${esc(JSON.stringify({ key: "kaizens" }))}">Proposer une idée</button>` : "";
  return `<section class="jn-card jn-signal" aria-label="Signaler"><div class="jn-card-head"><h2>Un problème au poste ?</h2></div><p class="jn-lead">Un fait, une photo : votre responsable est prévenu.</p><div class="jn-buttons"><button type="button" class="btn jn-big" data-new-signal>Signaler</button>${idea}</div></section>`;
}
renderHome = function () {
  const r = state.role, cards = [];
  if (r === "dg") cards.push(jnWatchCard(), jnActionsCard());
  else {
    if (r === "operator" && role().nav.includes("terrain")) cards.push(jnSignalCard());
    if (jnCanGemba()) cards.push(jnGembaCard());
    if (role().nav.includes("actions")) cards.push(jnActionsCard());
    cards.push(jnWatchCard());
  }
  return `<div class="jn-home role-${esc(r)}">${jnHead()}<div class="jn-grid">${cards.filter(Boolean).join("")}</div></div>`;
};

/* ---------- Gemba express : démarrer ---------- */

function jnStart() {
  if (!jnCanGemba()) return toast("Votre profil ne permet pas de démarrer un Gemba.");
  const sites = jnWritableSites();
  let last = "";
  try { last = localStorage.getItem(JN_SITE_KEY) || ""; } catch {}
  let siteId = state.site !== "group" && allowedSite(state.site, true) ? state.site : sites.some((s) => s.id === last) ? last : sites[0].id;
  const zones = (sid) => [...new Set((data.gembas || []).filter((g) => g.site_id === sid && g.zone).map((g) => g.zone))].slice(0, 40).map((z) => `<option value="${esc(z)}"></option>`).join("");
  modal("Démarrer un Gemba", `<form id="jnStartForm" class="jn-form">
    ${sites.length > 1 ? `<div class="ap-field"><span class="metric-label">Site</span><div class="filters jn-sites">${sites.map((s) => `<button type="button" class="chip ${s.id === siteId ? "active" : ""}" data-jn-site="${esc(s.id)}" aria-pressed="${s.id === siteId}">${esc(s.name)}</button>`).join("")}</div></div>` : ""}
    <label class="field">Où ?<input id="jnZone" required list="jnZones" autocomplete="off" placeholder="Zone, poste ou ligne"></label><datalist id="jnZones">${zones(siteId)}</datalist>
    <details class="jn-more"><summary>Question et retour prévu (facultatif)</summary>
      <label class="field">Que voulons-nous comprendre ?<input id="jnQuestion" placeholder="Ex. pourquoi les palettes attendent devant le rack ?"></label>
      <label class="field">Retour terrain prévu<input type="date" id="jnReview"></label></details>
    <div class="form-actions"><button class="btn jn-big">Démarrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  root.querySelectorAll("[data-jn-site]").forEach((b) => (b.onclick = () => {
    siteId = b.dataset.jnSite;
    root.querySelectorAll("[data-jn-site]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
    $("jnZones").innerHTML = zones(siteId);
  }));
  setTimeout(() => $("jnZone")?.focus(), 0);
  $("jnStartForm").onsubmit = (e) => {
    e.preventDefault();
    const zone = $("jnZone").value.trim();
    if (!zone) return toast("Précisez la zone, le poste ou la ligne.");
    if (!allowedSite(siteId, true)) return toast("Site hors de votre périmètre.");
    const payload = { id: nextId("G", data.gembas), site_id: siteId, workshop_id: state.workshop || null, zone, objective: $("jnQuestion").value.trim(), author: apMe() || osActor(), review_date: $("jnReview").value || null, status: "Brouillon", observations: [], created_at: now(), updated_at: now() };
    if (!commitData(() => { data.gembas.unshift(payload); recordHistory(payload, "Brouillon", "Visite démarrée"); })) return;
    try { localStorage.setItem(JN_SITE_KEY, siteId); } catch {}
    if (state.site !== "group" && state.site !== siteId) state.site = siteId;
    modalDirty = false;
    render();
    toast(`Gemba démarré · ${getSiteName(siteId)} · ${zone}`);
    jnConstat(payload.id);
  };
}
const jnGembaFormBase = gembaForm;
gembaForm = function (existing = null) { return existing ? jnGembaFormBase(existing) : jnStart(); };

/* ---------- Gemba express : la visite ---------- */

function jnObsCard(g, o, writable) {
  const s = jnSuite(o), pic = safePhoto(o.photo);
  return `<button type="button" class="jn-obs" data-jn-obs="${esc(o.id)}" ${writable ? "" : "disabled"}>
    <span class="jn-obs-main">${jnFam(o.category)}<span class="jn-obs-fact">${esc(o.fact)}</span><span class="jn-suite ${s.cls}">${esc(s.text)}</span></span>
    ${pic ? `<img class="jn-thumb" src="${pic}" alt="">` : ""}</button>`;
}
function jnVisitState(g) {
  if (g.status === "Clos") return "Visite close, résultat vérifié";
  if (!g.visited_at) return "Visite en cours";
  return g.review_date ? `Retour terrain prévu le ${shortDate(g.review_date)}` : "Visite terminée, retour terrain à prévoir";
}
openGemba = function (id) {
  const g = (data.gembas || []).find((x) => x.id === id);
  if (!g || !allowedSite(g.site_id)) return;
  const obs = gembaObservations(g), writable = !role().readonly && allowedSite(g.site_id, true) && g.status !== "Clos", todo = jnToSort(g).length;
  const main = [];
  if (writable && todo) main.push(`<button type="button" class="btn dark" data-jn-sort="${esc(g.id)}">Trier ${jnPlural(todo, "constat", "constats")}</button>`);
  if (writable && !g.visited_at) main.push(`<button type="button" class="btn secondary" data-jn-finish="${esc(g.id)}">Terminer la visite</button>`);
  if (writable && g.visited_at) main.push(`<button type="button" class="btn secondary" data-jn-verify="${esc(g.id)}">Retour terrain</button>`);
  modal(`${g.id} · Gemba`, `<div class="jn-visit">
    <p class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(shortDate(g.created_at))}${g.author ? " · " + esc(g.author) : ""}</p>
    <h3 class="jn-zone">${esc(g.zone || "Zone à préciser")}</h3>
    ${g.objective ? `<p class="jn-question">${esc(g.objective)}</p>` : ""}
    <p class="jn-state">${esc(jnVisitState(g))}</p>
    ${writable ? `<button type="button" class="btn jn-big jn-add" data-jn-constat="${esc(g.id)}">+ Constat</button>` : ""}
    <div class="jn-obs-list">${obs.map((o) => jnObsCard(g, o, writable)).join("") || '<p class="jn-empty">Aucun constat pour l’instant. Notez ce que vous voyez, une phrase suffit.</p>'}</div>
    ${main.length ? `<div class="jn-buttons">${main.join("")}</div>` : ""}
    <details class="jn-more"><summary>Plus</summary>
      <div class="jn-buttons">${writable ? `<button type="button" class="btn secondary small" data-jn-edit="${esc(g.id)}">Lieu, question et retour prévu</button>` : ""}<button type="button" class="btn ghost small" data-print>Imprimer / PDF</button></div>
      ${g.verification ? `<section class="verification-box section"><h3>Retour terrain · ${esc(g.verification.result)}</h3><p>${esc(g.verification.evidence)}</p><p class="hint">${esc(g.verification.by)} · ${shortDate(g.verification.date)}</p></section>` : ""}
      ${historyView(g)}
    </details></div>`);
  const root = $("modalContent"), ctx = root.querySelector(".os-context");
  if (ctx) root.querySelector(".jn-more")?.append(ctx);
  root.querySelectorAll("[data-jn-obs]").forEach((b) => (b.onclick = () => jnConstat(g.id, b.dataset.jnObs)));
  root.querySelectorAll("[data-jn-finish]").forEach((b) => (b.onclick = () => {
    if (!gembaObservations(g).length) return toast("Notez au moins un constat avant de terminer la visite.");
    if (jnToSort(g).length) { toast("Chaque constat reçoit une suite avant de terminer : triez-les."); return jnSort(g.id); }
    finishGemba(g.id);
  }));
  root.querySelectorAll("[data-jn-verify]").forEach((b) => (b.onclick = () => verifyGemba(g.id)));
  root.querySelectorAll("[data-jn-edit]").forEach((b) => (b.onclick = () => jnGembaFormBase(g)));
};

/* ---------- Gemba express : un constat ---------- */

function jnConstat(gid, oid = null) {
  const g = (data.gembas || []).find((x) => x.id === gid);
  if (!g || role().readonly || !allowedSite(g.site_id, true) || g.status === "Clos") return;
  const old = oid ? gembaObservations(g).find((o) => o.id === oid) : null;
  const fam = old?.category || state.jnLastFamily || "";
  const extra = old && (old.operator || old.standard || old.gap || old.hypothesis);
  const linked = old && [old.action_id, old.signal_id, old.problem_id].find(Boolean);
  modal(old ? "Constat" : "Nouveau constat", `<form id="jnObsForm" class="jn-form">
    <p class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(g.zone || "")} · ${jnPlural(gembaObservations(g).length, "constat", "constats")}</p>
    <label class="field">Ce que je vois<textarea id="jnFact" rows="3" required placeholder="Un fait, sans chercher la cause. Ex. palettes au sol devant le rack 4">${esc(old?.fact || "")}</textarea></label>
    <div class="jn-photo-row"><label class="btn secondary jn-photo"><input type="file" id="jnPhoto" accept="image/jpeg,image/png,image/webp" hidden>${safePhoto(old?.photo) ? "Changer la photo" : "Photo"}</label><div id="jnPhotoPreview" class="jn-photo-preview">${photoImage(old?.photo)}</div></div>
    <div class="ap-field"><span class="metric-label">Famille</span><div class="filters jn-fams">${SIGNAL_TYPES.map((f) => `<button type="button" class="chip ${f === fam ? "active" : ""}" data-jn-fam="${esc(f)}" aria-pressed="${f === fam}">${esc(f)}</button>`).join("")}</div><input type="hidden" id="jnFamValue" value="${esc(fam)}"></div>
    <details class="jn-more" ${extra ? "open" : ""}><summary>Compléter (facultatif)</summary>
      <label class="field">Ce que dit l’équipe<textarea id="jnOperator" rows="2" placeholder="Ce qui aide ou empêche de bien travailler">${esc(old?.operator || "")}</textarea></label>
      <label class="field">Ce qui est attendu (standard)<input id="jnStandard" value="${esc(old?.standard || "")}"></label>
      <label class="field">Écart constaté<input id="jnGap" value="${esc(old?.gap || "")}"></label>
      <label class="field">Hypothèse à vérifier<input id="jnHypothesis" value="${esc(old?.hypothesis || "")}"></label>
      ${old ? `<button type="button" class="btn ghost small" data-jn-full>Formulaire complet</button>` : ""}</details>
    ${old ? `<p class="jn-suite-line">Suite : <span class="jn-suite ${jnSuite(old).cls}">${esc(jnSuite(old).text)}</span>${linked ? " " + recordLink(linked, "Ouvrir") : ""}</p>` : ""}
    <div class="form-actions">${old ? "" : '<button type="button" class="btn jn-big" data-jn-save="next">Enregistrer et suivant</button>'}<button type="button" class="btn ${old ? "" : "secondary"}" data-jn-save="done">${old ? "Enregistrer" : "Enregistrer et revenir"}</button><button type="button" class="btn ghost" data-jn-back="${esc(g.id)}">Annuler</button></div></form>`);
  const root = $("modalContent"), photo = photoPicker("jnPhoto", "jnPhotoPreview", old?.photo);
  root.querySelectorAll("[data-jn-fam]").forEach((b) => (b.onclick = () => {
    const on = $("jnFamValue").value !== b.dataset.jnFam;
    root.querySelectorAll("[data-jn-fam]").forEach((x) => { const pick = on && x === b; x.classList.toggle("active", pick); x.setAttribute("aria-pressed", pick); });
    $("jnFamValue").value = on ? b.dataset.jnFam : "";
  }));
  root.querySelector("[data-jn-full]")?.addEventListener("click", () => gembaObservationForm(g.id, old.id));
  root.querySelector("[data-jn-back]").onclick = () => { modalDirty = false; openGemba(g.id); };
  const save = (next) => {
    if (photo.busy) return toast("Photo en préparation, un instant.");
    if (photo.error) return toast("La photo n’a pas pu être lue : choisissez-en une autre ou retirez-la.");
    const fact = $("jnFact").value.trim();
    if (!fact) { $("jnFact").focus(); return toast("Notez ce que vous voyez, une phrase suffit."); }
    const category = $("jnFamValue").value || "Autre";
    const obs = { ...(old || {}), id: old?.id || uid("OBS"), fact, category, photo: photo.value || "", operator: $("jnOperator").value.trim(), standard: $("jnStandard").value.trim(), gap: $("jnGap").value.trim(), hypothesis: $("jnHypothesis").value.trim(), decision: old?.decision || "À décider" };
    if (!commitData(() => {
      const row = data.gembas.find((x) => x.id === gid);
      row.observations = gembaObservations(row);
      const i = row.observations.findIndex((o) => o.id === obs.id);
      if (i >= 0) row.observations[i] = obs; else row.observations.push(obs);
      row.updated_at = now();
      recordHistory(row, old ? "Constat modifié" : "Constat noté", fact);
    })) return;
    state.jnLastFamily = category;
    modalDirty = false;
    render();
    if (next) { toast("Constat noté. Le suivant :"); jnConstat(gid); }
    else { toast("Constat enregistré."); openGemba(gid); }
  };
  root.querySelectorAll("[data-jn-save]").forEach((b) => (b.onclick = () => save(b.dataset.jnSave === "next")));
  $("jnObsForm").onsubmit = (e) => { e.preventDefault(); save(!old); };
  if (!old) setTimeout(() => $("jnFact")?.focus(), 0);
}

/* ---------- Gemba express : trier les constats, un par un ---------- */

function jnSort(gid = null) {
  const queue = jnSortItems(gid);
  if (!queue.length) return toast("Aucun constat à trier.");
  state.jnSort = { queue, i: 0, step: "choose", done: [], gid };
  jnSortRender();
}
function jnDecide(gid, oid, patch) {
  let created = null;
  const ok = commitData(() => {
    const row = data.gembas.find((x) => x.id === gid);
    row.observations = gembaObservations(row);
    const i = row.observations.findIndex((o) => o.id === oid);
    const obs = { ...row.observations[i], ...patch };
    applyGembaDecision(row, obs);
    if (obs.action_id) {
      const a = data.actions.find((x) => x.id === obs.action_id);
      if (a) { a.due_date_initial ||= a.due_date || null; a.updates ||= []; a.reschedules ||= []; a.progress ??= 0; a.workshop_id ??= row.workshop_id || null; }
    }
    created = obs.action_id || obs.signal_id || obs.problem_id || null;
    row.observations[i] = obs;
    row.updated_at = now();
    recordHistory(row, "Constat trié", `${obs.fact} → ${obs.decision}`);
  });
  return ok ? { created } : null;
}
function jnSortCurrent() {
  const r = state.jnSort;
  while (r && r.i < r.queue.length) {
    const { gid, oid } = r.queue[r.i], g = (data.gembas || []).find((x) => x.id === gid), o = g && gembaObservations(g).find((x) => x.id === oid);
    if (g && o && (!o.decision || o.decision === "À décider")) return { g, o };
    r.i += 1;
  }
  return null;
}
function jnSortRender() {
  const r = state.jnSort;
  if (!r) return;
  const cur = jnSortCurrent();
  if (!cur) return jnSortEnd();
  const { g, o } = cur, total = r.queue.length, pct = Math.round((r.i / total) * 100);
  const head = `<div class="jn-sort-top"><span>Constat ${r.i + 1} sur ${total}</span><span class="hint">${esc(getSiteName(g.site_id))} · ${esc(g.zone || "")}</span></div>
    <div class="ap-rv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
    <article class="jn-sort-card">${jnFam(o.category)}<h3>${esc(o.fact)}</h3>${r.step === "choose" ? photoImage(o.photo) : ""}${o.operator ? `<p class="hint">L’équipe : « ${esc(o.operator)} »</p>` : ""}${o.hypothesis ? `<p class="hint">Hypothèse : ${esc(o.hypothesis)}</p>` : ""}</article>`;
  const ownerPick = (selected = "") => {
    const owners = jnOwners(g.site_id).slice(0, 4);
    return `<div class="ap-field"><span class="metric-label">Qui ?</span><div class="filters">${owners.map((n) => `<button type="button" class="chip ${n === selected ? "active" : ""}" data-jn-owner="${esc(n)}">${esc(n)}</button>`).join("")}<button type="button" class="chip" data-jn-owner="À désigner">À désigner</button></div>
      <input id="jnOwner" list="ownerList" placeholder="Autre pilote" value="${esc(selected)}">${ownerDatalist()}</div>`;
  };
  let body;
  if (r.step === "action") {
    const t = today(), first = apShiftDay(t, o.category === "Sécurité" ? 2 : 7);
    const dues = [[o.category === "Sécurité" ? "Sous 48 h" : "Dans 1 semaine", first], ["Dans 2 semaines", apShiftDay(t, 14)], ["Fin du mois", apEndOfMonth(t)]];
    body = `<div class="jn-step"><label class="field">Quoi ?<input id="jnWhat" value="${esc(o.next_action || "")}" placeholder="Commencer par un verbe : délimiter, ranger, mesurer…"></label>
      ${ownerPick(apMe())}
      <div class="ap-field"><span class="metric-label">Pour quand ?</span><div class="filters">${dues.map(([l, d], i) => `<button type="button" class="chip ${i === 0 ? "active" : ""}" data-jn-due="${d}">${l}</button>`).join("")}</div><input type="date" id="jnDue" value="${first}"></div>
      <div class="form-actions"><button type="button" class="btn jn-big" data-jn-confirm="action">Créer l’action</button><button type="button" class="btn ghost" data-jn-step="choose">Retour</button></div></div>`;
  } else if (r.step === "problem") {
    body = `<div class="jn-step"><div class="ap-field"><span class="metric-label">Méthode</span><div class="filters">${["A3", "8D", "QRQC"].map((m, i) => `<button type="button" class="chip ${i === 0 ? "active" : ""}" data-jn-method="${m}">${m}</button>`).join("")}</div><input type="hidden" id="jnMethod" value="A3"></div>
      ${ownerPick(apMe())}
      <div class="form-actions"><button type="button" class="btn jn-big" data-jn-confirm="problem">Ouvrir l’analyse</button><button type="button" class="btn ghost" data-jn-step="choose">Retour</button></div></div>`;
  } else {
    const canSignal = role().nav.includes("terrain"), canProblem = role().nav.includes("resolution");
    body = `<div class="jn-choices">
      <button type="button" class="jn-choice main" data-jn-pick="action"><b>Action</b><span>Une personne, une date : elle part dans le plan d’actions</span></button>
      ${canSignal ? '<button type="button" class="jn-choice" data-jn-pick="signal"><b>Signal</b><span>Anomalie à qualifier et prendre en charge</span></button>' : ""}
      ${canProblem ? '<button type="button" class="jn-choice" data-jn-pick="problem"><b>Analyse</b><span>A3, 8D ou QRQC pour trouver la cause</span></button>' : ""}
      <button type="button" class="jn-choice" data-jn-pick="none"><b>Rien à faire</b><span>Le constat est gardé, sans suite</span></button>
      <button type="button" class="jn-choice quiet" data-jn-pick="later"><b>Plus tard</b><span>Laisser à trier</span></button></div>`;
  }
  modal("Trier les constats", `<div class="jn-sort">${head}${body}</div>`);
  const root = $("modalContent"), next = (kind, id = null) => { r.done.push({ kind, id }); r.i += 1; r.step = "choose"; render(); jnSortRender(); };
  root.querySelectorAll("[data-jn-step]").forEach((b) => (b.onclick = () => { r.step = b.dataset.jnStep; jnSortRender(); }));
  root.querySelectorAll("[data-jn-pick]").forEach((b) => (b.onclick = () => {
    const kind = b.dataset.jnPick;
    if (kind === "action" || kind === "problem") { r.step = kind; jnSortRender(); setTimeout(() => $(kind === "action" ? "jnWhat" : "jnOwner")?.focus(), 0); return; }
    if (kind === "later") return next("later");
    const res = jnDecide(g.id, o.id, { decision: kind === "signal" ? "Signal" : "Conforme" });
    if (res) next(kind, res.created);
  }));
  root.querySelectorAll("[data-jn-owner]").forEach((b) => (b.onclick = () => { $("jnOwner").value = b.dataset.jnOwner; root.querySelectorAll("[data-jn-owner]").forEach((x) => x.classList.toggle("active", x === b)); }));
  root.querySelectorAll("[data-jn-due]").forEach((b) => (b.onclick = () => { $("jnDue").value = b.dataset.jnDue; root.querySelectorAll("[data-jn-due]").forEach((x) => x.classList.toggle("active", x === b)); }));
  root.querySelectorAll("[data-jn-method]").forEach((b) => (b.onclick = () => { $("jnMethod").value = b.dataset.jnMethod; root.querySelectorAll("[data-jn-method]").forEach((x) => x.classList.toggle("active", x === b)); }));
  root.querySelectorAll("[data-jn-confirm]").forEach((b) => (b.onclick = () => {
    const owner = $("jnOwner").value.trim();
    if (!owner) { $("jnOwner").focus(); return toast("Choisissez un pilote, ou « À désigner »."); }
    if (b.dataset.jnConfirm === "action") {
      const due = $("jnDue").value;
      if (!due) return toast("Choisissez une échéance.");
      const res = jnDecide(g.id, o.id, { decision: "Action", next_action: $("jnWhat").value.trim(), owner, due_date: due });
      if (res) next("action", res.created);
    } else {
      if (owner === "À désigner") return toast("Une analyse a besoin d’un pilote nommé.");
      const res = jnDecide(g.id, o.id, { decision: $("jnMethod").value, owner });
      if (res) next("problem", res.created);
    }
  }));
}
function jnSortEnd() {
  const r = state.jnSort, n = (k) => r.done.filter((d) => d.kind === k).length;
  const g = r.gid && (data.gembas || []).find((x) => x.id === r.gid);
  const canFinish = g && !g.visited_at && g.status !== "Clos" && gembaObservations(g).length && !jnToSort(g).length;
  const lines = [["action", "action ajoutée au plan", "actions ajoutées au plan"], ["signal", "signal créé", "signaux créés"], ["problem", "analyse ouverte", "analyses ouvertes"], ["none", "constat sans suite", "constats sans suite"], ["later", "laissé à trier", "laissés à trier"]]
    .filter(([k]) => n(k)).map(([k, one, many]) => `<li>${jnPlural(n(k), one, many)}</li>`).join("");
  modal("Tri terminé", `<div class="jn-sort-end"><ul class="jn-sum">${lines || "<li>Aucun constat trié.</li>"}</ul>
    <div class="form-actions">${canFinish ? `<button type="button" class="btn" data-jn-finish-now="${esc(g.id)}">Terminer la visite</button>` : ""}${n("action") ? `<button type="button" class="btn ${canFinish ? "secondary" : ""}" data-jn-plan>Voir le plan d’actions</button>` : ""}${g ? `<button type="button" class="btn secondary" data-jn-open="${esc(g.id)}">Revenir à la visite</button>` : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button></div></div>`);
  const root = $("modalContent");
  root.querySelector("[data-jn-finish-now]")?.addEventListener("click", () => { state.jnSort = null; finishGemba(g.id); });
  root.querySelector("[data-jn-plan]")?.addEventListener("click", () => { state.jnSort = null; closeModal(); state.actionView = "todo"; state.actionFilter = "all"; state.actionOwner = "all"; switchView("actions"); });
}

/* ---------- Liste des Gemba ---------- */

function jnGembaRow(g) {
  const obs = gembaObservations(g), todo = jnToSort(g).length, pic = obs.map((o) => safePhoto(o.photo)).find(Boolean);
  return `<button type="button" class="jn-grow" data-jn-open="${esc(g.id)}" data-search-row>
    <span class="jn-grow-main"><span class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(shortDate(g.created_at))}${g.author ? " · " + esc(g.author) : ""}</span><b>${esc(g.zone || "Zone à préciser")}</b>
      ${g.objective ? `<span class="hint">${esc(g.objective)}</span>` : ""}
      <span class="jn-grow-meta">${jnPlural(obs.length, "constat", "constats")}${todo ? ` · <em>${todo} à trier</em>` : ""}${g.review_date && g.status !== "Clos" && g.visited_at ? ` · retour ${esc(shortDate(g.review_date))}` : ""}</span></span>
    ${pic ? `<img class="jn-thumb" src="${pic}" alt="">` : ""}</button>`;
}
renderGembaList = function () {
  const rows = jnGembas().sort((a, b) => jnStamp(b).localeCompare(jnStamp(a)));
  const open = rows.filter((g) => g.status !== "Clos" && !g.visited_at);
  const back = rows.filter((g) => g.status !== "Clos" && g.visited_at).sort((a, b) => String(a.review_date || "9999").localeCompare(String(b.review_date || "9999")));
  const closed = rows.filter((g) => g.status === "Clos"), sort = jnSortItems();
  const block = (title, list) => (list.length ? `<section class="jn-gsec" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="jn-glist">${list.map(jnGembaRow).join("")}</div></section>` : "");
  return `${sort.length ? `<button type="button" class="jn-line warn jn-banner" data-jn-sort>${jnPlural(sort.length, "constat à trier", "constats à trier")}<span>Trier</span></button>` : ""}
    ${rows.length > 8 ? listSearch("Rechercher un Gemba") : ""}
    ${block("En cours", open)}${block("À revoir sur le terrain", back)}
    ${closed.length ? `<details class="jn-gsec"><summary>Terminés · ${closed.length}</summary><div class="jn-glist">${closed.map(jnGembaRow).join("")}</div></details>` : ""}
    ${rows.length ? "" : empty("Aucun Gemba sur ce périmètre. Démarrez par une zone : le reste se note sur place.")}`;
};
const jnRenderTerrainBase = renderTerrain;
renderTerrain = function () {
  if (state.terrainTab !== "gemba") return jnRenderTerrainBase();
  return `${pageHead("Terrain", "Gemba", "Voir le travail réel avec l’équipe, noter les faits sur place, décider ensuite.", jnCanGemba() ? '<button type="button" class="btn" data-new-gemba>Démarrer un Gemba</button>' : "")}${renderGembaList()}`;
};

/* « + » : le constat de Gemba en premier choix. */
const jnCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  jnCreateMenuBase();
  if (!jnCanGemba()) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const cur = jnCurrentVisit();
  menu.insertAdjacentHTML("afterbegin", `<button class="create-choice gemba" type="button" data-jn-quick><span>${uxIcon("observer")}</span><b>Constat de Gemba</b><small>${cur ? `Visite en cours · ${esc(cur.zone || "")}` : "Démarre une visite, puis note le constat"}</small></button>`);
  menu.querySelector("[data-jn-quick]").onclick = () => (cur ? jnConstat(cur.id) : jnStart());
};

/* ---------- Liaisons ---------- */

function jnBind(root = document) {
  root.querySelectorAll("[data-jn-open]").forEach((b) => (b.onclick = () => { state.jnSort = null; openGemba(b.dataset.jnOpen); }));
  root.querySelectorAll("[data-jn-constat]").forEach((b) => (b.onclick = () => jnConstat(b.dataset.jnConstat)));
  root.querySelectorAll("[data-jn-sort]").forEach((b) => (b.onclick = () => jnSort(b.dataset.jnSort || null)));
  root.querySelectorAll("[data-jn-action]").forEach((b) => (b.onclick = () => apOpen(b.dataset.jnAction)));
  root.querySelectorAll("[data-jn-tab]").forEach((b) => (b.onclick = () => { state.terrainTab = b.dataset.jnTab; switchView("terrain"); }));
  root.querySelectorAll("[data-jn-me]").forEach((s) => (s.onchange = () => { apSetMe(s.value); renderNotificationButton(); render(); }));
  root.querySelectorAll("[data-jn-review]").forEach((b) => (b.onclick = () => apStartReview()));
  root.querySelectorAll("[data-jn-new-action]").forEach((b) => (b.onclick = () => apQuickForm()));
}
const jnOsBindBase = osBind;
osBind = function () { const out = jnOsBindBase.apply(this, arguments); jnBind(document); return out; };
const jnCloseModalBase = closeModal;
closeModal = function () { state.jnSort = null; return jnCloseModalBase.apply(this, arguments); };

/* « Ma journée » remplace « Reprendre mon travail » : la visite en cours est dans la carte Gemba, le reste se retrouve par Rechercher. */
resumeWork = function () { return ""; };
