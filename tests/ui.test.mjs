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
