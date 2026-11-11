"use strict";
/*
 * BIA Lean OS 8.42 · Ergonomie de navigation.
 *  - Onglets sur téléphone : au-delà de cinq, les premiers (et l'onglet ouvert) restent visibles, les autres passent dans
 *    « Plus », une liste en grand. Fini la rangée de dix onglets qu'on fait glisser sans les voir.
 *  - Pages longues : un sommaire de chips en haut (les titres de la page) pour sauter à une section, et un bouton
 *    « Haut de page » qui apparaît quand on a fait défiler.
 *  - Accueil : « Nouveau dans l'application », les écrans arrivés depuis la dernière visite, chacun à un geste,
 *    selon le profil ; « J'ai vu » le range jusqu'à la prochaine nouveauté.
 */

const ER_NEWS = [
  { v: "8.41", label: "Tour de contrôle", text: "Tous les sites et tous les indicateurs sur un écran, alertes classées, mode télévision.", nav: "pilotage", set: { pilotTab: "tour" } },
  { v: "8.40", label: "Échantillothèque", text: "Ce qui passe ou pas : photos accepté, limite, refusé, tolérances par site et par client.", nav: "documents", set: { echOn: true } },
  { v: "8.38", label: "Non-conformités", text: "Scanner la commande : analyse automatique, 8D prérempli, réclamations client et délais de réponse.", nav: "kaizen", set: { ncOn: true } },
  { v: "8.37", label: "Gains", text: "Avant, objectif, après ; sept types de gains ; euros par an face à l’objectif.", nav: "pilotage", set: { pilotTab: "gains" } },
  { v: "8.37", label: "Environnement", text: "Énergie, eau, déchets, CO₂ par unité produite ; incidents et obligations.", nav: "pilotage", set: { pilotTab: "env" } },
  { v: "8.36", label: "TRS des feuilles de poste", text: "La feuille de poste saisie, le TRS calculé et envoyé au pilotage ; micro-arrêts d’un geste.", nav: "terrain", set: { terrainTab: "micro" } },
];
const ER_SEEN_KEY = "bia-news-seen";
const ER_PHONE = 820, ER_TABS = 5, ER_SHOW = 4;
function erItem(n, i) { return `<button type="button" class="er-news-item" data-er-news="${i}"><b>${esc(n.label)}</b><span>${esc(n.text)}</span><small>Ouvrir ›</small></button>`; }

function erPhone() { return window.innerWidth <= ER_PHONE; }
function erSeen() { try { return localStorage.getItem(ER_SEEN_KEY) || ""; } catch { return ""; } }
function erSetSeen(v) { try { localStorage.setItem(ER_SEEN_KEY, v); } catch { /* stockage indisponible */ } }
function erNews() { const seen = erSeen(); return ER_NEWS.filter((n) => role().nav.includes(n.nav) && (!seen || n.v.localeCompare(seen, undefined, { numeric: true }) > 0)); }
function erGo(n) { if (!role().nav.includes(n.nav)) return; switchView(n.nav); Object.assign(state, n.set || {}); render(); scrollTo(0, 0); }

/* ---------- Onglets : « Plus » sur téléphone ---------- */
const erTabRowBase = uxTabRow;
uxTabRow = function () {
  const html = erTabRowBase.apply(this, arguments);
  // 8.48.2 : plus de bouton « Plus » ; tous les onglets restent visibles et la barre défile au doigt.
  return html;
  // eslint-disable-next-line no-unreachable
  const stage = uxStageOf(state.view), tabs = uxTabs(stage);
  if (tabs.length <= ER_TABS) return html;
  const act = tabs.findIndex((t) => uxTabActive(t));
  let shown = [0, 1, 2, 3];
  if (act > 3) shown = [0, 1, 2, act];
  const rest = tabs.length - shown.length;
  return `<nav class="ux-tabs er-tabs" aria-label="${esc(stage.label)}">${shown.map((i) => { const t = tabs[i], on = i === act; return `<button type="button" class="ux-tab ${on ? "active" : ""}" data-ux-tab="${i}" aria-current="${on ? "page" : "false"}">${esc(t.label)}</button>`; }).join("")}<button type="button" class="ux-tab er-more" data-er-tabmore aria-haspopup="dialog">Plus · ${rest}</button></nav>`;
};
function erTabSheet() {
  const stage = uxStageOf(state.view), tabs = uxTabs(stage), act = tabs.findIndex((t) => uxTabActive(t));
  modal(stage.label, `<div class="er-sheet">${tabs.map((t, i) => `<button type="button" class="er-sheet-btn ${i === act ? "active" : ""}" data-er-tab="${i}" aria-current="${i === act ? "page" : "false"}">${esc(t.label)}</button>`).join("")}</div>`);
  $("modalContent").querySelectorAll("[data-er-tab]").forEach((b) => (b.onclick = () => { closeModal(); uxGo(tabs[Number(b.dataset.erTab)]); scrollTo(0, 0); }));
}
let erWasPhone = erPhone();
window.addEventListener("resize", () => { const p = erPhone(); if (p !== erWasPhone) { erWasPhone = p; render(); } });

/* ---------- Pages longues : sommaire et haut de page ---------- */
function erJump() {
  const av = document.getElementById("appView");
  if (!av || av.querySelector(".er-jump") || state.view === "home" || state.pilotTab === "tour") return;
  const heads = [...av.querySelectorAll(":scope h2, :scope section > .section-title h2, :scope section > h2")].filter((h) => h.offsetParent && h.textContent.trim() && !h.closest(".modal, details:not([open]), .page-head"));
  const uniq = [...new Map(heads.map((h) => [h.textContent.trim(), h])).values()];
  if (uniq.length < 4 || document.documentElement.scrollHeight < window.innerHeight * 3.2) return;
  uniq.forEach((h, i) => { if (!h.id) h.id = `er-s${i}`; });
  const nav = document.createElement("nav");
  nav.className = "er-jump"; nav.setAttribute("aria-label", "Sur cette page");
  nav.innerHTML = `<span>Sur cette page</span>${uniq.slice(0, 10).map((h) => `<button type="button" class="chip" data-er-jump="${esc(h.id)}">${esc(h.textContent.trim().replace(/\s*·\s*\d+$/, "").slice(0, 34))}</button>`).join("")}`;
  const head = av.querySelector(".page-head");
  if (head) head.after(nav); else av.prepend(nav);
  nav.querySelectorAll("[data-er-jump]").forEach((b) => (b.onclick = () => document.getElementById(b.dataset.erJump)?.scrollIntoView({ behavior: "smooth", block: "start" })));
}
function erTopButton() {
  let b = document.getElementById("erTop");
  if (!b) {
    b = Object.assign(document.createElement("button"), { id: "erTop", type: "button", className: "er-top", textContent: "↑ Haut de page" });
    b.hidden = true; b.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
    document.body.appendChild(b);
    window.addEventListener("scroll", () => { b.hidden = window.scrollY < window.innerHeight * 1.5 || document.body.classList.contains("tr-full"); }, { passive: true });
  }
  b.hidden = window.scrollY < window.innerHeight * 1.5;
}

/* ---------- Accueil : nouveautés ---------- */
const erHomeBase = renderHome;
renderHome = function () {
  const html = erHomeBase.apply(this, arguments), news = erNews();
  if (!news.length) return html;
  const card = `<section class="er-news section" aria-label="Nouveau dans l’application"><div class="er-news-head"><h2>Nouveau dans l’application</h2><button type="button" class="btn ghost small" data-er-seen>J’ai vu</button></div><div class="er-news-list">${news.slice(0, ER_SHOW).map(erItem).join("")}</div>${news.length > ER_SHOW ? `<details class="er-news-more"><summary>Voir les ${news.length - ER_SHOW} autres nouveautés</summary><div class="er-news-list">${news.slice(ER_SHOW).map((n, i) => erItem(n, i + ER_SHOW)).join("")}</div></details>` : ""}</section>`;
  const i = html.indexOf("</header>");
  return i > 0 && i < 1200 ? html.slice(0, i + 9) + card + html.slice(i + 9) : card + html;
};

function erBind(root = document) {
  root.querySelectorAll("[data-er-seen]").forEach((b) => (b.onclick = () => { erSetSeen(ER_NEWS[0].v); render(); }));
  const news = erNews();
  root.querySelectorAll("[data-er-news]").forEach((b) => (b.onclick = () => { const n = news[Number(b.dataset.erNews)]; if (n) erGo(n); }));
  erJump();
  erTopButton();
}
const erOsBindBase = osBind;
osBind = function () { const out = erOsBindBase.apply(this, arguments); erBind(document); erTabsReveal(); setTimeout(() => erTabsReveal(), 0); return out; };
// L’onglet actif reste visible ; un dégradé indique qu’il y a d’autres onglets à faire défiler.
function erTabsReveal(root = document) {
  root.querySelectorAll(".ux-tabs").forEach((n) => {
    const a = n.querySelector(".ux-tab.active");
    if (a && n.scrollWidth > n.clientWidth) n.scrollLeft = Math.max(0, a.offsetLeft - n.offsetLeft - 24);
    const mark = () => { const more = n.scrollWidth - n.clientWidth > 4; n.classList.toggle("er-scroll-right", more && n.scrollLeft + n.clientWidth < n.scrollWidth - 4); n.classList.toggle("er-scroll-left", more && n.scrollLeft > 4); };
    mark(); n.onscroll = mark; if (typeof requestAnimationFrame === "function") requestAnimationFrame(mark);
  });
}
/* La rangée d'onglets est posée après le rendu de la page : le bouton « Plus » est écouté au niveau du document. */
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-er-tabmore]"); if (b) { e.preventDefault(); erTabSheet(); } });
