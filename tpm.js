"use strict";
/*
 * BIA Lean OS 8.15 · TPM et maintenance autonome (Observer › TPM).
 *  - Machines par site et zone, avec leur criticité (A, B, C).
 *  - Étiquettes d'anomalie au téléphone, photo d'abord : bleue (l'équipe la traite) ou rouge (maintenance),
 *    nature de l'anomalie, échéance ; traitement avec ce qui a été fait et la photo après.
 *  - Standard CIL par machine (nettoyer, inspecter, lubrifier, resserrer ; quoi, comment, fréquence, minutes),
 *    fiche à afficher, et tournée au téléphone : OK ou anomalie point par point, chaque anomalie devient une étiquette.
 *  - Pannes : début, remise en route, cause ; heures perdues, MTTR et MTBF calendaire sur 90 jours, Pareto par machine.
 * Données : machines[], tpmTags[], cilRuns[], breakdowns[] (collections non indexées : aucun id de ces collections
 * n'est mis dans un champ contrôlé d'une collection indexée).
 */

const TM_KINDS = [["fuite", "Fuite"], ["salete", "Saleté"], ["usure", "Usure, casse"], ["desserrage", "Desserrage, jeu"], ["bruit", "Bruit, vibration, chauffe"], ["source", "Source de saleté"], ["acces", "Accès difficile"], ["securite", "Sécurité"], ["autre", "Autre"]];
const TM_CIL = [["nettoyer", "Nettoyer"], ["inspecter", "Inspecter"], ["lubrifier", "Lubrifier"], ["serrer", "Resserrer"]];
const TM_FREQ = [["poste", "Chaque poste", 1], ["jour", "Chaque jour", 1], ["semaine", "Chaque semaine", 7], ["mois", "Chaque mois", 30]];
const TM_CRIT = [["A", "A · critique"], ["B", "B · importante"], ["C", "C · secondaire"]];

function tmCan() { return role().nav.includes("terrain"); }
function tmWritable(siteId) { return tmCan() && !role().readonly && allowedSite(siteId, true); }
function tmManager(siteId) { return tmWritable(siteId) && osManager(); }
function tmScope(rows) { return (rows || []).filter((x) => !x.archived_at && allowedSite(x.site_id) && (state.site === "group" || x.site_id === state.site)); }
function tmMachines() { return tmScope(data.machines).sort((a, b) => String(a.criticality).localeCompare(String(b.criticality)) || a.name.localeCompare(b.name, "fr")); }
function tmMachine(id) { return (data.machines || []).find((m) => m.id === id && !m.archived_at); }
function tmTags(f = () => true) { return tmScope(data.tpmTags).filter(f); }
function tmOpenTags(mid) { return tmTags((t) => t.status !== "traitee" && (!mid || t.machine_id === mid)); }
function tmLate(t) { return t.status !== "traitee" && t.due_date && t.due_date < today(); }
function tmHours(b) { return Math.max(0, ((b.end ? Date.parse(b.end) : Date.now()) - Date.parse(b.start)) / 36e5); }
function tmDur(h) { if (h === null || h === undefined) return "—"; const m = Math.round(h * 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`; }
function tmDowns(mid, days = 90) { const from = Date.now() - days * 864e5; return tmScope(data.breakdowns).filter((b) => (!mid || b.machine_id === mid) && (Date.parse(b.start) >= from || !b.end)); }
function tmStats(mid, days = 90) {
  const rows = tmDowns(mid, days), closed = rows.filter((b) => b.end), starts = rows.map((b) => Date.parse(b.start)).sort((a, b) => a - b), gaps = starts.slice(1).map((s, i) => (s - starts[i]) / 36e5);
  return { n: rows.length, lost: rows.reduce((n, b) => n + tmHours(b), 0), mttr: closed.length ? closed.reduce((n, b) => n + tmHours(b), 0) / closed.length : null, mtbf: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null, open: rows.filter((b) => !b.end) };
}
function tmAddDays(d, n) { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function tmCilDays(m) { const pts = m.cil || []; return pts.length ? Math.min(...pts.map((p) => TM_FREQ.find((f) => f[0] === p.freq)?.[2] || 7)) : null; }
function tmLastRun(mid) { return (data.cilRuns || []).filter((r) => r.machine_id === mid).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null; }
function tmCilDue(m) { const d = tmCilDays(m); if (!d) return null; const last = tmLastRun(m.id); return last ? tmAddDays(last.date, d) : today(); }
function tmLocal(iso) { const d = iso ? new Date(iso) : new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function tmWhen(iso) { return iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"; }
function tmZoneName(id) { return (data.zones || []).find((z) => z.id === id)?.name || ""; }
function tmKind(k) { return TM_KINDS.find((x) => x[0] === k)?.[1] || "Autre"; }
function tmTagChip(t) { return `<span class="tm-color ${t.color === "rouge" ? "rouge" : "bleue"}">${t.color === "rouge" ? "Rouge · maintenance" : "Bleue · équipe"}</span>`; }

/* ---------- Page TPM ---------- */

function tmPage() {
  const ms = tmMachines(), writable = !role().readonly && (state.site === "group" ? OPERATIONAL_SITES.some((s) => tmWritable(s.id)) : tmWritable(state.site));
  const manager = state.site === "group" ? OPERATIONAL_SITES.some((s) => tmManager(s.id)) : tmManager(state.site);
  const open = tmOpenTags(), late = open.filter(tmLate), reds = open.filter((t) => t.color === "rouge");
  const cilLate = ms.filter((m) => { const d = tmCilDue(m); return d && d < today(); }), st = tmStats(null), down = st.open;
  const head = pageHead("Observer", "TPM · maintenance autonome", "Les machines tenues par leurs équipes : étiquettes d’anomalie, tournées de nettoyage-inspection-lubrification, pannes suivies.", writable && ms.length ? `<div class="cs-head-tools"><button type="button" class="btn" data-tm-tag>Poser une étiquette</button><button type="button" class="btn secondary" data-tm-down>Déclarer une panne</button></div>` : "");
  if (!ms.length) return `${head}<section class="cs-empty"><h2>Commencez par vos machines critiques</h2><p>Une machine par ligne ou par poste qui compte : celle qui arrête le flux quand elle tombe. Ensuite, posez des étiquettes sur ce qui fuit, s’use ou se desserre, et écrivez le standard de nettoyage-inspection-lubrification avec l’équipe.</p>${manager ? '<button type="button" class="btn" data-tm-newm>Ajouter une machine</button>' : '<p class="hint">Le responsable d’équipe, de site ou Lean ajoute les machines.</p>'}</section>${tmHow()}`;
  const strip = `<div class="cs-summary"><div><b>${open.length}</b><span>étiquette${open.length > 1 ? "s" : ""} ouverte${open.length > 1 ? "s" : ""}${reds.length ? ` · ${reds.length} rouge${reds.length > 1 ? "s" : ""}` : ""}</span></div><div class="${late.length ? "bad" : ""}"><b>${late.length}</b><span>en retard</span></div><div class="${cilLate.length ? "bad" : ""}"><b>${cilLate.length}</b><span>tournée${cilLate.length > 1 ? "s" : ""} CIL en retard</span></div><div class="${down.length ? "bad" : ""}"><b>${down.length ? down.length : tmDur(st.lost)}</b><span>${down.length ? `machine${down.length > 1 ? "s" : ""} en panne` : "perdues en pannes · 90 j"}</span></div></div>`;
  const card = (m) => {
    const tags = tmOpenTags(m.id), r = tags.filter((t) => t.color === "rouge").length, due = tmCilDue(m), s = tmStats(m.id), isDown = s.open.length > 0;
    const tone = isDown ? "tone-bad" : tags.some(tmLate) || (due && due < today()) ? "tone-warn" : "tone-ok";
    return `<button type="button" class="cs-card tm-card ${tone}" data-tm-open="${esc(m.id)}"><span class="cs-card-top"><span class="cs-where">${esc(getSiteName(m.site_id))}${m.zone_id ? ` · ${esc(tmZoneName(m.zone_id))}` : ""}</span><span class="tm-crit c-${esc(m.criticality)}">${esc(m.criticality)}</span></span>
      <b class="cs-card-name">${esc(m.name)}</b>${isDown ? `<span class="tm-down-line">En panne depuis ${tmDur(tmHours(s.open[0]))}</span>` : ""}
      <span class="sm-figs"><span class="${r ? "warn" : ""}"><small>Étiquettes</small><b>${tags.length ? `${tags.length - r} <i class="tm-dot bleue"></i> ${r} <i class="tm-dot rouge"></i>` : "0"}</b></span><span class="${due && due < today() ? "warn" : ""}"><small>Tournée CIL</small><b>${due ? (due < today() ? "En retard" : due === today() ? "Aujourd’hui" : shortDate(due).slice(0, 5)) : "À écrire"}</b></span><span><small>Pannes 90 j</small><b>${s.n ? `${s.n} · ${tmDur(s.lost)}` : "0"}</b></span></span>
      <span class="cs-card-foot">MTTR ${tmDur(s.mttr)} · MTBF ${s.mtbf === null ? "—" : tmDur(s.mtbf)}</span></button>`;
  };
  const tagRow = (t) => { const m = tmMachine(t.machine_id); return `<button type="button" class="jn-row tm-tagrow" data-tm-tagopen="${esc(t.id)}">${t.photo ? phImg(t.photo, "tm-thumb", "Anomalie") : '<span class="tm-thumb tm-nophoto"></span>'}<span class="jn-row-main"><span>${tmTagChip(t)} <span class="jn-tag">${esc(tmKind(t.kind))}</span></span><b>${esc(t.what)}</b><span class="hint">${esc(m?.name || "")} · ${esc(t.id)}${t.due_date ? ` · ${tmLate(t) ? "<em class='tm-late'>en retard</em>" : `avant le ${shortDate(t.due_date)}`}` : ""}</span></span></button>`; };
  const sorted = open.slice().sort((a, b) => (b.kind === "securite") - (a.kind === "securite") || tmLate(b) - tmLate(a) || String(a.due_date || "").localeCompare(String(b.due_date || "")));
  const pareto = tmPareto(ms);
  return `${head}${strip}<div class="cs-grid">${ms.map(card).join("")}${manager ? '<button type="button" class="cs-card tm-addcard" data-tm-newm><b>+ Ajouter une machine</b><span>Nom, zone, criticité</span></button>' : ""}</div>
    <section class="section"><div class="section-title"><h2>Étiquettes ouvertes · ${open.length}</h2></div>${sorted.length ? `<div class="jn-rows tm-tags">${sorted.slice(0, 30).map(tagRow).join("")}</div>` : '<p class="hint">Aucune étiquette ouverte.</p>'}</section>
    ${pareto}${tmHow()}`;
}
function tmPareto(ms) {
  const rows = ms.map((m) => ({ m, h: tmStats(m.id).lost })).filter((x) => x.h >= 1 / 60).sort((a, b) => b.h - a.h).slice(0, 8);
  if (!rows.length) return "";
  const max = rows[0].h;
  return `<section class="section"><h2>Heures perdues en pannes · 90 jours</h2><figure class="sm-trend tm-pareto" role="img" aria-label="${esc(rows.map((x) => `${x.m.name} ${tmDur(x.h)}`).join(", "))}"><div class="sm-g">${rows.map((x) => `<div class="sm-g-row"><span class="sm-g-l">${esc(x.m.name)}</span><div class="sm-g-track"><div class="sm-g-in"><span class="sm-tbar warn" style="width:${((x.h / max) * 100).toFixed(1)}%"></span><b class="sm-g-t" style="left:${((x.h / max) * 100).toFixed(1)}%">${tmDur(x.h)}</b></div></div></div>`).join("")}</div><figcaption>Les machines du haut d’abord : c’est là que la maintenance autonome rapporte le plus.</figcaption></figure></section>`;
}
function tmHow() {
  return `<details class="cs-how section"><summary>La maintenance autonome en cinq gestes</summary><ol class="cs-how-list"><li><b>Nettoyer pour inspecter</b><span>En nettoyant, on touche et on voit : fuites, jeux, usures, bruits.</span></li><li><b>Étiqueter chaque anomalie</b><span>Bleue si l’équipe peut la traiter, rouge s’il faut la maintenance. Une photo, une échéance.</span></li><li><b>Traiter et retirer l’étiquette</b><span>Avec ce qui a été fait et la photo après : c’est la preuve.</span></li><li><b>Écrire le standard CIL</b><span>Nettoyer, inspecter, lubrifier, resserrer : quoi, comment, à quelle fréquence, en combien de minutes.</span></li><li><b>Suivre les pannes</b><span>Heures perdues, MTTR (temps moyen de réparation) et MTBF (temps moyen entre pannes) par machine.</span></li></ol></details>`;
}

/* ---------- Machine ---------- */

function tmMachineForm(id = null) {
  const old = id ? tmMachine(id) : null, sites = OPERATIONAL_SITES.filter((s) => tmManager(s.id));
  if (!sites.length) return toast("Votre profil ne permet pas d’ajouter une machine.");
  let siteId = old?.site_id || (state.site !== "group" && tmManager(state.site) ? state.site : sites[0].id), crit = old?.criticality || "A";
  const zoneOpts = (sid) => `<option value="">Sans zone</option>${(data.zones || []).filter((z) => z.site_id === sid && !z.archived_at).map((z) => `<option value="${esc(z.id)}" ${z.id === old?.zone_id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}`;
  modal(old ? `${old.id} · Machine` : "Nouvelle machine", `<form id="tmMForm" class="jn-form"><label class="field">Machine<input id="tmMName" required value="${esc(old?.name || "")}" placeholder="Ex. Plaqueuse de chants 2"></label>
    ${sites.length > 1 && !old ? `<label class="field">Site<select id="tmMSite">${sites.map((s) => `<option value="${s.id}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <label class="field">Zone<select id="tmMZone">${zoneOpts(siteId)}</select></label>
    <div class="ap-field"><span class="metric-label">Criticité</span><div class="filters">${TM_CRIT.map(([k, l]) => `<button type="button" class="chip ${k === crit ? "active" : ""}" data-tm-crit="${k}" aria-pressed="${k === crit}">${l}</button>`).join("")}</div></div>
    <label class="field">Équipe ou responsable<input id="tmMOwner" list="ownerList" value="${esc(old?.owner || "")}" placeholder="Qui tient la machine au quotidien">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">${old ? "Enregistrer" : "Ajouter la machine"}</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  root.querySelectorAll("[data-tm-crit]").forEach((b) => (b.onclick = () => { crit = b.dataset.tmCrit; root.querySelectorAll("[data-tm-crit]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  if ($("tmMSite")) $("tmMSite").onchange = () => { siteId = $("tmMSite").value; $("tmMZone").innerHTML = zoneOpts(siteId); };
  $("tmMForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("tmMName").value.trim();
    if (!name) return toast("Nommez la machine.");
    if (!tmManager(siteId)) return toast("Site hors de votre périmètre.");
    let mid = old?.id;
    if (!commitData(() => {
      data.machines ||= [];
      const patch = { name, site_id: siteId, zone_id: $("tmMZone").value || null, criticality: crit, owner: $("tmMOwner").value.trim(), updated_at: now() };
      if (old) Object.assign(data.machines.find((m) => m.id === old.id), patch);
      else { mid = auNext("MA", data.machines); data.machines.push({ id: mid, cil: [], created_at: now(), ...patch }); }
    })) return;
    modalDirty = false;
    render();
    tmOpen(mid, old ? null : "cil");
  };
}
function tmOpen(mid, tab = null) {
  const m = tmMachine(mid);
  if (!m || !allowedSite(m.site_id)) return;
  const tags = tmOpenTags(mid), s = tmStats(mid);
  tab ||= s.open.length ? "pannes" : m.cil_draft ? "tournee" : tags.length ? "tags" : (m.cil || []).length ? "tournee" : "cil";
  const tabs = [["tags", `Étiquettes${tags.length ? ` · ${tags.length}` : ""}`], ["tournee", "Tournée CIL"], ["pannes", `Pannes${s.open.length ? " · en cours" : ""}`], ["cil", "Standard CIL"]];
  modal(`${m.id} · ${m.name}`, `<div class="sm-study tm-sheet" data-tm-id="${esc(mid)}"><p class="jn-where">${esc(getSiteName(m.site_id))}${m.zone_id ? ` · ${esc(tmZoneName(m.zone_id))}` : ""} · criticité ${esc(m.criticality)}${m.owner ? ` · ${esc(m.owner)}` : ""}${tmManager(m.site_id) ? ' · <button type="button" class="md-link" data-tm-editm>Modifier</button>' : ""}</p>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-tm-tab="${k}">${l}</button>`).join("")}</div>
    <div class="sm-body">${tmBody(m, tab)}</div></div>`);
  modalSaver = () => { uxFlush(); return true; };
  tmBind(mid, tab);
  phFill($("modalContent"));
}
function tmTagCard(t, writable) {
  return `<li class="tm-tagcard ${t.color === "rouge" ? "rouge" : "bleue"} ${t.status === "traitee" ? "done" : ""}">${t.photo ? phImg(t.photo, "tm-thumb", "Anomalie") : '<span class="tm-thumb tm-nophoto"></span>'}<div><span>${tmTagChip(t)} <span class="jn-tag">${esc(tmKind(t.kind))}</span></span><b>${esc(t.what)}</b><span class="hint">${esc(t.id)} · ${t.status === "traitee" ? `traitée le ${shortDate(t.fixed_at)}${t.fix ? ` : ${esc(t.fix)}` : ""}` : t.due_date ? (tmLate(t) ? "<em class='tm-late'>en retard</em>" : `avant le ${shortDate(t.due_date)}`) : ""}</span>${writable && t.status !== "traitee" ? `<button type="button" class="btn small" data-tm-tagopen="${esc(t.id)}">Traiter</button>` : ""}</div></li>`;
}
function tmBody(m, tab) {
  const writable = tmWritable(m.site_id);
  if (tab === "tags") {
    const open = tmOpenTags(m.id), done = tmTags((t) => t.machine_id === m.id && t.status === "traitee").sort((a, b) => String(b.fixed_at).localeCompare(String(a.fixed_at))).slice(0, 10);
    return `${writable ? '<button type="button" class="btn jn-big" data-tm-tag>Poser une étiquette</button>' : ""}
      <ol class="tm-taglist">${open.map((t) => tmTagCard(t, writable)).join("") || '<li class="jn-empty">Aucune étiquette ouverte sur cette machine.</li>'}</ol>
      ${done.length ? `<details class="ik-out"><summary>Traitées récemment · ${done.length}</summary><ol class="tm-taglist">${done.map((t) => tmTagCard(t, false)).join("")}</ol></details>` : ""}`;
  }
  if (tab === "tournee") {
    const pts = m.cil || [], last = tmLastRun(m.id), due = tmCilDue(m);
    if (!pts.length) return `<p class="hint">Écrivez d’abord le standard CIL de la machine avec l’équipe : ce qu’on nettoie, inspecte, lubrifie et resserre.</p>${tmManager(m.site_id) ? '<button type="button" class="btn" data-tm-tab="cil">Écrire le standard CIL</button>' : ""}`;
    const draft = m.cil_draft;
    if (!draft) return `<div class="sm-sum"><div><small>Dernière tournée</small><b>${last ? shortDate(last.date).slice(0, 5) : "—"}</b>${last ? `<small>${esc(last.by || "")}</small>` : ""}</div><div class="${due && due < today() ? "warn" : ""}"><small>Prochaine</small><b>${due ? (due < today() ? "En retard" : due === today() ? "Aujourd’hui" : shortDate(due).slice(0, 5)) : "—"}</b></div><div><small>Points</small><b>${pts.length}</b></div><div><small>Durée prévue</small><b>${pts.reduce((n, p) => n + (Number(p.minutes) || 0), 0)} min</b></div></div>
      ${writable ? '<button type="button" class="btn jn-big" data-tm-start>Commencer la tournée</button>' : ""}
      ${last ? `<p class="hint">Dernière tournée : ${Object.values(last.results || {}).filter((v) => v === "ok").length} point(s) OK, ${(last.tag_ids || []).length} anomalie(s) étiquetée(s).</p>` : ""}`;
    const res = draft.res || {}, doneN = pts.filter((p) => res[p.id]?.v).length;
    return `<p class="tm-progress"><b>${doneN}/${pts.length}</b> points · touchez OK ou Anomalie. Une anomalie devient une étiquette à la fin.</p>
      <ol class="tm-round">${pts.map((p, i) => { const r = res[p.id] || {}; return `<li class="tm-pt ${r.v ? `v-${r.v}` : ""}" data-tm-pt="${esc(p.id)}"><div class="tm-pt-head"><span class="st-n">${i + 1}</span><span class="tm-cilk k-${esc(p.kind)}">${esc(TM_CIL.find((k) => k[0] === p.kind)?.[1] || "")}</span><b>${esc(p.what)}</b></div>${p.how ? `<p class="tm-how">${esc(p.how)}</p>` : ""}
        <div class="ik-st tm-okano"><button type="button" class="ik-s s-confirmee ${r.v === "ok" ? "on" : ""}" data-tm-v="ok" aria-pressed="${r.v === "ok"}">OK</button><button type="button" class="ik-s s-ano ${r.v === "ano" ? "on" : ""}" data-tm-v="ano" aria-pressed="${r.v === "ano"}">Anomalie</button></div>
        ${r.v === "ano" ? `<div class="tm-ano"><input data-tm-anotext value="${esc(r.text || "")}" placeholder="Ce qui ne va pas (ex. fuite d’huile au vérin)"><div class="tm-colors"><button type="button" class="tm-cbtn bleue ${r.color !== "rouge" ? "on" : ""}" data-tm-anocolor="bleue">Bleue · l’équipe traite</button><button type="button" class="tm-cbtn rouge ${r.color === "rouge" ? "on" : ""}" data-tm-anocolor="rouge">Rouge · maintenance</button></div></div>` : ""}</li>`; }).join("")}</ol>
      <div class="form-actions"><button type="button" class="btn jn-big" data-tm-finish ${doneN < pts.length ? "disabled" : ""}>Tournée terminée</button><button type="button" class="btn ghost" data-tm-abandon>Abandonner</button></div>`;
  }
  if (tab === "pannes") {
    const s = tmStats(m.id), rows = tmScope(data.breakdowns).filter((b) => b.machine_id === m.id).sort((a, b) => String(b.start).localeCompare(String(a.start))).slice(0, 15);
    return `${s.open.map((b) => `<section class="tm-downbox"><b>En panne depuis ${tmDur(tmHours(b))}</b><span>${tmWhen(b.start)}${b.cause ? ` · ${esc(b.cause)}` : ""}</span>${writable ? `<label class="sm-inl wide">Ce qui a été fait<input data-tm-fix="${esc(b.id)}" value="${esc(b.fix || "")}" placeholder="Ex. remplacement du capteur"></label><button type="button" class="btn jn-big" data-tm-restart="${esc(b.id)}">Machine remise en route</button>` : ""}</section>`).join("")}
      <div class="sm-sum"><div><small>Pannes · 90 j</small><b>${s.n}</b></div><div class="${s.lost ? "warn" : ""}"><small>Heures perdues</small><b>${tmDur(s.lost)}</b></div><div><small>MTTR</small><b>${tmDur(s.mttr)}</b><small>réparation moyenne</small></div><div><small>MTBF</small><b>${s.mtbf === null ? "—" : tmDur(s.mtbf)}</b><small>entre deux pannes</small></div></div>
      ${writable && !s.open.length ? '<button type="button" class="btn secondary" data-tm-down>Déclarer une panne</button>' : ""}
      ${rows.length ? `<ul class="tm-downs">${rows.map((b) => `<li><button type="button" class="jn-row" data-tm-downopen="${esc(b.id)}"><span class="jn-row-main"><b>${tmWhen(b.start)} · ${b.end ? tmDur(tmHours(b)) : "en cours"}</b><span class="hint">${esc(b.cause || "Cause à préciser")}${b.fix ? ` · ${esc(b.fix)}` : ""}</span></span></button></li>`).join("")}</ul>` : '<p class="hint">Aucune panne déclarée.</p>'}
      <p class="hint">MTBF calendaire : temps moyen entre deux débuts de panne sur 90 jours.</p>`;
  }
  const pts = m.cil || [], manager = tmManager(m.site_id), dis = manager ? "" : "disabled";
  return `<p class="hint">Le standard s’écrit avec l’équipe, au pied de la machine : ce qu’on nettoie, inspecte, lubrifie et resserre, comment, à quelle fréquence et en combien de minutes.</p>
    <ol class="tm-cil">${pts.map((p, i) => `<li class="tm-cilpt" data-tm-cp="${esc(p.id)}"><div class="tm-pt-head"><span class="st-n">${i + 1}</span><input data-tm-cwhat value="${esc(p.what || "")}" placeholder="Le point (ex. guide du chant)" aria-label="Point ${i + 1}" ${dis}>${manager ? '<button type="button" class="ik-x tm-del" data-tm-cdel aria-label="Supprimer le point">×</button>' : ""}</div>
      <div class="filters tm-chips">${TM_CIL.map(([k, l]) => `<button type="button" class="chip ${p.kind === k ? "active" : ""}" data-tm-ckind="${k}" aria-pressed="${p.kind === k}" ${dis}>${l}</button>`).join("")}</div>
      <input class="why-proof" data-tm-chow value="${esc(p.how || "")}" placeholder="Comment, critère (ex. chiffon sec, pas de colle visible)" ${dis}>
      <div class="tm-cfoot"><div class="filters tm-chips">${TM_FREQ.map(([k, l]) => `<button type="button" class="chip ${p.freq === k ? "active" : ""}" data-tm-cfreq="${k}" aria-pressed="${p.freq === k}" ${dis}>${l}</button>`).join("")}</div><label class="sm-inl">Minutes<input data-tm-cmin type="number" min="0" step="1" inputmode="numeric" value="${esc(p.minutes ?? "")}" ${dis}></label></div></li>`).join("") || '<li class="jn-empty">Aucun point pour l’instant.</li>'}</ol>
    <div class="sm-tools">${manager ? '<button type="button" class="btn secondary" data-tm-cadd>+ Point de contrôle</button>' : ""}${pts.length ? '<button type="button" class="btn ghost" data-tm-cprint>Fiche à afficher</button>' : ""}</div>`;
}
function tmRoot(mid) { return $("modalContent")?.querySelector(`.tm-sheet[data-tm-id="${mid}"]`); }
function tmRedraw(mid, tab, focusSel = null) {
  const root = tmRoot(mid), box = root?.querySelector(".sm-body"), m = tmMachine(mid);
  if (!box || !m) return;
  const sc = box.closest(".modal"), top = sc?.scrollTop;
  box.innerHTML = tmBody(m, tab);
  tmBind(mid, tab);
  phFill(box);
  if (sc && top !== undefined) sc.scrollTop = top;
  if (focusSel) box.querySelector(focusSel)?.focus({ preventScroll: true });
}
function tmSaveM(mid, fn) { const ok = commitData(() => { const m = data.machines.find((x) => x.id === mid); fn(m); m.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function tmBind(mid, tab) {
  const root = tmRoot(mid), m = tmMachine(mid);
  if (!root || !m) return;
  root.querySelectorAll("button[data-tm-tab]").forEach((b) => (b.onclick = () => { uxFlush(); tmOpen(mid, b.dataset.tmTab); }));
  root.querySelector("[data-tm-editm]")?.addEventListener("click", () => tmMachineForm(mid));
  root.querySelectorAll("[data-tm-tagopen]").forEach((b) => (b.onclick = () => tmTagForm(b.dataset.tmTagopen, { back: () => tmOpen(mid, "tags") })));
  root.querySelectorAll("[data-tm-tag]").forEach((b) => (b.onclick = () => tmTagForm(null, { machineId: mid, back: () => tmOpen(mid, "tags") })));
  root.querySelectorAll("[data-tm-down]").forEach((b) => (b.onclick = () => tmDownForm(null, { machineId: mid })));
  root.querySelectorAll("[data-tm-downopen]").forEach((b) => (b.onclick = () => tmDownForm(b.dataset.tmDownopen)));
  root.querySelector("[data-tm-cprint]")?.addEventListener("click", () => tmCilPrint(mid));
  if (!tmWritable(m.site_id)) return;
  /* Pannes */
  root.querySelectorAll("[data-tm-fix]").forEach((el) => (el.onchange = () => { commitData(() => { const b = data.breakdowns.find((x) => x.id === el.dataset.tmFix); b.fix = el.value.trim(); b.updated_at = now(); }); modalDirty = false; }));
  root.querySelectorAll("[data-tm-restart]").forEach((b) => (b.onclick = () => { uxFlush(); if (!commitData(() => { const x = data.breakdowns.find((k) => k.id === b.dataset.tmRestart); x.end = now(); x.updated_at = now(); })) return; modalDirty = false; toast("Machine remise en route : durée enregistrée."); render(); tmOpen(mid, "pannes"); }));
  /* Tournée */
  root.querySelector("[data-tm-start]")?.addEventListener("click", () => { if (tmSaveM(mid, (x) => { x.cil_draft = { started_at: now(), by: apMe() || "", res: {} }; })) tmRedraw(mid, "tournee"); });
  root.querySelector("[data-tm-abandon]")?.addEventListener("click", (e) => { const b = e.currentTarget; if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Touchez encore pour abandonner"; return; } if (tmSaveM(mid, (x) => { delete x.cil_draft; })) tmRedraw(mid, "tournee"); });
  const ptOf = (el) => el.closest("[data-tm-pt]")?.dataset.tmPt;
  root.querySelectorAll("[data-tm-v]").forEach((b) => (b.onclick = () => { uxFlush(); const pid = ptOf(b), v = b.dataset.tmV; if (tmSaveM(mid, (x) => { x.cil_draft.res[pid] = { ...(x.cil_draft.res[pid] || {}), v }; })) tmRedraw(mid, "tournee", v === "ano" ? `[data-tm-pt="${pid}"] [data-tm-anotext]` : null); }));
  root.querySelectorAll("[data-tm-anotext]").forEach((el) => (el.onchange = () => { const pid = ptOf(el); tmSaveM(mid, (x) => { x.cil_draft.res[pid].text = el.value.trim(); }); }));
  root.querySelectorAll("[data-tm-anocolor]").forEach((b) => (b.onclick = () => { uxFlush(); const pid = ptOf(b); if (tmSaveM(mid, (x) => { x.cil_draft.res[pid].color = b.dataset.tmAnocolor; })) tmRedraw(mid, "tournee"); }));
  root.querySelector("[data-tm-finish]")?.addEventListener("click", () => {
    uxFlush();
    const x0 = tmMachine(mid), res = x0.cil_draft?.res || {};
    if ((x0.cil || []).some((p) => !res[p.id]?.v)) return toast("Chaque point a besoin d’un OK ou d’une anomalie.");
    let n = 0;
    if (!commitData(() => {
      const x = data.machines.find((k) => k.id === mid), d = x.cil_draft, tagIds = [];
      data.tpmTags ||= []; data.cilRuns ||= [];
      for (const p of x.cil) {
        const r = d.res[p.id];
        if (r?.v !== "ano") continue;
        const tid = auNext("ET", data.tpmTags), color = r.color === "rouge" ? "rouge" : "bleue";
        data.tpmTags.unshift({ id: tid, site_id: x.site_id, machine_id: x.id, kind: p.kind === "lubrifier" ? "fuite" : p.kind === "serrer" ? "desserrage" : p.kind === "nettoyer" ? "salete" : "usure", color, what: r.text || `${p.what} : anomalie à la tournée`, photo: "", status: "ouverte", due_date: tmAddDays(today(), color === "rouge" ? 14 : 7), cil_point: p.id, created_by: d.by || apMe() || "", created_at: now(), updated_at: now() });
        tagIds.push(tid); n += 1;
      }
      data.cilRuns.unshift({ id: auNext("CIL", data.cilRuns), site_id: x.site_id, machine_id: x.id, date: today(), started_at: d.started_at, ended_at: now(), by: d.by || apMe() || "", results: Object.fromEntries(Object.entries(d.res).map(([k, v]) => [k, v.v])), tag_ids: tagIds, created_at: now() });
      delete x.cil_draft; x.updated_at = now();
    })) return;
    modalDirty = false;
    toast(n ? `Tournée enregistrée · ${jnPlural(n, "étiquette posée", "étiquettes posées")}.` : "Tournée enregistrée, tout est OK.");
    render(); tmOpen(mid, n ? "tags" : "tournee");
  });
  /* Standard CIL */
  if (!tmManager(m.site_id)) return;
  const cpOf = (el) => el.closest("[data-tm-cp]")?.dataset.tmCp;
  const withP = (el, fn) => { const pid = cpOf(el); return tmSaveM(mid, (x) => { const p = x.cil.find((k) => k.id === pid); if (p) fn(p); }); };
  root.querySelector("[data-tm-cadd]")?.addEventListener("click", () => { uxFlush(); const pid = uid("CP"); if (tmSaveM(mid, (x) => { x.cil ||= []; x.cil.push({ id: pid, kind: "nettoyer", what: "", how: "", freq: "jour", minutes: 2 }); })) tmRedraw(mid, "cil", `[data-tm-cp="${pid}"] [data-tm-cwhat]`); });
  root.querySelectorAll("[data-tm-cwhat]").forEach((el) => (el.onchange = () => withP(el, (p) => { p.what = el.value.trim(); })));
  root.querySelectorAll("[data-tm-chow]").forEach((el) => (el.onchange = () => withP(el, (p) => { p.how = el.value.trim(); })));
  root.querySelectorAll("[data-tm-cmin]").forEach((el) => (el.onchange = () => withP(el, (p) => { p.minutes = Math.max(0, Number(el.value) || 0); })));
  const chip = (attr, key) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { if (!withP(b, (p) => { p[key] = b.getAttribute(attr); })) return; b.parentElement.querySelectorAll(`[${attr}]`).forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  chip("data-tm-ckind", "kind");
  chip("data-tm-cfreq", "freq");
  root.querySelectorAll("[data-tm-cdel]").forEach((b) => (b.onclick = () => { const li = b.closest("[data-tm-cp]"), pid = li.dataset.tmCp; if (!li.dataset.confirm && li.querySelector("[data-tm-cwhat]").value.trim()) { li.dataset.confirm = "1"; toast("Touchez × encore une fois pour supprimer le point."); return; } if (tmSaveM(mid, (x) => { x.cil = x.cil.filter((p) => p.id !== pid); })) tmRedraw(mid, "cil"); }));
}
function tmCilPrint(mid) {
  const m = tmMachine(mid);
  if (!m) return;
  const pts = m.cil || [];
  modal(`${m.id} · Standard CIL`, `<article class="tm-cilsheet"><header><div><small>STANDARD CIL · NETTOYER · INSPECTER · LUBRIFIER · RESSERRER</small><h3>${esc(m.name)}</h3><p>${esc(getSiteName(m.site_id))}${m.zone_id ? ` · ${esc(tmZoneName(m.zone_id))}` : ""} · criticité ${esc(m.criticality)}${m.owner ? ` · ${esc(m.owner)}` : ""}</p></div><b>${pts.reduce((n, p) => n + (Number(p.minutes) || 0), 0)} min</b></header>
    <table><thead><tr><th>#</th><th>Geste</th><th>Point</th><th>Comment, critère</th><th>Fréquence</th><th>Min</th></tr></thead><tbody>${pts.map((p, i) => `<tr><td>${i + 1}</td><td><span class="tm-cilk k-${esc(p.kind)}">${esc(TM_CIL.find((k) => k[0] === p.kind)?.[1] || "")}</span></td><td><b>${esc(p.what)}</b></td><td>${esc(p.how || "")}</td><td>${esc(TM_FREQ.find((f) => f[0] === p.freq)?.[1] || "")}</td><td>${esc(p.minutes ?? "")}</td></tr>`).join("")}</tbody></table>
    <footer>Une anomalie ? Une étiquette : bleue si l’équipe la traite, rouge s’il faut la maintenance.</footer></article>
    <div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn secondary" data-tm-back>Retour</button></div>`);
  $("modalContent").querySelector("[data-tm-back]").onclick = () => tmOpen(mid, "cil");
}

/* ---------- Étiquette ---------- */

function tmTagForm(id = null, { machineId = null, back = null } = {}) {
  const old = id ? (data.tpmTags || []).find((t) => t.id === id) : null;
  const ms = tmMachines().filter((m) => tmWritable(m.site_id));
  if (!ms.length) return toast(tmMachines().length ? "Votre profil ne permet pas de poser une étiquette." : "Ajoutez d’abord une machine.");
  let mid = old?.machine_id || machineId || ms[0].id, kind = old?.kind || "fuite", color = old?.color || "bleue", photo = old?.photo || "", fixPhoto = old?.fix_photo || "";
  const dueFor = () => tmAddDays(today(), kind === "securite" ? 1 : color === "rouge" ? 14 : 7);
  const dues = [["Demain", 1], ["1 semaine", 7], ["2 semaines", 14], ["1 mois", 30]];
  modal(old ? `${old.id} · Étiquette ${old.color === "rouge" ? "rouge" : "bleue"}` : "Nouvelle étiquette TPM", `<form id="tmTagForm" class="jn-form">
    <div class="cs-tag-photo" id="tmTagPhoto"></div><input type="file" id="tmTagFile" accept="image/*" capture="environment" hidden>
    <label class="field">Machine<select id="tmTagM" ${old ? "disabled" : ""}>${ms.map((m) => `<option value="${esc(m.id)}" ${m.id === mid ? "selected" : ""}>${esc(m.name)}${state.site === "group" ? ` · ${esc(getSiteName(m.site_id))}` : ""}</option>`).join("")}</select></label>
    <div class="ap-field"><span class="metric-label">Quelle anomalie ?</span><div class="filters">${TM_KINDS.map(([k, l]) => `<button type="button" class="chip ${k === kind ? "active" : ""}" data-tm-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join("")}</div></div>
    <label class="field">Ce qui ne va pas<input id="tmTagWhat" required value="${esc(old?.what || "")}" placeholder="Ex. fuite d’huile au vérin de presse"></label>
    <div class="ap-field"><span class="metric-label">Qui la traite ?</span><div class="tm-colors"><button type="button" class="tm-cbtn bleue ${color !== "rouge" ? "on" : ""}" data-tm-color="bleue" aria-pressed="${color !== "rouge"}">Bleue · l’équipe</button><button type="button" class="tm-cbtn rouge ${color === "rouge" ? "on" : ""}" data-tm-color="rouge" aria-pressed="${color === "rouge"}">Rouge · maintenance</button></div></div>
    <div class="ap-field"><span class="metric-label">Traiter avant le</span><div class="filters">${dues.map(([l, n]) => `<button type="button" class="chip" data-tm-due="${n}">${l}</button>`).join("")}</div><input type="date" id="tmTagDue" value="${esc(old?.due_date || dueFor())}"></div>
    ${old && old.status !== "traitee" ? `<section class="verification-box"><h3>Traiter l’étiquette</h3><label class="field">Ce qui a été fait<input id="tmTagFix" placeholder="Ex. joint changé, vis resserrée et repérée"></label><div class="cs-tag-photo" id="tmFixPhoto"></div><input type="file" id="tmFixFile" accept="image/*" capture="environment" hidden><button type="button" class="btn" data-tm-fixit>Étiquette traitée</button></section>` : ""}
    ${old?.status === "traitee" ? `<p class="hint">Traitée le ${shortDate(old.fixed_at)}${old.fixed_by ? ` par ${esc(old.fixed_by)}` : ""} : ${esc(old.fix || "")}</p>${old.fix_photo ? phImg(old.fix_photo, "tm-after", "Après") : ""}` : ""}
    <div class="form-actions"><button class="btn">${old ? "Enregistrer" : "Poser l’étiquette"}</button><button type="button" class="btn ghost" data-tm-tagback>${back ? "Retour" : "Annuler"}</button></div></form>`);
  const root = $("modalContent");
  const drawPhoto = (boxId, value, label, onAdd, onDel) => { const box = $(boxId); if (!box) return; box.innerHTML = value ? `<figure class="cp-ph cs-tag-ph">${phImg(value, "cp-ph-img", label)}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-del aria-label="Retirer la photo">×</button></span></figure>` : `<button type="button" class="cp-ph-add cs-tag-ph" data-add><b>Photo</b><span>${label}</span></button>`; box.querySelector("[data-add]")?.addEventListener("click", onAdd); box.querySelector("[data-del]")?.addEventListener("click", onDel); phFill(box); };
  const draw = () => drawPhoto("tmTagPhoto", photo, "de l’anomalie", () => $("tmTagFile").click(), () => { photo = ""; draw(); });
  const drawFix = () => drawPhoto("tmFixPhoto", fixPhoto, "après", () => $("tmFixFile").click(), () => { fixPhoto = ""; drawFix(); });
  draw(); drawFix();
  const takePhoto = (input, set) => { if (!input) return; input.onchange = async () => { const f = input.files?.[0]; input.value = ""; if (!f) return; try { set(await phStore(await imageDataUrl(f))); } catch (error) { toast(error.message); } }; };
  takePhoto($("tmTagFile"), (v) => { photo = v; draw(); });
  takePhoto($("tmFixFile"), (v) => { fixPhoto = v; drawFix(); });
  const pick = (attr, set) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { set(b.getAttribute(attr)); root.querySelectorAll(`[${attr}]`).forEach((x) => { x.classList.toggle("active", x === b); x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); if (!old) $("tmTagDue").value = dueFor(); }));
  pick("data-tm-kind", (v) => { kind = v; if (v === "securite") { color = "rouge"; root.querySelectorAll("[data-tm-color]").forEach((x) => { const on = x.dataset.tmColor === "rouge"; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); }); } });
  pick("data-tm-color", (v) => { color = v; });
  root.querySelectorAll("[data-tm-due]").forEach((b) => (b.onclick = () => { $("tmTagDue").value = tmAddDays(today(), Number(b.dataset.tmDue)); }));
  $("tmTagM").onchange = () => { mid = $("tmTagM").value; };
  const leave = () => { modalDirty = false; if (back) back(); else { closeModal(); render(); } };
  root.querySelector("[data-tm-tagback]").onclick = leave;
  const save = (extra = {}) => {
    const what = $("tmTagWhat").value.trim(), m = tmMachine(mid);
    if (!what) { $("tmTagWhat").focus(); return toast("Dites ce qui ne va pas."); }
    if (!m || !tmWritable(m.site_id)) return toast("Machine hors de votre périmètre.");
    let tid = old?.id;
    if (!commitData(() => {
      data.tpmTags ||= [];
      const patch = { machine_id: m.id, site_id: m.site_id, kind, color, what, photo, due_date: $("tmTagDue").value || null, updated_at: now(), ...extra };
      if (old) Object.assign(data.tpmTags.find((t) => t.id === old.id), patch);
      else { tid = auNext("ET", data.tpmTags); data.tpmTags.unshift({ id: tid, status: "ouverte", created_by: apMe() || "", created_at: now(), ...patch }); }
    })) return;
    modalDirty = false;
    toast(extra.status === "traitee" ? `${tid} traitée : bravo.` : `${tid} ${old ? "enregistrée" : "posée"}.`);
    render();
    leave();
  };
  $("tmTagForm").onsubmit = (e) => { e.preventDefault(); save(); };
  root.querySelector("[data-tm-fixit]")?.addEventListener("click", () => { const fix = $("tmTagFix").value.trim(); if (!fix) { $("tmTagFix").focus(); return toast("Dites ce qui a été fait."); } save({ status: "traitee", fix, fix_photo: fixPhoto, fixed_at: now(), fixed_by: apMe() || "" }); });
}

/* ---------- Panne ---------- */

function tmDownForm(id = null, { machineId = null } = {}) {
  const old = id ? (data.breakdowns || []).find((b) => b.id === id) : null;
  const ms = tmMachines().filter((m) => tmWritable(m.site_id));
  if (!ms.length) return toast(tmMachines().length ? "Votre profil ne permet pas de déclarer une panne." : "Ajoutez d’abord une machine.");
  const mid0 = old?.machine_id || machineId || ms[0].id;
  modal(old ? `${old.id} · Panne` : "Déclarer une panne", `<form id="tmDownForm" class="jn-form sm-new">
    <label class="field">Machine<select id="tmDownM" ${old ? "disabled" : ""}>${ms.map((m) => `<option value="${esc(m.id)}" ${m.id === mid0 ? "selected" : ""}>${esc(m.name)}${state.site === "group" ? ` · ${esc(getSiteName(m.site_id))}` : ""}</option>`).join("")}</select></label>
    <div class="cs-who-when"><label>Arrêt<input type="datetime-local" id="tmDownStart" value="${tmLocal(old?.start)}" max="${tmLocal()}"></label><label>Remise en route<input type="datetime-local" id="tmDownEnd" value="${old?.end ? tmLocal(old.end) : ""}" max="${tmLocal()}"></label></div>
    <p class="hint">Laissez « Remise en route » vide si la machine est encore arrêtée.</p>
    <label class="field">Symptôme, cause<input id="tmDownCause" value="${esc(old?.cause || "")}" placeholder="Ex. défaut capteur de présence panneau"></label>
    <label class="field">Ce qui a été fait<input id="tmDownFix" value="${esc(old?.fix || "")}" placeholder="Ex. capteur remplacé"></label>
    <div class="form-actions"><button class="btn jn-big">${old ? "Enregistrer" : "Déclarer"}</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  $("tmDownForm").onsubmit = (e) => {
    e.preventDefault();
    const m = tmMachine(old?.machine_id || $("tmDownM").value), s = $("tmDownStart").value, en = $("tmDownEnd").value;
    if (!m || !tmWritable(m.site_id)) return toast("Machine hors de votre périmètre.");
    if (!s) return toast("Indiquez l’heure de l’arrêt.");
    const start = new Date(s).toISOString(), end = en ? new Date(en).toISOString() : null;
    if (Date.parse(start) > Date.now() + 60000 || (end && (Date.parse(end) < Date.parse(start) || Date.parse(end) > Date.now() + 60000))) return toast("Vérifiez les heures : la remise en route suit l’arrêt, et rien dans le futur.");
    if (!old && !end && tmStats(m.id).open.length) return toast("Une panne est déjà en cours sur cette machine.");
    if (!commitData(() => {
      data.breakdowns ||= [];
      const patch = { machine_id: m.id, site_id: m.site_id, start, end, cause: $("tmDownCause").value.trim(), fix: $("tmDownFix").value.trim(), updated_at: now() };
      if (old) Object.assign(data.breakdowns.find((b) => b.id === old.id), patch);
      else data.breakdowns.unshift({ id: auNext("PA", data.breakdowns), by: apMe() || "", created_at: now(), ...patch });
    })) return;
    modalDirty = false;
    render();
    tmOpen(m.id, "pannes");
  };
}

/* ---------- Branchements ---------- */

const tmRenderTerrainBase = renderTerrain;
renderTerrain = function () {
  if (state.terrainTab !== "tpm") return tmRenderTerrainBase.apply(this, arguments);
  if (!tmCan()) { state.terrainTab = "gemba"; return tmRenderTerrainBase.apply(this, arguments); }
  return tmPage();
};
const tmTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = tmTabsBase(stage);
  if (stage?.id !== "observer" || !tmCan() || out.some((t) => t.key === "tpm") || !out.some((t) => t.view === "terrain")) return out;
  const after = ["5s", "gemba"].map((k) => out.findIndex((t) => t.key === k)).find((i) => i >= 0);
  out.splice(after >= 0 ? after + 1 : out.length, 0, { key: "tpm", label: "TPM", view: "terrain", set: { terrainTab: "tpm" } });
  return out;
};
const tmToolLaunchBase = toolLaunch;
toolLaunch = function (id) {
  if (id === "tpm" && tmCan()) return `<div class="attention-strip"><div><b>Passer à la pratique</b><span>Étiquettes d’anomalie au téléphone, tournées CIL et pannes suivies, machine par machine.</span></div><button class="btn" data-tm-go>Ouvrir la TPM</button></div>`;
  return tmToolLaunchBase.apply(this, arguments);
};
const tmWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = tmWatchBase();
  if (!tmCan() || state.role === "dg") return base;
  const downs = tmScope(data.breakdowns).filter((b) => !b.end), late = tmOpenTags().filter(tmLate), cil = tmMachines().filter((m) => m.criticality === "A" && tmCilDue(m) && tmCilDue(m) < today());
  const rows = downs.slice(0, 3).map((b) => { const m = tmMachine(b.machine_id); return m ? `<button type="button" class="jn-row" data-tm-open="${esc(m.id)}"><span class="jn-row-main"><span class="jn-tag tone-bad">Panne</span><b>${esc(m.name)} à l’arrêt</b><span class="hint">${esc(getSiteName(m.site_id))} · depuis ${tmDur(tmHours(b))}</span></span></button>` : ""; });
  if (late.length) rows.push(`<button type="button" class="jn-row" data-tm-go><span class="jn-row-main"><span class="jn-tag tone-warn">TPM</span><b>${jnPlural(late.length, "étiquette machine en retard", "étiquettes machine en retard")}</b><span class="hint">${late.filter((t) => t.color === "rouge").length} rouge(s)</span></span></button>`);
  cil.slice(0, 2).forEach((m) => rows.push(`<button type="button" class="jn-row" data-tm-open="${esc(m.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">CIL</span><b>Tournée en retard · ${esc(m.name)}</b><span class="hint">Machine critique</span></span></button>`));
  if (!rows.filter(Boolean).length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows.join("")}`);
};
const tmCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  tmCreateMenuBase.apply(this, arguments);
  if (!tmCan() || role().readonly || !tmMachines().some((m) => tmWritable(m.site_id))) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const html = `<button class="create-choice tm-choice" type="button" data-tm-tag><span aria-hidden="true"><b>ET</b></span><b>Étiquette machine</b><small>Fuite, usure, desserrage : photo et bleue ou rouge</small></button><button class="create-choice tm-choice" type="button" data-tm-down><span aria-hidden="true"><b>PA</b></span><b>Panne machine</b><small>Arrêt, remise en route, cause</small></button>`;
  const note = menu.querySelector(".cp-note-choice");
  if (note) note.insertAdjacentHTML("beforebegin", html); else menu.insertAdjacentHTML("beforeend", html);
  tmBindGlobal(menu);
};
function tmGo() { state.terrainTab = "tpm"; switchView("terrain"); }
function tmBindGlobal(root = document) {
  root.querySelectorAll("[data-tm-tag]").forEach((b) => { if (!b.closest(".tm-sheet")) b.onclick = () => tmTagForm(); });
  root.querySelectorAll("[data-tm-down]").forEach((b) => { if (!b.closest(".tm-sheet")) b.onclick = () => tmDownForm(); });
  root.querySelectorAll("[data-tm-newm]").forEach((b) => (b.onclick = () => tmMachineForm()));
  root.querySelectorAll("[data-tm-open]").forEach((b) => (b.onclick = () => tmOpen(b.dataset.tmOpen)));
  root.querySelectorAll("[data-tm-tagopen]").forEach((b) => { if (!b.closest(".tm-sheet")) b.onclick = () => tmTagForm(b.dataset.tmTagopen); });
  root.querySelectorAll("[data-tm-go]").forEach((b) => (b.onclick = tmGo));
}
const tmOsBindBase = osBind;
osBind = function () { const out = tmOsBindBase.apply(this, arguments); tmBindGlobal(document); return out; };
