# Tempo: on-device stress-signal portal (v0.6)

Run the packaged app: Tempo-macOS.zip, Tempo-Windows.zip or Tempo-Linux.zip. Each has a READ ME FIRST.txt.
Develop: serve this folder (python3 -m http.server 8000) and open http://localhost:8000. Without the launcher, MediaPipe loads from a CDN and the models from Google's host.

Files: index.html and ui.js (interface), app.js (capture, features, tension index, export), hr.js (optional pulse),
train_guna.py (training and evaluation), tools/ (synthetic data, feature audit), launcher/ (builds the packaged apps), tests/.

Train: pip install -r requirements.txt, then python train_guna.py --permutations 200
  Primary: stress_abs and stress_delta (change from the participant's own baseline report). Read vs_phase first:
  the phase-mean baseline is told the phase, so only a model that goes below it explains more than "this is the stressor phase".
  Secondary: the Guna composition for the course demo. Fewer than 10 participants: intervals are not meaningful.
  Harness check: python tools/make_synthetic.py signal data/sessions.csv (then null).
Audit a session: python tools/audit_features.py session.csv
Tests: npm i, then node --test tests/ui.test.mjs tests/hr.test.mjs
Build the apps: cd launcher && sh build.sh; for macOS then RCODESIGN=/path/to/rcodesign python3 package_macos.py

Read HANDOFF.md before changing anything, and ROADMAP.md for the plan and sources.
