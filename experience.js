"use strict";

// Shared interaction rules. All records remain local; roles are UI profiles, not authentication.
const APP_VERSION = "6.5";
let modalSaver = null, modalDirty = false, modalOpener = null, modalTimer = null;
let lastStored = localStorage.getItem(STORAGE_KEY);
let storageConflict = false;
Object.assign(state, {query:"", documentTab:"mine", documentType:"all", signalFilter:"open", period:"all", pilotSite:"marzin", presentation:false});

function upgradeData(source) {
  const out = {...source};
  for (const key of ["workshops","measures","trends","signals","actions","problems","projects","decisions","audits","gembas","practices","documents","accounts","people","trainingCatalog","trainingRecords","roadmap","toolRuns","syncLog","topics"]) out[key] = Array.isArray(out[key]) ? out[key] : [];
  for (const p of out.problems) {p.action_ids ||= []; p.signal_ids ||= []; p.content ||= {};}
  return out;
}
function allowedSite(id, write=false) {
  if (write && state.role === "dg") return false;
  return canGroup() || id === state.site;
}
function siteOptions(selected, group=false) {
  return (group?SITES:OPERATIONAL_SITES).filter(s=>allowedSite(s.id)).map(s=>`<option value="${s.id}" ${s.id===selected?"selected":""}>${esc(s.name)}</option>`).join("");
}
function save() {
  if (storageConflict) {toast("Un autre onglet a enregistré des changements. Exportez votre travail puis rechargez cette page."); return false;}
  const previous = data.meta.updated_at;
  data.meta.updated_at = now();
  try {const serialized=JSON.stringify(data);localStorage.setItem(STORAGE_KEY,serialized);lastStored=serialized;modalDirty=false;return true;}
  catch {data.meta.updated_at=previous;toast("Enregistrement impossible : espace local insuffisant. Gardez cette fenêtre ouverte et exportez vos données.");return false;}
}
function commitData(change) {
  const backup=clone(data);
  try {change();if(save())return true;} catch(error){toast(error.message||"Enregistrement impossible.");}
  data=backup;return false;
}
function recordHistory(record, status, note="") {
  record.history ||= [];
  record.history.push({status,note,at:now()});record.updated_at=now();
}
function historyView(record) {
  const rows=record.history||[];
  return rows.length?`<details class="section"><summary>Historique · ${rows.length} événement(s)</summary><ol class="history-list">${rows.map(h=>`<li><b>${esc(h.status)}</b> · ${shortDate(h.at)}<p>${esc(h.note)}</p></li>`).join("")}</ol></details>`:"";
}
function recordMeta(id) {
  const modules={signals:"terrain",gembas:"terrain",actions:"actions",problems:"resolution",documents:"documents",audits:"audits",projects:"projects",practices:"practices",decisions:"pilotage",topics:"sqcdp",roadmap:"roadmap",toolRuns:"tools"};
  for (const [key,module] of Object.entries(modules)) {const row=data[key]?.find(r=>r.id===id);if(row)return {row,key,module};}
  return null;
}
function recordLink(id,label="Ouvrir") {
  const info=recordMeta(id);
  if(!info||!allowedSite(info.row.site_id))return "";
  return `<button type="button" class="btn secondary small" data-open-record="${esc(id)}">${esc(label)} · ${esc(id)}</button>`;
}
function linkedActions(id) {return data.actions.filter(a=>a.origin_id===id&&allowedSite(a.site_id));}
function relatedPanel(id) {
  const rows=linkedActions(id);
  return `<section class="section"><div class="section-title"><h3>Actions liées</h3><span>${rows.filter(isOpenAction).length} ouverte(s)</span></div>${rows.length?`<div class="list">${rows.map(a=>`<div class="row compact"><div><b>${esc(a.title)}</b><p class="hint">${esc(a.owner)} · ${shortDate(a.due_date)} · ${esc(a.status)}</p></div>${recordLink(a.id,"Ouvrir")}</div>`).join("")}</div>`:empty("Aucune action liée pour le moment.")}</section>`;
}
function openRecord(id) {
  const info=recordMeta(id);if(!info||!allowedSite(info.row.site_id))return toast("Ce dossier n’est pas accessible sur ce périmètre.");
  if(!requestCloseModal())return;
  const {row,key,module}=info;
  if(row.site_id!=="group")state.site=row.site_id;
  if(role().nav.includes(module))state.view=module;
  if(key==="gembas")state.terrainTab="gemba";
  if(key==="signals")state.terrainTab="signals";
  render();
  ({signals:()=>openSignal(id),gembas:()=>openGemba(id),actions:()=>actionForm(row),documents:()=>editDocument(id),audits:()=>auditForm(row),projects:()=>projectForm(row),practices:()=>practiceForm(row),decisions:()=>decisionForm(row),topics:()=>topicForm(row),roadmap:()=>roadmapForm(row),toolRuns:()=>{state.toolId=row.module_id;render();},problems:()=>{if(role().nav.includes("resolution")){state.selectedProblemId=id;render()}else{const doc=data.documents.find(d=>d.problem_id===id);if(doc)editDocument(doc.id);else toast("Dossier accessible au responsable de site.")}}})[key]?.();
}
function receipt(id,module,siteId,next="") {
  state.receipt={id,module,siteId,next};modalDirty=false;
  toast(`${id} enregistré · ${module} · ${getSiteName(siteId)}${next?` · ${next}`:""}`);
}
function receiptView() {const r=state.receipt;return r?`<aside class="save-receipt" role="status"><div><b>${esc(r.id)} enregistré dans ${esc(r.module)}</b><span>${esc(getSiteName(r.siteId))}${r.next?` · ${esc(r.next)}`:""}</span></div>${recordLink(r.id,"Retrouver") }<button class="btn ghost small" type="button" data-dismiss-receipt aria-label="Masquer la confirmation">×</button></aside>`:"";}
function setModalSaver(fn) {modalSaver=fn;}
function scheduleModalSave() {
  if(!modalSaver)return;clearTimeout(modalTimer);
  modalTimer=setTimeout(()=>{if(modalSaver?.()!==false){modalDirty=false;const s=$("saveState");if(s)s.textContent="Enregistré sur cet appareil";}},650);
}
function requestCloseModal() {
  if($("modal").hidden)return true;
  clearTimeout(modalTimer);
  if(modalSaver){if(modalSaver()===false)return false;}
  else if(modalDirty){
    let guard=$("closeGuard");
    if(!guard){guard=document.createElement("div");guard.id="closeGuard";guard.className="close-guard";guard.innerHTML='<p>Votre saisie n’est pas encore enregistrée.</p><button type="button" class="btn" data-keep-editing>Continuer la saisie</button> <button type="button" class="btn secondary" data-discard-edit>Abandonner cette saisie</button>';$("modalContent").prepend(guard);guard.querySelector("[data-keep-editing]").onclick=()=>guard.remove();guard.querySelector("[data-discard-edit]").onclick=()=>closeModal();guard.querySelector("button").focus();}
    return false;
  }
  closeModal();return true;
}
function modal(title,content) {
  clearTimeout(modalTimer);modalSaver=null;modalDirty=false;modalOpener=document.activeElement;
  $("modalContent").innerHTML=`<div class="modal-head"><h2 id="modalTitle">${esc(title)}</h2><button class="modal-close" data-close-modal aria-label="Fermer">×</button></div><div class="modal-body">${content}</div>`;
  $("modal").hidden=false;document.body.classList.add("modal-open");
  $("modalContent").oninput=()=>{modalDirty=true;const s=$("saveState");if(s)s.textContent="Enregistrement…";scheduleModalSave();};
  $("modalContent").onchange=()=>{modalDirty=true;scheduleModalSave();};
  bindModal();bindExperience();
  setTimeout(()=>$("modalContent").querySelector("input:not([type=file]),textarea,select,button")?.focus(),0);
}
function closeModal() {clearTimeout(modalTimer);modalSaver=null;modalDirty=false;$("modal").hidden=true;$("modalContent").innerHTML="";document.body.classList.remove("modal-open");modalOpener?.focus?.();}
function safePhoto(value) {return typeof value==="string"&&/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)?value:"";}
function photoImage(value,alt="Photo terrain") {return safePhoto(value)?`<img class="evidence-photo" src="${safePhoto(value)}" alt="${esc(alt)}">`:"";}
function imageDataUrl(file) {
  return new Promise((resolve,reject)=>{
    if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))return reject(new Error("Choisissez une image JPG, PNG ou WebP."));
    if(file.size>20*1024*1024)return reject(new Error("La photo dépasse 20 Mo. Choisissez une image plus légère."));
    const reader=new FileReader();reader.onerror=()=>reject(new Error("Lecture de la photo impossible."));
    reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Cette image ne peut pas être lue."));img.onload=()=>{
      try{const scale=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const url=canvas.toDataURL("image/jpeg",.7);if(url.length>850000)throw new Error("Image trop détaillée : choisissez une photo plus légère.");resolve(url);}catch(error){reject(error);}
    };img.src=reader.result;};reader.readAsDataURL(file);
  });
}
function photoPicker(inputId,previewId,initial="") {
  const photo={value:safePhoto(initial),busy:false,error:false},input=$(inputId),preview=$(previewId);let sequence=0;
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const current=++sequence;photo.busy=true;photo.error=false;preview.textContent="Préparation de la photo…";
    try{const value=await imageDataUrl(file);if(current!==sequence)return;photo.value=value;preview.innerHTML=photoImage(value);modalDirty=true;}
    catch(error){if(current!==sequence)return;photo.error=true;preview.innerHTML=`${photoImage(photo.value)}<p class="bad" role="alert">${esc(error.message)}</p>`;}
    finally{if(current===sequence){photo.busy=false;scheduleModalSave();}}
  };return photo;
}
function searchableRecords(query="") {
  const q=query.trim().toLocaleLowerCase("fr");
  const keys={actions:"Actions",signals:"Signal Terrain",gembas:"Gemba",problems:"Résolution",documents:"Documents",audits:"Audits",projects:"Chantiers",practices:"Bonnes pratiques",roadmap:"Roadmap",topics:"SQCDP",decisions:"Décisions",toolRuns:"Démarches"};
  return Object.entries(keys).flatMap(([key,label])=>(data[key]||[]).filter(r=>allowedSite(r.site_id)&&role().nav.includes(recordMeta(r.id)?.module)).map(r=>({id:r.id,title:r.title||r.description||r.zone||r.scope||r.finding||LEAN_MODULES.find(t=>t.id===r.module_id)?.title,label,site_id:r.site_id,status:r.status||r.state||"À poursuivre",updated:r.updated_at||r.created_at||r.performed_at||""}))).filter(r=>!q||[r.id,r.title,r.label,r.status,getSiteName(r.site_id)].join(" ").toLocaleLowerCase("fr").includes(q)).sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
}
function searchForm() {
  modal("Retrouver un dossier",'<label class="field">Nom, identifiant, sujet ou module<input id="globalQuery" type="search" placeholder="Ex. A3, protection, G-014…" autocomplete="off"></label><div id="searchResults" class="list section"></div>');
  const show=()=>{const rows=searchableRecords($("globalQuery").value).slice(0,30);$("searchResults").innerHTML=rows.map(r=>`<article class="row"><div><b>${esc(r.title)}</b><p class="hint">${esc(r.label)} · ${esc(getSiteName(r.site_id))} · ${esc(r.status)}</p></div>${recordLink(r.id)}</article>`).join("")||empty("Aucun dossier sur ce périmètre.");bindExperience();};
  $("globalQuery").oninput=show;setModalSaver(()=>true);show();
}
function resumeWork() {
  const rows=searchableRecords().filter(r=>["Documents","Gemba","Audits","Démarches"].includes(r.label)&&!["Validé","Terminé","Clos"].includes(r.status)).slice(0,4);
  return `<section class="section"><div class="section-title"><div><h2>Reprendre mon travail</h2><p class="hint">Dossiers enregistrés sur ce périmètre.</p></div><button class="btn secondary" data-search-all>Retrouver un dossier</button></div><div class="resume-grid">${rows.map(r=>`<article class="panel"><span class="eyebrow">${esc(r.label)} · ${esc(r.id)}</span><h3>${esc(r.title)}</h3><p class="hint">${esc(r.status)} · ${shortDate(r.updated)}</p>${recordLink(r.id,"Continuer")}</article>`).join("")||empty("Aucun brouillon à reprendre.")}</div></section>`;
}
function filterList() {
  const field=$("listSearch");if(!field)return;
  const q=field.value.trim().toLocaleLowerCase("fr");let visible=0;
  document.querySelectorAll("[data-search-row]").forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase("fr").includes(q);if(!row.hidden)visible++;});
  if($("searchCount"))$("searchCount").textContent=`${visible} résultat(s)`;
}
function listSearch(label="Rechercher dans ce registre") {return `<div class="list-search"><label>${esc(label)}<input type="search" id="listSearch" placeholder="Nom, identifiant, responsable…"></label><span id="searchCount" role="status"></span></div>`;}
function bindExperience() {
  document.querySelectorAll("[data-open-record]").forEach(b=>b.onclick=()=>openRecord(b.dataset.openRecord));
  document.querySelectorAll("[data-edit-run]").forEach(b=>b.onclick=()=>toolRunForm(b.dataset.editRun));
  document.querySelectorAll("[data-export-raw]").forEach(b=>b.onclick=()=>downloadJsonText(localStorage.getItem(STORAGE_KEY),"bia-donnees-a-recuperer.json"));
  document.querySelectorAll("[data-search-all]").forEach(b=>b.onclick=searchForm);
  document.querySelectorAll("[data-dismiss-receipt]").forEach(b=>b.onclick=()=>{state.receipt=null;render();});
  $("listSearch")?.addEventListener("input",filterList);
  document.querySelectorAll("[data-document-tab]").forEach(b=>b.onclick=()=>{state.documentTab=b.dataset.documentTab;render();});
  document.querySelectorAll("[data-signal-filter]").forEach(b=>b.onclick=()=>{state.signalFilter=b.dataset.signalFilter;render();});
  document.querySelectorAll("[data-display-mode]").forEach(b=>b.onclick=()=>{state.presentation=!state.presentation;render();});
  document.querySelectorAll("[data-new-topic]").forEach(b=>b.onclick=()=>topicForm());
  document.querySelectorAll("[data-new-decision]").forEach(b=>b.onclick=()=>decisionForm());
  document.querySelectorAll("[data-kpi-action]").forEach(b=>b.onclick=()=>actionForm(null,{site_id:state.site==="group"?state.pilotSite:state.site,origin_type:"KPI",origin_id:b.dataset.kpiAction,title:`Analyser l’écart · ${b.dataset.kpiLabel}`}));
  document.querySelectorAll("[data-kpi-records]").forEach(b=>b.onclick=()=>{const siteId=state.site==="group"?state.pilotSite:state.site,rows=data.actions.filter(a=>a.site_id===siteId&&a.origin_type==="KPI"&&a.origin_id===b.dataset.kpiRecords);modal("Actions de cet indicateur",rows.map(a=>actionCard(a)).join("")||empty("Aucune action encore reliée à cet indicateur."));bind();});
  bindFieldwork();bindDocuments();bindDashboards();
}
function initExperience() {
  data=upgradeData(data);
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);validateImport(parsed);}}catch{storageConflict=true;window.biaUnreadable=true;}
  $("siteSelect").onchange=e=>{if(!requestCloseModal())return;state.site=e.target.value;state.receipt=null;localStorage.setItem("biaSite",state.site);render();};
  $("roleSelect").onchange=e=>{if(!requestCloseModal())return;state.role=e.target.value;state.receipt=null;localStorage.setItem("biaRole",state.role);if(!canGroup()&&state.site==="group")state.site="marzin";render();};
  $("menuButton").onclick=()=>{const open=$("sidebar").classList.toggle("open");$("menuButton").setAttribute("aria-expanded",String(open));};
  $("modal").onclick=e=>{if(e.target===$("modal"))requestCloseModal();};
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!$("modal").hidden){e.preventDefault();requestCloseModal();}
    if(e.key==="Tab"&&!$("modal").hidden){const focusable=[...$("modalContent").querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  window.addEventListener("beforeunload",e=>{if(modalSaver){if(modalSaver()!==false)return;}if(modalDirty){e.preventDefault();e.returnValue="";}});
  window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY&&e.newValue!==lastStored){storageConflict=true;toast("Données modifiées dans un autre onglet. Exportez votre saisie avant de recharger.");}});
  window.addEventListener("hashchange",()=>{const view=location.hash.slice(1);if(role().nav.includes(view)&&requestCloseModal()){state.view=view;render();}});
  if(role().nav.includes(location.hash.slice(1)))state.view=location.hash.slice(1);
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
  render();
}

function downloadJsonText(raw,name) {if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function toolRunForm(id) {
  const run=data.toolRuns.find(r=>r.id===id);if(!run||!allowedSite(run.site_id,true))return;
  modal(`${id} · Responsable de la démarche`,`<form id="toolRunForm"><p>${esc(LEAN_MODULES.find(t=>t.id===run.module_id)?.title)} · ${esc(getSiteName(run.site_id))}</p><label class="field">Responsable<input id="toolRunOwner" required value="${esc(run.owner==="À attribuer"?"":run.owner||"")}"></label><div class="form-actions"><button class="btn">Enregistrer</button></div></form>`);
  $("toolRunForm").onsubmit=e=>{e.preventDefault();const owner=$("toolRunOwner").value.trim();if(!owner)return;if(!commitData(()=>{const row=data.toolRuns.find(r=>r.id===id);row.owner=owner;row.updated_at=now();}))return;closeModal();receipt(id,"Bibliothèque → Mes démarches",run.site_id,"Poursuivre la checklist");render();};
}
