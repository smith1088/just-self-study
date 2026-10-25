'use strict';
/* ========== 今日 / 学习 / 我的 / 设置 / 启动 ========== */
function greet() { const h = new Date().getHours(); return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let _rid = 0;
function ring(pct, size = 76, stroke = 8, color = 'var(--pri)') { const r = (size - stroke) / 2, c = 2 * Math.PI * r; let defs = '', st = color; if (color === 'grad') { const id = 'rg' + (++_rid); defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--pri2)"/><stop offset="1" stop-color="var(--pri)"/></linearGradient></defs>`; st = `url(#${id})`; } return `<svg class="pring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${st}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, pct)))}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fg" style="--c:${c}"/></svg>`; }
route('/today', 'today', v => {
  setTop('今日');
  const tm = Focus.todayMinutes(); const due = Cards.dueTotal();
  const todos = S.todos.filter(t => !t.done && t.due && t.due <= dayKey()).sort(sortTodos);
  const doneToday = S.todos.filter(t => t.done && t.doneAt >= startOfDay()).length;
  const wr = S.wrongs.filter(w => !w.mastered).length; const st = Focus.st;
  const d = new Date();
  const lv = Game.level(), sk = Game.streak();
  const revToday = Stats.reviewsSince(startOfDay());
  const R = Game.ringItems(); const closed = R.filter(r => r.p >= 1).length;
  const quests = [['focus', 'var(--c-focus)', '专注 25 分钟', Math.min(tm, 25), 25, '分钟', '#/focus'], ['cards', 'var(--c-cards)', '复习 20 张卡片', Math.min(revToday, 20), 20, '张', '#/learn/review/all'], ['check', 'var(--c-plan)', '完成 3 项计划', Math.min(doneToday, 3), 3, '项', '#/plan']];
  const qDone = quests.filter(q => q[3] >= q[4]).length;
  const ins = Game.insights();
  const status = closed === 3 ? '三个圆环全部合拢，今天很出色。' : closed ? `已合拢 ${closed} 个圆环，再接再厉。` : Game.studiedToday() ? '今天已开始学习，继续保持。' : '从一次 25 分钟的专注开始今天。';
  v.innerHTML = `<header class="t5-head"><div><div class="t5-date">${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}</div><h2 class="large-title">${greet()}${S.settings.name ? '，' + esc(S.settings.name) : ''}</h2></div><a class="t5-av" href="#/me" aria-label="我的">${esc((S.settings.name || '学').slice(0, 1))}</a></header>
  ${isIOS() && !isStandalone() && !S.meta.hideInstall ? `<div class="notice info" id="inst"><b>添加到主屏幕</b>：点 Safari 底部的「分享」按钮，选择「添加到主屏幕」，即可像 App 一样全屏使用、离线可用。<button class="btn small plain" id="hideInst" style="margin-top:8px">不再提示</button></div>` : ''}
  ${Remind.bannerHtml()}
  ${st.running ? `<a class="card focus-live" href="#/focus">${icon('focus', 28)}<div style="flex:1"><b>${PHASES[st.phase]}进行中</b><div class="small" style="opacity:.9">${esc(st.label || subj(st.subject).name)}</div></div><b id="tdTime" class="mono" style="font-size:24px"></b></a>` : ''}
  ${secHead('活动', '#/me/stats')}
  <a class="card act" href="#/me/achievements"><div class="act-top"><div class="act-vals">${R.map(r => `<div class="av"><div class="av-k">${r.k}</div><div class="av-v num" style="color:${r.c}">${r.v}<span class="av-g">/${r.g}</span><small>${r.u}</small></div></div>`).join('')}</div><div class="act-r">${Game.rings(R, 136)}</div></div>
    <div class="act-foot"><div><div class="av-k">连续学习</div><div class="af-v num">${sk}<small>天</small></div></div><div><div class="av-k">等级</div><div class="af-v num">Lv ${lv.lv}<small>${lv.title}</small></div></div><div><div class="av-k">待复习</div><div class="af-v num">${due}<small>张</small></div></div></div>
    <div class="act-note"><span class="pal">${Game.mascot(closed === 3 ? 'cheer' : Game.mood(), 44)}</span><div><b>${MASCOT.name}</b><span>${status}</span></div></div></a>
  <div class="btns today-cta"><a class="btn big" href="#/focus">${icon('play', 17)} 开始专注</a><a class="btn big tinted" href="#/learn/review/all">${icon('cards', 17)} 复习卡片</a></div>
  ${secHead(`今日任务 <span class="sec-n">${qDone}/3</span>`)}
  <div class="list quests5">${quests.map(([ic, c, t, n, m, u, h]) => `<a class="row q5 ${n >= m ? 'done' : ''}" href="${h}"><span class="q5-r">${Game.rings([{ p: n / m, c }], 34)}<i style="color:${c}">${icon(n >= m ? 'check' : ic, 13)}</i></span><div class="grow"><div class="t">${t}</div><div class="s num">${n} / ${m} ${u}</div></div>${n >= m ? `<span class="q5-ok">已完成</span>` : '<span class="chev">›</span>'}</a>`).join('')}</div>
  ${secHead('亮点')}
  ${ins.length ? ins.slice(0, 3).map(insightCard).join('') : `<div class="card hl" style="--c:var(--pri)"><div class="hl-h"><span class="hl-cat">${icon('sparkle', 15)}学习洞察</span></div><p class="hl-t">完成几次专注或复习后，这里会用一句话总结你的学习趋势。</p></div>`}
  ${secHead(`今日计划${todos.length ? ` <span class="sec-n">${todos.length} 项待完成</span>` : ''}`, '#/plan', '全部')}
  <div id="tdl">${todos.length ? `<div class="list">${todos.slice(0, 8).map(todoRow).join('')}</div>` : `<div class="card">${emptyState('plan', '今天没有待办', doneToday ? `已完成 ${doneToday} 项，做得好。` : '把要做的事写进计划，完成后打勾。', '<a class="btn small tinted" href="#/plan">添加计划</a>')}</div>`}</div>
  ${secHead('快捷入口')}
  <div class="grid3 quick">${[['#/learn/solve', 'camera', '拍照搜题', 'var(--c-exam)'], ['#/learn/exams', 'exam', 'AI 出卷', 'var(--c-blue)'], ['#/learn/wrong', 'wrong', `错题${wr ? ' ' + wr : ''}`, 'var(--c-wrong)'], ['#/learn/notes', 'notes', '笔记', 'var(--c-notes)'], ['#/learn/decks', 'cards', '卡片', 'var(--c-cards)'], ['#/me/achievements', 'trophy', '奖章', 'var(--c-streak)']].map(([h, i, t, c]) => `<a class="tile qt" href="${h}">${iconTile(i, c)}<div class="tt">${t}</div></a>`).join('')}</div>`;
  const hi = $('#hideInst'); if (hi) hi.onclick = () => { S.meta.hideInstall = true; DB.set('meta', S.meta); $('#inst').remove(); };
  bindTodoList($('#tdl'));
  const tick = () => { const el = $('#tdTime'); if (el) { const r = Focus.remain(); el.textContent = `${pad2(Math.floor(r / 60000))}:${pad2(Math.floor(r % 60000 / 1000))}`; } };
  tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
});
route('/learn', 'learn', v => {
  setTop('学习');
  const due = Cards.dueTotal(); const wr = S.wrongs.filter(w => !w.mastered).length; 
  const tiles = [
    ['#/learn/solve', 'camera', '拍照搜题', `分步讲解 · 可追问`, '#8b5cf6'],
    ['#/learn/exams', 'exam', 'AI 出卷 / 模拟考', `${S.exams.length} 份 · 期末 / 四级`, '#6366f1'],
    ['#/learn/wrong', 'wrong', '错题本', wr ? `${wr} 道待攻克` : `${S.wrongs.length} 道`, '#f05252'],
    ['#/learn/wrong-analysis', 'target', '薄弱点分析', '错误率 · 专项练习', '#ec4899'],
    ['#/learn/decks', 'cards', '卡片复习', due ? `${due} 张待复习` : `${S.cards.length} 张卡片`, '#3b82f6'],
    ['#/learn/notes', 'notes', '笔记', `${S.notes.length} 篇 · 支持公式`, '#f59e0b'],
    ['#/learn/books', 'books', '教材导入', `${S.books.length} 本 · PDF/图片/文本`, '#10b981'],
    ['#/learn/banks', 'layers', '题库刷题', S.banks.length ? `${S.banks.reduce((a, b) => a + b.questions.length, 0)} 题 · 断点续刷` : '导入题库 · 随机抽题', '#14b8a6']
  ];
  v.innerHTML = `<div class="grid2">${tiles.map(([h, i, t, s, c]) => `<a class="tile" href="${h}">${iconTile(i, c)}<div class="tt">${t}</div><div class="ts">${s}</div></a>`).join('')}</div>
  <div class="card" style="margin-top:12px"><b style="display:flex;align-items:center;gap:8px">${iconTile('cap', 'var(--pri)', 18)}大一推荐学习流程</b><ol class="small muted flow">${['把高数 / 线代 / C 语言课本导入「教材」（PDF / 拍照 / 粘贴）', '每学完一节，用「AI 出卷」按章节出题；期末前用<b>模拟考试预设</b>限时练', '错题自动进「错题本」，在「薄弱点分析」里一键专项练习、生成周复习计划', '不会的作业题「拍照搜题」，看分步讲解，存入错题本', '四级单词用「卡片」每天复习（可开自动朗读）'].map(x => `<li>${x}</li>`).join('')}</ol></div>`;
});
route('/me', 'me', v => {
  setTop('我的');
  const rows = [['#/me/achievements', 'trophy', '#FF9F0A', '奖章与等级', '经验值、奖章、连续学习与冻结卡'], ['#/me/stats', 'stats', '#3DBE5C', '学习统计', '专注时长、连续天数、复习情况'], ['#/learn/exam-history', 'chart', '#0ea5e9', '成绩记录', '各科考试得分趋势'], ['#/me/settings', 'settings', '#64748b', '设置', 'AI、科目、提醒、朗读、外观'], ['#/me/backup', 'backup', '#6366f1', '备份与恢复', '导出 / 导入 JSON 备份'], ['#/me/about', 'info', '#f59e0b', '使用说明', '安装、数据、提醒与限制']];
  v.innerHTML = `<div class="profile card"><div class="avatar">${esc((S.settings.name || '学').slice(0, 1))}</div><div><b style="font-size:18px">${esc(S.settings.name || '同学')}</b><div class="small muted">大一 · Lv ${Game.level().lv} ${Game.level().title} · 连续 ${Stats.streak()} 天</div><div class="xpbar sm" style="margin-top:8px"><i style="width:${Math.round(Game.level().pct * 100)}%"></i></div></div></div>
  <div class="list">${rows.map(([h, i, c, t, s]) => `<a class="row" href="${h}">${iconTile(i, c, 18)}<div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="chev">›</span></a>`).join('')}</div>
  <div class="grid3"><div class="stat"><div class="v">${S.notes.length}</div><div class="l">笔记</div></div><div class="stat"><div class="v">${S.cards.length}</div><div class="l">卡片</div></div><div class="stat"><div class="v">${S.books.length}</div><div class="l">教材</div></div><div class="stat"><div class="v">${S.exams.length}</div><div class="l">试卷</div></div><div class="stat"><div class="v">${S.wrongs.length}</div><div class="l">错题</div></div><div class="stat"><div class="v">${S.sessions.length}</div><div class="l">番茄</div></div></div>`;
});
route('/me/settings', 'me', v => {
  setTop('设置', { back: '#/me' });
  const c = S.settings.ai; const p = AI_PRESETS[c.preset] || AI_PRESETS.custom; const R = S.settings.remind, T = S.settings.tts;
  const vs = lang => (TTS.voices.length ? TTS.voices : (TTS.ok ? speechSynthesis.getVoices() : [])).filter(x => lang === 'zh' ? /^(zh|cmn)/i.test(x.lang) : /^en/i.test(x.lang)).map(x => `<option value="${esc(x.voiceURI)}" ${(lang === 'zh' ? T.zhVoice : T.enVoice) === x.voiceURI ? 'selected' : ''}>${esc(x.name)} (${esc(x.lang)})</option>`).join('');
  v.innerHTML = `<h3>AI 设置（OpenAI 兼容接口）</h3>
  <div class="card">
    <div class="notice info small">AI 用于：出试卷、批改主观题、图片/扫描版 PDF 识别、生成卡片、举一反三。API Key <b>只保存在本机</b>，由浏览器直接发送给你选择的服务商，不经过任何其他服务器。</div>
    <label class="f"><span>服务商</span><select id="aP">${Object.entries(AI_PRESETS).map(([k, x]) => `<option value="${k}" ${k === c.preset ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="small muted" id="aNote" style="margin:-4px 2px 12px">${esc(p.note)}${p.site ? ` <a href="${p.site}" target="_blank" rel="noopener">获取 API Key ↗</a>` : ''}</div>
    <label class="f"><span>接口地址 Base URL</span><input type="url" id="aU" value="${esc(c.baseUrl)}" placeholder="https://api.example.com/v1" autocapitalize="off" autocorrect="off"></label>
    <label class="f"><span>API Key</span><input type="password" id="aK" value="${esc(c.apiKey)}" placeholder="sk-..." autocapitalize="off" autocorrect="off" autocomplete="off"></label>
    <div class="grid2"><label class="f"><span>文字模型</span><input type="text" id="aM" value="${esc(c.model)}" autocapitalize="off" autocorrect="off"></label><label class="f"><span>视觉模型（图片识别）</span><input type="text" id="aV" value="${esc(c.visionModel)}" placeholder="留空则用文字模型" autocapitalize="off" autocorrect="off"></label></div>
    <div class="grid2"><label class="f"><span>出题时教材最多字数</span><input type="number" id="aC" value="${c.maxChars}" inputmode="numeric"></label><div class="row" style="padding:0;border:0;min-height:0;margin-top:22px"><div class="grow small">JSON 模式</div><label class="switch"><input type="checkbox" id="aJ" ${c.jsonMode ? 'checked' : ''}><span></span></label></div></div>
    <div class="btns"><button class="btn plain" id="aT">测试连接</button><button class="btn" id="aS">保存</button></div>
    <div id="aR" style="margin-top:10px"></div>
  </div>
  <h3>外观</h3><div class="card"><div class="seg" id="th" style="margin:0">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, l]) => `<button data-k="${k}" class="${S.settings.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="f" style="margin:12px 0 0"><span>我的称呼</span><input type="text" id="nm" value="${esc(S.settings.name)}" placeholder="用于首页问候"></label></div>
  <h3>🃏 卡片复习</h3><div class="card"><label class="f" style="margin:0"><span>每个卡组每天新卡上限</span><input type="number" id="np" value="${S.settings.cards.newPerDay}" inputmode="numeric"></label>
    <label class="f" style="margin:12px 0 0"><span>FSRS 目标记住率：<b id="rtv">${Math.round((S.settings.cards.retention || .9) * 100)}%</b></span><input type="range" id="rtn" min="0.8" max="0.97" step="0.01" value="${S.settings.cards.retention || .9}"></label>
    <div class="small muted">默认 90%。调高 → 记得更牢但每天复习更多；调低 → 复习更少但更容易忘。旧卡片的 SM-2 进度会在下次复习时自动换算为 FSRS 记忆状态。</div></div>
  <h3>科目</h3><div class="list" id="sl">${S.settings.subjects.map((s, i) => `<div class="row" data-i="${i}"><input type="color" value="${s.color}" data-k="color" style="width:36px;height:36px;border:0;padding:0;background:none;border-radius:50%"><input type="text" value="${esc(s.name)}" data-k="name" style="flex:1"><button class="icon-btn" data-k="del" style="color:var(--bad);font-size:22px">⊖</button></div>`).join('')}</div>
  <button class="btn ghost block" id="addSub">＋ 添加科目</button>
  <button class="btn ghost block" id="fresh" style="margin-top:8px">${icon('cap', 18)} 应用大一课程预设（高数 / 线代 / 英语 / 物理 / C语言 / 思政）</button>
  <h3>复习提醒</h3><div class="card" id="rmd">
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">开启复习提醒</div><div class="s">打开 App 时显示横幅和角标</div></div><label class="switch"><input type="checkbox" id="rEn" ${R.enabled ? 'checked' : ''}><span></span></label></div>
    <div class="grid2" style="margin-top:8px"><label class="f"><span>早上提醒</span><input type="time" id="rM" value="${esc(R.morning)}"></label><label class="f"><span>晚上提醒</span><input type="time" id="rE" value="${esc(R.evening)}"></label></div>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">到点弹出系统通知</div><div class="s">仅在 App 打开或切回前台时触发</div></div><label class="switch"><input type="checkbox" id="rN" ${R.notify ? 'checked' : ''}><span></span></label></div>
    <div class="btns" style="margin-top:10px"><button class="btn plain" id="ntf">${'Notification' in window ? (Notification.permission === 'granted' ? '✅ 已允许通知' : '允许通知') : '不支持通知'}</button><button class="btn" id="ics">${icon('calendar', 18)} 添加到日历</button></div>
    <div class="small muted" style="margin-top:10px"><b>最可靠的方式是「添加到日历」</b>：会生成一个每天按上面时间重复的日历提醒（.ics），由 iPhone 日历负责准时响铃，即使 App 没打开也会提醒。网页 App 没有服务器，关闭后不能自己定时推送（详见「使用说明」）。改了时间后需重新添加。</div></div>
  <h3>语音朗读</h3><div class="card">${TTS.ok ? `
    <label class="f"><span>语速 <b id="rtv">${T.rate.toFixed(1)}×</b></span><input type="range" id="tR" min="0.5" max="1.5" step="0.1" value="${T.rate}"></label>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">卡片自动朗读</div><div class="s">复习时自动读出卡片正面</div></div><label class="switch"><input type="checkbox" id="tA" ${T.autoplay ? 'checked' : ''}><span></span></label></div>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">翻面后朗读背面</div></div><label class="switch"><input type="checkbox" id="tB" ${T.autoBack ? 'checked' : ''}><span></span></label></div>
    <div class="grid2" style="margin-top:8px"><label class="f"><span>英文声音</span><select id="tEn"><option value="">自动</option>${vs('en')}</select></label><label class="f"><span>中文声音</span><select id="tZh"><option value="">自动</option>${vs('zh')}</select></label></div>
    <div class="btns"><button class="btn plain" id="tTe">试听英文</button><button class="btn plain" id="tTz">试听中文</button></div>
    <div class="small muted" style="margin-top:8px">自动识别中英文并切换声音。iPhone 可在「设置 → 辅助功能 → 朗读内容 → 声音」下载更自然的增强版声音（如 Samantha、婷婷）。</div>` : '<div class="small muted">当前浏览器不支持语音合成。</div>'}</div>`;
  const fill = k => { const x = AI_PRESETS[k]; if (k !== 'custom') { $('#aU').value = x.baseUrl; $('#aM').value = x.model; $('#aV').value = x.visionModel; } $('#aNote').innerHTML = `${esc(x.note)}${x.site ? ` <a href="${x.site}" target="_blank" rel="noopener">获取 API Key ↗</a>` : ''}`; };
  $('#aP').onchange = e => fill(e.target.value);
  const collect = () => Object.assign(c, { preset: $('#aP').value, baseUrl: $('#aU').value.trim(), apiKey: $('#aK').value.trim(), model: $('#aM').value.trim(), visionModel: $('#aV').value.trim(), jsonMode: $('#aJ').checked, maxChars: Math.max(2000, Math.min(200000, +$('#aC').value || 12000)) });
  $('#aS').onclick = () => { collect(); saveSettings(); toast('AI 设置已保存'); };
  $('#aT').onclick = async () => {
    collect(); saveSettings(); const out = $('#aR'); out.innerHTML = '<div class="notice info">正在测试…</div>';
    try { const t0 = Date.now(); const r = await AI.json([{ role: 'user', content: '请只输出 JSON：{"ok":true,"msg":"用一句中文打个招呼"}' }], o => { if (!o || o.ok === undefined) throw new Error('缺少 ok 字段'); return o; }, { maxTokens: 100 }); out.innerHTML = `<div class="notice info">✅ 连接成功（${((Date.now() - t0) / 1000).toFixed(1)} 秒）：${esc(r.msg || '')}</div>`; }
    catch (e) { out.innerHTML = `<div class="notice err pre">${esc(e.message)}</div>`; }
  };
  $('#th').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.settings.theme = b.dataset.k; saveSettings(); applyTheme(); rerender(); };
  $('#nm').onchange = e => { S.settings.name = e.target.value.trim(); saveSettings(); };
  $('#rtn').oninput = e => { $('#rtv').textContent = Math.round(+e.target.value * 100) + '%'; };
  $('#rtn').onchange = e => { S.settings.cards.retention = Math.max(0.8, Math.min(0.97, +e.target.value || 0.9)); saveSettings(); toast('已更新目标记住率，从下次评分开始生效'); };
  $('#np').onchange = e => { S.settings.cards.newPerDay = Math.max(0, Math.min(500, +e.target.value || 20)); saveSettings(); };
  $('#sl').addEventListener('change', e => { const r = e.target.closest('[data-i]'); const s = S.settings.subjects[+r.dataset.i]; if (e.target.dataset.k === 'name') s.name = e.target.value.trim() || s.name; if (e.target.dataset.k === 'color') s.color = e.target.value; saveSettings(); });
  $('#sl').addEventListener('click', async e => { const b = e.target.closest('[data-k=del]'); if (!b) return; const i = +b.closest('[data-i]').dataset.i; if (await confirmBox(`删除科目「${S.settings.subjects[i].name}」？（已有记录会显示为未分类）`, '删除')) { S.settings.subjects.splice(i, 1); saveSettings(); rerender(); } });
  $('#addSub').onclick = () => { const colors = ['#ff6b6b', '#4f6bed', '#20c997', '#ff9f0a', '#af52de', '#34c759', '#a2845e', '#0a84ff', '#ff2d55']; S.settings.subjects.push({ id: uid(), name: '新科目', color: colors[S.settings.subjects.length % colors.length] }); saveSettings(); rerender(); };
  $('#fresh').onclick = async () => { if (await confirmBox('应用大一课程预设？会添加/更新为：高等数学、线性代数、大学英语、大学物理、C语言程序设计、思政课程（保留你自己添加的科目），并加入四级词汇示例卡组。', '应用', false)) { applyFreshman(true); toast('已应用大一预设'); rerender(); } };
  $('#rEn').onchange = e => { R.enabled = e.target.checked; saveSettings(); Remind.update(); };
  $('#rN').onchange = e => { R.notify = e.target.checked; saveSettings(); };
  $('#rM').onchange = e => { R.morning = e.target.value; saveSettings(); };
  $('#rE').onchange = e => { R.evening = e.target.value; saveSettings(); };
  $('#ics').onclick = () => Remind.exportIcs();
  if (TTS.ok) {
    $('#tR').oninput = e => { T.rate = +e.target.value; $('#rtv').textContent = T.rate.toFixed(1) + '×'; saveSettings(); };
    $('#tA').onchange = e => { T.autoplay = e.target.checked; saveSettings(); };
    $('#tB').onchange = e => { T.autoBack = e.target.checked; saveSettings(); };
    $('#tEn').onchange = e => { T.enVoice = e.target.value; saveSettings(); };
    $('#tZh').onchange = e => { T.zhVoice = e.target.value; saveSettings(); };
    $('#tTe').onclick = () => TTS.speak('The limit of sine x over x, as x approaches zero, equals one.');
    $('#tTz').onclick = () => TTS.speak('当 x 趋于零时，sin x 除以 x 的极限等于一。');
  }
  $('#ntf').onclick = async () => { if (!('Notification' in window)) return toast(isIOS() ? '请先添加到主屏幕，并从主屏幕图标打开后再开启' : '当前浏览器不支持通知'); const r = await Notification.requestPermission(); toast(r === 'granted' ? '已允许通知' : '未获得通知权限'); rerender(); };
});
route('/me/backup', 'me', v => {
  setTop('备份与恢复', { back: '#/me' });
  const size = new Blob([JSON.stringify(Object.fromEntries(COLLECTIONS.map(c => [c, S[c]])))]).size;
  v.innerHTML = `<div class="notice">所有数据都只保存在<b>这台设备的浏览器</b>里。清除 Safari 网站数据、删除主屏幕 App 或长期不用（iOS 可能清理）都可能导致数据丢失，请定期导出备份。</div>
  <div class="card"><b>导出备份</b><div class="small muted" style="margin:4px 0 10px">当前数据约 ${(size / 1024).toFixed(0)} KB（${S.notes.length} 笔记、${S.cards.length} 卡片、${S.books.length} 教材、${S.exams.length} 试卷、${S.wrongs.length} 错题、${S.sessions.length} 专注记录）</div>
  <div class="row" style="padding:0 0 10px;border:0;min-height:0"><div class="grow small">备份中包含 API Key</div><label class="switch"><input type="checkbox" id="incKey"><span></span></label></div>
  <button class="btn block" id="exp">导出 JSON 备份</button></div>
  <div class="card"><b>导入备份</b><div class="small muted" style="margin:4px 0 10px">「合并」保留现有数据并加入备份中的新内容；「覆盖」用备份完全替换当前数据。</div>
  <div class="btns"><button class="btn ghost" id="impM">合并导入</button><button class="btn danger" id="impR">覆盖导入</button></div></div>
  <div class="card"><b>危险操作</b><div class="btns" style="margin-top:10px"><button class="btn danger" id="wipe">清空所有数据</button></div></div>`;
  $('#exp').onclick = async () => {
    const st = structuredClone(S.settings); if (!$('#incKey').checked) st.ai.apiKey = '';
    const data = { app: 'study-workbench', version: 1, exportedAt: new Date().toISOString(), settings: st, ...Object.fromEntries(COLLECTIONS.map(c => [c, S[c]])) };
    const name = `学习工作台备份-${dayKey()}.json`; const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); S.meta.lastBackup = Date.now(); DB.set('meta', S.meta); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    S.meta.lastBackup = Date.now(); DB.set('meta', S.meta); toast('已导出（iPhone 上可选择“存储到文件”）');
  };
  const imp = async (mode) => {
    const [f] = await pickFile('application/json,.json'); if (!f) return;
    let data; try { data = JSON.parse(await readFileAs(f)); } catch (e) { return toast('文件不是有效的 JSON'); }
    if (data.app !== 'study-workbench') return toast('这不是学习工作台的备份文件');
    if (mode === 'replace' && !(await confirmBox('覆盖导入会替换当前全部数据，确定吗？', '覆盖'))) return;
    let added = 0;
    for (const c of COLLECTIONS) {
      const arr = Array.isArray(data[c]) ? data[c] : [];
      if (mode === 'replace') S[c] = arr; else { const ids = new Set(S[c].map(x => x.id)); arr.forEach(x => { if (!x.id || !ids.has(x.id)) { S[c].push(x); added++; } }); }
      await saveNow(c);
    }
    if (data.settings) { const key = S.settings.ai.apiKey; if (mode === 'replace') S.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), data.settings); if (!S.settings.ai.apiKey) S.settings.ai.apiKey = key; if (mode === 'replace' && data.settings.subjects) S.settings.subjects = data.settings.subjects; saveSettings(); applyTheme(); }
    toast(mode === 'replace' ? '已恢复备份' : `已合并，新增 ${added} 条`); rerender();
  };
  $('#impM').onclick = () => imp('merge'); $('#impR').onclick = () => imp('replace');
  $('#wipe').onclick = async () => { if (await confirmBox('确定清空所有数据？此操作不可恢复，建议先导出备份。', '全部清空') && await confirmBox('再次确认：真的要清空吗？', '清空')) { await DB.clear(); location.hash = '#/today'; location.reload(); } };
});
route('/me/about', 'me', v => {
  setTop('使用说明', { back: '#/me' });
  v.innerHTML = `<div class="card md">${md(`## 安装到 iPhone 主屏幕
1. 用 **Safari** 打开本页面
2. 点底部 **分享** 按钮 → **添加到主屏幕**
3. 之后从主屏幕图标打开，全屏使用，**断网也能用**（AI 功能除外）

## 数据存储
- 所有数据保存在本机浏览器（IndexedDB），不上传任何服务器
- 「我的 → 备份与恢复」可导出 / 导入 JSON 备份，换手机时用它迁移
- Safari 里打开的版本和主屏幕 App 的数据**互相独立**

## AI 功能
- 在「设置」填写 OpenAI 兼容接口（推荐 DeepSeek、硅基流动、通义千问、Kimi，均已验证支持浏览器直连）
- 图片识别需要视觉模型（如硅基流动的 Qwen2.5-VL、通义 qwen-vl-max）
- 未配置 AI 时可用「示例试卷」体验完整流程

## 题库刷题
- 导入老师发的题库 / 往年题（文本或 JSON，题型自动识别）
- 顺序练习自动记住断点，下次从上次的位置继续；随机刷题优先抽没做过的题；错题重练
- 每题即时判分，做错自动进错题本；可随机抽题组成限时试卷
- 做完的 AI 试卷可在「⋯」菜单中一键加入题库

## 番茄钟
- 计时按结束时间计算，切换 App 回来时间依然准确
- iOS 在锁屏或后台时会暂停网页，**无法准时响铃**；专注时建议保持本页在前台（已自动保持屏幕常亮）
- iPhone 不支持网页振动；静音模式下提示音可能不响

## 卡片复习
- 采用 FSRS-5 记忆算法（Anki 新一代调度）：重来 / 困难 / 良好 / 简单，可在设置调目标记住率；支持 {{挖空}} 填空卡、卡片浏览器、撤销
- 正面写「{{答案}}」即为填空卡（挖空），适合公式、定义、语法
- 卡组「设置」里可单独设每日新卡数和目标记住率
- 笔记中写成「问题 :: 答案」的行可一键生成卡片
- 🔊 可朗读卡片（自动识别中英文），可在设置中调语速、开自动朗读

## 数学公式
- 笔记、题目、解析、卡片都支持 LaTeX：行内公式用一对美元符号包住，独立公式用两对美元符号
- 例如 $\\lim_{x\\to0}\\frac{\\sin x}{x}=1$，$$\\int_a^b f(x)\\,dx=F(b)-F(a)$$

## 拍照搜题
- 需要支持图片的视觉模型；识别后可修改题目再讲解
- 讲解后可继续追问，也可一键存入错题本

## 复习提醒（重要说明）
- **App 打开时**：首页横幅 + 底部角标（支持的设备上主屏幕图标也会显示数字）
- **App 在前台时**：到了设置的早 / 晚时间会弹出通知
- **App 关闭后**：网页无法自己定时推送。推荐在设置里点「添加到日历」，由 iPhone 日历每天准时提醒
- 真正的后台推送（Web Push）需要：一台推送服务器（保存 VAPID 密钥）、保存每台设备的推送订阅、服务器端定时任务按时发送；iPhone 还要求 iOS 16.4+、从主屏幕打开并授权通知。本 App 为纯本地、无服务器设计，所以暂未提供
`)}</div><p class="small muted" style="text-align:center">学习工作台 v1.1</p>`;
});

/* ========== 主题 / 示例数据 / 启动 ========== */
function applyTheme() { const t = S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
const CET4_WORDS = [
  ['abandon', '/əˈbændən/ v. 放弃；抛弃\n例：They had to abandon the plan.'], ['academic', '/ˌækəˈdemɪk/ adj. 学术的；学业的\n例：academic performance 学业成绩'],
  ['accomplish', '/əˈkʌmplɪʃ/ v. 完成；实现\n例：accomplish a goal'], ['adequate', '/ˈædɪkwət/ adj. 足够的；适当的'],
  ['alternative', '/ɔːlˈtɜːnətɪv/ n. 选择 adj. 可替代的\n例：an alternative approach'], ['anxiety', '/æŋˈzaɪəti/ n. 焦虑；担忧'],
  ['appreciate', '/əˈpriːʃieɪt/ v. 欣赏；感激\n例：I really appreciate your help.'], ['approach', '/əˈprəʊtʃ/ n. 方法 v. 接近'],
  ['available', '/əˈveɪləbl/ adj. 可获得的；有空的'], ['benefit', '/ˈbenɪfɪt/ n. 好处 v. 有益于\n例：benefit from exercise'],
  ['campus', '/ˈkæmpəs/ n. 校园\n例：live on campus 住校'], ['challenge', '/ˈtʃælɪndʒ/ n. 挑战 v. 向…挑战'],
  ['consequence', '/ˈkɒnsɪkwəns/ n. 结果；后果\n例：as a consequence 因此'], ['contribute', '/kənˈtrɪbjuːt/ v. 贡献；促成\n例：contribute to 有助于'],
  ['curriculum', '/kəˈrɪkjələm/ n. 课程（总称）'], ['determine', '/dɪˈtɜːmɪn/ v. 决定；确定'],
  ['efficient', '/ɪˈfɪʃnt/ adj. 效率高的'], ['emphasis', '/ˈemfəsɪs/ n. 强调；重点\n例：put emphasis on 重视'],
  ['enormous', '/ɪˈnɔːməs/ adj. 巨大的'], ['essential', '/ɪˈsenʃl/ adj. 必不可少的；本质的'],
  ['evaluate', '/ɪˈvæljueɪt/ v. 评价；评估'], ['flexible', '/ˈfleksəbl/ adj. 灵活的'],
  ['generate', '/ˈdʒenəreɪt/ v. 产生；引起'], ['identify', '/aɪˈdentɪfaɪ/ v. 识别；确认'],
  ['influence', '/ˈɪnfluəns/ n./v. 影响\n例：have an influence on'], ['maintain', '/meɪnˈteɪn/ v. 维持；保持'],
  ['opportunity', '/ˌɒpəˈtjuːnəti/ n. 机会'], ['participate', '/pɑːˈtɪsɪpeɪt/ v. 参加\n例：participate in 参与'],
  ['potential', '/pəˈtenʃl/ adj. 潜在的 n. 潜力'], ['significant', '/sɪɡˈnɪfɪkənt/ adj. 重要的；显著的']
];
const FRESH_SUBJECTS = structuredClone(DEFAULT_SETTINGS.subjects);
function seedCET4() {
  if (S.decks.some(d => d.preset === 'cet4')) return false;
  const now = Date.now(); const d = { id: uid(), name: '四级核心词汇 · 示例', subject: 'english', createdAt: now, preset: 'cet4' }; S.decks.push(d);
  CET4_WORDS.forEach(([f, b], i) => { const c = Cards.newCard(d.id, f, b); c.createdAt = now + i; S.cards.push(c); });
  save('decks'); save('cards'); return true;
}
// 大一预设：添加/更新大一科目，保留用户自定义科目；已有数据引用到的科目也保留
function applyFreshman(force) {
  const cur = S.settings.subjects; const out = FRESH_SUBJECTS.map(f => ({ ...f, ...(cur.find(c => c.id === f.id) && !force ? { name: cur.find(c => c.id === f.id).name } : {}) }));
  const used = new Set([...S.notes, ...S.decks, ...S.books, ...S.wrongs, ...S.todos, ...S.exams, ...S.sessions].map(x => x.subject || x.subjectId).filter(Boolean));
  const OLD_DEFAULT = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'history', 'other'];
  cur.forEach(c => { if (out.some(o => o.id === c.id)) return; if (!OLD_DEFAULT.includes(c.id) || used.has(c.id)) out.splice(out.length - 1, 0, c); });
  S.settings.subjects = out; saveSettings(); seedCET4();
}
function migrate() {
  if (S.meta.v11) return;
  if (S.meta.seeded) { // 老用户：若科目仍是旧版默认（中学科目），自动切换为大一科目
    const ids = S.settings.subjects.map(s => s.id).sort().join(); if (ids === 'biology,chemistry,chinese,english,history,math,other,physics') applyFreshman(true); else seedCET4();
  }
  S.meta.v11 = true; DB.set('meta', S.meta);
}
function seed() {
  if (S.meta.seeded) return;
  const now = Date.now(); S.meta.v11 = true;
  seedCET4();
  S.todos.push({ id: uid(), title: '试试番茄钟：专注 25 分钟', note: '', due: dayKey(), priority: 2, subject: '', done: false, createdAt: now, estimate: 25 });
  S.todos.push({ id: uid(), title: '复习「四级核心词汇」卡组（可开自动朗读）', note: '', due: dayKey(), priority: 1, subject: 'english', done: false, createdAt: now + 1, estimate: 10 });
  S.todos.push({ id: uid(), title: '用示例教材「高数 · 函数与极限」出一份 AI 小测', note: '学习 → AI 出卷 → 选择教材章节', due: dayKey(), priority: 1, subject: 'math', done: false, createdAt: now + 2, estimate: 20 });
  S.todos.push({ id: uid(), title: '导入本学期课本（高数 / 线代 / C语言）', note: '在「学习 → 教材导入」导入 PDF、拍照或粘贴文本', due: dayKey(now + DAY), priority: 0, subject: '', done: false, createdAt: now + 3 });
  S.notes.push({ id: uid(), title: '欢迎使用学习工作台 👋', subject: '', body: `# 笔记支持 Markdown 和公式\n\n- **加粗**、==高亮==、\`代码\`\n- [ ] 待办事项\n> 学而不思则罔，思而不学则殆\n\n## 数学公式（LaTeX）\n行内公式：重要极限 $\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$，欧拉公式 $e^{i\\pi}+1=0$\n\n独立公式：\n$$\\int_a^b f(x)\\,dx = F(b)-F(a)$$\n\n$$A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix},\\quad |A|=-2$$\n\n## 把笔记变成卡片\n导数定义 :: $f'(x_0)=\\lim_{\\Delta x\\to0}\\frac{f(x_0+\\Delta x)-f(x_0)}{\\Delta x}$\n第二个重要极限 :: $\\lim_{x\\to\\infty}\\left(1+\\frac1x\\right)^x=e$\n\n写成「问题 :: 答案」的行，可在右上角「⋯」里一键生成卡片。`, pinned: true, createdAt: now, updatedAt: now });
  S.books.push({ id: uid(), title: '示例教材 · 高等数学 第一章 函数与极限', subject: 'math', source: 'text', createdAt: now, chapters: [
    { id: uid(), title: '1.1 映射与函数', text: '函数的定义：设数集 $D\\subset\\mathbb{R}$，若对每个 $x\\in D$，按照对应法则 $f$ 总有唯一确定的 $y$ 与之对应，则称 $y=f(x)$ 为定义在 $D$ 上的函数，$D$ 称为定义域。\n函数的特性：有界性、单调性、奇偶性（$f(-x)=f(x)$ 为偶函数，$f(-x)=-f(x)$ 为奇函数）、周期性。\n反函数：若 $f$ 是 $D$ 到 $f(D)$ 的单射，则存在逆映射 $f^{-1}$，其图形与 $y=f(x)$ 关于直线 $y=x$ 对称。\n基本初等函数：幂函数、指数函数、对数函数、三角函数、反三角函数。由常数和基本初等函数经过有限次四则运算和复合所得的函数称为初等函数。' },
    { id: uid(), title: '1.2 数列的极限', text: '数列极限的 $\\varepsilon-N$ 定义：若对任意 $\\varepsilon>0$，总存在正整数 $N$，当 $n>N$ 时 $|x_n-a|<\\varepsilon$，则称 $\\lim_{n\\to\\infty}x_n=a$。\n收敛数列的性质：极限唯一性；收敛数列必有界；保号性；收敛数列的任一子数列也收敛且极限相同。\n例：$\\lim_{n\\to\\infty}\\frac{1}{n}=0$，$\\lim_{n\\to\\infty}\\frac{n}{n+1}=1$。' },
    { id: uid(), title: '1.3 函数的极限与两个重要极限', text: '函数极限：$\\lim_{x\\to x_0}f(x)=A$ 当且仅当左右极限都存在且等于 $A$。\n极限运算法则：若 $\\lim f=A,\\ \\lim g=B$，则 $\\lim(f\\pm g)=A\\pm B$，$\\lim fg=AB$，$B\\ne0$ 时 $\\lim f/g=A/B$。\n两个重要极限：$\\lim_{x\\to0}\\frac{\\sin x}{x}=1$；$\\lim_{x\\to\\infty}\\left(1+\\frac{1}{x}\\right)^x=e$。\n夹逼准则：若 $g(x)\\le f(x)\\le h(x)$ 且 $\\lim g=\\lim h=A$，则 $\\lim f=A$。单调有界数列必有极限。' },
    { id: uid(), title: '1.4 无穷小与连续性', text: '无穷小：以 0 为极限的函数。常用等价无穷小（$x\\to0$）：$\\sin x\\sim x$，$\\tan x\\sim x$，$1-\\cos x\\sim\\frac{1}{2}x^2$，$e^x-1\\sim x$，$\\ln(1+x)\\sim x$。求极限时乘除因子可用等价无穷小替换。\n连续：$\\lim_{x\\to x_0}f(x)=f(x_0)$。间断点分为第一类（可去、跳跃）和第二类（无穷、振荡）。\n闭区间上连续函数的性质：有界性与最值定理、零点定理（$f(a)f(b)<0$ 则存在 $\\xi\\in(a,b)$ 使 $f(\\xi)=0$）、介值定理。' }
  ] });
  COLLECTIONS.forEach(c => save(c));
  S.meta.seeded = true; DB.set('meta', S.meta);
}
async function boot() {
  try { await loadAll(); } catch (e) { $('#view').innerHTML = `<div class="notice err" style="margin-top:80px">无法打开本地数据库：${esc(e.message)}。如果在无痕浏览模式，请切换到普通模式。</div>`; return; }
  applyTheme(); seed(); migrate(); Bank.seed(); Focus.init(); Game.init();
  $$('#tabbar a').forEach(a => { const t = a.querySelector('.ti'); if (t) t.innerHTML = icon(a.dataset.tab, 25); });
  $('#sheet .sheet-backdrop').addEventListener('click', () => closeSheet());
  $('#loadingCancel').onclick = () => { if (_loadingAbort) _loadingAbort.abort(); loading(false); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  render(); Remind.init();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
}
boot();
