'use strict';
/* ========== 课表 + 临时安排 ==========
   设计原则：一个入口（学习 → 课表），一个「＋」，两件事：导入课表 / 添加安排。
   所有导入内容（截图识别、粘贴、CSV、.ics）都只通过 esc() 输出，颜色经 safeColor()。 */
const TT_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
const TT_TYPES = { exam: { n: '考试', c: '#E5484D' }, hw: { n: '作业', c: '#E8930C' }, act: { n: '活动', c: '#30A46C' }, meeting: { n: '班会', c: '#3E63DD' }, other: { n: '其他', c: '#8E8E93' } };
const TT_REMIND = [[0, '不提醒'], [10, '提前 10 分钟'], [30, '提前 30 分钟'], [60, '提前 1 小时'], [1440, '提前 1 天']];
const TT_PALETTE = ['#5B8DEF', '#E8678F', '#3DBE8B', '#F2A93B', '#8E7CF0', '#2BB3C0', '#EF7D57', '#6C9A3F', '#C46BD6', '#4F7CAC'];
const TT_PERIODS = [['08:00', '08:45'], ['08:55', '09:40'], ['10:00', '10:45'], ['10:55', '11:40'], ['14:00', '14:45'], ['14:55', '15:40'], ['16:00', '16:45'], ['16:55', '17:40'], ['19:00', '19:45'], ['19:55', '20:40'], ['20:50', '21:35'], ['21:45', '22:30']];
const cnNum = s => { if (/^\d+$/.test(s)) return +s; const m = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }; if (s === '十') return 10; if (s.includes('十')) { const [a, b] = s.split('十'); return (a ? m[a] : 1) * 10 + (b ? m[b] : 0); } return m[s] ?? NaN; };
const hm2min = t => { const [h, m] = String(t || '0:0').split(':'); return +h * 60 + (+m || 0); };
const min2hm = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
const isHM = t => /^\d{1,2}:\d{2}$/.test(String(t || ''));
const dk2ts = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

const TT = {
  cfg() { return S.settings.tt; },
  periods() { const p = this.cfg().periods; return Array.isArray(p) && p.length ? p : TT_PERIODS; },
  guessStart() { const d = new Date(); const y = d.getFullYear(), mo = d.getMonth(); const base = mo >= 7 ? new Date(y, 8, 1) : mo >= 1 ? new Date(y, 2, 1) : new Date(y - 1, 8, 1); const dw = (base.getDay() + 6) % 7; base.setDate(base.getDate() - dw); return dayKey(base.getTime()); },
  startKey() { return this.cfg().start || this.guessStart(); },
  startTs() { return dk2ts(this.startKey()); },
  dow(ts) { return (new Date(ts).getDay() + 6) % 7 + 1; },
  weekOf(ts) { return Math.floor((startOfDay(ts) - this.startTs()) / (7 * DAY) + 1e-9) + 1; },
  dateOf(week, day) { const d = new Date(this.startTs()); d.setDate(d.getDate() + (week - 1) * 7 + (day - 1)); return d.getTime(); },
  curWeek() { return this.weekOf(Date.now()); },
  parseWeeks(str, max = 25) {
    const s = String(str ?? '').replace(/[，、]/g, ',').replace(/[—–~～至到]/g, '-').replace(/\s/g, '');
    if (!s) return Array.from({ length: 16 }, (_, i) => i + 1);
    const odd = /单/.test(s), even = /双/.test(s); const out = new Set();
    const nums = s.replace(/[^\d,\-]/g, ',').split(',').filter(Boolean);
    for (const part of nums) { const [a, b] = part.split('-').map(Number); if (!a) continue; for (let w = a; w <= (b || a) && w <= max; w++) out.add(w); }
    if (!out.size) for (let w = 1; w <= 16; w++) out.add(w);
    return [...out].filter(w => !(odd && w % 2 === 0) && !(even && w % 2 === 1)).sort((x, y) => x - y);
  },
  fmtWeeks(arr) {
    const a = [...new Set(arr || [])].sort((x, y) => x - y); if (!a.length) return '';
    const step = a.length > 1 && a.every((w, i) => !i || w - a[i - 1] === 2) ? 2 : 1;
    if (step === 2) return `${a[0]}-${a[a.length - 1]}${a[0] % 2 ? '单' : '双'}`;
    const r = []; let s = a[0], p = a[0];
    for (const w of a.slice(1).concat(Infinity)) { if (w === p + 1) { p = w; continue; } r.push(s === p ? `${s}` : `${s}-${p}`); s = p = w; }
    return r.join(',');
  },
  courseTime(c) { const P = this.periods(); const a = P[Math.max(0, Math.min(P.length, c.start) - 1)] || P[0], b = P[Math.max(0, Math.min(P.length, c.end) - 1)] || a; return { s: a[0], e: b[1] }; },
  periodAt(t) { const m = hm2min(t); const P = this.periods(); for (let i = 0; i < P.length; i++) if (m < hm2min(P[i][1])) return i + 1; return P.length; },
  coursesOn(ts) { const w = this.weekOf(ts), d = this.dow(ts); return S.courses.filter(c => c.day === d && (c.weeks || []).includes(w)); },
  agenda(ts) {
    const k = dayKey(ts), base = startOfDay(ts); const out = [];
    for (const c of this.coursesOn(ts)) { const t = this.courseTime(c); out.push({ kind: 'course', ref: c, title: c.name, room: c.room, s: t.s, e: t.e, a: base + hm2min(t.s) * 60000, b: base + hm2min(t.e) * 60000, color: subj(c.subject).color }); }
    for (const e of S.events.filter(e => e.date === k)) out.push({ kind: 'event', ref: e, title: e.title, room: e.room, s: e.allDay ? '' : e.start, e: e.allDay ? '' : e.end, allDay: !!e.allDay, a: base + (e.allDay ? 0 : hm2min(e.start) * 60000), b: base + (e.allDay ? DAY - 1 : hm2min(e.end || e.start) * 60000), color: (TT_TYPES[e.type] || TT_TYPES.other).c });
    return out.sort((x, y) => x.a - y.a);
  },
  next(now = Date.now()) {
    for (let i = 0; i < 8; i++) { const ts = startOfDay(now) + i * DAY + 3600000; const it = this.agenda(ts).find(x => x.b > now && !(x.allDay && i > 0 && false)); if (it) return { ...it, day: i }; }
    return null;
  },
  evTs(e) { return dk2ts(e.date) + (e.allDay ? 0 : hm2min(e.start) * 60000); },
  conflicts(e) { if (!e.date || e.allDay) return []; const ts = dk2ts(e.date); const a = hm2min(e.start), b = hm2min(e.end || e.start) || a + 60; return this.coursesOn(ts).filter(c => { const t = this.courseTime(c); return hm2min(t.s) < Math.max(b, a + 1) && hm2min(t.e) > a; }); },
  ensureSubject(name) {
    const n = String(name || '').trim(); if (!n) return '';
    const ss = S.settings.subjects; let s = ss.find(x => x.name === n) || ss.find(x => n.length >= 2 && (x.name.includes(n) || n.includes(x.name)) && x.id !== 'other');
    if (!s) { s = { id: 'c' + uid(), name: n.slice(0, 30), color: TT_PALETTE[ss.length % TT_PALETTE.length] }; ss.push(s); saveSettings(); }
    return s.id;
  },
  normCourse(x) {
    const P = this.periods().length; const name = String(x?.name ?? '').trim().slice(0, 40); if (!name) return null;
    let day = typeof x.day === 'string' ? (cnNum(x.day.replace(/[周星期礼拜]/g, '').replace(/[日天]/, '7')) || +x.day) : +x.day;
    if (!(day >= 1 && day <= 7)) return null;
    let st = parseInt(x.start), en = parseInt(x.end);
    if (!(st >= 1) && isHM(x.startTime)) st = this.periodAt(x.startTime);
    if (!(en >= 1) && isHM(x.endTime)) { en = this.periodAt(min2hm(Math.max(0, hm2min(x.endTime) - 1))); }
    if (!(st >= 1)) return null; if (!(en >= st)) en = st + 1;
    st = Math.min(st, P); en = Math.min(Math.max(en, st), P);
    const weeks = Array.isArray(x.weeks) ? x.weeks.map(Number).filter(w => w >= 1 && w <= 30) : this.parseWeeks(x.weeks);
    return { id: x.id || uid(), name, teacher: String(x.teacher ?? '').trim().slice(0, 30), room: String(x.room ?? '').trim().slice(0, 40), day, start: st, end: en, weeks: weeks.length ? weeks : this.parseWeeks(''), subject: x.subject || '' };
  },
  normEvent(x) {
    const title = String(x?.title ?? '').trim().slice(0, 60); if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.date))) return null;
    const type = TT_TYPES[x.type] ? x.type : this.guessType(title + ' ' + (x.note || ''));
    const allDay = !!x.allDay || !isHM(x.start);
    const start = allDay ? '' : min2hm(hm2min(x.start)); let end = !allDay && isHM(x.end) ? min2hm(hm2min(x.end)) : '';
    if (!allDay && (!end || hm2min(end) <= hm2min(start))) end = min2hm(Math.min(23 * 60 + 59, hm2min(start) + (type === 'exam' ? 120 : 60)));
    const remind = x.remind != null && x.remind !== '' && TT_REMIND.some(r => r[0] === +x.remind) ? +x.remind : allDay ? 1440 : 30;
    return { id: x.id || uid(), title, room: String(x.room ?? '').trim().slice(0, 40), note: String(x.note ?? '').trim().slice(0, 500), type, date: x.date, allDay, start, end, remind, createdAt: x.createdAt || Date.now() };
  },
  guessType(s) { s = String(s).replace(/报告厅|会议室|会议中心/g, ''); return /考试|测验|小测|期中|期末|考核|测试|机考|笔试/.test(s) ? 'exam' : /班会|年级会|会议|例会|开会/.test(s) ? 'meeting' : /讲座|活动|社团|比赛|宣讲|晚会|志愿|体测|运动会|讲坛|沙龙|招新/.test(s) ? 'act' : /作业|提交|截止|ddl|DDL|实验报告|上交|交.{0,6}(作业|报告|论文)/.test(s) ? 'hw' : 'other'; },

  /* ---- 本地规则解析：一段通知 → 若干安排 ---- */
  parseNotice(text, now = Date.now()) {
    const segs = String(text || '').split(/\n+|[；;]|(?<=。)/).map(s => s.trim()).filter(Boolean);
    const items = []; const cue = /第\s*[0-9一二三四五六七八九十]+\s*周|[周星期礼拜]\s*[一二三四五六日天1-7]|今天|今晚|明天|明晚|明早|后天|\d{1,2}\s*月\s*\d{1,2}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.]\d{1,2}(?![\d:点])/;
    for (const s of segs) { if (cue.test(s) || !items.length) items.push(s); else items[items.length - 1] += ' ' + s; }
    return items.map(s => this.parseOne(s, now)).filter(Boolean);
  },
  parseOne(raw, now) {
    let s = raw.replace(/([零〇一二两三四五六七八九十]+)(?=\s*(点|周|节|号|日|月|分))/g, m => String(cnNum(m)));
    let rest = s; const cut = re => { const m = rest.match(re); if (m) rest = rest.replace(m[0], ' '); return m; };
    const today = startOfDay(now); let date = null, week = null, day = null;
    let m = cut(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*[日号]?/);
    if (m) date = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    if (!date && (m = cut(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/) || cut(/(?<![\d:])(\d{1,2})[/.](\d{1,2})(?![\d:点])/))) { const d = new Date(new Date(now).getFullYear(), +m[1] - 1, +m[2]); if (d.getTime() < today - 60 * DAY) d.setFullYear(d.getFullYear() + 1); date = d.getTime(); }
    if ((m = cut(/第\s*(\d+)\s*周/))) week = +m[1];
    const nw = cut(/下\s*个?\s*(?:周|星期|礼拜)\s*([一二三四五六日天1-7])?/); const nextWk = !!nw;
    if (nw && nw[1]) day = ({ 日: 7, 天: 7 })[nw[1]] || cnNum(nw[1]) || +nw[1];
    else if ((m = cut(/(?:周|星期|礼拜)\s*([一二三四五六日天1-7])/))) day = ({ 日: 7, 天: 7 })[m[1]] || cnNum(m[1]) || +m[1];
    else if (nextWk) day = 1;
    if (!date) {
      if ((m = cut(/今天|今晚|今早/))) date = today;
      else if ((m = cut(/明天|明晚|明早/))) date = today + DAY;
      else if ((m = cut(/后天/))) date = today + 2 * DAY;
      else if (week && day) date = this.dateOf(week, day);
      else if (day) { const cur = this.dow(now); let diff = day - cur; if (nextWk) diff += 7; else if (diff < 0) diff += 7; date = today + diff * DAY; }
      else if (week) date = this.dateOf(week, 1);
    }
    if (!date) return null;
    // 时间
    let start = '', end = '';
    if ((m = cut(/第?\s*(\d{1,2})\s*[-~到至—–]\s*(\d{1,2})\s*节/) || cut(/第\s*(\d{1,2})\s*节/))) { const P = this.periods(); const a = P[+m[1] - 1], b = P[+(m[2] || m[1]) - 1]; if (a) { start = a[0]; end = (b || a)[1]; } }
    if (!start) {
      const T = '(上午|早上|早晨|早|中午|下午|傍晚|晚上|晚)?\\s*(\\d{1,2})(?:[:：](\\d{2})|\\s*点\\s*(半|一刻|三刻|(\\d{1,2})\\s*分?)?)';
      const re = new RegExp(T + '(?:\\s*[-~到至—–]\\s*' + T + ')?');
      if ((m = cut(re))) {
        const conv = (ap, h, mm, dot, dm, inherit) => { if (h == null) return ''; let H = +h, M = mm != null ? +mm : dot === '半' ? 30 : dot === '一刻' ? 15 : dot === '三刻' ? 45 : dm != null ? +dm : 0; ap = ap || inherit; if (/下午|傍晚|晚/.test(ap || '') && H < 12) H += 12; else if (ap === '中午' && H < 5) H += 12; else if (!ap && H >= 1 && H <= 6) H += 12; return H < 24 && M < 60 ? min2hm(H * 60 + M) : ''; };
        start = conv(m[1], m[2], m[3], m[4], m[5]); end = conv(m[6], m[7], m[8], m[9], m[10], m[1]);
      }
    }
    // 地点
    let room = '';
    if ((m = cut(/(?:地点|教室|地址|位置)\s*[:：]\s*([^\s，,。；;]+)/))) room = m[1];
    else if ((m = cut(/在\s*([^\s，,。；;]{2,20}?)\s*(?=开|举行|召开|进行|上课|集合|参加|举办|考试|见面|见|$|\s)/))) room = m[1];
    else if ((m = cut(/[\u4e00-\u9fa5]{0,6}(?:楼|馆|厅|教室|中心|礼堂|操场|广场|会议室)[A-Za-z]?\d{0,4}室?|[A-Za-z]{1,3}\s?-?\d{3,4}(?:室|教室)?|[\u4e00-\u9fa5]{1,3}[0-9]{3,4}(?:室)?/))) room = m[0].trim();
    const type = this.guessType(rest);
    let clean = rest.replace(/[，,。！!：:、\s]+/g, ' ').replace(/^(\s*(请|各位|同学们?|大家|注意|通知|提醒|记得|之前|以前|前|于|在|的))+/g, '').replace(/(请|准时|参加|务必|按时|出席)+\s*$/g, '').trim();
    clean = clean.replace(/^(开|召开|举行|进行|举办|参加)\s*/, '').trim();
    const kw = (raw.match(/期中考试|期末考试|[\u4e00-\u9fa5A-Za-z0-9]{0,6}(考试|测验|小测|班会|讲座|作业|报告|比赛|活动|例会|会议|体测|答辩|宣讲会|晚会)/) || [])[0];
    let title = clean && clean.length <= 24 ? clean : (kw || clean.slice(0, 20));
    title = title.replace(/^(开|召开|举行|进行|举办|参加)/, '').trim() || TT_TYPES[type].n;
    if (!start && !room && type === 'other' && !kw) return null; // 只有「今天/明天」而没有时间、地点或事件词，不当成安排
    const note = raw.length > title.length + 6 ? raw.slice(0, 300) : '';
    return this.normEvent({ title, room, note, type, date: dayKey(date), start, end, allDay: !start, remind: type === 'hw' && !start ? 1440 : 30 });
  },

  /* ---- AI 解析 ---- */
  async aiCourses({ image, text }, sig) {
    const sys = '你是课程表识别助手。只输出 JSON。';
    const req = `把这份大学课程表整理成 JSON：{"courses":[{"name":"课程名","teacher":"教师","room":"上课地点","day":1到7(周一=1),"start":开始节次,"end":结束节次,"weeks":"周次，如 1-16 或 1-16单 或 2-16双 或 1-8,10-16"}]}
要求：同一门课在不同时间上课要拆成多条；只有具体时间没有节次时，用 "startTime":"HH:MM","endTime":"HH:MM" 代替 start/end；看不清的字段留空；不要编造。`;
    const valid = o => { if (!Array.isArray(o?.courses)) throw new Error('缺少 courses 数组'); return o.courses; };
    if (image) {
      if (AI.cfg().visionModel || AI.visionReady()) {
        const txt = await AI.vision(image, req, { signal: sig });
        return valid(AI.parseJSON(txt));
      }
    }
    return AI.json([{ role: 'system', content: sys }, { role: 'user', content: req + '\n\n课程表内容：\n' + String(text).slice(0, 12000) }], valid, { signal: sig });
  },
  async aiEvents(text, sig) {
    const d = new Date();
    const req = `今天是 ${dayKey()}（星期${WEEK[d.getDay()]}），本学期第 1 周的周一是 ${this.startKey()}，现在是第 ${this.curWeek()} 周。
从下面的通知里提取所有需要记下的安排，输出 JSON：{"events":[{"title":"简短标题","date":"YYYY-MM-DD","start":"HH:MM 或空","end":"HH:MM 或空","room":"地点","type":"exam|hw|act|meeting|other","note":"一句话备注"}]}
"第N周周X"按上面的学期开始日期换算成具体日期；作业截止没写时间就让 start 为空。不要编造。

通知：\n${String(text).slice(0, 6000)}`;
    return AI.json([{ role: 'system', content: '你是日程助手，只输出 JSON。' }, { role: 'user', content: req }], o => { if (!Array.isArray(o?.events)) throw new Error('缺少 events 数组'); return o.events; }, { signal: sig });
  },

  /* ---- CSV / .ics 本地解析 ---- */
  parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false; const t = String(text).replace(/^\uFEFF/, '');
    const sep = (t.split('\n')[0].match(/\t/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
    for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim()); const idx = re => head.findIndex(h => re.test(h));
    const I = { name: idx(/课程|科目|名称/), teacher: idx(/教师|老师/), room: idx(/地点|教室|上课地/), day: idx(/星期|周几|^周$|weekday/i), sec: idx(/节/), weeks: idx(/周次|周数|起止周|^周$/), st: idx(/开始时间/), et: idx(/结束时间/) };
    if (I.name < 0 || I.day < 0) return null;
    return rows.filter(r => r.some(c => c.trim())).map(r => { const sec = String(r[I.sec] ?? '').match(/(\d+)\D*(\d+)?/); return { name: r[I.name], teacher: r[I.teacher], room: r[I.room], day: r[I.day], start: sec?.[1], end: sec?.[2] || sec?.[1], weeks: r[I.weeks], startTime: r[I.st], endTime: r[I.et] }; });
  },
  parseICS(text) {
    const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/); const evs = []; let cur = null;
    for (const ln of lines) { if (ln === 'BEGIN:VEVENT') cur = {}; else if (ln === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; } else if (cur) { const i = ln.indexOf(':'); if (i > 0) { const [k, ...params] = ln.slice(0, i).split(';'); cur[k.toUpperCase()] = { v: ln.slice(i + 1), p: params.join(';') }; } } }
    const un = s => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    const dt = o => { if (!o) return null; const v = o.v; const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null; if (!m[4]) return { ts: new Date(+m[1], +m[2] - 1, +m[3]).getTime(), allDay: true }; const d = m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); return { ts: d.getTime(), allDay: false }; };
    const courses = [], events = [];
    for (const e of evs) {
      const a = dt(e.DTSTART), b = dt(e.DTEND) || a; if (!a) continue; const title = un(e.SUMMARY?.v) || '未命名'; const room = un(e.LOCATION?.v); const ad = new Date(a.ts), bd = new Date(b.ts);
      const rr = e.RRULE?.v || '';
      if (/FREQ=WEEKLY/.test(rr) && !a.allDay) {
        const iv = +(rr.match(/INTERVAL=(\d+)/) || [])[1] || 1, cnt = +(rr.match(/COUNT=(\d+)/) || [])[1] || 0; const um = rr.match(/UNTIL=(\d{8})/); const until = um ? dt({ v: um[1] }).ts : 0;
        const w0 = this.weekOf(a.ts); const weeks = []; for (let k = 0, w = w0; k < 30; k++, w += iv) { if (cnt && k >= cnt) break; if (until && this.dateOf(w, this.dow(a.ts)) > until + DAY) break; if (!cnt && !until && k >= 16) break; if (w >= 1) weeks.push(w); }
        courses.push({ name: title, room, day: this.dow(a.ts), startTime: min2hm(ad.getHours() * 60 + ad.getMinutes()), endTime: min2hm(bd.getHours() * 60 + bd.getMinutes()), weeks });
      } else events.push({ title, room, note: un(e.DESCRIPTION?.v).slice(0, 300), date: dayKey(a.ts), allDay: a.allDay, start: a.allDay ? '' : min2hm(ad.getHours() * 60 + ad.getMinutes()), end: a.allDay ? '' : min2hm(bd.getHours() * 60 + bd.getMinutes()) });
    }
    return { courses, events };
  },

  /* ---- 导出到 iPhone 日历（.ics，带提前提醒）---- */
  ics(items, name = '学习工作台课表') {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const tx = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
    const d8 = ts => { const d = new Date(ts); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; };
    const dt = (ts, t) => `${d8(ts)}T${t.replace(':', '')}00`;
    const alarm = (min, title, allDay) => min ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${tx(title)}`, `TRIGGER:-PT${allDay && min >= 1440 ? '15H' : min >= 60 ? (min / 60) + 'H' : min + 'M'}`, 'END:VALARM'] : [];
    const out = [];
    for (const it of items) {
      const base = ['BEGIN:VEVENT', `UID:${it.uid}@study-workbench`, `DTSTAMP:${stamp}`, `SUMMARY:${tx(it.title)}`];
      if (it.room) base.push(`LOCATION:${tx(it.room)}`); if (it.note) base.push(`DESCRIPTION:${tx(it.note)}`);
      if (it.allDay) base.push(`DTSTART;VALUE=DATE:${d8(it.ts)}`, `DTEND;VALUE=DATE:${d8(it.ts + DAY + 3600000)}`); else base.push(`DTSTART:${dt(it.ts, it.s)}`, `DTEND:${dt(it.ts, it.e)}`);
      out.push(...base, ...alarm(it.remind, it.title, it.allDay), 'END:VEVENT');
    }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//study-workbench//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${tx(name)}`, ...out, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  },
  evItem(e) { return { uid: 'ev-' + e.id, title: `${TT_TYPES[e.type]?.n === e.title ? '' : '[' + (TT_TYPES[e.type] || TT_TYPES.other).n + '] '}${e.title}`, room: e.room, note: e.note, ts: dk2ts(e.date), allDay: e.allDay, s: e.start, e: e.end, remind: e.remind }; },
  courseItems(c) { const t = this.courseTime(c); return (c.weeks || []).map(w => ({ uid: `c-${c.id}-${w}`, title: c.name, room: c.room, note: [c.teacher && '教师：' + c.teacher, `第${w}周`].filter(Boolean).join(' · '), ts: this.dateOf(w, c.day), s: t.s, e: t.e, remind: 10 })); },
  download(text, name) { downloadIcs(text, name); },

  /* ---- 应用内提醒（App 打开时）---- */
  checkReminders() {
    const now = Date.now(); const done = new Set(S.meta.ttN || []); let changed = false;
    for (const e of S.events) {
      if (!e.remind) continue; const at = this.evTs(e) - (e.allDay && e.remind >= 1440 ? 15 * 3600000 : e.remind * 60000); const key = e.id + '@' + e.date + e.start;
      if (now >= at && now < this.evTs(e) + (e.allDay ? DAY : 0) && !done.has(key)) { done.add(key); changed = true; const body = `${e.title}${e.allDay ? '' : ' · ' + e.start}${e.room ? ' · ' + e.room : ''}`; const o = Remind.lin('ev', { body }); Remind.notify(`${(TT_TYPES[e.type] || TT_TYPES.other).n}提醒`, o.text, { ...o, href: '#/learn/tt', go: '看安排' }); }
    }
    if (changed) { S.meta.ttN = [...done].slice(-300); DB.set('meta', S.meta); }
  }
};

/* ---------- 今日页：一行「接下来」 ---------- */
function ttNextHtml() {
  if (!S.courses.length && !S.events.length) return '';
  const n = TT.next(); if (!n) return '';
  return `<a class="card nx7" href="#/learn/tt" id="nx7"><i class="nx-bar" style="--c:${safeColor(n.color)}"></i><div class="grow"><div class="nx-k">${n.kind === 'event' ? esc((TT_TYPES[n.ref.type] || TT_TYPES.other).n) + ' · ' : ''}接下来</div><div class="nx-t">${esc(n.title)}${n.room ? `<span>${esc(n.room)}</span>` : ''}</div></div><div class="nx-r"><b class="num" id="nxCd">${ttCountdown(n)}</b><span>${n.day === 0 ? '' : n.day === 1 ? '明天 ' : `${fmtDate(n.a)} `}${n.allDay ? '全天' : esc(n.s)}</span></div></a>`;
}
function ttCountdown(n) {
  const now = Date.now(); if (!n) return '';
  if (n.allDay) return n.day === 0 ? '今天' : n.day === 1 ? '明天' : `${n.day} 天后`;
  if (now >= n.a) return `进行中`;
  const m = Math.ceil((n.a - now) / 60000); if (m < 60) return `${m} 分钟后`; if (n.day === 0) return `${Math.floor(m / 60)} 小时${m % 60 ? ' ' + (m % 60) + ' 分' : ''}后`;
  return n.day === 1 ? '明天' : `${n.day} 天后`;
}

/* ---------- 课表页 ---------- */
let _ttWeek = null, _ttAll = false;
route('/learn/tt', 'learn', v => {
  setTop('课表', { back: '#/learn', actions: `<button class="icon-btn" id="ttMore" aria-label="课表设置">${icon('more', 22)}</button><button class="icon-btn" id="ttAdd" aria-label="添加">${icon('plus', 22)}</button>` });
  $('#ttAdd').onclick = ttAddSheet; $('#ttMore').onclick = ttSettingsSheet;
  const cw = TT.curWeek(); if (_ttWeek == null) _ttWeek = Math.max(1, cw);
  const has = S.courses.length || S.events.length;
  if (!has) {
    v.innerHTML = `<div class="card">${emptyState('calendar', '课表还是空的', '拍一张教务系统课表截图，我来帮你整理成每周课表。临时的班会、考试、交作业也能记在这里。', `<button class="btn small" id="e1">导入课表</button><button class="btn small tinted" id="e2">添加安排</button>`)}</div>`;
    $('#e1').onclick = () => ttImportSheet(); $('#e2').onclick = () => ttEventSheet(); return;
  }
  const w = _ttWeek; const mon = TT.dateOf(w, 1); const P = TT.periods();
  const days = [1, 2, 3, 4, 5, 6, 7].map(d => ({ d, ts: mon + (d - 1) * DAY + 3600000 }));
  const items = days.map(x => ({ ...x, list: TT.agenda(x.ts) }));
  const weekend = items.slice(5).some(x => x.list.length);
  const cols = weekend ? items : items.slice(0, 5);
  const maxP = Math.max(8, ...cols.flatMap(x => x.list.map(it => it.allDay ? 0 : it.kind === 'course' ? it.ref.end : TT.periodAt(it.s))));
  const allDayRow = cols.some(x => x.list.some(it => it.allDay));
  const todayKey = dayKey();
  const r0 = allDayRow ? 3 : 2;
  let cells = `<div class="tg-h tg-corner"></div>` + cols.map((x, i) => { const dd = new Date(x.ts); return `<div class="tg-h ${dayKey(x.ts) === todayKey ? 'today' : ''}" style="grid-column:${i + 2}"><b>${TT_DAYS[x.d - 1]}</b><span class="num">${dd.getDate()}</span></div>`; }).join('');
  if (allDayRow) cells += `<div class="tg-n" style="grid-row:2"></div>`;
  for (let p = 1; p <= maxP; p++) cells += `<div class="tg-n" style="grid-row:${p + r0 - 1}"><b class="num">${p}</b><span class="num">${P[p - 1] ? P[p - 1][0] : ''}</span></div>`;
  cols.forEach((x, i) => {
    for (const it of x.list) {
      if (it.kind === 'course') { const c = it.ref; cells += `<button class="tg-c" data-c="${esc(c.id)}" style="grid-column:${i + 2};grid-row:${c.start + r0 - 1}/${c.end + r0};--c:${safeColor(it.color)}"><b>${esc(c.name)}</b>${c.room ? `<span>${esc(c.room)}</span>` : ''}</button>`; }
      else { const e = it.ref; const row = e.allDay ? 2 : TT.periodAt(e.start) + r0 - 1; cells += `<button class="tg-e ${e.allDay ? 'ad' : ''}" data-e="${esc(e.id)}" style="grid-column:${i + 2};grid-row:${row};--c:${safeColor(it.color)}">${esc(e.title)}</button>`; }
    }
  });
  // 临时安排列表
  const now = Date.now(); const from = startOfDay();
  const ups = S.events.filter(e => TT.evTs(e) + (e.allDay ? DAY : hm2min(e.end || e.start) * 60000 - hm2min(e.start) * 60000) >= now - 0 && (_ttAll || TT.evTs(e) < from + 8 * DAY)).sort((a, b) => TT.evTs(a) - TT.evTs(b));
  v.innerHTML = `<div class="tt-wk"><button class="icon-btn" id="wP" aria-label="上一周">‹</button><div class="tt-wkt"><b>第 ${w} 周</b><span class="num">${fmtDate(mon)} – ${fmtDate(mon + 6 * DAY)}</span></div><button class="icon-btn" id="wN" aria-label="下一周">›</button></div>
  ${w !== cw && cw >= 1 ? `<div class="tt-back"><button class="btn small plain" id="wC">回到本周（第 ${cw} 周）</button></div>` : ''}
  ${!TT.cfg().start ? `<div class="tt-ask small">第 1 周的周一是 <input type="date" id="stD" value="${esc(TT.startKey())}"> <span class="muted">（设置一次即可）</span></div>` : ''}
  <div class="card tt-card"><div class="tt-grid" id="tg" style="grid-template-columns:30px repeat(${cols.length},1fr);grid-template-rows:38px ${allDayRow ? '26px ' : ''}repeat(${maxP},50px)">${cells}</div></div>
  <div class="sec-h"><h2>临时安排</h2><div class="seg mini" id="evSeg"><button class="${_ttAll ? '' : 'on'}" data-a="0">近 7 天</button><button class="${_ttAll ? 'on' : ''}" data-a="1">全部</button></div></div>
  ${ups.length ? `<div class="list" id="evl">${ups.map(ttEventRow).join('')}</div>` : `<div class="card small muted tt-none">${_ttAll ? '没有待进行的安排' : '近 7 天没有临时安排'}。点右上角 ＋ 添加。</div>`}`;
  const go = d => { _ttWeek = Math.max(1, Math.min(30, _ttWeek + d)); rerender(); };
  $('#wP').onclick = () => go(-1); $('#wN').onclick = () => go(1); const wc = $('#wC'); if (wc) wc.onclick = () => { _ttWeek = cw; rerender(); };
  const sd = $('#stD'); if (sd) sd.onchange = () => { if (!sd.value) return; const ts = dk2ts(sd.value); const dw = TT.dow(ts); TT.cfg().start = dayKey(ts - (dw - 1) * DAY); saveSettings(); _ttWeek = null; toast('已设置学期开始日期'); rerender(); };
  $('#evSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; _ttAll = b.dataset.a === '1'; rerender(); };
  const tg = $('#tg'); tg.onclick = e => { const c = e.target.closest('[data-c]'), ev = e.target.closest('[data-e]'); if (c) ttCourseSheet(c.dataset.c); else if (ev) ttEventView(ev.dataset.e); };
  let sx = null, sy = 0; tg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  tg.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); }, { passive: true });
  const el = $('#evl'); if (el) el.onclick = e => { const r = e.target.closest('[data-e]'); if (r) ttEventView(r.dataset.e); };
});
function ttWhen(e) { const ts = dk2ts(e.date); return `${relDue(ts) === fmtDate(ts) ? fmtDate(ts) : relDue(ts)} 周${TT_DAYS[TT.dow(ts) - 1]}${e.allDay ? ' 全天' : ' ' + e.start}`; }
function ttEventRow(e) {
  const t = TT_TYPES[e.type] || TT_TYPES.other; const cf = TT.conflicts(e);
  return `<button class="row ev-row" data-e="${esc(e.id)}"><i class="ev-dot" style="--c:${t.c}"></i><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(ttWhen(e))}${e.room ? ' · ' + esc(e.room) : ''}${cf.length ? ` · <span class="warn-t">与「${esc(cf[0].name)}」冲突</span>` : ''}</div></div><span class="ev-tag" style="--c:${t.c}">${t.n}</span></button>`;
}

/* ---------- ＋：两个选择 ---------- */
function ttAddSheet() {
  openSheet(`<h2>添加</h2><div class="tt-choice">
    <button class="tt-big" id="cI">${iconTile('calendar', '#5B8DEF', 22)}<div><b>导入课表</b><span>拍照或截图，自动识别每周课程</span></div></button>
    <button class="tt-big" id="cE">${iconTile('bell', '#E8678F', 22)}<div><b>添加安排</b><span>班会、考试、交作业… 粘贴通知即可</span></div></button></div>`, el => {
    $('#cI', el).onclick = () => ttImportSheet(); $('#cE', el).onclick = () => ttEventSheet();
  });
}

/* ---------- 导入课表 ---------- */
function ttImportSheet() {
  const aiOk = AI.ready() || AI.visionReady();
  openSheet(`<h2>导入课表</h2>
    <button class="btn block big" id="iPh">${icon('camera', 18)} 拍照 / 选择课表截图</button>
    <div class="small muted tt-hint">在教务系统里打开「我的课表」截一张完整的图。${aiOk ? '' : '<br><b>需要先在「设置 → AI 与隐私」配置 AI</b>（推荐带图片识别的模型）。'}</div>
    <div class="tt-links"><button class="link" id="iTx">粘贴文字</button><span>·</span><button class="link" id="iMan">手动添加一门课</button></div>
    <details class="tt-more"><summary>更多方式</summary><div class="btns"><button class="btn small plain" id="iIcs">导入 .ics 日历文件</button><button class="btn small plain" id="iCsv">导入 CSV（Excel 另存为 CSV）</button></div></details>`, el => {
    $('#iPh', el).onclick = ttImportPhoto;
    $('#iTx', el).onclick = ttImportText;
    $('#iMan', el).onclick = () => ttPreview([{ name: '', day: TT.dow(Date.now()) > 5 ? 1 : TT.dow(Date.now()), start: 1, end: 2, weeks: '1-16', room: '' }], [], { manual: true });
    $('#iIcs', el).onclick = async () => { const [f] = await pickFile('.ics,text/calendar'); if (!f) return; const r = TT.parseICS(await readFileAs(f)); if (!r.courses.length && !r.events.length) return toast('没有在文件里找到日程'); ttPreview(r.courses, r.events); };
    $('#iCsv', el).onclick = async () => { const [f] = await pickFile('.csv,.tsv,.txt,text/csv'); if (!f) return; const rows = TT.parseCSV(await readFileAs(f)); if (!rows || !rows.length) return toast('没认出表头：至少需要「课程」「星期」「节次」列'); ttPreview(rows, []); };
  });
}
async function ttImportPhoto() {
  if (!AI.ready() && !AI.visionReady()) return showAIError(new AIError('识别课表截图需要先配置 AI。请到「我的 → 设置 → AI 与隐私」填写（推荐硅基流动 / 通义千问等带图片识别的服务商）。也可以选「手动添加一门课」。', 'config'));
  const [f] = await pickFile('image/*'); if (!f) return; closeSheet(true);
  try {
    const img = await compressImage(f, 2200, 0.88);
    const list = await withLoading('正在识别课表…', async (sig, prog) => {
      if (AI.cfg().visionModel || AI_PRESETS[AI.cfg().preset]?.visionModel) return TT.aiCourses({ image: img }, sig);
      prog('本地识别文字中…'); const text = await Books.tesseract(img, t => prog(t)); prog('AI 整理课表中…'); return TT.aiCourses({ text }, sig);
    });
    if (!list.length) return toast('没有识别到课程，可以换一张更清晰的截图');
    ttPreview(list, []);
  } catch (e) { showAIError(e); }
}
function ttImportText() {
  openSheet(`<h2>粘贴课表文字</h2><textarea id="tX" style="min-height:36vh" placeholder="从教务系统复制课表文字，或粘贴 Excel 表格（带表头：课程、星期、节次、周次、地点）"></textarea><button class="btn block" id="tOk" style="margin-top:10px">识别</button>`, el => {
    $('#tOk', el).onclick = async () => {
      const t = $('#tX', el).value.trim(); if (!t) return toast('请先粘贴内容');
      const rows = TT.parseCSV(t); if (rows && rows.length) return ttPreview(rows, []);
      if (!AI.ready()) return showAIError(new AIError('这段文字不是表格格式，需要 AI 帮忙整理。请先配置 AI，或改用带表头的表格。', 'config'));
      try { const list = await withLoading('AI 正在整理课表…', sig => TT.aiCourses({ text: t }, sig)); if (!list.length) return toast('没有识别到课程'); ttPreview(list, []); } catch (e) { showAIError(e); }
    };
  });
}
function ttCourseForm(c, i) {
  const P = TT.periods().length; const opt = (n, sel) => Array.from({ length: n }, (_, k) => `<option value="${k + 1}" ${k + 1 === sel ? 'selected' : ''}>${k + 1}</option>`).join('');
  return `<div class="pv-c" data-i="${i}"><div class="pv-r"><input type="text" data-k="name" value="${esc(c.name)}" placeholder="课程名"><button class="icon-btn pv-x" data-del="${i}" aria-label="删除">${icon('xmark', 16)}</button></div>
  <div class="pv-r small"><select data-k="day">${TT_DAYS.map((d, k) => `<option value="${k + 1}" ${k + 1 === c.day ? 'selected' : ''}>周${d}</option>`).join('')}</select><span>第</span><select data-k="start">${opt(P, c.start)}</select><span>–</span><select data-k="end">${opt(P, c.end)}</select><span>节</span></div>
  <div class="pv-r small"><input type="text" data-k="room" value="${esc(c.room)}" placeholder="地点"><input type="text" data-k="weeks" value="${esc(TT.fmtWeeks(c.weeks))}" placeholder="周次 1-16" class="pv-w"></div></div>`;
}
function ttPreview(rawCourses, rawEvents, { manual = false, edit = null } = {}) {
  let cs = rawCourses.map(x => TT.normCourse(manual ? { ...x, name: x.name || '新课程' } : x)).filter(Boolean); if (manual) cs.forEach(c => c.name = c.name === '新课程' ? '' : c.name);
  const evs = rawEvents.map(x => TT.normEvent(x)).filter(Boolean);
  if (!cs.length && !evs.length) return toast('没有可导入的内容');
  const hasOld = S.courses.length > 0 && !manual && !edit && cs.length > 0;
  openSheet(`<h2>${edit ? '编辑课程' : manual ? '添加课程' : `确认课表（${cs.length} 门次）`}</h2>
    ${!edit && !manual ? '<div class="small muted" style="margin:-4px 2px 10px">识别结果可能有误，请对照原图检查后再保存。</div>' : ''}
    ${!TT.cfg().start && cs.length ? `<label class="f"><span>第 1 周的周一是哪天？</span><input type="date" id="pvS" value="${esc(TT.startKey())}"></label>` : ''}
    <div id="pvL">${cs.map(ttCourseForm).join('')}</div>
    ${edit ? `<label class="f"><span>教师（可选）</span><input type="text" id="pvT" value="${esc(cs[0]?.teacher || '')}"></label>` : ''}
    ${evs.length ? `<h3>另有 ${evs.length} 个单次日程</h3><div class="list">${evs.slice(0, 50).map(e => `<div class="row"><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(ttWhen(e))}${e.room ? ' · ' + esc(e.room) : ''}</div></div></div>`).join('')}</div>` : ''}
    ${hasOld ? `<label class="row tt-rep"><span class="grow small">替换现有课表（${S.courses.length} 门次）</span><label class="switch"><input type="checkbox" id="pvR" checked><span></span></label></label>` : ''}
    <div class="btns">${manual && !edit ? '<button class="btn plain" id="pvAdd">＋ 再加一门</button>' : ''}<button class="btn" id="pvOk">保存</button></div>`, el => {
    const read = () => $$('.pv-c', el).map(r => { const g = k => $(`[data-k=${k}]`, r).value; const i = +r.dataset.i; return { ...cs[i], name: g('name').trim(), day: +g('day'), start: +g('start'), end: Math.max(+g('start'), +g('end')), room: g('room').trim(), weeks: TT.parseWeeks(g('weeks')) }; });
    $('#pvL', el).onclick = e => { const d = e.target.closest('[data-del]'); if (!d) return; cs = read(); cs.splice(+d.dataset.del, 1); $('#pvL', el).innerHTML = cs.map(ttCourseForm).join(''); };
    const add = $('#pvAdd', el); if (add) add.onclick = () => { cs = read(); const l = cs[cs.length - 1] || { day: 1, start: 1, end: 2, weeks: TT.parseWeeks('') }; cs.push({ id: uid(), name: '', room: '', teacher: '', day: l.day, start: Math.min(TT.periods().length, l.end + 1), end: Math.min(TT.periods().length, l.end + 2), weeks: l.weeks }); $('#pvL', el).innerHTML = cs.map(ttCourseForm).join(''); };
    $('#pvOk', el).onclick = () => {
      const st = $('#pvS', el); if (st && st.value) { const ts = dk2ts(st.value); TT.cfg().start = dayKey(ts - (TT.dow(ts) - 1) * DAY); saveSettings(); }
      const list = read().filter(c => c.name); if (cs.length && !list.length && !evs.length) return toast('请填写课程名');
      if (edit) { const t = $('#pvT', el); Object.assign(edit, list[0] || {}, { teacher: t ? t.value.trim() : edit.teacher, id: edit.id }); edit.subject = TT.ensureSubject(edit.name); }
      else {
        if ($('#pvR', el)?.checked) S.courses = [];
        list.forEach(c => { c.subject = TT.ensureSubject(c.name); S.courses.push(c); });
        evs.forEach(e => S.events.push(e)); if (evs.length) save('events');
      }
      save('courses'); closeSheet(); _ttWeek = null; toast(edit ? '已保存' : `已保存 ${list.length} 门次课程${evs.length ? `、${evs.length} 个日程` : ''}`);
      if (location.hash.startsWith('#/learn/tt')) rerender(); else location.hash = '#/learn/tt';
    };
  });
}
function ttCourseSheet(id) {
  const c = S.courses.find(x => x.id === id); if (!c) return; const t = TT.courseTime(c); const s = subj(c.subject);
  openSheet(`<div class="tsh"><i style="--c:${safeColor(s.color)}"></i><h2>${esc(c.name)}</h2></div>
    <div class="list"><div class="row"><div class="grow small muted">时间</div><div>周${TT_DAYS[c.day - 1]} 第 ${c.start}–${c.end} 节 · ${esc(t.s)}–${esc(t.e)}</div></div>
    ${c.room ? `<div class="row"><div class="grow small muted">地点</div><div>${esc(c.room)}</div></div>` : ''}${c.teacher ? `<div class="row"><div class="grow small muted">教师</div><div>${esc(c.teacher)}</div></div>` : ''}
    <div class="row"><div class="grow small muted">周次</div><div>${esc(TT.fmtWeeks(c.weeks))} 周</div></div></div>
    <div class="btns"><button class="btn" id="csR">${icon('check', 17)} 课后复习</button><button class="btn tinted" id="csB">${icon('books', 17)} 导入这门课的教材</button></div>
    <div class="btns"><button class="btn plain" id="csE">编辑</button><button class="btn danger" id="csD">删除</button></div>`, el => {
    $('#csR', el).onclick = () => { const exists = S.todos.find(x => !x.done && x.due === dayKey() && x.title === `复习：${c.name}`); if (exists) { closeSheet(); return toast('今天已经有这条复习计划了'); } S.todos.push({ id: uid(), title: `复习：${c.name}`, note: c.room ? `课后回顾 · ${c.room}` : '课后回顾', due: dayKey(), priority: 1, subject: c.subject, done: false, doneAt: 0, createdAt: Date.now(), estimate: 25 }); save('todos'); closeSheet(); toast('已加入今日计划'); Remind.update(); };
    $('#csB', el).onclick = () => { closeSheet(); location.hash = `#/learn/books?subject=${encodeURIComponent(c.subject)}&import=1`; };
    $('#csE', el).onclick = () => ttPreview([c], [], { manual: true, edit: c });
    $('#csD', el).onclick = async () => { if (await confirmBox(`删除「${c.name}」周${TT_DAYS[c.day - 1]}这节课？`, '删除')) { S.courses = S.courses.filter(x => x !== c); save('courses'); rerender(); } };
  });
}

/* ---------- 添加安排：一个输入框 ---------- */
function ttEventSheet() {
  openSheet(`<h2>添加安排</h2>
    <textarea id="evT" class="ev-in" placeholder="粘贴通知或直接输入，如：周三下午3点 A201 班会"></textarea>
    <div id="evP" class="ev-pv"></div>
    <div class="btns"><button class="btn" id="evOk" disabled>保存</button></div>
    ${AI.ready() ? '<div class="tt-links"><button class="link" id="evAI">识别得不对？用 AI 识别</button></div>' : ''}`, el => {
    let drafts = []; let open = -1;
    const draw = () => {
      $('#evOk', el).disabled = !drafts.length; $('#evOk', el).textContent = drafts.length > 1 ? `保存 ${drafts.length} 项` : '保存';
      const txt = $('#evT', el).value.trim();
      $('#evP', el).innerHTML = drafts.length ? drafts.map((d, i) => ttDraftCard(d, i, i === open)).join('') : txt ? '<div class="small muted ev-empty">还没认出日期，试试加上「周三」「明天」「11月5日」或「第8周周三」</div>' : '';
    };
    const parse = () => { drafts = TT.parseNotice($('#evT', el).value); open = -1; draw(); };
    $('#evT', el).addEventListener('input', debounce(parse, 300));
    setTimeout(() => $('#evT', el)?.focus(), 250);
    $('#evP', el).addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.closest('[data-i]').dataset.i;
      if (b.dataset.act === 'edit') { if (open >= 0) drafts[open] = ttReadDraft(el, drafts[open]); open = open === i ? -1 : i; draw(); }
      else if (b.dataset.act === 'del') { drafts.splice(i, 1); open = -1; draw(); }
    });
    $('#evP', el).addEventListener('change', e => { if (open < 0) return; const d = ttReadDraft(el, drafts[open]); if (e.target.matches('[data-k=week],[data-k=day]')) { const wk = +$('[data-k=week]', el).value, dy = +$('[data-k=day]', el).value; d.date = dayKey(TT.dateOf(wk, dy)); } drafts[open] = d; draw(); });
    const ai = $('#evAI', el); if (ai) ai.onclick = async () => {
      const t = $('#evT', el).value.trim(); if (!t) return toast('请先输入或粘贴通知');
      try { const list = await withLoading('AI 正在识别…', sig => TT.aiEvents(t, sig)); drafts = list.map(x => TT.normEvent(x)).filter(Boolean); open = -1; ttOpenAgain(el, t, drafts); } catch (e) { showAIError(e); }
    };
    $('#evOk', el).onclick = () => { if (open >= 0) drafts[open] = ttReadDraft(el, drafts[open]); const ok = drafts.map(d => TT.normEvent(d)).filter(Boolean); if (!ok.length) return toast('请填写标题和日期'); ok.forEach(e => S.events.push(e)); save('events'); closeSheet(); toast(`已添加 ${ok.length} 项安排`); if (location.hash.startsWith('#/learn/tt')) rerender(); else location.hash = '#/learn/tt'; };
    el._tt = { set: (t, d) => { $('#evT', el).value = t; drafts = d; draw(); } };
  });
}
// withLoading 会关闭 sheet 的情况下，重新打开并填入 AI 结果
function ttOpenAgain(el, text, drafts) { if (document.body.contains(el) && el._tt) return el._tt.set(text, drafts); ttEventSheet(); setTimeout(() => $('#sheetBody')._tt?.set(text, drafts), 50); }
function ttDraftCard(d, i, open) {
  const t = TT_TYPES[d.type] || TT_TYPES.other; const cf = TT.conflicts(d);
  const head = `<div class="dr-h"><i class="ev-dot" style="--c:${t.c}"></i><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">${esc(ttWhen(d))}${d.room ? ' · ' + esc(d.room) : ''} · ${esc((TT_REMIND.find(r => r[0] === d.remind) || TT_REMIND[2])[1])}</div>${cf.length ? `<div class="s warn-t">⚠︎ 与「${esc(cf[0].name)}」上课时间冲突</div>` : ''}</div><button class="btn small plain" data-act="edit">${open ? '收起' : '修改'}</button><button class="icon-btn pv-x" data-act="del" aria-label="删除">${icon('xmark', 15)}</button></div>`;
  if (!open) return `<div class="dr card" data-i="${i}">${head}</div>`;
  const ts = dk2ts(d.date); const wk = TT.weekOf(ts);
  return `<div class="dr card open" data-i="${i}">${head}<div class="dr-f">
    <label class="f"><span>标题</span><input type="text" data-k="title" value="${esc(d.title)}"></label>
    <div class="grid2"><label class="f"><span>日期</span><input type="date" data-k="date" value="${esc(d.date)}"></label><label class="f"><span>第几周 · 星期</span><span class="pv-r"><select data-k="week">${Array.from({ length: 30 }, (_, k) => `<option value="${k + 1}" ${k + 1 === wk ? 'selected' : ''}>${k + 1}</option>`).join('')}</select><select data-k="day">${TT_DAYS.map((x, k) => `<option value="${k + 1}" ${k + 1 === TT.dow(ts) ? 'selected' : ''}>周${x}</option>`).join('')}</select></span></label></div>
    <div class="grid2"><label class="f"><span>开始</span><input type="time" data-k="start" value="${esc(d.start)}" ${d.allDay ? 'disabled' : ''}></label><label class="f"><span>结束</span><input type="time" data-k="end" value="${esc(d.end)}" ${d.allDay ? 'disabled' : ''}></label></div>
    <label class="row dr-ad"><span class="grow small">全天 / 截止日</span><label class="switch"><input type="checkbox" data-k="allDay" ${d.allDay ? 'checked' : ''}><span></span></label></label>
    <div class="grid2"><label class="f"><span>地点</span><input type="text" data-k="room" value="${esc(d.room)}" placeholder="可不填"></label><label class="f"><span>类型</span><select data-k="type">${Object.entries(TT_TYPES).map(([k, x]) => `<option value="${k}" ${k === d.type ? 'selected' : ''}>${x.n}</option>`).join('')}</select></label></div>
    <label class="f"><span>提醒</span><select data-k="remind">${TT_REMIND.map(([m, l]) => `<option value="${m}" ${m === d.remind ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span>备注</span><input type="text" data-k="note" value="${esc(d.note)}" placeholder="可不填"></label></div></div>`;
}
function ttReadDraft(el, d) {
  const box = $('.dr.open', el); if (!box) return d; const g = k => $(`[data-k=${k}]`, box);
  const allDay = g('allDay').checked; let start = g('start').value; if (!allDay && !start) start = d.start || '09:00';
  return { ...d, title: g('title').value.trim() || d.title, date: g('date').value || d.date, allDay, start: allDay ? '' : start, end: allDay ? '' : g('end').value, room: g('room').value.trim(), type: g('type').value, remind: +g('remind').value, note: g('note').value.trim() };
}
function ttEventView(id) {
  const e = S.events.find(x => x.id === id); if (!e) return; const t = TT_TYPES[e.type] || TT_TYPES.other; const cf = TT.conflicts(e);
  openSheet(`<div class="tsh"><span class="ev-tag" style="--c:${t.c}">${t.n}</span><h2>${esc(e.title)}</h2></div>
    <div class="list"><div class="row"><div class="grow small muted">时间</div><div>${esc(ttWhen(e))}${e.allDay ? '' : '–' + esc(e.end)} · 第 ${TT.weekOf(dk2ts(e.date))} 周</div></div>
    ${e.room ? `<div class="row"><div class="grow small muted">地点</div><div>${esc(e.room)}</div></div>` : ''}
    <div class="row"><div class="grow small muted">提醒</div><div>${esc((TT_REMIND.find(r => r[0] === e.remind) || TT_REMIND[0])[1])}</div></div>
    ${e.note ? `<div class="row"><div class="small pre">${esc(e.note)}</div></div>` : ''}</div>
    ${cf.length ? `<div class="notice small warn-n">⚠︎ 与「${esc(cf.map(c => c.name).join('、'))}」上课时间冲突</div>` : ''}
    <button class="btn block" id="evC">${icon('calendar', 17)} 添加到 iPhone 日历</button>
    <div class="small muted tt-hint">网页 App 关闭后无法自己推送；加到系统日历后会按「${esc((TT_REMIND.find(r => r[0] === e.remind) || TT_REMIND[0])[1])}」准时提醒。</div>
    <div class="btns"><button class="btn plain" id="evE">修改</button><button class="btn danger" id="evD">删除</button></div>`, el => {
    $('#evC', el).onclick = () => TT.download(TT.ics([TT.evItem(e)], e.title), `${e.title.slice(0, 20)}.ics`);
    $('#evD', el).onclick = async () => { if (await confirmBox(`删除「${e.title}」？`, '删除')) { S.events = S.events.filter(x => x !== e); save('events'); rerender(); } };
    $('#evE', el).onclick = () => ttEditEvent(e);
  });
}
function ttEditEvent(e) {
  openSheet(`<h2>修改安排</h2><div id="evP">${ttDraftCard(e, 0, true)}</div><div class="btns"><button class="btn" id="evOk">保存</button></div>`, el => {
    let d = { ...e };
    $('#evP', el).addEventListener('change', ev => { d = ttReadDraft(el, d); if (ev.target.matches('[data-k=week],[data-k=day]')) d.date = dayKey(TT.dateOf(+$('[data-k=week]', el).value, +$('[data-k=day]', el).value)); $('#evP', el).innerHTML = ttDraftCard(d, 0, true); });
    $('#evP', el).addEventListener('click', ev => { const b = ev.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'del') { S.events = S.events.filter(x => x !== e); save('events'); closeSheet(); rerender(); } });
    $('#evOk', el).onclick = () => { const n = TT.normEvent({ ...ttReadDraft(el, d), id: e.id, createdAt: e.createdAt }); if (!n) return toast('请填写标题和日期'); Object.assign(e, n); save('events'); closeSheet(); toast('已保存'); rerender(); };
  });
}

/* ---------- 课表设置（⋯） ---------- */
function ttSettingsSheet() {
  const P = TT.periods();
  openSheet(`<h2>课表设置</h2>
    <label class="f"><span>第 1 周的周一</span><input type="date" id="sS" value="${esc(TT.startKey())}"></label>
    <div class="small muted" style="margin:-6px 2px 12px">现在是第 ${TT.curWeek()} 周</div>
    <details class="tt-more"><summary>每节课的时间（${P.length} 节）</summary><div id="sP" class="sp-l">${P.map((p, i) => `<div class="pv-r small"><b class="num sp-n">${i + 1}</b><input type="time" value="${esc(p[0])}"><span>–</span><input type="time" value="${esc(p[1])}"></div>`).join('')}</div>
      <div class="btns"><button class="btn small plain" id="sPm">减少一节</button><button class="btn small plain" id="sPp">增加一节</button><button class="btn small plain" id="sPr">恢复默认</button></div></details>
    <button class="btn block tinted" id="sX" style="margin-top:12px">${icon('calendar', 17)} 全部导出到 iPhone 日历</button>
    <div class="small muted tt-hint">包含本学期所有课程（课前 10 分钟提醒）和临时安排（按各自提醒时间）。</div>
    <div class="btns"><button class="btn danger" id="sC">清空课表</button><button class="btn" id="sOk">保存</button></div>`, el => {
    const readP = () => $$('#sP .pv-r', el).map(r => { const [a, b] = $$('input', r).map(i => i.value); return [a || '08:00', b || a || '08:45']; });
    const redraw = arr => { $('#sP', el).innerHTML = arr.map((p, i) => `<div class="pv-r small"><b class="num sp-n">${i + 1}</b><input type="time" value="${esc(p[0])}"><span>–</span><input type="time" value="${esc(p[1])}"></div>`).join(''); };
    $('#sPp', el).onclick = () => { const a = readP(); const l = a[a.length - 1]; const s = hm2min(l[1]) + 10; a.push([min2hm(s), min2hm(s + 45)]); redraw(a); };
    $('#sPm', el).onclick = () => { const a = readP(); if (a.length > 4) a.pop(); redraw(a); };
    $('#sPr', el).onclick = () => redraw(TT_PERIODS);
    $('#sOk', el).onclick = () => { const v = $('#sS', el).value; if (v) { const ts = dk2ts(v); TT.cfg().start = dayKey(ts - (TT.dow(ts) - 1) * DAY); } TT.cfg().periods = readP(); saveSettings(); _ttWeek = null; closeSheet(); toast('已保存'); rerender(); };
    $('#sX', el).onclick = () => { const items = [...S.courses.flatMap(c => TT.courseItems(c)), ...S.events.filter(e => TT.evTs(e) >= startOfDay()).map(e => TT.evItem(e))]; if (!items.length) return toast('还没有课程或安排'); TT.download(TT.ics(items), '学习工作台课表.ics'); };
    $('#sC', el).onclick = async () => { if (await confirmBox('清空所有课程？（临时安排保留）', '清空')) { S.courses = []; save('courses'); _ttWeek = null; rerender(); } };
  });
}
