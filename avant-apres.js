"use strict";
/*
 * BIA Lean OS 8.28 · Fiche avant / après : deux photos côte à côte, trois lignes, une fiche à afficher, et la suite.
 *  - Photos d'abord, prises au téléphone, côte à côte ; le problème, l'amélioration, le gain constaté.
 *  - Créée depuis une idée ou un Kaizen, la fiche reprend son titre, ses photos, le problème, l'idée et le résultat.
 *  - Une fois enregistrée : la fiche d'une page (à imprimer ou afficher), « Modifier », « Partager aux sites »
 *    (bonne pratique pré-remplie avec les deux photos).
 * Données : documents[] de type BEFORE_AFTER (inchangé) ; les photos sont rangées comme les autres photos de l'appli.
 */

function baKaizen(preset) { const id = preset?.kaizen_id || preset?.source_id; return id ? (data.kaizens || []).find((k) => k.id === id) : null; }
function baSheet(doc) {
  const v = doc.structured_data || {}, ph = (x, l) => (x ? phImg(x, "id-ba-img", l) : "") || `<span class="id-ba-img id-nophoto">${l}</span>`;
  const rows = [["Le problème", v.problem], ["L’amélioration", v.description || doc.content], ["Le gain constaté", v.gain]].filter(([, x]) => String(x || "").trim());
  return `<article class="id-sheet ba-sheet"><header><div><small>AVANT / APRÈS</small><h3>${esc(doc.title || "")}</h3><p>${esc(getSiteName(doc.site_id))}${doc.owner ? ` · ${esc(doc.owner)}` : ""} · ${shortDate(doc.updated_at || doc.created_at || now())}</p></div></header>
    <div class="id-ba big"><figure>${ph(v.before_photo, "Avant")}<figcaption>Avant</figcaption></figure><figure>${ph(v.after_photo, "Après")}<figcaption>Après</figcaption></figure></div>
    ${rows.length ? `<dl class="id-dl">${rows.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl>` : ""}
    <footer>${esc(doc.id || "")}${doc.kaizen_id ? ` · idée ${esc(doc.kaizen_id)}` : ""}</footer></article>`;
}
function baSlot(key, value, label) {
  return `<figure class="bp-slot" data-ba-slot="${key}">${value ? `<div class="cp-ph cs-tag-ph">${phImg(value, "id-ba-img", label)}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-ba-del aria-label="Retirer la photo ${label.toLowerCase()}">×</button></span></div>` : `<button type="button" class="cp-ph-add cs-tag-ph" data-ba-add><b>Photo</b><span>${label.toLowerCase()}</span></button>`}<figcaption>${label}</figcaption></figure>`;
}
function baForm(existing = null, preset = {}) {
  const k = existing?.id ? null : baKaizen({ ...preset, ...(existing || {}) }), v = existing?.structured_data || {};
  const siteId = existing?.site_id || preset.site_id || k?.site_id || (state.site === "group" ? "marzin" : state.site);
  const ph = { before: v.before_photo || k?.before_photo || "", after: v.after_photo || k?.after_photo || "" };
  const description = v.description ?? ([v.idea, v.result].filter(Boolean).join(" · ") || existing?.content || k?.solution || "");
  modal(existing?.id ? "Modifier la fiche avant / après" : "Fiche avant / après", `<form id="beforeAfterForm" class="jn-form before-after-form ba-form"><p class="jn-lead">Deux photos prises du même endroit, et trois lignes.</p>
    <div class="id-ba bp-ba" id="baSlots">${baSlot("before", ph.before, "Avant")}${baSlot("after", ph.after, "Après")}</div>
    <input type="file" id="beforePhoto" accept="image/*" capture="environment" hidden><input type="file" id="afterPhoto" accept="image/*" capture="environment" hidden>
    <label class="field">Titre<input id="baTitle" required value="${esc(existing?.title || k?.title || preset.title || "")}" placeholder="Ex. Rangement des outils au poste 3" autocomplete="off"></label>
    <label class="field">Le problème, avant<input id="baProblem" maxlength="250" value="${esc(v.problem || k?.problem || "")}" placeholder="Ex. outils cherchés 10 min à chaque changement"></label>
    <label class="field">L’amélioration<textarea id="baDescription" rows="2" maxlength="500" placeholder="Ce qui a changé">${esc(description)}</textarea></label>
    <label class="field">Le gain constaté<input id="baGain" maxlength="250" value="${esc(v.gain || k?.result || "")}" placeholder="Avec l’unité et la période : 10 min par changement, sur 2 semaines"></label>
    <div class="bp-two"><label class="field">Site<select id="baSite" ${existing?.id ? "disabled" : ""}>${siteOptions(siteId)}</select></label><label class="field">Responsable (facultatif)<input id="baOwner" list="ownerList" value="${esc(existing?.owner || k?.owner || apMe() || "")}">${ownerDatalist()}</label></div>
    <div class="form-actions"><button class="btn jn-big">Enregistrer la fiche</button><button type="button" class="btn secondary" id="printBeforeAfter">Imprimer</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div><div class="print-document" id="beforeAfterPrint"></div></form>`);
  let docId = existing?.id || null;
  const box = $("baSlots"), inputs = { before: $("beforePhoto"), after: $("afterPhoto") };
  const draw = () => { box.innerHTML = baSlot("before", ph.before, "Avant") + baSlot("after", ph.after, "Après"); bind(); phFill(box); };
  const bind = () => box.querySelectorAll("[data-ba-slot]").forEach((fig) => { const key = fig.dataset.baSlot; const add = fig.querySelector("[data-ba-add]"), del = fig.querySelector("[data-ba-del]"); if (add) add.onclick = () => inputs[key].click(); if (del) del.onclick = () => { ph[key] = ""; modalDirty = true; draw(); }; });
  Object.entries(inputs).forEach(([key, input]) => (input.onchange = async () => { const f = input.files?.[0]; input.value = ""; if (!f) return; try { ph[key] = await phStore(await imageDataUrl(f)); modalDirty = true; draw(); } catch (error) { toast(error.message); } }));
  bind(); phFill(box);
  const capture = () => ({ ...preset, ...(existing || {}), id: docId || nextId("DOC", data.documents), site_id: $("baSite").value, type: "BEFORE_AFTER", title: $("baTitle").value.trim(), owner: $("baOwner").value.trim(), status: existing?.status || "Brouillon", kaizen_id: existing?.kaizen_id || preset.kaizen_id || k?.id || null, structured_data: { ...v, problem: $("baProblem").value.trim(), gain: $("baGain").value.trim(), before_photo: ph.before, after_photo: ph.after, description: $("baDescription").value.trim() }, content: $("baDescription").value.trim(), version: existing?.version || 1, created_at: existing?.created_at || now(), updated_at: now() });
  const persist = () => {
    const doc = capture();
    if (!doc.title) { $("baTitle").focus(); toast("Donnez un titre à la fiche."); return false; }
    if (!doc.structured_data.before_photo || !doc.structured_data.after_photo) { toast("Il faut les deux photos : avant et après."); return false; }
    if (!allowedSite(doc.site_id, true)) return false;
    if (!commitData(() => { const found = data.documents.find((d) => d.id === doc.id); if (found) Object.assign(found, doc); else data.documents.unshift(doc); })) return false;
    docId = doc.id; modalDirty = false;
    return data.documents.find((d) => d.id === doc.id);
  };
  $("beforeAfterForm").onsubmit = (e) => { e.preventDefault(); const doc = persist(); if (!doc) return; closeModal(); render(); baView(doc.id); toast(`Fiche ${doc.id} enregistrée.`); };
  $("printBeforeAfter").onclick = () => { const doc = persist(); if (!doc) return; $("beforeAfterPrint").innerHTML = baSheet(doc); phFill($("beforeAfterPrint")); window.print(); };
}
function baView(id) {
  const doc = (data.documents || []).find((d) => d.id === id && d.type === "BEFORE_AFTER");
  if (!doc) return;
  const w = !role().readonly && allowedSite(doc.site_id, true), shared = (data.practices || []).some((p) => !p.archived_at && p.source_id === doc.id), canShare = w && typeof bpCan === "function" && bpCan() && !shared;
  modal("Fiche avant / après", `${baSheet(doc)}<style media="print">@page{size:A4;margin:10mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button>${w ? '<button type="button" class="btn secondary" data-ba-edit>Modifier</button>' : ""}${canShare ? '<button type="button" class="btn secondary" data-ba-share>Partager aux sites</button>' : ""}<button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
  const root = $("modalContent");
  phFill(root);
  root.querySelector("[data-print]").onclick = () => window.print();
  root.querySelector("[data-ba-edit]")?.addEventListener("click", () => baForm(doc));
  root.querySelector("[data-ba-share]")?.addEventListener("click", () => { const v = doc.structured_data || {}; bpNew({ title: doc.title, summary: v.description || doc.content || "", problem: v.problem || "", before_photo: v.before_photo, after_photo: v.after_photo, site_id: doc.site_id, source_id: doc.id, owner: doc.owner || "" }); });
}

/* ---------- Branchements ---------- */

beforeAfterForm = function (existing = null, preset = {}) { return baForm(existing, preset || {}); };
