# Prior Art & Patent Benchmark Report: Camera-Based Stress & Facial Affect Detection

**Project:** Tempo (`v0.8.5-dev`) — On-Device Multimodal Stress & Triguna Detection  
**Course:** IKO 103 (Holistic Wellbeing, Indic Perspective) — IIT Roorkee  
**Prepared For:** Research Advisor & Teaching Assistant (TA)  
**Date:** November 2026  

---

## Executive Summary & Taxonomy of Prior Art

This report benchmarks **Tempo (`v0.8.5-dev`)** against **eight foundational and contemporary patents (1999–2024)** and **four core peer-reviewed systems/benchmarks (`Wang et al. 2017`, `Norden et al. 2022`, `LibreFace 2023`, `StressID 2023`)**.

The prior art spans three developmental waves:
1. **The Foundational FACS & Geometry Wave (1999–2014):** Optical-flow and Active Appearance Model (AAM) regression for Ekman Action Units (Kanade, Cohn, De la Torre / IBM & CMU).
2. **The Commercial Multimodal & rPPG Wave (2012–2020):** Blink-rate cognitive state inference, population norm generation, single-modal CNN classifiers, multimodal early/late fusion with intermittent channel dropout (`US 10,628,741 B2`), and Plane-Orthogonal-to-Skin (POS) camera rPPG (Affectiva / Smart Eye; Koninklijke Philips).
3. **The Modern Edge & Ubiquitous Computing Wave (2022–2024):** Continuous on-device stress tracking combining facial cues, gaze, and interactive task context (Apple Inc.).

> **Scientific Honesty Disclosure (`CLAUDE.md`):** Predicting self-reported change-from-baseline stress (`stress_delta`) is the primary target; compositional Triguna (`Sattva, Rajas, Tamas`) is a secondary course-demo layer (`DEMO_GUNA = false` by default). All numerical metrics in Section 9 come from Tempo's `49` automated JS tests and `20`-participant synthetic verification suite; multi-participant real-face cohort studies and real OpenFace/LibreFace correlations remain next-phase milestones.

---

## Chronological Comparative Matrix (8 Patents: 1999–2024)

| # | Patent Number & Title | Assignee | Priority / Filing / Pub Date | Core Technical Scope | Tempo Architectural Differentiation |
|---|----------------------|----------|------------------------------|----------------------|-------------------------------------|
| **1 (Oldest)** | **US 6,574,362 B1**<br>*System and method for emotion extraction from a facial image* | IBM / Carnegie Mellon Univ. (CMU) | Filed: Sep 1999<br>Granted: Jun 2003 | Optical flow tracking of facial regions mapped to Ekman Action Units; early discrete emotion classification. | Heavy offline processing; no personal baseline calibration; maps to discrete Ekman 6 emotions rather than continuous stress reactivity (`stress_delta`). |
| **2** | **US 8,798,374 B2**<br>*Automated action unit recognition and expression analysis* | Carnegie Mellon Univ. (CMU) | Priority: Jul 2011<br>Granted: Aug 2014 | Dense Active Appearance Models (AAM) and SVMs for AU intensity regression across image sequences. | Population-level training triggers resting-face bias; no downward-pitch attenuation (`downLook`), verified via 7-AU posed selectivity audit (`--posed`). |
| **3** | **US 9,723,992 B2**<br>*Mental state analysis using blink rate* | Affectiva, Inc. | Priority: Sep 2012<br>Granted: Aug 2017 | Eye blink frequency/duration tracking over video windows to infer fatigue, alertness, and workload. | Targets drowsiness (increased blinks); Tempo models acute visual cognitive stress (blink suppression, `blink: -0.4`) via dual hysteresis (`0.40/0.25`) + MAD floors (`FLOOR.blink = 7.0`). |
| **4** | **US 9,959,549 B2**<br>*Mental state analysis for norm generation* | Affectiva, Inc. | Priority: Oct 2013<br>Granted: May 2018 | Collects viewer facial responses at scale to build demographic normative benchmark distributions. | Population norms introduce resting-morphology and demographic bias; Tempo enforces strict **within-subject dynamic calibration** (`Median + 1.4826 * MAD` with variance `FLOOR`). |
| **5** | **US 10,034,611 B2**<br>*System and method for measuring physiological characteristics* | Koninklijke Philips N.V. | Priority: Jun 2014<br>Granted: Jul 2018 | Camera-based rPPG pulse extraction across skin regions (foundation of POS skin projection). | Standalone stationary pulse estimation; Tempo `v0.8.5-dev` adds 3-ROI quality-weighted consensus fusion (`fuseRois`), 1 s block/tail motion protection (`motionBlocks`), log-parabolic refinement, MAD-ectopy RMSSD, and late-fusion abstention. |
| **6** | **US 10,614,289 B2**<br>*Facial tracking with classifiers* | Affectiva, Inc. / Smart Eye | Priority: Feb 2015<br>Granted: Apr 2020 | Hierarchical landmarking feeding proprietary deep neural classifiers for valence/arousal. | Closed SDK / server infrastructure; Tempo executes 100% in-browser via Wasm, adds downward gaze/pitch attenuation (`downLook`), and swaps prior `TENSION` weights for LOPO-fitted `stress_delta` Ridge weights only when `N >= 20` and `vs_phase < 0`. |
| **7** | **US 10,628,741 B2**<br>*Multimodal machine learning for emotion metrics* | Affectiva, Inc. | Priority: Jun 2010<br>Filed: Sep 2018<br>Granted: Apr 2020 | Deep multilayered CNN trained jointly on audio + video + physio with hybrid early/late fusion and intermittent channel dropout (Claims 9–10). | Cloud/server CNN trained with demographic grouping; Tempo runs ephemeral zero-cloud inference with an explicit SNR-gated **Log-Linear Opinion Pool** (`fuse`, `MIN_Q = 0.3`) + sub-ROI dropout resilience and LOPO dual-baseline validation. |
| **8 (Recent)** | **US 2024/0164672 A1**<br>*Stress detection* | Apple Inc. | Priority: Nov 2022<br>Published: May 2024 | Continuous on-device stress tracking combining facial cues, gaze/pupil dynamics, and interactive task context. | Coupled to proprietary OS/TrueDepth IR hardware; Tempo runs cross-platform on commodity RGB webcams in any browser under DPDP / EU AI Act privacy boundaries. |

---

## Detailed Breakdown of All 8 Patents

### 1. The Oldest Foundational Patent: `US 6,574,362 B1`
* **Title:** System and method for emotion extraction from a facial image
* **Assignee:** International Business Machines Corp. (IBM) / Carnegie Mellon University (CMU)
* **Inventors:** Takeo Kanade, Jeffrey F. Cohn, Ying-li Tian
* **Dates:** Filed September 14, 1999 · Granted June 3, 2003
* **Official URL:** [Google Patents US6574362B1](https://patents.google.com/patent/US6574362B1/en)
* **Technical Summary:** Introduced automated computer-vision decomposition of Ekman’s FACS Action Units using multi-state component templates (separating rigid head motion from non-rigid brow, eye, and mouth deformations) and optical flow.
* **Tempo Architectural Novelty:** Rather than classifying six discrete emotions from raw optical flow, Tempo computes continuous $z$-score deviations of 7 FACS blendshape composites relative to each user's 60 s calm baseline, feeding Ridge `stress_delta` regression and a secondary continuous 2-simplex equilibrium (*Sattva, Rajas, Tamas*).

---

### 2. Dense Landmark Action Unit Regression: `US 8,798,374 B2`
* **Title:** Automated action unit recognition and expression analysis
* **Assignee:** Carnegie Mellon University (CMU)
* **Inventors:** Jeffrey F. Cohn, Fernando De la Torre, Simon Baker, Jason Saragih
* **Dates:** Priority July 1, 2011 · Granted August 5, 2014
* **Official URL:** [Google Patents US8798374B2](https://patents.google.com/patent/US8798374B2/en)
* **Technical Summary:** Estimates AU intensity using deformable 3D Active Appearance Models (AAM) coupled with SVMs across normalized geometric shape vectors.
* **Tempo Architectural Novelty:** Eliminates AAM resting morphology bias via Median/MAD calibration with audited variance `FLOOR` bounds, suppresses downward head-pitch foreshortening via `attenuateDownLook()`, and provides automated 7-AU posed selectivity, leakage ratio ($\le 0.5$), and OpenFace/LibreFace Spearman ($\ge 0.6$) auditing in [`tools/audit_features.py`](../tools/audit_features.py) and [`tools/audit_posed_expressions.py`](../tools/audit_posed_expressions.py).

---

### 3. Cognitive Blink Rate Tracking: `US 9,723,992 B2`
* **Title:** Mental state analysis using blink rate
* **Assignee:** Affectiva, Inc. (now Smart Eye)
* **Inventors:** Rana el Kaliouby, Rosalind W. Picard, et al.
* **Dates:** Priority September 14, 2012 · Granted August 8, 2017
* **Official URL:** [Google Patents US9723992B2](https://patents.google.com/patent/US9723992B2/en)
* **Technical Summary:** Tracks eye aspect ratios, eyelid closures, and blink frequencies over video windows to detect drowsiness, boredom, and engagement.
* **Tempo Architectural Novelty:** Affectiva models fatigue/drowsiness (elevated blink duration). Tempo models **acute cognitive concentration**, where task load suppresses spontaneous blinking (`blink: -0.4` in `TENSION`), implemented with a dual-threshold state machine (closure `> 0.40`, reopen `< 0.25`) over a 30 s rolling buffer and `FLOOR.blink = 7.0` blinks/min so normal reading focus does not clip at $-3.0$.

---

### 4. Population Norm Generation: `US 9,959,549 B2`
* **Title:** Mental state analysis for norm generation
* **Assignee:** Affectiva, Inc.
* **Inventors:** Rana el Kaliouby, et al.
* **Dates:** Priority October 18, 2013 · Granted May 1, 2018
* **Official URL:** [Google Patents US9959549B2](https://patents.google.com/patent/US9959549B2/en)
* **Technical Summary:** Aggregates facial responses from thousands of media viewers across demographic buckets to generate population baseline norms for scoring individuals.
* **Tempo Architectural Novelty:** Rejects demographic population norms (which embed resting-face, age, and ethnic morphology biases) in favor of **self-referential 60 s calibration** (`makeBase` in `app.js`): $s_k = \max(1.4826 \cdot \text{MAD}_k, 0.1|m_k|, \text{FLOOR}_k)$ with `[-3, +3]` clipping and a methodological **Phase-Mean Baseline** (`vs_phase`) verifying individual reactivity above task phase averages.

---

### 5. Video-Based rPPG Pulse Extraction: `US 10,034,611 B2`
* **Title:** System and method for measuring physiological characteristics
* **Assignee:** Koninklijke Philips N.V.
* **Inventors:** Gerard de Haan, Wenjin Wang, et al.
* **Dates:** Priority June 13, 2014 · Granted July 31, 2018 · Reference Paper: Wang et al. (IEEE TBME 2017)
* **Official URL:** [Google Patents US10034611B2](https://patents.google.com/patent/US10034611B2/en)
* **Technical Summary:** Protects remote photoplethysmography (rPPG) pulse extraction across facial skin regions, projecting normalized RGB signals onto a Plane-Orthogonal-to-Skin (POS) to suppress specular and uniform intensity shifts.
* **Tempo Architectural Novelty (`v0.8.5-dev` in [`hr.js`](../hr.js)):** Classic POS uses a single pooled ROI and global spectral argmax assuming a stationary user. Tempo advances POS with:
  1. **Quality-Weighted 3-ROI Consensus Fusion (`fuseRois` & `resample`):** Separately tracks forehead, left malar cheek, and right malar cheek; retains $\ge 2$ of 3 slots with $\ge 80\%$ frame coverage (falling back to frame mean on dropped frames) and weights each ROI by squared correlation with the most coherent pair, isolating localized smile or brow-furrow artifacts.
  2. **1 s Block & Trailing Partial-Block Motion Protection (`motionBlocks` + `analyze`):** Flags any 1 s block (or trailing `< 1 s` tail `tailFlag`) whose despiked green spread exceeds `MOT_K = 3x` clean reference or whose raw forehead landmark excursion exceeds `MOT_RANGE = 0.08` face widths; analyzes only the longest clean $\ge 8\text{ s}$ stretch and freezes tracker memory (`holdMs` up to `15 s`) on motion abstention.
  3. **Anti-Hopping Gaussian Affinity & Low-Frequency Cold-Start Lock:** Scores candidates via $c.s \cdot \exp(-0.5 (|c.\text{bpm} - \text{hr}| / 7.5)^2) \cdot (1 + 0.25 c.\text{corr})$ and requires multi-window confirmation below `58 bpm` (`0.97 Hz`) to reject panting heave.
  4. **Log-Parabolic Peak Refinement & MAD Ectopy RMSSD:** Sub-bin interpolation (`refine`) reduces $0.6\text{ bpm}$ quantization error; `rmssd()` rejects ectopic inter-beat intervals via $3\sigma_{\text{MAD}}$ gating before computing successive differences.

---

### 6. Facial Tracking with Deep Classifiers: `US 10,614,289 B2`
* **Title:** Facial tracking with classifiers
* **Assignee:** Affectiva, Inc. / Smart Eye
* **Inventors:** Rana el Kaliouby, et al.
* **Dates:** Priority February 24, 2015 · Granted April 7, 2020
* **Official URL:** [Google Patents US10614289B2](https://patents.google.com/patent/US10614289B2/en)
* **Technical Summary:** Covers video capture, real-time facial landmarking, AU extraction, and hierarchical deep neural classifiers outputting valence, arousal, and cognitive states.
* **Tempo Architectural Novelty:** Runs transparently in browser Wasm instead of closed native/cloud SDKs, suppresses desk/phone foreshortening via shared `attenuateDownLook`, and transitions from priors (`TENSION`) to LOPO-fitted `stress_delta` Ridge weights (`stress_tension` in `models.json`) **only** when empirically validated (`n_participants >= 20` and `vs_phase < 0`).

---

### 7. Multimodal ML & Intermittent Channel Dropout: `US 10,628,741 B2` *(Added in Full Audit)*
* **Title:** Multimodal machine learning for emotion metrics
* **Assignee:** Affectiva, Inc. (Boston, MA)
* **Inventors:** Rana el Kaliouby, Seyedmohammad Mavadati, Taniya Mishra, Timothy Peacock, Panu James Turcot
* **Dates:** Priority June 7, 2010 · Filed September 11, 2018 · Granted April 21, 2020
* **Official URL:** [Google Patents US10628741B2](https://patents.google.com/patent/US10628741B2/en)
* **Technical Summary:** Claims a multilayered convolutional neural network trained simultaneously on contemporaneous audio, video facial descriptors (HoG / LGBP on $96\times 96$ normalized crops, bottleneck neutral-to-expression layers), and physiological channels using early, late, or hybrid fusion (`Claims 1, 5–8`). Explicitly claims **intermittent capture and single-channel dropout** (`Claims 9–10`), continuing evaluation on remaining channels when line-of-sight or microphone signal drops out, and counts emotional events across crowdsourced, demographically grouped datasets (`Cols. 28, 34; Claim 12–13`).
* **Tempo Architectural Novelty:**
  1. **Explicit Quality-Gated Log-Linear Opinion Pool vs. Black-Box CNN Dropout:** Instead of trusting implicit CNN representations during channel loss (`Claims 9–10`), Tempo applies per-modality quality gates ($q_m < 0.3 \implies a_{im} = 0$) and analytically renormalizes $\log \tilde{p}_{ic} = \frac{1}{T} \frac{\sum_m \omega_m a_{im} \log P_{im,c}}{\sum_m \omega_m a_{im}}$, abstaining cleanly (`null`) if all modalities degrade (`fuse()` in `app.js`).
  2. **Sub-ROI & Feature-Level Dropout Resilience:** Beyond modality dropout (`face`/`rppg`/`pose`/`voice`), Tempo tolerates single-cheek occlusion (2-of-3 sub-ROIs in `hr.js`), partial missing features via training median imputation (`modP`), and non-finite `z` entries in `tensionOf()`.
  3. **Ephemeral Client Compute vs. Cloud/Demographic Server Loops (`Fig. 13`):** Eliminates Internet audio/video transfer (`1360` $\to$ `1330`/`1340`) and demographic norm grouping (`nationality`/`age`/`ethnicity`), replacing them with within-subject Median/MAD calibration and anti-leakage LOPO dual-baseline validation.

---

### 8. Modern Edge Stress Detection: `US 2024/0164672 A1`
* **Title:** Stress detection
* **Assignee:** Apple Inc.
* **Inventors:** Erdrich et al.
* **Dates:** Priority November 21, 2022 · Published May 23, 2024
* **Official URL:** [Google Patents US20240164672A1](https://patents.google.com/patent/US20240164672A1/en)
* **Technical Summary:** Continuously estimates device-user stress by combining screen-facing facial cues, gaze/pupil metrics, and transitions around challenging interactive tasks.
* **Tempo Architectural Novelty:** Requires no proprietary OS APIs or TrueDepth IR depth hardware—executes on commodity RGB webcams in standard browsers with built-in Chromatic-Dissonance Stroop (`stroop.js`) and Coherent Breathing (`breathe.js`) tasks under India DPDP and EU AI Act safeguards.

---

## Academic Literature & Benchmark Alignment

| Reference | Core Methodology | How Tempo Benchmarks / Aligns |
|-----------|-----------------|-------------------------------|
| **Wang et al. (IEEE TBME 2017)** | Algorithmic Principles of Remote PPG (POS projection) | Forms the `pos()` / `posClean()` core of `hr.js`; directly compared against `v0.4` baseline POS across 14 synthetic scenarios + 4 motion/sub-ROI tests. |
| **Norden et al. (ACII 2022)** | Multidimensional Stress Detection (TSST self-report, observer, cortisol) | Demonstrated that uncalibrated face models fail to generalize reliably; drives Tempo's `stress_delta` primary target and mandatory `vs_phase` baseline. |
| **LibreFace (WACV 2024 / arXiv 2023)** | Open-source FACS AU intensity regression benchmarks | Serves as external ground-truth reference in `tools/audit_features.py --posed --au` and `tools/audit_posed_expressions.py` (target Spearman $\ge 0.6$). |
| **StressID (NeurIPS 2023)** | Multimodal video + ECG + EDA + speech stress dataset (Stroop / arithmetic) | Serves as target public video benchmark for LOPO generalization against heavy ResNet3D/ViT offline baselines (Roadmap Phase 3). |

---

## Section 9: Quantitative Benchmark Verification Summary (`v0.8.5-dev`)

All benchmarks below were executed cleanly on the final `v0.8.5-dev` codebase (**49/49 JS unit & contract tests passing**, Python `py_compile`, and 20-participant synthetic LOPO / AU audit runs). Real-face human cohort numbers remain pending Roadmap Phase 2–4 data collection.

### Table A — rPPG Signal & Motion Benchmark (`hr.js` vs. Baseline POS `v0.4`)

| Scenario / Regression Test | `v0.8.5-dev` Valid % | `v0.8.5-dev` MAE (bpm) | `v0.8.5-dev` MaxErr (bpm) | Baseline POS (`v0.4`) MAE / Note |
|---|---:|---:|---:|---|
| `clean60` (60 bpm clean pulse) | `100%` | `0.2` | `0.5` | `0.2` (baseline match) |
| `fast120` (no half-rate lock) | `100%` | `0.1` | `0.3` | `0.1` |
| `slow45` (near band floor `0.75 Hz`) | `98%` | `0.1` | `0.6` | `0.3` |
| `weakPulseRedNoise` | `22%` | `1.6` | `3.0` | `36.3` (high-precision abstention) |
| `harmonicDominant` (holds fundamental) | `100%` | `0.0` | `0.1` | `60.1` (`v0.4` doubles fundamental) |
| `motionBurst` (4 s transient motion) | `86%` | `0.2` | `0.5` | `9.5` |
| `ramp60to90` (gradual rise) | `100%` | `1.6` | `4.0` | `0.2` |
| `step60to100` (step re-acquisition) | `100%` | `0.2` | `0.3` | `0.3` |
| `slowArtefact` (`0.6 Hz` breathing/nodding) | `71%` | `1.0` | `7.4` | `13.3` |
| `noiseOnly` (white noise rejection) | `0%` | `NaN` | `NaN` | `52.9` (`0%` false positive rate) |
| `redNoiseOnly` (colored noise rejection) | `21%` | `2.0` | `3.5` | `39.3` (under `25%` ceiling) |
| `warmLightNoisyBlue` (RG fallback) | `90%` | `2.2` | `7.8` | `3.5` |
| `autoExposureStep` (despike) | `100%` | `0.3` | `0.7` | `0.5` |
| `webcam20fpsRsa` (20 fps + RSA) | `84%` | `2.8` | `6.4` | `3.1` |
| `motionHijack` (10 s `51 bpm` head-motion, S09 regression) | `76%` (`0.759`) | `0.3` (`0.278`) | `0.8` (`0.786`) | `3.82` (never hijacked; `11` valid post/during windows) |
| `subROI` fused vs. pooled (`51 bpm` forehead artefact) | `100%` (`2-of-3`: `>= 80%`) | `0.21` | `0.46` | Pooled fails at `16.96` MAE; `2-of-3` occluded cheek passes |
| `rmssd` ectopy rejection | Clean `5 ms` | Ectopic `14.5 ms` | — | Rejects premature beat spike |

### Table B — LOPO Stress Regression, Multimodal Dropout Fusion & Stressor Audit (`20` Synthetic Participants, `1,800` Windows)

| Benchmark Metric / Model (`train_guna.py`, `app.js`, `audit_features.py`) | Result (`v0.8.5-dev`) | Baseline Comparison / Acceptance Gate |
|---|---|---|
| **Primary `stress_delta` (LOPO Ridge, 15 features)** | `MAE = 0.072`, Spearman `ρ = 0.819` | Beats Constant (`vs_mean = -0.082`, CI `[-0.101, -0.062]`), Phase-Mean (`vs_phase = -0.021`), & Zero (`vs_zero = -0.166`) |
| **Live Portal `stress_tension` (Face-only LOPO Ridge)** | `N = 20`, `vs_phase = -0.016` | Meets portal gate (`N >= 20` & `vs_phase < 0`) -> dynamically switches `tensionSource()` to `'fitted'` |
| **Compositional Triguna (`fusion_learned`, Softmax Pool)** | `soft_ce = 1.010`, `balanced_acc = 0.500` | Beats constant (`vs_constant = -0.018`, CI `[-0.022, -0.014]`); `vs_phase_mean = +0.013` (rightly does not beat phase-mean on synthetic soft targets) |
| **Intermittent Channel Dropout (`US 10,628,741` Claims 9–10 test)** | `49/49` JS tests pass | Exact simplex renormalization across `face+rppg+pose` $\to$ `face+pose` $\to$ `face` $\to$ `null` abstention |
| **Directional Stressor Concordance (`20` sessions, `60` phase pts)** | `10/11` expected features concordant (`sign_p < 0.001`) | Session $\times$ phase Spearman `ρ = 0.783–0.906` on concordant features; correctly flags inverse synthetic `blink` (`WRONG-DIRECTION`) |

### Table C — 7-AU Posed-Expression Selectivity & Cross-Talk Benchmark (`tools/audit_posed_expressions.py`, Synthetic 8-Phase Fixture)

| Posed Expression | Target Feature | Ekman AU (Muscle) | Response (Neutral SD) | Worst Off-Target | Leak Ratio ($\le 0.5$) | Selectivity | External AU Spearman ($\ge 0.6$) | Gate |
|---|---|---|---:|---|---:|---:|---:|---|
| `brow_furrow` | `browLower` | `AU4` (Corrugator) | `16.68 SD` | `eyeWide` | `0.132` | `0.766` | `1.000` (`AU04_r`) | PASS |
| `brow_raise` | `browRaise` | `AU1+AU2` (Frontalis) | `41.98 SD` | `eyeWide` | `0.041` | `0.921` | `1.000` (`AU01_r+AU02_r`) | PASS |
| `eye_squeeze` | `lidTight` | `AU7` (Orbicularis oculi) | `16.71 SD` | `eyeWide` | `0.076` | `0.859` | `1.000` (`AU07_r`) | PASS |
| `eye_wide` | `eyeWide` | `AU5` (Levator palpebrae) | `128.16 SD` | `lipTight` | `0.003` | `0.994` | `1.000` (`AU05_r`) | PASS |
| `lip_press` | `lipTight` | `AU24` (Orbicularis oris) | `124.71 SD` | `browRaise` | `0.005` | `0.989` | `1.000` (`AU23_r+AU24_r`) | PASS |
| `lip_depress` | `lipDown` | `AU15` (Depressor anguli oris) | `48.77 SD` | `eyeWide` | `0.046` | `0.913` | `1.000` (`AU15_r`) | PASS |
| `smile` | `smile` | `AU12` (Zygomaticus major) | `12.63 SD` | `lipTight` | `0.200` | `0.666` | `1.000` (`AU12_r`) | PASS |
