# Guṇa Multimodal ML Project — Claude Handoff

**Project version:** v0.8.5 (3-ROI consensus rPPG, LOPO-gated fitted stress tension, 7-AU posed/directional audits, and intermittent dropout fusion)  
**Date:** 2026-11-14  
**Purpose:** This document is the source-of-truth handoff for continuing development in Claude.

---

## 2026-11-14: v0.8.5 release cleanup & README sync

**What changed**
- Stripped 33+ MB of local third-party patent/paper PDFs (`docs/prior_art_and_patents/`), generated binary PDFs (`docs/*.pdf`), and internal authoring/planning notes (`docs/CLAUDE_PDF_PROMPT.md`, `docs/MACOS_APPLE_HEALTH_UI_GUIDE.md`) from unpushed branch history and gitignored them in `.gitignore` (files remain intact locally).
- Removed relative `prior_art_and_patents/` file links in `docs/PATENT_PRIOR_ART_BENCHMARK_REPORT.md` so all public GitHub links remain valid.
- Aligned version metadata to `v0.8.5` across `VERSION.txt`, `package.json`, `launcher/package_macos.py`, `HANDOFF.md`, and `README.md` (updated test badge and coverage highlights to 49/49 passing tests).

**Tested**: `npm run check`, `npm test` (49/49 pass: 25 `hr` + 24 `ui`), `python3 -m py_compile` across `train_guna.py` and `tools/*.py`.

**NOT tested**: Real-face multi-participant sessions (`N >= 20`), real OpenFace/LibreFace AU correlation, and live webcam multi-ROI/motion stress runs.

---

## 2026-11-13: 8-patent prior-art benchmarking (`US 10,628,741 B2`), dropout test & session audit fix

**What changed**
- `tools/audit_features.py`: fixed `direction()` session grouping when `participant_id` and `session_id` both exist with multiple participants (`participant_id + "_" + session_id`), preventing multi-participant `session_id = "S01"` collisions from collapsing cohorts into 1 session.
- `tests/ui.test.mjs`: added explicit intermittent channel dropout benchmark test (`multimodal late fusion survives intermittent channel dropout (US 10,628,741 Claims 9-10 benchmark)`) covering progressive modality loss (`face+rppg+pose` -> `face+pose` -> `face` -> `null` abstention) and feature-level `modP` missing-value imputation.
- `docs/PATENT_PRIOR_ART_BENCHMARK_REPORT.md` & `docs/Tempo_Patent_Prior_Art_Benchmark_Report.html` (+ `.pdf`): updated to `v0.8.5-dev` covering all 8 patents in `docs/prior_art_and_patents/` (adding `US 10,628,741 B2` *Multimodal machine learning for emotion metrics*) + 4 papers (`Wang 2017`, `Norden 2022`, `LibreFace 2023`, `StressID 2023`) and exact Section 9 benchmark tables; stripped raw `$...$` LaTeX tokens for clean PDF rendering.
- `docs/TEMPO_EXACT_ARCHITECTURE_SPECIFICATION.html` (+ `docs/Tempo_Exact_Architecture_and_Prior_Art.pdf`): bumped to `v0.8.5-dev`, updated Stage 2 rPPG (`fuseRois`, `motionBlocks`, MAD-ectopy RMSSD) and `stress_tension` LOPO gating (`N >= 20`, `vs_phase < 0`), added `US 10,628,741` / `US 10,034,611` / `US 2024/0164672` / `LibreFace` taxonomy entries, and converted all raw `$...$`/`\text{...}` TeX strings to clean HTML/Unicode math.

**Tested**: `npm run check`, `npm test` (49/49 pass: 25 `hr` + 24 `ui`), `py_compile`, synthetic 20-participant `tools/audit_features.py` direction audit (`20` sessions, `60` phase points, `10/11` concordant), Headless Chrome PDF renders (2-page benchmark report + 4-page architecture spec, zero raw LaTeX).

**NOT tested**: Real-face human sessions (`N >= 20` real participant stress cohorts), real OpenFace/LibreFace AU correlation, and live webcam multi-ROI/motion stress testing.

---

## 2026-11-13: v0.8.5-dev hardening & audit unification

**What changed**
- `hr.js`: removed dead `* 0` term in `isSkin`; relaxed `resample` to keep any >= 2 of 3 sub-ROI slots with >= 80% coverage (falling back to frame mean on isolated dropped frames); inspected trailing partial `< 1 s` blocks (`tailFlag`) in `motionBlocks`/`analyze`; updated tracker `refStd` and reset `dirty = 0` whenever `!A.motion` (not only `flagged === 0`).
- `app.js`: relaxed sub-ROI skin threshold (`ns >= 8`, >= 2 valid sub-ROIs); extracted shared `attenuateDownLook` helper across `tensionOf` and `liveTick`; hardened `tensionOf` against missing/non-finite `z` (`!z`, `Number.isFinite`). Synced `launcher/site/app.js` and `launcher/site/hr.js`.
- `train_guna.py`: filtered all-NaN face rows (`has_face`) and guarded zero `sc.scale_` in `fit_stress_tension`.
- `tools/audit_features.py` & `tools/audit_posed_expressions.py`: expanded `POSED_TARGET` to all 7 FACS AUs (`eye_wide`, `lip_depress`), added phase-tagged `--posed` auto-detection without external labels CSV, and delegated `audit_posed_expressions.py` to `posed_audit` with `AU_MAPPING` annotations and un-baselined phase-summary fallback.
- `.github/workflows/ci.yml`: added `tools/audit_features.py data/sessions.csv` to the synthetic CI smoke job.
- `tests/hr.test.mjs`, `tests/ui.test.mjs`: added unit tests for 2-of-3 occluded/dropped-frame sub-ROI fusion and `null`/`NaN`-safe `tensionOf`.

**Tested**: `npm run check`, `npm test` (48/48 pass: 25 `hr` + 23 `ui`), `py_compile` across Python tools, synthetic `train_guna.py` + `tools/audit_features.py` smoke (`N=20`, `vs_phase=-0.016`), and synthetic `--posed` / `--au` / un-baselined fallback runs on `tools/audit_features.py` and `tools/audit_posed_expressions.py`.

**NOT tested**: Real-face rPPG sessions (`MOT_K`/`MOT_RANGE`/`ROI_MIN_CORR`), real `>= 20` participant `stress_tension` fitting, and real OpenFace/LibreFace AU correlation.

---

## 2026-11-12: v0.8.5-dev: motion-protected rPPG, sub-ROI fusion, fitted tension loader, audit upgrade

**What changed**
- hr.js: 1 s block motion detector (detrended relative green spread with exposure-step suppression, plus optional
  raw-landmark excursion hint `mx/my` from app.js). The longest clean >= 8 s stretch is analysed; with no clean
  stretch the tracker abstains and freezes (no EMA drag, no re-acquisition), with lock memory extended up to 15 s.
  Targets the S09 t=40-54 s drag from 68 to 51.5 bpm.
- hr.js: sub-ROI consensus fusion (forehead / cheeks) when app.js supplies per-ROI means; log-parabolic peak
  refinement; RMSSD median-MAD ectopy rejection, with successive differences only between adjacent accepted beats (bug fix).
- app.js: per-ROI skin means and forehead position pushed with each RGB sample; overlay boxes aligned with sampled ROIs.
- app.js: tensionOf uses fitted stress_delta weights from models.json only when N >= 20 and vs_phase < 0, else the priors; new export column `tension_source`.
- train_guna.py: exports `stress_tension` (face-only ridge, LOPO-validated with the same model) into models.json.
- tools/audit_features.py: direction audit (phase concordance, sign test, report-level Spearman with stress_delta)
  and `--posed` AU audit (response matrix, leakage, selectivity, OpenFace rank correlation).
- DATA_SCHEMA.md: documented `tension_source` column and fitted tension index behaviour.

**Tested**: npm test (47) and the synthetic audit/trainer smoke, all on synthetic data only. Real counts: 47 pass (24 hr + 23 ui).

**NOT tested**
- MOT_K / MOT_RANGE / ROI_MIN_CORR on real faces. Check that rPPG coverage does not drop on S07-S09-style sessions.
- Fitted tension on real data: fewer than 20 participants exist, so the portal still runs on priors.
- Posed audit against real OpenFace/LibreFace output.

**Next**: record S10 with deliberate 10 s nods and a smile block; run the audit; tune the motion constants from data.

---

## v0.8.4 update (2026-11-12): anti-hopping Gaussian tracking affinity, post-exercise panting lock protection, and autonomic recovery smoothing (Issue #1)

Diagnosis (from user live webcam session export `P001_S09_session.csv`):
- Routine performed: initial seated baseline, radio calisthenics, seated post-exercise rest & recovery.
- Verified progress from v0.8.3:
  - Gap-aware resampling and motion-tail trimming eliminated the long seated return dropout: hits were detected significantly more frequently throughout the session.
  - Pulse signal was successfully captured during both calm baseline and post-calisthenics elevation.
- Root causes of erratic 65–80 bpm jumping and slow recovery onset in `S09`:
  1. **Peak hopping in tracking mode (unpenalized raw power sorting):**
     In `createTracker()`, candidates within `GATE_BPM = 18` bpm were sorted strictly by raw power `b.s - a.s` without penalizing distance from `hr`. At $t=220\text{--}247\text{s}$, when true heart rate was around $78\text{--}80\text{ bpm}$, a competing respiratory/motion spectral peak at $65\text{ bpm}$ sat at distance $d = 13\text{ bpm} \le 18\text{ bpm}$. Whenever the $65\text{ bpm}$ peak gained even 2% higher power in a window, it stole the tracker. Combined with EMA alpha $= 0.40$, the tracker swung wildly ($78 \to 67 \to 84 \to 60\text{ bpm}$) instead of smoothly tracking true cardiovascular deceleration.
  2. **Cold-start false lock on post-calisthenics panting ($52\text{ bpm}$):**
     At $t=181.7\text{s}$ (sitting down with heavy post-calisthenics breathing, `headMove = 0.261`), rhythmic thoracic panting produced a strong sinusoidal wave at $0.86\text{ Hz}$ ($52.16\text{ bpm}$, $q = 0.488$). Because cold-start previously allowed single-window locking if $q \ge 0.30$ and SQI $\ge 0.24$, it immediately locked onto $52\text{ bpm}$! The subsequent tracking gate $[34, 70]\text{ bpm}$ locked out the user's actual $\sim 80\text{ bpm}$ pulse for nearly 20 seconds while it slowly dragged upward.
  3. **Overly sensitive $f/2$ subharmonic candidate injection:**
     Candidate halving admitted $f/2$ peaks at $pw(h) \ge 0.15 \cdot c.p$, artificially synthesizing $50\text{ bpm}$ candidates whenever $100\text{ bpm}$ had minor power.

Changed
1. `hr.js`:
   - **Gaussian distance-weighted tracking affinity (`createTracker`):**
     Replaced raw power candidate sorting with Gaussian distance-weighted affinity:
     `scoreTrack = c => c.s * Math.exp(-0.5 * ((Math.abs(c.bpm - hr) / 7.5) ** 2)) * (1 + 0.25 * c.corr)`
     Distant candidates ($d \ge 12\text{ bpm}$) receive $\le 0.28\times$ weight, preventing random single-window power fluctuations from hijacking the tracked trajectory. Transitions to genuinely new heart rates require multi-window consensus via the `alt` tracker.
   - **Low-frequency cold-start lock protection:**
     Candidates below $58\text{ bpm}$ ($< 0.97\text{ Hz}$) must confirm across $n \ge 2$ consecutive consistent windows (or exhibit exceptional standalone prominence $\ge 2.2$, correlation $\ge 0.35$, $q \ge 0.40$) before cold start can lock. This prevents transient post-exercise panting or head bobbing from capturing the initial estimate.
   - **Tightened $f/2$ subharmonic generation (`analyze`):**
     Raised subharmonic injection threshold to $pw(h) \ge 0.22 \cdot c.p$ with minimum lag correlation $r \ge 0.12$.
   - **Physiological autonomic recovery smoothing:**
     Replaced fixed alpha $= 0.40$ with an adaptive smoother (alpha $= 0.25$ for steady changes $\le 4\text{ bpm}$, $0.35$ for dynamic changes), producing smooth, natural cardiovascular recovery deceleration without erratic second-to-second jumps.
2. `launcher/site/`:
   - Synced updated `app.js` and `hr.js` to `launcher/site/`.
3. Benchmark outcomes & unit tests (`node --test tests/ui.test.mjs tests/hr.test.mjs`):
   - All 43 tests pass (added 2 new regression tests: `distance-weighted tracking prevents mode hopping between competing peaks` and `cold start protects against false single-window lock on low-frequency panting (<58 bpm)`):
     - `clean60`: 100% valid, MAE 0.3 bpm, maxErr 0.9 bpm.
     - `fast120`: 100% valid, MAE 0.0 bpm, maxErr 0.3 bpm.
     - `slow45`: 98% valid, MAE 0.2 bpm, maxErr 0.6 bpm.
     - `weakPulseRedNoise`: 22% valid, MAE 1.4 bpm, maxErr 2.5 bpm (improved from 2.1 bpm).
     - `harmonicDominant`: 100% valid, MAE 0.0 bpm, maxErr 0.1 bpm (improved from 0.5 bpm).
     - `motionBurst`: 100% valid, MAE 0.8 bpm, maxErr 4.9 bpm (improved from 6.0 bpm).
     - `ramp60to90`: 100% valid, MAE 1.6 bpm, maxErr 4.0 bpm.
     - `step60to100`: 100% valid, MAE 0.2 bpm, maxErr 0.4 bpm.
     - `slowArtefact`: 71% valid, MAE 1.0 bpm, maxErr 7.4 bpm (improved from 7.8 bpm).
     - `noiseOnly`: 0% valid (100% noise rejection).
     - `redNoiseOnly`: 21% valid, MAE 2.0 bpm, maxErr 3.5 bpm (improved from 5.5 bpm).
     - `warmLightNoisyBlue`: 90% valid, MAE 2.3 bpm, maxErr 7.9 bpm (improved from 8.6 bpm).
     - `autoExposureStep`: 100% valid, MAE 0.3 bpm, maxErr 0.8 bpm (improved from 3.8 bpm).
     - `webcam20fpsRsa`: 84% valid, MAE 2.8 bpm, maxErr 6.4 bpm (improved from 11.2 bpm).

Checked: `npm run check`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (43 tests pass).  
Not checked: live webcam session on v0.8.4.

---

## v0.8.3 update (2026-11-12): webcam rPPG continuity across bimodal spectra, posture shifts, and post-exercise recovery (Issue #1)

Diagnosis (from user live webcam export `P001_S08_session.csv` with radio calisthenics & guided breathing recovery):
- Physiological tracking verified in `S08`:
  - Immediate settle lock at $t=10.3\text{--}17.4\text{s}$ ($64.4\text{--}67.4\text{ bpm}$) and resting baseline at $61\text{--}65\text{ bpm}$.
  - Participant left the chair at $t=155\text{--}165\text{s}$ (`face_quality` blank) to perform radio calisthenics and sat back down at $t=166.5\text{s}$. Once the motion buffer cleared, the tracker captured the elevated post-exercise heart rate ($72.1 \to 76.4 \to 78.7 \to 84.3 \to 81.7\text{ bpm}$ at $t=188.9\text{--}201.2\text{s}$).
  - During Recovery with Guided Breathing (`breathe_active = 1`, $t=213\text{--}262\text{s}$), tracked the parasympathetic deceleration curve from $79.3 \to 75.9 \to 74.3 \to 72.7 \to 71.2 \to 70.6 \to 67.8 \to 66.0 \to 64.9\text{ bpm}$.
- Root causes of remaining dropouts in `S08`:
  1. **Bimodal spectrum hold penalty:** At $t=84.8\text{--}85.8\text{s}$ (stationary head, `headMove = 0.033`, `rppg_quality = 0.334`), `hr` briefly dropped to `NaN` between $65.16\text{ bpm}$ and $64.77\text{ bpm}$. When a secondary peak (2nd harmonic at $2f$ or respiratory/Mayer wave during guided breathing) coexists with the cardiac fundamental, global `prom = best.s / secondS` drops below `1.65` (raising `qHold` to `0.26`) while the secondary peak's power inflates the SNR denominator `band - sig` of the fundamental peak near `hr`.
  2. **Missing-face gap interpolation & post-movement tail poisoning:** After returning to the chair at $t=166.5\text{s}$ and settling at $t=175\text{s}$, lock waited until $t=188.9\text{s}$ because `resample()` linearly interpolated across missing-face timestamp gaps ($> 650\text{ ms}$) and `analyze()` processed all 12 s including the earliest 3.5 s of sitting-down motion transients even after the latest 8.5 s were clean.
  3. **Forehead ROI brow-crease sensitivity:** During downward gaze and brow lowering ($t=96\text{--}118\text{s}$, `browLower` $z = +3.0$), glabella skin folding perturbed the wide forehead crop box.

Changed
1. `hr.js`:
   - **Gap-aware resampling (`resample`):** Detects frame timestamp discontinuities $> 650\text{ ms}$ (e.g., stepping away from the camera) and slices to the contiguous post-gap segment instead of linearly interpolating across missing-face intervals.
   - **Post-movement tail trimming (`analyze`):** When a $\ge 9.5\text{ s}$ resampled window has leading green-channel standard deviation $> 2.2\times$ that of the most recent $8.5\text{ s}$ suffix, trims the noisy leading motion tail so stationary recovery locks ~3.5 s earlier after sitting down.
   - **Candidate-centric hold gating (`createTracker` & `analyze`):** Retains up to 6 spectral candidates, lowers sub-harmonic $f/2$ inclusion from `0.25 * c.p` to `0.15 * c.p`, extends `tracking` persistence from `15 s` to `20 s`, and evaluates `qHold` per candidate based on proximity to `hr` (`d <= 8 bpm` with periodic autocorrelation holds down to `q = 0.15`; within `GATE_BPM` holds down to `q = 0.18`).
2. `app.js`:
   - Refined constant ROI box geometry in `frame()` (`forehead: 0.12 x 0.045 fw`, `cheeks: 0.08 x 0.075 fw`) to weight the vascular malar cheek pads higher while keeping the forehead patch clear of glabella brow creases.
3. Benchmark outcomes (`node --test tests/hr.test.mjs`):
   - `warmLightNoisyBlue`: 79% -> **90%** valid (MAE 2.7 bpm).
   - `webcam20fpsRsa`: 69% -> **86%** valid (MAE 3.0 bpm).
   - `slowArtefact`: 59% -> **71%** valid (MAE 1.1 bpm).
   - `motionBurst`: **100%** valid (MAE 0.8 bpm).
   - `step60to100`: **100%** valid (MAE 0.2 bpm).
   - `noiseOnly`: **0%** valid (0 false positives).
   - `redNoiseOnly`: **22%** valid (below 25% ceiling).
   - Added unit test for gap-aware resampling + leading motion-tail trimming (`41 / 41` total tests pass).

Checked: `npm run check`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (41 tests pass).  
Not checked: live webcam session on v0.8.3.

---

## v0.8.2 update (2026-11-12): webcam rPPG hit sparsity resolution (candidate-specific autocorrelation gating, 12 s windowing, and accelerated recovery) (Issue #1)

Diagnosis (from user session export `P001_S07_session.csv`):
- Audited 215 post-settle rows under clean lighting (`skin_luma ~ 162`, `skin_rg ~ 1.31`).
- Settle (0–20s): blank by design.
- Calibration (20–80s): First lock at 52.2s (66.6 bpm), tracked for 12 continuous windows until a head movement (`headMove` = 0.36) broke lock. Dropout for remainder of calibration because cold-start consensus required 3 consecutive windows of `sqi >= 0.34`, unreachable under standard webcam optical SNR (~ -3.5 to -2 dB).
- Baseline (80–174s): 21 hits (23.1%). 12s blackout between 122s and 134s despite stationary head (`headMove` = 0.034) because `q` dipped to 0.22–0.27 and `qHold` fell back to `Q_MIN = 0.30`.
- Stressor (174–250s): Solid 52.7% hit rate (39 hits) with 25+ continuous seconds during Stroop due to sympathetic cardiac amplitude elevation.
- Recovery (250–300s): Dropped to 6% (3 hits) as heart rate decelerated and alternative peak re-acquisition was throttled by 6-window consistency count.
- Root causes:
  1. `app.js` passed an unbounded `rgb` buffer of up to 16 s into `tracker.update()`. Over 16 s, Respiratory Sinus Arrhythmia (RSA) smears Fourier energy over 10–15 bpm and old motion artifacts linger at the center of the Hann window.
  2. Cold start relied solely on global autocorrelation SQI across all lags; in real webcam video, global SQI hovers around 0.22–0.26, failing the 0.28 / 0.34 thresholds.
  3. Strict `GATE_BPM = 15` and 6-window alternative lock delay caused extended blackouts during natural cardiovascular acceleration and recovery.

Changed
1. `hr.js`:
   - Added candidate-specific period autocorrelation: for each spectral candidate peak, evaluates $r(\tau)$ at the exact cardiac lag $\tau = \text{round}(FS / f)$ (and $\tau \pm 1$). True capillary pulsations exhibit strong positive correlation ($r \ge 0.25\text{--}0.95$) at their fundamental period, whereas spurious noise peaks have near-zero correlation ($r \le 0.12$).
   - Cold start consensus (`createTracker`):
     - Single-window lock: accepts $q \ge 0.30$ when $sqi \ge 0.24$ OR when candidate period correlation $corr \ge 0.24$ with spectral prominence $\ge 1.7$.
     - Consensus lock: accepts $q \ge 0.22$ with prominence $\ge 1.75$ and either 2 consecutive windows ($corr \ge 0.30$) or 3 consecutive windows ($sqi \ge 0.25$).
   - Tracking hold (`qHold`): widened hold gate (`GATE_BPM` 15 -> 18 bpm) and permits holding track through momentary noise dips down to $q = 0.19$ when the tracked candidate maintains local periodicity ($corr \ge 0.20$ or $sqi \ge 0.24$) and prominence ($\ge 1.65$).
   - Alternate track switch: accelerated re-acquisition from 6 windows down to 4 consistent windows (or 3 windows if $q \ge 0.32$ and $corr \ge 0.28$).
2. `app.js`:
   - In `feats()`: sliced `rgb` to a clean 12 s window (`winRgb = rgb.filter(o => o.t > now - 12e3 && o.t <= now)`) before passing to `tracker.update()`, matching the evaluated window in unit tests and preventing RSA spectral smearing.
   - In `frame()`: trimmed rolling skin color buffer retention from 16 s to 14 s.
3. Benchmark outcomes (`node --test tests/hr.test.mjs`):
   - `warmLightNoisyBlue`: 71% -> 79% valid (MAE 2.7 bpm).
   - `webcam20fpsRsa`: 64% -> 69% valid (MAE 2.7 bpm).
   - `slowArtefact`: 57% -> 59% valid (MAE 1.0 bpm).
   - `motionBurst`: 100% valid (MAE 1.0 bpm).
   - `step60to100`: 100% valid (MAE 0.2 bpm).
   - `noiseOnly`: 0% valid (0 false positives).
   - `redNoiseOnly`: 14% valid (well below 25% ceiling).
   - 40 / 40 total tests pass (22 in `ui.test.mjs`, 18 in `hr.test.mjs`).

Checked: `npm run check`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (40 tests pass); `python3 tools/evaluate_rppg.py`.  
Not checked: multi-participant live webcam trial with simultaneous physical pulse oximeter grounding.

---

## v0.8.1 update (2026-11-12): webcam rPPG pulse upgrade (Kalman ROI stabilization, covariance-regularized POS, adaptive warm-light chrominance, autocorrelation SQI) and open-rppg evaluator (Issue #1)

Changed
1. `hr.js`:
   - `createRoiStabilizer(q, r, deadband)`: ported 1D Kalman filter + 1.2% deadband hysteresis from `open-rppg` (`rppg/main.py`) so sub-pixel MediaPipe landmark jitter on stationary faces does not shift integer ROI crop boxes frame-to-frame (eliminating spatial skin-gradient switching noise).
   - `despike(x)` & `posClean(R, G, B)`:
     - Clips sudden auto-exposure and screen-brightness step jumps via 5x MAD first-difference thresholding.
     - Pre-lowpasses RGB channels at `3.5 Hz` before computing POS projection weights so high-frequency CMOS sensor noise does not bias $\alpha = \sigma(S_1)/\sigma(S_2)$.
     - Regularizes local 1.6 s $\alpha$ with buffer-wide low-frequency covariance ($\alpha_{\text{global}} = -\text{cov}(S_1, S_2)/\text{var}(S_2)$) to prevent window-to-window $\alpha(t)$ fluctuations from cross-modulating slow breathing/red noise ($0.1\text{--}0.6\text{ Hz}$) into the cardiac band.
     - Applies Hann-tapered unity-gain overlap-add (`W[t + i]`), eliminating edge amplitude drop in the first and last 1.6 s of each window.
     - Detects Blue-channel CMOS starvation under warm indoor lighting (`bNoise > 2.2 * gNoise`) and substitutes a low-noise RG chrominance reference (`rPPG-Toolbox` CHROM principle).
   - `sqi(x)` & `analyze(samples)` & `createTracker()`:
     - Added normalized autocorrelation Signal Quality Index (`sqi`, ported from `open-rppg`) and cascaded 4th-order zero-phase highpass filtering (`0.66 Hz`) to reject $0.60\text{ Hz}$ breathing/nodding harmonics while preserving $0.75\text{ Hz}$ (45 bpm).
     - Combined spectral prominence and `sqi` in `createTracker()` to double valid recovery on `slowArtefact` (33% -> 57%, MAE 1.1 bpm) and `weakPulseRedNoise` (9% -> 17%, MAE 1.7 bpm) while keeping `noiseOnly` at 0% and `redNoiseOnly` at 5%.
   - `isSkin(r, g, b)`: widened YCbCr chrominance bounds (`cb` 72–142, `cr` 124–185) and luminance floor (`r >= 30`) for South Asian / diverse skin tones under warm LED or cool laptop screen glow.
2. `app.js`:
   - Integrated `createRoiStabilizer` in `frame()` to stabilize forehead (`L[151]`) and cheek (`L[50]`, `L[280]`) ROI centers and face width `fw` before integer pixel rounding, resetting on session start (`go()`) and face loss.
3. `tests/hr.test.mjs`:
   - Added realistic webcam stress tests (`warmLightNoisyBlue`, `autoExposureStep`, `webcam20fpsRsa`) and unit tests for `createRoiStabilizer` and `sqi` (18 tests in `hr.test.mjs`, 40 tests total across suite).
4. `tools/evaluate_rppg.py`:
   - Added offline/helper rPPG evaluation script auditing session CSV exports (`hr_coverage`, `hrv_coverage`, `mean_q`, `within_5bpm` against `--ref-hr` or `ref_hr` fingertip oximeter readings) and running `open-rppg` (`FacePhys.rlap`) on recorded video clips when installed.
5. `launcher/site/`:
   - Synced updated `hr.js` and `app.js` into `launcher/site/`.

Checked: `npm run check`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (40 tests pass); `python3 -m py_compile tools/evaluate_rppg.py`.  
Not checked: live 5+ participant webcam cohort against a physical fingertip pulse oximeter; packaged native macOS/Windows binary execution.

---

## v0.8.0 release update (2026-11-04): TA evaluation guide, package scripts, and production README (feat/stroop-mesh-stress-vectors)

Changed
1. `README.md`:
   - Overhauled into a publication-grade academic repository README with status badges, 3-minute evaluation walkthrough for TAs, Triguna physiological framework table, personal baseline Z-score rationale, downward-pitch attenuation notes, test suite documentation, and architecture layout.
2. `package.json`:
   - Added standard npm lifecycle scripts (`npm test`, `npm run check`, `npm start`) and project metadata so evaluators can run tests and syntax checks with standard tooling.
3. `docs/`:
   - Updated documentation guides covering plain-English concepts, 7-slide deck structure, and spoken evaluation answers.
4. `installation`, `installation.sh`, `Tempo_run`, `Tempo_run.sh`:
   - Added zero-friction setup and launch scripts for TAs/evaluators (`./installation` and `./tempo_run` / `./Tempo_run`) with automatic free-port detection (8000+), loopback binding (`127.0.0.1`), and cross-platform default browser launch (macOS, Linux, Windows Git Bash/WSL).

Checked: `npm run check`; `npm test` (35 tests pass).  
Not checked: execution on live multi-subject cohort; packaged native macOS universal bundle.

---

## v0.8.0 update (2026-11-01): production-grade modular refactoring, modal overscroll containment, breathing coach UX polish, and downward pitch helper (feat/stroop-mesh-stress-vectors)

Changed
1. `app.js`:
   - Refactored the entire 1,000+ line module from dense, single-letter prototype syntax into 12 clearly structured, self-documenting architectural sections (Configuration & Priors, Pure Math & Tension Scoring, Runtime State & Worker Clock, Multimodal Inference & Fusion, WebAudio Synthesis, Biomechanical FACS Mesh, Frame Capture & Feature Extraction, Live Telemetry Loop, Phase Controls & Check-In Drawer, Stroop Stressor, Breathing Coach, and Session Lifecycle & CSV Export).
   - Extracted and exported `downLookOf(x, baseRef)` to unify downward head-pitch and vertical gaze attenuation across the 4 Hz fast display (`liveTick`) and 1 Hz study log (`tick`).
   - Added `syncBreathePreview(patternKey)` so switching between `4-7-8 Relax`, `4-4-4-4 Box`, and `5-5 Coherent` tabs updates `aria-selected`, countdown seconds, phase label, and instruction immediately even while idle, and added `Space` keyboard shortcut support inside `#breatheModal`.
   - Guarded `latestStroop` and `latestBreathe` so accidental 0-trial or 0-second modal opens/closes do not overwrite a previously completed stressor or breathing summary, and added an empty-session guard on `#exp` CSV export.
2. `breathe.js`, `stroop.js` & `ui.js`:
   - `breathe.js`: updated `setPattern(key)` to reset `startTime` when switching protocols mid-session so the newly selected breathing technique starts cleanly at Step 0 (`Breathe in`).
   - `stroop.js`: cleaned up trial generator and documentation for the 7-color (`Red`, `Green`, `Blue`, `Yellow`, `Purple`, `Orange`, `Pink`) 4-button rotating Stroop stressor.
   - `ui.js`: formatted all DOM helpers for readability, added null-safety guards on DOM lookups, and updated `setupDialogDismiss(d)` to check `'closedBy' in HTMLDialogElement.prototype` per modern web dialog standards.
3. `index.html` & `styles.css`:
   - Added `overscroll-behavior: contain` on `dialog:modal` and `overflow: hidden; overscroll-behavior: contain` on `dialog::backdrop` to prevent background page scroll chaining when `#summary`, `#stroopModal`, or `#breatheModal` is open.
   - Added `.section-title:has(+ .tiles-grid:not(:has(> :not([hidden]))))` so the "Highlights" heading and grid collapse cleanly when both `#pulseBox` and `#guna` are hidden.
   - Replaced inline HTML styles with semantic classes (`.cam-privacy-note`, `.sumbreathe`, `.breathe-footer`, `.breathe-footer-actions`), added `aria-selected` attributes to `.breathe-tab` controls, tightened `.cam` video max-height to `200px` for 13"–14" laptop viewports, and removed unused legacy Stroop CSS classes.
   - Bumped asset cache-busting query strings to `?v=0.8.0`.
4. `tests/ui.test.mjs`, `VERSION.txt`, `launcher/`:
   - Added unit tests for `downLookOf()`, mid-session `breatheCoach.setPattern()`, and phase-contextual button visibility (`#btnStroop` vs `#btnBreathe`).
   - Updated `VERSION.txt` to `v0.8.0`, synced `launcher/site/`, and rebuilt `launcher/tempo-launcher`.

Checked: `node --check app.js ui.js hr.js affect.js voice.js chart.js summary.js stroop.js breathe.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (35 tests pass); `cd launcher && go build -trimpath -ldflags "-s -w" -o tempo-launcher .`.
Not checked: real multi-participant webcam study runs across diverse operating systems; hardware rPPG under varying lighting conditions; packaged native macOS universal bundle.

---

---

*Earlier v0.1.0–v0.7.0 development history is archived in git commit history (`git log -- HANDOFF.md`) and summarized in `HANDOFF_NOTES.md`.*
