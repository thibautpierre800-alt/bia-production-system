"use strict";
/*
 * AMCO BIA 8.53 · Actions confidentielles (« fantômes »).
 *
 *  Une action marquée confidentielle disparaît de tous les écrans partagés — liste, TOP 5, panneau
 *  d'atelier, compteurs de pilotage, exports, choix de pilote — pour tout le monde sauf trois profils :
 *  le responsable Lean, le directeur du site concerné, et la personne nommée pilote de l'action.
 *
 *  CE QUE CE N'EST PAS. Tant que l'application n'a pas d'authentification (étape 2 : données partagées
 *  + comptes), le rôle se choisit dans un menu et se garde dans le navigateur. Une action confidentielle
 *  est donc invisible, pas protégée : elle reste dans les données de l'appareil, lisible par quelqu'un
 *  qui la cherche, et elle part dans les sauvegardes. C'est de la discrétion — tenir un sujet sensible
 *  hors des écrans que l'équipe regarde — et il ne faut pas la présenter autrement.
 *
 *  Le filtre est posé une seule fois, sur `scoped()` et `osScope()`, par où passent toutes les listes :
 *  rien à modifier dans les trente fichiers qui lisent `data.actions`. Les enregistrements qui ne portent
 *  pas le drapeau ne sont pas touchés.
 */

/* Qui a le droit de voir cette action. */
function cfVisible(a) {
  if (!a || !a.confidential) return true;
  if (state.role === "lean") return true;
  if (state.role === "director" && a.site_id === state.site) return true;
  return apIsMine(a);
}

/* Qui a le droit de la rendre confidentielle, ou de la rendre à tout le monde. */
function cfCanToggle(a) {
  if (role().readonly) return false;
  if (state.role === "lean") return true;
  return state.role === "director" && (!a || a.site_id === state.site);
}

function cfHidden(rows) { return (rows || []).filter((r) => !cfVisible(r)); }

function cfSet(id, on) {
  const a = data.actions.find((x) => x.id === id);
  if (!a || !cfCanToggle(a)) { toast("Seuls le responsable Lean et le directeur du site peuvent rendre une action confidentielle."); return false; }
  if (!!a.confidential === !!on) return true;
  return apPatch(id, (row) => { if (on) row.confidential = true; else delete row.confidential; },
    on ? "Action rendue confidentielle : retirée des écrans partagés." : "Action rendue visible de tous.");
}

function cfPill() { return `<span class="cf-pill" title="Confidentielle : invisible sur les écrans partagés">Confidentielle</span>`; }

function cfFicheBlock(a) {
  const on = !!a.confidential;
  if (!cfCanToggle(a)) {
    return on ? `<div class="ap-field cf-field"><span class="metric-label">Confidentialité</span>
      <p>Action confidentielle : elle ne s’affiche ni sur le panneau d’atelier, ni dans le TOP 5, ni dans les exports. Vous la voyez parce que vous en êtes le pilote.</p></div>` : "";
  }
  return `<div class="ap-field cf-field${on ? " on" : ""}"><span class="metric-label">Confidentialité</span>
    <div class="filters">
      <button type="button" class="chip${on ? "" : " active"}" data-cf-set="0" aria-pressed="${!on}">Visible de tous</button>
      <button type="button" class="chip${on ? " active" : ""}" data-cf-set="1" aria-pressed="${on}">Confidentielle</button>
    </div>
    <p class="hint">${on
      ? "Retirée du panneau d’atelier, du TOP 5, des compteurs et des exports. Restent visibles : le responsable Lean, le directeur du site et le pilote de l’action."
      : "Pour un sujet qui n’a pas à s’afficher devant l’atelier. Resteraient visibles : le responsable Lean, le directeur du site et le pilote."}</p>
    <p class="hint cf-warn"><b>À savoir :</b> tant que l’application n’a pas de comptes utilisateurs, le rôle se choisit librement dans le menu. Une action confidentielle est invisible, pas protégée : elle reste dans les données de l’appareil et dans les sauvegardes. Pour un secret réel, ne l’écrivez pas ici.</p></div>`;
}

/* ---------- Greffes ---------- */

{
  const baseScoped = scoped;
  scoped = function () {
    return baseScoped.apply(this, arguments).filter(cfVisible);
  };

  const baseOsScope = osScope;
  osScope = function () {
    return baseOsScope.apply(this, arguments).filter(cfVisible);
  };

  /* Un autre dossier ne doit pas citer le titre d'une action cachée : signal d'origine, chantier,
     A3, journal, lien « Ouvrir ». Tout passe par recordMeta (résolution par identifiant) et
     linkedActions (actions rattachées à un dossier) : deux greffes suffisent. */
  const baseMeta = recordMeta;
  recordMeta = function (id) {
    const info = baseMeta.apply(this, arguments);
    if (info && info.key === "actions" && !cfVisible(info.row)) return null;
    return info;
  };

  const baseLinked = linkedActions;
  linkedActions = function () {
    return baseLinked.apply(this, arguments).filter(cfVisible);
  };

  /* Le signal dont l'action est confidentielle dit qu'une action est en cours, sans la nommer. */
  if (typeof sgStatus === "function") {
    const baseStatus = sgStatus;
    sgStatus = function (sig) {
      if (sig && sig.state === "Action en cours" && sig.action_id) {
        const a = data.actions.find((x) => x.id === sig.action_id);
        if (a && !cfVisible(a)) return "Action en cours";
      }
      return baseStatus.apply(this, arguments);
    };
  }

  /* L'historique des points garde une copie du titre dans son journal : on la retire avant l'affichage. */
  if (typeof apReviewsHistory === "function") {
    const baseHistory = apReviewsHistory;
    apReviewsHistory = function () {
      const keep = data.actionReviews;
      if (!Array.isArray(keep)) return baseHistory.apply(this, arguments);
      const byId = new Map((data.actions || []).map((a) => [a.id, a]));
      data.actionReviews = keep.map((r) => {
        if (!Array.isArray(r.log) || !r.log.some((l) => { const a = byId.get(l.id); return a && !cfVisible(a); })) return r;
        return { ...r, log: r.log.filter((l) => { const a = byId.get(l.id); return !a || cfVisible(a); }) };
      });
      try { return baseHistory.apply(this, arguments); } finally { data.actionReviews = keep; }
    };
  }

  const baseRow = apRow;
  apRow = function (a) {
    const html = baseRow.apply(this, arguments);
    if (!a || !a.confidential || typeof html !== "string") return html;
    return html.replace('<span class="ap-row-side">', `<span class="ap-row-side">${cfPill()}`);
  };

  const baseOpen = apOpen;
  apOpen = function (id) {
    const a = data.actions.find((x) => x.id === id);
    if (a && !cfVisible(a)) { toast("Cette action est confidentielle."); return; }
    baseOpen.apply(this, arguments);
    if (!a) return;
    const host = $("modalContent") && $("modalContent").querySelector(".ap-fiche");
    if (!host) return;
    const block = cfFicheBlock(a);
    if (!block) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = block;
    const node = wrap.firstElementChild;
    const journal = Array.from(host.children).find((el) =>
      el.classList.contains("ap-field") && /Journal/.test(el.querySelector(".metric-label")?.textContent || ""));
    if (journal) host.insertBefore(node, journal); else host.appendChild(node);
    node.querySelectorAll("[data-cf-set]").forEach((b) => (b.onclick = () => {
      if (cfSet(id, b.dataset.cfSet === "1")) { render(); apOpen(id); }
    }));
  };
}
