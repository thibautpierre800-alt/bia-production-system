const CACHE="bia-production-system-v7-1-1";
const ASSETS=["./","./index.html","./v5.css","./experience.css","./lean-library.js","./v5.js","./experience.js","./workflows.js","./fieldwork.js","./documents-ui.js","./dashboards.js","./os-core.js","./os-views.js","./os-audits.js","./os-vsm.js","./os-app.js","./os.css","./boot.js","./manifest.json","./icon.svg"];
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
