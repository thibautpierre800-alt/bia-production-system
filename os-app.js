"use strict";

ROLES.dg.readonly = true;
ROLES.admin = {
  ...ROLES.lean,
  label: "Administrateur Groupe",
  nav: [...ROLES.lean.nav],
};
ROLES.sitelean = {
  ...ROLES.director,
  label: "Responsable Lean Site",
  nav: [...ROLES.director.nav],
};
ROLES.manager = {
  ...ROLES.director,
  label: "Manager atelier",
  nav: [...ROLES.director.nav],
};
ROLES.reader = {
  ...ROLES.dg,
  label: "Lecture seule",
  readonly: true,
  nav: [...ROLES.lean.nav].filter((n) => n !== "settings"),
};
const OS_NAV = [
  { id: "daily", icon: "↥", label: "Routines et escalades", group: "Pilotage" },
  { id: "analysis", icon: "⌕", label: "Analyse des écarts", group: "Pilotage" },
  { id: "maturity", icon: "◉", label: "Maturité Lean", group: "Pilotage" },
  { id: "hoshin", icon: "✣", label: "Hoshin et objectifs", group: "Stratégie" },
  {
    id: "kaizen",
    icon: "✧",
    label: "Idées, Kaizen et gains",
    group: "Amélioration",
  },
  {
    id: "deployment",
    icon: "⇄",
    label: "Déploiement multisite",
    group: "Capitalisation",
  },
  {
    id: "activity",
    icon: "◷",
    label: "Journal d’activité",
    group: "Administration",
  },
  {
    id: "connectors",
    icon: "⇥",
    label: "Connecteurs",
    group: "Administration",
  },
];
for (const [id, r] of Object.entries(ROLES)) {
  const additions =
    id === "terrain"
      ? ["kaizen", "daily"]
      : OS_NAV.filter(
          (n) =>
            n.id !== "connectors" || ["lean", "admin", "reader"].includes(id),
        ).map((n) => n.id);
  r.nav = [...new Set([...r.nav, ...additions])];
  if (
    ["director", "sitelean", "manager"].includes(id) &&
    !r.nav.includes("practices")
  )
    r.nav.push("practices");
}
const osGroups = {
  home: "Accueil",
  pilotage: "Pilotage",
  sqcdp: "Pilotage",
  terrain: "Terrain",
  audits: "Terrain",
  actions: "Amélioration",
  resolution: "Amélioration",
  projects: "Stratégie",
  roadmap: "Stratégie",
  practices: "Capitalisation",
  documents: "Capitalisation",
  tools: "Ressources",
  training: "Ressources",
  account: "Administration",
  settings: "Administration",
};
for (const n of NAV) {
  n.group = osGroups[n.id] || n.group;
  if (n.id === "pilotage") n.label = "Control Tower";
  if (n.id === "audits") n.label = "Audits et 5S";
  if (n.id === "sqcdp") n.label = "SQCDP";
}
NAV.push(...OS_NAV);
const osGroupOrder = [
  "Accueil",
  "Pilotage",
  "Terrain",
  "Amélioration",
  "Stratégie",
  "Capitalisation",
  "Ressources",
  "Administration",
];
NAV.sort(
  (a, b) => osGroupOrder.indexOf(a.group) - osGroupOrder.indexOf(b.group),
);
DOCUMENT_SCHEMAS.A3.fields.push([
  "learning",
  "12. Enseignements",
  "Qu’a appris l’équipe ? Qu’est-ce qui peut être réutilisé ailleurs ?",
]);
DOCUMENT_SCHEMAS.PDCA = {
  title: "PDCA",
  fields: [
    [
      "plan",
      "Plan · Fait, cible et hypothèse",
      "Décrire l’écart et le test proposé.",
    ],
    [
      "do",
      "Do · Essai",
      "Réaliser un essai borné avec responsable et échéance.",
    ],
    ["check", "Check · Mesure", "Comparer les résultats à la cible."],
    [
      "act",
      "Act · Standard et enseignements",
      "Standardiser ce qui fonctionne ou ajuster l’hypothèse.",
    ],
  ],
};
DOCUMENT_SCHEMAS.DMAIC = {
  title: "DMAIC",
  fields: [
    [
      "define",
      "Define · Problème et client",
      "Périmètre, CTQ, équipe et charte.",
    ],
    [
      "measure",
      "Measure · Mesure fiable",
      "Définition opérationnelle, plan de collecte et référence.",
    ],
    [
      "analyze",
      "Analyze · Causes testées",
      "Stratifier, tester les hypothèses et consigner les preuves.",
    ],
    [
      "improve",
      "Improve · Solutions",
      "Choisir, expérimenter et déployer les contre-mesures.",
    ],
    [
      "control",
      "Control · Tenue des résultats",
      "Plan de contrôle, réaction aux écarts et standardisation.",
    ],
  ],
};
TEMPLATES.push(
  {
    type: "PDCA",
    group: "Résolution",
    title: "PDCA",
    desc: "Une expérimentation et sa mesure",
  },
  {
    type: "DMAIC",
    group: "Résolution",
    title: "DMAIC",
    desc: "Un problème complexe, cinq étapes vérifiables",
  },
);
function osRelationFields(row = {}) {
  return `<details class="wide os-relation-fields"><summary>Relier au pilotage et préciser le périmètre</summary><div class="form-grid">${[
    ["kpi_id", "KPI", "kpis"],
    ["objective_id", "Objectif", "objectives"],
    ["project_id", "Projet", "projects"],
  ]
    .map(
      ([key, label, type]) =>
        `<label>${label}<select id="osRel_${key}"><option value="">Non relié</option>${osOptions(type, row, key)}</select></label>`,
    )
    .join(
      "",
    )}<label>Contributeurs (virgules)<input id="osContributors" value="${esc((row.contributors || []).join(", "))}"></label></div></details>`;
}
function osRelationValues() {
  return Object.fromEntries(
    ["kpi_id", "objective_id", "project_id"]
      .filter((k) => $("osRel_" + k))
      .map((k) => [k, $("osRel_" + k).value || null])
      .concat(
        $("osContributors")
          ? [
              [
                "contributors",
                $("osContributors")
                  .value.split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              ],
            ]
          : [],
      ),
  );
}
function osDecorateModal(title) {
  const id = title.split(" · ")[0],
    info = osRecord(id),
    body = document.querySelector(".modal-body");
  if (info && body && !body.querySelector(".os-context"))
    body.insertAdjacentHTML("beforeend", osContext(id));
  if (role().readonly && body)
    body
      .querySelectorAll(
        "input,textarea,select,button[type=submit],form button:not([type])",
      )
      .forEach((el) => (el.disabled = true));
}
function osBind() {
  document
    .querySelectorAll("[data-open-record]")
    .forEach((b) => (b.onclick = () => openRecord(b.dataset.openRecord)));
  document.querySelectorAll("[data-os]").forEach(
    (button) =>
      (button.onclick = async () => {
        const action = button.dataset.os;
        let args = {};
        try {
          args = JSON.parse(button.dataset.args || "{}");
        } catch {
          return;
        }
        try {
          if (action === "nav") return switchView(args.view);
          if (action === "new") {
            if (!requestCloseModal()) return;
            if (args.key === "auditTemplates") return osQuestionnaireForm();
            return osForm(args.key, null, args.preset || {});
          }
          if (action === "edit") {
            if (!requestCloseModal()) return;
            return args.key === "auditTemplates"
              ? osQuestionnaireForm(args.id)
              : osForm(args.key, args.id);
          }
          if (action === "measure") {
            if (!requestCloseModal()) return;
            return osMeasureForm(args.id, args);
          }
          if (action === "kpiDetail")
            return osKpiDetail(args.siteId, args.kpiId, args.period);
          if (action === "pilotDetail") {
            state.osTab = "detail";
            return render();
          }
          if (action === "tower") {
            state.osTab = "tower";
            return render();
          }
          if (action === "adminTab") {
            state.adminTab = args.key;
            return render();
          }
          if (action === "level") {
            state.dailyLevel = args.level;
            return render();
          }
          if (action === "follow") return osFollowForm(args.id);
          if (action === "createFrom") return osCreateFrom(args.id, args.kind);
          if (action === "trace") return osOpenTrace(args.id);
          if (action === "link") return osLinkForm(args.id);
          if (action === "comment") return osCommentForm(args.id);
          if (action === "archive") {
            if (!requestCloseModal()) return;
            const info = osRecord(args.id);
            return modal(
              "Archiver ce dossier",
              `<p>${esc(osTitle(info.row))}</p><p>Le dossier restera dans la sauvegarde et ses liens seront conservés. Il sera masqué des listes actives.</p><div class="row-actions">${osButton("Confirmer l’archivage", "archiveConfirm", args, false)}<button type="button" class="btn secondary" data-close-modal>Annuler</button></div>`,
            );
          }
          if (action === "archiveConfirm" || action === "unarchive") {
            if (
              !commitData(() =>
                action === "archiveConfirm"
                  ? osArchive(args.id)
                  : delete osRecord(args.id).row.archived_at,
              )
            )
              return;
            osInit();
            closeModal();
            return render();
          }
          if (action === "kpiProblem") {
            if (!requestCloseModal()) return;
            const k = osKpi(args.kpiId);
            return genericProblemForm({
              site_id: args.siteId,
              kpi_id: k.id,
              origin_id: args.measureId || k.id,
              title: `Écart ${k.name}`,
              description: `Dernière valeur : ${osNum(osLatest(args.siteId, k.id)?.value)} ${k.unit}. Cause à rechercher.`,
            });
          }
          if (action === "escalate") {
            let created = [];
            if (!commitData(() => (created = osRunEscalations()))) return;
            render();
            return toast(
              `${created.length} escalade(s) créée(s), sans doublon.`,
            );
          }
          if (action === "maturityCell") {
            const m = osMaturity(args.siteId, args.pillar);
            return osForm("maturity", m?.id, {
              site_id: args.siteId,
              pillar: args.pillar,
            });
          }
          if (action === "matrix") {
            if (!osIsAdmin())
              return toast(
                "Qualification des contributions réservée au Groupe.",
              );
            if (args.implicit)
              return toast(
                "Ce lien provient du parent ou KPI du dossier. Modifiez la fiche pour le changer.",
              );
            if (
              !commitData(() => {
                const old = data.links.find(
                  (l) => l.from === args.from && l.to === args.to,
                );
                if (!old) osLink(args.from, args.to, "Forte");
                else if (old.type === "Forte") old.type = "Faible";
                else data.links = data.links.filter((l) => l.id !== old.id);
              })
            )
              return;
            return render();
          }
          if (action === "audit") return osAuditStart();
          if (action === "export") return exportData();
          if (action === "backup")
            return downloadJsonText(
              localStorage.getItem(STORAGE_KEY + "-before-lean-os"),
              "bia-avant-lean-os.json",
            );
          if (action === "demo" || action === "emptyData")
            return modal(
              action === "demo"
                ? "Explorer le scénario complet"
                : "Créer un espace de saisie vide",
              `<p>Les données actuelles seront sauvegardées avant de changer d’espace. Le retour restera disponible dans Administration.</p>${osButton("Confirmer le changement d’espace", "replaceData", { demo: action === "demo" }, false)}`,
            );
          if (action === "replaceData") {
            const previous = clone(data);
            localStorage.setItem(
              STORAGE_KEY + "-before-demo",
              JSON.stringify(previous),
            );
            data = osFreshData(args.demo);
            if (!save()) {
              data = previous;
              return;
            }
            osInit();
            state.site = "group";
            state.view = "pilotage";
            state.osTab = "tower";
            closeModal();
            return render();
          }
          if (action === "restoreDemo") {
            const previous = localStorage.getItem(STORAGE_KEY + "-before-demo");
            if (!previous) return;
            const restored = validateImport(JSON.parse(previous)),
              before = data;
            data = restored;
            if (!save()) {
              data = before;
              return;
            }
            osInit();
            return render();
          }
          if (action === "csvTemplate") {
            const k = data.kpis[0],
              s = OPERATIONAL_SITES[0],
              csv =
                "site_id,code,period,value,target,definition,source\n" +
                `${s.id},${k.code},${today()},80,85,Périmètre à préciser,Export atelier\n`;
            return downloadJsonText(csv, "contrat-mesures-bia.csv");
          }
          if (action === "vsmMode") {
            if (!requestCloseModal()) return;
            return osVsmForm(
              data.documents.find((d) => d.id === args.id),
              args.mode,
            );
          }
          if (action === "vsmTable") {
            if (!requestCloseModal()) return;
            return vsmForm(
              data.documents.find((d) => d.id === args.id),
              args.mode,
            );
          }
          if (action === "vsmOpportunity") {
            if (!requestCloseModal()) return;
            const doc = data.documents.find((d) => d.id === args.id),
              node = doc.vsm[args.mode].nodes.find((n) => n.id === args.nodeId);
            modal(
              "Opportunité VSM",
              `<h3>${esc(node.name)}</h3><p>${esc(node.note || "Précisez l’opportunité et son résultat attendu dans la fiche créée.")}</p><div class="row-actions">${["action", "kaizens", "projects", "problem"].map((kind) => osButton({ action: "Action", kaizens: "Kaizen", projects: "Projet", problem: "A3 / DMAIC" }[kind], "vsmCreate", { ...args, kind })).join("")}</div>`,
            );
            return;
          }
          if (action === "vsmCreate") {
            const doc = data.documents.find((d) => d.id === args.id),
              n = doc.vsm[args.mode].nodes.find((n) => n.id === args.nodeId);
            closeModal();
            osCreateFrom(args.id, args.kind);
            const title =
              $("actionTitle") ||
              $("projectTitle") ||
              $("problemTitle") ||
              $("osForm")?.elements.title;
            if (title)
              title.value = `${n.name} · ${n.note || "Améliorer le flux"}`;
            return;
          }
          if (action === "pareto") return osParetoForm(args.id);
        } catch (error) {
          toast(error.message || "Opération impossible.");
        }
      }),
  );
  $("osPeriod")?.addEventListener("change", (e) => {
    state.osPeriod = e.target.value;
    render();
  });
  $("osRules")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!osIsAdmin()) return;
    const f = e.currentTarget;
    if (!f.reportValidity()) return;
    const categories = f.elements.categories.value
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!categories.length) return;
    if (
      !commitData(() => {
        data.settings.escalationDays = Number(f.elements.days.value);
        for (const n of [2, 3, 4])
          data.settings.escalationOwners[n] =
            f.elements["owner" + n].value.trim();
        data.settings.categories = [...new Set(categories)];
        data.settings.levels = [0, 1, 2, 3, 4].map((i) =>
          f.elements["level" + i].value.trim(),
        );
      })
    )
      return;
    SIGNAL_TYPES.splice(0, SIGNAL_TYPES.length, ...categories);
    toast("Règles enregistrées.");
  });
  $("osCSVFile")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024) throw Error("CSV limité à 3 Mo.");
      const check = osValidateMeasurements(osParseCSV(await file.text()));
      $("osCSVResult").innerHTML =
        `<p>${check.accepted.length} ligne(s) valides · ${check.errors.length} erreur(s).</p>${check.errors.map((x) => `<p class="bad">Ligne ${x.line} : ${esc(x.message)}</p>`).join("")}${!check.errors.length ? '<button type="button" class="btn" id="osConfirmCSV">Confirmer l’import</button>' : "<p>Corrigez le fichier : aucune ligne n’a été importée.</p>"}`;
      $("osConfirmCSV")?.addEventListener("click", () => {
        const fresh = osValidateMeasurements(check.accepted);
        if (fresh.errors.length)
          return toast("Les données ont changé : rechargez le fichier.");
        if (
          !commitData(() => {
            data.measures.push(...fresh.accepted);
            data.syncLog.push({
              id: uid("SYNC"),
              at: now(),
              source: file.name,
              accepted: fresh.accepted.length,
              status: "Import validé",
            });
          })
        )
          return;
        render();
        toast("Mesures importées.");
      });
    } catch (err) {
      toast(err.message);
    }
  });
}
function osFreshData(demo) {
  const base = migrateOS(clone(DEMO));
  if (!demo) {
    for (const key of Object.keys(OS_COLLECTIONS))
      if (!["sites", "workshops", "kpis", "auditTemplates"].includes(key))
        base[key] = [];
    base.trends = [];
    base.topics = [];
    base.links = [];
    base.activity = [];
    base.trainingRecords = [];
    base.people = [];
    base.meta.demo = false;
    base.meta.legacyOrphans = [];
    return base;
  }
  base.measures = [];
  base.trends = [];
  base.meta.demo = true;
  const siteIds = base.sites.filter((s) => s.kind === "site").map((s) => s.id),
    periods = [-28, -21, -14, -7, 0];
  for (const [si, siteId] of siteIds.entries())
    for (const [ki, k] of base.kpis.entries())
      for (const [pi, days] of periods.entries()) {
        const value =
          k.code === "trs"
            ? Math.min(96, siteId === "marzin" ? 86 - pi * 3 : 80 + si + pi)
            : k.code === "scrap"
              ? siteId === "marzin"
                ? 3 + pi * 0.6
                : Math.max(0.5, 3.5 - si * 0.25 - pi * 0.2)
              : k.code === "safety_signal"
                ? si === 2 && pi === 4
                  ? 1
                  : 0
                : k.code === "service"
                  ? 94 + Math.min(5, si + pi)
                  : 94 + Math.min(6, si + pi);
        base.measures.push({
          id: uid("MES"),
          site_id: siteId,
          kpi_id: k.id,
          code: k.code,
          axis: k.axis,
          unit: k.unit,
          period: osDateOffset(days),
          value: +value.toFixed(1),
          target: k.target,
          definition: k.definition,
          source: "Scénario industriel fictif",
          entry_mode: "demo",
          synced_at: now(),
        });
      }
  base.objectives = [
    {
      id: "OBJ-vision",
      site_id: "group",
      title: "Fiabiliser les flux et la qualité",
      level: "Axe stratégique",
      owner: "Direction Groupe",
      year: new Date().getFullYear(),
      due_date: osDateOffset(180),
      status: "En cours",
    },
    {
      id: "OBJ-group",
      site_id: "group",
      parent_id: "OBJ-vision",
      title: "Réduire les pertes de production",
      level: "Groupe",
      kpi_id: "KPI-trs",
      target: 85,
      owner: "Responsable Lean Groupe",
      year: new Date().getFullYear(),
      due_date: osDateOffset(90),
      status: "En cours",
    },
    {
      id: "OBJ-site",
      site_id: "marzin",
      parent_id: "OBJ-group",
      title: "Stabiliser le poste de finition",
      level: "Site",
      kpi_id: "KPI-trs",
      target: 85,
      owner: "Pilote site",
      year: new Date().getFullYear(),
      due_date: osDateOffset(60),
      status: "En cours",
    },
    {
      id: "OBJ-atelier",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      parent_id: "OBJ-site",
      title: "Supprimer les reprises au poste",
      level: "Atelier",
      kpi_id: "KPI-scrap",
      target: 3,
      owner: "Manager atelier",
      year: new Date().getFullYear(),
      due_date: osDateOffset(45),
      status: "En cours",
    },
  ];
  for (const a of base.actions) {
    a.kpi_id = "KPI-trs";
    a.objective_id = "OBJ-atelier";
    a.due_date = osDateOffset(-6);
  }
  base.projects[0].objective_id = "OBJ-site";
  base.projects[0].kpi_id = "KPI-trs";
  base.problems[0].kpi_id = "KPI-scrap";
  base.signals[1].kpi_id = "KPI-scrap";
  base.kaizens = [
    {
      id: "KAI-demo",
      site_id: "marzin",
      title: "Guide de positionnement au poste",
      problem: "Les réglages répétés provoquent des reprises.",
      solution: "Tester une butée réglable et un contrôle au démarrage.",
      status: "Mise en œuvre",
      owner: "Équipe finition",
      kpi_id: "KPI-trs",
      source_id: "S-039",
      validated_by: "Pilote site",
      due_date: osDateOffset(7),
    },
  ];
  base.practices.push({
    id: "BP-transfert",
    site_id: "profiline",
    title: "Réglage standard et contrôle première pièce",
    category: "Production",
    summary:
      "Repères de réglage et validation de la première pièce avant le lot.",
    evidence: "Exemple fictif : TRS de 78 à 87 % sur quatre semaines.",
    transfer: "Famille comparable, mesure fiable, validation des opérateurs.",
    status: "Publiée",
    validated_by: "Pilote qualité — exemple",
    owner: "Référent Profiline",
    kpi_id: "KPI-trs",
  });
  base.deployments = [
    {
      id: "DEP-demo",
      site_id: "marzin",
      practice_id: "BP-transfert",
      owner: "Pilote site",
      due_date: osDateOffset(14),
      status: "Test",
      prerequisites: "Tester sur la même famille, adapter les repères.",
      result: "Essai en cours",
    },
  ];
  for (const [si, s] of siteIds.entries())
    for (const [pi, pillar] of base.settings.pillars.entries())
      base.maturity.push({
        id: uid("MAT"),
        site_id: s,
        pillar,
        level: 1 + ((si + pi) % 4),
        target: 4,
        date: today(),
        owner: "Auditeur — exemple",
        evidence:
          "Scénario fictif : standard, observation et entretien renseignés.",
      });
  base.routines = [
    {
      id: "RIT-demo",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Point quotidien finition",
      level: 1,
      frequency: "Quotidien",
      owner: "Manager atelier",
      date: today(),
      status: "Prévu",
    },
  ];
  base.documents.push(
    osVsmNormalize({
      id: "DOC-VSM-demo",
      site_id: "marzin",
      title: "Flux finition — exemple",
      type: "VSM",
      owner: "Méthodes",
      status: "Brouillon",
      structured_data: { family: "Panneaux" },
      vsm: {
        current: {
          family: "Panneaux",
          source: "Exemple fictif",
          available_minutes: 420,
          demand_per_day: 360,
          nodes: [
            {
              name: "Préparation",
              ct: 50,
              va: 35,
              changeover: 20,
              uptime: 95,
              operators: 1,
              wip: 40,
              wait: 45,
            },
            {
              name: "Finition",
              ct: 80,
              va: 60,
              changeover: 35,
              uptime: 90,
              operators: 1,
              wip: 100,
              wait: 120,
            },
            {
              name: "Contrôle",
              ct: 35,
              va: 10,
              changeover: 0,
              uptime: 98,
              operators: 1,
              wip: 50,
              wait: 60,
            },
          ],
        },
        future: { nodes: [] },
      },
    }),
  );
  base.meta.legacyOrphans = osIntegrity(base).map((x) => x.token);
  return base;
}
function osParetoForm(id) {
  const p = data.problems.find((x) => x.id === id);
  if (!p) return;
  const values = p.pareto || [];
  modal(
    `${id} · Pareto`,
    `<form id="osPareto"><label class="field">Catégorie ; quantité (une par ligne)<textarea name="values" rows="8">${esc(values.map((v) => `${v.label};${v.value}`).join("\n"))}</textarea></label><div class="form-actions"><button class="btn">Enregistrer et calculer</button></div></form>${osParetoChart(values)}`,
  );
  $("osPareto").onsubmit = (e) => {
    e.preventDefault();
    try {
      const rows = e.currentTarget.elements.values.value
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          const [label, value] = l.split(";"),
            n = Number(value?.replace(",", "."));
          if (!label?.trim() || !osFinite(n) || n < 0)
            throw Error("Chaque ligne : catégorie ; nombre positif.");
          return { label: label.trim(), value: n };
        });
      if (
        !commitData(
          () => (data.problems.find((x) => x.id === id).pareto = rows),
        )
      )
        return;
      osParetoForm(id);
    } catch (err) {
      toast(err.message);
    }
  };
}
function osParetoChart(rows) {
  const sorted = rows.slice().sort((a, b) => b.value - a.value),
    total = sorted.reduce((s, r) => s + r.value, 0);
  let cum = 0;
  return `<div class="os-pareto">${sorted
    .map((r) => {
      cum += r.value;
      return `<div><b>${esc(r.label)}</b><div class="os-bar"><span style="width:${total ? (r.value / total) * 100 : 0}%"></span></div><span>${osNum(r.value)} · cumul ${osNum(total ? (cum / total) * 100 : 0)} %</span></div>`;
    })
    .join("")}</div>`;
}
