"use strict";
/*
 * BIA Lean OS 8.14 · Ishikawa et 5 pourquoi refaits pour le terrain.
 *  Ishikawa : 1. Causes (post-it par famille 6M, sans juger, Entrée pour la suivante) ;
 *             2. Vérifier (chaque cause : comment la vérifier, résultat, photo, statut à vérifier / confirmée / écartée) ;
 *             3. Bilan (arête de poisson colorée, causes confirmées → 5 pourquoi ou action datée).
 *  5 pourquoi : un arbre, pas une seule ligne : plusieurs causes par niveau, chaque réponse vérifiée par un fait,
 *             cause racine choisie sur une feuille, contre-mesure → action ; bilan « relire à l'envers » avec « donc ».
 * Données : documents ISHIKAWA → structured_data.ik = { causes[{ id, fam, text, status, test, proof, photo, why_id, action_id }] } ;
 *           documents 5WHY → structured_data.why = { nodes[{ id, parent, text, status, proof, root, cm, who, when, action_id }], from? }.
 * Les anciennes rubriques texte (method… environment, tests ; why1…why5, root_cause, countermeasure) restent tenues à jour :
 * l'A3, le 8D et le QRQC les affichent toujours. Les actions portent origin_id = le document (collection indexée).
 */

const IK_FAM = [
  ["method", "Méthodes", "Mode opératoire, séquence, paramètres, standard absent ou pas suivi ?", "Standard"],
  ["machine", "Machines", "Usure, réglage, panne, outillage, maintenance ?", "Maintenance"],
  ["manpower", "Main-d’œuvre", "Formation, charge, relève, consignes, ergonomie ?", "Production"],
  ["material", "Matières", "Lot, fournisseur, stockage, humidité, dimensions ?", "Qualité"],
  ["measurement", "Mesures", "Contrôle, gabarit, étalonnage, échantillon, donnée fiable ?", "Qualité"],
  ["environment", "Milieu", "Température, humidité, poussière, éclairage, encombrement ?", "Autre"],
];
const IK_ST = [["verifier", "À vérifier"], ["confirmee", "Confirmée"], ["ecartee", "Écartée"]];
const WHY_ST = [["verifier", "À vérifier"], ["vrai", "Vérifié"], ["faux", "Faux"]];

function ikDoc(id, type) { const d = data.documents.find((x) => x.id === id && !x.archived_at); return d && (!type || d.type === type) ? d : null; }
function ikWritable(d) { return !!d && !role().readonly && allowedSite(d.site_id, true); }
function ikFam(k) { return IK_FAM.find((f) => f[0] === k) || IK_FAM[0]; }
function ikSplit(t) { return String(t || "").split(/\n|;|•/).map((s) => s.replace(/^[\s\-*✓✗?·]+/, "").trim()).filter(Boolean); }
function ikOf(d) {
  const v = d?.structured_data || {};
  if (v.ik) return { causes: [], ...v.ik };
  const causes = [];
  for (const [k] of IK_FAM) ikSplit(v[k]).forEach((text) => causes.push({ id: uid("C"), fam: k, text, status: "verifier", test: "", proof: "", photo: "" }));
  return { causes };
}
function whyOf(d) {
  const v = d?.structured_data || {};
  if (v.why) return { nodes: [], ...v.why };
  const nodes = [];
  let parent = null;
  for (const n of [1, 2, 3, 4, 5]) { const text = String(v[`why${n}`] || "").trim(); if (!text) continue; const id = uid("W"); nodes.push({ id, parent, text, status: "verifier", proof: "" }); parent = id; }
  const last = nodes.at(-1);
  if (last && (v.root_cause || v.countermeasure)) Object.assign(last, { root: true, proof: String(v.root_cause || "").trim(), cm: String(v.countermeasure || "").trim() });
  return { nodes };
}
function ikCounts(ik) { const c = { total: ik.causes.length, verifier: 0, confirmee: 0, ecartee: 0 }; ik.causes.forEach((x) => { c[x.status || "verifier"] += 1; }); return c; }
function ikSync(d) {
  const v = d.structured_data, ik = v.ik, rank = { confirmee: 0, verifier: 1 };
  for (const [k] of IK_FAM) v[k] = ik.causes.filter((c) => c.fam === k && c.status !== "ecartee").sort((a, b) => rank[a.status || "verifier"] - rank[b.status || "verifier"]).map((c) => `${c.status === "confirmee" ? "✓ " : ""}${c.text}`).join("\n");
  const line = (c) => `${c.text}${c.status === "verifier" ? (c.test ? ` — test : ${c.test}` : "") : c.proof ? ` — ${c.proof}` : ""}`;
  v.tests = IK_ST.map(([s, l]) => { const rows = ik.causes.filter((c) => (c.status || "verifier") === s); return rows.length ? `${l} : ${rows.map(line).join(" ; ")}` : ""; }).filter(Boolean).join("\n");
  d.content = v.effect || "";
}
function whyKids(w, id) { return w.nodes.filter((n) => (n.parent || null) === (id || null)); }
function whyPath(w, id) { const out = []; let n = w.nodes.find((x) => x.id === id); while (n) { out.unshift(n); n = n.parent ? w.nodes.find((x) => x.id === n.parent) : null; } return out; }
function whyDepth(w) { return w.nodes.reduce((m, n) => Math.max(m, whyPath(w, n.id).length), 0); }
function whyRoots(w) { return w.nodes.filter((n) => n.root && n.status !== "faux"); }
function whySync(d) {
  const v = d.structured_data, w = v.why, roots = whyRoots(w);
  const leaf = roots[0] || w.nodes.filter((n) => n.status !== "faux" && !whyKids(w, n.id).length).sort((a, b) => whyPath(w, b.id).length - whyPath(w, a.id).length)[0];
  const path = leaf ? whyPath(w, leaf.id).map((n) => n.text).filter(Boolean) : [];
  [1, 2, 3, 4, 5].forEach((n) => { v[`why${n}`] = n < 5 ? path[n - 1] || "" : path.slice(4).join(" → "); });
  v.root_cause = roots.map((r) => `${r.text}${r.proof ? ` (preuve : ${r.proof})` : ""}`).join("\n");
  v.countermeasure = roots.map((r) => r.cm).filter(Boolean).join("\n");
  d.content = v.problem || "";
}
function ikSave(id, fn) {
  const ok = commitData(() => {
    const d = data.documents.find((x) => x.id === id);
    d.structured_data ||= {};
    if (d.type === "ISHIKAWA") { d.structured_data.ik = ikOf(d); fn(d.structured_data.ik, d); ikSync(d); }
    else { d.structured_data.why = whyOf(d); fn(d.structured_data.why, d); whySync(d); }
    if (d.status === "Validé") d.status = "En révision";
    d.updated_at = now();
  });
  if (ok) modalDirty = false;
  return ok;
}
function ikProgress(type, v) {
  if (type === "ISHIKAWA") {
    const ik = v.ik, c = ik.causes, conf = c.filter((x) => x.status === "confirmee");
    const checks = [!!String(v.effect || "").trim(), c.length >= 5, c.length > 0 && c.every((x) => (x.status || "verifier") !== "verifier"), conf.length > 0, conf.length > 0 && conf.every((x) => String(x.proof || "").trim() || x.photo), conf.length > 0 && conf.every((x) => x.why_id || x.action_id)];
    return checks;
  }
  const w = v.why, roots = whyRoots(w), onPath = [...new Set(roots.flatMap((r) => whyPath(w, r.id)))];
  return [!!String(v.problem || "").trim(), whyDepth(w) >= 3, roots.length > 0, onPath.length > 0 && onPath.every((n) => n.status === "vrai"), roots.length > 0 && roots.every((r) => String(r.cm || "").trim()), roots.length > 0 && roots.every((r) => r.action_id)];
}
const IK_MISSING = {
  ISHIKAWA: ["l’effet à expliquer", "au moins cinq causes", "un statut pour chaque cause", "une cause confirmée", "la preuve des causes confirmées", "une suite pour chaque cause confirmée (5 pourquoi ou action)"],
  "5WHY": ["le problème", "trois niveaux de pourquoi", "une cause racine", "chaque réponse vérifiée jusqu’à la cause racine", "une contre-mesure par cause racine", "l’action de chaque contre-mesure"],
};
function ikAction(d, { title, owner, due, finding, category, label }) {
  const id = auNext("A", data.actions);
  data.actions.unshift({ id, site_id: d.site_id, title, description: `${label} ${d.id} · ${d.title}${finding ? `\n${finding}` : ""}`, owner, due_date: due, due_date_initial: due, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: category || "Qualité", origin_type: label, origin_id: d.id, problem_id: d.problem_id || null, finding: finding || "", created_at: now(), updated_at: now() });
  return id;
}
function ikHead(d, kind) {
  const p = d.problem_id && data.problems.find((x) => x.id === d.problem_id);
  return `<p class="jn-where">${esc(getSiteName(d.site_id))} · ${esc(d.owner || "responsable à désigner")} · ${esc(d.status || "Brouillon")}${p ? ` · <button type="button" class="md-link" data-open-record="${esc(p.id)}">${esc(p.id)} · ${esc(p.title)}</button>` : ""}</p>`;
}
function ikTabs(kind, tab, tabs) { return `<div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-ik-tab="${k}">${l}</button>`).join("")}</div>`; }
function ikDone(d, writable) {
  const checks = ikProgress(d.type, d.structured_data), miss = checks.map((ok, i) => (ok ? null : IK_MISSING[d.type][i])).filter(Boolean);
  if (d.status === "Validé") return `<section class="ik-close ok"><b>Analyse terminée</b><span>Validée${d.validated_at ? ` le ${shortDate(d.validated_at)}` : ""}. Toute modification la repasse en révision.</span></section>`;
  return `<section class="ik-close ${miss.length ? "" : "ok"}"><b>${checks.filter(Boolean).length}/${checks.length} · ${miss.length ? "Pour conclure, il manque :" : "Prête à conclure"}</b>${miss.length ? `<span>${esc(miss.join(", "))}.</span>` : ""}${writable && !miss.length ? '<button type="button" class="btn" data-ik-validate>Analyse terminée</button>' : ""}</section>`;
}
function ikPhotoInput() { return '<input type="file" class="ik-file" accept="image/*" capture="environment" hidden>'; }

/* ---------- Ishikawa ---------- */

function ikNote(c, writable) {
  return `<li class="ik-note st-${c.status || "verifier"}" data-ik-c="${esc(c.id)}">${writable ? `<button type="button" class="ik-note-t" data-ik-edit>${esc(c.text)}</button><button type="button" class="ik-x" data-ik-del aria-label="Supprimer « ${esc(c.text)} »">×</button>` : `<span class="ik-note-t">${esc(c.text)}</span>`}</li>`;
}
function ikFamHtml(ik, k, writable) {
  const [, label, q] = ikFam(k), rows = ik.causes.filter((c) => c.fam === k);
  return `<section class="ik-fam" data-ik-fam="${k}"><header><b>${esc(label)}</b><span>${rows.length || ""}</span></header><p class="ik-q">${esc(q)}</p>
    <ul class="ik-notes">${rows.map((c) => ikNote(c, writable)).join("")}</ul>
    ${writable ? `<form class="ik-add" data-ik-add><input data-ik-addin aria-label="Ajouter une cause · ${esc(label)}" placeholder="Une cause possible…" enterkeyhint="next" autocomplete="off"><button class="btn secondary" aria-label="Ajouter">+</button></form>` : ""}</section>`;
}
function ikCheck(c, writable) {
  const dis = writable ? "" : "disabled", st = c.status || "verifier";
  return `<li class="ik-check st-${st}" data-ik-c="${esc(c.id)}"><div class="ik-check-head"><span class="ik-tag">${esc(ikFam(c.fam)[1])}</span><b>${esc(c.text)}</b></div>
    <div class="ik-st" role="radiogroup" aria-label="Statut de la cause">${IK_ST.map(([k, l]) => `<button type="button" class="ik-s s-${k} ${st === k ? "on" : ""}" data-ik-st="${k}" role="radio" aria-checked="${st === k}" ${dis}>${l}</button>`).join("")}</div>
    <div class="ik-fields"><label>Comment la vérifier ?<input data-ik-test value="${esc(c.test || "")}" placeholder="Ex. mesurer la température de colle à 6 h et à 14 h" ${dis}></label>
    <label>Résultat, preuve<input data-ik-proof value="${esc(c.proof || "")}" placeholder="Ce qui a été vu ou mesuré" ${dis}></label></div>
    <div class="ik-photo">${c.photo ? `<figure class="cp-ph">${phImg(c.photo, "cp-ph-img", "Preuve")}${writable ? '<span class="cp-ph-tools"><button type="button" class="cp-ph-btn" data-ik-phdel aria-label="Retirer la photo">×</button></span>' : ""}</figure>` : writable ? '<button type="button" class="btn ghost small" data-ik-ph>Photo de la preuve</button>' : ""}</div></li>`;
}
function ikFish(d, compact = false) {
  const v = d.structured_data, ik = v.ik || ikOf(d);
  const box = ([k, label]) => { const rows = ik.causes.filter((c) => c.fam === k).sort((a, b) => ({ confirmee: 0, verifier: 1, ecartee: 2 })[a.status || "verifier"] - ({ confirmee: 0, verifier: 1, ecartee: 2 })[b.status || "verifier"]);
    return `<div class="ik-bone" data-fam="${k}"><b>${esc(label)}</b><ul>${rows.map((c) => `<li class="st-${c.status || "verifier"}">${esc(c.text)}</li>`).join("") || '<li class="none">—</li>'}</ul></div>`; };
  return `<figure class="ik-fish ${compact ? "compact" : ""}" role="img" aria-label="Ishikawa : ${ik.causes.length} causes, ${ik.causes.filter((c) => c.status === "confirmee").length} confirmées">
    <div class="ik-row top">${IK_FAM.slice(0, 3).map(box).join("")}</div>
    <div class="ik-spine"><i></i><div class="ik-head"><small>Effet</small><b>${esc(v.effect || "À définir")}</b></div></div>
    <div class="ik-row bot">${IK_FAM.slice(3).map(box).join("")}</div>
    <figcaption><span><i class="confirmee"></i>Confirmée</span><span><i class="verifier"></i>À vérifier</span><span><i class="ecartee"></i>Écartée</span></figcaption></figure>`;
}
function ikBody(d, tab) {
  const ik = d.structured_data.ik || ikOf(d), writable = ikWritable(d), n = ikCounts(ik);
  if (tab === "causes") return `<p class="hint">Toutes les idées de l’équipe, sans les juger. Entrée pour noter la suivante ; touchez une cause pour la corriger.</p><div class="ik-fams">${IK_FAM.map(([k]) => ikFamHtml(ik, k, writable)).join("")}</div>
    ${n.total ? `<div class="sm-tools"><button type="button" class="btn" data-ik-tab="verifier">Vérifier les causes · ${n.total}</button></div>` : ""}`;
  if (tab === "verifier") {
    const open = ik.causes.filter((c) => c.status !== "ecartee").sort((a, b) => (a.status === "confirmee") - (b.status === "confirmee")), out = ik.causes.filter((c) => c.status === "ecartee");
    return `<p class="hint">Une cause est confirmée par un fait observé ou mesuré, pas par un avis. Les causes écartées restent tracées.</p>
      <ol class="ik-checks">${open.map((c) => ikCheck(c, writable)).join("") || '<li class="jn-empty">Notez d’abord les causes possibles.</li>'}</ol>
      ${out.length ? `<details class="ik-out"><summary>Écartées · ${out.length}</summary><ol class="ik-checks">${out.map((c) => ikCheck(c, writable)).join("")}</ol></details>` : ""}${writable ? ikPhotoInput() : ""}`;
  }
  const conf = ik.causes.filter((c) => c.status === "confirmee");
  return `<div class="sm-sum"><div><small>Causes</small><b>${n.total}</b></div><div class="${n.confirmee ? "ok" : ""}"><small>Confirmées</small><b>${n.confirmee}</b></div><div><small>Écartées</small><b>${n.ecartee}</b></div><div class="${n.verifier ? "warn" : ""}"><small>À vérifier</small><b>${n.verifier}</b></div></div>
    ${ikFish(d)}
    <section><h3>Causes confirmées · ${conf.length}</h3>${conf.length ? `<ol class="ik-conf">${conf.map((c) => {
      const w = c.why_id && ikDoc(c.why_id), a = c.action_id && data.actions.find((x) => x.id === c.action_id);
      return `<li data-ik-c="${esc(c.id)}"><div class="ik-check-head"><span class="ik-tag">${esc(ikFam(c.fam)[1])}</span><b>${esc(c.text)}</b></div>${c.proof ? `<p class="ik-proof">${esc(c.proof)}</p>` : ""}
        <div class="sm-tools">${w ? `<button type="button" class="btn secondary small" data-open-record="${esc(w.id)}">5 pourquoi · ${esc(w.id)}</button>` : writable ? '<button type="button" class="btn secondary small" data-ik-why>Creuser en 5 pourquoi</button>' : ""}${a ? `<button type="button" class="btn ghost small" data-open-record="${esc(a.id)}">Action ${esc(a.id)}</button>` : writable ? '<button type="button" class="btn ghost small" data-ik-act>Action directe</button>' : ""}</div>
        <div class="ik-actform" hidden><label class="sm-inl wide">Quoi ?<input data-ik-what value="${esc(c.action || "")}" placeholder="Commencer par un verbe"></label><div class="cs-act-fields"><label>Qui ?<input data-ik-who list="ownerList" value="${esc(c.who || d.owner || "")}"></label><label>Pour quand ?<input type="date" data-ik-when value="${esc(c.when || auAddDays(14))}"></label></div><button type="button" class="btn small" data-ik-mkact>Ajouter au plan d’actions</button></div></li>`; }).join("")}</ol>${ownerDatalist()}` : '<p class="hint">Aucune cause confirmée pour l’instant : vérifiez les causes probables sur le terrain.</p>'}</section>
    ${ikDone(d, writable)}<div class="sm-tools"><button type="button" class="btn ghost" data-ik-print>Imprimer / PDF</button></div>`;
}

/* ---------- 5 pourquoi ---------- */

function whyNode(w, n, lvl, writable) {
  const kids = whyKids(w, n.id), st = n.status || "verifier", dis = writable ? "" : "disabled", leaf = !kids.length;
  return `<li class="why-node st-${st} ${n.root ? "is-root" : ""}" data-why-n="${esc(n.id)}"><div class="why-card">
    <div class="why-head"><span class="why-lvl" aria-hidden="true">${lvl}</span><textarea data-why-text rows="1" aria-label="Pourquoi n° ${lvl}" placeholder="Parce que…" ${dis}>${esc(n.text || "")}</textarea>${writable ? '<button type="button" class="ik-x" data-why-del aria-label="Supprimer cette réponse">×</button>' : ""}</div>
    <div class="ik-st why-st" role="radiogroup" aria-label="Vérification">${WHY_ST.map(([k, l]) => `<button type="button" class="ik-s s-${k} ${st === k ? "on" : ""}" data-why-st="${k}" role="radio" aria-checked="${st === k}" ${dis}>${l}</button>`).join("")}</div>
    <input class="why-proof" data-why-proof value="${esc(n.proof || "")}" placeholder="Preuve : ce qui a été vu, mesuré, demandé" aria-label="Preuve" ${dis}>
    ${n.root ? `<div class="why-cm"><label class="sm-inl wide">Contre-mesure sur cette cause<input data-why-cm value="${esc(n.cm || "")}" placeholder="Ce qui empêchera que ça revienne" ${dis}></label></div>` : ""}
    ${writable ? `<div class="why-tools">${st !== "faux" ? '<button type="button" class="btn secondary small" data-why-child>+ Pourquoi ?</button>' : ""}<button type="button" class="btn ghost small" data-why-sib>+ Autre cause</button>${leaf && st !== "faux" ? `<button type="button" class="btn ${n.root ? "" : "ghost"} small" data-why-root aria-pressed="${!!n.root}">${n.root ? "✓ Cause racine" : "Cause racine"}</button>` : ""}</div>` : ""}
    </div>${kids.length ? `<ol class="why-kids">${kids.map((k) => whyNode(w, k, lvl + 1, writable)).join("")}</ol>` : ""}</li>`;
}
function whyBody(d, tab) {
  const v = d.structured_data, w = v.why || whyOf(d), writable = ikWritable(d);
  if (tab === "arbre") {
    const top = whyKids(w, null);
    return `<label class="ik-effect"><span>Le problème : un fait observé</span><textarea data-why-problem rows="2" placeholder="Ex. 12 panneaux décollés au contrôle final mardi" ${writable ? "" : "disabled"}>${esc(v.problem || "")}</textarea></label>
      <p class="hint">Pourquoi ? Répondez par un fait que l’on peut vérifier. Plusieurs causes possibles : « Autre cause » ouvre une branche. Arrêtez-vous sur une cause sur laquelle on peut agir.</p>
      <ol class="why-tree">${top.map((n) => whyNode(w, n, 1, writable)).join("")}</ol>
      ${writable ? `<div class="sm-tools">${top.length ? "" : '<button type="button" class="btn" data-why-first>Pourquoi ?</button>'}${whyRoots(w).length ? '<button type="button" class="btn" data-ik-tab="bilan">Voir le bilan</button>' : ""}</div>` : ""}`;
  }
  const roots = whyRoots(w), from = w.from && ikDoc(w.from.doc);
  return `${roots.length ? `<section><h3>Relire à l’envers · ${roots.length > 1 ? `${roots.length} causes racines` : "cause racine"}</h3><p class="hint">Chaque « donc » doit tenir. S’il ne tient pas, il manque un pourquoi ou une réponse est fausse.</p>
    ${roots.map((r) => { const path = whyPath(w, r.id).reverse(), todo = path.filter((x) => x.status !== "vrai").length, a = r.action_id && data.actions.find((x) => x.id === r.action_id);
      return `<article class="why-back" data-why-n="${esc(r.id)}"><ol>${path.map((x, i) => `<li class="st-${x.status || "verifier"}">${i ? "<em>donc</em> " : ""}${esc(x.text || "…")}</li>`).join("")}<li class="why-pb"><em>donc</em> ${esc(v.problem || "le problème")}</li></ol>
        ${todo ? `<p class="why-warn">${jnPlural(todo, "réponse encore à vérifier", "réponses encore à vérifier")} sur ce chemin.</p>` : ""}
        <div class="why-cmline"><b>Contre-mesure</b><span>${esc(r.cm || "À définir dans l’arbre")}</span></div>
        ${a ? `<button type="button" class="btn ghost small" data-open-record="${esc(a.id)}">Action ${esc(a.id)} · ${esc(a.status)}</button>` : writable && r.cm ? `<div class="cs-act-fields"><label>Qui ?<input data-why-who list="ownerList" value="${esc(r.who || d.owner || "")}"></label><label>Pour quand ?<input type="date" data-why-when value="${esc(r.when || auAddDays(14))}"></label></div><button type="button" class="btn small" data-why-mkact>Ajouter au plan d’actions</button>` : ""}</article>`; }).join("")}${ownerDatalist()}</section>`
    : '<p class="hint">Choisissez une cause racine dans l’arbre : une feuille vérifiée, sur laquelle on peut agir.</p>'}
    ${from ? `<p class="hint">Issu de l’Ishikawa <button type="button" class="md-link" data-open-record="${esc(from.id)}">${esc(from.id)}</button>.</p>` : ""}
    ${ikDone(d, writable)}<div class="sm-tools"><button type="button" class="btn ghost" data-ik-print>Imprimer / PDF</button></div>`;
}
function whySheet(d) {
  const v = d.structured_data, w = v.why || whyOf(d);
  const node = (n, lvl) => `<li class="st-${n.status || "verifier"} ${n.root ? "is-root" : ""}"><span><b>${lvl}</b> ${esc(n.text || "…")}${n.proof ? ` <small>${esc(n.proof)}</small>` : ""}${n.root ? ` <em>Cause racine${n.cm ? ` · ${esc(n.cm)}` : ""}</em>` : ""}</span>${whyKids(w, n.id).length ? `<ol>${whyKids(w, n.id).map((k) => node(k, lvl + 1)).join("")}</ol>` : ""}</li>`;
  return `<div class="why-sheet"><p class="why-sheet-pb"><small>Problème</small><b>${esc(v.problem || "À définir")}</b></p><ol>${whyKids(w, null).map((n) => node(n, 1)).join("")}</ol></div>`;
}

/* ---------- Ouverture et gestes ---------- */

function ikOpen(id, tab = null) {
  const d = ikDoc(id);
  if (!d || !["ISHIKAWA", "5WHY"].includes(d.type) || !allowedSite(d.site_id)) return;
  const isIk = d.type === "ISHIKAWA", writable = ikWritable(d);
  if (writable && !(isIk ? d.structured_data?.ik : d.structured_data?.why)) ikSave(id, () => {});
  const doc = ikDoc(id), v = doc.structured_data || {};
  if (isIk) {
    const ik = v.ik || ikOf(doc), n = ikCounts(ik);
    tab ||= !n.total ? "causes" : n.verifier ? "verifier" : "bilan";
    const tabs = [["causes", `1. Causes${n.total ? ` · ${n.total}` : ""}`], ["verifier", `2. Vérifier${n.verifier ? ` · ${n.verifier}` : ""}`], ["bilan", "3. Bilan"]];
    modal(`${doc.id} · Ishikawa`, `<div class="ik" data-ik-id="${esc(id)}">${ikHead(doc)}<label class="ik-effect"><span>Effet à expliquer</span><textarea data-ik-effect rows="2" placeholder="Ex. décollement de chant sur la plaqueuse 2 : 3 % des panneaux en octobre" ${writable ? "" : "disabled"}>${esc(v.effect || "")}</textarea></label>${ikTabs("ik", tab, tabs)}<div class="ik-body" data-tab="${tab}">${ikBody(doc, tab)}</div></div>`);
  } else {
    const w = v.why || whyOf(doc);
    tab ||= "arbre";
    modal(`${doc.id} · 5 pourquoi`, `<div class="ik why" data-ik-id="${esc(id)}">${ikHead(doc)}${ikTabs("why", tab, [["arbre", `1. Pourquoi${w.nodes.length ? ` · ${w.nodes.length}` : ""}`], ["bilan", "2. Bilan"]])}<div class="ik-body" data-tab="${tab}">${whyBody(doc, tab)}</div></div>`);
  }
  modalSaver = () => { uxFlush(); return true; };
  ikBind(id, tab);
  if (isIk && tab === "causes" && writable && !(v.ik || ikOf(doc)).causes.length) setTimeout(() => $("modalContent")?.querySelector("[data-ik-addin]")?.focus(), 0);
}
function ikRoot(id) { return $("modalContent")?.querySelector(`.ik[data-ik-id="${id}"]`); }
function ikRedraw(id, tab, focusSel = null) {
  const root = ikRoot(id), box = root?.querySelector(".ik-body"), d = ikDoc(id);
  if (!box || !d) return;
  const scroller = box.closest(".modal"), top = scroller?.scrollTop;
  box.innerHTML = d.type === "ISHIKAWA" ? ikBody(d, tab) : whyBody(d, tab);
  const counts = d.type === "ISHIKAWA" ? ikCounts(d.structured_data.ik) : null, chips = root.querySelectorAll(".sm-tabs [data-ik-tab]");
  if (counts) { chips[0] && (chips[0].textContent = `1. Causes${counts.total ? ` · ${counts.total}` : ""}`); chips[1] && (chips[1].textContent = `2. Vérifier${counts.verifier ? ` · ${counts.verifier}` : ""}`); }
  else if (chips[0]) chips[0].textContent = `1. Pourquoi${d.structured_data.why.nodes.length ? ` · ${d.structured_data.why.nodes.length}` : ""}`;
  ikBind(id, tab);
  if (scroller && top !== undefined) scroller.scrollTop = top;
  if (focusSel) { const el = box.querySelector(focusSel); el?.focus?.({ preventScroll: true }); el?.scrollIntoView?.({ block: "nearest" }); }
  phFill(box);
}
function ikGrow(el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`; }
function ikBind(id, tab) {
  const root = ikRoot(id), d = ikDoc(id);
  if (!root || !d) return;
  const isIk = d.type === "ISHIKAWA";
  root.querySelectorAll("button[data-ik-tab]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); ikOpen(id, b.dataset.ikTab); }));
  root.querySelector("[data-ik-print]")?.addEventListener("click", () => { document.activeElement?.blur?.(); const x = ikDoc(id); modal(`${x.id} · Impression`, `<div class="ik-preview">${documentPrint(x, x.structured_data)}</div><div class="form-actions"><button type="button" class="btn" data-print>Imprimer / PDF</button><button type="button" class="btn secondary" data-ik-back>Retour</button></div>`); $("modalContent").querySelector("[data-ik-back]").onclick = () => ikOpen(id, "bilan"); });
  if (!ikWritable(d)) return;
  root.querySelector("[data-ik-validate]")?.addEventListener("click", () => {
    if (!commitData(() => { const x = data.documents.find((k) => k.id === id); x.status = "Validé"; x.validated_at = now(); x.updated_at = now(); })) return;
    modalDirty = false; toast("Analyse terminée et validée."); render(); ikOpen(id, tab);
  });
  root.querySelectorAll("textarea").forEach((t) => { ikGrow(t); t.addEventListener("input", () => ikGrow(t)); });
  const cOf = (el) => el.closest("[data-ik-c]")?.dataset.ikC, nOf = (el) => el.closest("[data-why-n]")?.dataset.whyN;
  if (isIk) {
    const eff = root.querySelector("[data-ik-effect]");
    if (eff) eff.onchange = () => ikSave(id, (ik, x) => { x.structured_data.effect = eff.value.trim(); });
    const withC = (el, fn) => { const cid = cOf(el); return ikSave(id, (ik) => { const c = ik.causes.find((k) => k.id === cid); if (c) fn(c, ik); }); };
    const famRedraw = (k, focus) => { const sec = root.querySelector(`[data-ik-fam="${k}"]`); if (!sec) return; const tmp = document.createElement("div"); tmp.innerHTML = ikFamHtml(ikDoc(id).structured_data.ik, k, true); sec.replaceWith(tmp.firstElementChild); ikRedrawCounts(); ikBind(id, tab); if (focus) root.querySelector(`[data-ik-fam="${k}"] [data-ik-addin]`)?.focus({ preventScroll: true }); };
    const ikRedrawCounts = () => { const n = ikCounts(ikDoc(id).structured_data.ik), chips = root.querySelectorAll(".sm-tabs [data-ik-tab]"); if (chips[0]) chips[0].textContent = `1. Causes${n.total ? ` · ${n.total}` : ""}`; if (chips[1]) chips[1].textContent = `2. Vérifier${n.verifier ? ` · ${n.verifier}` : ""}`; const go = root.querySelector('.ik-body [data-ik-tab="verifier"]'); if (go) go.textContent = `Vérifier les causes · ${n.total}`; else if (n.total && tab === "causes") root.querySelector(".ik-fams")?.insertAdjacentHTML("afterend", `<div class="sm-tools"><button type="button" class="btn" data-ik-tab="verifier">Vérifier les causes · ${n.total}</button></div>`); };
    root.querySelectorAll("[data-ik-add]").forEach((f) => (f.onsubmit = (e) => {
      e.preventDefault();
      const input = f.querySelector("[data-ik-addin]"), text = input.value.trim(), k = f.closest("[data-ik-fam]").dataset.ikFam;
      if (!text) return;
      if (ikDoc(id).structured_data.ik.causes.some((c) => c.fam === k && c.text.toLowerCase() === text.toLowerCase())) { toast("Cette cause est déjà notée."); input.select(); return; }
      if (ikSave(id, (ik) => { ik.causes.push({ id: uid("C"), fam: k, text, status: "verifier", test: "", proof: "", photo: "" }); })) famRedraw(k, true);
    }));
    root.querySelectorAll("[data-ik-edit]").forEach((b) => (b.onclick = () => {
      const li = b.closest("[data-ik-c]"), cid = li.dataset.ikC, c = ikDoc(id).structured_data.ik.causes.find((k) => k.id === cid), k = li.closest("[data-ik-fam]").dataset.ikFam;
      li.innerHTML = `<input class="ik-note-in" value="${esc(c.text)}" aria-label="Corriger la cause">`;
      const inp = li.querySelector("input"); inp.focus(); inp.select();
      let done = false;
      const finish = () => { if (done) return; done = true; const t = inp.value.trim(); if (t && t !== c.text) ikSave(id, (ik) => { const x = ik.causes.find((q) => q.id === cid); if (x) x.text = t; }); famRedraw(k, false); };
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); finish(); } if (e.key === "Escape") { inp.value = c.text; finish(); } };
      inp.onblur = finish;
    }));
    root.querySelectorAll("[data-ik-del]").forEach((b) => (b.onclick = () => {
      const li = b.closest("[data-ik-c]"), cid = li.dataset.ikC, k = li.closest("[data-ik-fam]").dataset.ikFam, c = ikDoc(id).structured_data.ik.causes.find((q) => q.id === cid);
      if ((c?.proof || c?.status !== "verifier" || c?.why_id || c?.action_id) && !li.dataset.confirm) { li.dataset.confirm = "1"; toast("Cette cause est déjà travaillée : touchez × encore une fois pour la supprimer."); return; }
      if (ikSave(id, (ik) => { ik.causes = ik.causes.filter((q) => q.id !== cid); })) famRedraw(k, false);
    }));
    root.querySelectorAll("[data-ik-st]").forEach((b) => (b.onclick = () => {
      document.activeElement?.blur?.();
      if (!withC(b, (c) => { c.status = b.dataset.ikSt; })) return;
      const li = b.closest("[data-ik-c]");
      li.className = `ik-check st-${b.dataset.ikSt}`;
      li.querySelectorAll("[data-ik-st]").forEach((k) => { const on = k === b; k.classList.toggle("on", on); k.setAttribute("aria-checked", String(on)); });
      ikRedrawCounts();
      if (b.dataset.ikSt === "confirmee" && !li.querySelector("[data-ik-proof]").value.trim()) li.querySelector("[data-ik-proof]").focus({ preventScroll: true });
    }));
    root.querySelectorAll("[data-ik-test]").forEach((el) => (el.onchange = () => withC(el, (c) => { c.test = el.value.trim(); })));
    root.querySelectorAll("[data-ik-proof]").forEach((el) => (el.onchange = () => withC(el, (c) => { c.proof = el.value.trim(); })));
    const file = root.querySelector(".ik-file");
    root.querySelectorAll("[data-ik-ph]").forEach((b) => (b.onclick = () => { file.dataset.for = cOf(b); file.click(); }));
    root.querySelectorAll("[data-ik-phdel]").forEach((b) => (b.onclick = () => { if (withC(b, (c) => { c.photo = ""; })) ikRedraw(id, tab); }));
    if (file) file.onchange = async () => {
      const f = file.files?.[0], cid = file.dataset.for; file.value = "";
      if (!f) return;
      toast("Photo en préparation…");
      try { const ref = await phStore(await imageDataUrl(f)); if (ref && ikSave(id, (ik) => { const c = ik.causes.find((q) => q.id === cid); if (c) c.photo = ref; })) ikRedraw(id, tab); } catch (error) { toast(error.message); }
    };
    root.querySelectorAll("[data-ik-act]").forEach((b) => (b.onclick = () => { const f = b.closest("li").querySelector(".ik-actform"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("[data-ik-what]").focus(); }));
    root.querySelectorAll("[data-ik-mkact]").forEach((b) => (b.onclick = () => {
      const li = b.closest("[data-ik-c]"), cid = li.dataset.ikC, what = li.querySelector("[data-ik-what]").value.trim(), who = li.querySelector("[data-ik-who]").value.trim(), when = li.querySelector("[data-ik-when]").value;
      if (!what || !who || !when) return toast("Précisez quoi, qui et pour quand.");
      let aid = null;
      if (!commitData(() => { const x = data.documents.find((k) => k.id === id), c = x.structured_data.ik.causes.find((q) => q.id === cid); aid = ikAction(x, { title: what, owner: who, due: when, finding: `Cause confirmée (${ikFam(c.fam)[1]}) : ${c.text}${c.proof ? ` — ${c.proof}` : ""}`, category: ikFam(c.fam)[3], label: "Ishikawa" }); Object.assign(c, { action_id: aid, action: what, who, when }); ikSync(x); x.updated_at = now(); })) return;
      modalDirty = false; toast(`Action ${aid} ajoutée au plan.`); render(); ikOpen(id, "bilan");
    }));
    root.querySelectorAll("[data-ik-why]").forEach((b) => (b.onclick = () => {
      const cid = cOf(b), x = ikDoc(id), c = x.structured_data.ik.causes.find((q) => q.id === cid);
      const w = { id: nextId("DOC", data.documents), site_id: x.site_id, type: "5WHY", title: `5 pourquoi · ${c.text}`, owner: x.owner, status: "Brouillon", problem_id: x.problem_id || null, structured_data: { problem: x.structured_data.effect || x.title, why: { nodes: [{ id: uid("W"), parent: null, text: c.text, status: "vrai", proof: c.proof || "" }], from: { doc: x.id, cause: c.id } } }, version: 1, created_at: now(), updated_at: now() };
      whySync(w);
      if (!commitData(() => { data.documents.unshift(w); const y = data.documents.find((k) => k.id === id); const cc = y.structured_data.ik.causes.find((q) => q.id === cid); cc.why_id = w.id; y.updated_at = now(); })) return;
      modalDirty = false; render(); toast(`${w.id} créé : continuez à demander pourquoi.`); ikOpen(w.id, "arbre");
      setTimeout(() => $("modalContent")?.querySelector("[data-why-child]")?.click(), 0);
    }));
    return;
  }
  /* 5 pourquoi */
  const pb = root.querySelector("[data-why-problem]");
  if (pb) pb.onchange = () => ikSave(id, (w, x) => { x.structured_data.problem = pb.value.trim(); });
  const withN = (el, fn) => { const nid = nOf(el); return ikSave(id, (w) => { const n = w.nodes.find((k) => k.id === nid); if (n) fn(n, w); }); };
  const add = (parent) => { const nid = uid("W"); if (ikSave(id, (w) => { if (parent) { const p = w.nodes.find((k) => k.id === parent); if (p) p.root = false; } w.nodes.push({ id: nid, parent: parent || null, text: "", status: "verifier", proof: "" }); })) ikRedraw(id, "arbre", `[data-why-n="${nid}"] [data-why-text]`); };
  root.querySelector("[data-why-first]")?.addEventListener("click", () => add(null));
  root.querySelectorAll("[data-why-child]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); add(nOf(b)); }));
  root.querySelectorAll("[data-why-sib]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); const n = ikDoc(id).structured_data.why.nodes.find((k) => k.id === nOf(b)); add(n?.parent || null); }));
  root.querySelectorAll("[data-why-text]").forEach((el) => { el.onchange = () => withN(el, (n) => { n.text = el.value.trim(); }); el.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); } }; });
  root.querySelectorAll("[data-why-proof]").forEach((el) => (el.onchange = () => withN(el, (n) => { n.proof = el.value.trim(); })));
  root.querySelectorAll("[data-why-cm]").forEach((el) => (el.onchange = () => withN(el, (n) => { n.cm = el.value.trim(); })));
  root.querySelectorAll("[data-why-st]").forEach((b) => (b.onclick = () => {
    document.activeElement?.blur?.();
    const st = b.dataset.whySt, li = b.closest("[data-why-n]");
    if (!withN(b, (n) => { n.status = st; if (st === "faux") n.root = false; })) return;
    if (st === "faux" || li.classList.contains("is-root") || li.classList.contains("st-faux")) { ikRedraw(id, "arbre"); return; }
    li.classList.remove("st-verifier", "st-vrai", "st-faux"); li.classList.add(`st-${st}`);
    li.querySelector(":scope > .why-card .why-st").querySelectorAll("[data-why-st]").forEach((k) => { const on = k === b; k.classList.toggle("on", on); k.setAttribute("aria-checked", String(on)); });
  }));
  root.querySelectorAll("[data-why-root]").forEach((b) => (b.onclick = () => { document.activeElement?.blur?.(); const nid = nOf(b); if (withN(b, (n) => { n.root = !n.root; })) ikRedraw(id, "arbre", ikDoc(id).structured_data.why.nodes.find((k) => k.id === nid)?.root ? `[data-why-n="${nid}"] [data-why-cm]` : null); }));
  root.querySelectorAll("[data-why-del]").forEach((b) => (b.onclick = () => {
    const li = b.closest("[data-why-n]"), nid = li.dataset.whyN, w = ikDoc(id).structured_data.why, sub = new Set([nid]);
    let grew = true; while (grew) { grew = false; for (const n of w.nodes) if (n.parent && sub.has(n.parent) && !sub.has(n.id)) { sub.add(n.id); grew = true; } }
    const n = w.nodes.find((k) => k.id === nid);
    if ((n?.text || sub.size > 1) && !li.dataset.confirm) { li.dataset.confirm = "1"; toast(sub.size > 1 ? `Touchez × encore une fois : cette réponse et ${jnPlural(sub.size - 1, "réponse en dessous", "réponses en dessous")} seront supprimées.` : "Touchez × encore une fois pour supprimer cette réponse."); return; }
    if (ikSave(id, (ww) => { ww.nodes = ww.nodes.filter((k) => !sub.has(k.id)); })) ikRedraw(id, "arbre");
  }));
  root.querySelectorAll("[data-why-mkact]").forEach((b) => (b.onclick = () => {
    const art = b.closest("[data-why-n]"), nid = art.dataset.whyN, who = art.querySelector("[data-why-who]").value.trim(), when = art.querySelector("[data-why-when]").value;
    if (!who || !when) return toast("Précisez qui et pour quand.");
    let aid = null;
    if (!commitData(() => { const x = data.documents.find((k) => k.id === id), r = x.structured_data.why.nodes.find((k) => k.id === nid); aid = ikAction(x, { title: r.cm, owner: who, due: when, finding: `Cause racine : ${r.text}${r.proof ? ` — ${r.proof}` : ""}`, category: "Qualité", label: "5 pourquoi" }); Object.assign(r, { action_id: aid, who, when }); whySync(x); x.updated_at = now(); })) return;
    modalDirty = false; toast(`Action ${aid} ajoutée au plan.`); render(); ikOpen(id, "bilan");
  }));
}

/* ---------- Branchements ---------- */

const ikEditBase = editDocument;
editDocument = function (id) {
  const d = ikDoc(id);
  if (d && ["ISHIKAWA", "5WHY"].includes(d.type) && allowedSite(d.site_id)) return ikOpen(id);
  return ikEditBase.apply(this, arguments);
};
const ikVisualBase = documentVisual;
documentVisual = function (type, values = {}) {
  if (type === "ISHIKAWA" && values?.ik) return ikFish({ structured_data: values }, true);
  if (type === "5WHY" && values?.why) return whySheet({ structured_data: values });
  return ikVisualBase.apply(this, arguments);
};
const ikPrintBase = documentPrint;
documentPrint = function (d, values) {
  if (d?.type === "ISHIKAWA" && d.structured_data?.ik) {
    const ik = d.structured_data.ik, rows = (s) => ik.causes.filter((c) => (c.status || "verifier") === s);
    return `<header class="print-header"><p>BIA PRODUCTION SYSTEM · ${esc(getSiteName(d.site_id))}</p><h2>${esc(d.title)}</h2><p>${esc(d.id)} · Ishikawa · ${esc(d.owner || "")} · ${shortDate(d.updated_at)}</p></header>${ikFish(d)}
      <table class="ik-ptable"><thead><tr><th>Cause</th><th>Famille</th><th>Vérification</th><th>Résultat</th><th>Suite</th></tr></thead><tbody>${["confirmee", "verifier", "ecartee"].flatMap((s) => rows(s).map((c) => `<tr class="st-${s}"><td><b>${esc(c.text)}</b><br><small>${esc(IK_ST.find((x) => x[0] === s)[1])}</small></td><td>${esc(ikFam(c.fam)[1])}</td><td>${esc(c.test || "—")}</td><td>${esc(c.proof || "—")}</td><td>${esc([c.why_id, c.action_id].filter(Boolean).join(" · ") || "—")}</td></tr>`)).join("")}</tbody></table>`;
  }
  if (d?.type === "5WHY" && d.structured_data?.why) {
    const w = d.structured_data.why;
    return `<header class="print-header"><p>BIA PRODUCTION SYSTEM · ${esc(getSiteName(d.site_id))}</p><h2>${esc(d.title)}</h2><p>${esc(d.id)} · 5 pourquoi · ${esc(d.owner || "")} · ${shortDate(d.updated_at)}</p></header>${whySheet(d)}
      ${whyRoots(w).map((r) => `<section class="why-back"><ol>${whyPath(w, r.id).reverse().map((x, i) => `<li>${i ? "<em>donc</em> " : ""}${esc(x.text)}</li>`).join("")}<li class="why-pb"><em>donc</em> ${esc(d.structured_data.problem || "")}</li></ol><div class="why-cmline"><b>Contre-mesure</b><span>${esc(r.cm || "—")}${r.action_id ? ` · ${esc(r.action_id)}` : ""}</span></div></section>`).join("")}`;
  }
  return ikPrintBase.apply(this, arguments);
};
const ikProgressBase = documentProgress;
documentProgress = function (type, values = {}) {
  if (!((type === "ISHIKAWA" && values?.ik) || (type === "5WHY" && values?.why))) return ikProgressBase.apply(this, arguments);
  const checks = ikProgress(type, values), done = checks.filter(Boolean).length;
  return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
};
/* Dans l'A3, le 8D et le QRQC : lancer l'Ishikawa ou les 5 pourquoi depuis la case d'analyse. */
const ikCausesBase = mdCauses;
mdCauses = function (o, types = ["5WHY", "ISHIKAWA"]) {
  const html = ikCausesBase.apply(this, arguments);
  if (!o?.pid || o.print) return html;
  const p = data.problems.find((x) => x.id === o.pid);
  if (!p || !allowedSite(p.site_id, true) || role().readonly) return html;
  const has = (t) => data.documents.some((d) => d.problem_id === o.pid && d.type === t && !d.archived_at);
  const btns = [["ISHIKAWA", "Faire l’Ishikawa"], ["5WHY", "Faire les 5 pourquoi"]].filter(([t]) => types.includes(t) && !has(t));
  return btns.length ? `${html}<p class="ik-launch">${btns.map(([t, l]) => `<button type="button" class="btn secondary small" data-ik-new="${t}" data-ik-pid="${esc(o.pid)}">${l}</button>`).join("")}</p>` : html;
};
function ikNewForProblem(type, pid) {
  const p = data.problems.find((x) => x.id === pid);
  if (!p || !allowedSite(p.site_id, true) || role().readonly) return;
  const fact = p.content?.current || p.content?.context || p.title;
  const d = { id: nextId("DOC", data.documents), site_id: p.site_id, type, title: `${type === "ISHIKAWA" ? "Ishikawa" : "5 pourquoi"} · ${p.title}`, owner: p.owner || apMe() || "", status: "Brouillon", problem_id: p.id, structured_data: type === "ISHIKAWA" ? { effect: fact, ik: { causes: [] } } : { problem: fact, why: { nodes: [] } }, version: 1, created_at: now(), updated_at: now() };
  type === "ISHIKAWA" ? ikSync(d) : whySync(d);
  if (!commitData(() => data.documents.unshift(d))) return;
  modalDirty = false;
  render();
  ikOpen(d.id);
}
const ikOsBindBase = osBind;
osBind = function () {
  const out = ikOsBindBase.apply(this, arguments);
  document.querySelectorAll("[data-ik-new]").forEach((b) => (b.onclick = () => ikNewForProblem(b.dataset.ikNew, b.dataset.ikPid)));
  return out;
};
