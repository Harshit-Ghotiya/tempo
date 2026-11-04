# Guṇa Multimodal ML Project — Claude Handoff

**Project version:** v0.8.0 (repository release documentation, TA evaluation guide, and package script polish)  
**Date:** 2026-11-04  
**Purpose:** This document is the source-of-truth handoff for continuing development in Claude.

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

## v0.7.9 update (2026-10-27): guided recovery breathing coach, phone gaze downward pitch compensation, compact laptop layout, and refined Stroop palette (feat/stroop-mesh-stress-vectors)

Changed
1. `breathe.js`:
   - Added pure modular breathing engine with 3 evidence-based recovery protocols:
     - `4-7-8` Relaxing Breath (Inhale 4s -> Hold 7s -> Exhale 8s, 19s cycle for parasympathetic vagal stimulation).
     - `4-4-4-4` Box Breathing (Inhale 4s -> Hold 4s -> Exhale 4s -> Hold empty 4s, 16s cycle for tactical calm).
     - `5-5` Coherent Breathing (Inhale 5s -> Exhale 5s, 10s cycle at 6 breaths/min for resonant Heart Rate Variability).
   - Functions `getPatternCycleS()`, `phaseAt(patternKey, elapsedS)` computing step progress, circular ring offset, countdown, and scale factor (1.0 to 1.6), and lifecycle manager `createBreathingCoach()`.
2. `app.js`:
   - Downward head-pitch & phone-gaze attenuation:
     - Calculates normalized head pitch `o.pitch = (L[1].y - midEyeY) / iod` and vertical gaze `o.gy`, and calibrates `base.pitch` and `base.gy` during setup (`cal` and `calFast`).
     - In `tensionOf(z, qFace, downLook)` and `liveTick()`: attenuates positive foreshortening artifacts on `lidTight`, `lipTight`, and `browLower` when the user tilts their head or looks down at a phone/desk, eliminating false stress spikes while keeping upright tension 100% sensitive.
   - Blink rate floor & sensitivity fix:
     - Raised `FLOOR.blink` from `4.5` to `7.0` blinks/min and lowered blink hysteresis thresholds from `0.5/0.3` to `0.40/0.25` so fast natural blinks are reliably captured and ordinary focus does not peg the Blink rate bar at `−3.0`.
   - Phase-contextual action buttons (`syncPhaseButtons`):
     - `#btnStroop` is shown automatically only during the **Stressor** phase (`hidden` in Baseline and Recovery).
     - `#btnBreathe` is shown automatically only during the **Recovery** phase (`hidden` in Baseline and Stressor).
   - Guided breathing integration:
     - Synthesized soft harmonic phase transition tones (440 Hz Inhale, 523 Hz Hold, 330 Hz Exhale) with clientside WebAudio and user mute toggle (`#uBreatheAudio`).
     - Wired breathing cycles into session telemetry (`breathe_active`, `down_look`) and session summary modal (`#sumBreathe`).
3. `stroop.js`:
   - Palette chromatic refinement: replaced cool-adjacent `Cyan` with high-contrast electric **`Pink`** (`inkHex: '#FF375F'`, `btnHex: '#C2185B'`, key `'k'`) and brightened `Purple` to vivid violet (`#D97BFF` / `#7B2CBF`) and `Blue` to royal blue (`#409CFF` / `#0051D5`), eliminating hue confusion among cool colors while preserving semantic-vs-ink cognitive conflict.
   - Removed the 5th "None of the above" catch-trial button (`#stroopBtnNone` and `noneRatio`), keeping 4 dynamically rotating buttons from the 7-color pool on every trial so the target ink color is always among the 4 displayed options (`1`–`4`).
4. `index.html` & `styles.css`:
   - Zero horizontal overflow & compact laptop fit:
     - Reduced `#run` left sidebar width from `340px` to `300px` (`gap: 20px`) to give the right-hand cards more horizontal room.
     - Allowed `.ctrl-bar` to wrap gracefully (`flex-wrap: wrap`), added `white-space: nowrap` to `.pill`, `.timer`, `.seg span`, and `.btn-sm` (preventing multi-line pill distortion), and tightened `.guided-bar` (`min-width: 48px; max-width: 110px`).
     - Reduced sticky header height from 56px to 48px; set `.cam { top: 60px; }`; constrained camera video max-height to `210px`; compacted `#affectCard` (`.cam-affect`) with 82x82 circumplex SVG so `#affectCard`, `Summary`, `Export CSV`, and `Stop` sit completely visible above the fold.
     - Tightened `.hero-card` padding, reduced trend SVG viewBox to `0 0 600 140` (`H = 140`), and compacted Expression and Movement card rows (3.5px padding, 6px track height).
   - Added `#breatheModal` with interactive pattern tabs (`4-7-8 Relax`, `4-4-4-4 Box`, `5-5 Coherent`), animated radial gradient breathing orb (`#breatheOrb`), circular SVG countdown ring (`#breatheRingFg`), countdown seconds, and cycle counter.
5. `tests/ui.test.mjs`, `DATA_SCHEMA.md`, `VERSION.txt`, `launcher/`:
   - Added unit tests for `breathe.js` (cycle lengths, step progress, scaling, lifecycle) and `tensionOf` downward pitch attenuation.
   - Updated DOM ID contract check for all new breathing elements; updated `VERSION.txt` to `v0.7.9`; documented `breathe_active` and `down_look` in `DATA_SCHEMA.md`.
   - Updated `launcher/build.sh` and `.github/workflows/ci.yml` with `breathe.js`, synced assets to `launcher/site/`, and rebuilt `launcher/tempo-launcher`.

Checked: `node --check app.js ui.js hr.js affect.js voice.js chart.js summary.js stroop.js breathe.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (35 tests pass); `cd launcher && go build -trimpath -ldflags "-s -w" -o tempo-launcher .`.
Not checked: real multi-participant webcam study runs across diverse operating systems; hardware rPPG under varying lighting conditions; packaged native macOS universal bundle.

---

Changed
1. `stroop.js`:
   - 7-color pool with chromatic dissonance: expanded from 4 to 7 colors (`Red`, `Green`, `Blue`, `Yellow`, `Purple`, `Orange`, `Cyan`). Each color defines distinct `inkHex` (electric, high-saturation text display) vs `btnHex` (deeper matte button swatch), preventing subjects from resolving cognitive conflict via trivial RGB pixel matching.
   - Dynamic 4-color rotation: every trial randomly samples 4 colors from the pool to form the response buttons (`#stroopBtn1` to `#stroopBtn4`).
   - "None of the above" catch trials: ~20% of trials present an ink color chosen strictly from the 3 colors absent from the buttons, requiring the 5th option (`#stroopBtnNone`, keys `5`, `Space`, or `N`).
   - Cognitive interference calculation: calculates reaction time delay on incongruent trials (`interferenceMs = incongRt - congRt`), accuracy, and trial count.
   - Lifecycle manager `createStroopTest()`: handles 60 s countdown interval (`timerId.unref?.()`), trial transitions, response scoring, keyboard/click dispatch, and completion callbacks.
2. `app.js`:
   - Audio & Haptic sensory feedback & WebAudio lifecycle:
     - Reused a single shared `AudioContext` (`getSharedAudioCtx()`) across `chime()`, `playSweetChime()`, and `playHapticThud()` with `osc.onended` node disconnection, eliminating orphaned `AudioContext` instances and unclosed audio graph nodes.
     - Only instantiates `userAudioCtx` during setup when `use.voice` is enabled, and closes it cleanly if `getUserMedia` or model initialization fails.
     - Sweet success chime: synthesized ascending major triad arpeggio ($G_5 \to C_6 \to E_6$) via clientside Web Audio API with soft exponential decay.
     - Dual error feedback: `navigator.vibrate([40, 30, 40])` for mobile/haptic trackpads alongside a synthesized 75 Hz low-frequency audio click/thud fallback for desktop Mac users.
     - Green corner lighting: triggers `.correct-flare` on `#stroopWordBox`.
   - Dynamic Stroop trial rendering & modal cleanup: updates button labels, swatch colors, and click/keybindings dynamically per trial; resets live stats and animation classes on start; stops active Stroop timers when `#stroopModal` closes via `Escape` or backdrop click.
   - Session lifecycle & memory hygiene: tracks and cancels `rAFId` (`cancelAnimationFrame`) across `go()` and `stop()`, resets `lastT`, `fc`, `voice`, and expression/pose change rows on session restart, and exits Picture-in-Picture on `stop()`.
   - Biomechanical FACS Face Mesh: implemented `drawStressMesh(mcx, L, W, H, z, usePulse)` with chromatic AU4/AU7 heatmap, directional corrugator brow furrowing arrows, smile zygomatic pull vectors, and un-mirrored on-canvas HUD badge.
3. `index.html`:
   - Layout rebalancing: moved the Facial Affect circumplex card (`#affectCard`) and session action buttons (`#stop`, `#openSummary`, `#exp`) into the left `.cam` column below the video feed, transforming formerly empty space into a functional biosensor and control sidebar.
   - Stroop modal 5-button interface: updated `#stroopModal` with 4 dynamic color buttons (`#stroopBtn1`–`#stroopBtn4`) and a 5th full-width neutral button for "None of the above" (`#stroopBtnNone`).
   - Hero tension chart dimensions: updated trend SVG viewBox to `0 0 600 170` to reduce unnecessary vertical height on laptop screens.
   - Bumped module and stylesheet versions to `?v=0.7.8`.
4. `ui.js` & `voice.js` & `chart.js`:
   - `ui.js`: added `renderSummary()` rendering for `#sumStroop`, aligned `chart.js?v=0.7.8` import query string, and dispatched `close` event in `closeDialog` fallback so dialog close listeners always fire.
   - `voice.js`: disconnected `AnalyserNode` (`an.disconnect()`) and guarded `ctx.close()` promise rejection on `stop()`.
   - `chart.js`: updated trend SVG height `H = 170` (down from `220`), tightening vertical space while maintaining dynamic auto-scaling.
5. `styles.css`:
   - Stroop word box corner lighting: added `@keyframes cornerGreenGlow` with radial gradients strictly bounded within the 4 corners of `#stroopWordBox`.
   - Stroop error shake: added `@keyframes shakeErr` with red border flash.
   - 7-color button themes: added swatch styles for `.red`, `.green`, `.blue`, `.yellow`, `.purple`, `.orange`, `.cyan`, and neutral `.stroop-none-btn`.
   - Layout tightening: `.hero-card` padding reduced to `18px 22px 14px;`, `.card` padding to `16px 18px;`, `.row` padding to `5px 0;`. Added `.cam-affect` and `.cam-actions` rules, and fixed `.stroop-keys-guide` flex layout.
6. `tests/ui.test.mjs`, `.github/workflows/ci.yml`, `DATA_SCHEMA.md`, `VERSION.txt`, `launcher/`:
   - Updated Stroop tests to verify 7-color pool, chromatic dissonance between ink and button swatches, catch trial evaluation (`isNone`), hotkeys (`1-4`, `5`), `drawStressMesh`, and contract verification for all DOM IDs (including `stroopBtn1`–`stroopBtn4`).
   - Added `node --check stroop.js` to `.github/workflows/ci.yml`, documented `stroop_active` in `DATA_SCHEMA.md`, updated `VERSION.txt` to `v0.7.8`, and synced assets to `launcher/site/`.

Checked: `node --check app.js ui.js hr.js affect.js voice.js chart.js summary.js stroop.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (33 tests pass); `cd launcher && go build -trimpath -ldflags "-s -w" -o tempo-launcher .`.
Not checked: real multi-participant webcam study runs across diverse operating systems; hardware rPPG under varying lighting conditions; hardware trackpad haptic motor calls in locked-down browser environments; packaged `.dmg` macOS universal bundle.

---

## v0.7.7 update (2026-10-27): phase reminder mode, background worker clock, empirical tension weights, and Apple Health UI styling (feat/reminder-tension-health-ui)

Changed
1. `app.js`:
   - Tension weights refit: updated `TENSION = {browLower:.5, lidTight:1, lipTight:.8, lipDown:.3, browRaise:.2, eyeWide:.2, smile:-.4, expressivity:.1, blink:-.4, gaze:.2, headMove:.1}`. Eye tightening (`lidTight`) leads because it rose reliably across all three real stressor tests (`S01`, `S02`, `S03`); `browLower` weight is halved because downward gaze during mobile scrolling artificially lowered brows; `blink` weight is inverted to `-0.4` because cognitive load suppresses blink rate below baseline. Evaluated on 3 real sessions ($r = 1.0$ rank agreement with self-reported stress on `S03`).
   - Calibration cap removal: removed the artificial `0.14` cap on `browLower` median in `makeBase()` that had inflated baseline z-scores to $+2.34$ in `S03`.
   - Web Worker session clock: replaced main-thread `setInterval`/`rAF` polling with `createClock()` using an inline Web Worker. This prevents Safari and Chromium background tab throttling from pausing the stress counter when switching to Matiks or music.
   - Non-disruptive phase reminders: guided protocol is now a reminder rather than an auto-advance force. When the timer finishes, it plays a two-tone chime, displays a reminder toast, pulses the Check in button (`.nudge`), and updates the browser tab title (`⏰ Check in · Tempo`). The user switches phases when they are ready.
2. `index.html`:
   - Updated copy to "Phase reminders" (`#uGuided`).
   - Added Apple Health section headers (`.section-title`: "Highlights", "Changes from your baseline") and card header icons (`.htitle`).
   - Added Health tint classes (`.tint-indigo`, `.tint-pink`, `.tint-teal`, `.tint-purple`, `.tint-orange`, `.tint-green`).
   - Bumped asset query strings to `?v=0.7.7`.
3. `styles.css`:
   - Apple Health palette alignment: `--bg-l: #F2F2F7;`, `--accent-l: #007AFF;`, `--text2-l: #6C6C70;`, `--fill-l: #E5E5EA;`.
   - Card spacing and styling: added `.section-title`, `.htitle`, `.tint-*` card accent rules, `.rows` spacing, `.guided-bar[data-done="1"]` completion fill, and `.btn.nudge` pulse animation.
   - Live grid visibility fix: changed `body[data-stage=live] #live` to `display: grid;`.
4. `tests/ui.test.mjs`:
   - Updated `makeBase` test assertion to verify natural calibration median preservation.
5. `launcher/`:
   - Synced assets to `launcher/site/` and rebuilt `launcher/tempo-launcher`.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js && node --check summary.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (31 tests pass); `./launcher/tempo-launcher -h`; live session validation with `P001_S04` (443 rows, 7m33s, 100% facial feature coverage, perfect rank agreement with self-reported stress: Baseline -0.15 [2/10] -> Stressor +0.95 [7/10] -> Recovery -0.22 [2/10], both direction checks passed).
Not checked: real webcam runs across other hardware/participants; live speaker audio; packaged Windows app runs.

## v0.7.6 update (2026-10-27): guided study protocol, background execution, calibration bounds, signal tuning, and UI stabilization (feat/guided-study-protocol)

Changed
1. `index.html`: Added `#uGuided` toggle with `#guidedSecs` duration selector (60s, 90s, 120s); added camera Picture-in-Picture button `#btnPip`; added guided phase progress bar `#guidedBar` with `#guidedFill` in the top bar; replaced status element with `<div class="st-banner col-12" id="st" role="status"></div>`; bumped asset cache query to `?v=0.7.6`.
2. `styles.css`: Added `.st-banner` alert banner styles with `.st-banner:empty { display: none !important; }` to resolve text overlapping cards; added guided protocol controls (`.guided-opt`, `.guided-lbl`, `.guided-bar`, `.guided-fill`); added camera PiP button styling (`.cam-pip`); increased `.top` sticky header backdrop opacity to 92% with subtle shadow to eliminate scrolled card bleed-through; increased `.tiles-grid` minmax to 210px to eliminate awkward spacing above Expression card.
3. `app.js`:
   - Signal tuning: lowered blendshape floors (`lipDown: .002`, `lipTight: .004`, `eyeWide: .004`, `browRaise: .012`, `blink: 4.5`, `headMove: .18`, `sway: .08`) restoring movement to subtle facial cues; removed `blink` from `TENSION` (cognitive focus suppresses blinking, so low blink should not penalize stress); lowered `headMove` weight to 0.15.
   - Calibration caps: `makeBase` caps `browLower` median at 0.14 and `lidTight` at 0.28 (calculating MAD from raw median before capping) to prevent furrowed brows during setup from masking true stress; lowered `MIN_CAL_RPPG` to 8 clean windows for pulse/HRV baseline.
   - Display smoothing: added EMA smoothing (`zSmooth`, $\tau = 1.5$) to Expression and Pose bars to eliminate abrupt bar jumping.
   - HRV display hold: `show()` holds last valid HRV up to 10s (`lastHrv`, identical to `lastHr`).
   - Guided study protocol: tracks phase elapsed time against `guidedTargetS`, animates top progress bar, plays two-tone WebAudio chime, displays reminder toast, opens check-in drawer automatically at phase completion, and auto-advances phases (`baseline -> stressor -> recovery -> summary`).
   - Background execution: added 15 fps timer pump on `document.hidden` via `visibilitychange` to maintain feature collection when switching tabs/windows, alongside native Picture-in-Picture (`#btnPip`).
   - Setup protection: `#go` disables immediately with `'Starting...'` to prevent duplicate timer creation; clears existing intervals; pre-creates and resumes WebAudio `AudioContext` synchronously on user gesture and passes it to `createVoiceMonitor`.
   - Banner warning: `#st` checks only core face features (`browLower`, `lidTight`, `smile`, `expressivity`), eliminating spurious warnings for intermittent features like `fidget`, `hr`, and `hrv`.
4. `ui.js`: Lowered `hrvShown` quality gate to $q \ge 0.30$ and widened plausible RMSSD bounds to 15–200 ms.
5. `voice.js`: Lowered `MIN_RMS` from 0.012 to 0.004 to accommodate standard built-in laptop microphones; updated `createVoiceMonitor` to accept an existing unlocked `AudioContext`.
6. `launcher/`: Updated `launcher/site/` with latest web assets; rebuilt `launcher/tempo-launcher`.
7. `tests/ui.test.mjs`: Updated unit tests for `makeBase` calibration caps, rPPG sample threshold, and `hrvShown` gate.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js && node --check summary.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (31 tests pass); `./launcher/tempo-launcher -h`.
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.7.5 update (2026-10-26): real-time face landmark mesh, pulse ROIs overlay, and cross-branch audit/refactor (feat/face-points-overlay)

Changed
1. `index.html`: Added `#meshCv` overlay canvas and `#uMesh` switch toggle ("Show tracking points") in the camera card.
2. `styles.css`: Added `#meshCv` absolute positioning with matching `scaleX(-1)` mirror transform, `object-fit: cover`, and `.mesh-toggle` styling; fixed `dialog#summary` border token (`var(--line)`), added `@starting-style` and `transition-behavior: allow-discrete` entry/exit top-layer transitions, and fixed `#idxPulse.on` pulse ring selector.
3. `app.js`: Hoisted `MESH_PTS` to top-level constant; in `frame()`, renders facial landmark points and rPPG pulse ROIs when `#uMesh` is checked and clears `#meshCv` cleanly when unchecked, when the face leaves the frame, or when stopped; updated Triguna visual bar widths (`#b_sattva`, `#b_rajas`, `#b_tamas`) alongside percentage text; deduplicated window boundary checks in `tick()`; reset live UI state on session re-run; revoked temporary CSV Blob URLs on export; lazily initialized offscreen canvas context.
4. `ui.js`: Fixed `<dialog>` light-dismiss fallback (`setupDialogDismiss`) to check `if (e.target !== d) return;` and `'closedBy' in d` so keyboard/child button activations at `(0, 0)` never falsely dismiss the dialog; guarded `setRow` tooltip formatting when `raw` is missing; added Triguna phase breakdown and partial-recovery explanatory note to `renderSummary`.
5. `chart.js`: Synchronized `#trendStroke` gradient coordinates (`y1`, `y2`) and right-edge `#trendZones` labels with dynamic y-axis auto-ranging, and attached/disconnected `ResizeObserver` across `start()`/`stop()`/`reset()`.
6. `voice.js`: Resumed suspended `AudioContext` instances in `createVoiceMonitor`.
7. `tests/ui.test.mjs`: Added `b_sattva`, `b_rajas`, `b_tamas` to the DOM ID contract check, plus behavioral assertions for `setupDialogDismiss` child vs. backdrop clicks, `#trendZones`/`#trendStroke` updates, and partial-recovery summary notes.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js && node --check summary.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (31 tests pass); `python3 tools/make_synthetic.py signal data/sessions.csv && python3 train_guna.py`.
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.7.4 update (2026-10-26): session summary modal and PDF print layout (feat/session-summary)

Changed
1. `summary.js`: Added pure session statistical aggregation module with `phaseStats(log, reports, span = 60)` computing tension mean/peak, valence/arousal, pulse stats, and Triguna probabilities across session phases, and `directionChecks(stats)` verifying directional alignment between self-reported stress ratings and measured biometric tension.
2. `index.html`: Added `<dialog id="summary" closedby="any">` with `#sumTitle`, `#sumMeta`, `#sumPhases` (phase comparison cards), `#sumChart` (full session tension curve with check-in labels), `#sumChecks` (direction agreement checklist), print button `#sumPrint`, and footer trigger button `#openSummary`.
3. `styles.css`: Added Apple-style modal styling with blurred backdrop, responsive phase cards, and print styles (`@media print`) so "Save as PDF" produces a clean, slide-ready one-page presentation document.
4. `ui.js`: Implemented `openDialog`, `closeDialog`, `setupDialogDismiss` (including Safari click-outside fallback), and `renderSummary` rendering the SVG session chart, phase comparison cards, and direction checks.
5. `app.js`: Automatically triggers `showSummary()` when stopping a session that has at least one check-in, or on demand via `#openSummary`.
6. `launcher/build.sh` & `.github/workflows/ci.yml`: Added `summary.js` to build copy list and automated CI syntax checks.
7. `tests/ui.test.mjs`: Added unit tests for `phaseStats`, `directionChecks`, dead-band thresholding, missing report fallback, and `renderSummary` DOM elements.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js && node --check summary.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (31 tests pass).
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.7.3 update (2026-10-26): pulse tile with light coach, beating heart, and late HR baseline (feat/pulse-tile-light-coach)

Changed
1. `ui.js`: Added `lightOf(samples, now, spanMs)` to calculate mean facial skin luminance and red-to-green (R/G) ratio without storing image data, and `lightTip(light)` offering user guidance when face is dim (< 70) or lit with warm yellow LED (> 1.75) which attenuates green rPPG pulse signals.
2. `ui.js`: Added `hrView(last, now, holdS = 10)` to keep HR stable during momentary tracking drops (holds last value greyed up to 10 s with `#hrAgo` readout) and `hrvShown(hrv, q)` gating displayed HRV to plausible physiological windows (15–150 ms at spectral SNR $q \ge 0.45$).
3. `styles.css`: Added keyframed beating heart animation on `#hrHeart` synchronised with pulse period (`var(--beat)`), with reduced-motion fallback, and state styles for `data-state="live|held|none"`.
4. `index.html`: Added `#hrAgo` and `#lightTip` inside `#pulseBox`.
5. `app.js`: Connected `lightTip` to setup guidance and live pulse card; added late HR baseline acquisition in the `Baseline` phase if setup calibration missed the required 25 clean windows; logged `skin_luma`, `skin_rg`, and `hr_baseline_late` to session CSV exports.
6. `DATA_SCHEMA.md`: Documented `skin_luma`, `skin_rg`, and `hr_baseline_late` export columns.
7. `tests/ui.test.mjs`: Added unit tests for `lightOf`, `lightTip`, `hrView`, and `hrvShown`.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (30 tests pass).
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.
Note: Lighting thresholds (`DIM_LUMA = 70`, `WARM_RG = 1.75`) are initial empirical estimates and should be calibrated with further session recordings.

## v0.7.2 update (2026-10-26): 4 Hz fast live display track, zone hysteresis, and FPS readout (feat/fast-live-display)

Changed
1. `app.js`: Added a separate display-only fast track (`FAST_WIN_S = 4`, `LIVE_MS = 250`, `TAU_S = 1.2` s EMA) with its own baseline (`calFast` / `baseFast`) updating at 4 Hz (`liveTick()`). A sustained facial tension change now surfaces in ~1.5–3 s on screen instead of ~6–8 s, while leaving the scientifically consistent 10 s window and 1 Hz `tick()` logging completely intact.
2. `app.js` & `styles.css`: Implemented `zoneIdxOf(v, prev, margin = 0.1)` with boundary hysteresis to prevent word flicker at 4 Hz, styling `#stateWord` and `#stateNum` via `data-zone` tokens (`relaxed`, `base`, `up`, `high`).
3. `ui.js`: Extended `tweenNum` with an optional `fmt` formatter callback and immediate execution when `ms <= 0`.
4. `index.html` & `app.js`: Added camera FPS readout (`#fpsNum`) computed from recent frame buffer counts, and an animated affect circumplex dot position with fading trail history (`#afTrail`).
5. `DATA_SCHEMA.md`: Documented additive `tension_fast` export column.
6. `tests/ui.test.mjs`: Added unit tests for `zoneIdxOf` hysteresis, `makeBase` calibration filtering, `tensionOf` prior weighting, and `tweenNum` number formatting.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (29 tests pass).
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.7.1 update (2026-10-26): smooth zone-colored trend chart and phase markers (feat/trend-chart)

Changed
1. `chart.js`: Added an SVG trend chart renderer featuring monotone cubic spline interpolation (Fritsch-Carlson, preventing overshoot), dynamic auto-ranging (`niceRange`), multi-zone tinting (relaxed, baseline, elevated, high), and live rAF render loop capped at 30 fps.
2. `index.html`: Replaced flat static sparkline SVG with dynamic `#trend` SVG including gradient strokes, area fill under the curve, gridlines, phase region tints, check-in markers, and animated pulse ring on the active head indicator.
3. `app.js`: Integrated `createTrend` into live lifecycle (`show`, `go`, `stop`, phase change markers, and check-in score markers).
4. `launcher/build.sh` & `.github/workflows/ci.yml`: Added `chart.js` to build copy list and automated CI syntax checks.
5. `tests/ui.test.mjs`: Added unit tests verifying `chart.js` mathematical utilities (`zoneOf`, `niceRange`, `segments`, `smoothPath`, `ema`) and JSDOM SVG curve rendering.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js && node --check chart.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (28 tests pass).
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.7.0 update (2026-10-26): Apple-style design system and theme switcher (feat/ui-design-system)

Changed
1. `styles.css`: Created a dedicated stylesheet with an Apple-style design token system (SF Pro typography, light/dark semantic variables via `light-dark()` and media queries, subtle card depth, spring easing), extracting all inline CSS from `index.html`.
2. `index.html`: Refactored to an Apple Health / visionOS-inspired layout: sticky frosted-glass header with live/on-device badges, two-column consent hero with feature chips and iOS-style toggle switches, setup ring card with inset checks, and live bento grid layout with dedicated cards for pulse, affect circumplex, Triguna balance, expression, and movement.
3. `ui.js`: Added `nextScheme(stored, systemDark)` and `initTheme(btn)` for 2-state light/dark cycling that synchronizes `<meta name="color-scheme">` without FOUC; updated `setRow` to annotate change direction (`data-dir="up|down"`), and added `--control-value` tracking for range sliders.
4. `app.js` and `VERSION.txt`: Bumped project version to `v0.7.0`.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (26 tests pass).
Not checked: real webcam session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.6.6 update (2026-10-26): accurate description and fast startup for facial affect (fix/affect-honest-label)

Changed
1. `affect.js` exports `USE_ONNX = false` and skips unnecessary external ONNX CDN/model downloads during `initAffect()`, preventing startup delay and keeping affect inference 100% offline via MediaPipe blendshape action-unit projection.
2. `index.html` updates the researcher readout label to "Facial affect (FACS blendshape projection, unvalidated)", accurately reflecting that weights are hand-set priors on Action Units rather than fitted on AffectNet.
3. `DATA_SCHEMA.md` updates the description of `valence` and `arousal` columns to "hand-set FACS projection of MediaPipe blendshapes in [-1, 1], not validated on study participants".

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (25 tests pass).
Not checked: real browser session with camera; live speaker audio; packaged Mac/Windows app runs.

## v0.6.5 update (2026-10-26): launcher copies all loaded modules and models (fix/launcher-copy-modules)

Changed
1. `launcher/build.sh` copies `affect.js`, `voice.js` and `preset_models.json` into `site/` alongside `index.html`, `app.js`, `hr.js`, `ui.js`, preventing the packaged standalone app from failing due to missing ES module imports or demo model assets.
2. `.github/workflows/ci.yml` adds `node --check` validation for `affect.js` and `voice.js`.
3. `tests/ui.test.mjs` adds automated verification asserting that `launcher/build.sh` copies every local script and model asset imported by `app.js` or referenced in `index.html`.

Checked: `node --check app.js && node --check ui.js && node --check hr.js && node --check affect.js && node --check voice.js`; `node --test tests/ui.test.mjs tests/hr.test.mjs` (25 tests pass).
Not checked: full Go compilation via `launcher/build.sh`; running the resulting packaged binary on Mac, Linux, or Windows.

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
