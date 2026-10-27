// ui.js: small DOM helpers for the Tempo portal. No camera or MediaPipe code, so Node + jsdom can test it.
import { smoothPath, niceRange, segments, zoneOf } from './chart.js?v=0.7.5';
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
  r.title = `value ${Number.isFinite(raw) ? raw.toFixed(2) : '–'}, z ${z.toFixed(2)}`;
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
    if (val) document.documentElement.dataset.theme = val;
    else delete document.documentElement.dataset.theme;
    btn.dataset.scheme = val ?? (sysDark() ? 'dark' : 'light');
  };
  let initStored = null;
  try { initStored = localStorage.getItem('color-scheme'); } catch (e) {}
  apply(initStored);
  btn.addEventListener('click', () => {
    let stored = document.documentElement.dataset.theme || null;
    try { stored = localStorage.getItem('color-scheme') ?? stored; } catch (e) {}
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

export const hrvShown = (hrv, q) => Number.isFinite(hrv) && hrv >= 15 && hrv <= 200 && (q ?? 0) >= 0.30 ? hrv : null;

// Modal dialog helpers
export function openDialog(d) {
  if (!d) return;
  if (typeof d.showModal === 'function') {
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  } else {
    d.setAttribute('open', '');
  }
}

export function closeDialog(d) {
  if (!d) return;
  if (typeof d.close === 'function') d.close();
  else d.removeAttribute('open');
}

export function setupDialogDismiss(d) {
  if (!d || 'closedBy' in d) return;
  d.addEventListener('click', e => {
    if (e.target !== d) return;
    const rect = d.getBoundingClientRect();
    const inDialog = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!inDialog) closeDialog(d);
  });
}

const PHASE_COLORS = { baseline: 'var(--green)', stressor: 'var(--orange)', recovery: 'var(--teal)' };
const ZONE_LABELS = { relaxed: 'Relaxed', base: 'Near baseline', up: 'Elevated', high: 'High tension' };

export function renderSummary(stats, checks, log = [], meta = {}) {
  const sumMeta = $('sumMeta');
  if (sumMeta) {
    const mins = Math.floor((meta.durationS ?? 0) / 60);
    const secs = Math.round((meta.durationS ?? 0) % 60);
    sumMeta.textContent = `${meta.participantId || 'Participant'} · ${meta.sessionId || 'Session'} · ${mins}m ${String(secs).padStart(2, '0')}s · ${meta.reportCount ?? 0} check-in(s)`;
  }

  // 1. Phase cards
  const sumPhases = $('sumPhases');
  if (sumPhases) {
    sumPhases.innerHTML = (stats || []).map(s => {
      const color = PHASE_COLORS[s.phase] || 'var(--text-3)';
      const repHtml = s.report ? `
        <div class="sum-stat-big">${s.report.stress}/10</div>
        <div class="sum-bar-track"><div class="sum-bar-fill" style="width:${Math.min(100, Math.max(0, s.report.stress * 10))}%"></div></div>
      ` : '<div class="sum-subtext dusk">No check-in rating</div>';

      const zn = zoneOf(s.tension.mean);
      const znLabel = zn ? ZONE_LABELS[zn] : '';
      const tnStr = s.tension.mean != null ? `${s.tension.mean >= 0 ? '+' : '−'}${Math.abs(s.tension.mean).toFixed(2)}` : '–';
      const pkStr = s.tension.peak != null ? `Peak: ${s.tension.peak >= 0 ? '+' : '−'}${Math.abs(s.tension.peak).toFixed(2)}` : '';
      const hrStr = s.hr.mean != null ? `Pulse: ${Math.round(s.hr.mean)} bpm (${s.hr.n} readings)` : 'No pulse lock';
      const valStr = s.valence != null && s.arousal != null ? `Valence: ${s.valence.toFixed(2)} · Arousal: ${s.arousal.toFixed(2)}` : '';
      const gunaStr = s.guna?.sattva != null
        ? `Sattva ${Math.round(s.guna.sattva * 100)}% · Rajas ${Math.round(s.guna.rajas * 100)}% · Tamas ${Math.round(s.guna.tamas * 100)}%`
        : '';

      return `
        <div class="sumphase-card" style="--phase-color:${color}">
          <div class="sumphase-head">
            <h3 class="sumphase-title">${s.phase}</h3>
          </div>
          <p class="sumphase-basis">${s.basis} (${s.n} windows)</p>
          <div class="sum-compare">
            <div>
              <div class="sum-col-label">You reported</div>
              ${repHtml}
            </div>
            <div>
              <div class="sum-col-label">Tempo measured</div>
              <div class="sum-stat-big">${tnStr} <span style="font-size:14px;color:var(--text-2);font-family:var(--font-display)">${znLabel}</span></div>
              <div class="sum-subtext">${[pkStr, hrStr, valStr, gunaStr].filter(Boolean).join('<br>')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Stroop cognitive stressor result
  const sumStroop = $('sumStroop');
  if (sumStroop) {
    if (meta.stroop && meta.stroop.trials > 0) {
      sumStroop.hidden = false;
      sumStroop.innerHTML = `
        <div class="sumstroop-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Cognitive Stressor: Stroop Color-Word Challenge
        </div>
        <div>
          <b>${meta.stroop.trials}</b> trials completed ·
          <b>${meta.stroop.accuracy}%</b> accuracy ·
          <b>${meta.stroop.meanRtMs} ms</b> mean reaction time
          ${meta.stroop.interferenceMs > 0 ? `· <b>+${meta.stroop.interferenceMs} ms</b> Stroop cognitive interference delay` : ''}
        </div>
      `;
    } else {
      sumStroop.hidden = true;
      sumStroop.innerHTML = '';
    }
  }

  // 2. Whole session chart
  const svg = $('sumChart');
  if (svg) {
    const valid = (log || []).filter(r => typeof r.tension_idx === 'number' && Number.isFinite(r.tension_idx));
    const maxT = Math.max(60, (log && log.length) ? log[log.length - 1].t : 60);
    const [lo, hi] = niceRange(valid.map(r => r.tension_idx));
    const W = 800, H = 220, padT = 20, padB = 30, padL = 40, padR = 25;
    const xOf = t => padL + (Math.max(0, Math.min(maxT, t)) / maxT) * (W - padL - padR);
    const yOf = v => padT + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo || 1)) * (H - padT - padB);

    // Phase background tints
    let phaseRects = '';
    const phaseChanges = [];
    let curP = null;
    for (const r of (log || [])) {
      if (r.phase && r.phase !== curP) {
        phaseChanges.push({ phase: r.phase, t: r.t });
        curP = r.phase;
      }
    }
    for (let i = 0; i < phaseChanges.length; i++) {
      const pc = phaseChanges[i];
      const nextT = i < phaseChanges.length - 1 ? phaseChanges[i + 1].t : maxT;
      const x1 = xOf(pc.t), x2 = xOf(nextT);
      const fill = pc.phase === 'stressor' ? 'rgba(255,149,0,0.08)' : pc.phase === 'recovery' ? 'rgba(48,176,199,0.08)' : 'transparent';
      phaseRects += `<rect x="${x1.toFixed(1)}" y="${padT}" width="${Math.max(0, x2 - x1).toFixed(1)}" height="${H - padT - padB}" fill="${fill}"/>`;
      phaseRects += `<text x="${(x1 + 6).toFixed(1)}" y="${padT + 14}" fill="var(--text-3)" font-size="10" font-weight="600" text-transform="uppercase">${pc.phase}</text>`;
    }

    // Zero line
    const y0 = yOf(0);
    const zeroLine = `<line x1="${padL}" y1="${y0.toFixed(1)}" x2="${W - padR}" y2="${y0.toFixed(1)}" stroke="var(--text-3)" stroke-dasharray="3 4" opacity="0.5"/>`;

    // Segments and path
    const segs = segments(valid.map(r => ({ t: r.t, v: r.tension_idx })));
    const pathD = segs.map(s => smoothPath(s.map(pt => ({ x: xOf(pt.t), y: yOf(pt.v) })))).join(' ');

    // Check-in markers
    let checkMarks = '';
    const reps = (stats || []).map(s => s.report).filter(Boolean);
    for (const rep of reps) {
      const cx = xOf(rep.t);
      const near = valid.length
        ? valid.reduce((best, r) => Math.abs(r.t - rep.t) < Math.abs(best.t - rep.t) ? r : best, valid[0])
        : null;
      const cy = near ? yOf(near.tension_idx) : yOf(0);
      checkMarks += `
        <line x1="${cx.toFixed(1)}" y1="${padT}" x2="${cx.toFixed(1)}" y2="${H - padB}" stroke="var(--line)" stroke-width="1"/>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="var(--accent)" stroke="#ffffff" stroke-width="2"/>
        <text x="${cx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" fill="var(--text)" font-size="11" font-weight="700" text-anchor="middle">${rep.stress}/10</text>
      `;
    }

    // Time axis ticks
    const t0 = '0:00', tMid = `${Math.floor(maxT / 120)}:${String(Math.floor((maxT / 2) % 60)).padStart(2, '0')}`, tEnd = `${Math.floor(maxT / 60)}:${String(Math.floor(maxT % 60)).padStart(2, '0')}`;
    const timeAxis = `
      <text x="${padL}" y="${H - 10}" fill="var(--text-3)" font-size="10">${t0}</text>
      <text x="${W / 2}" y="${H - 10}" fill="var(--text-3)" font-size="10" text-anchor="middle">${tMid}</text>
      <text x="${W - padR}" y="${H - 10}" fill="var(--text-3)" font-size="10" text-anchor="end">${tEnd}</text>
    `;

    svg.innerHTML = `
      ${phaseRects}
      ${zeroLine}
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${checkMarks}
      ${timeAxis}
    `;
  }

  // 3. Direction checks
  const sumChecks = $('sumChecks');
  if (sumChecks) {
    const arrow = s => s == null ? '–' : s > 0 ? '↑ rise' : s < 0 ? '↓ drop' : '→ steady';
    const rowsHtml = (checks || []).map(c => {
      const statusClass = c.agree === true ? 'agree' : c.agree === false ? 'diff' : 'na';
      const statusText = c.agree === true ? '✓ Same direction' : c.agree === false ? '✗ Different direction' : 'Not enough data';
      const fromName = c.from.charAt(0).toUpperCase() + c.from.slice(1);
      const toName = c.to.charAt(0).toUpperCase() + c.to.slice(1);
      return `
        <div class="sumcheck-row">
          <div class="sumcheck-trans">${fromName} → ${toName}</div>
          <div>You reported: <b>${arrow(c.you)}</b></div>
          <div>Tempo measured: <b>${arrow(c.tempo)}</b></div>
          <div class="sumcheck-res ${statusClass}">${statusText}</div>
        </div>
      `;
    }).join('');
    let noteHtml = '';
    if (stats?.length >= 3 && checks?.[0]?.agree && checks?.[1]?.agree) {
      const bMean = stats[0]?.tension?.mean, sMean = stats[1]?.tension?.mean, rMean = stats[2]?.tension?.mean;
      if (bMean != null && sMean != null && rMean != null) {
        const rise = sMean - bMean, drop = sMean - rMean;
        if (rise > 0.15 && drop > 0 && drop < 0.55 * rise) {
          noteHtml = '<div class="sum-subtext" style="margin-top:4px">Note: Facial and autonomic tension settled partially during Recovery; residual tension after a stressor often takes 2–3 minutes to return fully to baseline.</div>';
        }
      }
    }
    sumChecks.innerHTML = rowsHtml + noteHtml;
  }
}

