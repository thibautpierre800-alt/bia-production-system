"use strict";
/*
 * Plan d'actions 7.6 : liste « À traiter », compteurs-filtres, fiche rapide,
 * point de la semaine, reports tracés, revue guidée, saisie éclair et panneau.
 * Champs ajoutés aux actions (migration additive, aucun champ supprimé) :
 *   updates[]          {at, text, by}            points d'avancement
 *   due_date_initial   "AAAA-MM-JJ"              date promise au départ
 *   reschedules[]      {at, from, to, reason, by} reports d'échéance
 *   category           famille (liste paramétrable des catégories)
 */

const AP_PRIOS = [["Critique", 1], ["Haute", 2], ["Normale", 3]];
const AP_FILTERS = [
  ["late", "En retard"],
  ["week", "Cette semaine"],
  ["verify", "À vérifier"],
  ["safety", "Sécurité ouvertes"],
  ["stale", "Sans nouvelle"],
  ["standby", "Standby"],
  ["all", "Toutes ouvertes"],
];
const AP_STALE_DAYS = 14;

function apDay(value) { return String(value || "").slice(0, 10); }
function apShiftDay(day, n) { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function apEndOfMonth(day) { const d = new Date(day + "T12:00:00"); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10); }
function apAgo(value) { const n = Math.max(0, -daysUntil(apDay(value) || today())); return n === 0 ? "aujourd’hui" : n === 1 ? "hier" : `il y a ${n} j`; }
function apPromised(a) { return a.due_date_initial || a.due_date || ""; }
function apLastUpdate(a) { return (a.updates || []).at(-1) || null; }
function apSilence(a) { const ref = apDay(apLastUpdate(a)?.at || a.created_at) || today(); return Math.max(0, -daysUntil(ref)); }
function apOwnerless(a) { return !a.owner || a.owner === "À désigner"; }
function apCanEdit(a) { return !!a && !role().readonly && allowedSite(a.site_id, true); }
function apPrioRank(a) { return priorityRank(a.priority); }

function actionFamily(a) {
  if (a.category) return a.category;
  const g = data.gembas.find((x) => x.id === a.origin_id),
    o = g && gembaObservations(g).find((x) => x.id === a.observation_id);
  if (o?.category) return o.category;
  const signal = data.signals.find((s) => s.id === a.origin_id);
  if (signal?.type) return signal.type;
  const problem = data.problems.find((p) => p.id === a.origin_id || p.id === a.problem_id);
  const linked = problem && data.signals.find((s) => (problem.signal_ids || []).includes(s.id));
  return linked?.type || "Non classée";
}

function apInfo(a) {
  const d = daysUntil(a.due_date),
    open = isOpenAction(a),
    active = open && (a.status === "Ouverte" || a.status === "En cours"),
    late = isLate(a),
    silence = apSilence(a);
  return {
    d, open, active, late, silence,
    week: active && !late && d !== null && d >= 0 && d <= 7,
    month: active && !late && d !== null && d > 7 && d <= 30,
    later: active && !late && d !== null && d > 30,
    noDate: active && !a.due_date,
    safety: open && a.status !== "Standby" && actionFamily(a) === "Sécurité",
    stale: active && silence > AP_STALE_DAYS,
  };
}

function apRank(a) {
  const i = apInfo(a),
    bucket = i.late ? 0 : i.week ? 1 : i.month ? 2 : i.later ? 3 : i.noDate ? 4 : a.status === "À vérifier" ? 5 : a.status === "Standby" ? 6 : 7;
  return bucket * 1e6 + (i.d === null ? 5e5 : i.d + 1e5) * 10 + apPrioRank(a);
}

function apMatches(filter, a) {
  const i = apInfo(a);
  return {
    all: i.open,
    late: i.late,
    week: i.week,
    verify: i.open && a.status === "À vérifier",
    safety: i.safety,
    stale: i.stale,
    standby: i.open && a.status === "Standby",
  }[filter] ?? i.open;
}

function apDueBadge(a, i = apInfo(a)) {
  if (a.status === "Clôturée") { const at = a.closed_at || a.verified_at; return { cls: "done", label: at ? `Close le ${shortDate(at)}` : "Clôturée" }; }
  if (i.late) return { cls: "late", label: `Retard ${-i.d} j` };
  if (!a.due_date) return { cls: "none", label: "Sans date" };
  if (i.d === 0) return { cls: "soon", label: "Aujourd’hui" };
  if (i.d === 1) return { cls: "soon", label: "Demain" };
  if (i.d > 1 && i.d <= 7 && a.status !== "Standby") return { cls: "soon", label: `Dans ${i.d} j` };
  return { cls: "", label: shortDate(a.due_date) };
}

function apWarnings(a, i = apInfo(a)) {
  const out = [];
  if (i.open && apOwnerless(a)) out.push("Sans pilote");
  if (i.noDate) out.push("Sans date");
  if (i.open && (a.reschedules || []).length) out.push(`Reportée ${(a.reschedules || []).length} fois`);
  if (i.stale) out.push(apLastUpdate(a) ? `Sans nouvelle depuis ${i.silence} j` : `Aucun point depuis ${i.silence} j`);
  if (a.status === "Standby" && a.hold_reason) out.push(`En attente : ${a.hold_reason}`);
  return out;
}

function apRow(a, compact = false) {
  const i = apInfo(a), due = apDueBadge(a, i), warn = apWarnings(a, i), u = apLastUpdate(a), p = apPrioRank(a);
  const origin = `${a.origin_type || "Manuel"}${a.origin_id ? " " + a.origin_id : ""}`;
  return `<button type="button" class="ap-row${compact ? " compact" : ""}" data-search-row data-ap-open="${esc(a.id)}" aria-label="${esc(`${a.title}, ${a.owner || "À désigner"}, ${due.label}, ${a.status}`)}">
    <span class="ap-row-main"><span class="ap-row-top"><span class="ap-prio p${p}">P${p}</span><span class="ap-title">${esc(a.title)}</span></span>
    <span class="ap-meta">${esc(a.id)} · ${esc(getSiteName(a.site_id))} · ${esc(actionFamily(a))} · ${esc(origin)}</span>
    ${u && !compact ? `<span class="ap-news"><b>Dernier point</b> (${apAgo(u.at)}) : ${esc(u.text)}</span>` : ""}
    ${warn.length ? `<span class="ap-warns">${warn.map((w) => `<span class="ap-warn">${esc(w)}</span>`).join("")}</span>` : ""}</span>
    <span class="ap-row-side"><span class="ap-due ${due.cls}">${esc(due.label)}</span>${pill(a.status, actionTone(a))}<span class="ap-owner">${esc(a.owner || "À désigner")}</span></span>
  </button>`;
}

function apScopeRows(all) {
  let rows = all;
  if (state.actionOwner && state.actionOwner !== "all") rows = rows.filter((a) => (state.actionOwner === "none" ? apOwnerless(a) : a.owner === state.actionOwner));
  if (state.actionFamily && state.actionFamily !== "all") rows = rows.filter((a) => actionFamily(a) === state.actionFamily);
  if (state.actionSite && state.actionSite !== "all") rows = rows.filter((a) => a.site_id === state.actionSite);
  return rows;
}

function apReviewQueue(rows = scoped(data.actions)) {
  const queue = [], add = (a, reason, tone) => { if (!queue.some((q) => q.id === a.id)) queue.push({ id: a.id, reason, tone }); };
  const open = rows.filter((a) => isOpenAction(a) && a.status !== "Standby").sort((x, y) => apRank(x) - apRank(y));
  open.filter((a) => apInfo(a).safety).forEach((a) => add(a, "Sécurité", "critical"));
  open.filter(isLate).forEach((a) => add(a, `En retard de ${-daysUntil(a.due_date)} j`, "open"));
  open.filter((a) => apInfo(a).week).forEach((a) => add(a, "Échéance cette semaine", "progress"));
  open.filter((a) => a.status === "À vérifier").forEach((a) => add(a, "À vérifier", "progress"));
  open.filter((a) => apInfo(a).stale).forEach((a) => add(a, "Sans nouvelle", "neutral"));
  return queue;
}

function apOwners(all = scoped(data.actions)) {
  const names = new Set();
  all.forEach((a) => { if (!apOwnerless(a)) names.add(a.owner); });
  (data.people || []).filter((p) => p.name && allowedSite(p.site_id)).forEach((p) => { if (![...names].some((n) => n === p.name || n.startsWith(p.name + " ·"))) names.add(p.name); });
  return [...names].sort((x, y) => x.localeCompare(y, "fr"));
}

function renderActions() {
  const all = scoped(data.actions),
    base = apScopeRows(all),
    readonly = role().readonly,
    view = ["todo", "status", "board"].includes(state.actionView) ? state.actionView : "todo",
    filter = AP_FILTERS.some(([k]) => k === state.actionFilter) ? state.actionFilter : "all",
    group = ["due", "owner", "family", "site"].includes(state.actionGroup) ? state.actionGroup : "due",
    queue = apReviewQueue(all);
  const counters = AP_FILTERS.map(([k, label]) => {
    const n = base.filter((a) => apMatches(k, a)).length, on = filter === k, alarm = (k === "late" || k === "safety") && n > 0;
    return `<button type="button" class="ap-counter${on ? " active" : ""}${alarm ? " alarm" : ""}" data-action-filter="${k}" aria-pressed="${on}"><b>${n}</b><span>${label}</span></button>`;
  }).join("");
  const scope = [
    state.actionFamily && state.actionFamily !== "all" ? state.actionFamily : "",
    state.actionSite && state.actionSite !== "all" ? getSiteName(state.actionSite) : "",
  ].filter(Boolean).join(" × ");
  const owners = apOwners(all);
  const rows = base.filter((a) => apMatches(filter, a) || (filter === "all" && a.status === "Clôturée" && !a.archived_at && -daysUntil(apDay(a.closed_at || a.verified_at || a.updated_at)) <= 30)).sort((x, y) => apRank(x) - apRank(y));
  let body;
  if (view === "board") body = apBoard(all);
  else if (view === "status") {
    body = `<div class="ap-kanban">${ACTION_STATES.map((st) => {
      const list = rows.filter((a) => a.status === st);
      return `<section class="ap-col" aria-label="${esc(st)}"><h3>${esc(st)}<span class="badge">${list.length}</span></h3>${list.map((a) => apRow(a, true)).join("") || '<p class="ap-empty">Aucune action</p>'}</section>`;
    }).join("")}</div>`;
  } else {
    let sections;
    if (group === "due") {
      sections = [
        ["En retard", "À traiter en premier.", (a) => isLate(a), "late"],
        ["Cette semaine", "Échéance dans les 7 jours.", (a) => apInfo(a).week, ""],
        ["Ce mois-ci", "Échéance dans 8 à 30 jours.", (a) => apInfo(a).month, ""],
        ["Plus tard", "", (a) => apInfo(a).later, ""],
        ["Sans date", "Fixer une date en revue.", (a) => apInfo(a).noDate, ""],
        ["À vérifier", "Faites : il manque la preuve d’efficacité.", (a) => a.status === "À vérifier" && !isLate(a), ""],
        ["Standby", "Bloquées, avec leur motif.", (a) => a.status === "Standby", ""],
        ["Clôturées récemment", "30 derniers jours.", (a) => a.status === "Clôturée", "done"],
      ].map(([title, hint, test, tone]) => ({ title, hint, tone, list: rows.filter(test) }));
    } else {
      const key = group === "owner" ? (a) => a.owner || "À désigner" : group === "family" ? actionFamily : (a) => getSiteName(a.site_id);
      const keys = [...new Set(rows.filter(isOpenAction).map(key))].sort((x, y) => (x === "À désigner" || x === "Non classée") - (y === "À désigner" || y === "Non classée") || x.localeCompare(y, "fr"));
      sections = keys.map((k) => ({ title: k, hint: "", tone: "", list: rows.filter((a) => isOpenAction(a) && key(a) === k) }));
    }
    body = sections.filter((s) => s.list.length).map((s) => `<section class="ap-section" aria-label="${esc(s.title)}"><div class="ap-section-head"><h2 class="${s.tone}">${esc(s.title)} · ${s.list.length}</h2>${s.hint ? `<span class="hint">${esc(s.hint)}</span>` : ""}</div>${s.list.map((a) => apRow(a)).join("")}</section>`).join("")
      || `<div class="empty">Aucune action pour ce filtre. <button type="button" class="chip" data-ap-clear>Tout afficher</button></div>`;
  }
  const buttons = readonly ? "" : `<div class="ap-head-actions">${queue.length ? `<button type="button" class="btn dark" data-ap-review>Lancer la revue · ${queue.length}</button>` : ""}<button type="button" class="btn" data-ap-quick>+ Action</button></div>`;
  return `<div class="ap-page">${pageHead("Plan d’actions", "Ce qui doit avancer, et qui s’en occupe", "Les actions issues des Gemba, signaux, audits et A3, au même endroit. Les compteurs servent de filtres. La revue passe les actions une par une.", buttons)}
    <div class="ap-counters" role="group" aria-label="Compteurs, cliquez pour filtrer">${counters}</div>
    <div class="ap-toolbar">
      <div class="filters" role="group" aria-label="Vue">${[["todo", "À traiter"], ["status", "Par statut"], ["board", "Panneau"]].map(([id, label]) => `<button type="button" class="chip ${view === id ? "active" : ""}" data-action-view="${id}" aria-pressed="${view === id}">${label}</button>`).join("")}</div>
      ${view === "todo" ? `<label class="inline-filter">Regrouper par <select data-action-group>${[["due", "Échéance"], ["owner", "Pilote"], ["family", "Famille"], ["site", "Site"]].map(([v, l]) => `<option value="${v}" ${group === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      ${view !== "board" ? `<label class="inline-filter">Pilote <select data-action-owner-filter><option value="all">Tous</option>${owners.map((o) => `<option value="${esc(o)}" ${state.actionOwner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}<option value="none" ${state.actionOwner === "none" ? "selected" : ""}>À désigner</option></select></label>` : ""}
      ${scope ? `<button type="button" class="chip active" data-ap-scope-clear aria-label="Retirer le filtre ${esc(scope)}">${esc(scope)} ✕</button>` : ""}
    </div>
    ${view !== "board" ? listSearch("Rechercher une action") : ""}${body}</div>`;
}

/* ---------- Panneau ---------- */

function apBoard(all) {
  if (!all.length) return empty("Aucune action à afficher");
  const open = all.filter(isOpenAction),
    sites = [...new Set(all.map((a) => a.site_id))],
    cols = state.actionBoardCols === "owner" || (state.actionBoardCols !== "site" && sites.length < 2) ? "owner" : "site",
    families = actionFamilies(all),
    closed = all.filter((a) => a.status === "Clôturée" && (a.closed_at || a.verified_at) && -daysUntil(apDay(a.closed_at || a.verified_at)) <= 60),
    onTime = closed.filter((a) => !apPromised(a) || apDay(a.closed_at || a.verified_at) <= apPromised(a)).length,
    slipped = open.filter((a) => (a.reschedules || []).length).length,
    safety = open.filter((a) => apInfo(a).safety),
    stale = open.filter((a) => apInfo(a).stale);
  const heads = cols === "site"
    ? sites.map((s) => ({ key: s, label: getSiteName(s), match: (a) => a.site_id === s, attrs: `data-site="${esc(s)}"` }))
    : [...new Set(open.map((a) => a.owner || "À désigner"))].sort((x, y) => (x === "À désigner") - (y === "À désigner") || x.localeCompare(y, "fr"))
        .map((o) => ({ key: o, label: o, match: (a) => (a.owner || "À désigner") === o, attrs: `data-owner="${esc(o)}"` }));
  const cell = (fam, h) => {
    const list = all.filter((a) => actionFamily(a) === fam && h.match(a)), act = list.filter(isOpenAction);
    let cls = "none", label = "aucune", count = "—";
    if (act.length) {
      count = act.length;
      if (act.some(isLate)) { cls = "late"; label = "en retard"; }
      else if (act.some((a) => a.priority === "Critique" && apInfo(a).active)) { cls = "critical"; label = "P1 en cours"; }
      else if (act.every((a) => a.status === "Standby")) { cls = "hold"; label = "standby"; }
      else if (act.every((a) => a.status === "À vérifier" || a.status === "Standby")) { cls = "verify"; label = "à vérifier"; }
      else { cls = "work"; label = "dans les temps"; }
    } else if (list.length) { cls = "done"; label = "tout clos"; count = 0; }
    return `<button type="button" class="pb-cell ${cls}" data-board-cell ${h.attrs} data-family="${esc(fam)}" ${list.length ? "" : "disabled"} aria-label="${esc(fam)}, ${esc(h.label)} : ${act.length ? `${act.length} action(s) ouverte(s), ${label}` : label}"><b>${count}</b><span>${label}</span></button>`;
  };
  const grid = `grid-template-columns:minmax(170px,1.4fr) repeat(${heads.length},minmax(96px,1fr));min-width:${190 + heads.length * 104}px`;
  const loads = [...new Set(open.map((a) => a.owner || "À désigner"))].sort((x, y) => (x === "À désigner") - (y === "À désigner") || x.localeCompare(y, "fr")).map((name) => {
    const mine = open.filter((a) => (a.owner || "À désigner") === name).sort((x, y) => apRank(x) - apRank(y));
    const late = mine.filter(isLate).length, week = mine.filter((a) => apInfo(a).week).length;
    const dots = mine.map((a) => `<span class="ap-dot ${isLate(a) ? "late" : apInfo(a).week ? "soon" : a.status === "À vérifier" ? "verify" : a.status === "Standby" ? "hold" : ""}"></span>`).join("");
    return `<div class="ap-load"><span class="ap-load-name">${esc(name)}</span><span class="ap-load-dots" aria-hidden="true">${dots}</span><span class="ap-load-text">${mine.length} ouverte(s)${late ? ` · ${late} en retard` : ""}${week ? ` · ${week} cette semaine` : ""}</span></div>`;
  }).join("");
  return `<div class="pb">
    <div class="ap-tiles">
      <article class="pb-safety"><div class="metric-label">Sécurité d’abord</div><b>${safety.length}</b><small>action(s) de sécurité ouvertes. Elles passent en premier dans chaque revue.</small></article>
      <article class="card"><div class="metric-label">Tenue des délais</div><div class="metric-value">${closed.length ? Math.round((onTime / closed.length) * 100) + " %" : "—"}</div><p class="hint">${closed.length ? `${onTime} sur ${closed.length} action(s) closes en 60 jours l’ont été à la date promise au départ, pas à la date reportée.` : "Aucune action close sur les 60 derniers jours."}</p></article>
      <article class="card"><div class="metric-label">Glissement</div><div class="metric-value">${slipped} / ${open.length}</div><p class="hint">actions ouvertes déjà reportées au moins une fois. Un report répété est un signal à traiter.</p></article>
      <article class="card"><div class="metric-label">Sans nouvelle depuis ${AP_STALE_DAYS} jours</div><div class="metric-value">${stale.length}</div><p class="hint">Actions ouvertes sans point d’avancement. À demander au pilote.</p></article>
    </div>
    <section class="panel section"><div class="ap-board-head"><h2>Famille × ${cols === "site" ? "site" : "pilote"}</h2><div class="filters" role="group" aria-label="Colonnes">${sites.length > 1 ? `<button type="button" class="chip ${cols === "site" ? "active" : ""}" data-board-cols="site" aria-pressed="${cols === "site"}">par site</button>` : ""}<button type="button" class="chip ${cols === "owner" ? "active" : ""}" data-board-cols="owner" aria-pressed="${cols === "owner"}">par pilote</button></div></div>
      <p class="hint">Le chiffre compte les actions ouvertes. Le mot dit pourquoi la case a cette couleur. Cliquez une case pour voir les actions.</p>
      <div class="pb-scroll"><div class="pb-grid" style="${grid}"><div></div>${heads.map((h) => `<div class="pb-head">${esc(h.label)}</div>`).join("")}${families.map((f) => `<div class="pb-fam">${esc(f)}</div>${heads.map((h) => cell(f, h)).join("")}`).join("")}</div></div>
      <div class="pb-legend"><span><i class="late"></i>En retard</span><span><i class="critical"></i>P1 en cours</span><span><i class="work"></i>Dans les temps</span><span><i class="verify"></i>À vérifier</span><span><i class="hold"></i>Standby</span><span><i class="done"></i>Tout clos</span></div></section>
    <section class="panel section"><h2>Charge par pilote</h2><p class="hint">Un point par action ouverte. Le texte à droite donne les mêmes chiffres.</p>${loads || '<p class="hint">Aucune action ouverte.</p>'}</section>
  </div>`;
}

/* ---------- Écritures ---------- */

function apPatch(id, change, note) {
  const a = data.actions.find((x) => x.id === id);
  if (!apCanEdit(a)) { toast("Modification non autorisée sur cette action."); return false; }
  return commitData(() => { const row = data.actions.find((x) => x.id === id); change(row); row.updated_at = now(); if (note) recordHistory(row, row.status, note); });
}
function apAddUpdate(id, text) {
  const t = String(text || "").trim();
  if (!t) { toast("Écrivez le point d’avancement."); return false; }
  return apPatch(id, (a) => { (a.updates ||= []).push({ at: now(), text: t, by: osActor() }); }, `Point : ${t}`);
}
function apReschedule(id, to, reason = "") {
  const a = data.actions.find((x) => x.id === id);
  if (!a) return false;
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) { toast("Date invalide."); return false; }
  if ((a.due_date || "") === (to || "")) return true;
  return apPatch(id, (row) => {
    if (row.due_date) { row.due_date_initial ||= row.due_date; (row.reschedules ||= []).push({ at: now(), from: row.due_date, to: to || null, reason: reason || "", by: osActor() }); }
    else if (!row.due_date_initial && to) row.due_date_initial = to;
    row.due_date = to || null;
  }, `Échéance : ${shortDate(a.due_date)} → ${shortDate(to)}${reason ? " · " + reason : ""}`);
}
function apSetStatus(id, status, reason = "") {
  const a = data.actions.find((x) => x.id === id);
  if (!a || a.status === status) return true;
  if (status === "Standby" && !reason.trim()) { toast("Indiquez le motif de mise en attente."); return false; }
  return apPatch(id, (row) => {
    row.status = status;
    row.progress = { Ouverte: 0, "En cours": 50, Standby: row.progress || 0, "À vérifier": 90 }[status] ?? row.progress;
    row.hold_reason = status === "Standby" ? reason.trim() : "";
    row.closed_at = null;
  }, status === "Standby" ? `Standby : ${reason.trim()}` : `Statut : ${status}`);
}
function apCloseError(a, evidence, verifier) {
  if (a.required_person_ids?.length && !osChain(a).complete) return "Standard publié et compétences validées sur sa version courante requis avant clôture.";
  if (a.sustainment && osReviewStatus(a).label === "Efficacité non tenue") return "Un contrôle reste inefficace : documentez un nouveau contrôle concluant avant clôture.";
  if (!evidence || !verifier) return "Pour clore : résultat constaté et vérificateur requis.";
  return "";
}
function apClose(id, evidence, verifier) {
  const a = data.actions.find((x) => x.id === id), e = String(evidence || "").trim(), v = String(verifier || "").trim();
  if (!a) return false;
  const error = apCloseError(a, e, v);
  if (error) { toast(error); return false; }
  return apPatch(id, (row) => {
    row.status = "Clôturée"; row.progress = 100; row.closed_at = now(); row.hold_reason = "";
    row.effectiveness = e; row.verified_by = v; row.verified_at = today();
  }, e);
}
function apSetField(id, field, value) {
  const labels = { owner: "Pilote", priority: "Priorité", category: "Famille" }, a = data.actions.find((x) => x.id === id);
  const v = String(value || "").trim();
  if (!a || !labels[field] || (a[field] || "") === v) return true;
  if (field === "owner" && !v) { toast("Indiquez un pilote ou « À désigner »."); return false; }
  if (field === "priority" && !AP_PRIOS.some(([p]) => p === v)) return false;
  return apPatch(id, (row) => { row[field] = v; }, `${labels[field]} : ${a[field] || "vide"} → ${v}`);
}

/* ---------- Fiche rapide ---------- */

function apChips(items, attr, current) {
  return items.map(([value, label]) => `<button type="button" class="chip ${value === current ? "active" : ""}" ${attr}="${esc(value)}" aria-pressed="${value === current}">${esc(label)}</button>`).join("");
}
function apDueChips(attr) {
  const t = today();
  return [["Dans 1 semaine", apShiftDay(t, 7)], ["Dans 2 semaines", apShiftDay(t, 14)], ["Fin du mois", apEndOfMonth(t)]]
    .map(([label, d]) => `<button type="button" class="chip" ${attr}="${d}">${label} (${shortDate(d).slice(0, 5)})</button>`).join("");
}

function apOpen(id, ask = "") {
  const a = data.actions.find((x) => x.id === id);
  if (!a || !allowedSite(a.site_id)) return;
  const edit = apCanEdit(a) && a.status !== "Clôturée", i = apInfo(a), due = apDueBadge(a, i);
  const journal = [
    ...(a.updates || []).map((u) => ({ at: u.at, text: u.text, by: u.by })),
    ...(a.reschedules || []).map((r) => ({ at: r.at, text: `Échéance déplacée du ${shortDate(r.from)} au ${shortDate(r.to)}${r.reason ? " : " + r.reason : ""}`, by: r.by })),
  ].sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const slip = (a.reschedules || []).length ? `Reportée ${(a.reschedules || []).length} fois · date promise au départ : ${shortDate(apPromised(a))}` : a.due_date ? "Date promise au départ, jamais reportée." : "";
  const owners = apOwners().slice(0, 8);
  const askBox = ask === "hold"
    ? `<div class="ap-ask hold"><label class="field">Pourquoi en standby ?<input id="apHoldReason" placeholder="Ex. en attente de l’export SEQUOIA"></label><button type="button" class="btn dark" data-ap-hold-confirm>Mettre en standby</button></div>`
    : ask === "close"
      ? `<div class="ap-ask close"><label class="field">Preuve d’efficacité (mesure, photo, relevé)<textarea id="apProof" rows="2" placeholder="Ex. 0 défaut sur trois lots contrôlés"></textarea></label><label class="field">Vérifié par<input id="apVerifier" value="${esc(osActor())}"></label><button type="button" class="btn dark" data-ap-close-confirm>Clôturer avec cette preuve</button></div>`
      : "";
  const editor = edit ? `
    <div class="ap-field"><span class="metric-label">Statut</span><div class="filters">${apChips(ACTION_STATES.map((s) => [s, s]), "data-ap-status", a.status)}</div>${askBox}</div>
    <div class="ap-field"><span class="metric-label">Pilote</span><div class="filters">${apChips(owners.map((o) => [o, o]).concat([["À désigner", "À désigner"]]), "data-ap-owner", a.owner || "À désigner")}</div>
      <label class="field">Autre pilote<input id="apOwnerInput" list="ownerList" placeholder="Nom ou équipe">${ownerDatalist()}</label></div>
    <div class="ap-field"><span class="metric-label">Échéance · ${esc(a.due_date ? shortDate(a.due_date) : "sans date")} <span class="ap-due ${due.cls}">${esc(due.label)}</span></span>
      <div class="filters">${apDueChips("data-ap-due")}</div>
      <div class="form-grid"><label>Autre date<input type="date" id="apDueInput" value="${esc(a.due_date || "")}"></label><label>Motif du changement<input id="apDueReason" placeholder="Facultatif, conservé dans le journal"></label></div>
      ${slip ? `<p class="hint">${esc(slip)}</p>` : ""}</div>
    <div class="ap-field"><span class="metric-label">Priorité</span><div class="filters">${apChips(AP_PRIOS.map(([p, n]) => [p, `P${n} · ${p}`]), "data-ap-prio", a.priority || "Normale")}</div></div>
    <div class="ap-field"><span class="metric-label">Famille</span><div class="filters">${apChips(SIGNAL_TYPES.map((f) => [f, f]), "data-ap-family", a.category || "")}</div>${!a.category ? `<p class="hint">Famille déduite de l’origine : ${esc(actionFamily(a))}.</p>` : ""}</div>
    <div class="ap-field"><label class="field">Point de la semaine<input id="apNote" placeholder="Où en est-on ? Une phrase suffit."></label><button type="button" class="btn dark" data-ap-note>Ajouter le point</button></div>`
    : `<p>${pill(a.status, actionTone(a))} <span class="ap-due ${due.cls}">${esc(due.label)}</span> · ${esc(a.owner || "À désigner")} · ${esc(priorityLabel(a.priority))}</p>${slip ? `<p class="hint">${esc(slip)}</p>` : ""}${a.status === "Clôturée" && a.effectiveness ? `<p><b>Preuve :</b> ${esc(a.effectiveness)} · ${esc(a.verified_by || "")}</p>` : ""}`;
  modal(`${a.id} · Fiche action`, `<div class="ap-fiche">
    <p class="eyebrow">${esc(getSiteName(a.site_id))} · ${esc(actionFamily(a))} · ${esc(a.origin_type || "Manuel")}${a.origin_id ? " " + esc(a.origin_id) : ""}</p>
    <h3 class="ap-fiche-title">${esc(a.title)}</h3>
    ${a.finding && a.finding !== a.title ? `<p class="hint"><b>Constat :</b> ${esc(a.finding)}</p>` : ""}${a.description ? `<p class="hint">${esc(a.description)}</p>` : ""}
    ${editor}
    <div class="ap-field"><span class="metric-label">Journal</span>${journal.length ? `<ol class="ap-journal">${journal.map((j) => `<li><b>${shortDate(j.at)}</b><span>${esc(j.text)}${j.by ? ` · ${esc(j.by)}` : ""}</span></li>`).join("")}</ol>` : '<p class="hint">Aucun point pour l’instant.</p>'}</div>
    <div class="form-actions"><button type="button" class="btn secondary" data-ap-full>Fiche complète</button>${a.origin_id ? recordLink(a.origin_id, "Origine") : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button></div>
  </div>`);
  const after = (ok) => { if (ok) { render(); apOpen(id); } };
  const q = (sel) => $("modalContent").querySelectorAll(sel);
  q("[data-ap-status]").forEach((b) => (b.onclick = () => {
    const s = b.dataset.apStatus;
    if (s === a.status) return;
    if (s === "Standby") return apOpen(id, "hold");
    if (s === "Clôturée") return apOpen(id, "close");
    after(apSetStatus(id, s));
  }));
  q("[data-ap-hold-confirm]").forEach((b) => (b.onclick = () => after(apSetStatus(id, "Standby", $("apHoldReason").value))));
  q("[data-ap-close-confirm]").forEach((b) => (b.onclick = () => after(apClose(id, $("apProof").value, $("apVerifier").value))));
  q("[data-ap-owner]").forEach((b) => (b.onclick = () => after(apSetField(id, "owner", b.dataset.apOwner))));
  const ownerInput = $("apOwnerInput");
  if (ownerInput) ownerInput.onchange = () => { if (ownerInput.value.trim()) after(apSetField(id, "owner", ownerInput.value)); };
  q("[data-ap-due]").forEach((b) => (b.onclick = () => after(apReschedule(id, b.dataset.apDue, $("apDueReason")?.value.trim() || ""))));
  const dueInput = $("apDueInput");
  if (dueInput) dueInput.onchange = () => { if (dueInput.value) after(apReschedule(id, dueInput.value, $("apDueReason")?.value.trim() || "")); };
  q("[data-ap-prio]").forEach((b) => (b.onclick = () => after(apSetField(id, "priority", b.dataset.apPrio))));
  q("[data-ap-family]").forEach((b) => (b.onclick = () => after(apSetField(id, "category", b.dataset.apFamily))));
  q("[data-ap-note]").forEach((b) => (b.onclick = () => after(apAddUpdate(id, $("apNote").value))));
  const note = $("apNote");
  if (note) note.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); after(apAddUpdate(id, note.value)); } };
  q("[data-ap-full]").forEach((b) => (b.onclick = () => { closeModal(); actionForm(data.actions.find((x) => x.id === id)); }));
  if (ask) setTimeout(() => $(ask === "hold" ? "apHoldReason" : "apProof")?.focus(), 0);
}

/* ---------- Saisie éclair ---------- */

function apQuickForm() {
  if (role().readonly) return;
  const sites = OPERATIONAL_SITES.filter((s) => allowedSite(s.id, true)),
    defaultSite = state.site !== "group" && allowedSite(state.site, true) ? state.site : sites[0]?.id,
    owners = apOwners().slice(0, 8), firstDue = apShiftDay(today(), 7);
  if (!defaultSite) return toast("Aucun site autorisé pour créer une action.");
  modal("Nouvelle action", `<form id="apQuickForm" class="ap-quick">
    <label class="field">Quoi ?<input id="apqTitle" required placeholder="Commencer par un verbe : Fixer, Délimiter, Mesurer…"></label>
    <div class="ap-field"><span class="metric-label">Qui ?</span><div class="filters">${apChips(owners.map((o) => [o, o]).concat([["À désigner", "Plus tard"]]), "data-apq-owner", "")}</div>
      <label class="field">Autre pilote<input id="apqOwner" list="ownerList" placeholder="Nom ou équipe">${ownerDatalist()}</label></div>
    <div class="ap-field"><span class="metric-label">Pour quand ?</span><div class="filters">${[["Dans 1 semaine", firstDue], ["Dans 2 semaines", apShiftDay(today(), 14)], ["Fin du mois", apEndOfMonth(today())], ["Sans date", ""]].map(([l, d]) => `<button type="button" class="chip ${d === firstDue ? "active" : ""}" data-apq-due="${d}" aria-pressed="${d === firstDue}">${l}</button>`).join("")}</div>
      <label class="field">Autre date<input type="date" id="apqDue" value="${firstDue}"></label></div>
    <div class="ap-field"><span class="metric-label">Famille</span><div class="filters">${apChips(SIGNAL_TYPES.map((f) => [f, f]), "data-apq-family", "")}</div><input type="hidden" id="apqFamily" value=""></div>
    <div class="form-grid"><div class="ap-field"><span class="metric-label">Priorité</span><div class="filters">${apChips(AP_PRIOS.map(([p, n]) => [p, `P${n}`]), "data-apq-prio", "Normale")}</div><input type="hidden" id="apqPrio" value="Normale"></div>
      ${sites.length > 1 ? `<label>Site<select id="apqSite">${sites.map((s) => `<option value="${s.id}" ${s.id === defaultSite ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : `<input type="hidden" id="apqSite" value="${esc(defaultSite)}">`}</div>
    <p class="hint">Le reste (constat, origine, preuve) se complète plus tard dans la fiche. Une action sans pilote ou sans date est signalée dans la liste.</p>
    <div class="form-actions"><button class="btn">Créer l’action</button><button type="button" class="btn secondary" data-ap-full-form>Formulaire complet</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div>
  </form>`);
  const root = $("modalContent"), pick = (attr, apply) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => {
    root.querySelectorAll(`[${attr}]`).forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
    apply(b.getAttribute(attr));
  }));
  pick("data-apq-owner", (v) => ($("apqOwner").value = v));
  pick("data-apq-due", (v) => ($("apqDue").value = v));
  pick("data-apq-family", (v) => ($("apqFamily").value = v));
  pick("data-apq-prio", (v) => ($("apqPrio").value = v));
  root.querySelector("[data-ap-full-form]").onclick = () => { closeModal(); actionForm(null, {}); };
  $("apQuickForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("apqTitle").value.trim(), siteId = $("apqSite").value, due = $("apqDue").value;
    if (!title) return toast("Précisez l’action.");
    if (!allowedSite(siteId, true)) return toast("Site hors de votre périmètre.");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return toast("Date invalide.");
    const id = nextId("A", data.actions), payload = {
      id, site_id: siteId, workshop_id: state.workshop || null, title, owner: $("apqOwner").value.trim() || "À désigner",
      due_date: due || null, due_date_initial: due || null, priority: $("apqPrio").value || "Normale", status: "Ouverte", progress: 0,
      closed_at: null, description: "", category: $("apqFamily").value || null, origin_type: "Manuel", origin_id: null, observation_id: null,
      effectiveness: null, verified_by: null, verified_at: null, updates: [], reschedules: [], created_at: now(), updated_at: now(),
    };
    if (!commitData(() => { data.actions.unshift(payload); recordHistory(payload, "Ouverte", "Créée en saisie rapide"); })) return;
    closeModal(); state.view = "actions"; state.actionView = "todo"; state.actionFilter = "all";
    receipt(id, "Plan d’actions", siteId, payload.owner === "À désigner" ? "Désigner un pilote" : `${payload.owner} · ${payload.due_date ? shortDate(payload.due_date) : "date à fixer"}`);
    render();
  };
}

/* ---------- Revue guidée ---------- */

function apStartReview() {
  if (role().readonly) return;
  const queue = apReviewQueue();
  if (!queue.length) return toast("Rien à revoir : aucune action en retard, à vérifier, de sécurité ou à échéance cette semaine.");
  state.apReview = { queue, i: 0, step: "card", log: [], started: now() };
  apReviewRender();
}
function apReviewNext(entry) {
  const r = state.apReview;
  if (!r) return;
  if (entry) r.log.push(entry);
  r.i += 1; r.step = r.i >= r.queue.length ? "end" : "card";
  render(); apReviewRender();
}
function apReviewReport(r) {
  const lines = [`Revue du plan d’actions du ${shortDate(today())} · ${site().name}`, `${r.log.length} action(s) passée(s) en revue.`, ""];
  r.log.forEach((l) => lines.push(`- ${l.id} ${l.title} (${l.owner}) : ${l.text}`));
  const rows = scoped(data.actions);
  lines.push("", `Après la revue : ${rows.filter(isLate).length} action(s) en retard, ${rows.filter((a) => apInfo(a).safety).length} action(s) de sécurité ouvertes.`);
  return lines.join("\n");
}
function apReviewRender() {
  const r = state.apReview;
  if (!r) return;
  const total = r.queue.length, pct = Math.round((Math.min(r.i, total) / total) * 100);
  let body;
  if (r.step === "end") {
    const n = (k) => r.log.filter((l) => l.kind === k).length, report = apReviewReport(r);
    body = `<div class="ap-rv-card"><h2>Revue terminée</h2>
      <div class="ap-rv-sum">${[["note", "points notés"], ["done", "faites ou closes"], ["postponed", "reportées"], ["hold", "bloquées"], ["skip", "passées"]].map(([k, l]) => `<div><b>${k === "done" ? n("done") + n("closed") : n(k)}</b><span>${l}</span></div>`).join("")}</div>
      <label class="field">Compte rendu prêt à envoyer<textarea id="apReport" rows="10" readonly>${esc(report)}</textarea></label>
      <div class="form-actions"><button type="button" class="btn" data-ap-copy>Copier le compte rendu</button><button type="button" class="btn secondary" data-ap-rv-quit>Fermer</button></div></div>`;
  } else {
    const entry = r.queue[r.i], a = data.actions.find((x) => x.id === entry.id);
    if (!a || !isOpenAction(a)) return apReviewNext(null);
    const i = apInfo(a), due = apDueBadge(a, i), u = apLastUpdate(a), warn = apWarnings(a, i), p = apPrioRank(a);
    const head = `<div class="ap-rv-tags">${pill(entry.reason, entry.tone)}<span class="ap-prio p${p}">P${p}</span><span class="hint">${esc(a.id)} · ${esc(getSiteName(a.site_id))} · ${esc(actionFamily(a))}</span></div>
      <h2 class="ap-rv-title">${esc(a.title)}</h2>
      <div class="ap-rv-facts"><span><b>Pilote :</b> ${esc(a.owner || "À désigner")}</span><span><b>Échéance :</b> <span class="ap-due ${due.cls}">${esc(due.label)}</span></span><span><b>Statut :</b> ${esc(a.status)}</span></div>
      ${u ? `<p class="ap-rv-news"><b>Dernier point</b> (${apAgo(u.at)}) : ${esc(u.text)}</p>` : ""}
      ${warn.length ? `<div class="ap-warns">${warn.map((w) => `<span class="ap-warn">${esc(w)}</span>`).join("")}</div>` : ""}`;
    const t = today(), base = a.due_date && a.due_date > t ? a.due_date : t;
    if (r.step === "postpone") {
      body = `<div class="ap-rv-card">${head}<h3>Reporter</h3><p class="hint">La date promise au départ reste visible et le report est compté. Un report n’efface pas un retard.</p>
        <div class="filters">${[["+1 semaine", apShiftDay(base, 7)], ["+2 semaines", apShiftDay(base, 14)], ["Fin du mois", apEndOfMonth(t)]].map(([l, d]) => `<button type="button" class="chip" data-ap-rv-date="${d}">${l} (${shortDate(d).slice(0, 5)})</button>`).join("")}</div>
        <div class="form-grid"><label>Nouvelle date<input type="date" id="apRvDate"></label><label>Motif du report (obligatoire)<input id="apRvText" placeholder="Ex. pièce en commande, livraison semaine 47"></label></div>
        <div class="form-actions"><button type="button" class="btn dark" data-ap-rv-confirm="postpone">Reporter et suivante</button><button type="button" class="btn secondary" data-ap-rv-back>Retour</button></div></div>`;
    } else if (r.step === "hold") {
      body = `<div class="ap-rv-card">${head}<h3>Qu’est-ce qui bloque ?</h3><p class="hint">L’action passe en standby : elle ne compte plus en retard, mais elle reste visible avec son motif.</p>
        <label class="field">Motif (obligatoire)<input id="apRvText" placeholder="Ex. arbitrage budget à demander au COMEX"></label>
        <div class="form-actions"><button type="button" class="btn dark" data-ap-rv-confirm="hold">Mettre en standby et suivante</button><button type="button" class="btn secondary" data-ap-rv-back>Retour</button></div></div>`;
    } else if (r.step === "verify") {
      body = `<div class="ap-rv-card">${head}<h3>Quelle preuve que c’est efficace ?</h3><p class="hint">Une action n’est close qu’avec une preuve : mesure, photo, relevé.</p>
        <div class="form-grid"><label class="wide">Preuve (obligatoire)<textarea id="apRvText" rows="2" placeholder="Ex. statut bloqué affiché, contrôlé sur 5 palettes"></textarea></label><label>Vérifié par<input id="apRvVerifier" value="${esc(osActor())}"></label></div>
        <div class="form-actions"><button type="button" class="btn dark" data-ap-rv-confirm="verify">Clôturer et suivante</button><button type="button" class="btn secondary" data-ap-rv-back>Retour</button></div></div>`;
    } else {
      const active = a.status === "Ouverte" || a.status === "En cours";
      body = `<div class="ap-rv-card">${head}
        <label class="field">Point de la semaine<input id="apRvNote" placeholder="Une phrase : ce qui a été fait, ce qui bloque."></label>
        <div class="ap-rv-buttons">
          <button type="button" class="btn dark" data-ap-rv="note">Noter et suivante</button>
          ${active ? '<button type="button" class="btn ap-verify" data-ap-rv="done">Faite, à vérifier</button>' : ""}
          ${a.status === "À vérifier" ? '<button type="button" class="btn ap-done" data-ap-rv="verify">Vérifier et clôturer</button>' : ""}
          <button type="button" class="btn secondary" data-ap-rv="postpone">Reporter</button>
          <button type="button" class="btn secondary ap-hold" data-ap-rv="hold">Bloquée</button>
          <button type="button" class="btn ghost" data-ap-rv="skip">Passer</button>
        </div></div>`;
    }
  }
  modal("Revue du plan d’actions", `<div class="ap-rv"><div class="ap-rv-progress"><span>${r.step === "end" ? "Terminée" : `Action ${r.i + 1} sur ${total}`}</span><button type="button" class="btn ghost small" data-ap-rv-quit>Quitter la revue</button></div>
    <div class="ap-rv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>${body}</div>`);
  $("modal").classList.add("ap-review");
  apReviewBind();
}
function apReviewBind() {
  const r = state.apReview, root = $("modalContent");
  const q = (sel) => root.querySelectorAll(sel);
  q("[data-ap-rv-quit]").forEach((b) => (b.onclick = () => { closeModal(); render(); }));
  q("[data-ap-copy]").forEach((b) => (b.onclick = () => {
    const text = $("apReport").value;
    try { navigator.clipboard.writeText(text).then(() => toast("Compte rendu copié."), () => { $("apReport").select(); toast("Sélectionnez le texte pour le copier."); }); }
    catch { $("apReport").select(); toast("Sélectionnez le texte pour le copier."); }
  }));
  if (!r || r.step === "end") return;
  const entry = r.queue[r.i], a = data.actions.find((x) => x.id === entry.id);
  if (!a) return;
  const log = (kind, text) => ({ kind, id: a.id, title: a.title, owner: a.owner || "À désigner", text });
  q("[data-ap-rv-back]").forEach((b) => (b.onclick = () => { r.step = "card"; apReviewRender(); }));
  q("[data-ap-rv-date]").forEach((b) => (b.onclick = () => { $("apRvDate").value = b.dataset.apRvDate; q("[data-ap-rv-date]").forEach((x) => x.classList.toggle("active", x === b)); }));
  q("[data-ap-rv]").forEach((b) => (b.onclick = () => {
    const kind = b.dataset.apRv;
    if (kind === "note") { const t = $("apRvNote").value.trim(); if (apAddUpdate(a.id, t)) apReviewNext(log("note", `point noté, ${t}`)); return; }
    if (kind === "done") {
      const t = $("apRvNote").value.trim();
      if (t && !apAddUpdate(a.id, t)) return;
      if (apSetStatus(a.id, "À vérifier")) apReviewNext(log("done", `faite, preuve à apporter${t ? " (" + t + ")" : ""}`));
      return;
    }
    if (kind === "skip") return apReviewNext(log("skip", "passée sans changement"));
    r.step = kind; apReviewRender();
    setTimeout(() => (kind === "postpone" ? $("apRvDate") : $("apRvText"))?.focus(), 0);
  }));
  q("[data-ap-rv-confirm]").forEach((b) => (b.onclick = () => {
    const kind = b.dataset.apRvConfirm, text = $("apRvText")?.value.trim() || "";
    if (kind === "postpone") {
      const d = $("apRvDate").value;
      if (!d || !text) return toast("Choisissez une nouvelle date et indiquez le motif du report.");
      if (d < today()) return toast("La nouvelle date doit être aujourd’hui ou plus tard.");
      if (apReschedule(a.id, d, text)) apReviewNext(log("postponed", `reportée au ${shortDate(d)} (${text})`));
    } else if (kind === "hold") {
      if (!text) return toast("Indiquez ce qui bloque.");
      if (apSetStatus(a.id, "Standby", text)) apReviewNext(log("hold", `bloquée, ${text}`));
    } else if (kind === "verify") {
      if (apClose(a.id, text, $("apRvVerifier").value)) apReviewNext(log("closed", `clôturée, preuve : ${text}`));
    }
  }));
}

/* ---------- Intégration ---------- */

const apModalBase = modal, apCloseModalBase = closeModal;
modal = function (title, content) { $("modal").classList.remove("ap-review"); return apModalBase(title, content); };
closeModal = function () { $("modal").classList.remove("ap-review"); state.apReview = null; return apCloseModalBase(); };

const apLaunchActionBase = launchAction;
launchAction = function (button) { if (!button?.dataset?.originId && !button?.dataset?.originType && !role().readonly) return apQuickForm(); return apLaunchActionBase(button); };

const apRenderActionsBase = renderActions;
renderActions = function () { return apRenderActionsBase() + (typeof osReviewAgenda === "function" ? osReviewAgenda() : ""); };

function apBind() {
  if (state.view !== "actions") return;
  document.querySelectorAll("[data-ap-open]").forEach((b) => (b.onclick = () => apOpen(b.dataset.apOpen)));
  document.querySelectorAll("[data-ap-quick]").forEach((b) => (b.onclick = apQuickForm));
  document.querySelectorAll("[data-ap-review]").forEach((b) => (b.onclick = apStartReview));
  document.querySelectorAll("[data-action-filter]").forEach((b) => (b.onclick = () => { const k = b.dataset.actionFilter; state.actionFilter = state.actionFilter === k && k !== "all" ? "all" : k; render(); }));
  document.querySelectorAll("[data-action-group]").forEach((s) => (s.onchange = () => { state.actionGroup = s.value; render(); }));
  document.querySelectorAll("[data-ap-scope-clear]").forEach((b) => (b.onclick = () => { state.actionFamily = "all"; state.actionSite = "all"; render(); }));
  document.querySelectorAll("[data-ap-clear]").forEach((b) => (b.onclick = () => { state.actionFamily = "all"; state.actionSite = "all"; state.actionOwner = "all"; state.actionFilter = "all"; render(); }));
  document.querySelectorAll("[data-board-cols]").forEach((b) => (b.onclick = () => { state.actionBoardCols = b.dataset.boardCols; render(); }));
  document.querySelectorAll("[data-board-cell]").forEach((b) => (b.onclick = () => {
    state.actionFamily = b.dataset.family; state.actionSite = b.dataset.site || "all"; state.actionOwner = b.dataset.owner ? (b.dataset.owner === "À désigner" ? "none" : b.dataset.owner) : "all";
    state.actionView = "todo"; state.actionGroup = "due"; state.actionFilter = "all"; render();
  }));
}
const apOsBindBase = osBind;
osBind = function () { const out = apOsBindBase.apply(this, arguments); apBind(); return out; };
