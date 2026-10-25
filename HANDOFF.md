# Guṇa Multimodal ML Project — Claude Handoff

**Project version:** v0.6 (face-first stress detector, redesigned portal, packaged apps, on top of v0.5)  
**Date:** 2026-10-25  
**Purpose:** This document is the source-of-truth handoff for continuing development in Claude.

---

## v0.6.4 update (2026-10-25): opt-in on-device microphone voice scorer for window.setVoice (voice.js)

Changed
1. `voice.js` adds an on-device WebAudio acoustic monitor (`acousticFeatures`, `scoreVoice`, `createVoiceMonitor`) that computes RMS energy, zero-crossing rate and spectral centroid in memory, abstains during silence, and feeds voice Guṇa prior probabilities into `window.setVoice(p, q)` so live visual–voice agreement (`#ag`) works during speech. Audio is never recorded, stored or uploaded.
2. `index.html` and `app.js` add an optional `#uVoice` toggle on the consent sheet (off by default) and a `#dVoice` quality indicator dot.

Checked: `node --check` on `app.js`, `ui.js`, `hr.js`, `affect.js`, `voice.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (24 tests pass); `train_guna.py` on synthetic data.
Not checked: live microphone capture with a real speaker in the browser; real participant stress data; packaged Mac or Windows app runs.

## v0.6.3 update (2026-10-25): in-browser pre-trained facial Valence and Arousal (affect.js)

Changed
1. `affect.js` provides on-device facial Valence and Arousal estimation in `[-1, 1]` and circumplex labels (`calm-positive`, `engaged`, `tense-alert`, `subdued`, `neutral`). It loads HSEmotion (`enet_b0_8_va_mtl.onnx` via `onnxruntime-web`) when available and falls back to a pre-trained FACS circumplex projection over MediaPipe's 52 blendshape action-unit composites so it works offline with zero latency.
2. `index.html` and `app.js` display `valence`, `arousal` and the circumplex label in the researcher details panel (explicitly labelled as an unvalidated AffectNet / FACS prior) and export `valence` and `arousal` in the CSV.

Checked: `node --check` on `app.js`, `ui.js`, `hr.js`, `affect.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (23 tests pass).
Not checked: live webcam session on a real face; ONNX model download in a real browser; real participant stress data.

## v0.6.2 update (2026-10-25): skin-pixel gating and HRV (RMSSD) for webcam pulse

Changed
1. `isSkin` in `hr.js` and the forehead/cheek ROI loop in `app.js` reject non-skin pixels (hair, glasses frames, shadows and specular glare) using RGB and YCbCr chrominance bounds before averaging RGB, falling back to unsaturated pixels only when fewer than 20 skin pixels are found. The RGB rolling buffer in `app.js` is extended from 12 s to 16 s.
2. `rmssd` in `hr.js` extracts parabolic-interpolated inter-beat intervals from the zero-phase fundamental-band pulse wave and estimates HRV (`hrv`, RMSSD in ms) whenever at least 4 valid consecutive beat intervals exist. `hrv` is shown alongside `hr` in `#pulseBox` (labelled experimental) and exported with its baseline z-score (`z_hrv`).

Checked: `node --check` on `app.js`, `ui.js`, `hr.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (22 tests pass, including skin-mask and respiratory-modulation HRV tests).
Not checked: pulse and HRV accuracy against a fingertip oximeter on real faces; packaged Mac or Windows app runs.

## v0.6.1 update (2026-10-25): load trained models.json and demo preset in the browser portal

Changed
1. `loadModel` in `app.js` fetches `./models.json`, `./artifacts/models.json` or `./preset_models.json` at startup and before each session starts. When a valid model file is found, the portal unhides the researcher Guṇa readout (`#guna`) and exports `p_sattva`, `p_rajas`, `p_tamas` and `agree`. `preset_models.json` provides an out-of-the-box demo prior (explicitly marked as unvalidated in its metadata) that is overridden whenever `train_guna.py` writes `artifacts/models.json`.
2. `modP` and `fuse` in `app.js` evaluate the per-modality median imputer, standard scaler and multinomial logistic weights (`W`), and combine available modalities with the trained log-linear opinion pool (`fusion.weights` and `fusion.temperature`), matching `predict_modality` and `fuse_predictions` in `train_guna.py`. Modalities absent from the loaded model file abstain instead of mixing heuristic priors with learned weights. The facial tension index weights (`TENSION`) remain unvalidated literature-based priors.

Checked: `npm ci`; `node --check` on `app.js`, `ui.js`, `hr.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (20 tests pass); `train_guna.py` on synthetic data and `app.js` inference against both `artifacts/models.json` and `preset_models.json`.
Not checked: real browser camera session with a real face; real stress data; packaged Mac or Windows app runs.

## v0.6 update (2026-10-11): face-first stress detector, redesigned portal, packaged apps

Direction from the team: loosen the focus on pulse and HRV (a webcam alone is not accurate enough, and better measurement needs other equipment); judge stress from facial expression; keyboard and mouse tracking come later; Triguna is a demo layer added last.

Changed
1. Face-first features (app.js): action-unit composites built from MediaPipe blendshapes, averaged per 10 s window: browLower, browRaise, lidTight, eyeWide, lipTight, lipDown, smile, plus expressivity (how much the face moves), blink, gaze, headMove. Posture (shrug, sway, fidget) is optional. Pulse is optional, off by default, and shown only as a small experimental row. The old brow and lip features are gone.
2. Baseline floors (FLOOR in app.js). tools/audit_features.py on the first real session showed the old lip feature at the +-3 clip in 48% of live windows (its baseline spread was tiny), fidget never baselined and perclos dead. Every feature now has a minimum baseline spread.
3. Facial tension index (TENSION in app.js): prior-weighted mean of baseline z-scores, smoothed, shown as words, a number and a 3 minute line with a typical-range band. It needs a usable face and 4+ features with a baseline, otherwise it says "Not enough signal yet". The weights are literature-based priors and are NOT fitted or validated. Exported as tension_idx.
4. Portal redesign (index.html, ui.js): consent sheet, setup stage with live checks, live stage, check-in drawer whose sliders count only once touched (no default to anchor on), toasts, light and dark themes, reduced-motion aware, system fonts only. The oximeter validation UI was removed with the pulse work.
5. Trainer: stress targets are primary (stress_abs, stress_delta), the Guna composition is secondary. The stress tables now include a phase-mean baseline. On synthetic data the model's win over the mean baseline mostly vanished against the phase baseline, so always read vs_phase.
6. Packaging (launcher/): one program per platform with the UI, MediaPipe code and WASM embedded, so the page works offline. The two model files are downloaded once from Google's official host into a cache and served locally. They are not bundled because the only copy reachable here sat inside an unrelated third-party package and could not be verified. One instance at a time, loopback only, quits about 3 minutes after the page closes. macOS is a single universal Tempo.app, ad-hoc signed with rcodesign and delivered in a zip: the earlier bare binaries lost their executable bit, needed the right architecture, and Apple silicon refuses unsigned code. It is not notarised (paid Apple account), so macOS asks for a one-time approval; see the README inside the zip.

Checked: tests/ui.test.mjs (id contract and helper behaviour), tests/hr.test.mjs, the trainer on synthetic data, the Linux launcher (assets, MIME types, model cache, single instance, heartbeat, idle exit), and an end-to-end run in headless Chromium with a fake camera (MediaPipe from the launcher, no external requests, setup stage reached).
Not checked: any run on a Mac or Windows machine; the real model download from Google; face detection on a real face; the tension index against real stress data.

Next
1. Each teammate runs one real stressor session (Stroop or serial subtraction, three check-ins) and sends the CSV; run tools/audit_features.py on each.
2. Posed-expression audit: record clips (neutral, brow furrow, brow raise, lip press, eye squeeze, smile) and compare the blendshape composites with action units from OpenFace 3.0 or LibreFace.
3. Collect 20+ participants, fit stress_delta with train_guna.py and compare against phase_mean.
4. Later: keyboard and mouse dynamics; load a trained model in the portal (models.json is exported but not read yet); the Triguna demo layer (DEMO_GUNA in app.js).

## v0.5 update (2026-10-05): Phase 0 of the pivot to a robust stress tracker (see ROADMAP.md)

Why: the first real session (setup plus 100 s of baseline, no labels) showed heart rate floor-locked or doubled in 54 of 146 windows (33 at the 42 bpm band floor, 21 near twice the plausible rate), head motion about 4x higher in the first calibration seconds than in the last, fidget never baselined (wrists out of frame), PERCLOS about 0, and Triguna bars at 26/37/37% while sitting still.

Changed
1. Heart rate: new hr.js, tested in tests/hr.test.mjs. POS, zero-phase band-pass 0.65-4.5 Hz, interior spectral peaks only (a spectrum that merely rises to the band edge yields no estimate), harmonic-sum scoring, SNR-based quality, and a tracker gated at +-15 bpm of the previous estimate that halves or doubles only with spectral evidence and re-acquires after 6 consistent windows. `hr` is exported only for valid windows.
2. A 20 s settle phase before the 60 s calibration (phase `settle`, never labelled). Baseline windows start 10 s after settling ends.
3. Baseline is median and 1.4826 x MAD (floored at 10% of the median) over at least 25 good-quality windows, not mean and SD.
4. PERCLOS is exported raw but no longer modelled; removed from the trainer's feature list.
5. Triguna bars, voice agreement and the heuristic p_* columns are hidden and not exported unless DEMO_GUNA is true in app.js.

Evidence (synthetic skin-colour traces, `node --test tests/hr.test.mjs`, 11 tests). The v0.4 estimator doubled to the 2nd harmonic while tracking (60 bpm mean error), was off by 13-36 bpm under slow artefacts and reported a rate for pure noise. The new tracker held the fundamental, reported no estimate for noise, and was never off by 15 bpm or more in any scenario. The exact floor lock of the real session did not reproduce strongly in synthetic data (v0.4 errors there were 13-19 bpm, not exactly 42). This validates the logic, not accuracy on real faces: Phase 1 needs the pulse-oximeter comparison.

Open items for the team: run the full protocol once (settle, calibration, baseline, stressor, recovery, three self-reports) and send the CSV; request StressID and UBFC-Phys access.

## v0.4 update (2026-10-04): supersedes any conflicting text below

Full code review. Everything below was found and fixed.

**Browser**
1. Boundary leakage: blink rate uses a 30 s history and heart rate about 16 s, but only the first 10 s after a phase change were excluded. Now `LOOKBACK_S`=30: `transition` is true unless the 30 s before the window lie inside the phase. New column `feature_start_s`. Each phase needs at least 90 s.
2. Hidden tabs throttle timers and frames. Any visibility change now invalidates the next 30 s.
3. Changing the phase during calibration let calibration windows count as baseline. `phaseStart` is clamped to the end of calibration.
4. Baseline statistics used every calibration window, bad ones included. Now only windows with quality above `MIN_Q`=0.3, and a feature with no baseline is announced on screen instead of silently dropped.
5. Rating boxes started at 5, so a quick click recorded a neutral label. They start blank and clear after saving.
6. Each row carries the participant's own baseline report (`baseline_raw_*`) for change-from-baseline targets.
Known and unchanged: at z=0 the heuristic bars read 33/33/33 by construction (equal logits); `*_quality` is face/pose presence or spectral peak share, not image quality.

**Trainer (rewritten; output file names changed, see README)**
1. Two baselines now sit in every table: constant and phase-mean. Labels are constant per phase, so beating "constant" can mean only "recognises the task". `phase_mean` is told the phase: matching it means recognising the task from body signals, going below it means explaining individual differences beyond the task.
2. One aggregation everywhere: per-participant scores averaged equally, intervals from resampling participants. The old tables mixed pooled and mean-of-folds numbers.
3. Row weights: each report and each participant counts equally (one report labels about 50 near-duplicate windows).
4. Fusion fits weights on the simplex plus one temperature. The old simplex-only fit could not calibrate, and the temperature helpers were never called. Missing modalities are dropped per row. The held-out participant never touches weights or temperature.
5. Regression targets for S/R/T and stress, absolute and as change from own baseline, against mean and zero-change baselines.
6. Optional phase-aware permutation test (`--permutations`), a regularisation sweep (reporting only), quality masking (`--min-quality`).
7. models.json now holds per-modality models, fusion weights and temperature. The portal does not read it yet.

**Harness check (synthetic data, tools/make_synthetic.py).** With no signal nothing beat the baselines and the permutation p was 0.95. With signal, the regression targets beat the mean baseline and p was 0.048 (20 permutations, the minimum possible). This shows the harness behaves, not that the science works. There is still no real participant data.

## Why there is no vision transformer yet (decision, 2026-10-04)
- Labels: each participant gives about 3 independent self-reports (one per phase), so 25 participants is roughly 75 labels. A ViT, video transformer or temporal transformer has 10^5 to 10^8 parameters and will memorise people.
- Privacy: image-level models need face frames, or embeddings that can re-identify. The consent text promises that no video is stored. On-device inference that stores nothing is possible but needs new consent wording and model downloads.
- Perception is already deep: MediaPipe's landmark and blendshape networks do the vision step. The trainable layer is deliberately tiny.

Order of experiments once real data exist. Each is one more arm in the same leave-one-participant-out tables.
1. Frozen pretrained encoder features with the same linear head, computed on-device.
2. A pretrained rPPG network (PhysFormer or EfficientPhys through rPPG-Toolbox) against POS. Judge it by heart-rate error against a pulse oximeter, not by the Guṇa target.
3. A temporal transformer or GRU over the per-second feature sequence, only with well over 100 participants or self-supervised pretraining on unlabelled sessions.
Accept an arm only if its interval against `phase_mean` excludes 0 and it beats the linear head.

Next: voice modality offline (priority 3), load models.json in the portal, EMA smoothing, real data collection.

## v0.3 update (2026-10-03): supersedes any conflicting text below

1. **Label timing (was Priority 1).** Self-reports are retrospective: the participant rates the last minute, saved at the END of a phase. Nothing is carried forward. At export, a window takes a report's label only if (a) it lies wholly inside the reported phase (`transition=false`), (b) its phase equals `report_phase`, and (c) it ends within `LABEL_SPAN_S`=60 s before `report_t_s`. The nearest later report wins. New columns: `window_end_s`, `phase_start_s`, `report_t_s`, `report_phase`, `label_window_start_s`, `label_window_end_s`, `label_lag_s`, `max_label_lag_s`. `self_report_age_s` is removed. Labels are assigned at export because a label needs a report that arrives after the window, so the live "eligible" indicator became a window-status message.
2. **Stress vs Guna state (was Priority 2).** `stress` (= 1 - p_sattva) is removed from the UI and CSV. An explicit 0-10 stress item was added (`raw_stress`, `stress_label`). The trainer evaluates it on its own (Ridge, LOPO) against a constant-mean baseline and writes `artifacts/stress_target_results.csv`.
3. **Protocol changed** (see STUDY_PROTOCOL.md). Calibration windows are never used for training because their z-scores are in-sample, so the `baseline` phase needs about 90 s after calibration before its self-report.
4. The trainer re-checks `0 <= label_lag_s <= max_label_lag_s`.

Not done yet: offline voice modality, learned-model browser inference, EMA smoothing, participant-level bootstrap intervals. The v0.3 browser code has not been run in a browser. The trainer was smoke-tested on synthetic data only, which says nothing about real performance. Priorities 1-2 below are done; continue at 3.

---

## 1. What this project is

This project is a multimodal machine-learning prototype for estimating a participant's self-reported Sattva/Rajas/Tamas state from behavioural and physiological signals.

The important scientific framing is:

> The model predicts a participant's **self-reported state**. It does not claim to objectively measure Sattva, Rajas, Tamas, stress, or any other latent physiological truth.

The project is designed around a small participant count (roughly 20–30 participants). Therefore, the trained part of the system is intentionally low-capacity and regularized rather than a deep neural network trained from scratch.

---

## 2. Current architecture

### Layer 1 — pretrained / signal-processing perception

The browser prototype currently uses:

- MediaPipe Face Landmarker for facial landmarks and blendshapes.
- MediaPipe Pose Landmarker for pose/upper-body features.
- POS-based remote photoplethysmography (rPPG) for an approximate heart-rate signal.
- An external voice-model hook is supported in the browser through `window.setVoice(...)`, but there is **not yet a complete offline trained voice pipeline** in `train_guna.py`.

### Layer 2 — small models trained from study data

The offline trainer contains:

- A soft-label multinomial/log-linear model for the compositional S/R/T target.
- Participant-level cross-validation.
- Modality-specific models.
- Nested multimodal fusion with non-negative weights constrained to sum to one.
- Independent Ridge regressors for the alternative three-dimensional target formulation.

### Layer 3 — analysis

The current analysis includes:

- Soft cross-entropy evaluation.
- Secondary balanced-accuracy evaluation using the largest self-report component as the hard class.
- Leave-one-participant-out (LOPO) evaluation.
- Nested fusion-weight learning.
- Modality ablation.
- Independent-target MAE/RMSE/Spearman analysis.
- Voice/visual agreement in the browser when a voice model supplies probabilities.

---

## 3. Files in this handoff

| File | Purpose |
|---|---|
| `index.html` | Browser data-collection / live inference UI |
| `app.js` | MediaPipe, rPPG, feature extraction, baseline normalization, heuristic live fusion, self-report logging, CSV export |
| `train_guna.py` | Offline model training, LOPO evaluation, nested fusion, independent-target analysis, modality ablation |
| `README.md` | Project usage and methodological notes |
| `DATA_SCHEMA.md` | Expected CSV fields and study-data structure |
| `STUDY_PROTOCOL.md` | Minimal participant data-collection protocol |
| `HANDOFF.md` | This document |
| `requirements.txt` | Python dependencies for the offline trainer |

No participant data is included in this final package.

---

## 4. Browser prototype — updates implemented

### Participant/session identity

The UI now collects:

- `participant_id`
- `session_id`

Use opaque IDs such as `P001` and `S01`; do not put names in the CSV.

### Signal consent / selection

The participant can select the available signal categories before starting:

- Face
- Pulse / rPPG
- Pose

The existing consent checkbox remains required.

### 60-second participant-specific baseline

The browser collects a 60-second baseline and computes per-participant feature statistics.

During the live phase, features are converted to clipped baseline z-scores. The training CSV therefore contains `z_<feature>` columns when sufficient baseline data exists.

The baseline is participant-specific, which reduces dependence on absolute camera geometry and individual differences.

### 10-second rolling feature window

The live features are computed over approximately 10-second rolling windows.

This matters for labels because a phase transition can contaminate the first rolling windows after a transition.

### Phase tracking

The UI exposes:

- `baseline`
- `stressor`
- `recovery`

Phase changes are exported in the CSV.

### Self-report controls

At phase boundaries, the participant can rate:

- Sattva: calm / clear / steady, 0–10
- Rajas: restless / agitated, 0–10
- Tamas: dull / sluggish, 0–10

The raw ratings are exported as:

- `raw_sattva`
- `raw_rajas`
- `raw_tamas`

and the simplex-normalized values are exported as:

- `sattva_label`
- `rajas_label`
- `tamas_label`

Example:

`S=8, R=2, T=1` → `[0.727, 0.182, 0.091]`.

This normalization is a modelling choice, not a claim that the three Guṇas objectively form a compositional physiological state.

### Training eligibility

Rows are marked using:

- `eligible_for_training`
- `transition`

The first 10 seconds after a phase change are excluded because the rolling 10-second feature window can contain measurements from both phases.

Rows without a self-report are also ineligible.

### Self-report age

Each exported labelled row includes:

- `self_report_age_s`

This records how far the row is from the most recent saved self-report and is useful for later label-timing analysis.

### CSV export

The exported file contains participant/session identifiers, phase metadata, raw features, z-normalized features, model probabilities, self-report labels, quality values, and agreement where available.

The export filename follows the participant/session identifiers.

### Voice hook

The browser supports an external voice model through:

`window.setVoice({sattva, rajas, tamas}, quality)`

The latest voice output is incorporated into the live fusion if it is recent enough.

This is an integration hook, **not** an offline voice-training pipeline. Do not describe voice as a trained modality in the current final implementation.

### Privacy model

The current browser pipeline processes the camera locally and exports derived features rather than raw video. The project should continue to avoid exporting raw video/audio unless the study protocol explicitly requires it and consent covers it.

---

## 5. Live browser inference — current status

The live browser prediction is still **heuristic**.

The code contains:

- `MAP` — hypothesis-derived cue-to-Guṇa weights.
- `W_MOD` — prior modality weights.
- Per-modality softmax-style mapping.
- Quality-weighted linear fusion.

These are priors / prototype inference rules. They are **not learned from participant data** yet.

Do not present the live bars as validated or trained model outputs.

The next production step is to replace the heuristic `MAP`/`W_MOD` inference with parameters generated by `train_guna.py` after real study data exists.

---

## 6. Important correction regarding “stress”

The current browser code still exports a field called `stress` using:

`1 - p_sattva`

This should **not** be interpreted as a validated stress measurement.

For future work, separate the concepts:

1. Guṇa-state prediction.
2. Self-reported stress prediction.

If stress is required, collect an explicit stress target (for example a clearly defined 0–10 self-report or a validated questionnaire score) and train/evaluate it as its own target.

Do not claim that low Sattva probability equals physiological stress.

---

## 7. Offline training pipeline — implemented updates

### Dataset loading

`train_guna.py`:

- Loads a CSV.
- Requires `participant_id`, `session_id`, and `phase`.
- Filters to `eligible_for_training` rows when the field exists.
- Prefers browser-exported `z_<feature>` columns.
- Falls back to raw feature columns when necessary.
- Requires S/R/T labels.
- Accepts either simplex-like labels or 0–10 self-report scores.
- Normalizes 0–10 scores row-wise when appropriate.

Current core feature set:

```text
blink
perclos
brow
lip
gaze
headMove
hr
shrug
sway
fidget
```

### Soft-label compositional model

The main model directly optimizes soft cross-entropy against the three-component target vector.

This avoids reducing a participant's S/R/T ratings to a single hard class during training.

The implementation uses a low-capacity multinomial log-linear model with L2-style regularization.

### Participant-level validation

The main evaluation uses `LeaveOneGroupOut`, with `participant_id` as the group.

This is essential because adjacent windows from the same participant are correlated.

Never replace this with a random window split for the scientific evaluation.

### Primary metric

The primary probability metric is soft cross-entropy.

Balanced accuracy is secondary and is calculated after converting the target vector to its largest component.

This distinction is intentional: the actual target is soft rather than a clean mutually exclusive ground-truth class.

### Nested multimodal fusion

Fusion is evaluated with an outer and inner participant split:

1. Hold one participant out completely.
2. Generate inner participant-level out-of-fold predictions using only the outer training participants.
3. Fit fusion weights on those inner predictions.
4. Refit each modality model on all outer training participants.
5. Predict the held-out participant.
6. Aggregate outer-fold predictions.

Fusion weights are constrained to be non-negative and sum to one.

The held-out participant is therefore not used to tune the fusion weights.

### Independent-target experiment

The pipeline also tests an alternative hypothesis:

> Sattva, Rajas and Tamas may be better treated as three separate continuous self-report dimensions rather than a simplex.

For this experiment, the trainer uses separate regularized Ridge regressors.

Reported metrics include:

- MAE
- RMSE
- mean Spearman correlation
- Sattva MAE
- Rajas MAE
- Tamas MAE

The independent outputs may be normalized for visualization later, but the regressors are not trained on the normalized simplex target.

### Modality ablation

The current ablation evaluates:

- `face_only`
- `rppg_only`
- `pose_only`
- `face_pose`
- `visual_fusion`

Multi-modality ablation rows use equal-weight fusion so that the ablation does not tune fusion weights on the held-out participant.

Learned nested fusion is evaluated separately.

---

## 8. Synthetic smoke test already performed

A synthetic dataset was used only to verify that the pipeline executes correctly.

The test produced 270 training-eligible windows from 6 synthetic participants.

The observed synthetic metrics were approximately:

- Compositional LOPO balanced accuracy: 0.489
- Compositional soft cross-entropy: 1.019
- Independent-target MAE: 0.030
- Independent-target RMSE: 0.038
- Nested fusion balanced accuracy: 0.339
- Nested fusion soft cross-entropy: 1.056

These numbers are **not scientific performance results**. The labels/features were synthetic and were used only as an implementation smoke test.

Do not report these numbers as project results.

---

## 9. Data collection protocol currently intended

Recommended initial study size:

- approximately 20–30 participants

Basic session structure:

1. Obtain consent.
2. Use an opaque participant ID.
3. Select permitted signals.
4. Run 60-second quiet baseline.
5. Save baseline self-report.
6. Run a predefined stressor.
7. Set phase to `stressor` and save self-report.
8. Run recovery.
9. Set phase to `recovery` and save self-report.
10. Stop and export.

The exact stressor must be fixed and documented before collection so task effects can be analysed separately from self-reported state.

---

## 10. Current data-schema caveat: label timing

The current browser implementation associates the most recent self-report with subsequent windows and records `self_report_age_s`.

This is an improvement over having no label timing metadata, but it is not yet the final experimental design.

For the next iteration, explicitly record:

- `report_t_s`
- `report_phase`
- `label_window_start_s`
- `label_window_end_s`
- maximum allowed report-to-window lag

A better training rule should associate a feature window with a self-report only when its timing relationship is explicitly allowed by the study design.

Avoid silently applying a phase-end rating to an arbitrarily long sequence of later windows.

---

## 11. What is NOT implemented yet

The following are planned but should not be claimed as complete:

### A. Full offline voice modality

Need to define a stable voice CSV schema and either:

- train a small voice scorer from extracted voice features, or
- treat an externally trained/calibrated voice model as a fixed modality and evaluate it separately.

Suggested future exported columns include:

```text
voice_sattva
voice_rajas
voice_tamas
voice_quality
```

If raw acoustic features are collected, document exactly how they were extracted.

### B. True stress target

Add a separate explicit self-reported stress target if stress prediction is a project objective.

Do not reuse `1 - p_sattva` as the target.

### C. Final label-timing implementation

Replace the current “latest label carried forward” behaviour with explicit report timestamps and a predefined allowable labelling interval.

### D. Learned-model browser inference

Once real data is available:

1. Run the offline trainer.
2. Export learned parameters.
3. Load those parameters into the browser.
4. Replace the heuristic mapping with learned inference.
5. Preserve the same feature definitions and baseline normalization.

### E. Temporal model

A temporal smoothing layer is planned. Suitable low-capacity options include:

- EMA as the simplest baseline.
- Kalman filter for continuous state trajectories.
- HMM if there is enough data to justify discrete latent states.

This should be evaluated only after establishing the unsmoothed baseline.

### F. Calibration

If probability calibration is needed, use a low-capacity approach and fit it only on data independent of the model-fitting data. A temperature-scaling helper already exists in the trainer, but it is not currently part of the main final evaluation pipeline.

---

## 12. Recommended next development order for Claude

Do not start by adding a large neural network.

### Priority 1 — fix target timing

Make report timestamps first-class and prevent long-range label carry-forward.

### Priority 2 — separate stress from Guṇa state

Remove the conceptual use of `1 - p_sattva` as stress. If stress is desired, add an explicit target.

### Priority 3 — voice modality

Define the offline voice schema and implement first-class evaluation with missing-modality handling.

### Priority 4 — learned browser inference

Create a stable model-artifact format and load learned parameters into the browser.

### Priority 5 — temporal modelling

Add EMA first; compare against more complex temporal models only if justified.

### Priority 6 — stronger evaluation

After real data collection, report:

- participant count
- eligible window count
- per-participant fold results
- soft cross-entropy
- balanced accuracy
- per-class recall
- confusion matrix
- calibration
- modality ablations
- fusion weights across folds
- independent-target results
- baseline model results
- confidence intervals or bootstrap intervals at the participant level where appropriate

---

## 13. Scientific rules that must not be broken

1. **Participant-level splitting only.** Never random-split correlated windows.
2. **No leakage from baseline.** Baseline statistics must come only from that participant's allowed baseline period.
3. **No test-fold fusion tuning.** Fusion weights must be learned inside the training participants.
4. **No claim of objective Guṇa measurement.** The supervised target is self-report.
5. **Do not equate stress with low Sattva.** They are separate constructs in the ML design.
6. **Do not report synthetic smoke-test metrics as real performance.**
7. **Do not describe the browser heuristic bars as trained/validated until real-data training artifacts are loaded.**
8. **Document the exact stressor and collection conditions.**
9. **Keep raw video/audio handling consistent with consent and the study protocol.**
10. **Use the simplest model that is justified by the sample size.**

---

## 14. Running the browser app

From the project directory:

```bash
python3 -m http.server 8000
```

Then open the localhost address shown by the server.

The MediaPipe model files are loaded from the configured CDN URLs, so an internet connection is currently required for the browser prototype unless those model assets are later vendored locally.

---

## 15. Running the offline trainer

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The current trainer expects the input dataset at:

```text
data/sessions.csv
```

Run:

```bash
python train_guna.py
```

Expected output directory:

```text
artifacts/
```

with files such as:

```text
models.json
fusion_cv_results.csv
ablation_results.csv
independent_target_results.csv
```

Actual output availability depends on whether the corresponding raw self-report columns exist in the dataset.

---

## 16. Current project limitation: no real participant data

At handoff time there is no real participant dataset included.

Therefore:

- no final trained model exists;
- no real-world performance claim can be made;
- no learned browser inference artifact should be expected;
- the current model/evaluation code is ready for real data but still needs a properly collected dataset.

This is intentional: the code has been prepared so that data collection can happen before committing to a high-capacity model.

---

## 17. External technical references checked during this handoff

The implementation choices around regularized multinomial logistic modelling, probability/log-loss evaluation, and Ridge regression are consistent with the current scikit-learn documentation:

- https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html
- https://scikit-learn.org/stable/modules/generated/sklearn.metrics.log_loss.html
- https://scikit-learn.org/stable/modules/linear_model.html

These references support the use of regularized logistic models, probability-based log loss, and L2-regularized Ridge regression; they do not validate the Guṇa scientific construct itself.

---

## 18. Handoff instruction to Claude

Treat this file as the current project-state specification.

Before making substantial changes:

1. Read `HANDOFF.md`.
2. Read `README.md`.
3. Read `DATA_SCHEMA.md`.
4. Read `STUDY_PROTOCOL.md`.
5. Inspect `index.html`, `app.js`, and `train_guna.py` rather than assuming the code matches an earlier conversation version.
6. Preserve participant-level evaluation and the scientific caveats above.
7. When modifying code, update this handoff and the relevant schema/protocol documentation.
8. Run a syntax check and a synthetic smoke test after substantive trainer changes.
9. Do not invent real-data results.

**Current authoritative code files:** `index.html`, `app.js`, `train_guna.py`.
