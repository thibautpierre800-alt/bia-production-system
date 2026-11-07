"use strict";
/*
 * BIA Lean OS 8.41 · Tour de contrôle (Voir › Tour de contrôle) : tous les indicateurs, tous les sites, sur un écran.
 *  - Bandeau groupe : sécurité (signaux sécurité ouverts), indicateurs en écart, actions en retard, réclamations client
 *    (ouvertes, réponses en retard), TRS des feuilles de poste de la veille, environnement hors objectif, boucles de la
 *    cascade ouvertes depuis plus de 7 jours, gains validés face à l'objectif.
 *  - Une ligne par site : S, Q, C, D, P (valeur, couleur selon la cible, tendance), TRS des lignes, non-conformités sur 30 jours,
 *    actions en retard, environnement, gains, maturité. Un clic sur un site l'ouvre en grand.
 *  - « Ce qui demande une décision » : les alertes classées par gravité (sécurité, réponse client en retard, indicateur
 *    hors cible plusieurs relevés de suite, obligation en retard, ligne au-dessus de son objectif de micro-arrêts…).
 *  - Mode télévision : plein écran, horloge, données rafraîchies chaque minute, défilement groupe puis site par site.
 *    Adresse directe : …/#tour.
 */

let trSite = null, trTv = false, trTimer = null, trClock = null, trIdx = 0;

function trCan() { return role().nav.includes("pilotage"); }
function trSites() { return OPERATIONAL_SITES.filter((s) => allowedSite(s.id)); }
function trTrs(siteId) {
  if (typeof tsAgg !== "function") return null;
  const ids = new Set((data.mlLines || []).filter((l) => l.site_id === siteId).map((l) => l.id));
  if (!ids.size) return null;
  const day = [today(), auAddDays(-1), auAddDays(-2), auAddDays(-3)].find((d) => (data.trsShifts || []).some((s) => ids.has(s.line_id) && s.date === d));
  if (!day) return null;
  const a = tsAgg((data.trsShifts || []).filter((s) => ids.has(s.line_id) && s.date === day));
  return a ? { ...a, day } : null;
}
function trEnvOff(siteId) { return typeof EV_IND === "undefined" ? 0 : EV_IND.filter((i) => { const l = evLast(i, siteId); return l && evOk(i, l.v, evTarget(i, siteId)) === false; }).length; }
function trGains(siteId) { if (typeof gnTotals !== "function") return null; const t = gnTotals((data.gains || []).filter((g) => !g.archived_at && g.site_id === siteId)); return t.n ? t : null; }
function trNc(siteId) { const from = auAddDays(-29), rows = (data.ncs || []).filter((n) => !n.archived_at && n.site_id === siteId && n.date >= from); return { n: rows.length, client: rows.filter((n) => n.origin === "Client").length, late: (data.ncs || []).filter((n) => !n.archived_at && n.site_id === siteId && n.status !== "Close" && typeof ncNext === "function" && ncNext(n)?.late).length }; }
function trSafety(siteId) { return osActive(data.signals || []).filter((s) => s.site_id === siteId && isOpenSignal(s) && s.type === "Sécurité").length; }

function trAlerts(sites) {
  const out = [], push = (lvl, site, what, detail, go) => out.push({ lvl, site, what, detail, go });
  sites.forEach((s) => {
    osActive(data.signals || []).filter((x) => x.site_id === s.id && isOpenSignal(x) && x.type === "Sécurité").slice(0, 3).forEach((x) => push(3, s, "Sécurité", String(x.description || x.id).slice(0, 90), { view: "terrain" }));
    (data.ncs || []).filter((n) => !n.archived_at && n.site_id === s.id && n.status !== "Close" && typeof ncNext === "function" && ncNext(n)?.late).forEach((n) => push(3, s, "Réponse client en retard", `${n.client || "Client"} · ${ncNext(n).label.toLowerCase()} attendu le ${shortDate(ncNext(n).due)}`, { view: "kaizen", set: { ncOn: true } }));
    inKpis().forEach((k) => { const r = inReading(s.id, k, null, null); if (r.status === "gap" && r.trend.count >= 2) push(2, s, k.name, `${osNum(r.m.value, 1)}${r.unit ? ` ${r.unit}` : ""} · cible ${osNum(r.target)} · ${r.trend.count} relevés hors cible de suite`, { view: "pilotage", set: { pilotTab: "" } }); });
    if (typeof evDutyState === "function") (data.envDuties || []).filter((d) => d.site_id === s.id && !d.archived_at && evDutyState(d).k === "late").forEach((d) => push(2, s, "Obligation environnement", `${d.name} · ${evDutyState(d).label.toLowerCase()}`, { view: "pilotage", set: { pilotTab: "env" } }));
    const late = inLate(s.id); if (late >= 3) push(1, s, "Actions en retard", `${late} actions dépassées`, { view: "actions" });
    if (typeof mlSum === "function") (data.mlLines || []).filter((l) => l.site_id === s.id && !l.archived_at).forEach((l) => { const m = mlSum(l); if (m.over) push(1, s, "Micro-arrêts", `${l.name} · ${mlFmt(m.min)} perdues aujourd’hui (objectif ${smNum(Number(l.target_min))} min)`, { view: "terrain", set: { terrainTab: "micro" } }); });
    if (typeof evMissing === "function" && evMissing(s.id)) push(1, s, "Environnement", `${evMonthName(evMissing(s.id))} non saisi`, { view: "pilotage", set: { pilotTab: "env" } });
  });
  return out.sort((a, b) => b.lvl - a.lvl);
}

/* ---------- Écran ---------- */

function trPage() {
  const sites = trSites(), kpis = inKpis().slice(0, 5), group = state.site === "group" || sites.length > 1;
  const shown = trSite ? sites.filter((s) => s.id === trSite) : group ? sites : sites.filter((s) => s.id === state.site);
  const all = shown.length ? shown : sites;
  const alerts = trAlerts(all);
  const gap = all.reduce((n, s) => n + kpis.filter((k) => inReading(s.id, k, null, null).status === "gap").length, 0), cells = all.length * kpis.length;
  const late = all.reduce((n, s) => n + inLate(s.id), 0), safety = all.reduce((n, s) => n + trSafety(s.id), 0);
  const nc = all.reduce((o, s) => { const x = trNc(s.id); return { client: o.client + x.client, late: o.late + x.late }; }, { client: 0, late: 0 });
  const trsAll = typeof tsAgg === "function" ? (() => { const days = all.map((s) => trTrs(s.id)).filter(Boolean); if (!days.length) return null; const tr = days.reduce((n, x) => n + x.tr, 0), tu = days.reduce((n, x) => n + x.tu, 0); return tr ? tu / tr : null; })() : null;
  const env = all.reduce((n, s) => n + trEnvOff(s.id), 0), cg = typeof cgStats === "function" ? cgStats() : null;
  const gt = typeof gnTotals === "function" ? gnTotals((data.gains || []).filter((g) => !g.archived_at && all.some((s) => s.id === g.site_id))) : null, gTarget = typeof gnTarget === "function" ? (trSite ? gnTarget(trSite) : group ? gnTarget("group") : gnTarget(state.site)) : null;
  const big = (cls, v, l, sub = "") => `<div class="tr-big ${cls}"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const band = `<div class="tr-band">${big(safety ? "bad" : "ok", safety, "signaux sécurité ouverts")}${big(gap ? "bad" : "ok", `${gap}<small>/${cells}</small>`, "indicateurs en écart")}${big(late ? "warn" : "ok", late, "actions en retard")}${big(nc.late ? "bad" : nc.client ? "warn" : "ok", nc.client, "réclamations client · 30 j", nc.late ? `${nc.late} réponse${nc.late > 1 ? "s" : ""} en retard` : "")}${big(trsAll === null ? "" : trsAll * 100 >= (osKpi("trs")?.target ?? 85) ? "ok" : "bad", trsAll === null ? "—" : tsPct(trsAll), "TRS des feuilles de poste")}${big(env ? "warn" : "ok", env, "indicateurs environnement hors objectif")}${cg ? big(cg.open ? "warn" : "ok", cg.open, "boucles ouvertes > 7 jours", `${cg.closed} fermées sur 30 j`) : ""}${gt ? big(gTarget && gt.valid < gTarget * (Number(today().slice(5, 7)) / 12) ? "warn" : "ok", gnEuro(gt.valid), "gains validés / an", gTarget ? `objectif ${gnEuro(gTarget)}` : "") : ""}</div>`;
  const head = `<header class="tr-head"><div><p class="tr-eye">Tour de contrôle</p><h1>${trSite ? esc(getSiteName(trSite)) : group ? "Groupe BIA · sept sites" : esc(getSiteName(state.site))}</h1></div><div class="tr-tools"><span class="tr-clock" id="trClock">${trNow()}</span>${trSite ? '<button type="button" class="btn secondary small" data-tr-site="">Tous les sites</button>' : ""}<button type="button" class="btn ${trTv ? "" : "secondary"} small" data-tr-tv aria-pressed="${trTv}">${trTv ? "Arrêter le défilement" : "Mode télévision"}</button><button type="button" class="btn secondary small" data-tr-full>${document.fullscreenElement ? "Quitter le plein écran" : "Plein écran"}</button></div></header>`;
  const cell = (s, k) => { const r = inReading(s.id, k, null, null), d = r.trend?.delta; return `<td class="tr-c ${inTone(r.status)}" title="${esc(r.label)}"><b>${r.m ? osNum(r.m.value, 1) : "—"}</b>${inArrow(k, d)}</td>`; };
  const extra = (s) => { const t = trTrs(s.id), x = trNc(s.id), e = trEnvOff(s.id), g = trGains(s.id), m = inMaturity(s.id, null), l = inLate(s.id); return `<td class="tr-c ${t ? (t.trs * 100 >= (osKpi("trs")?.target ?? 85) ? "ok" : "gap") : "none"}"><b>${t ? tsPct(t.trs) : "—"}</b></td><td class="tr-c ${x.late ? "gap" : x.client ? "warn" : x.n ? "none" : "ok"}"><b>${x.n}</b>${x.client ? `<small>${x.client} client</small>` : ""}</td><td class="tr-c ${l >= 3 ? "gap" : l ? "warn" : "ok"}"><b>${l}</b></td><td class="tr-c ${e ? "warn" : "none"}"><b>${typeof evMonthsOf === "function" && evMonthsOf(s.id).length ? e : "—"}</b></td><td class="tr-c none"><b>${g ? gnEuro(g.valid) : "—"}</b></td><td class="tr-c none"><b>${m.value === null ? "—" : osNum(m.value, 1)}</b></td>`; };
  const table = `<div class="tr-matrix"><table><thead><tr><th>Site</th>${kpis.map((k) => `<th><span>${esc(k.axis || "")}</span>${esc(inShort(k))}</th>`).join("")}<th><span>C</span>TRS lignes</th><th><span>Q</span>NC 30 j</th><th>Actions en retard</th><th><span>E</span>Hors objectif</th><th>Gains / an</th><th>Maturité</th></tr></thead><tbody>${all.map((s) => `<tr><th><button type="button" class="tr-sitebtn" data-tr-site="${esc(s.id)}">${esc(s.name)}</button></th>${kpis.map((k) => cell(s, k)).join("")}${extra(s)}</tr>`).join("")}</tbody></table></div>`;
  const feed = `<aside class="tr-feed"><h2>Ce qui demande une décision <span>${alerts.length}</span></h2>${alerts.length ? `<ol>${alerts.slice(0, 14).map((a) => `<li class="l${a.lvl}"><button type="button" data-tr-go="${esc(JSON.stringify({ ...a.go, site: a.site.id }))}"><span class="tr-al-k">${esc(a.what)} · ${esc(a.site.name)}</span><span>${esc(a.detail)}</span></button></li>`).join("")}</ol>${alerts.length > 14 ? `<p class="tr-more">… et ${alerts.length - 14} autres</p>` : ""}` : '<p class="tr-calm">Rien d’urgent : tout est dans la cible ou suivi.</p>'}</aside>`;
  return `<div class="tr-screen ${trTv ? "tv" : ""}">${head}${band}<div class="tr-main">${table}${feed}</div><p class="tr-foot">Couleurs : vert dans la cible, orange vigilance, rouge écart · flèche : sens de l’évolution depuis le relevé précédent · ${trTv ? "défilement : groupe puis site par site" : "cliquez un site pour l’ouvrir en grand"} · mis à jour à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p></div>`;
}
function trNow() { return new Date().toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); }

/* ---------- Mode télévision ---------- */

function trStartTv() {
  trTv = true; trIdx = 0; trSite = null;
  clearInterval(trTimer);
  trTimer = setInterval(() => {
    if (state.view !== "pilotage" || state.pilotTab !== "tour") return trStopTv();
    if (document.querySelector("#modal:not([hidden]), .modal.open")) return;
    const seq = [null, ...trSites().map((s) => s.id)];
    trIdx = (trIdx + 1) % seq.length; trSite = seq[trIdx]; render();
  }, 20000);
  render();
}
function trStopTv() { trTv = false; clearInterval(trTimer); trTimer = null; if (state.view === "pilotage" && state.pilotTab === "tour") render(); }
function trFull() {
  if (document.fullscreenElement) return document.exitFullscreen?.();
  document.documentElement.requestFullscreen?.().catch(() => toast("Plein écran refusé par le navigateur : touche F11."));
}
document.addEventListener("fullscreenchange", () => { document.body.classList.toggle("tr-full", !!document.fullscreenElement && state.pilotTab === "tour"); if (state.view === "pilotage" && state.pilotTab === "tour") render(); });

/* ---------- Branchements : Voir › Tour de contrôle, adresse #tour ---------- */

const trPilotBase = renderUnifiedPilotage;
renderUnifiedPilotage = function () { if (state.pilotTab === "tour" && trCan()) return trPage(); return trPilotBase.apply(this, arguments); };
const trTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = trTabsBase(stage);
  if (stage?.id !== "voir" || !trCan() || out.some((t) => t.key === "tour")) return out;
  const i = out.findIndex((t) => t.view === "pilotage");
  out.splice(i >= 0 ? i + 1 : 0, 0, { key: "tour", label: "Tour de contrôle", view: "pilotage", set: { pilotTab: "tour" } });
  return out;
};
function trBind(root = document) {
  root.querySelectorAll("[data-tr-site]").forEach((b) => (b.onclick = () => { trSite = b.dataset.trSite || null; if (trTv) trStopTv(); else render(); }));
  root.querySelectorAll("[data-tr-tv]").forEach((b) => (b.onclick = () => (trTv ? trStopTv() : trStartTv())));
  root.querySelectorAll("[data-tr-full]").forEach((b) => (b.onclick = trFull));
  root.querySelectorAll("[data-tr-go]").forEach((b) => (b.onclick = () => {
    let g; try { g = JSON.parse(b.dataset.trGo); } catch { return; }
    trStopTv(); if (document.fullscreenElement) document.exitFullscreen?.();
    if (allowedSite(g.site)) state.site = g.site;
    if (!role().nav.includes(g.view)) return toast("Écran réservé à un autre profil.");
    switchView(g.view); Object.assign(state, g.set || {}); render();
  }));
  clearInterval(trClock);
  if (root.querySelector?.("#trClock")) trClock = setInterval(() => {
    const c = document.getElementById("trClock"); if (!c) return clearInterval(trClock);
    c.textContent = trNow();
    if (new Date().getSeconds() < 2 && !document.querySelector("#modal:not([hidden])")) render(); // données rafraîchies chaque minute
  }, 1000);
  document.body.classList.toggle("tr-on", state.view === "pilotage" && state.pilotTab === "tour");
  document.body.classList.toggle("tr-full", !!document.fullscreenElement && state.view === "pilotage" && state.pilotTab === "tour");
}
const trOsBindBase = osBind;
osBind = function () { const out = trOsBindBase.apply(this, arguments); trBind(document); return out; };
/* Adresse directe pour l'écran de la salle : …/#tour */
function trFromHash() { if (location.hash === "#tour" && trCan()) { state.pilotTab = "tour"; if (state.view !== "pilotage") switchView("pilotage"); state.pilotTab = "tour"; render(); } }
window.addEventListener("hashchange", trFromHash);
window.addEventListener("load", () => setTimeout(trFromHash, 0));
