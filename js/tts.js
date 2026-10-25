'use strict';
/* ========== 语音朗读（Web Speech API · speechSynthesis） ========== */
const TTS = {
  ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  voices: [], speaking: false, _id: 0, _btn: null,
  init() {
    if (!this.ok) return;
    const load = () => { this.voices = speechSynthesis.getVoices() || []; };
    load(); speechSynthesis.addEventListener?.('voiceschanged', load);
  },
  // 判断语言：中文字符占比高则用中文，否则英文
  lang(text) {
    const s = String(text || ''); const zh = (s.match(/[\u4e00-\u9fff]/g) || []).length; const en = (s.match(/[A-Za-z]/g) || []).length;
    return zh * 2 >= en ? 'zh' : 'en';
  },
  pickVoice(lang) {
    const st = S.settings.tts; const want = lang === 'zh' ? st.zhVoice : st.enVoice;
    const vs = this.voices.length ? this.voices : (this.ok ? speechSynthesis.getVoices() : []);
    if (want) { const v = vs.find(x => x.voiceURI === want || x.name === want); if (v) return v; }
    const pref = lang === 'zh' ? [/zh[-_]CN/i, /zh/i, /cmn/i] : [/en[-_]US/i, /en[-_]GB/i, /^en/i];
    const nice = lang === 'zh' ? /Tingting|婷婷|Xiaoxiao|Yaoyao|Huihui|Li-mu|Google 普通话/i : /Samantha|Alex|Ava|Allison|Daniel|Karen|Google US English|Aria|Jenny/i;
    for (const re of pref) { const c = vs.filter(v => re.test(v.lang)); if (c.length) return c.find(v => nice.test(v.name)) || c.find(v => v.localService) || c[0]; }
    return null;
  },
  // 去掉 Markdown / LaTeX 标记，转换成适合朗读的文本
  clean(text) {
    let s = String(text || '');
    s = s.replace(/```[\s\S]*?```/g, ' 代码块 ').replace(/\$\$?([^$]+)\$\$?/g, (m, t) => ' ' + this.tex(t) + ' ');
    s = s.replace(/\\\(|\\\)|\\\[|\\\]/g, ' ').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-*+]\s+(\[[ x]\]\s*)?/gim, '').replace(/^>\s?/gm, '')
      .replace(/\*\*|==|~~|`|__/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s*::\s*/g, '，').replace(/_{2,}|（\s*）/g, ' 空 ').replace(/[│|]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  },
  tex(t) {
    return t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 除以 $2').replace(/\\sqrt\{([^{}]*)\}/g, '根号 $1').replace(/\^\{?2\}?/g, ' 的平方').replace(/\^\{?3\}?/g, ' 的立方')
      .replace(/\\(int)/g, ' 积分 ').replace(/\\lim/g, ' 极限 ').replace(/\\sum/g, ' 求和 ').replace(/\\to/g, ' 趋于 ').replace(/\\infty/g, ' 无穷 ').replace(/\\(pi)/g, ' 派 ')
      .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}_^\\]/g, ' ');
  },
  // 切分为较短片段（iOS / Chrome 对超长语句可能中断）
  chunks(s) {
    const parts = s.match(/[^。！？!?；;\n.]+[。！？!?；;.]?/g) || [s]; const out = []; let cur = '';
    for (const p of parts) { if ((cur + p).length > 160 && cur) { out.push(cur); cur = p; } else cur += p; }
    if (cur.trim()) out.push(cur); return out.flatMap(c => c.length > 220 ? c.match(/.{1,200}/g) : [c]);
  },
  // parts: 字符串或 [{text, lang}]；返回 Promise（读完/被打断时结束）
  speak(parts, { btn, rate } = {}) {
    if (!this.ok) { toast('当前浏览器不支持语音朗读'); return Promise.resolve(); }
    this.stop(); const id = ++this._id;
    if (!Array.isArray(parts)) parts = [{ text: parts }];
    const items = [];
    parts.forEach(p => { const txt = this.clean(p.text); if (!txt) return; const lang = p.lang || this.lang(txt); this.chunks(txt).forEach(c => items.push({ c, lang })); });
    if (!items.length) return Promise.resolve();
    this.speaking = true; this._btn = btn || null; if (btn) btn.classList.add('on');
    const r = rate || S.settings.tts.rate || 1;
    return new Promise(res => {
      let i = 0;
      const done = () => { if (id === this._id) this._end(); res(); };
      const next = () => {
        if (id !== this._id) return res();
        if (i >= items.length) return done();
        const { c, lang } = items[i++]; const u = new SpeechSynthesisUtterance(c);
        const v = this.pickVoice(lang); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
        u.rate = Math.max(0.5, Math.min(2, r)); u.pitch = 1;
        u.onend = next; u.onerror = (e) => { if (e.error === 'not-allowed') toast('请先点一下页面再朗读（浏览器限制自动播放）'); done(); };
        speechSynthesis.speak(u);
      };
      next();
    });
  },
  _end() { this.speaking = false; if (this._btn) this._btn.classList.remove('on'); this._btn = null; },
  stop() { if (!this.ok) return; this._id++; try { speechSynthesis.cancel(); } catch (e) { } this._end(); },
  // 点一下读，再点一下停
  toggle(parts, btn) { if (this.speaking && (!btn || this._btn === btn)) { this.stop(); return; } this.speak(parts, { btn }); }
};
TTS.init();
// 小喇叭按钮：<button class="spk" data-say="...">；页面统一用事件委托处理
function spkBtn(text, extra = '') { return `<button class="spk" type="button" data-say="${esc(String(text || '').slice(0, 6000))}" aria-label="朗读" ${extra}>${window.icon ? icon('speaker', 18) : '🔊'}</button>`; }
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (!b) return; e.stopPropagation(); e.preventDefault(); TTS.toggle(b.dataset.say, b); }, true);
