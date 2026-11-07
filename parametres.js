"use strict";
/*
 * BIA Lean OS 8.31 · Paramètres : ce que l'appli doit connaître, et ce qui manque encore.
 *  - « État du paramétrage » en tête : responsables de site, ateliers, personnes, propriétaires et définitions
 *    des indicateurs, seuils cohérents, relevés à jour, décideurs d'escalade, équipes de relève.
 *    Chaque point manquant nomme les sites ou indicateurs concernés et mène à l'onglet qui le corrige.
 *  - Onglets : Sites, Ateliers et zones (regroupés par site), Personnes (par site), Indicateurs (fiche lisible :
 *    sens, cible, seuils en barre, définition, propriétaire, sites mesurés), Questionnaires, Règles.
 *  - Les formulaires d'ajout et de modification restent ceux du référentiel ; « + Atelier » et « + Zone »
 *    sont pré-remplis avec le site et l'atelier.
 * Données : aucune nouvelle ; les référentiels sites, workshops, zones, users, kpis, auditTemplates et settings.
 */

const PM_TABS = [["sites", "Sites"], ["workshops", "Ateliers et zones"], ["users", "Personnes"], ["kpis", "Indicateurs"], ["auditTemplates", "Questionnaires"], ["rules", "Règles"]];
const PM_FRESH = { Quotidien: 7, Hebdomadaire: 14, Mensuel: 45 };
const PM_AXIS = { S: "Sécurité", Q: "Qualité", C: "Coût", D: "Délai", P: "Personnel" };

function pmTab() { const t = state.adminTab === "zones" ? "workshops" : state.adminTab; return PM_TABS.some(([k]) => k === t) ? t : "sites"; }
function pmBlank(v) { return !String(v ?? "").trim() || /^à (attribuer|définir|préciser)$/i.test(String(v).trim()); }
function pmAge(date) { return date ? Math.floor((Date.parse(today() + "T12:00:00Z") - Date.parse(String(date).slice(0, 10) + "T12:00:00Z")) / 86400000) : Infinity; }
function pmThresholdsOk(k) {
  if (![k.target, k.green, k.orange].every(osFinite)) return false;
  return k.direction === "high" ? k.green >= k.orange : k.green <= k.orange;
}
function pmList(items, n = 3) { return items.length ? items.slice(0, n).join(", ") + (items.length > n ? ` et ${items.length - n} autre${items.length - n > 1 ? "s" : ""}` : "") : ""; }

/* ---------- État du paramétrage ---------- */

function pmChecks() {
  const sites = OPERATIONAL_SITES, kpis = osActive(data.kpis), users = osActive(data.users).filter((u) => u.active !== false && u.active !== "false");
  const ws = osActive(data.workshops), out = [];
  const add = (id, ok, label, todo, tab, n = 0) => out.push({ id, ok, label, todo, tab, n });
  const noOwner = sites.filter((s) => pmBlank(osRecord(s.id)?.row.owner)).map((s) => s.name);
  add("siteOwner", !noOwner.length, "Chaque site a un responsable", `À nommer : ${pmList(noOwner)}`, "sites", noOwner.length);
  const noWs = sites.filter((s) => !ws.some((w) => w.site_id === s.id)).map((s) => s.name);
  add("workshops", !noWs.length, "Chaque site a au moins un atelier", `Sans atelier : ${pmList(noWs)}`, "workshops", noWs.length);
  const noUser = sites.filter((s) => !users.some((u) => u.site_id === s.id)).map((s) => s.name);
  add("users", !noUser.length, "Chaque site a au moins une personne déclarée", `Aucune personne déclarée : ${pmList(noUser)}`, "users", noUser.length);
  const kOwner = kpis.filter((k) => pmBlank(k.owner)).map((k) => k.name);
  add("kpiOwner", !kOwner.length, "Chaque indicateur a un propriétaire", `Sans propriétaire : ${pmList(kOwner)}`, "kpis", kOwner.length);
  const kDef = kpis.filter((k) => pmBlank(k.definition) || pmBlank(k.formula) || pmBlank(k.source)).map((k) => k.name);
  add("kpiDef", !kDef.length, "Chaque indicateur a sa définition, sa formule et sa source", `À compléter : ${pmList(kDef)}`, "kpis", kDef.length);
  const kThr = kpis.filter((k) => !pmThresholdsOk(k)).map((k) => k.name);
  add("kpiThr", !kThr.length, "Les seuils vert et orange sont cohérents avec la cible et le sens", `À revoir : ${pmList(kThr)}`, "kpis", kThr.length);
  const stale = [];
  for (const s of sites) for (const k of kpis) { const m = osLatest(s.id, k.id); if (pmAge(m?.period) > (PM_FRESH[k.frequency] || 14)) stale.push(`${s.name} · ${typeof inShort === "function" ? inShort(k) : k.name}`); }
  add("fresh", !stale.length, "Les relevés sont à jour (selon la fréquence de chaque indicateur)", `${jnPlural(stale.length, "relevé manquant ou ancien", "relevés manquants ou anciens")} : ${pmList(stale)}`, "pilotage", stale.length);
  const esc2 = [2, 3, 4].filter((n) => pmBlank(data.settings?.escalationOwners?.[n]));
  add("escalation", !esc2.length, "Les décideurs d’escalade N2, N3 et N4 sont nommés", `À nommer : ${esc2.map((n) => `N${n}`).join(", ")}`, "rules", esc2.length);
  const shifts = (data.settings?.shifts || []).filter((x) => String(x).trim());
  add("shifts", shifts.length >= 2, "Les équipes de relève sont définies", "Au moins deux équipes pour la relève", "rules", shifts.length >= 2 ? 0 : 1);
  return out;
}
function pmHealth(tab = "sites") {
  const checks = pmChecks(), ok = checks.filter((c) => c.ok).length, all = checks.filter((c) => !c.ok), full = tab === "sites", todo = full ? all : all.filter((c) => c.tab === tab), others = all.length - todo.length;
  return `<section class="panel pm-health ${todo.length ? "" : "all-ok"}"><div class="pm-health-head"><div><h2>État du paramétrage</h2><p class="hint">${!all.length ? "Tout est en place." : full ? "Ce qui manque pour que les écrans disent vrai." : todo.length ? "À compléter dans cet onglet :" : "Rien à compléter dans cet onglet."}</p></div><b class="pm-score">${ok}<small>/${checks.length}</small></b></div>
    <div class="pm-bar" role="img" aria-label="${ok} points sur ${checks.length} en ordre"><span style="width:${Math.round((ok / checks.length) * 100)}%"></span></div>
    ${todo.length ? `<ul class="pm-todo">${todo.map((c) => `<li><div><b>${esc(c.label)}</b><span>${esc(c.todo)}</span></div><button type="button" class="btn secondary small" data-pm-fix="${esc(c.tab)}">${c.tab === "pilotage" ? "Voir le pilotage" : "Corriger"}</button></li>`).join("")}</ul>` : ""}
    ${!full && others ? `<button type="button" class="btn ghost small pm-others" data-pm-fix="sites">${jnPlural(others, "autre point à compléter", "autres points à compléter")}</button>` : ""}
    ${full && ok ? `<details class="pm-okd"><summary>En ordre · ${ok}</summary><ul>${checks.filter((c) => c.ok).map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul></details>` : ""}</section>`;
}

/* ---------- Onglets ---------- */

function pmEdit(key, id, label = "Modifier") { return osButton(label, "edit", { key, id }); }
function pmNew(key, label, preset = {}, primary = false) { return osButton(label, "new", { key, preset }, !primary); }
function pmSites() {
  const ws = osActive(data.workshops), zs = osActive(data.zones), us = osActive(data.users);
  const rows = osActive(data.sites).slice().sort((a, b) => (a.kind === "group" ? -1 : b.kind === "group" ? 1 : String(a.name).localeCompare(String(b.name), "fr")));
  return `<div class="pm-head">${listSearch("Rechercher un site")}${pmNew("sites", "+ Site", {}, true)}</div><div class="pm-grid">${rows.map((s) => {
    const group = s.kind === "group", w = ws.filter((x) => x.site_id === s.id).length, z = zs.filter((x) => x.site_id === s.id).length, u = us.filter((x) => x.site_id === s.id && x.active !== false).length;
    const last = group ? null : osActive(data.measures).filter((m) => m.site_id === s.id && m.period).map((m) => m.period).sort().at(-1);
    return `<article class="pm-card" data-search-row><header><div><small>${group ? "Holding · périmètre Groupe" : "Site"}</small><h3>${esc(s.name)}</h3></div>${pmEdit("sites", s.id)}</header>
      <p class="${pmBlank(s.owner) ? "pm-miss" : ""}">${pmBlank(s.owner) ? "Responsable à nommer" : `Responsable : ${esc(s.owner)}`}</p>
      <p class="pm-facts">${group ? jnPlural(u, "personne au Groupe", "personnes au Groupe") : `${jnPlural(w, "atelier", "ateliers")} · ${jnPlural(z, "zone", "zones")} · ${jnPlural(u, "personne", "personnes")}${last ? ` · dernier relevé le ${shortDate(last)}` : " · aucun relevé"}`}</p></article>`;
  }).join("")}</div>`;
}
function pmWorkshops() {
  const ws = osActive(data.workshops), zs = osActive(data.zones);
  return `<div class="pm-head">${listSearch("Rechercher un atelier ou une zone")}</div>${OPERATIONAL_SITES.map((s) => {
    const mine = ws.filter((w) => w.site_id === s.id);
    return `<section class="pm-group" data-search-row><div class="pm-group-head"><h3>${esc(s.name)}</h3>${pmNew("workshops", "+ Atelier", { site_id: s.id })}</div>${mine.length ? `<ul class="pm-rows">${mine.map((w) => {
      const zones = zs.filter((z) => z.workshop_id === w.id);
      return `<li><div class="pm-row-main"><b>${esc(w.name)}</b><span>${pmBlank(w.owner) ? "Responsable : —" : `Responsable : ${esc(w.owner)}`}</span>${zones.length ? `<span class="pm-zones">${zones.map((z) => `<button type="button" class="pm-zone" data-os="edit" data-args="${esc(JSON.stringify({ key: "zones", id: z.id }))}">${esc(z.name)}</button>`).join("")}</span>` : '<span class="hint">Aucune zone : le site et l’atelier suffisent pour commencer.</span>'}</div><div class="pm-row-act">${pmEdit("workshops", w.id)}${pmNew("zones", "+ Zone", { site_id: s.id, workshop_id: w.id })}</div></li>`;
    }).join("")}</ul>` : `<p class="pm-miss">Aucun atelier : signaux, Gemba et relevés restent au niveau du site.</p>`}</section>`;
  }).join("")}`;
}
function pmUsers() {
  const us = osActive(data.users), groups = [{ id: "group", name: "Groupe" }, ...OPERATIONAL_SITES];
  return `<div class="pm-head">${listSearch("Rechercher une personne")}${pmNew("users", "+ Personne", {}, true)}</div><p class="hint pm-note">Profils locaux : ils servent aux listes et aux rappels, ils ne remplacent pas une authentification serveur.</p>${groups.map((g) => {
    const mine = us.filter((u) => (u.site_id || "group") === g.id);
    if (!mine.length && g.id === "group") return "";
    return `<section class="pm-group"><div class="pm-group-head"><h3>${esc(g.name)}</h3>${g.id !== "group" ? pmNew("users", "+ Personne", { site_id: g.id }) : ""}</div>${mine.length ? `<ul class="pm-rows">${mine.map((u) => {
      const active = u.active !== false && u.active !== "false";
      return `<li data-search-row><div class="pm-row-main"><b>${esc(u.name)}</b><span>${esc(ROLES[u.role]?.label || u.role || "Profil à choisir")}${u.email ? ` · ${esc(u.email)}` : ""}</span></div><div class="pm-row-act">${active ? "" : pill("Inactif", "neutral")}${pmEdit("users", u.id)}</div></li>`;
    }).join("")}</ul>` : '<p class="pm-miss">Aucune personne déclarée.</p>'}</section>`;
  }).join("")}`;
}
function pmScale(k) {
  if (!pmThresholdsOk(k)) return '<p class="pm-miss">Seuils incohérents : vert et orange à revoir selon le sens.</p>';
  const u = typeof inUnit === "function" ? inUnit(k) : k.unit, high = k.direction === "high";
  const zones = high ? [["gap", `< ${osNum(k.orange)}`], ["warn", `${osNum(k.orange)} à ${osNum(k.green)}`], ["ok", `≥ ${osNum(k.green)}`]] : [["ok", `≤ ${osNum(k.green)}`], ["warn", `${osNum(k.green)} à ${osNum(k.orange)}`], ["gap", `> ${osNum(k.orange)}`]];
  const shown = k.green === k.orange ? zones.filter(([t]) => t !== "warn") : zones;
  return `<div class="pm-scale" aria-label="${esc(osThresholdText(k))}">${shown.map(([t, l]) => `<span class="${t}">${esc(l)}${u ? ` ${esc(u)}` : ""}</span>`).join("")}</div>`;
}
function pmKpis() {
  const kpis = osActive(data.kpis).slice().sort((a, b) => "SQCDP".indexOf(a.axis) - "SQCDP".indexOf(b.axis));
  return `<div class="pm-head">${listSearch("Rechercher un indicateur")}${pmNew("kpis", "+ Indicateur", {}, true)}</div><div class="pm-grid">${kpis.map((k) => {
    const sites = OPERATIONAL_SITES.filter((s) => osLatest(s.id, k.id)), last = sites.map((s) => osLatest(s.id, k.id).period).sort().at(-1), u = typeof inUnit === "function" ? inUnit(k) : k.unit;
    const miss = [pmBlank(k.owner) ? "propriétaire" : "", pmBlank(k.definition) ? "définition" : "", pmBlank(k.formula) ? "formule" : "", pmBlank(k.source) ? "source" : ""].filter(Boolean);
    return `<article class="pm-card pm-kpi" data-search-row><header><div><small><span class="pm-axis a-${esc(k.axis || "")}">${esc(k.axis || "?")}</span> ${esc(PM_AXIS[k.axis] || "Axe à choisir")} · ${esc(k.frequency || "fréquence ?")}</small><h3>${esc(k.name)}</h3></div>${pmEdit("kpis", k.id)}</header>
      <p class="pm-target">Cible <b>${osNum(k.target)}${u ? ` ${esc(u)}` : ""}</b> · ${k.direction === "high" ? "plus est mieux" : "moins est mieux"}</p>${pmScale(k)}
      ${k.definition ? `<p class="pm-def">${esc(k.definition)}</p>` : ""}
      <dl class="pm-dl"><div><dt>Formule</dt><dd>${esc(k.formula || "—")}</dd></div><div><dt>Source</dt><dd>${esc(k.source || "—")}</dd></div><div><dt>Propriétaire</dt><dd class="${pmBlank(k.owner) ? "pm-miss" : ""}">${pmBlank(k.owner) ? "À nommer" : esc(k.owner)}</dd></div></dl>
      <p class="pm-facts">${sites.length ? `Mesuré sur ${jnPlural(sites.length, "site", "sites")} · dernier relevé le ${shortDate(last)}` : "Aucun relevé"}${miss.length ? ` · <span class="pm-miss">à compléter : ${esc(miss.join(", "))}</span>` : ""}</p></article>`;
  }).join("") || empty("Aucun indicateur actif.")}</div>`;
}
function pmTemplates() {
  const rows = osActive(data.auditTemplates);
  return `<div class="pm-head">${listSearch("Rechercher un questionnaire")}${pmNew("auditTemplates", "+ Questionnaire", {}, true)}</div><ul class="pm-rows pm-solo">${rows.map((t) => `<li data-search-row><div class="pm-row-main"><b>${esc(t.name || t.title || t.id)}</b><span>${jnPlural((t.questions || []).length, "question", "questions")}${t.type ? ` · ${esc(t.type)}` : ""}${t.site_id && t.site_id !== "group" ? ` · ${esc(getSiteName(t.site_id))}` : ""}</span></div><div class="pm-row-act">${pmEdit("auditTemplates", t.id)}</div></li>`).join("") || "<li>Aucun questionnaire.</li>"}</ul>`;
}
function pmPage() {
  const tab = pmTab(), base = typeof pmAdminBase === "function" ? pmAdminBase() : "";
  const backups = (base.match(/<section class="panel section"><h2>Données et sauvegardes<\/h2>[\s\S]*<\/section>$/) || [""])[0];
  const tabs = `<div class="tabs pm-tabs" role="tablist">${PM_TABS.map(([k, l]) => `<button type="button" class="tab ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-pm-tab="${k}">${l}</button>`).join("")}</div>`;
  const body = { sites: pmSites, workshops: pmWorkshops, users: pmUsers, kpis: pmKpis, auditTemplates: pmTemplates, rules: osRulesView }[tab]();
  return `${pageHead("Administration", "Paramètres", "Sites, ateliers, personnes, indicateurs et règles : ce que l’appli doit connaître pour dire vrai.")}${pmHealth(tab)}${tabs}<div class="pm-body">${body}</div>${backups}`;
}

/* ---------- Branchements ---------- */

const pmAdminBase = renderOSAdmin;
renderOSAdmin = function () { return pmPage(); };

function pmBind(root = document) {
  root.querySelectorAll("[data-pm-tab]").forEach((b) => (b.onclick = () => { state.adminTab = b.dataset.pmTab; render(); }));
  root.querySelectorAll("[data-pm-fix]").forEach((b) => (b.onclick = () => {
    const tab = b.dataset.pmFix;
    if (tab === "pilotage") { state.pilotageMode = "analysis"; state.osTab = "tower"; return switchView("pilotage"); }
    state.adminTab = tab; render();
    document.querySelector(".pm-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }));
}
const pmOsBindBase = osBind;
osBind = function () { const out = pmOsBindBase.apply(this, arguments); pmBind(document); return out; };
