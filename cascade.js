"use strict";
/*
 * BIA Lean OS 8.34 · La cascade : TOP 5 → TOP 15 → revue hebdomadaire du site → revue mensuelle des sites → COPIL, COMEX,
 * et la réponse qui redescend jusqu'à celui qui a remonté.
 *  - TOP 5 (atelier, chaque jour, 5 min) : le point SQCDP du jour, lettre par lettre ; un écart devient un sujet remonté
 *    au TOP 15 ; « Réponses à dire à l'équipe » ferme la boucle (« Dit à l'équipe »).
 *  - TOP 15 (site, chaque jour ouvré, 15 min) : sécurité des dernières 24 h, lettres SQCDP des ateliers et TOP 5 tenus,
 *    ce que les TOP 5 ont remonté (répondre ou monter à la revue hebdomadaire), réponses venues du dessus, actions.
 *  - Revue hebdomadaire du site et revue mensuelle des sites : « Remonté du niveau du dessous » (répondre ou monter ;
 *    la mensuelle peut porter un sujet au COPIL ou au COMEX) et « Réponses à redescendre ».
 *  - COPIL et COMEX : les sujets portés par la revue mensuelle s'ajoutent aux décisions à prendre.
 *  - « La cascade » en tête des réunions : chaque niveau, ce qui y attend une réponse, ce qui doit y être redit,
 *    les TOP 5 et TOP 15 tenus aujourd'hui, les boucles fermées sur 30 jours et leur délai.
 *  - Niveaux renommés partout : N1 · TOP 5, N2 · TOP 15, N3 · revue hebdomadaire du site, N4 · Groupe.
 * Données : topics[] (+ answered_at, answered_by, returned_at, returned_by, carried_by) ;
 *   escalations[] (+ origin_level, forum « copil »|« comex », path[{ from, to, at, by }], answered_at, answered_by,
 *   returned_at, returned_by). Une boucle est fermée quand la réponse a été redite au niveau d'origine.
 */

const CG_LEVEL_OF = { top15: 2, hebdo: 3, mensuelle: 4, copil: 4, comex: 4 };
const CG_NAME = { 1: "TOP 5", 2: "TOP 15", 3: "la revue hebdomadaire", 4: "la revue mensuelle" };
const CG_NEXT = { 2: "la revue hebdomadaire du site", 3: "la revue mensuelle des sites" };

/* ---------- Ce qui attend une réponse, ce qui doit redescendre ---------- */

function cgTopics() { return osActive(data.topics).filter((t) => t.status !== "Clos"); }
function cgEscs() { return osActive(data.escalations).filter((e) => e.status !== "Clos"); }
function cgOrigin(e) { return Number(e.origin_level) || Math.max(1, Number(e.level) - 1); }
function cgCarried(t) { return !!t.carried_by && cgEscs().some((e) => e.id === t.carried_by); }
function cgWaiting(level, { site = null, forum } = {}) {
  const out = [];
  if (level === 2) cgTopics().filter((t) => !t.answered_at && !cgCarried(t) && (!site || t.site_id === site)).forEach((t) => out.push({ kind: "topic", id: t.id, site_id: t.site_id, title: t.title, origin: 1, since: t.created_at, ws: t.workshop_id || null }));
  cgEscs().filter((e) => !e.answered_at && Number(e.level) === level && (!site || e.site_id === site) && (level < 4 || (forum ? e.forum === forum : !e.forum || e.forum === "mensuelle")))
    .forEach((e) => out.push({ kind: "esc", id: e.id, site_id: e.site_id, title: e.title, origin: cgOrigin(e), since: e.created_at, detail: e.detail }));
  return out.sort((a, b) => String(a.since).localeCompare(String(b.since)));
}
function cgToReturn(level, { site = null, ws } = {}) {
  const out = [];
  if (level === 1) cgTopics().filter((t) => t.answered_at && !t.returned_at && (!site || t.site_id === site) && (!ws || !t.workshop_id || t.workshop_id === ws)).forEach((t) => out.push({ kind: "topic", id: t.id, site_id: t.site_id, title: t.title, answer: t.decision, by: t.answered_by, at: t.answered_at }));
  cgEscs().filter((e) => e.answered_at && !e.returned_at && cgOrigin(e) === level && (!site || e.site_id === site) && !osActive(data.topics).some((t) => t.carried_by === e.id))
    .forEach((e) => out.push({ kind: "esc", id: e.id, site_id: e.site_id, title: e.title, answer: e.result, by: e.answered_by, at: e.answered_at }));
  return out;
}
function cgAge(since) { const h = (Date.now() - Date.parse(since || now())) / 36e5; return h < 1 ? "moins d’1 h" : h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} j`; }

/* ---------- Écritures (dans le commit de la clôture ou d'un geste) ---------- */

function cgAnswerRow(it, text, by) {
  const at = now();
  if (it.kind === "topic") { const t = data.topics.find((x) => x.id === it.id); if (t) Object.assign(t, { decision: text, answered_at: at, answered_by: by, status: "En cours", updated_at: at }); return; }
  const e = data.escalations.find((x) => x.id === it.id);
  if (!e) return;
  Object.assign(e, { origin_level: cgOrigin(e), result: text, answered_at: at, answered_by: by, answer_level: Number(e.level), status: "En cours", updated_at: at });
  const t = data.topics.find((x) => x.carried_by === e.id);
  if (t) Object.assign(t, { decision: text, answered_at: at, answered_by: by, status: "En cours", updated_at: at });
}
function cgUpRow(it, to, by) {
  const at = now();
  if (it.kind === "topic") {
    const t = data.topics.find((x) => x.id === it.id);
    if (!t) return null;
    const id = auNext("ESC", data.escalations), ws = t.workshop_id ? osRecord(t.workshop_id)?.row?.name : "";
    data.escalations.unshift({ id, site_id: t.site_id, source_id: t.id, title: t.title, level: 3, origin_level: 1, owner: "Responsable de site", due_date: reAddDays(today(), 7), detail: `Remonté du TOP 5${ws ? ` · ${ws}` : ""} par le TOP 15 du ${shortDate(today())}.`, result: "", status: "Ouverte", path: [{ from: 2, to: 3, at, by }], raised_by: by, created_at: at, updated_at: at });
    Object.assign(t, { carried_by: id, status: "En cours", updated_at: at });
    return id;
  }
  const e = data.escalations.find((x) => x.id === it.id);
  if (!e) return null;
  const lv = Number(e.level);
  e.origin_level = cgOrigin(e);
  (e.path ||= []).push({ from: lv, to: lv >= 4 ? to : lv + 1, at, by });
  if (lv >= 4) { e.forum = to; e.owner = to === "comex" ? "Direction générale" : "COPIL"; }
  else { e.level = lv + 1; e.due_date = reAddDays(today(), lv + 1 >= 4 ? 30 : 7); e.status = "Ouverte"; }
  e.updated_at = at;
  return e.id;
}
function cgReturnRow(it, by) {
  const at = now(), close = (row, label) => { if (!row) return; Object.assign(row, { returned_at: at, returned_by: by, status: "Clos", updated_at: at }); recordHistory(row, "Clos", label); };
  if (it.kind === "topic") {
    const t = data.topics.find((x) => x.id === it.id);
    close(t, "Réponse redite au TOP 5 : boucle fermée");
    if (t?.carried_by) close(data.escalations.find((e) => e.id === t.carried_by && e.status !== "Clos"), "Réponse redite au TOP 5 : boucle fermée");
    return;
  }
  close(data.escalations.find((x) => x.id === it.id), `Réponse redite à ${CG_NAME[it.origin] || "l’origine"} : boucle fermée`);
}
/* Appelée par reClose dans le même commit : réponses, montées, réponses redites. */
function cgApply(r, d, by) {
  const lvl = CG_LEVEL_OF[r.type], out = [];
  if (!lvl) return out;
  const site = RE_SITE_TYPES.includes(r.type) ? r.site_id : null, forum = ["copil", "comex"].includes(r.type) ? r.type : undefined;
  for (const it of cgWaiting(lvl, { site, forum })) {
    const a = String(d.ans?.[it.id] || "").trim(), up = d.up?.[it.id];
    if (a) { cgAnswerRow(it, a, by); out.push({ text: `Réponse à « ${it.title} » : ${a} (redescend au ${CG_NAME[it.origin] || "niveau d’origine"})` }); }
    else if (up && !forum) { const to = lvl >= 4 ? up : lvl + 1; cgUpRow(it, to, by); out.push({ text: `« ${it.title} » monte ${lvl >= 4 ? `au ${String(to).toUpperCase()}` : `à ${CG_NEXT[lvl]}`}` }); }
  }
  const back = cgToReturn(lvl, { site });
  for (const id of d.ret || []) { const it = back.find((x) => x.id === id); if (it) { cgReturnRow({ ...it, origin: lvl }, by); out.push({ text: `Réponse redite : « ${it.title} » (boucle fermée)` }); } }
  return out;
}

/* ---------- Points du dossier ---------- */

function cgItemsHtml(items, r, dr, { forumOnly = false } = {}) {
  const hold = reHold(r), lvl = CG_LEVEL_OF[r.type];
  return items.map((it) => {
    const up = forumOnly ? "" : r.type === "mensuelle"
      ? `<select data-re-up="${esc(it.id)}" aria-label="Porter plus haut"><option value="">Garder à la revue mensuelle</option><option value="copil" ${dr.up?.[it.id] === "copil" ? "selected" : ""}>Porter au COPIL</option><option value="comex" ${dr.up?.[it.id] === "comex" ? "selected" : ""}>Porter au COMEX</option></select>`
      : `<label class="cg-up"><input type="checkbox" data-re-up="${esc(it.id)}" ${dr.up?.[it.id] ? "checked" : ""}> Monter à ${esc(CG_NEXT[lvl])}</label>`;
    return `<li class="cg-item"><b>${reRec(it.id)} ${esc(it.title)}</b><small>Remonté par le ${esc(CG_NAME[it.origin] || "terrain")}${r.site_id === "group" ? ` · ${esc(getSiteName(it.site_id))}` : ""} · depuis ${cgAge(it.since)}${it.detail ? ` · ${esc(it.detail)}` : ""}</small>${hold ? `<div class="cg-do"><input data-re-ans="${esc(it.id)}" value="${esc(dr.ans?.[it.id] || "")}" placeholder="Réponse : elle redescendra au ${esc(CG_NAME[it.origin] || "niveau d’origine")}" autocomplete="off">${up}</div>` : ""}</li>`;
  });
}
function cgBlock(key, r) {
  const lvl = CG_LEVEL_OF[r.type], site = RE_SITE_TYPES.includes(r.type) ? r.site_id : null, hold = reHold(r), dr = reCurrentDraft || {};
  if (key === "securite24") {
    const since = new Date(Date.now() - 864e5).toISOString(), rows = osActive(data.signals).filter((s) => s.site_id === site && ((String(s.created_at) >= since && (/sécurité/i.test(s.type || "") || s.severity === "Critique")) || (isOpenSignal(s) && s.severity === "Critique")));
    return { n: rows.length, html: reLi(rows.slice(0, 5).map((s) => `<li>${pill(s.severity, s.severity === "Critique" ? "critical" : "open")} ${reRec(s.id)} ${esc(s.description || "")} <small>${esc(s.state || "")}${s.owner ? ` · ${esc(s.owner)}` : ""}</small></li>`), "Rien en sécurité depuis 24 h.") };
  }
  if (key === "lettres") {
    const wss = osActive(data.workshops).filter((w) => w.site_id === site), days = (data.sqcdpDays || []).filter((d) => d.site_id === site && d.date === today()), ms = (data.meetings || []).filter((m) => m.site_id === site && m.date === today());
    const lines = [...wss.map((w) => ({ id: w.id, name: w.name })), ...(days.some((d) => !d.workshop_id) || !wss.length ? [{ id: null, name: wss.length ? "Site (sans atelier)" : getSiteName(site) }] : [])];
    const ko = days.filter((d) => d.status === "ko").length, held = lines.filter((l) => ms.some((m) => (m.workshop_id || null) === l.id)).length;
    const cell = (l, a) => { const d = days.find((x) => (x.workshop_id || null) === l.id && x.axis === a); return `<td class="cg-l ${d ? d.status : "none"}" title="${esc(d ? (d.status === "ok" ? "Bonne journée" : d.note || "Écart") : "Non renseigné")}">${d ? (d.status === "ok" ? "✓" : "✗") : "·"}</td>`; };
    return { n: ko, html: `<p class="re-fact">${held}/${lines.length} TOP 5 tenu${held > 1 ? "s" : ""} aujourd’hui · ${jnPlural(ko, "écart", "écarts")}</p><div class="cn-scroll"><table class="re-table cg-letters"><thead><tr><th>Atelier</th>${SJ_AXES.map((a) => `<th style="color:${AXES[a].color}">${a}</th>`).join("")}<th>TOP 5</th></tr></thead><tbody>${lines.map((l) => `<tr><th>${esc(l.name)}</th>${SJ_AXES.map((a) => cell(l, a)).join("")}<td>${ms.some((m) => (m.workshop_id || null) === l.id) ? "tenu" : "—"}</td></tr>`).join("")}</tbody></table></div>${days.filter((d) => d.status === "ko" && d.note).length ? reLi(days.filter((d) => d.status === "ko" && d.note).map((d) => `<li class="late"><b>${esc(d.axis)}</b> ${esc(d.note)}${d.workshop_id ? ` <small>${esc(osRecord(d.workshop_id)?.row?.name || "")}</small>` : ""}</li>`), "") : ""}` };
  }
  if (key === "remontees") {
    const items = cgWaiting(lvl, { site });
    return { n: items.length, html: `<p class="re-fact">${jnPlural(items.length, "sujet attend", "sujets attendent")} une réponse de ce niveau${items.length ? ` · le plus ancien depuis ${cgAge(items[0].since)}` : ""}</p>${reLi(cgItemsHtml(items, r, dr), lvl === 2 ? "Rien de remonté par les TOP 5." : "Rien de remonté du niveau du dessous.")}${hold && items.length ? `<p class="hint">La réponse redescend jusqu’au niveau qui a remonté. Sans réponse possible ici, ${r.type === "mensuelle" ? "portez le sujet au COPIL ou au COMEX" : "cochez « Monter »"}.</p>` : ""}` };
  }
  if (key === "retours") {
    const items = cgToReturn(lvl, { site });
    return { n: items.length, html: `${reLi(items.map((it) => `<li class="cg-item done"><b>${reRec(it.id)} ${esc(it.title)}</b><small>Réponse${it.by ? ` de ${esc(it.by)}` : ""} le ${shortDate(it.at)} : <b>${esc(it.answer || "")}</b></small>${hold ? `<label class="cg-up"><input type="checkbox" data-re-ret="${esc(it.id)}" ${!dr.ret || dr.ret.includes(it.id) ? "checked" : ""}> Redite en réunion : boucle fermée</label>` : ""}</li>`), "Aucune réponse à redire.")}` };
  }
  return { n: 0, html: "" };
}
Object.assign(RE_BLOCKS, { securite24: "Sécurité des dernières 24 h", lettres: "Lettres SQCDP des ateliers et TOP 5", remontees: "Remonté du niveau du dessous", retours: "Réponses à redescendre" });
const cgBlockBase = reBlock;
reBlock = function (key, r) {
  if (["securite24", "lettres", "remontees", "retours"].includes(key)) return cgBlock(key, r);
  const out = cgBlockBase(key, r);
  if (key === "decisions" && ["copil", "comex"].includes(r.type)) {
    const items = cgWaiting(4, { forum: r.type });
    if (items.length) return { ...out, n: out.n + items.length, html: `${out.html}<p class="re-fact">Porté par la revue mensuelle · ${items.length}</p>${reLi(cgItemsHtml(items, r, reCurrentDraft || {}, { forumOnly: true }), "")}` };
  }
  return out;
};

/* ---------- La cascade en tête des réunions ---------- */

function cgStats() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString(), wk = new Date(Date.now() - 7 * 864e5).toISOString();
  const loops = [...osActive(data.topics), ...osActive(data.escalations).filter((e) => !osActive(data.topics).some((t) => t.carried_by === e.id))];
  const closed = loops.filter((x) => x.returned_at && String(x.returned_at) >= since), open = loops.filter((x) => !x.returned_at && x.status !== "Clos" && String(x.created_at || "") < wk);
  const avg = closed.length ? closed.reduce((n, x) => n + Math.max(0, (Date.parse(x.returned_at) - Date.parse(x.created_at || x.returned_at)) / 864e5), 0) / closed.length : null;
  return { closed: closed.length, open: open.length, avg };
}
function cgOverview() {
  const site = state.site === "group" ? null : state.site, inS = (x) => !site || x.site_id === site;
  const wss = osActive(data.workshops).filter(inS), t = today(), ms = (data.meetings || []).filter((m) => m.date === t && inS(m));
  const top15 = reRows().filter((r) => r.type === "top15" && inS(r)), held15 = top15.filter((r) => reSessions(r.id).some((s) => s.date === t)).length;
  const next = (type) => reRows().filter((r) => r.type === type && (!RE_SITE_TYPES.includes(type) || inS(r))).map((r) => r.next_date).filter(Boolean).sort()[0];
  const steps = [
    { name: "TOP 5", sub: "Atelier · chaque jour · 5 min", now: `${new Set(ms.map((m) => `${m.site_id}|${m.workshop_id || ""}`)).size}/${wss.length || "?"} tenus aujourd’hui`, wait: 0, back: cgToReturn(1, { site }).length },
    { name: "TOP 15", sub: "Site · chaque jour ouvré · 15 min", now: top15.length ? `${held15}/${top15.length} tenus aujourd’hui` : "à mettre en place", wait: cgWaiting(2, { site }).length, back: cgToReturn(2, { site }).length },
    { name: "Revue hebdo", sub: "Site · chaque semaine · 45 min", now: next("hebdo") ? `prochaine ${reWhen(next("hebdo")).toLowerCase()}` : "à mettre en place", wait: cgWaiting(3, { site }).length, back: cgToReturn(3, { site }).length },
    { name: "Revue mensuelle", sub: "Groupe · chaque mois · 2 h", now: next("mensuelle") ? `prochaine ${shortDate(next("mensuelle"))}` : "à mettre en place", wait: cgWaiting(4, { site }).length, back: cgToReturn(4, { site }).length },
    { name: "COPIL · COMEX", sub: "Groupe · décisions de programme et de direction", now: [next("copil") ? `COPIL ${shortDate(next("copil"))}` : "", next("comex") ? `COMEX ${shortDate(next("comex"))}` : ""].filter(Boolean).join(" · ") || "à mettre en place", wait: cgWaiting(4, { site, forum: "copil" }).length + cgWaiting(4, { site, forum: "comex" }).length, back: 0 },
  ];
  const st = cgStats();
  return `<section class="panel cg-ladder"><div class="cg-head"><div><h2>La cascade</h2><p class="hint">Ce qui ne se règle pas à un niveau monte au suivant ; la réponse redescend jusqu’à celui qui a remonté. La boucle est fermée quand elle y a été redite.</p></div></div>
    <ol class="cg-steps">${steps.map((s, i) => `<li><div class="cg-name"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></div><span class="cg-now">${esc(s.now)}</span><span class="cg-chips">${s.wait ? `<span class="cg-chip up" title="Sujets qui attendent une réponse à ce niveau">↑ ${s.wait} en attente</span>` : ""}${s.back ? `<span class="cg-chip down" title="Réponses à redire à ce niveau">↓ ${s.back} à redire</span>` : ""}${!s.wait && !s.back ? '<span class="cg-chip ok">à jour</span>' : ""}</span>${i < steps.length - 1 ? '<span class="cg-arrow" aria-hidden="true"></span>' : ""}</li>`).join("")}</ol>
    <p class="cg-foot"><span><b>${st.closed}</b> boucle${st.closed > 1 ? "s" : ""} fermée${st.closed > 1 ? "s" : ""} sur 30 jours</span><span>Délai moyen remontée → réponse redite <b>${st.avg === null ? "—" : `${smNum(st.avg)} j`}</b></span><span class="${st.open ? "bad" : ""}"><b>${st.open}</b> ouverte${st.open > 1 ? "s" : ""} depuis plus de 7 jours</span></p></section>`;
}
function cgTop15List(g) {
  return `<ul class="re-week">${g.sort((a, b) => getSiteName(a.site_id).localeCompare(getSiteName(b.site_id), "fr")).map((r) => {
    const held = reSessions(r.id).some((s) => s.date === today()), w = cgWaiting(2, { site: r.site_id }).length, b = cgToReturn(2, { site: r.site_id }).length;
    const due = !held && (!r.next_date || r.next_date <= today());
    return `<li class="${due ? "soon" : ""}"><button type="button" class="re-week-main cg-t15" data-re-open="${esc(r.id)}"><b class="cg-site">${esc(getSiteName(r.site_id))}</b><span>${held ? "Tenu aujourd’hui" : due ? `À tenir${r.time ? ` à ${esc(r.time)}` : ""}` : `${esc(reWhen(r.next_date))}${r.time ? ` · ${esc(r.time)}` : ""}`}</span><small>${w ? `↑ ${jnPlural(w, "sujet remonté", "sujets remontés")}` : "Rien de remonté"}${b ? ` · ↓ ${b} à redire` : ""}</small></button></li>`;
  }).join("")}</ul>`;
}
function cgAddTop15() {
  if (!reAdmin()) return;
  const have = new Set(reRows().filter((r) => r.type === "top15").map((r) => r.site_id));
  if (!commitData(() => {
    data.instances ||= [];
    OPERATIONAL_SITES.filter((s) => !have.has(s.id)).forEach((s) => { const t = RE_TYPES.top15, owner = osRecord(s.id)?.row.owner; data.instances.push({ id: auNext("INS", data.instances), type: "top15", site_id: s.id, title: t.label, cadence: t.cadence, time: t.time, duration: t.duration, chair: owner && !/^à /i.test(owner) ? owner : t.chair, participants: t.participants, next_date: [0, 6].includes(new Date(today() + "T12:00:00").getDay()) ? reWorkday(today()) : today(), created_at: now() }); });
  })) return;
  render(); toast("TOP 15 ajoutés : un par site, chaque jour ouvré.");
}

/* ---------- TOP 5 : les réponses à dire à l'équipe ---------- */

const cgSjBase = sjPanel;
sjPanel = function () {
  let out = cgSjBase.apply(this, arguments);
  if (!out) return out;
  out = out.replace("<h2>Le point du jour</h2>", "<h2>TOP 5 · Le point du jour</h2>").replace(">Démarrer le point<", ">Démarrer le TOP 5<").replace(">Clore le point<", ">Clore le TOP 5<");
  const rows = cgToReturn(1, { site: state.site, ws: sjWs() });
  if (!rows.length) return out;
  const w = sjWritable();
  return out.replace('<div class="sj-foot">', `<div class="cg-back"><h3>Réponses à dire à l’équipe · ${rows.length}</h3><ul>${rows.map((it) => `<li><div><b>${esc(it.title)}</b><span>${esc(it.answer || "")}</span><small>${esc(it.by || "")}${it.at ? ` · ${shortDate(it.at)}` : ""}</small></div>${w ? `<button type="button" class="btn small" data-cg-ret="${esc(it.id)}" data-cg-kind="${it.kind}">Dit à l’équipe</button>` : ""}</li>`).join("")}</ul></div><div class="sj-foot">`);
};

/* ---------- Niveaux renommés ---------- */

(function () {
  const lv = OS_FORMS.escalations?.fields?.find((x) => x[0] === "level");
  if (lv) lv[2] = "2:N2 · TOP 15 (site)|3:N3 · Revue hebdomadaire du site|4:N4 · Groupe (mensuelle, COPIL, COMEX)";
  const rt = OS_FORMS.routines?.fields?.find((x) => x[0] === "level");
  if (rt) rt[2] = "1:N1 · TOP 5 (atelier)|2:N2 · TOP 15 (site)|3:N3 · Revue hebdomadaire du site|4:N4 · Groupe";
})();
const cgDailyBase = renderOSDaily;
renderOSDaily = function () {
  const out = cgDailyBase.apply(this, arguments);
  return state.meetOn ? out : out.replace(/N1 · Équipe/g, "N1 · TOP 5").replace(/N2 · Atelier/g, "N2 · TOP 15").replace(/N3 · Site/g, "N3 · Revue hebdo du site");
};

function cgBind(root = document) {
  root.querySelectorAll("[data-re-top15]").forEach((b) => (b.onclick = () => cgAddTop15()));
  root.querySelectorAll("[data-cg-ret]").forEach((b) => (b.onclick = () => {
    const it = cgToReturn(1, { site: state.site, ws: sjWs() }).find((x) => x.id === b.dataset.cgRet);
    if (!it || !sjWritable()) return;
    const by = apMe() || osActor();
    if (!commitData(() => cgReturnRow({ ...it, origin: 1 }, by))) return;
    render(); toast("Réponse dite à l’équipe : boucle fermée.");
  }));
}
const cgOsBindBase = osBind;
osBind = function () { const out = cgOsBindBase.apply(this, arguments); cgBind(document); return out; };
