'use strict';
/* ========== 错题本 ========== */
const WF = { subject: '', qtype: '', status: 'todo', kp: '', q: '' };
function wrongFiltered() {
  const q = WF.q.trim().toLowerCase();
  return S.wrongs.filter(w => (!WF.subject || w.subject === WF.subject) && (!WF.qtype || w.qtype === WF.qtype) && (WF.status === 'all' || (WF.status === 'done' ? w.mastered : !w.mastered)) && (!WF.kp || w.knowledgePoint === WF.kp) && (!q || (w.stem + w.knowledgePoint + w.note + w.chapter + (w.source || '')).toLowerCase().includes(q)));
}
function wrongAnswerText(w) { return fmtAnswer({ type: w.qtype }, w.answer); }
function wrongQuestionHtml(w, reveal = true) {
  let h = (w.material ? `<details class="material zt-mat"><summary class="small muted">阅读材料</summary><div class="md">${md(w.material)}</div></details>` : '') + `<div class="stem">${richText(w.stem)}</div>`;
  if (w.image) h += `<img class="thumb" src="${w.image}" alt="题目图片">`;
  if (w.options && w.options.length) h += w.options.map((o, i) => { const L = LETTERS[i]; const isAns = reveal && (Array.isArray(w.answer) ? w.answer.includes(L) : w.answer === L); const picked = reveal && (Array.isArray(w.userAnswer) ? w.userAnswer.includes(L) : w.userAnswer === L); return `<div class="opt ${isAns ? 'right' : picked ? 'wrong' : ''}" style="cursor:default"><b>${L}.</b><span style="flex:1">${rt(o)}</span>${picked ? '<span class="small">我的答案</span>' : ''}</div>`; }).join('');
  if (reveal) {
    if (!(w.options && w.options.length)) {
      if (w.userAnswer != null && w.userAnswer !== '') h += `<div class="verdict bad"><b>我的答案：</b>${rt(fmtAnswer({ type: w.qtype }, w.userAnswer))}</div>`;
      h += `<div class="verdict ok"><b>正确答案：</b>${/```|\n/.test(wrongAnswerText(w)) ? md(wrongAnswerText(w)) : rt(wrongAnswerText(w))}</div>`;
    }
    if (w.explanation) h += `<div class="verdict md" style="background:var(--pri-soft)">${spkBtn(w.explanation)}<b>解析：</b>${md(w.explanation)}</div>`;
    if (w.feedback && w.feedback !== '自评') h += `<div class="verdict mid"><b>批改意见：</b>${rt(w.feedback)}</div>`;
    if (w.note) h += `<div class="verdict" style="background:rgba(255,214,10,.18)"><b>我的笔记：</b>${esc(w.note)}</div>`;
  }
  return h;
}
function wrongChips(w) { return `${subjChip(w.subject)}<span class="chip">${QT[w.qtype]?.short || '题目'}</span>${w.knowledgePoint ? `<span class="chip">${esc(w.knowledgePoint)}</span>` : ''}${w.chapter ? `<span class="chip">${esc(w.chapter)}</span>` : ''}${w.mastered ? '<span class="chip" style="color:var(--ok)">已掌握</span>' : ''}`; }
route('/learn/wrong', 'learn', v => {
  if (Q.has('subject')) { const q = Q.get('subject'); WF.subject = S.settings.subjects.some(x => x.id === q) ? q : ''; WF.kp = ''; }
  setTop('错题本', { back: '#/learn', actions: `<button class="icon-btn" id="addW" aria-label="添加">＋</button>` });
  $('#addW').onclick = () => editWrong();
  const kps = [...new Set(S.wrongs.filter(w => !WF.subject || w.subject === WF.subject).map(w => w.knowledgePoint).filter(Boolean))];
  const todo = S.wrongs.filter(w => !w.mastered).length;
  let selMode = false; const sel = new Set();
  const draw = () => {
    const list = wrongFiltered();
    $('#wl').innerHTML = list.length ? `<div class="list">${list.map(w => `<div class="row" data-id="${w.id}" style="align-items:flex-start">${selMode ? `<button class="check ${sel.has(w.id) ? 'on' : ''}" data-act="sel" style="margin-top:2px">${sel.has(w.id) ? '✓' : ''}</button>` : ''}<div class="grow" data-act="open"><div class="t" style="white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${rt(w.stem)}</div><div class="chips" style="margin-top:6px">${wrongChips(w)}</div><div class="s" style="margin-top:4px">${fmtDate(w.createdAt)} · ${esc(w.source || '')}${w.reviewCount ? ` · 复习 ${w.reviewCount} 次` : ''}</div></div>${w.image ? icon('image', 18, 'muted') : ''}</div>`).join('')}</div>` : `${S.wrongs.length ? emptyState('search', '没有符合条件的错题', '换个筛选条件试试。') : emptyState('wrong', '还没有错题', '做试卷时答错的题会自动收集到这里，也可以点 ＋ 手动添加（支持拍照）。')}`;
    $('#selBar').innerHTML = selMode ? `<div class="btns" style="margin-bottom:12px"><button class="btn plain" id="sc">取消</button><button class="btn" id="sv" ${sel.size ? '' : 'disabled'}>举一反三出题（${sel.size}）</button></div>` : '';
    if (selMode) { $('#sc').onclick = () => { selMode = false; sel.clear(); draw(); }; $('#sv').onclick = () => { examDraft.types = { single: 0, multiple: 0, judge: 0, blank: 0, short: 0, calc: 0 }; location.hash = '#/learn/exam/new?wrong=' + [...sel].join(','); }; }
  };
  const fOn = !!(WF.subject || WF.qtype || WF.kp); const cnt = { todo, done: S.wrongs.length - todo, all: S.wrongs.length };
  v.innerHTML = `<div class="btns" style="margin-bottom:8px"><a class="btn" href="#/learn/wrong-review">${icon('repeat', 18)} 错题复习</a><button class="btn ghost" id="vs">${icon('sparkle', 18)} 举一反三</button></div>
    <div class="link-row"><a href="#/learn/wrong-analysis">${icon('target', 15)} 薄弱点分析</a><a href="#/learn/solve">${icon('camera', 15)} 拍照搜题</a></div>
    <div id="selBar"></div>
    <div class="seg" id="wst">${[['todo', '待攻克'], ['done', '已掌握'], ['all', '全部']].map(([k, l]) => `<button data-k="${k}" class="${WF.status === k ? 'on' : ''}">${l} <span class="num">${cnt[k]}</span></button>`).join('')}</div>
    <input type="search" id="wq" placeholder="搜索题目、知识点、笔记" value="${esc(WF.q)}" style="margin-bottom:10px">
    <details class="adv flt"${fOn ? ' open' : ''}><summary>筛选${fOn ? ` · ${esc([WF.subject && subj(WF.subject).name, WF.qtype && QT[WF.qtype].name, WF.kp].filter(Boolean).join(' / '))}` : ''}</summary>
    <div class="grid2" style="margin-bottom:10px"><select id="wsj"><option value="">全部科目</option>${S.settings.subjects.map(s => `<option value="${s.id}" ${WF.subject === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <select id="wqt"><option value="">全部题型</option>${QT_ORDER.map(t => `<option value="${t}" ${WF.qtype === t ? 'selected' : ''}>${QT[t].name}</option>`).join('')}</select></div>
    ${kps.length ? `<div class="chips" id="wkp"><button class="chip ${!WF.kp ? 'sel' : ''}" data-k="">全部知识点</button>${kps.slice(0, 30).map(k => `<button class="chip ${WF.kp === k ? 'sel' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}</details>
    <div id="wl"></div>`;
  $('#wq').oninput = e => { WF.q = e.target.value; draw(); };
  $('#wst').onclick = e => { const b = e.target.closest('button'); if (b) { WF.status = b.dataset.k; rerender(); } };
  $('#wsj').onchange = e => { WF.subject = e.target.value; WF.kp = ''; rerender(); };
  $('#wqt').onchange = e => { WF.qtype = e.target.value; rerender(); };
  const wkp = $('#wkp'); if (wkp) wkp.onclick = e => { const b = e.target.closest('button'); if (b) { WF.kp = b.dataset.k; rerender(); } };
  $('#vs').onclick = () => { if (!AI.ready()) return showAIError(new AIError('举一反三需要 AI 生成新题目，请先在「我的 → 设置」中配置 AI。', 'config')); if (!S.wrongs.length) return toast('错题本还是空的'); selMode = true; wrongFiltered().slice(0, 5).forEach(w => sel.add(w.id)); draw(); toast('勾选要举一反三的错题'); };
  $('#wl').onclick = e => { const r = e.target.closest('[data-id]'); if (!r) return; if (selMode) { sel.has(r.dataset.id) ? sel.delete(r.dataset.id) : sel.add(r.dataset.id); draw(); } else location.hash = '#/learn/wrong/' + r.dataset.id; };
  draw();
});
route('/learn/wrong/:id', 'learn', (v, id) => {
  const w = S.wrongs.find(x => x.id === id); if (!w) { location.hash = '#/learn/wrong'; return; }
  setTop('错题详情', { back: '#/learn/wrong', actions: `<button class="icon-btn txt" id="ed">编辑</button>` });
  $('#ed').onclick = () => editWrong(w);
  v.innerHTML = `<div class="chips" style="margin-bottom:10px">${wrongChips(w)}</div><div class="q">${wrongQuestionHtml(w, true)}</div>
    <div class="small muted" style="margin:0 4px 12px">来源：${esc(w.source || '')} · ${fmtDateTime(w.createdAt)}${w.reviewCount ? ` · 已复习 ${w.reviewCount} 次` : ''}</div>
    <label class="f"><span>错因 / 笔记</span><textarea id="wn" style="min-height:90px" placeholder="例如：审题不清、公式记错、概念混淆…">${esc(w.note)}</textarea></label>
    <div class="btns" style="margin-bottom:10px"><button class="btn ${w.mastered ? 'plain' : 'ok'}" id="ms">${w.mastered ? '标记为未掌握' : '✓ 已掌握'}</button><button class="btn ghost" id="sim">${icon('sparkle', 18)} 生成相似题</button></div>
    <div class="btns"><button class="btn plain" id="card">加入卡片</button><button class="btn danger" id="del">删除</button></div>`;
  $('#wn').oninput = debounce(e => { w.note = e.target.value; save('wrongs'); }, 400);
  $('#ms').onclick = () => { w.mastered = !w.mastered; save('wrongs'); rerender(); };
  $('#sim').onclick = () => { if (!AI.ready()) return showAIError(new AIError('生成相似题需要先配置 AI。', 'config')); examDraft.types = { single: 0, multiple: 0, judge: 0, blank: 0, short: 0, calc: 0 }; location.hash = `#/learn/exam/new?${w.bookId ? 'book=' + w.bookId + '&' : ''}wrong=${w.id}`; };
  $('#del').onclick = async () => { if (await confirmBox('删除这道错题？', '删除')) { S.wrongs = S.wrongs.filter(x => x !== w); save('wrongs'); location.hash = '#/learn/wrong'; } };
  $('#card').onclick = () => openSheet(`<h2>加入卡片</h2><label class="f"><span>卡组</span><select id="dk">${S.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}<option value="__new">＋ 新建「错题卡片」</option></select></label><button class="btn block" id="ok">加入</button>`, el => {
    $('#ok', el).onclick = () => { let did = $('#dk', el).value; if (did === '__new') { const d = { id: uid(), name: '错题卡片', subject: w.subject, createdAt: Date.now() }; S.decks.push(d); save('decks'); did = d.id; } const front = w.stem + (w.options ? '\n' + w.options.map((o, i) => LETTERS[i] + '. ' + o).join('\n') : ''); S.cards.push(Cards.newCard(did, front, wrongAnswerText(w) + (w.explanation ? '\n\n' + w.explanation : ''))); save('cards'); closeSheet(); toast('已加入卡片复习'); };
  });
});
function editWrong(orig, draft) {
  const isNew = !orig; let w = draft || (orig ? structuredClone(orig) : null); w = w || { id: uid(), subject: WF.subject || '', qtype: 'single', knowledgePoint: '', chapter: '', stem: '', options: null, answer: '', userAnswer: '', explanation: '', note: '', image: '', createdAt: Date.now(), reviewCount: 0, correctStreak: 0, mastered: false, source: '手动添加' };
  const ansStr = a => a == null ? '' : typeof a === 'boolean' ? (a ? '对' : '错') : Array.isArray(a) ? (w.qtype === 'multiple' ? a.join('') : a.join('；')) : String(a);
  let image = w.image;
  openSheet(`<h2>${isNew ? '添加错题' : '编辑错题'}</h2>
    <div class="btns" style="margin-bottom:12px"><button class="btn ghost" id="ph">${icon('camera', 18)} 拍照 / 选图</button>${image ? '<button class="btn plain" id="rmimg">移除图片</button>' : ''}</div>
    <div id="imgBox">${image ? `<img class="thumb" src="${image}">` : ''}</div>
    ${image && AI.visionReady() ? '<button class="btn block ghost" id="rec" style="margin-bottom:12px">' + icon('sparkle', 18) + ' AI 识别图片中的题目</button>' : ''}
    <div class="grid2"><label class="f"><span>科目</span><select id="fS">${subjOptions(w.subject)}</select></label><label class="f"><span>题型</span><select id="fT">${QT_ORDER.map(t => `<option value="${t}" ${w.qtype === t ? 'selected' : ''}>${QT[t].name}</option>`).join('')}</select></label></div>
    <div class="grid2"><label class="f"><span>知识点</span><input type="text" id="fK" value="${esc(w.knowledgePoint)}" placeholder="如：二次函数"></label><label class="f"><span>章节</span><input type="text" id="fC" value="${esc(w.chapter)}" placeholder="可选"></label></div>
    <label class="f"><span>题目</span><textarea id="fQ" style="min-height:90px" placeholder="题干（有图片时可简写）">${esc(w.stem)}</textarea></label>
    <label class="f" id="optBox"><span>选项（每行一个）</span><textarea id="fO" style="min-height:90px" placeholder="选项内容1&#10;选项内容2">${esc((w.options || []).join('\n'))}</textarea></label>
    <div class="grid2"><label class="f"><span>正确答案</span><input type="text" id="fA" value="${esc(ansStr(w.answer))}" placeholder="如：B / AC / 对 / 答案"></label><label class="f"><span>我的答案</span><input type="text" id="fU" value="${esc(ansStr(w.userAnswer))}" placeholder="可选"></label></div>
    <label class="f"><span>解析</span><textarea id="fE" style="min-height:70px">${esc(w.explanation)}</textarea></label>
    <label class="f"><span>错因 / 笔记</span><textarea id="fN" style="min-height:70px" placeholder="审题不清 / 公式记错 / 概念混淆…">${esc(w.note)}</textarea></label>
    <button class="btn block" id="fOk">保存</button>`, el => {
    const syncOpt = () => $('#optBox', el).classList.toggle('hidden', !['single', 'multiple'].includes($('#fT', el).value));
    $('#fT', el).onchange = syncOpt; syncOpt();
    const keep = () => ({ subject: $('#fS', el).value, qtype: $('#fT', el).value, knowledgePoint: $('#fK', el).value, chapter: $('#fC', el).value, stem: $('#fQ', el).value, optionsText: $('#fO', el).value, answer: $('#fA', el).value, userAnswer: $('#fU', el).value, explanation: $('#fE', el).value, note: $('#fN', el).value });
    const reopen = (vals) => { const { optionsText, ...rest } = vals; Object.assign(w, rest, { options: optionsText ? optionsText.split('\n').map(s => s.trim()).filter(Boolean) : null }); w.image = image; editWrong(orig, w); };
    $('#ph', el).onclick = async () => { const [f] = await pickFile('image/*'); if (!f) return; try { image = await compressImage(f, 1400, 0.8); reopen(keep()); } catch (e) { toast(e.message); } };
    const rm = $('#rmimg', el); if (rm) rm.onclick = () => { image = ''; reopen(keep()); };
    const rec = $('#rec', el); if (rec) rec.onclick = async () => {
      const vals = keep();
      try {
        const r = await withLoading('AI 正在识别题目…', sig => AI.vision(image, `识别图片中的一道题目，输出 JSON：{"type":"single|multiple|judge|blank|short|calc","stem":"题干","options":["选项内容（无A.前缀）"],"answer":"正确答案（单选字母/多选字母串如AC/判断填对或错/填空多空用；分隔/主观题写参考答案）","explanation":"简要解析","knowledgePoint":"考查的知识点","userAnswer":"图片中学生写的答案（若有，否则空）"}。如果图片中没有答案，请你自己解答给出正确答案。只输出 JSON。`, { signal: sig }));
        const o = AI.parseJSON(r);
        Object.assign(vals, { qtype: normType(o.type) || vals.qtype, stem: o.stem || vals.stem, optionsText: Array.isArray(o.options) ? o.options.join('\n') : vals.optionsText, answer: Array.isArray(o.answer) ? o.answer.join(o.type === 'multiple' ? '' : '；') : String(o.answer ?? vals.answer), explanation: o.explanation || vals.explanation, knowledgePoint: o.knowledgePoint || vals.knowledgePoint, userAnswer: o.userAnswer || vals.userAnswer });
        reopen(vals); toast('识别完成，请核对');
      } catch (e) { showAIError(e); }
    };
    $('#fOk', el).onclick = () => {
      const vals = keep(); if (!vals.stem.trim() && !image) return toast('请填写题目或添加图片');
      const opts = ['single', 'multiple'].includes(vals.qtype) ? vals.optionsText.split('\n').map(s => s.trim()).filter(Boolean) : null;
      let answer = vals.answer.trim(), userAnswer = vals.userAnswer.trim();
      const conv = (a) => { if (!a) return a; try { const q = normalizeQuestion({ type: vals.qtype, stem: vals.stem || '（见图）', options: opts && opts.length >= 2 ? opts : ['A', 'B'], answer: a }, 0); return q.answer; } catch (e) { return a; } };
      Object.assign(w, { subject: vals.subject, qtype: vals.qtype, knowledgePoint: vals.knowledgePoint.trim(), chapter: vals.chapter.trim(), stem: vals.stem.trim() || '（见图片）', options: opts && opts.length ? opts : null, answer: conv(answer), userAnswer: conv(userAnswer), explanation: vals.explanation.trim(), note: vals.note.trim(), image });
      if (isNew) S.wrongs.unshift(w); else Object.assign(orig, w); save('wrongs'); closeSheet(); if (isNew) location.hash = '#/learn/wrong/' + w.id; else rerender();
    };
  });
}
route('/learn/wrong-review', 'learn', v => {
  setTop('错题复习', { back: '#/learn/wrong' });
  const qkp = Q.get('kp'), qs = Q.get('s');
  let list = qkp != null ? S.wrongs.filter(w => !w.mastered && (w.knowledgePoint || '未标注知识点') === qkp && (qs == null || (w.subject || '') === qs)) : wrongFiltered().filter(w => !w.mastered);
  if (!list.length && qkp == null) list = S.wrongs.filter(w => !w.mastered);
  if (qkp) setTop('复习 · ' + qkp, { back: '#/learn/wrong-analysis' });
  list = list.sort((a, b) => (a.lastReview || 0) - (b.lastReview || 0)).slice(0, 30);
  let i = 0, reveal = false, ok = 0, w_cele = false; Game.resetCombo();
  const draw = () => {
    if (!list.length) { v.innerHTML = `<div class="empty"><div class="big">${icon('trophy', 30)}</div><h2>没有待攻克的错题</h2><a class="btn" href="#/learn/wrong">返回错题本</a></div>`; return; }
    if (i >= list.length) { if (!w_cele) { w_cele = true; Game.practiceDone(list.length, ok, list.length * 3, '错题复习完成！'); } v.innerHTML = `<div class="empty">${Game.doneIcon('var(--c-wrong)')}<h2>本轮复习完成</h2><p>共 ${list.length} 题，会了 ${ok} 题</p><div class="btns"><a class="btn plain" href="#/learn/wrong">返回</a>${AI.ready() ? `<a class="btn" href="#/learn/exam/new?wrong=${list.map(w => w.id).join(',')}" data-reset-types>举一反三练习</a>` : ''}</div></div>`; return; }
    const w = list[i];
    v.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div class="chips">${wrongChips(w)}</div><span class="small muted">${i + 1}/${list.length}</span></div><div class="progress"><i style="width:${i / list.length * 100}%"></i></div>
      <div class="q">${wrongQuestionHtml(w, reveal)}</div>
      ${reveal ? `<div class="btns"><button class="btn danger" id="no">✗ 还不会</button><button class="btn ok" id="yes">✓ 会了</button></div><p class="small muted" style="text-align:center">连续 2 次「会了」将自动标记为已掌握</p>` : `<p class="small muted" style="margin:4px">先在心里或草稿纸上作答，再查看答案。</p><button class="btn block" id="rv" style="min-height:56px">查看答案</button>`}`;
    if (!reveal) $('#rv').onclick = () => { reveal = true; draw(); };
    else {
      const fin = (good) => { Game.combo(good); if (!good) Game.encourage('没关系，多看几遍就会了'); w.reviewCount = (w.reviewCount || 0) + 1; w.lastReview = Date.now(); w.correctStreak = good ? (w.correctStreak || 0) + 1 : 0; if (good) ok++; if (w.correctStreak >= 2 && !w.mastered) { w.mastered = true; toast('已掌握这道题 🎉'); } S.reviews.push({ t: Date.now(), wrongId: w.id, r: good ? 3 : 1, kind: 'wrong' }); save('reviews'); save('wrongs'); i++; reveal = false; draw(); window.scrollTo(0, 0); };
      $('#no').onclick = () => fin(false); $('#yes').onclick = () => fin(true);
    }
  };
  draw();
});
