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
  for (const id of ['v_sattva', 'v_rajas', 'v_tamas', 'ag']) used.add(id); // built dynamically in the demo layer
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

  const appImports = [...appSrc.matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)].map(m => m[1]);
  const htmlAssets = [...html.matchAll(/(?:src|href)=['"](?!\w+:\/\/)([\w.-]+\.(?:js|css))['"]/g)].map(m => m[1]);

  const required = new Set(['index.html', 'app.js', 'preset_models.json', ...appImports, ...htmlAssets]);
  for (const file of required) {
    assert.ok(cpLine.includes(file), `launcher/build.sh cp line missing file: ${file}`);
  }
});
