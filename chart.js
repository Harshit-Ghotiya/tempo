// chart.js: modern, smooth, zone-colored SVG biometric trend chart for Tempo.
export const ZONES = [
  { key: 'relaxed', lo: -Infinity, hi: -0.75, label: 'Relaxed' },
  { key: 'base',    lo: -0.75,     hi: 0.75,  label: 'Baseline' },
  { key: 'up',      lo: 0.75,      hi: 1.5,   label: 'Elevated' },
  { key: 'high',    lo: 1.5,       hi: Infinity, label: 'High' },
];

export const zoneOf = v => (v == null || !Number.isFinite(v) ? null : v < -0.75 ? 'relaxed' : v <= 0.75 ? 'base' : v <= 1.5 ? 'up' : 'high');

// Fit view range comfortably around data with baseline band always visible.
export function niceRange(vals, { minLo = -1, minHi = 1.5, lim = 3, pad = 0.25 } = {}) {
  let lo = minLo, hi = minHi;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v - pad < lo) lo = v - pad;
    if (v + pad > hi) hi = v + pad;
  }
  return [Math.max(-lim, lo), Math.min(lim, hi)];
}

// Split a time series into contiguous runs; gaps > gapS or nulls break the line.
export function segments(series, gapS = 3) {
  const segs = [];
  let cur = [];
  let prevT = null;
  for (const p of series) {
    if (p == null || p.v == null || !Number.isFinite(p.v)) {
      if (cur.length) { segs.push(cur); cur = []; }
      prevT = null;
      continue;
    }
    if (prevT !== null && p.t - prevT > gapS) {
      if (cur.length) { segs.push(cur); cur = []; }
    }
    cur.push(p);
    prevT = p.t;
  }
  if (cur.length) segs.push(cur);
  return segs;
}

// Monotone cubic (Fritsch-Carlson) path: smooth, never overshoots the data.
export function smoothPath(pts) {
  const n = pts.length, f = v => v.toFixed(1);
  if (!n) return '';
  if (n === 1) return `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    m[i] = dx[i] ? (pts[i + 1].y - pts[i].y) / dx[i] : 0;
  }
  const t = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i].x + h)} ${f(pts[i].y + h * t[i])} ${f(pts[i + 1].x - h)} ${f(pts[i + 1].y - h * t[i + 1])} ${f(pts[i + 1].x)} ${f(pts[i + 1].y)}`;
  }
  return d;
}

// Frame-rate independent exponential smoothing factor.
export const ema = (dt, tau) => 1 - Math.exp(-Math.max(0, dt) / (tau || 1));

// Live trend chart renderer bound to an SVG container.
export function createTrend(svg, { span = 180, padTop = 14, padBottom = 22, padRight = 64 } = {}) {
  let series = [];
  let marks = [];
  let checks = [];
  let range = [-1, 1.5];
  let headV = 0;
  let lastFrame = 0;
  let rafId = null;
  let ro = null;
  let running = false;
  let W = 600, H = 170;

  const $id = id => svg ? (svg.getElementById?.(id) || svg.ownerDocument?.getElementById?.(id)) : null;

  function updateSize() {
    if (svg?.parentElement?.clientWidth) {
      W = Math.max(300, svg.parentElement.clientWidth);
      H = 170;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
  }

  return {
    push(t, v) {
      series.push({ t, v });
      const cut = t - span - 5;
      while (series.length && series[0].t < cut) series.shift();
    },

    mark(t, phase) {
      marks.push({ t, phase });
      const cut = t - span - 5;
      while (marks.length && marks[0].t < cut) marks.shift();
    },

    check(t, stress) {
      checks.push({ t, stress });
      const cut = t - span - 5;
      while (checks.length && checks[0].t < cut) checks.shift();
    },

    reset() {
      series = [];
      marks = [];
      checks = [];
      range = [-1, 1.5];
      headV = 0;
      lastFrame = 0;
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (ro) { ro.disconnect(); ro = null; }
      running = false;
    },

    start(getNow) {
      running = true;
      lastFrame = performance.now();
      updateSize();
      if (!ro && typeof ResizeObserver === 'function' && svg?.parentElement) {
        ro = new ResizeObserver(() => updateSize());
        ro.observe(svg.parentElement);
      }

      const loop = ts => {
        if (!running) return;
        const dt = (ts - lastFrame) / 1e3;
        if (ts - lastFrame >= 30) {
          lastFrame = ts;
          this.render(getNow ? getNow() : ts / 1e3, dt);
        }
        if (typeof requestAnimationFrame === 'function') {
          rafId = requestAnimationFrame(loop);
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(loop);
      }
    },

    stop() {
      running = false;
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (ro) { ro.disconnect(); ro = null; }
    },

    render(now, dt = 0.033) {
      if (!svg) return;
      const f = v => Number(v).toFixed(1);
      const vis = series.filter(p => p.t >= now - span && p.v != null && Number.isFinite(p.v));
      const target = niceRange(vis.map(p => p.v));
      range[0] += ema(dt, 0.6) * (target[0] - range[0]);
      range[1] += ema(dt, 0.6) * (target[1] - range[1]);
      if (range[1] <= range[0] + 0.5) range[1] = range[0] + 0.5;

      const rSpan = range[1] - range[0];
      const plotW = W - padRight;
      const plotH = H - padTop - padBottom;
      const toX = t => plotW * (1 - (now - t) / span);
      const toY = v => padTop + (range[1] - Math.max(range[0] - 1, Math.min(range[1] + 1, v))) / rSpan * plotH;
      const y0 = toY(0);

      // Update gradient stops to match current data y-coordinates
      const grad = $id('trendStroke');
      if (grad) {
        grad.setAttribute('y1', f(toY(1.8)));
        grad.setAttribute('y2', f(toY(-1.0)));
      }

      // Baseline band and zero dashed line
      const band = $id('idxBand');
      if (band) {
        const topY = toY(0.75), botY = toY(-0.75);
        band.setAttribute('x', '0');
        band.setAttribute('y', f(Math.min(topY, botY)));
        band.setAttribute('width', f(plotW));
        band.setAttribute('height', f(Math.abs(botY - topY)));
      }
      const zero = $id('trendZero');
      if (zero) {
        zero.setAttribute('x1', '0');
        zero.setAttribute('x2', f(plotW));
        zero.setAttribute('y1', f(y0));
        zero.setAttribute('y2', f(y0));
      }

      // Right-edge zone labels
      const zonesG = $id('trendZones');
      if (zonesG) {
        let zHtml = '';
        for (const z of ZONES) {
          const zlo = Math.max(range[0], z.lo), zhi = Math.min(range[1], z.hi);
          if (zhi > zlo) {
            const yTop = toY(zhi), yBot = toY(zlo);
            if (Math.abs(yBot - yTop) >= 14) {
              zHtml += `<text x="${f(W - 6)}" y="${f((yTop + yBot) / 2 + 3.5)}" fill="var(--text-3)" font-size="10" font-weight="500" text-anchor="end">${z.label}</text>`;
            }
          }
        }
        zonesG.innerHTML = zHtml;
      }

      // Vertical time gridlines (at 60s, 120s, 180s ago)
      const gridG = $id('trendGrid');
      if (gridG) {
        let gridHtml = '';
        for (const s of [60, 120, 180]) {
          const gx = toX(now - s);
          if (gx >= 0 && gx <= plotW) {
            gridHtml += `<line x1="${f(gx)}" x2="${f(gx)}" y1="${padTop}" y2="${H - padBottom}" stroke="var(--line)" stroke-dasharray="2 3" opacity="0.6"/>`;
          }
        }
        gridG.innerHTML = gridHtml;
      }

      // Phase annotations and background regions
      const phaseG = $id('trendPhases');
      if (phaseG) {
        let pHtml = '';
        const sortedMarks = marks.filter(m => m.t >= now - span).sort((a, b) => a.t - b.t);
        for (let i = 0; i < sortedMarks.length; i++) {
          const m = sortedMarks[i];
          const mx = toX(m.t);
          const nextT = i + 1 < sortedMarks.length ? sortedMarks[i + 1].t : now;
          const nextX = toX(nextT);
          const rw = Math.max(0, nextX - mx);
          const tint = m.phase === 'stressor' ? 'rgba(255, 149, 0, 0.05)' : m.phase === 'recovery' ? 'rgba(48, 176, 199, 0.05)' : 'transparent';
          if (rw > 0 && tint !== 'transparent') {
            pHtml += `<rect x="${f(mx)}" y="${padTop}" width="${f(rw)}" height="${f(plotH)}" fill="${tint}"/>`;
          }
          pHtml += `<line x1="${f(mx)}" x2="${f(mx)}" y1="${padTop}" y2="${H - padBottom}" stroke="var(--line)" stroke-width="1.2"/>`;
          pHtml += `<text x="${f(mx + 6)}" y="${padTop + 12}" fill="var(--text-3)" font-size="11" font-weight="600" text-transform="capitalize">${m.phase}</text>`;
        }
        phaseG.innerHTML = pHtml;
      }

      // Segment paths
      const segs = segments(series.filter(p => p.t >= now - span - 3));
      let fullPath = '';
      let areaPath = '';
      let lastPt = null;

      for (const seg of segs) {
        const pts = seg.map(p => ({ x: toX(p.t), y: toY(p.v) }));
        if (seg === segs[segs.length - 1] && seg.length && now - seg[seg.length - 1].t < 3) {
          const lastV = seg[seg.length - 1].v;
          headV += ema(dt, 0.18) * (lastV - headV);
          pts.push({ x: toX(now), y: toY(headV) });
        }
        const d = smoothPath(pts);
        if (d) {
          fullPath += (fullPath ? ' ' : '') + d;
          areaPath += ` ${d} L${f(pts[pts.length - 1].x)} ${f(y0)} L${f(pts[0].x)} ${f(y0)} Z`;
        }
        if (pts.length) lastPt = pts[pts.length - 1];
      }

      const pathEl = $id('idxPath');
      if (pathEl) pathEl.setAttribute('d', fullPath);
      const glowEl = $id('idxGlow');
      if (glowEl) glowEl.setAttribute('d', fullPath);
      const areaEl = $id('idxArea');
      if (areaEl) areaEl.setAttribute('d', areaPath);

      // Head indicator position
      const head = $id('idxHead');
      const pulse = $id('idxPulse');
      if (lastPt) {
        if (head) {
          head.setAttribute('cx', f(lastPt.x));
          head.setAttribute('cy', f(lastPt.y));
        }
        if (pulse) {
          pulse.setAttribute('cx', f(lastPt.x));
          pulse.setAttribute('cy', f(lastPt.y));
        }
        svg.dataset.zone = zoneOf(headV);
      } else {
        if (head) { head.setAttribute('cx', '-20'); head.setAttribute('cy', '-20'); }
        if (pulse) { pulse.setAttribute('cx', '-20'); pulse.setAttribute('cy', '-20'); }
      }

      // Check-in markers
      const checkG = $id('trendChecks');
      if (checkG) {
        let cHtml = '';
        for (const c of checks.filter(k => k.t >= now - span)) {
          const cx = toX(c.t);
          const curP = series.filter(p => Math.abs(p.t - c.t) < 2 && p.v != null)[0];
          const cy = curP ? toY(curP.v) : toY(0);
          cHtml += `<circle cx="${f(cx)}" cy="${f(cy)}" r="4.5" fill="#ffffff" stroke="var(--accent)" stroke-width="2"/>`;
          cHtml += `<text x="${f(cx)}" y="${f(cy - 9)}" fill="var(--text)" font-size="11" font-weight="700" text-anchor="middle">${c.stress}/10</text>`;
        }
        checkG.innerHTML = cHtml;
      }
    }
  };
}
