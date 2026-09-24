"use strict";

function renderTerrain() {
  const stats=signalStats(),tabs=`<div class="tabs"><button class="tab ${state.terrainTab==="signals"?"active":""}" data-terrain-tab="signals">Signaux</button><button class="tab ${state.terrainTab==="gemba"?"active":""}" data-terrain-tab="gemba">Gemba</button><button class="tab ${state.terrainTab==="stats"?"active":""}" data-terrain-tab="stats">Statistiques</button><button class="tab" data-nav="audits">Audit Terrain · 50 critères</button></div>`;
  if(state.terrainTab==="gemba")return `${pageHead("Terrain","Gemba","Observer, comprendre avec l’équipe, décider et revenir vérifier.",'<button class="btn" data-new-gemba>＋ Nouveau Gemba</button>')}${tabs}${renderGembaList()}`;
  if(state.terrainTab==="stats")return `${pageHead("Terrain","Statistiques des signaux","Délais calculés uniquement sur les événements réellement horodatés.")}${tabs}${renderSignalStats(stats)}`;
  let rows=scoped(data.signals).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  rows=rows.filter(s=>state.signalFilter==="all"||state.signalFilter==="open"&&isOpenSignal(s)||state.signalFilter==="critical"&&s.severity==="Critique"&&isOpenSignal(s)||state.signalFilter==="new"&&s.state==="Nouveau"||state.signalFilter==="closed"&&s.state==="Clos");
  return `${pageHead("Terrain","Signal Terrain","Un fait, une prise en charge, une réponse vérifiée.",'<button class="btn" data-new-signal>＋ NOUVEAU SIGNAL TERRAIN</button>')}${tabs}<div class="filters">${[["open",`Ouverts · ${stats.open}`],["new",`Nouveaux · ${stats.new}`],["critical",`Critiques · ${stats.critical}`],["closed","Clos"],["all","Tous"]].map(([key,label])=>`<button class="chip ${key===state.signalFilter?"active":""}" data-signal-filter="${key}">${label}</button>`).join("")}</div>${listSearch("Rechercher un signal")}<div class="list section">${rows.map(signalCard).join("")||empty("Aucun signal pour ce filtre sur le site sélectionné.")}</div>`;
}
function elapsedMedian(rows,endKey,startKey="created_at") {
  const valid=rows.filter(s=>s[startKey]&&s[endKey]).map(s=>(Date.parse(s[endKey])-Date.parse(s[startKey]))/3600000).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
  const mid=Math.floor(valid.length/2);return {count:valid.length,hours:valid.length?(valid.length%2?valid[mid]:(valid[mid-1]+valid[mid])/2):null};
}
function renderSignalStats(stats) {
  const rows=scoped(data.signals),taken=elapsedMedian(rows,"taken_at"),resolved=elapsedMedian(rows,"resolved_at"),byMonth={};
  rows.forEach(s=>{if(s.created_at){const month=s.created_at.slice(0,7);byMonth[month]=(byMonth[month]||0)+1;}});
  return `<div class="grid cols-4">${[["Signaux ouverts",stats.open],["Nouveaux",stats.new],["Prise en charge médiane",taken.hours===null?"—":`${taken.hours.toFixed(1)} h`],["Résolution médiane",resolved.hours===null?"—":`${resolved.hours.toFixed(1)} h`]].map(([title,value])=>`<article class="card"><div class="metric-label">${title}</div><div class="metric-value">${value}</div></article>`).join("")}</div><p class="hint">Prise en charge : ${taken.count}/${rows.length} signaux horodatés · Résolution : ${resolved.count}/${rows.length}. Les anciens signaux sans historique ne sont pas inclus dans les délais.</p><div class="grid cols-2 section"><section class="panel"><h2>Par catégorie</h2>${SIGNAL_TYPES.map(type=>{const count=rows.filter(s=>s.type===type).length;return `<p><b>${esc(type)}</b> · ${count}</p><div class="progress"><span style="width:${rows.length?100*count/rows.length:0}%"></span></div>`;}).join("")}</section><section class="panel"><h2>Remontées par mois</h2>${Object.entries(byMonth).sort().map(([month,count])=>`<div class="row"><b>${month}</b><span>${count} signal(s)</span></div>`).join("")||empty("Aucun signal daté.")}<p class="hint">Une hausse des remontées peut traduire une meilleure expression du terrain.</p></section></div>`;
}
function measureFor(axis) {return scoped(data.measures,{groupAllowed:false}).filter(m=>m.axis===axis).sort((a,b)=>String(b.period).localeCompare(String(a.period)))[0];}
function topSubjects() {
  if(state.site==="group")return [];
  const topics=scoped(data.topics).filter(t=>t.status!=="Clos").map(t=>({id:t.id,category:AXES[t.axis]?.label||"Sujet",title:t.title,next:t.owner,due:shortDate(t.due_date),priority:t.priority}));
  const covered=new Set(scoped(data.topics).filter(t=>t.status!=="Clos").map(t=>t.linked_id).filter(Boolean));
  const signals=scoped(data.signals).filter(s=>isOpenSignal(s)&&s.state!=="Vérifié"&&!covered.has(s.id)).map(s=>({id:s.id,category:s.type,title:s.description,next:signalNextLabel(s),due:"Aujourd’hui",priority:s.severity}));
  const actions=scoped(data.actions).filter(a=>isOpenAction(a)&&!covered.has(a.id)&&(isLate(a)||a.status==="À vérifier"||["Critique","Haute"].includes(a.priority))).map(a=>({id:a.id,category:"Action",title:a.title,next:a.owner,due:shortDate(a.due_date),priority:a.priority}));
  const decisions=scoped(data.decisions).filter(d=>d.status!=="Clos").map(d=>({id:d.id,category:"Décision",title:d.title,next:d.owner,due:shortDate(d.due_date),priority:"Haute"}));
  return [...topics,...signals,...actions,...decisions].sort((a,b)=>({Critique:0,Haute:1,Normale:2}[a.priority]??3)-({Critique:0,Haute:1,Normale:2}[b.priority]??3));
}
function renderSqcdp() {
  if(state.site==="group")return renderGroupSqcdp();
  const subjects=topSubjects();
  return `${pageHead("Point quotidien",`SQCDP · ${site().name}`,`${workshop()?.name||"Atelier à préciser"} · ${shortDate(today())}`,'<div class="row-actions"><button class="btn secondary" data-display-mode>'+ (state.presentation?"Quitter l’écran atelier":"Écran atelier")+'</button><button class="btn" data-new-signal>＋ SIGNAL TERRAIN</button></div>')}<div class="sqcdp-grid section">${Object.entries(AXES).map(([axis,def])=>{const m=measureFor(axis),s=measureStatus(m);return `<article class="sqcdp-card" style="--axis:${def.color}"><h3><span class="axis-letter">${axis}</span>${esc(def.label)}</h3><div class="metric-label">${esc(m?.label||"Indicateur à définir")}</div><div class="sqcdp-value">${m?.value??"—"} <small>${esc(m?.unit||"")}</small></div><p>Cible : ${m?.target??"—"} ${esc(m?.unit||"")}</p>${pill(s.text,s.tone)}<p class="source-label">${esc(m?.source||"Source à connecter")} · ${shortDate(m?.period)}</p>${m?.value!=null?`<button class="btn secondary small" data-topic-axis="${axis}" data-topic-title="${esc(`Écart ${m.label} : ${m.value} ${m.unit} / cible ${m.target??"à définir"}`)}">Traiter un écart</button>`:""}</article>`;}).join("")}</div><section class="section"><div class="section-title"><div><h2>TOP 15 · À traiter aujourd’hui</h2><p class="hint">${subjects.length} sujet(s) · le TOP 15 désigne le rituel, pas un nombre de lignes.</p></div><div class="row-actions"><span class="timer" id="meetingTimer">${timerLabel()}</span><button class="btn secondary" data-timer>${state.timerStarted?"Arrêter":"Démarrer"} le point</button><button class="btn" data-new-topic>＋ Ajouter un sujet</button></div></div><div class="list">${subjects.map((s,i)=>`<article class="row top15-row"><b>${i+1} · ${esc(s.category)}</b><div><h3>${esc(s.title)}</h3><span class="hint">${esc(s.id)}</span></div><span>${esc(s.next)}</span><span>${esc(s.due)}</span><div>${pill(s.priority,s.priority==="Critique"?"critical":"progress")}${recordLink(s.id,"Traiter")}</div></article>`).join("")||empty("Aucun sujet ouvert. Ajoutez un écart ou un engagement pour l’équipe.")}</div></section>`;
}
function timerLabel() {const s=state.timerStarted?Math.floor((Date.now()-state.timerStarted)/1000):0;return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function topicForm(existing=null,preset={}) {
  const siteId=existing?.site_id||(state.site==="group"?"marzin":state.site),available=[...data.signals,...data.problems,...data.actions].filter(r=>r.site_id===siteId);
  modal(existing?`${existing.id} · Sujet TOP 15`:"Ajouter un sujet au TOP 15",`<form id="topicForm"><div class="form-grid"><label class="wide">Que devons-nous traiter ?<input id="topicTitle" required value="${esc(existing?.title||preset.title||"")}"></label><label>Axe<select id="topicAxis">${Object.entries(AXES).map(([key,a])=>`<option value="${key}" ${key===(existing?.axis||preset.axis)?"selected":""}>${key} · ${esc(a.label)}</option>`).join("")}</select></label><label>Responsable<input id="topicOwner" required value="${esc(existing?.owner||"")}"></label><label>Échéance<input type="date" id="topicDate" required value="${existing?.due_date||today()}"></label><label>Priorité<select id="topicPriority">${["Normale","Haute","Critique"].map(p=>`<option ${p===existing?.priority?"selected":""}>${p}</option>`).join("")}</select></label><label class="wide">Dossier déjà existant<select id="topicLink"><option value="">Aucun dossier associé</option>${available.map(r=>`<option value="${r.id}" ${r.id===existing?.linked_id?"selected":""}>${esc(r.id)} · ${esc(r.title||r.description)}</option>`).join("")}</select></label><label>Statut<select id="topicStatus">${["Ouvert","En cours","Clos"].map(s=>`<option ${s===existing?.status?"selected":""}>${s}</option>`).join("")}</select></label><label class="wide">Décision / résultat<textarea id="topicDecision" rows="3">${esc(existing?.decision||"")}</textarea></label></div>${existing?`${relatedPanel(existing.id)}<div class="row-actions">${recordLink(existing.linked_id,"Dossier associé")}${recordLink(existing.escalation_id,"Escalade")}<button type="button" class="btn secondary" data-new-action data-origin-type="TOP 15" data-origin-id="${existing.id}">Créer une action</button>${!existing.escalation_id?`<button type="button" class="btn secondary" data-escalate-topic="${existing.id}">Demander une décision</button>`:""}</div>`:""}<div class="form-actions"><button class="btn">Enregistrer le sujet</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  $("topicForm").onsubmit=e=>{e.preventDefault();const row={...existing,id:existing?.id||nextId("TOP",data.topics),site_id:siteId,title:$("topicTitle").value.trim(),axis:$("topicAxis").value,owner:$("topicOwner").value.trim(),due_date:$("topicDate").value,priority:$("topicPriority").value,linked_id:$("topicLink").value||null,status:$("topicStatus").value,decision:$("topicDecision").value.trim(),created_at:existing?.created_at||now(),updated_at:now()};if(!allowedSite(siteId,true)||!row.title||!row.owner)return toast("Précisez le sujet et le responsable.");if(row.status==="Clos"&&(!row.decision||linkedActions(row.id).some(isOpenAction)))return toast("Un résultat et la clôture des actions liées sont nécessaires.");if(!commitData(()=>{const old=data.topics.find(t=>t.id===row.id);if(old)Object.assign(old,row);else data.topics.unshift(row);}))return;closeModal();receipt(row.id,"SQCDP → TOP 15",siteId,"Sujet ajouté au point quotidien");render();};
  document.querySelectorAll("[data-escalate-topic]").forEach(b=>b.onclick=()=>{if(requestCloseModal())decisionForm(null,{site_id:siteId,title:existing.title,origin_id:existing.id});});
}
function decisionForm(existing=null,origin={}) {
  const siteId=existing?.site_id||origin.site_id||(state.site==="group"?"group":state.site);if(!allowedSite(siteId))return;
  modal(existing?`${existing.id} · Décision / escalade`:"Demander une décision",`<form id="decisionForm"><div class="form-grid"><label class="wide">Quelle décision attendez-vous ?<input id="decisionTitle" required value="${esc(existing?.title||origin.title||"")}"></label><label>Décideur<input id="decisionOwner" required value="${esc(existing?.owner||"")}"></label><label>Pour quand ?<input id="decisionDate" type="date" required value="${existing?.due_date||today()}"></label><label class="wide">Faits, impact et options<textarea id="decisionDetail" rows="3">${esc(existing?.detail||"")}</textarea></label><label>Statut<select id="decisionStatus">${["Ouverte","En cours","Clos"].map(s=>`<option ${s===existing?.status?"selected":""}>${s}</option>`).join("")}</select></label><label class="wide">Décision prise<textarea id="decisionResult" rows="3">${esc(existing?.result||"")}</textarea></label></div>${recordLink(existing?.origin_id,"Sujet d’origine")}${existing?relatedPanel(existing.id):""}<div class="form-actions"><button class="btn">Enregistrer la décision</button><button class="btn secondary" type="button" data-close-modal>Annuler</button></div></form>`);
  $("decisionForm").onsubmit=e=>{e.preventDefault();const row={...existing,id:existing?.id||nextId("D",data.decisions),site_id:siteId,title:$("decisionTitle").value.trim(),owner:$("decisionOwner").value.trim(),due_date:$("decisionDate").value,detail:$("decisionDetail").value.trim(),status:$("decisionStatus").value,result:$("decisionResult").value.trim(),origin_id:existing?.origin_id||origin.origin_id||null,updated_at:now()};if(!row.title||!row.owner||row.status==="Clos"&&!row.result)return toast("Précisez la décision attendue, son responsable et le résultat pour clore.");if(!commitData(()=>{const d=data.decisions.find(x=>x.id===row.id);if(d)Object.assign(d,row);else data.decisions.unshift(row);const t=data.topics.find(x=>x.id===row.origin_id);if(t)t.escalation_id=row.id;recordHistory(d||row,row.status,row.result);} ))return;closeModal();receipt(row.id,"Décisions / TOP 15",siteId,row.status);render();};
}
function lineChart(series,title,unit="") {
  const points=(series?.values||[]).map((value,i)=>({value,label:series.labels?.[i]||""})),valid=points.map(p=>p.value).filter(Number.isFinite);
  if(!valid.length)return empty("Historique indisponible.");
  const all=Number.isFinite(series.target)?[...valid,series.target]:valid,w=720,h=230,p=38,min=Math.min(...all),max=Math.max(...all),margin=Math.max((max-min)*.2,1),lo=Math.max(0,min-margin),hi=max+margin,x=i=>p+i*(w-2*p)/Math.max(1,points.length-1),y=v=>h-p-(v-lo)*(h-2*p)/(hi-lo||1);let path="",started=false;
  points.forEach((point,i)=>{if(!Number.isFinite(point.value)){started=false;return;}path+=`${started?"L":"M"}${x(i)},${y(point.value)} `;started=true;});
  return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">${Number.isFinite(series.target)?`<line class="chart-target" x1="${p}" y1="${y(series.target)}" x2="${w-p}" y2="${y(series.target)}"/><text class="chart-value" x="${w-160}" y="${y(series.target)-8}">Cible ${series.target} ${esc(unit)}</text>`:""}<path class="chart-line" d="${path}" fill="none"/>${points.map((point,i)=>`${Number.isFinite(point.value)?`<circle class="chart-point" cx="${x(i)}" cy="${y(point.value)}" r="5"/><text class="chart-value" x="${x(i)-10}" y="${y(point.value)-10}">${point.value}</text>`:""}<text class="chart-label" x="${x(i)-12}" y="${h-8}">${esc(point.label)}</text>`).join("")}</svg>`;
}
function indicatorSeries(siteId,code) {
  const legacy=data.trends.find(t=>t.site_id===siteId&&t.code===code&&t.granularity==="daily"&&t.values?.some(Number.isFinite))||data.trends.find(t=>t.site_id===siteId&&t.code===code),series=legacy?clone(legacy):null;
  if(!series)return null;const n=state.period==="all"?series.values.length:Number(state.period);series.values=series.values.slice(-n);series.labels=series.labels.slice(-n);series.source=series.details?.[series.labels.at(-1)]?.source||series.source;series.target=series.details?.[series.labels.at(-1)]?.target??series.target;return series;
}
function pilotageChart(series,{title,code,unit="%",direction="high",contextLabel=site().name}) {
  const has=series?.values?.some(Number.isFinite);if(!has)return `<article class="panel indicator-chart unavailable"><div class="section-title"><h2>${esc(title)}</h2>${pill("Donnée indisponible")}</div><p>Source et définition à qualifier. Source SEQUOIA à vérifier.</p></article>`;
  const last=series.values.at(-1),prev=series.values.at(-2),delta=Number.isFinite(last)&&Number.isFinite(prev)?+(last-prev).toFixed(1):null,target=series.target,gap=Number.isFinite(last)&&Number.isFinite(target)?+(last-target).toFixed(1):null,good=gap===null?null:direction==="low"?gap<=0:gap>=0,siteId=state.site==="group"?state.pilotSite:state.site,linked=data.actions.filter(a=>a.site_id===siteId&&a.origin_type==="KPI"&&a.origin_id===code).length;
  return `<article class="panel indicator-chart"><div class="section-title"><div><h2>${esc(title)}</h2><div class="metric-value">${Number.isFinite(last)?last:"—"} <small>${esc(unit)}</small></div></div>${pill(good===null?"À qualifier":good?"Conforme":"Écart",good===null?"neutral":good?"done":"open")}</div><p class="hint">Cible ${Number.isFinite(target)?target:"—"} ${esc(unit)} · Écart ${gap===null?"—":`${gap>0?"+":""}${gap}`} ${unit==="%"?"pt":esc(unit)} · Tendance ${delta===null?"—":`${delta>0?"+":""}${delta}`}</p>${lineChart(series,`${title} · ${contextLabel}`,unit)}<p class="source-label">${esc(series.source||"Source à qualifier")} · dernière période ${esc(series.labels?.at(-1)||"inconnue")}</p><div class="row-actions">${state.role!=="dg"?`<button class="btn secondary small" data-kpi-action="${code}" data-kpi-label="${esc(title)}">Créer une action sur cet écart</button>`:""}<button class="btn ghost small" data-kpi-records="${code}">${linked} action(s) liée(s)</button></div></article>`;
}
const BENCHMARK_KPIS=[
  {code:"trs",label:"TRS",unit:"%"},
  {code:"scrap",label:"Rebut",unit:"%"},
  {code:"safety_signal",label:"Signaux sécurité",unit:""},
  {code:"service",label:"Service client",unit:"%"},
  {code:"staffing",label:"Personnel",unit:"%"}
];
const GROUP_SQCDP=[
  {axis:"S",code:"safety_signal",label:"Sécurité",unit:"",direction:"low"},
  {axis:"Q",code:"scrap",label:"Qualité · rebut",unit:"%",direction:"low"},
  {axis:"C",code:"trs",label:"Coûts · TRS",unit:"%",direction:"high"},
  {axis:"D",code:"service",label:"Délais · service",unit:"%",direction:"high"},
  {axis:"P",code:"staffing",label:"Personnel · couverture",unit:"%",direction:"high"}
];
function sqcdpGroupStatus(item,kpi){
  if(!item)return "missing";
  if(!Number.isFinite(item.target))return "qualify";
  const gap=kpi.direction==="low"?item.value>item.target:item.value<item.target;
  // Une définition absente ne permet pas de déclarer un site conforme.
  return gap?"gap":item.definition?"ok":"qualify";
}
function sqcdpPrevious(siteId,code,period){
  const kind=/^\d{4}-\d{2}-\d{2}$/.test(period)?"date":/^S\d+$/.test(period)?"week":"other";
  const sameKind=p=>kind==="date"?/^\d{4}-\d{2}-\d{2}$/.test(p):kind==="week"?/^S\d+$/.test(p):p===period;
  const periods=benchmarkPeriods().filter(sameKind),index=periods.indexOf(period);
  for(let i=index+1;index>=0&&i<periods.length;i++){
    const observation=benchmarkObservation(siteId,code,periods[i]);
    if(observation)return observation;
  }
  return null;
}
function sqcdpRelated(siteId,kpi){
  const topics=data.topics.filter(t=>t.site_id===siteId&&t.axis===kpi.axis&&t.status!=="Clos");
  const topicIds=new Set(topics.map(t=>t.id));
  const actions=data.actions.filter(a=>a.site_id===siteId&&isOpenAction(a)&&(a.origin_type==="KPI"&&a.origin_id===kpi.code||topicIds.has(a.origin_id)));
  const types={S:["Sécurité"],Q:["Qualité"],C:["Production","Maintenance"],D:["Flux"],P:[]};
  const signals=data.signals.filter(s=>s.site_id===siteId&&isOpenSignal(s)&&types[kpi.axis].includes(s.type));
  return {topics,actions,signals};
}
function renderGroupSqcdp(embedded=false){
  const periods=benchmarkPeriods(),period=periods.includes(state.benchmarkPeriod)?state.benchmarkPeriod:periods[0]||"";
  const cells=OPERATIONAL_SITES.flatMap(site=>GROUP_SQCDP.map(kpi=>sqcdpGroupStatus(benchmarkObservation(site.id,kpi.code,period),kpi)));
  const gaps=cells.filter(status=>status==="gap").length,missing=cells.filter(status=>status==="missing").length;
  const openEscalations=[
    ...data.decisions.filter(d=>d.status!=="Clos").map(d=>({id:d.id,site_id:d.site_id,title:d.title,kind:"Décision attendue"})),
    ...data.signals.filter(s=>s.severity==="Critique"&&isOpenSignal(s)).map(s=>({id:s.id,site_id:s.site_id,title:s.description,kind:"Signal critique"}))
  ].filter(r=>r.site_id==="group"||OPERATIONAL_SITES.some(s=>s.id===r.site_id));
  const escalations=openEscalations.slice(0,5);
  return `${embedded?"":pageHead("BIA Holding · pilotage multisite","SQCDP Groupe","Six sites industriels visibles sur une période commune. Cliquez sur une case pour voir la mesure et les dossiers liés.")}
    <section class="panel group-sqcdp section" aria-labelledby="groupSqcdpTitle">
      <div class="section-title"><div><h2 id="groupSqcdpTitle">SQCDP Groupe · six sites</h2><p class="hint">Revue Groupe hebdomadaire · cliquez sur une case pour accéder aux écarts et aux actions.</p></div><label class="sqcdp-period">Période commune<select id="sqcdpGroupPeriod">${periods.map(p=>`<option value="${esc(p)}" ${p===period?"selected":""}>${esc(p)}${/^S\d+$/.test(p)?" · année à qualifier":""}</option>`).join("")||'<option value="">Aucune mesure</option>'}</select></label></div>
      ${data.meta.demo?'<p class="alert">Données de démonstration fictives. Les valeurs affichées ne décrivent pas la situation réelle du Groupe.</p>':""}
      <div class="sqcdp-summary" role="status"><span><b>${gaps}</b> écart(s) mesuré(s)</span><span><b>${missing}</b> mesure(s) absente(s)</span><span><b>${openEscalations.length}</b> alerte(s) / décision(s) à voir</span></div>
      <div class="sqcdp-matrix" role="table" aria-label="SQCDP des six sites, période ${esc(period||"inconnue")}">
        <div class="sqcdp-row sqcdp-heading" role="row"><span role="columnheader">Site</span>${GROUP_SQCDP.map(k=>`<span role="columnheader" title="${esc(k.label)}">${k.axis}<small>${esc(k.label.split(" · ")[0])}</small></span>`).join("")}</div>
        ${OPERATIONAL_SITES.map(site=>`<div class="sqcdp-row" role="row"><strong role="rowheader">${esc(site.name)}</strong>${GROUP_SQCDP.map(k=>{
          const item=benchmarkObservation(site.id,k.code,period),status=sqcdpGroupStatus(item,k),previous=item?sqcdpPrevious(site.id,k.code,period):null;
          const delta=previous?+(item.value-previous.value).toFixed(1):null;
          const trend=delta===null?"":delta===0?"→":delta>0?"↑":"↓";
          const label=status==="missing"?"À renseigner":status==="qualify"?"À qualifier":status==="gap"?"Écart":"Conforme";
          return `<button role="cell" class="sqcdp-cell ${status}" data-sqcdp-site="${site.id}" data-sqcdp-axis="${k.axis}" aria-label="${esc(site.name)} · ${esc(k.label)} : ${item?`${item.value} ${k.unit}`:"aucune donnée"}, ${label}">
            <b>${item?`${item.value}<small>${esc(k.unit)}</small>`:"—"}</b><span>${esc(label)}</span>${trend?`<i aria-label="Évolution ${delta>0?"hausse":"baisse"} de ${Math.abs(delta)}">${trend}</i>`:""}
          </button>`;
        }).join("")}</div>`).join("")}
      </div>
      <p class="hint sqcdp-legend">S Sécurité · Q Qualité · C Coûts / TRS · D Délais · P Personnel. Gris : absent · ambre : cible ou définition à qualifier · rouge : écart · vert : cible atteinte avec définition renseignée. La flèche indique l'évolution de la valeur, sans jugement sur son sens.</p>
      <p class="hint">Chaque valeur reste locale et datée. Aucun score ni moyenne Groupe ne masque les écarts des sites. Les périodes « S… » n'indiquent pas l'année et doivent être qualifiées avant comparaison.</p>
    </section>
    <section class="section panel"><div class="section-title"><div><h2>Décisions et alertes à traiter</h2><p class="hint">Dossiers ouverts, toutes périodes confondues. L'affichage est limité à cinq entrées.</p></div></div>
      <div class="list">${escalations.map(e=>`<article class="row"><div><b>${esc(e.kind)} · ${esc(getSiteName(e.site_id))}</b><p class="hint">${esc(e.title)}</p></div>${recordLink(e.id,"Ouvrir")}</article>`).join("")||empty("Aucune décision ouverte ni alerte critique.")}</div>
    </section>`;
}
function openGroupSqcdpCell(siteId,axis){
  const kpi=GROUP_SQCDP.find(k=>k.axis===axis),site=OPERATIONAL_SITES.find(s=>s.id===siteId);
  if(!kpi||!site)return;
  const periods=benchmarkPeriods(),period=periods.includes(state.benchmarkPeriod)?state.benchmarkPeriod:periods[0]||"";
  const item=benchmarkObservation(siteId,kpi.code,period),previous=item?sqcdpPrevious(siteId,kpi.code,period):null,related=sqcdpRelated(siteId,kpi);
  const status=sqcdpGroupStatus(item,kpi),statusLabel={missing:"Mesure absente",qualify:"À qualifier",gap:"Écart à traiter",ok:"Cible atteinte"}[status];
  modal(`${site.name} · ${kpi.label}`,`<div class="sqcdp-detail">
    <p>${pill(statusLabel,status==="gap"?"open":status==="ok"?"done":"neutral")} · période ${esc(period||"non renseignée")}</p>
    <div class="grid cols-2"><div class="card"><span class="metric-label">Valeur</span><div class="metric-value">${item?`${item.value} ${esc(kpi.unit)}`:"—"}</div></div><div class="card"><span class="metric-label">Cible locale</span><div class="metric-value">${Number.isFinite(item?.target)?`${item.target} ${esc(kpi.unit)}`:"—"}</div></div></div>
    <p>Mesure précédente comparable : ${previous?`${previous.value} ${esc(kpi.unit)}`:"indisponible"} · Source : ${esc(item?.source||"non renseignée")} · Définition : ${esc(item?.definition||"à qualifier")} · Saisie : ${item?.updated_at?shortDate(item.updated_at):"date inconnue"}</p>
    <h3>Sujets SQCDP (${related.topics.length})</h3>${related.topics.map(t=>`<div class="row"><span>${esc(t.title)} · ${esc(t.owner||"sans responsable")}</span>${recordLink(t.id)}</div>`).join("")||empty("Aucun sujet lié à cet axe.")}
    <h3>Signaux terrain (${related.signals.length})</h3>${related.signals.map(s=>`<div class="row"><span>${esc(s.description)}</span>${recordLink(s.id)}</div>`).join("")||empty("Aucun signal ouvert sur cet axe.")}
    <h3>Actions liées (${related.actions.length})</h3>${related.actions.map(a=>`<div class="row"><span>${esc(a.title)} · ${esc(a.owner||"sans responsable")} · ${shortDate(a.due_date)}</span>${recordLink(a.id)}</div>`).join("")||empty("Aucune action liée à cet indicateur ou aux sujets de cet axe.")}
    <div class="form-actions"><button type="button" class="btn secondary" id="sqcdpViewSite">Voir les courbes du site</button>${state.role==="lean"?'<button type="button" class="btn secondary" id="sqcdpAddMeasure">Saisir un relevé</button><button type="button" class="btn" id="sqcdpAddAction">Créer une action liée</button>':""}</div>
  </div>`);
  $("sqcdpViewSite").onclick=()=>{closeModal();state.pilotSite=siteId;state.view="pilotage";state.benchmarkMetric=kpi.code;render();};
  if(state.role==="lean"){
    $("sqcdpAddMeasure").onclick=()=>{closeModal();benchmarkForm({siteId,code:kpi.code});};
    $("sqcdpAddAction").onclick=()=>{closeModal();actionForm(null,{site_id:siteId,origin_type:"KPI",origin_id:kpi.code,title:`Analyser l'écart ${kpi.label} · ${site.name}`});};
  }
}
function benchmarkPeriods(){
  const periods=new Set();
  for(const m of data.measures)if(m.period&&Number.isFinite(m.value))periods.add(m.period);
  for(const t of data.trends)for(let i=0;i<(t.labels||[]).length;i++)if(Number.isFinite(t.values?.[i]))periods.add(t.labels[i]);
  return [...periods].sort((a,b)=>{
    const iso=value=>/^\d{4}-\d{2}-\d{2}$/.test(value);
    if(iso(a)!==iso(b))return iso(a)?-1:1;
    const week=value=>/^S\d+$/.test(value)?Number(value.slice(1)):-1;
    return iso(a)?b.localeCompare(a):week(b)-week(a)||b.localeCompare(a);
  });
}
function benchmarkObservation(siteId,code,period){
  const measure=data.measures.filter(m=>m.site_id===siteId&&m.code===code&&m.period===period&&Number.isFinite(m.value)).sort((a,b)=>String(b.synced_at||"").localeCompare(String(a.synced_at||"")))[0];
  if(measure)return {value:measure.value,target:measure.target,source:measure.source||"Source à qualifier",definition:measure.definition||"",updated_at:measure.synced_at};
  const trend=data.trends.find(t=>t.site_id===siteId&&t.code===code&&t.labels?.includes(period)),index=trend?.labels?.lastIndexOf(period)??-1;
  if(index<0||!Number.isFinite(trend.values?.[index]))return null;
  const detail=trend.details?.[period]||{};
  return {value:trend.values[index],target:detail.target??trend.target,source:detail.source||trend.source||"Source à qualifier",definition:detail.definition||"",updated_at:detail.updated_at};
}
function benchmarkSiteCard(site,kpi,period){
  const item=benchmarkObservation(site.id,kpi.code,period);
  const open=`<button class="benchmark-open" data-benchmark-site="${site.id}" aria-label="Voir le détail de ${esc(site.name)}">Détail ↗</button>`;
  if(!item)return `<article class="benchmark-site benchmark-site-empty"><div class="benchmark-site-head"><h3>${esc(site.name)}</h3>${open}</div><div class="benchmark-number">—</div><p class="benchmark-empty-label">Donnée indisponible</p><span class="benchmark-source">Aucun relevé pour cette période</span></article>`;
  const hasTarget=Number.isFinite(item.target),percent=kpi.unit==="%";
  const fill=percent?Math.max(0,Math.min(100,item.value)):0,marker=hasTarget?Math.max(0,Math.min(100,item.target)):0;
  return `<article class="benchmark-site"><div class="benchmark-site-head"><h3>${esc(site.name)}</h3>${open}</div><div class="benchmark-number">${item.value}<small>${esc(kpi.unit)}</small></div><p class="benchmark-goal">${hasTarget?`Cible locale ${item.target}${esc(kpi.unit)}`:"Cible à définir"}${hasTarget&&percent?` · Écart ${item.value-item.target>0?"+":""}${+(item.value-item.target).toFixed(1)} pt`:""}</p>${percent?`<div class="benchmark-scale" role="img" aria-label="Valeur ${item.value} %, ${hasTarget?`cible ${item.target} %`:"cible absente"}"><span style="width:${fill}%"></span>${hasTarget?`<i style="left:${marker}%"></i>`:""}</div>`:""}<div class="benchmark-foot"><span>${esc(item.source)}</span>${item.definition?`<details class="benchmark-definition"><summary>Définition</summary><span>${esc(item.definition)}</span></details>`:'<span class="benchmark-qualify">Définition à qualifier</span>'}</div></article>`;
}
function renderGroupBenchmark(){
  const periods=benchmarkPeriods(),period=periods.includes(state.benchmarkPeriod)?state.benchmarkPeriod:periods[0]||"";
  const kpi=BENCHMARK_KPIS.find(k=>k.code===state.benchmarkMetric)||BENCHMARK_KPIS[0];
  const count=OPERATIONAL_SITES.filter(s=>benchmarkObservation(s.id,kpi.code,period)).length;
  return `<section class="section panel benchmark-panel" aria-labelledby="benchmarkTitle">
    <div class="section-title"><div><p class="eyebrow">BIA Holding · six sites opérationnels</p><h2 id="benchmarkTitle">Benchmark multisite</h2><p class="hint">Choisissez un indicateur : les six sites restent visibles ensemble, sur une même période.</p></div>${state.role==="lean"?'<button class="btn secondary" data-new-benchmark>＋ Relevé manuel</button>':""}</div>
    <div class="benchmark-toolbar"><label>Période commune<select id="benchmarkPeriod">${periods.map(p=>`<option value="${esc(p)}" ${p===period?"selected":""}>${esc(p)}${/^S\d+$/.test(p)?" · année à qualifier":""}</option>`).join("")||'<option value="">Aucun relevé</option>'}</select></label><strong>${count}/${OPERATIONAL_SITES.length} sites renseignés · ${esc(kpi.label)}</strong></div>
    <div class="benchmark-metrics" role="group" aria-label="Indicateur à comparer">${BENCHMARK_KPIS.map(k=>`<button class="benchmark-metric ${k.code===kpi.code?"active":""}" data-benchmark-metric="${k.code}" aria-pressed="${k.code===kpi.code}">${esc(k.label)}<span>${OPERATIONAL_SITES.filter(s=>benchmarkObservation(s.id,k.code,period)).length}/6</span></button>`).join("")}</div>
    <div class="benchmark-grid" aria-label="${esc(kpi.label)} pour les six sites">${OPERATIONAL_SITES.map(s=>benchmarkSiteCard(s,kpi,period)).join("")}</div>
    <p class="hint benchmark-note">${data.meta.demo?"Données de démonstration présentes · ":""}Valeurs locales propres à cet appareil · pas de classement ni moyenne Groupe avant validation des définitions, périmètres, sources et pondérations. SEQUOIA : connexion à vérifier.</p>
  </section>`;
}
function benchmarkForm(preset={}){
  if(state.role==="dg"||!["lean","director"].includes(state.role))return;
  const current=state.site==="group"?state.pilotSite:state.site;
  modal("Ajouter un relevé pour le benchmark",`<form id="benchmarkForm"><p>Une valeur par site, indicateur et date. Sélectionnez la même date pour comparer plusieurs sites. La source sera « Saisie manuelle ».</p><div class="form-grid"><label>Site<select id="benchmarkSite">${OPERATIONAL_SITES.filter(s=>allowedSite(s.id,true)).map(s=>`<option value="${s.id}" ${s.id===current?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label><label>Indicateur<select id="benchmarkKpi">${BENCHMARK_KPIS.map(k=>`<option value="${k.code}">${esc(k.label)} (${esc(k.unit||"nombre")})</option>`).join("")}</select></label><label>Date du relevé<input id="benchmarkDate" type="date" value="${/^\d{4}-\d{2}-\d{2}$/.test(state.benchmarkPeriod)?state.benchmarkPeriod:today()}" required></label><label>Valeur<input id="benchmarkValue" type="number" min="0" step="any" required></label><label>Cible locale (facultative)<input id="benchmarkTarget" type="number" min="0" step="any"></label><label class="wide">Définition / périmètre de calcul<input id="benchmarkDefinition" placeholder="Ex. ligne concernée, calcul, exclusions"></label></div><p class="hint">Vérifiez la définition avec les sites avant tout classement. Les relevés manuels restent sur cet appareil.</p><div class="form-actions"><button class="btn">Enregistrer le relevé</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  if(preset.siteId&&Array.from($("benchmarkSite").options).some(o=>o.value===preset.siteId))$("benchmarkSite").value=preset.siteId;
  if(preset.code&&BENCHMARK_KPIS.some(k=>k.code===preset.code))$("benchmarkKpi").value=preset.code;
  $("benchmarkForm").onsubmit=e=>{e.preventDefault();const siteId=$("benchmarkSite").value,code=$("benchmarkKpi").value,period=$("benchmarkDate").value,value=Number($("benchmarkValue").value),targetText=$("benchmarkTarget").value,definition=$("benchmarkDefinition").value.trim();if(!allowedSite(siteId,true)||!BENCHMARK_KPIS.some(k=>k.code===code)||!period||!Number.isFinite(value)||value<0)return toast("Vérifiez le site, la date et la valeur.");const target=targetText===""?null:Number(targetText),metric=BENCHMARK_KPIS.find(k=>k.code===code);if(target!==null&&(!Number.isFinite(target)||target<0))return toast("La cible doit être positive.");if(metric.unit==="%"&&(value>100||target>100))return toast("Une valeur ou une cible en pourcentage doit rester entre 0 et 100.");if(metric.unit===""&&(!Number.isInteger(value)||target!==null&&!Number.isInteger(target)))return toast("Un nombre de signaux sécurité doit être entier.");const source="Saisie manuelle",synced_at=now();
    if(!commitData(()=>{let measure=data.measures.find(m=>m.site_id===siteId&&m.code===code&&m.period===period);if(measure)Object.assign(measure,{value,target,definition,source,synced_at});else data.measures.push({id:uid("m"),site_id:siteId,code,period,value,target,definition,source,synced_at});let trend=data.trends.find(t=>t.site_id===siteId&&t.code===code&&t.granularity==="daily");if(!trend){trend={site_id:siteId,code,granularity:"daily",labels:[],values:[],target,source,details:{}};data.trends.push(trend);}const index=trend.labels.indexOf(period);if(index<0){trend.labels.push(period);trend.values.push(value);}else trend.values[index]=value;const ordered=trend.labels.map((label,i)=>({label,value:trend.values[i]})).sort((a,b)=>a.label.localeCompare(b.label));trend.labels=ordered.map(x=>x.label);trend.values=ordered.map(x=>x.value);trend.details||={};trend.details[period]={source,target,definition,updated_at:synced_at};}))return;
    state.benchmarkPeriod=period;state.benchmarkMetric=code;state.pilotSite=siteId;closeModal();render();toast(`Relevé ${BENCHMARK_KPIS.find(k=>k.code===code).label} enregistré pour ${getSiteName(siteId)} au ${period}. Retrouvable dans Pilotage Groupe · Benchmark.`);
  };
}
function renderPilotage() {
  const group=state.site==="group",selected=group?state.pilotSite:state.site,decisions=scoped(data.decisions).filter(d=>d.status!=="Clos"),critical=scoped(data.signals).filter(s=>s.severity==="Critique"&&isOpenSignal(s));
  return `${pageHead(group?"Pilotage Groupe":"Pilotage Site",group?"Comparer les six sites":`Pilotage de ${site().name}`,"Choisir le périmètre, comprendre l’écart et ouvrir la suite utile.")}${group?renderGroupSqcdp(true)+renderGroupBenchmark():""}<div id="pilotDetail" class="panel pilot-controls">${group?`<label>Site observé<select id="pilotSite">${OPERATIONAL_SITES.map(s=>`<option value="${s.id}" ${s.id===selected?"selected":""}>${esc(s.name)}</option>`).join("")}</select></label>`:""}<label>Historique affiché<select id="pilotPeriod">${[["all","Tout l’historique disponible"],["4","4 derniers relevés"],["8","8 derniers relevés"]].map(([value,label])=>`<option value="${value}" ${value===state.period?"selected":""}>${label}</option>`).join("")}</select></label><span class="hint">${esc(getSiteName(selected))} · chaque courbe conserve sa source</span>${!group&&["lean","director"].includes(state.role)?'<button class="btn secondary" data-new-benchmark>＋ Relevé manuel</button>':""}</div>${group?'<p class="alert">Pas de moyenne Groupe des pourcentages : les définitions, périmètres et pondérations doivent être validés.</p>':""}<div class="grid cols-2 section">${[["trs","TRS","high","%"],["scrap","Qualité · Rebut","low","%"],["safety_signal","Sécurité","low",""],["service","Service client","high","%"],["staffing","Personnel","high","%"]].map(([code,title,direction,unit])=>pilotageChart(indicatorSeries(selected,code),{code,title,direction,unit,contextLabel:getSiteName(selected)})).join("")}</div><section class="section"><div class="section-title"><h2>Décisions et alertes · ${esc(site().name)}</h2><button class="btn secondary" data-new-decision>＋ Décision / escalade</button></div><div class="list">${decisions.map(d=>`<article class="row"><div><b>${esc(d.title)}</b><p class="hint">${esc(getSiteName(d.site_id))} · ${esc(d.owner)} · ${shortDate(d.due_date)}</p></div>${recordLink(d.id,"Décider")}</article>`).join("")}${critical.map(s=>`<article class="row"><div>${pill("Critique","critical")}<b>${esc(s.description)}</b></div>${recordLink(s.id,"Ouvrir")}</article>`).join("")}${!decisions.length&&!critical.length?empty("Aucune décision ouverte ni signal critique sur ce périmètre."):""}</div></section>`;
}
function validateImport(incoming) {
  if(incoming?.meta?.schema!==6)throw new Error("Format de sauvegarde incompatible.");
  for(const key of ["signals","actions","problems","documents"])if(!Array.isArray(incoming[key]))throw new Error(`Collection manquante : ${key}`);
  const normalized=upgradeData(incoming),sites=new Set(SITES.map(s=>s.id));
  for(const [key,rows] of Object.entries(normalized).filter(([,v])=>Array.isArray(v))) {const ids=new Set();for(const row of rows){if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Entrée invalide : ${key}`);if(row.id){if(ids.has(row.id))throw new Error(`Identifiant dupliqué : ${row.id}`);ids.add(row.id);}if(row.site_id&&!sites.has(row.site_id))throw new Error(`Site inconnu dans ${key}`);}}
  for(const p of normalized.problems)if(!DOCUMENT_SCHEMAS[p.method])throw new Error("Méthode de problème inconnue.");
  return normalized;
}
function importData(event) {
  const file=event.target.files?.[0];if(!file)return;if(state.role!=="lean")return toast("L’import complet est réservé au Responsable Lean Groupe.");
  const reader=new FileReader();reader.onerror=()=>toast("Fichier illisible.");reader.onload=()=>{try{const incoming=validateImport(JSON.parse(reader.result));modal("Restaurer une sauvegarde",`<p>Le fichier contient ${incoming.documents.length} documents, ${incoming.actions.length} actions et ${incoming.gembas.length} Gembas. Il remplacera les données locales de cet appareil.</p><p>Une copie des données actuelles sera conservée et téléchargeable dans Compte.</p><div class="form-actions"><button class="btn" id="confirmImport">Restaurer cette sauvegarde</button><button class="btn secondary" data-close-modal>Annuler</button></div>`);$("confirmImport").onclick=()=>{const previous=clone(data);try{localStorage.setItem(`${STORAGE_KEY}-before-import`,JSON.stringify(previous));data=incoming;const priorConflict=storageConflict;storageConflict=false;if(!save()){data=previous;storageConflict=priorConflict;return;}window.biaUnreadable=false;closeModal();render();toast("Sauvegarde restaurée. La version précédente est conservée dans Compte.");}catch{data=previous;toast("Import annulé : espace local insuffisant.");}};}catch(error){toast(`Import refusé : ${error.message}`);}};reader.readAsText(file);
}
function bindDashboards() {
  document.querySelectorAll("[data-export-previous]").forEach(b=>b.onclick=()=>{const raw=localStorage.getItem(`${STORAGE_KEY}-before-import`);if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=`bia-avant-import-${today()}.json`;a.click();URL.revokeObjectURL(url);});
  $("pilotSite")?.addEventListener("change",e=>{state.pilotSite=e.target.value;render();});
  $("pilotPeriod")?.addEventListener("change",e=>{state.period=e.target.value;render();});
  $("benchmarkPeriod")?.addEventListener("change",e=>{state.benchmarkPeriod=e.target.value;render();});
  $("sqcdpGroupPeriod")?.addEventListener("change",e=>{state.benchmarkPeriod=e.target.value;render();});
  document.querySelectorAll("[data-sqcdp-site]").forEach(b=>b.onclick=()=>openGroupSqcdpCell(b.dataset.sqcdpSite,b.dataset.sqcdpAxis));
  document.querySelectorAll("[data-benchmark-metric]").forEach(b=>b.onclick=()=>{state.benchmarkMetric=b.dataset.benchmarkMetric;render();});
  document.querySelectorAll("[data-benchmark-site]").forEach(b=>b.onclick=()=>{state.pilotSite=b.dataset.benchmarkSite;render();$("pilotDetail")?.scrollIntoView({behavior:"smooth",block:"start"});});
  document.querySelectorAll("[data-new-benchmark]").forEach(b=>b.onclick=benchmarkForm);
  document.querySelectorAll("[data-topic-axis]").forEach(b=>b.onclick=()=>topicForm(null,{axis:b.dataset.topicAxis,title:b.dataset.topicTitle}));
  document.querySelectorAll("[data-timer]").forEach(b=>b.onclick=()=>{state.timerStarted=state.timerStarted?null:Date.now();clearInterval(window.biaTimer);render();if(state.timerStarted)window.biaTimer=setInterval(()=>{if($("meetingTimer"))$("meetingTimer").textContent=timerLabel();},1000);});
}
