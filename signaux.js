"use strict";
/*
 * BIA Lean OS 8.23 · Signal terrain : signaler en 20 secondes, prise en charge à l'heure, réponse à l'auteur.
 *  - Signaler : photo d'abord, une phrase, « C'est… » (un danger, ça bloque, à traiter), le thème, où, le nom.
 *    Un danger demande ce qui a été fait tout de suite (machine arrêtée, zone balisée, chef prévenu).
 *  - Prise en charge attendue à l'heure près : 15 min pour un danger, 1 h si ça bloque, 4 h sinon. Au-delà,
 *    le signal est en retard et remonte sur l'accueil des responsables.
 *  - Côté responsable : « À prendre en charge » en tête des signaux, « Je m'en occupe » en un geste, « Réglé »
 *    avec ce qui a été fait ; « Ça revient » quand un même problème revient trois fois en 30 jours au même endroit.
 *  - Côté auteur : « Mes signaux » sur l'accueil et sur la page, avec où en est chacun et ce qui a été fait.
 *  - Le formulaire complet et le circuit vérifié (résolu, vérifié, clos) restent inchangés.
 * Données : signals[] (indexée) : champs ajoutés ack_due_at, taken_by, stopped ; author = le nom saisi.
 */

const SG_ACK_MIN = { Critique: 15, Haute: 60, Normale: 240, "À qualifier": 240 };
const SG_URG = [["Critique", "Un danger", "pour quelqu’un, tout de suite"], ["Haute", "Ça bloque", "la production ou la qualité"], ["Normale", "À traiter", "sans urgence"]];
const SG_NOW = ["Machine arrêtée", "Zone balisée", "Chef prévenu", "Personne mise en sécurité"];

function sgCanTake(s) { return !role().readonly && osManager() && allowedSite(s.site_id, true) && osWritable(s.site_id); }
function sgAckDue(s) { return s.ack_due_at || new Date(Date.parse(s.created_at || now()) + (SG_ACK_MIN[s.severity] || 240) * 6e4).toISOString(); }
function sgWaiting(s) { return isOpenSignal(s) && s.state === "Nouveau"; }
function sgLate(s) { return sgWaiting(s) && Date.now() > Date.parse(sgAckDue(s)); }
function sgDur(ms) { const m = Math.max(0, Math.round(ms / 6e4)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 48) return `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`; return `${Math.floor(h / 24)} j`; }
function sgClock(iso) { const d = new Date(iso), t = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); return d.toISOString().slice(0, 10) === today() ? t : `${shortDate(iso)} ${t}`; }
function sgMine(s) { const me = apMe(); return !!me && s.author === me; }
function sgSave(id, fn, note) { const ok = commitData(() => { const s = data.signals.find((x) => x.id === id); fn(s); s.updated_at = now(); recordHistory(s, s.state, note || ""); }); if (ok) modalDirty = false; return ok; }
function sgOwnerDefault() { return { operator: "Chef d’équipe du périmètre", teamlead: "Chef d’équipe", director: "Direction de site", lean: "Responsable Lean", dg: "Direction de site" }[state.role] || "Chef d’équipe du périmètre"; }
function sgStatus(s) {
  if (s.state === "Nouveau") return sgLate(s) ? `En attente de prise en charge depuis ${sgDur(Date.now() - Date.parse(s.created_at))}, en retard` : `Envoyé à ${s.owner || "votre responsable"} · prise en charge avant ${sgClock(sgAckDue(s))}`;
  if (s.state === "Pris en compte") return `Pris en charge par ${s.taken_by || s.owner || "le responsable"}${s.taken_at ? ` à ${sgClock(s.taken_at)}` : ""}`;
  if (s.state === "Action en cours") { const a = s.action_id && data.actions.find((x) => x.id === s.action_id); return a ? `Action en cours : ${a.title}${a.due_date ? `, pour le ${shortDate(a.due_date)}` : ""}` : "Action en cours"; }
  if (["Résolu", "Vérifié"].includes(s.state)) return `Réglé${s.resolution ? ` : ${s.resolution}` : ""}`;
  return `Clos${s.resolution ? ` : ${s.resolution}` : ""}`;
}
function sgTone(s) { return s.state === "Nouveau" ? (sgLate(s) ? "tone-critical" : "tone-warn") : ["Résolu", "Vérifié", "Clos"].includes(s.state) ? "tone-ok" : ""; }

/* ---------- Signaler ---------- */

function sgQuick(preset = {}) {
  const siteId = preset.site_id || (state.site === "group" ? "marzin" : state.site), sites = OPERATIONAL_SITES.filter((s) => allowedSite(s.id, true));
  if (!allowedSite(siteId, true) && !sites.length) return toast("Votre profil ne permet pas de signaler ici.");
  let photo = "", sev = "", type = "", now1 = "";
  const places = (sid) => [...new Set([...(data.zones || []).filter((z) => z.site_id === sid && !z.archived_at).map((z) => z.name), ...(data.machines || []).filter((m) => m.site_id === sid && !m.archived_at).map((m) => m.name), ...data.workshops.filter((w) => w.site_id === sid).map((w) => w.name)].filter(Boolean))].map((n) => `<option value="${esc(n)}"></option>`).join("");
  modal("Signaler", `<form id="signalForm" class="jn-form sg-form"><p class="jn-lead">Une photo, une phrase : votre responsable est prévenu tout de suite.</p>
    <div class="cs-tag-photo" id="sgPhoto"></div><input type="file" id="sgFile" accept="image/*" capture="environment" hidden>
    <label class="field">Que se passe-t-il ?<textarea id="signalDescription" rows="2" required placeholder="Ex. le guide de la scie bouge pendant la coupe">${esc(preset.description || "")}</textarea></label>
    <div class="ap-field"><span class="metric-label">C’est…</span><div class="sg-urg">${SG_URG.map(([k, l, d]) => `<button type="button" class="sg-u u-${k === "Critique" ? "crit" : k === "Haute" ? "high" : "low"}" data-sg-sev="${k}" aria-pressed="false"><b>${l}</b><span>${d}</span></button>`).join("")}</div></div>
    <div class="sg-danger" hidden><p><b>Mettez-vous en sécurité.</b> Arrêtez la machine si besoin et prévenez votre chef de vive voix.</p><span class="metric-label">Qu’avez-vous fait tout de suite ?</span><div class="filters">${SG_NOW.map((x) => `<button type="button" class="chip" data-sg-now="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join("")}</div></div>
    <div class="ap-field"><span class="metric-label">Thème</span><div class="filters">${SIGNAL_TYPES.map((x) => `<button type="button" class="chip" data-sg-type="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join("")}</div></div>
    <label class="field">Où ?<input id="signalZone" list="sgPlaces" placeholder="Poste, machine, zone" autocomplete="off"><datalist id="sgPlaces">${places(siteId)}</datalist></label>
    <label class="field" ${sites.length > 1 ? "" : "hidden"}>Site<select id="signalSite">${siteOptions(siteId)}</select></label>
    <label class="field">Votre nom<input id="signalAuthor" list="ownerList" value="${esc(apMe() || "")}" placeholder="Pour vous répondre" autocomplete="name">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Envoyer le signal</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("signalForm");
  const draw = () => { const box = $("sgPhoto"); box.innerHTML = photo ? `<figure class="cp-ph cs-tag-ph">${phImg(photo, "cp-ph-img", "Situation")}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-del aria-label="Retirer la photo">×</button></span></figure>` : '<button type="button" class="cp-ph-add cs-tag-ph" data-add><b>Photo</b><span>de la situation</span></button>'; box.querySelector("[data-add]")?.addEventListener("click", () => $("sgFile").click()); box.querySelector("[data-del]")?.addEventListener("click", () => { photo = ""; draw(); }); phFill(box); };
  draw();
  $("sgFile").onchange = async () => { const f = $("sgFile").files?.[0]; $("sgFile").value = ""; if (!f) return; try { photo = await phStore(await imageDataUrl(f)); modalDirty = true; draw(); $("signalDescription").focus(); } catch (error) { toast(error.message); } };
  const pick = (attr, set) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { const on = b.getAttribute("aria-pressed") !== "true"; root.querySelectorAll(`[${attr}]`).forEach((x) => { const me = x === b && on; x.classList.toggle("active", me); x.classList.toggle("on", me); x.setAttribute("aria-pressed", String(me)); }); set(on ? b.getAttribute(attr) : ""); modalDirty = true; }));
  pick("data-sg-sev", (v) => { sev = v; root.querySelector(".sg-danger").hidden = v !== "Critique"; });
  pick("data-sg-type", (v) => { type = v; });
  pick("data-sg-now", (v) => { now1 = v; });
  $("signalSite").onchange = () => { $("sgPlaces").innerHTML = places($("signalSite").value); };
  setTimeout(() => $("signalDescription")?.focus(), 0);
  root.onsubmit = (e) => {
    e.preventDefault();
    const description = $("signalDescription").value.trim(), site = $("signalSite").value, author = $("signalAuthor").value.trim();
    if (!description) { $("signalDescription").focus(); return toast("Dites en une phrase ce qui se passe."); }
    if (!allowedSite(site, true)) return toast("Site hors de votre périmètre.");
    const severity = sev || "À qualifier", createdAt = now();
    let id = null;
    if (!commitData(() => {
      id = nextId("S", data.signals);
      const row = { id, site_id: site, workshop_id: site === state.site ? state.workshop || null : null, type: type || "Production", severity, description, zone: $("signalZone").value.trim(), author: author || osActor(), owner: sgOwnerDefault(), immediate_action: now1, photo, stopped: severity === "Haute", state: "Nouveau", response_due: signalResponseDue(severity, createdAt), ack_due_at: new Date(Date.parse(createdAt) + (SG_ACK_MIN[severity] || 240) * 6e4).toISOString(), created_at: createdAt, updated_at: createdAt };
      recordHistory(row, "Nouveau", "Signal envoyé");
      data.signals.unshift(row);
    })) return;
    if (author && typeof idSetMe === "function") idSetMe(author);
    modalDirty = false;
    render();
    sgSent(id);
  };
}
function sgSent(id) {
  const s = data.signals.find((x) => x.id === id);
  if (!s) return;
  modal("Signal envoyé", `<div class="sg-sent ${s.severity === "Critique" ? "crit" : ""}"><b>${esc(s.id)} est envoyé à ${esc(s.owner)}.</b><p>Prise en charge attendue avant <b>${sgClock(sgAckDue(s))}</b>. Vous verrez la réponse dans « Mes signaux », sur l’accueil.</p>${s.severity === "Critique" ? "<p>Danger : restez en sécurité et prévenez votre chef de vive voix, sans attendre.</p>" : ""}</div>
    <div class="form-actions"><button type="button" class="btn" data-close-modal>Fermer</button><button type="button" class="btn ghost" data-sg-again>Signaler autre chose</button></div>`);
  $("modalContent").querySelector("[data-sg-again]").onclick = () => sgQuick({ site_id: s.site_id });
}

/* ---------- Prendre en charge, régler ---------- */

function sgTake(id) {
  const s = data.signals.find((x) => x.id === id);
  if (!s || !sgCanTake(s) || s.state !== "Nouveau") return;
  const me = apMe() || osActor();
  if (!sgSave(id, (x) => { x.state = "Pris en compte"; x.owner = me; x.taken_by = me; x.taken_at = now(); }, `Pris en charge par ${me}`)) return;
  toast(`${id} : pris en charge par ${me}.`);
  return true;
}
function sgFixForm(id) {
  const s = data.signals.find((x) => x.id === id);
  if (!s || !sgCanTake(s) || !["Nouveau", "Pris en compte", "Action en cours"].includes(s.state)) return;
  if (linkedActions(id).some(isOpenAction)) return toast("Une action liée est encore ouverte : terminez-la, puis déclarez le signal réglé.");
  modal("Réglé", `<form id="sgFixForm" class="jn-form"><p class="jn-lead">${esc(s.description)} <span class="hint">${esc(s.id)} · ${esc(s.author || "")}</span></p>
    <label class="field">Qu’avez-vous fait ?<input id="sgFixText" required placeholder="Ex. guide resserré et contrôlé sur trois coupes" autocomplete="off"></label>
    <label class="field">Par<input id="sgFixBy" list="ownerList" value="${esc(apMe() || osActor())}">${ownerDatalist()}</label>
    <p class="hint">L’auteur verra votre réponse. Le signal reste à vérifier avant d’être clos.</p>
    <div class="form-actions"><button class="btn jn-big">C’est réglé</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("sgFixText")?.focus(), 0);
  $("sgFixForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("sgFixText").value.trim(), by = $("sgFixBy").value.trim() || osActor();
    if (!text) return toast("Dites ce qui a été fait.");
    if (!sgSave(id, (x) => { if (!x.taken_at) { x.taken_at = now(); x.taken_by = by; } x.owner = by; x.state = "Résolu"; x.resolution = text; x.resolved_at = now(); }, text)) return;
    if (typeof idSetMe === "function") idSetMe(by);
    closeModal(); render(); toast(`${id} réglé : l’auteur voit la réponse.`);
  };
}
function sgRepeats() {
  const from = Date.now() - 30 * 864e5, groups = new Map();
  scoped(data.signals).filter((s) => !s.archived_at && Date.parse(s.created_at) >= from && String(s.zone || "").trim()).forEach((s) => { const k = `${s.site_id}|${s.type}|${String(s.zone).trim().toLowerCase()}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  return [...groups.values()].filter((g) => g.length >= 3 && !g.some((s) => s.problem_id)).sort((a, b) => b.length - a.length).slice(0, 3);
}
function sgRepeatProblem(ids) {
  const rows = ids.map((id) => data.signals.find((s) => s.id === id)).filter(Boolean), s = rows[0];
  if (!s) return;
  genericProblemForm({ site_id: s.site_id, title: `${s.type} · ${s.zone} : ${rows.length} signaux en 30 jours`, description: rows.map((x) => `${shortDate(x.created_at)} · ${x.description}`).join("\n"), signal_id: s.id, origin_id: s.id, owner: s.owner || "", method: "QRQC" });
}

/* ---------- Affichage ---------- */

function sgRow(s, mode) {
  const late = sgLate(s), take = mode === "take" && sgCanTake(s);
  return `<div class="sg-row ${late ? "late" : ""} sev-${s.severity === "Critique" ? "crit" : s.severity === "Haute" ? "high" : "low"}">${s.photo ? phImg(s.photo, "sg-thumb", "Photo") : ""}<button type="button" class="sg-main" data-open-signal="${esc(s.id)}"><span class="id-top"><span class="sg-sev">${esc(s.severity)}</span><span class="hint">${esc(s.id)} · ${esc([s.zone, getSiteName(s.site_id)].filter(Boolean).join(" · "))}</span></span><b>${esc(s.description)}</b><span class="hint ${late ? "sg-late" : ""}">${mode === "take" ? `${esc(s.author || "")} · il y a ${sgDur(Date.now() - Date.parse(s.created_at))}${late ? ` · en retard de ${sgDur(Date.now() - Date.parse(sgAckDue(s)))}` : ` · à prendre avant ${sgClock(sgAckDue(s))}`}` : esc(sgStatus(s))}</span></button>${take ? `<button type="button" class="btn small" data-sg-take="${esc(s.id)}">Je m’en occupe</button>` : ""}</div>`;
}
function sgPanel() {
  const parts = [], mgr = osManager() && !role().readonly;
  if (mgr) {
    const wait = scoped(data.signals).filter(sgWaiting).sort((a, b) => (b.severity === "Critique") - (a.severity === "Critique") || Date.parse(sgAckDue(a)) - Date.parse(sgAckDue(b)));
    parts.push(`<section class="section sg-panel"><div class="section-title"><h2>À prendre en charge · ${wait.length}</h2></div>${wait.length ? `<div class="sg-list">${wait.map((s) => sgRow(s, "take")).join("")}</div>` : '<p class="hint">Tous les signaux ont été pris en charge.</p>'}</section>`);
    const rep = role().nav.includes("resolution") ? sgRepeats() : [];
    if (rep.length) parts.push(`<section class="section"><div class="section-title"><h2>Ça revient</h2></div><div class="sg-repeats">${rep.map((g) => `<div class="sg-rep"><b>${g.length} signaux · ${esc(g[0].type)} · ${esc(g[0].zone)}</b><span class="hint">${esc(getSiteName(g[0].site_id))} · 30 derniers jours · dernier le ${shortDate(g[0].created_at)}</span><button type="button" class="btn small secondary" data-sg-repeat="${esc(g.map((s) => s.id).join(","))}">Ouvrir un QRQC</button></div>`).join("")}</div></section>`);
  }
  const mine = scoped(data.signals).filter((s) => sgMine(s) && (isOpenSignal(s) || Date.now() - Date.parse(s.updated_at || s.created_at) < 14 * 864e5)).slice(0, 6);
  if (mine.length) parts.unshift(`<section class="section"><div class="section-title"><h2>Mes signaux · ${mine.length}</h2></div><div class="sg-list">${mine.map((s) => sgRow(s, "mine")).join("")}</div></section>`);
  return parts.join("");
}

/* ---------- Branchements ---------- */

const sgNewSignalBase = newSignalForm;
newSignalForm = function (existing = null) { return existing ? sgNewSignalBase.apply(this, arguments) : sgQuick(); };
const sgSignalCardBase = signalCard;
signalCard = function (s) {
  const html = sgSignalCardBase.apply(this, arguments);
  if (!isOpenSignal(s)) return html;
  const info = s.state === "Nouveau" ? `<div class="signal-due ${sgLate(s) ? "late" : ""}">${sgLate(s) ? `En retard de prise en charge (attendue avant ${sgClock(sgAckDue(s))})` : `Prise en charge attendue avant <b>${sgClock(sgAckDue(s))}</b>`} · ${esc(s.owner || "responsable à attribuer")}</div>` : `<div class="signal-due ok">${esc(sgStatus(s))}</div>`;
  const out = html.replace(/<div class="signal-due[^"]*">[\s\S]*?<\/div>/, info);
  return sgCanTake(s) && s.state === "Nouveau" ? out.replace(/<button class="btn small ghost" data-open-record="[^"]*">[^<]*<\/button>/, "").replace('<div class="row-actions">', `<div class="row-actions"><button class="btn small" data-sg-take="${esc(s.id)}">Je m’en occupe</button>`) : out;
};
const sgRenderTerrainBase = renderTerrain;
renderTerrain = function () {
  const html = sgRenderTerrainBase.apply(this, arguments);
  if (state.terrainTab !== "signals") return html;
  const panel = sgPanel();
  if (!panel) return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const anchor = tpl.content.querySelector(".filters") || tpl.content.querySelector(".page-head");
  if (!anchor) return html;
  anchor.insertAdjacentHTML(anchor.classList.contains("filters") ? "beforebegin" : "afterend", `${panel}<h2 class="sg-all">Tous les signaux</h2>`);
  return tpl.innerHTML;
};
const sgOpenSignalBase = openSignal;
openSignal = function (id) {
  const out = sgOpenSignalBase.apply(this, arguments), s = data.signals.find((x) => x.id === id), box = $("modalContent")?.querySelector(".signal-commitment");
  if (!s || !box) return out;
  const fix = sgCanTake(s) && ["Nouveau", "Pris en compte", "Action en cours"].includes(s.state) && !linkedActions(id).some(isOpenAction);
  box.outerHTML = `<div class="sg-ack ${sgLate(s) ? "late" : s.state === "Nouveau" ? "" : "ok"}"><span>${s.state === "Nouveau" ? "PRISE EN CHARGE ATTENDUE" : "OÙ EN EST-ON"}</span><b>${s.state === "Nouveau" ? `avant ${sgClock(sgAckDue(s))}${sgLate(s) ? ` · en retard de ${sgDur(Date.now() - Date.parse(sgAckDue(s)))}` : ""}` : esc(sgStatus(s))}</b>${s.taken_at ? `<small>Pris en charge en ${sgDur(Date.parse(s.taken_at) - Date.parse(s.created_at))}${s.taken_by ? ` par ${esc(s.taken_by)}` : ""}</small>` : `<small>${esc(s.owner || "Responsable à attribuer")}</small>`}${s.immediate_action ? `<small>Fait tout de suite : ${esc(s.immediate_action)}</small>` : ""}</div>
    ${s.state === "Nouveau" && sgCanTake(s) || fix ? `<div class="sg-quick">${s.state === "Nouveau" && sgCanTake(s) ? `<button type="button" class="btn jn-big" data-sg-take="${esc(id)}">Je m’en occupe</button>` : ""}${fix ? `<button type="button" class="btn secondary" data-sg-fix="${esc(id)}">Réglé : dire ce qui a été fait</button>` : ""}</div>` : ""}`;
  sgBind($("modalContent"));
  return out;
};
const sgSignalCardHomeBase = jnSignalCard;
jnSignalCard = function () {
  const base = sgSignalCardHomeBase.apply(this, arguments);
  if (!base) return base;
  const mine = scoped(data.signals).filter((s) => sgMine(s) && (isOpenSignal(s) && s.state !== "Résolu" || Date.now() - Date.parse(s.updated_at || s.created_at) < 3 * 864e5)).slice(0, 3);
  if (!mine.length) return base;
  const rows = mine.map((s) => `<button type="button" class="jn-row" data-open-signal="${esc(s.id)}"><span class="jn-row-main"><span class="jn-tag ${sgTone(s)}">Mon signal</span><b>${esc(s.description)}</b><span class="hint">${esc(sgStatus(s))}</span></span></button>`).join("");
  return base.replace(/<\/section>\s*$/, `<div class="jn-rows sg-mine">${rows}</div></section>`);
};
const sgWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = sgWatchBase();
  if (!osManager() || role().readonly) return base;
  const late = scoped(data.signals).filter(sgLate).sort((a, b) => (b.severity === "Critique") - (a.severity === "Critique"));
  if (!late.length) return base;
  const crit = late.filter((s) => s.severity === "Critique").length;
  const row = `<button type="button" class="jn-row" data-open-signal="${esc(late[0].id)}"><span class="jn-row-main"><span class="jn-tag tone-critical">Signal</span><b>${jnPlural(late.length, "signal en retard de prise en charge", "signaux en retard de prise en charge")}${crit ? ` · ${crit} danger${crit > 1 ? "s" : ""}` : ""}</b><span class="hint">${esc(late[0].description)} · il y a ${sgDur(Date.now() - Date.parse(late[0].created_at))}</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace('<div class="jn-rows">', `<div class="jn-rows">${row}`);
};
function sgBind(root = document) {
  root.querySelectorAll("[data-sg-take]").forEach((b) => (b.onclick = () => { const id = b.dataset.sgTake, inModal = !!b.closest(".modal"); if (sgTake(id)) { render(); if (inModal) openSignal(id); } }));
  root.querySelectorAll("[data-sg-fix]").forEach((b) => (b.onclick = () => sgFixForm(b.dataset.sgFix)));
  root.querySelectorAll("[data-sg-repeat]").forEach((b) => (b.onclick = () => sgRepeatProblem(b.dataset.sgRepeat.split(","))));
  root.querySelectorAll(".sg-row [data-open-signal], .sg-mine [data-open-signal], .jn-watch [data-open-signal]").forEach((b) => (b.onclick = () => openSignal(b.dataset.openSignal)));
}
const sgOsBindBase = osBind;
osBind = function () { const out = sgOsBindBase.apply(this, arguments); sgBind(document); return out; };
