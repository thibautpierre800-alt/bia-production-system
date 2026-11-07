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
  assert.deepEqual(a.all("#pageLocation .ux-tab").map((b) => b.textContent), ["Gemba", "5S", "TPM", "Rapport d’étonnement", "Signaux", "Audits", "Statistiques"]);
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
  assert.ok(a.q(".sj-panel [data-timer]"), "Démarrer le point");
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
