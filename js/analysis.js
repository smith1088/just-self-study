'use strict';
/* ========== 错题智能分析 · 薄弱点报告 · 专项练习 · 周复习计划 ========== */
const Analysis = {
  compute() {
    const map = new Map(); const now = Date.now(); const cut = now - 14 * DAY;
    const get = (s, k) => { k = String(k || '').trim() || '未标注知识点'; const id = (s || '') + '|' + k; if (!map.has(id)) map.set(id, { id, subject: s || '', kp: k, attempts: 0, wrong: 0, unmastered: 0, rA: 0, rW: 0, pA: 0, pW: 0, types: {}, wrongIds: [], last: 0 }); return map.get(id); };
    const bySubj = {}, byType = {};
    const wk0 = startOfDay() - ((new Date().getDay() + 6) % 7) * DAY; // 本周一
    const weeks = Array.from({ length: 8 }, (_, i) => ({ start: wk0 - (7 - i) * 7 * DAY, a: 0, w: 0, n: 0 }));
    const weekOf = t => weeks.find(x => t >= x.start && t < x.start + 7 * DAY);
    const add = (o, s, type, ok, t) => {
      o.attempts++; if (!ok) { o.wrong++; o.types[type] = (o.types[type] || 0) + 1; }
      if (t >= cut) { o.rA++; if (!ok) o.rW++; } else { o.pA++; if (!ok) o.pW++; }
      const bs = bySubj[s || ''] = bySubj[s || ''] || { a: 0, w: 0 }; bs.a++; if (!ok) bs.w++;
      if (type) { const bt = byType[type] = byType[type] || { a: 0, w: 0 }; bt.a++; if (!ok) bt.w++; }
      const wk = weekOf(t); if (wk) { wk.a++; if (!ok) wk.w++; }
    };
    const examIds = new Set();
    S.exams.filter(e => e.status === 'graded').forEach(e => {
      examIds.add(e.id); const t = e.submittedAt || e.createdAt;
      e.questions.forEach(q => { const r = e.results[q.id]; if (!r || r.status === 'pending') return; const s = q.subject || e.subject || ''; add(get(s, q.knowledgePoint), s, q.type, r.score >= r.max, t); });
    });
    const wById = {};
    S.wrongs.forEach(w => {
      wById[w.id] = w; const o = get(w.subject, w.knowledgePoint); o.wrongIds.push(w.id); if (!w.mastered) o.unmastered++; o.last = Math.max(o.last, w.createdAt || 0);
      if (!w.examId || !examIds.has(w.examId)) add(o, w.subject, w.qtype, false, w.createdAt || now);
      const wk = weekOf(w.createdAt || now); if (wk) wk.n++;
    });
    S.reviews.filter(r => r.kind === 'wrong').forEach(r => { const w = wById[r.wrongId]; if (w) add(get(w.subject, w.knowledgePoint), w.subject, w.qtype, r.r >= 3, r.t); });
    const kps = [...map.values()].filter(o => o.attempts).map(o => {
      o.rate = o.wrong / o.attempts; o.rRate = o.rA ? o.rW / o.rA : null; o.pRate = o.pA ? o.pW / o.pA : null;
      o.trend = o.rA >= 2 && o.pA >= 2 ? o.rRate - o.pRate : null;
      o.score = o.unmastered * 2 + o.rW * 1.5 + o.wrong * 0.5 + o.rate * 4 * Math.min(1, o.attempts / 3);
      return o;
    });
    const weak = kps.filter(o => o.wrong > 0 && (o.unmastered > 0 || o.rate >= 0.3)).sort((a, b) => b.score - a.score);
    const tot = Object.values(bySubj).reduce((a, x) => ({ a: a.a + x.a, w: a.w + x.w }), { a: 0, w: 0 });
    const rec = kps.reduce((a, o) => ({ a: a.a + o.rA, w: a.w + o.rW }), { a: 0, w: 0 }); const prev = kps.reduce((a, o) => ({ a: a.a + o.pA, w: a.w + o.pW }), { a: 0, w: 0 });
    return { kps, weak, bySubj, byType, weeks, tot, rec, prev };
  }
};
const pctS = x => x == null ? '—' : Math.round(x * 100) + '%';
const rateColor = r => r >= 0.5 ? 'var(--bad)' : r >= 0.25 ? 'var(--warn)' : 'var(--ok)';
function trendHtml(t) { if (t == null) return ''; const d = Math.round(t * 100); if (Math.abs(d) < 3) return '<span class="small muted">持平</span>'; return d > 0 ? `<span class="small" style="color:var(--bad)">↑${d}%</span>` : `<span class="small" style="color:var(--ok)">↓${-d}%</span>`; }
function rateBars(obj, labelOf) {
  const ent = Object.entries(obj).filter(([, x]) => x.a).sort((a, b) => b[1].w / b[1].a - a[1].w / a[1].a);
  return ent.length ? ent.map(([k, x]) => `<div class="hbar"><span class="lab">${esc(labelOf(k))}</span><span class="track"><i style="width:${Math.max(2, x.w / x.a * 100)}%;background:${rateColor(x.w / x.a)}"></i></span><span class="val">${pctS(x.w / x.a)} <small class="muted">${x.w}/${x.a}</small></span></div>`).join('') : '<div class="small muted">暂无数据</div>';
}

route('/learn/wrong-analysis', 'learn', v => {
  setTop('薄弱点分析', { back: '#/learn/wrong' });
  const A = Analysis.compute();
  if (!A.tot.a) {
    v.innerHTML = `<div class="empty"><div class="big">${icon('search', 30)}</div><h2>还没有可分析的数据</h2><p>做几套试卷或把错题加入错题本后，这里会按<b>科目、知识点、题型</b>统计错误率和变化趋势，找出薄弱点。</p><div class="btns"><a class="btn" href="#/learn/exam/new">去做一套题</a><a class="btn plain" href="#/learn/solve">${icon('camera', 18)} 拍照搜题</a></div></div>`;
    return;
  }
  const unm = S.wrongs.filter(w => !w.mastered).length;
  const rR = A.rec.a ? A.rec.w / A.rec.a : null, pR = A.prev.a ? A.prev.w / A.prev.a : null;
  const rep = S.meta.weakReport;
  const wkPts = A.weeks.map(w => ({ y: w.a ? Math.round((1 - w.w / w.a) * 100) : null, label: shortMD(w.start) }));
  const hasWk = wkPts.filter(p => p.y != null);
  v.innerHTML = `<div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="v" style="color:var(--bad)">${unm}</div><div class="l">待攻克错题</div></div><div class="stat"><div class="v">${pctS(rR ?? A.tot.w / A.tot.a)}</div><div class="l">${rR != null ? '近 14 天错误率' : '总错误率'}</div></div><div class="stat"><div class="v" style="font-size:20px">${rR != null && pR != null ? (rR <= pR ? `<span style="color:var(--ok)">↓${Math.round((pR - rR) * 100)}%</span>` : `<span style="color:var(--bad)">↑${Math.round((rR - pR) * 100)}%</span>`) : '—'}</div><div class="l">较之前</div></div></div>
    <div class="btns" style="margin-bottom:12px"><button class="btn" id="plan">${icon('calendar', 18)} 生成本周复习计划</button><button class="btn ghost" id="rep">${icon('sparkle', 18)} ${rep ? '更新' : '生成'} AI 报告</button></div>
    ${rep ? `<div class="card md report"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b>薄弱点报告</b><span>${spkBtn(rep.text)}<span class="small muted">${fmtDateTime(rep.at)}</span></span></div>${md(rep.text)}</div>` : ''}
    <h3>薄弱知识点排行 <span class="small muted" style="font-weight:400">点开可专项练习</span></h3>
    ${A.weak.length ? `<div class="list" id="weak">${A.weak.slice(0, 12).map((o, i) => `<div class="row" data-id="${esc(o.id)}" style="align-items:flex-start"><b class="rank r${Math.min(i, 3)}">${i + 1}</b><div class="grow"><div class="t" style="white-space:normal">${esc(o.kp)}</div><div class="s">${o.subject ? esc(subj(o.subject).name) + ' · ' : ''}错 ${o.wrong}/${o.attempts} 次 · 未掌握 ${o.unmastered} 题${Object.keys(o.types).length ? ' · 多错在' + Object.entries(o.types).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => QT[t]?.short || t).join('、') : ''}</div><div class="progress" style="margin:6px 0 0;height:5px"><i style="width:${o.rate * 100}%;background:${rateColor(o.rate)}"></i></div></div><div style="text-align:right;min-width:52px"><b style="color:${rateColor(o.rate)}">${pctS(o.rate)}</b><div>${trendHtml(o.trend)}</div></div></div>`).join('')}</div>` : '<div class="notice info">没有明显的薄弱点，继续保持！👏</div>'}
    <div class="card"><b>按科目 · 错误率</b>${rateBars(A.bySubj, k => k ? subj(k).name : '未分类')}</div>
    <div class="card"><b>按题型 · 错误率</b>${rateBars(A.byType, k => QT[k]?.short || k)}</div>
    <div class="card"><div style="display:flex;justify-content:space-between"><b>近 8 周正确率</b><span class="small muted">新增错题 ${A.weeks.map(w => w.n).join(' · ')}</span></div>${hasWk.length ? lineChart(wkPts.map(p => ({ y: p.y ?? 0, label: p.label })).filter((p, i) => wkPts[i].y != null), { h: 150 }) : '<div class="small muted">暂无数据</div>'}</div>
    <p class="small muted" style="margin:4px">统计口径：试卷每道题算一次作答；错题复习中“会了 / 还不会”也计入；手动或拍照加入的错题算一次答错。趋势为近 14 天与之前相比。</p>`;
  const wl = $('#weak'); if (wl) wl.onclick = e => { const r = e.target.closest('[data-id]'); if (r) weakSheet(A.kps.find(o => o.id === r.dataset.id)); };
  $('#plan').onclick = () => weeklyPlanSheet(A);
  $('#rep').onclick = () => weakReportAI(A);
});

function weakSheet(o) {
  if (!o) return; const ws = o.wrongIds.map(id => S.wrongs.find(w => w.id === id)).filter(Boolean); const todo = ws.filter(w => !w.mastered);
  openSheet(`<h2>${esc(o.kp)}</h2><div class="chips" style="margin-bottom:10px">${subjChip(o.subject)}<span class="chip">错误率 ${pctS(o.rate)}</span><span class="chip">错 ${o.wrong}/${o.attempts}</span>${o.trend != null ? `<span class="chip">近期 ${trendHtml(o.trend)}</span>` : ''}</div>
    <div class="list">
      <div class="row" id="ai">${iconTile('sparkle', '#8b5cf6', 18)}<div class="grow"><div class="t">AI 专项练习</div><div class="s">${AI.ready() ? '围绕该知识点出 8 题左右新题，含错题变式' : '需要先配置 AI'}</div></div><span class="chev">›</span></div>
      <div class="row" id="redo" ${ws.length ? '' : 'style="opacity:.5"'}>${iconTile('edit', '#f59e0b', 18)}<div class="grow"><div class="t">重做本知识点错题（${ws.length}）</div><div class="s">组成一份小卷，自动判分</div></div><span class="chev">›</span></div>
      <div class="row" id="rev" ${todo.length ? '' : 'style="opacity:.5"'}>${iconTile('repeat', '#3b82f6', 18)}<div class="grow"><div class="t">逐题复习（${todo.length} 道未掌握）</div><div class="s">看题 → 回忆 → 对答案</div></div><span class="chev">›</span></div>
      <div class="row" id="list">${iconTile('wrong', '#f05252', 18)}<div class="grow"><div class="t">在错题本中查看</div></div><span class="chev">›</span></div>
    </div>`, el => {
    $('#ai', el).onclick = () => { closeSheet(true); kpPractice(o); };
    $('#redo', el).onclick = () => { if (!ws.length) return; closeSheet(true); const e = examFromWrongs(ws, `错题重做 · ${o.kp}`); if (e) location.hash = '#/learn/exam/' + e.id; };
    $('#rev', el).onclick = () => { if (!todo.length) return; closeSheet(true); location.hash = '#/learn/wrong-review?kp=' + encodeURIComponent(o.kp) + '&s=' + encodeURIComponent(o.subject); };
    $('#list', el).onclick = () => { closeSheet(true); Object.assign(WF, { subject: o.subject, kp: o.kp === '未标注知识点' ? '' : o.kp, status: 'all', qtype: '', q: '' }); location.hash = '#/learn/wrong'; };
  });
}
// 用错题组卷（无需 AI）
function examFromWrongs(ws, title) {
  const qs = [];
  ws.slice(0, 30).forEach((w, i) => { try { const q = normalizeQuestion({ type: w.qtype, stem: w.stem, options: w.options, answer: w.answer, explanation: w.explanation, knowledgePoint: w.knowledgePoint, image: w.image }, i); q.subject = w.subject; q.wrongRef = w.id; qs.push(q); } catch (e) { } });
  if (!qs.length) { toast('这些错题缺少标准答案，无法自动组卷，请用逐题复习'); return null; }
  qs.sort((a, b) => QT_ORDER.indexOf(a.type) - QT_ORDER.indexOf(b.type));
  const e = { id: uid(), title, subject: ws[0]?.subject || '', createdAt: Date.now(), difficulty: 'mixed', questions: qs, status: 'new', answers: {}, results: {}, redo: true, timeLimit: 0 };
  S.exams.push(e); save('exams'); return e;
}
function kpPractice(o) {
  if (!AI.ready()) return showAIError(new AIError('AI 专项练习需要先在「我的 → 设置」中配置 AI；也可以先用「重做本知识点错题」。', 'config'));
  const ws = o.wrongIds.map(id => S.wrongs.find(w => w.id === id)).filter(Boolean);
  const types = ZERO_TYPES(); Object.entries(o.types).forEach(([t, n]) => { if (types[t] != null) types[t] = Math.min(4, n + 1); });
  const objective = ['single', 'multiple', 'judge', 'blank'];
  let total = QT_ORDER.reduce((a, t) => a + types[t], 0);
  for (const t of ['single', 'blank', 'judge']) { if (total >= 8) break; const add = Math.min(8 - total, 3); types[t] += add; total += add; }
  if (!objective.some(t => types[t])) types.single = 3;
  Object.assign(examDraft, { types, difficulty: 'mixed', preset: '', cet: false, timeLimit: 0, extra: `这是针对学生薄弱知识点「${o.kp}」的专项练习：题目由易到难，覆盖该知识点的常见考法和易错点，解析中指出易错原因。` });
  const pool = ws.filter(w => !w.mastered).slice(0, 3);
  total = QT_ORDER.reduce((a, t) => a + types[t], 0) + pool.length;
  generateExam({ b: null, chSel: new Set(), topic: `${o.subject ? subj(o.subject).name + ' · ' : ''}${o.kp}`, subjectId: o.subject, pool, total, title: `专项练习 · ${o.kp}`, kp: o.kp });
}
async function weakReportAI(A) {
  if (!AI.ready()) return showAIError(new AIError('AI 报告需要先在「我的 → 设置」中配置 AI。上面的统计不需要 AI 也能使用。', 'config'));
  const top = A.weak.slice(0, 10).map(o => {
    const ws = o.wrongIds.map(id => S.wrongs.find(w => w.id === id)).filter(Boolean).slice(0, 3);
    return `- ${o.subject ? subj(o.subject).name : '未分类'} / ${o.kp}：作答 ${o.attempts} 次，错 ${o.wrong} 次（错误率 ${pctS(o.rate)}），未掌握 ${o.unmastered} 题，近 14 天错误率 ${pctS(o.rRate)}，之前 ${pctS(o.pRate)}；常错题型：${Object.keys(o.types).map(t => QT[t]?.short || t).join('、') || '—'}${ws.length ? '；错题示例：' + ws.map(w => `「${w.stem.slice(0, 80)}」${w.note ? '（学生错因笔记：' + w.note.slice(0, 60) + '）' : ''}`).join(' ') : ''}`;
  }).join('\n');
  const subjLine = Object.entries(A.bySubj).map(([k, x]) => `${k ? subj(k).name : '未分类'} 错误率 ${pctS(x.w / x.a)}（${x.w}/${x.a}）`).join('；');
  const typeLine = Object.entries(A.byType).map(([k, x]) => `${QT[k]?.short || k} ${pctS(x.w / x.a)}`).join('；');
  const prompt = `我是一名大一学生，下面是我的错题统计数据，请帮我写一份「薄弱点报告」。
总体：共作答 ${A.tot.a} 次，错 ${A.tot.w} 次；近 14 天错误率 ${pctS(A.rec.a ? A.rec.w / A.rec.a : null)}，之前 ${pctS(A.prev.a ? A.prev.w / A.prev.a : null)}。
按科目：${subjLine}
按题型：${typeLine}
薄弱知识点（按严重程度排序）：
${top || '（无）'}

要求：用 Markdown 输出，使用以下小标题：## 总体判断、## 最需要补的 3 个知识点（每个写：可能的原因、要回看的概念/公式、1 个典型练习方向）、## 题型与习惯问题、## 接下来 7 天怎么练（按天列出，每天 30–60 分钟）。语言简洁具体、鼓励但不空泛，总字数 600 字以内。公式用 LaTeX（$...$）。`;
  try {
    const text = await withLoading('AI 正在分析你的薄弱点…', sig => AI.chat([{ role: 'system', content: '你是一位耐心、专业的大学学习教练，擅长根据数据诊断学习问题并给出可执行的建议。' }, { role: 'user', content: prompt }], { signal: sig, temperature: 0.4 }));
    S.meta.weakReport = { at: Date.now(), text: text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }; DB.set('meta', S.meta); rerender(); toast('报告已生成');
  } catch (e) { showAIError(e); }
}
function weeklyPlanSheet(A) {
  const top = A.weak.slice(0, 5); const t0 = startOfDay(); const wk = dayKey(t0);
  const items = [];
  top.forEach((o, i) => {
    const sn = o.subject ? subj(o.subject).name + '·' : '';
    items.push({ day: i, title: `专项练习：${sn}${o.kp}`, note: `薄弱点（错误率 ${pctS(o.rate)}，未掌握 ${o.unmastered} 题）。到「学习 → 错题本 → 薄弱点分析」点开该知识点做专项练习。`, priority: 2, subject: o.subject, estimate: 30, tag: `weak:${o.id}:p` });
    items.push({ day: Math.min(6, i + 3), title: `回顾：${sn}${o.kp} 错题复习`, note: '间隔复习：重做/复习该知识点的错题，连续两次做对即标记掌握。', priority: 1, subject: o.subject, estimate: 15, tag: `weak:${o.id}:r` });
  });
  if (top.length) { const ss = [...new Set(top.map(o => o.subject).filter(Boolean))].slice(0, 2); items.push({ day: 6, title: `周末限时模拟：${ss.map(s => subj(s).name).join(' / ') || '综合'}`, note: '在「学习 → AI 出题」选择模拟考试预设，限时完成并查看成绩趋势。', priority: 2, subject: ss[0] || '', estimate: 90, tag: 'weak:mock' }); }
  for (let d = 0; d < 7; d++) items.push({ day: d, title: '错题复习 10 分钟', note: '打开错题本 → 错题复习。', priority: 0, subject: '', estimate: 10, tag: 'weak:daily' });
  items.forEach(it => { it.due = dayKey(t0 + it.day * DAY); it.planTag = `${wk}|${it.tag}|${it.due}`; it.exists = S.todos.some(t => t.planTag === it.planTag); });
  items.sort((a, b) => a.day - b.day || b.priority - a.priority);
  if (!top.length) return toast('还没有明显的薄弱点，暂不需要专项计划');
  const fresh = items.filter(x => !x.exists);
  openSheet(`<h2>本周复习计划</h2><p class="small muted">根据薄弱点排行自动安排：每个薄弱点先专项练习，3 天后间隔回顾；每天 10 分钟错题复习；周末一套限时模拟。将添加到「计划」。</p>
    <div class="list" style="max-height:50vh;overflow:auto">${items.map(it => `<div class="row" style="min-height:48px;${it.exists ? 'opacity:.5' : ''}"><div style="width:52px" class="small muted">${it.day === 0 ? '今天' : it.day === 1 ? '明天' : '周' + WEEK[new Date(t0 + it.day * DAY).getDay()]}</div><div class="grow"><div class="t" style="white-space:normal">${esc(it.title)}</div><div class="s">${it.estimate} 分钟${it.exists ? ' · 已在计划中' : ''}</div></div></div>`).join('')}</div>
    <button class="btn block" id="ok" style="margin-top:12px" ${fresh.length ? '' : 'disabled'}>${fresh.length ? `添加 ${fresh.length} 项到计划` : '已全部添加'}</button>`, el => {
    $('#ok', el).onclick = () => {
      fresh.forEach(it => S.todos.push({ id: uid(), title: it.title, note: it.note, due: it.due, priority: it.priority, subject: it.subject, done: false, doneAt: 0, createdAt: Date.now(), estimate: it.estimate, planTag: it.planTag }));
      save('todos'); closeSheet(); toast(`已添加 ${fresh.length} 项到计划`); setTimeout(() => location.hash = '#/plan', 300);
    };
  });
}
