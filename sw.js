const VERSION = 'v1.7.1';
const CORE = ['./', 'index.html', 'styles.css', 'v5.css', 'v7.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'img/bg/focus-dawn.webp', 'img/bg/focus-night.webp',
  'img/mascot/normal.webp', 'img/mascot/normal-face.webp', 'img/mascot/happy.webp', 'img/mascot/happy-face.webp', 'img/mascot/cheer.webp', 'img/mascot/cheer-face.webp', 'img/mascot/encourage.webp', 'img/mascot/encourage-face.webp', 'img/mascot/sleepy.webp', 'img/mascot/sleepy-face.webp',
  'js/core.js', 'js/icons.js', 'js/tts.js', 'js/plan.js', 'js/notes.js', 'js/fsrs.js', 'js/cards.js', 'js/focus.js', 'js/ai.js', 'js/books.js', 'js/exam.js', 'js/wrong.js', 'js/analysis.js', 'js/solve.js', 'js/bank.js', 'js/remind.js', 'js/stats.js', 'js/game.js', 'js/main.js',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css',
  'vendor/katex/fonts/KaTeX_AMS-Regular.woff2', 'vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2', 'vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2', 'vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2', 'vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2', 'vendor/katex/fonts/KaTeX_Main-Bold.woff2', 'vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2', 'vendor/katex/fonts/KaTeX_Main-Italic.woff2', 'vendor/katex/fonts/KaTeX_Main-Regular.woff2', 'vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2', 'vendor/katex/fonts/KaTeX_Math-Italic.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2', 'vendor/katex/fonts/KaTeX_Script-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size1-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size2-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size3-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size4-Regular.woff2', 'vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && !k.endsWith('-ext')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) { // 外部资源（如离线 OCR 组件）：网络优先，成功则缓存
    if (/cdn\.jsdelivr\.net|tessdata|unpkg/.test(url.host + url.pathname)) e.respondWith(caches.open('ocr-ext').then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }));
    return;
  }
  // 同源：缓存优先 + 后台更新（stale-while-revalidate）
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net; if (r) return r;
    if (req.mode === 'navigate') return c.match('index.html');
    return new Response('离线不可用', { status: 503 });
  }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'))); });
