"use strict";
/*
 * BIA Lean OS 8.13 · SMED (Résoudre › SMED), du chronomètre au standard de changement.
 *  - Chrono au téléphone pendant le changement : « Fin d'étape » à chaque opération, nom tapé tout de suite ou après ;
 *    le chrono continue si l'appli se ferme. Saisie manuelle possible.
 *  - Chaque opération est interne (machine arrêtée) ou externe (machine en marche) ; on décide ensuite son sort :
 *    passer en externe, réduire, supprimer ou garder, avec l'action qui le permet.
 *  - Diagramme avant / après, temps d'arrêt gagné par changement et par semaine, actions datées vers le plan,
 *    mesures des changements suivants contre la cible, et standard de changement créé à partir de la nouvelle séquence.
 * Données : data.smed[] = { id, site_id, project_id, title, owner, target_min, per_week, chrono, ops[], measures[], standard_id, created_at, updated_at }.
 * data.smed n'est pas une collection indexée : les actions créées portent smed_id (origine « SMED »), jamais origin_id.
 */

const SM_AFTER = [["externe", "Passer en externe", "Préparer pendant que la machine tourne"], ["reduite", "Réduire", "Simplifier, outiller, paralléliser"], ["supprimee", "Supprimer", "Opération inutile"], ["inchangee", "Garder", "Sans changement"]];
let smTick = null;

function smCan() { return role().nav.includes("projects"); }
function smList() { return (data.smed || []).filter((s) => !s.archived_at && allowedSite(s.site_id) && (state.site === "group" || s.site_id === state.site)); }
function smGet(id) { return (data.smed || []).find((s) => s.id === id && !s.archived_at); }
function smWritable(s) { return !!s && !role().readonly && allowedSite(s.site_id, true); }
function smFmt(sec) { sec = Math.max(0, Math.round(Number(sec) || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`; }
function smNum(n) { return String(Math.round(n * 10) / 10).replace(".", ","); }
function smHours(sec) { return smNum(sec / 3600); }
function smParse(v) { const t = String(v || "").trim(); if (!t) return null; if (/^\d+:\d{1,2}$/.test(t)) { const [m, s] = t.split(":").map(Number); return s < 60 ? m * 60 + s : null; } const n = Number(t.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null; }
function smRunning(s) { return !!(s?.chrono?.started_at && !s.chrono.ended_at); }
function smAfter(op) { return op.type === "externe" ? "externe" : op.after || "inchangee"; }
function smAfterInternal(op) { const a = smAfter(op); if (a === "externe" || a === "supprimee") return 0; return a === "reduite" ? Number(op.after_s ?? op.dur_s) || 0 : Number(op.dur_s) || 0; }
function smTotals(s) {
  const ops = s.ops || [], before = ops.filter((o) => o.type !== "externe").reduce((n, o) => n + (Number(o.dur_s) || 0), 0);
  const ext = ops.filter((o) => o.type === "externe").reduce((n, o) => n + (Number(o.dur_s) || 0), 0), after = ops.reduce((n, o) => n + smAfterInternal(o), 0);
  return { before, after, ext, gain: before - after, pct: before ? Math.round(((before - after) / before) * 100) : 0 };
}
function smLast(s) { return (s.measures || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null; }
function smActsTodo(s) { return (s.ops || []).filter((o) => o.type !== "externe" && smAfter(o) !== "inchangee" && o.action); }
function smSave(id, fn) {
  const ok = commitData(() => { const s = data.smed.find((x) => x.id === id); fn(s); s.updated_at = now(); });
  if (ok) modalDirty = false;
  return ok;
}

/* ---------- Diagramme avant / après ---------- */

function smGantt(s) {
  const ops = s.ops || [], t = smTotals(s), scale = Math.max(t.before, t.after, t.ext, 60), pct = (sec) => ((sec / scale) * 100).toFixed(2);
  const name = (o, i) => o.label || `Étape ${i + 1}`, idx = ops.map((o, i) => ({ o, i }));
  const lanes = [
    ["Arrêt avant", idx.filter(({ o }) => o.type !== "externe").map(({ o, i }) => ({ d: Number(o.dur_s) || 0, label: name(o, i), cls: "int" }))],
    ["Arrêt après", idx.filter(({ o }) => smAfterInternal(o) > 0).map(({ o, i }) => ({ d: smAfterInternal(o), label: name(o, i), cls: smAfter(o) === "reduite" ? "red" : "int" }))],
    ["En marche", idx.filter(({ o }) => smAfter(o) === "externe").map(({ o, i }) => ({ d: Number(o.dur_s) || 0, label: name(o, i), cls: "ext" }))],
  ];
  const step = Math.max(1, Math.ceil(scale / 60 / 5)), ticks = [];
  for (let m = 0; m * 60 <= scale; m += step) ticks.push(m);
  const row = ([label, list]) => { const sum = list.reduce((n, o) => n + o.d, 0); return `<div class="sm-g-row"><span class="sm-g-l">${label}</span><div class="sm-g-track"><span class="sm-g-bar" style="width:${pct(sum)}%">${list.map((o) => `<i class="sm-seg ${o.cls}" style="flex-grow:${o.d}" title="${esc(o.label)} · ${smFmt(o.d)}"></i>`).join("")}</span><b class="sm-g-t">${smFmt(sum)}</b></div></div>`; };
  return `<figure class="sm-gantt" role="img" aria-label="Machine arrêtée : ${smFmt(t.before)} avant, ${smFmt(t.after)} après ; ${smFmt(lanes[2][1].reduce((n, o) => n + o.d, 0))} faites machine en marche">
    <div class="sm-g">${lanes.map(row).join("")}<div class="sm-g-row sm-g-axis" aria-hidden="true"><span class="sm-g-l"></span><div class="sm-g-track"><div class="sm-g-ticks">${ticks.map((m) => `<span style="left:${pct(m * 60)}%">${m}</span>`).join("")}</div><em>min</em></div></div></div>
    <figcaption><span><i class="int"></i>Machine arrêtée</span><span><i class="red"></i>Réduite</span><span><i class="ext"></i>Faite machine en marche</span></figcaption></figure>`;
}
function smTrend(s) {
  const rows = (s.measures || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-8), t = smTotals(s);
  if (!rows.length) return "";
  const ref = t.before / 60, max = Math.max(ref, ...rows.map((r) => r.min), s.target_min || 0) || 1, pct = (v) => ((v / max) * 100).toFixed(2);
  const tgt = s.target_min ? `<i class="sm-tgt" style="left:${pct(s.target_min)}%"></i>` : "";
  const row = (label, v, cls, title) => `<div class="sm-g-row"><span class="sm-g-l">${label}</span><div class="sm-g-track"><div class="sm-g-in">${tgt}<span class="sm-tbar ${cls}" style="width:${pct(v)}%" title="${esc(title)}"></span><b class="sm-g-t" style="left:${pct(v)}%">${smNum(v)} min</b></div></div></div>`;
  return `<figure class="sm-trend" role="img" aria-label="Durée des changements : référence ${smNum(ref)} min, puis ${rows.map((r) => `${smNum(r.min)} min le ${shortDate(r.date)}`).join(", ")}${s.target_min ? ` ; cible ${s.target_min} min` : ""}">
    <div class="sm-g">${ref ? row("Référence", ref, "ref", "Changement chronométré") : ""}${rows.map((r) => row(new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), r.min, s.target_min ? (r.min <= s.target_min ? "ok" : "warn") : "ref", `${shortDate(r.date)}${r.by ? ` · ${r.by}` : ""}`)).join("")}</div>
    <figcaption>${s.target_min ? `<span><i class="tgt"></i>Cible ${s.target_min} min</span><span><i class="ok"></i>Cible tenue</span><span><i class="warn"></i>Au-dessus de la cible</span>` : "Indiquez une cible pour juger les changements mesurés."}</figcaption></figure>`;
}

/* ---------- Page SMED ---------- */

function smPage() {
  const list = smList(), writable = !role().readonly && (state.site === "group" ? canGroup() : osWritable(state.site));
  const head = pageHead("Résoudre", "SMED", "Réduire le temps de changement : chronométrer, séparer interne et externe, transformer, standardiser.", writable && list.length ? '<button type="button" class="btn" data-sm-new>Nouveau changement à étudier</button>' : "");
  const card = (s) => {
    const t = smTotals(s), last = smLast(s), proj = s.project_id && (data.projects || []).find((p) => p.id === s.project_id);
    const ok = last && s.target_min && last.min <= s.target_min;
    const tone = smRunning(s) ? "tone-live" : last && s.target_min ? (ok ? "tone-ok" : "tone-warn") : "";
    return `<button type="button" class="cs-card sm-card ${tone}" data-sm-open="${esc(s.id)}"><span class="cs-card-top"><span class="cs-where">${esc(getSiteName(s.site_id))} · ${esc(s.id)}</span><span class="cs-due ${smRunning(s) ? "sm-live" : ""}">${smRunning(s) ? "Chrono en cours" : jnPlural((s.ops || []).length, "opération", "opérations")}</span></span>
      <b class="cs-card-name">${esc(s.title)}</b>
      <span class="sm-figs"><span><small>Arrêt observé</small><b>${t.before ? smFmt(t.before) : "—"}</b></span><span><small>Arrêt visé</small><b>${t.before ? smFmt(t.after) : "—"}</b></span><span class="${last ? (ok ? "ok" : s.target_min ? "warn" : "") : ""}"><small>Dernier mesuré</small><b>${last ? `${smNum(last.min)} min` : "—"}</b></span></span>
      <span class="cs-card-foot">${t.gain > 0 ? `Gain visé : ${smFmt(t.gain)} par changement (−${t.pct} %)${s.per_week ? ` · ${smHours(t.gain * s.per_week)} h par semaine` : ""}` : `Pilote : ${esc(s.owner || "à désigner")}`}${proj ? ` · ${esc(proj.id)}` : ""}</span></button>`;
  };
  const how = `<details class="cs-how section"><summary>La méthode SMED en cinq temps</summary><ol class="cs-how-list"><li><b>Observer</b><span>Chronométrer un vrai changement, du dernier bon produit au premier bon produit à cadence, réglages et essais compris.</span></li><li><b>Séparer</b><span>Interne : possible seulement machine arrêtée. Externe : faisable pendant que la machine tourne.</span></li><li><b>Transformer</b><span>Faire passer l’interne en externe : préparer, préchauffer, prérégler avant l’arrêt.</span></li><li><b>Réduire</b><span>Serrages rapides, butées, kits, opérations à deux, moins d’essais. Simplifier avant d’acheter.</span></li><li><b>Standardiser</b><span>Écrire la nouvelle séquence, former, mesurer les changements suivants contre la cible.</span></li></ol></details>`;
  return `${head}${list.length ? `<div class="cs-grid">${list.map(card).join("")}</div>` : `<section class="cs-empty"><h2>Choisissez un changement à étudier</h2><p>Un changement de série long, variable ou qui pèse sur le TRS : décor, format, outil, réglage. Créez l’étude, puis chronométrez-le au téléphone la prochaine fois qu’il a lieu.</p>${writable ? '<button type="button" class="btn" data-sm-new>Nouveau changement à étudier</button>' : ""}</section>`}${how}`;
}
function smProjectOptions(siteId, selected = "") {
  const rows = (data.projects || []).filter((p) => p.site_id === siteId && !p.archived_at && p.status !== "Clos").sort((a, b) => (b.method === "SMED") - (a.method === "SMED"));
  return `<option value="">Aucun</option>${rows.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.id)} · ${esc(p.title)}${p.method ? ` (${esc(p.method)})` : ""}</option>`).join("")}`;
}
function smNew(preset = {}) {
  const sites = OPERATIONAL_SITES.filter((x) => allowedSite(x.id, true));
  if (!sites.length || role().readonly) return toast("Votre profil ne permet pas de créer une étude SMED.");
  const siteId = preset.site_id && allowedSite(preset.site_id, true) ? preset.site_id : state.site !== "group" && allowedSite(state.site, true) ? state.site : sites[0].id;
  modal("Nouveau changement à étudier", `<form id="smNewForm" class="jn-form sm-new"><label class="field">Machine et changement<input id="smTitle" required value="${esc(preset.title || "")}" placeholder="Ex. Plaqueuse 2 · changement de chant"></label>
    <label class="field">Site<select id="smSite">${sites.map((x) => `<option value="${x.id}" ${x.id === siteId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
    <label class="field">Pilote<input id="smOwner" list="ownerList" required value="${esc(preset.owner || apMe() || "")}">${ownerDatalist()}</label>
    <div class="cs-who-when"><label>Cible (min)<input id="smTarget" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. 15" value="${esc(preset.target_min || "")}"></label><label>Changements / semaine<input id="smPerWeek" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex. 6"></label></div>
    <label class="field">Chantier lié<select id="smProject">${smProjectOptions(siteId, preset.project_id)}</select></label>
    <div class="form-actions"><button class="btn jn-big">Créer et chronométrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("smTitle")?.focus(), 0);
  $("smSite").onchange = () => { $("smProject").innerHTML = smProjectOptions($("smSite").value); };
  $("smNewForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("smTitle").value.trim(), owner = $("smOwner").value.trim(), site = $("smSite").value, proj = $("smProject").value || null;
    if (!title || !owner) return toast("Précisez le changement et son pilote.");
    if (!allowedSite(site, true)) return toast("Site hors de votre périmètre.");
    const s = { id: auNext("SMED", data.smed || []), site_id: site, project_id: proj, title, owner, target_min: Number($("smTarget").value) || null, per_week: Number($("smPerWeek").value) || null, chrono: null, ops: [], measures: [], created_at: now(), updated_at: now() };
    if (!commitData(() => { data.smed ||= []; data.smed.unshift(s); })) return;
    modalDirty = false;
    render();
    smOpen(s.id, "chrono");
  };
}

/* ---------- Étude : chrono, analyse, résultat ---------- */

function smOpRow(s, o, i, writable, tab) {
  const dis = writable ? "" : "disabled", name = esc(o.label || `Étape ${i + 1}`);
  if (tab === "analyse") {
    const a = smAfter(o);
    return `<li class="sm-op ${o.type === "externe" ? "externe" : "interne"} after-${a}" data-sm-op="${esc(o.id)}"><div class="sm-op-head"><span class="st-n">${i + 1}</span><b class="sm-op-name">${name}</b><span class="sm-dur">${smFmt(o.dur_s)}</span></div>
      ${o.type === "externe" ? `<p class="hint sm-ext-note">Déjà faite machine en marche.</p>` : `<div class="sm-after" role="radiogroup" aria-label="Que faire de « ${name} » ?">${SM_AFTER.map(([k, l, h]) => `<button type="button" class="sm-a a-${k} ${a === k ? "on" : ""}" data-sm-after="${k}" role="radio" aria-checked="${a === k}" ${dis}><b>${l}</b><small>${h}</small></button>`).join("")}</div>
      ${a !== "inchangee" ? `<div class="sm-inl-row">${a === "reduite" ? `<label class="sm-inl">Nouvelle durée<input data-sm-afters value="${smFmt(o.after_s ?? o.dur_s)}" inputmode="numeric" aria-label="Nouvelle durée en minutes:secondes" ${dis}></label>` : ""}
      <label class="sm-inl wide">${a === "supprimee" ? "Pourquoi peut-on s’en passer ?" : "Comment ?"}<input data-sm-action value="${esc(o.action || "")}" placeholder="${a === "externe" ? "Ex. préparer le chariot d’outils avant l’arrêt" : a === "reduite" ? "Ex. serrage rapide, butée de positionnement" : "Ex. contrôle fait deux fois"}" ${dis}></label></div>` : ""}`}
    </li>`;
  }
  const ext = o.type === "externe";
  return `<li class="sm-op ${ext ? "externe" : "interne"}" data-sm-op="${esc(o.id)}"><div class="sm-op-head"><span class="st-n">${i + 1}</span><input class="sm-label" data-sm-label value="${esc(o.label || "")}" placeholder="Ce qui est fait (ex. démonter le rouleau)" aria-label="Opération ${i + 1}" enterkeyhint="done" ${dis}>
      <input class="sm-dur-in" data-sm-dur value="${smFmt(o.dur_s)}" inputmode="numeric" aria-label="Durée de l’opération ${i + 1} en minutes:secondes" ${dis}>${writable ? `<button type="button" class="cp-ph-btn sm-del" data-sm-del aria-label="Supprimer l’opération ${i + 1}">×</button>` : ""}</div>
    <div class="sm-type" role="radiogroup" aria-label="Interne ou externe"><button type="button" class="sm-t int ${ext ? "" : "on"}" data-sm-type="interne" role="radio" aria-checked="${!ext}" ${dis}><b>Interne</b><small>machine arrêtée</small></button><button type="button" class="sm-t ext ${ext ? "on" : ""}" data-sm-type="externe" role="radio" aria-checked="${ext}" ${dis}><b>Externe</b><small>machine en marche</small></button></div></li>`;
}
function smSumHtml(s) {
  const t = smTotals(s);
  return `<div class="sm-sum"><div><small>Arrêt observé</small><b>${smFmt(t.before)}</b></div><div><small>Arrêt visé</small><b>${smFmt(t.after)}</b></div><div class="${t.gain > 0 ? "ok" : ""}"><small>Gain par changement</small><b>${t.gain > 0 ? `−${smFmt(t.gain)} · ${t.pct} %` : "—"}</b></div><div><small>Gagné par semaine</small><b>${s.per_week && t.gain > 0 ? `${smHours(t.gain * s.per_week)} h` : "—"}</b>${s.per_week ? "" : "<small>indiquer le nombre de changements</small>"}</div></div>`;
}
function smActsHtml(s, writable) {
  const acts = smActsTodo(s);
  if (!writable || !acts.length) return "";
  const open = acts.filter((o) => !o.action_id);
  return `<section class="cs-gaps"><h3>Actions · ${acts.length}</h3><p class="hint">Chaque transformation devient une action datée du plan d’actions.</p><ol class="cs-gap-list">${acts.map((o) => `<li data-sm-act="${esc(o.id)}"><label class="cs-act"><input type="checkbox" data-sm-actchk ${o.action_id ? "checked disabled" : o.act === false ? "" : "checked"}> <span><b>${esc(o.label || "Opération")}</b> ${esc(o.action)}${o.action_id ? ` <em>Action ${esc(o.action_id)} créée</em>` : ""}</span></label>
      ${o.action_id ? "" : `<div class="cs-act-fields"><label>Qui ?<input data-sm-who list="ownerList" value="${esc(o.who || s.owner || "")}"></label><label>Pour quand ?<input type="date" data-sm-when value="${esc(o.when || auAddDays(21))}"></label></div>`}</li>`).join("")}</ol>${ownerDatalist()}${open.length ? '<button type="button" class="btn" data-sm-mkactions>Ajouter au plan d’actions</button>' : ""}</section>`;
}
function smBody(s, tab) {
  const writable = smWritable(s), t = smTotals(s), ops = s.ops || [], running = smRunning(s);
  if (tab === "chrono") {
    const order = ops.map((o, i) => ({ o, i })), shown = running ? order.slice().reverse() : order, locked = ops.some((o) => o.action_id);
    return `<section class="sm-chrono ${running ? "on" : ""}"><div class="sm-clock"><span data-sm-clock>${running ? "0:00" : smFmt(t.before + t.ext)}</span><small data-sm-lap>${running ? "Étape en cours" : ops.length ? `Changement chronométré · ${jnPlural(ops.length, "opération", "opérations")}` : "Prêt à chronométrer"}</small></div>
      ${writable ? (running ? `<div class="sm-chrono-btns"><button type="button" class="btn jn-big sm-lapbtn" data-sm-lapbtn>Fin d’étape</button><button type="button" class="btn jn-big secondary" data-sm-stop>Premier bon produit · fin</button></div>` : !ops.length ? `<div class="sm-chrono-btns"><button type="button" class="btn jn-big" data-sm-start>Démarrer au dernier bon produit</button></div>` : "") : ""}
      <p class="hint">${running ? "Touchez « Fin d’étape » à chaque opération ; nommez-les maintenant ou après. Le chrono continue si vous fermez l’appli." : ops.length ? "Nommez chaque opération et dites si elle se fait machine arrêtée ou en marche, puis passez à l’analyse." : "Du dernier bon produit au premier bon produit à cadence, réglages et essais compris. Pas de changement en cours ? Saisissez les opérations à la main."}</p></section>
      <section><div class="section-title"><h3>Opérations · ${ops.length}</h3><span class="sm-tots" data-sm-tots>Interne ${smFmt(t.before)} · externe ${smFmt(t.ext)}</span></div>
      <ol class="sm-ops">${shown.map(({ o, i }) => smOpRow(s, o, i, writable, tab)).join("") || '<li class="jn-empty">Aucune opération pour l’instant.</li>'}</ol>
      ${writable && !running ? `<div class="sm-tools"><button type="button" class="btn secondary" data-sm-addop>+ Opération à la main</button>${ops.length && !locked ? '<button type="button" class="btn ghost" data-sm-restart>Rechronométrer depuis zéro</button>' : ""}${ops.length ? '<button type="button" class="btn" data-sm-tab="analyse">Passer à l’analyse</button>' : ""}</div>` : ""}</section>`;
  }
  if (tab === "analyse") {
    return `<div data-sm-head>${smSumHtml(s)}${ops.length ? smGantt(s) : ""}</div>
      <section><h3>Pour chaque opération interne : que faire ?</h3><ol class="sm-ops">${ops.map((o, i) => smOpRow(s, o, i, writable, tab)).join("") || '<li class="jn-empty">Chronométrez d’abord un changement.</li>'}</ol></section>
      <div data-sm-acts>${smActsHtml(s, writable)}</div>`;
  }
  const ms = (s.measures || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))), last = ms[0];
  const std = s.standard_id && data.documents.find((d) => d.id === s.standard_id && !d.archived_at), gap = last && s.target_min ? last.min - s.target_min : null;
  return `<div class="sm-sum"><div><small>Référence</small><b>${t.before ? `${smNum(t.before / 60)} min` : "—"}</b></div><div><small>Cible</small><b>${s.target_min ? `${s.target_min} min` : "—"}</b></div><div><small>Dernier mesuré</small><b>${last ? `${smNum(last.min)} min` : "—"}</b></div><div class="${gap === null ? "" : gap <= 0 ? "ok" : "warn"}"><small>Écart à la cible</small><b>${gap === null ? "—" : gap <= 0 ? "Cible tenue" : `+${smNum(gap)} min`}</b></div></div>
    ${smTrend(s)}
    ${writable ? `<section class="verification-box"><h3>Mesurer un changement</h3><p class="hint">Après les actions, mesurez les changements suivants : c’est ce qui prouve le gain.</p><div class="cs-who-when"><label>Durée (min)<input id="smMeasure" type="number" min="0" step="0.5" inputmode="decimal" placeholder="Ex. 22"></label><label>Date<input id="smMeasureDate" type="date" max="${today()}" value="${today()}"></label></div><button type="button" class="btn secondary" data-sm-measure>Enregistrer la mesure</button></section>` : ""}
    <section class="sm-std"><h3>Standard de changement</h3>${std ? `<p>${esc(std.id)} · ${esc(std.title)} · ${esc(std.status || "Brouillon")} · v${std.version || 1}</p><button type="button" class="btn secondary" data-st-open="${esc(std.id)}">Ouvrir le standard</button>` : writable ? `<p class="hint">La nouvelle séquence devient un standard de poste : d’abord ce qui se prépare machine en marche, puis les opérations machine arrêtée. Vous y ajoutez ensuite photos et points clés.</p><button type="button" class="btn secondary" data-sm-standard ${ops.length ? "" : "disabled"}>Créer le standard de changement</button>` : '<p class="hint">Pas encore de standard.</p>'}</section>`;
}
function smOpen(id, tab = null) {
  const s = smGet(id);
  if (!s || !allowedSite(s.site_id)) return;
  tab ||= smRunning(s) || !(s.ops || []).length ? "chrono" : "analyse";
  const tabs = [["chrono", "1. Chrono"], ["analyse", "2. Analyse"], ["resultat", "3. Résultat"]], proj = s.project_id && (data.projects || []).find((p) => p.id === s.project_id);
  modal(`${s.id} · ${s.title}`, `<div class="sm-study" data-sm-id="${esc(s.id)}"><p class="jn-where">${esc(getSiteName(s.site_id))} · pilote ${esc(s.owner || "à désigner")}${s.target_min ? ` · cible ${s.target_min} min` : ""}${proj ? ` · chantier ${esc(proj.id)}` : ""}</p>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-sm-tab="${k}">${l}</button>`).join("")}</div>
    <div class="sm-body">${smBody(s, tab)}</div></div>`);
  modalSaver = () => { uxFlush(); return true; };
  smBind(s.id, tab);
}
function smRoot(id) { return $("modalContent")?.querySelector(`.sm-study[data-sm-id="${id}"]`); }
function smRedraw(id, tab) {
  const root = smRoot(id), box = root?.querySelector(".sm-body"), s = smGet(id);
  if (!box || !s) return;
  const scroller = box.closest(".modal"), top = scroller?.scrollTop;
  box.innerHTML = smBody(s, tab);
  smBind(id, tab);
  if (scroller && top !== undefined) scroller.scrollTop = top;
}
function smClock(id) {
  clearInterval(smTick);
  const tickFn = () => {
    const s = smGet(id), el = document.querySelector("[data-sm-clock]");
    if (!el || !smRunning(s)) { clearInterval(smTick); return; }
    const t = Date.now(), total = (t - Date.parse(s.chrono.started_at)) / 1000, lap = (t - Date.parse(s.chrono.lap_at || s.chrono.started_at)) / 1000;
    el.textContent = smFmt(total);
    const l = document.querySelector("[data-sm-lap]");
    if (l) l.textContent = `Étape ${(s.ops || []).length + 1} · ${smFmt(lap)}`;
  };
  tickFn();
  smTick = setInterval(tickFn, 500);
}
function smBind(id, tab) {
  const root = smRoot(id), s = smGet(id);
  if (!root || !s) return;
  root.querySelectorAll("button[data-sm-tab]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); smOpen(id, b.dataset.smTab); }));
  root.querySelectorAll("[data-st-open]").forEach((b) => (b.onclick = () => stOpen(b.dataset.stOpen)));
  if (tab === "chrono" && smRunning(s)) smClock(id); else clearInterval(smTick);
  if (!smWritable(s)) return;
  const opOf = (el) => el.closest("[data-sm-op]")?.dataset.smOp;
  const withOp = (el, fn) => { const oid = opOf(el); return smSave(id, (x) => { const o = x.ops.find((k) => k.id === oid); if (o) fn(o); }); };
  const refreshTots = () => { const t = smTotals(smGet(id)), el = root.querySelector("[data-sm-tots]"); if (el) el.textContent = `Interne ${smFmt(t.before)} · externe ${smFmt(t.ext)}`; const c = root.querySelector("[data-sm-clock]"); if (c && !smRunning(smGet(id))) c.textContent = smFmt(t.before + t.ext); };
  const refreshHead = () => { const h = root.querySelector("[data-sm-head]"), x = smGet(id); if (h) h.innerHTML = `${smSumHtml(x)}${(x.ops || []).length ? smGantt(x) : ""}`; };
  const refreshActs = () => { const box = root.querySelector("[data-sm-acts]"); if (!box) return; box.innerHTML = smActsHtml(smGet(id), true); bindActs(); };
  const start = () => { if (smSave(id, (x) => { x.ops = []; x.chrono = { started_at: now(), lap_at: now() }; })) smRedraw(id, "chrono"); };
  root.querySelector("[data-sm-start]")?.addEventListener("click", start);
  const restart = root.querySelector("[data-sm-restart]");
  restart?.addEventListener("click", () => { if (!restart.dataset.confirm) { restart.dataset.confirm = "1"; restart.textContent = "Touchez encore : les opérations relevées seront effacées"; return; } start(); });
  const lap = (end) => {
    if (!smSave(id, (x) => {
      const at = now(), dur = Math.round((Date.parse(at) - Date.parse(x.chrono.lap_at || x.chrono.started_at)) / 1000);
      if (dur > 0) x.ops.push({ id: uid("OP"), label: "", dur_s: dur, type: "interne" });
      x.chrono.lap_at = at;
      if (end) x.chrono.ended_at = at;
    })) return;
    smRedraw(id, "chrono");
    if (end) toast("Changement chronométré. Nommez les opérations, puis passez à l’analyse.");
  };
  root.querySelector("[data-sm-lapbtn]")?.addEventListener("click", () => lap(false));
  root.querySelector("[data-sm-stop]")?.addEventListener("click", () => lap(true));
  root.querySelector("[data-sm-addop]")?.addEventListener("click", () => { const oid = uid("OP"); if (smSave(id, (x) => { x.ops.push({ id: oid, label: "", dur_s: 60, type: "interne" }); })) { smRedraw(id, tab); smRoot(id)?.querySelector(`[data-sm-op="${oid}"] [data-sm-label]`)?.focus({ preventScroll: false }); } });
  root.querySelectorAll("[data-sm-label]").forEach((el) => { el.onchange = () => withOp(el, (o) => { o.label = el.value.trim(); }); el.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } }; });
  root.querySelectorAll("[data-sm-dur]").forEach((el) => { el.onchange = () => { const v = smParse(el.value); if (v === null) { toast("Durée en minutes:secondes, par exemple 2:30."); el.value = smFmt(smGet(id).ops.find((o) => o.id === opOf(el))?.dur_s); return; } if (withOp(el, (o) => { o.dur_s = v; if (o.after_s > v) o.after_s = v; })) { el.value = smFmt(v); refreshTots(); } }; });
  root.querySelectorAll("[data-sm-type]").forEach((b) => (b.onclick = () => {
    if (!withOp(b, (o) => { o.type = b.dataset.smType; if (o.type === "externe") delete o.after; })) return;
    const li = b.closest("[data-sm-op]"), ext = b.dataset.smType === "externe";
    li.classList.toggle("externe", ext); li.classList.toggle("interne", !ext);
    li.querySelectorAll("[data-sm-type]").forEach((k) => { const on = k === b; k.classList.toggle("on", on); k.setAttribute("aria-checked", String(on)); });
    refreshTots();
  }));
  root.querySelectorAll("[data-sm-del]").forEach((b) => (b.onclick = () => {
    const li = b.closest("[data-sm-op]"), oid = opOf(b), o = smGet(id).ops.find((k) => k.id === oid);
    if ((o?.label || o?.action_id) && !li.dataset.confirm) { li.dataset.confirm = "1"; toast("Touchez × encore une fois pour supprimer l’opération."); return; }
    if (smSave(id, (x) => { x.ops = x.ops.filter((k) => k.id !== oid); })) smRedraw(id, tab);
  }));
  root.querySelectorAll("[data-sm-after]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); if (withOp(b, (o) => { o.after = b.dataset.smAfter; if (o.after === "reduite" && o.after_s === undefined) o.after_s = Math.round((Number(o.dur_s) || 0) / 2); })) smRedraw(id, tab); }));
  root.querySelectorAll("[data-sm-afters]").forEach((el) => { el.onchange = () => { const v = smParse(el.value); if (v === null) { toast("Durée en minutes:secondes, par exemple 1:30."); return; } let kept = v; if (withOp(el, (o) => { o.after_s = Math.min(v, Number(o.dur_s) || v); kept = o.after_s; })) { el.value = smFmt(kept); refreshHead(); } }; });
  root.querySelectorAll("[data-sm-action]").forEach((el) => { el.onchange = () => { if (withOp(el, (o) => { o.action = el.value.trim(); })) { refreshActs(); } }; });
  function syncActs() {
    smRoot(id)?.querySelectorAll("[data-sm-act]").forEach((li) => { const oid = li.dataset.smAct; smSave(id, (x) => { const o = x.ops.find((k) => k.id === oid); if (!o || o.action_id) return; o.act = li.querySelector("[data-sm-actchk]").checked; o.who = li.querySelector("[data-sm-who]")?.value.trim(); o.when = li.querySelector("[data-sm-when]")?.value; }); });
  }
  function bindActs() {
    const r = smRoot(id);
    r?.querySelectorAll("[data-sm-act] input").forEach((el) => (el.onchange = syncActs));
    r?.querySelector("[data-sm-mkactions]")?.addEventListener("click", () => {
      document.activeElement?.blur?.();
      syncActs();
      const todo = smActsTodo(smGet(id)).filter((o) => !o.action_id && o.act !== false);
      if (!todo.length) return toast("Aucune action cochée à ajouter.");
      if (todo.some((o) => !o.who || !o.when)) return toast("Chaque action a besoin d’un responsable et d’une date.");
      let n = 0;
      if (!commitData(() => {
        const x = data.smed.find((k) => k.id === id);
        for (const o of x.ops.filter((k) => todo.some((t) => t.id === k.id))) {
          const aid = auNext("A", data.actions), verb = SM_AFTER.find((k) => k[0] === smAfter(o))[1].toLowerCase();
          data.actions.unshift({ id: aid, site_id: x.site_id, title: o.action, description: `SMED ${x.id} · ${x.title}\n${o.label || "Opération"} (${smFmt(o.dur_s)}) : ${verb}.`, owner: o.who, due_date: o.when, due_date_initial: o.when, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Production", origin_type: "SMED", smed_id: x.id, finding: `${o.label || "Opération"} · ${smFmt(o.dur_s)} machine arrêtée`, created_at: now(), updated_at: now() });
          o.action_id = aid;
          n += 1;
        }
        x.updated_at = now();
      })) return;
      modalDirty = false;
      toast(`${jnPlural(n, "action ajoutée au plan", "actions ajoutées au plan")}.`);
      render();
      smOpen(id, "analyse");
    });
  }
  bindActs();
  root.querySelector("[data-sm-measure]")?.addEventListener("click", () => {
    const v = Number(String($("smMeasure").value).replace(",", ".")), d = $("smMeasureDate").value;
    if (!Number.isFinite(v) || v <= 0 || !d || d > today()) return toast("Indiquez une durée en minutes et une date passée ou du jour.");
    if (smSave(id, (x) => { x.measures ||= []; x.measures.push({ date: d, min: Math.round(v * 10) / 10, by: apMe() || "" }); })) { smRedraw(id, "resultat"); toast("Mesure enregistrée."); }
  });
  root.querySelector("[data-sm-standard]")?.addEventListener("click", () => {
    const x = smGet(id), ext = x.ops.map((o, i) => ({ o, i })).filter(({ o }) => smAfter(o) === "externe"), int = x.ops.map((o, i) => ({ o, i })).filter(({ o }) => smAfterInternal(o) > 0);
    if (!ext.length && !int.length) return toast("Aucune opération à décrire.");
    const step = ({ o, i }, when) => {
      const moved = o.type !== "externe" && smAfter(o) === "externe" && o.action, title = moved ? o.action : o.label || `Opération ${i + 1}`;
      const how = o.action && !moved && smAfter(o) === "reduite" ? [{ kind: "geste", text: o.action }] : [];
      return { id: uid("STEP"), title, points: [{ kind: "geste", text: when }, ...how], reason: moved ? `Avant : ${o.label || "opération"} machine arrêtée (${smFmt(o.dur_s)})` : "", photo: "", time_s: smAfterInternal(o) || Number(o.dur_s) || null };
    };
    const doc = { id: nextId("DOC", data.documents), site_id: x.site_id, type: "STANDARD", title: /changement/i.test(x.title) ? x.title : `Changement · ${x.title}`, owner: x.owner, status: "Brouillon", problem_id: null, structured_data: { st: { zone_id: null, ppe: [], steps: [...ext.map((k) => step(k, "Machine en marche, avant l’arrêt")), ...int.map((k) => step(k, "Machine arrêtée"))], reaction: ST_REACTION, trained: [] } }, version: 1, created_at: now(), updated_at: now() };
    if (!commitData(() => { data.documents.unshift(doc); data.smed.find((k) => k.id === id).standard_id = doc.id; })) return;
    modalDirty = false;
    render();
    toast("Standard de changement créé : ajoutez les photos et les points clés.");
    stOpen(doc.id);
  });
}

/* ---------- Branchements ---------- */

const smRenderProjectsBase = renderProjects;
renderProjects = function () {
  if (state.projectsTab === "smed" && smCan()) return smPage();
  let html = smRenderProjectsBase.apply(this, arguments);
  if (!smCan()) return html;
  for (const p of data.projects || []) {
    const study = (data.smed || []).find((s) => s.project_id === p.id && !s.archived_at);
    if (p.method !== "SMED" && !study) continue;
    if (!study && (role().readonly || !allowedSite(p.site_id, true))) continue;
    html = html.replace(`data-action-from-project="${p.id}">Ajouter une action</button>`, (m) => `${m}<button class="btn small" type="button" data-sm-project="${esc(p.id)}">${study ? `Étude ${esc(study.id)}` : "Chronométrer en SMED"}</button>`);
  }
  return html;
};
function smFromProject(pid) {
  const p = (data.projects || []).find((x) => x.id === pid);
  if (!p) return;
  const study = (data.smed || []).find((s) => s.project_id === pid && !s.archived_at);
  if (study) { smGo(); smOpen(study.id); return; }
  const target = String(p.target || "").match(/(\d+(?:[.,]\d+)?)\s*min/i);
  smNew({ site_id: p.site_id, project_id: p.id, title: p.title, owner: p.owner, target_min: target ? Math.round(Number(target[1].replace(",", "."))) : null });
}
const smWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = smWatchBase();
  if (!smCan() || state.role === "dg") return base;
  const live = smList().filter(smRunning);
  if (!live.length) return base;
  const rows = live.map((s) => `<button type="button" class="jn-row" data-sm-open="${esc(s.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">SMED</span><b>Chrono en cours · ${esc(s.title)}</b><span class="hint">Démarré à ${new Date(s.chrono.started_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${jnPlural((s.ops || []).length, "étape relevée", "étapes relevées")}</span></span></button>`);
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows.join("")}`);
};
state.projectsTab ||= "projects";
const smTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = smTabsBase(stage);
  if (stage?.id !== "resoudre" || !smCan()) return out;
  const p = out.find((t) => t.key === "projects");
  if (p) p.set = { ...(p.set || {}), projectsTab: "projects" };
  if (!out.some((t) => t.key === "smed")) { const i = out.findIndex((t) => t.key === "projects"); out.splice(i >= 0 ? i + 1 : out.length, 0, { key: "smed", label: "SMED", view: "projects", set: { projectsTab: "smed" } }); }
  return out;
};
const smToolLaunchBase = toolLaunch;
toolLaunch = function (id) {
  if (id === "smed" && smCan()) return `<div class="attention-strip"><div><b>Passer à la pratique</b><span>Chronométrez un changement au téléphone, séparez interne et externe, mesurez le gain.</span></div><button class="btn" data-sm-go>Ouvrir le SMED</button></div>`;
  return smToolLaunchBase.apply(this, arguments);
};
const smCloseModalBase = closeModal;
closeModal = function () { clearInterval(smTick); return smCloseModalBase.apply(this, arguments); };
function smGo() { state.projectsTab = "smed"; switchView("projects"); }
function smBindGlobal(root = document) {
  root.querySelectorAll("[data-sm-new]").forEach((b) => (b.onclick = () => smNew()));
  root.querySelectorAll("[data-sm-open]").forEach((b) => (b.onclick = () => smOpen(b.dataset.smOpen)));
  root.querySelectorAll("[data-sm-go]").forEach((b) => (b.onclick = smGo));
  root.querySelectorAll("[data-sm-project]").forEach((b) => (b.onclick = () => smFromProject(b.dataset.smProject)));
}
const smOsBindBase = osBind;
osBind = function () { const out = smOsBindBase.apply(this, arguments); smBindGlobal(document); return out; };
