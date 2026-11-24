// hr.js: heart rate from the mean RGB of facial skin (rPPG). Pure functions, no DOM, so Node can test them.
// resample -> despike & adaptive band-limited POS -> 4th-order zero-phase band-pass -> Hann spectrum + autocorrelation SQI
// -> interior-peak candidates scored with a harmonic sum -> tracker that gates on the previous estimate and prominence.
// It returns "no estimate" rather than a guess when the spectrum has no clear periodic peak.
export const FS = 30, F_LO = 0.7, F_HI = 3, F_MAX = 4.2, GATE_BPM = 18, Q_MIN = 0.3, MIN_SPAN_S = 8;
const STEP = 0.01, F0 = 0.5;
const idx = f => Math.round((f - F0) / STEP);
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const std = a => { const m = mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2; return Math.sqrt(s / a.length); };
const median = a => { const s = Array.from(a).sort((p, q) => p - q), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m])) : NaN; };
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { const u = a[i] - ma, v = b[i] - mb; ab += u * v; aa += u * u; bb += v * v; }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
};
// Motion protection and sub-ROI fusion constants (uncalibrated on real faces; tune with tools/audit_features.py data).
// MOT_K: block spread vs clean reference; MOT_RANGE: forehead excursion per 1 s block in face widths;
// ROI_MIN_CORR: minimum pulse agreement between two sub-ROIs before consensus fusion replaces the pooled mean.
export const MOT_K = 3, MOT_RANGE = 0.08, ROI_MIN_CORR = 0.3;
function detrendStd(a) {
  const n = a.length, xm = (n - 1) / 2, ym = mean(a);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (i - xm) * (a[i] - ym); sxx += (i - xm) ** 2; }
  const k = sxx > 0 ? sxy / sxx : 0;
  let s = 0;
  for (let i = 0; i < n; i++) { const r = a[i] - ym - k * (i - xm); s += r * r; }
  return Math.sqrt(s / n);
}
// Detrended spread after zeroing the two largest single-sample jumps, so exposure / white-balance steps do not count as motion.
function blockSpread(a) {
  const n = a.length;
  if (n < 4) return 0;
  const d = [];
  for (let i = 1; i < n; i++) d.push(a[i] - a[i - 1]);
  const order = d.map((v, i) => [Math.abs(v), i]).sort((p, q) => q[0] - p[0]);
  d[order[0][1]] = 0;
  d[order[1][1]] = 0;
  const y = new Float64Array(n);
  for (let i = 1; i < n; i++) y[i] = y[i - 1] + d[i - 1];
  return detrendStd(y);
}

// Samples: [{t (ms, ascending), r, g, b}] -> uniform FS Hz channels.
// Broadened YCbCr chrominance bounds accommodate South Asian / diverse skin tones under warm indoor LED or cool screen glow.
export function isSkin(r, g, b) {
  if (r < 30 || r > 248 || g < 18 || b < 12 || r <= g || r <= b) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 72 && cb <= 142 && cr >= 124 && cr <= 185;
}

// 1D Kalman + deadband hysteresis filter for stabilizing facial ROI coordinates (ported from open-rppg).
// Eliminates frame-to-frame integer crop box jumping caused by sub-pixel MediaPipe landmark jitter on stationary faces.
export function createRoiStabilizer(q = 0.015, r = 0.4, deadband = 0.012) {
  let st = null, locked = null;
  return {
    reset() { st = null; locked = null; },
    update(vals, dt = 1 / 30) {
      if (!vals || vals.some(v => !Number.isFinite(v))) return locked || vals;
      const scale = Math.max(0.2, Math.min(5, dt * 30)), qp = q * scale * scale;
      if (!st) {
        st = vals.map(v => ({ x: v, p: 1 }));
        locked = vals.slice();
        return locked;
      }
      const sm = vals.map((v, i) => {
        const p = st[i].p + qp, k = p / (p + r);
        st[i].x += k * (v - st[i].x);
        st[i].p = (1 - k) * p;
        return st[i].x;
      });
      const ref = Math.max(1, Math.abs(locked[locked.length - 1] || 50));
      if (sm.some((v, i) => Math.abs(v - locked[i]) / ref > deadband)) locked = sm.slice();
      return locked;
    }
  };
}

// Optional per-sample fields: sub = [[r,g,b] x 3 sub-ROIs] (forehead, left cheek, right cheek) and mx/my = raw forehead
// landmark position in face widths. Each sub-ROI slot is retained if present in >= 80% of frames (>= 2 active slots),
// falling back to the frame mean [r,g,b] on isolated dropped frames; mx/my require 100% coverage.
export function resample(s) {
  if (!s || !s.length) return { R: [], G: [], B: [], n: 0, SUB: null, MX: null, MY: null };
  let startIdx = 0;
  for (let i = 1; i < s.length; i++) {
    if (s[i].t - s[i - 1].t > 650) startIdx = i;
  }
  if (startIdx > 0) s = s.slice(startIdx);
  const t0 = s[0].t, n = Math.floor((s[s.length - 1].t - t0) / 1e3 * FS), R = [], G = [], B = [];
  const validSub = (o, k) => Array.isArray(o.sub?.[k]) && o.sub[k].length === 3 && o.sub[k].every(Number.isFinite);
  const activeSub = [0, 1, 2].filter(k => s.filter(o => validSub(o, k)).length >= 0.8 * s.length);
  const hasMot = s.every(o => Number.isFinite(o.mx) && Number.isFinite(o.my));
  const SUB = activeSub.length >= 2 ? activeSub.map(() => ({ R: [], G: [], B: [] })) : null, MX = hasMot ? [] : null, MY = hasMot ? [] : null;
  // Interpolate isolated dropped frames per sub-ROI from that same slot's nearest valid samples (never the pooled mean).
  const filledSub = SUB ? activeSub.map(k => {
    const out = new Array(s.length), validIdx = [];
    for (let m = 0; m < s.length; m++) {
      if (validSub(s[m], k)) { out[m] = s[m].sub[k]; validIdx.push(m); }
    }
    const first = validIdx[0], last = validIdx[validIdx.length - 1];
    for (let m = 0; m < first; m++) out[m] = s[first].sub[k];
    for (let m = last + 1; m < s.length; m++) out[m] = s[last].sub[k];
    for (let idxV = 0; idxV < validIdx.length - 1; idxV++) {
      const a0 = validIdx[idxV], a1 = validIdx[idxV + 1];
      if (a1 - a0 <= 1) continue;
      const p0 = s[a0].sub[k], p1 = s[a1].sub[k], dt = (s[a1].t - s[a0].t) || 1;
      for (let m = a0 + 1; m < a1; m++) {
        const w = Math.min(1, Math.max(0, (s[m].t - s[a0].t) / dt));
        out[m] = [p0[0] + w * (p1[0] - p0[0]), p0[1] + w * (p1[1] - p0[1]), p0[2] + w * (p1[2] - p0[2])];
      }
    }
    return out;
  }) : null;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const tt = t0 + i * 1e3 / FS;
    while (j < s.length - 2 && s[j + 1].t < tt) j++;
    const a = s[j], b = s[j + 1], u = Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t || 1)));
    R.push(a.r + u * (b.r - a.r)); G.push(a.g + u * (b.g - a.g)); B.push(a.b + u * (b.b - a.b));
    if (SUB) {
      for (let idxSub = 0; idxSub < activeSub.length; idxSub++) {
        const p = filledSub[idxSub][j], q = filledSub[idxSub][j + 1];
        SUB[idxSub].R.push(p[0] + u * (q[0] - p[0])); SUB[idxSub].G.push(p[1] + u * (q[1] - p[1])); SUB[idxSub].B.push(p[2] + u * (q[2] - p[2]));
      }
    }
    if (MX) { MX.push(a.mx + u * (b.mx - a.mx)); MY.push(a.my + u * (b.my - a.my)); }
  }
  return { R, G, B, n, SUB, MX, MY };
}

// Baseline POS (Wang et al. 2017): overlap-add over 1.6 s windows.
export function pos(R, G, B) {
  const n = R.length, l = Math.round(1.6 * FS), H = new Float64Array(n);
  for (let t = 0; t + l <= n; t++) {
    const r = R.slice(t, t + l), g = G.slice(t, t + l), b = B.slice(t, t + l), mr = mean(r), mg = mean(g), mb = mean(b);
    const s1 = g.map((v, i) => v / mg - b[i] / mb), s2 = g.map((v, i) => -2 * r[i] / mr + v / mg + b[i] / mb);
    const a = std(s1) / (std(s2) || 1), h = s1.map((v, i) => v + a * s2[i]), m = mean(h);
    for (let i = 0; i < l; i++) H[t + i] += h[i] - m;
  }
  return H;
}

// 2nd-order Butterworth biquad (RBJ cookbook), run forward and backward for zero phase.
function biquad(highpass, fc) {
  const w = 2 * Math.PI * fc / FS, c = Math.cos(w), a = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + a, k = highpass ? 1 : -1;
  return { b: [(1 + k * c) / 2 / a0, -k * (1 + k * c) / a0, (1 + k * c) / 2 / a0], a: [1, -2 * c / a0, (1 - a) / a0] };
}
function filt(x, { b, a }) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function filtfilt(x, coef) { // odd-reflection padding tames the edge transients
  const n = x.length, p = Math.min(n - 1, Math.round(3 * FS)), e = new Float64Array(n + 2 * p);
  for (let i = 0; i < p; i++) { e[i] = 2 * x[0] - x[p - i]; e[n + p + i] = 2 * x[n - 1] - x[n - 2 - i]; }
  e.set(x, p);
  return filt(filt(e, coef).reverse(), coef).reverse().slice(p, p + n);
}

// Suppress sudden auto-exposure / screen-glow step jumps via median-MAD derivative clipping.
export function despike(x) {
  const n = x.length;
  if (n < 6) return Float64Array.from(x);
  const dx = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) dx[i] = x[i + 1] - x[i];
  const sorted = Array.from(dx, Math.abs).sort((a, b) => a - b);
  const mad = (sorted[Math.floor(sorted.length * 0.5)] || 1e-6) * 1.4826, lim = 5.0 * mad;
  const out = new Float64Array(n);
  out[0] = x[0];
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i];
    out[i + 1] = out[i] + (Math.abs(d) > lim ? Math.sign(d) * lim : d);
  }
  return out;
}

// Band-limited, covariance-regularized POS with Hann unity-gain overlap-add and warm-light blue fallback.
export function posClean(R, G, B) {
  const n = R.length, l = Math.round(1.6 * FS), H = new Float64Array(n), W = new Float64Array(n);
  if (n < l) return H;
  const mr0 = mean(R) || 1, mg0 = mean(G) || 1, mb0 = mean(B) || 1;
  const hpNoise = biquad(true, 4.5);
  // Remove DC and apply zero-phase highpass so edge step transients do not swamp CMOS noise comparison
  const gNoise = std(filtfilt(G.map(v => v / mg0 - 1), hpNoise)), bNoise = std(filtfilt(B.map(v => v / mb0 - 1), hpNoise));
  // Under warm indoor lighting, blue channel CMOS noise spikes; synthesize clean chrominance reference
  const Buse = bNoise > 2.2 * gNoise ? G.map((g, i) => mb0 * (0.7 * (g / mg0) + 0.3 * (R[i] / mr0))) : B;

  const lp = biquad(false, 3.5);
  const Rf = filtfilt(despike(R), lp), Gf = filtfilt(despike(G), lp), Bf = filtfilt(despike(Buse), lp);
  const mrf = mean(Rf) || 1, mgf = mean(Gf) || 1, mbf = mean(Bf) || 1;

  // Regularize local 1.6 s alpha with global low-frequency covariance to avoid cross-modulating slow drift
  const S1g = Gf.map((v, i) => v / mgf - Bf[i] / mbf);
  const S2g = Gf.map((v, i) => -2 * Rf[i] / mrf + v / mgf + Bf[i] / mbf);
  const m1g = mean(S1g), m2g = mean(S2g);
  let cov = 0, var2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = S1g[i] - m1g, d2 = S2g[i] - m2g;
    cov += d1 * d2;
    var2 += d2 * d2;
  }
  const rawGlobal = cov < 0 && var2 > 1e-12 ? -cov / var2 : std(S1g) / (std(S2g) || 1);
  const aGlobal = Math.max(0.05, Math.min(10, rawGlobal));

  const hann = new Float64Array(l);
  for (let i = 0; i < l; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (l - 1));

  for (let t = 0; t + l <= n; t++) {
    const r = Rf.slice(t, t + l), g = Gf.slice(t, t + l), b = Bf.slice(t, t + l);
    const mr = mean(r) || 1, mg = mean(g) || 1, mb = mean(b) || 1;
    const s1 = g.map((v, i) => v / mg - b[i] / mb), s2 = g.map((v, i) => -2 * r[i] / mr + v / mg + b[i] / mb);
    const aLocal = Math.min(10, std(s1) / (std(s2) || 1));
    const a = 0.65 * aGlobal + 0.35 * aLocal;
    const h = s1.map((v, i) => v + a * s2[i]), m = mean(h);
    for (let i = 0; i < l; i++) {
      const w = hann[i];
      H[t + i] += (h[i] - m) * w;
      W[t + i] += w;
    }
  }
  for (let i = 0; i < n; i++) if (W[i] > 1e-6) H[i] /= W[i];
  return H;
}

// Autocorrelation Signal Quality Index (ported from open-rppg SQI): measures waveform periodicity in [fLo, fHi].
export function sqi(x, fLo = F_LO, fHi = F_HI) {
  const n = x.length;
  if (n < 2 * FS) return 0;
  const m = mean(x), s = std(x);
  if (s < 1e-12) return 0;
  const z = Float64Array.from(x, v => (v - m) / s);
  const minLag = Math.max(1, Math.floor(FS / fHi)), maxLag = Math.min(n - 2, Math.ceil(FS / fLo));
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += z[i] * z[i + lag];
    c /= (n - lag);
    if (c > best) best = c;
  }
  return Math.max(0, Math.min(1, best));
}

function spectrum(x) { // P[k] = Hann-windowed power at F0 + k*STEP Hz via Goertzel recurrence
  const n = x.length, m = mean(x);
  const w = Float64Array.from(x, (v, i) => (v - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)))), P = [];
  for (let k = 0; k <= idx(F_MAX); k++) {
    const coeff = 2 * Math.cos(2 * Math.PI * (F0 + k * STEP) / FS);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const s0 = w[i] + coeff * s1 - s2; s2 = s1; s1 = s0; }
    P.push(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
  }
  return P;
}

// Motion protection. A 1 s block is motion-contaminated when its detrended relative green spread exceeds MOT_K x the
// clean reference, or when the raw forehead landmark moved more than MOT_RANGE face widths within the block (app.js hint).
export function motionBlocks(G, MX, MY, n, refStd = 0) {
  const nb = Math.floor(n / FS);
  const blockMetric = (s, e) => {
    const g = G.slice(s, e);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    if (MX && MY) {
      for (let i = s; i < e; i++) {
        if (MX[i] < x0) x0 = MX[i];
        if (MX[i] > x1) x1 = MX[i];
        if (MY[i] < y0) y0 = MY[i];
        if (MY[i] > y1) y1 = MY[i];
      }
    }
    return {
      rel: g.length >= 4 ? blockSpread(g) / (Math.abs(mean(g)) || 1) : 0,
      ext: MX && MY && e > s ? Math.hypot(x1 - x0, y1 - y0) : 0
    };
  };
  const blocks = [];
  for (let b = 0; b < nb; b++) blocks.push(blockMetric(b * FS, (b + 1) * FS));
  const rel = blocks.map(m => m.rel), med = median(rel), ref = refStd > 0 ? Math.min(refStd, med) : med;
  const flags = blocks.map(m => m.rel > MOT_K * ref || (MX && MY && m.ext > MOT_RANGE));
  const tail = n > nb * FS ? blockMetric(nb * FS, n) : null;
  const tailFlag = tail ? ((n - nb * FS >= 6 && tail.rel > MOT_K * ref) || (MX && MY && tail.ext > MOT_RANGE)) : false;
  const clean = rel.filter((_, b) => !flags[b]);
  return { flags, tailFlag, nb, clean: clean.length ? median(clean) : med };
}

// Consensus fusion of sub-ROI pulse waves: the most coherent pair defines the reference; each ROI is weighted by its squared
// agreement with it, so a region corrupted by expression (brow furrow, smile) is down-weighted instead of pooled.
export function fuseRois(xs) {
  const z = xs.map(x => { const m = mean(x), s = std(x) || 1; return Float64Array.from(x, v => (v - m) / s); });
  let bi = 0, bj = 1, bc = -Infinity;
  for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) { const c = corr(z[i], z[j]); if (c > bc) { bc = c; bi = i; bj = j; } }
  if (!(bc >= ROI_MIN_CORR)) return null; // no two regions agree on a pulse: keep the pooled mean
  const ref = z[bi].map((v, k) => 0.5 * (v + z[bj][k]));
  const w = z.map(zi => Math.max(0, corr(zi, ref)) ** 2), sw = w.reduce((a, b) => a + b, 0) || 1;
  const x = new Float64Array(z[0].length);
  for (let i = 0; i < z.length; i++) if (w[i] > 0) for (let k = 0; k < x.length; k++) x[k] += (w[i] / sw) * z[i][k];
  return { x, w: w.map(v => v / sw), agree: bc };
}

// Candidate rates for one window. Peaks must be interior local maxima, so a spectrum that merely rises
// towards the band edge (drift, breathing, motion) yields no candidate instead of a floor estimate.
// opts.refStd: the tracker's clean block-spread reference. Returns motion: true (no candidates) when no clean 8 s stretch exists.
export function analyze(samples, opts = {}) {
  let { R, G, B, n, SUB, MX, MY } = resample(samples);
  if (n < MIN_SPAN_S * FS) return null;
  const mb = motionBlocks(G, MX, MY, n, opts.refStd);
  const flagged = mb.flags.filter(Boolean).length + (mb.tailFlag ? 1 : 0);
  let a0 = 0, a1 = n;
  if (flagged) { // keep the longest motion-free stretch; abstain when none reaches MIN_SPAN_S
    let bestS = 0, bestL = 0, runS = 0;
    for (let b = 0; b <= mb.nb; b++) {
      if (b === mb.nb || mb.flags[b]) {
        if (b - runS > bestL) { bestL = b - runS; bestS = runS; }
        runS = b + 1;
      }
    }
    if (bestL < MIN_SPAN_S) return { cands: [], P: null, x: null, sqi: 0, motion: true, flagged, blockStd: mb.clean, roiW: null };
    a0 = bestS * FS;
    a1 = bestS + bestL === mb.nb && !mb.tailFlag ? n : (bestS + bestL) * FS;
  } else { // unchanged v0.8.4 leading motion-tail trim
    const keep = Math.round(8.5 * FS);
    if (n >= keep + FS) {
      const head = n - keep;
      if (std(G.slice(0, head)) > 2.2 * std(G.slice(head))) a0 = head;
    }
  }
  if (a0 > 0 || a1 < n) {
    const cut = a => a.slice(a0, a1);
    R = cut(R); G = cut(G); B = cut(B);
    if (SUB) SUB = SUB.map(c => ({ R: cut(c.R), G: cut(c.G), B: cut(c.B) }));
    n = a1 - a0;
  }
  const hp = biquad(true, 0.66), lp = biquad(false, 4.2), bp = h => filtfilt(filtfilt(filtfilt(h, hp), hp), lp);
  let x = bp(posClean(R, G, B)), roi = null;
  if (SUB) {
    roi = fuseRois(SUB.map(c => bp(posClean(c.R, c.G, c.B))));
    if (roi) x = roi.x;
  }
  const P = spectrum(x), lo = idx(F_LO), hi = idx(F_HI), top = idx(F_MAX);
  let band = 0;
  for (let k = lo; k <= top; k++) band += P[k];
  const pw = f => { const c = idx(f); let m = 0; for (let k = Math.max(0, c - 5); k <= Math.min(top, c + 5); k++) m = Math.max(m, P[k]); return m; };
  const snr = f => { // power within +-0.1 Hz of f and of 2f against the rest of the band, in dB
    let sig = 0;
    for (const h of [1, 2]) { const c = idx(f * h); for (let k = Math.max(lo, c - 10); k <= Math.min(top, c + 10); k++) sig += P[k]; }
    return 10 * Math.log10(Math.max(sig, 1e-30) / Math.max(band - sig, 1e-30));
  };
  const peaks = [];
  for (let k = lo + 1; k < hi; k++) if (P[k] > P[k - 1] && P[k] >= P[k + 1]) peaks.push(k);
  const xm = mean(x), xs = std(x);
  const z = xs > 1e-12 ? Float64Array.from(x, v => (v - xm) / xs) : null;
  const autocorrAt = lag => {
    if (!z || lag < 1 || lag >= z.length - 2) return 0;
    let c = 0;
    for (let i = 0; i < z.length - lag; i++) c += z[i] * z[i + lag];
    return c / (z.length - lag);
  };
  const lnP = k => Math.log(Math.max(P[k], 1e-300));
  const refine = k => { // quadratic interpolation of log-power (exact for a Gaussian main lobe), offset clamped to half a bin
    const a = lnP(k - 1), b = lnP(k), c = lnP(k + 1), d = a - 2 * b + c;
    return F0 + (k + (d < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / d)) : 0)) * STEP;
  };
  const cands = peaks.map(k => {
    const f = refine(k), l0 = Math.round(FS / f);
    const corr = Math.max(autocorrAt(l0 - 1), autocorrAt(l0), autocorrAt(l0 + 1));
    return { f, bpm: 60 * f, p: P[k], s: P[k] + 0.5 * pw(2 * f), snr: snr(f), corr: Math.max(0, corr) };
  }).sort((a, b) => b.s - a.s).slice(0, 6);
  for (const c of cands.slice()) { // a peak may be the 2nd harmonic of a weaker fundamental at f/2
    const h = c.f / 2;
    if (h >= F_LO && pw(h) >= 0.22 * c.p) {
      const l0 = Math.round(FS / h);
      const corr = Math.max(autocorrAt(l0 - 1), autocorrAt(l0), autocorrAt(l0 + 1));
      if (corr >= 0.12) {
        cands.push({ f: h, bpm: 60 * h, p: pw(h), s: pw(h) + 0.5 * c.p, snr: snr(h), corr, half: true });
      }
    }
  }
  return { cands, P, x, sqi: sqi(x), motion: false, flagged, blockStd: mb.clean, roiW: roi ? roi.w : null };
}

// Inter-beat interval RMSSD (ms) from zero-phase fundamental-band pulse wave and estimated BPM.
// Ectopy / motion-beat rejection: IBIs outside 0.75-1.25 x t0, or further than max(3 robust SD, 8 %) from the median IBI,
// are dropped, and successive differences are only taken between adjacent accepted beats.
export function rmssd(x, bpm) {
  if (!x || x.length < MIN_SPAN_S * FS || !Number.isFinite(bpm)) return null;
  const f0 = bpm / 60, y = filtfilt(filtfilt(x, biquad(true, Math.max(0.6, 0.72 * f0))), biquad(false, Math.min(3.5, 1.38 * f0)));
  const minDist = 0.65 * FS / f0, pks = [];
  for (let i = 1; i < y.length - 1; i++) {
    if (y[i] > 0 && y[i] > y[i - 1] && y[i] >= y[i + 1]) {
      const d = y[i - 1] - 2 * y[i] + y[i + 1], t = i + (d ? 0.5 * (y[i - 1] - y[i + 1]) / d : 0);
      if (!pks.length || t - pks[pks.length - 1].t >= minDist) pks.push({ t, v: y[i] });
      else if (y[i] > pks[pks.length - 1].v) pks[pks.length - 1] = { t, v: y[i] };
    }
  }
  const t0 = 6e4 / bpm, ibi = [];
  for (let i = 1; i < pks.length; i++) {
    const dt = (pks[i].t - pks[i - 1].t) * 1e3 / FS;
    ibi.push(dt >= 0.75 * t0 && dt <= 1.25 * t0 ? dt : NaN);
  }
  const ok = ibi.filter(Number.isFinite);
  if (ok.length < 4) return null;
  const med = median(ok), sig = 1.4826 * median(ok.map(v => Math.abs(v - med))), lim = Math.max(3 * sig, 0.08 * med);
  const keep = ibi.map(v => (Number.isFinite(v) && Math.abs(v - med) <= lim ? v : NaN));
  const diffs = [];
  for (let i = 1; i < keep.length; i++) if (Number.isFinite(keep[i]) && Number.isFinite(keep[i - 1])) diffs.push(keep[i] - keep[i - 1]);
  if (keep.filter(Number.isFinite).length < 4 || diffs.length < 3) return null;
  return Math.min(200, Math.max(5, Math.sqrt(mean(diffs.map(d => d * d)))));
}

// One tracker per session. update() returns {hr, hrv, q, snr, valid, motion}; hr is null unless a gated estimate exists.
// Motion-contaminated windows abstain and freeze the state (EMA, alt, lock) so a rhythmic head movement can neither drag
// the estimate nor win re-acquisition; the lock's time-to-live is extended by the motion time (max 15 s).
export function createTracker() {
  let hr = null, hrv = null, tHr = -1e9, alt = { bpm: 0, n: 0 }, lock = { bpm: 0, n: 0 };
  let refStd = 0, dirty = 0, holdMs = 0, tPrev = null;
  const out = (v, q, snr = NaN, hv = null, motion = false) => ({ hr: v, hrv: hv, q, snr, valid: v !== null, motion });
  return {
    reset() { hr = null; hrv = null; tHr = -1e9; alt = { bpm: 0, n: 0 }; lock = { bpm: 0, n: 0 }; refStd = 0; dirty = 0; holdMs = 0; tPrev = null; },
    update(samples, now) {
      const dtW = tPrev === null ? 1e3 : Math.max(0, Math.min(5e3, now - tPrev));
      tPrev = now;
      const A = samples.length > 1 ? analyze(samples, { refStd }) : null;
      if (!A) return out(null, 0);
      if (!A.motion) {
        if (A.blockStd > 0) refStd = refStd > 0 ? 0.9 * refStd + 0.1 * A.blockStd : A.blockStd;
        dirty = 0;
      } else if (++dirty >= 30) { refStd = 0; dirty = 0; } // persistent motion abstention: re-learn the clean reference
      const tracking = hr !== null && now - tHr < 20e3 + Math.min(15e3, holdMs);
      if (!tracking && hr !== null) { hr = null; hrv = null; }
      if (A.motion) {
        if (tracking) holdMs += dtW;
        return out(null, 0, NaN, null, true);
      }
      const sc = A.cands.map(c => ({ ...c, q: Math.min(1, Math.max(0, (c.snr + 5.75) / 12)) })), main = sc.filter(c => !c.half);
      if (!main.length) return out(null, 0);
      const best = main.reduce((a, b) => (b.s > a.s ? b : a));
      const secondS = main.filter(c => Math.abs(c.bpm - best.bpm) > 8).reduce((m, c) => Math.max(m, c.s), 0);
      const prom = secondS > 0 ? best.s / secondS : 10;
      let pick = null;
      if (!tracking) {
        const isLowFreq = best.bpm < 58;
        const confident = best.q >= Q_MIN && (A.sqi >= 0.24 || (best.corr >= 0.24 && prom >= 1.7));
        if (confident) {
          if (!isLowFreq) {
            pick = best;
            lock = { bpm: best.bpm, n: 2 };
          } else {
            // Low frequencies (< 58 bpm) strictly require 2 consecutive consistent windows to reject post-exercise panting
            if (Math.abs(best.bpm - lock.bpm) <= 3.8 && lock.n >= 1) {
              pick = best;
              lock = { bpm: 0.5 * (lock.bpm + best.bpm), n: lock.n + 1 };
            } else {
              lock = { bpm: best.bpm, n: 1 };
            }
          }
        } else if (best.q >= 0.22 && prom >= 1.75 && (best.corr >= 0.22 || A.sqi >= 0.25)) {
          lock = Math.abs(best.bpm - lock.bpm) <= 3.8 ? { bpm: 0.5 * (lock.bpm + best.bpm), n: lock.n + 1 } : { bpm: best.bpm, n: 1 };
          if (lock.n >= 3 || (lock.n >= 2 && best.corr >= 0.30 && !isLowFreq)) { pick = best; lock = { bpm: best.bpm, n: 2 }; }
        } else {
          lock = { bpm: 0, n: 0 };
        }
      } else {
        const dtSec = Math.max(0.5, Math.min(10, (now - tHr) / 1e3));
        const gate = Math.min(GATE_BPM, Math.max(12, 10 + 2 * dtSec));
        const scoreTrack = c => c.s * Math.exp(-0.5 * ((Math.abs(c.bpm - hr) / 7.5) ** 2)) * (1 + 0.25 * c.corr);
        pick = sc.filter(c => {
          const d = Math.abs(c.bpm - hr);
          if (d > gate) return false;
          const qHold = (d <= 8 && (c.corr >= 0.16 || A.sqi >= 0.22 || c.s >= 0.55 * best.s)) ? 0.15
            : (c.corr >= 0.18 || A.sqi >= 0.22 || prom >= 1.55) ? 0.18 : 0.25;
          return c.q >= qHold;
        }).sort((a, b) => scoreTrack(b) - scoreTrack(a))[0] || null;
        if (pick) {
          alt = { bpm: 0, n: 0 };
          if (pick.q >= 0.25) lock.n++;
        } else { // nothing near the tracked rate: re-acquire alternate peak after 4 consistent windows
          alt = best.q >= 0.25 && Math.abs(best.bpm - alt.bpm) <= 5 ? { bpm: best.bpm, n: alt.n + 1 } : { bpm: best.bpm, n: best.q >= 0.25 ? 1 : 0 };
          if (alt.n >= 4 || (alt.n >= 3 && best.q >= 0.32 && best.corr >= 0.28)) { pick = best; hr = null; hrv = null; alt = { bpm: 0, n: 0 }; lock = { bpm: best.bpm, n: 1 }; }
        }
      }
      if (!pick) return out(null, best.q);
      holdMs = 0;
      const dPick = Math.abs(pick.bpm - (hr ?? pick.bpm));
      const alpha = hr === null ? 1 : (dPick <= 4 ? 0.25 : 0.35);
      hr = hr === null ? pick.bpm : hr + alpha * (pick.bpm - hr);
      const rawHrv = rmssd(A.x, hr);
      if (rawHrv !== null) hrv = hrv === null ? rawHrv : hrv + 0.35 * (rawHrv - hrv);
      tHr = now;
      return out(hr, Math.max(pick.q, Q_MIN), pick.snr, rawHrv !== null ? hrv : null);
    },
  };
}
