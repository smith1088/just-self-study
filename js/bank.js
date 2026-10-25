'use strict';
/* ========== 题库刷题（参考 Kuai-Shua-Questions / IELTS-practice：本地题库导入、顺序练习断点续刷、随机抽题、错题重练、随机组卷） ========== */
const Bank = {
  byId: id => S.banks.find(b => b.id === id),
  stat(b) {
    const st = b.stats || {}; let done = 0, ok = 0, wrong = 0;
    b.questions.forEach(q => { const s = st[q.id]; if (!s) return; done++; if (s.last === 'ok') ok++; else wrong++; });
    const att = Object.values(st).reduce((a, s) => a + s.n, 0), cor = Object.values(st).reduce((a, s) => a + s.ok, 0);
    return { total: b.questions.length, done, ok, wrong, acc: att ? cor / att : null };
  },
  wrongQs: b => b.questions.filter(q => b.stats?.[q.id] && b.stats[q.id].last !== 'ok'),
  record(b, q, status, ms) {
    b.stats = b.stats || {}; const s = b.stats[q.id] = b.stats[q.id] || { n: 0, ok: 0, last: '', t: 0, ms: 0 };
    s.n++; if (status === 'ok') s.ok++; s.last = status; s.t = Date.now(); s.ms += Math.min(ms || 0, 600000);
  },
  make(title, subject, questions) { return { id: uid(), title: title || '未命名题库', subject: subject || '', createdAt: Date.now(), questions, pos: 0, stats: {} }; },
  // 解析导入内容：JSON（数组 / {questions}）或常见文本格式
  parse(text) {
    const t = String(text || '').trim(); if (!t) throw new Error('内容为空');
    let raws, title = '';
    if (/^[\[{]/.test(t)) {
      let o; try { o = JSON.parse(t); } catch (e) { throw new Error('JSON 格式有误：' + e.message); }
      raws = Array.isArray(o) ? o : o.questions; title = o.title || '';
      if (!Array.isArray(raws)) throw new Error('JSON 中没有 questions 数组');
    } else raws = this.parseText(t);
    const qs = [], errs = [];
    raws.forEach((r, i) => { try { const q = normalizeQuestion(r, i); if (r.subject) q.subject = r.subject; qs.push(q); } catch (e) { errs.push(e.message); } });
    if (!qs.length) throw new Error(errs[0] || '没有识别到题目，请检查格式');
    return { title, questions: qs, errors: errs };
  },
  parseText(t) {
    const lines = t.replace(/\r/g, '').split('\n'); const out = []; let cur = null, field = 'stem';
    const push = () => { if (cur && cur.stem.trim()) out.push(cur); };
    const OPT = /^\s*[（(]?([A-Ha-h])[）).、．:：]\s*/;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) continue;
      const head = line.match(/^(?:第\s*)?(\d{1,4})\s*(?:题)?[.、．)）:：]\s*(.*)$/);
      const ans = line.match(/^[【\[]?(?:正确答案|参考答案|答案)[】\]]?\s*[:：]?\s*(.*)$/);
      const exp = line.match(/^[【\[]?(?:解析|答案解析|分析)[】\]]?\s*[:：]?\s*(.*)$/);
      if (head && !(cur && field === 'exp' && /^\d+[.)]\d/.test(line))) { push(); cur = { stem: head[2], options: [], answer: '', explanation: '' }; field = 'stem'; continue; }
      if (!cur) { cur = { stem: '', options: [], answer: '', explanation: '' }; }
      if (ans) { cur.answer = ans[1].trim(); field = 'ans'; continue; }
      if (exp) { cur.explanation = exp[1].trim(); field = 'exp'; continue; }
      if (OPT.test(line) && field !== 'exp') {
        // 同一行可能有多个选项：A. 1  B. 2
        line.split(/\s+(?=[A-H][.、．:：)）])/).forEach(p => { const m = p.match(OPT); if (m) cur.options.push(p.replace(OPT, '').trim()); else if (cur.options.length) cur.options[cur.options.length - 1] += ' ' + p; });
        field = 'opt'; continue;
      }
      if (field === 'exp') cur.explanation += '\n' + line; else if (field === 'ans') cur.answer += '\n' + line; else if (field === 'opt' && cur.options.length) cur.options[cur.options.length - 1] += ' ' + line; else cur.stem += (cur.stem ? '\n' : '') + line;
    }
    push();
    return out.map(q => {
      const tag = q.stem.match(/^[【\[(（]\s*(单选|多选|判断|填空|简答|计算|问答)[题]?\s*[】\])）]\s*/); if (tag) q.stem = q.stem.slice(tag[0].length);
      const a = q.answer.trim(); let type;
      if (tag) type = { 单选: 'single', 多选: 'multiple', 判断: 'judge', 填空: 'blank', 简答: 'short', 问答: 'short', 计算: 'calc' }[tag[1]];
      else if (q.options.length >= 2) type = /^[A-Ha-h]{2,}$/.test(a.replace(/[\s,，、]/g, '')) ? 'multiple' : 'single';
      else if (/^(对|错|正确|错误|√|×|✓|✗|T|F|true|false|是|否)$/i.test(a)) type = 'judge';
      else if (/_{2,}|（\s*）|\(\s*\)/.test(q.stem) && a.length <= 40) type = 'blank';
      else type = 'short';
      if (type === 'blank') q.stem = q.stem.replace(/（\s*）|\(\s*\)/g, '____');
      if (type === 'multiple') q.answer = a.replace(/[^A-Ha-h]/g, '').split('');
      else if (type === 'blank') q.answer = a.split(/[;；]|\s{2,}/).map(x => x.trim()).filter(Boolean);
      else q.answer = a;
      return { type, stem: q.stem, options: q.options.length ? q.options : undefined, answer: q.answer, explanation: q.explanation.trim() };
    });
  },
  seed() {
    if (S.meta.bankSeeded) return; S.meta.bankSeeded = true; DB.set('meta', S.meta);
    if (S.banks.length) return;
    const { questions } = validateExam({ questions: DEMO_QUESTIONS }); questions.forEach((q, i) => q.subject = DEMO_QUESTIONS[i].subject);
    S.banks.push(this.make('示例题库 · 大一综合（高数/线代/C/思政/英语）', '', questions)); save('banks');
  },
  addFromExam(e) {
    openSheet(`<h2>加入题库</h2><p class="small muted">把这份试卷的 ${e.questions.length} 道题存进题库，以后可以顺序刷、随机刷。</p><div class="list">${S.banks.map(b => `<div class="row" data-b="${b.id}"><div class="grow"><div class="t">${esc(b.title)}</div><div class="s">${b.questions.length} 题</div></div><span class="chev">›</span></div>`).join('')}<div class="row" data-b="__new" style="color:var(--pri)">＋ 新建题库「${esc(e.title.slice(0, 20))}」</div></div>`, el => {
      el.querySelector('.list').onclick = ev => {
        const r = ev.target.closest('[data-b]'); if (!r) return;
        const qs = structuredClone(e.questions).map(q => ({ ...q, id: uid(), subject: q.subject || e.subject || '' }));
        let b; if (r.dataset.b === '__new') { b = Bank.make(e.title, examSubject(e), qs); S.banks.push(b); }
        else { b = Bank.byId(r.dataset.b); const seen = new Set(b.questions.map(q => q.stem)); b.questions.push(...qs.filter(q => !seen.has(q.stem))); }
        save('banks'); closeSheet(); toast(`已加入「${b.title.slice(0, 16)}」`);
      };
    });
  }
};
const shuffleArr = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function downloadText(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

const BANK_FORMAT = `1. 设 $A$ 为 3 阶方阵，$|A|=2$，则 $|2A|=$（ ）
A. 4
B. 8
C. 16
D. 6
答案：C
解析：$|kA|=k^n|A|$

2. 【判断】C 语言中 0 表示假。
答案：对

3. 重要极限 $\\lim_{x\\to0}\\frac{\\sin x}{x}=$____
答案：1`;
function importBankSheet(target) {
  openSheet(`<h2>${target ? '向题库追加题目' : '导入题库'}</h2>
    <p class="small muted">支持两种格式：①常见文本题库（题号 + A/B/C/D 选项 + 「答案：」+「解析：」，题型自动识别，可用【单选】【多选】【判断】【填空】【简答】标注）；②JSON（与 AI 出卷相同的 questions 数组）。公式用 $...$。</p>
    ${target ? '' : '<label class="f"><span>题库名称</span><input type="text" id="bt" placeholder="如：高数期末题库"></label><label class="f"><span>科目</span><select id="bs">' + subjOptions('') + '</select></label>'}
    <textarea id="bx" style="min-height:200px;font-size:14px" placeholder="${esc(BANK_FORMAT)}"></textarea>
    <div class="btns" style="margin-top:10px"><button class="btn plain" id="bf">从文件（.txt/.json/.md）</button><button class="btn plain" id="bex">填入示例</button><button class="btn" id="bo">导入</button></div>`, el => {
    $('#bf', el).onclick = async () => { const [f] = await pickFile('.txt,.json,.md,text/plain,application/json'); if (!f) return; $('#bx', el).value = await readFileAs(f); if (!target && !$('#bt', el).value) $('#bt', el).value = f.name.replace(/\.\w+$/, ''); };
    $('#bex', el).onclick = () => { $('#bx', el).value = BANK_FORMAT; };
    $('#bo', el).onclick = () => {
      let res; try { res = Bank.parse($('#bx', el).value); } catch (e) { return toast(e.message); }
      const sub = target ? target.subject : $('#bs', el).value; res.questions.forEach(q => { if (!q.subject) q.subject = sub; });
      let b = target; if (b) b.questions.push(...res.questions); else { b = Bank.make($('#bt', el).value.trim() || res.title || `题库 ${S.banks.length + 1}`, sub, res.questions); S.banks.push(b); }
      save('banks'); closeSheet(); toast(`已导入 ${res.questions.length} 题${res.errors.length ? `，${res.errors.length} 题格式有误已跳过` : ''}`);
      location.hash = '#/learn/bank/' + b.id; rerender();
    };
  });
}
route('/learn/banks', 'learn', v => {
  setTop('题库刷题', { back: '#/learn', actions: `<button class="icon-btn" id="imp" aria-label="导入题库">＋</button>` });
  $('#imp').onclick = () => importBankSheet();
  v.innerHTML = `${S.banks.length ? `<div class="list">${S.banks.map(b => { const s = Bank.stat(b); return `<a class="row" href="#/learn/bank/${b.id}">${iconTile('layers', subj(b.subject)?.color || '#14b8a6', 18)}<div class="grow"><div class="t">${esc(b.title)}</div><div class="s">${s.total} 题 · 已做 ${s.done}${s.acc != null ? ` · 正确率 ${Math.round(s.acc * 100)}%` : ''}${s.wrong ? ` · <b style="color:var(--bad)">错 ${s.wrong}</b>` : ''}</div><div class="progress" style="margin:6px 0 0;height:4px"><i style="width:${s.total ? s.done / s.total * 100 : 0}%"></i></div></div><span class="chev">›</span></a>`; }).join('')}</div>`
    : emptyState('layers', '还没有题库', '导入老师发的题库或往年题，就能顺序刷题、随机抽题、错题重练。', '<button class="btn" id="imp2">导入题库</button>')}
    <button class="btn ghost block" id="imp3" style="margin-top:12px">＋ 导入题库（文本 / JSON）</button>
    <p class="small muted" style="margin:10px 4px">做完的 AI 试卷也能在试卷「⋯」菜单里一键「加入题库」。做错的题会自动进入错题本。</p>`;
  const i2 = $('#imp2'); if (i2) i2.onclick = () => importBankSheet(); $('#imp3').onclick = () => importBankSheet();
});
route('/learn/bank/:id', 'learn', (v, id) => {
  const b = Bank.byId(id); if (!b) { location.hash = '#/learn/banks'; return; }
  setTop('题库', { back: '#/learn/banks', actions: `<button class="icon-btn txt" id="more">⋯</button>` });
  const s = Bank.stat(b); const pos = Math.min(b.pos || 0, s.total); const wq = Bank.wrongQs(b).length;
  v.innerHTML = `<div class="card"><b style="font-size:18px">${esc(b.title)}</b><div class="small muted" style="margin-top:2px">${s.total} 题${b.subject ? ' · ' + esc(subj(b.subject).name) : ''}</div>
    <div class="grid3" style="margin-top:12px"><div class="stat"><div class="v">${s.done}</div><div class="l">已做</div></div><div class="stat"><div class="v" style="color:var(--ok)">${s.acc != null ? Math.round(s.acc * 100) + '%' : '—'}</div><div class="l">正确率</div></div><div class="stat"><div class="v" style="color:var(--bad)">${s.wrong}</div><div class="l">待重练</div></div></div></div>
    <a class="btn block" href="#/learn/bank-do/${b.id}?mode=seq" style="min-height:52px;margin-bottom:10px">${pos > 0 && pos < s.total ? `继续顺序练习（第 ${pos + 1}/${s.total} 题）` : pos >= s.total && s.total ? '顺序练习（已刷完一遍，从头再来）' : '开始顺序练习'}</a>
    <div class="grid2" style="margin-bottom:10px"><a class="btn ghost" href="#/learn/bank-do/${b.id}?mode=rand">${icon('shuffle', 17)} 随机刷题</a><a class="btn ghost ${wq ? '' : 'disabled'}" href="${wq ? `#/learn/bank-do/${b.id}?mode=wrong` : 'javascript:void 0'}">${icon('repeat', 17)} 错题重练${wq ? `（${wq}）` : ''}</a></div>
    <button class="btn plain block" id="draw">${icon('exam', 18)} 随机抽题组卷 · 限时模拟</button>
    <h3>题目列表</h3><div class="qgrid" id="qg">${b.questions.map((q, i) => { const st = b.stats?.[q.id]; return `<a class="qn ${st ? (st.last === 'ok' ? 'ok' : 'bad') : ''} ${i === pos ? 'cur' : ''}" href="#/learn/bank-do/${b.id}?mode=seq&at=${i}">${i + 1}</a>`; }).join('')}</div>
    <p class="small muted" style="margin:8px 4px">绿色＝最近一次做对，红色＝做错，点题号可从该题开始顺序练习。</p>`;
  $('#draw').onclick = () => openSheet(`<h2>随机抽题组卷</h2><p class="small muted">从本题库随机抽题，生成一份限时试卷（交卷后可打印、记录成绩、错题入本）。</p>
    <label class="f"><span>题量（共 ${s.total} 题）</span><select id="dn">${[5, 10, 20, 30, 50].filter(n => n < s.total).concat([s.total]).map(n => `<option value="${n}" ${n === Math.min(20, s.total) ? 'selected' : ''}>${n === s.total ? `全部 ${n}` : n} 题</option>`).join('')}</select></label>
    <label class="f"><span>限时</span><select id="dt"><option value="0">不限时</option>${[10, 20, 30, 45, 60, 90, 120].map(m => `<option value="${m}" ${m === 30 ? 'selected' : ''}>${m} 分钟</option>`).join('')}</select></label>
    <label class="check-row" style="display:flex;gap:8px;align-items:center;margin-bottom:14px"><input type="checkbox" id="dw"> 优先抽错题和没做过的题</label>
    <button class="btn block" id="dgo">生成并开始</button>`, el => {
    $('#dgo', el).onclick = () => {
      const n = +$('#dn', el).value; let pool = shuffleArr(b.questions);
      if ($('#dw', el).checked) pool.sort((x, y) => { const k = q => { const st = b.stats?.[q.id]; return !st ? 1 : st.last !== 'ok' ? 0 : 2; }; return k(x) - k(y); });
      const pick = pool.slice(0, n).sort((x, y) => QT_ORDER.indexOf(x.type) - QT_ORDER.indexOf(y.type));
      const e = { id: uid(), title: `${b.title.slice(0, 18)} · 随机组卷`, subject: b.subject || '', createdAt: Date.now(), difficulty: 'mixed', questions: structuredClone(pick), status: 'new', answers: {}, results: {}, timeLimit: +$('#dt', el).value, fromBank: b.id };
      S.exams.push(e); save('exams'); closeSheet(); location.hash = '#/learn/exam/' + e.id;
    };
  });
  $('#more').onclick = () => openSheet(`<h2>题库操作</h2><div class="list"><div class="row" id="ba">＋ 追加题目</div><div class="row" id="bn">重命名</div><div class="row" id="br">重置做题进度与统计</div><div class="row" id="be">导出为 JSON</div><div class="row" id="bd" style="color:var(--bad)">删除题库</div></div>`, el => {
    $('#ba', el).onclick = () => importBankSheet(b);
    $('#bn', el).onclick = () => openSheet(`<h2>重命名题库</h2><label class="f"><span>名称</span><input type="text" id="nn" value="${esc(b.title)}"></label><button class="btn block" id="nok">保存</button>`, e2 => { $('#nok', e2).onclick = () => { const t = $('#nn', e2).value.trim(); if (t) { b.title = t; save('banks'); } closeSheet(); rerender(); }; });
    $('#br', el).onclick = async () => { if (await confirmBox('清空该题库的做题记录和断点？', '重置')) { b.stats = {}; b.pos = 0; save('banks'); closeSheet(); rerender(); } };
    $('#be', el).onclick = () => { downloadText(`${b.title}.json`, JSON.stringify({ title: b.title, questions: b.questions.map(({ id, ...q }) => q) }, null, 1)); };
    $('#bd', el).onclick = async () => { if (await confirmBox(`删除题库「${b.title}」？（错题本中的题目会保留）`, '删除')) { S.banks = S.banks.filter(x => x !== b); save('banks'); closeSheet(); location.hash = '#/learn/banks'; } };
  });
});
route('/learn/bank-do/:id', 'learn', (v, id) => {
  const b = Bank.byId(id); if (!b || !b.questions.length) { location.hash = '#/learn/banks'; return; }
  const mode = Q.get('mode') || 'seq';
  setTop(mode === 'seq' ? '顺序练习' : mode === 'rand' ? '随机刷题' : '错题重练', { back: '#/learn/bank/' + id });
  let order;
  if (mode === 'seq') order = b.questions.slice();
  else if (mode === 'wrong') order = shuffleArr(Bank.wrongQs(b));
  else { const sh = shuffleArr(b.questions); order = sh.filter(q => !b.stats?.[q.id]).concat(sh.filter(q => b.stats?.[q.id])); }
  if (!order.length) { v.innerHTML = emptyState('check', '没有需要重练的错题', '太棒了！', `<a class="btn" href="#/learn/bank/${id}">返回</a>`); return; }
  let i = mode === 'seq' ? (Q.get('at') != null ? +Q.get('at') : (b.pos || 0)) : 0; if (i >= order.length || i < 0) i = 0;
  const sess = { n: 0, ok: 0 }; const state = {}; // qid -> {a, r}
  let t0 = Date.now();
  const fakeExam = { id: 'bank:' + b.id, title: '题库 · ' + b.title, subject: b.subject };
  const gradeNow = q => {
    const st = state[q.id]; const r = QT[q.type].objective ? gradeObjective(q, st.a) : { score: 0, max: q.score, status: 'pending', by: 'self' };
    st.r = r; if (r.status !== 'pending') finish(q, r);
    draw();
  };
  const finish = (q, r) => {
    const st = state[q.id]; if (st.counted) return; st.counted = true;
    Bank.record(b, q, r.status === 'ok' ? 'ok' : 'bad', Date.now() - t0); sess.n++; if (r.status === 'ok') sess.ok++;
    Game.addExtra(r.status === 'ok' ? 3 : 1); sess.xp = (sess.xp || 0) + (r.status === 'ok' ? 3 : 1); Game.combo(r.status === 'ok'); if (r.status !== 'ok') Game.encourage();
    if (r.status !== 'ok' && !S.wrongs.some(w => w.examId === fakeExam.id && w.qid === q.id)) { S.wrongs.unshift(wrongFromQuestion(q, fakeExam, st.a, r)); save('wrongs'); toast('已加入错题本'); }
    if (r.status === 'ok' && mode === 'wrong') { const w = S.wrongs.find(w => w.examId === fakeExam.id && w.qid === q.id); if (w) { w.correctStreak = (w.correctStreak || 0) + 1; w.reviewCount = (w.reviewCount || 0) + 1; w.lastReview = Date.now(); save('wrongs'); } }
    if (mode === 'seq') b.pos = Math.min(order.length, i + 1);
    save('banks');
  };
  const draw = () => {
    const q = order[i]; const st = state[q.id] = state[q.id] || { a: q.type === 'multiple' || q.type === 'blank' ? [] : null };
    const graded = st.r; const needBtn = !graded && (q.type === 'multiple' || q.type === 'blank' || !QT[q.type].objective);
    const hist = b.stats?.[q.id];
    v.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span class="small"><b>${i + 1}</b> / ${order.length}${mode === 'seq' ? '' : ` · 题库共 ${b.questions.length} 题`}</span><span class="small muted">本次 ${sess.ok}/${sess.n} 正确${hist ? ` · 此题做过 ${hist.n} 次` : ''}</span></div>
      <div class="progress"><i style="width:${(i + 1) / order.length * 100}%"></i></div>
      <div class="q card" data-q="${q.id}">${qHead(q, mode === 'seq' ? i : b.questions.indexOf(q))}${stemHtml(q, !graded)}${graded ? resultBody(q, st.a, st.r) : answerInput(q, st.a)}</div>
      ${needBtn ? `<button class="btn block" id="chk" style="min-height:50px">${QT[q.type].objective ? '提交答案' : '查看参考答案并自评'}</button>` : ''}
      <div class="btns" style="margin-top:12px"><button class="btn plain" id="prev" ${i ? '' : 'disabled'}>‹ 上一题</button><button class="btn ${graded ? '' : 'plain'}" id="next">${i + 1 >= order.length ? '完成' : '下一题 ›'}</button></div>`;
    const qe = $('[data-q]', v);
    qe.onclick = ev => {
      const act = ev.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'self') { const f = +act.dataset.f; st.r = { score: Math.round(q.score * f * 2) / 2, max: q.score, status: f >= 1 ? 'ok' : f > 0 ? 'mid' : 'bad', by: 'self', feedback: '自评' }; finish(q, st.r); draw(); }
        else if (act.dataset.act === 'override') { st.r = { ...st.r, score: q.score, status: 'ok', feedback: '（已改判为正确）' }; S.wrongs = S.wrongs.filter(w => !(w.examId === fakeExam.id && w.qid === q.id)); save('wrongs'); const h = b.stats[q.id]; if (h) { h.last = 'ok'; h.ok++; } sess.ok++; save('banks'); draw(); }
        else if (act.dataset.act === 'addwrong') { if (!S.wrongs.some(w => w.examId === fakeExam.id && w.qid === q.id)) { S.wrongs.unshift(wrongFromQuestion(q, fakeExam, st.a, st.r)); save('wrongs'); } toast('已加入错题本'); act.disabled = true; }
        return;
      }
      const o = ev.target.closest('.opt'); if (!o || graded) return;
      if (q.type === 'single') { st.a = o.dataset.v; gradeNow(q); }
      else if (q.type === 'judge') { st.a = o.dataset.v === 'T'; gradeNow(q); }
      else if (q.type === 'multiple') { const s2 = new Set(st.a || []); s2.has(o.dataset.v) ? s2.delete(o.dataset.v) : s2.add(o.dataset.v); st.a = [...s2].sort(); o.classList.toggle('sel'); }
    };
    qe.oninput = ev => { const inp = ev.target.closest('[data-in]'); if (!inp) return; st.a = q.type === 'blank' ? $$('[data-in]', qe).map(x => x.value) : inp.value; };
    const chk = $('#chk'); if (chk) chk.onclick = () => { if (QT[q.type].objective && !answered(q, st.a)) return toast('先作答再提交'); gradeNow(q); };
    $('#prev').onclick = () => { if (i) { i--; t0 = Date.now(); draw(); window.scrollTo(0, 0); } };
    $('#next').onclick = () => {
      if (i + 1 >= order.length) { Game.practiceDone(sess.n, sess.ok, sess.xp || 0); v.innerHTML = `<div class="empty">${Game.doneIcon('var(--c-teal)')}<h2>本轮完成</h2><p>做了 ${sess.n} 题，答对 ${sess.ok} 题${sess.n ? `（${Math.round(sess.ok / sess.n * 100)}%）` : ''}</p><div class="btns" style="justify-content:center"><a class="btn plain" href="#/learn/bank/${id}">返回题库</a>${Bank.wrongQs(b).length ? `<a class="btn" href="#/learn/bank-do/${id}?mode=wrong&r=${Date.now()}">重练错题</a>` : ''}</div></div>`; if (mode === 'seq') { b.pos = order.length; save('banks'); } return; }
      i++; t0 = Date.now(); draw(); window.scrollTo(0, 0);
    };
    if (mode === 'seq' && !graded && (b.pos || 0) !== i) { b.pos = i; save('banks'); } // 记住断点
  };
  draw();
});
