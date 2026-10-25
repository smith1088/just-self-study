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
class AIError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
const AI = {
  cfg() { return S.settings.ai; },
  ready() { const c = this.cfg(); return !!(c.apiKey && c.baseUrl && c.model); },
  visionReady() { const c = this.cfg(); return !!(c.apiKey && c.baseUrl && (c.visionModel || c.model)); },
  url() { let b = this.cfg().baseUrl.trim().replace(/\/+$/, ''); if (/\/chat\/completions$/.test(b)) return b; return b + '/chat/completions'; },
  async chat(messages, { json = false, signal, temperature = 0.4, model, maxTokens } = {}) {
    const c = this.cfg(); if (!this.ready()) throw new AIError('还没有配置 AI。请到「我的 → 设置 → AI 设置」填写接口地址、API Key 和模型名。', 'config');
    const body = { model: model || c.model, messages, temperature, stream: false };
    if (maxTokens) body.max_tokens = maxTokens;
    if (json && c.jsonMode) body.response_format = { type: 'json_object' };
    let res;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort('timeout'), 180000);
    if (signal) signal.addEventListener('abort', () => ctl.abort('user'));
    try {
      res = await fetch(this.url(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey.trim() }, body: JSON.stringify(body), signal: ctl.signal });
    } catch (e) {
      clearTimeout(to);
      if (ctl.signal.aborted) throw new AIError(ctl.signal.reason === 'user' ? '已取消' : 'AI 响应超时（超过 3 分钟），请减少题量或内容后重试。', 'abort');
      if (!navigator.onLine) throw new AIError('当前没有网络连接，AI 功能需要联网使用。', 'offline');
      throw new AIError('无法连接 AI 服务。可能原因：\n① 该服务商不允许浏览器直接调用（CORS 跨域限制）——请换用设置中列出的已验证服务商（如 DeepSeek、硅基流动、通义千问、Kimi）；\n② 接口地址填写错误；\n③ 网络无法访问该服务（例如 OpenAI / Gemini 在中国大陆需特殊网络）。', 'cors');
    }
    clearTimeout(to);
    let text = await res.text(); let data = null; try { data = JSON.parse(text); } catch (e) { }
    if (!res.ok) {
      const em = data?.error?.message || data?.message || data?.error || text.slice(0, 200);
      if (json && c.jsonMode && res.status === 400 && /response_format|json/i.test(String(em))) { // 不支持 JSON 模式，降级重试
        return this.chat(messages, { json: false, signal, temperature, model, maxTokens });
      }
      const map = { 401: 'API Key 无效或已过期（401），请检查设置。', 403: '没有权限访问该模型（403），请确认账号已开通该模型。', 402: '账户余额不足（402），请到服务商控制台充值。', 404: '接口地址或模型名不存在（404），请检查设置。', 429: '请求太频繁或额度用完（429），请稍后再试。' };
      throw new AIError((map[res.status] || `AI 服务返回错误（${res.status}）`) + (em ? `\n详情：${String(typeof em === 'string' ? em : JSON.stringify(em)).slice(0, 300)}` : ''), 'http');
    }
    const out = data?.choices?.[0]?.message?.content;
    if (out == null) throw new AIError('AI 返回内容为空或格式无法识别。', 'empty');
    return Array.isArray(out) ? out.map(p => p.text || '').join('') : String(out);
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
  const msg = e instanceof AIError ? e.message : ('出错了：' + (e?.message || e));
  if (e?.kind === 'abort' && e.message === '已取消') return toast('已取消');
  openSheet(`<h2>😕 AI 调用失败</h2><div class="notice err pre">${esc(msg)}</div><div class="btns"><a class="btn plain" href="#/me/settings" onclick="closeSheet()">去设置</a><button class="btn" onclick="closeSheet()">知道了</button></div>`);
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
