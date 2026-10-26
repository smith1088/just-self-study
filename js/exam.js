'use strict';
/* ========== AI 出试卷 / 答题 / 判分 ========== */
const QT = {
  single: { name: '单选题', short: '单选', score: 3, objective: true },
  multiple: { name: '多选题', short: '多选', score: 4, objective: true },
  judge: { name: '判断题', short: '判断', score: 2, objective: true },
  blank: { name: '填空题', short: '填空', score: 3, objective: true },
  short: { name: '简答题', short: '简答', score: 10, objective: false },
  calc: { name: '计算题', short: '计算', score: 12, objective: false }
};
const QT_ORDER = ['single', 'multiple', 'judge', 'blank', 'short', 'calc'];
const DIFF = { easy: '基础', medium: '中等', hard: '提高', mixed: '混合' };
const LETTERS = 'ABCDEFGH';
const CN_IDX = ['一', '二', '三', '四', '五', '六', '七', '八'];
const BLANK_RE = /_{2,}|（\s*）|\(\s*\)|【\s*】/g;

/* ---- 校验与规范化 AI 生成的题目 ---- */
function normType(t) {
  t = String(t || '').toLowerCase().trim();
  if (QT[t]) return t;
  const m = [[/多选|multiple|multi/, 'multiple'], [/单选|选择|single|choice/, 'single'], [/判断|true|judge|tf/, 'judge'], [/填空|blank|fill/, 'blank'], [/计算|解答|calc|comput/, 'calc'], [/简答|问答|论述|short|essay|answer/, 'short']];
  for (const [re, k] of m) if (re.test(t)) return k; return null;
}
function normJudge(a) { if (typeof a === 'boolean') return a; const s = String(a).trim().toLowerCase(); if (/^(true|t|对|正确|√|✓|是|yes|y|1)$/.test(s)) return true; if (/^(false|f|错|错误|×|✗|x|否|no|n|0)$/.test(s)) return false; return null; }
function letterOf(a, options) {
  if (typeof a === 'number') return LETTERS[a] || null;
  const s = String(a).trim(); const m = s.match(/^[（(]?([A-Ha-h])(?![a-z])/); if (m) return m[1].toUpperCase();
  const i = options.findIndex(o => o.trim() === s); return i >= 0 ? LETTERS[i] : null;
}
function normalizeQuestion(raw, i) {
  if (!raw || typeof raw !== 'object') throw new Error(`第 ${i + 1} 题不是对象`);
  const type = normType(raw.type); if (!type) throw new Error(`第 ${i + 1} 题题型无法识别：${raw.type}`);
  let stem = String(raw.stem || raw.question || raw.content || '').trim(); if (!stem) throw new Error(`第 ${i + 1} 题缺少题干`);
  const q = { id: uid(), type, stem, explanation: String(raw.explanation || raw.analysis || '').trim(), knowledgePoint: String(raw.knowledgePoint || raw.knowledge_point || raw.kp || '').trim(), chapter: String(raw.chapter || '').trim(), source: raw.source === 'variant' ? 'variant' : '', wrongRef: raw.wrongId != null ? String(raw.wrongId) : '', section: String(raw.section || '').trim().slice(0, 60), material: String(raw.material || raw.passage || '').trim(), image: typeof raw.image === 'string' && raw.image.startsWith('data:image') ? raw.image : '' };
  const sc = +raw.score; q.score = sc > 0 && sc <= 50 ? Math.round(sc) : QT[type].score;
  if (type === 'single' || type === 'multiple') {
    let opts = raw.options; if (opts && !Array.isArray(opts) && typeof opts === 'object') opts = Object.values(opts);
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > 8) throw new Error(`第 ${i + 1} 题选项数量不正确`);
    q.options = opts.map(o => String(o).replace(/^\s*[（(]?[A-Ha-h][）).、．:：]\s*/, '').trim());
    if (type === 'single') { const l = letterOf(Array.isArray(raw.answer) ? raw.answer[0] : raw.answer, q.options); if (!l || LETTERS.indexOf(l) >= q.options.length) throw new Error(`第 ${i + 1} 题答案无效`); q.answer = l; }
    else {
      let arr = Array.isArray(raw.answer) ? raw.answer : String(raw.answer || '').match(/[A-Ha-h]/g) || [];
      arr = [...new Set(arr.map(a => letterOf(a, q.options)).filter(Boolean))].filter(l => LETTERS.indexOf(l) < q.options.length).sort();
      if (!arr.length) throw new Error(`第 ${i + 1} 题答案无效`); q.answer = arr;
    }
  } else if (type === 'judge') { const a = normJudge(raw.answer); if (a === null) throw new Error(`第 ${i + 1} 题判断答案无效`); q.answer = a; }
  else if (type === 'blank') {
    let arr = Array.isArray(raw.answer) ? raw.answer : String(raw.answer ?? '').split(/[;；]/);
    arr = arr.map(x => String(x).trim()).filter(Boolean); if (!arr.length) throw new Error(`第 ${i + 1} 题填空答案为空`);
    const nb = (stem.match(BLANK_RE) || []).length;
    if (nb === 0) q.stem = stem + ' ____'.repeat(arr.length);
    q.answer = arr;
  } else { const a = raw.answer ?? raw.reference ?? ''; q.answer = typeof a === 'string' ? a.trim() : JSON.stringify(a); if (!q.answer) throw new Error(`第 ${i + 1} 题缺少参考答案`); }
  return q;
}
function validateExam(obj) {
  const arr = Array.isArray(obj) ? obj : obj.questions || obj.items || obj.data;
  if (!Array.isArray(arr) || !arr.length) throw new Error('缺少 questions 数组');
  const qs = [], errs = [];
  arr.forEach((r, i) => { try { qs.push(normalizeQuestion(r, i)); } catch (e) { errs.push(e.message); } });
  if (!qs.length || qs.length < arr.length * 0.5) throw new Error('题目格式错误：' + errs.slice(0, 3).join('；'));
  return { title: String(obj.title || '').trim(), questions: qs, dropped: errs.length };
}

/* ---- 示例题（无需 API Key 即可体验） ---- */
const DEMO_QUESTIONS = [
  { type: 'single', stem: '极限 $\\lim\\limits_{x\\to 0}\\dfrac{\\sin 3x}{x}$ 的值为（ ）', options: ['$0$', '$1$', '$3$', '$\\dfrac{1}{3}$'], answer: 'C', explanation: '由重要极限 $\\lim\\limits_{x\\to0}\\dfrac{\\sin x}{x}=1$，得 $\\lim\\limits_{x\\to0}\\dfrac{\\sin 3x}{x}=3\\lim\\limits_{x\\to0}\\dfrac{\\sin 3x}{3x}=3$。', knowledgePoint: '重要极限', subject: 'math' },
  { type: 'single', stem: '设 $A$ 为 3 阶方阵，且 $|A|=2$，则 $|2A|=$（ ）', options: ['$4$', '$8$', '$16$', '$6$'], answer: 'C', explanation: '$n$ 阶方阵满足 $|kA|=k^n|A|$，所以 $|2A|=2^3\\times 2=16$。', knowledgePoint: '行列式的性质', subject: 'linalg' },
  { type: 'single', stem: '在 C 语言中，执行 `int a = 7 / 2;` 后，a 的值是（ ）', options: ['3', '3.5', '4', '编译错误'], answer: 'A', explanation: '两个整数相除结果为整数（向零取整），7/2 = 3。', knowledgePoint: '整数除法', subject: 'clang' },
  { type: 'single', stem: 'The professor suggested that the report ______ before Friday.', options: ['is finished', 'be finished', 'was finished', 'will be finished'], answer: 'B', explanation: 'suggest 表示“建议”时，宾语从句用虚拟语气 (should) + 动词原形，被动即 (should) be finished。', knowledgePoint: '虚拟语气', subject: 'english' },
  { type: 'multiple', stem: '下列关于函数 $f(x)$ 在点 $x_0$ 处的说法，正确的有（ ）', options: ['可导一定连续', '连续一定可导', '可导一定可微', '连续则极限 $\\lim\\limits_{x\\to x_0}f(x)$ 存在'], answer: ['A', 'C', 'D'], explanation: '一元函数中可导 $\\Leftrightarrow$ 可微，可导 $\\Rightarrow$ 连续，但连续不一定可导（如 $y=|x|$ 在 $x=0$ 处）。', knowledgePoint: '连续、可导与可微的关系', subject: 'math' },
  { type: 'multiple', stem: '马克思主义中国化时代化的理论成果包括（ ）', options: ['毛泽东思想', '邓小平理论', '“三个代表”重要思想', '科学发展观'], answer: ['A', 'B', 'C', 'D'], explanation: '四项均属于马克思主义中国化时代化的理论成果，此外还有习近平新时代中国特色社会主义思想。', knowledgePoint: '马克思主义中国化', subject: 'politics' },
  { type: 'judge', stem: '若矩阵 $A$ 可逆，则 $(A^{T})^{-1}=(A^{-1})^{T}$。', answer: true, explanation: '由 $A^T(A^{-1})^T=(A^{-1}A)^T=E$ 可知结论成立。', knowledgePoint: '逆矩阵的性质', subject: 'linalg' },
  { type: 'judge', stem: '质点做匀速圆周运动时，其加速度为零。', answer: false, explanation: '匀速圆周运动速度方向不断变化，存在向心加速度 $a_n=\\dfrac{v^2}{r}$。', knowledgePoint: '圆周运动', subject: 'physics' },
  { type: 'blank', stem: '函数 $y=x^3-3x$ 的极小值点是 $x=$ ____。', answer: ['1'], explanation: "$y'=3x^2-3=0$ 得 $x=\\pm1$；$y''=6x$，$y''(1)=6>0$，故 $x=1$ 为极小值点。", knowledgePoint: '函数的极值', subject: 'math' },
  { type: 'blank', stem: '定积分 $\\displaystyle\\int_0^1 2x\\,dx=$ ____。', answer: ['1'], explanation: '$\\displaystyle\\int_0^1 2x\\,dx=x^2\\Big|_0^1=1$。', knowledgePoint: '定积分计算', subject: 'math' },
  { type: 'blank', stem: 'C 语言中，表示“逻辑与”的运算符是 ____，取变量地址的运算符是 ____。', answer: ['&&', '&'], explanation: '`&&` 为逻辑与，`&` 作单目运算符时为取地址。', knowledgePoint: '运算符', subject: 'clang' },
  { type: 'short', stem: '简述“实践是检验真理的唯一标准”的含义。', answer: '①真理的本性是主观同客观相符合，检验真理就是要把认识与客观实际相对照；②实践是主观见之于客观的活动，具有直接现实性，能够把主观和客观联系起来；③因此只有实践才能成为检验真理的标准。', explanation: '答出真理本性、实践的直接现实性、实践能连接主客观三个要点即可得满分。', knowledgePoint: '真理的检验标准', subject: 'politics' },
  { type: 'calc', stem: '求不定积分 $\\displaystyle\\int x e^{x}\\,dx$。', answer: '分部积分：设 $u=x,\\ dv=e^x dx$，则 $\\displaystyle\\int xe^x dx = xe^x-\\int e^x dx = xe^x-e^x+C$。', explanation: '使用分部积分公式 $\\int u\\,dv=uv-\\int v\\,du$；写出公式与结果各得一半分，漏写 $C$ 扣 1 分。', knowledgePoint: '分部积分法', subject: 'math' },
  { type: 'calc', stem: '求矩阵 $A=\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}$ 的特征值。', answer: '$|\\lambda E-A|=(\\lambda-2)^2-1=(\\lambda-1)(\\lambda-3)=0$，故 $\\lambda_1=1,\\ \\lambda_2=3$。', explanation: '写出特征多项式得一半分，正确求出两个特征值得满分。', knowledgePoint: '特征值', subject: 'linalg' }
];
// 四级（CET-4）风格示例（不含听力）
const CET_PASSAGE = `Many first-year college students find that the biggest challenge is not the coursework itself but managing their own time. In high school, teachers and parents set the schedule; in college, students must decide when to study, when to rest and when to socialize. Researchers have found that students who plan their week in advance, even roughly, report lower stress and earn better grades. One simple method is to divide large tasks into small steps and to review notes within 24 hours of each class, when memory is still fresh.`;
const DEMO_CET = [
  { type: 'short', section: 'Part I Writing', stem: 'Directions: For this part, you are allowed 30 minutes to write an essay on **how to adapt to college life**. You should write at least 120 words but no more than 180 words.', answer: 'Model essay: Entering college is a turning point in life... (Para 1: importance of adapting; Para 2: specific ways — managing time, making friends, joining clubs; Para 3: conclusion.)', explanation: '评分要点：切题、结构清晰（三段式）、论据具体、语言准确、词数达标；参照四级作文 15 分档次评分。', knowledgePoint: '四级写作', subject: 'english', score: 15 },
  { type: 'blank', section: 'Part II Reading · Section A 选词填空', stem: 'Word Bank: A) fresh  B) divide  C) lower  D) challenge\n\nThe biggest ____ for freshmen is managing time. Planning ahead leads to ____ stress. It helps to ____ large tasks into small steps and review notes while memory is ____.', answer: ['challenge|D', 'lower|C', 'divide|B', 'fresh|A'], explanation: '根据语境与词性：名词 challenge；形容词比较级 lower 修饰 stress；动词 divide…into；表语形容词 fresh。', knowledgePoint: '选词填空', subject: 'english', score: 4 },
  { type: 'single', section: 'Part II Reading · Section C 仔细阅读', material: CET_PASSAGE, stem: 'According to the passage, what is the biggest challenge for many first-year college students?', options: ['The difficulty of the coursework.', 'Managing their own time.', 'Making new friends.', 'Living away from parents.'], answer: 'B', explanation: '第一句：the biggest challenge is not the coursework itself but managing their own time。', knowledgePoint: '细节理解', subject: 'english', score: 2 },
  { type: 'single', section: 'Part II Reading · Section C 仔细阅读', material: CET_PASSAGE, stem: 'Why should students review notes within 24 hours of each class?', options: ['Because teachers require it.', 'Because it reduces the coursework.', 'Because memory is still fresh then.', 'Because it saves time for socializing.'], answer: 'C', explanation: '末句：when memory is still fresh。', knowledgePoint: '推理判断', subject: 'english', score: 2 },
  { type: 'short', section: 'Part III Translation', stem: 'Directions: 请将下面这段话翻译成英文。\n\n中国的大学生越来越重视时间管理。许多学生会提前制定学习计划，把大的任务分成小的步骤，并利用番茄工作法保持专注。', answer: 'Chinese college students are paying more and more attention to time management. Many of them make study plans in advance, divide big tasks into small steps, and use the Pomodoro Technique to stay focused.', explanation: '评分要点：意思完整准确、句子结构正确、关键词（time management / in advance / divide…into / stay focused）；参照四级翻译 15 分档次。', knowledgePoint: '四级翻译', subject: 'english', score: 15 }
];
function demoExam(types, title = '示例试卷（体验用）', opt = {}) {
  let pool;
  if (opt.cet) pool = DEMO_CET.slice();
  else if (types) {
    pool = [];
    for (const t of QT_ORDER) {
      const n = types[t] || 0; const arr = DEMO_QUESTIONS.filter(q => q.type === t).sort((a, b) => (opt.subject ? (b.subject === opt.subject) - (a.subject === opt.subject) : 0));
      for (let i = 0; i < n && i < arr.length; i++) pool.push(arr[i]);
    }
  } else pool = DEMO_QUESTIONS.slice();
  const { questions } = validateExam({ questions: pool });
  questions.forEach((q, i) => q.subject = pool[i].subject);
  return { id: uid(), title, subject: opt.subject || '', createdAt: Date.now(), difficulty: 'mixed', questions, status: 'new', answers: {}, results: {}, demo: true, timeLimit: opt.timeLimit || 0 };
}

/* ---- 判分 ---- */
function normText(s) { return String(s ?? '').trim().toLowerCase().replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ').replace(/[\s。．.，,;；!！]+$/g, '').replace(/\s+/g, '').replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080)).replace(/[⁰¹²³⁴-⁹]/g, c => ({ '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }[c])); }
function blankMatch(user, ans) {
  const u = normText(user); if (!u) return false;
  return String(ans).split('|').some(a => { const n = normText(a); if (u === n) return true; const fu = parseFloat(u), fn = parseFloat(n); return !isNaN(fu) && !isNaN(fn) && /^[-+]?[\d.]+$/.test(u) && /^[-+]?[\d.]+$/.test(n) && Math.abs(fu - fn) < 1e-9; });
}
function gradeObjective(q, a) {
  const max = q.score;
  if (q.type === 'single') { const ok = a === q.answer; return { score: ok ? max : 0, max, status: ok ? 'ok' : 'bad' }; }
  if (q.type === 'multiple') { const u = [...(a || [])].sort(); const ok = u.join() === q.answer.join(); if (ok) return { score: max, max, status: 'ok' }; const sub = u.length && u.every(x => q.answer.includes(x)); return { score: sub ? Math.floor(max / 2) : 0, max, status: sub ? 'mid' : 'bad', feedback: sub ? '少选，得一半分' : '' }; }
  if (q.type === 'judge') { const ok = a === q.answer; return { score: ok ? max : 0, max, status: ok ? 'ok' : 'bad' }; }
  if (q.type === 'blank') { const u = a || []; let k = 0; q.answer.forEach((ans, i) => { if (blankMatch(u[i], ans)) k++; }); const sc = Math.round(max * k / q.answer.length * 10) / 10; return { score: sc, max, status: k === q.answer.length ? 'ok' : k ? 'mid' : 'bad', feedback: q.answer.length > 1 ? `答对 ${k}/${q.answer.length} 空` : '' }; }
}
async function gradeSubjectiveAI(exam, qs, signal) {
  const items = qs.map((q, i) => ({ id: i + 1, type: QT[q.type].name, question: q.stem, reference: q.answer, rubric: q.explanation, maxScore: q.score, studentAnswer: String(exam.answers[q.id] || '').slice(0, 3000) || '（未作答）' }));
  const res = await AI.json([
    { role: 'system', content: '你是一名严谨、公正且善于鼓励的阅卷老师。根据参考答案和评分要点给学生的主观题打分，并给出简明的中文点评：指出得分点、失分点和改进建议。学生未作答则 0 分。只输出 JSON。' + ((exam.cet || exam.preset === 'cet4' || qs.some(q => /Writing|Translation/i.test(q.section || ''))) && typeof CET_RUBRIC === 'string' ? '\n\n' + CET_RUBRIC : '') },
    { role: 'user', content: `请批改以下题目，输出格式：{"results":[{"id":1,"score":数字(0到maxScore，可为0.5的倍数),"feedback":"点评"}]}\n\n${JSON.stringify(items, null, 1)}` }
  ], o => { const r = o.results || o; if (!Array.isArray(r)) throw new Error('缺少 results 数组'); return r; }, { signal, temperature: 0.2 });
  qs.forEach((q, i) => {
    const r = res.find(x => +x.id === i + 1) || res[i] || {}; let sc = Math.max(0, Math.min(q.score, +r.score || 0)); sc = Math.round(sc * 2) / 2;
    exam.results[q.id] = { score: sc, max: q.score, status: sc >= q.score ? 'ok' : sc > 0 ? 'mid' : 'bad', feedback: String(r.feedback || ''), by: 'ai' };
  });
}
function examTotals(exam) { let s = 0, m = 0; exam.questions.forEach(q => { m += q.score; s += exam.results[q.id]?.score || 0; }); return { score: Math.round(s * 10) / 10, max: m }; }
function answered(q, a) { if (a == null) return false; if (q.type === 'multiple' || q.type === 'blank') return Array.isArray(a) && a.some(x => String(x || '').trim()); if (q.type === 'judge') return typeof a === 'boolean'; return String(a).trim() !== ''; }
function fmtAnswer(q, a) {
  if (a == null || a === '' || (Array.isArray(a) && !a.some(x => String(x || '').trim()))) return '（未作答）';
  if (q.type === 'judge') return typeof a === 'boolean' ? (a ? '正确 √' : '错误 ×') : String(a);
  if (typeof a === 'string') return a;
  if (q.type === 'multiple') return a.join('');
  if (q.type === 'blank') return a.map((x, i) => `第${i + 1}空：${String(x).split('|').join(' 或 ')}`).join('；');
  return String(a);
}
function collectWrongs(exam) {
  let n = 0;
  exam.questions.forEach(q => {
    const r = exam.results[q.id]; if (!r || r.score >= r.max) return;
    if (S.wrongs.some(w => w.examId === exam.id && w.qid === q.id)) return;
    S.wrongs.unshift(wrongFromQuestion(q, exam, exam.answers[q.id], r)); n++;
  });
  if (n) save('wrongs'); return n;
}
function wrongFromQuestion(q, exam, userAns, r) {
  const b = exam?.bookId ? bookById(exam.bookId) : null;
  return { id: uid(), qid: q.id, examId: exam?.id || '', subject: q.subject || exam?.subject || b?.subject || '', bookId: exam?.bookId || '', chapter: q.chapter || '', knowledgePoint: q.knowledgePoint || '', qtype: q.type, stem: q.stem, options: q.options || null, answer: q.answer, userAnswer: userAns ?? null, explanation: q.explanation || '', feedback: r?.feedback || '', note: '', image: '', createdAt: Date.now(), reviewCount: 0, correctStreak: 0, mastered: false, lastReview: 0, source: exam ? (exam.demo ? '示例试卷' : exam.title) : '手动添加' };
}

/* ---- 通用：科目、分组、计时 ---- */
function examSubject(e) {
  if (e.subject) return e.subject; const c = {}; e.questions.forEach(q => { if (q.subject) c[q.subject] = (c[q.subject] || 0) + 1; });
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top && top[1] / e.questions.length >= 0.6 ? top[0] : '';
}
function examGroups(e) {
  if (e.questions.some(q => q.section)) {
    const gs = []; e.questions.forEach(q => { const sec = q.section || '其他'; const g = gs[gs.length - 1]; if (g && g.key === sec) g.qs.push(q); else gs.push({ key: sec, qs: [q] }); });
    return gs.map((g, i) => ({ title: g.key, sub: `共 ${g.qs.length} 题 · ${g.qs.reduce((a, q) => a + q.score, 0)} 分`, qs: g.qs }));
  }
  return QT_ORDER.map(t => [t, e.questions.filter(q => q.type === t)]).filter(g => g[1].length).map(([t, qs], gi) => ({ title: `${CN_IDX[gi]}、${QT[t].name}`, sub: `共 ${qs.length} 题 · ${qs.reduce((a, q) => a + q.score, 0)} 分`, qs }));
}
const fmtMS = ms => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600); return (h ? h + ':' + pad2(Math.floor(s / 60) % 60) : Math.floor(s / 60)) + ':' + pad2(s % 60); };
function materialHtml(q, prev) { return q.material && q.material !== prev ? `<div class="material">${/[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/i.test(q.material) && TTS.ok ? `<button type="button" class="icon-btn mat-say" aria-label="朗读材料">${icon('speaker', 17)}</button>` : ''}<div class="small muted" style="margin-bottom:4px">阅读材料</div>${md(q.material)}</div>` : ''; }
const shortMD = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
function examPct(e) { const t = examTotals(e); return t.max ? Math.round(t.score / t.max * 1000) / 10 : 0; }

/* ---- 模拟考试预设（大一常见期末 / 四级） ---- */
const ZERO_TYPES = () => ({ single: 0, multiple: 0, judge: 0, blank: 0, short: 0, calc: 0 });
const EXAM_PRESETS = {
  quiz: { icon: '⚡', name: '随堂小测', time: 20, difficulty: 'easy', types: { single: 5, judge: 3, blank: 2 }, desc: '20 分钟 · 10 题，适合课后快速自测。', extra: '' },
  math: { icon: '∫', name: '高数期末', subject: 'math', time: 120, difficulty: 'mixed', types: { single: 5, blank: 5, calc: 6 }, topic: '高等数学（上）：函数与极限、导数与微分、微分中值定理与导数的应用、不定积分、定积分及其应用', desc: '120 分钟 · 选择 + 填空 + 计算题，参照大一高数（上）期末。', extra: '参照大一《高等数学（上）》期末试卷风格；计算题需给出完整步骤，评分按步骤给分；公式一律用 LaTeX。' },
  linalg: { icon: '▦', name: '线代期末', subject: 'linalg', time: 120, difficulty: 'mixed', types: { single: 5, blank: 5, calc: 5, short: 1 }, topic: '线性代数：行列式、矩阵及其运算、逆矩阵、矩阵的初等变换与秩、线性方程组、向量组的线性相关性、特征值与特征向量、相似对角化、二次型', desc: '120 分钟 · 含 1 道证明题，覆盖行列式到二次型。', extra: '参照《线性代数》期末；简答题为证明题；矩阵用 LaTeX 的 pmatrix 环境。' },
  clang: { icon: '⌨', name: 'C语言期末', subject: 'clang', time: 120, difficulty: 'mixed', types: { single: 10, judge: 5, blank: 5, short: 3 }, topic: 'C 语言程序设计：数据类型与表达式、顺序/选择/循环结构、数组、函数、指针、字符串、结构体、文件', desc: '120 分钟 · 含程序填空、阅读程序写结果、编程题。', extra: '参照大一《C语言程序设计》期末；填空题可为程序填空；简答题为“阅读程序写结果”或“编写程序”，代码放在 Markdown 代码块中。' },
  politics: { icon: '★', name: '思政期末', subject: 'politics', time: 100, difficulty: 'medium', types: { single: 15, multiple: 5, judge: 5, short: 3 }, topic: '思想道德与法治、中国近现代史纲要（大一常开课程）', desc: '100 分钟 · 单选 / 多选 / 判断 / 简答。', extra: '观点准确、表述规范，符合教材最新版本的提法。' },
  cet4: { icon: '🅴', name: '四级模拟', subject: 'english', time: 100, difficulty: 'medium', cet: true, types: { short: 2, blank: 1, single: 10 }, topic: '大学英语四级（CET-4）', desc: '100 分钟 · 写作 + 选词填空 + 仔细阅读 + 翻译（不含听力）。', extra: '' }
};
const CET_REQ = `请严格按照大学英语四级（CET-4）真题结构出一份模拟题（不含听力），题目顺序如下：
1. Part I Writing：1 道 type="short"，section="Part I Writing"，stem 为英文 Directions + 作文题目（要求 120–180 词），answer 为一篇范文，explanation 为评分要点，score=15。
2. Part II Reading · Section A 选词填空：1 道 type="blank"，section="Part II Reading · Section A 选词填空"，stem 先给出 Word Bank（A) 到 O) 共 15 个单词），再给出约 220 词的短文，文中 10 个空用 ____ 表示；answer 为 10 个元素的数组，每个元素写成 "单词|字母"，score=10。
3. Part II Reading · Section C 仔细阅读：2 篇短文（各约 300 词），每篇 5 道 type="single"（4 个选项），section="Part II Reading · Section C 仔细阅读"；同一篇短文的 5 道题 material 字段填写完全相同的短文全文；每题 score=2。
4. Part III Translation：1 道 type="short"，section="Part III Translation"，stem 为一段 140–160 字的中文（主题为中国文化、社会或经济发展），要求译成英文，answer 为参考译文，explanation 为评分要点，score=15。`;

/* ---- 试卷列表 ---- */
route('/learn/exams', 'learn', v => {
  setTop('AI 出题', { back: '#/learn' });
  const ex = S.exams.slice().sort((a, b) => b.createdAt - a.createdAt);
  const graded = S.exams.filter(e => e.status === 'graded').sort((a, b) => (a.submittedAt || a.createdAt) - (b.submittedAt || b.createdAt));
  v.innerHTML = `<a class="btn block" href="#/learn/exam/new" style="margin-bottom:10px">${icon('plus', 18)} 生成新试卷 / 模拟考试</a>
    ${!AI.ready() ? `<div class="small muted" style="margin:0 4px 10px">未配置 AI，可先体验示例试卷。<a href="#/me/settings?s=ai">去设置</a></div>` : ''}
    <button class="btn ghost block" id="demo" style="margin-bottom:12px">体验示例试卷（无需 AI）</button>
    ${graded.length ? `<a class="card" href="#/learn/exam-history" style="display:block;text-decoration:none;color:inherit"><div style="display:flex;justify-content:space-between;align-items:center"><b>成绩记录</b><span class="small muted">${graded.length} 次 · 平均 ${Math.round(graded.reduce((a, e) => a + examPct(e), 0) / graded.length)}% ›</span></div>${lineChart(graded.slice(-12).map(e => ({ y: examPct(e), label: shortMD(e.submittedAt || e.createdAt) })), { h: 90, mini: true })}</a>` : ''}
    <h3>历史试卷</h3>
    ${ex.length ? `<div class="list">${ex.map(e => { const t = examTotals(e); return `<a class="row" href="#/learn/exam/${e.id}"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${fmtDateTime(e.createdAt)} · ${e.questions.length} 题${e.timeLimit ? ` · ⏱${e.timeLimit}分钟` : ''} · ${DIFF[e.difficulty] || ''}</div></div>${e.status === 'graded' ? `<b style="color:${t.score / t.max >= 0.8 ? 'var(--ok)' : t.score / t.max >= 0.6 ? 'var(--warn)' : 'var(--bad)'}">${t.score}/${t.max}</b>` : `<span class="chip">${e.status === 'doing' ? '答题中' : '未开始'}</span>`}<span class="chev">›</span></a>`; }).join('')}</div>` : emptyState('exam', '还没有试卷', '用上面的按钮生成一份试卷，或选择模拟考试预设限时练习。')}`;
  $('#demo').onclick = () => { const e = demoExam(null); S.exams.push(e); save('exams'); location.hash = '#/learn/exam/' + e.id; };
});

/* ---- 成绩记录（按科目的趋势图） ---- */
route('/learn/exam-history', 'learn', v => {
  setTop('成绩记录', { back: '#/learn/exams' });
  const all = S.exams.filter(e => e.status === 'graded').sort((a, b) => (a.submittedAt || a.createdAt) - (b.submittedAt || b.createdAt));
  const sid = Q.get('s') ?? '__all';
  const subs = [...new Set(all.map(examSubject))];
  const list = sid === '__all' ? all : all.filter(e => examSubject(e) === sid);
  const pts = list.map(e => ({ y: examPct(e), label: shortMD(e.submittedAt || e.createdAt) }));
  const avg = pts.length ? Math.round(pts.reduce((a, p) => a + p.y, 0) / pts.length * 10) / 10 : 0;
  const best = pts.length ? Math.max(...pts.map(p => p.y)) : 0;
  const last3 = pts.slice(-3), prev3 = pts.slice(-6, -3); const tr = last3.length && prev3.length ? (last3.reduce((a, p) => a + p.y, 0) / last3.length) - (prev3.reduce((a, p) => a + p.y, 0) / prev3.length) : null;
  v.innerHTML = all.length ? `<div class="chips" style="margin-bottom:10px"><a class="chip ${sid === '__all' ? 'sel' : ''}" href="#/learn/exam-history">全部</a>${subs.map(k => `<a class="chip ${sid === k ? 'sel' : ''}" href="#/learn/exam-history?s=${k}">${esc(k ? subj(k).name : '综合')}</a>`).join('')}</div>
    <div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="v">${list.length}</div><div class="l">考试次数</div></div><div class="stat"><div class="v">${avg}%</div><div class="l">平均得分率</div></div><div class="stat"><div class="v">${best}%</div><div class="l">最高</div></div></div>
    <div class="card"><div style="display:flex;justify-content:space-between"><b>得分率趋势</b>${tr != null ? `<span class="small" style="color:${tr >= 0 ? 'var(--ok)' : 'var(--bad)'}">近 3 次 ${tr >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(tr * 10) / 10)}%</span>` : ''}</div>${lineChart(pts, { h: 180 })}</div>
    ${sid === '__all' && subs.length > 1 ? `<h3>各科概览</h3><div class="list">${subs.map(k => { const es = all.filter(e => examSubject(e) === k); const ps = es.map(examPct); return `<a class="row" href="#/learn/exam-history?s=${k}"><span class="dot" style="background:${k ? subj(k).color : 'var(--sub)'}"></span><div class="grow"><div class="t">${esc(k ? subj(k).name : '综合')}</div><div class="s">${es.length} 次 · 平均 ${Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)}% · 最近 ${ps[ps.length - 1]}%</div></div><span class="chev">›</span></a>`; }).join('')}</div>` : ''}
    <h3>考试明细</h3><div class="list">${list.slice().reverse().map(e => { const t = examTotals(e); return `<a class="row" href="#/learn/exam/${e.id}"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${fmtDateTime(e.submittedAt || e.createdAt)} · 用时 ${Math.max(1, Math.round((e.durationSec || 0) / 60))} 分钟${e.autoSubmitted ? ' · 超时自动交卷' : ''}</div></div><b>${t.score}/${t.max}</b><span class="chev">›</span></a>`; }).join('')}</div>`
    : emptyState('chart', '还没有已判分的考试', '交卷判分后，这里会按科目显示得分趋势。', '<a class="btn small ghost" href="#/learn/exam/new">去做一套模拟题</a>');
});
// 简易 SVG 折线图（0–100）
function lineChart(pts, { h = 160, mini = false } = {}) {
  if (!pts.length) return '<div class="small muted" style="padding:20px 0;text-align:center">暂无数据</div>';
  const W = 340, H = h, pl = mini ? 4 : 28, pr = 10, pt = 12, pb = mini ? 6 : 22; const n = pts.length;
  const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)); const y = v => pt + (100 - v) * (H - pt - pb) / 100;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const grid = mini ? '' : [0, 60, 80, 100].map(g => `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-dasharray="${g === 60 ? '4 3' : g === 0 ? '0' : '2 4'}"/><text x="${pl - 4}" y="${y(g) + 4}" text-anchor="end" font-size="10" fill="var(--sub)">${g}</text>`).join('');
  const step = Math.ceil(n / 6);
  const labels = mini ? '' : pts.map((p, i) => i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--sub)">${esc(p.label)}</text>` : '').join('');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="${mini ? 2.5 : 4}" stroke="var(--card)" stroke-width="${mini ? 1 : 2}" fill="${p.y >= 80 ? 'var(--ok)' : p.y >= 60 ? 'var(--warn)' : 'var(--bad)'}"/>${!mini && n <= 10 ? `<text x="${x(i)}" y="${y(p.y) - 7}" text-anchor="middle" font-size="10" fill="var(--text)">${Math.round(p.y)}</text>` : ''}`).join('');
  const gid = 'lg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="linechart${mini ? ' mini' : ''}" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--pri)" stop-opacity=".28"/><stop offset="1" stop-color="var(--pri)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${gid})"/><path class="lc-line" d="${path}" fill="none" stroke="var(--pri)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
}

/* ---- 生成试卷 ---- */
const examDraft = { types: { single: 5, multiple: 2, judge: 3, blank: 3, short: 1, calc: 1 }, difficulty: 'medium', variants: false, variantN: 3, extra: '', timeLimit: 0, preset: '' };
route('/learn/exam/new', 'learn', v => {
  setTop('生成试卷', { back: '#/learn/exams' });
  const D = examDraft;
  let bookId = Q.get('book') ?? D.bookId ?? (S.books[0]?.id || ''); let chSel = new Set(Q.get('ch') ? [Q.get('ch')] : (D.bookId === bookId && D.chSel ? D.chSel : []));
  const wrongIds = (Q.get('wrong') || '').split(',').filter(Boolean);
  if (wrongIds.length) { D.variants = true; D.variantN = wrongIds.length; }
  let topic = D.topic || '';
  if (Q.get('preset') && EXAM_PRESETS[Q.get('preset')] && D.preset !== Q.get('preset')) applyPreset(Q.get('preset'));
  function applyPreset(k) {
    const p = EXAM_PRESETS[k]; D.preset = k; D.types = { ...ZERO_TYPES(), ...p.types }; D.difficulty = p.difficulty; D.timeLimit = p.time; D.extra = p.extra; D.cet = !!p.cet;
    if (p.subject) D.subject = p.subject; if (p.topic) { D.topic = p.topic; topic = p.topic; }
    const b = bookById(bookId); if (!b || (p.subject && b.subject !== p.subject)) { const nb = S.books.find(x => x.subject === p.subject && !p.cet); bookId = nb ? nb.id : ''; chSel = new Set(); }
  }
  const draw = () => {
    const b = bookById(bookId); if (b && !chSel.size && !Q.get('ch')) b.chapters.forEach(c => chSel.add(c.id));
    const subjectId = D.subject ?? (b?.subject || '');
    const pool = wrongIds.length ? S.wrongs.filter(w => wrongIds.includes(w.id)) : S.wrongs.filter(w => !w.mastered && (!subjectId || w.subject === subjectId || !w.subject));
    const chars = b ? b.chapters.filter(c => chSel.has(c.id)).reduce((a, c) => a + c.text.length, 0) : 0;
    const total = QT_ORDER.reduce((a, t) => a + (D.types[t] || 0), 0) + (D.variants && !D.cet ? Math.min(D.variantN, pool.length) : 0);
    const P = EXAM_PRESETS[D.preset];
    v.innerHTML = `
    ${!AI.ready() ? `<div class="notice">尚未配置 AI，点「生成」将使用内置示例题目演示流程（含计时与交卷）。<a href="#/me/settings?s=ai">去配置 AI</a></div>` : ''}
    <h3>模拟考试预设</h3><div class="chips" id="pre">${Object.entries(EXAM_PRESETS).map(([k, p]) => `<button class="chip ${D.preset === k ? 'sel' : ''}" data-p="${k}">${p.icon} ${p.name}</button>`).join('')}</div>
    ${P ? `<div class="notice info small" style="margin-top:8px">${P.icon} <b>${P.name}</b>：${P.desc}${P.cet ? '<br>按四级真题结构出题，各部分分值按比例缩小（满分 50）。' : ''}</div>` : ''}
    <h3>出题范围</h3><div class="card">
      ${D.cet ? '' : `<label class="f"><span>教材</span><select id="bk"><option value="">不使用教材（按主题出题）</option>${S.books.map(x => `<option value="${x.id}" ${x.id === bookId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>`}
      ${b && !D.cet ? `<div style="display:flex;justify-content:space-between;align-items:center;margin:0 2px 6px"><span class="small muted">选择章节（${chSel.size}/${b.chapters.length}，约 ${chars.toLocaleString()} 字${chars > S.settings.ai.maxChars ? `，将截取约 ${S.settings.ai.maxChars.toLocaleString()} 字` : ''}）</span><button class="btn small plain" id="all">${chSel.size === b.chapters.length ? '全不选' : '全选'}</button></div>
        <div class="list" style="max-height:240px;overflow:auto;background:var(--card2)" id="chs">${b.chapters.map(c => `<div class="row" data-id="${c.id}" style="min-height:44px;padding:8px 12px"><button class="check ${chSel.has(c.id) ? 'on' : ''}" style="width:24px;height:24px">${chSel.has(c.id) ? '✓' : ''}</button><div class="grow"><div class="t" style="font-weight:400">${esc(c.title)}</div></div><span class="small muted">${c.text.length}字</span></div>`).join('')}</div>`
        : `<label class="f" style="margin:0"><span>主题 / 知识范围</span><textarea id="tp" style="min-height:70px" placeholder="例如：高等数学 · 导数的应用（单调性、极值、凹凸性）">${esc(topic)}</textarea></label>`}
      <label class="f" style="margin:12px 0 0"><span>科目</span><select id="sj">${subjOptions(subjectId)}</select></label>
    </div>
    <h3>考试时间</h3><div class="card"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div class="t"><b>${D.timeLimit ? `限时 ${D.timeLimit} 分钟` : '不限时'}</b></div><div class="small muted">${D.timeLimit ? '倒计时结束自动交卷' : '正计时，随时交卷'}</div></div><button class="btn small plain" id="tm" style="width:40px">−</button><button class="btn small plain" id="tp2" style="width:40px">＋</button></div>
      <div class="chips" style="margin-top:10px">${[0, 20, 45, 90, 120].map(m => `<button class="chip ${D.timeLimit === m ? 'sel' : ''}" data-tl="${m}">${m ? m + ' 分钟' : '不限时'}</button>`).join('')}</div></div>
    ${D.cet ? '' : `<h3>题型与数量</h3><div class="list">${QT_ORDER.map(t => `<div class="row" style="min-height:52px"><div class="grow"><div class="t">${QT[t].name}</div><div class="s">每题 ${QT[t].score} 分${QT[t].objective ? ' · 自动判分' : ' · AI 批改'}</div></div><button class="btn small plain" data-t="${t}" data-d="-1" style="width:40px">−</button><b style="width:28px;text-align:center">${D.types[t] || 0}</b><button class="btn small plain" data-t="${t}" data-d="1" style="width:40px">＋</button></div>`).join('')}</div>
    <h3>难度</h3><div class="seg" id="df">${Object.entries(DIFF).map(([k, l]) => `<button data-k="${k}" class="${D.difficulty === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <h3>举一反三</h3><div class="card"><div class="row" style="padding:0;min-height:44px;border:0"><div class="grow"><div class="t">加入错题变式题</div><div class="s">按错题的同题型、同知识点出新题（可用错题 ${pool.length} 道）</div></div><label class="switch"><input type="checkbox" id="vr" ${D.variants ? 'checked' : ''} ${pool.length ? '' : 'disabled'}><span></span></label></div>
      ${D.variants && pool.length ? `<div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="grow small muted" style="flex:1">变式题数量</span><button class="btn small plain" id="vm" style="width:40px">−</button><b>${Math.min(D.variantN, pool.length)}</b><button class="btn small plain" id="vp" style="width:40px">＋</button></div>
        <div class="small muted" style="margin-top:8px">${pool.slice(0, Math.min(D.variantN, pool.length)).map(w => `· [${QT[w.qtype]?.short || ''}] ${esc(w.knowledgePoint || w.stem.slice(0, 24))}`).join('<br>')}</div>` : ''}</div>`}
    <h3>其他要求（可选）</h3><textarea id="ex" style="min-height:70px" placeholder="例如：多考查概念辨析；计算题数据简单些；英语题用英文出题">${esc(D.extra)}</textarea>
    <div class="kbd-space"></div>
    <button class="btn block" id="gen" style="min-height:52px">${AI.ready() ? `${icon('sparkle', 18)} AI 生成${P ? P.name : '试卷'}（${total} 题${D.timeLimit ? ' · ' + D.timeLimit + ' 分钟' : ''}）` : `生成示例${P ? P.name : '试卷'}`}</button>`;
    $('#pre').onclick = e => { const x = e.target.closest('[data-p]'); if (!x) return; if (D.preset === x.dataset.p) { D.preset = ''; D.cet = false; } else applyPreset(x.dataset.p); draw(); };
    const bk = $('#bk'); if (bk) bk.onchange = () => { bookId = bk.value; chSel = new Set(); D.subject = undefined; draw(); };
    const chs = $('#chs'); if (chs) chs.onclick = e => { const r = e.target.closest('[data-id]'); if (!r) return; chSel.has(r.dataset.id) ? chSel.delete(r.dataset.id) : chSel.add(r.dataset.id); if (!chSel.size) chSel.add('__none'); draw(); };
    const all = $('#all'); if (all) all.onclick = () => { if (chSel.size === b.chapters.length) chSel = new Set(['__none']); else chSel = new Set(b.chapters.map(c => c.id)); draw(); };
    const tp = $('#tp'); if (tp) tp.oninput = () => { topic = tp.value; D.topic = topic; };
    $('#sj').onchange = e => { D.subject = e.target.value; draw(); };
    $('#tm').onclick = () => { D.timeLimit = Math.max(0, (D.timeLimit || 0) - 5); draw(); };
    $('#tp2').onclick = () => { D.timeLimit = Math.min(240, (D.timeLimit || 0) + 5); draw(); };
    $$('[data-tl]', v).forEach(x => x.onclick = () => { D.timeLimit = +x.dataset.tl; draw(); });
    $$('[data-t]', v).forEach(btn => btn.onclick = () => { const t = btn.dataset.t; D.types[t] = Math.max(0, Math.min(30, (D.types[t] || 0) + +btn.dataset.d)); draw(); });
    const df = $('#df'); if (df) df.onclick = e => { const x = e.target.closest('button'); if (x) { D.difficulty = x.dataset.k; draw(); } };
    const vr = $('#vr'); if (vr) vr.onchange = e => { D.variants = e.target.checked; draw(); };
    const vm = $('#vm'); if (vm) { vm.onclick = () => { D.variantN = Math.max(1, Math.min(D.variantN, pool.length) - 1); draw(); }; $('#vp').onclick = () => { D.variantN = Math.min(pool.length, 20, D.variantN + 1); draw(); }; }
    $('#ex').oninput = e => D.extra = e.target.value;
    $('#gen').onclick = () => { chSel.delete('__none'); D.bookId = bookId; D.chSel = [...chSel]; generateExam({ b: D.cet ? null : b, chSel, topic, subjectId: $('#sj').value, pool: D.variants && !D.cet ? pool.slice(0, Math.min(D.variantN, pool.length)) : [], total }); };
  };
  draw();
});
function buildMaterial(b, chSel) {
  const max = S.settings.ai.maxChars; const chs = b.chapters.filter(c => chSel.has(c.id)); const tot = chs.reduce((a, c) => a + c.text.length, 0);
  if (tot <= max) return chs.map(c => `【${c.title}】\n${c.text}`).join('\n\n');
  // 按比例从每章截取，保证每章都有覆盖
  return chs.map(c => { const n = Math.max(300, Math.floor(c.text.length / tot * max)); const t = c.text; if (t.length <= n) return `【${c.title}】\n${t}`; const h = Math.floor(n / 2); return `【${c.title}】\n${t.slice(0, h)}\n……\n${t.slice(Math.floor(t.length / 2), Math.floor(t.length / 2) + n - h)}`; }).join('\n\n');
}
const LATEX_RULE = '数学、物理公式一律使用 LaTeX：行内公式用 $...$，独立公式用 $$...$$；JSON 字符串中的反斜杠必须写成两个（例如 "\\\\frac{1}{2}"、"\\\\int_0^1"）。程序代码放在 Markdown 代码块中。';
async function generateExam({ b, chSel, topic, subjectId, pool, total, title: forceTitle, kp }) {
  const D = examDraft; const P = EXAM_PRESETS[D.preset];
  if (!total) return toast('请至少选择一种题型');
  if (b && !chSel.size) return toast('请至少选择一个章节');
  if (!b && !topic.trim() && AI.ready() && !D.cet) return toast('请填写出题主题，或选择一本教材');
  const title = forceTitle || (P ? `${P.name} · 模拟卷` : (b ? b.title + (chSel.size < b.chapters.length ? ' · ' + b.chapters.filter(c => chSel.has(c.id)).map(c => c.title).slice(0, 2).join('、') + (chSel.size > 2 ? '等' : '') : '') : (topic.trim().slice(0, 20) || '练习')) + ' 测试卷');
  if (!AI.ready()) {
    const e = demoExam(D.cet ? null : D.types, (P ? P.name + ' · 示例卷 ' : '示例试卷 · ') + fmtDate(Date.now()), { cet: D.cet, subject: subjectId, timeLimit: D.cet ? 30 : D.timeLimit });
    if (pool.length) toast('示例模式不支持变式题，配置 AI 后可用');
    e.preset = D.preset || '';
    S.exams.push(e); save('exams'); location.hash = '#/learn/exam/' + e.id; return;
  }
  const typeReq = D.cet ? CET_REQ : QT_ORDER.filter(t => D.types[t]).map(t => `${QT[t].name}（type="${t}"）${D.types[t]} 道，每题 ${QT[t].score} 分`).join('；');
  const variantReq = pool.length ? `\n\n【举一反三】另外，请针对以下 ${pool.length} 道学生做错的题目，各出 1 道“变式题”：与原题考查同一知识点、同一题型，但更换情境、数据或问法，不能与原题雷同。变式题的 source 字段设为 "variant"，wrongId 设为对应错题编号。\n` + pool.map((w, i) => `错题${i + 1}（wrongId="${w.id}"）：题型=${QT[w.qtype]?.name || w.qtype}；知识点=${w.knowledgePoint || '未标注'}；题目=${w.stem.slice(0, 300)}${w.options ? '；选项=' + w.options.join(' / ') : ''}；正确答案=${fmtAnswer({ type: w.qtype }, w.answer)}`).join('\n') : '';
  const sys = '你是一位经验丰富的大学课程命题老师，严格依据给定材料出题，题目科学严谨、无歧义、答案唯一且正确，并附简洁解析。只输出 JSON，不要输出任何其他文字。';
  const schema = `输出 JSON 格式：
{"title":"试卷标题","questions":[
 {"type":"single","stem":"题干","options":["选项内容1","选项内容2","选项内容3","选项内容4"],"answer":"B","explanation":"解析","knowledgePoint":"知识点","chapter":"所属章节","score":3},
 {"type":"multiple","stem":"…","options":["…","…","…","…"],"answer":["A","C"],"explanation":"…","knowledgePoint":"…","score":4},
 {"type":"judge","stem":"一个陈述句","answer":true,"explanation":"…","knowledgePoint":"…","score":2},
 {"type":"blank","stem":"含有 ____ 作为空位的句子，每个空用 ____ 表示","answer":["第1空答案","第2空答案（多个可接受答案用|分隔）"],"explanation":"…","knowledgePoint":"…","score":3},
 {"type":"short","stem":"…","answer":"参考答案要点","explanation":"评分要点","knowledgePoint":"…","score":10},
 {"type":"calc","stem":"…","answer":"完整解题过程与结果","explanation":"评分要点（步骤分）","knowledgePoint":"…","score":12}
]}
可选字段：section（所属部分名称）、material（阅读材料原文，同一材料的各题填写相同内容）。
注意：options 只写选项内容，不要带“A.”前缀；单选 answer 为一个字母；多选 answer 为字母数组（至少 2 个正确项）；判断 answer 为 true/false；填空 answer 数组长度必须等于题干中 ____ 的个数。knowledgePoint 请用简短、规范的知识点名称（如“洛必达法则”“矩阵的秩”）。
${LATEX_RULE}`;
  const content = `${b ? `请根据以下教材内容出一份试卷。\n\n=== 教材内容开始 ===\n${buildMaterial(b, chSel)}\n=== 教材内容结束 ===` : `请围绕以下主题出一份试卷：${(topic || '').trim() || (P ? P.topic : '')}`}
\n科目：${subj(subjectId).name}\n${kp ? `专项练习知识点：${kp}（所有题目都必须考查该知识点及其直接相关内容）\n` : ''}难度：${DIFF[D.difficulty]}${D.difficulty === 'mixed' ? '（基础 50%、中等 30%、提高 20%）' : ''}\n题型和数量：${typeReq || '无'}${variantReq}\n${D.extra.trim() ? '其他要求：' + D.extra.trim() + '\n' : ''}\n${schema}`;
  try {
    const res = await withLoading(`AI 正在出题（${total} 题），通常需要 20–90 秒…`, sig => AI.json([{ role: 'system', content: sys }, { role: 'user', content }], validateExam, { signal: sig, temperature: 0.5, maxTokens: D.cet ? 6000 : undefined }));
    const e = { id: uid(), title: forceTitle || res.title || title, subject: subjectId, bookId: b?.id || '', chapterIds: b ? [...chSel] : [], topic: b ? '' : topic, createdAt: Date.now(), difficulty: D.difficulty, questions: res.questions, status: 'new', answers: {}, results: {}, timeLimit: D.timeLimit || 0, preset: D.preset || '', kp: kp || '' };
    e.questions.forEach(q => { q.subject = subjectId; if (kp && !q.knowledgePoint) q.knowledgePoint = kp; if (q.source === 'variant' && q.wrongRef) { const w = S.wrongs.find(x => x.id === q.wrongRef); if (w) { q.knowledgePoint = q.knowledgePoint || w.knowledgePoint; } } });
    if (!e.questions.some(q => q.section)) e.questions.sort((a, b2) => QT_ORDER.indexOf(a.type) - QT_ORDER.indexOf(b2.type));
    S.exams.push(e); save('exams');
    if (res.dropped) toast(`有 ${res.dropped} 道题格式不合格已自动剔除`);
    location.hash = '#/learn/exam/' + e.id;
  } catch (err) { showAIError(err); }
}

/* ---- 答题 & 结果 ---- */
function qHead(q, i, extra = '') { return `<div class="qh"><b>${i + 1}.</b><span class="chip">${QT[q.type].short}</span><span class="chip">${q.score} 分</span>${q.source === 'variant' ? '<span class="chip" style="color:var(--pri2)">变式题</span>' : ''}${q.knowledgePoint ? `<span class="chip">${esc(q.knowledgePoint)}</span>` : ''}${extra}</div>`; }
const richText = s => /```|^#{1,3}\s|^\s*[-*]\s/m.test(s) ? md(s) : rt(s);
function stemHtml(q, inputs) {
  const img = q.image ? `<img class="qimg" src="${q.image}" alt="题目图片">` : '';
  if (q.type !== 'blank' || !inputs) return `<div class="stem${/```/.test(q.stem) ? ' md' : ''}">${richText(q.stem)}</div>${img}`;
  let k = 0; return `<div class="stem">${withMath(q.stem, t => esc(t).replace(BLANK_RE, () => `<b style="color:var(--pri)">（${++k}）</b>`))}</div>${img}`;
}
route('/learn/exam/:id', 'learn', (v, id) => {
  const e = S.exams.find(x => x.id === id); if (!e) { location.hash = '#/learn/exams'; return; }
  if (e.status === 'graded') return renderResult(v, e);
  setTop(e.title, { back: '#/learn/exams', actions: `<button class="icon-btn txt" id="more">⋯</button>` });
  if (e.status === 'new') { e.status = 'doing'; e.startedAt = Date.now(); save('exams'); }
  const lim = (e.timeLimit || 0) * 60000; let submitting = false;
  const groups = examGroups(e);
  let idx = 0;
  v.innerHTML = `<div class="card exam-bar ${lim ? 'timed' : ''}" style="position:sticky;top:calc(var(--toph) + var(--sat) + 6px);z-index:5;padding:10px 14px"><div style="display:flex;justify-content:space-between;align-items:center;font-size:14px"><span>已答 <b id="ac">0</b>/${e.questions.length}</span><span class="muted">满分 ${examTotals(e).max} · ${lim ? '剩余' : '用时'} <b id="el" class="clock">0:00</b></span></div><div class="progress" style="margin-bottom:0"><i id="ap" style="width:0"></i></div></div>
  ${e.demo ? '<div class="notice info">这是示例试卷：客观题自动判分；未配置 AI 时主观题由你对照参考答案自评。</div>' : ''}
  ${lim ? `<div class="notice small">⏱ 本卷限时 <b>${e.timeLimit} 分钟</b>，倒计时结束将<b>自动交卷</b>。离开页面计时不会暂停。</div>` : ''}
  ${groups.map(g => { let prevM = ''; return `<h3>${esc(g.title)}<span class="small muted" style="font-weight:400">（${g.sub}）</span></h3>${g.qs.map(q => { const i = idx++; const a = e.answers[q.id]; const mh = materialHtml(q, prevM); prevM = q.material || prevM; return `${mh}<div class="q" data-q="${q.id}">${qHead(q, i)}${stemHtml(q, true)}${answerInput(q, a)}</div>`; }).join('')}`; }).join('')}
  <button class="btn block" id="submit" style="min-height:52px;margin-top:8px">交卷并判分</button>`;
  const upd = () => { const n = e.questions.filter(q => answered(q, e.answers[q.id])).length; $('#ac').textContent = n; $('#ap').style.width = n / e.questions.length * 100 + '%'; };
  upd();
  const autoSubmit = () => { if (submitting) return; submitting = true; clearInterval(t); e.autoSubmitted = true; toast('⏰ 考试时间到，已自动交卷'); setTimeout(() => submitExam(e), 0); };
  const tick = () => {
    const ms = Date.now() - e.startedAt; const el = $('#el'); if (!el) return;
    if (lim) { const left = lim - ms; el.textContent = fmtMS(left); el.classList.toggle('warn', left < 5 * 60000); el.classList.toggle('danger', left < 60000); if (left <= 5 * 60000 && left > 5 * 60000 - 1000) toast('还剩 5 分钟，请抓紧检查'); if (left <= 0) autoSubmit(); }
    else el.textContent = fmtMS(ms);
  };
  const t = setInterval(tick, 1000); tick();
  const persist = debounce(() => save('exams'), 400);
  // 每题用时：把两次作答操作之间的时间记到当前作答的题目上（单段最多 10 分钟，离开页面不计）
  e.qTime = e.qTime || {}; let lastT = Date.now();
  const stamp = q => { const now = Date.now(); if (!document.hidden) e.qTime[q.id] = (e.qTime[q.id] || 0) + Math.min(now - lastT, 600000); lastT = now; };
  const vis = () => { if (!document.hidden) lastT = Date.now(); }; document.addEventListener('visibilitychange', vis);
  v.addEventListener('click', ev => {
    const o = ev.target.closest('.opt'); if (!o) return; const qe = o.closest('[data-q]'); const q = e.questions.find(x => x.id === qe.dataset.q); stamp(q);
    if (q.type === 'single') { e.answers[q.id] = o.dataset.v; $$('.opt', qe).forEach(x => x.classList.toggle('sel', x === o)); }
    else if (q.type === 'judge') { e.answers[q.id] = o.dataset.v === 'T'; $$('.opt', qe).forEach(x => x.classList.toggle('sel', x === o)); }
    else if (q.type === 'multiple') { const s = new Set(e.answers[q.id] || []); s.has(o.dataset.v) ? s.delete(o.dataset.v) : s.add(o.dataset.v); e.answers[q.id] = [...s].sort(); o.classList.toggle('sel'); }
    persist(); upd();
  });
  v.addEventListener('input', ev => {
    const inp = ev.target.closest('[data-in]'); if (!inp) return; const qe = inp.closest('[data-q]'); const q = e.questions.find(x => x.id === qe.dataset.q); stamp(q);
    if (q.type === 'blank') e.answers[q.id] = $$('[data-in]', qe).map(x => x.value); else e.answers[q.id] = inp.value;
    persist(); upd();
  });
  $('#submit').onclick = async () => {
    if (submitting) return;
    const un = e.questions.filter(q => !answered(q, e.answers[q.id])).length;
    if (un && !(await confirmBox(`还有 ${un} 题未作答，确定交卷吗？`, '交卷', false))) return;
    if (submitting) return; submitting = true; clearInterval(t); await submitExam(e);
  };
  $('#more').onclick = () => openSheet(`<h2>试卷操作</h2><div class="list"><a class="row" href="#/learn/exam-print/${e.id}?mode=paper">${iconTile('print', '#64748b', 18)}<div class="grow">打印 / 导出 PDF</div></a><div class="row" id="rs">清空作答重新开始</div><div class="row" id="dl" style="color:var(--bad)">删除试卷</div></div>`, el => {
    $('#rs', el).onclick = () => { e.answers = {}; e.qTime = {}; e.startedAt = Date.now(); save('exams'); closeSheet(); rerender(); };
    $('#dl', el).onclick = async () => { if (await confirmBox('删除这份试卷？', '删除')) { S.exams = S.exams.filter(x => x !== e); save('exams'); location.hash = '#/learn/exams'; } };
  });
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
});
function answerInput(q, a) {
  if (q.type === 'single' || q.type === 'multiple') return q.options.map((o, i) => { const L = LETTERS[i]; const sel = q.type === 'single' ? a === L : (a || []).includes(L); return `<div class="opt ${sel ? 'sel' : ''}" data-v="${L}"><b>${L}.</b><span>${rt(o)}</span></div>`; }).join('') + (q.type === 'multiple' ? '<div class="small muted">（多选，可选多个）</div>' : '');
  if (q.type === 'judge') return `<div class="grid2">${[['T', '正确 √', true], ['F', '错误 ×', false]].map(([k, l, val]) => `<div class="opt ${a === val ? 'sel' : ''}" data-v="${k}" style="justify-content:center">${l}</div>`).join('')}</div>`;
  if (q.type === 'blank') return q.answer.map((_, i) => `<input type="text" data-in="${i}" value="${esc((a || [])[i] || '')}" placeholder="第 ${i + 1} 空" style="margin-bottom:8px" autocomplete="off" autocapitalize="off">`).join('');
  const big = q.type === 'calc' || /Writing|Translation|作文|翻译/.test(q.section || '');
  return `<textarea data-in="0" placeholder="${q.type === 'calc' ? '写出主要步骤和结果（公式可用 $...$ 书写）' : '写下你的答案'}" style="min-height:${big ? 170 : 110}px">${esc(a || '')}</textarea>`;
}
async function submitExam(e) {
  e.results = {};
  e.questions.forEach(q => { if (QT[q.type].objective) e.results[q.id] = gradeObjective(q, e.answers[q.id]); });
  const subjQs = e.questions.filter(q => !QT[q.type].objective);
  const unanswered = subjQs.filter(q => !answered(q, e.answers[q.id]));
  unanswered.forEach(q => e.results[q.id] = { score: 0, max: q.score, status: 'bad', feedback: '未作答', by: 'auto' });
  const toGrade = subjQs.filter(q => answered(q, e.answers[q.id]));
  e.status = 'graded'; e.submittedAt = Date.now(); e.durationSec = Math.round((e.submittedAt - (e.startedAt || e.submittedAt)) / 1000);
  if (e.timeLimit) e.durationSec = Math.min(e.durationSec, e.timeLimit * 60);
  toGrade.forEach(q => e.results[q.id] = { score: 0, max: q.score, status: 'pending', feedback: '请对照参考答案自评', by: 'self' });
  save('exams');
  if (toGrade.length && AI.ready()) {
    try { await withLoading(`AI 正在批改 ${toGrade.length} 道主观题…`, sig => gradeSubjectiveAI(e, toGrade, sig)); }
    catch (err) { showAIError(err); toGrade.forEach(q => e.results[q.id] = { score: 0, max: q.score, status: 'pending', feedback: 'AI 批改失败，请对照参考答案自评', by: 'self' }); }
  }
  const pending = Object.values(e.results).some(r => r.status === 'pending');
  const n = pending ? 0 : collectWrongs(e); save('exams');
  if (n) toast(`已将 ${n} 道错题加入错题本`);
  rerender();
  if (!pending) Game.examDone(e); else Game.after();
}
function renderResult(v, e) {
  setTop(e.title, { back: '#/learn/exams', actions: `<button class="icon-btn txt" id="more">⋯</button>` });
  const t = examTotals(e); const pct = t.max ? t.score / t.max : 0; const pending = e.questions.filter(q => e.results[q.id]?.status === 'pending');
  const byType = QT_ORDER.map(k => { const qs = e.questions.filter(q => q.type === k); if (!qs.length) return ''; const s = qs.reduce((a, q) => a + (e.results[q.id]?.score || 0), 0), m = qs.reduce((a, q) => a + q.score, 0); return `<div class="hbar"><span class="lab">${QT[k].short}</span><span class="track"><i style="width:${m ? s / m * 100 : 0}%;background:${s / m >= .8 ? 'var(--ok)' : s / m >= .6 ? 'var(--warn)' : 'var(--bad)'}"></i></span><span class="val">${Math.round(s * 10) / 10}/${m}</span></div>`; }).join('');
  const hasSec = e.questions.some(q => q.section);
  const bar = (lab, s, m) => `<div class="hbar"><span class="lab">${esc(lab)}</span><span class="track"><i style="width:${m ? s / m * 100 : 0}%;background:${s / m >= .8 ? 'var(--ok)' : s / m >= .6 ? 'var(--warn)' : 'var(--bad)'}"></i></span><span class="val">${Math.round(s * 10) / 10}/${m}</span></div>`;
  const bySec = hasSec ? examGroups(e).map(g => bar(g.title.replace(/^Part\s*[IVX]+\s*/i, '').replace(/\s*·\s*Section\s*([A-C]).*/, ' $1').slice(0, 12), g.qs.reduce((a, q) => a + (e.results[q.id]?.score || 0), 0), g.qs.reduce((a, q) => a + q.score, 0))).join('') : '';
  const qt = e.qTime || {}; const timed = e.questions.filter(q => qt[q.id] > 0);
  const fmtT = ms => { const s = Math.round(ms / 1000); return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`; };
  const slow = timed.slice().sort((a, b) => qt[b.id] - qt[a.id]).slice(0, 3);
  const avgObj = (() => { const o = timed.filter(q => QT[q.type].objective); return o.length ? o.reduce((a, q) => a + qt[q.id], 0) / o.length : 0; })();
  const timeCard = timed.length >= 2 ? `<div class="card"><b>⏱ 每题用时</b><div class="small muted" style="margin:2px 0 8px">${avgObj ? `客观题平均 ${fmtT(avgObj)} / 题 · ` : ''}最耗时的题：</div>${slow.map(q => { const i = e.questions.indexOf(q); const r = e.results[q.id] || {}; return `<div class="hbar"><span class="lab">第 ${i + 1} 题</span><span class="track"><i style="width:${qt[q.id] / qt[slow[0].id] * 100}%;background:${r.status === 'ok' ? 'var(--ok)' : 'var(--bad)'}"></i></span><span class="val" style="min-width:70px">${fmtT(qt[q.id])}</span></div>`; }).join('')}${slow.some(q => e.results[q.id]?.status === 'bad') ? '<div class="small muted" style="margin-top:6px">花时间多又做错的题，往往就是知识盲点，优先复习。</div>' : ''}</div>` : '';
  const wrongCount = e.questions.filter(q => (e.results[q.id]?.score || 0) < q.score).length;
  let idx = 0;
  v.innerHTML = `<div class="card" style="text-align:center"><div class="score-big" style="color:${pct >= .8 ? 'var(--ok)' : pct >= .6 ? 'var(--warn)' : 'var(--bad)'}">${t.score}<span style="font-size:22px;color:var(--sub)"> / ${t.max}</span></div>
    <div class="muted small">${pct >= .9 ? '太棒了！' : pct >= .8 ? '很不错，继续保持' : pct >= .6 ? '及格啦，看看错题' : '别灰心，弄懂错题就是进步'} · 用时 ${Math.max(1, Math.round((e.durationSec || 0) / 60))} 分钟${e.timeLimit ? `/${e.timeLimit}` : ''} · 错 ${wrongCount} 题${e.autoSubmitted ? ' · ⏰ 超时自动交卷' : ''}</div>
    <div style="text-align:left;margin-top:10px">${hasSec ? bySec : byType}</div></div>
    ${timeCard}
    ${pending.length ? `<div class="notice">有 ${pending.length} 道主观题待你自评：请对照参考答案选择得分，全部评完后会自动把错题加入错题本。${AI.ready() ? '<button class="btn small" id="regrade" style="margin-left:6px">让 AI 批改</button>' : ''}</div>` : ''}
    <div class="btns" style="margin-bottom:12px"><a class="btn ghost" href="#/learn/wrong-analysis">薄弱点分析</a><button class="btn ghost" id="again">${wrongCount && AI.ready() ? '错题举一反三' : '再做一遍'}</button></div>
    ${examGroups(e).map(g => { let prevM = ''; return `<h3>${esc(g.title)}</h3>` + g.qs.map(q => { const i = idx++; const r = e.results[q.id] || {}; const a = e.answers[q.id]; const mh = materialHtml(q, prevM); prevM = q.material || prevM; return `${mh}<div class="q" data-q="${q.id}">${qHead(q, i, `<span class="chip" style="color:${r.status === 'ok' ? 'var(--ok)' : r.status === 'mid' ? 'var(--warn)' : r.status === 'pending' ? 'var(--info)' : 'var(--bad)'}">${r.status === 'pending' ? '待自评' : `得 ${r.score ?? 0} 分`}</span>${qt[q.id] ? `<span class="chip">⏱ ${fmtT(qt[q.id])}</span>` : ''}`)}${stemHtml(q, true)}${resultBody(q, a, r)}</div>`; }).join(''); }).join('')}`;
  v.onclick = ev => {
    const btn = ev.target.closest('[data-act]'); if (!btn) return; const qe = btn.closest('[data-q]'); const q = e.questions.find(x => x.id === qe.dataset.q); const r = e.results[q.id];
    if (btn.dataset.act === 'self') { const f = +btn.dataset.f; r.score = Math.round(q.score * f * 2) / 2; r.status = f >= 1 ? 'ok' : f > 0 ? 'mid' : 'bad'; r.by = 'self'; r.feedback = '自评'; if (!e.questions.some(x => e.results[x.id]?.status === 'pending')) { const n = collectWrongs(e); if (n) toast(`已将 ${n} 道错题加入错题本`); } save('exams'); rerender(); }
    else if (btn.dataset.act === 'override') { r.score = q.score; r.status = 'ok'; r.feedback = (r.feedback ? r.feedback + '\n' : '') + '（已手动改判为正确）'; S.wrongs = S.wrongs.filter(w => !(w.examId === e.id && w.qid === q.id)); save('wrongs'); save('exams'); rerender(); }
    else if (btn.dataset.act === 'addwrong') { if (!S.wrongs.some(w => w.examId === e.id && w.qid === q.id)) { S.wrongs.unshift(wrongFromQuestion(q, e, e.answers[q.id], r)); save('wrongs'); } toast('已加入错题本'); btn.disabled = true; }
  };
  const rg = $('#regrade'); if (rg) rg.onclick = async () => { try { await withLoading('AI 正在批改…', sig => gradeSubjectiveAI(e, pending, sig)); collectWrongs(e); save('exams'); rerender(); } catch (err) { showAIError(err); } };
  $('#again').onclick = () => {
    if (wrongCount && AI.ready()) { const ids = S.wrongs.filter(w => w.examId === e.id).map(w => w.id); examDraft.types = ZERO_TYPES(); examDraft.preset = ''; examDraft.cet = false; location.hash = `#/learn/exam/new?${e.bookId ? 'book=' + e.bookId + '&' : ''}wrong=${ids.join(',')}`; return; }
    const ne = { ...structuredClone(e), id: uid(), createdAt: Date.now(), status: 'new', answers: {}, results: {}, qTime: {}, autoSubmitted: false, title: e.title.replace(/（重做）$/, '') + '（重做）' }; S.exams.push(ne); save('exams'); location.hash = '#/learn/exam/' + ne.id;
  };
  $('#more').onclick = () => openSheet(`<h2>试卷操作</h2><div class="list"><a class="row" href="#/learn/exam-print/${e.id}?mode=paper">${iconTile('print', '#64748b', 18)}<div class="grow">打印试卷 / 导出 PDF</div></a><a class="row" href="#/learn/exam-print/${e.id}?mode=key">${iconTile('notes', '#0ea5e9', 18)}<div class="grow">打印答案与解析</div></a><a class="row" href="#/learn/exam-history">${iconTile('chart', '#10b981', 18)}<div class="grow">成绩记录</div></a><div class="row" id="tobank">${iconTile('layers', '#14b8a6', 18)}<div class="grow">加入题库（以后反复刷）</div></div><div class="row" id="dl" style="color:var(--bad)">删除试卷</div></div>`, el => {
    $('#tobank', el).onclick = () => Bank.addFromExam(e);
    $('#dl', el).onclick = async () => { if (await confirmBox('删除这份试卷？（错题本中的题目会保留）', '删除')) { S.exams = S.exams.filter(x => x !== e); save('exams'); location.hash = '#/learn/exams'; } };
  });
}
function resultBody(q, a, r) {
  let h = '';
  if (q.type === 'single' || q.type === 'multiple') h += q.options.map((o, i) => { const L = LETTERS[i]; const isAns = q.type === 'single' ? q.answer === L : q.answer.includes(L); const picked = q.type === 'single' ? a === L : (a || []).includes(L); return `<div class="opt ${isAns ? 'right' : picked ? 'wrong' : ''}" style="cursor:default"><b>${L}.</b><span style="flex:1">${rt(o)}</span>${picked ? '<span class="small">你的选择</span>' : ''}</div>`; }).join('');
  else if (q.type === 'judge') h += `<div class="small">你的答案：${fmtAnswer(q, a)}　正确答案：<b>${q.answer ? '正确 √' : '错误 ×'}</b></div>`;
  else if (q.type === 'blank') h += `<div class="small">${q.answer.map((ans, i) => { const u = (a || [])[i]; const ok = blankMatch(u, ans); return `第 ${i + 1} 空：你的答案「${esc(u || '未填')}」${ok ? '✅' : '❌'}　正确答案：<b>${rt(ans.split('|').join(' 或 '))}</b>`; }).join('<br>')}</div>`;
  else h += `<div class="small muted">你的答案：</div><div class="verdict" style="background:var(--card2)">${rt(a || '（未作答）')}</div><div class="small muted" style="margin-top:8px">参考答案：</div><div class="verdict md" style="background:var(--card2)">${md(q.answer)}</div>`;
  if (r.status === 'pending') h += `<div class="small muted" style="margin-top:10px">自评得分：</div><div class="btns" style="margin-top:6px"><button class="btn small danger" data-act="self" data-f="0">0 分</button><button class="btn small plain" data-act="self" data-f="0.5">一半 ${q.score / 2}</button><button class="btn small ok" data-act="self" data-f="1">满分 ${q.score}</button></div>`;
  if (r.feedback && r.status !== 'pending') h += `<div class="verdict ${r.status}">${r.by === 'ai' ? 'AI 点评：' : ''}${rt(r.feedback)}</div>`;
  if (q.explanation) h += `<div class="verdict md" style="background:var(--pri-soft)">${spkBtn(q.explanation)}<b>解析：</b>${md(q.explanation)}</div>`;
  if (r.status !== 'pending') h += `<div class="btns" style="margin-top:8px">${r.score < q.score ? `<button class="btn small plain" data-act="override">我答对了（改判）</button>` : `<button class="btn small plain" data-act="addwrong">加入错题本</button>`}</div>`;
  return h;
}

/* ---- 打印 / 导出 PDF ---- */
function printAnswer(q) {
  if (q.type === 'single') return q.answer;
  if (q.type === 'multiple') return q.answer.join('');
  if (q.type === 'judge') return q.answer ? '正确（√）' : '错误（×）';
  if (q.type === 'blank') return q.answer.map((x, i) => `（${i + 1}）${rt(x.split('|')[0])}`).join('　');
  return `<div class="pans">${md(q.answer)}</div>`;
}
function printHtml(e, mode) {
  const t = examTotals(e); const groups = examGroups(e); const sname = examSubject(e) ? subj(examSubject(e)).name : '综合';
  let html = '';
  if (mode !== 'key') {
    let idx = 0;
    html += `<div class="ph"><h1>${esc(e.title)}</h1><div class="pmeta">科目：${esc(sname)}　满分：${t.max} 分${e.timeLimit ? `　考试时间：${e.timeLimit} 分钟` : ''}　共 ${e.questions.length} 题</div><div class="pinfo">姓名：<u></u>学号：<u></u>班级：<u></u>得分：<u></u></div></div>`;
    html += groups.map(g => { let prevM = ''; return `<h2>${esc(g.title)}<small>（${g.sub}）</small></h2>` + g.qs.map(q => {
      const i = ++idx; let h = ''; if (q.material && q.material !== prevM) { prevM = q.material; h += `<div class="pmat">${md(q.material)}</div>`; }
      const opts = q.options ? `<div class="popts ${q.options.every(o => o.length <= 12) ? 'four' : ''}">${q.options.map((o, k) => `<span>${LETTERS[k]}. ${rt(o)}</span>`).join('')}</div>` : '';
      const space = q.type === 'short' || q.type === 'calc' ? `<div class="pspace" style="height:${/Writing|作文/.test(q.section || '') ? 22 : q.type === 'calc' ? 11 : 7}em"></div>` : q.type === 'judge' ? '' : '';
      return h + `<div class="pq"><div class="pstem"><b>${i}.</b> ${q.type === 'judge' ? '' : ''}${richText(q.stem)}<span class="pscore">（${q.score} 分）${q.type === 'judge' ? '（　　）' : ''}</span></div>${q.image ? `<img class="qimg" src="${q.image}">` : ''}${opts}${space}</div>`;
    }).join(''); }).join('');
  }
  if (mode !== 'paper') {
    let idx = 0;
    html += `<div class="pkey ${mode === 'both' ? 'pbreak' : ''}"><div class="ph"><h1>${esc(e.title)}</h1><div class="pmeta">参考答案与解析</div></div>`;
    html += groups.map(g => `<h2>${esc(g.title)}</h2>` + g.qs.map(q => `<div class="pk"><div><b>${++idx}.</b> 答案：${printAnswer(q)}</div>${q.explanation ? `<div class="pex"><b>解析：</b>${md(q.explanation)}</div>` : ''}${q.knowledgePoint ? `<div class="pex small">知识点：${esc(q.knowledgePoint)}</div>` : ''}</div>`).join('')).join('') + '</div>';
  }
  return html;
}
route('/learn/exam-print/:id', 'learn', (v, id) => {
  const e = S.exams.find(x => x.id === id); if (!e) { location.hash = '#/learn/exams'; return; }
  const mode = ['paper', 'key', 'both'].includes(Q.get('mode')) ? Q.get('mode') : 'paper';
  setTop('打印 / 导出 PDF', { back: '#/learn/exam/' + id });
  v.innerHTML = `<div class="noprint"><div class="seg" id="pm">${[['paper', '试卷'], ['key', '答案与解析'], ['both', '试卷 + 答案']].map(([k, l]) => `<button data-k="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn block" id="pr" style="margin:12px 0 8px">${icon('print', 18)} 打印 / 存为 PDF</button>
    <div class="small muted" style="margin-bottom:12px">iPhone：点上面按钮 → 打印选项里<b>双指张开预览图</b> → 右上角分享 → 「存储到文件」即得 PDF；也可直接 AirPrint 打印。电脑：打印对话框选择「另存为 PDF」。</div></div>
    <div class="paper">${printHtml(e, mode)}</div>`;
  $('#pm').onclick = ev => { const b = ev.target.closest('button'); if (b) location.hash = `#/learn/exam-print/${id}?mode=${b.dataset.k}`; };
  $('#pr').onclick = () => { document.body.classList.add('printing'); setTimeout(() => { try { window.print(); } catch (err) { toast('当前环境不支持打印，请用 Safari 打开后再试'); } }, 50); };
  const after = () => document.body.classList.remove('printing'); window.addEventListener('afterprint', after);
  return () => { window.removeEventListener('afterprint', after); after(); };
});
