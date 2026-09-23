const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const values=new Map(),nodes=new Map();
function fakeNode(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set();
  const item={id,innerHTML:"",textContent:"",value:"",hidden:false,files:[],onclick:null,onchange:null,
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,force){if(force===undefined?classes.has(x):!force){classes.delete(x);return false}classes.add(x);return true},contains:x=>classes.has(x)},
    addEventListener(){},focus(){},setAttribute(){},querySelector(){return null},querySelectorAll(){return[]}};
  nodes.set(id,item);return item;
}
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const context=vm.createContext({console,Date,Math,JSON,Number,String,Set,Object,Array,RegExp,Promise,localStorage,
  window:{addEventListener(){},scrollTo(){}},navigator:{},
  document:{getElementById:fakeNode,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},Blob,URL});
const run=code=>vm.runInContext(code,context);
run(fs.readFileSync("lean-library.js","utf8"));
run(fs.readFileSync("v5.js","utf8"));

assert.match(fakeNode("appView").innerHTML,/Aujourd’hui à Marzin/);
assert.deepEqual(Array.from(run("OPERATIONAL_SITES.map(s=>s.name)")),["Ag Déco","Europlacage","Marzin","Oraison Menuiserie","Profiline","Sodeplax"]);
assert.equal(run('SITES.some(s=>/^Site [1-9]/.test(s.name))'),false);
assert.equal(run('NAV.some(n=>n.label==="Indicateurs")'),false);
assert.equal(run('NAV.some(n=>/100 premiers jours/i.test(n.label))'),false);
assert.equal(run("LEAN_MODULES.length"),30);
assert.equal(run('LEAN_MODULES.some(x=>/100 premiers jours/i.test(x.title))'),false);
assert.equal(run('Object.values(AUDIT_CRITERIA).flat().length'),50);
assert.ok(run('NAV.some(n=>n.id==="projects")'));
assert.ok(run('NAV.some(n=>n.id==="tools")'));

for(const id of Array.from(run('ROLES.lean.nav'))){
  run(`state.view="${id}";render()`);
  assert.ok(fakeNode("appView").innerHTML.length>80,`écran ${id}`);
}
for(const roleId of ["dg","director","terrain"]){
  run(`state.role="${roleId}";state.site=${roleId==="dg"?'"group"':'"marzin"'}`);
  for(const id of Array.from(run('visibleNav().map(n=>n.id)'))){run(`state.view="${id}";render()`);assert.ok(fakeNode("appView").innerHTML.length>50,`${roleId} · ${id}`)}
}
assert.equal(run('ROLES.dg.nav.includes("terrain")'),false);
assert.equal(run('ROLES.terrain.nav.includes("settings")'),false);

const beforeSignals=run("data.signals.length");
run('data.signals.unshift({id:"S-999",site_id:"marzin",workshop_id:"marzin-pilot",type:"Sécurité",description:"Test",severity:"Haute",state:"Nouveau",created_at:new Date().toISOString(),updated_at:new Date().toISOString()});save()');
assert.equal(run("data.signals.length"),beforeSignals+1);
assert.equal(JSON.parse(values.get("biaProductionSystemV5")).signals[0].id,"S-999");
assert.equal(run('isOpenSignal(data.signals[0])'),true);
run('advanceSignal("S-999")');
assert.equal(run('data.signals.find(s=>s.id==="S-999").state'),"Pris en compte");

run('problemFromSignal("S-999")');
assert.ok(run('data.signals.find(s=>s.id==="S-999").problem_id'));
assert.equal(run('data.problems[0].signal_ids[0]'),"S-999");
assert.ok(run('data.documents.some(d=>d.problem_id===data.problems[0].id)'));

assert.equal(run('isLate({due_date:"2020-01-01",status:"Ouverte"})'),true);
assert.equal(run('isLate({due_date:"2020-01-01",status:"Clôturée"})'),false);
assert.equal(run('measureStatus({code:"trs",value:80,target:85}).tone'),"open");
assert.equal(run('measureStatus({code:"scrap",value:2,target:3}).tone'),"done");
assert.equal(run('measureStatus({code:"safety_signal",value:1,target:0}).tone'),"open");

run('state.role="terrain";state.site="marzin";state.view="home";render()');
assert.deepEqual(Array.from(run("visibleNav().map(n=>n.id)")),["home","sqcdp","actions","terrain","audits","documents","training","account"]);
run('state.role="director";state.site="marzin";render()');
assert.equal(run('scoped(data.signals).every(s=>s.site_id==="marzin")'),true);
assert.doesNotMatch(fakeNode("siteSelect").innerHTML,/Europlacage/);
run('state.view="pilotage";render()');assert.match(fakeNode("appView").innerHTML,/Tendance TRS|TRS/);assert.match(fakeNode("appView").innerHTML,/Rebut/);assert.match(fakeNode("appView").innerHTML,/Service client/);
run('state.view="audits";render()');assert.match(fakeNode("appView").innerHTML,/50 critères/);assert.match(fakeNode("appView").innerHTML,/Audit Terrain/i);
const auditCount=run('data.audits.length');
run('state.role="lean";state.site="marzin";auditForm()');
fakeNode("auditScope").value="Atelier test";fakeNode("auditOwner").value="Responsable test";fakeNode("auditAuditor").value="Auditeur test";fakeNode("auditDate").value="2026-09-23";fakeNode("auditType").value="Audit Terrain BIA";fakeNode("auditSite").value="marzin";fakeNode("auditSummary").value="Brouillon test";
fakeNode("saveAuditDraft").onclick();assert.equal(run('data.audits.length'),auditCount+1);assert.equal(run('data.audits[0].status'),"Brouillon");
run('data.audits.unshift({id:"AUD-999",site_id:"marzin",type:"Audit Terrain BIA",scope:"Test",score:null,status:"Brouillon",performed_at:"2026-09-23",owner:"Test",updated_at:new Date().toISOString(),audit_data:{criteria:[],proof_count:0}});render()');assert.match(fakeNode("appView").innerHTML,/audit\(s\) à reprendre/);assert.match(fakeNode("appView").innerHTML,/Continuer AUD-999/);
run('state.view="resolution";state.selectedProblemId="P-999";data.problems.push({id:"P-999",site_id:"marzin",title:"Second problème",method:"8D",status:"Cadrage",owner:"Test",signal_ids:[],action_ids:[],content:{}});render()');assert.match(fakeNode("appView").innerHTML,/Second problème/);assert.match(fakeNode("appView").innerHTML,/data-select-problem="P-012"/);
run('state.view="documents";render()');assert.match(fakeNode("appView").innerHTML,/data-open-document="DOC-001"/);assert.match(fakeNode("appView").innerHTML,/Choisir un modèle/);
assert.equal(run('TEMPLATES.every(t=>DOCUMENT_SCHEMAS[t.type])'),true);
assert.equal(run('DOCUMENT_SCHEMAS.A3.fields.length'),11);assert.equal(run('DOCUMENT_SCHEMAS["8D"].fields.length'),10);assert.equal(run('DOCUMENT_SCHEMAS.ISHIKAWA.fields.length'),10);
run('editDocument("DOC-001")');assert.match(fakeNode("modalContent").innerHTML,/A3 de résolution de problème/);assert.match(fakeNode("modalContent").innerHTML,/Cause racine prouvée/);assert.match(fakeNode("modalContent").innerHTML,/data-doc-field="effectiveness"/);
run('closeModal();state.role="lean";state.site="group";state.view="training";state.trainingTab="catalog";render()');assert.match(fakeNode("appView").innerHTML,/Formation et qualification/);assert.match(fakeNode("appView").innerHTML,/Fondamentaux Lean/);assert.equal(run('data.trainingCatalog.length'),15);
run('state.site="marzin";state.trainingTab="matrix";render()');assert.match(fakeNode("appView").innerHTML,/Matrice de compétences/);assert.match(fakeNode("appView").innerHTML,/BIA-0001/);
run('openTrainingPerson("PER-001")');assert.match(fakeNode("modalContent").innerHTML,/Fiche individuelle de formation et qualification/);assert.match(fakeNode("modalContent").innerHTML,/Validation RH/);
run('state.view="sqcdp";render()');assert.match(fakeNode("appView").innerHTML,/data-open-subject=/);
run('state.role="lean";state.site="marzin";state.view="tools";state.toolId=null;render()');assert.match(fakeNode("appView").innerHTML,/Mes démarches/);
run('startTool("smed")');assert.ok(run('data.toolRuns.some(r=>r.module_id==="smed"&&r.site_id==="marzin")'));assert.match(fakeNode("appView").innerHTML,/À faire maintenant/);assert.match(fakeNode("appView").innerHTML,/Bibliothèque → Mes démarches/);

assert.match(fs.readFileSync("service-worker.js","utf8"),/v5\.js/);
assert.match(fs.readFileSync("service-worker.js","utf8"),/lean-library\.js/);
assert.match(fs.readFileSync("service-worker.js","utf8"),/v6-0/);
assert.match(fs.readFileSync("index.html","utf8"),/v5\.js\?v=6\.0/);
assert.doesNotMatch(fs.readFileSync("index.html","utf8"),/src="(?:library|app)\.js"|href="styles\.css"/);
for(const file of ["v5.js","lean-library.js","README.md"])assert.doesNotMatch(fs.readFileSync(file,"utf8"),/\bSite [1-9]\b/);
console.log("PASS: référentiel BIA, 30 outils, documents méthodologiques, formation RH, audit 50 critères, droits, persistance, cycle Signal, chantiers, A3/8D et cache.");
