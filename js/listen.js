'use strict';
/* ========== 影视精听：导入自己的视频 / 音频 + 英文字幕，逐句精听 · 盲听 · 听写 ==========
   隐私与版权：网站不带任何媒体或字幕。导入的文件只存在本设备 IndexedDB（clipMedia:<id> 存文件本体，clips 存字幕与进度），
   不上传、不发送。字幕文本一律 esc() 后渲染。查词先用本地四级词表；只有配置了 AI 才可选「AI 释义」，且只发送这个词和这一句字幕。 */
const LS = {
  clips: null, dict: null,
  async all() { if (!this.clips) { const a = await DB.get('clips'); this.clips = Array.isArray(a) ? a : []; } return this.clips; },
  byId(id) { return (this.clips || []).find(c => c.id === id); },
  saveMeta() { return DB.set('clips', this.clips); },
  fmtSize(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; },
  fmtT(s) { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; },
  MIME: { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', caf: 'audio/x-caf' },
  ext: f => (String(f.name || '').match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '',
  kindOf(f) { const t = f.type || '', x = this.ext(f); if (t.startsWith('video/')) return 'video'; if (t.startsWith('audio/')) return 'audio'; const m = this.MIME[x]; return m ? m.split('/')[0] : ''; },
  mimeOf(f) { return (/^(video|audio)\//.test(f.type) && f.type) || this.MIME[this.ext(f)] || 'video/mp4'; },
  /* ---- 字幕解析：SRT / VTT，容忍 BOM、CRLF、<i> 等标签、ASS {\an8}、缺空行、中英双语 ---- */
  parseTime(s) { const p = s.trim().replace(',', '.').split(':').map(Number); if (p.some(x => !Number.isFinite(x))) return NaN; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; },
  clean(t) { return t.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\\N/g, ' ').replace(/\s+/g, ' ').trim(); },
  parseSubs(text) {
    const TL = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,.]\d{1,3})/;
    const lines = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const cues = []; let cur = null;
    for (const raw of lines) {
      const m = raw.match(TL);
      if (m) {
        if (cur && /^\d+$/.test(cur.en[cur.en.length - 1] || '')) cur.en.pop(); // 缺空行时，序号会粘到上一句
        const s = this.parseTime(m[1]), e = this.parseTime(m[2]);
        cur = Number.isFinite(s) && Number.isFinite(e) && e > s ? { s, e, en: [], zh: [] } : null; if (cur) cues.push(cur); continue;
      }
      if (!raw.trim()) { cur = null; continue; }
      if (!cur) continue;
      const t = this.clean(raw); if (t) (/[\u3400-\u9fff]/.test(t) ? cur.zh : cur.en).push(t);
    }
    const r2 = x => Math.round(x * 1000) / 1000;
    return cues.map(c => ({ s: r2(c.s), e: r2(c.e), t: c.en.join(' ').slice(0, 500), zh: c.zh.join(' ').slice(0, 300) }))
      .filter(c => c.t || c.zh).map(c => c.t ? c : { ...c, t: c.zh, zh: '' }).sort((a, b) => a.s - b.s).slice(0, 6000);
  },
  async readSubs(f) {
    if (f.size > 5 * 1024 * 1024) throw new Error('字幕文件太大');
    const cues = this.parseSubs(await readFileAs(f));
    if (!cues.length) throw new Error('没有读到字幕（需要 .srt 或 .vtt 格式）');
    return cues;
  },
  async space() { try { const e = await navigator.storage?.estimate?.(); return e && e.quota ? Math.max(0, e.quota - (e.usage || 0)) : null; } catch (e) { return null; } },
  quotaErr: e => e && (e.name === 'QuotaExceededError' || /quota|space|full/i.test(e.message || '')),
  /* ---- 本地查词：四级词表（含简单词形还原） ---- */
  async lookup(w) {
    if (!this.dict) { try { const r = await fetch('data/cet4.json'); const j = await r.json(); this.dict = new Map(j.w.filter(x => Array.isArray(x)).map(x => [String(x[0]).toLowerCase(), String(x[1] || '')])); } catch (e) { this.dict = new Map(); } }
    const k = w.toLowerCase().replace(/[’‘]/g, "'").replace(/'s$/, '');
    const cands = [k, k.replace(/s$/, ''), k.replace(/es$/, ''), k.replace(/ies$/, 'y'), k.replace(/ed$/, ''), k.replace(/ed$/, 'e'), k.replace(/ied$/, 'y'), k.replace(/ing$/, ''), k.replace(/ing$/, 'e'), k.replace(/(.)\1(ed|ing)$/, '$1'), k.replace(/ly$/, '')];
    for (const c of cands) if (c && this.dict.has(c)) return { word: c, mean: this.dict.get(c) };
    return null;
  },
  deck() {
    let d = S.decks.find(x => x.preset === 'listen-words');
    if (!d) { d = { id: uid(), name: '影视生词', subject: 'english', createdAt: Date.now(), preset: 'listen-words' }; S.decks.push(d); save('decks'); }
    return d;
  },
  /* ---- 听写对照：按词 LCS ---- */
  norm: w => w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, ''),
  diff(ref, got) {
    const A = ref.split(/\s+/).map(raw => ({ raw, n: this.norm(raw) })).filter(x => x.n), B = got.split(/\s+/).map(raw => ({ raw, n: this.norm(raw) })).filter(x => x.n);
    const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i].n === B[j].n ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ra = A.map(() => false), rb = B.map(() => false);
    for (let i = 0, j = 0; i < n && j < m;) { if (A[i].n === B[j].n) { ra[i] = rb[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return { A, B, ra, rb, ok: L[0][0], total: n };
  },
  async importSheet() {
    const st = { f: null, cues: null, subName: '' };
    openSheet(`<h2>导入片段</h2><p class="small muted" style="margin-top:-4px">文件只保存在这台设备上，不会上传。建议一起导入英文字幕（.srt / .vtt），才能逐句精听。</p>
      <div class="list"><button class="row" id="lmPick">${iconTile('play', '#0ea5e9', 18)}<div class="grow"><div class="t">选择视频或音频</div><div class="s" id="lmInfo">mp4 / mov / m4a / mp3</div></div><span class="chev">›</span></button>
      <button class="row" id="lsPick">${iconTile('doc', '#8b5cf6', 18)}<div class="grow"><div class="t">选择字幕（可选）</div><div class="s" id="lsInfo">.srt / .vtt，中英双语也可以</div></div><span class="chev">›</span></button></div>
      <div id="lmWarn" class="small" style="margin:8px 2px"></div>
      <label class="f"><span>名称</span><input type="text" id="lmName" maxlength="60" placeholder="例如：老友记 S01E01 片段"></label>
      <button class="btn block" id="lmOk" disabled>保存到本机</button>`, el => {
      const warn = (h, bad) => { const w = $('#lmWarn', el); w.innerHTML = h; w.style.color = bad ? 'var(--bad)' : 'var(--sub)'; };
      $('#lmPick', el).onclick = async () => {
        const [f] = await pickFile('video/*,audio/*,.mp4,.m4v,.mov,.m4a,.mp3,.aac,.wav,application/octet-stream'); if (!f) return;
        const kind = this.kindOf(f); if (!kind) { warn('这不是视频或音频文件', true); return; }
        st.f = f; st.kind = kind; st.mime = this.mimeOf(f);
        $('#lmInfo', el).textContent = `${f.name.slice(0, 40)} · ${this.fmtSize(f.size)}`;
        if (!$('#lmName', el).value) $('#lmName', el).value = f.name.replace(/\.[^.]+$/, '').slice(0, 60);
        const can = document.createElement(kind).canPlayType(st.mime); const free = await this.space(); const msgs = [];
        if (!can) msgs.push('这台设备可能播放不了这个格式（iPhone 推荐 mp4 / mov / m4a / mp3）。');
        if (free != null && f.size > free * 0.9) msgs.push(`可用空间约 ${this.fmtSize(free)}，可能存不下，建议先剪成短片段。`);
        else if (f.size > 500 * 1048576) msgs.push('文件较大（超过 500 MB），保存会比较慢，也很占手机空间；建议剪成几分钟的片段。');
        warn(esc(msgs.join(' ')), msgs.length && (!can || (free != null && f.size > free * 0.9)));
        $('#lmOk', el).disabled = false;
      };
      $('#lsPick', el).onclick = async () => {
        const [f] = await pickFile('.srt,.vtt,text/vtt,text/plain,application/x-subrip,application/octet-stream'); if (!f) return;
        try { st.cues = await this.readSubs(f); st.subName = f.name.slice(0, 60); $('#lsInfo', el).textContent = `${f.name.slice(0, 40)} · ${st.cues.length} 句`; }
        catch (e) { st.cues = null; $('#lsInfo', el).textContent = e.message; }
      };
      $('#lmOk', el).onclick = async () => {
        if (!st.f) return; const b = $('#lmOk', el); b.disabled = true; b.textContent = '保存中…';
        const id = uid();
        try { navigator.storage?.persist?.().catch(() => { }); } catch (e) { }
        try { await DB.set('clipMedia:' + id, st.f.slice(0, st.f.size, st.mime)); }
        catch (e) { b.disabled = false; b.textContent = '保存到本机'; warn(esc(this.quotaErr(e) ? '手机存储空间不够，保存失败。可以先清理空间，或把视频剪短后再导入。' : '保存失败：' + (e.message || e.name)), true); return; }
        const clips = await this.all();
        clips.unshift({ id, title: ($('#lmName', el).value.trim() || '未命名片段').slice(0, 60), kind: st.kind, mime: st.mime, size: st.f.size, createdAt: Date.now(), cues: st.cues || [], subName: st.subName, pos: 0, t: 0, mode: 'blind', ap: true, rate: 1 });
        try { await this.saveMeta(); } catch (e) { clips.shift(); await DB.del('clipMedia:' + id).catch(() => { }); warn('保存失败：存储空间不足', true); b.disabled = false; b.textContent = '保存到本机'; return; }
        closeSheet(); toast(st.cues ? `已导入 · ${st.cues.length} 句字幕` : '已导入（没有字幕）'); location.hash = '#/learn/listen/' + id;
      };
    });
  },
  subsSheet(c, done) {
    openSheet(`<h2>片段设置</h2><div class="list"><button class="row" id="lsRep">${iconTile('doc', '#8b5cf6', 18)}<div class="grow"><div class="t">${c.cues.length ? '替换字幕' : '添加字幕'}</div><div class="s">${c.subName ? esc(c.subName) : '.srt / .vtt'}</div></div></button>
      <button class="row" id="lsDel" style="color:var(--bad)">${iconTile('trash', '#ef4444', 18)}<div class="grow"><div class="t">删除这个片段</div><div class="s">释放 ${this.fmtSize(c.size)}</div></div></button></div>`, el => {
      $('#lsRep', el).onclick = async () => {
        const [f] = await pickFile('.srt,.vtt,text/vtt,text/plain,application/x-subrip,application/octet-stream'); if (!f) return;
        try { c.cues = await this.readSubs(f); c.subName = f.name.slice(0, 60); c.pos = 0; await this.saveMeta(); closeSheet(); toast(`已载入 ${c.cues.length} 句字幕`); done(); } catch (e) { toast(e.message || '字幕读取失败'); }
      };
      $('#lsDel', el).onclick = async () => {
        if (!(await confirmBox(`删除「${c.title}」？视频和字幕会从这台设备上删除。`, '删除'))) return;
        await DB.del('clipMedia:' + c.id).catch(() => { }); this.clips = this.clips.filter(x => x !== c); await this.saveMeta(); toast('已删除'); location.hash = '#/learn/listen';
      };
    });
  },
  wordSheet(word, sentence) {
    openSheet(`<h2>${esc(word)}</h2><div class="small muted lw-ctx">${esc(sentence)}</div>
      <label class="f"><span>释义</span><textarea id="wm" style="min-height:70px" placeholder="正在查本地词表…"></textarea></label>
      <div id="wTip" class="small muted" style="margin:-4px 2px 10px"></div>
      ${AI.ready() ? '<button class="btn plain block" id="wAi" style="margin-bottom:10px">AI 释义（只发送这个词和这一句）</button>' : ''}
      <button class="btn block" id="wAdd">加入「影视生词」卡组</button>`, async el => {
      const hit = await this.lookup(word); const ta = $('#wm', el); ta.placeholder = '手动填写释义（可留空）';
      if (hit && !ta.value) { ta.value = hit.mean; $('#wTip', el).textContent = `四级词表：${hit.word}`; }
      else if (!hit) $('#wTip', el).textContent = AI.ready() ? '四级词表里没有这个词，可以用 AI 查。' : '四级词表里没有这个词，可以手动填写；配置 AI 后可一键查询。';
      const ai = $('#wAi', el);
      if (ai) ai.onclick = async () => {
        ai.disabled = true; ai.textContent = '查询中…';
        try { const r = await AI.chat([{ role: 'system', content: '你是英汉词典。用简体中文给出该单词在这句话里的意思，格式“词性. 释义”，不超过 30 字，只输出释义。' }, { role: 'user', content: `单词：${word}\n句子：${sentence.slice(0, 300)}` }], { temperature: 0.2, maxTokens: 80 }); ta.value = String(r || '').trim().slice(0, 120); }
        catch (e) { toast(e.message || 'AI 查询失败'); }
        ai.disabled = false; ai.textContent = 'AI 释义（只发送这个词和这一句）';
      };
      $('#wAdd', el).onclick = () => {
        const d = this.deck(); const front = word.replace(/’/g, "'").toLowerCase().slice(0, 40);
        if (S.cards.some(c => c.deckId === d.id && c.front.toLowerCase() === front)) { toast('这个词已经在「影视生词」里了'); closeSheet(); return; }
        const back = (ta.value.trim().slice(0, 200) || '（未填写释义）') + `\n\n*${sentence.replace(/[*_`#\\]/g, ' ').slice(0, 200)}*`;
        S.cards.push(Cards.newCard(d.id, front, back)); save('cards'); closeSheet(); toast(`已加入「影视生词」· 共 ${S.cards.filter(c => c.deckId === d.id).length} 词`);
      };
    });
  },
  /* ---- 难句本：听不懂的句子，按 1 / 3 / 7 天间隔复习（只存在本机） ---- */
  DAYS: [1, 3, 7],
  async hard() { if (!this._hard) { const a = await DB.get('hardSents'); this._hard = Array.isArray(a) ? a.filter(h => h && typeof h.t === 'string') : []; } return this._hard; },
  saveHard() { return DB.set('hardSents', this._hard || []); },
  day0(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); },
  isDue: h => !h.done && h.due <= Date.now(),
  hardOf(c, i) { const q = c.cues[i]; return q && (this._hard || []).find(h => h.clipId === c.id && Math.abs(h.s - q.s) < 0.05 && !h.done); },
  async addHard(c, i, src) {
    const q = c.cues[i]; if (!q) return false; await this.hard(); if (this.hardOf(c, i)) return false;
    this._hard.unshift({ id: uid(), clipId: c.id, clip: String(c.title || '').slice(0, 80), s: q.s, e: q.e, t: String(q.t).slice(0, 500), zh: String(q.zh || '').slice(0, 300), src, addedAt: Date.now(), step: 0, due: this.day0() + 86400000 });
    if (this._hard.length > 3000) this._hard.length = 3000; await this.saveHard(); return true;
  },
  async dropHard(id) { await this.hard(); this._hard = this._hard.filter(h => h.id !== id); await this.saveHard(); },
  grade(h, ok) {
    if (ok) { h.step = (h.step || 0) + 1; if (h.step >= this.DAYS.length) { h.done = true; h.doneAt = Date.now(); } else h.due = this.day0() + this.DAYS[h.step] * 86400000; }
    else { h.step = 0; h.due = this.day0() + 86400000; }
    h.last = Date.now(); return this.saveHard();
  },
  nextTxt(h) { if (h.done) return '已掌握'; const d = Math.round((this.day0(h.due) - this.day0()) / 86400000); return d <= 0 ? '今天复习' : d === 1 ? '明天复习' : `${d} 天后复习`; },
  /* ---- 影子跟读：录音只放在内存里，离开页面就丢弃，不上传 ---- */
  recMime() { if (typeof MediaRecorder === 'undefined') return null; const L = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']; for (const m of L) try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { } return ''; },
  micErr(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return '麦克风权限被拒绝了。想跟读的话：iPhone「设置 › Safari › 麦克风」改成「询问」或「允许」，再回到这页点「开始跟读」。';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return '没有找到可用的麦克风。';
    if (n === 'NotReadableError') return '麦克风正被其他应用占用（比如通话中），稍后再试。';
    return '没能打开麦克风：' + String(e && e.message || n || '未知错误').slice(0, 80);
  },
  /* ---- AI 讲讲这句：只发送这一句字幕文本 ---- */
  async explainSentence(box, text, onWord) {
    const k = 's:' + AX.hash(text);
    const render = full => { const m = full.match(/\n?\s*KEYWORDS\s*[:：]\s*(.+)\s*$/i); const body = m ? full.slice(0, m.index) : full.replace(/\n?\s*KEYW[\s\S]*$/i, '');
      const kw = m ? [...new Set(m[1].split(/[,，|、;；]/).map(x => x.trim().replace(/[^A-Za-z' -]/g, '').trim()).filter(x => x && x.length <= 30))].slice(0, 8) : [];
      return `<div class="md">${md(body)}</div>${kw.length ? `<div class="small muted" style="margin:10px 0 6px">重点词 · 点一下加入背卡片</div><div class="lp-kw">${kw.map(w => `<button class="chip lp-kwb" data-kw="${esc(w)}">${esc(w)} ＋</button>`).join('')}</div>` : ''}`; };
    box.onclick = e => { const b = e.target.closest('[data-kw]'); if (b) onWord(b.dataset.kw); };
    return AX.run(box, k, [{ role: 'system', content: AX.PERSONA + '\n你在帮学生精听一句英文影视台词。按下面格式用简体中文讲解，简洁，每部分 1–3 行：\n**意思**：自然的中文意思\n**句子结构**：主干与语法点\n**连读弱读**：这句话在口语里哪些词会连读、弱读、吞音（用 / 标出，如 doin\' → /ˈduːɪn/）\n**地道用法**：口语习惯或俚语\n最后单独一行输出：KEYWORDS: 词1, 词2, 词3（2–5 个值得背的英文单词或短语，原形）' }, { role: 'user', content: '台词：' + String(text).slice(0, 400) }], { render, maxTokens: 700 });
  }
};

route('/learn/listen', 'learn', v => {
  setTop('影视精听', { back: '#/learn' });
  Promise.all([LS.all(), LS.hard()]).then(([clips, hard]) => {
    if (!v.isConnected) return;
    const live = hard.filter(h => !h.done), due = live.filter(LS.isDue).length;
    const hardRow = `<div class="list" style="margin-bottom:12px">${live.length ? `<a class="row" href="#/learn/listen-hard" id="lnHard">${iconTile('target', '#f43f5e', 18)}<div class="grow"><div class="t">难句本</div><div class="s">${due ? `<b class="lh-due">${due} 句待复习</b> · ` : ''}共 ${live.length} 句</div></div><span class="chev">›</span></a>` : ''}<a class="row" href="#/learn/tvclips">${iconTile('play', '#f59e0b', 18)}<div class="grow"><div class="t">美剧片段</div><div class="s">${TvClips.sub()}</div></div><span class="chev">›</span></a></div>`;
    if (!clips.length) {
      v.innerHTML = hardRow + emptyState('play', '还没有导入片段', '导入自己的美剧、电影或动画片段和英文字幕，一句一句练听力。文件只存在这台设备上。', '<button class="btn" id="lnImp">导入视频 / 音频</button>');
      $('#lnImp', v).onclick = () => LS.importSheet(); return;
    }
    $('#topActions').innerHTML = '<button class="icon-btn txt" id="lnAdd" aria-label="导入">＋</button>'; $('#lnAdd').onclick = () => LS.importSheet();
    const total = clips.reduce((a, c) => a + (c.size || 0), 0);
    v.innerHTML = hardRow + `<div class="list">${clips.map(c => `<a class="row" href="#/learn/listen/${esc(c.id)}">${iconTile(c.kind === 'audio' ? 'speaker' : 'play', c.kind === 'audio' ? '#8b5cf6' : '#0ea5e9', 18)}<div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${c.cues.length ? `${c.cues.length} 句 · 听到第 ${Math.min(c.cues.length, (c.pos || 0) + 1)} 句` : '没有字幕'} · ${LS.fmtSize(c.size)}</div></div><span class="chev">›</span></a>`).join('')}</div>
      <p class="small muted" style="margin:10px 4px">共占用约 ${LS.fmtSize(total)}，只保存在这台设备上。点片段右上角「⋯」可替换字幕或删除。</p>`;
  }).catch(e => { if (v.isConnected) v.innerHTML = `<div class="notice err">读取失败：${esc(e.message || '')}</div>`; });
});

route('/learn/listen/:id', 'learn', (v, id) => {
  const st = { dead: false, url: '', raf: 0, cur: 0, stopped: -1, shown: new Set(), dict: false, saveT: 0, sh: false, recs: new Map(), rec: null, after: null, exFor: -1 };
  setTop('影视精听', { back: '#/learn/listen', actions: '<button class="icon-btn txt" id="lpMore" aria-label="设置">⋯</button>' });
  (async () => {
    await LS.all(); await LS.hard(); const c = LS.byId(id); if (!c) { location.hash = '#/learn/listen'; return; }
    const blob = await DB.get('clipMedia:' + id); if (st.dead) return;
    $('#lpMore').onclick = () => LS.subsSheet(c, () => rerender());
    if (!blob) { v.innerHTML = emptyState('play', '媒体文件不见了', '可能被系统清理了存储空间，请重新导入。', '<a class="btn" href="#/learn/listen">返回</a>'); return; }
    st.url = URL.createObjectURL(blob);
    const cues = c.cues; const has = cues.length > 0; st.cur = Math.min(c.pos || 0, Math.max(0, cues.length - 1));
    const tag = c.kind === 'audio' ? 'audio' : 'video';
    v.innerHTML = `<div class="lp-media ${tag}"><${tag} id="lpM" playsinline webkit-playsinline controls preload="auto"></${tag}></div>
      <div id="lpErr"></div>
      ${has ? `<div class="card lp-cur"><div class="lp-meta small muted"><span id="lpIdx"></span><span id="lpTm"></span></div><div class="lp-text" id="lpText"></div><div class="lp-zh small muted" id="lpZh"></div><button class="lp-ex" id="lpEx">${icon('sparkle', 15)} 讲讲这句</button><div id="lpExBox"></div></div>
      <div class="lp-ctl"><button class="btn plain" id="lpPrev">‹ 上一句</button><button class="btn" id="lpRe">${icon('repeat', 18)} 重听</button><button class="btn plain" id="lpNext">下一句 ›</button></div>
      <div class="lp-opts"><div class="seg lp-seg" id="lpMode"><button data-m="blind">遮住</button><button data-m="en">英文</button></div>
        <button class="chip lp-chip" id="lpSpd"></button><button class="chip lp-chip" id="lpAP"></button><button class="chip lp-chip" id="lpDict">听写</button>
        <button class="chip lp-chip" id="lpHard"></button><button class="chip lp-chip" id="lpSh">跟读</button></div>
      <div id="lpDictBox"></div><div id="lpShBox"></div>
      <h3 class="lp-h">全部字幕 · ${cues.length} 句</h3><div class="list lp-list" id="lpList"></div>`
      : `<div class="notice small">没有字幕时只能整段播放。点右上角「⋯」添加 .srt / .vtt 英文字幕，就能逐句精听、盲听和听写。</div>`}`;
    const M = $('#lpM', v); M.src = st.url; M.playbackRate = c.rate || 1; M.defaultPlaybackRate = c.rate || 1;
    M.onerror = () => { $('#lpErr', v).innerHTML = '<div class="notice err small">这台设备播放不了这个文件。iPhone 上建议用 mp4（H.264）、mov、m4a 或 mp3。</div>'; };
    M.addEventListener('loadedmetadata', () => { if (has && cues[st.cur]) M.currentTime = cues[st.cur].s; else if (c.t) M.currentTime = c.t; }, { once: true });
    const persist = () => { clearTimeout(st.saveT); st.saveT = setTimeout(() => { c.pos = st.cur; c.t = M.currentTime || 0; LS.saveMeta().catch(() => { }); }, 1200); };
    if (!has) { M.ontimeupdate = () => { c.t = M.currentTime; persist(); }; st.persist = () => { c.t = M.currentTime || 0; LS.saveMeta().catch(() => { }); }; return; }
    st.persist = () => { c.pos = st.cur; c.t = M.currentTime || 0; LS.saveMeta().catch(() => { }); };
    const visible = i => c.mode === 'en' || st.shown.has(i);
    const words = t => String(t).split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/).map((p, k) => k % 2 ? `<span class="lw" data-w="${esc(p)}">${esc(p)}</span>` : esc(p)).join('');
    const cueAt = t => { let lo = 0, hi = cues.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].s <= t + 0.02) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
    const drawCur = () => {
      const q = cues[st.cur]; if (!q) return; const vis = visible(st.cur);
      $('#lpIdx', v).textContent = `第 ${st.cur + 1} / ${cues.length} 句`; $('#lpTm', v).textContent = `${LS.fmtT(q.s)} – ${LS.fmtT(q.e)}`;
      const tx = $('#lpText', v); tx.classList.toggle('masked', !vis);
      tx.innerHTML = vis ? words(q.t) : '<span class="lp-mask">点按显示字幕</span>';
      $('#lpZh', v).textContent = vis && q.zh ? q.zh : '';
      $$('.lp-row.cur', v).forEach(r => r.classList.remove('cur'));
      const row = $(`.lp-row[data-i="${st.cur}"]`, v); if (row) { row.classList.add('cur'); const tl = row.querySelector('.lp-rt'); if (tl && vis) tl.textContent = q.t; }
      if (!st.dict) $('#lpDictBox', v).innerHTML = '';
      if (st.exFor !== st.cur) { $('#lpExBox', v).innerHTML = ''; st.exFor = -1; }
      drawHard(); if (st.sh && st.shFor !== st.cur) drawSh();
    };
    const drawHard = () => { const on = !!LS.hardOf(c, st.cur); const b = $('#lpHard', v); b.classList.toggle('on', on); b.textContent = on ? '已在难句本' : '听不懂'; };
    const drawList = () => { $('#lpList', v).innerHTML = cues.map((q, i) => `<button class="row lp-row ${i === st.cur ? 'cur' : ''}" data-i="${i}"><span class="lp-tm num">${LS.fmtT(q.s)}</span><span class="grow lp-rt">${visible(i) ? esc(q.t) : '· · · · · ·'}</span></button>`).join(''); };
    const drawOpts = () => {
      $$('#lpMode button', v).forEach(b => b.classList.toggle('on', b.dataset.m === c.mode));
      $('#lpSpd', v).textContent = (c.rate || 1) === 1 ? '速度 1×' : '速度 0.75×'; $('#lpAP', v).textContent = c.ap ? '句末暂停 · 开' : '句末暂停 · 关'; $('#lpAP', v).classList.toggle('on', !!c.ap);
      $('#lpDict', v).classList.toggle('on', st.dict); $('#lpSh', v).classList.toggle('on', st.sh);
    };
    /* ---- 影子跟读 ---- */
    const stopRec = () => { const r = st.rec; if (!r) return; st.rec = null; clearInterval(r.iv); clearTimeout(r.to); try { if (r.mr.state !== 'inactive') r.mr.stop(); } catch (e) { } r.stream.getTracks().forEach(t => t.stop()); };
    const drawSh = () => {
      const box = $('#lpShBox', v); if (!st.sh) { box.innerHTML = ''; st.shFor = -1; return; } st.shFor = st.cur;
      const mine = st.recs.get(st.cur);
      box.innerHTML = `<div class="card lp-sh"><div class="small muted" id="lpShSt">${mine ? `录好了 · ${mine.dur.toFixed(1)} 秒` : '先听一遍原句，再点下面的按钮跟着说。录音只留在这台手机的内存里，离开页面就删除。'}</div>
        <button class="btn block lp-rec" id="lpRec">${icon('mic', 18)} ${mine ? '重新跟读' : '开始跟读'}</button>
        ${mine ? '<div class="lp-ctl2"><button class="btn plain" id="lpCmp">▶ 原句 → 我的</button><button class="btn plain" id="lpMine">只听我的</button></div>' : ''}<audio id="lpRA" preload="auto" playsinline></audio></div>`;
      const A = $('#lpRA', v); if (mine) A.src = mine.url;
      $('#lpRec', v).onclick = () => st.rec ? stopRec() : startRec();
      const cmp = $('#lpCmp', v); if (cmp) cmp.onclick = () => { A.pause(); A.currentTime = 0; A.play().then(() => { if (st.after) A.pause(); }).catch(() => { }); st.after = () => { A.currentTime = 0; A.play().catch(() => { }); }; play(st.cur, true); };
      const mn = $('#lpMine', v); if (mn) mn.onclick = () => { M.pause(); st.after = null; A.currentTime = 0; A.play().catch(() => { }); };
    };
    const startRec = async () => {
      const stEl = () => $('#lpShSt', v); const mime = LS.recMime();
      if (!navigator.mediaDevices?.getUserMedia || mime === null) { stEl().innerHTML = '<span class="err-t">这个浏览器不支持录音（iPhone 需要 iOS 14.3 以上的 Safari）。</span>'; return; }
      M.pause(); const idx = st.cur; const btn = $('#lpRec', v); btn.disabled = true;
      let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { btn.disabled = false; if (st.dead) return; stEl().innerHTML = `<span class="err-t">${esc(LS.micErr(e))}</span>`; return; }
      if (st.dead || !st.sh || st.cur !== idx) { stream.getTracks().forEach(t => t.stop()); return; }
      let mr; try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); btn.disabled = false; stEl().innerHTML = '<span class="err-t">这个浏览器不支持录音。</span>'; return; }
      const chunks = []; const t0 = Date.now(); const q = cues[idx];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        if (st.dead) return; const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/mp4' }); const dur = (Date.now() - t0) / 1000;
        if (!blob.size) { if (st.cur === idx) { drawSh(); stEl().textContent = '没有录到声音，再试一次？'; } return; }
        const old = st.recs.get(idx); if (old) URL.revokeObjectURL(old.url);
        st.recs.set(idx, { url: URL.createObjectURL(blob), dur, size: blob.size }); if (st.cur === idx && st.sh) drawSh();
      };
      const max = Math.min(30, Math.max(4, (q.e - q.s) * 2 + 3));
      st.rec = { mr, stream, iv: setInterval(() => { const el = stEl(); if (el) el.textContent = `● 正在录音 ${((Date.now() - t0) / 1000).toFixed(1)} 秒 · 说完点「停止」`; }, 200), to: setTimeout(stopRec, max * 1000) };
      mr.start(); btn.disabled = false; btn.classList.add('rec'); btn.innerHTML = `${icon('mic', 18)} 停止`; stEl().textContent = '● 正在录音…';
    };
    const play = (i, keepAfter) => { if (i < 0 || i >= cues.length) return; if (!keepAfter) st.after = null; if (st.rec) stopRec(); const ch = i !== st.cur; st.cur = i; st.stopped = -1; if (ch) st.dictDone = false; M.currentTime = cues[i].s; const p = M.play(); if (p) p.catch(() => { }); drawCur(); if (st.dict && ch) drawDict(); persist(); };
    const drawDict = () => {
      if (!st.dict) { $('#lpDictBox', v).innerHTML = ''; return; }
      $('#lpDictBox', v).innerHTML = `<div class="card lp-dict"><textarea id="lpIn" placeholder="听到什么就写什么（不分大小写和标点）" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><button class="btn block" id="lpChk">对照答案</button><div id="lpRes"></div></div>`;
      $('#lpChk', v).onclick = () => {
        const got = $('#lpIn', v).value; if (!got.trim()) return toast('先写下你听到的');
        const q = cues[st.cur]; const d = LS.diff(q.t, got); const pct = d.total ? Math.round(d.ok / d.total * 100) : 0;
        $('#lpRes', v).innerHTML = `<div class="lp-score"><b class="num">${pct}%</b> <span class="small muted">听对 ${d.ok} / ${d.total} 个词</span></div>
          <div class="lp-diff"><div class="small muted">原句</div>${d.A.map((w, i) => `<span class="${d.ra[i] ? 'ok' : 'miss'}">${esc(w.raw)}</span>`).join(' ')}</div>
          <div class="lp-diff"><div class="small muted">你写的</div>${d.B.map((w, i) => d.rb[i] ? `<span>${esc(w.raw)}</span>` : `<s class="extra">${esc(w.raw)}</s>`).join(' ') || '—'}</div>`;
        st.shown.add(st.cur); drawCur(); const row = $(`.lp-row[data-i="${st.cur}"] .lp-rt`, v); if (row) row.textContent = q.t;
        if (pct < 70 && !st.dictDone) LS.addHard(c, st.cur, 'dict').then(ok => { if (ok && !st.dead) { drawHard(); toast(`听对 ${pct}%，已放进难句本`); } }).catch(() => { });
        if (pct >= 90 && !st.dictDone && typeof Game !== 'undefined') Game.bubble(pct === 100 ? '一个词都没错，耳朵好灵！' : '几乎全对，继续保持～', 'happy');
        st.dictDone = true;
      };
    };
    drawOpts(); drawList(); drawCur();
    $('#lpPrev', v).onclick = () => play(Math.max(0, st.cur - 1));
    $('#lpNext', v).onclick = () => play(Math.min(cues.length - 1, st.cur + 1));
    $('#lpRe', v).onclick = () => play(st.cur);
    $('#lpMode', v).onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; c.mode = b.dataset.m; drawOpts(); drawList(); drawCur(); persist(); };
    $('#lpSpd', v).onclick = () => { c.rate = (c.rate || 1) === 1 ? 0.75 : 1; M.playbackRate = c.rate; M.defaultPlaybackRate = c.rate; drawOpts(); persist(); };
    $('#lpAP', v).onclick = () => { c.ap = !c.ap; st.stopped = -1; drawOpts(); persist(); };
    $('#lpDict', v).onclick = () => { st.dict = !st.dict; if (st.dict && st.sh) { st.sh = false; stopRec(); drawSh(); } drawOpts(); drawDict(); if (st.dict) { $('#lpIn', v)?.focus(); } };
    $('#lpSh', v).onclick = () => { st.sh = !st.sh; if (st.sh && st.dict) { st.dict = false; drawDict(); } if (!st.sh) stopRec(); drawOpts(); drawSh(); };
    $('#lpHard', v).onclick = async () => {
      const h = LS.hardOf(c, st.cur);
      if (h) { await LS.dropHard(h.id); toast('已从难句本移除'); }
      else if (await LS.addHard(c, st.cur, 'mark')) toast('已加入难句本，明天提醒你复习');
      drawHard();
    };
    $('#lpEx', v).onclick = () => { const i = st.cur; st.shown.add(i); drawCur(); st.exFor = i; LS.explainSentence($('#lpExBox', v), cues[i].t, w => { M.pause(); LS.wordSheet(w, cues[i].t); }); };
    $('#lpText', v).onclick = e => {
      const w = e.target.closest('.lw'); if (w) { M.pause(); LS.wordSheet(w.dataset.w, cues[st.cur].t); return; }
      if (!visible(st.cur)) { st.shown.add(st.cur); drawCur(); }
    };
    $('#lpList', v).onclick = e => { const r = e.target.closest('.lp-row'); if (r) play(+r.dataset.i); };
    const tick = () => {
      if (st.dead) return; st.raf = requestAnimationFrame(tick);
      if (M.paused || M.seeking) return; const t = M.currentTime; const q = cues[st.cur];
      if (st.after && q && t >= q.e - 0.04) { M.pause(); st.stopped = st.cur; const f = st.after; st.after = null; f(); return; }
      if (c.ap && q && st.stopped !== st.cur && t >= q.e - 0.04 && t < q.e + 0.6) {
        M.pause(); st.stopped = st.cur; persist();
        if (st.cur === cues.length - 1 && typeof Game !== 'undefined') Game.bubble('整段都听完啦，辛苦了～', 'happy');
        return;
      }
      if (q && t >= q.s - 0.3 && t < q.e) return; // 当前句还没播完（字幕时间重叠时不提前跳句）
      const k = cueAt(t); if (k >= 0 && k !== st.cur && t < cues[k].e + 0.6) { st.cur = k; st.stopped = -1; drawCur(); if (st.dict) drawDict(); persist(); }
    };
    st.raf = requestAnimationFrame(tick);
  })().catch(e => { if (!st.dead) v.innerHTML = `<div class="notice err">打开失败：${esc(e.message || '')}</div>`; });
  return () => { st.dead = true; cancelAnimationFrame(st.raf); try { if (st.rec) { const r = st.rec; st.rec = null; clearInterval(r.iv); clearTimeout(r.to); try { r.mr.stop(); } catch (e) { } r.stream.getTracks().forEach(t => t.stop()); } } catch (e) { } st.recs.forEach(r => URL.revokeObjectURL(r.url)); st.recs.clear(); clearTimeout(st.saveT); const m = $('#lpM'); if (m) { m.pause(); m.removeAttribute('src'); m.load(); } if (st.persist) st.persist(); if (st.url) URL.revokeObjectURL(st.url); };
});

/* ---- 难句本：列表 + 到期复习（播放原片段；片段删了就只看文字） ---- */
route('/learn/listen-hard', 'learn', v => {
  setTop('难句本', { back: '#/learn/listen' });
  const st = { dead: false, url: '', raf: 0, M: null };
  const freeMedia = () => { cancelAnimationFrame(st.raf); if (st.M) { st.M.pause(); st.M.removeAttribute('src'); try { st.M.load(); } catch (e) { } st.M = null; } if (st.url) { URL.revokeObjectURL(st.url); st.url = ''; } };
  const list = async () => {
    freeMedia(); const all = (await LS.hard()).filter(h => !h.done); await LS.all(); if (st.dead) return;
    if (!all.length) { v.innerHTML = emptyState('target', '难句本是空的', '在精听时点「听不懂」，或听写对得太少的句子，会自动放到这里，按 1 / 3 / 7 天提醒你复习。', '<a class="btn" href="#/learn/listen">去精听</a>'); return; }
    const due = all.filter(LS.isDue);
    v.innerHTML = `${due.length ? `<div class="card lh-top"><div><b class="num">${due.length}</b> 句今天要复习</div><button class="btn" id="lhStart">开始复习</button></div>` : '<div class="notice small">今天没有要复习的难句，过几天再来～</div>'}
      <h3 class="lp-h">全部难句 · ${all.length}</h3>
      <div class="list" id="lhList">${all.map(h => `<div class="row lh-row" data-id="${esc(h.id)}"><button class="grow lh-open" data-open="${esc(h.id)}"><div class="lh-t">${esc(h.t)}</div><div class="s">${esc(h.clip)}${LS.byId(h.clipId) ? '' : '（片段已删除）'} · ${LS.isDue(h) ? '<b class="lh-due">今天复习</b>' : esc(LS.nextTxt(h))}</div></button><button class="icon-btn lh-del" data-del="${esc(h.id)}" aria-label="移除">${icon('xmark', 16)}</button></div>`).join('')}</div>
      <p class="small muted" style="margin:10px 4px">复习时点「听懂了」会推迟到 3 天、7 天后，三次都听懂就算掌握；「还是不懂」明天再来。</p>`;
    const s = $('#lhStart', v); if (s) s.onclick = () => review(due.slice(), 0, 0);
    $('#lhList', v).onclick = async e => {
      const d = e.target.closest('[data-del]'); if (d) { await LS.dropHard(d.dataset.del); toast('已移除'); list(); return; }
      const o = e.target.closest('[data-open]'); if (o) { const h = all.find(x => x.id === o.dataset.open); if (h) review([h], 0, 0, true); }
    };
  };
  const review = async (q, k, okN, single) => {
    freeMedia(); if (st.dead) return;
    if (k >= q.length) {
      v.innerHTML = emptyState('check', single ? '练好了' : '今天的难句复习完了', single ? '' : `复习了 ${q.length} 句，${okN} 句听懂了。`, '<button class="btn" id="lhBack">返回难句本</button>');
      $('#lhBack', v).onclick = list; if (!single && typeof Game !== 'undefined') Game.bubble(okN === q.length ? '全都听懂了，耳朵越来越厉害了～' : '难句就是要多听几遍，明天继续加油！', 'happy'); return;
    }
    const h = q[k]; const c = LS.byId(h.clipId); const blob = c ? await DB.get('clipMedia:' + c.id).catch(() => null) : null; if (st.dead) return;
    const tag = c && c.kind === 'audio' ? 'audio' : 'video';
    v.innerHTML = `<div class="small muted" style="margin:0 4px 8px">${single ? '' : `第 ${k + 1} / ${q.length} 句 · `}${esc(h.clip)}</div>
      ${blob ? `<div class="lp-media ${tag} lh-media"><${tag} id="lhM" playsinline webkit-playsinline preload="auto"></${tag}></div>` : ''}
      <div class="card lp-cur"><div class="lp-meta small muted"><span>${LS.fmtT(h.s)} – ${LS.fmtT(h.e)}</span><span>${h.src === 'dict' ? '听写没对上' : '标记听不懂'}</span></div>
        <div class="lp-text ${blob ? 'masked' : ''}" id="lhText">${blob ? '<span class="lp-mask">先听，再点按显示字幕</span>' : esc(h.t)}</div><div class="lp-zh small muted" id="lhZh">${blob ? '' : esc(h.zh || '')}</div></div>
      ${blob ? `<button class="btn block plain" id="lhPlay" style="margin:12px 0">${icon('repeat', 18)} 播放原句</button>` : '<div class="notice small" id="lhGone">原片段已经删除了，只能看文字复习。</div>'}
      ${single ? '<button class="btn block" id="lhDone" style="margin-top:12px">好了</button>' : '<div class="lp-ctl2 lh-grade"><button class="btn plain" id="lhNo">还是不懂</button><button class="btn" id="lhOk">听懂了</button></div>'}`;
    const show = () => { const t = $('#lhText', v); t.classList.remove('masked'); t.textContent = h.t; $('#lhZh', v).textContent = h.zh || ''; };
    $('#lhText', v).onclick = show;
    if (blob) {
      st.url = URL.createObjectURL(blob); const M = st.M = $('#lhM', v); M.src = st.url;
      M.addEventListener('loadedmetadata', () => { M.currentTime = h.s; }, { once: true });
      const stop = () => { if (!st.M || st.dead) return; st.raf = requestAnimationFrame(stop); if (!M.paused && M.currentTime >= h.e - 0.04) M.pause(); };
      $('#lhPlay', v).onclick = () => { M.currentTime = h.s; const p = M.play(); if (p) p.catch(() => { }); cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(stop); };
    }
    const next = async ok => { if (!single) await LS.grade(h, ok); review(q, k + 1, okN + (ok ? 1 : 0), single); };
    if (single) $('#lhDone', v).onclick = list;
    else { $('#lhOk', v).onclick = () => next(true); $('#lhNo', v).onclick = () => next(false); }
  };
  list().catch(e => { if (!st.dead) v.innerHTML = `<div class="notice err">读取失败：${esc(e.message || '')}</div>`; });
  return () => { st.dead = true; freeMedia(); };
});

/* 美剧片段：只收版权方官方频道（剧集 / 电视台）上传的免费片段，外链在 Safari 播放，不下载、不转存 */
const TvClips = {
  KEY: 'sw-tvclips-seen',
  easy: [
    { id: 'c1', t: '老友记：Pivot!（Ross 搬沙发）', n: '1 分钟，台词短，最好入门', p: '老友记官方', u: 'https://www.youtube.com/watch?v=njgfomF51fg' },
    { id: 'c2', t: '摩登家庭：Lily 的音乐品味', n: '1 分钟，家常对话', p: 'ABC 官方', u: 'https://www.youtube.com/watch?v=MamwBgEH2Es' },
    { id: 'c3', t: '老友记：Ross 教 Rachel 洗衣服', n: '生活词汇多，发音清楚', p: 'TBS 官方', u: 'https://www.youtube.com/watch?v=Xz2f5qiYzJw' },
    { id: 'c4', t: '老友记：Rachel 领到第一份工资', n: '工作、钱的日常表达', p: 'TBS 官方', u: 'https://www.youtube.com/watch?v=fg8Cpl5PIRE' },
    { id: 'c5', t: '小谢尔顿：扮成 Spock 去生日派对', n: '吐字清楚，适合跟读', p: 'TBS 官方', u: 'https://www.youtube.com/watch?v=om1Rg4288B0' },
    { id: 'c6', t: '小谢尔顿：Sheldon 安慰妈妈', n: '母子谈心，语速慢', p: 'TBS 官方', u: 'https://www.youtube.com/watch?v=Vyb-sTrY_Y8' },
    { id: 'c7', t: '摩登家庭：给别人育儿建议', n: '2 分钟，口语地道', p: 'ABC 官方', u: 'https://www.youtube.com/watch?v=IBNxaMhzR0A' }
  ],
  hard: [
    { id: 'c8', t: '老友记：Ross 第一次约 Rachel', n: '连读多，练自然语速', p: 'TBS 官方', u: 'https://www.youtube.com/watch?v=7-upy7YksTA' },
    { id: 'c9', t: 'Brooklyn 99：嫌犯合唱 I Want It That Way', n: '经典名场面', p: 'NBC 官方', u: 'https://www.youtube.com/watch?v=ffyKY3Dj5ZE' },
    { id: 'c10', t: '生活大爆炸：Sheldon 把 Raj 丢在地下', n: '快速对话', p: '华纳官方', u: 'https://www.youtube.com/watch?v=6m-s1R7_Ttw' },
    { id: 'c11', t: '生活大爆炸：Raj 不准 Leonard 和 Priya 约会', n: '语速快，适合挑战', p: '华纳官方', u: 'https://www.youtube.com/watch?v=AyrtRTFuIhE' },
    { id: 'c12', t: 'Brooklyn 99：动作片模式', n: '语速很快，练反应', p: 'NBC 官方', u: 'https://www.youtube.com/watch?v=zoitWKPpwxk' },
    { id: 'c13', t: 'The Office：Dwight 的演讲', n: '长段独白，练整段理解', p: 'NBC 官方', u: 'https://www.youtube.com/watch?v=LYyZqlyDEL4' }
  ],
  all() { return this.easy.concat(this.hard); },
  sub() { return LinkList.sub(this.KEY, this.all(), '官方片段'); }
};
route('/learn/tvclips', 'learn', v => {
  setTop('美剧片段', { back: '#/learn/listen' });
  LinkList.render(v, TvClips.KEY, '都来自剧集官方 YouTube 频道，免费观看，需要梯子。点开在 Safari 播放，看完点圆圈标记“看过”。', [{ h: '入门 · 语速慢', items: TvClips.easy }, { h: '进阶 · 语速快', items: TvClips.hard }]);
});
