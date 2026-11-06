"use strict";
/*
 * BIA Lean OS 8.11 · Audit terrain 50 critères, refait pour le téléphone (même filtre que le 5S).
 *  - Un domaine par étape, six gros boutons 0 à 5 avec le niveau en clair, une preuve par critère
 *    (fait observé, document ou photo), un brouillon gardé à chaque geste.
 *  - Bilan : score /100, radar des 10 domaines contre l'audit précédent du même périmètre,
 *    chaque critère faible peut devenir une action datée du plan (plus d'actions par domaine sans date).
 *  - Rapport imprimable ; les audits personnalisés gagnent les mêmes boutons de note.
 * Données inchangées : audits[].audit_data.criteria [{domain, criterion, score, proof}] (+ photo, act, what, who, when),
 * domain_scores (moyenne sur 5), summary, auditor ; score = somme / 250 × 100.
 */

const AU_LEVELS = ["Absent", "Ponctuel", "Partiel", "Appliqué", "Maîtrisé", "Durable"];
const AU_LEVEL_HINT = ["rien de constaté", "existe ici ou là", "en place mais irrégulier", "appliqué partout", "maîtrisé et mesuré", "durable et amélioré"];
const AU_FAMILY = { "Sécurité": "Sécurité", "Qualité": "Qualité", "Maintenance": "Maintenance", "Flux et délais": "Flux", "5S et standards": "Standard", "Performance": "Production" };
let auRun = null;

function auDomains() { return Object.entries(AUDIT_CRITERIA); }
function auIsTerrain(a) { return !!a && !a.template_id && !a.five_s; }
function auNext(prefix, rows) {
  const re = new RegExp(`^${prefix}-(\\d{1,6})$`), max = rows.reduce((m, r) => { const k = re.exec(r.id || ""); return k ? Math.max(m, Number(k[1])) : m; }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
function auGet() { return auRun && data.audits.find((a) => a.id === auRun.id); }
function auCrit(a, d, c) { return (a?.audit_data?.criteria || []).find((x) => x.domain === d && x.criterion === c); }
function auScored(x) { return typeof x?.score === "number"; }
function auProved(x) { return !!(x?.proof?.trim() || x?.photo); }
function auDomainScore(a, d) {
  const l = (a?.audit_data?.criteria || []).filter((c) => c.domain === d && auScored(c));
  return l.length ? Math.round((l.reduce((s, c) => s + c.score, 0) / l.length) * 100) / 100 : null;
}
function auFilled(a, d) { return AUDIT_CRITERIA[d].every((c) => { const x = auCrit(a, d, c); return auScored(x) && auProved(x); }); }
function auCount(a) { return auDomains().reduce((n, [d, list]) => n + list.filter((c) => { const x = auCrit(a, d, c); return auScored(x) && auProved(x); }).length, 0); }
function auTone5(v) { return v === null || v === undefined ? "none" : v >= 3.5 ? "ok" : v >= 2.5 ? "warn" : "bad"; }
function auTone100(v) { return v === null || v === undefined ? "none" : v >= 70 ? "ok" : v >= 50 ? "warn" : "bad"; }
function auPrev(a) {
  const scope = String(a.scope || "").trim().toLowerCase();
  return data.audits.filter((x) => x.id !== a.id && auIsTerrain(x) && x.status === "Terminé" && x.site_id === a.site_id && String(x.scope || "").trim().toLowerCase() === scope && x.audit_data?.domain_scores && String(x.performed_at) <= String(a.performed_at))
    .sort((p, q) => String(q.performed_at).localeCompare(String(p.performed_at)))[0] || null;
}
function auAddDays(n) { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

/* ---------- Radar et barres des 10 domaines ---------- */

function auRadar(vals, prev = null) {
  const n = vals.length, cx = 150, cy = 140, r = 96;
  const pt = (i, v) => { const t = ((-90 + (i * 360) / n) * Math.PI) / 180, k = (r * Math.max(0, Math.min(5, v ?? 0))) / 5; return [cx + k * Math.cos(t), cy + k * Math.sin(t)]; };
  const poly = (vs) => vs.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const rings = [1, 2, 3, 4, 5].map((v) => `<polygon class="${v === 3 ? "cs-target" : "cs-ring"}" points="${poly(vals.map(() => v))}"/>`).join("");
  const axes = vals.map((_, i) => { const [x, y] = pt(i, 5); return `<line class="cs-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const labels = vals.map((v, i) => { const [x, y] = pt(i, 5.9); return `<text class="cs-lab" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${i + 1}</text>`; }).join("");
  const has = vals.some((v) => v !== null && v !== undefined);
  return `<svg class="cs-radar au-radar" viewBox="0 0 300 282" role="img" aria-label="Radar des 10 domaines : ${auDomains().map(([d], i) => `${d} ${vals[i] ?? "non noté"}`).join(", ")}">${rings}${axes}
    ${prev && prev.some((v) => v !== null && v !== undefined) ? `<polygon class="cs-prev" points="${poly(prev)}"/>` : ""}
    ${has ? `<polygon class="cs-now" points="${poly(vals)}"/>${vals.map((v, i) => (v === null || v === undefined ? "" : `<circle class="cs-dot" cx="${pt(i, v)[0].toFixed(1)}" cy="${pt(i, v)[1].toFixed(1)}" r="3.5"/>`)).join("")}` : ""}${labels}</svg>`;
}
function auBars(a, prev) {
  return `<ol class="au-bars">${auDomains().map(([d], i) => {
    const v = auDomainScore(a, d), p = prev ? (prev.audit_data?.domain_scores?.[d] ?? null) : null, delta = v !== null && p !== null ? Math.round((v - p) * 10) / 10 : null;
    return `<li class="tone-${auTone5(v)}"><b>${i + 1}</b><span class="au-bar-name">${esc(d)}</span><span class="au-bar"><i style="width:${v === null ? 0 : (v / 5) * 100}%"></i></span><span class="au-bar-v">${v === null ? "—" : v.toFixed(1).replace(".", ",")}${delta ? `<em class="${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : ""}${String(delta).replace(".", ",")}</em>` : ""}</span></li>`;
  }).join("")}</ol>`;
}

/* ---------- Démarrer ---------- */

function auStart(preset = {}) {
  if (role().readonly) return toast("Votre profil ne permet pas d’auditer.");
  const siteId = preset.site_id || (state.site === "group" ? OPERATIONAL_SITES.find((s) => allowedSite(s.id, true))?.id : state.site);
  modal("Audit terrain · 50 critères", `<form id="auStartForm" class="jn-form">
    <p class="jn-lead">Dix domaines, cinq critères chacun, noté de 0 à 5 avec une preuve. Comptez une heure au poste ; tout est gardé si vous vous arrêtez.</p>
    <label class="field">Site<select id="auSite">${siteOptions(siteId)}</select></label>
    <label class="field">Périmètre<input id="auScope" required value="${esc(preset.scope || "")}" placeholder="Atelier, zone ou processus audité"></label>
    <label class="field">Responsable du périmètre<input id="auOwner" list="ownerList" required value="${esc(preset.owner || "")}">${ownerDatalist()}</label>
    <label class="field">Auditeur<input id="auAuditor" list="ownerList" required value="${esc(apMe() || "")}"></label>
    <label class="field">Date<input id="auDate" type="date" max="${today()}" value="${today()}"></label>
    <div class="form-actions"><button class="btn jn-big">Commencer l’audit</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("auScope")?.focus(), 0);
  $("auStartForm").onsubmit = (e) => {
    e.preventDefault();
    const site = $("auSite").value, scope = $("auScope").value.trim(), owner = $("auOwner").value.trim(), auditor = $("auAuditor").value.trim(), date = $("auDate").value || today();
    if (!scope || !owner || !auditor) return toast("Précisez le périmètre, son responsable et l’auditeur.");
    if (!allowedSite(site, true)) return toast("Site hors de votre périmètre.");
    if (date > today()) return toast("La date ne peut pas être dans le futur.");
    const a = { id: auNext("AUD", data.audits), site_id: site, type: "Audit Terrain BIA", scope, owner, performed_at: date, status: "Brouillon", score: null, audit_data: { criteria: [], auditor, summary: "" }, current_domain: 0, created_at: now(), updated_at: now() };
    if (!commitData(() => data.audits.unshift(a))) return;
    modalDirty = false;
    render();
    auRun = { id: a.id, step: 0 };
    auRender();
  };
}

/* ---------- Un domaine par étape ---------- */

function auNavHtml(a, step) {
  return `<nav class="cs-steps au-steps" aria-label="Domaines de l’audit">${auDomains().map(([d], i) => {
    const filled = auFilled(a, d);
    return `<button type="button" class="cs-step ${i === step ? "on" : ""} ${filled ? "filled tone-" + auTone5(auDomainScore(a, d)) : ""}" data-au-step="${i}" aria-current="${i === step ? "step" : "false"}" title="${esc(d)}"><b>${i + 1}</b><span>${esc(d)}</span></button>`;
  }).join("")}<button type="button" class="cs-step ${step === 10 ? "on" : ""}" data-au-step="10" aria-current="${step === 10 ? "step" : "false"}"><b>✓</b><span>Bilan</span></button></nav>`;
}
function auQHtml(a, d, ci) {
  const c = AUDIT_CRITERIA[d][ci], x = auCrit(a, d, c) || {}, di = auDomains().findIndex(([n]) => n === d), s = auScored(x) ? x.score : null;
  return `<li class="cs-q au-q ${s === null ? "" : "lv" + s}" data-au-ci="${ci}"><p class="cs-q-text">${di + 1}.${ci + 1} · ${esc(c)}</p>
    <div class="au-seg" role="radiogroup" aria-label="${esc(c)}">${AU_LEVELS.map((l, v) => `<button type="button" class="au-v lv${v} ${s === v ? "on" : ""}" role="radio" aria-checked="${s === v}" data-au-v="${v}" title="${v} · ${l}"><b>${v}</b><span>${l}</span></button>`).join("")}</div>
    ${s !== null ? `<p class="au-lvl">${s} · ${AU_LEVELS[s]} : ${AU_LEVEL_HINT[s]}</p>` : ""}
    <textarea class="cs-note au-proof" rows="1" data-au-proof placeholder="Preuve : fait observé ou document consulté">${esc(x.proof || "")}</textarea>
    <div class="cs-gap-row">${x.photo ? `<span class="cs-gap-ph">${phImg(x.photo, "cs-gap-img", "")}<button type="button" class="cp-ph-btn" data-au-phdel aria-label="Retirer la photo">×</button></span>` : `<button type="button" class="btn secondary small" data-au-ph>Photo</button>`}</div></li>`;
}
function auSet(d, c, patch) {
  const id = auRun?.id, step = auRun?.step;
  const ok = commitData(() => {
    const a = data.audits.find((x) => x.id === id);
    a.audit_data ||= { criteria: [] };
    a.audit_data.criteria ||= [];
    let x = a.audit_data.criteria.find((k) => k.domain === d && k.criterion === c);
    if (!x) { x = { domain: d, criterion: c, score: null, proof: "" }; a.audit_data.criteria.push(x); }
    Object.assign(x, patch);
    if (step < 10) a.current_domain = step;
    a.updated_at = now();
  });
  if (ok) modalDirty = false;
  return ok;
}
function auRedrawQ(d, ci) {
  const a = auGet(), root = $("modalContent"), li = root?.querySelector(`[data-au-ci="${ci}"]`);
  if (!a || !li) return;
  const tmp = document.createElement("ol");
  tmp.innerHTML = auQHtml(a, d, ci);
  const fresh = tmp.firstElementChild;
  li.replaceWith(fresh);
  auBindQ(fresh, d);
  phFill(fresh);
  const nav = root.querySelector(".au-steps"), box = document.createElement("div");
  box.innerHTML = auNavHtml(a, auRun.step);
  nav?.replaceWith(box.firstElementChild);
  auBindNav(root);
  const prog = root.querySelector("[data-au-count]");
  if (prog) prog.textContent = `${auCount(a)} / 50 critères notés avec preuve`;
}
function auBindNav(root) {
  root.querySelectorAll("[data-au-step]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); auSyncBilan(); auRun.step = Number(b.dataset.auStep); auRender(); $("modalContent").closest(".modal")?.scrollTo?.(0, 0); }));
}
function auBindQ(li, d) {
  const ci = Number(li.dataset.auCi), c = AUDIT_CRITERIA[d][ci];
  li.querySelectorAll("[data-au-v]").forEach((b) => (b.onclick = () => {
    const v = Number(b.dataset.auV), cur = auCrit(auGet(), d, c);
    if (!auSet(d, c, { score: cur?.score === v ? null : v })) return;
    auRedrawQ(d, ci);
    const proof = $("modalContent").querySelector(`[data-au-ci="${ci}"] [data-au-proof]`);
    if (proof && !proof.value) proof.focus({ preventScroll: true });
  }));
  const proof = li.querySelector("[data-au-proof]");
  let t = null;
  const fit = () => { proof.style.height = "auto"; proof.style.height = `${proof.scrollHeight + 2}px`; };
  proof.oninput = () => { fit(); clearTimeout(t); t = setTimeout(() => auSet(d, c, { proof: proof.value.trim() }), 400); };
  proof.onblur = () => { clearTimeout(t); if (auSet(d, c, { proof: proof.value.trim() })) { const nav = $("modalContent").querySelector(".au-steps"), box = document.createElement("div"); box.innerHTML = auNavHtml(auGet(), auRun.step); nav?.replaceWith(box.firstElementChild); auBindNav($("modalContent")); const prog = $("modalContent").querySelector("[data-au-count]"); if (prog) prog.textContent = `${auCount(auGet())} / 50 critères notés avec preuve`; } };
  if (proof.value) setTimeout(fit, 0);
  li.querySelector("[data-au-ph]")?.addEventListener("click", () => { auRun.photoFor = [d, ci]; $("auFile").click(); });
  li.querySelector("[data-au-phdel]")?.addEventListener("click", () => { if (auSet(d, c, { photo: "" })) auRedrawQ(d, ci); });
}
function auRender() {
  const a = auGet();
  if (!a) { auRun = null; return; }
  const step = auRun.step, prev = auPrev(a);
  let body;
  if (step < 10) {
    const [d, list] = auDomains()[step];
    body = `<header class="cs-step-head"><span class="cs-num">${step + 1}</span><div><h3>${esc(d)}</h3><p data-au-count>${auCount(a)} / 50 critères notés avec preuve</p></div></header>
      <details class="cs-refbox au-scale"><summary>L’échelle de 0 à 5</summary><ol class="au-scale-list">${AU_LEVELS.map((l, v) => `<li><b>${v} · ${l}</b> ${AU_LEVEL_HINT[v]}</li>`).join("")}</ol><p class="hint">Une absence constatée est une preuve : notez ce que vous avez vu ou demandé.</p></details>
      <ol class="cs-crit">${list.map((_, ci) => auQHtml(a, d, ci)).join("")}</ol><input type="file" id="auFile" accept="image/*" capture="environment" hidden>`;
  } else {
    const vals = auDomains().map(([d]) => auDomainScore(a, d)), scored = (a.audit_data?.criteria || []).filter(auScored), total = scored.length ? Math.round((scored.reduce((s, c) => s + c.score, 0) / 250) * 100) : null;
    const missing = auDomains().filter(([d]) => !auFilled(a, d));
    const weak = auDomains().flatMap(([d, list]) => list.map((c) => ({ d, c, x: auCrit(a, d, c) })).filter((w) => auScored(w.x) && w.x.score < 3));
    body = `<div class="cs-bilan"><div class="cs-bilan-score tone-${auTone100(total)}"><span>${total ?? "—"}<small>${total !== null ? " /100" : ""}</small></span><em>${prev ? `audit précédent : ${prev.score}/100 le ${shortDate(prev.performed_at)}` : "premier audit de ce périmètre"}${total !== null && scored.length < 50 ? " · provisoire" : ""}</em></div>
        <div class="au-viz">${auRadar(vals, prev ? auDomains().map(([d]) => prev.audit_data.domain_scores[d] ?? null) : null)}${auBars(a, prev)}</div></div>
      <p class="cs-legend"><i class="now"></i>Cet audit <i class="prev"></i>Audit précédent <i class="target"></i>Niveau 3, appliqué</p>
      ${missing.length ? `<p class="cs-missing">${jnPlural(missing.length, "domaine incomplet", "domaines incomplets")} (note et preuve) : ${missing.map(([d]) => { const i = auDomains().findIndex(([n]) => n === d); return `<button type="button" class="jn-link" data-au-step="${i}">${i + 1}. ${esc(d)}</button>`; }).join(" ")}</p>` : ""}
      <section class="cs-gaps"><h3>Critères à travailler · ${weak.length}</h3>${weak.length ? `<p class="hint">Les notes sous 3 peuvent devenir une action datée du plan ; 0 et 1 sont cochés d’office.</p><ol class="cs-gap-list">${weak.map(({ d, c, x }) => {
        const key = `${d}|${c}`, act = x.act ?? x.score <= 1, sec = d === "Sécurité";
        return `<li data-au-gap="${esc(key)}"><label class="cs-act"><input type="checkbox" data-au-act ${act ? "checked" : ""}> <span><b>${esc(d)} · ${x.score}/5</b> ${esc(c)}${x.proof ? `<em>${esc(x.proof)}</em>` : ""}</span></label>
          <div class="cs-act-fields" ${act ? "" : "hidden"}><label>Quoi ?<input data-au-what value="${esc(x.what || "")}" placeholder="Commencer par un verbe"></label><label>Qui ?<input data-au-who list="ownerList" value="${esc(x.who || a.owner || "")}"></label><label>Pour quand ?<input type="date" data-au-when value="${esc(x.when || auAddDays(sec && x.score <= 1 ? 7 : 30))}"></label></div></li>`;
      }).join("")}</ol>${ownerDatalist()}` : '<p class="jn-empty">Aucun critère sous 3.</p>'}</section>
      <label class="field">Synthèse de l’audit<textarea id="auSummary" rows="3" placeholder="Les deux ou trois messages pour le responsable du périmètre">${esc(a.audit_data?.summary || "")}</textarea></label>
      <div class="cs-who-when au-head-fields"><label>Périmètre<input id="auScopeB" value="${esc(a.scope || "")}"></label><label>Responsable<input id="auOwnerB" list="ownerList" value="${esc(a.owner || "")}"></label><label>Auditeur<input id="auAuditorB" list="ownerList" value="${esc(a.audit_data?.auditor || "")}"></label><label>Date<input id="auDateB" type="date" max="${today()}" value="${esc(a.performed_at || today())}"></label></div>`;
  }
  const next = step < 10 ? `<button type="button" class="btn jn-big" data-au-step="${step + 1}">${step < 9 ? `${step + 2}. ${esc(auDomains()[step + 1][0])} →` : "Bilan →"}</button>` : `<button type="button" class="btn jn-big" data-au-finish>Valider l’audit</button>`;
  modal(`${a.id} · ${a.scope || "Audit terrain"}`, `<div class="cs-audit au-audit">${auNavHtml(a, step)}<div class="cs-step-body">${body}</div>
    <div class="form-actions cs-nav">${step > 0 ? `<button type="button" class="btn ghost" data-au-step="${step - 1}" aria-label="Étape précédente">←</button>` : ""}${next}<button type="button" class="btn secondary" data-au-later>Plus tard</button></div></div>`);
  const root = $("modalContent");
  modalSaver = () => { document.activeElement?.blur?.(); auSyncBilan(); return true; };
  auBindNav(root);
  if (step < 10) root.querySelectorAll(".au-q").forEach((li) => auBindQ(li, auDomains()[step][0]));
  const file = $("auFile");
  if (file) file.onchange = async () => {
    const f = file.files?.[0], target = auRun?.photoFor;
    file.value = "";
    if (!f || !target) return;
    toast("Photo en préparation…");
    try { const ref = await phStore(await imageDataUrl(f)); const [d, ci] = target; if (ref && auRun && auSet(d, AUDIT_CRITERIA[d][ci], { photo: ref })) auRedrawQ(d, ci); } catch (error) { toast(error.message); }
  };
  root.querySelectorAll("[data-au-gap]").forEach((li) => { const box = li.querySelector("[data-au-act]"); box.onchange = () => { li.querySelector(".cs-act-fields").hidden = !box.checked; auSyncBilan(); }; });
  root.querySelector("[data-au-later]").onclick = () => { document.activeElement?.blur?.(); auSyncBilan(); auRun = null; modalSaver = null; modalDirty = false; closeModal(); render(); toast("Audit gardé : reprenez-le depuis Audits."); };
  root.querySelector("[data-au-finish]")?.addEventListener("click", () => auFinish());
  modalDirty = false;
}
function auSyncBilan() {
  const root = $("modalContent"), a = auGet();
  if (!a || !root?.querySelector("#auSummary")) return;
  const gaps = [...root.querySelectorAll("[data-au-gap]")].map((li) => { const [d, ...rest] = li.dataset.auGap.split("|"); return { d, c: rest.join("|"), act: li.querySelector("[data-au-act]").checked, what: li.querySelector("[data-au-what]").value.trim(), who: li.querySelector("[data-au-who]").value.trim(), when: li.querySelector("[data-au-when]").value }; });
  commitData(() => {
    const row = data.audits.find((x) => x.id === a.id);
    for (const g of gaps) { const x = row.audit_data.criteria.find((k) => k.domain === g.d && k.criterion === g.c); if (x) Object.assign(x, { act: g.act, what: g.what, who: g.who, when: g.when }); }
    row.audit_data.summary = $("auSummary").value.trim();
    const v = (id) => $(id)?.value.trim();
    if (v("auScopeB")) row.scope = v("auScopeB");
    if (v("auOwnerB")) row.owner = v("auOwnerB");
    if (v("auAuditorB")) row.audit_data.auditor = v("auAuditorB");
    if (v("auDateB")) row.performed_at = v("auDateB");
    row.updated_at = now();
  });
  modalDirty = false;
}
function auFinish() {
  document.activeElement?.blur?.();
  auSyncBilan();
  const a = auGet();
  if (!a) return;
  const missing = auDomains().filter(([d]) => !auFilled(a, d));
  if (missing.length) return toast(`Chaque critère a besoin d’une note et d’une preuve : ${missing.map(([d]) => d).join(", ")}.`);
  if (!a.scope || !a.owner || !a.audit_data?.auditor) return toast("Précisez le périmètre, son responsable et l’auditeur.");
  if (!a.performed_at || a.performed_at > today()) return toast("La date de l’audit ne peut pas être dans le futur.");
  const weak = (a.audit_data.criteria || []).filter((x) => auScored(x) && x.score < 3 && x.act);
  if (weak.some((x) => !x.who || !x.when)) return toast("Chaque action cochée a besoin d’un responsable et d’une date.");
  let created = 0;
  if (!commitData(() => {
    const row = data.audits.find((x) => x.id === a.id), crit = row.audit_data.criteria.filter((x) => AUDIT_CRITERIA[x.domain]?.includes(x.criterion));
    row.audit_data.criteria = crit;
    row.status = "Terminé";
    row.score = Math.round((crit.reduce((s, c) => s + c.score, 0) / 250) * 100);
    row.audit_data.domain_scores = Object.fromEntries(auDomains().map(([d]) => [d, auDomainScore(row, d)]));
    row.audit_data.proof_count = crit.filter(auProved).length;
    row.updated_at = now();
    for (const x of weak) {
      const key = `${x.domain}|${x.criterion}`;
      if (data.actions.some((y) => y.origin_id === row.id && y.question_id === key)) continue;
      data.actions.unshift({ id: auNext("A", data.actions), site_id: row.site_id, title: x.what || `${x.domain} · ${x.criterion}`, description: `Audit terrain ${row.id} · ${x.domain} · ${x.criterion} : ${x.score}/5${x.proof ? `\n${x.proof}` : ""}`, owner: x.who, due_date: x.when, due_date_initial: x.when, priority: x.score === 0 || (x.domain === "Sécurité" && x.score <= 1) ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: AU_FAMILY[x.domain] || "Autre", origin_type: "Audit", origin_id: row.id, audit_domain: x.domain, question_id: key, finding: x.proof || x.criterion, created_at: now(), updated_at: now() });
      created += 1;
    }
  })) return;
  auRun = null;
  modalSaver = null;
  modalDirty = false;
  render();
  toast(`Audit validé${created ? ` · ${jnPlural(created, "action ajoutée au plan", "actions ajoutées au plan")}` : ""}.`);
  auReport(data.audits.find((x) => x.id === a.id));
}

/* ---------- Rapport ---------- */

function auReport(a) {
  if (!a || !allowedSite(a.site_id)) return;
  if (!a.audit_data?.criteria?.length) return auReportBase(a);
  const prev = auPrev(a), acts = data.actions.filter((x) => x.origin_id === a.id && !x.archived_at);
  const vals = auDomains().map(([d]) => a.audit_data.domain_scores?.[d] ?? auDomainScore(a, d));
  modal(`${a.id} · Audit terrain · ${a.score ?? "—"}/100`, `<article class="au-report">
    <header class="au-r-head"><div><p class="cp-r-kicker">Audit terrain BIA · 50 critères</p><h3>${esc(getSiteName(a.site_id))} · ${esc(a.scope || "")}</h3><p>${esc(shortDate(a.performed_at))} · auditeur ${esc(a.audit_data.auditor || "")} · responsable ${esc(a.owner || "")}</p></div>
      <div class="cs-bilan-score tone-${auTone100(a.score)}"><span>${a.score ?? "—"}<small> /100</small></span><em>${prev ? `${a.score - prev.score >= 0 ? "+" : ""}${a.score - prev.score} pts depuis le ${shortDate(prev.performed_at)}` : "premier audit du périmètre"}</em></div></header>
    <div class="au-viz">${auRadar(vals, prev ? auDomains().map(([d]) => prev.audit_data.domain_scores[d] ?? null) : null)}${auBars(a, prev)}</div>
    ${a.audit_data.summary ? `<section><h4>Synthèse</h4><p class="au-summary">${esc(a.audit_data.summary)}</p></section>` : ""}
    ${acts.length ? `<section><h4>Actions · ${acts.length}</h4><table class="cp-r-table"><thead><tr><th>Quoi</th><th>Qui</th><th>Quand</th><th>État</th></tr></thead><tbody>${acts.map((x) => `<tr><td>${esc(x.title)}</td><td>${esc(x.owner || "")}</td><td>${x.due_date ? esc(shortDate(x.due_date)) : "—"}</td><td>${esc(x.status)}</td></tr>`).join("")}</tbody></table></section>` : ""}
    ${auDomains().map(([d, list], i) => `<section class="cs-view-s"><h4>${i + 1}. ${esc(d)} · ${(a.audit_data.domain_scores?.[d] ?? auDomainScore(a, d) ?? 0).toFixed(1).replace(".", ",")}/5</h4><ul>${list.map((c) => { const x = auCrit(a, d, c) || {}; return `<li><span class="cs-badge au-badge lv${x.score}">${auScored(x) ? `${x.score} · ${AU_LEVELS[x.score]}` : "—"}</span><span>${esc(c)}${x.proof ? `<em>${esc(x.proof)}</em>` : ""}</span>${x.photo ? phImg(x.photo, "cs-gap-img", "") : ""}</li>`; }).join("")}</ul></section>`).join("")}
  </article>
  <div class="form-actions"><button type="button" class="btn" data-print>Imprimer / PDF</button>${allowedSite(a.site_id, true) && !role().readonly ? `<button type="button" class="btn secondary" data-au-again="${esc(a.id)}">Refaire un audit de ce périmètre</button>` : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
  $("modalContent").querySelector("[data-au-again]")?.addEventListener("click", () => auStart({ site_id: a.site_id, scope: a.scope, owner: a.owner }));
}

/* ---------- Branchements ---------- */

const auReportBase = auditReport;
auditReport = function (a) { return auReport(a); };
const auFormBase = auditForm;
auditForm = function (existing = null, requestedDomain = null) {
  if (existing?.five_s || existing?.template_id) return auFormBase.apply(this, arguments);
  if (existing && !allowedSite(existing.site_id)) return;
  if (existing?.status === "Terminé") return auReport(existing);
  if (existing) {
    const first = auDomains().findIndex(([d]) => !auFilled(existing, d));
    auRun = { id: existing.id, step: requestedDomain ?? (existing.current_domain ?? (first < 0 ? 10 : first)) };
    return auRender();
  }
  return auStart();
};
/* Audits personnalisés : la même note au pouce, à la place de la liste déroulante. */
function auSegmentSelects(root) {
  root?.querySelectorAll('select[name^="score"]').forEach((sel) => {
    if (sel.dataset.auSeg) return;
    sel.dataset.auSeg = "1";
    sel.classList.add("au-hidden-select");
    const seg = document.createElement("div");
    seg.className = "au-seg";
    seg.setAttribute("role", "radiogroup");
    const draw = () => { seg.innerHTML = AU_LEVELS.map((l, v) => `<button type="button" class="au-v lv${v} ${sel.value === String(v) ? "on" : ""}" role="radio" aria-checked="${sel.value === String(v)}" data-v="${v}" ${sel.disabled || sel.closest("fieldset")?.disabled ? "disabled" : ""}><b>${v}</b><span>${l}</span></button>`).join(""); seg.querySelectorAll("button").forEach((b) => (b.onclick = () => { sel.value = sel.value === b.dataset.v ? "" : b.dataset.v; sel.dispatchEvent(new Event("change", { bubbles: true })); draw(); })); };
    draw();
    sel.after(seg);
  });
}
const auOsAuditFormBase = osAuditForm;
osAuditForm = function () { const out = auOsAuditFormBase.apply(this, arguments); auSegmentSelects($("modalContent")); return out; };
const auCloseModalBase = closeModal;
closeModal = function () { auRun = null; return auCloseModalBase.apply(this, arguments); };
