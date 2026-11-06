"use strict";
/*
 * Interface 7.8 : le chemin d'usage Lean, visible partout.
 *   Voir → Observer → Résoudre → Agir → Pérenniser
 * Le menu ne montre que l'accueil, les cinq étapes et « Plus ».
 * Chaque page affiche la barre du chemin, puis les onglets de son étape.
 * Le contexte (périmètre, atelier, profil, mode) tient dans un seul bouton.
 */

const UX_STAGES = [
  { id: "voir", label: "Voir", hint: "Indicateurs et rituels", views: ["pilotage", "daily", "sqcdp", "analysis", "maturity", "roadmap", "hoshin"] },
  { id: "observer", label: "Observer", hint: "Terrain, Gemba, audits", views: ["terrain", "audits"] },
  { id: "resoudre", label: "Résoudre", hint: "A3, Kaizen, chantiers", views: ["resolution", "kaizen", "projects"] },
  { id: "agir", label: "Agir", hint: "Plan d’actions", views: ["actions"] },
  { id: "perenniser", label: "Pérenniser", hint: "Standards, pratiques, formation", views: ["documents", "practices", "training", "deployment"] },
];
const UX_MORE = ["tools", "account", "settings", "activity", "connectors"];
const UX_LABELS = { pilotage: "Pilotage", daily: "Aujourd’hui", sqcdp: "SQCDP", analysis: "Écarts", maturity: "Maturité", roadmap: "Roadmap", hoshin: "Hoshin", terrain: "Signaux et Gemba", audits: "Audits et 5S", resolution: "A3 · 8D · QRQC", kaizen: "Idées et Kaizen", projects: "Chantiers", actions: "Plan d’actions", documents: "Standards et documents", practices: "Bonnes pratiques", training: "Formation", deployment: "Déploiement multisite" };

function uxSafe(fn, fallback) { try { return fn(); } catch { return fallback; } }
function uxLabel(id) { return UX_LABELS[id] || NAV.find((n) => n.id === id)?.label || id; }
function uxAllowed() {
  return new Set(NAV.filter((n) => role().nav.includes(n.id) && !(n.id === "sqcdp" && ["dg", "lean", "director"].includes(state.role))).map((n) => n.id));
}
function uxStages() {
  const allowed = uxAllowed();
  return UX_STAGES.map((s) => ({ ...s, ids: s.views.filter((v) => allowed.has(v)) })).filter((s) => s.ids.length).map((s, i) => ({ ...s, n: i + 1 }));
}
function uxStageOf(view) { return uxStages().find((s) => s.ids.includes(view) || s.views.includes(view)) || null; }
function uxSubIds(stage) {
  if (!stage.ids.includes(state.view) && stage.views.includes(state.view)) return [...stage.ids, state.view].sort((a, b) => stage.views.indexOf(a) - stage.views.indexOf(b));
  if (interfaceMode() === "complete") return stage.ids;
  const visible = new Set(visibleNav().map((n) => n.id));
  const ids = stage.ids.filter((id) => visible.has(id) || id === state.view);
  return ids.length ? ids : stage.ids.slice(0, 1);
}

function uxStageStatus(id) {
  const ok = (text) => ({ n: 0, tone: "ok", text });
  if (id === "voir") {
    const sites = state.site === "group" ? OPERATIONAL_SITES.map((s) => s.id) : [state.site];
    let gap = 0;
    for (const siteId of sites) for (const k of osActive(data.kpis || [])) if (osStatus(osLatest(siteId, k.id), k) === "gap") gap++;
    return gap ? { n: gap, tone: "warn", text: `${gap} indicateur${gap > 1 ? "s" : ""} en écart` } : ok("Indicateurs dans la cible");
  }
  if (id === "observer") {
    const open = scoped(data.signals).filter(isOpenSignal), critical = open.filter((s) => s.severity === "Critique").length;
    return open.length ? { n: open.length, tone: critical ? "alert" : "warn", text: `${open.length} signa${open.length > 1 ? "ux" : "l"} ouvert${open.length > 1 ? "s" : ""}${critical ? `, dont ${critical} critique${critical > 1 ? "s" : ""}` : ""}` } : ok("Aucun signal ouvert");
  }
  if (id === "resoudre") {
    const open = scoped(data.problems || []).filter((p) => p.status !== "Clos").length;
    return open ? { n: open, tone: "info", text: `${open} problème${open > 1 ? "s" : ""} en cours de résolution` } : ok("Aucun problème ouvert");
  }
  if (id === "agir") {
    const open = scoped(data.actions).filter(isOpenAction), late = open.filter(isLate).length;
    if (late) return { n: late, tone: "alert", text: `${late} action${late > 1 ? "s" : ""} en retard sur ${open.length}` };
    return open.length ? { n: open.length, tone: "info", text: `${open.length} action${open.length > 1 ? "s" : ""} ouverte${open.length > 1 ? "s" : ""}, aucune en retard` } : ok("Aucune action ouverte");
  }
  if (id === "perenniser") {
    const rows = scoped(data.actions), verify = rows.filter((a) => a.status === "À vérifier").length;
    const reviews = uxSafe(() => rows.filter((a) => a.sustainment && osReviewStatus(a).due.length).length, 0), n = verify + reviews;
    return n ? { n, tone: "warn", text: [verify ? `${verify} à vérifier` : "", reviews ? `${reviews} contrôle${reviews > 1 ? "s" : ""} de tenue` : ""].filter(Boolean).join(" · ") } : ok("Rien à vérifier");
  }
  return ok("");
}
let uxCache = null;
function uxStatus(id) {
  if (uxCache?.has(id)) return uxCache.get(id);
  const value = uxSafe(() => uxStageStatus(id), { n: 0, tone: "ok", text: "" });
  uxCache?.set(id, value);
  return value;
}

/* Menu latéral : accueil, le chemin en cinq étapes, puis « Plus ». */
const uxRenderNavBase = renderNav;
renderNav = function () {
  uxRenderNavBase();
  const stages = uxStages(), current = uxStageOf(state.view), allowed = uxAllowed(), more = UX_MORE.filter((id) => allowed.has(id));
  const step = (s) => {
    const st = uxStatus(s.id), active = current?.id === s.id;
    return `<li class="ux-step ${active ? "active" : ""}"><button class="nav-button ux-step-btn ${active ? "active" : ""}" data-nav="${s.ids[0]}" aria-current="${active ? "step" : "false"}">
      <span class="ux-step-n" aria-hidden="true">${s.n}</span><span class="ux-step-text"><b>${esc(s.label)}</b><small>${esc(s.hint)}</small></span>
      ${st.n ? `<span class="ux-count ${st.tone === "alert" ? "nav-badge" : ""} tone-${st.tone}" aria-label="${esc(st.text)}">${st.n}</span>` : ""}</button>
      </li>`;
  };
  const mobile = $("mobileNav");
  if (mobile) {
    const home = stages.length < 5 ? `<button class="nav-button ux-mob ${state.view === "home" ? "active" : ""}" data-nav="home"><span class="nav-icon">${navIconSvg("home")}</span>Accueil</button>` : "";
    mobile.innerHTML = home + stages.map((s) => {
      const st = uxStatus(s.id), active = current?.id === s.id;
      return `<button class="nav-button ux-mob ${active ? "active" : ""}" data-nav="${active ? state.view : s.ids[0]}" aria-current="${active ? "step" : "false"}"><span class="ux-mob-n" aria-hidden="true">${s.n}</span>${esc(s.label)}${st.tone === "alert" && st.n ? `<span class="nav-badge" aria-label="${esc(st.text)}">${st.n}</span>` : ""}</button>`;
    }).join("");
  }
  $("desktopNav").innerHTML = `<button class="nav-button ux-home ${state.view === "home" ? "active" : ""}" data-nav="home"><span class="nav-icon">${navIconSvg("home")}</span><span class="nav-label">Accueil</span></button>
    <p class="ux-nav-title">Le chemin</p><ol class="ux-path">${stages.map(step).join("")}</ol>
    ${more.length ? `<details class="nav-section ux-more" ${more.includes(state.view) ? "open" : ""}><summary>Plus</summary>${more.map((id) => `<button class="nav-button ${state.view === id ? "active" : ""}" data-nav="${id}"><span class="nav-icon">${navIconSvg(id)}</span>${esc(uxLabel(id))}</button>`).join("")}</details>` : ""}`;
};

/* Barre du chemin en haut de chaque page, puis les onglets de l'étape. */
function uxPathBar() {
  const stages = uxStages(), current = uxStageOf(state.view);
  const steps = stages.map((s, i) => {
    const st = uxStatus(s.id), active = current?.id === s.id;
    return `${i ? '<span class="ux-pb-arrow" aria-hidden="true">›</span>' : ""}<button type="button" class="ux-pb-step ${active ? "active" : ""} tone-${st.tone}" data-nav="${active ? state.view : s.ids[0]}" aria-current="${active ? "step" : "false"}" title="${esc(`${s.label} · ${st.text}`)}"><span class="ux-pb-n">${s.n}</span><span class="ux-pb-label">${esc(s.label)}</span>${st.n ? `<span class="ux-pb-count" aria-label="${esc(st.text)}">${st.n}</span>` : ""}</button>`;
  }).join("");
  const subs = current ? uxSubIds(current) : [];
  const tabs = subs.length > 1 ? `<div class="ux-tabs" aria-label="${esc(current.label)}">${subs.map((id) => `<button type="button" class="ux-tab ${state.view === id ? "active" : ""}" data-nav="${id}" aria-current="${state.view === id ? "page" : "false"}">${esc(uxLabel(id))}</button>`).join("")}</div>` : "";
  const here = !current && state.view !== "home" ? `<span class="ux-pb-here">${esc(uxLabel(state.view))}</span>` : "";
  return `<nav class="ux-pathbar" aria-label="Le chemin : voir, observer, résoudre, agir, pérenniser">${steps}${here}</nav>${tabs}`;
}

/* Accueil : le chemin en grandes tuiles, à la place des trois compteurs. */
homeCards = function () {
  const stages = uxStages();
  return `<section class="ux-home-path section" aria-label="Le chemin">
    <div class="ux-home-path-head"><h2>Le chemin</h2><p class="hint">Voir l’écart, aller sur le terrain, comprendre, agir, puis pérenniser. Chaque étape montre ce qui vous attend.</p></div>
    <ol class="ux-tiles">${stages.map((s) => { const st = uxStatus(s.id); return `<li><button type="button" class="ux-tile tone-${st.tone}" data-nav="${s.ids[0]}"><span class="ux-tile-top"><span class="ux-tile-n">${s.n}</span><b>${esc(s.label)}</b></span><span class="ux-tile-count">${st.n}</span><span class="ux-tile-text">${esc(st.text)}</span><small>${esc(s.hint)}</small></button></li>`; }).join("")}</ol>
  </section>`;
};

/* Contexte : un seul bouton, un panneau. */
function uxContextSummary() {
  const place = state.site === "group" ? "BIA Holding" : site().name, shop = workshop()?.name;
  return `${place}${shop ? " · " + shop : ""} · ${role().label}`;
}
function uxDecorate() {
  const loc = $("pageLocation");
  if (loc) {
    loc.innerHTML = state.view === "home" ? "" : uxPathBar();
    loc.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => switchView(b.dataset.nav)));
    const active = loc.querySelector(".ux-pb-step.active");
    if (active) active.parentElement.scrollLeft = Math.max(0, active.offsetLeft - 16);
  }
  uxHoistSections();
  uxTidyPage();
  const summary = $("contextSummary");
  if (summary) summary.textContent = uxContextSummary();
  const foot = document.querySelector(".sidebar-foot > span:last-child");
  if (foot) foot.innerHTML = `<b>BIA LEAN OS ${esc(APP_VERSION)}</b><small>${data.meta?.demo ? "Exemples fictifs · " : ""}données sur cet appareil</small>`;
}
/* Les onglets propres à l'écran remontent sous la barre du chemin (même place, même style partout). */
function uxHoistSections() {
  const app = $("appView"), loc = $("pageLocation");
  if (!app || !loc || state.view === "home") return;
  const src = app.querySelector(":scope > .tabs, :scope > .pilotage-switch") || app.querySelector('.ap-toolbar .filters[aria-label="Vue"]');
  if (!src) return;
  const stage = uxStageOf(state.view), inStage = new Set(stage ? uxSubIds(stage) : []);
  src.querySelectorAll("[data-nav]").forEach((b) => { if (inStage.has(b.dataset.nav) || !role().nav.includes(b.dataset.nav)) b.remove(); });
  if (src.querySelectorAll("button").length < 2) return;
  src.classList.add("ux-sections");
  src.setAttribute("role", "group");
  if (!src.getAttribute("aria-label")) src.setAttribute("aria-label", "Sections de l’écran");
  loc.append(src);
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
    const remind = app.querySelector(":scope > .ap-remind");
    if (remind) head.after(remind);
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
render = function () { uxCache = new Map(); try { const out = uxRenderBase.apply(this, arguments); uxDecorate(); return out; } finally { uxCache = null; } };

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
