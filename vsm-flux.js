"use strict";
/*
 * BIA Lean OS 8.20 · VSM pas à pas, avec les symboles normalisés.
 *  - Le flux se décrit étape par étape au téléphone : fournisseur, puis pour chaque processus le stock devant lui
 *    (pièces) et sa boîte de données (temps de cycle, valeur ajoutée, changement de série, disponibilité, opérateurs,
 *    rebut), puis le stock de produits finis et le client.
 *  - La carte se dessine toute seule avec les symboles d'usage : usines fournisseur et client, contrôle de production,
 *    boîtes processus et boîtes de données, triangles de stock, flèches poussées, éclairs Kaizen, et l'échelle de temps
 *    (jours de stock en haut, secondes de traitement en bas) avec le délai total face au temps à valeur ajoutée.
 *  - État actuel et état futur (copie de l'actuel), comparaison des deux, éclairs Kaizen → actions datées.
 * Données : documents VSM existants (vsm.current / vsm.future) ; champs ajoutés : supplier, customer, info, delivery,
 * fg_wip ; par processus : scrap, burst, burst_action_id, order. L'éditeur graphique libre reste accessible.
 */

const VF_FIELDS = [["ct", "Temps de cycle", "s"], ["va", "Dont valeur ajoutée", "s"], ["changeover", "Changement de série", "min"], ["uptime", "Disponibilité", "%"], ["operators", "Opérateurs", ""], ["scrap", "Rebut", "%"]];

function vfDoc(id) { const d = data.documents.find((x) => x.id === id && x.type === "VSM" && !x.archived_at); return d || null; }
function vfWritable(d) { return !!d && !role().readonly && allowedSite(d.site_id, true) && osWritable(d.site_id); }
function vfProc(v) { return (v.nodes || []).filter((n) => !n.type || n.type === "process").slice().sort((a, b) => (a.order ?? a.x ?? 0) - (b.order ?? b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0)); }
function vfDays(v, pieces, waitMin) {
  if (osFinite(pieces) && v.demand_per_day > 0) return pieces / v.demand_per_day;
  if (osFinite(waitMin) && v.available_minutes > 0) return waitMin / v.available_minutes;
  return null;
}
function vfCalc(v) {
  const ps = vfProc(v), takt = v.available_minutes > 0 && v.demand_per_day > 0 ? (v.available_minutes * 60) / v.demand_per_day : null;
  const stocks = ps.map((p) => vfDays(v, p.wip, p.wait)), fg = vfDays(v, v.fg_wip, null);
  const days = [...stocks, fg].filter((x) => x !== null).reduce((a, b) => a + b, 0), known = [...stocks, fg].some((x) => x !== null);
  const ct = ps.reduce((n, p) => n + (Number(p.ct) || 0), 0), va = ps.reduce((n, p) => n + (osFinite(p.va) ? p.va : Number(p.ct) || 0), 0);
  const leadS = known && v.available_minutes > 0 ? days * v.available_minutes * 60 + ct : null;
  const neck = ps.length ? ps.reduce((m, p) => ((Number(p.ct) || 0) / Math.max(1, Number(p.operators) || 1) > (Number(m.ct) || 0) / Math.max(1, Number(m.operators) || 1) ? p : m), ps[0]) : null;
  return { ps, takt, stocks, fg, days: known ? days : null, ct, va, leadS, ratio: leadS ? va / leadS : null, wip: ps.reduce((n, p) => n + (Number(p.wip) || 0), 0) + (Number(v.fg_wip) || 0), neck, over: ps.filter((p) => takt && (Number(p.ct) || 0) / Math.max(1, Number(p.operators) || 1) > takt) };
}
function vfFmtDays(d) { return d === null || d === undefined ? "—" : `${String(Math.round(d * 10) / 10).replace(".", ",")} j`; }
function vfFmtS(s) { return s === null || s === undefined ? "—" : s >= 120 ? `${Math.round(s / 6) / 10} min`.replace(".", ",") : `${Math.round(s)} s`; }
function vfPct(r) { return r === null || r === undefined ? "—" : `${String(Math.round(r * 1000) / 10).replace(".", ",")} %`; }

/* ---------- Carte normalisée (SVG, 1:1, défile en largeur) ---------- */

function vfMap(d, mode) {
  const v = d.vsm[mode], c = vfCalc(v), ps = c.ps, PW = 150, SW = 116, X0 = 24, top = 18;
  if (!ps.length) return '<p class="hint">Ajoutez au moins un processus pour voir la carte.</p>';
  const W = X0 * 2 + ps.length * (PW + SW) + SW + 250, H = 470, yP = 190, yT = 400;
  const factory = (x, y, label, sub) => `<g transform="translate(${x} ${y})"><path class="vf-fac" d="M0 70 V24 L22 8 V24 L44 8 V24 L66 8 V24 L88 8 V70 Z"/><text class="vf-t b" x="44" y="88" text-anchor="middle">${esc(label)}</text>${sub ? `<text class="vf-t s" x="44" y="103" text-anchor="middle">${esc(sub)}</text>` : ""}</g>`;
  const tri = (x, y, qty, days) => `<g transform="translate(${x} ${y})"><path class="vf-tri" d="M0 44 L22 4 L44 44 Z"/><text class="vf-t b" x="22" y="38" text-anchor="middle">I</text><text class="vf-t s" x="22" y="60" text-anchor="middle">${osFinite(qty) ? `${qty} p.` : "?"}</text><text class="vf-t s" x="22" y="74" text-anchor="middle">${vfFmtDays(days)}</text></g>`;
  const push = (x1, x2, y) => `<g class="vf-push"><rect x="${x1}" y="${y - 5}" width="${Math.max(4, x2 - x1 - 14)}" height="10"/><path d="M${x2 - 14} ${y - 11} L${x2} ${y} L${x2 - 14} ${y + 11} Z"/></g>`;
  const burst = (x, y, n) => { const pts = Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 9 : 17, a = (Math.PI * 2 * i) / 16; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(" "); return `<g class="vf-burst"><polygon points="${pts}"/><text class="vf-t b" x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`; };
  let x = X0 + SW, svg = "", ladder = "", bursts = 0;
  const firstStock = X0 + 26, ladderUp = yT - 30, ladderDown = yT;
  ps.forEach((p, i) => {
    const sx = x - SW + 6, days = c.stocks[i];
    svg += tri(sx, yP + 16, p.wip, days);
    svg += push(sx + 50, x - 2, yP + 36);
    const over = c.over.includes(p), isNeck = c.neck === p;
    svg += `<g transform="translate(${x} ${yP})"><rect class="vf-box ${over ? "over" : ""} ${isNeck ? "neck" : ""}" width="${PW}" height="48" rx="3"/><text class="vf-t b" x="${PW / 2}" y="22" text-anchor="middle">${esc((p.name || `Étape ${i + 1}`).slice(0, 20))}</text><text class="vf-t s" x="${PW / 2}" y="39" text-anchor="middle">${"● ".repeat(Math.min(4, Math.max(1, Number(p.operators) || 1))).trim()}</text>
      <rect class="vf-data" y="52" width="${PW}" height="${VF_FIELDS.length * 15 + 8}"/>${VF_FIELDS.map(([k, l, u], j) => `<text class="vf-t d" x="6" y="${66 + j * 15}">${k === "ct" ? "C/T" : k === "va" ? "VA" : k === "changeover" ? "C/O" : k === "uptime" ? "Dispo" : k === "operators" ? "Opér." : "Rebut"} = ${osFinite(p[k]) ? `${String(p[k]).replace(".", ",")}${u ? ` ${u}` : ""}` : "?"}</text>`).join("")}</g>`;
    if (p.burst) { bursts += 1; svg += burst(x + PW - 6, yP - 8, bursts); }
    ladder += `<path class="vf-lad" d="M${x - SW} ${ladderUp} H${x} V${ladderDown} H${x + PW}"/><text class="vf-t s" x="${(x - SW + x) / 2}" y="${ladderUp - 6}" text-anchor="middle">${vfFmtDays(days)}</text><text class="vf-t s" x="${x + PW / 2}" y="${ladderDown + 15}" text-anchor="middle">${vfFmtS(osFinite(p.va) ? p.va : p.ct)}</text>`;
    x += PW + SW;
    if (i < ps.length - 1) ladder += `<path class="vf-lad" d="M${x - SW} ${ladderDown} V${ladderUp}"/>`;
  });
  const fx = x - SW + 6;
  svg += tri(fx, yP + 16, v.fg_wip, c.fg) + push(fx + 46, fx + 46 + 30, yP + 36);
  ladder += `<path class="vf-lad" d="M${x - SW} ${ladderDown} V${ladderUp} H${fx + 70}"/><text class="vf-t s" x="${fx + 22}" y="${ladderUp - 6}" text-anchor="middle">${vfFmtDays(c.fg)}</text>`;
  const right = W - 112;
  svg += factory(X0 - 4, top + 6, v.supplier || "Fournisseur", v.delivery || "");
  svg += factory(right, top + 6, v.customer || "Client", [v.demand_per_day ? `${v.demand_per_day} p./j` : "", c.takt ? `takt ${Math.round(c.takt)} s` : ""].filter(Boolean).join(" · "));
  svg += `<g transform="translate(${W / 2 - 90} ${top + 10})"><rect class="vf-ctl" width="180" height="54" rx="3"/><text class="vf-t b" x="90" y="22" text-anchor="middle">Contrôle de production</text><text class="vf-t s" x="90" y="40" text-anchor="middle">${esc((v.info || "Planning, ERP").slice(0, 30))}</text></g>`;
  svg += `<path class="vf-info" d="M${W / 2 - 90} ${top + 37} H${X0 + 100}"/><path class="vf-info" d="M${right} ${top + 37} H${W / 2 + 90}"/>`;
  const totals = `<g transform="translate(${fx + 96} ${yT - 60})"><rect class="vf-tot" width="150" height="74" rx="4"/><text class="vf-t s" x="10" y="20">Délai : ${vfFmtDays(c.days)}</text><text class="vf-t s" x="10" y="38">VA : ${vfFmtS(c.va)}</text><text class="vf-t b" x="10" y="58">VA / délai : ${vfPct(c.ratio)}</text></g>`;
  return `<div class="vf-scroll"><svg class="vf-map" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="VSM ${mode === "current" ? "état actuel" : "état futur"} : ${ps.map((p) => p.name).join(", ")} ; délai ${vfFmtDays(c.days)}, valeur ajoutée ${vfFmtS(c.va)}">${svg}${ladder}${totals}</svg></div>`;
}

/* ---------- Éditeur pas à pas ---------- */

function vfSum(v) {
  const c = vfCalc(v);
  return `<div class="sm-sum"><div><small>Délai total</small><b>${vfFmtDays(c.days)}</b><small>${c.wip ? `${c.wip} pièces en stock` : "stocks à saisir"}</small></div><div><small>Valeur ajoutée</small><b>${vfFmtS(c.va)}</b><small>par pièce</small></div><div class="${c.ratio !== null && c.ratio < 0.01 ? "warn" : ""}"><small>VA / délai</small><b>${vfPct(c.ratio)}</b></div><div class="${c.over.length ? "warn" : ""}"><small>Takt</small><b>${c.takt ? `${Math.round(c.takt)} s` : "—"}</b><small>${c.over.length ? `${c.over.length} étape(s) au-dessus` : c.neck ? `goulot : ${esc(c.neck.name || "")}` : ""}</small></div></div>`;
}
function vfStep(v, p, i, n, writable) {
  const dis = writable ? "" : "disabled", days = vfDays(v, p.wip, p.wait);
  return `<li class="vf-step" data-vf-n="${esc(p.id)}"><div class="vf-stock"><span class="vf-tri-i" aria-hidden="true">I</span><label>Stock devant<input data-vf-f="wip" type="number" min="0" inputmode="numeric" value="${esc(p.wip ?? "")}" placeholder="pièces" ${dis}></label><span class="hint">${vfFmtDays(days)}</span></div>
    <div class="vf-proc"><div class="tm-pt-head"><span class="st-n">${i + 1}</span><input data-vf-f="name" value="${esc(p.name || "")}" placeholder="Processus (ex. Plaqueuse)" aria-label="Processus ${i + 1}" ${dis}>${writable ? `<button type="button" class="ik-x tm-del" data-vf-up aria-label="Monter" ${i ? "" : "disabled"}>↑</button><button type="button" class="ik-x tm-del" data-vf-down aria-label="Descendre" ${i < n - 1 ? "" : "disabled"}>↓</button><button type="button" class="ik-x tm-del" data-vf-del aria-label="Retirer">×</button>` : ""}</div>
      <div class="vf-grid">${VF_FIELDS.map(([k, l, u]) => `<label>${l}${u ? ` <small>${u}</small>` : ""}<input data-vf-f="${k}" type="number" min="0" step="any" inputmode="decimal" value="${esc(p[k] ?? "")}" ${dis}></label>`).join("")}</div>
      <label class="sm-inl wide vf-burstin">Éclair Kaizen : une amélioration ici ?<input data-vf-f="burst" value="${esc(p.burst || "")}" placeholder="Ex. SMED sur le changement de chant" ${dis}></label></div></li>`;
}
function vfBody(d, mode, tab) {
  const v = d.vsm[mode], writable = vfWritable(d), ps = vfProc(v), dis = writable ? "" : "disabled";
  if (tab === "flux") {
    return `${mode === "future" && !ps.length && writable ? '<section class="cs-empty"><h2>État futur</h2><p>Partez de l’état actuel et transformez-le : flux tiré, stocks réduits, étapes fusionnées.</p><button type="button" class="btn" data-vf-copy>Copier l’état actuel</button></section>' : ""}
      <div class="cs-who-when eq-params"><label>Demande (pièces / jour)<input data-vf-m="demand_per_day" type="number" min="0" inputmode="numeric" value="${esc(v.demand_per_day ?? "")}" ${dis}></label><label>Temps net (min / jour)<input data-vf-m="available_minutes" type="number" min="0" inputmode="numeric" value="${esc(v.available_minutes ?? "")}" ${dis}></label></div>
      <div class="vf-ends"><label>Fournisseur<input data-vf-m="supplier" value="${esc(v.supplier || "")}" placeholder="Ex. Fournisseur panneaux" ${dis}></label><label>Livraisons<input data-vf-m="delivery" value="${esc(v.delivery || "")}" placeholder="Ex. 2 par semaine" ${dis}></label><label>Client<input data-vf-m="customer" value="${esc(v.customer || "")}" placeholder="Ex. Magasins" ${dis}></label><label>Pilotage<input data-vf-m="info" value="${esc(v.info || "")}" placeholder="Ex. ERP, planning hebdo" ${dis}></label></div>
      <ol class="vf-steps">${ps.map((p, i) => vfStep(v, p, i, ps.length, writable)).join("")}</ol>
      ${writable ? '<button type="button" class="btn secondary" data-vf-add>+ Processus</button>' : ""}
      <div class="vf-stock vf-fg"><span class="vf-tri-i" aria-hidden="true">I</span><label>Produits finis<input data-vf-m="fg_wip" type="number" min="0" inputmode="numeric" value="${esc(v.fg_wip ?? "")}" placeholder="pièces" ${dis}></label><span class="hint">${vfFmtDays(vfDays(v, v.fg_wip, null))}</span></div>
      ${ps.length ? '<div class="sm-tools"><button type="button" class="btn" data-vf-tab="carte">Voir la carte</button></div>' : ""}`;
  }
  if (tab === "carte") return `${vfSum(v)}${vfMap(d, mode)}<p class="hint">Échelle de temps : jours de stock en haut, secondes de valeur ajoutée en bas. Contour épais : goulot ; contour rouge : au-dessus du takt.</p><div class="sm-tools"><button type="button" class="btn ghost" data-vf-print>Carte à afficher</button></div>`;
  const cur = vfCalc(d.vsm.current), fut = d.vsm.future && vfProc(d.vsm.future).length ? vfCalc(d.vsm.future) : null;
  const bursts = ["current", "future"].flatMap((m) => vfProc(d.vsm[m] || { nodes: [] }).filter((p) => p.burst).map((p) => ({ m, p })));
  return `${fut ? `<table class="eq-cmp"><thead><tr><th></th><th>Actuel</th><th>Futur</th></tr></thead><tbody><tr><th>Délai total</th><td>${vfFmtDays(cur.days)}</td><td class="${fut.days !== null && cur.days !== null && fut.days < cur.days ? "ok" : ""}">${vfFmtDays(fut.days)}</td></tr><tr><th>Stocks</th><td>${cur.wip} p.</td><td class="${fut.wip < cur.wip ? "ok" : ""}">${fut.wip} p.</td></tr><tr><th>Valeur ajoutée</th><td>${vfFmtS(cur.va)}</td><td>${vfFmtS(fut.va)}</td></tr><tr><th>VA / délai</th><td>${vfPct(cur.ratio)}</td><td class="${(fut.ratio || 0) > (cur.ratio || 0) ? "ok" : ""}">${vfPct(fut.ratio)}</td></tr><tr><th>Étapes</th><td>${cur.ps.length}</td><td>${fut.ps.length}</td></tr></tbody></table>` : '<p class="hint">Dessinez l’état futur (onglet « État futur », puis « Copier l’état actuel ») pour comparer.</p>'}
    <section class="cs-gaps"><h3>Éclairs Kaizen · ${bursts.length}</h3>${bursts.length ? `<ol class="cs-gap-list">${bursts.map(({ m, p }, i) => { const a = p.burst_action_id && data.actions.find((x) => x.id === p.burst_action_id);
      return `<li data-vf-b="${esc(p.id)}" data-vf-bm="${m}"><div><b>${i + 1}. ${esc(p.burst)}</b> <span class="hint">${esc(p.name || "")} · ${m === "current" ? "état actuel" : "état futur"}</span></div>${a ? `<button type="button" class="btn ghost small" data-open-record="${esc(a.id)}">Action ${esc(a.id)} · ${esc(a.status)}</button>` : vfWritable(d) ? `<div class="cs-act-fields"><label>Qui ?<input data-vf-who list="ownerList" value="${esc(d.owner || "")}"></label><label>Pour quand ?<input type="date" data-vf-when value="${auAddDays(30)}"></label></div><button type="button" class="btn small" data-vf-act>Créer l’action</button>` : ""}</li>`; }).join("")}</ol>${ownerDatalist()}` : '<p class="hint">Notez un éclair Kaizen sur une étape (« une amélioration ici ? ») : il apparaît sur la carte et devient une action.</p>'}</section>`;
}
function vfOpen(id, mode = "current", tab = null) {
  const d0 = vfDoc(id);
  if (!d0 || !allowedSite(d0.site_id)) return;
  if (vfWritable(d0) && !d0.vsm) commitData(() => osVsmNormalize(data.documents.find((x) => x.id === id)));
  const d = vfDoc(id);
  osVsmNormalize(d);
  tab ||= vfProc(d.vsm[mode]).length ? "carte" : "flux";
  const tabs = [["flux", "1. Le flux"], ["carte", "2. La carte"], ["kaizen", "3. Améliorations"]];
  modal(`${d.id} · ${d.title}`, `<div class="sm-study vf" data-vf-id="${esc(id)}" data-vf-mode="${mode}"><p class="jn-where">${esc(getSiteName(d.site_id))}${d.structured_data?.family ? ` · famille ${esc(d.structured_data.family)}` : ""} · <button type="button" class="md-link" data-vf-free>Éditeur graphique libre</button></p>
    <div class="filters vf-modes">${[["current", "État actuel"], ["future", "État futur"]].map(([k, l]) => `<button type="button" class="chip ${k === mode ? "active" : ""}" data-vf-mode="${k}" aria-pressed="${k === mode}">${l}</button>`).join("")}</div>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-vf-tab="${k}">${l}</button>`).join("")}</div><div class="sm-body">${vfBody(d, mode, tab)}</div></div>`);
  modalSaver = () => { uxFlush(); return true; };
  vfBind(id, mode, tab);
}
function vfSave(id, mode, fn) {
  const ok = commitData(() => { const d = data.documents.find((x) => x.id === id); osVsmNormalize(d); fn(d.vsm[mode], d); d.updated_at = now(); });
  if (ok) modalDirty = false;
  return ok;
}
function vfReorder(v) { vfProc(v).forEach((p, i) => { p.order = i; p.x = 70 + i * 330; p.y = 100; }); }
function vfBind(id, mode, tab) {
  const root = $("modalContent")?.querySelector(`.vf[data-vf-id="${id}"]`), d = vfDoc(id);
  if (!root || !d) return;
  const redraw = (t = tab, focus = null) => { const box = root.querySelector(".sm-body"), sc = box.closest(".modal"), top = sc?.scrollTop; box.innerHTML = vfBody(vfDoc(id), mode, t); vfBind(id, mode, t); if (sc) sc.scrollTop = top; if (focus) box.querySelector(focus)?.focus({ preventScroll: true }); };
  root.querySelectorAll("button[data-vf-tab]").forEach((b) => (b.onclick = () => { uxFlush(); vfOpen(id, mode, b.dataset.vfTab); }));
  root.querySelectorAll("[data-vf-mode]").forEach((b) => { if (b.tagName === "BUTTON") b.onclick = () => { uxFlush(); const m = b.dataset.vfMode, x = vfDoc(id); osVsmNormalize(x); vfOpen(id, m, vfProc(x.vsm[m]).length || tab === "kaizen" ? tab : "flux"); }; });
  root.querySelector("[data-vf-free]")?.addEventListener("click", () => { uxFlush(); osVsmForm(vfDoc(id), mode); });
  root.querySelector("[data-vf-print]")?.addEventListener("click", () => {
    const x = vfDoc(id);
    modal("Carte à afficher", `<article class="pv-sheet vf-sheet"><header><div><small>VSM · ${mode === "current" ? "ÉTAT ACTUEL" : "ÉTAT FUTUR"}</small><h3>${esc(x.title)}</h3><p>${esc(getSiteName(x.site_id))} · ${esc(x.id)} · ${shortDate(x.updated_at)}</p></div></header>${vfSum(x.vsm[mode])}${vfMap(x, mode)}</article><style media="print">@page{size:A4 landscape;margin:8mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn secondary" data-vf-back>Retour</button></div>`);
    $("modalContent").querySelector("[data-vf-back]").onclick = () => vfOpen(id, mode, "carte");
  });
  if (!vfWritable(d)) return;
  const nOf = (el) => el.closest("[data-vf-n]")?.dataset.vfN;
  root.querySelectorAll("[data-vf-m]").forEach((el) => (el.onchange = () => { const k = el.dataset.vfM, num = el.type === "number"; const val = num ? (el.value === "" ? null : Number(el.value)) : el.value.trim(); if (num && val !== null && (!Number.isFinite(val) || val < 0)) return toast("Nombre positif attendu."); if (vfSave(id, mode, (v, doc) => { v[k] = val; if (k === "family") doc.structured_data = { ...(doc.structured_data || {}), family: val }; }) && num) redraw(); }));
  root.querySelectorAll("[data-vf-f]").forEach((el) => (el.onchange = () => {
    const k = el.dataset.vfF, num = el.type === "number", val = num ? (el.value === "" ? null : Number(el.value)) : el.value.trim(), nid = nOf(el);
    if (num && val !== null && (!Number.isFinite(val) || val < 0)) return toast("Nombre positif attendu.");
    if (k === "uptime" && val > 100) return toast("Disponibilité : 100 % au plus.");
    const p0 = vfProc(vfDoc(id).vsm[mode]).find((p) => p.id === nid);
    if ((k === "va" && osFinite(p0?.ct) && val > p0.ct) || (k === "ct" && osFinite(p0?.va) && val !== null && val < p0.va)) return toast("La valeur ajoutée ne dépasse pas le temps de cycle.");
    if (vfSave(id, mode, (v) => { const p = v.nodes.find((n) => n.id === nid); if (p) p[k] = val; }) && k === "wip") { const h = el.closest(".vf-stock")?.querySelector(".hint"); if (h) h.textContent = vfFmtDays(vfDays(vfDoc(id).vsm[mode], val, null)); }
  }));
  root.querySelector("[data-vf-add]")?.addEventListener("click", () => { uxFlush(); const nid = uid("NODE"); if (vfSave(id, mode, (v) => { vfReorder(v); const n = vfProc(v).length; v.nodes.push({ id: nid, type: "process", name: "", order: n, x: 70 + n * 330, y: 100 }); })) redraw("flux", `[data-vf-n="${nid}"] [data-vf-f="name"]`); });
  const move = (el, dir) => { uxFlush(); const nid = nOf(el); if (vfSave(id, mode, (v) => { vfReorder(v); const ps = vfProc(v), i = ps.findIndex((p) => p.id === nid), j = i + dir; if (j < 0 || j >= ps.length) return; [ps[i].order, ps[j].order] = [ps[j].order, ps[i].order]; ps.forEach((p) => { p.x = 70 + p.order * 330; }); })) redraw(); };
  root.querySelectorAll("[data-vf-up]").forEach((b) => (b.onclick = () => move(b, -1)));
  root.querySelectorAll("[data-vf-down]").forEach((b) => (b.onclick = () => move(b, 1)));
  root.querySelectorAll("[data-vf-del]").forEach((b) => (b.onclick = () => { const li = b.closest("[data-vf-n]"), nid = li.dataset.vfN; if (!li.dataset.confirm) { li.dataset.confirm = "1"; toast("Touchez × encore une fois pour retirer ce processus."); return; } if (vfSave(id, mode, (v) => { v.nodes = v.nodes.filter((n) => n.id !== nid); v.edges = (v.edges || []).filter((e) => e.from !== nid && e.to !== nid); vfReorder(v); })) redraw(); }));
  root.querySelector("[data-vf-copy]")?.addEventListener("click", () => { if (vfSave(id, "future", (v, doc) => { doc.vsm.future = clone(doc.vsm.current); doc.vsm.future.source = "Hypothèses à valider"; doc.vsm.future.nodes.forEach((n) => { delete n.burst_action_id; delete n.burst; }); })) vfOpen(id, "future", "flux"); });
  root.querySelectorAll("[data-vf-act]").forEach((b) => (b.onclick = () => {
    const li = b.closest("[data-vf-b]"), nid = li.dataset.vfB, m = li.dataset.vfBm, who = li.querySelector("[data-vf-who]").value.trim(), when = li.querySelector("[data-vf-when]").value;
    if (!who || !when) return toast("Précisez qui et pour quand.");
    let aid = null;
    if (!commitData(() => { const doc = data.documents.find((x) => x.id === id), p = doc.vsm[m].nodes.find((n) => n.id === nid); aid = auNext("A", data.actions); data.actions.unshift({ id: aid, site_id: doc.site_id, title: p.burst, description: `VSM ${doc.id} · ${doc.title}\nÉclair Kaizen sur « ${p.name || "étape"} » (${m === "current" ? "état actuel" : "état futur"}).`, owner: who, due_date: when, due_date_initial: when, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Flux", origin_type: "VSM", origin_id: doc.id, finding: `${p.name || "Étape"} · C/T ${p.ct ?? "?"} s · stock ${p.wip ?? "?"} p.`, created_at: now(), updated_at: now() }); p.burst_action_id = aid; doc.updated_at = now(); })) return;
    modalDirty = false; toast(`Action ${aid} créée.`); render(); vfOpen(id, mode, "kaizen");
  }));
}

/* ---------- Branchements ---------- */

const vfEditBase = editDocument;
editDocument = function (id) {
  const d = data.documents.find((x) => x.id === id);
  if (d?.type === "VSM" && allowedSite(d.site_id)) return vfOpen(id);
  return vfEditBase.apply(this, arguments);
};
