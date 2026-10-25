'use strict';
/* ========== 教材导入 ========== */
// PDF 中常见的康熙部首/兼容汉字（如“⼀”）转换为标准汉字
const fixCJK = s => s.replace(/[\u2E80-\u2FDF\uF900-\uFAFF]/g, c => c.normalize('NFKC'));
const CN_NUM = '一二三四五六七八九十百零〇两';
const Books = {
  pdfjs: null,
  async loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('PDF 解析组件加载失败')); document.head.appendChild(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    return window.pdfjsLib;
  },
  async readPdf(file, progress, signal) {
    const lib = await this.loadPdfJs();
    const buf = await readFileAs(file, 'buffer');
    const pdf = await lib.getDocument({ data: buf, cMapUrl: 'vendor/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/standard_fonts/' }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (signal?.aborted) throw new AIError('已取消', 'abort');
      progress && progress(`正在解析 PDF 第 ${i}/${pdf.numPages} 页…`);
      const page = await pdf.getPage(i); const tc = await page.getTextContent();
      let s = '', lastY = null;
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        const y = it.transform ? it.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !s.endsWith('\n')) s += '\n';
        s += it.str; if (it.hasEOL) s += '\n'; lastY = y;
      }
      pages.push(fixCJK(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    }
    let outline = [];
    try {
      const ol = await pdf.getOutline();
      if (ol && ol.length) for (const it of ol) {
        let dest = it.dest; if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) { const idx = await pdf.getPageIndex(dest[0]); outline.push({ title: it.title.trim(), page: idx }); }
      }
      outline = outline.filter((o, i, a) => i === 0 || o.page >= a[i - 1].page);
    } catch (e) { outline = []; }
    return { pdf, pages, outline };
  },
  async renderPage(pdf, n, scale = 1.6) {
    const page = await pdf.getPage(n); const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise; const url = c.toDataURL('image/jpeg', 0.8); c.width = c.height = 0; return url;
  },
  async tesseract(dataUrl, progress) {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('离线 OCR 组件下载失败，请检查网络')); document.head.appendChild(s); });
    const r = await Tesseract.recognize(dataUrl, 'chi_sim+eng', { logger: m => { if (m.status === 'recognizing text' && progress) progress(`本地识别中 ${Math.round(m.progress * 100)}%`); else if (progress && m.status) progress('本地 OCR：' + ({ 'loading language traineddata': '下载中文识别模型（约 20MB，仅首次）', 'initializing api': '初始化' }[m.status] || m.status)); } });
    return r.data.text.replace(/([\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1');
  },
  headingRe: [
    new RegExp(`^\\s*(第[${CN_NUM}\\d]+[章单元篇部]|Chapter\\s*\\d+|CHAPTER\\s*\\d+|Unit\\s*\\d+|UNIT\\s*\\d+|Module\\s*\\d+|模块[${CN_NUM}\\d]+)`),
    new RegExp(`^\\s*(第[${CN_NUM}\\d]+[节课讲]|Lesson\\s*\\d+|\\d+\\.\\d+\\s*[\\u4e00-\\u9fa5A-Za-z])`),
    /^\s*#{1,3}\s+\S/
  ],
  split(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    for (const re of this.headingRe) {
      const idx = []; lines.forEach((l, i) => { if (l.trim().length <= 40 && re.test(l)) idx.push(i); });
      // 去掉目录区：连续很近的标题（目录页）只保留后面正文出现的
      const uniq = []; const seen = new Map();
      idx.forEach(i => { const k = lines[i].trim().replace(/[\s.…·\d]+$/, ''); seen.set(k, i); });
      const keep = [...new Set(seen.values())].sort((a, b) => a - b);
      if (keep.length >= 2) {
        const chs = []; if (keep[0] > 0) { const pre = lines.slice(0, keep[0]).join('\n').trim(); if (pre.length > 200) chs.push({ title: '前言 / 开篇', text: pre }); }
        keep.forEach((s, j) => { const e = keep[j + 1] ?? lines.length; const body = lines.slice(s + 1, e).join('\n').trim(); chs.push({ title: lines[s].trim().replace(/^#+\s*/, '').slice(0, 40), text: body }); });
        const good = chs.filter(c => c.text.length > 30);
        if (good.length >= 2) return good;
      }
    }
    return this.chunk(text, 4000);
  },
  chunk(text, size) {
    const paras = text.split(/\n{2,}|\n(?=\S)/); const out = []; let cur = '';
    for (const p of paras) { if ((cur + p).length > size && cur) { out.push(cur.trim()); cur = ''; } cur += p + '\n'; }
    if (cur.trim()) out.push(cur.trim());
    return out.map((t, i) => ({ title: `第 ${i + 1} 部分`, text: t }));
  },
  fromPages(pages, outline) {
    if (outline && outline.length >= 2) {
      const chs = outline.map((o, i) => { const e = outline[i + 1] ? Math.max(o.page + 1, outline[i + 1].page) : pages.length; return { title: o.title.slice(0, 40), text: pages.slice(o.page, e).join('\n\n').trim() }; }).filter(c => c.text.length > 20);
      if (chs.length >= 2) return chs;
    }
    return null;
  },
  totalChars(b) { return b.chapters.reduce((a, c) => a + c.text.length, 0); }
};
function bookById(id) { return S.books.find(b => b.id === id); }
/* 导入结果确认 */
function confirmImport({ title, text, pages, outline, source }) {
  const opts = { auto: Books.split(text), outline: pages ? Books.fromPages(pages, outline) : null, single: [{ title: title || '全文', text }] };
  if (pages && pages.length > 1) { const per = Math.max(1, Math.ceil(pages.length / Math.min(20, pages.length))); opts.pages = []; for (let i = 0; i < pages.length; i += per) opts.pages.push({ title: `第 ${i + 1}${per > 1 ? '–' + Math.min(pages.length, i + per) : ''} 页`, text: pages.slice(i, i + per).join('\n\n') }); }
  let mode = opts.outline ? 'outline' : 'auto';
  const labels = { outline: 'PDF 目录', auto: '自动识别章节', pages: '按页分组', single: '不分章' };
  openSheet(`<h2>确认导入</h2>
    <label class="f"><span>教材名称</span><input type="text" id="bT" value="${esc(title)}"></label>
    <label class="f"><span>科目</span><select id="bS">${subjOptions('')}</select></label>
    <label class="f"><span>章节划分方式</span><div class="seg" id="bM">${Object.keys(labels).filter(k => opts[k]).map(k => `<button data-m="${k}" class="${k === mode ? 'on' : ''}">${labels[k]}</button>`).join('')}</div></label>
    <div id="bP"></div>
    <button class="btn block" id="bOk" style="margin-top:12px">导入</button>`, el => {
    const draw = () => { const chs = opts[mode]; $('#bP', el).innerHTML = `<div class="small muted" style="margin:0 4px 6px">共 ${chs.length} 个章节，${text.length.toLocaleString()} 字（导入后可重命名、合并或删除章节）</div><div class="list" style="max-height:34vh;overflow:auto">${chs.slice(0, 200).map(c => `<div class="row" style="min-height:44px"><div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${c.text.length} 字 · ${esc(c.text.slice(0, 40).replace(/\s+/g, ' '))}</div></div></div>`).join('')}</div>`; };
    draw();
    $('#bM', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; $$('#bM button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
    $('#bOk', el).onclick = () => {
      const b = { id: uid(), title: $('#bT', el).value.trim() || '未命名教材', subject: $('#bS', el).value, source, createdAt: Date.now(), chapters: opts[mode].map(c => ({ id: uid(), title: c.title, text: c.text })) };
      S.books.unshift(b); save('books'); closeSheet(); toast('导入成功'); location.hash = '#/learn/book/' + b.id;
    };
  });
}
async function importPdf() {
  const [file] = await pickFile('application/pdf,.pdf'); if (!file) return;
  const ctl = new AbortController(); loading(true, '正在读取 PDF…', ctl);
  try {
    const { pdf, pages, outline } = await Books.readPdf(file, t => $('#loadingText').textContent = t, ctl.signal);
    const empty = pages.map((p, i) => p.replace(/\s/g, '').length < 15 ? i : -1).filter(i => i >= 0);
    loading(false);
    if (empty.length > pages.length * 0.5) {
      const ok = await confirmBox(`这个 PDF 有 ${empty.length}/${pages.length} 页没有可提取的文字（可能是扫描版）。是否用${AI.visionReady() ? ' AI 图片识别' : '本地 OCR（较慢）'}识别这些页面？${empty.length > 30 ? '页数较多，耗时较长，建议先拆分 PDF。' : ''}`, '开始识别', false);
      if (ok) {
        const ctl2 = new AbortController(); loading(true, '准备识别…', ctl2);
        try {
          for (let k = 0; k < empty.length; k++) {
            if (ctl2.signal.aborted) break;
            const i = empty[k]; $('#loadingText').textContent = `正在识别第 ${i + 1} 页（${k + 1}/${empty.length}）…`;
            const img = await Books.renderPage(pdf, i + 1);
            pages[i] = AI.visionReady() ? await AI.ocr(img, { signal: ctl2.signal }) : await Books.tesseract(img, t => $('#loadingText').textContent = `第 ${i + 1} 页 · ` + t);
          }
        } catch (e) { loading(false); if (!(e.kind === 'abort')) showAIError(e); return; }
        loading(false);
      }
    }
    const text = pages.join('\n\n').trim();
    if (!text) return toast('没有识别到任何文字');
    confirmImport({ title: file.name.replace(/\.pdf$/i, ''), text, pages, outline, source: 'pdf' });
  } catch (e) { loading(false); if (e.kind !== 'abort') openSheet(`<h2>PDF 解析失败</h2><div class="notice err">${esc(e.message || e)}</div><p class="small muted">如果 PDF 设置了密码或已损坏，请先在电脑上另存一份再导入。</p><button class="btn block" onclick="closeSheet()">知道了</button>`); }
}
async function importImages(capture) {
  const files = await pickFile('image/*', { multiple: !capture, capture }); if (!files.length) return;
  const useAI = AI.visionReady();
  if (!useAI && !(await confirmBox('未配置 AI 视觉模型，将使用本地 OCR（首次需下载约 20MB 识别模型，速度较慢，准确度一般）。继续吗？\n配置 AI 后识别效果更好。', '继续', false))) return;
  const ctl = new AbortController(); loading(true, '正在处理图片…', ctl); const texts = [];
  try {
    for (let i = 0; i < files.length; i++) {
      $('#loadingText').textContent = `正在识别第 ${i + 1}/${files.length} 张图片…`;
      const img = await compressImage(files[i], 2000, 0.85);
      texts.push(useAI ? await AI.ocr(img, { signal: ctl.signal }) : await Books.tesseract(img, t => $('#loadingText').textContent = `第 ${i + 1}/${files.length} 张 · ` + t));
    }
  } catch (e) { loading(false); if (e.kind !== 'abort') showAIError(e); if (!texts.length) return; }
  loading(false);
  const text = texts.join('\n\n').trim(); if (!text) return toast('没有识别到文字');
  confirmImport({ title: '拍照教材 ' + fmtDate(Date.now()), text, pages: texts.length > 1 ? texts : null, source: 'image' });
}
function importText() {
  openSheet(`<h2>粘贴文本</h2><label class="f"><span>标题</span><input type="text" id="xT" placeholder="如：高一物理 必修一"></label>
    <textarea id="xB" style="min-height:40vh" placeholder="把教材内容粘贴到这里。包含「第一章」「第1节」「Unit 1」或 # 标题的内容会自动划分章节。"></textarea>
    <div class="btns" style="margin-top:10px"><button class="btn plain" id="xF">从文件（.txt/.md）</button><button class="btn" id="xOk">下一步</button></div>`, el => {
    $('#xF', el).onclick = async () => { const [f] = await pickFile('.txt,.md,.markdown,text/plain'); if (f) { $('#xB', el).value = await readFileAs(f); if (!$('#xT', el).value) $('#xT', el).value = f.name.replace(/\.\w+$/, ''); } };
    $('#xOk', el).onclick = () => { const text = $('#xB', el).value.trim(); if (!text) return toast('请先粘贴内容'); confirmImport({ title: $('#xT', el).value.trim() || '文本教材', text, source: 'text' }); };
  });
}
route('/learn/books', 'learn', v => {
  setTop('教材', { back: '#/learn' });
  v.innerHTML = `<div class="grid3" style="margin-bottom:12px">
    <button class="tile" id="iPdf" style="border:0;align-items:center;text-align:center"><div class="ic" style="--c:#ff3b30">${icon('doc', 22)}</div><div class="tt">PDF</div><div class="ts">解析文字</div></button>
    <button class="tile" id="iImg" style="border:0;align-items:center;text-align:center"><div class="ic" style="--c:#34c759">${icon('image', 22)}</div><div class="tt">图片</div><div class="ts">相册/拍照</div></button>
    <button class="tile" id="iTxt" style="border:0;align-items:center;text-align:center"><div class="ic" style="--c:#0a84ff">${icon('notes', 22)}</div><div class="tt">文本</div><div class="ts">粘贴/文件</div></button></div>
    <button class="btn ghost block" id="iCam" style="margin-bottom:12px">${icon('camera', 18)} 直接拍照导入</button>
    ${!AI.visionReady() ? `<div class="notice info">图片和扫描版 PDF 推荐配置 AI 视觉模型识别（<a href="#/me/settings">去设置</a>）；未配置时使用本地 OCR。</div>` : ''}
    <h3>我的教材</h3>
    ${S.books.length ? `<div class="list">${S.books.map(b => `<a class="row" href="#/learn/book/${b.id}"><div class="grow"><div class="t">${esc(b.title)}</div><div class="s">${b.chapters.length} 章节 · ${Books.totalChars(b).toLocaleString()} 字 · ${fmtDate(b.createdAt)}</div></div>${subjChip(b.subject)}<span class="chev">›</span></a>`).join('')}</div>` : `${emptyState('books', '还没有教材', '导入课本 PDF、拍照或粘贴文本，就能按章节阅读、生成卡片和 AI 出卷。')}`}`;
  $('#iPdf').onclick = importPdf; $('#iImg').onclick = () => importImages(false); $('#iCam').onclick = () => importImages(true); $('#iTxt').onclick = importText;
});
route('/learn/book/:id', 'learn', (v, id) => {
  const b = bookById(id); if (!b) { location.hash = '#/learn/books'; return; }
  setTop(b.title, { back: '#/learn/books', actions: `<button class="icon-btn txt" id="bE">编辑</button>` });
  let sel = new Set();
  const draw = () => {
    v.innerHTML = `<div class="card"><div class="chips">${subjChip(b.subject)}<span class="chip">${b.chapters.length} 章节</span><span class="chip">${Books.totalChars(b).toLocaleString()} 字</span><span class="chip">${{ pdf: 'PDF', image: '图片识别', text: '文本' }[b.source] || ''}</span></div>
      <div class="btns" style="margin-top:12px"><a class="btn" href="#/learn/exam/new?book=${b.id}">${icon('exam', 18)} 用这本出试卷</a></div></div>
      <h3>章节 <span class="small" style="font-weight:400">（勾选可合并或删除）</span></h3>
      <div class="list" id="chl">${b.chapters.map((c, i) => `<div class="row" data-id="${c.id}"><button class="check ${sel.has(c.id) ? 'on' : ''}" data-act="sel">${sel.has(c.id) ? '✓' : ''}</button><div class="grow" data-act="open"><div class="t">${i + 1}. ${esc(c.title)}</div><div class="s">${c.text.length} 字 · ${esc(c.text.slice(0, 50).replace(/\s+/g, ' '))}</div></div><span class="chev">›</span></div>`).join('')}</div>
      ${sel.size ? `<div class="btns"><button class="btn ghost" id="mg" ${sel.size < 2 ? 'disabled' : ''}>合并所选（${sel.size}）</button><button class="btn danger" id="dl">删除所选</button></div>` : ''}
      <div class="btns" style="margin-top:10px"><button class="btn plain" id="addc">＋ 添加章节</button></div>`;
    $('#chl').onclick = e => { const r = e.target.closest('[data-id]'); if (!r) return; const act = e.target.closest('[data-act]')?.dataset.act; if (act === 'sel') { sel.has(r.dataset.id) ? sel.delete(r.dataset.id) : sel.add(r.dataset.id); draw(); } else location.hash = `#/learn/book/${b.id}/ch/${r.dataset.id}`; };
    const mg = $('#mg'); if (mg) mg.onclick = () => { const chs = b.chapters.filter(c => sel.has(c.id)); const first = chs[0]; first.text = chs.map((c, i) => (i ? c.title + '\n' : '') + c.text).join('\n\n'); b.chapters = b.chapters.filter(c => c === first || !sel.has(c.id)); sel.clear(); save('books'); draw(); toast('已合并'); };
    const dl = $('#dl'); if (dl) dl.onclick = async () => { if (await confirmBox(`删除所选 ${sel.size} 个章节？`, '删除')) { b.chapters = b.chapters.filter(c => !sel.has(c.id)); sel.clear(); save('books'); draw(); } };
    $('#addc').onclick = () => { const c = { id: uid(), title: '新章节', text: '' }; b.chapters.push(c); save('books'); location.hash = `#/learn/book/${b.id}/ch/${c.id}?edit=1`; };
  };
  draw();
  $('#bE').onclick = () => openSheet(`<h2>编辑教材</h2><label class="f"><span>名称</span><input type="text" id="eT" value="${esc(b.title)}"></label><label class="f"><span>科目</span><select id="eS">${subjOptions(b.subject)}</select></label><div class="btns"><button class="btn danger" id="eD">删除教材</button><button class="btn" id="eOk">保存</button></div>`, el => {
    $('#eOk', el).onclick = () => { b.title = $('#eT', el).value.trim() || b.title; b.subject = $('#eS', el).value; save('books'); closeSheet(); rerender(); };
    $('#eD', el).onclick = async () => { if (await confirmBox(`删除教材「${b.title}」？`, '删除')) { S.books = S.books.filter(x => x !== b); save('books'); location.hash = '#/learn/books'; } };
  });
});
route('/learn/book/:id/ch/:cid', 'learn', (v, id, cid) => {
  const b = bookById(id); const c = b?.chapters.find(x => x.id === cid);
  if (!c) { location.hash = '#/learn/book/' + id; return; }
  let editing = Q.get('edit') === '1';
  const draw = () => {
    setTop(c.title, { back: '#/learn/book/' + id, actions: `<button class="icon-btn txt" id="tg">${editing ? '完成' : '编辑'}</button>` });
    $('#tg').onclick = () => { if (editing) { c.title = $('#cT').value.trim() || c.title; c.text = $('#cX').value; save('books'); } editing = !editing; draw(); };
    const i = b.chapters.indexOf(c);
    v.innerHTML = editing ? `<label class="f"><span>章节标题</span><input type="text" id="cT" value="${esc(c.title)}"></label><textarea id="cX" style="min-height:62vh">${esc(c.text)}</textarea>`
      : `<div class="btns" style="margin-bottom:12px"><a class="btn" href="#/learn/exam/new?book=${b.id}&ch=${c.id}">${icon('exam', 18)} 本章出卷</a><button class="btn ghost" id="mkc">🃏 AI 生成卡片</button></div>
        <div class="card"><div class="pre" style="font-size:16px;line-height:1.75">${esc(c.text) || '<span class="muted">（空）</span>'}</div></div>
        <div class="btns">${i > 0 ? `<a class="btn plain" href="#/learn/book/${b.id}/ch/${b.chapters[i - 1].id}">‹ 上一章</a>` : ''}${i < b.chapters.length - 1 ? `<a class="btn plain" href="#/learn/book/${b.id}/ch/${b.chapters[i + 1].id}">下一章 ›</a>` : ''}</div>`;
    const mk = $('#mkc'); if (mk) mk.onclick = () => aiCardsFromText(c.title, c.text, b.subject);
  };
  draw();
  return () => { if (editing && $('#cX')) { c.title = $('#cT').value.trim() || c.title; c.text = $('#cX').value; save('books'); } };
});
async function aiCardsFromText(title, text, subject) {
  if (!AI.ready()) return showAIError(new AIError('AI 生成卡片需要先配置 AI。请到「我的 → 设置 → AI 设置」填写。', 'config'));
  openSheet(`<h2>AI 生成卡片</h2><label class="f"><span>数量</span><input type="number" id="n" value="15" inputmode="numeric"></label><label class="f"><span>加入卡组</span><select id="dk">${S.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}<option value="__new" selected>＋ 新建「${esc(title.slice(0, 20))}」</option></select></label><button class="btn block" id="go">生成</button>`, el => {
    $('#go', el).onclick = async () => {
      const n = Math.min(50, Math.max(1, +$('#n', el).value || 15)); let did = $('#dk', el).value; closeSheet();
      try {
        const res = await withLoading('AI 正在提炼知识点…', sig => AI.json([
          { role: 'system', content: '你是一名优秀的教师，擅长把教材内容提炼成便于记忆的问答卡片。只输出 JSON。' },
          { role: 'user', content: `根据下面的教材内容，提炼 ${n} 张最重要的知识点问答卡片（概念、定义、公式、结论、关键事实等）。正面是简洁的问题，背面是准确、简短的答案。\n输出格式：{"cards":[{"front":"问题","back":"答案"}]}\n\n教材内容：\n${text.slice(0, S.settings.ai.maxChars)}` }
        ], o => { if (!Array.isArray(o.cards)) throw new Error('缺少 cards 数组'); const cs = o.cards.filter(c => c && c.front && c.back).map(c => [String(c.front), String(c.back)]); if (!cs.length) throw new Error('cards 为空'); return cs; }, { signal: sig }));
        if (did === '__new') { const d = { id: uid(), name: title.slice(0, 30), subject: subject || '', createdAt: Date.now() }; S.decks.push(d); save('decks'); did = d.id; }
        res.forEach(([f, b]) => S.cards.push(Cards.newCard(did, f, b))); save('cards');
        toast(`已生成 ${res.length} 张卡片`); location.hash = '#/learn/deck/' + did;
      } catch (e) { showAIError(e); }
    };
  });
}
