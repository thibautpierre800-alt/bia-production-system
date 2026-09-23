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
  dg:{label:"Direction Générale Groupe",scope:"group",nav:["home","pilotage","actions","practices","training","account"]},
  lean:{label:"Responsable Lean Groupe",scope:"group",nav:["home","pilotage","sqcdp","actions","terrain","audits","resolution","projects","practices","documents","tools","training","account","settings"]},
  director:{label:"Directeur de site",scope:"site",nav:["home","pilotage","sqcdp","actions","terrain","audits","resolution","projects","documents","tools","training","account"]},
  terrain:{label:"Chef d’équipe / Opérateur",scope:"workshop",nav:["home","sqcdp","actions","terrain","audits","documents","training","account"]}
};
const NAV=[
  {id:"home",icon:"⌂",label:"Accueil",group:"Piloter"},
  {id:"pilotage",icon:"↗",label:"Pilotage",group:"Piloter"},
  {id:"sqcdp",icon:"▦",label:"SQCDP Atelier",group:"Piloter"},
  {id:"actions",icon:"✓",label:"Actions",group:"Agir"},
  {id:"terrain",icon:"!",label:"Terrain",group:"Agir"},
  {id:"audits",icon:"◎",label:"Audit Terrain · 50",group:"Agir"},
  {id:"resolution",icon:"◇",label:"Résolution",group:"Améliorer"},
  {id:"projects",icon:"◆",label:"Chantiers",group:"Améliorer"},
  {id:"practices",icon:"✦",label:"Bonnes pratiques",group:"Améliorer"},
  {id:"documents",icon:"▤",label:"Documents",group:"Ressources"},
  {id:"tools",icon:"▧",label:"Bibliothèque Lean",group:"Ressources"},
  {id:"training",icon:"▣",label:"Formation",group:"Ressources"},
  {id:"account",icon:"●",label:"Compte",group:"Administration"},
  {id:"settings",icon:"⚙",label:"Paramètres",group:"Administration"}
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
const AUDIT_CRITERIA={
  "Sécurité":["Risques critiques sécurisés","Consignes visibles et comprises","Presqu’accidents remontés","EPI et protections adaptés","Actions sécurité vérifiées"],
  "Management quotidien":["SQCDP animé au bon rythme","Écarts visibles et datés","Responsables et échéances clairs","Escalade appliquée","Décisions suivies"],
  "5S et standards":["Zones et quantités définies","Standard visuel au poste","Écarts immédiatement visibles","Standards versionnés","Audits suivis d’actions"],
  "Qualité":["Défauts stratifiés","Réaction immédiate définie","Causes d’apparition recherchées","Causes de non-détection recherchées","Efficacité vérifiée"],
  "Flux et délais":["Flux physique compris","Encours maîtrisés","Priorités stables","Goulot identifié","Adhérence au planning suivie"],
  "Performance":["TRS défini correctement","Pertes élémentaires codifiées","Objectifs et tendances visibles","Données fiables et sourcées","Réaction aux dérives définie"],
  "Maintenance":["Criticité équipements connue","Préventif réalisé","Pannes récurrentes analysées","Pièces critiques sécurisées","Opérateurs impliqués dans le maintien"],
  "Compétences":["Polyvalence visible","Formations liées aux standards","Habilitations à jour","Managers coachent au terrain","Idées opérateurs traitées"],
  "Résolution de problèmes":["Problèmes factuels et chiffrés","Méthode proportionnée","Causes prouvées","Actions liées aux causes","Standardisation après efficacité"],
  "Amélioration multisite":["Gains vérifiés","Pratiques capitalisées","Transférabilité évaluée","Pilotes deuxième site conduits","REX partagé au Groupe"]
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
    {id:"P-012",site_id:"marzin",workshop_id:"marzin-pilot",title:"Défauts de surface récurrents",method:"A3",status:"Analyse",owner:"Équipe Qualité",signal_ids:["S-039"],action_ids:["A-019"],created_at:"2026-09-21T16:00:00Z",content:{context:"Défauts de surface sur la période observée. Périmètre à confirmer.",background:"Impact qualité et retouches à chiffrer.",current:"Baseline illustrative : rebut 4,1 %. Source manuelle à qualifier.",target:"Cible illustrative : 3 %. À valider avec le propriétaire KPI.",analysis:"Stratification produit, poste et équipe à réaliser.",causes:"Hypothèse : support dégradé. Test à documenter.",root_cause:"Hypothèse : support dégradé. Cause non encore prouvée.",countermeasures:"Contrôle du support proposé, décision après test.",actions:"A-019 · Contrôler le support.",verification:"Résultat non mesuré.",effectiveness:"Période de tenue et vérificateur à définir.",standard:"Mise à jour du standard après preuve d’efficacité.",learning:"À renseigner après clôture."}}
  ],
  projects:[
    {id:"CH-006",site_id:"marzin",title:"Réduire le temps de changement de série",method:"SMED",status:"Mesure",owner:"Méthodes",progress:35,target_date:"2026-11-15",baseline:"52 min",target:"35 min",result:"Non vérifié",problem_id:null,action_ids:[],created_at:"2026-09-18T09:00:00Z"},
    {id:"CH-007",site_id:"marzin",title:"Stabiliser le flux avant contrôle",method:"VSM",status:"Analyse",owner:"Production",progress:20,target_date:"2026-12-05",baseline:"À mesurer",target:"Flux FIFO défini",result:"Non vérifié",problem_id:"P-012",action_ids:["A-019"],created_at:"2026-09-21T09:00:00Z"}
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
  people:[
    {id:"PER-001",employee_id:"BIA-0001",name:"Pierre Thibaut",site_id:"marzin",workshop:"Atelier pilote",job:"Responsable Lean Groupe",manager:"Direction Générale",status:"Actif"},
    {id:"PER-002",employee_id:"BIA-0002",name:"Collaborateur exemple",site_id:"marzin",workshop:"Atelier pilote",job:"Chef d’équipe",manager:"Direction de site",status:"Exemple"}
  ],
  trainingCatalog:[
    {id:"FOR-001",code:"BIA-LEAN-01",title:"Fondamentaux Lean et système BIA",category:"Socle",duration:3.5,validity_months:null,objectives:"Comprendre valeur, gaspillage, flux, standard et amélioration continue.",modules:["Principes Lean","Système BIA","Rôle de chacun","Exercice terrain"],evaluation:"Quiz + mise en situation",status:"Publié"},
    {id:"FOR-002",code:"BIA-SQCDP-01",title:"Animer un SQCDP et un TOP 15",category:"Management quotidien",duration:3.5,validity_months:24,objectives:"Préparer, animer et conclure un rituel centré sur les écarts.",modules:["Axes SQCDP","Management visuel","TOP 15","Escalade"],evaluation:"Animation observée",status:"Publié"},
    {id:"FOR-003",code:"BIA-TER-01",title:"Signal Terrain et réaction immédiate",category:"Terrain",duration:1.5,validity_months:24,objectives:"Décrire un fait, sécuriser et suivre le signal jusqu’à la vérification.",modules:["Fait vs opinion","Gravité","Cycle du signal","Traçabilité"],evaluation:"Cas pratique",status:"Publié"},
    {id:"FOR-004",code:"BIA-RDP-01",title:"Résolution de problèmes · socle",category:"Résolution",duration:7,validity_months:36,objectives:"Cadrer un problème, prouver une cause et vérifier une contre-mesure.",modules:["PDCA","5W2H","5 Pourquoi","Ishikawa","Preuve d’efficacité"],evaluation:"Étude de cas",status:"Publié"},
    {id:"FOR-005",code:"BIA-A3-01",title:"Conduire un A3",category:"Résolution",duration:7,validity_months:36,objectives:"Conduire les onze parties d’un A3 sur un problème réel.",modules:["Écart","Situation actuelle","Objectif","Causes","Contre-mesures","Suivi","Standardisation"],evaluation:"A3 réel soutenu",status:"Publié"},
    {id:"FOR-006",code:"BIA-8D-01",title:"Conduire un 8D",category:"Résolution",duration:7,validity_months:36,objectives:"Sécuriser le client et éliminer apparition et non-détection.",modules:["D0 à D3","D4 occurrence/escape","D5-D6","D7-D8"],evaluation:"8D réel revu",status:"Publié"},
    {id:"FOR-007",code:"BIA-QRQC-01",title:"QRQC et réaction qualité",category:"Qualité",duration:3.5,validity_months:24,objectives:"Réagir vite sans confondre sécurisation et résolution définitive.",modules:["Réaction","Containment","Analyse","Escalade"],evaluation:"Simulation QRQC",status:"Publié"},
    {id:"FOR-008",code:"BIA-GEMBA-01",title:"Conduire un Gemba",category:"Terrain",duration:2,validity_months:24,objectives:"Observer le travail réel et questionner sans auditer les personnes.",modules:["Posture","Observation","Questions","Suite utile"],evaluation:"Gemba observé",status:"Publié"},
    {id:"FOR-009",code:"BIA-5S-01",title:"5S utile et durable",category:"Stabilité",duration:3.5,validity_months:24,objectives:"Construire un 5S orienté sécurité, anomalies et maintien.",modules:["5 étapes","Standard visuel","Audit","Maintien"],evaluation:"Audit terrain",status:"Publié"},
    {id:"FOR-010",code:"BIA-KPI-01",title:"TRS, pertes et données industrielles",category:"Pilotage",duration:3.5,validity_months:24,objectives:"Lire le TRS, éviter les biais et relier les pertes aux actions.",modules:["Disponibilité","Performance","Qualité","Fiabilité de donnée"],evaluation:"Exercices de calcul",status:"Publié"},
    {id:"FOR-011",code:"BIA-SMED-01",title:"Conduire un chantier SMED",category:"Méthodes",duration:7,validity_months:36,objectives:"Réduire le temps du dernier produit bon au premier produit bon stable.",modules:["Observer","Séparer","Convertir","Simplifier","Standardiser"],evaluation:"Chantier tutoré",status:"Publié"},
    {id:"FOR-012",code:"BIA-VSM-01",title:"VSM et amélioration des flux",category:"Flux",duration:7,validity_months:36,objectives:"Cartographier le flux réel et construire un état futur priorisé.",modules:["Famille produit","État actuel","Lead time","État futur","Plan de transformation"],evaluation:"VSM soutenue",status:"Publié"},
    {id:"FOR-013",code:"BIA-STD-01",title:"Standard Work",category:"Stabilité",duration:3.5,validity_months:24,objectives:"Décrire, former, observer et améliorer le meilleur standard connu.",modules:["Séquence","Points clés","Temps","Formation au poste"],evaluation:"Observation au poste",status:"Publié"},
    {id:"FOR-014",code:"BIA-AUD-01",title:"Auditeur Terrain BIA",category:"Audit",duration:7,validity_months:24,objectives:"Évaluer avec preuves et transformer les écarts en décisions utiles.",modules:["Référentiel 50 points","Preuve","Notation","Restitution","Actions"],evaluation:"Audit accompagné puis autonome",status:"Publié"},
    {id:"FOR-015",code:"BIA-COACH-01",title:"Coaching Lean des équipes",category:"Leadership",duration:7,validity_months:36,objectives:"Faire résoudre les problèmes par les équipes sans imposer les solutions.",modules:["Questionnement","Kata","Feedback","Management transverse"],evaluation:"Mise en situation",status:"Publié"}
  ],
  trainingRecords:[
    {id:"REC-001",person_id:"PER-001",training_id:"FOR-001",date:"2026-09-10",trainer:"Référent interne",attendance:"Présent",score:88,level:3,status:"Validé",evidence:"Quiz et mise en situation",validated_by:"Direction Générale",validated_at:"2026-09-10",expires_at:null}
  ],
  toolRuns:[],
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
  toolCategory:"Tous",
  toolId:null,
  toolQuery:"",
  selectedProblemId:null,
  trainingTab:"catalog",
  selectedPersonId:null,
  timerStarted:null
};
let data=loadData();

function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved?.meta?.schema===6)return {...saved,projects:saved.projects||[],toolRuns:saved.toolRuns||[],practices:saved.practices||[],audits:saved.audits||[],people:saved.people||clone(DEMO.people),trainingCatalog:saved.trainingCatalog||clone(DEMO.trainingCatalog),trainingRecords:saved.trainingRecords||[]};
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
  const html=nav.map((n,i)=>`${i===0||nav[i-1].group!==n.group?`<div class="nav-group">${esc(n.group)}</div>`:""}<button class="nav-button ${state.view===n.id?"active":""}" data-nav="${n.id}"><span class="nav-icon">${n.icon}</span>${esc(n.label)}</button>`).join("");
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
  const renderer={home:renderHome,pilotage:renderPilotage,sqcdp:renderSqcdp,actions:renderActions,terrain:renderTerrain,audits:renderAudits,resolution:renderResolution,projects:renderProjects,practices:renderPractices,documents:renderDocuments,tools:renderTools,training:renderTraining,account:renderAccount,settings:renderSettings}[state.view];
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
    <section class="panel"><h2>Prochain point quotidien</h2><p class="hint">${esc(workshop()?.name||"Atelier à sélectionner")}</p><div class="metric-value">${topSubjects().length} sujets</div><button class="btn" data-nav="sqcdp">Ouvrir SQCDP / TOP 15</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Raccourcis</h3><div class="row-actions"><button class="btn secondary small" data-nav="terrain">Gemba / Signal</button><button class="btn secondary small" data-nav="audits">Audit Terrain · 50</button>${role().nav.includes("resolution")?'<button class="btn secondary small" data-nav="resolution">A3 / 8D</button>':""}</div></section></div>`;
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
function pilotageChart(series,{title,unit="%",direction="high",contextLabel=site().name}){
  if(!series?.values?.length)return `<article class="panel indicator-chart unavailable"><div class="section-title"><div><h2>${esc(title)}</h2><p class="hint">Définition, source et historique à valider</p></div>${pill("NON DISPONIBLE","neutral")}</div>${empty("Aucune série fiable. L’indicateur ne sera pas inventé ni ressaisi si SEQUOIA le fournit.")}</article>`;
  const last=Number(series.values.at(-1)),previous=Number(series.values.at(-2)),delta=+(last-previous).toFixed(1),target=Number.isFinite(series.target)?Number(series.target):null,gap=target==null?null:+(last-target).toFixed(1),good=target==null?null:direction==="low"?last<=target:last>=target;
  return `<article class="panel indicator-chart"><div class="section-title"><div><h2>${esc(title)} · ${String(last).replace(".",",")} ${esc(unit)}</h2><p class="hint">${target==null?"Cible à définir":`Cible ${direction==="low"?"≤":"≥"} ${String(target).replace(".",",")} ${esc(unit)} · Écart ${gap>0?"+":""}${String(gap).replace(".",",")} pt`} · Tendance ${delta>0?"+":""}${String(delta).replace(".",",")} pt</p></div>${target==null?pill("À QUALIFIER","neutral"):pill(good?"Conforme":"Écart",good?"done":"open")}</div>${lineChart(series,`${title} · ${contextLabel}`)}<div class="indicator-footer"><div><span class="source-label">${esc(series.source||"Source à définir")}</span><span class="row-meta">Dernière période : ${esc(series.labels?.at(-1)||"à définir")}</span></div>${good===false?'<button class="btn small secondary" data-nav="actions">Voir les actions liées</button>':""}</div></article>`;
}
function renderPilotage(){
  const currentSite=state.site==="group"?"marzin":state.site;
  const trs=data.trends.find(t=>t.site_id===currentSite&&t.code==="trs");
  const selectedScrap=data.trends.find(t=>t.site_id===currentSite&&t.code==="scrap");
  const openCritical=data.signals.filter(s=>(state.site==="group"||s.site_id===state.site)&&s.severity==="Critique"&&isOpenSignal(s));
  if(state.site==="group"){
    return `${pageHead("Pilotage Groupe","Comprendre avant de comparer","Les classements sont bloqués tant que définitions, couverture et pondérations ne sont pas comparables.")}
      <div class="alert"><b>TRS Groupe non consolidable à ce stade.</b> Les sources et règles de calcul restent à qualifier pour les six entités.</div>
      <div class="section-title section"><div><h2>Tendances du site sélectionné : Marzin</h2><p class="hint">Exemples fictifs et sources manuelles, en attente des définitions Groupe.</p></div>${pill("SITE SÉLECTIONNÉ","progress")}</div><div class="grid cols-2">${pilotageChart(trs,{title:"TRS",direction:"high",contextLabel:"Marzin"})}${pilotageChart(selectedScrap,{title:"Rebut",direction:"low",contextLabel:"Marzin"})}</div>
      <div class="grid cols-3 section">${pilotageChart(null,{title:"Service client — OTD / OTF / OTIF",contextLabel:"Marzin"})}<article class="panel indicator-chart"><h2>Décisions et couverture</h2><div class="metric-value">${openCritical.length}</div><p class="bad">risque(s) critique(s) ouvert(s)</p><p class="hint">Couverture KPI Groupe à qualifier. Aucune moyenne simple des pourcentages n’est affichée.</p><button class="btn" data-nav="actions">Voir les décisions</button></article><article class="panel indicator-chart"><h2>Maturité</h2><div class="metric-value">—</div><p class="hint">Les résultats apparaîtront après un Audit Terrain détaillé. Aucun score multisite n’est inventé.</p><button class="btn secondary" data-nav="audits">Ouvrir Audit Terrain</button></article></div>
      <section class="section"><div class="section-title"><h2>État des sources</h2><span class="badge">6 entités</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Entité</th><th>TRS</th><th>Rebut</th><th>Service</th><th>Décision</th></tr></thead><tbody>${OPERATIONAL_SITES.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${s.id==="marzin"?"78,6 % · manuel":"À qualifier"}</td><td>${s.id==="marzin"?"4,1 % · manuel":"À qualifier"}</td><td>Définition à valider</td><td>${data.decisions.some(d=>d.site_id===s.id)?pill("À arbitrer","progress"):pill("Sans donnée","neutral")}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="section"><div class="section-title"><div><h2>Benchmark opérationnel contextualisé</h2><p class="hint">Volumes d’activité BIA PS, pas classement de performance industrielle.</p></div><button class="btn secondary" data-open-tool="benchmark">Ouvrir la méthode benchmark</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Entité</th><th>Signaux ouverts</th><th>Actions ouvertes</th><th>Audits détaillés</th><th>Chantiers actifs</th><th>Couverture KPI</th></tr></thead><tbody>${OPERATIONAL_SITES.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${data.signals.filter(x=>x.site_id===s.id&&isOpenSignal(x)).length}</td><td>${data.actions.filter(x=>x.site_id===s.id&&isOpenAction(x)).length}</td><td>${data.audits.filter(x=>x.site_id===s.id&&x.audit_data?.domain_scores).length}</td><td>${(data.projects||[]).filter(x=>x.site_id===s.id&&x.status!=="Clos").length}</td><td>${data.measures.some(x=>x.site_id===s.id)?pill("Partielle","progress"):pill("À établir","neutral")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  const scrap=data.trends.find(t=>t.site_id===state.site&&t.code==="scrap");
  const criticalSignals=scoped(data.signals).filter(s=>s.severity==="Critique"&&isOpenSignal(s)),peopleMeasure=measureFor("P");
  return `${pageHead("Pilotage Site",`Pilotage de ${site().name}`,"La tendance, l’écart, sa fiabilité et la prochaine décision sur une seule page.")}
    <div class="context-strip"><div><span>Périmètre</span><b>${esc(site().name)}</b></div><div><span>Période disponible</span><b>6 dernières semaines</b></div><div><span>Source</span><b>Manuelle · à qualifier</b></div></div><div class="grid cols-2 section">${pilotageChart(trs,{title:"TRS",direction:"high"})}${pilotageChart(scrap,{title:"Qualité · Rebut",direction:"low"})}</div>
    <div class="grid cols-3 section">
      ${pilotageChart(null,{title:"Service client — OTD / OTF / OTIF",direction:"high"})}
      <article class="panel indicator-chart"><div class="section-title"><div><h2>Sécurité · ${criticalSignals.length} critique(s)</h2><p class="hint">Les remontées sont un signal d’activité, pas une note de performance.</p></div>${pill(criticalSignals.length?"Décision requise":"Aucun critique",criticalSignals.length?"open":"done")}</div><div class="metric-value">${scoped(data.signals).filter(s=>s.type==="Sécurité"&&isOpenSignal(s)).length}</div><div class="metric-foot">signal(aux) sécurité ouvert(s) · source BIA PS temps réel</div><button class="btn small secondary section" data-nav="terrain">Voir les signaux sécurité</button></article>
      <article class="panel indicator-chart"><div class="section-title"><div><h2>Personnel · ${peopleMeasure?.value??"—"} ${esc(peopleMeasure?.unit||"")}</h2><p class="hint">${peopleMeasure?.value==null?"Indicateur utile et source à définir":`Cible ${peopleMeasure.target} ${esc(peopleMeasure.unit)}`}</p></div>${pill(peopleMeasure?.value==null?"NON DISPONIBLE":"À ANALYSER","neutral")}</div><p class="hint">Aucune donnée RH individuelle n’est affichée. La couverture des compétences pourra être utilisée après validation.</p></article>
    </div>
    <section class="section"><div class="section-title"><h2>Agir sur les écarts</h2><span class="badge">${criticalSignals.length} critique(s)</span></div><div class="grid cols-2">${criticalSignals.map(s=>`<div class="alert critical"><b>${esc(s.id)} · ${esc(s.description)}</b><p>Sécuriser, attribuer et décider de la suite.</p><button class="btn small" data-open-signal="${s.id}">Ouvrir le sujet</button></div>`).join("")||empty("Aucun signal critique.")}</div></section>`;
}

function measureFor(axis){return scoped(data.measures,{groupAllowed:false}).find(m=>m.axis===axis)}
function measureStatus(m){
  if(!m||m.value==null||m.target==null)return {text:"Non disponible",tone:"neutral"};
  const bad=["scrap","safety_signal"].includes(m.code)?m.value>m.target:m.value<m.target;
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
    <div class="list">${subjects.map((s,i)=>`<article class="row top15-row"><b>${i+1} · ${esc(s.category)}</b><div><div class="row-title">${esc(s.title)}</div><div class="row-meta">${esc(s.id)}</div></div><div>${esc(s.next)}</div><b class="nowrap">${esc(s.due)}</b><div>${pill(s.priority,s.priority==="Critique"?"critical":"progress")}<button class="btn small secondary subject-open" data-open-subject="${s.id}">Ouvrir</button></div></article>`).join("")||empty("Aucun sujet à traiter aujourd’hui.")}</div></section>`;
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
  const tabs=`<div class="tabs"><button class="tab ${state.terrainTab==="signals"?"active":""}" data-terrain-tab="signals">Signal Terrain</button><button class="tab ${state.terrainTab==="gemba"?"active":""}" data-terrain-tab="gemba">Gemba</button><button class="tab ${state.terrainTab==="stats"?"active":""}" data-terrain-tab="stats">Statistiques</button><button class="tab" data-nav="audits">Audit Terrain · 50 critères</button></div>`;
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
  const rows=scoped(data.audits).sort((a,b)=>String(b.updated_at||b.performed_at).localeCompare(String(a.updated_at||a.performed_at)));
  const completed=rows.filter(a=>a.status==="Terminé"&&a.audit_data?.domain_scores),drafts=rows.filter(a=>a.status==="Brouillon"),last=completed[0],domains=last?Object.entries(last.audit_data.domain_scores):[];
  return `${pageHead("Audits","Audit Terrain BIA · 50 critères","Dix domaines, cinq critères par domaine et une preuve obligatoire pour chaque note.",'<button class="btn" data-new-audit>＋ DÉMARRER L’AUDIT 50 CRITÈRES</button>')}
    ${drafts.length?`<section class="attention-strip"><div><b>${drafts.length} audit(s) à reprendre</b><span>Les brouillons sont enregistrés sur cet appareil.</span></div><button class="btn" data-edit-audit="${drafts[0].id}">Continuer ${esc(drafts[0].id)}</button></section>`:""}
    <div class="grid cols-4"><article class="card"><div class="metric-label">Audits terminés</div><div class="metric-value">${completed.length}</div></article><article class="card"><div class="metric-label">Brouillons à reprendre</div><div class="metric-value">${drafts.length}</div></article><article class="card"><div class="metric-label">Dernier score</div><div class="metric-value">${last?.score??"—"} <small>/ 100</small></div></article><article class="card"><div class="metric-label">Actions issues d’audit</div><div class="metric-value">${scoped(data.actions).filter(a=>a.origin_type==="Audit").length}</div></article></div>
    ${last?`<section class="panel section"><div class="section-title"><div><h2>Dernier Audit Terrain · ${esc(last.scope)}</h2><p class="hint">${shortDate(last.performed_at)} · ${esc(last.owner)}</p></div>${pill(`${last.score}/100`,last.score>=80?"done":last.score>=60?"progress":"open")}</div><div class="audit-domain-grid">${domains.map(([name,score])=>`<div class="audit-score-card"><div class="section-title"><b>${esc(name)}</b><span>${Number(score).toFixed(1)}/5</span></div><div class="progress"><span style="width:${score/5*100}%"></span></div></div>`).join("")}</div></section>`:""}
    <section class="section"><div class="section-title"><h2>Audits enregistrés</h2><button class="btn secondary" data-open-tool="audit-terrain">Ouvrir le guide Audit Terrain</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Statut</th><th>Périmètre</th><th>Score</th><th>Preuves</th><th>Date</th><th>Responsable</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a.id)}</td><td>${pill(a.status,a.status==="Terminé"?"done":"progress")}</td><td>${esc(a.scope||"À compléter")}</td><td><b>${a.score==null?"—":`${a.score}/100`}</b></td><td>${a.audit_data?.proof_count??(a.proof?1:"—")}</td><td>${shortDate(a.performed_at)}</td><td>${esc(a.owner||"À compléter")}</td><td><button class="btn small secondary" data-edit-audit="${a.id}">${a.status==="Brouillon"?"Continuer":"Consulter"}</button></td></tr>`).join("")||'<tr><td colspan="8">Aucun audit.</td></tr>'}</tbody></table></div></section>`;
}

function renderResolution(){
  const problems=scoped(data.problems);
  if(!problems.length)return `${pageHead("Résolution de problèmes","A3 · 8D · 5 Pourquoi · Ishikawa · QRQC","Créer un dossier depuis un signal évite toute ressaisie.",'<button class="btn" data-new-problem>＋ Nouveau problème</button>')}${empty("Aucun problème sur ce périmètre.")}`;
  const selected=problems.find(p=>p.id===state.selectedProblemId)||problems[0],c=selected.content||{};state.selectedProblemId=selected.id;
  const a3Steps=selected.method==="8D"
    ?[["D0 Préparation",c.context],["D1 Équipe",c.team||selected.owner],["D2 Description du problème",c.current],["D3 Actions de sécurisation",c.containment],["D4 Causes d’apparition",c.root_cause||c.causes],["D4 Cause de non-détection",c.escape_cause],["D5 Actions correctives permanentes",c.countermeasures||c.actions],["D6 Mise en œuvre et résultats",c.verification],["D7 Prévenir la récurrence",c.standard],["D8 Reconnaître et clôturer",c.learning]]
    :[["1. Identification du problème",c.context],["2. Contexte et enjeu",c.background],["3. Situation actuelle",c.current],["4. Objectif mesurable",c.target],["5. Analyse et stratification",c.analysis],["6. Cause racine prouvée",c.root_cause||c.causes],["7. Contre-mesures retenues",c.countermeasures],["8. Plan d’actions lié",c.actions],["9. Suivi du résultat",c.verification],["10. Vérification d’efficacité",c.effectiveness],["11. Standardisation et apprentissage",`${c.standard||""} ${c.learning||""}`]];
  return `${pageHead("Résolution de problèmes","Comprendre, agir, vérifier","Le problème reste l’objet maître ; A3 et 8D sont des vues structurées du même dossier.",'<button class="btn" data-new-problem>＋ Nouveau problème</button>')}
    <div class="problem-layout"><aside class="problem-list">${problems.map(p=>`<button class="${p.id===selected.id?"active":""}" data-select-problem="${p.id}"><b>${esc(p.id)}</b><br>${esc(p.title)}<br><small>${esc(p.method)} · ${esc(p.status)}</small></button>`).join("")}</aside>
    <section><div class="panel"><div class="row-top"><div><p class="eyebrow">${esc(selected.method)} · ${esc(selected.id)}</p><h2 style="margin:4px 0">${esc(selected.title)}</h2><p class="hint">${esc(getSiteName(selected.site_id))} · ${esc(selected.owner)} · ${selected.signal_ids.length} signal lié · ${selected.action_ids.length} action liée</p></div><button class="btn small" data-edit-problem="${selected.id}">Modifier</button></div><div class="workflow section">${["Cadrage","Analyse","Actions","Vérification","Standardisation","Clos"].map(x=>`<span class="workflow-step ${x===selected.status?"active":""}">${x}</span>`).join("")}</div></div>
    <div class="steps-grid section">${a3Steps.map(([title,text])=>`<article class="step-card"><h3>${esc(title)}</h3><p>${esc(text||"À compléter")}</p></article>`).join("")}</div>
    <div class="row-actions"><button class="btn secondary" data-document-from-problem="${selected.id}">Créer / ouvrir le document ${esc(selected.method)}</button><button class="btn secondary" data-new-action data-origin-id="${selected.id}">Ajouter une action liée</button></div></section></div>`;
}

function renderProjects(){
  const rows=scoped(data.projects||[]),methods=["SMED","VSM","DMAIC","Kaizen","PDCA","TPM","Industrialisation"];
  return `${pageHead("Portefeuille d’amélioration","Chantiers Lean et industriels","Chaque chantier part d’un problème, suit une méthode proportionnée et ne déclare un gain qu’après vérification.",'<button class="btn" data-new-project>＋ Nouveau chantier</button>')}
    <div class="grid cols-4"><article class="card"><div class="metric-label">Chantiers actifs</div><div class="metric-value">${rows.filter(p=>p.status!=="Clos").length}</div></article><article class="card"><div class="metric-label">Bloqués</div><div class="metric-value">${rows.filter(p=>p.status==="Bloqué").length}</div></article><article class="card"><div class="metric-label">Gains vérifiés</div><div class="metric-value">${rows.filter(p=>p.result&&p.result!=="Non vérifié").length}</div></article><article class="card"><div class="metric-label">Méthodes disponibles</div><div class="metric-value">${methods.length}</div></article></div>
    <div class="grid cols-2 section">${rows.map(p=>`<article class="card"><div class="row-top"><div>${pill(p.method,"info")} ${pill(p.status,p.status==="Clos"?"done":p.status==="Bloqué"?"open":"progress")}</div><b>${esc(p.id)}</b></div><h2 style="font-size:17px">${esc(p.title)}</h2><p class="hint">${esc(p.owner)} · cible ${shortDate(p.target_date)}${p.problem_id?` · problème ${esc(p.problem_id)}`:""}</p><div class="progress"><span style="width:${Math.max(0,Math.min(100,p.progress||0))}%"></span></div><div class="grid cols-3 section"><div><div class="metric-label">Référence</div><b>${esc(p.baseline||"À mesurer")}</b></div><div><div class="metric-label">Cible</div><b>${esc(p.target||"À définir")}</b></div><div><div class="metric-label">Résultat</div><b>${esc(p.result||"Non vérifié")}</b></div></div><div class="row-actions"><button class="btn small secondary" data-edit-project="${p.id}">Mettre à jour</button><button class="btn small ghost" data-action-from-project="${p.id}">Ajouter une action</button></div></article>`).join("")||empty("Aucun chantier sur ce périmètre.")}</div>`;
}

function renderTools(){
  if(typeof LEAN_MODULES==="undefined")return `${pageHead("Outils Lean","Bibliothèque indisponible","Le fichier de bibliothèque n’a pas été chargé.")}`;
  if(state.toolId){
    const tool=LEAN_MODULES.find(x=>x.id===state.toolId);
    if(!tool){state.toolId=null;return renderTools()}
    const toolSiteId=state.site==="group"?"marzin":state.site,toolSiteName=getSiteName(toolSiteId),run=(data.toolRuns||[]).find(r=>r.module_id===tool.id&&r.site_id===toolSiteId),done=new Set(run?.checks||[]),pct=Math.round(done.size/Math.max(1,tool.checklist.length)*100);
    const nextIndex=tool.checklist.findIndex((_,i)=>!done.has(i)),nextItem=nextIndex>=0?tool.checklist[nextIndex]:"Démarche terminée : vérifier le résultat et décider de la standardisation.";
    return `<button class="btn secondary" data-back-tools>← Bibliothèque</button><section class="hero section"><p class="eyebrow">${esc(tool.no)} · ${esc(tool.category)}</p><h1>${esc(tool.title)}</h1><p>${esc(tool.objective)}</p><div class="hero-actions"><button class="btn" data-start-tool="${tool.id}">${run?"Continuer":"Démarrer"} sur ${esc(toolSiteName)}</button><button class="btn secondary" data-tool-action="${tool.id}">Créer une action</button><button class="btn secondary" data-print>Imprimer / PDF</button></div></section>
      ${run?`<section class="panel section journey-next" id="toolChecklist"><div class="section-title"><div><p class="eyebrow">${esc(run.id)} · ${esc(run.status)}</p><h2>${run.status==="Terminé"?"Démarche terminée":"À faire maintenant"}</h2></div><span class="badge">${pct} %</span></div><p class="journey-next-action">${nextIndex>=0?`${nextIndex+1}. `:""}${esc(nextItem)}</p><p class="hint">Votre avancement est enregistré dans <b>Bibliothèque → Mes démarches</b> sur ${esc(toolSiteName)}.</p></section>`:`<section class="alert section"><b>Pour commencer :</b> cliquez sur « Démarrer ». La démarche apparaîtra ensuite dans <b>Bibliothèque → Mes démarches</b> et la checklist conservera votre avancement.</section>`}
      <div class="grid cols-2 section"><article class="panel"><h2>Quand l’utiliser</h2><p class="hint">${esc(tool.when)}</p><h2 class="section">Séquence terrain</h2><div class="list">${tool.steps.map((x,i)=>`<div class="row"><b>${i+1}. ${esc(x)}</b></div>`).join("")}</div></article><article class="panel"><div class="section-title"><h2>Checklist d’avancement</h2><span class="badge">${pct} %</span></div><div class="progress"><span style="width:${pct}%"></span></div><p class="hint">Cochez chaque élément réalisé. L’enregistrement est automatique.</p><div class="check-list section">${tool.checklist.map((x,i)=>`<label class="check"><input type="checkbox" data-tool-check="${i}" data-module="${tool.id}" ${done.has(i)?"checked":""}> ${esc(x)}</label>`).join("")}</div></article></div>
      <div class="grid cols-2 section"><article class="panel"><h2>Livrables attendus</h2><div class="check-list">${tool.deliverables.map(x=>`<div class="check">✓ ${esc(x)}</div>`).join("")}</div></article><article class="panel"><h2>Pièges à éviter</h2><div class="check-list">${tool.pitfalls.map(x=>`<div class="check bad">⚠ ${esc(x)}</div>`).join("")}</div></article></div>`;
  }
  const q=state.toolQuery.trim().toLowerCase(),categories=["Tous",...new Set(LEAN_MODULES.map(x=>x.category))],visible=LEAN_MODULES.filter(x=>(state.toolCategory==="Tous"||x.category===state.toolCategory)&&(!q||[x.title,x.category,x.objective,x.when,...x.checklist].join(" ").toLowerCase().includes(q)));
  const runs=(data.toolRuns||[]).filter(r=>scoped([r]).length).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  return `${pageHead("Bibliothèque opérationnelle","30 outils Lean et industriels","La richesse métier de la V4, replacée dans les parcours V5 et débarrassée du Plan des 100 premiers jours.")}
    <section class="section" id="myJourneys"><div class="section-title"><div><h2>Mes démarches</h2><p class="hint">Retrouvez ici chaque parcours démarré et reprenez-le là où vous l’avez laissé.</p></div><span class="badge">${runs.filter(r=>r.status!=="Terminé").length} en cours</span></div>${runs.length?`<div class="grid cols-3">${runs.map(r=>{const t=LEAN_MODULES.find(x=>x.id===r.module_id);if(!t)return "";const count=(r.checks||[]).length,pct=Math.round(count/Math.max(1,t.checklist.length)*100),next=t.checklist.find((_,i)=>!(r.checks||[]).includes(i));return `<article class="card journey-card"><div class="row-top"><span class="eyebrow">${esc(r.id)} · ${esc(getSiteName(r.site_id))}</span>${pill(r.status,r.status==="Terminé"?"done":"progress")}</div><h3>${esc(t.title)}</h3><p class="row-meta">Responsable : ${esc(r.owner||"Pierre Thibaut")} · démarrée le ${shortDate(r.started_at)}</p><div class="progress"><span style="width:${pct}%"></span></div><p class="hint">${pct} % · ${next?`Prochaine étape : ${esc(next)}`:"Toutes les étapes sont cochées"}</p><button class="btn ${r.status==="Terminé"?"secondary":""}" data-open-tool="${t.id}" data-run-site="${r.site_id}">${r.status==="Terminé"?"Consulter":"Continuer la démarche"} →</button></article>`}).join("")}</div>`:`<div class="empty"><b>Aucune démarche démarrée.</b><br>Ouvrez un outil ci-dessous puis cliquez sur « Démarrer ».</div>`}</section>
    <div class="panel"><div class="form-grid"><label class="wide">Rechercher un problème, une méthode ou un livrable<input id="toolSearch" value="${esc(state.toolQuery)}" placeholder="Ex. changement de série, défaut, TRS, flux, audit…"></label></div><div class="filters">${categories.map(c=>`<button class="chip ${c===state.toolCategory?"active":""}" data-tool-category="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <section class="section"><div class="section-title"><h2>J’ai un problème</h2><span class="badge">${LEAN_ROUTES.length} routes</span></div><div class="grid cols-3">${LEAN_ROUTES.slice(0,6).map(r=>`<button class="card" data-route-tool="${r[0]}" style="text-align:left"><b>${esc(r[1])}</b><p class="hint">${esc(r[2])} →</p></button>`).join("")}</div></section>
    <section class="section"><div class="section-title"><h2>Bibliothèque</h2><span class="badge">${visible.length} / ${LEAN_MODULES.length}</span></div><div class="grid cols-3">${visible.map(t=>`<button class="card document-card" data-open-tool="${t.id}" style="text-align:left"><span class="eyebrow">${esc(t.no)} · ${esc(t.category)}</span><h3>${esc(t.title)}</h3><p class="hint">${esc(t.objective)}</p><span class="btn secondary">Ouvrir l’outil →</span></button>`).join("")||empty("Aucun outil ne correspond à cette recherche.")}</div></section>`;
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
  {type:"ISHIKAWA",group:"Analyse",title:"Ishikawa / 5M",desc:"Organiser les causes possibles puis les tester"},
  {type:"ACTION_PLAN",group:"Management",title:"Plan d’action",desc:"Vue imprimable d’actions existantes"},
  {type:"SQCDP",group:"Management",title:"SQCDP",desc:"Instantané daté du point quotidien"},
  {type:"ESCALATION",group:"Management",title:"Fiche d’escalade",desc:"Décision attendue et contexte"},
  {type:"GEMBA",group:"Terrain",title:"Gemba",desc:"Observation et preuve au poste"},
  {type:"5S",group:"Terrain",title:"Audit 5S",desc:"Audit versionné avec preuves"},
  {type:"STANDARD",group:"Terrain",title:"Standard de poste",desc:"Version, approbation et date d’effet"}
];
const DOCUMENT_SCHEMAS={
  A3:{title:"A3 de résolution de problème",visual:"a3",fields:[
    ["problem","1. Problème à résoudre","Décrire un écart observable, localisé et mesurable."],["background","2. Contexte et enjeu","Pourquoi ce sujet compte-t-il pour le client, la sécurité ou la performance ?"],["current","3. Situation actuelle","Faits, période, périmètre, stratification et valeur de référence."],["target","4. Objectif mesurable","Valeur cible, délai et condition de réussite."],["analysis","5. Analyse des faits","Où, quand et dans quelles conditions l’écart apparaît-il ?"],["root_cause","6. Cause racine prouvée","Cause testée et preuve établissant le lien avec l’écart."],["countermeasures","7. Contre-mesures","Réponses directement reliées aux causes prouvées."],["action_plan","8. Plan d’actions","Qui fait quoi, pour quand et avec quel livrable ?"],["followup","9. Résultats observés","Mesure après action et comparaison à la référence."],["effectiveness","10. Vérification d’efficacité","Période de tenue, vérificateur et conclusion."],["standardization","11. Standardisation et partage","Standard modifié, formation et transférabilité."]]},
  "8D":{title:"Rapport 8D",visual:"8d",fields:[
    ["d0","D0 · Préparer et qualifier l’urgence","Symptôme, risque client et niveau de réaction."],["d1","D1 · Constituer l’équipe","Pilote, métiers représentés, responsabilités et sponsor."],["d2","D2 · Décrire le problème en 5W2H","Quoi, qui, où, quand, comment, combien et pourquoi c’est un problème."],["d3","D3 · Sécuriser / contenir","Protection immédiate du client, des personnes et du processus."],["d4_occurrence","D4 · Cause d’apparition","Cause racine d’occurrence, méthode de test et preuve."],["d4_escape","D4 · Cause de non-détection","Pourquoi le système de contrôle n’a-t-il pas détecté l’écart ?"],["d5","D5 · Choisir les actions correctives permanentes","Options évaluées, risques et validation avant déploiement."],["d6","D6 · Mettre en œuvre et vérifier","Résultats chiffrés après application des corrections."],["d7","D7 · Prévenir la récurrence","Standards, AMDEC, plan de contrôle, formation et transversalisation."],["d8","D8 · Clore et reconnaître l’équipe","Validation de clôture, leçons apprises et reconnaissance."]]},
  QRQC:{title:"QRQC · Réaction qualité rapide",visual:"qrqc",fields:[
    ["event","1. Événement et fait déclencheur","Défaut observé, référence, lot, poste, date et heure."],["containment","2. Sécurisation immédiate","Stock bloqué, tri, client protégé et périmètre contrôlé."],["facts","3. Caractérisation 5W2H","Quoi, où, quand, qui, comment et combien."],["cause","4. Cause probable puis cause prouvée","Distinguer hypothèse, test et résultat du test."],["escape","5. Point de non-détection","Contrôle prévu, contrôle réalisé et raison de l’échappement."],["corrective","6. Action corrective","Action, responsable, échéance et résultat attendu."],["verification","7. Vérification au terrain","Résultat mesuré, période de tenue et preuve."],["escalation","8. Escalade / capitalisation","Niveau d’escalade, A3/8D nécessaire et standard à modifier."]]},
  "5WHY":{title:"Analyse des 5 Pourquoi",visual:"why",fields:[
    ["problem","Problème factuel","Commencer par un fait précis, pas une cause supposée."],["why1","Pourquoi n°1","Pourquoi le problème observable s’est-il produit ?"],["why2","Pourquoi n°2","Pourquoi la réponse précédente est-elle vraie ?"],["why3","Pourquoi n°3","Poursuivre avec un fait vérifiable."],["why4","Pourquoi n°4","Rechercher le mécanisme organisationnel ou technique."],["why5","Pourquoi n°5","Atteindre une cause sur laquelle l’organisation peut agir."],["root_cause","Cause racine retenue et preuve","Test réalisé, résultat et lien causal démontré."],["countermeasure","Contre-mesure et vérification","Action liée à la cause et mesure d’efficacité."]]},
  ISHIKAWA:{title:"Ishikawa / diagramme 5M",visual:"fishbone",fields:[
    ["effect","Effet / problème à expliquer","Formuler l’écart mesurable placé en tête du diagramme."],["method","Méthodes","Standards, modes opératoires, séquence, paramètres."],["machine","Machines","Équipement, outillage, usure, réglages, maintenance."],["manpower","Main-d’œuvre","Compétences, charge, organisation, communication, ergonomie."],["material","Matières","Composants, lots, fournisseurs, stockage et caractéristiques."],["measurement","Mesures","Moyens de contrôle, étalonnage, échantillonnage et fiabilité."],["environment","Milieu","Température, humidité, éclairage, bruit, propreté et environnement."],["tests","Causes prioritaires à tester","Hiérarchiser sans transformer une hypothèse en conclusion."],["root_cause","Cause prouvée","Résultat des tests et preuve du mécanisme causal."],["countermeasure","Contre-mesure retenue","Action, responsable, échéance et vérification d’efficacité."]]},
  ACTION_PLAN:{title:"Plan d’action",visual:"plan",fields:[["objective","Objectif et résultat attendu","Formuler une cible mesurable."],["scope","Périmètre","Processus, atelier ou produit concerné."],["actions","Actions / responsables / échéances","Une action doit commencer par un verbe et produire un livrable."],["risks","Risques et points de blocage","Dépendances, ressources et arbitrages."],["review","Revue et preuve d’efficacité","Rythme de suivi et critère de clôture."]]},
  SQCDP:{title:"Compte rendu SQCDP",visual:"sqcdp",fields:[["safety","S · Sécurité","Écart, décision et action."],["quality","Q · Qualité","Écart, décision et action."],["cost","C · Coût / TRS","Écart, décision et action."],["delivery","D · Délai","Écart, décision et action."],["people","P · Personnel","Écart, décision et action."],["top","TOP du jour","Sujets retenus, responsables et escalades."]]},
  ESCALATION:{title:"Fiche d’escalade",visual:"escalation",fields:[["fact","Fait et impact","Décrire la situation sans interprétation."],["containment","Mesures déjà prises","Sécurisation et résultat immédiat."],["decision","Décision attendue","Arbitrage précis demandé au niveau supérieur."],["options","Options et conséquences","Avantages, risques, coût et délai."],["deadline","Délai de décision","Date limite et conséquence en cas d’absence de décision."]]},
  GEMBA:{title:"Compte rendu Gemba",visual:"gemba",fields:[["purpose","But de l’observation","Question à comprendre au terrain."],["facts","Faits observés","Lieu, heure, séquence réelle et preuves."],["gap","Écart au standard","Standard attendu et situation constatée."],["questions","Questions posées","Réponses des personnes qui réalisent le travail."],["next","Prochaine expérimentation","Action minimale, responsable et date de retour."]]},
  "5S":{title:"Audit 5S",visual:"5s",fields:[["sort","1. Supprimer l’inutile","Constats et preuves."],["set","2. Situer / ranger","Constats et preuves."],["shine","3. Faire scintiller / inspecter","Constats et preuves."],["standardize","4. Standardiser","Constats et preuves."],["sustain","5. Maintenir","Constats et preuves."],["actions","Actions prioritaires","Responsables, échéances et vérification."]]},
  STANDARD:{title:"Standard de poste",visual:"standard",fields:[["purpose","Objet et résultat attendu","Pourquoi ce standard existe-t-il ?"],["scope","Périmètre et prérequis","Poste, produit, compétences, EPI et documents."],["sequence","Séquence de travail","Étapes, points clés et raisons des points clés."],["quality","Points qualité","Critères, moyens de contrôle et réaction en cas d’écart."],["safety","Points sécurité","Risques, protections et interdictions."],["validation","Validation et formation","Auteur, approbateur, personnes formées et date d’effet."]]},
};
function renderDocuments(){
  const docs=scoped(data.documents);
  return `${pageHead("Bibliothèque","Documents opérationnels","Créer, remplir, reprendre, imprimer et exporter sans dupliquer les registres métier.")}
    <div class="journey-map"><div><b>1. Choisir un modèle</b><span>Créer le support adapté</span></div><div><b>2. Remplir</b><span>Conserver le contexte et les preuves</span></div><div><b>3. Reprendre</b><span>Ouvrir le document dans le registre</span></div></div>
    <div class="grid cols-3">${TEMPLATES.map(t=>`<article class="card document-card"><span class="eyebrow">${esc(t.group)}</span><h3>${esc(t.title)}</h3><p class="hint">${esc(t.desc)}</p><button class="btn secondary" data-new-document="${t.type}">Créer un dossier</button></article>`).join("")}</div>
    <section class="section" id="myDocuments"><div class="section-title"><div><h2>Mes documents</h2><p class="hint">Cliquez sur « Ouvrir » pour reprendre la saisie.</p></div><span class="badge">${docs.length}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Document</th><th>Site</th><th>Statut</th><th>Version</th><th>Mis à jour</th><th></th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.id)}</td><td><b>${esc(d.title)}</b></td><td>${esc(getSiteName(d.site_id))}</td><td>${pill(d.status,d.status==="Validé"?"done":"progress")}</td><td>v${d.version}</td><td>${shortDate(d.updated_at)}</td><td><button class="btn small secondary" data-open-document="${d.id}">Ouvrir</button></td></tr>`).join("")||'<tr><td colspan="7">Aucun document.</td></tr>'}</tbody></table></div></section>`;
}
function documentVisual(type,values={}){
  if(type==="A3")return `<div class="method-map a3-map">${["Problème","Situation actuelle","Objectif","Analyse","Cause prouvée","Contre-mesures","Résultats","Standardiser"].map((x,i)=>`<div><b>${i+1}</b><span>${x}</span></div>`).join("")}</div>`;
  if(type==="8D")return `<div class="method-map d8-map">${["D0 Urgence","D1 Équipe","D2 Problème","D3 Contenir","D4 Causes","D5 Corriger","D6 Vérifier","D7 Prévenir","D8 Clore"].map(x=>`<div><b>${x.split(" ")[0]}</b><span>${x.slice(3)}</span></div>`).join("")}</div>`;
  if(type==="QRQC")return `<div class="qrqc-loop"><div>VOIR<br><small>fait réel</small></div><div>SÉCURISER<br><small>client / processus</small></div><div>ANALYSER<br><small>cause prouvée</small></div><div>VÉRIFIER<br><small>efficacité</small></div></div>`;
  if(type==="5WHY")return `<div class="why-ladder">${[1,2,3,4,5].map(n=>`<div><b>Pourquoi ${n} ?</b><span>${esc(values[`why${n}`]||"À renseigner")}</span></div>`).join("")}<div class="root"><b>Cause racine prouvée</b><span>${esc(values.root_cause||"À démontrer")}</span></div></div>`;
  if(type==="ISHIKAWA")return `<div class="fishbone"><div class="fish-effect"><b>EFFET</b><span>${esc(values.effect||"Problème à définir")}</span></div><div class="fish-spine"></div>${[["Méthodes","method"],["Machines","machine"],["Main-d’œuvre","manpower"],["Matières","material"],["Mesures","measurement"],["Milieu","environment"]].map(([label,key],i)=>`<div class="fish-branch branch-${i+1}"><b>${label}</b><span>${esc(values[key]||"Causes possibles")}</span></div>`).join("")}</div>`;
  if(type==="SQCDP")return `<div class="method-map sqcdp-map">${Object.entries(AXES).map(([key,val])=>`<div style="--axis:${val.color}"><b>${key}</b><span>${esc(val.label)}</span></div>`).join("")}</div>`;
  const schema=DOCUMENT_SCHEMAS[type];return `<div class="method-map generic-map">${(schema?.fields||[]).slice(0,6).map(([id,label],i)=>`<div><b>${i+1}</b><span>${esc(label.replace(/^\d+\.\s*/,""))}</span></div>`).join("")}</div>`;
}
function initialDocumentData(type,problem=null,context=""){
  const c=problem?.content||{};
  if(type==="A3")return {problem:c.context||problem?.title||context,background:c.background||"",current:c.current||"",target:c.target||"",analysis:c.analysis||"",root_cause:c.root_cause||c.causes||"",countermeasures:c.countermeasures||"",action_plan:c.actions||"",followup:c.verification||"",effectiveness:c.effectiveness||"",standardization:[c.standard,c.learning].filter(Boolean).join("\n")};
  if(type==="8D")return {d0:c.context||context,d1:c.team||problem?.owner||"",d2:c.current||problem?.title||"",d3:c.containment||"",d4_occurrence:c.root_cause||c.causes||"",d4_escape:c.escape_cause||"",d5:c.countermeasures||"",d6:c.verification||"",d7:c.standard||"",d8:c.learning||""};
  if(type==="QRQC")return {event:c.context||problem?.title||context,containment:c.containment||"",facts:c.current||"",cause:c.root_cause||"",escape:c.escape_cause||"",corrective:c.countermeasures||"",verification:c.verification||"",escalation:c.standard||""};
  const first=DOCUMENT_SCHEMAS[type]?.fields?.[0]?.[0];return first?{[first]:context}:{};
}
function documentProgress(type,values={}){const fields=DOCUMENT_SCHEMAS[type]?.fields||[],done=fields.filter(([id])=>String(values[id]||"").trim()).length;return {done,total:fields.length,pct:Math.round(done/Math.max(1,fields.length)*100)}}
function syncProblemDocument(problem,type,values){
  const maps={
    A3:{context:"problem",background:"background",current:"current",target:"target",analysis:"analysis",root_cause:"root_cause",countermeasures:"countermeasures",actions:"action_plan",verification:"followup",effectiveness:"effectiveness",standard:"standardization"},
    "8D":{context:"d0",team:"d1",current:"d2",containment:"d3",root_cause:"d4_occurrence",escape_cause:"d4_escape",countermeasures:"d5",verification:"d6",standard:"d7",learning:"d8"},
    QRQC:{context:"event",containment:"containment",current:"facts",root_cause:"cause",escape_cause:"escape",countermeasures:"corrective",verification:"verification",standard:"escalation"}
  };
  const map=maps[type];
  if(!map){problem.content={...problem.content,...values};return}
  problem.content={...problem.content,...Object.fromEntries(Object.entries(map).map(([target,source])=>[target,values[source]||""]))};
}

const TRAINING_LEVELS=["0 · Non formé","1 · Sensibilisé","2 · Connaissances acquises","3 · Pratique accompagnée","4 · Autonome / qualifié","5 · Formateur / référent"];
function trainingPeople(){const rows=scoped(data.people);return state.role==="terrain"?rows.filter(p=>p.name==="Pierre Thibaut"):rows}
function trainingRecordStatus(r){if(r.status!=="Validé")return {text:r.status||"À évaluer",tone:"progress"};if(r.expires_at&&r.expires_at<today())return {text:"Expiré",tone:"open"};return {text:"Valide",tone:"done"}}
function renderTraining(){
  const people=trainingPeople(),records=data.trainingRecords.filter(r=>people.some(p=>p.id===r.person_id)),canManage=["lean","director"].includes(state.role),tabs=`<div class="tabs"><button class="tab ${state.trainingTab==="catalog"?"active":""}" data-training-tab="catalog">Catalogue</button><button class="tab ${state.trainingTab==="people"?"active":""}" data-training-tab="people">Personnes</button><button class="tab ${state.trainingTab==="matrix"?"active":""}" data-training-tab="matrix">Matrice de compétences</button></div>`;
  const head=pageHead("Développement des compétences","Formation et qualification","Tracer séparément la présence, l’évaluation, la pratique et la validation du niveau.",canManage?'<button class="btn" data-new-training-record>＋ Enregistrer une formation</button>':"");
  if(state.trainingTab==="people")return `${head}${tabs}<div class="grid cols-3">${people.map(p=>{const rows=records.filter(r=>r.person_id===p.id),valid=rows.filter(r=>trainingRecordStatus(r).text==="Valide").length;return `<article class="card training-person"><div class="row-top"><span class="person-avatar">${esc(p.name.split(" ").map(x=>x[0]).join("").slice(0,2))}</span>${pill(p.status,p.status==="Actif"?"done":"neutral")}</div><h3>${esc(p.name)}</h3><p class="hint">${esc(p.employee_id)} · ${esc(p.job)}<br>${esc(getSiteName(p.site_id))} · ${esc(p.workshop||"Périmètre non précisé")}</p><div class="metric-value">${valid}<small> validation(s)</small></div><div class="row-actions"><button class="btn secondary" data-training-person="${p.id}">Ouvrir le dossier</button></div></article>`}).join("")||empty("Aucune personne sur ce périmètre.")}</div>${canManage?'<button class="btn secondary section" data-new-training-person>＋ Ajouter une personne</button>':""}`;
  if(state.trainingTab==="matrix")return `${head}${tabs}<section class="panel"><div class="section-title"><div><h2>Matrice de compétences</h2><p class="hint">Le niveau est affiché seulement après évaluation et validation nominative.</p></div><span class="badge">${people.length} personne(s)</span></div><div class="table-wrap"><table class="data-table training-matrix"><thead><tr><th>Personne</th>${data.trainingCatalog.map(t=>`<th title="${esc(t.title)}">${esc(t.code.replace("BIA-",""))}</th>`).join("")}</tr></thead><tbody>${people.map(p=>`<tr><td><button class="link-button" data-training-person="${p.id}">${esc(p.name)}</button><small class="row-meta">${esc(p.employee_id)}</small></td>${data.trainingCatalog.map(t=>{const r=records.filter(x=>x.person_id===p.id&&x.training_id===t.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return `<td>${r?`<span class="skill-level level-${r.level}" title="${esc(TRAINING_LEVELS[r.level])}">${r.level}</span>`:"—"}</td>`}).join("")}</tr>`).join("")}</tbody></table></div><div class="level-legend section">${TRAINING_LEVELS.map((x,i)=>`<span><b class="skill-level level-${i}">${i}</b>${esc(x.split(" · ")[1])}</span>`).join("")}</div></section>`;
  return `${head}${tabs}<div class="grid cols-4"><article class="card"><div class="metric-label">Formations publiées</div><div class="metric-value">${data.trainingCatalog.filter(t=>t.status==="Publié").length}</div></article><article class="card"><div class="metric-label">Validations enregistrées</div><div class="metric-value">${records.filter(r=>r.status==="Validé").length}</div></article><article class="card"><div class="metric-label">Qualifications expirées</div><div class="metric-value">${records.filter(r=>trainingRecordStatus(r).text==="Expiré").length}</div></article><article class="card"><div class="metric-label">Personnes suivies</div><div class="metric-value">${people.length}</div></article></div><section class="section"><div class="section-title"><div><h2>Catalogue BIA</h2><p class="hint">Chaque contenu précise objectifs, séquence, durée et mode d’évaluation.</p></div>${canManage?'<button class="btn secondary" data-new-training>＋ Nouvelle formation</button>':""}</div><div class="grid cols-3">${data.trainingCatalog.map(t=>`<article class="card training-card"><div class="row-top"><span class="eyebrow">${esc(t.code)} · ${esc(t.category)}</span>${pill(t.status,t.status==="Publié"?"done":"progress")}</div><h3>${esc(t.title)}</h3><p>${esc(t.objectives)}</p><p class="hint">${t.duration} h · évaluation : ${esc(t.evaluation)}${t.validity_months?` · validité ${t.validity_months} mois`:""}</p><button class="btn secondary" data-open-training="${t.id}">Voir le contenu</button></article>`).join("")}</div></section>`;
}
function openTraining(id){const t=data.trainingCatalog.find(x=>x.id===id);if(!t)return;modal(`${t.code} · ${t.title}`,`<div class="training-sheet"><div class="context-strip"><div><span>Catégorie</span><b>${esc(t.category)}</b></div><div><span>Durée</span><b>${t.duration} heures</b></div><div><span>Validité</span><b>${t.validity_months?`${t.validity_months} mois`:"Sans échéance définie"}</b></div></div><section class="panel"><h3>Objectifs pédagogiques</h3><p>${esc(t.objectives)}</p></section><section class="panel section"><h3>Contenu</h3><div class="training-modules">${t.modules.map((m,i)=>`<div><b>${String(i+1).padStart(2,"0")}</b><span>${esc(m)}</span></div>`).join("")}</div></section><section class="panel section"><h3>Évaluation et preuve attendue</h3><p>${esc(t.evaluation)}</p><p class="hint">La participation seule ne vaut pas qualification. Le niveau individuel doit être évalué et validé.</p></section><div class="form-actions"><button class="btn secondary" data-print>Imprimer la fiche programme</button><button class="btn ghost" data-close-modal>Fermer</button></div></div>`)}
function openTrainingPerson(id){const p=data.people.find(x=>x.id===id);if(!p)return;const rows=data.trainingRecords.filter(r=>r.person_id===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));modal(`Dossier formation · ${p.name}`,`<div class="hr-sheet"><header><div><p class="eyebrow">BIA PRODUCTION SYSTEM · SUIVI RH</p><h2>Fiche individuelle de formation et qualification</h2></div><div class="document-ref">${esc(p.employee_id)}<br>Édité le ${shortDate(today())}</div></header><div class="identity-grid"><div><span>Collaborateur</span><b>${esc(p.name)}</b></div><div><span>Entité</span><b>${esc(getSiteName(p.site_id))}</b></div><div><span>Fonction</span><b>${esc(p.job)}</b></div><div><span>Atelier / service</span><b>${esc(p.workshop||"—")}</b></div><div><span>Responsable</span><b>${esc(p.manager||"—")}</b></div><div><span>Statut</span><b>${esc(p.status)}</b></div></div><div class="table-wrap section"><table class="data-table"><thead><tr><th>Date</th><th>Formation</th><th>Présence</th><th>Évaluation</th><th>Niveau validé</th><th>Validateur</th><th>Échéance</th></tr></thead><tbody>${rows.map(r=>{const t=data.trainingCatalog.find(x=>x.id===r.training_id),st=trainingRecordStatus(r);return `<tr><td>${shortDate(r.date)}</td><td><b>${esc(t?.code||r.training_id)}</b><br>${esc(t?.title||"Formation inconnue")}</td><td>${esc(r.attendance)}</td><td>${r.score==null?"—":`${r.score}/100`}<br><small>${esc(r.evidence||"")}</small></td><td>${pill(TRAINING_LEVELS[r.level]||"À qualifier",st.tone)}</td><td>${esc(r.validated_by||"—")}<br><small>${shortDate(r.validated_at)}</small></td><td>${shortDate(r.expires_at)}</td></tr>`}).join("")||'<tr><td colspan="7">Aucune formation enregistrée.</td></tr>'}</tbody></table></div><div class="signature-grid section"><div>Visa collaborateur<br><span>Date / signature</span></div><div>Visa manager / formateur<br><span>Date / signature</span></div><div>Validation RH<br><span>Date / signature</span></div></div><div class="alert section"><b>Document de suivi RH :</b> sa valeur officielle dépend de la validation RH, de l’identité des signataires et des règles documentaires du Groupe BIA.</div><div class="form-actions"><button class="btn" data-print>Imprimer / PDF RH</button>${["lean","director"].includes(state.role)?`<button class="btn secondary" data-new-training-record data-person-id="${p.id}">Ajouter une formation</button>`:""}<button class="btn ghost" data-close-modal>Fermer</button></div></div>`)}

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
  $("actionForm").onsubmit=event=>{event.preventDefault();const status=$("actionStatus").value,evidence=$("actionEvidence")?.value.trim()||existing?.effectiveness||null;if(status==="Clôturée"&&!evidence)return toast("Une preuve d’efficacité est requise avant clôture.");const payload={site_id:$("actionSite").value,title:$("actionTitle").value.trim(),owner:$("actionOwner").value.trim(),priority:$("actionPriority").value,status,due_date:$("actionDue").value||null,origin_type:existing?.origin_type||origin.origin_type||"Manuel",origin_id:existing?.origin_id||origin.origin_id||null,description:$("actionDescription").value.trim(),effectiveness:evidence,updated_at:now()};let item=existing;if(existing)Object.assign(existing,payload);else{item={id:nextId("A",data.actions),workshop_id:data.workshops.find(w=>w.site_id===payload.site_id)?.id||null,created_at:now(),...payload};data.actions.unshift(item)}if(payload.origin_type==="Problème"&&payload.origin_id){const p=data.problems.find(x=>x.id===payload.origin_id);if(p&&!p.action_ids.includes(item.id))p.action_ids.push(item.id)}save();closeModal();render();toast(`${item.id} ${existing?"mise à jour":"créée"}. Retrouvez-la dans Actions · ${item.status}.`)}
}
function advanceAction(id){
  const a=data.actions.find(x=>x.id===id);if(!a)return;
  if(a.status==="À vérifier")return actionForm(a);
  const i=ACTION_STATES.indexOf(a.status);a.status=ACTION_STATES[Math.min(i+1,2)];a.updated_at=now();save();render();toast(`${a.id} : ${a.status}`);
}
function openSubject(id){
  const signal=data.signals.find(x=>x.id===id);if(signal)return openSignal(id);
  const action=data.actions.find(x=>x.id===id);if(action)return actionForm(action);
  const problem=data.problems.find(x=>x.id===id);if(problem){state.view="resolution";state.selectedProblemId=id;render();return}
  const decision=data.decisions.find(x=>x.id===id);if(decision)return modal(`${decision.id} · Décision`,`<p class="eyebrow">${esc(getSiteName(decision.site_id))}</p><h2>${esc(decision.title)}</h2><p>${esc(decision.detail)}</p><div class="grid cols-2 section"><div class="card"><span class="metric-label">Responsable</span><b>${esc(decision.owner)}</b></div><div class="card"><span class="metric-label">Échéance</span><b>${shortDate(decision.due_date)}</b></div></div><div class="row-actions"><button class="btn" data-new-action data-origin-id="${decision.id}" data-origin-type="Décision">Créer une action</button><button class="btn secondary" data-close-modal>Fermer</button></div>`);
}
function problemFromSignal(signalId){
  const s=data.signals.find(x=>x.id===signalId);if(!s)return;
  const id=nextId("P",data.problems),problem={id,site_id:s.site_id,workshop_id:s.workshop_id,title:s.description,method:"A3",status:"Cadrage",owner:"À désigner",signal_ids:[s.id],action_ids:s.action_id?[s.action_id]:[],created_at:now(),content:{context:`${s.description} · ${s.zone||"zone à préciser"} · signal ${s.id}`,background:"Enjeu et périmètre à compléter.",current:"À mesurer à partir de faits vérifiés.",target:"À définir avec le propriétaire du KPI.",analysis:"Stratification à conduire.",root_cause:"Hypothèses à tester et preuves à joindre.",containment:s.immediate_action||"Sécurisation à préciser.",countermeasures:"À sélectionner après preuve de cause.",actions:s.action_id?`${s.action_id} · action liée`:"Aucune action liée.",verification:"Mesure après action à planifier.",effectiveness:"Période de tenue et vérificateur à définir.",standard:"Décision après preuve d’efficacité.",learning:"Leçon à capitaliser après clôture."}};data.problems.unshift(problem);s.problem_id=id;s.state=s.state==="Nouveau"?"Pris en compte":s.state;data.documents.unshift({id:nextId("DOC",data.documents),site_id:s.site_id,type:"A3",title:`${id} · ${s.description.slice(0,55)}`,status:"Brouillon",problem_id:id,updated_at:now(),version:1});save();closeModal();state.site=s.site_id;state.view="resolution";state.selectedProblemId=id;render();toast(`Problème ${id} créé. Continuez dans Résolution → ${id}.`);
}
function genericProblemForm(){
  modal("Nouveau problème",`<form id="problemForm"><div class="form-grid"><label class="wide">Problème factuel<input id="problemTitle" required></label><label>Méthode<select id="problemMethod"><option>A3</option><option>8D</option><option>QRQC</option></select></label><label>Responsable<input id="problemOwner" required></label><label class="wide">Contexte<textarea id="problemContext" rows="3" required></textarea></label></div><div class="form-actions"><button class="btn">Créer le dossier</button></div></form>`);
  $("problemForm").onsubmit=e=>{e.preventDefault();const id=nextId("P",data.problems),method=$("problemMethod").value,siteId=state.site==="group"?"marzin":state.site;data.problems.unshift({id,site_id:siteId,workshop_id:data.workshops.find(w=>w.site_id===siteId)?.id||null,title:$("problemTitle").value.trim(),method,status:"Cadrage",owner:$("problemOwner").value.trim(),signal_ids:[],action_ids:[],created_at:now(),content:{context:$("problemContext").value.trim(),background:"À compléter",team:"À constituer",current:"À mesurer",target:"À définir",analysis:"À stratifier",containment:"À définir si nécessaire",root_cause:"À prouver",escape_cause:"À analyser pour un 8D",countermeasures:"À sélectionner",actions:"À lier au plan général",verification:"À planifier",effectiveness:"À démontrer",standard:"À décider",learning:"À capitaliser"}});data.documents.unshift({id:nextId("DOC",data.documents),site_id:siteId,type:method,title:`${id} · ${$("problemTitle").value.trim()}`,status:"Brouillon",problem_id:id,updated_at:now(),version:1});save();closeModal();state.site=siteId;state.selectedProblemId=id;render();toast(`Dossier ${id} créé. Continuez dans Résolution → ${id}.`)}
}
function gembaForm(){
  modal("Nouveau Gemba",`<form id="gembaForm"><div class="form-grid"><label>Zone / poste<input id="gembaZone" required></label><label>Catégorie<select id="gembaCategory">${SIGNAL_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></label><label>Auteur<input id="gembaAuthor" value="Animateur"></label><label class="wide">Observation factuelle<textarea id="gembaFinding" rows="4" required></textarea></label><label class="wide"><input id="gembaSignal" type="checkbox"> Transformer aussi cette observation en Signal Terrain</label></div><div class="form-actions"><button class="btn">Enregistrer</button></div></form>`);
  $("gembaForm").onsubmit=e=>{e.preventDefault();const siteId=state.site==="group"?"marzin":state.site,item={id:nextId("G",data.gembas),site_id:siteId,workshop_id:data.workshops.find(w=>w.site_id===siteId)?.id||null,zone:$("gembaZone").value.trim(),finding:$("gembaFinding").value.trim(),category:$("gembaCategory").value,created_at:now(),author:$("gembaAuthor").value.trim()};data.gembas.unshift(item);if($("gembaSignal").checked)data.signals.unshift({id:nextId("S",data.signals),site_id:siteId,workshop_id:item.workshop_id,zone:item.zone,type:item.category,description:item.finding,severity:"À qualifier",state:"Nouveau",immediate_action:"",author:item.author,created_at:now(),updated_at:now(),action_id:null,problem_id:null});save();closeModal();render();toast("Gemba enregistré.")};
}
function simpleDocument(type){
  const template=TEMPLATES.find(t=>t.type===type),siteId=state.site==="group"?"marzin":state.site;
  const schema=DOCUMENT_SCHEMAS[type];modal(`Créer · ${schema?.title||template?.title||type}`,`<form id="documentForm"><div class="form-grid"><label class="wide">Titre<input id="documentTitle" required value="${esc(template?.title||type)} · "></label><label>Site<select id="documentSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Responsable<input id="documentOwner" placeholder="Nom ou fonction" required></label><label class="wide">Problème ou objectif initial<textarea id="documentContext" rows="3" placeholder="Décrire le fait de départ sans supposer la cause"></textarea></label></div>${documentVisual(type)}<div class="alert section"><b>Après création :</b> la trame complète ${esc(schema?.title||type)} s’ouvrira étape par étape.</div><div class="form-actions"><button class="btn">Créer et ouvrir la trame</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("documentForm").onsubmit=e=>{e.preventDefault();const item={id:nextId("DOC",data.documents),site_id:$("documentSite").value,type,title:$("documentTitle").value.trim(),status:"Brouillon",problem_id:null,owner:$("documentOwner").value.trim(),content:$("documentContext").value.trim(),structured_data:initialDocumentData(type,null,$("documentContext").value.trim()),updated_at:now(),version:1};data.documents.unshift(item);save();state.site=item.site_id;closeModal();editDocument(item.id);toast(`Document ${item.id} créé. Complétez maintenant la trame ${schema?.title||type}.`)}
}
function editDocument(id){
  const d=data.documents.find(x=>x.id===id);if(!d)return;const schema=DOCUMENT_SCHEMAS[d.type]||DOCUMENT_SCHEMAS.ACTION_PLAN,problem=data.problems.find(p=>p.id===d.problem_id);if(!d.structured_data)d.structured_data=initialDocumentData(d.type,problem,d.content||"");const progress=documentProgress(d.type,d.structured_data);
  modal(`${d.id} · ${schema.title}`,`<form id="editDocumentForm" class="structured-document"><div class="document-toolbar"><div><p class="eyebrow">${esc(getSiteName(d.site_id))} · ${esc(d.type)} · version ${d.version||1}</p><h2>${esc(d.title)}</h2></div><div class="document-progress"><b>${progress.pct} %</b><span>${progress.done}/${progress.total} parties renseignées</span><div class="progress"><span style="width:${progress.pct}%"></span></div></div></div>${documentVisual(d.type,d.structured_data)}<div class="form-grid document-meta section"><label class="wide">Titre<input id="editDocumentTitle" value="${esc(d.title)}" required></label><label>Responsable<input id="editDocumentOwner" value="${esc(d.owner||problem?.owner||"")}" required></label><label>Statut<select id="editDocumentStatus">${["Brouillon","En révision","Validé"].map(x=>`<option ${x===d.status?"selected":""}>${x}</option>`).join("")}</select></label></div><div class="document-sections">${schema.fields.map(([field,label,hint],index)=>`<section class="document-step"><div class="step-number">${index+1}</div><div class="step-content"><label>${esc(label)}<span>${esc(hint)}</span><textarea data-doc-field="${field}" rows="4" placeholder="À renseigner avec des faits et des preuves">${esc(d.structured_data[field]||"")}</textarea></label></div></section>`).join("")}</div><div class="alert section"><b>Règle de validation :</b> un statut « Validé » confirme que le responsable a relu la trame. Il ne remplace pas les signatures et règles documentaires officielles de BIA.</div><div class="form-actions sticky-actions"><button class="btn">Enregistrer une nouvelle version</button><button type="button" class="btn secondary" data-print>Imprimer / PDF</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div></form>`);
  $("editDocumentForm").onsubmit=e=>{e.preventDefault();const values={};document.querySelectorAll("[data-doc-field]").forEach(x=>values[x.dataset.docField]=x.value.trim());const requested=$("editDocumentStatus").value,p=documentProgress(d.type,values);if(requested==="Validé"&&p.pct<100)return toast("Complétez toutes les parties avant de valider le document.");d.title=$("editDocumentTitle").value.trim();d.owner=$("editDocumentOwner").value.trim();d.status=requested;d.structured_data=values;d.content=values[schema.fields[0][0]]||"";d.version=(d.version||1)+1;d.updated_at=now();if(problem){problem.owner=d.owner;syncProblemDocument(problem,d.type,values);problem.updated_at=now()}save();closeModal();render();toast(`${d.id} enregistré en version ${d.version} · avancement ${p.pct} %.`)};
}
function trainingRecordForm(personId=null){
  const people=trainingPeople(),selected=personId||people[0]?.id;if(!people.length)return toast("Ajoutez d’abord une personne au registre.");
  modal("Enregistrer une formation / qualification",`<form id="trainingRecordForm"><div class="form-grid"><label>Collaborateur<select id="recordPerson">${people.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)} · ${esc(getSiteName(p.site_id))}</option>`).join("")}</select></label><label>Formation<select id="recordTraining">${data.trainingCatalog.map(t=>`<option value="${t.id}">${esc(t.code)} · ${esc(t.title)}</option>`).join("")}</select></label><label>Date de réalisation<input id="recordDate" type="date" value="${today()}" required></label><label>Formateur<input id="recordTrainer" required></label><label>Présence<select id="recordAttendance"><option>Présent</option><option>Partiel</option><option>Absent</option></select></label><label>Score /100<input id="recordScore" type="number" min="0" max="100" placeholder="Si applicable"></label><label>Niveau démontré<select id="recordLevel">${TRAINING_LEVELS.map((x,i)=>`<option value="${i}">${esc(x)}</option>`).join("")}</select></label><label>Décision<select id="recordStatus"><option>À évaluer</option><option>Validé</option><option>Non validé</option></select></label><label class="wide">Preuve d’évaluation<textarea id="recordEvidence" rows="3" placeholder="Quiz, mise en situation, observation au poste, dossier soutenu…"></textarea></label><label>Validé par<input id="recordValidator" placeholder="Nom et fonction"></label><label>Date de validation<input id="recordValidatedAt" type="date"></label></div><div class="alert section"><b>Règle :</b> « Présent » ne signifie pas « autonome ». Un niveau 3 à 5 exige une évaluation pratique et un validateur identifié.</div><div class="form-actions"><button class="btn">Enregistrer dans le dossier RH</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("trainingRecordForm").onsubmit=e=>{e.preventDefault();const training=data.trainingCatalog.find(t=>t.id===$("recordTraining").value),status=$("recordStatus").value,level=Number($("recordLevel").value),evidence=$("recordEvidence").value.trim(),validator=$("recordValidator").value.trim(),validatedAt=$("recordValidatedAt").value;if(status==="Validé"&&(level>=3)&&(!evidence||!validator||!validatedAt))return toast("Une pratique validée exige une preuve, un validateur et une date de validation.");const expiry=training?.validity_months&&validatedAt?new Date(new Date(validatedAt).setMonth(new Date(validatedAt).getMonth()+training.validity_months)).toISOString().slice(0,10):null,item={id:nextId("REC",data.trainingRecords),person_id:$("recordPerson").value,training_id:$("recordTraining").value,date:$("recordDate").value,trainer:$("recordTrainer").value.trim(),attendance:$("recordAttendance").value,score:$("recordScore").value===""?null:Number($("recordScore").value),level,status,evidence,validated_by:validator,validated_at:validatedAt||null,expires_at:expiry,created_at:now()};data.trainingRecords.unshift(item);save();closeModal();state.trainingTab="people";render();toast(`${item.id} enregistré dans Formation → dossier individuel.`)};
}
function trainingPersonForm(){
  const siteId=state.site==="group"?"marzin":state.site;modal("Ajouter une personne au suivi formation",`<form id="trainingPersonForm"><div class="form-grid"><label>Matricule<input id="personEmployeeId" required placeholder="Identifiant RH"></label><label>Nom et prénom<input id="personName" required></label><label>Entité<select id="personSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Atelier / service<input id="personWorkshop"></label><label>Fonction<input id="personJob" required></label><label>Responsable hiérarchique<input id="personManager"></label></div><div class="form-actions"><button class="btn">Créer le dossier</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);$("trainingPersonForm").onsubmit=e=>{e.preventDefault();const item={id:nextId("PER",data.people),employee_id:$("personEmployeeId").value.trim(),name:$("personName").value.trim(),site_id:$("personSite").value,workshop:$("personWorkshop").value.trim(),job:$("personJob").value.trim(),manager:$("personManager").value.trim(),status:"Actif"};data.people.push(item);save();closeModal();state.trainingTab="people";render();toast(`Dossier ${item.id} créé pour ${item.name}.`)}
}
function trainingForm(){
  modal("Nouvelle formation",`<form id="trainingForm"><div class="form-grid"><label>Code<input id="trainingCode" required placeholder="BIA-XXX-01"></label><label>Catégorie<input id="trainingCategory" required></label><label class="wide">Intitulé<input id="trainingTitle" required></label><label>Durée (heures)<input id="trainingDuration" type="number" min="0.5" step="0.5" required></label><label>Validité (mois)<input id="trainingValidity" type="number" min="1" placeholder="Vide si aucune"></label><label class="wide">Objectifs<textarea id="trainingObjectives" rows="3" required></textarea></label><label class="wide">Modules <small>(un par ligne)</small><textarea id="trainingModules" rows="5" required></textarea></label><label class="wide">Mode d’évaluation<input id="trainingEvaluation" required></label></div><div class="form-actions"><button class="btn">Créer le programme</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);$("trainingForm").onsubmit=e=>{e.preventDefault();const item={id:nextId("FOR",data.trainingCatalog),code:$("trainingCode").value.trim(),title:$("trainingTitle").value.trim(),category:$("trainingCategory").value.trim(),duration:Number($("trainingDuration").value),validity_months:$("trainingValidity").value?Number($("trainingValidity").value):null,objectives:$("trainingObjectives").value.trim(),modules:$("trainingModules").value.split("\n").map(x=>x.trim()).filter(Boolean),evaluation:$("trainingEvaluation").value.trim(),status:"Brouillon"};data.trainingCatalog.push(item);save();closeModal();render();toast(`Formation ${item.code} créée en brouillon.`)}
}
function editProblem(id){
  const p=data.problems.find(x=>x.id===id);if(!p)return;const c=p.content||{};
  modal(`${p.id} · Modifier le dossier`,`<form id="editProblemForm"><div class="form-grid">
    <label class="wide">Titre<input id="problemEditTitle" value="${esc(p.title)}" required></label>
    <label>Méthode<select id="problemEditMethod">${["A3","8D","QRQC"].map(x=>`<option ${x===p.method?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Statut<select id="problemEditStatus">${["Cadrage","Analyse","Actions","Vérification","Standardisation","Clos"].map(x=>`<option ${x===p.status?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Responsable<input id="problemEditOwner" value="${esc(p.owner)}" required></label>
    <label class="wide">1. Identification du problème<textarea id="problemEditContext" rows="3">${esc(c.context||"")}</textarea></label>
    <label class="wide">2. Contexte et enjeu / équipe 8D<textarea id="problemEditBackground" rows="2">${esc(c.background||c.team||"")}</textarea></label>
    <label class="wide">État actuel<textarea id="problemEditCurrent" rows="2">${esc(c.current||"")}</textarea></label>
    <label class="wide">Cible<textarea id="problemEditTarget" rows="2">${esc(c.target||"")}</textarea></label>
    <label class="wide">Analyse et stratification<textarea id="problemEditAnalysis" rows="3">${esc(c.analysis||"")}</textarea></label>
    <label class="wide">Sécurisation / contention<textarea id="problemEditContainment" rows="2">${esc(c.containment||"")}</textarea></label>
    <label class="wide">Cause racine et preuves<textarea id="problemEditCauses" rows="3">${esc(c.root_cause||c.causes||"")}</textarea></label>
    <label class="wide">Cause de non-détection (8D)<textarea id="problemEditEscape" rows="2">${esc(c.escape_cause||"")}</textarea></label>
    <label class="wide">Contre-mesures retenues<textarea id="problemEditCountermeasures" rows="3">${esc(c.countermeasures||"")}</textarea></label>
    <label class="wide">Actions / contre-mesures<textarea id="problemEditActions" rows="3">${esc(c.actions||"")}</textarea></label>
    <label class="wide">Suivi du résultat<textarea id="problemEditVerification" rows="3">${esc(c.verification||"")}</textarea></label>
    <label class="wide">Vérification d’efficacité et période de tenue<textarea id="problemEditEffectiveness" rows="3">${esc(c.effectiveness||"")}</textarea></label>
    <label class="wide">Standardisation / apprentissage<textarea id="problemEditStandard" rows="3">${esc(c.standard||"")}</textarea></label>
    <label class="wide">Leçon apprise / reconnaissance équipe<textarea id="problemEditLearning" rows="2">${esc(c.learning||"")}</textarea></label>
  </div><div class="form-actions"><button class="btn">Enregistrer la révision</button></div></form>`);
  $("editProblemForm").onsubmit=e=>{e.preventDefault();const status=$("problemEditStatus").value,verification=$("problemEditVerification").value.trim(),effectiveness=$("problemEditEffectiveness").value.trim();if(status==="Clos"&&!effectiveness)return toast("La vérification d’efficacité est obligatoire avant clôture.");Object.assign(p,{title:$("problemEditTitle").value.trim(),method:$("problemEditMethod").value,status,owner:$("problemEditOwner").value.trim(),updated_at:now(),content:{...p.content,context:$("problemEditContext").value.trim(),background:$("problemEditBackground").value.trim(),team:$("problemEditBackground").value.trim(),current:$("problemEditCurrent").value.trim(),target:$("problemEditTarget").value.trim(),analysis:$("problemEditAnalysis").value.trim(),containment:$("problemEditContainment").value.trim(),root_cause:$("problemEditCauses").value.trim(),causes:$("problemEditCauses").value.trim(),escape_cause:$("problemEditEscape").value.trim(),countermeasures:$("problemEditCountermeasures").value.trim(),actions:$("problemEditActions").value.trim(),verification,effectiveness,standard:$("problemEditStandard").value.trim(),learning:$("problemEditLearning").value.trim()}});const doc=data.documents.find(d=>d.problem_id===p.id);if(doc){doc.title=`${p.id} · ${p.title}`;doc.type=p.method;doc.version=(doc.version||1)+1;doc.updated_at=now()}save();closeModal();render();toast("Dossier et document mis à jour.")};
}
function auditForm(existing=null){
  const siteId=existing?.site_id||(state.site==="group"?"marzin":state.site),auditSites=canGroup()?OPERATIONAL_SITES:OPERATIONAL_SITES.filter(s=>s.id===siteId),saved=new Map((existing?.audit_data?.criteria||[]).map(c=>[`${c.domain}|||${c.criterion}`,c]));
  modal(existing?`${existing.id} · ${existing.status}`:"Audit Terrain BIA · 50 critères",`<form id="auditForm"><div class="form-grid"><label>Site<select id="auditSite">${auditSites.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Périmètre<input id="auditScope" value="${esc(existing?.scope||"")}" required placeholder="Atelier / zone / processus"></label><label>Responsable du périmètre<input id="auditOwner" value="${esc(existing?.owner||"")}" required></label><label>Auditeur<input id="auditAuditor" value="${esc(existing?.audit_data?.auditor||"")}" required></label><label>Date<input id="auditDate" type="date" value="${existing?.performed_at||today()}" required></label><label>Type<select id="auditType">${["Audit Terrain BIA","Audit 5S détaillé","Audit de maturité","Audit standard"].map(x=>`<option ${x===existing?.type?"selected":""}>${x}</option>`).join("")}</select></label></div>
    <div class="alert section"><b>Vous pouvez enregistrer un brouillon à tout moment.</b> Pour terminer l’audit, les 50 notes et les 50 preuves sont obligatoires.</div>
    <div class="audit-form section">${Object.entries(AUDIT_CRITERIA).map(([domain,criteria],di)=>`<fieldset class="audit-fieldset"><legend>${di+1}. ${esc(domain)}</legend>${criteria.map((criterion,ci)=>{const old=saved.get(`${domain}|||${criterion}`)||{};return `<div class="audit-criterion"><div><b>${di+1}.${ci+1} ${esc(criterion)}</b></div><label>Note<select data-audit-score data-domain="${esc(domain)}" data-criterion="${esc(criterion)}"><option value="">—</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${Number(old.score)===n&&old.score!==null&&old.score!==undefined?"selected":""}>${n}</option>`).join("")}</select></label><label>Preuve / observation<input data-audit-proof value="${esc(old.proof||"")}" placeholder="Fait observé, document ou absence constatée"></label></div>`}).join("")}</fieldset>`).join("")}</div>
    <label class="field section">Synthèse et priorité<textarea id="auditSummary" rows="4">${esc(existing?.audit_data?.summary||"")}</textarea></label><label class="check section"><input id="auditAction" type="checkbox" checked> Créer une action pour chaque domaine dont la moyenne est inférieure à 3/5</label><div class="form-actions"><button class="btn">Terminer l’audit</button><button type="button" class="btn secondary" id="saveAuditDraft">Enregistrer le brouillon</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div></form>`);
  const persist=complete=>{const scores=[...document.querySelectorAll("[data-audit-score]")],proofs=[...document.querySelectorAll("[data-audit-proof]")],scope=$("auditScope").value.trim(),owner=$("auditOwner").value.trim(),auditor=$("auditAuditor").value.trim();if(complete&&(!scope||!owner||!auditor||scores.some(x=>x.value==="")||proofs.some(x=>!x.value.trim())))return toast("Pour terminer : renseignez le périmètre, les responsables, les 50 notes et les 50 preuves.");const criteria=scores.map((x,i)=>({domain:x.dataset.domain,criterion:x.dataset.criterion,score:x.value===""?null:Number(x.value),proof:proofs[i].value.trim()})),domainScores={};if(complete)for(const domain of Object.keys(AUDIT_CRITERIA)){const values=criteria.filter(x=>x.domain===domain).map(x=>x.score);domainScores[domain]=values.reduce((a,b)=>a+b,0)/values.length}const score=complete?Math.round(criteria.reduce((sum,x)=>sum+x.score,0)/criteria.length/5*100):null,id=existing?.id||nextId("AUD",data.audits),site=$("auditSite").value,payload={id,site_id:site,type:$("auditType").value,scope:scope||"À compléter",score,status:complete?"Terminé":"Brouillon",performed_at:$("auditDate").value,owner:owner||"À compléter",updated_at:now(),audit_data:{auditor:auditor||"À compléter",summary:$("auditSummary").value.trim(),domain_scores:complete?domainScores:null,criteria,proof_count:criteria.filter(x=>x.proof).length}};if(existing)Object.assign(existing,payload);else data.audits.unshift(payload);if(complete&&$("auditAction").checked&&!data.actions.some(a=>a.origin_type==="Audit"&&a.origin_id===id))Object.entries(domainScores).filter(([,value])=>value<3).forEach(([domain,value])=>data.actions.unshift({id:nextId("A",data.actions),site_id:site,workshop_id:data.workshops.find(w=>w.site_id===site)?.id||null,title:`Audit · Renforcer ${domain}`,owner:owner||"À désigner",priority:value<2?"Haute":"Normale",status:"Ouverte",due_date:null,origin_type:"Audit",origin_id:id,description:`${payload.audit_data.summary} · moyenne ${value.toFixed(1)}/5`,effectiveness:null,created_at:now()}));save();closeModal();state.site=site;state.view="audits";render();toast(complete?`Audit ${id} terminé : ${score}/100. Retrouvez-le dans Audits enregistrés.`:`Brouillon ${id} enregistré. Retrouvez-le dans Audits → Audits à reprendre.`)};
  $("auditForm").onsubmit=e=>{e.preventDefault();persist(true)};$("saveAuditDraft").onclick=()=>persist(false);
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
function projectForm(existing=null){
  const siteId=existing?.site_id||(state.site==="group"?"marzin":state.site);
  modal(existing?`${existing.id} · Mettre à jour le chantier`:"Nouveau chantier",`<form id="projectForm"><div class="form-grid"><label class="wide">Titre<input id="projectTitle" value="${esc(existing?.title||"")}" required></label><label>Méthode<select id="projectMethod">${["SMED","VSM","DMAIC","Kaizen","PDCA","TPM","Industrialisation"].map(x=>`<option ${x===existing?.method?"selected":""}>${x}</option>`).join("")}</select></label><label>Site<select id="projectSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Responsable<input id="projectOwner" value="${esc(existing?.owner||"")}" required></label><label>Statut<select id="projectStatus">${["Cadrage","Mesure","Analyse","Essai","Déploiement","Bloqué","Clos"].map(x=>`<option ${x===(existing?.status||"Cadrage")?"selected":""}>${x}</option>`).join("")}</select></label><label>Avancement (%)<input id="projectProgress" type="number" min="0" max="100" value="${existing?.progress||0}" required></label><label>Date cible<input id="projectDate" type="date" value="${existing?.target_date||""}"></label><label>Référence avant<input id="projectBaseline" value="${esc(existing?.baseline||"")}" placeholder="Valeur et unité"></label><label>Cible<input id="projectTarget" value="${esc(existing?.target||"")}" placeholder="Résultat attendu"></label><label class="wide">Résultat vérifié<input id="projectResult" value="${esc(existing?.result||"Non vérifié")}" placeholder="Mesure après et période de tenue"></label><label>Problème lié<input id="projectProblem" value="${esc(existing?.problem_id||"")}" placeholder="Ex. P-012"></label></div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("projectForm").onsubmit=e=>{e.preventDefault();const status=$("projectStatus").value,result=$("projectResult").value.trim();if(status==="Clos"&&(!result||result==="Non vérifié"))return toast("Un chantier ne peut être clos sans résultat vérifié.");const payload={site_id:$("projectSite").value,title:$("projectTitle").value.trim(),method:$("projectMethod").value,status,owner:$("projectOwner").value.trim(),progress:Number($("projectProgress").value),target_date:$("projectDate").value||null,baseline:$("projectBaseline").value.trim()||"À mesurer",target:$("projectTarget").value.trim()||"À définir",result:result||"Non vérifié",problem_id:$("projectProblem").value.trim()||null,action_ids:existing?.action_ids||[],updated_at:now()};if(existing)Object.assign(existing,payload);else data.projects.unshift({id:nextId("CH",data.projects),created_at:now(),...payload});save();closeModal();state.site=payload.site_id;render();toast(existing?"Chantier mis à jour.":"Chantier créé.")};
}
function startTool(moduleId){
  const target=state.site==="group"?"marzin":state.site;let run=(data.toolRuns||[]).find(r=>r.module_id===moduleId&&r.site_id===target);if(!run){run={id:nextId("RUN",data.toolRuns),site_id:target,module_id:moduleId,owner:"Pierre Thibaut",status:"En cours",checks:[],started_at:now(),updated_at:now()};data.toolRuns.push(run);save()}state.view="tools";state.toolId=moduleId;render();document.getElementById("toolChecklist")?.scrollIntoView?.({behavior:"smooth",block:"start"});toast(`${run.id} enregistré dans Bibliothèque → Mes démarches. Suivez maintenant la checklist.`);
}
function updateToolCheck(input){
  const target=state.site==="group"?"marzin":state.site;let run=(data.toolRuns||[]).find(r=>r.module_id===input.dataset.module&&r.site_id===target);if(!run){startTool(input.dataset.module);run=data.toolRuns.find(r=>r.module_id===input.dataset.module&&r.site_id===target)}const checks=new Set(run.checks||[]),index=Number(input.dataset.toolCheck);input.checked?checks.add(index):checks.delete(index);run.checks=[...checks].sort((a,b)=>a-b);run.updated_at=now();const module=LEAN_MODULES.find(x=>x.id===input.dataset.module);run.status=run.checks.length===module.checklist.length?"Terminé":"En cours";save();render();
}

function bindModal(){
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeModal);
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>window.print());
  document.querySelectorAll("[data-new-action]").forEach(b=>b.onclick=()=>{const originId=b.dataset.originId,originType=b.dataset.originType||(originId?.startsWith("D-")?"Décision":"Problème");closeModal();actionForm(null,originId?{origin_type:originType,origin_id:originId}:{});});
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-action-from-signal]").forEach(b=>b.onclick=()=>{const s=data.signals.find(x=>x.id===b.dataset.actionFromSignal);closeModal();actionForm(null,{site_id:s.site_id,title:`Traiter · ${s.description}`,priority:s.severity==="Critique"?"Critique":"Haute",origin_type:"Signal",origin_id:s.id,description:s.description});const form=$("actionForm");const original=form.onsubmit;form.onsubmit=e=>{original(e);const a=data.actions.find(x=>x.origin_id===s.id);s.action_id=a?.id||s.action_id;s.state="Action en cours";save()};});
  document.querySelectorAll("[data-problem-from-signal]").forEach(b=>b.onclick=()=>problemFromSignal(b.dataset.problemFromSignal));
  document.querySelectorAll("[data-new-training-record]").forEach(b=>b.onclick=()=>{const personId=b.dataset.personId;closeModal();trainingRecordForm(personId)});
}
function bind(){
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>switchView(b.dataset.nav));
  document.querySelectorAll("[data-set-site]").forEach(b=>b.onclick=()=>{state.site=b.dataset.setSite;localStorage.setItem("biaSite",state.site);if(state.view==="home")state.view=state.role==="dg"?"pilotage":"home";render()});
  document.querySelectorAll("[data-new-signal]").forEach(b=>b.onclick=newSignalForm);
  document.querySelectorAll("[data-open-signal]").forEach(b=>b.onclick=()=>openSignal(b.dataset.openSignal));
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-new-action]").forEach(b=>b.onclick=()=>{const originId=b.dataset.originId,originType=b.dataset.originType||(originId?.startsWith("D-")?"Décision":"Problème");actionForm(null,originId?{origin_type:originType,origin_id:originId}:{});});
  document.querySelectorAll("[data-edit-action]").forEach(b=>b.onclick=()=>actionForm(data.actions.find(x=>x.id===b.dataset.editAction)));
  document.querySelectorAll("[data-advance-action]").forEach(b=>b.onclick=()=>advanceAction(b.dataset.advanceAction));
  document.querySelectorAll("[data-action-filter]").forEach(b=>b.onclick=()=>{state.actionFilter=b.dataset.actionFilter;render()});
  document.querySelectorAll("[data-terrain-tab]").forEach(b=>b.onclick=()=>{state.terrainTab=b.dataset.terrainTab;render()});
  document.querySelectorAll("[data-new-gemba]").forEach(b=>b.onclick=gembaForm);
  document.querySelectorAll("[data-new-problem]").forEach(b=>b.onclick=genericProblemForm);
  document.querySelectorAll("[data-edit-problem]").forEach(b=>b.onclick=()=>editProblem(b.dataset.editProblem));
  document.querySelectorAll("[data-select-problem]").forEach(b=>b.onclick=()=>{state.selectedProblemId=b.dataset.selectProblem;render()});
  document.querySelectorAll("[data-document-from-problem]").forEach(b=>b.onclick=()=>{const problem=data.problems.find(p=>p.id===b.dataset.documentFromProblem);let doc=data.documents.find(d=>d.problem_id===problem?.id);if(!doc&&problem){doc={id:nextId("DOC",data.documents),site_id:problem.site_id,type:problem.method,title:`${problem.id} · ${problem.title}`,status:"Brouillon",problem_id:problem.id,content:problem.content?.context||"",updated_at:now(),version:1};data.documents.unshift(doc);save()}if(doc)editDocument(doc.id)});
  document.querySelectorAll("[data-new-document]").forEach(b=>b.onclick=()=>simpleDocument(b.dataset.newDocument));
  document.querySelectorAll("[data-open-document]").forEach(b=>b.onclick=()=>editDocument(b.dataset.openDocument));
  document.querySelectorAll("[data-training-tab]").forEach(b=>b.onclick=()=>{state.trainingTab=b.dataset.trainingTab;render()});
  document.querySelectorAll("[data-open-training]").forEach(b=>b.onclick=()=>openTraining(b.dataset.openTraining));
  document.querySelectorAll("[data-training-person]").forEach(b=>b.onclick=()=>openTrainingPerson(b.dataset.trainingPerson));
  document.querySelectorAll("[data-new-training-record]").forEach(b=>b.onclick=()=>trainingRecordForm(b.dataset.personId||null));
  document.querySelectorAll("[data-new-training-person]").forEach(b=>b.onclick=trainingPersonForm);
  document.querySelectorAll("[data-new-training]").forEach(b=>b.onclick=trainingForm);
  document.querySelectorAll("[data-new-project]").forEach(b=>b.onclick=()=>projectForm());
  document.querySelectorAll("[data-edit-project]").forEach(b=>b.onclick=()=>projectForm(data.projects.find(x=>x.id===b.dataset.editProject)));
  document.querySelectorAll("[data-action-from-project]").forEach(b=>b.onclick=()=>{const p=data.projects.find(x=>x.id===b.dataset.actionFromProject);actionForm(null,{site_id:p.site_id,title:`${p.method} · ${p.title}`,origin_type:"Chantier",origin_id:p.id,description:`Action liée au chantier ${p.id}`})});
  document.querySelectorAll("[data-new-audit]").forEach(b=>b.onclick=()=>auditForm());
  document.querySelectorAll("[data-edit-audit]").forEach(b=>b.onclick=()=>auditForm(data.audits.find(x=>x.id===b.dataset.editAudit)));
  document.querySelectorAll("[data-open-subject]").forEach(b=>b.onclick=()=>openSubject(b.dataset.openSubject));
  document.querySelectorAll("[data-new-practice]").forEach(b=>b.onclick=practiceForm);
  document.querySelectorAll("[data-new-account]").forEach(b=>b.onclick=accountForm);
  document.querySelectorAll("[data-open-tool]").forEach(b=>b.onclick=()=>{if(b.dataset.runSite){state.site=b.dataset.runSite;localStorage.setItem("biaSite",state.site)}state.toolId=b.dataset.openTool;state.view="tools";render()});
  document.querySelectorAll("[data-back-tools]").forEach(b=>b.onclick=()=>{state.toolId=null;render()});
  document.querySelectorAll("[data-tool-category]").forEach(b=>b.onclick=()=>{state.toolCategory=b.dataset.toolCategory;render()});
  document.querySelectorAll("[data-route-tool]").forEach(b=>b.onclick=()=>{const route=LEAN_ROUTES.find(x=>x[0]===b.dataset.routeTool),tool=LEAN_MODULES.find(x=>x.title===route?.[2]);if(tool){state.toolId=tool.id;render()}});
  document.querySelectorAll("[data-start-tool]").forEach(b=>b.onclick=()=>startTool(b.dataset.startTool));
  document.querySelectorAll("[data-tool-action]").forEach(b=>b.onclick=()=>{const tool=LEAN_MODULES.find(x=>x.id===b.dataset.toolAction);actionForm(null,{title:`${tool.title} · première action`,origin_type:"Outil Lean",origin_id:tool.id,description:tool.steps[0]})});
  document.querySelectorAll("[data-tool-check]").forEach(b=>b.onchange=()=>updateToolCheck(b));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>window.print());
  $("toolSearch")?.addEventListener("input",e=>{state.toolQuery=e.target.value;clearTimeout(window.toolSearchTimer);window.toolSearchTimer=setTimeout(render,180)});
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
