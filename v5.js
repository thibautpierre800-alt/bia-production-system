"use strict";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const clone=value=>JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const shortDate=value=>value?new Date(value).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
const STORAGE_KEY="biaProductionSystemV5";

const SITES=[
  {id:"group",name:"BIA Holding",kind:"group"},
  {id:"ag-deco",name:"Ag Déco",kind:"site"},
  {id:"europlacage",name:"Europlacage",kind:"site"},
  {id:"marzin",name:"Marzin",kind:"site"},
  {id:"oraison-menuiserie",name:"Oraison Menuiserie",kind:"site"},
  {id:"profiline",name:"Profiline",kind:"site"},
  {id:"sodeplax",name:"Sodeplax",kind:"site"}
];
const OPERATIONAL_SITES=SITES.filter(s=>s.kind==="site");
const ROLES={
  dg:{label:"Direction Générale Groupe",scope:"group",nav:["home","pilotage","actions","practices","account"]},
  lean:{label:"Responsable Lean Groupe",scope:"group",nav:["home","pilotage","sqcdp","actions","terrain","audits","resolution","practices","documents","account","settings"]},
  director:{label:"Directeur de site",scope:"site",nav:["home","pilotage","sqcdp","actions","terrain","audits","resolution","documents","account"]},
  terrain:{label:"Chef d’équipe / Opérateur",scope:"workshop",nav:["home","sqcdp","actions","terrain","documents","account"]}
};
const NAV=[
  {id:"home",icon:"⌂",label:"Accueil"},
  {id:"pilotage",icon:"↗",label:"Pilotage"},
  {id:"sqcdp",icon:"▦",label:"SQCDP Atelier"},
  {id:"actions",icon:"✓",label:"Actions"},
  {id:"terrain",icon:"!",label:"Terrain"},
  {id:"audits",icon:"◎",label:"Audits"},
  {id:"resolution",icon:"◇",label:"Résolution"},
  {id:"practices",icon:"✦",label:"Bonnes pratiques"},
  {id:"documents",icon:"▤",label:"Documents"},
  {id:"account",icon:"●",label:"Compte"},
  {id:"settings",icon:"⚙",label:"Paramètres"}
];
const SIGNAL_STATES=["Nouveau","Pris en compte","Action en cours","Résolu","Vérifié","Clos"];
const ACTION_STATES=["Ouverte","En cours","À vérifier","Clôturée"];
const SIGNAL_TYPES=["Sécurité","Qualité","Production","Flux","Maintenance","Standard","Autre"];
const AXES={
  S:{label:"Sécurité",color:"#b83232"},
  Q:{label:"Qualité",color:"#a86500"},
  C:{label:"Pertes / TRS",color:"#286087"},
  D:{label:"Délai",color:"#6b5aa6"},
  P:{label:"Personnel",color:"#197443"}
};

const DEMO={
  meta:{schema:6,demo:true,created_at:now(),updated_at:now(),sequoia:"inactive"},
  workshops:[
    {id:"marzin-pilot",site_id:"marzin",name:"Atelier pilote"},
    {id:"ag-deco-main",site_id:"ag-deco",name:"Atelier principal"},
    {id:"europlacage-main",site_id:"europlacage",name:"Atelier principal"},
    {id:"oraison-main",site_id:"oraison-menuiserie",name:"Atelier principal"},
    {id:"profiline-main",site_id:"profiline",name:"Atelier principal"},
    {id:"sodeplax-main",site_id:"sodeplax",name:"Atelier principal"}
  ],
  measures:[
    {id:"m1",site_id:"marzin",workshop_id:"marzin-pilot",axis:"S",code:"safety_signal",label:"Signal sécurité critique",value:1,unit:"",target:0,trend:null,period:"2026-09-22",source:"Saisie atelier",synced_at:"2026-09-22T08:05:00Z"},
    {id:"m2",site_id:"marzin",workshop_id:"marzin-pilot",axis:"Q",code:"scrap",label:"Rebut",value:4.1,unit:"%",target:3,trend:.6,period:"2026-09-22",source:"Saisie atelier",synced_at:"2026-09-22T08:05:00Z"},
    {id:"m3",site_id:"marzin",workshop_id:"marzin-pilot",axis:"C",code:"trs",label:"TRS",value:78.6,unit:"%",target:85,trend:-1.4,period:"2026-09-22",source:"Saisie atelier",synced_at:"2026-09-22T08:05:00Z"},
    {id:"m4",site_id:"marzin",workshop_id:"marzin-pilot",axis:"D",code:"service",label:"Service client",value:null,unit:"%",target:null,trend:null,period:"2026-09-22",source:"À définir",synced_at:null},
    {id:"m5",site_id:"marzin",workshop_id:"marzin-pilot",axis:"P",code:"staffing",label:"Couverture effectif",value:null,unit:"%",target:null,trend:null,period:"2026-09-22",source:"Non renseigné",synced_at:null}
  ],
  trends:[
    {site_id:"marzin",code:"trs",values:[79.2,80.4,77.3,81.1,79.7,78.6],labels:["S34","S35","S36","S37","S38","S39"],target:85,source:"Saisie manuelle · scénario"},
    {site_id:"marzin",code:"scrap",values:[3.5,3.7,4.4,3.8,4.0,4.1],labels:["S34","S35","S36","S37","S38","S39"],target:3,source:"Saisie manuelle · scénario"}
  ],
  signals:[
    {id:"S-041",site_id:"marzin",workshop_id:"marzin-pilot",zone:"Poste finition",type:"Sécurité",description:"La protection du poste est détériorée.",severity:"Critique",state:"Nouveau",immediate_action:"Poste sécurisé dans l’attente de l’examen.",author:"Équipe matin",created_at:"2026-09-22T07:42:00Z",updated_at:"2026-09-22T07:42:00Z",action_id:"A-018",problem_id:null},
    {id:"S-039",site_id:"marzin",workshop_id:"marzin-pilot",zone:"Contrôle",type:"Qualité",description:"Défauts de surface récurrents sur la série en cours.",severity:"Haute",state:"Action en cours",immediate_action:"Contrôle renforcé.",author:"Équipe soir",created_at:"2026-09-21T15:20:00Z",updated_at:"2026-09-22T06:55:00Z",action_id:null,problem_id:"P-012"},
    {id:"S-038",site_id:"marzin",workshop_id:"marzin-pilot",zone:"Support",type:"Standard",description:"Le contrôle du support n’est pas tracé.",severity:"Normale",state:"Résolu",immediate_action:"",author:"Équipe matin",created_at:"2026-09-20T10:10:00Z",updated_at:"2026-09-22T07:10:00Z",action_id:"A-019",problem_id:null},
    {id:"S-035",site_id:"marzin",workshop_id:"marzin-pilot",zone:"Flux",type:"Flux",description:"Accumulation temporaire avant contrôle.",severity:"Normale",state:"Vérifié",immediate_action:"Réorganisation du contenant.",author:"Équipe matin",created_at:"2026-09-18T08:30:00Z",updated_at:"2026-09-21T14:00:00Z",action_id:null,problem_id:null}
  ],
  actions:[
    {id:"A-018",site_id:"marzin",workshop_id:"marzin-pilot",title:"Sécuriser et examiner le poste",owner:"À désigner",priority:"Critique",status:"Ouverte",due_date:"2026-09-22",origin_type:"Signal",origin_id:"S-041",description:"Action issue du signal de protection détériorée.",effectiveness:null,created_at:"2026-09-22T07:45:00Z"},
    {id:"A-019",site_id:"marzin",workshop_id:"marzin-pilot",title:"Contrôler la tenue du support",owner:"Équipe Qualité",priority:"Haute",status:"À vérifier",due_date:"2026-09-22",origin_type:"A3",origin_id:"P-012",description:"Vérifier la tenue après remise en état.",effectiveness:null,created_at:"2026-09-21T10:00:00Z"},
    {id:"A-020",site_id:"marzin",workshop_id:"marzin-pilot",title:"Confirmer la tenue du standard",owner:"Animateur habilité",priority:"Normale",status:"En cours",due_date:"2026-09-26",origin_type:"Audit",origin_id:"AUD-004",description:"Observer trois cycles et joindre une preuve.",effectiveness:null,created_at:"2026-09-20T09:00:00Z"}
  ],
  problems:[
    {id:"P-012",site_id:"marzin",workshop_id:"marzin-pilot",title:"Défauts de surface récurrents",method:"A3",status:"Analyse",owner:"Équipe Qualité",signal_ids:["S-039"],action_ids:["A-019"],created_at:"2026-09-21T16:00:00Z",content:{context:"Défauts de surface sur la période observée. Périmètre à confirmer.",current:"Baseline illustrative : rebut 4,1 %. Source manuelle à qualifier.",target:"Cible illustrative : 3 %. À valider avec le propriétaire KPI.",causes:"Hypothèse : support dégradé. Test à documenter.",actions:"A-019 · Contrôler le support.",verification:"Résultat non mesuré. Période de tenue et vérificateur à définir.",standard:"Mise à jour du standard après preuve d’efficacité."}}
  ],
  decisions:[
    {id:"D-007",site_id:"marzin",title:"Soutenir un essai de sécurisation",detail:"Décision attendue du site",owner:"Direction de site",due_date:"2026-09-22",status:"Ouverte"},
    {id:"D-008",site_id:"europlacage",title:"Arbitrer la disponibilité d’un pilote",detail:"Sponsor Groupe demandé",owner:"Direction Générale",due_date:"2026-09-25",status:"Ouverte"}
  ],
  audits:[
    {id:"AUD-004",site_id:"marzin",type:"5S",scope:"Atelier pilote",score:68,status:"Terminé",performed_at:"2026-09-18",owner:"Animateur habilité"}
  ],
  gembas:[
    {id:"G-014",site_id:"marzin",workshop_id:"marzin-pilot",zone:"Contrôle",finding:"Le standard est disponible mais son point de contrôle n’est pas visible au poste.",category:"Standard",created_at:"2026-09-21T09:12:00Z",author:"Direction de site"}
  ],
  practices:[],
  documents:[
    {id:"DOC-001",site_id:"marzin",type:"A3",title:"P-012 · Défauts de surface",status:"Brouillon",problem_id:"P-012",updated_at:"2026-09-22T08:10:00Z",version:1}
  ],
  accounts:[
    {id:"U-001",name:"Pierre Thibaut",role:"lean",site_id:"group",workshop_id:null,status:"Actif"}
  ],
  syncLog:[],
  legacySnapshot:null
};

let state={
  role:localStorage.getItem("biaRole")||"lean",
  site:localStorage.getItem("biaSite")||"marzin",
  view:localStorage.getItem("biaView")||"home",
  terrainTab:"signals",
  resolutionTab:"problems",
  actionFilter:"all",
  timerStarted:null
};
let data=loadData();

function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved?.meta?.schema===6)return saved;
  }catch(error){console.warn("Données V5 illisibles",error)}
  const initial=clone(DEMO);
  try{
    const legacy=JSON.parse(localStorage.getItem("biaV5Data"));
    if(legacy?.meta?.version===5){
      const acceptedSites=new Set(OPERATIONAL_SITES.map(s=>s.id));
      const acceptedActions=(legacy.actions||[]).filter(x=>acceptedSites.has(x.site_id)).map(x=>({
        id:`LEG-${x.id}`,site_id:x.site_id,workshop_id:null,title:x.title||"Action reprise",
        owner:x.owner||"À désigner",priority:x.priority==="Basse"?"Normale":x.priority||"Normale",
        status:x.status==="Clôturée"?"Clôturée":x.status==="Ouverte"?"Ouverte":"En cours",
        due_date:x.due_date||null,origin_type:`Reprise ${x.origin_type||"V5 locale"}`,
        origin_id:x.id,description:x.description||"",effectiveness:null,created_at:x.created_at||now(),
        legacy_status:x.status||null
      }));
      const acceptedGembas=(legacy.gembas||[]).filter(x=>acceptedSites.has(x.site_id)).map(x=>({
        id:`LEG-${x.id}`,site_id:x.site_id,workshop_id:null,zone:x.workshop||"Périmètre repris",
        finding:x.finding||"Observation reprise",category:x.category||"Autre",
        created_at:x.observed_at||now(),author:"Reprise V5 locale"
      }));
      initial.actions.push(...acceptedActions);
      initial.gembas.push(...acceptedGembas);
      initial.meta.demo=legacy.meta.demo!==false;
      initial.legacySnapshot={
        captured_at:now(),source:"biaV5Data",migrated:{actions:acceptedActions.length,gembas:acceptedGembas.length},
        quarantined_sites:[...new Set([...(legacy.actions||[]),...(legacy.gembas||[])].filter(x=>x.site_id&&!acceptedSites.has(x.site_id)).map(x=>x.site_id))],
        collections:Object.fromEntries(Object.entries(legacy).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))
      };
    }
  }catch(error){console.warn("Archive locale antérieure non lisible",error)}
  return initial;
}
function save(){
  data.meta.updated_at=now();
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}
  catch(error){toast("Sauvegarde impossible. Exportez les données avant de continuer.");return false}
}
function site(){return SITES.find(s=>s.id===state.site)||SITES[0]}
function workshop(){return data.workshops.find(w=>w.site_id===state.site)||null}
function scoped(rows,{groupAllowed=true}={}){
  if(state.site==="group"&&groupAllowed)return rows;
  return rows.filter(r=>r.site_id===state.site);
}
function role(){return ROLES[state.role]||ROLES.lean}
function visibleNav(){return NAV.filter(n=>role().nav.includes(n.id))}
function isOpenSignal(s){return s.state!=="Clos"}
function isOpenAction(a){return a.status!=="Clôturée"}
function isLate(a){return a.due_date&&a.status!=="Clôturée"&&a.due_date<today()}
function signalTone(s){return s.severity==="Critique"?"critical":s.state==="Clos"?"done":s.state==="Résolu"||s.state==="Vérifié"?"progress":"open"}
function actionTone(a){return a.status==="Clôturée"?"done":a.status==="À vérifier"?"progress":a.status==="En cours"?"info":"open"}
function nextId(prefix,rows){
  const max=rows.reduce((m,r)=>Math.max(m,Number(String(r.id).match(/\d+/)?.[0]||0)),0);
  return `${prefix}-${String(max+1).padStart(3,"0")}`;
}
function toast(message){
  const node=$("toast");node.textContent=message;node.hidden=false;
  clearTimeout(window.biaToast);window.biaToast=setTimeout(()=>node.hidden=true,3600);
}
function pill(text,tone="neutral"){return `<span class="pill ${tone}">${esc(text)}</span>`}
function pageHead(kicker,title,lead,button=""){return `<div class="page-head"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p></div>${button}</div>`}
function empty(message){return `<div class="empty">${esc(message)}</div>`}
function getSiteName(id){return SITES.find(s=>s.id===id)?.name||"Site inconnu"}
function canGroup(){return ["dg","lean"].includes(state.role)}

function renderNav(){
  const nav=visibleNav();
  const html=nav.map(n=>`<button class="nav-button ${state.view===n.id?"active":""}" data-nav="${n.id}"><span class="nav-icon">${n.icon}</span>${esc(n.label)}</button>`).join("");
  $("desktopNav").innerHTML=html;
  $("mobileNav").innerHTML=nav.filter(n=>["home","pilotage","sqcdp","actions","terrain","account"].includes(n.id)).map(n=>`<button class="nav-button ${state.view===n.id?"active":""}" data-nav="${n.id}"><span class="nav-icon">${n.icon}</span>${esc(n.label)}</button>`).join("");
}
function renderContexts(){
  const assignedSite=state.site==="group"?"marzin":state.site;
  const sites=canGroup()?SITES:[SITES.find(s=>s.id===assignedSite)||SITES.find(s=>s.id==="marzin")];
  if(!sites.some(s=>s.id===state.site))state.site=state.role==="director"||state.role==="terrain"?"marzin":"group";
  $("siteSelect").innerHTML=sites.map(s=>`<option value="${s.id}" ${s.id===state.site?"selected":""}>${esc(s.name)}</option>`).join("");
  $("roleSelect").innerHTML=Object.entries(ROLES).map(([id,r])=>`<option value="${id}" ${id===state.role?"selected":""}>${esc(r.label)}</option>`).join("");
}
function switchView(id){
  if(!visibleNav().some(n=>n.id===id))id=visibleNav()[0]?.id||"home";
  state.view=id;localStorage.setItem("biaView",id);render();
  window.scrollTo({top:0,behavior:"smooth"});$("main").focus({preventScroll:true});
  $("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");
}
function render(){
  renderContexts();renderNav();
  if(!visibleNav().some(n=>n.id===state.view))state.view=visibleNav()[0]?.id||"home";
  const renderer={home:renderHome,pilotage:renderPilotage,sqcdp:renderSqcdp,actions:renderActions,terrain:renderTerrain,audits:renderAudits,resolution:renderResolution,practices:renderPractices,documents:renderDocuments,account:renderAccount,settings:renderSettings}[state.view];
  $("appView").innerHTML=renderer?renderer():"";
  $("dataMode").innerHTML=`<b>Version de travail V5</b> · Données locales sur cet appareil · SEQUOIA : non connecté · ${data.meta.demo?"Exemples fictifs clairement identifiés":"Espace réel"}`;
  bind();
}

function homeCards(){
  const signals=scoped(data.signals).filter(isOpenSignal);
  const actions=scoped(data.actions).filter(isOpenAction);
  const problems=scoped(data.problems).filter(p=>p.status!=="Clos");
  const critical=signals.filter(s=>s.severity==="Critique");
  return `<div class="grid cols-4 section">
    <article class="card"><div class="metric-label">Nouveaux signaux</div><div class="metric-value">${signals.filter(s=>s.state==="Nouveau").length}</div><div class="metric-foot">À prendre en compte</div></article>
    <article class="card"><div class="metric-label">Signaux ouverts</div><div class="metric-value">${signals.length}</div><div class="metric-foot ${critical.length?"bad":""}">${critical.length} critique(s)</div></article>
    <article class="card"><div class="metric-label">Actions prioritaires</div><div class="metric-value">${actions.filter(a=>["Critique","Haute"].includes(a.priority)).length}</div><div class="metric-foot">${actions.filter(isLate).length} en retard</div></article>
    <article class="card"><div class="metric-label">Problèmes ouverts</div><div class="metric-value">${problems.length}</div><div class="metric-foot">A3 / 8D / QRQC</div></article>
  </div>`;
}
function renderHome(){
  if(state.site==="group"||state.role==="dg"){
    const decisions=data.decisions.filter(d=>d.status!=="Clos");
    return `${pageHead("Accueil Groupe","Les décisions du Groupe","Une synthèse volontairement courte : risques, décisions et accompagnement des six entités.",'<button class="btn" data-nav="pilotage">Ouvrir le pilotage</button>')}
      <section class="hero"><p class="eyebrow">BIA Holding · Aujourd’hui</p><h1>${decisions.length} décision(s) attendue(s), ${data.signals.filter(s=>s.severity==="Critique"&&isOpenSignal(s)).length} risque(s) critique(s) ouvert(s)</h1><p>Les indicateurs Groupe ne seront consolidés qu’après validation de leurs définitions, périmètres et pondérations.</p><div class="hero-actions"><button class="btn" data-nav="pilotage">Voir les écarts</button><button class="btn secondary" data-nav="actions">Actions stratégiques</button></div></section>
      ${homeCards()}
      <div class="grid main-aside section"><section><div class="section-title"><h2>Décider et débloquer</h2><span class="badge">${decisions.length} ouverts</span></div><div class="list">${decisions.map(decision=>`<article class="row"><div class="row-top"><div><div class="row-title">${esc(decision.title)}</div><div class="row-meta">${esc(getSiteName(decision.site_id))} · ${esc(decision.owner)} · ${shortDate(decision.due_date)}</div></div>${pill(decision.id,"progress")}</div></article>`).join("")||empty("Aucune décision ouverte.")}</div></section>
      <section class="panel"><div class="section-title"><h2>Réseau des six entités</h2></div><div class="list">${OPERATIONAL_SITES.map(s=>`<button class="row" data-set-site="${s.id}" style="text-align:left;border:1px solid var(--line)"><b>${esc(s.name)}</b><span class="row-meta" style="display:block">Ouvrir le site →</span></button>`).join("")}</div></section></div>`;
  }
  const signals=scoped(data.signals).filter(isOpenSignal);
  const actions=scoped(data.actions).filter(isOpenAction);
  const priorities=[...signals.filter(s=>s.severity==="Critique").map(s=>({id:s.id,title:s.description,meta:`Signal · ${s.type} · ${s.state}`,tone:"critical"})),...actions.filter(a=>["Critique","Haute"].includes(a.priority)).map(a=>({id:a.id,title:a.title,meta:`Action · ${a.owner} · ${a.status}`,tone:actionTone(a)}))].slice(0,5);
  return `${pageHead("Accueil Site",`Aujourd’hui à ${site().name}`,"Priorités, signaux et décisions du périmètre autorisé.",'<button class="btn" data-new-signal>＋ SIGNAL TERRAIN</button>')}
    <section class="hero"><p class="eyebrow">${esc(site().name)} · ${esc(workshop()?.name||"Tous les ateliers")}</p><h1>${priorities.length} sujet(s) demandent une réaction aujourd’hui</h1><p>Un signal est capturé une seule fois, puis suit son cycle jusqu’à la vérification d’efficacité.</p><div class="hero-actions"><button class="btn" data-new-signal>＋ NOUVEAU SIGNAL TERRAIN</button><button class="btn secondary" data-nav="sqcdp">Ouvrir SQCDP / TOP 15</button></div></section>
    ${homeCards()}
    <div class="grid main-aside section"><section><div class="section-title"><h2>Ce qui demande une réaction</h2></div><div class="list">${priorities.map(p=>`<article class="row"><div class="row-top"><div><div class="row-title">${esc(p.title)}</div><div class="row-meta">${esc(p.meta)}</div></div>${pill(p.id,p.tone)}</div></article>`).join("")||empty("Aucun sujet prioritaire.")}</div></section>
    <section class="panel"><h2>Prochain point quotidien</h2><p class="hint">${esc(workshop()?.name||"Atelier à sélectionner")}</p><div class="metric-value">${topSubjects().length} sujets</div><button class="btn" data-nav="sqcdp">Ouvrir SQCDP / TOP 15</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Raccourcis</h3><p class="hint">Gemba → Actions → Résolution → Documents</p></section></div>`;
}

function lineChart(series,title){
  if(!series||!series.values?.length)return empty("Aucune série disponible.");
  const w=720,h=230,p=38,values=series.values,all=[...values,series.target].filter(v=>Number.isFinite(v));
  const min=Math.floor(Math.min(...all)-5),max=Math.ceil(Math.max(...all)+5),x=i=>p+i*(w-p*2)/Math.max(1,values.length-1),y=v=>h-p-(v-min)*(h-p*2)/(max-min||1);
  const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  return `<div class="chart-wrap"><svg class="line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
    <g class="chart-grid">${[0,1,2,3].map(i=>`<line x1="${p}" y1="${p+i*(h-p*2)/3}" x2="${w-p}" y2="${p+i*(h-p*2)/3}"/>`).join("")}</g>
    ${Number.isFinite(series.target)?`<line class="chart-target" x1="${p}" y1="${y(series.target)}" x2="${w-p}" y2="${y(series.target)}"/><text class="chart-value" x="${w-p-55}" y="${y(series.target)-6}">Cible ${series.target}%</text>`:""}
    <polyline class="chart-line" points="${points}"/>${values.map((v,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(v)}" r="5"/><text class="chart-value" x="${x(i)-10}" y="${y(v)-10}">${v}</text><text class="chart-label" x="${x(i)-10}" y="${h-8}">${esc(series.labels[i]||"")}</text>`).join("")}
  </svg></div>`;
}
function renderPilotage(){
  const currentSite=state.site==="group"?"marzin":state.site;
  const trs=data.trends.find(t=>t.site_id===currentSite&&t.code==="trs");
  const openCritical=data.signals.filter(s=>(state.site==="group"||s.site_id===state.site)&&s.severity==="Critique"&&isOpenSignal(s));
  if(state.site==="group"){
    return `${pageHead("Pilotage Groupe","Comprendre avant de comparer","Les classements sont bloqués tant que définitions, couverture et pondérations ne sont pas comparables.")}
      <div class="alert"><b>TRS Groupe non consolidable à ce stade.</b> Les sources et règles de calcul restent à qualifier pour les six entités.</div>
      <div class="grid main-aside section"><section class="panel"><div class="section-title"><div><h2>Tendance du site sélectionné : Marzin</h2><p class="hint">${esc(trs?.source||"Source à définir")}</p></div>${pill("Exemple fictif","progress")}</div>${lineChart(trs,"Tendance TRS du site Marzin")}</section>
      <aside class="panel"><h2>Décisions et couverture</h2><div class="metric-value">${openCritical.length}</div><p class="bad">risque(s) critique(s) ouvert(s)</p><p class="hint">Couverture KPI Groupe : à qualifier. Aucune moyenne simple des pourcentages n’est affichée.</p><button class="btn" data-nav="actions">Voir les décisions</button></aside></div>
      <section class="section"><div class="section-title"><h2>État des sources</h2><span class="badge">6 entités</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Entité</th><th>TRS</th><th>Rebut</th><th>Service</th><th>Décision</th></tr></thead><tbody>${OPERATIONAL_SITES.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${s.id==="marzin"?"78,6 % · manuel":"À qualifier"}</td><td>${s.id==="marzin"?"4,1 % · manuel":"À qualifier"}</td><td>Définition à valider</td><td>${data.decisions.some(d=>d.site_id===s.id)?pill("À arbitrer","progress"):pill("Sans donnée","neutral")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  const scrap=data.trends.find(t=>t.site_id===state.site&&t.code==="scrap");
  const last=trs?.values.at(-1),delta=trs?+(last-trs.values.at(-2)).toFixed(1):null;
  return `${pageHead("Pilotage Site",`Pilotage de ${site().name}`,"La tendance, l’écart, sa fiabilité et la prochaine décision sur une seule page.")}
    <div class="grid main-aside"><section class="panel"><div class="section-title"><div><h2>TRS · ${last??"—"} %</h2><p class="hint">Cible illustrative 85 % · Écart ${last!=null?(last-85).toFixed(1):"—"} pt · Tendance ${delta??"—"} pt</p></div>${pill("MANUEL · scénario","progress")}</div>${lineChart(trs,`Tendance TRS ${site().name}`)}</section>
    <aside class="panel"><h2>Agir sur les écarts</h2>${scoped(data.signals).filter(s=>s.severity==="Critique"&&isOpenSignal(s)).map(s=>`<div class="alert critical"><b>${esc(s.id)} · ${esc(s.description)}</b><p>Sécuriser, attribuer et décider de la suite.</p><button class="btn small" data-open-signal="${s.id}">Ouvrir le sujet</button></div>`).join("")||empty("Aucun signal critique.")}<div class="section"><h3>Fiabilité de la donnée</h3><p class="hint">Source, période, auteur et dernière réception accessibles sur chaque mesure.</p></div></aside></div>
    <div class="grid cols-3 section"><article class="card"><div class="metric-label">Rebut</div><div class="metric-value">${scrap?.values.at(-1)??"—"} %</div><div class="metric-foot bad">Cible illustrative ≤ 3 %</div></article><article class="card"><div class="metric-label">Service client</div><div class="metric-value">—</div><div class="metric-foot">OTD / OTF / OTIF : définition à valider</div></article><article class="card"><div class="metric-label">Source</div><div class="metric-value" style="font-size:20px">Saisie atelier</div><div class="metric-foot">Dernière réception illustrative : 08:05</div></article></div>`;
}

function measureFor(axis){return scoped(data.measures,{groupAllowed:false}).find(m=>m.axis===axis)}
function measureStatus(m){
  if(!m||m.value==null||m.target==null)return {text:"Non disponible",tone:"neutral"};
  const bad=m.code==="scrap"?m.value>m.target:m.value<m.target;
  return bad?{text:"Écart",tone:"open"}:{text:"Conforme",tone:"done"};
}
function topSubjects(){
  if(state.site==="group")return [];
  const signals=scoped(data.signals).filter(isOpenSignal).filter(s=>s.state!=="Vérifié");
  const actions=scoped(data.actions).filter(isOpenAction).filter(a=>a.status==="À vérifier"||["Critique","Haute"].includes(a.priority));
  const decisions=data.decisions.filter(d=>d.site_id===state.site&&d.status!=="Clos");
  return [
    ...signals.map(s=>({id:s.id,category:s.type,title:s.description,next:s.state==="Nouveau"?"Sécuriser / attribuer":"Traiter selon décision",due:"Aujourd’hui",priority:s.severity})),
    ...actions.map(a=>({id:a.id,category:"Action",title:a.title,next:a.status==="À vérifier"?"Vérifier l’efficacité":a.owner,due:a.due_date?shortDate(a.due_date):"À dater",priority:a.priority})),
    ...decisions.map(d=>({id:d.id,category:"Décision",title:d.title,next:"Escalader si nécessaire",due:shortDate(d.due_date),priority:"Arbitrage"}))
  ].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,8);
}
function renderSqcdp(){
  if(state.site==="group")return `${pageHead("SQCDP Atelier","Sélectionner un site","Le SQCDP est un écran atelier. Choisissez une entité opérationnelle dans le sélecteur de périmètre.")}<div class="grid cols-3">${OPERATIONAL_SITES.map(s=>`<button class="card" data-set-site="${s.id}" style="text-align:left"><h2>${esc(s.name)}</h2><p class="hint">Ouvrir le SQCDP →</p></button>`).join("")}</div>`;
  const subjects=topSubjects(),elapsed=state.timerStarted?Math.floor((Date.now()-state.timerStarted)/1000):0;
  return `${pageHead("Point quotidien",`SQCDP Atelier · ${site().name}`,`${workshop()?.name||"Atelier à qualifier"} · Animation 10 à 15 minutes`,'<button class="btn" data-new-signal>＋ SIGNAL TERRAIN</button>')}
    <div class="alert">Source affichée pour chaque KPI. Les axes D et P restent vides tant que les indicateurs utiles et les données ne sont pas validés.</div>
    <div class="sqcdp-grid section">${Object.entries(AXES).map(([axis,def])=>{const m=measureFor(axis),st=measureStatus(m);return `<article class="sqcdp-card" style="--axis:${def.color}"><h3><span class="axis-letter">${axis}</span> ${esc(def.label)}</h3><div class="metric-label">${esc(m?.label||"Indicateur à définir")}</div><div class="sqcdp-value">${m?.value==null?"—":esc(m.value)} <small>${esc(m?.unit||"")}</small></div><div class="sqcdp-detail">${m?.target==null?"Cible à définir":`Cible : ${m.target} ${esc(m.unit)}`}<br>${m?.trend==null?"Tendance à qualifier":`Tendance : ${m.trend>0?"↗":"↘"} ${m.trend>0?"+":""}${m.trend} pt`}</div><div style="margin-top:8px">${pill(st.text,st.tone)}</div><span class="source-label">${esc(m?.source||"Aucune source")}</span></article>`}).join("")}</div>
    <section class="section"><div class="section-title"><div><h2>À traiter aujourd’hui</h2><p class="hint">${subjects.length} sujet(s) utile(s), aucune ligne ajoutée pour atteindre artificiellement 15.</p></div><div><span class="timer">${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}</span> <button class="btn small secondary" data-timer>${state.timerStarted?"Arrêter":"Démarrer"} le point</button></div></div>
    <div class="list">${subjects.map((s,i)=>`<article class="row top15-row"><b>${i+1} · ${esc(s.category)}</b><div><div class="row-title">${esc(s.title)}</div><div class="row-meta">${esc(s.id)}</div></div><div>${esc(s.next)}</div><b class="nowrap">${esc(s.due)}</b>${pill(s.priority,s.priority==="Critique"?"critical":"progress")}</article>`).join("")||empty("Aucun sujet à traiter aujourd’hui.")}</div></section>`;
}

function renderActions(){
  let actions=scoped(data.actions);
  if(state.actionFilter==="late")actions=actions.filter(isLate);
  if(state.actionFilter==="verify")actions=actions.filter(a=>a.status==="À vérifier");
  if(state.actionFilter==="mine")actions=actions.filter(a=>a.owner.includes("Pierre"));
  return `${pageHead("Plan d’actions","Une action unique, quelle que soit son origine","Une action créée depuis un signal, un audit ou un A3 reste visible ici avec son lien d’origine.",'<button class="btn" data-new-action>＋ Nouvelle action</button>')}
    <div class="filters">${[["all","Toutes"],["late","En retard"],["verify","À vérifier"],["mine","Mes actions"]].map(([id,label])=>`<button class="chip ${state.actionFilter===id?"active":""}" data-action-filter="${id}">${label}</button>`).join("")}</div>
    <div class="kanban">${ACTION_STATES.map(status=>{const rows=actions.filter(a=>a.status===status);return `<section class="kanban-col"><h3>${status}<span class="badge">${rows.length}</span></h3><div class="list">${rows.map(a=>actionCard(a)).join("")||empty("Aucune action")}</div></section>`}).join("")}</div>`;
}
function actionCard(a){return `<article class="row"><div class="row-top"><span class="pill ${a.priority==="Critique"?"critical":a.priority==="Haute"?"progress":"neutral"}">${esc(a.id)}</span>${isLate(a)?pill("En retard","open"):""}</div><div class="row-title" style="margin-top:8px">${esc(a.title)}</div><div class="row-meta">${esc(a.owner||"À désigner")} · ${esc(a.origin_type)} ${esc(a.origin_id||"")} · ${shortDate(a.due_date)}</div><div class="row-actions"><button class="btn small secondary" data-edit-action="${a.id}">Ouvrir</button>${a.status!=="Clôturée"?`<button class="btn small ghost" data-advance-action="${a.id}">${a.status==="À vérifier"?"Vérifier":"Faire avancer"}</button>`:""}</div></article>`}

function signalStats(){
  const rows=scoped(data.signals);
  return {new:rows.filter(s=>s.state==="Nouveau").length,open:rows.filter(isOpenSignal).length,critical:rows.filter(s=>s.severity==="Critique"&&isOpenSignal(s)).length,progress:rows.filter(s=>s.state==="Action en cours").length,resolved:rows.filter(s=>["Résolu","Vérifié","Clos"].includes(s.state)).length};
}
function renderTerrain(){
  const stats=signalStats();
  const tabs=`<div class="tabs"><button class="tab ${state.terrainTab==="signals"?"active":""}" data-terrain-tab="signals">Signal Terrain</button><button class="tab ${state.terrainTab==="gemba"?"active":""}" data-terrain-tab="gemba">Gemba</button><button class="tab ${state.terrainTab==="stats"?"active":""}" data-terrain-tab="stats">Statistiques</button></div>`;
  if(state.terrainTab==="gemba")return `${pageHead("Terrain","Gemba","Observer un fait au poste sans supposer la cause.",'<button class="btn" data-new-gemba>＋ Nouveau Gemba</button>')}${tabs}${renderGembaList()}`;
  if(state.terrainTab==="stats")return `${pageHead("Terrain","Statistiques Signal Terrain","Analyser les récurrences et les délais, sans décourager les remontées.")}${tabs}${renderSignalStats(stats)}`;
  const rows=scoped(data.signals).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return `${pageHead("Terrain","Signal Terrain","Créer en moins d’une minute, traiter, vérifier puis clore.",'<button class="btn" data-new-signal>＋ NOUVEAU SIGNAL TERRAIN</button>')}${tabs}
    <div class="grid cols-4"><article class="card"><div class="metric-label">Nouveaux</div><div class="metric-value">${stats.new}</div></article><article class="card"><div class="metric-label">Ouverts</div><div class="metric-value">${stats.open}</div></article><article class="card"><div class="metric-label">Critiques</div><div class="metric-value ${stats.critical?"bad":""}">${stats.critical}</div></article><article class="card"><div class="metric-label">Résolus / vérifiés / clos</div><div class="metric-value">${stats.resolved}</div></article></div>
    <section class="section"><div class="section-title"><h2>Registre des signaux</h2><span class="badge">${rows.length}</span></div><div class="list">${rows.map(signalCard).join("")||empty("Aucun signal.")}</div></section>`;
}
function signalCard(s){return `<article class="row"><div class="row-top"><div>${pill(s.id,signalTone(s))} ${pill(s.type,"info")} ${pill(s.severity,s.severity==="Critique"?"critical":"neutral")}</div>${pill(s.state,signalTone(s))}</div><div class="row-title" style="margin-top:9px">${esc(s.description)}</div><div class="row-meta">${esc(getSiteName(s.site_id))} · ${esc(s.zone||"Zone non précisée")} · ${shortDate(s.created_at)} · ${esc(s.author||"Auteur non précisé")}</div><div class="row-actions"><button class="btn small secondary" data-open-signal="${s.id}">Ouvrir</button>${s.state!=="Clos"?`<button class="btn small ghost" data-advance-signal="${s.id}">Étape suivante</button>`:""}</div></article>`}
function renderGembaList(){
  const rows=scoped(data.gembas).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return `<div class="grid main-aside"><section><div class="section-title"><h2>Observations récentes</h2><span class="badge">${rows.length}</span></div><div class="list">${rows.map(g=>`<article class="row"><div class="row-top">${pill(g.category,"info")}<span class="row-meta">${shortDate(g.created_at)}</span></div><div class="row-title" style="margin-top:8px">${esc(g.finding)}</div><div class="row-meta">${esc(g.zone)} · ${esc(g.author)}</div></article>`).join("")||empty("Aucune observation Gemba.")}</div></section><aside class="panel"><h2>Règle de terrain</h2><p class="hint">Décrire le fait, le lieu et le moment. La cause reste une hypothèse tant qu’elle n’est pas testée.</p><button class="btn" data-new-gemba>Faire un Gemba</button></aside></div>`;
}
function renderSignalStats(stats){
  const rows=scoped(data.signals),byType=SIGNAL_TYPES.map(type=>({type,count:rows.filter(s=>s.type===type).length})).filter(x=>x.count);
  return `<div class="grid cols-4"><article class="card"><div class="metric-label">Nouveaux</div><div class="metric-value">${stats.new}</div></article><article class="card"><div class="metric-label">Ouverts</div><div class="metric-value">${stats.open}</div></article><article class="card"><div class="metric-label">En cours</div><div class="metric-value">${stats.progress}</div></article><article class="card"><div class="metric-label">Critiques</div><div class="metric-value">${stats.critical}</div></article></div><div class="grid cols-2 section"><section class="panel"><h2>Répartition par catégorie</h2><div class="list section">${byType.map(x=>`<div><div class="section-title"><b>${esc(x.type)}</b><span>${x.count}</span></div><div class="progress"><span style="width:${rows.length?x.count/rows.length*100:0}%"></span></div></div>`).join("")||empty("Pas de donnée.")}</div></section><section class="panel"><h2>Délais et récurrence</h2><div class="alert"><b>Calculs à activer avec des données réelles.</b> Les médianes distingueront prise en charge, résolution et vérification. Une hausse des remontées ne sera pas interprétée seule comme une dégradation.</div><p class="hint">Les analyses futures seront filtrables par semaine, mois, site, atelier, zone et catégorie.</p></section></div>`;
}

function renderAudits(){
  const rows=scoped(data.audits);
  return `${pageHead("Audits","Maturité, 5S et standards","Une preuve est requise pour chaque évaluation ; les écarts utiles alimentent le plan d’actions.",'<button class="btn" data-new-audit>＋ Nouvel audit</button>')}
    <div class="grid cols-3"><article class="card"><div class="metric-label">Audits réalisés</div><div class="metric-value">${rows.length}</div></article><article class="card"><div class="metric-label">Dernier score</div><div class="metric-value">${rows[0]?.score??"—"} <small>/ 100</small></div></article><article class="card"><div class="metric-label">Actions issues d’audit</div><div class="metric-value">${scoped(data.actions).filter(a=>a.origin_type==="Audit").length}</div></article></div>
    <section class="section"><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Périmètre</th><th>Score</th><th>Date</th><th>Responsable</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a.id)}</td><td>${esc(a.type)}</td><td>${esc(a.scope)}</td><td><b>${a.score}/100</b></td><td>${shortDate(a.performed_at)}</td><td>${esc(a.owner)}</td></tr>`).join("")||'<tr><td colspan="6">Aucun audit.</td></tr>'}</tbody></table></div></section>`;
}

function renderResolution(){
  const problems=scoped(data.problems);
  if(!problems.length)return `${pageHead("Résolution de problèmes","A3 · 8D · 5 Pourquoi · Ishikawa · QRQC","Créer un dossier depuis un signal évite toute ressaisie.",'<button class="btn" data-new-problem>＋ Nouveau problème</button>')}${empty("Aucun problème sur ce périmètre.")}`;
  const selected=problems[0],c=selected.content||{};
  const a3Steps=selected.method==="8D"
    ?[["D0 Préparation",c.context],["D1 Équipe",selected.owner],["D2 Problème",`${c.current||""} ${c.target||""}`],["D3 Contention",c.containment],["D4 Causes d’apparition et de non-détection",c.causes],["D5 Actions correctives",c.actions],["D6 Résultats",c.verification],["D7 Prévention",c.standard],["D8 Clôture","À valider après efficacité prouvée."]]
    :[["1–2 Identification et contexte",c.context],["3–5 État actuel et cible",`${c.current||""} ${c.target||""}`],["6–7 Causes et preuves",c.causes],["8–9 Contre-mesures et actions",c.actions],["10 Vérification d’efficacité",c.verification],["11 Standard et apprentissage",c.standard]];
  return `${pageHead("Résolution de problèmes","Comprendre, agir, vérifier","Le problème reste l’objet maître ; A3 et 8D sont des vues structurées du même dossier.",'<button class="btn" data-new-problem>＋ Nouveau problème</button>')}
    <div class="problem-layout"><aside class="problem-list">${problems.map((p,i)=>`<button class="${i===0?"active":""}"><b>${esc(p.id)}</b><br>${esc(p.title)}<br><small>${esc(p.method)} · ${esc(p.status)}</small></button>`).join("")}</aside>
    <section><div class="panel"><div class="row-top"><div><p class="eyebrow">${esc(selected.method)} · ${esc(selected.id)}</p><h2 style="margin:4px 0">${esc(selected.title)}</h2><p class="hint">${esc(getSiteName(selected.site_id))} · ${esc(selected.owner)} · ${selected.signal_ids.length} signal lié · ${selected.action_ids.length} action liée</p></div><button class="btn small" data-edit-problem="${selected.id}">Modifier</button></div><div class="workflow section">${["Cadrage","Analyse","Actions","Vérification","Standardisation","Clos"].map(x=>`<span class="workflow-step ${x===selected.status?"active":""}">${x}</span>`).join("")}</div></div>
    <div class="steps-grid section">${a3Steps.map(([title,text])=>`<article class="step-card"><h3>${esc(title)}</h3><p>${esc(text||"À compléter")}</p></article>`).join("")}</div>
    <div class="row-actions"><button class="btn secondary" data-document-from-problem="${selected.id}">Créer / ouvrir le document ${esc(selected.method)}</button><button class="btn secondary" data-new-action data-origin-id="${selected.id}">Ajouter une action liée</button></div></section></div>`;
}

function renderPractices(){
  const rows=scoped(data.practices);
  return `${pageHead("Bonnes pratiques","Prouver avant de déployer","Une pratique n’est publiée qu’après vérification du résultat et définition des conditions de transfert.",'<button class="btn" data-new-practice>＋ Proposer une pratique</button>')}
    <div class="grid cols-3">${rows.map(p=>`<article class="card document-card"><span class="document-icon">✦</span><h3>${esc(p.title)}</h3><p class="hint">${esc(p.summary)}</p><div>${pill(p.status,p.status==="Publiée"?"done":"progress")}</div><button class="btn secondary">Ouvrir</button></article>`).join("")||empty("Aucune bonne pratique publiée sur ce périmètre.")}</div>
    <div class="alert section"><b>Funnel cible :</b> Idée → Test local → Résultat vérifié → Standard candidat → Validation → Déploiement multisite.</div>`;
}

const TEMPLATES=[
  {type:"A3",group:"Résolution",title:"A3",desc:"Un problème, des faits, des causes et une vérification"},
  {type:"8D",group:"Résolution",title:"8D",desc:"Contenir puis prévenir la récurrence"},
  {type:"QRQC",group:"Résolution",title:"QRQC / fiche problème",desc:"Réaction qualité structurée"},
  {type:"5WHY",group:"Analyse",title:"5 Pourquoi",desc:"Analyse liée à un problème"},
  {type:"ISHIKAWA",group:"Analyse",title:"Ishikawa",desc:"Causes possibles à tester"},
  {type:"ACTION_PLAN",group:"Management",title:"Plan d’action",desc:"Vue imprimable d’actions existantes"},
  {type:"SQCDP",group:"Management",title:"SQCDP",desc:"Instantané daté du point quotidien"},
  {type:"ESCALATION",group:"Management",title:"Fiche d’escalade",desc:"Décision attendue et contexte"},
  {type:"GEMBA",group:"Terrain",title:"Gemba",desc:"Observation et preuve au poste"},
  {type:"5S",group:"Terrain",title:"Audit 5S",desc:"Audit versionné avec preuves"},
  {type:"STANDARD",group:"Terrain",title:"Standard de poste",desc:"Version, approbation et date d’effet"}
];
function renderDocuments(){
  const docs=scoped(data.documents);
  return `${pageHead("Bibliothèque","Documents opérationnels","Créer, remplir, reprendre, imprimer et exporter sans dupliquer les registres métier.")}
    <div class="tabs"><button class="tab active">Modèles</button><button class="tab">Mes documents (${docs.length})</button></div>
    <div class="grid cols-3">${TEMPLATES.map(t=>`<article class="card document-card"><span class="eyebrow">${esc(t.group)}</span><h3>${esc(t.title)}</h3><p class="hint">${esc(t.desc)}</p><button class="btn secondary" data-new-document="${t.type}">Créer un dossier</button></article>`).join("")}</div>
    <section class="section"><div class="section-title"><h2>Mes documents</h2><span class="badge">${docs.length}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Document</th><th>Site</th><th>Statut</th><th>Version</th><th>Mis à jour</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.id)}</td><td><b>${esc(d.title)}</b></td><td>${esc(getSiteName(d.site_id))}</td><td>${pill(d.status,d.status==="Validé"?"done":"progress")}</td><td>v${d.version}</td><td>${shortDate(d.updated_at)}</td></tr>`).join("")||'<tr><td colspan="6">Aucun document.</td></tr>'}</tbody></table></div></section>`;
}

function renderAccount(){
  const caps={dg:["Voir la synthèse Groupe","Arbitrer les décisions","Consulter les KPI et bonnes pratiques"],lean:["Accéder aux six sites","Animer le système Lean","Configurer les référentiels fonctionnels"],director:["Piloter le site attribué","Décider et escalader","Consulter les données de son site"],terrain:["Créer un Signal Terrain","Animer le TOP 15 selon habilitation","Voir les actions de son périmètre"]}[state.role];
  return `${pageHead("Compte","Profil et habilitations","L’interface et le périmètre dépendent du rôle ; aucune auto-attribution de droits.",state.role==="lean"?'<button class="btn" data-new-account>＋ Ajouter un compte</button>':"")}
    <div class="grid main-aside"><section class="panel account-role"><p class="eyebrow">Profil actif</p><h2>Pierre Thibaut</h2><p>${esc(role().label)}</p><p class="hint">Périmètre : ${esc(site().name)}${workshop()?` · ${esc(workshop().name)}`:""}</p><div class="check-list section">${caps.map(c=>`<div class="check">✓ ${esc(c)}</div>`).join("")}</div></section>
    <aside class="panel"><h2>Les quatre profils fonctionnels</h2><div class="list section">${Object.values(ROLES).map(r=>`<div class="row"><b>${esc(r.label)}</b><span class="row-meta" style="display:block">Périmètre ${esc(r.scope)}</span></div>`).join("")}</div></aside></div>
    ${state.role==="lean"?`<section class="section"><div class="section-title"><h2>Comptes déclarés</h2><span class="badge">${data.accounts.length}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Rôle</th><th>Périmètre</th><th>Statut</th></tr></thead><tbody>${data.accounts.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td>${esc(ROLES[a.role]?.label||a.role)}</td><td>${esc(getSiteName(a.site_id))}</td><td>${pill(a.status,a.status==="Actif"?"done":"neutral")}</td></tr>`).join("")}</tbody></table></div></section>`:""}
    <section class="panel section"><h2>Sauvegarde locale</h2><p class="hint">Exportez un fichier avant de changer d’appareil. L’import contrôle le schéma et conserve une sauvegarde avant remplacement.</p><div class="row-actions"><button class="btn secondary" data-export>Exporter les données</button><label class="btn secondary" style="display:inline-flex;align-items:center">Importer<input type="file" id="importFile" accept=".json,application/json" hidden></label></div></section>`;
}
function renderSettings(){
  return `${pageHead("Paramètres","Référentiels et intégrations","Fonctions réservées au Responsable Lean Groupe.")}
    <div class="grid cols-3"><article class="card"><div class="metric-label">Organisation</div><div class="metric-value">6 <small>sites</small></div><p class="hint">Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline, Sodeplax.</p></article><article class="card"><div class="metric-label">SEQUOIA</div><div class="metric-value" style="font-size:22px">Non connecté</div><p class="hint">API, base, exports, droits et fréquence restent à vérifier.</p></article><article class="card"><div class="metric-label">Journal de synchronisation</div><div class="metric-value">${data.syncLog.length}</div><p class="hint">Aucun flux automatique actif.</p></article></div>
    <section class="panel section"><h2>Contrat d’intégration futur</h2><div class="check-list"><div class="check">1. Extraire vers une zone de staging</div><div class="check">2. Valider unités, doublons, périmètre et fraîcheur</div><div class="check">3. Publier seulement les mesures acceptées</div><div class="check">4. Conserver source, horodatage et journal d’erreur</div><div class="check">5. Autoriser un secours manuel tracé</div></div></section>`;
}

function modal(title,content){
  $("modalContent").innerHTML=`<div class="modal-head"><h2 id="modalTitle">${esc(title)}</h2><button class="modal-close" data-close-modal aria-label="Fermer">×</button></div><div class="modal-body">${content}</div>`;
  $("modal").hidden=false;setTimeout(()=>$("modal").querySelector("input,select,textarea,button")?.focus(),0);bindModal();
}
function closeModal(){$("modal").hidden=true;$("modalContent").innerHTML=""}
function newSignalForm(){
  const targetSite=state.site==="group"?"marzin":state.site,w=data.workshops.find(x=>x.site_id===targetSite);
  modal("Nouveau Signal Terrain",`<form id="signalForm"><div class="alert critical"><b>Risque immédiat :</b> sécuriser et alerter selon la consigne du site avant la saisie.</div><div class="form-grid section">
    <label>Type<select id="signalType">${SIGNAL_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></label>
    <label>Gravité<select id="signalSeverity"><option>À qualifier</option><option>Normale</option><option>Haute</option><option>Critique</option></select></label>
    <label>Site<select id="signalSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===targetSite?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label>
    <label>Atelier<input id="signalWorkshop" value="${esc(w?.name||"")}" placeholder="Atelier"></label>
    <label>Zone / poste <small>(facultatif)</small><input id="signalZone" placeholder="Préciser si utile"></label>
    <label>Auteur / équipe<input id="signalAuthor" value="Équipe terrain"></label>
    <label class="wide">Description factuelle<textarea id="signalDescription" rows="4" required placeholder="Que s’est-il passé ? Où ?"></textarea></label>
    <label class="wide">Action immédiate <small>(facultatif)</small><textarea id="signalImmediate" rows="2"></textarea></label>
    <label class="wide">Photo <small>(facultative, stockage local à activer après validation de la volumétrie)</small><input type="file" id="signalPhoto" accept="image/*" disabled></label>
  </div><div class="form-actions"><button class="btn">Envoyer le signal</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("signalForm").onsubmit=event=>{event.preventDefault();const siteId=$("signalSite").value,work=data.workshops.find(x=>x.site_id===siteId);const item={id:nextId("S",data.signals),site_id:siteId,workshop_id:work?.id||null,zone:$("signalZone").value.trim(),type:$("signalType").value,description:$("signalDescription").value.trim(),severity:$("signalSeverity").value,state:"Nouveau",immediate_action:$("signalImmediate").value.trim(),author:$("signalAuthor").value.trim(),created_at:now(),updated_at:now(),action_id:null,problem_id:null};data.signals.unshift(item);save();closeModal();state.site=siteId;state.view="terrain";render();toast(`Signal ${item.id} créé et visible dans l’Accueil, le SQCDP et le registre.`)}
}
function openSignal(id){
  const s=data.signals.find(x=>x.id===id);if(!s)return;
  const index=SIGNAL_STATES.indexOf(s.state);
  modal(`${s.id} · Signal Terrain`,`<div class="row-top"><div>${pill(s.type,"info")} ${pill(s.severity,s.severity==="Critique"?"critical":"neutral")}</div>${pill(s.state,signalTone(s))}</div><h2>${esc(s.description)}</h2><p class="hint">${esc(getSiteName(s.site_id))} · ${esc(s.zone||"Zone non précisée")} · ${shortDate(s.created_at)} · ${esc(s.author)}</p>
    <div class="workflow section">${SIGNAL_STATES.map((x,i)=>`<span class="workflow-step ${i<index?"done":i===index?"active":""}">${x}</span>`).join("")}</div>
    <div class="grid cols-2 section"><div class="card"><h3>Action immédiate</h3><p class="hint">${esc(s.immediate_action||"Aucune action immédiate renseignée.")}</p></div><div class="card"><h3>Traçabilité</h3><p class="hint">Action liée : ${esc(s.action_id||"—")}<br>Problème lié : ${esc(s.problem_id||"—")}</p></div></div>
    <div class="row-actions">${s.state!=="Clos"?`<button class="btn" data-advance-signal="${s.id}">Passer à l’étape suivante</button>`:""}${!s.action_id?`<button class="btn secondary" data-action-from-signal="${s.id}">Créer une action</button>`:""}${!s.problem_id?`<button class="btn secondary" data-problem-from-signal="${s.id}">Créer un problème / A3</button>`:""}</div>`);
}
function advanceSignal(id){
  const s=data.signals.find(x=>x.id===id);if(!s)return;const i=SIGNAL_STATES.indexOf(s.state);
  if(i<SIGNAL_STATES.length-1){s.state=SIGNAL_STATES[i+1];s.updated_at=now();save();closeModal();render();toast(`${s.id} : ${s.state}`)}
}
function actionForm(existing=null,origin={}){
  const targetSite=existing?.site_id||origin.site_id||(state.site==="group"?"marzin":state.site);
  modal(existing?"Modifier l’action":"Nouvelle action",`<form id="actionForm"><div class="form-grid">
    <label class="wide">Action<input id="actionTitle" required value="${esc(existing?.title||origin.title||"")}"></label>
    <label>Responsable<input id="actionOwner" value="${esc(existing?.owner||"À désigner")}" required></label>
    <label>Priorité<select id="actionPriority">${["Normale","Haute","Critique"].map(x=>`<option ${x===(existing?.priority||origin.priority||"Normale")?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Statut<select id="actionStatus">${ACTION_STATES.map(x=>`<option ${x===(existing?.status||"Ouverte")?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Échéance<input id="actionDue" type="date" value="${existing?.due_date||today()}"></label>
    <label>Site<select id="actionSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===targetSite?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label>
    <label class="wide">Contexte<textarea id="actionDescription" rows="3">${esc(existing?.description||origin.description||"")}</textarea></label>
    ${existing?.status==="À vérifier"?'<label class="wide">Preuve d’efficacité<textarea id="actionEvidence" rows="3" placeholder="Résultat observé, période de tenue et vérificateur"></textarea></label>':""}
  </div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("actionForm").onsubmit=event=>{event.preventDefault();const status=$("actionStatus").value,evidence=$("actionEvidence")?.value.trim()||existing?.effectiveness||null;if(status==="Clôturée"&&!evidence)return toast("Une preuve d’efficacité est requise avant clôture.");const payload={site_id:$("actionSite").value,title:$("actionTitle").value.trim(),owner:$("actionOwner").value.trim(),priority:$("actionPriority").value,status,due_date:$("actionDue").value||null,origin_type:existing?.origin_type||origin.origin_type||"Manuel",origin_id:existing?.origin_id||origin.origin_id||null,description:$("actionDescription").value.trim(),effectiveness:evidence,updated_at:now()};if(existing)Object.assign(existing,payload);else data.actions.unshift({id:nextId("A",data.actions),workshop_id:workshop()?.id||null,created_at:now(),...payload});save();closeModal();render();toast(existing?"Action mise à jour.":"Action créée dans le plan général.")}
}
function advanceAction(id){
  const a=data.actions.find(x=>x.id===id);if(!a)return;
  if(a.status==="À vérifier")return actionForm(a);
  const i=ACTION_STATES.indexOf(a.status);a.status=ACTION_STATES[Math.min(i+1,2)];a.updated_at=now();save();render();toast(`${a.id} : ${a.status}`);
}
function problemFromSignal(signalId){
  const s=data.signals.find(x=>x.id===signalId);if(!s)return;
  const id=nextId("P",data.problems),problem={id,site_id:s.site_id,workshop_id:s.workshop_id,title:s.description,method:"A3",status:"Cadrage",owner:"À désigner",signal_ids:[s.id],action_ids:s.action_id?[s.action_id]:[],created_at:now(),content:{context:`${s.description} · ${s.zone||"zone à préciser"} · signal ${s.id}`,current:"À mesurer à partir de faits vérifiés.",target:"À définir avec le propriétaire du KPI.",causes:"Hypothèses à tester.",actions:s.action_id?`${s.action_id} · action liée`:"Aucune action liée.",verification:"Période de tenue et vérificateur à définir.",standard:"Décision après preuve d’efficacité."}};data.problems.unshift(problem);s.problem_id=id;s.state=s.state==="Nouveau"?"Pris en compte":s.state;data.documents.unshift({id:nextId("DOC",data.documents),site_id:s.site_id,type:"A3",title:`${id} · ${s.description.slice(0,55)}`,status:"Brouillon",problem_id:id,updated_at:now(),version:1});save();closeModal();state.site=s.site_id;state.view="resolution";render();toast(`Problème ${id} créé sans ressaisie.`);
}
function genericProblemForm(){
  modal("Nouveau problème",`<form id="problemForm"><div class="form-grid"><label class="wide">Problème factuel<input id="problemTitle" required></label><label>Méthode<select id="problemMethod"><option>A3</option><option>8D</option><option>QRQC</option></select></label><label>Responsable<input id="problemOwner" required></label><label class="wide">Contexte<textarea id="problemContext" rows="3" required></textarea></label></div><div class="form-actions"><button class="btn">Créer le dossier</button></div></form>`);
  $("problemForm").onsubmit=e=>{e.preventDefault();const id=nextId("P",data.problems),method=$("problemMethod").value,siteId=state.site==="group"?"marzin":state.site;data.problems.unshift({id,site_id:siteId,workshop_id:data.workshops.find(w=>w.site_id===siteId)?.id||null,title:$("problemTitle").value.trim(),method,status:"Cadrage",owner:$("problemOwner").value.trim(),signal_ids:[],action_ids:[],created_at:now(),content:{context:$("problemContext").value.trim(),current:"À compléter",target:"À compléter",causes:"À analyser",actions:"À définir",verification:"À planifier",standard:"À décider"}});data.documents.unshift({id:nextId("DOC",data.documents),site_id:siteId,type:method,title:`${id} · ${$("problemTitle").value.trim()}`,status:"Brouillon",problem_id:id,updated_at:now(),version:1});save();closeModal();state.site=siteId;render();toast(`Dossier ${id} créé.`)}
}
function gembaForm(){
  modal("Nouveau Gemba",`<form id="gembaForm"><div class="form-grid"><label>Zone / poste<input id="gembaZone" required></label><label>Catégorie<select id="gembaCategory">${SIGNAL_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></label><label>Auteur<input id="gembaAuthor" value="Animateur"></label><label class="wide">Observation factuelle<textarea id="gembaFinding" rows="4" required></textarea></label><label class="wide"><input id="gembaSignal" type="checkbox"> Transformer aussi cette observation en Signal Terrain</label></div><div class="form-actions"><button class="btn">Enregistrer</button></div></form>`);
  $("gembaForm").onsubmit=e=>{e.preventDefault();const siteId=state.site==="group"?"marzin":state.site,item={id:nextId("G",data.gembas),site_id:siteId,workshop_id:data.workshops.find(w=>w.site_id===siteId)?.id||null,zone:$("gembaZone").value.trim(),finding:$("gembaFinding").value.trim(),category:$("gembaCategory").value,created_at:now(),author:$("gembaAuthor").value.trim()};data.gembas.unshift(item);if($("gembaSignal").checked)data.signals.unshift({id:nextId("S",data.signals),site_id:siteId,workshop_id:item.workshop_id,zone:item.zone,type:item.category,description:item.finding,severity:"À qualifier",state:"Nouveau",immediate_action:"",author:item.author,created_at:now(),updated_at:now(),action_id:null,problem_id:null});save();closeModal();render();toast("Gemba enregistré.")};
}
function simpleDocument(type){
  const template=TEMPLATES.find(t=>t.type===type),siteId=state.site==="group"?"marzin":state.site;
  modal(`Créer · ${template?.title||type}`,`<form id="documentForm"><div class="form-grid"><label class="wide">Titre<input id="documentTitle" required value="${esc(template?.title||type)} · "></label><label>Site<select id="documentSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Responsable<input id="documentOwner" placeholder="Nom ou fonction"></label><label class="wide">Contexte<textarea id="documentContext" rows="4" placeholder="Informations initiales"></textarea></label></div><div class="form-actions"><button class="btn">Créer et enregistrer</button></div></form>`);
  $("documentForm").onsubmit=e=>{e.preventDefault();data.documents.unshift({id:nextId("DOC",data.documents),site_id:$("documentSite").value,type,title:$("documentTitle").value.trim(),status:"Brouillon",problem_id:null,owner:$("documentOwner").value.trim(),content:$("documentContext").value.trim(),updated_at:now(),version:1});save();closeModal();render();toast("Document créé.")}
}
function editProblem(id){
  const p=data.problems.find(x=>x.id===id);if(!p)return;const c=p.content||{};
  modal(`${p.id} · Modifier le dossier`,`<form id="editProblemForm"><div class="form-grid">
    <label class="wide">Titre<input id="problemEditTitle" value="${esc(p.title)}" required></label>
    <label>Méthode<select id="problemEditMethod">${["A3","8D","QRQC"].map(x=>`<option ${x===p.method?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Statut<select id="problemEditStatus">${["Cadrage","Analyse","Actions","Vérification","Standardisation","Clos"].map(x=>`<option ${x===p.status?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Responsable<input id="problemEditOwner" value="${esc(p.owner)}" required></label>
    <label class="wide">Contexte<textarea id="problemEditContext" rows="3">${esc(c.context||"")}</textarea></label>
    <label class="wide">État actuel<textarea id="problemEditCurrent" rows="2">${esc(c.current||"")}</textarea></label>
    <label class="wide">Cible<textarea id="problemEditTarget" rows="2">${esc(c.target||"")}</textarea></label>
    <label class="wide">Causes et preuves<textarea id="problemEditCauses" rows="3">${esc(c.causes||"")}</textarea></label>
    <label class="wide">Actions / contre-mesures<textarea id="problemEditActions" rows="3">${esc(c.actions||"")}</textarea></label>
    <label class="wide">Vérification d’efficacité<textarea id="problemEditVerification" rows="3">${esc(c.verification||"")}</textarea></label>
    <label class="wide">Standardisation / apprentissage<textarea id="problemEditStandard" rows="3">${esc(c.standard||"")}</textarea></label>
  </div><div class="form-actions"><button class="btn">Enregistrer la révision</button></div></form>`);
  $("editProblemForm").onsubmit=e=>{e.preventDefault();const status=$("problemEditStatus").value,verification=$("problemEditVerification").value.trim();if(status==="Clos"&&!verification)return toast("La vérification d’efficacité est obligatoire avant clôture.");Object.assign(p,{title:$("problemEditTitle").value.trim(),method:$("problemEditMethod").value,status,owner:$("problemEditOwner").value.trim(),updated_at:now(),content:{...p.content,context:$("problemEditContext").value.trim(),current:$("problemEditCurrent").value.trim(),target:$("problemEditTarget").value.trim(),causes:$("problemEditCauses").value.trim(),actions:$("problemEditActions").value.trim(),verification,standard:$("problemEditStandard").value.trim()}});const doc=data.documents.find(d=>d.problem_id===p.id);if(doc){doc.title=`${p.id} · ${p.title}`;doc.type=p.method;doc.version=(doc.version||1)+1;doc.updated_at=now()}save();closeModal();render();toast("Dossier et document mis à jour.")};
}
function auditForm(){
  const siteId=state.site==="group"?"marzin":state.site;
  modal("Nouvel audit",`<form id="auditForm"><div class="form-grid"><label>Type<select id="auditType"><option>5S</option><option>Maturité</option><option>Standard</option><option>Processus</option></select></label><label>Site<select id="auditSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Périmètre<input id="auditScope" required placeholder="Atelier / zone / processus"></label><label>Score / 100<input id="auditScore" type="number" min="0" max="100" required></label><label>Responsable<input id="auditOwner" required></label><label>Date<input id="auditDate" type="date" value="${today()}" required></label><label class="wide">Preuves et écarts<textarea id="auditProof" rows="4" required></textarea></label><label class="wide"><input id="auditAction" type="checkbox"> Créer une action de traitement</label></div><div class="form-actions"><button class="btn">Enregistrer l’audit</button></div></form>`);
  $("auditForm").onsubmit=e=>{e.preventDefault();const id=nextId("AUD",data.audits),site=$("auditSite").value,score=Number($("auditScore").value),proof=$("auditProof").value.trim();data.audits.unshift({id,site_id:site,type:$("auditType").value,scope:$("auditScope").value.trim(),score,status:"Terminé",performed_at:$("auditDate").value,owner:$("auditOwner").value.trim(),proof});if($("auditAction").checked)data.actions.unshift({id:nextId("A",data.actions),site_id:site,workshop_id:data.workshops.find(w=>w.site_id===site)?.id||null,title:`Traiter l’écart · ${$("auditScope").value.trim()}`,owner:$("auditOwner").value.trim(),priority:score<50?"Haute":"Normale",status:"Ouverte",due_date:null,origin_type:"Audit",origin_id:id,description:proof,effectiveness:null,created_at:now()});save();closeModal();state.site=site;render();toast("Audit enregistré avec sa preuve.")};
}
function practiceForm(){
  const siteId=state.site==="group"?"marzin":state.site;
  modal("Proposer une bonne pratique",`<form id="practiceForm"><div class="form-grid"><label class="wide">Titre<input id="practiceTitle" required></label><label>Site source<select id="practiceSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Catégorie<select id="practiceCategory">${SIGNAL_TYPES.slice(0,-1).map(x=>`<option>${x}</option>`).join("")}</select></label><label class="wide">Standard et conditions de réussite<textarea id="practiceSummary" rows="3" required></textarea></label><label class="wide">Résultat vérifié / preuve<textarea id="practiceEvidence" rows="3" required></textarea></label></div><div class="form-actions"><button class="btn">Envoyer à validation</button></div></form>`);
  $("practiceForm").onsubmit=e=>{e.preventDefault();data.practices.unshift({id:nextId("BP",data.practices),site_id:$("practiceSite").value,title:$("practiceTitle").value.trim(),category:$("practiceCategory").value,summary:$("practiceSummary").value.trim(),evidence:$("practiceEvidence").value.trim(),status:"À valider",created_at:now()});save();closeModal();render();toast("Bonne pratique envoyée à validation.")};
}
function accountForm(){
  modal("Ajouter un compte",`<form id="accountForm"><div class="form-grid"><label class="wide">Nom<input id="accountName" required></label><label>Rôle<select id="accountRole">${Object.entries(ROLES).map(([id,r])=>`<option value="${id}">${esc(r.label)}</option>`).join("")}</select></label><label>Périmètre<select id="accountSite">${SITES.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label></div><div class="alert section">Cette étape prépare l’habilitation locale. L’invitation et l’authentification réelles nécessitent un backend validé.</div><div class="form-actions"><button class="btn">Enregistrer l’habilitation</button></div></form>`);
  $("accountForm").onsubmit=e=>{e.preventDefault();const accountRole=$("accountRole").value,accountSite=$("accountSite").value;if(["director","terrain"].includes(accountRole)&&accountSite==="group")return toast("Un profil Site ou Terrain doit avoir une entité attribuée.");data.accounts.push({id:nextId("U",data.accounts),name:$("accountName").value.trim(),role:accountRole,site_id:accountSite,workshop_id:null,status:"Préparé"});save();closeModal();render();toast("Habilitation préparée ; aucune invitation externe envoyée.")};
}

function bindModal(){
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeModal);
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-action-from-signal]").forEach(b=>b.onclick=()=>{const s=data.signals.find(x=>x.id===b.dataset.actionFromSignal);closeModal();actionForm(null,{site_id:s.site_id,title:`Traiter · ${s.description}`,priority:s.severity==="Critique"?"Critique":"Haute",origin_type:"Signal",origin_id:s.id,description:s.description});const form=$("actionForm");const original=form.onsubmit;form.onsubmit=e=>{original(e);const a=data.actions.find(x=>x.origin_id===s.id);s.action_id=a?.id||s.action_id;s.state="Action en cours";save()};});
  document.querySelectorAll("[data-problem-from-signal]").forEach(b=>b.onclick=()=>problemFromSignal(b.dataset.problemFromSignal));
}
function bind(){
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>switchView(b.dataset.nav));
  document.querySelectorAll("[data-set-site]").forEach(b=>b.onclick=()=>{state.site=b.dataset.setSite;localStorage.setItem("biaSite",state.site);if(state.view==="home")state.view=state.role==="dg"?"pilotage":"home";render()});
  document.querySelectorAll("[data-new-signal]").forEach(b=>b.onclick=newSignalForm);
  document.querySelectorAll("[data-open-signal]").forEach(b=>b.onclick=()=>openSignal(b.dataset.openSignal));
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-new-action]").forEach(b=>b.onclick=()=>actionForm(null,b.dataset.originId?{origin_type:"Problème",origin_id:b.dataset.originId}:{}));
  document.querySelectorAll("[data-edit-action]").forEach(b=>b.onclick=()=>actionForm(data.actions.find(x=>x.id===b.dataset.editAction)));
  document.querySelectorAll("[data-advance-action]").forEach(b=>b.onclick=()=>advanceAction(b.dataset.advanceAction));
  document.querySelectorAll("[data-action-filter]").forEach(b=>b.onclick=()=>{state.actionFilter=b.dataset.actionFilter;render()});
  document.querySelectorAll("[data-terrain-tab]").forEach(b=>b.onclick=()=>{state.terrainTab=b.dataset.terrainTab;render()});
  document.querySelectorAll("[data-new-gemba]").forEach(b=>b.onclick=gembaForm);
  document.querySelectorAll("[data-new-problem]").forEach(b=>b.onclick=genericProblemForm);
  document.querySelectorAll("[data-edit-problem]").forEach(b=>b.onclick=()=>editProblem(b.dataset.editProblem));
  document.querySelectorAll("[data-document-from-problem]").forEach(b=>b.onclick=()=>{const problem=data.problems.find(p=>p.id===b.dataset.documentFromProblem);const doc=data.documents.find(d=>d.problem_id===problem?.id);if(doc){state.view="documents";render();toast(`${doc.id} · ${doc.title}`)}else if(problem){data.documents.unshift({id:nextId("DOC",data.documents),site_id:problem.site_id,type:problem.method,title:`${problem.id} · ${problem.title}`,status:"Brouillon",problem_id:problem.id,updated_at:now(),version:1});save();state.view="documents";render();}});
  document.querySelectorAll("[data-new-document]").forEach(b=>b.onclick=()=>simpleDocument(b.dataset.newDocument));
  document.querySelectorAll("[data-new-audit]").forEach(b=>b.onclick=auditForm);
  document.querySelectorAll("[data-new-practice]").forEach(b=>b.onclick=practiceForm);
  document.querySelectorAll("[data-new-account]").forEach(b=>b.onclick=accountForm);
  document.querySelectorAll("[data-timer]").forEach(b=>b.onclick=()=>{state.timerStarted=state.timerStarted?null:Date.now();render();if(state.timerStarted)window.biaTimer=setInterval(()=>{if(state.view==="sqcdp")render()},1000);else clearInterval(window.biaTimer)});
  document.querySelectorAll("[data-export]").forEach(b=>b.onclick=exportData);
  $("importFile")?.addEventListener("change",importData);
}
function exportData(){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`bia-production-system-v5-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("Sauvegarde exportée.");
}
function importData(event){
  const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const incoming=JSON.parse(reader.result);if(incoming?.meta?.schema!==6)throw new Error("Schéma incompatible");for(const key of ["signals","actions","problems","documents"])if(!Array.isArray(incoming[key]))throw new Error(`Collection manquante : ${key}`);localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`,JSON.stringify(data));data=incoming;save();render();toast("Import terminé ; une sauvegarde précédente a été conservée.")}catch(error){toast(`Import refusé : ${error.message}`)}};reader.readAsText(file);
}

$("siteSelect").onchange=e=>{state.site=e.target.value;localStorage.setItem("biaSite",state.site);render()};
$("roleSelect").onchange=e=>{state.role=e.target.value;localStorage.setItem("biaRole",state.role);if(!canGroup()&&state.site==="group")state.site="marzin";render()};
$("menuButton").onclick=()=>{const open=$("sidebar").classList.toggle("open");$("menuButton").setAttribute("aria-expanded",String(open))};
$("modal").onclick=e=>{if(e.target===$("modal"))closeModal()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("modal").hidden)closeModal()});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
render();
