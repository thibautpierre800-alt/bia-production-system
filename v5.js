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
  dg:{label:"Direction Générale Groupe",scope:"group",nav:["home","pilotage","roadmap","actions","practices","training","account"]},
  lean:{label:"Responsable Lean Groupe",scope:"group",nav:["home","pilotage","roadmap","sqcdp","actions","terrain","audits","resolution","projects","practices","documents","tools","training","account","settings"]},
  director:{label:"Directeur de site",scope:"site",nav:["home","pilotage","roadmap","sqcdp","actions","terrain","audits","resolution","projects","documents","tools","training","account"]},
  terrain:{label:"Chef d’équipe / Opérateur",scope:"workshop",nav:["home","sqcdp","actions","terrain","audits","documents","training","account"]}
};
const NAV=[
  {id:"home",icon:"⌂",label:"Accueil",group:"Piloter"},
  {id:"pilotage",icon:"↗",label:"Pilotage",group:"Piloter"},
  {id:"roadmap",icon:"⇢",label:"Roadmap",group:"Piloter"},
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
    {id:"FOR-015",code:"BIA-COACH-01",title:"Coaching Lean des équipes",category:"Leadership",duration:7,validity_months:36,objectives:"Faire résoudre les problèmes par les équipes sans imposer les solutions.",modules:["Questionnement","Kata","Feedback","Management transverse"],evaluation:"Mise en situation",status:"Publié"},
    {id:"FOR-016",code:"BIA-VSL-01",title:"VSL · Piloter une chaîne de valeur",category:"Leadership",duration:14,validity_months:36,objectives:"Tenir la responsabilité transverse d’une famille de produits, de la demande client au résultat opérationnel.",modules:["Rôle et mandat VSL","Voix du client et famille produit","Performance bout-en-bout","Animation transverse","VSM actuelle et future","Obeya et routines","Roadmap 30/60/90","Revue de résultats"],evaluation:"Soutenance d’une chaîne de valeur réelle + observation terrain",status:"Publié"},
    {id:"FOR-017",code:"BIA-ROADMAP-01",title:"Construire et piloter une Roadmap Lean",category:"Déploiement",duration:7,validity_months:36,objectives:"Transformer les priorités Groupe et les écarts terrain en trajectoire réaliste, arbitrée et mesurable.",modules:["Ambition et nord vrai","Diagnostic factuel","Percées prioritaires","Catchball","Jalons 30/60/90","Portefeuille d’initiatives","Revue PDCA","Ajustement"],evaluation:"Roadmap réelle présentée au sponsor",status:"Publié"}
  ],
  trainingRecords:[
    {id:"REC-001",person_id:"PER-001",training_id:"FOR-001",date:"2026-09-10",trainer:"Référent interne",attendance:"Présent",score:88,level:3,status:"Validé",evidence:"Quiz et mise en situation",validated_by:"Direction Générale",validated_at:"2026-09-10",expires_at:null}
  ],
  roadmap:[
    {id:"RM-001",site_id:"group",horizon:"0-30 jours",title:"Établir la baseline Groupe",outcome:"Définitions KPI, sources et propriétaires validés",owner:"Responsable Lean Groupe",status:"À lancer",progress:10,kpi:"Dictionnaire KPI validé",target_date:"2026-10-31"},
    {id:"RM-002",site_id:"marzin",horizon:"31-60 jours",title:"Stabiliser le SQCDP pilote",outcome:"Rituel quotidien tenu et écarts convertis en actions",owner:"Direction de site",status:"En cours",progress:35,kpi:"Taux de tenue du rituel",target_date:"2026-11-30"},
    {id:"RM-003",site_id:"group",horizon:"61-90 jours",title:"Choisir deux chaînes de valeur prioritaires",outcome:"VSL mandatés et VSM actuelles approuvées",owner:"Direction Générale",status:"À lancer",progress:0,kpi:"2 mandats VSL signés",target_date:"2026-12-31"},
    {id:"RM-004",site_id:"group",horizon:"3-12 mois",title:"Déployer les standards prouvés",outcome:"Pilotes validés puis transférés site par site",owner:"Responsable Lean Groupe",status:"À lancer",progress:0,kpi:"Gains tenus à 90 jours",target_date:"2027-06-30"}
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
    if(saved?.meta?.schema===6){const existing=saved.trainingCatalog||[],missing=DEMO.trainingCatalog.filter(course=>!existing.some(old=>old.id===course.id));return {...saved,projects:saved.projects||[],roadmap:saved.roadmap||clone(DEMO.roadmap),toolRuns:saved.toolRuns||[],practices:saved.practices||[],audits:saved.audits||[],people:saved.people||clone(DEMO.people),trainingCatalog:[...existing,...clone(missing)],trainingRecords:saved.trainingRecords||[]}}
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
  if(!requestCloseModal())return;
  if(!visibleNav().some(n=>n.id===id))id=visibleNav()[0]?.id||"home";
  state.view=id;state.receipt=null;localStorage.setItem("biaView",id);if(location.hash!==`#${id}`)history.pushState(null,"",`#${id}`);render();
  window.scrollTo({top:0,behavior:"smooth"});$("main").focus({preventScroll:true});
  $("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");
}
function render(){
  renderContexts();
  if(!visibleNav().some(n=>n.id===state.view))state.view=visibleNav()[0]?.id||"home";
  renderNav();
  document.body.classList.toggle("presentation",state.presentation && state.view==="sqcdp");
  const renderer={home:renderHome,pilotage:renderPilotage,roadmap:renderRoadmap,sqcdp:renderSqcdp,actions:renderActions,terrain:renderTerrain,audits:renderAudits,resolution:renderResolution,projects:renderProjects,practices:renderPractices,documents:renderDocuments,tools:renderTools,training:renderTraining,account:renderAccount,settings:renderSettings}[state.view];
  $("appView").innerHTML=(window.biaUnreadable?'<div class="alert critical">La sauvegarde locale n’est pas lisible. Elle est conservée sans modification. <button class="btn secondary" data-export-raw>Récupérer le fichier original</button> Restaurez une sauvegarde valide depuis Compte.</div>':"")+receiptView()+(renderer?renderer():"");
  if(state.view==="home")$("appView").insertAdjacentHTML("beforeend",resumeWork());
  if(state.view==="tools"&&state.toolId)$("appView").insertAdjacentHTML("afterbegin",toolLaunch(state.toolId));
  $("pageLocation").textContent=`${site().name} / ${NAV.find(n=>n.id===state.view)?.label||"Accueil"}`;
  $("dataMode").innerHTML=`<b>BIA PS ${APP_VERSION}</b> · Données locales sur cet appareil · Profils de démonstration · SEQUOIA : non connecté · ${data.meta.demo?"Exemples fictifs clairement identifiés":"Saisies locales"}`;
  bind();
  bindExperience();
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
      <div class="grid main-aside section"><section><div class="section-title"><h2>Décider et débloquer</h2><span class="badge">${decisions.length} ouverts</span></div><div class="list">${decisions.map(decision=>`<article class="row"><div class="row-top"><div><div class="row-title">${esc(decision.title)}</div><div class="row-meta">${esc(getSiteName(decision.site_id))} · ${esc(decision.owner)} · ${shortDate(decision.due_date)}</div></div>${recordLink(decision.id,"Décider")}</div></article>`).join("")||empty("Aucune décision ouverte.")}</div></section>
      <section class="panel"><div class="section-title"><h2>Réseau des six entités</h2></div><div class="list">${OPERATIONAL_SITES.map(s=>`<button class="row" data-set-site="${s.id}" style="text-align:left;border:1px solid var(--line)"><b>${esc(s.name)}</b><span class="row-meta" style="display:block">Ouvrir le site →</span></button>`).join("")}</div></section></div>`;
  }
  const signals=scoped(data.signals).filter(isOpenSignal);
  const actions=scoped(data.actions).filter(isOpenAction);
  const priorities=[...signals.filter(s=>s.severity==="Critique").map(s=>({id:s.id,title:s.description,meta:`Signal · ${s.type} · ${s.state}`,tone:"critical"})),...actions.filter(a=>["Critique","Haute"].includes(a.priority)).map(a=>({id:a.id,title:a.title,meta:`Action · ${a.owner} · ${a.status}`,tone:actionTone(a)}))].slice(0,5);
  return `${pageHead("Accueil Site",`Aujourd’hui à ${site().name}`,"Priorités, signaux et décisions du périmètre autorisé.",'<button class="btn" data-new-signal>＋ SIGNAL TERRAIN</button>')}
    <section class="hero"><p class="eyebrow">${esc(site().name)} · ${esc(workshop()?.name||"Tous les ateliers")}</p><h1>${priorities.length} sujet(s) demandent une réaction aujourd’hui</h1><p>Un signal est capturé une seule fois, puis suit son cycle jusqu’à la vérification d’efficacité.</p><div class="hero-actions"><button class="btn" data-new-signal>＋ NOUVEAU SIGNAL TERRAIN</button><button class="btn secondary" data-nav="sqcdp">Ouvrir SQCDP / TOP 15</button></div></section>
    ${homeCards()}
    <div class="grid main-aside section"><section><div class="section-title"><h2>Ce qui demande une réaction</h2></div><div class="list">${priorities.map(p=>`<article class="row"><div class="row-top"><div><div class="row-title">${esc(p.title)}</div><div class="row-meta">${esc(p.meta)}</div></div>${recordLink(p.id,"Traiter")}</div></article>`).join("")||empty("Aucun sujet prioritaire.")}</div></section>
    <section class="panel"><h2>Prochain point quotidien</h2><p class="hint">${esc(workshop()?.name||"Atelier à sélectionner")}</p><div class="metric-value">${topSubjects().length} sujets</div><button class="btn" data-nav="sqcdp">Ouvrir SQCDP / TOP 15</button><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Raccourcis</h3><div class="row-actions"><button class="btn secondary small" data-nav="terrain">Gemba / Signal</button><button class="btn secondary small" data-nav="audits">Audit Terrain · 50</button>${role().nav.includes("resolution")?'<button class="btn secondary small" data-nav="resolution">A3 / 8D</button>':""}</div></section></div>`;
}


function renderRoadmap(){
  const horizons=["0-30 jours","31-60 jours","61-90 jours","3-12 mois"],rows=(data.roadmap||[]).filter(item=>state.site==="group"||item.site_id==="group"||item.site_id===state.site),canEdit=["lean","director"].includes(state.role);
  return `${pageHead("Roadmap de transformation",state.site==="group"?"Trajectoire Groupe":"Trajectoire Groupe et Site","Une roadmap n’est pas une liste d’idées : chaque priorité possède un résultat attendu, un propriétaire, un indicateur et une date.",canEdit?'<button class="btn" data-new-roadmap>＋ Ajouter une priorité</button>':"")}
    <div class="roadmap-principles"><div><b>1 · NORD VRAI</b><span>Ce que le Groupe veut rendre durable</span></div><div><b>2 · ÉCART</b><span>Situation actuelle prouvée</span></div><div><b>3 · PERCÉE</b><span>Peu de priorités réellement décisives</span></div><div><b>4 · EXÉCUTION</b><span>PDCA, résultats et arbitrages</span></div></div>
    <div class="alert section"><b>Règle de gouvernance :</b> la Direction fixe l’ambition et arbitre ; les sites challengent la faisabilité par catchball ; le Responsable Lean rend visibles les dépendances et les résultats.</div>
    <div class="roadmap-board section">${horizons.map(horizon=>`<section class="roadmap-horizon"><header><h2>${horizon}</h2><span>${rows.filter(x=>x.horizon===horizon).length}</span></header>${rows.filter(x=>x.horizon===horizon).map(item=>`<article class="roadmap-item"><div class="row-top"><span class="eyebrow">${esc(item.id)} · ${esc(getSiteName(item.site_id))}</span>${pill(item.status,item.status==="Terminé"?"done":item.status==="Bloqué"?"open":"progress")}</div><h3>${esc(item.title)}</h3><p>${esc(item.outcome)}</p><div class="progress"><span style="width:${item.progress}%"></span></div><small>${item.progress} % · ${esc(item.owner)}<br>KPI : ${esc(item.kpi)} · ${shortDate(item.target_date)}</small>${canEdit&&allowedSite(item.site_id,true)?`<button class="btn small secondary" data-edit-roadmap="${item.id}">Mettre à jour</button><button class="btn ghost small" data-new-action data-origin-type="Roadmap" data-origin-id="${item.id}">Ajouter une action</button>`:""}</article>`).join("")||'<div class="empty compact">Aucune priorité.</div>'}</section>`).join("")}</div>
    <section class="panel section"><h2>Revue mensuelle attendue</h2><div class="grid cols-4"><div class="card"><b>Résultat</b><p class="hint">Qu’est-ce qui a réellement changé ?</p></div><div class="card"><b>Écart</b><p class="hint">Pourquoi le jalon n’est-il pas atteint ?</p></div><div class="card"><b>Décision</b><p class="hint">Quel arbitrage est nécessaire ?</p></div><div class="card"><b>Apprentissage</b><p class="hint">Que faut-il adapter ou standardiser ?</p></div></div></section>`;
}

function measureStatus(m){
  if(!m||m.value==null||m.target==null)return {text:"Non disponible",tone:"neutral"};
  const bad=["scrap","safety_signal"].includes(m.code)?m.value>m.target:m.value<m.target;
  return bad?{text:"Écart",tone:"open"}:{text:"Conforme",tone:"done"};
}

function renderActions(){
  let actions=scoped(data.actions);
  if(state.actionFilter==="late")actions=actions.filter(isLate);
  if(state.actionFilter==="verify")actions=actions.filter(a=>a.status==="À vérifier");
  if(state.actionFilter==="open")actions=actions.filter(isOpenAction);
  return `${pageHead("Plan d’actions","Une action unique, quelle que soit son origine","Une action créée depuis un signal, un audit ou un A3 reste visible ici avec son lien d’origine.",state.role==="dg"?"":'<button class="btn" data-new-action>＋ Nouvelle action</button>')}
    <div class="filters">${[["all","Toutes"],["late","En retard"],["verify","À vérifier"],["open","Ouvertes"]].map(([id,label])=>`<button class="chip ${state.actionFilter===id?"active":""}" data-action-filter="${id}">${label}</button>`).join("")}</div>
    ${listSearch("Rechercher une action")}<div class="kanban">${ACTION_STATES.map(status=>{const rows=actions.filter(a=>a.status===status);return `<section class="kanban-col"><h3>${status}<span class="badge">${rows.length}</span></h3><div class="list">${rows.map(a=>actionCard(a)).join("")||empty("Aucune action")}</div></section>`}).join("")}</div>`;
}
function actionCard(a){return `<article class="row" data-search-row><div class="row-top"><span class="pill ${a.priority==="Critique"?"critical":a.priority==="Haute"?"progress":"neutral"}">${esc(a.id)}</span>${isLate(a)?pill("En retard","open"):""}</div><div class="row-title" style="margin-top:8px">${esc(a.title)}</div><div class="row-meta">${esc(a.owner||"À désigner")} · ${esc(a.origin_type)} ${esc(a.origin_id||"")} · ${shortDate(a.due_date)}</div><div class="row-actions"><button class="btn small secondary" data-open-record="${a.id}">Ouvrir</button>${a.origin_id?recordLink(a.origin_id,"Origine"):""}${a.status!=="Clôturée"?`<button class="btn small ghost" data-advance-action="${a.id}">${a.status==="À vérifier"?"Vérifier":a.status==="Ouverte"?"Démarrer":"Soumettre à vérification"}</button>`:""}</div></article>`}

function signalStats(){
  const rows=scoped(data.signals);
  return {new:rows.filter(s=>s.state==="Nouveau").length,open:rows.filter(isOpenSignal).length,critical:rows.filter(s=>s.severity==="Critique"&&isOpenSignal(s)).length,progress:rows.filter(s=>s.state==="Action en cours").length,resolved:rows.filter(s=>["Résolu","Vérifié","Clos"].includes(s.state)).length};
}
function signalCard(s){return `<article class="row" data-search-row><div class="row-top"><div>${pill(s.id,signalTone(s))} ${pill(s.type,"info")} ${pill(s.severity,s.severity==="Critique"?"critical":"neutral")}</div>${pill(s.state,signalTone(s))}</div><div class="row-title" style="margin-top:9px">${esc(s.description)}</div><div class="row-meta">${esc(getSiteName(s.site_id))} · ${esc(s.zone||"Zone non précisée")} · ${shortDate(s.created_at)} · ${esc(s.author||"Auteur non précisé")}</div><div class="row-actions"><button class="btn small secondary" data-open-signal="${s.id}">Ouvrir</button>${s.state!=="Clos"?`<button class="btn small ghost" data-open-record="${s.id}">${esc(signalNextLabel(s))}</button>`:""}</div></article>`}

function renderAudits(){
  const rows=scoped(data.audits).sort((a,b)=>String(b.updated_at||b.performed_at).localeCompare(String(a.updated_at||a.performed_at)));
  const completed=rows.filter(a=>a.status==="Terminé"&&a.audit_data?.domain_scores),drafts=rows.filter(a=>a.status==="Brouillon"),last=completed[0],domains=last?Object.entries(last.audit_data.domain_scores):[];
  return `${pageHead("Audits","Audit Terrain BIA · 50 critères","Dix domaines, cinq critères par domaine et une preuve obligatoire pour chaque note.",'<button class="btn" data-new-audit>＋ DÉMARRER L’AUDIT 50 CRITÈRES</button>')}
    ${drafts.length?`<section class="attention-strip"><div><b>${drafts.length} audit(s) à reprendre</b><span>Les brouillons sont enregistrés sur cet appareil.</span></div><button class="btn" data-edit-audit="${drafts[0].id}">Continuer ${esc(drafts[0].id)}</button></section>`:""}
    <div class="grid cols-4"><article class="card"><div class="metric-label">Audits terminés</div><div class="metric-value">${completed.length}</div></article><article class="card"><div class="metric-label">Brouillons à reprendre</div><div class="metric-value">${drafts.length}</div></article><article class="card"><div class="metric-label">Dernier score</div><div class="metric-value">${last?.score??"—"} <small>/ 100</small></div></article><article class="card"><div class="metric-label">Actions issues d’audit</div><div class="metric-value">${scoped(data.actions).filter(a=>a.origin_type==="Audit").length}</div></article></div>
    ${last?`<section class="panel section"><div class="section-title"><div><h2>Dernier Audit Terrain · ${esc(last.scope)}</h2><p class="hint">${shortDate(last.performed_at)} · ${esc(last.owner)}</p></div>${pill(`${last.score}/100`,last.score>=80?"done":last.score>=60?"progress":"open")}</div><div class="audit-domain-grid">${domains.map(([name,score])=>`<div class="audit-score-card"><div class="section-title"><b>${esc(name)}</b><span>${Number(score).toFixed(1)}/5</span></div><div class="progress"><span style="width:${score/5*100}%"></span></div></div>`).join("")}</div></section>`:""}
    <section class="section"><div class="section-title"><h2>Audits enregistrés</h2><button class="btn secondary" data-open-tool="audit-terrain">Ouvrir le guide Audit Terrain</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Statut</th><th>Périmètre</th><th>Score</th><th>Preuves</th><th>Date</th><th>Responsable</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(a.id)}</td><td>${pill(a.status,a.status==="Terminé"?"done":"progress")}</td><td>${esc(a.scope||"À compléter")}</td><td><b>${a.score==null?"—":`${a.score}/100`}</b></td><td>${a.audit_data?.proof_count??(a.proof?1:"—")}</td><td>${shortDate(a.performed_at)}</td><td>${esc(a.owner||"À compléter")}</td><td><button class="btn small secondary" data-edit-audit="${a.id}">${a.status==="Brouillon"?"Continuer":"Consulter"}</button></td></tr>`).join("")||'<tr><td colspan="8">Aucun audit.</td></tr>'}</tbody></table></div></section>`;
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
    return `<button class="btn secondary" data-back-tools>← Bibliothèque</button><section class="hero section"><p class="eyebrow">${esc(tool.no)} · ${esc(tool.category)}</p><h1>${esc(tool.title)}</h1><p>${esc(tool.objective)}</p><div class="hero-actions"><button class="btn" data-start-tool="${tool.id}">${run?"Reprendre la checklist":"Suivre ce guide"} sur ${esc(toolSiteName)}</button><button class="btn secondary" data-tool-action="${tool.id}">Créer une action</button><button class="btn secondary" data-print>Imprimer / PDF</button></div></section>
      ${run?`<section class="panel section journey-next" id="toolChecklist"><div class="section-title"><div><p class="eyebrow">${esc(run.id)} · ${esc(run.status)}</p><h2>${run.status==="Terminé"?"Démarche terminée":"À faire maintenant"}</h2></div><span class="badge">${pct} %</span></div><p class="journey-next-action">${nextIndex>=0?`${nextIndex+1}. `:""}${esc(nextItem)}</p><p class="hint">Responsable : ${esc(run.owner||"À attribuer")} <button class="btn ghost small" data-edit-run="${run.id}">Attribuer / modifier</button></p><p class="hint">Votre avancement est enregistré dans <b>Bibliothèque → Mes démarches</b> sur ${esc(toolSiteName)}.</p></section>`:`<section class="alert section"><b>Pour commencer :</b> cliquez sur « Suivre ce guide ». La démarche apparaîtra ensuite dans <b>Bibliothèque → Mes démarches</b> et la checklist conservera votre avancement.</section>`}
      <div class="grid cols-2 section"><article class="panel"><h2>Quand l’utiliser</h2><p class="hint">${esc(tool.when)}</p><h2 class="section">Séquence terrain</h2><div class="list">${tool.steps.map((x,i)=>`<div class="row"><b>${i+1}. ${esc(x)}</b></div>`).join("")}</div></article><article class="panel"><div class="section-title"><h2>Checklist d’avancement</h2><span class="badge">${pct} %</span></div><div class="progress"><span style="width:${pct}%"></span></div><p class="hint">Cochez chaque élément réalisé. L’enregistrement est automatique.</p><div class="check-list section">${tool.checklist.map((x,i)=>`<label class="check"><input type="checkbox" data-tool-check="${i}" data-module="${tool.id}" ${done.has(i)?"checked":""}> ${esc(x)}</label>`).join("")}</div></article></div>
      <div class="grid cols-2 section"><article class="panel"><h2>Livrables attendus</h2><div class="check-list">${tool.deliverables.map(x=>`<div class="check">✓ ${esc(x)}</div>`).join("")}</div></article><article class="panel"><h2>Pièges à éviter</h2><div class="check-list">${tool.pitfalls.map(x=>`<div class="check bad">⚠ ${esc(x)}</div>`).join("")}</div></article></div>`;
  }
  const q=state.toolQuery.trim().toLowerCase(),categories=["Tous",...new Set(LEAN_MODULES.map(x=>x.category))],visible=LEAN_MODULES.filter(x=>(state.toolCategory==="Tous"||x.category===state.toolCategory)&&(!q||[x.title,x.category,x.objective,x.when,...x.checklist].join(" ").toLowerCase().includes(q)));
  const runs=(data.toolRuns||[]).filter(r=>scoped([r]).length).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  return `${pageHead("Bibliothèque opérationnelle","30 outils Lean et industriels","Choisissez un outil, lancez la pratique ou suivez une checklist terrain.")}
    <section class="section" id="myJourneys"><div class="section-title"><div><h2>Mes démarches</h2><p class="hint">Retrouvez ici chaque parcours démarré et reprenez-le là où vous l’avez laissé.</p></div><span class="badge">${runs.filter(r=>r.status!=="Terminé").length} en cours</span></div>${runs.length?`<div class="grid cols-3">${runs.map(r=>{const t=LEAN_MODULES.find(x=>x.id===r.module_id);if(!t)return "";const count=(r.checks||[]).length,pct=Math.round(count/Math.max(1,t.checklist.length)*100),next=t.checklist.find((_,i)=>!(r.checks||[]).includes(i));return `<article class="card journey-card"><div class="row-top"><span class="eyebrow">${esc(r.id)} · ${esc(getSiteName(r.site_id))}</span>${pill(r.status,r.status==="Terminé"?"done":"progress")}</div><h3>${esc(t.title)}</h3><p class="row-meta">Responsable : ${esc(r.owner||"Pierre Thibaut")} · démarrée le ${shortDate(r.started_at)}</p><div class="progress"><span style="width:${pct}%"></span></div><p class="hint">${pct} % · ${next?`Prochaine étape : ${esc(next)}`:"Toutes les étapes sont cochées"}</p><button class="btn ${r.status==="Terminé"?"secondary":""}" data-open-tool="${t.id}" data-run-site="${r.site_id}">${r.status==="Terminé"?"Consulter":"Continuer la démarche"} →</button></article>`}).join("")}</div>`:`<div class="empty"><b>Aucune démarche démarrée.</b><br>Ouvrez un outil ci-dessous puis cliquez sur « Démarrer ».</div>`}</section>
    <div class="panel"><div class="form-grid"><label class="wide">Rechercher un problème, une méthode ou un livrable<input id="toolSearch" value="${esc(state.toolQuery)}" placeholder="Ex. changement de série, défaut, TRS, flux, audit…"></label></div><div class="filters">${categories.map(c=>`<button class="chip ${c===state.toolCategory?"active":""}" data-tool-category="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <section class="section"><div class="section-title"><h2>J’ai un problème</h2><span class="badge">${LEAN_ROUTES.length} routes</span></div><div class="grid cols-3">${LEAN_ROUTES.slice(0,6).map(r=>`<button class="card" data-route-tool="${r[0]}" style="text-align:left"><b>${esc(r[1])}</b><p class="hint">${esc(r[2])} →</p></button>`).join("")}</div></section>
    <section class="section"><div class="section-title"><h2>Bibliothèque</h2><span class="badge">${visible.length} / ${LEAN_MODULES.length}</span></div><div class="grid cols-3">${visible.map(t=>`<button class="card document-card" data-open-tool="${t.id}" style="text-align:left"><span class="eyebrow">${esc(t.no)} · ${esc(t.category)}</span><h3>${esc(t.title)}</h3><p class="hint">${esc(t.objective)}</p><span class="btn secondary">Ouvrir l’outil →</span></button>`).join("")||empty("Aucun outil ne correspond à cette recherche.")}</div></section>`;
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
  {type:"BEFORE_AFTER",group:"Amélioration",title:"Fiche Avant / Après",desc:"Deux photos et un descriptif court"},
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
  BEFORE_AFTER:{title:"Fiche Avant / Après",visual:"beforeafter",fields:[["description","Descriptif court","Expliquez simplement ce qui a été amélioré."]]},
  "5S":{title:"Audit 5S",visual:"5s",fields:[["sort","1. Supprimer l’inutile","Constats et preuves."],["set","2. Situer / ranger","Constats et preuves."],["shine","3. Faire scintiller / inspecter","Constats et preuves."],["standardize","4. Standardiser","Constats et preuves."],["sustain","5. Maintenir","Constats et preuves."],["actions","Actions prioritaires","Responsables, échéances et vérification."]]},
  STANDARD:{title:"Standard de poste",visual:"standard",fields:[["purpose","Objet et résultat attendu","Pourquoi ce standard existe-t-il ?"],["scope","Périmètre et prérequis","Poste, produit, compétences, EPI et documents."],["sequence","Séquence de travail","Étapes, points clés et raisons des points clés."],["quality","Points qualité","Critères, moyens de contrôle et réaction en cas d’écart."],["safety","Points sécurité","Risques, protections et interdictions."],["validation","Validation et formation","Auteur, approbateur, personnes formées et date d’effet."]]},
};
function documentVisual(type,values={}){
  if(type==="A3")return `<div class="method-map a3-map">${["Problème","Situation actuelle","Objectif","Analyse","Cause prouvée","Contre-mesures","Résultats","Standardiser"].map((x,i)=>`<div><b>${i+1}</b><span>${x}</span></div>`).join("")}</div>`;
  if(type==="8D")return `<div class="method-map d8-map">${["D0 Urgence","D1 Équipe","D2 Problème","D3 Contenir","D4 Causes","D5 Corriger","D6 Vérifier","D7 Prévenir","D8 Clore"].map(x=>`<div><b>${x.split(" ")[0]}</b><span>${x.slice(3)}</span></div>`).join("")}</div>`;
  if(type==="QRQC")return `<div class="qrqc-loop"><div>VOIR<br><small>fait réel</small></div><div>SÉCURISER<br><small>client / processus</small></div><div>ANALYSER<br><small>cause prouvée</small></div><div>VÉRIFIER<br><small>efficacité</small></div></div>`;
  if(type==="5WHY")return `<div class="why-ladder">${[1,2,3,4,5].map(n=>`<div><b>Pourquoi ${n} ?</b><span>${esc(values[`why${n}`]||"À renseigner")}</span></div>`).join("")}<div class="root"><b>Cause racine prouvée</b><span>${esc(values.root_cause||"À démontrer")}</span></div></div>`;
  if(type==="ISHIKAWA")return `<div class="fishbone"><div class="fish-effect"><b>EFFET</b><span>${esc(values.effect||"Problème à définir")}</span></div><div class="fish-spine"></div>${[["Méthodes","method"],["Machines","machine"],["Main-d’œuvre","manpower"],["Matières","material"],["Mesures","measurement"],["Milieu","environment"]].map(([label,key],i)=>`<div class="fish-branch branch-${i+1}"><b>${label}</b><span>${esc(values[key]||"Causes possibles")}</span></div>`).join("")}</div>`;
  if(type==="SQCDP")return `<div class="method-map sqcdp-map">${Object.entries(AXES).map(([key,val])=>`<div style="--axis:${val.color}"><b>${key}</b><span>${esc(val.label)}</span></div>`).join("")}</div>`;
  if(type==="BEFORE_AFTER")return `<div class="before-after-visual"><div><b>AVANT</b>${photoImage(values.before_photo,"Situation avant")||`<span>Photo avant</span>`}</div><div class="before-after-arrow">→</div><div><b>APRÈS</b>${photoImage(values.after_photo,"Situation après")||`<span>Photo après</span>`}</div></div>${values.description?`<p class="before-after-description">${esc(values.description)}</p>`:""}`;
  const schema=DOCUMENT_SCHEMAS[type];return `<div class="method-map generic-map">${(schema?.fields||[]).slice(0,6).map(([id,label],i)=>`<div><b>${i+1}</b><span>${esc(label.replace(/^\d+\.\s*/,""))}</span></div>`).join("")}</div>`;
}
function initialDocumentData(type,problem=null,context=""){
  const c=problem?.content||{};
  if(type==="A3")return {problem:c.context||problem?.title||context,background:c.background||"",current:c.current||"",target:c.target||"",analysis:c.analysis||"",root_cause:c.root_cause||c.causes||"",countermeasures:c.countermeasures||"",action_plan:c.actions||"",followup:c.verification||"",effectiveness:c.effectiveness||"",standardization:[c.standard,c.learning].filter(Boolean).join("\n")};
  if(type==="8D")return {d0:c.context||context,d1:c.team||problem?.owner||"",d2:c.current||problem?.title||"",d3:c.containment||"",d4_occurrence:c.root_cause||c.causes||"",d4_escape:c.escape_cause||"",d5:c.countermeasures||"",d6:c.verification||"",d7:c.standard||"",d8:c.learning||""};
  if(type==="QRQC")return {event:c.context||problem?.title||context,containment:c.containment||"",facts:c.current||"",cause:c.root_cause||"",escape:c.escape_cause||"",corrective:c.countermeasures||"",verification:c.verification||"",escalation:c.standard||""};
  if(type==="BEFORE_AFTER")return {description:context};
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
function trainingPedagogy(training){
  const special={
    "FOR-016":{audience:"Directeurs de site, responsables de production, responsables Lean et futurs pilotes de chaîne de valeur",prerequisites:"Connaître les processus du site et savoir lire les KPI SQCDP.",messages:["Le VSL répond du flux de bout en bout, pas seulement d’un atelier.","Il arbitre avec les fonctions sans se substituer à leurs expertises.","Il pilote simultanément satisfaction client, sécurité, qualité, délai, coût et développement des personnes.","La VSM éclaire le système ; la roadmap organise sa transformation."],workshop:"Sur une famille de produits réelle, dessiner le SIPOC, fixer le périmètre commande-livraison, attribuer les propriétaires de données, construire l’état actuel, choisir trois percées et préparer la revue Obeya.",quiz:["Quelle différence entre responsable fonctionnel et VSL ?","Quels indicateurs décrivent la performance bout-en-bout ?","Quand une VSM devient-elle une roadmap ?","Quel arbitrage doit rester au sponsor ?"],lessons:[
      ["Mandat du VSL","Définir client, famille produit, début/fin du flux et pouvoir d’arbitrage.","Rédiger une fiche de mandat sur une page.","Mandat signé par le sponsor."],
      ["Voix du client","Traduire besoins client en qualité, délai, volume, mix et stabilité.","Analyser demande et variabilité.","Profil de demande validé."],
      ["Performance bout-en-bout","Relier lead time, OTD/OTIF, FPY, encours, productivité, TRS du goulot et cash.","Construire l’arbre KPI sans additionner des pourcentages incompatibles.","Définitions, source et propriétaire de chaque KPI."],
      ["Leadership transverse","Installer RACI, escalade et règles de décision avec production, qualité, supply, méthodes et maintenance.","Jeu de rôle sur un conflit de priorité.","RACI et matrice d’escalade."],
      ["VSM actuelle et future","Observer flux matière et information, calculer takt, lead time et temps VA, puis concevoir le futur.","Marche de flux et cartographie murale.","VSM actuelle sourcée et futur cible."],
      ["Obeya et routines","Conduire revues quotidiennes, hebdomadaires et mensuelles centrées sur écarts et décisions.","Simuler une revue de 20 minutes.","Standard de réunion et tableau d’escalade."],
      ["Roadmap de transformation","Transformer les boucles kaizen en jalons 30/60/90 jours et vision 12-24 mois.","Prioriser par impact, preuve et capacité.","Roadmap avec résultats, pilotes et dates."],
      ["Résultats et pérennité","Vérifier les gains, réviser le standard, développer les compétences et partager le REX.","Revue d’un cas en dérive.","Dossier de clôture et plan de contrôle."]]},
    "FOR-017":{audience:"Direction Groupe, directeurs de site, Responsable Lean Groupe et pilotes d’initiatives",prerequisites:"Disposer d’une ambition, d’un diagnostic factuel et d’un sponsor.",messages:["Une roadmap décrit des résultats à obtenir, pas un calendrier d’outils Lean.","Limiter le nombre de percées protège la capacité d’exécution.","Le catchball confronte ambition, moyens et réalité terrain.","Chaque revue se conclut par maintenir, corriger, arrêter ou accélérer."],workshop:"Construire la roadmap réelle BIA : nord vrai, baseline, trois à cinq percées, jalons 30/60/90 jours, dépendances, responsables, KPI et décisions attendues.",quiz:["Quelle différence entre action et résultat ?","Pourquoi limiter les percées ?","Que doit produire le catchball ?","Quand faut-il modifier la roadmap ?"],lessons:[
      ["Nord vrai","Clarifier valeur client, sécurité, qualité, délai, coût et développement humain.","Formuler l’ambition en une phrase testable.","Ambition approuvée."],
      ["Diagnostic","Établir baseline, maturité, irritants et contraintes sans inventer les données.","Classer faits, hypothèses et inconnues.","Dossier de preuves."],
      ["Percées","Choisir les écarts stratégiques qui exigent une transformation transverse.","Matrice impact/capacité/urgence.","3 à 5 priorités maximum."],
      ["Catchball","Faire dialoguer Groupe, sites et terrain sur objectifs, moyens, risques et délais.","Simulation d’arbitrage multisite.","Engagements et désaccords tracés."],
      ["Jalons","Décomposer 30/60/90 jours puis 3-12 et 12-24 mois.","Écrire chaque jalon comme un résultat observable.","Feuille de route datée."],
      ["Portefeuille","Gérer dépendances, charge, risques et décisions entre initiatives.","Construire une carte des dépendances.","Capacité et arbitrages visibles."],
      ["Revue PDCA","Comparer prévu/réalisé, comprendre l’écart et décider.","Animer une revue mensuelle.","Décisions, actions et apprentissages."],
      ["Adaptation","Arrêter ce qui ne produit pas de résultat et standardiser ce qui fonctionne.","Replanifier un scénario en retard.","Roadmap révisée et versionnée."]]
    }
  };
  if(special[training.id])return special[training.id];
  return {audience:"Personnes amenées à utiliser la méthode sur le terrain",prerequisites:"Aucun prérequis technique ; venir avec un cas réel si possible.",messages:["Partir d’un fait observable.","Pratiquer sur le terrain avant de théoriser.","Séparer hypothèse, preuve et décision.","Valider la compétence par une réalisation, pas par la présence."],workshop:`Appliquer ${training.title} à une situation réelle du site et présenter le résultat au groupe.`,quiz:["Quel problème cette méthode permet-elle de traiter ?","Quelle preuve faut-il recueillir ?","Quel est le piège principal ?","Comment vérifier l’efficacité ?"],lessons:training.modules.map((module,index)=>[module,`Comprendre le but de « ${module} » et savoir l’expliquer simplement.`,index===0?"Observer un exemple puis identifier le fait de départ.":"Réaliser la partie correspondante sur le cas fil rouge.",`Production vérifiable : ${module}.`])};
}
function trainingPeople(){const rows=scoped(data.people);return state.role==="terrain"?rows.filter(p=>p.name==="Pierre Thibaut"):rows}
function trainingRecordStatus(r){if(r.status!=="Validé")return {text:r.status||"À évaluer",tone:"progress"};if(r.expires_at&&r.expires_at<today())return {text:"Expiré",tone:"open"};return {text:"Valide",tone:"done"}}
function renderTraining(){
  const people=trainingPeople(),records=data.trainingRecords.filter(r=>people.some(p=>p.id===r.person_id)),canManage=["lean","director"].includes(state.role),tabs=`<div class="tabs"><button class="tab ${state.trainingTab==="catalog"?"active":""}" data-training-tab="catalog">Catalogue</button><button class="tab ${state.trainingTab==="people"?"active":""}" data-training-tab="people">Personnes</button><button class="tab ${state.trainingTab==="matrix"?"active":""}" data-training-tab="matrix">Matrice de compétences</button></div>`;
  const head=pageHead("Développement des compétences","Formation et qualification","Tracer séparément la présence, l’évaluation, la pratique et la validation du niveau.",canManage?'<button class="btn" data-new-training-record>＋ Enregistrer une formation</button>':"");
  if(state.trainingTab==="people")return `${head}${tabs}${listSearch("Retrouver une personne")}<div class="grid cols-3">${people.map(p=>{const rows=records.filter(r=>r.person_id===p.id),valid=rows.filter(r=>trainingRecordStatus(r).text==="Valide").length;return `<article class="card training-person" data-search-row><div class="row-top"><span class="person-avatar">${esc(p.name.split(" ").map(x=>x[0]).join("").slice(0,2))}</span>${pill(p.status,p.status==="Actif"?"done":"neutral")}</div><h3>${esc(p.name)}</h3><p class="hint">${esc(p.employee_id)} · ${esc(p.job)}<br>${esc(getSiteName(p.site_id))} · ${esc(p.workshop||"Périmètre non précisé")}</p><div class="metric-value">${valid}<small> validation(s)</small></div><div class="row-actions"><button class="btn secondary" data-training-person="${p.id}">Ouvrir le dossier</button></div></article>`}).join("")||empty("Aucune personne sur ce périmètre.")}</div>${canManage?'<button class="btn secondary section" data-new-training-person>＋ Ajouter une personne</button>':""}`;
  if(state.trainingTab==="matrix")return `${head}${tabs}<section class="panel"><div class="section-title"><div><h2>Matrice de compétences</h2><p class="hint">Le niveau est affiché seulement après évaluation et validation nominative.</p></div><span class="badge">${people.length} personne(s)</span></div><div class="table-wrap"><table class="data-table training-matrix"><thead><tr><th>Personne</th>${data.trainingCatalog.map(t=>`<th title="${esc(t.title)}">${esc(t.code.replace("BIA-",""))}</th>`).join("")}</tr></thead><tbody>${people.map(p=>`<tr><td><button class="link-button" data-training-person="${p.id}">${esc(p.name)}</button><small class="row-meta">${esc(p.employee_id)}</small></td>${data.trainingCatalog.map(t=>{const r=records.filter(x=>x.person_id===p.id&&x.training_id===t.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return `<td>${r&&trainingRecordStatus(r).text==="Valide"?`<span class="skill-level level-${r.level}" title="${esc(TRAINING_LEVELS[r.level])}">${r.level}</span>`:r?`<span class="pill neutral">${esc(trainingRecordStatus(r).text)}</span>`:"—"}</td>`}).join("")}</tr>`).join("")}</tbody></table></div><div class="level-legend section">${TRAINING_LEVELS.map((x,i)=>`<span><b class="skill-level level-${i}">${i}</b>${esc(x.split(" · ")[1])}</span>`).join("")}</div></section>`;
  return `${head}${tabs}<div class="grid cols-4"><article class="card"><div class="metric-label">Formations publiées</div><div class="metric-value">${data.trainingCatalog.filter(t=>t.status==="Publié").length}</div></article><article class="card"><div class="metric-label">Validations enregistrées</div><div class="metric-value">${records.filter(r=>r.status==="Validé").length}</div></article><article class="card"><div class="metric-label">Qualifications expirées</div><div class="metric-value">${records.filter(r=>trainingRecordStatus(r).text==="Expiré").length}</div></article><article class="card"><div class="metric-label">Personnes suivies</div><div class="metric-value">${people.length}</div></article></div><section class="section"><div class="section-title"><div><h2>Catalogue BIA</h2><p class="hint">Chaque contenu précise objectifs, séquence, durée et mode d’évaluation.</p></div>${canManage?'<button class="btn secondary" data-new-training>＋ Nouvelle formation</button>':""}</div>${listSearch("Rechercher une formation")}<div class="grid cols-3">${data.trainingCatalog.map(t=>`<article class="card training-card" data-search-row><div class="row-top"><span class="eyebrow">${esc(t.code)} · ${esc(t.category)}</span>${pill(t.status,t.status==="Publié"?"done":"progress")}</div><h3>${esc(t.title)}</h3><p>${esc(t.objectives)}</p><p class="hint">${t.duration} h · évaluation : ${esc(t.evaluation)}${t.validity_months?` · validité ${t.validity_months} mois`:""}</p><button class="btn secondary" data-open-training="${t.id}">Voir le contenu</button></article>`).join("")}</div></section>`;
}
function openTraining(id){
  const t=data.trainingCatalog.find(x=>x.id===id);if(!t)return;const pedagogy=trainingPedagogy(t);
  modal(`${t.code} · ${t.title}`,`<div class="training-sheet pedagogical-sheet"><div class="context-strip"><div><span>Catégorie</span><b>${esc(t.category)}</b></div><div><span>Durée</span><b>${t.duration} heures</b></div><div><span>Validité</span><b>${t.validity_months?`${t.validity_months} mois`:"Sans échéance définie"}</b></div></div><section class="training-intro"><div><span>Objectif opérationnel</span><h3>${esc(t.objectives)}</h3></div><div><span>Public</span><p>${esc(pedagogy.audience)}</p><span>Prérequis</span><p>${esc(pedagogy.prerequisites)}</p></div></section><section class="panel section"><div class="section-title"><div><h3>Messages essentiels</h3><p class="hint">Ce que chaque participant doit être capable d’expliquer.</p></div><span class="badge">À retenir</span></div><div class="key-messages">${pedagogy.messages.map((message,index)=>`<div><b>${index+1}</b><span>${esc(message)}</span></div>`).join("")}</div></section><section class="section"><div class="section-title"><div><h3>Déroulé pédagogique complet</h3><p class="hint">Alterner explication courte, observation, pratique et restitution.</p></div><span class="badge">${pedagogy.lessons.length} séquences</span></div><div class="lesson-grid">${pedagogy.lessons.map((lesson,index)=>`<article class="lesson-card"><div class="lesson-number">${String(index+1).padStart(2,"0")}</div><div><h4>${esc(lesson[0])}</h4><p><b>À comprendre :</b> ${esc(lesson[1])}</p><p><b>À faire :</b> ${esc(lesson[2])}</p><p><b>Preuve :</b> ${esc(lesson[3])}</p></div></article>`).join("")}</div></section><section class="training-workshop section"><div><span>CAS PRATIQUE FIL ROUGE</span><h3>${esc(pedagogy.workshop)}</h3></div><div><span>ÉVALUATION FINALE</span><h3>${esc(t.evaluation)}</h3><p>La présence seule ne vaut jamais qualification.</p></div></section><section class="panel section"><h3>Questions de validation</h3><ol class="training-quiz">${pedagogy.quiz.map(question=>`<li>${esc(question)}</li>`).join("")}</ol><p class="hint">Le formateur documente les réponses, la mise en pratique et le niveau démontré dans le dossier individuel.</p></section><div class="form-actions"><button class="btn secondary" data-print>Imprimer le support pédagogique</button><button class="btn ghost" data-close-modal>Fermer</button></div></div>`)
}
function openTrainingPerson(id){const p=data.people.find(x=>x.id===id);if(!p)return;const rows=data.trainingRecords.filter(r=>r.person_id===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));modal(`Dossier formation · ${p.name}`,`<div class="hr-sheet"><header><div><p class="eyebrow">BIA PRODUCTION SYSTEM · SUIVI RH</p><h2>Fiche individuelle de formation et qualification</h2></div><div class="document-ref">${esc(p.employee_id)}<br>Édité le ${shortDate(today())}</div></header><div class="identity-grid"><div><span>Collaborateur</span><b>${esc(p.name)}</b></div><div><span>Entité</span><b>${esc(getSiteName(p.site_id))}</b></div><div><span>Fonction</span><b>${esc(p.job)}</b></div><div><span>Atelier / service</span><b>${esc(p.workshop||"—")}</b></div><div><span>Responsable</span><b>${esc(p.manager||"—")}</b></div><div><span>Statut</span><b>${esc(p.status)}</b></div></div><div class="table-wrap section"><table class="data-table"><thead><tr><th>Date</th><th>Formation</th><th>Présence</th><th>Évaluation</th><th>Niveau validé</th><th>Validateur</th><th>Échéance</th></tr></thead><tbody>${rows.map(r=>{const t=data.trainingCatalog.find(x=>x.id===r.training_id),st=trainingRecordStatus(r);return `<tr><td>${shortDate(r.date)}</td><td><b>${esc(t?.code||r.training_id)}</b><br>${esc(t?.title||"Formation inconnue")}</td><td>${esc(r.attendance)}</td><td>${r.score==null?"—":`${r.score}/100`}<br><small>${esc(r.evidence||"")}</small></td><td>${pill(st.text==="Valide"?TRAINING_LEVELS[r.level]||"À qualifier":st.text,st.tone)}</td><td>${esc(r.validated_by||"—")}<br><small>${shortDate(r.validated_at)}</small></td><td>${shortDate(r.expires_at)}</td></tr>`}).join("")||'<tr><td colspan="7">Aucune formation enregistrée.</td></tr>'}</tbody></table></div><div class="signature-grid section"><div>Visa collaborateur<br><span>Date / signature</span></div><div>Visa manager / formateur<br><span>Date / signature</span></div><div>Validation RH<br><span>Date / signature</span></div></div><div class="alert section"><b>Document de suivi RH :</b> sa valeur officielle dépend de la validation RH, de l’identité des signataires et des règles documentaires du Groupe BIA.</div><div class="form-actions"><button class="btn" data-print>Imprimer / PDF RH</button>${["lean","director"].includes(state.role)?`<button class="btn secondary" data-new-training-record data-person-id="${p.id}">Ajouter une formation</button>`:""}<button class="btn ghost" data-close-modal>Fermer</button></div></div>`)}

function renderAccount(){
  const caps={dg:["Voir la synthèse Groupe","Arbitrer les décisions","Consulter les KPI et bonnes pratiques"],lean:["Accéder aux six sites","Animer le système Lean","Configurer les référentiels fonctionnels"],director:["Piloter le site attribué","Décider et escalader","Consulter les données de son site"],terrain:["Créer un Signal Terrain","Animer le TOP 15 selon habilitation","Voir les actions de son périmètre"]}[state.role];
  return `${pageHead("Compte","Profil et habilitations","Les profils adaptent l’interface locale. L’authentification et le partage entre appareils ne sont pas encore connectés.",state.role==="lean"?'<button class="btn" data-new-account>＋ Ajouter un compte</button>':"")}
    <div class="grid main-aside"><section class="panel account-role"><p class="eyebrow">Profil actif</p><h2>Profil de démonstration</h2><p>${esc(role().label)}</p><p class="hint">Périmètre : ${esc(site().name)}${workshop()?` · ${esc(workshop().name)}`:""}</p><div class="check-list section">${caps.map(c=>`<div class="check">✓ ${esc(c)}</div>`).join("")}</div></section>
    <aside class="panel"><h2>Les quatre profils fonctionnels</h2><div class="list section">${Object.values(ROLES).map(r=>`<div class="row"><b>${esc(r.label)}</b><span class="row-meta" style="display:block">Périmètre ${esc(r.scope)}</span></div>`).join("")}</div></aside></div>
    ${state.role==="lean"?`<section class="section"><div class="section-title"><h2>Comptes déclarés</h2><span class="badge">${data.accounts.length}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Rôle</th><th>Périmètre</th><th>Statut</th></tr></thead><tbody>${data.accounts.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td>${esc(ROLES[a.role]?.label||a.role)}</td><td>${esc(getSiteName(a.site_id))}</td><td>${pill(a.status,a.status==="Actif"?"done":"neutral")}</td></tr>`).join("")}</tbody></table></div></section>`:""}
    <section class="panel section"><h2>Sauvegarde locale</h2><p class="hint">Exportez un fichier avant de changer d’appareil. L’import contrôle le schéma et conserve une sauvegarde avant remplacement.</p><div class="row-actions"><button class="btn secondary" data-export>Exporter les données</button>${state.role==="lean"?`<label class="btn secondary" style="display:inline-flex;align-items:center">Restaurer une sauvegarde<input type="file" id="importFile" accept=".json,application/json" hidden></label>${localStorage.getItem(`${STORAGE_KEY}-before-import`)?'<button class="btn secondary" data-export-previous>Télécharger la version avant import</button>':""}`:""}</div></section>`;
}
function renderSettings(){
  return `${pageHead("Paramètres","Référentiels et intégrations","Fonctions réservées au Responsable Lean Groupe.")}
    <div class="grid cols-3"><article class="card"><div class="metric-label">Organisation</div><div class="metric-value">6 <small>sites</small></div><p class="hint">Ag Déco, Europlacage, Marzin, Oraison Menuiserie, Profiline, Sodeplax.</p></article><article class="card"><div class="metric-label">SEQUOIA</div><div class="metric-value" style="font-size:22px">Non connecté</div><p class="hint">API, base, exports, droits et fréquence restent à vérifier.</p></article><article class="card"><div class="metric-label">Journal de synchronisation</div><div class="metric-value">${data.syncLog.length}</div><p class="hint">Aucun flux automatique actif.</p></article></div>
    <section class="panel section"><h2>Contrat d’intégration futur</h2><div class="check-list"><div class="check">1. Extraire vers une zone de staging</div><div class="check">2. Valider unités, doublons, périmètre et fraîcheur</div><div class="check">3. Publier seulement les mesures acceptées</div><div class="check">4. Conserver source, horodatage et journal d’erreur</div><div class="check">5. Autoriser un secours manuel tracé</div></div></section>`;
}

function documentExample(type,field){
  const examples={problem:"Exemple : 7 pièces sur 100 présentent une rayure après le poste de ponçage, depuis le 18 septembre.",current:"Exemple : 7 % de défauts sur l’équipe du matin contre 1 % habituellement.",target:"Exemple : revenir sous 1 % de défauts avant le 30 septembre.",root_cause:"Exemple : le test confirme que le guide usé met la pièce en contact avec le bâti.",countermeasures:"Exemple : remplacer le guide, puis vérifier 3 séries consécutives.",action_plan:"Exemple : Julie remplace le guide avant vendredi et joint une photo.",effectiveness:"Exemple : 0 défaut sur 300 pièces pendant 5 jours ; contrôle réalisé par Marc.",standardization:"Exemple : standard du poste mis à jour en version 4 et équipe formée.",d1:"Exemple : pilote Qualité, chef d’équipe, maintenance et opérateur du poste.",d2:"Décrire avec des nombres : quoi, où, quand, combien et sur quelles références.",d3:"Exemple : bloquer le lot, contrôler le stock et informer le client.",d4_occurrence:"Noter la cause testée et la preuve obtenue, pas seulement une hypothèse.",d4_escape:"Expliquer pourquoi le contrôle prévu n’a pas vu le défaut.",d5:"Choisir une action qui supprime la cause, avec responsable et date.",d6:"Comparer les résultats avant/après sur une période suffisante.",d7:"Mettre à jour standard, contrôle, AMDEC et formation si nécessaire.",d8:"Noter la décision de clôture et ce que l’équipe retient.",event:"Exemple : défaut de collage constaté sur le lot 245, poste 3, à 08:20.",containment:"Exemple : arrêt du poste, isolement du lot et contrôle du stock.",facts:"Décrire uniquement ce qui est vu et mesuré.",cause:"Écrire l’hypothèse, le test réalisé et le résultat.",verification:"Exemple : contrôle de 3 lots sans récidive, vérifié par le responsable qualité."};
  return examples[field]||"Écrivez avec des mots simples : ce que vous voyez, comment vous le savez et ce qui doit se passer ensuite.";
}
function trainingRecordForm(personId=null){
  const people=trainingPeople(),selected=personId||people[0]?.id;if(!people.length)return toast("Ajoutez d’abord une personne au registre.");
  modal("Enregistrer une formation / qualification",`<form id="trainingRecordForm"><div class="form-grid"><label>Collaborateur<select id="recordPerson">${people.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)} · ${esc(getSiteName(p.site_id))}</option>`).join("")}</select></label><label>Formation<select id="recordTraining">${data.trainingCatalog.map(t=>`<option value="${t.id}">${esc(t.code)} · ${esc(t.title)}</option>`).join("")}</select></label><label>Date de réalisation<input id="recordDate" type="date" value="${today()}" required></label><label>Formateur<input id="recordTrainer" required></label><label>Présence<select id="recordAttendance"><option>Présent</option><option>Partiel</option><option>Absent</option></select></label><label>Score /100<input id="recordScore" type="number" min="0" max="100" placeholder="Si applicable"></label><label>Niveau démontré<select id="recordLevel">${TRAINING_LEVELS.map((x,i)=>`<option value="${i}">${esc(x)}</option>`).join("")}</select></label><label>Décision<select id="recordStatus"><option>À évaluer</option><option>Validé</option><option>Non validé</option></select></label><label class="wide">Preuve d’évaluation<textarea id="recordEvidence" rows="3" placeholder="Quiz, mise en situation, observation au poste, dossier soutenu…"></textarea></label><label>Validé par<input id="recordValidator" placeholder="Nom et fonction"></label><label>Date de validation<input id="recordValidatedAt" type="date"></label></div><div class="alert section"><b>Règle :</b> « Présent » ne signifie pas « autonome ». Un niveau 3 à 5 exige une évaluation pratique et un validateur identifié.</div><div class="form-actions"><button class="btn">Enregistrer dans le dossier RH</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("trainingRecordForm").onsubmit=e=>{e.preventDefault();const training=data.trainingCatalog.find(t=>t.id===$("recordTraining").value),status=$("recordStatus").value,level=Number($("recordLevel").value),evidence=$("recordEvidence").value.trim(),validator=$("recordValidator").value.trim(),validatedAt=$("recordValidatedAt").value;if(status==="Validé"&&(!evidence||!validator||!validatedAt))return toast("Une pratique validée exige une preuve, un validateur et une date de validation.");if(status==="Validé"&&($("recordAttendance").value==="Absent"||validatedAt>today()||validatedAt<$("recordDate").value))return toast("Vérifiez la présence et les dates de réalisation / validation.");const expiry=training?.validity_months&&validatedAt?new Date(new Date(validatedAt).setMonth(new Date(validatedAt).getMonth()+training.validity_months)).toISOString().slice(0,10):null,item={id:nextId("REC",data.trainingRecords),person_id:$("recordPerson").value,training_id:$("recordTraining").value,date:$("recordDate").value,trainer:$("recordTrainer").value.trim(),attendance:$("recordAttendance").value,score:$("recordScore").value===""?null:Number($("recordScore").value),level,status,evidence,validated_by:validator,validated_at:validatedAt||null,expires_at:expiry,created_at:now()};if(!commitData(()=>data.trainingRecords.unshift(item)))return;closeModal();state.trainingTab="people";render();toast(`${item.id} enregistré dans Formation → dossier individuel.`)};
}
function trainingPersonForm(){
  const siteId=state.site==="group"?"marzin":state.site;modal("Ajouter une personne au suivi formation",`<form id="trainingPersonForm"><div class="form-grid"><label>Matricule<input id="personEmployeeId" required placeholder="Identifiant RH"></label><label>Nom et prénom<input id="personName" required></label><label>Entité<select id="personSite">${OPERATIONAL_SITES.filter(s=>allowedSite(s.id,true)).map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Atelier / service<input id="personWorkshop"></label><label>Fonction<input id="personJob" required></label><label>Responsable hiérarchique<input id="personManager"></label></div><div class="form-actions"><button class="btn">Créer le dossier</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);$("trainingPersonForm").onsubmit=e=>{e.preventDefault();const item={id:nextId("PER",data.people),employee_id:$("personEmployeeId").value.trim(),name:$("personName").value.trim(),site_id:$("personSite").value,workshop:$("personWorkshop").value.trim(),job:$("personJob").value.trim(),manager:$("personManager").value.trim(),status:"Actif"};if(!commitData(()=>data.people.push(item)))return;closeModal();state.trainingTab="people";render();toast(`Dossier ${item.id} créé pour ${item.name}.`)}
}
function trainingForm(){
  modal("Nouvelle formation",`<form id="trainingForm"><div class="form-grid"><label>Code<input id="trainingCode" required placeholder="BIA-XXX-01"></label><label>Catégorie<input id="trainingCategory" required></label><label class="wide">Intitulé<input id="trainingTitle" required></label><label>Durée (heures)<input id="trainingDuration" type="number" min="0.5" step="0.5" required></label><label>Validité (mois)<input id="trainingValidity" type="number" min="1" placeholder="Vide si aucune"></label><label class="wide">Objectifs<textarea id="trainingObjectives" rows="3" required></textarea></label><label class="wide">Modules <small>(un par ligne)</small><textarea id="trainingModules" rows="5" required></textarea></label><label class="wide">Mode d’évaluation<input id="trainingEvaluation" required></label></div><div class="form-actions"><button class="btn">Créer le programme</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);$("trainingForm").onsubmit=e=>{e.preventDefault();const item={id:nextId("FOR",data.trainingCatalog),code:$("trainingCode").value.trim(),title:$("trainingTitle").value.trim(),category:$("trainingCategory").value.trim(),duration:Number($("trainingDuration").value),validity_months:$("trainingValidity").value?Number($("trainingValidity").value):null,objectives:$("trainingObjectives").value.trim(),modules:$("trainingModules").value.split("\n").map(x=>x.trim()).filter(Boolean),evaluation:$("trainingEvaluation").value.trim(),status:"Brouillon"};if(!commitData(()=>data.trainingCatalog.push(item)))return;closeModal();render();toast(`Formation ${item.code} créée en brouillon.`)}
}
function accountForm(){
  modal("Ajouter un compte",`<form id="accountForm"><div class="form-grid"><label class="wide">Nom<input id="accountName" required></label><label>Rôle<select id="accountRole">${Object.entries(ROLES).map(([id,r])=>`<option value="${id}">${esc(r.label)}</option>`).join("")}</select></label><label>Périmètre<select id="accountSite">${SITES.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label></div><div class="alert section">Cette étape prépare l’habilitation locale. L’invitation et l’authentification réelles nécessitent un backend validé.</div><div class="form-actions"><button class="btn">Enregistrer l’habilitation</button></div></form>`);
  $("accountForm").onsubmit=e=>{e.preventDefault();const accountRole=$("accountRole").value,accountSite=$("accountSite").value;if(["director","terrain"].includes(accountRole)&&accountSite==="group")return toast("Un profil Site ou Terrain doit avoir une entité attribuée.");data.accounts.push({id:nextId("U",data.accounts),name:$("accountName").value.trim(),role:accountRole,site_id:accountSite,workshop_id:null,status:"Préparé"});if(!save())return;closeModal();render();toast("Habilitation préparée ; aucune invitation externe envoyée.")};
}
function projectForm(existing=null){
  if(existing&&!allowedSite(existing.site_id,true))return;
  const siteId=existing?.site_id||(state.site==="group"?"marzin":state.site);
  modal(existing?`${existing.id} · Mettre à jour le chantier`:"Nouveau chantier",`<form id="projectForm"><div class="form-grid"><label class="wide">Titre<input id="projectTitle" value="${esc(existing?.title||"")}" required></label><label>Méthode<select id="projectMethod">${["SMED","VSM","DMAIC","Kaizen","PDCA","TPM","Industrialisation"].map(x=>`<option ${x===existing?.method?"selected":""}>${x}</option>`).join("")}</select></label><label>Site<select id="projectSite">${OPERATIONAL_SITES.filter(s=>allowedSite(s.id,true)).map(s=>`<option value="${s.id}" ${s.id===siteId?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Responsable<input id="projectOwner" value="${esc(existing?.owner||"")}" required></label><label>Statut<select id="projectStatus">${["Cadrage","Mesure","Analyse","Essai","Déploiement","Bloqué","Clos"].map(x=>`<option ${x===(existing?.status||"Cadrage")?"selected":""}>${x}</option>`).join("")}</select></label><label>Avancement (%)<input id="projectProgress" type="number" min="0" max="100" value="${existing?.progress||0}" required></label><label>Date cible<input id="projectDate" type="date" value="${existing?.target_date||""}"></label><label>Référence avant<input id="projectBaseline" value="${esc(existing?.baseline||"")}" placeholder="Valeur et unité"></label><label>Cible<input id="projectTarget" value="${esc(existing?.target||"")}" placeholder="Résultat attendu"></label><label class="wide">Résultat vérifié<input id="projectResult" value="${esc(existing?.result||"Non vérifié")}" placeholder="Mesure après et période de tenue"></label><label>Problème lié<input id="projectProblem" value="${esc(existing?.problem_id||"")}" placeholder="Ex. P-012"></label></div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("projectForm").onsubmit=e=>{e.preventDefault();const status=$("projectStatus").value,result=$("projectResult").value.trim();if(status==="Clos"&&(!result||result==="Non vérifié"))return toast("Un chantier ne peut être clos sans résultat vérifié.");const payload={site_id:$("projectSite").value,title:$("projectTitle").value.trim(),method:$("projectMethod").value,status,owner:$("projectOwner").value.trim(),progress:Number($("projectProgress").value),target_date:$("projectDate").value||null,baseline:$("projectBaseline").value.trim()||"À mesurer",target:$("projectTarget").value.trim()||"À définir",result:result||"Non vérifié",problem_id:$("projectProblem").value.trim()||null,action_ids:existing?.action_ids||[],updated_at:now()};if(payload.problem_id&&!data.problems.some(p=>p.id===payload.problem_id&&p.site_id===payload.site_id))return toast("Choisissez un problème existant sur le même site.");if(!commitData(()=>{if(existing)Object.assign(data.projects.find(x=>x.id===existing.id),payload);else data.projects.unshift({id:nextId("CH",data.projects),created_at:now(),...payload});}))return;closeModal();state.site=payload.site_id;render();toast(existing?"Chantier mis à jour.":"Chantier créé.")};
}
function roadmapForm(existing=null){
  if(existing&&!allowedSite(existing.site_id,true))return toast("Cette priorité Groupe est modifiable par le Responsable Lean Groupe.");
  const defaultSite=state.site==="group"?"group":state.site;modal(existing?`${existing.id} · Priorité roadmap`:"Nouvelle priorité roadmap",`<form id="roadmapForm"><div class="form-grid"><label class="wide">Priorité<input id="roadmapTitle" required value="${esc(existing?.title||"")}" placeholder="Commencer par un verbe"></label><label>Périmètre<select id="roadmapSite">${SITES.filter(s=>allowedSite(s.id,true)).map(s=>`<option value="${s.id}" ${s.id===(existing?.site_id||defaultSite)?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Horizon<select id="roadmapHorizon">${["0-30 jours","31-60 jours","61-90 jours","3-12 mois"].map(x=>`<option ${x===(existing?.horizon||"0-30 jours")?"selected":""}>${x}</option>`).join("")}</select></label><label class="wide">Résultat concret attendu<textarea id="roadmapOutcome" required rows="3">${esc(existing?.outcome||"")}</textarea></label><label>Propriétaire<input id="roadmapOwner" required value="${esc(existing?.owner||"")}"></label><label>Indicateur de réussite<input id="roadmapKpi" required value="${esc(existing?.kpi||"")}"></label><label>Échéance<input id="roadmapDate" type="date" required value="${existing?.target_date||today()}"></label><label>Avancement (%)<input id="roadmapProgress" type="number" min="0" max="100" value="${existing?.progress||0}"></label><label>Statut<select id="roadmapStatus">${["À lancer","En cours","Bloqué","Terminé"].map(x=>`<option ${x===(existing?.status||"À lancer")?"selected":""}>${x}</option>`).join("")}</select></label></div><div class="alert section"><b>Test :</b> si le résultat et l’indicateur ne permettent pas de dire clairement « atteint / non atteint », la priorité doit être reformulée.</div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);$("roadmapForm").onsubmit=e=>{e.preventDefault();const payload={site_id:$("roadmapSite").value,horizon:$("roadmapHorizon").value,title:$("roadmapTitle").value.trim(),outcome:$("roadmapOutcome").value.trim(),owner:$("roadmapOwner").value.trim(),kpi:$("roadmapKpi").value.trim(),target_date:$("roadmapDate").value,progress:Number($("roadmapProgress").value),status:$("roadmapStatus").value,updated_at:now()};if(payload.status==="Terminé"&&payload.progress<100)return toast("Une priorité terminée doit être à 100 %.");if(!commitData(()=>{if(existing)Object.assign(data.roadmap.find(x=>x.id===existing.id),payload);else data.roadmap.push({id:nextId("RM",data.roadmap),...payload});}))return;closeModal();render();toast(existing?"Priorité mise à jour.":"Priorité ajoutée à la roadmap.")}
}
function startTool(moduleId){
  const target=state.site==="group"?"marzin":state.site;let run=(data.toolRuns||[]).find(r=>r.module_id===moduleId&&r.site_id===target);if(!run){run={id:nextId("RUN",data.toolRuns),site_id:target,module_id:moduleId,owner:"À attribuer",status:"En cours",checks:[],started_at:now(),updated_at:now()};if(!commitData(()=>data.toolRuns.push(run)))return;}state.view="tools";state.toolId=moduleId;render();document.getElementById("toolChecklist")?.scrollIntoView?.({behavior:"smooth",block:"start"});toast(`${run.id} enregistré dans Bibliothèque → Mes démarches. Suivez maintenant la checklist.`);
}
function updateToolCheck(input){
  const target=state.site==="group"?"marzin":state.site;let run=(data.toolRuns||[]).find(r=>r.module_id===input.dataset.module&&r.site_id===target);if(!run){startTool(input.dataset.module);run=data.toolRuns.find(r=>r.module_id===input.dataset.module&&r.site_id===target)}if(!run)return;const checks=new Set(run.checks||[]),index=Number(input.dataset.toolCheck);input.checked?checks.add(index):checks.delete(index);const module=LEAN_MODULES.find(x=>x.id===input.dataset.module);if(!commitData(()=>{const row=data.toolRuns.find(x=>x.id===run.id);row.checks=[...checks].sort((a,b)=>a-b);row.updated_at=now();row.status=row.checks.length===module.checklist.length?"Terminé":"En cours";}))return;render();
}

function bindModal(){
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=requestCloseModal);
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>window.print());
  document.querySelectorAll("[data-new-action]").forEach(b=>b.onclick=()=>{launchAction(b);});
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-problem-from-signal]").forEach(b=>b.onclick=()=>problemFromSignal(b.dataset.problemFromSignal));
  document.querySelectorAll("[data-new-training-record]").forEach(b=>b.onclick=()=>{const personId=b.dataset.personId;closeModal();trainingRecordForm(personId)});
}
function bind(){
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>switchView(b.dataset.nav));
  document.querySelectorAll("[data-set-site]").forEach(b=>b.onclick=()=>{state.site=b.dataset.setSite;localStorage.setItem("biaSite",state.site);if(state.view==="home")state.view=state.role==="dg"?"pilotage":"home";render()});
  document.querySelectorAll("[data-new-signal]").forEach(b=>b.onclick=()=>newSignalForm());
  document.querySelectorAll("[data-open-signal]").forEach(b=>b.onclick=()=>openSignal(b.dataset.openSignal));
  document.querySelectorAll("[data-advance-signal]").forEach(b=>b.onclick=()=>advanceSignal(b.dataset.advanceSignal));
  document.querySelectorAll("[data-new-action]").forEach(b=>b.onclick=()=>{launchAction(b);});
  document.querySelectorAll("[data-edit-action]").forEach(b=>b.onclick=()=>actionForm(data.actions.find(x=>x.id===b.dataset.editAction)));
  document.querySelectorAll("[data-advance-action]").forEach(b=>b.onclick=()=>advanceAction(b.dataset.advanceAction));
  document.querySelectorAll("[data-action-filter]").forEach(b=>b.onclick=()=>{state.actionFilter=b.dataset.actionFilter;render()});
  document.querySelectorAll("[data-terrain-tab]").forEach(b=>b.onclick=()=>{state.terrainTab=b.dataset.terrainTab;render()});
  document.querySelectorAll("[data-new-gemba]").forEach(b=>b.onclick=()=>gembaForm());
  document.querySelectorAll("[data-new-problem]").forEach(b=>b.onclick=()=>genericProblemForm());
  document.querySelectorAll("[data-edit-problem]").forEach(b=>b.onclick=()=>editProblem(b.dataset.editProblem));
  document.querySelectorAll("[data-select-problem]").forEach(b=>b.onclick=()=>{state.selectedProblemId=b.dataset.selectProblem;render()});
  document.querySelectorAll("[data-new-document]").forEach(b=>b.onclick=()=>simpleDocument(b.dataset.newDocument));
  document.querySelectorAll("[data-open-document]").forEach(b=>b.onclick=()=>editDocument(b.dataset.openDocument));
  document.querySelectorAll("[data-training-tab]").forEach(b=>b.onclick=()=>{state.trainingTab=b.dataset.trainingTab;render()});
  document.querySelectorAll("[data-open-training]").forEach(b=>b.onclick=()=>openTraining(b.dataset.openTraining));
  document.querySelectorAll("[data-training-person]").forEach(b=>b.onclick=()=>openTrainingPerson(b.dataset.trainingPerson));
  document.querySelectorAll("[data-new-training-record]").forEach(b=>b.onclick=()=>trainingRecordForm(b.dataset.personId||null));
  document.querySelectorAll("[data-new-training-person]").forEach(b=>b.onclick=trainingPersonForm);
  document.querySelectorAll("[data-new-training]").forEach(b=>b.onclick=trainingForm);
  document.querySelectorAll("[data-new-roadmap]").forEach(b=>b.onclick=()=>roadmapForm());
  document.querySelectorAll("[data-edit-roadmap]").forEach(b=>b.onclick=()=>roadmapForm(data.roadmap.find(x=>x.id===b.dataset.editRoadmap)));
  document.querySelectorAll("[data-new-project]").forEach(b=>b.onclick=()=>projectForm());
  document.querySelectorAll("[data-edit-project]").forEach(b=>b.onclick=()=>projectForm(data.projects.find(x=>x.id===b.dataset.editProject)));
  document.querySelectorAll("[data-action-from-project]").forEach(b=>b.onclick=()=>{const p=data.projects.find(x=>x.id===b.dataset.actionFromProject);actionForm(null,{site_id:p.site_id,title:`${p.method} · ${p.title}`,origin_type:"Chantier",origin_id:p.id,description:`Action liée au chantier ${p.id}`})});
  document.querySelectorAll("[data-new-audit]").forEach(b=>b.onclick=()=>auditForm());
  document.querySelectorAll("[data-edit-audit]").forEach(b=>b.onclick=()=>auditForm(data.audits.find(x=>x.id===b.dataset.editAudit)));
  document.querySelectorAll("[data-open-subject]").forEach(b=>b.onclick=()=>openSubject(b.dataset.openSubject));
  document.querySelectorAll("[data-new-practice]").forEach(b=>b.onclick=()=>practiceForm());
  document.querySelectorAll("[data-new-account]").forEach(b=>b.onclick=accountForm);
  document.querySelectorAll("[data-open-tool]").forEach(b=>b.onclick=()=>{if(b.dataset.runSite){state.site=b.dataset.runSite;localStorage.setItem("biaSite",state.site)}state.toolId=b.dataset.openTool;if(role().nav.includes("tools")){state.view="tools";render()}else openToolGuide(b.dataset.openTool);});
  document.querySelectorAll("[data-back-tools]").forEach(b=>b.onclick=()=>{state.toolId=null;render()});
  document.querySelectorAll("[data-tool-category]").forEach(b=>b.onclick=()=>{state.toolCategory=b.dataset.toolCategory;render()});
  document.querySelectorAll("[data-route-tool]").forEach(b=>b.onclick=()=>{const route=LEAN_ROUTES.find(x=>x[0]===b.dataset.routeTool),tool=LEAN_MODULES.find(x=>x.title===route?.[2]);if(tool){state.toolId=tool.id;render()}});
  document.querySelectorAll("[data-start-tool]").forEach(b=>b.onclick=()=>startTool(b.dataset.startTool));
  document.querySelectorAll("[data-tool-action]").forEach(b=>b.onclick=()=>{const tool=LEAN_MODULES.find(x=>x.id===b.dataset.toolAction);actionForm(null,{title:`${tool.title} · première action`,origin_type:"Outil Lean",origin_id:tool.id,description:tool.steps[0]})});
  document.querySelectorAll("[data-tool-check]").forEach(b=>b.onchange=()=>updateToolCheck(b));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>window.print());
  $("toolSearch")?.addEventListener("input",e=>{state.toolQuery=e.target.value;const cursor=e.target.selectionStart;clearTimeout(window.toolSearchTimer);window.toolSearchTimer=setTimeout(()=>{render();$("toolSearch")?.focus();$("toolSearch")?.setSelectionRange(cursor,cursor)},180)});
  document.querySelectorAll("[data-export]").forEach(b=>b.onclick=exportData);
  $("importFile")?.addEventListener("change",importData);
}
function exportData(){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`bia-production-system-v5-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("Sauvegarde exportée.");
}
