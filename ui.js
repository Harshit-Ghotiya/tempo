// ui.js: small DOM helpers for the Tempo portal. No camera or MediaPipe code, so Node + jsdom can test it.
export const $ = id => document.getElementById(id);
export const stage = n => { document.body.dataset.stage = n; };
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const level = q => (q == null ? '' : q >= 0.6 ? 'good' : q >= 0.3 ? 'fair' : 'poor');

let toastTimer;
export function toast(msg, ms = 3400) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// Number that eases to its new value (instead of jumping); null shows a dash.
export function tweenNum(el, to, dec = 0, ms = 600, fmt = null) {
  if (to == null || !Number.isFinite(to)) { el.textContent = '–'; el._v = null; return; }
  const from = Number.isFinite(el._v) ? el._v : to;
  let t0 = null; // first animation-frame timestamp, so one clock is used throughout
  el._v = to; cancelAnimationFrame(el._r);
  const format = typeof fmt === 'function' ? fmt : v => v.toFixed(dec);
  if (calm() || from === to || ms <= 0 || typeof requestAnimationFrame !== 'function') { el.textContent = format(to); return; }
  const step = now => {
    t0 ??= now;
    const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
    el.textContent = format(from + (to - from) * e);
    if (k < 1) el._r = requestAnimationFrame(step);
  };
  el._r = requestAnimationFrame(step);
}

// Rolling line of values over the last 3 minutes (range fits the data, or is fixed); gaps over 6 s break the line. head marks the newest point.
export function drawSpark(path, head, series, now, { span = 180, w = 600, h = 130, fixed = null } = {}) {
  if (!series.length) { path.setAttribute('d', ''); head.setAttribute('cx', -20); head.setAttribute('cy', -20); return; }
  let lo, hi;
  if (fixed) [lo, hi] = fixed;
  else {
    const ys = series.map(p => p.v);
    lo = Math.min(...ys) - 5; hi = Math.max(...ys) + 5;
    if (hi - lo < 24) { const m = (hi + lo) / 2; lo = m - 12; hi = m + 12; }
  }
  let d = '', prev = null, x = 0, y = 0;
  for (const p of series) {
    x = w * (1 - (now - p.t) / span); y = h - 10 - (h - 20) * (Math.max(lo, Math.min(hi, p.v)) - lo) / (hi - lo);
    d += (prev !== null && p.t - prev < 6 ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    prev = p.t;
  }
  path.setAttribute('d', d);
  head.setAttribute('cx', x.toFixed(1)); head.setAttribute('cy', y.toFixed(1));
}

export function buildRows(id, rows) {
  $(id).innerHTML = rows.map(([k, l]) => `<div class="row na" data-k="${k}"><span class="lbl">${l}</span><div class="trk"><i></i></div><span class="val">–</span></div>`).join('');
}

// Centered bar: left of the midline is below your baseline, right is above. z is clipped to +-3.
export function setRow(k, raw, z) {
  const r = document.querySelector(`.row[data-k="${k}"]`);
  if (!r) return;
  const i = r.querySelector('i'), v = r.querySelector('.val');
  if (z == null) {
    r.classList.add('na'); delete r.dataset.dir; i.style.width = '0%';
    v.textContent = raw == null ? '–' : 'no base'; r.title = raw == null ? 'No signal' : 'No baseline for this feature yet';
    return;
  }
  r.classList.remove('na');
  r.dataset.dir = z >= 0 ? 'up' : 'down';
  const c = Math.max(-3, Math.min(3, z));
  i.style.left = (c < 0 ? 50 + c / 3 * 50 : 50) + '%'; i.style.width = Math.abs(c) / 3 * 50 + '%';
  v.textContent = (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(1);
  r.title = `value ${raw.toFixed(2)}, z ${z.toFixed(2)}`;
}

export function setDot(el, q) { el.dataset.q = level(q); }
export function ring(p) { $('ring').style.strokeDashoffset = String(339.3 * (1 - Math.max(0, Math.min(1, p)))); }

// Self-report sliders: a bar counts only once touched, so there is no default value to anchor on.
export function initRate(id) {
  const i = $(id), r = i.closest('.rate'), o = r.querySelector('output');
  i.style.setProperty('--control-value', i.value);
  i.addEventListener('input', () => {
    r.dataset.t = '1'; o.textContent = i.value;
    i.style.setProperty('--control-value', i.value);
  });
}
export function resetRate(id) {
  const i = $(id), r = i.closest('.rate');
  i.value = 5; r.dataset.t = '0'; r.querySelector('output').textContent = '–';
  i.style.setProperty('--control-value', '5');
}
export const touched = id => $(id).closest('.rate').dataset.t === '1';

export function nextScheme(stored, systemDark) {
  const rendered = stored ?? (systemDark ? 'dark' : 'light');
  const target = rendered === 'dark' ? 'light' : 'dark';
  return target === (systemDark ? 'dark' : 'light') ? null : target;
}

export function initTheme(btn) {
  if (!btn) return;
  const sysDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const apply = val => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = val ?? 'light dark';
    btn.dataset.scheme = val ?? (sysDark() ? 'dark' : 'light');
  };
  btn.addEventListener('click', () => {
    let stored = null;
    try { stored = localStorage.getItem('color-scheme'); } catch (e) {}
    const nxt = nextScheme(stored, sysDark());
    try {
      if (nxt) localStorage.setItem('color-scheme', nxt);
      else localStorage.removeItem('color-scheme');
    } catch (e) {}
    apply(nxt);
  });
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', e => {
      if (e.key === 'color-scheme') apply(e.newValue);
    });
  }
}

export function drawer(open) {
  $('drawer').classList.toggle('open', open); $('scrim').classList.toggle('open', open);
  $('drawer').setAttribute('aria-hidden', String(!open));
  if (open) $('rStress').focus({ preventScroll: true });
}

// Light coach and pulse heuristics
export const LIGHT = { DIM_LUMA: 70, WARM_RG: 1.75 };
export function lightOf(samples, now, spanMs = 2000) {
  if (!samples || !samples.length) return null;
  const cutoff = now - spanMs;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s.t < cutoff) break;
    r += s.r; g += s.g; b += s.b; n++;
  }
  if (!n) return null;
  const mr = r / n, mg = g / n, mb = b / n;
  return {
    luma: 0.299 * mr + 0.587 * mg + 0.114 * mb,
    rg: mg > 0 ? mr / mg : Infinity
  };
}

export function lightTip(l) {
  if (!l) return null;
  if (l.luma < LIGHT.DIM_LUMA) return 'Your face is too dark for pulse. Face a lamp or a window, or turn screen brightness up.';
  if (l.rg > LIGHT.WARM_RG) return 'Warm yellow light hides the pulse. A white light in front of you works better.';
  return null;
}

export function hrView(last, now, holdS = 10) {
  if (!last) return { v: null, state: 'none', age: null };
  const age = now - last.t;
  return age <= 2 ? { v: last.v, state: 'live', age } : age <= holdS ? { v: last.v, state: 'held', age } : { v: null, state: 'none', age };
}

export const hrvShown = (hrv, q) => Number.isFinite(hrv) && hrv >= 15 && hrv <= 150 && (q ?? 0) >= 0.45 ? hrv : null;
