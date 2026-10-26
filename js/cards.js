'use strict';
/* ========== 卡片复习（FSRS-5 算法 / Anki 风格） ========== */
const Cards = {
  STEPS: [1, 10], // 学习阶段（分钟）
  newCard(deckId, front, back) { return { id: uid(), deckId, front, back, state: 'new', ef: 2.5, ivl: 0, due: Date.now(), reps: 0, lapses: 0, step: 0, createdAt: Date.now() }; },
  endOfToday() { return startOfDay() + DAY - 1; },
  newDoneToday(deckId) { const t0 = startOfDay(); return S.reviews.filter(r => r.t >= t0 && r.wasNew && (!deckId || r.deckId === deckId)).length; },
  counts(deckId) {
    const cs = S.cards.filter(c => !deckId || c.deckId === deckId); const now = Date.now(), eod = this.endOfToday();
    const neu = cs.filter(c => c.state === 'new').length;
    const lim = Math.max(0, this.newLimit(deckId) - this.newDoneToday(deckId));
    return { total: cs.length, new: neu, newToday: Math.min(neu, lim), learn: cs.filter(c => c.state === 'learn' && c.due <= now + 20 * 60000).length, due: cs.filter(c => c.state === 'review' && c.due <= eod).length };
  },
  dueTotal() { let n = 0; const ids = S.decks.map(d => d.id); ids.forEach(id => { const c = this.counts(id); n += c.newToday + c.learn + c.due; }); return n; },
  buildQueue(deckId) {
    const ids = deckId ? [deckId] : S.decks.map(d => d.id); const now = Date.now(), eod = this.endOfToday(); let q = [];
    for (const id of ids) {
      const cs = S.cards.filter(c => c.deckId === id);
      q.push(...cs.filter(c => (c.state === 'review' && c.due <= eod) || (c.state === 'learn' && c.due <= now + 20 * 60000)));
      const lim = Math.max(0, this.newLimit(id) - this.newDoneToday(id));
      q.push(...cs.filter(c => c.state === 'new').sort((a, b) => a.createdAt - b.createdAt).slice(0, lim));
    }
    return q.sort((a, b) => (a.state === 'new') - (b.state === 'new') || a.due - b.due);
  },
  retention(deckId) { const d = S.decks.find(x => x.id === deckId); return +(d?.retention || S.settings.cards.retention || 0.9); },
  newLimit(deckId) { const d = deckId && S.decks.find(x => x.id === deckId); return d && d.newPerDay != null && d.newPerDay !== '' ? +d.newPerDay : S.settings.cards.newPerDay; },
  // 记住的概率（0–1），新卡返回 null
  recall(c) { const m = FSRS.migrate(c); if (!m) return null; const last = c.lastReview || (c.due - (c.ivl || 1) * DAY); return FSRS.R(Math.max(0, (Date.now() - last) / DAY), m.s); },
  // FSRS-5 调度：计算评分后的结果（不修改原卡）。r: 1 重来 2 困难 3 良好 4 简单
  schedule(c, r) {
    const n = { ...c }; const now = Date.now(); const M = 60000; const ret = this.retention(c.deckId); const maxI = S.settings.cards.maxIvl || 36500;
    const at = days => startOfDay() + days * DAY + 4 * 3600000;
    const mem = FSRS.migrate(c); let s, d;
    const elapsed = c.lastReview ? (now - c.lastReview) / DAY : (mem ? Math.max(0, (now - (c.due - (c.ivl || 0) * DAY)) / DAY) : 0);
    if (!mem) { s = FSRS.s0(r); d = FSRS.d0(r); }
    else if (elapsed < 1) { s = FSRS.shortS(mem.s, r); d = FSRS.nextD(mem.d, r); }
    else { const R = FSRS.R(elapsed, mem.s); d = FSRS.nextD(mem.d, r); s = r === 1 ? FSRS.forgetS(mem.d, mem.s, R) : FSRS.recallS(mem.d, mem.s, R, r); }
    n.fs = Math.max(0.1, Math.round(s * 1000) / 1000); n.fd = Math.round(d * 1000) / 1000; n.algo = 'fsrs';
    const toReview = days => { n.state = 'review'; n.ivl = days; n.due = at(days); n.step = 0; };
    if (c.state === 'new' || c.state === 'learn') {
      const relearn = c.state === 'learn' && c.lapses > 0;
      if (r === 1) { n.state = 'learn'; n.step = 0; n.due = now + (relearn ? 10 : this.STEPS[0]) * M; }
      else if (r === 2) { n.state = 'learn'; n.due = now + (relearn ? 15 : c.state === 'new' || n.step === 0 ? 6 : 10) * M; }
      else if (r === 3) {
        const st = (c.state === 'new' ? 0 : c.step) + 1;
        if (st >= this.STEPS.length || relearn) toReview(FSRS.interval(n.fs, ret, maxI));
        else { n.state = 'learn'; n.step = st; n.due = now + this.STEPS[st] * M; }
      } else {
        const good = FSRS.interval(c.state === 'new' ? FSRS.s0(3) : FSRS.shortS(mem ? mem.s : FSRS.s0(3), 3), ret, maxI);
        toReview(Math.max(good + 1, FSRS.interval(n.fs, ret, maxI)));
      }
    } else {
      if (r === 1) { n.lapses = (c.lapses || 0) + 1; n.state = 'learn'; n.step = 0; n.due = now + 10 * M; n.ivl = FSRS.interval(n.fs, ret, maxI); }
      else {
        // 保证 困难 ≤ 良好 < 简单
        const R = FSRS.R(Math.max(elapsed, 0), mem.s); const dd = mem.d;
        const iv = g => FSRS.interval(FSRS.recallS(dd, mem.s, R, g), ret, maxI);
        let hard = iv(2), good = iv(3), easy = iv(4);
        hard = Math.min(hard, good); good = Math.max(good, hard + 1); easy = Math.max(easy, good + 1);
        toReview(Math.min(maxI, r === 2 ? hard : r === 3 ? good : easy));
      }
    }
    n.reps = (c.reps || 0) + 1; n.lastReview = now; return n;
  },
  ivlLabel(c, r) {
    const n = this.schedule(c, r); const d = n.due - Date.now();
    if (n.state === 'learn') return d < 3600000 ? `${Math.max(1, Math.round(d / 60000))}分钟` : `${Math.round(d / 3600000)}小时`;
    return n.ivl < 30 ? `${n.ivl}天` : n.ivl < 365 ? `${(n.ivl / 30).toFixed(1)}月` : `${(n.ivl / 365).toFixed(1)}年`;
  },
  parseBulk(text) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      for (const sep of ['\t', ' :: ', '::', ' | ', '|', '：', ' - ', ',', '，']) { const i = l.indexOf(sep); if (i > 0) return [l.slice(0, i).trim(), l.slice(i + sep.length).trim()]; }
      return null;
    }).filter(x => x && x[0] && x[1]);
  }
};
/* 填空卡（Anki Cloze）：正面写「{{答案}}」或「{{c1::答案}}」挖空 */
const CLOZE_RE = /\{\{(?:c\d+::)?([\s\S]+?)(?:::([^}]*))?\}\}/g;
const isCloze = t => /\{\{[\s\S]+?\}\}/.test(t || '');
function clozeHtml(t, reveal) { const parts = []; let last = 0, m; CLOZE_RE.lastIndex = 0; const src = String(t); while ((m = CLOZE_RE.exec(src))) { parts.push(rt(src.slice(last, m.index))); parts.push(reveal ? `<span class="cloze on">${rt(m[1])}</span>` : `<span class="cloze">${m[2] ? esc(m[2]) : '［…］'}</span>`); last = m.index + m[0].length; } parts.push(rt(src.slice(last))); return parts.join(''); }
const clozeSay = (t, reveal) => String(t).replace(CLOZE_RE, (_, a) => reveal ? a : '空');
const cardFace = (c, back) => isCloze(c.front) ? clozeHtml(c.front, back) : rt(back ? c.back : c.front);
function deckDue(d) { const c = Cards.counts(d.id); return c; }
route('/learn/decks', 'learn', v => {
  setTop('卡片复习', { back: '#/learn', actions: `<button class="icon-btn" id="addDeck" aria-label="新建卡组">＋</button>` });
  $('#addDeck').onclick = () => editDeck();
  const tot = Cards.dueTotal();
  v.innerHTML = `<div class="card" style="display:flex;align-items:center;gap:12px"><div class="grow" style="flex:1"><b>今日待复习</b><div class="small muted">${tot ? `共 ${tot} 张（含新卡）` : '今天的复习已全部完成 👏'}</div></div><a class="btn ${tot ? '' : 'plain'}" href="#/learn/review/all">${tot ? '全部复习' : '再看看'}</a></div>
  ${S.cards.length ? `<a class="row card" href="#/learn/cards-browse" style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${iconTile('search', 'var(--info)', 18)}<div class="grow" style="flex:1"><b>卡片浏览器</b><div class="small muted">搜索与筛选全部卡片</div></div><span class="chev">›</span></a>` : ''}
  ${S.decks.length ? `<div class="list">${S.decks.map(d => { const c = deckDue(d); return `<a class="row" href="#/learn/deck/${d.id}"><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${c.total} 张 · 新卡 <b style="color:var(--info)">${c.newToday}</b> · 学习中 <b style="color:var(--bad)">${c.learn}</b> · 待复习 <b style="color:var(--ok)">${c.due}</b></div></div>${subjChip(d.subject)}<span class="chev">›</span></a>`; }).join('')}</div>` : `${emptyState('cards', '还没有卡组', '点右上角 ＋ 创建卡组，或在笔记里用「问题 :: 答案」一键生成。')}`}
  <p class="small muted" style="margin:10px 4px">FSRS 记忆算法会在你快忘记时安排复习。</p>`;
});
/* 卡片浏览器（Anki Browse）：跨卡组搜索、筛选、排序 */
route('/learn/cards-browse', 'learn', v => {
  setTop('卡片浏览器', { back: '#/learn/decks' });
  const F = [['all', '全部'], ['due', '今日到期'], ['new', '新卡'], ['learn', '学习中'], ['hard', '易忘'], ['cloze', '填空卡'], ['solid', '已牢记']];
  const st = { f: Q.get('f') || 'all', q: Q.get('q') || '', deck: Q.get('deck') || '', sort: 'due' };
  const eod = Cards.endOfToday();
  const test = (c, f) => f === 'all' ? true : f === 'due' ? c.state !== 'new' && c.due <= eod : f === 'new' ? c.state === 'new' : f === 'learn' ? c.state === 'learn' : f === 'hard' ? (c.lapses || 0) >= 2 || (FSRS.migrate(c)?.d || 0) >= 8 : f === 'cloze' ? isCloze(c.front) : f === 'solid' ? c.state === 'review' && (FSRS.migrate(c)?.s || 0) >= 21 : true;
  const dueLbl = c => { if (c.state === 'new') return '新卡'; const d = Math.round((c.due - Date.now()) / DAY); return d <= 0 ? (c.due <= Date.now() ? '已到期' : '今天') : d < 30 ? `${d} 天后` : `${Math.round(d / 30)} 个月后`; };
  v.innerHTML = `<input type="search" id="bq" placeholder="搜索全部卡片正反面…" value="${esc(st.q)}" style="margin-bottom:10px">
    <div class="chips" id="bf" style="margin-bottom:10px;flex-wrap:nowrap;overflow-x:auto">${F.map(([k, l]) => `<button class="chip ${st.f === k ? 'sel' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="grid2" style="margin-bottom:10px"><select id="bd"><option value="">全部卡组</option>${S.decks.map(d => `<option value="${d.id}" ${st.deck === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select><select id="bs"><option value="due">按到期时间</option><option value="diff">按难度（难→易）</option><option value="lapse">按遗忘次数</option><option value="new">按添加时间</option></select></div>
    <div id="bl"></div>`;
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    let list = S.cards.filter(c => (!st.deck || c.deckId === st.deck) && test(c, st.f) && (!q || (c.front + ' ' + c.back).toLowerCase().includes(q)));
    const sorters = { due: (a, b) => (a.state === 'new') - (b.state === 'new') || a.due - b.due, diff: (a, b) => (FSRS.migrate(b)?.d || 0) - (FSRS.migrate(a)?.d || 0), lapse: (a, b) => (b.lapses || 0) - (a.lapses || 0), new: (a, b) => b.createdAt - a.createdAt };
    list.sort(sorters[st.sort]);
    $('#bl').innerHTML = list.length ? `<div class="small muted" style="margin:0 4px 6px">${list.length} 张卡片</div><div class="list">${list.slice(0, 200).map(c => { const m = FSRS.migrate(c); const R = Cards.recall(c); return `<div class="row" data-id="${c.id}"><div class="grow"><div class="t">${cardFace(c, true)}</div><div class="s">${esc(S.decks.find(d => d.id === c.deckId)?.name || '')} · ${dueLbl(c)}${m ? ` · 难度 ${m.d.toFixed(1)}` : ''}${R != null ? ` · 记住率 ${Math.round(R * 100)}%` : ''}${c.lapses ? ` · 忘 ${c.lapses} 次` : ''}</div></div>${isCloze(c.front) ? '<span class="chip">填空</span>' : ''}</div>`; }).join('')}</div>${list.length > 200 ? '<p class="small muted" style="text-align:center">仅显示前 200 张，请缩小搜索范围</p>' : ''}` : emptyState('search', '没有匹配的卡片', '换个关键词或筛选条件试试');
  };
  $('#bq').oninput = debounce(e => { st.q = e.target.value; draw(); }, 150);
  $('#bf').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; st.f = b.dataset.f; $$('#bf .chip').forEach(x => x.classList.toggle('sel', x === b)); draw(); };
  $('#bd').onchange = e => { st.deck = e.target.value; draw(); };
  $('#bs').onchange = e => { st.sort = e.target.value; draw(); };
  $('#bl').onclick = e => { const r = e.target.closest('[data-id]'); if (!r) return; const c = S.cards.find(x => x.id === r.dataset.id); editCard(c.deckId, c, draw); };
  draw();
});
function editDeck(d) {
  const isNew = !d; d = d || { id: uid(), name: '', subject: '', createdAt: Date.now() };
  openSheet(`<h2>${isNew ? '新建卡组' : '编辑卡组'}</h2><label class="f"><span>名称</span><input type="text" id="dN" value="${esc(d.name)}" placeholder="如：英语四级词汇"></label><label class="f"><span>科目</span><select id="dS">${subjOptions(d.subject)}</select></label>
  <details style="margin:-4px 0 12px"><summary>卡组选项（每日新卡 / 目标记住率）</summary><div class="grid2" style="margin-top:8px"><label class="f"><span>每天新卡（留空=全局 ${S.settings.cards.newPerDay}）</span><input type="number" id="dNp" inputmode="numeric" value="${d.newPerDay ?? ''}" placeholder="${S.settings.cards.newPerDay}"></label><label class="f"><span>目标记住率</span><select id="dRt"><option value="">跟随设置（${Math.round((S.settings.cards.retention || .9) * 100)}%）</option>${[0.8, 0.85, 0.9, 0.95].map(x => `<option value="${x}" ${+d.retention === x ? 'selected' : ''}>${x * 100}%</option>`).join('')}</select></label></div><div class="small muted">记住率越高复习越频繁；考前冲刺的卡组可设 95%。</div></details>
  <div class="btns">${!isNew ? '<button class="btn danger" id="dDel">删除卡组</button>' : ''}<button class="btn" id="dOk">保存</button></div>`, el => {
    $('#dOk', el).onclick = () => { const name = $('#dN', el).value.trim(); if (!name) return toast('请输入名称'); d.name = name; d.subject = $('#dS', el).value; const np = $('#dNp', el).value.trim(); if (np === '') delete d.newPerDay; else d.newPerDay = Math.max(0, Math.min(500, +np || 0)); const rtv = $('#dRt', el).value; if (rtv) d.retention = +rtv; else delete d.retention; if (isNew) S.decks.push(d); save('decks'); closeSheet(); if (isNew) location.hash = '#/learn/deck/' + d.id; else rerender(); };
    if (!isNew) $('#dDel', el).onclick = async () => { if (await confirmBox(`删除卡组「${d.name}」及其全部卡片？`, '删除')) { S.decks = S.decks.filter(x => x !== d); S.cards = S.cards.filter(c => c.deckId !== d.id); save('decks'); save('cards'); location.hash = '#/learn/decks'; } };
  });
}
function editCard(deckId, c, onDone) {
  const isNew = !c;
  openSheet(`<h2>${isNew ? '添加卡片' : '编辑卡片'}</h2><label class="f"><span>正面（问题）· 用 {{答案}} 挖空即成填空卡</span><textarea id="cF" style="min-height:80px" placeholder="例：极限 $\\lim_{x\\to0}\\frac{\\sin x}{x}$ = {{1}}">${esc(c?.front || '')}</textarea></label><label class="f"><span>背面（答案；填空卡可留空或写补充说明）</span><textarea id="cB" style="min-height:100px">${esc(c?.back || '')}</textarea></label>
  <div class="btns">${!isNew ? '<button class="btn danger" id="cDel">删除</button><button class="btn plain" id="cReset">重置进度</button>' : '<button class="btn plain" id="cClose">完成</button>'}<button class="btn" id="cOk">${isNew ? '添加并继续' : '保存'}</button></div>`, el => {
    if (isNew) $('#cClose', el).onclick = () => closeSheet();
    $('#cOk', el).onclick = () => {
      const f = $('#cF', el).value.trim(), b = $('#cB', el).value.trim(); if (!f || (!b && !isCloze(f))) return toast('正反面都要填写（填空卡背面可留空）');
      if (isNew) { S.cards.push(Cards.newCard(deckId, f, b)); save('cards'); $('#cF', el).value = ''; $('#cB', el).value = ''; $('#cF', el).focus(); toast('已添加'); }
      else { c.front = f; c.back = b; save('cards'); closeSheet(); }
    };
    if (!isNew) { $('#cDel', el).onclick = () => { S.cards = S.cards.filter(x => x !== c); save('cards'); closeSheet(); }; $('#cReset', el).onclick = () => { Object.assign(c, { state: 'new', ef: 2.5, ivl: 0, due: Date.now(), reps: 0, lapses: 0, step: 0 }); delete c.fs; delete c.fd; delete c.lastReview; save('cards'); closeSheet(); }; }
  }, onDone || (() => rerender()));
}
route('/learn/deck/:id', 'learn', (v, id) => {
  const d = S.decks.find(x => x.id === id); if (!d) { location.hash = '#/learn/decks'; return; }
  setTop(d.name, { back: '#/learn/decks', actions: `<button class="icon-btn txt" id="ed">设置</button>` });
  $('#ed').onclick = () => editDeck(d);
  const c = Cards.counts(id); const cards = S.cards.filter(x => x.deckId === id).sort((a, b) => b.createdAt - a.createdAt);
  const n = c.newToday + c.learn + c.due;
  v.innerHTML = `<div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="v" style="color:var(--info)">${c.newToday}</div><div class="l">新卡</div></div><div class="stat"><div class="v" style="color:var(--bad)">${c.learn}</div><div class="l">学习中</div></div><div class="stat"><div class="v" style="color:var(--ok)">${c.due}</div><div class="l">待复习</div></div></div>
  <a class="btn block" href="#/learn/review/${id}" style="margin-bottom:10px">${n ? `开始复习（${n}）` : '今日已完成，查看卡片'}</a>
  <div class="btns" style="margin-bottom:12px"><button class="btn ghost" id="add">＋ 添加卡片</button><button class="btn ghost" id="bulk">批量导入</button></div>
  <input type="search" id="cq" placeholder="搜索卡片（共 ${cards.length} 张）" style="margin-bottom:12px">
  <div id="cl"></div>`;
  const draw = () => {
    const q = $('#cq').value.trim().toLowerCase(); const list = cards.filter(x => !q || (x.front + x.back).toLowerCase().includes(q));
    $('#cl').innerHTML = list.length ? `<div class="list">${list.slice(0, 300).map(x => `<div class="row" data-id="${x.id}"><div class="grow"><div class="t">${cardFace(x, true)}</div><div class="s">${rt(x.back)}</div></div><span class="chip">${x.state === 'new' ? '新' : x.state === 'learn' ? '学习中' : relDue(x.due)}</span></div>`).join('')}</div>` : `<div class="empty">${q ? '无匹配' : '卡组是空的，添加几张卡片吧'}</div>`;
  };
  $('#cq').oninput = draw; draw();
  $('#cl').onclick = e => { const r = e.target.closest('[data-id]'); if (r) editCard(id, S.cards.find(x => x.id === r.dataset.id)); };
  $('#add').onclick = () => editCard(id);
  $('#bulk').onclick = () => openSheet(`<h2>批量导入卡片</h2><p class="small muted">每行一张卡片，正面与背面用 Tab、「::」、「|」或逗号分隔。可直接粘贴 Excel / Anki 导出的两列文本。</p>
    <textarea id="bt" style="min-height:200px" placeholder="apple :: 苹果&#10;勾股定理 | a²+b²=c²"></textarea>
    <div class="btns" style="margin-top:10px"><button class="btn plain" id="bf">从文件（.txt/.csv）</button><button class="btn" id="bo">导入</button></div>`, el => {
    $('#bf', el).onclick = async () => { const [f] = await pickFile('.txt,.csv,.tsv,text/plain'); if (f) $('#bt', el).value = await readFileAs(f); };
    $('#bo', el).onclick = () => { const rows = Cards.parseBulk($('#bt', el).value); if (!rows.length) return toast('没有识别到有效的行'); rows.forEach(([f, b]) => S.cards.push(Cards.newCard(id, f, b))); save('cards'); closeSheet(); toast(`已导入 ${rows.length} 张`); rerender(); };
  });
});
route('/learn/review/:id', 'learn', (v, id) => {
  const deck = id === 'all' ? null : S.decks.find(x => x.id === id);
  const back = deck ? '#/learn/deck/' + id : '#/learn/decks';
  setTop(deck ? deck.name : '全部复习', { back });
  let queue = Cards.buildQueue(deck?.id); let okN = 0, celebrated = false; Game.resetCombo(); let done = 0, shown = false, cur = null, spoken = '', undo = null; const startT = Date.now();
  const total0 = queue.length;
  const next = () => {
    shown = false; const now = Date.now();
    queue.sort((a, b) => { const ar = a.state === 'learn' && a.due > now, br = b.state === 'learn' && b.due > now; return ar - br || (ar && br ? a.due - b.due : 0); });
    cur = queue[0];
    if (!cur) {
      const mins = Math.round((Date.now() - startT) / 60000);
      if (done && !celebrated) { celebrated = true; Game.reviewDone(done, okN, mins); }
      v.innerHTML = `<div class="empty">${Game.doneIcon('var(--c-cards)')}<h2>本轮复习完成</h2><p>复习了 ${done} 张卡片，用时约 ${Math.max(1, mins)} 分钟</p><a class="btn" href="${back}">返回</a></div>`; return;
    }
    draw();
  };
  const draw = () => {
    const tag = cur.state === 'new' ? '<span class="chip" style="color:var(--info)">新卡</span>' : cur.state === 'learn' ? '<span class="chip" style="color:var(--bad)">学习中</span>' : '<span class="chip" style="color:var(--ok)">复习</span>';
    const dn = !deck ? (S.decks.find(x => x.id === cur.deckId)?.name || '') : '';
    v.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div class="chips">${tag}${dn ? `<span class="chip">${esc(dn)}</span>` : ''}</div><span class="small muted">剩余 ${queue.length} · 已复习 ${done}</span></div>
      <div class="progress"><i style="width:${total0 ? Math.min(100, done / (done + queue.length) * 100) : 0}%"></i></div>
      <div class="card flash" id="fc">${isCloze(cur.front) ? `<div class="fside">${clozeHtml(cur.front, shown)}${spkBtn(clozeSay(cur.front, shown))}</div>${shown && cur.back ? `<div class="back fside small">${rt(cur.back)}</div>` : ''}` : `<div class="fside">${rt(cur.front)}${spkBtn(cur.front)}</div>${shown ? `<div class="back fside">${rt(cur.back)}${spkBtn(cur.back)}</div>` : ''}`}</div>
      ${shown ? `<div class="rate">${[[1, '重来', 'again'], [2, '困难', 'hard'], [3, '良好', 'good'], [4, '简单', 'easy']].map(([r, l, k]) => `<button class="r-${k}" data-r="${r}">${l}<small>${Cards.ivlLabel(cur, r)}</small></button>`).join('')}</div>`
        : `<button class="btn block" id="show" style="min-height:60px">显示答案</button>`}
      <div class="btns" style="margin-top:14px">${undo ? '<button class="btn plain small" id="undo">↶ 撤销</button>' : ''}<button class="btn plain small" id="editc">编辑此卡</button><button class="btn plain small" id="skip">跳过</button></div>
      ${cur.state === 'review' && Cards.recall(cur) != null ? `<div class="small muted" style="text-align:center;margin-top:10px">FSRS · 当前记住概率约 ${Math.round(Cards.recall(cur) * 100)}% · 稳定性 ${(FSRS.migrate(cur).s).toFixed(1)} 天 · 难度 ${FSRS.migrate(cur).d.toFixed(1)}</div>` : ''}
      ${TTS.ok ? `<div class="chips" style="justify-content:center;margin-top:14px"><button class="chip ${S.settings.tts.autoplay ? 'sel' : ''}" id="ap">${icon('speaker', 15)} 自动朗读${S.settings.tts.autoplay ? '：开' : '：关'}</button><button class="chip" id="rt">语速 ${S.settings.tts.rate}×</button></div>` : ''}`;
    if (TTS.ok) {
      $('#ap').onclick = () => { S.settings.tts.autoplay = !S.settings.tts.autoplay; saveSettings(); spoken = ''; draw(); };
      $('#rt').onclick = () => { const R = [0.6, 0.8, 1, 1.2, 1.5]; const st = S.settings.tts; st.rate = R[(R.indexOf(st.rate) + 1) % R.length] || 1; saveSettings(); draw(); TTS.speak(shown ? cur.back : cur.front); };
      const key = cur.id + (shown ? 'b' : 'f');
      if (S.settings.tts.autoplay && spoken !== key && (!shown || S.settings.tts.autoBack)) { spoken = key; TTS.speak(isCloze(cur.front) ? clozeSay(cur.front, shown) : shown ? cur.back : cur.front); }
    }
    $('#fc').onclick = () => { if (!shown) { shown = true; draw(); } };
    if (!shown) $('#show').onclick = () => { shown = true; draw(); };
    else $$('.rate button').forEach(b => b.onclick = () => rate(+b.dataset.r));
    $('#editc').onclick = () => editCard(cur.deckId, cur, () => { if (!S.cards.includes(cur)) { queue.shift(); next(); } else draw(); });
    $('#skip').onclick = () => { queue.push(queue.shift()); next(); };
    if (undo) $('#undo').onclick = () => { const u = undo; undo = null; Object.keys(u.c).forEach(k => delete u.c[k]); Object.assign(u.c, u.card); S.reviews.pop(); save('reviews'); save('cards'); queue = u.queue; done--; cur = u.c; shown = true; draw(); };
  };
  const rate = r => {
    undo = { c: cur, card: { ...cur }, queue: queue.slice() };
    const wasNew = cur.state === 'new'; const n = Cards.schedule(cur, r); Object.assign(cur, n);
    S.reviews.push({ t: Date.now(), cardId: cur.id, deckId: cur.deckId, r, wasNew }); save('reviews'); save('cards');
    done++; queue.shift(); if (r >= 3) okN++; Game.combo(r >= 3); if (r === 1) Game.encourage();
    if (cur.state === 'learn' && cur.due <= Date.now() + 20 * 60000) queue.push(cur);
    next();
  };
  const key = e => { if (e.target.matches('input,textarea')) return; if (!shown && (e.key === ' ' || e.key === 'Enter')) { shown = true; draw(); e.preventDefault(); } else if (e.key === 'z' && undo) $('#undo')?.click(); else if (shown && '1234'.includes(e.key)) rate(+e.key); };
  document.addEventListener('keydown', key);
  if (!queue.length) { v.innerHTML = `<div class="empty"><div class="big">${icon('check', 30)}</div><h2>暂时没有需要复习的卡片</h2><p>新卡已达今日上限或卡组为空。</p><a class="btn" href="${back}">返回</a></div>`; }
  else next();
  return () => document.removeEventListener('keydown', key);
});
