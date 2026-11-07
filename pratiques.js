"use strict";
/*
 * BIA Lean OS 8.21 · Bonnes pratiques entre sites (Yokoten) et leçons ponctuelles (OPL).
 *  Bonnes pratiques (Pérenniser › Bonnes pratiques) :
 *  - Chaque site voit le catalogue des pratiques publiées par les autres : photo avant / après, résultat chiffré,
 *    effort pour la refaire, et site par site où en est la reprise.
 *  - La fiche d'une page : le problème, ce qu'on a fait, le résultat et sa preuve, l'effort, les conditions pour la
 *    refaire ailleurs, où la voir, le contact. Brouillon, demande de validation, publication par le Lean.
 *  - Chaque site choisit (« Ça nous intéresse ») : étude, essai avec un pilote et une action datée, résultat prouvé
 *    chez lui, déploiement relié à son standard, ou « Pas pour nous » avec la raison. Ce que le site a amélioré au
 *    passage revient sur la fiche d'origine (copier, puis améliorer).
 *  - Déploiement : tableau pratiques × sites, pour voir qui avance et qui attend.
 *  Leçons ponctuelles (Pérenniser › OPL) :
 *  - Un point, une page : deux photos (bon / pas bon, avant / après, défaut / parade), trois points clés au plus,
 *    le pourquoi ; validée par le chef d'équipe ou le responsable ; présentée au poste en 5 à 10 minutes.
 *  - Qui est formé, quand, par qui, sur quelle version ; OPL A4 avec la grille de signatures.
 * Données : practices[] (indexée) : champs ajoutés problem, res_label, res_before, res_after, res_unit, effort, cost,
 *   where, before_photo, after_photo, published_at. deployments[] (indexée) : champs ajoutés na_reason, improvement,
 *   local_before, local_after, local_photo, action_id, interest_at, tested_at, proven_at, deployed_at.
 *   opls[] (non indexée) = { id, site_id, workshop_id, kind, title, station, author, version, status, photo_a,
 *   photo_b, points[], why, minutes, practice_id, validated_by, validated_at, trained[{ name, date, by, version }] }.
 */

const BP_PUB = ["Publiée", "Validée", "Déployée"];
const BP_EFFORT = ["Moins d’un jour", "Moins d’une semaine", "Un chantier"];
const BP_NA = ["Pas le même produit", "Pas le même équipement", "Déjà mieux chez nous", "Pas prioritaire maintenant"];
const BP_STEPS = [["Candidate", "À étudier"], ["Test", "En essai"], ["Validée sur autre site", "Résultat prouvé"], ["Déployée", "Déployée"]];
const BP_TONE = { Candidate: "cand", Test: "test", "Validée sur autre site": "proof", "Déployée": "done", "Non applicable": "na" };
const BP_LABEL = { Candidate: "À étudier", Test: "En essai", "Validée sur autre site": "Résultat prouvé", "Déployée": "Déployée", "Non applicable": "Pas pour nous" };

function bpCan() { return role().nav.includes("practices"); }
function bpGet(id) { return (data.practices || []).find((p) => p.id === id && !p.archived_at); }
function bpPub(p) { return BP_PUB.includes(p?.status); }
function bpVisible(p) { return !!p && !p.archived_at && (bpPub(p) || allowedSite(p.site_id)); }
function bpRows() { return (data.practices || []).filter(bpVisible); }
function bpDeps(pid) { return (data.deployments || []).filter((d) => !d.archived_at && d.practice_id === pid); }
function bpDep(pid, sid) { return bpDeps(pid).find((d) => d.site_id === sid); }
function bpDepGet(id) { return (data.deployments || []).find((d) => d.id === id && !d.archived_at); }
function bpEditable(p) { return !role().readonly && osWritable(p.site_id) && allowedSite(p.site_id, true); }
function bpCanAdopt(sid) { return !role().readonly && osManager() && osWritable(sid) && allowedSite(sid, true); }
function bpWriterSites() { return role().readonly ? [] : OPERATIONAL_SITES.filter((s) => osWritable(s.id) && allowedSite(s.id, true)); }
function bpHas(v) { return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)); }
function bpNum(v) { return bpHas(v) ? String(Math.round(Number(v) * 100) / 100).replace(".", ",") : ""; }
function bpParse(v) { const t = String(v ?? "").trim().replace(/\s/g, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; }
function bpCut(s, n) { s = String(s || ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; }
function bpCatOf(p) { return p.category || "Autre"; }
function bpHeadline(p, before = p?.res_before, after = p?.res_after) {
  if (!p || !bpHas(before) || !bpHas(after)) return "";
  const b = Number(before), a = Number(after), pct = b ? Math.round(((a - b) / Math.abs(b)) * 100) : null;
  return `${p.res_label ? `${p.res_label} : ` : ""}${bpNum(b)}\u00a0→ ${bpNum(a)}${p.res_unit ? `\u00a0${p.res_unit}` : ""}${pct ? ` (${pct > 0 ? "+" : "−"}${Math.abs(pct)}\u00a0%)` : ""}`;
}
function bpMissing(p) {
  const m = [];
  if (!String(p.summary || "").trim()) m.push("ce qu’on a fait");
  if (!String(p.evidence || "").trim()) m.push("comment le résultat est mesuré");
  if (!String(p.transfer || "").trim()) m.push("les conditions pour la refaire ailleurs");
  return m;
}
function bpAdvice(p) { const m = []; if (!p.after_photo) m.push("la photo après"); if (!bpHeadline(p)) m.push("le résultat chiffré, avant → après"); return m; }
function bpSave(id, fn) { const ok = commitData(() => { const p = data.practices.find((x) => x.id === id); fn(p); p.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function bpAdoption(p) { const deps = bpDeps(p.id), n = (s) => deps.filter((d) => d.status === s).length; return { done: n("Déployée"), proof: n("Validée sur autre site"), test: n("Test"), cand: n("Candidate"), na: n("Non applicable") }; }
function bpAdoptText(p) {
  const a = bpAdoption(p), parts = [];
  if (a.done) parts.push(`déployée sur ${jnPlural(a.done, "site", "sites")}`);
  if (a.proof) parts.push(`prouvée sur ${jnPlural(a.proof, "site", "sites")}`);
  if (a.test) parts.push(`en essai sur ${a.test}`);
  if (a.cand) parts.push(`à l’étude sur ${a.cand}`);
  return parts.length ? parts.join(" · ").replace(/^./, (c) => c.toUpperCase()) : "Pas encore reprise par un autre site";
}
function bpDots(p) {
  return `<span class="bp-dots" aria-hidden="true">${OPERATIONAL_SITES.map((s) => { const d = bpDep(p.id, s.id), tone = s.id === p.site_id ? "orig" : d ? BP_TONE[d.status] || "cand" : "none"; return `<i class="bp-dot s-${tone}" title="${esc(s.name)} : ${esc(s.id === p.site_id ? "site d’origine" : d ? BP_LABEL[d.status] || d.status : "pas encore étudiée")}"></i>`; }).join("")}</span>`;
}
function bpStatusPill(p) { const tone = bpPub(p) ? "pub" : p.status === "À valider" ? "wait" : "draft"; return `<span class="bp-st ${tone}">${esc(bpPub(p) ? "Publiée" : p.status || "À compléter")}</span>`; }
function bpLegend() { return `<p class="pv-legend bp-legend">${[["orig", "Site d’origine"], ["none", "Pas encore étudiée"], ["cand", "À étudier"], ["test", "En essai"], ["proof", "Résultat prouvé"], ["done", "Déployée"], ["na", "Pas pour nous"]].map(([k, l]) => `<span><i class="bp-dot s-${k}"></i>${l}</span>`).join("")}</p>`; }

/* Emplacement photo commun (bonnes pratiques et OPL). */
function bpSlot(key, value, label, tone = "", writable = true) {
  const body = value ? `<div class="cp-ph cs-tag-ph">${phImg(value, "id-ba-img", label)}${writable ? '<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-ph-del aria-label="Retirer la photo">×</button></span>' : ""}</div>`
    : writable ? `<button type="button" class="cp-ph-add cs-tag-ph" data-ph-add><b>Photo</b><span>${esc(label)}</span></button>` : `<span class="id-ba-img id-nophoto">${esc(label)}</span>`;
  return `<figure class="bp-slot ${tone}" data-ph-slot="${esc(key)}">${body}<figcaption>${esc(label)}</figcaption></figure>`;
}
function bpSlotsBind(root, fileId, get, set, label, tone = () => "") {
  const file = $(fileId);
  if (!root || !file) return;
  let pending = null;
  const paint = (key) => { const fig = root.querySelector(`[data-ph-slot="${key}"]`); if (!fig) return; fig.outerHTML = bpSlot(key, get(key), label(key), tone(key)); bind(); phFill(root); };
  const bind = () => root.querySelectorAll("[data-ph-slot]").forEach((fig) => {
    const key = fig.dataset.phSlot, add = fig.querySelector("[data-ph-add]"), del = fig.querySelector("[data-ph-del]");
    if (add) add.onclick = () => { pending = key; file.click(); };
    if (del) del.onclick = () => { if (set(key, "")) paint(key); };
  });
  file.onchange = async () => {
    const f = file.files?.[0], key = pending;
    file.value = "";
    if (!f || !key) return;
    try { const ref = await phStore(await imageDataUrl(f)); if (ref && set(key, ref)) paint(key); } catch (error) { toast(error.message); }
  };
  bind();
  phFill(root);
}

/* ---------- Page Bonnes pratiques : le catalogue des sites ---------- */

function bpCard(p, site) {
  const d = site ? bpDep(p.id, site) : null, origin = site && p.site_id === site, head = bpHeadline(p), fresh = site && bpPub(p) && !origin && !d;
  const act = !bpPub(p) ? "" : origin ? '<span class="bp-st orig">Votre site d’origine</span>'
    : d ? `<button type="button" class="btn small secondary" data-bp-adopt="${esc(d.id)}">${esc(BP_LABEL[d.status] || d.status)}</button>`
      : site && bpCanAdopt(site) ? `<button type="button" class="btn small" data-bp-interest="${esc(p.id)}|${esc(site)}">Ça nous intéresse</button>` : "";
  const photos = p.before_photo || p.after_photo ? `<div class="id-photos">${p.before_photo ? phImg(p.before_photo, "id-thumb", "Avant") : ""}${p.after_photo ? phImg(p.after_photo, "id-thumb", "Après") : ""}</div>` : "";
  return `<article class="bp-card ${bpPub(p) ? "" : "draft"} ${fresh ? "fresh" : ""}">${photos}<div class="id-main"><div class="id-top">${bpPub(p) ? "" : bpStatusPill(p)}<span class="bp-cat">${esc(bpCatOf(p))}</span><span class="hint">${esc(getSiteName(p.site_id))}${p.owner ? ` · ${esc(p.owner)}` : ""}</span>${fresh ? '<span class="bp-fresh">Nouveau pour vous</span>' : ""}</div>
    <b>${esc(p.title)}</b>${head ? `<p class="bp-res">${esc(head)}</p>` : ""}${p.summary ? `<p class="id-pb">${esc(bpCut(p.summary, 170))}</p>` : ""}
    ${bpPub(p) ? `<div class="bp-adopt-line">${bpDots(p)}<span class="hint">${esc(bpAdoptText(p))}</span></div>` : ""}
    <div class="id-acts"><button type="button" class="btn small ghost" data-bp-open="${esc(p.id)}">Voir la fiche</button>${act}</div></div></article>`;
}
function bpHow() {
  return `<details class="cs-how section"><summary>Partager entre sites (Yokoten)</summary><ol class="cs-how-list"><li><b>Prouver d’abord</b><span>Une pratique se partage quand son résultat est mesuré sur le site, photo avant et après.</span></li><li><b>Une fiche d’une page</b><span>Le problème, ce qu’on a fait, le résultat, l’effort, les conditions pour la refaire ailleurs, où la voir et qui appeler.</span></li><li><b>Chaque site choisit</b><span>On ne l’impose pas : on va voir, on décide « on l’essaie » ou « pas pour nous », avec la raison.</span></li><li><b>Essayer, prouver, déployer</b><span>Un pilote, une date, le résultat mesuré chez soi, puis le standard du site et l’OPL pour former l’équipe.</span></li><li><b>Copier, puis améliorer</b><span>Ce qu’un site améliore au passage revient sur la fiche du site d’origine.</span></li></ol></details>`;
}
function bpPage() {
  const rows = bpRows(), site = state.site !== "group" ? state.site : null, cat = state.bpCat || "", canNew = bpWriterSites().length > 0;
  const head = pageHead("Pérenniser", "Bonnes pratiques", "Ce qui a marché sur un site, prouvé, pour que les autres sites viennent voir, la reprennent et l’améliorent.", canNew && rows.length ? '<button type="button" class="btn" data-bp-new>Partager une pratique</button>' : "");
  if (!rows.length) return `${head}<section class="cs-empty"><h2>La première bonne pratique</h2><p>Une amélioration qui a fait ses preuves sur votre site : une photo avant, une photo après, le résultat mesuré et ce qu’il faut pour la refaire ailleurs. Une fois publiée, tous les sites la voient et peuvent l’essayer.</p>${canNew ? '<button type="button" class="btn" data-bp-new>Partager une pratique</button>' : ""}</section>${bpHow()}`;
  const pub = rows.filter(bpPub), drafts = rows.filter((p) => !bpPub(p) && (state.site === "group" || p.site_id === state.site));
  const deps = (data.deployments || []).filter((d) => !d.archived_at && pub.some((p) => p.id === d.practice_id));
  const running = deps.filter((d) => ["Candidate", "Test"].includes(d.status)).length, proven = deps.filter((d) => ["Validée sur autre site", "Déployée"].includes(d.status)).length, impr = deps.filter((d) => String(d.improvement || "").trim()).length;
  const strip = `<div class="cs-summary"><div><b>${pub.length}</b><span>publiée${pub.length > 1 ? "s" : ""}</span></div><div><b>${running}</b><span>reprise${running > 1 ? "s" : ""} en cours</span></div><div><b>${proven}</b><span>reprise${proven > 1 ? "s" : ""} prouvée${proven > 1 ? "s" : ""} ailleurs</span></div><div><b>${impr}</b><span>amélioration${impr > 1 ? "s" : ""} renvoyée${impr > 1 ? "s" : ""}</span></div></div>`;
  let mine = "";
  if (site) {
    const my = pub.map((p) => ({ p, d: bpDep(p.id, site) })).filter((x) => x.d && ["Candidate", "Test", "Validée sur autre site"].includes(x.d.status));
    if (my.length) mine = `<section class="section"><div class="section-title"><h2>En cours à ${esc(getSiteName(site))} · ${my.length}</h2></div><div class="jn-rows bp-mine">${my.map(({ p, d }) => { const late = d.due_date && d.due_date < today() && d.status !== "Validée sur autre site";
      return `<button type="button" class="jn-row" data-bp-adopt="${esc(d.id)}"><span class="jn-row-main"><span class="jn-tag bp-tag s-${BP_TONE[d.status]} ${late ? "tone-warn" : ""}">${esc(BP_LABEL[d.status])}</span><b>${esc(p.title)}</b><span class="hint">De ${esc(getSiteName(p.site_id))} · ${esc(d.owner || "pilote à désigner")}${d.due_date && d.status !== "Validée sur autre site" ? ` · ${late ? "en retard depuis le" : "jusqu’au"} ${shortDate(d.due_date)}` : ""}</span></span></button>`; }).join("")}</div></section>`;
  }
  const cats = [...new Set(pub.map(bpCatOf))], isNew = (p) => site && p.site_id !== site && !bpDep(p.id, site);
  const list = pub.filter((p) => !cat || bpCatOf(p) === cat).sort((a, b) => (isNew(b) - isNew(a)) || String(b.published_at || b.updated_at || "").localeCompare(String(a.published_at || a.updated_at || "")));
  const filters = cats.length > 1 ? `<div class="filters bp-cats"><button type="button" class="chip ${cat ? "" : "active"}" data-bp-cat="">Tous les thèmes</button>${cats.map((c) => `<button type="button" class="chip ${c === cat ? "active" : ""}" data-bp-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : "";
  const draftSec = drafts.length ? `<section class="section"><div class="section-title"><h2>À compléter et à valider · ${drafts.length}</h2></div><div class="bp-list">${drafts.sort((a, b) => (b.status === "À valider") - (a.status === "À valider") || String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).map((p) => bpCard(p, site)).join("")}</div></section>` : "";
  return `${head}${strip}${mine}${draftSec}<section class="section"><div class="section-title"><h2>Le catalogue des sites · ${list.length}</h2></div>${filters}${list.length ? `<div class="bp-list">${list.map((p) => bpCard(p, site)).join("")}</div>` : `<p class="hint">Aucune pratique publiée${cat ? " dans ce thème" : ""} pour l’instant.</p>`}</section>${bpHow()}`;
}

/* ---------- Partager une pratique ---------- */

function bpNew(preset = {}) {
  const sites = bpWriterSites();
  if (!sites.length) return toast("Votre profil ne permet pas de partager une pratique ici.");
  const src = preset.source_id ? (data.kaizens || []).find((k) => k.id === preset.source_id) : null;
  let siteId = preset.site_id && sites.some((s) => s.id === preset.site_id) ? preset.site_id : state.site !== "group" && sites.some((s) => s.id === state.site) ? state.site : sites[0].id;
  const ph = { before_photo: preset.before_photo || src?.before_photo || "", after_photo: preset.after_photo || src?.after_photo || "" };
  modal("Partager une bonne pratique", `<form id="bpNewForm" class="jn-form bp-new"><p class="jn-lead">Une photo avant, une photo après et le résultat : les autres sites jugeront sur pièce.</p>
    <div class="id-ba bp-ba">${bpSlot("before_photo", ph.before_photo, "Avant")}${bpSlot("after_photo", ph.after_photo, "Après")}</div><input type="file" id="bpNewFile" accept="image/*" capture="environment" hidden>
    <label class="field">La pratique, en une phrase<input id="bpTitle" required value="${esc(preset.title || "")}" placeholder="Ex. Contrôle première pièce avec échantillon maître" autocomplete="off"></label>
    <label class="field">Ce qu’on a fait<textarea id="bpSummary" rows="3" required placeholder="La solution, concrètement">${esc(preset.summary || src?.solution || "")}</textarea></label>
    <fieldset class="bp-res-box"><legend>Le résultat mesuré</legend><div class="bp-res-grid"><label>Indicateur<input id="bpResLabel" placeholder="Ex. Rebut" autocomplete="off"></label><label>Avant<input id="bpResBefore" inputmode="decimal" autocomplete="off"></label><label>Après<input id="bpResAfter" inputmode="decimal" autocomplete="off"></label><label>Unité<input id="bpResUnit" placeholder="%" autocomplete="off"></label></div></fieldset>
    ${sites.length > 1 ? `<label class="field">Site<select id="bpSite">${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <div class="form-actions"><button class="btn jn-big">Créer la fiche</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  bpSlotsBind($("bpNewForm"), "bpNewFile", (k) => ph[k], (k, v) => { ph[k] = v; modalDirty = true; return true; }, (k) => (k === "before_photo" ? "Avant" : "Après"));
  if ($("bpSite")) $("bpSite").onchange = () => { siteId = $("bpSite").value; };
  setTimeout(() => $("bpTitle")?.focus(), 0);
  $("bpNewForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("bpTitle").value.trim(), summary = $("bpSummary").value.trim(), rb = bpParse($("bpResBefore").value), ra = bpParse($("bpResAfter").value);
    if (!title) { $("bpTitle").focus(); return toast("Nommez la pratique en une phrase."); }
    if (!summary) { $("bpSummary").focus(); return toast("Dites ce qu’on a fait."); }
    if (Number.isNaN(rb) || Number.isNaN(ra)) return toast("Résultat : des nombres, par exemple 2,8.");
    let pid = null;
    if (!commitData(() => {
      data.practices ||= [];
      pid = auNext("BP", data.practices);
      const row = { id: pid, site_id: siteId, workshop_id: siteId === preset.site_id ? preset.workshop_id || null : null, title, owner: preset.owner || apMe() || osActor(), category: preset.category || src?.category || "Production", problem: preset.problem || src?.problem || "", summary, evidence: preset.evidence || "", transfer: preset.transfer || "", status: "À compléter", validated_by: "", res_label: $("bpResLabel").value.trim(), res_before: rb, res_after: ra, res_unit: $("bpResUnit").value.trim(), before_photo: ph.before_photo, after_photo: ph.after_photo, source_id: preset.source_id || null, kpi_id: preset.kpi_id || null, created_at: now(), updated_at: now() };
      if (!SIGNAL_TYPES.includes(row.category)) row.category = "Production";
      recordHistory(row, "À compléter", "Fiche créée");
      data.practices.unshift(row);
    })) return;
    modalDirty = false;
    render();
    bpOpen(pid, "fiche");
    toast(`Fiche ${pid} créée : complétez la preuve et les conditions, puis demandez la validation.`);
  };
}

/* ---------- La fiche ---------- */

function bpSheet(p) {
  const head = bpHeadline(p), impr = bpDeps(p.id).filter((d) => String(d.improvement || "").trim());
  const ph = (v, l) => (v ? phImg(v, "id-ba-img", l) : "") || `<span class="id-ba-img id-nophoto">${l}</span>`;
  const rows = [["Le problème", p.problem], ["Ce qu’on a fait", p.summary], ["Le résultat", [head, p.evidence].filter(Boolean).join(" — ")], ["Pour la refaire ailleurs", p.transfer], ["Effort", [p.effort, bpHas(p.cost) ? `${bpNum(p.cost)} €` : ""].filter(Boolean).join(" · ")]].filter(([, v]) => String(v || "").trim());
  return `<article class="bp-sheet"><header><div><small>BONNE PRATIQUE · ${esc(bpCatOf(p).toUpperCase())}</small><h3>${esc(p.title)}</h3><p>${esc(getSiteName(p.site_id))}${p.where ? ` · ${esc(p.where)}` : ""}${p.owner ? ` · contact ${esc(p.owner)}` : ""}</p></div>${head ? `<b class="bp-big">${esc(head)}</b>` : ""}</header>
    <div class="id-ba big"><figure>${ph(p.before_photo, "Avant")}<figcaption>Avant</figcaption></figure><figure>${ph(p.after_photo, "Après")}<figcaption>Après</figcaption></figure></div>
    <dl class="id-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${impr.length ? `<section class="bp-impr"><h4>Améliorée par les autres sites</h4><ul>${impr.map((d) => `<li><b>${esc(getSiteName(d.site_id))} :</b> ${esc(d.improvement)}</li>`).join("")}</ul></section>` : ""}
    <footer>${bpPub(p) ? `Publiée${p.published_at ? ` le ${shortDate(p.published_at)}` : ""}${p.validated_by ? ` · validée par ${esc(p.validated_by)}` : ""} · ${esc(bpAdoptText(p))}` : esc(p.status || "À compléter")} · ${esc(p.id)}</footer></article>`;
}
function bpStatusBox(p) {
  const miss = bpMissing(p), adv = bpAdvice(p), admin = osIsAdmin() && !role().readonly;
  if (bpPub(p)) return `<p class="bp-ok">Publiée${p.published_at ? ` le ${shortDate(p.published_at)}` : ""}${p.validated_by ? ` · validée par ${esc(p.validated_by)}` : ""}. Tous les sites la voient dans le catalogue.</p>${admin ? '<button type="button" class="btn secondary" data-bp-replicate>Proposer à des sites</button>' : ""}`;
  const todo = miss.length ? `<p class="bp-miss">Pour publier, il manque : ${esc(miss.join(", "))}.</p>` : "", tip = adv.length ? `<p class="hint">Conseillé : ${esc(adv.join(", "))}.</p>` : "";
  if (admin) return `${todo}${tip}<div class="bp-pub"><label class="field">Validée par<input id="bpValidator" list="ownerList" value="${esc(p.validated_by || apMe() || osActor())}"></label><button type="button" class="btn" data-bp-publish ${miss.length ? "disabled" : ""}>Publier pour tous les sites</button>${p.status === "À valider" ? '<button type="button" class="btn ghost" data-bp-back>Renvoyer à compléter</button>' : ""}</div>`;
  if (p.status === "À valider") return `<p class="bp-wait">Demande de validation envoyée au responsable Lean.</p>${todo}`;
  return `${todo}${tip}<button type="button" class="btn" data-bp-ask ${miss.length ? "disabled" : ""}>Demander la validation</button>`;
}
function bpForm(p) {
  const head = bpHeadline(p), chip = (attr, v, cur) => `<button type="button" class="chip ${v === cur ? "active" : ""}" ${attr}="${esc(v)}" aria-pressed="${v === cur}">${esc(v)}</button>`;
  return `<div class="bp-form">
    <div class="id-ba bp-ba">${bpSlot("before_photo", p.before_photo, "Avant")}${bpSlot("after_photo", p.after_photo, "Après")}</div>
    <label class="field">La pratique, en une phrase<input data-bp-f="title" value="${esc(p.title || "")}"></label>
    <div class="ap-field"><span class="metric-label">Thème</span><div class="filters">${SIGNAL_TYPES.map((c) => chip("data-bp-catset", c, p.category)).join("")}</div></div>
    <label class="field">Avant : le problème<textarea data-bp-f="problem" rows="2" placeholder="Ex. 2,8 % de rebut au démarrage de chaque lot">${esc(p.problem || "")}</textarea></label>
    <label class="field">Ce qu’on a fait<textarea data-bp-f="summary" rows="3" placeholder="La solution, concrètement">${esc(p.summary || "")}</textarea></label>
    <fieldset class="bp-res-box"><legend>Le résultat mesuré</legend><div class="bp-res-grid"><label>Indicateur<input data-bp-f="res_label" value="${esc(p.res_label || "")}" placeholder="Ex. Rebut"></label><label>Avant<input data-bp-n="res_before" inputmode="decimal" value="${esc(bpNum(p.res_before))}"></label><label>Après<input data-bp-n="res_after" inputmode="decimal" value="${esc(bpNum(p.res_after))}"></label><label>Unité<input data-bp-f="res_unit" value="${esc(p.res_unit || "")}" placeholder="%, min, €"></label></div>
      <p class="bp-res bp-headline" ${head ? "" : "hidden"}>${esc(head)}</p>
      <label class="field">Comment c’est mesuré (la preuve)<textarea data-bp-f="evidence" rows="2" placeholder="Relevés, période, nombre de lots">${esc(p.evidence || "")}</textarea></label></fieldset>
    <div class="ap-field"><span class="metric-label">Effort pour la refaire</span><div class="filters">${BP_EFFORT.map((c) => chip("data-bp-effort", c, p.effort)).join("")}</div></div>
    <div class="bp-two"><label class="field">Coût (€, facultatif)<input data-bp-n="cost" inputmode="decimal" value="${esc(bpNum(p.cost))}"></label><label class="field">Contact<input data-bp-f="owner" list="ownerList" value="${esc(p.owner || "")}">${ownerDatalist()}</label></div>
    <label class="field">Pour la refaire ailleurs<textarea data-bp-f="transfer" rows="3" placeholder="Prérequis, limites, matériel, formation">${esc(p.transfer || "")}</textarea></label>
    <label class="field">Où la voir<input data-bp-f="where" value="${esc(p.where || "")}" placeholder="Atelier, poste : venez voir sur place"></label>
    <section class="bp-status" data-bp-status>${bpStatusBox(p)}</section></div>`;
}
function bpSitesBody(p) {
  const impr = bpDeps(p.id).filter((d) => String(d.improvement || "").trim());
  const rows = OPERATIONAL_SITES.map((s) => {
    if (s.id === p.site_id) return `<li class="bp-site"><i class="bp-dot s-orig"></i><span class="jn-row-main"><b>${esc(s.name)}</b><span class="hint">Site d’origine${p.owner ? ` · ${esc(p.owner)}` : ""}</span></span></li>`;
    const d = bpDep(p.id, s.id);
    if (d) return `<li><button type="button" class="jn-row bp-site" data-bp-adopt="${esc(d.id)}"><i class="bp-dot s-${BP_TONE[d.status] || "cand"}"></i><span class="jn-row-main"><b>${esc(s.name)} · ${esc(BP_LABEL[d.status] || d.status)}</b><span class="hint">${esc([d.owner, ["Candidate", "Test"].includes(d.status) && d.due_date ? `jusqu’au ${shortDate(d.due_date)}` : "", d.status === "Non applicable" ? d.na_reason : d.result].filter(Boolean).join(" · "))}</span></span></button></li>`;
    return `<li class="bp-site"><i class="bp-dot s-none"></i><span class="jn-row-main"><b>${esc(s.name)}</b><span class="hint">Pas encore étudiée</span></span>${bpPub(p) && bpCanAdopt(s.id) ? `<button type="button" class="btn small" data-bp-interest="${esc(p.id)}|${esc(s.id)}">${state.site === s.id ? "Ça nous intéresse" : "Proposer à ce site"}</button>` : ""}</li>`;
  }).join("");
  return `${bpPub(p) ? "" : '<p class="hint">Les autres sites pourront la reprendre une fois la fiche publiée.</p>'}
    ${impr.length ? `<section class="bp-impr"><h4>Ce que les autres sites ont amélioré</h4><ul>${impr.map((d) => `<li><b>${esc(getSiteName(d.site_id))} :</b> ${esc(d.improvement)}</li>`).join("")}</ul><p class="hint">Copier, puis améliorer : à reprendre sur le site d’origine si c’est mieux.</p></section>` : ""}
    <ol class="bp-sitelist">${rows}</ol>${bpLegend()}${bpPub(p) && osIsAdmin() && !role().readonly ? '<div class="sm-tools"><button type="button" class="btn secondary" data-bp-replicate>Proposer à plusieurs sites</button></div>' : ""}`;
}
function bpOpen(id, tab = "fiche") {
  const p = bpGet(id);
  if (!p || !bpVisible(p)) return;
  const w = bpEditable(p), engaged = bpDeps(p.id).length, opl = olCan() && bpWriterSites().length;
  const tabs = [["fiche", "1. La fiche"], ["sites", `2. Sur les sites${engaged ? ` · ${engaged}` : ""}`]];
  modal("Bonne pratique", `<div class="sm-study bp-study" data-bp-id="${esc(p.id)}"><p class="jn-where">${esc(p.id)} · ${esc(getSiteName(p.site_id))} ${bpStatusPill(p)}</p>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-bp-tab="${k}">${l}</button>`).join("")}</div>
    <div class="sm-body">${tab === "sites" ? bpSitesBody(p) : w ? bpForm(p) : bpSheet(p)}</div>
    <div class="sm-tools"><button type="button" class="btn ghost" data-bp-print>Fiche à afficher</button>${opl ? '<button type="button" class="btn ghost" data-bp-opl>Faire l’OPL</button>' : ""}${w && (osIsAdmin() || !bpPub(p)) ? '<button type="button" class="btn ghost" data-bp-full>Formulaire complet</button>' : ""}</div></div>
    <input type="file" id="bpFile" accept="image/*" capture="environment" hidden>`);
  modalSaver = () => { uxFlush(); return true; };
  bpBind(id, tab);
}
function bpBind(id, tab) {
  const root = $("modalContent")?.querySelector(`.bp-study[data-bp-id="${id}"]`), p = bpGet(id);
  if (!root || !p) return;
  root.querySelectorAll("[data-bp-tab]").forEach((b) => (b.onclick = () => { uxFlush(); bpOpen(id, b.dataset.bpTab); }));
  root.querySelector("[data-bp-print]").onclick = () => { uxFlush(); bpPrint(id); };
  const opl = root.querySelector("[data-bp-opl]");
  if (opl) opl.onclick = () => { uxFlush(); const x = bpGet(id); olNew({ practice_id: id, kind: "amelioration", title: x.title, photo_a: x.before_photo || "", photo_b: x.after_photo || "", site_id: state.site !== "group" ? state.site : x.site_id }); };
  const full = root.querySelector("[data-bp-full]");
  if (full) full.onclick = () => { uxFlush(); bpPracticeFormBase(bpGet(id)); };
  bpBindGlobal(root);
  phFill(root);
  if (tab !== "fiche" || !bpEditable(p)) return;
  const box = root.querySelector(".sm-body");
  const bindStatus = () => {
    const st = box.querySelector("[data-bp-status]");
    if (!st) return;
    bpBindGlobal(st);
    const ask = st.querySelector("[data-bp-ask]"), pub = st.querySelector("[data-bp-publish]"), back = st.querySelector("[data-bp-back]");
    if (ask) ask.onclick = () => {
      uxFlush();
      const miss = bpMissing(bpGet(id));
      if (miss.length) return toast(`Il manque : ${miss.join(", ")}.`);
      if (bpSave(id, (y) => { y.status = "À valider"; recordHistory(y, "À valider", "Demande de validation"); })) { toast("Demande envoyée au responsable Lean."); bpOpen(id, "fiche"); }
    };
    if (pub) pub.onclick = () => {
      uxFlush();
      const by = $("bpValidator")?.value.trim(), miss = bpMissing(bpGet(id));
      if (miss.length) return toast(`Il manque : ${miss.join(", ")}.`);
      if (!by) { $("bpValidator")?.focus(); return toast("Qui valide la pratique ?"); }
      if (bpSave(id, (y) => { y.status = "Publiée"; y.validated_by = by; y.published_at = now(); recordHistory(y, "Publiée", by); })) { render(); toast("Publiée : tous les sites la voient dans le catalogue."); bpOpen(id, "sites"); }
    };
    if (back) back.onclick = () => { if (bpSave(id, (y) => { y.status = "À compléter"; recordHistory(y, "À compléter", "Renvoyée à compléter"); })) bpOpen(id, "fiche"); };
  };
  const refresh = () => {
    const x = bpGet(id), h = box.querySelector(".bp-headline");
    if (h) { const t = bpHeadline(x); h.textContent = t; h.hidden = !t; }
    const st = box.querySelector("[data-bp-status]");
    if (st) { const v = $("bpValidator")?.value; st.innerHTML = bpStatusBox(x); if (v && $("bpValidator")) $("bpValidator").value = v; bindStatus(); }
  };
  box.querySelectorAll("[data-bp-f]").forEach((el) => (el.onchange = () => {
    const k = el.dataset.bpF, v = el.value.trim();
    if (k === "title" && !v) { el.value = bpGet(id).title; return toast("La pratique a besoin d’un titre."); }
    if (bpSave(id, (x) => { x[k] = v; })) refresh();
  }));
  box.querySelectorAll("[data-bp-n]").forEach((el) => (el.onchange = () => {
    const v = bpParse(el.value);
    if (Number.isNaN(v)) return toast("Un nombre, par exemple 2,8.");
    if (bpSave(id, (x) => { x[el.dataset.bpN] = v; })) refresh();
  }));
  const chips = (attr, field) => box.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => {
    const v = b.getAttribute(attr);
    if (!bpSave(id, (x) => { x[field] = v; })) return;
    box.querySelectorAll(`[${attr}]`).forEach((c) => { c.classList.toggle("active", c === b); c.setAttribute("aria-pressed", String(c === b)); });
  }));
  chips("data-bp-catset", "category");
  chips("data-bp-effort", "effort");
  bpSlotsBind(box.querySelector(".bp-ba"), "bpFile", (k) => bpGet(id)[k], (k, v) => { const ok = bpSave(id, (x) => { x[k] = v; }); if (ok) refresh(); return ok; }, (k) => (k === "before_photo" ? "Avant" : "Après"));
  bindStatus();
}
function bpPrint(id) {
  const p = bpGet(id);
  if (!p) return;
  modal("Bonne pratique à afficher", `${bpSheet(p)}<style media="print">@page{size:A4;margin:10mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-bp-back-sheet>Retour à la fiche</button></div>`);
  phFill($("modalContent"));
  $("modalContent").querySelector("[data-print]").onclick = () => window.print();
  $("modalContent").querySelector("[data-bp-back-sheet]").onclick = () => bpOpen(id);
}

/* ---------- La reprise par un site ---------- */

function bpDepSave(id, fn, note = "") {
  const ok = commitData(() => {
    const old = data.deployments.find((x) => x.id === id), row = { ...old };
    fn(row, old);
    osCheckForm("deployments", row, old);
    const saved = osUpsert("deployments", row);
    if (note || saved.status !== old.status) recordHistory(saved, saved.status, note);
  });
  if (ok) modalDirty = false;
  return ok;
}
function bpCloseAction(aid, text, by) {
  const a = aid && data.actions.find((x) => x.id === aid);
  if (!a || !isOpenAction(a)) return;
  a.status = "Clôturée"; a.progress = 100; a.closed_at = now(); a.hold_reason = ""; a.effectiveness = text; a.verified_by = by; a.verified_at = today(); a.updated_at = now();
  recordHistory(a, a.status, text);
}
function bpInterest(pid, sid) {
  const p = bpGet(pid);
  if (!p || !bpPub(p) || p.site_id === sid || !bpCanAdopt(sid)) return;
  const old = bpDep(pid, sid);
  if (old) return bpAdopt(old.id);
  let made = null;
  if (!commitData(() => {
    const row = { practice_id: pid, site_id: sid, owner: apMe() || osActor(), due_date: auAddDays(30), status: "Candidate", prerequisites: p.transfer || "À adapter au site", title: `Reprise · ${p.title}`, result: "", evidence: "", validated_by: "", interest_at: now() };
    osCheckForm("deployments", row);
    made = osUpsert("deployments", row);
    recordHistory(made, "Candidate", "Ça nous intéresse");
  })) return;
  modalDirty = false;
  render();
  toast(`${getSiteName(sid)} étudie « ${p.title} ».`);
  bpAdopt(made.id);
}
function bpAdoptSummary(d, p) {
  const std = d.standard_id && data.documents.find((x) => x.id === d.standard_id);
  const rows = [["Pilote", d.owner], ["Échéance", ["Candidate", "Test"].includes(d.status) && d.due_date ? shortDate(d.due_date) : ""], ["Adapté chez nous", d.prerequisites], ["Résultat chez nous", [bpHeadline(p, d.local_before, d.local_after), d.result].filter(Boolean).join(" — ")], ["Preuve", d.evidence], ["Raison", d.na_reason], ["Amélioré au passage", d.improvement], ["Validé par", d.validated_by], ["Standard du site", std ? `${std.id} · ${std.title}` : ""]].filter(([, v]) => String(v || "").trim());
  return rows.length ? `<dl class="id-dl bp-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
}
function bpAdopt(depId) {
  const d = bpDepGet(depId), p = d && (data.practices || []).find((x) => x.id === d.practice_id);
  if (!d || !p) return;
  const w = bpCanAdopt(d.site_id), na = d.status === "Non applicable", idx = BP_STEPS.findIndex(([s]) => s === d.status), head = bpHeadline(p), origin = getSiteName(p.site_id);
  const fin = d.status === "Déployée", steps = `<ol class="bp-steps ${na ? "na" : ""}">${BP_STEPS.map(([, l], i) => `<li class="${na ? "" : i < idx || fin ? "done" : i === idx ? "now" : ""}"><span>${i + 1}</span>${esc(l)}</li>`).join("")}</ol>`;
  const act = d.action_id ? data.actions.find((a) => a.id === d.action_id) : null, me = apMe() || "";
  let body = "";
  if (w && d.status === "Candidate") body = `<p class="jn-lead">Allez voir sur place${p.where ? ` (${esc(p.where)}, ${esc(origin)})` : ` à ${esc(origin)}`}, appelez ${esc(p.owner || "le contact")}, puis décidez.</p>${p.transfer ? `<p class="bp-transfer"><b>Pour la refaire ailleurs :</b> ${esc(p.transfer)}</p>` : ""}
    <div class="bp-choice"><button type="button" class="btn jn-big" data-bp-pick="test">On l’essaie chez nous</button><button type="button" class="btn secondary" data-bp-pick="na">Pas pour nous</button></div>
    <form id="bpTestForm" class="jn-form bp-pane" hidden><label class="field">Pilote de l’essai<input id="bpPilot" list="ownerList" required value="${esc(d.owner || me)}">${ownerDatalist()}</label>
      <label class="field">Fin de l’essai<input type="date" id="bpDue" min="${today()}" required value="${esc(d.due_date && d.due_date >= today() ? d.due_date : auAddDays(30))}"></label>
      <label class="field">Ce qu’on adapte chez nous<textarea id="bpAdapt" rows="3">${esc(d.prerequisites || p.transfer || "")}</textarea></label>
      <label class="cs-act"><input type="checkbox" id="bpMkAct" checked> <span>Mettre l’essai dans le plan d’actions du pilote</span></label>
      <div class="form-actions"><button class="btn jn-big">Lancer l’essai</button></div></form>
    <form id="bpNaForm" class="jn-form bp-pane" hidden><div class="ap-field"><span class="metric-label">Pourquoi ?</span><div class="filters">${BP_NA.map((r) => `<button type="button" class="chip" data-bp-reason="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("")}</div></div>
      <label class="field">Un mot pour le site d’origine<input id="bpNaText" placeholder="Ex. nos lots sont trop courts pour ce réglage"></label>
      <div class="form-actions"><button class="btn jn-big">Enregistrer</button></div></form>`;
  else if (w && d.status === "Test") body = `<p class="jn-lead">Essai piloté par <b>${esc(d.owner || "—")}</b>${d.due_date ? `, jusqu’au ${shortDate(d.due_date)}` : ""}.${act ? ` Action ${esc(act.id)} : ${esc(act.status)}.` : ""}</p>${d.prerequisites ? `<p class="bp-transfer"><b>Adapté chez nous :</b> ${esc(d.prerequisites)}</p>` : ""}
    <form id="bpProofForm" class="jn-form"><div class="id-ba bp-ba"><figure>${(p.after_photo ? phImg(p.after_photo, "id-ba-img", "Chez " + origin) : "") || `<span class="id-ba-img id-nophoto">${esc(origin)}</span>`}<figcaption>Chez ${esc(origin)}</figcaption></figure>${bpSlot("local_photo", d.local_photo, "Chez nous")}</div><input type="file" id="bpLocalFile" accept="image/*" capture="environment" hidden>
      ${p.res_label || head ? `<fieldset class="bp-res-box"><legend>${esc(p.res_label || "Le résultat")} chez nous${p.res_unit ? ` (${esc(p.res_unit)})` : ""}</legend><div class="bp-res-grid two"><label>Avant<input id="bpLb" inputmode="decimal" value="${esc(bpNum(d.local_before))}"></label><label>Après<input id="bpLa" inputmode="decimal" value="${esc(bpNum(d.local_after))}"></label></div>${head ? `<p class="hint">À ${esc(origin)} : ${esc(head)}</p>` : ""}</fieldset>` : ""}
      <label class="field">Ce que ça a donné chez nous<textarea id="bpResult" rows="2" required>${esc(d.result || "")}</textarea></label>
      <label class="field">La preuve<input id="bpEvid" required value="${esc(d.evidence || "")}" placeholder="Relevés, période, lots"></label>
      <label class="field">Ce qu’on a amélioré au passage (facultatif)<input id="bpImprove" value="${esc(d.improvement || "")}" placeholder="Revient sur la fiche du site d’origine"></label>
      <label class="field">Validé par<input id="bpVal" list="ownerList" required value="${esc(d.validated_by || me)}">${ownerDatalist()}</label>
      <div class="form-actions"><button class="btn jn-big">Résultat prouvé</button><button type="button" class="btn ghost" data-bp-fail>Pas concluant</button></div></form>`;
  else if (w && d.status === "Validée sur autre site") {
    const stds = (data.documents || []).filter((x) => x.type === "STANDARD" && x.site_id === d.site_id && !x.archived_at && ["Publié", "Validé", "Applicable"].includes(x.status));
    const open = linkedActions(d.id).filter(isOpenAction);
    body = `${bpAdoptSummary(d, p)}<p class="jn-lead">Dernière marche : en faire la règle du site, puis former l’équipe.</p>${open.length ? `<p class="bp-miss">Actions encore ouvertes sur cette reprise : ${open.map((a) => esc(a.id)).join(", ")}. Clôturez-les avant de déclarer le déploiement.</p>` : ""}
      <form id="bpDeployForm" class="jn-form"><label class="field">Standard du site${stds.length ? "" : " (aucun standard publié pour l’instant)"}<select id="bpStd"><option value="">Pas de standard relié</option>${stds.map((x) => `<option value="${esc(x.id)}" ${x.id === d.standard_id ? "selected" : ""}>${esc(x.id)} · ${esc(x.title)}</option>`).join("")}</select></label>
        <label class="field">Ce qu’on a amélioré au passage (facultatif)<input id="bpImprove2" value="${esc(d.improvement || "")}"></label>
        <label class="field">Validé par<input id="bpVal2" list="ownerList" required value="${esc(d.validated_by || me)}">${ownerDatalist()}</label>
        <div class="form-actions"><button class="btn jn-big">Déployée sur le site</button></div></form>`;
  } else body = `${na ? `<p class="bp-miss">Pas pour nous${d.na_reason ? ` : ${esc(d.na_reason)}` : ""}.</p>` : ""}${bpAdoptSummary(d, p)}${w && na ? '<div class="sm-tools"><button type="button" class="btn secondary" data-bp-reopen>Reprendre l’étude</button></div>' : ""}${!w && !na && d.status !== "Déployée" ? '<p class="hint">Le site concerné fait avancer sa reprise.</p>' : ""}`;
  const opl = ["Validée sur autre site", "Déployée"].includes(d.status) && olCan() && osWritable(d.site_id) && !role().readonly;
  modal(`Reprise · ${getSiteName(d.site_id)}`, `<div class="bp-adopt" data-bp-dep="${esc(d.id)}">
    <div class="bp-mini">${p.after_photo ? phImg(p.after_photo, "id-thumb", "Après") : ""}<div><b>${esc(p.title)}</b><span class="hint">De ${esc(origin)}${head ? ` · ${esc(head)}` : ""}</span><button type="button" class="md-link" data-bp-open="${esc(p.id)}">Voir la fiche</button></div></div>
    ${steps}${body}
    <div class="sm-tools">${opl ? '<button type="button" class="btn ghost" data-bp-depopl>Faire l’OPL pour l’équipe</button>' : ""}${w ? '<button type="button" class="btn ghost small" data-bp-depfull>Formulaire complet</button>' : ""}</div></div>`);
  bpAdoptBind(d.id);
}
function bpAdoptBind(depId) {
  const root = $("modalContent")?.querySelector(`.bp-adopt[data-bp-dep="${depId}"]`), d = bpDepGet(depId), p = d && bpGet(d.practice_id);
  if (!root || !d || !p) return;
  bpBindGlobal(root);
  phFill(root);
  const full = root.querySelector("[data-bp-depfull]");
  if (full) full.onclick = () => bpOsFormBase("deployments", depId);
  const opl = root.querySelector("[data-bp-depopl]");
  if (opl) opl.onclick = () => olNew({ practice_id: p.id, kind: "amelioration", title: p.title, photo_a: p.before_photo || "", photo_b: d.local_photo || p.after_photo || "", site_id: d.site_id });
  root.querySelectorAll("[data-bp-pick]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.bpPick;
    root.querySelectorAll("[data-bp-pick]").forEach((x) => x.classList.toggle("on", x === b));
    $("bpTestForm").hidden = k !== "test";
    $("bpNaForm").hidden = k !== "na";
    (k === "test" ? $("bpPilot") : root.querySelector("[data-bp-reason]"))?.focus();
  }));
  let reason = "";
  root.querySelectorAll("[data-bp-reason]").forEach((b) => (b.onclick = () => { reason = b.dataset.bpReason; root.querySelectorAll("[data-bp-reason]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  const me = (v) => { if (v && typeof idSetMe === "function") idSetMe(v); };
  if ($("bpTestForm")) $("bpTestForm").onsubmit = (e) => {
    e.preventDefault();
    const owner = $("bpPilot").value.trim(), due = $("bpDue").value, adapt = $("bpAdapt").value.trim() || p.transfer || "À adapter au site", mk = $("bpMkAct").checked;
    if (!owner || !due) return toast("Le pilote et la date de fin de l’essai.");
    if (!bpDepSave(depId, (row) => {
      Object.assign(row, { owner, due_date: due, prerequisites: adapt, status: "Test", tested_at: now() });
      if (mk && !row.action_id) {
        const aid = auNext("A", data.actions);
        data.actions.unshift({ id: aid, site_id: row.site_id, title: `Essayer : ${p.title}`, description: `Bonne pratique ${p.id} venue de ${getSiteName(p.site_id)}.\nÀ adapter chez nous : ${adapt}\nPreuve attendue : ${p.evidence || "le résultat mesuré"}.`, owner, due_date: due, due_date_initial: due, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: SIGNAL_TYPES.includes(p.category) ? p.category : "Standard", origin_type: "Bonne pratique", origin_id: row.id, finding: p.title, created_at: now(), updated_at: now() });
        row.action_id = aid;
      }
    }, `Essai lancé · ${owner}`)) return;
    me(owner); render(); bpAdopt(depId); toast(`Essai lancé : ${owner}, jusqu’au ${shortDate(due)}.`);
  };
  if ($("bpNaForm")) $("bpNaForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("bpNaText").value.trim(), why = [reason, text].filter(Boolean).join(" · ");
    if (!why) return toast("Donnez la raison au site d’origine.");
    if (!bpDepSave(depId, (row) => { Object.assign(row, { status: "Non applicable", na_reason: why, result: row.result || why }); }, why)) return;
    render(); bpAdopt(depId); toast("Réponse enregistrée : le site d’origine la verra.");
  };
  const proof = $("bpProofForm");
  if (proof) {
    bpSlotsBind(proof.querySelector(".bp-ba"), "bpLocalFile", (k) => bpDepGet(depId)?.[k], (k, v) => bpDepSave(depId, (row) => { row[k] = v; }), () => "Chez nous");
    proof.onsubmit = (e) => {
      e.preventDefault();
      const result = $("bpResult").value.trim(), evid = $("bpEvid").value.trim(), by = $("bpVal").value.trim(), lb = $("bpLb") ? bpParse($("bpLb").value) : null, la = $("bpLa") ? bpParse($("bpLa").value) : null;
      if (Number.isNaN(lb) || Number.isNaN(la)) return toast("Résultat : des nombres, par exemple 2,1.");
      if (!result || !evid || !by) return toast("Le résultat, la preuve et qui valide.");
      if (!bpDepSave(depId, (row) => { Object.assign(row, { result, evidence: evid, validated_by: by, local_before: lb, local_after: la, improvement: $("bpImprove").value.trim(), status: "Validée sur autre site", proven_at: now() }); bpCloseAction(row.action_id, `Résultat prouvé : ${result}`, by); }, `Résultat prouvé · ${by}`)) return;
      me(by); render(); bpAdopt(depId); toast("Résultat prouvé chez vous.");
    };
    root.querySelector("[data-bp-fail]").onclick = () => {
      const text = $("bpResult").value.trim(), by = $("bpVal").value.trim() || apMe() || osActor(), why = ["Essai non concluant", text].filter(Boolean).join(" · ");
      if (!root.querySelector("[data-bp-fail]").dataset.confirm) { root.querySelector("[data-bp-fail]").dataset.confirm = "1"; return toast("Touchez encore une fois : l’essai sera clos comme non concluant."); }
      if (!bpDepSave(depId, (row) => { Object.assign(row, { status: "Non applicable", na_reason: why, result: text || why, improvement: $("bpImprove").value.trim() }); bpCloseAction(row.action_id, why, by); }, why)) return;
      render(); bpAdopt(depId); toast("Essai clos : le site d’origine verra pourquoi.");
    };
  }
  if ($("bpDeployForm")) $("bpDeployForm").onsubmit = (e) => {
    e.preventDefault();
    const by = $("bpVal2").value.trim();
    if (!by) return toast("Qui valide le déploiement ?");
    if (!bpDepSave(depId, (row) => { Object.assign(row, { standard_id: $("bpStd").value || null, improvement: $("bpImprove2").value.trim(), validated_by: by, status: "Déployée", deployed_at: now() }); }, `Déployée · ${by}`)) return;
    me(by); render(); bpAdopt(depId); toast("Déployée : la pratique est la règle du site.");
  };
  const reopen = root.querySelector("[data-bp-reopen]");
  if (reopen) reopen.onclick = () => { if (bpDepSave(depId, (row) => { Object.assign(row, { status: "Candidate", na_reason: "", due_date: row.due_date && row.due_date >= today() ? row.due_date : auAddDays(30) }); }, "Étude reprise")) { render(); bpAdopt(depId); } };
}

/* ---------- Déploiement : pratiques × sites ---------- */

function bpBoard() {
  const pub = (data.practices || []).filter((p) => !p.archived_at && bpPub(p)), sites = OPERATIONAL_SITES;
  const head = pageHead("Pérenniser", "Déploiement entre sites", "Qui a repris quelle pratique : chaque site choisit, essaie, prouve et déploie. Le tableau montre qui avance et qui attend.", "");
  if (!pub.length) return `${head}<section class="cs-empty"><h2>Aucune pratique publiée</h2><p>Une pratique prouvée sur un site et publiée avec sa fiche apparaît ici, face à chaque site.</p>${bpCan() ? '<button type="button" class="btn" data-bp-gocat>Voir les bonnes pratiques</button>' : ""}</section>`;
  const deps = (data.deployments || []).filter((d) => !d.archived_at && pub.some((p) => p.id === d.practice_id)), n = (s) => deps.filter((d) => d.status === s).length;
  const lead = deps.filter((d) => d.status === "Déployée").map((d) => { const p = pub.find((x) => x.id === d.practice_id), a = Date.parse(p.published_at || p.created_at || ""), b = Date.parse(d.deployed_at || d.updated_at || ""); return a && b && b >= a ? (b - a) / 864e5 : null; }).filter((x) => x !== null);
  const strip = `<div class="cs-summary"><div><b>${pub.length}</b><span>pratique${pub.length > 1 ? "s" : ""} publiée${pub.length > 1 ? "s" : ""}</span></div><div><b>${n("Candidate") + n("Test")}</b><span>à l’étude ou en essai</span></div><div><b>${n("Validée sur autre site") + n("Déployée")}</b><span>prouvée${n("Validée sur autre site") + n("Déployée") > 1 ? "s" : ""} ou déployée${n("Validée sur autre site") + n("Déployée") > 1 ? "s" : ""}</span></div><div><b>${lead.length ? `${Math.round(lead.reduce((s, x) => s + x, 0) / lead.length)} j` : "—"}</b><span>de la publication au déploiement</span></div></div>`;
  const cell = (p, s) => {
    if (s.id === p.site_id) return '<td><span class="bp-cell"><i class="bp-dot s-orig"></i><small>Origine</small></span></td>';
    const d = bpDep(p.id, s.id);
    if (d) { const late = ["Candidate", "Test"].includes(d.status) && d.due_date && d.due_date < today(); return `<td><button type="button" class="bp-cell ${late ? "late" : ""}" data-bp-adopt="${esc(d.id)}" aria-label="${esc(`${s.name} · ${p.title} : ${BP_LABEL[d.status] || d.status}${late ? ", en retard" : ""}`)}"><i class="bp-dot s-${BP_TONE[d.status] || "cand"}"></i><small>${esc(BP_LABEL[d.status] || d.status)}</small></button></td>`; }
    return `<td>${bpCanAdopt(s.id) ? `<button type="button" class="bp-cell" data-bp-interest="${esc(p.id)}|${esc(s.id)}" aria-label="${esc(`${s.name} · étudier ${p.title}`)}"><i class="bp-dot s-none"></i><small>Étudier</small></button>` : '<span class="bp-cell"><i class="bp-dot s-none"></i></span>'}</td>`;
  };
  const foot = sites.map((s) => { const k = deps.filter((d) => d.site_id === s.id && ["Validée sur autre site", "Déployée"].includes(d.status)).length, open = deps.filter((d) => d.site_id === s.id && ["Candidate", "Test"].includes(d.status)).length, avail = pub.filter((p) => p.site_id !== s.id).length; return `<td><b>${k}/${avail}</b>${open ? `<small>${open} en cours</small>` : ""}</td>`; }).join("");
  return `${head}${strip}<div class="pv-wrap"><table class="pv-matrix bp-matrix"><thead><tr><th scope="col" class="pv-corner">Pratique</th>${sites.map((s) => `<th scope="col" class="pv-st"><span>${esc(s.name)}</span></th>`).join("")}</tr></thead>
    <tbody>${pub.map((p) => `<tr><th scope="row" class="pv-name"><button type="button" class="bp-rowlink" data-bp-open="${esc(p.id)}">${esc(p.title)}</button><small>${esc(getSiteName(p.site_id))}${bpHeadline(p) ? ` · ${esc(bpHeadline(p))}` : ""}</small></th>${sites.map((s) => cell(p, s)).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr class="pv-foot"><th scope="row">Reprises prouvées</th>${foot}</tr></tfoot></table></div>${bpLegend()}`;
}

/* ---------- Leçons ponctuelles (OPL) ---------- */

const OL_KINDS = {
  base: { label: "Savoir de base", a: ["Bon", "ok"], b: ["Pas bon", "nok"] },
  securite: { label: "Sécurité", a: ["À faire", "ok"], b: ["Danger", "nok"] },
  amelioration: { label: "Amélioration", a: ["Avant", "was"], b: ["Après", "ok"] },
  probleme: { label: "Cas problème", a: ["Le défaut", "nok"], b: ["La parade", "ok"] },
};
function olCan() { return role().nav.includes("training"); }
function olAll() { return (data.opls || []).filter((o) => !o.archived_at); }
function olRows() { return olAll().filter((o) => allowedSite(o.site_id) && (state.site === "group" || o.site_id === state.site)); }
function olGet(id) { return olAll().find((o) => o.id === id); }
function olWritable(o) { return !role().readonly && osWritable(o.site_id) && allowedSite(o.site_id, true); }
function olMgr(o) { return olWritable(o) && osManager(); }
function olKind(o) { return OL_KINDS[o?.kind] || OL_KINDS.base; }
function olCurrent(o) { const v = o.version || 1; return (o.trained || []).filter((t) => (t.version || 1) === v); }
function olTeam(o) {
  const names = new Set();
  (data.people || []).filter((p) => p.site_id === o.site_id && p.name && p.status !== "Inactif").forEach((p) => names.add(p.name));
  (data.skillsMatrix || []).filter((t) => !t.archived_at && t.site_id === o.site_id).forEach((t) => (t.people || []).forEach((p) => p.name && names.add(p.name)));
  (o.trained || []).forEach((t) => t.name && names.add(t.name));
  return [...names].sort((a, b) => a.localeCompare(b, "fr"));
}
function olSave(id, fn) { const ok = commitData(() => { const o = data.opls.find((x) => x.id === id); fn(o); o.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function olMissing(o) { const m = []; if (!String(o.title || "").trim()) m.push("le point"); if (!o.photo_a && !o.photo_b) m.push("au moins une photo"); if (!(o.points || []).some((x) => String(x || "").trim())) m.push("un point clé"); return m; }
function olLabel(o, k) { const v = olKind(o)[k === "photo_a" ? "a" : "b"]; return v[0]; }
function olTone(o, k) { const v = olKind(o)[k === "photo_a" ? "a" : "b"]; return `t-${v[1]}`; }
function olHow() {
  return `<details class="cs-how section"><summary>La leçon ponctuelle (OPL)</summary><ol class="cs-how-list"><li><b>Un seul point</b><span>Un geste, un réglage, un défaut qui revient, un danger : une leçon par point.</span></li><li><b>Surtout des images</b><span>Deux photos qui montrent la différence, trois points clés au plus, le pourquoi en une ligne.</span></li><li><b>Écrite par celui qui sait</b><span>Opérateur, régleur, chef d’équipe ; validée par le responsable avant d’être présentée.</span></li><li><b>Cinq à dix minutes au poste</b><span>Montrer sur la vraie pièce, expliquer le pourquoi, faire faire, vérifier.</span></li><li><b>Noter qui est formé</b><span>La date, le formateur et la version ; la feuille signée reste au poste.</span></li></ol></details>`;
}
function olCard(o) {
  const k = olKind(o), team = olTeam(o).length, done = olCurrent(o).length, pct = team ? Math.round((done / team) * 100) : 0, ph = o.photo_b || o.photo_a;
  return `<button type="button" class="ol-card" data-ol-open="${esc(o.id)}">${(ph ? phImg(ph, "ol-thumb", o.title) : "") || '<span class="ol-thumb ol-nothumb">OPL</span>'}<span class="ol-main"><span class="id-top"><span class="ol-kind k-${esc(o.kind || "base")}">${esc(k.label)}</span>${o.status === "validee" ? "" : '<span class="bp-st draft">À valider</span>'}<span class="hint">${esc(o.id)} · v${o.version || 1}</span></span><b>${esc(o.title)}</b><span class="hint">${esc([o.station, getSiteName(o.site_id), o.author].filter(Boolean).join(" · "))}</span>${o.status === "validee" ? `<span class="ol-bar"><i style="width:${pct}%"></i></span><span class="hint ${done ? "" : "ol-todo"}">${done ? `${done} formé${done > 1 ? "s" : ""}${team ? ` sur ${team}` : ""}` : "À présenter à l’équipe"}</span>` : ""}</span></button>`;
}
function olPage() {
  const rows = olRows(), kind = state.olKind || "", canNew = bpWriterSites().length > 0;
  const head = pageHead("Pérenniser", "Leçons ponctuelles (OPL)", "Un point, une page, cinq minutes au poste : montrer, expliquer pourquoi, faire faire, vérifier.", canNew && rows.length ? '<button type="button" class="btn" data-ol-new>Nouvelle OPL</button>' : "");
  if (!rows.length) return `${head}<section class="cs-empty"><h2>La première leçon ponctuelle</h2><p>Un geste qui fait la différence, un défaut qui revient, un point de sécurité : deux photos, trois points clés au plus et le pourquoi. On la présente au poste en cinq minutes et on note qui est formé.</p>${canNew ? '<button type="button" class="btn" data-ol-new>Créer une OPL</button>' : ""}</section>${olHow()}`;
  const valid = rows.filter((o) => o.status === "validee"), month = today().slice(0, 7), todo = valid.filter((o) => !olCurrent(o).length).length;
  const trained = rows.reduce((n, o) => n + (o.trained || []).filter((t) => String(t.date || "").startsWith(month)).length, 0);
  const strip = `<div class="cs-summary"><div><b>${valid.length}</b><span>en vigueur</span></div><div><b>${rows.length - valid.length}</b><span>à valider</span></div><div class="${todo ? "bad" : ""}"><b>${todo}</b><span>à présenter à l’équipe</span></div><div><b>${trained}</b><span>formation${trained > 1 ? "s" : ""} ce mois</span></div></div>`;
  const kinds = Object.entries(OL_KINDS).filter(([k]) => rows.some((o) => (o.kind || "base") === k));
  const filters = kinds.length > 1 ? `<div class="filters bp-cats"><button type="button" class="chip ${kind ? "" : "active"}" data-ol-kindf="">Toutes</button>${kinds.map(([k, v]) => `<button type="button" class="chip ${k === kind ? "active" : ""}" data-ol-kindf="${k}">${esc(v.label)}</button>`).join("")}</div>` : "";
  const list = rows.filter((o) => !kind || (o.kind || "base") === kind).sort((a, b) => ((a.status === "validee") - (b.status === "validee")) || String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return `${head}${strip}${filters}<div class="ol-list">${list.map(olCard).join("")}</div>${olHow()}`;
}
function olNew(preset = {}) {
  const sites = bpWriterSites();
  if (!sites.length) return toast("Votre profil ne permet pas de créer une OPL ici.");
  let siteId = preset.site_id && sites.some((s) => s.id === preset.site_id) ? preset.site_id : state.site !== "group" && sites.some((s) => s.id === state.site) ? state.site : sites[0].id, kind = OL_KINDS[preset.kind] ? preset.kind : "base";
  modal("Nouvelle OPL", `<form id="olNewForm" class="jn-form"><p class="jn-lead">Un seul point par leçon : ce qu’il faut savoir ou faire à ce poste.</p>
    <div class="ap-field"><span class="metric-label">Type de leçon</span><div class="filters">${Object.entries(OL_KINDS).map(([k, v]) => `<button type="button" class="chip ${k === kind ? "active" : ""}" data-ol-k="${k}" aria-pressed="${k === kind}">${esc(v.label)}</button>`).join("")}</div></div>
    <label class="field">Le point, en une phrase<input id="olTitle" required maxlength="90" value="${esc(preset.title || "")}" placeholder="Ex. Serrer le gabarit avant de percer" autocomplete="off"></label>
    <label class="field">Poste ou machine<input id="olStation" value="${esc(preset.station || "")}" placeholder="Ex. Perceuse P3" autocomplete="off"></label>
    ${sites.length > 1 ? `<label class="field">Site<select id="olSite">${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
    <label class="field">Rédigée par<input id="olAuthor" list="ownerList" required value="${esc(preset.author || apMe() || "")}" autocomplete="name">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Créer l’OPL</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("olNewForm");
  root.querySelectorAll("[data-ol-k]").forEach((b) => (b.onclick = () => { kind = b.dataset.olK; root.querySelectorAll("[data-ol-k]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); }); }));
  if ($("olSite")) $("olSite").onchange = () => { siteId = $("olSite").value; };
  setTimeout(() => $("olTitle")?.focus(), 0);
  root.onsubmit = (e) => {
    e.preventDefault();
    const title = $("olTitle").value.trim(), author = $("olAuthor").value.trim();
    if (!title) { $("olTitle").focus(); return toast("Le point, en une phrase."); }
    if (!author) { $("olAuthor").focus(); return toast("Qui rédige la leçon ?"); }
    let oid = null;
    if (!commitData(() => {
      data.opls ||= [];
      oid = auNext("OPL", data.opls);
      data.opls.unshift({ id: oid, site_id: siteId, workshop_id: state.workshop && siteId === state.site ? state.workshop : null, kind, title, station: $("olStation").value.trim(), author, version: 1, status: "brouillon", photo_a: preset.photo_a || "", photo_b: preset.photo_b || "", points: [], why: "", minutes: 5, practice_id: preset.practice_id || null, validated_by: "", validated_at: null, trained: [], created_at: now(), updated_at: now() });
    })) return;
    if (typeof idSetMe === "function") idSetMe(author);
    modalDirty = false;
    render();
    olOpen(oid, "lecon");
    toast(`${oid} créée : ajoutez les photos et les points clés.`);
  };
}
function olSheet(o, print = false) {
  const k = olKind(o), pts = (o.points || []).filter((x) => String(x || "").trim()), tr = olCurrent(o);
  const ph = (v, [l, t]) => `<figure class="ol-ph t-${t}">${(v ? phImg(v, "ol-img", l) : "") || `<span class="ol-img id-nophoto">${esc(l)}</span>`}<figcaption>${t === "ok" ? "✓ " : t === "nok" ? "✗ " : ""}${esc(l)}</figcaption></figure>`;
  const blanks = print ? Math.max(0, Math.max(8, tr.length + 3) - tr.length) : 0;
  return `<article class="ol-sheet k-${esc(o.kind || "base")}"><header><div class="ol-band"><b>LEÇON PONCTUELLE</b><span>${esc(k.label)}</span></div><div class="ol-meta"><span>N° ${esc(o.id)}</span><span>Version ${o.version || 1}</span><span>${shortDate(o.validated_at || o.updated_at || o.created_at)}</span></div></header>
    <h3>${esc(o.title)}</h3>${o.station || o.site_id ? `<p class="ol-where">${esc([getSiteName(o.site_id), o.station].filter(Boolean).join(" · "))}</p>` : ""}
    <div class="ol-photos">${ph(o.photo_a, k.a)}${ph(o.photo_b, k.b)}</div>
    ${pts.length ? `<ol class="ol-points">${pts.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${o.why ? `<p class="ol-why"><b>Pourquoi :</b> ${esc(o.why)}</p>` : ""}
    <p class="ol-foot">Rédigée par ${esc(o.author || "—")}${o.validated_by ? ` · validée par ${esc(o.validated_by)}` : " · à valider"} · ${o.minutes || 5} min au poste</p>
    ${print ? `<table class="ol-sign"><thead><tr><th>Nom</th><th>Date</th><th>Formé par</th><th>Signature</th></tr></thead><tbody>${tr.map((t) => `<tr><td>${esc(t.name)}</td><td>${shortDate(t.date)}</td><td>${esc(t.by || "")}</td><td></td></tr>`).join("")}${"<tr><td></td><td></td><td></td><td></td></tr>".repeat(blanks)}</tbody></table>` : ""}</article>`;
}
function olStatusBox(o) {
  const miss = olMissing(o), todo = miss.length ? `<p class="bp-miss">Pour la valider, il manque : ${esc(miss.join(", "))}.</p>` : "";
  if (olMgr(o)) return `${todo}<div class="bp-pub"><label class="field">Validée par<input id="olValidator" list="ownerList" value="${esc(apMe() || osActor())}"></label><button type="button" class="btn" data-ol-validate ${miss.length ? "disabled" : ""}>Valider : l’OPL entre en vigueur</button></div>`;
  return `${todo}<p class="hint">Le chef d’équipe ou le responsable la valide ; elle se présente ensuite au poste.</p>`;
}
function olLessonBody(o) {
  if (!olWritable(o) || o.status === "validee") return `${olSheet(o)}${olWritable(o) && o.status === "validee" ? `<div class="sm-tools"><button type="button" class="btn secondary" data-ol-revise>Modifier : nouvelle version</button></div><p class="hint">Les personnes formées à la version ${o.version || 1} seront à reformer sur la nouvelle.</p>` : ""}`;
  const pts = [0, 1, 2].map((i) => `<label class="ol-pt"><span aria-hidden="true">${i + 1}</span><input data-ol-pt="${i}" maxlength="90" value="${esc((o.points || [])[i] || "")}" placeholder="${i ? "Autre point clé (facultatif)" : "Le point clé, en quelques mots"}" aria-label="Point clé ${i + 1}"></label>`).join("");
  return `<div class="ol-form">
    <div class="ap-field"><span class="metric-label">Type de leçon</span><div class="filters">${Object.entries(OL_KINDS).map(([k, v]) => `<button type="button" class="chip ${k === (o.kind || "base") ? "active" : ""}" data-ol-kind="${k}" aria-pressed="${k === (o.kind || "base")}">${esc(v.label)}</button>`).join("")}</div></div>
    <label class="field">Le point, en une phrase<input data-ol-f="title" maxlength="90" value="${esc(o.title || "")}"></label>
    <div class="id-ba ol-ba">${bpSlot("photo_a", o.photo_a, olLabel(o, "photo_a"), olTone(o, "photo_a"))}${bpSlot("photo_b", o.photo_b, olLabel(o, "photo_b"), olTone(o, "photo_b"))}</div>
    <div class="ap-field"><span class="metric-label">Les points clés · trois au plus</span><div class="ol-pts">${pts}</div></div>
    <label class="field">Pourquoi c’est important<input data-ol-f="why" maxlength="140" value="${esc(o.why || "")}" placeholder="Ex. gabarit mal serré, trou décalé : pièce rebutée"></label>
    <div class="bp-two"><label class="field">Poste ou machine<input data-ol-f="station" value="${esc(o.station || "")}"></label><label class="field">Rédigée par<input data-ol-f="author" list="ownerList" value="${esc(o.author || "")}">${ownerDatalist()}</label></div>
    <div class="ap-field"><span class="metric-label">Durée au poste</span><div class="filters">${[5, 10, 15].map((m) => `<button type="button" class="chip ${m === (o.minutes || 5) ? "active" : ""}" data-ol-min="${m}" aria-pressed="${m === (o.minutes || 5)}">${m} min</button>`).join("")}</div></div>
    <section class="bp-status" data-ol-status>${olStatusBox(o)}</section></div>`;
}
function olTrainBody(o) {
  if (o.status !== "validee") return '<p class="hint">Faites valider l’OPL avant de la présenter : on forme sur la version en vigueur.</p>';
  const team = olTeam(o), cur = olCurrent(o), w = olWritable(o), v = o.version || 1;
  const row = (name) => { const t = cur.find((x) => x.name === name), old = !t && (o.trained || []).find((x) => x.name === name); return `<li><button type="button" class="ol-person ${t ? "on" : old ? "old" : ""}" data-ol-person="${esc(name)}" aria-pressed="${!!t}" ${w ? "" : "disabled"}><span class="ol-check" aria-hidden="true"></span><span class="jn-row-main"><b>${esc(name)}</b><span class="hint">${t ? `Formé le ${shortDate(t.date)}${t.by ? ` par ${esc(t.by)}` : ""}` : old ? `Formé à la version ${old.version || 1} : à reformer` : "À former"}</span></span></button></li>`; };
  return `<ol class="ol-how"><li><b>Montrer</b> au poste, sur la vraie pièce</li><li><b>Expliquer</b> le pourquoi</li><li><b>Faire faire</b> par la personne</li><li><b>Vérifier</b>, puis la noter formée</li></ol>
    <p class="ol-count"><b>${cur.length}</b> formé${cur.length > 1 ? "s" : ""}${team.length ? ` sur ${team.length}` : ""} à la version ${v}</p>
    ${w ? `<label class="field ol-by">Formé par<input id="olBy" list="ownerList" value="${esc(apMe() || "")}">${ownerDatalist()}</label>` : ""}
    ${team.length ? `<ul class="ol-people">${team.map(row).join("")}</ul>` : '<p class="hint">Aucune personne connue sur ce site : ajoutez les personnes au fur et à mesure.</p>'}
    ${w ? '<form class="ol-add" data-ol-add><input id="olAddName" list="ownerList" placeholder="Ajouter une personne formée" autocomplete="off" aria-label="Personne formée"><button class="btn secondary">Ajouter</button></form>' : ""}`;
}
function olOpen(id, tab = "lecon") {
  const o = olGet(id);
  if (!o || !allowedSite(o.site_id)) return;
  const team = olTeam(o).length, done = olCurrent(o).length;
  const tabs = [["lecon", "1. La leçon"], ["former", `2. Former l’équipe · ${done}${team ? `/${team}` : ""}`]];
  modal("Leçon ponctuelle (OPL)", `<div class="sm-study ol-study" data-ol-id="${esc(o.id)}"><p class="jn-where">${esc(o.id)} · v${o.version || 1} · ${esc(getSiteName(o.site_id))}${o.station ? ` · ${esc(o.station)}` : ""} ${o.status === "validee" ? '<span class="bp-st pub">En vigueur</span>' : '<span class="bp-st draft">À valider</span>'}</p>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-ol-tab="${k}">${l}</button>`).join("")}</div>
    <div class="sm-body">${tab === "former" ? olTrainBody(o) : olLessonBody(o)}</div>
    <div class="sm-tools"><button type="button" class="btn ghost" data-ol-print>OPL à afficher</button></div></div><input type="file" id="olFile" accept="image/*" capture="environment" hidden>`);
  modalSaver = () => { uxFlush(); return true; };
  olBind(id, tab);
}
function olRedraw(id, tab) {
  const root = $("modalContent")?.querySelector(`.ol-study[data-ol-id="${id}"]`), box = root?.querySelector(".sm-body"), o = olGet(id);
  if (!box || !o) return;
  const sc = box.closest(".modal"), top = sc?.scrollTop;
  box.innerHTML = tab === "former" ? olTrainBody(o) : olLessonBody(o);
  const t = root.querySelector('[data-ol-tab="former"]'), team = olTeam(o).length;
  if (t) t.textContent = `2. Former l’équipe · ${olCurrent(o).length}${team ? `/${team}` : ""}`;
  olBind(id, tab);
  if (sc && top !== undefined) sc.scrollTop = top;
}
function olBind(id, tab) {
  const root = $("modalContent")?.querySelector(`.ol-study[data-ol-id="${id}"]`), o = olGet(id);
  if (!root || !o) return;
  const box = root.querySelector(".sm-body");
  root.querySelectorAll("[data-ol-tab]").forEach((b) => (b.onclick = () => { uxFlush(); olOpen(id, b.dataset.olTab); }));
  root.querySelector("[data-ol-print]").onclick = () => { uxFlush(); olPrint(id); };
  phFill(root);
  const revise = box.querySelector("[data-ol-revise]");
  if (revise) revise.onclick = () => {
    if (!revise.dataset.confirm) { revise.dataset.confirm = "1"; return toast("Touchez encore une fois : la version suivante repassera en validation."); }
    if (olSave(id, (x) => { x.version = (x.version || 1) + 1; x.status = "brouillon"; x.validated_by = ""; x.validated_at = null; })) olOpen(id, "lecon");
  };
  if (!olWritable(o)) return;
  if (tab === "lecon" && o.status !== "validee") {
    const bindStatus = () => {
      const b = box.querySelector("[data-ol-validate]");
      if (b) b.onclick = () => {
        uxFlush();
        const by = $("olValidator")?.value.trim(), miss = olMissing(olGet(id));
        if (miss.length) return toast(`Il manque : ${miss.join(", ")}.`);
        if (!by) { $("olValidator")?.focus(); return toast("Qui valide l’OPL ?"); }
        if (olSave(id, (y) => { y.status = "validee"; y.validated_by = by; y.validated_at = now(); })) { render(); toast("OPL en vigueur : présentez-la à l’équipe."); olOpen(id, "former"); }
      };
    };
    const refresh = () => { const st = box.querySelector("[data-ol-status]"); if (!st) return; const v = $("olValidator")?.value; st.innerHTML = olStatusBox(olGet(id)); if (v && $("olValidator")) $("olValidator").value = v; bindStatus(); };
    box.querySelectorAll("[data-ol-f]").forEach((el) => (el.onchange = () => {
      const k = el.dataset.olF, v = el.value.trim();
      if (k === "title" && !v) { el.value = olGet(id).title; return toast("La leçon a besoin de son point."); }
      if (olSave(id, (x) => { x[k] = v; })) refresh();
    }));
    box.querySelectorAll("[data-ol-pt]").forEach((el) => (el.onchange = () => {
      const i = Number(el.dataset.olPt);
      if (olSave(id, (x) => { const p = [0, 1, 2].map((j) => String((x.points || [])[j] || "")); p[i] = el.value.trim(); x.points = p; })) refresh();
    }));
    box.querySelectorAll("[data-ol-kind]").forEach((b) => (b.onclick = () => { uxFlush(); if (olSave(id, (x) => { x.kind = b.dataset.olKind; })) olRedraw(id, tab); }));
    box.querySelectorAll("[data-ol-min]").forEach((b) => (b.onclick = () => {
      if (!olSave(id, (x) => { x.minutes = Number(b.dataset.olMin); })) return;
      box.querySelectorAll("[data-ol-min]").forEach((c) => { c.classList.toggle("active", c === b); c.setAttribute("aria-pressed", String(c === b)); });
    }));
    bpSlotsBind(box.querySelector(".ol-ba"), "olFile", (k) => olGet(id)[k], (k, v) => { const ok = olSave(id, (x) => { x[k] = v; }); if (ok) refresh(); return ok; }, (k) => olLabel(olGet(id), k), (k) => olTone(olGet(id), k));
    bindStatus();
  }
  if (tab === "former" && o.status === "validee") {
    const by = () => $("olBy")?.value.trim() || apMe() || "";
    const mark = (name, remove = false) => {
      const v = olGet(id).version || 1;
      if (!olSave(id, (x) => { x.trained ||= []; x.trained = x.trained.filter((t) => !(t.name === name && (t.version || 1) === v)); if (!remove) x.trained.push({ name, date: today(), by: by(), version: v }); })) return;
      if (by() && typeof idSetMe === "function") idSetMe(by());
      olRedraw(id, "former");
    };
    box.querySelectorAll("[data-ol-person]").forEach((b) => (b.onclick = () => {
      const name = b.dataset.olPerson, on = b.getAttribute("aria-pressed") === "true";
      if (on && !b.dataset.confirm) { b.dataset.confirm = "1"; return toast("Touchez encore une fois pour retirer cette formation."); }
      mark(name, on);
    }));
    const add = box.querySelector("[data-ol-add]");
    if (add) add.onsubmit = (e) => {
      e.preventDefault();
      const name = $("olAddName").value.trim().replace(/\s+/g, " ");
      if (!name) return $("olAddName").focus();
      if (olCurrent(olGet(id)).some((t) => t.name === name)) return toast(`${name} est déjà formé à cette version.`);
      mark(name);
    };
  }
}
function olPrint(id) {
  const o = olGet(id);
  if (!o) return;
  modal("OPL à afficher", `${olSheet(o, true)}<style media="print">@page{size:A4;margin:10mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn ghost" data-ol-back>Retour à l’OPL</button></div>`);
  phFill($("modalContent"));
  $("modalContent").querySelector("[data-print]").onclick = () => window.print();
  $("modalContent").querySelector("[data-ol-back]").onclick = () => olOpen(id);
}

/* ---------- Branchements ---------- */

const bpPracticeFormBase = practiceForm;
practiceForm = function (existing = null, preset = {}) {
  if (existing?.id && bpGet(existing.id)) return bpOpen(existing.id);
  if (!existing) return bpNew(preset || {});
  return bpPracticeFormBase.apply(this, arguments);
};
const bpOsFormBase = osForm;
osForm = function (key, id = null) {
  if (key === "deployments" && id && bpDepGet(id)) return bpAdopt(id);
  return bpOsFormBase.apply(this, arguments);
};
const bpRenderPracticesBase = renderPractices;
renderPractices = function () { return bpCan() ? bpPage() : bpRenderPracticesBase.apply(this, arguments); };
const bpRenderDeploymentBase = renderOSDeployment;
renderOSDeployment = function () { return bpCan() || role().nav.includes("deployment") ? bpBoard() : bpRenderDeploymentBase.apply(this, arguments); };
const olRenderTrainingBase = renderTraining;
renderTraining = function () { return state.oplOn && !state.pvOn && olCan() ? olPage() : olRenderTrainingBase.apply(this, arguments); };
state.oplOn ??= false;
const olSwitchBase = switchView;
switchView = function (view) { if (view !== "training") state.oplOn = false; return olSwitchBase.apply(this, arguments); };
const olTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = olTabsBase(stage);
  if (stage?.id !== "perenniser" || !olCan()) return out;
  const tr = out.find((t) => t.key === "training");
  if (tr) tr.set = { ...(tr.set || {}), oplOn: false };
  if (!out.some((t) => t.key === "opl")) {
    let i = out.findIndex((t) => t.key === "practices");
    if (i < 0) i = out.findIndex((t) => t.key === "documents");
    out.splice(i + 1, 0, { key: "opl", label: "OPL", view: "training", set: { oplOn: true, pvOn: false } });
  }
  return out;
};
const olCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  olCreateMenuBase.apply(this, arguments);
  if (!olCan() || !bpWriterSites().length) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const html = '<button class="create-choice ol-choice" type="button" data-ol-new><span aria-hidden="true"><b>OPL</b></span><b>Leçon ponctuelle (OPL)</b><small>Un point clé en photo, à présenter au poste</small></button>';
  const note = menu.querySelector(".cp-note-choice");
  if (note) note.insertAdjacentHTML("beforebegin", html); else menu.insertAdjacentHTML("beforeend", html);
  bpBindGlobal(menu);
};
const bpWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = bpWatchBase(), rows = [], site = state.site !== "group" ? state.site : null;
  if (osManager() && !role().readonly) {
    if (site && bpCan() && bpCanAdopt(site)) {
      const fresh = (data.practices || []).filter((p) => !p.archived_at && bpPub(p) && p.site_id !== site && !bpDep(p.id, site) && Date.now() - Date.parse(p.published_at || p.updated_at || 0) < 60 * 864e5);
      if (fresh.length) rows.push(`<button type="button" class="jn-row" data-bp-gocat><span class="jn-row-main"><span class="jn-tag tone-ok">Yokoten</span><b>${jnPlural(fresh.length, "bonne pratique d’un autre site", "bonnes pratiques d’autres sites")} à regarder</b><span class="hint">${esc(fresh[0].title)} · ${esc(getSiteName(fresh[0].site_id))}</span></span></button>`);
      const late = (data.deployments || []).filter((d) => !d.archived_at && d.site_id === site && d.status === "Test" && d.due_date && d.due_date < today());
      if (late.length) rows.push(`<button type="button" class="jn-row" data-bp-adopt="${esc(late[0].id)}"><span class="jn-row-main"><span class="jn-tag tone-warn">Essai</span><b>${jnPlural(late.length, "essai de bonne pratique", "essais de bonnes pratiques")} à conclure</b><span class="hint">Échéance dépassée : résultat prouvé ou pas concluant</span></span></button>`);
    }
    if (olCan()) {
      const todo = olRows().filter((o) => o.status === "validee" && !olCurrent(o).length && olWritable(o));
      if (todo.length) rows.push(`<button type="button" class="jn-row" data-ol-go><span class="jn-row-main"><span class="jn-tag tone-warn">OPL</span><b>${jnPlural(todo.length, "OPL à présenter", "OPL à présenter")} à l’équipe</b><span class="hint">${esc(todo[0].title)}</span></span></button>`);
    }
  }
  if (!rows.length) return base;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${rows.join("")}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${rows.join("")}$2`);
};
function bpBindGlobal(root = document) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = () => fn(b)));
  on("[data-bp-new]", () => bpNew());
  on("[data-bp-open]", (b) => bpOpen(b.dataset.bpOpen));
  on("[data-bp-adopt]", (b) => bpAdopt(b.dataset.bpAdopt));
  on("[data-bp-interest]", (b) => { const [pid, sid] = b.dataset.bpInterest.split("|"); bpInterest(pid, sid); });
  on("[data-bp-cat]", (b) => { state.bpCat = b.dataset.bpCat; render(); });
  on("[data-bp-replicate]", (b) => { const id = b.closest("[data-bp-id]")?.dataset.bpId; if (id) osReplicationForm(id); });
  on("[data-bp-gocat]", () => switchView("practices"));
  on("[data-ol-new]", () => olNew());
  on("[data-ol-open]", (b) => olOpen(b.dataset.olOpen));
  on("[data-ol-kindf]", (b) => { state.olKind = b.dataset.olKindf; render(); });
  on("[data-ol-go]", () => { state.oplOn = true; state.pvOn = false; switchView("training"); });
}
const bpOsBindBase = osBind;
osBind = function () { const out = bpOsBindBase.apply(this, arguments); bpBindGlobal(document); return out; };
