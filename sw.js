'use strict';
const VERSION = "364d1747d840";
const FILES = ["./","app.js","apps.js","branding/blades-book1.svg","branding/blades-book2.svg","branding/blades-book3.svg","branding/blades-icons.js","branding/blades-logo-dark.svg","branding/blades-logo-mono.svg","branding/blades-ui.css","branding/fonts/fraunces-latin-400-italic.woff2","branding/fonts/fraunces-latin-400-normal.woff2","branding/fonts/fraunces-latin-600-normal.woff2","branding/fonts/fraunces-latin-ext-400-italic.woff2","branding/fonts/fraunces-latin-ext-400-normal.woff2","branding/fonts/fraunces-latin-ext-600-normal.woff2","branding/fonts/jura-400.woff2","branding/fonts/jura-600.woff2","branding/fonts/jura-700.woff2","branding/fonts/jura-OFL.txt","canon-bridge.js","canon-phone.css","canon.html","changes-phone.css","changes.html","changes.js","engine.js","github.js","icons/memphis-app-2048.png","icons/memphis-app-256.png","index.html","manifest.webmanifest","phone-pages.js","phone-shell.css","phone-ui.css","phone.css","shared/canon-model.js","shared/canon-ui.js","shared/canon.css","shared/sync-model.js","shared/wiki-edit.js","shared/wiki-model.js","shared/wiki-pages.js","shared/wiki-sets-ui.js","shared/wiki-sets.js","shared/wiki-ui.js","shared/wiki.css","shared/writer-1.js","shared/writer-2.js","shared/writer-notes.js","shared/writer.css","store.js","wiki-bridge.js","wiki-phone.css","wiki-phone.js","wiki.html","writer-bridge.js","writer-phone.css","writer-phone.js","writer.html"];
const CACHE = 'memphis-phone-' + VERSION;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('memphis-phone-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.hostname === 'api.github.com' || e.request.method !== 'GET') return;
  if (u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match('index.html'))));
});
