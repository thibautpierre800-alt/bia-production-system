"use strict";
/*
 * BIA Lean OS 8.24 · Relève d'équipe : préparée au poste en une minute, reprise confirmée par l'équipe entrante.
 *  - Préparer : les deux équipes devinées à l'heure ; six points en un geste (sécurité, qualité, machines,
 *    production, matière et flux, effectif) : RAS, à surveiller ou problème, avec un mot si ce n'est pas RAS.
 *  - Ce qui est en cours est proposé tout seul : signaux ouverts, actions en retard ou du jour, machines en panne.
 *  - Les trois priorités de l'équipe entrante.
 *  - Reprendre : la relève se lit d'un coup d'œil (problèmes d'abord), l'équipe entrante pose sa question ou
 *    confirme « J'ai repris » ; l'âge de la relève et qui l'a reprise restent visibles.
 *  - Le formulaire complet reste accessible.
 * Données : handovers[] (indexée) : champs ajoutés checks{ securite|qualite|machines|production|matiere|effectif:
 *   { s: "ok"|"watch"|"ko", note } }, priority_list[], ack_note ; les champs existants (situation, safety, quality,
 *   production, staffing, priorities, linked_ids) sont remplis à partir de ces points.
 */

const RL_CATS = [["securite", "Sécurité"], ["qualite", "Qualité"], ["machines", "Machines"], ["production", "Production"], ["matiere", "Matière et flux"], ["effectif", "Effectif"]];
const RL_ST = [["ok", "RAS"], ["watch", "À surveiller"], ["ko", "Problème"]];

function rlCan(siteId) { return osManager() && !role().readonly && osWritable(siteId) && allowedSite(siteId, true); }
function rlShifts() { return data.settings?.shifts?.length >= 2 ? data.settings.shifts : ["Matin", "Après-midi", "Nuit"]; }
function rlGuess() {
  const sh = rlShifts(), h = new Date().getHours(), by = (n) => sh.indexOf(n);
  let i = h >= 5 && h < 13 ? by("Matin") : h >= 13 && h < 21 ? by("Après-midi") : by("Nuit");
  if (i < 0) i = 0;
  return [sh[i], sh[(i + 1) % sh.length]];
}
function rlLocalNow() { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); }
function rlAge(h) { const t = Date.parse(h.period || h.created_at); return Number.isFinite(t) ? sgDur(Date.now() - t) : ""; }
function rlChecks(h) { return h.checks || {}; }
function rlWorst(h) { const c = Object.values(rlChecks(h)); return c.some((x) => x.s === "ko") ? "ko" : c.some((x) => x.s === "watch") ? "watch" : c.length ? "ok" : ""; }
function rlOpenItems(siteId, workshopId) {
  const sig = (data.signals || []).filter((s) => s.site_id === siteId && isOpenSignal(s) && !["Vérifié"].includes(s.state) && (!workshopId || !s.workshop_id || s.workshop_id === workshopId))
    .sort((a, b) => ({ Critique: 0, Haute: 1 }[a.severity] ?? 2) - ({ Critique: 0, Haute: 1 }[b.severity] ?? 2))
    .map((s) => ({ id: s.id, label: s.description, meta: `Signal · ${s.severity} · ${s.state}`, pre: ["Critique", "Haute"].includes(s.severity) || s.state === "Nouveau" }));
  const act = (data.actions || []).filter((a) => a.site_id === siteId && isOpenAction(a) && (isLate(a) || a.due_date === today() || ["Critique", "Haute"].includes(a.priority)) && (!workshopId || !a.workshop_id || a.workshop_id === workshopId))
    .map((a) => ({ id: a.id, label: a.title, meta: `Action · ${a.owner || "—"} · ${isLate(a) ? "en retard" : a.due_date === today() ? "pour aujourd’hui" : a.priority}`, pre: isLate(a) || a.due_date === today() }));
  return [...sig, ...act].slice(0, 10);
}
function rlDowns(siteId) {
  return (data.breakdowns || []).filter((b) => b.site_id === siteId && !b.end && !b.archived_at).map((b) => { const m = (data.machines || []).find((x) => x.id === b.machine_id); return `${m?.name || "Machine"} à l’arrêt depuis ${sgDur(Date.now() - Date.parse(b.start))}`; });
}
function rlSummary(checks, extra) {
  const bad = RL_CATS.filter(([k]) => checks[k] && checks[k].s !== "ok").sort((a, b) => (checks[b[0]].s === "ko") - (checks[a[0]].s === "ko")).map(([k, l]) => `${l} : ${checks[k].note || (checks[k].s === "ko" ? "problème" : "à surveiller")}`);
  return [bad.length ? bad.join(" · ") : "Tout est RAS.", extra].filter(Boolean).join(" ");
}

/* ---------- Préparer ---------- */

function rlNew(existing = null) {
  const sites = OPERATIONAL_SITES.filter((s) => rlCan(s.id));
  if (!osManager() || !sites.length) return toast("La relève est préparée par un responsable d’équipe ou de site.");
  const siteId = existing?.site_id || (state.site !== "group" && sites.some((s) => s.id === state.site) ? state.site : sites[0].id), workshopId = existing?.workshop_id ?? (state.workshop || null);
  const [g1, g2] = rlGuess(), sh = rlShifts();
  let from = existing?.shift_from || g1, to = existing?.shift_to || g2;
  const checks = JSON.parse(JSON.stringify(existing?.checks || {}));
  const downs = rlDowns(siteId);
  if (!existing && downs.length) checks.machines = { s: "ko", note: downs.join(" ; ") };
  const items = rlOpenItems(siteId, workshopId), linked = new Set(existing?.linked_ids || items.filter((i) => i.pre).map((i) => i.id));
  const pr = existing?.priority_list || String(existing?.priorities || "").split(/\s*\d\.\s*/).filter(Boolean);
  const chips = (attr, list, cur) => list.map((n) => `<button type="button" class="chip ${n === cur ? "active" : ""}" ${attr}="${esc(n)}" aria-pressed="${n === cur}">${esc(n)}</button>`).join("");
  const cat = ([k, l]) => { const c = checks[k] || {}; return `<div class="rl-cat s-${c.s || "none"}" data-rl-cat="${k}"><b>${l}</b><div class="rl-st">${RL_ST.map(([s, sl]) => `<button type="button" class="rl-sb sb-${s} ${c.s === s ? "on" : ""}" data-rl-s="${s}" aria-pressed="${c.s === s}">${sl}</button>`).join("")}</div><input class="rl-note" data-rl-note placeholder="En un mot : quoi ?" value="${esc(c.note || "")}" ${c.s && c.s !== "ok" ? "" : "hidden"} aria-label="${esc(l)} : précision"></div>`; };
  modal(existing ? "Modifier la relève" : "Relève d’équipe", `<form id="rlForm" class="jn-form rl-form"><p class="jn-lead">Ce que l’équipe suivante doit savoir, en une minute. Les signaux et actions restent suivis dans leur dossier.</p>
    <div class="rl-shifts"><div><span class="metric-label">De</span><div class="filters">${chips("data-rl-from", sh, from)}</div></div><div><span class="metric-label">Vers</span><div class="filters">${chips("data-rl-to", sh, to)}</div></div></div>
    <div class="rl-cats">${RL_CATS.map(cat).join("")}</div>
    ${items.length ? `<fieldset class="rl-items"><legend>Ce qui est en cours · à transmettre</legend>${items.map((i) => `<label class="rl-item"><input type="checkbox" value="${esc(i.id)}" ${linked.has(i.id) ? "checked" : ""}><span><b>${esc(i.label)}</b><small>${esc(i.id)} · ${esc(i.meta)}</small></span></label>`).join("")}</fieldset>` : ""}
    <div class="ap-field"><span class="metric-label">Les priorités de l’équipe entrante</span><div class="ol-pts">${[0, 1, 2].map((i) => `<label class="ol-pt"><span aria-hidden="true">${i + 1}</span><input data-rl-pr="${i}" value="${esc(pr[i] || "")}" placeholder="${i ? "Autre priorité (facultatif)" : "Ex. valider le carter avant de redémarrer"}" aria-label="Priorité ${i + 1}"></label>`).join("")}</div></div>
    <label class="field">Autre chose ? (facultatif)<input id="rlExtra" value="${esc(existing?.extra || "")}" placeholder="Ex. OF-245 poursuivi sur la ligne 1"></label>
    ${sites.length > 1 ? `<label class="field">Site<select id="rlSite">${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <label class="field">Transmise par<input id="rlAuthor" list="ownerList" value="${esc(existing?.author || apMe() || osActor())}">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big" data-rl-send>Transmettre la relève</button><button type="button" class="btn ghost" data-rl-draft>Garder en brouillon</button></div>
    <p class="hint"><button type="button" class="md-link" data-rl-full>Formulaire complet</button></p></form>`);
  const root = $("rlForm");
  const pick = (attr, set) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { set(b.getAttribute(attr)); root.querySelectorAll(`[${attr}]`).forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); modalDirty = true; }));
  pick("data-rl-from", (v) => { from = v; });
  pick("data-rl-to", (v) => { to = v; });
  root.querySelectorAll("[data-rl-cat]").forEach((box) => {
    const k = box.dataset.rlCat, note = box.querySelector("[data-rl-note]");
    box.querySelectorAll("[data-rl-s]").forEach((b) => (b.onclick = () => {
      const s = b.dataset.rlS;
      checks[k] = { s, note: s === "ok" ? "" : note.value.trim() };
      box.className = `rl-cat s-${s}`;
      box.querySelectorAll("[data-rl-s]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
      note.hidden = s === "ok";
      if (s !== "ok") note.focus();
      modalDirty = true;
    }));
    note.oninput = () => { if (checks[k]) checks[k].note = note.value.trim(); };
  });
  root.querySelector("[data-rl-full]").onclick = () => { modalDirty = false; rlFull(existing); };
  const save = (status) => {
    const site = $("rlSite")?.value || siteId, author = $("rlAuthor").value.trim(), list = [0, 1, 2].map((i) => root.querySelector(`[data-rl-pr="${i}"]`).value.trim()).filter(Boolean), extra = $("rlExtra").value.trim();
    if (from === to) return toast("Choisissez deux équipes différentes.");
    if (!author) { $("rlAuthor").focus(); return toast("Qui transmet la relève ?"); }
    if (status === "Transmise") {
      const missing = RL_CATS.filter(([k]) => !checks[k]).map(([, l]) => l);
      if (missing.length) return toast(`Dites RAS, à surveiller ou problème pour : ${missing.join(", ")}.`);
      const vague = RL_CATS.filter(([k]) => checks[k].s === "ko" && !checks[k].note).map(([, l]) => l);
      if (vague.length) return toast(`Précisez le problème : ${vague.join(", ")}.`);
      if (!list.length) { root.querySelector('[data-rl-pr="0"]').focus(); return toast("Donnez au moins une priorité à l’équipe entrante."); }
    }
    const note = (k) => (checks[k] && checks[k].s !== "ok" ? checks[k].note || (checks[k].s === "ko" ? "Problème" : "À surveiller") : "");
    const payload = { ...(existing || {}), id: existing?.id || nextId("REL", data.handovers), site_id: site, workshop_id: site === siteId ? workshopId : null, title: `Relève ${from} → ${to}`, shift_from: from, shift_to: to, period: existing?.period && existing.status !== "Brouillon" ? existing.period : rlLocalNow(), author, status,
      checks, priority_list: list, extra, situation: rlSummary(checks, extra), safety: note("securite"), quality: note("qualite"), staffing: checks.effectif?.s === "ok" ? "Équipe complète" : note("effectif"), production: [note("production"), note("machines"), note("matiere")].filter(Boolean).join(" · "),
      priorities: list.map((x, i) => `${i + 1}. ${x}`).join(" "), linked_ids: [...root.querySelectorAll(".rl-items input:checked")].map((i) => i.value), acknowledged_by: null, acknowledged_at: null, created_at: existing?.created_at || now(), updated_at: now() };
    if (!commitData(() => { const row = osUpsert("handovers", payload); recordHistory(row, status, existing ? "Relève mise à jour" : "Relève préparée au poste"); })) return;
    if (typeof idSetMe === "function") idSetMe(author);
    modalDirty = false;
    closeModal();
    render();
    toast(status === "Transmise" ? `Relève ${from} → ${to} transmise : l’équipe entrante la voit sur son accueil.` : "Relève gardée en brouillon.");
  };
  root.onsubmit = (e) => { e.preventDefault(); save("Transmise"); };
  root.querySelector("[data-rl-draft]").onclick = () => save("Brouillon");
}

/* ---------- Lire et reprendre ---------- */

function rlFacts(h) {
  const c = rlChecks(h), keys = RL_CATS.filter(([k]) => c[k]).sort((a, b) => ({ ko: 0, watch: 1, ok: 2 }[c[a[0]].s] - { ko: 0, watch: 1, ok: 2 }[c[b[0]].s]));
  if (!keys.length) return "";
  return `<ul class="rl-facts">${keys.map(([k, l]) => `<li class="s-${c[k].s}"><b>${l}</b><span>${c[k].s === "ok" ? "RAS" : esc(c[k].note || (c[k].s === "ko" ? "Problème" : "À surveiller"))}</span></li>`).join("")}</ul>`;
}
function rlRead(id) {
  const h = (data.handovers || []).find((x) => x.id === id && !x.archived_at);
  if (!h || !allowedSite(h.site_id)) return;
  const can = rlCan(h.site_id) && h.status === "Transmise", list = h.priority_list?.length ? h.priority_list : String(h.priorities || "").split(/\s*\d\.\s*/).filter(Boolean);
  const links = (h.linked_ids || []).map((lid) => { const m = recordMeta(lid); return m ? `<li><button type="button" class="md-link" data-open-record="${esc(lid)}">${esc(lid)}</button> ${esc(m.row.description || m.row.title || "")}${m.row.state || m.row.status ? ` <small>· ${esc(m.row.state || m.row.status)}</small>` : ""}</li>` : ""; }).join("");
  modal(`Relève ${h.shift_from} → ${h.shift_to}`, `<div class="rl-read"><p class="jn-where">${esc(getSiteName(h.site_id))} · transmise par ${esc(h.author || "—")} · il y a ${rlAge(h)}</p>
    ${rlFacts(h) || `<p class="rl-sit">${esc(h.situation || "")}</p>`}
    ${h.extra ? `<p class="rl-sit">${esc(h.extra)}</p>` : ""}
    ${list.length ? `<section><h3>Vos priorités</h3><ol class="lib-steps">${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></section>` : ""}
    ${links ? `<section><h3>En cours</h3><ul class="rl-links">${links}</ul></section>` : ""}
    ${h.acknowledged_at ? `<p class="bp-ok">Reprise par ${esc(h.acknowledged_by || "—")} le ${shortDate(h.acknowledged_at)} à ${sgClock(h.acknowledged_at).slice(-5)}${h.ack_note ? ` · « ${esc(h.ack_note)} »` : ""}</p>` : ""}
    ${can ? `<form id="rlAckForm" class="jn-form"><label class="field">Une question, une remarque ? (facultatif)<input id="rlAckNote" placeholder="Ex. la maintenance passe à quelle heure ?"></label><label class="field">Reprise par<input id="rlAckBy" list="ownerList" value="${esc(apMe() || osActor())}">${ownerDatalist()}</label><div class="form-actions"><button class="btn jn-big">J’ai repris</button></div></form>` : ""}</div>`);
  phFill($("modalContent"));
  if ($("rlAckForm")) $("rlAckForm").onsubmit = (e) => {
    e.preventDefault();
    const by = $("rlAckBy").value.trim() || osActor(), note = $("rlAckNote").value.trim();
    if (!commitData(() => { const r = data.handovers.find((x) => x.id === id); r.status = "Reprise"; r.acknowledged_by = by; r.acknowledged_at = now(); r.ack_note = note; r.updated_at = now(); recordHistory(r, "Reprise", note ? `Reprise par ${by} : ${note}` : `Reprise par ${by}`); })) return;
    if (typeof idSetMe === "function") idSetMe(by);
    modalDirty = false; closeModal(); render(); toast("Relève reprise : l’équipe sortante le voit.");
  };
}

/* ---------- Branchements ---------- */

const rlHandoverCardBase = handoverCard;
handoverCard = function (h) {
  if (!h.checks) return rlHandoverCardBase.apply(this, arguments).replace(/<button class="btn small" type="button" data-ack-handover="([^"]+)">[^<]*<\/button>/, '<button class="btn small" type="button" data-rl-read="$1">Lire et reprendre</button>');
  const can = osManager() && osWritable(h.site_id), list = h.priority_list || [], links = (h.linked_ids || []).map((id) => recordLink(id, { signals: "Signal", actions: "Action", problems: "Problème" }[recordMeta(id)?.key] || "Dossier")).filter(Boolean).join("");
  return `<article class="panel handover-card rl-card w-${rlWorst(h)} ${h.status === "Transmise" ? "waiting" : ""}"><div class="row-top"><div><p class="eyebrow">${esc(h.id)} · ${esc(getSiteName(h.site_id))}</p><h3>${esc(h.shift_from)} → ${esc(h.shift_to)}</h3></div>${pill(h.status, handoverStatusTone(h.status))}</div>
    ${rlFacts(h)}${list.length ? `<p class="rl-prio"><b>Priorités :</b> ${list.map((x, i) => `${i + 1}. ${esc(x)}`).join(" ")}</p>` : ""}
    <p class="hint">${h.status === "Brouillon" ? "Brouillon" : `Transmise il y a ${rlAge(h)}`} · par ${esc(h.author || "—")}${h.acknowledged_by ? ` · reprise par ${esc(h.acknowledged_by)}${h.ack_note ? ` : « ${esc(h.ack_note)} »` : ""}` : ""}</p>${links ? `<div class="row-actions handover-links">${links}</div>` : ""}
    <div class="row-actions">${h.status === "Transmise" && can ? `<button class="btn small" type="button" data-rl-read="${esc(h.id)}">Lire et reprendre</button>` : `<button class="btn secondary small" type="button" data-rl-read="${esc(h.id)}">Lire</button>`}${can ? `<button class="btn ghost small" type="button" data-edit-handover="${esc(h.id)}">Modifier</button>` : ""}</div></article>`;
};
const rlHandoverFormBase = handoverForm;
function rlFull(existing) { return rlHandoverFormBase(existing); }
handoverForm = function (existing = null) {
  if (existing && !existing.checks) return rlHandoverFormBase.apply(this, arguments);
  return rlNew(existing);
};
function rlBind(root = document) {
  root.querySelectorAll("[data-rl-read]").forEach((b) => (b.onclick = () => rlRead(b.dataset.rlRead)));
}
const rlOsBindBase = osBind;
osBind = function () { const out = rlOsBindBase.apply(this, arguments); rlBind(document); return out; };
