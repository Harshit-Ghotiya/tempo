// Run: node --test tests/hr.test.mjs
// Synthetic skin-colour traces with a known pulse. The v0.4 estimator is replicated (oldHR) so each
// scenario shows whether the failure seen in the real session (band-floor lock, 2x harmonic) is reproduced
// and then fixed. This validates the algorithm's logic, not its accuracy on real faces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, resample, pos, isSkin } from '../hr.js';

function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// pulse: amplitude; harm: 2nd-harmonic ratio (number or fn of time); red: channel-dependent low-frequency
// artefact (breathing/motion/lighting); lf: [Hz, amplitude] slow periodic artefact; burst: [t0, t1, amplitude] broadband motion.
function trace({ secs = 70, hr = () => 60, pulse = 1, harm = 0.3, noise = 0.002, red = 0, lf = null, burst = null, seed = 1 }) {
  const r = rng(seed), out = [], gain = [0.0008, 0.0035, 0.0016], base = [180, 120, 100], mot = [0.02, 0.012, 0.008];
  const ph = Array.from({ length: 40 }, () => 2 * Math.PI * r()), fr = Array.from({ length: 40 }, (_, k) => 0.05 + 0.02 * k + 0.02 * r());
  let phi = 0;
  for (let i = 0; i * 1e3 / 30 < secs * 1e3; i++) {
    const t = i * 1e3 / 30 + (r() - 0.5) * 4, s = t / 1e3;
    phi += 2 * Math.PI * (hr(s) / 60) / 30; // hr is in bpm
    const hv = typeof harm === 'function' ? harm(s) : harm, p = pulse * (Math.cos(phi) + hv * Math.cos(2 * phi + 0.7));
    let m = 0;
    for (let k = 0; k < 40; k++) m += Math.sin(2 * Math.PI * fr[k] * s + ph[k]) / fr[k];
    m *= red / 40;
    if (lf) m += lf[1] * Math.sin(2 * Math.PI * lf[0] * s); // slow breathing / nodding at lf[0] Hz
    const b = burst && s >= burst[0] && s < burst[1] ? burst[2] : 0;
    const px = [0, 1, 2].map(c => base[c] * (1 + gain[c] * p + mot[c] * m + noise * gauss(r) + b * gauss(r) * [1, 0.7, 0.5][c]));
    out.push({ t, r: px[0], g: px[1], b: px[2] });
  }
  return out;
}

function oldHR(win) { // the v0.4 estimator: POS, Hann, argmax over 0.7-3.0 Hz
  if (win.length < 200) return null;
  const { R, G, B, n } = resample(win);
  if (n < 240) return null;
  const H = pos(R, G, B), m = H.reduce((s, v) => s + v, 0) / n, x = Array.from(H, (v, i) => (v - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  let best = 0, bf = 0;
  for (let f = 0.7; f <= 3.0001; f += 0.01) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * f * i / 30; re += x[i] * Math.cos(a); im -= x[i] * Math.sin(a); }
    const p = re * re + im * im;
    if (p > best) { best = p; bf = f; }
  }
  return bf * 60;
}

function run(trc, from = 12) {
  const tracker = createTracker(), end = trc[trc.length - 1].t, res = [];
  for (let now = from * 1e3; now <= end; now += 1e3) {
    const win = trc.filter(f => f.t > now - 12e3 && f.t <= now), e = tracker.update(win, now);
    res.push({ s: now / 1e3, hr: e.hr, valid: e.valid, old: oldHR(win) });
  }
  return res;
}

function stats(res, truth, from = 0) {
  const r = res.filter(e => e.s >= from), v = r.filter(e => e.valid), o = r.filter(e => e.old !== null);
  const err = v.map(e => Math.abs(e.hr - truth(e.s)));
  return {
    valid: v.length / r.length, mae: err.length ? err.reduce((a, b) => a + b, 0) / err.length : NaN, maxErr: err.length ? Math.max(...err) : NaN,
    oldMae: o.reduce((s, e) => s + Math.abs(e.old - truth(e.s)), 0) / o.length, oldFloor: o.filter(e => e.old <= 43).length / o.length,
  };
}

const ramp = s => 60 + 30 * Math.min(1, Math.max(0, (s - 10) / 40));
const SCEN = {
  clean60: { trc: trace({}), truth: () => 60 },
  fast120: { trc: trace({ hr: () => 120, seed: 2 }), truth: () => 120 },
  slow45: { trc: trace({ hr: () => 45, seed: 3 }), truth: () => 45 },
  weakPulseRedNoise: { trc: trace({ pulse: 0.25, red: 0.5, seed: 4 }), truth: () => 60 },
  harmonicDominant: { trc: trace({ harm: s => (s < 20 ? 0.3 : 1.5), seed: 5 }), truth: () => 60, from: 34 },
  motionBurst: { trc: trace({ burst: [30, 34, 0.03], seed: 6 }), truth: () => 60 },
  ramp60to90: { trc: trace({ secs: 80, hr: ramp, seed: 7 }), truth: s => ramp(s - 6) },
  step60to100: { trc: trace({ secs: 90, hr: s => (s < 35 ? 60 : 100), seed: 8 }), truth: s => (s < 35 ? 60 : 100), from: 70 },
  slowArtefact: { trc: trace({ pulse: 0.4, lf: [0.6, 1.0], seed: 12 }), truth: () => 60 },
  noiseOnly: { trc: trace({ pulse: 0, seed: 9 }), truth: () => 60 },
  redNoiseOnly: { trc: trace({ pulse: 0, red: 0.5, seed: 10 }), truth: () => 60 },
};
const R = {};
for (const [name, sc] of Object.entries(SCEN)) R[name] = stats(run(sc.trc), sc.truth, sc.from || 0);

console.log('\nscenario            | new: valid  MAE  maxErr | v0.4: MAE  at-floor');
for (const [k, v] of Object.entries(R)) {
  console.log(`${k.padEnd(19)} |      ${(100 * v.valid).toFixed(0).padStart(3)}%  ${v.mae.toFixed(1).padStart(4)}  ${v.maxErr.toFixed(1).padStart(5)} |      ${v.oldMae.toFixed(1).padStart(5)}  ${(100 * v.oldFloor).toFixed(0).padStart(3)}%`);
}

const never = (v, lim) => !(v.maxErr >= lim); // true when no estimate was off by lim bpm or more (NaN passes)
test('clean 60 bpm', () => { const v = R.clean60; assert.ok(v.valid >= 0.95 && v.mae < 2 && v.maxErr < 6, JSON.stringify(v)); });
test('120 bpm is not halved', () => { const v = R.fast120; assert.ok(v.valid >= 0.9 && v.mae < 3, JSON.stringify(v)); });
test('45 bpm near the band floor is accepted', () => { const v = R.slow45; assert.ok(v.valid >= 0.9 && v.mae < 3, JSON.stringify(v)); });
test('weak pulse + red noise: v0.4 fails, new never reports a wrong rate', () => {
  const v = R.weakPulseRedNoise;
  assert.ok(v.oldFloor > 0.25 || v.oldMae > 10, 'scenario should reproduce the v0.4 failure: ' + JSON.stringify(v));
  assert.ok(never(v, 15), JSON.stringify(v));
});
test('slow 0.6 Hz artefact (breathing/nodding): v0.4 is off by >10 bpm on average, new never reports a wrong rate', () => {
  const v = R.slowArtefact;
  assert.ok(v.oldMae > 10, 'scenario should reproduce the v0.4 failure: ' + JSON.stringify(v));
  assert.ok(never(v, 15) && (!(v.valid > 0) || v.mae < 3), JSON.stringify(v));
});
test('dominant 2nd harmonic while tracking: v0.4 doubles, new holds the fundamental', () => {
  const v = R.harmonicDominant;
  assert.ok(v.oldMae > 30, 'scenario should reproduce the v0.4 doubling: ' + JSON.stringify(v));
  assert.ok(v.mae < 4 && v.valid >= 0.8, JSON.stringify(v));
});
test('4 s motion burst: no wrong estimate, most windows still valid', () => { const v = R.motionBurst; assert.ok(never(v, 15) && v.valid >= 0.7, JSON.stringify(v)); });
test('follows a gradual rise', () => { const v = R.ramp60to90; assert.ok(v.valid >= 0.85 && v.mae < 5, JSON.stringify(v)); });
test('re-acquires after a step change', () => { const v = R.step60to100; assert.ok(v.valid >= 0.9 && v.mae < 5, JSON.stringify(v)); });
test('white noise: almost never reports a rate', () => { assert.ok(R.noiseOnly.valid < 0.15, JSON.stringify(R.noiseOnly)); });
test('red noise: rarely reports a rate', () => { assert.ok(R.redNoiseOnly.valid < 0.25, JSON.stringify(R.redNoiseOnly)); });
test('skin mask accepts skin tones and rejects hair, shadows and specular glare', () => {
  assert.equal(isSkin(180, 125, 100), true);
  assert.equal(isSkin(110, 75, 55), true);
  assert.equal(isSkin(15, 15, 15), false);   // dark hair / shadow
  assert.equal(isSkin(252, 252, 252), false); // specular glare
  assert.equal(isSkin(80, 130, 180), false);  // blue background
});
test('HRV (RMSSD ms) is estimated on valid pulse windows and increases under respiratory modulation', () => {
  const trackerSteady = createTracker(), trackerRsa = createTracker();
  const steady = trace({ secs: 25, hr: () => 65, noise: 0.0005, seed: 21 });
  const rsa = trace({ secs: 25, hr: s => 65 + 6 * Math.sin(2 * Math.PI * 0.22 * s), noise: 0.0005, seed: 22 });
  const eSteady = trackerSteady.update(steady.filter(f => f.t > 9e3), 25e3);
  const eRsa = trackerRsa.update(rsa.filter(f => f.t > 9e3), 25e3);
  assert.ok(eSteady.valid && Number.isFinite(eSteady.hrv), JSON.stringify(eSteady));
  assert.ok(eRsa.valid && Number.isFinite(eRsa.hrv), JSON.stringify(eRsa));
  assert.ok(eRsa.hrv > eSteady.hrv, `expected RSA HRV (${eRsa.hrv}) > steady HRV (${eSteady.hrv})`);
});
