"use strict";
/*
 * AMCO BIA 8.52 · Le coût des actions et les investissements par site (Agir › Plan d'actions, Voir › Gains).
 *  - Une action porte son montant : combien elle coûte, en dépense ou en investissement, et où en est l'engagement.
 *    Jusqu'ici seul un gain portait un coût (son « coût de mise en œuvre »), donc une action sécurité, qui coûte
 *    sans rien rapporter, n'avait nulle part pour l'écrire.
 *  - Trois états, dans l'ordre de l'engagement : Estimé (chiffre de travail) → Engagé (devis signé, commande passée)
 *    → Payé (facture réglée). Le reste à engager est la différence entre le budget du site et ce qui est engagé ou payé.
 *  - Deux natures : Dépense (pièces, prestation, consommable : passe en charges) et Investissement (machine,
 *    équipement : immobilisé). La distinction est celle du contrôle de gestion, pas une nuance de vocabulaire.
 *  - Suivi par site : le total des actions chiffrées de chaque site face à son budget annuel, et la part couverte
 *    par un gain déclaré. Une action chiffrée sans gain n'est pas une anomalie : la sécurité ne se rentabilise pas.
 * Données : actions[] gagnent { amount, amount_kind, amount_state } ; investTargets[] { scope, euros, by, updated_at }
 *   sur le même modèle que gainTargets. Rien n'est obligatoire : une action sans montant se comporte comme avant.
 */

const IV_KINDS = [["depense", "Dépense"], ["invest", "Investissement"]];
const IV_STATES = ["Estimé", "Engagé", "Payé"];
const IV_TONES = { "Estimé": "", "Engagé": "warn", "Payé": "ok" };

function ivNum(v) { return v === "" || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null; }
function ivAmount(a) { const n = ivNum(a && a.amount); return n === null || n < 0 ? null : n; }
function ivKind(a) { return IV_KINDS.some(([k]) => k === (a && a.amount_kind)) ? a.amount_kind : "depense"; }
function ivKindLabel(a) { const k = ivKind(a); return (IV_KINDS.find(([x]) => x === k) || [])[1] || "Dépense"; }
function ivState(a) { return IV_STATES.includes(a && a.amount_state) ? a.amount_state : "Estimé"; }
function ivEuro(n) { return typeof gnEuro === "function" ? gnEuro(n) : `${Math.round(n || 0)} €`; }
function ivChiffrees(rows) { return (rows || []).filter((a) => ivAmount(a) !== null); }

function ivBudget(scope = state.site) {
  const v = (data.investTargets || []).find((x) => x.scope === scope);
  return v ? ivNum(v.euros) : null;
}

function ivHasGain(a) {
  if (!a || typeof gnRows !== "function") return false;
  return (data.gains || []).some((g) => !g.archived_at && g.source_id === a.id);
}

function ivTotals(rows) {
  const t = { n: 0, total: 0, "Estimé": 0, "Engagé": 0, "Payé": 0, depense: 0, invest: 0, avecGain: 0, ouvert: 0 };
  ivChiffrees(rows).forEach((a) => {
    const m = ivAmount(a);
    t.n += 1; t.total += m; t[ivState(a)] += m;
    t[ivKind(a) === "invest" ? "invest" : "depense"] += m;
    if (ivHasGain(a)) t.avecGain += m;
    if (a.status !== "Clôturée") t.ouvert += m;
  });
  return t;
}

/* ---------- Le montant sur la fiche action ---------- */

function ivPill(a) {
  const m = ivAmount(a);
  if (m === null) return "";
  const s = ivState(a);
  return `<span class="iv-pill ${IV_TONES[s] || ""}" title="${esc(`${ivKindLabel(a)} · ${s}`)}">${esc(ivEuro(m))}${s === "Estimé" ? " est." : ""}</span>`;
}

function ivFicheBlock(a, edit) {
  const m = ivAmount(a), s = ivState(a), gain = ivHasGain(a);
  if (!edit) {
    return m === null ? "" : `<div class="ap-field"><span class="metric-label">Coût</span>
      <p>${esc(ivEuro(m))} · ${esc(ivKindLabel(a))} · ${pill(s, IV_TONES[s] || "")}${gain ? " · gain déclaré" : ""}</p></div>`;
  }
  const chips = (items, attr, cur) => items.map(([v, l]) =>
    `<button type="button" class="chip${v === cur ? " active" : ""}" ${attr}="${esc(v)}" aria-pressed="${v === cur}">${esc(l)}</button>`).join("");
  return `<div class="ap-field iv-field"><span class="metric-label">Coût${m !== null ? ` · ${esc(ivEuro(m))}` : ""}</span>
    <div class="form-grid"><label>Montant en euros<input type="number" min="0" step="1" id="ivAmount" value="${m === null ? "" : esc(String(m))}" placeholder="Laisser vide si l’action ne coûte rien"></label></div>
    <div class="filters">${chips(IV_KINDS, "data-iv-kind", ivKind(a))}</div>
    <div class="filters">${chips(IV_STATES.map((x) => [x, x]), "data-iv-state", s)}</div>
    <p class="hint">Dépense : pièces, prestation, consommable. Investissement : machine, équipement.
      Estimé tant que rien n’est commandé, Engagé au devis signé, Payé à la facture.${gain ? " Un gain est déclaré sur cette action : le retour sur investissement se calcule dans Voir › Gains." : ""}</p>
    <button type="button" class="btn dark" data-iv-save>Enregistrer le coût</button></div>`;
}

function ivSetAmount(id, value) {
  const a = data.actions.find((x) => x.id === id), v = String(value).trim();
  const n = v === "" ? null : ivNum(v);
  if (v !== "" && (n === null || n < 0)) { toast("Un montant en euros, ou rien."); return false; }
  const before = ivAmount(a);
  if (before === n) return true;
  return apPatch(id, (row) => { if (n === null) delete row.amount; else row.amount = n; },
    `Coût : ${before === null ? "non chiffré" : ivEuro(before)} → ${n === null ? "non chiffré" : ivEuro(n)}`);
}

function ivSetField(id, field, value) {
  const a = data.actions.find((x) => x.id === id);
  if (!a) return false;
  if (field === "amount_kind" && !IV_KINDS.some(([k]) => k === value)) return false;
  if (field === "amount_state" && !IV_STATES.includes(value)) return false;
  if ((a[field] || "") === value) return true;
  const label = field === "amount_kind" ? "Nature du coût" : "Engagement";
  const was = field === "amount_kind" ? ivKindLabel(a) : ivState(a);
  return apPatch(id, (row) => { row[field] = value; }, `${label} : ${was} → ${field === "amount_kind" ? (IV_KINDS.find(([k]) => k === value) || [])[1] : value}`);
}

/* ---------- Le suivi par site, dans Voir › Gains ---------- */

function ivSiteRows() {
  const sites = OPERATIONAL_SITES.filter((s) => allowedSite(s.id));
  return sites.map((s) => {
    const rows = (data.actions || []).filter((a) => a.site_id === s.id);
    // Le gain attendu du site : le gain déclaré dans Gains quand il existe, sinon l'estimation du pilote.
    const gain = typeof avGain === "function"
      ? ivChiffrees(rows).reduce((n, a) => n + ((avGain(a) || {}).euros || avEstimate(a) || 0), 0) : 0;
    return { site: s, t: ivTotals(rows), budget: ivBudget(s.id), gain };
  }).filter((r) => r.t.n > 0 || r.budget !== null);
}

function ivBlock() {
  const rows = ivSiteRows();
  const head = `<h3>Investissements par site</h3>`;
  if (!rows.length) {
    return `<section class="card iv-card">${head}
      <p class="hint">Aucune action chiffrée pour l’instant. Le montant se saisit sur la fiche d’une action, dans Agir › Plan d’actions : il sert à suivre ce que l’amélioration coûte, même quand elle ne rapporte rien de mesurable.</p></section>`;
  }
  const tot = rows.reduce((o, r) => {
    IV_STATES.forEach((s) => (o[s] += r.t[s]));
    o.total += r.t.total; o.n += r.t.n; o.invest += r.t.invest; o.avecGain += r.t.avecGain;
    o.budget += r.budget || 0; o.gain += r.gain || 0; return o;
  }, { n: 0, total: 0, "Estimé": 0, "Engagé": 0, "Payé": 0, invest: 0, avecGain: 0, budget: 0, gain: 0 });
  const roi = (cost, gain) => typeof avPayback === "function" ? avMonths(avPayback(cost, gain)) : "—";
  const cell = (n) => `<td class="num">${n ? esc(ivEuro(n)) : "—"}</td>`;
  const line = (r) => {
    const pris = r.t["Engagé"] + r.t["Payé"], reste = r.budget === null ? null : r.budget - pris;
    const part = r.budget ? Math.min(1, pris / r.budget) : null;
    return `<tr>
      <td>${esc(r.site.name)}<span class="iv-sub">${r.t.n} action${r.t.n > 1 ? "s" : ""} chiffrée${r.t.n > 1 ? "s" : ""}</span></td>
      ${cell(r.t["Estimé"])}${cell(r.t["Engagé"])}${cell(r.t["Payé"])}
      <td class="num ${r.budget !== null && r.t.total > r.budget ? "iv-over" : ""}" ${r.budget !== null && r.t.total > r.budget ? `title="Le chiffrage dépasse déjà le budget du site"` : ""}>${r.t.total ? esc(ivEuro(r.t.total)) : "—"}</td>
      <td class="num">${r.budget === null ? '<span class="hint">à saisir</span>' : esc(ivEuro(r.budget))}</td>
      <td class="num ${reste !== null && reste < 0 ? "iv-over" : ""}">${reste === null ? "—" : esc(ivEuro(reste))}</td>
      <td class="num">${r.gain ? esc(ivEuro(r.gain)) + " /an" : "—"}</td>
      <td class="num">${esc(roi(r.t.total, r.gain))}</td>
      <td>${part === null ? "—" : `<span class="iv-bar"><i style="width:${Math.round(part * 100)}%"></i></span>`}</td>
    </tr>`;
  };
  const prisTot = tot["Engagé"] + tot["Payé"], budTot = ivBudget("group") ?? (tot.budget || null);
  const gainLine = tot.avecGain
    ? `${esc(ivEuro(tot.avecGain))} portent un gain déclaré`
    : "aucun ne porte encore de gain déclaré";
  return `<section class="card iv-card">${head}
    <p class="hint">Ce que les actions coûtent, par site : estimé tant que rien n’est commandé, engagé au devis signé, payé à la facture.
      Le reste se compte sur l’engagé et le payé, pas sur l’estimé.</p>
    <div class="iv-scroll"><table class="iv-table"><thead><tr>
      <th>Site</th><th class="num">Estimé</th><th class="num">Engagé</th><th class="num">Payé</th><th class="num">Total</th>
      <th class="num">Budget</th><th class="num">Reste</th><th class="num">Gain attendu</th><th class="num">Retour</th><th>Engagé / budget</th></tr></thead>
      <tbody>${rows.map(line).join("")}</tbody>
      <tfoot><tr><td><b>Groupe</b></td>${cell(tot["Estimé"])}${cell(tot["Engagé"])}${cell(tot["Payé"])}${cell(tot.total)}
        <td class="num">${budTot ? esc(ivEuro(budTot)) : "—"}</td>
        <td class="num ${budTot && budTot - prisTot < 0 ? "iv-over" : ""}">${budTot ? esc(ivEuro(budTot - prisTot)) : "—"}</td>
        <td class="num">${tot.gain ? esc(ivEuro(tot.gain)) + " /an" : "—"}</td>
        <td class="num">${esc(roi(tot.total, tot.gain))}</td><td></td></tr></tfoot>
    </table></div>
    <p class="hint">Sur ${esc(ivEuro(tot.total))} chiffrés, ${esc(ivEuro(tot.invest))} en investissement et ${esc(ivEuro(tot.total - tot.invest))} en dépense ;
      ${gainLine}. Une action sans gain n’est pas une anomalie : la sécurité ne se rentabilise pas.</p>
    <div class="form-actions">
      ${osManager() && !role().readonly ? `<button type="button" class="btn secondary" data-iv-budget>Budget ${state.site === "group" ? "du groupe" : "du site"}</button>` : ""}
      <button type="button" class="btn secondary" data-iv-csv>Exporter en CSV</button></div></section>`;
}

function ivBudgetModal() {
  const scope = state.site, name = getSiteName(scope) || "le groupe", cur = ivBudget(scope);
  modal("Budget d’investissement", `<form id="ivTgForm">
    <p class="hint">Budget annuel des actions chiffrées pour ${esc(name)}. Il sert de repère au tableau, rien de plus : aucune action n’est bloquée quand il est dépassé.</p>
    <label class="field">Montant en euros<input type="number" min="0" step="100" id="ivTg" value="${cur === null ? "" : esc(String(cur))}"></label>
    <div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("ivTgForm").onsubmit = (e) => {
    e.preventDefault();
    const v = ivNum($("ivTg").value);
    if (v === null || v < 0) return toast("Un montant.");
    if (!commitData(() => {
      data.investTargets ||= [];
      const o = data.investTargets.find((x) => x.scope === scope);
      if (o) Object.assign(o, { euros: v, updated_at: now() });
      else data.investTargets.push({ scope, euros: v, by: (typeof apMe === "function" && apMe()) || role().label, updated_at: now() });
    })) return;
    modalDirty = false; closeModal(); render(); toast("Budget enregistré.");
  };
}

function ivCsv() {
  const head = ["id", "site", "titre", "famille", "montant_euros", "nature", "engagement", "statut_action", "avancement_pct", "pilote", "echeance", "gain_annuel_euros", "retour_mois", "gain_declare"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = ivChiffrees(osScope(data.actions || [])).map((a) => [a.id, getSiteName(a.site_id), a.title, actionFamily(a),
    ivAmount(a), ivKindLabel(a), ivState(a), a.status,
    typeof avProgress === "function" ? avProgress(a) : "",
    a.owner || "À désigner", a.due_date || "",
    (typeof avGain === "function" && ((avGain(a) || {}).euros || avEstimate(a))) || "",
    (() => { const g = typeof avGain === "function" ? ((avGain(a) || {}).euros || avEstimate(a)) : 0;
             const m = typeof avPayback === "function" ? avPayback(ivAmount(a), g) : null;
             return m === null ? "" : Math.round(m); })(),
    ivHasGain(a) ? "oui" : "non"].map(q).join(";"));
  const blob = new Blob(["﻿" + [head.join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `amco-bia-investissements-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ivBind(root = document) {
  root.querySelectorAll("[data-iv-budget]").forEach((b) => (b.onclick = () => ivBudgetModal()));
  root.querySelectorAll("[data-iv-csv]").forEach((b) => (b.onclick = () => ivCsv()));
}

/* ---------- Greffes ---------- */

{
  const basePage = gnPage;
  gnPage = function () {
    const html = basePage.apply(this, arguments);
    return typeof html === "string" ? html + ivBlock() : html;
  };

  const baseGnBind = typeof gnBind === "function" ? gnBind : null;
  if (baseGnBind) {
    gnBind = function (root = document) {
      const r = baseGnBind.apply(this, arguments);
      ivBind(root);
      return r;
    };
  }

  const baseRow = apRow;
  apRow = function (a, compact = false) {
    const html = baseRow.apply(this, arguments), p = ivPill(a);
    if (!p || typeof html !== "string") return html;
    return html.replace('<span class="ap-row-side">', `<span class="ap-row-side">${p}`);
  };

  const baseOpen = apOpen;
  apOpen = function (id) {
    baseOpen.apply(this, arguments);
    const a = data.actions.find((x) => x.id === id);
    if (!a) return;
    const host = $("modalContent") && $("modalContent").querySelector(".ap-fiche");
    if (!host) return;
    const edit = apCanEdit(a) && a.status !== "Clôturée";
    const block = ivFicheBlock(a, edit);
    if (!block) return;
    const journal = Array.from(host.children).find((el) =>
      el.classList.contains("ap-field") && /Journal/.test(el.querySelector(".metric-label")?.textContent || ""));
    const wrap = document.createElement("div");
    wrap.innerHTML = block;
    const node = wrap.firstElementChild;
    if (journal) host.insertBefore(node, journal); else host.appendChild(node);
    const after = (ok) => { if (ok) { render(); apOpen(id); } };
    node.querySelectorAll("[data-iv-kind]").forEach((b) => (b.onclick = () => after(ivSetField(id, "amount_kind", b.dataset.ivKind))));
    node.querySelectorAll("[data-iv-state]").forEach((b) => (b.onclick = () => after(ivSetField(id, "amount_state", b.dataset.ivState))));
    const save = node.querySelector("[data-iv-save]");
    if (save) save.onclick = () => after(ivSetAmount(id, $("ivAmount") ? $("ivAmount").value : ""));
  };
}
