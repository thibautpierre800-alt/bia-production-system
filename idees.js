"use strict";
/*
 * BIA Lean OS 8.17 · Idées et Kaizen rapides (Résoudre › Kaizen, et « Proposer une idée » partout).
 *  - Une idée en 30 secondes au téléphone : photo d'abord, ce qui ne va pas, mon idée, « je peux le faire moi-même ».
 *  - Réponse sous 48 heures : « On le fait » (pilote, date) ou « Pas maintenant » (avec la raison), compteur d'heures.
 *  - « C'est fait » : photo après et ce que ça a changé ; le responsable valide le gain.
 *  - Fiche Kaizen d'une page (avant / après) à afficher, mur des idées réalisées avec « Bravo », chiffres du mois.
 *  - Le registre complet en neuf étapes et le registre des gains restent dans l'onglet « Registre et gains ».
 * Données : kaizens[] (collection indexée existante) ; champs ajoutés : proposer, before_photo, after_photo, self,
 * decision { verdict: "go"|"no", reason, by, at }, done_at, kudos[{ by, at }].
 */

const ID_NO = ["Déjà prévu", "Pas prioritaire maintenant", "Coût trop élevé", "Risque sécurité ou qualité", "Autre solution retenue"];

function idCan() { return role().nav.includes("kaizen"); }
function idRows() { return osScope(data.kaizens || []).filter((k) => !k.archived_at); }
function idGet(id) { return (data.kaizens || []).find((k) => k.id === id && !k.archived_at); }
function idHours(k) { return Math.max(0, ((k.decision?.at ? Date.parse(k.decision.at) : Date.now()) - Date.parse(k.created_at || k.updated_at || now())) / 36e5); }
function idWaiting(k) { return k.status === "Idée" && !k.decision; }
function idRefused(k) { return k.decision?.verdict === "no"; }
function idDone(k) { return ["Mesure", "Gain validé", "Standardisation", "Bonne pratique", "Déploiement"].includes(k.status) && !idRefused(k); }
function idInProgress(k) { return !idWaiting(k) && !idRefused(k) && !idDone(k); }
function idMine(k) { const me = apMe(); return !!me && (k.proposer === me || k.owner === me); }
function idMgr(k) { return osManager() && !role().readonly && allowedSite(k.site_id, true); }
function idWritable(k) { return !role().readonly && allowedSite(k.site_id, true) && osWritable(k.site_id); }
function idAge(h) { return h < 1 ? "moins d’1 h" : h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} j`; }
function idPhoto(v, cls, alt) { return v ? phImg(v, cls, alt) : ""; }
function idSave(id, fn) { const ok = commitData(() => { const k = data.kaizens.find((x) => x.id === id); fn(k); k.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function idSetMe(name) { try { if (name && name !== apMe()) localStorage.setItem(AP_ME_KEY, name); } catch {} }
function idMonth(rows) {
  const from = `${today().slice(0, 7)}-01`, m = rows.filter((k) => String(k.created_at || "").slice(0, 10) >= from), answered = m.filter((k) => k.decision);
  const fast = answered.filter((k) => idHours(k) <= 48).length;
  return { n: m.length, done: rows.filter((k) => idDone(k) && String(k.done_at || "").slice(0, 10) >= from).length, waiting: rows.filter(idWaiting).length, late: rows.filter((k) => idWaiting(k) && idHours(k) > 48).length, fast: answered.length ? Math.round((fast / answered.length) * 100) : null };
}

/* ---------- Proposer une idée ---------- */

function idQuick(preset = {}) {
  const sites = OPERATIONAL_SITES.filter((s) => osWritable(s.id) && allowedSite(s.id, true));
  if (!sites.length || role().readonly) return toast("Votre profil ne permet pas de proposer une idée ici.");
  let siteId = preset.site_id && sites.some((s) => s.id === preset.site_id) ? preset.site_id : state.site !== "group" && sites.some((s) => s.id === state.site) ? state.site : sites[0].id, photo = "", self = false;
  const zones = (sid) => `<option value="">Où ? (facultatif)</option>${(data.zones || []).filter((z) => z.site_id === sid && !z.archived_at).map((z) => `<option value="${esc(z.id)}">${esc(z.name)}</option>`).join("")}`;
  modal("Proposer une idée", `<form id="idForm" class="jn-form"><p class="jn-lead">Une photo, une phrase : votre responsable vous répond sous 48 heures.</p>
    <div class="cs-tag-photo" id="idPhoto"></div><input type="file" id="idFile" accept="image/*" capture="environment" hidden>
    <label class="field">Ce qui ne va pas<input id="idProblem" required placeholder="Ex. je marche 3 fois par heure chercher les vis" autocomplete="off"></label>
    <label class="field">Mon idée<input id="idIdea" placeholder="Ex. un bac de vis au poste" autocomplete="off"></label>
    <div class="ap-field"><span class="metric-label">Qui peut le faire ?</span><div class="tm-colors"><button type="button" class="tm-cbtn id-self" data-id-self="1" aria-pressed="false">Je peux le faire moi-même</button><button type="button" class="tm-cbtn id-self on" data-id-self="0" aria-pressed="true">Il faut de l’aide</button></div></div>
    ${sites.length > 1 ? `<label class="field">Site<select id="idSite">${sites.map((s) => `<option value="${s.id}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <label class="field">Zone<select id="idZone">${zones(siteId)}</select></label>
    <label class="field">Votre nom<input id="idName" list="ownerList" required value="${esc(apMe() || "")}" autocomplete="name">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Envoyer l’idée</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const draw = () => { const box = $("idPhoto"); box.innerHTML = photo ? `<figure class="cp-ph cs-tag-ph">${phImg(photo, "cp-ph-img", "Situation")}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-del aria-label="Retirer la photo">×</button></span></figure>` : '<button type="button" class="cp-ph-add cs-tag-ph" data-add><b>Photo</b><span>de la situation</span></button>'; box.querySelector("[data-add]")?.addEventListener("click", () => $("idFile").click()); box.querySelector("[data-del]")?.addEventListener("click", () => { photo = ""; draw(); }); phFill(box); };
  draw();
  $("idFile").onchange = async () => { const f = $("idFile").files?.[0]; $("idFile").value = ""; if (!f) return; try { photo = await phStore(await imageDataUrl(f)); draw(); $("idProblem").focus(); } catch (error) { toast(error.message); } };
  $("modalContent").querySelectorAll("[data-id-self]").forEach((b) => (b.onclick = () => { self = b.dataset.idSelf === "1"; $("modalContent").querySelectorAll("[data-id-self]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  if ($("idSite")) $("idSite").onchange = () => { siteId = $("idSite").value; $("idZone").innerHTML = zones(siteId); };
  setTimeout(() => $("idProblem")?.focus(), 0);
  $("idForm").onsubmit = (e) => {
    e.preventDefault();
    const problem = $("idProblem").value.trim(), idea = $("idIdea").value.trim(), name = $("idName").value.trim();
    if (!problem) { $("idProblem").focus(); return toast("Dites en une phrase ce qui ne va pas."); }
    if (!name) { $("idName").focus(); return toast("Votre nom, pour vous répondre."); }
    const title = (idea || problem).replace(/\s+/g, " ").slice(0, 90);
    let kid = null;
    if (!commitData(() => {
      data.kaizens ||= [];
      kid = auNext("KAI", data.kaizens);
      data.kaizens.unshift({ id: kid, site_id: siteId, workshop_id: state.workshop || null, zone_id: $("idZone").value || null, title, problem, solution: idea, status: "Idée", owner: self ? name : "", proposer: name, self, before_photo: photo, due_date: null, created_at: now(), updated_at: now(), kudos: [], ...preset.extra });
    })) return;
    idSetMe(name);
    modalDirty = false;
    closeModal();
    render();
    toast(`Merci ${name.split(" ")[0]} : idée ${kid} envoyée. Réponse sous 48 heures.`);
  };
}

/* ---------- Répondre, réaliser, valider ---------- */

function idGo(id) {
  const k = idGet(id);
  if (!k || !idMgr(k)) return;
  modal("On le fait", `<form id="idGoForm" class="jn-form sm-new"><p class="jn-lead">${esc(k.title)} <span class="hint">${esc(k.id)} · ${esc(k.proposer || "")}</span></p>
    <label class="field">Qui le fait ?<input id="idOwner" list="ownerList" required value="${esc(k.owner || k.proposer || "")}">${ownerDatalist()}</label>
    <div class="cs-who-when"><label>Pour quand ?<input type="date" id="idDue" min="${today()}" value="${esc(k.due_date || auAddDays(k.self ? 7 : 14))}"></label><label>Réponse donnée par<input id="idBy" list="ownerList" value="${esc(apMe() || "")}"></label></div>
    <div class="form-actions"><button class="btn jn-big">Valider la réponse</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("idGoForm").onsubmit = (e) => {
    e.preventDefault();
    const owner = $("idOwner").value.trim(), due = $("idDue").value, by = $("idBy").value.trim();
    if (!owner || !due) return toast("Précisez qui le fait et pour quand.");
    if (!idSave(id, (x) => { x.owner = owner; x.due_date = due; x.status = "Mise en œuvre"; x.decision = { verdict: "go", by, at: now() }; })) return;
    idSetMe(by); closeModal(); render(); toast(`Réponse envoyée à ${k.proposer || "l’auteur"} : on le fait.`);
  };
}
function idNo(id) {
  const k = idGet(id);
  if (!k || !idMgr(k)) return;
  let reason = "";
  modal("Pas maintenant", `<form id="idNoForm" class="jn-form"><p class="jn-lead">${esc(k.title)} <span class="hint">${esc(k.id)} · ${esc(k.proposer || "")}</span></p><p class="hint">Une réponse claire vaut mieux qu’un silence : l’auteur la verra.</p>
    <div class="ap-field"><span class="metric-label">Pourquoi ?</span><div class="filters">${ID_NO.map((r) => `<button type="button" class="chip" data-id-reason="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("")}</div></div>
    <label class="field">Un mot pour l’auteur<input id="idNoText" placeholder="Ex. prévu avec le nouveau poste en janvier"></label>
    <label class="field">Réponse donnée par<input id="idNoBy" list="ownerList" value="${esc(apMe() || "")}">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Envoyer la réponse</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("modalContent").querySelectorAll("[data-id-reason]").forEach((b) => (b.onclick = () => { reason = b.dataset.idReason; $("modalContent").querySelectorAll("[data-id-reason]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  $("idNoForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("idNoText").value.trim(), by = $("idNoBy").value.trim();
    if (!reason && !text) return toast("Donnez la raison à l’auteur.");
    if (!idSave(id, (x) => { x.decision = { verdict: "no", reason: [reason, text].filter(Boolean).join(" · "), by, at: now() }; })) return;
    idSetMe(by); closeModal(); render(); toast("Réponse envoyée.");
  };
}
function idDoneForm(id) {
  const k = idGet(id);
  if (!k || !idWritable(k)) return;
  let photo = k.after_photo || "";
  modal("C’est fait", `<form id="idDoneForm" class="jn-form"><p class="jn-lead">${esc(k.title)} <span class="hint">${esc(k.id)}</span></p>
    <div class="id-ba"><figure>${idPhoto(k.before_photo, "id-ba-img", "Avant") || '<span class="id-ba-img id-nophoto">Pas de photo avant</span>'}<figcaption>Avant</figcaption></figure><figure><div class="cs-tag-photo" id="idAfter"></div><figcaption>Après</figcaption></figure></div><input type="file" id="idAfterFile" accept="image/*" capture="environment" hidden>
    <label class="field">Ce que ça a changé<input id="idResult" required value="${esc(k.result || "")}" placeholder="Ex. plus de déplacement, 10 min gagnées par poste"></label>
    <div class="form-actions"><button class="btn jn-big">C’est fait</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const draw = () => { const box = $("idAfter"); box.innerHTML = photo ? `<figure class="cp-ph cs-tag-ph">${phImg(photo, "cp-ph-img", "Après")}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-del aria-label="Retirer la photo">×</button></span></figure>` : '<button type="button" class="cp-ph-add cs-tag-ph" data-add><b>Photo</b><span>après</span></button>'; box.querySelector("[data-add]")?.addEventListener("click", () => $("idAfterFile").click()); box.querySelector("[data-del]")?.addEventListener("click", () => { photo = ""; draw(); }); phFill(box); };
  draw(); phFill($("modalContent"));
  $("idAfterFile").onchange = async () => { const f = $("idAfterFile").files?.[0]; $("idAfterFile").value = ""; if (!f) return; try { photo = await phStore(await imageDataUrl(f)); draw(); } catch (error) { toast(error.message); } };
  $("idDoneForm").onsubmit = (e) => {
    e.preventDefault();
    const result = $("idResult").value.trim();
    if (!result) { $("idResult").focus(); return toast("Dites ce que ça a changé."); }
    if (!idSave(id, (x) => { x.after_photo = photo; x.result = result; x.status = "Mesure"; x.done_at = now(); if (!x.decision) x.decision = { verdict: "go", by: apMe() || "", at: now() }; })) return;
    closeModal(); render(); toast("Bravo : l’idée est réalisée.");
    idSheet(id);
  };
}
function idSheet(id) {
  const k = idGet(id);
  if (!k) return;
  modal("Fiche Kaizen", `<article class="id-sheet"><header><div><small>KAIZEN · UNE IDÉE, UNE AMÉLIORATION</small><h3>${esc(k.title)}</h3><p>${esc(getSiteName(k.site_id))}${k.zone_id ? ` · ${esc((data.zones || []).find((z) => z.id === k.zone_id)?.name || "")}` : ""} · ${esc(k.id)}</p></div><b class="id-author">${esc(k.proposer || k.owner || "")}</b></header>
    <div class="id-ba big"><figure>${idPhoto(k.before_photo, "id-ba-img", "Avant") || '<span class="id-ba-img id-nophoto">Avant</span>'}<figcaption>Avant</figcaption></figure><figure>${idPhoto(k.after_photo, "id-ba-img", "Après") || '<span class="id-ba-img id-nophoto">Après</span>'}<figcaption>Après</figcaption></figure></div>
    <dl class="id-dl"><div><dt>Le problème</dt><dd>${esc(k.problem || "")}</dd></div><div><dt>L’idée</dt><dd>${esc(k.solution || k.title)}</dd></div><div><dt>Le résultat</dt><dd>${esc(k.result || "À mesurer")}</dd></div></dl>
    <footer>${(k.kudos || []).length ? `${jnPlural(k.kudos.length, "bravo", "bravos")} · ` : ""}${k.done_at ? `Réalisée le ${shortDate(k.done_at)}` : "En cours"}${k.validated_by ? ` · gain validé par ${esc(k.validated_by)}` : ""}</footer></article>
    <style media="print">@page{size:A4;margin:10mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
  phFill($("modalContent"));
}

/* ---------- Page Idées ---------- */

function idShareBtn(k) {
  if (typeof bpCan !== "function" || !bpCan() || !["Gain validé", "Standardisation", "Bonne pratique", "Déploiement"].includes(k.status) || !idWritable(k) || (data.practices || []).some((p) => p.source_id === k.id && !p.archived_at)) return "";
  return `<button type="button" class="btn small secondary" data-id-share="${esc(k.id)}">Partager aux sites</button>`;
}
function idCard(k, mode) {
  const h = idHours(k), late = idWaiting(k) && h > 48, mgr = idMgr(k), w = idWritable(k);
  const status = idRefused(k) ? `<span class="id-st no">Pas maintenant</span>` : idWaiting(k) ? `<span class="id-st wait ${late ? "late" : ""}">${late ? "Sans réponse depuis " : "En attente · "}${idAge(h)}</span>` : idDone(k) ? `<span class="id-st done">${k.status === "Mesure" ? "Réalisée" : esc(k.status)}</span>` : `<span class="id-st go">On le fait${k.due_date ? ` · ${shortDate(k.due_date).slice(0, 5)}` : ""}</span>`;
  const acts = mode === "wait" && mgr ? `<button type="button" class="btn small" data-id-go="${esc(k.id)}">On le fait</button><button type="button" class="btn small secondary" data-id-no="${esc(k.id)}">Pas maintenant</button>`
    : idInProgress(k) && w ? `<button type="button" class="btn small" data-id-done="${esc(k.id)}">C’est fait</button>`
      : idDone(k) ? `${k.status === "Mesure" && mgr ? `<button type="button" class="btn small" data-id-validate="${esc(k.id)}">Valider le gain</button>` : ""}<button type="button" class="btn small ghost" data-id-kudo="${esc(k.id)}" aria-label="Bravo">👏 ${(k.kudos || []).length || ""}</button><button type="button" class="btn small ghost" data-id-sheet="${esc(k.id)}">Fiche</button>${idShareBtn(k)}` : "";
  return `<article class="id-card ${late ? "late" : ""}">${k.before_photo || k.after_photo ? `<div class="id-photos">${idPhoto(k.before_photo, "id-thumb", "Avant")}${idPhoto(k.after_photo, "id-thumb", "Après")}</div>` : ""}<div class="id-main"><div class="id-top">${status}<span class="hint">${esc(k.proposer || k.owner || "")} · ${esc(getSiteName(k.site_id))}</span></div><b>${esc(k.title)}</b>${k.problem && k.problem !== k.title ? `<p class="id-pb">${esc(k.problem)}</p>` : ""}${idRefused(k) ? `<p class="id-reason">${esc(k.decision.reason || "")}${k.decision.by ? ` · ${esc(k.decision.by)}` : ""}</p>` : ""}${k.result ? `<p class="id-res">${esc(k.result)}</p>` : ""}<div class="id-acts">${acts}<button type="button" class="md-link" data-open-record="${esc(k.id)}">${esc(k.id)}</button></div></div></article>`;
}
function idPage() {
  const rows = idRows(), m = idMonth(rows), writable = OPERATIONAL_SITES.some((s) => osWritable(s.id)) && !role().readonly, mgr = osManager() && !role().readonly;
  const wait = rows.filter(idWaiting).sort((a, b) => idHours(b) - idHours(a)), mine = rows.filter(idMine).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 6);
  const prog = rows.filter(idInProgress).sort((a, b) => String(a.due_date || "9").localeCompare(String(b.due_date || "9"))), done = rows.filter(idDone).sort((a, b) => String(b.done_at || b.updated_at).localeCompare(String(a.done_at || a.updated_at))).slice(0, 12);
  const head = pageHead("Résoudre", "Idées et Kaizen", "Une idée en 30 secondes, une réponse sous 48 heures, et les améliorations réalisées à la vue de tous.", writable ? '<button type="button" class="btn" data-id-new>Proposer une idée</button>' : "");
  const tabs = `<div class="filters id-tabs"><button type="button" class="chip active" data-id-tab="idees">Idées</button><button type="button" class="chip" data-id-tab="registre">Registre et gains</button></div>`;
  const strip = `<div class="cs-summary"><div><b>${m.n}</b><span>idée${m.n > 1 ? "s" : ""} ce mois</span></div><div class="${m.late ? "bad" : ""}"><b>${m.waiting}</b><span>en attente${m.late ? ` · ${m.late} > 48 h` : ""}</span></div><div><b>${m.fast === null ? "—" : `${m.fast} %`}</b><span>réponses sous 48 h</span></div><div><b>${m.done}</b><span>réalisée${m.done > 1 ? "s" : ""} ce mois</span></div></div>`;
  const sec = (title, list, mode, empty) => `<section class="section"><div class="section-title"><h2>${title} · ${list.length}</h2></div>${list.length ? `<div class="id-list">${list.map((k) => idCard(k, mode)).join("")}</div>` : `<p class="hint">${empty}</p>`}</section>`;
  return `${head}${tabs}${strip}${mgr ? sec("À répondre", wait, "wait", "Toutes les idées ont une réponse.") : ""}${mine.length ? sec("Mes idées", mine, "mine", "") : ""}${sec("On le fait", prog, "go", "Aucune idée en cours de réalisation.")}
    <section class="section"><div class="section-title"><h2>Le mur des idées réalisées</h2></div>${done.length ? `<div class="id-wall">${done.map((k) => `<article class="id-tile"><div class="id-ba">${idPhoto(k.before_photo, "id-ba-img", "Avant") || '<span class="id-ba-img id-nophoto">Avant</span>'}${idPhoto(k.after_photo, "id-ba-img", "Après") || '<span class="id-ba-img id-nophoto">Après</span>'}</div><b>${esc(k.title)}</b><span class="hint">${esc(k.proposer || k.owner || "")} · ${esc(getSiteName(k.site_id))}</span>${k.result ? `<p class="id-res">${esc(k.result)}</p>` : ""}<div class="id-acts"><button type="button" class="btn small ghost" data-id-kudo="${esc(k.id)}" aria-label="Bravo">👏 ${(k.kudos || []).length || ""}</button><button type="button" class="btn small ghost" data-id-sheet="${esc(k.id)}">Fiche</button>${k.status === "Mesure" && idMgr(k) ? `<button type="button" class="btn small" data-id-validate="${esc(k.id)}">Valider le gain</button>` : ""}${idShareBtn(k)}</div></article>`).join("")}</div>` : '<p class="hint">Les idées réalisées apparaîtront ici, avec leur photo avant et après.</p>'}</section>
    ${rows.some(idRefused) ? `<details class="ik-out section"><summary>Pas maintenant · ${rows.filter(idRefused).length}</summary><div class="id-list">${rows.filter(idRefused).map((k) => idCard(k, "no")).join("")}</div></details>` : ""}`;
}

/* ---------- Branchements ---------- */

state.idTab ||= "idees";
const idRenderKaizenBase = renderOSKaizen;
renderOSKaizen = function () {
  if (!idCan() || state.idTab === "registre") {
    const base = idRenderKaizenBase.apply(this, arguments);
    if (!idCan()) return base;
    const tpl = document.createElement("template");
    tpl.innerHTML = base;
    const chips = '<div class="filters id-tabs"><button type="button" class="chip" data-id-tab="idees">Idées</button><button type="button" class="chip active" data-id-tab="registre">Registre et gains</button></div>';
    const head = tpl.content.querySelector(".page-head");
    if (head) head.insertAdjacentHTML("afterend", chips); else tpl.content.prepend(document.createRange().createContextualFragment(chips));
    return tpl.innerHTML;
  }
  return idPage();
};
const idOsFormBase = osForm;
osForm = function (key, id = null, preset = {}) {
  if (key === "kaizens" && !id && idCan() && !Object.keys(preset || {}).length) return idQuick();
  return idOsFormBase.apply(this, arguments);
};
const idWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = idWatchBase();
  if (!idCan()) return base;
  const rows = [];
  if (osManager()) { const late = idRows().filter((k) => idWaiting(k) && idHours(k) > 48 && allowedSite(k.site_id, true)); if (late.length) rows.push(`<button type="button" class="jn-row" data-id-goto><span class="jn-row-main"><span class="jn-tag tone-warn">Idées</span><b>${jnPlural(late.length, "idée sans réponse", "idées sans réponse")} depuis plus de 48 h</b><span class="hint">Une réponse, même « pas maintenant », entretient les idées</span></span></button>`); }
  if (!rows.length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${rows.join("")}$2`);
};
/* Sur l'accueil, sous « Un problème au poste ? » : les réponses à mes idées (opérateurs compris). */
const idSignalBase = jnSignalCard;
jnSignalCard = function () {
  const base = idSignalBase.apply(this, arguments);
  if (!idCan() || !base) return base;
  const mine = idRows().filter((k) => idMine(k) && (idWaiting(k) || (k.decision && Date.now() - Date.parse(k.decision.at) < 14 * 864e5))).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 3);
  if (!mine.length) return base;
  const rows = mine.map((k) => `<button type="button" class="jn-row" data-id-goto><span class="jn-row-main"><span class="jn-tag ${idRefused(k) ? "" : idWaiting(k) ? "tone-warn" : "tone-ok"}">Mon idée</span><b>${esc(k.title)}</b><span class="hint">${idWaiting(k) ? `En attente de réponse · ${idAge(idHours(k))}` : idRefused(k) ? `Pas maintenant : ${esc(k.decision.reason || "")}` : idDone(k) ? "Réalisée, bravo" : `On le fait${k.owner ? ` · ${esc(k.owner)}` : ""}${k.due_date ? ` · ${shortDate(k.due_date)}` : ""}`}</span></span></button>`).join("");
  return base.replace(/<\/section>\s*$/, `<div class="jn-rows id-mine">${rows}</div></section>`);
};
function idBind(root = document) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = () => fn(b)));
  on("[data-id-new]", () => idQuick());
  on("[data-id-go]", (b) => idGo(b.dataset.idGo));
  on("[data-id-no]", (b) => idNo(b.dataset.idNo));
  on("[data-id-done]", (b) => idDoneForm(b.dataset.idDone));
  on("[data-id-sheet]", (b) => idSheet(b.dataset.idSheet));
  on("[data-id-share]", (b) => osCreateFrom(b.dataset.idShare, "practice"));
  on("[data-id-tab]", (b) => { state.idTab = b.dataset.idTab; render(); });
  on("[data-id-goto]", () => { state.idTab = "idees"; switchView("kaizen"); });
  on("[data-id-kudo]", (b) => { const me = apMe() || role().label; if (!idSave(b.dataset.idKudo, (k) => { k.kudos ||= []; if (!k.kudos.some((x) => x.by === me)) k.kudos.push({ by: me, at: now() }); })) return; render(); });
  on("[data-id-validate]", (b) => { const by = apMe() || role().label; if (!idSave(b.dataset.idValidate, (k) => { k.status = "Gain validé"; k.validated_by = by; })) return; render(); toast("Gain validé."); });
}
const idOsBindBase = osBind;
osBind = function () { const out = idOsBindBase.apply(this, arguments); idBind(document); return out; };
