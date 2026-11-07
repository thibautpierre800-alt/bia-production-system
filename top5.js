"use strict";
/*
 * BIA Lean OS 8.43 · Le TOP 5 à l'écran de l'atelier, ce qui s'y dit, ce qui monte et ce qui descend.
 *  - Écran TOP 5 (télévision de l'atelier, plein écran, lisible à 3 m) : préparé tout seul à partir des faits.
 *    Une page par lettre S, Q, C, D, P, avec le fait du jour (signaux sécurité, non-conformités, TRS et micro-arrêts,
 *    actions en retard, idées sans réponse) et la lettre du mois. Puis « Réponses à vos remontées » et
 *    « Informations ». La dernière page est la clôture : présents et point tenu.
 *    Les lettres se cochent sur l'écran ; un écart devient un sujet du TOP 15 (comme au point du jour).
 *    Sous chaque lettre, « Ce qui s'est dit » garde la phrase importante.
 *  - Informations descendantes : la direction, le site ou le TOP 15 écrit une information à passer aux équipes,
 *    avec « Ce que ça change pour vous » (le contexte), pour un site, un atelier ou tout le Groupe, jusqu'à une date.
 *    Chaque atelier la marque « Dite à l'équipe » ; l'auteur voit dans quels ateliers elle est passée.
 *  - Voir › TOP 5 : les ateliers du site (tenu ou pas, durée, présents, écarts), « Ce qui s'est dit » sur 7 jours,
 *    les informations et leur diffusion. Le TOP 15 reçoit « Ce qui s'est dit aux TOP 5 » dans son ordre du jour.
 *  - Adresse directe pour la télévision : …/#top5 (site et atelier choisis une fois sur l'appareil).
 *  - 8.44 · L'information fait l'aller-retour : l'équipe pose sa question depuis l'écran TOP 5 ; elle arrive dans
 *    Voir › TOP 5 (« Questions des équipes ») et au TOP 15 ; la réponse redescend dans « Réponses » de l'atelier qui l'a posée.
 *    Une information peut porter une photo, et être « urgente » : bandeau en tête de chaque page de l'écran
 *    tant qu'elle n'a pas été dite.
 * Données : infos[] { id, site_id ("group" | site), workshop_id, title, text, why, from, start, end,
 *   relayed[{ site_id, workshop_id, at, by }], urgent, photo,
 *   questions[{ id, site_id, workshop_id, text, at, by, answer, answered_at, answered_by, returned_at, returned_by }],
 *   created_at, archived_at } ;
 *   meetings[] (+ kind "top5", notes { S, Q, C, D, P, free }, letters { S: "ok"|"ko" }, infos[], answers[]).
 */

const T5_PAGES = ["S", "Q", "C", "D", "P", "rep", "infos", "fin"];
const T5_LABEL = { rep: "Réponses", infos: "Informations", fin: "Clôture" };
let t5On = false, t5Idx = 0, t5Tick = null;
state.t5Tab ??= false;

function t5Can() { return role().nav.includes("sqcdp") || role().nav.includes("pilotage"); }
function t5Ws() { return state.workshop || null; }
function t5WsName(site = state.site, ws = t5Ws()) { const w = ws && (data.workshops || []).find((x) => x.id === ws); return w ? w.name : site === "group" ? "Groupe" : getSiteName(site); }
function t5Key() { return `bia-t5-${state.site}-${t5Ws() || "site"}-${today()}`; }
function t5Draft() { try { return JSON.parse(localStorage.getItem(t5Key()) || "null") || { notes: {}, present: null, infos: [], answers: [] }; } catch { return { notes: {}, present: null, infos: [], answers: [] }; } }
function t5Save(d) { try { localStorage.setItem(t5Key(), JSON.stringify(d)); } catch { /* stockage indisponible */ } }
function t5Mgr() { return !role().readonly && (osManager() || state.role === "teamlead"); }

/* ---------- Informations descendantes ---------- */

function t5InfoFor(i, site, ws) {
  if (i.archived_at || (i.start && i.start > today()) || (i.end && i.end < today())) return false;
  if (i.site_id !== "group" && i.site_id !== site) return false;
  return !i.workshop_id || i.workshop_id === ws;
}
function t5Infos(site = state.site, ws = t5Ws()) { return (data.infos || []).filter((i) => t5InfoFor(i, site, ws)).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || String(b.created_at).localeCompare(String(a.created_at))); }
function t5Qs(filter = () => true) { return (data.infos || []).filter((i) => !i.archived_at).flatMap((i) => (i.questions || []).map((q) => ({ i, q }))).filter(({ i, q }) => filter(i, q)); }
function t5CanAnswer(i) { if (role().readonly) return false; if (osManager()) return allowedSite(i.site_id); return state.role === "teamlead" && i.site_id === state.site && !!i.workshop_id; }
function t5Ask(id, text) {
  const by = apMe() || role().label, qid = uid("Q");
  if (!commitData(() => { const i = (data.infos || []).find((x) => x.id === id); if (!i) return; (i.questions ||= []).push({ id: qid, site_id: state.site, workshop_id: t5Ws(), text, at: now(), by }); })) return false;
  const d = t5Draft(); (d.questions ||= []).push(qid); t5Save(d); return true;
}
function t5Answer(qid, text) {
  return commitData(() => { for (const i of data.infos || []) { const q = (i.questions || []).find((x) => x.id === qid); if (q) Object.assign(q, { answer: text, answered_at: now(), answered_by: apMe() || role().label }); } });
}
function t5Told(i, site, ws) { return (i.relayed || []).find((r) => r.site_id === site && (r.workshop_id || null) === (ws || null)); }
function t5Targets(i) {
  const sites = i.site_id === "group" ? OPERATIONAL_SITES.map((s) => s.id) : [i.site_id];
  return sites.flatMap((s) => { const wss = osActive(data.workshops || []).filter((w) => w.site_id === s && (!i.workshop_id || w.id === i.workshop_id)); return wss.length ? wss.map((w) => ({ site_id: s, workshop_id: w.id, name: w.name })) : [{ site_id: s, workshop_id: null, name: getSiteName(s) }]; });
}
function t5InfoForm(id) {
  const old = id ? (data.infos || []).find((x) => x.id === id) : null, site = state.site;
  const wss = site === "group" ? [] : osActive(data.workshops || []).filter((w) => w.site_id === site);
  const scopes = [...(osManager() && allowedSite("group") ? [["group", "", "Tout le Groupe"]] : []), ...(site !== "group" ? [[site, "", `Tout le site · ${getSiteName(site)}`], ...wss.map((w) => [site, w.id, `Atelier · ${w.name}`])] : [])];
  if (!scopes.length) return toast("Choisissez un site pour écrire une information.");
  const cur = old ? `${old.site_id}|${old.workshop_id || ""}` : `${scopes[0][0]}|${state.workshop && scopes.some((s) => s[1] === state.workshop) ? state.workshop : ""}`;
  modal(old ? "Information à passer" : "Nouvelle information à passer aux équipes", `<form id="t5InfoForm" class="jn-form">
    <label class="field">L’information, en une phrase<input id="t5Title" required maxlength="120" value="${esc(old?.title || "")}" placeholder="Ex. Audit client Stellantis jeudi 14 h"></label>
    <label class="field">Ce que ça change pour vous<textarea id="t5Why" rows="2" placeholder="Ex. Ligne 3 rangée et 5S affiché mercredi soir ; les fiches de contrôle à jour.">${esc(old?.why || "")}</textarea></label>
    <label class="field">Détail (facultatif)<textarea id="t5Text" rows="2">${esc(old?.text || "")}</textarea></label>
    <div class="t5-form-extra"><label class="t5-photo"><span id="t5PhPrev">${old?.photo ? phImg(old.photo, "t5-img", "Photo") : '<span class="eh-noph">ajouter une photo</span>'}</span><input type="file" accept="image/*" capture="environment" id="t5Ph"></label>
    <label class="cg-up t5-urg"><input type="checkbox" id="t5Urgent" ${old?.urgent ? "checked" : ""}> Urgente : en bandeau sur chaque page de l’écran TOP 5 tant qu’elle n’a pas été dite</label></div>
    <div class="form-grid"><label>Pour<select id="t5Scope">${scopes.map(([s, w, l]) => `<option value="${esc(`${s}|${w}`)}" ${`${s}|${w}` === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <label>À dire à partir du<input id="t5Start" type="date" value="${esc(old?.start || today())}"></label><label>Jusqu’au<input id="t5End" type="date" value="${esc(old?.end || auAddDays(6))}"></label>
    <label>De la part de<input id="t5From" value="${esc(old?.from || apMe() || role().label)}"></label></div>
    <p class="hint">Elle s’affiche au TOP 5 des ateliers concernés jusqu’à la date de fin. Chaque atelier la marque « Dite à l’équipe ».</p>
    <div class="form-actions"><button class="btn">${old ? "Enregistrer" : "Envoyer aux TOP 5"}</button>${old ? '<button type="button" class="btn ghost" data-t5-arch>Retirer</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  let photo = old?.photo || "";
  if (typeof phFill === "function") phFill($("modalContent"));
  $("t5Ph").onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { photo = await imageDataUrl(f); $("t5PhPrev").innerHTML = `<img class="t5-img" src="${photo}" alt="">`; modalDirty = true; } catch { toast("Photo illisible."); } };
  $("modalContent").querySelector("[data-t5-arch]")?.addEventListener("click", () => { if (!commitData(() => { const x = data.infos.find((k) => k.id === id); if (x) x.archived_at = now(); })) return; modalDirty = false; closeModal(); t5Refresh(); toast("Information retirée."); });
  $("t5InfoForm").onsubmit = async (e) => {
    e.preventDefault();
    if (photo && !phIsRef(photo) && typeof phStore === "function") { try { photo = await phStore(photo); } catch { /* reste en ligne */ } }
    const title = $("t5Title").value.trim(); if (!title) return;
    const [s, w] = $("t5Scope").value.split("|"), start = $("t5Start").value || today(), end = $("t5End").value || "";
    if (end && end < start) return toast("La date de fin est avant la date de début.");
    const row = { title, why: $("t5Why").value.trim(), text: $("t5Text").value.trim(), site_id: s, workshop_id: w || null, start, end, from: $("t5From").value.trim(), urgent: $("t5Urgent").checked, photo: photo || "", updated_at: now() };
    if (!commitData(() => { data.infos ||= []; if (old) Object.assign(data.infos.find((x) => x.id === old.id), row); else data.infos.unshift({ id: auNext("INF", data.infos), ...row, relayed: [], by: apMe() || role().label, created_at: now() }); })) return;
    modalDirty = false; closeModal(); t5Refresh(); toast(old ? "Information mise à jour." : `Information envoyée : ${t5Targets(row).length} TOP 5 concerné${t5Targets(row).length > 1 ? "s" : ""}.`);
  };
}
function t5Tell(id) {
  const site = state.site, ws = t5Ws(), by = apMe() || role().label;
  if (!commitData(() => { const i = (data.infos || []).find((x) => x.id === id); if (!i || t5Told(i, site, ws)) return; (i.relayed ||= []).push({ site_id: site, workshop_id: ws, at: now(), by }); })) return;
  const d = t5Draft(); if (!d.infos.includes(id)) d.infos.push(id); t5Save(d);
}

function t5QHtml(i, w) {
  const mine = (i.questions || []).filter((q) => q.site_id === state.site && (q.workshop_id || null) === t5Ws());
  return `${mine.length ? `<ul class="t5-qs">${mine.map((q) => `<li><b>? ${esc(q.text)}</b>${q.answered_at ? `<span class="t5-answer">${esc(q.answer)}</span>` : "<small>En attente de réponse</small>"}</li>`).join("")}</ul>` : ""}${w ? `<form class="t5-noteform t5-qform" data-t5-q="${esc(i.id)}"><input data-t5-qtext placeholder="Une question de l’équipe ?" enterkeyhint="send" autocomplete="off"><button class="btn secondary">Poser</button></form>` : ""}`;
}

/* ---------- Le fait du jour, par lettre ---------- */

function t5Facts(axis, site = state.site, ws = t5Ws()) {
  const out = [], inWs = (r) => !ws || !r.workshop_id || r.workshop_id === ws, y = auAddDays(-1);
  if (axis === "S") {
    const sig = osActive(data.signals || []).filter((s) => s.site_id === site && inWs(s) && (s.type === "Sécurité" || s.severity === "Critique"));
    const fresh = sig.filter((s) => String(s.created_at || "").slice(0, 10) >= y), open = sig.filter((s) => isOpenSignal(s));
    const last = sig.map((s) => String(s.created_at || "").slice(0, 10)).sort().pop();
    out.push({ big: last ? String(Math.max(0, Math.round((Date.parse(today()) - Date.parse(last)) / 864e5))) : "—", unit: "jours depuis le dernier signal sécurité" });
    fresh.slice(0, 3).forEach((s) => out.push({ tone: s.severity === "Critique" ? "bad" : "warn", t: `${s.severity || "Signal"} · ${s.description || ""}`, s: s.state || "" }));
    if (open.length) out.push({ tone: "warn", t: `${open.length} signal${open.length > 1 ? "s" : ""} sécurité encore ouvert${open.length > 1 ? "s" : ""}` });
  }
  if (axis === "Q") {
    const nc = (data.ncs || []).filter((n) => !n.archived_at && n.site_id === site && n.date >= y);
    const claims = (data.ncs || []).filter((n) => !n.archived_at && n.site_id === site && n.origin === "Client" && n.status !== "Clos");
    out.push({ big: String(nc.length), unit: "non-conformité" + (nc.length > 1 ? "s" : "") + " hier et aujourd’hui" });
    nc.slice(0, 3).forEach((n) => out.push({ tone: n.origin === "Client" ? "bad" : "warn", t: `${n.defect || "Défaut"}${n.client ? ` · ${n.client}` : ""}${n.qty ? ` · ${n.qty} pièce${n.qty > 1 ? "s" : ""}` : ""}`, s: n.origin || "" }));
    if (claims.length) out.push({ tone: "bad", t: `${claims.length} réclamation${claims.length > 1 ? "s" : ""} client en cours` });
  }
  if (axis === "C") {
    const lines = (data.mlLines || []).filter((l) => !l.archived_at && l.site_id === site && (!ws || !l.workshop_id || l.workshop_id === ws));
    const shifts = (data.trsShifts || []).filter((s) => lines.some((l) => l.id === s.line_id) && s.date >= auAddDays(-6) && s.date < today());
    const lastDay = shifts.map((s) => s.date).sort().pop();
    const a = lastDay && typeof tsAgg === "function" ? tsAgg(shifts.filter((s) => s.date === lastDay)) : null;
    out.push(a ? { big: `${smNum(Math.round(a.trs * 1000) / 10)} %`, unit: `TRS du ${shortDate(lastDay)} · ${a.n} feuille${a.n > 1 ? "s" : ""} de poste` } : { t: "TRS : aucune feuille de poste saisie cette semaine", s: "Terrain › TRS : saisir la feuille de poste" });
    if (typeof mlSum === "function") lines.forEach((l) => { const m = mlSum(l, 1); if (m.n) out.push({ tone: m.over ? "bad" : "warn", t: `${l.name} · ${m.n} micro-arrêt${m.n > 1 ? "s" : ""} aujourd’hui, ${mlFmt(m.min)}`, s: m.top ? `1re cause : ${m.top.c}` : "" }); });
  }
  if (axis === "D") {
    const late = (data.actions || []).filter((a) => !a.archived_at && a.site_id === site && inWs(a) && isLate(a)).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    out.push({ big: String(late.length), unit: `action${late.length > 1 ? "s" : ""} en retard` });
    late.slice(0, 4).forEach((a) => out.push({ tone: "warn", t: a.title || a.description || a.id, s: `${a.owner || "sans responsable"} · prévue le ${shortDate(a.due_date)}` }));
  }
  if (axis === "P") {
    const ideas = (data.kaizens || []).filter((k) => !k.archived_at && k.site_id === site && inWs(k) && typeof idWaiting === "function" && idWaiting(k));
    const last = (data.meetings || []).filter((m) => m.site_id === site && (m.workshop_id || null) === ws).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (last?.present?.length) out.push({ big: String(last.present.length), unit: `présents au dernier point (${shortDate(last.date)})` });
    if (ideas.length) out.push({ tone: ideas.some((k) => Date.now() - Date.parse(k.created_at || now()) > 48 * 36e5) ? "bad" : "warn", t: `${ideas.length} idée${ideas.length > 1 ? "s" : ""} de l’équipe en attente de réponse`, s: ideas.slice(0, 2).map((k) => k.title).join(" · ") });
  }
  return out;
}

/* ---------- L'écran ---------- */

function t5Open() {
  if (!t5Can()) return toast("Écran réservé aux profils qui suivent le SQCDP.");
  if (state.site === "group") return toast("Choisissez d’abord le site (et l’atelier) du TOP 5.");
  t5On = true; t5Idx = 0;
  const d = t5Draft(); if (!d.start) { d.start = Date.now(); t5Save(d); }
  t5Draw();
}
function t5Close() { t5On = false; clearInterval(t5Tick); document.getElementById("t5Screen")?.remove(); document.body.classList.remove("t5-on"); if (document.fullscreenElement) document.exitFullscreen?.(); render(); }
function t5Refresh() { if (t5On) t5Draw(); else render(); }
function t5Clock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function t5PageHtml(p, d) {
  const w = sjWritable();
  if (SJ_AXES.includes(p)) {
    const cur = sjGet(today(), p), facts = t5Facts(p), big = facts.find((f) => f.big), list = facts.filter((f) => !f.big);
    return `<div class="t5-letter" style="--axis:${AXES[p].color}"><div class="t5-l-head"><b class="t5-L">${p}</b><div><h2>${esc(AXES[p].label)}</h2><p>${esc(SJ_HINT[p])}</p></div></div>
      <div class="t5-l-body"><div class="t5-facts">${big ? `<p class="t5-bignum"><b>${esc(big.big)}</b><span>${esc(big.unit)}</span></p>` : ""}${list.length ? `<ul>${list.map((f) => `<li class="${f.tone || ""}"><b>${esc(f.t)}</b>${f.s ? `<small>${esc(f.s)}</small>` : ""}</li>`).join("")}</ul>` : '<p class="t5-calm">Rien de particulier dans les données.</p>'}</div>
      <div class="t5-side"><div class="t5-okko">${w ? `<button type="button" class="t5-ok ${cur?.status === "ok" ? "on" : ""}" data-t5-set="ok">Bonne journée</button><button type="button" class="t5-ko ${cur?.status === "ko" ? "on" : ""}" data-t5-set="ko">Écart</button>` : `<p class="t5-state ${cur?.status || ""}">${cur ? (cur.status === "ok" ? "Bonne journée" : "Écart") : "Non renseigné"}</p>`}</div>
      ${cur?.status === "ko" ? (cur.topic_id ? `<p class="t5-topic">${esc(cur.note || "")} <span>→ TOP 15 · ${esc(cur.topic_id)}</span></p>` : w ? `<form class="t5-noteform" data-t5-ko><input data-t5-kotext placeholder="${esc(SJ_HINT[p])}" enterkeyhint="send" autocomplete="off"><button class="btn">Monter au TOP 15</button></form>` : "") : ""}
      <label class="t5-said">Ce qui s’est dit<textarea data-t5-note="${p}" rows="2" placeholder="La phrase à garder (facultatif)">${esc(d.notes[p] || "")}</textarea></label>
      <div class="t5-month">${sjLetter(p, today().slice(0, 7), { big: true })}</div></div></div></div>`;
  }
  if (p === "rep") {
    const qs = t5Qs((i, q) => q.site_id === state.site && (q.workshop_id || null) === t5Ws() && q.answered_at && !q.returned_at);
    const items = typeof cgToReturn === "function" ? cgToReturn(1, { site: state.site, ws: t5Ws() }) : [], done = (data.topics || []).filter((t) => t.returned_at && String(t.returned_at).slice(0, 10) === today() && t.site_id === state.site);
    return `<div class="t5-block"><h2>Réponses à vos remontées</h2><p class="t5-sub">Ce que vous avez remonté, et la réponse du TOP 15 ou de la direction.</p>${qs.length ? `<ul class="t5-cards">${qs.map(({ i, q }) => `<li><small>Votre question sur « ${esc(i.title)} »</small><b>${esc(q.text)}</b><p class="t5-answer">${esc(q.answer)}</p><small>Réponse de ${esc(q.answered_by || "—")} · ${shortDate(q.answered_at)}</small>${w ? `<button type="button" class="btn" data-t5-qret="${esc(q.id)}">Dite à l’équipe</button>` : ""}</li>`).join("")}</ul>` : ""}${items.length || qs.length ? `<ul class="t5-cards">${items.map((it) => `<li><b>${esc(it.title)}</b><p class="t5-answer">${esc(it.answer || "")}</p><small>${it.by ? `Réponse de ${esc(it.by)} · ` : ""}${shortDate(it.at)}</small>${w ? `<button type="button" class="btn" data-t5-ret="${esc(it.id)}">Dite à l’équipe</button>` : ""}</li>`).join("")}</ul>` : '<p class="t5-calm">Aucune réponse en attente d’être dite.</p>'}${done.length ? `<p class="t5-sub">Dites aujourd’hui : ${done.map((t) => esc(t.title)).join(" · ")}</p>` : ""}</div>`;
  }
  if (p === "infos") {
    const infos = t5Infos();
    return `<div class="t5-block"><h2>Informations</h2><p class="t5-sub">Ce que le site et le Groupe ont à dire aux équipes, avec ce que ça change ici.</p>${infos.length ? `<ul class="t5-cards">${infos.map((i) => { const told = t5Told(i, state.site, t5Ws()); return `<li class="${told ? "done" : ""}"><b>${esc(i.title)}</b>${i.why ? `<p class="t5-why"><span>Ce que ça change pour vous</span>${esc(i.why)}</p>` : ""}${i.photo ? `<div class="t5-ph">${phImg(i.photo, "t5-img", i.title)}</div>` : ""}${i.text ? `<p>${esc(i.text)}</p>` : ""}<small>${i.urgent ? '<span class="t5-urgtag">Urgent</span> ' : ""}De ${esc(i.from || i.by || "—")} · ${i.site_id === "group" ? "tout le Groupe" : i.workshop_id ? esc(t5WsName(i.site_id, i.workshop_id)) : esc(getSiteName(i.site_id))}${i.end ? ` · jusqu’au ${shortDate(i.end)}` : ""}</small>${told ? `<p class="t5-told">✓ Dite le ${shortDate(told.at)}</p>` : w ? `<button type="button" class="btn" data-t5-tell="${esc(i.id)}">Dite à l’équipe</button>` : ""}${t5QHtml(i, w)}</li>`; }).join("")}</ul>` : '<p class="t5-calm">Pas d’information à passer aujourd’hui.</p>'}${t5Mgr() ? '<button type="button" class="btn ghost t5-add" data-t5-newinfo>+ Information</button>' : ""}</div>`;
  }
  const team = [...new Set([...((data.meetings || []).filter((m) => m.site_id === state.site && (m.workshop_id || null) === t5Ws()).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.present || []), ...(data.skillsMatrix || []).filter((t) => t.site_id === state.site && !t.archived_at).flatMap((t) => t.people.map((x) => x.name))])].slice(0, 40);
  const present = new Set(d.present || []), ko = SJ_AXES.filter((a) => sjGet(today(), a)?.status === "ko"), missing = SJ_AXES.filter((a) => !sjGet(today(), a));
  return `<div class="t5-block"><h2>Clôture du point</h2><div class="t5-sumrow">${SJ_AXES.map((a) => { const c = sjGet(today(), a); return `<span class="t5-chipL ${c?.status || "none"}" style="--axis:${AXES[a].color}">${a}</span>`; }).join("")}<span class="t5-sub">${ko.length ? `${ko.length} écart${ko.length > 1 ? "s" : ""} monté${ko.length > 1 ? "s" : ""} au TOP 15` : "Aucun écart"}${missing.length ? ` · non renseigné : ${missing.join(", ")}` : ""}</span></div>
    <p class="t5-sub">Présents · ${present.size}</p><div class="t5-people">${team.map((n) => `<button type="button" class="chip ${present.has(n) ? "active" : ""}" data-t5-p="${esc(n)}" aria-pressed="${present.has(n)}">${esc(n)}</button>`).join("")}</div>
    ${w ? `<form class="t5-noteform" data-t5-addp><input data-t5-pname placeholder="Ajouter une personne" autocomplete="off"><button class="btn secondary">+</button></form>` : ""}
    <label class="t5-said">Autre chose dite au point<textarea data-t5-note="free" rows="2">${esc(d.notes.free || "")}</textarea></label>
    ${w ? '<button type="button" class="btn t5-done" data-t5-held>Point tenu</button>' : ""}</div>`;
}
function t5Draw() {
  if (!t5On) return;
  let el = document.getElementById("t5Screen");
  if (!el) { el = document.createElement("div"); el.id = "t5Screen"; el.className = "t5-screen"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Écran TOP 5"); document.body.appendChild(el); }
  document.body.classList.add("t5-on");
  const d = t5Draft(), p = T5_PAGES[t5Idx], held = (data.meetings || []).some((m) => m.site_id === state.site && (m.workshop_id || null) === t5Ws() && m.date === today() && m.kind === "top5");
  const tabs = T5_PAGES.map((x, i) => { const c = SJ_AXES.includes(x) ? sjGet(today(), x) : null; return `<button type="button" class="t5-tab ${i === t5Idx ? "on" : ""} ${c ? c.status : ""}" data-t5-go="${i}" ${SJ_AXES.includes(x) ? `style="--axis:${AXES[x].color}"` : ""} aria-current="${i === t5Idx}">${SJ_AXES.includes(x) ? x : esc(T5_LABEL[x])}</button>`; }).join("");
  el.innerHTML = `<header class="t5-head"><div><p class="t5-eye">TOP 5 · ${esc(getSiteName(state.site))}</p><h1>${esc(t5WsName())}</h1></div><nav class="t5-tabs" aria-label="Rubriques">${tabs}</nav>
      <div class="t5-tools"><span class="t5-time"><b id="t5Timer">${t5Clock(Date.now() - (d.start || Date.now()))}</b><small>${held ? "point tenu" : "sur 5 min"}</small></span><button type="button" class="btn ghost" data-t5-full title="Plein écran">⛶</button><button type="button" class="btn ghost" data-t5-x aria-label="Fermer l’écran">✕</button></div></header>
    ${t5UrgentHtml()}<main class="t5-page">${t5PageHtml(p, d)}</main>
    <footer class="t5-foot"><button type="button" class="t5-nav" data-t5-step="-1" ${t5Idx ? "" : "disabled"}>‹ ${t5Idx ? esc(SJ_AXES.includes(T5_PAGES[t5Idx - 1]) ? AXES[T5_PAGES[t5Idx - 1]].label : T5_LABEL[T5_PAGES[t5Idx - 1]]) : ""}</button><span>${t5Idx + 1} / ${T5_PAGES.length} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span><button type="button" class="t5-nav" data-t5-step="1" ${t5Idx < T5_PAGES.length - 1 ? "" : "disabled"}>${t5Idx < T5_PAGES.length - 1 ? esc(SJ_AXES.includes(T5_PAGES[t5Idx + 1]) ? AXES[T5_PAGES[t5Idx + 1]].label : T5_LABEL[T5_PAGES[t5Idx + 1]]) : ""} ›</button></footer>`;
  t5BindScreen(el);
  clearInterval(t5Tick);
  t5Tick = setInterval(() => { const t = document.getElementById("t5Timer"); if (!t || !t5On) return clearInterval(t5Tick); const s = t5Draft().start || Date.now(); t.textContent = t5Clock(Date.now() - s); t.parentElement.classList.toggle("over", Date.now() - s > 5 * 60e3); }, 1000);
}
function t5UrgentHtml() {
  const u = t5Infos().filter((i) => i.urgent && !t5Told(i, state.site, t5Ws()));
  if (!u.length || T5_PAGES[t5Idx] === "infos") return "";
  return `<div class="t5-urgent" role="alert">${u.map((i) => `<div><span class="t5-urgtag">Urgent</span><b>${esc(i.title)}</b>${i.why ? `<span>${esc(i.why)}</span>` : ""}${sjWritable() ? `<button type="button" class="btn" data-t5-tell="${esc(i.id)}">Dite à l’équipe</button>` : ""}</div>`).join("")}</div>`;
}
function t5Go(i) { t5Idx = Math.max(0, Math.min(T5_PAGES.length - 1, i)); t5Draw(); document.getElementById("t5Screen")?.scrollTo(0, 0); }
function t5BindScreen(el) {
  const on = (sel, fn) => el.querySelectorAll(sel).forEach((b) => (b.onclick = (e) => fn(b, e)));
  on("[data-t5-go]", (b) => t5Go(Number(b.dataset.t5Go)));
  on("[data-t5-step]", (b) => t5Go(t5Idx + Number(b.dataset.t5Step)));
  on("[data-t5-x]", t5Close);
  on("[data-t5-full]", () => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => toast("Plein écran refusé par le navigateur : touche F11."))));
  on("[data-t5-set]", (b) => {
    const a = T5_PAGES[t5Idx], v = b.dataset.t5Set, cur = sjGet(today(), a);
    if (cur?.status === v) { if (sjSet(today(), a, null)) t5Draw(); return; }
    if (!sjSet(today(), a, v, v === "ko" ? cur?.note || "" : "")) return;
    t5Draw(); if (v === "ko") el.querySelector("[data-t5-kotext]")?.focus();
  });
  el.querySelectorAll("[data-t5-ko]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const note = f.querySelector("[data-t5-kotext]").value.trim(); if (!note) return; const r = sjSet(today(), T5_PAGES[t5Idx], "ko", note); if (!r) return; t5Draw(); if (r.topicId) toast(`Écart monté au TOP 15 : ${r.topicId}.`); }));
  el.querySelectorAll("[data-t5-note]").forEach((t) => (t.oninput = () => { const d = t5Draft(); d.notes[t.dataset.t5Note] = t.value; t5Save(d); }));
  on("[data-t5-ret]", (b) => {
    const it = cgToReturn(1, { site: state.site, ws: t5Ws() }).find((x) => x.id === b.dataset.t5Ret); if (!it) return;
    if (!commitData(() => cgReturnRow({ ...it, origin: 1 }, apMe() || role().label))) return;
    const d = t5Draft(); d.answers.push(it.id); t5Save(d); t5Draw(); toast("Réponse dite : la boucle est fermée.");
  });
  on("[data-t5-tell]", (b) => { t5Tell(b.dataset.t5Tell); t5Draw(); });
  el.querySelectorAll("[data-t5-q]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const v = f.querySelector("[data-t5-qtext]").value.trim(); if (!v) return; if (t5Ask(f.dataset.t5Q, v)) { t5Draw(); toast("Question envoyée : la réponse reviendra dans « Réponses »."); } }));
  on("[data-t5-qret]", (b) => { if (!commitData(() => { for (const i of data.infos || []) { const q = (i.questions || []).find((x) => x.id === b.dataset.t5Qret); if (q) Object.assign(q, { returned_at: now(), returned_by: apMe() || role().label }); } })) return; t5Draw(); toast("Réponse dite : la boucle est fermée."); });
  phFillSafe(el);
  on("[data-t5-newinfo]", () => t5InfoForm());
  on("[data-t5-p]", (b) => { const d = t5Draft(), s = new Set(d.present || []), n = b.dataset.t5P; s.has(n) ? s.delete(n) : s.add(n); d.present = [...s]; t5Save(d); t5Draw(); });
  el.querySelectorAll("[data-t5-addp]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const v = f.querySelector("[data-t5-pname]").value.trim(); if (!v) return; const d = t5Draft(); d.present = [...new Set([...(d.present || []), v])]; t5Save(d); t5Draw(); }));
  on("[data-t5-held]", t5Held);
}
function phFillSafe(root) { if (typeof phFill === "function") phFill(root); }
function t5Held() {
  const d = t5Draft(), start = d.start || Date.now(), dur = Math.round((Date.now() - start) / 1000);
  const letters = Object.fromEntries(SJ_AXES.map((a) => [a, sjGet(today(), a)?.status || ""]).filter(([, v]) => v));
  const notes = Object.fromEntries(Object.entries(d.notes || {}).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v));
  const raised = (data.topics || []).filter((t) => t.site_id === state.site && (t.workshop_id || null) === t5Ws() && String(t.created_at || "").slice(0, 10) === today()).map((t) => t.id);
  if (!commitData(() => {
    data.meetings ||= [];
    const old = data.meetings.find((m) => m.site_id === state.site && (m.workshop_id || null) === t5Ws() && m.date === today() && m.kind === "top5");
    const row = { kind: "top5", site_id: state.site, workshop_id: t5Ws(), date: today(), started_at: new Date(start).toISOString(), ended_at: now(), duration_s: dur, present: d.present || [], letters, notes, raised, infos: d.infos || [], answers: d.answers || [], questions: d.questions || [], topics: raised.length, escalated: raised.length, by: apMe() || role().label };
    if (old) Object.assign(old, row); else data.meetings.unshift({ id: uid("PT"), ...row });
  })) return;
  state.timerStarted = null;
  toast(`Point tenu en ${t5Clock(dur * 1000)} · ${(d.present || []).length} présent${(d.present || []).length > 1 ? "s" : ""} · gardé pour le TOP 15.`);
  t5Draw();
}
document.addEventListener("keydown", (e) => {
  if (!t5On || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector("#modal:not([hidden])")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); t5Go(t5Idx + 1); }
  if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); t5Go(t5Idx - 1); }
  if (e.key === "Escape" && !document.fullscreenElement) t5Close();
});
(() => { let x0 = null; document.addEventListener("touchstart", (e) => { x0 = t5On && e.target.closest?.("#t5Screen") && !e.target.closest("input, textarea, .t5-tabs, .t5-people") ? e.touches[0].clientX : null; }, { passive: true }); document.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 70) t5Go(t5Idx + (dx < 0 ? 1 : -1)); }, { passive: true }); })();

/* ---------- Voir › TOP 5 : préparer, voir ce qui s'est dit, informer ---------- */

function t5Said(sites, days = 7) {
  const from = auAddDays(-(days - 1));
  return (data.meetings || []).filter((m) => sites.includes(m.site_id) && m.date >= from).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.ended_at).localeCompare(String(a.ended_at)));
}
function t5SaidHtml(m, withSite) {
  const letters = m.letters || Object.fromEntries((data.sqcdpDays || []).filter((d) => d.site_id === m.site_id && (d.workshop_id || null) === (m.workshop_id || null) && d.date === m.date).map((d) => [d.axis, d.status]));
  const kos = (data.sqcdpDays || []).filter((d) => d.site_id === m.site_id && (d.workshop_id || null) === (m.workshop_id || null) && d.date === m.date && d.status === "ko");
  const notes = m.notes || {}, infos = (m.infos || []).map((id) => (data.infos || []).find((i) => i.id === id)).filter(Boolean);
  return `<li class="t5-said-row"><div class="t5-said-top"><b>${esc(t5WsName(m.site_id, m.workshop_id))}</b>${withSite ? `<span class="hint">${esc(getSiteName(m.site_id))}</span>` : ""}<span class="t5-mini">${SJ_AXES.map((a) => `<i class="${letters[a] || "none"}" style="--axis:${AXES[a].color}">${a}</i>`).join("")}</span><small>${shortDate(m.date)}${m.duration_s ? ` · ${smFmt(m.duration_s)}` : ""}${(m.present || []).length ? ` · ${m.present.length} présent${m.present.length > 1 ? "s" : ""}` : ""}</small></div>
    ${kos.length || Object.keys(notes).length || infos.length || (m.answers || []).length || (m.questions || []).length ? `<ul class="t5-said-list">${kos.map((d) => `<li><span class="jn-tag tone-bad">${d.axis}</span>${esc(d.note || "Écart")}${d.topic_id ? ` ${reRecSafe(d.topic_id)}` : ""}</li>`).join("")}${Object.entries(notes).map(([k, v]) => `<li><span class="jn-tag">${k === "free" ? "Dit" : esc(k)}</span>${esc(v)}</li>`).join("")}${infos.map((i) => `<li><span class="jn-tag tone-ok">Info</span>${esc(i.title)}</li>`).join("")}${t5Qs((i, q) => (m.questions || []).includes(q.id)).map(({ i, q }) => `<li><span class="jn-tag tone-warn">Question</span>${esc(q.text)} <small>sur « ${esc(i.title)} »${q.answered_at ? ` · réponse : ${esc(q.answer)}` : ""}</small></li>`).join("")}${(m.answers || []).length ? `<li><span class="jn-tag tone-ok">Réponses</span>${m.answers.length} redite${m.answers.length > 1 ? "s" : ""} à l’équipe</li>` : ""}</ul>` : '<p class="hint">Point tenu, rien de particulier noté.</p>'}</li>`;
}
function reRecSafe(id) { return `<button type="button" class="md-link" data-open-record="${esc(id)}">${esc(id)}</button>`; }
function t5Page() {
  const group = state.site === "group", sites = group ? OPERATIONAL_SITES.map((s) => s.id).filter((s) => allowedSite(s)) : [state.site];
  const t = today(), ms = (data.meetings || []).filter((m) => m.date === t);
  const lines = sites.flatMap((s) => { const wss = osActive(data.workshops || []).filter((w) => w.site_id === s); return wss.length ? wss.map((w) => ({ s, ws: w.id, name: w.name })) : [{ s, ws: null, name: getSiteName(s) }]; });
  const heldN = lines.filter((l) => ms.some((m) => m.site_id === l.s && (m.workshop_id || null) === l.ws)).length;
  const rows = lines.map((l) => { const m = ms.find((x) => x.site_id === l.s && (x.workshop_id || null) === l.ws), ko = (data.sqcdpDays || []).filter((d) => d.site_id === l.s && (d.workshop_id || null) === l.ws && d.date === t && d.status === "ko").length;
    return `<li class="t5-ws ${m ? "held" : ""}"><div><b>${esc(l.name)}</b>${group ? `<span class="hint">${esc(getSiteName(l.s))}</span>` : ""}<small>${m ? `Tenu${m.ended_at ? ` à ${new Date(m.ended_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}${m.duration_s ? ` · ${smFmt(m.duration_s)}` : ""}${(m.present || []).length ? ` · ${m.present.length} présents` : ""}` : "Pas encore tenu"}${ko ? ` · ${ko} écart${ko > 1 ? "s" : ""}` : ""}</small></div>${!group && t5Can() ? `<button type="button" class="btn ${m ? "secondary" : ""}" data-t5-open="${esc(l.ws || "")}">Écran TOP 5</button>` : ""}</li>`; }).join("");
  const said = t5Said(sites);
  const infos = (data.infos || []).filter((i) => !i.archived_at && (!i.end || i.end >= t) && (i.site_id === "group" || sites.includes(i.site_id))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const infoRow = (i) => { const tg = t5Targets(i).filter((x) => sites.includes(x.site_id)), told = tg.filter((x) => t5Told(i, x.site_id, x.workshop_id)), notYet = tg.filter((x) => !t5Told(i, x.site_id, x.workshop_id));
    return `<li class="t5-info"><div><b>${i.urgent ? '<span class="t5-urgtag">Urgent</span> ' : ""}${esc(i.title)}</b>${i.why ? `<p class="hint">Ce que ça change : ${esc(i.why)}</p>` : ""}<small>${esc(i.from || i.by || "")} · ${i.site_id === "group" ? "Groupe" : i.workshop_id ? esc(t5WsName(i.site_id, i.workshop_id)) : esc(getSiteName(i.site_id))}${i.start > t ? ` · à partir du ${shortDate(i.start)}` : ""}${i.end ? ` · jusqu’au ${shortDate(i.end)}` : ""}</small>
      ${(i.questions || []).length ? `<small>${i.questions.length} question${i.questions.length > 1 ? "s" : ""} des équipes · ${i.questions.filter((q) => !q.answered_at).length} sans réponse</small>` : ""}<div class="t5-relay"><div class="progress"><span style="width:${tg.length ? (100 * told.length) / tg.length : 0}%"></span></div><span><b>Dite dans ${told.length}/${tg.length}</b>${notYet.length && notYet.length <= 8 ? ` · reste : ${notYet.map((x) => esc(x.name)).join(", ")}` : ""}</span></div></div>${t5Mgr() && (osManager() ? allowedSite(i.site_id) : i.site_id === state.site && !!i.workshop_id) ? `<button type="button" class="btn ghost small" data-t5-edit="${esc(i.id)}">Modifier</button>` : ""}</li>`; };
  const qs = t5Qs((i, q) => !q.answered_at && sites.includes(q.site_id)).sort((a, b) => String(a.q.at).localeCompare(String(b.q.at)));
  const qSec = qs.length ? `<section class="panel section t5-qsec"><div class="section-title"><h2>Questions des équipes · ${qs.length}</h2></div><p class="hint">Posées au TOP 5 sur une information. La réponse redescend à l’atelier qui l’a posée, dans « Réponses » de son écran.</p><ul class="t5-infolist">${qs.map(({ i, q }) => `<li class="t5-info"><div><small>Sur « ${esc(i.title)} » · ${esc(t5WsName(q.site_id, q.workshop_id))}${group ? ` · ${esc(getSiteName(q.site_id))}` : ""} · ${esc(q.by || "")} · depuis ${typeof cgAge === "function" ? cgAge(q.at) : shortDate(q.at)}</small><b>${esc(q.text)}</b>${t5CanAnswer(i) ? `<form class="ik-add" data-t5-ans="${esc(q.id)}"><input data-t5-anstext placeholder="La réponse" autocomplete="off" enterkeyhint="send"><button class="btn secondary">Répondre</button></form>` : '<small>Réponse attendue de l’auteur de l’information.</small>'}</div></li>`).join("")}</ul></section>` : "";
  return `${pageHead("Voir", group ? "TOP 5 · tous les sites" : `TOP 5 · ${getSiteName(state.site)}`, "Préparé par l’application, affiché sur la télévision de l’atelier, gardé pour le TOP 15 : ce qui se dit en bas se lit en haut, ce qui descend arrive avec son contexte.", t5Mgr() ? '<button type="button" class="btn" data-t5-newinfo>+ Information à passer</button>' : "")}
    ${qSec}<section class="panel section"><div class="section-title"><h2>Aujourd’hui · ${heldN}/${lines.length} TOP 5 tenu${heldN > 1 ? "s" : ""}</h2></div><ul class="t5-wslist">${rows}</ul>
      ${!group ? `<p class="hint">Sur la télévision de l’atelier : ouvrir l’application, choisir le site et l’atelier, puis l’adresse <b>…/#top5</b> (ou « Écran TOP 5 »). Flèches du clavier, télécommande ou balayage pour passer les rubriques. Tant que les données ne sont pas partagées entre appareils (serveur BIA à installer avec l’informatique), l’écran montre ce qui est saisi sur l’appareil qui l’affiche : saisir le point sur l’écran lui-même.</p>` : ""}</section>
    <section class="panel section"><div class="section-title"><h2>Informations à passer aux équipes · ${infos.length}</h2></div>${infos.length ? `<ul class="t5-infolist">${infos.map(infoRow).join("")}</ul>` : empty("Aucune information en cours. Écrivez ce que les équipes doivent savoir, avec ce que ça change pour elles : elle s’affichera au TOP 5 des ateliers concernés.")}</section>
    <section class="panel section"><div class="section-title"><h2>Ce qui s’est dit · 7 derniers jours</h2></div>${said.length ? `<ul class="t5-saidlist">${said.slice(0, 40).map((m) => t5SaidHtml(m, group)).join("")}</ul>` : empty("Aucun TOP 5 enregistré ces 7 derniers jours. Il s’enregistre à « Point tenu » sur l’écran TOP 5.")}</section>`;
}

/* ---------- Le TOP 15 reçoit ce qui s'est dit ---------- */

if (typeof RE_BLOCKS !== "undefined") {
  RE_BLOCKS.top5dit = "Ce qui s’est dit aux TOP 5";
  const ag = RE_TYPES.top15?.agenda;
  if (ag && !ag.some(([k]) => k === "top5dit")) { const i = ag.findIndex(([k]) => k === "lettres"); RE_TYPES.top15.agenda = [["securite24", 2], ["lettres", 2], ["top5dit", 2], ["remontees", 4], ["retours", 2], ["suivi", 3]].filter(([k]) => k === "top5dit" || ag.some(([x]) => x === k)); if (i < 0) RE_TYPES.top15.agenda = [...ag, ["top5dit", 2]]; }
  const t5BlockBase = reBlock;
  reBlock = function (key, r) {
    if (key !== "top5dit") return t5BlockBase.apply(this, arguments);
    const ms = (data.meetings || []).filter((m) => m.site_id === r.site_id && m.date === today());
    const qs = t5Qs((i, q) => q.site_id === r.site_id && !q.answered_at);
    return { n: ms.length + qs.length, html: `${ms.length ? `<ul class="t5-saidlist">${ms.map((m) => t5SaidHtml(m, false)).join("")}</ul>` : '<p class="hint">Aucun TOP 5 tenu aujourd’hui sur ce site.</p>'}${qs.length ? `<p class="re-fact">${qs.length} question${qs.length > 1 ? "s" : ""} des équipes sans réponse (Voir › TOP 5)</p><ul>${qs.map(({ i, q }) => `<li>${esc(q.text)} <small>sur « ${esc(i.title)} » · ${esc(t5WsName(q.site_id, q.workshop_id))}</small></li>`).join("")}</ul>` : ""}` };
  };
}

/* ---------- Branchements ---------- */

const t5SqBase = renderSqcdp;
renderSqcdp = function (embedded = false) {
  if (state.t5Tab && !embedded && state.view === "sqcdp") return t5Page();
  const html = t5SqBase.apply(this, arguments);
  if (embedded || state.site === "group" || !t5Can()) return html;
  return html.replace('<section class="sj-panel section" aria-label="Le point du jour">', `<div class="t5-cta"><div><b>Écran TOP 5</b><span>Le point préparé, à afficher sur la télévision de l’atelier.</span></div><button type="button" class="btn" data-t5-open="${esc(t5Ws() || "")}">Ouvrir l’écran</button></div><section class="sj-panel section" aria-label="Le point du jour">`);
};
const t5PilotBase = renderUnifiedPilotage;
renderUnifiedPilotage = function () { if (state.pilotTab === "top5") return t5Page(); return t5PilotBase.apply(this, arguments); };
const t5TabsBase = uxTabs;
uxTabs = function (stage) {
  const out = t5TabsBase(stage);
  if (stage?.id !== "voir" || !t5Can() || out.some((t) => t.key === "top5")) return out;
  const sq = out.findIndex((t) => t.view === "sqcdp");
  if (sq >= 0) { out[sq] = { ...out[sq], set: { ...(out[sq].set || {}), t5Tab: false } }; out.splice(sq + 1, 0, { key: "top5", label: "TOP 5", view: "sqcdp", set: { t5Tab: true } }); return out; }
  const pi = out.findIndex((t) => t.view === "pilotage");
  if (pi >= 0) { const after = out.findIndex((t) => t.key === "tour"); out.splice((after >= 0 ? after : pi) + 1, 0, { key: "top5", label: "TOP 5", view: "pilotage", set: { pilotTab: "top5" } }); }
  return out;
};
function t5Bind(root = document) {
  root.querySelectorAll("[data-t5-open]").forEach((b) => (b.onclick = () => { state.workshop = b.dataset.t5Open || null; t5Open(); }));
  root.querySelectorAll("[data-t5-newinfo]").forEach((b) => (b.onclick = () => t5InfoForm()));
  root.querySelectorAll("[data-t5-ans]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const v = f.querySelector("[data-t5-anstext]").value.trim(); if (!v) return; if (t5Answer(f.dataset.t5Ans, v)) { render(); toast("Réponse envoyée : elle redescend à l’atelier."); } }));
  root.querySelectorAll("[data-t5-edit]").forEach((b) => (b.onclick = () => t5InfoForm(b.dataset.t5Edit)));
}
const t5OsBindBase = osBind;
osBind = function () { const out = t5OsBindBase.apply(this, arguments); t5Bind(document); if (t5On) t5Draw(); return out; };
function t5FromHash() { if (location.hash === "#top5" && t5Can()) { history.replaceState(null, "", "#sqcdp"); if (state.site === "group") { toast("Choisissez le site et l’atelier de cet écran, puis rouvrez …/#top5."); return; } t5Open(); } }
window.addEventListener("hashchange", t5FromHash);
window.addEventListener("load", () => setTimeout(t5FromHash, 50));

/* Nouveauté à l'accueil : l'onglet TOP 5 de Voir, selon le profil. */
if (typeof ER_NEWS !== "undefined") {
  const t5Tab = () => uxTabs(uxStages().find((x) => x.id === "voir")).find((t) => t.key === "top5");
  ER_NEWS.unshift({ v: "8.44", label: "Informations à tous les TOP 5", text: "Une information au Groupe, au site ou à l’atelier, avec photo et urgence ; les équipes posent leurs questions, la réponse redescend.", get nav() { return t5Tab()?.view || "sqcdp"; }, get set() { return t5Tab()?.set || { t5Tab: true }; } });
  ER_NEWS.splice(1, 0, { v: "8.43", label: "TOP 5 à l’écran", text: "Le point de l’atelier préparé tout seul, affiché sur la télévision ; ce qui s’y dit remonte au TOP 15, les informations descendent avec leur contexte.", get nav() { return t5Tab()?.view || "sqcdp"; }, get set() { return t5Tab()?.set || { t5Tab: true }; } });
}
