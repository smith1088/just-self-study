'use strict';
/* ========== FSRS-5 间隔重复算法（移植自 open-spaced-repetition / ts-fsrs 的公式，默认参数） ==========
   记忆状态：稳定性 S（天，记住概率降到 90% 所需时间）、难度 D（1–10）。
   可提取性 R(t,S) = (1 + F·t/S)^C，C = -0.5，F = 19/81。
   下次间隔 I = S/F · (r^(1/C) − 1)，r 为期望记忆保持率（默认 0.9 → I ≈ S）。 */
const FSRS = {
  W: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
  DECAY: -0.5, FACTOR: 19 / 81,
  clampD: d => Math.min(10, Math.max(1, d)),
  R(t, s) { return Math.pow(1 + this.FACTOR * t / s, this.DECAY); },
  interval(s, ret, max = 36500) { const i = s / this.FACTOR * (Math.pow(ret, 1 / this.DECAY) - 1); return Math.min(max, Math.max(1, Math.round(i))); },
  s0(g) { return Math.max(0.1, this.W[g - 1]); },
  d0(g) { return this.clampD(this.W[4] - Math.exp(this.W[5] * (g - 1)) + 1); },
  nextD(d, g) { const W = this.W; const damp = d + (-W[6] * (g - 3)) * (10 - d) / 9; return this.clampD(W[7] * this.d0(4) + (1 - W[7]) * damp); },
  recallS(d, s, r, g) { const W = this.W; const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1; return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy); },
  forgetS(d, s, r) { const W = this.W; const f = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)); return Math.min(f, s / Math.exp(W[17] * W[18])); },
  shortS(s, g) { const W = this.W; return s * Math.exp(W[17] * (g - 3 + W[18])); },
  // 把旧 SM-2 卡片（ef/ivl）安全地映射成 FSRS 记忆状态；只在第一次用 FSRS 复习时执行
  migrate(c) {
    if (c.fs != null && c.fd != null) return { s: c.fs, d: c.fd };
    if (c.state === 'new' || !c.reps) return null;
    const ef = c.ef || 2.5; const d = this.clampD(10 - (ef - 1.3) / 2.2 * 9);
    const s = c.state === 'review' ? Math.max(0.5, c.ivl || 1) : Math.max(0.3, Math.min(this.W[2], c.ivl || this.W[2]));
    return { s, d };
  }
};
