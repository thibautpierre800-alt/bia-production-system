"use strict";

// 8.3 · Voir › Hoshin Kanri : le cap, les priorités des sites et le plan de déploiement,
// sur le modèle du fichier « Déploiement AC » qui a servi à fixer les priorités des sites
// (matrice pondérée, phases, jalons, gouvernance, risques, macro-étapes SEQUOIA, planning).
// Le fichier est lu dans le navigateur et son contenu reste dans les données de l’appareil,
// comme toute saisie : rien de ce contenu n’est publié avec l’application.

const HK_STATUS = { todo: ["À faire", "hk-todo"], doing: ["En cours", "hk-doing"], done: ["Fait", "hk-done"] };
const HK_WAVES = [["pilot", "Pilote"], ["wave1", "Vague 1"], ["wave2", "Vague 2"], ["", "Non planifié"]];
// Critères génériques proposés quand aucun fichier n’est importé.
const HK_DEFAULT_CRITERIA = ["Urgence économique / performance", "Potentiel marché / CA", "Maturité Lean", "Relais terrain disponibles", "Maturité des données", "Risque sur le savoir-faire"];
const HK_MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

/* ---------- Lecture du classeur (navigateur) ---------- */

async function hkUnzip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw Error("Ce fichier n’est pas un classeur Excel (.xlsx).");
  const count = view.getUint16(end + 10, true), files = {};
  let p = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw Error("Classeur Excel endommagé.");
    const method = view.getUint16(p + 10, true), size = view.getUint32(p + 20, true), nameLen = view.getUint16(p + 28, true), extra = view.getUint16(p + 30, true), comment = view.getUint16(p + 32, true), local = view.getUint32(p + 42, true);
    files[new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method, size, local };
    p += 46 + nameLen + extra + comment;
  }
  const read = async (name) => {
    const f = files[name];
    if (!f) return null;
    const start = f.local + 30 + view.getUint16(f.local + 26, true) + view.getUint16(f.local + 28, true), raw = bytes.subarray(start, start + f.size);
    if (f.method === 0) return new TextDecoder().decode(raw);
    if (f.method !== 8) throw Error("Compression du classeur non prise en charge.");
    const out = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return new TextDecoder().decode(out);
  };
  return { read };
}
async function hkReadXlsx(file) {
  if (typeof DecompressionStream === "undefined") throw Error("Ce navigateur ne sait pas lire un fichier Excel : utilisez Chrome, Edge ou Safari à jour.");
  if (!file || file.size > 8 * 1024 * 1024) throw Error("Fichier absent ou trop volumineux (8 Mo au plus).");
  const zip = await hkUnzip(await file.arrayBuffer()), xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const book = await zip.read("xl/workbook.xml");
  if (!book) throw Error("Ce fichier n’est pas un classeur Excel (.xlsx).");
  const rels = {}, relsXml = await zip.read("xl/_rels/workbook.xml.rels");
  if (relsXml) for (const r of xml(relsXml).getElementsByTagName("Relationship")) rels[r.getAttribute("Id")] = r.getAttribute("Target");
  const sharedXml = await zip.read("xl/sharedStrings.xml"),
    shared = sharedXml ? [...xml(sharedXml).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
  // Couleurs de remplissage (barres du Gantt du planning) : style de cellule → couleur.
  const stylesXml = await zip.read("xl/styles.xml"), fillOf = [];
  if (stylesXml) {
    const st = xml(stylesXml), fills = [...(st.getElementsByTagName("fills")[0]?.getElementsByTagName("fill") || [])].map((f) => {
      const p = f.getElementsByTagName("patternFill")[0], fg = p?.getElementsByTagName("fgColor")[0];
      if (!p || p.getAttribute("patternType") !== "solid" || !fg) return null;
      return fg.getAttribute("rgb") || (fg.getAttribute("theme") !== null ? `theme${fg.getAttribute("theme")}` : null);
    });
    for (const xf of st.getElementsByTagName("cellXfs")[0]?.getElementsByTagName("xf") || []) fillOf.push(fills[Number(xf.getAttribute("fillId"))] || null);
  }
  const sheets = {}, colors = {};
  for (const s of xml(book).getElementsByTagName("sheet")) {
    const target = String(rels[s.getAttribute("r:id")] || "").replace(/^\/?(xl\/)?/, ""), raw = target ? await zip.read("xl/" + target) : null;
    if (!raw) continue;
    const cells = {}, painted = {};
    for (const c of xml(raw).getElementsByTagName("c")) {
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0]?.textContent, fill = fillOf[Number(c.getAttribute("s"))];
      if (fill) painted[c.getAttribute("r")] = fill;
      let value = null;
      if (t === "s") value = shared[Number(v)] ?? null;
      else if (t === "inlineStr") value = [...c.getElementsByTagName("t")].map((x) => x.textContent).join("");
      else if (t === "str" || t === "e") value = v ?? null;
      else if (t === "b") value = v === "1";
      else if (v !== undefined && v !== "") value = Number(v);
      if (value !== null && value !== "") cells[c.getAttribute("r")] = value;
    }
    sheets[s.getAttribute("name")] = cells;
    colors[s.getAttribute("name")] = painted;
  }
  return { sheets, colors };
}

/* ---------- Interprétation du classeur (pure, testable) ---------- */

function hkNorm(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function hkText(v) {
  return v === null || v === undefined ? "" : String(v).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
function hkCol(letters) {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}
function hkRows(cells) {
  const rows = new Map();
  for (const [ref, v] of Object.entries(cells || {})) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) continue;
    const r = Number(m[2]);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push({ ci: hkCol(m[1]), v });
  }
  for (const list of rows.values()) list.sort((a, b) => a.ci - b.ci);
  return new Map([...rows.entries()].sort((a, b) => a[0] - b[0]));
}
function hkSiteId(name) {
  const n = hkNorm(name);
  if (n.length < 3) return null;
  const sites = OPERATIONAL_SITES;
  return (sites.find((s) => hkNorm(s.name) === n || hkNorm(s.id) === n) || sites.find((s) => hkNorm(s.name).startsWith(n) || n.startsWith(hkNorm(s.name))))?.id || null;
}
function hkSerialDate(v) {
  return Number.isFinite(v) && v > 30000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10) : null;
}
// « le 01/09/2026 », « Fin juin 2027 », date Excel : une date ISO, sinon null.
function hkDate(v) {
  if (typeof v === "number") return hkSerialDate(v);
  const s = hkText(v), dmy = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = hkNorm(s), month = HK_MONTHS.findIndex((m) => n.includes(m)), year = /(20\d{2})/.exec(s)?.[1];
  if (month < 0 || !year) return null;
  if (/^fin/.test(n)) return new Date(Date.UTC(+year, month + 1, 0)).toISOString().slice(0, 10);
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}
function hkMonthsOf(v) {
  const m = /(\d+(?:[.,]\d+)?)\s*mois/i.exec(hkText(v));
  return m ? Number(m[1].replace(",", ".")) : Number.isFinite(v) ? v : null;
}
function hkFindSheet(sheets, re) {
  const name = Object.keys(sheets || {}).find((n) => re.test(hkNorm(n)));
  return name ? sheets[name] : null;
}
// Tableau sous un en-tête reconnu : lignes jusqu’à la première ligne vide en première colonne.
function hkTable(rows, headTest, columns) {
  for (const [r, list] of rows) {
    if (!headTest(list)) continue;
    const map = {};
    for (const [key, re] of Object.entries(columns)) map[key] = list.find((x) => re.test(hkNorm(x.v)))?.ci;
    const first = Math.min(...Object.values(map).filter(Boolean)), out = [];
    let expected = r + 1;
    for (const [r2, l2] of rows) {
      if (r2 <= r) continue;
      if (r2 !== expected) break;
      expected++;
      const lead = l2.find((x) => x.ci === first);
      if (!lead || !hkText(lead.v)) break;
      const row = {};
      for (const [key, ci] of Object.entries(map)) row[key] = ci ? l2.find((x) => x.ci === ci)?.v ?? null : null;
      row._extra = l2.filter((x) => !Object.values(map).includes(x.ci)).map((x) => hkText(x.v)).filter(Boolean);
      out.push(row);
    }
    return out;
  }
  return [];
}

function hkParseMatrix(cells, report) {
  const rows = hkRows(cells);
  let head = null, weight = null;
  for (const [r, list] of rows) {
    if (!head && list.some((x) => /^total$/.test(hkNorm(x.v)))) head = { r, list, total: list.find((x) => /^total$/.test(hkNorm(x.v))).ci };
    if (!weight && list.some((x) => /^poids$/.test(hkNorm(x.v)))) weight = { r, list, label: list.find((x) => /^poids$/.test(hkNorm(x.v))).ci };
  }
  if (!head) return null;
  const labelCi = weight?.label ?? 2;
  const criteria = head.list.filter((x) => x.ci > labelCi && x.ci < head.total && hkText(x.v)).map((x, i) => ({ id: `c${i + 1}`, ci: x.ci, name: hkText(x.v).replace(/\n/g, " "), weight: Math.max(1, Math.min(3, Number(weight?.list.find((w) => w.ci === x.ci)?.v) || 1)) }));
  if (!criteria.length) return null;
  const date = weight ? weight.list.map((w) => hkDate(w.v)).find(Boolean) || null : null;
  const scale = [...(rows.get(1) || [])].map((x) => hkText(x.v)).filter((t) => /\d/.test(t)).join(" · ");
  const scores = {}, fileTotals = {}, top = [];
  let topRow = null;
  for (const [r, list] of rows) {
    if (r <= Math.max(head.r, weight?.r || 0)) continue;
    const label = list.find((x) => x.ci === labelCi);
    if (!label || typeof label.v !== "string") continue;
    if (/^top\d*$/.test(hkNorm(label.v))) { topRow = { r, ci: labelCi }; break; }
    const id = hkSiteId(label.v);
    if (!id) { report.warnings.push(`Ligne « ${hkText(label.v)} » : entité inconnue, ignorée.`); continue; }
    scores[id] = {};
    for (const c of criteria) {
      const v = list.find((x) => x.ci === c.ci)?.v;
      scores[id][c.id] = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : null;
    }
    const total = list.find((x) => x.ci === head.total)?.v;
    if (typeof total === "number") fileTotals[id] = total;
  }
  if (topRow) {
    for (const [r, list] of rows) {
      if (r < topRow.r) continue;
      const name = list.find((x) => x.ci === topRow.ci + 1);
      if (!name || !hkText(name.v)) { if (r > topRow.r) break; continue; }
      const id = hkSiteId(name.v);
      if (id) top.push({ site_id: id, note: hkText(list.find((x) => x.ci === topRow.ci + 2)?.v) });
    }
  }
  for (const c of criteria) delete c.ci;
  const blank = criteria.filter((c) => Object.values(scores).every((s) => s[c.id] === null));
  for (const c of blank) report.warnings.push(`Critère « ${c.name} » non noté dans le fichier : il compte pour 0.`);
  return { date, scale, criteria, scores, fileTotals, top };
}

function hkParseDeployment(cells) {
  const rows = hkRows(cells), out = {};
  const lead = (re) => (list) => re.test(hkNorm(list[0]?.v));
  out.phases = hkTable(rows, (l) => /^phase$/.test(hkNorm(l[0]?.v)), { name: /^phase$/, duration: /^duree/, actions: /^actions/, deliverables: /^livrable/, notes: /^planning/ })
    .map((p) => ({ name: hkText(p.name), months: hkMonthsOf(p.duration), duration: hkText(p.duration), actions: hkText(p.actions), deliverables: hkText(p.deliverables), notes: [hkText(p.notes), ...p._extra].filter(Boolean).join(" · ") }));
  out.governance = hkTable(rows, lead(/^instance$/), { instance: /^instance$/, rhythm: /^rythme/, composition: /^composition/, role: /^role/ })
    .map((g) => ({ instance: hkText(g.instance), rhythm: hkText(g.rhythm), composition: hkText(g.composition), role: hkText(g.role) }));
  out.milestones = hkTable(rows, lead(/^jalon$/), { name: /^jalon$/, date: /^date$/, criteria: /^criteres/ })
    .filter((j) => !/^indicateurs/.test(hkNorm(j.name)) && (hkText(j.date) || hkText(j.criteria)))
    .map((j) => ({ name: hkText(j.name), date: hkDate(j.date), dateLabel: typeof j.date === "number" ? null : hkText(j.date), criteria: hkText(j.criteria), done: false }));
  out.risks = hkTable(rows, lead(/^risques?$/), { risk: /^risques?$/, value: /^valeur/, mitigation: /^parade/ })
    .map((k) => ({ risk: hkText(k.risk), value: hkText(k.value), mitigation: hkText(k.mitigation) }));
  for (const list of rows.values()) for (const x of list) {
    const t = hkText(x.v);
    if (/^indicateurs de suivi/i.test(t)) out.indicators = t.replace(/^indicateurs de suivi\s*:?\s*/i, "");
    if (/^lesuccessemesure/.test(hkNorm(t))) out.success = t;
  }
  return out;
}

function hkParseMacro(cells) {
  const rows = hkRows(cells);
  let titles = null, descRow = null;
  for (const [r, list] of rows) {
    const texts = list.filter((x) => typeof x.v === "string" && hkText(x.v).length > 3 && !/^description$/.test(hkNorm(x.v)));
    if (!titles && texts.length >= 3) titles = { r, list: texts };
    if (list.filter((x) => /^description$/.test(hkNorm(x.v))).length >= 2) descRow = r;
  }
  if (!titles) return [];
  const desc = descRow ? rows.get([...rows.keys()].find((k) => k > descRow)) || [] : [];
  return titles.list.map((x) => ({ title: hkText(x.v), description: hkText(desc.find((d) => d.ci === x.ci)?.v) }));
}

function hkIsoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4)), monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}
function hkAddDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Colonnes de semaines du Gantt (« S45 », « S1 »…) → lundi de chaque semaine, année
// lue dans la ligne des années au-dessus (cellules fusionnées 2026, 2027…).
function hkWeekColumns(rows, headR) {
  const head = rows.get(headR) || [], years = [];
  for (const [r, list] of rows) if (r < headR) for (const x of list) if (typeof x.v === "number" && x.v >= 2000 && x.v <= 2100) years.push({ ci: x.ci, y: x.v });
  years.sort((a, b) => a.ci - b.ci);
  const out = new Map();
  let prevWeek = null, wrapYear = null;
  for (const x of head) {
    const m = /^S(\d{1,2})$/i.exec(hkText(x.v));
    if (!m) continue;
    const week = Number(m[1]);
    let year = years.filter((y) => y.ci <= x.ci).at(-1)?.y;
    if (!year) { wrapYear ??= new Date().getUTCFullYear(); if (prevWeek !== null && week < prevWeek) wrapYear++; year = wrapYear; }
    prevWeek = week;
    out.set(x.ci, hkIsoWeekStart(year, week));
  }
  return out;
}
const HK_LATE = "FFFF0000", HK_MILESTONE = "FFFFFF00";

function hkParsePlanning(cells, report, painted = {}) {
  const rows = hkRows(cells), out = { tracks: {}, macroTasks: [], topics: [] };
  const val = (re) => { for (const list of rows.values()) { const i = list.findIndex((x) => re.test(hkNorm(x.v))); if (i >= 0 && list[i + 1]) return list[i + 1].v; } return null; };
  out.start = hkDate(val(/^date$/));
  out.project = hkText(val(/^projet$/));
  out.team = hkText(val(/^equipe$/));
  out.objective = hkText(val(/^objectif$/));
  let headR = null, cols = {};
  for (const [r, list] of rows) if (list.some((x) => /^ntache/.test(hkNorm(x.v)))) {
    headR = r;
    for (const [k, re] of Object.entries({ n: /^ntache/, name: /^taches$/, who: /^qui$/, delay: /^delai$/, done: /realise/ })) cols[k] = list.find((x) => re.test(hkNorm(x.v)))?.ci;
    break;
  }
  if (headR === null) return out;
  const weeks = hkWeekColumns(rows, headR), paintedRows = new Map();
  for (const [ref, color] of Object.entries(painted || {})) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m || !weeks.has(hkCol(m[1]))) continue;
    const r = Number(m[2]);
    if (!paintedRows.has(r)) paintedRows.set(r, []);
    paintedRows.get(r).push({ ci: hkCol(m[1]), color });
  }
  const span = (r) => {
    const cellsOn = (paintedRows.get(r) || []).filter((x) => !/^theme/.test(x.color)).sort((a, b) => a.ci - b.ci);
    if (!cellsOn.length) return {};
    return { from: weeks.get(cellsOn[0].ci), to: hkAddDays(weeks.get(cellsOn.at(-1).ci), 6), late: cellsOn.some((x) => x.color === HK_LATE), milestone: cellsOn.some((x) => x.color === HK_MILESTONE) };
  };
  let group = null;
  for (const [r, list] of rows) {
    if (r <= headR) continue;
    const get = (k) => (cols[k] ? list.find((x) => x.ci === cols[k])?.v : null);
    const n = get("n"), name = hkText(get("name"));
    if (n === null || n === undefined || n === "") {
      if (/^les aspects/i.test(name)) group = "topics";
      else if (group === "topics" && name && !/^indicateurs$/i.test(name)) out.topics.push(name);
      continue;
    }
    const num = Number(String(n).replace(",", "."));
    if (!Number.isFinite(num)) { group = null; continue; }
    if (Number.isInteger(num)) {
      const id = hkSiteId(name);
      group = id ? { site: id } : /pilotage|macro|calendrier/i.test(name) ? { macro: true } : null;
      if (id) out.tracks[id] ||= [];
      continue;
    }
    if (!name || !group || group === "topics") continue;
    const ratio = Number(get("done")), status = ratio >= 1 ? "done" : ratio > 0 ? "doing" : "todo";
    const step = { name, who: hkText(get("who")), duration: hkText(get("delay")), status, ...span(r) };
    if (group.site) out.tracks[group.site].push(step);
    else if (group.macro) out.macroTasks.push(step);
  }
  const named = Object.entries(out.tracks).filter(([, steps]) => steps.length).length;
  if (!named) report.warnings.push("Planning : aucun parcours de site détaillé reconnu.");
  return out;
}

// Classeur → plan Hoshin. Le rapport liste ce qui a été trouvé et ce qui a été ignoré.
function hkFromWorkbook(sheets, fileName = "", colors = {}) {
  const report = { found: [], warnings: [] }, plan = { source: { file: fileName, imported_at: now(), by: osActor() } };
  const prio = hkFindSheet(sheets, /prio/) || Object.values(sheets || {}).find((c) => Object.values(c).some((v) => hkNorm(v) === "poids"));
  plan.matrix = prio ? hkParseMatrix(prio, report) : null;
  if (plan.matrix) report.found.push(`Matrice de priorité : ${Object.keys(plan.matrix.scores).length} entités, ${plan.matrix.criteria.length} critères pondérés${plan.matrix.date ? `, arbitrée le ${shortDate(plan.matrix.date)}` : ""}`);
  else report.warnings.push("Aucune matrice de priorité reconnue (colonnes « poids » et « TOTAL »).");
  const dep = hkFindSheet(sheets, /phase/);
  Object.assign(plan, dep ? hkParseDeployment(dep) : { phases: [], governance: [], milestones: [], risks: [] });
  if (plan.phases.length) report.found.push(`${plan.phases.length} phases, ${plan.milestones.length} jalons de décision`);
  if (plan.governance.length || plan.risks.length) report.found.push(`${plan.governance.length} instances de gouvernance, ${plan.risks.length} risques et parades`);
  const macro = hkFindSheet(sheets, /macro/);
  plan.macroSteps = macro ? hkParseMacro(macro) : [];
  if (plan.macroSteps.length) report.found.push(`${plan.macroSteps.length} macro-étapes de suivi de production`);
  const planningName = Object.keys(sheets || {}).find((n) => /planning/.test(hkNorm(n))), planning = planningName ? sheets[planningName] : null;
  Object.assign(plan, planning ? hkParsePlanning(planning, report, colors?.[planningName] || {}) : { tracks: {}, macroTasks: [], topics: [] });
  const dated = Object.values(plan.tracks).flat().concat(plan.macroTasks).filter((x) => x.from).length;
  if (dated) report.found.push(`${dated} tâches datées dans le planning (Gantt)`);
  const tracked = Object.entries(plan.tracks).filter(([, s]) => s.length);
  if (tracked.length) report.found.push(`Parcours détaillés : ${tracked.map(([id]) => getSiteName(id)).join(", ")}`);
  plan.title = plan.project || "Déploiement de l’amélioration continue";
  plan.waves = {};
  plan.sequoia = {};
  return { plan, report };
}

// Une nouvelle importation garde ce qui a été suivi dans l’appli : statuts, vagues,
// étapes SEQUOIA atteintes et jalons franchis.
function hkMerge(next, prev) {
  if (!prev) return next;
  next.waves = { ...(prev.waves || {}), ...(next.waves || {}) };
  next.sequoia = { ...(prev.sequoia || {}), ...(next.sequoia || {}) };
  for (const [site, steps] of Object.entries(next.tracks || {})) for (const s of steps) {
    const old = (prev.tracks?.[site] || []).find((o) => hkNorm(o.name) === hkNorm(s.name));
    if (old && s.status === "todo") s.status = old.status;
  }
  for (const m of next.milestones || []) m.done = !!(prev.milestones || []).find((o) => hkNorm(o.name) === hkNorm(m.name))?.done;
  return next;
}

/* ---------- Calculs ---------- */

function hkPlan() {
  return data.hoshinPlan && typeof data.hoshinPlan === "object" ? data.hoshinPlan : null;
}
function hkTotal(m, siteId) {
  const s = m?.scores?.[siteId];
  if (!s) return null;
  return m.criteria.reduce((n, c) => n + (Number(s[c.id]) || 0) * (Number(c.weight) || 1), 0);
}
function hkRanking(m) {
  if (!m) return [];
  return Object.keys(m.scores).filter((id) => OPERATIONAL_SITES.some((s) => s.id === id)).map((id) => ({ id, total: hkTotal(m, id) })).sort((a, b) => b.total - a.total || getSiteName(a.id).localeCompare(getSiteName(b.id), "fr")).map((x, i) => ({ ...x, rank: i + 1 }));
}
function hkAddMonths(iso, months) {
  const d = new Date(iso + "T00:00:00Z"), whole = Math.floor(months), days = Math.round((months - whole) * 30);
  d.setUTCMonth(d.getUTCMonth() + whole);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function hkTimeline(plan) {
  const start = plan?.start || plan?.phases?.length && today();
  let at = start;
  const phases = (plan?.phases || []).map((p) => {
    const from = at, to = Number.isFinite(p.months) && p.months > 0 ? hkAddMonths(from, p.months) : from;
    at = to;
    return { ...p, from, to };
  });
  const end = at, now = today(), current = phases.findIndex((p) => p.from <= now && now < p.to);
  return { start, end, phases, current, total: phases.reduce((n, p) => n + (p.months || 0), 0) };
}
function hkCanPlan() {
  return osIsAdmin() && !role().readonly;
}
function hkCanSite(siteId) {
  return !role().readonly && osWritable(siteId);
}
function hkVisibleSites() {
  return OPERATIONAL_SITES.filter((s) => state.site === "group" || s.id === state.site);
}

/* ---------- Affichage ---------- */

function hkCap(plan, tl) {
  const end = (plan?.milestones || []).filter((m) => m.date).map((m) => m.date).sort().at(-1) || (tl.phases.length ? tl.end : null);
  const cur = tl.current >= 0 ? tl.phases[tl.current] : null;
  const month = cur ? Math.max(1, Math.round((Date.parse(today()) - Date.parse(tl.start)) / (30.44 * 86400000)) + 1) : null;
  return `<section class="hk-cap" aria-label="Cap"><div><span class="hk-cap-k">Cap</span><b>D’artisan industriel à industriel artisan</b></div>${plan?.objective || plan?.title ? `<div><span class="hk-cap-k">Programme</span><b>${esc(plan.title)}${plan.objective && plan.objective !== plan.title ? ` · ${esc(plan.objective)}` : ""}</b>${plan.team ? `<small>${esc(plan.team)}</small>` : ""}</div>` : ""}${cur ? `<div><span class="hk-cap-k">Aujourd’hui</span><b>${esc(cur.name)}</b><small>Mois ${month} sur ${osNum(tl.total)}</small></div>` : ""}${end ? `<div><span class="hk-cap-k">Fin visée</span><b>${shortDate(end)}</b></div>` : ""}</section>`;
}

function hkMatrixView(plan) {
  const m = plan?.matrix, group = state.site === "group";
  if (!m) return `<section class="panel section hk-prio"><h2>Priorités des sites</h2>${empty("Aucune matrice de priorité. Importez le fichier de déploiement ou créez la matrice.")}${hkCanPlan() ? `<div class="row-actions"><button type="button" class="btn secondary" data-hk-new-matrix>Créer la matrice</button></div>` : ""}</section>`;
  const ranking = hkRanking(m), top = new Set((m.top || []).map((t) => t.site_id)), max = Math.max(1, ...ranking.map((r) => r.total)), maxPossible = m.criteria.reduce((n, c) => n + 5 * (c.weight || 1), 0);
  const rows = (group ? ranking : ranking.filter((r) => r.id === state.site));
  const head = `<div class="hk-row hk-head" role="row"><span role="columnheader" class="hk-corner">Rang · entité</span>${m.criteria.map((c, i) => `<span role="columnheader" class="hk-col" title="${esc(c.name)} · poids ${c.weight}"><b>${i + 1}</b><em>${esc(c.name)}</em><small>×${c.weight}</small></span>`).join("")}<span role="columnheader" class="hk-col hk-col-total"><b>Total</b><small>/${maxPossible}</small></span></div>`;
  const body = rows.map((r) => {
    const wave = plan.waves?.[r.id] || "", waveLabel = HK_WAVES.find((w) => w[0] === wave)?.[1];
    return `<div class="hk-row ${top.has(r.id) ? "hk-top" : ""}" role="row"><span role="rowheader" class="hk-site"><b class="hk-rank">${r.rank}</b><span>${esc(getSiteName(r.id))}${top.has(r.id) ? ' <em class="hk-badge">TOP</em>' : ""}${wave ? `<small class="hk-wave hk-wave-${wave}">${esc(waveLabel)}</small>` : ""}</span></span>${m.criteria.map((c, i) => { const v = m.scores[r.id]?.[c.id]; return `<span role="cell" class="hk-score hk-s${v ? Math.round(v) : 0}" aria-label="${esc(getSiteName(r.id))} · ${esc(c.name)} : ${v ?? "non noté"}">${v ?? "—"}</span>`; }).join("")}<span role="cell" class="hk-total"><b>${osNum(r.total)}</b><i style="width:${Math.round((r.total / max) * 100)}%"></i></span></div>`;
  }).join("");
  const topList = (m.top || []).length ? `<p class="hk-toplist"><b>TOP ${m.top.length} retenu :</b> ${m.top.map((t) => `${esc(getSiteName(t.site_id))}${t.note ? ` <small>(${esc(t.note)})</small>` : ""}`).join(" · ")}</p>` : "";
  const mismatch = Object.entries(m.fileTotals || {}).filter(([id, t]) => Math.abs(t - hkTotal(m, id)) > 0.01);
  const legend = `<ol class="hk-legend">${m.criteria.map((c, i) => `<li><b>${i + 1}</b>${esc(c.name)} <small>×${c.weight}</small></li>`).join("")}</ol>`;
  return `<section class="panel section hk-prio" aria-labelledby="hkPrioTitle"><div class="section-title"><div><h2 id="hkPrioTitle">Priorités des sites</h2><p class="hint">${m.date ? `Matrice arbitrée le ${shortDate(m.date)} · ` : ""}chaque critère noté de 1 (faible) à 5 (fort), pondéré de 1 à 3 ; total = somme des notes × poids.${m.scale ? ` Fichier : ${esc(m.scale)}.` : ""}</p></div>${hkCanPlan() ? `<div class="row-actions"><button type="button" class="btn secondary small" data-hk-edit-matrix>Modifier</button><button type="button" class="btn secondary small" data-hk-waves>Vagues</button></div>` : ""}</div>${legend}<div class="hk-matrix-wrap"><div class="hk-matrix" role="table" aria-label="Matrice de priorité des sites" style="--hk-cols:${m.criteria.length}">${head}${body}</div></div>${group ? topList : ""}${mismatch.length ? `<p class="hint">Total recalculé différent du fichier pour ${mismatch.map(([id, t]) => `${esc(getSiteName(id))} (fichier ${osNum(t)})`).join(", ")} : vérifiez les notes.</p>` : ""}${!group ? `<p class="hint">Rang de votre site sur ${ranking.length} entités. Le détail des autres sites reste au niveau Groupe.</p>` : ""}</section>`;
}

function hkPlanView(plan, tl) {
  if (!tl.phases.length) return "";
  const startMs = Date.parse(tl.start), span = Math.max(1, Date.parse(tl.end) - startMs), pos = (iso) => Math.max(0, Math.min(100, ((Date.parse(iso) - startMs) / span) * 100));
  const nowPct = today() >= tl.start && today() <= tl.end ? pos(today()) : null;
  const bars = tl.phases.map((p, i) => `<div class="hk-phase-bar ${i === tl.current ? "now" : p.to <= today() ? "past" : ""}" style="left:${pos(p.from)}%;width:${Math.max(2, pos(p.to) - pos(p.from))}%" title="${esc(p.name)} · ${shortDate(p.from)} → ${shortDate(p.to)}"><span>${esc(p.name.replace(/^\d+\.\s*/, ""))}</span></div>`).join("");
  const marks = (plan.milestones || []).filter((m) => m.date).map((m) => `<span class="hk-mark ${m.done ? "done" : m.date < today() ? "late" : ""}" style="left:${pos(m.date)}%" title="${esc(m.name)} · ${shortDate(m.date)}">◆</span>`).join("");
  const years = [];
  for (let y = Number(tl.start.slice(0, 4)); y <= Number(tl.end.slice(0, 4)); y++) { const d = `${y}-01-01`; if (d > tl.start && d < tl.end) years.push(`<span class="hk-year" style="left:${pos(d)}%">${y}</span>`); }
  const cards = tl.phases.map((p, i) => `<article class="hk-phase ${i === tl.current ? "now" : p.to <= today() ? "past" : ""}"><header><b>${esc(p.name)}</b>${i === tl.current ? pill("En cours", "progress") : p.to <= today() ? pill("Passée", "neutral") : ""}</header><small>${shortDate(p.from)} → ${shortDate(p.to)}${p.duration ? ` · ${esc(p.duration)}` : ""}</small>${p.actions ? `<p>${esc(p.actions)}</p>` : ""}${p.deliverables ? `<p class="hk-deliv"><b>Livrable :</b> ${esc(p.deliverables)}</p>` : ""}${p.notes ? `<p class="hk-notes">${esc(p.notes)}</p>` : ""}</article>`).join("");
  const miles = (plan.milestones || []).map((m, i) => `<li class="${m.done ? "done" : ""}"><div><b>${esc(m.name)}</b><small>${m.date ? shortDate(m.date) : ""}${m.dateLabel ? ` · ${esc(m.dateLabel)}` : ""}</small></div><p>${esc(m.criteria)}</p>${hkCanPlan() ? `<button type="button" class="in-chip ${m.done ? "active" : ""}" data-hk-milestone="${i}" aria-pressed="${!!m.done}">${m.done ? "Franchi ✓" : "Marquer franchi"}</button>` : m.done ? pill("Franchi", "done") : m.date && m.date < today() ? pill("Échéance passée", "open") : pill("À venir", "neutral")}</li>`).join("");
  return `<section class="panel section hk-plan" aria-labelledby="hkPlanTitle"><h2 id="hkPlanTitle">Plan de déploiement</h2><div class="hk-timeline" role="img" aria-label="Frise des phases du ${shortDate(tl.start)} au ${shortDate(tl.end)}"><div class="hk-track">${bars}${marks}${nowPct !== null ? `<span class="hk-now" style="left:${nowPct}%" title="Aujourd’hui · ${shortDate(today())}"></span>` : ""}</div><div class="hk-scale"><span>${shortDate(tl.start)}</span>${years.join("")}<span>${shortDate(tl.end)}</span></div></div><div class="hk-phases">${cards}</div>${miles ? `<h3>Jalons de décision</h3><ul class="hk-miles">${miles}</ul>` : ""}${plan.indicators ? `<p class="hk-ind"><b>Indicateurs suivis :</b> ${esc(plan.indicators)} <button type="button" class="btn ghost small" data-hk-nav="pilotage">Voir les indicateurs</button></p>` : ""}</section>`;
}

function hkSitesView(plan) {
  if (!plan) return "";
  // Même ordre que la matrice de priorité, quand elle existe.
  const rank = hkRanking(plan.matrix).map((r) => r.id), macro = plan.macroSteps || [];
  const sites = hkVisibleSites().sort((a, b) => (rank.indexOf(a.id) + 1 || 99) - (rank.indexOf(b.id) + 1 || 99));
  const rows = sites.map((s) => {
    const steps = plan.tracks?.[s.id] || [], wave = plan.waves?.[s.id] || "", reached = Number(plan.sequoia?.[s.id] || 0);
    const chips = steps.length ? steps.map((st, i) => `<button type="button" class="hk-step ${HK_STATUS[st.status]?.[1] || "hk-todo"}" ${hkCanSite(s.id) ? `data-hk-step="${esc(JSON.stringify({ site: s.id, i }))}"` : "disabled"} aria-label="${esc(st.name)} : ${HK_STATUS[st.status]?.[0] || "À faire"}"><i aria-hidden="true">${st.status === "done" ? "✓" : st.status === "doing" ? "●" : "○"}</i>${esc(st.name)}</button>`).join("") : `<span class="hk-none">Parcours à définir dans le planning</span>`;
    const done = steps.filter((x) => x.status === "done").length;
    const seq = macro.length ? `<div class="hk-seq" role="group" aria-label="Suivi de production ${esc(s.name)} : étape ${reached} sur ${macro.length}">${macro.map((m, i) => `<button type="button" class="hk-seq-dot ${i < reached ? "on" : ""}" ${hkCanSite(s.id) ? `data-hk-seq="${esc(JSON.stringify({ site: s.id, n: i + 1 === reached ? i : i + 1 }))}"` : "disabled"} title="${esc(m.title)}" aria-label="${esc(m.title)}${i < reached ? " : atteinte" : ""}">${i + 1}</button>`).join("")}</div>` : "";
    return `<li class="hk-site-row"><div class="hk-site-name"><b>${esc(s.name)}</b><small>${wave ? esc(HK_WAVES.find((w) => w[0] === wave)?.[1]) + " · " : ""}${steps.length ? `${done}/${steps.length} étapes faites` : "—"}</small></div><div class="hk-steps">${chips}</div>${seq}</li>`;
  }).join("");
  const macroLegend = macro.length ? `<ol class="hk-macro">${macro.map((m, i) => `<li><b>${i + 1}</b><span>${esc(m.title)}${m.description ? `<small>${esc(m.description.replace(/\n/g, " · "))}</small>` : ""}</span></li>`).join("")}</ol>` : "";
  return `<section class="panel section hk-sites" aria-labelledby="hkSitesTitle"><h2 id="hkSitesTitle">Avancement par site</h2><p class="hint">Dans l’ordre des priorités. ${hkCanSite(state.site === "group" ? OPERATIONAL_SITES[0]?.id : state.site) ? "Touchez une étape pour la faire avancer (à faire → en cours → fait)." : "Étapes du planning de chaque site."}${macro.length ? " Pastilles : suivi de production, de la découverte au suivi automatique." : ""}</p>${macroLegend}<ul class="hk-site-list">${rows}</ul></section>`;
}

function hkGovView(plan) {
  if (!plan || (!plan.governance?.length && !plan.risks?.length && !plan.topics?.length)) return "";
  const gov = plan.governance?.length ? `<div><h3>Gouvernance</h3><ul class="hk-gov">${plan.governance.map((g) => `<li><b>${esc(g.instance)}</b><span class="hk-rhythm">${esc(g.rhythm)}</span><small>${esc(g.composition)}</small><p>${esc(g.role)}</p></li>`).join("")}</ul></div>` : "";
  const risks = plan.risks?.length ? `<div><h3>Risques et parades</h3><ul class="hk-risks">${plan.risks.map((r) => `<li><b>${esc(r.risk)}</b>${r.value ? ` <small>${esc(r.value)}</small>` : ""}<p>→ ${esc(r.mitigation)}</p></li>`).join("")}</ul></div>` : "";
  const topics = plan.topics?.length ? `<div><h3>Aspects à aborder</h3><ul class="hk-topics">${plan.topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";
  return `<section class="panel section hk-gov-panel"><div class="hk-gov-grid">${gov}${risks}${topics}</div></section>`;
}

const hkHoshinBase = renderOSHoshin;
renderOSHoshin = function () {
  const plan = hkPlan(), tl = hkTimeline(plan);
  const tools = hkCanPlan() ? `<div class="row-actions"><label class="btn ${plan ? "secondary" : ""} hk-import">Importer le fichier de déploiement (.xlsx)<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-hk-import hidden></label>${osButton("Créer un objectif", "new", { key: "objectives" })}</div>` : "";
  const synced = osActive(data.objectives).filter((o) => o.plan_key).length;
  const objTools = plan && hkCanPlan() ? `<div class="hk-obj-sync"><p>${synced ? `${synced} objectifs suivent le plan (cap, jalons, parcours de site).` : "Le plan peut devenir la cascade d’objectifs : le cap en axe, un objectif Groupe par jalon, un objectif par site."}</p><button type="button" class="btn ${synced ? "secondary" : ""}" data-hk-sync-objectives>${synced ? "Mettre à jour les objectifs depuis le plan" : "Créer les objectifs à partir du plan"}</button>${role().nav.includes("roadmap") ? '<button type="button" class="btn ghost" data-hk-roadmap>Voir la roadmap</button>' : ""}</div>` : "";
  const intro = plan ? `<p class="hk-source">Plan issu de « ${esc(plan.source?.file || "saisie dans l’appli")} »${plan.source?.imported_at ? `, importé le ${shortDate(plan.source.imported_at)}` : ""}. Il reste sur cet appareil, comme toutes vos données.</p>` : `<div class="hk-empty"><b>Le Hoshin part des priorités des sites.</b><p>Importez le fichier qui a servi à les fixer (« Déploiement AC ») : matrice de priorité pondérée, phases, jalons, gouvernance, risques, macro-étapes et planning par site. Le fichier est lu sur cet appareil ; son contenu n’est ni envoyé ni publié.</p></div>`;
  const base = hkHoshinBase().replace(/^[\s\S]*?(<section class="os-hoshin-tree">)/, "$1");
  return `${pageHead("Voir · Hoshin Kanri", "Cap, priorités et plan", "Le cap du Groupe, les priorités des sites et le plan de déploiement, puis la déclinaison en objectifs.", tools)}${hkCap(plan, tl)}${intro}${hkMatrixView(plan)}${hkPlanView(plan, tl)}${hkSitesView(plan)}${hkGovView(plan)}<section class="section hk-objectives"><h2>Déclinaison des objectifs</h2>${objTools}${base}</section>`;
};

/* ---------- Objectifs issus du plan ---------- */

// Le plan devient la cascade Hoshin : le cap (axe), un objectif Groupe par jalon de
// décision, un objectif Site par parcours. Clé stable : un nouvel appel met à jour,
// sans doublon ; les objectifs saisis à la main ne sont jamais touchés.
function hkObjectivesFromPlan(plan) {
  const tl = hkTimeline(plan), miles = (plan?.milestones || []).filter((m) => m.date).sort((a, b) => a.date.localeCompare(b.date));
  const end = miles.at(-1)?.date || (tl.phases.length ? tl.end : today()), out = [];
  out.push({ key: "cap", level: "Axe stratégique", site_id: "group", title: "D’artisan industriel à industriel artisan", description: [plan?.title, plan?.objective].filter(Boolean).join(" · "), due_date: end, parent: null });
  for (const m of miles) out.push({ key: `jalon:${hkNorm(m.name)}`, level: "Groupe", site_id: "group", title: m.name, description: m.criteria, due_date: m.date, parent: "cap" });
  for (const site of OPERATIONAL_SITES) {
    const steps = plan?.tracks?.[site.id] || [];
    if (!steps.length) continue;
    const last = steps.map((x) => x.to).filter(Boolean).sort().at(-1) || null, wave = plan.waves?.[site.id];
    let parent = wave === "pilot" ? miles[0] : wave === "wave1" ? miles[1] || miles.at(-1) : wave === "wave2" ? miles.at(-1) : null;
    parent ||= miles.find((m) => last && m.date >= last) || miles.at(-1) || null;
    out.push({ key: `site:${site.id}`, level: "Site", site_id: site.id, title: `${site.name} : ${steps[0].name} → ${steps.at(-1).name}`, description: `Parcours du plan de déploiement : ${steps.map((x) => x.name).join(", ")}.`, due_date: last || parent?.date || end, parent: parent ? `jalon:${hkNorm(parent.name)}` : "cap" });
  }
  return out;
}
function hkSyncObjectives() {
  const plan = hkPlan();
  if (!plan || !hkCanPlan()) return;
  const items = hkObjectivesFromPlan(plan), owner = plan.team || "Responsable Lean Groupe";
  let created = 0, updated = 0;
  const ok = commitData(() => {
    const byKey = new Map(data.objectives.filter((o) => o.plan_key && !o.archived_at).map((o) => [o.plan_key, o])), ids = {};
    for (const it of items) {
      let o = byKey.get(it.key);
      const row = { title: it.title, site_id: it.site_id, level: it.level, year: Number(it.due_date.slice(0, 4)), due_date: it.due_date, description: it.description, plan_key: it.key, source: "Plan de déploiement" };
      if (o) { Object.assign(o, row, { updated_at: now() }); updated++; }
      else { o = { id: uid("OBJ"), ...row, owner, status: "En cours", created_at: now() }; data.objectives.push(o); created++; }
      ids[it.key] = o.id;
    }
    for (const it of items) data.objectives.find((x) => x.id === ids[it.key]).parent_id = it.parent ? ids[it.parent] : null;
    data.activity.push({ id: uid("EVT"), at: now(), actor: osActor(), event: "Objectifs Hoshin alignés sur le plan", record_id: null, fields: ["objectives"], site_id: "group" });
  });
  if (!ok) return;
  render();
  toast(`${created} objectif${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}, ${updated} mis à jour depuis le plan.`);
}

/* ---------- Roadmap : le même plan, dans le temps ---------- */

function hkMonthStart(iso) {
  return iso.slice(0, 8) + "01";
}
function hkWindow(plan, key) {
  const tl = hkTimeline(plan), start = tl.start || today();
  // « Tout le plan » couvre les phases, les jalons et les étapes datées.
  const end = [tl.phases.length ? tl.end : hkAddMonths(start, 12), ...(plan?.milestones || []).map((m) => m.date), ...Object.values(plan?.tracks || {}).flat().map((x) => x.to)].filter(Boolean).sort().at(-1);
  if (key === "all") return { from: start, to: end };
  const from = [start, hkAddMonths(hkMonthStart(today()), -1)].sort().at(-1);
  return { from, to: hkAddMonths(from, Number(key) || 6) };
}
function hkGantt(plan) {
  const key = ["6", "12", "all"].includes(state.rmWindow) ? state.rmWindow : "6", win = hkWindow(plan, key), from = Date.parse(win.from), span = Math.max(1, Date.parse(win.to) - from);
  const x = (iso) => ((Date.parse(iso) - from) / span) * 100;
  const bar = (a, b) => {
    if (!a || !b || b < win.from || a > win.to) return null;
    const l = Math.max(0, x(a)), r = Math.min(100, x(hkAddDays(b, 1)));
    return `left:${l.toFixed(2)}%;width:${Math.max(0.8, r - l).toFixed(2)}%`;
  };
  const months = [];
  for (let d = hkMonthStart(win.from); d <= win.to; d = hkAddMonths(d, 1)) if (d >= win.from || d === hkMonthStart(win.from)) months.push(d);
  const monthLabel = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "") + (d.slice(5, 7) === "01" || d === months[0] ? ` ${d.slice(0, 4)}` : "");
  const grid = months.map((d) => `<span class="rm-month" style="left:${Math.max(0, x(d)).toFixed(2)}%">${esc(monthLabel(d))}</span>`).join("");
  const lines = months.map((d) => (x(d) > 0 ? `<i class="rm-vline" style="left:${x(d).toFixed(2)}%"></i>` : "")).join("");
  const nowLine = today() >= win.from && today() <= win.to ? `<i class="rm-now" style="left:${x(today()).toFixed(2)}%" title="Aujourd’hui · ${shortDate(today())}"></i>` : "";
  const miles = (plan.milestones || []).filter((m) => m.date && m.date >= win.from && m.date <= win.to).map((m) => `<i class="rm-mile ${m.done ? "done" : ""}" style="left:${x(m.date).toFixed(2)}%" title="${esc(m.name)} · ${shortDate(m.date)}"></i>`).join("");
  const overlay = `<div class="rm-overlay" aria-hidden="true">${lines}${miles}${nowLine}</div>`;
  const row = (label, bars, cls = "") => `<div class="rm-row ${cls}"><div class="rm-label">${label}</div><div class="rm-lane">${bars}</div></div>`;
  const tl = hkTimeline(plan);
  const phaseRow = row("<b>Phases</b>", tl.phases.map((p, i) => { const st = bar(p.from, hkAddDays(p.to, -1)); return st ? `<span class="rm-bar rm-phase ${i === tl.current ? "now" : ""}" style="${st}" title="${esc(p.name)} · ${shortDate(p.from)} → ${shortDate(p.to)}">${esc(p.name.replace(/^\d+\.\s*/, ""))}</span>` : ""; }).join(""), "rm-program");
  const mileRow = (plan.milestones || []).some((m) => m.date && m.date >= win.from && m.date <= win.to) ? row("<b>Jalons</b>", (plan.milestones || []).filter((m) => m.date && m.date >= win.from && m.date <= win.to).map((m) => `<span class="rm-diamond ${m.done ? "done" : m.date < today() ? "late" : ""}" style="left:${x(m.date).toFixed(2)}%" title="${esc(m.name)} · ${shortDate(m.date)}">◆<em>${esc(m.name)}</em></span>`).join(""), "rm-miles") : "";
  const stepBar = (siteId, st, i) => {
    const css = bar(st.from, st.to);
    if (!css) return "";
    const can = siteId && hkCanSite(siteId);
    return `<button type="button" class="rm-bar rm-step ${HK_STATUS[st.status]?.[1] || "hk-todo"} ${st.late ? "late" : ""}" style="${css}" ${can ? `data-hk-step="${esc(JSON.stringify({ site: siteId, i }))}"` : "disabled"} title="${esc(st.name)} · ${shortDate(st.from)} → ${shortDate(st.to)} · ${HK_STATUS[st.status]?.[0] || "À faire"}${st.late ? " · en retard" : ""}"><span>${esc(st.name)}</span></button>`;
  };
  const macro = (plan.macroTasks || []).filter((t) => t.from);
  const macroRows = macro.map((t) => row(`<span>${esc(t.name)}</span>${t.who ? `<small>${esc(t.who)}</small>` : ""}`, stepBar(null, t, 0))).join("");
  const rank = hkRanking(plan.matrix).map((r) => r.id);
  const sites = hkVisibleSites().sort((a, b) => (rank.indexOf(a.id) + 1 || 99) - (rank.indexOf(b.id) + 1 || 99));
  const siteRows = sites.map((s) => {
    const steps = plan.tracks?.[s.id] || [], wave = plan.waves?.[s.id];
    const head = row(`<b>${esc(s.name)}</b><small>${wave ? esc(HK_WAVES.find((w) => w[0] === wave)?.[1]) + " · " : ""}${steps.length ? `${steps.filter((x) => x.status === "done").length}/${steps.length} faites` : "parcours à définir"}</small>`, steps.filter((st) => st.from).length ? "" : `<span class="rm-empty">${steps.length ? "Étapes non datées dans le planning" : "Parcours à définir dans le planning"}</span>`, "rm-site");
    return head + steps.map((st, i) => (st.from ? row(`<span>${esc(st.name)}</span>`, stepBar(s.id, st, i)) : "")).join("");
  }).join("");
  const chips = `<div class="in-chips in-chips-small" role="group" aria-label="Période affichée">${[["6", "6 mois"], ["12", "12 mois"], ["all", "Tout le plan"]].map(([k, l]) => `<button type="button" class="in-chip ${k === key ? "active" : ""}" data-rm-window="${k}" aria-pressed="${k === key}">${l}</button>`).join("")}</div>`;
  return `<section class="panel section rm-gantt-panel" aria-labelledby="rmGanttTitle"><div class="section-title"><div><h2 id="rmGanttTitle">Calendrier du déploiement</h2><p class="hint">${shortDate(win.from)} → ${shortDate(win.to)} · touchez une étape pour la faire avancer ; elle avance aussi dans le Hoshin.</p></div>${chips}</div><div class="rm-gantt-wrap"><div class="rm-gantt"><div class="rm-row rm-head"><div class="rm-label"></div><div class="rm-lane">${grid}</div></div><div class="rm-body">${overlay}${phaseRow}${mileRow}${macroRows}${siteRows}</div></div></div><p class="rm-key"><span class="rm-k hk-todo"></span>À faire <span class="rm-k hk-doing"></span>En cours <span class="rm-k hk-done"></span>Fait <span class="rm-k late"></span>En retard dans le fichier <span class="rm-k-mile">◆</span>Jalon <span class="rm-k-now"></span>Aujourd’hui</p></section>`;
}

const hkRoadmapBase = renderRoadmap;
renderRoadmap = function () {
  const plan = hkPlan(), tl = hkTimeline(plan);
  const base = hkRoadmapBase(), board = /<div class="roadmap-board[\s\S]*$/.exec(base)?.[0] || "";
  const add = osManager() && !role().readonly ? '<button class="btn secondary" data-new-roadmap>+ Priorité</button>' : "";
  const link = role().nav.includes("hoshin") || role().nav.includes("pilotage") ? '<button type="button" class="btn ghost small" data-rm-hoshin>Priorités et objectifs dans le Hoshin</button>' : "";
  return `${pageHead("Voir · Roadmap", "Roadmap de déploiement", "Le même plan que le Hoshin, dans le temps : phases, jalons et étapes de chaque site.", add)}${hkCap(plan, tl)}${plan ? `<p class="hk-source">Une seule source : le plan importé dans le Hoshin (« ${esc(plan.source?.file || "saisie dans l’appli")} »). ${link}</p>${hkGantt(plan)}` : `<div class="hk-empty"><b>Pas encore de plan de déploiement.</b><p>Importez le fichier de déploiement dans Voir › Hoshin : la roadmap affichera ici les mêmes phases, jalons et étapes par site.</p>${link}</div>`}<h2 class="section rm-prio-title">Priorités de la roadmap</h2><p class="hint">Résultat attendu, propriétaire, indicateur et date pour chaque priorité ; à rattacher aux phases du plan.</p>${board.replace(/^<div class="roadmap-board section">/, '<div class="roadmap-board">')}`;
};

/* ---------- Actions ---------- */

async function hkImport(file) {
  if (!hkCanPlan()) return toast("Import réservé au Responsable Lean Groupe.");
  let parsed;
  try { const book = await hkReadXlsx(file); parsed = hkFromWorkbook(book.sheets, file.name, book.colors); }
  catch (e) { return toast(e.message || "Fichier illisible."); }
  const { plan, report } = parsed;
  if (!plan.matrix && !plan.phases.length) return toast("Ni matrice de priorité ni phases reconnues dans ce fichier.");
  modal("Importer le plan de déploiement", `<div class="hk-report"><p>Lu dans « ${esc(file.name)} » :</p><ul>${report.found.map((f) => `<li>✓ ${esc(f)}</li>`).join("")}</ul>${report.warnings.length ? `<p class="hint">À vérifier :</p><ul class="hk-warn">${report.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}<p class="hint">${hkPlan() ? "Le plan actuel sera remplacé ; les étapes déjà suivies, les vagues et les jalons franchis sont conservés." : "Le plan sera enregistré sur cet appareil."} Le fichier n’est ni envoyé ni publié.</p><div class="form-actions"><button type="button" class="btn" id="hkConfirmImport">Enregistrer le plan</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></div>`);
  $("hkConfirmImport").onclick = () => {
    if (!commitData(() => {
      data.hoshinPlan = hkMerge(plan, hkPlan());
      data.activity.push({ id: uid("EVT"), at: now(), actor: osActor(), event: "Plan Hoshin importé", record_id: null, fields: ["hoshinPlan"], site_id: "group" });
    })) return;
    closeModal();
    render();
    toast("Plan de déploiement enregistré.");
  };
}

function hkMatrixForm(createNew = false) {
  if (!hkCanPlan()) return;
  const current = hkPlan()?.matrix;
  const m = createNew || !current ? { date: today(), criteria: HK_DEFAULT_CRITERIA.map((name, i) => ({ id: `c${i + 1}`, name, weight: 1 })), scores: {}, top: [], fileTotals: {} } : clone(current);
  const sites = OPERATIONAL_SITES;
  modal(createNew || !current ? "Créer la matrice de priorité" : "Modifier la matrice de priorité", `<form id="hkMatrixForm"><p class="hint">Notes de 1 (faible) à 5 (fort), poids de 1 à 3. Laissez vide un critère non noté.</p><label>Date d’arbitrage<input type="date" name="date" value="${esc(m.date || today())}"></label><div class="hk-form-wrap"><table class="hk-form"><thead><tr><th>Critère</th><th>Poids</th>${sites.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${m.criteria.map((c) => `<tr><th><input name="name-${c.id}" value="${esc(c.name)}" required></th><td><input type="number" name="w-${c.id}" min="1" max="3" step="1" value="${c.weight}" required></td>${sites.map((s) => `<td><input type="number" name="s-${s.id}-${c.id}" min="1" max="5" step="1" value="${m.scores[s.id]?.[c.id] ?? ""}" aria-label="${esc(s.name)} · ${esc(c.name)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("hkMatrixForm").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target, next = { ...m, date: f.elements.date.value || today(), scores: {} };
    next.criteria = m.criteria.map((c) => ({ ...c, name: f.elements[`name-${c.id}`].value.trim() || c.name, weight: Math.max(1, Math.min(3, Math.round(Number(f.elements[`w-${c.id}`].value) || 1))) }));
    for (const s of sites) {
      const row = {};
      let any = false;
      for (const c of m.criteria) {
        const raw = f.elements[`s-${s.id}-${c.id}`].value, v = raw === "" ? null : Math.round(Number(raw));
        if (v !== null && (!Number.isFinite(v) || v < 1 || v > 5)) return toast("Les notes vont de 1 à 5.");
        row[c.id] = v;
        if (v !== null) any = true;
      }
      if (any || m.scores[s.id]) next.scores[s.id] = row;
    }
    next.fileTotals = {};
    if (!commitData(() => { data.hoshinPlan ||= { source: { file: "", imported_at: now(), by: osActor() }, phases: [], milestones: [], governance: [], risks: [], macroSteps: [], tracks: {}, macroTasks: [], topics: [], waves: {}, sequoia: {} }; data.hoshinPlan.matrix = next; })) return;
    closeModal();
    render();
  };
}

function hkWavesForm() {
  const plan = hkPlan();
  if (!plan || !hkCanPlan()) return;
  const ranking = hkRanking(plan.matrix), order = ranking.length ? ranking.map((r) => r.id) : OPERATIONAL_SITES.map((s) => s.id);
  modal("Vagues de déploiement", `<form id="hkWavesForm"><p class="hint">Dans l’ordre du classement. Le plan prévoit des sites pilotes, puis des vagues de généralisation.</p><div class="hk-waves-list">${order.map((id) => `<fieldset><legend>${esc(getSiteName(id))}</legend><div class="in-chips">${HK_WAVES.map(([w, label]) => `<label class="in-chip hk-radio"><input type="radio" name="wave-${id}" value="${w}" ${((plan.waves || {})[id] || "") === w ? "checked" : ""}>${label}</label>`).join("")}</div></fieldset>`).join("")}</div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("hkWavesForm").onsubmit = (e) => {
    e.preventDefault();
    const waves = {};
    for (const id of order) { const v = e.target.querySelector(`input[name="wave-${id}"]:checked`)?.value || ""; if (v) waves[id] = v; }
    if (!commitData(() => { data.hoshinPlan.waves = waves; })) return;
    closeModal();
    render();
  };
}

function hkBind(root = document) {
  root.querySelectorAll("[data-hk-import]").forEach((input) => (input.onchange = () => { const f = input.files?.[0]; input.value = ""; if (f) hkImport(f); }));
  root.querySelectorAll("[data-hk-edit-matrix]").forEach((b) => (b.onclick = () => hkMatrixForm(false)));
  root.querySelectorAll("[data-hk-new-matrix]").forEach((b) => (b.onclick = () => hkMatrixForm(true)));
  root.querySelectorAll("[data-hk-waves]").forEach((b) => (b.onclick = () => hkWavesForm()));
  root.querySelectorAll("[data-hk-sync-objectives]").forEach((b) => (b.onclick = () => hkSyncObjectives()));
  root.querySelectorAll("[data-hk-roadmap]").forEach((b) => (b.onclick = () => switchView("roadmap")));
  root.querySelectorAll("[data-rm-hoshin]").forEach((b) => (b.onclick = () => switchView(role().nav.includes("hoshin") ? "hoshin" : "pilotage")));
  root.querySelectorAll("[data-rm-window]").forEach((b) => (b.onclick = () => { state.rmWindow = b.dataset.rmWindow; render(); }));
  root.querySelectorAll("[data-hk-nav]").forEach((b) => (b.onclick = () => { state.pilotageMode = "analysis"; state.osTab = "tower"; switchView(b.dataset.hkNav); }));
  root.querySelectorAll("[data-hk-milestone]").forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.hkMilestone);
    if (!hkCanPlan() || !hkPlan()?.milestones?.[i]) return;
    if (commitData(() => { const m = data.hoshinPlan.milestones[i]; m.done = !m.done; m.done_at = m.done ? today() : null; })) render();
  }));
  root.querySelectorAll("[data-hk-step]").forEach((b) => (b.onclick = () => {
    let a;
    try { a = JSON.parse(b.dataset.hkStep); } catch { return; }
    const step = hkPlan()?.tracks?.[a.site]?.[a.i];
    if (!step || !hkCanSite(a.site)) return;
    if (commitData(() => { const s = data.hoshinPlan.tracks[a.site][a.i]; s.status = s.status === "todo" ? "doing" : s.status === "doing" ? "done" : "todo"; s.updated_at = now(); })) render();
  }));
  root.querySelectorAll("[data-hk-seq]").forEach((b) => (b.onclick = () => {
    let a;
    try { a = JSON.parse(b.dataset.hkSeq); } catch { return; }
    if (!hkPlan() || !hkCanSite(a.site)) return;
    if (commitData(() => { data.hoshinPlan.sequoia ||= {}; data.hoshinPlan.sequoia[a.site] = Math.max(0, Math.min(hkPlan().macroSteps.length, Number(a.n) || 0)); })) render();
  }));
}
const hkOsBindBase = osBind;
osBind = function () { const out = hkOsBindBase.apply(this, arguments); hkBind(document); return out; };
