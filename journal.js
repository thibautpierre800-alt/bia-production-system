"use strict";
/*
 * BIA Lean OS 8.30 · Journal d'activité : qui a fait quoi, quand, en phrases lisibles.
 *  - Chaque événement devient une phrase : « Marie a clôturé l'action A-021 · … », « a reporté l'échéance de … »,
 *    « a créé le chantier … ». Les noms de champs et les valeurs sont traduits (dates, statuts, textes coupés).
 *  - Regroupé par jour (Aujourd'hui, Hier, date) ; heure, auteur, site.
 *  - Filtres : période (7 jours, 30 jours, tout), type (statuts, créations, échéances, archivages, règles),
 *    auteur, site (niveau Groupe), recherche ; « Voir plus » par 60.
 *  - Export CSV (séparateur « ; », lisible dans Excel) des événements filtrés.
 *  - Auteur : le nom déclaré sur l'appareil (« Je suis ») est ajouté au profil dans chaque nouvel événement.
 * Données : activity[] inchangé ; les nouveaux événements portent en plus `person` (nom déclaré) et `role`.
 */

const JR_KIND = {
  actions: "l’action", signals: "le signal", gembas: "le Gemba", problems: "le problème", documents: "le document", audits: "l’audit",
  projects: "le chantier", objectives: "l’objectif", kaizens: "l’idée", practices: "la bonne pratique", deployments: "le déploiement",
  gains: "le gain", maturity: "l’évaluation de maturité", routines: "le rituel", handovers: "la relève", escalations: "l’escalade",
  decisions: "la décision", topics: "le sujet SQCDP", roadmap: "la priorité", toolRuns: "la démarche", auditTemplates: "le questionnaire",
  connectors: "le connecteur", comments: "le commentaire", sites: "le site", workshops: "l’atelier", zones: "la zone", users: "l’utilisateur",
  kpis: "l’indicateur", measures: "le relevé", environmentLogs: "le relevé environnement",
};
const JR_FIELDS = {
  status: "Statut", state: "Statut", owner: "Responsable", due_date: "Échéance", due_date_initial: "Échéance initiale", title: "Titre", name: "Nom",
  description: "Description", priority: "Priorité", progress: "Avancement", severity: "Gravité", site_id: "Site", workshop_id: "Atelier",
  zone_id: "Zone", kpi_id: "Indicateur", value: "Valeur", target: "Cible", period: "Période", closed_at: "Clôture", effectiveness: "Efficacité",
  verified_by: "Vérifié par", verified_at: "Vérifié le", archived_at: "Archivage", summary: "Résumé", evidence: "Preuve", category: "Catégorie",
  method: "Méthode", zone: "Zone", type: "Type", content: "Contenu", structured_data: "Contenu", updates: "Points d’avancement",
  reschedules: "Reports", result: "Résultat", baseline: "Situation de départ", target_date: "Date cible", problem: "Problème",
  solution: "Solution", immediate_action: "Action immédiate", taken_by: "Pris en charge par", taken_at: "Pris en charge le",
  resolved_at: "Résolu le", hold_reason: "Motif d’attente", validated_by: "Validé par", validated_at: "Validé le", published_at: "Publié le",
  version: "Version", steps_done: "Étapes", weather: "Météo", measures: "Mesures", charter: "Charte", kpi: "Indicateur suivi",
  checks: "Points de relève", priority_list: "Priorités", ack_note: "Reprise", photos: "Photos", before_photo: "Photo avant",
  after_photo: "Photo après", trained: "Formés", points: "Points clés", definition: "Définition", green: "Seuil vert", orange: "Seuil orange",
  direction: "Sens", unit: "Unité", frequency: "Fréquence", source: "Source", role: "Rôle", active: "Actif",
  settings: "Paramètres", links: "Liens", hoshinPlan: "Plan Hoshin", objectives: "Objectifs", roadmap: "Roadmap",
};
const JR_RULES = { "Règles modifiées": "a modifié les règles de management", "Relations modifiées": "a modifié des liens entre dossiers" };
const JR_TYPES = [["all", "Tout"], ["status", "Statuts"], ["create", "Créations"], ["due", "Échéances"], ["archive", "Archivages"], ["rules", "Règles"]];
const JR_DONE = /^(Clôturée|Clôturé|Clos|Close|Vérifié|Validée|Validé|Publiée|Déployée|Gain validé|Reprise|Terminé|Standardisé)$/;
const JR_PAGE = 60;

function jrKey(e) { return e.record_id ? recordMeta(e.record_id)?.key || Object.entries(OS_PREFIX).find(([, p]) => String(e.record_id).startsWith(p + "-"))?.[0] || null : null; }
function jrWho(e) { return e.person ? `${e.person}` : e.actor || "—"; }
function jrType(e) {
  if (!e.record_id) return "rules";
  if (e.event === "Création") return "create";
  if (e.event === "Archivage") return "archive";
  if ((e.fields || []).includes("due_date") && e.changes?.due_date?.before) return "due";
  if (e.from !== e.to && (e.from || e.to)) return "status";
  return "edit";
}
function jrVal(k, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (k === "site_id") return getSiteName(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return shortDate(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return `${shortDate(s)} ${jrTime(s)}`;
  return s.length > 120 ? `${s.slice(0, 119)}…` : s;
}
function jrTime(at) { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function jrDay(at) { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function jrDayLabel(day) {
  const t = jrDay(new Date().toISOString()), y = jrDay(new Date(Date.now() - 86400000).toISOString());
  if (day === t) return "Aujourd’hui";
  if (day === y) return "Hier";
  const d = new Date(day + "T12:00:00");
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
function jrObj(kind, de) { return !de ? kind : kind.startsWith("le ") ? `du ${kind.slice(3)}` : `de ${kind}`; }
function jrFieldList(e) { return [...new Set((e.fields || []).filter((f) => !["history", "updated_at"].includes(f)).map((f) => JR_FIELDS[f] || f.replace(/_/g, " ")))]; }
/* La phrase : sujet implicite (l'auteur est affiché à côté), verbe, objet, précision. */
function jrSentence(e) {
  const key = jrKey(e), kind = JR_KIND[key] || "le dossier", row = e.record_id ? osRecord(e.record_id)?.row || recordMeta(e.record_id)?.row : null;
  const title = row ? osTitle(row) || row.description || "" : "";
  const what = { kind, id: e.record_id, title: title ? (String(title).length > 80 ? `${String(title).slice(0, 79)}…` : String(title)) : "" };
  const type = jrType(e);
  if (type === "rules") return { verb: JR_RULES[e.event] || `· ${e.event || "Modification"}`, what: null, extra: JR_RULES[e.event] ? "" : jrFieldList(e).join(", ") };
  if (type === "create") return { verb: "a créé", what, extra: e.to ? `statut « ${e.to} »` : "" };
  if (type === "archive") return { verb: "a archivé", what, extra: "" };
  if (type === "due") { const c = e.changes.due_date, later = String(c.after || "") > String(c.before || ""); return { verb: later ? "a reporté l’échéance" : "a avancé l’échéance", de: true, what, extra: `${jrVal("due_date", c.before)} → ${jrVal("due_date", c.after)}` }; }
  if (type === "status") return { verb: JR_DONE.test(String(e.to || "")) ? (/Clôtur|Clos|Close|Terminé/.test(e.to) ? "a clôturé" : /Valid|Vérifi|Gain/.test(e.to) ? "a validé" : /Publi/.test(e.to) ? "a publié" : /Déploy/.test(e.to) ? "a déployé" : "a fait avancer") : "a changé le statut", de: !JR_DONE.test(String(e.to || "")), what, extra: `« ${e.from || "—"} » → « ${e.to || "—"} »` };
  return { verb: "a modifié", what, extra: jrFieldList(e).slice(0, 4).join(", ") + (jrFieldList(e).length > 4 ? "…" : "") };
}
function jrTone(e) {
  const t = jrType(e);
  if (t === "status" && JR_DONE.test(String(e.to || ""))) return "done";
  return { create: "create", due: "due", archive: "archive", rules: "rules", status: "status" }[t] || "edit";
}
function jrScope() { return (data.activity || []).filter((e) => state.site === "group" || e.site_id === state.site); }
function jrFiltered() {
  const f = state.jrFilter || {}, q = String(f.q || "").trim().toLowerCase(), since = f.period === "7" ? 7 : f.period === "30" ? 30 : 0;
  const from = since ? new Date(Date.now() - since * 86400000).toISOString() : "";
  return jrScope().filter((e) => (!from || String(e.at) >= from) && (!f.type || f.type === "all" || jrType(e) === f.type) && (!f.who || jrWho(e) === f.who) && (!f.site || f.site === "all" || e.site_id === f.site) && (!q || [e.record_id, e.event, jrWho(e), e.actor, jrSentence(e).what?.title, ...(e.fields || [])].join(" ").toLowerCase().includes(q))).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function jrRow(e) {
  const s = jrSentence(e), changes = e.changes ? Object.entries(e.changes).filter(([k]) => !["history", "updated_at"].includes(k)) : [];
  const roleTag = e.person && e.role ? ` <small>${esc(e.role)}</small>` : "";
  const target = s.what ? ` ${esc(jrObj(s.what.kind, s.de))} ${e.record_id && recordMeta(e.record_id) ? `<button type="button" class="md-link" data-open-record="${esc(e.record_id)}">${esc(e.record_id)}</button>` : `<b>${esc(e.record_id || "")}</b>`}${s.what.title ? ` · ${esc(s.what.title)}` : ""}` : "";
  return `<li class="jr-ev jr-${jrTone(e)}"><time datetime="${esc(e.at || "")}">${jrTime(e.at)}</time><div class="jr-body"><p><b class="jr-who">${esc(jrWho(e))}</b>${roleTag} ${esc(s.verb)}${target}</p>${s.extra ? `<p class="jr-extra">${esc(s.extra)}</p>` : ""}${state.site === "group" && e.site_id ? `<span class="jr-site">${esc(getSiteName(e.site_id))}</span>` : ""}${changes.length && jrType(e) !== "create" ? `<details class="jr-det"><summary>Valeurs modifiées · ${changes.length}</summary><dl>${changes.map(([k, v]) => `<div><dt>${esc(JR_FIELDS[k] || k.replace(/_/g, " "))}</dt><dd>${esc(jrVal(k, v.before))} → ${esc(jrVal(k, v.after))}</dd></div>`).join("")}</dl></details>` : ""}</div></li>`;
}
function jrPage() {
  const f = state.jrFilter ||= {}, all = jrScope(), rows = jrFiltered(), shown = rows.slice(0, state.jrShown || JR_PAGE);
  const whoCounts = {};
  all.forEach((e) => { const w = jrWho(e); whoCounts[w] = (whoCounts[w] || 0) + 1; });
  const whos = Object.entries(whoCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const chip = (attr, val, label, on) => `<button type="button" class="chip ${on ? "active" : ""}" ${attr}="${esc(val)}" aria-pressed="${on}">${esc(label)}</button>`;
  const period = `<div class="filters" role="group" aria-label="Période">${[["7", "7 jours"], ["30", "30 jours"], ["all", "Tout"]].map(([v, l]) => chip("data-jr-period", v, l, (f.period || "all") === v)).join("")}</div>`;
  const types = `<div class="filters" role="group" aria-label="Type">${JR_TYPES.map(([v, l]) => chip("data-jr-type", v, l, (f.type || "all") === v)).join("")}</div>`;
  const who = whos.length > 1 ? `<div class="in-chips jr-whos" role="group" aria-label="Auteur">${[["", "Tout le monde"], ...whos.map(([w]) => [w, w])].map(([v, l]) => `<button type="button" class="in-chip ${(f.who || "") === v ? "active" : ""}" data-jr-who="${esc(v)}" aria-pressed="${(f.who || "") === v}">${esc(l)}</button>`).join("")}</div>` : "";
  const sites = state.site === "group" ? `<div class="in-chips jr-sites" role="group" aria-label="Site">${[["all", "Tous les sites"], ["group", "Groupe"], ...OPERATIONAL_SITES.map((s) => [s.id, s.name])].filter(([id]) => id === "all" || all.some((e) => e.site_id === id)).map(([id, name]) => `<button type="button" class="in-chip ${(f.site || "all") === id ? "active" : ""}" data-jr-site="${esc(id)}" aria-pressed="${(f.site || "all") === id}">${esc(name)}</button>`).join("")}</div>` : "";
  const days = [];
  shown.forEach((e) => { const d = jrDay(e.at); let g = days.at(-1); if (!g || g.day !== d) days.push((g = { day: d, rows: [] })); g.rows.push(e); });
  const list = shown.length ? days.map((g) => `<section class="jr-day"><h3>${esc(jrDayLabel(g.day))} <small>${jnPlural(g.rows.length, "événement", "événements")}</small></h3><ol class="jr-list">${g.rows.map(jrRow).join("")}</ol></section>`).join("") : empty(all.length ? "Aucun événement avec ces filtres." : "Aucun événement enregistré sur ce périmètre.");
  const more = rows.length > shown.length ? `<div class="jr-more"><button type="button" class="btn secondary" data-jr-more>Voir plus · ${rows.length - shown.length}</button></div>` : "";
  return `${pageHead("Traçabilité", "Journal d’activité", "Qui a fait quoi, et quand.", rows.length ? `<button type="button" class="btn secondary" data-jr-csv>Exporter (CSV)</button>` : "")}
    <div class="jr-tools"><label class="jr-search"><input type="search" id="jrSearch" aria-label="Rechercher dans le journal" value="${esc(f.q || "")}" placeholder="Rechercher un dossier, une personne…" autocomplete="off"></label>${period}${types}${who}${sites}</div>
    <p class="jr-count">${jnPlural(rows.length, "événement", "événements")}${rows.length !== all.length ? ` sur ${all.length}` : ""} · <span class="hint">Auteur : le nom déclaré sur l’appareil, sinon le profil. Pas d’authentification serveur.</span></p>
    ${list}${more}`;
}
function jrCsv(rows = jrFiltered()) {
  const cell = (v) => { const s = String(v ?? "").replace(/\r?\n/g, " "); return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Date", "Heure", "Auteur", "Profil", "Site", "Événement", "Dossier", "Titre", "Champs", "Avant", "Après"];
  const lines = rows.map((e) => {
    const s = jrSentence(e), ch = e.changes ? Object.entries(e.changes) : [];
    return [shortDate(e.at), jrTime(e.at), jrWho(e), e.role || e.actor || "", getSiteName(e.site_id || "group"), `${s.verb}${s.extra ? ` (${s.extra})` : ""}`, e.record_id || "", s.what?.title || "", jrFieldList(e).join(", "), ch.map(([k, v]) => `${JR_FIELDS[k] || k}: ${jrVal(k, v.before)}`).join(" | "), ch.map(([k, v]) => `${JR_FIELDS[k] || k}: ${jrVal(k, v.after)}`).join(" | ")].map(cell).join(";");
  });
  return "﻿" + [head.join(";"), ...lines].join("\r\n");
}
function jrDownload() {
  const text = jrCsv(), url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = `journal-activite-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Journal exporté.");
}

/* ---------- Branchements ---------- */

renderOSActivity = function () { return jrPage(); };

// Chaque nouvel événement porte le nom déclaré sur l'appareil, en plus du profil.
const jrAuditBase = osAuditChanges;
osAuditChanges = function (before, after) {
  const n = (after.activity || []).length, out = jrAuditBase.apply(this, arguments), me = typeof apMe === "function" ? apMe() : "";
  (after.activity || []).slice(n).forEach((e) => { if (!e.role) e.role = role().label; if (me && !e.person) e.person = me; });
  return out;
};

function jrBind(root = document) {
  const set = (k, v) => { state.jrFilter = { ...(state.jrFilter || {}), [k]: v }; state.jrShown = JR_PAGE; render(); };
  root.querySelectorAll("[data-jr-period]").forEach((b) => (b.onclick = () => set("period", b.dataset.jrPeriod)));
  root.querySelectorAll("[data-jr-type]").forEach((b) => (b.onclick = () => set("type", b.dataset.jrType)));
  root.querySelectorAll("[data-jr-who]").forEach((b) => (b.onclick = () => set("who", b.dataset.jrWho)));
  root.querySelectorAll("[data-jr-site]").forEach((b) => (b.onclick = () => set("site", b.dataset.jrSite)));
  root.querySelectorAll("[data-jr-more]").forEach((b) => (b.onclick = () => { state.jrShown = (state.jrShown || JR_PAGE) + JR_PAGE; render(); }));
  root.querySelectorAll("[data-jr-csv]").forEach((b) => (b.onclick = () => jrDownload()));
  const q = root.querySelector("#jrSearch");
  if (q) q.onchange = () => set("q", q.value);
}
const jrOsBindBase = osBind;
osBind = function () { const out = jrOsBindBase.apply(this, arguments); jrBind(document); return out; };
