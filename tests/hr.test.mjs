// Run: node --test tests/hr.test.mjs
// Synthetic skin-colour traces with a known pulse. The v0.4 estimator is replicated (oldHR) so each
// scenario shows whether the failure seen in the real session (band-floor lock, 2x harmonic) is reproduced
// and then fixed. This validates the algorithm's logic, not its accuracy on real faces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, resample, pos, isSkin, createRoiStabilizer, sqi, rmssd } from '../hr.js';

function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// pulse: amplitude; harm: 2nd-harmonic ratio (number or fn of time); red: channel-dependent low-frequency
// artefact (breathing/motion/lighting); lf: [Hz, amplitude] slow periodic artefact; burst: [t0, t1, amplitude] broadband motion.
// art: [Hz, amplitude, t0?, t1?] chrominance-coherent periodic artefact (same colour signature as blood volume, so POS cannot cancel it).
function trace({ secs = 70, hr = () => 60, pulse = 1, harm = 0.3, noise = 0.002, noiseB = null, red = 0, lf = null, burst = null, stepAt = null, fps = 30, seed = 1, art = null }) {
  const r = rng(seed), out = [], gain = [0.0008, 0.0035, 0.0016], base = [180, 120, 100], mot = [0.02, 0.012, 0.008];
  const ph = Array.from({ length: 40 }, () => 2 * Math.PI * r()), fr = Array.from({ length: 40 }, (_, k) => 0.05 + 0.02 * k + 0.02 * r());
  let phi = 0;
  for (let i = 0; i * 1e3 / fps < secs * 1e3; i++) {
    const t = i * 1e3 / fps + (r() - 0.5) * 4, s = t / 1e3;
    phi += 2 * Math.PI * (hr(s) / 60) / fps; // hr is in bpm
    const ar = art && s >= (art[2] ?? -Infinity) && s < (art[3] ?? Infinity) ? art[1] * Math.cos(2 * Math.PI * art[0] * s) : 0;
    const hv = typeof harm === 'function' ? harm(s) : harm, p = pulse * (Math.cos(phi) + hv * Math.cos(2 * phi + 0.7)) + ar;
    let m = 0;
    for (let k = 0; k < 40; k++) m += Math.sin(2 * Math.PI * fr[k] * s + ph[k]) / fr[k];
    m *= red / 40;
    if (lf) m += lf[1] * Math.sin(2 * Math.PI * lf[0] * s); // slow breathing / nodding at lf[0] Hz
    const b = burst && s >= burst[0] && s < burst[1] ? burst[2] : 0;
    const step = stepAt && s >= stepAt ? 0.08 : 0;
    const px = [0, 1, 2].map(c => {
      const nc = (c === 2 && noiseB !== null) ? noiseB : noise;
      return base[c] * (1 + step + gain[c] * p + mot[c] * m + nc * gauss(r) + b * gauss(r) * [1, 0.7, 0.5][c]);
    });
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
  warmLightNoisyBlue: { trc: trace({ pulse: 0.5, noiseB: 0.012, red: 0.2, seed: 14 }), truth: () => 60 },
  autoExposureStep: { trc: trace({ pulse: 0.5, stepAt: 35, seed: 15 }), truth: () => 60 },
  webcam20fpsRsa: { trc: trace({ pulse: 0.45, fps: 20, hr: s => 68 + 4 * Math.sin(2 * Math.PI * 0.2 * s), red: 0.25, seed: 16 }), truth: s => 68 + 4 * Math.sin(2 * Math.PI * 0.2 * (s - 6)) },
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
test('warm indoor lighting with noisy blue channel recovers pulse via adaptive RG chrominance', () => {
  const v = R.warmLightNoisyBlue;
  assert.ok(v.valid >= 0.65 && v.mae < 4 && never(v, 15), JSON.stringify(v));
});
test('auto-exposure step jump is despiked without losing lock', () => {
  const v = R.autoExposureStep;
  assert.ok(v.valid >= 0.95 && v.mae < 2 && never(v, 10), JSON.stringify(v));
});
test('20 fps variable webcam framerate with RSA tracks accurately', () => {
  const v = R.webcam20fpsRsa;
  assert.ok(v.valid >= 0.60 && v.mae < 4 && never(v, 12), JSON.stringify(v));
});
test('Kalman + deadband ROI stabilizer locks against sub-pixel landmark jitter and tracks genuine movement', () => {
  const stab = createRoiStabilizer();
  const base = [320, 140, 260, 240, 380, 240, 160];
  const r = rng(99);
  const first = stab.update(base, 1 / 30);
  for (let i = 0; i < 20; i++) {
    const jittered = base.map(v => v + (r() - 0.5) * 1.2); // +-0.6 px landmark jitter
    const out = stab.update(jittered, 1 / 30);
    assert.deepEqual(out.map(Math.round), first.map(Math.round), 'sub-pixel jitter should not shift integer ROI box');
  }
  const shifted = base.map(v => v + 18); // genuine head translation > 1.2% of fw
  let moved = null;
  for (let i = 0; i < 10; i++) moved = stab.update(shifted, 1 / 30);
  assert.ok(Math.abs(moved[0] - first[0]) > 10, 'genuine head shift must update ROI coordinates');
});
test('autocorrelation SQI distinguishes periodic pulse from white noise', () => {
  const r = rng(42);
  const sine = Float64Array.from({ length: 300 }, (_, i) => Math.sin(2 * Math.PI * 1.1 * i / 30));
  const noise = Float64Array.from({ length: 300 }, () => gauss(r));
  assert.ok(sqi(sine) > 0.85, `expected high SQI on periodic sine, got ${sqi(sine)}`);
  assert.ok(sqi(noise) < 0.25, `expected low SQI on white noise, got ${sqi(noise)}`);
});
test('gap-aware resampling and leading motion-tail trimming recover pulse after sitting back down', () => {
  const full = trace({ secs: 15, hr: () => 72, seed: 77 });
  // Simulate a 2 s missing-face gap at t=1..3s, then 2 s of sitting-down motion at t=3..5s, then 9.5 s clean (t=5..14.5s)
  const gapped = full.filter(f => f.t < 1000 || (f.t >= 3000 && f.t <= 14500)).map(f => {
    if (f.t >= 3000 && f.t < 5000) {
      const m = 18 * Math.sin(2 * Math.PI * 1.9 * f.t / 1e3);
      return { t: f.t, r: f.r + m, g: f.g + m, b: f.b + m };
    }
    return f;
  });
  const tracker = createTracker();
  const res = tracker.update(gapped, 14500);
  assert.ok(res.valid && Math.abs(res.hr - 72) < 3, `expected lock near 72 bpm after gap + motion tail, got ${JSON.stringify(res)}`);
});
test('distance-weighted tracking prevents mode hopping between competing peaks', () => {
  // Simulate tracking at 78 bpm recovering gradually to 74 bpm with an interfering 64 bpm peak (Mayer / panting residue)
  const tracker = createTracker();
  // Initialize tracker at 78 bpm
  const init = trace({ secs: 12, hr: () => 78, seed: 101 });
  tracker.update(init, 12e3);
  // Feed a trace at 76 bpm with a strong competing low-frequency peak at 64 bpm (0.6x pulse)
  const competing = trace({ secs: 15, hr: () => 76, harm: 0.2, lf: [64 / 60, 0.6], seed: 102 });
  const res = tracker.update(competing, 15e3);
  assert.ok(res.valid, 'tracker should remain valid');
  assert.ok(res.hr >= 72 && res.hr <= 80, `expected tracker to stay locked on 76 bpm pulse instead of hopping to 64 bpm, got ${res.hr}`);
});
test('cold start protects against false single-window lock on low-frequency panting (<58 bpm)', () => {
  const tracker = createTracker();
  // Single window of strong 52 bpm heave (0.86 Hz)
  const panting = trace({ secs: 10, hr: () => 52, pulse: 1.2, noise: 0.0005, seed: 103 });
  const res = tracker.update(panting, 10e3);
  // A single window of <58 bpm must NOT lock on window 1 without 2-window consistency
  assert.ok(!res.valid || res.q < 0.35, 'single-window panting burst must not lock tracker at 52 bpm');
});
test('mid-session 10 s head-motion artefact at 51 bpm cannot hijack a 68 bpm lock (S09 t=40-54 s regression)', () => {
  const trc = trace({ hr: () => 68, pulse: 0.6, art: [0.85, 1.6, 40, 50], seed: 31 }).map(f => {
    const s = f.t / 1e3, moving = s >= 40 && s < 50;
    return { ...f, mx: 0.5 + (moving ? 0.12 * Math.sin(2 * Math.PI * 0.85 * s) : 0.001 * Math.sin(7 * s)), my: 0.3 };
  });
  const res = run(trc), v = stats(res, () => 68);
  const during = res.filter(e => e.s >= 40 && e.s <= 64 && e.valid);
  console.log('motionHijack', JSON.stringify(v), 'valid during/after motion:', during.length);
  assert.ok(v.valid >= 0.65 && v.mae < 3 && never(v, 8), JSON.stringify(v));
  assert.ok(during.every(e => e.hr > 62), `dragged toward 51 bpm: ${JSON.stringify(during.map(e => [e.s, +e.hr.toFixed(1)]))}`);
  assert.ok(res.some(e => e.s >= 60 && e.valid), 'must re-attach to the pulse once a clean 8 s stretch exists');
});
test('rmssd rejects a premature (ectopic / motion) beat instead of reporting an HRV spike', () => {
  const bpm = 70, T = 60 / bpm, beats = Array.from({ length: 18 }, (_, k) => k * T);
  const ect = beats.slice();
  ect[7] = beats[6] + 0.72 * T; // premature beat; compensatory pause keeps beat 8 on schedule
  const wave = bt => Float64Array.from({ length: 12 * 30 }, (_, i) => {
    const t = i / 30;
    let k = 0;
    while (k < bt.length - 2 && bt[k + 1] <= t) k++;
    const ph = 2 * Math.PI * (k + (t - bt[k]) / (bt[k + 1] - bt[k]));
    return Math.cos(ph) + 0.3 * Math.cos(2 * ph + 0.7);
  });
  const clean = rmssd(wave(beats), bpm), ectopic = rmssd(wave(ect), bpm);
  console.log('rmssd clean', clean, 'ectopic', ectopic);
  assert.ok(Number.isFinite(clean) && clean <= 30, `clean RMSSD ${clean}`);
  assert.ok(Number.isFinite(ectopic) && ectopic <= 30, `one ectopic beat inflated RMSSD to ${ectopic} ms`);
});
test('sub-ROI consensus fusion rejects a forehead-only 51 bpm artefact that contaminates the pooled mean', () => {
  const A = trace({ hr: () => 68, pulse: 0.6, seed: 41 }), B = trace({ hr: () => 68, pulse: 0.6, seed: 42 });
  const C = trace({ hr: () => 68, pulse: 0.6, art: [0.85, 2.5], seed: 43 });
  const len = Math.min(A.length, B.length, C.length);
  const trc = Array.from({ length: len }, (_, i) => ({
    t: A[i].t,
    r: (A[i].r + B[i].r + C[i].r) / 3, g: (A[i].g + B[i].g + C[i].g) / 3, b: (A[i].b + B[i].b + C[i].b) / 3,
    sub: [[C[i].r, C[i].g, C[i].b], [A[i].r, A[i].g, A[i].b], [B[i].r, B[i].g, B[i].b]]
  }));
  const fused = stats(run(trc), () => 68);
  const pooled = stats(run(trc.map(({ sub, ...f }) => f)), () => 68); // diagnostic only, not asserted
  console.log('subROI fused', JSON.stringify(fused), 'pooled', JSON.stringify(pooled));
  assert.ok(fused.valid >= 0.8 && fused.mae < 4 && never(fused, 10), JSON.stringify(fused));
});

test('sub-ROI fusion tolerates one persistently occluded cheek and isolated dropped frames', () => {
  const A = trace({ hr: () => 68, pulse: 0.6, seed: 51 }), B = trace({ hr: () => 68, pulse: 0.6, seed: 52 });
  const C = trace({ hr: () => 68, pulse: 0.6, art: [0.85, 2.5], seed: 53 });
  const len = Math.min(A.length, B.length, C.length);
  const trc = Array.from({ length: len }, (_, i) => ({
    t: A[i].t,
    r: (A[i].r + B[i].r + C[i].r) / 3, g: (A[i].g + B[i].g + C[i].g) / 3, b: (A[i].b + B[i].b + C[i].b) / 3,
    sub: [
      i % 12 === 0 ? null : [A[i].r, A[i].g, A[i].b],
      null,
      i % 17 === 0 ? null : [B[i].r, B[i].g, B[i].b]
    ]
  }));
  const res = stats(run(trc), () => 68);
  assert.ok(res.valid >= 0.8 && res.mae < 4 && never(res, 10), JSON.stringify(res));
});
