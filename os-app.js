"use strict";

const OS_NAV = [
  { id: "daily", icon: "↥", label: "Aujourd’hui", group: "Pilotage" },
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
    ["teamlead", "operator"].includes(id)
      ? ["kaizen", "daily"]
      : OS_NAV.filter(
          (n) =>
            n.id !== "connectors" || id === "lean",
        ).map((n) => n.id);
  r.nav = [...new Set([...r.nav, ...additions])];
  if (
    id === "director" &&
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
  if (n.id === "pilotage") n.label = "Pilotage";
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
  os74Bind();
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
            state.pilotageMode = "analysis";
            state.osTab = "detail";
            return render();
          }
          if (action === "tower") {
            state.pilotageMode = "analysis";
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
            return osForm("maturity", null, {
              site_id: args.siteId,
              pillar: args.pillar,
              target: args.target || 4,
              date: today(),
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
          if (action === "backupDemoRefresh")
            return downloadJsonText(
              localStorage.getItem(STORAGE_KEY + "-before-demo-refresh"),
              "bia-avant-actualisation-demo.json",
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
            state.pilotageMode = "analysis";
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
  $("maturityDate")?.addEventListener("change", (e) => {
    state.maturityDate = e.target.value;
    if(state.maturityCompareDate===state.maturityDate)state.maturityCompareDate="";
    render();
  });
  $("maturityCompareDate")?.addEventListener("change", (e) => {
    state.maturityCompareDate = e.target.value;
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
    const shifts = f.elements.shifts.value
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!categories.length || shifts.length < 2) return toast("Précisez les catégories et au moins deux équipes de relève.");
    if (
      !commitData(() => {
        data.settings.escalationDays = Number(f.elements.days.value);
        for (const n of [2, 3, 4])
          data.settings.escalationOwners[n] =
            f.elements["owner" + n].value.trim();
        data.settings.categories = [...new Set(categories)];
        data.settings.shifts = [...new Set(shifts)];
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
  base.meta.demo_revision = 4;
  base.meta.demo_story = "Six sites fictifs, écarts reliés aux signaux, actions, problèmes, Kaizen et transferts.";
  const siteIds = base.sites.filter((s) => s.kind === "site").map((s) => s.id),
    periods = [-28, -21, -14, -7, 0];
  const profiles={
    "ag-deco":{trs:[78,79,80,81,82],scrap:[3.6,3.4,3.2,3,2.8],safety_signal:[0,0,0,0,0],service:[92,93,94,95,96],staffing:[95,96,96,97,98]},
    europlacage:{trs:[84,85,86,87,88],scrap:[2.9,2.7,2.5,2.4,2.2],safety_signal:[0,0,0,0,0],service:[96,96,97,97,98],staffing:[97,98,98,99,100]},
    marzin:{trs:[84,82,80,77,74],scrap:[3.1,3.5,4,4.6,5.2],safety_signal:[0,0,0,0,1],service:[96,95,94,92,89],staffing:[98,97,96,94,92]},
    "oraison-menuiserie":{trs:[76,77,78,79,80],scrap:[4,3.8,3.6,3.4,3.3],safety_signal:[0,0,0,0,0],service:[91,92,92,93,94],staffing:[93,94,94,95,96]},
    profiline:{trs:[82,83,84,86,87],scrap:[2.8,2.6,2.4,2.2,2.1],safety_signal:[0,0,0,0,0],service:[94,95,96,97,98],staffing:[97,97,98,99,100]},
    sodeplax:{trs:[80,80.5,81,82,83],scrap:[3.2,3.1,3,2.8,2.7],safety_signal:[0,0,0,0,0],service:[93,93,94,94,95],staffing:[95,95,96,96,97]}
  };
  for (const siteId of siteIds)
    for (const k of base.kpis)
      for (const [pi, days] of periods.entries()) {
        const value=profiles[siteId]?.[k.code]?.[pi],
          measure={
          id: uid("MES"),
          site_id: siteId,
          kpi_id: k.id,
          code: k.code,
          axis: k.axis,
          unit: k.unit,
          period: osDateOffset(days),
          value: +Number(value).toFixed(1),
          target: k.target,
          definition: k.definition,
          source: "Scénario industriel fictif",
          entry_mode: "demo",
          synced_at: now(),
        };
        base.measures.push(measure);
        const workshopId=base.workshops.find(w=>w.site_id===siteId)?.id;
        if(workshopId)base.measures.push({
          ...measure,
          id:uid("MES"),
          workshop_id:workshopId,
          source:"Relevé atelier fictif consolidé dans le scénario",
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
  base.signals = [
    {
      id: "S-041",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      zone: "Poste finition 2",
      type: "Sécurité",
      description:
        "Le carter mobile du rouleau d'entraînement ne se verrouille plus correctement.",
      severity: "Critique",
      state: "Nouveau",
      immediate_action:
        "Équipement arrêté, énergie consignée et zone balisée dans l'attente de la maintenance.",
      author: "Camille Martin · équipe matin",
      owner: "Mélanie Garnier · maintenance",
      response_due: today(),
      created_at: osDateOffset(0) + "T06:42:00Z",
      updated_at: osDateOffset(0) + "T06:48:00Z",
      action_id: "A-018",
      problem_id: null,
      kpi_id: "KPI-safety_signal",
      history: [
        {
          status: "Nouveau",
          note: "Poste mis en sécurité avant la remontée.",
          at: osDateOffset(0) + "T06:42:00Z",
        },
      ],
    },
    {
      id: "S-039",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      zone: "Contrôle finition",
      type: "Qualité",
      description:
        "Les défauts de surface sont passés de 3,1 % à 5,2 % en quatre semaines sur la famille panneaux.",
      severity: "Haute",
      state: "Action en cours",
      immediate_action:
        "Contrôle première pièce renforcé et lots douteux isolés avant expédition.",
      author: "Nadia Robert · contrôle qualité",
      owner: "Éric Lemoine · qualité",
      response_due: osDateOffset(-5),
      created_at: osDateOffset(-6) + "T14:20:00Z",
      updated_at: osDateOffset(-1) + "T15:05:00Z",
      taken_at: osDateOffset(-6) + "T14:48:00Z",
      action_id: "A-019",
      problem_id: "P-012",
      kpi_id: "KPI-scrap",
      history: [
        {
          status: "Nouveau",
          note: "Trois défauts identiques constatés sur le même lot.",
          at: osDateOffset(-6) + "T14:20:00Z",
        },
        {
          status: "Action en cours",
          note: "A3 ouvert et contrôle renforcé maintenu.",
          at: osDateOffset(-6) + "T14:48:00Z",
        },
      ],
    },
    {
      id: "S-AG-011",
      site_id: "ag-deco",
      workshop_id: "ag-deco-main",
      zone: "Préparation",
      type: "Standard",
      description:
        "Les outils de changement de teinte étaient répartis sur deux armoires.",
      severity: "Normale",
      state: "Vérifié",
      immediate_action: "Regroupement provisoire sur un chariot identifié.",
      author: "Sophie Bernard · production",
      owner: "Karim Benali · méthodes",
      response_due: osDateOffset(-16),
      created_at: osDateOffset(-19) + "T09:10:00Z",
      updated_at: osDateOffset(-4) + "T10:00:00Z",
      taken_at: osDateOffset(-19) + "T10:00:00Z",
      resolved_at: osDateOffset(-7) + "T15:00:00Z",
      action_id: "A-AG-011",
      problem_id: null,
      kpi_id: "KPI-trs",
    },
    {
      id: "S-ORA-008",
      site_id: "oraison-menuiserie",
      workshop_id: "oraison-main",
      zone: "Usinage",
      type: "Standard",
      description:
        "Deux remplaçants ne sont pas encore autonomes sur le contrôle de démarrage.",
      severity: "Normale",
      state: "Pris en compte",
      immediate_action:
        "Affectation temporaire avec un opérateur habilité sur chaque prise de poste.",
      author: "Lucie Faure · équipe après-midi",
      owner: "Thomas Rey · responsable production",
      response_due: osDateOffset(1),
      created_at: osDateOffset(-1) + "T13:35:00Z",
      updated_at: osDateOffset(-1) + "T14:05:00Z",
      taken_at: osDateOffset(-1) + "T14:05:00Z",
      action_id: "A-ORA-008",
      problem_id: null,
      kpi_id: "KPI-staffing",
    },
    {
      id: "S-SOD-006",
      site_id: "sodeplax",
      workshop_id: "sodeplax-main",
      zone: "Expédition",
      type: "Flux",
      description:
        "Les palettes terminées attendent en moyenne 70 minutes avant leur libération documentaire.",
      severity: "Haute",
      state: "Action en cours",
      immediate_action: "Créneau fixe de libération ajouté à 11 h et 15 h.",
      author: "Manon Roussel · logistique",
      owner: "Hugo Petit · logistique",
      response_due: osDateOffset(-2),
      created_at: osDateOffset(-3) + "T08:20:00Z",
      updated_at: osDateOffset(-1) + "T15:15:00Z",
      taken_at: osDateOffset(-3) + "T08:50:00Z",
      action_id: "A-SOD-006",
      problem_id: null,
      kpi_id: "KPI-service",
    },
  ];
  base.actions = [
    {
      id: "A-018",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Remplacer le verrouillage du carter et valider le redémarrage",
      owner: "Mélanie Garnier · maintenance",
      priority: "Critique",
      status: "Ouverte",
      progress: 20,
      due_date: today(),
      origin_type: "Signal",
      origin_id: "S-041",
      kpi_id: "KPI-safety_signal",
      objective_id: "OBJ-atelier",
      description:
        "Contrôler le dispositif complet, remplacer la pièce et faire valider la protection avant déconsignation.",
      effectiveness: null,
      created_at: osDateOffset(0) + "T06:49:00Z",
    },
    {
      id: "A-019",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Tester le support de pièce et confirmer la cause des défauts",
      owner: "Éric Lemoine · qualité",
      priority: "Haute",
      status: "En cours",
      progress: 55,
      due_date: osDateOffset(2),
      origin_type: "A3",
      origin_id: "P-012",
      problem_id: "P-012",
      kpi_id: "KPI-scrap",
      objective_id: "OBJ-atelier",
      description:
        "Comparer dix pièces avec le support actuel puis avec le support remis à la cote.",
      effectiveness: null,
      created_at: osDateOffset(-5) + "T09:00:00Z",
    },
    {
      id: "A-020",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Observer trois démarrages selon le standard révisé",
      owner: "Camille Martin · chef d'équipe",
      priority: "Normale",
      status: "À vérifier",
      progress: 90,
      due_date: osDateOffset(1),
      origin_type: "Audit",
      origin_id: "AUD-004",
      kpi_id: "KPI-trs",
      objective_id: "OBJ-atelier",
      description: "Tracer les temps, écarts et corrections sur trois séries.",
      effectiveness: null,
      created_at: osDateOffset(-8) + "T09:00:00Z",
    },
    {
      id: "A-AG-011",
      site_id: "ag-deco",
      workshop_id: "ag-deco-main",
      title: "Standardiser le chariot de changement de teinte",
      owner: "Karim Benali · méthodes",
      priority: "Normale",
      status: "Clôturée",
      progress: 100,
      due_date: osDateOffset(-7),
      origin_type: "Signal",
      origin_id: "S-AG-011",
      kpi_id: "KPI-trs",
      description: "Emplacement défini, photos du standard et contrôle sur cinq changements.",
      effectiveness: "Temps de recherche supprimé sur cinq changements consécutifs.",
      verifier: "Sophie Bernard · production",
      created_at: osDateOffset(-18) + "T10:00:00Z",
    },
    {
      id: "A-ORA-008",
      site_id: "oraison-menuiserie",
      workshop_id: "oraison-main",
      title: "Former et valider deux remplaçants au contrôle de démarrage",
      owner: "Thomas Rey · responsable production",
      priority: "Haute",
      status: "En cours",
      progress: 40,
      due_date: osDateOffset(6),
      origin_type: "Signal",
      origin_id: "S-ORA-008",
      kpi_id: "KPI-staffing",
      description: "Deux mises en situation et une validation au poste par personne.",
      effectiveness: null,
      created_at: osDateOffset(-1) + "T14:10:00Z",
    },
    {
      id: "A-SOD-006",
      site_id: "sodeplax",
      workshop_id: "sodeplax-main",
      title: "Tester deux créneaux fixes de libération des palettes",
      owner: "Hugo Petit · logistique",
      priority: "Haute",
      status: "En cours",
      progress: 65,
      due_date: osDateOffset(3),
      origin_type: "Signal",
      origin_id: "S-SOD-006",
      kpi_id: "KPI-service",
      description: "Mesurer l'attente de chaque palette pendant cinq jours.",
      effectiveness: null,
      created_at: osDateOffset(-3) + "T09:00:00Z",
    },
  ];
  base.problems = [
    {
      id: "P-012",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Défauts de surface récurrents sur la famille panneaux",
      method: "A3",
      status: "Analyse",
      owner: "Éric Lemoine · qualité",
      kpi_id: "KPI-scrap",
      signal_ids: ["S-039"],
      action_ids: ["A-019"],
      created_at: osDateOffset(-6) + "T16:00:00Z",
      content: {
        context:
          "Le rebut augmente depuis quatre semaines sur la finition des panneaux, alors que les autres familles restent stables.",
        background:
          "La dérive crée des retouches, retarde les expéditions et dégrade le TRS du poste.",
        current:
          "Rebut passé de 3,1 % à 5,2 % ; 68 % des défauts observés sur la référence P42, côté support.",
        target:
          "Revenir à 3 % maximum pendant quatre semaines consécutives sans renforcer le contrôle final.",
        analysis:
          "Pareto par référence et face ; comparaison des réglages, supports et équipes.",
        causes:
          "Le support de la référence P42 présente une variation de hauteur après échauffement.",
        root_cause:
          "Cause à confirmer par essai croisé support actuel / support remis à la cote.",
        countermeasures:
          "Remise à la cote, contrôle première pièce et repère visuel de positionnement.",
        actions: "A-019 · Essai croisé sur dix pièces.",
        verification:
          "Mesurer le rebut P42 et le temps de réglage après l'essai.",
        effectiveness:
          "Validation attendue après quatre semaines sous 3 %.",
        standard:
          "Mettre à jour la fiche de réglage et former les trois équipes si la cause est confirmée.",
        learning:
          "Comparer ensuite avec le standard première pièce de Profiline.",
      },
    },
  ];
  base.projects = [
    {
      id: "CH-006",
      site_id: "marzin",
      title: "Réduire le changement de série finition",
      method: "SMED",
      status: "Mesure",
      owner: "Amandine Colin · méthodes",
      progress: 45,
      target_date: osDateOffset(49),
      baseline: "52 min sur les huit derniers changements",
      target: "35 min, première pièce conforme incluse",
      result: "Séquence filmée ; opérations internes et externes séparées.",
      problem_id: null,
      action_ids: [],
      objective_id: "OBJ-site",
      kpi_id: "KPI-trs",
      created_at: osDateOffset(-25) + "T09:00:00Z",
    },
    {
      id: "CH-007",
      site_id: "marzin",
      title: "Stabiliser le flux avant contrôle finition",
      method: "VSM",
      status: "Analyse",
      owner: "Louis Perrin · production",
      progress: 30,
      target_date: osDateOffset(70),
      baseline: "190 pièces d'encours et 225 min d'attente cumulée",
      target: "FIFO 60 pièces maximum et attente inférieure à 90 min",
      result: "État actuel validé ; état futur à arbitrer.",
      problem_id: "P-012",
      action_ids: ["A-019"],
      objective_id: "OBJ-site",
      kpi_id: "KPI-service",
      source_id: "DOC-VSM-demo",
      created_at: osDateOffset(-14) + "T09:00:00Z",
    },
  ];
  base.decisions = [
    {
      id: "D-007",
      site_id: "marzin",
      title: "Autoriser le remplacement complet du verrouillage de sécurité",
      detail:
        "Le diagnostic recommande le remplacement de l'ensemble plutôt qu'une réparation provisoire ; arrêt estimé à trois heures.",
      owner: "Claire Dubois · direction de site",
      due_date: today(),
      status: "Ouverte",
      origin_id: "TOP-MAR-001",
    },
    {
      id: "D-008",
      site_id: "group",
      title: "Affecter un référent Profiline au pilote Marzin",
      detail:
        "Deux demi-journées sont demandées pour adapter le standard de contrôle première pièce sans copier le procédé à l'identique.",
      owner: "Direction Générale",
      due_date: osDateOffset(3),
      status: "Ouverte",
      origin_id: "TOP-MAR-002",
    },
  ];
  base.audits = [
    {
      id: "AUD-004",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      type: "5S",
      scope: "Finition · préparation de série",
      score: 68,
      status: "Terminé",
      performed_at: osDateOffset(-9),
      owner: "Camille Martin · auditrice interne",
      evidence:
        "Photos du poste, observation de deux changements et entretien avec l'équipe.",
    },
    {
      id: "AUD-PRO-012",
      site_id: "profiline",
      workshop_id: "profiline-main",
      type: "Lean",
      scope: "Contrôle première pièce",
      score: 86,
      status: "Terminé",
      performed_at: osDateOffset(-18),
      owner: "Nora Le Gall · opératrice référente",
      evidence:
        "Standard versionné, cinq dossiers de lot et observation sur deux équipes.",
    },
  ];
  base.gembas = [
    {
      id: "G-014",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      zone: "Contrôle finition",
      objective: "Comprendre où naissent les défauts P42",
      finding:
        "Le standard est disponible, mais le repère de hauteur du support n'est pas visible au poste.",
      category: "Standard",
      created_at: osDateOffset(-5) + "T09:12:00Z",
      author: "Claire Dubois · direction de site",
    },
    {
      id: "G-PRO-009",
      site_id: "profiline",
      workshop_id: "profiline-main",
      zone: "Démarrage de ligne",
      objective: "Vérifier la tenue du contrôle première pièce",
      finding:
        "L'opérateur compare la première pièce à un échantillon maître et signe le dossier avant de libérer le lot.",
      category: "Standard",
      created_at: osDateOffset(-16) + "T08:30:00Z",
      author: "Responsable Lean Groupe",
    },
  ];
  base.kaizens = [
    {
      id: "KAI-demo",
      site_id: "marzin",
      title: "Repère de positionnement du support P42",
      problem:
        "Le support est repositionné à l'œil après nettoyage, ce qui augmente les réglages et les défauts.",
      solution:
        "Tester une butée réglable, un repère de hauteur et un contrôle première pièce.",
      status: "Mise en œuvre",
      owner: "Camille Martin · équipe finition",
      kpi_id: "KPI-scrap",
      source_id: "S-039",
      validated_by: "Pilote site",
      due_date: osDateOffset(7),
    },
    {
      id: "KAI-PRO-001",
      site_id: "profiline",
      workshop_id: "profiline-main",
      title: "Validation première pièce au point d'usage",
      problem:
        "Le lot pouvait démarrer avant le retour du contrôle, générant une attente et un risque de série non conforme.",
      solution:
        "Échantillon maître, repères de réglage et validation par l'opérateur avant libération du lot.",
      status: "Bonne pratique",
      owner: "Nora Le Gall · opératrice référente",
      kpi_id: "KPI-trs",
      result: "TRS passé de 82 % à 87 % et rebut stabilisé à 2,1 %.",
      validated_by: "Responsable qualité Profiline",
      due_date: osDateOffset(-14),
    },
    {
      id: "KAI-AG-004",
      site_id: "ag-deco",
      workshop_id: "ag-deco-main",
      title: "Chariot de changement de teinte",
      problem: "Les outils étaient répartis sur deux armoires.",
      solution: "Un chariot visuel préparé avant chaque changement.",
      status: "Gain validé",
      owner: "Karim Benali · méthodes",
      kpi_id: "KPI-trs",
      source_id: "S-AG-011",
      result: "12 minutes gagnées par changement sur cinq observations.",
      validated_by: "Sophie Bernard · production",
      due_date: osDateOffset(-4),
    },
  ];
  base.practices = [{
    id: "BP-transfert",
    site_id: "profiline",
    title: "Réglage standard et contrôle première pièce",
    category: "Production",
    summary:
      "Repères de réglage et validation de la première pièce avant le lot.",
    evidence:
      "Cinq semaines mesurées : TRS de 82 % à 87 %, rebut de 2,8 % à 2,1 %.",
    transfer:
      "Vérifier la famille produit, créer un échantillon maître local et faire valider le standard par les opérateurs.",
    status: "Publiée",
    validated_by: "Responsable qualité Profiline",
    owner: "Nora Le Gall · opératrice référente",
    kpi_id: "KPI-trs",
    source_id: "KAI-PRO-001",
  }];
  base.deployments = [
    {
      id: "DEP-demo",
      site_id: "marzin",
      practice_id: "BP-transfert",
      owner: "Camille Martin · chef d'équipe",
      due_date: osDateOffset(14),
      status: "Test",
      prerequisites: "Tester sur la même famille, adapter les repères.",
      result: "Échantillon maître local créé ; essai prévu sur la référence P42.",
      evidence: "Compte rendu du Gemba G-014 et protocole d'essai A-019.",
    },
    {
      id: "DEP-AG-001",
      site_id: "ag-deco",
      practice_id: "BP-transfert",
      owner: "Karim Benali · méthodes",
      due_date: osDateOffset(21),
      status: "Candidate",
      prerequisites: "Adapter les repères à la préparation des teintes.",
      result: "Applicabilité validée en revue site ; pilote non démarré.",
    },
  ];
  base.gains = [
    {
      id: "GAIN-PRO-001",
      site_id: "profiline",
      source_id: "KAI-PRO-001",
      kpi_id: "KPI-trs",
      title: "Temps de démarrage évité",
      before: 24,
      after: 14,
      direction: "low",
      quantity: 18,
      unit: "min",
      period: "4 semaines",
      evidence: "Chronométrage de 18 changements, même famille de produits.",
      validated_by: "Responsable qualité Profiline",
      status: "Validé",
    },
    {
      id: "GAIN-AG-004",
      site_id: "ag-deco",
      source_id: "KAI-AG-004",
      kpi_id: "KPI-trs",
      title: "Temps de recherche d'outils évité",
      before: 16,
      after: 4,
      direction: "low",
      quantity: 5,
      unit: "min",
      period: "5 changements observés",
      evidence: "Cinq changements chronométrés avant et après le chariot.",
      validated_by: "Sophie Bernard · production",
      status: "Validé",
    },
  ];
  base.maturity = [];
  const maturityDates = [osDateOffset(-180), osDateOffset(-90), today()],
    maturityLift = {
      "ag-deco": [0, 0, 1],
      europlacage: [0, 1, 1],
      marzin: [0, 1, 0],
      "oraison-menuiserie": [0, 0, 1],
      profiline: [0, 1, 2],
      sodeplax: [0, 0, 1],
    };
  for (const [si, s] of siteIds.entries())
    for (const [ci, date] of maturityDates.entries())
      for (const [pi, pillar] of base.settings.pillars.entries()) {
        const baseline = 1 + ((si + pi) % 3),
          localProgress = ci === 2 && (si + pi) % 5 === 0 ? 1 : 0,
          localRegression = s === "marzin" && ci === 2 && pi < 2 ? 1 : 0,
          level = Math.max(
            1,
            Math.min(
              5,
              baseline + maturityLift[s][ci] + localProgress - localRegression,
            ),
          );
        base.maturity.push({
          id: `MAT-${s}-${ci + 1}-${pi + 1}`,
          site_id: s,
          pillar,
          level,
          target: 4,
          date,
          owner: "Binôme site / Lean Groupe",
          evidence:
            ci === 2
              ? "Observation terrain, standards échantillonnés et entretien avec l'équipe."
              : "Campagne historique fictive conservée pour comparaison.",
          next_step:
            level < 4
              ? "Choisir une pratique observable et vérifier sa tenue à la prochaine campagne."
              : "Maintenir le standard et partager la preuve au réseau.",
        });
      }
  base.routines = [
    {
      id: "RIT-demo",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "TOP 15 quotidien · finition",
      level: 1,
      frequency: "Quotidien",
      owner: "Camille Martin · chef d'équipe",
      date: today(),
      status: "Prévu",
    },
    {
      id: "RIT-SITE-demo",
      site_id: "marzin",
      title: "Revue hebdomadaire du site",
      level: 3,
      frequency: "Hebdomadaire",
      owner: "Claire Dubois · direction de site",
      date: osDateOffset(2),
      participants: "Production, qualité, maintenance, RH et Lean Groupe",
      minutes:
        "Arbitrer la sécurité, examiner l'A3 P-012 et confirmer les ressources du pilote Profiline.",
      status: "Prévu",
    },
    {
      id: "RIT-GRP-demo",
      site_id: "group",
      title: "Revue SQCDP Groupe",
      level: 4,
      frequency: "Hebdomadaire",
      owner: "Responsable Lean Groupe",
      date: osDateOffset(4),
      participants: "Direction Générale et directions de site",
      minutes:
        "Comparer les tendances, décider des soutiens et suivre les transferts intersites.",
      status: "Prévu",
    },
  ];
  base.handovers = [
    {
      id: "REL-MAR-001",
      site_id: "marzin",
      workshop_id: "marzin-pilot",
      title: "Relève Nuit → Matin",
      shift_from: "Nuit",
      shift_to: "Matin",
      period: today() + "T05:50",
      author: "Lucas Perrin · chef d’équipe nuit",
      status: "Transmise",
      situation: "Poste finition 2 consigné ; les autres équipements ont produit selon le programme.",
      safety: "Ne pas redémarrer la finition 2 avant validation du carter.",
      quality: "Maintenir le contrôle renforcé sur la famille panneaux.",
      staffing: "Équipe complète ; maintenance attendue à 07:15.",
      production: "Ordre OF-245 poursuivi sur la ligne 1.",
      priorities: "1. Valider le carter. 2. Suivre l’essai support P42. 3. Confirmer le plan de rattrapage.",
      linked_ids: ["S-041", "A-018", "P-012"],
      acknowledged_by: null,
      acknowledged_at: null,
      created_at: today() + "T05:50:00Z",
      updated_at: today() + "T05:50:00Z",
      history: [{status:"Transmise",note:"Relève préparée avec les dossiers critiques.",at:today()+"T05:50:00Z"}],
    },
  ];
  base.escalations = [
    {
      id: "ESC-demo",
      site_id: "marzin",
      source_id: "A-018",
      title: "Décider du remplacement du verrouillage de sécurité",
      level: 3,
      owner: "Claire Dubois · direction de site",
      due_date: today(),
      detail: "Poste arrêté ; délai fournisseur compatible avec un redémarrage cet après-midi.",
      result: "",
      status: "Ouverte",
    },
  ];
  base.topics = [
    {
      id: "TOP-MAR-001",
      site_id: "marzin",
      title: "Poste finition 2 arrêté après signal sécurité",
      axis: "S",
      owner: "Mélanie Garnier · maintenance",
      due_date: today(),
      priority: "Critique",
      linked_id: "S-041",
      escalation_id: "D-007",
      status: "En cours",
      decision: "Maintenir la consignation jusqu'à validation du carter.",
      created_at: osDateOffset(0) + "T06:55:00Z",
      updated_at: osDateOffset(0) + "T07:05:00Z",
    },
    {
      id: "TOP-MAR-002",
      site_id: "marzin",
      title: "Rebut panneaux à 5,2 % : essai support P42",
      axis: "Q",
      owner: "Éric Lemoine · qualité",
      due_date: osDateOffset(2),
      priority: "Haute",
      linked_id: "P-012",
      escalation_id: "D-008",
      status: "En cours",
      decision: "Essai croisé planifié ; appui Profiline demandé.",
      created_at: osDateOffset(-5) + "T08:30:00Z",
      updated_at: osDateOffset(-1) + "T16:00:00Z",
    },
    {
      id: "TOP-ORA-001",
      site_id: "oraison-menuiserie",
      title: "Couverture compétences usinage à 96 %",
      axis: "P",
      owner: "Thomas Rey · responsable production",
      due_date: osDateOffset(6),
      priority: "Haute",
      linked_id: "S-ORA-008",
      status: "En cours",
      decision: "Deux validations au poste programmées.",
      created_at: osDateOffset(-1) + "T14:15:00Z",
      updated_at: osDateOffset(-1) + "T14:15:00Z",
    },
    {
      id: "TOP-SOD-001",
      site_id: "sodeplax",
      title: "Attente documentaire avant expédition",
      axis: "D",
      owner: "Hugo Petit · logistique",
      due_date: osDateOffset(3),
      priority: "Haute",
      linked_id: "S-SOD-006",
      status: "En cours",
      decision: "Test de deux créneaux fixes pendant cinq jours.",
      created_at: osDateOffset(-3) + "T09:05:00Z",
      updated_at: osDateOffset(-1) + "T15:20:00Z",
    },
  ];
  base.links = [
    { id: "L-demo-1", from: "S-039", to: "P-012", type: "Origine" },
    { id: "L-demo-2", from: "P-012", to: "A-019", type: "Action" },
    { id: "L-demo-3", from: "KAI-PRO-001", to: "BP-transfert", type: "Standardisation" },
    { id: "L-demo-4", from: "BP-transfert", to: "DEP-demo", type: "Transfert" },
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
