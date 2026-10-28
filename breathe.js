// breathe.js: Guided breathing coach engine and protocols for Tempo Recovery phase.
// Implements 4-7-8 Relaxing Breath, 4-4-4-4 Box Breathing, and 5-5 Coherent Breathing.
// Pure math & state logic, fully testable in Node.

export const BREATHE_PATTERNS = {
  '4-7-8': {
    name: '4-7-8 Relaxing Breath',
    desc: 'Vagal stimulation: long exhalation triggers parasympathetic recovery.',
    steps: [
      { key: 'inhale', label: 'Breathe in', instruction: 'Inhale quietly through your nose', durS: 4, startScale: 1.0, endScale: 1.6 },
      { key: 'hold1',  label: 'Hold',       instruction: 'Hold your breath gently',          durS: 7, startScale: 1.6, endScale: 1.6 },
      { key: 'exhale', label: 'Exhale',     instruction: 'Exhale completely with a soft whoosh', durS: 8, startScale: 1.6, endScale: 1.0 }
    ]
  },
  'box': {
    name: '4-4-4-4 Box Breathing',
    desc: 'Tactical calm: equal breath ratios stabilize autonomic nervous system.',
    steps: [
      { key: 'inhale', label: 'Breathe in', instruction: 'Slowly inhale through your nose',   durS: 4, startScale: 1.0, endScale: 1.6 },
      { key: 'hold1',  label: 'Hold',       instruction: 'Hold breath with lungs full',       durS: 4, startScale: 1.6, endScale: 1.6 },
      { key: 'exhale', label: 'Exhale',     instruction: 'Smoothly exhale through your mouth',durS: 4, startScale: 1.6, endScale: 1.0 },
      { key: 'hold2',  label: 'Hold empty', instruction: 'Hold breath with lungs empty',      durS: 4, startScale: 1.0, endScale: 1.0 }
    ]
  },
  'coherent': {
    name: '5-5 Coherent Breathing',
    desc: 'Resonant frequency: 6 breaths/min maximizes Heart Rate Variability (HRV).',
    steps: [
      { key: 'inhale', label: 'Breathe in', instruction: 'Inhale steadily and deeply',        durS: 5, startScale: 1.0, endScale: 1.6 },
      { key: 'exhale', label: 'Exhale',     instruction: 'Release breath smoothly and evenly',durS: 5, startScale: 1.6, endScale: 1.0 }
    ]
  }
};

export function getPatternCycleS(patternKey = '4-7-8') {
  const p = BREATHE_PATTERNS[patternKey] || BREATHE_PATTERNS['4-7-8'];
  return p.steps.reduce((sum, s) => sum + s.durS, 0);
}

export function phaseAt(patternKey = '4-7-8', elapsedS = 0) {
  const p = BREATHE_PATTERNS[patternKey] || BREATHE_PATTERNS['4-7-8'];
  const cycleS = getPatternCycleS(patternKey);
  const cycle = Math.floor(elapsedS / cycleS);
  const posS = elapsedS % cycleS;

  let cumS = 0;
  for (let i = 0; i < p.steps.length; i++) {
    const step = p.steps[i];
    if (posS >= cumS && (posS < cumS + step.durS || i === p.steps.length - 1)) {
      const stepElapsed = Math.min(step.durS, posS - cumS);
      const stepRemainingS = Math.max(0, Math.ceil(step.durS - stepElapsed));
      const progress = step.durS > 0 ? stepElapsed / step.durS : 1;
      const scale = step.startScale + (step.endScale - step.startScale) * progress;
      return {
        patternKey,
        stepIndex: i,
        stepKey: step.key,
        label: step.label,
        instruction: step.instruction,
        stepDurS: step.durS,
        stepElapsedS: stepElapsed,
        stepRemainingS,
        progress,
        scale,
        cycle: cycle + 1
      };
    }
    cumS += step.durS;
  }
  return null;
}

export function createBreathingCoach({
  patternKey = '4-7-8',
  onTick,
  onPhaseChange,
  onFinish
} = {}) {
  let active = false;
  let currentPattern = patternKey;
  let startTime = 0;
  let lastStepIndex = -1;
  let timerId = null;

  function update() {
    if (!active) return;
    const now = performance.now();
    const elapsedS = (now - startTime) / 1e3;
    const info = phaseAt(currentPattern, elapsedS);
    if (!info) return;

    if (info.stepIndex !== lastStepIndex) {
      lastStepIndex = info.stepIndex;
      if (typeof onPhaseChange === 'function') onPhaseChange(info);
    }
    if (typeof onTick === 'function') onTick(info);
  }

  return {
    start(newPatternKey) {
      if (newPatternKey) currentPattern = newPatternKey;
      active = true;
      startTime = performance.now();
      lastStepIndex = -1;
      update();
      if (timerId) clearInterval(timerId);
      timerId = setInterval(update, 100);
      timerId.unref?.();
    },
    setPattern(key) {
      if (BREATHE_PATTERNS[key]) {
        currentPattern = key;
        lastStepIndex = -1;
        if (active) update();
      }
    },
    getPattern() {
      return currentPattern;
    },
    stop() {
      if (!active) return;
      active = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      const totalElapsedS = (performance.now() - startTime) / 1e3;
      const cycles = Math.floor(totalElapsedS / getPatternCycleS(currentPattern));
      const summary = {
        patternKey: currentPattern,
        patternName: BREATHE_PATTERNS[currentPattern]?.name || currentPattern,
        durationS: Math.round(totalElapsedS),
        cyclesCompleted: cycles
      };
      if (typeof onFinish === 'function') onFinish(summary);
      return summary;
    },
    isActive() {
      return active;
    }
  };
}
