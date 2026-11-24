"""
Feature audit for portal session exports.

    python tools/audit_features.py session.csv [more.csv ...]
    python tools/audit_features.py posed.csv --posed labels.csv [--au openface.csv] [--au-offset 0.0]

1. Quality (per file): per feature, over the live (post-setup) rows: coverage, share of exact zeros, median, spread,
   drift from the calibration median in calibration-MADs, and the share of z-scores sitting at the +-3 clip. A high
   clipped share means the baseline spread was tiny compared with ordinary movement, so the feature is over-sensitive.
   Flags: dead (mostly missing or constant), no-baseline (no z-score), clipped (over-sensitive), drifting.
2. Direction (when baseline and stressor phases exist; pooled over all files): per session and feature, did the
   feature move the way the portal's literature priors expect (stressor vs baseline, stressor vs recovery), by how
   many baseline robust SDs, a one-sided sign test across sessions, and the Spearman correlation with stress_delta
   (raw_stress - baseline_raw_stress) using one point per session x phase, because overlapping 10 s windows are not
   independent evidence.
3. Posed-expression AU audit (--posed LABELS.csv with columns start_s,end_s,expression; expressions: neutral,
   brow_furrow, brow_raise, eye_squeeze, lip_press, smile; hold each pose >= 15 s so whole windows fit inside):
   response matrix in neutral robust SDs; per pose the target response, worst off-target leakage, selectivity and
   specificity. With --au (OpenFace-style CSV: timestamp, AU04_r, ...; rename LibreFace columns to AUxx_r), the
   Spearman rank correlation of each composite with the matching AU intensity over the same window (target >= 0.6).
Works on exports from v0.4 and later; features or columns absent from a file are skipped. Never commit the CSVs.
"""
import argparse
import math

import numpy as np
import pandas as pd

FEATURES = ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity",
            "brow", "lip", "blink", "gaze", "headMove", "hr", "hrv", "shrug", "sway", "fidget", "perclos"]
SETUP = {"settle", "calibration"}
# Expected sign of the change under acute stress (the portal's TENSION / MAP priors; hrv falls under load).
EXPECT = {"browLower": 1, "lidTight": 1, "lipTight": 1, "lipDown": 1, "smile": -1, "blink": -1, "gaze": 1,
          "headMove": 1, "hr": 1, "hrv": -1, "shrug": 1, "fidget": 1, "tension_idx": 1}
AU_FEATURES = ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile"]
POSED_TARGET = {"brow_furrow": "browLower", "brow_raise": "browRaise", "eye_squeeze": "lidTight",
                "eye_wide": "eyeWide", "lip_press": "lipTight", "lip_depress": "lipDown", "smile": "smile"}
AU_FLOOR = {"browLower": 0.03, "browRaise": 0.012, "lidTight": 0.03, "eyeWide": 0.004, "lipTight": 0.004,
            "lipDown": 0.002, "smile": 0.04}  # same as FLOOR in app.js
EXTERNAL_AU = {"browLower": ["AU04_r"], "browRaise": ["AU01_r", "AU02_r"], "lidTight": ["AU07_r"],
               "eyeWide": ["AU05_r"], "lipTight": ["AU23_r", "AU24_r"], "lipDown": ["AU15_r"], "smile": ["AU12_r"]}
MIN_ROWS = 5


def mad(a):
    return 1.4826 * np.median(np.abs(a - np.median(a))) if len(a) else np.nan


def audit(df):
    live = df[~df["phase"].isin(SETUP)] if "phase" in df else df
    cal = df[df["phase"] == "calibration"] if "phase" in df else df.iloc[:0]
    rows = []
    for f in FEATURES:
        has_raw = f in df.columns
        has_z = ("z_" + f) in df.columns
        if not has_raw and not has_z:
            continue
        zc = pd.to_numeric(live["z_" + f], errors="coerce").dropna().to_numpy(float) if has_z else np.array([])
        if has_raw:
            x = pd.to_numeric(live[f], errors="coerce").dropna().to_numpy(float)
            c = pd.to_numeric(cal[f], errors="coerce").dropna().to_numpy(float)
        else:
            x = zc
            c = pd.to_numeric(cal["z_" + f], errors="coerce").dropna().to_numpy(float) if len(cal) else np.array([])
        r = {"feature": f, "coverage": len(x) / max(1, len(live)), "zeros": float(np.mean(np.abs(x) < 1e-9)) if len(x) else np.nan,
             "median": np.median(x) if len(x) else np.nan, "mad": mad(x),
             "drift": (np.median(x) - np.median(c)) / max(mad(c), 1e-9) if len(x) and len(c) > 5 else np.nan,
             "z_coverage": len(zc) / max(1, len(live)), "z_clipped": float(np.mean(np.abs(zc) >= 2.999)) if len(zc) else np.nan}
        flags = []
        if r["coverage"] < 0.5 or r["zeros"] > 0.8 or not r["mad"] > 0:
            flags.append("dead")
        if f != "perclos" and r["z_coverage"] < 0.5:
            flags.append("no-baseline")
        if r["z_clipped"] > 0.25:
            flags.append("clipped")
        if abs(r["drift"]) > 3:
            flags.append("drifting")
        r["flags"] = " ".join(flags)
        rows.append(r)
    return pd.DataFrame(rows)


def spearman(a, b):
    a = pd.Series(np.asarray(a, dtype=float))
    b = pd.Series(np.asarray(b, dtype=float))
    ok = a.notna() & b.notna()
    if ok.sum() < 3 or a[ok].nunique() < 2 or b[ok].nunique() < 2:
        return np.nan
    return float(a[ok].rank().corr(b[ok].rank()))


def sign_test_p(k, n):
    """One-sided exact binomial P(X >= k | n, 1/2)."""
    return sum(math.comb(n, i) for i in range(k, n + 1)) / 2 ** n if n else np.nan


def feature_column(df, f):
    """Participant-normalised z-score when exported, raw value otherwise (tension_idx is already baseline-relative)."""
    if f != "tension_idx" and "z_" + f in df.columns:
        return "z_" + f, True
    if f in df.columns:
        return f, f == "tension_idx"
    return None, False


def live_rows(df):
    live = df[~df["phase"].isin(SETUP)]
    if "transition" in live.columns:
        live = live[~live["transition"].astype(str).str.lower().isin(["true", "1"])]
    return live


def direction(frames):
    per, pts = [], []
    for name, df in frames:
        if "phase" not in df.columns:
            continue
        live = live_rows(df)
        if {"participant_id", "session_id"} <= set(live.columns):
            key = live["participant_id"].astype(str) + "_" + live["session_id"].astype(str)
            sessions = live.groupby(key, sort=False)
        elif "session_id" in live.columns:
            sessions = live.groupby("session_id", sort=False)
        elif "participant_id" in live.columns:
            sessions = live.groupby("participant_id", sort=False)
        else:
            sessions = [(name, live)]
        for sid, s in sessions:
            ph = s["phase"].astype(str).to_numpy()
            delta = None
            if {"raw_stress", "baseline_raw_stress"} <= set(s.columns):
                delta = (pd.to_numeric(s["raw_stress"], errors="coerce")
                         - pd.to_numeric(s["baseline_raw_stress"], errors="coerce")).to_numpy(float)
            for f, sign in EXPECT.items():
                col, is_z = feature_column(s, f)
                if col is None:
                    continue
                v = pd.to_numeric(s[col], errors="coerce").to_numpy(float)
                b, st, rc = (v[(ph == p) & np.isfinite(v)] for p in ("baseline", "stressor", "recovery"))
                if len(b) >= MIN_ROWS and len(st) >= MIN_ROWS:
                    scale = max(mad(b), 0.25 if is_z else 1e-6)
                    d_sb = sign * (np.median(st) - np.median(b))
                    d_sr = sign * (np.median(st) - np.median(rc)) if len(rc) >= MIN_ROWS else np.nan
                    g = d_sb / scale
                    if abs(g) < 0.2:
                        verdict = "flat"
                    elif g < 0:
                        verdict = "reversed"
                    elif not np.isfinite(d_sr):
                        verdict = "up (no recovery data)"
                    elif d_sr > 0:
                        verdict = "concordant"
                    else:
                        verdict = "up, no return"
                    per.append({"session": sid, "feature": f, "column": col, "effect_sd": g,
                                "d_stress_base": d_sb, "d_stress_rec": d_sr, "verdict": verdict})
                if delta is not None:
                    for p in ("baseline", "stressor", "recovery"):
                        m = ph == p
                        fv, dv = np.nanmedian(v[m]) if np.isfinite(v[m]).any() else np.nan, \
                            np.nanmedian(delta[m]) if np.isfinite(delta[m]).any() else np.nan
                        if np.isfinite(fv) and np.isfinite(dv):
                            pts.append({"session": sid, "phase": p, "feature": f, "value": fv, "stress_delta": dv})
    per, pts = pd.DataFrame(per), pd.DataFrame(pts)
    if per.empty:
        return per, per
    rows = []
    for f, g in per.groupby("feature", sort=False):
        n, k = len(g), int((g["d_stress_base"] > 0).sum())
        q = pts[pts["feature"] == f] if not pts.empty else pts
        rho = EXPECT[f] * spearman(q["value"], q["stress_delta"]) if len(q) >= 6 else np.nan
        flags = []
        if (g["verdict"] == "reversed").mean() > 0.5:
            flags.append("WRONG-DIRECTION")
        if g["effect_sd"].abs().median() < 0.2:
            flags.append("weak")
        if np.isfinite(rho) and rho < -0.2:
            flags.append("anti-correlated")
        rows.append({"feature": f, "sessions": n, "concordant": int((g["verdict"] == "concordant").sum()),
                     "up_vs_base": k, "sign_p": sign_test_p(k, n), "median_effect_sd": g["effect_sd"].median(),
                     "rho_stress_delta": rho, "n_points": len(q), "flags": " ".join(flags)})
    return per, pd.DataFrame(rows)


def window_bounds(df):
    if {"window_start_s", "window_end_s"} <= set(df.columns):
        return df["window_start_s"].to_numpy(float), df["window_end_s"].to_numpy(float)
    t = df["t"].to_numpy(float)
    return t - 10.0, t


def posed_audit(df, labels=None, au=None, au_offset=0.0):
    feats = [f for f in AU_FEATURES if f in df.columns]
    ws, we = window_bounds(df)
    seg = {}
    if labels is not None:
        labels = labels.rename(columns=lambda c: str(c).strip())
        for _, r in labels.iterrows():
            e = str(r["expression"]).strip().lower()
            m = (ws >= float(r["start_s"])) & (we <= float(r["end_s"]))
            seg[e] = m if e not in seg else (seg[e] | m)
    elif "phase" in df.columns:
        phases = df["phase"].astype(str)
        for raw in phases.unique():
            low = raw.strip().lower()
            m = (phases == raw).to_numpy()
            if "neutral" in low:
                seg["neutral"] = m if "neutral" not in seg else (seg["neutral"] | m)
                continue
            for k, tgt in POSED_TARGET.items():
                if k in low or tgt.lower() in low:
                    seg[k] = m if k not in seg else (seg[k] | m)
                    break
    if "neutral" not in seg or seg["neutral"].sum() < 3 or not feats:
        print("posed audit: need AU composite columns and >= 3 whole windows inside 'neutral' segments")
        return None, None, None
    neu = df.loc[seg["neutral"]]
    num = {f: pd.to_numeric(df[f], errors="coerce") for f in feats}
    D = {}
    for e, m in seg.items():
        if e == "neutral" or m.sum() < 3:
            continue
        D[e] = {f: (num[f].loc[m].median() - num[f].loc[seg["neutral"]].median())
                / max(mad(num[f].loc[seg["neutral"]].dropna().to_numpy(float)), AU_FLOOR.get(f, 1e-3)) for f in feats}
    D = pd.DataFrame(D).T
    rows = []
    for e, f in POSED_TARGET.items():
        if e not in D.index or f not in D.columns:
            continue
        on = float(D.loc[e, f])
        off_f = D.loc[e].drop(f).abs()
        off = float(off_f.max()) if len(off_f) else 0.0
        others = D[f].drop(e)
        spec = bool(on >= others.max()) if len(others) else True
        leak = off / on if on > 0 else np.inf
        rows.append({"pose": e, "target": f, "response_sd": on, "worst_off_target": off_f.idxmax() if len(off_f) else "",
                     "leak_ratio": leak, "selectivity": (on - off) / (on + off) if on + off > 0 else np.nan,
                     "specific": spec, "pass": bool(on >= 2 and leak <= 0.5 and spec)})
    corr = []
    if au is not None:
        au = au.rename(columns=lambda c: str(c).strip())
        ts = pd.to_numeric(au["timestamp"], errors="coerce").to_numpy(float) + au_offset
        for f in feats:
            cols = [c for c in EXTERNAL_AU[f] if c in au.columns]
            if not cols:
                continue
            y = au[cols].apply(pd.to_numeric, errors="coerce").mean(axis=1).to_numpy(float)
            ext = np.array([pd.Series(y[(ts >= a) & (ts <= b)]).mean() for a, b in zip(ws, we)], dtype=float)
            rho = spearman(num[f].to_numpy(float), ext)
            corr.append({"feature": f, "external": "+".join(cols), "spearman": rho,
                         "n_windows": int((np.isfinite(ext) & np.isfinite(num[f].to_numpy(float))).sum()),
                         "pass": bool(np.isfinite(rho) and rho >= 0.6)})
    return D, pd.DataFrame(rows), pd.DataFrame(corr)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="portal session CSV exports")
    ap.add_argument("--posed", nargs="?", const="phase", metavar="LABELS.csv",
                    help="posed-expression audit: LABELS.csv (start_s,end_s,expression) or omit to use 'phase'")
    ap.add_argument("--au", metavar="AU.csv", help="OpenFace-style AU intensities (timestamp, AUxx_r)")
    ap.add_argument("--au-offset", type=float, default=0.0, help="seconds added to AU timestamps to align with t")
    args = ap.parse_args(argv)
    fmt = lambda v: f"{v:.3f}"
    frames = []
    for p in args.paths:
        df = pd.read_csv(p)
        live = df[~df["phase"].isin(SETUP)] if "phase" in df else df
        print(f"\n{p}: {len(df)} rows, {len(live)} live, phases {df['phase'].value_counts().to_dict() if 'phase' in df else 'n/a'}")
        out = audit(df)
        print(out.to_string(index=False, float_format=fmt))
        red = [(a, b, v) for a in FEATURES for b in FEATURES if a < b and a in live and b in live
               for v in [live[[a, b]].dropna().corr(method="spearman").iloc[0, 1]] if abs(v) >= 0.8]
        print("redundant pairs (|spearman| >= 0.8):", [(a, b, round(v, 2)) for a, b, v in red] or "none")
        frames.append((p, df))
    if args.posed:
        labels = None if args.posed == "phase" else pd.read_csv(args.posed)
        au = pd.read_csv(args.au) if args.au else None
        for p, df in frames:
            D, sel, corr = posed_audit(df, labels, au, args.au_offset)
            if D is None:
                continue
            print(f"\n{p}: posed response matrix (neutral robust SDs; rows = pose, columns = composite)")
            print(D.to_string(float_format=fmt))
            print("\nper-pose selectivity (pass: response >= 2 SD, leak ratio <= 0.5, target responds most to its own pose)")
            print(sel.to_string(index=False, float_format=fmt) if len(sel) else "no target poses found")
            if len(corr):
                print("\nrank correlation with external action units (target >= 0.6)")
                print(corr.to_string(index=False, float_format=fmt))
        return
    per, summary = direction(frames)
    if len(summary):
        print("\nDirection audit (expected stress direction; effect in baseline robust SDs; sign_p = one-sided sign test "
              "across sessions; rho = sign-adjusted Spearman with stress_delta, one point per session x phase)")
        print(summary.to_string(index=False, float_format=fmt))
        print("\nper session")
        print(per.to_string(index=False, float_format=fmt))
    else:
        print("\nDirection audit skipped: needs baseline and stressor phases with >= 5 live rows each.")


if __name__ == "__main__":
    main()
