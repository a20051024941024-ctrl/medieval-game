/* 讓遊戲可以安裝成 App；有網路時永遠拿最新版，沒網路時用上次存的版本 */
var C='mwd-v1';
self.addEventListener('install',function(e){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(function(res){if(res&&res.ok){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp);});}return res;}).catch(function(){return caches.match(r).then(function(m){return m||caches.match('./');});}));
});
/* 推播通知：遊戲關著時也能收到 */
self.addEventListener('push',function(e){
  var d={};try{d=e.data?e.data.json():{};}catch(x){d={body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'中世紀世界霸權',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:'mwd',renotify:true,data:{url:d.url||self.registration.scope}}));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var url=(e.notification.data&&e.notification.data.url)||self.registration.scope;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){
    for(var i=0;i<cs.length;i++){if(cs[i].url.indexOf(self.registration.scope)===0&&'focus' in cs[i])return cs[i].focus();}
    return clients.openWindow(url);
  }));
});
