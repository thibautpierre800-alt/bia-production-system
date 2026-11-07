"use strict";
/*
 * BIA Lean OS 8.29 · Écarts : chaque indicateur hors cible a une réponse, et l'écran dit quand réagir.
 *  - Une carte par indicateur hors cible : la valeur, la cible, la courbe avec la cible et les limites habituelles.
 *  - La lecture de la courbe (bruit ou signal), en une phrase :
 *      Événement (cible zéro dépassée), Rupture (relevé hors des limites habituelles), Changement de niveau
 *      (8 relevés de suite du mauvais côté de la moyenne), Dérive (5 relevés de suite, chacun moins bon),
 *      En progrès, Toujours hors cible (sans signal), Variation normale, Trop peu de relevés.
 *    Limites habituelles = moyenne ± 2,66 × écart moyen entre deux relevés (carte XmR), dès 6 relevés.
 *  - La réponse : un problème, un chantier ou une action déjà ouverts sur cet indicateur et ce site ;
 *    sinon « Sans réponse » et la réponse conseillée en premier : QRQC pour un signal, chantier pour un écart
 *    stable, surveillance datée et motivée pour une variation normale, action rapide.
 *  - Filtres : Sans réponse, Pris en charge, Tous ; par site au niveau Groupe.
 *  - Pilotage › « À creuser » et l'accueil reprennent la même lecture et le nombre d'écarts sans réponse.
 * Données : gapReviews[] (non indexée) = { id, site_id, kpi_id, measure_id, decision: "watch", reason, note, by,
 *   at, until }. Les réponses restent des problèmes, chantiers et actions ordinaires reliés par kpi_id.
 */

const EG_READ = {
  event: { tone: "gap", label: "Événement", signal: true, rec: "problem", advice: "Cible zéro : chaque cas se traite, sans attendre une tendance." },
  break: { tone: "gap", label: "Rupture", signal: true, rec: "problem", advice: "Quelque chose a changé : cherchez quoi pendant que c’est frais (QRQC, 5 pourquoi)." },
  shift: { tone: "gap", label: "Changement de niveau", signal: true, rec: "problem", advice: "Le niveau a changé : retrouvez ce qui a bougé à cette date (QRQC, 5 pourquoi)." },
  drift: { tone: "gap", label: "Dérive", signal: true, rec: "problem", advice: "Ce n’est pas le hasard : cherchez ce qui change (QRQC, 5 pourquoi)." },
  chronic: { tone: "warn", label: "Toujours hors cible", rec: "project", advice: "Pas de signal : réagir à chaque relevé ne changera rien. Il faut changer le système (chantier, A3)." },
  better: { tone: "ok", label: "En progrès", rec: "watch", advice: "Ça s’améliore : sachez pourquoi, pour le tenir." },
  noise: { tone: "none", label: "Variation normale", rec: "watch", advice: "Ce relevé reste dans la variation habituelle : pas de chasse aux causes, on surveille." },
  few: { tone: "none", label: "Trop peu de relevés", rec: "action", advice: "Il faut 5 relevés pour lire une tendance. En attendant, une action simple ou une surveillance." },
};
const EG_ORDER = ["event", "break", "shift", "drift", "chronic", "few", "noise", "better"];
const EG_REASONS = ["Variation normale", "Cause connue, déjà traitée", "Événement ponctuel expliqué", "Mesure à vérifier"];

function egAvg(v) { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }
function egTarget(m, k) { return osFinite(m?.target) ? m.target : k.target; }
function egUnit(k) { const u = typeof inUnit === "function" ? inUnit(k) : k.unit === "nombre" ? "" : k.unit || ""; return u ? ` ${u}` : ""; }

/* Lecture d'une série : signal (quelque chose a changé) ou bruit (variation habituelle). */
function egRead(rows, k) {
  const v = rows.map((r) => r.value).filter(Number.isFinite), n = v.length, high = k.direction === "high", u = egUnit(k);
  const target = egTarget(rows.at(-1), k), last = v.at(-1);
  const worse = (a, b) => (high ? b < a : b > a);
  let run = 0;
  for (let i = n - 1; i > 0 && worse(v[i - 1], v[i]); i--) run++;
  let up = 0;
  for (let i = n - 1; i > 0 && worse(v[i], v[i - 1]); i--) up++;
  const out = { n, run, up, limits: null, target };
  const make = (kind, text) => ({ ...out, kind, text, ...EG_READ[kind] });
  if (!n) return make("few", "Aucun relevé.");
  if (!high && target === 0 && last > 0) return make("event", `${osNum(last)}${u} au dernier relevé, pour une cible de zéro.`);
  if (n >= 6) {
    const base = v.slice(0, n >= 9 ? Math.min(20, n - 3) : n), mean = egAvg(base), mr = egAvg(base.slice(1).map((x, i) => Math.abs(x - base[i])));
    const hi = mean + 2.66 * mr, lo = mean - 2.66 * mr;
    out.limits = { mean, hi, lo: v.every((x) => x >= 0) ? Math.max(0, lo) : lo, base: base.length };
    const badSide = (x) => (high ? x < mean : x > mean), beyond = (x) => (mr > 0 ? (high ? x < lo : x > hi) : badSide(x));
    const out3 = v.slice(-3).filter(beyond);
    if (out3.length) return make("break", `${osNum(out3.at(-1))}${u} : hors des limites habituelles (${osNum(out.limits.lo)} à ${osNum(hi)}${u}).`);
    let side = 0;
    for (let i = n - 1; i >= 0 && badSide(v[i]); i--) side++;
    if (side >= 8) return make("shift", `${side} relevés de suite ${high ? "sous" : "au-dessus de"} la moyenne habituelle (${osNum(mean)}${u}).`);
  }
  if (run >= 4) return make("drift", `${run + 1} relevés de suite, chacun moins bon que le précédent : moins d’une chance sur 100 que ce soit le hasard.`);
  if (n < 5) return make("few", `${n} relevé${n > 1 ? "s" : ""} seulement.`);
  if (up >= 3) return make("better", `${up + 1} relevés de suite en amélioration ; encore ${osNum(Math.abs(last - target))}${u} pour atteindre la cible.`);
  const recent = v.slice(-Math.min(n, 12)), avg = egAvg(recent), off = high ? avg < target : avg > target;
  if (off) {
    const unreachable = out.limits && (high ? target > out.limits.hi : target < out.limits.lo);
    return make("chronic", `Moyenne ${osNum(avg)}${u} sur les ${recent.length} derniers relevés, pour une cible de ${osNum(target)}${u}${unreachable ? " : la cible est hors des limites habituelles, elle ne sera pas atteinte sans changer le système" : ""}.`);
  }
  return make("noise", `Moyenne ${osNum(avg)}${u} sur les ${recent.length} derniers relevés : la cible est tenue en moyenne.`);
}

/* Réponses déjà ouvertes sur cet indicateur et ce site. */
function egResponses(siteId, k) {
  const linked = (row) => row.site_id === siteId && (row.kpi_id === k.id || (row.origin_type === "KPI" && [k.id, k.code].includes(row.origin_id)) || (data.links || []).some((l) => l.from === row.id && l.to === k.id));
  return [
    ...osActive(data.problems).filter((p) => p.status !== "Clos" && linked(p)).map((p) => ({ id: p.id, kind: p.method || "Problème", title: p.title, owner: p.owner, status: p.status })),
    ...osActive(data.projects).filter((p) => p.status !== "Clos" && !p.closed_at && linked(p)).map((p) => ({ id: p.id, kind: "Chantier", title: p.title, owner: p.owner, status: p.status })),
    ...osActive(data.actions).filter((a) => isOpenAction(a) && linked(a)).map((a) => ({ id: a.id, kind: "Action", title: a.title, owner: a.owner, status: isLate(a) ? "en retard" : `pour le ${shortDate(a.due_date)}`, late: isLate(a) })),
  ];
}
function egWatch(siteId, kpiId) {
  return (data.gapReviews || []).filter((r) => !r.archived_at && r.site_id === siteId && r.kpi_id === kpiId).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
}
function egRows() {
  return osSuggestions().map((s) => {
    const k = osKpi(s.kpi_id), rows = osKpiMeasures(s.site_id, k.id), m = rows.at(-1), read = egRead(rows, k), resp = egResponses(s.site_id, k), watch = egWatch(s.site_id, k.id);
    const watching = !!watch && watch.until >= today() && (!watch.measure_id || watch.measure_id === m?.id || !read.signal);
    const t = osKpiTrend(s.site_id, k.id), detail = t.since ? `Hors cible depuis le ${shortDate(t.since)} · ${jnPlural(t.count, "relevé", "relevés")}` : s.detail;
    return { ...s, detail, k, rows, m, status: osStatus(m, k), read, resp, watch, watching, covered: resp.length > 0 || watching };
  }).sort((a, b) => Number(a.covered) - Number(b.covered) || EG_ORDER.indexOf(a.read.kind) - EG_ORDER.indexOf(b.read.kind) || (a.status === "gap" ? 0 : 1) - (b.status === "gap" ? 0 : 1) || b.basis.length - a.basis.length);
}
function egOpenCount() { return egRows().filter((r) => !r.covered).length; }
function egFind(key) { return egRows().find((r) => r.id === key) || null; }
function egCan(r) { return osWritable(r.site_id) && allowedSite(r.site_id, true); }

/* ---------- Affichage ---------- */

function egChart(r) {
  const v = r.rows.map((x) => x.value), target = egTarget(r.m, r.k), lim = r.read.limits;
  if (v.length < 2) return "";
  const all = [...v, ...(Number.isFinite(target) ? [target] : []), ...(lim ? [lim.hi, lim.lo] : [])], min = Math.min(...all), max = Math.max(...all), pad = (max - min) * 0.12 || 1;
  const lo = min - pad, hi = max + pad, W = 300, H = 74, x = (i) => 6 + (i * (W - 12)) / (v.length - 1), y = (val) => H - 6 - ((val - lo) * (H - 12)) / (hi - lo);
  const band = lim ? `<rect class="eg-band" x="0" y="${y(lim.hi).toFixed(1)}" width="${W}" height="${Math.max(1, y(lim.lo) - y(lim.hi)).toFixed(1)}"/><line class="eg-mean" x1="0" x2="${W}" y1="${y(lim.mean).toFixed(1)}" y2="${y(lim.mean).toFixed(1)}"/>` : "";
  const tgt = Number.isFinite(target) ? `<line class="eg-target" x1="0" x2="${W}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/>` : "";
  const pts = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(" ");
  return `<svg class="eg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`${r.k.name} · ${v.length} relevés · cible ${osNum(target)}`)}">${band}${tgt}<polyline class="eg-line" points="${pts}"/>${v.map((val, i) => `<circle class="eg-dot ${i === v.length - 1 ? "last" : ""}" cx="${x(i).toFixed(1)}" cy="${y(val).toFixed(1)}" r="${i === v.length - 1 ? 3.6 : 2.2}"/>`).join("")}</svg>`;
}
function egButtons(r) {
  const rec = r.read.rec, signal = r.read.signal, items = [];
  if (role().nav.includes("resolution")) items.push(["problem", signal ? "Ouvrir un QRQC" : "Ouvrir un problème"]);
  items.push(["project", "Lancer un chantier"], ["action", "Action rapide"]);
  if (osManager()) items.push(["watch", "Surveiller"]);
  items.sort((a, b) => (b[0] === rec) - (a[0] === rec));
  return `<div class="eg-do">${items.map(([k, l], i) => `<button type="button" class="btn${i ? " secondary" : ""} small" data-eg-do="${k}" data-eg-key="${esc(r.id)}">${l}</button>`).join("")}</div>`;
}
function egResp(r) {
  const can = egCan(r), w = r.watch;
  const list = r.resp.length ? `<ul class="eg-list">${r.resp.map((x) => `<li><button type="button" class="md-link" data-open-record="${esc(x.id)}">${esc(x.id)}</button> <span>${esc(x.kind)} · ${esc(x.title || "")}</span><small class="${x.late ? "bad" : ""}">${esc([x.owner, x.status].filter(Boolean).join(" · "))}</small></li>`).join("")}</ul>` : "";
  const watchLine = w ? `<p class="eg-watch ${r.watching ? "" : "over"}">${r.watching ? `Sous surveillance jusqu’au ${shortDate(w.until)}` : `Surveillance échue le ${shortDate(w.until)}${w.until >= today() ? " : un signal est apparu depuis" : ""}`} · ${esc(w.reason)}${w.note ? ` · ${esc(w.note)}` : ""}${w.by ? ` · ${esc(w.by)}` : ""}</p>` : "";
  if (r.covered) return `<div class="eg-resp ok"><span class="eg-resp-h">Pris en charge</span>${list}${watchLine}${can ? `<details class="eg-more"><summary>Autre réponse</summary>${egButtons(r)}</details>` : ""}</div>`;
  return `<div class="eg-resp none"><span class="eg-resp-h">Sans réponse</span>${watchLine}${can ? egButtons(r) : '<p class="hint">À traiter par le site.</p>'}</div>`;
}
function egCard(r) {
  const u = egUnit(r.k), target = egTarget(r.m, r.k), read = r.read;
  const bp = r.practices.length ? `<div class="in-drift-bp eg-bp"><span>Pratique validée ailleurs</span>${r.practices.map((id) => recordLink(id, osTitle(osRecord(id)?.row) || "Pratique")).join("")}</div>` : "";
  return `<article class="eg-card ${inTone(r.status)}" data-eg="${esc(r.id)}"><header class="eg-head"><div><small>${esc(getSiteName(r.site_id))}</small><h3>${esc(r.k.name)}</h3></div>${pill(osStatusText(r.status), osStatusTone(r.status))}</header>
    <div class="eg-fig"><div class="eg-val"><b>${osNum(r.m?.value, 2)}</b><span>${esc(u.trim())}</span></div><div class="eg-meta"><span>cible ${osNum(target)}${esc(u)}</span><span>${esc(r.detail)}</span></div></div>
    ${egChart(r)}
    <div class="eg-read r-${read.tone}"><b>${esc(read.label)}</b><span>${esc(read.text)}</span><span class="eg-adv">${esc(read.advice)}</span></div>
    ${egResp(r)}${bp}
    <div class="eg-foot"><button type="button" class="md-link" data-os="kpiDetail" data-args="${esc(JSON.stringify({ siteId: r.site_id, kpiId: r.kpi_id }))}">Courbe et relevés</button></div></article>`;
}
function egHelp() {
  const rows = ["event", "break", "shift", "drift", "chronic", "noise", "better", "few"].map((k) => `<li><b>${EG_READ[k].label}</b> · ${esc(EG_READ[k].advice)}</li>`).join("");
  return `<details class="panel section eg-help"><summary>Comment l’écran lit les courbes</summary><p>Un relevé hors cible n’est pas forcément un signal. Réagir à chaque point rouge fait courir les équipes après le hasard ; ne rien faire devant une vraie dérive laisse la situation se dégrader.</p><ul>${rows}</ul><p class="hint">Limites habituelles (zone grise) : moyenne ± 2,66 × écart moyen entre deux relevés successifs (carte XmR), calculées dès 6 relevés sur les premiers relevés de la série. Trait pointillé : la cible. Méthode de D. Wheeler, reprise par M. Graban (« Measures of Success »).</p></details>`;
}
function egPage() {
  const all = egRows(), group = state.site === "group";
  const siteF = group && OPERATIONAL_SITES.some((s) => s.id === state.egSite) ? state.egSite : "all";
  const inSite = all.filter((r) => siteF === "all" || r.site_id === siteF), open = inSite.filter((r) => !r.covered), covered = inSite.filter((r) => r.covered);
  const f = ["open", "covered", "all"].includes(state.egFilter) ? state.egFilter : open.length ? "open" : "all";
  const rows = f === "open" ? open : f === "covered" ? covered : inSite;
  const signals = inSite.filter((r) => r.read.signal).length, chronic = inSite.filter((r) => r.read.kind === "chronic").length;
  const late = osScope(data.actions).filter(isLate), missing = osIsAdmin() ? osIntegrity().filter((i) => allowedSite(osRecord(i.record_id)?.row.site_id || "group")) : [];
  const chips = `<div class="filters eg-filters" role="group" aria-label="Réponse">${[["open", `Sans réponse · ${open.length}`], ["covered", `Pris en charge · ${covered.length}`], ["all", `Tous · ${inSite.length}`]].map(([k, l]) => `<button type="button" class="chip ${k === f ? "active" : ""}" data-eg-f="${k}" aria-pressed="${k === f}">${l}</button>`).join("")}</div>`;
  const sites = group ? `<div class="in-chips eg-sites" role="group" aria-label="Site">${[["all", "Tous les sites", all.length], ...OPERATIONAL_SITES.map((s) => [s.id, s.name, all.filter((r) => r.site_id === s.id).length])].filter(([id, , n]) => id === "all" || n).map(([id, name, n]) => `<button type="button" class="in-chip ${id === siteF ? "active" : ""}" data-eg-site="${esc(id)}" aria-pressed="${id === siteF}">${esc(name)} · ${n}</button>`).join("")}</div>` : "";
  const parts = [signals ? jnPlural(signals, "signal", "signaux") : "", chronic ? `${chronic} toujours hors cible` : ""].filter(Boolean);
  const sum = inSite.length ? `<p class="eg-sum"><b>${jnPlural(inSite.length, "indicateur hors cible", "indicateurs hors cible")}</b>${parts.map((x) => ` · ${x}`).join("")} · <b class="${open.length ? "bad" : "good"}">${open.length ? `${open.length} sans réponse` : "tous pris en charge"}</b></p>` : "";
  const list = rows.length ? `<div class="eg-grid">${rows.map(egCard).join("")}</div>` : empty(inSite.length ? (f === "open" ? "Chaque écart a une réponse." : "Aucun écart dans ce filtre.") : "Aucun indicateur hors cible sur les derniers relevés qualifiés.");
  const lateBox = late.length ? `<section class="section"><div class="section-title"><h2>Actions en retard · ${late.length}</h2>${role().nav.includes("actions") ? '<button type="button" class="btn secondary small" data-eg-nav="actions">Plan d’actions</button>' : ""}</div>${osCards("actions", late.slice(0, 6))}</section>` : "";
  const fix = missing.length ? `<details class="panel section"><summary>Liens à corriger · ${missing.length}</summary>${missing.map((x) => `<p>${esc(x.record_id)} · ${esc(x.message)} ${recordLink(x.record_id, "Corriger")}</p>`).join("")}</details>` : "";
  return `${pageHead("Voir", "Écarts", "Chaque indicateur hors cible a une réponse. On réagit aux vrais signaux, pas à chaque relevé.")}${sites}${sum}${chips}${list}${lateBox}${egHelp()}${fix}`;
}

/* ---------- Réponses ---------- */

function egAction(key) {
  const r = egFind(key);
  if (!r || !egCan(r)) return toast("Ce site n’est pas dans votre périmètre d’écriture.");
  const u = egUnit(r.k), target = egTarget(r.m, r.k);
  modal("Action sur l’écart", `<form id="egActForm" class="jn-form"><div class="eg-ctx">${esc(r.k.name)} · ${esc(getSiteName(r.site_id))} : ${osNum(r.m?.value, 2)}${esc(u)} pour une cible de ${osNum(target)}${esc(u)} · ${esc(r.read.label.toLowerCase())}</div>
    <label class="field">Quoi<input id="egActTitle" required maxlength="160" placeholder="Ex. Vérifier le réglage du support P42 sur les trois équipes" autocomplete="off"></label>
    <div class="bp-two"><label class="field">Qui<input id="egActWho" list="ownerList" required value="${esc(apMe() || "")}">${ownerDatalist()}</label><label class="field">Pour quand<input id="egActDue" type="date" min="${today()}" value="${auAddDays(7)}" required></label></div>
    <div class="form-actions"><button class="btn jn-big">Créer l’action</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("egActTitle")?.focus(), 0);
  $("egActForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("egActTitle").value.trim(), owner = $("egActWho").value.trim(), due = $("egActDue").value;
    if (!title || !owner || !due) return toast("Quoi, qui et pour quand.");
    let aid = null;
    if (!commitData(() => {
      aid = auNext("A", data.actions);
      data.actions.unshift({ id: aid, site_id: r.site_id, title, description: `Écart ${r.k.name} · ${getSiteName(r.site_id)} : ${osNum(r.m?.value, 2)}${u} pour une cible de ${osNum(target)}${u}. ${r.read.label} : ${r.read.text}`, owner, due_date: due, due_date_initial: due, priority: r.status === "gap" || r.read.signal ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Performance", kpi_id: r.k.id, origin_type: "KPI", origin_id: r.k.id, finding: r.read.label, created_at: now(), updated_at: now() });
    })) return;
    if (typeof idSetMe === "function") idSetMe(owner);
    modalDirty = false; closeModal(); render(); toast(`Action ${aid} créée : l’écart est pris en charge.`);
  };
}
function egWatchForm(key) {
  const r = egFind(key);
  if (!r || !egCan(r) || !osManager()) return toast("La surveillance est décidée par un responsable.");
  let reason = r.read.kind === "noise" || r.read.kind === "better" ? EG_REASONS[0] : "";
  modal("Surveiller cet écart", `<form id="egWatchForm" class="jn-form"><div class="eg-ctx">${esc(r.k.name)} · ${esc(getSiteName(r.site_id))} · ${esc(r.read.label.toLowerCase())}</div><p class="jn-lead">Décider de ne pas réagir tout de suite, c’est une décision : avec un motif et une date pour revoir.</p>
    <div class="ap-field"><span class="metric-label">Pourquoi</span><div class="filters">${EG_REASONS.map((x) => `<button type="button" class="chip ${x === reason ? "active" : ""}" data-eg-r="${esc(x)}" aria-pressed="${x === reason}">${esc(x)}</button>`).join("")}</div></div>
    <label class="field">Précision (facultatif)<input id="egWatchNote" maxlength="200" placeholder="Ex. arrêt fournisseur du 3, déjà traité en QRQC" autocomplete="off"></label>
    <div class="ap-field"><span class="metric-label">À revoir dans</span><div class="filters">${[[7, "1 semaine"], [14, "2 semaines"], [30, "1 mois"]].map(([d, l]) => `<button type="button" class="chip ${d === 7 ? "active" : ""}" data-eg-d="${d}">${l}</button>`).join("")}</div></div>
    <div class="bp-two"><label class="field">Jusqu’au<input id="egWatchUntil" type="date" min="${today()}" value="${auAddDays(7)}" required></label><label class="field">Décidé par<input id="egWatchBy" list="ownerList" required value="${esc(apMe() || osActor())}">${ownerDatalist()}</label></div>
    <p class="hint">Si un signal apparaît avant cette date, l’écart repasse en « Sans réponse ».</p>
    <div class="form-actions"><button class="btn jn-big">Enregistrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("egWatchForm");
  root.querySelectorAll("[data-eg-r]").forEach((b) => (b.onclick = () => { reason = b.dataset.egR; root.querySelectorAll("[data-eg-r]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); modalDirty = true; }));
  root.querySelectorAll("[data-eg-d]").forEach((b) => (b.onclick = () => { $("egWatchUntil").value = auAddDays(Number(b.dataset.egD)); root.querySelectorAll("[data-eg-d]").forEach((x) => x.classList.toggle("active", x === b)); }));
  root.onsubmit = (e) => {
    e.preventDefault();
    const note = $("egWatchNote").value.trim(), until = $("egWatchUntil").value, by = $("egWatchBy").value.trim();
    if (!reason) return toast("Pourquoi surveiller plutôt qu’agir ?");
    if (!until || until < today()) return toast("Une date à venir pour revoir l’écart.");
    if (!by) return toast("Qui décide ?");
    if (!commitData(() => {
      data.gapReviews ||= [];
      data.gapReviews.unshift({ id: auNext("EC", data.gapReviews), site_id: r.site_id, kpi_id: r.k.id, measure_id: r.m?.id || null, decision: "watch", reason, note, by, at: now(), until });
    })) return;
    if (typeof idSetMe === "function") idSetMe(by);
    modalDirty = false; closeModal(); render(); toast(`Sous surveillance jusqu’au ${shortDate(until)}.`);
  };
}
function egDo(kind, key) {
  const r = egFind(key);
  if (!r) return;
  if (!egCan(r)) return toast("Ce site n’est pas dans votre périmètre d’écriture.");
  const u = egUnit(r.k), target = egTarget(r.m, r.k), site = getSiteName(r.site_id);
  if (kind === "action") return egAction(key);
  if (kind === "watch") return egWatchForm(key);
  if (kind === "problem") return genericProblemForm({ site_id: r.site_id, kpi_id: r.k.id, origin_id: r.m?.id || r.k.id, method: r.read.signal ? "QRQC" : "A3", owner: apMe() || "", title: `${r.read.signal ? r.read.label : "Écart"} ${r.k.name} · ${site}`, description: `${osNum(r.m?.value, 2)}${u} pour une cible de ${osNum(target)}${u}. ${r.read.text}` });
  if (kind === "project") return cdNew({ site_id: r.site_id, kpi_id: r.k.id, method: "Kaizen", title: `Ramener ${r.k.name} à ${osNum(target)}${u} · ${site}`, kpi: { label: r.k.name, unit: u.trim(), base: r.m?.value, target } });
}

/* ---------- Branchements ---------- */

renderOSAnalysis = function () { return egPage(); };

// Pilotage › « À creuser » : même lecture, réponse visible, les écarts sans réponse d'abord.
inDrifts = function () {
  const rows = egRows(), limit = interfaceMode() === "essential" ? 4 : 6, open = rows.filter((r) => !r.covered).length;
  if (!rows.length) return "";
  const more = inCan("analysis") ? `<button type="button" class="btn ghost small" data-in-nav="analysis">${open ? `${jnPlural(open, "écart sans réponse", "écarts sans réponse")}` : `Tout voir · ${rows.length}`}</button>` : "";
  return `<section class="in-block"><div class="in-block-head"><h2>À creuser</h2><span class="hint">Hors cible plusieurs relevés de suite</span>${more}</div><div class="in-drifts">${rows.slice(0, limit).map((r) => `<article class="in-drift ${inTone(r.status)}"><button type="button" class="in-drift-main" data-os="kpiDetail" data-args="${inArgs({ siteId: r.site_id, kpiId: r.kpi_id })}"><b>${esc(r.title)}</b><span>${esc(r.read.label)} · ${esc(r.detail)}</span></button><span class="eg-tag ${r.covered ? "ok" : "none"}">${r.covered ? `Pris en charge${r.resp[0] ? ` · ${esc(r.resp[0].id)}` : ""}` : "Sans réponse"}</span>${r.practices.length ? `<div class="in-drift-bp"><span>Pratique validée ailleurs</span>${r.practices.map((id) => recordLink(id, osTitle(osRecord(id)?.row) || "Pratique")).join("")}</div>` : ""}</article>`).join("")}</div></section>`;
};

const egWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = egWatchBase();
  if (!role().nav.includes("analysis") || role().readonly || !osManager()) return base;
  const rows = egRows().filter((r) => !r.covered && (state.site === "group" || r.site_id === state.site));
  if (!rows.length) return base;
  const sig = rows.filter((r) => r.read.signal).length;
  const row = `<button type="button" class="jn-row" data-eg-go><span class="jn-row-main"><span class="jn-tag tone-open">Écarts</span><b>${jnPlural(rows.length, "indicateur hors cible sans réponse", "indicateurs hors cible sans réponse")}</b><span class="hint">${sig ? `${jnPlural(sig, "signal", "signaux")} · ` : ""}${esc(rows.slice(0, 2).map((r) => r.title).join(" · "))}</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${row}$2`);
};

function egBind(root = document) {
  root.querySelectorAll("[data-eg-f]").forEach((b) => (b.onclick = () => { state.egFilter = b.dataset.egF; render(); }));
  root.querySelectorAll("[data-eg-site]").forEach((b) => (b.onclick = () => { state.egSite = b.dataset.egSite; render(); }));
  root.querySelectorAll("[data-eg-do]").forEach((b) => (b.onclick = () => egDo(b.dataset.egDo, b.dataset.egKey)));
  root.querySelectorAll("[data-eg-nav]").forEach((b) => (b.onclick = () => switchView(b.dataset.egNav)));
  root.querySelectorAll("[data-eg-go]").forEach((b) => (b.onclick = () => { state.egFilter = "open"; switchView("analysis"); }));
}
const egOsBindBase = osBind;
osBind = function () { const out = egOsBindBase.apply(this, arguments); egBind(document); return out; };
