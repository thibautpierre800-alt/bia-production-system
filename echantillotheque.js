"use strict";
/*
 * BIA Lean OS 8.40 · Échantillothèque (Pérenniser › Échantillothèque) : ce qui passe, ce qui ne passe pas.
 *  - Une référence = un défaut (liste des non-conformités), une zone de la pièce (A face vue, B chant ou face peu visible,
 *    C face cachée), un périmètre d'articles (motifs, * accepté), trois photos (accepté, limite, refusé), la tolérance
 *    chiffrée (jusqu'à N mm, mm², nombre, % ou ΔE ; vide = aucun défaut admis), ce qu'on fait au-delà (refusé, à retoucher),
 *    les conditions de contrôle (distance, éclairage, durée d'observation), l'emplacement de l'échantillon physique.
 *  - Règles à trois niveaux : groupe, site, client. La plus précise s'applique : client du site > client du groupe >
 *    site > groupe. L'écran dit laquelle s'applique et laquelle elle remplace.
 *  - Contrôler une pièce : défaut, zone, client et article → la règle applicable, ses photos, la valeur mesurée →
 *    conforme ou non, et « Déclarer une non-conformité » préremplie. La déclaration d'une non-conformité affiche aussi la règle.
 *  - Écarts entre sites : un même défaut, une même zone, des tolérances différentes d'un site à l'autre : à harmoniser.
 *  - Validation par un responsable, revalidation tous les 12 mois (les échantillons physiques s'abîment) ; « À surveiller ».
 * Données : samples[] { id, scope (group | site), site_id, client, articles, defect, zone, criterion, tol_max, tol_unit,
 *   over, distance_m, lux, seconds, location, photos{ok,limit,nok}, status, validated_by, validated_at, review_months, version }.
 */

const EH_ZONES = ["A · face vue", "B · chant, face peu visible", "C · face cachée"];
const EH_UNITS = ["mm", "mm²", "nombre", "%", "ΔE"];
const EH_OVER = ["Refusé", "À retoucher", "Déclassé"];
let ehDefect = "", ehZone = EH_ZONES[0], ehClient = "", ehArticle = "", ehMeasure = "", ehFilter = "";

function ehCan() { return true; }
function ehManager(scope) { return !role().readonly && osManager() && (scope === "group" ? osIsAdmin?.() || role().id === "lean" || state.role === "lean" : allowedSite(scope, true)); }
function ehRows() { return (data.samples || []).filter((s) => !s.archived_at && (s.scope === "group" || allowedSite(s.scope))); }
function ehMatchArticle(pattern, article) {
  const pats = String(pattern || "").split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (!pats.length) return true;
  if (!article) return false;
  const a = String(article).toUpperCase();
  return pats.some((p) => new RegExp(`^${p.toUpperCase().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(a));
}
function ehDue(s) { return s.validated_at ? auAddMonths(String(s.validated_at).slice(0, 10), Number(s.review_months) || 12) : null; }
function ehReview(s) { const d = ehDue(s); return s.status === "Validée" && d && d <= today(); }
function ehScopeLabel(s) { return `${s.scope === "group" ? "Groupe" : getSiteName(s.scope)}${s.client ? ` · client ${s.client}` : ""}`; }
/* La règle qui s'applique : client du site > client du groupe > site > groupe ; un périmètre d'articles plus précis l'emporte à égalité. */
function ehRule({ site, client = "", article = "", defect, zone }) {
  const c = mdFold(client);
  const cands = ehRows().filter((s) => s.status === "Validée" && s.defect === defect && s.zone === zone && (s.scope === "group" || s.scope === site) && (!s.client || (c && mdFold(s.client) === c)) && ehMatchArticle(s.articles, article));
  const score = (s) => (s.client ? 4 : 0) + (s.scope !== "group" ? 2 : 0) + (s.articles ? 1 : 0);
  cands.sort((a, b) => score(b) - score(a) || String(b.validated_at || "").localeCompare(String(a.validated_at || "")));
  return { rule: cands[0] || null, others: cands.slice(1) };
}
function ehTol(s) { return s.tol_max === null || s.tol_max === undefined || s.tol_max === "" ? "aucun défaut admis" : `accepté jusqu’à ${smNum(Number(s.tol_max))} ${s.tol_unit}`; }
function ehVerdict(s, v) {
  if (v === "" || v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  const x = Number(v), lim = s.tol_max === null || s.tol_max === undefined || s.tol_max === "" ? 0 : Number(s.tol_max);
  if (x <= lim) return { ok: true, label: x === lim && lim > 0 ? "À la limite : conforme" : "Conforme" };
  return { ok: false, label: s.over || "Refusé" };
}
function ehCond(s) { return [s.distance_m ? `à ${smNum(Number(s.distance_m))} m` : "", s.lux ? `${Number(s.lux).toLocaleString("fr-FR")} lux` : "", s.seconds ? `${s.seconds} s d’observation` : ""].filter(Boolean).join(" · "); }
function ehPhotos(s, big = false) {
  const cell = (k, l, cls) => `<figure class="eh-ph ${cls}">${s.photos?.[k] ? phImg(s.photos[k], "eh-img", `${l} · ${s.defect}`) : '<span class="eh-noph">pas de photo</span>'}<figcaption>${l}</figcaption></figure>`;
  return `<div class="eh-photos ${big ? "big" : ""}">${cell("ok", "Accepté", "ok")}${cell("limit", "Limite", "lim")}${cell("nok", "Refusé", "nok")}</div>`;
}
/* Une ligne pour la déclaration d'une non-conformité. */
function ehRuleLine(nc) {
  if (!nc.defect) return "";
  const r = EH_ZONES.map((z) => ({ z, r: ehRule({ site: nc.site_id, client: nc.client, article: nc.article, defect: nc.defect, zone: z }).rule })).filter((x) => x.r);
  if (!r.length) return `<p class="hint eh-ncline">Échantillothèque : aucune référence validée pour ce défaut${nc.article ? ` sur ${esc(nc.article)}` : ""}.</p>`;
  return `<p class="eh-ncline"><b>Échantillothèque</b> · ${r.map((x) => `${esc(x.z.split(" · ")[0])} : ${esc(ehTol(x.r))} (règle ${esc(ehScopeLabel(x.r))})`).join(" · ")}</p>`;
}

/* ---------- Page ---------- */

function ehPage() {
  const site = state.site === "group" ? null : state.site, rows = ehRows(), mgr = ehManager(site || "group") || (state.site === "group" && OPERATIONAL_SITES.some((s) => ehManager(s.id)));
  const head = pageHead("Pérenniser", "Échantillothèque", "Ce qui passe, ce qui ne passe pas : photos accepté, limite et refusé, tolérance chiffrée et conditions de contrôle, selon la règle du groupe, du site ou du client.",
    mgr ? '<div class="cs-head-tools"><button type="button" class="btn secondary" data-eh-new>Ajouter une référence</button></div>' : "");
  return `${head}${site ? ehControl(site) : '<p class="hint">Choisissez un site pour contrôler une pièce ; la vue groupe montre les références et les écarts entre sites.</p>'}${ehList(rows)}${ehGaps(rows)}${ehHow()}`;
}

function ehControl(site) {
  const defects = [...new Set(ehRows().filter((s) => s.status === "Validée" && (s.scope === "group" || s.scope === site)).map((s) => s.defect))];
  if (!defects.length) return `<section class="cs-empty"><h2>Aucune référence validée pour ce site</h2><p>Commencez par les défauts qui font débat au poste : une photo de ce qui est accepté, une de la limite, une de ce qui est refusé, et la tolérance chiffrée.</p></section>`;
  if (!defects.includes(ehDefect)) ehDefect = defects[0];
  const { rule, others } = ehRule({ site, client: ehClient, article: ehArticle, defect: ehDefect, zone: ehZone });
  const clients = [...new Set([...(data.orders || []).filter((o) => o.site_id === site).map((o) => o.client), ...ehRows().map((s) => s.client)].filter(Boolean))];
  const v = rule ? ehVerdict(rule, ehMeasure) : null;
  return `<section class="section eh-control"><div class="section-title"><h2>Contrôler une pièce</h2></div>
    <div class="field"><span class="metric-label">Défaut</span><div class="filters">${defects.map((d) => `<button type="button" class="chip ${d === ehDefect ? "active" : ""}" data-eh-d="${esc(d)}" aria-pressed="${d === ehDefect}">${esc(d)}</button>`).join("")}</div></div>
    <div class="field"><span class="metric-label">Zone de la pièce</span><div class="filters">${EH_ZONES.map((z) => `<button type="button" class="chip ${z === ehZone ? "active" : ""}" data-eh-z="${esc(z)}" aria-pressed="${z === ehZone}">${esc(z)}</button>`).join("")}</div></div>
    <div class="bp-two"><label class="field">Client (facultatif)<input id="ehClient" list="ehClients" value="${esc(ehClient)}" autocomplete="off"><datalist id="ehClients">${clients.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label><label class="field">Article (facultatif)<input id="ehArticle" value="${esc(ehArticle)}" autocomplete="off"></label></div>
    ${rule ? `<div class="eh-rule"><div class="eh-rule-head"><span class="jn-tag">${esc(ehScopeLabel(rule))}</span><b>${esc(rule.defect)} · ${esc(rule.zone)}</b>${others.length ? `<span class="hint">remplace : ${others.map((o) => esc(ehScopeLabel(o))).join(", ")}</span>` : ""}</div>
      ${ehPhotos(rule, true)}
      <p class="eh-tol"><b>${esc(ehTol(rule))}</b>${rule.criterion ? ` · ${esc(rule.criterion)}` : ""}</p>
      ${ehCond(rule) ? `<p class="hint">Contrôle ${esc(ehCond(rule))}${rule.location ? ` · échantillon physique : ${esc(rule.location)}` : ""}</p>` : rule.location ? `<p class="hint">Échantillon physique : ${esc(rule.location)}</p>` : ""}
      <div class="eh-measure"><label class="field">Mesuré sur la pièce (${esc(rule.tol_unit || "valeur")})<input id="ehMeasure" type="number" inputmode="decimal" min="0" step="any" value="${esc(ehMeasure)}"></label>${v ? `<p class="eh-verdict ${v.ok ? "ok" : "bad"}">${esc(v.label)}</p>` : ""}</div>
      ${v && !v.ok && typeof ncForm === "function" && !role().readonly ? '<button type="button" class="btn" data-eh-nc>Déclarer une non-conformité</button>' : ""}</div>`
      : `<p class="ts-warn">Pas de référence validée pour ${esc(ehDefect.toLowerCase())} en zone ${esc(ehZone.split(" · ")[0])}${ehClient ? ` pour ${esc(ehClient)}` : ""}${ehArticle ? ` sur ${esc(ehArticle)}` : ""} : demandez à la qualité.</p>`}
  </section>`;
}

function ehList(rows) {
  const site = state.site === "group" ? null : state.site;
  const list = rows.filter((s) => (!site || s.scope === "group" || s.scope === site) && (!ehFilter || s.defect === ehFilter)).sort((a, b) => a.defect.localeCompare(b.defect, "fr") || a.zone.localeCompare(b.zone) || (a.scope === "group" ? -1 : 1));
  const defs = [...new Set(rows.map((s) => s.defect))];
  const due = rows.filter(ehReview);
  return `<section class="section"><div class="section-title"><h2>Les références · ${list.length}</h2></div>${due.length ? `<p class="ts-warn">${due.length} référence${due.length > 1 ? "s" : ""} à revalider : l’échantillon physique s’abîme, la règle peut avoir changé.</p>` : ""}
    ${defs.length > 1 ? `<div class="filters">${["", ...defs].map((d) => `<button type="button" class="chip ${ehFilter === d ? "active" : ""}" data-eh-f="${esc(d)}" aria-pressed="${ehFilter === d}">${d ? esc(d) : "Tous"}</button>`).join("")}</div>` : ""}
    ${list.length ? `<div class="eh-cards">${list.map((s) => `<button type="button" class="eh-card" data-eh-open="${esc(s.id)}">${ehPhotos(s)}<span class="eh-card-t"><b>${esc(s.defect)} · ${esc(s.zone.split(" · ")[0])}</b><span>${esc(ehTol(s))}</span><small>${esc(ehScopeLabel(s))}${s.articles ? ` · ${esc(s.articles)}` : ""} · ${esc(s.status)}${ehReview(s) ? " · à revalider" : ""}</small></span></button>`).join("")}</div>` : '<p class="hint">Aucune référence.</p>'}</section>`;
}

/* Un même défaut, une même zone, sans client : des tolérances différentes selon les sites. */
function ehGaps(rows) {
  if (!(state.site === "group" || role().id === "lean" || state.role === "lean")) return "";
  const v = rows.filter((s) => s.status === "Validée" && !s.client && !s.articles), keys = [...new Set(v.map((s) => `${s.defect}|${s.zone}`))];
  const sites = OPERATIONAL_SITES.filter((x) => allowedSite(x.id));
  const lines = keys.map((k) => { const [d, z] = k.split("|"), g = v.find((s) => s.scope === "group" && s.defect === d && s.zone === z), per = sites.map((x) => v.find((s) => s.scope === x.id && s.defect === d && s.zone === z) || null); const vals = new Set([g, ...per].filter(Boolean).map((s) => `${s.tol_max ?? "0"}|${s.tol_unit}`)); return { d, z, g, per, diff: vals.size > 1 }; }).filter((x) => x.diff);
  if (!lines.length) return `<section class="section"><div class="section-title"><h2>Écarts entre sites</h2></div><p class="hint">Aucun écart : les sites qui ont une règle propre appliquent la même tolérance que le groupe.</p></section>`;
  const cell = (s) => (s ? `<button type="button" class="btn ghost small" data-eh-open="${esc(s.id)}">${s.tol_max === null || s.tol_max === undefined || s.tol_max === "" ? "0" : smNum(Number(s.tol_max))} ${esc(s.tol_unit)}</button>` : "—");
  return `<section class="section"><div class="section-title"><h2>Écarts entre sites · ${lines.length}</h2></div><p class="hint">Même défaut, même zone, des tolérances différentes : à harmoniser, ou à justifier (client, procédé, matière).</p><div class="cn-scroll"><table class="gn-sites eh-gaps"><thead><tr><th>Défaut · zone</th><th>Groupe</th>${sites.map((x) => `<th>${esc(x.name)}</th>`).join("")}</tr></thead><tbody>${lines.map((l) => `<tr><th>${esc(l.d)} <small>${esc(l.z.split(" · ")[0])}</small></th><td>${cell(l.g)}</td>${l.per.map((s) => `<td class="${s && l.g && `${s.tol_max}` !== `${l.g.tol_max}` ? "bad" : ""}">${cell(s)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function ehHow() {
  return `<details class="cs-how section"><summary>Une échantillothèque qui sert au poste</summary><ol class="cs-how-list"><li><b>Trois photos par défaut</b><span>Accepté, limite, refusé : la limite est la plus utile, c’est elle qui tranche les débats.</span></li><li><b>Une tolérance chiffrée</b><span>« Rayure jusqu’à 10 mm en zone A » se vérifie ; « légère rayure » se discute.</span></li><li><b>Les conditions de contrôle</b><span>Distance, éclairage et durée d’observation : sans elles, deux contrôleurs ne voient pas la même chose.</span></li><li><b>La règle la plus précise s’applique</b><span>Client du site, puis client du groupe, puis site, puis groupe ; l’écran dit laquelle.</span></li><li><b>Revalider chaque année</b><span>Les échantillons physiques s’abîment et les exigences clients évoluent.</span></li></ol></details>`;
}

/* ---------- Formulaire ---------- */

function ehForm(id = null) {
  const old = id ? (data.samples || []).find((s) => s.id === id) : null;
  const scopes = [["group", "Groupe"], ...OPERATIONAL_SITES.filter((x) => allowedSite(x.id)).map((x) => [x.id, x.name])].filter(([k]) => ehManager(k));
  if (!old && !scopes.length) return toast("Les références sont décidées par la qualité ou un responsable.");
  const can = old ? ehManager(old.scope) : true;
  if (old && !can) {
    return modal(`${old.defect} · ${old.zone}`, `<div class="jn-form">${ehPhotos(old, true)}<p class="eh-tol"><b>${esc(ehTol(old))}</b>${old.criterion ? ` · ${esc(old.criterion)}` : ""}</p><p class="hint">${esc(ehScopeLabel(old))}${old.articles ? ` · ${esc(old.articles)}` : ""}${ehCond(old) ? ` · contrôle ${esc(ehCond(old))}` : ""}${old.location ? ` · échantillon : ${esc(old.location)}` : ""} · ${esc(old.status)}${old.validated_by ? `, validée par ${esc(old.validated_by)}` : ""}</p><div class="form-actions"><button type="button" class="btn ghost" data-close-modal>Fermer</button></div></div>`);
  }
  const defScope = old?.scope || (state.site !== "group" && scopes.some(([k]) => k === state.site) ? state.site : scopes[0][0]);
  const v = old || { defect: NC_DEFECTS[0], zone: EH_ZONES[0], tol_unit: "mm", over: "Refusé", review_months: 12 };
  const ph = { ok: old?.photos?.ok || "", limit: old?.photos?.limit || "", nok: old?.photos?.nok || "" }, busy = {};
  modal(old ? `${old.id} · Référence` : "Ajouter une référence", `<form id="ehForm" class="jn-form">
    <div class="bp-two"><label class="field">Règle de<select id="ehScope">${scopes.map(([k, l]) => `<option value="${esc(k)}" ${k === defScope ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label><label class="field">Client (vide = tous)<input id="ehCl" value="${esc(v.client || "")}" autocomplete="off"></label></div>
    <div class="bp-two"><label class="field">Défaut<select id="ehDef">${NC_DEFECTS.map((d) => `<option ${d === v.defect ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label><label class="field">Zone<select id="ehZ">${EH_ZONES.map((z) => `<option ${z === v.zone ? "selected" : ""}>${esc(z)}</option>`).join("")}</select></label></div>
    <label class="field">Articles concernés (vide = tous ; ex. PAN-18*, PAN-2210)<input id="ehArt" value="${esc(v.articles || "")}" autocomplete="off"></label>
    <div class="eh-pick">${[["ok", "Accepté"], ["limit", "Limite"], ["nok", "Refusé"]].map(([k, l]) => `<label class="eh-pick-cell"><span>${l}</span><span class="eh-prev" id="ehPrev_${k}">${ph[k] ? phImg(ph[k], "eh-img", l) : '<span class="eh-noph">ajouter une photo</span>'}</span><input type="file" accept="image/*" capture="environment" data-eh-ph="${k}"></label>`).join("")}</div>
    <div class="ts-three"><label class="field">Tolérance : jusqu’à<input id="ehTol" type="number" inputmode="decimal" min="0" step="any" value="${esc(v.tol_max ?? "")}" placeholder="vide = aucun"></label><label class="field">Unité<select id="ehU">${EH_UNITS.map((u) => `<option ${u === v.tol_unit ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></label><label class="field">Au-delà<select id="ehOver">${EH_OVER.map((o) => `<option ${o === v.over ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label></div>
    <label class="field">Critère en clair<input id="ehCrit" maxlength="200" value="${esc(v.criterion || "")}" placeholder="Ex. longueur cumulée des rayures visibles, une seule par face" autocomplete="off"></label>
    <div class="ts-three"><label class="field">Distance (m)<input id="ehDist" type="number" min="0" step="0.1" value="${esc(v.distance_m ?? "")}"></label><label class="field">Éclairage (lux)<input id="ehLux" type="number" min="0" step="50" value="${esc(v.lux ?? "")}"></label><label class="field">Observation (s)<input id="ehSec" type="number" min="0" step="1" value="${esc(v.seconds ?? "")}"></label></div>
    <div class="bp-two"><label class="field">Échantillon physique rangé où<input id="ehLoc" maxlength="120" value="${esc(v.location || "")}" placeholder="Ex. armoire qualité, case 4" autocomplete="off"></label><label class="field">Revalider tous les (mois)<input id="ehRev" type="number" min="1" max="60" value="${esc(v.review_months ?? 12)}"></label></div>
    <div class="form-actions"><button class="btn jn-big" data-eh-save="Validée">${old?.status === "Validée" ? "Enregistrer et revalider" : "Valider la référence"}</button><button type="button" class="btn secondary" data-eh-save="Brouillon">Garder en brouillon</button>${old ? '<button type="button" class="btn ghost" data-eh-arch>Retirer</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("modalContent");
  root.querySelectorAll("[data-eh-ph]").forEach((inp) => (inp.onchange = async () => {
    const k = inp.dataset.ehPh, f = inp.files?.[0]; if (!f) return;
    busy[k] = true; $(`ehPrev_${k}`).textContent = "Préparation…";
    try { const url = await imageDataUrl(f); ph[k] = url; $(`ehPrev_${k}`).innerHTML = `<img class="eh-img" src="${url}" alt="">`; modalDirty = true; }
    catch (e) { $(`ehPrev_${k}`).textContent = e.message; }
    finally { busy[k] = false; }
  }));
  root.querySelector("[data-eh-arch]")?.addEventListener("click", () => { if (!commitData(() => { const s = data.samples.find((x) => x.id === old.id); s.archived_at = now(); })) return; modalDirty = false; closeModal(); render(); toast("Référence retirée."); });
  $("ehForm").onsubmit = (e) => e.preventDefault();
  root.querySelectorAll("[data-eh-save]").forEach((b) => (b.onclick = async (e) => {
    e.preventDefault();
    if (Object.values(busy).some(Boolean)) return toast("Attendez la préparation des photos.");
    const status = b.dataset.ehSave, num = (x) => (x === "" ? null : Number(x));
    const p = { scope: $("ehScope").value, client: $("ehCl").value.trim(), defect: $("ehDef").value, zone: $("ehZ").value, articles: $("ehArt").value.trim(), tol_max: num($("ehTol").value), tol_unit: $("ehU").value, over: $("ehOver").value, criterion: $("ehCrit").value.trim(), distance_m: num($("ehDist").value), lux: num($("ehLux").value), seconds: num($("ehSec").value), location: $("ehLoc").value.trim(), review_months: Number($("ehRev").value) || 12, status };
    if (!ehManager(p.scope)) return toast("Ce périmètre n’est pas le vôtre.");
    if (status === "Validée" && !ph.limit && !ph.nok && !p.criterion) return toast("Pour valider : au moins la photo limite ou refusée, ou le critère en clair.");
    const dup = (data.samples || []).find((s) => !s.archived_at && s.id !== old?.id && s.scope === p.scope && mdFold(s.client) === mdFold(p.client) && s.defect === p.defect && s.zone === p.zone && (s.articles || "") === p.articles);
    if (dup) return toast(`Une référence existe déjà pour ce périmètre : ${dup.id}.`);
    const photos = {};
    for (const k of ["ok", "limit", "nok"]) photos[k] = ph[k] && !phIsRef(ph[k]) && typeof phStore === "function" ? await phStore(ph[k]) : ph[k];
    let sid = old?.id;
    if (!commitData(() => {
      data.samples ||= [];
      const patch = { ...p, site_id: p.scope, photos, updated_at: now(), ...(status === "Validée" ? { validated_by: apMe() || role().label, validated_at: now(), version: (old?.version || 0) + 1 } : {}) };
      if (old) Object.assign(data.samples.find((x) => x.id === old.id), patch);
      else { sid = auNext("ECH", data.samples); data.samples.push({ id: sid, created_at: now(), ...patch }); }
    })) return;
    modalDirty = false; closeModal(); render(); toast(status === "Validée" ? `Référence ${sid} validée.` : `Référence ${sid} en brouillon.`);
  }));
}

/* ---------- Branchements : Pérenniser › Échantillothèque, non-conformités, À surveiller ---------- */

state.echOn ??= false;
const ehDocsBase = renderDocuments;
renderDocuments = function () { if (state.echOn) return ehPage(); return ehDocsBase.apply(this, arguments); };
const ehSwitchBase = switchView;
switchView = function (view) { if (view !== "documents") state.echOn = false; return ehSwitchBase.apply(this, arguments); };
const ehTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = ehTabsBase(stage);
  if (stage?.id !== "perenniser" || out.some((t) => t.key === "ech")) return out;
  const i = out.findIndex((t) => t.view === "documents");
  if (i < 0) return out;
  out[i] = { ...out[i], set: { ...(out[i].set || {}), echOn: false } };
  out.splice(i + 1, 0, { key: "ech", label: "Échantillothèque", view: "documents", set: { echOn: true } });
  return out;
};
const ehWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = ehWatchBase();
  if (role().readonly || !osManager()) return base;
  const due = ehRows().filter((s) => ehReview(s) && (state.site === "group" ? s.scope === "group" : s.scope === state.site)).slice(0, 2);
  if (!due.length) return base;
  const rows = due.map((s) => `<button type="button" class="jn-row" data-eh-go="${esc(s.id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">Échantillothèque</span><b>${esc(s.defect)} · ${esc(s.zone.split(" · ")[0])} à revalider</b><span class="hint">${esc(ehScopeLabel(s))} · depuis le ${shortDate(ehDue(s))}</span></span></button>`).join("");
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows}</div></section>`;
  return base.replace(/(<div class="jn-rows">)/, `$1${rows}`);
};
function ehBind(root = document) {
  root.querySelectorAll("[data-eh-new]").forEach((b) => (b.onclick = () => ehForm()));
  root.querySelectorAll("[data-eh-open]").forEach((b) => (b.onclick = () => ehForm(b.dataset.ehOpen)));
  root.querySelectorAll("[data-eh-go]").forEach((b) => (b.onclick = () => { state.echOn = true; switchView("documents"); state.echOn = true; render(); ehForm(b.dataset.ehGo); }));
  root.querySelectorAll("[data-eh-d]").forEach((b) => (b.onclick = () => { ehDefect = b.dataset.ehD; ehMeasure = ""; render(); }));
  root.querySelectorAll("[data-eh-z]").forEach((b) => (b.onclick = () => { ehZone = b.dataset.ehZ; ehMeasure = ""; render(); }));
  root.querySelectorAll("[data-eh-f]").forEach((b) => (b.onclick = () => { ehFilter = b.dataset.ehF; render(); }));
  const re = (id, set) => { const el = root.querySelector?.(`#${id}`); if (el) el.onchange = () => { set(el.value.trim()); render(); setTimeout(() => $(id)?.focus(), 0); }; };
  re("ehClient", (x) => (ehClient = x)); re("ehArticle", (x) => (ehArticle = x)); re("ehMeasure", (x) => (ehMeasure = x));
  root.querySelectorAll("[data-eh-nc]").forEach((b) => (b.onclick = () => ncForm(null, { defect: ehDefect, article: ehArticle, client: ehClient, origin: "Interne", severity: "Majeure", text: `${ehDefect} en zone ${ehZone.split(" · ")[0]} : ${ehMeasure} mesuré, hors tolérance de l’échantillothèque` })));
  if (typeof phFill === "function") phFill(root);
}
const ehOsBindBase = osBind;
osBind = function () { const out = ehOsBindBase.apply(this, arguments); ehBind(document); return out; };
