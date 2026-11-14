"""
Posed expression audit tool (Issue #3 & Roadmap Phase 2b).

Validates MediaPipe blendshape composites against Facial Action Coding System (FACS) Action Units
described in LibreFace (2023) and Ekman & Friesen (1978).

Usage:
    # 1. Audit a session CSV containing tagged posed expressions (uses 'neutral' phase if present):
    python tools/audit_posed_expressions.py session.csv

    # 2. With explicit label intervals and external OpenFace/LibreFace AUs:
    python tools/audit_posed_expressions.py session.csv --labels labels.csv --au openface.csv
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from tools.audit_features import posed_audit
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from audit_features import posed_audit

# Canonical posed expressions and their matching Action Units in Tempo
AU_MAPPING = {
    "brow_furrow": {"target": "browLower", "au": "AU4", "muscle": "Corrugator supercilii"},
    "brow_raise": {"target": "browRaise", "au": "AU1+AU2", "muscle": "Frontalis"},
    "eye_squeeze": {"target": "lidTight", "au": "AU7", "muscle": "Orbicularis oculi"},
    "eye_wide": {"target": "eyeWide", "au": "AU5", "muscle": "Levator palpebrae"},
    "lip_press": {"target": "lipTight", "au": "AU24", "muscle": "Orbicularis oris"},
    "lip_depress": {"target": "lipDown", "au": "AU15", "muscle": "Depressor anguli oris"},
    "smile": {"target": "smile", "au": "AU12", "muscle": "Zygomaticus major"},
}

TRACKED_FEATURES = [
    "browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity"
]


def _annotate_selectivity(sel):
    if sel is None or not len(sel):
        return sel
    out = sel.copy()
    out.insert(1, "au", out["pose"].map(lambda k: AU_MAPPING.get(k, {}).get("au", "")))
    out.insert(2, "muscle", out["pose"].map(lambda k: AU_MAPPING.get(k, {}).get("muscle", "")))
    return out


def _phase_summary_fallback(df):
    """Fallback summary when no 'neutral' phase (>= 3 windows) is available for robust-SD normalization."""
    if "phase" not in df.columns:
        print("Error: CSV must contain a 'phase' column tagging expression segments.")
        return None
    phases = df["phase"].unique()
    print(f"Detected phases (no neutral baseline; using raw phase means): {list(phases)}")
    results = []
    for expr, meta in AU_MAPPING.items():
        target_feat = meta["target"]
        matching_phase = next((p for p in phases if expr.lower() in str(p).lower() or target_feat.lower() in str(p).lower()), None)
        if not matching_phase:
            continue
        seg = df[df["phase"] == matching_phase]
        if not len(seg):
            continue
        target_vals = seg[target_feat].dropna().to_numpy(float) if target_feat in seg else np.array([])
        target_z = seg["z_" + target_feat].dropna().to_numpy(float) if ("z_" + target_feat in seg) else np.array([])
        off_targets = {o: float(np.mean(seg[o].dropna().to_numpy(float)))
                       for o in TRACKED_FEATURES if o != target_feat and o in seg and len(seg[o].dropna())}
        max_off_target = max(off_targets.values()) if off_targets else 0.0
        contrast_ratio = (np.mean(target_vals) / max(1e-6, max_off_target)) if len(target_vals) else np.nan
        results.append({
            "expression": expr, "au": meta["au"], "muscle": meta["muscle"], "target_feature": target_feat,
            "phase": matching_phase, "windows": len(seg),
            "mean_val": float(np.mean(target_vals)) if len(target_vals) else np.nan,
            "peak_val": float(np.max(target_vals)) if len(target_vals) else np.nan,
            "mean_z": float(np.mean(target_z)) if len(target_z) else np.nan,
            "contrast_ratio": contrast_ratio,
            "top_cross_talk": max(off_targets, key=off_targets.get) if off_targets else "none",
        })
    return pd.DataFrame(results)


def audit_posed_expressions(df, labels=None, au=None, au_offset=0.0):
    """Audits Action Unit specificity via tools/audit_features.posed_audit, falling back to phase summaries if un-baselined."""
    D, sel, corr = posed_audit(df, labels=labels, au=au, au_offset=au_offset)
    if sel is not None:
        return _annotate_selectivity(sel)
    return _phase_summary_fallback(df)


def main():
    parser = argparse.ArgumentParser(description="Audit posed facial expression Action Unit fidelity.")
    parser.add_argument("csv_paths", nargs="+", help="One or more session CSV files to audit.")
    parser.add_argument("--labels", metavar="LABELS.csv", help="Optional posed-expression segments: start_s,end_s,expression")
    parser.add_argument("--au", metavar="AU.csv", help="Optional OpenFace-style AU intensities (timestamp, AUxx_r)")
    parser.add_argument("--au-offset", type=float, default=0.0, help="Seconds added to AU timestamps to align with t")
    args = parser.parse_args()

    labels = pd.read_csv(args.labels) if args.labels else None
    au = pd.read_csv(args.au) if args.au else None
    fmt = lambda v: f"{v:.3f}"

    for path in args.csv_paths:
        p = Path(path)
        if not p.is_file():
            print(f"File not found: {path}")
            continue
        print(f"\n=======================================================")
        print(f"Auditing Posed Expressions: {p.name}")
        print(f"=======================================================")
        df = pd.read_csv(p)
        D, sel, corr = posed_audit(df, labels=labels, au=au, au_offset=args.au_offset)
        if D is not None:
            print("posed response matrix (neutral robust SDs; rows = pose, columns = composite)")
            print(D.to_string(float_format=fmt))
            ann = _annotate_selectivity(sel)
            print("\nper-pose selectivity (pass: response >= 2 SD, leak ratio <= 0.5, target responds most to its own pose)")
            print(ann.to_string(index=False, float_format=fmt) if len(ann) else "no target poses found")
            if len(corr):
                print("\nrank correlation with external action units (target >= 0.6)")
                print(corr.to_string(index=False, float_format=fmt))
        else:
            res = _phase_summary_fallback(df)
            if res is not None and len(res):
                print(res.to_string(index=False, float_format=fmt))
            else:
                print("No tagged posed-expression phases found in file.")
                print("Tip: Run sessions tagging phases with expression names (e.g., 'neutral', 'brow_furrow', 'smile').")


if __name__ == "__main__":
    main()
