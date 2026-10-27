'use strict';
/* ========== AI（OpenAI 兼容接口，浏览器直连） ========== */
const AI_PRESETS = {
  deepseek: { name: 'DeepSeek 深度求索', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', visionModel: '', site: 'https://platform.deepseek.com/api_keys', note: '国内可直接访问，价格低；不支持图片识别（需另配视觉模型）。' },
  siliconflow: { name: '硅基流动 SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', visionModel: 'Qwen/Qwen2.5-VL-72B-Instruct', site: 'https://cloud.siliconflow.cn/account/ak', note: '国内可访问，一个 Key 同时支持文字和图片识别。' },
  dashscope: { name: '阿里云百炼（通义千问）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', visionModel: 'qwen-vl-max', site: 'https://bailian.console.aliyun.com/?apiKey=1', note: '国内可访问，支持图片识别（qwen-vl）。' },
  moonshot: { name: 'Moonshot（Kimi）', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k', visionModel: 'moonshot-v1-32k-vision-preview', site: 'https://platform.moonshot.cn/console/api-keys', note: '国内可访问。' },
  volc: { name: '火山方舟（豆包）', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115', visionModel: 'doubao-1-5-vision-pro-32k-250115', site: 'https://console.volcengine.com/ark', note: '模型名需填写控制台中已开通的模型 ID。' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', visionModel: 'gpt-4o-mini', site: 'https://platform.openai.com/api-keys', note: '中国大陆需要可访问的网络环境。' },
  gemini: { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash', site: 'https://aistudio.google.com/apikey', note: '有免费额度；中国大陆需要可访问的网络环境。' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', visionModel: 'openai/gpt-4o-mini', site: 'https://openrouter.ai/keys', note: '聚合多家模型。' },
  custom: { name: '自定义（OpenAI 兼容）', baseUrl: '', model: '', visionModel: '', site: '', note: '任何兼容 /chat/completions 且允许浏览器跨域（CORS）的服务。智谱 open.bigmodel.cn 经测试不允许浏览器直连。' }
};
// 只显示 Key 的首尾几位，用于确认填的是哪个 Key
const maskKey = k => { k = String(k || '').trim(); return k.length <= 8 ? '••••' : k.slice(0, 3) + '••••' + k.slice(-4); };
class AIError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
const AI = {
  cfg() { return S.settings.ai; },
  ready() { const c = this.cfg(); return !!(c.apiKey && c.baseUrl && c.model); },
  visionReady() { const c = this.cfg(); return !!(c.apiKey && c.baseUrl && (c.visionModel || c.model)); },
  // 接口地址校验：只允许 https://（本机调试可用 http://localhost / 127.0.0.1），且不能在地址里夹带账号密码
  checkUrl(u) {
    const b = String(u || '').trim(); if (!b) return '请填写接口地址';
    let x; try { x = new URL(b); } catch (e) { return '接口地址格式不正确，应以 https:// 开头'; }
    if (x.username || x.password) return '接口地址中不能包含账号或密码';
    if (x.protocol === 'https:') return '';
    if (x.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(x.hostname)) return '';
    return '为保护 API Key，接口地址必须使用 https://（明文 http 会让 Key 在网络中被窃听）';
  },
  // 从任何要展示的文字里抹掉 Key（以及看起来像 Key 的片段），防止出现在错误提示、截图里
  redact(t) {
    let s = String(t ?? ''); const k = (this.cfg()?.apiKey || '').trim();
    if (k.length >= 4) s = s.split(k).join('***');
    return s.replace(/Bearer\s+[^\s"',]+/gi, 'Bearer ***').replace(/\b(sk|ak|key)-[A-Za-z0-9_\-]{6,}/gi, '$1-***').replace(/AIza[0-9A-Za-z_\-]{20,}/g, 'AIza***');
  },
  url() {
    const c = this.cfg(); const bad = this.checkUrl(c.baseUrl); if (bad) throw new AIError(bad + '。请到「我的 → 设置 → AI 与隐私」修改。', 'config');
    let b = c.baseUrl.trim().replace(/\/+$/, ''); if (/\/chat\/completions$/.test(b)) return b; return b + '/chat/completions';
  },
  /** 语音转文字：录音只发往用户自己配置的服务商的 /audio/transcriptions（OpenAI 兼容），Key 只在 Authorization 头里 */
  STT: { openai: 'whisper-1', siliconflow: 'FunAudioLLM/SenseVoiceSmall', openrouter: 'openai/whisper-1', custom: 'whisper-1' },
  async transcribe(blob, { lang = 'zh', signal } = {}) {
    const c = this.cfg(); if (!this.ready()) throw new AIError('语音识别需要先配置你自己的 AI。', 'config');
    const model = this.STT[c.preset] || 'whisper-1';
    const url = this.url().replace(/\/chat\/completions$/, '/audio/transcriptions');
    const fd = new FormData(); const ext = /mp4|m4a|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    fd.append('file', blob, 'voice.' + ext); fd.append('model', model); fd.append('language', lang === 'en' ? 'en' : 'zh');
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort('timeout'), 60000); if (signal) signal.addEventListener('abort', () => ctl.abort('user'));
    let res; try { res = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + c.apiKey.trim() }, body: fd, signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', mode: 'cors' }); } catch (e) { clearTimeout(to); throw this.netErr(e, ctl); }
    clearTimeout(to); const t = await res.text(); let d = null; try { d = JSON.parse(t); } catch (e) { }
    if (!res.ok) { const e = this.httpErr(res.status, d?.error?.message || d?.message || t.slice(0, 200)); if (res.status === 404 || res.status === 405) e.kind = 'nostt'; throw e; }
    return String(d?.text ?? (d ? '' : t)).trim().slice(0, 1000);
  },
  async chat(messages, { json = false, signal, temperature = 0.4, model, maxTokens } = {}) {
    const c = this.cfg(); if (!this.ready()) throw new AIError('还没有配置 AI。请到「我的 → 设置 → AI 与隐私」填写接口地址、API Key 和模型名。', 'config');
    const body = { model: model || c.model, messages, temperature, stream: false };
    if (maxTokens) body.max_tokens = maxTokens;
    if (json && c.jsonMode) body.response_format = { type: 'json_object' };
    let res;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort('timeout'), 180000);
    if (signal) signal.addEventListener('abort', () => ctl.abort('user'));
    try {
      // Key 只放在 Authorization 头里，直连用户配置的服务商；不带 Cookie、不发 Referer、不缓存、不跟随重定向（防止被转发到别的域名）
      res = await fetch(this.url(), this.reqOpts(body, ctl.signal));
    } catch (e) { clearTimeout(to); throw this.netErr(e, ctl); }
    clearTimeout(to);
    let text = await res.text(); let data = null; try { data = JSON.parse(text); } catch (e) { }
    if (!res.ok) {
      const em = data?.error?.message || data?.message || data?.error || text.slice(0, 200);
      if (json && c.jsonMode && res.status === 400 && /response_format|json/i.test(String(em))) { // 不支持 JSON 模式，降级重试
        return this.chat(messages, { json: false, signal, temperature, model, maxTokens });
      }
      throw this.httpErr(res.status, em);
    }
    const out = data?.choices?.[0]?.message?.content;
    if (out == null) throw new AIError('AI 返回内容为空或格式无法识别。', 'empty');
    return Array.isArray(out) ? out.map(p => p.text || '').join('') : String(out);
  },
  // Key 只放在 Authorization 头里，直连用户配置的服务商；不带 Cookie、不发 Referer、不缓存、不跟随重定向（防止被转发到别的域名）
  reqOpts(body, signal) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.cfg().apiKey.trim() }, body: JSON.stringify(body), signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', mode: 'cors' };
  },
  netErr(e, ctl) {
    if (e instanceof AIError) return e;
    if (ctl.signal.aborted) return new AIError(ctl.signal.reason === 'user' ? '已取消' : 'AI 响应超时，请稍后重试。', 'abort');
    if (!navigator.onLine) return new AIError('当前没有网络连接，AI 功能需要联网使用。', 'offline');
    return new AIError('无法连接 AI 服务。可能原因：\n① 该服务商不允许浏览器直接调用（CORS 跨域限制）——请换用设置中列出的已验证服务商（如 DeepSeek、硅基流动、通义千问、Kimi）；\n② 接口地址填写错误；\n③ 网络无法访问该服务（例如 OpenAI / Gemini 在中国大陆需特殊网络）。', 'cors');
  },
  httpErr(status, em) {
    const map = { 401: 'API Key 无效或已过期（401），请检查设置。', 403: '没有权限访问该模型（403），请确认账号已开通该模型。', 402: '账户余额不足（402），请到服务商控制台充值。', 404: '接口地址或模型名不存在（404），请检查设置。', 429: '请求太频繁或额度用完（429），请稍后再试。' };
    return new AIError((map[status] || `AI 服务返回错误（${status}）`) + (em ? `\n详情：${this.redact(String(typeof em === 'string' ? em : JSON.stringify(em))).slice(0, 300)}` : ''), 'http');
  },
  /** 流式对话（SSE）。onDelta(片段, 累计全文)；服务商不支持流式时自动按普通 JSON 解析 */
  async stream(messages, { signal, temperature = 0.8, maxTokens, model, onDelta = () => { } } = {}) {
    const c = this.cfg(); if (!this.ready()) throw new AIError('还没有配置 AI。请到「我的 → 设置 → AI 与隐私」填写接口地址、API Key 和模型名。', 'config');
    const body = { model: model || c.model, messages, temperature, stream: true }; if (maxTokens) body.max_tokens = maxTokens;
    const ctl = new AbortController(); let to = setTimeout(() => ctl.abort('timeout'), 90000);
    if (signal) signal.addEventListener('abort', () => ctl.abort('user'));
    let res; try { res = await fetch(this.url(), this.reqOpts(body, ctl.signal)); } catch (e) { clearTimeout(to); throw this.netErr(e, ctl); }
    if (!res.ok) { clearTimeout(to); const t = await res.text().catch(() => ''); let d = null; try { d = JSON.parse(t); } catch (e) { } throw this.httpErr(res.status, d?.error?.message || d?.message || d?.error || t.slice(0, 200)); }
    let full = '';
    const take = obj => { const ch = obj?.choices?.[0]; const piece = ch?.delta?.content ?? ch?.message?.content ?? ''; const p = Array.isArray(piece) ? piece.map(x => x.text || '').join('') : String(piece || ''); if (p) { full += p; onDelta(p, full); } };
    const handle = line => { line = line.trim(); if (!line.startsWith('data:')) return false; const d = line.slice(5).trim(); if (d === '[DONE]') return true; try { take(JSON.parse(d)); } catch (e) { } return false; };
    try {
      if (!res.body || !/event-stream/i.test(res.headers.get('content-type') || '')) {
        const t = await res.text(); let d = null; try { d = JSON.parse(t); } catch (e) { }
        if (d) take(d); else t.split('\n').forEach(handle);
      } else {
        const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = '', done = false;
        while (!done) {
          const r = await rd.read(); if (r.done) break;
          clearTimeout(to); to = setTimeout(() => ctl.abort('timeout'), 60000);
          buf += dec.decode(r.value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
          for (const l of lines) if (handle(l)) { done = true; break; }
        }
        if (buf) handle(buf);
        try { rd.cancel(); } catch (e) { }
      }
    } catch (e) { clearTimeout(to); if (full && !ctl.signal.aborted) return full; throw this.netErr(e, ctl); }
    clearTimeout(to);
    if (!full) throw new AIError('AI 返回内容为空或格式无法识别。', 'empty');
    return full;
  },
  parseJSON(text) {
    let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    // 去掉 <think> 推理内容
    t = t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const tries = s => { try { return [JSON.parse(s)]; } catch (e) { } try { return [JSON.parse(s.replace(/,\s*([}\]])/g, '$1'))]; } catch (e) { } const f = fixTexEscapes(s); if (f !== s) { try { return [JSON.parse(f)]; } catch (e) { } } return null; };
    let r = tries(t);
    if (!r) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) r = tries(t.slice(a, b + 1)); }
    if (r) return repairTex(r[0]);
    throw new AIError('AI 返回的内容不是有效的 JSON。', 'json');
  },
  async json(messages, validate, opts = {}) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      const txt = await this.chat(messages, { ...opts, json: true });
      try { const obj = this.parseJSON(txt); return validate ? validate(obj) : obj; }
      catch (e) { lastErr = e; messages = [...messages, { role: 'assistant', content: txt.slice(0, 4000) }, { role: 'user', content: `你的输出无法通过校验：${e.message}。请严格按要求只输出一个合法 JSON 对象，不要包含其他文字。` }]; }
    }
    throw lastErr;
  },
  async vision(dataUrl, prompt, opts = {}) {
    const c = this.cfg();
    if (!this.visionReady()) throw new AIError('还没有配置 AI。图片识别需要在设置中配置支持图片的模型（视觉模型）。', 'config');
    return this.chat([{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }], { ...opts, model: c.visionModel || c.model, temperature: 0.1 });
  },
  async ocr(dataUrl, opts) {
    return this.vision(dataUrl, '请识别并完整输出这张图片中的所有文字内容。要求：保持原有段落、标题层级和题号；数学公式用普通文本或 LaTeX 表示；表格用 Markdown 表格；不要添加任何解释、总结或额外内容。', opts);
  }
};
function showAIError(e) {
  const msg = AI.redact(e instanceof AIError ? e.message : ('出错了：' + (e?.message || e)));
  if (e?.kind === 'abort' && e.message === '已取消') return toast('已取消');
  openSheet(`<h2>😕 AI 调用失败</h2><div class="notice err pre">${esc(msg)}</div><div class="btns"><a class="btn plain" href="#/me/settings?s=ai" data-close-sheet>去设置</a><button class="btn" data-close-sheet>知道了</button></div>`);
}
async function withLoading(text, fn) {
  const ctl = new AbortController(); loading(true, text, ctl);
  try { return await fn(ctl.signal, t => $('#loadingText').textContent = t); }
  finally { loading(false); }
}

/* ---- LaTeX 与 JSON 转义冲突修复 ----
   模型常把 "\frac" 写成单反斜杠：JSON 中 \f、\b、\t、\r、\n 是合法转义，会被吞掉；\l、\s 等非法转义会导致解析失败。 */
function fixTexEscapes(s) {
  // 仅在字符串内部，把非法转义的反斜杠补成双反斜杠
  return s.replace(/"(?:[^"\\]|\\.)*"/g, str => str.replace(/\\\\|\\u[0-9a-fA-F]{4}|\\(.)/g, (m, c) => c === undefined ? m : ('"\\/bfnrt'.includes(c) && !/^[a-zA-Z]$/.test(c) ? m : (/[bfnrt]/.test(c) ? m : '\\\\' + c))));
}
function repairTex(o) {
  if (typeof o === 'string') {
    if (!/[\f\b\t\r\n]/.test(o)) return o;
    return o.replace(/\f(?=rac|orall|lat|box)/g, '\\f').replace(/\x08(?=eta|egin|ar|ig|inom|oldsymbol|ullet|ot)/g, '\\b')
      .replace(/\t(?=imes|heta|an|o\b|o[^a-z]|ext|au|riangle|ilde|op|frac|herefore)/g, '\\t').replace(/\r(?=ho|ight|m\b|angle|e\b|ceil|floor)/g, '\\r')
      .replace(/\n(?=(abla|eq|eg|u|ot|e|i|olimits|ewline|cong|mid|parallel|subset|exists|leq|geq)(?![a-zA-Z]))/g, '\\n');
  }
  if (Array.isArray(o)) return o.map(repairTex);
  if (o && typeof o === 'object') { for (const k in o) o[k] = repairTex(o[k]); }
  return o;
}
