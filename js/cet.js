'use strict';
/* ========== 四级专项（CET-4）：考试倒计时 · 每日单词（FSRS 复用卡片系统）· 阅读/选词填空 · 写作翻译限时模考 ==========
   词表：data/cet4.json（1500 个四级核心词，来源 KyleBing/english-vocabulary，BSD-3-Clause，按词频筛选），首次使用时才加载。
   练习题、作文都复用「AI 出卷」的考试引擎：判分、AI 批改、错题自动进错题本。 */
const CET_READ = [
  { t: 'Sleep and Memory', p: `Scientists have long known that sleep matters, but only recently have they begun to understand how closely it is linked to memory. During deep sleep, the brain replays the experiences of the day, moving important information from short-term storage into long-term memory. This process, known as consolidation, explains why students who stay up all night before an exam often perform worse than those who get a full night's rest.\n\nIn one study, two groups of university students learned a list of new words in the evening. One group slept normally, while the other stayed awake. The next morning, the students who had slept remembered about 20 percent more words. Even a short nap of 60 to 90 minutes in the afternoon produced a similar, though smaller, effect.\n\nResearchers also found that the timing of review matters. Reviewing material shortly before bed seems to give the brain a clear signal about what is worth keeping. However, using phones in bed can delay sleep and reduce its quality, cancelling out the benefit. The advice is simple: study, review briefly, put the phone away, and let sleep do the rest.`,
    q: [['What is the main idea of the passage?', ['Students should study all night before exams.', 'Sleep plays an important role in forming long-term memory.', 'Naps are more useful than a full night of sleep.', 'Phones help students review before bed.'], 'B', '全文围绕睡眠与记忆巩固的关系展开。'],
      ['What happens during deep sleep according to the first paragraph?', ['The brain stops working completely.', 'Short-term memories are deleted.', 'Important information is moved into long-term memory.', 'New words are learned without effort.'], 'C', '第一段：moving important information from short-term storage into long-term memory。'],
      ['In the study, the students who slept normally', ['remembered about 20 percent more words', 'forgot most of the words', 'needed a nap in the afternoon', 'performed the same as the other group'], 'A', '第二段 remembered about 20 percent more words。'],
      ['Why is reviewing shortly before bed helpful?', ['It makes students fall asleep faster.', 'It tells the brain what is worth keeping.', 'It replaces the need for sleep.', 'It increases phone use.'], 'B', '第三段 give the brain a clear signal about what is worth keeping。'],
      ['What does the author suggest about phones?', ['They should be used to set study reminders in bed.', 'They improve sleep quality.', 'They should be put away before sleep.', 'They are necessary for review.'], 'C', '最后一句 put the phone away。']] },
  { t: 'Learning by Teaching', p: `Many students believe that the best way to learn is to read the textbook again and again. Research suggests, however, that one of the most effective methods is to teach what you have learned to someone else. This is sometimes called the "protégé effect".\n\nWhen students prepare to teach, they organize information more carefully, look for the key ideas, and think about questions others might ask. In an experiment, students who were told they would have to teach a lesson later scored higher on a test than students who were told they would simply be tested, even though neither group actually taught anyone.\n\nTeaching also reveals gaps in understanding. It is easy to feel that you understand a chapter when you read it, but explaining it aloud quickly shows which parts are still unclear. For this reason, study groups in which members take turns explaining topics can be more productive than studying alone. Students without a study partner can still benefit: explaining a concept to an imaginary listener, or even to a pet, produces many of the same advantages.`,
    q: [['What is the "protégé effect"?', ['Learning better by teaching others.', 'Reading a textbook many times.', 'Studying with a pet.', 'Asking teachers for help.'], 'A', '第一段定义。'],
      ['In the experiment, the students who expected to teach', ['taught a real class', 'scored higher on the test', 'did not prepare at all', 'were tested earlier'], 'B', '第二段 scored higher on a test。'],
      ['According to the passage, explaining a topic aloud helps students', ['finish reading faster', 'avoid group work', 'find out what they still do not understand', 'remember the textbook word for word'], 'C', '第三段 reveals gaps in understanding。'],
      ['Why can study groups be productive?', ['Members take turns explaining topics.', 'Members can share textbooks.', 'Teachers join the groups.', 'They meet more often.'], 'A', '第三段 members take turns explaining topics。'],
      ['What can students without a study partner do?', ['Give up teaching.', 'Explain concepts to an imaginary listener.', 'Only read the textbook.', 'Wait for the teacher.'], 'B', '最后一句。']] }
];
const CET_CLOZE = [
  { t: 'Making Friends at College', bank: ['A) actively', 'B) anxious', 'C) common', 'D) confidence', 'E) connect', 'F) differences', 'G) effort', 'H) gradually', 'I) habit', 'J) involved', 'K) lonely', 'L) opportunity', 'M) share', 'N) support', 'O) unique'],
    p: `Starting college can make even outgoing students feel ＿＿＿ (1). Everyone around you is new, and it may seem that others have already found their friends. In fact, most freshmen feel just as ＿＿＿ (2) as you do. The good news is that college offers countless chances to ＿＿＿ (3) with people.\n\nThe easiest way is to get ＿＿＿ (4) in activities you enjoy. Clubs, sports teams and volunteer groups bring together people with ＿＿＿ (5) interests. Each meeting is an ＿＿＿ (6) to start a conversation. Do not wait for others to talk to you; take part ＿＿＿ (7) and ask simple questions.\n\nFriendships rarely form overnight. They grow ＿＿＿ (8) as people spend time together and ＿＿＿ (9) experiences. It also takes ＿＿＿ (10): remembering a classmate's name or inviting someone for a meal can make a big difference.`,
    a: ['lonely|K', 'anxious|B', 'connect|E', 'involved|J', 'common|C', 'opportunity|L', 'actively|A', 'gradually|H', 'share|M', 'effort|G'] }
];
const CET_WRITE = [
  { stem: 'Directions: For this part, you are allowed 30 minutes to write an essay on **the importance of time management for college students**. You should write at least 120 words but no more than 180 words.',
    ref: 'Model: Time management is one of the most valuable skills a college student can develop. Unlike high school, college gives students a great deal of free time, and how they use it largely decides their success.\n\nFirst, good time management helps students keep up with their studies. By making a weekly plan and breaking large assignments into small steps, they can avoid last-minute stress. Second, it leaves room for a balanced life. Students who plan well have time for sports, friends and enough sleep, which in turn improves their efficiency.\n\nIn short, managing time wisely is not about being busy all the time, but about doing the right things at the right time. Every college student should start practising it from the first day.' },
  { stem: 'Directions: For this part, you are allowed 30 minutes to write an essay on **whether college students should take part-time jobs**. You should write at least 120 words but no more than 180 words.',
    ref: 'Model: Nowadays it is common for college students to take part-time jobs. In my opinion, a suitable part-time job can benefit students, as long as it does not affect their studies.\n\nOn the one hand, part-time work gives students practical experience and helps them understand society. They learn to communicate, cooperate and take responsibility, which are skills that cannot be learned from textbooks. On the other hand, earning some money reduces the burden on their families and teaches them the value of money.\n\nHowever, study should always come first. Students should choose jobs related to their majors and limit their working hours. Only in this way can part-time jobs become a bridge between campus and career.' },
  { stem: 'Directions: For this part, you are allowed 30 minutes to write an essay on **the role of mobile phones in college study**. You should write at least 120 words but no more than 180 words.',
    ref: 'Model: Mobile phones have become an inseparable part of college life. Whether they help or harm study depends on how students use them.\n\nUsed wisely, phones are powerful learning tools. Students can look up words, watch online lectures and review flashcards anywhere. However, endless notifications and short videos easily distract attention and waste precious time, and using phones late at night harms sleep.\n\nTherefore, students should set rules for themselves, such as turning off notifications while studying and keeping phones away from the bed. In this way, the phone can serve our study instead of controlling our lives.' }
];
const CET_TRANS = [
  { stem: 'Directions: 请将下面这段话翻译成英文。\n\n中国的高铁（high-speed rail）发展迅速，已经成为世界上规模最大的高铁网络。高铁不仅缩短了城市之间的距离，也极大地方便了人们的出行。越来越多的人选择乘坐高铁出差、旅游或回家探亲。高铁的发展还促进了沿线地区的经济增长。',
    ref: "China's high-speed rail has developed rapidly and has become the largest high-speed rail network in the world. It has not only shortened the distance between cities but also made travel much more convenient. More and more people choose to take high-speed trains for business trips, travel or visiting their families. The development of high-speed rail has also promoted economic growth in the regions along the lines." },
  { stem: 'Directions: 请将下面这段话翻译成英文。\n\n中秋节是中国的传统节日，在农历八月十五。这一天，家人们会团聚在一起，赏月、吃月饼。圆圆的月亮象征着团圆，因此中秋节也被称为“团圆节”。如今，很多在外工作的年轻人也会在这一天给家人打电话，表达思念之情。',
    ref: 'The Mid-Autumn Festival is a traditional Chinese festival that falls on the 15th day of the eighth lunar month. On this day, family members get together to admire the moon and eat mooncakes. The round moon symbolizes reunion, so the festival is also called the "Reunion Festival". Today, many young people working away from home also call their families on this day to express how much they miss them.' },
  { stem: 'Directions: 请将下面这段话翻译成英文。\n\n近年来，越来越多的大学生开始利用网络课程学习。网络课程时间灵活，内容丰富，学生可以根据自己的需要选择课程。但是，网络学习也需要很强的自律能力。专家建议，学生应制定合理的学习计划，并与同学互相监督。',
    ref: 'In recent years, more and more college students have begun to learn through online courses. Online courses are flexible in time and rich in content, and students can choose courses according to their own needs. However, online learning also requires strong self-discipline. Experts suggest that students should make reasonable study plans and supervise each other with classmates.' }
];
const CET_RUBRIC = `【四级评分标准（满分按该题分值等比换算）】
写作（15 分制）：14 分档（13–15）切题，思想表达清楚，文字通顺连贯，基本无语言错误；11 分档（10–12）切题，表达较清楚，文字较连贯，少量语言错误；8 分档（7–9）基本切题，有些地方表达不清，连贯性差，有较多严重语言错误；5 分档（4–6）基本切题，表达思想不清楚，连贯性很差，较多严重错误；2 分档（1–3）条理不清，思路紊乱，语言支离破碎；少于 120 词酌情扣分，离题 0 分。
翻译（15 分制）：14 分档（13–15）准确表达原文意思，用词贴切，行文流畅，基本无错误；11 分档（10–12）基本表达原文意思，文字通顺连贯，无重大错误；8 分档（7–9）勉强表达原文意思，用词欠准确，较多语言错误，其中有些严重；5 分档（4–6）仅表达小部分原文意思，用词不准确，严重错误很多；2 分档（1–3）支离破碎，除个别词语外绝大部分未表达原文意思。
点评请写明所在档次、主要优点、2–3 处具体可改进的地方（给出改写示例）。`;
const Cet = {
  cfg() { return S.settings.cet || (S.settings.cet = { date: '', deckId: '' }); },
  /** 默认考试日：每年 6 月 / 12 月的第二个星期六（以官方通知为准） */
  nextDate(from = new Date()) {
    const today = dayKey(from.getTime());
    for (const y of [from.getFullYear(), from.getFullYear() + 1]) for (const m of [5, 11]) {
      const d = new Date(y, m, 1); const sat = 1 + (6 - d.getDay() + 7) % 7 + 7; const k = dayKey(new Date(y, m, sat).getTime());
      if (k >= today) return k;
    }
  },
  date() { const d = this.cfg().date; return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= dayKey() ? d : this.nextDate(); },
  daysLeft() { return Math.max(0, Math.round((dk2ts(this.date()) - startOfDay()) / DAY)); },
  deck() { const id = this.cfg().deckId; return id && S.decks.find(d => d.id === id); },
  words() {
    const d = this.deck(); if (!d) return { started: false, total: 1500, learned: 0, newToday: 0, newGoal: 20, due: 0 };
    const cs = S.cards.filter(c => c.deckId === d.id); const c = Cards.counts(d.id);
    return { started: true, total: cs.length, learned: cs.filter(x => x.state !== 'new').length, newToday: Cards.newDoneToday(d.id), newGoal: Cards.newLimit(d.id), due: c.newToday + c.learn + c.due };
  },
  async ensureDeck() {
    let d = this.deck(); if (d) return d;
    const res = await fetch('data/cet4.json'); if (!res.ok) throw new Error('词表加载失败'); const j = await res.json();
    const now = Date.now(); d = { id: uid(), name: '四级核心词汇', subject: 'english', createdAt: now, newPerDay: 20, preset: 'cet4-core' };
    const cards = j.w.filter(w => Array.isArray(w) && typeof w[0] === 'string').map((w, i) => { const c = Cards.newCard(d.id, String(w[0]).slice(0, 40), String(w[1] || '').slice(0, 80) + (w[2] ? `\n\n*${String(w[2]).slice(0, 60)}*` : '')); c.createdAt = now + i; c.due = now + i; return c; });
    S.decks.push(d); S.cards.push(...cards); this.cfg().deckId = d.id; saveSettings(); save('decks'); save('cards');
    return d;
  },
  /* ---- 练习：AI 生成（有 Key）或本地示例 ---- */
  mkExam(title, raw, opt = {}) {
    const { questions } = validateExam({ questions: raw }); questions.forEach(q => q.subject = 'english');
    const e = { id: uid(), title, subject: 'english', createdAt: Date.now(), difficulty: 'medium', questions, status: 'new', answers: {}, results: {}, timeLimit: opt.timeLimit || 0, cet: true, preset: 'cet4', demo: !!opt.demo };
    S.exams.unshift(e); save('exams'); return e;
  },
  sample(kind) {
    const n = S.exams.filter(e => e.cet && e.cetKind === kind).length;
    if (kind === 'read') { const r = CET_READ[n % CET_READ.length]; return r.q.map(([stem, options, answer, explanation]) => ({ type: 'single', section: 'Part II Reading · Section C 仔细阅读', material: `**${r.t}**\n\n${r.p}`, stem, options, answer, explanation, knowledgePoint: '四级仔细阅读' })); }
    if (kind === 'cloze') { const c = CET_CLOZE[n % CET_CLOZE.length]; return [{ type: 'blank', section: 'Part II Reading · Section A 选词填空', material: `**${c.t}**\n\n${c.p}`, stem: `Word Bank：${c.bank.join('　')}\n\n依次填写 (1)–(10) 的单词（或字母）：` + c.a.map((_, i) => ` (${i + 1}) ____`).join(''), answer: c.a, explanation: '答案：' + c.a.map((x, i) => `(${i + 1}) ${x.split('|')[1]}) ${x.split('|')[0]}`).join('；'), knowledgePoint: '四级选词填空', score: 10 }]; }
  },
  async practice(kind) {
    const name = kind === 'read' ? '仔细阅读' : '选词填空';
    let qs = null, demo = false;
    if (AI.ready() && navigator.onLine) {
      const req = kind === 'read'
        ? '出 1 篇四级「仔细阅读」（Section C）：一篇约 300 词、贴近大学生活或社会话题的英文短文，配 5 道 type="single" 四选一题（options 4 项，answer 为字母 A–D），每题写中文 explanation（指出原文依据）。5 道题的 material 字段都填同一篇完整短文，section="Part II Reading · Section C 仔细阅读"，knowledgePoint 写考查点（如 主旨大意 / 细节理解 / 推理判断 / 词义猜测）。'
        : '出 1 道四级「选词填空」（Section A）：一篇约 220 词的英文短文，留 10 个空，用 ＿＿＿ (1) 到 ＿＿＿ (10) 标出；给出 15 个备选词的 Word Bank（A)–O)，词性搭配合理，有 5 个干扰词）。输出 1 道 type="blank" 的题：material=带空的短文全文，stem=「Word Bank：A) … O)」加一句「依次填写 (1)–(10)」并在 stem 中写 10 个 ____，answer=长度 10 的数组，每项写成「单词|字母」，explanation 写中文解析，section="Part II Reading · Section A 选词填空"，knowledgePoint="四级选词填空"。';
      try {
        const res = await withLoading(`学姐正在出一份四级${name}…`, sig => AI.json([{ role: 'system', content: '你是经验丰富的大学英语四级（CET-4）命题老师，严格按真题格式和难度出题，只输出 JSON：{"title":"...","questions":[...]}。' }, { role: 'user', content: req }], validateExam, { signal: sig, temperature: 0.7, maxTokens: 3000 }));
        qs = res.questions;
      } catch (e) { if (e?.name === 'AbortError' || e?.kind === 'abort') return; toast('AI 出题没成功，先用内置示例题练练'); }
    }
    if (!qs) { qs = this.sample(kind); demo = true; }
    const e = this.mkExam(`四级${name} · ${fmtDate(Date.now())}${demo ? '（示例）' : ''}`, qs, { demo }); e.cetKind = kind; save('exams');
    location.hash = '#/learn/exam/' + e.id;
  },
  mock() {
    const n = S.exams.filter(e => e.cet && e.cetKind === 'wt').length;
    const w = CET_WRITE[n % CET_WRITE.length], t = CET_TRANS[n % CET_TRANS.length];
    const e = this.mkExam(`四级写作 + 翻译 · 限时模考 ${fmtDate(Date.now())}`, [
      { type: 'short', section: 'Part I Writing', stem: w.stem, answer: w.ref, explanation: '按四级写作 5 档评分：切题、内容、连贯、语言准确性；字数 120–180。', knowledgePoint: '四级写作', score: 15 },
      { type: 'short', section: 'Part III Translation', stem: t.stem, answer: t.ref, explanation: '按四级翻译 5 档评分：意思准确、用词贴切、行文流畅。', knowledgePoint: '四级翻译', score: 15 }
    ], { timeLimit: 60 });
    e.cetKind = 'wt'; e.questions.forEach(q => q.score = 15); save('exams');
    location.hash = '#/learn/exam/' + e.id;
  }
};
route('/learn/cet', 'learn', v => {
  setTop('四级专项', { back: '#/learn' });
  const W = Cet.words(), dl = Cet.daysLeft(), dt = Cet.date(), d = new Date(dk2ts(dt));
  const cetWrong = S.wrongs.filter(w => !w.mastered && (w.subject === 'english' || /四级/.test(w.knowledgePoint || ''))).length;
  const ex = S.exams.filter(e => e.cet).slice(0, 2);
  const line = dl <= 7 ? '最后一周，保持手感、早点睡，比熬夜刷题更重要。' : dl <= 30 ? '进入冲刺期啦，每天一篇阅读 + 背单词，稳稳的。' : '时间还很充裕，每天 20 个单词，积少成多。';
  const p = W.newGoal ? Math.min(1, W.newToday / W.newGoal) : 0;
  v.innerHTML = `<div class="card cet-hero"><div class="cet-cd"><span>距离四级</span><b class="num">${dl}</b><em>天</em></div><div class="cet-hd"><div class="cet-dt">${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}</div><button class="link-btn" id="cetDate">修改日期</button>
    <div class="cet-lin">${Game.mascot(dl <= 7 ? 'cheer' : 'normal', 36)}<span>${esc(line)}</span></div></div></div>
        <div class="card cet-w"><div class="cet-wr">${Game.rings([{ p, c: 'var(--c-cards)' }], 64)}<div class="cet-wn"><b class="num">${W.newToday}</b><span>/${W.newGoal}</span></div></div>
      <div class="grow"><b>${W.started ? (W.due ? `今天还有 ${W.due} 张` : '今天的单词完成啦') : '1500 个四级核心词'}</b><div class="small muted">${W.started ? `已学 ${W.learned} / ${W.total}` : '每天 20 个，自动安排复习'}</div>
      <div class="xpbar sm" style="margin-top:8px"><i style="width:${Math.round(W.learned / (W.total || 1) * 100)}%"></i></div></div></div>
    <button class="btn block" id="cetGo">${icon('words', 18)} ${W.started ? (W.due ? '开始背单词' : '再看看已学单词') : '开始背单词'}</button>
    ${secHead('专项练习', '#/learn/wrong?subject=english', cetWrong ? `英语错题 ${cetWrong}` : '英语错题')}
    <div class="list">
      <button class="row" id="cetRead">${iconTile('books', '#6366f1', 18)}<div class="grow"><div class="t">仔细阅读</div><div class="s">1 篇 · 5 题</div></div><span class="chev">›</span></button>
      <button class="row" id="cetCloze">${iconTile('edit', '#10b981', 18)}<div class="grow"><div class="t">选词填空</div><div class="s">15 选 10</div></div><span class="chev">›</span></button>
      <button class="row" id="cetWT">${iconTile('clock', '#ff9f0a', 18)}<div class="grow"><div class="t">写作 + 翻译</div><div class="s">60 分钟限时</div></div><span class="chev">›</span></button>
      <a class="row" href="#/learn/pastpapers">${iconTile('doc', '#f59e0b', 18)}<div class="grow"><div class="t">四级真题</div><div class="s">导入真题包后练习</div></div><span class="chev">›</span></a>
      <a class="row" href="#/learn/exam/new?preset=cet4">${iconTile('exam', '#ec4899', 18)}<div class="grow"><div class="t">整套模拟卷</div><div class="s">100 分钟</div></div><span class="chev">›</span></a>
    </div>
    ${ex.length ? `<h3>最近练习</h3><div class="list">${ex.map(e => { const t = examTotals(e); return `<a class="row" href="#/learn/exam/${e.id}"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${e.status === 'graded' || e.status === 'done' ? `${t.score} / ${t.max} 分` : '未完成'}</div></div><span class="chev">›</span></a>`; }).join('')}</div>` : ''}
    <p class="small muted cet-note">${AI.ready() ? '' : '未配置 AI 时使用内置示例题。'}考试日期为预估，以学校通知为准；练听力可以用<a href="#/learn/listen">影视精听</a>导入自己的美剧片段，或点 🔊 朗读材料。</p>`;
  $('#cetGo').onclick = async () => { const b = $('#cetGo'); b.disabled = true; try { const d = await Cet.ensureDeck(); location.hash = '#/learn/review/' + d.id; } catch (e) { toast(e.message || '词表加载失败'); b.disabled = false; } };
  $('#cetRead').onclick = () => Cet.practice('read');
  $('#cetCloze').onclick = () => Cet.practice('cloze');
  $('#cetWT').onclick = async () => { if (await confirmBox('开始 60 分钟限时模考？（写作 30 分钟 + 翻译 30 分钟，时间到自动交卷）', '开始')) Cet.mock(); };
  $('#cetDate').onclick = () => openSheet(`<h2>四级考试日期</h2><label class="f"><span>考试日期</span><input type="date" id="cdI" value="${esc(Cet.date())}" min="${dayKey()}"></label><p class="small muted">默认是下一次 6 月 / 12 月的第二个周六，请以学校通知为准。</p><div class="btns"><button class="btn plain" id="cdR">恢复默认</button><button class="btn" id="cdOk">保存</button></div>`, el => {
    $('#cdOk', el).onclick = () => { const x = $('#cdI', el).value; if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return toast('请选择日期'); Cet.cfg().date = x; saveSettings(); closeSheet(); rerender(); };
    $('#cdR', el).onclick = () => { Cet.cfg().date = ''; saveSettings(); closeSheet(); rerender(); };
  });
});
/* 阅读材料朗读（练耳朵）：只朗读英文材料 */
document.addEventListener('click', e => { const b = e.target.closest('.mat-say'); if (!b) return; const m = b.closest('.material'); const t = m ? [...m.childNodes].filter(n => n !== b && !n.classList?.contains('small')).map(n => n.textContent).join('\n') : ''; if (t) TTS.toggle([{ text: t, lang: 'en' }], b); });
