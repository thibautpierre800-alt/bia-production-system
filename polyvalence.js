"use strict";
/*
 * BIA Lean OS 8.16 · Polyvalence (Pérenniser › Polyvalence) : la matrice I-L-U-O par équipe et par poste.
 *  - Une équipe = des postes (avec leur standard de poste et une cible de titulaires autonomes) et des personnes.
 *  - Chaque case : pas formé, I (en formation), L (sait faire accompagné), U (autonome, qualité et cadence),
 *    O (peut former), avec la date et l'évaluateur ; l'historique est gardé.
 *  - Lecture : postes fragiles (un seul titulaire autonome ou moins), postes sous la cible, polyvalence par personne,
 *    personnes à former en priorité (les plus proches du niveau U sur les postes en manque).
 *  - Lien avec le standard de poste : à partir de L, la formation peut être enregistrée sur la version en vigueur.
 *  - Matrice à afficher (A4 paysage).
 * Données : skillsMatrix[] = { id, site_id, name, zone_id, stations[{ id, name, standard_id, target }], people[{ id, name, person_id }],
 *           levels{ "personne|poste": { lvl, date, by, hist[] } } } (collection non indexée).
 */

const PV_LV = [[0, "Pas formé", "Ne tient pas le poste"], [1, "I", "En formation"], [2, "L", "Sait faire, accompagné"], [3, "U", "Autonome : qualité et cadence"], [4, "O", "Peut former les autres"]];

function pvCan() { return role().nav.includes("training"); }
function pvManager(siteId) { return pvCan() && !role().readonly && osManager() && allowedSite(siteId, true); }
function pvTeams() { return (data.skillsMatrix || []).filter((t) => !t.archived_at && allowedSite(t.site_id) && (state.site === "group" || t.site_id === state.site)); }
function pvTeam(id) { return (data.skillsMatrix || []).find((t) => t.id === id && !t.archived_at); }
function pvLv(t, pid, sid) { return Number(t.levels?.[`${pid}|${sid}`]?.lvl || 0); }
function pvCell(lvl) { return `<span class="pv-c lv-${lvl}" aria-hidden="true"></span>`; }
function pvStats(t) {
  const st = t.stations.map((s) => { const holders = t.people.filter((p) => pvLv(t, p.id, s.id) >= 3).length, learning = t.people.filter((p) => [1, 2].includes(pvLv(t, p.id, s.id))).length; return { s, holders, learning, target: Number(s.target) || 2, fragile: holders <= 1, under: holders < (Number(s.target) || 2) }; });
  const ppl = t.people.map((p) => ({ p, n: t.stations.filter((s) => pvLv(t, p.id, s.id) >= 3).length, trainer: t.stations.filter((s) => pvLv(t, p.id, s.id) === 4).length }));
  const priorities = st.filter((x) => x.under).flatMap((x) => t.people.map((p) => ({ x, p, lvl: pvLv(t, p.id, x.s.id) })).filter((c) => c.lvl > 0 && c.lvl < 3).sort((a, b) => b.lvl - a.lvl).slice(0, 2)).sort((a, b) => (a.x.holders - b.x.holders) || (b.lvl - a.lvl));
  return { st, ppl, fragile: st.filter((x) => x.fragile).length, under: st.filter((x) => x.under).length, avg: ppl.length ? ppl.reduce((n, x) => n + x.n, 0) / ppl.length : 0, priorities };
}
function pvSave(id, fn) { const ok = commitData(() => { const t = data.skillsMatrix.find((x) => x.id === id); fn(t); t.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function pvStd(s) { return s.standard_id ? data.documents.find((d) => d.id === s.standard_id && d.type === "STANDARD" && !d.archived_at) : null; }
function pvTrainedOnStd(d, name) { if (!d || typeof stOf !== "function") return false; const v = d.version || 1; return stOf(d).trained.some((x) => x.name === name && Number(x.version || 1) === v); }

/* ---------- Page ---------- */

function pvPage() {
  const teams = pvTeams(), manager = state.site === "group" ? OPERATIONAL_SITES.some((s) => pvManager(s.id)) : pvManager(state.site);
  const head = pageHead("Pérenniser", "Polyvalence", "Qui tient quel poste, à quel niveau, et où l’équipe est fragile. Matrice I-L-U-O par équipe.", manager && teams.length ? '<button type="button" class="btn secondary" data-pv-newteam>Nouvelle équipe</button>' : "");
  if (!teams.length) return `${head}<section class="cs-empty"><h2>Commencez par une équipe</h2><p>Une équipe, ses postes (si possible avec leur standard) et les personnes qui y travaillent. Ensuite, pour chaque personne et chaque poste : I, L, U ou O. La matrice montre tout de suite les postes qui reposent sur une seule personne.</p>${manager ? '<button type="button" class="btn" data-pv-newteam>Créer la matrice d’une équipe</button>' : '<p class="hint">Le chef d’équipe, le directeur de site ou le responsable Lean crée la matrice.</p>'}</section>${pvHow()}`;
  let t = pvTeam(state.pvTeam);
  if (!t || !teams.includes(t)) { t = teams[0]; state.pvTeam = t.id; }
  const s = pvStats(t), writable = pvManager(t.site_id);
  const chips = teams.length > 1 ? `<div class="filters pv-teams">${teams.map((x) => `<button type="button" class="chip ${x.id === t.id ? "active" : ""}" data-pv-team="${esc(x.id)}">${esc(x.name)}${state.site === "group" ? ` · ${esc(getSiteName(x.site_id))}` : ""}</button>`).join("")}</div>` : "";
  const strip = `<div class="cs-summary"><div class="${s.fragile ? "bad" : ""}"><b>${s.fragile}</b><span>poste${s.fragile > 1 ? "s" : ""} fragile${s.fragile > 1 ? "s" : ""} (≤ 1 autonome)</span></div><div class="${s.under ? "bad" : ""}"><b>${s.under}</b><span>sous la cible</span></div><div><b>${String(Math.round(s.avg * 10) / 10).replace(".", ",")}</b><span>postes tenus par personne</span></div><div><b>${t.people.length} · ${t.stations.length}</b><span>personnes · postes</span></div></div>`;
  const table = !t.stations.length || !t.people.length ? `<section class="cs-empty"><h2>Postes et personnes à ajouter</h2><p>${t.stations.length ? "" : "Ajoutez les postes de l’équipe. "}${t.people.length ? "" : "Ajoutez les personnes de l’équipe."}</p>${writable ? '<button type="button" class="btn" data-pv-edit>Compléter l’équipe</button>' : ""}</section>` : pvMatrix(t, s, writable);
  const prio = s.priorities.length ? `<section class="section"><h2>À former en priorité</h2><ol class="pv-prio">${s.priorities.slice(0, 6).map((c) => `<li><button type="button" class="jn-row" data-pv-cell="${esc(c.p.id)}|${esc(c.x.s.id)}"><span class="jn-row-main"><b>${esc(c.p.name)} · ${esc(c.x.s.name)}</b><span class="hint">Aujourd’hui ${PV_LV[c.lvl][1]} (${esc(PV_LV[c.lvl][2].toLowerCase())}) · poste à ${c.x.holders}/${c.x.target} autonome${c.x.target > 1 ? "s" : ""}</span></span>${pvCell(c.lvl)}</button></li>`).join("")}</ol></section>` : s.under ? '<p class="hint section">Postes sous la cible sans personne en formation : désignez qui former.</p>' : "";
  return `${head}${chips}<div class="pv-teamhead"><div><h2>${esc(t.name)}</h2><p class="hint">${esc(getSiteName(t.site_id))}${t.zone_id ? ` · ${esc((data.zones || []).find((z) => z.id === t.zone_id)?.name || "")}` : ""}${t.updated_at ? ` · mise à jour le ${shortDate(t.updated_at)}` : ""}</p></div><div class="cs-head-tools">${writable ? '<button type="button" class="btn secondary" data-pv-edit>Postes et personnes</button>' : ""}<button type="button" class="btn ghost" data-pv-print>Matrice à afficher</button></div></div>${strip}${table}${prio}${pvHow()}`;
}
function pvMatrix(t, s, writable, print = false) {
  const head = `<tr><th scope="col" class="pv-corner">${print ? "" : '<span class="hint">Touchez une case</span>'}</th>${s.st.map((x) => { const d = pvStd(x.s); return `<th scope="col" class="pv-st ${x.fragile ? "fragile" : x.under ? "under" : ""}"><span>${esc(x.s.name)}</span>${d ? `<small>${esc(d.id)} v${d.version || 1}</small>` : ""}</th>`; }).join("")}<th scope="col" class="pv-tot">Postes tenus</th></tr>`;
  const rows = t.people.map((p) => `<tr><th scope="row" class="pv-name">${esc(p.name)}</th>${t.stations.map((st) => { const lvl = pvLv(t, p.id, st.id), d = pvStd(st), trained = lvl >= 2 && pvTrainedOnStd(d, p.name), label = `${p.name} · ${st.name} : ${PV_LV[lvl][1]}${lvl ? ` (${PV_LV[lvl][2]})` : ""}`;
    return `<td>${writable && !print ? `<button type="button" class="pv-btn" data-pv-cell="${esc(p.id)}|${esc(st.id)}" aria-label="${esc(label)}">${pvCell(lvl)}${trained ? '<i class="pv-std" title="Formé au standard en vigueur"></i>' : ""}</button>` : `<span class="pv-btn" title="${esc(label)}">${pvCell(lvl)}${trained ? '<i class="pv-std"></i>' : ""}</span>`}</td>`; }).join("")}<td class="pv-tot"><b>${s.ppl.find((x) => x.p.id === p.id)?.n || 0}</b></td></tr>`).join("");
  const foot = `<tr class="pv-foot"><th scope="row">Autonomes (U, O) / cible</th>${s.st.map((x) => `<td class="${x.fragile ? "fragile" : x.under ? "under" : "ok"}"><b>${x.holders}/${x.target}</b>${x.learning ? `<small>+${x.learning} en formation</small>` : ""}</td>`).join("")}<td></td></tr>`;
  return `<div class="pv-wrap"><table class="pv-matrix"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
    <p class="pv-legend">${PV_LV.map(([l, k, d]) => `<span>${pvCell(l)}<b>${k}</b> ${esc(d)}</span>`).join("")}<span><i class="pv-std"></i> formé au standard en vigueur</span></p>`;
}
function pvHow() {
  return `<details class="cs-how section"><summary>La polyvalence I-L-U-O</summary><ol class="cs-how-list"><li><b>I · en formation</b><span>A vu le poste, apprend avec un formateur.</span></li><li><b>L · accompagné</b><span>Sait faire, mais pas encore seul à la qualité et à la cadence.</span></li><li><b>U · autonome</b><span>Tient le poste seul, qualité et cadence, sur le standard en vigueur.</span></li><li><b>O · formateur</b><span>Peut former les autres et faire évoluer le standard.</span></li><li><b>La règle</b><span>Au moins deux à trois autonomes par poste : un poste tenu par une seule personne est fragile (absence, départ, congé).</span></li></ol></details>`;
}

/* ---------- Évaluer une case ---------- */

function pvCellForm(tid, pid, sid) {
  const t = pvTeam(tid), p = t?.people.find((x) => x.id === pid), st = t?.stations.find((x) => x.id === sid);
  if (!t || !p || !st || !pvManager(t.site_id)) return;
  const cur = t.levels?.[`${pid}|${sid}`] || {}, lvl = Number(cur.lvl || 0), d = pvStd(st), already = pvTrainedOnStd(d, p.name);
  modal(`${p.name} · ${st.name}`, `<div class="pv-eval" data-pv-eval><p class="jn-where">${esc(t.name)}${d ? ` · standard ${esc(d.id)} v${d.version || 1} (${esc(d.status || "Brouillon")})` : " · pas de standard relié"}</p>
    <div class="pv-levels" role="radiogroup" aria-label="Niveau">${PV_LV.map(([l, k, desc]) => `<button type="button" class="pv-lv ${l === lvl ? "on" : ""}" data-pv-lv="${l}" role="radio" aria-checked="${l === lvl}">${pvCell(l)}<b>${k}</b><span>${esc(desc)}</span></button>`).join("")}</div>
    <div class="cs-who-when"><label>Évalué le<input type="date" id="pvDate" max="${today()}" value="${today()}"></label><label>Par<input id="pvBy" list="ownerList" value="${esc(apMe() || "")}">${ownerDatalist()}</label></div>
    ${d && !already ? `<label class="cs-act pv-stdchk"><input type="checkbox" id="pvStd" checked> <span>Enregistrer la formation au standard ${esc(d.id)} v${d.version || 1} (à partir de L)</span></label>` : d && already ? `<p class="hint">Déjà formé au standard ${esc(d.id)} v${d.version || 1}.</p>` : ""}
    ${(cur.hist || []).length || cur.date ? `<details class="ik-out"><summary>Historique</summary><ul class="pv-hist">${[...(cur.hist || []), ...(cur.date ? [cur] : [])].reverse().map((h) => `<li><b>${PV_LV[Number(h.lvl) || 0][1]}</b> ${shortDate(h.date)}${h.by ? ` · ${esc(h.by)}` : ""}</li>`).join("")}</ul></details>` : ""}
    <div class="form-actions"><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></div>`);
  $("modalContent").querySelectorAll("[data-pv-lv]").forEach((b) => (b.onclick = () => {
    const nl = Number(b.dataset.pvLv), date = $("pvDate").value || today(), by = $("pvBy").value.trim(), withStd = $("pvStd")?.checked && nl >= 2 && d;
    if (date > today()) return toast("La date d’évaluation ne peut pas être dans le futur.");
    if (!commitData(() => {
      const x = data.skillsMatrix.find((k) => k.id === tid), key = `${pid}|${sid}`, old = x.levels[key];
      x.levels[key] = { lvl: nl, date, by, hist: [...(old?.hist || []), ...(old?.date ? [{ lvl: old.lvl, date: old.date, by: old.by }] : [])].slice(-12) };
      x.updated_at = now();
      if (withStd) { const doc = data.documents.find((k) => k.id === d.id); doc.structured_data ||= {}; doc.structured_data.st ||= {}; doc.structured_data.st.trained ||= []; doc.structured_data.st.trained.push({ name: p.name, date, by, version: doc.version || 1 }); doc.updated_at = now(); }
    })) return;
    modalDirty = false;
    closeModal();
    render();
    toast(`${p.name} · ${st.name} : ${PV_LV[nl][1]}${withStd ? " · formation au standard enregistrée" : ""}.`);
  }));
}

/* ---------- Équipe : postes et personnes ---------- */

function pvTeamForm(id = null) {
  const old = id ? pvTeam(id) : null, sites = OPERATIONAL_SITES.filter((s) => pvManager(s.id));
  if (!sites.length) return toast("Votre profil ne permet pas de créer une matrice.");
  if (!old) {
    const siteId = state.site !== "group" && pvManager(state.site) ? state.site : sites[0].id;
    modal("Nouvelle matrice de polyvalence", `<form id="pvNew" class="jn-form"><label class="field">Équipe<input id="pvName" required placeholder="Ex. Finition · équipe du matin"></label>${sites.length > 1 ? `<label class="field">Site<select id="pvSite">${sites.map((s) => `<option value="${s.id}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
      <div class="form-actions"><button class="btn jn-big">Créer, puis ajouter postes et personnes</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
    $("pvNew").onsubmit = (e) => {
      e.preventDefault();
      const name = $("pvName").value.trim(), site = $("pvSite")?.value || siteId;
      if (!name) return toast("Nommez l’équipe.");
      const tid = auNext("PV", data.skillsMatrix || []);
      if (!commitData(() => { data.skillsMatrix ||= []; data.skillsMatrix.push({ id: tid, site_id: site, name, zone_id: null, stations: [], people: [], levels: {}, created_at: now(), updated_at: now() }); })) return;
      modalDirty = false; state.pvTeam = tid; render(); pvTeamForm(tid);
    };
    return;
  }
  const stds = data.documents.filter((d) => d.type === "STANDARD" && d.site_id === old.site_id && !d.archived_at);
  const reg = (data.people || []).filter((p) => p.site_id === old.site_id && !old.people.some((x) => x.person_id === p.id));
  modal(`${old.id} · ${old.name}`, `<div class="sm-study pv-team" data-pv-id="${esc(old.id)}"><label class="ik-effect"><span>Équipe</span><input id="pvTName" value="${esc(old.name)}"></label>
    <label class="field">Zone<select id="pvTZone"><option value="">Sans zone</option>${(data.zones || []).filter((z) => z.site_id === old.site_id && !z.archived_at).map((z) => `<option value="${esc(z.id)}" ${z.id === old.zone_id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}</select></label>
    <section><h3>Postes · ${old.stations.length}</h3><ol class="tm-cil">${old.stations.map((s, i) => `<li class="tm-cilpt" data-pv-st="${esc(s.id)}"><div class="tm-pt-head"><span class="st-n">${i + 1}</span><input data-pv-stname value="${esc(s.name)}" aria-label="Poste ${i + 1}" placeholder="Nom du poste"><button type="button" class="ik-x tm-del" data-pv-stdel aria-label="Retirer le poste">×</button></div>
      <div class="pv-strow"><label class="sm-inl wide">Standard de poste<select data-pv-ststd><option value="">Aucun</option>${stds.map((d) => `<option value="${esc(d.id)}" ${d.id === s.standard_id ? "selected" : ""}>${esc(d.id)} · ${esc(d.title)}</option>`).join("")}</select></label><div class="ap-field"><span class="metric-label">Autonomes visés</span><div class="filters">${[1, 2, 3, 4].map((n) => `<button type="button" class="chip ${Number(s.target || 2) === n ? "active" : ""}" data-pv-sttarget="${n}" aria-pressed="${Number(s.target || 2) === n}">${n}</button>`).join("")}</div></div></div></li>`).join("") || '<li class="jn-empty">Aucun poste.</li>'}</ol>
      <form class="ik-add" data-pv-addst><input data-pv-addstin placeholder="Ajouter un poste (ex. Plaqueuse 2 · entrée)" enterkeyhint="next"><button class="btn secondary" aria-label="Ajouter le poste">+</button></form>${stds.some((d) => !old.stations.some((s) => s.standard_id === d.id)) ? `<div class="filters pv-fromstd"><span class="hint">Depuis les standards :</span>${stds.filter((d) => !old.stations.some((s) => s.standard_id === d.id)).slice(0, 8).map((d) => `<button type="button" class="chip" data-pv-fromstd="${esc(d.id)}">+ ${esc(d.title)}</button>`).join("")}</div>` : ""}</section>
    <section><h3>Personnes · ${old.people.length}</h3><ul class="ik-notes pv-people">${old.people.map((p) => `<li class="ik-note st-confirmee" data-pv-p="${esc(p.id)}"><span class="ik-note-t">${esc(p.name)}</span><button type="button" class="ik-x" data-pv-pdel aria-label="Retirer ${esc(p.name)}">×</button></li>`).join("")}</ul>
      <form class="ik-add" data-pv-addp><input data-pv-addpin list="pvReg" placeholder="Nom et prénom" enterkeyhint="next" autocomplete="off"><datalist id="pvReg">${reg.map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist><button class="btn secondary" aria-label="Ajouter la personne">+</button></form></section>
    <div class="form-actions"><button type="button" class="btn" data-pv-done>Voir la matrice</button></div></div>`);
  modalSaver = () => { uxFlush(); return true; };
  pvTeamBind(old.id);
}
function pvTeamBind(tid) {
  const root = $("modalContent")?.querySelector(`.pv-team[data-pv-id="${tid}"]`);
  if (!root) return;
  const redo = (focus) => { pvTeamForm(tid); if (focus) $("modalContent").querySelector(focus)?.focus(); };
  $("pvTName").onchange = () => { const v = $("pvTName").value.trim(); if (v) pvSave(tid, (t) => { t.name = v; }); };
  $("pvTZone").onchange = () => pvSave(tid, (t) => { t.zone_id = $("pvTZone").value || null; });
  const stOf2 = (el) => el.closest("[data-pv-st]")?.dataset.pvSt;
  root.querySelectorAll("[data-pv-stname]").forEach((el) => (el.onchange = () => { const v = el.value.trim(); if (v) pvSave(tid, (t) => { t.stations.find((s) => s.id === stOf2(el)).name = v; }); }));
  root.querySelectorAll("[data-pv-ststd]").forEach((el) => (el.onchange = () => pvSave(tid, (t) => { t.stations.find((s) => s.id === stOf2(el)).standard_id = el.value || null; })));
  root.querySelectorAll("[data-pv-sttarget]").forEach((b) => (b.onclick = () => { if (!pvSave(tid, (t) => { t.stations.find((s) => s.id === stOf2(b)).target = Number(b.dataset.pvSttarget); })) return; b.parentElement.querySelectorAll("[data-pv-sttarget]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  root.querySelectorAll("[data-pv-stdel]").forEach((b) => (b.onclick = () => { const li = b.closest("[data-pv-st]"), sid = li.dataset.pvSt, used = Object.keys(pvTeam(tid).levels || {}).some((k) => k.endsWith(`|${sid}`) && pvTeam(tid).levels[k].lvl); if (used && !li.dataset.confirm) { li.dataset.confirm = "1"; toast("Des niveaux sont notés sur ce poste : touchez × encore une fois pour le retirer."); return; } if (pvSave(tid, (t) => { t.stations = t.stations.filter((s) => s.id !== sid); Object.keys(t.levels).filter((k) => k.endsWith(`|${sid}`)).forEach((k) => delete t.levels[k]); })) redo(); }));
  root.querySelector("[data-pv-addst]").onsubmit = (e) => { e.preventDefault(); const v = root.querySelector("[data-pv-addstin]").value.trim(); if (!v) return; if (pvSave(tid, (t) => { t.stations.push({ id: uid("PS"), name: v, standard_id: null, target: 2 }); })) redo("[data-pv-addstin]"); };
  root.querySelectorAll("[data-pv-fromstd]").forEach((b) => (b.onclick = () => { const d = data.documents.find((k) => k.id === b.dataset.pvFromstd); if (d && pvSave(tid, (t) => { t.stations.push({ id: uid("PS"), name: d.title, standard_id: d.id, target: 2 }); })) redo(); }));
  root.querySelector("[data-pv-addp]").onsubmit = (e) => {
    e.preventDefault();
    const v = root.querySelector("[data-pv-addpin]").value.trim(), t0 = pvTeam(tid);
    if (!v) return;
    if (t0.people.some((p) => p.name.toLowerCase() === v.toLowerCase())) { toast("Cette personne est déjà dans l’équipe."); return; }
    const reg = (data.people || []).find((p) => p.site_id === t0.site_id && p.name === v);
    if (pvSave(tid, (t) => { t.people.push({ id: uid("PP"), name: v, person_id: reg?.id || null }); })) redo("[data-pv-addpin]");
  };
  root.querySelectorAll("[data-pv-pdel]").forEach((b) => (b.onclick = () => { const li = b.closest("[data-pv-p]"), pid = li.dataset.pvP; if (!li.dataset.confirm) { li.dataset.confirm = "1"; toast("Touchez × encore une fois : ses niveaux seront retirés de la matrice."); return; } if (pvSave(tid, (t) => { t.people = t.people.filter((p) => p.id !== pid); Object.keys(t.levels).filter((k) => k.startsWith(`${pid}|`)).forEach((k) => delete t.levels[k]); })) redo(); }));
  root.querySelector("[data-pv-done]").onclick = () => { uxFlush(); modalDirty = false; closeModal(); state.pvTeam = tid; render(); };
}
function pvPrint(tid) {
  const t = pvTeam(tid);
  if (!t) return;
  modal(`${t.name} · Polyvalence`, `<article class="pv-sheet"><header><div><small>MATRICE DE POLYVALENCE · I · L · U · O</small><h3>${esc(t.name)}</h3><p>${esc(getSiteName(t.site_id))} · mise à jour le ${shortDate(t.updated_at)}</p></div></header>${pvMatrix(t, pvStats(t), false, true)}<footer>Un poste tenu par une seule personne autonome est fragile : on forme avant l’absence, pas pendant.</footer></article>
    <style media="print">@page{size:A4 landscape;margin:8mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
}

/* ---------- Branchements ---------- */

const pvRenderTrainingBase = renderTraining;
renderTraining = function () { return state.pvOn && pvCan() ? pvPage() : pvRenderTrainingBase.apply(this, arguments); };
state.pvOn ??= false;
const pvTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = pvTabsBase(stage);
  if (stage?.id !== "perenniser" || !pvCan()) return out;
  const tr = out.find((t) => t.key === "training");
  if (tr) tr.set = { ...(tr.set || {}), pvOn: false };
  if (!out.some((t) => t.key === "polyvalence")) { const i = out.findIndex((t) => t.key === "training"); out.splice(i >= 0 ? i + 1 : out.length, 0, { key: "polyvalence", label: "Polyvalence", view: "training", set: { pvOn: true } }); }
  return out;
};
const pvWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = pvWatchBase();
  if (!pvCan() || !["lean", "director", "teamlead"].includes(state.role)) return base;
  const rows = pvTeams().map((t) => ({ t, s: pvStats(t) })).filter((x) => x.s.fragile && x.t.people.length).slice(0, 2).map((x) => `<button type="button" class="jn-row" data-pv-go="${esc(x.t.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">ILUO</span><b>${jnPlural(x.s.fragile, "poste fragile", "postes fragiles")} · ${esc(x.t.name)}</b><span class="hint">Une seule personne autonome, ou aucune</span></span></button>`);
  if (!rows.length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${rows.join("")}$2`);
};
function pvBindGlobal(root = document) {
  root.querySelectorAll("[data-pv-newteam]").forEach((b) => (b.onclick = () => pvTeamForm()));
  root.querySelectorAll("[data-pv-edit]").forEach((b) => (b.onclick = () => pvTeamForm(state.pvTeam)));
  root.querySelectorAll("[data-pv-print]").forEach((b) => (b.onclick = () => pvPrint(state.pvTeam)));
  root.querySelectorAll("[data-pv-team]").forEach((b) => (b.onclick = () => { state.pvTeam = b.dataset.pvTeam; render(); }));
  root.querySelectorAll("[data-pv-cell]").forEach((b) => { if (!b.closest(".modal")) b.onclick = () => { const [pid, sid] = b.dataset.pvCell.split("|"); pvCellForm(state.pvTeam, pid, sid); }; });
  root.querySelectorAll("[data-pv-go]").forEach((b) => (b.onclick = () => { state.pvTeam = b.dataset.pvGo; state.pvOn = true; switchView("training"); }));
}
const pvOsBindBase = osBind;
osBind = function () { const out = pvOsBindBase.apply(this, arguments); pvBindGlobal(document); return out; };
