# Roadmap: from a Triguna demo to a robust stress tracker (written 2026-10-05, re-scoped 2026-10-11 to put facial expression first)

## Principles
- Report three layers separately, each against the person's own baseline: physiology (heart rate, later HRV), facial expression (action units, blinks, gaze) and behaviour (posture, movement, later keyboard and mouse). Self-report is a fourth, separate layer. Do not collapse them into one score until a model has earned it.
- Say which stress label a model predicts (self-reported, observer-rated or physiological). In one Trier Social Stress Test study, face models tracked observer and self-report only modestly and did not predict cortisol.
- Validate leave-one-participant-out, against constant and phase-mean baselines, with intervals from resampling participants.
- Abstain when signal quality is low. Triguna is a presentation layer added last.

## Phases
0. Done (v0.5): robust heart rate, settle period, robust baseline, Triguna hidden.
1. Done (v0.6): face-first features, baseline floors, facial tension index (prior weights), redesigned portal, packaged apps, stress-first trainer with a phase baseline.
2. Next, weeks 1-3, facial-expression validity: (a) one real stressor session per teammate (Stroop or serial subtraction, three check-ins) and tools/audit_features.py on each; (b) posed-expression audit: record clips of neutral, brow furrow, brow raise, lip press, eye squeeze and smile, then compare the blendshape composites with action units from OpenFace 3.0 or LibreFace (target: rank correlation of at least 0.6 on the matching pairs); (c) decide which features survive.
3. Weeks 3-6, benchmark: StressID and UBFC-Phys video under leave-one-participant-out; choose models by their interval against the constant and phase-mean baselines; stress_delta is the headline.
4. Weeks 6-10, own study: 40-60 people; speech, arithmetic and Stroop tasks; repeated sessions; state ratings plus PSS; per-person calibration; abstention when quality is low.
5. Weeks 10-14, product: load the trained model in the portal, trend view, DPDP-ready consent, then keyboard and mouse dynamics as a second channel, small pilot.
6. Last: map the validated signals to Triguna for the course demo.
Pulse and HRV are optional and experimental: revisit only with extra equipment or a validated method.

## Transformers and other recent models
- rPPG: PhysFormer, RhythmFormer and newer state-space models such as FacePhys are worth testing offline against POS on UBFC-Phys and StressID video, judged by heart-rate error rather than stress accuracy. Deep rPPG overfits the heart-rate range it trained on, so use temporal augmentation.
- Stress classifier: stay with small interpretable models until there are many more participants. Zero-shot multimodal LLMs are annotators at best.

## Legal
- India DPDP: core duties enforceable from May 2027; consent must be specific and as easy to withdraw as to give; the child threshold is 18.
- EU AI Act: emotion inference in workplaces and educational institutions is prohibited and workplace stress monitoring is not treated as medical use. Keep any EU use individual and opt-in, with no institution dashboards.

## Sources
- StressID (NeurIPS 2023): https://project.inria.fr/stressid/
- UBFC-Phys: https://doi.org/10.25666/dataubfc-2022-05-05
- Norden et al., ACII 2022, stress label and video models: https://www.uni-bielefeld.de/fakultaeten/technische-fakultaet/arbeitsgruppen/human-centered-artificial-intelligence/publications/ACII2022_36_MultidimensionalStressDetection_final.pdf
- Wearable stress detection review, Dec 2025: https://doi.org/10.31937/ti.v17i2.4488
- rPPG stress index validation, Healthcare 2026: https://doi.org/10.3390/healthcare14131893
- RhythmFormer: https://arxiv.org/abs/2402.12788
- FacePhys: https://arxiv.org/abs/2512.06275
- Generalisation in rPPG: https://arxiv.org/abs/2305.15199
- rPPG-Toolbox: https://github.com/ubicomplab/rPPG-Toolbox
- OpenFace 3.0: https://arxiv.org/abs/2506.02891
- LibreFace: https://arxiv.org/abs/2308.10713
- Keyboard and mouse dynamics: https://iris.polito.it/handle/11583/2855160
- EU AI Act emotion-recognition prohibition: https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/
- DPDP key dates: https://dpdp.myndsolution.com/wiki/guides/key-dates-and-commencement/
