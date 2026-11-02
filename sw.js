/* 讓遊戲可以安裝成 App；有網路時永遠拿最新版，沒網路時用上次存的版本 */
var C='mwd-v1';
self.addEventListener('install',function(e){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(function(res){if(res&&res.ok){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp);});}return res;}).catch(function(){return caches.match(r).then(function(m){return m||caches.match('./');});}));
});
