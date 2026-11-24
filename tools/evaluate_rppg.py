"""
Evaluate webcam rPPG heart rate & HRV on Tempo session CSVs or video clips (Issue #1).

Usage:
    # 1. Audit rPPG coverage, quality, and lighting on exported session CSV(s):
    python tools/evaluate_rppg.py session.csv [more.csv ...]

    # 2. Validate against a fingertip pulse oximeter reference (target: >=50% of good windows within +-5 bpm):
    python tools/evaluate_rppg.py session.csv --ref-hr 72

    # 3. Run open-rppg (if installed via `pip install open-rppg`) offline on a recorded face video:
    python tools/evaluate_rppg.py --video clip.mp4 --model FacePhys.rlap
"""
import argparse
import sys

import numpy as np
import pandas as pd

SETUP = {"settle", "calibration"}


def evaluate_csv(path, ref_hr=None, min_q=0.3):
    df = pd.read_csv(path)
    live = df[~df["phase"].isin(SETUP)] if "phase" in df else df
    n_live = max(1, len(live))

    hr_col = "hr" if "hr" in live.columns else None
    num = lambda col: pd.to_numeric(live[col], errors="coerce") if col in live.columns else pd.Series(np.nan, index=live.index)
    hr_s, hrv_s, q_s = num("hr"), num("hrv"), num("rppg_quality")
    luma_s, rg_s, ref_s = num("skin_luma"), num("skin_rg"), num("ref_hr")

    hr = hr_s.dropna().to_numpy(float) if hr_col else np.array([])
    hrv = hrv_s.dropna().to_numpy(float)
    q = q_s.dropna().to_numpy(float)
    luma = luma_s.dropna().to_numpy(float)
    rg = rg_s.dropna().to_numpy(float)

    good_mask = (q_s.fillna(0) >= min_q) & hr_s.notna() if ("rppg_quality" in live.columns and hr_col) else pd.Series(False, index=live.index)
    good_hr = hr_s.loc[good_mask].to_numpy(float) if (hr_col and good_mask.any()) else np.array([])

    res = {
        "file": path,
        "live_rows": len(live),
        "hr_coverage": len(hr) / n_live,
        "hrv_coverage": len(hrv) / n_live,
        "mean_q": float(np.mean(q)) if len(q) else np.nan,
        "hr_median": float(np.median(hr)) if len(hr) else np.nan,
        "hr_iqr": float(np.percentile(hr, 75) - np.percentile(hr, 25)) if len(hr) >= 4 else np.nan,
        "hrv_median_ms": float(np.median(hrv)) if len(hrv) else np.nan,
        "luma_mean": float(np.mean(luma)) if len(luma) else np.nan,
        "rg_mean": float(np.mean(rg)) if len(rg) else np.nan,
    }

    # Check oximeter reference column (`ref_hr`) or CLI scalar `--ref-hr`
    if hr_col is not None and ref_s.notna().any():
        paired_mask = good_mask & ref_s.notna()
        if paired_mask.any():
            err = np.abs(hr_s.loc[paired_mask].to_numpy(float) - ref_s.loc[paired_mask].to_numpy(float))
            res["oximeter_mae"] = float(np.mean(err))
            res["within_5bpm"] = float(np.mean(err <= 5.0))
    elif ref_hr is not None and len(good_hr):
        err = np.abs(good_hr - float(ref_hr))
        res["oximeter_mae"] = float(np.mean(err))
        res["within_5bpm"] = float(np.mean(err <= 5.0))

    return res


def run_open_rppg(video_path, model_name="FacePhys.rlap"):
    try:
        import rppg
    except ImportError:
        raise SystemExit(
            "open-rppg is not installed in this Python environment.\n"
            "Install it with: pip install open-rppg\n"
            "Then re-run: python tools/evaluate_rppg.py --video " + video_path
        )
    model = rppg.Model(model_name)
    out = model.process_video(video_path)
    print(f"\nopen-rppg ({model_name}) on {video_path}:")
    print(f"  HR (bpm): {out.get('hr')}")
    print(f"  SQI:      {out.get('SQI')}")
    if out.get("hrv"):
        print(f"  HRV:      {out.get('hrv')}")
    return out


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate webcam rPPG accuracy and coverage.")
    parser.add_argument("csvs", nargs="*", help="Exported Tempo session CSV file(s)")
    parser.add_argument("--ref-hr", type=float, default=None, help="Fingertip oximeter mean HR (bpm) for +-5 bpm validation")
    parser.add_argument("--min-q", type=float, default=0.3, help="Minimum rppg_quality threshold (default: 0.3)")
    parser.add_argument("--video", type=str, default=None, help="Run open-rppg offline on a video file")
    parser.add_argument("--model", type=str, default="FacePhys.rlap", help="open-rppg model name (default: FacePhys.rlap)")
    args = parser.parse_args(argv)

    if args.video:
        run_open_rppg(args.video, args.model)

    if args.csvs:
        rows = [evaluate_csv(p, ref_hr=args.ref_hr, min_q=args.min_q) for p in args.csvs]
        df_out = pd.DataFrame(rows)
        print("\nrPPG Session Audit:")
        print(df_out.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
        if "within_5bpm" in df_out:
            passed = (df_out["within_5bpm"] >= 0.5).all()
            print(f"\nOximeter +-5 bpm criterion (>=50% of good windows): {'PASS' if passed else 'FAIL'}")

    if not args.video and not args.csvs:
        parser.print_help()


if __name__ == "__main__":
    main()
