// summary.js: session-level statistical aggregation and direction verification.
// Pure functions only; testable without DOM.
export const PHASES = ['baseline', 'stressor', 'recovery'];

const num = v => typeof v === 'number' && Number.isFinite(v);
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

// Per phase: uses the 60 s window before self-report if >= 10 clean rows exist, else all clean rows.
export function phaseStats(log, reports, span = 60) {
  return PHASES.map(phase => {
    const rep = reports.filter(r => r.phase === phase).sort((a, b) => a.t - b.t).at(-1) ?? null;
    const clean = log.filter(r => r.phase === phase && !r.transition);
    const inWin = rep ? clean.filter(r => r.window_start_s >= rep.t - span && r.window_end_s <= rep.t) : [];
    const rows = inWin.length >= 10 ? inWin : clean;
    const col = k => rows.map(r => r[k]).filter(num);
    const tn = col('tension_idx'), hr = col('hr');
    return {
      phase,
      n: rows.length,
      basis: inWin.length >= 10 ? 'last 60 s before check-in' : 'whole phase (clean windows)',
      tension: { mean: avg(tn), peak: tn.length ? Math.max(...tn) : null },
      valence: avg(col('valence')),
      arousal: avg(col('arousal')),
      hr: { mean: avg(hr), n: hr.length },
      guna: { sattva: avg(col('p_sattva')), rajas: avg(col('p_rajas')), tamas: avg(col('p_tamas')) },
      report: rep ? { stress: rep.raw_stress, sattva: rep.raw_sattva, rajas: rep.raw_rajas, tamas: rep.raw_tamas, t: rep.t } : null,
    };
  });
}

// Did Tempo move in the same direction as self-reported stress?
export function directionChecks(stats, { dTension = 0.1, dStress = 1 } = {}) {
  const by = Object.fromEntries(stats.map(s => [s.phase, s]));
  const sgn = (d, eps) => d == null ? null : d > eps ? 1 : d < -eps ? -1 : 0;
  return [['baseline', 'stressor'], ['stressor', 'recovery']].map(([a, b]) => {
    const A = by[a], B = by[b];
    const you = A?.report && B?.report ? sgn(B.report.stress - A.report.stress, dStress - 1e-9) : null;
    const tempo = A?.tension?.mean != null && B?.tension?.mean != null ? sgn(B.tension.mean - A.tension.mean, dTension) : null;
    return {
      from: a,
      to: b,
      you,
      tempo,
      agree: you == null || tempo == null ? null : you === tempo
    };
  });
}
