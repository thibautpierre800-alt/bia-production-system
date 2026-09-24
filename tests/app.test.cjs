const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const scripts=['lean-library.js','v5.js','experience.js','workflows.js','fieldwork.js','documents-ui.js','dashboards.js','boot.js'];
function app(t,stored){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const html=fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
  const dom=new JSDOM(html,{url:'https://bia.example/bia-production-system/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;w.scrollTo=()=>{};w.print=()=>w.printed=true;w.HTMLElement.prototype.scrollIntoView=()=>{};
  if(stored)w.localStorage.setItem('biaProductionSystemV5',stored);
  for(const file of scripts){const s=w.document.createElement('script');s.textContent=fs.readFileSync(file,'utf8');w.document.head.append(s);}
  const run=s=>w.eval(s),q=s=>w.document.querySelector(s),all=s=>[...w.document.querySelectorAll(s)];
  const fill=(s,v)=>{assert.ok(q(s),`Champ ${s}`);q(s).value=v;q(s).dispatchEvent(new w.Event('input',{bubbles:true}));q(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
  const click=s=>{assert.ok(q(s),`Bouton ${s}`);q(s).click();};
  const submit=s=>{assert.ok(q(s),`Formulaire ${s}`);q(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
  t.after(()=>{w.close();assert.deepEqual(errors.map(e=>e.message),[],'Erreurs JavaScript DOM');});
  assert.ok(q('#appView').textContent.length>100,'L’application démarre');
  return {w,run,q,all,fill,click,submit,stored:()=>w.localStorage.getItem('biaProductionSystemV5')};
}
test('Référentiel, écrans, profils, outils existants et cache cohérent',t=>{
  const a=app(t),{run,q}=a;
  assert.equal(run('OPERATIONAL_SITES.map(s=>s.name).join("|")'),'Ag Déco|Europlacage|Marzin|Oraison Menuiserie|Profiline|Sodeplax');
  assert.equal(run('Object.values(AUDIT_CRITERIA).flat().length'),50);
  assert.equal(run('LEAN_MODULES.length'),30);assert.equal(run('data.trainingCatalog.length'),17);
  for(const role of ['lean','dg','director','terrain']){
    run(`state.role='${role}';state.site='${role==='dg'?'group':'marzin'}';closeModal()`);
    for(const id of Array.from(run('visibleNav().map(n=>n.id)'))){run(`state.view='${id}';render()`);assert.ok(q('#appView').textContent.length>80,`${role} / ${id}`);}
  }
  run('state.role="director";state.site="marzin";render();actionForm()');
  assert.equal(q('#actionSite').options.length,1);assert.equal(q('#actionSite').value,'marzin');
  run('closeModal();newSignalForm()');assert.equal(q('#signalSite').options.length,1);
  run('closeModal();gembaForm()');assert.equal(q('#gembaSite').options.length,1);
  for(const file of scripts.concat(['index.html','service-worker.js'])){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/\bSite [1-9]\b|PLAN DES 100 PREMIERS JOURS/);}
  const sw=fs.readFileSync('service-worker.js','utf8');for(const file of scripts)assert.ok(sw.includes(file));assert.match(sw,/v6-6-0/);
  const releaseTags=[...fs.readFileSync('index.html','utf8').matchAll(/(?:src|href)="[^"]+\?v=([0-9.]+)"/g)].map(x=>x[1]);assert.ok(releaseTags.length>=10);assert.ok(releaseTags.every(x=>x==='6.6.0'),'Toutes les ressources doivent porter la même version');
  assert.equal(run('TEMPLATES.every(t=>DOCUMENT_SCHEMAS[t.type])'),true);
  assert.equal(run('documentProgress("A3",documentValues(data.documents[0])).done'),run('documentProgress("A3",initialDocumentData("A3",data.problems.find(p=>p.id===data.documents[0].problem_id))).done'));
});
test('Signal → prise en compte → action vérifiée → résolution → clôture et reprise',t=>{
  const a=app(t),{run,fill,submit,q,click}=a;
  click('[data-new-signal]');fill('#signalDescription','Guide de scie desserré');submit('#signalForm');
  const id=run('data.signals[0].id');assert.equal(run('data.signals[0].state'),'Nouveau');
  run(`advanceSignal('${id}')`);fill('#transitionOwner','Responsable terrain');submit('#signalTransition');
  assert.equal(run('data.signals[0].state'),'Pris en compte');
  click('[data-signal-action]');fill('#actionTitle','Remplacer le guide');fill('#actionOwner','Maintenance');submit('#actionForm');
  const action=run('data.signals[0].action_id');assert.ok(action);assert.equal(run('data.signals[0].state'),'Action en cours');
  run(`advanceSignal('${id}')`);submit('#signalTransition');assert.equal(run('data.signals[0].state'),'Action en cours');
  fill('#transitionEvidence','Guide remplacé et réglé');submit('#signalTransition');
  run(`advanceSignal('${id}')`);fill('#transitionEvidence','Trois séries contrôlées conformes');fill('#transitionVerifier','Chef qualité');submit('#signalTransition');
  run(`advanceSignal('${id}')`);assert.equal(run('data.signals[0].state'),'Vérifié');assert.match(q('#toast').textContent,/action liée/);
  run(`actionForm(data.actions.find(a=>a.id==='${action}'))`);fill('#actionStatus','Clôturée');submit('#actionForm');assert.notEqual(run(`data.actions.find(a=>a.id==='${action}').status`),'Clôturée');
  fill('#actionEvidence','Trois séries sans dérive');fill('#actionVerifier','Chef qualité');submit('#actionForm');
  run(`advanceSignal('${id}')`);submit('#signalTransition');assert.equal(run('data.signals[0].state'),'Clos');
  const b=app(t,a.stored());assert.equal(b.run(`data.signals.find(x=>x.id==='${id}').state`),'Clos');assert.ok(b.run('data.signals[0].closed_at'));
});
test('A3, 8D et QRQC : étapes réelles, sauvegarde, action liée, validation protégée',t=>{
  const a=app(t),{run,fill,submit,click,q}=a;
  for(const type of ['A3','8D','QRQC']){
    run(`closeModal();genericProblemForm({method:'${type}'})`);fill('#problemTitle',`Analyse ${type}`);fill('#problemOwner','Pilote');submit('#problemForm');
    const id=run('data.documents[0].id'),pid=run('data.problems[0].id'),fields=Array.from(run(`DOCUMENT_SCHEMAS['${type}'].fields.map(f=>f[0])`));run(`editDocument('${id}',0)`);
    for(let i=0;i<fields.length;i++){
      assert.equal(q('[data-doc-field]').dataset.docField,fields[i]);fill('[data-doc-field]',`Faits et preuve ${type} rubrique ${i}`);
      if(i<fields.length-1)click(`.wizard-actions [data-doc-go='${i+1}']`);
    }
    fill('#editDocumentStatus','Validé');fill('#documentProblemStatus','Clos');submit('#editDocumentForm');
    assert.equal(run(`data.problems.find(x=>x.id==='${pid}').status`),'Clos');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'Validé');
    run(`editDocument('${id}')`);run('requestCloseModal()');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'Validé','Consulter ne dévalide pas');
    run(`editDocument('${id}',1)`);fill('[data-doc-field]','Nouvelle mesure');run('requestCloseModal()');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'En révision');
    const b=app(t,a.stored());b.run(`editDocument('${id}')`);assert.equal(b.q('[data-doc-field]').value,'Nouvelle mesure');
  }
  run('closeModal();genericProblemForm({method:"A3"})');fill('#problemTitle','Action liée');fill('#problemOwner','Pilote');submit('#problemForm');const pid=run('data.problems[0].id');
  const i=run('DOCUMENT_SCHEMAS.A3.fields.findIndex(f=>f[0]==="action_plan")');run(`editDocument(data.documents[0].id,${i})`);fill('[data-doc-field]','Essai à réaliser');click('#modalContent [data-new-action]');
  fill('#actionTitle','Tester le contre-guide');fill('#actionOwner','Équipe');submit('#actionForm');assert.equal(run('data.actions[0].origin_id'),pid);assert.ok(run('data.problems[0].action_ids.includes(data.actions[0].id)'));
});
test('Audit 50 critères : brouillon incomplet, reprise, preuves et actions sans doublon',t=>{
  const a=app(t),{run,fill,submit,click,q,all}=a;run('auditForm()');fill('#auditScope','Découpe');fill('#auditOwner','Chef atelier');fill('#auditAuditor','Auditeur');
  fill('[data-audit-score]','0');fill('[data-audit-proof]','Absence observée');click('#saveAuditDraft');const id=run('data.audits[0].id');
  assert.equal(run('data.audits[0].score'),null);assert.equal(run('data.audits[0].audit_data.criteria[1].score'),null);
  const b=app(t,a.stored());b.run(`auditForm(data.audits.find(x=>x.id==='${id}'))`);assert.equal(b.q('[data-audit-score]').value,'0');assert.equal(b.q('[data-audit-proof]').value,'Absence observée');
  run(`auditForm(data.audits.find(x=>x.id==='${id}'),9)`);submit('#auditForm');assert.equal(run('data.audits[0].status'),'Brouillon');
  for(let i=0;i<10;i++){run(`auditForm(data.audits.find(x=>x.id==='${id}'),${i})`);all('[data-audit-score]').forEach((n,j)=>fill(`[data-audit-score][data-criterion="${n.dataset.criterion}"]`,i===0?'2':'4'));all('[data-audit-proof]').forEach(n=>{n.value='Constat et preuve terrain';});if(i<9)click(`[data-audit-domain='${i+1}']`);else submit('#auditForm');}
  assert.equal(run('data.audits[0].status'),'Terminé');assert.equal(run('data.audits[0].score'),76);assert.equal(run(`data.actions.filter(a=>a.origin_id==='${id}').length`),1);
  run(`auditForm(data.audits.find(x=>x.id==='${id}'))`);assert.equal(q('#auditForm'),null);assert.equal(run(`data.actions.filter(a=>a.origin_id==='${id}').length`),1);
});
test('Audit historique identifié et ouverture sans brouillon vide',t=>{
  const {run,q}=app(t),before=run('data.audits.length');run('state.view="audits";render()');assert.match(q('#appView').textContent,/Ancien format · détail indisponible/);assert.match(q('#appView').textContent,/Audits 50 critères terminés/);
  run('auditForm();requestCloseModal()');assert.equal(run('data.audits.length'),before);
});
test('Gemba : plusieurs constats, action traçable, retour terrain et clôture',t=>{
  const a=app(t),{run,fill,submit,click,q}=a;run('gembaForm()');fill('#gembaZone','Poste de coupe');fill('#gembaObjective','Comprendre les déplacements');fill('#gembaAuthor','Animateur');submit('#gembaForm');const id=run('data.gembas[0].id');
  click('[data-gemba-observe]');fill('#observationFact','Outil éloigné du poste');fill('#observationDecision','Action');fill('#observationAction','Installer un support');fill('#observationOwner','Maintenance');fill('#observationDue',run('today()'));submit('#observationForm');
  assert.equal(run('data.gembas[0].observations.length'),1);const action=run('data.gembas[0].observations[0].action_id');assert.ok(action);assert.equal(run(`data.actions.find(a=>a.id==='${action}').origin_id`),id);
  run(`gembaObservationForm('${id}',data.gembas[0].observations[0].id)`);submit('#observationForm');assert.equal(run(`data.actions.filter(a=>a.origin_id==='${id}').length`),1);
  run(`finishGemba('${id}')`);assert.ok(run('data.gembas[0].visited_at'));
  run(`verifyGemba('${id}')`);fill('#gembaResult','Efficace');fill('#gembaVerifier','Chef équipe');fill('#gembaEvidence','Support vérifié au poste');submit('#gembaVerify');assert.notEqual(run('data.gembas[0].status'),'Clos');
  run(`actionForm(data.actions.find(a=>a.id==='${action}'))`);fill('#actionStatus','Clôturée');fill('#actionEvidence','Support en service depuis une semaine');fill('#actionVerifier','Chef équipe');submit('#actionForm');
  run(`verifyGemba('${id}')`);fill('#gembaResult','Efficace');fill('#gembaVerifier','Chef équipe');fill('#gembaEvidence','Observation du poste : outil accessible');submit('#gembaVerify');assert.equal(run('data.gembas[0].status'),'Clos');
  assert.ok(q('[data-open-record]'));
});
test('VSM : calculs incomplets, ordre conservé, retrait réversible, état futur distinct',t=>{
  const a=app(t),{run,fill,submit,click,q}=a;run('simpleDocument("VSM")');fill('#documentTitle','Flux panneaux');fill('#documentOwner','VSL');submit('#documentForm');const id=run('data.documents[0].id');
  assert.match(q('#vsmPreview').textContent,/—/);fill('[data-vsm-meta="demand_per_day"]','200');fill('[data-vsm-meta="available_minutes"]','400');
  click('#addVsmNode');fill('[data-vsm-node="0"][data-key="name"]','Découpe');fill('[data-vsm-node="0"][data-key="ct"]','40');click('#addVsmNode');fill('[data-vsm-node="1"][data-key="name"]','Assemblage');fill('[data-vsm-node="1"][data-key="ct"]','60');
  click('[data-vsm-up="1"]');assert.equal(q('[data-vsm-node="0"][data-key="name"]').value,'Assemblage');assert.equal(q('[data-vsm-node="1"][data-key="name"]').value,'Découpe');
  click('[data-vsm-remove="0"]');click('#undoVsmRemove');assert.equal(q('[data-vsm-node="0"][data-key="ct"]').value,'60');
  click('[data-vsm-mode="future"]');click('#copyVsmCurrent');fill('[data-vsm-node="0"][data-key="ct"]','50');submit('#vsmForm');
  assert.equal(run('vsmTotals(data.documents[0].vsm.current).takt'),120);assert.equal(run('vsmTotals(data.documents[0].vsm.current).ct'),100);assert.equal(run('vsmTotals(data.documents[0].vsm.current).wait'),null);
  assert.equal(run('data.documents[0].vsm.future.nodes[0].ct'),50);const b=app(t,a.stored());assert.equal(b.run('data.documents[0].vsm.current.nodes[0].ct'),60);
});
test('Avant / après : deux photos, descriptif court, impression de la dernière saisie',t=>{
  const a=app(t),{run,fill,click,q}=a;
  run('data.documents.unshift({id:"DOC-TEST",type:"BEFORE_AFTER",site_id:"marzin",title:"Rangement",status:"Brouillon",structured_data:{before_photo:"data:image/jpeg;base64,YQ==",after_photo:"data:image/jpeg;base64,Yg==",description:"Ancien descriptif"}});editDocument("DOC-TEST")');
  assert.equal(a.all('input[type=file]').length,2);fill('#baDescription','Outils à portée de main');click('#printBeforeAfter');assert.equal(a.w.printed,true);assert.match(q('#beforeAfterPrint').textContent,/Outils à portée de main/);assert.equal(a.all('#beforeAfterPrint img').length,2);
  assert.equal(run('safePhoto("javascript:alert(1)")'),'');assert.equal(run('safePhoto("data:image/svg+xml;base64,YQ==")'),'');
});
test('Sauvegarde : abandon protégé, quota et conflits empêchent un faux succès',t=>{
  const a=app(t),{run,fill,click,q,submit}=a;run('newSignalForm()');fill('#signalDescription','Saisie en cours');assert.equal(run('requestCloseModal()'),false);assert.ok(q('#closeGuard'));click('[data-keep-editing]');assert.equal(q('#signalDescription').value,'Saisie en cours');
  const count=run('data.signals.length');run('Storage.prototype.setItem=function(){throw new Error("quota") }');submit('#signalForm');assert.equal(run('data.signals.length'),count);assert.equal(q('#modal').hidden,false);assert.match(q('#toast').textContent,/Enregistrement impossible/);
  run('closeModal();storageConflict=true');assert.equal(run('save()'),false);assert.match(q('#toast').textContent,/autre onglet/);
});
test('TOP 15 : sujet issu du KPI, action et escalade accessibles sans masquer les suivants',t=>{
  const a=app(t),{run,fill,submit,click,q}=a;run('state.view="sqcdp";render()');click('[data-topic-axis]');fill('#topicOwner','Chef équipe');submit('#topicForm');const id=run('data.topics[0].id');
  run(`openRecord('${id}')`);assert.ok(q('#topicForm'));fill('#topicDecision','À traiter demain');submit('#topicForm');
  run(`topicForm(data.topics[0])`);click('[data-new-action]');fill('#actionTitle','Analyser la dérive');fill('#actionOwner','Responsable');submit('#actionForm');assert.equal(run('data.actions[0].origin_id'),id);
  run(`topicForm(data.topics[0])`);click('[data-escalate-topic]');fill('#decisionOwner','Directeur');submit('#decisionForm');assert.equal(run('data.decisions[0].origin_id'),id);assert.ok(run('data.topics[0].escalation_id'));
  run('closeModal();for(let i=0;i<16;i++)data.topics.push({id:"TOP-T"+i,site_id:"marzin",title:"Sujet "+i,status:"Ouvert",priority:"Normale"});render()');assert.ok(run('topSubjects().length')>=16);
});
test('Pilotage : sites, séries disponibles, absence signalée et lien avec les actions',t=>{
  const a=app(t),{run,q,click,fill}=a;run('state.site="group";state.view="pilotage";render()');
  assert.match(q('#appView').textContent,/Source|source/);assert.ok(q('#pilotSite'));
  fill('#pilotSite','sodeplax');assert.equal(run('state.pilotSite'),'sodeplax');assert.match(q('#appView').textContent,/Sodeplax/);assert.match(q('#appView').textContent,/indisponible|qualifier|connecter/);
  run('state.site="marzin";render()');assert.match(q('#appView').textContent,/TRS/);assert.match(q('#appView').textContent,/Rebut/);assert.match(q('#appView').textContent,/Service client/);
});
test('Benchmark Groupe : six sites, période identique, aucune valeur ni classement inventé',t=>{
  const {run,q,all,fill,click}=app(t);
  run('state.site="group";state.role="lean";state.view="pilotage";render()');
  assert.equal(all('.benchmark-table tbody tr').length,6);
  assert.deepEqual(all('.benchmark-table tbody th').map(x=>x.textContent),['Ag Déco','Europlacage','Marzin','Oraison Menuiserie','Profiline','Sodeplax']);
  assert.match(q('.benchmark-toolbar').textContent,/BIA Holding est le niveau Groupe/);
  assert.match(q('.benchmark-toolbar').textContent,/3\/30 valeurs renseignées/);
  assert.match(all('.benchmark-table tbody tr')[0].textContent,/Donnée indisponible/);
  assert.doesNotMatch(q('.benchmark-table').textContent,/classement|moyenne/);
  fill('#benchmarkPeriod','S39');
  assert.equal(run('benchmarkObservation("marzin","trs","S39").value'),78.6);
  assert.equal(run('benchmarkObservation("ag-deco","trs","S39")'),null);
  click('[data-benchmark-site="sodeplax"]');assert.equal(run('state.pilotSite'),'sodeplax');assert.equal(run('state.site'),'group');
  assert.equal(q('#pilotSite').value,'sodeplax');
});
test('Benchmark : saisie manuelle par site, courbe datée et sauvegarde après rechargement',t=>{
  const a=app(t),{run,q,click,fill,submit}=a;
  run('state.site="group";state.role="lean";state.view="pilotage";render()');
  click('[data-new-benchmark]');fill('#benchmarkSite','ag-deco');fill('#benchmarkDate','2026-09-24');fill('#benchmarkValue','82.4');fill('#benchmarkTarget','85');fill('#benchmarkDefinition','TRS de la ligne témoin, arrêts inclus');submit('#benchmarkForm');
  assert.equal(run('benchmarkObservation("ag-deco","trs","2026-09-24").value'),82.4);
  assert.equal(run('indicatorSeries("ag-deco","trs").labels.at(-1)'),'2026-09-24');
  assert.equal(q('#benchmarkPeriod').value,'2026-09-24');
  assert.match(q('.benchmark-table').textContent,/82.4%/);
  assert.match(q('.benchmark-table').textContent,/Saisie manuelle/);
  assert.match(q('.benchmark-toolbar').textContent,/1\/30 valeurs renseignées/);
  const stored=a.stored(),b=app(t,stored);b.run('state.site="group";state.view="pilotage";render()');
  assert.equal(b.run('benchmarkObservation("ag-deco","trs","2026-09-24").value'),82.4);
  b.fill('#benchmarkPeriod','2026-09-22');
  assert.match(b.q('.benchmark-table tbody tr:nth-child(1)').textContent,/Donnée indisponible/);
  b.run('state.role="dg";render()');assert.equal(b.q('[data-new-benchmark]'),null);
  b.run('state.role="director";state.site="ag-deco";render()');b.click('[data-new-benchmark]');
  assert.equal(b.q('#benchmarkSite').options.length,1);
  assert.equal(b.q('#benchmarkSite').value,'ag-deco');
});
test('Formation, roadmap, bibliothèque et bonnes pratiques restent opérationnelles',t=>{
  const a=app(t),{run,q,fill,submit,click}=a;
  run('state.view="training";render();openTraining("FOR-016")');assert.match(q('#modalContent').textContent,/VSL/);run('closeModal();openTrainingPerson("PER-001")');assert.match(q('#modalContent').textContent,/Validation RH/);
  run('closeModal();state.view="roadmap";render()');assert.match(q('#appView').textContent,/Roadmap/);
  run('state.view="tools";startTool("smed")');assert.match(q('#appView').textContent,/À faire maintenant/);assert.equal(run('data.toolRuns.some(r=>r.module_id==="smed")'),true);
  run('practiceForm()');fill('#practiceTitle','Support de gabarits');fill('#practiceSummary','Rangement visuel au poste');fill('#practiceEvidence','Temps de recherche mesuré');fill('#practiceStatus','Publiée');submit('#practiceForm');assert.ok(q('#practiceForm'));
  fill('#practiceTransfer','Vérifier la place et la charge');fill('#practiceValidator','Lean Groupe');submit('#practiceForm');const id=run('data.practices[0].id');run(`openRecord('${id}')`);assert.equal(q('#practiceTitle').value,'Support de gabarits');
});
test('Import : structure, référentiel et doublons contrôlés avant restauration',t=>{
  const {run}=app(t);assert.throws(()=>run('validateImport({meta:{schema:5}})'));
  assert.throws(()=>run('const invalid=clone(data);invalid.actions[0].site_id="inconnu";validateImport(invalid)'));
  assert.throws(()=>run('const duplicate=clone(data);duplicate.actions.push(duplicate.actions[0]);validateImport(duplicate)'));
  assert.equal(run('validateImport(clone(data)).meta.schema'),6);
});
test('Boutons des écrans et des 30 guides : aucune commande sans gestionnaire',t=>{
  const {run,all}=app(t),missing=[];
  function inspect(context){for(const b of all('#appView button'))if(!b.disabled&&!b.onclick&&!(b.type==='submit'&&b.form?.onsubmit))missing.push(`${context}: ${b.textContent.trim()}`);}
  for(const role of ['lean','dg','director','terrain']){run(`state.role='${role}';state.site='marzin';closeModal()`);for(const id of Array.from(run('visibleNav().map(n=>n.id)'))){run(`state.view='${id}';render()`);inspect(`${role}/${id}`);}}
  run('state.role="lean";state.view="tools"');for(const id of Array.from(run('LEAN_MODULES.map(t=>t.id)'))){run(`state.toolId='${id}';render()`);inspect(id);}
  run('state.view="documents";state.documentTab="models";render()');inspect('Modèles');
  assert.deepEqual(missing,[]);
});
test('Recherche globale : démarches retrouvables et responsable modifiable',t=>{
  const {run,fill,submit,q}=app(t);run('startTool("smed");toolRunForm(data.toolRuns[0].id)');fill('#toolRunOwner','Pilote SMED');submit('#toolRunForm');
  assert.equal(run('data.toolRuns[0].owner'),'Pilote SMED');assert.ok(run('searchableRecords("SMED").some(r=>r.label==="Démarches")'));
  run('state.view="home";render();openRecord(data.toolRuns[0].id)');assert.match(q('#appView').textContent,/Pilote SMED/);
});
test('Sauvegarde illisible : avertissement durable et contenu original préservé',t=>{
  const a=app(t,'{"meta": cassé');assert.match(a.q('#appView').textContent,/sauvegarde locale n’est pas lisible/);assert.equal(a.run('save()'),false);assert.equal(a.stored(),'{"meta": cassé');assert.ok(a.q('[data-export-raw]'));
});
test('Formation : une qualification expirée ne devient pas une compétence valide',t=>{
  const {run,q}=app(t);run('data.trainingRecords[0].expires_at="2020-01-01";state.view="training";state.trainingTab="matrix";render()');assert.match(q('#appView').textContent,/Expiré/);
  run('openTrainingPerson("PER-001")');assert.match(q('#modalContent').textContent,/Expiré/);
});
test('Photos : format invalide refusé, dernière sélection prioritaire',async t=>{
  const a=app(t),{run,q,w}=a;
  await assert.rejects(run('imageDataUrl(new File(["texte"],"photo.svg",{type:"image/svg+xml"}))'));
  run('modal("Photo",\'<input id="testPhoto" type="file"><div id="testPreview"></div>\');window.photoResolvers=[];imageDataUrl=()=>new Promise(resolve=>photoResolvers.push(resolve));window.testPicker=photoPicker("testPhoto","testPreview","")');
  const input=q('#testPhoto');Object.defineProperty(input,'files',{value:[new w.File(['x'],'a.jpg',{type:'image/jpeg'})],configurable:true});input.dispatchEvent(new w.Event('change'));
  Object.defineProperty(input,'files',{value:[new w.File(['y'],'b.jpg',{type:'image/jpeg'})],configurable:true});input.dispatchEvent(new w.Event('change'));
  run('photoResolvers[1]("data:image/jpeg;base64,Yg==")');await new Promise(r=>setImmediate(r));run('photoResolvers[0]("data:image/jpeg;base64,YQ==")');await new Promise(r=>setImmediate(r));assert.equal(run('testPicker.value'),'data:image/jpeg;base64,Yg==');
});
