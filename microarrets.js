"use strict";
/*
 * BIA Lean OS 8.35 · Micro-arrêts de ligne (Observer › Micro-arrêts).
 *  - Une ligne (ou un poste) a son seuil : au-delà, l'arrêt est une panne (5 min par défaut) et se déclare en TPM ;
 *    la durée type d'un micro-arrêt compté (1 min), son temps d'ouverture du jour, son objectif de minutes perdues, ses causes.
 *  - Au poste, en un geste : compter (+1 sur la cause, durée type) ou chronométrer (« La ligne s'arrête »,
 *    puis la cause quand elle repart : durée réelle). « Annuler le dernier » corrige une erreur de doigt.
 *  - Lecture : arrêts et minutes perdues, points de TRS perdus (minutes perdues / temps d'ouverture),
 *    Pareto des causes, heures où la ligne s'arrête, 14 derniers jours contre l'objectif.
 *  - Suites : la cause n°1 devient un sujet du TOP 15 ou une action ; une ligne au-dessus de son objectif est à surveiller ;
 *    le C du TOP 5 affiche les micro-arrêts du jour. Feuille de bâtonnage à imprimer pour les lignes sans téléphone.
 * Données : mlLines[] { id, site_id, workshop_id, name, machine_id, threshold_min, typical_min, opening_min, target_min, causes[] }
 *           microStops[] { id, line_id, site_id, at, cause, dur_s, timed, by } — collections non indexées, 120 jours conservés.
 */

const ML_CAUSES = ["Bourrage, coincement", "Manque matière", "Réglage, centrage", "Capteur, détection", "Attente opérateur", "Contrôle qualité", "Changement d’outil", "Autre"];
const ML_KEEP_DAYS = 120;
let mlLineSel = null, mlPeriod = 7;

function mlCan() { return role().nav.includes("terrain"); }
function mlWritable(siteId) { return mlCan() && !role().readonly && allowedSite(siteId, true); }
function mlManager(siteId) { return mlWritable(siteId) && osManager(); }
function mlLines() {
  return (data.mlLines || []).filter((l) => !l.archived_at && allowedSite(l.site_id) && (state.site === "group" || l.site_id === state.site) && (!state.workshop || !l.workshop_id || l.workshop_id === state.workshop))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "fr"));
}
function mlLine(id) { return (data.mlLines || []).find((l) => l.id === id && !l.archived_at) || null; }
function mlCur() { const ls = mlLines(); return ls.find((l) => l.id === mlLineSel) || ls[0] || null; }
function mlDate(iso) { const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function mlFrom(days) { return days <= 1 ? today() : auAddDays(-(days - 1)); }
function mlStops(lineId, days = 1) { const from = mlFrom(days); return (data.microStops || []).filter((s) => s.line_id === lineId && mlDate(s.at) >= from && mlDate(s.at) <= today()); }
function mlMin(s, l) { return s.dur_s != null ? s.dur_s / 60 : Number(l?.typical_min) || 1; }
function mlFmt(min) { if (!min) return "0 min"; return min < 60 ? `${smNum(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`; }
function mlCauses(l) { return (l?.causes || []).length ? l.causes : ML_CAUSES; }
function mlSum(l, days = 1) {
  const rows = mlStops(l.id, days), min = rows.reduce((n, s) => n + mlMin(s, l), 0), followed = new Set(rows.map((s) => mlDate(s.at))).size || (days === 1 ? 1 : 0);
  const byCause = mlCauses(l).map((c) => { const r = rows.filter((s) => s.cause === c); return { c, n: r.length, min: r.reduce((n, s) => n + mlMin(s, l), 0) }; })
    .concat([...new Set(rows.map((s) => s.cause))].filter((c) => !mlCauses(l).includes(c)).map((c) => { const r = rows.filter((s) => s.cause === c); return { c, n: r.length, min: r.reduce((n, s) => n + mlMin(s, l), 0) }; }))
    .filter((x) => x.n).sort((a, b) => b.min - a.min || b.n - a.n);
  const perDay = followed ? min / followed : 0, open = Number(l.opening_min) || 420;
  return { rows, n: rows.length, min, followed, perDay, nPerDay: followed ? rows.length / followed : 0, pts: (perDay / open) * 100, byCause, top: byCause[0] || null, over: Number(l.target_min) > 0 && perDay > Number(l.target_min) };
}

/* Chronomètre en cours : propre à l'appareil du poste. */
function mlRunKey(id) { return `bia-ml-run-${id}`; }
function mlRun(id) { try { const v = Number(localStorage.getItem(mlRunKey(id))); return v > 0 ? v : null; } catch { return null; } }
function mlSetRun(id, v) { try { v ? localStorage.setItem(mlRunKey(id), String(v)) : localStorage.removeItem(mlRunKey(id)); } catch { /* stockage indisponible */ } }
function mlClock(sec) { sec = Math.max(0, Math.floor(sec)); return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; }

function mlAdd(l, cause, durS = null, startMs = null) {
  let id = null;
  const ok = commitData(() => {
    data.microStops ||= [];
    const keep = auAddDays(-ML_KEEP_DAYS);
    data.microStops = data.microStops.filter((s) => mlDate(s.at) >= keep);
    id = uid("MA");
    data.microStops.unshift({ id, line_id: l.id, site_id: l.site_id, at: startMs ? new Date(startMs).toISOString() : now(), cause, dur_s: durS == null ? null : Math.round(durS), timed: durS != null, by: apMe() || role().label });
  });
  return ok ? id : null;
}

/* ---------- Page ---------- */

function mlPage() {
  const ls = mlLines(), l = mlCur(), manager = state.site === "group" ? OPERATIONAL_SITES.some((s) => mlManager(s.id)) : mlManager(state.site);
  const head = pageHead("Observer", "TRS et arrêts de ligne", "La feuille de poste saisie en quelques gestes : le TRS se calcule seul, part au pilotage, et montre où part le temps — arrêts, micro-arrêts, cadence, qualité.",
    ls.length ? `<div class="cs-head-tools">${manager ? '<button type="button" class="btn secondary" data-ml-newline>Ajouter une ligne</button>' : ""}<button type="button" class="btn ghost" data-ml-print>Feuille à imprimer</button></div>` : "");
  if (!l) return `${head}<section class="cs-empty"><h2>Commencez par une ligne</h2><p>Son nom, sa cadence théorique en pièces par heure, la durée d’un poste et le seuil au-delà duquel un arrêt est une panne. Ensuite, chaque feuille de poste saisie donne le TRS ; les micro-arrêts se reportent depuis la feuille papier ou se comptent au poste d’un geste.</p>${manager ? '<button type="button" class="btn" data-ml-newline>Ajouter une ligne</button>' : '<p class="hint">Le responsable d’équipe, de site ou Lean ajoute les lignes.</p>'}</section>${mlHow()}`;
  const chips = ls.length > 1 ? `<div class="filters ml-lines" role="group" aria-label="Ligne">${ls.map((x) => { const s = mlSum(x); return `<button type="button" class="chip ${x.id === l.id ? "active" : ""} ${s.over ? "ml-over" : ""}" data-ml-line="${esc(x.id)}" aria-pressed="${x.id === l.id}">${esc(x.name)}${state.site === "group" ? ` · ${esc(getSiteName(x.site_id))}` : ""}</button>`; }).join("")}</div>` : "";
  return `${head}${chips}${typeof tsSection === "function" ? tsSection(l) : ""}${mlCounter(l)}${mlReading(l)}${manager ? mlLineList(ls) : ""}${mlHow()}`;
}

function mlCounter(l) {
  const w = mlWritable(l.site_id), s = mlSum(l), run = mlRun(l.id), target = Number(l.target_min) || 0;
  const pct = target ? Math.min(100, (s.min / target) * 100) : 0;
  const cause = (c) => { const n = s.rows.filter((r) => r.cause === c).length; return `<button type="button" class="ml-cause" data-ml-cause="${esc(c)}" ${w ? "" : "disabled"}><span>${esc(c)}</span><b>${n || ""}</b></button>`; };
  return `<section class="ml-counter section ${run ? "running" : ""}" data-ml-id="${esc(l.id)}" aria-label="Compter les micro-arrêts">
    <div class="ml-today"><div><h2>Micro-arrêts au poste · ${esc(l.name)}</h2><p class="hint">${esc(getSiteName(l.site_id))} · aujourd’hui · au-delà de ${smNum(Number(l.threshold_min) || 5)} min, c’est une panne</p></div>
      <div class="ml-figs"><span><b>${s.n}</b><small>arrêt${s.n > 1 ? "s" : ""}</small></span><span class="${s.over ? "bad" : ""}"><b>${mlFmt(s.min)}</b><small>perdues${target ? ` · objectif ${smNum(target)} min` : ""}</small></span><span><b>${smNum(s.pts)}</b><small>pt de TRS</small></span></div></div>
    ${target ? `<div class="ml-bar ${s.over ? "over" : ""}" role="img" aria-label="${esc(`${mlFmt(s.min)} perdues sur un objectif de ${smNum(target)} min`)}"><span style="width:${pct.toFixed(1)}%"></span></div>` : ""}
    ${w ? (run ? `<div class="ml-run"><span class="ml-elapsed" data-ml-start="${run}" data-ml-limit="${(Number(l.threshold_min) || 5) * 60}">${mlClock((Date.now() - run) / 1000)}</span><p>Ligne arrêtée · <b>touchez la cause quand elle repart</b></p><button type="button" class="btn ghost small" data-ml-cancelrun>Fausse alerte</button></div>`
      : `<button type="button" class="btn ml-stop" data-ml-run>La ligne s’arrête</button><p class="hint ml-or">ou comptez un arrêt déjà passé : touchez sa cause</p>`) : '<p class="hint">Lecture seule pour votre profil.</p>'}
    <div class="ml-causes">${mlCauses(l).map(cause).join("")}</div>
    ${w && s.n ? '<div class="ml-undo"><button type="button" class="btn ghost small" data-ml-undo>Annuler le dernier</button></div>' : ""}</section>`;
}

function mlReading(l) {
  const s = mlSum(l, mlPeriod), target = Number(l.target_min) || 0;
  const per = `<div class="filters ml-period" role="group" aria-label="Période">${[7, 30].map((d) => `<button type="button" class="chip ${mlPeriod === d ? "active" : ""}" data-ml-days="${d}" aria-pressed="${mlPeriod === d}">${d} jours</button>`).join("")}</div>`;
  if (!s.n) return `<section class="section ml-read"><div class="section-title"><h2>Micro-arrêts : causes et heures</h2>${per}</div><p class="hint">Aucun micro-arrêt compté sur ${mlPeriod} jours. Comptez pendant deux semaines pour voir les causes qui reviennent.</p></section>`;
  const strip = `<div class="cs-summary"><div><b>${smNum(s.nPerDay)}</b><span>arrêts par jour suivi</span></div><div class="${s.over ? "bad" : ""}"><b>${mlFmt(s.perDay)}</b><span>perdues par jour${target ? ` · objectif ${smNum(target)}` : ""}</span></div><div><b>${smNum(s.pts)}</b><span>pt de TRS perdus</span></div><div class="ml-topc"><b>${esc(s.top.c)}</b><span>cause n°1 · ${Math.round((s.top.min / s.min) * 100)} % du temps</span></div></div>`;
  const max = s.byCause[0].min || 1;
  let cum = 0;
  const pareto = `<figure class="sm-trend ml-pareto" role="img" aria-label="${esc(s.byCause.map((x) => `${x.c} ${mlFmt(x.min)}`).join(", "))}"><div class="sm-g">${s.byCause.slice(0, 8).map((x) => { cum += x.min; return `<div class="sm-g-row"><span class="sm-g-l">${esc(x.c)} <small>${x.n}×</small></span><div class="sm-g-track"><div class="sm-g-in"><span class="sm-tbar warn" style="width:${((x.min / max) * 62).toFixed(1)}%"></span><b class="sm-g-t" style="left:${((x.min / max) * 62).toFixed(1)}%">${mlFmt(x.min)} · ${Math.round((cum / s.min) * 100)} %</b></div></div></div>`; }).join("")}</div><figcaption>Minutes perdues par cause, et part cumulée : les deux ou trois premières font souvent l’essentiel.</figcaption></figure>`;
  const hours = Array.from({ length: 24 }, (_, h) => s.rows.filter((r) => new Date(r.at).getHours() === h).length), hs = hours.map((n, h) => ({ n, h })).filter((x) => x.n), hmax = Math.max(1, ...hours);
  const lo = hs.length ? Math.min(...hs.map((x) => x.h)) : 0, hi = hs.length ? Math.max(...hs.map((x) => x.h)) : 0;
  const hourFig = `<figure class="ml-hours" role="img" aria-label="${esc(hs.map((x) => `${x.h} h : ${x.n}`).join(", "))}"><div class="ml-hbars">${hours.slice(lo, hi + 1).map((n, i) => `<span class="ml-hcol"><i style="height:${((n / hmax) * 100).toFixed(0)}%" class="${n === hmax ? "peak" : ""}"></i><small>${lo + i}h</small></span>`).join("")}</div><figcaption>Arrêts par heure de la journée : un pic au démarrage, après la pause ou au changement d’équipe dit où regarder.</figcaption></figure>`;
  const days = Array.from({ length: 14 }, (_, i) => auAddDays(i - 13)), dm = days.map((d) => (data.microStops || []).filter((x) => x.line_id === l.id && mlDate(x.at) === d).reduce((n, x) => n + mlMin(x, l), 0)), dmax = Math.max(target, 1, ...dm) * 1.15;
  const dayFig = `<figure class="ml-days" role="img" aria-label="${esc(days.map((d, i) => `${shortDate(d).slice(0, 5)} ${mlFmt(dm[i])}`).join(", "))}"><div class="ml-dbars">${target ? `<span class="ml-target" style="bottom:${((target / dmax) * 100).toFixed(1)}%"><small>objectif</small></span>` : ""}${dm.map((m, i) => `<span class="ml-dcol"><i style="height:${((m / dmax) * 100).toFixed(1)}%" class="${target && m > target ? "over" : ""}"></i><small>${shortDate(days[i]).slice(0, 2)}</small></span>`).join("")}</div><figcaption>Minutes perdues par jour sur 14 jours${target ? ", contre l’objectif" : ""}.</figcaption></figure>`;
  const w = mlWritable(l.site_id);
  const next = w ? `<div class="ml-next"><p><b>Suite :</b> ${esc(s.top.c)} fait ${Math.round((s.top.min / s.min) * 100)} % des minutes perdues sur ${mlPeriod} jours.</p><div class="row-actions"><button type="button" class="btn" data-ml-top15>Mettre au TOP 15</button><button type="button" class="btn secondary" data-ml-action>Créer une action</button></div></div>` : "";
  return `<section class="section ml-read"><div class="section-title"><h2>Micro-arrêts : causes et heures</h2>${per}</div>${strip}${next}<div class="ml-figs2"><div><h3>Les causes</h3>${pareto}</div><div><h3>Quand</h3>${hourFig}${dayFig}</div></div></section>`;
}

function mlLineList(ls) {
  return `<section class="section"><div class="section-title"><h2>Lignes suivies · ${ls.length}</h2></div><div class="jn-rows">${ls.map((x) => { const s = mlSum(x, 7); return `<div class="jn-row ml-linerow"><span class="jn-row-main"><b>${esc(x.name)}</b><span class="hint">${esc(getSiteName(x.site_id))} · seuil ${smNum(Number(x.threshold_min) || 5)} min · objectif ${smNum(Number(x.target_min) || 0)} min/jour · 7 j : ${mlFmt(s.perDay)}/jour</span></span>${mlManager(x.site_id) ? `<button type="button" class="btn small secondary" data-ml-edit="${esc(x.id)}">Modifier</button>` : ""}</div>`; }).join("")}</div></section>`;
}

function mlHow() {
  return `<details class="cs-how section"><summary>Les micro-arrêts en cinq gestes</summary><ol class="cs-how-list"><li><b>Fixer le seuil</b><span>En dessous (5 min en général), c’est un micro-arrêt ; au-dessus, une panne, déclarée en TPM.</span></li><li><b>Compter au poste, d’un geste</b><span>Chaque relance compte, même de 20 secondes. Le chronomètre donne la durée réelle ; sinon la durée type s’applique.</span></li><li><b>Deux semaines pour voir</b><span>Le Pareto montre les deux ou trois causes qui font l’essentiel, l’heure montre quand.</span></li><li><b>Traiter la cause n°1</b><span>Au TOP 15, en action ou en chantier : guide, capteur, approvisionnement, standard de réglage.</span></li><li><b>Vérifier</b><span>Les minutes perdues doivent passer sous l’objectif et y rester.</span></li></ol></details>`;
}

/* ---------- Formulaires ---------- */

function mlLineForm(id = null) {
  const old = id ? mlLine(id) : null, siteId = old?.site_id || (state.site === "group" ? OPERATIONAL_SITES.find((s) => mlManager(s.id))?.id : state.site);
  if (!siteId || !mlManager(siteId)) return toast("Les lignes sont décidées par un responsable.");
  const machines = (data.machines || []).filter((m) => !m.archived_at && m.site_id === siteId);
  modal(old ? `${old.name} · Ligne` : "Ajouter une ligne", `<form id="mlLineForm" class="jn-form">
    <label class="field">Ligne ou poste<input id="mlName" required maxlength="80" value="${esc(old?.name || "")}" placeholder="Ex. Plaqueuse 2" autocomplete="off"></label>
    ${machines.length ? `<label class="field">Machine en TPM (pour déclarer les pannes)<select id="mlMachine"><option value="">Aucune</option>${machines.map((m) => `<option value="${esc(m.id)}" ${m.id === old?.machine_id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>` : ""}
    <div class="bp-two"><label class="field">Cadence théorique (pièces/h)<input id="mlRate" type="number" inputmode="decimal" min="0" max="100000" step="0.1" value="${esc(old?.rate_ph ?? "")}" placeholder="Ex. 240"></label><label class="field">Durée d’un poste (min)<input id="mlShift" type="number" min="30" max="1440" step="5" value="${esc(old?.shift_min ?? 480)}"></label></div>
    <div class="bp-two"><label class="field">Seuil de panne (min)<input id="mlThr" type="number" min="1" max="60" step="0.5" value="${esc(old?.threshold_min ?? 5)}"></label><label class="field">Durée type d’un arrêt compté (min)<input id="mlTyp" type="number" min="0.1" max="30" step="0.1" value="${esc(old?.typical_min ?? 1)}"></label></div>
    <div class="bp-two"><label class="field">Temps d’ouverture par jour (min)<input id="mlOpen" type="number" min="30" max="1440" step="5" value="${esc(old?.opening_min ?? 420)}"></label><label class="field">Objectif : minutes perdues par jour au plus<input id="mlTarget" type="number" min="0" max="600" step="1" value="${esc(old?.target_min ?? 15)}"></label></div>
    <label class="field">Causes (une par ligne)<textarea id="mlCauses" rows="7">${esc(mlCauses(old).join("\n"))}</textarea></label>
    <div class="form-actions"><button class="btn jn-big">${old ? "Enregistrer" : "Ajouter la ligne"}</button>${old ? '<button type="button" class="btn ghost" data-ml-archive>Ne plus suivre</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("mlName")?.focus(), 0);
  $("modalContent").querySelector("[data-ml-archive]")?.addEventListener("click", () => { if (!commitData(() => { const x = data.mlLines.find((k) => k.id === old.id); x.archived_at = now(); x.updated_at = now(); })) return; modalDirty = false; closeModal(); render(); toast("Ligne retirée du suivi : ses comptages restent dans l’historique."); });
  $("mlLineForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("mlName").value.trim(), num = (k, d) => { const v = Number($(k).value); return Number.isFinite(v) && v >= 0 ? v : d; };
    const causes = [...new Set($("mlCauses").value.split("\n").map((c) => c.trim()).filter(Boolean))].slice(0, 12);
    if (!name) return toast("Le nom de la ligne.");
    if (!causes.length) return toast("Au moins une cause.");
    const patch = { name, machine_id: $("mlMachine")?.value || null, threshold_min: num("mlThr", 5) || 5, typical_min: num("mlTyp", 1) || 1, opening_min: num("mlOpen", 420) || 420, target_min: num("mlTarget", 15), causes, rate_ph: num("mlRate", 0) || null, shift_min: num("mlShift", 480) || 480, updated_at: now() };
    let nid = old?.id;
    if (!commitData(() => {
      data.mlLines ||= [];
      if (old) Object.assign(data.mlLines.find((k) => k.id === old.id), patch);
      else { nid = auNext("LG", data.mlLines); data.mlLines.push({ id: nid, site_id: siteId, workshop_id: state.workshop || null, created_at: now(), ...patch }); }
    })) return;
    mlLineSel = nid; modalDirty = false; closeModal(); render(); toast(old ? "Ligne enregistrée." : "Ligne ajoutée : l’équipe peut compter.");
  };
}

/* Arrêt chronométré au-delà du seuil : c'est une panne. */
function mlTooLong(l, cause, durS, start) {
  const m = l.machine_id ? (data.machines || []).find((x) => x.id === l.machine_id && !x.archived_at) : null, canTpm = m && typeof tmDownForm === "function" && typeof tmWritable === "function" && tmWritable(m.site_id);
  modal("Arrêt long : c’est une panne", `<div class="jn-form"><p class="jn-lead">${esc(l.name)} est restée arrêtée <b>${mlClock(durS)}</b>, au-delà du seuil de ${smNum(Number(l.threshold_min) || 5)} min. Une panne se déclare en TPM pour suivre le MTTR et le MTBF.</p>
    <div class="form-actions">${canTpm ? '<button type="button" class="btn jn-big" data-ml-panne>Déclarer la panne</button>' : ""}<button type="button" class="btn ${canTpm ? "secondary" : ""}" data-ml-keep>Compter en micro-arrêt</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div>${!canTpm ? '<p class="hint">Reliez la ligne à une machine en TPM pour déclarer la panne d’ici.</p>' : ""}</div>`);
  const root = $("modalContent");
  root.querySelector("[data-ml-keep]").onclick = () => { if (!mlAdd(l, cause, durS, start)) return; mlSetRun(l.id, null); closeModal(); render(); toast(`Micro-arrêt de ${mlClock(durS)} compté · ${cause}.`); };
  root.querySelector("[data-ml-panne]")?.addEventListener("click", () => {
    mlSetRun(l.id, null); closeModal();
    tmDownForm(null, { machineId: m.id });
    const s = $("tmDownStart"), en = $("tmDownEnd"), c = $("tmDownCause");
    if (s) s.value = tmLocal(new Date(start).toISOString());
    if (en) en.value = tmLocal(new Date(start + durS * 1000).toISOString());
    if (c) c.value = cause;
  });
}

function mlTop15(l) {
  const s = mlSum(l, mlPeriod);
  if (!s.top || !mlWritable(l.site_id)) return;
  const title = `Micro-arrêts ${l.name} : ${s.top.c} — ${s.top.n} arrêts, ${mlFmt(s.top.min)} perdues sur ${mlPeriod} jours`;
  if ((data.topics || []).some((t) => t.title === title && t.status !== "Clos")) return toast("Ce sujet est déjà au TOP 15.");
  let id = null;
  if (!commitData(() => { id = nextId("TOP", data.topics); data.topics.unshift({ id, site_id: l.site_id, workshop_id: l.workshop_id || null, title, axis: "C", owner: apMe() || "À désigner", due_date: today(), priority: s.over ? "Haute" : "Normale", linked_id: null, status: "Ouvert", decision: "", source: "Micro-arrêts", created_at: now(), updated_at: now() }); })) return;
  render(); toast(`Sujet ${id} ajouté au TOP 15.`);
}
function mlAction(l) {
  const s = mlSum(l, mlPeriod);
  if (!s.top || !mlWritable(l.site_id)) return;
  modal("Action sur les micro-arrêts", `<form id="mlActForm" class="jn-form"><div class="eg-ctx">${esc(l.name)} · ${esc(s.top.c)} : ${s.top.n} arrêts, ${mlFmt(s.top.min)} perdues sur ${mlPeriod} jours (${Math.round((s.top.min / s.min) * 100)} % du total)</div>
    <label class="field">Quoi<input id="mlActTitle" required maxlength="160" placeholder="Ex. Poser un guide d’entrée pour supprimer les bourrages" autocomplete="off"></label>
    <div class="bp-two"><label class="field">Qui<input id="mlActWho" list="ownerList" required value="${esc(apMe() || "")}">${ownerDatalist()}</label><label class="field">Pour quand<input id="mlActDue" type="date" min="${today()}" value="${auAddDays(14)}" required></label></div>
    <div class="form-actions"><button class="btn jn-big">Créer l’action</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("mlActTitle")?.focus(), 0);
  $("mlActForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("mlActTitle").value.trim(), owner = $("mlActWho").value.trim(), due = $("mlActDue").value;
    if (!title || !owner || !due) return toast("Quoi, qui et pour quand.");
    const kpi = typeof osKpi === "function" ? osKpi("trs") : null;
    let aid = null;
    if (!commitData(() => { aid = auNext("A", data.actions); data.actions.unshift({ id: aid, site_id: l.site_id, title, description: `Micro-arrêts ${l.name} · ${s.top.c} : ${s.top.n} arrêts et ${mlFmt(s.top.min)} perdues sur ${mlPeriod} jours (${smNum(s.pts)} pt de TRS par jour, toutes causes).`, owner, due_date: due, due_date_initial: due, priority: s.over ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Performance", kpi_id: kpi?.id || null, finding: `Micro-arrêts · ${s.top.c}`, created_at: now(), updated_at: now() }); })) return;
    if (typeof idSetMe === "function") idSetMe(owner);
    modalDirty = false; closeModal(); render(); toast(`Action ${aid} créée.`);
  };
}

function mlPrint() {
  const l = mlCur(); if (!l) return;
  const cols = 8, blank = (n) => "<td></td>".repeat(n);
  modal("Feuille de poste à imprimer", `<article class="pv-sheet ml-sheet"><header><div><small>Feuille de poste · ${esc(getSiteName(l.site_id))}</small><h3>${esc(l.name)}</h3></div><p>Date : ……………… Équipe : ……………… Chef d’équipe : ………………</p></header>
    <table class="ml-tally ts-sheet-top"><tbody><tr><th>Durée du poste</th><td>${l.shift_min ? `${smNum(+l.shift_min)} min` : "……… min"}</td><th>Arrêts planifiés (pauses, TOP 5, nettoyage prévu)</th><td>……… min</td><th>Cadence théorique</th><td>${+l.rate_ph ? `${smNum(+l.rate_ph)} pièces/h` : "……… pièces/h"}</td></tr></tbody></table>
    <h4>Arrêts de plus de ${smNum(Number(l.threshold_min) || 5)} min</h4>
    <table class="ml-tally"><thead><tr><th>Début</th><th>Fin</th><th>Minutes</th><th>Nature (panne, changement, réglage, manque…)</th><th>Détail</th></tr></thead><tbody>${`<tr>${blank(5)}</tr>`.repeat(5)}</tbody></table>
    <h4>Micro-arrêts · un bâton par arrêt de moins de ${smNum(Number(l.threshold_min) || 5)} min</h4>
    <table class="ml-tally"><thead><tr><th>Cause</th>${Array.from({ length: cols }, (_, i) => `<th>Heure ${i + 1}<br><small>……h</small></th>`).join("")}<th>Total</th></tr></thead><tbody>${mlCauses(l).map((c) => `<tr><th>${esc(c)}</th>${blank(cols + 1)}</tr>`).join("")}</tbody></table>
    <table class="ml-tally ts-sheet-top"><tbody><tr><th>Pièces bonnes</th><td></td><th>Rebuts, retouches</th><td></td><th>Visa</th><td></td></tr></tbody></table>
    <footer>À saisir dans l’application en fin de poste (Observer › TRS › Saisir une feuille de poste) : le TRS se calcule et part au pilotage.</footer></article>
    <style media="print">@page{size:A4 portrait;margin:8mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
}

/* ---------- Branchements ---------- */

function mlGo(lineId = null) { if (lineId) mlLineSel = lineId; state.terrainTab = "micro"; switchView("terrain"); }
const mlRenderTerrainBase = renderTerrain;
renderTerrain = function () {
  if (state.terrainTab !== "micro") return mlRenderTerrainBase.apply(this, arguments);
  if (!mlCan()) { state.terrainTab = "gemba"; return mlRenderTerrainBase.apply(this, arguments); }
  return mlPage();
};
const mlTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = mlTabsBase(stage);
  if (stage?.id !== "observer" || !mlCan() || out.some((t) => t.key === "micro") || !out.some((t) => t.view === "terrain")) return out;
  const after = ["tpm", "5s", "gemba"].map((k) => out.findIndex((t) => t.key === k)).find((i) => i >= 0);
  out.splice(after >= 0 ? after + 1 : out.length, 0, { key: "micro", label: "TRS", view: "terrain", set: { terrainTab: "micro" } });
  return out;
};
const mlWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = mlWatchBase();
  if (!mlCan() || state.role === "dg") return base;
  const over = mlLines().map((l) => ({ l, s: mlSum(l) })).filter((x) => x.s.over).slice(0, 3);
  if (!over.length) return base;
  const rows = over.map(({ l, s }) => `<button type="button" class="jn-row" data-ml-go="${esc(l.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">Micro-arrêts</span><b>${esc(l.name)} · ${mlFmt(s.min)} perdues aujourd’hui</b><span class="hint">Objectif ${smNum(Number(l.target_min))} min${s.top ? ` · surtout ${esc(s.top.c.toLowerCase())}` : ""}</span></span></button>`).join("");
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows}`);
};
/* Le C du TOP 5 : les micro-arrêts du jour, à dire au point. */
const mlSjBase = sjPanel;
sjPanel = function () {
  const out = mlSjBase.apply(this, arguments);
  if (!out) return out;
  const ls = (data.mlLines || []).filter((l) => !l.archived_at && l.site_id === state.site && (!sjWs() || !l.workshop_id || l.workshop_id === sjWs()));
  if (!ls.length) return out;
  const tot = ls.reduce((a, l) => { const s = mlSum(l); return { n: a.n + s.n, min: a.min + s.min, over: a.over || s.over }; }, { n: 0, min: 0, over: false });
  const i = out.indexOf('data-sj-tile="C"'), j = i >= 0 ? out.indexOf("</div>", i) : -1;
  if (j < 0) return out;
  const days = [today(), auAddDays(-1), auAddDays(-2), auAddDays(-3)], k = typeof osKpi === "function" ? osKpi("trs") : null;
  const ids = new Set(ls.map((l) => l.id)), lastDay = typeof tsAgg === "function" ? days.find((d) => (data.trsShifts || []).some((s) => ids.has(s.line_id) && s.date === d)) : null;
  const t = lastDay ? tsAgg((data.trsShifts || []).filter((s) => ids.has(s.line_id) && s.date === lastDay)) : null, low = t && k?.target != null && t.trs * 100 < k.target;
  const line = `${t ? `<button type="button" class="ml-sj ${low ? "over" : ""}" data-ml-go="${esc(ls[0].id)}">TRS ${lastDay === today() ? "aujourd’hui" : lastDay === auAddDays(-1) ? "hier" : `du ${shortDate(lastDay)}`} : <b>${tsPct(t.trs)}</b> · D ${tsPct(t.d)} · P ${tsPct(t.p)} · Q ${tsPct(t.q)}</button>` : ""}${tot.n ? `<button type="button" class="ml-sj ${tot.over ? "over" : ""}" data-ml-go="${esc(ls[0].id)}">Micro-arrêts aujourd’hui : <b>${tot.n}</b> · ${mlFmt(tot.min)}${tot.over ? " · au-dessus de l’objectif" : ""}</button>` : ""}`;
  if (!line) return out;
  return out.slice(0, j + 6) + line + out.slice(j + 6);
};
const mlCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  mlCreateMenuBase.apply(this, arguments);
  if (!mlCan() || role().readonly || !mlLines().some((l) => mlWritable(l.site_id))) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const html = '<button class="create-choice ml-choice" type="button" data-ts-new><span aria-hidden="true"><b>FP</b></span><b>Feuille de poste</b><small>Arrêts, micro-arrêts, pièces : le TRS du poste</small></button><button class="create-choice ml-choice" type="button" data-ml-go><span aria-hidden="true"><b>MA</b></span><b>Micro-arrêt</b><small>Compter un petit arrêt de ligne, d’un geste</small></button>';
  const note = menu.querySelector(".cp-note-choice");
  if (note) note.insertAdjacentHTML("beforebegin", html); else menu.insertAdjacentHTML("beforeend", html);
  mlBind(menu);
  menu.querySelectorAll("[data-ts-new]").forEach((x) => (x.onclick = () => { const l = mlCur(); closeModal(); if (l && typeof tsForm === "function") tsForm(l.id); }));
};

function mlBind(root = document) {
  root.querySelectorAll("[data-ml-go]").forEach((b) => (b.onclick = () => { if (b.closest("#modal")) closeModal(); mlGo(b.dataset.mlGo || null); }));
  root.querySelectorAll("[data-ml-newline]").forEach((b) => (b.onclick = () => mlLineForm()));
  root.querySelectorAll("[data-ml-edit]").forEach((b) => (b.onclick = () => mlLineForm(b.dataset.mlEdit)));
  root.querySelectorAll("[data-ml-print]").forEach((b) => (b.onclick = mlPrint));
  root.querySelectorAll("[data-ml-line]").forEach((b) => (b.onclick = () => { mlLineSel = b.dataset.mlLine; render(); }));
  root.querySelectorAll("[data-ml-days]").forEach((b) => (b.onclick = () => { mlPeriod = Number(b.dataset.mlDays) || 7; render(); }));
  const box = root.querySelector?.(".ml-counter");
  if (!box) return;
  const l = mlLine(box.dataset.mlId);
  if (!l) return;
  root.querySelectorAll("[data-ml-run]").forEach((b) => (b.onclick = () => { mlSetRun(l.id, Date.now()); render(); }));
  root.querySelectorAll("[data-ml-cancelrun]").forEach((b) => (b.onclick = () => { mlSetRun(l.id, null); render(); }));
  root.querySelectorAll("[data-ml-cause]").forEach((b) => (b.onclick = () => {
    if (!mlWritable(l.site_id)) return;
    const c = b.dataset.mlCause, run = mlRun(l.id);
    if (run) {
      const dur = (Date.now() - run) / 1000;
      if (dur > (Number(l.threshold_min) || 5) * 60) return mlTooLong(l, c, dur, run);
      if (!mlAdd(l, c, dur, run)) return;
      mlSetRun(l.id, null); render(); toast(`Arrêt de ${mlClock(dur)} · ${c}.`);
      return;
    }
    if (!mlAdd(l, c)) return;
    render(); toast(`+1 · ${c}`);
  }));
  root.querySelectorAll("[data-ml-undo]").forEach((b) => (b.onclick = () => {
    const last = mlStops(l.id)[0]; // le dernier saisi : les saisies sont ajoutées en tête
    if (!last) return;
    if (!commitData(() => { data.microStops = data.microStops.filter((s) => s.id !== last.id); })) return;
    render(); toast(`Annulé : ${last.cause}.`);
  }));
  root.querySelectorAll("[data-ml-top15]").forEach((b) => (b.onclick = () => mlTop15(l)));
  root.querySelectorAll("[data-ml-action]").forEach((b) => (b.onclick = () => mlAction(l)));
  clearInterval(window.mlTimerInt);
  const el = root.querySelector(".ml-elapsed");
  if (el) window.mlTimerInt = setInterval(() => {
    const e = document.querySelector(".ml-elapsed");
    if (!e) return clearInterval(window.mlTimerInt);
    const sec = (Date.now() - Number(e.dataset.mlStart)) / 1000;
    e.textContent = mlClock(sec);
    e.classList.toggle("over", sec > Number(e.dataset.mlLimit));
  }, 1000);
}
const mlOsBindBase = osBind;
osBind = function () { const out = mlOsBindBase.apply(this, arguments); mlBind(document); return out; };
