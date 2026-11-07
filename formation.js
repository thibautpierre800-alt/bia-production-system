"use strict";
/*
 * BIA Lean OS 8.26 · Formation et habilitations : les échéances d'abord, la session en une fois, le dossier complet.
 *  - Échéances : qualifications expirées, à renouveler sous 30 jours puis sous 90 jours, formations suivies mais pas
 *    encore validées ; « Enregistrer le recyclage » ou « Planifier » (action datée à l'échéance).
 *  - Session : une formation, une date, un formateur, les présents cochés dans la liste ; « Formé » ou « Validé »
 *    (preuve et validateur) ; une fiche par personne, avec l'échéance calculée.
 *  - Dossier individuel : en plus des formations, les postes tenus (polyvalence I-L-U-O), les standards et les
 *    leçons ponctuelles (OPL) sur lesquels la personne est formée.
 * Données : trainingRecords[] (existant) : champ ajouté session_id ; aucune nouvelle collection.
 */

function frCan() { return role().nav.includes("training"); }
function frMgr() { return frCan() && osManager() && !role().readonly; }
function frLatest() {
  const people = new Set(trainingPeople().map((p) => p.id)), map = new Map();
  (data.trainingRecords || []).filter((r) => people.has(r.person_id)).forEach((r) => { const k = `${r.person_id}|${r.training_id}`, o = map.get(k); if (!o || String(r.date) > String(o.date)) map.set(k, r); });
  return [...map.values()];
}
function frDays(d) { return Math.round((Date.parse(d + "T12:00:00") - Date.parse(today() + "T12:00:00")) / 864e5); }
function frDue() {
  const rows = frLatest().filter((r) => r.status === "Validé" && r.expires_at).map((r) => ({ r, d: frDays(r.expires_at) }));
  return { expired: rows.filter((x) => x.d < 0), soon: rows.filter((x) => x.d >= 0 && x.d <= 30), later: rows.filter((x) => x.d > 30 && x.d <= 90), pending: frLatest().filter((r) => ["En cours", "Formé"].includes(r.status)) };
}
function frRow(r, d) {
  const p = data.people.find((x) => x.id === r.person_id), t = data.trainingCatalog.find((x) => x.id === r.training_id), late = d !== undefined && d < 0;
  const when = d === undefined ? `${esc(r.status)} depuis le ${shortDate(r.date)}${r.trainer ? ` · ${esc(r.trainer)}` : ""}` : late ? `Expirée depuis ${-d} j (le ${shortDate(r.expires_at)})` : `Expire le ${shortDate(r.expires_at)}, dans ${d} j`;
  return `<div class="fr-row ${late ? "late" : d !== undefined && d <= 30 ? "soon" : ""}"><button type="button" class="sg-main" data-training-person="${esc(r.person_id)}"><span class="id-top"><span class="sg-sev">${esc(t?.code || r.training_id)}</span><span class="hint">${esc(getSiteName(p?.site_id))}${p?.job ? ` · ${esc(p.job)}` : ""}</span></span><b>${esc(p?.name || r.person_id)} · ${esc(t?.title || "")}</b><span class="hint ${late ? "sg-late" : ""}">${when}</span></button>${frMgr() ? `<div class="fr-acts"><button type="button" class="btn small" data-fr-renew="${esc(r.person_id)}|${esc(r.training_id)}">${d === undefined ? "Enregistrer la validation" : "Enregistrer le recyclage"}</button>${d !== undefined ? `<button type="button" class="btn small ghost" data-fr-plan="${esc(r.id)}">Planifier</button>` : ""}</div>` : ""}</div>`;
}
function frPanel() {
  const due = frDue(), sec = (title, list, empty, withD = true) => `<section class="section"><div class="section-title"><h2>${title} · ${list.length}</h2></div>${list.length ? `<div class="sg-list">${list.map((x) => (withD ? frRow(x.r, x.d) : frRow(x))).join("")}</div>` : `<p class="hint">${empty}</p>`}</section>`;
  const strip = `<div class="cs-summary"><div class="${due.expired.length ? "bad" : ""}"><b>${due.expired.length}</b><span>expirée${due.expired.length > 1 ? "s" : ""}</span></div><div class="${due.soon.length ? "bad" : ""}"><b>${due.soon.length}</b><span>à renouveler sous 30 j</span></div><div><b>${due.later.length}</b><span>sous 90 j</span></div><div><b>${due.pending.length}</b><span>à valider</span></div></div>`;
  return `${strip}${sec("Expirées", due.expired.sort((a, b) => a.d - b.d), "Aucune qualification expirée.")}${sec("À renouveler sous 30 jours", due.soon.sort((a, b) => a.d - b.d), "Rien à renouveler ce mois-ci.")}${due.later.length ? sec("Sous 90 jours", due.later.sort((a, b) => a.d - b.d), "") : ""}${sec("Suivies, pas encore validées", due.pending.map((r) => r).sort((a, b) => String(a.date).localeCompare(String(b.date))), "Toutes les formations suivies sont validées.", false)}
    <p class="hint">Une qualification est datée par la validation ; son échéance vient de la durée de validité de la formation au catalogue.</p>`;
}
function frPage(baseHtml) {
  const tpl = document.createElement("template");
  tpl.innerHTML = baseHtml;
  const head = tpl.content.querySelector(".page-head")?.outerHTML || "", tabs = tpl.content.querySelector(".tabs");
  tabs?.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.trainingTab === "due"));
  return `${head}${tabs?.outerHTML || ""}${frPanel()}`;
}

/* ---------- Session de formation ---------- */

function frSession(preset = {}) {
  if (!frMgr()) return toast("La session est enregistrée par un responsable.");
  const people = trainingPeople().filter((p) => allowedSite(p.site_id, true));
  if (!people.length) return toast("Ajoutez d’abord des personnes au suivi formation.");
  let status = "Formé";
  const tid = preset.training_id || data.trainingCatalog.find((t) => t.status === "Publié")?.id || data.trainingCatalog[0]?.id;
  modal("Session de formation", `<form id="frForm" class="jn-form"><p class="jn-lead">Une formation, une date, les présents : une fiche par personne, d’un coup.</p>
    <label class="field">Formation<select id="frTraining">${data.trainingCatalog.map((t) => `<option value="${esc(t.id)}" ${t.id === tid ? "selected" : ""}>${esc(t.code)} · ${esc(t.title)}</option>`).join("")}</select></label>
    <div class="bp-two"><label class="field">Date<input type="date" id="frDate" max="${today()}" value="${today()}" required></label><label class="field">Formateur<input id="frTrainer" list="ownerList" required value="${esc(apMe() || "")}">${ownerDatalist()}</label></div>
    <fieldset class="rl-items"><legend>Présents · <button type="button" class="md-link" data-fr-all>tout cocher</button></legend>${people.map((p) => `<label class="rl-item"><input type="checkbox" value="${esc(p.id)}" ${preset.person_ids?.includes(p.id) ? "checked" : ""}><span><b>${esc(p.name)}</b><small>${esc(getSiteName(p.site_id))} · ${esc(p.job || "")}</small></span></label>`).join("")}</fieldset>
    <div class="ap-field"><span class="metric-label">À l’issue de la session</span><div class="rl-st fr-st"><button type="button" class="rl-sb sb-watch on" data-fr-st="Formé" aria-pressed="true">Formés : à valider au poste</button><button type="button" class="rl-sb sb-ok" data-fr-st="Validé" aria-pressed="false">Validés : compétence vérifiée</button></div></div>
    <div class="fr-valid" hidden><label class="field">Preuve<input id="frEvidence" placeholder="Ex. mise en situation réussie au poste, quiz 80 % minimum"></label><div class="bp-two"><label class="field">Niveau validé<select id="frLevel">${TRAINING_LEVELS.map((x, i) => `<option value="${i}" ${i === 4 ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label><label class="field">Validé par<input id="frValidator" list="ownerList" value="${esc(apMe() || osActor())}"></label></div></div>
    <div class="form-actions"><button class="btn jn-big">Enregistrer la session</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("frForm");
  root.querySelector("[data-fr-all]").onclick = () => root.querySelectorAll(".rl-item input").forEach((i) => (i.checked = true));
  root.querySelectorAll("[data-fr-st]").forEach((b) => (b.onclick = () => { status = b.dataset.frSt; root.querySelectorAll("[data-fr-st]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); root.querySelector(".fr-valid").hidden = status !== "Validé"; }));
  root.onsubmit = (e) => {
    e.preventDefault();
    const ids = [...root.querySelectorAll(".rl-item input:checked")].map((i) => i.value), t = data.trainingCatalog.find((x) => x.id === $("frTraining").value), date = $("frDate").value, trainer = $("frTrainer").value.trim();
    if (!ids.length) return toast("Cochez les personnes présentes.");
    if (!date || date > today()) return toast("Une session se date au plus tard aujourd’hui.");
    if (!trainer) { $("frTrainer").focus(); return toast("Qui a animé la session ?"); }
    const evidence = $("frEvidence").value.trim(), validator = $("frValidator").value.trim(), level = status === "Validé" ? Number($("frLevel").value) : 2;
    if (status === "Validé" && (!evidence || !validator)) return toast("Pour valider : la preuve et le validateur.");
    const expiry = status === "Validé" && t?.validity_months ? new Date(new Date(date + "T12:00:00").setMonth(new Date(date + "T12:00:00").getMonth() + t.validity_months)).toISOString().slice(0, 10) : null, sid = uid("SES");
    if (!commitData(() => {
      for (const pid of ids) data.trainingRecords.unshift({ id: nextId("REC", data.trainingRecords), person_id: pid, training_id: t.id, date, trainer, attendance: "Présent", score: null, level, status, evidence: status === "Validé" ? evidence : "", validated_by: status === "Validé" ? validator : "", validated_at: status === "Validé" ? date : null, expires_at: expiry, session_id: sid, created_at: now() });
    })) return;
    if (typeof idSetMe === "function") idSetMe(trainer);
    modalDirty = false; closeModal(); render();
    toast(`${jnPlural(ids.length, "personne enregistrée", "personnes enregistrées")} · ${t.code} · ${status === "Validé" ? "validé" : "à valider au poste"}.`);
  };
}

/* ---------- Dossier individuel complet ---------- */

function frSkills(p) {
  const name = p.name, out = [];
  (data.skillsMatrix || []).filter((t) => !t.archived_at).forEach((t) => {
    const me = (t.people || []).find((x) => x.person_id === p.id || x.name === name);
    if (!me) return;
    t.stations.forEach((s) => { const l = Number(t.levels?.[`${me.id}|${s.id}`]?.lvl || 0); if (l) out.push(["Poste", `${s.name} · ${t.name}`, ["", "I · en formation", "L · accompagné", "U · autonome", "O · formateur"][l]]); });
  });
  (data.documents || []).filter((d) => d.type === "STANDARD" && !d.archived_at && typeof stOf === "function").forEach((d) => { const v = d.version || 1, tr = (stOf(d).trained || []).find((x) => x.name === name); if (tr) out.push(["Standard", `${d.id} · ${d.title}`, Number(tr.version || 1) === v ? `formé à la version ${v}` : `formé à la version ${tr.version || 1} : à reformer`]); });
  (data.opls || []).filter((o) => !o.archived_at).forEach((o) => { const v = o.version || 1, tr = (o.trained || []).filter((x) => x.name === name).sort((a, b) => (b.version || 1) - (a.version || 1))[0]; if (tr) out.push(["OPL", `${o.id} · ${o.title}`, (tr.version || 1) === v ? `formé le ${shortDate(tr.date)}` : "à reformer sur la nouvelle version"]); });
  return out;
}

/* ---------- Branchements ---------- */

const frRenderTrainingBase = renderTraining;
renderTraining = function () {
  if (state.oplOn || state.pvOn || !frCan()) return frRenderTrainingBase.apply(this, arguments);
  const due = frDue(), n = due.expired.length + due.soon.length, wantDue = state.trainingTab === "due";
  if (wantDue) state.trainingTab = "catalog";
  let html = frRenderTrainingBase.apply(this, arguments);
  if (wantDue) state.trainingTab = "due";
  html = html.replace('<div class="tabs">', `<div class="tabs"><button class="tab ${wantDue ? "active" : ""}" data-training-tab="due">Échéances${n ? ` · ${n}` : ""}</button>`);
  if (frMgr()) html = html.replace("data-new-training-record>+ Enregistrer une formation</button>", 'data-new-training-record>+ Enregistrer une formation</button><button class="btn secondary" type="button" data-fr-session>Session de formation</button>');
  return wantDue ? frPage(html) : html;
};
const frOpenPersonBase = openTrainingPerson;
openTrainingPerson = function (id) {
  const out = frOpenPersonBase.apply(this, arguments), p = data.people.find((x) => x.id === id), sheet = $("modalContent")?.querySelector(".hr-sheet");
  if (!p || !sheet) return out;
  const rows = frSkills(p);
  sheet.insertAdjacentHTML("beforeend", `<section class="section fr-skills"><h3>Compétences au poste</h3>${rows.length ? `<table class="data-table"><thead><tr><th>Type</th><th>Poste, standard ou leçon</th><th>Niveau</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table>` : '<p class="hint">Aucun poste, standard ou OPL enregistré pour cette personne.</p>'}</section>`);
  return out;
};
const frWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = frWatchBase();
  if (!frMgr()) return base;
  const due = frDue(), n = due.expired.length + due.soon.length;
  if (!n) return base;
  const row = `<button type="button" class="jn-row" data-fr-go><span class="jn-row-main"><span class="jn-tag tone-warn">Formation</span><b>${jnPlural(n, "qualification à renouveler", "qualifications à renouveler")}</b><span class="hint">${due.expired.length ? `${due.expired.length} expirée${due.expired.length > 1 ? "s" : ""}` : "sous 30 jours"}</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${row}$2`);
};
function frBind(root = document) {
  root.querySelectorAll("[data-fr-session]").forEach((b) => (b.onclick = () => frSession()));
  root.querySelectorAll("[data-fr-renew]").forEach((b) => (b.onclick = () => { const [pid, tid] = b.dataset.frRenew.split("|"); trainingRecordForm(pid, tid); }));
  root.querySelectorAll("[data-fr-plan]").forEach((b) => (b.onclick = () => {
    const r = data.trainingRecords.find((x) => x.id === b.dataset.frPlan), p = data.people.find((x) => x.id === r?.person_id), t = data.trainingCatalog.find((x) => x.id === r?.training_id);
    if (!r || !p) return;
    actionForm(null, { site_id: p.site_id, title: `Recycler ${p.name} : ${t?.title || r.training_id}`, owner: p.manager || "", due_date: r.expires_at < today() ? today() : r.expires_at, origin_type: "Formation", description: `${t?.code || ""} · qualification valable jusqu’au ${shortDate(r.expires_at)}.` });
  }));
  root.querySelectorAll("[data-fr-go]").forEach((b) => (b.onclick = () => { state.trainingTab = "due"; state.oplOn = false; state.pvOn = false; switchView("training"); }));
}
const frOsBindBase = osBind;
osBind = function () { const out = frOsBindBase.apply(this, arguments); frBind(document); return out; };
