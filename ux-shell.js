"use strict";
/*
 * Interface 8.0 : une seule navigation, sans pastilles.
 *   Ordinateur : le menu de gauche (Accueil, les étapes du chemin, Plus).
 *   Téléphone  : la barre du bas (Accueil et les étapes) ; « Plus » est dans le bouton de contexte.
 * En haut de page : une seule ligne d'onglets, uniquement si l'étape a plusieurs écrans.
 * Écrans et sous-onglets y sont fusionnés (Observer = Gemba · Signaux · Audits · Statistiques).
 * Aucun numéro ni compteur dans les menus : ce qui presse est sur l'accueil « Ma journée ».
 */

const UX_STAGES = [
  { id: "voir", label: "Voir", hint: "Indicateurs et rituels", views: ["pilotage", "daily", "sqcdp", "analysis", "maturity", "roadmap", "hoshin"] },
  { id: "observer", label: "Observer", hint: "Gemba, signaux, audits", views: ["terrain", "audits"] },
  { id: "resoudre", label: "Résoudre", hint: "A3, Kaizen, chantiers", views: ["resolution", "kaizen", "projects"] },
  { id: "agir", label: "Agir", hint: "Plan d’actions", views: ["actions"] },
  { id: "perenniser", label: "Pérenniser", hint: "Standards, pratiques, formation", views: ["documents", "practices", "training", "deployment"] },
];
const UX_MORE = ["tools", "account", "settings", "activity", "connectors"];
const UX_LABELS = { pilotage: "Pilotage", daily: "Aujourd’hui", sqcdp: "SQCDP", analysis: "Écarts", maturity: "Maturité", roadmap: "Roadmap", hoshin: "Hoshin", terrain: "Terrain", audits: "Audits", resolution: "A3 · 8D · QRQC", kaizen: "Kaizen", projects: "Chantiers", actions: "Plan d’actions", documents: "Standards", practices: "Bonnes pratiques", training: "Formation", deployment: "Déploiement" };
const UX_ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/>',
  voir: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  observer: '<path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  resoudre: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  agir: '<path d="m4 12.5 5 5L20 6.5"/>',
  perenniser: '<path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
};
/* Écrans dont les sous-onglets sont remontés dans la ligne d'onglets de l'étape. */
const UX_FLAT = new Set(["terrain"]);

function uxSafe(fn, fallback) { try { return fn(); } catch { return fallback; } }
function uxLabel(id) { return UX_LABELS[id] || NAV.find((n) => n.id === id)?.label || id; }
function uxIcon(id) { return `<svg class="ux-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${UX_ICONS[id] || ""}</svg>`; }
function uxAllowed() {
  return new Set(NAV.filter((n) => role().nav.includes(n.id) && !(n.id === "sqcdp" && ["dg", "lean", "director"].includes(state.role))).map((n) => n.id));
}
function uxStages() {
  const allowed = uxAllowed();
  return UX_STAGES.map((s) => ({ ...s, ids: s.views.filter((v) => allowed.has(v)) })).filter((s) => s.ids.length);
}
function uxStageOf(view) { return uxStages().find((s) => s.ids.includes(view) || s.views.includes(view)) || null; }
function uxSubIds(stage) {
  if (!stage.ids.includes(state.view) && stage.views.includes(state.view)) return [...stage.ids, state.view].sort((a, b) => stage.views.indexOf(a) - stage.views.indexOf(b));
  if (interfaceMode() === "complete") return stage.ids;
  const visible = new Set(visibleNav().map((n) => n.id));
  const ids = stage.ids.filter((id) => visible.has(id) || id === state.view);
  return ids.length ? ids : stage.ids.slice(0, 1);
}

/* Onglets d'une étape : une seule ligne, écrans et sous-onglets fusionnés. */
function uxTabs(stage) {
  if (!stage) return [];
  if (stage.id === "observer") {
    const ids = new Set(uxSubIds(stage)), out = [];
    if (ids.has("terrain")) {
      const gemba = { key: "gemba", label: "Gemba", view: "terrain", set: { terrainTab: "gemba" } };
      const signals = { key: "signals", label: "Signaux", view: "terrain", set: { terrainTab: "signals" } };
      out.push(...(["teamlead", "operator"].includes(state.role) ? [signals, gemba] : [gemba, signals]));
    }
    if (ids.has("audits")) out.push({ key: "audits", label: "Audits", view: "audits" });
    if (ids.has("terrain")) out.push({ key: "stats", label: "Statistiques", view: "terrain", set: { terrainTab: "stats" } });
    return out;
  }
  return uxSubIds(stage).map((id) => ({ key: id, label: uxLabel(id), view: id }));
}
function uxTabActive(tab) { return state.view === tab.view && Object.entries(tab.set || {}).every(([k, v]) => state[k] === v); }
function uxGo(tab) {
  if (!tab) return;
  Object.assign(state, tab.set || {});
  switchView(tab.view);
}
function uxGoStage(id) {
  const stage = uxStages().find((s) => s.id === id);
  if (!stage) return;
  const first = uxTabs(stage)[0] || { view: stage.ids[0] };
  if (uxTabActive(first)) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  uxGo(first);
}

/* Menu latéral (ordinateur) et barre du bas (téléphone) : la même navigation, sans chiffres. */
const uxRenderNavBase = renderNav;
renderNav = function () {
  uxRenderNavBase();
  const stages = uxStages(), current = state.view === "home" ? null : uxStageOf(state.view), allowed = uxAllowed(), more = UX_MORE.filter((id) => allowed.has(id));
  const first = (s) => (uxTabs(s)[0] || { view: s.ids[0] }).view;
  const mobile = $("mobileNav");
  if (mobile) {
    mobile.innerHTML = `<button class="nav-button ux-mob ${state.view === "home" ? "active" : ""}" data-nav="home" aria-current="${state.view === "home" ? "page" : "false"}">${uxIcon("home")}<span>Accueil</span></button>`
      + stages.map((s) => { const on = current?.id === s.id; return `<button class="nav-button ux-mob ${on ? "active" : ""}" data-nav="${first(s)}" data-ux-stage="${s.id}" aria-current="${on ? "page" : "false"}">${uxIcon(s.id)}<span>${esc(s.label)}</span></button>`; }).join("");
  }
  $("desktopNav").innerHTML = `<button class="nav-button ux-home ${state.view === "home" ? "active" : ""}" data-nav="home" aria-current="${state.view === "home" ? "page" : "false"}">${uxIcon("home")}<span class="nav-label">Accueil</span></button>
    <ul class="ux-path" aria-label="Le chemin : voir, observer, résoudre, agir, pérenniser">${stages.map((s) => { const on = current?.id === s.id; return `<li><button class="nav-button ux-step-btn ${on ? "active" : ""}" data-nav="${first(s)}" data-ux-stage="${s.id}" aria-current="${on ? "page" : "false"}" title="${esc(s.hint)}">${uxIcon(s.id)}<span class="nav-label">${esc(s.label)}</span></button></li>`; }).join("")}</ul>
    ${more.length ? `<details class="nav-section ux-more" ${more.includes(state.view) ? "open" : ""}><summary>Plus</summary>${more.map((id) => `<button class="nav-button ${state.view === id ? "active" : ""}" data-nav="${id}">${esc(uxLabel(id))}</button>`).join("")}</details>` : ""}`;
};

/* Ligne d'onglets en haut de page : seulement si l'étape a plusieurs écrans. */
function uxTabRow() {
  if (state.view === "home") return "";
  const stage = uxStageOf(state.view), tabs = uxTabs(stage);
  if (tabs.length > 1) return `<nav class="ux-tabs" aria-label="${esc(stage.label)}">${tabs.map((t, i) => { const on = uxTabActive(t); return `<button type="button" class="ux-tab ${on ? "active" : ""}" data-ux-tab="${i}" aria-current="${on ? "page" : "false"}">${esc(t.label)}</button>`; }).join("")}</nav>`;
  return "";
}

/* Contexte : un seul bouton, un panneau (avec « Plus » sur téléphone). */
function uxContextSummary() {
  const place = state.site === "group" ? "BIA Holding" : site().name, shop = workshop()?.name;
  return `${place}${shop ? " · " + shop : ""} · ${role().label}`;
}
function uxContextMore() {
  const panel = $("contextPanel");
  if (!panel) return;
  let box = $("contextMore");
  if (!box) { box = Object.assign(document.createElement("nav"), { id: "contextMore", className: "ux-context-more" }); box.setAttribute("aria-label", "Plus"); panel.append(box); }
  const allowed = uxAllowed(), more = UX_MORE.filter((id) => allowed.has(id));
  box.innerHTML = more.map((id) => `<button type="button" class="ux-more-link ${state.view === id ? "active" : ""}" data-nav="${id}">${esc(uxLabel(id))}</button>`).join("");
  box.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => { panel.hidden = true; $("contextButton")?.setAttribute("aria-expanded", "false"); switchView(b.dataset.nav); }));
}
function uxDecorate() {
  const loc = $("pageLocation");
  if (loc) {
    loc.innerHTML = uxTabRow();
    const stage = uxStageOf(state.view), tabs = uxTabs(stage);
    loc.querySelectorAll("[data-ux-tab]").forEach((b) => (b.onclick = () => uxGo(tabs[Number(b.dataset.uxTab)])));
    const active = loc.querySelector(".ux-tab.active");
    if (active && active.parentElement.scrollWidth > active.parentElement.clientWidth) active.parentElement.scrollLeft = Math.max(0, active.offsetLeft - 24);
  }
  document.querySelectorAll("#desktopNav [data-ux-stage], #mobileNav [data-ux-stage]").forEach((b) => (b.onclick = () => uxGoStage(b.dataset.uxStage)));
  uxHoistSections();
  uxTidyPage();
  uxContextMore();
  const summary = $("contextSummary");
  if (summary) summary.textContent = uxContextSummary();
  const foot = document.querySelector(".sidebar-foot > span:last-child");
  if (foot) foot.innerHTML = `<b>BIA LEAN OS ${esc(APP_VERSION)}</b><small>${data.meta?.demo ? "Exemples fictifs · " : ""}données sur cet appareil</small>`;
}
/*
 * Sous-onglets propres à l'écran :
 *  - écran « aplati » (Terrain) : ses onglets sont déjà dans la ligne de l'étape, on les retire de la page ;
 *  - étape à un seul écran (Agir) : ses onglets deviennent la ligne d'onglets ;
 *  - sinon ils restent dans la page, sous le titre, en sélecteur discret.
 */
function uxHoistSections() {
  const app = $("appView"), loc = $("pageLocation");
  if (!app || !loc || state.view === "home") return;
  const src = app.querySelector(":scope > .tabs, :scope > .pilotage-switch") || app.querySelector('.ap-toolbar .filters[aria-label="Vue"]');
  if (!src) return;
  if (UX_FLAT.has(state.view)) { src.remove(); return; }
  const stage = uxStageOf(state.view), inStage = new Set(stage ? uxSubIds(stage) : []);
  src.querySelectorAll("[data-nav]").forEach((b) => { if (inStage.has(b.dataset.nav) || !role().nav.includes(b.dataset.nav)) b.remove(); });
  if (src.querySelectorAll("button").length < 2) { src.remove(); return; }
  src.setAttribute("role", "group");
  if (!src.getAttribute("aria-label")) src.setAttribute("aria-label", "Sections de l’écran");
  if (loc.querySelector(".ux-tabs")) { src.classList.add("ux-seg"); return; }
  const parent = src.parentElement;
  src.classList.add("ux-tabs", "ux-sections");
  loc.append(src);
  if (parent?.classList.contains("ap-toolbar") && !parent.children.length) parent.remove();
}
/* Rangement : action égarée remise dans l'en-tête de page, longues listes repliées. */
function uxTidyPage() {
  const app = $("appView");
  if (!app) return;
  const head = app.querySelector(":scope > .page-head, :scope > .role-home > .page-head, :scope > .ap-page > .page-head");
  const stray = app.firstElementChild;
  if (head && stray && stray !== head && stray.matches("button, .btn")) head.append(stray);
  if (head) {
    const extra = [...head.children].slice(1).filter((x) => !x.classList.contains("ux-head-actions"));
    if (extra.length) {
      const box = head.querySelector(":scope > .ux-head-actions") || Object.assign(document.createElement("div"), { className: "ux-head-actions" });
      extra.forEach((x) => (x.matches(".ap-head-actions") ? box.append(...x.children) : box.append(x)));
      head.querySelector(":scope > .ap-head-actions")?.remove();
      head.append(box);
    }
    const seg = app.querySelector(":scope > .ux-seg");
    if (seg) head.after(seg);
    const tab = document.querySelector("#pageLocation .ux-tab.active"), h1 = head.querySelector("h1");
    const norm = (t) => String(t || "").trim().toLocaleLowerCase("fr");
    head.classList.toggle("ux-head-dup", !!(tab && h1 && norm(tab.textContent) === norm(h1.textContent)));
  }
  app.querySelectorAll(".os-cards").forEach((list) => {
    const items = [...list.children];
    if (items.length <= 12 || list.dataset.uxAll) return;
    items.slice(12).forEach((x) => (x.hidden = true));
    const more = document.createElement("button");
    more.type = "button"; more.className = "btn secondary ux-more-btn";
    more.textContent = `Voir les ${items.length - 12} autres`;
    more.onclick = () => { items.forEach((x) => (x.hidden = false)); list.dataset.uxAll = "1"; more.remove(); };
    list.after(more);
  });
}
const uxRenderBase = render;
render = function () { const out = uxRenderBase.apply(this, arguments); uxDecorate(); return out; };

(function uxContextPanel() {
  document.body.classList.add("ux");
  const button = $("contextButton"), panel = $("contextPanel");
  if (!button || !panel) return;
  const close = () => { panel.hidden = true; button.setAttribute("aria-expanded", "false"); };
  button.addEventListener("click", (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; button.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) panel.querySelector("select")?.focus(); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { close(); button.focus(); } });
  panel.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") setTimeout(close, 0); });
})();
