'use strict';
const VERSION = "e477da9155af";
const FILES = ["./","app.js","apps.js","branding/blades-icons.js","branding/blades-ui.css","branding/fonts/jura-400.woff2","branding/fonts/jura-600.woff2","branding/fonts/jura-700.woff2","branding/fonts/jura-OFL.txt","canon-bridge.js","canon-phone.css","canon.html","engine.js","github.js","icons/memphis-app-2048.png","icons/memphis-app-256.png","index.html","manifest.webmanifest","phone-shell.css","phone.css","shared/canon-model.js","shared/canon-ui.js","shared/canon.css","shared/sync-model.js","shared/wiki-edit.js","shared/wiki-model.js","shared/wiki-pages.js","shared/wiki-sets-ui.js","shared/wiki-sets.js","shared/wiki-ui.js","shared/wiki.css","store.js","wiki-bridge.js","wiki-phone.css","wiki-phone.js","wiki.html"];
const CACHE = 'memphis-phone-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('memphis-phone-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.hostname === 'api.github.com' || e.request.method !== 'GET') return;   // never kept: always the network
  if (u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match('index.html'))));
});
