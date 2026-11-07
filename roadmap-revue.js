"use strict";
/*
 * BIA Lean OS 8.27 · Roadmap : la revue mensuelle devient un rituel tenu et tracé.
 *  - « Faire la revue » : chaque jalon du plan non atteint et chaque priorité hors plan passe en revue
 *    (atteint, dans les temps, à risque, en retard) ; un mot quand ça ne va pas ; la décision prise, avec
 *    une action datée si besoin ; ce que l'on retient ; la date de la prochaine revue.
 *  - « Atteint » coche le jalon (Responsable Lean) ou termine la priorité ; les autres statuts ne touchent pas
 *    au plan importé.
 *  - Sur la page : la dernière revue, ce qui est en retard ou à risque, la prochaine revue ; l'historique.
 *  - Les priorités hors plan se lisent en liste au téléphone.
 * Données : roadmapReviews[] (non indexée) = { id, date, by, items[{ kind: "jalon"|"priorite", ref, label, s,
 *   note, decision, action_id }], learning, next_date, created_at }.
 */

const RV_ST = [["done", "Atteint"], ["ok", "Dans les temps"], ["risk", "À risque"], ["late", "En retard"]];

function rvCan() { return role().nav.includes("roadmap"); }
function rvWriter() { return rvCan() && !role().readonly && ["lean", "director"].includes(state.role); }
function rvRows() { return (data.roadmapReviews || []).filter((r) => !r.archived_at).sort((a, b) => String(b.date).localeCompare(String(a.date))); }
function rvLast() { return rvRows()[0] || null; }
function rvNext() { const l = rvLast(); return l?.next_date || (l ? auAddDaysFrom(l.date, 30) : null); }
function auAddDaysFrom(d, n) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function rvDueNow() { const n = rvNext(); return !rvLast() || (n && n <= today()); }
function rvItems() {
  const plan = typeof hkPlan === "function" ? hkPlan() : null, out = [];
  (plan?.milestones || []).forEach((m, i) => { if (!m.done) out.push({ kind: "jalon", ref: `M${i}`, i, label: m.name, meta: [m.dateLabel || (m.date ? shortDate(m.date) : ""), m.criteria].filter(Boolean).join(" · "), late: m.date && m.date < today() }); });
  (data.roadmap || []).filter((r) => !r.archived_at && r.status !== "Terminé" && (state.site === "group" || r.site_id === "group" || r.site_id === state.site)).forEach((r) => out.push({ kind: "priorite", ref: r.id, label: r.title, meta: [getSiteName(r.site_id), r.owner, r.target_date ? `échéance ${shortDate(r.target_date)}` : "", `${r.progress || 0} %`].filter(Boolean).join(" · "), late: r.target_date && r.target_date < today(), site_id: r.site_id === "group" ? null : r.site_id }));
  return out;
}

/* ---------- Faire la revue ---------- */

function rvForm() {
  if (!rvWriter()) return toast("La revue est menée par le Responsable Lean ou le directeur de site.");
  const items = rvItems(), prev = rvLast(), st = {};
  items.forEach((it) => { const p = prev?.items.find((x) => x.ref === it.ref); st[it.ref] = { s: it.late ? "late" : "", note: "", decision: "", prev: p }; });
  modal("Revue de la roadmap", `<form id="rvForm" class="jn-form"><p class="jn-lead">Pour chaque jalon et chaque priorité : où en est-on, pourquoi, et qu’est-ce qu’on décide.</p>
    ${items.length ? `<div class="rv-items">${items.map((it) => `<div class="rv-item" data-rv="${esc(it.ref)}"><div class="rv-head"><span class="rv-kind">${it.kind === "jalon" ? "Jalon" : "Priorité"}</span><b>${esc(it.label)}</b><span class="hint">${esc(it.meta)}${st[it.ref].prev ? ` · revue précédente : ${esc(RV_ST.find((x) => x[0] === st[it.ref].prev.s)?.[1] || "")}` : ""}</span></div>
      <div class="rv-st">${RV_ST.map(([k, l]) => `<button type="button" class="rl-sb rv-${k} ${st[it.ref].s === k ? "on" : ""}" data-rv-s="${k}" aria-pressed="${st[it.ref].s === k}">${l}</button>`).join("")}</div>
      <div class="rv-more" ${["risk", "late"].includes(st[it.ref].s) ? "" : "hidden"}><input data-rv-note placeholder="Pourquoi ? En une phrase" aria-label="Pourquoi"><input data-rv-dec placeholder="Décision prise (facultatif)" aria-label="Décision"><label class="cs-act rv-act"><input type="checkbox" data-rv-act> <span>En faire une action</span></label><div class="cs-who-when" hidden><label>Qui ?<input data-rv-who list="ownerList" placeholder="Pilote"></label><label>Pour quand ?<input type="date" data-rv-when min="${today()}" value="${auAddDays(14)}"></label></div></div></div>`).join("")}</div>${ownerDatalist()}` : '<p class="hint">Ni jalon ouvert ni priorité en cours : la revue porte sur ce qu’on retient.</p>'}
    <label class="field">Ce qu’on retient de ce mois<textarea id="rvLearning" rows="2" placeholder="Ce qui marche et qu’on garde, ce qu’on arrête, ce qu’on adapte"></textarea></label>
    <div class="bp-two"><label class="field">Menée par<input id="rvBy" list="ownerList" value="${esc(apMe() || osActor())}"></label><label class="field">Prochaine revue<input type="date" id="rvNext" min="${today()}" value="${auAddDays(30)}"></label></div>
    <div class="form-actions"><button class="btn jn-big">Enregistrer la revue</button><button type="button" class="btn ghost" data-close-modal>Annuler</button></div></form>`);
  const root = $("rvForm");
  root.querySelectorAll("[data-rv]").forEach((box) => {
    const ref = box.dataset.rv, more = box.querySelector(".rv-more");
    box.querySelectorAll("[data-rv-s]").forEach((b) => (b.onclick = () => { st[ref].s = b.dataset.rvS; box.querySelectorAll("[data-rv-s]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); more.hidden = !["risk", "late"].includes(st[ref].s); modalDirty = true; }));
    const chk = box.querySelector("[data-rv-act]");
    chk.onchange = () => { box.querySelector(".cs-who-when").hidden = !chk.checked; };
  });
  root.onsubmit = (e) => {
    e.preventDefault();
    const by = $("rvBy").value.trim(), next = $("rvNext").value, learning = $("rvLearning").value.trim();
    const missing = items.filter((it) => !st[it.ref].s);
    if (missing.length) return toast(`Statut à donner : ${missing.slice(0, 2).map((x) => x.label).join(", ")}${missing.length > 2 ? "…" : ""}`);
    const rows = items.map((it) => { const box = [...root.querySelectorAll("[data-rv]")].find((b) => b.dataset.rv === it.ref); return { it, s: st[it.ref].s, note: box.querySelector("[data-rv-note]").value.trim(), decision: box.querySelector("[data-rv-dec]").value.trim(), act: box.querySelector("[data-rv-act]").checked, who: box.querySelector("[data-rv-who]").value.trim(), when: box.querySelector("[data-rv-when]").value }; });
    const vague = rows.filter((r) => ["risk", "late"].includes(r.s) && !r.note);
    if (vague.length) return toast(`Dites pourquoi : ${vague[0].it.label}`);
    const noOwner = rows.filter((r) => r.act && (!r.who || !r.when));
    if (noOwner.length) return toast(`Action : qui et pour quand ? ${noOwner[0].it.label}`);
    if (!by) return toast("Qui mène la revue ?");
    let rid = null, made = 0;
    if (!commitData(() => {
      data.roadmapReviews ||= [];
      rid = auNext("RV", data.roadmapReviews);
      const out = rows.map((r) => {
        let aid = null;
        if (r.act) {
          aid = auNext("A", data.actions);
          const site = r.it.site_id || (state.site !== "group" ? state.site : "marzin");
          data.actions.unshift({ id: aid, site_id: site, title: r.decision || `Rattraper : ${r.it.label}`, description: `Revue de la roadmap ${rid} · ${r.it.kind === "jalon" ? "jalon" : "priorité"} « ${r.it.label} » : ${RV_ST.find((x) => x[0] === r.s)[1].toLowerCase()}. ${r.note}`, owner: r.who, due_date: r.when, due_date_initial: r.when, priority: r.s === "late" ? "Haute" : "Normale", status: "Ouverte", progress: 0, updates: [], reschedules: [], category: "Standard", origin_type: "Roadmap", origin_id: r.it.kind === "priorite" ? r.it.ref : null, finding: r.it.label, created_at: now(), updated_at: now() });
          made++;
        }
        if (r.s === "done") {
          if (r.it.kind === "jalon" && typeof hkCanPlan === "function" && hkCanPlan() && data.hoshinPlan?.milestones?.[r.it.i]) { const m = data.hoshinPlan.milestones[r.it.i]; m.done = true; m.done_at = today(); }
          if (r.it.kind === "priorite") { const p = data.roadmap.find((x) => x.id === r.it.ref); if (p && allowedSite(p.site_id, true)) { p.status = "Terminé"; p.progress = 100; p.updated_at = now(); recordHistory(p, "Terminé", `Revue ${rid}`); } }
        }
        return { kind: r.it.kind, ref: r.it.ref, label: r.it.label, s: r.s, note: r.note, decision: r.decision, action_id: aid };
      });
      data.roadmapReviews.unshift({ id: rid, date: today(), by, items: out, learning, next_date: next || auAddDays(30), created_at: now() });
    })) return;
    if (typeof idSetMe === "function") idSetMe(by);
    modalDirty = false; closeModal(); render();
    toast(`Revue ${rid} enregistrée${made ? ` · ${jnPlural(made, "action créée", "actions créées")}` : ""}. Prochaine revue le ${shortDate(next || auAddDays(30))}.`);
  };
}

/* ---------- Affichage ---------- */

function rvPanel() {
  const last = rvLast(), next = rvNext(), due = rvDueNow(), w = rvWriter();
  const watch = last ? last.items.filter((x) => ["risk", "late"].includes(x.s)) : [];
  const counts = last ? RV_ST.map(([k, l]) => [l, last.items.filter((x) => x.s === k).length, k]).filter((x) => x[1]) : [];
  const hist = rvRows().slice(1, 6);
  return `<section class="panel section rv-panel ${due ? "due" : ""}"><div class="section-title"><div><h2>Revue de la roadmap</h2><p class="hint">${last ? `Dernière revue le ${shortDate(last.date)} par ${esc(last.by || "—")} · prochaine le ${shortDate(next)}${due ? " : à faire" : ""}` : "Pas encore de revue : résultat, écart, décision, apprentissage, chaque mois."}</p></div>${w ? `<button type="button" class="btn ${due ? "" : "secondary"}" data-rv-new>Faire la revue</button>` : ""}</div>
    ${counts.length ? `<div class="rv-counts">${counts.map(([l, n, k]) => `<span class="rv-c rv-${k}"><b>${n}</b> ${esc(l.toLowerCase())}</span>`).join("")}</div>` : ""}
    ${watch.length ? `<ul class="rv-watch">${watch.map((x) => `<li class="rv-${x.s}"><b>${esc(x.label)}</b><span>${esc(RV_ST.find((y) => y[0] === x.s)[1])} : ${esc(x.note || "")}${x.decision ? ` · décision : ${esc(x.decision)}` : ""}${x.action_id ? ` · <button type="button" class="md-link" data-open-record="${esc(x.action_id)}">${esc(x.action_id)}</button>` : ""}</span></li>`).join("")}</ul>` : ""}
    ${last?.learning ? `<p class="rv-learn"><b>Ce qu’on retient :</b> ${esc(last.learning)}</p>` : ""}
    ${hist.length ? `<details class="ik-out"><summary>Revues précédentes · ${hist.length}</summary><ul class="cd-hist">${hist.map((r) => `<li>${shortDate(r.date)} · ${esc(r.by || "")} · ${RV_ST.map(([k, l]) => { const n = r.items.filter((x) => x.s === k).length; return n ? `${n} ${l.toLowerCase()}` : ""; }).filter(Boolean).join(", ") || "aucun point"}${r.learning ? ` · ${esc(r.learning)}` : ""}</li>`).join("")}</ul></details>` : ""}</section>`;
}

/* ---------- Branchements ---------- */

const rvRenderRoadmapBase = renderRoadmap;
renderRoadmap = function () {
  let html = rvRenderRoadmapBase.apply(this, arguments);
  if (!rvCan()) return html;
  html = html.replace(/<section class="panel section"><h2>Revue mensuelle attendue<\/h2>[\s\S]*?<\/div><\/section>/, "");
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const anchor = tpl.content.querySelector(".hk-cap") || tpl.content.querySelector(".page-head");
  anchor?.insertAdjacentHTML("afterend", rvPanel());
  return tpl.innerHTML;
};
const rvWatchBase = jnWatchCard;
jnWatchCard = function () {
  const base = rvWatchBase();
  if (!rvWriter() || !rvDueNow() || !rvItems().length) return base;
  const last = rvLast(), row = `<button type="button" class="jn-row" data-rv-go><span class="jn-row-main"><span class="jn-tag tone-warn">Roadmap</span><b>Revue de la roadmap à faire</b><span class="hint">${last ? `Dernière le ${shortDate(last.date)}` : "Pas encore de revue"} · ${jnPlural(rvItems().length, "point", "points")} à passer</span></span></button>`;
  if (!base) return `<section class="jn-card jn-watch" aria-label="À surveiller"><div class="jn-card-head"><h2>À surveiller</h2></div><div class="jn-rows">${row}</div></section>`;
  return base.replace(/(<div class="jn-rows">[\s\S]*)(<\/div><\/section>)$/, `$1${row}$2`);
};
function rvBind(root = document) {
  root.querySelectorAll("[data-rv-new]").forEach((b) => (b.onclick = () => rvForm()));
  root.querySelectorAll("[data-rv-go]").forEach((b) => (b.onclick = () => switchView("roadmap")));
}
const rvOsBindBase = osBind;
osBind = function () { const out = rvOsBindBase.apply(this, arguments); rvBind(document); return out; };
