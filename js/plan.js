'use strict';
/* ========== 学习计划 / 待办 ========== */
let planFilter = 'active', planSubj = '';
const PRI_LABEL = ['无', '低', '中', '高'];
function todoDueTs(t) { return t.due ? new Date(t.due + 'T23:59:00').getTime() : null; }
function todoRow(t) {
  const due = todoDueTs(t); const over = due && !t.done && due < Date.now();
  return `<div class="row ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="check ${t.done ? 'on' : ''}" data-act="toggle" aria-label="完成">${t.done ? '✓' : ''}</button>
    <div class="grow" data-act="edit">
      <div class="t">${t.priority ? `<span class="pri-${t.priority}">${'!'.repeat(t.priority)}</span> ` : ''}${esc(t.title)}</div>
      <div class="s">${t.due ? `<span style="color:${over ? 'var(--bad)' : 'inherit'}">${relDue(due)}</span>` : ''}${t.subject ? ' · ' + esc(subj(t.subject).name) : ''}${t.estimate ? ' · 预计 ' + t.estimate + ' 分钟' : ''}${t.note ? ' · ' + esc(t.note.slice(0, 30)) : ''}</div>
    </div>
    ${!t.done ? `<button class="icon-btn play-mini" data-act="focus" aria-label="开始专注">${icon('play', 15)}</button>` : ''}
  </div>`;
}
function bindTodoList(el) {
  el.addEventListener('click', e => {
    const row = e.target.closest('.row[data-id]'); if (!row) return;
    const t = S.todos.find(x => x.id === row.dataset.id); if (!t) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; save('todos'); if (t.done) Game.xpPop(5, '· 完成一项计划'); rerender(); if (t.done) Game.after(); }
    else if (act === 'focus') { Focus.prepare({ subject: t.subject, todoId: t.id, label: t.title }); location.hash = '#/focus'; }
    else if (act === 'edit') editTodo(t);
  });
}
function editTodo(t) {
  const isNew = !t; t = t || { id: uid(), title: '', note: '', due: dayKey(), priority: 0, subject: planSubj || '', done: false, createdAt: Date.now(), estimate: '' };
  openSheet(`<h2>${isNew ? '新建计划' : '编辑计划'}</h2>
    <label class="f"><span>内容</span><input type="text" id="tTitle" value="${esc(t.title)}" placeholder="例如：完成数学第三章练习"></label>
    <div class="grid2">
      <label class="f"><span>截止日期</span><input type="date" id="tDue" value="${t.due || ''}"></label>
      <label class="f"><span>科目</span><select id="tSubj">${subjOptions(t.subject)}</select></label>
    </div>
    <label class="f"><span>优先级</span><div class="seg" id="tPri">${PRI_LABEL.map((p, i) => `<button type="button" data-v="${i}" class="${t.priority == i ? 'on' : ''}">${p}</button>`).join('')}</div></label>
    <label class="f"><span>预计用时（分钟）</span><input type="number" inputmode="numeric" id="tEst" value="${t.estimate || ''}" placeholder="可选"></label>
    <label class="f"><span>备注</span><textarea id="tNote" style="min-height:80px" placeholder="可选">${esc(t.note)}</textarea></label>
    <div class="btns">${!isNew ? '<button class="btn danger" id="tDel">删除</button>' : ''}<button class="btn" id="tSave">保存</button></div>`, el => {
    let pri = t.priority || 0;
    $('#tPri', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; pri = +b.dataset.v; $$('#tPri button', el).forEach(x => x.classList.toggle('on', x === b)); };
    if (isNew) setTimeout(() => $('#tTitle', el).focus(), 300);
    $('#tSave', el).onclick = () => {
      const title = $('#tTitle', el).value.trim(); if (!title) return toast('请填写内容');
      Object.assign(t, { title, due: $('#tDue', el).value, subject: $('#tSubj', el).value, priority: pri, note: $('#tNote', el).value.trim(), estimate: +$('#tEst', el).value || '' });
      if (isNew) S.todos.push(t); save('todos'); closeSheet(); rerender();
    };
    if (!isNew) $('#tDel', el).onclick = async () => { if (await confirmBox('删除这个计划？', '删除')) { S.todos = S.todos.filter(x => x !== t); save('todos'); rerender(); } };
  });
}
function sortTodos(a, b) { const da = todoDueTs(a) ?? 9e15, db = todoDueTs(b) ?? 9e15; return da - db || (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt; }
route('/plan', 'plan', v => {
  setTop('学习计划', { actions: `<button class="icon-btn" id="addTodo" aria-label="新建">＋</button>` });
  $('#addTodo').onclick = () => editTodo();
  let items = S.todos.filter(t => !planSubj || t.subject === planSubj);
  const today = startOfDay(), tomorrow = today + DAY;
  const groups = [];
  if (planFilter === 'active') {
    const act = items.filter(t => !t.done).sort(sortTodos);
    groups.push(['已过期', act.filter(t => todoDueTs(t) && todoDueTs(t) < today)]);
    groups.push(['今天', act.filter(t => todoDueTs(t) && todoDueTs(t) >= today && todoDueTs(t) < tomorrow)]);
    groups.push(['之后', act.filter(t => todoDueTs(t) && todoDueTs(t) >= tomorrow)]);
    groups.push(['无日期', act.filter(t => !t.due)]);
  } else if (planFilter === 'done') {
    groups.push(['已完成', items.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))]);
  } else {
    groups.push(['全部', items.slice().sort(sortTodos)]);
  }
  const total = S.todos.filter(t => t.due === dayKey()).length, doneToday = S.todos.filter(t => t.due === dayKey() && t.done).length;
  v.innerHTML = `
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>今日进度</b><div class="small muted">${doneToday} / ${total} 项已完成</div></div><div style="font-size:26px;font-weight:700">${total ? Math.round(doneToday / total * 100) : 0}%</div></div>
    <div class="progress"><i style="width:${total ? doneToday / total * 100 : 0}%"></i></div></div>
    <div class="seg" id="pf">${[['active', '待完成'], ['done', '已完成'], ['all', '全部']].map(([k, l]) => `<button data-k="${k}" class="${planFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="chips" id="ps" style="margin-bottom:12px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px"><button class="chip ${!planSubj ? 'sel' : ''}" data-s="">全部科目</button>${S.settings.subjects.map(s => `<button class="chip ${planSubj === s.id ? 'sel' : ''}" data-s="${s.id}">${esc(s.name)}</button>`).join('')}</div>
    <div id="tl">${groups.filter(g => g[1].length).map(([n, arr]) => `<h3>${n} · ${arr.length}</h3><div class="list">${arr.map(todoRow).join('')}</div>`).join('') || `${emptyState('plan', '还没有计划', '点右上角 ＋ 添加，或在「薄弱点分析」里一键生成本周复习计划。')}`}</div>
    <button class="fab" id="fab" aria-label="新建计划">＋</button>`;
  $('#pf').onclick = e => { const b = e.target.closest('button'); if (b) { planFilter = b.dataset.k; rerender(); } };
  $('#ps').onclick = e => { const b = e.target.closest('button'); if (b) { planSubj = b.dataset.s; rerender(); } };
  $('#fab').onclick = () => editTodo();
  bindTodoList($('#tl'));
});
