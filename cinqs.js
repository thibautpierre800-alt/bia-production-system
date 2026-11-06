"use strict";
/*
 * BIA Lean OS 8.10 · 5S par zone (Observer › 5S).
 * Repris des logiciels 5S du marché, avec l'ergonomie du terrain :
 *  - des zones tenues par une équipe, avec un pilote, une cible, une fréquence d'audit et la photo de l'état de référence ;
 *  - un audit court au téléphone : une étape par S, trois gros boutons Non / Partiel / Oui, la preuve n'est demandée
 *    qu'en cas d'écart, la photo de référence sous les yeux, un brouillon gardé à chaque geste ;
 *  - un bilan : radar des 5 S contre la cible et l'audit précédent, écarts transformés en actions du plan ;
 *  - des étiquettes rouges numérotées, imprimables, avec décision et échéance ;
 *  - une fiche de zone à afficher au poste.
 * Données : zones[].five_s {frequency_days, target, ref_photos[]} ; audits[] de type « 5S » avec zone_id et five_s
 * {answers, s_scores} ; redTags[] (nouvelle collection). Les actions vont dans le plan d'actions (origine Audit).
 */

const CS_S = [
  { n: 1, key: "trier", name: "Trier", long: "Supprimer l’inutile", hint: "Garder seulement ce qui sert ici et maintenant." },
  { n: 2, key: "ranger", name: "Ranger", long: "Une place pour chaque chose", hint: "Chaque chose à sa place, trouvée en moins de 30 secondes." },
  { n: 3, key: "nettoyer", name: "Nettoyer", long: "Nettoyer, c’est inspecter", hint: "Propre, et les anomalies se voient." },
  { n: 4, key: "standardiser", name: "Standardiser", long: "Rendre la règle visible", hint: "Le standard est affiché, les écarts sautent aux yeux." },
  { n: 5, key: "maintenir", name: "Maintenir", long: "Tenir dans la durée", hint: "Audits à l’heure, actions faites, règles tenues sans rappel." },
];
const CS_CRITERIA = [
  ["trier", "cs-t1", "Rien d’inutile au poste : outils, pièces, documents ou matières sans usage"],
  ["trier", "cs-t2", "Les en-cours et le stock sont limités à ce qui est nécessaire"],
  ["trier", "cs-t3", "Les objets douteux portent une étiquette rouge et sont traités"],
  ["ranger", "cs-r1", "Chaque chose a une place repérée : marquage au sol, étiquette, silhouette"],
  ["ranger", "cs-r2", "Chaque chose est à sa place ; un outil se trouve en moins de 30 secondes"],
  ["ranger", "cs-r3", "Allées, issues de secours, extincteurs et armoires électriques sont dégagés"],
  ["nettoyer", "cs-n1", "Sols, machines et postes sont propres"],
  ["nettoyer", "cs-n2", "Les sources de salissure (copeaux, poussière, colle, fuites) sont connues et traitées"],
  ["nettoyer", "cs-n3", "Le nettoyage sert d’inspection : les anomalies sont repérées et signalées"],
  ["standardiser", "cs-s1", "Le standard de la zone est affiché : photo de référence, règles de rangement et de nettoyage"],
  ["standardiser", "cs-s2", "Qui nettoie quoi, et à quelle fréquence, est défini"],
  ["standardiser", "cs-s3", "Les écarts se voient d’un coup d’œil : repères, mini-maxi, codes couleur"],
  ["maintenir", "cs-m1", "Le dernier audit a eu lieu à la date prévue et son résultat est affiché"],
  ["maintenir", "cs-m2", "Les actions du dernier audit sont faites"],
  ["maintenir", "cs-m3", "L’équipe applique les règles sans rappel"],
];
const CS_SAFETY = new Set(["cs-r3"]);
const CS_VALUES = [[0, "Non", "bad"], [1, "Partiel", "warn"], [2, "Oui", "ok"]];
const CS_FREQ = [[7, "Chaque semaine"], [14, "Toutes les 2 semaines"], [30, "Chaque mois"]];
const CS_TAG_REASONS = ["Inutile", "En trop", "Mal placé", "Défectueux", "Inconnu"];
const CS_TAG_DECISIONS = ["À décider", "Jeter", "Déplacer", "Réparer", "Garder ici"];
let csRun = null;

/* ---------- Données ---------- */

function csCan() { return role().nav.includes("audits"); }
function csWritable(siteId) { return csCan() && osWritable(siteId); }
function csZones() { return scoped(data.zones || []).sort((a, b) => String(a.name).localeCompare(String(b.name), "fr")); }
function csZone(id) { return (data.zones || []).find((z) => z.id === id && !z.archived_at); }
function csCfg(z) { return { frequency_days: 30, target: 80, ref_photos: [], ...(z?.five_s || {}) }; }
function csAudits(zoneId) { return (data.audits || []).filter((a) => a.zone_id === zoneId && a.five_s && !a.archived_at).sort((a, b) => String(a.performed_at).localeCompare(String(b.performed_at)) || String(a.created_at).localeCompare(String(b.created_at))); }
function csDone(zoneId) { return csAudits(zoneId).filter((a) => a.status === "Terminé"); }
function csDraftOf(zoneId) { return csAudits(zoneId).find((a) => a.status === "Brouillon"); }
function csTags(filter = () => true) { return (data.redTags || []).filter((t) => !t.archived_at && allowedSite(t.site_id) && filter(t)); }
function csOpenTags(zoneId = null) { return csTags((t) => t.status !== "Traitée" && (!zoneId || t.zone_id === zoneId)); }
function csAddDays(day, n) { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function csDue(z) {
  const last = csDone(z.id).at(-1);
  return last ? csAddDays(String(last.performed_at).slice(0, 10), csCfg(z).frequency_days) : null;
}
function csDueLabel(z) {
  const due = csDue(z);
  if (!due) return { cls: "late", text: "Jamais auditée" };
  const n = daysUntil(due);
  if (n < 0) return { cls: "late", text: `Audit en retard de ${-n} j` };
  if (n === 0) return { cls: "soon", text: "Audit aujourd’hui" };
  return { cls: n <= 3 ? "soon" : "", text: `Prochain audit dans ${n} j` };
}
function csTone(score, target) {
  if (score === null || score === undefined) return "none";
  return score >= target ? "ok" : score >= target - 20 ? "warn" : "bad";
}
function csScores(answers = {}) {
  return CS_S.map((s) => {
    const vals = CS_CRITERIA.filter((c) => c[0] === s.key).map((c) => answers[c[1]]?.v).filter((v) => v === 0 || v === 1 || v === 2);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 2)) * 100) : null;
  });
}
function csTotal(scores) { const v = scores.filter((x) => x !== null && x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
function csSOf(cid) { return CS_S.find((s) => s.key === CS_CRITERIA.find((c) => c[1] === cid)?.[0]); }
function csCritText(cid) { return CS_CRITERIA.find((c) => c[1] === cid)?.[2] || ""; }
function csActionsOf(audit) { return data.actions.filter((a) => a.origin_id === audit.id && !a.archived_at); }
function csZoneActions(zoneId) {
  const ids = new Set(csAudits(zoneId).map((a) => a.id));
  return data.actions.filter((a) => !a.archived_at && ids.has(a.origin_id));
}

/* ---------- Graphiques ---------- */

function csRadar(scores, { prev = null, target = 80, size = 260 } = {}) {
  const c = 130, r = 82, pt = (i, v) => { const a = (-90 + i * 72) * (Math.PI / 180), k = (r * Math.max(0, Math.min(100, v ?? 0))) / 100; return [c + k * Math.cos(a), 118 + k * Math.sin(a)]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
  const rings = [25, 50, 75, 100].map((v) => `<polygon class="cs-ring" points="${poly([v, v, v, v, v])}"/>`).join("");
  const axes = CS_S.map((s, i) => { const [x, y] = pt(i, 100); return `<line class="cs-axis" x1="${c}" y1="118" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const labels = CS_S.map((s, i) => {
    const [x, y] = pt(i, 128), anchor = Math.abs(x - c) < 8 ? "middle" : x > c ? "start" : "end", v = scores[i];
    return `<text class="cs-lab" x="${x.toFixed(1)}" y="${(y + (i === 0 ? -2 : 4)).toFixed(1)}" text-anchor="${anchor}"><tspan class="cs-lab-n">${s.n}S ${esc(s.name)}</tspan><tspan class="cs-lab-v" x="${x.toFixed(1)}" dy="14">${v === null || v === undefined ? "—" : v + " %"}</tspan></text>`;
  }).join("");
  const has = scores.some((v) => v !== null && v !== undefined);
  return `<svg class="cs-radar" viewBox="0 0 260 252" width="${size}" role="img" aria-label="Radar des 5 S : ${CS_S.map((s, i) => `${s.name} ${scores[i] ?? "non noté"}`).join(", ")}">
    ${rings}${axes}<polygon class="cs-target" points="${poly([target, target, target, target, target])}"/>
    ${prev && prev.some((v) => v !== null && v !== undefined) ? `<polygon class="cs-prev" points="${poly(prev)}"/>` : ""}
    ${has ? `<polygon class="cs-now" points="${poly(scores)}"/>${scores.map((v, i) => (v === null || v === undefined ? "" : `<circle class="cs-dot" cx="${pt(i, v)[0].toFixed(1)}" cy="${pt(i, v)[1].toFixed(1)}" r="4"/>`)).join("")}` : ""}
    ${labels}</svg>`;
}
function csTrend(audits, target) {
  const rows = audits.slice(-8);
  if (rows.length < 2) return "";
  const w = 240, h = 64, x = (i) => 12 + (i * (w - 24)) / (rows.length - 1), y = (v) => h - 10 - ((h - 20) * v) / 100;
  return `<figure class="cs-trend"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution du score : ${rows.map((a) => a.score + " %").join(", ")}">
    <line class="cs-trend-target" x1="0" x2="${w}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/>
    <polyline class="cs-trend-line" points="${rows.map((a, i) => `${x(i).toFixed(1)},${y(a.score).toFixed(1)}`).join(" ")}"/>
    ${rows.map((a, i) => `<circle class="cs-trend-dot tone-${csTone(a.score, target)}" cx="${x(i).toFixed(1)}" cy="${y(a.score).toFixed(1)}" r="3.5"/>`).join("")}</svg>
    <figcaption>${rows.length} derniers audits · cible ${target} %</figcaption></figure>`;
}
function csStrip(scores, target) {
  return `<span class="cs-strip" aria-hidden="true">${CS_S.map((s, i) => `<span class="tone-${csTone(scores?.[i], target)}" title="${s.n}S ${esc(s.name)}"><i style="height:${Math.max(8, scores?.[i] ?? 0)}%"></i><b>${s.n}</b></span>`).join("")}</span>`;
}

/* ---------- Page 5S ---------- */

function csCard(z) {
  const cfg = csCfg(z), done = csDone(z.id), last = done.at(-1), prev = done.at(-2), due = csDueLabel(z), tags = csOpenTags(z.id).length, draft = csDraftOf(z.id);
  const delta = last && prev ? last.score - prev.score : null, ref = cfg.ref_photos[0];
  return `<button type="button" class="cs-card tone-${csTone(last?.score, cfg.target)}" data-cs-zone="${esc(z.id)}">
    <span class="cs-card-top"><span class="cs-where">${esc(getSiteName(z.site_id))}${z.workshop_id ? " · " + esc(data.workshops.find((w) => w.id === z.workshop_id)?.name || "") : ""}</span><span class="cs-due ${due.cls}">${esc(draft ? "Audit en cours" : due.text)}</span></span>
    <span class="cs-card-body"><span class="cs-card-main"><b class="cs-card-name">${esc(z.name)}</b>
      <span class="cs-score-line"><span class="cs-score">${last ? last.score : "—"}<small>${last ? " %" : ""}</small></span>${delta !== null ? `<span class="cs-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}</span>` : ""}<span class="cs-target-txt">cible ${cfg.target} %</span></span>
      ${csStrip(last?.five_s?.s_scores, cfg.target)}</span>
      ${ref ? phImg(ref, "cs-card-ref", "État de référence") : '<span class="cs-card-ref cs-noref">Pas de photo de référence</span>'}</span>
    <span class="cs-card-foot">${z.owner ? `Pilote : ${esc(z.owner)}` : "Pilote à désigner"}${tags ? ` · <em>${jnPlural(tags, "étiquette rouge", "étiquettes rouges")}</em>` : ""}</span></button>`;
}
function csTagRow(t) {
  const late = t.status !== "Traitée" && t.due_date && t.due_date < today(), z = csZone(t.zone_id);
  return `<button type="button" class="cs-tag-row ${late ? "late" : ""}" data-cs-tag="${esc(t.id)}">${phImg(t.photo, "cs-tag-thumb", "") || '<span class="cs-tag-thumb cs-tag-none">ER</span>'}
    <span class="cs-tag-main"><span class="cs-tag-id">${esc(t.id)} · ${esc(t.reason || "")}</span><b>${esc(t.what)}${t.qty ? ` · ${esc(t.qty)}` : ""}</b><span class="hint">${esc(getSiteName(t.site_id))}${z ? " · " + esc(z.name) : ""} · ${esc(t.decision || "À décider")}${t.owner ? " · " + esc(t.owner) : ""}</span></span>
    <span class="cs-tag-due ${late ? "late" : ""}">${t.status === "Traitée" ? "Traitée" : t.due_date ? (late ? "En retard" : shortDate(t.due_date)) : "Sans date"}</span></button>`;
}
function csPage() {
  const zones = csZones(), writable = !role().readonly && (state.site === "group" ? canGroup() : osWritable(state.site));
  const lasts = zones.map((z) => csDone(z.id).at(-1)).filter(Boolean), avg = lasts.length ? Math.round(lasts.reduce((s, a) => s + a.score, 0) / lasts.length) : null;
  const late = zones.filter((z) => { const d = csDue(z); return !d || d < today(); }).length, tags = csOpenTags().filter((t) => state.site === "group" || t.site_id === state.site);
  const lateTags = tags.filter((t) => t.due_date && t.due_date < today()).length;
  const head = pageHead("Observer", "5S", "Trier, ranger, nettoyer, standardiser, maintenir : zone par zone, avec l’équipe qui la tient.", writable ? `<div class="cs-head-tools"><button type="button" class="btn" data-cs-audit>Auditer une zone</button><button type="button" class="btn secondary" data-cs-newtag>+ Étiquette rouge</button><button type="button" class="btn ghost" data-cs-newzone>+ Zone</button></div>` : "");
  const strip = zones.length ? `<div class="cs-summary"><div><b>${zones.length}</b><span>${zones.length > 1 ? "zones" : "zone"}</span></div><div><b>${avg ?? "—"}${avg !== null ? " %" : ""}</b><span>score moyen</span></div><div class="${late ? "bad" : ""}"><b>${late}</b><span>audit${late > 1 ? "s" : ""} à faire ou en retard</span></div><div class="${lateTags ? "bad" : ""}"><b>${tags.length}</b><span>étiquette${tags.length > 1 ? "s" : ""} rouge${tags.length > 1 ? "s" : ""} ouverte${tags.length > 1 ? "s" : ""}${lateTags ? ` · ${lateTags} en retard` : ""}</span></div></div>` : "";
  let grid;
  if (!zones.length) grid = `<section class="cs-empty"><h2>Commencez par une zone</h2><p>Une zone, c’est un périmètre qu’une équipe tient au quotidien : un poste, un îlot, un magasin, une allée. Elle a un pilote, une photo de l’état de référence et un audit régulier.</p>${writable ? '<button type="button" class="btn" data-cs-newzone>Créer la première zone</button>' : ""}</section>`;
  else if (state.site === "group") {
    const bySite = OPERATIONAL_SITES.map((s) => [s, zones.filter((z) => z.site_id === s.id)]).filter(([, l]) => l.length);
    grid = bySite.map(([s, l]) => { const ls = l.map((z) => csDone(z.id).at(-1)).filter(Boolean), a = ls.length ? Math.round(ls.reduce((n, x) => n + x.score, 0) / ls.length) : null; return `<section class="cs-site"><h2>${esc(s.name)} <span>${jnPlural(l.length, "zone", "zones")}${a !== null ? ` · moyenne ${a} %` : ""}</span></h2><div class="cs-grid">${l.map(csCard).join("")}</div></section>`; }).join("");
  } else grid = `<div class="cs-grid">${zones.map(csCard).join("")}</div>`;
  const tagList = tags.length ? `<section class="cs-tags section"><div class="section-title"><h2>Étiquettes rouges ouvertes</h2></div><div class="cs-tag-list">${tags.sort((a, b) => String(a.due_date || "9").localeCompare(String(b.due_date || "9"))).slice(0, 12).map(csTagRow).join("")}</div>${tags.length > 12 ? `<p class="hint">+ ${tags.length - 12} autres dans les fiches de zone.</p>` : ""}</section>` : "";
  const how = `<details class="cs-how section"><summary>Les 5 S et la façon d’auditer</summary><ol class="cs-how-list">${CS_S.map((s) => `<li><b>${s.n}S · ${esc(s.name)}</b><span>${esc(s.long)} : ${esc(s.hint)}</span></li>`).join("")}</ol><p class="hint">L’audit dure une dizaine de minutes : trois questions par S, réponse Non, Partiel ou Oui. On ne note un fait ou une photo qu’en cas d’écart, et chaque écart peut devenir une action du plan. La photo de l’état de référence est montrée pendant l’audit. Rythme conseillé : chaque mois, par le pilote de la zone ou un pair d’une autre zone.</p></details>`;
  return `${head}${strip}${grid}${tagList}${how}`;
}

/* ---------- Zone ---------- */

function csZoneForm(id = null, after = null) {
  const old = id ? csZone(id) : null, cfg = csCfg(old), sites = OPERATIONAL_SITES.filter((s) => osWritable(s.id));
  if (!sites.length || role().readonly) return toast("Votre profil ne permet pas de créer une zone.");
  let siteId = old?.site_id || (state.site !== "group" && osWritable(state.site) ? state.site : sites[0].id);
  const shops = (sid) => `<option value="">Toute la zone, sans atelier</option>${data.workshops.filter((w) => w.site_id === sid && !w.archived_at).map((w) => `<option value="${esc(w.id)}" ${old?.workshop_id === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}`;
  modal(old ? `${old.name} · Zone 5S` : "Nouvelle zone 5S", `<form id="csZoneForm" class="jn-form">
    ${!old && sites.length > 1 ? `<div class="ap-field"><span class="metric-label">Site</span><div class="filters">${sites.map((s) => `<button type="button" class="chip ${s.id === siteId ? "active" : ""}" data-cs-site="${esc(s.id)}" aria-pressed="${s.id === siteId}">${esc(s.name)}</button>`).join("")}</div></div>` : ""}
    <label class="field">Nom de la zone<input id="csZoneName" required value="${esc(old?.name || "")}" placeholder="Ex. Magasin matières, îlot de collage, poste 3"></label>
    <label class="field">Atelier<select id="csZoneShop">${shops(siteId)}</select></label>
    <label class="field">Pilote de la zone<input id="csZoneOwner" list="ownerList" value="${esc(old?.owner || "")}" placeholder="La personne qui tient la zone au quotidien">${ownerDatalist()}</label>
    <div class="ap-field"><span class="metric-label">Audit</span><div class="filters">${CS_FREQ.map(([d, l]) => `<button type="button" class="chip ${d === cfg.frequency_days ? "active" : ""}" data-cs-freq="${d}" aria-pressed="${d === cfg.frequency_days}">${esc(l)}</button>`).join("")}</div></div>
    <label class="field">Cible<span class="cs-inline"><input id="csZoneTarget" type="number" min="40" max="100" step="5" value="${cfg.target}"> %</span></label>
    <div class="form-actions"><button class="btn">${old ? "Enregistrer" : "Créer la zone"}</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  let freq = cfg.frequency_days;
  root.querySelectorAll("[data-cs-site]").forEach((b) => (b.onclick = () => { siteId = b.dataset.csSite; root.querySelectorAll("[data-cs-site]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); }); $("csZoneShop").innerHTML = shops(siteId); }));
  root.querySelectorAll("[data-cs-freq]").forEach((b) => (b.onclick = () => { freq = Number(b.dataset.csFreq); root.querySelectorAll("[data-cs-freq]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); }); }));
  setTimeout(() => $("csZoneName")?.focus(), 0);
  $("csZoneForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("csZoneName").value.trim(), target = Math.min(100, Math.max(40, Number($("csZoneTarget").value) || 80));
    if (!name) return toast("Donnez un nom à la zone.");
    if (!osWritable(siteId)) return toast("Site hors de votre périmètre.");
    const zid = old?.id || uid("ZONE");
    if (!commitData(() => {
      data.zones ||= [];
      const row = data.zones.find((z) => z.id === zid);
      const patch = { name, site_id: siteId, workshop_id: $("csZoneShop").value || null, owner: $("csZoneOwner").value.trim(), five_s: { ...csCfg(old), frequency_days: freq, target }, updated_at: now() };
      if (row) Object.assign(row, patch); else data.zones.push({ id: zid, ...patch, created_at: now() });
    })) return;
    modalDirty = false;
    render();
    toast(old ? "Zone enregistrée." : `Zone « ${name} » créée. Ajoutez la photo de l’état de référence.`);
    if (after) after(zid); else csZoneOpen(zid);
  };
}
function csZoneOpen(id) {
  const z = csZone(id);
  if (!z || !allowedSite(z.site_id)) return;
  const cfg = csCfg(z), done = csDone(z.id), last = done.at(-1), prev = done.at(-2), writable = csWritable(z.site_id), due = csDueLabel(z), draft = csDraftOf(z.id);
  const tags = csOpenTags(z.id), actions = csZoneActions(z.id).filter((a) => isOpenAction(a));
  modal(`${z.name} · 5S`, `<div class="cs-zone">
    <p class="jn-where">${esc(getSiteName(z.site_id))}${z.workshop_id ? " · " + esc(data.workshops.find((w) => w.id === z.workshop_id)?.name || "") : ""} · ${z.owner ? "pilote " + esc(z.owner) : "pilote à désigner"}</p>
    <p class="cs-zone-meta"><span class="cs-due ${due.cls}">${esc(draft ? "Audit en cours" : due.text)}</span> · ${esc(CS_FREQ.find(([d]) => d === cfg.frequency_days)?.[1] || `tous les ${cfg.frequency_days} jours`)} · cible ${cfg.target} %</p>
    ${writable ? `<div class="cs-zone-tools"><button type="button" class="btn jn-big" data-cs-start="${esc(z.id)}">${draft ? "Reprendre l’audit" : "Auditer la zone"}</button><button type="button" class="btn secondary" data-cs-newtag="${esc(z.id)}">+ Étiquette rouge</button></div>` : ""}
    <div class="cs-zone-score"><div class="cs-zone-big tone-${csTone(last?.score, cfg.target)}"><span>${last ? last.score : "—"}<small>${last ? " %" : ""}</small></span><em>${last ? `audit du ${shortDate(last.performed_at)}${prev ? ` · ${last.score - prev.score >= 0 ? "+" : ""}${last.score - prev.score} pts` : ""}` : "pas encore auditée"}</em></div>
      ${csRadar(last?.five_s?.s_scores || [null, null, null, null, null], { prev: prev?.five_s?.s_scores, target: cfg.target })}
      ${csTrend(done, cfg.target)}</div>
    <p class="cs-legend"><i class="now"></i>Dernier audit <i class="prev"></i>Audit précédent <i class="target"></i>Cible</p>
    <section class="cs-ref"><div class="section-title"><h3>État de référence</h3>${writable && cfg.ref_photos.length < 3 ? `<button type="button" class="btn secondary small" data-cs-refadd>+ Photo</button><input type="file" id="csRefFile" accept="image/*" capture="environment" hidden>` : ""}</div>
      ${cfg.ref_photos.length ? `<div class="cs-ref-list">${cfg.ref_photos.map((p, i) => `<figure class="cs-ref-ph">${phImg(p, "cs-ref-img", `État de référence ${i + 1}`)}${writable ? `<button type="button" class="cp-ph-btn" data-cs-refdel="${i}" aria-label="Retirer la photo ${i + 1}">×</button>` : ""}</figure>`).join("")}</div>` : '<p class="jn-empty">La photo de la zone telle qu’elle doit être : elle sert de modèle à chaque audit et sur la fiche affichée au poste.</p>'}</section>
    ${tags.length || writable ? `<section class="cs-ztags"><div class="section-title"><h3>Étiquettes rouges · ${tags.length}</h3></div>${tags.length ? `<div class="cs-tag-list">${tags.map(csTagRow).join("")}</div>` : '<p class="jn-empty">Aucune étiquette rouge ouverte.</p>'}</section>` : ""}
    ${actions.length ? `<section><h3>Actions ouvertes · ${actions.length}</h3><div class="jn-rows">${actions.slice(0, 6).map((a) => jnActionRow(a)).join("")}</div></section>` : ""}
    <section><h3>Audits</h3>${done.length || draft ? `<div class="cs-hist">${[...done].reverse().map((a) => `<button type="button" class="cs-hist-row" data-cs-view="${esc(a.id)}"><span>${shortDate(a.performed_at)} · ${esc(a.owner || "")}</span><b class="tone-${csTone(a.score, cfg.target)}">${a.score} %</b></button>`).join("")}${draft ? `<p class="hint">Un audit est en cours depuis le ${shortDate(draft.performed_at)}.</p>` : ""}</div>` : '<p class="jn-empty">Aucun audit pour l’instant.</p>'}</section>
    <div class="jn-buttons"><button type="button" class="btn secondary" data-cs-print="${esc(z.id)}">Fiche à afficher</button>${writable ? `<button type="button" class="btn ghost" data-cs-edit="${esc(z.id)}">Modifier la zone</button>` : ""}</div></div>`);
  const root = $("modalContent");
  root.querySelector("[data-cs-refadd]")?.addEventListener("click", () => $("csRefFile").click());
  const file = $("csRefFile");
  if (file) file.onchange = async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    toast("Photo en préparation…");
    try {
      const ref = await phStore(await imageDataUrl(f));
      if (!ref || !commitData(() => { const row = data.zones.find((x) => x.id === z.id); row.five_s = { ...csCfg(row), ref_photos: [...csCfg(row).ref_photos, ref].slice(0, 3) }; row.updated_at = now(); })) return;
      render(); csZoneOpen(z.id); toast("Photo de référence ajoutée.");
    } catch (error) { toast(error.message); }
  };
  root.querySelectorAll("[data-cs-refdel]").forEach((b) => (b.onclick = () => {
    if (!commitData(() => { const row = data.zones.find((x) => x.id === z.id), list = csCfg(row).ref_photos.slice(); list.splice(Number(b.dataset.csRefdel), 1); row.five_s = { ...csCfg(row), ref_photos: list }; row.updated_at = now(); })) return;
    render(); csZoneOpen(z.id);
  }));
}

/* ---------- Audit au téléphone ---------- */

function csAuditStart(zoneId) {
  const z = csZone(zoneId);
  if (!z || !csWritable(z.site_id)) return toast("Zone hors de votre périmètre.");
  let draft = csDraftOf(z.id);
  if (!draft) {
    draft = { id: uid("AUD"), site_id: z.site_id, workshop_id: z.workshop_id || null, zone_id: z.id, scope: z.name, owner: apMe() || osActor(), type: "5S", status: "Brouillon", performed_at: today(), five_s: { answers: {}, s_scores: [] }, audit_data: { criteria: [] }, score: null, created_at: now(), updated_at: now() };
    if (!commitData(() => data.audits.push(draft))) return;
    render();
  }
  csRun = { id: draft.id, step: 0 };
  csAuditRender();
}
function csAuditGet() { return csRun && data.audits.find((a) => a.id === csRun.id); }
function csAuditSave(patch) {
  const id = csRun?.id;
  return commitData(() => { const a = data.audits.find((x) => x.id === id); a.five_s = { ...a.five_s, ...patch }; a.updated_at = now(); });
}
function csAutoHint(z, cid) {
  const done = csDone(z.id), last = done.at(-1);
  if (cid === "cs-m1") {
    if (!last) return "Premier audit de la zone.";
    const prev = done.at(-2), planned = prev ? csAddDays(String(prev.performed_at).slice(0, 10), csCfg(z).frequency_days) : null;
    return `Dernier audit le ${shortDate(last.performed_at)}${planned ? (String(last.performed_at).slice(0, 10) <= planned ? ", à l’heure" : `, prévu le ${shortDate(planned)}`) : ""}.`;
  }
  if (cid === "cs-m2" && last) {
    const acts = csActionsOf(last), closed = acts.filter((a) => !isOpenAction(a)).length;
    return acts.length ? `D’après le plan d’actions : ${closed} sur ${acts.length} faite${acts.length > 1 ? "s" : ""}.` : "Le dernier audit n’a pas donné d’action.";
  }
  if (cid === "cs-t3") { const n = csOpenTags(z.id).length; return n ? `${jnPlural(n, "étiquette rouge ouverte", "étiquettes rouges ouvertes")} dans la zone.` : ""; }
  return "";
}
function csNavHtml(answers, step, target) {
  const scores = csScores(answers);
  return `<nav class="cs-steps" aria-label="Étapes de l’audit">${CS_S.map((s, i) => {
    const crit = CS_CRITERIA.filter((c) => c[0] === s.key), filled = crit.every((c) => answers[c[1]]?.v !== undefined);
    return `<button type="button" class="cs-step ${i === step ? "on" : ""} ${filled ? "filled tone-" + csTone(scores[i], target) : ""}" data-cs-step="${i}" aria-current="${i === step ? "step" : "false"}"><b>${s.n}S</b><span>${esc(s.name)}</span></button>`;
  }).join("")}<button type="button" class="cs-step ${step === 5 ? "on" : ""}" data-cs-step="5" aria-current="${step === 5 ? "step" : "false"}"><b>✓</b><span>Bilan</span></button></nav>`;
}
function csQHtml(z, cid, an = {}) {
  const text = csCritText(cid), gap = an.v === 0 || an.v === 1, hint = csAutoHint(z, cid);
  return `<li class="cs-q ${an.v === undefined ? "" : an.v === "na" ? "na" : "v" + an.v}" data-cs-cid="${cid}"><p class="cs-q-text">${esc(text)}${CS_SAFETY.has(cid) ? ' <span class="cp-tag urgent">Sécurité</span>' : ""}</p>${hint ? `<p class="cs-auto">${esc(hint)}</p>` : ""}
    <div class="cs-seg" role="radiogroup" aria-label="${esc(text)}">${CS_VALUES.map(([v, l, cls]) => `<button type="button" class="cs-v ${cls} ${an.v === v ? "on" : ""}" role="radio" aria-checked="${an.v === v}" data-cs-v="${v}">${l}</button>`).join("")}</div>
    <button type="button" class="cs-na ${an.v === "na" ? "on" : ""}" data-cs-v="na" aria-pressed="${an.v === "na"}">Sans objet</button>
    ${gap ? `<div class="cs-gap"><textarea class="cs-note" rows="2" data-cs-note placeholder="Ce que je vois (facultatif)">${esc(an.note || "")}</textarea>
      <div class="cs-gap-row">${an.photo ? `<span class="cs-gap-ph">${phImg(an.photo, "cs-gap-img", "")}<button type="button" class="cp-ph-btn" data-cs-phdel aria-label="Retirer la photo">×</button></span>` : `<button type="button" class="btn secondary small" data-cs-ph>Photo</button>`}${cid === "cs-t1" || cid === "cs-t3" ? `<button type="button" class="btn ghost small" data-cs-tag-here>+ Étiquette rouge</button>` : ""}</div></div>` : ""}
  </li>`;
}
function csSetAnswer(cid, patch) {
  const cur = csAuditGet();
  if (!cur) return false;
  const ans = { ...(cur.five_s.answers || {}) };
  ans[cid] = { ...(ans[cid] || {}), ...patch };
  const ok = csAuditSave({ answers: ans, s_scores: csScores(ans) });
  if (ok) modalDirty = false;
  return ok;
}
function csBindNav(root) {
  root.querySelectorAll("[data-cs-step]").forEach((b) => (b.onclick = () => {
    document.activeElement?.blur?.();
    csSyncBilan();
    csRun.step = Number(b.dataset.csStep);
    csAuditRender();
    $("modalContent").closest(".modal")?.scrollTo?.(0, 0);
  }));
}
function csBindQ(li, z) {
  const cid = li.dataset.csCid;
  li.querySelectorAll("[data-cs-v]").forEach((b) => (b.onclick = () => {
    const raw = b.dataset.csV, v = raw === "na" ? "na" : Number(raw), cur = (csAuditGet()?.five_s.answers || {})[cid];
    if (!csSetAnswer(cid, { v: cur?.v === v ? undefined : v })) return;
    // Mise à jour sur place : la question et la barre d'étapes, sans revenir en haut de l'écran.
    const a = csAuditGet(), tmp = document.createElement("ol");
    tmp.innerHTML = csQHtml(z, cid, a.five_s.answers[cid]);
    const fresh = tmp.firstElementChild;
    li.replaceWith(fresh);
    csBindQ(fresh, z);
    const nav = $("modalContent").querySelector(".cs-steps"), box = document.createElement("div");
    box.innerHTML = csNavHtml(a.five_s.answers, csRun.step, csCfg(z).target);
    nav?.replaceWith(box.firstElementChild);
    csBindNav($("modalContent"));
    phFill(fresh);
    if (v === 0 || v === 1) fresh.querySelector("[data-cs-note]")?.focus({ preventScroll: true });
  }));
  const note = li.querySelector("[data-cs-note]");
  let t = null;
  if (note) {
    note.oninput = () => { clearTimeout(t); t = setTimeout(() => csSetAnswer(cid, { note: note.value.trim() }), 400); };
    note.onblur = () => { clearTimeout(t); csSetAnswer(cid, { note: note.value.trim() }); };
  }
  li.querySelector("[data-cs-ph]")?.addEventListener("click", () => { csRun.photoFor = cid; $("csGapFile").click(); });
  li.querySelector("[data-cs-phdel]")?.addEventListener("click", () => { if (csSetAnswer(cid, { photo: "" })) csRedrawQ(cid, z); });
  li.querySelector("[data-cs-tag-here]")?.addEventListener("click", () => { const back = { ...csRun }; csTagForm(null, { zoneId: z.id, back: () => { csRun = back; csAuditRender(); } }); });
}
function csRedrawQ(cid, z) {
  const li = $("modalContent")?.querySelector(`[data-cs-cid="${cid}"]`), a = csAuditGet();
  if (!li || !a) return;
  const tmp = document.createElement("ol");
  tmp.innerHTML = csQHtml(z, cid, a.five_s.answers[cid]);
  const fresh = tmp.firstElementChild;
  li.replaceWith(fresh);
  csBindQ(fresh, z);
  phFill(fresh);
}
function csAuditRender() {
  const a = csAuditGet(), z = a && csZone(a.zone_id);
  if (!a || !z) { csRun = null; return; }
  const answers = a.five_s.answers || {}, step = csRun.step, scores = csScores(answers), cfg = csCfg(z);
  let body;
  if (step < 5) {
    const s = CS_S[step], crit = CS_CRITERIA.filter((c) => c[0] === s.key);
    const ref = cfg.ref_photos.length ? `<details class="cs-refbox" ${csRun.refOpen !== false ? "open" : ""}><summary>État de référence</summary><div class="cs-ref-list">${cfg.ref_photos.map((p) => phImg(p, "cs-ref-img", "État de référence")).join("")}</div></details>` : "";
    body = `<header class="cs-step-head"><span class="cs-num">${s.n}S</span><div><h3>${esc(s.name)} · ${esc(s.long)}</h3><p>${esc(s.hint)}</p></div></header>${ref}
      <ol class="cs-crit">${crit.map(([, cid]) => csQHtml(z, cid, answers[cid])).join("")}</ol>
      <input type="file" id="csGapFile" accept="image/*" capture="environment" hidden>`;
  } else {
    const total = csTotal(scores), prev = csDone(z.id).at(-1), missing = CS_CRITERIA.filter((c) => answers[c[1]]?.v === undefined);
    const gaps = CS_CRITERIA.filter((c) => answers[c[1]]?.v === 0 || answers[c[1]]?.v === 1);
    const ownerDefault = z.owner || a.owner || "";
    body = `<div class="cs-bilan"><div class="cs-bilan-score tone-${csTone(total, cfg.target)}"><span>${total ?? "—"}<small>${total !== null ? " %" : ""}</small></span><em>cible ${cfg.target} %${prev ? ` · précédent ${prev.score} %` : ""}</em></div>
        ${csRadar(scores, { prev: prev?.five_s?.s_scores, target: cfg.target })}</div>
      ${missing.length ? `<p class="cs-missing">${jnPlural(missing.length, "question sans réponse", "questions sans réponse")} : ${[...new Set(missing.map((c) => c[0]))].map((k) => { const s = CS_S.find((x) => x.key === k); return `<button type="button" class="jn-link" data-cs-step="${s.n - 1}">${s.n}S ${esc(s.name)}</button>`; }).join(" ")}</p>` : ""}
      <section class="cs-gaps"><h3>Écarts · ${gaps.length}</h3>${gaps.length ? `<p class="hint">Cochez ceux qui deviennent une action du plan ; un « Non » est coché d’office.</p><ol class="cs-gap-list">${gaps.map(([, cid, text]) => {
        const an = answers[cid], act = an.act ?? an.v === 0;
        return `<li data-cs-gap="${cid}"><label class="cs-act"><input type="checkbox" data-cs-act ${act ? "checked" : ""}> <span><b>${csSOf(cid).n}S · ${an.v === 0 ? "Non" : "Partiel"}</b> ${esc(text)}${an.note ? `<em>${esc(an.note)}</em>` : ""}</span></label>
          <div class="cs-act-fields" ${act ? "" : "hidden"}><label>Quoi ?<input data-cs-what value="${esc(an.what || an.note || "")}" placeholder="Commencer par un verbe : dégager, repérer, nettoyer…"></label><label>Qui ?<input data-cs-who list="ownerList" value="${esc(an.who || ownerDefault)}"></label><label>Pour quand ?<input type="date" data-cs-when value="${esc(an.when || csAddDays(today(), CS_SAFETY.has(cid) ? 2 : 7))}"></label></div></li>`;
      }).join("")}</ol>${ownerDatalist()}` : '<p class="jn-empty">Aucun écart : la zone est conforme à son standard.</p>'}</section>
      <div class="cs-who-when"><label>Auditeur<input id="csAuditor" list="ownerList" value="${esc(a.owner || "")}"></label><label>Date<input id="csAuditDate" type="date" max="${today()}" value="${esc(a.performed_at)}"></label></div>`;
  }
  const next = step < 5 ? `<button type="button" class="btn jn-big" data-cs-step="${step + 1}">${step < 4 ? `${CS_S[step + 1].n}S · ${esc(CS_S[step + 1].name)} →` : "Bilan →"}</button>` : `<button type="button" class="btn jn-big" data-cs-finish>Valider l’audit</button>`;
  modal(`5S · ${z.name}`, `<div class="cs-audit">${csNavHtml(answers, step, cfg.target)}<div class="cs-step-body">${body}</div>
    <div class="form-actions cs-nav">${step > 0 ? `<button type="button" class="btn ghost" data-cs-step="${step - 1}" aria-label="Étape précédente">←</button>` : ""}${next}<button type="button" class="btn secondary" data-cs-later>Plus tard</button></div></div>`);
  const root = $("modalContent");
  // Fermer l'audit, par la croix ou « Plus tard », garde tout ce qui est saisi.
  modalSaver = () => { uxFlush(); csSyncBilan(); return true; };
  root.querySelector(".cs-refbox")?.addEventListener("toggle", (e) => { if (csRun) csRun.refOpen = e.currentTarget.open; });
  csBindNav(root);
  root.querySelectorAll(".cs-q").forEach((li) => csBindQ(li, z));
  const gf = $("csGapFile");
  if (gf) gf.onchange = async () => {
    const f = gf.files?.[0], cid = csRun?.photoFor;
    gf.value = "";
    if (!f || !cid) return;
    toast("Photo en préparation…");
    try { const ref = await phStore(await imageDataUrl(f)); if (ref && csRun && csSetAnswer(cid, { photo: ref })) csRedrawQ(cid, z); } catch (error) { toast(error.message); }
  };
  root.querySelectorAll("[data-cs-gap]").forEach((li) => {
    const box = li.querySelector("[data-cs-act]");
    box.onchange = () => { li.querySelector(".cs-act-fields").hidden = !box.checked; csSyncBilan(); };
  });
  root.querySelector("[data-cs-later]").onclick = () => { document.activeElement?.blur?.(); csSyncBilan(); csRun = null; modalSaver = null; modalDirty = false; closeModal(); render(); toast("Audit gardé : reprenez-le depuis la zone."); };
  root.querySelector("[data-cs-finish]")?.addEventListener("click", () => csFinish());
  modalDirty = false;
}
/* Le bilan garde ce qui est saisi (actions, auditeur, date) avant de changer d'étape ou de valider. */
function csSyncBilan() {
  const root = $("modalContent"), a = csAuditGet();
  if (!a || !root?.querySelector(".cs-gaps")) return;
  const ans = { ...(a.five_s.answers || {}) };
  root.querySelectorAll("[data-cs-gap]").forEach((li) => {
    const cid = li.dataset.csGap;
    ans[cid] = { ...ans[cid], act: li.querySelector("[data-cs-act]").checked, what: li.querySelector("[data-cs-what]").value.trim(), who: li.querySelector("[data-cs-who]").value.trim(), when: li.querySelector("[data-cs-when]").value };
  });
  const owner = $("csAuditor")?.value.trim(), date = $("csAuditDate")?.value;
  commitData(() => { const row = data.audits.find((x) => x.id === a.id); row.five_s = { ...row.five_s, answers: ans }; if (owner) row.owner = owner; if (date) row.performed_at = date; row.updated_at = now(); });
}
function csFinish() {
  document.activeElement?.blur?.();
  csSyncBilan();
  const a = csAuditGet(), z = a && csZone(a.zone_id);
  if (!a || !z) return;
  const answers = a.five_s.answers || {}, missing = CS_CRITERIA.filter((c) => answers[c[1]]?.v === undefined);
  if (missing.length) return toast(`Répondez aux ${missing.length} question(s) restante(s), ou marquez-les « Sans objet ».`);
  if (!a.owner) return toast("Indiquez l’auditeur.");
  if (!a.performed_at || a.performed_at > today()) return toast("La date de l’audit ne peut pas être dans le futur.");
  const acts = CS_CRITERIA.filter((c) => (answers[c[1]]?.v === 0 || answers[c[1]]?.v === 1) && answers[c[1]].act);
  const bad = acts.find((c) => !answers[c[1]].who || !answers[c[1]].when);
  if (bad) return toast("Chaque action cochée a besoin d’un responsable et d’une date.");
  const scores = csScores(answers), total = csTotal(scores);
  let created = 0;
  if (!commitData(() => {
    const row = data.audits.find((x) => x.id === a.id);
    row.status = "Terminé";
    row.score = total ?? 0;
    row.five_s = { ...row.five_s, s_scores: scores, target: csCfg(z).target };
    row.audit_data = {
      criteria: CS_CRITERIA.map(([s, cid, text]) => ({ question_id: cid, domain: `${csSOf(cid).n}S · ${csSOf(cid).name}`, criterion: text, score: typeof answers[cid]?.v === "number" ? answers[cid].v * 2.5 : null, proof: answers[cid]?.note || "", photo: answers[cid]?.photo || "" })),
      domain_scores: Object.fromEntries(CS_S.map((s, i) => [`${s.n}S · ${s.name}`, scores[i] === null ? null : Math.round((scores[i] / 20) * 100) / 100]).filter(([, v]) => v !== null)),
      proof_count: Object.values(answers).filter((x) => x?.note || x?.photo).length,
    };
    row.updated_at = now();
    for (const [, cid, text] of acts) {
      if (data.actions.some((x) => x.origin_id === a.id && x.question_id === cid)) continue;
      const an = answers[cid], id = nextId("A", data.actions);
      data.actions.unshift({ id, site_id: z.site_id, workshop_id: z.workshop_id || null, zone_id: z.id, title: an.what || `5S ${z.name} · ${text}`, description: [`${csSOf(cid).n}S ${csSOf(cid).name} · ${text}`, an.note].filter(Boolean).join("\n"), owner: an.who, due_date: an.when, due_date_initial: an.when, priority: CS_SAFETY.has(cid) ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: CS_SAFETY.has(cid) ? "Sécurité" : "Standard", origin_type: "Audit", origin_id: a.id, question_id: cid, finding: an.note || text, created_at: now(), updated_at: now() });
      created += 1;
    }
  })) return;
  csRun = null;
  modalDirty = false;
  render();
  const done = data.audits.find((x) => x.id === a.id), cfg = csCfg(z);
  modal(`5S · ${z.name}`, `<div class="cs-done"><div class="cs-bilan"><div class="cs-bilan-score tone-${csTone(done.score, cfg.target)}"><span>${done.score}<small> %</small></span><em>cible ${cfg.target} %</em></div>${csRadar(done.five_s.s_scores, { prev: csDone(z.id).at(-2)?.five_s?.s_scores, target: cfg.target })}</div>
    <ul class="jn-sum"><li>Audit validé le ${shortDate(done.performed_at)} par ${esc(done.owner)}</li>${created ? `<li>${jnPlural(created, "action ajoutée au plan", "actions ajoutées au plan")}</li>` : ""}<li>Prochain audit vers le ${shortDate(csDue(z))}</li></ul>
    <div class="form-actions"><button type="button" class="btn" data-cs-print="${esc(z.id)}">Fiche à afficher</button><button type="button" class="btn secondary" data-cs-zone="${esc(z.id)}">Voir la zone</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div></div>`);
}
function csAuditView(id) {
  const a = data.audits.find((x) => x.id === id), z = a && csZone(a.zone_id);
  if (!a || !allowedSite(a.site_id)) return;
  if (a.status !== "Terminé") { if (z && csWritable(z.site_id)) { csRun = { id: a.id, step: 0 }; return csAuditRender(); } }
  const answers = a.five_s?.answers || {}, cfg = csCfg(z), acts = csActionsOf(a);
  modal(`${a.id} · 5S · ${a.score ?? "—"} %`, `<article class="cs-view"><header><p class="jn-where">${esc(getSiteName(a.site_id))} · ${esc(a.scope || z?.name || "")} · ${shortDate(a.performed_at)} · ${esc(a.owner || "")}</p></header>
    <div class="cs-bilan"><div class="cs-bilan-score tone-${csTone(a.score, cfg.target)}"><span>${a.score ?? "—"}<small> %</small></span><em>cible ${cfg.target} %</em></div>${csRadar(a.five_s?.s_scores || csScores(answers), { target: cfg.target })}</div>
    ${CS_S.map((s) => `<section class="cs-view-s"><h4>${s.n}S · ${esc(s.name)}</h4><ul>${CS_CRITERIA.filter((c) => c[0] === s.key).map(([, cid, text]) => { const an = answers[cid] || {}, v = CS_VALUES.find((x) => x[0] === an.v); return `<li><span class="cs-badge ${v ? v[2] : "na"}">${v ? v[1] : "Sans objet"}</span><span>${esc(text)}${an.note ? `<em>${esc(an.note)}</em>` : ""}</span>${an.photo ? phImg(an.photo, "cs-gap-img", "") : ""}</li>`; }).join("")}</ul></section>`).join("")}
    ${acts.length ? `<section><h4>Actions</h4><div class="jn-rows">${acts.map((x) => jnActionRow(x)).join("")}</div></section>` : ""}</article>
    <div class="form-actions"><button type="button" class="btn secondary" data-print>Imprimer / PDF</button>${z ? `<button type="button" class="btn ghost" data-cs-zone="${esc(z.id)}">Voir la zone</button>` : ""}</div>`);
}

/* ---------- Étiquettes rouges ---------- */

function csTagForm(id = null, { zoneId = null, back = null } = {}) {
  const old = id ? (data.redTags || []).find((t) => t.id === id) : null;
  const sites = OPERATIONAL_SITES.filter((s) => csWritable(s.id));
  if (!sites.length) return toast("Votre profil ne permet pas de créer une étiquette rouge.");
  const zone0 = csZone(old?.zone_id || zoneId);
  let siteId = old?.site_id || zone0?.site_id || (state.site !== "group" && csWritable(state.site) ? state.site : sites[0].id);
  let reason = old?.reason || "Inutile", decision = old?.decision || "À décider", photo = old?.photo || "";
  const zoneOpts = (sid) => `<option value="">Zone à préciser</option>${(data.zones || []).filter((z) => z.site_id === sid && !z.archived_at).map((z) => `<option value="${esc(z.id)}" ${z.id === (old?.zone_id || zoneId) ? "selected" : ""}>${esc(z.name)}</option>`).join("")}`;
  const t = today(), dues = [["1 semaine", csAddDays(t, 7)], ["2 semaines", csAddDays(t, 14)], ["1 mois", csAddDays(t, 30)]];
  const chips = (list, attr, cur) => list.map((x) => `<button type="button" class="chip ${x === cur ? "active" : ""}" ${attr}="${esc(x)}" aria-pressed="${x === cur}">${esc(x)}</button>`).join("");
  modal(old ? `${old.id} · Étiquette rouge` : "Nouvelle étiquette rouge", `<form id="csTagForm" class="jn-form">
    <div class="cs-tag-photo" id="csTagPhoto"></div><input type="file" id="csTagFile" accept="image/*" capture="environment" hidden>
    <label class="field">Quoi ?<input id="csTagWhat" required value="${esc(old?.what || "")}" placeholder="Ex. 3 serre-joints cassés, palette de chants sans référence"></label>
    <label class="field">Combien ? (facultatif)<input id="csTagQty" value="${esc(old?.qty || "")}" placeholder="Ex. 3, 1 palette, 2 m³"></label>
    ${!old && !zone0 && sites.length > 1 ? `<div class="ap-field"><span class="metric-label">Site</span><div class="filters">${sites.map((s) => `<button type="button" class="chip ${s.id === siteId ? "active" : ""}" data-cs-tsite="${esc(s.id)}">${esc(s.name)}</button>`).join("")}</div></div>` : ""}
    <label class="field">Zone<select id="csTagZone">${zoneOpts(siteId)}</select></label>
    <div class="ap-field"><span class="metric-label">Pourquoi ?</span><div class="filters">${chips(CS_TAG_REASONS, "data-cs-reason", reason)}</div></div>
    <div class="ap-field"><span class="metric-label">Décision</span><div class="filters">${chips(CS_TAG_DECISIONS, "data-cs-decision", decision)}</div></div>
    <label class="field">Qui décide et traite ?<input id="csTagOwner" list="ownerList" value="${esc(old?.owner || zone0?.owner || apMe() || "")}">${ownerDatalist()}</label>
    <div class="ap-field"><span class="metric-label">Traiter avant le</span><div class="filters">${dues.map(([l, d], i) => `<button type="button" class="chip ${(!old && i === 1) || old?.due_date === d ? "active" : ""}" data-cs-due="${d}">${l}</button>`).join("")}</div><input type="date" id="csTagDue" value="${esc(old?.due_date || dues[1][1])}"></div>
    ${old && old.status !== "Traitée" ? `<section class="verification-box"><h3>Traiter l’étiquette</h3><label class="field">Ce qui a été fait<input id="csTagDone" placeholder="Ex. jeté en benne bois, rangé au magasin"></label><button type="button" class="btn secondary" data-cs-tagdone>Marquer traitée</button></section>` : old?.status === "Traitée" ? `<p class="hint">Traitée le ${shortDate(old.done_at)}${old.done_note ? ` : ${esc(old.done_note)}` : ""}.</p>` : ""}
    <div class="form-actions"><button class="btn">${old ? "Enregistrer" : "Créer l’étiquette"}</button>${old ? `<button type="button" class="btn secondary" data-cs-tagprint="${esc(old.id)}">Imprimer l’étiquette</button>` : ""}<button type="button" class="btn ghost" data-cs-tagback>${back ? "Revenir à l’audit" : "Annuler"}</button></div></form>`);
  const root = $("modalContent");
  const drawPhoto = () => { const box = $("csTagPhoto"); if (!box) return; box.innerHTML = photo ? `<figure class="cp-ph cs-tag-ph">${phImg(photo, "cp-ph-img", "Objet étiqueté")}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-cs-tagphdel>×</button></span></figure>` : `<button type="button" class="cp-ph-add cs-tag-ph" data-cs-tagph><b>Photo</b><span>de l’objet</span></button>`; box.querySelector("[data-cs-tagph]")?.addEventListener("click", () => $("csTagFile").click()); box.querySelector("[data-cs-tagphdel]")?.addEventListener("click", () => { photo = ""; drawPhoto(); }); };
  drawPhoto();
  $("csTagFile").onchange = async () => { const f = $("csTagFile").files?.[0]; $("csTagFile").value = ""; if (!f) return; try { photo = await phStore(await imageDataUrl(f)); drawPhoto(); } catch (error) { toast(error.message); } };
  const pick = (attr, set) => root.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => { set(b.getAttribute(attr)); root.querySelectorAll(`[${attr}]`).forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); }); }));
  pick("data-cs-reason", (v) => (reason = v));
  pick("data-cs-decision", (v) => (decision = v));
  pick("data-cs-tsite", (v) => { siteId = v; $("csTagZone").innerHTML = zoneOpts(v); });
  pick("data-cs-due", (v) => ($("csTagDue").value = v));
  const leave = () => { modalDirty = false; if (back) back(); else closeModal(); };
  root.querySelector("[data-cs-tagback]").onclick = leave;
  const save = (extra = {}) => {
    const what = $("csTagWhat").value.trim();
    if (!what) { $("csTagWhat").focus(); return toast("Dites ce qui est étiqueté."); }
    let tid = old?.id;
    if (!commitData(() => {
      data.redTags ||= [];
      tid ||= nextId("ER", data.redTags);
      const patch = { site_id: siteId, zone_id: $("csTagZone").value || null, what, qty: $("csTagQty").value.trim(), reason, decision, owner: $("csTagOwner").value.trim(), due_date: $("csTagDue").value || null, photo, updated_at: now(), ...extra };
      const row = data.redTags.find((x) => x.id === tid);
      if (row) Object.assign(row, patch); else data.redTags.unshift({ id: tid, status: "Ouverte", author: apMe() || osActor(), created_at: now(), ...patch });
    })) return;
    render();
    toast(extra.status === "Traitée" ? `${tid} traitée.` : old ? `${tid} enregistrée.` : `Étiquette ${tid} créée : écrivez ce numéro sur l’étiquette, ou imprimez-la.`);
    if (back) { modalDirty = false; back(); }
    else if (!old) csTagPrint(tid); else closeModal();
  };
  $("csTagForm").onsubmit = (e) => { e.preventDefault(); save(); };
  root.querySelector("[data-cs-tagdone]")?.addEventListener("click", () => save({ status: "Traitée", done_at: now(), done_note: $("csTagDone").value.trim() }));
  root.querySelector("[data-cs-tagprint]")?.addEventListener("click", () => csTagPrint(old.id));
  if (!old) setTimeout(() => $("csTagWhat")?.focus(), 0);
}
function csTagPrint(id) {
  const t = (data.redTags || []).find((x) => x.id === id);
  if (!t) return;
  const z = csZone(t.zone_id);
  modal(`${t.id} · Étiquette rouge`, `<article class="cs-tag-print"><header><b>ÉTIQUETTE ROUGE</b><span>${esc(t.id)}</span></header>
    <dl><div><dt>Objet</dt><dd>${esc(t.what)}${t.qty ? ` · ${esc(t.qty)}` : ""}</dd></div><div><dt>Zone</dt><dd>${esc(getSiteName(t.site_id))}${z ? " · " + esc(z.name) : ""}</dd></div><div><dt>Raison</dt><dd>${esc(t.reason || "")}</dd></div><div><dt>Décision</dt><dd>${esc(t.decision || "À décider")}</dd></div><div><dt>Posée le</dt><dd>${shortDate(t.created_at)}${t.author ? " · " + esc(t.author) : ""}</dd></div><div><dt>À traiter avant le</dt><dd class="cs-tag-big">${t.due_date ? shortDate(t.due_date) : "—"}</dd></div><div><dt>Responsable</dt><dd>${esc(t.owner || "")}</dd></div></dl>
    <footer>Ne pas déplacer sans voir le responsable · Sans décision à la date, l’objet part en zone de tri.</footer></article>
    <div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button>${z ? `<button type="button" class="btn secondary" data-cs-zone="${esc(z.id)}">Voir la zone</button>` : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
}

/* ---------- Fiche de zone à afficher ---------- */

function csZonePrint(id) {
  const z = csZone(id);
  if (!z) return;
  const cfg = csCfg(z), done = csDone(z.id), last = done.at(-1), prev = done.at(-2), tags = csOpenTags(z.id), acts = csZoneActions(z.id).filter((a) => isOpenAction(a));
  modal(`${z.name} · Fiche 5S`, `<article class="cs-sheet"><header class="cs-sheet-head"><div><p class="cs-sheet-k">5S · ${esc(getSiteName(z.site_id))}</p><h3>${esc(z.name)}</h3><p>Pilote : ${esc(z.owner || "à désigner")} · audit ${esc((CS_FREQ.find(([d]) => d === cfg.frequency_days)?.[1] || "").toLowerCase())} · cible ${cfg.target} %</p></div>
      <div class="cs-sheet-score tone-${csTone(last?.score, cfg.target)}"><span>${last ? last.score : "—"}<small>${last ? " %" : ""}</small></span><em>${last ? `audit du ${shortDate(last.performed_at)}` : "pas encore auditée"}</em></div></header>
    <div class="cs-sheet-body"><section class="cs-sheet-ref"><h4>Comme ça, tous les jours</h4>${cfg.ref_photos.length ? `<div class="cs-sheet-ph">${cfg.ref_photos.map((p) => phImg(p, "cs-sheet-img", "État de référence")).join("")}</div>` : '<p class="jn-empty">Photo de l’état de référence à prendre.</p>'}</section>
      <section class="cs-sheet-side">${csRadar(last?.five_s?.s_scores || [null, null, null, null, null], { prev: prev?.five_s?.s_scores, target: cfg.target, size: 230 })}${csTrend(done, cfg.target)}
        <p class="cs-sheet-next">Prochain audit : <b>${csDue(z) ? shortDate(csDue(z)) : "à planifier"}</b></p></section></div>
    ${acts.length ? `<section><h4>Actions en cours</h4><table class="cp-r-table"><tbody>${acts.slice(0, 6).map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.owner || "")}</td><td>${a.due_date ? shortDate(a.due_date) : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
    ${tags.length ? `<section><h4>Étiquettes rouges ouvertes</h4><table class="cp-r-table"><tbody>${tags.map((t) => `<tr><td>${esc(t.id)}</td><td>${esc(t.what)}</td><td>${esc(t.decision || "")}</td><td>${t.due_date ? shortDate(t.due_date) : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
    <footer class="cs-sheet-foot">${CS_S.map((s) => `<span><b>${s.n}S</b> ${esc(s.name)}</span>`).join("")}</footer></article>
  <div class="form-actions"><button type="button" class="btn" data-print>Imprimer / PDF</button><button type="button" class="btn ghost" data-cs-zone="${esc(z.id)}">Retour à la zone</button></div>`);
}

/* ---------- Choisir la zone à auditer ---------- */

function csPickZone() {
  const zones = csZones().filter((z) => csWritable(z.site_id));
  if (!zones.length) return csZoneForm(null, (zid) => csAuditStart(zid));
  if (zones.length === 1) return csAuditStart(zones[0].id);
  const rank = (z) => { const d = csDue(z); return csDraftOf(z.id) ? "0" : !d ? "1" : d; };
  modal("Quelle zone auditer ?", `<div class="cs-pick">${zones.sort((a, b) => rank(a).localeCompare(rank(b))).map((z) => { const due = csDueLabel(z), draft = csDraftOf(z.id); return `<button type="button" class="jn-line ${due.cls === "late" ? "warn" : ""}" data-cs-start="${esc(z.id)}">${esc(z.name)} · ${esc(getSiteName(z.site_id))}<span>${esc(draft ? "Audit en cours" : due.text)}</span></button>`; }).join("")}</div><div class="form-actions"><button type="button" class="btn ghost" data-cs-newzone>+ Nouvelle zone</button></div>`);
}

/* ---------- Intégration : onglet, Audits, accueil, « + », bibliothèque ---------- */

const csRenderAuditsBase = renderAudits;
renderAudits = function () {
  if (state.auditsTab === "5s" && csCan()) return csPage();
  // Les audits 5S par zone ont leur onglet : ils ne comptent pas comme audits terrain 50 critères.
  const all = data.audits;
  let html;
  data.audits = all.filter((a) => !a.five_s);
  try { html = csRenderAuditsBase(); } finally { data.audits = all; }
  return `${csCan() ? `<div class="cs-banner"><div><b>Le 5S se fait zone par zone</b><span>Photo de référence, audit au téléphone, radar et étiquettes rouges.</span></div><button type="button" class="btn secondary" data-cs-go>Ouvrir le 5S</button></div>` : ""}${html}`;
};
state.auditsTab ||= "audits";
const csTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = csTabsBase(stage);
  if (stage?.id !== "observer" || !csCan()) return out;
  const audits = out.find((t) => t.key === "audits");
  if (audits) audits.set = { ...(audits.set || {}), auditsTab: "audits" };
  if (!out.some((t) => t.key === "5s")) {
    const i = out.findIndex((t) => t.key === "gemba");
    out.splice(i >= 0 ? i + 1 : 0, 0, { key: "5s", label: "5S", view: "audits", set: { auditsTab: "5s" } });
  }
  return out;
};
const csAuditFormBase = auditForm;
auditForm = function (existing = null) {
  if (existing?.five_s) return csAuditView(existing.id);
  return csAuditFormBase.apply(this, arguments);
};
const csToolLaunchBase = toolLaunch;
toolLaunch = function (id) {
  if (id === "five-s" && csCan()) return `<div class="attention-strip"><div><b>Passer à la pratique</b><span>Le 5S se fait zone par zone : photo de référence, audit au téléphone, étiquettes rouges.</span></div><button class="btn" data-cs-go>Ouvrir le 5S</button></div>`;
  return csToolLaunchBase.apply(this, arguments);
};
const csWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = csWatchBase();
  if (!csCan() || state.role === "dg") return base;
  const late = csZones().filter((z) => { const d = csDue(z); return d && d < today(); }).slice(0, 2);
  const tags = csOpenTags().filter((t) => (state.site === "group" || t.site_id === state.site) && t.due_date && t.due_date < today());
  const rows = late.map((z) => `<button type="button" class="jn-row" data-cs-zone="${esc(z.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">5S</span><b>Audit en retard · ${esc(z.name)}</b><span class="hint">${esc(getSiteName(z.site_id))} · prévu le ${shortDate(csDue(z))}</span></span></button>`);
  if (tags.length) rows.push(`<button type="button" class="jn-row" data-cs-go><span class="jn-row-main"><span class="jn-tag tone-bad">5S</span><b>${jnPlural(tags.length, "étiquette rouge en retard", "étiquettes rouges en retard")}</b><span class="hint">Décision attendue</span></span></button>`);
  if (!rows.length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${rows.join("")}$2`);
};
const csCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  csCreateMenuBase.apply(this, arguments);
  if (!csCan() || role().readonly) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const note = menu.querySelector(".cp-note-choice");
  const html = `<button class="create-choice cs-choice" type="button" data-cs-audit><span aria-hidden="true"><b>5S</b></span><b>Audit 5S</b><small>Auditer une zone en dix minutes</small></button><button class="create-choice cs-choice" type="button" data-cs-newtag><span aria-hidden="true"><b>ER</b></span><b>Étiquette rouge</b><small>Objet inutile, en trop ou mal placé</small></button>`;
  if (note) note.insertAdjacentHTML("beforebegin", html); else menu.insertAdjacentHTML("beforeend", html);
  csBind(menu);
};
function csGo() { state.auditsTab = "5s"; switchView("audits"); }

function csBind(root = document) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = (e) => fn(b, e)));
  on("[data-cs-go]", () => { closeModal(); csGo(); });
  on("[data-cs-zone]", (b) => csZoneOpen(b.dataset.csZone));
  on("[data-cs-audit]", () => csPickZone());
  on("[data-cs-start]", (b) => csAuditStart(b.dataset.csStart));
  on("[data-cs-newzone]", () => csZoneForm());
  on("[data-cs-edit]", (b) => csZoneForm(b.dataset.csEdit));
  on("[data-cs-newtag]", (b) => csTagForm(null, { zoneId: b.dataset.csNewtag || null }));
  on("[data-cs-tag]", (b) => csTagForm(b.dataset.csTag));
  on("[data-cs-view]", (b) => csAuditView(b.dataset.csView));
  on("[data-cs-print]", (b) => csZonePrint(b.dataset.csPrint));
  // Le bouton générique ajouté en tête d'Audits : « Audit personnalisé » (le 5S a son onglet), absent de la page 5S.
  const generic = state.view === "audits" ? $("appView")?.querySelector(':scope > [data-os="audit"]') : null;
  if (generic) { if (state.auditsTab === "5s") generic.remove(); else generic.textContent = "Audit personnalisé"; }
}
const csOsBindBase = osBind;
osBind = function () { const out = csOsBindBase.apply(this, arguments); csBind(document); return out; };
const csCloseModalBase = closeModal;
closeModal = function () { csRun = null; return csCloseModalBase.apply(this, arguments); };
