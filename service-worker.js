// 债务台账工作台 Service Worker
// 作用：缓存应用外壳 + CDN 依赖，让页面在断网后仍能打开（离线 PWA）。
// 注意：改了 index.html 后请把 CACHE 版本号 +1，否则用户端还会看到旧缓存。
const CACHE = 'debt-ledger-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-512.png'
];
const CDN = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))).catch(() => {});
    for (const url of CDN) {
      try { await cache.add(new Request(url, { mode: 'no-cors' })); } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      const copy = resp.clone();
      const cache = await caches.open(CACHE);
      cache.put(req, copy).catch(() => {});
      return resp;
    } catch (e) {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
      throw e;
    }
  })());
});
