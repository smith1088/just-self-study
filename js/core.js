'use strict';
/* ========== 工具函数 ========== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 86400000;
const pad2 = n => String(n).padStart(2, '0');
function dayKey(t = Date.now()) { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfDay(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function fmtDate(t) { if (!t) return ''; const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; }
function fmtDateTime(t) { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtMin(m) { m = Math.round(m); if (m < 60) return m + ' 分钟'; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} 小时 ${r} 分` : `${h} 小时`; }
function relDue(ts) {
  if (!ts) return '';
  const diff = Math.round((startOfDay(ts) - startOfDay()) / DAY);
  if (diff === 0) return '今天'; if (diff === 1) return '明天'; if (diff === 2) return '后天';
  if (diff === -1) return '昨天'; if (diff < 0) return `已过期 ${-diff} 天`;
  return diff < 7 ? `${diff} 天后` : fmtDate(ts);
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ========== IndexedDB 存储 ========== */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('study-workbench', 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  get(k) { return new Promise((res, rej) => { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  set(k, v) { return new Promise((res, rej) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  clear() { return new Promise((res) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').clear(); tx.oncomplete = () => res(); }); }
};
const COLLECTIONS = ['todos', 'notes', 'decks', 'cards', 'reviews', 'sessions', 'books', 'exams', 'wrongs', 'solves', 'banks', 'courses', 'events', 'chats', 'mems'];
const DEFAULT_SETTINGS = {
  theme: 'auto',
  subjects: [
    { id: 'math', name: '高等数学', color: '#4f6bed' }, { id: 'linalg', name: '线性代数', color: '#7c4dff' },
    { id: 'english', name: '大学英语', color: '#20c997' }, { id: 'physics', name: '大学物理', color: '#ff9f0a' },
    { id: 'clang', name: 'C语言程序设计', color: '#0a84ff' }, { id: 'politics', name: '思政课程', color: '#ff3b30' },
    { id: 'other', name: '其他', color: '#8e8e93' }
  ],
  pomo: { focus: 25, short: 5, long: 15, longEvery: 4, autoNext: false, sound: true, wakeLock: true, dailyGoal: 120 },
  cards: { newPerDay: 20, retention: 0.9, maxIvl: 36500 },
  tts: { rate: 1, autoplay: false, autoBack: true, enVoice: '', zhVoice: '' },
  remind: { enabled: true, morning: '08:00', evening: '21:00', notify: true },
  ai: { preset: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat', visionModel: '', jsonMode: true, maxChars: 12000 },
  tt: { start: '', periods: [] },
  lin: { romance: true, nick: '', tts: false, greet: true, pts: {} },
  name: ''
};
const S = { settings: null }; COLLECTIONS.forEach(c => S[c] = []);
const _savers = {};
function save(coll) {
  if (!_savers[coll]) _savers[coll] = debounce(() => DB.set(coll, S[coll]).catch(e => toast('保存失败：' + e.message)), 250);
  _savers[coll]();
}
function saveNow(coll) { return DB.set(coll, S[coll]); }
async function loadAll() {
  await DB.open();
  for (const c of COLLECTIONS) S[c] = (await DB.get(c)) || [];
  const st = (await DB.get('settings')) || {};
  S.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), st);
  if (st.subjects) S.settings.subjects = st.subjects;
  S.pomoState = (await DB.get('pomoState')) || null;
  S.meta = (await DB.get('meta')) || {};
}
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }
function saveSettings() { DB.set('settings', S.settings); }
// 颜色值会被拼进 style 属性：只允许 #hex / var(--x) / rgb()/hsl() 数字形式，防止导入的数据注入 HTML
const safeColor = (c, d = '#8e8e93') => /^(#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\)|(rgb|hsl)a?\([0-9., %]+\))$/i.test(String(c ?? '').trim()) ? String(c).trim() : d;
function subj(id) { const s = S.settings.subjects.find(s => s.id === id); return s ? (s.color === safeColor(s.color) ? s : { ...s, color: safeColor(s.color) }) : { id: '', name: '未分类', color: '#8e8e93' }; }
function subjChip(id) { if (!id) return ''; const s = subj(id); return `<span class="chip"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>`; }
function subjOptions(sel, allowEmpty = true) { return (allowEmpty ? `<option value="">未分类</option>` : '') + S.settings.subjects.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join(''); }

/* ========== UI 帮助 ========== */
let _toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.add('hidden'), ms); }
let _loadingAbort = null;
function loading(on, text = '处理中…', abortCtl = null) {
  $('#loading').classList.toggle('hidden', !on); $('#loadingText').textContent = text;
  _loadingAbort = abortCtl; $('#loadingCancel').classList.toggle('hidden', !abortCtl);
}
let _sheetOnClose = null;
// 代替内联 onclick（CSP 禁止内联脚本）
document.addEventListener('click', e => {
  if (e.target.closest('[data-close-sheet]')) closeSheet();
  if (e.target.closest('[data-reset-types]') && typeof examDraft !== 'undefined') examDraft.types = { single: 0, multiple: 0, judge: 0, blank: 0, short: 0, calc: 0 };
});
function openSheet(html, onMount, onClose) {
  if (_sheetOnClose) { const f = _sheetOnClose; _sheetOnClose = null; }
  const sh = $('#sheet'); $('#sheetBody').innerHTML = html; sh.classList.remove('hidden'); _sheetOnClose = onClose || null;
  $('#sheet .sheet-panel').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  onMount && onMount($('#sheetBody'));
}
function closeSheet(silent) { const wasOpen = !$('#sheet').classList.contains('hidden'); $('#sheet').classList.add('hidden'); $('#sheetBody').innerHTML = ''; document.body.style.overflow = ''; const f = _sheetOnClose; _sheetOnClose = null; if (wasOpen && f && !silent) f(); }
function confirmBox(msg, okText = '确定', danger = true) {
  return new Promise(res => {
    openSheet(`<h2 style="font-size:18px">${esc(msg)}</h2><div class="btns"><button class="btn plain" data-r="0">取消</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(okText)}</button></div>`, el => {
      el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { closeSheet(); res(b.dataset.r === '1'); } });
    });
  });
}
function setTop(title, { back = null, actions = '' } = {}) {
  $('#title').textContent = title; document.title = title + ' · 学习工作台';
  const bb = $('#backBtn'); bb.classList.toggle('hidden', !back); bb.onclick = () => { if (typeof back === 'function') back(); else location.hash = back; };
  $('#topActions').innerHTML = actions;
}
function readFileAs(file, how = 'text') {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); if (how === 'text') r.readAsText(file); else if (how === 'dataurl') r.readAsDataURL(file); else r.readAsArrayBuffer(file); });
}
/* 压缩图片 -> dataURL(jpeg) */
async function compressImage(file, maxSide = 1600, q = 0.85) {
  const url = typeof file === 'string' ? file : URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('图片无法读取（若为 HEIC，请在相机设置中选择“兼容性最佳”或截图后再试）')); i.src = url; });
  let { width: w, height: h } = img; const sc = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * sc); h = Math.round(h * sc);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  if (typeof file !== 'string') URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', q);
}
function pickFile(accept, { multiple = false, capture = false } = {}) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; if (capture) i.setAttribute('capture', 'environment');
    i.style.display = 'none'; document.body.appendChild(i);
    i.onchange = () => { res([...i.files]); i.remove(); };
    i.click();
  });
}
/* ========== 数学公式（KaTeX） ========== */
// 支持 $$…$$、\[…\]、\(…\)、$…$（$ 内侧不能是空格，避免误伤金额）
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\s](?:[^$\n]*?[^$\s\\])?)\$/g;
const _kxCache = new Map();
function katexHtml(tex, display) {
  const key = (display ? 'D' : 'I') + tex; if (_kxCache.has(key)) return _kxCache.get(key);
  let h; if (!window.katex) h = esc(display ? `$$${tex}$$` : `$${tex}$`);
  else { try { h = katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: 'ignore', output: 'html', trust: false }); } catch (e) { h = `<code>${esc(tex)}</code>`; } }
  if (_kxCache.size > 800) _kxCache.clear(); _kxCache.set(key, h); return h;
}
const hasMath = s => { MATH_RE.lastIndex = 0; return MATH_RE.test(String(s || '')); };
// 文本 + 公式：普通部分做 HTML 转义（fmt 可自定义），公式部分用 KaTeX 渲染
function withMath(src, fmt = esc) {
  src = String(src ?? ''); let out = '', last = 0; MATH_RE.lastIndex = 0; let m;
  while ((m = MATH_RE.exec(src))) { out += fmt(src.slice(last, m.index)); const disp = m[1] != null || m[2] != null; out += katexHtml((m[1] ?? m[2] ?? m[3] ?? m[4]).trim(), disp); last = m.index + m[0].length; }
  return out + fmt(src.slice(last));
}
const rt = s => withMath(s, x => esc(x).replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>'));
/* 简易 Markdown 渲染（支持公式） */
function md(src) {
  const store = []; src = String(src || '').replace(MATH_RE, (m0, a, b, c, d) => { store.push(katexHtml((a ?? b ?? c ?? d).trim(), a != null || b != null)); return `\u0001${store.length - 1}\u0001`; });
  return mdRaw(src).replace(/\u0001(\d+)\u0001/g, (m0, i) => store[+i]);
}
function mdRaw(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let out = '', inCode = false, list = null, para = [];
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const flushP = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const l of lines) {
    if (l.trim().startsWith('```')) { flushP(); flushL(); out += inCode ? '</code></pre>' : '<pre><code>'; inCode = !inCode; continue; }
    if (inCode) { out += esc(l) + '\n'; continue; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flushP(); flushL(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
    else if ((m = l.match(/^\s*[-*+]\s+\[( |x)\]\s+(.*)/i))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul style="list-style:none;padding-left:.4em">'; list = 'ul'; } out += `<li>${m[1].trim() ? '☑' : '☐'} ${inline(m[2])}</li>`; }
    else if ((m = l.match(/^\s*[-*+]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)、]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^>\s?(.*)/))) { flushP(); flushL(); out += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if (/^\s*(---|\*\*\*)\s*$/.test(l)) { flushP(); flushL(); out += '<hr>'; }
    else if (!l.trim()) { flushP(); flushL(); }
    else { flushL(); para.push(l); }
  }
  if (inCode) out += '</code></pre>'; flushP(); flushL();
  return out;
}

/* ========== 路由 ========== */
const Routes = [];
function route(pattern, tab, fn) { Routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), tab, fn }); }
let currentCleanup = null;
function render() {
  const [h, qs] = (location.hash || '#/today').slice(1).split('?'); window.Q = new URLSearchParams(qs || '');
  if (currentCleanup) { try { currentCleanup(); } catch (e) { } currentCleanup = null; }
  if (window.TTS) TTS.stop();
  closeSheet(true);
  for (const r of Routes) {
    const m = h.match(r.re);
    if (m) {
      $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === r.tab));
      const old = $('#view'); const v = old.cloneNode(false); old.replaceWith(v);
      try { currentCleanup = r.fn(v, ...m.slice(1).map(decodeURIComponent)) || null; }
      catch (e) { console.error(e); v.innerHTML = `<div class="notice err">页面出错：${esc(e.message)}</div>`; }
      const LT = { '/plan': 1, '/learn': 1, '/me': 1 }, isT = h === '/today';
      document.body.classList.toggle('page-today', isT); document.body.classList.toggle('page-focus', h === '/focus'); document.body.classList.toggle('page-chat', h === '/chat'); document.body.classList.toggle('lt-page', !!(LT[h] || isT));
      if (LT[h]) v.insertAdjacentHTML('afterbegin', `<h1 class="page-title">${esc($('#title').textContent)}</h1>`);
      requestAnimationFrame(onScrollTop);
      if (_animNext) { v.classList.add('enter'); _animNext = false; }
      if (window.Remind) try { Remind.update(); } catch (e) { }
      return;
    }
  }
  location.hash = '#/today';
}
let _animNext = false;
function onScrollTop() { document.body.classList.toggle('scrolled', window.scrollY > 24); }
window.addEventListener('scroll', onScrollTop, { passive: true });
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
window.addEventListener('hashchange', () => { _animNext = true; render(); window.scrollTo(0, 0); });
