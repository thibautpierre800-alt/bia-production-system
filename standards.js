"use strict";
/*
 * BIA Lean OS 8.12 · Standard de poste, sur le modèle TWI et des logiciels d'instructions de travail.
 *  - Étapes importantes en photo (annotées au doigt), points clés typés sécurité / qualité / geste, la raison
 *    de chaque étape, le temps ; EPI en pictos ; réaction en cas d'écart.
 *  - Version validée (qui, quand, date d'effet) ; modifier un standard validé le repasse en révision.
 *  - Personnes formées, par version, avec le rappel des quatre temps de la formation TWI.
 *  - Fiche au poste en A4 paysage ; les standards d'une zone 5S sont visibles depuis la zone.
 * Données : documents[] de type STANDARD, structured_data.st = { zone_id, ppe[], steps[{id, title, points[{kind, text}],
 * reason, photo, time_s}], reaction, approved_by, approved_at, effective_date, trained[{name, date, by, version}] }.
 * Les six rubriques texte des anciens standards restent lisibles.
 */

const ST_KINDS = [["securite", "Sécurité", "⚠"], ["qualite", "Qualité", "✓"], ["geste", "Geste", "✋"]];
const ST_PPE = ["Lunettes", "Gants", "Gants anti-coupure", "Chaussures de sécurité", "Protection auditive", "Masque", "Gilet haute visibilité"];
const ST_REACTION = "Arrêter, sécuriser, prévenir le chef d’équipe.";
let stTimer = null;

function stDoc(id) { return data.documents.find((d) => d.id === id && d.type === "STANDARD"); }
function stOf(d) { const st = d?.structured_data?.st || {}; return { zone_id: null, ppe: [], steps: [], reaction: ST_REACTION, trained: [], ...st }; }
function stWritable(d) { return !!d && !role().readonly && allowedSite(d.site_id, true); }
function stTime(st) { return st.steps.reduce((s, x) => s + (Number(x.time_s) || 0), 0); }
function stKind(k) { return ST_KINDS.find((x) => x[0] === k) || ST_KINDS[2]; }
function stProblems(d) {
  const st = stOf(d), out = [];
  if (!st.steps.length) out.push("au moins une étape");
  if (st.steps.some((s) => !String(s.title || "").trim())) out.push("un intitulé pour chaque étape");
  if (st.steps.length && !st.steps.some((s) => (s.points || []).some((p) => String(p.text || "").trim()))) out.push("au moins un point clé");
  return out;
}
/* Enregistrement : une seule écriture, et un standard validé repasse en révision dès qu'on le modifie. */
function stSave(id, fn, { revise = true } = {}) {
  const ok = commitData(() => {
    const d = data.documents.find((x) => x.id === id);
    d.structured_data ||= {};
    const st = stOf(d);
    fn(st, d);
    d.structured_data.st = st;
    if (revise && d.status === "Validé") d.status = "En révision";
    d.updated_at = now();
  });
  if (ok) modalDirty = false;
  return ok;
}

/* ---------- Fiche au poste (aperçu, impression) ---------- */

function stSheet(d) {
  const st = stOf(d), z = (data.zones || []).find((x) => x.id === st.zone_id), total = stTime(st);
  const trainedNow = st.trained.filter((t) => t.version === (d.version || 1)).length;
  return `<article class="st-sheet"><header class="st-sheet-head"><div><p class="st-k">Standard de poste · ${esc(getSiteName(d.site_id))}${z ? " · " + esc(z.name) : ""}</p><h3>${esc(d.title)}</h3>
      <p>${d.status === "Validé" ? `Version ${d.version || 1} · en vigueur le ${shortDate(st.effective_date || st.approved_at)} · validée par ${esc(st.approved_by || "")}` : `${esc(d.status || "Brouillon")} · version ${d.version || 1} non validée`}${total ? ` · temps de cycle ${total} s` : ""}</p></div>
      ${st.ppe.length ? `<ul class="st-ppe">${st.ppe.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</header>
    <ol class="st-cards">${st.steps.map((s, i) => `<li class="st-card"><span class="st-n">${i + 1}</span>${s.photo ? phImg(s.photo, "st-card-img", `Étape ${i + 1}`) : '<span class="st-card-img st-nophoto">Photo à prendre</span>'}
      <b class="st-card-t">${esc(s.title || "Étape à nommer")}</b>
      ${(s.points || []).filter((p) => String(p.text || "").trim()).length ? `<ul class="st-kps">${s.points.filter((p) => String(p.text || "").trim()).map((p) => { const k = stKind(p.kind); return `<li class="kp-${k[0]}"><i aria-hidden="true">${k[2]}</i><span><em>${k[1]}</em> ${esc(p.text)}</span></li>`; }).join("")}</ul>` : ""}
      ${s.reason ? `<p class="st-why">Pourquoi : ${esc(s.reason)}</p>` : ""}${s.time_s ? `<p class="st-time">${esc(s.time_s)} s</p>` : ""}</li>`).join("") || '<li class="jn-empty">Aucune étape pour l’instant.</li>'}</ol>
    <footer class="st-foot"><b>En cas d’écart :</b> ${esc(st.reaction || ST_REACTION)}<span>${trainedNow ? `${jnPlural(trainedNow, "personne formée", "personnes formées")} à cette version` : "Formation à cette version à enregistrer"}</span></footer></article>`;
}
function stPrint(id) {
  const d = stDoc(id);
  if (!d) return;
  modal(`${d.id} · Fiche au poste`, `<div class="st-preview"><style media="print">@page{size:A4 landscape;margin:8mm}</style>${stSheet(d)}</div>
    <div class="form-actions"><button type="button" class="btn" data-print>Imprimer / PDF</button><button type="button" class="btn ghost" data-st-open="${esc(d.id)}">Revenir au standard</button></div>`);
}

/* ---------- Éditeur ---------- */

function stStepHtml(d, s, i, n, writable) {
  const dis = writable ? "" : "disabled";
  return `<li class="st-step" data-st-step="${esc(s.id)}"><div class="st-step-top"><span class="st-n">${i + 1}</span>
      <input class="st-title" data-st-title value="${esc(s.title || "")}" placeholder="Étape importante : un verbe et ce qui avance (ex. poser le chant)" ${dis}>
      ${writable ? `<span class="st-step-tools"><button type="button" class="cp-ph-btn" data-st-up ${i === 0 ? "disabled" : ""} aria-label="Monter l’étape">↑</button><button type="button" class="cp-ph-btn" data-st-down ${i === n - 1 ? "disabled" : ""} aria-label="Descendre l’étape">↓</button><button type="button" class="cp-ph-btn" data-st-del aria-label="Supprimer l’étape">×</button></span>` : ""}</div>
    <div class="st-step-body"><div class="st-photo">${s.photo ? `<figure class="cp-ph">${phImg(s.photo, "cp-ph-img", `Étape ${i + 1}`)}${writable ? `<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-st-annot>Annoter</button><button type="button" class="cp-ph-btn" data-st-phdel aria-label="Retirer la photo">×</button></span>` : ""}</figure>` : writable ? `<button type="button" class="cp-ph-add" data-st-ph><b>Photo</b><span>de l’étape</span></button>` : ""}</div>
      <div class="st-step-main"><ul class="st-kp-list">${(s.points || []).map((p, j) => { const k = stKind(p.kind); return `<li class="st-kp kp-${k[0]}" data-st-kp="${j}"><button type="button" class="st-kind" data-st-kind ${dis} title="${k[1]} · toucher pour changer" aria-label="Type : ${k[1]}, toucher pour changer">${k[2]}<span> ${k[1]}</span></button><input data-st-kptext value="${esc(p.text || "")}" placeholder="Point clé : ce qui fait réussir, éviter le danger ou faciliter" ${dis}>${writable ? `<button type="button" class="cp-ph-btn" data-st-kpdel aria-label="Retirer le point clé">×</button>` : ""}</li>`; }).join("")}</ul>
        ${writable ? `<div class="st-add-kp">${ST_KINDS.map(([k, l, ic]) => `<button type="button" class="chip" data-st-kpadd="${k}">+ ${ic} ${l}</button>`).join("")}</div>` : ""}
        <div class="st-step-row"><label>Pourquoi ?<input data-st-reason value="${esc(s.reason || "")}" placeholder="La raison des points clés" ${dis}></label><label class="st-t">Temps<span class="cs-inline"><input type="number" min="0" step="1" data-st-time value="${esc(s.time_s ?? "")}" ${dis}> s</span></label></div></div></div></li>`;
}
function stEditorHtml(d) {
  const st = stOf(d), writable = stWritable(d), zones = (data.zones || []).filter((z) => z.site_id === d.site_id && !z.archived_at), problems = stProblems(d), old = d.structured_data || {};
  const legacy = ["purpose", "scope", "sequence", "quality", "safety", "validation"].filter((k) => String(old[k] || "").trim());
  const trainedNow = st.trained.filter((t) => t.version === (d.version || 1));
  return `<div class="st-status st-${(d.status || "Brouillon").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-")}"><b>${esc(d.status || "Brouillon")} · version ${d.version || 1}</b><span>${d.status === "Validé" ? `En vigueur le ${shortDate(st.effective_date || st.approved_at)}, validé par ${esc(st.approved_by || "")}` : d.status === "En révision" ? "Modifié depuis la validation : à revalider" : "Pas encore validé"}${stTime(st) ? ` · temps de cycle ${stTime(st)} s` : ""}</span></div>
    <label class="field">Poste ou opération<input data-st-doctitle value="${esc(d.title || "")}" ${writable ? "" : "disabled"}></label>
    <div class="st-meta"><label class="field">Zone<select data-st-zone ${writable ? "" : "disabled"}><option value="">Sans zone</option>${zones.map((z) => `<option value="${esc(z.id)}" ${z.id === st.zone_id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}</select></label><label class="field">Responsable<input data-st-owner list="ownerList" value="${esc(d.owner || "")}" ${writable ? "" : "disabled"}>${ownerDatalist()}</label></div>
    <div class="ap-field"><span class="metric-label">Protections (EPI)</span><div class="filters">${ST_PPE.map((p) => `<button type="button" class="chip ${st.ppe.includes(p) ? "active" : ""}" data-st-ppe="${esc(p)}" aria-pressed="${st.ppe.includes(p)}" ${writable ? "" : "disabled"}>${esc(p)}</button>`).join("")}</div></div>
    <section class="st-steps-sec"><div class="section-title"><h3>Étapes · ${st.steps.length}</h3></div>
      <ol class="st-steps">${st.steps.map((s, i) => stStepHtml(d, s, i, st.steps.length, writable)).join("")}</ol>
      ${writable ? `<div class="cp-capture"><button type="button" class="btn jn-big" data-st-addstep>+ Étape</button><button type="button" class="btn jn-big dark" data-st-addphoto>Photo d’abord</button></div>` : ""}
      ${!st.steps.length && old.sequence && writable ? `<button type="button" class="btn secondary" data-st-fromseq>Créer les étapes à partir de l’ancienne séquence</button>` : ""}
      <input type="file" id="stFile" accept="image/*" capture="environment" hidden></section>
    <label class="field">En cas d’écart<input data-st-reaction value="${esc(st.reaction || "")}" ${writable ? "" : "disabled"}></label>
    ${legacy.length ? `<details class="jn-more"><summary>Version texte précédente</summary>${legacy.map((k) => `<p><b>${esc(DOCUMENT_SCHEMAS.STANDARD.fields.find((f) => f[0] === k)?.[1] || k)}</b><br>${esc(old[k])}</p>`).join("")}</details>` : ""}
    <section class="verification-box st-validate"><h3>Validation</h3>${problems.length ? `<p class="hint">Pour valider, il manque ${problems.join(", ")}.</p>` : ""}
      ${writable ? `<div class="cs-who-when"><label>Validé par<input id="stApprover" list="ownerList" value="${esc(st.approved_by || "")}" placeholder="Le responsable qui valide"></label><label>En vigueur le<input id="stEffective" type="date" value="${esc(st.effective_date || today())}"></label></div><button type="button" class="btn" data-st-validate ${d.status === "Validé" ? "disabled" : ""}>${d.status === "En révision" ? `Valider la version ${(d.version || 1) + 1}` : "Valider le standard"}</button>` : ""}</section>
    <section class="st-trained"><h3>Formés à la version ${d.version || 1} · ${trainedNow.length}</h3>
      ${st.trained.length ? `<ul class="cs-tag-list">${st.trained.slice().reverse().map((t) => `<li class="st-tr"><b>${esc(t.name)}</b><span>${shortDate(t.date)} · version ${t.version}${t.by ? ` · formé par ${esc(t.by)}` : ""}</span></li>`).join("")}</ul>` : '<p class="jn-empty">Personne n’est encore enregistré comme formé.</p>'}
      ${writable && d.status === "Validé" ? `<details class="jn-more"><summary>Former quelqu’un à ce standard</summary><p class="hint">Les quatre temps : préparer la personne ; montrer une étape à la fois en insistant sur les points clés ; la faire faire en lui demandant les points clés et leurs raisons ; suivre, en réduisant peu à peu l’accompagnement.</p>
        <div class="cs-who-when"><label>Personne formée<input id="stTrName" list="ownerList"></label><label>Date<input id="stTrDate" type="date" max="${today()}" value="${today()}"></label></div><label class="field">Formé par<input id="stTrBy" list="ownerList" value="${esc(apMe() || "")}"></label><button type="button" class="btn secondary" data-st-train>Enregistrer la formation</button></details>` : d.status !== "Validé" ? '<p class="hint">On forme sur une version validée.</p>' : ""}</section>
    <div class="form-actions"><button type="button" class="btn" data-st-print="${esc(d.id)}">Fiche au poste</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`;
}
function stOpen(id) {
  const d = stDoc(id);
  if (!d || !allowedSite(d.site_id)) return;
  modal(`${d.id} · Standard de poste`, `<div class="st-editor" data-st-doc="${esc(d.id)}">${stEditorHtml(d)}</div>`);
  stBind(d.id);
}
function stRedraw(id, focus = null) {
  const box = $("modalContent")?.querySelector(`.st-editor[data-st-doc="${id}"]`), d = stDoc(id);
  if (!box || !d) return;
  const scroller = box.closest(".modal"), top = scroller?.scrollTop;
  box.innerHTML = stEditorHtml(d);
  stBind(id);
  phFill(box);
  if (scroller && top !== undefined) scroller.scrollTop = top;
  if (focus) box.querySelector(focus)?.focus({ preventScroll: true });
}
function stBind(id) {
  const box = $("modalContent")?.querySelector(`.st-editor[data-st-doc="${id}"]`);
  if (!box) return;
  const d = stDoc(id), writable = stWritable(d);
  box.querySelector("[data-st-print]")?.addEventListener("click", () => stPrint(id));
  if (!writable) return;
  const later = (fn) => { clearTimeout(stTimer); stTimer = setTimeout(fn, 400); };
  const stepOf = (el) => el.closest("[data-st-step]")?.dataset.stStep;
  const withStep = (el, fn) => { const sid = stepOf(el); return stSave(id, (st) => { const s = st.steps.find((x) => x.id === sid); if (s) fn(s, st); }); };
  const field = (sel, apply) => box.querySelectorAll(sel).forEach((el) => { el.oninput = () => later(() => apply(el)); el.onchange = () => { clearTimeout(stTimer); apply(el); }; });
  field("[data-st-doctitle]", (el) => { const v = el.value.trim(); if (v) stSave(id, (st, doc) => { doc.title = v; }); });
  field("[data-st-owner]", (el) => stSave(id, (st, doc) => { doc.owner = el.value.trim(); }, { revise: false }));
  field("[data-st-reaction]", (el) => stSave(id, (st) => { st.reaction = el.value.trim(); }));
  field("[data-st-title]", (el) => withStep(el, (s) => { s.title = el.value.trim(); }));
  field("[data-st-reason]", (el) => withStep(el, (s) => { s.reason = el.value.trim(); }));
  field("[data-st-time]", (el) => withStep(el, (s) => { const n = Number(el.value); s.time_s = el.value === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n); }));
  field("[data-st-kptext]", (el) => withStep(el, (s) => { const j = Number(el.closest("[data-st-kp]").dataset.stKp); if (s.points[j]) s.points[j].text = el.value.trim(); }));
  box.querySelector("[data-st-zone]").onchange = (e) => { stSave(id, (st) => { st.zone_id = e.target.value || null; }, { revise: false }); };
  box.querySelectorAll("[data-st-ppe]").forEach((b) => (b.onclick = () => { const p = b.dataset.stPpe; if (stSave(id, (st) => { st.ppe = st.ppe.includes(p) ? st.ppe.filter((x) => x !== p) : [...st.ppe, p]; })) stRedraw(id); }));
  const addStep = (photo = "") => { const sid = uid("STEP"); if (stSave(id, (st) => { st.steps.push({ id: sid, title: "", points: [], reason: "", photo, time_s: null }); })) stRedraw(id, `[data-st-step="${sid}"] [data-st-title]`); };
  box.querySelector("[data-st-addstep]")?.addEventListener("click", () => addStep());
  const file = box.querySelector("#stFile");
  box.querySelector("[data-st-addphoto]")?.addEventListener("click", () => { file.dataset.for = ""; file.click(); });
  file.onchange = async () => {
    const f = file.files?.[0], target = file.dataset.for;
    file.value = "";
    if (!f) return;
    toast("Photo en préparation…");
    try {
      const ref = await phStore(await imageDataUrl(f));
      if (!ref) return;
      if (target) { if (stSave(id, (st) => { const s = st.steps.find((x) => x.id === target); if (s) s.photo = ref; })) stRedraw(id); }
      else addStep(ref);
    } catch (error) { toast(error.message); }
  };
  box.querySelectorAll("[data-st-step]").forEach((li) => {
    const sid = li.dataset.stStep;
    li.querySelector("[data-st-ph]")?.addEventListener("click", () => { file.dataset.for = sid; file.click(); });
    li.querySelector("[data-st-phdel]")?.addEventListener("click", () => { if (stSave(id, (st) => { const s = st.steps.find((x) => x.id === sid); if (s) s.photo = ""; })) stRedraw(id); });
    li.querySelector("[data-st-annot]")?.addEventListener("click", () => { const s = stOf(stDoc(id)).steps.find((x) => x.id === sid); cpAnnotate(s.photo, (ref) => { if (stSave(id, (st) => { const t = st.steps.find((x) => x.id === sid); if (t) t.photo = ref; })) stRedraw(id); }); });
    const move = (delta) => { if (stSave(id, (st) => { const i = st.steps.findIndex((x) => x.id === sid), j = i + delta; if (i < 0 || j < 0 || j >= st.steps.length) return; [st.steps[i], st.steps[j]] = [st.steps[j], st.steps[i]]; })) stRedraw(id); };
    li.querySelector("[data-st-up]")?.addEventListener("click", () => move(-1));
    li.querySelector("[data-st-down]")?.addEventListener("click", () => move(1));
    li.querySelector("[data-st-del]")?.addEventListener("click", () => { const s = stOf(stDoc(id)).steps.find((x) => x.id === sid); if ((s.title || s.photo || s.points?.length) && !li.dataset.confirm) { li.dataset.confirm = "1"; toast("Touchez × encore une fois pour supprimer l’étape."); return; } if (stSave(id, (st) => { st.steps = st.steps.filter((x) => x.id !== sid); })) stRedraw(id); });
    li.querySelectorAll("[data-st-kpadd]").forEach((b) => (b.onclick = () => { let j = 0; if (stSave(id, (st) => { const s = st.steps.find((x) => x.id === sid); s.points ||= []; s.points.push({ kind: b.dataset.stKpadd, text: "" }); j = s.points.length - 1; })) stRedraw(id, `[data-st-step="${sid}"] [data-st-kp="${j}"] input`); }));
    li.querySelectorAll("[data-st-kp]").forEach((row) => {
      const j = Number(row.dataset.stKp);
      row.querySelector("[data-st-kind]").onclick = () => { if (stSave(id, (st) => { const p = st.steps.find((x) => x.id === sid).points[j], i = ST_KINDS.findIndex((k) => k[0] === p.kind); p.kind = ST_KINDS[(i + 1) % ST_KINDS.length][0]; })) stRedraw(id); };
      row.querySelector("[data-st-kpdel]")?.addEventListener("click", () => { if (stSave(id, (st) => { st.steps.find((x) => x.id === sid).points.splice(j, 1); })) stRedraw(id); });
    });
  });
  box.querySelector("[data-st-fromseq]")?.addEventListener("click", () => {
    const lines = String(stDoc(id).structured_data.sequence || "").split(/\n+/).map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean).slice(0, 30);
    if (stSave(id, (st) => { st.steps = lines.map((t) => ({ id: uid("STEP"), title: t, points: [], reason: "", photo: "", time_s: null })); })) stRedraw(id);
  });
  box.querySelector("[data-st-validate]")?.addEventListener("click", () => {
    document.activeElement?.blur?.();
    clearTimeout(stTimer);
    const doc = stDoc(id), missing = stProblems(doc), by = $("stApprover").value.trim(), eff = $("stEffective").value;
    if (missing.length) return toast(`Pour valider, il manque ${missing.join(", ")}.`);
    if (!by || !eff) return toast("Indiquez qui valide et la date d’entrée en vigueur.");
    const bump = !!stOf(doc).approved_at;
    if (!stSave(id, (st, x) => { st.approved_by = by; st.approved_at = now(); st.effective_date = eff; x.status = "Validé"; if (bump) x.version = (x.version || 1) + 1; x.history ||= []; x.history.push({ at: now(), event: `Version ${x.version || 1} validée`, by }); }, { revise: false })) return;
    toast(`Standard validé, version ${stDoc(id).version || 1}.`);
    render();
    stOpen(id);
  });
  box.querySelector("[data-st-train]")?.addEventListener("click", () => {
    const name = $("stTrName").value.trim(), date = $("stTrDate").value, by = $("stTrBy").value.trim();
    if (!name || !date || date > today()) return toast("Indiquez la personne formée et une date passée ou du jour.");
    if (!stSave(id, (st, x) => { st.trained.push({ name, date, by, version: x.version || 1 }); }, { revise: false })) return;
    toast(`${name} formé(e) à la version ${stDoc(id).version || 1}.`);
    stRedraw(id);
  });
  modalSaver = () => { uxFlush(); return true; };
}

/* ---------- Branchements ---------- */

const stEditBase = editDocument;
editDocument = function (id) {
  const d = stDoc(id);
  if (d) return stOpen(id);
  return stEditBase.apply(this, arguments);
};
const stVisualBase = documentVisual;
documentVisual = function (type, values = {}) {
  if (type === "STANDARD" && values?.st) { const fake = { title: "", site_id: state.site, status: "", version: 1, structured_data: values }; return stSheet(fake); }
  return stVisualBase.apply(this, arguments);
};
const stPrintBase = documentPrint;
documentPrint = function (d, values) {
  if (d?.type === "STANDARD" && d.structured_data?.st) return `<div class="st-preview"><style media="print">@page{size:A4 landscape;margin:8mm}</style>${stSheet(d)}</div>`;
  return stPrintBase.apply(this, arguments);
};
const stProgressBase = documentProgress;
documentProgress = function (type, values = {}) {
  if (type !== "STANDARD" || !values?.st) return stProgressBase.apply(this, arguments);
  const st = { steps: [], ...values.st }, checks = [st.steps.length > 0, st.steps.length > 0 && st.steps.every((s) => String(s.title || "").trim()), st.steps.some((s) => (s.points || []).some((p) => String(p.text || "").trim())), st.steps.length > 0 && st.steps.every((s) => s.photo), !!st.approved_at];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
};
/* Une zone 5S montre ses standards ; on en crée un depuis la zone. */
const stZoneOpenBase = csZoneOpen;
csZoneOpen = function (zid) {
  const out = stZoneOpenBase.apply(this, arguments), z = csZone(zid), root = $("modalContent")?.querySelector(".cs-zone");
  if (!z || !root) return out;
  const docs = data.documents.filter((d) => d.type === "STANDARD" && !d.archived_at && stOf(d).zone_id === z.id);
  const canNew = !role().readonly && allowedSite(z.site_id, true) && role().nav.includes("documents");
  const html = `<section class="st-zone"><div class="section-title"><h3>Standards de la zone · ${docs.length}</h3>${canNew ? `<button type="button" class="btn secondary small" data-st-new="${esc(z.id)}">+ Standard</button>` : ""}</div>${docs.length ? `<div class="cs-hist">${docs.map((d) => `<button type="button" class="cs-hist-row" data-st-open="${esc(d.id)}"><span>${esc(d.title)}</span><b>${esc(d.status || "Brouillon")} · v${d.version || 1}</b></button>`).join("")}</div>` : '<p class="jn-empty">Aucun standard rattaché à cette zone.</p>'}</section>`;
  const ref = root.querySelector(".cs-ref");
  if (ref) ref.insertAdjacentHTML("afterend", html); else root.insertAdjacentHTML("beforeend", html);
  root.querySelectorAll("[data-st-open]").forEach((b) => (b.onclick = () => stOpen(b.dataset.stOpen)));
  root.querySelector("[data-st-new]")?.addEventListener("click", () => stNew({ zone_id: z.id, site_id: z.site_id, title: z.name }));
  return out;
};
function stNew({ zone_id = null, site_id = null, title = "" } = {}) {
  const site = site_id || (state.site === "group" ? OPERATIONAL_SITES.find((s) => allowedSite(s.id, true))?.id : state.site);
  if (!site || !allowedSite(site, true) || role().readonly) return toast("Votre profil ne permet pas de créer un standard.");
  modal("Nouveau standard de poste", `<form id="stNewForm" class="jn-form"><label class="field">Poste ou opération<input id="stNewTitle" required value="${esc(title)}" placeholder="Ex. Collage des chants, poste 3"></label><label class="field">Responsable<input id="stNewOwner" list="ownerList" required value="${esc(apMe() || "")}">${ownerDatalist()}</label>
    <div class="form-actions"><button class="btn jn-big">Créer et décrire les étapes</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("stNewTitle")?.focus(), 0);
  $("stNewForm").onsubmit = (e) => {
    e.preventDefault();
    const t = $("stNewTitle").value.trim(), owner = $("stNewOwner").value.trim();
    if (!t || !owner) return toast("Précisez le poste et le responsable.");
    const doc = { id: nextId("DOC", data.documents), site_id: site, type: "STANDARD", title: t, owner, status: "Brouillon", problem_id: null, structured_data: { st: { zone_id, ppe: [], steps: [], reaction: ST_REACTION, trained: [] } }, version: 1, created_at: now(), updated_at: now() };
    if (!commitData(() => data.documents.unshift(doc))) return;
    modalDirty = false;
    render();
    stOpen(doc.id);
  };
}
const stCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  stCreateMenuBase.apply(this, arguments);
  if (role().readonly || !role().nav.includes("documents") || !osManager()) return;
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  const html = `<button class="create-choice st-choice" type="button" data-st-newmenu><span aria-hidden="true"><b>SW</b></span><b>Standard de poste</b><small>Étapes en photo, points clés et raisons</small></button>`;
  const note = menu.querySelector(".cp-note-choice");
  if (note) note.insertAdjacentHTML("beforebegin", html); else menu.insertAdjacentHTML("beforeend", html);
  menu.querySelector("[data-st-newmenu]").onclick = () => stNew();
};
function stBindGlobal(root = document) {
  root.querySelectorAll("[data-st-open]").forEach((b) => { if (!b.onclick) b.onclick = () => stOpen(b.dataset.stOpen); });
}
const stOsBindBase = osBind;
osBind = function () { const out = stOsBindBase.apply(this, arguments); stBindGlobal(document); return out; };
