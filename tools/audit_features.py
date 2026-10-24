"""
Feature audit for portal session exports.

    python tools/audit_features.py session.csv [more.csv ...]

Per feature, over the live (post-setup) rows: coverage, share of exact zeros, median, spread, drift from the
calibration median in calibration-MADs, and the share of z-scores sitting at the +-3 clip. A high clipped share
means the baseline spread was tiny compared with ordinary movement, so the feature is over-sensitive.
Flags: dead (mostly missing or constant), no-baseline (no z-score), clipped (over-sensitive), drifting.
Works on exports from v0.4 and later; features absent from a file are skipped.
"""
import sys

import numpy as np
import pandas as pd

FEATURES = ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity",
            "brow", "lip", "blink", "gaze", "headMove", "hr", "shrug", "sway", "fidget", "perclos"]
SETUP = {"settle", "calibration"}


def mad(a):
    return 1.4826 * np.median(np.abs(a - np.median(a))) if len(a) else np.nan


def audit(df):
    live = df[~df["phase"].isin(SETUP)] if "phase" in df else df
    cal = df[df["phase"] == "calibration"] if "phase" in df else df.iloc[:0]
    rows = []
    for f in FEATURES:
        if f not in df.columns:
            continue
        x, c = live[f].dropna().to_numpy(float), cal[f].dropna().to_numpy(float)
        zc = live["z_" + f].dropna().to_numpy(float) if "z_" + f in df.columns else np.array([])
        r = {"feature": f, "coverage": len(x) / max(1, len(live)), "zeros": float(np.mean(np.abs(x) < 1e-9)) if len(x) else np.nan,
             "median": np.median(x) if len(x) else np.nan, "mad": mad(x),
             "drift": (np.median(x) - np.median(c)) / max(mad(c), 1e-9) if len(x) and len(c) > 5 else np.nan,
             "z_coverage": len(zc) / max(1, len(live)), "z_clipped": float(np.mean(np.abs(zc) >= 2.999)) if len(zc) else np.nan}
        flags = []
        if r["coverage"] < 0.5 or r["zeros"] > 0.8 or not r["mad"] > 0:
            flags.append("dead")
        if f + "" != "perclos" and r["z_coverage"] < 0.5:
            flags.append("no-baseline")
        if r["z_clipped"] > 0.25:
            flags.append("clipped")
        if abs(r["drift"]) > 3:
            flags.append("drifting")
        r["flags"] = " ".join(flags)
        rows.append(r)
    return pd.DataFrame(rows)


def main(paths):
    for p in paths:
        df = pd.read_csv(p)
        live = df[~df["phase"].isin(SETUP)] if "phase" in df else df
        print(f"\n{p}: {len(df)} rows, {len(live)} live, phases {df['phase'].value_counts().to_dict() if 'phase' in df else 'n/a'}")
        out = audit(df)
        print(out.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
        red = [(a, b, v) for a in FEATURES for b in FEATURES if a < b and a in live and b in live
               for v in [live[[a, b]].dropna().corr(method="spearman").iloc[0, 1]] if abs(v) >= 0.8]
        print("redundant pairs (|spearman| >= 0.8):", [(a, b, round(v, 2)) for a, b, v in red] or "none")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
