'use strict';
/* ========== 游戏化：经验值 / 等级 / 连胜冻结 / 奖章 / 庆祝（v5 · Apple 风格呈现；吉祥物代码保留但不在界面显示） ========== */
const LV_TITLES = ['萌新学徒', '求知新芽', '勤学小将', '学习新星', '知识探索者', '专注达人', '学霸预备', '学霸', '学术大佬', '学神'];
const MASCOT_LINES = {
  morning: ['早上好！今天也一起发芽吧 🌱', '新的一天，先来一个番茄？', '早起的人有经验值拿 ✨'],
  normal: ['今天学一点，明天强一点', '一起把今日目标点亮吧！', '我在这儿陪你学 💚', '先完成一件小事，状态就来了'],
  close: ['只差一点就达成今日目标啦！', '冲刺！目标就在眼前 🔥'],
  done: ['今日目标达成！你太棒了 🎉', '火力全开的一天！继续保持', '今天的你闪闪发光 ✨'],
  night: ['夜深了，复习几张卡就去休息吧 🌙', '早点睡，记忆会在梦里巩固哦'],
  encourage: ['没关系，这张已安排在稍后再次出现', '再看一眼解析，印象会更深', '失误是复习的一部分', '慢一点也没关系，继续', '已记下，下次会更熟练'],
  combo: { 3: '状态很好', 5: '势头正盛', 8: '非常专注', 10: '完美连击', 15: '无可挑剔' }
};
/* ---- 吉祥物「奶糖」：奶油色小猫 + 靛蓝围巾（原创 SVG，5 种情绪：normal/happy/cheer/encourage/sleepy） ---- */
const MASCOT = (() => {
let _u = 0;
function face(mood, o) {
  const { ex = 44, ey = 60, gap = 32, er = 7.6, D = '#2A2622', mx = 60, my = 76, id } = o;
  const L = ex, R = ex + gap;
  const open = (dy = 0) => `<g class="m-eyes">${[L, R].map(x => `<ellipse cx="${x}" cy="${ey + dy}" rx="${er}" ry="${er * 1.18}" fill="url(#${id}eye)"/><ellipse cx="${x + er * .3}" cy="${ey + dy - er * .45}" rx="${er * .36}" ry="${er * .42}" fill="#fff"/><circle cx="${x - er * .35}" cy="${ey + dy + er * .5}" r="${er * .16}" fill="#fff" opacity=".8"/>`).join('')}</g>`;
  const arcs = `<g class="m-eyes">${[L, R].map(x => `<path d="M${x - er} ${ey + 2}q${er} -${er * 1.5} ${er * 2} 0" stroke="${D}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`).join('')}</g>`;
  const closed = `<g class="m-eyes">${[L, R].map(x => `<path d="M${x - er} ${ey}q${er} ${er * 1.1} ${er * 2} 0" stroke="${D}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('')}</g>`;
  const eyes = mood === 'happy' || mood === 'cheer' ? arcs : mood === 'sleepy' ? closed : open(mood === 'encourage' ? -1 : 0);
  const mouth = {
    normal: `<path d="M${mx - 5} ${my}q2.5 3 5 0q2.5 3 5 0" stroke="${D}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    happy: `<path d="M${mx - 6} ${my - 1}q6 9 12 0z" fill="${D}"/><path d="M${mx - 3.4} ${my + 3.2}q3.4-2.6 6.8 0q-1.6 2-3.4 2t-3.4-2z" fill="#FF8396"/>`,
    cheer: `<path d="M${mx - 8} ${my - 2}q8 13 16 0z" fill="${D}"/><path d="M${mx - 4.6} ${my + 4.4}q4.6-3.4 9.2 0q-2 2.8-4.6 2.8t-4.6-2.8z" fill="#FF8396"/>`,
    encourage: `<path d="M${mx - 6} ${my - .5}q6 6 12 0" stroke="${D}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sleepy: `<ellipse cx="${mx}" cy="${my + 1}" rx="2.6" ry="2.1" fill="${D}"/>`
  }[mood];
  return eyes + mouth;
}
function defs(id, c) {
  return `<defs>
  <radialGradient id="${id}fur" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="${c.f0}"/><stop offset=".62" stop-color="${c.f1}"/><stop offset="1" stop-color="${c.f2}"/></radialGradient>
  <radialGradient id="${id}eye" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#5A4A42"/><stop offset=".55" stop-color="#211A17"/><stop offset="1" stop-color="#0E0B0A"/></radialGradient>
  <linearGradient id="${id}sc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.s0}"/><stop offset="1" stop-color="${c.s1}"/></linearGradient>
  <radialGradient id="${id}sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}spec" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="${id}soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="${c.shadow}" flood-opacity=".28"/></filter>
  </defs>`;
}
function extras(mood, col = '#5E5CE6') {
  if (mood === 'cheer') return `<g class="m-fx"><path d="M14 30l2.2 5.3 5.3 2.2-5.3 2.2-2.2 5.3-2.2-5.3-5.3-2.2 5.3-2.2z" fill="#FFB800"/><path d="M104 20l1.7 4 4 1.7-4 1.7-1.7 4-1.7-4-4-1.7 4-1.7z" fill="#FFB800"/><circle cx="108" cy="46" r="2.4" fill="${col}" opacity=".7"/></g>`;
  if (mood === 'sleepy') return `<g class="m-fx" fill="${col}" font-family="-apple-system,ui-rounded,sans-serif" font-weight="700"><text x="92" y="30" font-size="13">z</text><text x="103" y="19" font-size="9" opacity=".7">z</text></g>`;
  if (mood === 'encourage') return `<g class="m-fx"><path d="M101 33c-2.6-3.6-8-1.6-7 2.6.6 2.6 4 4.6 7 6.6 3-2 6.4-4 7-6.6 1-4.2-4.4-6.2-7-2.6z" fill="#FF5C7A"/></g>`;
  return '';
}
function paws(mood, fill, y = 94) {
  if (mood === 'cheer') return `<g class="m-arms"><ellipse cx="22" cy="66" rx="8" ry="10" transform="rotate(-30 22 66)" fill="${fill}"/><ellipse cx="98" cy="66" rx="8" ry="10" transform="rotate(30 98 66)" fill="${fill}"/></g>`;
  if (mood === 'encourage') return `<g class="m-arms"><ellipse cx="36" cy="${y + 2}" rx="8" ry="6.5" fill="${fill}"/><ellipse cx="90" cy="80" rx="8" ry="9" transform="rotate(20 90 80)" fill="${fill}"/></g>`;
  return `<g class="m-arms"><ellipse cx="44" cy="${y + 4}" rx="8.5" ry="6.5" fill="${fill}"/><ellipse cx="76" cy="${y + 4}" rx="8.5" ry="6.5" fill="${fill}"/></g>`;
}
function scarf(id, tail = true) {
  return `<g filter="url(#${id}soft)"><path d="M30 84q30 13 60 0l1.5 7q-31.5 14-63 0z" fill="url(#${id}sc)"/>${tail ? `<path d="M76 88l9 18q-6 3-11 1l-5-16z" fill="url(#${id}sc)"/><path d="M76.5 92l7 13" stroke="#fff" stroke-opacity=".25" stroke-width="1.4"/>` : ''}<path d="M33 86q27 11 54 0" stroke="#fff" stroke-opacity=".32" stroke-width="1.4" fill="none"/></g>`;
}
function wrap(id, mood, size, cls, inner) {
  return `<svg class="mascot m-${mood} ${cls}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">${inner}</svg>`;
}
/* A: 奶糖 — 奶油色小猫 + 靛蓝围巾 */
function cat(mood = 'normal', size = 120, cls = '') {
  const id = 'mc' + (++_u); const c = { f0: '#FFFDF8', f1: '#FBEBD6', f2: '#E9C9A2', s0: '#7472F0', s1: '#4B49C8', shadow: '#5A3A1A' };
  return wrap(id, mood, size, cls, defs(id, c) + `
  <ellipse cx="60" cy="112" rx="30" ry="4.5" fill="url(#${id}sh)"/>
  <g class="m-body">
   <path d="M86 100q20 2 18-16q-1-6-5-4q2 12-13 13z" fill="#EBCDA8"/>
   <ellipse cx="60" cy="98" rx="27" ry="15" fill="url(#${id}fur)"/>
   ${mood === 'cheer' || mood === 'encourage' ? '' : paws(mood, '#FFF8EE')}
   <g class="m-head">
    <path d="M24 46L26 16q1-6 6-3l22 16z" fill="url(#${id}fur)" stroke="#F3DDC0" stroke-width="3" stroke-linejoin="round"/><path d="M96 46L94 16q-1-6-6-3L66 29z" fill="url(#${id}fur)" stroke="#F3DDC0" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 36l1.5-15 12 9z" fill="#FFB3C1" opacity=".75"/><path d="M90 36l-1.5-15-12 9z" fill="#FFB3C1" opacity=".75"/>
    <ellipse cx="60" cy="58" rx="41" ry="34" fill="url(#${id}fur)"/>
    <path d="M54 26q1 6 0 9M60 25v10M66 26q-1 6 0 9" stroke="#E2B98A" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="44" cy="37" rx="15" ry="8" fill="url(#${id}spec)" opacity=".8"/>
    <ellipse cx="60" cy="74" rx="14" ry="9.5" fill="#FFFFFF" opacity=".75"/>
    <ellipse cx="33" cy="70" rx="6.5" ry="4" fill="#FF9CB0" opacity=".45"/><ellipse cx="87" cy="70" rx="6.5" ry="4" fill="#FF9CB0" opacity=".45"/>
    <path d="M57.6 69.5h4.8q1.4 0 .6 1.2l-2 2.3q-1 1-2 0l-2-2.3q-.8-1.2.6-1.2z" fill="#F07D93"/>
    <path d="M20 66l-9-1.5M20 71l-8 2M100 66l9-1.5M100 71l8 2" stroke="#D8B48E" stroke-width="1.4" stroke-linecap="round"/>
    ${face(mood, { id, ex: 43, ey: 60, gap: 34, er: 6.8, mx: 60, my: 76 })}
   </g>
   ${scarf(id)}
   ${mood === 'cheer' ? `<g class="m-arms"><ellipse cx="17" cy="56" rx="7.5" ry="9.5" transform="rotate(-25 17 56)" fill="#FFF6EA" stroke="#EBCDA8" stroke-width="1.2"/><ellipse cx="103" cy="56" rx="7.5" ry="9.5" transform="rotate(25 103 56)" fill="#FFF6EA" stroke="#EBCDA8" stroke-width="1.2"/></g>` : mood === 'encourage' ? `<g class="m-arms"><ellipse cx="44" cy="99" rx="8.5" ry="6.5" fill="#FFF8EE" stroke="#EBCDA8" stroke-width="1"/><g class="m-wave"><ellipse cx="103" cy="58" rx="7.5" ry="9.5" transform="rotate(25 103 58)" fill="#FFF6EA" stroke="#EBCDA8" stroke-width="1.2"/></g></g>` : ''}
  </g>${extras(mood)}`);
}
  return { name: '奶糖', svg: cat };
})();
const Game = {
  g() {
    const m = S.meta || (S.meta = {});
    if (!m.game) m.game = { freezes: 1, frozen: [], extra: {}, best: 0, goal: 50, seen: null, cele: {}, lastLv: 0 };
    const g = m.game; g.frozen = g.frozen || []; g.extra = g.extra || {}; g.cele = g.cele || {};
    return g;
  },
  persist() { DB.set('meta', S.meta); },
  /* ---- XP ---- */
  RULES: [['专注', '1 XP / 分钟'], ['卡片复习', '2 XP / 张'], ['错题复习', '3 XP / 题'], ['完成计划', '5 XP / 项'], ['考试交卷', '20 + 得分率 × 30'], ['题库练习', '答对 3 · 答错 1']],
  examXp(e) { const t = examTotals(e); return 20 + Math.round((t.max ? t.score / t.max : 0) * 30); },
  xpByDay() {
    const m = {}; const add = (t, n) => { if (!t || !n) return; const k = dayKey(t); m[k] = (m[k] || 0) + n; };
    S.sessions.forEach(s => add(s.end, s.minutes));
    S.reviews.forEach(r => add(r.t, r.kind === 'wrong' ? 3 : 2));
    S.todos.forEach(t => t.done && add(t.doneAt, 5));
    S.exams.forEach(e => e.status === 'graded' && add(e.submittedAt, this.examXp(e)));
    Object.entries(this.g().extra).forEach(([k, n]) => { m[k] = (m[k] || 0) + n; });
    return m;
  },
  total() { return Object.values(this.xpByDay()).reduce((a, b) => a + b, 0); },
  today() { return this.xpByDay()[dayKey()] || 0; },
  goal() { return this.g().goal || 50; },
  addExtra(n) { const g = this.g(); const k = dayKey(); g.extra[k] = (g.extra[k] || 0) + n; this.persist(); },
  need(L) { return 25 * L * (L - 1); },
  level(xp = this.total()) {
    let L = 1; while (xp >= this.need(L + 1)) L++;
    const lo = this.need(L), hi = this.need(L + 1);
    return { lv: L, xp, cur: xp - lo, span: hi - lo, left: hi - xp, pct: (xp - lo) / (hi - lo), title: LV_TITLES[Math.min(LV_TITLES.length - 1, Math.floor((L - 1) / 2))] };
  },
  /* ---- 连胜与冻结卡 ---- */
  streak() { return Stats.streak(); },
  checkFreeze() {
    const g = this.g(); if (g.lastCheck === dayKey()) return; g.lastCheck = dayKey();
    const set = Stats.activeDays(); const t = startOfDay(); const y = dayKey(t - DAY);
    if (!set.has(y) && set.has(dayKey(t - 2 * DAY)) && g.freezes > 0) {
      g.frozen.push(y); g.freezes--; this._froze = true;
      setTimeout(() => this.bubble('昨天没有学习，已自动使用 1 张冻结卡保住连胜', 'ice', 3600), 900);
    }
    this.persist();
  },
  earnFreeze() {
    const g = this.g(); const n = this.streak();
    if (n > 0 && n % 7 === 0 && g.lastEarn !== dayKey() && this.studiedToday()) {
      g.lastEarn = dayKey(); if (g.freezes < 2) { g.freezes++; this.persist(); return true; }
    }
    return false;
  },
  studiedToday() { return Stats.activeDays().has(dayKey()); },
  week() { // 本周（周一起）七天状态
    const set = Stats.activeDays(); const fz = new Set(this.g().frozen); const t = startOfDay(); const wd = (new Date(t).getDay() + 6) % 7;
    return [...Array(7)].map((_, i) => { const d = t + (i - wd) * DAY; const k = dayKey(d); return { k, lab: '一二三四五六日'[i], on: set.has(k) && !fz.has(k), fz: fz.has(k), today: d === t, future: d > t }; });
  },
  /* ---- 成就 ---- */
  badges() {
    const min = S.sessions.reduce((a, s) => a + s.minutes, 0);
    const pomos = S.sessions.filter(s => !s.partial && s.minutes >= 15).length;
    const best = Stats.bestStreak(); const revs = S.reviews.filter(r => r.kind !== 'wrong').length;
    const graded = S.exams.filter(e => e.status === 'graded');
    const top = Math.max(0, ...graded.map(e => { const t = examTotals(e); return t.max ? Math.round(t.score / t.max * 100) : 0; }));
    const mastered = S.wrongs.filter(w => w.mastered).length;
    const bankN = S.banks ? S.banks.reduce((a, b) => a + Object.values(b.stats || {}).reduce((x, s) => x + (s.n || 0), 0), 0) : 0;
    const hrs = S.sessions.map(s => new Date(s.start).getHours());
    const early = hrs.some(h => h >= 5 && h < 7) ? 1 : 0, owl = hrs.some(h => h >= 23 || h < 2) ? 1 : 0;
    // 奖章外观：sh 轮廓 · m 金属 · e 珐琅色 · n 浮雕数字（无则用图标）
    const B = (id, name, desc, ic, c, v, max, sh, m, n = '') => ({ id, name, desc, ic, c, v: Math.min(v, max), max, got: v >= max, sh, m, e: c, n });
    return [
      B('first', '第一步', '完成第一次专注', 'sparkle', '#30D158', S.sessions.length, 1, 'circle', 'silver'),
      B('pomo10', '十个番茄', '完成 10 个番茄', 'tomato', '#FF375F', pomos, 10, 'hex', 'silver', '10'),
      B('pomo100', '百个番茄', '完成 100 个番茄', 'tomato', '#FF375F', pomos, 100, 'hex', 'gold', '100'),
      B('h10', '十小时专注', '累计专注 10 小时', 'clock', '#0A84FF', Math.floor(min / 60), 10, 'circle', 'silver', '10h'),
      B('h50', '心流大师', '累计专注 50 小时', 'focus', '#BF5AF2', Math.floor(min / 60), 50, 'octa', 'gold', '50h'),
      B('s3', '三日连续', '连续学习 3 天', 'flame', '#FF9F0A', best, 3, 'shield', 'bronze', '3'),
      B('s7', '一周不断', '连续学习 7 天', 'flame', '#FF9F0A', best, 7, 'shield', 'silver', '7'),
      B('s30', '月度坚持', '连续学习 30 天', 'trophy', '#FF9F0A', best, 30, 'shield', 'gold', '30'),
      B('r100', '百张复习', '复习 100 张卡片', 'cards', '#30D158', revs, 100, 'squircle', 'silver', '100'),
      B('r1000', '过目不忘', '复习 1000 张卡片', 'layers', '#30D158', revs, 1000, 'squircle', 'gold', '1K'),
      B('exam1', '初次应考', '完成第一次考试', 'exam', '#5E5CE6', graded.length, 1, 'circle', 'bronze'),
      B('exam90', '高分选手', '考试得分率达到 90%', 'cap', '#5E5CE6', top, 90, 'octa', 'gold', '90'),
      B('wrong10', '错题克星', '掌握 10 道错题', 'wrong', '#FF6482', mastered, 10, 'hex', 'silver'),
      B('note5', '笔记五篇', '写下 5 篇笔记', 'notes', '#FFB340', S.notes.length, 5, 'squircle', 'bronze', '5'),
      B('bank50', '刷题能手', '在题库中作答 50 次', 'target', '#40C8E0', bankN, 50, 'hex', 'bronze', '50'),
      B('early', '清晨专注', '早上 5–7 点开始专注', 'bell', '#FFB340', early, 1, 'circle', 'gold'),
      B('owl', '深夜专注', '深夜 23 点后还在专注', 'clock', '#7D7AFF', owl, 1, 'circle', 'silver'),
      B('combo10', '完美连击', '一次连对 10 题/卡', 'flame', '#FF375F', this.g().best || 0, 10, 'octa', 'silver', '10')
    ];
  },
  /* ---- 初始化 & 结算 ---- */
  init() {
    const g = this.g();
    if (!g.seen) { g.seen = {}; this.badges().forEach(b => { if (b.got) g.seen[b.id] = 1; }); }
    if (!g.lastLv) g.lastLv = this.level().lv;
    if (this.today() >= this.goal()) g.cele[dayKey()] = 1;
    this.persist(); this.checkFreeze();
    document.addEventListener('pointerdown', e => { if (e.target.closest('.btn,.rate button,.check,.icon-btn')) this.buzz(); }, { passive: true });
  },
  /** 学习动作之后调用：检查达标 / 升级 / 新徽章 / 冻结卡；extra 为本次庆祝的基础内容 */
  after(base = null) {
    const g = this.g(); const notes = [];
    const lv = this.level(); if (lv.lv > (g.lastLv || 1)) { notes.push({ ic: 'trophy', c: '#FFC21A', t: `升级到 Lv ${lv.lv} · ${lv.title}` }); g.lastLv = lv.lv; }
    if (!g.cele[dayKey()] && this.today() >= this.goal()) { g.cele[dayKey()] = 1; notes.push({ ic: 'target', c: '#3DBE5C', t: `今日目标 ${this.goal()} XP 达成！` }); }
    const nb = this.badges().filter(b => b.got && !g.seen[b.id]); nb.forEach(b => { g.seen[b.id] = Date.now(); notes.push({ ic: b.ic, c: b.c, t: `获得奖章「${b.name}」`, badge: b }); });
    if (this.earnFreeze()) notes.push({ ic: 'snow', c: '#64D2FF', t: `连续 ${this.streak()} 天，获得 1 张冻结卡` });
    this.persist();
    const nbMedal = nb[0] || null; const lvUp = notes.find(n => n.t.startsWith('升级')); const goalHit = notes.find(n => n.t.includes('达成'));
    if (base) { base.notes = (base.notes || []).concat(notes); if (nbMedal) { base.medal = nbMedal; base.kicker = '获得新奖章'; } this.celebrate(base); }
    else if (notes.length) this.celebrate({
      kicker: nbMedal ? '获得新奖章' : lvUp ? '等级提升' : goalHit ? '今日目标' : '新进展',
      title: nbMedal ? nbMedal.name : lvUp ? `Lv ${lv.lv} · ${lv.title}` : goalHit ? '今日目标已达成' : notes[0].t,
      sub: nbMedal ? nbMedal.desc : goalHit ? `今天已获得 ${this.today()} XP，保持这个节奏。` : '保持这个节奏。',
      medal: nbMedal || (lvUp ? this.lvMedal(lv.lv) : null), hero: !nbMedal && !lvUp && goalHit ? 'rings' : null,
      notes: notes.filter(n => !(nbMedal && n.badge === nbMedal)), stats: [{ l: '今日经验', v: this.today(), u: 'XP', c: 'var(--c-xp)' }, { l: '连续学习', v: this.streak(), u: '天', c: 'var(--c-streak)' }] });
  },
  /* ---- 吉祥物 ---- */
  mood() {
    const h = new Date().getHours(); const t = this.today(), goal = this.goal();
    if (t >= goal) return 'happy';
    if (h >= 23 || h < 5) return 'sleepy';
    return t > 0 ? 'normal' : 'normal';
  },
  line() {
    const h = new Date().getHours(); const t = this.today(), goal = this.goal(); const pick = a => a[(new Date().getDate() + h) % a.length];
    if (t >= goal) return pick(MASCOT_LINES.done);
    if (t >= goal * 0.7) return pick(MASCOT_LINES.close);
    if (h >= 22 || h < 5) return pick(MASCOT_LINES.night);
    if (h < 10) return pick(MASCOT_LINES.morning);
    return pick(MASCOT_LINES.normal);
  },
  mascot(mood = 'normal', size = 96, cls = '') { const m = { sad: 'encourage', cheering: 'cheer', encouraging: 'encourage' }[mood] || mood; return MASCOT.svg(['normal', 'happy', 'cheer', 'encourage', 'sleepy'].includes(m) ? m : 'normal', size, cls); },
  /* ---- 反馈（v5：毛玻璃提示 + 奶糖） ---- */
  buzz(ms = 8) { try { if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(ms); } catch (e) { } },
  _combo: 0,
  combo(ok) {
    if (!ok) { this._combo = 0; $('#combo')?.remove(); return 0; }
    const n = ++this._combo; const g = this.g(); if (n > (g.best || 0)) { g.best = n; this.persist(); }
    if (n >= 2) {
      let el = $('#combo'); if (!el) { el = document.createElement('div'); el.id = 'combo'; el.className = 'combo'; document.body.appendChild(el); }
      const msg = MASCOT_LINES.combo[n] || ''; el.innerHTML = `<span class="cb-ic">${icon('flame', 15)}</span><b>连续答对 <span class="num">${n}</span></b>${msg ? `<span class="cb-m">${msg}</span>` : ''}`;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (n >= 3) this.buzz(12);
      clearTimeout(this._ct); this._ct = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2000);
    }
    return n;
  },
  resetCombo() { this._combo = 0; },
  encourage(text) { this.bubble((text || MASCOT_LINES.encourage[Math.floor(Math.random() * MASCOT_LINES.encourage.length)]).replace(/\s*[💪📒]/gu, ''), 'sad'); },
  bubble(text, kind = 'happy', ms = 2600) {
    $('#mbub')?.remove(); const el = document.createElement('div'); el.id = 'mbub'; el.className = 'mbub';
    const K = { sad: ['repeat', 'var(--c-wrong)'], ice: ['snow', 'var(--c-ice)'], xp: ['sparkle', 'var(--c-xp)'], happy: ['sparkle', 'var(--c-xp)'] }[kind] || ['sparkle', 'var(--c-xp)'];
    const pal = kind === 'sad' ? 'encourage' : kind === 'happy' ? 'happy' : kind === 'ice' ? 'normal' : '';
    el.innerHTML = `${pal ? `<span class="mb-pal">${this.mascot(pal, 40)}</span>` : `<span class="mb-ic" style="--c:${K[1]}">${icon(K[0], 16)}</span>`}<div class="mb-t">${esc(text)}</div>`; document.body.appendChild(el);
    el.onclick = () => el.remove(); setTimeout(() => el.classList.add('out'), ms); setTimeout(() => el.remove(), ms + 400);
  },
  xpPop(n, label = '') { if (!n) return; this.bubble(`+${n} XP ${label}`.trim(), 'xp', 1800); },
  /* ---- 奖章（金属质感 SVG） ---- */
  _mid: 0,
  METALS: {
    gold: ['#FFF6D5', '#F4CD5C', '#B98A2E', '#FBE6A6', '#8F6418'],
    silver: ['#FFFFFF', '#DCE0E6', '#8D939B', '#EEF0F3', '#6E747C'],
    bronze: ['#FFE3CC', '#DB9A62', '#8E5428', '#F2C5A0', '#6F3E1A']
  },
  SHAPES: {
    circle: '<circle cx="50" cy="50" r="44"/>',
    hex: '<path d="M50 6 88 28v44L50 94 12 72V28z"/>',
    octa: '<path d="M32 7h36l25 25v36L68 93H32L7 68V32z"/>',
    shield: '<path d="M50 5 89 17v31c0 25-16 40-39 47C27 88 11 73 11 48V17z"/>',
    squircle: '<rect x="7" y="7" width="86" height="86" rx="27"/>'
  },
  lvMedal(L) { return { sh: 'hex', m: 'gold', e: '#5E5CE6', n: String(L), ic: 'trophy', got: true, name: `Lv ${L}` }; },
  medal(b, size = 72, cls = '') {
    const id = 'md' + (++this._mid); const locked = !b.got; const M = this.METALS[b.m] || this.METALS.silver; const S0 = this.SHAPES[b.sh] || this.SHAPES.circle;
    const shape = (fill, extra = '') => S0.replace('/>', ` fill="${fill}" ${extra}/>`);
    const e = b.e || '#5E5CE6'; const n = b.n || '';
    const rim = locked ? ['var(--lk1)', 'var(--lk2)', 'var(--lk3)', 'var(--lk2)', 'var(--lk3)'] : M;
    const face = locked ? ['var(--lk4)', 'var(--lk5)'] : [`color-mix(in srgb,${e} 62%,#fff)`, e, `color-mix(in srgb,${e} 55%,#000)`];
    const glyph = n
      ? `<text x="50" y="${n.length > 2 ? 57.5 : 59}" text-anchor="middle" font-size="${n.length > 3 ? 19 : n.length > 2 ? 22 : 27}" font-weight="800" class="md-num" fill="${locked ? 'var(--lk6)' : '#fff'}" ${locked ? '' : `filter="url(#${id}e)"`}>${esc(n)}</text>`
      : icon(b.ic || 'sparkle', 36).replace('<svg class="i ', `<svg x="32" y="32" ${locked ? 'style="color:var(--lk6)"' : `style="color:#fff" filter="url(#${id}e)"`} class="i md-g `).replace('stroke-width="1.8"', 'stroke-width="2.3"');
    return `<svg class="medal-svg ${locked ? 'locked' : ''} ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><defs>
      <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1">${rim.map((c, i) => `<stop offset="${[0, .28, .55, .78, 1][i]}" style="stop-color:${c}"/>`).join('')}</linearGradient>
      <linearGradient id="${id}r2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:${rim[0]}"/><stop offset=".5" style="stop-color:${rim[2]}"/><stop offset="1" style="stop-color:${rim[4]}"/></linearGradient>
      <radialGradient id="${id}f" cx=".35" cy=".28" r=".85">${locked ? `<stop offset="0" style="stop-color:${face[0]}"/><stop offset="1" style="stop-color:${face[1]}"/>` : `<stop offset="0" style="stop-color:${face[0]}"/><stop offset=".55" style="stop-color:${face[1]}"/><stop offset="1" style="stop-color:${face[2]}"/>`}</radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c">${S0}</clipPath>
      <filter id="${id}e" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.2" stdDeviation=".6" flood-color="#000" flood-opacity=".38"/><feDropShadow dx="0" dy="-.5" stdDeviation=".2" flood-color="#fff" flood-opacity=".35"/></filter></defs>
      ${shape(`url(#${id}r)`, `stroke="url(#${id}r)" stroke-width="6" stroke-linejoin="round"`)}
      <g transform="translate(50 50) scale(.8) translate(-50 -50)">${shape(`url(#${id}r2)`, `stroke="url(#${id}r2)" stroke-width="4" stroke-linejoin="round"`)}</g>
      <g transform="translate(50 50) scale(.72) translate(-50 -50)">${shape(`url(#${id}f)`, 'stroke-linejoin="round"')}</g>
      ${locked ? '' : `<g clip-path="url(#${id}c)"><ellipse cx="34" cy="20" rx="44" ry="24" fill="url(#${id}s)"/></g>`}
      ${glyph}</svg>`;
  },
  /* ---- 活动圆环（Fitness 风格同心圆环，超额会叠圈） ---- */
  rings(items, size = 132) {
    const w = size * .118, gap = size * .014, cx = size / 2; let out = '';
    items.forEach((it, i) => {
      const r = cx - w / 2 - i * (w + gap); const C = 2 * Math.PI * r; const p = Math.max(0, it.p || 0);
      out += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" style="stroke:${it.c};opacity:.22" stroke-width="${w}"/>`;
      if (p > 0) {
        const f = Math.min(p, 1);
        out += `<circle class="rg-a" cx="${cx}" cy="${cx}" r="${r}" fill="none" style="stroke:${it.c};--L:${(C * f).toFixed(2)}px;--C:${C.toFixed(2)}px;animation-delay:${i * 90}ms" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
        if (p > 1) {
          const f2 = Math.min(p - 1, .98); const a = (f2 * 360 - 90) * Math.PI / 180;
          out += `<circle class="rg-a" cx="${cx}" cy="${cx}" r="${r}" fill="none" style="stroke:${it.c};filter:brightness(1.12);--L:${(C * f2).toFixed(2)}px;--C:${C.toFixed(2)}px;animation-delay:${i * 90 + 500}ms" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C * f2).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
          out += `<circle class="rg-tip" cx="${(cx + r * Math.cos(a)).toFixed(2)}" cy="${(cx + r * Math.sin(a)).toFixed(2)}" r="${w / 2}" style="fill:${it.c}"/>`;
        }
      }
      const ay = cx - r; out += `<path d="M${cx - w * .16} ${ay - w * .22}l${w * .26} ${w * .22}l-${w * .26} ${w * .22}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="${w * .14}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    return `<svg class="act-rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${out}</svg>`;
  },
  ringItems() {
    const tm = Focus.todayMinutes(), fg = S.settings.pomo.dailyGoal || 120, rv = Stats.reviewsSince(startOfDay()), xp = this.today(), xg = this.goal();
    return [
      { k: '专注', v: tm, g: fg, u: '分钟', c: 'var(--c-focus)', p: tm / fg },
      { k: '复习', v: rv, g: 20, u: '张', c: 'var(--c-cards)', p: rv / 20 },
      { k: '经验', v: xp, g: xg, u: 'XP', c: 'var(--c-xp)', p: xp / xg }
    ];
  },
  /* ---- 健康 App 风格「亮点」洞察 ---- */
  insights() {
    const out = []; const t0 = startOfDay(); const days = n => [...Array(n)].map((_, i) => t0 - (n - 1 - i) * DAY);
    const fm = Stats.focusByDay(); const d14 = days(14).map(t => fm[dayKey(t)] || 0); const cur = d14.slice(7), prev = d14.slice(0, 7);
    const sum = a => a.reduce((x, y) => x + y, 0); const avg = Math.round(sum(cur) / 7), pAvg = Math.round(sum(prev) / 7);
    const lab = days(7).map(t => WEEK[new Date(t).getDay()]);
    if (sum(cur) > 0) {
      const d = avg - pAvg; const cmp = pAvg ? (d > 0 ? `，比前一周多 ${fmtMin(d)}` : d < 0 ? `，比前一周少 ${fmtMin(-d)}` : '，与前一周持平') : '';
      out.push({ ic: 'focus', c: 'var(--c-focus)', cat: '专注时长', when: '近 7 天', href: '#/me/stats', text: `过去 7 天，你平均每天专注 ${fmtMin(avg)}${cmp}。`, chart: { vals: cur, labels: lab, avg, avgLabel: '日均', unit: '分钟' } });
    }
    const rm = {}; S.reviews.forEach(r => { if (r.kind !== 'wrong' && r.t >= t0 - 6 * DAY) { const k = dayKey(r.t); rm[k] = (rm[k] || 0) + 1; } });
    const rv = days(7).map(t => rm[dayKey(t)] || 0); const rs = S.reviews.filter(r => r.kind !== 'wrong' && r.t >= t0 - 6 * DAY);
    if (rs.length) {
      const pct = Math.round(rs.filter(r => r.r >= 3).length / rs.length * 100);
      out.push({ ic: 'cards', c: 'var(--c-cards)', cat: '卡片复习', when: '本周', href: '#/learn/decks', text: `本周复习了 ${rs.length} 张卡片，记住率 ${pct}%${pct >= 85 ? '，记忆很稳。' : '。'}`, chart: { vals: rv, labels: lab, avg: Math.round(rs.length / 7), avgLabel: '日均', unit: '张' } });
    }
    const sk = this.streak(), best = Stats.bestStreak();
    if (sk >= 2) out.push({ ic: 'flame', c: 'var(--c-streak)', cat: '连续学习', when: '今天', href: '#/me/achievements', text: `你已连续学习 ${sk} 天${sk >= best ? '，这是你的最长纪录。' : `，距离最长纪录 ${best} 天还差 ${best - sk} 天。`}`, week: this.week() });
    const ex = S.exams.filter(e => e.status === 'graded').sort((a, b) => a.submittedAt - b.submittedAt).slice(-6);
    if (ex.length) {
      const ps = ex.map(e => { const t = examTotals(e); return t.max ? Math.round(t.score / t.max * 100) : 0; }); const l = ps[ps.length - 1], p = ps[ps.length - 2];
      out.push({ ic: 'exam', c: 'var(--c-exam)', cat: '考试成绩', when: '最近', href: '#/learn/exam-history', text: `最近一次考试得分率 ${l}%${p !== undefined ? (l > p ? `，比上一次提高 ${l - p}%。` : l < p ? `，比上一次低 ${p - l}%，看看错题吧。` : '，与上一次持平。') : '。'}`, chart: { vals: ps, labels: ps.map((_, i) => i === ps.length - 1 ? '最近' : ''), avg: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length), avgLabel: '平均', unit: '%' } });
    }
    return out;
  },
  /* ---- 庆祝：Apple 风格奖章揭晓（克制的光点，无彩纸） ---- */
  _q: [],
  celebrate(o) {
    if ($('#cele')) { this._q.push(o); return; }
    const el = document.createElement('div'); el.id = 'cele'; el.className = 'cele'; el.setAttribute('role', 'dialog');
    const lv = this.level();
    const hero = o.hero === 'rings' ? `<div class="cele-rings">${this.rings(this.ringItems(), 176)}</div>` : this.medal(o.medal || { sh: 'circle', m: 'silver', e: '#5E5CE6', ic: 'sparkle', got: true }, 176, 'cele-medal');
    el.innerHTML = `<canvas class="glints"></canvas><div class="cele-in">
      <div class="cele-hero"><div class="cele-glow" style="--g:${(o.medal && o.medal.e) || '#5E5CE6'}"></div>${hero}<div class="cele-pal">${this.mascot(o.mood === 'happy' ? 'happy' : 'cheer', 78)}</div></div>
      ${o.kicker ? `<div class="cele-k">${esc(o.kicker)}</div>` : ''}
      <h1 class="cele-t">${esc((o.title || '完成').replace(/！$/, ''))}</h1>${o.sub ? `<p class="cele-s">${esc(o.sub)}</p>` : ''}
      ${o.stats?.length ? `<div class="cele-stats">${o.stats.map((s, i) => `<div class="cs" style="--c:${s.c};--d:${i * 90 + 600}ms"><div class="cs-h">${esc(s.l)}</div><div class="cs-v">${s.v}${s.u ? `<small>${esc(s.u)}</small>` : ''}</div></div>`).join('')}</div>` : ''}
      ${o.notes?.length ? `<div class="cele-notes">${(o.notes.length > 4 ? [...o.notes.slice(0, 3), { ic: 'trophy', c: '#FF9F0A', t: `以及另外 ${o.notes.length - 3} 项成就` }] : o.notes).map(n => `<div class="cn"><span class="cn-ic" style="--c:${n.c}">${icon(n.ic, 16)}</span><span>${esc(n.t)}</span></div>`).join('')}</div>` : ''}
      <div class="cele-lv"><div class="lv-row"><span>Lv ${lv.lv} · ${lv.title}</span><span class="num">${lv.cur}/${lv.span} XP</span></div><div class="xpbar"><i style="width:${Math.round(lv.pct * 100)}%"></i></div></div>
      </div><div class="cele-foot"><button class="btn big" id="celeOk">完成</button></div>`;
    document.body.appendChild(el); this.buzz(20);
    requestAnimationFrame(() => el.classList.add('on')); this.glints($('canvas', el));
    const close = () => { el.classList.remove('on'); el.classList.add('off'); setTimeout(() => { el.remove(); const n = this._q.shift(); if (n) this.celebrate(n); }, 260); };
    $('#celeOk', el).onclick = close;
    const onNav = () => { if (!el.isConnected || el.classList.contains('off')) return; this._q = []; close(); }; addEventListener('hashchange', onNav, { once: true });
  },
  glints(cv) {
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(2, devicePixelRatio || 1); const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
    const cx = W / 2, cy = Math.min(H * .3, 250);
    const P = [...Array(34)].map(() => { const a = Math.random() * Math.PI * 2, s = .25 + Math.random() * .7; return { x: cx + Math.cos(a) * 40, y: cy + Math.sin(a) * 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .12, r: .6 + Math.random() * 1.6, d: Math.random() * 600, l: 1600 + Math.random() * 1400, c: Math.random() < .35 ? '255,214,140' : '255,255,255' }; });
    const t0 = performance.now();
    const step = now => {
      const t = now - t0; x.clearRect(0, 0, W, H); let alive = 0;
      P.forEach(p => { const k = (t - p.d) / p.l; if (k < 0 || k > 1) return; alive++; p.x += p.vx; p.y += p.vy; const a = Math.sin(k * Math.PI) * (.55 + .45 * Math.sin(t / 90 + p.d)); x.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); if (p.r > 1.6) { x.fillRect(p.x - p.r * 2.4, p.y - .3, p.r * 4.8, .6); x.fillRect(p.x - .3, p.y - p.r * 2.4, .6, p.r * 4.8); } });
      if ((alive || t < 700) && t < 3600 && cv.isConnected) requestAnimationFrame(step); else x.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(step);
  },
  confetti(cv) { this.glints(cv); },
  /* ---- 场景化庆祝 ---- */
  focusDone(min) {
    this.resetCombo();
    this.after({ kicker: '专注完成', title: `${min} 分钟深度专注`, sub: '专注时间已计入今日活动圆环。', medal: { sh: 'circle', m: 'silver', e: '#FF375F', ic: 'tomato', got: true }, stats: [{ l: '经验', v: `+${min}`, u: 'XP', c: 'var(--c-xp)' }, { l: '专注', v: min, u: '分钟', c: 'var(--c-focus)' }, { l: '连续', v: this.streak(), u: '天', c: 'var(--c-streak)' }] });
  },
  reviewDone(n, ok, mins) {
    if (!n) return; this.resetCombo(); const pct = Math.round(ok / n * 100);
    this.after({ kicker: '复习完成', title: `复习了 ${n} 张卡片`, sub: pct >= 80 ? '记得又快又准，记忆很稳。' : '每复习一次，记忆就更牢一分。', medal: { sh: 'squircle', m: 'silver', e: '#30D158', ic: 'cards', got: true }, stats: [{ l: '经验', v: `+${n * 2}`, u: 'XP', c: 'var(--c-xp)' }, { l: '用时', v: Math.max(1, mins), u: '分钟', c: 'var(--c-focus)' }, { l: '记住率', v: pct, u: '%', c: 'var(--c-cards)' }] });
  },
  examDone(e) {
    const t = examTotals(e); const pct = t.max ? Math.round(t.score / t.max * 100) : 0;
    this.after({ kicker: '交卷完成', title: pct >= 90 ? '高分通过' : pct >= 60 ? '考试完成' : '完成就是进步', sub: pct >= 60 ? '看看错题，把分数再往上推一推。' : '错题已经记入错题本，下次会更好。', medal: { sh: 'octa', m: pct >= 90 ? 'gold' : pct >= 60 ? 'silver' : 'bronze', e: '#5E5CE6', n: String(pct), got: true }, stats: [{ l: '经验', v: `+${this.examXp(e)}`, u: 'XP', c: 'var(--c-xp)' }, { l: '得分', v: `${t.score}/${t.max}`, c: 'var(--c-exam)' }, { l: '得分率', v: pct, u: '%', c: pct >= 60 ? 'var(--c-cards)' : 'var(--c-wrong)' }] });
  },
  practiceDone(n, ok, xp, title = '本轮完成') {
    if (!n) return; this.resetCombo(); const pct = Math.round(ok / n * 100);
    this.after({ kicker: '练习完成', title: title.replace(/！$/, ''), sub: pct >= 80 ? '正确率很高，继续保持。' : '错的题已经帮你记下了。', medal: { sh: 'hex', m: 'silver', e: '#40C8E0', ic: 'target', got: true }, stats: [{ l: '经验', v: `+${xp}`, u: 'XP', c: 'var(--c-xp)' }, { l: '题数', v: n, u: '题', c: 'var(--c-focus)' }, { l: '正确率', v: pct, u: '%', c: 'var(--c-cards)' }] });
  },
  doneIcon(c = 'var(--c-cards)') { return `<div class="done-ic" style="--c:${c}">${icon('check', 34)}</div>`; }
};

/* ---- 迷你图表：Screen Time / 健康 风格（细柱 + 平均虚线） ---- */
function stChart(vals, labels, { color = 'var(--pri)', avg = null, avgLabel = '平均', unit = '', h = 120, hi = vals.length - 1, axis = true, fmt = v => v } = {}) {
  const max = Math.max(1, ...vals, avg || 0) * 1.04;
  const nice = axis ? (() => { const e = Math.pow(10, Math.floor(Math.log10(max))); return [1, 2, 3, 4, 5, 6, 8, 10].map(m => m * e).find(x => x >= max) || 10 * e; })() : max;
  const ap = avg ? avg / nice * 100 : -99; const gl = [100, 50, 0].filter(b => Math.abs(b - ap) > 13);
  return `<div class="stc ${axis ? 'ax' : ''} ${vals.length > 14 ? 'dense' : ''}" style="--c:${color};--h:${h}px"><div class="stc-plot">
    ${axis ? `<div class="stc-grid">${[100, 50, 0].map(b => `<i style="bottom:${b}%">${gl.includes(b) ? `<span>${fmt(Math.round(nice * b / 100))}</span>` : ''}</i>`).join('')}</div>` : ''}
    <div class="stc-bars">${vals.map((v, i) => `<div class="stc-b ${i === hi ? 'hi' : ''}"><i style="height:${v ? Math.max(3, v / nice * 100) : 0}%"></i></div>`).join('')}</div>
    ${avg ? `<div class="stc-avg" style="bottom:${avg / nice * 100}%"><span>${esc(avgLabel)}</span></div>` : ''}
  </div><div class="stc-x">${labels.map((l, i) => `<span class="${i === hi ? 'hi' : ''}">${esc(l)}</span>`).join('')}</div></div>`;
}
function weekDots(wk) { return `<div class="wkd">${wk.map(w => `<div class="wkd-d ${w.on ? 'on' : ''} ${w.fz ? 'fz' : ''} ${w.today ? 'today' : ''} ${w.future ? 'fut' : ''}"><span>${w.lab}</span><i>${w.on ? icon('check', 13) : w.fz ? icon('snow', 13) : ''}</i></div>`).join('')}</div>`; }
function secHead(t, link = '', linkText = '显示更多') { return `<div class="sec-h"><h2>${t}</h2>${link ? `<a href="${link}">${linkText}</a>` : ''}</div>`; }
function insightCard(x) {
  return `<a class="card hl" href="${x.href}" style="--c:${x.c}"><div class="hl-h"><span class="hl-cat">${icon(x.ic, 15)}${esc(x.cat)}</span><span class="hl-when">${esc(x.when)}<span class="chev">›</span></span></div><p class="hl-t">${esc(x.text)}</p>
    ${x.chart ? `<div class="hl-chart"><div class="hl-avg"><span>${esc(x.chart.avgLabel)}</span><b class="num">${x.chart.avg}<small>${esc(x.chart.unit)}</small></b></div>${stChart(x.chart.vals, x.chart.labels, { color: x.c, avg: x.chart.avg, avgLabel: '', h: 84, axis: false })}</div>` : x.week ? weekDots(x.week) : ''}</a>`;
}

/* ---- 奖章与等级页 ---- */
route('/me/achievements', 'me', v => {
  setTop('奖章', { back: '#/me' });
  const g = Game.g(); const lv = Game.level(); const bs = Game.badges(); const got = bs.filter(b => b.got); const st = Game.streak(); const best = Stats.bestStreak();
  const map = Game.xpByDay(); const goals = [[20, '轻松'], [50, '常规'], [100, '认真'], [150, '冲刺']];
  const near = bs.filter(b => !b.got).sort((a, b) => b.v / b.max - a.v / a.max).slice(0, 4);
  const xpVals = [...Array(7)].map((_, i) => map[dayKey(startOfDay() - (6 - i) * DAY)] || 0); const xpLab = [...Array(7)].map((_, i) => WEEK[new Date(startOfDay() - (6 - i) * DAY).getDay()]);
  const when = b => { const s = g.seen?.[b.id]; return s > 1 ? fmtDate(s) : '已获得'; };
  v.innerHTML = `<div class="card lv-hero">${Game.medal(Game.lvMedal(lv.lv), 76)}<div class="grow"><div class="eyebrow-g">等级</div><div class="lv-title">Lv ${lv.lv} · ${lv.title}</div><div class="xpbar"><i style="width:${Math.round(lv.pct * 100)}%"></i></div><div class="lv-sub"><span class="num">${lv.xp.toLocaleString()} XP</span><span>距 Lv ${lv.lv + 1} 还差 <b class="num">${lv.left}</b></span></div></div></div>
  ${secHead('连续学习')}
  <div class="card streak5"><div class="s5-top"><div><div class="s5-k">当前连续</div><div class="s5-v num" style="color:var(--c-streak)">${st}<small>天</small></div></div><div class="s5-best"><div class="s5-k">最长纪录</div><div class="s5-v sm num">${best}<small>天</small></div></div></div>${weekDots(Game.week())}
    <div class="s5-fz"><span class="ic-tile" style="--c:var(--c-ice)">${icon('snow', 17)}</span><div class="grow"><div class="t">冻结卡 <span class="num">${g.freezes || 0}</span>/2</div><div class="s">每连续学习 7 天获得 1 张。漏学一天会自动使用，保住连续天数。</div></div></div></div>
  ${secHead('每日目标')}
  <div class="card"><div class="seg goal-seg">${goals.map(([n, l]) => `<button class="${Game.goal() === n ? 'on' : ''}" data-goal="${n}">${l} <span class="num">${n}</span></button>`).join('')}</div>
    <div class="chart-h"><div><div class="s5-k">近 7 天日均</div><div class="ch-v num" style="color:var(--c-xp)">${Math.round(xpVals.reduce((a, b) => a + b, 0) / 7)}<small>XP</small></div></div><div class="s5-k r">今日 <b class="num">${Game.today()}</b> / ${Game.goal()} XP</div></div>
    ${stChart(xpVals, xpLab, { color: 'var(--c-xp)', avg: Game.goal(), avgLabel: '目标', h: 120 })}</div>
  ${near.length ? `${secHead('即将获得')}<div class="near">${near.map(b => `<button class="near-c" data-b="${b.id}" style="--c:${b.e}">${Game.medal(b, 58)}<div class="grow"><b>${b.name}</b><div class="s">${b.desc}</div><div class="bp"><i style="width:${Math.round(b.v / b.max * 100)}%"></i></div><div class="s num">${b.v} / ${b.max}</div></div></button>`).join('')}</div>` : ''}
  <div class="sec-h"><h2>奖章</h2><span class="sec-n">已获得 <span class="num">${got.length}</span> / ${bs.length}</span></div>
  <div class="card awards">${bs.slice().sort((a, b) => (b.got - a.got)).map(b => `<button class="award ${b.got ? 'got' : ''}" data-b="${b.id}">${Game.medal(b, 78)}<b>${b.name}</b><small class="${b.got ? '' : 'num'}">${b.got ? when(b) : `${b.v}/${b.max}`}</small></button>`).join('')}</div>
  ${secHead('经验值规则')}<div class="list">${Game.RULES.map(([a, b]) => `<div class="row"><div class="grow t">${a}</div><span class="muted num">${b}</span></div>`).join('')}</div>`;
  $$('[data-goal]', v).forEach(b => b.onclick = () => { g.goal = +b.dataset.goal; if (Game.today() < g.goal) delete g.cele[dayKey()]; Game.persist(); toast(`每日目标已设为 ${g.goal} XP`); rerender(); });
  $$('[data-b]', v).forEach(el => el.onclick = () => { const b = bs.find(x => x.id === el.dataset.b); openSheet(`<div class="award-sheet"><div class="as-m">${Game.medal(b, 188, 'spin-in')}</div><h2>${b.name}</h2><p class="muted">${b.desc}</p>${b.got ? `<p class="as-s">${g.seen?.[b.id] > 1 ? `获得于 ${fmtDate(g.seen[b.id])}` : '已获得'}</p>` : `<div class="as-p" style="--c:${b.e}"><div class="bp"><i style="width:${Math.round(b.v / b.max * 100)}%"></i></div><span class="num">${b.v} / ${b.max}</span></div>`}</div>`); });
});
