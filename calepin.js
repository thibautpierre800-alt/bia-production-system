"use strict";
/*
 * BIA Lean OS 8.8 · Calepin Gemba.
 *  - Photos rangées dans la base photos du navigateur (IndexedDB) : des centaines de photos sans saturer
 *    la sauvegarde locale. Les fiches gardent une référence « photo:… » ; une sauvegarde exportée
 *    embarque les photos et les restaure à l'import. Sans base photos, comportement d'avant (photo dans la fiche).
 *  - Constat en dix secondes : photo d'abord, une phrase, sa nature (constat, risque à vérifier, question,
 *    piste, point fort), « risque immédiat », la famille. Jusqu'à trois photos, annotées au doigt.
 *  - Compte rendu de visite : imprimable, copiable pour un mail, partageable depuis le téléphone.
 *  - Hors ligne : indicateur, installation sur l'écran d'accueil, stockage persistant demandé.
 *  - Remarques sur l'appli : noter sur le moment ce qui gêne pendant l'usage réel.
 * Champs ajoutés aux constats (additifs) : kind, urgent, photos[], noted_at ; à la visite : people.
 */

/* ---------- Photos : base du navigateur ---------- */

const PH_DB = "bia-photos", PH_STORE = "photos", PH_PREFIX = "photo:", PH_KEEP_DAYS = 30;
const PH_CACHE = new Map(), PH_WANTED = new Set();
let phDb = null, phState = "init", phPersisted = false;
const phSafeBase = safePhoto, phImageBase = photoImage, phExportBase = exportData, phValidateBase = validateImport;

function phIsRef(v) { return typeof v === "string" && /^photo:[A-Za-z0-9_-]{4,80}$/.test(v); }
function phId(v) { return v.slice(PH_PREFIX.length); }
function phRefs(text) { return new Set([...String(text || "").matchAll(/photo:([A-Za-z0-9_-]{4,80})/g)].map((m) => m[1])); }
function phReq(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error || new Error("Base photos indisponible")); }); }
const phReady = new Promise((resolve) => {
  let done = false;
  const finish = (db) => { if (done) { if (db && db !== phDb) db.close(); return; } done = true; phDb = db; phState = db ? "ready" : "off"; resolve(db); };
  try {
    if (!window.indexedDB) return finish(null);
    const req = indexedDB.open(PH_DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(PH_STORE)) req.result.createObjectStore(PH_STORE, { keyPath: "id" }); };
    req.onsuccess = () => finish(req.result);
    req.onerror = () => finish(null);
    req.onblocked = () => finish(null);
    setTimeout(() => finish(null), 5000);
  } catch { finish(null); }
});
function phGet(id) {
  return phReady.then((db) => (db ? phReq(db.transaction(PH_STORE, "readonly").objectStore(PH_STORE).get(id)) : null)).catch(() => null);
}
function phPut(rows) {
  return new Promise((res, rej) => {
    try {
      const tx = phDb.transaction(PH_STORE, "readwrite"), store = tx.objectStore(PH_STORE);
      rows.forEach((r) => store.put(r));
      tx.oncomplete = () => res();
      tx.onerror = tx.onabort = () => rej(tx.error || new Error("Base photos pleine ou indisponible"));
    } catch (error) { rej(error); }
  });
}
function phPersist() {
  if (phPersisted) return;
  phPersisted = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch {}
}
/* Range une photo (data URL contrôlée) ; rend la référence, ou la photo elle-même si la base est indisponible. */
async function phStore(url) {
  if (!phSafeBase(url)) return "";
  await phReady;
  if (phState !== "ready") return url;
  const id = uid("PH");
  try { await phPut([{ id, data: url }]); } catch { return url; }
  PH_CACHE.set(id, url);
  phPersist();
  return PH_PREFIX + id;
}
function phFill(root = document) {
  root.querySelectorAll("img[data-ph-wait]").forEach((img) => {
    const u = PH_CACHE.get(img.dataset.phWait);
    if (u) { img.src = u; img.hidden = false; img.removeAttribute("data-ph-wait"); }
  });
}
function phWant(id) {
  if (PH_CACHE.has(id) || PH_WANTED.has(id)) return;
  PH_WANTED.add(id);
  phGet(id).then((row) => {
    PH_WANTED.delete(id);
    if (row?.data && phSafeBase(row.data)) { PH_CACHE.set(id, row.data); phFill(); }
  });
}
function phSrc(v) {
  if (!phIsRef(v)) return phSafeBase(v);
  const u = PH_CACHE.get(phId(v));
  if (!u) phWant(phId(v));
  return u || "";
}
function phImg(v, cls = "evidence-photo", alt = "Photo terrain") {
  if (phIsRef(v) && !PH_CACHE.has(phId(v))) {
    if (phState === "off") return "";
    phWant(phId(v));
    return `<img class="${cls}" data-ph-wait="${esc(phId(v))}" alt="${esc(alt)}" hidden>`;
  }
  const u = phSrc(v);
  return u ? `<img class="${cls}" src="${u}" alt="${esc(alt)}">` : "";
}
safePhoto = function (value) { return phSrc(value); };
photoImage = function (value, alt = "Photo terrain") { return phImg(value, "evidence-photo", alt); };

/* Le sélecteur de photo commun range aussi les photos des signaux, audits et fiches avant / après. */
photoPicker = function (inputId, previewId, initial = "") {
  const photo = { value: phIsRef(initial) ? initial : phSafeBase(initial), busy: false, error: false }, input = $(inputId), preview = $(previewId);
  let sequence = 0;
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const current = ++sequence;
    photo.busy = true; photo.error = false; preview.textContent = "Préparation de la photo…";
    try {
      const value = await phStore(await imageDataUrl(file));
      if (current !== sequence) return;
      photo.value = value; preview.innerHTML = photoImage(value); modalDirty = true;
    } catch (error) {
      if (current !== sequence) return;
      photo.error = true; preview.innerHTML = `${photoImage(photo.value)}<p class="bad" role="alert">${esc(error.message)}</p>`;
    } finally { if (current === sequence) { photo.busy = false; scheduleModalSave(); } }
  };
  return photo;
};

/* Remplace des références par la photo elle-même (base photos devenue indisponible). */
function phInline(target, photos) {
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach((v, i) => { if (phIsRef(v) && photos[phId(v)]) o[i] = photos[phId(v)]; else walk(v); });
    else if (o && typeof o === "object") for (const k of Object.keys(o)) { const v = o[k]; if (phIsRef(v) && photos[phId(v)]) o[k] = photos[phId(v)]; else walk(v); }
  };
  walk(target);
  return target;
}

/* Sauvegarde exportée : la fiche et ses photos dans un seul fichier. */
exportData = function () {
  const ids = [...phRefs(JSON.stringify(data))];
  if (!ids.length) return phExportBase();
  return Promise.all(ids.map((id) => (PH_CACHE.has(id) ? [id, PH_CACHE.get(id)] : phGet(id).then((r) => [id, r?.data || ""])))).then((pairs) => {
    const photos = Object.fromEntries(pairs.filter(([, u]) => phSafeBase(u)));
    const blob = new Blob([JSON.stringify({ ...data, photos }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `bia-production-system-v5-${today()}.json`; a.click(); URL.revokeObjectURL(url);
    const missing = ids.length - Object.keys(photos).length;
    toast(`Sauvegarde exportée avec ${jnPlural(Object.keys(photos).length, "photo", "photos")}${missing ? ` · ${missing} introuvable(s) sur cet appareil` : ""}.`);
  });
};
validateImport = function (incoming) {
  if (!incoming || typeof incoming !== "object" || !incoming.photos || typeof incoming.photos !== "object" || Array.isArray(incoming.photos)) return phValidateBase(incoming);
  const photos = {};
  for (const [id, url] of Object.entries(incoming.photos)) if (/^[A-Za-z0-9_-]{4,80}$/.test(id) && phSafeBase(url)) photos[id] = url;
  const rest = { ...incoming };
  delete rest.photos;
  const out = phValidateBase(rest);
  if (phState !== "ready") return phInline(out, photos);
  for (const [id, url] of Object.entries(photos)) PH_CACHE.set(id, url);
  phPut(Object.entries(photos).map(([id, url]) => ({ id, data: url }))).catch(() => {
    // Base photos pleine : les photos importées repassent dans la fiche pour ne pas être perdues.
    phInline(data, photos); save();
  });
  return out;
};

/* Ménage : photos qui ne sont plus référencées nulle part depuis plus d'un mois. */
function phGc() {
  if (phState !== "ready") return;
  let text = "";
  try { for (let i = 0; i < localStorage.length; i++) text += localStorage.getItem(localStorage.key(i)) || ""; } catch { return; }
  text += JSON.stringify(data);
  const used = phRefs(text), limit = Date.now() - PH_KEEP_DAYS * 864e5;
  phReq(phDb.transaction(PH_STORE, "readonly").objectStore(PH_STORE).getAllKeys()).then((keys) => {
    const old = keys.filter((k) => !used.has(k) && Number(String(k).split("-")[1]) < limit);
    if (!old.length) return;
    const tx = phDb.transaction(PH_STORE, "readwrite");
    old.forEach((k) => tx.objectStore(PH_STORE).delete(k));
  }).catch(() => {});
}
phReady.then(() => { phFill(); setTimeout(phGc, 8000); });

/* ---------- Calepin : nature d'une note ---------- */

const CP_KINDS = [
  ["fait", "Constat", "Ce que je vois", "Un fait, sans chercher la cause. Ex. palettes au sol devant le rack 4"],
  ["risque", "Risque à vérifier", "Le risque", "Le danger possible, et où. Ex. câbles au sol dans l’allée des gerbeurs"],
  ["question", "Question", "La question", "Ce qu’il faut comprendre. Ex. qui affecte les emplacements au sol ?"],
  ["piste", "Piste", "L’idée", "Une idée à creuser, pas une décision. Ex. chariot multi-commandes"],
  ["positif", "Point fort", "Ce qui marche bien", "À garder ou à partager. Ex. feuilles vertes de suivi claires"],
];
const CP_MAX_PHOTOS = 3;
function cpKind(o) { return CP_KINDS.find((k) => k[0] === (o?.kind || "fait")) || CP_KINDS[0]; }
function cpPhotos(o) {
  const ok = (p) => phIsRef(p) || phSafeBase(p);
  const list = Array.isArray(o?.photos) ? o.photos.filter(ok) : [];
  if (o?.photo && ok(o.photo) && list[0] !== o.photo) { if (list.length) list[0] = o.photo; else list.push(o.photo); }
  return list.slice(0, CP_MAX_PHOTOS);
}
function cpTime(iso) {
  const d = new Date(iso || "");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function cpLongDate(iso) {
  const d = new Date(iso || "");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function cpOpenDecision(o) { return !o.decision || o.decision === "À décider"; }

/* Un risque immédiat donne une action prioritaire ou un signal de gravité haute. */
const cpApplyDecisionBase = applyGembaDecision;
applyGembaDecision = function (g, observation) {
  const out = cpApplyDecisionBase.apply(this, arguments);
  if (observation.urgent) {
    const a = observation.action_id && data.actions.find((x) => x.id === observation.action_id);
    if (a && a.priority !== "Critique") a.priority = "Haute";
    const s = observation.signal_id && data.signals.find((x) => x.id === observation.signal_id);
    if (s && s.severity === "À qualifier") s.severity = "Haute";
  }
  return out;
};
/* Les risques immédiats se trient en premier. */
const cpSortItemsBase = jnSortItems;
jnSortItems = function (gid = null) {
  const rank = (it) => {
    const g = (data.gembas || []).find((x) => x.id === it.gid), o = g && gembaObservations(g).find((x) => x.id === it.oid);
    return o?.urgent ? 0 : 1;
  };
  return cpSortItemsBase(gid).map((it, i) => [rank(it), i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
};
const cpSuiteBase = jnSuite;
jnSuite = function (o) {
  if ((o.kind || "fait") === "positif" && o.decision === "Conforme") return { cls: "none", text: "Point fort" };
  return cpSuiteBase(o);
};
const cpSortRenderBase = jnSortRender;
jnSortRender = function () {
  const out = cpSortRenderBase.apply(this, arguments);
  const cur = state.jnSort && jnSortCurrent(), card = $("modalContent")?.querySelector(".jn-sort-card");
  if (cur && card) {
    const k = cpKind(cur.o), tags = `${cur.o.urgent ? '<span class="cp-tag urgent">Risque immédiat</span>' : ""}${k[0] !== "fait" ? `<span class="cp-tag kind-${k[0]}">${esc(k[1])}</span>` : ""}`;
    if (tags) card.insertAdjacentHTML("afterbegin", `<span class="cp-obs-tags">${tags}</span>`);
  }
  return out;
};

function cpTags(o) {
  const k = cpKind(o);
  return `<span class="cp-obs-tags">${o.urgent ? '<span class="cp-tag urgent">Risque immédiat</span>' : ""}${k[0] !== "fait" ? `<span class="cp-tag kind-${k[0]}">${esc(k[1])}</span>` : ""}${jnFam(o.category)}${o.noted_at ? `<span class="cp-time">${esc(cpTime(o.noted_at))}</span>` : ""}</span>`;
}
jnObsCard = function (g, o, writable) {
  const s = jnSuite(o), pics = cpPhotos(o);
  return `<button type="button" class="jn-obs cp-obs ${o.urgent && cpOpenDecision(o) ? "urgent" : ""}" data-jn-obs="${esc(o.id)}" ${writable ? "" : "disabled"}>
    <span class="jn-obs-main">${cpTags(o)}<span class="jn-obs-fact">${esc(o.fact)}</span><span class="jn-suite ${s.cls}">${esc(s.text)}</span></span>
    ${pics.length ? `<span class="cp-thumbs">${pics.map((p) => phImg(p, "jn-thumb", "")).join("")}</span>` : ""}</button>`;
};
jnGembaRow = function (g) {
  const obs = gembaObservations(g), todo = jnToSort(g).length, pic = obs.flatMap(cpPhotos)[0], urgent = obs.filter((o) => o.urgent && cpOpenDecision(o)).length;
  return `<button type="button" class="jn-grow" data-jn-open="${esc(g.id)}" data-search-row>
    <span class="jn-grow-main"><span class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(shortDate(g.created_at))}${g.author ? " · " + esc(g.author) : ""}</span><b>${esc(g.zone || "Zone à préciser")}</b>
      ${g.objective ? `<span class="hint">${esc(g.objective)}</span>` : ""}
      <span class="jn-grow-meta">${jnPlural(obs.length, "note", "notes")}${urgent ? ` · <em class="cp-bad">${jnPlural(urgent, "risque immédiat", "risques immédiats")}</em>` : ""}${todo ? ` · <em>${todo} à trier</em>` : ""}${g.review_date && g.status !== "Clos" && g.visited_at ? ` · retour ${esc(shortDate(g.review_date))}` : ""}</span></span>
    ${pic ? phImg(pic, "jn-thumb", "") : ""}</button>`;
};

/* ---------- Calepin : une note ---------- */

jnConstat = function (gid, oid = null, preset = null) {
  const g = (data.gembas || []).find((x) => x.id === gid);
  if (!g || role().readonly || !allowedSite(g.site_id, true) || g.status === "Clos") return;
  const old = oid ? gembaObservations(g).find((o) => o.id === oid) : null;
  const fam = old?.category || state.jnLastFamily || "";
  const extra = old && (old.operator || old.standard || old.gap || old.hypothesis);
  const linked = old && [old.action_id, old.signal_id, old.problem_id].find(Boolean);
  let kind = cpKind(old || preset || {})[0], urgent = !!(old?.urgent || preset?.urgent), busy = 0;
  const photos = old ? cpPhotos(old) : (preset?.photos || []).filter(Boolean).slice(0, CP_MAX_PHOTOS);
  const k0 = cpKind({ kind });
  modal(old ? "Note du Gemba" : "Nouvelle note", `<form id="jnObsForm" class="jn-form cp-form">
    <p class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(g.zone || "")} · ${jnPlural(gembaObservations(g).length, "note", "notes")}</p>
    <div class="filters cp-kinds" role="group" aria-label="Nature de la note">${CP_KINDS.map(([k, l]) => `<button type="button" class="chip cp-kind kind-${k} ${k === kind ? "active" : ""}" data-cp-kind="${k}" aria-pressed="${k === kind}">${esc(l)}</button>`).join("")}</div>
    <label class="field"><span id="cpFactLabel">${esc(k0[2])}</span><textarea id="jnFact" rows="3" required placeholder="${esc(k0[3])}">${esc(old?.fact || "")}</textarea></label>
    <div class="cp-photos" id="cpPhotos" aria-live="polite"></div>
    <input type="file" id="cpCam" accept="image/*" capture="environment" hidden>
    <input type="file" id="jnPhoto" accept="image/jpeg,image/png,image/webp" multiple hidden>
    <button type="button" class="cp-urgent ${urgent ? "active" : ""}" data-cp-urgent aria-pressed="${urgent}"><b>Risque immédiat</b><span>À sécuriser ou traiter tout de suite</span></button>
    <div class="ap-field"><span class="metric-label">Famille</span><div class="filters jn-fams">${SIGNAL_TYPES.map((f) => `<button type="button" class="chip ${f === fam ? "active" : ""}" data-jn-fam="${esc(f)}" aria-pressed="${f === fam}">${esc(f)}</button>`).join("")}</div><input type="hidden" id="jnFamValue" value="${esc(fam)}"></div>
    <details class="jn-more" ${extra ? "open" : ""}><summary>Compléter (facultatif)</summary>
      <label class="field">Ce que dit l’équipe<textarea id="jnOperator" rows="2" placeholder="Ce qui aide ou empêche de bien travailler">${esc(old?.operator || "")}</textarea></label>
      <label class="field">Ce qui est attendu (standard)<input id="jnStandard" value="${esc(old?.standard || "")}"></label>
      <label class="field">Écart constaté<input id="jnGap" value="${esc(old?.gap || "")}"></label>
      <label class="field">Hypothèse à vérifier<input id="jnHypothesis" value="${esc(old?.hypothesis || "")}"></label>
      ${old ? `<button type="button" class="btn ghost small" data-jn-full>Formulaire complet</button>` : ""}</details>
    ${old ? `<p class="jn-suite-line">Suite : <span class="jn-suite ${jnSuite(old).cls}">${esc(jnSuite(old).text)}</span>${linked ? " " + recordLink(linked, "Ouvrir") : ""}</p>` : ""}
    <div class="form-actions">${old ? "" : '<button type="button" class="btn jn-big" data-jn-save="next">Enregistrer et suivant</button>'}<button type="button" class="btn ${old ? "" : "secondary"}" data-jn-save="done">${old ? "Enregistrer" : "Enregistrer et revenir"}</button><button type="button" class="btn ghost" data-jn-back="${esc(g.id)}">Annuler</button></div></form>`);
  const root = $("modalContent"), form = $("jnObsForm");
  const alive = () => document.getElementById("jnObsForm") === form;
  const drawPhotos = () => {
    const box = alive() && $("cpPhotos");
    if (!box) return;
    const room = CP_MAX_PHOTOS - photos.length - busy;
    box.innerHTML = photos.map((p, i) => `<figure class="cp-ph">${phImg(p, "cp-ph-img", `Photo ${i + 1}`)}<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-cp-annotate="${i}">Annoter</button><button type="button" class="cp-ph-btn" data-cp-remove="${i}" aria-label="Retirer la photo ${i + 1}">×</button></span></figure>`).join("")
      + (busy ? '<div class="cp-ph cp-ph-busy" role="status">Photo en préparation…</div>' : "")
      + (room > 0 ? `<button type="button" class="cp-ph-add" data-cp-cam><b>Photo</b><span>${photos.length ? "Ajouter" : "Appareil photo"}</span></button><button type="button" class="cp-ph-add quiet" data-cp-lib><b>Galerie</b><span>Choisir</span></button>` : "");
    box.querySelector("[data-cp-cam]")?.addEventListener("click", () => $("cpCam").click());
    box.querySelector("[data-cp-lib]")?.addEventListener("click", () => $("jnPhoto").click());
    box.querySelectorAll("[data-cp-remove]").forEach((b) => (b.onclick = () => { photos.splice(Number(b.dataset.cpRemove), 1); modalDirty = true; drawPhotos(); }));
    box.querySelectorAll("[data-cp-annotate]").forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.cpAnnotate);
      cpAnnotate(photos[i], (ref) => { if (alive()) { photos[i] = ref; modalDirty = true; drawPhotos(); } });
    }));
  };
  const addFiles = async (files) => {
    const list = [...(files || [])].slice(0, Math.max(0, CP_MAX_PHOTOS - photos.length - busy));
    for (const file of list) {
      busy += 1; drawPhotos();
      try { const ref = await phStore(await imageDataUrl(file)); if (ref && photos.length < CP_MAX_PHOTOS) photos.push(ref); modalDirty = true; }
      catch (error) { toast(error.message); }
      finally { busy -= 1; drawPhotos(); }
    }
  };
  ["cpCam", "jnPhoto"].forEach((id) => ($(id).onchange = () => { const files = [...($(id).files || [])]; $(id).value = ""; addFiles(files); }));
  drawPhotos();
  root.querySelectorAll("[data-cp-kind]").forEach((b) => (b.onclick = () => {
    kind = b.dataset.cpKind;
    root.querySelectorAll("[data-cp-kind]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
    const k = cpKind({ kind });
    $("cpFactLabel").textContent = k[2];
    $("jnFact").placeholder = k[3];
  }));
  root.querySelector("[data-cp-urgent]").onclick = (e) => {
    urgent = !urgent;
    e.currentTarget.classList.toggle("active", urgent);
    e.currentTarget.setAttribute("aria-pressed", urgent);
    if (urgent && !$("jnFamValue").value) root.querySelector('[data-jn-fam="Sécurité"]')?.click();
  };
  root.querySelectorAll("[data-jn-fam]").forEach((b) => (b.onclick = () => {
    const on = $("jnFamValue").value !== b.dataset.jnFam;
    root.querySelectorAll("[data-jn-fam]").forEach((x) => { const pick = on && x === b; x.classList.toggle("active", pick); x.setAttribute("aria-pressed", pick); });
    $("jnFamValue").value = on ? b.dataset.jnFam : "";
  }));
  root.querySelector("[data-jn-full]")?.addEventListener("click", () => gembaObservationForm(g.id, old.id));
  root.querySelector("[data-jn-back]").onclick = () => { modalDirty = false; openGemba(g.id); };
  const save = (next) => {
    if (busy) return toast("Photo en préparation, un instant.");
    const fact = $("jnFact").value.trim();
    if (!fact) { $("jnFact").focus(); return toast("Notez ce que vous voyez, une phrase suffit."); }
    const category = $("jnFamValue").value || "Autre";
    let decision = old?.decision || "À décider";
    if (!linked) {
      if (kind === "positif" && cpOpenDecision({ decision })) decision = "Conforme";
      else if (kind !== "positif" && old && (old.kind || "fait") === "positif" && decision === "Conforme") decision = "À décider";
    }
    const obs = { ...(old || {}), id: old?.id || uid("OBS"), fact, category, kind, urgent, photos: photos.slice(), photo: photos[0] || "", operator: $("jnOperator").value.trim(), standard: $("jnStandard").value.trim(), gap: $("jnGap").value.trim(), hypothesis: $("jnHypothesis").value.trim(), decision, noted_at: old?.noted_at || now() };
    if (!commitData(() => {
      const row = data.gembas.find((x) => x.id === gid);
      row.observations = gembaObservations(row);
      const i = row.observations.findIndex((o) => o.id === obs.id);
      if (i >= 0) row.observations[i] = obs; else row.observations.push(obs);
      row.updated_at = now();
      recordHistory(row, old ? "Note modifiée" : "Note prise", fact);
    })) return;
    state.jnLastFamily = category;
    modalDirty = false;
    render();
    if (next) { toast("Noté. La suivante :"); jnConstat(gid); }
    else { toast("Note enregistrée."); openGemba(gid); }
  };
  root.querySelectorAll("[data-jn-save]").forEach((b) => (b.onclick = () => save(b.dataset.jnSave === "next")));
  form.onsubmit = (e) => { e.preventDefault(); save(!old); };
  if (!old) setTimeout(() => $("jnFact")?.focus(), 0);
};

/* ---------- Annoter une photo au doigt ---------- */

function cpAnnotate(value, done) {
  const src = phSrc(value);
  if (!src) return toast("Photo en cours de chargement : réessayez dans un instant.");
  const host = $("modalContent");
  host.querySelector(".cp-draw")?.remove();
  const box = document.createElement("div");
  box.className = "cp-draw";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Annoter la photo");
  const colors = [["#e5322d", "Rouge"], ["#ffd400", "Jaune"], ["#ffffff", "Blanc"]];
  box.innerHTML = `<div class="cp-draw-bar"><b>Entourez ce qui compte</b><span class="cp-draw-colors">${colors.map(([c, l], i) => `<button type="button" class="cp-color ${i ? "" : "active"}" data-cp-color="${c}" style="background:${c}" aria-label="${l}" aria-pressed="${!i}"></button>`).join("")}</span></div>
    <div class="cp-draw-stage"><canvas aria-label="Photo à annoter"></canvas></div>
    <div class="cp-draw-bar cp-draw-actions"><button type="button" class="btn ghost" data-cp-undo>Annuler le trait</button><button type="button" class="btn secondary" data-cp-cancel>Fermer</button><button type="button" class="btn" data-cp-ok>Valider</button></div>`;
  host.append(box);
  const canvas = box.querySelector("canvas"), ctx = canvas.getContext("2d"), img = new Image(), strokes = [];
  let color = colors[0][0], width = 8, cur = null;
  const draw = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      if (!s.pts.length) continue;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      s.pts.forEach(([x, y]) => ctx.lineTo(x, y));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      ctx.stroke();
    }
  };
  img.onload = () => { canvas.width = img.naturalWidth || 800; canvas.height = img.naturalHeight || 600; width = Math.max(6, Math.round(Math.max(canvas.width, canvas.height) / 90)); draw(); };
  img.src = src;
  const point = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height]; };
  canvas.onpointerdown = (e) => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); cur = { color, width, pts: [point(e)] }; strokes.push(cur); draw(); };
  canvas.onpointermove = (e) => { if (!cur) return; e.preventDefault(); cur.pts.push(point(e)); draw(); };
  canvas.onpointerup = canvas.onpointercancel = () => { cur = null; };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
  window.addEventListener("keydown", onKey, true);
  const close = () => { window.removeEventListener("keydown", onKey, true); box.remove(); };
  box.querySelectorAll("[data-cp-color]").forEach((b) => (b.onclick = () => {
    color = b.dataset.cpColor;
    box.querySelectorAll("[data-cp-color]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
  }));
  box.querySelector("[data-cp-undo]").onclick = () => { strokes.pop(); draw(); };
  box.querySelector("[data-cp-cancel]").onclick = close;
  box.querySelector("[data-cp-ok]").onclick = async () => {
    if (!strokes.length) return close();
    let url = canvas.toDataURL("image/jpeg", 0.75);
    if (url.length > 850000) url = canvas.toDataURL("image/jpeg", 0.55);
    const ref = await phStore(url);
    close();
    if (ref) done(ref);
  };
  setTimeout(() => box.querySelector("[data-cp-ok]")?.focus(), 0);
}

/* ---------- Calepin : la visite ---------- */

function cpCounts(obs) {
  const n = (k) => obs.filter((o) => (o.kind || "fait") === k).length, photos = obs.reduce((s, o) => s + cpPhotos(o).length, 0);
  return [[n("fait"), "constat", "constats"], [n("risque"), "risque à vérifier", "risques à vérifier"], [n("question"), "question", "questions"], [n("piste"), "piste", "pistes"], [n("positif"), "point fort", "points forts"], [photos, "photo", "photos"]]
    .filter(([v]) => v).map(([v, one, many]) => jnPlural(v, one, many)).join(" · ");
}
openGemba = function (id) {
  const g = (data.gembas || []).find((x) => x.id === id);
  if (!g || !allowedSite(g.site_id)) return;
  const obs = gembaObservations(g), writable = !role().readonly && allowedSite(g.site_id, true) && g.status !== "Clos", todo = jnToSort(g).length;
  const urgent = obs.filter((o) => o.urgent && cpOpenDecision(o)).length;
  const main = [];
  if (writable && todo) main.push(`<button type="button" class="btn dark" data-jn-sort="${esc(g.id)}">Trier ${jnPlural(todo, "note", "notes")}</button>`);
  if (obs.length) main.push(`<button type="button" class="btn secondary" data-cp-report="${esc(g.id)}">Compte rendu</button>`);
  if (writable && !g.visited_at) main.push(`<button type="button" class="btn secondary" data-jn-finish="${esc(g.id)}">Terminer la visite</button>`);
  if (writable && g.visited_at) main.push(`<button type="button" class="btn secondary" data-jn-verify="${esc(g.id)}">Retour terrain</button>`);
  modal(`${g.id} · Gemba`, `<div class="jn-visit cp-visit">
    <p class="jn-where">${esc(getSiteName(g.site_id))} · ${esc(shortDate(g.created_at))}${g.author ? " · " + esc(g.author) : ""}</p>
    <h3 class="jn-zone">${esc(g.zone || "Zone à préciser")}</h3>
    ${g.objective ? `<p class="jn-question">${esc(g.objective)}</p>` : ""}
    ${g.people ? `<p class="cp-people">Avec ${esc(g.people)}</p>` : ""}
    <p class="jn-state">${esc(jnVisitState(g))}</p>
    ${writable ? `<div class="cp-capture"><button type="button" class="btn jn-big jn-add" data-jn-constat="${esc(g.id)}">+ Note</button><button type="button" class="btn jn-big dark cp-snap" data-cp-snap="${esc(g.id)}">Photo d’abord</button><input type="file" id="cpSnap" accept="image/*" capture="environment" hidden></div>` : ""}
    ${urgent ? `<p class="cp-alert" role="status">${jnPlural(urgent, "risque immédiat à traiter", "risques immédiats à traiter")}</p>` : ""}
    ${obs.length ? `<p class="cp-count">${esc(cpCounts(obs))}</p>` : ""}
    <div class="jn-obs-list">${obs.map((o) => jnObsCard(g, o, writable)).join("") || '<p class="jn-empty">Rien de noté pour l’instant. Une photo et une phrase suffisent.</p>'}</div>
    ${main.length ? `<div class="jn-buttons">${main.join("")}</div>` : ""}
    <details class="jn-more"><summary>Plus</summary>
      <label class="field cp-people-field">Avec qui ?<input id="cpPeople" value="${esc(g.people || "")}" placeholder="Personnes rencontrées, équipe, guide" ${writable ? "" : "disabled"}></label>
      <div class="jn-buttons">${writable ? `<button type="button" class="btn secondary small" data-jn-edit="${esc(g.id)}">Lieu, question et retour prévu</button>` : ""}<button type="button" class="btn ghost small" data-print>Imprimer / PDF</button></div>
      ${g.verification ? `<section class="verification-box section"><h3>Retour terrain · ${esc(g.verification.result)}</h3><p>${esc(g.verification.evidence)}</p><p class="hint">${esc(g.verification.by)} · ${shortDate(g.verification.date)}</p></section>` : ""}
      ${historyView(g)}
    </details></div>`);
  const root = $("modalContent"), ctx = root.querySelector(".os-context");
  if (ctx) root.querySelector(".jn-more")?.append(ctx);
  root.querySelectorAll("[data-jn-obs]").forEach((b) => (b.onclick = () => jnConstat(g.id, b.dataset.jnObs)));
  root.querySelectorAll("[data-jn-finish]").forEach((b) => (b.onclick = () => {
    if (!gembaObservations(g).length) return toast("Notez au moins une chose avant de terminer la visite.");
    if (jnToSort(g).length) { toast("Chaque note reçoit une suite avant de terminer : triez-les."); return jnSort(g.id); }
    finishGemba(g.id);
  }));
  root.querySelectorAll("[data-jn-verify]").forEach((b) => (b.onclick = () => verifyGemba(g.id)));
  root.querySelectorAll("[data-jn-edit]").forEach((b) => (b.onclick = () => jnGembaFormBase(g)));
  root.querySelectorAll("[data-cp-report]").forEach((b) => (b.onclick = () => cpReport(g.id)));
  const snap = $("cpSnap");
  root.querySelector("[data-cp-snap]")?.addEventListener("click", () => snap.click());
  if (snap) snap.onchange = async () => {
    const file = snap.files?.[0];
    snap.value = "";
    if (!file) return;
    toast("Photo en préparation…");
    try { const ref = await phStore(await imageDataUrl(file)); if (document.getElementById("cpSnap") === snap) jnConstat(g.id, null, { photos: ref ? [ref] : [] }); }
    catch (error) { toast(error.message); }
  };
  const people = $("cpPeople");
  if (people && writable) people.onchange = () => {
    const value = people.value.trim();
    if (!commitData(() => { const row = data.gembas.find((x) => x.id === g.id); row.people = value; row.updated_at = now(); })) return;
    modalDirty = false;
    const line = root.querySelector(".cp-people");
    if (line) line.textContent = value ? `Avec ${value}` : "";
    else if (value) root.querySelector(".jn-zone")?.insertAdjacentHTML("afterend", `<p class="cp-people">Avec ${esc(value)}</p>`);
    toast("Participants enregistrés.");
  };
};

/* ---------- Compte rendu de visite ---------- */

function cpSuiteText(o) {
  if (cpOpenDecision(o)) return "";
  if (o.decision === "Action") {
    const a = data.actions.find((x) => x.id === o.action_id);
    return a ? `Action ${a.id} : ${a.title} · ${a.owner || "à désigner"} · ${a.due_date ? shortDate(a.due_date) : "sans date"}` : "Action";
  }
  if (o.decision === "Signal") return `Signal ${o.signal_id || ""}`.trim();
  if (["A3", "8D", "QRQC"].includes(o.decision)) return `${o.decision} ${o.problem_id || ""}`.trim();
  return "";
}
function cpReportParts(g) {
  const obs = gembaObservations(g), kindOf = (o) => o.kind || "fait";
  const urgent = obs.filter((o) => o.urgent), rest = obs.filter((o) => !o.urgent);
  const facts = rest.filter((o) => ["fait", "risque"].includes(kindOf(o)));
  const fams = [...new Set([...SIGNAL_TYPES, ...facts.map((o) => o.category || "Autre")])].map((f) => [f, facts.filter((o) => (o.category || "Autre") === f)]).filter(([, l]) => l.length);
  return {
    obs, urgent, fams,
    strong: rest.filter((o) => kindOf(o) === "positif"),
    questions: rest.filter((o) => kindOf(o) === "question"),
    ideas: rest.filter((o) => kindOf(o) === "piste"),
    actions: obs.map((o) => o.action_id && data.actions.find((a) => a.id === o.action_id)).filter(Boolean),
    others: obs.filter((o) => o.signal_id || o.problem_id),
  };
}
const CP_REPORT_NOTE = "Observations de terrain à confirmer avec les équipes. Elles distinguent les faits, les risques à vérifier, les questions et les pistes : ce n’est pas un plan d’action définitif.";
function cpReportText(g) {
  const p = cpReportParts(g), lines = [];
  const item = (o) => {
    lines.push(`- ${(o.kind || "fait") === "risque" ? "Risque à vérifier : " : ""}${o.fact}`);
    if (o.operator) lines.push(`  L’équipe : « ${o.operator} »`);
    if (o.hypothesis) lines.push(`  Hypothèse à vérifier : ${o.hypothesis}`);
    const s = cpSuiteText(o);
    if (s) lines.push(`  → ${s}`);
  };
  const block = (title, list) => { if (!list.length) return; lines.push("", title.toUpperCase()); list.forEach(item); };
  lines.push(`Compte rendu de Gemba · ${getSiteName(g.site_id)} · ${g.zone || ""}`, cpLongDate(g.created_at));
  if (g.author || g.people) lines.push([g.author ? `Animé par ${g.author}` : "", g.people ? `avec ${g.people}` : ""].filter(Boolean).join(", "));
  if (g.objective) lines.push(`Question : ${g.objective}`);
  block("Risques immédiats", p.urgent);
  block("Points forts", p.strong);
  if (p.fams.length) { lines.push("", "CONSTATS"); p.fams.forEach(([f, l]) => { lines.push(f); l.forEach(item); }); }
  block("Questions ouvertes", p.questions);
  block("Pistes à étudier", p.ideas);
  if (p.actions.length) { lines.push("", "ACTIONS DÉCIDÉES"); p.actions.forEach((a) => lines.push(`- ${a.title} · ${a.owner || "à désigner"} · ${a.due_date ? shortDate(a.due_date) : "sans date"} · ${a.status}`)); }
  lines.push("", CP_REPORT_NOTE);
  return lines.join("\n");
}
function cpReport(gid) {
  const g = (data.gembas || []).find((x) => x.id === gid);
  if (!g || !allowedSite(g.site_id)) return;
  const p = cpReportParts(g);
  const item = (o) => {
    const pics = cpPhotos(o), s = cpSuiteText(o);
    return `<li class="cp-r-item"><div class="cp-r-text"><p>${(o.kind || "fait") === "risque" ? '<b class="cp-r-k">Risque à vérifier · </b>' : ""}${esc(o.fact)}</p>${o.operator ? `<p class="cp-r-sub">L’équipe : « ${esc(o.operator)} »</p>` : ""}${o.hypothesis ? `<p class="cp-r-sub">Hypothèse à vérifier : ${esc(o.hypothesis)}</p>` : ""}${s ? `<p class="cp-r-suite">→ ${esc(s)}</p>` : ""}</div>${pics.length ? `<div class="cp-r-pics">${pics.map((ph) => phImg(ph, "cp-r-img", "")).join("")}</div>` : ""}</li>`;
  };
  const block = (title, list, cls = "") => (list.length ? `<section class="cp-r-sec ${cls}"><h4>${esc(title)}</h4><ul>${list.map(item).join("")}</ul></section>` : "");
  const actions = p.actions.length ? `<section class="cp-r-sec"><h4>Actions décidées</h4><table class="cp-r-table"><thead><tr><th>Quoi</th><th>Qui</th><th>Quand</th><th>État</th></tr></thead><tbody>${p.actions.map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.owner || "À désigner")}</td><td>${a.due_date ? esc(shortDate(a.due_date)) : "—"}</td><td>${esc(a.status)}</td></tr>`).join("")}</tbody></table></section>` : "";
  const share = typeof navigator.share === "function";
  modal(`${g.id} · Compte rendu`, `<article class="cp-report">
    <header class="cp-r-head"><p class="cp-r-kicker">Compte rendu de Gemba</p><h3>${esc(getSiteName(g.site_id))} · ${esc(g.zone || "")}</h3>
      <p>${esc(cpLongDate(g.created_at))}${g.author ? ` · animé par ${esc(g.author)}` : ""}${g.people ? `, avec ${esc(g.people)}` : ""}</p>
      ${g.objective ? `<p class="cp-r-q">Question : ${esc(g.objective)}</p>` : ""}
      <p class="cp-r-count">${esc(cpCounts(p.obs))}</p></header>
    ${block("Risques immédiats", p.urgent, "urgent")}
    ${block("Points forts", p.strong, "strong")}
    ${p.fams.map(([f, l]) => block(`Constats · ${f}`, l)).join("")}
    ${block("Questions ouvertes", p.questions)}
    ${block("Pistes à étudier", p.ideas)}
    ${actions}
    <p class="cp-r-note">${esc(CP_REPORT_NOTE)}</p>
  </article>
  <div class="form-actions"><button type="button" class="btn" data-cp-copy>Copier le texte</button>${share ? '<button type="button" class="btn secondary" data-cp-share>Partager</button>' : ""}<button type="button" class="btn secondary" data-print>Imprimer / PDF</button><button type="button" class="btn ghost" data-jn-open="${esc(g.id)}">Revenir à la visite</button></div>`);
  const root = $("modalContent"), text = cpReportText(g);
  root.querySelector("[data-cp-copy]").onclick = () => cpCopy(text, "Texte copié : collez-le dans un mail ou un message.");
  root.querySelector("[data-cp-share]")?.addEventListener("click", () => navigator.share({ title: `Gemba · ${getSiteName(g.site_id)} · ${g.zone || ""}`, text }).catch(() => {}));
}
function cpCopy(text, done) {
  const fallback = () => {
    const host = $("modalContent");
    host.querySelector(".cp-copy-area")?.remove();
    host.insertAdjacentHTML("beforeend", `<label class="field cp-copy-area">Sélectionnez et copiez le texte<textarea readonly rows="10">${esc(text)}</textarea></label>`);
    const area = host.querySelector(".cp-copy-area textarea");
    area.focus(); area.select();
  };
  try { navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(() => toast(done), fallback) : fallback(); } catch { fallback(); }
}

/* ---------- Accueil, liste, hors ligne, installation ---------- */

const cpWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = cpWatchBase();
  const cur = state.role !== "dg" && jnCanGemba() ? jnCurrentVisit() : null;
  if (!cur) return base;
  const n = gembaObservations(cur).length;
  const row = `<button type="button" class="jn-row cp-now" data-jn-open="${esc(cur.id)}"><span class="jn-row-main"><span class="jn-tag tone-progress">Gemba en cours</span><b>${esc(cur.zone || "Visite")} · ${esc(getSiteName(cur.site_id))}</b><span class="hint">${jnPlural(n, "note", "notes")} · reprendre le calepin</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace('<div class="jn-rows">', `<div class="jn-rows">${row}`);
};

let cpInstallPrompt = null;
function cpStandalone() { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } }
function cpTouch() { try { return matchMedia("(pointer: coarse)").matches; } catch { return false; } }
function cpIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
window.addEventListener("beforeinstallprompt", (e) => {
  if (!cpTouch()) return;
  e.preventDefault();
  cpInstallPrompt = e;
  if (state.view === "terrain" && $("modal")?.hidden) render();
});
window.addEventListener("appinstalled", () => { cpInstallPrompt = null; toast("Calepin installé sur l’écran d’accueil."); });
function cpInstallLine() {
  if (cpStandalone() || !cpTouch()) return "";
  if (cpInstallPrompt) return `<button type="button" class="jn-line cp-install" data-cp-install>Installer le calepin sur ce téléphone<span>Installer</span></button>`;
  if (cpIOS()) return '<p class="cp-tip"><b>Sur iPhone :</b> bouton Partager, puis « Sur l’écran d’accueil ». Le calepin s’ouvre alors comme une appli, hors ligne, et garde vos photos.</p>';
  return "";
}
const cpGembaListBase = renderGembaList;
renderGembaList = function () {
  const n = phRefs(JSON.stringify(data.gembas || [])).size + (data.gembas || []).reduce((s, g) => s + gembaObservations(g).filter((o) => o.photo && !phIsRef(o.photo)).length, 0);
  return `${cpInstallLine()}${cpGembaListBase()}<p class="cp-foot">Tout est enregistré sur cet appareil, même sans réseau${n ? ` (${jnPlural(n, "photo", "photos")})` : ""}. Exportez une sauvegarde depuis Compte avant de changer de téléphone. <button type="button" class="jn-link" data-cp-note>Une gêne dans l’appli ? Notez-la</button></p>`;
};

function cpNetBadge() {
  let el = document.getElementById("cpNet");
  if (!el) {
    el = document.createElement("div");
    el.id = "cpNet"; el.className = "cp-net"; el.setAttribute("role", "status"); el.hidden = true;
    el.textContent = "Hors ligne · tout reste enregistré sur cet appareil";
    document.body.append(el);
  }
  el.hidden = navigator.onLine !== false;
}
window.addEventListener("online", () => { cpNetBadge(); toast("De nouveau en ligne."); });
window.addEventListener("offline", cpNetBadge);

/* ---------- Remarques sur l'appli ---------- */

const CP_NOTES_KEY = "biaAppNotes", CP_NOTE_TYPES = ["Ça gêne", "Il manque", "En trop", "Bien vu"];
let cpNoteWhere = "";
function cpNotes() {
  try { const v = JSON.parse(localStorage.getItem(CP_NOTES_KEY) || "[]"); return Array.isArray(v) ? v.filter((n) => n && typeof n.text === "string" && n.id) : []; } catch { return []; }
}
function cpSetNotes(list) {
  try { localStorage.setItem(CP_NOTES_KEY, JSON.stringify(list.slice(-200))); return true; }
  catch { toast("Remarque non enregistrée : espace local plein."); return false; }
}
function cpScreen() {
  const nav = (typeof NAV !== "undefined" ? NAV : []).find((n) => n.id === state.view)?.label || state.view;
  const open = !$("modal").hidden && $("modalTitle")?.textContent;
  return [nav, open && !/^Créer/.test(open) ? open : ""].filter(Boolean).join(" · ");
}
function cpNotesText(list) {
  return [`Remarques sur BIA Lean OS ${typeof APP_VERSION !== "undefined" ? APP_VERSION : ""}`.trim(), ...list.map((n) => `- ${shortDate(n.at)} · ${n.type} · ${n.where || "écran non précisé"} : ${n.text}`)].join("\n");
}
function cpNoteForm(where = cpNoteWhere || cpScreen()) {
  const list = cpNotes();
  modal("Remarque sur l’appli", `<form id="cpNoteForm" class="jn-form">
    <p class="jn-lead">Ce qui gêne, ce qui manque, ce qui est en trop. Une phrase suffit : la liste sert à préparer la prochaine version.</p>
    <div class="filters" role="group" aria-label="Type de remarque">${CP_NOTE_TYPES.map((t, i) => `<button type="button" class="chip ${i ? "" : "active"}" data-cp-note-type="${esc(t)}" aria-pressed="${!i}">${esc(t)}</button>`).join("")}</div>
    <label class="field">Votre remarque<textarea id="cpNoteText" rows="3" placeholder="Ex. trop de clics pour ajouter une photo"></textarea></label>
    <label class="field">Écran concerné<input id="cpNoteWhere" value="${esc(where)}"></label>
    <div class="form-actions"><button class="btn">Noter</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div></form>
    <section class="cp-notes section"><div class="section-title"><h3>Remarques notées · ${list.length}</h3>${list.length ? '<button type="button" class="btn secondary small" data-cp-notes-copy>Copier la liste</button>' : ""}</div>
    ${list.length ? `<p class="hint">Copiez la liste et collez-la dans la conversation avec Claude pour la prochaine version.</p><ul class="cp-note-list">${list.slice().reverse().map((n) => `<li><span class="cp-note-meta">${esc(shortDate(n.at))} · ${esc(n.type)}${n.where ? ` · ${esc(n.where)}` : ""}</span><span>${esc(n.text)}</span><button type="button" class="cp-ph-btn" data-cp-note-del="${esc(n.id)}" aria-label="Supprimer la remarque">×</button></li>`).join("")}</ul>` : '<p class="jn-empty">Aucune remarque pour l’instant.</p>'}</section>`);
  const root = $("modalContent");
  let type = CP_NOTE_TYPES[0];
  root.querySelectorAll("[data-cp-note-type]").forEach((b) => (b.onclick = () => {
    type = b.dataset.cpNoteType;
    root.querySelectorAll("[data-cp-note-type]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
  }));
  $("cpNoteForm").onsubmit = (e) => {
    e.preventDefault();
    const text = $("cpNoteText").value.trim();
    if (!text) { $("cpNoteText").focus(); return toast("Écrivez la remarque, une phrase suffit."); }
    if (!cpSetNotes([...cpNotes(), { id: uid("RQ"), at: now(), type, where: $("cpNoteWhere").value.trim(), text }])) return;
    modalDirty = false;
    toast("Remarque notée. Merci.");
    cpNoteForm($("cpNoteWhere").value.trim());
  };
  root.querySelector("[data-cp-notes-copy]")?.addEventListener("click", () => cpCopy(cpNotesText(cpNotes()), "Liste copiée : collez-la dans la conversation avec Claude."));
  root.querySelectorAll("[data-cp-note-del]").forEach((b) => (b.onclick = () => { cpSetNotes(cpNotes().filter((n) => n.id !== b.dataset.cpNoteDel)); cpNoteForm($("cpNoteWhere").value.trim()); }));
  setTimeout(() => $("cpNoteText")?.focus(), 0);
}
const cpCreateMenuBase = openCreateMenu;
openCreateMenu = function () {
  cpNoteWhere = cpScreen();
  cpCreateMenuBase.apply(this, arguments);
  const menu = $("modalContent")?.querySelector(".create-menu");
  if (!menu) return;
  menu.insertAdjacentHTML("beforeend", `<button class="create-choice cp-note-choice" type="button" data-cp-note><span aria-hidden="true">✎</span><b>Remarque sur l’appli</b><small>Ce qui gêne ou manque, pour la prochaine version</small></button>`);
  menu.querySelector("[data-cp-note]").onclick = () => cpNoteForm();
};

/* ---------- Liaisons ---------- */

function cpBind(root = document) {
  root.querySelectorAll("[data-cp-note]").forEach((b) => { if (!b.onclick) b.onclick = () => cpNoteForm(); });
  root.querySelectorAll("[data-cp-report]").forEach((b) => { if (!b.onclick) b.onclick = () => cpReport(b.dataset.cpReport); });
  root.querySelectorAll("[data-cp-install]").forEach((b) => (b.onclick = async () => {
    const ev = cpInstallPrompt;
    if (!ev) return;
    cpInstallPrompt = null;
    try { ev.prompt(); await ev.userChoice; } catch {}
    render();
  }));
  phFill(root);
  cpNetBadge();
}
const cpOsBindBase = osBind;
osBind = function () { const out = cpOsBindBase.apply(this, arguments); cpBind(document); return out; };

/* 8.14 · La sauvegarde automatique d'une fenêtre (0,65 s après la dernière frappe) ne retire plus le curseur du champ :
 * les outils qui enregistrent « à la sortie du champ » appellent uxFlush(), qui ne quitte le champ qu'à la fermeture,
 * au changement d'écran ou quand l'appli passe en arrière-plan. */
let uxAutoSaving = false;
scheduleModalSave = function () {
  if (!modalSaver) return;
  clearTimeout(modalTimer);
  modalTimer = setTimeout(() => {
    let ok;
    uxAutoSaving = true;
    try { ok = modalSaver?.(); } finally { uxAutoSaving = false; }
    if (ok !== false) { modalDirty = false; const s = $("saveState"); if (s) s.textContent = "Enregistré sur cet appareil"; }
  }, 650);
};
function uxFlush() { if (!uxAutoSaving) document.activeElement?.blur?.(); }
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !$("modal")?.hidden && modalSaver) { clearTimeout(modalTimer); try { modalSaver(); } catch {} }
});
