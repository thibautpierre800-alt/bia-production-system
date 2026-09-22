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
run(fs.readFileSync("v5.js","utf8"));

assert.match(fakeNode("appView").innerHTML,/Aujourd’hui à Marzin/);
assert.deepEqual(Array.from(run("OPERATIONAL_SITES.map(s=>s.name)")),["Ag Déco","Europlacage","Marzin","Oraison Menuiserie","Profiline","Sodeplax"]);
assert.equal(run('SITES.some(s=>/^Site [1-9]/.test(s.name))'),false);
assert.equal(run('NAV.some(n=>n.label==="Indicateurs")'),false);
assert.equal(run('NAV.some(n=>/100 premiers jours/i.test(n.label))'),false);

for(const id of Array.from(run('ROLES.lean.nav'))){
  run(`state.view="${id}";render()`);
  assert.ok(fakeNode("appView").innerHTML.length>80,`écran ${id}`);
}

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

run('state.role="terrain";state.site="marzin";state.view="home";render()');
assert.deepEqual(Array.from(run("visibleNav().map(n=>n.id)")),["home","sqcdp","actions","terrain","documents","account"]);
run('state.role="director";state.site="marzin";render()');
assert.equal(run('scoped(data.signals).every(s=>s.site_id==="marzin")'),true);
assert.doesNotMatch(fakeNode("siteSelect").innerHTML,/Europlacage/);

assert.match(fs.readFileSync("service-worker.js","utf8"),/v5\.js/);
assert.doesNotMatch(fs.readFileSync("index.html","utf8"),/library\.js|app\.js|styles\.css/);
console.log("PASS: référentiel BIA, 10 écrans, droits, persistance, cycle Signal, traçabilité problème/document, SQCDP et cache V5.");
