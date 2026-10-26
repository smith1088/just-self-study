'use strict';
/* ========== 拍照搜题 & 分步讲解 & 追问 ========== */
const SOLVE_SYS = '你是一位耐心、严谨的大学课程辅导老师（面向大一学生），擅长高等数学、线性代数、大学物理、C 语言、大学英语和思政课。讲解要分步骤、讲清思路和易错点，不跳步。数学公式一律使用 LaTeX：行内 $...$，独立公式 $$...$$。代码放在 Markdown 代码块中。';
function solveQuestionText(q) {
  let t = `【题型】${QT[q.type]?.name || '题目'}\n【题目】${q.stem}`;
  if (q.options?.length) t += '\n' + q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n');
  if (q.figure) t += `\n【图形描述】${q.figure}`;
  return t;
}
function matchSubject(name) {
  if (!name) return ''; name = String(name);
  const ss = S.settings.subjects; const hit = ss.find(s => s.name === name) || ss.find(s => name.includes(s.name) || s.name.includes(name)) || ss.find(s => s.name.slice(0, 2) === name.slice(0, 2));
  if (hit) return hit.id;
  const kw = [[/数学|微积分|极限|导数|积分/, 'math'], [/线性|矩阵|行列式/, 'linalg'], [/英语|English|CET/i, 'english'], [/物理/, 'physics'], [/C语言|程序|编程|代码/, 'clang'], [/思政|马克思|近代史|道德|毛概/, 'politics']];
  for (const [re, id] of kw) if (re.test(name) && ss.some(s => s.id === id)) return id; return '';
}
function parseSolveTail(text) {
  const ans = (text.match(/【答案】[:：]?\s*([^\n]+)/) || [])[1] || ''; const kp = (text.match(/【知识点】[:：]?\s*([^\n]+)/) || [])[1] || '';
  return { answer: ans.trim(), kp: kp.trim().replace(/[。.]$/, '') };
}

route('/learn/solve', 'learn', v => {
  setTop('拍照搜题', { back: '#/learn' });
  const list = S.solves.slice().sort((a, b) => b.createdAt - a.createdAt);
  v.innerHTML = `<div class="hero-card">
      <div class="hero-ic">${icon('camera', 30)}</div>
      <h2>拍一下，分步讲懂</h2><p class="small muted">拍题或从相册选图 → AI 识别题目 → 分步骤讲解（公式自动排版）→ 可继续追问 → 一键存入错题本</p>
      <div class="btns" style="margin-top:12px"><button class="btn" id="cam">${icon('camera', 18)} 拍照</button><button class="btn ghost" id="alb">${icon('image', 18)} 相册</button></div>
      <button class="btn plain block" id="txt" style="margin-top:8px">${icon('edit', 18)} 手动输入题目</button>
    </div>
    ${!AI.ready() ? `<div class="notice">讲解需要先配置 AI；识别图片需要支持图片的视觉模型（如 GPT-4o、Qwen-VL、GLM-4V）。<a href="#/me/settings?s=ai">去设置</a></div>` : !AI.visionReady() ? `<div class="notice info">当前模型未配置视觉能力，可以先「手动输入题目」；在设置中填写视觉模型后即可拍照识别。</div>` : ''}
    <h3>搜题记录</h3>
    ${list.length ? `<div class="list">${list.map(x => `<a class="row" href="#/learn/solve/${x.id}">${x.image ? `<img class="mini-thumb" src="${x.image}" alt="">` : `<span class="row-ic">${icon('edit', 18)}</span>`}<div class="grow"><div class="t">${esc(x.q.stem.replace(/\$+/g, '').slice(0, 40))}</div><div class="s">${fmtDateTime(x.createdAt)}${x.q.subject ? ' · ' + esc(subj(x.q.subject).name) : ''}${x.kp ? ' · ' + esc(x.kp) : ''}${x.wrongId ? ' · 已入错题本' : ''}</div></div><span class="chev">›</span></a>`).join('')}</div>` : emptyState('search', '还没有搜过题', '遇到不会的题，拍一下就能看到分步讲解。')}`;
  const fromImage = async (capture) => {
    if (!AI.visionReady()) return showAIError(new AIError('拍照识别需要支持图片的视觉模型，请在「我的 → 设置」中配置；也可以手动输入题目。', 'config'));
    const [f] = await pickFile('image/*', { capture }); if (!f) return;
    let img; try { img = await compressImage(f, 1280, 0.82); } catch (e) { return toast(e.message); }
    try {
      const prompt = `识别图片中的题目（如有多道，只取第一道完整的题），输出 JSON：{"type":"single|multiple|judge|blank|short|calc","stem":"题干原文（公式用 LaTeX）","options":["选项内容（不带A.前缀，没有选项则为空数组）"],"subject":"科目（高等数学/线性代数/大学英语/大学物理/C语言程序设计/思政课程/其他）","knowledgePoint":"考查的知识点","figure":"如果题目依赖图形/电路/表格，用文字详细描述，否则为空","userAnswer":"图片中学生手写的答案（若有，否则为空）"}。只输出 JSON。${LATEX_RULE}`;
      const raw = await withLoading('AI 正在识别题目…', sig => AI.vision(img, prompt, { signal: sig }));
      const o = AI.parseJSON(raw);
      confirmSolve({ type: normType(o.type) || 'short', stem: String(o.stem || '').trim(), options: Array.isArray(o.options) ? o.options.map(String).filter(Boolean) : [], subject: matchSubject(o.subject), knowledgePoint: String(o.knowledgePoint || ''), figure: String(o.figure || ''), userAnswer: String(o.userAnswer || '') }, img);
    } catch (e) { showAIError(e); }
  };
  $('#cam').onclick = () => fromImage(true);
  $('#alb').onclick = () => fromImage(false);
  $('#txt').onclick = () => confirmSolve({ type: 'short', stem: '', options: [], subject: '', knowledgePoint: '', figure: '' }, '');
});
function confirmSolve(q, img) {
  openSheet(`<h2>${img ? '核对识别结果' : '输入题目'}</h2>
    ${img ? `<img class="thumb" src="${img}" alt="">` : ''}
    <div class="grid2"><label class="f"><span>科目</span><select id="sS">${subjOptions(q.subject)}</select></label><label class="f"><span>题型</span><select id="sT">${QT_ORDER.map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${QT[t].name}</option>`).join('')}</select></label></div>
    <label class="f"><span>题目（公式可用 $...$ 书写）</span><textarea id="sQ" style="min-height:110px" placeholder="例如：求极限 $\\lim_{x\\to0}\\frac{e^x-1}{x}$">${esc(q.stem)}</textarea></label>
    <div id="sPrev" class="stem-prev"></div>
    <label class="f"><span>选项（每行一个，可留空）</span><textarea id="sO" style="min-height:60px">${esc(q.options.join('\n'))}</textarea></label>
    ${q.figure ? `<label class="f"><span>图形描述</span><textarea id="sF" style="min-height:50px">${esc(q.figure)}</textarea></label>` : ''}
    <button class="btn block" id="go">${icon('sparkle', 18)} 开始分步讲解</button>`, el => {
    const prev = () => { const t = $('#sQ', el).value; $('#sPrev', el).innerHTML = hasMath(t) ? rt(t) : ''; };
    $('#sQ', el).oninput = debounce(prev, 250); prev();
    $('#go', el).onclick = () => {
      const stem = $('#sQ', el).value.trim(); if (!stem) return toast('请输入题目');
      if (!AI.ready()) return showAIError(new AIError('讲解需要先在「我的 → 设置」中配置 AI。', 'config'));
      const nq = { ...q, stem, subject: $('#sS', el).value, type: $('#sT', el).value, options: $('#sO', el).value.split('\n').map(s => s.trim()).filter(Boolean), figure: $('#sF', el)?.value || q.figure };
      const x = { id: uid(), createdAt: Date.now(), image: img, q: nq, messages: [], answer: '', kp: nq.knowledgePoint || '', wrongId: '' };
      S.solves.push(x); if (S.solves.length > 30) { S.solves.sort((a, b) => a.createdAt - b.createdAt); S.solves.splice(0, S.solves.length - 30); } save('solves');
      closeSheet(true); location.hash = '#/learn/solve/' + x.id; setTimeout(() => solveExplain(x), 60);
    };
  });
}
async function solveExplain(x) {
  const prompt = `${solveQuestionText(x.q)}\n\n请分步骤讲解这道题：\n1. 先用一两句话点明考点和解题思路；\n2. 用「**第 1 步**」「**第 2 步**」……分步推导，每步说明依据（定理/公式/语法规则）；\n3. 指出 1–2 个常见易错点；\n4. 最后两行严格按格式输出：\n【答案】最终答案（选择题写选项字母，判断题写“对”或“错”，填空题多空用；分隔）\n【知识点】一个简短规范的知识点名称`;
  try {
    const text = await withLoading('AI 正在分步讲解…', sig => AI.chat([{ role: 'system', content: SOLVE_SYS }, { role: 'user', content: prompt }], { signal: sig, temperature: 0.3 }));
    const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    x.messages = [{ role: 'user', content: prompt, hidden: true }, { role: 'assistant', content: clean }];
    const tail = parseSolveTail(clean); x.answer = tail.answer; if (tail.kp) x.kp = tail.kp;
    save('solves'); if (location.hash.includes(x.id)) rerender();
  } catch (e) { showAIError(e); }
}
route('/learn/solve/:id', 'learn', (v, id) => {
  const x = S.solves.find(s => s.id === id); if (!x) { location.hash = '#/learn/solve'; return; }
  setTop('讲解', { back: '#/learn/solve', actions: `<button class="icon-btn" id="more" aria-label="更多">${icon('more', 22)}</button>` });
  const q = x.q; const msgs = x.messages.filter(m => !m.hidden);
  v.innerHTML = `<div class="q solve-q">${x.image ? `<img class="thumb" src="${x.image}" alt="">` : ''}<div class="chips" style="margin-bottom:6px">${subjChip(q.subject)}<span class="chip">${QT[q.type]?.short || '题目'}</span>${x.kp ? `<span class="chip">${esc(x.kp)}</span>` : ''}</div><div class="stem">${richText(q.stem)}</div>${(q.options || []).map((o, i) => `<div class="opt" style="cursor:default"><b>${LETTERS[i]}.</b><span>${rt(o)}</span></div>`).join('')}</div>
    ${x.answer ? `<div class="answer-pill">${icon('check', 16)} 答案：<b>${rt(x.answer)}</b></div>` : ''}
    <div class="thread">${msgs.length ? msgs.map((m, i) => m.role === 'assistant' ? `<div class="bubble ai md">${spkBtn(m.content.replace(/【答案】[\s\S]*$/, ''))}${md(i === 0 ? m.content.replace(/\n*【答案】[^\n]*\n?/, '\n').replace(/\n*【知识点】[^\n]*\n?/, '\n') : m.content)}</div>` : `<div class="bubble me">${rt(m.content)}</div>`).join('') : `<div class="empty small">还没有讲解。<button class="btn small" id="re">${icon('sparkle', 16)} 开始讲解</button></div>`}</div>
    ${msgs.length ? `<div class="btns" style="margin:4px 0 10px">${x.wrongId ? `<a class="btn plain" href="#/learn/wrong/${x.wrongId}">${icon('book', 18)} 已在错题本</a>` : `<button class="btn ok" id="sw">${icon('book', 18)} 存入错题本</button>`}<button class="btn plain" id="sim">${icon('sparkle', 18)} 出道类似题</button></div>
    <div class="chips" id="quick">${['为什么这样做？', '换一种解法', '第 2 步没看懂', '这个知识点还有哪些考法？'].map(t => `<button class="chip">${t}</button>`).join('')}</div>
    <div class="composer"><textarea id="ask" rows="1" placeholder="继续追问…"></textarea><button class="btn" id="send" aria-label="发送">${icon('send', 18)}</button></div>` : ''}`;
  const re = $('#re'); if (re) re.onclick = () => solveExplain(x);
  const ask = async (text) => {
    text = String(text || '').trim(); if (!text) return;
    x.messages.push({ role: 'user', content: text }); save('solves'); rerender();
    const hist = x.messages.slice(0, 2).concat(x.messages.slice(2).slice(-10)).map(m => ({ role: m.role, content: m.content }));
    try {
      const out = await withLoading('AI 正在回答…', sig => AI.chat([{ role: 'system', content: SOLVE_SYS + '学生正在就这道题追问，请针对问题简洁回答，必要时分步。' }, ...hist], { signal: sig, temperature: 0.4 }));
      x.messages.push({ role: 'assistant', content: out.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }); save('solves'); rerender(); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
    } catch (e) { showAIError(e); }
  };
  const ta = $('#ask'); if (ta) { ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }; $('#send').onclick = () => ask(ta.value); }
  const qk = $('#quick'); if (qk) qk.onclick = e => { const b = e.target.closest('.chip'); if (b) ask(b.dataset.q || (b.textContent === '这个知识点还有哪些考法？' ? `「${x.kp || '这个知识点'}」还有哪些常见考法？各举一个简短例子。` : b.textContent)); };
  const sim = $('#sim'); if (sim) sim.onclick = () => ask('请出一道与这道题考查同一知识点、难度相当的新题（先只给题目，不要给答案，我做完再问你）。');
  const sw = $('#sw'); if (sw) sw.onclick = () => saveSolveToWrong(x);
  $('#more').onclick = () => openSheet(`<h2>搜题操作</h2><div class="list"><div class="row" id="rx">重新讲解</div><div class="row" id="dl" style="color:var(--bad)">删除记录</div></div>`, el => {
    $('#rx', el).onclick = () => { closeSheet(true); solveExplain(x); };
    $('#dl', el).onclick = async () => { if (await confirmBox('删除这条搜题记录？', '删除')) { S.solves = S.solves.filter(s => s !== x); save('solves'); location.hash = '#/learn/solve'; } };
  });
});
function saveSolveToWrong(x) {
  const q = x.q; const exp = (x.messages.find(m => m.role === 'assistant')?.content || '').replace(/\n*【答案】[^\n]*/, '').replace(/\n*【知识点】[^\n]*/, '').trim();
  openSheet(`<h2>存入错题本</h2><label class="f"><span>我的答案（可选）</span><input type="text" id="ua" value="${esc(q.userAnswer || '')}" placeholder="做错时写的答案"></label><label class="f"><span>错因 / 笔记</span><textarea id="nt" style="min-height:70px" placeholder="例如：不会用等价无穷小替换"></textarea></label><label class="f"><span>知识点</span><input type="text" id="kp" value="${esc(x.kp || q.knowledgePoint || '')}"></label><button class="btn block" id="ok">保存</button>`, el => {
    $('#ok', el).onclick = () => {
      let answer = x.answer || ''; let userAnswer = $('#ua', el).value.trim();
      const conv = a => { if (!a) return a; try { return normalizeQuestion({ type: q.type, stem: q.stem, options: q.options?.length >= 2 ? q.options : ['A', 'B'], answer: q.type === 'single' ? (a.match(/[A-H]/) || [a])[0] : a }, 0).answer; } catch (e) { return a; } };
      const w = { id: uid(), qid: '', examId: '', subject: q.subject, bookId: '', chapter: '', knowledgePoint: $('#kp', el).value.trim(), qtype: q.type, stem: q.stem, options: q.options?.length ? q.options : null, answer: conv(answer) || '（见解析）', userAnswer: conv(userAnswer), explanation: exp, feedback: '', note: $('#nt', el).value.trim(), image: x.image || '', createdAt: Date.now(), reviewCount: 0, correctStreak: 0, mastered: false, lastReview: 0, source: '拍照搜题' };
      S.wrongs.unshift(w); save('wrongs'); x.wrongId = w.id; save('solves'); closeSheet(true); toast('已存入错题本'); rerender();
    };
  });
}
