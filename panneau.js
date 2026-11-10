/* BIA Lean OS 8.46 — Panneau TOP 5 : le panneau reste en atelier, on le reporte après la réunion.
   La réunion se tient devant le panneau, au feutre. Après, le chef d'équipe recopie le panneau ici, case par case,
   dans le même ordre (5 minutes). L'application calcule les tendances, envoie les sujets remontés au plan d'actions,
   fait lire le panneau au directeur et au TOP 15, et redescend les trois messages sur le téléphone des équipes. */

const PN_STATUS = [
  { key: "qualifier", label: "À qualifier", action: "Ouverte" },
  { key: "cours", label: "En cours", action: "En cours" },
  { key: "resolu", label: "Résolu", action: "Clôturée" },
  { key: "bloque", label: "Bloqué", action: "Standby" },
];
const PN_AXIS = {
  S: { label: "Sécurité", bg: "#f6d9d6" },
  Q: { label: "Qualité", bg: "#d9e6f6" },
  C: { label: "Coût", bg: "#f8e7b8" },
  D: { label: "Délai", bg: "#d8eed3" },
  P: { label: "Personnel", bg: "#e4dcf3" },
};
// Le panneau de Marzin, ligne pour ligne. kind : num (chiffre), text (écrit), poles (trois pôles), pair (nombre et euros).
const PN_ROWS_MARZIN = [
  { id: "jsa", axis: "S", label: "Jours sans accident", kind: "num", better: "up" },
  { id: "record", axis: "S", label: "Record", kind: "num", better: "up" },
  { id: "ncpole", axis: "Q", label: "NC par pôle", kind: "poles", better: "down", poles: ["Pôle 1", "Pôle 2", "Pôle 3"] },
  { id: "sav", axis: "Q", label: "SAV (nombre vs €)", kind: "pair", better: "down", units: ["", "€"] },
  { id: "erreurs", axis: "Q", label: "Erreurs internes", kind: "num", better: "down" },
  { id: "top1", axis: "C", label: "Top 1", kind: "text" },
  { id: "top2", axis: "C", label: "Top 2", kind: "text" },
  { id: "top3", axis: "C", label: "Top 3", kind: "text" },
  { id: "ca", axis: "C", label: "CA réalisé", kind: "num", unit: "k€", better: "up" },
  { id: "otd", axis: "D", label: "Commandes livrées à temps", kind: "num", unit: "%", better: "up", kpi: "service" },
  { id: "retard", axis: "D", label: "Commandes en retard", kind: "num", better: "down" },
  { id: "abs", axis: "P", label: "Taux d’absentéisme", kind: "num", unit: "%", better: "down", kpi: "staffing", toKpi: "complement" },
];

/* ---------- Dates : la semaine du panneau ---------- */

function pnDate(d, n) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function pnMonday(d = today()) { const x = new Date(d + "T12:00:00"); return pnDate(d, -((x.getDay() + 6) % 7)); }
function pnMeetingDay(b, monday) { return pnDate(monday, b.weekday ?? 1); }
function pnCurrentWeek(b) { const m = pnMonday(); return pnMeetingDay(b, m) <= today() ? m : pnDate(m, -7); }
function pnWeekLabel(monday) { return new Date(monday + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function pnNum(v) { return v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v); }
function pnFmt(v, unit = "") { const n = pnNum(v); return n === null ? "—" : `${n.toLocaleString("fr-FR")}${unit ? (unit === "%" ? " %" : ` ${unit}`) : ""}`; }

/* ---------- Données ---------- */

function pnBoards(site = state.site) { return (data.boards || []).filter((b) => !b.archived_at && (site === "group" ? allowedSite(b.site_id) : b.site_id === site)); }
function pnWeeks(b) { return (data.boardWeeks || []).filter((w) => w.board_id === b.id).sort((x, y) => String(x.week).localeCompare(String(y.week))); }
function pnWeek(b, monday) { return pnWeeks(b).find((w) => w.week === monday) || null; }
function pnPrev(b, monday) { return pnWeeks(b).filter((w) => w.week < monday).pop() || null; }
function pnSubjects(b) { return (data.actions || []).filter((a) => a.origin_type === "TOP 5" && a.board_id === b.id && !a.archived_at); }
function pnStatusOf(a) { if (a.board_status) return PN_STATUS.find((s) => s.key === a.board_status) || PN_STATUS[0]; return PN_STATUS.find((s) => s.action === a.status) || (a.status === "À vérifier" ? PN_STATUS[1] : PN_STATUS[0]); }
function pnCanReport(b) { return !role().readonly && allowedSite(b.site_id) && (osManager() || state.role === "teamlead"); }
function pnTotal(r, v) { if (v === null || v === undefined) return null; if (r.kind === "poles") return Array.isArray(v) && v.some((x) => pnNum(x) !== null) ? v.reduce((s, x) => s + (pnNum(x) || 0), 0) : null; if (r.kind === "pair") return pnNum(v?.[0]); return pnNum(v); }
// La tendance ne s'écrit plus : elle se calcule contre la semaine d'avant.
function pnTrend(r, cur, prev) {
  if (r.kind === "text") return null;
  const a = pnTotal(r, cur), b = pnTotal(r, prev);
  if (a === null || b === null) return null;
  const dir = a > b ? "up" : a < b ? "down" : "flat";
  return { dir, tone: dir === "flat" ? "flat" : dir === r.better ? "good" : "bad", delta: a - b };
}
function pnArrow(t) { if (!t) return '<span class="pn-arrow none" title="Pas de semaine précédente">—</span>'; const ch = { up: "↗", down: "↘", flat: "→" }[t.dir]; return `<span class="pn-arrow ${t.tone}" title="${t.tone === "good" ? "En progrès" : t.tone === "bad" ? "En recul" : "Stable"} par rapport à la semaine d’avant">${ch}</span>`; }
function pnSpark(b, r, upto) {
  const pts = pnWeeks(b).filter((w) => w.week <= upto).slice(-8).map((w) => pnTotal(r, w.values?.[r.id])).filter((x) => x !== null);
  if (pts.length < 3) return "";
  const mn = Math.min(...pts), mx = Math.max(...pts), W = 56, H = 16, sx = W / (pts.length - 1);
  const y = (v) => (mx === mn ? H / 2 : H - 2 - ((v - mn) / (mx - mn)) * (H - 4));
  return `<svg class="pn-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts.map((v, i) => `${(i * sx).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="${((pts.length - 1) * sx).toFixed(1)}" cy="${y(pts.at(-1)).toFixed(1)}" r="2" fill="currentColor"/></svg>`;
}
function pnValueHtml(r, v) {
  if (r.kind === "text") return v ? esc(v) : '<span class="pn-blank">—</span>';
  if (r.kind === "poles") {
    const n = Array.isArray(v) ? v.map(pnNum) : [], tot = n.reduce((s, x) => s + (x || 0), 0);
    if (!n.some((x) => x !== null)) return '<span class="pn-blank">—</span>';
    return `<span class="pn-poles">${r.poles.map((p, i) => `<span><i class="p${i + 1}"></i>${esc(p)} <b>${pnFmt(n[i])}</b>${tot ? ` <small>${Math.round(((n[i] || 0) * 100) / tot)} %</small>` : ""}</span>`).join("")}</span>`;
  }
  if (r.kind === "pair") return pnNum(v?.[0]) === null && pnNum(v?.[1]) === null ? '<span class="pn-blank">—</span>' : `<b>${pnFmt(v?.[0])}</b> <small>· ${pnFmt(v?.[1], "€")}</small>`;
  return pnNum(v) === null ? '<span class="pn-blank">—</span>' : `<b>${pnFmt(v, r.unit)}</b>`;
}

/* ---------- Le panneau à l'écran : la copie fidèle du panneau d'atelier ---------- */

function pnHow() {
  return `<ol class="pn-how" aria-label="Comment ça marche">
    <li><b>1 · Le panneau reste en atelier</b><span>La réunion se tient devant, au feutre, comme aujourd’hui.</span></li>
    <li><b>2 · On le reporte en 5 minutes</b><span>Après la réunion, le chef d’équipe recopie le panneau ici, case par case, dans le même ordre.</span></li>
    <li><b>3 · L’application fait le reste</b><span>Tendances calculées, indicateurs du pilotage mis à jour, sujets dans le plan d’actions, panneau lu du bureau et au TOP 15, messages sur le téléphone des équipes.</span></li></ol>`;
}
function pnBoardHtml(b, monday) {
  const wk = pnWeek(b, monday), prev = pnPrev(b, monday), v = wk?.values || {}, pv = prev?.values || {};
  const cur = pnCurrentWeek(b), weeks = pnWeeks(b), first = weeks[0]?.week;
  const axes = Object.keys(PN_AXIS).map((ax) => ({ ax, rows: (b.rows || []).filter((r) => r.axis === ax) })).filter((g) => g.rows.length);
  const table = `<table class="pn-sqcdp"><thead><tr><th>Axe</th><th>Indicateur</th><th>Résultat</th><th>Tendance</th></tr></thead><tbody>${axes.map((g) => g.rows.map((r, i) => {
    const t = pnTrend(r, v[r.id], pv[r.id]);
    return `<tr class="pn-${g.ax}">${i === 0 ? `<th scope="rowgroup" rowspan="${g.rows.length}" style="background:${PN_AXIS[g.ax].bg}">${esc(PN_AXIS[g.ax].label)}</th>` : ""}<td>${esc(r.label)}${r.unit ? ` <small>(${esc(r.unit)})</small>` : ""}</td><td class="pn-val">${pnValueHtml(r, v[r.id])}</td><td class="pn-tr">${pnArrow(t)}${pnSpark(b, r, monday)}</td></tr>`;
  }).join("")).join("")}</tbody></table>`;
  const msgs = (wk?.messages || []).concat(["", "", ""]).slice(0, b.messages || 3);
  const subs = pnSubjects(b).sort((x, y) => PN_STATUS.indexOf(pnStatusOf(x)) - PN_STATUS.indexOf(pnStatusOf(y)) || String(x.due_date).localeCompare(String(y.due_date)));
  const counts = PN_STATUS.map((s) => [s, subs.filter((a) => pnStatusOf(a) === s).length]);
  return `<div class="pn-board" data-pn-board="${esc(b.id)}">
    <header class="pn-head"><div><h3>${esc(b.name)}</h3><p>Réunion hebdomadaire – ${esc(b.slot || "")}</p></div>
      <div class="pn-week"><button type="button" class="btn ghost small" data-pn-week="${esc(pnDate(monday, -7))}" ${first && monday <= first ? "disabled" : ""} aria-label="Semaine précédente">‹</button><span>Semaine du <b>${pnWeekLabel(monday)}</b></span><button type="button" class="btn ghost small" data-pn-week="${esc(pnDate(monday, 7))}" ${monday >= cur ? "disabled" : ""} aria-label="Semaine suivante">›</button></div></header>
    <p class="pn-state ${wk ? "done" : "todo"}">${wk ? `Reporté le ${new Date(wk.at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${new Date(wk.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} par ${esc(wk.by || "—")}` : monday === cur ? `Pas encore reporté : la réunion du ${new Date(pnMeetingDay(b, monday) + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} est à recopier.` : "Cette semaine-là n’a pas été reportée."}</p>
    <div class="pn-grid">
      <section class="pn-left"><h4>SQCDP – Indicateurs clés</h4>${table}</section>
      <section class="pn-right">
        <h4>${msgs.length} messages de la semaine</h4><ol class="pn-msgs">${msgs.map((m, i) => `<li class="${m ? "" : "empty"}"><span class="pn-pin p${i + 1}">${i + 1}</span>${m ? esc(m) : "—"}</li>`).join("")}</ol>
        <h4>Plan d’action – Sujets remontés</h4>${subs.length ? `<div class="pn-scroll"><table class="pn-subjects"><thead><tr><th>Sujet</th><th>Responsable</th><th>Échéance</th><th>Pilote</th><th>Statut</th></tr></thead><tbody>${subs.map((a) => { const s = pnStatusOf(a); return `<tr><td><button type="button" class="md-link" data-open-record="${esc(a.id)}">${esc(a.title)}</button></td><td>${esc(a.owner || "—")}</td><td>${a.due_date ? shortDate(a.due_date) : "—"}</td><td>${esc(a.pilot || "—")}</td><td><span class="pn-dot ${s.key}" title="${esc(s.label)}"></span> <span class="pn-stl">${esc(s.label)}</span></td></tr>`; }).join("")}</tbody></table></div>` : '<p class="hint">Aucun sujet remonté.</p>'}
        <p class="pn-legend">${counts.map(([s, n]) => `<span><span class="pn-dot ${s.key}"></span>${esc(s.label)}${n ? ` · ${n}` : ""}</span>`).join("")}</p>
        <h4>Plan d’action (A3)</h4><div class="pn-a3">${wk?.a3 ? esc(wk.a3) : '<span class="hint">Aucun A3 en cours noté sur le panneau.</span>'}</div>
      </section>
    </div>
    <p class="pn-foot">Objectif : comprendre – décider – suivre</p>
    ${pnCanReport(b) ? `<div class="pn-actions"><button type="button" class="btn" data-pn-report="${esc(b.id)}" data-pn-for="${esc(monday)}">${wk ? "Corriger le report" : "Reporter le panneau"}</button><span class="hint">${wk ? "" : "Après la réunion, recopier le panneau : environ 5 minutes."}</span></div>` : ""}
  </div>`;
}

/* ---------- Le report : le même panneau, en cases à remplir ---------- */

function pnFormHtml(b, monday) {
  const wk = pnWeek(b, monday), prev = pnPrev(b, monday), v = wk?.values || {}, pv = prev?.values || {};
  const ph = (r, x) => (x === null || x === undefined || x === "" ? "" : `placeholder="${esc(String(x))}"`);
  const field = (r) => {
    const cur = v[r.id], was = pv[r.id];
    if (r.kind === "text") return `<input type="text" name="pn-${r.id}" value="${esc(cur || "")}" ${ph(r, was)} maxlength="80">`;
    if (r.kind === "poles") return `<span class="pn-in-poles">${r.poles.map((p, i) => `<label>${esc(p)}<input type="number" inputmode="decimal" min="0" step="any" name="pn-${r.id}-${i}" value="${esc(cur?.[i] ?? "")}" ${ph(r, was?.[i])}></label>`).join("")}</span>`;
    if (r.kind === "pair") return `<span class="pn-in-poles"><label>Nombre<input type="number" inputmode="decimal" min="0" step="any" name="pn-${r.id}-0" value="${esc(cur?.[0] ?? "")}" ${ph(r, was?.[0])}></label><label>€<input type="number" inputmode="decimal" min="0" step="any" name="pn-${r.id}-1" value="${esc(cur?.[1] ?? "")}" ${ph(r, was?.[1])}></label></span>`;
    return `<input type="number" inputmode="decimal" step="any" name="pn-${r.id}" value="${esc(cur ?? "")}" ${ph(r, was)}>`;
  };
  const msgs = (wk?.messages || []).concat(["", "", ""]).slice(0, b.messages || 3);
  const subs = pnSubjects(b).filter((a) => pnStatusOf(a).key !== "resolu" || (wk && String(a.board_closed_week || "") === monday));
  const stSel = (name, cur) => `<select name="${name}">${PN_STATUS.map((s) => `<option value="${s.key}" ${s.key === cur ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>`;
  const subRow = (a, i) => `<tr>${a ? `<td><b>${esc(a.title)}</b><input type="hidden" name="pn-s${i}-id" value="${esc(a.id)}"></td>` : `<td><input type="text" name="pn-s${i}-title" placeholder="Nouveau sujet" maxlength="80"></td>`}<td><input type="text" name="pn-s${i}-owner" value="${esc(a?.owner || "")}" placeholder="Atelier, Maintenance…" maxlength="40"></td><td><input type="date" name="pn-s${i}-due" value="${esc(a?.due_date || "")}"></td><td><input type="text" name="pn-s${i}-pilot" value="${esc(a?.pilot || "")}" maxlength="40"></td><td>${stSel(`pn-s${i}-st`, a ? pnStatusOf(a).key : "qualifier")}</td></tr>`;
  const rows = [...subs, null, null];
  return `<form class="pn-board pn-form" id="pnForm" data-pn-board="${esc(b.id)}" data-pn-for="${esc(monday)}" novalidate>
    <header class="pn-head"><div><h3>Reporter · ${esc(b.name)}</h3><p>Semaine du ${pnWeekLabel(monday)} · même ordre que le panneau. En gris : la valeur de la semaine d’avant.</p></div></header>
    <div class="pn-grid">
      <section class="pn-left"><h4>SQCDP – Indicateurs clés</h4><table class="pn-sqcdp"><tbody>${Object.keys(PN_AXIS).map((ax) => (b.rows || []).filter((r) => r.axis === ax).map((r, i, all) => `<tr class="pn-${ax}">${i === 0 ? `<th scope="rowgroup" rowspan="${all.length}" style="background:${PN_AXIS[ax].bg}">${esc(PN_AXIS[ax].label)}</th>` : ""}<td><label for="pn-${r.id}">${esc(r.label)}${r.unit ? ` <small>(${esc(r.unit)})</small>` : ""}</label></td><td class="pn-val">${field(r).replace(`name="pn-${r.id}"`, `name="pn-${r.id}" id="pn-${r.id}"`)}</td></tr>`).join("")).join("")}</tbody></table>
        <p class="hint">La tendance ne se recopie pas : l’application la calcule.</p></section>
      <section class="pn-right">
        <h4>${msgs.length} messages de la semaine</h4><ol class="pn-msgs pn-in">${msgs.map((m, i) => `<li><span class="pn-pin p${i + 1}">${i + 1}</span><textarea name="pn-m${i}" rows="3" maxlength="90" aria-label="Message ${i + 1}">${esc(m)}</textarea></li>`).join("")}</ol>
        <h4>Plan d’action – Sujets remontés</h4><div class="pn-scroll"><table class="pn-subjects pn-in"><thead><tr><th>Sujet</th><th>Responsable</th><th>Échéance</th><th>Pilote</th><th>Statut</th></tr></thead><tbody>${rows.map((a, i) => subRow(a, i)).join("")}</tbody></table></div>
        <p class="hint">Un nouveau sujet part dans le plan d’actions du site ; un sujet « Résolu » y est clôturé.</p>
        <h4>Plan d’action (A3)</h4><textarea name="pn-a3" rows="2" maxlength="240" aria-label="A3 en cours">${esc(wk?.a3 || "")}</textarea>
        <label class="pn-by">Reporté par<input type="text" name="pn-by" value="${esc(wk?.by || pnLastBy(b))}" maxlength="40" required></label>
      </section>
    </div>
    <div class="pn-actions"><button type="submit" class="btn">Enregistrer le panneau</button><button type="button" class="btn secondary" data-pn-cancel>Annuler</button></div>
  </form>`;
}
function pnLastBy(b) { return pnWeeks(b).at(-1)?.by || ""; }
function pnSave(form) {
  const b = (data.boards || []).find((x) => x.id === form.dataset.pnBoard), monday = form.dataset.pnFor;
  if (!b || !pnCanReport(b)) return false;
  const f = form.elements, val = (n) => (f[n] ? String(f[n].value).trim() : "");
  const by = val("pn-by");
  if (!by) { toast("Indiquez qui reporte le panneau."); f["pn-by"]?.focus(); return false; }
  const values = {};
  for (const r of b.rows || []) {
    if (r.kind === "text") { if (val(`pn-${r.id}`)) values[r.id] = val(`pn-${r.id}`); }
    else if (r.kind === "poles") { const a = r.poles.map((_, i) => pnNum(val(`pn-${r.id}-${i}`))); if (a.some((x) => x !== null)) values[r.id] = a; }
    else if (r.kind === "pair") { const a = [0, 1].map((i) => pnNum(val(`pn-${r.id}-${i}`))); if (a.some((x) => x !== null)) values[r.id] = a; }
    else if (pnNum(val(`pn-${r.id}`)) !== null) values[r.id] = pnNum(val(`pn-${r.id}`));
  }
  const messages = [0, 1, 2].slice(0, b.messages || 3).map((i) => val(`pn-m${i}`));
  const subs = [];
  for (let i = 0; f[`pn-s${i}-st`]; i++) subs.push({ id: val(`pn-s${i}-id`), title: val(`pn-s${i}-title`), owner: val(`pn-s${i}-owner`), due: val(`pn-s${i}-due`), pilot: val(`pn-s${i}-pilot`), st: val(`pn-s${i}-st`) });
  const at = now();
  let created = 0;
  const ok = commitData(() => {
    data.boardWeeks ||= [];
    const prev = pnPrev(b, monday), old = data.boardWeeks.find((w) => w.board_id === b.id && w.week === monday);
    const wk = { id: old?.id || uid("PNW"), board_id: b.id, site_id: b.site_id, workshop_id: b.workshop_id || null, week: monday, values, messages, a3: val("pn-a3"), by, at };
    if (old) Object.assign(old, wk); else data.boardWeeks.push(wk);
    pnMeasuresFor(data, b, monday, values);
    for (const s of subs) {
      const st = PN_STATUS.find((x) => x.key === s.st) || PN_STATUS[0];
      let a = s.id && data.actions.find((x) => x.id === s.id);
      if (!a && !s.title) continue;
      if (!a) { a = { id: uid("A"), site_id: b.site_id, workshop_id: b.workshop_id || null, title: s.title, priority: "Normale", origin_type: "TOP 5", board_id: b.id, description: `Sujet remonté au ${b.name}, semaine du ${pnWeekLabel(monday)}.`, effectiveness: null, created_at: at }; data.actions.push(a); created++; }
      Object.assign(a, { owner: s.owner || a.owner || "À désigner", due_date: s.due || a.due_date || "", pilot: s.pilot, board_status: st.key, status: st.action, updated_at: at });
      if (st.key === "resolu") { a.board_closed_week ||= monday; a.closed_at ||= at; } else { delete a.board_closed_week; delete a.closed_at; }
    }
    // Ce qui s'est dit remonte comme un TOP 5 tenu : lettres déduites des tendances, panneau résumé.
    data.meetings ||= [];
    const letters = {}, notes = {};
    for (const ax of Object.keys(PN_AXIS)) {
      const rows = (b.rows || []).filter((r) => r.axis === ax);
      if (!rows.length) continue;
      const tr = rows.map((r) => pnTrend(r, values[r.id], prev?.values?.[r.id])).filter(Boolean);
      letters[ax] = tr.some((t) => t.tone === "bad") ? "ko" : rows.some((r) => values[r.id] !== undefined) ? "ok" : undefined;
      if (!letters[ax]) delete letters[ax];
      const said = rows.filter((r) => values[r.id] !== undefined).map((r) => `${r.label} ${r.kind === "text" ? values[r.id] : r.kind === "poles" ? r.poles.map((p, i) => `${p} ${pnFmt(values[r.id][i])}`).join(", ") : r.kind === "pair" ? `${pnFmt(values[r.id][0])} · ${pnFmt(values[r.id][1], "€")}` : pnFmt(values[r.id], r.unit)}`);
      if (said.length) notes[ax] = said.join(" · ");
    }
    if (messages.some(Boolean)) notes.free = `Messages : ${messages.filter(Boolean).join(" / ")}`;
    const day = pnMeetingDay(b, monday), mid = `PNM-${b.id}-${monday}`;
    data.meetings = data.meetings.filter((m) => m.id !== mid);
    data.meetings.unshift({ id: mid, kind: "top5", source: "panneau", board_id: b.id, site_id: b.site_id, workshop_id: b.workshop_id || null, date: day > today() ? today() : day, letters, notes, infos: [], answers: [], questions: [], present: [], ended_at: at, by });
  });
  if (!ok) return false;
  state.pnEdit = null; state.pnWeek = monday;
  toast(`Panneau reporté${created ? ` · ${created} sujet${created > 1 ? "s" : ""} ajouté${created > 1 ? "s" : ""} au plan d’actions` : ""}.`);
  return true;
}

/* ---------- Section dans Voir › TOP 5 ---------- */

function pnSection() {
  const boards = pnBoards();
  if (state.site === "group") {
    if (!boards.length) return "";
    return `<section class="panel section pn-sec"><div class="section-title"><h2>Panneaux TOP 5 de la semaine</h2></div>${pnHow()}<ul class="t5-wslist">${boards.map((b) => { const m = pnCurrentWeek(b), wk = pnWeek(b, m), subs = pnSubjects(b), bl = subs.filter((a) => pnStatusOf(a).key === "bloque").length, prev = pnPrev(b, m), bad = wk ? (b.rows || []).filter((r) => pnTrend(r, wk.values?.[r.id], prev?.values?.[r.id])?.tone === "bad").length : 0;
      return `<li class="t5-ws ${wk ? "held" : ""}"><div><b>${esc(b.name)}</b><span class="hint">${esc(getSiteName(b.site_id))} · ${esc(b.slot || "")}</span><small>${wk ? `Reporté par ${esc(wk.by || "—")} · ${bad} indicateur${bad > 1 ? "s" : ""} en recul` : "Pas encore reporté cette semaine"}${bl ? ` · ${bl} sujet${bl > 1 ? "s" : ""} bloqué${bl > 1 ? "s" : ""}` : ""}</small></div><button type="button" class="btn secondary" data-pn-site="${esc(b.site_id)}">Voir le panneau</button></li>`; }).join("")}</ul></section>`;
  }
  if (!boards.length) return "";
  return boards.map((b) => {
    const monday = state.pnWeek && state.pnWeek <= pnCurrentWeek(b) ? state.pnWeek : pnCurrentWeek(b);
    const editing = state.pnEdit === `${b.id}|${monday}` && pnCanReport(b);
    return `<section class="panel section pn-sec"><div class="section-title"><h2>Panneau TOP 5 · semaine du ${pnWeekLabel(monday)}</h2></div>${editing ? "" : pnHow()}${editing ? pnFormHtml(b, monday) : pnBoardHtml(b, monday)}</section>`;
  }).join("");
}
const pnPageBase = t5Page;
t5Page = function () {
  const html = pnPageBase.apply(this, arguments), sec = pnSection();
  if (!sec) return html;
  const i = html.indexOf('<section class="panel section');
  return i < 0 ? html + sec : html.slice(0, i) + sec + html.slice(i);
};

// Le chef d’équipe n’a pas l’onglet TOP 5 : le panneau vient dans son SQCDP du jour.
const pnSqBase = renderSqcdp;
renderSqcdp = function (embedded = false) {
  const html = pnSqBase.apply(this, arguments);
  if (embedded || state.site === "group" || t5Can() || state.view !== "sqcdp") return html;
  const sec = pnSection();
  if (!sec) return html;
  const i = html.indexOf('<section class="panel');
  return i < 0 ? html + sec : html.slice(0, i) + sec + html.slice(i);
};
function pnOpenReport(boardId) {
  const b = (data.boards || []).find((x) => x.id === boardId);
  if (!b) return;
  const m = pnCurrentWeek(b);
  state.pnWeek = m; state.pnEdit = `${b.id}|${m}`;
  if (t5Can()) { state.t5Tab = true; switchView("sqcdp"); state.t5Tab = true; } else switchView("sqcdp");
  render();
  document.getElementById("pnForm")?.scrollIntoView({ block: "start" });
}

/* ---------- Les trois messages redescendent sur le téléphone des équipes ---------- */

const pnHomeBase = renderHome;
renderHome = function () {
  const html = pnHomeBase.apply(this, arguments);
  if (state.site === "group" || !["operator", "teamlead"].includes(state.role)) return html;
  const todo = state.role === "teamlead" ? pnBoards().filter((b) => pnCanReport(b)).map((b) => { const m = pnCurrentWeek(b), wk = pnWeek(b, m); return `<section class="jn-card pn-home ${wk ? "held" : ""}" aria-label="Panneau TOP 5"><div class="jn-card-head"><h2>Panneau ${esc(b.name)}</h2></div><p class="jn-lead">${wk ? `Reporté par ${esc(wk.by || "—")}` : `Réunion du ${new Date(pnMeetingDay(b, m) + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : panneau à recopier (5 minutes).`}</p><div class="jn-buttons"><button type="button" class="btn ${wk ? "secondary" : "jn-big"}" data-pn-open="${esc(b.id)}">${wk ? "Voir le panneau" : "Reporter le panneau"}</button></div></section>`; }).join("") : "";
  const cards = todo + pnBoards().map((b) => { const wk = pnWeek(b, pnCurrentWeek(b)), m = (wk?.messages || []).filter(Boolean); return m.length ? `<section class="jn-card pn-home" aria-label="Messages de la semaine"><div class="jn-card-head"><h2>Messages de la semaine</h2></div><ol class="pn-msgs">${m.map((x, i) => `<li><span class="pn-pin p${i + 1}">${i + 1}</span>${esc(x)}</li>`).join("")}</ol><p class="hint">${esc(b.name)} · ${esc(b.slot || "")}</p></section>` : ""; }).join("");
  if (!cards) return html;
  if (html.includes('<div class="jn-grid">')) return html.replace('<div class="jn-grid">', `<div class="jn-grid">${cards}`);
  return html.replace('<p class="jn-empty jn-quiet">Rien d’urgent aujourd’hui.</p>', `<div class="jn-grid">${cards}</div>`);
};

/* ---------- Le TOP 15 lit le panneau ---------- */

if (typeof RE_BLOCKS !== "undefined") {
  RE_BLOCKS.panneau = "Panneau TOP 5 de la semaine";
  const ag = RE_TYPES.top15?.agenda;
  if (ag && !ag.some(([k]) => k === "panneau")) { const i = ag.findIndex(([k]) => k === "top5dit"); if (i >= 0 && ag[i][1] > 1) { ag[i][1] -= 1; ag.splice(i + 1, 0, ["panneau", 1]); } else ag.push(["panneau", 1]); }
  const pnBlockBase = reBlock;
  reBlock = function (key, r) {
    if (key !== "panneau") return pnBlockBase.apply(this, arguments);
    const items = (data.boards || []).filter((b) => b.site_id === r.site_id && !b.archived_at).map((b) => {
      const m = pnCurrentWeek(b), wk = pnWeek(b, m), prev = pnPrev(b, m);
      const bad = wk ? (b.rows || []).filter((x) => pnTrend(x, wk.values?.[x.id], prev?.values?.[x.id])?.tone === "bad") : [];
      const bl = pnSubjects(b).filter((a) => pnStatusOf(a).key === "bloque");
      return { n: bad.length + bl.length, html: wk ? `<p class="re-fact">${esc(b.name)} · reporté par ${esc(wk.by || "—")}</p><ul>${bad.map((x) => `<li><span class="jn-tag tone-bad">${x.axis}</span>${esc(x.label)} en recul : ${pnValueHtml(x, wk.values[x.id]).replace(/<[^>]+>/g, "")}</li>`).join("")}${bl.map((a) => `<li><span class="jn-tag tone-bad">Bloqué</span>${esc(a.title)} · ${esc(a.owner || "")} ${reRecSafe(a.id)}</li>`).join("")}</ul>${!bad.length && !bl.length ? '<p class="hint">Aucun indicateur en recul, aucun sujet bloqué.</p>' : ""}` : `<p class="hint">${esc(b.name)} pas encore reporté cette semaine.</p>` };
    });
    return { n: items.reduce((s, x) => s + x.n, 0), html: items.length ? items.map((x) => x.html).join("") : '<p class="hint">Pas de panneau TOP 5 sur ce site.</p>' };
  };
}

/* ---------- Données d’exemple : le panneau de Marzin, six semaines ---------- */

function pnDemoInto(base) {
  if (!base || (base.boards || []).some((b) => b.id === "PN-MARZIN")) return base;
  const board = { id: "PN-MARZIN", site_id: "marzin", workshop_id: null, name: "TOP 5 Marzin", slot: "Mardi 10 h", weekday: 1, messages: 3, rows: PN_ROWS_MARZIN.map((r) => ({ ...r })), created_at: now() };
  base.boards = [...(base.boards || []), board];
  const cur = pnCurrentWeek(board), weeks = [5, 4, 3, 2, 1, 0].map((k) => pnDate(cur, -7 * k));
  const S = {
    jsa: [12, 19, 26, 33, 40, 47], record: [212, 212, 212, 212, 212, 212],
    ncpole: [[6, 4, 2], [5, 4, 3], [7, 3, 2], [5, 3, 2], [6, 2, 2], [5, 3, 2]],
    sav: [[3, 1200], [4, 2100], [2, 800], [5, 2600], [3, 1400], [4, 1850]],
    erreurs: [9, 8, 10, 7, 7, 6], ca: [388, 402, 371, 415, 398, 412],
    otd: [86, 88, 85, 89, 90, 91], retard: [12, 10, 13, 9, 8, 7], abs: [5.1, 4.8, 5.6, 4.5, 4.4, 4.2],
    top1: ["Masterwood : ventouse en panne, 4 h", "Masterwood : ventouse en panne, 3 h 30", "Aspiration déligneuse : 2 h 40", "Aspiration déligneuse : 3 h", "Aspiration déligneuse : 3 h 10", "Aspiration déligneuse : 3 h 20 d’arrêt"],
    top2: ["Attente matière : 2 h 30", "Aspiration déligneuse : 2 h", "Masterwood : 2 h 15", "Réglages machine MIC : 1 h 50", "Attente matière : 2 h", "Attente matière Masterwood : 2 h 10"],
    top3: ["Réglages machine MIC : 1 h 30", "Réglages machine MIC : 1 h 40", "Attente matière : 1 h 20", "Attente matière : 1 h 30", "Réglages machine MIC : 1 h 20", "Réglages machine MIC : 1 h 15"],
  };
  const M = [
    ["Rangement fin de poste : 10 minutes avant 17 h", "Gants de manutention obligatoires au débit", "Qualité : identifier chaque palette en sortie de ligne"],
    ["Inventaire tournant mercredi : zone B", "Ne pas stocker devant les extincteurs", "Qualité : fiche verte sur tout produit bloqué"],
    ["Visite client jeudi : atelier rangé mercredi soir", "Casque antibruit à la déligneuse", "Qualité : premier panneau contrôlé à chaque série"],
    ["Nouvel horaire du magasin : 7 h 45 – 16 h 30", "Allées dégagées : rien au sol hors marquage", "Qualité : rayures en hausse au pôle 2, vigilance"],
    ["Formation transpalette mardi 14 h : 4 places", "Signaler tout presqu’accident au chef d’équipe", "Qualité : contrôle des cotes à la reprise"],
    ["Stationner les transpalettes dans les zones identifiées", "Consigne sécurité : porter les EPI en atelier", "Qualité : contrôler le premier panneau de chaque série"],
  ];
  const A3 = ["", "", "A3 ouvert : aspiration de la déligneuse", "A3 aspiration déligneuse : mesure du débit faite", "A3 aspiration déligneuse : cause trouvée, filtre colmaté", "A3 aspiration déligneuse : débit 40 % sous la valeur constructeur, filtre et gaine à changer"];
  const by = ["Karim B. (chef d’équipe)", "Karim B. (chef d’équipe)", "Nora L. (cheffe d’équipe)", "Karim B. (chef d’équipe)", "Karim B. (chef d’équipe)", "Karim B. (chef d’équipe)"];
  base.boardWeeks = (base.boardWeeks || []).concat(weeks.map((w, k) => {
    const values = {};
    for (const r of board.rows) values[r.id] = Array.isArray(S[r.id][k]) ? [...S[r.id][k]] : S[r.id][k];
    const at = new Date(`${pnMeetingDay(board, w)}T10:${String(38 + k).padStart(2, "0")}:00`).toISOString();
    return { id: `PNW-${w}`, board_id: board.id, site_id: "marzin", workshop_id: null, week: w, values, messages: M[k], a3: A3[k], by: by[k], at };
  }));
  const day = (n) => pnDate(today(), n), mk = (id, title, owner, due, pilot, st, desc, ago) => ({ id, site_id: "marzin", workshop_id: null, title, owner, pilot, priority: st === "bloque" ? "Haute" : "Normale", due_date: day(due), status: PN_STATUS.find((s) => s.key === st).action, board_status: st, origin_type: "TOP 5", board_id: board.id, description: desc, effectiveness: null, created_at: new Date(Date.now() - ago * 864e5).toISOString(), ...(st === "resolu" ? { board_closed_week: cur, closed_at: new Date(Date.now() - 864e5).toISOString() } : {}) });
  base.actions = (base.actions || []).concat([
    mk("A-PN1", "Quick win", "Atelier", 81, "Karim B.", "qualifier", "Petites améliorations proposées par les équipes au TOP 5 : à trier et à lancer.", 3),
    mk("A-PN2", "Aspiration déligneuse", "Maintenance", 96, "Yann L.", "cours", "Aspiration insuffisante sur la déligneuse : copeaux au poste, arrêts de nettoyage. A3 en cours.", 30),
    mk("A-PN3", "Masterwood", "Maintenance", 109, "Yann L.", "resolu", "Centre d’usinage Masterwood : ventouse en panne à répétition. Pièce changée, plus d’arrêt depuis trois semaines.", 40),
    mk("A-PN4", "Machine MIC", "Méthodes", 124, "Sophie M.", "bloque", "Réglages longs sur la machine MIC : pièce de rechange en attente du fournisseur.", 20),
  ]);
  base.meetings = (base.meetings || []).concat(weeks.map((w, k) => ({ id: `PNM-${board.id}-${w}`, kind: "top5", source: "panneau", board_id: board.id, site_id: "marzin", workshop_id: null, date: pnMeetingDay(board, w), letters: k === 5 ? { S: "ok", Q: "ok", C: "ko", D: "ok", P: "ok" } : {}, notes: k === 5 ? { S: "Jours sans accident 47 · Record 212", C: "Top 1 Aspiration déligneuse : 3 h 20 d’arrêt", free: `Messages : ${M[5].join(" / ")}` } : {}, infos: [], answers: [], questions: [], present: [], ended_at: new Date(`${pnMeetingDay(board, w)}T10:40:00`).toISOString(), by: by[k] })));
  return base;
}
// Le panneau alimente aussi le pilotage : livrées à temps → service client, absentéisme → couverture effectif.
function pnMeasuresFor(base, b, week, values) {
  base.measures ||= [];
  const day = pnMeetingDay(b, week);
  base.measures = base.measures.filter((m) => !(m.board_id === b.id && m.period === day));
  for (const r of b.rows || []) {
    const k = r.kpi && (base.kpis || []).find((x) => x.code === r.kpi), v = pnNum(values?.[r.id]);
    if (!k || v === null) continue;
    base.measures.push({ id: uid("MES"), site_id: b.site_id, kpi_id: k.id, code: k.code, axis: k.axis, unit: k.unit, period: day, value: +(r.toKpi === "complement" ? 100 - v : v).toFixed(1), target: k.target, definition: k.definition, source: `${b.name} · reporté du panneau`, entry_mode: "panneau", board_id: b.id, synced_at: now() });
  }
}
// On repart de zéro : rien d’autre que ce que le panneau de Marzin a produit en six semaines.
let pnUseClean = !(typeof window !== "undefined" && window.__biaTests);
const pnFreshBase = osFreshData;
function pnCleanDemo() {
  const base = pnFreshBase(false);
  base.meta.demo = true;
  base.meta.demo_revision = 5;
  base.meta.demo_story = "Exemple fictif repartant de zéro : le panneau TOP 5 de Marzin, reporté six semaines de suite. Indicateurs, sujets, A3 et messages en découlent.";
  pnDemoInto(base);
  const b = base.boards.find((x) => x.id === "PN-MARZIN");
  for (const w of base.boardWeeks.filter((x) => x.board_id === b.id)) pnMeasuresFor(base, b, w.week, w.values);
  const safety = (base.kpis || []).find((k) => k.code === "safety_signal");
  if (safety) for (const w of base.boardWeeks) base.measures.push({ id: uid("MES"), site_id: "marzin", kpi_id: safety.id, code: safety.code, axis: safety.axis, unit: safety.unit, period: pnMeetingDay(b, w.week), value: 0, target: safety.target, definition: safety.definition, source: `${b.name} · aucun accident (jours sans accident)`, entry_mode: "panneau", board_id: b.id, synced_at: now() });
  base.problems = (base.problems || []).concat([{ id: "P-PN1", site_id: "marzin", workshop_id: null, title: "Aspiration de la déligneuse insuffisante", method: "A3", status: "Analyse", owner: "Yann L. (maintenance)", signal_ids: [], action_ids: ["A-PN2"], created_at: new Date(Date.now() - 28 * 864e5).toISOString(), content: {
    context: "Remonté au TOP 5 Marzin il y a quatre semaines : copeaux au poste de la déligneuse, arrêts pour nettoyer. Top 1 des pertes du panneau trois semaines de suite.",
    background: "Environ 3 h d’arrêt par semaine (panneau, ligne Coût · Top 1). Poussière au poste : gêne et risque pour l’opérateur.",
    current: "Débit d’aspiration mesuré à 40 % sous la valeur constructeur.",
    target: "Débit conforme, moins de 30 minutes d’arrêt par semaine.",
    analysis: "Mesure du débit en trois points de la gaine, contrôle du filtre et des clapets.",
    causes: "Filtre colmaté ; gaine percée au coude ; nettoyage du filtre non planifié.",
    root_cause: "Pas de standard de nettoyage du filtre : il n’est fait qu’en cas de panne.",
    countermeasures: "Changer le filtre et la gaine ; nettoyage du filtre dans la maintenance de premier niveau, chaque vendredi.",
    actions: "A-PN2 · Aspiration déligneuse (maintenance).",
    verification: "Suivre la ligne Top 1 du panneau quatre semaines après réparation.",
    effectiveness: "À mesurer après réparation." } }]);
  // Le plan d’actions : ce que les sujets du panneau ont déclenché, avec des états et des échéances réalistes.
  const day = (k) => pnDate(today(), k), ago = (k) => new Date(Date.now() - k * 864e5).toISOString();
  const act = (id, title, owner, status, due, o = {}) => ({ id, site_id: "marzin", workshop_id: null, title, owner, priority: o.priority || "Normale", status, due_date: day(due), origin_type: o.type || "TOP 5", ...(o.origin ? { origin_id: o.origin } : {}), ...(o.parent ? { parent_id: o.parent } : {}), description: o.desc || "", effectiveness: o.eff || null, progress: { Ouverte: 0, "En cours": 50, "À vérifier": 90, Clôturée: 100, Standby: 0 }[status] ?? 0, contributors: [], created_at: ago(o.ago || 10), ...(status === "Clôturée" ? { closed_at: ago(2) } : {}) });
  base.actions.push(
    act("A-PN21", "Mesurer le débit d’aspiration en trois points", "Yann L. (maintenance)", "Clôturée", -20, { type: "A3", origin: "P-PN1", parent: "A-PN2", desc: "Débit mesuré à 40 % sous la valeur constructeur.", eff: "Mesure faite", ago: 26 }),
    act("A-PN22", "Changer le filtre et la gaine percée au coude", "Yann L. (maintenance)", "En cours", 6, { type: "A3", origin: "P-PN1", parent: "A-PN2", priority: "Haute", desc: "Pièces commandées, intervention prévue un vendredi après-midi.", ago: 9 }),
    act("A-PN23", "Ajouter le nettoyage du filtre à la maintenance de premier niveau (chaque vendredi)", "Karim B. (chef d’équipe)", "Ouverte", 20, { type: "A3", origin: "P-PN1", parent: "A-PN2", desc: "Standard à écrire avec l’opérateur de la déligneuse, puis former l’équipe.", ago: 5 }),
    act("A-PN11", "Repérer au sol l’emplacement des transpalettes", "Karim B. (chef d’équipe)", "À vérifier", -2, { parent: "A-PN1", desc: "Marquage jaune fait ; vérifier une semaine que les transpalettes y sont rangés (message 1 du panneau).", ago: 14 }),
    act("A-PN12", "Bac à chutes au poste de débit", "Équipe atelier", "Clôturée", -6, { parent: "A-PN1", desc: "Idée d’un opérateur au TOP 5 : fini les chutes au sol.", eff: "Plus de chutes au sol depuis deux semaines", ago: 18 }),
    act("A-PN13", "Porte-outils au poste de la machine MIC", "Équipe atelier", "Ouverte", 12, { parent: "A-PN1", desc: "Proposé au TOP 5 : clés de réglage toujours à portée.", ago: 3 }),
    act("A-PN41", "Relancer le fournisseur de la pièce MIC", "Sophie M. (méthodes)", "En cours", -3, { parent: "A-PN4", priority: "Haute", desc: "Délai dépassé : pièce annoncée la semaine dernière. Escalader au directeur si pas de date ferme.", ago: 20 }),
    act("A-PN31", "Vérifier trois semaines sans arrêt de la ventouse Masterwood", "Yann L. (maintenance)", "Clôturée", -1, { parent: "A-PN3", desc: "Suivi par la ligne Top 1 du panneau.", eff: "Aucun arrêt ventouse depuis le changement", ago: 25 }),
    act("A-PN51", "Contrôle du premier panneau de chaque série : fiche au poste", "Qualité", "En cours", 8, { desc: "Suite du message qualité du panneau : une fiche simple, signée par l’opérateur.", ago: 4 }),
    act("A-PN52", "EPI : contrôle à l’entrée de l’atelier pendant deux semaines", "Karim B. (chef d’équipe)", "Ouverte", 10, { priority: "Haute", desc: "Suite du message sécurité du panneau.", ago: 2 })
  );
  return base;
}
osFreshData = function (demo) { if (demo && pnUseClean) return pnCleanDemo(); return pnFreshBase.apply(this, arguments); };

/* ---------- Branchements ---------- */

function pnBind(root = document) {
  root.querySelectorAll("[data-pn-week]").forEach((b) => (b.onclick = () => { state.pnWeek = b.dataset.pnWeek; state.pnEdit = null; render(); }));
  root.querySelectorAll("[data-pn-report]").forEach((b) => (b.onclick = () => { state.pnEdit = `${b.dataset.pnReport}|${b.dataset.pnFor}`; state.pnWeek = b.dataset.pnFor; render(); document.getElementById("pnForm")?.scrollIntoView({ block: "start" }); }));
  root.querySelectorAll("[data-pn-open]").forEach((b) => (b.onclick = () => { const bd = (data.boards || []).find((x) => x.id === b.dataset.pnOpen); if (!bd) return; if (pnWeek(bd, pnCurrentWeek(bd))) { state.pnEdit = null; state.pnWeek = null; if (t5Can()) { state.t5Tab = true; switchView("sqcdp"); state.t5Tab = true; } else switchView("sqcdp"); render(); } else pnOpenReport(bd.id); }));
  root.querySelectorAll("[data-pn-cancel]").forEach((b) => (b.onclick = () => { state.pnEdit = null; render(); }));
  root.querySelectorAll("[data-pn-site]").forEach((b) => (b.onclick = () => { state.site = b.dataset.pnSite; state.pnWeek = null; try { localStorage.setItem("biaSite", state.site); } catch { /* */ } render(); }));
  const f = root.querySelector("#pnForm");
  if (f) f.onsubmit = (e) => { e.preventDefault(); if (pnSave(f)) render(); };
}
const pnOsBindBase = osBind;
osBind = function () { const out = pnOsBindBase.apply(this, arguments); pnBind(document); return out; };

if (typeof ER_NEWS !== "undefined") {
  const t5Tab = () => uxTabs(uxStages().find((x) => x.id === "voir")).find((t) => t.key === "top5");
  ER_NEWS.unshift({ v: "8.46", label: "Panneau TOP 5 reporté", text: "Le panneau d’atelier reste au feutre ; après la réunion, on le recopie en 5 minutes : tendances calculées, sujets au plan d’actions, messages aux équipes.", get nav() { return t5Tab()?.view || "sqcdp"; }, get set() { return t5Tab()?.set || { t5Tab: true }; } });
}
