// 한자패스 오프라인 캐시 (Service Worker)
// - index.html · version.json: 네트워크 우선(새 배포를 바로 반영), 실패하면 캐시
// - ?v=버전 이 붙은 코드·데이터: 캐시 우선(버전이 바뀌면 URL이 바뀌므로 오래된 파일이 섞이지 않음)
// - 학습 기록(localStorage)은 건드리지 않는다
const V = '2026.09.30-1';
const SHELL = 'hanja-shell-' + V;
const DATA = 'hanja-data-' + V;
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    try {
      const j = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json();
      const urls = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'].concat(j.files.filter((f) => !f.includes('?')).map((f) => (/\.(js|css)$/.test(f) && f !== 'index.html' ? f + '?v=' + j.v : f)));
      await Promise.all(urls.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    } catch (err) { /* 오프라인 설치 실패 시 다음 방문에 다시 시도 */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('hanja-') && k !== SHELL && k !== DATA) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isDoc = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname) || url.pathname.endsWith('version.json');
  if (isDoc) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok && !url.pathname.endsWith('version.json')) caches.open(SHELL).then((c) => c.put(url.pathname.endsWith('/') ? './' : 'index.html', r.clone()));
      return r;
    }).catch(async () => (await caches.match(req, { ignoreSearch: url.pathname.endsWith('version.json') })) || (await caches.match('index.html')) || Response.error()));
    return;
  }
  if (url.searchParams.has('v')) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) { const c = await caches.open(url.pathname.includes('/data/') ? DATA : SHELL); c.put(req, r.clone()); }
      return r;
    })());
  }
});
