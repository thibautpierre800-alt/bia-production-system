const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const values=new Map(),nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:"",textContent:"",value:"",hidden:false,files:[],classList:{toggle(){}},addEventListener(){},focus(){},previousElementSibling:{classList:{toggle(){}}}});return nodes.get(id)};
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
const context=vm.createContext({console,Date,Math,JSON,Number,String,Set,Object,Array,RegExp,Promise,localStorage,window:{addEventListener(){},scrollTo(){}},navigator:{},document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>node("query"),addEventListener(){}},setTimeout:()=>1,clearTimeout(){},Blob,URL,confirm:()=>false});
function run(code){return vm.runInContext(code,context)}
run(fs.readFileSync("library.js","utf8"));run(fs.readFileSync("app.js","utf8"));
assert.match(node("homeView").innerHTML,/Cockpit/);
for(const id of run("NAV.map(x=>x[0])")){run(`switchView("${id}")`);assert.ok(node(id+"View").innerHTML.length>20,id)}
for(const id of run("TOOL_MODULES.map(x=>x.id)")){assert.ok(run(`renderToolDetail(toolkitModule("${id}"))`).length>100,id)}
assert.equal(run("CLOUD_ENABLED"),false,"unvalidated cloud disabled");
run('data.gembas.push({id:"test-g",site_id:"marzin",action_id:"a1",finding:"Test"});saveLocal()');
assert.equal(JSON.parse(values.get("biaV5Data")).gembas.at(-1).action_id,"a1");
run('data=loadLocal()');assert.equal(run('data.gembas.at(-1).action_id'),"a1");
assert.throws(()=>run('validateImport({meta:{version:5}})'),/Collection/);
assert.throws(()=>run('const bad=clone(DEMO);bad.actions[0].id=`"><script>`;validateImport(bad)'),/Identifiant/);
run('validateImport(clone(DEMO))');
run('siteId="europlacage"');assert.equal(run("openActions().length"),0);
run('siteId="marzin";advanceAction("a1")');assert.equal(run('data.actions.find(x=>x.id==="a1").status'),"En cours");
assert.equal(JSON.parse(values.get("biaV5Data")).actions.find(x=>x.id==="a1").status,"En cours");
assert.equal(run('isOverdue({due_date:"2020-01-01",status:"Ouverte"})'),true);
assert.equal(run('isOverdue({due_date:"2020-01-01",status:"Clôturée"})'),false);
run('data.measurements=[]');assert.equal(run("latestMeasurement().trs"),null);
assert.match(run('metricCard("trs",null,"cible")'),/Aucune mesure/);
console.log("PASS: 10 écrans, 30 outils, persistance, liens Gemba/actions, isolation site, import, statuts et absence de mesures.");
