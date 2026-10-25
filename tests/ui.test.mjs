// Run: npm i && node --test tests/ui.test.mjs
// 1) Contract: every element id that app.js or ui.js looks up exists in index.html.
// 2) Behaviour: ui.js helpers update a simulated DOM correctly. This does not check how the page looks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = ['../app.js', '../ui.js'].map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');

test('every id looked up by the scripts exists in the page', () => {
  const have = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([...src.matchAll(/\$\((['"])([A-Za-z][\w-]*)\1\)/g)].map(m => m[2]));
  for (const id of ['v_sattva', 'v_rajas', 'v_tamas', 'b_sattva', 'b_rajas', 'b_tamas', 'ag']) used.add(id); // built dynamically in the demo layer
  const missing = [...used].filter(id => !have.has(id));
  assert.deepEqual(missing, [], 'ids used but absent from index.html: ' + missing.join(', '));
  assert.ok(used.size > 40, 'expected to find the ids the scripts use, found ' + used.size);
});

test('page has the phase radios, four rating sliders and no duplicate ids', () => {
  for (const v of ['baseline', 'stressor', 'recovery']) assert.match(html, new RegExp(`name="phase" value="${v}"`));
  for (const id of ['rStress', 'rSattva', 'rRajas', 'rTamas']) assert.match(html, new RegExp(`id="${id}"`));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate ids');
});

const dom = new JSDOM(html, { pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const ui = await import('../ui.js');
const $ = ui.$;

test('change bars: direction, clipping and missing baseline', () => {
  ui.buildRows('rowsFace', [['brow', 'Brow tension']]);
  const row = document.querySelector('.row[data-k="brow"]'), bar = row.querySelector('i'), val = row.querySelector('.val');
  ui.setRow('brow', 0.2, 1.5);
  assert.equal(bar.style.left, '50%'); assert.equal(bar.style.width, '25%'); assert.equal(val.textContent, '+1.5');
  ui.setRow('brow', 0.2, -9);
  assert.equal(bar.style.left, '0%'); assert.equal(bar.style.width, '50%'); assert.equal(val.textContent, '−9.0');
  ui.setRow('brow', 0.2, undefined);
  assert.ok(row.classList.contains('na')); assert.equal(val.textContent, 'no base');
  ui.setRow('brow', undefined, undefined);
  assert.equal(val.textContent, '–');
  ui.setRow('brow', undefined, 1.0); // missing raw with finite z must not throw
  assert.match(row.title, /value –, z 1\.00/);
  ui.setRow('unknown', 1, 1); // must not throw
});

test('pulse line: gaps break the line and the head sits on the newest point', () => {
  const path = $('idxPath'), head = $('idxHead');
  ui.drawSpark(path, head, [], 100);
  assert.equal(path.getAttribute('d'), '');
  ui.drawSpark(path, head, [{ t: 0, v: 60 }, { t: 3, v: 62 }, { t: 20, v: 70 }], 20);
  const d = path.getAttribute('d');
  assert.equal((d.match(/M/g) || []).length, 2, d); assert.equal((d.match(/L/g) || []).length, 1, d);
  assert.equal(head.getAttribute('cx'), '600.0');
  assert.ok(Number(head.getAttribute('cy')) >= 0 && Number(head.getAttribute('cy')) <= 130);
  ui.drawSpark(path, head, [{ t: 0, v: 0 }, { t: 1, v: 99 }], 1, { fixed: [-3, 3] }); // fixed range: 0 is mid-height, 99 clips to the top
  assert.match(path.getAttribute('d'), /^M596\.7 65\.0L600\.0 10\.0$/);
});

test('number eases to the new value, null shows a dash', async () => {
  const el = $('hrNum');
  ui.tweenNum(el, 72); assert.equal(el.textContent, '72');
  ui.tweenNum(el, 80, 0, 100);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(el.textContent, '80');
  ui.tweenNum(el, null); assert.equal(el.textContent, '–');
});

test('quality dots and setup ring', () => {
  const d = $('dFace');
  ui.setDot(d, 0.8); assert.equal(d.dataset.q, 'good');
  ui.setDot(d, 0.4); assert.equal(d.dataset.q, 'fair');
  ui.setDot(d, 0.1); assert.equal(d.dataset.q, 'poor');
  ui.setDot(d, null); assert.equal(d.dataset.q, '');
  ui.ring(0.5); assert.equal(Number($('ring').style.strokeDashoffset).toFixed(1), '169.7');
  ui.ring(2); assert.equal(Number($('ring').style.strokeDashoffset), 0);
});

test('sliders count only once touched and reset to untouched', () => {
  ui.initRate('rStress');
  assert.equal(ui.touched('rStress'), false);
  $('rStress').value = 7; $('rStress').dispatchEvent(new dom.window.Event('input'));
  assert.equal(ui.touched('rStress'), true); assert.equal($('oStress').textContent, '7');
  ui.resetRate('rStress');
  assert.equal(ui.touched('rStress'), false); assert.equal($('oStress').textContent, '–');
});

test('drawer, stage and toast', () => {
  ui.drawer(true);
  assert.ok($('drawer').classList.contains('open')); assert.ok($('scrim').classList.contains('open'));
  assert.equal($('drawer').getAttribute('aria-hidden'), 'false');
  ui.drawer(false);
  assert.ok(!$('drawer').classList.contains('open')); assert.equal($('drawer').getAttribute('aria-hidden'), 'true');
  ui.stage('live'); assert.equal(document.body.dataset.stage, 'live');
  ui.toast('Saved'); assert.equal($('toast').textContent, 'Saved'); assert.ok($('toast').classList.contains('on'));
});

test('models.json loader: trained modality inference, log-linear fusion and fallback', async () => {
  const app = await import('../app.js');
  const fixture = {
    meta: { trainer_version: '0.4' },
    models: {
      face: {
        features: ['z_browLower', 'z_smile'],
        imputer_median: [0, 0.5],
        mean: [0, 0.5],
        scale: [1, 0.5],
        W: [[0, -1, 1], [0, 1, -1], [0, 0, 0]],
        classes: ['sattva', 'rajas', 'tamas']
      }
    },
    fusion: { weights: { face: 0.7, pose: 0.3 }, temperature: 0.5 }
  };
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async u => u === './models.json' ? { ok: true, json: async () => fixture } : { ok: false };
    const loaded = await app.loadModel(['./models.json']);
    assert.ok(loaded);
    assert.equal($('guna').hidden, false);

    // z_browLower = 1 -> a0 = 1; z_smile missing -> imputed 0.5 -> a1 = 0; logits = [-1, 1, 0]
    const pFace = app.modP('face', { browLower: 1 });
    const eN = Math.exp(-1), eP = Math.exp(1), Z = eN + eP + 1;
    assert.ok(Math.abs(pFace.sattva - eN / Z) < 1e-9);
    assert.ok(Math.abs(pFace.rajas - eP / Z) < 1e-9);
    assert.ok(Math.abs(pFace.tamas - 1 / Z) < 1e-9);
    assert.equal(app.modP('face', {}), null); // all features missing -> abstain
    assert.equal(app.modP('pose', { sway: 1 }), null); // modality absent from trained models.json

    // Log-linear pool with temperature 0.5 over present modalities
    const fused = app.fuse({ face: { p: { sattva: 0.2, rajas: 0.6, tamas: 0.2 }, q: 0.9 } });
    const lg = [0.2, 0.6, 0.2].map(v => Math.log(v) / 0.5), mx = Math.max(...lg), ex = lg.map(v => Math.exp(v - mx)), sZ = ex.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(fused.rajas - ex[1] / sZ) < 1e-9);

    // Bundled preset_models.json is valid and shifts toward rajas when tension cues are positive
    const preset = JSON.parse(readFileSync(new URL('../preset_models.json', import.meta.url), 'utf8'));
    globalThis.fetch = async u => u === './preset_models.json' ? { ok: true, json: async () => preset } : { ok: false };
    assert.ok(await app.loadModel());
    const pStress = app.modP('face', { browLower: 1.5, lidTight: 1.2, lipTight: 1.0, smile: -0.5 });
    assert.ok(pStress.rajas > pStress.sattva && pStress.rajas > pStress.tamas, JSON.stringify(pStress));

    // Fallback when models.json is absent
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await app.loadModel(['./models.json']), null);
    assert.equal($('guna').hidden, true);
    const prior = app.modP('face', { browLower: 0 });
    assert.ok(Math.abs(prior.sattva - 1 / 3) < 1e-9);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('pre-trained facial affect (affect.js): valence, arousal and circumplex quadrant', async () => {
  const { evalAffect, quadrant } = await import('../affect.js');
  assert.equal(evalAffect({}, {}), null); // abstains when too few features are present
  const tense = evalAffect({}, { browLower: 2, lidTight: 1.5, lipTight: 1.5, smile: -1, expressivity: 1 });
  assert.ok(tense.valence < 0 && tense.arousal > 0 && tense.label === 'tense-alert', JSON.stringify(tense));
  const calmPos = evalAffect({}, { smile: 2, browLower: -1, lidTight: -1, eyeWide: -1, expressivity: -1 });
  assert.ok(calmPos.valence > 0 && calmPos.arousal < 0 && calmPos.label === 'calm-positive', JSON.stringify(calmPos));
  const onnx = evalAffect({}, {}, { valence: 0.4, arousal: 0.6 });
  assert.equal(onnx.source, 'hsemotion-onnx');
  assert.equal(onnx.label, 'engaged');
  assert.equal(quadrant(0.05, -0.05), 'neutral');
});

test('voice acoustic scorer (voice.js): silence abstention, high arousal rajas and calm sattva', async () => {
  const { scoreVoice, acousticFeatures } = await import('../voice.js');
  assert.equal(scoreVoice({ rms: 0.002 }).p, null); // abstains on silence
  const calm = scoreVoice({ rms: 0.055, centroid: 1300, zcr: 0.08 });
  assert.ok(calm.p.sattva > calm.p.rajas && calm.p.sattva > calm.p.tamas, JSON.stringify(calm));
  const loudBright = scoreVoice({ rms: 0.14, centroid: 2400, zcr: 0.18 });
  assert.ok(loudBright.p.rajas > loudBright.p.sattva && loudBright.p.rajas > loudBright.p.tamas, JSON.stringify(loudBright));
  const f = acousticFeatures(new Float32Array([0.1, -0.1, 0.1, -0.1]), new Float32Array([-100, -20, -80]), 48000);
  assert.ok(f.rms > 0.09 && f.zcr > 0.5 && f.centroid > 0);
});

test('nextScheme: two-state cycling per dark-mode-toggle guide', () => {
  assert.equal(ui.nextScheme(null, false), 'dark');
  assert.equal(ui.nextScheme('dark', false), null);
  assert.equal(ui.nextScheme(null, true), 'light');
  assert.equal(ui.nextScheme('light', true), null);
  assert.equal(ui.nextScheme('dark', true), 'light');
});

test('launcher copies every module the page loads', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const buildSh = readFileSync(new URL('../launcher/build.sh', import.meta.url), 'utf8');
  const cpLine = buildSh.split('\n').find(l => l.startsWith('cp ') && l.includes('site/')) || '';

  const appImports = [...appSrc.matchAll(/from\s+['"]\.\/([\w.-]+)(?:\?[^'"]*)?['"]/g)].map(m => m[1]);
  const htmlAssets = [...html.matchAll(/(?:src|href)=['"](?!\w+:\/\/)([\w.-]+\.(?:js|css))(?:\?[^'"]*)?['"]/g)].map(m => m[1]);

  const required = new Set(['index.html', 'app.js', 'preset_models.json', ...appImports, ...htmlAssets]);
  for (const file of required) {
    assert.ok(cpLine.includes(file), `launcher/build.sh cp line missing file: ${file}`);
  }
});

test('chart.js: math utilities, range, segments, zones and smoothPath', async () => {
  const { zoneOf, niceRange, segments, smoothPath, ema } = await import('../chart.js');
  assert.equal(zoneOf(-0.75), 'base');
  assert.equal(zoneOf(0.75), 'base');
  assert.equal(zoneOf(0.76), 'up');
  assert.equal(zoneOf(1.5), 'up');
  assert.equal(zoneOf(1.51), 'high');
  assert.equal(zoneOf(-0.76), 'relaxed');
  assert.equal(zoneOf(null), null);

  assert.deepEqual(niceRange([]), [-1, 1.5]);
  assert.equal(niceRange([2.9])[1], 3);
  assert.equal(niceRange([-2])[0], -2.25);

  const segs = segments([{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 5, v: 3 }, { t: 6, v: null }, { t: 7, v: 4 }]);
  assert.equal(segs.length, 3);
  assert.equal(segs[0].length, 2);

  assert.equal(ema(0, 1), 0);
  assert.ok(Math.abs(ema(1e6, 1) - 1) < 1e-6);
  assert.ok(Math.abs(ema(0.25, 1.5) - (1 - Math.exp(-0.25 / 1.5))) < 1e-9);

  const p = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 10 }]);
  assert.ok(p.startsWith('M0.0 0.0C'));
});

test('createTrend SVG renderer: builds curves, places head and updates zones/gradient', async () => {
  const { createTrend } = await import('../chart.js');
  const svg = $('trend');
  const tr = createTrend(svg);
  tr.push(1, 0.2);
  tr.push(2, 0.5);
  tr.push(3, 0.8);
  tr.render(10, 0.033);
  const d = $('idxPath').getAttribute('d');
  assert.ok(d.startsWith('M') && d.includes('C'), `path d was: ${d}`);
  const cx = Number($('idxHead').getAttribute('cx'));
  assert.ok(Number.isFinite(cx) && cx > 0);
  assert.match($('trendZones').innerHTML, /Baseline/);
  assert.ok(Number.isFinite(Number($('trendStroke').getAttribute('y1'))));
});

test('fast live display: zoneIdxOf hysteresis, makeBase, tensionOf and tweenNum formatting', async () => {
  const { zoneIdxOf, makeBase, tensionOf } = await import('../app.js');

  // zoneIdxOf hysteresis
  assert.equal(zoneIdxOf(0.8, 1), 1, 'within 0.1 margin of 0.75, stays at base (1)');
  assert.equal(zoneIdxOf(0.9, 1), 2, 'crosses margin, moves to up (2)');
  assert.equal(zoneIdxOf(0.7, 2), 2, 'within 0.1 margin, stays at up (2)');
  assert.equal(zoneIdxOf(0.6, 2), 1, 'crosses margin, moves down to base (1)');
  assert.equal(zoneIdxOf(2.0, 0), 3, 'jump > 1 moves directly to high (3)');
  assert.equal(zoneIdxOf(null, 1), null);

  // makeBase: drops features with < 25 calibration samples, computes median and floor
  const base = makeBase({
    browLower: Array(25).fill(0.2),
    lipTight: [0.1, 0.2]
  });
  assert.ok(base.browLower);
  assert.equal(base.browLower.m, 0.2);
  assert.equal(base.browLower.s, 0.03); // FLOOR.browLower is 0.03
  assert.equal(base.lipTight, undefined);

  // tensionOf: requires qFace >= MIN_Q (0.3) and at least 4 features
  assert.equal(tensionOf({ browLower: 1, lidTight: 1, lipTight: 1, lipDown: 1 }, 0.2), null);
  assert.equal(tensionOf({ browLower: 1, lidTight: 1, lipTight: 1 }, 0.9), null);
  const t = tensionOf({ browLower: 1, lidTight: 1, lipTight: 1, lipDown: 1 }, 0.9);
  assert.ok(Math.abs(t - 1.0) < 1e-6);

  // tweenNum formatting callback
  const el = $('stateNum');
  ui.tweenNum(el, 0.7, 1, 0, v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1));
  assert.equal(el.textContent, '+0.7');
  ui.tweenNum(el, -1.2, 1, 0, v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1));
  assert.equal(el.textContent, '−1.2');
});

test('pulse tile: light coach heuristics, plausibility gating and hrView hold states', () => {
  const { lightOf, lightTip, hrView, hrvShown, LIGHT } = ui;

  // lightOf windowing and RGB weighting
  assert.equal(lightOf([], 1000), null);
  const now = 5000;
  const samples = [
    { t: 2000, r: 100, g: 100, b: 100 }, // older than 2000ms span -> skipped
    { t: 4000, r: 200, g: 100, b: 50 },
    { t: 4500, r: 200, g: 100, b: 50 }
  ];
  const l = lightOf(samples, now);
  assert.ok(l);
  assert.ok(Math.abs(l.luma - (0.299 * 200 + 0.587 * 100 + 0.114 * 50)) < 1e-4);
  assert.equal(l.rg, 2.0);

  // lightTip guidance
  assert.equal(lightTip(null), null);
  assert.match(lightTip({ luma: 50, rg: 1.2 }), /too dark/);
  assert.match(lightTip({ luma: 120, rg: 2.1 }), /Warm yellow light/);
  assert.equal(lightTip({ luma: 120, rg: 1.4 }), null);

  // hrView: live, held, none
  assert.deepEqual(hrView(null, 10), { v: null, state: 'none', age: null });
  assert.equal(hrView({ v: 72, t: 8.5 }, 10).state, 'live'); // age 1.5s <= 2s
  const held = hrView({ v: 72, t: 4 }, 10);
  assert.equal(held.state, 'held'); // age 6s <= 10s
  assert.equal(held.v, 72);
  assert.equal(held.age, 6);
  assert.equal(hrView({ v: 72, t: 0 }, 15).state, 'none'); // age 15s > 10s

  // hrvShown plausibility gate (15 - 150 ms, q >= 0.45)
  assert.equal(hrvShown(45, 0.6), 45);
  assert.equal(hrvShown(180, 0.6), null, 'rejects > 150 ms');
  assert.equal(hrvShown(10, 0.6), null, 'rejects < 15 ms');
  assert.equal(hrvShown(45, 0.3), null, 'rejects low quality q < 0.45');
});

test('session summary: phaseStats aggregation, directionChecks agreement and renderSummary DOM', async () => {
  const { phaseStats, directionChecks } = await import('../summary.js');

  // Synthetic session: 3 phases, transition rows flagged, reports at end of phases
  const log = [];
  for (let t = 0; t < 90; t++) {
    log.push({
      t, window_start_s: Math.max(0, t - 10), window_end_s: t,
      phase: 'baseline', transition: t < 10, tension_idx: 0.1, hr: 70
    });
  }
  for (let t = 90; t < 180; t++) {
    log.push({
      t, window_start_s: t - 10, window_end_s: t,
      phase: 'stressor', transition: t < 100, tension_idx: 0.7, hr: 85
    });
  }
  for (let t = 180; t < 270; t++) {
    log.push({
      t, window_start_s: t - 10, window_end_s: t,
      phase: 'recovery', transition: t < 190, tension_idx: 0.4, hr: 72
    });
  }

  const reports = [
    { phase: 'baseline', raw_stress: 4, t: 85 },
    { phase: 'stressor', raw_stress: 8, t: 175 },
    { phase: 'recovery', raw_stress: 3, t: 265 }
  ];

  const stats = phaseStats(log, reports, 60);
  assert.equal(stats.length, 3);
  assert.equal(stats[0].phase, 'baseline');
  assert.equal(stats[0].basis, 'last 60 s before check-in');
  assert.ok(Math.abs(stats[0].tension.mean - 0.1) < 1e-6);
  assert.ok(Math.abs(stats[1].tension.mean - 0.7) < 1e-6);
  assert.ok(Math.abs(stats[2].tension.mean - 0.4) < 1e-6);

  // Direction checks
  const checks = directionChecks(stats);
  assert.equal(checks.length, 2);
  // Baseline -> Stressor: Stress 4 -> 8 (you = 1), Tension 0.1 -> 0.7 (tempo = 1) => agree
  assert.equal(checks[0].from, 'baseline');
  assert.equal(checks[0].to, 'stressor');
  assert.equal(checks[0].you, 1);
  assert.equal(checks[0].tempo, 1);
  assert.equal(checks[0].agree, true);

  // Stressor -> Recovery: Stress 8 -> 3 (you = -1), Tension 0.7 -> 0.4 (tempo = -1) => agree
  assert.equal(checks[1].from, 'stressor');
  assert.equal(checks[1].to, 'recovery');
  assert.equal(checks[1].you, -1);
  assert.equal(checks[1].tempo, -1);
  assert.equal(checks[1].agree, true);

  // Dead-band check
  const deadChecks = directionChecks(stats, { dTension: 0.5, dStress: 5 });
  assert.equal(deadChecks[1].tempo, 0, 'drop 0.3 is inside 0.5 margin -> 0');

  // Fallback when a phase has no report
  const partialStats = phaseStats(log, reports.slice(0, 2));
  assert.equal(partialStats[2].basis, 'whole phase (clean windows)');
  const partialChecks = directionChecks(partialStats);
  assert.equal(partialChecks[1].you, null);
  assert.equal(partialChecks[1].agree, null);

  // renderSummary in JSDOM
  ui.renderSummary(stats, checks, log, {
    participantId: 'P101',
    sessionId: 'S02',
    durationS: 270,
    reportCount: 3
  });

  assert.match($('sumMeta').textContent, /P101/);
  assert.match($('sumMeta').textContent, /S02/);
  assert.equal(document.querySelectorAll('.sumphase-card').length, 3);
  assert.equal(document.querySelectorAll('.sumcheck-row').length, 2);
  assert.match($('sumChecks').textContent, /residual tension after a stressor/);
  assert.ok($('sumChart').innerHTML.length > 50);

  // setupDialogDismiss: child element activation at (0,0) does not close dialog, backdrop click on dialog does
  const dlg = $('summary');
  dlg.getBoundingClientRect = () => ({ top: 100, left: 100, width: 400, height: 300 });
  ui.openDialog(dlg);
  assert.ok(dlg.hasAttribute('open'));
  $('sumTitle').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
  assert.ok(dlg.hasAttribute('open'), 'keyboard/child element click inside dialog must not light-dismiss');
  dlg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }));
  assert.ok(!dlg.hasAttribute('open'), 'backdrop click on dialog outside bounding box closes dialog');
});
