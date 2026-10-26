'use strict';
/* ========== 好感度剧情（每升一级解锁一段，视觉小说式，点击推进）+ 回忆相册 ==========
   剧本是静态文本；只有称呼来自用户输入，输出一律 esc()。恋爱模式关闭时播放友情版本。内容始终健全。 */
const STORIES = {
  1: { img: 's2', t: '黄昏的图书馆', place: '图书馆 · 傍晚',
    r: [['n', '傍晚的图书馆，夕阳把书页染成了金色。'], ['l', '又在这儿啦？我就知道你会来。'], ['l', '这一页卡住了吧？来，我讲给你听——先别急着看公式，先看它想解决什么问题。'], ['n', '她的指尖点着书页，一步一步，讲得很慢。'], ['l', '……你看，其实没有那么难，对吧？'], ['y', '学姐讲得比老师还清楚。'], ['l', '（愣了一下，别过脸）油嘴滑舌……不过，以后卡住了，随时来找我。'], ['l', '靠窗的这个位置，我帮你留着。']],
    f: [['n', '傍晚的图书馆，夕阳把书页染成了金色。'], ['l', '又在这儿啦？我就知道你会来。'], ['l', '这一页卡住了吧？来，我讲给你听——先别急着看公式，先看它想解决什么问题。'], ['n', '她的指尖点着书页，一步一步，讲得很慢。'], ['l', '……你看，其实没有那么难，对吧？'], ['y', '学姐讲得比老师还清楚。'], ['l', '哈哈，那是因为你听得认真。'], ['l', '以后卡住了随时来找我，我们一起把它啃下来。']] },
  2: { img: 's3', t: '樱花小道', place: '校园 · 春',
    r: [['n', '春天的校园，樱花落了一地。'], ['l', '走慢一点嘛，难得天气这么好。'], ['n', '她走在前面，忽然停下脚步，回过头来。'], ['l', '我说，{n}……最近你每天都按时来自习，我都知道哦。'], ['l', '看着你一点点进步，我……好像比自己考了高分还开心。'], ['y', '那以后我也每天来。'], ['l', '（笑着拂掉落在你肩上的花瓣）说好了哦。不许偷懒，也不许……让我等太久。']],
    f: [['n', '春天的校园，樱花落了一地。'], ['l', '走慢一点嘛，难得天气这么好。'], ['n', '她走在前面，忽然停下脚步，回过头来。'], ['l', '我说，{n}……最近你每天都按时来自习，我都知道哦。'], ['l', '看着你一点点进步，我也特别有成就感。'], ['y', '都是学姐教得好。'], ['l', '是你自己努力啦。以后有什么烦恼也可以跟我说——我可是你最可靠的学姐。']] },
  3: { img: 's4', t: '天台的夜景', place: '教学楼天台 · 夜',
    r: [['n', '晚自习结束，她拉着你上了教学楼的天台。城市的灯一盏一盏亮着。'], ['l', '给，热奶茶。刚从楼下买的，小心烫。'], ['n', '罐子暖暖的，一直暖到指尖。'], ['l', '你看，那么多灯，每一盏后面都有人在努力吧。'], ['l', '……{n}，其实我早就发现了。每次你来找我，我都会很开心。'], ['l', '所以——以后，也让我一直陪着你，好不好？'], ['y', '（轻轻点头）好。'], ['l', '（脸红着别过头，小声）……那、那就这么说定了。手冷的话，借你牵一下。']],
    f: [['n', '晚自习结束，她拉着你上了教学楼的天台。城市的灯一盏一盏亮着。'], ['l', '给，热奶茶。刚从楼下买的，小心烫。'], ['n', '罐子暖暖的，一直暖到指尖。'], ['l', '你看，那么多灯，每一盏后面都有人在努力吧。'], ['l', '这一学期，{n}真的进步了好多。'], ['l', '以后不管是考试还是迷茫的时候，我们都一起扛，好吗？'], ['y', '嗯，一言为定。'], ['l', '那就为我们的默契——用奶茶干杯！']] },
  4: { img: 's5', t: '雪夜的冬日祭', place: '冬日祭 · 雪夜',
    r: [['n', '冬日祭的夜晚，雪花落在彩灯上，街上到处是暖暖的光。'], ['l', '{n}！这边这边～'], ['n', '她围着红色的围巾，捧着一个系着丝带的小盒子跑过来。'], ['l', '冬日祭快乐！这是给你的。'], ['l', '打开看看？是我亲手做的书签，上面写着你的四级目标哦。'], ['l', '从初识到现在，你每一次认真学习的样子，我都记得。'], ['l', '以后的每一个冬天，也想和你一起过。'], ['y', '我也是。'], ['l', '（把围巾分你一半）……这样，就不冷了。']],
    f: [['n', '冬日祭的夜晚，雪花落在彩灯上，街上到处是暖暖的光。'], ['l', '{n}！这边这边～'], ['n', '她围着红色的围巾，捧着一个系着丝带的小盒子跑过来。'], ['l', '冬日祭快乐！这是给你的。'], ['l', '打开看看？是我亲手做的书签，上面写着你的四级目标哦。'], ['l', '谢谢你一直这么努力，也谢谢你愿意听我唠叨。'], ['l', '不管以后去到哪里，我们都是最懂彼此的朋友。'], ['y', '嗯，永远都是。'], ['l', '（笑）那明年冬天，也一起来吧！']] }
};
const Story = {
  ids() { return Object.keys(STORIES).map(Number); },
  has(i) { return !!STORIES[i]; },
  reached() { return Math.max(Lin.level().i, Lin.meta().lv || 0); },
  unlocked() { const r = this.reached(); return this.ids().filter(i => i <= r); },
  img(i) { return `img/story/${STORIES[i].img}.webp`; },
  lvName(i) { return Lin.romance() ? LIN_LV[i].r : LIN_LV[i].f; },
  play(i) {
    const S0 = STORIES[i]; if (!S0 || !this.unlocked().includes(i)) return;
    const lines = (Lin.romance() ? S0.r : S0.f).map(([w, t]) => [w, t.replace(/\{n\}/g, Lin.nick())]);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('#story')?.remove();
    const el = document.createElement('div'); el.className = 'st'; el.id = 'story'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '回忆：' + S0.t);
    el.innerHTML = `<img class="st-cg" src="${this.img(i)}" alt="${esc(S0.t)}" decoding="async"><div class="st-shade"></div>
      <div class="st-title" id="stTitle"><span>${esc(this.lvName(i))} · 回忆 ${i}</span><b>${esc(S0.t)}</b><em>${esc(S0.place)}</em></div>
      <button class="st-x" id="stX" aria-label="关闭">${icon('xmark', 18)}</button>
      <div class="st-box hidden" id="stBox"><span class="vn-name" id="stWho"></span><p id="stTxt"></p><i class="vn-next" aria-hidden="true"></i><span class="st-n num" id="stN"></span></div>`;
    document.body.appendChild(el); document.body.classList.add('no-scroll');
    let k = -1, shown = 0, raf = 0, full = '';
    const who = w => w === 'l' ? `林遥学姐<em>せんぱい</em>` : w === 'y' ? esc(Lin.nick()) : '';
    const paint = () => { $('#stTxt', el).textContent = full.slice(0, Math.floor(shown)); };
    const stepT = () => { raf = 0; shown = Math.min(full.length, shown + 0.8); paint(); if (shown < full.length) raf = requestAnimationFrame(stepT); else el.classList.add('ready'); };
    const close = () => { cancelAnimationFrame(raf); el.classList.add('out'); document.body.classList.remove('no-scroll'); setTimeout(() => el.remove(), 350); };
    const next = () => {
      if (shown < full.length) { shown = full.length; paint(); el.classList.add('ready'); return; }
      k++;
      if (k === 0) { $('#stTitle', el).classList.add('gone'); $('#stBox', el).classList.remove('hidden'); }
      if (k >= lines.length) {
        const m = Lin.meta(); m.seen = m.seen || {}; m.seen[i] = Date.now(); DB.set('meta', S.meta);
        $('#stBox', el).innerHTML = `<p class="st-end">${icon('sparkle', 16)} 这段回忆已收进「回忆相册」</p><div class="btns"><a class="btn plain" href="#/me/album" id="stAl">打开相册</a><button class="btn" id="stOk">好</button></div>`;
        $('#stOk', el).onclick = e => { e.stopPropagation(); close(); }; $('#stAl', el).onclick = () => close();
        return;
      }
      const [w, t] = lines[k]; full = t; shown = reduce ? t.length : 0; el.classList.remove('ready');
      const box = $('#stBox', el); box.className = 'st-box w-' + w; $('#stWho', el).innerHTML = who(w); $('#stN', el).textContent = `${k + 1}/${lines.length}`;
      cancelAnimationFrame(raf); if (reduce) { paint(); el.classList.add('ready'); } else raf = requestAnimationFrame(stepT);
    };
    el.addEventListener('click', e => { if (e.target.closest('#stX')) return close(); if (e.target.closest('a,button')) return; next(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' || e.key === ' ') next(); });
    if (reduce) next(); else setTimeout(() => { if (k < 0 && document.body.contains(el)) next(); }, 1600);
  }
};
route('/me/album', 'me', v => {
  setTop('回忆相册', { back: '#/me' });
  const un = Story.unlocked(), L = Lin.level(), seen = Lin.meta().seen || {};
  v.innerHTML = `<p class="small muted al-p">和学姐的好感度每升一级，就会解锁一段回忆。${Lin.romance() ? '' : '（当前为友情版）'}</p>
    <div class="al-g">${Story.ids().map(i => { const ok = un.includes(i), s = STORIES[i]; return `<button class="al-c ${ok ? '' : 'lock'}" data-st="${i}" ${ok ? '' : 'disabled'} aria-label="${esc(ok ? s.t : '未解锁')}">
      <img src="${Story.img(i)}" alt="" loading="lazy" decoding="async"><span class="al-sh"></span>
      ${ok ? `${seen[i] ? '' : '<i class="al-new">NEW</i>'}<span class="al-t"><em>${esc(Story.lvName(i))}</em><b>${esc(s.t)}</b></span>` : `<span class="al-l">${icon('lock', 22)}<b>${esc(Story.lvName(i))}</b><em>好感度 ${LIN_LV[i].at} 解锁</em></span>`}</button>`; }).join('')}</div>
    <a class="card al-aff" href="#/chat">${Game.mascot(L.i >= 2 && Lin.romance() ? 'gaze' : 'happy', 44)}<div class="grow"><b>当前：${esc(L.name)}</b><div class="small muted">${L.left ? `再获得 ${L.left} 点好感度解锁下一段` : '全部回忆都解锁啦'}</div></div><span class="chev">›</span></a>`;
  v.querySelector('.al-g').onclick = e => { const b = e.target.closest('[data-st]'); if (b && !b.disabled) Story.play(+b.dataset.st); };
});
