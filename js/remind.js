'use strict';
/* ========== 复习提醒：应用内横幅 / 角标 / 前台通知 / 日历 .ics ==========
   说明：纯前端 PWA 没有服务器，App 被关闭或挂起后无法自己“定时”推送。
   因此提供：①打开 App 时的横幅与角标；②App 在前台/刚切回时到点弹通知；③导出 .ics 让 iPhone 日历每天按时提醒（最可靠）。 */
const Remind = {
  counts() {
    const today = dayKey();
    const cards = Cards.dueTotal();
    const todos = S.todos.filter(t => !t.done && t.due && t.due <= today).length;
    const overdue = S.todos.filter(t => !t.done && t.due && t.due < today).length;
    const wrongs = S.wrongs.filter(w => !w.mastered && (!w.lastReview || Date.now() - w.lastReview > 2 * DAY)).length;
    return { cards, todos, overdue, wrongs, total: cards + todos + wrongs };
  },
  update() {
    const c = this.counts(); const on = S.settings.remind.enabled;
    const set = (tab, n) => { const a = $(`#tabbar a[data-tab=${tab}]`); if (!a) return; let b = a.querySelector('.badge'); if (!on || !n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'badge'; a.querySelector('.ti').appendChild(b); } b.className = 'badge dot'; b.textContent = ''; a.setAttribute('aria-label', a.textContent.trim() + `（${n} 项待处理）`); };
    set('plan', c.todos); set('learn', c.cards);
    try { if (navigator.setAppBadge) { on && c.total ? navigator.setAppBadge(c.total) : navigator.clearAppBadge?.(); } } catch (e) { }
    return c;
  },
  bannerHtml() {
    if (!S.settings.remind.enabled) return '';
    const c = this.counts(); if (!c.total) return '';
    const parts = []; if (c.cards) parts.push(`<a href="#/learn/review/all"><b>${c.cards}</b> 张卡片待复习</a>`); if (c.wrongs) parts.push(`<a href="#/learn/wrong-review"><b>${c.wrongs}</b> 道错题该回顾</a>`); if (c.todos) parts.push(`<a href="#/plan"><b>${c.todos}</b> 项计划${c.overdue ? `（${c.overdue} 项已逾期）` : ''}</a>`);
    return `<div class="remind-banner">${icon('bell', 20)}<div>今日待办：${parts.join('、')}</div></div>`;
  },
  /* ---- 学姐口吻的提醒文案（本地模板，不调用 AI） ---- */
  lin(kind, x = {}) {
    const n = typeof Lin !== 'undefined' ? Lin.nick() : '同学', ro = typeof Lin !== 'undefined' ? Lin.romance() : false;
    const room = x.room ? `，在 ${x.room}` : '';
    const T = {
      am: [['happy', `早安，${n}～今天有 ${x.body}，我们一起慢慢来。`], ['cheer', `${n}早上好！今天的任务：${x.body}。先从最简单的一项开始吧～`]],
      eve: [['encourage', `${n}，晚上好。睡前花 15 分钟复习一下吧：${x.body}。`], [ro ? 'gaze' : 'normal', ro ? `今天辛苦啦～睡前陪我复习一会儿好不好？${x.body}。` : `今天辛苦啦，睡前再巩固一下：${x.body}，记得更牢。`]],
      cls: [['surprised', `${n}！还有 ${x.m} 分钟就是「${x.t}」了${room}，别迟到哦～`], ['normal', `「${x.t}」${x.m} 分钟后开始${room}。带好课本，路上小心～`]],
      ev: [['wink', `提醒你一下：${x.body}。别忘了哦～`], ['normal', `${n}，${x.body}，我帮你记着呢。`]],
      late: [['night', `已经 ${x.hm} 了……${n}，该睡了。明天的卡片我帮你留着。`], ['pout', ro ? `这么晚还不睡？我要生气了哦……快去睡觉，明天见。` : `这么晚了，快去睡觉吧，熬夜会让记忆变差的。`]]
    }[kind] || [['normal', x.body || '']];
    const [mood, text] = T[Math.floor(Math.random() * T.length)]; return { mood, text };
  },
  // 每天早晚两个时间点 + 深夜提醒睡觉 + 课前 10 分钟（仅 App 打开/切回前台时）
  check() {
    const r = S.settings.remind; if (!r.enabled || document.visibilityState !== 'visible') return;
    const now = new Date(); const hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes()); const today = dayKey();
    const done = S.meta.remindDone && S.meta.remindDone.d === today ? S.meta.remindDone : { d: today, s: [] };
    const mark = k => { done.s.push(k); S.meta.remindDone = done; DB.set('meta', S.meta); };
    // 课前 10 分钟
    try {
      const n = TT.next(); const m = n && !n.allDay && n.kind !== 'event' ? Math.ceil((n.a - Date.now()) / 60000) : -1; const k = n && 'c:' + (n.ref?.id || n.title) + '@' + n.a;
      if (n && m > 0 && m <= 10 && !done.s.includes(k)) { mark(k); const o = this.lin('cls', { m, t: n.title, room: n.room }); return this.notify(`${n.title} · ${m} 分钟后`, o.text, { ...o, href: '#/learn/tt', go: '看课表' }); }
    } catch (e) { }
    // 深夜 0:30 – 4:30 提醒睡觉
    if (hm >= '00:30' && hm < '04:30' && !done.s.includes('late')) { mark('late'); const o = this.lin('late', { hm }); return this.notify('该睡觉啦', o.text, { ...o, go: '晚安' }); }
    const slot = [['m', r.morning], ['e', r.evening]].filter(([k, t]) => t && hm >= t && !done.s.includes(k)).pop(); if (!slot) return;
    [['m', r.morning], ['e', r.evening]].filter(([k, t]) => t && hm >= t && !done.s.includes(k)).forEach(x => done.s.push(x[0])); S.meta.remindDone = done; DB.set('meta', S.meta);
    const c = this.counts(); if (!c.total) return;
    const body = [c.cards && `${c.cards} 张卡片待复习`, c.wrongs && `${c.wrongs} 道错题该回顾`, c.todos && `${c.todos} 项计划未完成`].filter(Boolean).join('、');
    const o = this.lin(slot[0] === 'm' ? 'am' : 'eve', { body });
    this.notify(slot[0] === 'm' ? '早上好，今天的复习任务' : '晚间复习提醒', o.text, { ...o, href: c.cards ? '#/learn/review/all' : '#/plan', go: c.cards ? '去复习' : '看计划' });
  },
  /** App 在前台：学姐横幅；在后台且允许通知：系统通知（iOS 需添加到主屏幕并允许通知） */
  notify(title, body, o = {}) {
    if (document.visibilityState === 'visible' && typeof linPop === 'function') return linPop({ id: 'linR', mood: o.mood || 'normal', title, text: body, href: o.href, go: o.go });
    try {
      if (S.settings.remind.notify && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'review', data: { url: './' + (o.href || '#/today') } })); return;
      }
    } catch (e) { }
    toast(`🔔 ${title}：${body}`, 4000);
  },
  init() {
    this.update(); setTimeout(() => this.check(), 1500);
    const tt = () => { try { TT.checkReminders(); } catch (e) { } }; setTimeout(tt, 2000);
    setInterval(() => { this.check(); this.update(); tt(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.update(); this.check(); tt(); } });
  },
  // 每天重复的复习提醒事件（浮动本地时间，带闹钟）
  dailyEvents() {
    const r = S.settings.remind; const url = location.href.split('#')[0];
    const d = new Date(); const ds = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const fold = s => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ev = (key, time, title, desc) => { const [h, m] = time.split(':'); const end = new Date(2000, 0, 1, +h, +m + 15); return ['BEGIN:VEVENT', `UID:study-workbench-${key}@local`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${h}${m}00`, `DTEND:${ds}T${pad2(end.getHours())}${pad2(end.getMinutes())}00`, 'RRULE:FREQ=DAILY', `SUMMARY:${fold(title)}`, `DESCRIPTION:${fold(desc + '\n打开学习工作台：' + url)}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${fold(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n'); };
    const evs = [];
    if (r.morning) evs.push(ev('morning', r.morning, '📚 学姐：早安，今天的复习在等你', '林遥学姐提醒你：打开 App 看看今天要复习的卡片、错题和计划。'));
    if (r.evening) evs.push(ev('evening', r.evening, '🌙 学姐：睡前复习 15 分钟', '林遥学姐提醒你：复习到期卡片 + 回顾错题，记忆更牢。复习完就早点睡哦。'));
    return evs;
  },
  ics() { return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//study-workbench//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:学习工作台提醒', ...this.dailyEvents(), 'END:VCALENDAR'].join('\r\n') + '\r\n'; },
  /** 一键：课表 + 临时安排 + 四级考试 + 每日复习提醒，全部带闹钟 */
  allIcs() {
    const items = [...S.courses.flatMap(c => TT.courseItems(c)), ...S.events.filter(e => TT.evTs(e) >= startOfDay()).map(e => TT.evItem(e))];
    try { const cd = Cet.date(); if (cd >= dayKey()) items.push({ uid: 'cet4-' + cd, title: '🅴 大学英语四级考试', note: '带好准考证、身份证、2B 铅笔和耳机。学姐等你的好消息！', ts: dk2ts(cd), allDay: true, remind: 1440 }); } catch (e) { }
    const daily = this.dailyEvents();
    return TT.ics(items, '学习工作台 · 学姐提醒').replace(/END:VCALENDAR\r\n$/, (daily.length ? daily.join('\r\n') + '\r\n' : '') + 'END:VCALENDAR\r\n');
  },
  exportAll() { downloadIcs(this.allIcs(), '学习工作台-学姐提醒.ics'); },
  exportIcs() { downloadIcs(this.ics(), '学习工作台-复习提醒.ics'); }
};
// 下载 / 打开 .ics：iOS Safari 直接打开会弹出「添加到日历」；其他平台下载后导入
function downloadIcs(text, name) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  if (!isIOS()) a.download = name; else a.target = '_blank';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  toast(isIOS() ? '在弹出的日历预览中点「添加」' : '已下载日历文件：打开后导入即可');
}
