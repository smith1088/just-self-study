'use strict';
/* ========== 每周学习报告：数据汇总 + 学姐点评 + Canvas 生成分享图（不含 API Key、聊天记录或记忆） ========== */
const Report = {
  weekStart(off = 0) { const d = new Date(startOfDay()); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w + off * 7); return d.getTime(); },
  key(ws) { return dayKey(ws); },
  data(ws) {
    const we = ws + 7 * DAY, inR = t => t >= ws && t < we;
    const days = [...Array(7)].map((_, i) => ws + i * DAY);
    const fDay = days.map(d => S.sessions.filter(s => s.end >= d && s.end < d + DAY).reduce((a, s) => a + (+s.minutes || 0), 0));
    const deckId = Cet.cfg().deckId;
    const xp = Game.xpByDay(); const pts = Lin.cfg().pts || {};
    const aff = Math.floor(days.reduce((a, d) => { const k = dayKey(d); return a + Math.min(+xp[k] || 0, 60) / 2 + Math.min(+pts[k] || 0, 5); }, 0));
    return {
      ws, we, days, fDay, focus: fDay.reduce((a, b) => a + b, 0),
      cards: S.reviews.filter(r => inR(r.t) && r.kind !== 'wrong').length,
      wrongs: S.reviews.filter(r => inR(r.t) && r.kind === 'wrong').length,
      tasks: S.todos.filter(t => t.done && inR(t.doneAt)).length,
      exams: S.exams.filter(e => e.status === 'graded' && inR(e.submittedAt)).length,
      words: deckId ? S.reviews.filter(r => inR(r.t) && r.wasNew && r.deckId === deckId).length : 0,
      xp: days.reduce((a, d) => a + (+xp[dayKey(d)] || 0), 0),
      active: fDay.filter((m, i) => m > 0 || (xp[dayKey(days[i])] || 0) > 0).length,
      streak: Game.streak(), aff, lv: Lin.level().name, cetDays: Cet.daysLeft()
    };
  },
  /* 模板点评（无 Key 或 AI 失败时） */
  tpl(d) {
    const n = Lin.nick(), ro = Lin.romance(), h = Math.round(d.focus / 6) / 10;
    if (!d.active) return { mood: 'pout', text: `这周好像没怎么见到你呢……没关系，${n}，下周我们从每天一个 25 分钟开始，好不好？` };
    if (d.active >= 6) return { mood: 'proud', text: `这周学了 ${d.active} 天、专注 ${h} 小时，${n}真的太棒了！${ro ? '我都忍不住想夸你一整天。' : '继续保持这个节奏！'}下周也记得好好睡觉哦。` };
    if (d.focus >= 300 || d.cards >= 150) return { mood: 'cheer', text: `专注 ${h} 小时、复习 ${d.cards} 张卡片，进步看得见！下周试试把学习分散到每一天，会更轻松。` };
    return { mood: 'encourage', text: `这周学习了 ${d.active} 天，已经很不错啦。下周多来几天，哪怕每天 20 分钟，也会积少成多。${ro ? '我会一直陪着你的。' : ''}` };
  },
  async aiComment(d, signal) {
    const sys = `你是「林遥」，一位温柔、聪明、偶尔调皮的大学学姐，正在给学弟/学妹写本周学习报告的点评。${Lin.romance() ? '语气亲切、带一点点甜，' : '语气像亲切的学习伙伴，'}内容健全；不编造数据；60–90 字中文，1–2 句表扬 + 1 句具体建议；不要用 markdown、不要表情标签。`;
    const facts = `称呼：${Lin.nick()}\n本周专注 ${d.focus} 分钟，学习 ${d.active}/7 天，复习卡片 ${d.cards} 张，回顾错题 ${d.wrongs} 道，完成计划 ${d.tasks} 项，交卷 ${d.exams} 份，四级新词 ${d.words} 个，距四级 ${d.cetDays} 天，连续学习 ${d.streak} 天。每日专注分钟：${d.fDay.join(',')}`;
    const r = await AI.chat([{ role: 'system', content: sys }, { role: 'user', content: facts }], { signal, temperature: 0.8, maxTokens: 300 });
    const t = String(r || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\[[^\]]{0,20}\]|[#*`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!t) throw new Error('empty'); return { mood: d.active >= 5 ? 'proud' : 'happy', text: t };
  },
  /* ---- Canvas 分享图 1080×1440 ---- */
  async draw(d, c) {
    const W = 1080, H = 1440, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const F = (w, s) => `${w} ${s}px -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
    let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#EEE9FF'); g.addColorStop(.55, '#FBEAF3'); g.addColorStop(1, '#FFF4E8'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 樱花点缀
    const rnd = (i => () => ((i = (i * 9301 + 49297) % 233280) / 233280))(d.ws / DAY | 0);
    for (let i = 0; i < 26; i++) { x.save(); x.globalAlpha = .18 + rnd() * .25; x.fillStyle = i % 2 ? '#F7A8C8' : '#C9B8FF'; x.translate(rnd() * W, rnd() * H); x.rotate(rnd() * 6); x.beginPath(); x.ellipse(0, 0, 10 + rnd() * 12, 6 + rnd() * 6, 0, 0, 7); x.fill(); x.restore(); }
    const img = new Image(); img.src = MASCOT.src(c.mood || 'happy'); try { await img.decode(); x.drawImage(img, W - 520, 40, 520, 520); } catch (e) { }
    x.fillStyle = '#7B6BD6'; x.font = F(700, 30); x.fillText('WEEKLY REPORT · 学习周报', 72, 110);
    x.fillStyle = '#1D1B2E'; x.font = F(800, 76); x.fillText(d.ws === Report.weekStart(-1) ? '上周学习报告' : d.ws === Report.weekStart(0) ? '本周学习报告' : '学习周报', 72, 210);
    const a = new Date(d.ws), b = new Date(d.we - DAY); x.fillStyle = '#6B6880'; x.font = F(500, 34); x.fillText(`${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日 · 学习 ${d.active}/7 天`, 72, 270);
    x.fillStyle = '#1D1B2E'; x.font = F(800, 120); const hh = Math.floor(d.focus / 60), mm = d.focus % 60; const fs = hh ? `${hh}` : `${mm}`; x.fillText(fs, 72, 440); const fw = x.measureText(fs).width;
    x.font = F(600, 40); x.fillStyle = '#6B6880'; x.fillText(hh ? `小时 ${mm} 分钟 专注` : '分钟 专注', 72 + fw + 14, 440);
    // 7 天柱状图
    const mx = Math.max(30, ...d.fDay), bx = 72, by = 500, bw = 430, bh = 120;
    d.fDay.forEach((m, i) => { const h = Math.max(6, m / mx * bh), X = bx + i * (bw / 7); const gg = x.createLinearGradient(0, by + bh - h, 0, by + bh); gg.addColorStop(0, '#8B7CF6'); gg.addColorStop(1, '#F28DB5'); x.fillStyle = m ? gg : 'rgba(120,110,160,.18)'; rr(X, by + bh - h, bw / 7 - 16, h, 10); x.fill(); x.fillStyle = '#8A87A0'; x.font = F(500, 24); x.fillText('一二三四五六日'[i], X + (bw / 7 - 16) / 2 - 12, by + bh + 36); });
    // 统计格子
    const tiles = [['复习卡片', d.cards, '张', '#3B82F6'], ['完成计划', d.tasks, '项', '#34C759'], ['连续学习', d.streak, '天', '#FF9F0A'], ['四级新词', d.words, '个', '#10B981'], ['距离四级', d.cetDays, '天', '#EC4899'], ['好感度', '+' + d.aff, d.lv, '#F2679B']];
    tiles.forEach(([k, v, u, col], i) => {
      const X = 72 + (i % 3) * 318, Y = 700 + Math.floor(i / 3) * 190; x.fillStyle = 'rgba(255,255,255,.78)'; rr(X, Y, 300, 170, 32); x.fill();
      x.fillStyle = col; rr(X + 28, Y + 30, 12, 12, 6); x.fill(); x.fillStyle = '#6B6880'; x.font = F(600, 28); x.fillText(k, X + 52, Y + 44);
      x.fillStyle = '#1D1B2E'; x.font = F(800, 64); x.fillText(String(v), X + 28, Y + 128); const vw = x.measureText(String(v)).width; x.fillStyle = '#8A87A0'; x.font = F(600, 28); x.fillText(u, X + 36 + vw, Y + 128);
    });
    // 学姐点评
    const cy = 1090; x.fillStyle = 'rgba(255,255,255,.88)'; rr(72, cy, W - 144, 250, 36); x.fill(); x.strokeStyle = 'rgba(139,124,246,.35)'; x.lineWidth = 3; rr(72, cy, W - 144, 250, 36); x.stroke();
    x.font = F(700, 28); const tw = x.measureText('林遥学姐 · 点评').width + 52; g = x.createLinearGradient(104, 0, 104 + tw, 0); g.addColorStop(0, '#8B7CF6'); g.addColorStop(1, '#F28DB5'); x.fillStyle = g; rr(104, cy - 26, tw, 54, 27); x.fill(); x.fillStyle = '#fff'; x.fillText('林遥学姐 · 点评', 130, cy + 10);
    x.fillStyle = '#2A2740'; x.font = F(500, 34); let line = '', ly = cy + 82; const maxW = W - 220;
    for (const ch of c.text) { if (x.measureText(line + ch).width > maxW) { x.fillText(line, 108, ly); line = ch; ly += 50; if (ly > cy + 230) break; } else line += ch; }
    if (ly <= cy + 230) x.fillText(line, 108, ly);
    x.fillStyle = '#9A97AE'; x.font = F(500, 24); x.fillText('学习工作台 · 和林遥学姐一起学习', 72, H - 44);
    return cv;
  }
};
route('/me/report', 'me', v => {
  setTop('每周学习报告', { back: '#/me' });
  const off = Q.get('w') === 'last' ? -1 : 0; const ws = Report.weekStart(off), d = Report.data(ws), k = Report.key(ws);
  const store = S.meta.reports || (S.meta.reports = {});
  if (off === -1 || new Date().getDay() === 1) { S.meta.reportSeen = Report.key(Report.weekStart(-1)); DB.set('meta', S.meta); }
  let c = store[k] && store[k].f === `${d.focus}/${d.cards}/${d.tasks}` ? store[k] : null; let url = '', ctl = null, blob = null;
  v.innerHTML = `<div class="seg rp-seg"><a class="${off ? '' : 'on'}" href="#/me/report">本周</a><a class="${off ? 'on' : ''}" href="#/me/report?w=last">上周</a></div>
    <div class="rp-card" id="rpCard"><div class="rp-ph">正在生成…</div></div>
    <div class="btns"><button class="btn" id="rpShare">${icon('share', 18)} 分享 / 保存图片</button></div>
    <p class="small muted rp-tip">长按图片也可以「存储到照片」，再发到朋友圈。图片里只有学习数据和学姐的点评，不含 API Key、聊天记录或她记得的事。</p>
    <div class="btns">${AI.ready() ? `<button class="btn plain" id="rpAI">${icon('sparkle', 16)} 让学姐重新写点评</button>` : ''}</div>`;
  const paint = async () => {
    const cv = await Report.draw(d, c || Report.tpl(d)); blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!document.body.contains(v) || !$('#rpCard')) return; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
    $('#rpCard').innerHTML = `<img src="${url}" alt="本周学习报告：专注 ${d.focus} 分钟，复习 ${d.cards} 张卡片，完成 ${d.tasks} 项计划，连续学习 ${d.streak} 天">`;
  };
  const gen = async force => {
    if (!AI.ready() || !navigator.onLine || (c && !force)) return;
    ctl = new AbortController(); const b = $('#rpAI'); if (b) b.disabled = true;
    try { c = await Report.aiComment(d, ctl.signal); store[k] = { ...c, f: `${d.focus}/${d.cards}/${d.tasks}` }; Object.keys(store).sort().slice(0, -12).forEach(x => delete store[x]); DB.set('meta', S.meta); await paint(); }
    catch (e) { if (force && e?.kind !== 'abort') toast('学姐暂时没想好，先用默认点评'); }
    finally { if (b) b.disabled = false; }
  };
  paint().then(() => gen(false));
  $('#rpShare').onclick = async () => {
    if (!blob) return; const name = `学习周报-${k}.png`; const file = new File([blob], name, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '本周学习报告' }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('已保存图片');
  };
  const ai = $('#rpAI'); if (ai) ai.onclick = () => gen(true);
  return () => { ctl?.abort(); setTimeout(() => url && URL.revokeObjectURL(url), 1000); };
});
