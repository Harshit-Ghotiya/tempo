# Tempo explained, in plain language (for explaining it to your professor)

## One sentence
Tempo watches your face through the webcam, measures small muscle-like movements, compares them with your own calm baseline, and shows how far above or below that baseline your facial tension is. It all runs in the browser, so no video leaves the computer.

## The story in 60 seconds
- Problem: stress shows up in the face (frowning, pressed lips, tight eyes), but everyone's face is different.
- Idea: do not compare people with each other. Compare each person with their own calm minute.
- Method: measure facial movements, record a personal baseline, then report how far the current movements are from it.
- Honesty: the scoring weights come from published research, not from our own data yet. We built the tools to test and fit them once we collect data.

## How it works, step by step
1. **Camera and MediaPipe.** The browser opens the camera. Google's MediaPipe Face Landmarker, running inside the page, gives 478 face points and 52 "blendshape" scores (numbers from 0 to 1 for things like brow down, lip press, smile).
2. **Features (app.js).** We combine blendshapes into measures that echo FACS action units: brow lowering, brow raise, eye tightening, lip tightening, lip corners down, smile. We add blink rate, gaze movement, head motion and "facial movement" (how much the face moves overall).
3. **Windows.** Every second we summarise the last 10 seconds.
4. **Baseline.** The first 80 seconds are setup: 20 seconds to settle, 60 seconds of calibration. From calibration we store, per feature, the typical value (median) and the normal wobble (MAD, a robust spread). A minimum wobble is enforced so tiny numbers do not look extreme.
5. **z-scores.** For each feature: (now - typical) / normal wobble. +2 means "two normal wobbles above your own baseline".
6. **Facial tension index.** A weighted average of the z-scores (brow lowering, eye and lip tightening up; smiling down), smoothed, shown as words ("near your baseline", "somewhat above") with a 3-minute line. If the face is not visible, it says "not enough signal" instead of guessing.
7. **Check-ins.** At the end of each phase (baseline, stressor, recovery) the person rates stress and three Triguna feelings (0 to 10) with sliders that start untouched, so there is no default to anchor on. Windows from the last 60 seconds of that phase get that label; windows near a phase change or a hidden tab are dropped.
8. **Export and training.** The CSV goes to train_guna.py (Python). It tests models by leaving one participant out at a time, and compares them with two simple baselines: the average, and the average per phase.
9. **Packaging.** A small Go program serves the page on your own computer, carries MediaPipe inside it, and downloads the two model files once.

## Languages and what to open first
- JavaScript: app.js (capture, features, index), ui.js (screen helpers), hr.js (optional pulse), tests/. Runs in the browser.
- HTML and CSS: index.html (the whole look and layout).
- Python: train_guna.py (training and evaluation), tools/ (synthetic data, feature audit), launcher/package_macos.py.
- Go: launcher/main.go (the packaged app). Shell: launcher/*.sh (build scripts).
Reading order: index.html, then ui.js, then app.js (follow frame(), feats(), tick()), then train_guna.py (start at main()).

## Words to know
- **Blendshape:** a 0 to 1 score for one facial movement, estimated by a neural network.
- **Action unit (AU):** a named facial muscle movement in the FACS coding system. Ours are AU-like, not certified AUs.
- **Baseline:** your own calm reference. **z-score:** distance from it in "normal wobbles".
- **Leave-one-participant-out:** train on everyone except one person, test on that person, repeat. It stops the model memorising individuals.
- **Phase-mean baseline:** a predictor that only knows which phase (baseline, stressor, recovery) it is in. A model must beat it to show it explains more than "this is the stressor phase".

## Say these honestly before they ask
- The tension index weights are priors from the literature and are not validated. We have no real labelled stress data yet.
- It estimates facial tension relative to a person, not "stress" as a medical fact, and it is not a diagnosis. Facial expressions do not map cleanly to inner states (Barrett et al., 2019).
- Lighting, glasses, skin tone and camera quality can affect face tracking.
- The pulse module did not work on real faces and is optional and experimental. We plan to replace it with an existing library.
- The packaged apps were built and tested on Linux and in a headless browser, not yet on a real Mac or Windows PC.

## Likely questions and short answers
- **Why a webcam?** It is the one sensor everyone already has, and it needs no wearable.
- **Why compare with your own baseline?** Faces and habits differ a lot between people; the change within a person is more meaningful than the absolute value.
- **How do you know it works?** We do not yet. We have tests for the code, a plan for a stressor study, and an evaluation setup that checks results against simple baselines so we cannot fool ourselves.
- **What is the machine learning?** Simple models (weighted ridge and logistic regression) on a few features. With about 25 participants a large neural network would just memorise people. MediaPipe's own networks do the vision part.
- **Privacy?** Video is processed in the browser and never recorded or uploaded; only numbers are exported, and only when the user presses Export. Consent is explicit, per feature.
- **Where is the Indic perspective?** The Triguna framing (sattva, rajas, tamas) and the Yoga Sutra 1.31 link between mind and body (restlessness, breathing, dejection) are the conceptual layer. It is kept as a demo layer until the stress signal is validated.
- **What did you do yourselves?** Be specific: the idea, the protocol, running sessions, reading results, choosing what to claim. See the next section.

## Using AI help honestly
- Follow your course's rule on AI use and say plainly that Claude helped write the code. Then show you understand it.
- Be able to explain every file at the level of this guide. Practise: open the repo in Claude Code and say "quiz me on app.js, one question at a time, and correct me".
- Do not claim validation, accuracy numbers or a Mac test that you have not done.

## A 5-minute demo plan
1. One slide: the idea in one sentence and the privacy promise.
2. Run the app: consent, setup (point out the checks), then the live view; frown, press your lips, smile and watch the bars move.
3. Show a check-in and say what the label is used for.
4. Show the test results (19 tests) and the baseline comparison idea.
5. Finish with the honest limits and the next step (a real stressor study).
