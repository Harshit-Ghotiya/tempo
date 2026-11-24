import tempfile
import unittest
from pathlib import Path
import sys

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import train_guna as tg
import audit_features as af
import evaluate_rppg as er


class PythonPipelineTests(unittest.TestCase):
    def _make_df(self, n_part=6, rppg_drop=0.0, seed=0):
        rng = np.random.default_rng(seed)
        rows = []
        for p in range(n_part):
            for ph, st_val, z_sig in [("baseline", 2.0, -0.8), ("stressor", 7.0, 1.2), ("recovery", 3.5, 0.0)]:
                for k in range(10):
                    rq = 0.1 if rng.random() < rppg_drop else 0.9
                    rows.append({
                        "participant_id": f"P{p:02d}",
                        "session_id": "S01",
                        "phase": ph,
                        "eligible_for_training": True,
                        "label_lag_s": float(k),
                        "max_label_lag_s": 60.0,
                        "report_t_s": 100.0 if ph == "baseline" else 200.0,
                        "report_phase": ph,
                        "raw_sattva": max(1.0, 9.0 - st_val),
                        "raw_rajas": st_val,
                        "raw_tamas": 2.0,
                        "raw_stress": st_val,
                        "sattva_label": max(1.0, 9.0 - st_val) / 11.0,
                        "rajas_label": st_val / 11.0,
                        "tamas_label": 2.0 / 11.0,
                        "stress_label": st_val / 10.0,
                        "baseline_raw_sattva": 7.0,
                        "baseline_raw_rajas": 2.0,
                        "baseline_raw_tamas": 2.0,
                        "baseline_raw_stress": 2.0,
                        "face_quality": 0.9,
                        "rppg_quality": rq,
                        "pose_quality": 0.9,
                        "z_browLower": z_sig + rng.normal(0, 0.2),
                        "z_lidTight": z_sig + rng.normal(0, 0.2),
                        "z_lipTight": z_sig + rng.normal(0, 0.2),
                        "z_smile": -z_sig + rng.normal(0, 0.2),
                        "z_hr": z_sig * 1.1 + rng.normal(0, 0.2),
                        "z_shrug": z_sig + rng.normal(0, 0.2),
                    })
        return pd.DataFrame(rows)

    def test_fit_modality_ignores_all_nan_rows(self):
        df = self._make_df(n_part=6, rppg_drop=0.75, seed=7)
        with tempfile.TemporaryDirectory() as d:
            csv_path = Path(d) / "sess.csv"
            df.to_csv(csv_path, index=False)
            loaded, X, Y, groups, feats = tg.load_dataset(csv_path, 0.3)
        w = tg.row_weights(loaded, groups)
        mod = tg.fit_modality(X, Y, w, feats, "rppg", 1.0)
        self.assertIsNotNone(mod)
        idx, _ = tg.modality_cols(feats, "rppg")
        valid_vals = X[:, idx][~np.isnan(X[:, idx]).all(axis=1)]
        expected_std = float(np.std(valid_vals))
        actual_scale = float(mod["prep"].named_steps["standardscaler"].scale_[0])
        self.assertAlmostEqual(actual_scale, expected_std, places=5)

    def test_fuse_predictions_uses_fallback_prior_when_all_unavailable(self):
        P = {"face": np.array([[0.1, 0.8, 0.1], [0.2, 0.7, 0.1]])}
        A = {"face": np.array([True, False])}
        prior = np.array([0.6, 0.3, 0.1])
        out = tg.fuse_predictions(P, A, {"face": 1.0}, T=0.5, fallback=prior)
        np.testing.assert_allclose(out[1], prior, atol=1e-6)

    def test_regression_experiments_handles_partial_nan_and_stress_only_baseline(self):
        df = self._make_df(n_part=5, seed=3)
        df.loc[0, "raw_stress"] = np.nan
        df = df.drop(columns=["baseline_raw_sattva", "baseline_raw_rajas", "baseline_raw_tamas"])
        with tempfile.TemporaryDirectory() as d:
            csv_path = Path(d) / "sess.csv"
            df.to_csv(csv_path, index=False)
            loaded, X, Y, groups, _ = tg.load_dataset(csv_path, 0.3)
        w = tg.row_weights(loaded, groups)
        reg = tg.regression_experiments(loaded, X, w, groups)
        targets = set(reg["target"])
        self.assertIn("stress_abs", targets)
        self.assertIn("stress_delta", targets)
        self.assertNotIn("guna_delta", targets)

    def test_audit_features_z_only_and_session_id_collision(self):
        df = self._make_df(n_part=4, seed=11)
        self.assertIn("hrv", af.FEATURES)
        aud = af.audit(df)
        self.assertFalse(aud.empty)
        self.assertIn("browLower", set(aud["feature"]))

        # Two separate files both using session_id='S01' with single participant each must stay distinct
        p0 = df[df["participant_id"] == "P00"].copy()
        p1 = df[df["participant_id"] == "P01"].copy()
        per, summary = af.direction([("p0.csv", p0), ("p1.csv", p1)])
        self.assertEqual(set(per["session"]), {"P00_S01", "P01_S01"})
        self.assertEqual(int(summary.loc[summary["feature"] == "browLower", "sessions"].iloc[0]), 2)

    def test_evaluate_rppg_never_treats_z_hr_as_bpm(self):
        df = pd.DataFrame({
            "phase": ["baseline"] * 6,
            "z_hr": [0.1, -0.2, 0.3, 0.0, 0.2, -0.1],
            "rppg_quality": [0.9] * 6,
            "ref_hr": [70.0] * 6,
        })
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "zonly.csv"
            df.to_csv(p, index=False)
            res = er.evaluate_csv(str(p), ref_hr=70.0)
        self.assertEqual(res["hr_coverage"], 0.0)
        self.assertTrue(np.isnan(res["hr_median"]))
        self.assertNotIn("within_5bpm", res)


if __name__ == "__main__":
    unittest.main()
