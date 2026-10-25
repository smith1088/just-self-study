'use strict';
/* ========== 番茄钟 ========== */
const PHASES = { focus: '专注', short: '短休息', long: '长休息' };
const Focus = {
  st: null, wake: null, actx: null, timer: null, prep: null,
  init() {
    this.st = S.pomoState || { phase: 'focus', running: false, endAt: 0, remainMs: S.settings.pomo.focus * 60000, totalMs: S.settings.pomo.focus * 60000, subject: '', label: '', todoId: '', cycle: 0, startedAt: 0 };
    this.timer = setInterval(() => this.tick(), 500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.tick(); if (this.st.running) this.lockScreen(); } });
    this.tick();
  },
  persist() { S.pomoState = this.st; DB.set('pomoState', this.st); },
  lenOf(p) { const c = S.settings.pomo; return (p === 'focus' ? c.focus : p === 'short' ? c.short : c.long) * 60000; },
  remain() { return this.st.running ? Math.max(0, this.st.endAt - Date.now()) : this.st.remainMs; },
  prepare(o) { if (this.st.running && this.st.phase === 'focus') { toast('正在专注中，已保留当前计时'); return; } Object.assign(this.st, { subject: o.subject || '', label: o.label || '', todoId: o.todoId || '' }); if (this.st.phase !== 'focus') this.setPhase('focus'); this.persist(); },
  setPhase(p) { const L = this.lenOf(p); Object.assign(this.st, { phase: p, running: false, remainMs: L, totalMs: L, endAt: 0, startedAt: 0 }); this.persist(); this.releaseLock(); },
  start() {
    this.unlockAudio();
    if (this.st.remainMs <= 0) this.setPhase(this.st.phase);
    Object.assign(this.st, { running: true, endAt: Date.now() + this.st.remainMs });
    if (!this.st.startedAt) this.st.startedAt = Date.now();
    this.persist(); this.lockScreen();
  },
  pause() { this.st.remainMs = this.remain(); this.st.running = false; this.persist(); this.releaseLock(); },
  reset() { this.setPhase(this.st.phase); },
  stopEarly() {
    // 提前结束专注：记录已专注的时长
    const used = this.st.totalMs - this.remain();
    if (this.st.phase === 'focus' && used >= 60000) this.logSession(used, Date.now(), true);
    this.setPhase('focus');
  },
  logSession(ms, end, partial = false) {
    const min = Math.round(ms / 60000); if (min < 1) return;
    S.sessions.push({ id: uid(), start: end - ms, end, minutes: min, subject: this.st.subject || '', label: this.st.label || '', todoId: this.st.todoId || '', partial });
    save('sessions');
  },
  tick() {
    if (!this.st) return;
    if (this.st.running && Date.now() >= this.st.endAt) this.complete();
    if (location.hash.startsWith('#/focus')) this.paint();
  },
  complete() {
    const st = this.st; const end = st.endAt; const ph = st.phase;
    if (ph === 'focus') { this.logSession(st.totalMs, end); st.cycle = (st.cycle || 0) + 1; }
    const nextP = ph === 'focus' ? (st.cycle % S.settings.pomo.longEvery === 0 ? 'long' : 'short') : 'focus';
    const late = Date.now() - end > 5000;
    this.setPhase(nextP);
    if (!late) this.alarm(ph === 'focus' ? '专注完成！休息一下吧 ☕' : '休息结束，继续加油 💪');
    if (ph === 'focus') { if (!late) Game.focusDone(Math.round(st.totalMs / 60000)); else Game.after(); }
    else toast(ph === 'focus' ? `已完成一次 ${Math.round(st.totalMs / 60000) || ''} 分钟专注` : '休息时间已结束');
    if (S.settings.pomo.autoNext && !late) this.start();
    if (location.hash.startsWith('#/focus')) rerender();
  },
  unlockAudio() {
    try { if (!this.actx) this.actx = new (window.AudioContext || window.webkitAudioContext)(); if (this.actx.state === 'suspended') this.actx.resume(); const o = this.actx.createOscillator(), g = this.actx.createGain(); g.gain.value = 0.0001; o.connect(g).connect(this.actx.destination); o.start(); o.stop(this.actx.currentTime + 0.05); } catch (e) { }
  },
  beep() {
    if (!S.settings.pomo.sound || !this.actx) return;
    const a = this.actx; const t0 = a.currentTime;
    [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((d, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = i % 3 === 2 ? 1046 : 880; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28); o.connect(g).connect(a.destination); o.start(t0 + d); o.stop(t0 + d + 0.3); });
  },
  alarm(msg) {
    this.beep(); try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 500]); } catch (e) { }
    toast(msg, 5000);
    try { if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(r => r.showNotification('学习工作台', { body: msg, icon: 'icons/icon-192.png', tag: 'pomo' })); } catch (e) { }
  },
  async lockScreen() { if (!S.settings.pomo.wakeLock || !('wakeLock' in navigator)) return; try { if (!this.wake) { this.wake = await navigator.wakeLock.request('screen'); this.wake.addEventListener('release', () => this.wake = null); } } catch (e) { } },
  releaseLock() { try { this.wake && this.wake.release(); } catch (e) { } this.wake = null; },
  todayMinutes() { const t0 = startOfDay(); return S.sessions.filter(s => s.end >= t0).reduce((a, s) => a + s.minutes, 0); },
  paint() {
    const r = this.remain(); const el = $('#ptime'); if (!el) return;
    const m = Math.floor(r / 60000), s = Math.floor(r % 60000 / 1000); el.textContent = `${pad2(m)}:${pad2(s)}`;
    const C = 2 * Math.PI * 140; const frac = this.st.totalMs ? r / this.st.totalMs : 0;
    const arc = $('#parc'); if (arc) arc.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
    const hd = $('#phead'); if (hd) { const a = 2 * Math.PI * frac; hd.setAttribute('cx', (150 + 140 * Math.cos(a)).toFixed(2)); hd.setAttribute('cy', (150 + 140 * Math.sin(a)).toFixed(2)); hd.style.opacity = frac > .002 ? 1 : 0; }
    if (this.st.running) document.title = `${pad2(m)}:${pad2(s)} ${PHASES[this.st.phase]} · 学习工作台`;
  }
};
route('/focus', 'focus', v => {
  const F = Focus, st = F.st, c = S.settings.pomo;
  setTop('番茄专注', { actions: `<button class="icon-btn txt" id="pset">设置</button>` });
  const C = 2 * Math.PI * 140;
  const t0 = startOfDay(); const today = S.sessions.filter(s => s.end >= t0).sort((a, b) => b.end - a.end); const tm = today.reduce((a, s) => a + s.minutes, 0);
  const todos = S.todos.filter(t => !t.done).sort(sortTodos).slice(0, 30);
  const started = st.running || st.remainMs < st.totalMs;
  const cap = { focus: '集中 · FOCUS', short: '小休憩 · BREAK', long: '長休憩 · REST' }[st.phase];
  const sub = st.phase === 'focus' ? `第 ${(st.cycle || 0) % c.longEvery + 1} / ${c.longEvery} 个番茄` : st.phase === 'short' ? '站起来走走，看看远处' : '好好放松一下';
  const intent = st.label || (st.todoId ? '' : '');
  const mood = st.running ? (st.phase === 'focus' ? 'normal' : 'sleepy') : tm >= c.dailyGoal ? 'happy' : 'encourage';
  const line = st.running ? (st.phase === 'focus' ? '专注中，我在旁边陪你。手机先放一边吧。' : '休息一下，喝口水，看看窗外。') : started ? '暂停了也没关系，准备好再继续。' : tm >= c.dailyGoal ? '今天的专注目标已经完成，真厉害。' : tm ? `今天已专注 ${fmtMin(tm)}，再来一个番茄？` : '准备好了就开始吧，25 分钟就好。';
  if (!$('#frSky')) document.body.insertAdjacentHTML('afterbegin', `<div id="frSky" aria-hidden="true"><i class="fs-glow"></i><i class="fs-stars"></i>${Array.from({ length: 9 }, (_, i) => `<i class="fs-p" style="--x:${(i * 37 + 7) % 100}%;--d:${16 + (i * 7) % 11}s;--dl:-${(i * 5.3) % 17}s;--s:${.7 + (i % 3) * .2}"></i>`).join('')}</div>`);
  v.innerHTML = `<div class="fr ph-${st.phase} ${st.running ? 'is-run' : ''}">
  <div class="seg fr-seg" id="ph">${Object.entries(PHASES).map(([k, l]) => `<button data-p="${k}" class="${st.phase === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="fr-timer"><svg viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="frg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="fr-g1"/><stop offset="1" class="fr-g2"/></linearGradient></defs>
    <circle class="fr-tick" cx="150" cy="150" r="128" fill="none" stroke-width="1" stroke-dasharray="1 9.05"/>
    <circle class="fr-track" cx="150" cy="150" r="140" fill="none" stroke-width="2"/>
    <circle id="parc" cx="150" cy="150" r="140" fill="none" stroke="url(#frg)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" style="transition:stroke-dashoffset .5s linear"/>
    <circle id="phead" class="fr-head" cx="290" cy="150" r="5.5"/></svg>
    <div class="fr-c"><div class="fr-cap">${cap}</div><div class="fr-time num" id="ptime">--:--</div><div class="fr-sub">${sub}</div>${intent ? `<div class="fr-int">「${esc(intent)}」</div>` : ''}</div></div>
  <div class="fr-ctl"><button class="fr-ic" id="reset" aria-label="重置">${icon('reset', 20)}</button>
    ${st.running ? `<button class="fr-main" id="pause">暂停</button>` : `<button class="fr-main" id="start">${started ? '继续' : st.phase === 'focus' ? '开始专注' : '开始休息'}</button>`}
    ${st.phase === 'focus' && started ? `<button class="fr-ic" id="stop" aria-label="结束并记录">${icon('check', 20)}</button>` : `<button class="fr-ic" id="skip" aria-label="${st.phase === 'focus' ? '跳到休息' : '跳过休息'}">${icon('next', 20)}</button>`}</div>
  <div class="fr-ctl-l"><span>重置</span><span></span><span>${st.phase === 'focus' && started ? '结束并记录' : st.phase === 'focus' ? '跳到休息' : '跳过休息'}</span></div>
  ${Game.vn({ mood, text: line, art: 96, cap: st.running ? 'いっしょに' : 'せんぱい', cls: 'vn-focus' })}
  <div class="card fr-card"><div class="fr-h">这一轮<em>今回の目標</em></div><div class="grid2"><label class="f" style="margin:0"><span>科目</span><select id="psub">${subjOptions(st.subject)}</select></label>
  <label class="f" style="margin:0"><span>关联计划</span><select id="ptodo"><option value="">不关联</option>${todos.map(t => `<option value="${t.id}" ${t.id === st.todoId ? 'selected' : ''}>${esc(t.title.slice(0, 20))}</option>`).join('')}</select></label></div>
  <label class="f" style="margin:10px 0 0"><span>专注内容（可选）</span><input type="text" id="plabel" value="${esc(st.label)}" placeholder="例如：背 50 个单词"></label></div>
  <div class="card fr-card"><div class="fr-h">今日专注<em>今日の記録</em><span class="fr-tot num">${fmtMin(tm)}<small> / ${fmtMin(c.dailyGoal)}</small></span></div><div class="fr-bar"><i style="width:${Math.min(100, tm / c.dailyGoal * 100)}%"></i></div>
  ${today.length ? `<div class="fr-list">${today.slice(0, 12).map(s => `<div class="fr-row"><span class="dot" style="background:${subj(s.subject).color}"></span><div class="grow">${esc(s.label || subj(s.subject).name)}</div><span class="num">${fmtDateTime(s.start).split(' ')[1]}</span><b class="num">${s.minutes}<small> 分钟</small></b>${s.partial ? '<em>提前</em>' : ''}</div>`).join('')}</div>` : '<div class="fr-empty">今天还没有专注记录，开始第一个番茄吧</div>'}</div>
  <p class="fr-note">计时按结束时间计算，锁屏或切换应用后依然准确。iOS 后台无法播放提示音，专注时请保持屏幕常亮。</p></div>`;
  F.paint();
  $('#ph').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.p === st.phase) return; if (st.running && !confirm('切换会重置当前计时，确定吗？')) return; F.setPhase(b.dataset.p); rerender(); };
  const st_ = $('#start'); if (st_) st_.onclick = () => { F.start(); rerender(); };
  const pa = $('#pause'); if (pa) pa.onclick = () => { F.pause(); rerender(); };
  const sp = $('#stop'); if (sp) sp.onclick = () => { const used = st.totalMs - F.remain(); F.stopEarly(); toast(used >= 60000 ? `已记录 ${Math.round(used / 60000)} 分钟` : '不足 1 分钟，未记录'); rerender(); };
  const sk = $('#skip'); if (sk) sk.onclick = () => { F.setPhase(st.phase === 'focus' ? 'short' : 'focus'); rerender(); };
  $('#reset').onclick = () => { F.reset(); rerender(); };
  $('#psub').onchange = e => { st.subject = e.target.value; F.persist(); };
  $('#ptodo').onchange = e => { st.todoId = e.target.value; const t = S.todos.find(x => x.id === st.todoId); if (t) { st.subject = t.subject || st.subject; st.label = t.title; } F.persist(); rerender(); };
  $('#plabel').oninput = e => { st.label = e.target.value; F.persist(); };
  $('#pset').onclick = () => openSheet(`<h2>番茄钟设置</h2>
    <div class="grid3"><label class="f"><span>专注(分)</span><input type="number" inputmode="numeric" id="sf" value="${c.focus}"></label><label class="f"><span>短休息(分)</span><input type="number" inputmode="numeric" id="ss" value="${c.short}"></label><label class="f"><span>长休息(分)</span><input type="number" inputmode="numeric" id="sl" value="${c.long}"></label></div>
    <div class="grid2"><label class="f"><span>每几个番茄长休息</span><input type="number" inputmode="numeric" id="se" value="${c.longEvery}"></label><label class="f"><span>每日目标(分)</span><input type="number" inputmode="numeric" id="sg" value="${c.dailyGoal}"></label></div>
    <div class="list">${[['sa', '自动开始下一阶段', c.autoNext], ['so', '结束提示音', c.sound], ['sw', '计时时保持屏幕常亮', c.wakeLock]].map(([id, l, on]) => `<div class="row"><div class="grow">${l}</div><label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></label></div>`).join('')}</div>
    <div class="chips" style="margin-bottom:12px">${[[25, 5], [45, 10], [50, 10], [15, 3]].map(([a, b]) => `<button class="chip" data-a="${a}" data-b="${b}">${a}+${b}</button>`).join('')}</div>
    <div class="btns"><button class="btn plain" id="test">试听提示音</button><button class="btn" id="ok">保存</button></div>`, el => {
    $('.chips', el).onclick = e => { const b = e.target.closest('button'); if (b) { $('#sf', el).value = b.dataset.a; $('#ss', el).value = b.dataset.b; } };
    $('#test', el).onclick = () => { F.unlockAudio(); setTimeout(() => F.beep(), 80); };
    $('#ok', el).onclick = () => {
      const clamp = (x, a, b, d) => { x = Math.round(+x); return x >= a && x <= b ? x : d; };
      Object.assign(c, { focus: clamp($('#sf', el).value, 1, 180, 25), short: clamp($('#ss', el).value, 1, 60, 5), long: clamp($('#sl', el).value, 1, 90, 15), longEvery: clamp($('#se', el).value, 1, 12, 4), dailyGoal: clamp($('#sg', el).value, 10, 1440, 120), autoNext: $('#sa', el).checked, sound: $('#so', el).checked, wakeLock: $('#sw', el).checked });
      saveSettings(); if (!st.running) F.setPhase(st.phase); closeSheet(); rerender();
    };
  });
});
