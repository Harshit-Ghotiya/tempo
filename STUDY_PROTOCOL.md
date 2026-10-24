# Minimal pilot protocol (v0.3)

Self-reports are retrospective. Each one rates the last minute and labels only windows inside the phase being reported.

1. Use opaque participant and session IDs (e.g. P001, S01).
2. Obtain consent under the approved procedure. Tick only the signals the participant agrees to provide.
3. Start. Setup runs automatically: 20 s of settling in (sit comfortably, face the screen), then 60 s of calibration (stay still, breathe normally). Setup windows are never used for training. Total about 80 s.
4. Stay in `baseline` for about 90 more seconds, still sitting quietly. Then save the baseline self-report. It labels the last 60 s of this phase.
5. Switch the phase to `stressor` and run the predefined task for at least 90 s. Save the self-report at the END of the task, while the phase still reads `stressor`.
6. Switch to `recovery` and run it for at least 90 s. Save the self-report at the END, while the phase still reads `recovery`.
7. Stop, then Export CSV. The message under the self-report panel states how many labelled windows were exported. Zero means a report was saved too early, or the phase was changed before saving.

Rules:
- Never change the phase before saving that phase's report.
- The first 30 s after any phase change cannot be labelled, because features look back up to 30 s. Each phase therefore needs at least 90 s.
- Keep the portal tab in the foreground. Any tab switch makes the next 30 s unusable.
- The rating boxes start blank on purpose. Fill in all four (0-10) before saving.
- Fix and write down the stressor task and the collection conditions before collecting data.
- Light your face evenly from the front, with no strong window behind you.
- Do not talk during setup or the baseline: speech moves the mouth and confuses the lip features. If a stressor needs speech, run it as its own tagged phase.
- Suggested stressor: a 3 minute Stroop colour-word task or serial subtraction with a visible timer. Use the same one for everyone.
- Ratings are the supervised target. They are not objective measurements of Sattva, Rajas, Tamas or stress.
