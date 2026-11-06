"use strict";
/*
 * BIA Lean OS 8.9 · Rapport d'étonnement (Observer › Rapport d'étonnement).
 * Tiré des Gemba du périmètre et de la période : carte sites × familles, points communs,
 * puis pour chaque thème ce qui a été vu (constats, risques à vérifier, questions, pistes, photos)
 * et les mots du responsable Lean : analyse, enjeu, recommandation, action 2027.
 * Points forts, plan d'actions issu du terrain, note de méthode. Imprimable et copiable pour le COMEX.
 * Données : data.etonnement[<périmètre>] = { message, from, to, themes: { <famille>: { analysis, stake, reco, action } }, updated_at }.
 */

const ET_FIELDS = [
  ["analysis", "Analyse", "Ce que les faits disent, ce qu’il reste à mesurer ou à vérifier"],
  ["stake", "Enjeu", "Pourquoi c’est important pour BIA : sécurité, qualité, délai, coût, personnes"],
  ["reco", "Recommandation", "Ce que nous proposons"],
  ["action", "Action 2027", "Ce qui entre dans le plan de déploiement 2027 : quoi, où, quand"],
];
const ET_METHOD = "Observations d’intégration, à confirmer avec les équipes des sites. Le rapport distingue les faits observés, les risques à vérifier, les questions et les pistes ; il ne vaut pas plan d’action définitif. Suite prévue : valider les constats, évaluer les risques, collecter les données, chercher les causes, prioriser, agir, mesurer, standardiser.";
let etPending = null, etTimer = null;

function etCan() { return role().nav.includes("terrain") && !["teamlead", "operator"].includes(state.role); }
function etWritable() { return etCan() && !role().readonly; }
function etKey() { return state.site === "group" ? "group" : state.site; }
function etStore() { const all = data.etonnement && typeof data.etonnement === "object" && !Array.isArray(data.etonnement) ? data.etonnement : {}; return all[etKey()] || {}; }
function etDay(v) { return String(v || "").slice(0, 10); }
function etScope() {
  const all = jnGembas(), st = etStore();
  const first = all.map((g) => etDay(g.created_at)).filter(Boolean).sort()[0] || today();
  const from = st.from || first, to = st.to || today();
  const gembas = all.filter((g) => etDay(g.created_at) >= from && etDay(g.created_at) <= to).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const notes = gembas.flatMap((g) => gembaObservations(g).map((o) => ({ g, o, kind: o.kind || "fait", fam: o.category || "Autre" })));
  return { from, to, first, gembas, notes };
}
function etFamilies(notes) {
  const order = [...new Set([...SIGNAL_TYPES, ...notes.map((n) => n.fam)])];
  const rows = order.map((fam) => {
    const list = notes.filter((n) => n.fam === fam && n.kind !== "positif");
    const sites = [...new Set(list.map((n) => n.g.site_id))];
    return { fam, list, sites, urgent: list.filter((n) => n.o.urgent).length };
  }).filter((r) => r.list.length);
  // Sécurité d'abord, puis les thèmes vus sur le plus de sites, puis le plus de notes.
  return rows.sort((a, b) => (b.fam === "Sécurité") - (a.fam === "Sécurité") || b.urgent - a.urgent || b.sites.length - a.sites.length || b.list.length - a.list.length);
}
function etPeriod(from, to) {
  const f = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return from === to ? `le ${f(from)}` : `du ${f(from)} au ${f(to)}`;
}
function etActions(gembas) {
  const ids = new Set(gembas.map((g) => g.id));
  return data.actions.filter((a) => !a.archived_at && ids.has(a.origin_id));
}
function etField(theme, key, label, hint, value, writable) {
  const id = `et-${theme ? etSlug(theme) : "msg"}-${key}`;
  if (!writable) return value ? `<div class="et-field"><span class="et-label">${esc(label)}</span><p class="et-text">${esc(value)}</p></div>` : "";
  return `<label class="et-field" for="${id}"><span class="et-label">${esc(label)}</span><textarea class="et-input" id="${id}" rows="2" data-et-theme="${esc(theme || "")}" data-et-key="${esc(key)}" placeholder="${esc(hint)}">${esc(value || "")}</textarea></label>`;
}
function etSlug(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

function etItems(list, max = 8) {
  const show = list.slice(0, max);
  return `<ul class="et-list">${show.map((n) => `<li><span class="et-site">${esc(getSiteName(n.g.site_id))}</span>${n.o.urgent ? '<span class="cp-tag urgent">Risque immédiat</span> ' : ""}${esc(n.o.fact)}${n.o.operator ? `<span class="et-sub">L’équipe : « ${esc(n.o.operator)} »</span>` : ""}</li>`).join("")}</ul>${list.length > max ? `<p class="et-more">+ ${list.length - max} autre(s) dans les comptes rendus de visite</p>` : ""}`;
}
function etTheme(r, st, writable) {
  const by = (k) => r.list.filter((n) => n.kind === k);
  const facts = r.list.filter((n) => n.kind === "fait" || n.kind === "risque").sort((a, b) => (b.o.urgent ? 1 : 0) - (a.o.urgent ? 1 : 0));
  const seen = facts.filter((n) => n.kind === "fait" || n.o.urgent);
  const pics = r.list.slice().sort((a, b) => (b.o.urgent ? 1 : 0) - (a.o.urgent ? 1 : 0)).flatMap((n) => cpPhotos(n.o)).slice(0, 3);
  const t = st.themes?.[r.fam] || {};
  const sub = (title, list) => (list.length ? `<div class="et-sub-block"><h5>${esc(title)}</h5>${etItems(list, 5)}</div>` : "");
  return `<section class="et-theme" data-et-fam="${esc(r.fam)}">
    <header class="et-theme-head"><h3>${esc(r.fam)}</h3><span>${jnPlural(r.sites.length, "site", "sites")} · ${jnPlural(r.list.length, "note", "notes")}${r.urgent ? ` · <b class="cp-bad">${jnPlural(r.urgent, "risque immédiat", "risques immédiats")}</b>` : ""}</span></header>
    <div class="et-theme-body">
      <div class="et-seen">
        ${seen.length ? `<h4>Constat</h4>${etItems(seen)}` : ""}
        ${sub("Risques à vérifier", facts.filter((n) => n.kind === "risque" && !n.o.urgent))}
        ${sub("Questions ouvertes", by("question"))}
        ${sub("Pistes", by("piste"))}
        ${pics.length ? `<div class="et-pics">${pics.map((p) => phImg(p, "et-img", "")).join("")}</div>` : ""}
      </div>
      <div class="et-words">${ET_FIELDS.map(([k, l, h]) => etField(r.fam, k, l, h, t[k], writable)).join("")}</div>
    </div></section>`;
}
function etMatrix(scope, fams) {
  const sites = [...new Set(scope.gembas.map((g) => g.site_id))];
  if (!sites.length || !fams.length) return "";
  const max = Math.max(1, ...fams.flatMap((r) => sites.map((s) => r.list.filter((n) => n.g.site_id === s).length)));
  const strong = (s) => scope.notes.filter((n) => n.kind === "positif" && n.g.site_id === s).length;
  const actions = etActions(scope.gembas);
  return `<div class="et-matrix-wrap"><table class="et-matrix"><thead><tr><th>Site</th><th>Visites</th>${fams.map((r) => `<th>${esc(r.fam)}</th>`).join("")}<th>Points forts</th><th>Actions ouvertes</th></tr></thead><tbody>${sites.map((s) => {
    const open = actions.filter((a) => a.site_id === s && a.status !== "Clôturée").length;
    return `<tr><th>${esc(getSiteName(s))}</th><td>${scope.gembas.filter((g) => g.site_id === s).length}</td>${fams.map((r) => {
      const l = r.list.filter((n) => n.g.site_id === s), u = l.filter((n) => n.o.urgent).length;
      return `<td class="et-cell" style="--et-a:${l.length ? (0.12 + (0.6 * l.length) / max).toFixed(2) : 0}">${l.length || ""}${u ? `<i title="${u} risque(s) immédiat(s)">${u}</i>` : ""}</td>`;
    }).join("")}<td>${strong(s) || ""}</td><td>${open || ""}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function etRender() {
  const scope = etScope(), st = etStore(), writable = etWritable(), fams = etFamilies(scope.notes);
  const where = state.site === "group" ? "BIA Holding" : getSiteName(state.site);
  const sites = [...new Set(scope.gembas.map((g) => g.site_id))];
  const common = fams.filter((r) => r.sites.length > 1);
  const strong = scope.notes.filter((n) => n.kind === "positif");
  const actions = etActions(scope.gembas), open = actions.filter((a) => a.status !== "Clôturée"), late = open.filter((a) => a.due_date && a.due_date < today());
  const photos = scope.notes.reduce((s, n) => s + cpPhotos(n.o).length, 0);
  const head = pageHead("Observer", "Rapport d’étonnement", "Ce que les Gemba ont montré, thème par thème : les faits du terrain, puis votre analyse, l’enjeu, la recommandation et l’action 2027. Prêt à imprimer pour le COMEX.", `<div class="et-tools"><button type="button" class="btn secondary" data-et-copy>Copier le texte</button><button type="button" class="btn" data-et-print>Imprimer / PDF</button></div>`);
  if (!scope.notes.length) return `${head}<div class="et-filters">${etFilters(scope, writable)}</div>${empty("Aucune note de Gemba sur ce périmètre et cette période. Le rapport se construit à partir des visites : démarrez un Gemba depuis Observer › Gemba.")}`;
  return `${head}<div class="et-filters">${etFilters(scope, writable)}</div>
  <article class="et-report">
    <header class="et-head"><p class="et-kicker">Rapport d’étonnement · ${esc(where)}</p><h2>Observations terrain ${esc(etPeriod(scope.from, scope.to))}</h2>
      <p class="et-figures">${jnPlural(scope.gembas.length, "visite", "visites")} · ${jnPlural(sites.length, "site", "sites")} (${esc(sites.map(getSiteName).join(", "))}) · ${jnPlural(scope.notes.length, "note", "notes")}${photos ? ` · ${jnPlural(photos, "photo", "photos")}` : ""}</p>
      ${etField("", "message", "Message clé", "Les deux ou trois phrases à retenir pour le COMEX", st.message, writable)}</header>
    <section class="et-block"><h3>Où regarder</h3><p class="et-lead">Nombre de notes par site et par famille (hors points forts) ; le chiffre rouge compte les risques immédiats.</p>${etMatrix(scope, fams)}
      ${common.length ? `<div class="et-common"><h4>Points communs aux sites</h4><ul>${common.map((r) => `<li><b>${esc(r.fam)}</b> · ${esc(r.sites.map(getSiteName).join(", "))} · ${jnPlural(r.list.length, "note", "notes")}</li>`).join("")}</ul></div>` : ""}</section>
    ${fams.map((r) => etTheme(r, st, writable)).join("")}
    ${strong.length ? `<section class="et-block et-strong"><h3>Points forts à garder et à partager</h3>${etItems(strong, 12)}</section>` : ""}
    <section class="et-block"><h3>Ce qui est déjà engagé</h3><p class="et-lead">${jnPlural(actions.length, "action issue de ces visites", "actions issues de ces visites")} · ${jnPlural(open.length, "ouverte", "ouvertes")}${late.length ? ` · <b class="cp-bad">${late.length} en retard</b>` : ""} · ${actions.length - open.length} close(s).</p>
      ${open.length ? `<table class="cp-r-table"><thead><tr><th>Action</th><th>Site</th><th>Pilote</th><th>Échéance</th></tr></thead><tbody>${open.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || String(a.due_date || "9").localeCompare(String(b.due_date || "9"))).slice(0, 12).map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(getSiteName(a.site_id))}</td><td>${esc(a.owner || "À désigner")}</td><td class="${a.due_date && a.due_date < today() ? "cp-bad" : ""}">${a.due_date ? esc(shortDate(a.due_date)) : "—"}</td></tr>`).join("")}</tbody></table>` : ""}</section>
    <p class="et-method">${esc(ET_METHOD)}</p>
    <p class="et-save" data-et-save aria-live="polite">${writable ? "Vos textes s’enregistrent au fil de la saisie, sur cet appareil." : ""}</p>
  </article>`;
}
function etFilters(scope, writable) {
  return `<label>Depuis le<input type="date" data-et-period="from" value="${esc(scope.from)}" ${writable ? "" : "disabled"}></label><label>Jusqu’au<input type="date" data-et-period="to" value="${esc(scope.to)}" ${writable ? "" : "disabled"}></label>${state.site === "group" ? '<span class="hint">Tous les sites du Groupe. Choisissez un site en haut pour son rapport.</span>' : ""}`;
}
function etText() {
  const scope = etScope(), st = etStore(), fams = etFamilies(scope.notes), where = state.site === "group" ? "BIA Holding" : getSiteName(state.site);
  const lines = [`Rapport d’étonnement · ${where}`, `Observations terrain ${etPeriod(scope.from, scope.to)} · ${jnPlural(scope.gembas.length, "visite", "visites")} · ${jnPlural(scope.notes.length, "note", "notes")}`];
  const item = (n) => `- ${getSiteName(n.g.site_id)} : ${n.o.urgent ? "[risque immédiat] " : ""}${n.o.fact}`;
  if (st.message) lines.push("", "MESSAGE CLÉ", st.message);
  const common = fams.filter((r) => r.sites.length > 1);
  if (common.length) lines.push("", "POINTS COMMUNS AUX SITES", ...common.map((r) => `- ${r.fam} : ${r.sites.map(getSiteName).join(", ")} (${jnPlural(r.list.length, "note", "notes")})`));
  for (const r of fams) {
    const t = st.themes?.[r.fam] || {};
    lines.push("", r.fam.toUpperCase());
    const facts = r.list.filter((n) => n.kind === "fait" || n.o.urgent), risks = r.list.filter((n) => n.kind === "risque" && !n.o.urgent), qs = r.list.filter((n) => n.kind === "question"), ideas = r.list.filter((n) => n.kind === "piste");
    if (facts.length) lines.push("Constat", ...facts.map(item));
    if (risks.length) lines.push("Risques à vérifier", ...risks.map(item));
    if (qs.length) lines.push("Questions ouvertes", ...qs.map(item));
    if (ideas.length) lines.push("Pistes", ...ideas.map(item));
    for (const [k, l] of ET_FIELDS) if (t[k]) lines.push(`${l} : ${t[k]}`);
  }
  const strong = scope.notes.filter((n) => n.kind === "positif");
  if (strong.length) lines.push("", "POINTS FORTS", ...strong.map(item));
  const open = etActions(scope.gembas).filter((a) => a.status !== "Clôturée");
  if (open.length) lines.push("", "DÉJÀ ENGAGÉ", ...open.map((a) => `- ${a.title} · ${getSiteName(a.site_id)} · ${a.owner || "à désigner"} · ${a.due_date ? shortDate(a.due_date) : "sans date"}`));
  lines.push("", ET_METHOD);
  return lines.join("\n");
}

/* ---------- Saisie : au fil de l'eau, comme les fiches ---------- */

function etQueue(el) {
  etPending = etPending || {};
  if (el.dataset.etPeriod) etPending["@" + el.dataset.etPeriod] = el.value;
  else etPending[`${el.dataset.etTheme}\u0000${el.dataset.etKey}`] = el.value;
  const s = document.querySelector("[data-et-save]");
  if (s) s.textContent = "Enregistrement…";
  clearTimeout(etTimer);
  etTimer = setTimeout(() => etFlush(), el.dataset.etPeriod ? 0 : 600);
}
function etFlush() {
  clearTimeout(etTimer);
  const change = etPending;
  etPending = null;
  if (!change || !etWritable()) return false;
  const key = etKey(), period = Object.keys(change).some((k) => k.startsWith("@"));
  const ok = commitData(() => {
    if (!data.etonnement || typeof data.etonnement !== "object" || Array.isArray(data.etonnement)) data.etonnement = {};
    const st = (data.etonnement[key] ||= { themes: {} });
    st.themes ||= {};
    for (const [k, v] of Object.entries(change)) {
      if (k.startsWith("@")) { const day = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; if (day) st[k.slice(1)] = day; else delete st[k.slice(1)]; continue; }
      const [theme, field] = k.split("\u0000"), text = String(v).slice(0, 4000);
      if (!theme) st[field] = text;
      else (st.themes[theme] ||= {})[field] = text;
    }
    st.updated_at = now();
  });
  const s = document.querySelector("[data-et-save]");
  if (s) s.textContent = ok ? `Enregistré à ${cpTime(now())}, sur cet appareil.` : "Non enregistré : espace local plein.";
  if (ok && period && state.view === "terrain" && state.terrainTab === "etonnement") render();
  return ok;
}
function etFit(el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }

/* ---------- Écran, onglet, liaisons ---------- */

const etRenderTerrainBase = renderTerrain;
renderTerrain = function () {
  if (state.terrainTab !== "etonnement") return etRenderTerrainBase();
  if (!etCan()) { state.terrainTab = "gemba"; return etRenderTerrainBase(); }
  return etRender();
};
const etTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = etTabsBase(stage);
  if (stage?.id !== "observer" || !etCan() || !out.some((t) => t.key === "gemba")) return out;
  const i = out.findIndex((t) => t.key === "gemba");
  out.splice(i + 1, 0, { key: "etonnement", label: "Rapport d’étonnement", view: "terrain", set: { terrainTab: "etonnement" } });
  return out;
};
const etRenderBase = render;
render = function () { if (etPending) etFlush(); return etRenderBase.apply(this, arguments); };
addEventListener("pagehide", () => { if (etPending) etFlush(); });

function etBind(root = document) {
  const view = root.querySelector?.(".et-report")?.closest("#appView") || (state.view === "terrain" && state.terrainTab === "etonnement" ? $("appView") : null);
  if (!view || view.dataset.etBound) { if (view) view.querySelectorAll(".et-input").forEach(etFit); return; }
  view.dataset.etBound = "1";
  view.addEventListener("input", (e) => { const el = e.target.closest?.(".et-input"); if (el) { etFit(el); etQueue(el); } });
  view.addEventListener("change", (e) => { const el = e.target.closest?.("[data-et-period]"); if (el) etQueue(el); });
  view.addEventListener("click", (e) => {
    if (e.target.closest?.("[data-et-print]")) { etFlush(); window.print(); }
    if (e.target.closest?.("[data-et-copy]")) { etFlush(); cpCopyPage(etText(), "Rapport copié : collez-le dans un mail, Word ou PowerPoint."); }
  });
  view.querySelectorAll(".et-input").forEach(etFit);
}
/* Copie depuis une page (pas de fenêtre ouverte) : repli dans une fenêtre si le presse-papiers est refusé. */
function cpCopyPage(text, done) {
  const fallback = () => { modal("Copier le texte", `<label class="field cp-copy-area">Sélectionnez et copiez le texte<textarea readonly rows="16">${esc(text)}</textarea></label>`); const a = $("modalContent").querySelector("textarea"); a.focus(); a.select(); };
  try { navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(() => toast(done), fallback) : fallback(); } catch { fallback(); }
}
const etOsBindBase = osBind;
osBind = function () { const out = etOsBindBase.apply(this, arguments); etBind(document); return out; };
