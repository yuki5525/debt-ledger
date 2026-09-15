// 债务台账工作台 Service Worker
// 作用：缓存应用外壳 + CDN 依赖，让页面在断网后仍能打开（离线 PWA）。
// 注意：改了 index.html 后请把 CACHE 版本号 +1，否则用户端还会看到旧缓存。
const CACHE = 'debt-ledger-v8';
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
    // 外壳与 CDN 尽量缓存；任一失败也不阻断安装（离线时可能部分失败）
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))).catch(() => {});
    for (const url of CDN) {
      try { await cache.add(new Request(url, { mode: 'no-cors' })); } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 删除旧版本缓存，避免旧缓存残留导致页面错乱
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    // 立即接管所有页面，不等到下次打开
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isNav = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html');

  if (isNav) {
    // 导航请求：网络优先。永远先拿最新 HTML，避免更新时旧缓存被删、新缓存没接上而白屏；
    // 仅当断网时才回退到缓存的 HTML。
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, resp.clone()).catch(() => {});
        return resp;
      } catch (_) {
        const cached = await caches.match(req)
          || await caches.match('./index.html')
          || await caches.match('./');
        if (cached) return cached;
        throw _;
      }
    })());
    return;
  }

  // 其他静态/跨域资源：缓存优先，缺了再走网络并补缓存
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, resp.clone()).catch(() => {});
      return resp;
    } catch (err) { throw err; }
  })());
});
