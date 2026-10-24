"""Synthetic sessions.csv in the v0.4 browser schema. Validates the harness, not the science.

    python tools/make_synthetic.py signal|null [out.csv]

signal: z-features carry each participant's own reactivity (SNR chosen so the effect is detectable),
        so a model CAN beat the phase mean.
null:   z-features are pure noise, so no model should beat the phase mean.
"""
import sys
import numpy as np
import pandas as pd

mode = sys.argv[1] if len(sys.argv) > 1 else "signal"
out = sys.argv[2] if len(sys.argv) > 2 else "data/sessions.csv"
F = ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity", "blink", "gaze", "headMove", "hr", "shrug", "sway", "fidget"]
LOAD = dict(browLower=.6, browRaise=.2, lidTight=.5, eyeWide=.1, lipTight=.5, lipDown=.3, smile=-.5, expressivity=.2,
            blink=.3, gaze=.3, headMove=.4, hr=.8, shrug=.5, sway=.3, fidget=.7)
REPORT_T = dict(baseline=150, stressor=260, recovery=400)
rng = np.random.default_rng(7)


def rate(mu):
    return int(np.clip(round(mu + rng.normal(0, 0.5)), 0, 10))


rows = []
for p in range(20):
    react, bias = max(0.2, rng.normal(1.0, 0.5)), rng.normal(0, 1.0)
    change = dict(baseline=0.0, stressor=react, recovery=0.3 * react)
    rating = {ph: dict(sattva=rate(7 + bias / 2 - 3 * c), rajas=rate(2 + 3 * c), tamas=rate(2 + c), stress=rate(3 + bias + 3.5 * c))
              for ph, c in change.items()}
    base = rating["baseline"]
    for ph in change:
        y = rating[ph]
        s = max(1, y["sattva"] + y["rajas"] + y["tamas"])
        for k in range(30):
            z = {f"z_{f}": (rng.normal(0, 0.4) + 1.5 * LOAD[f] * change[ph]) if mode == "signal" else rng.normal() for f in F}
            rows.append({
                "participant_id": f"P{p:03d}", "session_id": "S01", "phase": ph, "eligible_for_training": True,
                "label_lag_s": float(k), "max_label_lag_s": 60, "report_t_s": REPORT_T[ph], "report_phase": ph,
                "raw_sattva": y["sattva"], "raw_rajas": y["rajas"], "raw_tamas": y["tamas"], "raw_stress": y["stress"],
                "sattva_label": y["sattva"] / s, "rajas_label": y["rajas"] / s, "tamas_label": y["tamas"] / s,
                "stress_label": y["stress"] / 10,
                "baseline_raw_sattva": base["sattva"], "baseline_raw_rajas": base["rajas"],
                "baseline_raw_tamas": base["tamas"], "baseline_raw_stress": base["stress"],
                "face_quality": 0.1 if rng.random() < .05 else 0.9, "rppg_quality": 0.9, "pose_quality": 0.9, **z})
pd.DataFrame(rows).to_csv(out, index=False)
print(f"{mode}: {len(rows)} rows, 20 participants -> {out}")
