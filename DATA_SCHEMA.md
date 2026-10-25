# Guṇa study data schema (v0.3)

One row = one 10-second rolling window, exported once per second. Derived features only; no raw video or audio.

## Browser export columns
- Identity and timing: `participant_id`, `session_id`, `t`, `window_start_s`, `window_end_s`, `feature_start_s`, `phase` (settle | calibration | baseline | stressor | recovery), `phase_start_s`, `transition`
- Features (face): `browLower`, `browRaise`, `lidTight`, `eyeWide`, `lipTight`, `lipDown`, `smile`, `expressivity`, `blink`, `gaze`, `headMove`. Optional: `shrug`, `sway`, `fidget` (posture), `hr` (experimental pulse), `perclos` (raw only). Each modelled feature has a `z_<feature>` column (clipped baseline z-score, present after setup)
- Heuristic outputs: `p_sattva`, `p_rajas`, `p_tamas` (priors, not a trained model) and `agree` (voice/visual agreement when a voice model supplies probabilities)
- Quality: `face_quality`, `rppg_quality`, `pose_quality`
- Labels, assigned at export: `eligible_for_training`, `max_label_lag_s`, `report_t_s`, `report_phase`, `label_window_start_s`, `label_window_end_s`, `label_lag_s`, `raw_sattva`, `raw_rajas`, `raw_tamas`, `sattva_label`, `rajas_label`, `tamas_label`, `raw_stress`, `stress_label`

## Labelling rule
A window is labelled only if all of these hold:
1. `phase` is not settle or calibration and `transition` is false: the 30 s before the window (`feature_start_s` onward) lie inside the phase and contain no tab-visibility change. Blink rate uses a 30 s buffer, so 30 s is the longest look-back any feature has.
2. A self-report exists whose `report_phase` equals the window's phase.
3. `window_start_s >= report_t_s - 60` and `window_end_s <= report_t_s`, so `label_lag_s = report_t_s - window_end_s` lies in [0, 60].

The nearest later report wins if several qualify. No label is carried forward.

## Targets
- Guṇa state: S/R/T ratings (0-10). Normalised to a simplex for the compositional model; raw values for the independent model. Example: S=8, R=2, T=1 gives [0.727, 0.182, 0.091].
- Stress: `raw_stress` (0-10), `stress_label` = raw/10. A separate target, never derived from `p_sattva`.

## Leakage rules
- Split by participant only (`LeaveOneGroupOut`); never randomly split windows.
- Baseline statistics come only from the participant's calibration period.
- Fusion weights are fitted only inside the training participants.
- Report the number of participants and eligible windows, each modality separately, fusion, and a constant-prediction baseline.

## v0.4 additions
- Every row carries the participant's own baseline report: `baseline_raw_sattva`, `baseline_raw_rajas`, `baseline_raw_tamas`, `baseline_raw_stress` (blank if no baseline report was saved). The trainer uses them for change-from-baseline targets.
- The trainer treats a modality's features as missing when `face_quality`, `rppg_quality` or `pose_quality` is below `--min-quality` (default 0.3) or blank.
- Rows are weighted so every participant, and within a participant every self-report, counts equally.
- Outputs (artifacts/): results_compositional.csv, per_participant_compositional.csv, fusion_weights.csv, c_sweep.csv, results_regression.csv, permutation.json (if requested), models.json.

## v0.5 additions
- `hr` is exported only for validated windows (see hr.js); otherwise it is blank. `rppg_quality` is spectral SNR mapped to 0-1: clamp((SNR_dB + 6) / 12). Windows below 0.3 count as missing in the trainer.
- `perclos` is exported raw but is no longer modelled (no `z_perclos`; removed from the trainer's feature list).
- Baselines are the median and 1.4826 x MAD (floored at 10% of the median) of at least 25 good-quality calibration windows per feature. A feature with fewer has no `z_` column for that session, and the portal says so on screen.
- `p_sattva`, `p_rajas`, `p_tamas` and `agree` are written only when a trained `models.json` is loaded or `DEMO_GUNA` is true in app.js (default false).

## v0.6 additions
- Face features are action-unit composites of MediaPipe blendshape scores, averaged over the 10 s window: browLower (AU4), browRaise (AU1/2), lidTight (AU7), eyeWide (AU5), lipTight (AU23/24 plus lip rolls), lipDown (AU15), smile (AU12). `expressivity` is the mean standard deviation of those composites (how much the face moves). The old `brow` and `lip` columns are gone.
- Baselines use per-feature minimum spreads (FLOOR in app.js), so near-zero blendshape scores no longer make ordinary movement look extreme.
- `tension_idx`: prior-weighted facial tension index (positive = more tension relative to the person's own baseline). Weights are literature-based priors, not fitted. Blank when the face signal is unusable.
- The oximeter columns planned for v0.5 (`ref_hr`, `ref_hr_age_s`) are not exported: that work is deferred.
