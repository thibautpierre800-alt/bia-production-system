"use strict";

// 8.2 · Voir › Maturité : la trajectoire BIA, « d’artisan industriel à industriel artisan ».
// La 4.0 et la 5.0 sont des marches de maturité, pas un audit à part : chaque site
// est placé sur l’escalier par ses évaluations. Une seule légende pour tout l’écran,
// les couleurs sur les diagrammes et les sites comparés côte à côte.

const MT_STEPS = [
  { n: 1, name: "Artisan industriel", line: "Le savoir-faire est dans les mains : papier, réactivité, expérience de chacun." },
  { n: 2, name: "Industriel standardisé", line: "Le geste se standardise : 5S, standards, SQCDP, résolution de problèmes." },
  { n: 3, name: "Industriel maîtrisé", line: "Le flux est tenu : Lean maîtrisé, données fiables, décisions sur des faits." },
  { n: 4, name: "Industriel connecté", tag: "4.0", line: "La donnée circule seule : machines et systèmes reliés, écarts vus en temps réel." },
  { n: 5, name: "Industriel artisan", tag: "5.0", line: "La technologie sert l’humain : savoir-faire augmenté, durable, résilient." },
];
// Règle proposée, affichée à l’écran : pas de 4.0 sans fondations Lean.
const MT_RULE = { 2: { lean: 2 }, 3: { lean: 3 }, 4: { lean: 3.5, c40: 3 }, 5: { lean: 4, c40: 3.5, c50: 3.5 } };

// Propositions pour avancer, rangées par marche visée. status : app = déjà dans
// l’appli, todo = à lancer sur le terrain, it = dépend du service informatique.
const MT_PROPOSALS = [
  { step: 3, title: "Une seule saisie", text: "Signaux, Gemba et actions saisis une fois dans l’appli : plus de double papier ou tableur.", status: "app", nav: "terrain" },
  { step: 3, title: "Mêmes définitions sur tous les sites", text: "TRS, rebut et service définis et validés avec les directeurs : la condition pour comparer.", status: "app", nav: "settings", tab: "kpis" },
  { step: 3, title: "Standards au poste", text: "Un standard visuel daté (photo, points clés) consultable sur téléphone, au poste.", status: "app", nav: "documents" },
  { step: 4, title: "TRS automatique sur le goulot", text: "Un capteur marche / arrêt et un compteur sur l’équipement goulot de chaque site ; l’opérateur ne qualifie que la cause. Un site pilote d’abord.", status: "todo" },
  { step: 4, title: "SEQUOIA, source unique", text: "Les relevés arrivent seuls dans l’appli : fin des ressaisies et des écarts de version.", status: "it" },
  { step: 4, title: "Alerte au bon moment", text: "Écart critique ou signal sécurité poussé dans Teams vers la bonne personne, sans attendre la réunion.", status: "it" },
  { step: 4, title: "Maintenance sur l’état", text: "Quelques mesures clés (température, vibration, pression) avec seuils d’alerte avant la panne.", status: "todo" },
  { step: 4, title: "Cybersécurité des machines", text: "Inventaire et sauvegarde des équipements avant tout raccordement au réseau.", status: "it" },
  { step: 5, title: "Le savoir-faire transmis", text: "Gestes clés filmés avec les experts, rattachés aux standards et à la matrice de compétences.", status: "todo", nav: "training" },
  { step: 5, title: "Pénibilité mesurée", text: "Cotation ergonomique des postes ; réduire d’abord les plus pénibles (aide à la manutention, cobot), avec les opérateurs.", status: "todo" },
  { step: 5, title: "Énergie, matière, CO₂", text: "Relevés par site et objectifs de réduction, à côté des indicateurs de production.", status: "app", nav: "pilotage" },
  { step: 5, title: "Résilience", text: "Polyvalence suivie et plan de continuité pour chaque équipement et fournisseur critique.", status: "todo", nav: "training" },
];
const MT_STATUS = { app: ["Dans l’appli", "done"], todo: ["À lancer", "progress"], it: ["Avec l’informatique", "neutral"] };

function mtGroups() {
  const all = data.settings.digitalPillars || [],
    group = (name) => OS_DIGITAL_AXES.find((a) => a.name === name)?.group || "4.0";
  return { c40: all.filter((p) => group(p) === "4.0"), c50: all.filter((p) => group(p) === "5.0") };
}
function mtLens() {
  return state.maturitySet === "digital" ? "digital" : "lean";
}
function mtPillars(lens = mtLens()) {
  return lens === "digital" ? data.settings.digitalPillars || [] : data.settings.pillars;
}
function mtLevels() {
  return osMaturitySet().levels;
}
function mtLevel(siteId, pillar, at) {
  return osMaturity(siteId, pillar, at, state.workshop || null);
}
function mtAvg(siteId, pillars, at) {
  const rows = pillars.map((p) => mtLevel(siteId, p, at)).filter(Boolean);
  return { value: rows.length ? rows.reduce((n, r) => n + Number(r.level), 0) / rows.length : null, filled: rows.length, total: pillars.length };
}
const mtEnough = (avg) => avg.total > 0 && avg.filled >= Math.ceil(avg.total / 2);
const mtReach = (avg, min) => mtEnough(avg) && avg.value >= min - 1e-9;

// Marche d’un site à une date : la plus haute dont toutes les conditions sont réunies.
function mtPosition(siteId, at) {
  const { c40, c50 } = mtGroups(),
    lean = mtAvg(siteId, data.settings.pillars, at),
    a40 = mtAvg(siteId, c40, at),
    a50 = mtAvg(siteId, c50, at);
  let step = 0;
  if (mtEnough(lean)) {
    step = 1;
    if (mtReach(lean, MT_RULE[2].lean)) step = 2;
    if (mtReach(lean, MT_RULE[3].lean)) step = 3;
    if (step === 3 && mtReach(lean, MT_RULE[4].lean) && mtReach(a40, MT_RULE[4].c40)) step = 4;
    if (step === 4 && mtReach(lean, MT_RULE[5].lean) && mtReach(a40, MT_RULE[5].c40) && mtReach(a50, MT_RULE[5].c50)) step = 5;
  }
  return { step, lean, a40, a50 };
}
// Ce qui manque pour la marche suivante : conditions non tenues et critères les plus faibles.
function mtNext(siteId, at, pos) {
  const { c40, c50 } = mtGroups(),
    needs = [],
    items = [];
  const below = (pillars, min) =>
    pillars
      .map((p) => ({ p, level: mtLevel(siteId, p, at)?.level ?? null }))
      .filter((x) => x.level === null || x.level < min)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  if (pos.step === 0) {
    needs.push(`Évaluer au moins ${Math.ceil(pos.lean.total / 2)} piliers Lean (${pos.lean.filled} faits)`);
    items.push(...below(data.settings.pillars, 1).slice(0, 3));
    return { target: MT_STEPS[0], needs, items };
  }
  if (pos.step >= 5) return { target: null, needs: ["Tenir le niveau et transmettre le savoir-faire"], items };
  const rule = MT_RULE[pos.step + 1] || {};
  const check = (label, avg, min, pillars) => {
    if (min === undefined || mtReach(avg, min)) return;
    if (!mtEnough(avg)) {
      needs.push(`${label} : à évaluer (${avg.filled}/${avg.total})`);
      items.push(...below(pillars, min).filter((x) => x.level === null).slice(0, 2));
    } else {
      needs.push(`${label} ${osNum(avg.value)} → ${osNum(min)}`);
      items.push(...below(pillars, min).slice(0, 3));
    }
  };
  check("Lean", pos.lean, rule.lean, data.settings.pillars);
  check("Connecté 4.0", pos.a40, rule.c40, c40);
  check("Humain 5.0", pos.a50, rule.c50, c50);
  return { target: MT_STEPS[pos.step], needs, items: items.slice(0, 4) };
}

function mtTone(level) {
  return level ? `mt-l${Math.max(1, Math.min(5, Math.round(level)))}` : "mt-l0";
}
function mtArrow(delta) {
  if (delta === null || !Number.isFinite(delta) || delta === 0) return "";
  return `<i class="mt-arrow ${delta > 0 ? "up" : "down"}" aria-hidden="true">${delta > 0 ? "↗" : "↘"}</i>`;
}
function mtCan() {
  return osWritable(state.site);
}
function mtArgs(args) {
  return esc(JSON.stringify(args));
}
function mtDates(sites) {
  return osMaturityDates(sites.map((s) => s.id));
}

// Échelle de couleur et numéros des critères : affichés une seule fois.
function mtLegend(lens, pillars) {
  const levels = mtLevels();
  const scale = `<div class="mt-scale" aria-label="Échelle des niveaux">${levels.map((l, i) => `<span class="mt-swatch mt-l${i + 1}"><b>${i + 1}</b>${esc(l)}</span>`).join("")}<span class="mt-swatch mt-l0"><b>—</b>non évalué</span></div>`;
  const items = pillars.map((p, i) => {
    const axis = lens === "digital" ? OS_DIGITAL_AXES.find((a) => a.name === p) : null;
    return `<li><b>${i + 1}</b><span>${esc(p)}${axis ? ` <em class="mt-tag">${axis.group}</em>` : ""}${axis ? `<small>${esc(axis.question)}</small>` : ""}</span></li>`;
  }).join("");
  return `<div class="mt-legend">${scale}<ol class="mt-criteria ${lens === "digital" ? "mt-criteria-long" : "mt-criteria-short"}" aria-label="Numéros des ${lens === "digital" ? "critères" : "piliers"}">${items}</ol></div>`;
}

function mtStepper(dates, at) {
  const i = dates.indexOf(at),
    older = i >= 0 ? dates[i + 1] || null : null,
    newer = i > 0 ? dates[i - 1] : null;
  const btn = (to, label, text) => `<button type="button" class="in-step-btn" data-mt-step="${esc(to || "")}" ${to ? "" : "disabled"} aria-label="${label}">${text}</button>`;
  return `<div class="in-step" role="group" aria-label="Date de la campagne">${btn(older, "Campagne précédente", "‹")}<span class="in-step-label">${dates.length ? `Au ${shortDate(at)}` : "Aucune campagne"}</span>${btn(newer, "Campagne suivante", "›")}</div>`;
}

// L’escalier : les cinq marches et les sites posés dessus.
function mtStairs(sites, at) {
  const placed = sites.map((s) => ({ s, pos: mtPosition(s.id, at) }));
  const chip = ({ s, pos }) => `<button type="button" class="mt-site" data-mt-site="${esc(s.id)}" aria-label="${esc(s.name)} · marche ${pos.step} · Lean ${pos.lean.value === null ? "non évalué" : osNum(pos.lean.value)}">${esc(s.name)}</button>`;
  const steps = MT_STEPS.map((st) => {
    const here = placed.filter((x) => x.pos.step === st.n);
    return `<li class="mt-step mt-step-${st.n}" style="--n:${st.n}"><div class="mt-step-head"><span class="mt-step-n">${st.n}</span><div><b>${esc(st.name)}${st.tag ? ` <em class="mt-tag">${st.tag}</em>` : ""}</b><small>${esc(st.line)}</small></div></div><div class="mt-step-sites">${here.map(chip).join("") || '<span class="mt-empty">—</span>'}</div></li>`;
  }).join("");
  const unplaced = placed.filter((x) => x.pos.step === 0);
  return `<ol class="mt-stairs" aria-label="Trajectoire : d’artisan industriel à industriel artisan">${steps}</ol>${unplaced.length ? `<p class="mt-unplaced"><b>À évaluer :</b> ${unplaced.map(chip).join("")}</p>` : ""}`;
}

function mtNextList(sites, at) {
  const rows = sites.map((s) => {
    const pos = mtPosition(s.id, at), next = mtNext(s.id, at, pos);
    const items = next.items.map((x) => `<button type="button" class="mt-need ${mtTone(x.level)}" data-mt-cell="${mtArgs({ siteId: s.id, pillar: x.p })}" title="${esc(x.p)}">${esc(x.p)} <b>${x.level ?? "—"}</b></button>`).join("");
    return `<li class="mt-next-row"><div class="mt-next-site"><b>${esc(s.name)}</b><small>${pos.step ? `Marche ${pos.step} · ${esc(MT_STEPS[pos.step - 1].name)}` : "Non placé"}</small></div><div class="mt-next-body"><span>${next.target ? `Pour ${pos.step ? "la marche" : "être placé : marche"} ${next.target.n} · ${esc(next.target.name)}` : "Dernière marche"} — ${esc(next.needs.join(" · ") || "conditions réunies")}</span>${items ? `<div class="mt-needs">${items}</div>` : ""}</div></li>`;
  }).join("");
  return `<ul class="mt-next">${rows}</ul>`;
}

// Matrice sites × critères, colorée par niveau, flèche si comparaison.
function mtMatrix(sites, pillars, at, cmp) {
  const head = `<div class="mt-row mt-head" role="row"><span role="columnheader" class="mt-corner">Site</span>${pillars.map((p, i) => `<span role="columnheader" class="mt-col" title="${esc(p)}"><b>${i + 1}</b><em>${esc(p)}</em></span>`).join("")}<span role="columnheader" class="mt-col mt-col-avg" title="Moyenne des critères évalués"><b>Moy.</b></span></div>`;
  const rows = sites.map((s) => {
    const cells = pillars.map((p, i) => {
      const m = mtLevel(s.id, p, at), old = cmp ? mtLevel(s.id, p, cmp) : null,
        delta = m && old ? Number(m.level) - Number(old.level) : null,
        name = m ? mtLevels()[m.level - 1] || "" : "";
      return `<button type="button" role="cell" class="mt-cell ${mtTone(m?.level)}" data-mt-cell="${mtArgs({ siteId: s.id, pillar: p })}" aria-label="${esc(s.name)} · ${i + 1} ${esc(p)} : ${m ? `niveau ${m.level} ${esc(name)}` : "non évalué"}${delta ? ` · ${delta > 0 ? "+" : ""}${delta} depuis le ${shortDate(cmp)}` : ""}"><b>${m?.level ?? "—"}</b>${mtArrow(delta)}</button>`;
    }).join("");
    const avg = mtAvg(s.id, pillars, at), oldAvg = cmp ? mtAvg(s.id, pillars, cmp) : null,
      dAvg = avg.value !== null && oldAvg?.value != null ? +(avg.value - oldAvg.value).toFixed(1) : null;
    return `<div class="mt-row" role="row"><button type="button" role="rowheader" class="mt-rowhead" data-mt-site="${esc(s.id)}">${esc(s.name)}</button>${cells}<span role="cell" class="mt-cell mt-avg ${mtTone(avg.value)}" aria-label="${esc(s.name)} · moyenne ${avg.value === null ? "non évaluée" : osNum(avg.value)} (${avg.filled}/${avg.total})"><b>${avg.value === null ? "—" : osNum(avg.value)}</b>${mtArrow(dAvg)}</span></div>`;
  }).join("");
  return `<div class="mt-matrix" role="table" aria-label="Niveaux par site et par critère, au ${esc(shortDate(at))}" style="--mt-cols:${pillars.length + 1}">${head}${rows}</div>`;
}

// Les plus grands écarts entre sites : là où une pratique peut se transférer.
function mtSpreads(sites, pillars, at) {
  if (sites.length < 2) return "";
  const rows = pillars.map((p) => {
    const seen = sites.map((s) => ({ s, m: mtLevel(s.id, p, at) })).filter((x) => x.m);
    if (seen.length < 2) return null;
    seen.sort((a, b) => b.m.level - a.m.level);
    const hi = seen[0], lo = seen.at(-1);
    return { p, gap: hi.m.level - lo.m.level, hi, lo };
  }).filter((x) => x && x.gap >= 2).sort((a, b) => b.gap - a.gap).slice(0, 3);
  if (!rows.length) return "";
  return `<div class="mt-spreads"><h3>Plus grands écarts entre sites</h3><ul>${rows.map((r) => `<li><b>${esc(r.p)}</b><span class="mt-pair"><span class="mt-dot ${mtTone(r.hi.m.level)}">${r.hi.m.level}</span>${esc(r.hi.s.name)}<span class="mt-vs">→</span><span class="mt-dot ${mtTone(r.lo.m.level)}">${r.lo.m.level}</span>${esc(r.lo.s.name)}</span><small>Une pratique à partager ?</small></li>`).join("")}</ul></div>`;
}

// Radar coloré : anneaux rouge → vert, sommets numérotés, points à la couleur du niveau.
function mtRadar(siteId, pillars, at, cmp, big = false) {
  const n = pillars.length;
  if (n < 3) return "";
  const cx = 160, cy = 160, r = 112;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + (Math.cos(a) * r * v) / 5, cy + (Math.sin(a) * r * v) / 5];
  };
  const poly = (v) => pillars.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const levels = pillars.map((p) => mtLevel(siteId, p, at)?.level ?? null);
  const old = cmp ? pillars.map((p) => mtLevel(siteId, p, cmp)?.level ?? null) : [];
  const bands = [5, 4, 3, 2, 1].map((v) => `<polygon class="mt-band mt-band-${v}" points="${poly(v)}"/>`).join("");
  const axes = pillars.map((_, i) => { const [x, y] = pt(i, 5), [lx, ly] = pt(i, 5.85); return `<line class="mt-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="mt-vertex" x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle">${i + 1}</text>`; }).join("");
  const shape = (vals, cls) => {
    const known = vals.map((v, i) => (v === null ? null : pt(i, v)));
    if (known.filter(Boolean).length < 3) return "";
    // Un critère non évalué est posé au centre pour ne pas inventer de niveau.
    return `<polygon class="${cls}" points="${vals.map((v, i) => pt(i, v ?? 0).map((x) => x.toFixed(1)).join(",")).join(" ")}"/>`;
  };
  const dots = levels.map((v, i) => (v === null ? "" : `<circle class="mt-pt ${mtTone(v)}" cx="${pt(i, v)[0].toFixed(1)}" cy="${pt(i, v)[1].toFixed(1)}" r="${big ? 6 : 6.5}"/>`)).join("");
  const filled = levels.filter((v) => v !== null).length;
  return `<svg class="mt-radar ${big ? "big" : ""}" viewBox="-10 -6 340 334" role="img" aria-label="Maturité de ${esc(getSiteName(siteId))} au ${esc(shortDate(at))} : ${filled}/${n} évalués${cmp ? `, comparée au ${esc(shortDate(cmp))}` : ""}">${bands}${axes}${shape(old, "mt-shape-old")}${shape(levels, "mt-shape")}${dots}</svg>`;
}
function mtRadars(sites, pillars, at, cmp) {
  return `<div class="mt-radars" style="--sites:${sites.length}">${sites.map((s) => {
    const avg = mtAvg(s.id, pillars, at), pos = mtPosition(s.id, at);
    const chart = avg.filled ? mtRadar(s.id, pillars, at, cmp) : '<div class="mt-radar-empty">Pas encore évalué</div>';
    return `<article class="mt-radar-card"><header><button type="button" class="mt-radar-title" data-mt-site="${esc(s.id)}">${esc(s.name)}</button><span class="mt-avg-pill ${mtTone(avg.value)}">${avg.value === null ? "—" : osNum(avg.value)}</span></header>${chart}<p>${pos.step ? `Marche ${pos.step} · ${esc(MT_STEPS[pos.step - 1].name)}` : "Non placé"} · ${avg.filled}/${avg.total} évalués</p></article>`;
  }).join("")}</div>`;
}

function mtProposals() {
  const groups = [[3, "Vers « Industriel maîtrisé » : des fondations fiables"], [4, "Vers « Industriel connecté » · 4.0"], [5, "Vers « Industriel artisan » · 5.0 : l’humain au centre"]];
  const navOk = (p) => p.nav && role().nav.includes(p.nav) && !(p.nav === "settings" && !osIsAdmin());
  return `<section class="panel section mt-proposals" aria-labelledby="mtPropTitle"><div class="section-title"><div><h2 id="mtPropTitle">Propositions pour avancer</h2><p class="hint">Pas de 4.0 sans fondations Lean : numériser un gaspillage, c’est l’accélérer. Chaque marche s’appuie sur la précédente.</p></div></div>${groups.map(([step, label]) => `<h3 class="mt-prop-step"><span class="mt-step-n">${step}</span>${esc(label)}</h3><div class="mt-prop-grid">${MT_PROPOSALS.filter((p) => p.step === step).map((p) => `<article class="mt-prop"><div class="mt-prop-top"><b>${esc(p.title)}</b>${pill(MT_STATUS[p.status][0], MT_STATUS[p.status][1])}</div><p>${esc(p.text)}</p>${navOk(p) ? `<button type="button" class="btn ghost small" data-mt-nav="${esc(p.nav)}" data-mt-tab="${esc(p.tab || "")}">Ouvrir</button>` : ""}</article>`).join("")}</div>`).join("")}</section>`;
}

renderOSMaturity = function () {
  state.maturitySet = mtLens();
  const group = state.site === "group",
    sites = OPERATIONAL_SITES.filter((s) => group || s.id === state.site),
    dates = mtDates(sites);
  if (!dates.includes(state.maturityDate)) state.maturityDate = dates[0] || today();
  const at = state.maturityDate,
    i = dates.indexOf(at),
    prev = i >= 0 ? dates[i + 1] || "" : "",
    cmp = state.maturityCompare && prev ? prev : "";
  state.maturityCompareDate = cmp;
  const lens = mtLens(), pillars = mtPillars(lens);
  const lensTabs = `<div class="in-chips mt-lens" role="group" aria-label="Référentiel affiché">${[["lean", `Fondations Lean · ${data.settings.pillars.length} piliers`], ["digital", "Entreprise connectée et humaine · 4.0 / 5.0"]].map(([id, label]) => `<button type="button" class="in-chip ${lens === id ? "active" : ""}" data-mt-lens="${id}" aria-pressed="${lens === id}">${esc(label)}</button>`).join("")}</div>`;
  const compare = `<button type="button" class="in-chip ${cmp ? "active" : ""}" data-mt-compare aria-pressed="${!!cmp}" ${prev ? "" : "disabled"}>${prev ? `Comparer au ${shortDate(prev)}` : "Pas de campagne antérieure"}</button>`;
  const placedCount = sites.filter((s) => mtPosition(s.id, at).step > 0).length;
  const digitalEmpty = lens === "digital" && !sites.some((s) => mtAvg(s.id, pillars, at).filled);
  const add = mtCan() ? osButton("+ Évaluation", "new", { key: "maturity" }, false) : "";
  return `${pageHead("Voir · Maturité", "Trajectoire BIA", "D’artisan industriel à industriel artisan : où en est chaque site, et son prochain pas.", add)}
  <section class="panel mt-wall" aria-labelledby="mtStairsTitle">
    <div class="mt-wall-head"><div><h2 id="mtStairsTitle">Où en est chaque site</h2><p class="hint">${placedCount}/${sites.length} site${sites.length > 1 ? "s" : ""} placé${placedCount > 1 ? "s" : ""} · touchez un site pour son détail</p></div>${mtStepper(dates, at)}</div>
    ${mtStairs(sites, at)}
    <p class="mt-rule">Marche 2 : Lean ≥ 2 · marche 3 : Lean ≥ 3 · marche 4 : Lean ≥ 3,5 et connecté ≥ 3 · marche 5 : Lean ≥ 4, connecté et humain ≥ 3,5. Moyennes sur 5, la moitié au moins des critères évalués.</p>
  </section>
  <section class="panel section mt-next-panel" aria-labelledby="mtNextTitle"><h2 id="mtNextTitle">Prochain pas</h2>${mtNextList(sites, at)}</section>
  <section class="panel section mt-compare" aria-labelledby="mtCmpTitle">
    <div class="mt-wall-head"><h2 id="mtCmpTitle">Comparer les sites</h2><div class="mt-tools">${compare}</div></div>
    ${lensTabs}
    ${mtLegend(lens, pillars)}
    ${digitalEmpty ? `<p class="mt-callout">Aucun site n’est encore évalué sur l’entreprise connectée et humaine. ${mtCan() ? "Touchez une case pour noter un critère, sur le terrain, avec le directeur et un opérateur." : "Les évaluations sont faites par les sites avec le Lean Groupe."}</p>` : ""}
    <div class="mt-matrix-wrap">${mtMatrix(sites, pillars, at, cmp)}</div>
    ${group ? mtSpreads(sites, pillars, at) : ""}
    ${cmp ? `<p class="mt-cmp-key"><span class="mt-key-now"></span>Au ${shortDate(at)} <span class="mt-key-old"></span>Au ${shortDate(cmp)} · ↗ ↘ évolution d’un niveau</p>` : ""}
    ${digitalEmpty ? "" : mtRadars(sites, pillars, at, cmp)}
  </section>
  ${mtProposals()}
  ${mtCampaigns(sites, at)}`;
};

// Campagnes passées : une ligne par date, au lieu d’une fiche par évaluation.
function mtCampaigns(sites, at) {
  const ids = new Set(sites.map((s) => s.id)), lean = new Set(data.settings.pillars), byDate = new Map();
  for (const m of osActive(data.maturity)) {
    if (!ids.has(m.site_id) || (state.workshop ? m.workshop_id !== state.workshop : m.workshop_id)) continue;
    const row = byDate.get(m.date) || { lean: 0, digital: 0, sites: new Set() };
    row[lean.has(m.pillar) ? "lean" : "digital"]++;
    row.sites.add(m.site_id);
    byDate.set(m.date, row);
  }
  const rows = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  if (!rows.length) return "";
  return `<section class="panel section mt-campaigns" aria-labelledby="mtCampTitle"><h2 id="mtCampTitle">Campagnes d’évaluation</h2><ul>${rows.map(([date, r]) => `<li class="${date === at ? "active" : ""}"><button type="button" data-mt-step="${esc(date)}" aria-pressed="${date === at}"><b>${shortDate(date)}</b><span>${r.sites.size} site${r.sites.size > 1 ? "s" : ""} · ${r.lean} pilier${r.lean > 1 ? "s" : ""} Lean${r.digital ? ` · ${r.digital} critère${r.digital > 1 ? "s" : ""} 4.0 / 5.0` : ""}</span></button></li>`).join("")}</ul><p class="hint">Chaque évaluation garde ses faits et preuves : touchez une case de la matrice pour la retrouver ou en noter une nouvelle.</p></section>`;
}

function mtSiteSheet(siteId) {
  const s = OPERATIONAL_SITES.find((x) => x.id === siteId);
  if (!s) return;
  const at = state.maturityDate || today(), pos = mtPosition(siteId, at), next = mtNext(siteId, at, pos), { c40, c50 } = mtGroups();
  const line = (label, avg) => `<div class="mt-sheet-avg"><span>${esc(label)}</span><b class="mt-avg-pill ${mtTone(avg.value)}">${avg.value === null ? "—" : osNum(avg.value)}</b><small>${avg.filled}/${avg.total} évalués</small></div>`;
  modal(`${s.name} · trajectoire`, `<div class="mt-sheet">
    <p class="mt-sheet-step">${pos.step ? `<span class="mt-step-n">${pos.step}</span> Marche ${pos.step} · <b>${esc(MT_STEPS[pos.step - 1].name)}</b>` : "<b>Pas encore placé</b> : la moitié au moins des piliers Lean doit être évaluée."}</p>
    <div class="mt-sheet-avgs">${line("Fondations Lean", pos.lean)}${line("Connecté 4.0", mtAvg(siteId, c40, at))}${line("Humain 5.0", mtAvg(siteId, c50, at))}</div>
    <h3>Prochain pas</h3><p>${next.target ? `Marche ${next.target.n} · ${esc(next.target.name)} : ` : ""}${esc(next.needs.join(" · ") || "conditions réunies")}</p>
    ${next.items.length ? `<div class="mt-needs">${next.items.map((x) => `<button type="button" class="mt-need ${mtTone(x.level)}" data-mt-cell="${mtArgs({ siteId, pillar: x.p })}">${esc(x.p)} <b>${x.level ?? "—"}</b></button>`).join("")}</div>` : ""}
    ${osWritable(siteId) ? (() => { const plans = next.items.map((x) => mtLevel(siteId, x.p, at)).filter(Boolean); return plans.length ? `<div class="row-actions">${plans.map((m) => osButton(`Plan d’amélioration · ${m.pillar}`, "createFrom", { id: m.id, kind: "action" })).join("")}</div>` : ""; })() : ""}
    <div class="mt-sheet-radars">${[["Fondations Lean", data.settings.pillars], ["Entreprise connectée et humaine", data.settings.digitalPillars || []]].map(([label, list]) => `<figure><figcaption>${label}</figcaption>${mtAvg(siteId, list, at).filled ? mtRadar(siteId, list, at, "", true) : '<div class="mt-radar-empty">Pas encore évaluée</div>'}</figure>`).join("")}</div>
    <p class="hint">Numéros des sommets : voir la légende de l’écran Maturité.</p>
    <div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Fermer</button></div></div>`);
  mtBind($("modalContent") || document);
}

function mtOpenCell(args) {
  const { siteId, pillar } = args || {};
  if (!siteId || !pillar) return;
  const at = state.maturityDate || today(), m = mtLevel(siteId, pillar, at);
  if (osWritable(siteId)) {
    if (!requestCloseModal()) return;
    return osForm("maturity", null, { site_id: siteId, pillar, target: m?.target || 4, date: today() });
  }
  if (m) return osReadRecord("maturity", m);
  toast(`${pillar} : pas encore évalué pour ${getSiteName(siteId)}.`);
}

function mtBind(root = document) {
  root.querySelectorAll("[data-mt-step]").forEach((b) => (b.onclick = () => { if (b.dataset.mtStep) { state.maturityDate = b.dataset.mtStep; render(); } }));
  root.querySelectorAll("[data-mt-compare]").forEach((b) => (b.onclick = () => { state.maturityCompare = !state.maturityCompare; render(); }));
  root.querySelectorAll("[data-mt-lens]").forEach((b) => (b.onclick = () => { state.maturitySet = b.dataset.mtLens === "digital" ? "digital" : "lean"; render(); }));
  root.querySelectorAll("[data-mt-site]").forEach((b) => (b.onclick = () => mtSiteSheet(b.dataset.mtSite)));
  root.querySelectorAll("[data-mt-cell]").forEach((b) => (b.onclick = () => { try { mtOpenCell(JSON.parse(b.dataset.mtCell)); } catch { /* attribut illisible : rien à ouvrir */ } }));
  root.querySelectorAll("[data-mt-nav]").forEach((b) => (b.onclick = () => {
    if (b.dataset.mtNav === "settings" && b.dataset.mtTab) state.adminTab = b.dataset.mtTab;
    if (b.dataset.mtNav === "pilotage") { state.pilotageMode = "analysis"; state.osTab = "tower"; }
    switchView(b.dataset.mtNav);
  }));
}
const mtOsBindBase = osBind;
osBind = function () { const out = mtOsBindBase.apply(this, arguments); mtBind(document); return out; };
