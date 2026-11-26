"use strict";
/*
 * AMCO BIA 8.56 · La charge par personne, au bas du plan d'actions.
 *
 *  Qui porte quoi, et qui n'en peut plus. Le plan d'actions savait déjà regrouper la liste par pilote,
 *  mais pas comparer : il fallait compter à la main pour voir que trois personnes portent la moitié du
 *  plan, ou qu'un chef d'équipe cumule six actions en retard pendant qu'un autre en a une.
 *
 *  CE QUE CE TABLEAU MESURE, ET CE QU'IL NE MESURE PAS. Il compte des actions, pas des heures.
 *  Une action peut valoir dix minutes ou trois jours : aucun champ de l'application ne le dit
 *  aujourd'hui. Six actions en retard chez la même personne restent un signal fort — c'est ce qui
 *  se voit dans un plan d'actions réel — mais ce n'est pas un plan de charge, et il ne faut pas
 *  l'utiliser pour arbitrer une embauche ou un transfert de poste.
 *
 *  Les colonnes sont choisies pour une seule question : à qui faut-il enlever quelque chose ?
 *  En retard d'abord, puis ce qui tombe cette semaine, puis les avancées figées. Le nombre total
 *  d'actions vient en dernier, parce que c'est le chiffre le moins parlant.
 */

const WL_CONCENTRATION = 0.3; /* au-delà d'un tiers du plan ouvert sur une personne, on le dit */

function wlPeople() {
  const open = scoped(data.actions).filter(isOpenAction);
  const by = new Map();
  open.forEach((a) => {
    const name = apOwnerless(a) ? "À désigner" : a.owner;
    if (!by.has(name)) by.set(name, { name, rows: [], late: 0, week: 0, frozen: 0, noDate: 0, safety: 0, cost: 0, oldest: null });
    const p = by.get(name), i = apInfo(a);
    p.rows.push(a);
    if (i.late) p.late += 1;
    if (i.week) p.week += 1;
    if (typeof avFrozen === "function" && avFrozen(a)) p.frozen += 1;
    if (i.noDate) p.noDate += 1;
    if (i.safety) p.safety += 1;
    if (typeof ivAmount === "function") p.cost += ivAmount(a) || 0;
    if (a.due_date && i.late && (!p.oldest || a.due_date < p.oldest)) p.oldest = a.due_date;
  });
  const list = [...by.values()].sort((x, y) =>
    (x.name === "À désigner") - (y.name === "À désigner") ||
    y.late - x.late || y.week - x.week || y.rows.length - x.rows.length || x.name.localeCompare(y.name, "fr"));
  return { list, total: open.length };
}

function wlFindings(people, total) {
  const out = [];
  const nobody = people.find((p) => p.name === "À désigner");
  if (nobody) out.push(`${nobody.rows.length} action${nobody.rows.length > 1 ? "s" : ""} sans pilote : elles ne sont portées par personne et n’avanceront pas toutes seules.`);
  const named = people.filter((p) => p.name !== "À désigner");
  const top = named[0];
  if (top && total && top.rows.length / total >= WL_CONCENTRATION && named.length > 1) {
    out.push(`${top.name} porte ${top.rows.length} des ${total} actions ouvertes, soit ${Math.round((top.rows.length / total) * 100)} % du plan.`);
  }
  const charges = named.filter((p) => p.late >= 3);
  if (charges.length) {
    const qui = charges.map((p, i) => `${p.name} ${i ? "en a" : "a"} ${p.late} action${p.late > 1 ? "s" : ""} en retard`);
    out.push(`${qui.join(", ")}. C’est là qu’il faut enlever quelque chose, pas en ajouter.`);
  }
  return out;
}

function wlBlock() {
  const { list, total } = wlPeople();
  if (!list.length) return "";
  const named = list.filter((p) => p.name !== "À désigner").length;
  const max = Math.max(...list.map((p) => p.rows.length), 1);
  const findings = wlFindings(list, total);
  const num = (n, cls = "") => `<td class="num ${n ? cls : "wl-zero"}">${n || "—"}</td>`;
  const line = (p) => `<tr class="${p.name === "À désigner" ? "wl-nobody" : ""}">
    <td><b>${esc(p.name)}</b>${p.oldest ? `<span class="wl-sub">plus vieux retard : ${esc(shortDate(p.oldest))}</span>` : ""}</td>
    ${num(p.late, "wl-bad")}${num(p.week)}${num(p.frozen, "wl-warn")}${num(p.noDate)}${num(p.safety, "wl-bad")}
    <td class="num">${p.rows.length}</td>
    <td><span class="wl-bar"><i style="width:${Math.round((p.rows.length / max) * 100)}%"></i></span></td>
    <td class="num">${p.cost ? esc(ivEuro(p.cost)) : "—"}</td>
    <td>${role().readonly ? "" : `<button type="button" class="md-link" data-wl-owner="${esc(p.name)}">Voir</button>`}</td>
  </tr>`;
  return `<section class="panel section wl-card">
    <div class="section-title"><h2>Charge par personne</h2>
      <span class="hint">${total} action${total > 1 ? "s" : ""} ouverte${total > 1 ? "s" : ""} · ${named} pilote${named > 1 ? "s" : ""}</span></div>
    ${findings.length ? `<ul class="wl-findings">${findings.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    <div class="wl-scroll"><table class="iv-table wl-table"><thead><tr>
      <th>Pilote</th><th class="num">En retard</th><th class="num">Cette semaine</th><th class="num">Figées</th>
      <th class="num">Sans date</th><th class="num">Sécurité</th><th class="num">Ouvertes</th><th>Part</th>
      <th class="num">Engagé</th><th></th></tr></thead>
      <tbody>${list.map(line).join("")}</tbody></table></div>
    <p class="hint">Ce tableau compte des actions, pas des heures : une action peut valoir dix minutes ou trois jours.
      Il sert à repérer à qui enlever quelque chose, pas à bâtir un plan de charge.</p></section>`;
}

function wlBind(root = document) {
  root.querySelectorAll("[data-wl-owner]").forEach((b) => (b.onclick = () => {
    state.actionOwner = b.dataset.wlOwner === "À désigner" ? "none" : b.dataset.wlOwner;
    state.actionView = "todo";
    render();
    const el = document.querySelector(".ap-section");
    if (el) el.scrollIntoView({ block: "start" });
    toast(`Plan filtré sur ${b.dataset.wlOwner}.`);
  }));
}

{
  /* La charge se place entre la liste et l'historique des revues : plus actionnable que les revues passées. */
  const baseHistory = apReviewsHistory;
  apReviewsHistory = function () {
    const html = baseHistory.apply(this, arguments);
    return wlBlock() + (typeof html === "string" ? html : "");
  };
  const baseBind = typeof apBind === "function" ? apBind : null;
  if (baseBind) {
    apBind = function () {
      const r = baseBind.apply(this, arguments);
      wlBind();
      return r;
    };
  }
}
