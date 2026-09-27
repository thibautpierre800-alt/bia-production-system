"use strict";

// The business model is shared by every screen. Relationships refer to records,
// never to copied actions or copied KPI results.
const OS_COLLECTIONS = {
  sites: ["Organisation", "settings"],
  workshops: ["Ateliers", "settings"],
  zones: ["Zones", "settings"],
  users: ["Utilisateurs", "settings"],
  kpis: ["Indicateurs", "pilotage"],
  measures: ["Mesures", "pilotage"],
  signals: ["Observations", "terrain"],
  gembas: ["Gemba", "terrain"],
  actions: ["Actions", "actions"],
  problems: ["Problèmes", "resolution"],
  documents: ["Documents", "documents"],
  audits: ["Audits", "audits"],
  projects: ["Projets", "projects"],
  objectives: ["Objectifs", "hoshin"],
  kaizens: ["Kaizen", "kaizen"],
  practices: ["Bonnes pratiques", "practices"],
  deployments: ["Déploiements", "deployment"],
  gains: ["Gains", "kaizen"],
  maturity: ["Maturité", "maturity"],
  routines: ["Routines", "daily"],
  escalations: ["Escalades", "daily"],
  decisions: ["Décisions", "daily"],
  topics: ["SQCDP", "sqcdp"],
  roadmap: ["Roadmap", "roadmap"],
  toolRuns: ["Démarches", "tools"],
  auditTemplates: ["Questionnaires", "settings"],
  connectors: ["Connecteurs", "connectors"],
  comments: ["Commentaires", "activity"],
};
const OS_PREFIX = {
  sites: "SITE",
  workshops: "ATL",
  zones: "ZONE",
  users: "USR",
  kpis: "KPI",
  measures: "MES",
  objectives: "OBJ",
  kaizens: "KAI",
  deployments: "DEP",
  gains: "GAIN",
  maturity: "MAT",
  routines: "RIT",
  escalations: "ESC",
  auditTemplates: "QST",
  connectors: "CON",
  comments: "COM",
  projects: "CH",
  practices: "BP",
};
const OS_KAIZEN_STATES = [
  "Idée",
  "Analyse",
  "Validation",
  "Mise en œuvre",
  "Mesure",
  "Gain validé",
  "Standardisation",
  "Bonne pratique",
  "Déploiement",
];
const OS_DEPLOY_STATES = [
  "Candidate",
  "Test",
  "Validée sur autre site",
  "Déployée",
  "Non applicable",
];
const OS_DEFAULT_KPIS = [
  {
    id: "KPI-trs",
    code: "trs",
    name: "TRS",
    axis: "C",
    unit: "%",
    direction: "high",
    target: 85,
    green: 85,
    orange: 75,
    red: 0,
    definition:
      "Temps utile / temps requis × 100. Valider les conventions du site.",
    formula: "disponibilité × performance × qualité",
    frequency: "Quotidien",
  },
  {
    id: "KPI-scrap",
    code: "scrap",
    name: "Rebut",
    axis: "Q",
    unit: "%",
    direction: "low",
    target: 3,
    green: 3,
    orange: 4,
    red: 100,
    definition:
      "Quantité rebutée / quantité produite × 100, sur le même périmètre.",
    formula: "rebut / production × 100",
    frequency: "Quotidien",
  },
  {
    id: "KPI-safety_signal",
    code: "safety_signal",
    name: "Signaux sécurité critiques",
    axis: "S",
    unit: "nombre",
    direction: "low",
    target: 0,
    green: 0,
    orange: 0,
    red: 1,
    definition:
      "Nombre de signaux critiques ouverts dans le périmètre observé.",
    formula: "comptage",
    frequency: "Quotidien",
  },
  {
    id: "KPI-service",
    code: "service",
    name: "Service client",
    axis: "D",
    unit: "%",
    direction: "high",
    target: 98,
    green: 98,
    orange: 95,
    red: 0,
    definition: "Commandes à l’heure et complètes / commandes dues × 100.",
    formula: "OTIF / commandes dues × 100",
    frequency: "Quotidien",
  },
  {
    id: "KPI-staffing",
    code: "staffing",
    name: "Couverture des compétences",
    axis: "P",
    unit: "%",
    direction: "high",
    target: 100,
    green: 100,
    orange: 90,
    red: 0,
    definition:
      "Postes requis couverts par une personne habilitée / postes requis × 100.",
    formula: "postes couverts / postes requis × 100",
    frequency: "Quotidien",
  },
].map((k) => ({
  ...k,
  owner: "À attribuer",
  level: "Site",
  source: "Manuel",
  site_id: "group",
  active: true,
}));

function osRecordIndex(source = data) {
  const index = new Map();
  for (const key of Object.keys(OS_COLLECTIONS))
    for (const row of source[key] || [])
      if (row.id)
        index.set(row.id, { key, row, module: OS_COLLECTIONS[key][1] });
  return index;
}
function osRecord(id, source = data) {
  return osRecordIndex(source).get(id) || null;
}
function osTitle(row) {
  return (
    row?.title ||
    row?.name ||
    row?.description ||
    row?.finding ||
    row?.scope ||
    row?.code ||
    row?.id ||
    ""
  );
}
function osActor() {
  return data.users?.find((u) => u.id === state.userId)?.name || role().label;
}
function osWritable(siteId = "group") {
  return !role().readonly && (canGroup() || siteId === state.site);
}
function osIsAdmin() {
  return ["lean", "admin"].includes(state.role);
}
function osManager() {
  return !role().readonly && state.role !== "terrain";
}
function osActive(rows) {
  return (rows || []).filter((r) => !r.archived_at);
}
function osScope(rows) {
  return osActive(rows).filter(
    (r) =>
      (state.site === "group" || r.site_id === state.site) &&
      (!state.workshop || r.workshop_id === state.workshop),
  );
}
function osKpi(id) {
  return data.kpis?.find((k) => k.id === id || k.code === id);
}
function osDateOffset(days) {
  const d = new Date(today() + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function osFinite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function osNumber(value) {
  return value === "" || value === null || value === undefined
    ? null
    : Number(value);
}
function osNum(value, digits = 1) {
  return osFinite(value)
    ? value.toLocaleString("fr-FR", { maximumFractionDigits: digits })
    : "—";
}
function osStatus(row, kpi = osKpi(row?.kpi_id || row?.code)) {
  if (!row || !osFinite(row.value)) return "missing";
  if (!kpi || !kpi.definition?.trim() || !row.definition?.trim())
    return "qualify";
  const target = osFinite(row.target) ? row.target : kpi.target;
  if (!osFinite(target)) return "qualify";
  const shift = target - kpi.target,
    green = kpi.green + shift,
    orange = kpi.orange + shift;
  if (!osFinite(green) || !osFinite(orange)) return "qualify";
  return kpi.direction === "high"
    ? row.value >= green
      ? "ok"
      : row.value >= orange
        ? "warn"
        : "gap"
    : row.value <= green
      ? "ok"
      : row.value <= orange
        ? "warn"
        : "gap";
}
function osStatusText(value) {
  return (
    {
      ok: "Cible atteinte",
      warn: "Vigilance",
      gap: "Écart",
      missing: "Sans mesure",
      qualify: "À qualifier",
    }[value] || value
  );
}
function osNormalizedGap(row, kpi = osKpi(row?.kpi_id || row?.code)) {
  if (!row || !kpi || ["missing", "qualify"].includes(osStatus(row, kpi)))
    return null;
  const target = row.target ?? kpi.target;
  return target
    ? ((kpi.direction === "high" ? row.value - target : target - row.value) /
        Math.abs(target)) *
        100
    : null;
}
function osKpiMeasures(siteId, kpiId, workshopId = null) {
  const kpi = osKpi(kpiId);
  if (!kpi) return [];
  const rows = osActive(data.measures).filter(
    (m) =>
      m.site_id === siteId &&
      (m.kpi_id === kpi.id || m.code === kpi.code) &&
      osFinite(m.value) &&
      /^\d{4}-\d{2}-\d{2}$/.test(m.period || ""),
  );
  // A site result must be measured at site level, never inferred by choosing
  // the last workshop entered or averaging ratios without their denominators.
  return rows
    .filter((m) => (workshopId ? m.workshop_id === workshopId : !m.workshop_id))
    .sort(
      (a, b) =>
        a.period.localeCompare(b.period) ||
        String(a.synced_at).localeCompare(String(b.synced_at)),
    );
}
function osLatest(siteId, kpiId, period = null, workshopId = null) {
  return (
    osKpiMeasures(siteId, kpiId, workshopId)
      .filter((m) => !period || m.period <= period)
      .at(-1) || null
  );
}
function osKpiTrend(siteId, kpiId, workshopId = null, period = null) {
  const k = osKpi(kpiId),
    rows = osKpiMeasures(siteId, kpiId, workshopId).filter(
      (m) => !period || m.period <= period,
    );
  let count = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!["gap", "warn"].includes(osStatus(rows[i], k))) break;
    count++;
  }
  return {
    count,
    since: count ? rows[rows.length - count].period : null,
    delta: rows.length > 1 ? rows.at(-1).value - rows.at(-2).value : null,
    rows,
  };
}

function migrateOS(source) {
  const out = clone(source);
  out.meta ||= { schema: 6, demo: false };
  const migrating = out.meta.schema !== 7;
  for (const key of [...Object.keys(OS_COLLECTIONS), "links", "activity"])
    if (!Array.isArray(out[key])) out[key] = [];
  if (migrating) {
    out.sites = out.sites.length ? out.sites : clone(SITES);
    if (!out.users.length) {
      out.users = (out.accounts || []).map((u) => ({
        ...u,
        active: u.status === "Actif",
      }));
      out.legacyAccounts = clone(out.accounts || []);
      out.accounts = [];
    }
    out.kpis = out.kpis.length ? out.kpis : clone(OS_DEFAULT_KPIS);
    out.settings = {
      escalationDays: 2,
      escalationOwners: {
        2: "Manager atelier",
        3: "Direction site",
        4: "Responsable Lean Groupe",
      },
      categories: clone(SIGNAL_TYPES),
      pillars: Object.keys(AUDIT_CRITERIA),
      levels: ["Initial", "Défini", "Appliqué", "Maîtrisé", "Amélioré"],
      ...out.settings,
    };
    out.auditTemplates.push({
      id: "QST-lean",
      site_id: "group",
      name: "Audit Lean — 50 critères",
      type: "Lean",
      questions: Object.entries(AUDIT_CRITERIA).flatMap(([pillar, qs]) =>
        qs.map((text, i) => ({
          id: uid("Q"),
          pillar,
          text,
          proof_required: true,
        })),
      ),
      created_at: now(),
    });
    out.auditTemplates.push({
      id: "QST-5s",
      site_id: "group",
      name: "Audit 5S",
      type: "5S",
      questions: [
        "Supprimer l’inutile",
        "Ranger au point d’usage",
        "Nettoyer et inspecter",
        "Standardiser",
        "Maintenir",
      ].map((text) => ({
        id: uid("Q"),
        pillar: "5S et standards",
        text,
        proof_required: true,
      })),
      created_at: now(),
    });
    // Daily series generated by 6.8 are redundant. Preserve their original JSON
    // for rollback, but read and update a single canonical measure collection.
    out.legacyDailyTrends = (out.trends || []).filter(
      (t) => t.granularity === "daily",
    );
    for (const t of out.legacyDailyTrends)
      for (let i = 0; i < (t.labels || []).length; i++) {
        const period = t.labels[i];
        if (
          !out.measures.some(
            (m) =>
              m.site_id === t.site_id &&
              m.code === t.code &&
              m.period === period,
          )
        )
          out.measures.push({
            id: uid("MES"),
            site_id: t.site_id,
            code: t.code,
            period,
            value: t.values[i],
            target: t.details?.[period]?.target ?? t.target,
            source: t.details?.[period]?.source || t.source,
            definition: t.details?.[period]?.definition || "",
            synced_at: t.details?.[period]?.updated_at || null,
          });
      }
    out.trends = (out.trends || []).filter((t) => t.granularity !== "daily");
    out.meta.migration = { from: out.meta.schema, to: 7, at: now() };
    out.meta.schema = 7;
    out.meta.revision ||= 0;
    out.activity.push({
      id: uid("EVT"),
      at: now(),
      actor: "Migration",
      event: "Migration vers le modèle Lean OS",
      record_id: null,
      fields: [],
      site_id: "group",
    });
  }
  for (const m of out.measures) {
    const k = out.kpis.find((k) => k.code === m.code || k.id === m.kpi_id);
    if (k) {
      m.kpi_id = k.id;
      m.code = k.code;
      m.axis = k.axis;
      m.unit = k.unit;
    }
    m.entry_mode ||= /sequoia|api|automatique/i.test(m.source || "")
      ? "legacy-unverified"
      : "manual";
  }
  for (const a of out.actions) {
    if (a.origin_type === "KPI") {
      const k = out.kpis.find(
        (k) => k.code === a.origin_id || k.id === a.origin_id,
      );
      if (k) {
        a.origin_id = k.id;
        a.kpi_id = k.id;
      }
    }
    a.progress ??=
      { Ouverte: 0, "En cours": 50, "À vérifier": 90, Clôturée: 100 }[
        a.status
      ] ?? 0;
    a.contributors ||= [];
  }
  // Missing legacy links are recorded, never silently deleted.
  if (migrating) out.meta.legacyOrphans = osIntegrity(out).map((x) => x.token);
  return out;
}
function osIntegrity(source = data) {
  const index = osRecordIndex(source),
    issues = [];
  for (const [key] of Object.entries(OS_COLLECTIONS))
    for (const row of source[key] || []) {
      for (const field of [
        "site_id",
        "workshop_id",
        "zone_id",
        "kpi_id",
        "objective_id",
        "project_id",
        "parent_id",
        "practice_id",
        "kaizen_id",
        "standard_id",
        "source_id",
        "origin_id",
        "problem_id",
        "action_id",
        "signal_id",
        "linked_id",
        "template_id",
        "before_after_id",
      ]) {
        const id = row[field];
        if (id && !index.has(id))
          issues.push({
            token: `${row.id}.${field}:${id}`,
            record_id: row.id,
            message: `${field} : ${id} introuvable`,
            key,
          });
      }
    }
  for (const l of source.links || [])
    if (!index.has(l.from) || !index.has(l.to))
      issues.push({
        token: `link:${l.id}`,
        record_id: l.from,
        message: "Relation orpheline",
        key: "links",
      });
  return issues;
}
function osValidate(source) {
  if (source.meta?.schema !== 7) throw Error("Schéma Lean OS incompatible.");
  const globalIds = new Set();
  for (const key of Object.keys(OS_COLLECTIONS)) {
    if (!Array.isArray(source[key])) throw Error(`Collection absente : ${key}`);
    for (const row of source[key]) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(row.id)
      )
        throw Error(`Identifiant absent : ${key}`);
      if (globalIds.has(row.id))
        throw Error(`Identifiant dupliqué : ${row.id}`);
      globalIds.add(row.id);
    }
  }
  const allowed = new Set(source.meta.legacyOrphans || []),
    issues = osIntegrity(source).filter((x) => !allowed.has(x.token));
  if (issues.length)
    throw Error(
      `Relation invalide : ${issues[0].record_id} · ${issues[0].message}`,
    );
  for (const l of source.links || [])
    if (l.from === l.to)
      throw Error("Une relation ne peut pas pointer vers elle-même.");
  for (const o of source.objectives) {
    const seen = new Set([o.id]);
    let parent = o.parent_id;
    while (parent) {
      if (seen.has(parent)) throw Error("Cycle dans les objectifs Hoshin.");
      seen.add(parent);
      parent = source.objectives.find((x) => x.id === parent)?.parent_id;
    }
  }
  for (const doc of source.documents.filter((d) => d.vsm))
    for (const mode of ["current", "future"]) {
      const v = doc.vsm[mode];
      if (!v) continue;
      const ids = new Set();
      for (const n of v.nodes || []) {
        if (n.id && (!/^[A-Za-z0-9_-]{1,160}$/.test(n.id) || ids.has(n.id)))
          throw Error("Identifiant VSM invalide ou dupliqué.");
        if (n.id) ids.add(n.id);
        for (const key of [
          "x",
          "y",
          "ct",
          "va",
          "uptime",
          "operators",
          "changeover",
          "wip",
          "wait",
        ])
          if (n[key] != null && (!osFinite(n[key]) || n[key] < 0))
            throw Error("Valeur VSM invalide.");
        if (n.uptime > 100 || (osFinite(n.va) && osFinite(n.ct) && n.va > n.ct))
          throw Error("Disponibilité ≤ 100 % et VA ≤ cycle requis.");
      }
      for (const e of v.edges || [])
        if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
          throw Error("Flux VSM sans objets valides.");
      for (const key of ["available_minutes", "demand_per_day"])
        if (v[key] != null && (!osFinite(v[key]) || v[key] < 0))
          throw Error("Temps disponible et demande VSM doivent être positifs.");
    }
  return source;
}
function osAuditChanges(before, after) {
  const prev = osRecordIndex(before);
  const timestamp = now();
  for (const [key] of Object.entries(OS_COLLECTIONS))
    for (const row of after[key] || []) {
      const old = prev.get(row.id)?.row;
      if (JSON.stringify(old) === JSON.stringify(row)) continue;
      if (!osWritable(row.site_id || "group"))
        throw Error("Ce profil est en lecture seule ou hors périmètre.");
      const fields = Object.keys(row).filter(
        (k) =>
          !["updated_at", "history"].includes(k) &&
          JSON.stringify(row[k]) !== JSON.stringify(old?.[k]),
      );
      if (!fields.length) continue;
      const changes = Object.fromEntries(
        fields
          .filter((k) =>
            [old?.[k], row[k]].every(
              (v) =>
                (v == null ||
                  ["string", "number", "boolean"].includes(typeof v)) &&
                !(typeof v === "string" && v.startsWith("data:image/")),
            ),
          )
          .map((k) => [k, { before: old?.[k] ?? null, after: row[k] ?? null }]),
      );
      after.activity.push({
        id: uid("EVT"),
        record_id: row.id,
        site_id: row.site_id || "group",
        at: timestamp,
        actor: osActor(),
        event: !old
          ? "Création"
          : row.archived_at && !old.archived_at
            ? "Archivage"
            : "Modification",
        fields,
        changes,
        from: old?.status || old?.state || null,
        to: row.status || row.state || null,
      });
    }
  for (const collection of ["links", "settings"])
    if (
      JSON.stringify(before[collection]) !== JSON.stringify(after[collection])
    ) {
      if (collection === "settings" && !osIsAdmin())
        throw Error("Configuration réservée à l’administration Groupe.");
      after.activity.push({
        id: uid("EVT"),
        record_id: null,
        site_id: state.site,
        at: timestamp,
        actor: osActor(),
        event:
          collection === "links" ? "Relations modifiées" : "Règles modifiées",
        fields: [collection],
      });
    }
  after.meta.revision = (before.meta.revision || 0) + 1;
}
function osRelations(id) {
  const index = osRecordIndex(),
    rels = [];
  for (const l of data.links)
    if (l.from === id || l.to === id) {
      const other = index.get(l.from === id ? l.to : l.from);
      if (other)
        rels.push({ ...other, label: l.type || "Associé", link_id: l.id });
    }
  const fields = {
    origin_id: "Origine",
    kpi_id: "KPI",
    objective_id: "Objectif",
    project_id: "Projet",
    parent_id: "Objectif parent",
    practice_id: "Bonne pratique",
    kaizen_id: "Kaizen",
    standard_id: "Standard",
    source_id: "Source",
    problem_id: "Problème",
    action_id: "Action",
    signal_id: "Observation",
    linked_id: "Dossier",
    before_after_id: "Avant / Après",
  };
  for (const info of index.values())
    for (const [field, label] of Object.entries(fields)) {
      if (info.row.id === id && index.has(info.row[field]))
        rels.push({ ...index.get(info.row[field]), label });
      else if (info.row[field] === id)
        rels.push({ ...info, label: `${OS_COLLECTIONS[info.key][0]} lié` });
    }
  return [
    ...new Map(
      rels.filter((x) => x.row.id !== id).map((x) => [x.row.id, x]),
    ).values(),
  ];
}
function osLink(from, to, type = "Contribue à") {
  if (from === to || !osRecord(from) || !osRecord(to))
    throw Error("Sélectionnez deux dossiers existants distincts.");
  if (
    !data.links.some((l) => l.from === from && l.to === to && l.type === type)
  )
    data.links.push({
      id: uid("LNK"),
      from,
      to,
      type,
      created_at: now(),
      actor: osActor(),
    });
}
function osUpsert(key, row) {
  if (!OS_COLLECTIONS[key]) throw Error("Collection inconnue.");
  if (!osWritable(row.site_id || "group"))
    throw Error("Périmètre non autorisé.");
  const payload = {
    ...row,
    id: row.id || uid(OS_PREFIX[key] || "REC"),
    updated_at: now(),
  };
  const old = data[key].find((x) => x.id === payload.id);
  if (old) Object.assign(old, payload);
  else data[key].unshift({ ...payload, created_at: now() });
  return data[key].find((x) => x.id === payload.id);
}
function osArchive(id) {
  const info = osRecord(id);
  if (!info) return false;
  if (info.key === "sites" && info.row.kind === "group")
    throw Error("La Holding porte le périmètre Groupe et doit être conservée.");
  if (
    ["sites", "workshops", "kpis", "users"].includes(info.key) &&
    [...osRecordIndex().values()].some(
      (x) =>
        x.row.id !== id &&
        !x.row.archived_at &&
        [
          x.row.site_id,
          x.row.workshop_id,
          x.row.kpi_id,
          x.row.owner_id,
        ].includes(id),
    )
  )
    throw Error(
      "Ce référentiel est encore utilisé. Désactivez-le ou transférez ses liens.",
    );
  info.row.archived_at = now();
  return true;
}
function osSuggestions(siteId = state.site) {
  const suggestions = [];
  for (const s of OPERATIONAL_SITES.filter(
    (s) => siteId === "group" || s.id === siteId,
  ))
    for (const k of osActive(data.kpis)) {
      const trend = osKpiTrend(s.id, k.id),
        m = trend.rows.at(-1);
      if (!m || !["gap", "warn"].includes(osStatus(m, k))) continue;
      const practices = osActive(data.practices).filter(
        (p) =>
          p.site_id !== s.id &&
          ["Publiée", "Validée", "Déployée"].includes(p.status) &&
          p.evidence &&
          (p.kpi_id === k.id ||
            osRelations(p.id).some((r) => r.row.id === k.id)),
      );
      suggestions.push({
        id: `${s.id}:${k.id}`,
        site_id: s.id,
        kpi_id: k.id,
        measure_id: m.id,
        title: `${k.name} · ${s.name}`,
        detail: `${trend.count} relevé(s) consécutif(s) hors cible depuis le ${shortDate(trend.since)}.`,
        practices: practices.map((p) => p.id),
        basis: trend.rows.slice(-trend.count).map((x) => x.id),
      });
    }
  return suggestions;
}
function osEscalationCandidates(at = today()) {
  return osActive(data.actions)
    .filter((a) => isOpenAction(a) && a.due_date)
    .map((a) => {
      const last = data.escalations
          .filter((e) => e.source_id === a.id)
          .sort((a, b) => b.level - a.level)[0],
        current = last?.level || 1;
      const daysSince = (date) =>
        Math.floor(
          (new Date(at + "T12:00:00Z") -
            new Date(date.slice(0, 10) + "T12:00:00Z")) /
            86400000,
        );
      return {
        action: a,
        level: current + 1,
        delay: daysSince(a.due_date),
        elapsed: daysSince(last?.created_at || a.due_date),
        current,
      };
    })
    .filter((x) => x.elapsed >= data.settings.escalationDays && x.level <= 4);
}
function osRunEscalations() {
  const created = [];
  for (const c of osEscalationCandidates().filter((c) =>
    osWritable(c.action.site_id),
  )) {
    const row = osUpsert("escalations", {
      site_id: c.action.site_id,
      workshop_id: c.action.workshop_id || null,
      source_id: c.action.id,
      title: c.action.title,
      level: c.level,
      owner: data.settings.escalationOwners[c.level] || "À attribuer",
      due_date: osDateOffset(1),
      status: "Ouverte",
      detail: `Échéance dépassée de ${c.delay} jour(s). Règle : ${data.settings.escalationDays} jour(s).`,
      result: "",
    });
    created.push(row);
  }
  return created;
}
function osGainValue(g) {
  if (!osFinite(g.before) || !osFinite(g.after)) return null;
  return (
    (g.direction === "high" ? g.after - g.before : g.before - g.after) *
    (osFinite(g.quantity) ? g.quantity : 1)
  );
}
function osValidatedGains(rows = data.gains) {
  const result = {};
  for (const g of osActive(rows).filter(
    (g) => g.status === "Validé" && g.evidence && g.validated_by,
  )) {
    const val = osGainValue(g);
    if (val === null) continue;
    const key = `${g.unit} · ${g.period || "période non définie"}`;
    result[key] = (result[key] || 0) + val;
  }
  return result;
}
function osObjectiveProgress(id, visited = new Set()) {
  if (visited.has(id)) return { total: 0, closed: 0, pct: null };
  visited.add(id);
  const objectives = new Set([id]);
  let count = 0;
  while (count !== objectives.size) {
    count = objectives.size;
    for (const o of data.objectives)
      if (objectives.has(o.parent_id)) objectives.add(o.id);
  }
  const projects = new Set(
    data.projects
      .filter(
        (p) =>
          objectives.has(p.objective_id) ||
          data.links.some((l) => l.from === p.id && objectives.has(l.to)),
      )
      .map((p) => p.id),
  );
  const actions = osActive(data.actions).filter(
    (a) =>
      objectives.has(a.objective_id) ||
      projects.has(a.project_id) ||
      projects.has(a.origin_id) ||
      data.links.some(
        (l) => l.from === a.id && (objectives.has(l.to) || projects.has(l.to)),
      ),
  );
  const closed = actions.filter((a) => a.status === "Clôturée").length;
  return {
    total: actions.length,
    closed,
    pct: actions.length ? Math.round((closed / actions.length) * 100) : null,
    actions,
  };
}
function osMaturity(siteId, pillar, at = today(), workshopId = null) {
  return (
    osActive(data.maturity)
      .filter(
        (m) =>
          m.site_id === siteId &&
          m.pillar === pillar &&
          m.date <= at &&
          (workshopId ? m.workshop_id === workshopId : !m.workshop_id),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          String(a.updated_at).localeCompare(String(b.updated_at)),
      )
      .at(-1) || null
  );
}

// RFC 4180-style CSV parser: quoted separators, escaped quotes, CRLF and multiline fields.
function osParseCSV(text) {
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  let rows = [],
    row = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw Error("Guillemet CSV non fermé.");
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2)
    throw Error("Le fichier doit contenir un en-tête et des mesures.");
  const header = rows.shift().map((x) => x.trim());
  if (new Set(header).size !== header.length)
    throw Error("Colonnes CSV dupliquées.");
  return rows.map((r, i) => {
    if (r.length !== header.length)
      throw Error(`Ligne ${i + 2} : nombre de colonnes incorrect.`);
    return Object.fromEntries(header.map((k, n) => [k, r[n].trim()]));
  });
}
function osValidateMeasurements(rows, mode = "import") {
  const seen = new Set(),
    errors = [],
    accepted = [];
  rows.forEach((r, i) => {
    try {
      const k = osKpi(r.kpi_id || r.code),
        s = data.sites.find(
          (s) => s.id === r.site_id && s.kind === "site" && !s.archived_at,
        ),
        value = osNumber(String(r.value ?? "").replace(",", ".")),
        target = osNumber(String(r.target ?? "").replace(",", "."));
      if (!k || !s) throw Error("Site ou KPI inconnu.");
      if (!osWritable(s.id)) throw Error("Site hors périmètre.");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(r.period || "") ||
        Number.isNaN(Date.parse(r.period)) ||
        new Date(r.period).toISOString().slice(0, 10) !== r.period ||
        r.period > today()
      )
        throw Error("Date invalide ou future.");
      if (!osFinite(value) || value < 0 || (k.unit === "%" && value > 100))
        throw Error("Valeur numérique hors domaine.");
      if (
        target !== null &&
        (!osFinite(target) || target < 0 || (k.unit === "%" && target > 100))
      )
        throw Error("Cible invalide.");
      if (
        r.workshop_id &&
        !data.workshops.some(
          (w) => w.id === r.workshop_id && w.site_id === s.id,
        )
      )
        throw Error("Atelier hors du site.");
      const key = [s.id, k.id, r.workshop_id || "", r.period].join("|");
      if (seen.has(key)) throw Error("Doublon dans le fichier.");
      seen.add(key);
      const existing = data.measures.find(
        (m) =>
          [m.site_id, m.kpi_id, m.workshop_id || "", m.period].join("|") ===
          key,
      );
      if (existing && mode === "import")
        throw Error("Mesure déjà présente : corrigez-la depuis le registre.");
      if (!r.definition?.trim()) throw Error("Définition / périmètre requis.");
      accepted.push({
        ...r,
        id: existing?.id || uid("MES"),
        site_id: s.id,
        kpi_id: k.id,
        code: k.code,
        axis: k.axis,
        unit: k.unit,
        workshop_id: r.workshop_id || null,
        value,
        target,
        entry_mode: mode === "manual" ? "manual" : "import",
        source: r.source || "Import CSV",
        synced_at: now(),
      });
    } catch (e) {
      errors.push({ line: i + 2, message: e.message });
    }
  });
  return { accepted, errors };
}
function osInit() {
  SITES.splice(0, SITES.length, ...data.sites.filter((s) => !s.archived_at));
  OPERATIONAL_SITES.splice(
    0,
    OPERATIONAL_SITES.length,
    ...SITES.filter((s) => s.kind === "site"),
  );
  BENCHMARK_KPIS.splice(
    0,
    BENCHMARK_KPIS.length,
    ...osActive(data.kpis).map((k) => ({
      code: k.code,
      label: k.name,
      unit: k.unit === "nombre" ? "" : k.unit,
    })),
  );
  for (const axis of Object.keys(AXES)) {
    const k = osActive(data.kpis).find((k) => k.axis === axis);
    if (k) {
      const old = GROUP_SQCDP.find((x) => x.axis === axis);
      if (old)
        Object.assign(old, {
          code: k.code,
          direction: k.direction,
          unit: k.unit,
        });
    }
  }
  SIGNAL_TYPES.splice(0, SIGNAL_TYPES.length, ...data.settings.categories);
  state.osTab ||= "tower";
  state.workshop ||= "";
  state.dailyLevel ||= 1;
  state.adminTab ||= "sites";
}
