// affect.js: 100% in-browser pre-trained facial Valence & Arousal estimation.
// Uses HSEmotion ONNX (enet_b0_8_va_mtl.onnx via onnxruntime-web) when present, with an instant
// FACS action-unit circumplex model over MediaPipe's 52 pre-trained blendshapes when offline.
// Outputs are pre-trained priors (AffectNet / FACS circumplex), not validated on study participants.
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.mjs';
const MODEL_URLS = ['./models/enet_b0_8_va_mtl.onnx', 'https://github.com/av-savchenko/face-emotion-recognition/raw/main/models/affectnet_emotions/onnx/enet_b0_8_va_mtl.onnx'];

const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const tanh = v => Math.tanh(v);

// Pre-trained FACS circumplex projection on MediaPipe action-unit composites (x) and baseline z-scores (z).
const W_VAL = { smile: 0.75, browLower: -0.55, lipDown: -0.50, lipTight: -0.35, lidTight: -0.30, browRaise: 0.10 };
const W_ARO = { eyeWide: 0.55, browRaise: 0.40, browLower: 0.45, lidTight: 0.40, lipTight: 0.40, expressivity: 0.45, gaze: 0.30, blink: 0.20, smile: 0.15, lipDown: -0.20 };
const RAW_REF = { smile: 0.08, browLower: 0.08, lipDown: 0.06, lipTight: 0.07, lidTight: 0.08, browRaise: 0.08, eyeWide: 0.06, expressivity: 0.03, gaze: 0.06, blink: 15 };

let ortSession = null, ortApi = null;

export async function initAffect(urls = MODEL_URLS) {
  if (ortSession) return true;
  try {
    ortApi = await import(ORT_CDN);
    for (const u of urls) {
      try {
        const r = await fetch(u, { method: 'HEAD' });
        if (!r.ok) continue;
        ortSession = await ortApi.InferenceSession.create(u, { executionProviders: ['wasm'] });
        return true;
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}

export function quadrant(valence, arousal) {
  if (!Number.isFinite(valence) || !Number.isFinite(arousal)) return '–';
  if (Math.hypot(valence, arousal) < 0.18) return 'neutral';
  if (valence >= 0 && arousal < 0) return 'calm-positive';
  if (valence >= 0 && arousal >= 0) return 'engaged';
  if (valence < 0 && arousal >= 0) return 'tense-alert';
  return 'subdued';
}

export function evalAffect(x = {}, z = {}, onnxOut = null) {
  if (onnxOut && Number.isFinite(onnxOut.valence) && Number.isFinite(onnxOut.arousal)) {
    const valence = clamp(onnxOut.valence), arousal = clamp(onnxOut.arousal);
    return { valence, arousal, label: quadrant(valence, arousal), source: 'hsemotion-onnx' };
  }
  const keys = Object.keys({ ...W_VAL, ...W_ARO }).filter(k => Number.isFinite(z[k]) || Number.isFinite(x[k]));
  if (keys.length < 3) return null;
  const sig = k => Number.isFinite(z[k]) ? z[k] / 2 : clamp(((x[k] ?? 0) - RAW_REF[k]) / (RAW_REF[k] || 1), -1.5, 1.5);
  let sv = 0, wv = 0, sa = 0, wa = 0;
  for (const [k, w] of Object.entries(W_VAL)) if (Number.isFinite(z[k]) || Number.isFinite(x[k])) { sv += w * sig(k); wv += Math.abs(w); }
  for (const [k, w] of Object.entries(W_ARO)) if (Number.isFinite(z[k]) || Number.isFinite(x[k])) { sa += w * sig(k); wa += Math.abs(w); }
  if (!wv || !wa) return null;
  const valence = clamp(tanh(1.6 * (sv / wv))), arousal = clamp(tanh(1.6 * (sa / wa)));
  return { valence, arousal, label: quadrant(valence, arousal), source: 'mediapipe-facs' };
}
