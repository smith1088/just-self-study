'use strict';
/* ========== 游戏化：经验值 / 等级 / 连胜冻结 / 奖章 / 庆祝（v5 · Apple 风格呈现；吉祥物代码保留但不在界面显示） ========== */
const LV_TITLES = ['萌新学徒', '求知新芽', '勤学小将', '学习新星', '知识探索者', '专注达人', '学霸预备', '学霸', '学术大佬', '学神'];
const MASCOT_LINES = {
  morning: ['早上好，先用一个番茄钟热热身吧。', '早起的你，记忆力正好。', '今天的第一件小事，我陪你完成。'],
  normal: ['今天学一点，明天就强一点。', '先完成一件小事，状态就来了。', '我在这儿陪你，慢慢来。', '把今日目标一点点点亮吧。'],
  close: ['只差一点就达成今日目标了。', '最后一小段，学姐帮你看着。'],
  done: ['今日目标达成，真的很棒。', '今天很扎实，记得好好休息。', '保持这个节奏，期末不慌。'],
  night: ['夜深了，复习几张卡就去睡吧。', '早点休息，记忆会在睡眠里巩固。'],
  encourage: ['没关系，这张已安排在稍后再次出现', '再看一眼解析，印象会更深', '失误是复习的一部分', '慢一点也没关系，继续', '已记下，下次会更熟练'],
  combo: { 3: '状态很好', 5: '势头正盛', 8: '非常专注', 10: '完美连击', 15: '无可挑剔' }
};
/* ---- 吉祥物「林遥学姐」：插画立绘（img/mascot/*.webp），5 种情绪：normal/happy/cheer/encourage/sleepy ---- */
const MASCOT = {
  name: '林遥学姐', short: '学姐',
  moods: ['normal', 'happy', 'cheer', 'encourage', 'sleepy', 'shy', 'pout', 'gaze', 'night', 'surprised', 'wink', 'proud'],
  alt: { normal: '林遥学姐抱着平板微笑', happy: '林遥学姐开心地挥手', cheer: '林遥学姐握拳为你欢呼', encourage: '林遥学姐竖起大拇指鼓励你', sleepy: '林遥学姐困倦地打哈欠', shy: '林遥学姐红着脸抱着平板', pout: '林遥学姐抱着胳膊鼓起脸', gaze: '林遥学姐托着下巴温柔地看着你', night: '林遥学姐裹着毯子捧着热饮', surprised: '林遥学姐惊讶地捂住嘴', wink: '林遥学姐竖起手指俏皮地眨眼', proud: '林遥学姐骄傲地举着 98 分的试卷', hoodie: '穿着居家卫衣的林遥学姐挥手说晚安' },
  /* 服装：img 里列出该服装有专门立绘的表情，其余表情沿用毛衣立绘 */
  outfits: {
    sweater: { name: '毛衣', img: {} },
    hoodie: { name: '居家卫衣', img: { normal: 'hoodie', happy: 'hoodie', cheer: 'hoodie', encourage: 'hoodie', sleepy: 'hoodie' } }
  },
  /* 节日服装钩子：以后放入图片并登记 outfits 后，在这里加 { from: '12-24', to: '12-26', outfit: 'xmas' } 即可自动生效 */
  holidays: [],
  pin: '', // 临时（如聊天里说「晚安」）
  outfit(d = new Date()) {
    const p = S.settings?.lin?.outfit; if (p && p !== 'auto' && this.outfits[p]) return p;
    if (this.pin && this.outfits[this.pin]) return this.pin;
    const md = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    const h = this.holidays.find(x => this.outfits[x.outfit] && (x.from <= x.to ? md >= x.from && md <= x.to : md >= x.from || md <= x.to)); if (h) return h.outfit;
    const hm = d.getHours() * 60 + d.getMinutes(); if (hm >= 22 * 60 + 30 || hm < 5 * 60) return 'hoodie';
    return 'sweater';
  },
  file(m) { const o = this.outfits[this.outfit()] || this.outfits.sweater; return o.img[m] || m; },
  altOf(m) { const f = this.file(m); return this.alt[f] || this.alt[m] || this.name; },
  src(m, face) { return `img/mascot/${this.file(m)}${face ? '-face' : ''}.webp`; }
};
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
      B('pomo10', '十个番茄', '完成 10 个番茄', 'tomato', '#E8678F', pomos, 10, 'hex', 'silver', '10'),
      B('pomo100', '百个番茄', '完成 100 个番茄', 'tomato', '#E8678F', pomos, 100, 'hex', 'gold', '100'),
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
    if (h >= 21 && t < goal * 0.3) return 'night';
    return t >= goal * 0.7 ? 'encourage' : 'normal';
  },
  line() {
    const h = new Date().getHours(); const t = this.today(), goal = this.goal(); const pick = a => a[(new Date().getDate() + h) % a.length];
    if (t >= goal) return pick(MASCOT_LINES.done);
    if (t >= goal * 0.7) return pick(MASCOT_LINES.close);
    if (h >= 22 || h < 5) return pick(MASCOT_LINES.night);
    if (h < 10) return pick(MASCOT_LINES.morning);
    return pick(MASCOT_LINES.normal);
  },
  /** 吉祥物：size ≤ 96 用圆形头像，否则用透明底半身立绘；opts.cut 强制立绘、opts.ring 头像描边 */
  mascot(mood = 'normal', size = 96, cls = '', opts = {}) {
    let m = { sad: 'encourage', cheering: 'cheer', encouraging: 'encourage' }[mood] || mood; if (!MASCOT.moods.includes(m)) m = 'normal';
    const face = !opts.cut && size <= 96; const alt = MASCOT.altOf(m);
    return face
      ? `<span class="pal-av m-${m} ${cls}" style="--s:${size}px"><img src="${MASCOT.src(m, true)}" alt="${alt}" width="${size}" height="${size}" decoding="async" loading="lazy" draggable="false"></span>`
      : `<span class="pal-cut m-${m} ${cls}" style="--s:${size}px"><img src="${MASCOT.src(m)}" alt="${alt}" width="${size}" height="${size}" decoding="async" loading="lazy" draggable="false"></span>`;
  },
  /* ---- 反馈（毛玻璃提示 + 林遥学姐） ---- */
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
    el.innerHTML = `${pal ? this.mascot(pal, 36, 'mb-pal') : `<span class="mb-ic" style="--c:${K[1]}">${icon(K[0], 16)}</span>`}<div class="mb-t">${esc(text)}</div>`; document.body.appendChild(el);
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
  /** v7 活动圆环：细描边 + 渐变 + 柔光，无箭头。items: {c, c2, p} */
  _rgN: 0,
  rings(items, size = 132, opts = {}) {
    const w = opts.w || size * (size < 64 ? .13 : .072), gap = size * (size < 64 ? .03 : .036), cx = size / 2, uid = 'rg' + (++this._rgN), glow = size >= 100; let defs = glow ? `<filter id="${uid}-f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(size / 46).toFixed(2)}"/></filter>` : '', out = '';
    items.forEach((it, i) => {
      const r = cx - w / 2 - 2 - i * (w + gap); const C = 2 * Math.PI * r; const p = Math.max(0, it.p || 0); const c2 = it.c2 || it.c; const id = `${uid}-${i}`;
      defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="0" x2="${cx * .35}" y2="${size}"><stop offset="0" style="stop-color:${c2}"/><stop offset="1" style="stop-color:${it.c}"/></linearGradient>`;
      out += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" class="rg-tr" style="stroke:${it.c}" stroke-width="${w}"/>`;
      const arc = (f, d, extra = '') => (glow ? arc0(f, d, ' rg-gl', ` filter="url(#${uid}-f)"`) : '') + arc0(f, d, extra, '');
      const arc0 = (f, d, extra, fl) => `<circle${fl} class="rg-a${extra}" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="url(#${id})" style="--rc:${it.c};--L:${(C * f).toFixed(2)}px;--C:${C.toFixed(2)}px;animation-delay:${d}ms" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
      if (p > 0) { out += arc(Math.max(Math.min(p, 1), .012), i * 90); if (p > 1) out += arc(Math.min(p - 1, .98), i * 90 + 500, ' rg-2'); }
    });
    return `<svg class="act-rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs>${defs}</defs>${out}</svg>`;
  },
  ringItems() {
    const tm = Focus.todayMinutes(), fg = S.settings.pomo.dailyGoal || 120, rv = Stats.reviewsSince(startOfDay()), xp = this.today(), xg = this.goal();
    return [
      { k: '专注', v: tm, g: fg, u: '分钟', c: 'var(--c-focus)', c2: 'var(--c-focus2)', p: tm / fg },
      { k: '复习', v: rv, g: 20, u: '张', c: 'var(--c-cards)', c2: 'var(--c-cards2)', p: rv / 20 },
      { k: '经验', v: xp, g: xg, u: 'XP', c: 'var(--c-xp)', c2: 'var(--c-xp2)', p: xp / xg }
    ];
  },
  /** v7 视觉小说对话框：{mood, text, title, actions, layout:'side'|'stack', art, cap} */
  vn(o = {}) {
    const lay = o.layout || 'side', art = o.art || (lay === 'stack' ? 132 : 112);
    const spark = `<svg class="vn-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c.5 5.6 4.9 10 10.5 10.5-5.6.5-10 4.9-10.5 10.5C11.5 16.9 7.1 12.5 1.5 12 7.1 11.5 11.5 7.1 12 1.5z"/></svg>`;
    return `<div class="vn vn-${lay} ${o.cls || ''}">${o.mood !== false ? `<div class="vn-art">${this.mascot(o.mood || 'normal', art, '', { cut: true })}</div>` : ''}<div class="vn-box">${spark}<span class="vn-name">${MASCOT.name}<em>${o.cap || 'せんぱい'}</em></span>${o.title ? `<div class="vn-t">${o.title}</div>` : ''}${o.text ? `<p class="vn-p">${o.text}</p>` : ''}${o.actions ? `<div class="vn-act">${o.actions}</div>` : ''}<i class="vn-next" aria-hidden="true"></i></div></div>`;
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
      <div class="cele-hero"><div class="cele-glow" style="--g:${(o.medal && o.medal.e) || '#5E5CE6'}"></div>${hero}${this.mascot(o.mood === 'happy' ? 'happy' : 'cheer', 128, 'cele-pal', { cut: true })}</div>
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
    this.after({ kicker: '专注完成', title: `${min} 分钟深度专注`, sub: '专注时间已计入今日活动圆环。', medal: { sh: 'circle', m: 'silver', e: '#E8678F', ic: 'tomato', got: true }, stats: [{ l: '经验', v: `+${min}`, u: 'XP', c: 'var(--c-xp)' }, { l: '专注', v: min, u: '分钟', c: 'var(--c-focus)' }, { l: '连续', v: this.streak(), u: '天', c: 'var(--c-streak)' }] });
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
  doneIcon(c = 'var(--c-cards)') { return `<div class="done-pal" style="--c:${c}">${this.mascot('cheer', 168, '', { cut: true })}<span class="done-badge">${icon('check', 18)}</span></div>`; }
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
  ${Game.vn({ mood: got.length >= bs.length / 2 ? 'happy' : 'encourage', text: `${near[0] ? `「${esc(near[0].name)}」已完成 ${Math.round(near[0].v / near[0].max * 100)}%，下一枚就快到手了。` : '所有奖章都集齐了，太厉害了。'}`, art: 100, cap: 'つぎの目標', cls: 'vn-ach' })}
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
