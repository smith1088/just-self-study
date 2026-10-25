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
    const set = (tab, n) => { const a = $(`#tabbar a[data-tab=${tab}]`); if (!a) return; let b = a.querySelector('.badge'); if (!on || !n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'badge'; a.querySelector('.ti').appendChild(b); } b.textContent = n > 99 ? '99+' : n; };
    set('plan', c.todos); set('learn', c.cards + c.wrongs);
    try { if (navigator.setAppBadge) { on && c.total ? navigator.setAppBadge(c.total) : navigator.clearAppBadge?.(); } } catch (e) { }
    return c;
  },
  bannerHtml() {
    if (!S.settings.remind.enabled) return '';
    const c = this.counts(); if (!c.total) return '';
    const parts = []; if (c.cards) parts.push(`<a href="#/learn/review/all"><b>${c.cards}</b> 张卡片待复习</a>`); if (c.wrongs) parts.push(`<a href="#/learn/wrong-review"><b>${c.wrongs}</b> 道错题该回顾</a>`); if (c.todos) parts.push(`<a href="#/plan"><b>${c.todos}</b> 项计划${c.overdue ? `（${c.overdue} 项已逾期）` : ''}</a>`);
    return `<div class="remind-banner">${icon('bell', 20)}<div>今日待办：${parts.join('、')}</div></div>`;
  },
  // 每天早晚两个时间点，在 App 打开状态下提醒一次
  check() {
    const r = S.settings.remind; if (!r.enabled || document.visibilityState !== 'visible') return;
    const now = new Date(); const hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes()); const today = dayKey();
    const done = S.meta.remindDone && S.meta.remindDone.d === today ? S.meta.remindDone : { d: today, s: [] };
    const slot = [['m', r.morning], ['e', r.evening]].filter(([k, t]) => t && hm >= t && !done.s.includes(k)).pop(); if (!slot) return;
    done.s.push(...[['m', r.morning], ['e', r.evening]].filter(([k, t]) => t && hm >= t).map(x => x[0])); S.meta.remindDone = done; DB.set('meta', S.meta);
    const c = this.counts(); if (!c.total) return;
    const body = [c.cards && `${c.cards} 张卡片待复习`, c.wrongs && `${c.wrongs} 道错题该回顾`, c.todos && `${c.todos} 项计划未完成`].filter(Boolean).join('，');
    this.notify(slot[0] === 'm' ? '早上好，今天的复习任务' : '晚间复习提醒', body);
  },
  notify(title, body) {
    let shown = false;
    try {
      if (S.settings.remind.notify && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'review', data: { url: './#/today' } })); shown = true;
      }
    } catch (e) { }
    if (!shown || document.visibilityState === 'visible') toast(`🔔 ${title}：${body}`, 4000);
  },
  init() {
    this.update(); setTimeout(() => this.check(), 1500);
    setInterval(() => { this.check(); this.update(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.update(); this.check(); } });
  },
  // 生成 iCalendar 文件：每天固定时间重复的提醒事件（浮动本地时间，带闹钟）
  ics() {
    const r = S.settings.remind; const url = location.href.split('#')[0];
    const d = new Date(); const ds = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const fold = s => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ev = (key, time, title, desc) => { const [h, m] = time.split(':'); const end = new Date(2000, 0, 1, +h, +m + 15); return ['BEGIN:VEVENT', `UID:study-workbench-${key}@local`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${h}${m}00`, `DTEND:${ds}T${pad2(end.getHours())}${pad2(end.getMinutes())}00`, 'RRULE:FREQ=DAILY', `SUMMARY:${fold(title)}`, `DESCRIPTION:${fold(desc + '\n打开学习工作台：' + url)}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${fold(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n'); };
    const evs = [];
    if (r.morning) evs.push(ev('morning', r.morning, '📚 学习工作台 · 今日复习', '打开 App 查看今天要复习的卡片、错题和计划。'));
    if (r.evening) evs.push(ev('evening', r.evening, '🌙 学习工作台 · 晚间复习', '睡前 15 分钟：复习到期卡片 + 回顾错题，记忆更牢。'));
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//study-workbench//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:学习工作台提醒', ...evs, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  },
  async exportIcs() {
    const name = '学习工作台-复习提醒.ics'; const blob = new Blob([this.ics()], { type: 'text/calendar;charset=utf-8' });
    const file = new File([blob], name, { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    // iOS Safari 直接打开 .ics 会弹出「添加到日历」；其他平台下载文件后双击导入
    if (!isIOS()) a.download = name; else a.target = '_blank';
    void file; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    toast(isIOS() ? '在弹出的日历预览中点「添加全部」' : '已下载日历文件：打开后导入即可');
  }
};
