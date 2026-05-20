const CACHE='mundial2026-v2';
const BASE = self.registration.scope;
const ASSETS=[
  BASE,
  BASE+'index.html',
  BASE+'app.css',
  BASE+'qrcode.js',
  BASE+'jsqr.js',
  BASE+'data.js',
  BASE+'app.js',
  BASE+'manifest.json',
  BASE+'icons/icon-192.png',
  BASE+'icons/icon-512.png',
  BASE+'icons/apple-touch-icon.png'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).catch(()=>caches.match(BASE+'index.html'))));});
