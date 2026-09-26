// One-Euro filter (lightweight adaptive smoothing) + per-joint smoother.
// Pure JS. See Casiez et al. "1€ filter" — standard for landmark streams.
class OneEuro {
  constructor(freq = 30, minCutoff = 1.0, beta = 0.02, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
  alpha(cutoff) {
    const te = 1 / this.freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }
  filter(x, t = null) {
    if (this.xPrev == null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }
    if (t != null && this.tPrev != null) {
      const dt = Math.max(1e-3, (t - this.tPrev) / 1000);
      this.freq = 1 / dt;
      this.tPrev = t;
    }
    const dx = (x - this.xPrev) * this.freq;
    const aD = this.alpha(this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

// Smooths named joints: update({joint: {x, y}}, nowMs) -> smoothed map.
class JointSmoother {
  constructor(joints, opts = {}) {
    this.filters = {};
    for (const j of joints) {
      this.filters[j] = { x: new OneEuro(opts.freq, opts.minCutoff, opts.beta), y: new OneEuro(opts.freq, opts.minCutoff, opts.beta) };
    }
  }
  update(points, nowMs) {
    const out = {};
    for (const [name, f] of Object.entries(this.filters)) {
      const p = points[name];
      if (!p) continue;
      out[name] = { x: f.x.filter(p.x, nowMs), y: f.y.filter(p.y, nowMs), score: p.score };
    }
    return out;
  }
  reset() {
    Object.values(this.filters).forEach((f) => { f.x.reset(); f.y.reset(); });
  }
}

module.exports = { OneEuro, JointSmoother };
