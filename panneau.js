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
    ${wk?.photo ? `<figure class="pn-photo">${phImg(wk.photo, "pn-photo-img", "Photo du panneau")}<figcaption>Photo du panneau prise après la réunion</figcaption></figure>` : ""}
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
// Ce que le panneau dit, lettre par lettre : écart si un indicateur recule, résumé des valeurs.
function pnSummary(b, values, prevValues) {
  const letters = {}, notes = {};
  for (const ax of Object.keys(PN_AXIS)) {
    const rows = (b.rows || []).filter((r) => r.axis === ax);
    if (!rows.length) continue;
    const tr = rows.map((r) => pnTrend(r, values[r.id], prevValues?.[r.id])).filter(Boolean);
    if (tr.some((t) => t.tone === "bad")) letters[ax] = "ko"; else if (rows.some((r) => values[r.id] !== undefined)) letters[ax] = "ok";
    const said = rows.filter((r) => values[r.id] !== undefined).map((r) => `${r.label} ${r.kind === "text" ? values[r.id] : r.kind === "poles" ? r.poles.map((p, i) => `${p} ${pnFmt(values[r.id][i])}`).join(", ") : r.kind === "pair" ? `${pnFmt(values[r.id][0])} · ${pnFmt(values[r.id][1], "€")}` : pnFmt(values[r.id], r.unit)}`);
    if (said.length) notes[ax] = said.join(" · ");
  }
  return { letters, notes };
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
    const { letters, notes } = pnSummary(b, values, prev?.values);
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

/* ---------- Données d’exemple : l’atelier de Marzin, six semaines (tout est fictif) ----------
   Fil rouge : les quatre sujets du plan d’action du panneau (repris tels quels), et ce qu’ils ont déclenché.
   - Aspiration déligneuse (en cours) : signal → TOP 5 → A3 → réparation → arrêts divisés par 4 → OPL → gain à valider → bonne pratique.
   - Masterwood (résolu) : signal → non-conformités → ventouse changée → plus de rebut → gain validé.
   - Machine MIC (bloqué) : signal → chronométrage → pièce en attente → escalade au TOP 15 → décision redescendue.
   - Quick win (à qualifier) : les idées des opérateurs remontées au TOP 5. */

const PN_PEOPLE = {
  lead: "Karim B. (chef d’équipe)", lead2: "Nora L. (cheffe d’équipe)", maint: "Yann L. (maintenance)", meth: "Sophie M. (méthodes)",
  qual: "Julie R. (qualité)", dir: "Thomas G. (directeur de site)", lean: "Responsable Lean Groupe",
  op1: "Mathis P. (déligneuse)", op2: "Inès D. (Masterwood)", op3: "Lucas F. (machine MIC)", op4: "Camille T. (préparation)",
};

function pnDemoInto(base) {
  if (!base || (base.boards || []).some((b) => b.id === "PN-MARZIN")) return base;
  const P = PN_PEOPLE;
  const board = { id: "PN-MARZIN", site_id: "marzin", workshop_id: null, name: "TOP 5 Marzin", slot: "Mardi 10 h", weekday: 1, messages: 3, rows: PN_ROWS_MARZIN.map((r) => ({ ...r })), created_at: now() };
  base.boards = [...(base.boards || []), board];
  const cur = pnCurrentWeek(board), weeks = [5, 4, 3, 2, 1, 0].map((k) => pnDate(cur, -7 * k));
  // Six semaines de panneau. La réparation de l’aspiration tombe entre la 4e et la 5e semaine.
  const S = {
    jsa: [12, 19, 26, 33, 40, 47], record: [212, 212, 212, 212, 212, 212],
    ncpole: [[6, 4, 2], [7, 3, 2], [5, 4, 2], [4, 3, 2], [5, 2, 1], [5, 3, 2]],
    sav: [[3, 1200], [4, 2100], [5, 2600], [2, 800], [3, 1400], [4, 1850]],
    erreurs: [9, 8, 10, 7, 7, 6], ca: [388, 402, 371, 415, 398, 412],
    otd: [86, 88, 84, 89, 90, 91], retard: [12, 10, 14, 9, 8, 7], abs: [5.1, 4.8, 5.6, 4.5, 4.4, 4.2],
    top1: ["Aspiration déligneuse : 2 h 50", "Aspiration déligneuse : 3 h 10", "Aspiration déligneuse : 3 h 20", "Aspiration déligneuse : 3 h 05", "Attente matière : 1 h 40", "Réglages machine MIC : 1 h 30"],
    top2: ["Masterwood : ventouse, 2 h 30", "Masterwood : ventouse, 1 h 45", "Réglages machine MIC : 1 h 50", "Réglages machine MIC : 1 h 40", "Réglages machine MIC : 1 h 35", "Attente matière : 1 h 20"],
    top3: ["Réglages machine MIC : 1 h 30", "Réglages machine MIC : 1 h 40", "Attente matière : 1 h 20", "Attente matière : 1 h 30", "Aspiration déligneuse : 45 min", "Aspiration déligneuse : 25 min"],
  };
  const M = [
    ["Rangement fin de poste : 10 minutes avant 17 h", "Gants de manutention obligatoires au débit", "Qualité : identifier chaque palette en sortie de ligne"],
    ["Ventouses Masterwood : prévenir la maintenance au moindre jeu", "Ne rien stocker devant les extincteurs", "Qualité : fiche verte sur tout produit bloqué"],
    ["Visite client jeudi : atelier rangé mercredi soir", "Casque antibruit obligatoire à la déligneuse", "Qualité : décollement de plaxage chez un client, contrôle renforcé"],
    ["Arrêt déligneuse vendredi 14 h : changement du filtre d’aspiration", "Allées dégagées : rien au sol hors marquage", "Qualité : contrôle des cotes à la reprise sur Masterwood"],
    ["Merci à la maintenance : la déligneuse aspire de nouveau", "Signaler tout presqu’accident au chef d’équipe", "Qualité : zéro rebut de cote sur Masterwood depuis 3 semaines"],
    ["Stationner les transpalettes dans les zones identifiées", "Consigne sécurité : porter les EPI en atelier", "Qualité : contrôler le premier panneau de chaque série"],
  ];
  const A3 = ["", "A3 ouvert : aspiration de la déligneuse (pilote : maintenance)", "A3 : débit mesuré à 40 % sous la valeur constructeur", "A3 : causes trouvées (filtre colmaté, gaine percée), pièces commandées", "A3 : filtre et gaine changés, arrêts divisés par 4", "A3 : standard de nettoyage du filtre (OPL) en place, suivi sur 4 semaines"];
  const by = [P.lead, P.lead, P.lead2, P.lead, P.lead, P.lead];
  base.boardWeeks = (base.boardWeeks || []).concat(weeks.map((w, k) => {
    const values = {};
    for (const r of board.rows) values[r.id] = Array.isArray(S[r.id][k]) ? [...S[r.id][k]] : S[r.id][k];
    const at = new Date(`${pnMeetingDay(board, w)}T10:${String(36 + k).padStart(2, "0")}:00`).toISOString();
    return { id: `PNW-${w}`, board_id: board.id, site_id: "marzin", workshop_id: null, week: w, values, messages: M[k], a3: A3[k], by: by[k], at };
  }));
  // Le plan d’action du panneau, repris tel quel.
  const subj = (id, title, owner, due, st, desc, ago) => ({ id, site_id: "marzin", workshop_id: null, title, owner, pilot: "", priority: st === "bloque" ? "Haute" : "Normale", due_date: due, status: PN_STATUS.find((s) => s.key === st).action, board_status: st, origin_type: "TOP 5", board_id: board.id, description: desc, effectiveness: null, progress: { qualifier: 0, cours: 50, resolu: 100, bloque: 25 }[st], contributors: [], created_at: new Date(Date.now() - ago * 864e5).toISOString(), ...(st === "resolu" ? { board_closed_week: cur, closed_at: new Date(Date.now() - 864e5).toISOString() } : {}) });
  base.actions = (base.actions || []).concat([
    subj("A-PN1", "Quick win", "Atelier", "2027-01-31", "qualifier", "Les idées des opérateurs remontées au TOP 5 : cinq à trier (voir Résoudre › Idées).", 30),
    subj("A-PN2", "Aspiration déligneuse", "Maintenance", "2027-02-15", "cours", "Aspiration insuffisante : copeaux au poste, 3 h d’arrêt par semaine. A3 P-PN1.", 34),
    subj("A-PN3", "Masterwood", "Maintenance", "2027-02-28", "resolu", "Ventouse du centre d’usinage : panneaux qui bougent, cotes hors tolérance. Ventouse changée.", 33),
    subj("A-PN4", "Machine MIC", "Méthodes", "2027-03-15", "bloque", "Réglages de 45 min : vis de butée usée, pièce en attente du fournisseur. Escaladé au TOP 15.", 22),
  ]);
  base.meetings = (base.meetings || []).concat(weeks.map((w, k) => {
    const wk = base.boardWeeks.find((x) => x.board_id === board.id && x.week === w), prev = k ? base.boardWeeks.find((x) => x.board_id === board.id && x.week === weeks[k - 1]) : null;
    const { letters, notes } = pnSummary(board, wk.values, prev?.values);
    notes.free = `Messages : ${M[k].join(" / ")}`;
    return { id: `PNM-${board.id}-${w}`, kind: "top5", source: "panneau", board_id: board.id, site_id: "marzin", workshop_id: null, date: pnMeetingDay(board, w), letters, notes, infos: [], answers: [], questions: [], present: [], ended_at: wk.at, by: by[k] };
  }));
  return base;
}
// Le panneau alimente aussi le pilotage : livrées à temps → service client, absentéisme → couverture effectif.
function pnMeasuresFor(base, b, week, values) {
  base.measures ||= [];
  const day = week; // période commune à tous les sites : le lundi de la semaine (comparaison « Décider »)
  base.measures = base.measures.filter((m) => !(m.board_id === b.id && m.period === day && m.code !== "trs" && m.code !== "scrap"));
  for (const r of b.rows || []) {
    const k = r.kpi && (base.kpis || []).find((x) => x.code === r.kpi), v = pnNum(values?.[r.id]);
    if (!k || v === null) continue;
    base.measures.push({ id: uid("MES"), site_id: b.site_id, kpi_id: k.id, code: k.code, axis: k.axis, unit: k.unit, period: day, value: +(r.toKpi === "complement" ? 100 - v : v).toFixed(1), target: k.target, definition: k.definition, source: `${b.name} · reporté du panneau`, entry_mode: "panneau", board_id: b.id, synced_at: now() });
  }
}

/* ---------- L’histoire autour du panneau ---------- */

function pnStory(base) {
  const P = PN_PEOPLE, d = (k) => pnDate(today(), -k), at = (k, h = "09:00") => new Date(`${d(k)}T${h}:00`).toISOString();
  const site = "marzin", ws = (base.workshops || []).find((w) => w.site_id === site);
  if (ws) ws.name = "Atelier de Marzin";
  const wsId = ws?.id || null, kpi = (c) => (base.kpis || []).find((k) => k.code === c);
  const act = (id, title, owner, status, due, o = {}) => ({ id, site_id: site, workshop_id: null, title, owner, priority: o.priority || "Normale", status, due_date: d(-due), origin_type: o.type || "TOP 5", ...(o.origin ? { origin_id: o.origin } : {}), ...(o.parent ? { parent_id: o.parent } : {}), description: o.desc || "", effectiveness: o.eff || null, evidence: o.eff || "", progress: { Ouverte: 0, "En cours": 50, "À vérifier": 90, Clôturée: 100, Standby: 0 }[status] ?? 0, contributors: [], created_at: at(o.ago || 10), updated_at: at(Math.max(0, (o.ago || 10) - 3)), ...(status === "Clôturée" ? { closed_at: at(o.closed ?? 2), verified_by: o.verifier || P.lead } : {}) });

  /* Observer · signaux des opérateurs */
  base.signals = [
    { id: "S-PN1", site_id: site, workshop_id: wsId, zone: "Déligneuse", type: "Maintenance", description: "L’aspiration de la déligneuse ne tire plus : copeaux au poste, poussière, je dois arrêter pour nettoyer.", severity: "Majeure", state: "Action en cours", immediate_action: "Nettoyage du poste, masque FFP2 en attendant.", author: P.op1, owner: P.maint, response_due: d(33), created_at: at(35, "08:20"), updated_at: at(12), action_id: "A-PN2", problem_id: "P-PN1", kpi_id: kpi("trs")?.id, history: [{ status: "Nouveau", note: "Remonté depuis le poste.", at: at(35, "08:20") }, { status: "Pris en compte", note: "Porté au TOP 5 du mardi.", at: at(34, "10:40") }, { status: "Action en cours", note: "A3 ouvert par la maintenance.", at: at(28) }] },
    { id: "S-PN2", site_id: site, workshop_id: wsId, zone: "Centre d’usinage Masterwood", type: "Qualité", description: "La ventouse 3 ne tient plus le panneau : il bouge pendant l’usinage, les cotes partent.", severity: "Majeure", state: "Résolu", immediate_action: "Pièces isolées, usinage sur les ventouses 1, 2 et 4 seulement.", author: P.op2, owner: P.maint, response_due: d(32), created_at: at(33, "14:05"), updated_at: at(24), action_id: "A-PN31", problem_id: null, kpi_id: kpi("scrap")?.id, history: [{ status: "Nouveau", note: "Remonté depuis le poste.", at: at(33, "14:05") }, { status: "Action en cours", note: "Ventouse commandée.", at: at(32) }, { status: "Résolu", note: "Ventouse changée, essai sur 20 panneaux conforme.", at: at(24) }] },
    { id: "S-PN3", site_id: site, workshop_id: wsId, zone: "Machine MIC", type: "Production", description: "45 minutes de réglage à chaque changement : la vis de butée est usée, on règle à tâtons.", severity: "Mineure", state: "Action en cours", immediate_action: "Repère au feutre sur la butée en attendant la pièce.", author: P.op3, owner: P.meth, response_due: d(20), created_at: at(22, "15:30"), updated_at: at(9), action_id: "A-PN41", problem_id: null, kpi_id: kpi("trs")?.id, history: [{ status: "Nouveau", note: "Remonté depuis le poste.", at: at(22, "15:30") }, { status: "Action en cours", note: "Pièce commandée, réglages chronométrés.", at: at(20) }] },
    { id: "S-PN4", site_id: site, workshop_id: wsId, zone: "Allée centrale", type: "Sécurité", description: "Deux transpalettes laissés dans l’allée devant l’armoire électrique.", severity: "Majeure", state: "Pris en compte", immediate_action: "Transpalettes rangés.", author: P.op4, owner: P.lead, response_due: d(2), created_at: at(4, "11:10"), updated_at: at(3), action_id: "A-PN11", problem_id: null, kpi_id: kpi("safety_signal")?.id, history: [{ status: "Nouveau", note: "Remonté depuis le poste.", at: at(4, "11:10") }, { status: "Pris en compte", note: "Message 1 du panneau de la semaine.", at: at(1, "10:40") }] },
  ];

  /* Résoudre · l’A3 de l’aspiration */
  base.problems = [{ id: "P-PN1", site_id: site, workshop_id: null, title: "Aspiration de la déligneuse insuffisante", method: "A3", status: "Standardisation", owner: P.maint, signal_ids: ["S-PN1"], action_ids: ["A-PN2", "A-PN21", "A-PN22", "A-PN23", "A-PN24"], created_at: at(28), content: {
    context: "Remonté par l’opérateur de la déligneuse puis au TOP 5 Marzin : copeaux au poste, arrêts pour nettoyer. Top 1 des pertes du panneau quatre semaines de suite.",
    background: "Environ 3 h d’arrêt par semaine (panneau, ligne Coût · Top 1). Poussière au poste : gêne et risque pour l’opérateur.",
    current: "Débit d’aspiration mesuré à 40 % sous la valeur constructeur. Arrêts « nettoyage aspiration » : 40 min par jour en moyenne (feuilles de poste).",
    target: "Moins de 10 minutes d’arrêt par jour, poste propre en fin de journée.",
    analysis: "Mesure du débit en trois points de la gaine, contrôle du filtre et des clapets, lecture des feuilles de poste sur 4 semaines.",
    causes: "Filtre colmaté ; gaine percée au coude ; nettoyage du filtre jamais planifié.",
    root_cause: "Pas de standard de nettoyage du filtre : il n’est fait qu’en cas de panne.",
    countermeasures: "Filtre et gaine changés ; nettoyage du filtre chaque vendredi dans la maintenance de premier niveau (OPL-PN1).",
    actions: "A-PN21 mesure du débit · A-PN22 filtre et gaine · A-PN23 standard de nettoyage · A-PN24 suivi sur 4 semaines.",
    verification: "Feuilles de poste : 40 min → 7 min d’arrêt par jour depuis la réparation. Top 1 du panneau : l’aspiration en est sortie.",
    effectiveness: "À confirmer à 4 semaines (A-PN24)." } }];
  base.documents = [{ id: "DOC-PN1", site_id: site, type: "A3", title: "P-PN1 · Aspiration de la déligneuse", status: "En cours", problem_id: "P-PN1", updated_at: at(5), version: 2 }];

  /* Agir · le plan d’actions : ce que les sujets ont déclenché */
  base.actions.push(
    act("A-PN21", "Mesurer le débit d’aspiration en trois points", P.maint, "Clôturée", -22, { type: "A3", origin: "P-PN1", parent: "A-PN2", desc: "Débit mesuré à 40 % sous la valeur constructeur.", eff: "Mesure faite et notée dans l’A3", ago: 27, closed: 22, verifier: P.meth }),
    act("A-PN22", "Changer le filtre et la gaine percée au coude", P.maint, "Clôturée", -12, { type: "A3", origin: "P-PN1", parent: "A-PN2", priority: "Haute", desc: "Intervention le vendredi après-midi, déligneuse arrêtée 3 h.", eff: "Arrêts divisés par 4 dès la semaine suivante", ago: 21, closed: 12, verifier: P.lead }),
    act("A-PN23", "Écrire le standard de nettoyage du filtre et former l’équipe", P.lead, "En cours", 6, { type: "A3", origin: "P-PN1", parent: "A-PN2", desc: "OPL-PN1 validée ; 2 opérateurs formés sur 4.", ago: 11 }),
    act("A-PN24", "Vérifier l’effet sur 4 semaines (feuilles de poste)", P.maint, "En cours", 16, { type: "A3", origin: "P-PN1", parent: "A-PN2", desc: "Suivre les arrêts « nettoyage aspiration » et la ligne Top 1 du panneau.", ago: 10 }),
    act("A-PN31", "Changer la ventouse 3 du Masterwood", P.maint, "Clôturée", -24, { type: "Signal", origin: "S-PN2", parent: "A-PN3", priority: "Haute", desc: "Pièce reçue en 4 jours.", eff: "Essai sur 20 panneaux conforme", ago: 32, closed: 24, verifier: P.qual }),
    act("A-PN32", "Ajouter le contrôle des ventouses à la maintenance de premier niveau", P.lead, "Clôturée", -15, { parent: "A-PN3", desc: "Contrôle visuel du joint chaque lundi.", eff: "Fait 3 lundis de suite", ago: 23, closed: 8, verifier: P.maint }),
    act("A-PN33", "Vérifier trois semaines sans rebut de cote", P.qual, "Clôturée", -2, { parent: "A-PN3", desc: "Suivi des non-conformités « Dimension » sur Masterwood.", eff: "Aucune NC de cote depuis le changement", ago: 23, closed: 1, verifier: P.qual }),
    act("A-PN41", "Obtenir la vis de butée de la machine MIC", P.meth, "En cours", -3, { type: "Signal", origin: "S-PN3", parent: "A-PN4", priority: "Haute", desc: "Délai fournisseur dépassé. Escaladé au TOP 15 : second fournisseur décidé, livraison sous 10 jours.", ago: 20 }),
    act("A-PN42", "Chronométrer les réglages de la MIC", P.meth, "Clôturée", -15, { parent: "A-PN4", desc: "Cinq changements filmés.", eff: "45 min en moyenne, dont 25 min de recherche du bon réglage", ago: 20, closed: 15, verifier: P.lead }),
    act("A-PN43", "Porte-outils au poste MIC (idée de Lucas F.)", "Équipe atelier", "Ouverte", 12, { parent: "A-PN4", desc: "Clés de réglage toujours à portée.", ago: 6 }),
    act("A-PN11", "Repérer au sol l’emplacement des transpalettes", P.lead, "À vérifier", -2, { parent: "A-PN1", desc: "Marquage jaune fait ; vérifier une semaine que les transpalettes y sont rangés (message 1 du panneau).", ago: 14 }),
    act("A-PN12", "Bac à chutes au poste de débit", "Équipe atelier", "Clôturée", -6, { parent: "A-PN1", desc: "Idée d’un opérateur au TOP 5 : fini les chutes au sol.", eff: "Plus de chutes au sol depuis deux semaines", ago: 18, closed: 6 }),
    act("A-PN51", "Fiche de contrôle du premier panneau de chaque série", P.qual, "En cours", 8, { desc: "Suite du message qualité du panneau : une fiche simple, signée par l’opérateur.", ago: 4 }),
    act("A-PN52", "EPI : contrôle à l’entrée de l’atelier pendant deux semaines", P.lead, "Ouverte", 10, { priority: "Haute", desc: "Suite du message sécurité du panneau.", ago: 2 }),
  );

  /* Résoudre · idées des équipes (le « Quick win » du panneau) */
  const idea = (id, title, problem, solution, status, proposer, ago, extra = {}) => ({ id, site_id: site, workshop_id: wsId, zone_id: null, title, problem, solution, status, owner: extra.owner || "", proposer, self: false, before_photo: "", due_date: extra.due ? d(-extra.due) : null, created_at: at(ago), updated_at: at(Math.max(0, ago - 2)), kudos: extra.kudos || [], ...extra.more });
  base.kaizens = [
    idea("KAI-PN1", "Bac à chutes au poste de débit", "Les chutes tombent au sol, on marche dessus.", "Un bac sur roulettes sous la table de débit.", "Standardisation", P.op4, 19, { owner: P.lead, kudos: ["Karim B."] }),
    idea("KAI-PN2", "Porte-outils au poste MIC", "On cherche les clés de réglage à chaque changement.", "Un panneau porte-outils avec les contours dessinés.", "Mise en œuvre", P.op3, 8, { owner: "Équipe atelier", due: 12 }),
    idea("KAI-PN3", "Éclairage de la zone de contrôle", "On voit mal les rayures sur les panneaux sombres.", "Une rampe LED au-dessus de la table de contrôle.", "Idée", P.op2, 5),
    idea("KAI-PN4", "Chariot multi-commandes", "Un aller-retour au stock par commande.", "Un chariot à 4 cases pour préparer 4 commandes d’un coup.", "Idée", P.op4, 3),
    idea("KAI-PN5", "Marquage des zones transpalettes", "Les transpalettes traînent dans les allées.", "Des emplacements peints en jaune au bout de chaque allée.", "Mise en œuvre", P.lead2, 15, { owner: P.lead, due: -2 }),
  ];

  /* Résoudre · non-conformités : le Masterwood, puis un retour client */
  const nc = (id, ago, o) => ({ id, site_id: site, date: d(ago), order_no: o.order || "", client: o.client || "", article: o.article, designation: o.designation, lot: o.lot || "", line: o.line, prod_date: d(ago + 1), origin: o.origin || "Interne", defect: o.defect, qty: o.qty, severity: o.severity || "Majeure", text: o.text, containment: o.containment || "", decision: o.decision || "Rebut", problem_id: null, action_id: o.action || null, status: o.status || "Close", by: o.by || P.qual, created_at: at(ago), ...(o.more || {}) });
  base.ncs = [
    nc("NC-PN1", 33, { article: "FAC-600 (fictif)", designation: "Façade 600 usinée", line: "Masterwood", defect: "Dimension", qty: 14, text: "Perçages décalés de 2 mm : le panneau a bougé sur la ventouse 3.", containment: "Lot trié", action: "A-PN31" }),
    nc("NC-PN2", 30, { article: "FAC-450 (fictif)", designation: "Façade 450 usinée", line: "Masterwood", defect: "Dimension", qty: 9, text: "Feuillure hors tolérance, même cause.", action: "A-PN31" }),
    nc("NC-PN3", 27, { article: "FAC-600 (fictif)", designation: "Façade 600 usinée", line: "Masterwood", defect: "Dimension", qty: 6, text: "Perçages décalés avant le changement de ventouse.", action: "A-PN31" }),
    nc("NC-PN4", 19, { article: "PRF-120 (fictif)", designation: "Profilé plaxé 120", line: "Plaxage", defect: "Aspect, rayure", qty: 4, severity: "Mineure", text: "Rayures en reprise.", decision: "Retouche" }),
    nc("NC-PN5", 9, { origin: "Client", client: "Client A (fictif)", order: "CDE-48211", article: "PRF-90 (fictif)", designation: "Profilé plaxé 90", line: "Plaxage", defect: "Collage, décollement", qty: 12, text: "Décollement du film en bout de profilé chez le client.", containment: "Stock client et atelier contrôlé : 0 autre pièce", decision: "Remplacement", status: "Ouverte", by: P.qual, action: "A-PN51", more: { ack_at: at(8) } }),
  ];

  /* Observer · feuilles de poste et micro-arrêts de la déligneuse */
  base.mlLines = [{ id: "ML-PN1", site_id: site, workshop_id: null, name: "Déligneuse", machine_id: null, threshold_min: 5, typical_min: 2, opening_min: 460, target_min: 20, rate_ph: 90, shift_min: 480, causes: ["Nettoyage aspiration", "Bourrage copeaux", "Attente matière", "Réglage guide", "Autre"] }];
  base.trsShifts = []; base.microStops = [];
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 41; k >= 1; k--) {
    const day = d(k), wd = new Date(day + "T12:00:00").getDay();
    if (wd === 0 || wd === 6) continue;
    const after = k <= 11, clean = after ? 5 + Math.round(rnd() * 4) : 34 + Math.round(rnd() * 12), change = 25 + Math.round(rnd() * 10);
    const trs = (after ? 0.81 : 0.71) + (rnd() - 0.5) * 0.04, run = 480 - 20;
    const good = Math.round((trs * 90 * run) / 60), scrap = Math.round(good * (0.015 + rnd() * 0.015));
    base.trsShifts.push({ id: `FP-PN${k}`, line_id: "ML-PN1", site_id: site, workshop_id: null, date: day, team: "Journée", shift_min: 480, planned_min: 20, stops: [{ kind: "Autre", min: clean, note: "Nettoyage aspiration" }, { kind: "Changement de série", min: change, note: "" }], micro_n: after ? 4 : 11, micro_min: after ? 7 : 19, good, scrap, rate_ph: 90, by: P.op1, created_at: at(k, "17:05"), updated_at: at(k, "17:05") });
    if (k <= 20) {
      const n = after ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const cause = after ? ["Bourrage copeaux", "Attente matière", "Réglage guide"][i % 3] : ["Nettoyage aspiration", "Bourrage copeaux", "Nettoyage aspiration", "Attente matière", "Nettoyage aspiration", "Bourrage copeaux", "Réglage guide"][i];
        base.microStops.push({ id: `MS-PN${k}-${i}`, line_id: "ML-PN1", site_id: site, at: new Date(`${day}T${String(8 + i).padStart(2, "0")}:${String(10 + Math.round(rnd() * 40)).padStart(2, "0")}:00`).toISOString(), cause, dur_s: 60 + Math.round(rnd() * 200), timed: true, by: P.op1 });
      }
    }
  }
  // TRS et rebut par semaine, au pilotage
  const b = base.boards.find((x) => x.id === "PN-MARZIN");
  for (const w of base.boardWeeks.filter((x) => x.board_id === b.id)) {
    const day = pnMeetingDay(b, w.week), from = pnDate(day, -7);
    const sh = base.trsShifts.filter((s) => s.date > from && s.date <= day);
    const t = kpi("trs"), sc = kpi("scrap");
    if (t && sh.length) base.measures.push({ id: uid("MES"), site_id: site, kpi_id: t.id, code: t.code, axis: t.axis, unit: t.unit, period: w.week, value: +((100 * sh.reduce((s, x) => s + x.good, 0)) / sh.reduce((s, x) => s + (x.rate_ph * (x.shift_min - x.planned_min)) / 60, 0)).toFixed(1), target: t.target, definition: t.definition, source: "Feuilles de poste déligneuse", entry_mode: "panneau", board_id: b.id, synced_at: now() });
    if (sc && sh.length) base.measures.push({ id: uid("MES"), site_id: site, kpi_id: sc.id, code: sc.code, axis: sc.axis, unit: sc.unit, period: w.week, value: +((100 * sh.reduce((s, x) => s + x.scrap, 0)) / sh.reduce((s, x) => s + x.good + x.scrap, 0) + (w.week < pnDate(cur(b), -14) ? 1.2 : 0)).toFixed(1), target: sc.target, definition: sc.definition, source: "Feuilles de poste et non-conformités", entry_mode: "panneau", board_id: b.id, synced_at: now() });
  }
  function cur(bd) { return pnCurrentWeek(bd); }

  /* Observer · Gemba et rapport d’étonnement */
  const obs = (g, i, fact, category, kind, decision = "À décider") => ({ id: `${g}-0${i}`, fact, category, kind, decision, standard: "", gap: "", operator: "" });
  base.gembas = [
    { id: "G-PN1", site_id: site, workshop_id: wsId, zone: "Tout l’atelier", objective: "Premier tour de l’atelier : comprendre où se perd le temps", visited_at: at(38, "09:30"), created_at: at(38, "09:00"), author: P.lean, status: "Actions en cours", observations: [
      obs("G-PN1", 1, "Transpalettes laissés dans les allées, dont un devant l’armoire électrique.", "Sécurité", "risque", "Action"),
      obs("G-PN1", 2, "EPI : un opérateur sur trois sans gants au débit.", "Sécurité", "fait", "Message au TOP 5"),
      obs("G-PN1", 3, "Copeaux et poussière au poste de la déligneuse ; l’opérateur arrête pour nettoyer.", "Maintenance", "fait", "Action"),
      obs("G-PN1", 4, "Ventouse du Masterwood réparée au ruban : le panneau bouge.", "Maintenance", "risque", "Action"),
      obs("G-PN1", 5, "Un aller-retour au stock par commande préparée.", "Flux", "fait", "Idée"),
      obs("G-PN1", 6, "Produits sans fiche d’identification en zone d’expédition : qui les a contrôlés ?", "Qualité", "question"),
      obs("G-PN1", 7, "Le panneau TOP 5 est rempli chaque mardi, mais rien n’en reste après la réunion.", "Management visuel", "fait", "Reporter le panneau dans l’application"),
    ] },
    { id: "G-PN2", site_id: site, workshop_id: wsId, zone: "Déligneuse et Masterwood", objective: "Retour terrain après les réparations", visited_at: at(8, "14:00"), created_at: at(8, "13:45"), author: P.lean, status: "À vérifier", observations: [
      obs("G-PN2", 1, "Déligneuse : poste propre en fin de journée, plus d’arrêt pour nettoyer.", "Maintenance", "fait", "Standardiser"),
      obs("G-PN2", 2, "Masterwood : contrôle des ventouses noté chaque lundi.", "Maintenance", "fait", "Rien à faire"),
      obs("G-PN2", 3, "Transpalettes encore hors zone à 16 h 30.", "Sécurité", "risque", "Action"),
      obs("G-PN2", 4, "La machine MIC attend toujours sa pièce : les réglages restent longs.", "Flux", "fait", "Escalade"),
    ] },
  ];
  base.etonnement = { [site]: { message: "Six semaines à Marzin : les pertes sont connues de l’équipe et remontent au TOP 5 ; ce qui manquait, c’est la suite. Quand un sujet a un pilote et une date, il se règle (aspiration, Masterwood).", from: d(40), to: today(), updated_at: at(1), themes: {
    "Sécurité": { analysis: "Risques de circulation réels (transpalettes dans les allées) ; EPI inégalement portés.", stake: "Accident de manutention, accès aux armoires électriques.", reco: "Marquage des zones et rappel au TOP 5 jusqu’à ce que ce soit acquis.", action: "5S sécurité des allées sur les sept sites, premier trimestre 2027." },
    "Maintenance": { analysis: "Deux pannes répétitives réglées en moins d’un mois une fois remontées au TOP 5.", stake: "3 h d’arrêt par semaine sur la déligneuse ; rebuts sur Masterwood.", reco: "Maintenance de premier niveau écrite (OPL) et suivie.", action: "Standard de maintenance de premier niveau pour chaque machine critique, 2027." },
    "Flux": { analysis: "Préparation de commandes en allers-retours ; machine MIC en attente de pièce.", stake: "Délai client et heures perdues.", reco: "Tester le chariot multi-commandes ; stock de pièces critiques.", action: "Chantier préparation de commandes Marzin, premier semestre 2027." },
    "Management visuel": { analysis: "Le panneau TOP 5 existe et vit ; l’information s’arrêtait au panneau.", stake: "Le directeur ne voyait ni les tendances ni les sujets bloqués.", reco: "Reporter le panneau dans l’application après chaque réunion.", action: "Panneau TOP 5 reporté sur les sept sites, 2027." },
  } } };

  /* Agir · le TOP 15 : la MIC bloquée monte, la décision redescend */
  base.escalations = [{ id: "ESC-PN1", site_id: site, source_id: "A-PN41", title: "Pièce MIC : délai fournisseur dépassé", level: 2, owner: P.dir, due_date: d(7), detail: "Vis de butée annoncée il y a 3 semaines, toujours pas livrée. 45 min de réglage à chaque changement.", result: "Second fournisseur retenu, livraison sous 10 jours.", status: "Traitée", created_at: at(9), closed_at: at(6) }];
  base.topics = [
    { id: "TOP-PN1", site_id: site, title: "Machine MIC bloquée : pièce fournisseur en retard", axis: "C", owner: P.meth, due_date: d(6), priority: "Haute", linked_id: "A-PN41", escalation_id: "ESC-PN1", status: "En cours", decision: "Commander chez un second fournisseur (décision du directeur de site).", created_at: at(9), updated_at: at(6) },
    { id: "TOP-PN2", site_id: site, title: "Aspiration déligneuse : arrêts divisés par 4", axis: "C", owner: P.maint, due_date: d(-16), priority: "Normale", linked_id: "P-PN1", status: "En cours", decision: "Valider le gain à 4 semaines, puis proposer le standard aux autres sites.", created_at: at(11), updated_at: at(5) },
  ];
  base.decisions = [{ id: "D-PN1", site_id: site, title: "Second fournisseur pour la vis de butée MIC", detail: "Surcoût 180 € contre 45 min de réglage perdues à chaque changement.", owner: P.dir, due_date: d(6), status: "Clos", origin_id: "TOP-PN1", result: "Commande passée le jour même." }];
  if (typeof RE_TYPES !== "undefined" && RE_TYPES.top15) {
    const mk = (id, type, site_id, time, next) => ({ id, type, site_id, title: RE_TYPES[type].label, cadence: RE_TYPES[type].cadence, time, duration: RE_TYPES[type].duration, chair: type === "top15" ? P.dir : RE_TYPES[type].chair, participants: RE_TYPES[type].participants, next_date: next, created_at: at(40) });
    const wd = (x) => { let y = x; while ([0, 6].includes(new Date(y + "T12:00:00").getDay())) y = pnDate(y, 1); return y; };
    base.instances = [mk("INS-PN1", "top15", site, "08:45", wd(today()))];
    for (const [i, t] of ["mensuelle", "copil", "comex"].entries()) if (RE_TYPES[t]) base.instances.push(mk(`INS-PN${i + 2}`, t, "group", "10:00", wd(pnDate(today(), 7 + i * 7))));
  }
  base.infos = [
    { id: "INF-PN1", site_id: site, workshop_id: null, title: "Machine MIC : pièce commandée chez un second fournisseur", why: "Livraison sous 10 jours. En attendant, réglages avec le repère au feutre ; prévenir Sophie M. si plus de 45 min.", from: P.dir, start: d(6), end: d(-8), urgent: false, photo: "", relayed: [{ site_id: site, workshop_id: null, at: at(5, "10:40"), by: P.lead }], questions: [{ id: "Q-PN1", site_id: site, workshop_id: null, text: "Qui fait les réglages en attendant la pièce ?", at: at(5, "10:45"), by: P.lead, answer: "Lucas F. et Karim B., avec le repère au feutre ; Sophie M. en appui.", answered_at: at(4, "14:00"), answered_by: P.dir, returned_at: at(1, "10:40"), returned_by: P.lead }], created_at: at(6) },
    { id: "INF-PN2", site_id: site, workshop_id: null, title: "Nouveau standard : nettoyage du filtre de la déligneuse le vendredi", why: "10 minutes chaque vendredi à 16 h 30 : c’est ce qui évite 3 h d’arrêt par semaine.", from: P.maint, start: d(5), end: d(-9), urgent: false, photo: "", relayed: [{ site_id: site, workshop_id: null, at: at(1, "10:40"), by: P.lead }], questions: [], created_at: at(5) },
  ];

  /* Pérenniser · OPL, formation, bonne pratique */
  base.opls = [
    { id: "OPL-PN1", site_id: site, workshop_id: null, kind: "base", title: "Nettoyer le filtre d’aspiration de la déligneuse", station: "Déligneuse", author: P.maint, version: 1, status: "validee", photo_a: "", photo_b: "", points: ["Chaque vendredi à 16 h 30, machine arrêtée et consignée", "Filtre sorti, soufflé dehors, remis cran en bas", "Cocher la fiche du poste"], why: "Un filtre colmaté coûtait 3 h d’arrêt par semaine.", minutes: 10, practice_id: "BP-PN1", validated_by: P.dir, validated_at: at(7), trained: [{ name: "Mathis P.", date: d(6), by: P.maint, version: 1 }, { name: "Lucas F.", date: d(6), by: P.maint, version: 1 }], created_at: at(10), updated_at: at(6) },
    { id: "OPL-PN2", site_id: site, workshop_id: null, kind: "securite", title: "Stationner les transpalettes dans les zones jaunes", station: "Allées", author: P.lead, version: 1, status: "validee", photo_a: "", photo_b: "", points: ["Fourches baissées, au sol", "Dans la zone jaune au bout de l’allée", "Jamais devant une armoire ou un extincteur"], why: "Deux transpalettes devant l’armoire électrique (signal S-PN4).", minutes: 3, practice_id: null, validated_by: P.dir, validated_at: at(2), trained: [{ name: "Camille T.", date: d(1), by: P.lead, version: 1 }], created_at: at(4), updated_at: at(1) },
    { id: "OPL-PN3", site_id: site, workshop_id: null, kind: "probleme", title: "Ventouse Masterwood : repérer un joint usé", station: "Centre d’usinage Masterwood", author: P.maint, version: 1, status: "brouillon", photo_a: "", photo_b: "", points: ["Joint fendu ou écrasé : prévenir la maintenance", "Ne jamais réparer au ruban"], why: "Trois non-conformités de cote en septembre.", minutes: 5, practice_id: null, validated_by: "", validated_at: null, trained: [], created_at: at(3), updated_at: at(3) },
  ];
  base.practices = [{ id: "BP-PN1", site_id: site, title: "Nettoyage hebdomadaire du filtre d’aspiration", category: "Maintenance", summary: "10 minutes chaque vendredi, écrites dans une OPL et cochées au poste.", evidence: "Feuilles de poste de la déligneuse : 40 → 7 min d’arrêt par jour depuis la réparation et le standard.", transfer: "Pour toute machine avec aspiration : vérifier le type de filtre, adapter la fréquence au volume de copeaux.", status: "Publiée", validated_by: P.dir, owner: P.maint, kpi_id: kpi("trs")?.id, source_id: "P-PN1", published_at: at(5) }];
  base.people = [
    ["PER-PN1", "Karim B.", "Chef d’équipe", "teamlead"], ["PER-PN2", "Nora L.", "Cheffe d’équipe", "teamlead"], ["PER-PN3", "Mathis P.", "Opérateur déligneuse", "operator"],
    ["PER-PN4", "Inès D.", "Opératrice Masterwood", "operator"], ["PER-PN5", "Lucas F.", "Opérateur machine MIC", "operator"], ["PER-PN6", "Camille T.", "Préparatrice de commandes", "operator"],
    ["PER-PN7", "Yann L.", "Technicien de maintenance", "operator"], ["PER-PN8", "Thomas G.", "Directeur de site", "director"],
  ].map(([id, name, job, prof], i) => ({ id, employee_id: `DEMO-${String(i + 1).padStart(3, "0")}`, name, site_id: site, workshop: "Atelier de Marzin", job, app_profile: prof, manager: i === 7 ? "Direction Générale" : "Thomas G.", status: "Actif" }));
  const cat = (base.trainingCatalog || []).map((x) => x.id);
  const rec = (id, person, training, k, score) => cat.includes(training) ? { id, person_id: person, training_id: training, date: d(k), trainer: P.lean, attendance: "Présent", score, level: 2, status: "Validé", evidence: "Mise en situation au poste", validated_by: P.dir, validated_at: d(k), expires_at: null } : null;
  base.trainingRecords = [rec("REC-PN1", "PER-PN1", cat[0], 20, 85), rec("REC-PN2", "PER-PN2", cat[0], 20, 78), rec("REC-PN3", "PER-PN1", cat[1], 12, 90)].filter(Boolean);

  /* Voir · gains en euros */
  const G = (id, o) => ({ id, site_id: site, by: P.lean, recurring: true, created_at: at(o.ago || 10), ...o });
  base.gains = [
    G("GAIN-PN1", { title: "Arrêts aspiration déligneuse : 3 h → 40 min par semaine", family: "prod", nature: "capacite", unit: "min", direction: "low", before: 190, target: 30, after: 40, per_year: 46, euro_rate: 1.1, cost: 2400, status: "À valider", evidence: "Feuilles de poste de la déligneuse, deux semaines après réparation", source_id: "P-PN1", start_date: d(12), ago: 11 }),
    G("GAIN-PN2", { title: "Rebuts de cote sur Masterwood supprimés", family: "fin", nature: "reel", unit: "€", direction: "low", before: 1450, target: 0, after: 0, per_year: 3, cost: 380, status: "Validé", evidence: "Trois lots rebutés en un mois (1 450 €), défaut vu environ trois fois par an ; aucune non-conformité de cote depuis le changement de ventouse", source_id: "S-PN2", start_date: d(24), validated_at: at(6), validated_by: P.dir, ago: 20 }),
    G("GAIN-PN3", { title: "Chutes au sol au poste de débit", family: "humain", nature: "evite", unit: "irritants supprimés", direction: "low", before: 1, target: 0, after: 0, per_year: 1, cost: 120, status: "Validé", evidence: "Bac à chutes en place, poste vérifié deux semaines", source_id: "KAI-PN1", start_date: d(10), validated_at: at(5), validated_by: P.lead, ago: 9 }),
    G("GAIN-PN4", { title: "Réglages machine MIC : 45 → 20 min par changement", family: "prod", nature: "capacite", unit: "min", direction: "low", before: 45, target: 20, after: null, per_year: 220, euro_rate: 1.1, cost: 830, status: "Estimé", evidence: "Chronométrage de 5 changements (A-PN42)", source_id: "S-PN3", ago: 14 }),
  ];
  base.gainTargets = [{ scope: site, euros: 20000 }];
  base.links = [
    { id: "L-PN1", from: "S-PN1", to: "P-PN1", type: "Origine" },
    { id: "L-PN2", from: "S-PN2", to: "A-PN31", type: "Origine" },
    { id: "L-PN3", from: "S-PN3", to: "A-PN41", type: "Origine" },
    { id: "L-PN4", from: "KAI-PN1", to: "A-PN12", type: "Mise en œuvre" },
  ];
  return base;
}

// On repart de zéro : rien d’autre que l’atelier de Marzin et ce que son panneau a déclenché en six semaines.
let pnUseClean = !(typeof window !== "undefined" && window.__biaTests);
const pnFreshBase = osFreshData;
function pnCleanDemo() {
  const base = pnFreshBase(false);
  base.meta.demo = true;
  base.meta.demo_revision = 6;
  base.meta.demo_story = "Exemple fictif repartant de zéro : l’atelier de Marzin sur six semaines. Le panneau TOP 5 du mardi, reporté chaque semaine, et ce que ses quatre sujets ont déclenché.";
  base.settings ||= {};
  base.settings.shifts = ["Journée"];
  pnDemoInto(base);
  const b = base.boards.find((x) => x.id === "PN-MARZIN");
  for (const w of base.boardWeeks.filter((x) => x.board_id === b.id)) pnMeasuresFor(base, b, w.week, w.values);
  const safety = (base.kpis || []).find((k) => k.code === "safety_signal");
  if (safety) for (const w of base.boardWeeks) base.measures.push({ id: uid("MES"), site_id: "marzin", kpi_id: safety.id, code: safety.code, axis: safety.axis, unit: safety.unit, period: w.week, value: 0, target: safety.target, definition: safety.definition, source: `${b.name} · aucun accident (jours sans accident)`, entry_mode: "panneau", board_id: b.id, synced_at: now() });
  pnStory(base);
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
