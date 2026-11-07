"use strict";
/*
 * BIA Lean OS 8.18 · Équilibrage et goulot (Résoudre › Équilibrage) : le Yamazumi.
 *  - Une étude par ligne : demande par jour, temps d'ouverture net, postes (nombre d'opérateurs), éléments de travail.
 *  - Temps relevés au chronomètre poste par poste (« Fin d'élément »), ou saisis ; chaque élément est valeur ajoutée,
 *    nécessaire sans valeur ajoutée, ou gaspillage.
 *  - Yamazumi : une colonne empilée par poste face au takt, le goulot en évidence, capacité par jour face à la demande,
 *    efficacité d'équilibrage, opérateurs nécessaires, part de valeur ajoutée.
 *  - Rééquilibrer : déplacer un élément vers un autre poste, le réduire ou le supprimer ; l'état figé « avant » sert de
 *    comparaison. Les gaspillages deviennent des actions datées. Yamazumi à afficher.
 * Données : balances[] (collection non indexée) ; les actions portent balance_id (origine « Équilibrage »), jamais origin_id.
 */

const EQ_KINDS = [["va", "Valeur ajoutée", "Transforme le produit"], ["nva", "Nécessaire", "Sans valeur, mais requis aujourd’hui"], ["muda", "Gaspillage", "Attente, recherche, déplacement, retouche"]];

function eqCan() { return role().nav.includes("projects"); }
function eqList() { return (data.balances || []).filter((b) => !b.archived_at && allowedSite(b.site_id) && (state.site === "group" || b.site_id === state.site)); }
function eqGet(id) { return (data.balances || []).find((b) => b.id === id && !b.archived_at); }
function eqWritable(b) { return !!b && !role().readonly && allowedSite(b.site_id, true); }
function eqSave(id, fn) { const ok = commitData(() => { const b = data.balances.find((x) => x.id === id); fn(b); b.updated_at = now(); }); if (ok) modalDirty = false; return ok; }
function eqTakt(b) { return b.demand_per_day > 0 && b.available_min > 0 ? (b.available_min * 60) / b.demand_per_day : null; }
function eqCalc(b, src = b) {
  const stations = (src.stations || []).map((s) => {
    const els = (src.elements || []).filter((e) => e.station_id === s.id), work = els.reduce((n, e) => n + (Number(e.sec) || 0), 0), ops = Math.max(1, Number(s.operators) || 1);
    return { s, els, work, ops, ct: work / ops, va: els.filter((e) => e.kind === "va").reduce((n, e) => n + (Number(e.sec) || 0), 0), muda: els.filter((e) => e.kind === "muda").reduce((n, e) => n + (Number(e.sec) || 0), 0) };
  });
  const takt = eqTakt(b), total = stations.reduce((n, x) => n + x.work, 0), ops = stations.reduce((n, x) => n + x.ops, 0), maxCt = Math.max(0, ...stations.map((x) => x.ct));
  const neck = maxCt ? stations.find((x) => x.ct === maxCt) : null;
  return { stations, takt, total, ops, maxCt, neck, va: stations.reduce((n, x) => n + x.va, 0), muda: stations.reduce((n, x) => n + x.muda, 0), eff: ops && maxCt ? total / (ops * maxCt) : null, need: takt ? total / takt : null, cap: maxCt && b.available_min ? Math.floor((b.available_min * 60) / maxCt) : null };
}
function eqPct(n) { return n === null || n === undefined ? "—" : `${Math.round(n * 100)} %`; }
function eqSec(s) { return s === null || s === undefined ? "—" : s < 120 ? `${smNum(s)} s` : smFmt(s); }

/* ---------- Yamazumi ---------- */

function eqChart(b, src = b, { compact = false } = {}) {
  const c = eqCalc(b, src);
  if (!c.stations.length) return "";
  const top = Math.max(c.maxCt, c.takt || 0) * 1.12 || 1, h = (v) => `${((v / top) * 100).toFixed(2)}%`;
  const col = (x) => {
    const over = c.takt && x.ct > c.takt, isNeck = c.neck === x;
    const segs = x.els.map((e) => `<i class="eq-seg k-${e.kind || "va"}" style="flex-grow:${Math.max(0.001, Number(e.sec) || 0)}" title="${esc(e.label || "Élément")} · ${eqSec(Number(e.sec) || 0)}"></i>`).join("");
    return `<div class="eq-col ${over ? "over" : ""} ${isNeck ? "neck" : ""}"><div class="eq-bar"><b class="eq-ct" style="bottom:${h(x.ct)}">${eqSec(x.ct)}</b><div class="eq-stack" style="height:${h(x.ct)}">${segs}</div></div><span class="eq-name">${esc(x.s.name)}${x.ops > 1 ? ` <small>× ${x.ops}</small>` : ""}</span></div>`;
  };
  return `<figure class="eq-chart ${compact ? "compact" : ""}" role="img" aria-label="Yamazumi : ${c.stations.map((x) => `${x.s.name} ${eqSec(x.ct)}`).join(", ")}${c.takt ? `, takt ${eqSec(c.takt)}` : ""}">
    <div class="eq-plot">${c.takt ? `<span class="eq-takt" style="bottom:${h(c.takt)}"><em>Takt ${eqSec(c.takt)}</em></span>` : ""}${c.stations.map(col).join("")}</div>
    <figcaption><span><i class="k-va"></i>Valeur ajoutée</span><span><i class="k-nva"></i>Nécessaire</span><span><i class="k-muda"></i>Gaspillage</span>${c.takt ? '<span><i class="tk"></i>Takt</span>' : ""}</figcaption></figure>`;
}
function eqSum(b, c = eqCalc(b)) {
  const capOk = c.cap !== null && b.demand_per_day ? c.cap >= b.demand_per_day : null;
  return `<div class="sm-sum eq-sum"><div><small>Takt</small><b>${eqSec(c.takt)}</b>${c.takt ? "" : "<small>demande et temps d’ouverture</small>"}</div>
    <div class="${c.takt && c.maxCt > c.takt ? "warn" : c.maxCt ? "ok" : ""}"><small>Goulot</small><b>${eqSec(c.maxCt || null)}</b>${c.neck ? `<small>${esc(c.neck.s.name)}</small>` : ""}</div>
    <div class="${capOk === null ? "" : capOk ? "ok" : "warn"}"><small>Capacité / jour</small><b>${c.cap ?? "—"}</b>${b.demand_per_day ? `<small>demande ${b.demand_per_day}</small>` : ""}</div>
    <div><small>Équilibrage</small><b>${eqPct(c.eff)}</b><small>${c.ops} opérateur${c.ops > 1 ? "s" : ""}${c.need ? ` · ${smNum(c.need)} nécessaires` : ""}</small></div></div>`;
}

/* ---------- Page ---------- */

function eqPage() {
  const list = eqList(), writable = !role().readonly && (state.site === "group" ? canGroup() : osWritable(state.site));
  const head = pageHead("Résoudre", "Équilibrage et goulot", "Le Yamazumi : le temps de chaque poste face au takt, le goulot, et le travail à redistribuer ou à supprimer.", writable && list.length ? '<button type="button" class="btn" data-eq-new>Nouvelle étude de ligne</button>' : "");
  const card = (b) => { const c = eqCalc(b), over = c.takt && c.maxCt > c.takt;
    return `<button type="button" class="cs-card sm-card ${over ? "tone-warn" : c.maxCt ? "tone-ok" : ""}" data-eq-open="${esc(b.id)}"><span class="cs-card-top"><span class="cs-where">${esc(getSiteName(b.site_id))} · ${esc(b.id)}</span><span class="cs-due">${jnPlural(c.stations.length, "poste", "postes")}</span></span><b class="cs-card-name">${esc(b.title)}</b>
      ${c.stations.length ? eqChart(b, b, { compact: true }) : ""}<span class="sm-figs"><span><small>Takt</small><b>${eqSec(c.takt)}</b></span><span class="${over ? "warn" : ""}"><small>Goulot</small><b>${eqSec(c.maxCt || null)}</b></span><span><small>Équilibrage</small><b>${eqPct(c.eff)}</b></span></span></button>`; };
  const how = `<details class="cs-how section"><summary>Le Yamazumi en cinq temps</summary><ol class="cs-how-list"><li><b>Calculer le takt</b><span>Temps d’ouverture net divisé par la demande : le rythme auquel le client achète.</span></li><li><b>Chronométrer chaque poste</b><span>Élément par élément, sur plusieurs cycles ; garder le temps répétable, pas le meilleur.</span></li><li><b>Trier</b><span>Valeur ajoutée, nécessaire sans valeur, gaspillage.</span></li><li><b>Empiler et comparer</b><span>Une colonne par poste face au takt : le goulot saute aux yeux, les postes sous-chargés aussi.</span></li><li><b>Rééquilibrer</b><span>Supprimer les gaspillages, réduire le nécessaire, déplacer des éléments vers les postes moins chargés, puis standardiser.</span></li></ol></details>`;
  return `${head}${list.length ? `<div class="cs-grid eq-grid">${list.map(card).join("")}</div>` : `<section class="cs-empty"><h2>Choisissez une ligne à équilibrer</h2><p>Une ligne qui n’arrive pas à suivre la demande, des postes qui attendent pendant que d’autres débordent, ou une nouvelle cadence à tenir.</p>${writable ? '<button type="button" class="btn" data-eq-new>Nouvelle étude de ligne</button>' : ""}</section>`}${how}`;
}
function eqNew() {
  const sites = OPERATIONAL_SITES.filter((x) => allowedSite(x.id, true));
  if (!sites.length || role().readonly) return toast("Votre profil ne permet pas de créer une étude.");
  const siteId = state.site !== "group" && allowedSite(state.site, true) ? state.site : sites[0].id;
  modal("Nouvelle étude de ligne", `<form id="eqNewForm" class="jn-form sm-new"><label class="field">Ligne et produit<input id="eqTitle" required placeholder="Ex. Ligne finition · panneau 2 000 mm"></label>
    <label class="field">Site<select id="eqSite">${sites.map((x) => `<option value="${x.id}" ${x.id === siteId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
    <label class="field">Pilote<input id="eqOwner" list="ownerList" required value="${esc(apMe() || "")}">${ownerDatalist()}</label>
    <div class="cs-who-when"><label>Demande par jour (pièces)<input id="eqDemand" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. 420"></label><label>Temps d’ouverture net (min / jour)<input id="eqAvail" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. 840"></label></div>
    <p class="hint">Temps net : postes ouverts, moins pauses et réunions. Le takt se calcule tout seul.</p>
    <label class="field">Postes, un par ligne<textarea id="eqStations" rows="4" placeholder="Débit&#10;Plaqueuse&#10;Perçage&#10;Emballage"></textarea></label>
    <label class="field">Chantier lié<select id="eqProject">${smProjectOptions(siteId)}</select></label>
    <div class="form-actions"><button class="btn jn-big">Créer l’étude</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  setTimeout(() => $("eqTitle")?.focus(), 0);
  $("eqSite").onchange = () => { $("eqProject").innerHTML = smProjectOptions($("eqSite").value); };
  $("eqNewForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("eqTitle").value.trim(), owner = $("eqOwner").value.trim(), site = $("eqSite").value;
    if (!title || !owner) return toast("Précisez la ligne et son pilote.");
    if (!allowedSite(site, true)) return toast("Site hors de votre périmètre.");
    const names = $("eqStations").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    const b = { id: auNext("EQ", data.balances || []), site_id: site, project_id: $("eqProject").value || null, title, owner, demand_per_day: Number($("eqDemand").value) || null, available_min: Number($("eqAvail").value) || null, stations: names.map((name) => ({ id: uid("ST"), name, operators: 1 })), elements: [], chrono: null, baseline: null, created_at: now(), updated_at: now() };
    if (!commitData(() => { data.balances ||= []; data.balances.unshift(b); })) return;
    modalDirty = false; render(); eqOpen(b.id, "postes");
  };
}

/* ---------- Étude ---------- */

function eqElRow(b, e, writable, withMove = false) {
  const dis = writable ? "" : "disabled";
  return `<li class="eq-el k-${e.kind || "va"}" data-eq-el="${esc(e.id)}"><div class="tm-pt-head"><input class="sm-label" data-eq-label value="${esc(e.label || "")}" placeholder="Élément de travail (ex. poser le chant)" aria-label="Élément" ${dis}><input class="sm-dur-in" data-eq-sec value="${esc(e.sec < 60 ? String(e.sec).replace(".", ",") : smFmt(e.sec))}" inputmode="decimal" aria-label="Temps en secondes ou minutes:secondes" ${dis}>${writable ? '<button type="button" class="ik-x tm-del" data-eq-del aria-label="Supprimer l’élément">×</button>' : ""}</div>
    <div class="ik-st eq-kinds" role="radiogroup" aria-label="Nature">${EQ_KINDS.map(([k, l]) => `<button type="button" class="ik-s eq-k k-${k} ${(e.kind || "va") === k ? "on" : ""}" data-eq-kind="${k}" role="radio" aria-checked="${(e.kind || "va") === k}" ${dis}>${l}</button>`).join("")}</div>
    ${withMove ? `<label class="sm-inl wide eq-move">Poste<select data-eq-move ${dis}>${b.stations.map((s) => `<option value="${esc(s.id)}" ${s.id === e.station_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}</li>`;
}
function eqBody(b, tab) {
  const writable = eqWritable(b), c = eqCalc(b);
  if (tab === "postes") {
    const ch = b.chrono, run = ch?.started_at && !ch.ended_at;
    return `<div class="cs-who-when eq-params"><label>Demande / jour<input data-eq-param="demand_per_day" type="number" min="1" inputmode="numeric" value="${esc(b.demand_per_day || "")}" ${writable ? "" : "disabled"}></label><label>Ouverture nette (min / jour)<input data-eq-param="available_min" type="number" min="1" inputmode="numeric" value="${esc(b.available_min || "")}" ${writable ? "" : "disabled"}></label></div>
      <p class="eq-taktline">Takt : <b>${eqSec(c.takt)}</b> par pièce${c.need ? ` · contenu de travail ${eqSec(c.total)} → <b>${smNum(c.need)}</b> opérateurs nécessaires` : ""}</p>
      <ol class="eq-stations">${c.stations.map((x, i) => { const isRun = run && ch.station_id === x.s.id;
        return `<li class="eq-station ${c.neck === x ? "neck" : ""}" data-eq-st="${esc(x.s.id)}"><div class="eq-st-head"><span class="st-n">${i + 1}</span><input data-eq-stname value="${esc(x.s.name)}" aria-label="Nom du poste" ${writable ? "" : "disabled"}><span class="eq-st-ct ${c.takt && x.ct > c.takt ? "over" : ""}">${eqSec(x.ct)}</span></div>
          <div class="eq-st-tools"><div class="filters"><span class="hint">Opérateurs</span>${[1, 2, 3].map((n) => `<button type="button" class="chip ${x.ops === n ? "active" : ""}" data-eq-ops="${n}" aria-pressed="${x.ops === n}" ${writable ? "" : "disabled"}>${n}</button>`).join("")}</div>${writable ? (isRun ? "" : `<button type="button" class="btn secondary small" data-eq-chrono ${run ? "disabled" : ""}>Chronométrer ce poste</button>`) : ""}</div>
          ${isRun ? `<section class="sm-chrono on eq-chrono"><div class="sm-clock"><span data-eq-clock>0:00</span><small data-eq-lap>Élément en cours</small></div><div class="sm-chrono-btns"><button type="button" class="btn jn-big sm-lapbtn" data-eq-lapbtn>Fin d’élément</button><button type="button" class="btn jn-big secondary" data-eq-stop>Fin du cycle</button></div></section>` : ""}
          <ol class="eq-els">${x.els.map((e) => eqElRow(b, e, writable)).join("") || '<li class="jn-empty">Aucun élément : chronométrez ou ajoutez-les.</li>'}</ol>
          ${writable ? `<form class="ik-add" data-eq-addel><input data-eq-addin placeholder="Ajouter un élément" enterkeyhint="next" autocomplete="off"><input class="sm-dur-in" data-eq-addsec placeholder="s" inputmode="decimal" aria-label="Temps"><button class="btn secondary" aria-label="Ajouter l’élément">+</button></form>` : ""}</li>`; }).join("")}</ol>
      ${writable ? `<form class="ik-add" data-eq-addst><input data-eq-addstin placeholder="Ajouter un poste" enterkeyhint="done"><button class="btn secondary" aria-label="Ajouter le poste">+</button></form>` : ""}
      ${c.stations.length && c.total ? '<div class="sm-tools"><button type="button" class="btn" data-eq-tab="yamazumi">Voir le Yamazumi</button></div>' : ""}`;
  }
  if (tab === "yamazumi") {
    const neckEls = c.neck ? c.neck.els : [];
    return `${eqSum(b, c)}${eqChart(b)}
      ${c.takt && c.maxCt > c.takt ? `<p class="eq-alert">Le goulot (${esc(c.neck.s.name)}) dépasse le takt de ${eqSec(c.maxCt - c.takt)} : la ligne ne peut pas suivre la demande sans rééquilibrage.</p>` : c.takt && c.maxCt ? `<p class="eq-ok">Tous les postes tiennent le takt. Marge du goulot : ${eqSec(c.takt - c.maxCt)}.</p>` : ""}
      ${c.need && c.ops > Math.ceil(c.need - 0.001) ? `<p class="hint">Contenu de travail pour ${smNum(c.need)} opérateurs, ${c.ops} affectés : de la capacité est disponible pour d’autres tâches ou un poste de moins.</p>` : ""}
      ${writable && c.neck ? `<section><h3>Rééquilibrer le goulot · ${esc(c.neck.s.name)}</h3><p class="hint">Supprimez les gaspillages, réduisez le nécessaire, ou déplacez un élément vers un poste moins chargé.</p><ol class="eq-els">${neckEls.map((e) => eqElRow(b, e, writable, true)).join("")}</ol></section>` : ""}
      ${writable ? `<div class="sm-tools">${b.baseline ? `<span class="hint">État « avant » figé le ${shortDate(b.baseline.at)}.</span><button type="button" class="btn ghost small" data-eq-baseline>Refiger l’état actuel</button>` : '<button type="button" class="btn secondary" data-eq-baseline>Figer l’état actuel comme « avant »</button>'}</div>` : ""}
      <details class="ik-out"><summary>Tous les éléments, poste par poste</summary><ol class="eq-els">${c.stations.flatMap((x) => x.els).map((e) => eqElRow(b, e, writable, true)).join("")}</ol></details>`;
  }
  const base = b.baseline ? eqCalc(b, b.baseline) : null, mudas = (b.elements || []).filter((e) => e.kind === "muda");
  return `${base ? `<section><h3>Avant / après</h3><table class="eq-cmp"><thead><tr><th></th><th>Avant</th><th>Maintenant</th></tr></thead><tbody>
      <tr><th>Goulot</th><td>${eqSec(base.maxCt || null)}</td><td class="${c.maxCt < base.maxCt ? "ok" : ""}">${eqSec(c.maxCt || null)}</td></tr>
      <tr><th>Capacité / jour</th><td>${base.cap ?? "—"}</td><td class="${(c.cap || 0) > (base.cap || 0) ? "ok" : ""}">${c.cap ?? "—"}</td></tr>
      <tr><th>Équilibrage</th><td>${eqPct(base.eff)}</td><td class="${(c.eff || 0) > (base.eff || 0) ? "ok" : ""}">${eqPct(c.eff)}</td></tr>
      <tr><th>Gaspillage</th><td>${eqSec(base.muda)}</td><td class="${c.muda < base.muda ? "ok" : ""}">${eqSec(c.muda)}</td></tr>
      <tr><th>Opérateurs</th><td>${base.ops}</td><td>${c.ops}</td></tr></tbody></table>
      <div class="eq-two"><div><small>Avant</small>${eqChart(b, b.baseline, { compact: true })}</div><div><small>Maintenant</small>${eqChart(b, b, { compact: true })}</div></div></section>` : '<p class="hint">Figez l’état actuel dans l’onglet Yamazumi avant de rééquilibrer : le bilan comparera avant et après.</p>'}
    ${eqSum(b, c)}
    ${writable && mudas.length ? `<section class="cs-gaps"><h3>Gaspillages à supprimer · ${mudas.length}</h3><ol class="cs-gap-list">${mudas.map((e) => { const st = b.stations.find((s) => s.id === e.station_id);
      return `<li data-eq-act="${esc(e.id)}"><label class="cs-act"><input type="checkbox" data-eq-actchk ${e.action_id ? "checked disabled" : e.act === false ? "" : "checked"}> <span><b>${esc(e.label || "Élément")}</b> ${esc(st?.name || "")} · ${eqSec(Number(e.sec) || 0)}${e.action_id ? ` <em>Action ${esc(e.action_id)} créée</em>` : ""}</span></label>${e.action_id ? "" : `<div class="cs-act-fields"><label>Qui ?<input data-eq-who list="ownerList" value="${esc(e.who || b.owner || "")}"></label><label>Pour quand ?<input type="date" data-eq-when value="${esc(e.when || auAddDays(21))}"></label></div>`}</li>`; }).join("")}</ol>${ownerDatalist()}${mudas.some((e) => !e.action_id) ? '<button type="button" class="btn" data-eq-mkactions>Ajouter au plan d’actions</button>' : ""}</section>` : ""}
    <div class="sm-tools"><button type="button" class="btn ghost" data-eq-print>Yamazumi à afficher</button></div>`;
}
function eqOpen(id, tab = null) {
  const b = eqGet(id);
  if (!b || !allowedSite(b.site_id)) return;
  tab ||= b.chrono?.started_at && !b.chrono.ended_at ? "postes" : (b.elements || []).length ? "yamazumi" : "postes";
  const tabs = [["postes", "1. Postes et temps"], ["yamazumi", "2. Yamazumi"], ["bilan", "3. Bilan"]], proj = b.project_id && (data.projects || []).find((p) => p.id === b.project_id);
  modal(`${b.id} · ${b.title}`, `<div class="sm-study eq-study" data-eq-id="${esc(b.id)}"><p class="jn-where">${esc(getSiteName(b.site_id))} · pilote ${esc(b.owner || "à désigner")}${proj ? ` · chantier ${esc(proj.id)}` : ""}</p>
    <div class="filters sm-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" class="chip ${k === tab ? "active" : ""}" role="tab" aria-selected="${k === tab}" data-eq-tab="${k}">${l}</button>`).join("")}</div><div class="sm-body">${eqBody(b, tab)}</div></div>`);
  modalSaver = () => { uxFlush(); return true; };
  eqBind(id, tab);
}
function eqRoot(id) { return $("modalContent")?.querySelector(`.eq-study[data-eq-id="${id}"]`); }
function eqRedraw(id, tab, focusSel = null) {
  const root = eqRoot(id), box = root?.querySelector(".sm-body"), b = eqGet(id);
  if (!box || !b) return;
  const sc = box.closest(".modal"), top = sc?.scrollTop;
  box.innerHTML = eqBody(b, tab);
  eqBind(id, tab);
  if (sc && top !== undefined) sc.scrollTop = top;
  if (focusSel) box.querySelector(focusSel)?.focus({ preventScroll: true });
}
let eqTick = null;
function eqBind(id, tab) {
  const root = eqRoot(id), b = eqGet(id);
  if (!root || !b) return;
  clearInterval(eqTick);
  root.querySelectorAll("button[data-eq-tab]").forEach((x) => (x.onclick = () => { uxFlush(); eqOpen(id, x.dataset.eqTab); }));
  root.querySelector("[data-eq-print]")?.addEventListener("click", () => eqPrint(id));
  if (b.chrono?.started_at && !b.chrono.ended_at && root.querySelector("[data-eq-clock]")) {
    const tick = () => { const x = eqGet(id), el = document.querySelector("[data-eq-clock]"); if (!el || !x?.chrono || x.chrono.ended_at) return clearInterval(eqTick); const t = Date.now(); el.textContent = smFmt((t - Date.parse(x.chrono.started_at)) / 1000); const l = document.querySelector("[data-eq-lap]"); if (l) l.textContent = `Élément en cours · ${smFmt((t - Date.parse(x.chrono.lap_at || x.chrono.started_at)) / 1000)}`; };
    tick(); eqTick = setInterval(tick, 500);
  }
  if (!eqWritable(b)) return;
  const stOf = (el) => el.closest("[data-eq-st]")?.dataset.eqSt, elOf = (el) => el.closest("[data-eq-el]")?.dataset.eqEl;
  const withEl = (el, fn) => { const eid = elOf(el); return eqSave(id, (x) => { const e = x.elements.find((k) => k.id === eid); if (e) fn(e, x); }); };
  const refreshCts = () => { const c = eqCalc(eqGet(id)); c.stations.forEach((x) => { const s = root.querySelector(`[data-eq-st="${x.s.id}"] .eq-st-ct`); if (s) { s.textContent = eqSec(x.ct); s.classList.toggle("over", !!(c.takt && x.ct > c.takt)); } }); const tl = root.querySelector(".eq-taktline"); if (tl) tl.innerHTML = `Takt : <b>${eqSec(c.takt)}</b> par pièce${c.need ? ` · contenu de travail ${eqSec(c.total)} → <b>${smNum(c.need)}</b> opérateurs nécessaires` : ""}`; };
  root.querySelectorAll("[data-eq-param]").forEach((el) => (el.onchange = () => { const v = Number(el.value); if (eqSave(id, (x) => { x[el.dataset.eqParam] = v > 0 ? v : null; })) refreshCts(); }));
  root.querySelectorAll("[data-eq-stname]").forEach((el) => (el.onchange = () => { const v = el.value.trim(); if (v) eqSave(id, (x) => { x.stations.find((s) => s.id === stOf(el)).name = v; }); }));
  root.querySelectorAll("[data-eq-ops]").forEach((el) => (el.onclick = () => { if (eqSave(id, (x) => { x.stations.find((s) => s.id === stOf(el)).operators = Number(el.dataset.eqOps); })) eqRedraw(id, tab); }));
  root.querySelectorAll("[data-eq-label]").forEach((el) => (el.onchange = () => withEl(el, (e) => { e.label = el.value.trim(); })));
  root.querySelectorAll("[data-eq-sec]").forEach((el) => (el.onchange = () => {
    const t = String(el.value).trim(), v = /:/.test(t) ? smParse(t) : Number(t.replace(",", "."));
    if (v === null || !Number.isFinite(v) || v < 0) { toast("Temps en secondes (ex. 12,5) ou minutes:secondes (ex. 1:20)."); return; }
    if (withEl(el, (e) => { e.sec = Math.round(v * 10) / 10; })) { if (tab === "postes") refreshCts(); else eqRedraw(id, tab); }
  }));
  root.querySelectorAll("[data-eq-kind]").forEach((el) => (el.onclick = () => { uxFlush(); if (!withEl(el, (e) => { e.kind = el.dataset.eqKind; })) return; if (tab === "postes") { const li = el.closest("[data-eq-el]"); li.className = `eq-el k-${el.dataset.eqKind}`; li.querySelectorAll("[data-eq-kind]").forEach((k) => { const on = k === el; k.classList.toggle("on", on); k.setAttribute("aria-checked", String(on)); }); } else eqRedraw(id, tab); }));
  root.querySelectorAll("[data-eq-move]").forEach((el) => (el.onchange = () => { const st = eqGet(id).stations.find((s) => s.id === el.value); if (withEl(el, (e) => { e.station_id = el.value; })) { toast(`Élément déplacé vers ${st?.name || "le poste"}.`); eqRedraw(id, tab); } }));
  root.querySelectorAll("[data-eq-del]").forEach((el) => (el.onclick = () => { const li = el.closest("[data-eq-el]"), eid = li.dataset.eqEl; if (!li.dataset.confirm && li.querySelector("[data-eq-label]")?.value.trim()) { li.dataset.confirm = "1"; toast("Touchez × encore une fois pour supprimer l’élément."); return; } if (eqSave(id, (x) => { x.elements = x.elements.filter((e) => e.id !== eid); })) eqRedraw(id, tab); }));
  root.querySelectorAll("[data-eq-addel]").forEach((f) => (f.onsubmit = (ev) => {
    ev.preventDefault();
    const sid = stOf(f), label = f.querySelector("[data-eq-addin]").value.trim(), t = String(f.querySelector("[data-eq-addsec]").value).trim(), v = t ? (/:/.test(t) ? smParse(t) : Number(t.replace(",", "."))) : 0;
    if (!label) return;
    if (v === null || !Number.isFinite(v) || v < 0) return toast("Temps en secondes ou minutes:secondes.");
    if (eqSave(id, (x) => { x.elements.push({ id: uid("EL"), station_id: sid, label, sec: Math.round(v * 10) / 10, kind: "va" }); })) eqRedraw(id, tab, `[data-eq-st="${sid}"] [data-eq-addin]`);
  }));
  root.querySelector("[data-eq-addst]")?.addEventListener("submit", (ev) => { ev.preventDefault(); const v = root.querySelector("[data-eq-addstin]").value.trim(); if (!v) return; if (eqSave(id, (x) => { x.stations.push({ id: uid("ST"), name: v, operators: 1 }); })) eqRedraw(id, tab, "[data-eq-addstin]"); });
  root.querySelectorAll("[data-eq-chrono]").forEach((el) => (el.onclick = () => { const sid = stOf(el); if (eqSave(id, (x) => { x.chrono = { station_id: sid, started_at: now(), lap_at: now() }; })) eqRedraw(id, "postes"); }));
  const lap = (end) => {
    if (!eqSave(id, (x) => { const at = now(), dur = Math.round((Date.parse(at) - Date.parse(x.chrono.lap_at || x.chrono.started_at)) / 100) / 10; if (dur > 0) x.elements.push({ id: uid("EL"), station_id: x.chrono.station_id, label: "", sec: dur, kind: "va" }); x.chrono.lap_at = at; if (end) x.chrono.ended_at = at; })) return;
    eqRedraw(id, "postes");
    if (end) toast("Cycle chronométré : nommez les éléments et classez-les.");
  };
  root.querySelector("[data-eq-lapbtn]")?.addEventListener("click", () => lap(false));
  root.querySelector("[data-eq-stop]")?.addEventListener("click", () => lap(true));
  root.querySelector("[data-eq-baseline]")?.addEventListener("click", () => { if (eqSave(id, (x) => { x.baseline = { at: now(), stations: JSON.parse(JSON.stringify(x.stations)), elements: JSON.parse(JSON.stringify(x.elements)) }; })) { toast("État actuel figé comme « avant »."); eqRedraw(id, tab); } });
  const syncActs = () => root.querySelectorAll("[data-eq-act]").forEach((li) => { const eid = li.dataset.eqAct; eqSave(id, (x) => { const e = x.elements.find((k) => k.id === eid); if (!e || e.action_id) return; e.act = li.querySelector("[data-eq-actchk]").checked; e.who = li.querySelector("[data-eq-who]")?.value.trim(); e.when = li.querySelector("[data-eq-when]")?.value; }); });
  root.querySelectorAll("[data-eq-act] input").forEach((el) => (el.onchange = syncActs));
  root.querySelector("[data-eq-mkactions]")?.addEventListener("click", () => {
    uxFlush(); syncActs();
    const todo = eqGet(id).elements.filter((e) => e.kind === "muda" && !e.action_id && e.act !== false);
    if (!todo.length) return toast("Aucune action cochée à ajouter.");
    if (todo.some((e) => !e.who || !e.when)) return toast("Chaque action a besoin d’un responsable et d’une date.");
    let n = 0;
    if (!commitData(() => {
      const x = data.balances.find((k) => k.id === id);
      for (const e of x.elements.filter((k) => todo.some((t) => t.id === k.id))) {
        const st = x.stations.find((s) => s.id === e.station_id), aid = auNext("A", data.actions);
        data.actions.unshift({ id: aid, site_id: x.site_id, title: `Supprimer : ${e.label || "gaspillage"}`, description: `Équilibrage ${x.id} · ${x.title}\nPoste ${st?.name || ""} : ${e.label || "élément"} (${eqSec(Number(e.sec) || 0)}), classé gaspillage.`, owner: e.who, due_date: e.when, due_date_initial: e.when, priority: "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Flux", origin_type: "Équilibrage", balance_id: x.id, finding: `${st?.name || ""} · ${e.label || ""} · ${eqSec(Number(e.sec) || 0)}`, created_at: now(), updated_at: now() });
        e.action_id = aid; n += 1;
      }
      x.updated_at = now();
    })) return;
    modalDirty = false; toast(`${jnPlural(n, "action ajoutée au plan", "actions ajoutées au plan")}.`); render(); eqOpen(id, "bilan");
  });
}
function eqPrint(id) {
  const b = eqGet(id);
  if (!b) return;
  const c = eqCalc(b);
  modal("Yamazumi à afficher", `<article class="pv-sheet eq-sheet"><header><div><small>YAMAZUMI · ÉQUILIBRAGE DE LIGNE</small><h3>${esc(b.title)}</h3><p>${esc(getSiteName(b.site_id))} · ${esc(b.id)} · ${shortDate(b.updated_at)}</p></div></header>${eqSum(b, c)}${eqChart(b)}
    <table class="eq-cmp"><thead><tr><th>Poste</th><th>Opérateurs</th><th>Cycle</th><th>Valeur ajoutée</th><th>Gaspillage</th></tr></thead><tbody>${c.stations.map((x) => `<tr class="${c.neck === x ? "neck" : ""}"><th>${esc(x.s.name)}</th><td>${x.ops}</td><td>${eqSec(x.ct)}</td><td>${eqSec(x.va)}</td><td>${eqSec(x.muda)}</td></tr>`).join("")}</tbody></table>
    <footer>Le goulot fixe le rythme de toute la ligne : chaque seconde gagnée ailleurs ne sert à rien tant qu’il dépasse le takt.</footer></article>
    <style media="print">@page{size:A4 landscape;margin:8mm}</style><div class="form-actions"><button type="button" class="btn" data-print>Imprimer</button><button type="button" class="btn secondary" data-eq-back>Retour</button></div>`);
  $("modalContent").querySelector("[data-eq-back]").onclick = () => eqOpen(id, "bilan");
}

/* ---------- Branchements ---------- */

const eqRenderProjectsBase = renderProjects;
renderProjects = function () { return state.projectsTab === "equilibrage" && eqCan() ? eqPage() : eqRenderProjectsBase.apply(this, arguments); };
const eqTabsBase = uxTabs;
uxTabs = function (stage) {
  const out = eqTabsBase(stage);
  if (stage?.id !== "resoudre" || !eqCan() || out.some((t) => t.key === "equilibrage")) return out;
  const i = ["smed", "projects"].map((k) => out.findIndex((t) => t.key === k)).find((n) => n >= 0);
  out.splice(i >= 0 ? i + 1 : out.length, 0, { key: "equilibrage", label: "Équilibrage", view: "projects", set: { projectsTab: "equilibrage" } });
  return out;
};
const eqToolLaunchBase = toolLaunch;
toolLaunch = function (tid) {
  if (tid === "bottleneck" && eqCan()) return `<div class="attention-strip"><div><b>Passer à la pratique</b><span>Chronométrez les postes, empilez-les face au takt et rééquilibrez la ligne.</span></div><button class="btn" data-eq-go>Ouvrir l’équilibrage</button></div>`;
  return eqToolLaunchBase.apply(this, arguments);
};
const eqCloseModalBase = closeModal;
closeModal = function () { clearInterval(eqTick); return eqCloseModalBase.apply(this, arguments); };
function eqBindGlobal(root = document) {
  root.querySelectorAll("[data-eq-new]").forEach((x) => (x.onclick = () => eqNew()));
  root.querySelectorAll("[data-eq-open]").forEach((x) => (x.onclick = () => eqOpen(x.dataset.eqOpen)));
  root.querySelectorAll("[data-eq-go]").forEach((x) => (x.onclick = () => { state.projectsTab = "equilibrage"; switchView("projects"); }));
}
const eqOsBindBase = osBind;
osBind = function () { const out = eqOsBindBase.apply(this, arguments); eqBindGlobal(document); return out; };
