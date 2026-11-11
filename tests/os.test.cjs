const { test } = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers.cjs");
function fields(a, values, form = "#osForm") {
  for (const [name, value] of Object.entries(values))
    a.fill(`${form} [name="${name}"]`, String(value));
}
function demo(a) {
  a.run(
    'pnUseClean=false;data=osFreshData(true);osInit();state.site="group";state.role="lean";render()',
  );
}
function closeAction(a, id) {
  a.run(`actionForm(data.actions.find(x=>x.id===${JSON.stringify(id)}))`);
  a.fill("#actionStatus", "Clôturée");
  a.fill("#actionEvidence", "Résultat stable sur trois séries contrôlées");
  a.fill("#actionVerifier", "Qualité");
  a.submit("#actionForm");
  assert.equal(
    a.run(`data.actions.find(x=>x.id===${JSON.stringify(id)}).status`),
    "Clôturée",
  );
}

test("Migration 6 → 7 idempotente, données/photos conservées et retour disponible", (t) => {
  const a = app(t),
    raw = a.run("JSON.stringify(DEMO)"),
    b = app(t, raw);
  assert.equal(b.run("data.meta.schema"), 7);
  assert.equal(b.run("data.actions[0].id"), "A-018");
  assert.equal(
    b.run('localStorage.getItem(STORAGE_KEY+"-before-lean-os")'),
    raw,
  );
  const migrated = b.stored(),
    c = app(t, migrated);
  assert.equal(c.run("data.auditTemplates.length"), 2);
  assert.equal(c.run("data.meta.schema"), 7);
  assert.equal(c.run("data.kpis.length"), 5);
  assert.equal(
    c.run("JSON.stringify(migrateOS(data))===JSON.stringify(data)"),
    true,
  );
  assert.throws(() =>
    c.run(
      'const broken=clone(data);broken.links.push({id:"bad",from:"A-018",to:"missing"});validateImport(broken)',
    ),
  );
});

test("A · observation Gemba → action unique → SQCDP → escalade sans doublon → clôture", (t) => {
  const a = app(t);
  a.run('state.site="marzin";gembaForm()');
  a.fill("#jnZone", "Finition");
  a.fill("#jnQuestion", "Comprendre les réglages répétés");
  a.submit("#jnStartForm");
  const id = a.run("data.gembas[0].id");
  a.run(`gembaObservationForm("${id}")`);
  a.fill("#observationFact", "Les gabarits sont mélangés");
  a.fill("#observationDecision", "Action");
  a.fill("#observationAction", "Séparer les gabarits");
  a.fill("#observationOwner", "Production");
  a.fill("#observationDue", "2026-01-01");
  a.fill("#osRel_kpi_id", "KPI-trs");
  a.submit("#observationForm");
  const action = a.run("data.actions[0].id");
  assert.equal(a.run("data.actions[0].kpi_id"), "KPI-trs");
  a.run('closeModal();state.view="sqcdp";render()');
  assert.match(a.q("#appView").textContent, /Séparer les gabarits/);
  a.run('state.view="daily";render()');
  a.click('[data-os="escalate"]');
  assert.ok(a.run(`data.escalations.some(e=>e.source_id==='${action}')`));
  const count = a.run("data.escalations.length");
  a.click('[data-os="escalate"]');
  assert.equal(a.run("data.escalations.length"), count);
  closeAction(a, action);
  assert.equal(
    a.run(`osEscalationCandidates().some(e=>e.action.id==='${action}')`),
    false,
  );
  const b = app(t, a.stored());
  assert.equal(b.run(`data.actions.filter(x=>x.id==='${action}').length`), 1);
});

test("B · dérive KPI → A3 relié → action → résultat, lecture après rechargement", (t) => {
  const a = app(t);
  demo(a);
  a.run('osKpiDetail("marzin","KPI-trs")');
  a.click('[data-os="kpiProblem"]');
  a.fill("#problemOwner", "Méthodes");
  a.submit("#problemForm");
  const pid = a.run("data.problems[0].id");
  assert.equal(a.run("data.problems[0].kpi_id"), "KPI-trs");
  a.run('closeModal();osCreateFrom(data.problems[0].id,"action")');
  a.fill("#actionTitle", "Tester la butée");
  a.fill("#actionOwner", "Méthodes");
  a.submit("#actionForm");
  const aid = a.run("data.actions[0].id");
  closeAction(a, aid);
  a.run(`editProblem('${pid}')`);
  const doc = a.run(`data.documents.find(d=>d.problem_id==='${pid}').id`);
  const keys = Array.from(a.run("DOCUMENT_SCHEMAS.A3.fields.map(x=>x[0])"));
  for (let i = 0; i < keys.length; i++) {
    a.run(`mdGuided('${doc}',${i})`);
    a.fill(
      "[data-doc-field]",
      "Fait mesuré, essai réalisé, résultat documenté",
    );
    if (i < keys.length - 1) a.click(`[data-doc-go="${i + 1}"]`);
  }
  a.fill("#editDocumentStatus", "Validé");
  a.fill("#documentProblemStatus", "Clos");
  a.submit("#editDocumentForm");
  assert.equal(a.run(`data.problems.find(p=>p.id==='${pid}').status`), "Clos");
  const b = app(t, a.stored());
  assert.equal(
    b.run(`osRelations('${pid}').some(r=>r.row.id==='KPI-trs')`),
    true,
  );
  assert.equal(
    b.run(`data.actions.find(a=>a.id==='${aid}').effectiveness`),
    "Résultat stable sur trois séries contrôlées",
  );
});

test("C · VSM graphique → opportunité → projet/action → résultat, calculs explicites", (t) => {
  const a = app(t);
  demo(a);
  a.run('osVsmForm(data.documents.find(d=>d.type==="VSM"))');
  assert.equal(a.all("[data-vsm-graphic]").length, 3);
  a.fill('#osVsmNode [name="ct"]', "70");
  a.submit("#osVsmNode");
  assert.equal(
    a.run('data.documents.find(d=>d.type==="VSM").vsm.current.nodes[0].ct'),
    70,
  );
  const metrics = JSON.parse(
    a.run(
      'JSON.stringify(osVsmMetrics(data.documents.find(d=>d.type==="VSM").vsm.current))',
    ),
  );
  assert.equal(metrics.takt, 70);
  assert.equal(metrics.capacity, 283);
  assert.equal(metrics.va, 105);
  assert.equal(metrics.lead, 13685);
  a.click('[data-os="vsmOpportunity"]');
  a.click('[data-os="vsmCreate"][data-args*="projects"]');
  a.fill("#projectOwner", "VSL");
  a.submit("#projectForm");
  assert.equal(a.run("data.projects[0].source_id"), "DOC-VSM-demo");
  const project = a.run("data.projects[0].id");
  a.run(`osCreateFrom('${project}',"action")`);
  a.fill("#actionTitle", "Tester un flux FIFO");
  a.fill("#actionOwner", "Production");
  a.submit("#actionForm");
  const action = a.run("data.actions[0].id");
  closeAction(a, action);
  a.run(`projectForm(data.projects.find(p=>p.id==='${project}'))`);
  a.fill("#projectStatus", "Clos");
  a.fill("#projectResult", "Encours réduit et délai stabilisé sur 5 lots");
  a.fill("#projectProgress", "100");
  a.submit("#projectForm");
  assert.equal(
    a.run(`data.projects.find(p=>p.id==='${project}').status`),
    "Clos",
  );
  assert.equal(
    a.run(
      'osVsmMetrics({available_minutes:420,demand_per_day:360,nodes:[{type:"process",ct:80}]}).lead',
    ),
    null,
  );
});

test("D · Kaizen → Avant/Après → gain validé → pratique → transfert autre site", (t) => {
  const a = app(t);
  demo(a);
  a.run(
    'state.site="marzin";osForm("kaizens",null,{title:"Butée",problem:"Réglages répétés",owner:"Équipe",status:"Idée"})',
  );
  a.submit("#osForm");
  const id = a.run("data.kaizens[0].id");
  assert.notEqual(id, "KAI-demo");
  a.run(`beforeAfterForm(null,{source_id:'${id}',kaizen_id:'${id}'})`);
  a.fill("#baTitle", "Butée avant après");
  // Two previously prepared images are provided as form initial values; compression is covered separately.
  a.run(
    `closeModal();beforeAfterForm({id:null,site_id:'marzin',source_id:'${id}',kaizen_id:'${id}',title:'Butée avant après',structured_data:{before_photo:'data:image/png;base64,AAAA',after_photo:'data:image/png;base64,BBBB'}})`,
  );
  a.fill("#baDescription", "Réglage guidé, dix minutes évitées par série");
  a.submit("#beforeAfterForm");
  assert.equal(a.run("data.documents[0].kaizen_id"), id);
  a.run(
    `osForm('gains',null,{source_id:'${id}',title:'Temps de réglage',site_id:'marzin'})`,
  );
  fields(a, {
    before: 20,
    after: 10,
    direction: "low",
    quantity: 10,
    unit: "min",
    period: "Semaine témoin",
    evidence: "Dix séries chronométrées",
    status: "Validé",
    validated_by: "Méthodes",
  });
  a.submit("#osForm");
  assert.equal(a.run("osGainValue(data.gains[0])"), 100);
  assert.equal(a.run("data.gains[0].status"), "Validé");
  a.run(`osCreateFrom('${id}','practice')`);
  a.fill("#bpTitle", "Butée de réglage");
  a.fill("#bpSummary", "Utiliser une butée au changement de série");
  a.submit("#bpNewForm");
  a.click("[data-bp-full]");
  assert.equal(a.q("#practiceTitle").value, "Butée de réglage");
  a.fill("#practiceEvidence", "100 minutes gagnées sur dix séries");
  a.fill("#practiceTransfer", "Valider les tolérances et former au standard");
  a.fill("#practiceStatus", "Publiée");
  a.fill("#practiceValidator", "Qualité");
  a.fill("#osRel_kpi_id", "KPI-trs");
  a.submit("#practiceForm");
  const practice = a.run("data.practices[0].id");
  assert.equal(a.run("data.practices[0].source_id"), id);
  a.run(
    `osForm('deployments',null,{practice_id:'${practice}',site_id:'ag-deco'})`,
  );
  fields(a, {
    owner: "Pilote local",
    due_date: "2026-12-01",
    prerequisites: "Vérifier les interfaces",
    status: "Déployée",
    result: "Test concluant sur dix séries",
    evidence: "Relevé lot A-10",
    validated_by: "Qualité locale",
  });
  a.submit("#osForm");
  assert.equal(a.run("data.deployments[0].status"), "Déployée");
  assert.equal(a.run("data.deployments[0].practice_id"), practice);
  const b = app(t, a.stored());
  assert.equal(b.run("data.deployments[0].site_id"), "ag-deco");
  assert.equal(b.run('osValidatedGains()["min · Semaine témoin"]'), 100);
});

test("E · objectif Hoshin → KPI → projet → action → efficacité et navigation inverse", (t) => {
  const a = app(t);
  demo(a);
  a.run(
    'state.site="marzin";projectForm(null,{title:"Réduire les pertes",owner:"Pilote",objective_id:"OBJ-site",kpi_id:"KPI-trs"})',
  );
  a.submit("#projectForm");
  const project = a.run("data.projects[0].id");
  a.run(`osCreateFrom('${project}','action')`);
  a.fill("#actionTitle", "Valider le réglage");
  a.fill("#actionOwner", "Atelier");
  a.submit("#actionForm");
  const action = a.run("data.actions[0].id");
  assert.ok(a.run('osObjectiveProgress("OBJ-site").total') >= 1);
  closeAction(a, action);
  assert.ok(a.run('osObjectiveProgress("OBJ-site").closed') >= 1);
  a.run(`osOpenTrace('${action}')`);
  assert.match(a.q("#modalContent").textContent, /Stabiliser le poste/);
  assert.match(a.q("#modalContent").textContent, /TRS/);
  const before = a.run("data.objectives.length");
  a.run(
    'closeModal();osForm("objectives",null,{title:"Cycle",site_id:"group",level:"Axe stratégique",parent_id:"OBJ-site",owner:"Groupe",year:2026,due_date:"2026-12-01",status:"En cours"})',
  );
  a.submit("#osForm");
  assert.equal(a.run("data.objectives.length"), before);
  assert.match(a.q("#toast").textContent, /supérieur/);
});

test("F · audit paramétrable → preuve obligatoire → écart → action vérifiée", (t) => {
  const a = app(t);
  a.run('state.site="marzin";osAuditStart()');
  fields(
    a,
    { template: "QST-5s", scope: "Zone outils", owner: "Auditeur" },
    "#osAuditStart",
  );
  a.submit("#osAuditStart");
  const id = a.run("data.audits.at(-1).id");
  for (let i = 0; i < 5; i++)
    a.fill(`#osAudit [name="score${i}"]`, i ? "4" : "1");
  a.submit("#osAudit");
  assert.equal(
    a.run(`data.audits.find(a=>a.id==='${id}').status`),
    "Brouillon",
  );
  assert.match(a.q("#toast").textContent, /preuve/);
  for (let i = 0; i < 5; i++)
    a.fill(
      `#osAudit [name="proof${i}"]`,
      "Observation constatée et photo référencée",
    );
  a.submit("#osAudit");
  assert.equal(a.run(`data.audits.find(a=>a.id==='${id}').score`), 68);
  assert.ok(
    a.run(
      `Object.keys(data.audits.find(a=>a.id==='${id}').audit_data.domain_scores).length`,
    ) > 0,
  );
  const aid = a.run(`data.actions.find(a=>a.origin_id==='${id}').id`);
  a.run("closeModal()");
  closeAction(a, aid);
  assert.equal(a.run(`linkedActions('${id}').filter(isOpenAction).length`), 0);
});

test("G · benchmark → site en difficulté → pratique validée ailleurs, sans causalité inventée", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.view="pilotage";state.osTab="tower";render()');
  assert.equal(a.all(".os-kpi-cell").length, 0);
  assert.ok(a.all(".in-cell.gap, .in-cell.warn").length >= 5);
  assert.match(a.q("#appView").textContent, /Pilotage · Analyser/);
  assert.match(a.q("#appView").textContent, /Décider/);
  const result = JSON.parse(
    a.run(
      'JSON.stringify(osSuggestions("marzin").find(s=>s.kpi_id==="KPI-trs"))',
    ),
  );
  assert.ok(result.practices.includes("BP-transfert"));
  assert.equal(result.basis.length, 5);
  assert.match(a.q("#appView").textContent, /À creuser/);
  assert.match(a.q(".in-drifts").textContent, /Pratique validée ailleurs/);
  a.run('osOpenTrace("BP-transfert")');
  assert.match(a.q("#modalContent").textContent, /TRS/);
});

test("Imports CSV atomiques, doublons et dates invalides refusés, seuils paramétrables", (t) => {
  const a = app(t);
  const csv =
    'site_id;code;period;value;target;definition;source\nmarzin;trs;2026-09-01;80;85;"Ligne; A";ERP';
  const check = JSON.parse(
    a.run(
      `JSON.stringify(osValidateMeasurements(osParseCSV(${JSON.stringify(csv)})))`,
    ),
  );
  assert.equal(check.errors.length, 0);
  assert.equal(check.accepted[0].definition, "Ligne; A");
  a.run(
    `commitData(()=>data.measures.push(...osValidateMeasurements(osParseCSV(${JSON.stringify(csv)})).accepted))`,
  );
  assert.equal(
    a.run(
      `osValidateMeasurements(osParseCSV(${JSON.stringify(csv)})).errors.length`,
    ),
    1,
  );
  assert.equal(
    a.run(
      `osValidateMeasurements([{site_id:'marzin',code:'trs',period:'2026-02-31',value:80,definition:'Atelier'}]).errors.length`,
    ),
    1,
  );
  a.run('data.kpis.find(k=>k.code==="trs").orange=82');
  assert.equal(
    a.run('osStatus({value:80,target:85,definition:"Atelier",code:"trs"})'),
    "gap",
  );
  a.run('data.kpis.find(k=>k.code==="trs").orange=75');
  assert.equal(
    a.run('osStatus({value:80,target:85,definition:"Atelier",code:"trs"})'),
    "warn",
  );
});

test("Profils lecture seule, archivage réversible, journal et intégrité", (t) => {
  const a = app(t);
  a.run('state.role="dg"');
  assert.equal(a.run('commitData(()=>data.actions[0].title="Écrasé")'), false);
  assert.notEqual(a.run("data.actions[0].title"), "Écrasé");
  a.run('state.role="lean"');
  assert.equal(a.run('commitData(()=>osArchive("A-018"))'), true);
  assert.equal(a.run('scoped(data.actions).some(a=>a.id==="A-018")'), false);
  assert.ok(
    a.run(
      'data.activity.some(e=>e.record_id==="A-018"&&e.event==="Archivage")',
    ),
  );
  assert.equal(
    a.run(
      'commitData(()=>delete data.actions.find(a=>a.id==="A-018").archived_at)',
    ),
    true,
  );
  assert.equal(a.run('commitData(()=>osArchive("marzin"))'), false);
  a.run(
    'closeModal();state.site="group";state.view="settings";state.adminTab="kpis";render()',
  );
  a.click('[data-os="edit"]');
  assert.ok(a.q('#osForm [name="definition"]'));
});

test("Périmètres atelier/site distincts, seuils et historique des corrections", (t) => {
  const a = app(t);
  demo(a);
  a.run(
    'commitData(()=>data.measures.push({id:"MES-atelier",site_id:"marzin",workshop_id:"marzin-pilot",kpi_id:"KPI-trs",code:"trs",period:today(),value:99,target:85,definition:"Atelier seul",source:"Essai"}))',
  );
  assert.equal(a.run('osLatest("marzin","KPI-trs").value'), 74);
  assert.equal(
    a.run('osLatest("marzin","KPI-trs",null,"marzin-pilot").value'),
    99,
  );
  a.run('commitData(()=>data.measures.find(m=>m.id==="MES-atelier").value=88)');
  assert.equal(a.run("data.activity.at(-1).changes.value.before"), 99);
  assert.equal(a.run("data.activity.at(-1).changes.value.after"), 88);
  a.run('data.kpis.find(k=>k.code==="trs").green=90');
  assert.equal(
    a.run('osStatus({value:87,target:85,definition:"Site",code:"trs"})'),
    "warn",
  );
  a.run('state.workshop="marzin-pilot"');
  assert.equal(a.run('scoped([{id:"unassigned",site_id:"marzin"}]).length'), 0);
});

test("Action depuis le graphique historique : vraie relation KPI, sauvegarde et relecture", (t) => {
  const a = app(t);
  demo(a);
  a.run(
    'state.site="marzin";state.view="pilotage";state.osTab="detail";render()',
  );
  a.click('[data-kpi-action="trs"]');
  a.fill("#actionOwner", "Pilote TRS");
  a.submit("#actionForm");
  assert.equal(a.run("data.actions[0].origin_id"), "KPI-trs");
  const b = app(t, a.stored());
  assert.equal(b.run("data.actions[0].kpi_id"), "KPI-trs");
});

test("VSM consultable en lecture seule et imports de géométrie invalides refusés", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="dg";editDocument("DOC-VSM-demo")');
  assert.ok(a.q(".vf-map"), "La VSM s’ouvre sur la carte normalisée");
  a.click('button[data-vf-tab="flux"]');
  assert.ok(a.all("[data-vf-f]").length && a.all("[data-vf-f]").every((x) => x.disabled), "Lecture seule");
  assert.ok(!a.q("[data-vf-add]"));
  a.click("[data-vf-free]");
  assert.ok(a.q("#osVsmCanvas"));
  assert.equal(a.q('#osVsmNode [name="ct"]').disabled, true);
  assert.equal(a.all("[data-vsm-add]").length, 0);
  assert.throws(() =>
    a.run(
      'const broken=clone(data);broken.documents.find(d=>d.id==="DOC-VSM-demo").vsm.current.nodes[0].x="bad";osValidate(broken)',
    ),
  );
});

test("Adaptateur mock explicite : export accepté par le contrat réel d’import", async (t) => {
  const { MockAdapter, toCSV } = require("../connectors/adapter.cjs");
  const rows = await new MockAdapter().read({ from: "2026-08-12" }),
    csv = toCSV(rows),
    a = app(t);
  assert.match(csv, /MOCK SEQUOIA — aucune connexion/);
  const check = JSON.parse(
    a.run(
      `JSON.stringify(osValidateMeasurements(osParseCSV(${JSON.stringify(csv)})))`,
    ),
  );
  assert.equal(check.errors.length, 0);
  assert.equal(check.accepted[0].entry_mode, "import");
  assert.equal(check.accepted[0].value, 82);
});

test("Plan d’actions · Standby, vues et modification rapide gardée", (t) => {
  const a = app(t);
  assert.ok(a.run("ACTION_STATES.includes('Standby')"));
  const id = a.run("scoped(data.actions).find(isOpenAction).id");
  a.run(
    `(()=>{const x=data.actions.find(a=>a.id==='${id}');x.status='Standby';x.due_date='2020-01-01';})()`,
  );
  assert.equal(a.run(`isLate(data.actions.find(a=>a.id==='${id}'))`), false);
  assert.equal(
    a.run(`osEscalationCandidates().some(c=>c.action.id==='${id}')`),
    false,
  );
  for (const v of ["todo", "status", "board"]) {
    a.run(`state.view="actions";state.actionView="${v}";render()`);
    assert.match(a.q("#appView").textContent, /Plan d’actions/);
  }
  a.run('state.actionView="todo";render()');
  a.run(`quickEditAction('${id}','priority','Critique')`);
  assert.equal(
    a.run(`data.actions.find(a=>a.id==='${id}').priority`),
    "Critique",
  );
  a.run(`quickEditAction('${id}','owner','')`);
  assert.notEqual(a.run(`data.actions.find(a=>a.id==='${id}').owner`), "");
});

test("Plan d’actions · panneau visuel et filtre par site", (t) => {
  const a = app(t);
  a.run('state.site="group";state.view="actions";state.actionView="board";render()');
  assert.match(a.q("#appView").textContent, /Sécurité d’abord/);
  assert.match(a.q("#appView").textContent, /Famille × site/);
  assert.match(a.q("#appView").textContent, /Tenue des délais/);
  const cell = a.q("[data-board-cell]:not([disabled])");
  assert.ok(cell);
  cell.click();
  assert.equal(a.run("state.actionView"), "todo");
  assert.notEqual(a.run("state.actionFamily"), "all");
  assert.ok(a.q("[data-ap-scope-clear]"));
});

test("Plan d’actions 7.6 · menu, compteurs, point, report tracé, revue et saisie rapide", (t) => {
  const a = app(t);
  a.run('state.site="group";state.role="lean";state.view="home";render()');
  assert.ok(a.q('#desktopNav .ux-path [data-nav="actions"]'), "Plan d’actions dans le chemin");
  assert.ok(a.all("#mobileNav .nav-button").some((b) => b.dataset.nav === "actions"));
  assert.equal(a.all("#mobileNav .nav-button").length, 6);
  const id = a.run('scoped(data.actions).find(x=>x.status==="Ouverte"||x.status==="En cours").id');
  a.run(`(()=>{const x=data.actions.find(r=>r.id==="${id}");x.due_date="2020-01-01";save();})()`);
  a.run('state.view="actions";render()');
  assert.equal(a.q("#desktopNav .nav-badge, #mobileNav .nav-badge"), null, "Aucune pastille dans la navigation");
  a.click('.ap-counter[data-action-filter="late"]');
  assert.equal(a.run("state.actionFilter"), "late");
  assert.match(a.q("#appView").textContent, /En retard/);
  a.click('.ap-counter[data-action-filter="late"]');
  assert.equal(a.run("state.actionFilter"), "all");
  assert.equal(a.run(`apAddUpdate("${id}","")`), false);
  assert.equal(a.run(`apAddUpdate("${id}","Pièce commandée")`), true);
  assert.equal(a.run(`data.actions.find(x=>x.id==="${id}").updates.length`), 1);
  assert.equal(a.run(`apReschedule("${id}","2099-01-15","fournisseur")`), true);
  assert.equal(a.run(`data.actions.find(x=>x.id==="${id}").due_date_initial`), "2020-01-01");
  assert.equal(a.run(`data.actions.find(x=>x.id==="${id}").reschedules.length`), 1);
  assert.equal(a.run(`apSetStatus("${id}","Standby","")`), false);
  assert.equal(a.run(`apClose("${id}","","")`), false);
  assert.notEqual(a.run(`data.actions.find(x=>x.id==="${id}").status`), "Clôturée");
  a.run("render()");
  assert.ok(a.run("apReviewQueue().length") > 0);
  a.click("[data-ap-review]");
  assert.ok(a.q("#modal").classList.contains("ap-review"));
  a.fill("#apRvNote", "Point fait en revue");
  a.click('[data-ap-rv="note"]');
  assert.equal(a.run("state.apReview.i"), 1);
  for (let n = 0; n < 40 && a.run('state.apReview&&state.apReview.step!=="end"'); n++) a.click('[data-ap-rv="skip"]');
  assert.equal(a.run("state.apReview.step"), "end");
  assert.match(a.q("#apReport").value, /Revue du plan d’actions/);
  a.click("[data-ap-rv-quit]");
  assert.equal(a.run("state.apReview"), null);
  const count = a.run("data.actions.length");
  a.click("[data-ap-quick]");
  a.fill("#apqTitle", "Mesurer le bruit en zone ponçage");
  a.click('[data-apq-family="Sécurité"]');
  a.submit("#apQuickForm");
  assert.equal(a.run("data.actions.length"), count + 1);
  assert.equal(a.run("data.actions[0].category"), "Sécurité");
  assert.equal(a.run("data.actions[0].due_date_initial"), a.run("data.actions[0].due_date"));
});

test("Plan d’actions 7.7 · rappels « Je suis », cloche et fichier agenda", (t) => {
  const a = app(t);
  a.run('state.site="group";state.role="lean";state.view="actions";render()');
  assert.ok(a.q(".ap-more [data-ap-me]"), "« Je suis » rangé dans Filtres");
  const owner = a.run('data.actions.find(x=>x.status==="Ouverte"||x.status==="En cours").owner');
  a.fill(".ap-more [data-ap-me]", owner);
  assert.equal(a.run("apMe()"), owner);
  assert.equal(a.run("state.actionOwner"), "me");
  a.run('(()=>{const x=data.actions.find(r=>apIsMine(r)&&isOpenAction(r));x.due_date=today();x.status="En cours";save();render();})()');
  assert.ok(a.run('operationalNotifications().some(r=>r.key.startsWith("remind:")&&r.title.startsWith("Échéance aujourd’hui"))'));
  const ics = a.run("apIcs(apReminders().upcoming)");
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /TRIGGER:-PT15H/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  a.run('switchView("home")');
  assert.match(a.q(".jn-actions").textContent, /Mes actions/);
  a.run('apSetMe("");render()');
  a.fill(".jn-actions [data-jn-me]", owner);
  assert.equal(a.run("apMe()"), owner);
  a.run('apSetMe("")');
  assert.equal(a.run("apMe()"), "");
});

test("Interface 8.0 · une seule navigation, sans pastilles, onglets fusionnés", (t) => {
  const a = app(t);
  a.run('state.site="group";state.role="lean";state.interfaceMode="complete";state.view="pilotage";render()');
  assert.deepEqual(a.all("#desktopNav .ux-step-btn").map((b) => b.textContent.trim()), ["Voir", "Observer", "Résoudre", "Agir", "Pérenniser"]);
  assert.deepEqual(a.all("#mobileNav .nav-button").map((b) => b.textContent.trim()), ["Accueil", "Voir", "Observer", "Résoudre", "Agir", "Pérenniser"]);
  assert.equal(a.all(".ux-pathbar, .ux-count, .ux-step-n, .ux-mob-n, #mobileNav .nav-badge, #desktopNav .nav-badge").length, 0, "Aucune pastille numérotée");
  assert.equal(a.all("#pageLocation .ux-tabs").length, 1, "Une seule ligne d’onglets");
  assert.ok(a.q("#appView > .pilotage-switch.ux-seg"), "Analyser / Décider reste dans la page");
  assert.deepEqual(a.all("[data-pilotage-mode] b").map((b) => b.textContent), ["Analyser", "Décider"]);
  a.all("#pageLocation .ux-tab").find((b) => b.textContent === "Maturité").click();
  assert.equal(a.run("state.view"), "maturity");
  const cards = a.all("#appView .os-cards > *");
  if (cards.length > 12) assert.ok(cards.filter((x) => x.hidden).length > 0 && a.q(".ux-more-btn"));
  a.run('uxGoStage("observer")');
  assert.equal(a.run("state.view"), "terrain");
  assert.equal(a.run("state.terrainTab"), "gemba");
  assert.deepEqual(a.all("#pageLocation .ux-tab").map((b) => b.textContent), ["Gemba", "5S", "TPM", "TRS", "Rapport d’étonnement", "Signaux", "Audits", "Statistiques"]);
  assert.equal(a.q("#appView > .tabs"), null, "Sous-onglets fusionnés dans la ligne de l’étape");
  assert.ok(a.q("#contextPanel #siteSelect") && a.q("#contextPanel #roleSelect") && a.q("#contextPanel [data-interface-mode-toggle]") && a.q("#contextMore [data-nav]"));
  a.run('state.role="operator";state.site="marzin";render();uxGoStage("observer")');
  assert.equal(a.run("state.terrainTab"), "signals");
  assert.equal(a.q('[data-nav="audits"]'), null, "Pas de lien vers un écran hors profil");
  a.run('state.role="dg";state.site="group";state.view="home";render()');
  assert.ok(!a.all("#desktopNav .ux-step-btn").some((b) => b.textContent.trim() === "Observer"));
  assert.equal(a.q("#mobileNav .nav-button").dataset.nav, "home");
  assert.equal(a.q("#pageLocation").textContent.trim(), "");
});

test("Ma journée 8.0 · accueil par profil et Gemba express jusqu’au plan d’actions", (t) => {
  const a = app(t);
  a.run('state.site="group";state.role="lean";state.view="home";render()');
  assert.match(a.q("#appView").textContent, /Ma journée/);
  assert.equal(a.q(".jn-gemba"), null);
  assert.ok(a.q(".jn-actions"));
  a.run("jnStart()");
  a.fill("#jnZone", "Préparation commandes");
  a.submit("#jnStartForm");
  const gid = a.run("data.gembas[0].id");
  assert.equal(a.run("data.gembas[0].zone"), "Préparation commandes");
  assert.ok(a.q("#jnObsForm"), "Le premier constat s’ouvre directement");
  a.fill("#jnFact", "Palettes au sol devant le rack 4");
  a.click('[data-jn-fam="Sécurité"]');
  a.click('[data-jn-save="next"]');
  assert.equal(a.run("data.gembas[0].observations.length"), 1);
  assert.equal(a.run("data.gembas[0].observations[0].decision"), "À décider");
  a.fill("#jnFact", "Feuilles vertes de suivi non généralisées");
  a.click('[data-jn-save="done"]');
  assert.equal(a.run("data.gembas[0].observations.length"), 2);
  const before = a.run("data.actions.length");
  a.run(`jnSort("${gid}")`);
  a.click('[data-jn-pick="action"]');
  a.fill("#jnWhat", "Délimiter l’emplacement au sol du rack 4");
  a.fill("#jnOwner", "Pierre Thibaut");
  a.click('[data-jn-confirm="action"]');
  assert.equal(a.run("data.actions.length"), before + 1);
  assert.equal(a.run("data.actions[0].origin_type"), "Gemba");
  assert.equal(a.run("data.actions[0].origin_id"), gid);
  assert.equal(a.run("data.actions[0].priority"), "Haute");
  assert.equal(a.run("data.actions[0].due_date_initial"), a.run("data.actions[0].due_date"));
  a.click('[data-jn-pick="none"]');
  assert.equal(a.run(`data.gembas.find(g=>g.id==="${gid}").observations[1].decision`), "Conforme");
  a.click("[data-jn-finish-now]");
  assert.ok(a.run(`!!data.gembas.find(g=>g.id==="${gid}").visited_at`));
  a.run('closeModal();state.role="dg";state.view="home";render()');
  assert.equal(a.q("[data-new-gemba]"), null, "La DG reste en lecture seule");
  assert.ok(a.q(".jn-watch"));
  a.run('state.role="operator";state.site="marzin";render()');
  assert.ok(a.q(".jn-signal [data-new-signal]"));
  assert.equal(a.q("[data-new-gemba]"), null);
});

test("Calepin Gemba 8.8 · nature des notes, risque immédiat, photos, compte rendu et remarques sur l’appli", (t) => {
  const a = app(t);
  a.run('state.site="group";state.role="lean";state.view="terrain";state.terrainTab="gemba";render()');
  assert.match(a.q("#appView").textContent, /même sans réseau/);
  a.run("jnStart()");
  a.fill("#jnZone", "Stockage et logistique");
  a.submit("#jnStartForm");
  const gid = a.run("data.gembas[0].id");
  assert.equal(a.all("[data-cp-kind]").length, 5, "Cinq natures de note");
  a.click('[data-cp-kind="question"]');
  assert.equal(a.q("#cpFactLabel").textContent, "La question");
  a.fill("#jnFact", "Qui affecte les emplacements au sol ?");
  a.click('[data-jn-fam="Flux"]');
  a.click('[data-jn-save="next"]');
  a.click('[data-cp-kind="risque"]');
  a.run('$("jnFamValue").value="";document.querySelectorAll("[data-jn-fam]").forEach(b=>b.classList.remove("active"))');
  a.click("[data-cp-urgent]");
  assert.equal(a.q("#jnFamValue").value, "Sécurité", "Un risque immédiat se range en sécurité par défaut");
  a.fill("#jnFact", "Coffret électrique au sol, câbles exposés");
  a.click('[data-jn-save="next"]');
  a.click('[data-cp-kind="positif"]');
  a.fill("#jnFact", "Feuilles vertes de suivi claires");
  a.click('[data-jn-save="done"]');
  a.run(`jnConstat("${gid}",null,{photos:["data:image/jpeg;base64,YQ=="]})`);
  assert.equal(a.all("#cpPhotos .cp-ph").length, 1, "Photo d’abord : la note s’ouvre avec la photo");
  a.fill("#jnFact", "Palettes au sol devant le rack 4");
  a.click('[data-jn-save="done"]');
  const obs = JSON.parse(a.run(`JSON.stringify(data.gembas.find(g=>g.id==="${gid}").observations.map(o=>[o.kind,o.urgent,o.decision,o.category,o.photos.length,o.photo,!!o.noted_at]))`));
  assert.deepEqual(obs, [
    ["question", false, "À décider", "Flux", 0, "", true],
    ["risque", true, "À décider", "Sécurité", 0, "", true],
    ["positif", false, "Conforme", "Sécurité", 0, "", true],
    ["fait", false, "À décider", "Sécurité", 1, "data:image/jpeg;base64,YQ==", true],
  ]);
  a.run(`openGemba("${gid}")`);
  assert.match(a.q(".cp-alert").textContent, /1 risque immédiat/);
  assert.match(a.q(".cp-count").textContent, /1 question · 1 point fort · 1 photo/);
  assert.ok(a.q(".cp-obs.urgent"));
  a.fill("#cpPeople", "Chef d’équipe logistique");
  assert.equal(a.run(`data.gembas.find(g=>g.id==="${gid}").people`), "Chef d’équipe logistique");
  a.run(`jnSort("${gid}")`);
  assert.match(a.q(".jn-sort-card").textContent, /Risque immédiat.*Coffret/, "Le risque immédiat se trie en premier");
  a.click('[data-jn-pick="action"]');
  a.fill("#jnWhat", "Relever le coffret et protéger les câbles");
  a.fill("#jnOwner", "Pierre Thibaut");
  a.click('[data-jn-confirm="action"]');
  assert.equal(a.run("data.actions[0].priority"), "Haute");
  a.run(`cpReport("${gid}")`);
  const report = a.q(".cp-report").textContent;
  for (const part of ["Risques immédiats", "Points forts", "Constats · Sécurité", "Questions ouvertes", "Actions décidées", "Chef d’équipe logistique"]) assert.ok(report.includes(part), part);
  assert.match(a.run(`cpReportText(data.gembas.find(g=>g.id==="${gid}"))`), /RISQUES IMMÉDIATS[\s\S]*→ Action A-[\s\S]*pas un plan d’action définitif/);
  // Sauvegarde : les photos de la base voyagent avec le fichier et reviennent à l’import.
  a.run(`window.cpRaw=JSON.parse(JSON.stringify(data));cpRaw.gembas.find(g=>g.id==="${gid}").observations[0].photo="photo:PH-1-abcde";cpRaw.photos={"PH-1-abcde":"data:image/jpeg;base64,Yg==","../x":"data:image/jpeg;base64,Yg=="};window.cpOut=validateImport(cpRaw)`);
  assert.equal(a.run(`safePhoto(cpOut.gembas.find(g=>g.id==="${gid}").observations[0].photo)`), "data:image/jpeg;base64,Yg==");
  assert.equal(a.run("photoImage('photo:PH-404-zzzzz')").includes("src="), false, "Une photo absente n’affiche rien de faux");
  // Remarques sur l’appli : notées sur place, copiables pour la prochaine version.
  a.run("closeModal();openCreateMenu()");
  a.click("[data-cp-note]");
  a.fill("#cpNoteText", "Trop de clics pour ajouter une photo");
  a.submit("#cpNoteForm");
  assert.equal(a.run("cpNotes().length"), 1);
  assert.match(a.run("cpNotesText(cpNotes())"), /Ça gêne · .* : Trop de clics pour ajouter une photo/);
  assert.equal(a.all(".cp-note-list li").length, 1);
});

test("5S 8.10 · zones, audit au téléphone, bilan et actions, étiquettes rouges, fiche de zone", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.view="audits";state.auditsTab="5s";render()');
  assert.ok(a.q(".cs-empty"), "Sans zone : on commence par en créer une");
  assert.ok(a.run('uxTabs(uxStages().find(s=>s.id==="observer")).some(t=>t.key==="5s")'));
  a.run("csZoneForm()");
  a.fill("#csZoneName", "Magasin matières");
  a.fill("#csZoneOwner", "Kévin");
  a.click('[data-cs-freq="14"]');
  a.submit("#csZoneForm");
  const zid = a.run('data.zones.find(z=>z.name==="Magasin matières").id');
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(data.zones.find(z=>z.id==="${zid}").five_s)`)), { frequency_days: 14, target: 80, ref_photos: [] });
  assert.ok(a.q(".cs-zone"), "La zone s’ouvre");
  a.run(`csAuditStart("${zid}")`);
  assert.equal(a.run(`data.audits.filter(x=>x.zone_id==="${zid}"&&x.status==="Brouillon").length`), 1, "Brouillon gardé dès le début");
  assert.equal(a.all(".cs-q").length, 3, "Trois questions par S");
  a.click('[data-cs-cid="cs-t1"] [data-cs-v="2"]');
  a.click('[data-cs-cid="cs-t3"] [data-cs-v="0"]');
  assert.ok(a.q('[data-cs-cid="cs-t3"] [data-cs-note]'), "Un écart ouvre la note, sur place");
  assert.equal(a.q('[data-cs-cid="cs-t1"] [data-cs-note]'), null, "Pas de note demandée quand c’est conforme");
  assert.ok(a.q('.cs-step[data-cs-step="0"].on'), "La barre d’étapes reste sur 1S");
  a.fill('[data-cs-cid="cs-t3"] [data-cs-note]', "Palette de chants sans référence");
  a.run('document.querySelector(\'[data-cs-cid="cs-t3"] [data-cs-note]\').onblur()');
  a.run('csSetAnswer("cs-r3",{v:0,note:"Extincteur masqué par une palette"});CS_CRITERIA.forEach(([s,cid])=>{const v=csAuditGet().five_s.answers[cid]?.v;if(v===undefined)csSetAnswer(cid,{v:2})});csRun.step=5;csAuditRender()');
  assert.equal(a.all(".cs-gap-list li").length, 2);
  assert.equal(a.all(".cs-gap-list [data-cs-act]:checked").length, 2, "Un Non devient une action d’office");
  a.fill('[data-cs-gap="cs-r3"] [data-cs-what]', "Dégager l’extincteur");
  a.click("[data-cs-finish]");
  const audit = JSON.parse(a.run(`JSON.stringify(data.audits.find(x=>x.zone_id==="${zid}"))`));
  assert.equal(audit.status, "Terminé");
  assert.deepEqual(audit.five_s.s_scores, [67, 67, 100, 100, 100]);
  assert.equal(audit.score, 87);
  assert.equal(audit.audit_data.domain_scores["2S · Ranger"], 3.35);
  assert.equal(audit.five_s.answers["cs-t3"].note, "Palette de chants sans référence");
  const acts = JSON.parse(a.run(`JSON.stringify(data.actions.filter(x=>x.origin_id==="${audit.id}").map(x=>[x.title,x.owner,x.priority,x.category,x.due_date,x.zone_id]))`));
  assert.equal(acts.length, 2);
  assert.deepEqual(acts.find((x) => x[0] === "Dégager l’extincteur"), ["Dégager l’extincteur", "Kévin", "Haute", "Sécurité", a.run("csAddDays(today(),2)"), zid]);
  assert.ok(a.q(".cs-done .cs-radar"), "Bilan avec radar");
  // Audits terrain : les audits 5S ont leur onglet et ne faussent pas les audits 50 critères.
  a.run('closeModal();state.auditsTab="audits";render()');
  assert.ok(a.q(".cs-banner"));
  assert.doesNotMatch(a.q("#appView").textContent, new RegExp(audit.id));
  a.run(`auditForm(data.audits.find(x=>x.id==="${audit.id}"))`);
  assert.ok(a.q(".cs-view"), "Consulter un audit 5S ouvre sa vue");
  // Étiquette rouge : numérotée, imprimable, traitée.
  a.run(`closeModal();csTagForm(null,{zoneId:"${zid}"})`);
  a.fill("#csTagWhat", "Palette de chants sans référence");
  a.click('[data-cs-reason="En trop"]');
  a.submit("#csTagForm");
  assert.deepEqual(JSON.parse(a.run("JSON.stringify([data.redTags[0].id,data.redTags[0].status,data.redTags[0].reason,data.redTags[0].zone_id,data.redTags[0].owner])")), ["ER-001", "Ouverte", "En trop", zid, "Kévin"]);
  assert.match(a.q(".cs-tag-print").textContent, /ÉTIQUETTE ROUGE.*ER-001/);
  a.run('csTagForm("ER-001")');
  a.fill("#csTagDone", "Rangé au magasin");
  a.click("[data-cs-tagdone]");
  assert.equal(a.run("data.redTags[0].status"), "Traitée");
  a.run(`csZonePrint("${zid}")`);
  assert.match(a.q(".cs-sheet").textContent, /Magasin matières[\s\S]*87 %/);
  assert.equal(a.run("validateImport(JSON.parse(JSON.stringify(data))).redTags.length"), 1, "Sauvegarde : zones, audits et étiquettes conservés");
  // Accueil : un audit en retard remonte dans « À surveiller ».
  a.run(`data.audits.find(x=>x.id==="${audit.id}").performed_at=csAddDays(today(),-20);closeModal();state.view="home";render()`);
  assert.match(a.q(".jn-watch").textContent, /Audit en retard · Magasin matières/);
  a.run('state.role="operator";render()');
  assert.equal(a.run('uxTabs(uxStages().find(s=>s.id==="observer")).some(t=>t.key==="5s")'), false, "Pas d’audit 5S pour l’opérateur");
});

test("Standard de poste 8.12 · étapes et points clés, validation versionnée, formation, fiche au poste, zone 5S", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.view="documents";render();stNew({title:"Collage des chants · poste 3"})');
  a.fill("#stNewOwner", "Camille Martin");
  a.submit("#stNewForm");
  const id = a.run('data.documents.find(d=>d.type==="STANDARD"&&d.title==="Collage des chants · poste 3").id');
  assert.ok(a.q(".st-editor"), "Le standard s’ouvre dans son éditeur");
  a.click("[data-st-validate]");
  assert.equal(a.run(`stDoc("${id}").status`), "Brouillon", "Pas de validation sans étape");
  a.click('[data-st-ppe="Gants"]');
  a.click("[data-st-addstep]");
  const sid = a.run(`stOf(stDoc("${id}")).steps[0].id`);
  a.fill(`[data-st-step="${sid}"] [data-st-title]`, "Contrôler le chant et la colle");
  a.click(`[data-st-step="${sid}"] [data-st-kpadd="securite"]`);
  a.fill(`[data-st-step="${sid}"] [data-st-kp="0"] [data-st-kptext]`, "Colle à 180 °C : gants obligatoires");
  a.click(`[data-st-step="${sid}"] [data-st-kpadd="geste"]`);
  a.click(`[data-st-step="${sid}"] [data-st-kp="1"] [data-st-kind]`);
  a.fill(`[data-st-step="${sid}"] [data-st-kp="1"] [data-st-kptext]`, "Teinte conforme à l’OF");
  a.fill(`[data-st-step="${sid}"] [data-st-reason]`, "Éviter brûlure et reprise");
  a.fill(`[data-st-step="${sid}"] [data-st-time]`, "30");
  const st = JSON.parse(a.run(`JSON.stringify(stOf(stDoc("${id}")))`));
  assert.deepEqual(st.ppe, ["Gants"]);
  assert.deepEqual(st.steps[0].points.map((p) => p.text), ["Colle à 180 °C : gants obligatoires", "Teinte conforme à l’OF"]);
  assert.equal(a.run(`stOf(stDoc("${id}")).steps[0].points[1].kind`), "securite", "Le type de point clé change d’un geste (geste → sécurité)");
  assert.equal(st.steps[0].reason, "Éviter brûlure et reprise");
  assert.equal(st.steps[0].time_s, 30);
  a.fill("#stApprover", "Lionel Chavanac");
  a.click("[data-st-validate]");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify([stDoc("${id}").status,stDoc("${id}").version,stOf(stDoc("${id}")).approved_by])`)), ["Validé", 1, "Lionel Chavanac"]);
  a.fill("#stTrName", "Kévin");
  a.click("[data-st-train]");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(stOf(stDoc("${id}")).trained.map(t=>[t.name,t.version]))`)), [["Kévin", 1]]);
  a.fill(`[data-st-step="${sid}"] [data-st-reason]`, "Éviter brûlure, reprise et rebut");
  assert.equal(a.run(`stDoc("${id}").status`), "En révision", "Modifier un standard validé le remet en révision");
  a.run(`stRedraw("${id}")`);
  a.fill("#stApprover", "Lionel Chavanac");
  a.click("[data-st-validate]");
  assert.equal(a.run(`stDoc("${id}").version`), 2, "Nouvelle validation = nouvelle version");
  assert.match(a.q(".st-trained h3").textContent, /version 2 · 0/, "La formation se refait sur la nouvelle version");
  assert.equal(a.run(`documentProgress("STANDARD",stDoc("${id}").structured_data).done`), 4, "Il ne manque que la photo");
  a.run(`stPrint("${id}")`);
  assert.match(a.q(".st-sheet").textContent, /Contrôler le chant et la colle[\s\S]*Colle à 180 °C[\s\S]*En cas d’écart/);
  a.run(`closeModal();editDocument("${id}")`);
  assert.ok(a.q(".st-editor"), "Ouvrir le document mène à l’éditeur du standard");
  a.run(`closeModal();csZoneForm()`);
  a.fill("#csZoneName", "Îlot de collage");
  a.submit("#csZoneForm");
  const zid = a.run('data.zones.find(z=>z.name==="Îlot de collage").id');
  a.run(`stSave("${id}",st=>{st.zone_id="${zid}"},{revise:false});csZoneOpen("${zid}")`);
  assert.match(a.q(".st-zone").textContent, /Standards de la zone · 1[\s\S]*Collage des chants/);
});

test("SMED 8.13 · chrono qui survit à la fermeture, interne/externe, transformation, gain, actions sans lien orphelin, mesures et standard", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.projectsTab="smed";state.view="projects";render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="resoudre")).map(t=>[t.key,t.set?.projectsTab||""]))'));
  assert.deepEqual(tabs.filter(([k]) => ["projects", "smed"].includes(k)), [["projects", "projects"], ["smed", "smed"]], "Onglet SMED à côté des chantiers, états distincts");
  assert.ok(a.q(".cs-empty [data-sm-new]"), "Page vide : un seul appel à créer");
  a.click(".cs-empty [data-sm-new]");
  a.fill("#smTitle", "Plaqueuse 2 · changement de chant");
  a.fill("#smOwner", "Amandine Colin");
  a.fill("#smTarget", "15");
  a.fill("#smPerWeek", "5");
  a.submit("#smNewForm");
  const id = a.run("data.smed[0].id");
  assert.equal(id, "SMED-001");
  a.click("[data-sm-start]");
  a.run(`data.smed[0].chrono.lap_at=new Date(Date.now()-300000).toISOString()`);
  a.click("[data-sm-lapbtn]");
  a.run(`closeModal();smOpen("${id}")`);
  assert.ok(a.q("[data-sm-lapbtn]"), "Le chrono reprend à la réouverture");
  a.run(`data.smed[0].chrono.lap_at=new Date(Date.now()-120000).toISOString()`);
  a.click("[data-sm-stop]");
  const durs = JSON.parse(a.run("JSON.stringify(data.smed[0].ops.map(o=>o.dur_s))"));
  assert.equal(durs.length, 2);
  assert.ok(Math.abs(durs[0] - 300) <= 2 && Math.abs(durs[1] - 120) <= 2, `Durées relevées ${durs}`);
  assert.ok(a.run("!!data.smed[0].chrono.ended_at") && !a.q("[data-sm-lapbtn]"), "Fin du chrono au premier bon produit");
  const [o1, o2] = JSON.parse(a.run("JSON.stringify(data.smed[0].ops.map(o=>o.id))"));
  a.fill(`[data-sm-op="${o1}"] [data-sm-label]`, "Démonter le rouleau");
  a.fill(`[data-sm-op="${o1}"] [data-sm-dur]`, "4:30");
  a.fill(`[data-sm-op="${o2}"] [data-sm-label]`, "Préparer la colle");
  a.click(`[data-sm-op="${o2}"] [data-sm-type="externe"]`);
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.smed[0].ops.map(o=>[o.label,o.dur_s,o.type]))")), [["Démonter le rouleau", 270, "interne"], ["Préparer la colle", durs[1], "externe"]]);
  a.fill(`[data-sm-op="${o1}"] [data-sm-dur]`, "abc");
  assert.equal(a.run("data.smed[0].ops[0].dur_s"), 270, "Durée illisible refusée");
  a.click('button[data-sm-tab="analyse"]');
  a.click(`[data-sm-op="${o1}"] [data-sm-after="reduite"]`);
  a.fill(`[data-sm-op="${o1}"] [data-sm-afters]`, "2:00");
  a.fill(`[data-sm-op="${o1}"] [data-sm-action]`, "Serrage rapide du rouleau");
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(smTotals(data.smed[0]))")), { before: 270, after: 120, ext: durs[1], gain: 150, pct: 56 });
  assert.match(a.q("[data-sm-head] .sm-sum").textContent, /4:30[\s\S]*2:00[\s\S]*−2:30 · 56 %[\s\S]*0,2 h/, "Gain par changement et par semaine");
  assert.equal(a.all(".sm-g-row").length, 4, "Diagramme avant / après / machine en marche");
  a.click("[data-sm-mkactions]");
  const act = JSON.parse(a.run('JSON.stringify(data.actions.find(x=>x.smed_id==="SMED-001"))'));
  assert.equal(act.title, "Serrage rapide du rouleau");
  assert.equal(act.origin_type, "SMED");
  assert.equal(act.owner, "Amandine Colin");
  assert.ok(!act.origin_id, "Pas d’origin_id vers une collection non indexée");
  assert.equal(a.run("osIntegrity(data).length"), 0, "Aucun lien orphelin");
  assert.equal(a.run("data.smed[0].ops[0].action_id"), act.id);
  assert.ok(!a.q("[data-sm-mkactions]"), "Plus rien à ajouter");
  assert.ok(!a.run(`smOpen("${id}","chrono");!!document.querySelector("[data-sm-restart]")`), "Pas de rechronométrage une fois les actions lancées");
  a.run(`smOpen("${id}","resultat")`);
  a.fill("#smMeasure", "14");
  a.click("[data-sm-measure]");
  assert.match(a.q(".sm-sum").textContent, /14 min[\s\S]*Cible tenue/);
  assert.equal(a.all(".sm-trend .sm-g-row").length, 2, "Référence puis mesure");
  a.click("[data-sm-standard]");
  const std = JSON.parse(a.run('JSON.stringify(stOf(stDoc(data.smed[0].standard_id)).steps.map(s=>[s.title,s.points.map(p=>p.text).join(" + ")]))'));
  assert.deepEqual(std, [["Préparer la colle", "Machine en marche, avant l’arrêt"], ["Démonter le rouleau", "Machine arrêtée + Serrage rapide du rouleau"]]);
  assert.ok(a.q(".st-editor"), "Le standard de changement s’ouvre dans son éditeur");
  a.run('closeModal();state.projectsTab="projects";render()');
  assert.ok(a.q('[data-sm-project="CH-006"]'), "Un chantier SMED propose de chronométrer");
  a.run('state.projectsTab="smed";render()');
  assert.match(a.q(".sm-card").textContent, /4:30[\s\S]*2:00[\s\S]*14 min/);
  assert.ok(a.q(".sm-card.tone-ok"));
  a.run("validateImport(JSON.parse(JSON.stringify(data)))");
});

test("Ishikawa et 5 pourquoi 8.14 · post-it 6M, vérification par un fait, arbre des pourquoi, relecture « donc », actions et A3", (t) => {
  const a = app(t);
  const pid = a.run('state.site="marzin";state.role="lean";const p=data.problems.find(x=>x.site_id==="marzin"&&x.method==="A3"&&!x.archived_at);state.selectedProblemId=p.id;state.view="resolution";render();p.id');
  assert.ok(a.q(`[data-ik-new="ISHIKAWA"][data-ik-pid="${pid}"]`), "L’A3 propose de faire l’Ishikawa");
  a.click(`[data-ik-new="ISHIKAWA"]`);
  const id = a.run('data.documents[0].id');
  assert.equal(a.run(`ikDoc("${id}").type`), "ISHIKAWA");
  assert.equal(a.run(`ikDoc("${id}").problem_id`), pid);
  assert.ok(a.q(".ik-fams") && a.q(".ik-effect textarea").value.length > 5, "Effet repris du problème, onglet Causes");
  const add = (fam, text) => { a.fill(`[data-ik-fam="${fam}"] [data-ik-addin]`, text); a.submit(`[data-ik-fam="${fam}"] [data-ik-add]`); };
  add("machine", "Température de colle trop basse");
  add("machine", "Rouleau presseur usé");
  add("material", "Chant humide");
  add("method", "Préchauffage trop court");
  add("environment", "Atelier froid le matin");
  add("machine", "rouleau presseur usé");
  assert.equal(a.run(`ikDoc("${id}").structured_data.ik.causes.length`), 5, "Doublon refusé");
  assert.equal(a.all('[data-ik-fam="machine"] .ik-note').length, 2);
  assert.match(a.run(`ikDoc("${id}").structured_data.machine`), /Température de colle trop basse\nRouleau presseur usé/, "Rubriques texte tenues à jour");
  a.run(`ikOpen("${id}","verifier")`);
  const cid = (t) => a.run(`ikDoc("${id}").structured_data.ik.causes.find(c=>c.text.startsWith("${t}")).id`);
  const t1 = cid("Température"), t2 = cid("Rouleau"), t3 = cid("Chant"), t4 = cid("Préchauffage"), t5 = cid("Atelier");
  a.fill(`[data-ik-c="${t1}"] [data-ik-test]`, "Mesurer la colle à 6 h 30");
  a.click(`[data-ik-c="${t1}"] [data-ik-st="confirmee"]`);
  a.fill(`[data-ik-c="${t1}"] [data-ik-proof]`, "168 °C au lieu de 190 °C");
  for (const c of [t2, t3, t4]) a.click(`[data-ik-c="${c}"] [data-ik-st="ecartee"]`);
  assert.ok(a.q(`[data-ik-c="${t1}"].st-confirmee`), "Statut mis à jour sur place");
  assert.equal(a.run(`documentProgress("ISHIKAWA",ikDoc("${id}").structured_data).pct`) < 100, true);
  a.run(`ikOpen("${id}","bilan")`);
  assert.equal(a.all(".ik-bone").length, 6, "Arête de poisson 6M");
  assert.match(a.q(".ik-close").textContent, /un statut pour chaque cause/, "Le bilan dit ce qui manque");
  a.click(`.ik-conf [data-ik-c="${t1}"] [data-ik-why]`);
  const wid = a.run('data.documents[0].id');
  assert.equal(a.run(`ikDoc("${wid}").type`), "5WHY");
  assert.equal(a.run(`ikDoc("${id}").structured_data.ik.causes.find(c=>c.id==="${t1}").why_id`), wid, "La cause confirmée garde le lien vers ses 5 pourquoi");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(ikDoc("${wid}").structured_data.why.nodes.map(n=>[n.text,n.status,n.proof]))`)), [["Température de colle trop basse", "vrai", "168 °C au lieu de 190 °C"]]);
  const n1 = a.run(`ikDoc("${wid}").structured_data.why.nodes[0].id`);
  a.click(`[data-why-n="${n1}"] [data-why-child]`);
  const n2 = a.run(`ikDoc("${wid}").structured_data.why.nodes[1].id`);
  a.fill(`[data-why-n="${n2}"] [data-why-text]`, "Mise en chauffe 20 min avant le démarrage");
  a.click(`[data-why-n="${n2}"] [data-why-st="vrai"]`);
  a.fill(`[data-why-n="${n2}"] [data-why-proof]`, "Relevé automate 6 h 10");
  a.click(`[data-why-n="${n2}"] [data-why-child]`);
  const n3 = a.run(`ikDoc("${wid}").structured_data.why.nodes[2].id`);
  a.fill(`[data-why-n="${n3}"] [data-why-text]`, "La fiche de démarrage ne prévoit pas la chauffe");
  a.click(`[data-why-n="${n3}"] [data-why-sib]`);
  const n3b = a.run(`ikDoc("${wid}").structured_data.why.nodes[3].id`);
  assert.equal(a.run(`ikDoc("${wid}").structured_data.why.nodes[3].parent`), n2, "« Autre cause » ouvre une branche au même niveau");
  a.fill(`[data-why-n="${n3b}"] [data-why-text]`, "Résistance faible");
  a.click(`[data-why-n="${n3b}"] [data-why-st="faux"]`);
  assert.ok(!a.q(`[data-why-n="${n3b}"] [data-why-root]`), "Une réponse fausse ne peut pas être la cause racine");
  a.click(`[data-why-n="${n3}"] [data-why-root]`);
  a.fill(`[data-why-n="${n3}"] [data-why-cm]`, "Programmer la chauffe à 5 h 45");
  assert.equal(a.run(`documentProgress("5WHY",ikDoc("${wid}").structured_data).done`), 4, "Il manque la vérification de la cause racine et l’action");
  a.click(`[data-why-n="${n3}"] [data-why-st="vrai"]`);
  a.fill(`[data-why-n="${n3}"] [data-why-proof]`, "Fiche de démarrage relue");
  const legacy = JSON.parse(a.run(`JSON.stringify((({why1,why2,why3,root_cause,countermeasure})=>({why1,why2,why3,root_cause,countermeasure}))(ikDoc("${wid}").structured_data))`));
  assert.deepEqual(legacy, { why1: "Température de colle trop basse", why2: "Mise en chauffe 20 min avant le démarrage", why3: "La fiche de démarrage ne prévoit pas la chauffe", root_cause: "La fiche de démarrage ne prévoit pas la chauffe (preuve : Fiche de démarrage relue)", countermeasure: "Programmer la chauffe à 5 h 45" });
  a.click('button[data-ik-tab="bilan"]');
  assert.match(a.q(".why-back").textContent, /La fiche de démarrage[\s\S]*donc Mise en chauffe[\s\S]*donc Température[\s\S]*donc /, "Relecture à l’envers avec « donc »");
  a.click("[data-why-mkact]");
  const act = JSON.parse(a.run(`JSON.stringify(data.actions.find(x=>x.origin_id==="${wid}"))`));
  assert.deepEqual([act.title, act.origin_type, act.problem_id], ["Programmer la chauffe à 5 h 45", "5 pourquoi", pid]);
  assert.equal(a.run(`documentProgress("5WHY",ikDoc("${wid}").structured_data).pct`), 100);
  a.click("[data-ik-validate]");
  assert.equal(a.run(`ikDoc("${wid}").status`), "Validé");
  a.run(`ikOpen("${id}","verifier")`);
  a.click(`[data-ik-c="${t5}"] [data-ik-st="confirmee"]`);
  a.fill(`[data-ik-c="${t5}"] [data-ik-proof]`, "12 °C à 6 h");
  a.run(`ikOpen("${id}","bilan")`);
  a.click(`.ik-conf [data-ik-c="${t5}"] [data-ik-act]`);
  a.fill(`.ik-conf [data-ik-c="${t5}"] [data-ik-what]`, "Fermer la porte avant 6 h");
  a.click(`.ik-conf [data-ik-c="${t5}"] [data-ik-mkact]`);
  assert.equal(a.run(`data.actions.find(x=>x.origin_id==="${id}").category`), "Autre");
  assert.equal(a.run(`documentProgress("ISHIKAWA",ikDoc("${id}").structured_data).pct`), 100);
  a.click("[data-ik-validate]");
  assert.equal(a.run(`ikDoc("${id}").status`), "Validé");
  a.run(`ikSave("${id}",ik=>{ik.causes[0].test="Remesurer"})`);
  assert.equal(a.run(`ikDoc("${id}").status`), "En révision", "Modifier une analyse validée la repasse en révision");
  assert.equal(a.run("osIntegrity(data).length"), 0, "Aucun lien orphelin");
  a.run("closeModal();render()");
  assert.match(a.q(".md-fish").textContent, /✓ Température de colle trop basse/, "L’A3 montre les causes confirmées");
  assert.match(a.q(".md-why").textContent, /Mise en chauffe 20 min/, "L’A3 montre la chaîne des pourquoi");
  assert.ok(!a.q("[data-ik-new]"), "Plus de bouton de création une fois les deux analyses faites");
  assert.match(a.run(`documentVisual("ISHIKAWA",ikDoc("${id}").structured_data)`), /ik-fish/);
  assert.match(a.run(`documentPrint(ikDoc("${wid}"),ikDoc("${wid}").structured_data)`), /why-sheet[\s\S]*Cause racine/);
  a.run(`data.documents.unshift({id:"DOC-900",site_id:"marzin",type:"ISHIKAWA",title:"Ancien",owner:"X",status:"Brouillon",problem_id:null,structured_data:{effect:"E",method:"A\\nB",machine:"C"},version:1,created_at:now(),updated_at:now()},{id:"DOC-901",site_id:"marzin",type:"5WHY",title:"Ancien",owner:"X",status:"Brouillon",problem_id:null,structured_data:{problem:"P",why1:"a",why2:"b",root_cause:"r",countermeasure:"c"},version:1,created_at:now(),updated_at:now()});save();editDocument("DOC-900")`);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(ikDoc("DOC-900").structured_data.ik.causes.map(c=>[c.fam,c.text]))')), [["method", "A"], ["method", "B"], ["machine", "C"]], "Un ancien Ishikawa en texte devient des post-it");
  a.run('editDocument("DOC-901")');
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(ikDoc("DOC-901").structured_data.why.nodes.map(n=>[n.text,!!n.root,n.cm||""]))')), [["a", false, ""], ["b", true, "c"]], "Une ancienne chaîne devient un arbre");
  a.run("validateImport(JSON.parse(JSON.stringify(data)))");
  a.run('modalSaver=()=>{uxFlush();return true};const i=document.createElement("input");document.body.append(i);i.focus();uxAutoSaving=true;modalSaver();uxAutoSaving=false');
  assert.equal(a.run("document.activeElement.tagName"), "INPUT", "La sauvegarde automatique ne retire pas le curseur du champ");
  a.run("modalSaver()");
  assert.notEqual(a.run("document.activeElement.tagName"), "INPUT", "La fermeture, elle, enregistre le champ en cours");
});

test("Rapport d’étonnement 8.9 · thèmes tirés des Gemba, mots du responsable Lean, période, droits et texte pour le COMEX", (t) => {
  const a = app(t);
  a.run(`const mk=(site,day,notes)=>{const g={id:nextId("G",data.gembas),site_id:site,zone:"Zone "+site,author:"Pierre Thibaut",status:"Brouillon",observations:[],created_at:day+"T09:00:00.000Z",updated_at:day+"T09:00:00.000Z"};notes.forEach(([kind,cat,fact,urgent])=>g.observations.push({id:uid("OBS"),kind,category:cat,fact,urgent:!!urgent,decision:kind==="positif"?"Conforme":"À décider",photos:[],photo:""}));data.gembas.unshift(g);};
    mk("marzin","2020-01-06",[["risque","Sécurité","Coffret électrique au sol",true],["fait","Flux","Stock devant les racks"],["question","Flux","Racks sous-dimensionnés ?"],["positif","Qualité","Feuilles vertes utiles"]]);
    mk("sodeplax","2020-01-07",[["fait","Sécurité","Pincement au film de protection"],["piste","Standard","Objectifs visibles au poste"]]);
    mk("sodeplax","2019-12-01",[["fait","Maintenance","Note hors période"]]);
    data.etonnement={group:{from:"2020-01-06",to:"2020-01-07",themes:{}}};save();
    state.site="group";state.role="lean";state.view="terrain";state.terrainTab="etonnement";render()`);
  assert.ok(a.run('uxTabs(uxStages().find(s=>s.id==="observer")).some(t=>t.key==="etonnement")'), "Onglet dans Observer");
  assert.ok(a.q(".et-report"));
  assert.match(a.q(".et-figures").textContent, /2 visites · 2 sites \(Marzin, Sodeplax\) · 6 notes/);
  assert.deepEqual(a.all(".et-theme").map((x) => x.dataset.etFam), ["Sécurité", "Flux", "Standard"], "Sécurité d’abord ; hors période exclue ; points forts à part");
  assert.match(a.q(".et-common").textContent, /Sécurité · Marzin, Sodeplax · 2 notes/);
  assert.match(a.q(".et-strong").textContent, /Feuilles vertes utiles/);
  assert.equal(a.all(".et-matrix tbody tr").length, 2);
  a.fill("#et-securite-analysis", "Risques électriques et mécaniques sur les deux sites");
  a.fill("#et-msg-message", "La sécurité d’abord.");
  a.run("etFlush()");
  assert.equal(a.run('data.etonnement.group.themes["Sécurité"].analysis'), "Risques électriques et mécaniques sur les deux sites");
  assert.equal(a.run("data.etonnement.group.message"), "La sécurité d’abord.");
  assert.equal(a.run("validateImport(JSON.parse(JSON.stringify(data))).etonnement.group.message"), "La sécurité d’abord.", "Conservé par la sauvegarde");
  const text = a.run("etText()");
  assert.match(text, /MESSAGE CLÉ\nLa sécurité d’abord\.[\s\S]*SÉCURITÉ\nConstat\n- Marzin : \[risque immédiat\] Coffret électrique au sol[\s\S]*Analyse : Risques électriques/);
  assert.match(text, /ne vaut pas plan d’action définitif/);
  a.fill('[data-et-period="from"]', "2020-01-07");
  a.run("etFlush()");
  assert.match(a.q(".et-figures").textContent, /1 visite · 1 site \(Sodeplax\)/);
  a.run('state.role="director";state.site="marzin";render()');
  assert.ok(a.run("etCan()"));
  assert.equal(a.run("etKey()"), "marzin", "Chaque site a son propre rapport");
  a.run('state.role="teamlead";render()');
  assert.equal(a.run('uxTabs(uxStages().find(s=>s.id==="observer")).some(t=>t.key==="etonnement")'), false);
  assert.notEqual(a.run("state.terrainTab"), "etonnement");
});


test("TPM 8.15 · machines, étiquettes bleues et rouges, standard CIL et tournée, pannes MTTR / MTBF, droits", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.terrainTab="tpm";state.view="terrain";render()');
  assert.ok(a.run('uxTabs(uxStages().find(s=>s.id==="observer")).some(t=>t.key==="tpm"&&t.set.terrainTab==="tpm")'), "Onglet TPM dans Observer");
  assert.ok(a.q(".cs-empty [data-tm-newm]"), "Page vide : ajouter ses machines");
  a.click(".cs-empty [data-tm-newm]");
  a.fill("#tmMName", "Plaqueuse de chants 2");
  a.click('[data-tm-crit="A"]');
  a.submit("#tmMForm");
  const mid = a.run("data.machines[0].id");
  assert.equal(mid, "MA-001");
  assert.ok(a.q(`.tm-sheet[data-tm-id="${mid}"] [data-tm-cadd]`), "Une nouvelle machine ouvre son standard CIL");
  for (const [k, w, f] of [["nettoyer", "Guide du chant", "poste"], ["lubrifier", "Glissières", "semaine"]]) {
    a.click("[data-tm-cadd]");
    const pid = a.run("data.machines[0].cil.at(-1).id");
    a.fill(`[data-tm-cp="${pid}"] [data-tm-cwhat]`, w);
    a.click(`[data-tm-cp="${pid}"] [data-tm-ckind="${k}"]`);
    a.click(`[data-tm-cp="${pid}"] [data-tm-cfreq="${f}"]`);
  }
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.machines[0].cil.map(p=>[p.kind,p.what,p.freq]))")), [["nettoyer", "Guide du chant", "poste"], ["lubrifier", "Glissières", "semaine"]]);
  assert.equal(a.run("tmCilDays(data.machines[0])"), 1, "Fréquence la plus courte");
  assert.equal(a.run("tmCilDue(data.machines[0])"), a.run("today()"), "Première tournée due aujourd’hui");
  a.click("[data-tm-cprint]");
  assert.match(a.q(".tm-cilsheet").textContent, /Plaqueuse de chants 2[\s\S]*Guide du chant[\s\S]*Chaque poste/);
  a.run(`tmOpen("${mid}","tournee")`);
  a.click("[data-tm-start]");
  const [p1, p2] = JSON.parse(a.run("JSON.stringify(data.machines[0].cil.map(p=>p.id))"));
  a.click(`[data-tm-pt="${p1}"] [data-tm-v="ok"]`);
  assert.ok(a.q("[data-tm-finish]").disabled, "Tous les points avant de terminer");
  a.click(`[data-tm-pt="${p2}"] [data-tm-v="ano"]`);
  a.fill(`[data-tm-pt="${p2}"] [data-tm-anotext]`, "Fuite de graisse glissière gauche");
  a.click(`[data-tm-pt="${p2}"] [data-tm-anocolor="rouge"]`);
  a.run(`closeModal();tmOpen("${mid}")`);
  assert.ok(a.q("[data-tm-finish]"), "La tournée en cours reprend à la réouverture");
  a.click("[data-tm-finish]");
  const tag = JSON.parse(a.run("JSON.stringify(data.tpmTags[0])"));
  assert.deepEqual([tag.id, tag.color, tag.kind, tag.what, tag.machine_id], ["ET-001", "rouge", "fuite", "Fuite de graisse glissière gauche", mid]);
  assert.equal(tag.due_date, a.run("tmAddDays(today(),14)"));
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.cilRuns[0].results)")), { [p1]: "ok", [p2]: "ano" });
  assert.equal(a.run("tmCilDue(data.machines[0])"), a.run("tmAddDays(today(),1)"));
  a.run('closeModal();tmTagForm()');
  a.fill("#tmTagWhat", "Carter fissuré");
  a.click('[data-tm-kind="securite"]');
  assert.ok(a.q('[data-tm-color="rouge"].on'), "Sécurité : étiquette rouge d’office");
  assert.equal(a.q("#tmTagDue").value, a.run("tmAddDays(today(),1)"), "Sécurité : à traiter demain");
  a.submit("#tmTagForm");
  assert.equal(a.run("tmOpenTags().length"), 2);
  a.run('tmTagForm("ET-001")');
  a.click("[data-tm-fixit]");
  assert.equal(a.run('data.tpmTags.find(t=>t.id==="ET-001").status'), "ouverte", "Pas de clôture sans dire ce qui a été fait");
  a.fill("#tmTagFix", "Joint changé");
  a.click("[data-tm-fixit]");
  assert.deepEqual(JSON.parse(a.run('JSON.stringify((({status,fix})=>[status,fix])(data.tpmTags.find(t=>t.id==="ET-001")))')), ["traitee", "Joint changé"]);
  a.run(`const h=36e5;commitData(()=>{data.breakdowns=[{id:"PA-001",machine_id:"${mid}",site_id:"marzin",start:new Date(Date.now()-20*24*h).toISOString(),end:new Date(Date.now()-20*24*h+2*h).toISOString()},{id:"PA-002",machine_id:"${mid}",site_id:"marzin",start:new Date(Date.now()-10*24*h).toISOString(),end:new Date(Date.now()-10*24*h+h).toISOString()}]});closeModal();tmDownForm(null,{machineId:"${mid}"})`);
  a.fill("#tmDownCause", "Disjonction moteur");
  a.submit("#tmDownForm");
  assert.ok(a.q(".tm-downbox"), "Panne en cours affichée sur la machine");
  a.run(`tmDownForm(null,{machineId:"${mid}"})`);
  a.submit("#tmDownForm");
  assert.equal(a.run("data.breakdowns.length"), 3, "Une seule panne en cours par machine");
  a.run(`tmOpen("${mid}","pannes")`);
  a.click("[data-tm-restart]");
  const s = JSON.parse(a.run(`JSON.stringify(tmStats("${mid}"))`));
  assert.equal(s.n, 3);
  assert.equal(Math.round(s.lost * 10) / 10, 3);
  assert.equal(Math.round(s.mttr * 10) / 10, 1);
  assert.equal(Math.round(s.mtbf / 24), 10, "MTBF calendaire : 10 jours entre deux pannes");
  a.run('closeModal();state.view="home";render()');
  a.run(`commitData(()=>data.breakdowns.unshift({id:"PA-009",machine_id:"${mid}",site_id:"marzin",start:new Date(Date.now()-36e5).toISOString(),end:null}));render()`);
  assert.match(a.q(".jn-watch").textContent, /Plaqueuse de chants 2 à l’arrêt/, "Machine en panne dans « À surveiller »");
  a.run('state.view="terrain";state.terrainTab="tpm";render()');
  assert.match(a.q(".tm-card").textContent, /En panne depuis/);
  assert.ok(a.q(".tm-pareto"), "Pareto des heures perdues");
  assert.equal(a.run("osIntegrity(data).length"), 0);
  assert.equal(a.run("validateImport(JSON.parse(JSON.stringify(data))).tpmTags.length"), 2, "Sauvegarde : étiquettes conservées");
  a.run('state.role="operator";render()');
  assert.ok(!a.q("[data-tm-newm]"), "Un opérateur n’ajoute pas de machine");
  if (a.run("tmCan()") && a.run('tmWritable("marzin")')) {
    a.run(`tmOpen("${mid}","cil")`);
    assert.ok(!a.q("[data-tm-cadd]"), "Ni ne modifie le standard CIL");
    assert.ok(a.q("[data-tm-cwhat]").disabled);
  }
});

test("Polyvalence 8.16 · équipe, postes reliés aux standards, I-L-U-O avec historique, postes fragiles, priorités, formation au standard", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";commitData(()=>data.documents.unshift({id:"DOC-077",site_id:"marzin",type:"STANDARD",title:"Plaqueuse 2 · entrée",owner:"X",status:"Validé",version:2,problem_id:null,structured_data:{st:{steps:[],trained:[]}},created_at:now(),updated_at:now()}));state.view="training";state.pvOn=false;render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="perenniser")).map(t=>[t.key,uxTabActive(t)]))'));
  assert.deepEqual(tabs.filter(([k]) => ["training", "polyvalence"].includes(k)), [["training", true], ["polyvalence", false]], "Onglet Polyvalence à côté de Formation, états distincts");
  a.run("state.pvOn=true;render()");
  a.click(".cs-empty [data-pv-newteam]");
  a.fill("#pvName", "Finition · matin");
  a.submit("#pvNew");
  const tid = a.run("data.skillsMatrix[0].id");
  assert.equal(tid, "PV-001");
  a.click('[data-pv-fromstd="DOC-077"]');
  for (const s of ["Ponceuse", "Emballage"]) { a.fill("[data-pv-addstin]", s); a.submit("[data-pv-addst]"); }
  for (const n of ["Kévin", "Sandrine", "Mehdi"]) { a.fill("[data-pv-addpin]", n); a.submit("[data-pv-addp]"); }
  a.fill("[data-pv-addpin]", "kévin");
  a.submit("[data-pv-addp]");
  assert.equal(a.run("data.skillsMatrix[0].people.length"), 3, "Pas de doublon de personne");
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.skillsMatrix[0].stations.map(s=>[s.name,s.standard_id,s.target]))")), [["Plaqueuse 2 · entrée", "DOC-077", 2], ["Ponceuse", null, 2], ["Emballage", null, 2]]);
  const [s1, s2] = JSON.parse(a.run("JSON.stringify(data.skillsMatrix[0].stations.map(s=>s.id))"));
  a.click(`[data-pv-st="${s2}"] [data-pv-sttarget="1"]`);
  assert.equal(a.run("data.skillsMatrix[0].stations[1].target"), 1);
  a.click("[data-pv-done]");
  assert.ok(a.q(".pv-matrix"), "La matrice s’affiche");
  const [k, sa] = JSON.parse(a.run("JSON.stringify(data.skillsMatrix[0].people.map(p=>p.id))"));
  a.click(`.pv-matrix [data-pv-cell="${k}|${s1}"]`);
  a.fill("#pvBy", "Camille");
  a.click('[data-pv-lv="2"]');
  assert.equal(a.run(`data.skillsMatrix[0].levels["${k}|${s1}"].lvl`), 2);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(stOf(stDoc("DOC-077")).trained.map(x=>[x.name,x.version,x.by]))')), [["Kévin", 2, "Camille"]], "Formation enregistrée sur la version en vigueur du standard");
  a.click(`.pv-matrix [data-pv-cell="${k}|${s1}"]`);
  assert.ok(!a.q("#pvStd"), "Déjà formé : pas de deuxième enregistrement");
  a.click('[data-pv-lv="4"]');
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify([data.skillsMatrix[0].levels["${k}|${s1}"].lvl,data.skillsMatrix[0].levels["${k}|${s1}"].hist.map(h=>h.lvl)])`)), [4, [2]], "Historique gardé");
  a.click(`.pv-matrix [data-pv-cell="${sa}|${s1}"]`);
  a.click('[data-pv-lv="3"]');
  a.click(`.pv-matrix [data-pv-cell="${sa}|${s2}"]`);
  a.click('[data-pv-lv="2"]');
  const st = JSON.parse(a.run("JSON.stringify((s=>({fragile:s.fragile,under:s.under,prio:s.priorities.map(c=>c.p.name+'>'+c.x.s.name)}))(pvStats(data.skillsMatrix[0])))"));
  assert.deepEqual(st, { fragile: 2, under: 2, prio: ["Sandrine>Ponceuse"] }, "Ponceuse et Emballage sans autonome : fragiles ; Sandrine (L) à former en priorité");
  assert.match(a.q(".pv-foot").textContent, /2\/2[\s\S]*0\/1[\s\S]*0\/2/);
  assert.ok(a.q(".pv-prio [data-pv-cell]"), "Liste « À former en priorité »");
  a.run('state.view="home";render()');
  assert.match(a.q(".jn-watch").textContent, /2 postes fragiles · Finition · matin/);
  a.run("pvPrint(state.pvTeam)");
  assert.match(a.q(".pv-sheet").textContent, /MATRICE DE POLYVALENCE[\s\S]*Kévin/);
  assert.ok(!a.q(".pv-sheet [data-pv-cell]"), "Matrice à afficher en lecture seule");
  assert.equal(a.run("validateImport(JSON.parse(JSON.stringify(data))).skillsMatrix.length"), 1);
  assert.equal(a.run("osIntegrity(data).length"), 0);
  a.run('closeModal();state.role="operator";state.view="training";state.pvOn=true;render()');
  assert.ok(!a.q(".pv-matrix button[data-pv-cell]"), "Un opérateur consulte sans modifier");
});

test("Idées 8.17 · idée en 30 secondes, réponse sous 48 h, c’est fait, gain validé, bravo, fiche Kaizen et réponse visible par l’auteur", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="operator";state.view="home";render()');
  a.click('[data-os="new"][data-args*="kaizens"]');
  assert.ok(a.q("#idForm"), "« Proposer une idée » ouvre le formulaire court");
  a.submit("#idForm");
  assert.equal(a.run("data.kaizens.filter(k=>k.proposer).length"), 0, "Pas d’idée sans phrase ni nom");
  a.fill("#idProblem", "Je marche chercher les vis au magasin");
  a.fill("#idIdea", "Un bac de vis au poste");
  a.click('[data-id-self="1"]');
  a.fill("#idName", "Nora Le Gall");
  a.submit("#idForm");
  const k = JSON.parse(a.run("JSON.stringify(data.kaizens[0])"));
  assert.deepEqual([k.title, k.problem, k.solution, k.status, k.owner, k.proposer, k.self, k.site_id], ["Un bac de vis au poste", "Je marche chercher les vis au magasin", "Un bac de vis au poste", "Idée", "Nora Le Gall", "Nora Le Gall", true, "marzin"]);
  assert.match(k.id, /^KAI-\d+$/);
  assert.equal(a.run("apMe()"), "Nora Le Gall", "Le nom est retenu pour la prochaine fois");
  assert.match(a.q(".id-mine").textContent, /En attente de réponse/, "L’auteur voit son idée sur l’accueil");
  a.run(`commitData(()=>data.kaizens.unshift({id:"KAI-090",site_id:"marzin",title:"Étiqueter les chariots",problem:"On cherche le chariot",status:"Idée",owner:"",proposer:"Kévin",created_at:new Date(Date.now()-60*36e5).toISOString(),updated_at:now(),kudos:[]}));state.role="lean";state.view="kaizen";state.idTab="idees";render()`);
  assert.match(a.q(".cs-summary").textContent, /2[\s\S]*en attente · 1 > 48 h/, "Compteur des idées sans réponse depuis plus de 48 h");
  assert.ok(a.q(".id-card.late"), "Idée en retard de réponse signalée");
  a.run('state.view="home";render()');
  assert.match(a.q(".jn-watch").textContent, /1 idée sans réponse depuis plus de 48 h/);
  a.run('state.view="kaizen";render()');
  a.click(`[data-id-go="${k.id}"]`);
  a.fill("#idBy", "Camille Martin");
  a.submit("#idGoForm");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify((x=>[x.status,x.decision.verdict,x.decision.by,x.owner])(data.kaizens.find(x=>x.id==="${k.id}")))`)), ["Mise en œuvre", "go", "Camille Martin", "Nora Le Gall"]);
  a.click('[data-id-no="KAI-090"]');
  a.submit("#idNoForm");
  assert.ok(!a.run('data.kaizens.find(x=>x.id==="KAI-090").decision'), "Pas de refus sans raison");
  a.click('[data-id-reason="Déjà prévu"]');
  a.fill("#idNoText", "Avec le rayonnage de janvier");
  a.submit("#idNoForm");
  assert.equal(a.run('data.kaizens.find(x=>x.id==="KAI-090").decision.reason'), "Déjà prévu · Avec le rayonnage de janvier");
  assert.equal(a.run("idMonth(idRows()).fast"), 50, "Une réponse sur deux sous 48 h");
  a.click(`[data-id-done="${k.id}"]`);
  a.fill("#idResult", "15 min gagnées par poste");
  a.submit("#idDoneForm");
  assert.ok(a.q(".id-sheet"), "La fiche Kaizen s’ouvre");
  assert.match(a.q(".id-sheet").textContent, /Un bac de vis au poste[\s\S]*Nora Le Gall[\s\S]*15 min gagnées/);
  assert.match(a.q("#modalTitle").textContent, /^Fiche Kaizen$/);
  a.run("closeModal();render()");
  assert.ok(a.q(`.id-wall [data-id-kudo="${k.id}"]`), "Sur le mur des idées réalisées");
  a.click(`.id-wall [data-id-kudo="${k.id}"]`);
  a.click(`.id-wall [data-id-kudo="${k.id}"]`);
  assert.equal(a.run(`data.kaizens.find(x=>x.id==="${k.id}").kudos.length`), 1, "Un bravo par personne");
  a.click(`.id-wall [data-id-validate="${k.id}"]`);
  assert.equal(a.run(`data.kaizens.find(x=>x.id==="${k.id}").status`), "Gain validé");
  a.click('[data-id-tab="registre"]');
  assert.ok(a.q(".os-phase-strip") && a.q(".page-head + .id-tabs"), "Le registre en neuf étapes reste accessible");
  a.run('localStorage.setItem(AP_ME_KEY,"Kévin");state.role="operator";state.view="home";render()');
  assert.match(a.q(".id-mine").textContent, /Pas maintenant : Déjà prévu/, "L’auteur voit la réponse");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});

test("Équilibrage 8.18 · takt, chrono par poste, Yamazumi, goulot, rééquilibrage avant / après, gaspillages en actions", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.projectsTab="equilibrage";state.view="projects";render()');
  assert.ok(a.run('uxTabs(uxStages().find(s=>s.id==="resoudre")).some(t=>t.key==="equilibrage"&&t.set.projectsTab==="equilibrage")'), "Onglet Équilibrage dans Résoudre");
  a.click(".cs-empty [data-eq-new]");
  a.fill("#eqTitle", "Ligne finition");
  a.fill("#eqOwner", "Amandine Colin");
  a.fill("#eqDemand", "480");
  a.fill("#eqAvail", "800");
  a.fill("#eqStations", "Débit\nPlaqueuse\nEmballage");
  a.submit("#eqNewForm");
  const id = a.run("data.balances[0].id");
  assert.equal(id, "EQ-001");
  assert.equal(a.run("eqTakt(data.balances[0])"), 100, "Takt = 800 min × 60 / 480 = 100 s");
  const [s1, s2, s3] = JSON.parse(a.run("JSON.stringify(data.balances[0].stations.map(s=>s.id))"));
  a.click(`[data-eq-st="${s1}"] [data-eq-chrono]`);
  a.run("data.balances[0].chrono.lap_at=new Date(Date.now()-40000).toISOString()");
  a.click("[data-eq-lapbtn]");
  a.run(`closeModal();eqOpen("${id}")`);
  assert.ok(a.q("[data-eq-lapbtn]"), "Le chrono reprend à la réouverture");
  a.run("data.balances[0].chrono.lap_at=new Date(Date.now()-30000).toISOString()");
  a.click("[data-eq-stop]");
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.balances[0].elements.map(e=>Math.round(e.sec)))")), [40, 30]);
  const add = (st, label, sec) => { a.fill(`[data-eq-st="${st}"] [data-eq-addin]`, label); a.fill(`[data-eq-st="${st}"] [data-eq-addsec]`, sec); a.submit(`[data-eq-st="${st}"] [data-eq-addel]`); };
  add(s2, "Plaquer", "70");
  add(s2, "Attendre la colle", "40");
  add(s3, "Filmer", "1:00");
  const wait = a.run('data.balances[0].elements.find(e=>e.label==="Attendre la colle").id');
  a.click(`[data-eq-el="${wait}"] [data-eq-kind="muda"]`);
  assert.equal(a.run(`data.balances[0].elements.find(e=>e.id==="${wait}").kind`), "muda");
  assert.equal(a.run('data.balances[0].elements.find(e=>e.label==="Filmer").sec'), 60, "Saisie en minutes:secondes");
  a.click('button[data-eq-tab="yamazumi"]');
  const c = JSON.parse(a.run("JSON.stringify((c=>({max:c.maxCt,neck:c.neck.s.name,cap:c.cap,eff:Math.round(c.eff*100),need:Math.round(c.need*10)/10}))(eqCalc(data.balances[0])))"));
  assert.deepEqual(c, { max: 110, neck: "Plaqueuse", cap: 436, eff: 73, need: 2.4 });
  assert.equal(a.all(".eq-study .eq-col").length, 3);
  assert.ok(a.q(".eq-study .eq-col.neck.over"), "Le goulot dépasse le takt");
  assert.match(a.q(".eq-alert").textContent, /dépasse le takt de 10 s/);
  a.click("[data-eq-baseline]");
  assert.ok(a.run("!!data.balances[0].baseline"), "État « avant » figé");
  const move = a.run('data.balances[0].elements.find(e=>e.label==="Plaquer").id');
  a.fill(`.sm-body > section [data-eq-el="${wait}"] [data-eq-sec]`, "10");
  assert.equal(a.run("eqCalc(data.balances[0]).maxCt"), 80, "Réduire le gaspillage");
  a.run(`eqOpen("${id}","yamazumi")`);
  a.fill(`.sm-body > section [data-eq-el="${move}"] [data-eq-move]`, s3);
  assert.equal(a.run(`data.balances[0].elements.find(e=>e.id==="${move}").station_id`), s3, "Élément déplacé vers un autre poste");
  a.click('button[data-eq-tab="bilan"]');
  assert.match(a.q(".eq-cmp").textContent, /Goulot[\s\S]*110 s[\s\S]*Capacité/, "Comparaison avant / après");
  a.click("[data-eq-mkactions]");
  const act = JSON.parse(a.run('JSON.stringify(data.actions.find(x=>x.balance_id==="EQ-001"))'));
  assert.deepEqual([act.title, act.origin_type, act.owner, act.origin_id || null], ["Supprimer : Attendre la colle", "Équilibrage", "Amandine Colin", null]);
  assert.equal(a.run("osIntegrity(data).length"), 0);
  a.click("[data-eq-print]");
  assert.match(a.q(".eq-sheet").textContent, /YAMAZUMI[\s\S]*Ligne finition/);
  assert.equal(a.run("validateImport(JSON.parse(JSON.stringify(data))).balances.length"), 1);
});

test("SQCDP au quotidien 8.19 · lettres vert / rouge, écart vers le TOP 15, calendriers du mois, point tenu avec présence, escalades et délai de réaction", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="teamlead";state.view="sqcdp";render()');
  assert.ok(a.q(".sj-panel"), "Le point du jour en tête du SQCDP");
  assert.equal(a.all(".sj-tile").length, 5);
  assert.equal(a.all("#meetingTimer").length, 0, "Un seul chronomètre de point");
  a.click('[data-sj-today="S"][data-sj-v="ok"]');
  a.click('[data-sj-today="Q"][data-sj-v="ko"]');
  assert.ok(a.q('[data-sj-note="Q"]'), "Un écart demande ce qui s’est passé");
  a.fill('[data-sj-note="Q"] [data-sj-notein]', "3 panneaux décollés");
  a.submit('[data-sj-note="Q"]');
  const d = JSON.parse(a.run('JSON.stringify(sjGet(today(),"Q"))'));
  assert.equal(d.status, "ko");
  const topic = JSON.parse(a.run(`JSON.stringify(data.topics.find(x=>x.id==="${d.topic_id}"))`));
  assert.deepEqual([topic.title, topic.axis, topic.status, topic.source], ["3 panneaux décollés", "Q", "Ouvert", "SQCDP"], "L’écart devient un sujet du TOP 15");
  assert.match(a.q("#appView").textContent, /TOP 15[\s\S]*3 panneaux décollés/);
  a.click('[data-sj-today="S"][data-sj-v="ok"]');
  assert.equal(a.run('sjGet(today(),"S")'), null, "Retoucher le même choix l’efface");
  a.run('document.querySelector(".sj-month").open=true');
  assert.equal(a.all('.sj-letter').length, 5, "Les cinq lettres du mois");
  assert.ok(a.q(`.sj-letter [data-sj-day="${a.run("today()")}"][data-sj-axis="Q"].ko`), "Le jour est rouge dans la lettre Q");
  if (a.run('today().slice(8,10)!=="01"')) {
    const past = a.run('today().slice(0,8)+"01"');
    a.click(`[data-sj-day="${past}"][data-sj-axis="D"]`);
    a.click('[data-sj-pick="ok"]');
    a.submit("#sjDayForm");
    assert.equal(a.run(`sjGet("${past}","D").status`), "ok", "Un jour passé se corrige");
  }
  assert.ok(a.q("[data-t5-open]"), "Lancer le TOP 5 (écran)");
  assert.equal(a.q(".sj-panel [data-timer]"), null, "un seul départ : l’écran TOP 5");
  a.run("state.timerStarted=Date.now()-8*60000;render()");
  a.click("[data-sj-close]");
  a.fill("#sjAddP", "Nora");
  a.click("[data-sj-addp]");
  a.submit("#sjCloseForm");
  const m = JSON.parse(a.run("JSON.stringify(data.meetings[0])"));
  assert.equal(Math.round(m.duration_s / 60), 8);
  assert.deepEqual(m.present, ["Nora"]);
  assert.equal(a.run("state.timerStarted"), null, "Le chronomètre s’arrête");
  assert.match(a.q(".sj-foot").textContent, /1 point tenu ce mois[\s\S]*8:0\d[\s\S]*1/);
  a.run(`commitData(()=>data.escalations.unshift({id:"ESC-900",site_id:"marzin",source_id:"${d.topic_id}",title:"Colle : technicien fournisseur",level:2,owner:"Directeur de site",status:"Ouverte",detail:"",result:"",due_date:today(),created_at:new Date(Date.now()-30*36e5).toISOString(),updated_at:now()}));render()`);
  assert.match(a.q(".sj-esc").textContent, /N2[\s\S]*Colle : technicien fournisseur[\s\S]*depuis 30 h/);
  a.click('[data-sj-answer="ESC-900"]');
  a.fill("#sjAns", "Technicien demain 7 h");
  a.submit("#sjAnsForm");
  assert.deepEqual(JSON.parse(a.run('JSON.stringify((e=>[e.status,e.result])(data.escalations.find(x=>x.id==="ESC-900")))')), ["Clos", "Technicien demain 7 h"]);
  assert.equal(Math.round(a.run("sjEscalations().avg")), 30, "Délai de réaction mesuré");
  a.run("sjPrint()");
  assert.equal(a.all(".sj-sheet .sj-letter").length, 5, "Lettres à afficher");
  assert.equal(a.run("osIntegrity(data).length"), 0);
  a.run('closeModal();state.role="lean";state.site="group";render()');
  assert.equal(a.run("state.site"), "group");
  assert.ok(!a.q(".sj-panel"), "Pas de point du jour en vue Groupe");
});

test("VSM pas à pas 8.20 · étapes, stocks en jours, carte normalisée et échelle de temps, état futur, éclairs Kaizen en actions", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";editDocument("DOC-VSM-demo")');
  assert.ok(a.q(".vf-map"));
  assert.equal(a.all(".vf-map .vf-box").length, 3, "Une boîte par processus");
  assert.equal(a.all(".vf-map .vf-tri").length, 4, "Un stock devant chaque processus et les produits finis");
  const c = JSON.parse(a.run('JSON.stringify((c=>({days:Math.round(c.days*100)/100,va:c.va,takt:Math.round(c.takt),neck:c.neck.name,over:c.over.map(p=>p.name)}))(vfCalc(vfDoc("DOC-VSM-demo").vsm.current)))'));
  assert.deepEqual(c, { days: 0.53, va: 105, takt: 70, neck: "Finition", over: ["Finition"] }, "Stocks en jours = pièces / demande ; goulot au-dessus du takt");
  a.click('button[data-vf-tab="flux"]');
  a.fill('[data-vf-m="fg_wip"]', "360");
  assert.equal(a.run('vfDoc("DOC-VSM-demo").vsm.current.fg_wip'), 360);
  const ids = JSON.parse(a.run('JSON.stringify(vfProc(vfDoc("DOC-VSM-demo").vsm.current).map(n=>n.id))'));
  a.fill(`[data-vf-n="${ids[0]}"] [data-vf-f="va"]`, "90");
  assert.equal(a.run(`vfProc(vfDoc("DOC-VSM-demo").vsm.current)[0].va`), 35, "La valeur ajoutée ne dépasse pas le cycle");
  a.fill(`[data-vf-n="${ids[1]}"] [data-vf-f="burst"]`, "SMED sur le changement de teinte");
  a.click("[data-vf-add]");
  const nn = a.run('vfProc(vfDoc("DOC-VSM-demo").vsm.current).at(-1).id');
  a.fill(`[data-vf-n="${nn}"] [data-vf-f="name"]`, "Emballage");
  a.click(`[data-vf-n="${nn}"] [data-vf-up]`);
  assert.equal(a.run('vfProc(vfDoc("DOC-VSM-demo").vsm.current).map(n=>n.name).join(">")'), "Préparation>Finition>Emballage>Contrôle", "Réordonner les étapes");
  a.click('button[data-vf-tab="carte"]');
  assert.ok(a.q(".vf-map .vf-burst"), "Éclair Kaizen sur la carte");
  assert.match(a.q(".vf-map").textContent, /Délai : 1,5 j[\s\S]*VA \/ délai/);
  a.click('[data-vf-mode="future"]');
  a.click("[data-vf-copy]");
  assert.equal(a.run('vfProc(vfDoc("DOC-VSM-demo").vsm.future).length'), 4, "État futur copié de l’actuel");
  assert.ok(!a.run('vfProc(vfDoc("DOC-VSM-demo").vsm.future).some(n=>n.burst)'), "Les éclairs restent sur l’état actuel");
  for (const id of JSON.parse(a.run('JSON.stringify(vfProc(vfDoc("DOC-VSM-demo").vsm.future).map(n=>n.id))'))) a.fill(`[data-vf-n="${id}"] [data-vf-f="wip"]`, "20");
  a.click('button[data-vf-tab="kaizen"]');
  assert.match(a.q(".eq-cmp").textContent, /Délai total[\s\S]*Stocks/);
  assert.ok(a.run('vfCalc(vfDoc("DOC-VSM-demo").vsm.future).days < vfCalc(vfDoc("DOC-VSM-demo").vsm.current).days'));
  a.click("[data-vf-b] [data-vf-act]");
  const act = JSON.parse(a.run('JSON.stringify(data.actions.find(x=>x.origin_id==="DOC-VSM-demo"&&x.origin_type==="VSM"))'));
  assert.equal(act.title, "SMED sur le changement de teinte");
  assert.equal(a.run("osIntegrity(data).length"), 0);
  assert.equal(a.run('osVsmMetrics(vfDoc("DOC-VSM-demo").vsm.current).capacities.length'), 4, "Le modèle reste lisible par l’éditeur libre");
});
test("Bonnes pratiques et OPL 8.21 · fiche prouvée, catalogue des sites, reprise choisie, essai, preuve, déploiement, OPL et personnes formées", (t) => {
  const a = app(t);
  a.run('state.site="marzin";state.role="lean";state.view="practices";render()');
  a.run("practiceForm()");
  assert.ok(a.q("#bpNewForm"), "Partager une pratique : formulaire court");
  a.fill("#bpTitle", "Bac de vis au poste");
  a.fill("#bpSummary", "Un bac par référence, rempli à chaque tournée");
  a.fill("#bpResLabel", "Déplacements par heure");
  a.fill("#bpResBefore", "3");
  a.fill("#bpResAfter", "0,5");
  a.submit("#bpNewForm");
  const id = a.run("data.practices[0].id");
  assert.equal(a.run(`bpHeadline(bpGet("${id}"))`), "Déplacements par heure : 3 → 0,5 (−83 %)");
  assert.ok(a.q("[data-bp-publish][disabled]"), "Pas de publication sans preuve ni conditions");
  a.fill('.bp-form [data-bp-f="evidence"]', "Relevé cinq jours avant et après");
  a.fill('.bp-form [data-bp-f="transfer"]', "Même famille de vis, un cariste en tournée");
  a.click('.bp-form [data-bp-effort="Moins d’un jour"]');
  a.fill("#bpValidator", "Lean Groupe");
  a.click("[data-bp-publish]");
  const p = JSON.parse(a.run(`JSON.stringify(bpGet("${id}"))`));
  assert.equal(p.status, "Publiée");
  assert.equal(p.effort, "Moins d’un jour");
  assert.ok(p.published_at);
  a.run('closeModal();state.role="director";state.site="le-moine";state.view="practices";render()');
  assert.match(a.q(".bp-card.fresh").textContent, /Nouveau pour vous[\s\S]*Bac de vis au poste/, "Les autres sites voient la pratique");
  a.click(`[data-bp-interest="${id}|le-moine"]`);
  const dep = a.run(`bpDep("${id}","le-moine").id`);
  assert.equal(a.run(`bpDepGet("${dep}").status`), "Candidate");
  a.click('[data-bp-pick="test"]');
  a.fill("#bpPilot", "Pilote Le Moine");
  a.submit("#bpTestForm");
  const d1 = JSON.parse(a.run(`JSON.stringify(bpDepGet("${dep}"))`));
  assert.equal(d1.status, "Test");
  assert.equal(a.run(`data.actions.find(x=>x.id==="${d1.action_id}").origin_id`), dep, "L’essai est une action du pilote");
  a.fill("#bpLb", "4");
  a.fill("#bpLa", "1");
  a.fill("#bpResult", "Un seul déplacement par heure");
  a.fill("#bpEvid", "Relevé cinq jours");
  a.fill("#bpImprove", "Code couleur par diamètre");
  a.fill("#bpVal", "Directeur Le Moine");
  a.submit("#bpProofForm");
  assert.equal(a.run(`bpDepGet("${dep}").status`), "Validée sur autre site");
  assert.equal(a.run(`data.actions.find(x=>x.id==="${d1.action_id}").status`), "Clôturée", "L’action d’essai est close avec la preuve");
  a.fill("#bpVal2", "Directeur Le Moine");
  a.submit("#bpDeployForm");
  assert.equal(a.run(`bpDepGet("${dep}").status`), "Déployée");
  a.run(`bpOpen("${id}","sites")`);
  assert.match(a.q(".bp-impr").textContent, /Le Moine[\s\S]*Code couleur par diamètre/, "L’amélioration revient au site d’origine");
  a.run(`closeModal();state.role="lean";state.site="group";bpInterest("${id}","ag-deco")`);
  a.click('[data-bp-pick="na"]');
  a.click('[data-bp-reason="Pas le même produit"]');
  a.submit("#bpNaForm");
  assert.equal(a.run(`bpDep("${id}","ag-deco").na_reason`), "Pas le même produit");
  a.run('closeModal();state.view="deployment";render()');
  assert.ok(a.q(".bp-matrix .bp-dot.s-done") && a.q(".bp-matrix .bp-dot.s-na"), "Tableau pratiques × sites");
  a.run('state.role="teamlead";state.site="marzin";state.view="training";render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStageOf("training")).map(x=>x.label))'));
  assert.ok(tabs.includes("OPL"), "Onglet OPL pour le chef d’équipe");
  a.run("olNew()");
  a.click('[data-ol-k="securite"]');
  a.fill("#olTitle", "Couper la machine avant de dégager une pièce");
  a.fill("#olAuthor", "Chef d’équipe test");
  a.submit("#olNewForm");
  const oid = a.run("data.opls[0].id");
  assert.equal(a.run(`olGet("${oid}").kind`), "securite");
  assert.ok(a.q("[data-ol-validate][disabled]"), "Pas de validation sans photo ni point clé");
  a.run(`olSave("${oid}",o=>{o.photo_a="data:image/png;base64,iVBORw0KGgo="});olOpen("${oid}")`);
  a.fill('[data-ol-pt="0"]', "Arrêt d’urgence, puis consignation");
  a.fill("#olValidator", "Chef d’équipe test");
  a.click("[data-ol-validate]");
  assert.equal(a.run(`olGet("${oid}").status`), "validee");
  assert.match(a.run("jnWatchCard()"), /OPL à présenter/, "L’accueil rappelle l’OPL à présenter");
  a.fill("#olAddName", "Opérateur test");
  a.submit("[data-ol-add]");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(olCurrent(olGet("${oid}")).map(x=>[x.name,x.by,x.version]))`)), [["Opérateur test", "Chef d’équipe test", 1]]);
  a.run(`olOpen("${oid}","lecon")`);
  a.click("[data-ol-revise]");
  a.click("[data-ol-revise]");
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify([olGet("${oid}").version,olGet("${oid}").status,olCurrent(olGet("${oid}")).length])`)), [2, "brouillon", 0], "Nouvelle version : à revalider et à reformer");
  assert.equal(a.run("osIntegrity(data).length"), 0);
  const b = app(t, a.stored());
  assert.equal(b.run(`bpDep("${id}","le-moine").status`), "Déployée");
  assert.equal(b.run("data.opls.length"), 1);
});
test("Bibliothèque 8.22 · chaque fiche mène à son outil, « J’ai un problème » complet, nouvelles fiches OPL, polyvalence et idées", (t) => {
  const a = app(t);
  assert.equal(a.run("LEAN_MODULES.length"), 33);
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(LEAN_ROUTES.filter(r=>!libRouteTool(r)).map(r=>r[0]))")), [], "Chaque situation mène à une fiche existante");
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(Object.keys(LIB_MAP).filter(k=>!LEAN_MODULES.some(t=>t.id===k)))")), []);
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(Object.values(LIB_MAP).flat().filter(k=>!LIB_GO[k]))")), []);
  a.run('state.role="lean";state.site="marzin";state.view="tools";state.toolId=null;render()');
  assert.match(a.q("#appView h1").textContent, /33 fiches/);
  assert.equal(a.all(".lib-routes [data-route-tool]").length, 18, "Toutes les situations sont proposées");
  a.click('.lib-routes [data-route-tool="repeat-error"]');
  assert.equal(a.run("state.toolId"), "opl");
  assert.ok(a.q('[data-lib-go="opl"]') && a.q('[data-lib-go="opls"]'));
  a.run('state.toolId="five-s";render()');
  a.click('[data-lib-go="fives"]');
  assert.deepEqual(JSON.parse(a.run("JSON.stringify([state.view,state.auditsTab])")), ["audits", "5s"], "La fiche 5S ouvre le 5S refait");
  a.run('state.view="tools";state.toolId="vsm";render()');
  assert.match(a.q("#appView").textContent, /Carte de l’état actuel/, "Livrables en français");
  a.click('[data-lib-go="vsm"]');
  assert.match(a.q("#modalTitle").textContent, /VSM/);
  a.run('closeModal();state.toolId="ai";render()');
  assert.ok(!a.q("[data-lib-go]") && a.q(".lib-go.quiet"), "Une fiche sans outil le dit");
  a.run('state.role="director";state.toolId="multisite";render()');
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(libGoes("multisite"))')), ["practices", "deployment"]);
  a.run('state.role="dg"');
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(libGoes("problem-solving"))')), [], "Pas de création pour un profil en lecture");
});
test("Signal terrain 8.23 · signaler en 20 secondes, prise en charge à l’heure, réglé, réponse visible par l’auteur, ça revient", (t) => {
  const a = app(t);
  a.run('state.role="operator";state.site="marzin";state.view="home";render()');
  a.click(".jn-signal [data-new-signal]");
  assert.ok(a.q("#signalForm [data-sg-sev]"), "Formulaire court : C’est…");
  a.fill("#signalDescription", "Le carter ne ferme plus");
  a.click('[data-sg-sev="Critique"]');
  assert.equal(a.q(".sg-danger").hidden, false, "Un danger : consignes et réaction immédiate");
  a.click('[data-sg-now="Machine arrêtée"]');
  a.click('[data-sg-type="Sécurité"]');
  a.fill("#signalZone", "Scie S1");
  a.fill("#signalAuthor", "Opérateur test");
  a.submit("#signalForm");
  const s = JSON.parse(a.run("JSON.stringify(data.signals[0])"));
  assert.deepEqual([s.severity, s.type, s.zone, s.author, s.immediate_action, s.state], ["Critique", "Sécurité", "Scie S1", "Opérateur test", "Machine arrêtée", "Nouveau"]);
  assert.equal((Date.parse(s.ack_due_at) - Date.parse(s.created_at)) / 6e4, 15, "Un danger : prise en charge sous 15 minutes");
  assert.match(a.q("#modalTitle").textContent, /Signal envoyé/);
  a.run('closeModal();state.role="teamlead";state.terrainTab="signals";state.view="terrain";render()');
  a.click(`.sg-panel [data-sg-take="${s.id}"]`);
  assert.equal(a.run(`data.signals.find(x=>x.id==="${s.id}").state`), "Pris en compte");
  assert.ok(a.run(`!!data.signals.find(x=>x.id==="${s.id}").taken_at`));
  a.run(`openSignal("${s.id}")`);
  assert.ok(a.q(".sg-ack.ok"));
  a.click("[data-sg-fix]");
  a.fill("#sgFixText", "Carter réparé et contrôlé");
  a.submit("#sgFixForm");
  assert.equal(a.run(`data.signals.find(x=>x.id==="${s.id}").state`), "Résolu");
  a.run('const t=new Date(Date.now()-6*36e5).toISOString();data.signals.unshift({id:"S-900",site_id:"marzin",type:"Qualité",severity:"Normale",description:"Rayures sur les chants",zone:"Plaqueuse",author:"B",owner:"Chef",state:"Nouveau",created_at:t,updated_at:t});for(let i=0;i<3;i++){const d=new Date(Date.now()-(i+1)*864e5).toISOString();data.signals.push({id:"S-91"+i,site_id:"marzin",type:"Flux",severity:"Normale",description:"Chariot absent",zone:"Plaqueuse ",author:"X",owner:"Chef",state:"Clos",created_at:d,updated_at:d});}');
  assert.equal(a.run('sgLate(data.signals[0])'), true, "Normale : 4 heures, au-delà en retard");
  assert.match(a.run("jnWatchCard()"), /en retard de prise en charge/);
  a.run('state.role="lean";state.view="terrain";render()');
  assert.ok(a.q('[data-sg-repeat]'), "Ça revient : trois signaux au même endroit");
  a.run('state.role="operator";state.view="home";render()');
  assert.match(a.q(".sg-mine").textContent, /Réglé : Carter réparé et contrôlé/, "L’auteur voit la réponse");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Relève d’équipe 8.24 · six points en un geste, en cours proposé, priorités, reprise confirmée avec question", (t) => {
  const a = app(t);
  a.run('state.role="teamlead";state.site="marzin";state.view="daily";render()');
  a.run('data.machines=[{id:"MA-T1",site_id:"marzin",name:"Plaqueuse test",created_at:now(),updated_at:now()}];data.breakdowns=[{id:"PA-T1",site_id:"marzin",machine_id:"MA-T1",start:new Date(Date.now()-30*6e4).toISOString(),end:null,created_at:now(),updated_at:now()}]');
  a.click("[data-new-handover]");
  assert.ok(a.q("#rlForm"));
  assert.ok(a.q('[data-rl-cat="machines"].s-ko'), "Une machine en panne est proposée en problème");
  assert.match(a.q('[data-rl-cat="machines"] [data-rl-note]').value, /Plaqueuse test à l’arrêt/);
  assert.ok(a.q('.rl-items input[value="S-041"]').checked, "Le signal critique ouvert est proposé");
  const before = a.run("data.handovers.length");
  a.submit("#rlForm");
  assert.equal(a.run("data.handovers.length"), before, "Pas de relève sans les six points");
  for (const k of ["securite", "qualite", "production", "matiere", "effectif"]) a.click(`[data-rl-cat="${k}"] [data-rl-s="ok"]`);
  a.fill('[data-rl-pr="0"]', "Remettre la plaqueuse en route avec la maintenance");
  a.submit("#rlForm");
  const h = JSON.parse(a.run("JSON.stringify(data.handovers[0])"));
  assert.equal(h.status, "Transmise");
  assert.equal(h.checks.machines.s, "ko");
  assert.match(h.situation, /^Machines : Plaqueuse test/);
  assert.equal(h.priorities, "1. Remettre la plaqueuse en route avec la maintenance");
  assert.ok(h.linked_ids.includes("S-041"));
  a.click(`[data-rl-read="${h.id}"]`);
  assert.match(a.q(".rl-facts li.s-ko").textContent, /Machines/);
  a.fill("#rlAckNote", "La maintenance arrive quand ?");
  a.submit("#rlAckForm");
  const r = JSON.parse(a.run(`JSON.stringify(data.handovers.find(x=>x.id==="${h.id}"))`));
  assert.deepEqual([r.status, r.ack_note], ["Reprise", "La maintenance arrive quand ?"]);
  assert.ok(r.acknowledged_at);
  a.run('handoverForm(data.handovers.find(x=>x.id==="REL-MAR-001"))');
  assert.ok(a.q("#handoverForm"), "Une ancienne relève s’ouvre dans le formulaire complet");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Chantiers 8.25 · charte et indicateur, étapes par méthode, point de la semaine, mesures, gain validé, tenue, clôture", (t) => {
  const a = app(t);
  a.run('state.role="lean";state.site="marzin";state.projectsTab="projects";state.view="projects";render()');
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(data.projects.map(p=>cdIdx(p)))")), [1, 2], "Les chantiers existants gardent leur étape");
  a.click("[data-cd-new]");
  a.fill("#cdTitle", "Réduire le changement de série");
  a.click('[data-cd-m="SMED"]');
  a.fill("#cdKLabel", "Durée du changement");
  a.fill("#cdKBase", "52");
  a.fill("#cdKTarget", "35");
  a.fill("#cdKUnit", "min");
  a.fill("#cdOwner", "Pilote test");
  a.submit("#cdNewForm");
  const id = a.run("data.projects[0].id");
  assert.equal(a.run(`cdGet("${id}").baseline`), "Durée du changement : 52 min");
  a.fill('[data-cd-c="problem"]', "52 min par changement, 6 par semaine");
  assert.equal(a.run(`cdGet("${id}").charter.problem`), "52 min par changement, 6 par semaine");
  a.click('[data-cd-tab="avancement"]');
  assert.match(a.q(".cd-steplist").textContent, /Filmer et chronométrer/, "Étapes adaptées au SMED");
  a.click('[data-cd-step="cadrer"]');
  a.click('[data-cd-step="mesurer"]');
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify([cdGet("${id}").status,cdGet("${id}").progress])`)), ["Analyse", 33]);
  a.click('[data-cd-w="block"]');
  a.submit("[data-cd-wform]");
  assert.equal(a.run(`cdGet("${id}").weather.length`), 0, "Bloqué sans dire pourquoi : refusé");
  a.click('[data-cd-w="block"]');
  a.fill("#cdWNote", "Attente de la maintenance");
  a.submit("[data-cd-wform]");
  assert.equal(a.run(`cdGet("${id}").status`), "Bloqué");
  a.click('[data-cd-tab="resultat"]');
  a.fill("#cdMVal", "33");
  a.submit("[data-cd-mform]");
  assert.ok(a.run(`cdHit(cdKpi(cdGet("${id}")),33)`), "33 min tient la cible de 35 min (plus bas, c’est mieux)");
  a.fill("#cdVBy", "Directeur test");
  a.click("[data-cd-verify]");
  assert.match(a.run(`cdGet("${id}").result`), /52 min → 33 min/);
  assert.ok(a.q(".cd-sustain"), "Tenue à 30, 60 et 90 jours");
  assert.equal(a.q("[data-cd-close]"), null, "Pas de clôture avant d’avoir standardisé");
  a.run(`cdSave("${id}",p=>{for(const k of CD_KEYS.slice(0,5))p.steps_done[k]=today();});cdOpen("${id}","resultat")`);
  a.click("[data-cd-close]");
  assert.equal(a.run(`cdGet("${id}").status`), "Clos");
  a.run('closeModal();render()');
  assert.match(a.q("#appView").textContent, /Chantiers clos · 1/);
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Formation 8.26 · échéances (expirées, sous 30 jours, à valider), session en une fois, dossier avec postes, standards et OPL", (t) => {
  const a = app(t);
  a.run('const d=n=>auAddDays(n);data.trainingRecords.push({id:"REC-901",person_id:"PER-002",training_id:"FOR-009",date:d(-760),trainer:"X",attendance:"Présent",level:4,status:"Validé",evidence:"Audit",validated_by:"Y",validated_at:d(-760),expires_at:d(-30)},{id:"REC-902",person_id:"PER-001",training_id:"FOR-002",date:d(-700),trainer:"X",attendance:"Présent",level:4,status:"Validé",evidence:"Animation",validated_by:"Y",validated_at:d(-700),expires_at:d(12)})');
  a.run('state.role="lean";state.site="marzin";state.pvOn=false;state.oplOn=false;state.trainingTab="catalog";state.view="training";render()');
  assert.match(a.q('[data-training-tab="due"]').textContent, /Échéances · 2/);
  a.click('[data-training-tab="due"]');
  const due = JSON.parse(a.run("JSON.stringify((d=>[d.expired.length,d.soon.length,d.pending.length])(frDue()))"));
  assert.deepEqual(due, [1, 1, 1], "Une expirée, une sous 30 jours, une formation suivie à valider");
  assert.ok(a.q('.fr-row.late [data-fr-renew="PER-002|FOR-009"]'));
  a.click('[data-fr-plan="REC-902"]');
  assert.match(a.q("#actionTitle").value, /^Recycler Pierre Thibaut/);
  a.run("closeModal()");
  a.click("[data-fr-session]");
  a.fill("#frTraining", "FOR-009");
  a.fill("#frTrainer", "Formateur test");
  a.click("[data-fr-all]");
  a.click('[data-fr-st="Validé"]');
  a.submit("#frForm");
  assert.equal(a.run("data.trainingRecords.filter(r=>r.session_id).length"), 0, "Valider exige la preuve");
  a.fill("#frEvidence", "Audit 5S réalisé en autonomie");
  a.submit("#frForm");
  const recs = JSON.parse(a.run("JSON.stringify(data.trainingRecords.filter(r=>r.session_id).map(r=>[r.person_id,r.status,!!r.expires_at]))"));
  assert.equal(recs.length, 2);
  assert.ok(recs.every((r) => r[1] === "Validé" && r[2]), "Une fiche validée par présent, avec son échéance");
  assert.equal(a.run("frDue().expired.length"), 0, "Le recyclage efface l’expiration");
  a.run('data.skillsMatrix=[{id:"PV-T",site_id:"marzin",name:"Équipe test",stations:[{id:"ST1",name:"Plaqueuse",target:2}],people:[{id:"PP1",name:"Camille Martin",person_id:"PER-002"}],levels:{"PP1|ST1":{lvl:3,date:today(),by:"X"}}}];openTrainingPerson("PER-002")');
  assert.match(a.q(".fr-skills").textContent, /Plaqueuse · Équipe test[\s\S]*U · autonome/);
  assert.match(a.run("jnWatchCard()"), /qualification à renouveler/);
});
test("Roadmap 8.27 · revue mensuelle : chaque jalon et priorité passés en revue, pourquoi, décision en action, ce qu’on retient, prochaine revue", (t) => {
  const a = app(t);
  a.run('data.hoshinPlan={source:{file:"plan-fictif.xlsx",imported_at:now(),by:"Test"},title:"Programme fictif",phases:[],milestones:[{name:"Jalon fictif A",date:auAddDays(-5),criteria:"A"},{name:"Jalon fictif B",date:auAddDays(40),criteria:"B"}],governance:[],risks:[],macroSteps:[],tracks:{},macroTasks:[],topics:[],waves:{},sequoia:{}}');
  a.run('state.role="lean";state.site="group";state.view="home";render()');
  assert.match(a.run("jnWatchCard()"), /Revue de la roadmap à faire/);
  a.run('state.view="roadmap";render()');
  assert.equal(a.q('.page-head ~ * .grid.cols-4 .card b')?.textContent === "Résultat", false, "Le panneau statique a disparu");
  a.click("[data-rv-new]");
  const refs = JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("[data-rv]")].map(x=>x.dataset.rv))'));
  assert.deepEqual(refs.slice(0, 2), ["M0", "M1"], "Les jalons ouverts du plan d’abord");
  assert.ok(a.q('[data-rv="M0"] .rv-late.on'), "Un jalon dépassé arrive en retard");
  a.submit("#rvForm");
  assert.equal(a.run("(data.roadmapReviews||[]).length"), 0, "Chaque point doit avoir un statut");
  a.click('[data-rv="M0"] [data-rv-s="done"]');
  for (const r of refs.slice(1)) a.click(`[data-rv="${r}"] [data-rv-s="ok"]`);
  const pr = refs[2];
  a.click(`[data-rv="${pr}"] [data-rv-s="late"]`);
  a.submit("#rvForm");
  assert.equal(a.run("(data.roadmapReviews||[]).length"), 0, "En retard sans dire pourquoi : refusé");
  a.fill(`[data-rv="${pr}"] [data-rv-note]`, "Sources pas encore validées");
  a.fill(`[data-rv="${pr}"] [data-rv-dec]`, "Atelier KPI avec les directeurs");
  a.run(`(()=>{const c=[...document.querySelectorAll("[data-rv]")].find(b=>b.dataset.rv==="${pr}").querySelector("[data-rv-act]");c.checked=true;c.dispatchEvent(new Event("change"))})()`);
  a.fill(`[data-rv="${pr}"] [data-rv-who]`, "Pilote test");
  a.fill("#rvLearning", "Les jalons datés tiennent mieux");
  a.submit("#rvForm");
  const r = JSON.parse(a.run("JSON.stringify(data.roadmapReviews[0])"));
  assert.equal(r.items.length, refs.length);
  assert.equal(a.run("data.hoshinPlan.milestones[0].done"), true, "Atteint coche le jalon");
  const act = r.items.find((x) => x.action_id);
  assert.equal(a.run(`data.actions.find(x=>x.id==="${act.action_id}").title`), "Atelier KPI avec les directeurs");
  assert.equal(a.run(`data.actions.find(x=>x.id==="${act.action_id}").origin_id`), pr);
  assert.match(a.q(".rv-panel").textContent, /En retard : Sources pas encore validées[\s\S]*Les jalons datés tiennent mieux/);
  assert.doesNotMatch(a.run("jnWatchCard()"), /Revue de la roadmap à faire/, "Revue faite : plus de rappel avant la prochaine");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Avant / après 8.28 · photos côte à côte, reprise d’une idée, fiche d’une page, partage aux sites", (t) => {
  const a = app(t);
  a.run('state.role="lean";state.site="marzin";data.kaizens.unshift({id:"KAI-T1",site_id:"marzin",title:"Bac de vis au poste",problem:"Vis cherchées au magasin",solution:"Un bac par référence",result:"3 déplacements par heure en moins",before_photo:"data:image/png;base64,AAAA",after_photo:"data:image/png;base64,BBBB",status:"Gain validé",owner:"Opérateur test",created_at:now(),updated_at:now()})');
  a.run('osCreateFrom("KAI-T1","beforeafter")');
  assert.equal(a.q("#baTitle").value, "Bac de vis au poste", "Reprend le titre de l’idée");
  assert.equal(a.q("#baProblem").value, "Vis cherchées au magasin");
  assert.equal(a.q("#baGain").value, "3 déplacements par heure en moins");
  assert.equal(a.all("#baSlots img").length, 2, "Reprend les deux photos de l’idée");
  a.submit("#beforeAfterForm");
  const doc = JSON.parse(a.run('JSON.stringify(data.documents.find(d=>d.type==="BEFORE_AFTER"&&d.kaizen_id==="KAI-T1"))'));
  assert.equal(doc.structured_data.description, "Un bac par référence");
  assert.match(a.q("#modalTitle").textContent, /Fiche avant \/ après/);
  assert.match(a.q(".ba-sheet").textContent, /Le problème[\s\S]*L’amélioration[\s\S]*Le gain constaté/);
  a.click("[data-ba-share]");
  assert.equal(a.q("#bpTitle").value, "Bac de vis au poste", "Partager aux sites : bonne pratique pré-remplie");
  a.fill("#bpSummary", "Un bac par référence");
  a.submit("#bpNewForm");
  assert.equal(a.run('data.practices[0].source_id'), doc.id);
  assert.equal(a.run('data.practices[0].after_photo'), "data:image/png;base64,BBBB");
  a.run('closeModal();beforeAfterForm()');
  a.fill("#baTitle", "Sans photo");
  a.submit("#beforeAfterForm");
  assert.match(a.q("#toast").textContent, /deux photos/, "Les deux photos sont nécessaires");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Écarts 8.29 · signal ou bruit, réponse ouverte ou « Sans réponse », action, surveillance datée, chantier pré-rempli", (t) => {
  const a = app(t);
  demo(a);
  const read = (vals, dir = "high", target = 85) => a.run(`egRead(${JSON.stringify(vals)}.map((value,i)=>({value,period:"2026-01-"+String(i+1).padStart(2,"0"),target:${target}})),{direction:"${dir}",target:${target},unit:"%"}).kind`);
  assert.equal(read([84, 82, 80, 77, 74]), "drift", "5 relevés de suite, chacun moins bon");
  assert.equal(read([80, 81, 82, 83]), "few", "Moins de 5 relevés");
  assert.equal(read([78, 79, 80, 81, 82]), "better");
  assert.equal(read([80, 82, 79, 81, 80, 82, 79, 81, 80, 70]), "break", "Relevé hors des limites habituelles");
  assert.equal(read([84, 83, 85, 84, 83, 85, 84, 83, 81, 81, 81, 81, 81, 81, 81, 81]), "shift", "8 relevés sous la moyenne");
  assert.equal(read([80, 82, 79, 81, 80, 82, 79, 81, 80, 81]), "chronic", "Sans signal mais la moyenne n’atteint pas la cible");
  assert.equal(read([86, 84, 87, 85, 86, 84, 87, 85, 86, 84]), "noise", "Un relevé sous la cible, la moyenne la tient");
  assert.equal(read([0, 0, 0, 0, 1], "low", 0), "event", "Cible zéro : chaque cas");
  a.run('state.site="marzin";state.view="analysis";render()');
  assert.equal(a.all(".eg-card").length, 1, "Par défaut : les écarts sans réponse");
  assert.match(a.q(".eg-card").textContent, /Couverture des compétences[\s\S]*Dérive[\s\S]*Sans réponse[\s\S]*Ouvrir un QRQC/);
  assert.equal(a.q(".eg-card [data-eg-do]").dataset.egDo, "problem", "Signal : QRQC conseillé en premier");
  a.click('[data-eg-f="all"]');
  assert.equal(a.all(".eg-card").length, 5);
  assert.match(a.q("#appView").textContent, /Pris en charge[\s\S]*P-012/, "Problème ouvert sur le KPI = pris en charge");
  a.run('egDo("action","marzin:KPI-staffing")');
  a.fill("#egActTitle", "Former deux régleurs équipe B");
  a.fill("#egActWho", "Chef d’équipe test");
  a.submit("#egActForm");
  const act = JSON.parse(a.run('JSON.stringify(data.actions[0])'));
  assert.equal(act.kpi_id, "KPI-staffing");
  assert.equal(act.origin_type, "KPI");
  assert.equal(act.priority, "Haute");
  a.click('[data-eg-f="open"]');
  assert.match(a.q("#appView").textContent, /Chaque écart a une réponse/);
  a.run('state.site="group";state.egFilter="open";state.egSite="ag-deco";render()');
  assert.equal(a.q('[data-eg-key="ag-deco:KPI-staffing"]').dataset.egDo, "project", "Toujours hors cible : chantier conseillé");
  a.run('egDo("watch","ag-deco:KPI-staffing")');
  a.submit("#egWatchForm");
  assert.match(a.q("#toast").textContent, /Pourquoi/, "Surveiller exige un motif");
  a.click("[data-eg-r]");
  a.fill("#egWatchBy", "Responsable test");
  a.submit("#egWatchForm");
  const w = JSON.parse(a.run("JSON.stringify(data.gapReviews[0])"));
  assert.equal(w.reason, "Variation normale");
  assert.ok(w.until > a.run("today()"));
  assert.equal(a.run('egRows().find(r=>r.id==="ag-deco:KPI-staffing").covered'), true);
  a.run('data.gapReviews[0].until="2026-01-01";render()');
  assert.equal(a.run('egRows().find(r=>r.id==="ag-deco:KPI-staffing").covered'), false, "Surveillance échue : repasse sans réponse");
  assert.match(a.q("#appView").textContent, /Surveillance échue le/);
  a.run('egDo("project","ag-deco:KPI-trs")');
  assert.equal(a.q("#cdKLabel").value, "TRS");
  assert.equal(a.q("#cdKBase").value, "82");
  assert.equal(a.q("#cdKTarget").value, "85");
  a.run('modalDirty=false;closeModal();egDo("problem","marzin:KPI-staffing")');
  assert.equal(a.q("#problemMethod").value, "QRQC");
  a.run('modalDirty=false;closeModal();state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";render()');
  assert.match(a.q(".in-drifts").textContent, /Sans réponse/);
  assert.match(a.run("jnWatchCard()"), /sans réponse/);
  a.run('state.role="dg";state.view="analysis";state.egFilter="all";render()');
  assert.ok(a.all(".eg-card").length > 0);
  assert.equal(a.all("[data-eg-do]").length, 0, "Lecture seule : aucune réponse proposée");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Journal 8.30 · phrases lisibles, auteur déclaré, regroupé par jour, filtres, voir plus, export CSV", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.site="marzin";render();apSetMe("Camille Test");commitData(()=>{data.actions.unshift({id:"A-JR1",site_id:"marzin",title:"Remettre le support à la cote",owner:"Camille Test",due_date:auAddDays(5),due_date_initial:auAddDays(5),priority:"Haute",status:"Ouverte",progress:0,updates:[],reschedules:[],category:"Qualité",origin_type:"Manuel",created_at:now(),updated_at:now()})})');
  a.run('commitData(()=>{data.actions.find(x=>x.id==="A-JR1").due_date=auAddDays(12)})');
  a.run('apSetMe("Louis Test");commitData(()=>{const x=data.actions.find(x=>x.id==="A-JR1");x.status="Clôturée";x.progress=100;x.closed_at=now();x.effectiveness="Rebut à 2,8 %";x.verified_by="Louis Test";x.verified_at=today()})');
  a.run('apSetMe("");commitData(()=>{data.settings.escalationDays=(data.settings.escalationDays||5)+1})');
  const last = JSON.parse(a.run("JSON.stringify(data.activity.filter(e=>e.record_id===\"A-JR1\").at(-1))"));
  assert.equal(last.person, "Louis Test", "Le nom déclaré sur l’appareil est enregistré");
  assert.equal(last.role, "Responsable Lean");
  a.run('state.view="activity";render()');
  const txt = a.q("#appView").textContent;
  assert.match(txt, /Aujourd’hui/);
  assert.match(txt, /Louis Test[\s\S]*a clôturé[\s\S]*l’action A-JR1/);
  assert.match(txt, /Camille Test[\s\S]*a reporté l’échéance de l’action A-JR1/);
  assert.match(txt, /Camille Test[\s\S]*a créé l’action A-JR1/);
  assert.match(txt, /a modifié les règles de management/);
  a.click('[data-jr-type="due"]');
  assert.equal(a.all(".jr-ev").length, 1, "Filtre Échéances");
  a.click('[data-jr-type="all"]');
  a.click('[data-jr-who="Camille Test"]');
  assert.equal(a.all(".jr-ev").length, 2, "Filtre auteur");
  const csv = a.run("jrCsv()");
  assert.ok(csv.startsWith("﻿Date;Heure;Auteur;Profil;Site"));
  assert.match(csv, /Camille Test;Responsable Lean;Marzin;a reporté l’échéance/);
  a.run('state.jrFilter={};data.activity.push(...Array.from({length:70},(_, i)=>({id:"EVT-T"+i,at:new Date(Date.now()-i*3600000).toISOString(),actor:"Responsable Lean",event:"Modification",record_id:"A-JR1",site_id:"marzin",fields:["description"],changes:{description:{before:"a",after:"b"}}})));render()');
  assert.equal(a.all(".jr-ev").length, 60, "60 événements d’abord");
  a.click("[data-jr-more]");
  assert.ok(a.all(".jr-ev").length > 60);
  a.run('state.site="group";render()');
  assert.ok(a.all(".jr-site").length > 0, "Niveau Groupe : site affiché");
});
test("Paramètres 8.31 · état du paramétrage, onglets lisibles, ajout pré-rempli, seuils incohérents signalés", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.view="settings";state.adminTab="sites";render()');
  assert.match(a.q(".pm-health").textContent, /État du paramétrage[\s\S]*Chaque site a un responsable[\s\S]*Chaque indicateur a un propriétaire/);
  assert.doesNotMatch(a.q("#appView").textContent, /Site inconnu/, "Plus de « Site inconnu » sur les sites");
  const ids = () => JSON.parse(a.run("JSON.stringify(pmChecks().filter(c=>!c.ok).map(c=>c.id))"));
  assert.ok(ids().includes("siteOwner"));
  a.run('commitData(()=>data.sites.forEach(s=>s.owner="Responsable test"))');
  assert.ok(!ids().includes("siteOwner"), "Responsables nommés : point en ordre");
  a.run('commitData(()=>{const k=data.kpis.find(k=>k.code==="trs");k.green=70;k.orange=80})');
  assert.ok(ids().includes("kpiThr"), "Vert sous orange pour « plus est mieux » : incohérent");
  a.click('[data-pm-tab="kpis"]');
  assert.match(a.q(".pm-body").textContent, /Seuils incohérents/);
  assert.match(a.q(".pm-health").textContent, /À compléter dans cet onglet/);
  a.click('[data-os="edit"]');
  assert.ok(a.q('#osForm [name="definition"]'), "Modifier ouvre la fiche de l’indicateur");
  a.run('closeModal();state.adminTab="zones";render()');
  assert.equal(a.run("pmTab()"), "workshops", "Zones et ateliers sont réunis");
  a.click('[data-os="new"][data-args*="zones"]');
  assert.equal(a.q('#osForm [name="site_id"]').value, "ag-deco");
  assert.equal(a.q('#osForm [name="workshop_id"]').value, "ag-deco-main", "+ Zone pré-remplit l’atelier");
  a.run('closeModal();state.adminTab="rules";render()');
  assert.ok(a.q("#osRules"));
  assert.match(a.q("#appView").textContent, /Données et sauvegardes/);
});
test("Connecteurs 8.32 · origine des relevés, import vérifié en trois temps, lignes vides ignorées, fiche de raccordement", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.view="connectors";render()');
  assert.match(a.q(".cn-origin").textContent, /D’où viennent les relevés[\s\S]*relevés attendus/);
  assert.equal(a.all(".cn-table tbody tr").length, a.run("OPERATIONAL_SITES.length"), "Une ligne par site");
  const tpl = a.run("cnTemplate()");
  assert.ok(tpl.startsWith("﻿site_id;workshop_id;code;period;value;target;definition;source"));
  assert.equal(tpl.trim().split("\r\n").length, 1 + a.run("OPERATIONAL_SITES.length*osActive(data.kpis).length"), "Une ligne par site et indicateur");
  const bad = JSON.parse(a.run(`JSON.stringify(cnCheck("site_id;code;period;value;target;definition;source\\nmarzin;trs;2026-13-01;80;85;Site;Test\\nmarzin;scrap;2026-11-01;;3;Site;Test\\nmarzin;scrap;2026-11-01;140;3;Site;Test"))`));
  assert.equal(bad.blank.length, 1, "Ligne sans valeur ignorée");
  assert.deepEqual(bad.errors.map((e) => e.line), [2, 4], "Numéros de ligne du fichier d’origine");
  a.run(`cnShowCheck(cnCheck("site_id;code;period;value;target;definition;source\\nmarzin;trs;2026-11-01;79,5;85;Site entier;Fichier test\\nsodeplax;trs;2026-11-01;;85;Site;"),"essai.csv")`);
  assert.match(a.q("#cnResult").textContent, /1 ligne valide[\s\S]*1 ligne sans valeur ignorée[\s\S]*Confirmer l’import de 1 relevé/);
  a.click("[data-cn-confirm]");
  assert.equal(a.run('data.syncLog.at(-1).accepted'), 1);
  assert.equal(a.run('data.syncLog.at(-1).ignored'), 1);
  assert.equal(a.run('data.measures.find(m=>m.site_id==="marzin"&&m.code==="trs"&&m.period==="2026-11-01").entry_mode'), "import");
  assert.match(a.q(".cn-log").textContent, /essai\.csv/);
  a.click('[data-os="new"][data-args*="SEQUOIA"]');
  assert.equal(a.q('#osForm [name="name"]').value, "SEQUOIA");
  assert.ok([...a.q('#osForm [name="status"]').options].some((o) => o.value === "Automatique"), "Étapes jusqu’à l’automatique");
  a.run('closeModal();commitData(()=>data.connectors.push({id:"CON-T1",site_id:"group",name:"SEQUOIA",kind:"SEQUOIA",owner:"Contact test",frequency:"Quotidienne",mapping:"Extraction à préciser",status:"Contrat reçu"}));render()');
  assert.equal(a.all('[data-os="new"][data-args*="SEQUOIA"]').length, 0, "SEQUOIA déjà déclaré");
  assert.match(a.q(".cn-track .now").textContent, /Contrat/);
  a.click('[data-cn-sheet="CON-T1"]');
  assert.match(a.q(".cn-sheet").textContent, /Colonnes du fichier[\s\S]*Indicateurs attendus[\s\S]*Codes des sites et ateliers[\s\S]*Contrôles à l’import[\s\S]*Sécurité[\s\S]*Étapes/);
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Réunions 8.33 · quatre instances, dossier préparé par les données, relevé, actions suivies, décisions fermées, agenda", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.view="pilotage";render()');
  assert.ok(a.run('uxTabs(uxStages().find(s=>s.id==="voir")).some(x=>x.key==="meetings")'), "Onglet Réunions dans Voir");
  a.run('state.view="daily";state.meetOn=true;state.meetOpen=null;render()');
  a.click("[data-re-setup]");
  const types = JSON.parse(a.run("JSON.stringify(reRows().map(r=>r.type))"));
  assert.equal(types.filter((x) => x === "hebdo").length, a.run("OPERATIONAL_SITES.length"), "Une revue hebdomadaire par site");
  assert.ok(["comex", "copil", "mensuelle"].every((x) => types.includes(x)));
  assert.ok(a.run('reRows().every(r=>r.next_date>=today()&&r.time)'), "Dates et heures proposées");
  const id = a.run('reRows().find(r=>r.type==="hebdo"&&r.site_id==="marzin").id');
  a.click(`[data-re-open="${id}"]`);
  const txt = a.q(".re-dossier").textContent;
  assert.match(txt, /Ordre du jour · 45 min[\s\S]*Sécurité[\s\S]*Actions de la dernière réunion[\s\S]*Indicateurs hors cible[\s\S]*Chantiers[\s\S]*Actions en retard[\s\S]*Ce que le site attend du Groupe/);
  assert.match(txt, /S-041/, "Signal sécurité critique du site");
  assert.match(txt, /Première réunion/);
  a.fill('[data-re-note="securite"]', "Verrouillage remplacé");
  a.fill("[data-re-dec]", "Lancer le 5S de la zone stockage");
  a.fill("[data-re-aw]", "Chiffrer les racks");
  a.fill("[data-re-ao]", "Responsable test");
  a.fill('[data-re-dp="D-007"]', "Remplacement complet autorisé");
  a.click("[data-re-close]");
  const s = JSON.parse(a.run("JSON.stringify(data.instanceSessions[0])"));
  assert.equal(s.instance_id, id);
  assert.equal(s.action_ids.length, 1);
  assert.equal(s.decisions.length, 2, "Décision prise + décision attendue fermée");
  assert.equal(a.run('data.decisions.find(d=>d.id==="D-007").status'), "Clos");
  assert.equal(a.run('data.decisions.find(d=>d.id==="D-007").result'), "Remplacement complet autorisé");
  const act = JSON.parse(a.run(`JSON.stringify(data.actions.find(x=>x.id==="${s.action_ids[0]}"))`));
  assert.equal(act.meeting_series, id);
  assert.equal(act.site_id, "marzin");
  assert.ok(a.run(`reGet("${id}").next_date>today()`), "Prochaine date fixée");
  assert.match(a.q("#modalContent").textContent, /Relevé de décisions[\s\S]*Lancer le 5S[\s\S]*Chiffrer les racks/);
  a.run(`closeModal();state.meetOpen="${id}";render()`);
  assert.match(a.all(".re-block")[1].textContent, /1 action ouverte[\s\S]*Chiffrer les racks/, "L’action revient à la réunion suivante");
  const ics = a.run(`reIcs("${id}")`);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /SUMMARY:Revue hebdomadaire · Marzin/);
  const mid = a.run('reRows().find(r=>r.type==="mensuelle").id');
  a.run(`state.meetOpen="${mid}";render()`);
  assert.match(a.q(".re-dossier").textContent, /Performance par site[\s\S]*Bonnes pratiques à partager[\s\S]*Décisions à prendre/);
  assert.equal(a.all(".re-table tbody tr").length, a.run("OPERATIONAL_SITES.length"));
  a.run(`data.instances.find(r=>r.type==="copil").next_date=today();state.meetOn=false;state.meetOpen=null;switchView("home")`);
  assert.match(a.run("jnWatchCard()"), /COPIL amélioration continue/, "Rappel sur l’accueil le jour de la réunion");
  a.run('state.role="dg";state.view="daily";state.meetOn=true;state.meetOpen=null;render()');
  assert.equal(a.all("[data-re-setup]").length, 0);
  a.run(`state.meetOpen="${id}";render()`);
  assert.equal(a.all("[data-re-close]").length, 0, "Lecture seule : dossier sans saisie");
  a.run('state.role="director";state.site="sodeplax";state.meetOpen=null;render()');
  assert.deepEqual(a.all(".re-week-main:not(.cg-t15) b").map((x) => x.textContent), ["Sodeplax"], "Le directeur ne voit que la revue de son site");
  assert.ok(!a.all(".re-card h3").some((h) => /COMEX/.test(h.textContent)), "Pas d’instance COMEX pour un directeur de site");
  assert.equal(a.run("osIntegrity(data).length"), 0);
});
test("Cascade 8.34 · TOP 5 → TOP 15 → revue hebdo → mensuelle → COPIL, et la réponse redescend jusqu’au TOP 5", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.view="daily";state.meetOn=true;state.meetOpen=null;render()');
  a.click("[data-re-setup]");
  assert.equal(a.run('reRows().filter(r=>r.type==="top15").length'), a.run("OPERATIONAL_SITES.length"), "Un TOP 15 par site");
  assert.match(a.q(".cg-ladder").textContent, /La cascade[\s\S]*TOP 5[\s\S]*TOP 15[\s\S]*Revue hebdo[\s\S]*Revue mensuelle[\s\S]*COPIL · COMEX/);
  // TOP 5 : deux écarts du jour deviennent des sujets remontés
  a.run('state.role="teamlead";state.site="marzin";state.meetOn=false;switchView("sqcdp")');
  assert.match(a.q(".sj-panel h2").textContent, /TOP 5/);
  a.run('sjSet(today(),"S","ko","Chariot sans frein au poste 3");sjSet(today(),"Q","ko","Bulles de colle sur 12 pièces")');
  const [q1, s1] = JSON.parse(a.run('JSON.stringify(data.topics.slice(0,2).map(t=>t.id))'));
  // TOP 15 : une réponse, une montée
  a.run('state.role="lean";state.site="group";state.view="daily";state.meetOn=true;state.meetOpen=reRows().find(r=>r.type==="top15"&&r.site_id==="marzin").id;render()');
  assert.match(a.q(".re-dossier").textContent, /Lettres SQCDP des ateliers et TOP 5[\s\S]*Remonté du niveau du dessous[\s\S]*Chariot sans frein/);
  a.fill(`[data-re-ans="${s1}"]`, "Frein remplacé par la maintenance");
  a.run(`document.querySelector('[data-re-up="${q1}"]').checked=true`);
  a.click("[data-re-close]");
  const esc = a.run(`data.topics.find(t=>t.id==="${q1}").carried_by`);
  assert.ok(esc, "Le sujet monte à la revue hebdomadaire");
  assert.equal(a.run(`data.escalations.find(e=>e.id==="${esc}").level`), 3);
  assert.equal(a.run(`data.escalations.find(e=>e.id==="${esc}").origin_level`), 1);
  // Revue hebdo : la réponse
  a.run('closeModal();state.meetOpen=reRows().find(r=>r.type==="hebdo"&&r.site_id==="marzin").id;render()');
  a.fill(`[data-re-ans="${esc}"]`, "Changement de lot de colle validé");
  a.click("[data-re-close]");
  assert.equal(a.run(`data.topics.find(t=>t.id==="${q1}").decision`), "Changement de lot de colle validé", "La réponse rejoint le sujet d’origine");
  // TOP 5 : réponses à dire, puis boucle fermée
  a.run('closeModal();state.role="teamlead";state.site="marzin";state.meetOn=false;switchView("sqcdp")');
  assert.match(a.q(".cg-back").textContent, /Réponses à dire à l’équipe · 2/);
  assert.match(a.q(".cg-back").textContent, /Frein remplacé/);
  assert.match(a.q(".cg-back").textContent, /Changement de lot de colle/);
  a.click(`[data-cg-ret="${q1}"]`);
  a.click(`[data-cg-ret="${s1}"]`);
  assert.equal(a.run(`data.topics.find(t=>t.id==="${q1}").status`), "Clos");
  assert.equal(a.run(`data.escalations.find(e=>e.id==="${esc}").status`), "Clos", "L’escalade se ferme avec le sujet");
  assert.ok(!a.q(".cg-back"));
  assert.ok(a.run("cgStats().closed") >= 2);
  // Revue mensuelle → COPIL → réponse redite à la revue hebdomadaire d’origine
  a.run('state.role="lean";state.site="group";commitData(()=>data.escalations.unshift({id:"ESC-777",site_id:"sodeplax",source_id:"S-041",title:"Budget éclairage zone contrôle",level:4,origin_level:3,owner:"Directeur opérationnel",status:"Ouverte",detail:"Devis fictif",result:"",due_date:today(),created_at:now(),updated_at:now()}));state.view="daily";state.meetOn=true;state.meetOpen=reRows().find(r=>r.type==="mensuelle").id;render()');
  a.run('const s=document.querySelector(\'[data-re-up="ESC-777"]\');s.value="copil"');
  a.click("[data-re-close]");
  assert.equal(a.run('data.escalations.find(e=>e.id==="ESC-777").forum'), "copil");
  a.run('closeModal();state.meetOpen=reRows().find(r=>r.type==="copil").id;render()');
  a.fill('[data-re-ans="ESC-777"]', "Accordé");
  a.click("[data-re-close]");
  a.run('closeModal();state.meetOpen=reRows().find(r=>r.type==="hebdo"&&r.site_id==="sodeplax").id;render()');
  assert.ok(a.q('[data-re-ret="ESC-777"]').checked, "La réponse du COPIL revient à la revue hebdo qui avait remonté");
  a.click("[data-re-close]");
  assert.equal(a.run('data.escalations.find(e=>e.id==="ESC-777").status'), "Clos");
  // Niveaux renommés
  a.run('closeModal();state.meetOn=false;state.meetOpen=null;switchView("daily")');
  assert.match(a.all('[data-os="level"]').map((b) => b.textContent).join(","), /N1 · TOP 5,N2 · TOP 15,N3 · Revue hebdo du site,N4 · Groupe/);
  assert.equal(a.run("osIntegrity(data).length"), 0);
});

test("Micro-arrêts 8.35 · ligne, comptage d’un geste, chronomètre, seuil de panne, Pareto, TOP 5, TOP 15 et action", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="teamlead";state.site="marzin";state.workshop="";mlGo()');
  assert.equal(a.run("state.terrainTab"), "micro");
  assert.ok(a.q(".cs-empty [data-ml-newline]"), "Page vide : ajouter une ligne");
  a.click("[data-ml-newline]");
  a.fill("#mlName", "Plaqueuse 2");
  a.fill("#mlTarget", "4");
  a.submit("#mlLineForm");
  const l = JSON.parse(a.run("JSON.stringify(data.mlLines[0])"));
  assert.equal(l.threshold_min, 5);
  assert.equal(l.causes.length, 8, "Causes par défaut");
  // Comptage d'un geste : durée type
  a.click('[data-ml-cause="Bourrage, coincement"]');
  a.click('[data-ml-cause="Bourrage, coincement"]');
  a.click('[data-ml-cause="Manque matière"]');
  assert.equal(a.run("mlSum(data.mlLines[0]).n"), 3);
  assert.equal(a.run("mlSum(data.mlLines[0]).min"), 3);
  // Chronomètre : durée réelle
  a.run('mlSetRun(data.mlLines[0].id,Date.now()-90e3);render()');
  assert.ok(a.q(".ml-counter.running .ml-elapsed"));
  a.click('[data-ml-cause="Capteur, détection"]');
  assert.equal(a.run("data.microStops[0].timed"), true);
  assert.ok(Math.abs(a.run("data.microStops[0].dur_s") - 90) <= 2);
  assert.equal(a.run("mlRun(data.mlLines[0].id)"), null, "Le chronomètre est arrêté");
  // Au-delà du seuil : c'est une panne
  a.run('mlSetRun(data.mlLines[0].id,Date.now()-8*60e3);render()');
  a.click('[data-ml-cause="Autre"]');
  assert.match(a.q("#modalContent").textContent, /c’est une panne/);
  assert.equal(a.run("mlSum(data.mlLines[0]).n"), 4, "Rien n’est compté avant le choix");
  a.click("[data-ml-keep]");
  assert.equal(a.run("mlSum(data.mlLines[0]).n"), 5);
  // Annuler le dernier
  a.click("[data-ml-undo]");
  assert.equal(a.run("mlSum(data.mlLines[0]).n"), 4);
  assert.ok(!a.run('data.microStops.some(s=>s.cause==="Autre")'), "Le dernier saisi est annulé, pas le plus récent en heure");
  // Lecture : Pareto, points de TRS, objectif dépassé
  const s = JSON.parse(a.run("JSON.stringify(mlSum(data.mlLines[0]))"));
  assert.equal(s.top.c, "Bourrage, coincement");
  assert.ok(Math.abs(s.min - 4.5) < 0.05, "1 + 1 + 1 min comptées et 90 s chronométrées");
  assert.ok(s.over, "Au-dessus de l’objectif de 4 min");
  assert.ok(Math.abs(s.pts - (s.min / 420) * 100) < 1e-9);
  assert.match(a.q(".ml-read").textContent, /cause n°1[\s\S]*Les causes[\s\S]*Quand/);
  // TOP 5 : le C affiche les micro-arrêts ; Ma journée : à surveiller
  a.run('switchView("sqcdp")');
  assert.match(a.q('[data-sj-tile="C"] .ml-sj').textContent, /Micro-arrêts aujourd’hui : 4/);
  a.run('switchView("home")');
  assert.ok(a.q('.jn-watch [data-ml-go]'), "Ligne au-dessus de l’objectif à surveiller");
  // Suites
  a.run("mlGo()");
  a.click("[data-ml-top15]");
  assert.equal(a.run("data.topics[0].source"), "Micro-arrêts");
  assert.equal(a.run("data.topics[0].axis"), "C");
  a.click("[data-ml-action]");
  a.fill("#mlActTitle", "Poser un guide d’entrée");
  a.fill("#mlActWho", "Chef d’équipe Marzin");
  a.submit("#mlActForm");
  assert.match(a.run("data.actions[0].finding"), /Micro-arrêts · Bourrage/);
  // Tous les boutons sont branchés ; l'opérateur compte, ne crée pas de ligne
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
  a.run('state.role="operator";mlGo()');
  assert.ok(!a.q("[data-ml-newline]"));
  assert.ok(a.q('[data-ml-cause]:not([disabled])'), "L’opérateur compte");
  a.run('state.role="director";state.site="sodeplax";mlGo()');
  assert.ok(a.q(".cs-empty"), "Les lignes d’un autre site ne se mélangent pas");
});

test("TRS 8.36 · feuille de poste, calcul NF E60-182, pannes TPM et micro-arrêts repris, TRS du site au pilotage sans écraser une autre source", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="teamlead";state.site="marzin";state.workshop="";mlGo()');
  assert.match(a.q(".page-head h1").textContent, /TRS et arrêts de ligne/);
  a.click("[data-ml-newline]");
  a.fill("#mlName", "Plaqueuse 2");
  a.fill("#mlRate", "240");
  a.submit("#mlLineForm");
  assert.equal(a.run("data.mlLines[0].rate_ph"), 240);
  assert.equal(a.run("data.mlLines[0].shift_min"), 480);
  // Calcul : 480 min, 40 planifiées, 32 d'arrêt, 1 350 bonnes + 25 rebuts à 240 pièces/h
  const c = JSON.parse(a.run('JSON.stringify(tsCalc({shift_min:480,planned_min:40,stops:[{min:32}],micro_min:18,good:1350,scrap:25,rate_ph:240}))'));
  assert.equal(c.tr, 440);
  assert.equal(c.tf, 408);
  assert.ok(Math.abs(c.trs - 337.5 / 440) < 1e-9, "TRS = temps utile / temps requis");
  assert.ok(Math.abs(c.d * c.p * c.q - c.trs) < 1e-9, "TRS = D × P × Q");
  assert.ok(Math.abs(c.speed - (408 - 343.75 - 18)) < 1e-9, "Écart de cadence = perte de performance − micro-arrêts");
  assert.deepEqual(c.warn, []);
  assert.match(a.run('tsCalc({shift_min:480,planned_min:0,stops:[],good:3000,scrap:0,rate_ph:240}).warn.join(" ")'), /Plus de pièces que la cadence/);
  // Feuille de poste d'hier : panne TPM et micro-arrêts comptés repris
  const y = a.run("auAddDays(-1)");
  a.run(`data.machines=[{id:"MA-T1",site_id:"marzin",name:"Plaqueuse",created_at:now(),updated_at:now()}];data.mlLines[0].machine_id="MA-T1";const s=new Date("${y}T09:00:00");data.breakdowns=[{id:"PA-T1",site_id:"marzin",machine_id:"MA-T1",start:s.toISOString(),end:new Date(s.getTime()+25*6e4).toISOString(),cause:"Capteur"}];data.microStops=[0,1,2].map(i=>({id:"MA-"+i,line_id:data.mlLines[0].id,site_id:"marzin",at:new Date(s.getTime()+i*36e5).toISOString(),cause:"Manque matière",dur_s:null,timed:false}));data.measures=data.measures.filter(m=>!(m.site_id==="marzin"&&m.code==="trs"&&m.period==="${y}"));render()`);
  a.click("[data-ts-new]");
  a.fill("#tsDate", y);
  a.run('document.querySelector("#tsDate").dispatchEvent(new Event("input",{bubbles:true}))');
  a.click("[data-ts-tpm]");
  assert.equal(a.run('document.querySelector(".ts-stop [data-ts-min]").value'), "25");
  a.click("[data-ts-usecount]");
  assert.equal(a.q("#tsMicroN").value, "3");
  a.fill("#tsPlanned", "40");
  a.fill("#tsGood", "1400");
  a.fill("#tsScrap", "10");
  a.submit("#tsForm");
  const sh = JSON.parse(a.run("JSON.stringify(data.trsShifts[0])"));
  assert.equal(sh.stops[0].min, 25);
  assert.equal(sh.micro_n, 3);
  const m = JSON.parse(a.run(`JSON.stringify(data.measures.find(m=>m.site_id==="marzin"&&m.code==="trs"&&m.period==="${y}"))`));
  assert.equal(m.source, "Feuilles de poste");
  assert.equal(m.value, Math.round(((1400 * 0.25) / 440) * 1000) / 10);
  assert.match(m.definition, /NF E60-182[\s\S]*Plaqueuse 2/);
  // Même jour, même équipe : refusée
  a.click("[data-ts-new]");
  a.fill("#tsDate", y);
  a.run(`document.querySelector('[data-ts-team="${sh.team}"]').click()`);
  a.fill("#tsGood", "100");
  a.submit("#tsForm");
  assert.equal(a.run("data.trsShifts.length"), 1, "Une feuille par ligne, jour et équipe");
  a.run("closeModal()");
  // Un relevé d'une autre source n'est pas écrasé
  assert.equal(a.run('tsPushSite("marzin", today())'), "kept");
  // TOP 5 : lettre C
  a.run('switchView("sqcdp")');
  assert.match(a.q('[data-sj-tile="C"] .ml-sj').textContent, /TRS hier : [\d,]+ %/);
  // Suppression : le relevé du pilotage suit
  a.run('mlGo()');
  a.click(`[data-ts-open="${sh.id}"]`);
  a.click("[data-ts-remove]");
  assert.ok(!a.run(`data.measures.some(m=>m.site_id==="marzin"&&m.code==="trs"&&m.period==="${y}")`));
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
});

test("Gains 8.37 · types, avant/objectif/après, annualisation, valorisation, validation, objectif, double comptage, tenue", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="director";state.site="marzin";render();switchView("pilotage")');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="voir")).map(x=>x.label))'));
  assert.deepEqual(tabs.filter((x) => ["Pilotage", "Gains", "Environnement"].includes(x)), ["Pilotage", "Gains", "Environnement"]);
  a.run('state.pilotTab="gains";render()');
  assert.match(a.q(".page-head h1").textContent, /Gains/);
  // Calcul : 40 → 18 min, objectif 20, 250 fois par an, 0,75 € la minute, 3 000 € de mise en œuvre
  const g = { before: 40, target: 20, after: 18, direction: "low", unit: "min", per_year: 250, recurring: true, euro_rate: 0.75, cost: 3000, status: "Validé" };
  const v = JSON.parse(a.run(`JSON.stringify(gnValue(${JSON.stringify(g)}))`));
  assert.equal(v.year, 22 * 250);
  assert.equal(v.euros, 22 * 250 * 0.75);
  assert.ok(Math.abs(a.run(`gnProgress(${JSON.stringify(g)})`) - 1.1) < 1e-9, "110 % de l’objectif");
  assert.ok(Math.abs(a.run(`gnPayback(${JSON.stringify(g)})`) - 3000 / (4125 / 12)) < 1e-9);
  assert.equal(JSON.parse(a.run(`JSON.stringify(gnValue(${JSON.stringify({ ...g, status: "Estimé", after: null })}))`)).euros, 20 * 250 * 0.75, "Une prévision se calcule sur l’objectif");
  assert.equal(JSON.parse(a.run(`JSON.stringify(gnValue(${JSON.stringify({ ...g, recurring: false })}))`)).year, 22, "Un gain ponctuel compte une fois");
  // Déclaration par le formulaire
  a.click("[data-gn-new]");
  a.fill("#gnTitle", "Changement de série plaqueuse");
  a.click('[data-gn-ff="prod"]');
  a.fill("#gnUnit", "min");
  a.fill("#gnBefore", "40");
  a.fill("#gnTargetV", "20");
  a.fill("#gnPerYear", "250");
  a.fill("#gnRate", "0.75");
  a.click('[data-gn-save=""]');
  const s1 = JSON.parse(a.run("JSON.stringify(data.gains[0])"));
  assert.equal(s1.status, "Estimé");
  assert.equal(s1.family, "prod");
  assert.equal(s1.period, "par an");
  // Mesure de l'après et validation par le directeur
  a.click(`[data-gn-open="${s1.id}"]`);
  a.fill("#gnAfter", "18");
  a.click('[data-gn-save="Validé"]');
  assert.equal(a.run("data.gains[0].status"), "Estimé", "Pas de validation sans preuve");
  a.fill("#gnEvidence", "Chrono sur 10 changements");
  a.click('[data-gn-save="Validé"]');
  const s2 = JSON.parse(a.run("JSON.stringify(data.gains[0])"));
  assert.equal(s2.status, "Validé");
  assert.ok(s2.validated_by && s2.validated_at && s2.start_date);
  assert.ok(a.run(`osValidatedGains([data.gains[0]])["min · par an"]`) === 5500, "Compatible avec l’ancien registre");
  // Objectif annuel, sommes
  a.click("[data-gn-target]");
  a.fill("#gnTg", "150000");
  a.submit("#gnTgForm");
  assert.equal(a.run("gnTarget()"), 150000);
  const tt = JSON.parse(a.run("JSON.stringify(gnTotals(gnRows()))"));
  assert.ok(tt.valid >= 4125);
  assert.match(a.q(".gn-goal").textContent, /objectif annuel du site/);
  // Double comptage refusé
  a.run(`data.projects.unshift({id:"PRJ-T1",site_id:"marzin",title:"Chantier test",status:"Clos",kpi:{label:"Rebut",base:5,target:3,unit:"%"},measures:[{date:today(),value:2.8}],created_at:now(),updated_at:now()});render()`);
  assert.ok(a.q('[data-gn-from="PRJ-T1"]'), "Résultat sans gain déclaré proposé");
  a.click('[data-gn-from="PRJ-T1"]');
  assert.equal(a.q("#gnBefore").value, "5");
  assert.equal(a.q("#gnAfter").value, "2.8");
  a.click('[data-gn-ff="qual"]');
  a.click('[data-gn-save=""]');
  assert.equal(a.run('data.gains.filter(g=>g.source_id==="PRJ-T1").length'), 1);
  a.click("[data-gn-new]");
  a.fill("#gnTitle", "Doublon");
  a.run('document.querySelector("#gnSource").value="PRJ-T1"');
  a.click('[data-gn-ff="qual"]');
  a.fill("#gnUnit", "%");
  a.fill("#gnBefore", "5");
  a.fill("#gnTargetV", "3");
  a.click('[data-gn-save=""]');
  assert.equal(a.run('data.gains.filter(g=>g.source_id==="PRJ-T1").length'), 1, "Pas de double comptage");
  a.run("closeModal()");
  // Tenue à 3 mois
  a.run(`const g=data.gains.find(x=>x.id==="${s2.id}");g.start_date=auAddDays(-100);render()`);
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(gnChecksDue(data.gains.find(x=>x.id==="${s2.id}")))`)), [3]);
  a.click(`[data-gn-open="${s2.id}"]`);
  a.fill("#gnCheckV", "19");
  a.click("[data-gn-check]");
  assert.equal(a.run(`data.gains.find(x=>x.id==="${s2.id}").checks[0].held`), true);
  // Revue mensuelle : bloc gains en euros, bloc environnement
  assert.ok(a.run('RE_TYPES.mensuelle.agenda.some(([k])=>k==="env")'));
  assert.match(a.run('reBlock("gains",{type:"mensuelle",site_id:"group",sites:["marzin"]}).html'), /par an validés/);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
});

test("Environnement 8.37 · saisie mensuelle, ratios par unité, référence et objectif, CO₂, incidents avec action, obligations, vue groupe", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="director";state.site="marzin";render();state.pilotTab="env";switchView("pilotage");state.pilotTab="env";render()');
  assert.match(a.q(".page-head h1").textContent, /Environnement/);
  assert.ok(a.q(".cs-empty [data-ev-month]"));
  // Trois mois de l'an dernier : référence automatique
  const y = a.run('String(Number(today().slice(0,4))-1)');
  a.run(`data.envMonths=[1,2,3].map(i=>({id:"EM"+i,site_id:"marzin",month:"${y}-0"+i,prod_qty:1000,elec_kwh:200000,gas_kwh:100000,water_m3:500,waste_t:50,waste_valo_t:40,haz_t:1}));render()`);
  const elec = a.run('JSON.stringify(evRef(EV_IND[0],"marzin"))');
  assert.equal(JSON.parse(elec).v, 200);
  // Saisie du mois précédent
  a.click("[data-ev-month]");
  a.fill("#evProd", "2000");
  a.fill("#evElec", "360000");
  a.fill("#evGas", "180000");
  a.fill("#evWater", "900");
  a.fill("#evWaste", "90");
  a.fill("#evValo", "81");
  a.fill("#evHaz", "1.5");
  a.submit("#evMForm");
  const m = JSON.parse(a.run("JSON.stringify(data.envMonths.find(x=>x.month===evPrevMonth()))"));
  assert.equal(m.prod_qty, 2000);
  assert.equal(a.run('evLast(EV_IND[0],"marzin").v'), 180, "kWh par m³");
  assert.equal(a.run('evLast(EV_IND[2],"marzin").v'), 450, "Litres d’eau par m³");
  assert.equal(a.run('evLast(EV_IND[3],"marzin").v'), (91.5 * 1000) / 2000, "kg de déchets par m³, dangereux compris");
  assert.equal(a.run('evLast(EV_IND[4],"marzin").v'), 90, "Taux de valorisation");
  // Réglages : facteurs, objectifs par baisse visée
  a.click("[data-ev-settings]");
  a.fill("#evSFe", "0.05");
  a.fill("#evSFg", "0.2");
  a.fill("#evSCut", "10");
  a.submit("#evSForm");
  assert.equal(a.run('evTarget(EV_IND[0],"marzin")'), 180, "Référence 200 − 10 %");
  assert.equal(a.run('evTarget(EV_IND[4],"marzin")'), 90, "Valorisation : référence 80 % + 10 points");
  assert.equal(a.run('evLast(EV_IND[6],"marzin").v'), (360000 * 0.05 + 180000 * 0.2) / 2000, "CO₂ de l’énergie par m³");
  assert.equal(a.q('[data-ev-sel="elec"]').classList.contains("ok"), true);
  // Détail
  a.click('[data-ev-sel="elec"]');
  assert.match(a.q(".ev-detail").textContent, /Électricité[\s\S]*24 mois/);
  // Incident avec action corrective
  a.click("[data-ev-event]");
  a.fill("#evET", "Fût de colle renversé quai 2");
  a.fill("#evEA", "Poser une rétention au quai 2");
  a.fill("#evEW", "HSE Marzin");
  a.submit("#evEForm");
  const e = JSON.parse(a.run("JSON.stringify(data.envEvents[0])"));
  assert.ok(e.action_id);
  assert.equal(a.run(`data.actions.find(x=>x.id==="${e.action_id}").category`), "Environnement");
  // Obligation en retard → À surveiller, puis « Fait »
  a.click("[data-ev-ex]");
  a.fill("#evDL", a.run("auAddDays(-60)"));
  a.submit("#evDForm");
  assert.equal(a.run("evDutyState(data.envDuties[0]).k"), "late");
  a.run('switchView("home")');
  assert.ok(a.q(".jn-watch [data-ev-go]"));
  a.run('state.pilotTab="env";switchView("pilotage");state.pilotTab="env";render()');
  a.click("[data-ev-done]");
  assert.equal(a.run("data.envDuties[0].last_date"), a.run("today()"));
  assert.notEqual(a.run("evDutyState(data.envDuties[0]).k"), "late");
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
  // Vue groupe
  a.run('state.role="lean";state.site="group";render()');
  assert.match(a.q(".ev-grid").textContent, /Marzin/);
  assert.ok(a.q(".ev-grid td.ok"), "Objectif tenu en vert");
  assert.match(a.run('reBlock("env",{type:"mensuelle",site_id:"group",sites:["marzin"]}).html'), /Marzin/);
});

test("Non-conformités 8.38 · scan de la commande, analyse automatique, proposition, 8D prérempli, Pareto", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="director";state.site="marzin";render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="resoudre")).map(x=>x.label))'));
  assert.equal(tabs[0], "Non-conformités");
  a.run('state.ncOn=true;switchView("kaizen");state.ncOn=true;render()');
  assert.match(a.q(".page-head h1").textContent, /Non-conformités/);
  // Import des commandes (extraction ERP, dates françaises)
  a.click("#appView [data-nc-orders]");
  const d = a.run("auAddDays(-2)"), fr = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  a.fill("#ncCsv", `Commande;Client;Article;Désignation;Quantité;Ligne;Date fabrication;Lot;Livraison;Livrée\nCDE-1;Client A;PAN-22;Panneau noyer;80;Plaqueuse 2;${fr};L1;;non\nCDE-2;Client B;PAN-22;Panneau noyer;50;Plaqueuse 2;${fr};L2;;non\nCDE-3;Client C;PAN-22;Panneau noyer;40;Plaqueuse 2;${fr};L3;;oui`);
  a.submit("#ncOrdForm");
  assert.equal(a.run('data.orders.length'), 3);
  assert.equal(a.run('ncOrder("cde-1").prod_date'), d);
  // Données de production et historique
  a.run(`data.mlLines=[{id:"LG-1",site_id:"marzin",name:"Plaqueuse 2",causes:ML_CAUSES,typical_min:1}];data.trsShifts=[{id:"FP-1",line_id:"LG-1",site_id:"marzin",date:"${d}",team:"Matin",shift_min:480,planned_min:40,stops:[{kind:"Réglage",min:25,note:"Changement de placage"}],micro_min:10,good:1250,scrap:60,rate_ph:240}];data.ncs=[{id:"NC-901",site_id:"marzin",date:auAddDays(-20),article:"PAN-22",line:"Plaqueuse 2",origin:"Interne",defect:"Collage, décollement",qty:5,severity:"Mineure",text:"x"},{id:"NC-902",site_id:"marzin",date:auAddDays(-9),article:"PAN-22",line:"Plaqueuse 2",origin:"Interne",defect:"Collage, décollement",qty:3,severity:"Mineure",text:"y"}];render()`);
  // Scan (la douchette tape le numéro puis Entrée)
  a.click("#appView [data-nc-new]");
  a.fill("#ncOrder", " cde-1 ");
  a.run('document.querySelector("#ncOrder").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
  assert.equal(a.q("#ncClient").value, "Client A");
  assert.equal(a.q("#ncArticle").value, "PAN-22");
  assert.equal(a.q("#ncLine").value, "Plaqueuse 2");
  a.click('[data-nc-group="defect"] [data-nc-pick="Collage, décollement"]');
  a.fill("#ncQty", "14");
  a.fill("#ncText", "Décollement en rive sur 14 panneaux");
  const auto = a.q("#ncAuto").textContent;
  assert.match(auto, /même article : 2/);
  assert.match(auto, /TRS[\s\S]*Réglage 25 min/);
  assert.match(auto, /CDE-2/, "Commande du même article à vérifier");
  assert.doesNotMatch(auto, /CDE-3/, "Une commande livrée n’est pas proposée");
  assert.match(auto, /Proposition : 8D[\s\S]*client est touché[\s\S]*3e non-conformité/);
  a.click('[data-nc-save="8D"]');
  const nc = JSON.parse(a.run("JSON.stringify(data.ncs[0])"));
  assert.equal(nc.order_no, "CDE-1", "Le numéro de la base est repris");
  assert.equal(nc.decision, "8D");
  const sd = JSON.parse(a.run(`JSON.stringify(data.documents.find(x=>x.problem_id==="${nc.problem_id}").structured_data)`));
  assert.match(sd.d2, /Quoi : Collage[\s\S]*Combien : 14 pièce\(s\) \(17,5 % de la commande\)/);
  assert.match(sd.d3, /lot L1[\s\S]*CDE-2/);
  assert.match(sd.d4_occurrence, /TRS[\s\S]*Réglage 25 min[\s\S]*NC-901/);
  assert.ok(sd.d1 && sd.d0 && sd.d4_escape);
  assert.deepEqual(JSON.parse(a.run(`JSON.stringify(data.problems.find(p=>p.id==="${nc.problem_id}").pareto)`)), [{ label: "Collage, décollement", value: 3 }]);
  assert.equal(a.run("state.view"), "resolution");
  // Mineure, première fois : action simple
  a.run('state.ncOn=true;switchView("kaizen");state.ncOn=true;render()');
  a.click("#appView [data-nc-new]");
  a.fill("#ncArticle", "CHT-1");
  a.click('[data-nc-group="origin"] [data-nc-pick="Interne"]');
  a.click('[data-nc-group="severity"] [data-nc-pick="Mineure"]');
  a.fill("#ncText", "Rayure");
  assert.match(a.q("#ncAuto").textContent, /Proposition : une action corrective/);
  a.click('[data-nc-save="Action"]');
  assert.ok(a.run("data.ncs[0].action_id"));
  // Pareto automatique
  const P = JSON.parse(a.run('JSON.stringify(ncPareto(ncRows(),"defect"))'));
  assert.equal(P.list[0].label, "Collage, décollement");
  assert.equal(P.list[0].v, 3);
  assert.match(a.q(".nc-pareto").textContent, /font 80 %/);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
});

test("Réclamation client 8.39 · retour, décision, coût, jalons de réponse en retard, À surveiller, rapport 8D", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="director";state.site="marzin";render();state.ncOn=true;switchView("kaizen");state.ncOn=true;render()');
  assert.equal(a.run('ncWorkAdd("2026-11-06",1)'), "2026-11-09", "Vendredi + 1 jour ouvré = lundi");
  a.click("#appView [data-nc-new]");
  assert.equal(a.q("#ncClaim").hidden, false, "Origine client par défaut : bloc réclamation visible");
  a.fill("#ncArticle", "PAN-22");
  a.fill("#ncClaimRef", "RC-2026-118");
  a.fill("#ncClaimDate", a.run("auAddDays(-20)"));
  a.fill("#ncRetQty", "14");
  a.fill("#ncCost", "1850");
  a.click('[data-nc-group="claim_decision"] [data-nc-pick="Remplacement"]');
  a.fill("#ncText", "Décollement en rive");
  assert.match(a.q("#ncSteps").textContent, /Accusé de réception[\s\S]*en retard/);
  a.run('document.querySelector(\'[data-nc-step="ack_at"]\').value=auAddDays(-19);document.querySelector(\'[data-nc-step="ack_at"]\').dispatchEvent(new Event("change"))');
  a.click('[data-nc-save="8D"]');
  const n = JSON.parse(a.run("JSON.stringify(data.ncs[0])"));
  assert.equal(n.claim_ref, "RC-2026-118");
  assert.equal(n.returned_qty, 14);
  assert.equal(n.cost, 1850);
  assert.equal(n.claim_decision, "Remplacement");
  assert.ok(n.ack_at, "Accusé enregistré");
  assert.equal(a.run(`ncNext(data.ncs[0]).key`), "cause_at");
  assert.equal(a.run(`ncNext(data.ncs[0]).late`), true, "Causes attendues sous 10 jours ouvrés : en retard");
  a.run('switchView("home")');
  assert.ok(a.q(`.jn-watch [data-nc-open="${n.id}"]`), "Réponse client en retard à surveiller");
  a.run('state.ncOn=true;switchView("kaizen");state.ncOn=true;render()');
  assert.match(a.q(".cs-summary").textContent, /1\s*réponse client en retard[\s\S]*1\s850\s€/);
  a.click(`#appView [data-nc-open="${n.id}"]`);
  assert.ok(a.q("[data-nc-report]"), "Rapport 8D pour le client");
  a.click("[data-nc-group=\"origin\"] [data-nc-pick=\"Interne\"]");
  assert.equal(a.q("#ncClaim").hidden, true);
});

test("Échantillothèque 8.40 · règles groupe, site, client ; contrôle d’une pièce ; écarts entre sites ; lien non-conformité ; revalidation", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="lean";state.site="group";render();state.echOn=true;switchView("documents");state.echOn=true;render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="perenniser")).map(x=>x.label))'));
  assert.deepEqual(tabs.slice(0, 2), ["Standards", "Échantillothèque"]);
  // Règle groupe par le formulaire
  a.click("[data-eh-new]");
  a.run('document.querySelector("#ehScope").value="group";document.querySelector("#ehDef").value="Aspect, rayure"');
  a.fill("#ehTol", "10");
  a.fill("#ehCrit", "Longueur de la rayure visible");
  a.fill("#ehDist", "1");
  a.fill("#ehLux", "1000");
  a.click('[data-eh-save="Validée"]');
  const g = JSON.parse(a.run("JSON.stringify(data.samples[0])"));
  assert.equal(g.scope, "group");
  assert.equal(g.tol_max, 10);
  assert.equal(g.status, "Validée");
  // Règle Marzin plus stricte, règle client sans tolérance
  a.run(`data.samples.push({id:"ECH-M",scope:"marzin",site_id:"marzin",client:"",articles:"",defect:"Aspect, rayure",zone:"A · face vue",tol_max:5,tol_unit:"mm",over:"À retoucher",photos:{},status:"Validée",validated_at:new Date(Date.now()-400*864e5).toISOString(),review_months:12},{id:"ECH-C",scope:"group",site_id:"group",client:"Client A",articles:"PAN-*",defect:"Aspect, rayure",zone:"A · face vue",tol_max:null,tol_unit:"mm",over:"Refusé",photos:{},status:"Validée",validated_at:now(),review_months:12});render()`);
  const r = (o) => a.run(`ehRule(${JSON.stringify({ defect: "Aspect, rayure", zone: "A · face vue", ...o })}).rule?.id`);
  assert.equal(r({ site: "marzin" }), "ECH-M", "Le site l’emporte sur le groupe");
  assert.equal(r({ site: "sodeplax" }), g.id, "Sans règle de site : le groupe");
  assert.equal(r({ site: "marzin", client: "client a", article: "PAN-18" }), "ECH-C", "Le client l’emporte");
  assert.equal(r({ site: "marzin", client: "Client A", article: "CHT-1" }), "ECH-M", "Hors périmètre d’articles du client : règle du site");
  assert.equal(a.run('ehVerdict(data.samples.find(s=>s.id==="ECH-M"),5).label'), "À la limite : conforme");
  assert.equal(a.run('ehVerdict(data.samples.find(s=>s.id==="ECH-M"),7).label'), "À retoucher");
  assert.equal(a.run('ehVerdict(data.samples.find(s=>s.id==="ECH-C"),0.5).ok'), false, "Aucun défaut admis");
  // Écarts entre sites et revalidation
  assert.match(a.q(".eh-gaps").textContent, /Aspect, rayure[\s\S]*10 mm[\s\S]*5 mm/);
  assert.equal(a.run('ehReview(data.samples.find(s=>s.id==="ECH-M"))'), true);
  // Contrôle au poste par le directeur de Marzin, puis non-conformité préremplie
  a.run('state.role="director";state.site="marzin";render()');
  assert.match(a.q(".eh-rule").textContent, /remplace : Groupe[\s\S]*accepté jusqu’à 5 mm/);
  a.fill("#ehMeasure", "7");
  a.run('document.querySelector("#ehMeasure").dispatchEvent(new Event("change"))');
  assert.match(a.q(".eh-verdict").textContent, /À retoucher/);
  a.click("[data-eh-nc]");
  assert.equal(a.q("#ncText").value.includes("hors tolérance"), true);
  assert.match(a.q("#ncAuto").textContent, /Échantillothèque[\s\S]*5 mm \(règle Marzin\)/);
  a.run("closeModal()");
  a.run('switchView("home")');
  assert.ok(a.q('.jn-watch [data-eh-go="ECH-M"]'), "Référence à revalider");
  assert.deepEqual(JSON.parse(a.run('state.echOn=true;switchView("documents");state.echOn=true;render();JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
});

test("Tour de contrôle 8.41 · tous les sites et indicateurs, alertes classées, site en grand, mode télévision", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="lean";state.site="group";render()');
  const tabs = JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="voir")).map(x=>x.label))'));
  assert.deepEqual(tabs.slice(0, 2), ["Pilotage", "Tour de contrôle"]);
  a.run('state.pilotTab="tour";switchView("pilotage");state.pilotTab="tour";render()');
  assert.match(a.q(".tr-head h1").textContent, /sept sites/);
  assert.equal(a.run('document.querySelectorAll(".tr-matrix tbody tr").length'), a.run("trSites().length"));
  assert.match(a.q(".tr-band").textContent, /indicateurs en écart[\s\S]*actions en retard[\s\S]*réclamations client/);
  // Une réponse client en retard passe en tête des alertes
  a.run(`data.ncs=[{id:"NC-T",site_id:"sodeplax",date:auAddDays(-30),claim_date:auAddDays(-30),origin:"Client",client:"Client Z",defect:"Dimension",status:"Ouverte",qty:3,severity:"Majeure",text:"x"}];render()`);
  const al = JSON.parse(a.run("JSON.stringify(trAlerts(trSites()).map(x=>[x.lvl,x.what,x.site.id]))"));
  assert.ok(al.some(([l, w, s]) => l === 3 && w === "Réponse client en retard" && s === "sodeplax"));
  assert.ok(al.every((x, i, arr) => i === 0 || arr[i - 1][0] >= x[0]), "Alertes classées par gravité");
  // Site en grand, puis retour
  a.click('[data-tr-site="marzin"]');
  assert.match(a.q(".tr-head h1").textContent, /Marzin/);
  assert.equal(a.run('document.querySelectorAll(".tr-matrix tbody tr").length'), 1);
  a.click('.tr-head [data-tr-site=""]');
  // Mode télévision
  a.click("[data-tr-tv]");
  assert.equal(a.run("trTv"), true);
  a.click("[data-tr-tv]");
  assert.equal(a.run("trTv"), false);
  // Une alerte mène à son écran
  a.click('[data-tr-go]');
  assert.notEqual(a.run("state.pilotTab"), "tour");
  // Le directeur ne voit que son site
  a.run('state.role="director";state.site="marzin";render();state.pilotTab="tour";switchView("pilotage");state.pilotTab="tour";render()');
  assert.equal(a.run('document.querySelectorAll(".tr-matrix tbody tr").length'), 1);
  assert.deepEqual(JSON.parse(a.run('JSON.stringify([...document.querySelectorAll("#appView button")].filter(b=>!b.onclick&&!b.disabled).map(b=>b.outerHTML.slice(0,60)))')), []);
  // Le chef d'équipe n'a pas la tour (pas de pilotage)
  a.run('state.role="teamlead";render()');
  assert.equal(a.run("trCan()"), false);
});

test("Ergonomie 8.42 · nouveautés à l’accueil, onglets « Plus » sur téléphone, sommaire des pages longues", (t) => {
  const a = app(t);
  demo(a);
  a.run('try{localStorage.removeItem("bia-news-seen")}catch{};state.role="lean";state.site="group";state.view="home";render()');
  assert.match(a.q(".er-news").textContent, /Le pilotage parle la langue du panneau[\s\S]*Panneau TOP 5 reporté[\s\S]*Informations à tous les TOP 5[\s\S]*TOP 5 à l’écran[\s\S]*Tour de contrôle[\s\S]*Échantillothèque[\s\S]*Non-conformités/);
  a.click('[data-er-news="4"]');
  assert.equal(a.run("state.pilotTab"), "tour");
  a.run('state.view="home";render()');
  a.click("[data-er-seen]");
  assert.equal(a.q(".er-news"), null, "« J’ai vu » range la carte");
  // Le chef d'équipe ne se voit proposer que ses écrans
  a.run('try{localStorage.removeItem("bia-news-seen")}catch{};state.role="teamlead";state.site="marzin";render()');
  assert.deepEqual(JSON.parse(a.run("JSON.stringify(erNews().map(n=>n.label))")).includes("Tour de contrôle"), false);
  // Onglets sur téléphone
  a.run('window.innerWidth=390;state.role="lean";state.site="group";state.pilotTab="";switchView("pilotage")');
  const row = a.run('uxTabRow()');
  assert.doesNotMatch(row, /Plus ·/, "8.48.2 : tous les onglets, la barre défile");
  assert.equal((row.match(/data-ux-tab=/g) || []).length, a.run('uxTabs(uxStageOf(state.view)).length'));
  a.run('window.innerWidth=1366');
  assert.doesNotMatch(a.run('uxTabRow()'), /Plus ·/);
});

test("TOP 5 8.43 · écran atelier, lettres, ce qui s’est dit, informations descendantes, TOP 15", (t) => {
  const a = app(t);
  demo(a);
  // Une information du site, avec son contexte, pour tout le site
  a.run('state.role="director";state.site="marzin";state.workshop=null;state.t5Tab=true;switchView("sqcdp")');
  assert.match(a.q("#appView").textContent, /TOP 5 · /);
  a.click("[data-t5-newinfo]");
  a.run('document.getElementById("t5Title").value="Audit client jeudi 14 h";document.getElementById("t5Why").value="Ligne rangée mercredi soir"');
  a.run('document.getElementById("t5InfoForm").requestSubmit()');
  assert.equal(a.run("data.infos.length"), 1);
  assert.match(a.q("#appView").textContent, /Dite dans 0\//);
  // Le chef d'équipe ouvre l'écran de son atelier
  a.run('state.role="teamlead";state.t5Tab=false;switchView("sqcdp")');
  const ws = a.run('(osActive(data.workshops).find(w=>w.site_id==="marzin")||{}).id||""');
  a.run(`state.workshop=${JSON.stringify(ws)}||null;render()`);
  assert.ok(a.q("[data-t5-open]"), "bouton Écran TOP 5 dans SQCDP");
  a.click("[data-t5-open]");
  assert.ok(a.q("#t5Screen .t5-L"), "page S");
  a.click('#t5Screen [data-t5-set="ok"]');
  assert.equal(a.run('sjGet(today(),"S").status'), "ok");
  a.click('#t5Screen [data-t5-go="1"]');
  a.click('#t5Screen [data-t5-set="ko"]');
  a.run('const i=document.querySelector("#t5Screen [data-t5-kotext]");i.value="Rebut peinture lot 42";i.form.requestSubmit()');
  assert.ok(a.run('sjGet(today(),"Q").topic_id'), "l’écart monte au TOP 15");
  a.run('const n=document.querySelector("#t5Screen [data-t5-note]");n.value="Le fournisseur passe demain";n.dispatchEvent(new Event("input"))');
  a.click('#t5Screen [data-t5-go="6"]');
  assert.match(a.q("#t5Screen").textContent, /Ce que ça change pour vous[\s\S]*Ligne rangée/);
  a.click("#t5Screen [data-t5-tell]");
  assert.equal(a.run("data.infos[0].relayed.length"), 1);
  a.click('#t5Screen [data-t5-go="7"]');
  a.run('const f=document.querySelector("#t5Screen [data-t5-addp]");f.querySelector("input").value="Karim";f.requestSubmit()');
  a.click("#t5Screen [data-t5-held]");
  const m = JSON.parse(a.run('JSON.stringify(data.meetings.find(m=>m.kind==="top5"))'));
  assert.equal(m.letters.S, "ok"); assert.equal(m.letters.Q, "ko");
  assert.equal(m.notes.Q, "Le fournisseur passe demain");
  assert.deepEqual(m.present, ["Karim"]); assert.equal(m.infos.length, 1);
  a.click("#t5Screen [data-t5-x]");
  assert.equal(a.q("#t5Screen"), null);
  // En haut : ce qui s'est dit, et la diffusion
  a.run('state.role="director";state.t5Tab=true;switchView("sqcdp")');
  assert.match(a.q("#appView").textContent, /Le fournisseur passe demain/);
  assert.match(a.q("#appView").textContent, /Dite dans 1\//);
  // Le TOP 15 reçoit ce qui s'est dit
  assert.ok(a.run('RE_TYPES.top15.agenda.some(([k])=>k==="top5dit")'));
  assert.equal(a.run('RE_TYPES.top15.agenda.reduce((n,x)=>n+x[1],0)'), 15);
  assert.match(a.run('reBlock("top5dit",{site_id:"marzin",type:"top15"}).html'), /Rebut peinture lot 42/);
  // Le Responsable Lean le trouve dans Voir
  a.run('state.role="lean";state.site="group";switchView("pilotage")');
  assert.ok(JSON.parse(a.run('JSON.stringify(uxTabs(uxStages().find(s=>s.id==="voir")).map(t=>t.key))')).includes("top5"));
});

test("Informations 8.44 · urgente en bandeau, question de l’équipe, réponse qui redescend", (t) => {
  const a = app(t);
  demo(a);
  a.run('state.role="director";state.site="marzin";state.workshop=null;state.t5Tab=true;switchView("sqcdp")');
  a.click("[data-t5-newinfo]");
  a.run('document.getElementById("t5Title").value="Coupure électrique mardi 6 h";document.getElementById("t5Why").value="Lignes arrêtées jusqu’à 8 h";document.getElementById("t5Urgent").checked=true;document.getElementById("t5InfoForm").requestSubmit()');
  a.run("void 0");
  assert.equal(a.run("data.infos[0].urgent"), true);
  const ws = a.run('(osActive(data.workshops).find(w=>w.site_id==="marzin")||{}).id||""');
  a.run(`state.role="teamlead";state.workshop=${JSON.stringify(ws)}||null;t5Open()`);
  assert.match(a.q("#t5Screen .t5-urgent").textContent, /Coupure électrique/, "bandeau urgent sur la page S");
  a.click('#t5Screen [data-t5-go="6"]');
  a.run('const f=document.querySelector("#t5Screen [data-t5-q]");f.querySelector("input").value="Qui redémarre la ligne 2 ?";f.requestSubmit()');
  assert.equal(a.run("data.infos[0].questions.length"), 1);
  a.click("#t5Screen [data-t5-tell]");
  a.click('#t5Screen [data-t5-go="0"]');
  assert.equal(a.q("#t5Screen .t5-urgent"), null, "dite : le bandeau disparaît");
  a.click('#t5Screen [data-t5-go="7"]');
  a.click("#t5Screen [data-t5-held]");
  a.click("#t5Screen [data-t5-x]");
  assert.match(a.run('reBlock("top5dit",{site_id:"marzin",type:"top15"}).html'), /Qui redémarre la ligne 2/);
  // Le directeur répond
  a.run('state.role="director";state.t5Tab=true;switchView("sqcdp")');
  assert.match(a.q(".t5-qsec").textContent, /Qui redémarre la ligne 2/);
  a.run('const f=document.querySelector("[data-t5-ans]");f.querySelector("input").value="La maintenance, à 7 h 45";f.requestSubmit()');
  assert.equal(a.run("data.infos[0].questions[0].answer"), "La maintenance, à 7 h 45");
  assert.equal(a.q(".t5-qsec"), null);
  // La réponse redescend à l’atelier
  a.run(`state.role="teamlead";state.workshop=${JSON.stringify(ws)}||null;t5Open();t5Go(5)`);
  assert.match(a.q("#t5Screen").textContent, /La maintenance, à 7 h 45/);
  a.click("#t5Screen [data-t5-qret]");
  assert.ok(a.run("data.infos[0].questions[0].returned_at"));
  a.run("t5Close()");
});

test("TOP 5 8.45 · accueil à un geste, onglets avec compteurs, lettre suivante, clôture guidée, formulaire simplifié", (t) => {
  const a = app(t);
  demo(a);
  const ws = a.run('(osActive(data.workshops).find(w=>w.site_id==="marzin")||{}).id||""');
  // Le chef d'équipe : son TOP 5 sur l’accueil, son information limitée à son atelier
  a.run(`state.role="teamlead";state.site="marzin";state.workshop=${JSON.stringify(ws)}||null;try{localStorage.removeItem(t5Key())}catch{};switchView("home")`);
  assert.match(a.q(".t5-home").textContent, /À tenir aujourd’hui/);
  a.run("t5InfoForm()");
  assert.equal(a.all("[data-t5-scope]").length, 1, "le chef d’équipe écrit pour son atelier");
  a.run('document.getElementById("t5Title").value="Nouveau gabarit poste 3";document.getElementById("t5Title").dispatchEvent(new Event("input"))');
  assert.match(a.q("#t5Prev").textContent, /Nouveau gabarit poste 3[\s\S]*Sans « ce que ça change »/, "aperçu à l’écran");
  a.click('[data-t5-span="13"]');
  a.run('document.getElementById("t5InfoForm").requestSubmit()');
  assert.equal(a.run("data.infos[0].end"), a.run("auAddDays(13)"));
  assert.equal(a.run("data.infos[0].workshop_id"), ws || null);
  a.run('switchView("home")');
  assert.match(a.q(".t5-home").textContent, /1 info à dire/);
  // SQCDP : un seul départ
  a.run('switchView("sqcdp")');
  assert.match(a.q("#appView").textContent, /Lancer le TOP 5/);
  a.run('switchView("home")');
  a.click(".t5-home [data-t5-open]");
  assert.ok(a.q("#t5Screen"));
  assert.match(a.q('#t5Screen [data-t5-go="6"]').textContent, /1/, "compteur sur Informations");
  a.run('window.__st=window.setTimeout;window.setTimeout=(f)=>{f();return 0}');
  a.click('#t5Screen [data-t5-set="ok"]');
  a.run('window.setTimeout=window.__st');
  assert.equal(a.run("t5Idx"), 1, "bonne journée : lettre suivante");
  // Clôture : lettres à renseigner, mêmes présents que la dernière fois
  a.run(`commitData(()=>(data.meetings||=[]).unshift({id:"PT-old",kind:"top5",site_id:"marzin",workshop_id:${JSON.stringify(ws)}||null,date:auAddDays(-1),present:["Nora","Karim"],duration_s:240}))`);
  a.run("t5Go(7)");
  assert.ok(a.q("#t5Screen [data-t5-same]"), a.run("JSON.stringify({d:t5Draft().present,l:t5LastPresent(),m:(data.meetings||[]).length})"));
  assert.match(a.q("#t5Screen .t5-miss").textContent, /Q, C, D, P/);
  a.click("#t5Screen [data-t5-same]");
  assert.equal(a.run("t5Draft().present.length"), 2);
  a.click('#t5Screen .t5-sumrow [data-t5-go="1"]');
  assert.equal(a.run("t5Idx"), 1, "une lettre manquante se rejoint d’un geste");
  a.run("t5Go(7)");
  a.click("#t5Screen [data-t5-held]");
  assert.match(a.q("#t5Screen .t5-heldmsg").textContent, /Point tenu/);
  a.click("#t5Screen .t5-endrow [data-t5-x]");
  assert.match(a.q(".t5-home").textContent, /Tenu à/);
  // Le directeur : question sans réponse sur l’accueil, « Répondre » ouvre Voir › TOP 5
  a.run(`state.role="teamlead";t5Open();t5Go(6)`);
  a.run('const f=document.querySelector("#t5Screen [data-t5-q]");f.querySelector("input").value="Où est rangé l’ancien ?";f.requestSubmit()');
  a.run("t5Close()");
  a.run('state.role="director";switchView("home")');
  assert.match(a.q(".t5-home").textContent, /1 question des équipes sans réponse/);
  a.click(".t5-home [data-t5-tab]");
  assert.ok(a.q(".t5-qsec"), "Voir › TOP 5, questions en tête");
});

test("Panneau TOP 5 8.46 · exemple Marzin repartant de zéro, copie du panneau, report après la réunion, sujets au plan d’actions", (t) => {
  const a = app(t);
  // L’exemple de démonstration : rien d’autre que le panneau de Marzin et ce qu’il a produit
  a.run('pnUseClean=true;data=osFreshData(true);osInit();state.role="teamlead";state.site="marzin";state.workshop=null;render()');
  assert.equal(a.run("data.meta.demo_revision"), 11);
  assert.equal(a.run("data.boards.length"), 7, "un panneau TOP 5 par site");
  assert.ok(a.run('OPERATIONAL_SITES.every(s=>data.measures.some(m=>m.site_id===s.id&&m.code==="trs"))'), "les sept sites ont leurs indicateurs");
  assert.ok(a.run('["zones","machines","smed","balances","samples","skillsMatrix","envMonths","projects"].every(k=>(data[k]||[]).length)'), "toutes les rubriques remplies");
  assert.ok(a.run('data.signals.some(s=>String(s.photo||"").startsWith("photo:DEMO-"))'), "photos d’exemple");
  assert.ok(a.run('(()=>{const p=benchmarkDefaultPeriod(benchmarkPeriods());return OPERATIONAL_SITES.every(s=>GROUP_SQCDP.every(k=>benchmarkObservation(s.id,k.code,p)))})()'), "Décider : les 7 sites × 5 axes sur une même semaine");
  assert.equal(a.run('data.boardWeeks.filter(w=>w.board_id==="PN-MARZIN").length'), 6);
  assert.equal(a.run('data.actions.filter(x=>x.board_id==="PN-MARZIN").length'), 4);
  assert.ok(a.run('data.measures.some(m=>m.code==="service"&&m.value===91)'), "livrées à temps → service client");
  assert.deepEqual(a.run("osIntegrity(data)"), [], "aucune relation cassée");
  // Le fil rouge : chaque sujet du panneau a son histoire, d’un écran à l’autre
  assert.equal(a.run('data.signals.find(s=>s.id==="S-PN1").problem_id'), "P-PN1", "signal → A3");
  assert.ok(a.run('data.actions.filter(x=>x.parent_id==="A-PN2").length>=3'), "A3 → actions détaillées");
  assert.ok(a.run('data.opls.some(o=>o.practice_id==="BP-PN1"&&o.status==="validee")'), "→ OPL validée");
  assert.ok(a.run('data.gains.some(g=>g.source_id==="P-PN1")'), "→ gain");
  assert.ok(a.run('data.escalations.some(e=>e.source_id==="A-PN41")'), "MIC bloquée → escalade");
  assert.ok(a.run('data.trsShifts.length>20&&data.microStops.length>20'), "feuilles de poste et micro-arrêts");
  assert.ok(a.run('data.kaizens.filter(k=>k.status==="Idée").length>=2'), "Quick win : idées à qualifier");
  assert.ok(a.run('["En cours","À vérifier","Clôturée","Ouverte"].every(st=>data.actions.some(x=>x.status===st))'), "états variés");
  assert.ok(a.run('data.actions.some(x=>x.status!=="Clôturée"&&x.due_date<today())'), "au moins une action en retard");
  // Voir › TOP 5 : la copie fidèle du panneau
  a.run('switchView("home")');
  assert.match(a.q(".pn-home").textContent, /Panneau TOP 5 Marzin[\s\S]*Reporté par/, "le chef d’équipe voit son panneau à l’accueil");
  a.click(".pn-home [data-pn-open]");
  const board = a.q(".pn-board").textContent;
  assert.match(board, /TOP 5 Marzin[\s\S]*Jours sans accident[\s\S]*47[\s\S]*NC par pôle[\s\S]*Taux d’absentéisme/);
  assert.match(board, /Stationner les transpalettes[\s\S]*Aspiration déligneuse[\s\S]*Comprendre – décider – suivre/i);
  assert.ok(a.q(".pn-arrow.good"), "tendance calculée");
  assert.ok(a.q(".pn-dot.bloque"), "sujet bloqué en rouge");
  assert.match(a.q(".pn-how").textContent, /reste en atelier[\s\S]*5 minutes[\s\S]*fait le reste/);
  // Semaine suivante : le report
  a.run('commitData(()=>{data.boardWeeks=data.boardWeeks.filter(w=>w.week!==pnCurrentWeek(data.boards[0]))});render()');
  assert.match(a.q(".pn-state").textContent, /Pas encore reporté/);
  a.run('switchView("home")');
  a.click(".pn-home [data-pn-open]");
  assert.ok(a.q("#pnForm"));
  assert.equal(a.q('#pnForm [name="pn-jsa"]').getAttribute("placeholder"), "40", "valeur de la semaine d’avant en gris");
  a.fill('#pnForm [name="pn-jsa"]', "47");
  a.fill('#pnForm [name="pn-abs"]', "6");
  a.fill('#pnForm [name="pn-ncpole-0"]', "4");
  a.fill('#pnForm [name="pn-m0"]', "Badge obligatoire au portail");
  const n = a.all('#pnForm [name$="-st"]').length;
  a.fill(`#pnForm [name="pn-s${n - 1}-title"]`, "Éclairage zone contrôle");
  a.fill(`#pnForm [name="pn-s${n - 1}-owner"]`, "Maintenance");
  a.fill('#pnForm [name="pn-s0-st"]', "resolu");
  a.submit("#pnForm");
  assert.equal(a.run('data.boardWeeks.filter(w=>w.board_id==="PN-MARZIN").length'), 6);
  assert.match(a.q(".pn-state").textContent, /Reporté le/);
  assert.ok(a.q(".pn-arrow.bad"), "absentéisme en hausse : en recul");
  assert.equal(a.run('data.actions.find(x=>x.title==="Éclairage zone contrôle").board_id'), "PN-MARZIN", "nouveau sujet au plan d’actions");
  assert.ok(a.run('data.measures.some(m=>m.code==="staffing"&&m.value===94)'), "absentéisme 6 % → couverture 94 %");
  const m = a.run('JSON.stringify(data.meetings.find(x=>x.source==="panneau"&&x.date<=today()&&x.letters&&x.letters.P))');
  assert.match(m, /"P":"ko"/, "la lettre P remonte en écart");
  // Les messages redescendent sur l’accueil des équipes ; le directeur lit les panneaux
  a.run('state.role="operator";switchView("home")');
  assert.match(a.q(".pn-home").textContent, /Badge obligatoire au portail/);
  a.run('state.role="dg";state.site="group";render();t5GoTab();render()');
  assert.match(a.q(".pn-sec").textContent, /TOP 5 Marzin[\s\S]*Reporté par/);
  assert.ok(a.run('RE_TYPES.top15.agenda.some(([k])=>k==="panneau")'));
  assert.equal(a.run('RE_TYPES.top15.agenda.reduce((n,x)=>n+x[1],0)'), 15, "le TOP 15 reste à 15 minutes");
});

test("Plan d’actions 8.49 · historique des points dans la revue et la fiche, revues conservées", (t) => {
  const a = app(t);
  a.run('pnUseClean=true;data=osFreshData(true);osInit();state.role="director";state.site="marzin";state.workshop=null;switchView("actions")');
  // Les revues passées sont listées
  assert.match(a.q(".ap-reviews").textContent, /Historique des points[\s\S]*revue/);
  assert.ok(a.run('data.actionReviews.filter(r=>r.site_id==="marzin").length>=3'));
  // La fiche d’une action montre tout son historique (points, report, statuts)
  a.run('apOpen("A-PN41")');
  const sheet = a.q("#modalContent").textContent;
  assert.match(sheet, /Second fournisseur retenu[\s\S]*Échéance déplacée[\s\S]*Commande passée/);
  assert.match(sheet, /Statut : En cours/);
  a.run("closeModal()");
  // Faire le point : chaque action montre son historique, et la revue est conservée
  a.click("[data-ap-review]");
  assert.match(a.q(".ap-rv-hist").textContent, /Historique · \d+ point/);
  const before = a.run('data.actionReviews.length');
  a.fill("#apRvNote", "Relance faite ce matin");
  a.click('[data-ap-rv="note"]');
  a.click("[data-ap-rv-quit]");
  assert.equal(a.run('data.actionReviews.length'), before + 1, "revue interrompue conservée");
  assert.match(a.run('data.actionReviews[0].report'), /Relance faite ce matin/);
  assert.match(a.q(".ap-reviews").textContent, /interrompue/);
});

test("Pilotage 8.50 · indicateurs du panneau, cibles par usine, rubriques par site, TOP 5 au jour du panneau", (t) => {
  const a = app(t);
  a.run('pnUseClean=true;data=osFreshData(true);osInit();state.role="lean";state.site="marzin";state.workshop=null;state.pilotageMode="analysis";state.osTab="tower";switchView("pilotage")');
  // Les indicateurs du panneau remplacent les cinq indicateurs ; le TRS reste mesuré pour Observer
  assert.deepEqual(a.run("inKpis().map(k=>k.code)"), ["pn_jsa", "pn_nc", "pn_sav", "pn_err", "pn_ca", "pn_otd", "pn_retard", "pn_abs"]);
  assert.ok(a.run('osKpi("trs").archived_at&&data.measures.some(m=>m.code==="trs")'), "TRS archivé du pilotage, toujours mesuré");
  assert.equal(a.run('osLatest("marzin","pn_nc").value'), 10, "NC = somme des trois pôles");
  assert.equal(a.run('document.querySelectorAll(".pp-card").length'), 5, "cinq cartes S Q C D P");
  assert.match(a.q(".pp-card").textContent, /Jours sans accident[\s\S]*record 212 j/);
  assert.match(a.q("#appView").textContent, /Top 1 Réglages machine MIC/);
  assert.equal(a.run('osStatus(osLatest("marzin","pn_ca"))'), "qualify", "CA sans objectif : à qualifier");
  assert.deepEqual(a.run('pmChecks().filter(c=>!c.ok).map(c=>c.id)'), [], "8.50.1 : paramétrage complet dans l’exemple (responsables et personnes de chaque site)");
  assert.equal(a.run('osRecord("marzin").row.owner'), "Thomas G.");
  // Décider : 7 sites × 8 indicateurs
  a.run('state.site="group";state.pilotageMode="ritual";render()');
  assert.equal(a.run('document.querySelectorAll(".sqcdp-cell").length'), 56);
  assert.match(a.q('[data-sqcdp-site="marzin"][data-sqcdp-code="pn_ca"]').textContent, /Objectif à saisir/);
  a.click('[data-sqcdp-site="marzin"][data-sqcdp-code="pn_otd"]');
  assert.match(a.q("#modalContent").textContent, /91/);
  a.run("closeModal()");
  // Cibles par usine : objectif CA et NC propres à Marzin
  a.run('state.adminTab="targets";switchView("settings")');
  a.fill('[name="pp-marzin-pn_ca"]', "400");
  a.fill('[name="pp-marzin-pn_nc"]', "12");
  a.submit("#ppTargets");
  assert.equal(a.run('data.settings.siteTargets.marzin.pn_ca'), 400);
  assert.equal(a.run('osStatus(osLatest("marzin","pn_ca"))'), "ok", "412 k€ pour un objectif de 400");
  assert.equal(a.run('osStatus(osLatest("marzin","pn_nc"))'), "ok", "10 NC pour une cible Marzin à 12");
  assert.equal(a.run('osStatus(osLatest("profiline","pn_nc"))'), "ok", "les autres usines gardent la cible Groupe");
  assert.deepEqual(a.run("osIntegrity(data)"), []);
  // Rubriques par site : seule la base pour Le Moine
  a.run('state.adminTab="rubriques";render()');
  a.click('[data-pp-rub-site="le-moine"][data-pp-rub-set="base"]');
  a.run('state.site="le-moine";render()');
  const keys = a.run('uxStages().flatMap(s=>uxTabs(s).map(t=>t.key))');
  assert.ok(["top5", "actions", "signals", "gemba", "micro", "pilotage"].every((k) => keys.includes(k)));
  assert.ok(!keys.includes("hoshin") && !keys.includes("smed"), "rubriques non cochées masquées");
  assert.ok(!a.run('uxStages().some(s=>s.id==="perenniser")'), "étape vide masquée");
  a.run('state.site="marzin";render()');
  assert.ok(a.run('uxStages().flatMap(s=>uxTabs(s).map(t=>t.key)).includes("hoshin")'), "Marzin garde tout");
  a.run('data.settings.siteRubriques={};const c=document.createElement("div");c.innerHTML=\'<input type="checkbox" data-pp-rub="marzin|hoshin">\';document.body.append(c);ppBind(c);c.querySelector("input").checked=false;c.querySelector("input").onchange()');
  assert.equal(a.run('data.settings.siteRubriques.marzin.hoshin'), false);
  // Installation neuve : la base seulement
  assert.deepEqual(a.run('(()=>{const b=osFreshData(false);return Object.entries(b.settings.siteRubriques.marzin).filter(([k,v])=>v===true).map(([k])=>k).sort()})()'), ["actions", "gemba", "micro", "signals", "top5"]);
  // Réunions : le TOP 5 au jour du panneau
  a.run('state.site="group";data.settings.siteRubriques={};render();uxGo(uxTabs(uxStages().find(s=>s.id==="voir")).find(t=>t.key==="meetings"))');
  assert.match(a.q(".cg-steps").textContent, /TOP 5Atelier · chaque semaine · devant le panneau7\/7 panneaux reportés/);
  assert.match(a.q(".pp-top5-week").textContent, /Marzin[\s\S]*mardi[\s\S]*10 h[\s\S]*Karim B\./);
});
