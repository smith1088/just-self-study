'use strict';
/* ========== 今日 / 学习 / 我的 / 设置 / 启动 ========== */
function greet() { const h = new Date().getHours(); return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let _rid = 0;
function ring(pct, size = 76, stroke = 8, color = 'var(--pri)') { const r = (size - stroke) / 2, c = 2 * Math.PI * r; let defs = '', st = color; if (color === 'grad') { const id = 'rg' + (++_rid); defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--pri2)"/><stop offset="1" stop-color="var(--pri)"/></linearGradient></defs>`; st = `url(#${id})`; } return `<svg class="pring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${st}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, pct)))}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fg" style="--c:${c}"/></svg>`; }
function actCard() {
  const R = Game.ringItems(), lv = Game.level(), sk = Game.streak();
  const pct = Math.round(R.reduce((a, r) => a + Math.min(1, r.p || 0), 0) / R.length * 100);
  return `<a class="card act7" href="#/me/achievements"><div class="a7-top"><div class="a7-ring">${Game.rings(R, 132)}<div class="a7-c"><b class="num">${pct}<small>%</small></b><span>今日</span></div></div>
    <div class="a7-vals">${R.map(r => `<div class="a7-v" style="--c:${r.c};--c2:${r.c2}"><div class="a7-k"><i></i>${r.k}</div><div class="a7-n num">${r.v}<span>/${r.g} ${r.u}</span></div></div>`).join('')}</div></div>
    <div class="a7-foot"><div><span>连续学习</span><b class="num">${sk}<small>天</small></b></div><div><span>等级</span><b class="num">Lv ${lv.lv}</b></div><div><span>今日经验</span><b class="num">${Game.today()}<small>XP</small></b></div></div></a>`;
}
route('/today', 'today', v => {
  setTop('今日');
  const tm = Focus.todayMinutes(); const due = Cards.dueTotal();
  const todos = S.todos.filter(t => !t.done && t.due && t.due <= dayKey()).sort(sortTodos);
  const doneToday = S.todos.filter(t => t.done && t.doneAt >= startOfDay()).length;
  const st = Focus.st;
  const d = new Date();
  const revToday = Stats.reviewsSince(startOfDay());
  const lg = Lin.greet(), lvn = Lin.level(), cw = Cet.words(), cd = Cet.daysLeft();
  const rpNew = d.getDay() === 1 && S.meta.reportSeen !== dayKey(Report.weekStart(-1)) && Object.keys(Game.xpByDay()).some(k => k >= dayKey(Report.weekStart(-1)) && k < dayKey(Report.weekStart(0)));
  const allT = todos.length + doneToday;
  const left = todos.length;
  v.innerHTML = `<header class="t5-head td2-head"><div><div class="t5-date">${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}</div><h2 class="large-title">${greet()}${S.settings.name ? '，' + esc(S.settings.name) : ''}</h2></div><a class="t5-av" href="#/me" aria-label="我的">${esc((S.settings.name || '学').slice(0, 1))}</a></header>
  ${isIOS() && !isStandalone() && !S.meta.hideInstall ? `<div class="notice info" id="inst"><b>添加到主屏幕</b>：点 Safari 底部的「分享」按钮，选择「添加到主屏幕」，即可像 App 一样全屏使用、离线可用。<button class="btn small plain" id="hideInst" style="margin-top:8px">不再提示</button></div>` : ''}
  <div class="tdw">
  <a class="w w-lin vn-today" href="#/chat" id="tdChat" aria-label="和林遥学姐聊天"><span class="vn-art w-face"><img src="${MASCOT.src(lg.mood, true)}" alt="${esc(MASCOT.altOf(lg.mood))}" width="56" height="56"></span><span class="grow"><span class="w-ln">林遥学姐<em>${LIN_HEART}${esc(lvn.name)}</em></span><span class="w-lt">${esc(lg.text)}</span></span><span class="w-bub">${icon('send', 15)}</span></a>
  ${rpNew ? `<a class="w w-rp" href="#/me/report?w=last">${icon('chart', 16)}<span class="grow">上周学习报告出炉啦</span><span class="chev">›</span></a>` : ''}
  ${ttNextHtml()}
  <div class="w2">
    <a class="w w-due" href="#/learn/review/all"><span class="w-k" style="--c:var(--c-cards)">${icon('cards', 14)}待复习</span><b class="w-n num">${due}<small>张</small></b><span class="w-s">${due ? '点我开始复习' : revToday ? `今天已复习 ${revToday} 张` : '暂无到期卡片'}</span></a>
    <a class="w w-todo" href="#/plan"><span class="w-k" style="--c:var(--c-plan)">${icon('check', 14)}今日计划</span><b class="w-n num">${doneToday}<small>/ ${allT} 项</small></b><span class="w-s">${left ? `还剩 ${left} 项` : allT ? '全部完成' : '还没有计划'}</span></a>
    <a class="w w-cet" href="#/learn/cet"><span class="w-k" style="--c:#EC4899">${icon('words', 14)}四级</span><b class="w-n num">${cd}<small>天</small></b><i class="w-bar"><i style="width:${cw.started ? Math.min(100, Math.round(cw.newToday / Math.max(1, cw.newGoal) * 100)) : 0}%"></i></i><span class="w-s">今日单词 ${cw.started ? cw.newToday : 0}/${cw.newGoal}</span></a>
    <a class="w w-focus${st.running ? ' on' : ''}" href="#/focus"><span class="w-play">${icon(st.running ? 'focus' : 'play', 26)}</span>${st.running ? `<b class="mono" id="tdTime"></b><span class="w-s">${PHASES[st.phase]}中</span>` : `<b class="w-ft">开始专注</b><span class="w-s">今天 ${tm} 分钟</span>`}</a>
  </div></div>`;
  const hi = $('#hideInst'); if (hi) hi.onclick = () => { S.meta.hideInstall = true; DB.set('meta', S.meta); $('#inst').remove(); };
  let _nx = TT.next(), _nxT = 0;
  const tick = () => { if ($('#nxCd') && ++_nxT % 15 === 0) { const n = TT.next(); if (n && _nx && n.ref !== _nx.ref) { rerender(); return; } _nx = n; $('#nxCd').textContent = ttCountdown(n); } const el = $('#tdTime'); if (el) { const r = Focus.remain(); el.textContent = `${pad2(Math.floor(r / 60000))}:${pad2(Math.floor(r % 60000 / 1000))}`; } };
  tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
});
route('/learn', 'learn', v => {
  setTop('学习');
  const due = Cards.dueTotal(); const wr = S.wrongs.filter(w => !w.mastered).length; const cw = Cet.words();
  const big = [
    ['#/learn/cet', 'words', '四级', `还有 ${Cet.daysLeft()} 天`, '#EC4899'],
    ['#/learn/wrong', 'wrong', '错题本', wr ? `${wr} 道待攻克` : '做错的题自动收集', '#f05252'],
    ['#/learn/exams', 'exam', 'AI 出题', S.exams.length ? `${S.exams.length} 份试卷` : '按章节出卷 · 模拟考', '#6366f1'],
    ['#/learn/books', 'books', '教材与笔记', `${S.books.length} 本教材 · ${S.notes.length} 篇笔记`, '#10b981']
  ];
  const more = [
    ['#/learn/tt', 'calendar', '课表', '#5B8DEF'], ['#/learn/solve', 'camera', '拍照搜题', '#8b5cf6'], ['#/learn/banks', 'layers', '题库刷题', '#14b8a6'], ['#/learn/pastpapers', 'doc', '真题练习', '#f59e0b'],
    ['#/learn/wrong-analysis', 'target', '薄弱点分析', '#ec4899'], ['#/learn/exam-history', 'chart', '成绩记录', '#0ea5e9']
  ];
  v.innerHTML = `<a class="lh-hero" href="#/learn/decks">${iconTile('cards', '#3b82f6', 22)}<div class="grow"><div class="lh-t">背卡片</div><div class="lh-s">${due ? '今天待复习' : '今天都复习完了'}</div></div><span class="lh-n num">${due || ''}</span><span class="chev">›</span></a>
  <div class="grid2 lh-grid">${big.map(([h, i, t, s, c]) => `<a class="tile" href="${h}">${iconTile(i, c)}<div class="tt">${t}</div><div class="ts">${s}</div></a>`).join('')}</div>
  <details class="lh-more"${Q.get('more') ? ' open' : ''}><summary class="row"><div class="grow"><div class="t">更多工具</div><div class="s">课表、拍照搜题、题库、真题、薄弱点、成绩</div></div><span class="chev">›</span></summary>
  <div class="list">${more.map(([h, i, t, c]) => `<a class="row" href="${h}">${iconTile(i, c, 18)}<div class="grow"><div class="t">${t}</div></div><span class="chev">›</span></a>`).join('')}</div></details>`;
});
route('/me', 'me', v => {
  setTop('我的');
  const grp = (rows) => `<div class="list">${rows.map(([h, i, c, t]) => `<a class="row" href="${h}">${iconTile(i, c, 18)}<div class="grow"><div class="t">${t}</div></div><span class="chev">›</span></a>`).join('')}</div>`;
  v.innerHTML = `<div class="profile card"><div class="avatar">${esc((S.settings.name || '学').slice(0, 1))}</div><div class="grow"><b style="font-size:18px">${esc(S.settings.name || '同学')}</b><div class="small muted">Lv ${Game.level().lv} ${Game.level().title}</div><div class="xpbar sm" style="margin-top:8px"><i style="width:${Math.round(Game.level().pct * 100)}%"></i></div></div></div>
  ${secHead('今日活动')}
  ${actCard()}
  ${secHead('记录')}
  ${grp([['#/me/achievements', 'trophy', '#FF9F0A', '奖章与等级'], ['#/me/stats', 'stats', '#3DBE5C', '学习统计'], ['#/me/report', 'chart', '#8B7CF6', '每周学习报告'], ['#/me/album', 'image', '#F2679B', '回忆相册']])}
  <div style="height:12px"></div>
  ${grp([['#/me/settings', 'settings', '#64748b', '设置'], ['#/me/about', 'info', '#f59e0b', '使用说明']])}`;
});
route('/me/settings', 'me', v => {
  const SEC = { study: '学习', remind: '提醒与日历', ai: 'AI 与隐私' }; const cur = SEC[Q.get('s')] ? Q.get('s') : '';
  setTop(cur ? SEC[cur] : '设置', { back: cur ? '#/me/settings' : '#/me' });
  const c = S.settings.ai; const p = AI_PRESETS[c.preset] || AI_PRESETS.custom; const R = S.settings.remind, T = S.settings.tts;
  const vs = lang => (TTS.voices.length ? TTS.voices : (TTS.ok ? speechSynthesis.getVoices() : [])).filter(x => lang === 'zh' ? /^(zh|cmn)/i.test(x.lang) : /^en/i.test(x.lang)).map(x => `<option value="${esc(x.voiceURI)}" ${(lang === 'zh' ? T.zhVoice : T.enVoice) === x.voiceURI ? 'selected' : ''}>${esc(x.name)} (${esc(x.lang)})</option>`).join('');
  const hid = k => k === cur ? '' : ' hidden';
  const aiOn = !!(c.apiKey && c.baseUrl);
  const idx = [['#/chat?set=1', 'me', '#F2679B', '学姐', `好感度 ${esc(Lin.level().name)} · 称呼、恋爱模式、记忆`, 'lnSet'], ['#/me/settings?s=study', 'cards', '#3b82f6', '学习', '卡片、科目、朗读'], ['#/me/settings?s=remind', 'bell', '#ff9f0a', '提醒与日历', R.enabled ? '学姐提醒已开启' : '已关闭'], ['#/me/settings?s=ai', 'sparkle', '#6366f1', 'AI 与隐私', aiOn ? `已配置 · ${esc(p.name)}` : '未配置（可选）'], ['#/me/backup', 'backup', '#10b981', '数据备份', '导出 / 导入 JSON']];
  v.innerHTML = `<section class="sg${cur ? ' hidden' : ''}" data-s="">
  <div class="list st-idx">${idx.map(([h, i, cl, t, sub, id]) => `<a class="row" href="${h}"${id ? ` id="${id}"` : ''}>${iconTile(i, cl, 18)}<div class="grow"><div class="t">${t}</div><div class="s">${sub}</div></div><span class="chev">›</span></a>`).join('')}</div>
  </section>
  <section class="sg${hid('ai')}" data-s="ai">
  <div class="card">
    <div class="small muted" style="margin:0 2px 12px">AI 用于出题、批改、图片识别、生成卡片。不填也能用全部基础功能。</div>
    <label class="f"><span>服务商</span><select id="aP">${Object.entries(AI_PRESETS).map(([k, x]) => `<option value="${k}" ${k === c.preset ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="small muted" id="aNote" style="margin:-4px 2px 12px">${esc(p.note)}${p.site ? ` <a href="${p.site}" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a>` : ''}</div>
    <label class="f"><span>接口地址 Base URL</span><input type="url" id="aU" value="${esc(c.baseUrl)}" placeholder="https://api.example.com/v1" autocapitalize="off" autocorrect="off"></label>
    <label class="f"><span>API Key</span><span class="key-row"><input type="password" id="aK" placeholder="sk-..." autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" data-lpignore="true"><button type="button" class="btn small plain" id="aKs" aria-label="显示或隐藏 API Key">显示</button></span></label>
    <div class="key-tools"><span class="small muted" id="aKst">${c.apiKey ? '已保存 Key：' + esc(maskKey(c.apiKey)) : '尚未填写 Key'}</span><button type="button" class="btn small danger" id="aKc" ${c.apiKey ? '' : 'disabled'}>清除 API Key</button></div>
    <label class="f"><span>文字模型</span><input type="text" id="aM" value="${esc(c.model)}" autocapitalize="off" autocorrect="off"></label>
    <details class="adv"><summary>高级选项</summary><label class="f"><span>视觉模型（图片识别）</span><input type="text" id="aV" value="${esc(c.visionModel)}" placeholder="留空则用文字模型" autocapitalize="off" autocorrect="off"></label>
    <div class="grid2"><label class="f"><span>出题时教材最多字数</span><input type="number" id="aC" value="${c.maxChars}" inputmode="numeric"></label><div class="row" style="padding:0;border:0;min-height:0;margin-top:22px"><div class="grow small">JSON 模式</div><label class="switch"><input type="checkbox" id="aJ" ${c.jsonMode ? 'checked' : ''}><span></span></label></div></div></details>
    <div class="btns"><button class="btn plain" id="aT">测试连接</button><button class="btn" id="aS">保存</button></div>
    <div id="aR" style="margin-top:10px"></div>
    <details class="privacy"><summary>🔒 API Key 隐私说明</summary><ul class="small">
      <li>Key <b>只保存在这台设备的浏览器里</b>（本地数据库），不会上传到 GitHub，也不会发给我们——本应用没有服务器。</li>
      <li>使用 AI 时，Key 只放在请求头里，经 HTTPS <b>直接发送给你上面填写的服务商</b>，不经过任何中转。</li>
      <li>导出备份时默认<b>不包含</b> Key；分享截图前请先确认 Key 处于隐藏状态。</li>
      <li>建议为本应用<b>单独创建一个 Key，并在服务商后台设置消费上限/余额提醒</b>，不要使用主账号的 Key。</li>
      <li>如果手机丢失或怀疑泄露：登录服务商控制台（API Keys 页面）<b>删除/停用这个 Key</b> 即可立刻失效，再新建一个填回来。</li>
    </ul></details>
  </div></section>
  <section class="sg${cur ? ' hidden' : ''}" data-s="">
  <h3>外观</h3><div class="card"><div class="seg" id="th" style="margin:0">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, l]) => `<button data-k="${k}" class="${S.settings.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="f" style="margin:12px 0 0"><span>我的称呼</span><input type="text" id="nm" value="${esc(S.settings.name)}" placeholder="用于首页问候"></label></div></section>
  <section class="sg${hid('study')}" data-s="study">
  <h3>卡片复习</h3><div class="card"><label class="f" style="margin:0"><span>每个卡组每天新卡上限</span><input type="number" id="np" value="${S.settings.cards.newPerDay}" inputmode="numeric"></label>
    <label class="f" style="margin:12px 0 0"><span>FSRS 目标记住率：<b id="rtv">${Math.round((S.settings.cards.retention || .9) * 100)}%</b></span><input type="range" id="rtn" min="0.8" max="0.97" step="0.01" value="${S.settings.cards.retention || .9}"></label>
    <div class="small muted">默认 90%。调高记得更牢，但每天复习更多。</div></div>
  <h3>科目</h3><div class="list" id="sl">${S.settings.subjects.map((s, i) => `<div class="row" data-i="${i}"><input type="color" value="${esc(safeColor(s.color, '#8e8e93'))}" data-k="color" style="width:36px;height:36px;border:0;padding:0;background:none;border-radius:50%"><input type="text" value="${esc(s.name)}" data-k="name" style="flex:1"><button class="icon-btn" data-k="del" style="color:var(--bad);font-size:22px">⊖</button></div>`).join('')}</div>
  <button class="btn ghost block" id="addSub">＋ 添加科目</button>
  <details class="adv"><summary>大一课程预设</summary><button class="btn plain block" id="fresh">${icon('cap', 18)} 应用预设（高数 / 线代 / 英语 / 物理 / C语言 / 思政）</button></details>
    <h3>朗读</h3><div class="card">${TTS.ok ? `
    <label class="f"><span>语速 <b id="trv">${T.rate.toFixed(1)}×</b></span><input type="range" id="tR" min="0.5" max="1.5" step="0.1" value="${T.rate}"></label>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">卡片自动朗读</div><div class="s">复习时自动读出卡片正面</div></div><label class="switch"><input type="checkbox" id="tA" ${T.autoplay ? 'checked' : ''}><span></span></label></div>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">翻面后朗读背面</div></div><label class="switch"><input type="checkbox" id="tB" ${T.autoBack ? 'checked' : ''}><span></span></label></div>
    <details class="adv"><summary>声音选择</summary><div class="grid2"><label class="f"><span>英文声音</span><select id="tEn"><option value="">自动</option>${vs('en')}</select></label><label class="f"><span>中文声音</span><select id="tZh"><option value="">自动</option>${vs('zh')}</select></label></div>
    <div class="btns"><button class="btn plain" id="tTe">试听英文</button><button class="btn plain" id="tTz">试听中文</button></div>
    <div class="small muted" style="margin-top:8px">iPhone 可在「设置 → 辅助功能 → 朗读内容 → 声音」下载更自然的增强版声音。</div></details>` : '<div class="small muted">当前浏览器不支持语音合成。</div>'}</div>
  </section>
  <section class="sg${hid('remind')}" data-s="remind">
  <h3>提醒</h3><div class="card" id="rmd">
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">学姐主动提醒</div><div class="s">上课前 10 分钟、待复习、晚上复习、该睡觉了</div></div><label class="switch"><input type="checkbox" id="rEn" ${R.enabled ? 'checked' : ''}><span></span></label></div>
    <div class="grid2" style="margin-top:8px"><label class="f"><span>早上提醒</span><input type="time" id="rM" value="${esc(R.morning)}"></label><label class="f"><span>晚上提醒</span><input type="time" id="rE" value="${esc(R.evening)}"></label></div>
    <div class="row" style="padding:0;border:0;min-height:44px"><div class="grow"><div class="t">到点弹出系统通知</div><div class="s">仅在 App 打开或切回前台时触发</div></div><label class="switch"><input type="checkbox" id="rN" ${R.notify ? 'checked' : ''}><span></span></label></div>
    <div class="btns" style="margin-top:10px"><button class="btn plain" id="ntf">${'Notification' in window ? (Notification.permission === 'granted' ? '✅ 已允许通知' : '允许通知') : '不支持通知'}</button><button class="btn" id="ics">${icon('calendar', 18)} 添加到 iPhone 日历</button></div>
    <div class="small muted" style="margin-top:10px">学姐提醒只在 App 打开时出现。想关掉 App 也准时响，点「添加到 iPhone 日历」，一次导入课表、考试和每日复习提醒（课表改了需重新添加）。</div></div>
  </section>`;
  const fill = k => { const x = AI_PRESETS[k]; if (k !== 'custom') { $('#aU').value = x.baseUrl; $('#aM').value = x.model; $('#aV').value = x.visionModel; } $('#aNote').innerHTML = `${esc(x.note)}${x.site ? ` <a href="${x.site}" target="_blank" rel="noopener noreferrer">获取 API Key ↗</a>` : ''}`; };
  $('#aP').onchange = e => fill(e.target.value);
  $('#aK').value = c.apiKey || ''; // 通过属性赋值，不把 Key 写进 HTML 文本
  $('#aKs').onclick = () => { const k = $('#aK'); const show = k.type === 'password'; k.type = show ? 'text' : 'password'; $('#aKs').textContent = show ? '隐藏' : '显示'; };
  $('#aKc').onclick = async () => { if (!await confirmBox('清除本机保存的 API Key？\n（这只删除本机副本；如怀疑泄露，请同时到服务商后台停用该 Key）')) return; c.apiKey = ''; saveSettings(); $('#aK').value = ''; $('#aK').type = 'password'; $('#aKs').textContent = '显示'; $('#aKst').textContent = '尚未填写 Key'; $('#aKc').disabled = true; toast('已清除 API Key'); };
  const collect = () => Object.assign(c, { preset: $('#aP').value, baseUrl: $('#aU').value.trim(), apiKey: $('#aK').value.trim(), model: $('#aM').value.trim(), visionModel: $('#aV').value.trim(), jsonMode: $('#aJ').checked, maxChars: Math.max(2000, Math.min(200000, +$('#aC').value || 12000)) });
  const urlOk = () => { const u = $('#aU').value.trim(); const bad = u ? AI.checkUrl(u) : ''; $('#aR').innerHTML = bad ? `<div class="notice err">${esc(bad)}</div>` : ''; return !bad; };
  const afterSave = () => { const k = c.apiKey; $('#aKst').textContent = k ? '已保存 Key：' + maskKey(k) : '尚未填写 Key'; $('#aKc').disabled = !k; $('#aK').type = 'password'; $('#aKs').textContent = '显示'; };
  $('#aS').onclick = () => { if (!urlOk()) return; collect(); saveSettings(); afterSave(); toast('AI 设置已保存'); };
  $('#aT').onclick = async () => {
    if (!urlOk()) return; collect(); saveSettings(); afterSave(); const out = $('#aR'); out.innerHTML = '<div class="notice info">正在测试…</div>';
    try { const t0 = Date.now(); const r = await AI.json([{ role: 'user', content: '请只输出 JSON：{"ok":true,"msg":"用一句中文打个招呼"}' }], o => { if (!o || o.ok === undefined) throw new Error('缺少 ok 字段'); return o; }, { maxTokens: 100 }); out.innerHTML = `<div class="notice info">✅ 连接成功（${((Date.now() - t0) / 1000).toFixed(1)} 秒）：${esc(r.msg || '')}</div>`; }
    catch (e) { out.innerHTML = `<div class="notice err pre">${esc(AI.redact(e.message))}</div>`; }
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
  $('#ics').onclick = () => Remind.exportAll();
  if (TTS.ok) {
    $('#tR').oninput = e => { T.rate = +e.target.value; $('#trv').textContent = T.rate.toFixed(1) + '×'; saveSettings(); };
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
  setTop('数据备份', { back: '#/me/settings' });
  const size = new Blob([JSON.stringify(Object.fromEntries(COLLECTIONS.map(c => [c, S[c]])))]).size;
  v.innerHTML = `<div class="notice">所有数据都只保存在<b>这台设备的浏览器</b>里。清除 Safari 网站数据、删除主屏幕 App 或长期不用（iOS 可能清理）都可能导致数据丢失，请定期导出备份。</div>
  <div class="card"><b>导出备份</b><div class="small muted" style="margin:4px 0 10px">当前数据约 ${(size / 1024).toFixed(0)} KB（${S.notes.length} 笔记、${S.cards.length} 卡片、${S.books.length} 教材、${S.exams.length} 试卷、${S.wrongs.length} 错题、${S.sessions.length} 专注记录）</div>
  <div class="row" style="padding:0 0 10px;border:0;min-height:0"><div class="grow small">备份中包含 API Key</div><label class="switch"><input type="checkbox" id="incKey"><span></span></label></div>
  <div class="notice err small bk-warn hidden" id="incKeyW">⚠️ 备份文件将包含<b>明文 API Key</b>。任何拿到这个文件的人（网盘、聊天记录、AirDrop）都能使用你的 Key 消费额度。仅在自己换手机时勾选，用完请删除该文件。</div>
  <button class="btn block" id="exp">导出 JSON 备份</button></div>
  <div class="card"><b>导入备份</b><div class="small muted" style="margin:4px 0 10px">「合并」保留现有数据并加入备份中的新内容；「覆盖」用备份完全替换当前数据。</div>
  <div class="btns"><button class="btn ghost" id="impM">合并导入</button><button class="btn danger" id="impR">覆盖导入</button></div></div>
  <div class="card"><b>危险操作</b><div class="btns" style="margin-top:10px"><button class="btn danger" id="wipe">清空所有数据</button></div></div>`;
  $('#incKey').onchange = e => $('#incKeyW').classList.toggle('hidden', !e.target.checked);
  $('#exp').onclick = async () => {
    const withKey = $('#incKey').checked && !!S.settings.ai.apiKey;
    if (withKey && !(await confirmBox('这个备份会包含明文 API Key，确定导出吗？', '仍然导出'))) return;
    const st = structuredClone(S.settings); if (!withKey) st.ai.apiKey = '';
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
    if (data.settings && typeof data.settings === 'object') {
      // AI 设置（接口地址 / Key / 模型）绝不静默导入：防止恶意备份把你的 Key 改发到别人的服务器
      const curAI = structuredClone(S.settings.ai); const inAI = data.settings.ai && typeof data.settings.ai === 'object' ? data.settings.ai : null;
      if (mode === 'replace') { S.settings = deepMerge(structuredClone(DEFAULT_SETTINGS), { ...data.settings, ai: {} }); if (Array.isArray(data.settings.subjects)) S.settings.subjects = data.settings.subjects.filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id || uid()), name: String(x.name || '未命名'), color: safeColor(x.color) })); }
      S.settings.ai = curAI;
      const inUrl = String(inAI?.baseUrl || '').trim(), inKey = String(inAI?.apiKey || '').trim();
      if (inAI && (inUrl && inUrl !== curAI.baseUrl || inKey && inKey !== curAI.apiKey)) {
        const bad = inUrl ? AI.checkUrl(inUrl) : '';
        if (bad) toast('备份中的 AI 接口地址不安全，已忽略');
        else if (await confirmBox(`备份中包含另一套 AI 设置：\n接口地址：${inUrl || '（未填写）'}\n模型：${inAI.model || '（未填写）'}${inKey ? '\n含 API Key：' + maskKey(inKey) : ''}\n\n只有确认这是你自己的备份时才导入。导入后 AI 请求（含 Key）会发往上面的地址。`, '导入 AI 设置')) {
          const nu = { ...curAI, ...Object.fromEntries(['preset', 'baseUrl', 'model', 'visionModel', 'jsonMode', 'maxChars'].filter(k => inAI[k] != null).map(k => [k, inAI[k]])) };
          if (inUrl !== curAI.baseUrl && !inKey) nu.apiKey = ''; // 换了服务商却沿用旧 Key 会把旧 Key 发给新地址
          if (inKey) nu.apiKey = inKey;
          if (!AI_PRESETS[nu.preset]) nu.preset = 'custom';
          S.settings.ai = nu;
        }
      }
      saveSettings(); applyTheme();
    }
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
- 「我的 → 设置 → 数据备份」可导出 / 导入 JSON 备份，换手机时用它迁移
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
- **App 关闭后**：网页无法自己定时推送。推荐在设置里点「添加到 iPhone 日历」，课表、临时安排和每天的复习提醒都会由 iPhone 日历准时提醒（课表变了需要重新添加）
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
  S.todos.push({ id: uid(), title: '用示例教材「高数 · 函数与极限」出一份 AI 小测', note: '学习 → AI 出题 → 选择教材章节', due: dayKey(), priority: 1, subject: 'math', done: false, createdAt: now + 2, estimate: 20 });
  S.todos.push({ id: uid(), title: '导入本学期课本（高数 / 线代 / C语言）', note: '在「学习 → 教材与笔记」导入 PDF、拍照或粘贴文本', due: dayKey(now + DAY), priority: 0, subject: '', done: false, createdAt: now + 3 });
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
  setTimeout(() => { if (/^#\/today|^$/.test(location.hash)) linDailyGreet(); }, 1400);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
}
boot();
