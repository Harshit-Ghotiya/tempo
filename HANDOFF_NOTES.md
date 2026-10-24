# HANDOFF_NOTES.md: Tempo, project version v0.6

Plain starting point for the next developer. It records only what was checked during this handoff. After it, read CLAUDE.md (rules and commands), then HANDOFF.md (full history, newest block first), ROADMAP.md and docs/FIRST_ISSUES.md.

## 1. What Tempo does
Tempo is an on-device webcam tool built for a group course project (IKO 103, IIT Roorkee). In the browser it runs MediaPipe Face Landmarker (and optionally Pose Landmarker), turns the 52 blendshape scores into facial features, compares them with the person's own 80-second baseline, and shows a "facial tension" readout. At the end of each phase (baseline, stressor, recovery) the person gives 0 to 10 ratings; the page exports a CSV. A Python trainer evaluates models on such CSVs. A small Go program packages the page as a one-click app per platform. Video is never recorded or uploaded; only derived numbers are exported, when the user presses Export.

## 2. State at handoff
A research prototype. Everything runs, but there is NO real labelled stress data, so nothing about accuracy is known. The tension index uses literature-based prior weights that are not fitted or validated.

Complete (code exists and the automated tests below pass):
- Face-first features, baseline with minimum spreads, tension index, redesigned interface, check-in sliders, retrospective labelling, CSV export (app.js, ui.js, index.html).
- Trainer with stress targets first, constant and phase-mean baselines, participant-level bootstrap intervals, optional permutation test, fusion, models.json export (train_guna.py).
- Synthetic data generator and feature audit tool (tools/).
- Optional pulse module with synthetic-signal tests (hr.js, tests/hr.test.mjs).
- Go launcher: embeds the page and MediaPipe, caches the two model files after a first download, one instance at a time, quits about 3 minutes after the page closes (launcher/main.go); build scripts; macOS packaging script (launcher/package_macos.py).
- CI workflow file (.github/workflows/ci.yml), CLAUDE.md, AGENTS.md, docs.

Remaining (see docs/FIRST_ISSUES.md and ROADMAP.md):
1. Pulse is not detected on real faces. Replace hr.js with a maintained library that gives heart rate and HRV (open-rppg was the candidate; its licence was confirmed MIT on its PyPI page, the licences of rPPG-Toolbox and pyVHR were NOT confirmed). Not started.
2. One real stressor session per teammate, then run tools/audit_features.py.
3. Posed-expression audit against an action-unit toolkit (OpenFace 3.0 or LibreFace). Not started.
4. Run the packaged apps on a real Mac and a real Windows PC.
5. Make the page load a trained model (train_guna.py writes models.json; the page does not read it).
6. Fit the tension index weights once there is data (read vs_phase first).
7. Ethics and consent check before collecting from others.
8. Later: keyboard and mouse dynamics; offline voice modality (only a hook, window.setVoice, exists); the Triguna demo layer (DEMO_GUNA = false in app.js).

## 3. Known problems and decisions
Known problems
- Pulse: the user reported it is not detected. hr.js was only ever tested on synthetic signals; it is built to say "no estimate" rather than guess, so a real webcam likely gives none. Cause on real faces was not investigated.
- macOS: the user said the earlier bare macOS binary did not work. The cause was not diagnosed (hypotheses only: lost executable permission, wrong architecture, Apple silicon requiring a signature). It was replaced by a universal, ad-hoc-signed Tempo.app in a zip. That app has not been run on a real Mac and is not notarised, so macOS needs a one-time approval.
- The two model files (face_landmarker.task, pose_landmarker_lite.task) are not bundled. They download once from Google's MediaPipe host on first run. That real download was never exercised (the host was blocked in the build sandbox); it was only tested against a local stand-in server.
- HANDOFF.md sections 1 to 18 are the older v0.2-era text with newer blocks added on top. Where they conflict, the newest block wins. Parts are historical (for example, Priorities 1 and 2 in section 12 are done).
- tools/audit_features.py prints an empty table on the synthetic CSV (it reads raw feature columns; the synthetic file only has z_ columns). It works on real exports.
- requirements.txt is not pinned. The CI workflow has never run on GitHub.
- Checks done in earlier sessions used scripts kept in a temporary folder that no longer exists (headless-browser run, launcher integration script). They are not in this ZIP.

Decisions so far
- Face expression first. Pulse and HRV are optional and experimental; keyboard and mouse tracking come later; Triguna is a demo layer added last.
- Stress targets are primary (stress_abs, stress_delta = change from the person's own baseline report). Always read vs_phase: the phase-mean baseline is told the phase.
- Evaluation is leave-one-participant-out, with each participant and each report weighted equally; intervals come from resampling participants.
- Labels are retrospective: a check-in labels windows from the last 60 s of its own phase, and windows within 30 s of a phase change or a hidden tab are dropped. Sliders count only once touched.
- Setup is 20 s settle plus 60 s calibration; the baseline is median and MAD with a minimum spread per feature (FLOOR in app.js).
- No vision transformer for now: about 3 independent labels per participant, and image models would need stored face data. See HANDOFF.md.
- Models are downloaded from the official host, not bundled, because the only copy found in the build sandbox was inside an unrelated third-party package and could not be verified.
- The page talks only to the launcher on this computer; the launcher listens on loopback only.

## 4. Git status
- No .git folder exists in the project folder I had access to (/home/claude/tempo), so there is no repository, no branch, no remote and no working-tree status to report. I did not create a repository or push anything. No Git history is included.
- Whether the user has a local clone or a GitHub repository on their own computer was not visible to me and is unknown. If one exists, compare it with this ZIP before merging.
- This folder was the "repo-ready" copy prepared earlier: it contains .gitignore (blocks data/, artifacts/, *.csv, build output, secrets) and CI. To start a repo: unzip, cd tempo, git init -b main, git add ., git commit.

## 5. Tests run during this handoff (exact)
Environment: Node v22.22.2, Python 3.12.3, numpy 2.4.4, pandas 3.0.2, scipy 1.17.1, scikit-learn 1.8.0, Go 1.22.2. All run in a scratch copy of this folder.
- npm ci: added 36 packages.
- node --check app.js, ui.js, hr.js: all ok.
- node --test tests/ui.test.mjs tests/hr.test.mjs: 19 tests, 19 pass, 0 fail (8 interface tests: every element id used by the scripts exists in index.html, plus helper behaviour in a simulated DOM; 11 pulse tests on synthetic signals).
- python -m py_compile train_guna.py tools/make_synthetic.py tools/audit_features.py launcher/package_macos.py: ok.
- Trainer on synthetic data, both "signal" and "null" modes: exit code 0, "Loaded 1800 windows from 20 participants and 60 self-reports", results saved. This shows the code runs; it says nothing about real performance.
- tools/audit_features.py on the real v0.4 session export (file not included): exit code 0.
- .github/workflows/ci.yml parsed with PyYAML: parses. (Not run on GitHub.)
- Launcher: go vet ok; linux/amd64 built (24.8 MB); windows/amd64, darwin/arm64 and darwin/amd64 compiled (not run). The Linux build served / (200 html), /app.js (200, identical to source), the MediaPipe WASM (200, application/wasm, 9,423,986 bytes) and /__tempo, and quit by itself after its idle limit.

Done in earlier sessions, NOT re-run now (results as recorded then): a headless Chromium run with a fake camera reached the setup stage and made no external requests (it used a third-party copy of the face model purely as a local test fixture, which is not shipped); launcher model-cache, single-instance and idle-exit checks against a local stand-in server; inspection of the macOS app bundle (both architectures present, ad-hoc signature present, executable permission kept in the zip).

NOT tested at all: face detection and the tension index on real faces in the packaged app (the one real session available was setup plus baseline only, with no labels); any real stress data; pulse accuracy on real faces; any run on a real Mac or Windows PC; the real model download from Google; Safari and Firefox; consent flow with real participants; the GitHub Actions workflow; keyboard and mouse tracking (not built).

## 6. Install, run, test
- Needs: Node 22 (CI uses 22), npm, Python 3.12, and for the apps Go 1.20+.
- Test the page: npm ci, then node --test tests/ui.test.mjs tests/hr.test.mjs
- Trainer: pip install -r requirements.txt, then mkdir -p data, python tools/make_synthetic.py signal data/sessions.csv, python train_guna.py. For real data: python train_guna.py --data path/to/sessions.csv --permutations 200
- Run the page while developing: python3 -m http.server 8000, open http://localhost:8000 (needs internet: MediaPipe comes from a CDN and the models from Google's host).
- Build the apps: cd launcher, sh build.sh (fetches MediaPipe Tasks Vision 0.10.14 JS and WASM from npm, Apache-2.0, then builds four programs into launcher/dist). For macOS then run RCODESIGN=/path/to/rcodesign python3 package_macos.py (rcodesign is apple-codesign 0.29.0 from github.com/indygreg/apple-platform-rs releases; not included). The zips users receive were assembled by hand: put Tempo.app (or Tempo.exe, or the Linux program) plus the matching text from launcher/readme/ (saved as "READ ME FIRST.txt") in a folder and zip it with zip -ry. Those three texts were copied verbatim from the built zips during this handoff.

## 7. What is in and out of this ZIP
Included: all source, tests, docs, build scripts, CI file, package.json and package-lock.json, requirements.txt, launcher/go.mod, launcher/readme/*.txt, MANIFEST.sha256 (SHA-256 of every other file).
Excluded on purpose: participant data and CSV exports (including the real session file), data/, artifacts/, secrets (none found), node_modules, caches, launcher/dist, launcher/site (generated), the built apps (Tempo-macOS.zip, Tempo-Windows.zip, Tempo-Linux.zip, kept separately), any Git history.
Not shareable or not present: the two MediaPipe model files are not included (get them via the first run of the launcher, or from Google's MediaPipe model host). MediaPipe's JS and WASM are Apache-2.0 and are fetched by launcher/fetch_vendor.sh instead of being copied in.

## 8. Comparison with tempo_code_bundle.txt (the earlier backup)
27 of the 27 files in the bundle are identical to the current files (its HANDOFF.md is a deliberately shortened copy). The bundle does NOT contain launcher/go.mod, package-lock.json, VERSION.txt or docs/EXPLAINER.md, so it cannot rebuild the launcher or reproduce the npm install. Use this ZIP instead.
