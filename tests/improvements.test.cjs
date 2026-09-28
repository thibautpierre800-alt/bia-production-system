const { test } = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("./helpers.cjs");

function fresh(t) {
  const a = app(t);
  a.run('data=osFreshData(false);osInit();state.role="lean";state.site="marzin";state.workshop="";render();data.actions.push({id:"A-74",site_id:"marzin",title:"Réduire les défauts",owner:"Qualité",status:"En cours",due_date:today(),progress:50})');
  return a;
}
function plan(a, offset = -95) {
  a.run(`osSaveSustainment("A-74",{start_date:osDateOffset(${offset}),owner:"Qualité",criterion:"Moins de 3 défauts pour 100 pièces",before:8,target:3,unit:"%",direction:"low"})`);
}
function chain(a) {
  a.run('data.people.push({id:"PER-74",name:"Camille",site_id:"marzin",status:"Actif"});data.documents.push({id:"STD-74",site_id:"marzin",type:"STANDARD",title:"Contrôle visuel",version:2,status:"Validé"});osSaveChain("A-74",{standard_id:"STD-74",training_id:"FOR-013",required_person_ids:["PER-74"]})');
}
function vsm(a) {
  a.run('data.documents.push({id:"VSM-74",type:"VSM",site_id:"marzin",title:"Flux pilote",vsm:{current:{available_minutes:420,demand_per_day:100,nodes:[{id:"N-74",type:"process",name:"Découpe",ct:100,va:80,uptime:90,wait:5,wip:10}],edges:[]},future:{available_minutes:420,demand_per_day:100,nodes:[{id:"N-75",type:"process",ct:60,va:50,uptime:95,wait:2,wip:4}],edges:[]}}})');
}
function environment(a) {
  a.run('for(const [i,t] of OS_ENV_KPIS.entries())data.kpis.push({id:"KPI-ENV-"+i,...t,axis:"C",direction:"low",target:2,green:2,orange:3,red:20,definition:"Même périmètre",site_id:"group"});data.environmentLogs.push({id:"ENV-74",site_id:"marzin",title:"Famille A / mois",date:today(),period_start:osDateOffset(-20),good_units:100,energy_kwh:500,waste_kg:0,co2_kg:null,evidence:"Compteur et pesée atelier",waste_type:"Défauts",source_id:"A-74",owner:"Qualité"})');
}

test("7.4 · migration additive, données conservées, options distantes inactives", t => {
  const a = fresh(t), raw = a.run('JSON.stringify(data)'), b = app(t, raw);
  assert.equal(b.run('data.actions[0].id'), 'A-74');
  assert.equal(b.run('data.environmentLogs.length'), 0);
  assert.equal(b.run('Boolean(data.settings.assistantEndpoint)'), false);
  assert.equal(b.run('Boolean(data.settings.autoEscalation)'), false);
  assert.equal(b.run('JSON.stringify(migrateOS(data))===JSON.stringify(data)'), true);
});
test("7.4 · calendrier J30/J60/J90, preuve et réouverture sans perte d’historique", t => {
  const a = fresh(t); plan(a);
  assert.equal(a.run('osReviewStatus(data.actions[0]).due.length'), 3);
  for (const days of [30,60,90]) a.run(`osSaveReview("A-74",{days:${days},date:today(),value:2,outcome:"Efficace",evidence:"100 pièces contrôlées",verified_by:"Camille"})`);
  assert.equal(a.run('osReviewStatus(data.actions[0]).maintained'), true);
  a.run('data.actions[0].status="Clôturée";osSaveReview("A-74",{days:90,date:today(),value:6,outcome:"Inefficace",evidence:"Récidive au contrôle",verified_by:"Camille",reaction:"Reprendre le réglage"})');
  assert.equal(a.run('data.actions[0].status'), 'En cours');
  assert.equal(a.run('data.actions[0].sustainment.checks.length'), 4);
  a.run('save()'); const b = app(t, a.stored());
  assert.equal(b.run('data.actions[0].sustainment.checks.length'), 4);
});
test("7.4 · rejette attestation anticipée, futur, cible non atteinte et changement de référence", t => {
  const a = fresh(t); plan(a, -10);
  assert.throws(() => a.run('osSaveReview("A-74",{days:30,date:today(),value:2,outcome:"Efficace",evidence:"Test",verified_by:"X"})'), /avant son échéance/);
  plan(a);
  assert.throws(() => a.run('osSaveReview("A-74",{days:30,date:today(),value:5,outcome:"Efficace",evidence:"Test",verified_by:"X"})'), /cible/);
  assert.throws(() => a.run('osSaveReview("A-74",{days:30,date:osDateOffset(1),value:2,outcome:"Efficace",evidence:"Test",verified_by:"X"})'), /futur/);
  a.run('osSaveReview("A-74",{days:30,date:today(),value:2,outcome:"Efficace",evidence:"Test",verified_by:"X"})');
  assert.throws(() => a.run('osSaveSustainment("A-74",{...data.actions[0].sustainment,target:9})'), /conservez/);
  assert.equal(a.run('osShiftDay("2026-01-31",30)'), '2026-03-02');
  assert.equal(a.run('osValidDay("2026-02-31")'), false);
});
test("7.4 · formulaires de suivi, alertes et droits par rôle", t => {
  const a = fresh(t); a.run('osSustainmentForm("A-74")');
  a.fill('#osSustainmentForm [name="start_date"]', a.run('osDateOffset(-40)'));
  a.fill('#osSustainmentForm [name="criterion"]', 'Aucun défaut sur trois lots');
  a.submit('#osSustainmentForm');
  assert.ok(a.q('.os-continuity'));
  a.run('closeModal();openNotificationCenter()'); assert.match(a.q('#modalContent').textContent, /Contrôle J30/);
  a.run('closeModal();state.role="dg";state.site="group";actionForm(data.actions[0])');
  assert.equal(a.all('[data-improvement="plan"]').length, 0);
  assert.throws(() => a.run('osSaveSustainment("A-74",{})'), /manager/);
});
test("7.4 · formation dans la grille existante, lien standard/version/personne", t => {
  const a = fresh(t); chain(a);
  a.run('trainingRecordForm("PER-74","FOR-013",{action_id:"A-74"})');
  assert.ok(a.q('#osTrainingContext'));
  a.fill('#recordTrainer','Référent'); a.fill('#recordLevel','3'); a.fill('#recordStatus','Validé'); a.fill('#recordEvidence','Trois cycles autonomes'); a.fill('#recordValidator','Chef atelier'); a.fill('#recordValidatedAt',a.run('today()'));
  a.submit('#trainingRecordForm');
  assert.equal(a.run('data.trainingRecords[0].standard_version'),2);
  assert.equal(a.run('data.trainingRecords[0].action_id'),'A-74');
  assert.equal(a.run('osChain(data.actions[0]).complete'), true);
  assert.equal(a.run('data.activity.some(e=>e.event.startsWith("Qualification"))'), true);
  a.run('data.trainingRecords[0].expires_at=osDateOffset(-1)');
  assert.equal(a.run('osChain(data.actions[0]).complete'), false);
  a.run('delete data.trainingRecords[0].expires_at');
  assert.equal(a.run('osChain(data.actions[0]).complete'), true);
  a.run('data.documents[0].version=3');
  assert.equal(a.run('osChain(data.actions[0]).complete'), false);
  assert.equal(a.run('data.trainingRecords.length'),1);
});
test("7.4 · clôture protégée par la transmission, expiration et site contrôlés", t => {
  const a = fresh(t); chain(a);
  a.run('actionForm(data.actions[0])'); a.fill('#actionStatus','Clôturée'); a.fill('#actionEvidence','Trois lots conformes'); a.fill('#actionVerifier','Camille'); a.submit('#actionForm');
  assert.equal(a.run('data.actions[0].status'),'En cours');
  assert.match(a.q('#toast').textContent,/compétences/);
  a.run('closeModal();state.role="director";state.site="profiline"');
  assert.throws(() => a.run('osSaveChain("A-74",{})'),/périmètre/);
});
test("7.4 · VSM actualisée atomiquement, avant figé et futur préservés", t => {
  const a = fresh(t); vsm(a);
  a.run('osVsmFreeze("VSM-74");osImportVsmObservations("VSM-74",[{node_id:"N-74",period:today(),source:"Chronométrage",ct:"90",va:"70",wip:"5"}]);save()');
  assert.equal(a.run('data.documents[0].vsm.current.nodes[0].ct'),90);
  assert.equal(a.run('data.documents[0].vsm.baseline.nodes[0].ct'),100);
  assert.equal(a.run('data.documents[0].vsm.future.nodes[0].ct'),60);
  assert.throws(() => a.run('osVsmFreeze("VSM-74")'),/déjà figé/);
  const b = app(t,a.stored()); assert.equal(b.run('data.documents[0].vsm.observations.length'),1);
  b.run('osVsmComparison("VSM-74")'); assert.match(b.q('#modalContent').textContent,/Écart actuel/);
});
test("7.4 · VSM refuse doublons, objets inconnus, dates invalides et valeurs impossibles", t => {
  const a = fresh(t); vsm(a); const initial = a.run('JSON.stringify(data.documents[0].vsm)');
  for(const rows of [
    '[{node_id:"inconnu",period:today(),source:"Test",ct:10}]',
    '[{node_id:"N-74",period:today(),source:"Test",ct:10}]',
    '[{node_id:"N-74",period:"2026-02-31",source:"Test",ct:100}]',
    '[{node_id:"N-74",period:today(),source:"Test",ct:100},{node_id:"N-74",period:today(),source:"Test",ct:100}]'
  ]) assert.throws(()=>a.run(`osImportVsmObservations("VSM-74",${rows})`));
  assert.equal(a.run('JSON.stringify(data.documents[0].vsm)'),initial);
});
test("7.4 · VSM import via sélecteur de fichier : aperçu avant confirmation", async t => {
  const a = fresh(t); vsm(a); a.run('osVsmComparison("VSM-74")');
  const input = a.q('#osVsmObservationFile'); Object.defineProperty(input,'files',{value:[{size:100,text:async()=>`node_id,period,source,ct,va\nN-74,${a.run('today()')},Atelier,90,70`} ]});
  input.dispatchEvent(new a.w.Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,0));
  assert.ok(a.q('#osVsmObservationConfirm')); assert.equal(a.run('data.documents[0].vsm.current.nodes[0].ct'),100);
  a.click('#osVsmObservationConfirm'); assert.equal(a.run('data.documents[0].vsm.current.nodes[0].ct'),90);
});
test("7.4 · environnement : inconnue ≠ zéro, unités et preuves dans les KPI", t => {
  const a = fresh(t); environment(a);
  assert.equal(a.run('osEnvironmentRatios(data.environmentLogs[0]).energy_good'),5);
  assert.equal(a.run('osEnvironmentRatios(data.environmentLogs[0]).waste_good'),0);
  assert.equal(a.run('osEnvironmentRatios(data.environmentLogs[0]).carbon_good'),null);
  assert.equal(a.run('commitData(()=>osPublishEnvironment("ENV-74"))'),true);
  assert.equal(a.run('data.measures.length'),2);
  assert.equal(a.run('data.measures[0].source_id'),'ENV-74');
  assert.equal(a.run('commitData(()=>osPublishEnvironment("ENV-74"))'),true);
  assert.equal(a.run('data.measures.length'),2);
  assert.equal(a.run('commitData(()=>{data.environmentLogs[0].energy_kwh=600;osPublishEnvironment("ENV-74")})'),true);
  assert.equal(a.run('data.measures[0].value'),6);
  assert.equal(a.run('commitData(()=>{data.environmentLogs[0].energy_kwh=null;osPublishEnvironment("ENV-74")})'),true);
  assert.equal(a.run('data.measures[0].value'),null);
});
test("7.4 · environnement : pas d’écrasement des sources, preuve CO2 et dénominateur", t => {
  const a = fresh(t); environment(a);
  assert.throws(()=>a.run('osCheckEnvironment({...data.environmentLogs[0],good_units:0})'),/strictement positif/);
  assert.throws(()=>a.run('osCheckEnvironment({...data.environmentLogs[0],co2_kg:5})'),/CO₂/);
  a.run('data.measures.push({id:"MES-74",site_id:"marzin",kpi_id:"KPI-ENV-0",period:today(),value:7})');
  const before = a.run('JSON.stringify(data.measures)');
  assert.equal(a.run('commitData(()=>osPublishEnvironment("ENV-74"))'),false);
  assert.equal(a.run('JSON.stringify(data.measures)'),before);
});
test("7.4 · carte multisite, données manquantes et filtrage conservés", t => {
  const a = fresh(t); a.run('state.site="group";state.view="pilotage";state.osTab="tower";render()');
  assert.equal(a.all('.os-site-summary').length,6);
  assert.match(a.q('.os-multisite-map').textContent,/BIA Holding/);
  assert.match(a.q('.os-site-summary').textContent,/Aucune mesure/);
  a.fill('#osMapKpi','KPI-scrap'); assert.equal(a.run('state.mapKpi'),'KPI-scrap');
  a.run('state.site="marzin";render()'); assert.equal(a.all('.os-site-summary').length,1);
});
test("7.4 · réplication en dossiers candidats sans doublon ni fausse validation", t => {
  const a = fresh(t); a.run('data.practices.push({id:"BP-74",site_id:"marzin",title:"Gabarit",status:"Publiée",evidence:"Essais conformes",transfer:"Vérifier les références"})');
  assert.equal(a.run('commitData(()=>osReplicatePractice("BP-74",["profiline","sodeplax"],"Lean",today()))'),true);
  assert.equal(a.run('data.deployments.length'),2);
  assert.equal(a.run('data.deployments.every(d=>d.status==="Candidate"&&!d.validated_by)'),true);
  a.run('osReplicatePractice("BP-74",["profiline"],"Lean",today())'); assert.equal(a.run('data.deployments.length'),2);
  assert.throws(()=>a.run('osReplicatePractice("BP-74",["marzin"],"Lean",today())'),/invalide/);
});
test("7.4 · escalades automatiques optionnelles, un niveau à la fois, aucun doublon", t => {
  const a = fresh(t); a.run('data.actions[0].due_date=osDateOffset(-10);data.settings.autoEscalation=true');
  assert.equal(a.run('osCheckAutoEscalations()'),true); assert.equal(a.run('data.escalations[0].level'),2);
  assert.equal(a.run('osCheckAutoEscalations()'),false); assert.equal(a.run('data.escalations.length'),1);
  a.run('data.escalations[0].created_at=osDateOffset(-3);osCheckAutoEscalations()'); assert.equal(a.run('data.escalations[0].level'),3);
  a.run('data.escalations[0].created_at=osDateOffset(-3);osCheckAutoEscalations()'); assert.equal(a.run('data.escalations[0].level'),4);
  a.run('data.escalations[0].created_at=osDateOffset(-3)'); assert.equal(a.run('osCheckAutoEscalations()'),false);
});
test("7.4 · escalade des signaux sans action, pas de traitement hors périmètre", t => {
  const a = fresh(t); a.run('data.signals.push({id:"S-74",site_id:"marzin",description:"Défaut sans pilote",state:"Nouveau",response_due:osDateOffset(-7),severity:"Haute"});data.settings.autoEscalation=true;state.role="operator"');
  assert.equal(a.run('osCheckAutoEscalations()'),false);
  a.run('state.role="director";state.site="profiline"'); assert.equal(a.run('osCheckAutoEscalations()'),false);
  a.run('state.site="marzin";osCheckAutoEscalations()'); assert.equal(a.run('data.escalations.some(e=>e.source_id==="S-74")'),true);
});
test("7.4 · assistant : pas d’envoi spontané, consentement, texte inerte et erreur", async t => {
  const a = fresh(t); let calls=0, sent;
  a.w.fetch=async (url,opts)=>{calls++;sent=JSON.parse(opts.body);return {ok:true,json:async()=>({answer:'<script>attaque()</script> Hypothèse à tester.'})}};
  a.run('data.settings.assistantEndpoint="https://approved.example/analysis";osAssistantForm("A-74")');
  assert.equal(calls,0); a.click('#osAssistantSend'); assert.equal(calls,0);
  a.q('#osAssistantConsent').checked=true; a.click('#osAssistantSend'); await new Promise(r=>setTimeout(r,0));
  assert.equal(calls,1); assert.equal(sent.schema,'bia-lean-assistant/v1'); assert.equal(sent.people,undefined);
  assert.match(a.q('#osAssistantResult').textContent,/<script>/); assert.equal(a.q('#osAssistantResult script'),null);
  assert.equal(a.run('data.actions.length'),1);
  assert.throws(()=>a.run('osAssistantEndpoint("https://server.example/path?key=secret")'),/sans identifiant/);
  assert.throws(()=>a.run('osAssistantEndpoint("http://server.example/path")'),/HTTPS/);
  a.w.fetch=async()=>{throw Error('Network error')};a.click('#osAssistantSend');await new Promise(r=>setTimeout(r,0));
  assert.match(a.q('#osAssistantResult').textContent,/Aucune modification/);
});
test("7.4 · import corrompu refusé et données restaurées en cas de quota", t => {
  const a = fresh(t); plan(a);
  assert.throws(()=>a.run('const broken=clone(data);broken.actions[0].sustainment.checks=[{days:1}];osValidate(broken)'),/Contrôle/);
  const before=a.run('JSON.stringify(data)');
  a.run('Storage.prototype.setItem=function(){throw Error("quota")};');
  assert.equal(a.run('commitData(()=>osSaveReview("A-74",{days:30,date:today(),value:2,outcome:"Efficace",evidence:"Test",verified_by:"X"}))'),false);
  assert.equal(a.run('JSON.stringify(data)'),before);
});
