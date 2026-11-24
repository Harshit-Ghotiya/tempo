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
  for (const id of ['v_sattva', 'v_rajas', 'v_tamas', 'b_sattva', 'b_rajas', 'b_tamas', 'ag', 'stroopBtn1', 'stroopBtn2', 'stroopBtn3', 'stroopBtn4']) used.add(id); // built dynamically in the demo layer & Stroop loop
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
  // Clicking directly on midpoint 5 without changing value still registers as touched
  $('rStress').dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(ui.touched('rStress'), true); assert.equal($('oStress').textContent, '5');
  ui.resetRate('rStress');
  assert.equal(ui.touched('rStress'), false); assert.equal($('oStress').textContent, '–');
});

test('drawer, stage and toast', () => {
  assert.equal($('drawer').getAttribute('role'), 'dialog');
  assert.equal($('drawer').getAttribute('aria-modal'), 'true');
  assert.equal($('drawer').hasAttribute('inert'), true);
  ui.drawer(true);
  assert.ok($('drawer').classList.contains('open')); assert.ok($('scrim').classList.contains('open'));
  assert.equal($('drawer').getAttribute('aria-hidden'), 'false');
  assert.equal($('drawer').hasAttribute('inert'), false);
  ui.drawer(false);
  assert.ok(!$('drawer').classList.contains('open')); assert.equal($('drawer').getAttribute('aria-hidden'), 'true');
  assert.equal($('drawer').hasAttribute('inert'), true);
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
    lidTight: Array(25).fill(0.4),
    lipTight: [0.1, 0.2],
    hr: Array(8).fill(72)
  });
  assert.ok(base.browLower);
  assert.equal(base.browLower.m, 0.2, 'preserves browLower calibration median');
  assert.equal(base.browLower.s, 0.03); // FLOOR.browLower is 0.03
  assert.ok(base.lidTight);
  assert.equal(base.lidTight.m, 0.4, 'preserves lidTight calibration median');
  assert.equal(base.lipTight, undefined, 'drops < 25 face samples');
  assert.ok(base.hr, 'accepts rPPG with >= 8 samples');
  assert.equal(base.hr.m, 72);

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

  // hrvShown plausibility gate (15 - 200 ms, q >= 0.30)
  assert.equal(hrvShown(45, 0.6), 45);
  assert.equal(hrvShown(220, 0.6), null, 'rejects > 200 ms');
  assert.equal(hrvShown(180, 0.6), 180, 'accepts 180 ms with q >= 0.30');
  assert.equal(hrvShown(10, 0.6), null, 'rejects < 15 ms');
  assert.equal(hrvShown(45, 0.2), null, 'rejects low quality q < 0.30');
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

  // renderSummary with Stroop results
  ui.renderSummary(stats, checks, log, {
    participantId: 'P101',
    sessionId: 'S02',
    durationS: 270,
    reportCount: 3,
    stroop: { trials: 35, correct: 32, accuracy: 91, meanRtMs: 580, interferenceMs: 140 }
  });
  const sumStroop = $('sumStroop');
  assert.equal(sumStroop.hidden, false);
  assert.match(sumStroop.textContent, /Stroop Color-Word Challenge/);
  assert.match(sumStroop.textContent, /91% accuracy/);
  assert.match(sumStroop.textContent, /\+140 ms/);
});

test('stroop.js: trial generation, response scoring, interference calculation and test lifecycle', async () => {
  const { STROOP_COLORS, generateTrial, evaluateResponse, aggregateStroop, createStroopTest } = await import('../stroop.js');

  assert.equal(STROOP_COLORS.length, 7);
  const colorNames = STROOP_COLORS.map(c => c.name);

  // Chromatic dissonance check: ink shade is distinct from button swatch
  STROOP_COLORS.forEach(c => {
    assert.ok(c.inkHex, 'has inkHex');
    assert.ok(c.btnHex, 'has btnHex');
    assert.notEqual(c.inkHex, c.btnHex, 'chromatic dissonance between ink and button: ' + c.name);
  });

  // 1. generateTrial
  const trial = generateTrial();
  assert.ok(colorNames.includes(trial.word));
  assert.ok(colorNames.includes(trial.colorName));
  assert.equal(trial.buttonOptions.length, 4);
  assert.ok(trial.buttonOptions.some(b => b.name === trial.colorName), 'target ink color is always one of the 4 rotating buttons');
  assert.ok(typeof trial.isCongruent === 'boolean');
  if (trial.isCongruent) {
    assert.equal(trial.word, trial.colorName);
  }

  // 2. evaluateResponse
  const correct = evaluateResponse({ word: 'Red', colorName: 'Green', isCongruent: false, presentedAt: 1000 }, 'Green', 1650);
  assert.equal(correct.ok, true);
  assert.equal(correct.rtMs, 650);
  assert.equal(correct.chosenName, 'Green');

  const wrong = evaluateResponse({ word: 'Blue', colorName: 'Yellow', isCongruent: false, presentedAt: 1000 }, 'Blue', 1500);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.rtMs, 500);

  // 3. aggregateStroop
  const dummyResults = [
    { word: 'Red', colorName: 'Red', chosenName: 'Red', ok: true, rtMs: 500, isCongruent: true },
    { word: 'Blue', colorName: 'Blue', chosenName: 'Blue', ok: true, rtMs: 520, isCongruent: true },
    { word: 'Green', colorName: 'Red', chosenName: 'Red', ok: true, rtMs: 650, isCongruent: false },
    { word: 'Yellow', colorName: 'Blue', chosenName: 'Blue', ok: true, rtMs: 670, isCongruent: false },
    { word: 'Red', colorName: 'Green', chosenName: 'Yellow', ok: false, rtMs: 700, isCongruent: false }
  ];
  const agg = aggregateStroop(dummyResults);
  assert.equal(agg.trials, 5);
  assert.equal(agg.correct, 4);
  assert.equal(agg.accuracy, 80);
  assert.equal(agg.congruentMeanRtMs, 510);
  assert.equal(agg.incongruentMeanRtMs, 660);
  assert.equal(agg.interferenceMs, 150); // 660 - 510 = 150 ms cognitive delay

  // 4. createStroopTest lifecycle
  let trialsReceived = 0;
  let testSummary = null;
  const testEngine = createStroopTest({
    durationS: 2,
    onTrial: (t) => { trialsReceived++; },
    onFinish: (s) => { testSummary = s; }
  });
  assert.equal(testEngine.isActive(), false);
  testEngine.start();
  assert.equal(testEngine.isActive(), true);
  assert.equal(trialsReceived, 1);

  // Answer trial
  const res1 = testEngine.answer('Red');
  assert.ok(res1);
  assert.equal(trialsReceived, 2);

  // Answer via key 1-4
  const handled1 = testEngine.handleKey({ key: '1' });
  assert.ok(handled1);
  assert.equal(trialsReceived, 3);

  const stoppedSummary = testEngine.stop();
  assert.equal(testEngine.isActive(), false);
  assert.equal(stoppedSummary.trials, 2);
  assert.equal(testSummary?.trials, 2);
});

test('face mesh stress vectors & tension heatmap (drawStressMesh)', async () => {
  const { drawStressMesh, MESH_PTS, BROW_PTS, EYE_PTS, LIP_PTS } = await import('../app.js');

  assert.ok(MESH_PTS.length >= 80);
  assert.ok(BROW_PTS.size > 0);
  assert.ok(EYE_PTS.size > 0);
  assert.ok(LIP_PTS.size > 0);

  // Build mock 478 landmarks
  const mockLandmarks = Array.from({ length: 478 }, (_, i) => ({
    x: 0.5 + Math.sin(i) * 0.2,
    y: 0.5 + Math.cos(i) * 0.2,
    z: 0
  }));

  // Mock 2D canvas context
  const calls = { arc: 0, fill: 0, stroke: 0, strokeRect: 0, roundRect: 0, fillText: 0, measureText: 0 };
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    clearRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() { calls.arc++; },
    fill() { calls.fill++; },
    stroke() { calls.stroke++; },
    fillRect() {},
    strokeRect() { calls.strokeRect++; },
    roundRect() { calls.roundRect++; },
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText() { calls.measureText++; return { width: 85 }; },
    fillText() { calls.fillText++; }
  };

  // 1. Draw with elevated AU4 brow tension and AU7 orbital squint
  drawStressMesh(mockCtx, mockLandmarks, 640, 480, { browLower: 1.6, lidTight: 1.4, smile: 0 }, false);

  assert.ok(calls.arc >= MESH_PTS.length, 'Every mesh landmark dot rendered');
  assert.ok(calls.fill > 0, 'Dots and HUD filled');
  assert.ok(calls.stroke >= 2, 'Biomechanical AU4 brow furrowing arrows stroked');
  assert.ok(calls.fillText > 0, 'FACS HUD badge rendered');

  // 2. Draw with pulse ROIs enabled
  calls.roundRect = 0;
  calls.strokeRect = 0;
  drawStressMesh(mockCtx, mockLandmarks, 640, 480, { browLower: 0, lidTight: 0, smile: 1.2 }, true);

  assert.ok(calls.roundRect + calls.strokeRect >= 3, 'Pulse ROIs (forehead + cheeks) rendered');
});

test('guided breathing coach (breathe.js): protocols, phase progress and cycle calculation', async () => {
  const { BREATHE_PATTERNS, phaseAt, getPatternCycleS, createBreathingCoach } = await import('../breathe.js');

  assert.ok(BREATHE_PATTERNS['4-7-8']);
  assert.ok(BREATHE_PATTERNS['box']);
  assert.ok(BREATHE_PATTERNS['coherent']);

  assert.equal(getPatternCycleS('4-7-8'), 19);
  assert.equal(getPatternCycleS('box'), 16);
  assert.equal(getPatternCycleS('coherent'), 10);

  // phaseAt 4-7-8: Inhale (0..4s), Hold (4..11s), Exhale (11..19s)
  const pInhale = phaseAt('4-7-8', 2.0);
  assert.equal(pInhale.stepKey, 'inhale');
  assert.equal(pInhale.stepRemainingS, 2);
  assert.ok(pInhale.scale > 1.0 && pInhale.scale < 1.6);
  assert.equal(pInhale.cycle, 1);

  const pHold = phaseAt('4-7-8', 6.0);
  assert.equal(pHold.stepKey, 'hold1');
  assert.equal(pHold.stepRemainingS, 5);
  assert.equal(pHold.scale, 1.6);

  const pExhale = phaseAt('4-7-8', 15.0);
  assert.equal(pExhale.stepKey, 'exhale');
  assert.equal(pExhale.stepRemainingS, 4);
  assert.ok(pExhale.scale < 1.6 && pExhale.scale > 1.0);

  // Lifecycle & pattern switching
  let tickCount = 0;
  let phaseChanges = 0;
  let lastInfo = null;
  const coach = createBreathingCoach({
    patternKey: 'coherent',
    onTick: info => { tickCount++; lastInfo = info; },
    onPhaseChange: () => { phaseChanges++; }
  });
  assert.equal(coach.isActive(), false);
  coach.start();
  assert.equal(coach.isActive(), true);
  assert.ok(tickCount > 0);
  assert.equal(lastInfo?.patternKey, 'coherent');

  coach.setPattern('box');
  assert.equal(coach.getPattern(), 'box');
  assert.equal(lastInfo?.patternKey, 'box');
  assert.equal(lastInfo?.stepKey, 'inhale');

  const summary = coach.stop();
  assert.equal(coach.isActive(), false);
  assert.ok(summary);
  assert.equal(summary.patternKey, 'box');
});

test('tensionOf and downLookOf: downward pitch and phone gaze attenuation suppresses false spikes', async () => {
  const { tensionOf, downLookOf } = await import('../app.js');

  // downLookOf helper checks pitch and vertical gaze delta against baseline
  const baseRef = { pitch: { m: 0.30, s: 0.03 }, gy: { m: 0.50, s: 0.03 } };
  assert.equal(downLookOf({ pitch: 0.32, gy: 0.52 }, baseRef), 0, 'small upright variation does not trigger downLook');
  const dl = downLookOf({ pitch: 0.48, gy: 0.65 }, baseRef);
  assert.ok(dl > 0.8 && dl <= 1.0, `downward pitch delta 0.18 produces strong attenuation factor: ${dl}`);

  // Neutral screen-facing baseline: lidTight = 2, lipTight = 2, browLower = -1.5, smile = -0.5
  const z = { lidTight: 2.0, lipTight: 2.0, browLower: -1.5, smile: -0.5, eyeWide: 0 };
  const rawUpright = tensionOf(z, 0.9, 0); // downLook = 0
  assert.ok(rawUpright > 0.4, 'raw upright tension elevated');

  // When looking down at phone, downLook = 1.0 attenuates positive lidTight, lipTight, browLower
  const rawDownLook = tensionOf(z, 0.9, 1.0);
  assert.ok(rawDownLook < rawUpright * 0.65, `downward gaze attenuated (${rawDownLook} < ${rawUpright * 0.65})`);

  // Phase-contextual button visibility: Stroop only in stressor, Breathe only in recovery
  const rStressor = document.querySelector('input[name=phase][value=stressor]');
  rStressor.checked = true;
  rStressor.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal($('btnStroop').hidden, false, 'Stroop button visible in Stressor phase');
  assert.equal($('btnBreathe').hidden, true, 'Breathe button hidden in Stressor phase');

  const rRecovery = document.querySelector('input[name=phase][value=recovery]');
  rRecovery.checked = true;
  rRecovery.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal($('btnStroop').hidden, true, 'Stroop button hidden in Recovery phase');
  assert.equal($('btnBreathe').hidden, false, 'Breathe button visible in Recovery phase');

  const rBaseline = document.querySelector('input[name=phase][value=baseline]');
  rBaseline.checked = true;
  rBaseline.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal($('btnStroop').hidden, true, 'Stroop button hidden in Baseline phase');
  assert.equal($('btnBreathe').hidden, true, 'Breathe button hidden in Baseline phase');
});

test('fitted stress_delta tension weights: used only when validated (N >= 20, vs_phase < 0), priors otherwise', async () => {
  const app = await import('../app.js');
  const base = {
    meta: { trainer_version: '0.5' },
    models: { face: { features: ['z_smile'], imputer_median: [0], mean: [0], scale: [1], W: [[0, 0], [0, 0], [0, 0]], classes: ['sattva', 'rajas', 'tamas'] } }
  };
  const st = {
    features: ['z_browLower', 'z_lidTight', 'z_lipTight', 'z_smile', 'z_blink'],
    coef_z: [0.02, 0.06, 0.0, -0.03, -0.01], pred_sd: 0.05, n_participants: 24,
    vs_phase: -0.012, vs_phase_lo: -0.02, vs_phase_hi: -0.004
  };
  const z = { browLower: 1, lidTight: 1, lipTight: 1, smile: 0.5, blink: -1 };
  const prior = (0.5 + 1 + 0.8 - 0.4 * 0.5 + 0.4) / (0.5 + 1 + 0.8 + 0.4 + 0.4);
  const fittedVal = (0.02 + 0.06 + 0 - 0.015 + 0.01) / 0.05;
  const serve = obj => async u => (u === './models.json' ? { ok: true, json: async () => obj } : { ok: false });
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = serve({ ...base, stress_tension: st });
    assert.ok(await app.loadModel(['./models.json']));
    assert.equal(app.tensionSource(), 'fitted');
    assert.ok(Math.abs(app.tensionOf(z, 0.9) - fittedVal) < 1e-9, `fitted ${app.tensionOf(z, 0.9)}`);
    assert.equal(app.tensionOf(z, 0.2), null, 'still abstains on poor face quality');
    assert.equal(app.tensionOf(null, 0.9), null, 'null z abstains');
    assert.equal(app.tensionOf({ lidTight: 1, smile: 1, blink: 0 }, 0.9), null, 'still needs >= 4 features');
    assert.ok(Math.abs(app.tensionOf({ ...z, blink: NaN }, 0.9) - ((0.02 + 0.06 - 0.015) / 0.05)) < 1e-9, 'NaN feature does not poison fitted sum');
    assert.equal(app.tensionOf({ browLower: 3, lidTight: 3, lipTight: 3, smile: -3 }, 0.9), 3, 'clipped to +3');

    for (const bad of [{ n_participants: 12 }, { vs_phase: 0.004 }, { vs_phase: NaN }, { vs_phase: null }, { pred_sd: 0 }, { coef_z: [0.1] }]) {
      globalThis.fetch = serve({ ...base, stress_tension: { ...st, ...bad } });
      assert.ok(await app.loadModel(['./models.json']));
      assert.equal(app.tensionSource(), 'prior', JSON.stringify(bad));
      assert.ok(Math.abs(app.tensionOf(z, 0.9) - prior) < 1e-9, JSON.stringify(bad));
    }
    globalThis.fetch = serve({ ...base });
    await app.loadModel(['./models.json']);
    assert.equal(app.tensionSource(), 'prior', 'models.json without stress_tension');
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await app.loadModel(['./models.json']), null);
    assert.equal(app.tensionSource(), 'prior', 'no models.json');
    assert.ok(Math.abs(app.tensionOf(z, 0.9) - prior) < 1e-9);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('multimodal late fusion survives intermittent channel dropout (US 10,628,741 Claims 9-10 benchmark)', async () => {
  const app = await import('../app.js');
  const modCfg = (f, w1) => ({
    features: [f], imputer_median: [0], mean: [0], scale: [1],
    W: [[0, -w1], [0, w1], [0, 0]], classes: ['sattva', 'rajas', 'tamas']
  });
  const modelDoc = {
    meta: { trainer_version: '0.5' },
    models: { face: modCfg('z_browLower', 1.2), rppg: modCfg('z_hr', 1.0), pose: modCfg('z_shrug', 0.8) },
    fusion: { weights: { face: 0.5, rppg: 0.25, pose: 0.25 }, temperature: 0.9 }
  };
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async u => (u === './models.json' ? { ok: true, json: async () => modelDoc } : { ok: false });
    assert.ok(await app.loadModel(['./models.json']));

    const pFace = app.modP('face', { browLower: 1.5 });
    const pRppg = app.modP('rppg', { hr: 1.0 });
    const pPose = app.modP('pose', { shrug: 0.5 });
    const pRppgDrop = app.modP('rppg', {}); // all rPPG features missing -> null abstention
    assert.equal(pRppgDrop, null);

    const logPool = active => {
      const den = active.reduce((s, [, w]) => s + w, 0);
      const cls = ['sattva', 'rajas', 'tamas'];
      const lg = cls.map(c => active.reduce((s, [p, w]) => s + w * Math.log(p[c]), 0) / den / 0.9);
      const mx = Math.max(...lg), ex = lg.map(v => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b, 0);
      return Object.fromEntries(cls.map((c, i) => [c, ex[i] / Z]));
    };

    // 1. All 3 modalities active
    const all3 = app.fuse({ face: { p: pFace, q: 0.9 }, rppg: { p: pRppg, q: 0.9 }, pose: { p: pPose, q: 0.9 } });
    const expAll3 = logPool([[pFace, 0.5], [pRppg, 0.25], [pPose, 0.25]]);
    assert.ok(Math.abs(all3.sattva + all3.rajas + all3.tamas - 1) < 1e-9);
    assert.ok(Math.abs(all3.rajas - expAll3.rajas) < 1e-9);

    // 2. rppg drops out intermittently (q < MIN_Q -> omitted); renormalizes face (0.5/0.75) + pose (0.25/0.75)
    const dropRppg = app.fuse({ face: { p: pFace, q: 0.9 }, pose: { p: pPose, q: 0.9 } });
    const expDropRppg = logPool([[pFace, 0.5 / 0.75], [pPose, 0.25 / 0.75]]);
    assert.ok(Math.abs(dropRppg.sattva + dropRppg.rajas + dropRppg.tamas - 1) < 1e-9);
    assert.ok(Math.abs(dropRppg.rajas - expDropRppg.rajas) < 1e-9);

    // 3. Both rppg and pose drop out; continues with face alone
    const faceOnly = app.fuse({ face: { p: pFace, q: 0.9 } });
    const expFaceOnly = logPool([[pFace, 1.0]]);
    assert.ok(Math.abs(faceOnly.rajas - expFaceOnly.rajas) < 1e-9);

    // 4. All channels drop out -> abstains cleanly
    assert.equal(app.fuse({}), null);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('P0/P1 regressions: Stroop outlier/repeat/abort, Breathe pattern accumulation, Voice ctx, XSS, CSV & labelling', async () => {
  const { aggregateStroop, createStroopTest } = await import('../stroop.js');
  const { createBreathingCoach } = await import('../breathe.js');
  const { acousticFeatures, createVoiceMonitor } = await import('../voice.js');
  const app = await import('../app.js');

  // 1. Stroop retains all trials in count/accuracy/score while filtering RT outliers only for RT means
  const agg = aggregateStroop([
    { word: 'Red', colorName: 'Red', chosenName: 'Red', ok: true, rtMs: 600, isCongruent: true },
    { word: 'Blue', colorName: 'Green', chosenName: 'Green', ok: true, rtMs: 700, isCongruent: false },
    { word: 'Red', colorName: 'Blue', chosenName: 'Blue', ok: true, rtMs: 4200, isCongruent: false },
    { word: 'Green', colorName: 'Yellow', chosenName: 'Green', ok: false, rtMs: 4500, isCongruent: false }
  ]);
  assert.equal(agg.trials, 4);
  assert.equal(agg.correct, 3);
  assert.equal(agg.accuracy, 75);
  assert.equal(agg.meanRtMs, 650);

  // Stroop ignores key repeat and marks aborted stop
  let finishMeta = null;
  const st = createStroopTest({ durationS: 10, onFinish: (_, meta) => { finishMeta = meta; } });
  st.start();
  assert.equal(st.handleKey({ key: '1', repeat: true }), null);
  assert.equal(st.getResults().length, 0);
  st.stop(true);
  assert.deepEqual(finishMeta, { aborted: true });

  // 2. Breathe preserves elapsed duration and completed cycles across mid-session pattern switch
  const origNow = performance.now;
  let fakeNow = 1000;
  performance.now = () => fakeNow;
  try {
    const bc = createBreathingCoach({ patternKey: 'coherent' });
    bc.start();
    fakeNow += 14000; // 1.4 cycles of 10s coherent = 1 complete cycle, 14s
    bc.setPattern('box');
    fakeNow += 4000;  // +4s in box
    const bSum = bc.stop();
    assert.equal(bSum.durationS, 18);
    assert.equal(bSum.cyclesCompleted, 1);
  } finally {
    performance.now = origNow;
  }

  // 3. Voice ignores NaN FFT bins and does not close caller-supplied AudioContext
  const vf = acousticFeatures(new Float32Array([0.1, -0.1, 0.1, -0.1]), new Float32Array([-100, NaN, -40, -60]), 48000);
  assert.ok(Number.isFinite(vf.centroid) && vf.centroid > 0);
  let closeCalls = 0;
  const fakeCtx = {
    state: 'running',
    sampleRate: 48000,
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => ({ fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0.5, disconnect() {}, getFloatTimeDomainData() {}, getFloatFrequencyData() {} }),
    close: async () => { closeCalls++; }
  };
  const origAC = globalThis.AudioContext;
  globalThis.AudioContext = function () {};
  try {
    const vm = createVoiceMonitor({ getAudioTracks: () => [{}] }, () => {}, fakeCtx);
    vm.stop();
    assert.equal(closeCalls, 0, 'createVoiceMonitor must not close caller-owned AudioContext');
  } finally {
    globalThis.AudioContext = origAC;
  }

  // 4. ui.renderSummary HTML-escapes dynamic strings (no XSS) and openDialog guards re-opening
  const xssLog = [{ t: 90, window_start_s: 80, window_end_s: 90, phase: 'recovery', transition: false, tension_idx: 0.1 }];
  ui.renderSummary(
    [{ phase: 'recovery', n: 1, basis: '<img src=x onerror=alert(1)>', tension: { mean: 0.1, peak: 0.2 }, hr: { mean: null, n: 0 }, report: null }],
    [],
    xssLog,
    { breathe: { durationS: 30, cyclesCompleted: 2, patternName: '<script>evil()</script>' } }
  );
  assert.equal($('sumPhases').querySelectorAll('img').length, 0);
  assert.equal($('sumBreathe').querySelectorAll('script').length, 0);
  assert.match($('sumBreathe').textContent, /<script>evil\(\)<\/script>/);

  const dlg = $('summary');
  dlg.showModal = () => { if (dlg.open) throw new Error('InvalidStateError'); dlg.open = true; };
  dlg.open = true;
  assert.doesNotThrow(() => ui.openDialog(dlg));

  // 5. csvCell formula injection guard, NaN safety & \r quoting; labelled() phase contiguity & latest baseline
  assert.equal(app.csvCell('=CMD()', { isText: true }), "'=CMD()");
  assert.equal(app.csvCell('+1+1', { isText: true }), "'+1+1");
  assert.equal(app.csvCell(NaN), '');
  assert.equal(app.csvCell('a\rb'), '"a\rb"');

  const logRows = [
    { t: 110, window_start_s: 100, window_end_s: 110, phase: 'baseline', phase_start_s: 80, transition: false },
    { t: 150, window_start_s: 140, window_end_s: 150, phase: 'stressor', phase_start_s: 120, transition: false },
    { t: 200, window_start_s: 190, window_end_s: 200, phase: 'baseline', phase_start_s: 180, transition: false }
  ];
  const repRows = [
    { t: 115, phase: 'baseline', raw_sattva: 7, raw_rajas: 2, raw_tamas: 1, raw_stress: 2, sattva: 0.7, rajas: 0.2, tamas: 0.1, stress_label: 0.2 },
    { t: 205, phase: 'baseline', raw_sattva: 6, raw_rajas: 3, raw_tamas: 1, raw_stress: 4, sattva: 0.6, rajas: 0.3, tamas: 0.1, stress_label: 0.4 }
  ];
  const lab = app.labelled(logRows, repRows);
  assert.equal(lab[0].baseline_raw_stress, 4, 'uses latest baseline report');
  assert.equal(lab[0].report_t_s, 115, 'row 0 labelled by first baseline report, not across intervening stressor');

  // 6. fittedTensionFrom rejects Infinity & loadModel excludes ./artifacts/models.json
  assert.equal(app.fittedTensionFrom({
    features: ['z_browLower', 'z_lidTight', 'z_lipTight', 'z_smile'],
    coef_z: [0.1, 0.2, 0.1, -0.1], n_participants: Infinity, vs_phase: -0.01, pred_sd: 0.1
  }), null);
  const fetched = [];
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async u => { fetched.push(u); return { ok: false }; };
    await app.loadModel();
    assert.ok(!fetched.includes('./artifacts/models.json'));
  } finally {
    globalThis.fetch = origFetch;
  }

  // 7. Stop button remains visible during setup in CSS
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /body\[data-stage=setup\]\s*\.cam-actions/);
  assert.match(css, /body\[data-stage=setup\]\s*#openSummary/);

  // 8. Phase reminder duration select is not nested inside the switch label
  assert.equal($('guidedSecs').closest('label'), null);
});
