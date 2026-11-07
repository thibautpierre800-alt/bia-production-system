"use strict";
/*
 * BIA Lean OS 8.25 · Chantiers : une charte d'une page, des étapes, un point par semaine, un gain mesuré et tenu.
 *  - Charte : le problème chiffré, le périmètre, l'indicateur (référence, cible, unité), l'équipe, le sponsor, la date.
 *  - Avancement : six étapes adaptées à la méthode (SMED, VSM, TPM, DMAIC…), cochées au fil de l'eau ; l'avancement
 *    et l'étape se calculent tout seuls. Point de la semaine : dans les temps, risque ou bloqué, avec un mot.
 *    Les outils du chantier sont reliés : étude SMED, équilibrage, VSM, dossier de résolution, actions.
 *  - Résultat : les mesures dans le temps face à la référence et à la cible ; gain validé par un responsable ;
 *    tenue à 30, 60 et 90 jours ; clôture seulement quand le gain est validé et les actions closes.
 *  - Portefeuille : la météo de chaque chantier, son étape, son indicateur, les chantiers sans point depuis 7 jours.
 *  - Le formulaire complet reste accessible.
 * Données : projects[] (indexée) : champs ajoutés charter{ problem, scope, team, sponsor }, kpi{ label, unit, base,
 *   target }, steps_done{ clé: date }, weather[{ at, s: "ok"|"risk"|"block", note, by }], measures[{ date, value, by }],
 *   verified{ by, at, text }, closed_at ; status, progress, baseline, target et result restent tenus à jour.
 */

const CD_KEYS = ["cadrer", "mesurer", "analyser", "essayer", "standardiser", "tenir"];
const CD_STATUS = ["Cadrage", "Mesure", "Analyse", "Essai", "Déploiement", "Déploiement"];
const CD_LABELS = {
  generic: ["Cadrer le chantier", "Mesurer l’état initial", "Analyser les causes", "Essayer les solutions", "Standardiser", "Vérifier la tenue"],
  SMED: ["Cadrer", "Filmer et chronométrer", "Séparer interne et externe", "Externaliser et simplifier", "Standard de changement", "Vérifier la tenue"],
  VSM: ["Choisir la famille", "Cartographier l’état actuel", "Dessiner l’état futur", "Mener les chantiers du futur", "Standardiser le flux", "Vérifier la tenue"],
  TPM: ["Cadrer", "Mesurer pannes et pertes", "Analyser les causes", "Remettre en état, standard CIL", "Standard de maintenance", "Vérifier la tenue"],
  DMAIC: ["Définir", "Mesurer", "Analyser", "Améliorer", "Contrôler", "Vérifier la tenue"],
};
const CD_METHODS = ["SMED", "VSM", "TPM", "DMAIC", "Kaizen", "PDCA", "Industrialisation"];
const CD_W = [["ok", "Dans les temps"], ["risk", "Risque"], ["block", "Bloqué"]];

function cdCanView() { return role().nav.includes("projects"); }
function cdGet(id) { return (data.projects || []).find((p) => p.id === id && !p.archived_at); }
function cdCan(p) { return !!p && !role().readonly && allowedSite(p.site_id, true) && osWritable(p.site_id); }
function cdLabels(p) { return CD_LABELS[p.method] || CD_LABELS.generic; }
function cdDone(p) {
  if (p.steps_done) return p.steps_done;
  const i = { Mesure: 1, Analyse: 2, Essai: 3, "Déploiement": 4, Clos: 6 }[p.status] || 0, d = String(p.created_at || today()).slice(0, 10);
  return Object.fromEntries(CD_KEYS.slice(0, i).map((k) => [k, d]));
}
function cdIdx(p) { const d = cdDone(p), i = CD_KEYS.findIndex((k) => !d[k]); return i < 0 ? CD_KEYS.length : i; }
function cdProgress(p) { return Math.round((CD_KEYS.filter((k) => cdDone(p)[k]).length / CD_KEYS.length) * 100); }
function cdWeather(p) { return (p.weather || []).slice(-1)[0] || null; }
function cdStale(p) { const w = cdWeather(p), t = Date.parse(w?.at || p.created_at || ""); return p.status !== "Clos" && Number.isFinite(t) && Date.now() - t > 7 * 864e5; }
function cdKpi(p) { const k = p.kpi || {}; return bpHas(k.base) && bpHas(k.target) ? k : null; }
function cdLow(k) { return Number(k.target) < Number(k.base); }
function cdHit(k, v) { return bpHas(v) && (cdLow(k) ? Number(v) <= Number(k.target) : Number(v) >= Number(k.target)); }
function cdMeasures(p) { return (p.measures || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); }
function cdLast(p) { return cdMeasures(p).slice(-1)[0] || null; }
function cdFmt(k, v) { return `${bpNum(v)}${k.unit ? ` ${k.unit}` : ""}`; }
function cdLine(p) {
  const k = cdKpi(p), last = cdLast(p);
  if (!k) return p.baseline || p.target ? `${p.baseline || "Référence à mesurer"} → ${p.target || "cible à définir"}` : "";
  return `${k.label ? `${k.label} : ` : ""}${cdFmt(k, k.base)}${last ? ` → ${cdFmt(k, last.value)}` : ""} · cible ${cdFmt(k, k.target)}`;
}
function cdSync(p) {
  p.progress = cdProgress(p);
  if (p.status !== "Clos") p.status = cdWeather(p)?.s === "block" ? "Bloqué" : CD_STATUS[Math.min(cdIdx(p), CD_STATUS.length - 1)];
  const k = cdKpi(p);
  if (k) { p.baseline = `${k.label ? `${k.label} : ` : ""}${cdFmt(k, k.base)}`; p.target = cdFmt(k, k.target); }
  if (p.verified) p.result = p.verified.text;
}
function cdSave(id, fn, note) { const ok = commitData(() => { const p = data.projects.find((x) => x.id === id); if (!p.steps_done) p.steps_done = { ...cdDone(p) }; fn(p); cdSync(p); p.updated_at = now(); if (note) recordHistory(p, p.status, note); }); if (ok) modalDirty = false; return ok; }
function cdWeatherTag(p) { const w = cdWeather(p); return w ? `<span class="cd-w w-${w.s}">${esc(CD_W.find((x) => x[0] === w.s)[1])}</span>` : '<span class="cd-w w-none">Pas encore de point</span>'; }

/* ---------- Portefeuille ---------- */

function cdCard(p) {
  const i = cdIdx(p), labels = cdLabels(p), late = p.status !== "Clos" && p.target_date && p.target_date < today(), stale = cdStale(p), line = cdLine(p), study = (data.smed || []).find((s) => s.project_id === p.id && !s.archived_at);
  return `<article class="cd-card ${p.status === "Bloqué" ? "block" : cdWeather(p)?.s === "risk" ? "risk" : ""}"><div class="id-top"><span class="cd-m">${esc(p.method || "Chantier")}</span>${cdWeatherTag(p)}<span class="hint">${esc(p.id)} · ${esc(getSiteName(p.site_id))}</span></div>
    <b class="cd-title">${esc(p.title)}</b><span class="hint">${esc(p.owner || "Pilote à désigner")}${p.target_date ? ` · ${late ? "en retard : cible le" : "cible le"} ${shortDate(p.target_date)}` : ""}</span>
    <div class="cd-steps" aria-label="Étape ${Math.min(i + 1, 6)} sur 6">${CD_KEYS.map((k, j) => `<i class="${cdDone(p)[k] ? "done" : j === i ? "now" : ""}"></i>`).join("")}</div>
    <p class="cd-step">${p.status === "Clos" ? "Chantier clos" : i >= CD_KEYS.length ? "Toutes les étapes sont faites" : `Étape ${i + 1} sur 6 · ${esc(labels[i])}`}</p>
    ${line ? `<p class="cd-kpi ${cdKpi(p) && cdLast(p) && cdHit(cdKpi(p), cdLast(p).value) ? "hit" : ""}">${esc(line)}</p>` : ""}
    ${stale ? `<p class="cd-stale">Pas de point depuis ${sgDur(Date.now() - Date.parse(cdWeather(p)?.at || p.created_at))}</p>` : cdWeather(p)?.note ? `<p class="hint cd-note">« ${esc(cdWeather(p).note)} »</p>` : ""}
    <div class="id-acts"><button type="button" class="btn small" data-cd-open="${esc(p.id)}">Ouvrir</button>${study ? `<button type="button" class="btn small ghost" data-sm-project="${esc(p.id)}">Étude ${esc(study.id)}</button>` : p.method === "SMED" && typeof smCan === "function" && smCan() && cdCan(p) ? `<button type="button" class="btn small ghost" data-sm-project="${esc(p.id)}">Chronométrer en SMED</button>` : ""}</div></article>`;
}
function cdPage() {
  const rows = scoped(data.projects || []).filter((p) => !p.archived_at), open = rows.filter((p) => p.status !== "Clos"), closed = rows.filter((p) => p.status === "Clos");
  const canNew = !role().readonly && OPERATIONAL_SITES.some((s) => osWritable(s.id) && allowedSite(s.id, true));
  const head = pageHead("Résoudre", "Chantiers", "Chaque chantier part d’un problème chiffré, avance par étapes et ne déclare un gain qu’une fois mesuré et tenu.", canNew ? '<button type="button" class="btn" data-cd-new>Nouveau chantier</button>' : "");
  const risk = open.filter((p) => p.status === "Bloqué" || cdWeather(p)?.s === "risk").length, stale = open.filter(cdStale).length, gains = rows.filter((p) => p.verified).length;
  const strip = `<div class="cs-summary"><div><b>${open.length}</b><span>en cours</span></div><div class="${risk ? "bad" : ""}"><b>${risk}</b><span>à risque ou bloqué${risk > 1 ? "s" : ""}</span></div><div class="${stale ? "bad" : ""}"><b>${stale}</b><span>sans point depuis 7 jours</span></div><div><b>${gains}</b><span>gain${gains > 1 ? "s" : ""} validé${gains > 1 ? "s" : ""}</span></div></div>`;
  const order = (a, b) => (b.status === "Bloqué") - (a.status === "Bloqué") || (cdWeather(b)?.s === "risk") - (cdWeather(a)?.s === "risk") || String(a.target_date || "9").localeCompare(String(b.target_date || "9"));
  if (!rows.length) return `${head}<section class="cs-empty"><h2>Le premier chantier</h2><p>Un problème chiffré, un indicateur avec sa référence et sa cible, un pilote et une date. Le chantier avance par étapes, avec un point chaque semaine.</p>${canNew ? '<button type="button" class="btn" data-cd-new>Nouveau chantier</button>' : ""}</section>`;
  return `${head}${strip}<div class="cd-list">${open.sort(order).map(cdCard).join("") || '<p class="hint">Aucun chantier en cours.</p>'}</div>${closed.length ? `<details class="ik-out section"><summary>Chantiers clos · ${closed.length}</summary><div class="cd-list">${closed.map(cdCard).join("")}</div></details>` : ""}`;
}

/* ---------- Nouveau chantier ---------- */

function cdNew(preset = {}) {
  const sites = OPERATIONAL_SITES.filter((s) => osWritable(s.id) && allowedSite(s.id, true));
  if (!sites.length || role().readonly) return toast("Votre profil ne permet pas de créer un chantier ici.");
  let siteId = preset.site_id && sites.some((s) => s.id === preset.site_id) ? preset.site_id : state.site !== "group" && sites.some((s) => s.id === state.site) ? state.site : sites[0].id, method = CD_METHODS.includes(preset.method) ? preset.method : "Kaizen";
  modal("Nouveau chantier", `<form id="cdNewForm" class="jn-form"><p class="jn-lead">Un problème chiffré, un indicateur, un pilote et une date. Le reste se complète en avançant.</p>
    <label class="field">Le chantier, en une phrase<input id="cdTitle" required value="${esc(preset.title || "")}" placeholder="Ex. Réduire le changement de série sur la plaqueuse" autocomplete="off"></label>
    <div class="ap-field"><span class="metric-label">Méthode</span><div class="filters">${CD_METHODS.map((m) => `<button type="button" class="chip ${m === method ? "active" : ""}" data-cd-m="${m}" aria-pressed="${m === method}">${m}</button>`).join("")}</div></div>
    <fieldset class="bp-res-box"><legend>L’indicateur à faire bouger</legend><div class="bp-res-grid"><label>Indicateur<input id="cdKLabel" placeholder="Ex. Durée du changement" autocomplete="off"></label><label>Aujourd’hui<input id="cdKBase" inputmode="decimal" autocomplete="off"></label><label>Cible<input id="cdKTarget" inputmode="decimal" autocomplete="off"></label><label>Unité<input id="cdKUnit" placeholder="min" autocomplete="off"></label></div></fieldset>
    <div class="bp-two"><label class="field">Pilote<input id="cdOwner" list="ownerList" required value="${esc(preset.owner || apMe() || "")}">${ownerDatalist()}</label><label class="field">Date cible<input id="cdDate" type="date" min="${today()}" value="${esc(preset.target_date || auAddDays(60))}"></label></div>
    ${sites.length > 1 ? `<label class="field">Site<select id="cdSite">${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <div class="form-actions"><button class="btn jn-big">Créer le chantier</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("cdNewForm");
  root.querySelectorAll("[data-cd-m]").forEach((b) => (b.onclick = () => { method = b.dataset.cdM; root.querySelectorAll("[data-cd-m]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  if ($("cdSite")) $("cdSite").onchange = () => { siteId = $("cdSite").value; };
  setTimeout(() => $("cdTitle")?.focus(), 0);
  root.onsubmit = (e) => {
    e.preventDefault();
    const title = $("cdTitle").value.trim(), owner = $("cdOwner").value.trim(), base = bpParse($("cdKBase").value), target = bpParse($("cdKTarget").value);
    if (!title) { $("cdTitle").focus(); return toast("Le chantier, en une phrase."); }
    if (!owner) { $("cdOwner").focus(); return toast("Qui pilote le chantier ?"); }
    if (Number.isNaN(base) || Number.isNaN(target)) return toast("Indicateur : des nombres, par exemple 52.");
    let pid = null;
    if (!commitData(() => {
      data.projects ||= [];
      pid = nextId("CH", data.projects);
      const p = { id: pid, site_id: siteId, title, method, status: "Cadrage", owner, progress: 0, target_date: $("cdDate").value || null, baseline: "À mesurer", target: "À définir", result: "Non vérifié", problem_id: preset.problem_id || null, action_ids: [], objective_id: preset.objective_id || null, kpi_id: preset.kpi_id || null, charter: { problem: "", scope: "", team: "", sponsor: "" }, kpi: { label: $("cdKLabel").value.trim(), unit: $("cdKUnit").value.trim(), base, target }, steps_done: {}, weather: [], measures: [], created_at: now(), updated_at: now() };
      cdSync(p);
      recordHistory(p, p.status, "Chantier créé");
      data.projects.unshift(p);
    })) return;
    if (typeof idSetMe === "function") idSetMe(owner);
    modalDirty = false; render(); cdOpen(pid, "charte"); toast(`${pid} créé : complétez la charte, puis cochez les étapes.`);
  };
}

/* ---------- Le chantier ---------- */

function cdTrend(p) {
  const k = cdKpi(p), rows = cdMeasures(p).slice(-8);
  if (!k) return "";
  const max = Math.max(Number(k.base), Number(k.target), ...rows.map((r) => Number(r.value))) || 1, pct = (v) => ((Number(v) / max) * 100).toFixed(2), tgt = `<i class="sm-tgt" style="left:${pct(k.target)}%"></i>`;
  const row = (label, v, cls) => `<div class="sm-g-row"><span class="sm-g-l">${label}</span><div class="sm-g-track"><div class="sm-g-in">${tgt}<span class="sm-tbar ${cls}" style="width:${pct(v)}%"></span><b class="sm-g-t" style="left:${pct(v)}%">${esc(cdFmt(k, v))}</b></div></div></div>`;
  return `<figure class="sm-trend" role="img" aria-label="${esc(k.label || "Indicateur")} : référence ${esc(cdFmt(k, k.base))}${rows.map((r) => `, ${esc(cdFmt(k, r.value))} le ${shortDate(r.date)}`).join("")} ; cible ${esc(cdFmt(k, k.target))}"><div class="sm-g">${row("Référence", k.base, "ref")}${rows.map((r) => row(new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), r.value, cdHit(k, r.value) ? "ok" : "warn")).join("")}</div>
    <figcaption><span><i class="tgt"></i>Cible ${esc(cdFmt(k, k.target))}</span><span><i class="ok"></i>Cible tenue</span><span><i class="warn"></i>Pas encore</span></figcaption></figure>`;
}
function cdCharter(p, w) {
  const c = p.charter || {}, k = p.kpi || {};
  if (!w) return `<dl class="id-dl bp-dl">${[["Le problème", c.problem], ["Périmètre", c.scope], ["Indicateur", cdLine(p)], ["Équipe", c.team], ["Sponsor", c.sponsor], ["Date cible", p.target_date ? shortDate(p.target_date) : ""]].filter(([, v]) => String(v || "").trim()).map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("") || "<div><dd>Charte à compléter.</dd></div>"}</dl>`;
  return `<div class="bp-form">
    <label class="field">Le chantier, en une phrase<input data-cd-f="title" value="${esc(p.title || "")}"></label>
    <div class="ap-field"><span class="metric-label">Méthode</span><div class="filters">${CD_METHODS.map((m) => `<button type="button" class="chip ${m === p.method ? "active" : ""}" data-cd-method="${m}" aria-pressed="${m === p.method}">${m}</button>`).join("")}</div></div>
    <label class="field">Le problème, chiffré<textarea data-cd-c="problem" rows="2" placeholder="Ex. 52 min par changement, 6 changements par semaine : 5 h de production perdues">${esc(c.problem || "")}</textarea></label>
    <label class="field">Périmètre : ce qui est dedans, ce qui ne l’est pas<textarea data-cd-c="scope" rows="2" placeholder="Ex. plaqueuse P1, familles panneaux ; hors réglage colle">${esc(c.scope || "")}</textarea></label>
    <fieldset class="bp-res-box"><legend>L’indicateur à faire bouger</legend><div class="bp-res-grid"><label>Indicateur<input data-cd-k="label" value="${esc(k.label || "")}" placeholder="Ex. Durée du changement"></label><label>Référence<input data-cd-kn="base" inputmode="decimal" value="${esc(bpNum(k.base))}"></label><label>Cible<input data-cd-kn="target" inputmode="decimal" value="${esc(bpNum(k.target))}"></label><label>Unité<input data-cd-k="unit" value="${esc(k.unit || "")}" placeholder="min, %, €"></label></div><p class="bp-res cd-kline" ${cdKpi(p) ? "" : "hidden"}>${esc(cdLine(p))}</p></fieldset>
    <div class="bp-two"><label class="field">Pilote<input data-cd-f="owner" list="ownerList" value="${esc(p.owner || "")}">${ownerDatalist()}</label><label class="field">Sponsor<input data-cd-c="sponsor" list="ownerList" value="${esc(c.sponsor || "")}" placeholder="Qui arbitre et débloque"></label></div>
    <div class="bp-two"><label class="field">Équipe<input data-cd-c="team" value="${esc(c.team || "")}" placeholder="Noms, séparés par des virgules"></label><label class="field">Date cible<input data-cd-f="target_date" type="date" value="${esc(p.target_date || "")}"></label></div></div>`;
}
function cdProgressBody(p, w) {
  const labels = cdLabels(p), i = cdIdx(p), wx = cdWeather(p), hist = (p.weather || []).slice(-5).reverse();
  const tools = [];
  const study = (data.smed || []).find((s) => s.project_id === p.id && !s.archived_at);
  if (typeof smCan === "function" && smCan() && (study || p.method === "SMED")) tools.push(`<button type="button" class="lib-go-btn" data-sm-project="${esc(p.id)}"><b>${study ? `Étude SMED ${esc(study.id)}` : "Chronométrer en SMED"}</b><span>Chrono, interne et externe, gain mesuré</span></button>`);
  const bal = (data.balances || []).filter((b) => b.project_id === p.id && !b.archived_at);
  bal.forEach((b) => tools.push(`<button type="button" class="lib-go-btn" data-cd-eq="${esc(b.id)}"><b>Équilibrage ${esc(b.id)}</b><span>${esc(b.title)}</span></button>`));
  if (w && typeof eqCan === "function" && eqCan() && !bal.length) tools.push(`<button type="button" class="lib-go-btn" data-cd-neweq><b>Équilibrer la ligne</b><span>Temps par poste face au takt</span></button>`);
  const vsm = p.source_id && (data.documents || []).find((d) => d.id === p.source_id && d.type === "VSM");
  if (vsm) tools.push(`<button type="button" class="lib-go-btn" data-cd-doc="${esc(vsm.id)}"><b>VSM ${esc(vsm.id)}</b><span>${esc(vsm.title)}</span></button>`);
  if (p.problem_id) tools.push(`<button type="button" class="lib-go-btn" data-open-record="${esc(p.problem_id)}"><b>Dossier ${esc(p.problem_id)}</b><span>Résolution de problème</span></button>`);
  const acts = linkedActions(p.id);
  return `<section class="cd-weather"><h3>Point de la semaine</h3>${wx ? `<p class="hint">Dernier point : ${cdWeatherTag(p)} le ${shortDate(wx.at)}${wx.by ? ` par ${esc(wx.by)}` : ""}${wx.note ? ` · « ${esc(wx.note)} »` : ""}</p>` : '<p class="hint">Aucun point pour l’instant.</p>'}
      ${w ? `<form class="cd-wform" data-cd-wform><div class="rl-st">${CD_W.map(([k, l]) => `<button type="button" class="rl-sb sb-${k === "ok" ? "ok" : k === "risk" ? "watch" : "ko"}" data-cd-w="${k}" aria-pressed="false">${l}</button>`).join("")}</div><input id="cdWNote" placeholder="En une phrase : où en est-on, qu’est-ce qui bloque ?" aria-label="Point de la semaine"><button class="btn secondary">Enregistrer le point</button></form>` : ""}
      ${hist.length > 1 ? `<details class="ik-out"><summary>Points précédents</summary><ul class="cd-hist">${hist.slice(1).map((x) => `<li><span class="cd-w w-${x.s}">${esc(CD_W.find((y) => y[0] === x.s)[1])}</span> ${shortDate(x.at)}${x.note ? ` · ${esc(x.note)}` : ""}</li>`).join("")}</ul></details>` : ""}</section>
    <section><h3>Les étapes · ${p.method || "chantier"}</h3><ol class="cd-steplist">${CD_KEYS.map((k, j) => { const d = cdDone(p)[k]; return `<li class="${d ? "done" : j === i ? "now" : ""}"><button type="button" class="cd-stepbtn" data-cd-step="${k}" ${w ? "" : "disabled"} aria-pressed="${!!d}"><span class="cd-dot">${d ? "✓" : j + 1}</span><span><b>${esc(labels[j])}</b><small>${d ? `Fait le ${shortDate(d)}` : j === i ? "Étape en cours" : "À venir"}</small></span></button></li>`; }).join("")}</ol></section>
    ${tools.length ? `<section><h3>Les outils du chantier</h3><div class="lib-go-list">${tools.join("")}</div></section>` : ""}
    <section><h3>Actions · ${acts.filter(isOpenAction).length} ouverte${acts.filter(isOpenAction).length > 1 ? "s" : ""}</h3>${acts.length ? `<ul class="rl-links">${acts.map((a) => `<li><button type="button" class="md-link" data-open-record="${esc(a.id)}">${esc(a.id)}</button> ${esc(a.title)} <small>· ${esc(a.owner || "")} · ${esc(a.status)}${a.due_date ? ` · ${shortDate(a.due_date)}` : ""}</small></li>`).join("")}</ul>` : '<p class="hint">Aucune action liée.</p>'}${w ? '<button type="button" class="btn ghost small" data-cd-action>Ajouter une action</button>' : ""}</section>`;
}
function cdResultBody(p, w) {
  const k = cdKpi(p), last = cdLast(p), open = linkedActions(p.id).filter(isOpenAction);
  if (!k) return `<p class="hint">Définissez l’indicateur (référence et cible) dans la charte pour suivre le résultat.</p>${p.result && p.result !== "Non vérifié" ? `<p>${esc(p.result)}</p>` : ""}`;
  const sustain = p.verified ? [30, 60, 90].map((n) => { const due = new Date(Date.parse(p.verified.at) + n * 864e5).toISOString().slice(0, 10), m = cdMeasures(p).find((x) => x.date >= due); return `<li class="${m ? (cdHit(k, m.value) ? "ok" : "ko") : due <= today() ? "late" : ""}"><b>J+${n}</b><span>${m ? `${cdFmt(k, m.value)} le ${shortDate(m.date)}` : due <= today() ? `Mesure attendue depuis le ${shortDate(due)}` : `Mesure le ${shortDate(due)}`}</span></li>`; }).join("") : "";
  return `${cdTrend(p)}
    ${w ? `<form class="cd-mform" data-cd-mform><label>Date<input type="date" id="cdMDate" max="${today()}" value="${today()}"></label><label>${esc(k.label || "Valeur")}${k.unit ? ` (${esc(k.unit)})` : ""}<input id="cdMVal" inputmode="decimal" required></label><button class="btn secondary">Ajouter la mesure</button></form>` : ""}
    ${p.verified ? `<p class="bp-ok">Gain validé par ${esc(p.verified.by)} le ${shortDate(p.verified.at)} : ${esc(p.verified.text)}</p><section><h3>La tenue du résultat</h3><ul class="cd-sustain">${sustain}</ul></section>`
      : last ? (w && osManager() ? `<div class="bp-status"><p>${cdHit(k, last.value) ? "La dernière mesure tient la cible." : "La dernière mesure n’atteint pas encore la cible."}</p><div class="bp-pub"><label class="field">Validé par<input id="cdVBy" list="ownerList" value="${esc(apMe() || osActor())}">${ownerDatalist()}</label><button type="button" class="btn" data-cd-verify>Valider le gain</button></div></div>` : "") : '<p class="hint">Ajoutez une première mesure après les essais.</p>'}
    ${w && p.status !== "Clos" ? `<div class="sm-tools">${p.verified && !open.length && cdDone(p).standardiser ? '<button type="button" class="btn" data-cd-close>Clore le chantier</button>' : `<p class="hint">Clôture possible une fois le gain validé, l’étape « ${esc(cdLabels(p)[4])} » faite${open.length ? ` et les ${open.length} action(s) ouvertes closes` : " et les actions closes"}.</p>`}</div>` : p.status === "Clos" ? `<p class="bp-ok">Chantier clos le ${shortDate(p.closed_at || p.updated_at)}.</p>` : ""}`;
}
function cdOpen(id, tab = null) {
  const p = cdGet(id);
  if (!p || !allowedSite(p.site_id)) return;
  const w = cdCan(p);
  tab ||= cdIdx(p) === 0 && !(p.charter?.problem) ? "charte" : "avancement";
  const tabs = [["charte", "1. Charte"], ["avancement", "2. Avancement"], ["resultat", "3. Résultat"]];
  modal("Chantier", `<div class="sm-study cd-study" data-cd-id="${esc(p.id)}"><p class="jn-where">${esc(p.id)} · ${esc(getSiteName(p.site_id))} · ${esc(p.method || "")} ${cdWeatherTag(p)}</p><h3 class="cd-h">${esc(p.title)}</h3>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-cd-tab="${k}">${l}</button>`).join("")}</div>
    <div class="sm-body">${tab === "charte" ? cdCharter(p, w) : tab === "resultat" ? cdResultBody(p, w) : cdProgressBody(p, w)}</div>
    ${w ? '<div class="sm-tools"><button type="button" class="btn ghost" data-cd-full>Formulaire complet</button></div>' : ""}</div>`);
  modalSaver = () => { uxFlush(); return true; };
  cdBind(id, tab);
}
function cdBind(id, tab) {
  const root = $("modalContent")?.querySelector(`.cd-study[data-cd-id="${id}"]`), p = cdGet(id);
  if (!root || !p) return;
  root.querySelectorAll("[data-cd-tab]").forEach((b) => (b.onclick = () => { uxFlush(); cdOpen(id, b.dataset.cdTab); }));
  root.querySelectorAll("[data-open-record]").forEach((b) => (b.onclick = () => openRecord(b.dataset.openRecord)));
  root.querySelectorAll("[data-sm-project]").forEach((b) => (b.onclick = () => smFromProject(b.dataset.smProject)));
  root.querySelectorAll("[data-cd-eq]").forEach((b) => (b.onclick = () => eqOpen(b.dataset.cdEq)));
  root.querySelectorAll("[data-cd-doc]").forEach((b) => (b.onclick = () => editDocument(b.dataset.cdDoc)));
  const full = root.querySelector("[data-cd-full]");
  if (full) full.onclick = () => { uxFlush(); projectForm(cdGet(id)); };
  if (!cdCan(p)) return;
  const box = root.querySelector(".sm-body");
  if (tab === "charte") {
    const kl = () => { const x = cdGet(id), el = box.querySelector(".cd-kline"); if (el) { el.textContent = cdLine(x); el.hidden = !cdKpi(x); } };
    box.querySelectorAll("[data-cd-f]").forEach((el) => (el.onchange = () => { const k = el.dataset.cdF, v = el.value.trim(); if (["title", "owner"].includes(k) && !v) { el.value = cdGet(id)[k] || ""; return toast("Ce champ est nécessaire."); } if (cdSave(id, (x) => { x[k] = v || null; }) && k === "title") root.querySelector(".cd-h").textContent = v; }));
    box.querySelectorAll("[data-cd-c]").forEach((el) => (el.onchange = () => cdSave(id, (x) => { x.charter ||= {}; x.charter[el.dataset.cdC] = el.value.trim(); })));
    box.querySelectorAll("[data-cd-k]").forEach((el) => (el.onchange = () => { if (cdSave(id, (x) => { x.kpi ||= {}; x.kpi[el.dataset.cdK] = el.value.trim(); })) kl(); }));
    box.querySelectorAll("[data-cd-kn]").forEach((el) => (el.onchange = () => { const v = bpParse(el.value); if (Number.isNaN(v)) return toast("Un nombre, par exemple 52."); if (cdSave(id, (x) => { x.kpi ||= {}; x.kpi[el.dataset.cdKn] = v; })) kl(); }));
    box.querySelectorAll("[data-cd-method]").forEach((b) => (b.onclick = () => { if (!cdSave(id, (x) => { x.method = b.dataset.cdMethod; })) return; box.querySelectorAll("[data-cd-method]").forEach((c) => { c.classList.toggle("active", c === b); c.setAttribute("aria-pressed", String(c === b)); }); }));
  }
  if (tab === "avancement") {
    let ws = "";
    box.querySelectorAll("[data-cd-w]").forEach((b) => (b.onclick = () => { ws = b.dataset.cdW; box.querySelectorAll("[data-cd-w]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); $("cdWNote").focus(); }));
    const wf = box.querySelector("[data-cd-wform]");
    if (wf) wf.onsubmit = (e) => {
      e.preventDefault();
      const note = $("cdWNote").value.trim(), by = apMe() || osActor();
      if (!ws) return toast("Dans les temps, risque ou bloqué ?");
      if (ws !== "ok" && !note) { $("cdWNote").focus(); return toast("Dites en une phrase ce qui coince."); }
      if (cdSave(id, (x) => { (x.weather ||= []).push({ at: now(), s: ws, note, by }); }, `Point : ${CD_W.find((y) => y[0] === ws)[1]}${note ? ` · ${note}` : ""}`)) { render(); cdOpen(id, "avancement"); toast("Point de la semaine enregistré."); }
    };
    box.querySelectorAll("[data-cd-step]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.cdStep, on = !!cdDone(cdGet(id))[k];
      if (on && !b.dataset.confirm) { b.dataset.confirm = "1"; return toast("Touchez encore une fois pour décocher l’étape."); }
      if (cdSave(id, (x) => { x.steps_done ||= {}; if (on) delete x.steps_done[k]; else x.steps_done[k] = today(); }, `${on ? "Étape rouverte" : "Étape faite"} : ${cdLabels(cdGet(id))[CD_KEYS.indexOf(k)]}`)) { render(); cdOpen(id, "avancement"); }
    }));
    const act = box.querySelector("[data-cd-action]");
    if (act) act.onclick = () => actionForm(null, { origin_type: "Chantier", origin_id: id, site_id: p.site_id, title: "", description: `Chantier ${p.id} · ${p.title}` });
    const neq = box.querySelector("[data-cd-neweq]");
    if (neq) neq.onclick = () => { eqNew(); const sel = $("eqProject"); if (sel && [...sel.options].some((o) => o.value === id)) sel.value = id; };
  }
  if (tab === "resultat") {
    const mf = box.querySelector("[data-cd-mform]");
    if (mf) mf.onsubmit = (e) => {
      e.preventDefault();
      const v = bpParse($("cdMVal").value), d = $("cdMDate").value || today();
      if (v === null || Number.isNaN(v)) return toast("Une valeur, par exemple 38.");
      if (d > today()) return toast("Une mesure se fait au plus tard aujourd’hui.");
      if (cdSave(id, (x) => { (x.measures ||= []).push({ date: d, value: v, by: apMe() || osActor() }); }, `Mesure : ${bpNum(v)}`)) cdOpen(id, "resultat");
    };
    const ver = box.querySelector("[data-cd-verify]");
    if (ver) ver.onclick = () => {
      const by = $("cdVBy").value.trim(), x = cdGet(id), k = cdKpi(x), last = cdLast(x);
      if (!by) return toast("Qui valide le gain ?");
      const text = `${k.label ? `${k.label} : ` : ""}${cdFmt(k, k.base)} → ${cdFmt(k, last.value)} le ${shortDate(last.date)}`;
      if (cdSave(id, (y) => { y.verified = { by, at: now(), text }; }, `Gain validé par ${by}`)) { render(); cdOpen(id, "resultat"); toast("Gain validé : la tenue sera vérifiée à 30, 60 et 90 jours."); }
    };
    const close = box.querySelector("[data-cd-close]");
    if (close) close.onclick = () => {
      if (linkedActions(id).some(isOpenAction)) return toast("Clôturez d’abord les actions du chantier.");
      if (!cdDone(cdGet(id)).standardiser) return toast("Standardisez avant de clore : c’est ce qui fait tenir le gain.");
      if (cdSave(id, (y) => { y.status = "Clos"; y.closed_at = now(); y.progress = 100; }, "Chantier clos")) { render(); cdOpen(id, "resultat"); toast("Chantier clos."); }
    };
  }
}

/* ---------- Branchements ---------- */

const cdRenderProjectsBase = renderProjects;
renderProjects = function () {
  if (!["smed", "equilibrage"].includes(state.projectsTab) && cdCanView()) return cdPage();
  return cdRenderProjectsBase.apply(this, arguments);
};
const cdOpenRecordBase = openRecord;
openRecord = function (id) {
  const p = cdGet(id);
  if (p && allowedSite(p.site_id) && cdCanView()) { if (!requestCloseModal()) return; return cdOpen(id); }
  return cdOpenRecordBase.apply(this, arguments);
};
const cdWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = cdWatchBase();
  if (!cdCanView() || !osManager() || role().readonly) return base;
  const me = apMe(), rows = scoped(data.projects || []).filter((p) => !p.archived_at && p.status !== "Clos" && (cdStale(p) || p.status === "Bloqué") && (!me || !p.owner || p.owner === me || osIsAdmin() || state.role === "director"));
  if (!rows.length) return base;
  const row = `<button type="button" class="jn-row" data-cd-open="${esc(rows[0].id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">Chantier</span><b>${jnPlural(rows.length, "chantier à faire avancer", "chantiers à faire avancer")}</b><span class="hint">${esc(rows[0].title)} · ${rows[0].status === "Bloqué" ? "bloqué" : "pas de point depuis 7 jours"}</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${row}$2`);
};
function cdBindGlobal(root = document) {
  root.querySelectorAll("[data-cd-new]").forEach((b) => (b.onclick = () => cdNew()));
  root.querySelectorAll("[data-cd-open]").forEach((b) => (b.onclick = () => cdOpen(b.dataset.cdOpen)));
}
const cdOsBindBase = osBind;
osBind = function () { const out = cdOsBindBase.apply(this, arguments); cdBindGlobal(document); return out; };
