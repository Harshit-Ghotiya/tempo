// voice.js: on-device WebAudio acoustic arousal and Guna prior scorer for the window.setVoice hook.
// Audio is analysed in memory only and is never recorded, stored or uploaded.
export const MIN_RMS = 0.012;

export function acousticFeatures(timeBuf, freqBins, sampleRate = 48000) {
  const n = timeBuf.length;
  if (!n) return { rms: 0, zcr: 0, centroid: 0 };
  let sumSq = 0, zc = 0;
  for (let i = 0; i < n; i++) {
    const v = timeBuf[i];
    sumSq += v * v;
    if (i > 0 && (timeBuf[i - 1] >= 0) !== (v >= 0)) zc++;
  }
  const rms = Math.sqrt(sumSq / n), zcr = zc / n;
  let num = 0, den = 0;
  const binHz = (sampleRate / 2) / (freqBins.length || 1);
  for (let i = 1; i < freqBins.length; i++) {
    const mag = Math.max(0, (freqBins[i] + 100) / 100); // dB (-100..0) -> linear weight
    num += i * binHz * mag;
    den += mag;
  }
  return { rms, zcr, centroid: den > 0 ? num / den : 0 };
}

export function scoreVoice({ rms = 0, centroid = 0, zcr = 0 } = {}) {
  if (!Number.isFinite(rms) || rms < MIN_RMS) return { p: null, q: 0 };
  const q = Math.min(1, Math.max(0.3, (rms - MIN_RMS) / 0.08));
  const eNorm = Math.max(-1.5, Math.min(1.5, (rms - 0.055) / 0.04));
  const cNorm = Math.max(-1.5, Math.min(1.5, (centroid - 1300) / 700));
  const zNorm = Math.max(-1.5, Math.min(1.5, (zcr - 0.08) / 0.06));
  const arousal = 0.5 * eNorm + 0.35 * cNorm + 0.15 * zNorm;
  const logits = [
    0.45 - 0.65 * Math.abs(arousal), // sattva: steady, moderate vocal effort
    0.75 * arousal,                  // rajas: elevated vocal energy and brightness
    -0.65 * arousal - 0.25 * cNorm   // tamas: low vocal energy and dull spectrum
  ];
  const mx = Math.max(...logits), ex = logits.map(l => Math.exp(l - mx)), Z = ex[0] + ex[1] + ex[2];
  return { p: { sattva: ex[0] / Z, rajas: ex[1] / Z, tamas: ex[2] / Z }, q, arousal };
}

export function createVoiceMonitor(stream, onVoice) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC || !stream?.getAudioTracks?.().length) return { stop() {} };
  const ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume?.().catch?.(() => {});
  const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
  an.fftSize = 1024; an.smoothingTimeConstant = 0.5;
  src.connect(an);
  const tBuf = new Float32Array(an.fftSize), fBuf = new Float32Array(an.frequencyBinCount);
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(tBuf);
    an.getFloatFrequencyData(fBuf);
    const s = scoreVoice(acousticFeatures(tBuf, fBuf, ctx.sampleRate));
    if (s.p && typeof onVoice === 'function') onVoice(s.p, s.q);
  }, 500);
  timer.unref?.();
  return {
    stop() {
      clearInterval(timer);
      try { src.disconnect(); ctx.close(); } catch (e) {}
    }
  };
}
