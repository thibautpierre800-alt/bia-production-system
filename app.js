"use strict";

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));
const isoDate = value => new Date(value || Date.now()).toLocaleDateString("fr-FR");
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const clone = value => JSON.parse(JSON.stringify(value));

const SITES = [
  {id:"marzin",name:"Marzin"},{id:"europlacage",name:"Europlacage"},{id:"sodeplax",name:"Sodeplax"},
  {id:"oraison-menuiserie",name:"Oraison Menuiserie"},{id:"profiline",name:"Profiline"},
  {id:"marquoplac",name:"Marquoplac"},{id:"lmdp",name:"LMDP"}
];
const KPI_DEFS = {
  trs:{label:"TRS",unit:"%",target:85,direction:"high"},rebuts:{label:"Rebuts",unit:"%",target:3,direction:"low"},
  otif:{label:"OTIF",unit:"%",target:95,direction:"high"},maturity:{label:"Maturité",unit:"/ 5",target:3.5,direction:"high"}
};
const NAV = [
  ["home","⌂","Accueil"],["control","◫","Pilotage"],["kpi","▥","Indicateurs"],["actions","✓","Actions"],
  ["gemba","⌁","Gemba"],["audits","◎","Audits"],["improve","↗","Chantiers"],["practices","✦","Pratiques"],
  ["tools","▦","Outils"],["account","◉","Compte"]
];
const AUDIT_DOMAINS = ["Sécurité","Production","Qualité","Maintenance","Logistique","Achats","Industrialisation","Ressources humaines","Management","Amélioration continue"];
const SITE_BASELINES = {
  marzin:[78,5,91,2.4],europlacage:[84,3.1,95,2.8],sodeplax:[81,4.2,93,2.6],
  "oraison-menuiserie":[86,2.8,96,3],profiline:[79,4.7,92,2.5],marquoplac:[88,2.4,97,3.2],lmdp:[82,3.8,94,2.7]
};

function seedMeasurements(){
  const rows=[];
  for(const site of SITES){
    const base=SITE_BASELINES[site.id];
    [6,5,4,3,2,1,0].forEach((ago,index)=>{
      const date=new Date();date.setDate(date.getDate()-ago*7);
      const variance=(index-3)*.45;
      rows.push({id:uid("kpi"),site_id:site.id,period:date.toISOString().slice(0,10),trs:+(base[0]+variance).toFixed(1),rebuts:+Math.max(.2,base[1]-variance/5).toFixed(1),otif:+Math.min(100,base[2]+variance/3).toFixed(1),maturity:base[3]});
    });
  }
  return rows;
}

const DEMO = {
  measurements:seedMeasurements(),
  actions:[
    {id:"a1",site_id:"marzin",title:"Réduire les micro-arrêts ligne usinage",owner:"Production",priority:"Haute",status:"Ouverte",due_date:"2026-10-04",origin_type:"KPI",description:"Pareto des pertes puis observation des trois causes principales."},
    {id:"a2",site_id:"marzin",title:"Valider le standard de contrôle",owner:"Qualité",priority:"Moyenne",status:"En cours",due_date:"2026-10-08",origin_type:"Gemba",description:"Valider le standard avec l'équipe au poste."},
    {id:"a3",site_id:"marzin",title:"Revoir le flux d'évacuation",owner:"Logistique",priority:"Moyenne",status:"Bloquée",due_date:"2026-09-28",origin_type:"Audit",description:"Arbitrage layout nécessaire."}
  ],
  gembas:[
    {id:"g1",site_id:"marzin",workshop:"Production",finding:"Accumulation de pièces avant contrôle final.",category:"Flux",priority:"Haute",observed_at:"2026-09-19T08:30:00Z",action_id:"a1"},
    {id:"g2",site_id:"marzin",workshop:"Qualité",finding:"Standard de contrôle non affiché au poste.",category:"Qualité",priority:"Moyenne",observed_at:"2026-09-18T11:00:00Z",action_id:"a2"}
  ],
  audits:[{id:"u1",site_id:"marzin",status:"Terminé",score:31,notes:"Audit Excellence — atelier usinage",performed_at:"2026-09-15",audit_data:{scores:[3,3,4,2,3,3,4,3,3,3]}}],
  projects:[
    {id:"p1",site_id:"marzin",title:"Fiabiliser le changement de série",method:"SMED",status:"En cours",owner:"Méthodes",objective:"Passer sous 35 minutes avec un redémarrage stable.",expected_gain:20,gain_unit:"%",progress:58,target_date:"2026-11-15"},
    {id:"p2",site_id:"marzin",title:"Stabiliser le contrôle premier article",method:"A3",status:"Cadrage",owner:"Qualité",objective:"Réduire les reprises de démarrage.",expected_gain:30,gain_unit:"%",progress:23,target_date:"2026-11-01"}
  ],
  practices:[
    {id:"bp1",site_id:"marquoplac",title:"Standard de réglage de démarrage",category:"Performance",summary:"Check-list opérateur qui stabilise les 30 premières minutes de production.",expected_gain:"−18 % de micro-arrêts",status:"Publiée"},
    {id:"bp2",site_id:"oraison-menuiserie",title:"Point sécurité de cinq minutes",category:"Sécurité",summary:"Rituel quotidien au poste avant démarrage.",expected_gain:"Meilleure remontée des risques",status:"Publiée"}
  ],
  toolkitRuns:[],knowledgeSources:[],meta:{version:5,demo:true,updated_at:new Date().toISOString()}
};

let db=null,session=null,profile=null,active=localStorage.getItem("biaV5View")||"home";
let siteId=localStorage.getItem("biaV5Site")||"marzin";
let data=loadLocal();
const current = currentSite;
const CLOUD_ENABLED = window.BIA_SUPABASE?.v5Validated === true;

function loadLocal(){
  try{
    const saved=JSON.parse(localStorage.getItem("biaV5Data"));
    if(saved?.meta?.version===5)return {...clone(DEMO),...saved};
  }catch(error){console.warn("Données locales illisibles",error)}
  return clone(DEMO);
}
function saveLocal(){data.meta={...data.meta,version:5,updated_at:new Date().toISOString()};try{localStorage.setItem("biaV5Data",JSON.stringify(data));updateSyncLabel();return true}catch(error){toast("Sauvegarde impossible : stockage plein ou indisponible. Exportez vos données.");return false}}
function currentSite(){return SITES.find(site=>site.id===siteId)||SITES[0]}
function forSite(key,id=siteId){return (data[key]||[]).filter(item=>item.site_id===id)}
function latestMeasurement(id=siteId){return forSite("measurements",id).sort((a,b)=>String(b.period).localeCompare(String(a.period)))[0]||{trs:null,rebuts:null,otif:null,maturity:null}}
function previousMeasurement(id=siteId){return forSite("measurements",id).sort((a,b)=>String(b.period).localeCompare(String(a.period)))[1]||latestMeasurement(id)}
function metricState(key,value){const def=KPI_DEFS[key];const ok=def.direction==="high"?value>=def.target:value<=def.target;return ok?"good":"bad"}
function isOverdue(action){return action?.due_date&&action.status!=="Clôturée"&&new Date(action.due_date)<new Date(today())}
function openActions(id=siteId){return forSite("actions",id).filter(action=>action.status!=="Clôturée")}
function toast(message){const node=$("toast");node.textContent=message;node.hidden=false;clearTimeout(window.biaToast);window.biaToast=setTimeout(()=>node.hidden=true,3300)}
function updateSyncLabel(){const label=$("syncLabel");if(!label)return;label.textContent=session?"Compte connecté":"Sauvegarde sur cet appareil";label.previousElementSibling?.classList.toggle("local",!session)}
function statusPill(value){const normalized=String(value||"");const cls=normalized.includes("Bloq")?"blocked":normalized.includes("cours")?"progress":normalized.includes("Clôt")||normalized.includes("Termin")||normalized.includes("Publi")?"done":"open";return `<span class="pill ${cls}">${esc(normalized)}</span>`}
function priorityPill(value){const cls=value==="Haute"?"high":value==="Moyenne"?"medium":"low";return `<span class="pill ${cls}">${esc(value)}</span>`}
function empty(message){return `<div class="empty">${esc(message)}</div>`}

function renderNav(){
  const html=NAV.map(([id,icon,label])=>`<button class="nav-button ${active===id?"active":""}" data-nav="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join("");
  $("desktopNav").innerHTML=html;$("mobileNav").innerHTML=html;
  document.querySelectorAll("[data-nav]").forEach(button=>button.onclick=()=>switchView(button.dataset.nav));
}
function switchView(id){if(!NAV.some(item=>item[0]===id))id="home";active=id;localStorage.setItem("biaV5View",id);render();window.scrollTo({top:0,behavior:"smooth"});$("main").focus({preventScroll:true})}
function pageHead(kicker,title,lead,button=""){return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="lead">${lead}</p></div>${button}</div>`}
function metricCard(key,value,detail){const def=KPI_DEFS[key];return `<article class="card"><div class="metric-label">${def.label}</div><div class="metric-value">${value==null?"—":value} <small>${def.unit}</small></div><div class="metric-foot ${metricState(key,Number(value))}">${value==null?"Aucune mesure":esc(detail)}</div></article>`}
function actionRow(action,buttons=true){return `<article class="row priority-stripe ${esc(action.priority)}"><div class="card-top"><div>${priorityPill(action.priority)} ${statusPill(action.status)}</div>${isOverdue(action)?'<span class="pill blocked">En retard</span>':""}</div><div class="row-title">${esc(action.title)}</div><div class="row-meta">${esc(action.owner||"À attribuer")} · ${esc(action.origin_type||"Manuel")} · ${action.due_date?`Échéance ${isoDate(action.due_date)}`:"Sans échéance"}</div>${action.description?`<p class="hint">${esc(action.description)}</p>`:""}${buttons?`<div class="row-actions"><button class="btn small ghost" data-advance="${action.id}">Faire avancer</button><button class="btn small secondary" data-edit-action="${action.id}">Modifier</button></div>`:""}</article>`}

function renderHome(){
  const m=latestMeasurement(),previous=previousMeasurement(),actions=openActions(),overdue=actions.filter(isOverdue),gemba=forSite("gembas")[0];
  $("homeView").innerHTML=`
    <section class="hero"><p class="eyebrow">Cockpit du jour · ${esc(currentSite().name)}</p><h1>${overdue.length||actions.filter(a=>a.priority==="Haute").length} priorité(s) demandent une décision</h1><p>Les écarts, constats terrain, audits et chantiers sont réunis dans une seule boucle de pilotage.</p><div class="hero-actions"><button class="btn" data-nav="gemba">＋ Faire un Gemba</button><button class="btn secondary" data-nav="actions">Voir le plan d'actions</button></div></section>
    <div class="grid kpi-grid section">
      ${metricCard("trs",m.trs,`${m.trs>=previous.trs?"+":""}${(m.trs-previous.trs).toFixed(1)} pt vs période précédente`)}
      ${metricCard("rebuts",m.rebuts,`Cible ≤ ${KPI_DEFS.rebuts.target} %`)}
      ${metricCard("otif",m.otif,`Cible ≥ ${KPI_DEFS.otif.target} %`)}
      ${metricCard("maturity",m.maturity,`${forSite("audits").length} audit(s) enregistré(s)`)}
    </div>
    <div class="grid two-col section"><section><div class="section-title"><h2>Actions prioritaires</h2><span class="badge">${actions.length} ouvertes</span></div><div class="list">${actions.slice(0,4).map(a=>actionRow(a)).join("")||empty("Aucune action ouverte.")}</div></section><section><div class="section-title"><h2>Signal terrain</h2><span class="badge">Dernier Gemba</span></div>${gemba?`<article class="card"><div class="card-top">${priorityPill(gemba.priority)}<span class="pill info">${esc(gemba.category)}</span></div><h3 style="margin-top:10px">${esc(gemba.finding)}</h3><p class="hint">${esc(gemba.workshop)} · ${isoDate(gemba.observed_at)}</p></article>`:empty("Aucun constat terrain.")}<div class="card section"><div class="section-title"><h3>Santé du plan d'actions</h3><b>${actions.length?Math.round((actions.length-overdue.length)/actions.length*100):100}%</b></div><div class="progress"><span style="width:${actions.length?Math.round((actions.length-overdue.length)/actions.length*100):100}%"></span></div><p class="hint">${overdue.length} action(s) en retard</p></div></section></div>`;
}

function renderControl(){
  const rows=SITES.map(site=>({site,...latestMeasurement(site.id),actions:openActions(site.id).length,overdue:openActions(site.id).filter(isOverdue).length}));
  const avg=key=>{const measured=rows.filter(r=>r[key]!=null);return measured.length?(measured.reduce((sum,row)=>sum+Number(row[key]),0)/measured.length).toFixed(1):"—"};
  $("controlView").innerHTML=`${pageHead("Control Tower","Pilotage Groupe","Comparer les tendances, identifier les risques et décider où accompagner.")}
    <div class="grid kpi-grid"><article class="card"><div class="metric-label">TRS Groupe</div><div class="metric-value">${avg("trs")} %</div><div class="metric-foot">Moyenne des 7 sites</div></article><article class="card"><div class="metric-label">OTIF Groupe</div><div class="metric-value">${avg("otif")} %</div><div class="metric-foot ${metricState("otif",avg("otif"))}">Cible 95 %</div></article><article class="card"><div class="metric-label">Actions ouvertes</div><div class="metric-value">${rows.reduce((s,r)=>s+r.actions,0)}</div><div class="metric-foot bad">${rows.reduce((s,r)=>s+r.overdue,0)} en retard</div></article><article class="card"><div class="metric-label">Maturité Groupe</div><div class="metric-value">${avg("maturity")} / 5</div><div class="metric-foot">Cap 3,5 / 5</div></article></div>
    <section class="section"><div class="section-title"><div><h2>Comparaison contextualisée</h2><p class="hint">Les données affichées sont de démonstration tant qu'elles ne sont pas remplacées par les mesures des sites.</p></div><span class="badge">7 sites</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Site</th><th>TRS</th><th>Rebuts</th><th>OTIF</th><th>Maturité</th><th>Actions</th><th>Signal</th></tr></thead><tbody>${rows.sort((a,b)=>b.trs-a.trs).map((r,i)=>`<tr><td>${i+1}. ${esc(r.site.name)}</td><td>${r.trs}%</td><td>${r.rebuts}%</td><td>${r.otif}%</td><td>${r.maturity}/5</td><td>${r.actions}${r.overdue?` · <span class="bad">${r.overdue} retard</span>`:""}</td><td>${r.trs>=85?'<span class="pill done">Stable</span>':'<span class="pill medium">À accompagner</span>'}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderKpi(){
  const series=forSite("measurements").sort((a,b)=>String(a.period).localeCompare(String(b.period))).slice(-7),m=latestMeasurement();
  $("kpiView").innerHTML=`${pageHead("Mesure","Indicateurs","Une définition commune, une donnée datée et une réaction associée.",'<button class="btn" id="showKpiForm">＋ Nouvelle mesure</button>')}
    <form class="form-card" id="kpiForm" hidden><div class="form-grid"><label>Période<input id="kpiPeriod" type="date" value="${today()}" required></label><label>TRS (%)<input id="kpiTrs" type="number" min="0" max="100" step="0.1" value="${m.trs}" required></label><label>Rebuts (%)<input id="kpiRebuts" type="number" min="0" max="100" step="0.1" value="${m.rebuts}" required></label><label>OTIF (%)<input id="kpiOtif" type="number" min="0" max="100" step="0.1" value="${m.otif}" required></label><label>Maturité (/5)<input id="kpiMaturity" type="number" min="0" max="5" step="0.1" value="${m.maturity}" required></label><label>Commentaire<input id="kpiComment" placeholder="Cause connue ou point à vérifier"></label></div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-hide="kpiForm">Annuler</button></div></form>
    <div class="grid two-col section"><article class="card"><div class="section-title"><h2>Tendance TRS</h2><span class="badge">7 périodes</span></div><div class="chart">${series.map(x=>`<div class="chart-bar" style="--height:${Math.max(5,x.trs)}%"><b>${x.trs}</b><span>${isoDate(x.period).slice(0,5)}</span></div>`).join("")}</div></article><article class="card"><h2>Règles de mesure</h2><div class="list section">${Object.values(KPI_DEFS).map(def=>`<div class="row"><div class="row-title">${def.label}</div><div class="row-meta">Cible ${def.direction==="high"?"≥":"≤"} ${def.target} ${def.unit}</div></div>`).join("")}</div></article></div>
    <section class="section"><div class="section-title"><h2>Historique</h2><span class="badge">${series.length} mesures</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Période</th><th>TRS</th><th>Rebuts</th><th>OTIF</th><th>Maturité</th><th>Commentaire</th></tr></thead><tbody>${[...series].reverse().map(x=>`<tr><td>${isoDate(x.period)}</td><td>${x.trs}%</td><td>${x.rebuts}%</td><td>${x.otif}%</td><td>${x.maturity}/5</td><td>${esc(x.comment||"—")}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderActions(){
  const actions=forSite("actions"),states=["Ouverte","En cours","Bloquée","Clôturée"];
  $("actionsView").innerHTML=`${pageHead("Action Management","Plan d'actions","Chaque écart a un propriétaire, une échéance et une preuve de résultat.",'<button class="btn" id="newAction">＋ Nouvelle action</button>')}
    <div class="filters"><button class="chip active" data-action-filter="all">Toutes</button><button class="chip" data-action-filter="late">En retard</button><button class="chip" data-action-filter="high">Priorité haute</button></div>
    <div class="kanban section" id="actionBoard">${states.map(state=>`<section class="kanban-column"><h3>${state}<span class="badge">${actions.filter(a=>a.status===state).length}</span></h3><div class="list">${actions.filter(a=>a.status===state).map(a=>actionRow(a)).join("")||empty("Aucune action")}</div></section>`).join("")}</div>`;
}

function renderGemba(){
  const rows=forSite("gembas").sort((a,b)=>String(b.observed_at).localeCompare(String(a.observed_at)));
  $("gembaView").innerHTML=`${pageHead("Terrain","Gemba","Observer un fait, qualifier son impact et décider de la prochaine étape.")}
    <div class="grid two-col"><form class="form-card" id="gembaForm"><h2>Nouveau constat</h2><div class="form-grid section"><label>Atelier<select id="gWorkshop"><option>Production</option><option>Qualité</option><option>Logistique</option><option>Maintenance</option><option>Méthodes</option></select></label><label>Catégorie<select id="gCategory"><option>Sécurité</option><option>Qualité</option><option>Performance</option><option>Flux</option><option>Ergonomie</option></select></label><label>Priorité<select id="gPriority"><option>Haute</option><option selected>Moyenne</option><option>Basse</option></select></label><label>Responsable de l'action<input id="gOwner" placeholder="Nom ou équipe"></label><label class="wide">Constat factuel<textarea id="gFinding" rows="4" required placeholder="Ce qui est observé, où et quand — sans supposer la cause"></textarea></label><label class="wide"><input id="gCreateAction" type="checkbox" checked> Créer une action associée</label></div><div class="form-actions"><button class="btn">Enregistrer le constat</button></div></form><section><div class="section-title"><h2>Derniers constats</h2><span class="badge">${rows.length}</span></div><div class="list">${rows.map(g=>`<article class="row"><div class="card-top"><div>${priorityPill(g.priority)} <span class="pill info">${esc(g.category)}</span></div>${g.action_id?'<span class="pill done">Action liée</span>':""}</div><div class="row-title">${esc(g.finding)}</div><div class="row-meta">${esc(g.workshop)} · ${isoDate(g.observed_at)}</div></article>`).join("")||empty("Aucun constat.")}</div></section></div>`;
}

function renderAudits(){
  const audits=forSite("audits"),last=audits[0],score=last?.score||0;
  $("auditsView").innerHTML=`${pageHead("Référentiel Groupe","Audits Excellence","Évaluer avec des preuves et transformer les écarts en actions.",'<button class="btn" id="newAudit">＋ Nouvel audit</button>')}
    <div class="grid kpi-grid"><article class="card"><div class="metric-label">Dernier score</div><div class="score">${score} / 50</div><div class="progress"><span style="width:${score*2}%"></span></div></article><article class="card"><div class="metric-label">Niveau</div><div class="metric-value">${score<20?"Initial":score<30?"Structuré":score<40?"Maîtrisé":"Excellence"}</div><div class="metric-foot">Échelle Groupe commune</div></article><article class="card"><div class="metric-label">Audits réalisés</div><div class="metric-value">${audits.length}</div><div class="metric-foot">Sur le site actif</div></article><article class="card"><div class="metric-label">Actions d'origine audit</div><div class="metric-value">${forSite("actions").filter(a=>a.origin_type==="Audit").length}</div><div class="metric-foot">Suivies au plan d'actions</div></article></div>
    <section class="section"><div class="section-title"><h2>Historique</h2><span class="badge">${audits.length} audit(s)</span></div><div class="list">${audits.map(a=>`<article class="row"><div class="card-top">${statusPill(a.status)}<span class="badge">${a.score}/50</span></div><div class="row-title">${esc(a.notes)}</div><div class="row-meta">${isoDate(a.performed_at)}</div></article>`).join("")||empty("Aucun audit enregistré.")}</div></section>`;
}

function renderImprove(){
  const projects=forSite("projects");
  $("improveView").innerHTML=`${pageHead("Portefeuille de progrès","Chantiers","Prioriser les problèmes, mesurer les gains et capitaliser les standards.",'<button class="btn" id="newProject">＋ Nouveau chantier</button>')}<div class="grid two-col">${projects.map(p=>`<article class="card interactive"><div class="card-top">${statusPill(p.status)}<span class="pill info">${esc(p.method)}</span></div><h2 style="margin-top:11px">${esc(p.title)}</h2><p class="hint">${esc(p.objective||"Objectif à préciser")}</p><div class="section-title section"><span>Avancement</span><b>${p.progress||0}%</b></div><div class="progress"><span style="width:${p.progress||0}%"></span></div><div class="row-meta">${esc(p.owner||"À attribuer")} · Gain attendu ${p.expected_gain||"—"} ${esc(p.gain_unit||"")} · Cible ${p.target_date?isoDate(p.target_date):"à définir"}</div><div class="row-actions"><button class="btn small ghost" data-progress-project="${p.id}">Mettre à jour</button></div></article>`).join("")||empty("Aucun chantier actif.")}</div>`;
}

function renderPractices(){
  const practices=data.practices||[];
  $("practicesView").innerHTML=`${pageHead("Yokoten","Bonnes pratiques","Prouver localement, tester ailleurs puis décider du standard Groupe.",'<button class="btn" id="newPractice">＋ Partager</button>')}<div class="grid two-col">${practices.map(p=>`<article class="card interactive"><div class="card-top"><span class="pill info">${esc(p.category)}</span>${statusPill(p.status)}</div><h2 style="margin-top:11px">${esc(p.title)}</h2><p class="hint">${esc(p.summary)}</p><div class="row-meta">Origine ${esc(SITES.find(s=>s.id===p.site_id)?.name||p.site_id)} · ${esc(p.expected_gain||"Gain à mesurer")}</div><div class="row-actions"><button class="btn small ghost" data-deploy-practice="${p.id}">Étudier le déploiement</button></div></article>`).join("")||empty("Aucune pratique publiée.")}</div>`;
}

function renderAccount(){
  const localSize=Math.round((localStorage.getItem("biaV5Data")||"").length/1024);
  $("accountView").innerHTML=`${pageHead("Accès & données","Compte","Gérer la connexion, la sauvegarde locale et la synchronisation.")}
    ${session?`<article class="card profile-card"><div class="avatar">${esc((profile?.display_name||session.user.email||"?").slice(0,2).toUpperCase())}</div><div><h2>${esc(profile?.display_name||session.user.email)}</h2><p class="hint">${esc(profile?.role||"Profil à activer")} · ${esc(SITES.find(s=>s.id===profile?.site_id)?.name||currentSite().name)}</p></div></article>${!profile?`<form class="form-card section" id="profileForm"><h2>Activer mon espace</h2><div class="form-grid section"><label>Nom affiché<input id="profileName" required></label><label>Site de rattachement<select id="profileSite">${SITES.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label></div><div class="form-actions"><button class="btn">Activer</button></div></form>`:""}<button class="btn secondary section" id="logout">Déconnexion</button>`:`<form class="form-card" id="loginForm"><h2>Connexion Supabase</h2><p class="hint">La V5 reste utilisable localement sans connexion.</p><div class="form-grid section"><label>E-mail<input id="email" type="email" required></label><label>Mot de passe<input id="password" type="password" minlength="6" required></label></div><div class="form-actions"><button class="btn">Connexion</button><button type="button" class="btn secondary" id="signup">Créer l'accès</button></div></form>`}
    <div class="grid three-col section"><article class="card"><div class="metric-label">Version des données</div><div class="metric-value">V5</div><p class="hint">Dernière sauvegarde ${isoDate(data.meta?.updated_at)}</p></article><article class="card"><div class="metric-label">Stockage local</div><div class="metric-value">${localSize} Ko</div><p class="hint">Disponible hors connexion</p></article><article class="card"><div class="metric-label">Éléments métier</div><div class="metric-value">${["actions","gembas","audits","projects","practices","measurements"].reduce((s,k)=>s+(data[k]?.length||0),0)}</div><p class="hint">Tous sites confondus</p></article></div>
    <div class="card section"><h2>Sauvegarde et reprise</h2><p class="hint">Exportez les données avant une opération importante ou un changement d'appareil.</p><div class="form-actions"><button class="btn ghost" id="exportData">Exporter en JSON</button><label class="btn secondary">Importer<input id="importData" type="file" accept="application/json" hidden></label><button class="btn secondary" id="newWorkspace">Créer un espace vide</button><button class="btn danger" id="resetDemo">Réinitialiser la démonstration</button></div></div>`;
}

function render(){
  $("siteSelect").innerHTML=SITES.map(site=>`<option value="${site.id}" ${site.id===siteId?"selected":""}>${esc(site.name)}</option>`).join("");
  renderNav();renderHome();renderControl();renderKpi();renderActions();renderGemba();renderAudits();renderImprove();renderPractices();renderToolkit();renderAccount();
  if(!CLOUD_ENABLED){const login=$("loginForm");if(login)login.outerHTML=`<div class="card"><h2>Espace local</h2><p class="hint">Les données restent sur ce navigateur. Exportez-les pour les conserver ou changer d’appareil. La connexion multisite sera activée après validation de la base et des droits d’accès.</p></div>`;}
  $("dataMode").textContent=data.meta?.demo===false?"Espace de travail local · données sur cet appareil":"Démonstration · chiffres fictifs et saisies de test";
  document.querySelectorAll(".view").forEach(view=>view.classList.toggle("active",view.id===`${active}View`));
  bind();updateSyncLabel();
}

function modal(title,body){$("modalContent").innerHTML=`<div class="modal-head"><h2 id="modalTitle">${title}</h2><button class="modal-close" data-close-modal aria-label="Fermer">×</button></div>${body}`;$("modal").hidden=false;document.querySelector("[data-close-modal]").onclick=closeModal}
function closeModal(){$("modal").hidden=true;$("modalContent").innerHTML=""}
function actionForm(action={}){modal(action.id?"Modifier l'action":"Nouvelle action",`<form id="actionForm"><div class="form-grid"><label class="wide">Action<input id="actionTitle" required value="${esc(action.title||"")}"></label><label>Responsable<input id="actionOwner" required value="${esc(action.owner||"")}"></label><label>Priorité<select id="actionPriority">${["Haute","Moyenne","Basse"].map(x=>`<option ${x===(action.priority||"Moyenne")?"selected":""}>${x}</option>`).join("")}</select></label><label>Statut<select id="actionStatus">${["Ouverte","En cours","Bloquée","Clôturée"].map(x=>`<option ${x===(action.status||"Ouverte")?"selected":""}>${x}</option>`).join("")}</select></label><label>Échéance<input id="actionDue" type="date" value="${action.due_date||""}"></label><label>Origine<select id="actionOrigin">${["Manuel","Gemba","Audit","KPI","Bibliothèque"].map(x=>`<option ${x===(action.origin_type||"Manuel")?"selected":""}>${x}</option>`).join("")}</select></label><label class="wide">Contexte<textarea id="actionDesc" rows="3">${esc(action.description||"")}</textarea></label></div><div class="form-actions"><button class="btn">Enregistrer</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("actionForm").onsubmit=event=>saveAction(event,action.id)}

async function write(table,payload,ownerField="created_by"){
  if(!CLOUD_ENABLED||!db||!session)return null;
  const remote={...payload};
  if(!isUuid(remote.id))delete remote.id;
  if(ownerField)remote[ownerField]??=session.user.id;
  const {data:result,error}=await db.from(table).insert(remote).select().single();
  if(error){toast(`Sauvegarde locale · ${error.message}`);return null}return result;
}
async function saveAction(event,id){event.preventDefault();const existing=data.actions.find(x=>x.id===id);const payload={site_id:siteId,title:$("actionTitle").value.trim(),owner:$("actionOwner").value.trim(),priority:$("actionPriority").value,status:$("actionStatus").value,due_date:$("actionDue").value||null,origin_type:$("actionOrigin").value,description:$("actionDesc").value.trim(),updated_at:new Date().toISOString()};if(existing){Object.assign(existing,payload);if(db&&session&&isUuid(id))await db.from("actions").update(payload).eq("id",id)}else{const item={id:uid("action"),...payload,created_at:new Date().toISOString()};data.actions.unshift(item);const saved=await write("actions",payload);if(saved)Object.assign(item,saved)}saveLocal();closeModal();render();toast(existing?"Action mise à jour.":"Action créée.")}
async function advanceAction(id){const action=data.actions.find(x=>x.id===id);if(!action)return;action.status={"Ouverte":"En cours","En cours":"Clôturée","Bloquée":"En cours","Clôturée":"Clôturée"}[action.status]||"En cours";saveLocal();if(db&&session&&isUuid(id))await db.from("actions").update({status:action.status,updated_at:new Date().toISOString()}).eq("id",id);render();toast(`Action passée à « ${action.status} ».`)}

function auditForm(){modal("Audit Excellence",`<form id="auditForm"><div class="form-grid"><label>Date<input id="auditDate" type="date" value="${today()}" required></label><label>Périmètre<input id="auditPerimeter" placeholder="Atelier ou processus" required></label><label>Responsable<input id="auditOwner" placeholder="Nom ou fonction"></label><label>Auditeur<input id="auditAuditor" placeholder="Nom"></label></div><div class="maturity-legend section">0 Inexistant · 1 Très faible · 2 Insuffisant · 3 Acceptable · 4 Maîtrisé · 5 Excellence</div><div class="section">${AUDIT_DOMAINS.map((domain,index)=>`<label class="audit-domain"><span>${index+1}. ${domain}</span><select data-audit-score aria-label="Score ${esc(domain)}" required><option value="">À noter</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select><input class="audit-proof" data-audit-proof required placeholder="Preuve ou observation factuelle" aria-label="Preuve ${esc(domain)}"></label>`).join("")}</div><label class="field section">Synthèse<input id="auditSummary" placeholder="Forces, risques et priorité"></label><div class="form-actions"><button class="btn">Enregistrer et créer les actions</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("auditForm").onsubmit=saveAudit}
async function saveAudit(event){event.preventDefault();const scores=[...document.querySelectorAll("[data-audit-score]")].map(x=>Number(x.value)),total=scores.reduce((s,x)=>s+x,0);const item={id:uid("audit"),site_id:siteId,status:"Terminé",score:total,notes:`Audit Excellence — ${$("auditPerimeter").value}`,performed_at:$("auditDate").value,audit_data:{scores,proofs:[...document.querySelectorAll("[data-audit-proof]")].map(x=>x.value.trim()),summary:$("auditSummary").value,owner:$("auditOwner").value,auditor:$("auditAuditor").value}};data.audits.unshift(item);const generated=[];scores.forEach((score,index)=>{if(score<2){const action={id:uid("action"),site_id:siteId,title:`Audit · Renforcer ${AUDIT_DOMAINS[index]}`,owner:$("auditOwner").value||"À attribuer",priority:"Haute",status:"Ouverte",due_date:null,origin_type:"Audit",description:$("auditSummary").value};data.actions.unshift(action);generated.push(action)}});saveLocal();await write("audits",{site_id:item.site_id,status:item.status.toLowerCase(),score:item.score,notes:item.notes,performed_at:item.performed_at,audit_data:item.audit_data},"auditor_id");for(const action of generated){const saved=await write("actions",action);if(saved)Object.assign(action,saved)}saveLocal();closeModal();render();toast("Audit enregistré et plan d'actions généré.")}

function projectForm(){modal("Nouveau chantier",`<form id="projectForm"><div class="form-grid"><label class="wide">Titre<input id="projectTitle" required></label><label>Méthode<select id="projectMethod"><option>A3</option><option>PDCA</option><option>DMAIC</option><option>SMED</option><option>VSM</option><option>Kaizen</option></select></label><label>Responsable<input id="projectOwner" required></label><label>Gain attendu<input id="projectGain" type="number" min="0"></label><label>Unité<input id="projectUnit" value="%"></label><label>Date cible<input id="projectDate" type="date"></label><label class="wide">Objectif mesurable<textarea id="projectObjective" rows="3" required></textarea></label></div><div class="form-actions"><button class="btn">Créer le chantier</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("projectForm").onsubmit=saveProject}
async function saveProject(event){event.preventDefault();const item={id:uid("project"),site_id:siteId,title:$("projectTitle").value,method:$("projectMethod").value,status:"Cadrage",owner:$("projectOwner").value,objective:$("projectObjective").value,expected_gain:Number($("projectGain").value)||null,gain_unit:$("projectUnit").value,progress:10,target_date:$("projectDate").value||null};data.projects.unshift(item);saveLocal();await write("improvement_projects",item);closeModal();render();toast("Chantier créé.")}

function practiceForm(){modal("Partager une bonne pratique",`<form id="practiceForm"><div class="form-grid"><label class="wide">Titre<input id="practiceTitle" required></label><label>Catégorie<select id="practiceCategory"><option>Sécurité</option><option>Qualité</option><option>Performance</option><option>Flux</option><option>Maintenance</option></select></label><label>Gain vérifié<input id="practiceGain" placeholder="Ex. −18 % de micro-arrêts"></label><label class="wide">Standard et conditions de réussite<textarea id="practiceSummary" rows="4" required></textarea></label></div><div class="form-actions"><button class="btn">Soumettre</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("practiceForm").onsubmit=savePractice}
async function savePractice(event){event.preventDefault();const item={id:uid("practice"),site_id:siteId,title:$("practiceTitle").value,category:$("practiceCategory").value,summary:$("practiceSummary").value,expected_gain:$("practiceGain").value,status:"À valider"};data.practices.unshift(item);saveLocal();await write("best_practices",item);closeModal();render();toast("Bonne pratique envoyée à validation.")}

function bind(){
  document.querySelectorAll("[data-nav]").forEach(button=>button.onclick=()=>switchView(button.dataset.nav));
  document.querySelectorAll("[data-hide]").forEach(button=>button.onclick=()=>$(button.dataset.hide).hidden=true);
  document.querySelectorAll("[data-advance]").forEach(button=>button.onclick=()=>advanceAction(button.dataset.advance));
  document.querySelectorAll("[data-edit-action]").forEach(button=>button.onclick=()=>actionForm(data.actions.find(a=>a.id===button.dataset.editAction)));
  document.querySelectorAll("[data-action-filter]").forEach(button=>button.onclick=()=>{document.querySelectorAll("[data-action-filter]").forEach(x=>x.classList.toggle("active",x===button));const mode=button.dataset.actionFilter;document.querySelectorAll("#actionBoard .row").forEach(row=>{const id=row.querySelector("[data-advance]")?.dataset.advance,action=data.actions.find(x=>x.id===id);row.hidden=mode==="late"?!isOverdue(action):mode==="high"?action?.priority!=="Haute":false})});
  $("newAction")?.addEventListener("click",()=>actionForm());
  $("showKpiForm")?.addEventListener("click",()=>$("kpiForm").hidden=false);
  $("kpiForm")?.addEventListener("submit",async event=>{event.preventDefault();const item={id:uid("kpi"),site_id:siteId,period:$("kpiPeriod").value,trs:Number($("kpiTrs").value),rebuts:Number($("kpiRebuts").value),otif:Number($("kpiOtif").value),maturity:Number($("kpiMaturity").value),comment:$("kpiComment").value};data.measurements=data.measurements.filter(x=>!(x.site_id===item.site_id&&x.period===item.period));data.measurements.push(item);saveLocal();await write("kpi_measurements",item);render();toast("Mesure enregistrée.")});
  $("gembaForm")?.addEventListener("submit",async event=>{event.preventDefault();let actionId=null;if($("gCreateAction").checked){const action={id:uid("action"),site_id:siteId,title:`Gemba · ${$("gFinding").value.slice(0,80)}`,owner:$("gOwner").value||"À attribuer",priority:$("gPriority").value,status:"Ouverte",due_date:null,origin_type:"Gemba",description:$("gFinding").value};data.actions.unshift(action);actionId=action.id;const savedAction=await write("actions",action);if(savedAction){Object.assign(action,savedAction);actionId=savedAction.id}}const item={id:uid("gemba"),site_id:siteId,workshop:$("gWorkshop").value,finding:$("gFinding").value,category:$("gCategory").value,priority:$("gPriority").value,observed_at:new Date().toISOString(),action_id:actionId};data.gembas.unshift(item);saveLocal();const saved=await write("gembas",item);if(saved)Object.assign(item,saved);saveLocal();render();toast(actionId?"Gemba enregistré et action créée.":"Gemba enregistré.")});
  $("newAudit")?.addEventListener("click",auditForm);$("newProject")?.addEventListener("click",projectForm);$("newPractice")?.addEventListener("click",practiceForm);
  document.querySelectorAll("[data-progress-project]").forEach(button=>button.onclick=()=>editProjectProgress(button.dataset.progressProject));
  document.querySelectorAll("[data-deploy-practice]").forEach(button=>button.onclick=()=>{const p=data.practices.find(x=>x.id===button.dataset.deployPractice);data.projects.unshift({id:uid("project"),site_id:siteId,title:`Déployer · ${p.title}`,method:"PDCA",status:"Cadrage",owner:"À attribuer",objective:`Tester la pratique de ${SITES.find(s=>s.id===p.site_id)?.name||"l'autre site"} dans le contexte local.`,expected_gain:null,gain_unit:"",progress:5,target_date:null});saveLocal();render();toast("Test de déploiement ajouté aux chantiers.")});
  $("loginForm")?.addEventListener("submit",signIn);$("signup")?.addEventListener("click",signUp);$("profileForm")?.addEventListener("submit",createProfile);$("logout")?.addEventListener("click",()=>db?.auth.signOut());
  $("exportData")?.addEventListener("click",exportData);$("importData")?.addEventListener("change",importData);$("resetDemo")?.addEventListener("click",()=>{if(confirm("Réinitialiser toutes les données locales de démonstration ?")){data=clone(DEMO);saveLocal();render();toast("Démonstration réinitialisée.")}});
  $("newWorkspace")?.addEventListener("click",()=>{exportData();data={actions:[],gembas:[],audits:[],projects:[],practices:[],measurements:[],toolkitRuns:[],knowledgeSources:[],meta:{version:5,demo:false}};saveLocal();render();toast("Espace vide créé. Une sauvegarde de l’ancien espace a été exportée.");});
  bindToolkit();
}

function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`bia-os-v5-${today()}.json`;link.click();URL.revokeObjectURL(url);toast("Sauvegarde exportée.")}
function importData(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const imported=JSON.parse(reader.result);validateImport(imported);data=imported;saveLocal();render();toast("Données importées.")}catch(error){toast(`Import impossible : ${error.message}`)}};reader.readAsText(file)}
async function signIn(event){event.preventDefault();if(!db)return toast("Connexion cloud indisponible.");const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)toast(error.message)}
async function signUp(){if(!db)return toast("Connexion cloud indisponible.");const email=$("email").value,password=$("password").value;if(!email||password.length<6)return toast("Renseignez un e-mail et un mot de passe de 6 caractères minimum.");const {error}=await db.auth.signUp({email,password});toast(error?error.message:"Compte créé. Vérifiez votre e-mail.")}
async function createProfile(event){event.preventDefault();if(!db||!session)return;const payload={user_id:session.user.id,display_name:$("profileName").value.trim(),site_id:$("profileSite").value,role:"member"};const {data:created,error}=await db.from("profiles").insert(payload).select().single();if(error)return toast(error.message);profile=created;siteId=created.site_id;localStorage.setItem("biaV5Site",siteId);render();toast("Espace activé.")}
async function loadRemote(){if(!db||!session)return;const maps=[["actions","actions"],["gembas","gembas"],["audits","audits"],["improvement_projects","projects"],["best_practices","practices"],["kpi_measurements","measurements"],["toolkit_runs","toolkitRuns"],["knowledge_sources","knowledgeSources"]];for(const [table,key] of maps){const {data:rows,error}=await db.from(table).select("*");if(!error&&rows?.length)data[key]=rows}saveLocal();render()}
async function initCloud(){
  if(!CLOUD_ENABLED||!window.BIA_SUPABASE?.url||!window.BIA_SUPABASE?.anonKey||!window.supabase){updateSyncLabel();return}
  db=window.supabase.createClient(window.BIA_SUPABASE.url,window.BIA_SUPABASE.anonKey);
  db.auth.onAuthStateChange(async(_,next)=>{session=next;if(session){const {data:found}=await db.from("profiles").select("*").eq("user_id",session.user.id).maybeSingle();profile=found||null;await loadRemote()}else{profile=null;render()}updateSyncLabel()});
  const {data:auth}=await db.auth.getSession();session=auth.session;if(session)await loadRemote();else render();
}

$("siteSelect").onchange=event=>{siteId=event.target.value;localStorage.setItem("biaV5Site",siteId);render()};
$("refreshBtn").onclick=async()=>{if(session)await loadRemote();else render();toast(session?"Données synchronisées.":"Vue actualisée depuis la sauvegarde locale.")};
$("modal").onclick=event=>{if(event.target===$("modal"))closeModal()};
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("modal").hidden)closeModal()});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
if(!SITES.some(s=>s.id===siteId))siteId=SITES[0].id;
if(!NAV.some(n=>n[0]===active))active="home";
render();initCloud();

function validateImport(value){
 if(value?.meta?.version!==5)throw new Error("Version incompatible");
 const keys=["actions","gembas","audits","projects","practices","measurements","toolkitRuns","knowledgeSources"];
 for(const key of keys){if(!Array.isArray(value[key]))throw new Error("Collection manquante : "+key);const ids=new Set();for(const row of value[key]){if(!row||typeof row!=="object"||typeof row.id!=="string"||!/^[a-zA-Z0-9_-]+$/.test(row.id)||ids.has(row.id))throw new Error("Identifiant invalide : "+key);ids.add(row.id);if(row.site_id&&!SITES.some(s=>s.id===row.site_id))throw new Error("Site inconnu");}}
 for(const row of value.actions)if(typeof row.title!=="string"||!["Ouverte","En cours","Bloquée","Clôturée"].includes(row.status)||!["Haute","Moyenne","Basse"].includes(row.priority))throw new Error("Action invalide");
 for(const row of value.measurements)for(const key of Object.keys(KPI_DEFS)){const n=row[key];if(typeof n!=="number"||!Number.isFinite(n)||n<0||n>(key==="maturity"?5:100))throw new Error("Mesure invalide");}
 return true;
}

function editProjectProgress(id){
 const project=data.projects.find(p=>p.id===id);
 modal("Suivi du chantier",`<form id="progressForm"><div class="form-grid"><label>Avancement réel (%)<input id="progressValue" type="number" min="0" max="100" required value="${project.progress||0}"></label><label>Statut<select id="progressStatus">${["Cadrage","En cours","Bloqué","Terminé"].map(x=>`<option ${x===project.status?"selected":""}>${x}</option>`).join("")}</select></label><label class="wide">Résultat ou preuve de progression<textarea id="progressEvidence" required>${esc(project.evidence||"")}</textarea></label></div><div class="form-actions"><button class="btn">Enregistrer le suivi</button></div></form>`);
 $("progressForm").onsubmit=e=>{e.preventDefault();const progress=Number($("progressValue").value),status=$("progressStatus").value;if(status==="Terminé"&&progress!==100)return toast("Un chantier terminé doit être à 100 %.");Object.assign(project,{progress,status,evidence:$("progressEvidence").value.trim()});saveLocal();closeModal();render();toast("Suivi du chantier enregistré.");};
}
