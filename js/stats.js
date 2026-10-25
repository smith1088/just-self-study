'use strict';
/* ========== 统计 ========== */
const Stats = {
  focusByDay(days) { const m = {}; S.sessions.forEach(s => { const k = dayKey(s.end); m[k] = (m[k] || 0) + s.minutes; }); return m; },
  activeDays() { const set = new Set(); S.sessions.forEach(s => set.add(dayKey(s.end))); S.reviews.forEach(r => set.add(dayKey(r.t))); S.todos.forEach(t => t.doneAt && set.add(dayKey(t.doneAt))); S.exams.forEach(e => e.submittedAt && set.add(dayKey(e.submittedAt))); (S.meta?.game?.frozen || []).forEach(k => set.add(k)); return set; },
  streak() { const set = this.activeDays(); let d = startOfDay(); if (!set.has(dayKey(d))) d -= DAY; let n = 0; while (set.has(dayKey(d))) { n++; d -= DAY; } return n; },
  bestStreak() { const days = [...this.activeDays()].sort(); let best = 0, cur = 0, prev = null; for (const k of days) { const t = new Date(k + 'T00:00').getTime(); cur = prev !== null && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = t; } return best; },
  reviewsSince(t0) { return S.reviews.filter(r => r.t >= t0 && r.kind !== 'wrong').length; }
};
function hmHtml(m) { m = Math.round(m); if (m < 60) return `${m}<small> 分钟</small>`; const h = Math.floor(m / 60), r = m % 60; return `${h}<small> 小时</small>${r ? ` ${r}<small> 分</small>` : ''}`; }
function barsHtml(days, map, color = 'var(--c-focus)') {
  const arr = []; for (let i = days - 1; i >= 0; i--) { const t = startOfDay() - i * DAY; arr.push([t, map[dayKey(t)] || 0]); }
  const vals = arr.map(a => a[1]); const avg = Math.round(vals.reduce((a, b) => a + b, 0) / days);
  const labels = arr.map(([t], i) => { const d = new Date(t); return days <= 7 ? WEEK[d.getDay()] : (i % 7 === 0 || i === arr.length - 1 ? `${d.getMonth() + 1}/${d.getDate()}` : ''); });
  return stChart(vals, labels, { color, avg: avg || null, avgLabel: '平均', h: 150 });
}
let statsRange = 7;
route('/me/stats', 'me', v => {
  setTop('学习统计', { back: '#/me', actions: `<button class="icon-btn" id="addS" aria-label="补记">＋</button>` });
  const map = Stats.focusByDay(); const t0 = startOfDay(); const r0 = t0 - (statsRange - 1) * DAY;
  const inRange = S.sessions.filter(s => s.end >= r0); const rangeMin = inRange.reduce((a, s) => a + s.minutes, 0);
  const totalMin = S.sessions.reduce((a, s) => a + s.minutes, 0);
  const revs = S.reviews.filter(r => r.t >= r0 && r.kind !== 'wrong'); const good = revs.filter(r => r.r >= 3).length;
  const bySub = {}; inRange.forEach(s => bySub[s.subject || ''] = (bySub[s.subject || ''] || 0) + s.minutes);
  const subMax = Math.max(1, ...Object.values(bySub));
  const exams = S.exams.filter(e => e.status === 'graded'); const avg = exams.length ? Math.round(exams.reduce((a, e) => { const t = examTotals(e); return a + (t.max ? t.score / t.max : 0); }, 0) / exams.length * 100) : null;
  // 热力图：最近 12 周
  const start = startOfDay() - (7 * 11 + new Date().getDay()) * DAY; const act = {}; S.sessions.forEach(s => act[dayKey(s.end)] = (act[dayKey(s.end)] || 0) + s.minutes); S.reviews.forEach(r => act[dayKey(r.t)] = (act[dayKey(r.t)] || 0) + 0.5);
  let heat = ''; for (let t = start; t <= startOfDay(); t += DAY) { const m = act[dayKey(t)] || 0; heat += `<i class="${m ? (m < 15 ? 'l1' : m < 45 ? 'l2' : m < 90 ? 'l3' : 'l4') : ''}" title="${dayKey(t)}"></i>`; }
  const avgMin = Math.round(rangeMin / statsRange);
  v.innerHTML = `<div class="seg" id="rg"><button data-r="7" class="${statsRange === 7 ? 'on' : ''}">近 7 天</button><button data-r="30" class="${statsRange === 30 ? 'on' : ''}">近 30 天</button></div>
    <div class="card st-main"><div class="chart-h"><div><div class="s5-k">日均专注</div><div class="ch-v num">${hmHtml(avgMin)}</div></div><div class="s5-k r">共 <b class="num">${fmtMin(rangeMin)}</b></div></div>${barsHtml(statsRange, map)}</div>
    <div class="trends">
      <div class="tr" style="--c:var(--c-focus)"><span class="tr-ic">${icon('clock', 15)}</span><div><div class="tr-k">今日专注</div><div class="tr-v num">${hmHtml(map[dayKey()] || 0)}</div></div></div>
      <div class="tr" style="--c:var(--c-streak)"><span class="tr-ic">${icon('flame', 15)}</span><div><div class="tr-k">连续学习</div><div class="tr-v num">${Stats.streak()}<small> 天</small></div></div></div>
      <div class="tr" style="--c:var(--c-cards)"><span class="tr-ic">${icon('cards', 15)}</span><div><div class="tr-k">今日复习</div><div class="tr-v num">${Stats.reviewsSince(t0)}<small> 张</small></div></div></div>
      <div class="tr" style="--c:var(--c-xp)"><span class="tr-ic">${icon('stats', 15)}</span><div><div class="tr-k">累计专注</div><div class="tr-v num">${(totalMin / 60).toFixed(1)}<small> 小时</small></div></div></div>
    </div>
    <div class="card"><b>科目分布</b>${Object.keys(bySub).length ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([k, m]) => `<div class="hbar"><span class="lab">${esc(subj(k).name)}</span><span class="track"><i style="width:${m / subMax * 100}%;background:${subj(k).color}"></i></span><span class="val">${fmtMin(m)}</span></div>`).join('') : '<div class="small muted" style="margin-top:8px">这段时间还没有专注记录</div>'}</div>
    <div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="v">${revs.length}</div><div class="l">复习卡片</div></div><div class="stat"><div class="v">${revs.length ? Math.round(good / revs.length * 100) + '%' : '—'}</div><div class="l">记住率</div></div><div class="stat"><div class="v">${S.todos.filter(t => t.doneAt && t.doneAt >= r0).length}</div><div class="l">完成计划</div></div>
    <div class="stat"><div class="v">${inRange.length}</div><div class="l">番茄数</div></div><div class="stat"><div class="v">${avg === null ? '—' : avg + '%'}</div><div class="l">试卷平均得分率</div></div><div class="stat"><div class="v">${S.wrongs.filter(w => w.mastered).length}/${S.wrongs.length}</div><div class="l">错题已掌握</div></div></div>
    <div class="card"><b>学习热力图</b><span class="small muted">（近 12 周）</span><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:8px 0 4px">${WEEK.map(w => `<span class="small muted" style="text-align:center">${w}</span>`).join('')}</div><div class="heat">${heat}</div></div>
    <h3>最近专注记录</h3>${S.sessions.length ? `<div class="list">${S.sessions.slice().sort((a, b) => b.end - a.end).slice(0, 20).map(s => `<div class="row" data-id="${s.id}"><span class="dot" style="background:${subj(s.subject).color}"></span><div class="grow"><div class="t">${esc(s.label || subj(s.subject).name)}</div><div class="s">${fmtDateTime(s.start)} · ${esc(subj(s.subject).name)}${s.manual ? ' · 补记' : ''}</div></div><b>${s.minutes}′</b></div>`).join('')}</div>` : '<div class="empty">暂无记录</div>'}`;
  $('#rg').onclick = e => { const b = e.target.closest('button'); if (b) { statsRange = +b.dataset.r; rerender(); } };
  const addS = () => openSheet(`<h2>补记学习时长</h2><div class="grid2"><label class="f"><span>日期</span><input type="date" id="sd" value="${dayKey()}"></label><label class="f"><span>分钟</span><input type="number" id="sm" inputmode="numeric" value="30"></label></div><label class="f"><span>科目</span><select id="ss">${subjOptions('')}</select></label><label class="f"><span>内容</span><input type="text" id="sl" placeholder="可选"></label><button class="btn block" id="ok">保存</button>`, el => {
    $('#ok', el).onclick = () => { const m = Math.round(+$('#sm', el).value); if (!(m > 0 && m <= 1440)) return toast('请输入有效分钟数'); const d = $('#sd', el).value || dayKey(); const end = d === dayKey() ? Date.now() : new Date(d + 'T20:00').getTime(); S.sessions.push({ id: uid(), start: end - m * 60000, end, minutes: m, subject: $('#ss', el).value, label: $('#sl', el).value.trim(), manual: true }); save('sessions'); closeSheet(); rerender(); };
  });
  $('#addS').onclick = addS;
  v.querySelectorAll('.row[data-id]').forEach(r => r.onclick = async () => { const s = S.sessions.find(x => x.id === r.dataset.id); if (s && await confirmBox(`删除这条 ${s.minutes} 分钟的记录？`, '删除')) { S.sessions = S.sessions.filter(x => x !== s); save('sessions'); rerender(); } });
});
