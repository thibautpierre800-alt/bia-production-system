"use strict";
/*
 * BIA Lean OS 8.33 · Réunions de pilotage : COMEX, COPIL, revue mensuelle des sites, revue hebdomadaire de chaque site.
 *  - Chaque instance a sa cadence, sa durée, son animateur, ses participants et sa prochaine date ;
 *    « Mettre en place les instances » crée les quatre, avec une revue hebdomadaire par site, réparties dans la semaine.
 *  - Le dossier de séance se prépare seul à partir des données : sécurité, actions de la dernière réunion, écarts,
 *    performance par site, chantiers, retards, aide attendue du Groupe, bonnes pratiques, gains, programme AC,
 *    risques, décisions à prendre ; chaque point a sa durée et sa note.
 *  - Pendant la réunion : présents, notes, décisions prises (les décisions attendues se ferment avec leur réponse),
 *    actions qui, quoi, pour quand ; le brouillon est gardé sur l'appareil. « Clore » enregistre le relevé,
 *    crée les actions et fixe la prochaine date. Les actions reviennent au point « Actions de la dernière réunion ».
 *  - Dossier et relevé imprimables ; « Agenda (.ics) » ajoute la série à Outlook ; l'accueil rappelle la réunion
 *    du jour et du lendemain.
 * Données : instances[] (non indexée) = { id, type, site_id, title, cadence, time, duration, chair, participants,
 *   next_date, last_date } ; instanceSessions[] (non indexée) = { id, instance_id, type, site_id, date, by, present[],
 *   notes{}, decisions[{ text, decision_id }], action_ids[], counts{}, next_date, created_at }.
 *   Une action née en réunion porte meeting_id (la séance) et meeting_series (l'instance).
 */

const RE_TYPES = {
  comex: { label: "COMEX", cadence: "Trimestriel", duration: 60, time: "10:00", chair: "Direction générale", participants: "Comité exécutif, Responsable Lean", purpose: "Rendre compte des résultats et du programme, obtenir les décisions qui relèvent de la direction.", agenda: [["perf", 15], ["securite", 5], ["programme", 15], ["gains", 10], ["decisions", 15]] },
  copil: { label: "COPIL amélioration continue", cadence: "Mensuel", duration: 90, time: "14:00", chair: "Responsable Lean", participants: "Direction, méthodes, directeurs de site", purpose: "Piloter le programme : jalons, chantiers, gains, risques et décisions.", agenda: [["suivi", 10], ["programme", 25], ["chantiers", 20], ["gains", 10], ["risques", 15], ["decisions", 10]] },
  mensuelle: { label: "Revue mensuelle des sites", cadence: "Mensuel", duration: 120, time: "10:00", chair: "Directeur opérationnel Groupe", participants: "Responsables des sites, directeur opérationnel Groupe, Responsable Lean", purpose: "Comparer les sites sur les mêmes faits, partager ce qui marche, décider ce qui demande le Groupe.", agenda: [["securite", 10], ["suivi", 10], ["perf", 25], ["ecarts", 15], ["chantiers", 20], ["partage", 20], ["decisions", 20]] },
  hebdo: { label: "Revue hebdomadaire", cadence: "Hebdomadaire", duration: 45, time: "09:00", chair: "Responsable de site", participants: "Responsable de site, Responsable Lean", purpose: "Faire avancer les priorités du site : sécurité, écarts, chantiers, aide attendue du Groupe.", agenda: [["securite", 5], ["suivi", 10], ["ecarts", 10], ["chantiers", 10], ["retards", 5], ["aide", 5]] },
};
const RE_ORDER = ["comex", "copil", "mensuelle", "hebdo"];
const RE_CADENCES = [["Hebdomadaire", 7], ["Toutes les 2 semaines", 14], ["Mensuel", "m1"], ["Toutes les 6 semaines", 42], ["Trimestriel", "m3"]];
const RE_BLOCKS = {
  securite: "Sécurité", suivi: "Actions de la dernière réunion", ecarts: "Indicateurs hors cible", perf: "Performance par site",
  chantiers: "Chantiers", retards: "Actions en retard", aide: "Ce que le site attend du Groupe", partage: "Bonnes pratiques à partager",
  gains: "Gains validés", programme: "Programme amélioration continue", risques: "Risques et points bloquants", decisions: "Décisions à prendre",
};

/* ---------- Outils ---------- */

function reRows() { return (data.instances || []).filter((r) => !r.archived_at); }
function reGet(id) { return reRows().find((r) => r.id === id) || null; }
function reSessions(id) { return (data.instanceSessions || []).filter((s) => !s.archived_at && (!id || s.instance_id === id)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at))); }
function reTitle(r) { return r.type === "hebdo" ? `${r.title || RE_TYPES.hebdo.label} · ${getSiteName(r.site_id)}` : r.title || RE_TYPES[r.type]?.label || "Réunion"; }
function reSites(r) { return r.site_id && r.site_id !== "group" ? [r.site_id] : OPERATIONAL_SITES.map((s) => s.id); }
function reSee(r) {
  if (!role().nav.includes("daily") || ["teamlead", "operator"].includes(state.role)) return false;
  if (state.role === "director") return r.type === "hebdo" ? r.site_id === state.site : r.type !== "comex";
  return true;
}
function reAdmin() { return state.role === "lean" && !role().readonly; }
function reHold(r) { return !role().readonly && (state.role === "lean" || (state.role === "director" && r.type === "hebdo" && r.site_id === state.site)); }
function reCan() { return ["lean", "director", "dg"].includes(state.role) && role().nav.includes("daily"); }
function reAddMonths(d, n) { const x = new Date(d + "T12:00:00"), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x.toISOString().slice(0, 10); }
function reAddDays(d, n) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function reNext(from, cadence) { const c = RE_CADENCES.find((x) => x[0] === cadence)?.[1] ?? 7; return c === "m1" ? reAddMonths(from, 1) : c === "m3" ? reAddMonths(from, 3) : reAddDays(from, c); }
function reDays(d) { return Math.round((Date.parse(d + "T12:00:00Z") - Date.parse(today() + "T12:00:00Z")) / 86400000); }
function reWhen(d) {
  if (!d) return "Date à fixer";
  const n = reDays(d);
  if (n === 0) return "Aujourd’hui";
  if (n === 1) return "Demain";
  if (n < 0) return `En retard depuis le ${shortDate(d)}`;
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function reGaps(sites) {
  // L'écran Écarts lit le périmètre courant : on le lit au niveau Groupe puis on filtre les sites de la réunion.
  if (typeof egRows !== "function") return [];
  const keep = state.site;
  try { state.site = "group"; return egRows().filter((r) => sites.includes(r.site_id)); } finally { state.site = keep; }
}
function reLi(items, emptyText) { return items.length ? `<ul class="re-list">${items.join("")}</ul>` : `<p class="re-empty">${esc(emptyText)}</p>`; }
function reRec(id, label) { return recordMeta(id) ? `<button type="button" class="md-link" data-open-record="${esc(id)}">${esc(label || id)}</button>` : esc(label || id); }

/* ---------- Dossier : chaque point se prépare à partir des données ---------- */

function reBlock(key, r) {
  const sites = reSites(r), inSites = (x) => sites.includes(x.site_id) || (r.site_id === "group" && x.site_id === "group");
  const last = reSessions(r.id)[0] || null, since = last?.date || reAddDays(today(), r.type === "hebdo" ? -7 : -31);
  const site = (id) => (sites.length > 1 ? ` · ${esc(getSiteName(id))}` : "");
  if (key === "securite") {
    const rows = osActive(data.signals).filter((s) => inSites(s) && isOpenSignal(s) && (s.severity === "Critique" || /sécurité/i.test(s.type || ""))).sort((a, b) => (a.severity === "Critique" ? 0 : 1) - (b.severity === "Critique" ? 0 : 1));
    const fresh = osActive(data.signals).filter((s) => inSites(s) && /sécurité/i.test(s.type || "") && String(s.created_at).slice(0, 10) >= since).length;
    return { n: rows.length, html: `<p class="re-fact">${jnPlural(fresh, "signal sécurité remonté", "signaux sécurité remontés")} depuis le ${shortDate(since)} · ${jnPlural(rows.length, "ouvert", "ouverts")}</p>${reLi(rows.slice(0, 6).map((s) => `<li>${pill(s.severity, s.severity === "Critique" ? "critical" : "open")} ${reRec(s.id)} ${esc(s.description || "")}${site(s.site_id)} <small>${esc(s.state || "")}${s.owner ? ` · ${esc(s.owner)}` : ""}</small></li>`), "Aucun signal sécurité ouvert.")}` };
  }
  if (key === "suivi") {
    const rows = osActive(data.actions).filter((a) => a.meeting_series === r.id), open = rows.filter(isOpenAction), done = rows.filter((a) => !isOpenAction(a) && String(a.closed_at || a.updated_at || "").slice(0, 10) >= since);
    if (!last) return { n: 0, html: '<p class="re-empty">Première réunion : pas encore d’action à suivre.</p>' };
    return { n: open.filter(isLate).length, html: `<p class="re-fact">Réunion du ${shortDate(last.date)} · ${jnPlural(open.length, "action ouverte", "actions ouvertes")} dont ${open.filter(isLate).length} en retard · ${jnPlural(done.length, "faite", "faites")}</p>${reLi([...open.sort((a, b) => Number(isLate(b)) - Number(isLate(a))), ...done].slice(0, 10).map((a) => `<li class="${isLate(a) ? "late" : isOpenAction(a) ? "" : "done"}">${reRec(a.id)} ${esc(a.title)} <small>${esc(a.owner || "")} · ${isOpenAction(a) ? (isLate(a) ? `en retard depuis le ${shortDate(a.due_date)}` : `pour le ${shortDate(a.due_date)}`) : "faite"}</small></li>`), "Aucune action décidée à la dernière réunion.")}` };
  }
  if (key === "ecarts") {
    const rows = reGaps(sites), open = rows.filter((x) => !x.covered);
    return { n: open.length, html: `<p class="re-fact">${jnPlural(rows.length, "indicateur hors cible", "indicateurs hors cible")} · ${rows.filter((x) => x.read.signal).length} signal(s) · <b class="${open.length ? "bad" : "good"}">${open.length} sans réponse</b></p>${reLi(rows.slice(0, 8).map((x) => `<li>${esc(x.title)} <small>${esc(x.read.label)} · ${x.covered ? `pris en charge${x.resp[0] ? ` (${esc(x.resp[0].id)})` : ""}` : "<b class=\"bad\">sans réponse</b>"}</small></li>`), "Aucun indicateur hors cible sur les derniers relevés.")}` };
  }
  if (key === "perf") {
    const kpis = osActive(data.kpis), gaps = reGaps(sites);
    const rows = sites.map((id) => {
      const st = kpis.map((k) => osStatus(osLatest(id, k.id), k)), late = osActive(data.actions).filter((a) => a.site_id === id && isLate(a)).length, crit = osActive(data.signals).filter((s) => s.site_id === id && isOpenSignal(s) && s.severity === "Critique").length;
      return { id, gap: st.filter((x) => x === "gap").length, warn: st.filter((x) => x === "warn").length, ok: st.filter((x) => x === "ok").length, none: gaps.filter((g) => g.site_id === id && !g.covered).length, late, crit };
    });
    return { n: rows.reduce((t, x) => t + x.none, 0), html: `<div class="cn-scroll"><table class="re-table"><thead><tr><th>Site</th><th>Écarts</th><th>Vigilance</th><th>Dans la cible</th><th>Sans réponse</th><th>Actions en retard</th><th>Signaux critiques</th></tr></thead><tbody>${rows.map((x) => `<tr><th>${esc(getSiteName(x.id))}</th><td class="${x.gap ? "bad" : ""}">${x.gap}</td><td>${x.warn}</td><td class="good">${x.ok}</td><td class="${x.none ? "bad" : ""}">${x.none}</td><td class="${x.late ? "bad" : ""}">${x.late}</td><td class="${x.crit ? "bad" : ""}">${x.crit}</td></tr>`).join("")}</tbody></table></div><p class="hint">Derniers relevés de chaque indicateur, sans moyenne entre sites.</p>` };
  }
  if (key === "chantiers") {
    const rows = osActive(data.projects).filter((p) => inSites(p) && p.status !== "Clos" && !p.closed_at);
    const info = (p) => { const w = typeof cdWeather === "function" ? cdWeather(p) : null, age = w ? -reDays(String(w.at).slice(0, 10)) : Infinity, late = p.target_date && p.target_date < today(), step = typeof cdIdx === "function" ? (cdLabels(p)[cdIdx(p)] || "Terminé") : p.status; return { w, age, late, step, bad: (w && w.s !== "ok") || late || age > 7 }; };
    const list = rows.map((p) => ({ p, ...info(p) })).sort((a, b) => Number(b.bad) - Number(a.bad));
    return { n: list.filter((x) => x.bad).length, html: `<p class="re-fact">${jnPlural(rows.length, "chantier en cours", "chantiers en cours")} · ${list.filter((x) => x.bad).length} à regarder</p>${reLi(list.slice(0, 8).map(({ p, w, age, late, step }) => `<li>${reRec(p.id)} ${esc(p.title)}${site(p.site_id)} <small>${esc(p.method || "")} · ${esc(step)} · ${w ? (w.s === "block" ? "<b class=\"bad\">bloqué</b>" : w.s === "risk" ? "<b class=\"bad\">à risque</b>" : "dans les temps") : "pas de météo"}${age > 7 && age !== Infinity ? ` · sans point depuis ${age} j` : ""}${late ? " · date cible dépassée" : ""}</small></li>`), "Aucun chantier en cours.")}` };
  }
  if (key === "retards") {
    const rows = osActive(data.actions).filter((a) => inSites(a) && isLate(a) && a.meeting_series !== r.id).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    return { n: rows.length, html: reLi(rows.slice(0, 8).map((a) => `<li class="late">${reRec(a.id)} ${esc(a.title)} <small>${esc(a.owner || "")} · prévue le ${shortDate(a.due_date)}</small></li>`), "Aucune action en retard.") };
  }
  if (key === "aide" || key === "decisions") {
    const scope = key === "aide" ? (d) => sites.includes(d.site_id) : (d) => inSites(d) || d.site_id === "group";
    const rows = osActive(data.decisions).filter((d) => d.status !== "Clos" && scope(d)).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const esc2 = key === "aide" ? osActive(data.escalations).filter((e) => e.status !== "Clos" && sites.includes(e.site_id)) : [];
    return { n: rows.length + esc2.length, pending: rows, html: `${reLi(rows.map((d) => `<li>${reRec(d.id)} ${esc(d.title)}${site(d.site_id)} <small>${esc(d.owner || "décideur à préciser")}${d.due_date ? ` · pour le ${shortDate(d.due_date)}` : ""}${d.detail ? ` · ${esc(d.detail)}` : ""}</small></li>`), key === "aide" ? "Aucune décision attendue du Groupe." : "Aucune décision en attente.")}${esc2.length ? `<p class="re-fact">${jnPlural(esc2.length, "escalade ouverte", "escalades ouvertes")}</p>` : ""}` };
  }
  if (key === "partage") {
    const pub = osActive(data.practices).filter((p) => String(p.published_at || "").slice(0, 10) >= since), deps = osActive(data.deployments).filter((d) => !["Déployée", "Non applicable"].includes(d.status));
    return { n: pub.length, html: `<p class="re-fact">${jnPlural(pub.length, "bonne pratique publiée", "bonnes pratiques publiées")} depuis le ${shortDate(since)} · ${jnPlural(deps.length, "reprise en cours", "reprises en cours")} sur les sites</p>${reLi(pub.slice(0, 6).map((p) => `<li>${reRec(p.id)} ${esc(p.title)} <small>${esc(getSiteName(p.site_id))}</small></li>`), "Rien de nouveau à partager ce mois-ci.")}` };
  }
  if (key === "gains") {
    const rows = osActive(data.gains).filter((g) => inSites(g)), tot = Object.entries(osValidatedGains(rows)), closed = osActive(data.projects).filter((p) => inSites(p) && String(p.closed_at || "").slice(0, 10) >= since);
    return { n: 0, html: `${tot.length ? `<div class="re-gains">${tot.map(([u, v]) => `<span><b>${esc(osNum(v))}</b> ${esc(u)}</span>`).join("")}</div>` : '<p class="re-empty">Aucun gain validé (mesure, preuve et validateur) à ce jour.</p>'}${closed.length ? `<p class="re-fact">${jnPlural(closed.length, "chantier clos", "chantiers clos")} depuis le ${shortDate(since)}</p>` : ""}` };
  }
  if (key === "programme") {
    const items = typeof rvItems === "function" ? rvItems() : [], late = items.filter((x) => x.late), lr = typeof rvLast === "function" ? rvLast() : null;
    return { n: late.length, html: `<p class="re-fact">${jnPlural(items.length, "jalon ou priorité ouvert", "jalons et priorités ouverts")} · ${late.length} en retard${lr ? ` · dernière revue de la roadmap le ${shortDate(lr.date)}` : " · roadmap pas encore revue"}</p>${reLi(items.sort((a, b) => Number(!!b.late) - Number(!!a.late)).slice(0, 8).map((x) => `<li class="${x.late ? "late" : ""}">${esc(x.kind === "jalon" ? "Jalon" : "Priorité")} · ${esc(x.label)} <small>${esc(x.meta || "")}</small></li>`), "Aucun jalon ni priorité ouverts : importez le plan dans Hoshin ou ajoutez des priorités à la roadmap.")}` };
  }
  if (key === "risques") {
    const lr = typeof rvLast === "function" ? rvLast() : null, rv = lr ? lr.items.filter((x) => ["risk", "late"].includes(x.s)) : [];
    const ch = osActive(data.projects).filter((p) => inSites(p) && p.status !== "Clos" && typeof cdWeather === "function" && ["risk", "block"].includes(cdWeather(p)?.s));
    const sig = reGaps(sites).filter((g) => g.read.signal && !g.covered);
    return { n: rv.length + ch.length + sig.length, html: reLi([...rv.map((x) => `<li class="late">Roadmap · ${esc(x.label)} <small>${x.s === "late" ? "en retard" : "à risque"} : ${esc(x.note || "")}${x.decision ? ` · décision : ${esc(x.decision)}` : ""}</small></li>`), ...ch.map((p) => `<li class="late">${reRec(p.id)} ${esc(p.title)} <small>${cdWeather(p).s === "block" ? "bloqué" : "à risque"}${cdWeather(p).note ? ` : ${esc(cdWeather(p).note)}` : ""}</small></li>`), ...sig.map((g) => `<li class="late">${esc(g.title)} <small>${esc(g.read.label)} sans réponse</small></li>`)], "Aucun risque déclaré.") };
  }
  return { n: 0, html: "" };
}

/* ---------- Pages ---------- */

function reCard(r) {
  const last = reSessions(r.id)[0], open = osActive(data.actions).filter((a) => a.meeting_series === r.id && isOpenAction(a)), n = reDays(r.next_date || today());
  return `<article class="re-card ${r.next_date && n < 0 ? "late" : n <= 1 ? "soon" : ""}"><header><div><small>${esc(r.cadence)} · ${r.duration || "?"} min${r.time ? ` · ${esc(r.time)}` : ""}</small><h3>${esc(reTitle(r))}</h3></div></header>
    <p class="re-next"><b>${esc(reWhen(r.next_date))}</b>${r.next_date && n >= 2 ? ` <span>${shortDate(r.next_date)}</span>` : ""}</p>
    <p class="re-meta">${esc(r.chair || "Animateur à préciser")} · ${esc(r.participants || "")}</p>
    <p class="re-meta">${last ? `Dernière le ${shortDate(last.date)}` : "Pas encore tenue"}${open.length ? ` · ${jnPlural(open.length, "action ouverte", "actions ouvertes")}` : ""}</p>
    <div class="row-actions"><button type="button" class="btn${n <= 1 ? "" : " secondary"} small" data-re-open="${esc(r.id)}">${reHold(r) ? "Préparer et tenir" : "Voir le dossier"}</button></div></article>`;
}
function rePage() {
  const rows = reRows().filter(reSee);
  if (!rows.length) return `${pageHead("Voir", "Réunions", "Les instances de pilotage, préparées à partir des faits.")}<section class="panel re-setup"><h2>Mettre en place les instances</h2><p>Quatre instances, chacune avec son ordre du jour préparé à partir des données, son relevé de décisions et le suivi de ses actions :</p><ul>${RE_ORDER.map((t) => `<li><b>${esc(t === "hebdo" ? "Revue hebdomadaire de chaque site" : RE_TYPES[t].label)}</b> · ${esc(RE_TYPES[t].cadence.toLowerCase())}, ${RE_TYPES[t].duration} min · ${esc(RE_TYPES[t].purpose)}</li>`).join("")}</ul>${reAdmin() ? '<button type="button" class="btn" data-re-setup>Mettre en place les quatre instances</button><p class="hint">Dates, heures, durées, animateurs et participants se modifient ensuite.</p>' : '<p class="hint">À mettre en place par le Responsable Lean.</p>'}</section>`;
  const soon = rows.filter((r) => r.next_date && reDays(r.next_date) <= 14).sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)) || String(a.time).localeCompare(String(b.time)));
  const agenda = soon.length ? `<section class="panel re-soon"><h2>Les 14 prochains jours</h2><ol class="re-timeline">${soon.map((r) => `<li class="${reDays(r.next_date) < 0 ? "late" : reDays(r.next_date) <= 1 ? "soon" : ""}"><span class="re-date">${esc(reWhen(r.next_date))}${r.time ? ` · ${esc(r.time)}` : ""}</span><button type="button" class="md-link" data-re-open="${esc(r.id)}">${esc(reTitle(r))}</button><small>${r.duration || "?"} min</small></li>`).join("")}</ol></section>` : "";
  const week = (g) => `<ul class="re-week">${g.sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)) || String(a.time).localeCompare(String(b.time))).map((r) => { const last = reSessions(r.id)[0], open = osActive(data.actions).filter((a) => a.meeting_series === r.id && isOpenAction(a)).length, n = reDays(r.next_date || today()); return `<li class="${r.next_date && n < 0 ? "late" : n <= 1 ? "soon" : ""}"><button type="button" class="re-week-main" data-re-open="${esc(r.id)}"><b>${esc(getSiteName(r.site_id))}</b><span>${esc(reWhen(r.next_date))}${r.time ? ` · ${esc(r.time)}` : ""}</span><small>${esc(r.chair || "")} · ${last ? `dernière le ${shortDate(last.date)}` : "pas encore tenue"}${open ? ` · ${jnPlural(open, "action ouverte", "actions ouvertes")}` : ""}</small></button></li>`; }).join("")}</ul>`;
  const groups = RE_ORDER.map((t) => { const g = rows.filter((r) => r.type === t); return g.length ? `<section class="section"><h2 class="re-h2">${esc(t === "hebdo" ? "Revues hebdomadaires des sites" : RE_TYPES[t].label)}</h2><p class="hint">${esc(RE_TYPES[t].purpose)}${t === "hebdo" ? ` ${RE_TYPES.hebdo.duration} min, chaque semaine.` : ""}</p>${t === "hebdo" ? week(g) : `<div class="re-grid">${g.map(reCard).join("")}</div>`}</section>` : ""; }).join("");
  const past = reSessions().filter((s) => { const r = reGet(s.instance_id); return r && reSee(r); }).slice(0, 10);
  const hist = past.length ? `<section class="panel section"><h2>Derniers relevés</h2><ul class="pm-rows">${past.map((s) => `<li><div class="pm-row-main"><b>${esc(reTitle(reGet(s.instance_id)))}</b><span>${shortDate(s.date)} · ${jnPlural((s.decisions || []).length, "décision", "décisions")} · ${jnPlural((s.action_ids || []).length, "action", "actions")}${s.by ? ` · ${esc(s.by)}` : ""}</span></div><div class="pm-row-act"><button type="button" class="btn secondary small" data-re-minutes="${esc(s.id)}">Relevé</button></div></li>`).join("")}</ul></section>` : "";
  return `${pageHead("Voir", "Réunions", "Chaque instance prépare son ordre du jour à partir des faits, garde ses décisions et suit ses actions.")}${agenda}${groups}${hist}`;
}
function reDraftKey(id) { return `bia-re-draft-${id}`; }
function reDraft(id) { try { return JSON.parse(localStorage.getItem(reDraftKey(id)) || "null"); } catch { return null; } }
function reSiteSelect(r, value = "") {
  if (r.site_id !== "group") return "";
  return `<select data-re-asite aria-label="Site de l’action"><option value="group">Groupe</option>${OPERATIONAL_SITES.map((s) => `<option value="${esc(s.id)}" ${s.id === value ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`;
}
function reActRow(r, a = {}) { return `<div class="re-act"><input data-re-aw placeholder="Quoi" value="${esc(a.w || "")}" aria-label="Quoi" autocomplete="off"><input data-re-ao list="ownerList" placeholder="Qui" value="${esc(a.o || "")}" aria-label="Qui"><input type="date" data-re-ad min="${today()}" value="${esc(a.d || reAddDays(today(), 7))}" aria-label="Pour quand">${reSiteSelect(r, a.s)}</div>`; }
function reDossier(id) {
  const r = reGet(id);
  if (!r || !reSee(r)) { state.meetOpen = null; return rePage(); }
  const t = RE_TYPES[r.type] || RE_TYPES.hebdo, hold = reHold(r), draft = hold ? reDraft(r.id) || {} : {};
  const blocks = t.agenda.map(([k, min]) => ({ k, min, ...reBlock(k, r) })), total = t.agenda.reduce((s, x) => s + x[1], 0);
  const people = String(r.participants || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean), present = new Set(draft.present || []);
  const pend = blocks.find((b) => b.pending)?.pending || [];
  const form = hold ? `<section class="panel re-close"><h2>Décisions et actions</h2>
      <div class="ap-field"><span class="metric-label">Présents</span><div class="filters">${people.map((p) => `<button type="button" class="chip ${present.has(p) ? "active" : ""}" data-re-p="${esc(p)}" aria-pressed="${present.has(p)}">${esc(p)}</button>`).join("")}</div><input id="reOthers" placeholder="Autres présents (facultatif)" value="${esc(draft.others || "")}" autocomplete="off"></div>
      ${pend.length ? `<div class="ap-field"><span class="metric-label">Décisions attendues : la réponse donnée</span>${pend.map((d) => `<label class="field re-dec-pend">${esc(d.title)}<input data-re-dp="${esc(d.id)}" placeholder="Décision prise (laisser vide si reportée)" value="${esc(draft.dp?.[d.id] || "")}"></label>`).join("")}</div>` : ""}
      <div class="ap-field"><span class="metric-label">Décisions prises</span><div id="reDecs">${(draft.decs?.length ? draft.decs : [""]).map((x) => `<input data-re-dec value="${esc(x)}" placeholder="Une décision, en une phrase" autocomplete="off">`).join("")}</div><button type="button" class="btn ghost small" data-re-add-dec>+ Décision</button></div>
      <div class="ap-field"><span class="metric-label">Actions : quoi, qui, pour quand</span><div id="reActs">${(draft.acts?.length ? draft.acts : [{}]).map((a) => reActRow(r, a)).join("")}</div><button type="button" class="btn ghost small" data-re-add-act>+ Action</button>${ownerDatalist()}</div>
      <label class="field">Prochaine réunion<input type="date" id="reNext" min="${today()}" value="${esc(draft.next || reNext(r.next_date && r.next_date > today() ? r.next_date : today(), r.cadence))}"></label>
      <div class="form-actions"><button type="button" class="btn jn-big" data-re-close>Clore la réunion et enregistrer le relevé</button></div><p class="hint">Le brouillon est gardé sur cet appareil jusqu’à la clôture.</p></section>` : "";
  const last = reSessions(r.id)[0];
  return `<div class="re-dossier" data-re-id="${esc(r.id)}"><div class="re-back"><button type="button" class="btn ghost small" data-re-back>← Toutes les réunions</button></div>
    ${pageHead(r.type === "hebdo" ? getSiteName(r.site_id) : "Réunion", reTitle(r), `${reWhen(r.next_date)}${r.time ? ` · ${r.time}` : ""} · ${r.duration || total} min · ${r.chair || ""}`, `<div class="row-actions re-head-acts"><button type="button" class="btn secondary" data-re-print>Imprimer le dossier</button><button type="button" class="btn ghost" data-re-ics="${esc(r.id)}">Agenda (.ics)</button>${reAdmin() ? `<button type="button" class="btn ghost" data-re-edit="${esc(r.id)}">Modifier</button>` : ""}</div>`)}
    <section class="panel re-odj"><h2>Ordre du jour · ${total} min</h2><ol>${blocks.map((b) => `<li><span>${esc(RE_BLOCKS[b.k])}</span><small>${b.min} min</small>${b.n ? `<b class="re-n">${b.n}</b>` : ""}</li>`).join("")}${hold ? "<li><span>Décisions et actions</span><small>à la fin</small></li>" : ""}</ol>${last ? `<p class="hint">Dernière réunion le ${shortDate(last.date)} · <button type="button" class="md-link" data-re-minutes="${esc(last.id)}">relevé</button></p>` : ""}</section>
    ${blocks.map((b, i) => `<section class="panel re-block ${b.n ? "attn" : ""}"><div class="re-bhead"><h3><span>${i + 1}</span>${esc(RE_BLOCKS[b.k])}</h3><small>≈ ${b.min} min</small></div>${b.html}${hold ? `<textarea data-re-note="${b.k}" rows="2" placeholder="Note de séance (facultatif)">${esc(draft.notes?.[b.k] || "")}</textarea>` : ""}</section>`).join("")}
    ${form}</div>`;
}
function reMinutes(s) {
  const r = reGet(s.instance_id) || { type: s.type, site_id: s.site_id, title: "" }, t = RE_TYPES[r.type] || RE_TYPES.hebdo, acts = (s.action_ids || []).map((id) => data.actions.find((a) => a.id === id)).filter(Boolean);
  return `<article class="id-sheet re-sheet"><header><div><small>RELEVÉ DE DÉCISIONS</small><h3>${esc(reTitle(r))}</h3><p>${shortDate(s.date)}${s.by ? ` · ${esc(s.by)}` : ""}</p></div></header>
    <p><b>Présents :</b> ${esc((s.present || []).join(", ") || "—")}</p>
    <h4>Décisions</h4>${(s.decisions || []).length ? `<ol>${s.decisions.map((d) => `<li>${esc(d.text)}${d.decision_id ? ` <small>(${esc(d.decision_id)})</small>` : ""}</li>`).join("")}</ol>` : "<p>Aucune décision enregistrée.</p>"}
    <h4>Actions</h4>${acts.length ? `<table class="cn-t"><thead><tr><th>Action</th><th>Qui</th><th>Pour quand</th><th>Statut</th></tr></thead><tbody>${acts.map((a) => `<tr><td>${esc(a.id)} · ${esc(a.title)}</td><td>${esc(a.owner)}</td><td>${shortDate(a.due_date)}</td><td>${esc(a.status)}</td></tr>`).join("")}</tbody></table>` : "<p>Aucune action.</p>"}
    ${Object.entries(s.notes || {}).filter(([, v]) => v).length ? `<h4>Notes</h4><dl class="id-dl">${t.agenda.filter(([k]) => s.notes?.[k]).map(([k]) => `<div><dt>${esc(RE_BLOCKS[k])}</dt><dd>${esc(s.notes[k])}</dd></div>`).join("")}</dl>` : ""}
    <p><b>Prochaine réunion :</b> ${s.next_date ? shortDate(s.next_date) : "à fixer"}</p><footer>${esc(s.id)}</footer></article>`;
}
function reOpenMinutes(id) {
  const s = (data.instanceSessions || []).find((x) => x.id === id);
  if (!s) return;
  modal("Relevé de décisions", `${reMinutes(s)}<style media="print">@page{size:A4;margin:12mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
  $("modalContent").querySelector("[data-print]").onclick = () => window.print();
}

/* ---------- Écriture ---------- */

function reSetup() {
  if (!reAdmin()) return toast("La mise en place revient au Responsable Lean.");
  if (reRows().length) return toast("Les instances existent déjà.");
  const monday = reAddDays(today(), ((8 - new Date(today() + "T12:00:00").getDay()) % 7) || 7);
  const nth = (n, wd, ahead = 1) => { const m = reAddMonths(today().slice(0, 8) + "01", ahead); const d = new Date(m + "T12:00:00"); const first = (wd - d.getDay() + 7) % 7; return reAddDays(m, first + (n - 1) * 7); };
  const make = (type, site_id, next_date, time, extra = {}) => { const t = RE_TYPES[type]; return { type, site_id, title: t.label, cadence: t.cadence, time, duration: t.duration, chair: t.chair, participants: t.participants, next_date, created_at: now(), ...extra }; };
  if (!commitData(() => {
    data.instances ||= [];
    const add = (row) => data.instances.push({ id: auNext("INS", data.instances), ...row });
    add(make("comex", "group", nth(1, 4, 2), "10:00"));
    add(make("copil", "group", nth(2, 2), "14:00"));
    add(make("mensuelle", "group", nth(1, 1), "10:00"));
    OPERATIONAL_SITES.forEach((s, i) => { const owner = osRecord(s.id)?.row.owner; add(make("hebdo", s.id, reAddDays(monday, Math.floor(i / 2)), i % 2 ? "14:00" : "09:00", { chair: owner && !/^à /i.test(owner) ? owner : RE_TYPES.hebdo.chair })); });
  })) return;
  render(); toast(`${reRows().length} instances en place : ajustez dates, heures et animateurs avec « Modifier ».`);
}
function reEdit(id) {
  const r = reGet(id);
  if (!r || !reAdmin()) return;
  let cadence = r.cadence;
  modal("Modifier l’instance", `<form id="reEditForm" class="jn-form"><label class="field">Titre<input id="reTitle" required value="${esc(r.title || "")}"></label>
    <div class="ap-field"><span class="metric-label">Cadence</span><div class="filters">${RE_CADENCES.map(([c]) => `<button type="button" class="chip ${c === cadence ? "active" : ""}" data-re-c="${esc(c)}" aria-pressed="${c === cadence}">${esc(c)}</button>`).join("")}</div></div>
    <div class="bp-two"><label class="field">Prochaine date<input type="date" id="reDate" value="${esc(r.next_date || "")}" required></label><label class="field">Heure<input type="time" id="reTime" value="${esc(r.time || "")}"></label></div>
    <div class="bp-two"><label class="field">Durée (min)<input id="reDur" inputmode="numeric" value="${esc(String(r.duration || ""))}"></label><label class="field">Animateur<input id="reChair" list="ownerList" value="${esc(r.chair || "")}">${ownerDatalist()}</label></div>
    <label class="field">Participants (séparés par des virgules)<input id="reParts" value="${esc(r.participants || "")}"></label>
    <div class="form-actions"><button class="btn jn-big">Enregistrer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("reEditForm");
  root.querySelectorAll("[data-re-c]").forEach((b) => (b.onclick = () => { cadence = b.dataset.reC; root.querySelectorAll("[data-re-c]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); modalDirty = true; }));
  root.onsubmit = (e) => {
    e.preventDefault();
    const dur = Number($("reDur").value);
    if (!$("reTitle").value.trim() || !$("reDate").value) return toast("Un titre et une date.");
    if (!commitData(() => Object.assign(data.instances.find((x) => x.id === id), { title: $("reTitle").value.trim(), cadence, next_date: $("reDate").value, time: $("reTime").value, duration: Number.isFinite(dur) && dur > 0 ? dur : r.duration, chair: $("reChair").value.trim(), participants: $("reParts").value.trim(), updated_at: now() }))) return;
    modalDirty = false; closeModal(); render(); toast("Instance mise à jour.");
  };
}
function reCollect(root) {
  return {
    present: [...root.querySelectorAll("[data-re-p].active")].map((b) => b.dataset.reP), others: $("reOthers")?.value || "",
    notes: Object.fromEntries([...root.querySelectorAll("[data-re-note]")].map((t) => [t.dataset.reNote, t.value])),
    dp: Object.fromEntries([...root.querySelectorAll("[data-re-dp]")].map((t) => [t.dataset.reDp, t.value])),
    decs: [...root.querySelectorAll("[data-re-dec]")].map((t) => t.value),
    acts: [...root.querySelectorAll(".re-act")].map((x) => ({ w: x.querySelector("[data-re-aw]").value, o: x.querySelector("[data-re-ao]").value, d: x.querySelector("[data-re-ad]").value, s: x.querySelector("[data-re-asite]")?.value || "" })),
    next: $("reNext")?.value || "",
  };
}
function reClose(id) {
  const r = reGet(id), root = document.querySelector(".re-dossier");
  if (!r || !root || !reHold(r)) return;
  const d = reCollect(root), acts = d.acts.filter((a) => a.w.trim() || a.o.trim()), decs = d.decs.map((x) => x.trim()).filter(Boolean), dp = Object.entries(d.dp).filter(([, v]) => v.trim());
  const bad = acts.find((a) => !a.w.trim() || !a.o.trim() || !a.d);
  if (bad) return toast("Chaque action : quoi, qui et pour quand.");
  if (!d.next) return toast("La date de la prochaine réunion.");
  const by = apMe() || osActor(), counts = Object.fromEntries((RE_TYPES[r.type]?.agenda || []).map(([k]) => [k, reBlock(k, r).n]));
  let sid = null;
  if (!commitData(() => {
    data.instanceSessions ||= [];
    sid = auNext("RE", data.instanceSessions);
    const ids = acts.map((a) => {
      const aid = auNext("A", data.actions), site = r.site_id !== "group" ? r.site_id : a.s || "group";
      data.actions.unshift({ id: aid, site_id: site, title: a.w.trim(), description: `${reTitle(r)} du ${shortDate(today())}`, owner: a.o.trim(), due_date: a.d, due_date_initial: a.d, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Pilotage", origin_type: "Réunion", origin_id: null, meeting_id: sid, meeting_series: r.id, created_at: now(), updated_at: now() });
      return aid;
    });
    const decisions = decs.map((text) => ({ text }));
    dp.forEach(([did, text]) => { const x = data.decisions.find((y) => y.id === did); if (x) { x.status = "Clos"; x.result = text.trim(); x.updated_at = now(); recordHistory(x, "Clos", `${reTitle(r)} du ${shortDate(today())}`); decisions.push({ text: `${x.title} : ${text.trim()}`, decision_id: did }); } });
    const present = [...d.present, ...d.others.split(/[,;]/).map((x) => x.trim()).filter(Boolean)];
    data.instanceSessions.unshift({ id: sid, instance_id: r.id, type: r.type, site_id: r.site_id, date: today(), by, present, notes: Object.fromEntries(Object.entries(d.notes).filter(([, v]) => v.trim())), decisions, action_ids: ids, counts, next_date: d.next, created_at: now() });
    const inst = data.instances.find((x) => x.id === r.id);
    inst.last_date = today(); inst.next_date = d.next; inst.updated_at = now();
  })) return;
  try { localStorage.removeItem(reDraftKey(r.id)); } catch { /* stockage indisponible : rien à effacer */ }
  if (typeof idSetMe === "function") idSetMe(by);
  state.meetOpen = null; render(); reOpenMinutes(sid);
  toast(`Relevé enregistré${acts.length ? ` · ${jnPlural(acts.length, "action créée", "actions créées")}` : ""}. Prochaine réunion le ${shortDate(d.next)}.`);
}
function reIcs(id) {
  const r = reGet(id);
  if (!r) return;
  const rule = { Hebdomadaire: "FREQ=WEEKLY", "Toutes les 2 semaines": "FREQ=WEEKLY;INTERVAL=2", Mensuel: "FREQ=MONTHLY", "Toutes les 6 semaines": "FREQ=WEEKLY;INTERVAL=6", Trimestriel: "FREQ=MONTHLY;INTERVAL=3" }[r.cadence] || "FREQ=WEEKLY";
  const d = String(r.next_date || today()).replace(/-/g, ""), tm = String(r.time || "09:00").replace(":", "") + "00", t = RE_TYPES[r.type] || RE_TYPES.hebdo;
  const txt = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const desc = `${t.purpose}\nOrdre du jour : ${t.agenda.map(([k, m]) => `${RE_BLOCKS[k]} (${m} min)`).join(", ")}.\nDossier préparé dans BIA Lean OS › Voir › Réunions.`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BIA Lean OS//Réunions//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${r.id}@bia-lean-os`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART:${d}T${tm}`, `DURATION:PT${r.duration || t.duration}M`, `RRULE:${rule}`, `SUMMARY:${txt(reTitle(r))}`, `DESCRIPTION:${txt(desc)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = `${reTitle(r).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return ics;
}

/* ---------- Branchements ---------- */

state.meetOn ??= false;
const reDailyBase = renderOSDaily;
renderOSDaily = function () { return state.meetOn && reCan() ? (state.meetOpen ? reDossier(state.meetOpen) : rePage()) : reDailyBase.apply(this, arguments); };
const reSwitchBase = switchView;
switchView = function (view) { if (view !== "daily") { state.meetOn = false; state.meetOpen = null; } return reSwitchBase.apply(this, arguments); };
const reTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = reTabsBase(stage);
  if (stage?.id !== "voir" || !reCan()) return out;
  const daily = out.find((t) => t.view === "daily");
  if (daily) daily.set = { ...(daily.set || {}), meetOn: false };
  if (!out.some((t) => t.key === "meetings")) {
    const i = out.findIndex((t) => t.view === "pilotage");
    out.splice(i + 1, 0, { key: "meetings", label: "Réunions", view: "daily", set: { meetOn: true, meetOpen: null } });
  }
  return out;
};
const reTabActiveBase = uxTabActive;
uxTabActive = function (tab) { return tab?.key === "meetings" ? state.view === "daily" && !!state.meetOn : reTabActiveBase(tab); };
const reWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = reWatchBase();
  if (!reCan() || role().readonly) return base;
  const due = reRows().filter((r) => reSee(r) && reHold(r) && r.next_date && reDays(r.next_date) <= 1 && (state.site === "group" || r.site_id === "group" || r.site_id === state.site)).sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)));
  if (!due.length) return base;
  const rows = due.slice(0, 3).map((r) => `<button type="button" class="jn-row" data-re-go="${esc(r.id)}"><span class="jn-row-main"><span class="jn-tag ${reDays(r.next_date) < 0 ? "tone-open" : "tone-progress"}">Réunion</span><b>${esc(reTitle(r))}</b><span class="hint">${esc(reWhen(r.next_date))}${r.time ? ` · ${esc(r.time)}` : ""} · dossier prêt</span></span></button>`).join("");
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${rows}$2`);
};
function reBind(root = document) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = () => fn(b)));
  on("[data-re-setup]", () => reSetup());
  on("[data-re-open]", (b) => { state.meetOn = true; state.meetOpen = b.dataset.reOpen; render(); window.scrollTo(0, 0); });
  on("[data-re-back]", () => { state.meetOpen = null; render(); window.scrollTo(0, 0); });
  on("[data-re-edit]", (b) => reEdit(b.dataset.reEdit));
  on("[data-re-ics]", (b) => { reIcs(b.dataset.reIcs); toast("Fichier agenda téléchargé : ouvrez-le dans Outlook."); });
  on("[data-re-minutes]", (b) => reOpenMinutes(b.dataset.reMinutes));
  on("[data-re-print]", () => window.print());
  on("[data-re-go]", (b) => { state.meetOn = true; state.meetOpen = b.dataset.reGo; switchView("daily"); });
  const dos = root.querySelector(".re-dossier");
  if (!dos) return;
  const id = dos.dataset.reId, r = reGet(id), save = () => { try { localStorage.setItem(reDraftKey(id), JSON.stringify(reCollect(dos))); } catch { /* brouillon non conservé : la saisie reste à l'écran */ } };
  dos.querySelectorAll("[data-re-p]").forEach((b) => (b.onclick = () => { const v = !b.classList.contains("active"); b.classList.toggle("active", v); b.setAttribute("aria-pressed", String(v)); save(); }));
  const addDec = dos.querySelector("[data-re-add-dec]");
  if (addDec) addDec.onclick = () => { $("reDecs").insertAdjacentHTML("beforeend", '<input data-re-dec placeholder="Une décision, en une phrase" autocomplete="off">'); $("reDecs").lastElementChild.focus(); };
  const addAct = dos.querySelector("[data-re-add-act]");
  if (addAct) addAct.onclick = () => { $("reActs").insertAdjacentHTML("beforeend", reActRow(r)); $("reActs").lastElementChild.querySelector("input")?.focus(); };
  const closeBtn = dos.querySelector("[data-re-close]");
  if (closeBtn) closeBtn.onclick = () => reClose(id);
  dos.oninput = save;
  dos.onchange = save;
}
const reOsBindBase = osBind;
osBind = function () { const out = reOsBindBase.apply(this, arguments); reBind(document); return out; };
