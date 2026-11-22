// Service worker do app da área de membros (PWA).
// - Abre na hora (casca do app guardada no aparelho).
// - Sem internet: mostra as aulas e o conteúdo da última visita (vídeos e chat precisam de internet).
const VERSION = 'membros-v2';
const SHELL = ['/membros', '/membros.js?v=2', '/media/app-any-192.png', '/media/app-maskable-512.png', '/media/app-apple-180.png'];
const API_CACHE = 'membros-api';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== API_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key || req);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Telas do app: sempre a versão mais nova; sem internet, a guardada.
  if (req.mode === 'navigate' && url.pathname.startsWith('/membros')) {
    e.respondWith(networkFirst(req, VERSION, '/membros').catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#121110;color:#f5f2ee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:48px">📶</div><h2>Sem internet</h2><p>Conecte-se para abrir o app pela primeira vez.</p></div>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } })));
    return;
  }
  // Dados do aluno e do curso: rede primeiro, último conteúdo se estiver offline.
  if (url.pathname === '/api/membros' && ['me', 'course', 'app'].includes(url.searchParams.get('a'))) {
    e.respondWith(networkFirst(req, API_CACHE));
    return;
  }
  // Arquivos do app (script e ícones).
  if (url.pathname === '/membros.js' || url.pathname.startsWith('/media/app-')) {
    e.respondWith(staleWhileRevalidate(req));
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'logout') e.waitUntil(caches.delete(API_CACHE));
});
