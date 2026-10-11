const CACHE='mis-ahorros-v9',ASSETS=['./','./index.html','./style.css','./app.js','./interest-v2.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
async function combinedApp(req){
  try{
    const [a,p]=await Promise.all([fetch(req,{cache:'no-store'}),fetch('./interest-v2.js',{cache:'no-store'})]);
    if(!a.ok||!p.ok)throw new Error('network');
    const text=(await a.text())+'\n;\n'+(await p.text());
    const r=new Response(text,{status:200,headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
    const c=await caches.open(CACHE);c.put(req,r.clone());return r;
  }catch(e){
    const cached=await caches.match(req);if(cached)return cached;
    const [a,p]=await Promise.all([caches.match('./app.js'),caches.match('./interest-v2.js')]);
    if(a&&p)return new Response((await a.text())+'\n;\n'+(await p.text()),{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
    throw e;
  }
}
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.pathname.endsWith('/app.js')){e.respondWith(combinedApp(e.request));return}e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const q=r.clone();caches.open(CACHE).then(c=>c.put(e.request,q));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});