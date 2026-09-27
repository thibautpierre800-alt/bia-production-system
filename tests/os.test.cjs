const { test } = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers.cjs");
function fields(a, values, form = "#osForm") {
  for (const [name, value] of Object.entries(values))
    a.fill(`${form} [name="${name}"]`, String(value));
}
function demo(a) {
  a.run(
    'data=osFreshData(true);osInit();state.site="group";state.role="lean";render()',
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
  a.fill("#gembaZone", "Finition");
  a.fill("#gembaObjective", "Comprendre les réglages répétés");
  a.fill("#gembaAuthor", "Manager");
  a.submit("#gembaForm");
  const id = a.run("data.gembas[0].id");
  a.click(`[data-gemba-observe="${id}"]`);
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
    a.run(`editDocument('${doc}',${i})`);
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
  a.fill("#practiceTitle", "Butée de réglage");
  a.fill("#practiceSummary", "Utiliser une butée au changement de série");
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
  assert.ok(a.all(".control-analysis-table tbody tr").length >= 5);
  assert.match(a.q("#appView").textContent, /Control Tower/);
  assert.match(a.q("#appView").textContent, /SQCDP/);
  const result = JSON.parse(
    a.run(
      'JSON.stringify(osSuggestions("marzin").find(s=>s.kpi_id==="KPI-trs"))',
    ),
  );
  assert.ok(result.practices.includes("BP-transfert"));
  assert.equal(result.basis.length, 5);
  assert.match(a.q("#appView").textContent, /Suggestion à examiner/);
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
