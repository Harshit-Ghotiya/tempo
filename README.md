# Tempo: On-Device Stress-Signal Portal & Indic Triguna Estimation

[![Version](https://img.shields.io/badge/version-v0.8.0-blue.svg)](VERSION.txt)
[![Course](https://img.shields.io/badge/course-IKO_103_Holistic_Wellbeing-indigo.svg)](STUDY_PROTOCOL.md)
[![Institution](https://img.shields.io/badge/institution-IIT_Roorkee-orange.svg)](https://www.iitr.ac.in)
[![Privacy](https://img.shields.io/badge/privacy-100%25_On--Device_Local-brightgreen.svg)](#privacy-invariant)
[![Tests](https://img.shields.io/badge/tests-35_passed-success.svg)](#testing--verification)
[![License](https://img.shields.io/badge/license-Academic_Evaluation-lightgrey.svg)](#academic-context)

> **Tempo** is a privacy-first, on-device bio-signal portal that estimates real-time psychological stress from webcam facial movements, posture, and physiology. Instead of applying rigid universal thresholds, Tempo continuously scores changes against each individual's **calibrated personal baseline**, contextualizing stress responses through the Indic framework of **Triguna** (*Sattva*, *Rajas*, *Tamas*).

---

## ⚡ Quick Start for Evaluators & TAs

Tempo requires **no backend, no database, and no cloud setup**. You can run and evaluate the complete system in under a minute using any modern web browser (Google Chrome, Microsoft Edge, or Brave recommended).

### 🚀 Easiest Way: Automated Scripts

```bash
# 1. First-time setup (verifies Python, optional test dependencies)
./installation

# 2. Whenever you want to launch Tempo (starts server & opens browser automatically)
./tempo_run
```

* **macOS / Linux / Windows Git Bash**: run `./installation` and `./tempo_run` (or `bash installation.sh` / `bash tempo_run.sh`).
* **Windows Command Prompt / File Explorer**: double-click `installation.bat` and `tempo_run.bat`.

---

### Alternative Manual Startup

Because modern web browsers restrict camera access and WebAssembly ES modules over `file:///` URLs, run a lightweight local HTTP server from the project root:

```bash
# 1. Start local server
python3 -m http.server 8000

# 2. Open in your browser
# Navigate to http://localhost:8000
```

### Option 2: Node.js

```bash
# Install dependencies & run test suite
npm install
npm test

# Launch local server
npm start
# Open http://localhost:8000
```

### Option 3: Pre-compiled Standalone Launcher (Zero-Install)
If you prefer a 1-click native launcher that embeds the server and automatically opens the browser:
* **Windows**: Run `launcher/dist/Tempo.exe`
* **macOS / Linux**: Build with `cd launcher && sh build.sh`, then run `./tempo-launcher`

---

## 🎯 How to Evaluate in 3 Minutes

Once the portal is open in your browser, follow this evaluation walkthrough:

```
+---------------------------------------------------------------------------------------+
|  1. BASELINE (80s)       -->   2. STRESSOR (90s)        -->   3. RECOVERY (90s)       |
|  Calibrate Resting Face        7-Color Stroop Challenge       Guided Breathwork       |
|  Tension ~ 0.0 (Sattva)        Tension Spikes (Rajas)         Tension Drops (Sattva)  |
+---------------------------------------------------------------------------------------+
```

1. **Camera Setup & Baseline (80s)**:
   - Click **Allow Camera**. Notice the on-device privacy guarantee: the raw video never leaves browser memory.
   - Sit comfortably facing the screen. The automated setup runs 20 seconds of settling in, followed by 60 seconds of baseline calibration.
   - The system computes your personal resting mean ($\mu$) and standard deviation ($\sigma$) across all facial muscle groups.
2. **Stressor Phase (Cognitive Strain)**:
   - Flip the phase switch to **Stressor**.
   - Click the **"Launch Stroop Test"** button to open the built-in 7-color cognitive conflict stressor (e.g. the word *"BLUE"* rendered in red ink with rotating response buttons).
   - Complete 30–60 seconds of trials. Observe the real-time SVG trend chart: your **Tension Index** climbs into the elevated zone as your brow furrows (AU4), eyelids tighten (AU7), and blinking is suppressed.
3. **Recovery Phase (Parasympathetic Reset)**:
   - Flip the phase switch to **Recovery**.
   - Click **"Guided Breathing"** and select a protocol (such as *4-7-8 Relaxing Breath* or *5-5 Coherent Breathing*).
   - Follow the visual expanding/contracting orb and soft audio cues for 3–4 cycles. Observe the live tension score drop back toward baseline.
4. **Summary & Export**:
   - Click **"View Summary"** to inspect automated phase-by-phase metrics, cognitive Stroop interference latency ($RT_{incongruent} - RT_{congruent}$), and directional validation checks.
   - Click **"Export CSV"** to inspect the exported biometric telemetry (strictly derived numbers, zero imagery).

---

## 🧠 Theoretical Framework: Biomechanics & Triguna

This project bridges modern biomechanical signal processing with the Indic psychology of **Triguna** (Samkhya philosophy and Ayurveda) for course **IKO 103** at IIT Roorkee:

| Guna State | Psychological Correlate | Biomechanical & Facial Markers | System Response |
| :--- | :--- | :--- | :--- |
| **Sattva** | Equilibrium, calmness, cognitive clarity, parasympathetic tone | Relaxed facial musculature, stable resting gaze, normal spontaneous blink rate (~12–18/min), low tension index ($Z \approx 0$). | Green zone, gentle guidance, stable trend |
| **Rajas** | Agitation, mental restlessness, acute stress, sympathetic activation | Corrugator brow furrowing (AU4), orbicularis oculi lid tightening (AU7), **blink rate suppression** (staring under cognitive load), elevated head/torso motion. | Amber/Red zone, stress alerts, high tension score |
| **Tamas** | Sluggishness, lethargy, fatigue, withdrawal | Prolonged eye closure duration (PERCLOS), reduced spontaneous facial expressivity, head drooping, postural slump. | Gray zone, lethargy detection, recovery prompts |

### The "Personal Baseline" Innovation (Z-Scores)
Static computer vision models fail on diverse human populations because neutral facial anatomy varies widely (e.g. naturally narrow eyes or deep brow arches). Tempo avoids this false-positive trap:
$$\text{Z-Score} = \frac{x - \mu_{\text{baseline}}}{\sigma_{\text{baseline}}}$$
Every muscle activation is scored exclusively as a deviation from the user's *own resting state*.

### Downward-Pitch & Gaze Attenuation (`downLookOf`)
When users tilt their head downward to read a notebook or look at a keyboard, facial foreshortening can artificially compress the eye and brow geometry. Tempo implements geometric pitch and gaze tracking that automatically attenuates false-positive stress spikes during downward tilt.

---

## 🔒 Privacy Invariant

* **Zero Video Streaming**: Video and audio streams are processed frame-by-frame in volatile RAM via WebAssembly.
* **No Image Storage**: No frames, video clips, or photos are ever written to disk, sent to a server, or shared.
* **Anonymous Data Export**: Only derived numerical indices (timestamps, Z-scores, and phase tags) are exported when the participant explicitly presses **Export CSV**.

---

## 🧪 Testing & Verification

The project includes an automated test suite verifying DOM bindings, mathematical normalization routines, rPPG physiological filter bounds, Stroop challenge mechanics, and breathing cycles:

```bash
# Run all 35 unit and regression tests
npm test

# Perform strict syntax checks across all modules
npm run check
```

### Test Coverage Highlights
* **Facial Action Units & Stress Vectors**: Validates AU4 brow lowering, AU7 eyelid tightening, and pitch attenuation.
* **Photoplethysmography (hr.js)**: Verifies bandpass filtering, harmonic tracking, skin-pixel segmentation, and motion-burst rejection on synthetic pulse waveforms.
* **Cognitive Stroop Lifecycle**: Verifies trial generation, chromatic dissonance, keyboard/mouse event dispatch, and interference calculation.
* **Guided Breathing Engine**: Verifies timing calculations, cycle transitions, and step progress across 4-7-8, 4-4-4-4 Box, and 5-5 Coherent protocols.

---

## 📂 Project Architecture

```
tempo/
├── index.html            # Semantic, compact responsive UI with Apple-style design tokens
├── styles.css            # Scoped modern styles, modal containment, dark/light themes
├── app.js                # Core controller: MediaPipe worker clock, tension fusion, lifecycle
├── ui.js                 # Safe DOM bindings, charts, toasts, dialogs, drawers
├── chart.js              # Real-time smooth zone-colored SVG trend visualizer
├── stroop.js             # 7-color cognitive interference stressor module
├── breathe.js            # Guided breathing coach with 3 evidence-based recovery protocols
├── affect.js             # Circumplex valence-arousal facial affect module
├── voice.js              # Real-time WebAudio pitch variability & speech energy scorer
├── hr.js                 # Remote photoplethysmography (rPPG) optical pulse tracker
├── summary.js            # Retrospective session statistics and directional validation checks
├── train_guna.py         # Supervised ridge/logistic model training on self-reports
├── tests/
│   ├── ui.test.mjs       # UI contract, breathing, Stroop, and tension tests
│   └── hr.test.mjs       # Synthetic pulse wave physiological verification
├── launcher/             # Go-based standalone cross-platform offline executable builder
└── docs/
    ├── Tempo_Project_Explanation_and_TA_Viva_Guide.pdf  # Comprehensive viva & presentation guide
    ├── STUDY_PROTOCOL.md                               # 3-phase experimental data collection protocol
    ├── DATA_SCHEMA.md                                  # Schema for exported CSV columns
    └── ROADMAP.md                                      # Architectural decisions & changelog
```

---

## 📖 Evaluation Resources for Students & TAs

* **[TA Viva Cheat Sheet & Presentation Guide (PDF)](docs/Tempo_Project_Explanation_and_TA_Viva_Guide.pdf)**: A 6-page plain-English guide covering core concepts, slide deck outlines, and word-for-word answers to typical evaluation questions.
* **[Study Protocol](STUDY_PROTOCOL.md)**: Standardized 3-phase experimental procedure for multi-subject data collection.
* **[Data Schema](DATA_SCHEMA.md)**: Full definition of all 28 exported biometric telemetry columns.

---

## ⚖️ Academic Context & Scientific Honesty

This software was developed for **IKO 103 (Holistic Wellbeing, Indic Perspective)** at **IIT Roorkee**.

In accordance with good research practice, we note our system's verified status and limitations:
1. **Facial Muscle Tracking**: Action unit extraction, personal baseline Z-score normalization, downward pitch attenuation, and cognitive Stroop interference are thoroughly tested and robust.
2. **Tension Index Weights**: The weights assigned to facial action units are literature-informed priors; they represent an experimental heuristic index and are not claimed to be clinically certified diagnostic thresholds.
3. **Optical Pulse (rPPG)**: Remote heart rate tracking passes synthetic physiological unit tests, but on real-world webcams it remains sensitive to fluctuating ambient lighting and rapid head movement.
4. **Baseline Comparisons**: When evaluating predictive models on study data (`train_guna.py`), results should be compared against both a constant baseline and a phase-mean baseline.

---

*Developed at IIT Roorkee for IKO 103: Holistic Wellbeing (Indic Perspective).*
