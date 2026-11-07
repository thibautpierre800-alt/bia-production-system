const CACHE="bia-production-system-v8-42-0";
const ASSETS=["./","./index.html","./v5.css","./experience.css","./lean-library.js","./v5.js","./experience.js","./workflows.js","./fieldwork.js","./documents-ui.js","./dashboards.js","./os-core.js","./os-views.js","./os-audits.js","./os-vsm.js","./os-app.js","./os-improvements.js","./actions-plan.js","./ux-shell.js","./journee.js","./indicateurs.js","./maturite.js","./hoshin.js","./modeles.js","./calepin.js","./etonnement.js","./cinqs.js","./audit50.js","./standards.js","./smed.js","./causes.js","./tpm.js","./polyvalence.js","./idees.js","./equilibrage.js","./sqcdp-jour.js","./vsm-flux.js","./pratiques.js","./bibliotheque.js","./signaux.js","./releve.js","./chantiers.js","./formation.js","./roadmap-revue.js","./avant-apres.js","./ecarts.js","./journal.js","./parametres.js","./connecteurs.js","./reunions.js","./cascade.js","./microarrets.js","./trs.js","./gains.js","./environnement.js","./nc.js","./echantillotheque.js","./tour.js","./ergonomie.js","./ux.css","./os-improvements.css","./os.css","./boot.js","./manifest.json","./icon.svg","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith("bia-os-")||key.startsWith("bia-production-system-"))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin||!ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  // Installed assets form one version. Do not mix live files with a previous
  // release when a deployment happens between two script requests.
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const hit=await cache.match(event.request,{ignoreSearch:true});
    if(hit)return hit;
    return fetch(event.request);
  }));
});
