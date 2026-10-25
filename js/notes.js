'use strict';
/* ========== 笔记 ========== */
let noteQuery = '', noteTag = '';
function allNoteTags() { const m = {}; S.notes.forEach(n => (n.tags || []).forEach(t => m[t] = (m[t] || 0) + 1)); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
function parseTags(s) { return [...new Set(String(s || '').split(/[,，\s#]+/).map(x => x.trim()).filter(Boolean))]; }
route('/learn/notes', 'learn', v => {
  setTop('笔记', { back: '#/learn', actions: `<button class="icon-btn" id="addNote" aria-label="新建">＋</button>` });
  const newNote = () => { const n = { id: uid(), title: '', body: '', tags: [], subject: '', pinned: false, createdAt: Date.now(), updatedAt: Date.now() }; S.notes.push(n); save('notes'); location.hash = '#/learn/note/' + n.id + '/edit'; };
  $('#addNote').onclick = newNote;
  const draw = () => {
    const q = noteQuery.toLowerCase();
    const list = S.notes.filter(n => (!noteTag || (n.tags || []).includes(noteTag)) && (!q || (n.title + '\n' + n.body + '\n' + (n.tags || []).join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
    $('#nl').innerHTML = list.length ? `<div class="list">${list.map(n => {
      let snippet = n.body.replace(/[#>*`=~\-\[\]]/g, '').replace(/\s+/g, ' ').trim();
      if (q) { const i = snippet.toLowerCase().indexOf(q); if (i > 20) snippet = '…' + snippet.slice(i - 15); }
      return `<a class="row" href="#/learn/note/${n.id}"><div class="grow"><div class="t">${n.pinned ? icon('pin', 14, 'pin-ic') + ' ' : ''}${esc(n.title || '无标题')}</div><div class="s">${fmtDate(n.updatedAt)} · ${esc(snippet.slice(0, 60)) || '（空）'}</div>${(n.tags || []).length || n.subject ? `<div class="chips" style="margin-top:4px">${subjChip(n.subject)}${(n.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}</div><span class="chev">›</span></a>`;
    }).join('')}</div>` : `${q || noteTag ? emptyState('search', '没有找到匹配的笔记') : emptyState('notes', '还没有笔记', '点右上角 ＋ 新建，支持 Markdown 与 LaTeX 公式。')}`;
  };
  const tags = allNoteTags();
  v.innerHTML = `<div class="searchbar"><input type="search" id="nq" placeholder="搜索标题、内容、标签" value="${esc(noteQuery)}"></div>
    ${tags.length ? `<div class="chips" id="nt" style="margin-bottom:12px"><button class="chip ${!noteTag ? 'sel' : ''}" data-t="">全部</button>${tags.map(t => `<button class="chip ${noteTag === t ? 'sel' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div id="nl"></div><button class="fab" id="fab" aria-label="新建笔记">＋</button>`;
  $('#fab').onclick = newNote;
  $('#nq').oninput = e => { noteQuery = e.target.value; draw(); };
  const nt = $('#nt'); if (nt) nt.onclick = e => { const b = e.target.closest('button'); if (b) { noteTag = b.dataset.t; rerender(); } };
  draw();
});
route('/learn/note/:id', 'learn', (v, id) => {
  const n = S.notes.find(x => x.id === id); if (!n) { location.hash = '#/learn/notes'; return; }
  setTop(n.title || '无标题', { back: '#/learn/notes', actions: `<button class="icon-btn txt" id="edit">编辑</button>` });
  $('#edit').onclick = () => location.hash = '#/learn/note/' + id + '/edit';
  const qa = (n.body.match(/^.+\s::\s.+$/gm) || []);
  v.innerHTML = `<div class="card"><div class="chips" style="margin-bottom:8px">${subjChip(n.subject)}${(n.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join('')}<span class="chip">更新于 ${fmtDateTime(n.updatedAt)}</span></div>
    <div class="md">${md(n.body) || '<p class="muted">（空笔记）</p>'}</div></div>
    <div class="btns"><button class="btn ghost" id="pin">${n.pinned ? '取消置顶' : icon('pin', 17) + ' 置顶'}</button><button class="btn ghost" id="mk">生成卡片${qa.length ? `（${qa.length}）` : ''}</button>${TTS.ok && n.body ? `<button class="btn ghost" data-say="${esc(n.title + '。' + n.body)}">${icon('speaker', 18)} 朗读</button>` : ''}</div>
    <p class="small muted" style="margin:10px 4px">提示：在笔记中写成「问题 :: 答案」的行，可一键生成复习卡片。</p>
    <div class="btns" style="margin-top:8px"><button class="btn danger" id="del">删除笔记</button></div>`;
  $('#pin').onclick = () => { n.pinned = !n.pinned; save('notes'); rerender(); };
  $('#del').onclick = async () => { if (await confirmBox('删除这篇笔记？', '删除')) { S.notes = S.notes.filter(x => x !== n); save('notes'); location.hash = '#/learn/notes'; } };
  $('#mk').onclick = () => {
    if (!qa.length) return toast('笔记里没有「问题 :: 答案」格式的行');
    openSheet(`<h2>生成 ${qa.length} 张卡片</h2><label class="f"><span>加入卡组</span><select id="dk">${S.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}<option value="__new">＋ 新建卡组「${esc(n.title || '笔记卡片')}」</option></select></label><button class="btn block" id="go">生成</button>`, el => {
      $('#go', el).onclick = () => {
        let did = $('#dk', el).value;
        if (did === '__new') { const d = { id: uid(), name: n.title || '笔记卡片', subject: n.subject || '', createdAt: Date.now() }; S.decks.push(d); save('decks'); did = d.id; }
        const exist = new Set(S.cards.filter(c => c.deckId === did).map(c => c.front));
        let k = 0; qa.forEach(l => { const [f, ...b] = l.split(/\s::\s/); if (!exist.has(f.trim())) { S.cards.push(Cards.newCard(did, f.trim(), b.join(' :: ').trim())); k++; } });
        save('cards'); closeSheet(); toast(`已生成 ${k} 张卡片`);
      };
    });
  };
});
route('/learn/note/:id/edit', 'learn', (v, id) => {
  const n = S.notes.find(x => x.id === id); if (!n) { location.hash = '#/learn/notes'; return; }
  const done = () => { commit(); if (!n.title && !n.body) { S.notes = S.notes.filter(x => x !== n); save('notes'); location.hash = '#/learn/notes'; } else location.hash = '#/learn/note/' + id; };
  setTop('编辑笔记', { back: done, actions: `<button class="icon-btn txt" id="done">完成</button>` });
  $('#done').onclick = done;
  v.innerHTML = `<label class="f"><input type="text" id="nT" placeholder="标题" value="${esc(n.title)}" style="font-size:20px;font-weight:600"></label>
    <div class="grid2"><label class="f"><span>科目</span><select id="nS">${subjOptions(n.subject)}</select></label><label class="f"><span>标签（空格/逗号分隔）</span><input type="text" id="nG" value="${esc((n.tags || []).join(' '))}" placeholder="如：公式 重点"></label></div>
    <div class="seg" id="mode"><button class="on" data-m="e">编辑</button><button data-m="p">预览</button></div>
    <div class="chips" id="tb" style="margin-bottom:8px">${[['# ', '标题'], ['**', '加粗'], ['==', '高亮'], ['- ', '列表'], ['- [ ] ', '待办'], ['> ', '引用'], ['`', '代码'], ['$', '∑ 公式'], ['$$', '独立公式'], [' :: ', '问答卡']].map(([s, l]) => `<button class="chip" data-s="${esc(s)}">${l}</button>`).join('')}</div>
    <textarea id="nB" style="min-height:52vh" placeholder="支持简易 Markdown：# 标题、**加粗**、==高亮==、- 列表、> 引用&#10;写成「问题 :: 答案」可生成复习卡片">${esc(n.body)}</textarea>
    <div id="pv" class="card md hidden"></div>`;
  const commit = () => { n.title = $('#nT').value.trim(); n.body = $('#nB').value; n.subject = $('#nS').value; n.tags = parseTags($('#nG').value); n.updatedAt = Date.now(); save('notes'); };
  const auto = debounce(commit, 600);
  ['#nT', '#nB', '#nG'].forEach(s => $(s).addEventListener('input', auto)); $('#nS').onchange = commit;
  $('#mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#mode button').forEach(x => x.classList.toggle('on', x === b)); const p = b.dataset.m === 'p'; $('#nB').classList.toggle('hidden', p); $('#tb').classList.toggle('hidden', p); $('#pv').classList.toggle('hidden', !p); if (p) $('#pv').innerHTML = md($('#nB').value) || '<p class="muted">（空）</p>'; };
  $('#tb').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const ta = $('#nB'); const s = b.dataset.s; const [a, z] = [ta.selectionStart, ta.selectionEnd]; const sel = ta.value.slice(a, z);
    let ins; if (s === '**' || s === '==' || s === '`') ins = s + (sel || '文字') + s; else if (s === '$') ins = '$' + (sel || 'x^2') + '$'; else if (s === '$$') ins = '\n$$' + (sel || '\\int_a^b f(x)\\,dx') + '$$\n'; else if (s === ' :: ') ins = (sel || '问题') + ' :: 答案'; else { const ls = ta.value.lastIndexOf('\n', a - 1) + 1; ta.setRangeText(s, ls, ls, 'end'); ta.focus(); auto(); return; }
    ta.setRangeText(ins, a, z, 'end'); ta.focus(); auto();
  };
  if (!n.body) setTimeout(() => $('#nT').focus(), 200);
  return commit;
});
