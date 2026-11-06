const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const scripts=['lean-library.js','v5.js','experience.js','workflows.js','fieldwork.js','documents-ui.js','dashboards.js','os-core.js','os-views.js','os-audits.js','os-vsm.js','os-app.js','os-improvements.js','actions-plan.js','ux-shell.js','journee.js','indicateurs.js','maturite.js','hoshin.js','boot.js'];
function app(t,stored,url='https://bia.example/bia-production-system/'){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const html=fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
  const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
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
  assert.equal(run('OPERATIONAL_SITES.map(s=>s.name).join("|")'),'Ag Déco|Europlacage|Le Moine|Marzin|Oraison Menuiserie|Profiline|Sodeplax');
  assert.equal(run('Object.values(AUDIT_CRITERIA).flat().length'),50);
  assert.equal(run('LEAN_MODULES.length'),30);assert.equal(run('data.trainingCatalog.length'),18);
  assert.deepEqual(Array.from(run('Object.keys(ROLES)')),['dg','lean','director','teamlead','operator']);
  assert.deepEqual(Array.from(run('Object.values(ROLES).map(r=>r.label)')),['DG','Responsable Lean','Directeur de site','Chef d’équipe','Opérateur']);
  assert.equal(run('normalizeRoleId("admin")'),'lean');assert.equal(run('normalizeRoleId("terrain")'),'teamlead');assert.equal(run('normalizeRoleId("reader")'),'dg');
  assert.equal(q('#roleSelect').options.length,5);
  for(const role of ['dg','lean','director','teamlead','operator']){
    run(`state.role='${role}';state.site='${role==='dg'?'group':'marzin'}';closeModal()`);
    for(const id of Array.from(run('visibleNav().map(n=>n.id)'))){run(`state.view='${id}';render()`);assert.ok(q('#appView').textContent.length>80,`${role} / ${id}`);}
  }
  run('state.role="director";state.site="marzin";render();actionForm()');
  assert.equal(q('#actionSite').options.length,1);assert.equal(q('#actionSite').value,'marzin');
  run('closeModal();newSignalForm()');assert.equal(q('#signalSite').options.length,1);
  run('closeModal();gembaForm()');assert.ok(q('#jnStartForm'));assert.equal(q('[data-jn-site]'),null,'Un seul site autorisé : aucun choix de site');
  for(const file of scripts.concat(['index.html','service-worker.js'])){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/\bSite [1-9]\b|PLAN DES 100 PREMIERS JOURS/);}
  const sw=fs.readFileSync('service-worker.js','utf8');for(const file of scripts)assert.ok(sw.includes(file));assert.match(sw,/v8-4-0/);
  const releaseTags=[...fs.readFileSync('index.html','utf8').matchAll(/(?:src|href)="[^"]+\?v=([0-9.]+)"/g)].map(x=>x[1]);assert.ok(releaseTags.length>=10);assert.ok(releaseTags.every(x=>x==='8.4.0'),'Toutes les ressources doivent porter la même version');
  assert.equal(run('TEMPLATES.every(t=>DOCUMENT_SCHEMAS[t.type])'),true);
  assert.equal(run('documentProgress("A3",documentValues(data.documents[0])).done'),run('documentProgress("A3",initialDocumentData("A3",data.problems.find(p=>p.id===data.documents[0].problem_id))).done'));
});
test('Interface essentielle, accueil par rôle et commande Créer réduisent le parcours sans retirer les droits',t=>{
  const a=app(t),{run,q,all,click,fill}=a;
  run('state.role="operator";state.site="marzin";state.interfaceMode=preferredInterfaceMode("operator");state.view="home";render()');
  assert.equal(run('interfaceMode()'),'essential');
  assert.equal(all('#mobileNav .nav-button').length,6);
  assert.match(q('#appView').textContent,/Un problème au poste/);
  assert.equal(run('visibleNav().some(item=>item.id==="training")'),false);
  click('[data-interface-mode-toggle]');assert.equal(run('interfaceMode()'),'complete');assert.equal(run('visibleNav().some(item=>item.id==="training")'),true);
  fill('#roleSelect','teamlead');assert.equal(run('interfaceMode()'),'essential');assert.equal(run('state.dailyLevel'),1);
  run('state.view="daily";render()');assert.equal(all('[data-os="level"]').length,2);assert.match(q('.page-head h1').textContent,/N1 · Équipe/);
  run('state.role="operator";state.view="home";render()');click('[data-create-menu]');click('.create-choice.idea');
  assert.ok(q('.form-advanced'));assert.equal(q('.form-advanced').open,false);assert.equal(q('#osForm [name="owner"]').value,'Opérateur');assert.ok(q('#osForm [name="problem"]'));
});
test('Accueil, raccourcis terrain et écran SQCDP Groupe vertical sont explicites',t=>{
  const a=app(t),{run,q,all,click}=a;
  run('state.role="lean";state.site="group";state.view="home";render()');
  assert.match(q('#appView').textContent,/Ma journée/);
  assert.ok(q('.jn-gemba')&&q('.jn-actions'));
  assert.match(q('.jn-watch').textContent,/Risque critique/);
  assert.equal(all('.quick-action-dock .quick-action').length,1);
  assert.deepEqual(all('.quick-action-dock .quick-action').map(x=>x.getAttribute('aria-label')),['Créer un dossier']);
  assert.equal(all('.quick-action-dock b,.quick-action-dock small').length,0);
  assert.match(fs.readFileSync('experience.css','utf8'),/\.quick-action\{[^}]*width:44px;height:44px/);
  click('.quick-action.create');assert.match(q('#modalContent').textContent,/Signal Terrain/);assert.match(q('#modalContent').textContent,/Idée Kaizen/);click('.create-choice.idea');assert.match(q('#modalContent').textContent,/Une idée courte suffit/);run('closeModal()');
  run('state.view="sqcdp";render()');click('[data-display-mode]');
  assert.equal(q('body').classList.contains('group-presentation'),true);
  assert.ok(q('.group-display-exit'));click('.group-display-exit');
  assert.equal(q('body').classList.contains('group-presentation'),false);
  run('state.view="pilotage";state.osTab="tower";render()');
  assert.equal(all('[data-pilotage-mode]').length,2);
  assert.match(q('[data-in-cell="marzin:scrap"]').getAttribute('aria-label'),/73,3 % défavorable/);
  run('state.role="dg";state.view="home";render()');assert.equal(q('.quick-action-dock'),null);
});
test('Alertes opérationnelles, relève, accès terrain et paquet de synchronisation restent reliés',t=>{
  const a=app(t),{run,q,fill,click,submit}=a;
  run('data=osFreshData(true);osInit();state.role="teamlead";state.site="marzin";state.workshop="marzin-pilot";state.view="daily";render()');
  assert.ok(Number(q('#notificationCount').textContent)>0);click('#notificationButton');
  assert.match(q('#modalContent').textContent,/Signal critique ouvert/);assert.match(q('#modalContent').textContent,/Relève d’équipe à reprendre/);
  click('[data-notification-read-all]');assert.equal(q('#notificationCount').hidden,true);run('closeModal();state.view="daily";render()');
  assert.ok(q('.handover-card'));assert.match(q('.handover-links').textContent,/Signal · S-041/);click('[data-new-handover]');
  assert.equal(q('#handoverSituation').required,false);assert.notEqual(q('#handoverFrom').value,q('#handoverTo').value);
  fill('#handoverStatus','Transmise');fill('#handoverSituation','Ligne disponible avec contrôle renforcé');fill('#handoverPriorities','1. Vérifier le premier lot. 2. Suivre la maintenance.');
  const linked=q('#handoverLinks input');if(linked)linked.checked=true;submit('#handoverForm');
  const id=run('data.handovers[0].id');assert.equal(run('data.handovers[0].status'),'Transmise');assert.ok(run(`data.syncQueue.some(item=>item.record_id==='${id}')`));
  click(`[data-ack-handover="${id}"]`);assert.equal(run('data.handovers[0].status'),'Reprise');assert.ok(run('data.handovers[0].acknowledged_by'));
  run('state.view="account";render()');assert.match(q('.terrain-access code').textContent,/entry=terrain/);assert.match(q('.terrain-access code').textContent,/workshop=marzin-pilot/);
  run('window.syncCapture=null;downloadJsonText=(raw,name)=>window.syncCapture={raw,name};exportSyncBundle()');
  assert.equal(JSON.parse(run('window.syncCapture.raw')).contract,'bia-lean-os-sync-bundle/v1');
  const b=app(t,a.stored(),'https://bia.example/bia-production-system/?entry=terrain&site=marzin&workshop=marzin-pilot#terrain');
  assert.equal(b.run('state.view'),'terrain');assert.equal(b.run('state.site'),'marzin');assert.equal(b.run('state.workshop'),'marzin-pilot');
});
test('Formation BIA Lean OS : livret, grille par profil et qualification enregistrée',t=>{
  const a=app(t),{run,q,fill,click,submit}=a;
  run('state.role="lean";state.site="group";state.view="training";state.trainingTab="application";render()');
  assert.ok(q('.app-skill-matrix'));assert.match(q('#appView').textContent,/BIA-APP-01/);
  click('[data-training-guide]');assert.match(q('#modalContent').textContent,/Limites actuelles/);assert.match(q('#modalContent').textContent,/Control Tower/);run('closeModal();render()');
  click('[data-new-training-record][data-training-id="FOR-018"]');
  assert.equal(q('#recordTraining').value,'FOR-018');assert.equal(q('#appSkillLevels').hidden,false);
  fill('#recordTrainer','Responsable Lean Groupe');fill('#recordLevel','3');fill('#recordStatus','En cours');fill('#recordEvidence','Signal créé et retrouvé après rechargement');fill('[data-app-skill="signal"]','4');submit('#trainingRecordForm');
  assert.equal(run('data.trainingRecords[0].training_id'),'FOR-018');assert.equal(run('data.trainingRecords[0].skill_levels.signal'),4);
  run('state.trainingTab="matrix";render()');assert.match(q('#appView').textContent,/APP-01/);
});
test('Maturité : campagnes comparables, une seule légende, nouvelle évaluation non destructive',t=>{
  const a=app(t),{run,q,all,fill,click,submit}=a;
  run('data=osFreshData(true);osInit();state.role="lean";state.site="group";state.view="maturity";state.maturitySet="lean";render()');
  assert.equal(all('#appView select').length,0,'Aucun menu déroulant');
  assert.equal(all('.mt-scale').length,1,'Échelle des niveaux affichée une seule fois');
  assert.equal(all('.mt-scale .mt-swatch').length,6,'Cinq niveaux et « non évalué »');
  assert.equal(all('.mt-criteria li').length,10,'Numéros des piliers expliqués une fois');
  assert.equal(all('.mt-radar').length,6,'Un radar par site évalué');assert.equal(all('.mt-radar-empty').length,1,'Le Moine : pas encore évalué');
  assert.equal(all('.mt-radar .mt-vertex').length,60,'Sommets numérotés sur chaque radar');
  assert.ok(all('.mt-radar .mt-band-1').length===6&&all('.mt-radar .mt-pt.mt-l1').length>0,'Zones et points colorés : rouge quand c’est faible');
  assert.equal(all('.mt-row:not(.mt-head)').length,7,'Sept sites comparés ligne à ligne');
  assert.equal(all('.mt-row:not(.mt-head) .mt-cell:not(.mt-avg)').length,70);
  assert.equal(all('.mt-campaigns li').length,3,'Trois campagnes datées');
  const dates=Array.from(run('osMaturityDates(OPERATIONAL_SITES.map(s=>s.id))'));
  assert.equal(q('[data-mt-compare]').disabled,false);click('[data-mt-compare]');
  assert.equal(run('state.maturityCompareDate'),dates[1]);assert.ok(all('.mt-arrow').length>0,'Évolutions visibles');assert.ok(all('.mt-shape-old').length>0);
  click('[data-mt-step="'+dates[2]+'"]');assert.equal(run('state.maturityDate'),dates[2]);assert.equal(q('[data-mt-compare]').disabled,true,'Pas de campagne plus ancienne');
  click('.in-step-btn[aria-label="Campagne suivante"]');assert.equal(run('state.maturityDate'),dates[1]);
  const before=run('data.maturity.length'),oldId=run('data.maturity.at(-1).id');
  click('.mt-matrix [data-mt-cell*="marzin"]');assert.equal(q('#osForm [name="pillar"]').value,'Sécurité');assert.equal(q('#osForm [name="pillar"]').options.length,10);
  fill('#osForm [name="level"]','4');fill('#osForm [name="owner"]','Auditrice interne');fill('#osForm [name="evidence"]','Observation terrain et standard daté');submit('#osForm');
  assert.equal(run('data.maturity.length'),before+1);assert.ok(run(`data.maturity.some(m=>m.id==='${oldId}')`));
});
test('Trajectoire BIA : d’artisan industriel à industriel artisan, la 4.0 et la 5.0 comme marches de maturité',t=>{
  const a=app(t),{run,q,all,fill,click,submit}=a;
  run('data=osFreshData(true);osInit();state.role="lean";state.site="group";state.view="maturity";state.maturitySet="lean";render()');
  assert.deepEqual(all('.mt-step-head b').map(b=>b.textContent.replace(/\s+/g,' ').trim()),['Artisan industriel','Industriel standardisé','Industriel maîtrisé','Industriel connecté 4.0','Industriel artisan 5.0']);
  assert.equal(all('.mt-stairs .mt-site').length+all('.mt-unplaced .mt-site').length,7,'Toutes les entités sur la trajectoire');
  assert.match(q('.mt-unplaced').textContent,/Le Moine/);
  const step=id=>run(`mtPosition("${id}",state.maturityDate).step`);
  assert.equal(step('marzin'),2);assert.equal(step('profiline'),3,'Sans évaluation connectée, pas de marche 4');assert.equal(step('le-moine'),0);
  assert.ok(q('.mt-step-2 [data-mt-site="marzin"]'));assert.ok(q('.mt-step-3 [data-mt-site="profiline"]'));
  assert.match(q('.mt-next').textContent,/Profiline[\s\S]*Connecté 4\.0 : à évaluer/);
  assert.match(q('.mt-rule').textContent,/Lean ≥ 3,5 et connecté ≥ 3/);
  click('[data-mt-lens="digital"]');
  assert.equal(all('.mt-criteria li').length,10);assert.equal(all('.mt-criteria .mt-tag').map(x=>x.textContent).join(''),'4.04.04.04.04.04.04.05.05.05.0');
  assert.ok(q('.mt-callout'),'Personne n’est encore évalué : on le dit');assert.equal(all('.mt-radar').length,0,'Pas de radars vides');
  click('.mt-matrix [data-mt-cell*="profiline"]');assert.equal(q('#osForm [name="pillar"]').value,'Données terrain');
  assert.deepEqual(Array.from(q('#osForm [name="pillar"]').options).map(o=>o.value).filter(Boolean),Array.from(run('data.settings.digitalPillars')));
  fill('#osForm [name="level"]','3');fill('#osForm [name="owner"]','Directeur Profiline');fill('#osForm [name="evidence"]','Relevés papier ressaisis le soir');submit('#osForm');
  assert.equal(run('mtLevel("profiline","Données terrain",today())?.level'),3);
  run(`const at=today();for(const p of mtGroups().c40)if(p!=="Données terrain")data.maturity.push({id:uid("MAT"),site_id:"profiline",pillar:p,level:3,target:4,date:at,owner:"Test",evidence:"Test"});state.maturityDate=at;render()`);
  assert.equal(step('profiline'),4,'Lean 4,1 et connecté 3 : marche 4');assert.ok(q('.mt-step-4 [data-mt-site="profiline"]'));
  run(`const at=today();for(const p of data.settings.digitalPillars)data.maturity.push({id:uid("MAT"),site_id:"profiline",pillar:p,level:4,target:4,date:at,owner:"Test",evidence:"Test"});render()`);
  assert.equal(step('profiline'),5,'Industriel artisan');
  click('.mt-stairs [data-mt-site="marzin"]');assert.match(q('#modalContent').textContent,/Marche 2/);assert.match(q('#modalContent').textContent,/Lean 2,2 → 3/);
  assert.ok(all('#modalContent [data-os="createFrom"]').length>0,'Plan d’amélioration depuis le prochain pas');
  run('closeModal()');assert.equal(all('.mt-prop').length,12,'Propositions classées par marche');
  assert.deepEqual(all('.mt-prop-step').map(h=>h.textContent.slice(0,1)),['3','4','5']);
  run('state.role="dg";render()');assert.equal(q('#appView [data-os="new"]'),null,'DG : lecture seule');
  run('state.maturitySet="lean";render()');click('.mt-matrix [data-mt-cell*="marzin"]');assert.equal(q('#osForm'),null);assert.ok(q('#modalContent .os-details'),'Lecture de l’évaluation existante');
});
test('Le Moine, septième entité : ajoutée sans perte de données et sans valeur inventée',t=>{
  const a=app(t);
  assert.ok(a.run('OPERATIONAL_SITES.some(s=>s.id==="le-moine"&&s.name==="Le Moine")'));
  assert.ok(a.run('data.workshops.some(w=>w.site_id==="le-moine")'));
  assert.equal(a.run('data.measures.filter(m=>m.site_id==="le-moine").length'),0,'Aucun relevé fictif');
  assert.equal(a.run('data.maturity.filter(m=>m.site_id==="le-moine").length'),0);
  const old=JSON.parse(a.stored()||a.run('JSON.stringify(data)'));old.sites=old.sites.filter(s=>s.id!=="le-moine");old.workshops=old.workshops.filter(w=>w.site_id!=="le-moine");old.meta.sitesAdded=[];old.actions.push({id:"A-KEEP",site_id:"marzin",title:"Action conservée",status:"Ouverte",owner:"Test",due_date:"2026-12-01"});
  const b=app(t,JSON.stringify(old));
  assert.ok(b.run('OPERATIONAL_SITES.some(s=>s.id==="le-moine")'),'Ajoutée aux données déjà enregistrées');
  assert.deepEqual(Array.from(b.run('data.sites.map(s=>s.id)')).slice(0,4),['group','ag-deco','europlacage','le-moine']);
  assert.ok(b.run('data.actions.some(x=>x.id==="A-KEEP")'),'Données existantes conservées');
  const archived=JSON.parse(b.run('JSON.stringify(data)'));archived.sites.find(s=>s.id==="le-moine").archived_at="2026-11-06";
  const c=app(t,JSON.stringify(archived));
  assert.equal(c.run('OPERATIONAL_SITES.some(s=>s.id==="le-moine")'),false,'Archivée : jamais réimposée');
  c.run('state.role="lean";state.site="le-moine";render()');
  const d=app(t);d.run('state.role="director";state.site="le-moine";state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";render()');
  assert.ok(d.all('.in-tile').length>0);assert.match(d.q('#appView').textContent,/Le Moine/);
});
// Classeur fictif, construit sur le modèle du fichier de déploiement (aucune donnée réelle).
const HK_SAMPLE={
  'matrice de prio':{A1:'AC',B1:'1 faible - 5 fort',C1:'1 - 3 pour la ponderation',C2:'Critère A',D2:'Critère B',E2:'Critère C',F2:'Critère D',G2:'TOTAL',A3:'le 01/09/2026',B3:'poids',C3:1,D3:3,E3:2,F3:2,B4:'MARZIN',C4:2,D4:4,E4:1,G4:16,B5:'AG DECO',C5:5,D5:1,E5:3,G5:14,B6:'LEMOINE',C6:1,D6:5,E6:4,G6:24,B7:'USINE INCONNUE',C7:3,D7:3,E7:3,B10:'TOP 2',C10:'LEMOINE',D10:'note fictive',C11:'MARZIN'},
  'phases et actions':{A1:'Phase',B1:'Durée',C1:'Actions clés',D1:'Livrable(s)',E1:'planning détaillé',A2:'0. Lancement',B2:'1 mois',C2:'Cadrer',D2:'Lettre',A3:'1. Essai',B3:'2 mois',C3:'Tester',D3:'Bilan',A5:'Gouvernance',A6:'Instance',B6:'Rythme',C6:'Composition',D6:'Rôle',A7:'Comité',B7:'Mensuel',C7:'Direction',D7:'Arbitrer',A9:'Jalon',B9:'Date',C9:'Critères pour passer',A10:'Go essai',B10:'Fin juin 2027',C10:'Essai prêt',A11:'Fin',B11:46752,C11:'Bilan fait',A12:'Indicateurs de suivi : TRS, rebuts',A14:'Risques',B14:'valeur',C14:'Parade',A15:'Manque de temps',C15:'Réunions courtes'},
  'Macros étapes':{B3:'Étape un',D3:'Étape deux',F3:'Étape trois',B7:'Description',D7:'DESCRIPTION',F7:'DESCRIPTION',B8:'Texte un',D8:'Texte deux',F8:'Texte trois'},
  'planning':{A1:'Date ',B1:46327,A2:'Projet',B2:'Programme fictif',A3:'Equipe',B3:'Équipe test',A4:'Objectif',B4:'Essai',A8:'N° Tâche',B8:'Tâches',C8:'Qui',D8:'Délai',E8:'% Réalisé',A9:1,B9:'Pilotage et Calendrier Macro',A10:1.1,B10:'Cadrage',C10:'LP',D10:'1 mois',A12:2,B12:'MARZIN',A13:2.1,B13:'Pré-diagnostic',E13:1,A14:2.2,B14:'Mise en place',E14:0.5,A15:2.3,A16:3,B16:'AG DECO',A20:'',B20:'Les aspects à aborder :',B21:'Flux physiques',B22:'Qualité produit',A24:'INDICATEURS',B26:'nombre de tâches'}
};
test('Hoshin Kanri : lecture du fichier de déploiement (matrice, phases, jalons, planning)',t=>{
  const a=app(t),{run}=a;
  const r=run(`(()=>{const x=hkFromWorkbook(${JSON.stringify(HK_SAMPLE)},"plan.xlsx");return JSON.stringify(x)})()`),{plan,report}=JSON.parse(r);
  assert.equal(plan.matrix.date,'2026-09-01');assert.deepEqual(plan.matrix.criteria.map(c=>c.weight),[1,3,2,2]);
  assert.deepEqual(Object.keys(plan.matrix.scores).sort(),['ag-deco','le-moine','marzin']);
  assert.equal(plan.matrix.scores['le-moine'].c4,null,'Critère vide : non noté');
  assert.deepEqual(plan.matrix.top.map(t=>t.site_id),['le-moine','marzin']);assert.equal(plan.matrix.top[0].note,'note fictive');
  assert.ok(report.warnings.some(w=>/USINE INCONNUE/.test(w)));assert.ok(report.warnings.some(w=>/Critère D/.test(w)));
  assert.deepEqual(plan.phases.map(p=>[p.name,p.months]),[['0. Lancement',1],['1. Essai',2]]);
  assert.deepEqual(plan.milestones.map(m=>[m.name,m.date]),[['Go essai','2027-06-30'],['Fin','2027-12-31']]);
  assert.equal(plan.governance[0].rhythm,'Mensuel');assert.equal(plan.risks[0].mitigation,'Réunions courtes');assert.equal(plan.indicators,'TRS, rebuts');
  assert.deepEqual(plan.macroSteps.map(m=>m.title),['Étape un','Étape deux','Étape trois']);assert.equal(plan.macroSteps[1].description,'Texte deux');
  assert.equal(plan.start,'2026-11-01');assert.equal(plan.title,'Programme fictif');
  assert.deepEqual(plan.tracks.marzin.map(s=>[s.name,s.status]),[['Pré-diagnostic','done'],['Mise en place','doing']]);
  assert.deepEqual(plan.tracks['ag-deco'],[]);assert.equal(plan.macroTasks.length,1);
  assert.deepEqual(plan.topics,['Flux physiques','Qualité produit']);
  assert.equal(run(`hkTotal(${JSON.stringify(plan.matrix)},"le-moine")`),24);
  assert.deepEqual(Array.from(run(`hkRanking(${JSON.stringify(plan.matrix)}).map(r=>r.id)`)),['le-moine','marzin','ag-deco']);
});
test('Hoshin Kanri : cap, priorités classées, plan, avancement par site et droits',t=>{
  const a=app(t),{run,q,all,click,fill,submit}=a;
  run('state.role="lean";state.site="group";state.view="hoshin";render()');
  assert.match(q('.hk-cap').textContent,/D’artisan industriel à industriel artisan/);assert.ok(q('.hk-empty'),'Sans fichier : on explique quoi importer');
  assert.ok(q('[data-hk-import]'));
  run(`const x=hkFromWorkbook(${JSON.stringify(HK_SAMPLE)},"plan.xlsx");x.plan.start=osDateOffset(-10);commitData(()=>{data.hoshinPlan=x.plan});render()`);
  assert.deepEqual(all('.hk-row:not(.hk-head) .hk-site').map(x=>x.textContent.replace(/TOP|\d/g,'').trim()),['Le Moine','Marzin','Ag Déco']);
  assert.equal(all('.hk-top').length,2);assert.deepEqual(all('.hk-total b').map(b=>b.textContent),['24','16','14']);
  assert.equal(all('#appView select').length,0,'Aucun menu déroulant');
  assert.match(q('.hk-cap').textContent,/Lancement/);assert.equal(all('.hk-phase.now').length,1);
  assert.equal(all('.hk-miles li').length,2);click('[data-hk-milestone="0"]');assert.equal(run('data.hoshinPlan.milestones[0].done'),true);
  click('[data-hk-step*="marzin"]');assert.equal(run('data.hoshinPlan.tracks.marzin[0].status'),'todo','Fait → à faire');
  click('[data-hk-seq*="marzin"]');assert.equal(run('data.hoshinPlan.sequoia.marzin'),1);
  click('[data-hk-edit-matrix]');fill('#hkMatrixForm [name="s-marzin-c1"]','5');submit('#hkMatrixForm');
  assert.equal(run('hkTotal(data.hoshinPlan.matrix,"marzin")'),19);
  click('[data-hk-waves]');q('#hkWavesForm input[name="wave-le-moine"][value="pilot"]').checked=true;submit('#hkWavesForm');assert.equal(run('data.hoshinPlan.waves["le-moine"]'),'pilot');
  assert.match(q('.hk-prio').textContent,/Pilote/);
  const kept=run(`JSON.stringify(hkMerge(hkFromWorkbook(${JSON.stringify(HK_SAMPLE)},"plan.xlsx").plan,data.hoshinPlan))`);
  const merged=JSON.parse(kept);assert.equal(merged.waves['le-moine'],'pilot');assert.equal(merged.milestones[0].done,true);assert.equal(merged.sequoia.marzin,1);
  run('state.role="director";state.site="marzin";render()');
  assert.equal(all('.hk-row:not(.hk-head)').length,1,'Directeur : sa ligne seulement');assert.equal(q('[data-hk-import]'),null);assert.equal(q('[data-hk-edit-matrix]'),null);
  assert.equal(all('.hk-site-row').length,1);click('[data-hk-step*="marzin"]');assert.equal(run('data.hoshinPlan.tracks.marzin[0].status'),'doing','Le directeur fait avancer son site');
  run('state.role="dg";state.site="group";render()');assert.equal(all('[data-hk-step]').length,0);assert.equal(all('[data-hk-milestone]').length,0);assert.equal(q('[data-hk-import]'),null);
  assert.equal(all('.hk-row:not(.hk-head)').length,3,'La DG voit tout le classement');
  const b=app(t,a.stored());b.run('state.role="lean";state.site="group";state.view="hoshin";render()');assert.equal(b.all('.hk-total b')[0].textContent,'24');assert.equal(b.run('data.hoshinPlan.waves["le-moine"]'),'pilot','Plan conservé après rechargement');
  assert.ok(b.q('.os-hoshin-tree'),'La déclinaison des objectifs reste en dessous');
});
test('Roadmap et objectifs : le même plan que le Hoshin, daté par le Gantt du fichier',t=>{
  const a=app(t),{run,q,all,click}=a;
  // Gantt fictif : semaines S51-S52 2026 puis S1-S3 2027, barres vertes, une barre rouge (retard).
  const book=JSON.parse(JSON.stringify(HK_SAMPLE));Object.assign(book.planning,{J6:2026,L6:2027,J8:'S51',K8:'S52',L8:'S1',M8:'S2',N8:'S3'});
  const colors={planning:{J13:'FF92D050',K13:'FF92D050',L14:'FF92D050',M14:'FFFF0000',N14:'FF92D050',J12:'theme8',K12:'theme8',J10:'FF92D050'}};
  const x=JSON.parse(run(`JSON.stringify(hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",${JSON.stringify(colors)}))`));
  assert.deepEqual(x.plan.tracks.marzin.map(s=>[s.from,s.to,!!s.late]),[['2026-12-14','2026-12-27',false],['2027-01-04','2027-01-24',true]]);
  assert.equal(x.plan.macroTasks[0].from,'2026-12-14');assert.ok(x.report.found.some(f=>/3 tâches datées/.test(f)));
  run(`const y=hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",${JSON.stringify(colors)});y.plan.waves={marzin:"pilot"};commitData(()=>{data.hoshinPlan=y.plan});state.role="lean";state.site="group";state.view="hoshin";render()`);
  const before=run('data.objectives.length');click('[data-hk-sync-objectives]');
  const made=run('JSON.stringify(data.objectives.filter(o=>o.plan_key).map(o=>[o.plan_key,o.level,o.due_date,(data.objectives.find(p=>p.id===o.parent_id)||{}).plan_key||null]))');
  assert.deepEqual(JSON.parse(made),[['cap','Axe stratégique','2027-12-31',null],['jalon:goessai','Groupe','2027-06-30','cap'],['jalon:fin','Groupe','2027-12-31','cap'],['site:marzin','Site','2027-01-24','jalon:goessai']]);
  assert.equal(run('data.objectives.length'),before+4);click('[data-hk-sync-objectives]');assert.equal(run('data.objectives.length'),before+4,'Pas de doublon');
  assert.match(q('.os-hoshin-tree').textContent,/D’artisan industriel à industriel artisan/);
  run('state.view="roadmap";state.rmWindow="all";render()');
  assert.match(q('#appView h1').textContent,/Roadmap de déploiement/);assert.match(q('.hk-cap').textContent,/Lancement/);
  assert.equal(all('.rm-phase').length,2,'Les phases du plan');assert.equal(all('.rm-step[data-hk-step*="marzin"]').length,2);assert.equal(all('.rm-step.late').length,1);
  assert.ok(q('.rm-diamond'),'Jalons dans le calendrier');assert.ok(all('.roadmap-item').length>0,'Les priorités de la roadmap restent');
  click('.rm-step[data-hk-step*="marzin"]');assert.equal(run('data.hoshinPlan.tracks.marzin[0].status'),'todo','Fait → à faire, partagé avec le Hoshin');
  run('state.view="hoshin";render()');assert.ok(q('[data-hk-step*="marzin"].hk-todo'));
  run('state.role="dg";state.view="roadmap";render()');assert.equal(all('.rm-step[data-hk-step]').length,0,'DG : lecture seule');assert.equal(q('[data-new-roadmap]'),null);
  const b=app(t);b.run('state.role="lean";state.site="group";state.view="roadmap";render()');assert.ok(b.q('.hk-empty'),'Sans plan : renvoi vers le Hoshin');
});
test('Mantra du Groupe : la signature d’origine est visible',t=>{
  const a=app(t),{run,q}=a;
  run('state.role="lean";state.site="group";state.view="home";render()');
  assert.equal(q('.jn-mantra').textContent,'D’artisan industriel à industriel artisan.');
  assert.equal(q('.brand-mantra').textContent,'D’artisan industriel à industriel artisan.');
  run('state.role="operator";state.site="marzin";render()');assert.equal(q('.jn-mantra').textContent,'D’artisan industriel à industriel artisan.');
});
test('Le scénario de démonstration est actualisé avec sauvegarde sans toucher un espace réel',t=>{
  const a=app(t),raw=a.run('JSON.stringify(DEMO)'),b=app(t,raw);
  assert.equal(b.run('data.meta.demo_revision'),4);assert.equal(b.run('data.measures.length'),300);assert.equal(b.run('data.handovers.length'),1);
  assert.deepEqual(Array.from(b.run('data.users.map(u=>u.role)')),['lean','dg','director','teamlead','operator']);
  assert.deepEqual(JSON.parse(b.run('JSON.stringify(osIntegrity())')),[]);
  assert.equal(b.run('localStorage.getItem(STORAGE_KEY+"-before-demo-refresh")'),raw);
  const empty=a.run('JSON.stringify(osFreshData(false))'),c=app(t,empty);
  assert.equal(c.run('data.meta.demo'),false);assert.equal(c.run('data.measures.length'),0);assert.equal(c.run('data.people.length'),0);
});
test('Signal → prise en compte → action vérifiée → résolution → clôture et reprise',t=>{
  const a=app(t),{run,fill,submit,q,click}=a;
  click('[data-create-menu]');click('[data-new-signal]');fill('#signalDescription','Guide de scie desserré');submit('#signalForm');
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
  const a=app(t),{run,fill,submit,click,q}=a;run('gembaForm()');fill('#jnZone','Poste de coupe');fill('#jnQuestion','Comprendre les déplacements');submit('#jnStartForm');const id=run('data.gembas[0].id');assert.equal(run('data.gembas[0].objective'),'Comprendre les déplacements');
  run(`gembaObservationForm('${id}')`);fill('#observationFact','Outil éloigné du poste');fill('#observationDecision','Action');fill('#observationAction','Installer un support');fill('#observationOwner','Maintenance');fill('#observationDue',run('today()'));submit('#observationForm');
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
  click('[data-os="vsmTable"]');assert.match(q('#vsmPreview').textContent,/—/);fill('[data-vsm-meta="demand_per_day"]','200');fill('[data-vsm-meta="available_minutes"]','400');
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
  const a=app(t),{run,fill,submit,click,q}=a;run('state.site="marzin";state.workshop="marzin-pilot";state.view="sqcdp";render()');click('[data-topic-axis]');fill('#topicOwner','Chef équipe');submit('#topicForm');const id=run('data.topics[0].id');
  run(`openRecord('${id}')`);assert.ok(q('#topicForm'));fill('#topicDecision','À traiter demain');submit('#topicForm');
  run(`topicForm(data.topics[0])`);click('[data-new-action]');fill('#actionTitle','Analyser la dérive');fill('#actionOwner','Responsable');submit('#actionForm');assert.equal(run('data.actions[0].origin_id'),id);
  run(`topicForm(data.topics[0])`);click('[data-escalate-topic]');fill('#decisionOwner','Directeur');submit('#decisionForm');assert.equal(run('data.decisions[0].origin_id'),id);assert.ok(run('data.topics[0].escalation_id'));
  run('closeModal();for(let i=0;i<16;i++)data.topics.push({id:"TOP-T"+i,site_id:"marzin",workshop_id:"marzin-pilot",title:"Sujet "+i,status:"Ouvert",priority:"Normale"});render()');assert.ok(run('topSubjects().length')>=16);
});
test('Pilotage : sites, séries disponibles, absence signalée et lien avec les actions',t=>{
  const a=app(t),{run,q,click,fill}=a;run('state.site="group";state.view="pilotage";state.osTab="detail";render()');
  assert.match(q('#appView').textContent,/Source|source/);assert.equal(q('#appView select'),null,'Sites choisis par puces, sans menu déroulant');
  click('[data-in-site="sodeplax"]');assert.equal(run('state.pilotSite'),'sodeplax');assert.equal(q('[data-in-site="sodeplax"]').getAttribute('aria-pressed'),'true');assert.match(q('#appView').textContent,/Sodeplax/);
  run('data.measures=data.measures.filter(m=>!(m.site_id==="sodeplax"&&m.code==="staffing"));data.trends=data.trends.filter(x=>!(x.site_id==="sodeplax"&&x.code==="staffing"));render()');assert.match(q('#appView').textContent,/indisponible/,'Une série absente est signalée');
  run('state.site="marzin";render()');assert.match(q('#appView').textContent,/TRS/);assert.match(q('#appView').textContent,/Rebut/);assert.match(q('#appView').textContent,/Service client/);
});
test('Analyser : tous les indicateurs des sept sites d’un coup d’œil, sans menu déroulant',t=>{
  const {run,q,all,click}=app(t);
  run('state.site="group";state.role="lean";state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";render()');
  assert.equal(all('#appView select').length,0,'Aucun menu déroulant');
  assert.equal(all('#appView details').length,0,'Rien de replié');
  assert.deepEqual(all('.in-site').map(x=>x.textContent),['Ag Déco','Europlacage','Le Moine','Marzin','Oraison Menuiserie','Profiline','Sodeplax']);
  assert.equal(all('.in-cell[data-os="kpiDetail"]').length,35,'Sept sites × cinq indicateurs visibles ensemble');
  assert.deepEqual(all('.in-head .in-col b').slice(0,5).map(x=>x.textContent),['S','Q','C','D','P']);
  assert.match(q('[data-in-cell="ag-deco:trs"]').textContent,/82/);
  assert.match(q('[data-in-cell="marzin:scrap"]').textContent,/5,2/);
  assert.equal(q('[data-in-cell="marzin:scrap"]').classList.contains('gap'),true);
  assert.doesNotMatch(q('.in-wall').textContent,/classement/);
  click('[data-in-cell="marzin:scrap"]');assert.match(q('#modalContent').textContent,/5,2/);run('closeModal()');
  const previous=run('osDateOffset(-7)');
  click('[data-in-step="os"][aria-label="Période précédente"]');assert.equal(run('state.osPeriod'),previous);
  assert.match(q('[data-in-cell="marzin:trs"]').textContent,/77/);
  assert.match(q('[data-in-cell="ag-deco:trs"]').textContent,/81/);
  click('[data-in-step="os"][aria-label="Période suivante"]');assert.equal(run('state.osPeriod'),null);
  click('[data-in-site="sodeplax"]');assert.equal(run('state.pilotSite'),'sodeplax');assert.equal(run('state.site'),'group');assert.equal(run('state.osTab'),'detail');
  assert.equal(all('#appView select').length,0);
});
test('Relevé manuel : saisie par site, visible dans les indicateurs et sauvegardée après rechargement',t=>{
  const a=app(t),{run,q,click,fill,submit}=a;
  run('state.site="group";state.role="lean";state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";render()');
  click('.in-wall [data-new-benchmark]');fill('#benchmarkSite','ag-deco');fill('#benchmarkKpi','service');fill('#benchmarkDate','2026-09-24');fill('#benchmarkValue','82.4');fill('#benchmarkTarget','98');fill('#benchmarkDefinition','Commandes livrées à l’heure et complètes / commandes dues');submit('#benchmarkForm');
  assert.equal(run('benchmarkObservation("ag-deco","service","2026-09-24").value'),82.4);
  assert.ok(run('indicatorSeries("ag-deco","service").labels.includes("2026-09-24")'));
  run('state.osPeriod="2026-09-24";render()');
  assert.match(q('[data-in-cell="ag-deco:service"]').textContent,/82,4/);
  assert.match(q('[data-in-cell="ag-deco:service"]').getAttribute('aria-label'),/cible 98/);
  const stored=a.stored(),b=app(t,stored);b.run('state.site="group";state.role="lean";state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";state.osPeriod="2026-09-24";render()');
  assert.equal(b.run('benchmarkObservation("ag-deco","service","2026-09-24").value'),82.4);
  assert.match(b.q('[data-in-cell="ag-deco:service"]').textContent,/82,4/);
  assert.equal(b.q('[data-in-cell="ag-deco:trs"]').classList.contains('none'),true,'Une mesure absente reste visible comme absente');
  b.run('state.role="dg";render()');assert.equal(b.q('[data-new-benchmark]'),null);
  b.run('state.role="director";state.site="ag-deco";render()');b.click('[data-new-benchmark]');
  assert.equal(b.q('#benchmarkSite').options.length,1);
  assert.equal(b.q('#benchmarkSite').value,'ag-deco');
});
test('SQCDP Groupe : sept sites simultanés, états qualifiés et détail actionnable',t=>{
  const a=app(t),{run,q,all,fill,click,submit}=a;
  run('state.site="group";state.role="lean";state.view="sqcdp";render()');
  assert.match(q('#appView').textContent,/SQCDP Groupe/);
  assert.equal(all('.sqcdp-row').length,8,'Un en-tête et sept sites');
  assert.equal(all('.sqcdp-cell').length,35);
  assert.equal(all('.sqcdp-cell.missing').length,5,'Le Moine : à renseigner, aucune valeur inventée');
  assert.equal(all('.sqcdp-cell.gap').length,5);
  assert.equal(all('.sqcdp-cell.warn').length,10,'Vigilance : sous la cible mais au-dessus du seuil orange');
  assert.match(q('[data-sqcdp-site="marzin"][data-sqcdp-axis="Q"]').textContent,/5.2/);
  click('[data-sqcdp-site="marzin"][data-sqcdp-axis="Q"]');
  assert.match(q('#modalContent').textContent,/défauts de surface/i);
  assert.match(q('#modalContent').textContent,/5.2/);
  click('#sqcdpAddAction');assert.equal(q('#actionSite').value,'marzin');
  assert.match(q('#actionTitle').value,/rebut/);
  run('closeModal();state.view="sqcdp";render()');
  click('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="D"]');
  click('#sqcdpAddMeasure');
  assert.equal(q('#benchmarkSite').value,'ag-deco');
  assert.equal(q('#benchmarkKpi').value,'service');
  fill('#benchmarkDate','2026-09-24');fill('#benchmarkValue','96');
  fill('#benchmarkTarget','95');fill('#benchmarkDefinition','Livraisons à la date demandée / livraisons dues');
  submit('#benchmarkForm');
  assert.equal(run('benchmarkObservation("ag-deco","service","2026-09-24").value'),96);
  run('state.view="sqcdp";render()');
  assert.equal(q('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="D"]').classList.contains('ok'),true);
  const prior=run('osDateOffset(-7)');run(`data.measures=data.measures.filter(m=>!(m.site_id==='ag-deco'&&m.code==='service'&&m.period==='${prior}'))`);assert.equal(q('#sqcdpGroupPeriod'),null,'Période parcourue sans menu déroulant');run('state.benchmarkPeriod=benchmarkPeriods()[0];render()');click('[data-in-step="bench"][aria-label="Période précédente"]');assert.equal(run('state.benchmarkPeriod'),prior);
  assert.equal(q('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="D"]').classList.contains('missing'),true);
  run('state.role="dg";state.view="pilotage";state.pilotageMode="ritual";render()');
  assert.equal(all('.sqcdp-cell').length,35,'La direction retrouve la matrice dans Pilotage › Décider');
  click('[data-sqcdp-site="marzin"][data-sqcdp-axis="S"]');
  assert.equal(q('#sqcdpAddMeasure'),null);
  assert.equal(q('#sqcdpAddAction'),null);
  click('#sqcdpViewSite');
  assert.equal(run('state.view'),'pilotage');
  assert.equal(run('state.pilotSite'),'marzin');
  const b=app(t,a.stored());b.run('state.role="lean";state.site="group";state.view="sqcdp";render()');
  b.run('state.benchmarkPeriod="2026-09-24";render()');
  assert.equal(b.q('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="D"]').classList.contains('ok'),true);
});
test('Décider et Analyser : mêmes couleurs, mêmes seuils, mêmes flèches',t=>{
  const a=app(t),{run,q,all,click}=a;
  run('state.site="group";state.role="lean";state.view="pilotage";state.pilotageMode="analysis";state.osTab="tower";render()');
  const analyse={};for(const c of all('[data-in-cell]'))analyse[c.dataset.inCell]=['gap','warn','ok'].find(x=>c.classList.contains(x))||'none';
  run('state.pilotageMode="ritual";state.benchmarkPeriod=benchmarkPeriods()[0];render()');
  const axes={S:'safety_signal',Q:'scrap',C:'trs',D:'service',P:'staffing'};let compared=0;
  for(const c of all('.sqcdp-cell')){const tone=['gap','warn','ok'].find(x=>c.classList.contains(x))||'none';assert.equal(tone,analyse[`${c.dataset.sqcdpSite}:${axes[c.dataset.sqcdpAxis]}`],`${c.dataset.sqcdpSite} ${c.dataset.sqcdpAxis}`);compared++;}
  assert.equal(compared,35);
  const trs=q('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="C"]');
  assert.equal(trs.classList.contains('warn'),true,'TRS 82 % pour une cible de 85 % : vigilance, pas écart');
  assert.match(trs.textContent,/Vigilance/);
  assert.match(q('.sqcdp-summary').textContent,/5\s*écarts.*10\s*vigilances.*15\s*cibles atteintes/);
  assert.match(q('.sqcdp-legend').textContent,/orange : vigilance/);
  assert.equal(all('.sqcdp-cell i.up, .sqcdp-cell i.down').length>0,true,'Flèches jugées selon le sens du progrès');
  for(const i of all('.sqcdp-cell i'))assert.match(i.textContent,/[↗↘→]/);
  click('[data-sqcdp-site="ag-deco"][data-sqcdp-axis="C"]');
  assert.match(q('#modalContent').textContent,/Vigilance/);
  assert.match(q('#modalContent').textContent,/Vert dès 85\s%\s·\sorange dès 75\s%\s·\srouge en dessous/);
  run('closeModal();state.pilotageMode="analysis";state.pilotSite="ag-deco";state.osTab="detail";render()');
  const chart=all('.indicator-chart').find(c=>/TRS/.test(c.querySelector('h2').textContent));
  assert.match(chart.querySelector('.pill').textContent,/Vigilance/,'La courbe porte le même statut que la case');
  assert.equal(chart.querySelector('.pill').classList.contains('progress'),true);
  run('state.osTab="tower";render()');click('[data-in-cell="ag-deco:trs"]');
  assert.match(q('#modalContent').textContent,/orange dès 75/);
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
  assert.equal(run('validateImport(clone(data)).meta.schema'),7);
});
test('Boutons des écrans et des 30 guides : aucune commande sans gestionnaire',t=>{
  const {run,all}=app(t),missing=[];
  function inspect(context){for(const b of all('#appView button'))if(!b.disabled&&!b.onclick&&!(b.type==='submit'&&b.form?.onsubmit))missing.push(`${context}: ${b.textContent.trim()}`);}
  for(const role of ['lean','dg','director','teamlead','operator']){run(`state.role='${role}';state.site='marzin';closeModal()`);for(const id of Array.from(run('visibleNav().map(n=>n.id)'))){run(`state.view='${id}';render()`);inspect(`${role}/${id}`);}}
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
