"use strict";
/*
 * AMCO BIA 8.54 · L'avancée d'une action, et son retour sur investissement.
 *
 *  AVANCÉE. Jusqu'ici `progress` était déduit du seul statut (Ouverte 0, En cours 50, À vérifier 90,
 *  Clôturée 100) et n'était affiché nulle part : une action « En cours » depuis six semaines et une
 *  commencée hier se ressemblaient. Le pilote peut maintenant la poser à la main, par pas de 10 %,
 *  et elle s'affiche en barre sur chaque ligne.
 *    Garde-fou Lean contre le syndrome des 90 % : la date du dernier mouvement est enregistrée, et une
 *  action ouverte dont l'avancée n'a pas bougé depuis trois semaines le dit en clair dans ses alertes.
 *  Une avancée qui ne bouge plus est une information, pas un détail d'affichage.
 *
 *  ARGENT. Le coût est arrivé en 8.52. Il lui manquait l'autre moitié : ce que l'action rapporte, et
 *  donc en combien de temps elle se rembourse. L'action porte une estimation de gain annuel ;
 *  le retour se calcule sous les yeux du pilote, avec la même arithmétique que le module Gains
 *  (coût ÷ gain mensuel). Dès qu'un gain est déclaré dans Gains pour cette action, c'est lui qui
 *  s'affiche — chiffre mesuré et validé — et l'estimation s'efface : une seule vérité par action.
 */

const AV_STALE_DAYS = 21;

function avNum(v) { return v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null; }

/* L'avancée affichée : celle posée à la main, sinon celle que le statut implique. */
function avProgress(a) {
  if (!a) return 0;
  if (a.status === "Clôturée") return 100;
  const p = avNum(a.progress);
  return p === null ? 0 : Math.min(100, Math.max(0, Math.round(p)));
}
function avSetBy(a) { return a && a.progress_at ? a : null; }

/* Depuis combien de jours l'avancée n'a pas bougé, sur une action ouverte et commencée. */
function avFrozen(a) {
  if (!a || !isOpenAction(a) || a.status === "Standby") return 0;
  const p = avProgress(a);
  if (p <= 0 || p >= 100) return 0;
  const ref = apDay(a.progress_at || apLastUpdate(a)?.at || a.created_at);
  if (!ref) return 0;
  const n = Math.max(0, -daysUntil(ref));
  return n >= AV_STALE_DAYS ? n : 0;
}

function avSetProgress(id, value) {
  const a = data.actions.find((x) => x.id === id), v = avNum(value);
  if (!a || v === null) return false;
  const p = Math.min(100, Math.max(0, Math.round(v / 10) * 10));
  if (a.status === "Clôturée") { toast("L’action est clôturée."); return false; }
  if (avProgress(a) === p && a.progress_at) return true;
  return apPatch(id, (row) => { row.progress = p; row.progress_at = now(); }, `Avancée : ${avProgress(a)} % → ${p} %`);
}

function avBar(a, cls = "") {
  const p = avProgress(a), frozen = avFrozen(a);
  return `<span class="av-bar ${cls}${frozen ? " frozen" : ""}" role="img" aria-label="Avancée ${p} %"><span class="av-track"><i style="width:${p}%"></i></span><b>${p} %</b></span>`;
}

/* ---------- L'argent : coût, gain, retour ---------- */

/* Le gain déclaré dans le module Gains pour cette action, s'il existe : il prime sur l'estimation. */
function avGain(a) {
  if (!a || typeof gnValue !== "function") return null;
  const g = (data.gains || []).find((x) => !x.archived_at && x.source_id === a.id && x.status !== "Refusé");
  if (!g) return null;
  const v = gnValue(g);
  return v && v.euros ? { euros: v.euros, gain: g, measured: !!v.measured, status: g.status } : null;
}
function avEstimate(a) { const n = avNum(a && a.gain_year); return n === null || n <= 0 ? null : n; }

/* Le retour en mois : coût ÷ gain mensuel. Même arithmétique que gnPayback. */
function avPayback(cost, perYear) {
  if (!cost || !perYear || cost <= 0 || perYear <= 0) return null;
  return cost / (perYear / 12);
}
function avMonths(m) {
  if (m === null) return "—";
  if (m < 1) return "moins d’un mois";
  if (m >= 24) return `${Math.round(m / 12)} ans`;
  return `${Math.round(m)} mois`;
}

function avSetGain(id, value) {
  const a = data.actions.find((x) => x.id === id), v = String(value).trim();
  const n = v === "" ? null : avNum(v);
  if (v !== "" && (n === null || n < 0)) { toast("Un gain annuel en euros, ou rien."); return false; }
  const before = avEstimate(a);
  if (before === n) return true;
  return apPatch(id, (row) => { if (n === null) delete row.gain_year; else row.gain_year = n; },
    `Gain attendu : ${before === null ? "non estimé" : ivEuro(before) + "/an"} → ${n === null ? "non estimé" : ivEuro(n) + "/an"}`);
}

/* ---------- Les blocs de la fiche ---------- */

function avSlider(a, id = "avRange") {
  const p = avProgress(a);
  return `<span class="av-slide"><input type="range" min="0" max="100" step="10" value="${p}" id="${id}" style="--av-fill:${p}%" aria-label="Avancée en pourcentage"><output for="${id}">${p} %</output></span>`;
}

function avProgressBlock(a, edit, compact = false) {
  const p = avProgress(a), frozen = avFrozen(a);
  if (!edit) return `<div class="ap-field"><span class="metric-label">Avancée</span><p>${avBar(a)}</p></div>`;
  if (compact) {
    /* Dans la revue, une seule ligne : on enchaîne quinze actions, chaque pixel compte. */
    return `<div class="av-row${frozen ? " frozen" : ""}"><span class="av-row-label">Avancée</span>${avSlider(a)}
      ${frozen ? `<span class="av-row-warn">figée depuis ${frozen} j</span>` : ""}</div>`;
  }
  return `<div class="ap-field av-field"><span class="metric-label">Avancée</span>
    ${avSlider(a)}
    <p class="hint">${frozen
      ? `<b>Annoncée à ${p} % depuis ${frozen} jours.</b> Une avancée qui ne bouge plus veut souvent dire que l’action est bloquée : un point dans le journal, ou le statut « En attente », vaut mieux qu’un pourcentage figé.`
      : "Posée par le pilote, par pas de 10 %. Sans saisie, elle suit le statut : 0 à l’ouverture, 50 en cours, 90 à vérifier."}</p></div>`;
}

/* Le curseur : l’étiquette suit le doigt, l’enregistrement n’a lieu qu’au relâcher — une ligne de journal par geste. */
function avBindSlider(node, id, onCommit) {
  const r = node.querySelector(`#${id}`);
  if (!r) return;
  const out = node.querySelector(`output[for="${id}"]`);
  r.oninput = () => { r.style.setProperty("--av-fill", `${r.value}%`); if (out) out.textContent = `${r.value} %`; };
  r.onchange = () => onCommit(r.value);
}

function avMoneyBlock(a, edit) {
  const cost = typeof ivAmount === "function" ? ivAmount(a) : null;
  const real = avGain(a), est = avEstimate(a);
  const perYear = real ? real.euros : est;
  const months = avPayback(cost, perYear);
  const an1 = cost !== null && perYear ? perYear - cost : null;

  const bilan = !cost && !perYear ? "" : `<div class="av-roi">
    <span><small>Coût</small><b>${cost === null ? "—" : esc(ivEuro(cost))}</b></span>
    <span><small>Gain ${real ? (real.measured ? "mesuré" : "déclaré") : "attendu"}</small><b>${perYear ? esc(ivEuro(perYear)) + " /an" : "—"}</b></span>
    <span class="${months !== null && months <= 12 ? "good" : ""}"><small>Retour</small><b>${esc(avMonths(months))}</b></span>
    <span class="${an1 !== null && an1 < 0 ? "bad" : ""}"><small>1<sup>re</sup> année</small><b>${an1 === null ? "—" : (an1 > 0 ? "+" : "") + esc(ivEuro(an1))}</b></span>
  </div>${real ? `<p class="hint">Gain ${esc(String(real.status).toLowerCase())} dans Voir › Gains (${esc(real.gain.id)}) : c’est lui qui fait foi, l’estimation portée ici n’est plus utilisée.</p>`
    : months !== null ? `<p class="hint">Estimation du pilote. Tant que le gain n’est pas déclaré et mesuré dans Voir › Gains, ce retour est une hypothèse de travail, pas un résultat.</p>` : ""}`;

  if (!edit) return bilan ? `<div class="ap-field"><span class="metric-label">Coût et retour</span>${bilan}</div>` : "";
  return `<div class="ap-field av-field"><span class="metric-label">Gain attendu</span>
    ${real ? "" : `<div class="form-grid"><label>Gain annuel en euros<input type="number" min="0" step="100" id="avGain" value="${est === null ? "" : esc(String(est))}" placeholder="Laisser vide si l’action ne rapporte rien de chiffrable"></label></div>
    <button type="button" class="btn dark" data-av-gain>Enregistrer le gain</button>`}
    ${bilan}
    <p class="hint">Une action de sécurité ou de conformité n’a pas à rapporter : laisser vide est une réponse valable, et le coût seul reste suivi dans Voir › Gains, par site.</p></div>`;
}

/* Pendant la revue, les quatre chiffres tiennent sur une ligne : on y passe quinze actions à la suite. */
function avMoneyLine(a) {
  const cost = typeof ivAmount === "function" ? ivAmount(a) : null;
  const real = avGain(a), est = avEstimate(a), perYear = real ? real.euros : est;
  if (cost === null && !perYear) return "";
  const months = avPayback(cost, perYear), an1 = cost !== null && perYear ? perYear - cost : null;
  const bit = (l, v, cls = "") => `<span class="${cls}"><small>${l}</small> <b>${esc(v)}</b></span>`;
  return `<p class="av-line">
    ${cost === null ? "" : bit("Coût", ivEuro(cost))}
    ${perYear ? bit(`Gain ${real ? "déclaré" : "attendu"}`, ivEuro(perYear) + "/an") : ""}
    ${months === null ? "" : bit("Retour", avMonths(months), months <= 12 ? "good" : "")}
    ${an1 === null ? "" : bit("1<sup>re</sup> année", (an1 > 0 ? "+" : "") + ivEuro(an1), an1 < 0 ? "bad" : "")}
  </p>`;
}

/* ---------- Greffes ---------- */

{
  /* Le changement de statut recalcule l'avancée (0 / 50 / 90). C'était sans conséquence tant qu'elle
     n'était pas saisissable ; maintenant, une avancée posée par le pilote ne doit pas être rabaissée
     par un simple passage de statut. Seule la clôture l'emporte, en la portant à 100. */
  const baseSetStatus = apSetStatus;
  apSetStatus = function (id) {
    const a = data.actions.find((x) => x.id === id);
    const held = a && a.progress_at ? avProgress(a) : null;
    const ok = baseSetStatus.apply(this, arguments);
    if (!ok || held === null) return ok;
    const after = data.actions.find((x) => x.id === id);
    if (after && after.status !== "Clôturée" && avProgress(after) < held) {
      apPatch(id, (row) => { row.progress = held; }, "");
    }
    return ok;
  };

  /* L'avancée figée rejoint les alertes de la ligne, à côté de « Sans pilote » et « Reportée 2 fois ». */
  const baseWarn = apWarnings;
  apWarnings = function (a) {
    const out = baseWarn.apply(this, arguments), n = avFrozen(a);
    if (n) out.push(`Avancée figée à ${avProgress(a)} % depuis ${n} j`);
    return out;
  };

  /* La barre s'insère dans la ligne, sous le titre. */
  const baseRow = apRow;
  apRow = function (a, compact = false) {
    const html = baseRow.apply(this, arguments);
    if (typeof html !== "string" || !a || !isOpenAction(a) || avProgress(a) <= 0) return html;
    return html.replace('<span class="ap-meta">', `${avBar(a, "inline")}<span class="ap-meta">`);
  };

  /* Les deux blocs arrivent dans la fiche, devant le journal. */
  const baseOpen = apOpen;
  apOpen = function (id) {
    baseOpen.apply(this, arguments);
    const a = data.actions.find((x) => x.id === id);
    if (!a) return;
    const host = $("modalContent") && $("modalContent").querySelector(".ap-fiche");
    if (!host) return;
    const edit = apCanEdit(a) && a.status !== "Clôturée";
    const journal = Array.from(host.children).find((el) =>
      el.classList.contains("ap-field") && /Journal/.test(el.querySelector(".metric-label")?.textContent || ""));
    const put = (html) => {
      if (!html) return null;
      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const node = wrap.firstElementChild;
      if (journal) host.insertBefore(node, journal); else host.appendChild(node);
      return node;
    };
    const again = (ok) => { if (ok) { render(); apOpen(id); } };
    const prog = put(avProgressBlock(a, edit));
    if (prog) avBindSlider(prog, "avRange", (v) => again(avSetProgress(id, v)));
    const money = put(avMoneyBlock(a, edit));
    if (money) {
      const save = money.querySelector("[data-av-gain]");
      if (save) save.onclick = () => again(avSetGain(id, $("avGain") ? $("avGain").value : ""));
    }
  };

  /* ---------- « Faire le point » : l'avancée se bouge là où on en parle ---------- */

  /* La revue est le moment où le pilote dit où il en est : la barre et les paliers y sont, avec le
     coût et le retour sous les yeux, pour ne pas avoir à ouvrir la fiche au milieu du tour de table. */
  const baseReview = apReviewRender;
  apReviewRender = function () {
    baseReview.apply(this, arguments);
    const r = state.apReview;
    if (!r || r.step !== "card") return;
    const card = $("modalContent") && $("modalContent").querySelector(".ap-rv-card");
    const note = card && card.querySelector("#apRvNote");
    if (!card || !note) return;
    const a = data.actions.find((x) => x.id === r.queue[r.i].id);
    if (!a) return;
    // Au-dessus de l'historique : « où on en est » se dit avant le détail de ce qui s'est passé,
    // et sur un téléphone l'historique déplié repousserait l'avancée hors de l'écran.
    const before = card.querySelector(".ap-rv-hist") || card.querySelector(".ap-warns") || note.closest(".field") || note;
    const wrap = document.createElement("div");
    wrap.className = "av-rv";
    wrap.innerHTML = `${avProgressBlock(a, apCanEdit(a), true)}${avMoneyLine(a)}`;
    card.insertBefore(wrap, before);
    /* L'historique déplié occupait 400 px sur un téléphone : les boutons de décision tombaient hors
       écran, et la revue se faisait à l'aveugle. Il reste là, sa ligne de résumé dit l'essentiel
       (combien de points, le dernier quand), et il s'ouvre d'un geste — qui tient jusqu'à la fin de
       la revue, pour qui préfère le garder sous les yeux. */
    const hist = card.querySelector(".ap-rv-hist");
    if (hist) {
      if (state.apRvHist) hist.setAttribute("open", ""); else hist.removeAttribute("open");
      hist.ontoggle = () => { state.apRvHist = hist.open; };
    }
    avBindSlider(wrap, "avRange", (v) => {
      const kept = note.value;
      if (avSetProgress(a.id, v)) { apReviewRender(); const n = $("apRvNote"); if (n) { n.value = kept; } }
    });
  };

  /* Le compte rendu porte l'avancée de chaque action revue, et le bilan d'argent du périmètre. */
  const baseReport = apReviewReport;
  apReviewReport = function (r) {
    const text = baseReport.apply(this, arguments);
    const byId = new Map((data.actions || []).map((x) => [x.id, x]));
    const withPct = text.split("\n").map((line) => {
      const m = /^- ([A-Z0-9-]+) /.exec(line);
      const a = m && byId.get(m[1]);
      return a && isOpenAction(a) && avProgress(a) > 0 ? `${line} [avancée ${avProgress(a)} %]` : line;
    });
    const rows = scoped(data.actions).filter((x) => ivAmount(x) !== null);
    if (rows.length) {
      const cost = rows.reduce((n, x) => n + ivAmount(x), 0);
      const gain = rows.reduce((n, x) => n + ((avGain(x) || {}).euros || avEstimate(x) || 0), 0);
      withPct.push(`Argent engagé sur les actions chiffrées : ${ivEuro(cost)}${gain ? `, pour ${ivEuro(gain)}/an attendus, retour ${avMonths(avPayback(cost, gain))}` : ", sans gain chiffré"}.`);
    }
    const figees = scoped(data.actions).filter(avFrozen);
    if (figees.length) withPct.push(`${figees.length} action(s) dont l’avancée n’a pas bougé depuis plus de ${AV_STALE_DAYS} jours.`);
    return withPct.join("\n");
  };

}
