# Tempo: briefing for Claude

## What this is
Tempo is an on-device webcam tool that estimates stress from facial expression, compared with each person's own baseline.
It is a group project for IKO 103 (Holistic Wellbeing, Indic perspective) at IIT Roorkee.
Core goal: stress detection. Triguna is a demo layer added last (DEMO_GUNA in app.js). Pulse and HRV are optional and experimental.

## Rules (do not break these)
- Privacy: video never leaves the browser and is never recorded, stored or uploaded. Only derived numbers are exported, and only when the user presses Export.
- Never commit participant data (CSV exports, artifacts). data/ and artifacts/ are git-ignored. No keys or tokens in the repo.
- Report model results against BOTH baselines (constant and phase-mean). Read vs_phase first. Stress targets are primary, Guna is secondary.
- The tension index weights are unvalidated priors. Never describe them as validated.
- Say plainly what was not tested (real faces, real Mac and Windows runs, real stress data).
- Run the tests before saying a change works. If a test fails, fix it or say so.

## Commands
- Install and test the portal: `npm ci`, then `node --test tests/ui.test.mjs tests/hr.test.mjs`
- Syntax check: `node --check app.js` (repeat for ui.js and hr.js)
- Trainer on synthetic data: `mkdir -p data && python tools/make_synthetic.py signal data/sessions.csv && python train_guna.py`
- Audit a real session: `python tools/audit_features.py <session.csv>`
- Run the portal while developing: `python3 -m http.server 8000`, then open http://localhost:8000
- Build the packaged apps: `cd launcher && sh build.sh` (macOS: then `python3 package_macos.py`, see launcher/README.md)

## Where things are
- index.html, ui.js: interface. app.js: camera, features, tension index, export. hr.js: optional pulse.
- train_guna.py: training and evaluation. tools/: synthetic data, feature audit. launcher/: builds the apps. tests/: automated checks.
- HANDOFF.md: history and current state (newest block first). ROADMAP.md: plan and sources. DATA_SCHEMA.md and STUDY_PROTOCOL.md: data columns and how to run a session.

## How to work here
- One change per branch and pull request. Keep changes small.
- If you rename an element id, run tests/ui.test.mjs: it checks every id the scripts use exists in index.html.
- When behaviour changes, add a block at the top of HANDOFF.md and update DATA_SCHEMA.md if columns change.
- Plain, simple language in anything the team reads.

## Open work
See the GitHub issues. Known problem: pulse is not detected on real faces (hr.js passed synthetic tests only).
