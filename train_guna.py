"""
Guṇa ML training pipeline v0.4

Input:  data/sessions.csv  (browser export; one row per 1 s hop of a 10 s window)

Targets, evaluated as separate experiments:
  1. Compositional Guṇa state: S/R/T self-reports normalised to a simplex.
  2. Independent S/R/T ratings and explicit stress (0-10), absolute and as the change
     from the participant's own baseline report.

Rules this file enforces. Do not weaken them:
  * Leave-one-participant-out evaluation. Windows are never split.
  * Windows overlap and one self-report labels ~50 of them, so every participant, and inside
    a participant every report, gets equal total weight in training and in scoring.
  * Every model is reported against a constant baseline AND a phase-mean baseline. Labels
    are constant within a phase, so beating "constant" alone can just mean the model
    recognises the task rather than the reported state.
  * Intervals come from resampling participants, never windows.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import spearmanr
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import balanced_accuracy_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity",
                   "blink", "gaze", "headMove", "hr", "shrug", "sway", "fidget"]
MODALITIES = {
    "face": ["browLower", "browRaise", "lidTight", "eyeWide", "lipTight", "lipDown", "smile", "expressivity",
             "blink", "gaze", "headMove"],
    "rppg": ["hr"],
    "pose": ["shrug", "sway", "fidget"],
}
GUNAS = ["sattva", "rajas", "tamas"]
LABEL_COLUMNS = [f"{g}_label" for g in GUNAS]
RAW_COLUMNS = [f"raw_{g}" for g in GUNAS]
BASELINE_COLUMNS = [f"baseline_{c}" for c in RAW_COLUMNS + ["raw_stress"]]
C_GRID = [0.03, 0.1, 0.3, 1.0, 3.0]
EPS = 1e-12


# ------------------------------------------------------------------ data

def load_dataset(path, min_quality):
    df = pd.read_csv(path)
    missing = {"participant_id", "session_id", "phase"} - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    # Prefer the baseline-normalised features exported by the browser.
    feats = [f"z_{c}" for c in FEATURE_COLUMNS if f"z_{c}" in df.columns] or \
            [c for c in FEATURE_COLUMNS if c in df.columns]
    if not feats:
        raise ValueError("No recognised feature or z_<feature> columns found.")

    if "eligible_for_training" in df.columns:
        ok = df["eligible_for_training"].astype(str).str.lower().isin(["true", "1", "yes"])
        df = df.loc[ok].copy()
    if {"label_lag_s", "max_label_lag_s"} <= set(df.columns):  # defensive label-timing check
        lag = pd.to_numeric(df["label_lag_s"], errors="coerce")
        mx = pd.to_numeric(df["max_label_lag_s"], errors="coerce")
        df = df.loc[(lag >= 0) & (lag <= mx)].copy()
    if df.empty:
        raise ValueError("No training-eligible rows remain after filtering.")
    if not all(c in df.columns for c in LABEL_COLUMNS):
        raise ValueError("Missing labels. Add sattva_label, rajas_label, tamas_label.")
    df = df.reset_index(drop=True)

    # A modality's features count as missing wherever its quality score is low or absent.
    for m, base in MODALITIES.items():
        qc = f"{m}_quality"
        if qc in df.columns:
            bad = ~(pd.to_numeric(df[qc], errors="coerce") >= min_quality)
            for c in feats:
                if c.removeprefix("z_") in base:
                    df.loc[bad, c] = np.nan

    Y = df[LABEL_COLUMNS].astype(float).to_numpy()
    s = Y.sum(axis=1)
    if np.nanmedian(s) > 1.5:  # 0-10 ratings -> simplex
        Y = Y / np.maximum(s[:, None], EPS)
    if not np.isfinite(Y).all() or (Y < 0).any():
        raise ValueError("Labels must be finite and non-negative.")

    X = df[feats].astype(float).to_numpy()
    groups = df["participant_id"].astype(str).to_numpy()
    if len(np.unique(groups)) < 3:
        raise SystemExit("Need at least 3 participants for leave-one-participant-out evaluation.")
    return df, X, Y, groups, feats


def report_ids(df):
    """One id per self-report: participant, session and report time (phase if the time is absent)."""
    t = df["report_t_s"].astype(str) if "report_t_s" in df.columns else df["phase"].astype(str)
    return (df["participant_id"].astype(str) + "|" + df["session_id"].astype(str) + "|" + t).to_numpy()


def row_weights(df, groups):
    """Equal weight per report, then equal total weight per participant; mean weight 1."""
    rid = report_ids(df)
    w = 1.0 / pd.Series(rid).groupby(rid).transform("size").to_numpy(float)
    w = w / pd.Series(w).groupby(groups).transform("sum").to_numpy(float)
    return w * len(w) / w.sum()


# ------------------------------------------------------------------ numerics

def softmax_rows(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def weighted_mean(A, w):
    return (w[:, None] * A).sum(axis=0) / w.sum()


def weighted_ce(Y, P, w):
    """Soft cross-entropy against the actual target vectors, row-weighted."""
    ce = -np.sum(Y * np.log(np.clip(P, EPS, 1.0)), axis=1)
    return float(np.sum(w * ce) / w.sum())


def fit_soft_logistic(X, Y, C=1.0, w=None, max_iter=2000):
    """Multinomial logistic regression on soft targets with row weights; L2 on slopes only."""
    n, d = X.shape
    k, p = Y.shape[1], d + 1
    w = np.ones(n) if w is None else np.asarray(w, dtype=float)
    w = w / w.sum()
    Xa = np.column_stack([np.ones(n), X])

    def objective(theta):
        W = theta.reshape(k, p)
        ce = -np.sum(w[:, None] * Y * np.log(softmax_rows(Xa @ W.T) + EPS))
        return ce + 0.5 / C * np.sum(W[:, 1:] ** 2)

    def gradient(theta):
        W = theta.reshape(k, p)
        g = (w[:, None] * (softmax_rows(Xa @ W.T) - Y)).T @ Xa
        g[:, 1:] += W[:, 1:] / C
        return g.ravel()

    res = minimize(objective, np.zeros(k * p), jac=gradient, method="L-BFGS-B", options={"maxiter": max_iter})
    return res.x.reshape(k, p)


def predict_soft_logistic(W, X):
    return softmax_rows(np.column_stack([np.ones(len(X)), X]) @ W.T)


def make_prep():
    return make_pipeline(SimpleImputer(strategy="median", keep_empty_features=True), StandardScaler())


# ------------------------------------------------------------------ modality models and fusion

def modality_cols(features, modality):
    base = MODALITIES[modality]
    cols = [f"z_{c}" for c in base if f"z_{c}" in features] or [c for c in base if c in features]
    return [features.index(c) for c in cols], cols


def fit_modality(X, Y, w, features, modality, C):
    idx, cols = modality_cols(features, modality)
    if not idx or np.isnan(X[:, idx]).all():
        return None
    prep = make_prep()
    A = prep.fit_transform(X[:, idx])
    return {"idx": idx, "cols": cols, "prep": prep, "W": fit_soft_logistic(A, Y, C, w)}


def predict_modality(model, X):
    sub = X[:, model["idx"]]
    return predict_soft_logistic(model["W"], model["prep"].transform(sub)), ~np.isnan(sub).all(axis=1)


def lopo(fit_predict, X, Y, w, groups):
    P = np.zeros_like(Y)
    for g in np.unique(groups):
        te = groups == g
        P[te] = fit_predict(X[~te], Y[~te], w[~te], X[te])
    return P


def joint_predictor(C):
    def f(Xtr, Ytr, wtr, Xte):
        prep = make_prep()
        A = prep.fit_transform(Xtr)
        return predict_soft_logistic(fit_soft_logistic(A, Ytr, C, wtr), prep.transform(Xte))
    return f


def modality_oof(X, Y, w, groups, features, C):
    """Leave-one-participant-out predictions per modality: {modality: (probabilities, available)}."""
    out = {}
    for m in MODALITIES:
        if not modality_cols(features, m)[0]:
            continue
        P, A = np.full(Y.shape, 1 / 3), np.zeros(len(Y), dtype=bool)
        for g in np.unique(groups):
            te = groups == g
            mod = fit_modality(X[~te], Y[~te], w[~te], features, m, C)
            if mod is not None:
                P[te], A[te] = predict_modality(mod, X[te])
        if A.any():
            out[m] = (P, A)
    return out


def fuse_predictions(P, A, weights, T=1.0):
    """Log-linear opinion pool. Weights are renormalised per row over the modalities present."""
    n = len(next(iter(P.values())))
    num, den = np.zeros((n, 3)), np.zeros((n, 1))
    for m, wt in weights.items():
        a = A[m][:, None].astype(float)
        num += wt * a * np.log(np.clip(P[m], 1e-8, 1.0))
        den += wt * a
    logp = np.where(den > 0, num / np.maximum(den, EPS), np.log(1 / 3)) / T
    return softmax_rows(logp)


def fit_fusion(P, A, Y, w):
    """Modality weights on the simplex plus one temperature (the only calibration parameter)."""
    mods = list(P)
    M = len(mods)

    def unpack(th):
        e = np.exp(th[:M] - th[:M].max())
        return dict(zip(mods, e / e.sum())), float(np.exp(np.clip(th[M], -2, 2)))

    def objective(th):
        weights, T = unpack(th)
        return weighted_ce(Y, fuse_predictions(P, A, weights, T), w)

    res = minimize(objective, np.zeros(M + 1), method="Nelder-Mead",
                   options={"xatol": 1e-3, "fatol": 1e-6, "maxiter": 400})
    weights, T = unpack(res.x)
    return {"weights": weights, "temperature": T}


def nested_fusion(X, Y, w, groups, features, C):
    """Held-out participant never touches modality models, fusion weights or temperature."""
    P, rows = np.zeros_like(Y), []
    for g in np.unique(groups):
        te = groups == g
        inner = modality_oof(X[~te], Y[~te], w[~te], groups[~te], features, C)
        if not inner:
            P[te] = 1 / 3
            continue
        fusion = fit_fusion({m: v[0] for m, v in inner.items()}, {m: v[1] for m, v in inner.items()}, Y[~te], w[~te])
        preds, avail = {}, {}
        for m in inner:
            mod = fit_modality(X[~te], Y[~te], w[~te], features, m, C)
            if mod is not None:
                preds[m], avail[m] = predict_modality(mod, X[te])
        weights = {m: wt for m, wt in fusion["weights"].items() if m in preds}
        P[te] = fuse_predictions(preds, avail, weights, fusion["temperature"])
        rows.append({"test_participant": g, **{f"w_{m}": v for m, v in fusion["weights"].items()},
                     "temperature": fusion["temperature"]})
    return P, pd.DataFrame(rows)


ABLATIONS = {"face": ["face"], "rppg": ["rppg"], "pose": ["pose"],
             "face+pose": ["face", "pose"], "visual_equal": ["face", "rppg", "pose"]}


# ------------------------------------------------------------------ baselines and scoring

def baseline_predictions(Y, w, groups, phases):
    """Constant and phase-mean predictors fitted on the training participants only."""
    const, phase = np.zeros_like(Y), np.zeros_like(Y)
    for g in np.unique(groups):
        te, tr = groups == g, groups != g
        const[te] = weighted_mean(Y[tr], w[tr])
        for ph in np.unique(phases[te]):
            m = tr & (phases == ph)
            phase[te & (phases == ph)] = weighted_mean(Y[m], w[m]) if m.any() else const[te][0]
    return const, phase


def macro_ce(Y, P, w, groups):
    return np.array([weighted_ce(Y[groups == g], P[groups == g], w[groups == g]) for g in np.unique(groups)])


def boot_ci(d, reps=2000, seed=0):
    d = np.asarray(d, dtype=float)
    idx = np.random.default_rng(seed).integers(0, len(d), (reps, len(d)))
    m = d[idx].mean(axis=1)
    return float(d.mean()), float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))


def summarise(preds, Y, w, groups):
    ids = np.unique(groups)
    ce_const, ce_phase = (macro_ce(Y, preds[k], w, groups) for k in ("constant", "phase_mean"))
    rows, per = [], []
    for name, P in preds.items():
        ce = macro_ce(Y, P, w, groups)
        c, p = boot_ci(ce - ce_const), boot_ci(ce - ce_phase)
        rows.append({"method": name, "soft_ce": ce.mean(),
                     "vs_constant": c[0], "vs_constant_lo": c[1], "vs_constant_hi": c[2],
                     "vs_phase_mean": p[0], "vs_phase_mean_lo": p[1], "vs_phase_mean_hi": p[2],
                     "balanced_acc": balanced_accuracy_score(Y.argmax(1), P.argmax(1)),
                     "n_participants": len(ids), "n_windows": len(Y)})
        per += [{"method": name, "participant": g, "soft_ce": v} for g, v in zip(ids, ce)]
    return pd.DataFrame(rows), pd.DataFrame(per)


def permutation_test(X, Y, w, groups, phases, rid, C, n_perm, seed=0):
    """Shuffle whole report label vectors across participants WITHIN each phase.
    Phase-level effects survive, participant-specific links do not, so this asks whether the
    features explain individual differences beyond what the phase alone predicts."""
    rng = np.random.default_rng(seed)

    def stat(Yp):
        P = lopo(joint_predictor(C), X, Yp, w, groups)
        _, ph = baseline_predictions(Yp, w, groups, phases)
        return float(np.mean(macro_ce(Yp, P, w, groups) - macro_ce(Yp, ph, w, groups)))

    obs, null = stat(Y), []
    for _ in range(n_perm):
        Yp = Y.copy()
        for ph in np.unique(phases):
            ids = np.unique(rid[phases == ph])
            labels = np.stack([Y[rid == r][0] for r in ids])
            for r, j in zip(ids, rng.permutation(len(ids))):
                Yp[rid == r] = labels[j]
        null.append(stat(Yp))
    return {"observed_joint_minus_phase_mean": obs, "n_permutations": n_perm,
            "p_value": (1 + sum(v <= obs for v in null)) / (1 + n_perm)}


# ------------------------------------------------------------------ regression targets

def ridge_cv(X, T, w, groups, lo, hi, zero_ref, phases=None):
    pred, mean_ref, phase_ref = np.zeros_like(T), np.zeros_like(T), np.zeros_like(T)
    for g in np.unique(groups):
        te = groups == g
        prep = make_prep()
        A = prep.fit_transform(X[~te])
        model = Ridge(alpha=1.0).fit(A, T[~te], sample_weight=w[~te])
        pred[te] = np.clip(model.predict(prep.transform(X[te])).reshape(-1, T.shape[1]), lo, hi)
        mean_ref[te] = weighted_mean(T[~te], w[~te])
        phase_ref[te] = mean_ref[te]
        if phases is not None:  # a predictor that is told the phase: matching it only shows the model recognises the task
            for ph in np.unique(phases[te]):
                m = (~te) & (phases == ph)
                if m.any():
                    phase_ref[te & (phases == ph)] = weighted_mean(T[m], w[m])

    def macro_mae(P):
        return np.array([np.sum(w[groups == g] * np.abs(T[groups == g] - P[groups == g]).mean(axis=1))
                         / w[groups == g].sum() for g in np.unique(groups)])

    mae, ref = macro_mae(pred), macro_mae(mean_ref)
    d = boot_ci(mae - ref)
    out = {"mae": mae.mean(), "mean_baseline_mae": ref.mean(), "vs_mean": d[0], "vs_mean_lo": d[1], "vs_mean_hi": d[2]}
    if phases is not None:
        pr = macro_mae(phase_ref)
        dp = boot_ci(mae - pr)
        out.update({"phase_baseline_mae": pr.mean(), "vs_phase": dp[0], "vs_phase_lo": dp[1], "vs_phase_hi": dp[2]})
    if zero_ref:  # change targets: "no change" is the natural reference
        z = macro_mae(np.zeros_like(T))
        dz = boot_ci(mae - z)
        out.update({"zero_baseline_mae": z.mean(), "vs_zero": dz[0], "vs_zero_lo": dz[1], "vs_zero_hi": dz[2]})
    rhos = [spearmanr(T[:, j], pred[:, j]).statistic for j in range(T.shape[1])
            if T[:, j].std() > 1e-12 and pred[:, j].std() > 1e-12]
    out["spearman"] = float(np.mean(rhos)) if rhos else float("nan")
    return out


def regression_experiments(df, X, w, groups):
    phase = df["phase"].astype(str).to_numpy()
    rows = []

    def run(name, T, mask, lo, hi, zero_ref):
        gm = groups[mask]
        if len(np.unique(gm)) < 3:
            return
        wm = w[mask] / pd.Series(w[mask]).groupby(gm).transform("sum").to_numpy()
        res = ridge_cv(X[mask], T[mask], wm * len(wm) / wm.sum(), gm, lo, hi, zero_ref, phases=phase[mask])
        rows.append({"target": name, **res, "n_participants": len(np.unique(gm)), "n_windows": int(mask.sum())})

    allrows = np.ones(len(df), dtype=bool)
    has_raw = all(c in df.columns for c in RAW_COLUMNS)
    has_stress = "raw_stress" in df.columns
    raw3 = df[RAW_COLUMNS].astype(float).to_numpy() if has_raw else None
    st = df[["raw_stress"]].astype(float).to_numpy() if has_stress else None
    if has_raw:
        run("guna_abs", raw3.clip(0, 10) / 10, allrows, 0, 1, False)
    if has_stress:
        run("stress_abs", st.clip(0, 10) / 10, allrows, 0, 1, False)
    if all(c in df.columns for c in BASELINE_COLUMNS):
        moved = phase != "baseline"
        if has_raw:
            b3 = df[BASELINE_COLUMNS[:3]].astype(float).to_numpy()
            run("guna_delta", (raw3 - b3) / 10, moved & np.isfinite(raw3).all(1) & np.isfinite(b3).all(1), -1, 1, True)
        if has_stress:
            bs = df[[BASELINE_COLUMNS[3]]].astype(float).to_numpy()
            run("stress_delta", (st - bs) / 10, moved & np.isfinite(st[:, 0]) & np.isfinite(bs[:, 0]), -1, 1, True)
    return pd.DataFrame(rows)


# ------------------------------------------------------------------ export

def fit_final(X, Y, w, groups, features, C):
    """Final models on all participants, plus fusion weights and temperature fitted on LOPO predictions."""
    models = {}
    for m in MODALITIES:
        mod = fit_modality(X, Y, w, features, m, C)
        if mod is None:
            continue
        imp, sc = mod["prep"].named_steps["simpleimputer"], mod["prep"].named_steps["standardscaler"]
        models[m] = {"features": mod["cols"], "imputer_median": np.nan_to_num(imp.statistics_).tolist(),
                     "mean": sc.mean_.tolist(), "scale": sc.scale_.tolist(), "W": mod["W"].tolist(), "classes": GUNAS}
    oof = modality_oof(X, Y, w, groups, features, C)
    fusion = fit_fusion({m: v[0] for m, v in oof.items()}, {m: v[1] for m, v in oof.items()}, Y, w) if oof else None
    return {"meta": {"trainer_version": "0.4", "C": C, "n_participants": int(len(np.unique(groups))),
                     "n_windows": int(len(Y)), "target": "self-reported state (compositional)",
                     "warning": "Experimental. Trained on self-report; not a validated measure."},
            "models": models, "fusion": fusion}


def show(df, title):
    print(f"\n{title}")
    print(df.to_string(index=False, float_format=lambda v: f"{v:.3f}"))


def main():
    ap = argparse.ArgumentParser(description="Train and evaluate the Guna models (see module docstring).")
    ap.add_argument("--data", default="data/sessions.csv")
    ap.add_argument("--out", default="artifacts")
    ap.add_argument("--C", type=float, default=0.3, help="inverse L2 strength, fixed a priori (see c_sweep.csv)")
    ap.add_argument("--min-quality", type=float, default=0.3, help="modality quality below this counts as missing")
    ap.add_argument("--permutations", type=int, default=0, help="phase-aware label permutations (try 200)")
    args = ap.parse_args()

    path = Path(args.data)
    if not path.exists():
        raise SystemExit(f"Create {path} first. See DATA_SCHEMA.md (or tools/make_synthetic.py for a harness check).")
    df, X, Y, groups, feats = load_dataset(path, args.min_quality)
    w, phases, rid = row_weights(df, groups), df["phase"].astype(str).to_numpy(), report_ids(df)
    n_part = len(np.unique(groups))
    print(f"Loaded {len(df)} windows from {n_part} participants and {len(np.unique(rid))} self-reports.")
    print(f"Features: {feats}")
    if n_part < 10:
        print("WARNING: fewer than 10 participants. Intervals below are not meaningful.")

    const, phase_mean = baseline_predictions(Y, w, groups, phases)
    oof = modality_oof(X, Y, w, groups, feats, args.C)
    preds = {"constant": const, "phase_mean": phase_mean,
             "joint": lopo(joint_predictor(args.C), X, Y, w, groups)}
    for name, mods in ABLATIONS.items():
        mods = [m for m in mods if m in oof]
        if mods:
            preds[name] = fuse_predictions({m: oof[m][0] for m in mods}, {m: oof[m][1] for m in mods},
                                           {m: 1 / len(mods) for m in mods})
    preds["fusion_learned"], fusion_rows = nested_fusion(X, Y, w, groups, feats, args.C)

    reg = regression_experiments(df, X, w, groups)
    if len(reg):
        show(reg.drop(columns=["n_windows"]), "PRIMARY: stress and rating targets, leave-one-participant-out (MAE lower is better; *_delta is change from the participant's own baseline report)")
    else:
        print("\nRegression targets skipped: raw rating columns absent.")

    results, per = summarise(preds, Y, w, groups)
    show(results.drop(columns=["n_participants", "n_windows"]),
         "SECONDARY (course demo): compositional Guna state, leave-one-participant-out (soft_ce lower is better; vs_* negative = better than that baseline)")

    sweep = []
    for C in C_GRID:
        P = lopo(joint_predictor(C), X, Y, w, groups)
        sweep.append({"C": C, "soft_ce": macro_ce(Y, P, w, groups).mean(),
                      "vs_phase_mean": float(np.mean(macro_ce(Y, P, w, groups) - macro_ce(Y, phase_mean, w, groups)))})
    sweep = pd.DataFrame(sweep)
    show(sweep, "Sensitivity of the joint model to regularisation (for reporting only; C was not chosen on this)")

    perm = None
    if args.permutations > 0:
        perm = permutation_test(X, Y, w, groups, phases, rid, args.C, args.permutations)
        print(f"\nPhase-aware permutation test: joint minus phase-mean soft CE = "
              f"{perm['observed_joint_minus_phase_mean']:.4f}, p = {perm['p_value']:.3f} "
              f"({perm['n_permutations']} permutations)")

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    results.to_csv(out / "results_compositional.csv", index=False)
    per.to_csv(out / "per_participant_compositional.csv", index=False)
    fusion_rows.to_csv(out / "fusion_weights.csv", index=False)
    sweep.to_csv(out / "c_sweep.csv", index=False)
    if len(reg):
        reg.to_csv(out / "results_regression.csv", index=False)
    if perm:
        (out / "permutation.json").write_text(json.dumps(perm, indent=2), encoding="utf-8")
    (out / "models.json").write_text(json.dumps(fit_final(X, Y, w, groups, feats, args.C), indent=2), encoding="utf-8")
    print(f"\nSaved results to {out}/")


if __name__ == "__main__":
    main()
