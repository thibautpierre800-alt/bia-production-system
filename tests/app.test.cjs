const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const scripts=['lean-library.js','v5.js','experience.js','workflows.js','fieldwork.js','documents-ui.js','dashboards.js','os-core.js','os-views.js','os-audits.js','os-vsm.js','os-app.js','os-improvements.js','actions-plan.js','ux-shell.js','journee.js','indicateurs.js','maturite.js','hoshin.js','modeles.js','calepin.js','etonnement.js','cinqs.js','audit50.js','standards.js','smed.js','causes.js','tpm.js','polyvalence.js','idees.js','equilibrage.js','sqcdp-jour.js','vsm-flux.js','pratiques.js','bibliotheque.js','signaux.js','releve.js','chantiers.js','formation.js','roadmap-revue.js','avant-apres.js','ecarts.js','journal.js','parametres.js','connecteurs.js','reunions.js','cascade.js','microarrets.js','trs.js','gains.js','environnement.js','nc.js','echantillotheque.js','tour.js','ergonomie.js','top5.js','boot.js'];
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
  assert.equal(run('LEAN_MODULES.length'),33);assert.equal(run('data.trainingCatalog.length'),18);
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
  const sw=fs.readFileSync('service-worker.js','utf8');for(const file of scripts)assert.ok(sw.includes(file));assert.match(sw,/v8-45-1/);
  const releaseTags=[...fs.readFileSync('index.html','utf8').matchAll(/(?:src|href)="[^"]+\?v=([0-9.]+)"/g)].map(x=>x[1]);assert.ok(releaseTags.length>=10);assert.ok(releaseTags.every(x=>x==='8.45.1'),'Toutes les ressources doivent porter la même version');
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
  run('state.view="daily";render()');assert.equal(all('[data-os="level"]').length,2);assert.match(q('.page-head h1').textContent,/N1 · TOP 5/);
  run('state.role="operator";state.view="home";render()');click('[data-create-menu]');click('.create-choice.idea');
  assert.ok(q('#idForm'),'Idée en 30 secondes');assert.ok(q('#idProblem'));assert.ok(q('#idFile'),'Photo d’abord');
});
test('Accueil, raccourcis terrain et écran SQCDP Groupe vertical sont explicites',t=>{
  const a=app(t),{run,q,all,click}=a;
  run('state.role="lean";state.site="group";state.view="home";render()');
  assert.match(q('#appView').textContent,/Ma journée/);
  assert.equal(q('.jn-gemba'),null,'Pas de Gemba à l’accueil : il se démarre depuis + ou Observer');assert.ok(q('.jn-actions'));
  assert.match(q('.jn-watch').textContent,/Risque critique/);
  assert.equal(all('.quick-action-dock .quick-action').length,1);
  assert.deepEqual(all('.quick-action-dock .quick-action').map(x=>x.getAttribute('aria-label')),['Créer un dossier']);
  assert.equal(all('.quick-action-dock b,.quick-action-dock small').length,0);
  assert.match(fs.readFileSync('experience.css','utf8'),/\.quick-action\{[^}]*width:44px;height:44px/);
  click('.quick-action.create');assert.match(q('#modalContent').textContent,/Signal Terrain/);assert.match(q('#modalContent').textContent,/Idée Kaizen/);click('.create-choice.idea');assert.match(q('#modalContent').textContent,/Une photo, une phrase/);run('closeModal()');
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
  assert.ok(q('.handover-card'));assert.match(q('.handover-links').textContent,/Signal · S-041/);click('[data-new-handover]');assert.ok(q('#rlForm'));click('[data-rl-full]');
  assert.equal(q('#handoverSituation').required,false);assert.notEqual(q('#handoverFrom').value,q('#handoverTo').value);
  run('closeModal();handoverForm()');for(const k of ['securite','qualite','machines','production','matiere','effectif'])click(`[data-rl-cat="${k}"] [data-rl-s="ok"]`);
  click('[data-rl-cat="qualite"] [data-rl-s="watch"]');fill('[data-rl-cat="qualite"] [data-rl-note]','Contrôle renforcé');fill('[data-rl-pr="0"]','Vérifier le premier lot');submit('#rlForm');
  const id=run('data.handovers[0].id');assert.equal(run('data.handovers[0].status'),'Transmise');assert.ok(run(`data.syncQueue.some(item=>item.record_id==='${id}')`));assert.match(run('data.handovers[0].situation'),/Qualité : Contrôle renforcé/);
  click(`[data-rl-read="${id}"]`);submit('#rlAckForm');assert.equal(run('data.handovers[0].status'),'Reprise');assert.ok(run('data.handovers[0].acknowledged_by'));
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
  run(`const x=hkFromWorkbook(${JSON.stringify(HK_SAMPLE)},"plan.xlsx");x.plan.start=today().slice(0,8)+"01";commitData(()=>{data.hoshinPlan=x.plan});render()`);
  assert.deepEqual(all('.hk-row:not(.hk-head) .hk-site').map(x=>x.textContent.replace(/TOP|\d/g,'').trim()),['Le Moine','Marzin','Ag Déco']);
  assert.equal(all('.hk-top').length,2);assert.deepEqual(all('.hk-total b').map(b=>b.textContent),['24','16','14']);
  assert.equal(all('#appView select').length,0,'Aucun menu déroulant');
  assert.match(q('.hk-cap').textContent,/Lancement/);assert.equal(q('.rp-table'),null,'Les phases sont dans la Roadmap');
  run('state.view="roadmap";render()');assert.equal(all('.rp-table tr.now').length,1);
  assert.equal(all('.rp-miles tbody tr').length,2);click('[data-hk-milestone="0"]');assert.equal(run('data.hoshinPlan.milestones[0].done'),true);
  run('state.view="hoshin";render()');
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
test('Roadmap : l’onglet « phases et actions » ; objectifs et avancement issus du fichier',t=>{
  const a=app(t),{run,q,all,click}=a;
  // Gantt fictif : semaines S51-S52 2026 puis S1-S3 2027, barres vertes, une barre rouge (retard), légende en tête.
  const book=JSON.parse(JSON.stringify(HK_SAMPLE));Object.assign(book.planning,{J6:2026,L6:2027,J8:'S51',K8:'S52',L8:'S1',M8:'S2',N8:'S3',Y1:'tâche en cours délai OK',Y3:'Tâche en retard'});
  book['phases et actions'].A3='1. BU pilotes (2)';book['phases et actions'].B3='4 mois';book['phases et actions'].A4='2. Généralisation';book['phases et actions'].B4='4 mois';book['phases et actions'].C4='Vague 1 (1 BU) puis vague 2 (1 BU), 2 mois par vague';
  const colors={planning:{X1:'FF92D050',X3:'FFFF0000',J13:'FF92D050',K13:'FF92D050',L14:'FF92D050',M14:'FFFF0000',N14:'FF92D050',J12:'theme8',K12:'theme8',J10:'FF92D050'}};
  const x=JSON.parse(run(`JSON.stringify(hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",${JSON.stringify(colors)}))`));
  assert.deepEqual(x.plan.tracks.marzin.map(s=>[s.from,s.to,!!s.late]),[['2026-12-14','2026-12-27',false],['2027-01-04','2027-01-24',true]]);
  assert.deepEqual(x.plan.tracks.marzin[1].segments.map(g=>[g.from,g.color]),[['2027-01-04','FF92D050'],['2027-01-11','FFFF0000'],['2027-01-18','FF92D050']]);
  assert.equal(x.plan.start,'2026-12-14','Début = première semaine du Gantt, pas la case « Date » (=AUJOURDHUI)');
  assert.deepEqual(x.plan.legend.map(l=>l.label),['tâche en cours délai OK','Tâche en retard']);assert.deepEqual(x.plan.order,['macro','marzin','ag-deco']);
  assert.equal(x.plan.macroTasks[0].from,'2026-12-14');assert.ok(x.report.found.some(f=>/3 tâches datées/.test(f)));
  run(`const y=hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",${JSON.stringify(colors)});y.plan.waves={marzin:"pilot","ag-deco":"wave2"};commitData(()=>{data.hoshinPlan=y.plan});state.role="lean";state.site="group";state.view="hoshin";render()`);
  assert.match(q('[data-hk-step*="marzin"]').textContent,/S51–S52/,'Semaines du planning sur chaque étape');
  const before=run('data.objectives.length');click('[data-hk-sync-objectives]');
  const made=run('JSON.stringify(data.objectives.filter(o=>o.plan_key).map(o=>[o.plan_key,o.level,o.due_date,(data.objectives.find(p=>p.id===o.parent_id)||{}).plan_key||null]))');
  assert.deepEqual(JSON.parse(made),[['cap','Axe stratégique','2027-12-31',null],['jalon:goessai','Groupe','2027-06-30','cap'],['jalon:fin','Groupe','2027-12-31','cap'],['site:marzin','Site','2027-01-24','jalon:goessai']]);
  assert.equal(run('data.objectives.length'),before+4);click('[data-hk-sync-objectives]');assert.equal(run('data.objectives.length'),before+4,'Pas de doublon');
  run('state.view="roadmap";render()');
  assert.match(q('#appView h1').textContent,/Roadmap de déploiement/);assert.match(q('.hk-source').textContent,/phases et actions/);
  assert.deepEqual(all('.rp-phase b').map(b=>b.textContent),['0. Lancement','1. BU pilotes (2)','2. Généralisation']);
  assert.deepEqual(all('.rp-phase small').map(b=>b.textContent),['déc. 2026','janv. – avr. 2027','mai – août 2027'],'Mois calendaires depuis le mois de démarrage');
  assert.deepEqual(all('.rp-band b').map(b=>b.textContent),['BU pilotes','Vague 1','Vague 2']);assert.match(all('.rp-band')[0].textContent,/Marzin/);assert.match(all('.rp-band')[2].textContent,/Ag Déco/);
  assert.equal(all('.rp-gate').length,2);assert.equal(all('.rp-table').length>=3,true,'Phases, jalons, gouvernance et risques en tableaux, comme l’onglet');
  assert.match(q('.rp-table').textContent,/Actions clés[\s\S]*Livrable[\s\S]*Planning détaillé/);
  assert.equal(all('.rm-step, .rm-gantt').length,0,'Plus de Gantt du planning dans la Roadmap');
  assert.ok(all('.roadmap-item').length>0,'Les priorités hors plan restent');
  run('state.role="dg";render()');assert.equal(all('[data-hk-milestone]').length,0,'DG : lecture seule');assert.equal(q('[data-new-roadmap]'),null);
  const b=app(t);b.run('state.role="lean";state.site="group";state.view="roadmap";render()');assert.ok(b.q('.hk-empty'),'Sans plan : renvoi vers le Hoshin');
});
test('Import : exemples fictifs retirés, objectifs créés, calendrier d’intégration lu',t=>{
  const a=app(t),{run,q,all}=a;
  const book=JSON.parse(JSON.stringify(HK_SAMPLE));book['calendrier intégration']={A1:'Planning fictif',B2:'Lundi',C2:'Mardi',D2:'Mercredi',E2:'Jeudi',F2:'Vendredi',A3:'Sem. 45\n02/11 - 06/11',B3:'Visite site A',C3:'Atelier B',F3:'Point C',A4:'Sem. 46',B4:'Site D',E4:'Réunion E'};
  const merges={'calendrier intégration':['C3:D3']},colors={'calendrier intégration':{D4:'theme1'}};
  const agenda=JSON.parse(run(`JSON.stringify(hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",${JSON.stringify(colors)},${JSON.stringify(merges)}).plan.agenda)`));
  assert.deepEqual(agenda.map(w=>[w.week,w.from]),[[45,'2026-11-02'],[46,'2026-11-09']]);
  assert.deepEqual(agenda[0].items.map(i=>[i.day,i.span,i.text]),[[0,1,'Visite site A'],[1,2,'Atelier B'],[4,1,'Point C']]);
  assert.deepEqual(agenda[1].items.map(i=>[i.day,!!i.blocked]),[[0,false],[2,true],[3,false]]);
  const demo=JSON.parse(run('JSON.stringify(hkDemoStrategy())'));assert.ok(demo.objectives.length>0&&demo.roadmap.length>0,'Le scénario fictif est reconnu par ses identifiants');
  run(`const y=hkFromWorkbook(${JSON.stringify(book)},"plan.xlsx",{},${JSON.stringify(merges)});commitData(()=>{data.hoshinPlan=hkMerge(y.plan,null);hkArchiveDemo(hkDemoStrategy());hkApplyObjectives(data.hoshinPlan)})`);
  assert.equal(run('osActive(data.objectives).filter(o=>!o.plan_key).length'),0,'Hoshin : plus d’objectif fictif actif');
  assert.equal(run('data.roadmap.filter(r=>!r.archived_at).length'),0);assert.ok(run('data.objectives.some(o=>o.archived_at)'),'Archivés, pas supprimés');
  run('state.role="lean";state.site="group";state.view="roadmap";render()');assert.equal(q('.rm-prio-title'),null,'Plus de priorités fictives');
  run('state.view="hoshin";render()');assert.equal(all('.os-objective').length,4);
});
test('Accueil : seulement l’information utile, selon le profil',t=>{
  const a=app(t),{run,q,all}=a;
  run('state.role="lean";state.site="group";state.view="home";render()');
  assert.equal(q('.jn-gemba'),null);assert.equal(q('.jn-week'),null,'Sans calendrier importé : pas de carte vide');assert.equal(q('.jn-plan'),null);
  assert.ok(q('.jn-kpi'),'Indicateurs en écart');assert.ok(all('.jn-kpi [data-os="kpiDetail"]').length>0);
  const monday=run('hkWeekMonday(today())'),week=run('hkIsoWeek(today())');
  run(`data.hoshinPlan={source:{file:"x"},start:"${monday}",phases:[{name:"0. Cadrage",months:2}],milestones:[{name:"Go",date:"2099-01-31",criteria:"ok"}],tracks:{marzin:[{name:"Pré-diagnostic",status:"todo",from:"${monday}",to:hkAddDays("${monday}",13)}],sodeplax:[{name:"Pré-diagnostic",status:"todo",from:"${monday}",to:hkAddDays("${monday}",13)}]},agenda:[{week:${week},from:"${monday}",items:[{day:0,span:1,text:"Visite fictive"},{day:2,span:2,text:"Atelier fictif"}]}],waves:{},sequoia:{}};render()`);
  assert.match(q('.jn-week').textContent,/Visite fictive[\s\S]*Atelier fictif/);assert.equal(all('.jn-agenda li').length,2);
  assert.match(q('.jn-plan').textContent,/0\. Cadrage[\s\S]*Prochain jalon[\s\S]*Go/);assert.match(q('.jn-steps').textContent,/Marzin, Sodeplax/,'Sites aux mêmes étapes regroupés');
  run('state.role="director";state.site="marzin";render()');assert.equal(q('.jn-week'),null,'Le calendrier d’intégration est celui du Responsable Lean');assert.doesNotMatch(q('.jn-steps').textContent,/Sodeplax/);
  run('state.role="dg";state.site="group";render()');assert.ok(q('.jn-plan'));assert.equal(q('.jn-week'),null);
  run('state.role="operator";state.site="marzin";render()');assert.ok(q('.jn-signal'));assert.equal(q('.jn-plan'),null);
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
test('A3, 8D et QRQC en mode guidé : étapes réelles, sauvegarde, action liée, validation protégée',t=>{
  const a=app(t),{run,fill,submit,click,q}=a;
  for(const type of ['A3','8D','QRQC']){
    run(`closeModal();genericProblemForm({method:'${type}'})`);fill('#problemTitle',`Analyse ${type}`);fill('#problemOwner','Pilote');submit('#problemForm');
    const id=run('data.documents[0].id'),pid=run('data.problems[0].id'),fields=Array.from(run(`DOCUMENT_SCHEMAS['${type}'].fields.map(f=>f[0])`));run(`mdGuided('${id}',0)`);
    for(let i=0;i<fields.length;i++){
      assert.equal(q('[data-doc-field]').dataset.docField,fields[i]);fill('[data-doc-field]',`Faits et preuve ${type} rubrique ${i}`);
      if(i<fields.length-1)click(`.wizard-actions [data-doc-go='${i+1}']`);
    }
    fill('#editDocumentStatus','Validé');fill('#documentProblemStatus','Clos');submit('#editDocumentForm');
    assert.equal(run(`data.problems.find(x=>x.id==='${pid}').status`),'Clos');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'Validé');
    run(`mdGuided('${id}')`);run('requestCloseModal()');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'Validé','Consulter ne dévalide pas');
    run(`mdGuided('${id}',1)`);fill('[data-doc-field]','Nouvelle mesure');run('requestCloseModal()');assert.equal(run(`data.documents.find(x=>x.id==='${id}').status`),'En révision');
    const b=app(t,a.stored());b.run(`mdGuided('${id}')`);assert.equal(b.q('[data-doc-field]').value,'Nouvelle mesure');
  }
  run('closeModal();genericProblemForm({method:"A3"})');fill('#problemTitle','Action liée');fill('#problemOwner','Pilote');submit('#problemForm');const pid=run('data.problems[0].id');
  const i=run('DOCUMENT_SCHEMAS.A3.fields.findIndex(f=>f[0]==="action_plan")');run(`mdGuided(data.documents[0].id,${i})`);fill('[data-doc-field]','Essai à réaliser');click('#modalContent [data-new-action]');
  fill('#actionTitle','Tester le contre-guide');fill('#actionOwner','Équipe');submit('#actionForm');assert.equal(run('data.actions[0].origin_id'),pid);assert.ok(run('data.problems[0].action_ids.includes(data.actions[0].id)'));
});
test('Résoudre : A3, PDCA, 8D, DMAIC et QRQC sur leur modèle de référence',t=>{
  const a=app(t),{run,q,all,click,fill,submit}=a;
  run('state.role="lean";state.site="marzin";state.view="resolution";render()');
  const shape={A3:['.md-a3-cols .md-col',2],PDCA:['.md-wheel .md-q',4],'8D':['.md-8d .md-split .md-box',2],DMAIC:['.md-dmaic-row .md-ph',5],QRQC:['.md-steps li',5]};
  for(const type of ['QRQC','PDCA','A3','8D','DMAIC']){
    run('closeModal();genericProblemForm({method:"A3"})');
    assert.equal(all('.md-pick-card').length,5,'Cinq modèles, avec leur vignette');assert.equal(q('select#problemMethod'),null,'Plus de menu déroulant pour la méthode');
    click(`[data-md-method="${type}"]`);assert.equal(q('#problemMethod').value,type);assert.equal(q('.md-pick-card.active').dataset.mdMethod,type);
    fill('#problemTitle',`Modèle ${type}`);fill('#problemOwner','Pilote');submit('#problemForm');
    const pid=run('data.problems[0].id'),fields=Array.from(run(`DOCUMENT_SCHEMAS['${type}'].fields.map(f=>f[0])`));
    assert.equal(run('data.problems[0].method'),type);
    assert.equal(run('state.view'),'resolution','Dès la création, on arrive sur la fiche du modèle');assert.equal(run('$("modal").hidden'),true,'Pas de formulaire intermédiaire');
    assert.equal(q('.md-wrap .md-sheet').dataset.mdType,type);assert.equal(all('.md-wrap [data-md-key]').length,fields.length,'Une case par rubrique, aucune oubliée');
    assert.equal(all(`.md-wrap ${shape[type][0]}`).length,shape[type][1]);
    const last=fields.at(-1);fill(`.md-wrap [data-md-key="${last}"] textarea`,`Écrit dans la case ${type}`);
    assert.equal(run(`data.documents.find(d=>d.problem_id==="${pid}").structured_data["${last}"]`),`Écrit dans la case ${type}`,'On écrit directement dans la case');
    assert.ok(q(`.md-wrap [data-md-key="${last}"]`).classList.contains('md-filled'));
    // Le mode guidé reste disponible : sa vue d’ensemble est la même fiche.
    click('[data-md-guided]');assert.ok(q('.wizard-overview .md-sheet'));assert.equal(q('.wizard-overview summary').textContent,`Voir la fiche ${type} complète`);
    assert.equal(q('.wizard-overview .md-box.current').dataset.mdKey,q('[data-doc-field]').dataset.docField,'La case en cours est repérée');
    run('closeModal()');
  }
  assert.deepEqual(all('.md-wrap .md-ph .md-head b').map(b=>b.textContent),['Définir','Mesurer','Analyser','Améliorer','Contrôler']);
  run('state.selectedProblemId=data.problems.find(p=>p.method==="8D").id;render()');
  assert.deepEqual(all('.md-wrap .md-num').map(n=>n.textContent).filter(x=>/^D\d$/.test(x)),['D0','D1','D2','D3','D4','D5','D6','D7','D8']);
  assert.match(q('.md-wrap [data-md-key="d4_occurrence"]').textContent,/apparu/);assert.match(q('.md-wrap [data-md-key="d4_escape"]').textContent,/détecté/);
  // 5W2H : une ligne par question remplit la grille ; la trame s’insère d’un geste.
  const p5=JSON.parse(run('JSON.stringify(md5w2hParse("Rayure capot\\nQuoi : rayure\\nOù : poste 3\\n- Combien ? : 12 pièces"))'));
  assert.deepEqual(p5.cells,{quoi:'rayure',ou:'poste 3',combien:'12 pièces'});assert.equal(p5.rest,'Rayure capot');
  const doc8=run('data.documents.find(d=>d.type==="8D").id');run(`mdGuided("${doc8}",2)`);fill('[data-doc-field]','');click('[data-md-5w2h]');
  assert.match(q('[data-doc-field]').value,/^Quoi : \nQui : \nOù : [\s\S]*Pourquoi est-ce un problème : $/);
  fill('[data-doc-field]','Quoi : rayure\nCombien : 12 pièces');run('requestCloseModal();render()');
  assert.equal(q('.md-wrap [data-md-key="d2"] [data-md-5w="quoi"]').value,'rayure');assert.equal(q('.md-wrap [data-md-key="d2"] [data-md-5w="combien"]').value,'12 pièces');
  fill('.md-wrap [data-md-key="d2"] [data-md-5w="ou"]','Poste 3');
  assert.equal(run('data.documents.find(d=>d.type==="8D").structured_data.d2'),'Quoi : rayure\nOù : Poste 3\nCombien : 12 pièces','La grille 5W2H est le formulaire');
  // Plan d’actions : les actions liées au dossier, dans la case du modèle ; plus de doublon sous le dossier.
  run('state.selectedProblemId=data.problems.find(p=>p.method==="A3").id;render()');const pa=run('state.selectedProblemId');
  run(`commitData(()=>data.actions.unshift({id:"A-MD1",site_id:"marzin",title:"Remettre le support à la cote",owner:"Maintenance",status:"À faire",priority:"Haute",due_date:"2000-01-01",origin_type:"Problème",origin_id:"${pa}",created_at:now()}));render()`);
  assert.match(q('.md-wrap [data-md-key="action_plan"] .md-table').textContent,/Remettre le support à la cote[\s\S]*Maintenance[\s\S]*en retard/);
  assert.equal(all('.problem-layout .section-title').filter(x=>/Actions liées/.test(x.textContent)).length,0);
  // Impression : la fiche seule, au format de page du modèle.
  const printed=run(`(()=>{const d=data.documents.find(x=>x.type==="8D");return documentPrint(d,documentValues(d))})()`);
  assert.match(printed,/md-sheet md-8d/);assert.match(printed,/@page\{size:portrait/);assert.doesNotMatch(printed,/data-md-step|data-doc-go/,'À l’impression, pas de bouton');
  click('[data-md-print]');assert.ok(q('.md-preview .md-sheet.md-a3'));assert.match(q('.md-preview').innerHTML,/size:landscape/);run('closeModal()');
  // Les autres documents gardent leur présentation.
  assert.match(run('documentVisual("5WHY",{why1:"x"})'),/why-ladder/);
});
test('Fiches : on écrit dans les cases, avec les garde-fous du dossier ; quel outil et pourquoi',t=>{
  const a=app(t),{run,q,all,click,fill,submit}=a;
  run('state.role="lean";state.site="marzin";state.view="resolution";render()');
  assert.equal(all('.md-guide .md-guide-card').length,5,'Quand et pourquoi utiliser chaque outil');assert.equal(all('.md-guide .md-tools-list > div').length,4,'5W2H, Pareto, Ishikawa, 5 pourquoi');
  assert.match(q('.md-guide').textContent,/Le client est touché[\s\S]*8D/);
  run('genericProblemForm({})');assert.match(q('[data-md-method="QRQC"]').textContent,/Quand[\s\S]*Pourquoi/);
  click('[data-md-method="A3"]');fill('#problemTitle','Bavures découpe');fill('#problemOwner','Pilote');submit('#problemForm');
  const pid=run('data.problems[0].id'),fields=Array.from(run('DOCUMENT_SCHEMAS.A3.fields.map(f=>f[0])'));
  assert.equal(run('document.activeElement?.dataset?.mdField'),'background','Le curseur est dans la première case vide (le problème reprend le titre)');
  assert.match(q('.md-why-tool').textContent,/Pourquoi un A3/);
  const doc=()=>JSON.parse(run(`JSON.stringify(data.documents.find(d=>d.problem_id==="${pid}"))`)),prob=()=>JSON.parse(run(`JSON.stringify(data.problems.find(p=>p.id==="${pid}"))`));
  fill('.md-sheet [data-md-meta="title"]','Bavures sur la découpe CN');assert.equal(prob().title,'Bavures sur la découpe CN');assert.equal(doc().title,'Bavures sur la découpe CN');
  fill('.md-sheet [data-md-meta="owner"]','Équipe méthodes');assert.equal(prob().owner,'Équipe méthodes');
  fill('.md-sheet [data-md-field="current"]','12 % de pièces à reprendre');assert.equal(prob().content.current,'12 % de pièces à reprendre','Le problème suit la fiche');
  assert.match(q('[data-md-progress-panel]').textContent,/cases renseignées/);
  // Garde-fous : pas de fiche validée ni de problème clos tant que tout n’est pas rempli.
  click('[data-md-dstatus="Validé"]');assert.notEqual(doc().status,'Validé');
  click('[data-md-pstatus="Clos"]');assert.notEqual(prob().status,'Clos');
  for(const k of fields)if(q(`.md-sheet [data-md-field="${k}"]`)&&!q(`.md-sheet [data-md-field="${k}"]`).value)fill(`.md-sheet [data-md-field="${k}"]`,`Fait pour ${k}`);
  click('[data-md-dstatus="Validé"]');assert.equal(doc().status,'Validé');assert.equal(doc().version,2,'Valider crée une version');
  click('[data-md-pstatus="Clos"]');assert.equal(prob().status,'Clos');
  fill('.md-sheet [data-md-field="learning"]','Leçon complétée');assert.equal(doc().status,'En révision','Modifier une fiche validée la remet en révision');
  assert.equal(prob().status,'Analyse','Modifier un dossier clos le rouvre');assert.ok(prob().history.some(h=>/Réouverture/.test(h.note)));
  // Rien ne se perd : une saisie en attente part avant d’afficher autre chose.
  q('.md-sheet [data-md-field="background"]').value='Saisie en cours';q('.md-sheet [data-md-field="background"]').dispatchEvent(new (q('body').ownerDocument.defaultView.Event)('input',{bubbles:true}));
  run('state.view="actions";render()');assert.equal(doc().structured_data.background,'Saisie en cours');
  const b=app(t,a.stored());assert.equal(b.run(`data.documents.find(d=>d.problem_id==="${pid}").structured_data.background`),'Saisie en cours');
  // Ouvrir le dossier depuis ailleurs mène à la fiche, sur la case demandée.
  run(`editDocument(data.documents.find(d=>d.problem_id==="${pid}").id,6)`);assert.equal(run('state.view'),'resolution');assert.equal(run('document.activeElement?.dataset?.mdField'),'countermeasures');
});
test('Fiches : résumé graphique de ce qui est écrit et mesuré (courbe, départ → cible, Pareto, pourquoi, Ishikawa)',t=>{
  const a=app(t),{run,q,all}=a;
  run('state.role="lean";state.site="marzin";state.view="resolution";closeModal();genericProblemForm({method:"A3"})');
  a.fill('#problemTitle','Rayures capot');a.fill('#problemOwner','Pilote');a.submit('#problemForm');run('closeModal()');
  const pid=run('data.problems[0].id'),k=run('osActive(data.kpis).find(k=>osFinite(k.target)).id');
  run(`commitData(()=>{const p=data.problems[0];p.kpi_id="${k}";p.created_at=osDateOffset(-10)+"T08:00:00Z";p.pareto=[{label:"Rayure",value:30},{label:"Bulle",value:6},{label:"Coulure",value:4}];
    data.measures=(data.measures||[]).filter(m=>!(m.site_id==="marzin"&&m.kpi_id==="${k}"));
    [[-30,7],[-20,6],[-12,5],[-3,4]].forEach(([d,v],i)=>data.measures.push({id:"M-MD"+i,site_id:"marzin",kpi_id:"${k}",period:osDateOffset(d),value:v,created_at:now()}));
    data.documents.unshift({id:"DOC-W9",site_id:"marzin",type:"5WHY",title:"5P",status:"Brouillon",problem_id:p.id,structured_data:{why1:"Frottement",why2:"Support haut",root_cause:"Cale non contrôlée"},version:1,updated_at:now()});
    data.documents.unshift({id:"DOC-I9",site_id:"marzin",type:"ISHIKAWA",title:"Ishikawa",status:"Brouillon",problem_id:p.id,structured_data:{machine:"Support usé",method:"Pas de contrôle"},version:1,updated_at:now()});});
    state.selectedProblemId="${pid}";render()`);
  const box=k=>q(`.md-wrap [data-md-key="${k}"]`);
  assert.equal(box('current').querySelectorAll('.md-chart circle').length,3,'Situation de départ : mesures jusqu’à l’ouverture');
  assert.equal(box('followup').querySelectorAll('.md-chart circle').length,4,'Résultats : toute la courbe');assert.ok(box('followup').querySelector('.md-open'),'Ouverture du dossier repérée');
  assert.ok(box('followup').querySelector('.md-goal'),'Cible en pointillé');assert.match(box('followup').querySelector('svg').getAttribute('aria-label'),/cible/);
  assert.match(box('target').querySelector('.md-goalbar').textContent,/Départ[\s\S]*Cible[\s\S]*Aujourd’hui/);
  assert.deepEqual(Array.from(box('analysis').querySelectorAll('.md-par span')).map(x=>x.textContent),['Rayure','Bulle','Coulure'],'Pareto trié');
  assert.equal(box('analysis').querySelectorAll('.md-fish-grid span.on').length,2,'Branches Ishikawa renseignées');
  assert.deepEqual(Array.from(box('root_cause').querySelectorAll('.md-why li')).map(x=>x.textContent),['Frottement','Support haut','Cale non contrôlée']);
  assert.ok(box('root_cause').querySelector('.md-why li.root'));
  // Mêmes résumés en 8D, sans indicateur : pas de courbe vide.
  run(`commitData(()=>{data.problems[0].method="8D"});render()`);
  assert.ok(q('.md-wrap [data-md-key="d2"] .md-chart'));assert.ok(q('.md-wrap [data-md-key="d4_occurrence"] .md-why'));assert.ok(q('.md-wrap [data-md-key="d4_occurrence"] .md-fish'));
  run(`commitData(()=>{data.problems[0].kpi_id=null});render()`);assert.equal(all('.md-wrap .md-chart, .md-wrap .md-goalbar').length,0);
});
test('Audit 50 critères 8.11 : note au pouce, brouillon repris, preuve obligatoire, actions datées sans doublon',t=>{
  const a=app(t),{run,fill,submit,click,q,all}=a;
  run('auditForm()');fill('#auScope','Découpe');fill('#auOwner','Chef atelier');fill('#auAuditor','Auditeur');submit('#auStartForm');
  const id=run('data.audits[0].id');assert.match(id,/^AUD-\d{3}$/);assert.equal(all('.au-q').length,5);assert.equal(all('[data-au-ci="0"] .au-v').length,6,'Six boutons de 0 à 5');
  click('[data-au-ci="0"] [data-au-v="0"]');assert.ok(q('[data-au-ci="0"].lv0'),'La note se voit sur place');assert.match(q('[data-au-ci="0"] .au-lvl').textContent,/Absent/);
  fill('[data-au-ci="0"] [data-au-proof]','Absence observée');run('document.querySelector(\'[data-au-ci="0"] [data-au-proof]\').onblur()');
  click('[data-au-later]');assert.equal(run('data.audits[0].status'),'Brouillon');assert.equal(run('data.audits[0].score'),null);
  const b=app(t,a.stored());b.run(`auditForm(data.audits.find(x=>x.id==='${id}'))`);assert.ok(b.q('[data-au-ci="0"] [data-au-v="0"].on'),'Brouillon repris');assert.equal(b.q('[data-au-ci="0"] [data-au-proof]').value,'Absence observée');
  run(`auditForm(data.audits.find(x=>x.id==='${id}'),10)`);click('[data-au-finish]');assert.equal(run('data.audits[0].status'),'Brouillon','Pas de validation sans les 50 notes et preuves');
  run(`Object.entries(AUDIT_CRITERIA).forEach(([d,l],i)=>l.forEach((c,j)=>{if(i===0&&j===0)return;auSet(d,c,{score:i===0?2:4,proof:'Constat et preuve terrain'})}));auRender()`);
  assert.equal(all('[data-au-gap]').length,5,'Les notes sous 3 sont proposées en actions');assert.equal(all('[data-au-act]:checked').length,1,'Seul le 0 est coché d’office');
  fill('[data-au-gap="Sécurité|Risques critiques sécurisés"] [data-au-what]','Poser le garde-corps de la passerelle');
  click('[data-au-finish]');
  assert.equal(run('data.audits[0].status'),'Terminé');assert.equal(run('data.audits[0].score'),75);assert.equal(run('data.audits[0].audit_data.domain_scores["Sécurité"]'),1.6);
  assert.deepEqual(JSON.parse(run(`JSON.stringify(data.actions.filter(x=>x.origin_id==='${id}').map(x=>[x.title,x.owner,x.priority,x.category,!!x.due_date]))`)),[['Poser le garde-corps de la passerelle','Chef atelier','Haute','Sécurité',true]]);
  assert.ok(q('.au-report .au-radar'),'Rapport avec radar des 10 domaines');
  run(`auditForm(data.audits.find(x=>x.id==='${id}'))`);assert.ok(q('.au-report'));assert.equal(run(`data.actions.filter(x=>x.origin_id==='${id}').length`),1);
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
  assert.ok(q('.vf'),'Nouvelle VSM : éditeur pas à pas');click('[data-vf-free]');
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
  run('practiceForm()');assert.ok(q('#bpNewForm'));fill('#bpTitle','Support de gabarits');fill('#bpSummary','Rangement visuel au poste');submit('#bpNewForm');const id=run('data.practices[0].id');assert.equal(run('data.practices[0].status'),'À compléter');assert.ok(q('.bp-study [data-bp-publish][disabled]'));
  fill('.bp-form [data-bp-f="evidence"]','Temps de recherche mesuré');fill('.bp-form [data-bp-f="transfer"]','Vérifier la place et la charge');fill('#bpValidator','Lean Groupe');click('[data-bp-publish]');assert.equal(run(`data.practices.find(p=>p.id==='${id}').status`),'Publiée');
  run(`closeModal();openRecord('${id}')`);assert.ok(q('.bp-study'));click('[data-bp-full]');assert.equal(q('#practiceTitle').value,'Support de gabarits');
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
  run('photoResolvers[1]("data:image/jpeg;base64,Yg==")');await new Promise(r=>setImmediate(r));run('photoResolvers[0]("data:image/jpeg;base64,YQ==")');await new Promise(r=>setImmediate(r));for(let i=0;i<100&&run('testPicker.busy');i++)await new Promise(r=>setTimeout(r,20));assert.equal(run('safePhoto(testPicker.value)'),'data:image/jpeg;base64,Yg==');
});
