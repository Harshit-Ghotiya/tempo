# First GitHub issues (copy each into a new issue)

1. **Pulse is not detected on real faces: replace hr.js with a maintained library**
   hr.js only passed synthetic tests and says "no estimate" on real webcams. Evaluate open-rppg (MIT, gives HR and HRV) first. Decide how it runs (offline on recorded clips, a local helper process, or an export of the face-colour trace). Show HR and HRV beside the other parameters, labelled experimental. Done when: HR is within 5 bpm of a fingertip oximeter in most good-quality windows on 5+ people.

2. **One real stressor session per teammate**
   Follow STUDY_PROTOCOL.md (settle, calibration, baseline, stressor, recovery, three check-ins). Send the CSV to the maintainer, then run `python tools/audit_features.py` on each. Never commit the CSVs.

3. **Posed-expression audit**
   Record short clips (neutral, brow furrow, brow raise, lip press, eye squeeze, smile). Compare our blendshape composites with action units from OpenFace 3.0 or LibreFace. Target: rank correlation of at least 0.6 on matching pairs.

4. **Test the packaged apps on a real Mac and a real Windows PC**
   Follow the READ ME FIRST in each zip. Report what happened, with the log file (tempo.log) and any message.

5. **Load a trained model in the portal**
   train_guna.py writes models.json; the portal does not read it yet.

6. **Replace the tension index priors with fitted weights**
   After 20+ participants: fit stress_delta, read vs_phase first.

7. **Ethics and consent check before collecting from others**
   Confirm instructor approval and a DPDP-ready consent text.

8. **Later: keyboard and mouse dynamics as a second channel**
