// hr.js: heart rate from the mean RGB of facial skin (rPPG). Pure functions, no DOM, so Node can test them.
// resample -> POS -> zero-phase band-pass -> Hann spectrum -> interior-peak candidates scored with a harmonic sum
// -> tracker that gates on the previous estimate and halves or doubles only with spectral evidence.
// It returns "no estimate" rather than a guess when the spectrum has no clear periodic peak.
export const FS = 30, F_LO = 0.7, F_HI = 3, F_MAX = 4.2, GATE_BPM = 15, Q_MIN = 0.3, MIN_SPAN_S = 8;
const STEP = 0.01, F0 = 0.5;
const idx = f => Math.round((f - F0) / STEP);
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const std = a => { const m = mean(a); return Math.sqrt(mean(Array.from(a, v => (v - m) ** 2))); };

// Samples: [{t (ms, ascending), r, g, b}] -> uniform FS Hz channels.
export function resample(s) {
  const t0 = s[0].t, n = Math.floor((s[s.length - 1].t - t0) / 1e3 * FS), R = [], G = [], B = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const tt = t0 + i * 1e3 / FS;
    while (j < s.length - 2 && s[j + 1].t < tt) j++;
    const a = s[j], b = s[j + 1], u = Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t || 1)));
    R.push(a.r + u * (b.r - a.r)); G.push(a.g + u * (b.g - a.g)); B.push(a.b + u * (b.b - a.b));
  }
  return { R, G, B, n };
}

// POS (Wang et al. 2017): overlap-add over 1.6 s windows.
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

function spectrum(x) { // P[k] = Hann-windowed power at F0 + k*STEP Hz
  const n = x.length, m = mean(x);
  const w = Array.from(x, (v, i) => (v - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)))), P = [];
  for (let k = 0; k <= idx(F_MAX); k++) {
    const f = F0 + k * STEP;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * f * i / FS; re += w[i] * Math.cos(a); im -= w[i] * Math.sin(a); }
    P.push(re * re + im * im);
  }
  return P;
}

// Candidate rates for one window. Peaks must be interior local maxima, so a spectrum that merely rises
// towards the band edge (drift, breathing, motion) yields no candidate instead of a floor estimate.
export function analyze(samples) {
  const { R, G, B, n } = resample(samples);
  if (n < MIN_SPAN_S * FS) return null;
  const x = filtfilt(filtfilt(pos(R, G, B), biquad(true, 0.65)), biquad(false, 4.5));
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
  const cands = peaks.map(k => { const f = F0 + k * STEP; return { f, bpm: 60 * f, p: P[k], s: P[k] + 0.5 * pw(2 * f), snr: snr(f) }; })
    .sort((a, b) => b.s - a.s).slice(0, 4);
  for (const c of cands.slice()) { // a peak may be the 2nd harmonic of a weaker fundamental at f/2
    const h = c.f / 2;
    if (h >= F_LO && pw(h) >= 0.25 * c.p) cands.push({ f: h, bpm: 60 * h, p: pw(h), s: pw(h) + 0.5 * c.p, snr: snr(h), half: true });
  }
  return { cands, P };
}

// One tracker per session. update() returns {hr, q, snr, valid}; hr is null unless a gated estimate exists.
export function createTracker() {
  let hr = null, tHr = -1e9, alt = { bpm: 0, n: 0 };
  const out = (v, q, snr = NaN) => ({ hr: v, q, snr, valid: v !== null });
  return {
    reset() { hr = null; tHr = -1e9; alt = { bpm: 0, n: 0 }; },
    update(samples, now) {
      const A = samples.length > 1 ? analyze(samples) : null;
      if (!A) return out(null, 0);
      const sc = A.cands.map(c => ({ ...c, q: Math.min(1, Math.max(0, (c.snr + 6) / 12)) })), main = sc.filter(c => !c.half);
      if (!main.length) return out(null, 0);
      const best = main.reduce((a, b) => (b.s > a.s ? b : a)), tracking = hr !== null && now - tHr < 15e3;
      let pick = null;
      if (!tracking) {
        if (best.q >= Q_MIN) pick = best;
      } else {
        pick = sc.filter(c => Math.abs(c.bpm - hr) <= GATE_BPM && c.q >= Q_MIN).sort((a, b) => b.s - a.s)[0] || null;
        if (pick) alt = { bpm: 0, n: 0 };
        else { // nothing near the tracked rate: re-acquire only after 6 consistent windows elsewhere
          alt = best.q >= Q_MIN && Math.abs(best.bpm - alt.bpm) <= 5 ? { bpm: best.bpm, n: alt.n + 1 } : { bpm: best.bpm, n: best.q >= Q_MIN ? 1 : 0 };
          if (alt.n >= 6) { pick = best; hr = null; alt = { bpm: 0, n: 0 }; }
        }
      }
      if (!pick) return out(null, best.q);
      hr = hr === null ? pick.bpm : hr + 0.4 * (pick.bpm - hr);
      tHr = now;
      return out(hr, pick.q, pick.snr);
    },
  };
}
