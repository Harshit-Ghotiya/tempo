// stroop.js: Standardized Stroop Color-Word cognitive stressor engine and trial generator.
// Evaluates cognitive interference (reaction time delay on incongruent trials) and mental effort.

export const STROOP_COLORS = [
  { name: 'Red', hex: '#FF3B30', key: 'r', num: '1', arrow: 'ArrowLeft' },
  { name: 'Green', hex: '#34C759', key: 'g', num: '2', arrow: 'ArrowUp' },
  { name: 'Blue', hex: '#007AFF', key: 'b', num: '3', arrow: 'ArrowDown' },
  { name: 'Yellow', hex: '#FFCC00', key: 'y', num: '4', arrow: 'ArrowRight' }
];

export function generateTrial(congruentRatio = 0.25) {
  const isCongruent = Math.random() < congruentRatio;
  const wordIdx = Math.floor(Math.random() * STROOP_COLORS.length);
  const word = STROOP_COLORS[wordIdx].name;
  let colorIdx;
  if (isCongruent) {
    colorIdx = wordIdx;
  } else {
    // Pick a different color
    const others = [0, 1, 2, 3].filter(i => i !== wordIdx);
    colorIdx = others[Math.floor(Math.random() * others.length)];
  }
  const color = STROOP_COLORS[colorIdx];
  return {
    word,
    colorName: color.name,
    colorHex: color.hex,
    isCongruent,
    presentedAt: performance.now()
  };
}

export function evaluateResponse(trial, chosenName, answeredAt = performance.now()) {
  const rtMs = Math.max(0, Math.round(answeredAt - (trial.presentedAt || answeredAt)));
  const ok = trial.colorName.toLowerCase() === (chosenName || '').toLowerCase();
  return {
    word: trial.word,
    colorName: trial.colorName,
    chosenName,
    ok,
    rtMs,
    isCongruent: trial.isCongruent
  };
}

export function aggregateStroop(results = []) {
  if (!results.length) {
    return {
      trials: 0,
      correct: 0,
      accuracy: 0,
      meanRtMs: 0,
      congruentMeanRtMs: 0,
      incongruentMeanRtMs: 0,
      interferenceMs: 0,
      score: 0
    };
  }
  const valid = results.filter(r => r.rtMs >= 150 && r.rtMs <= 3000);
  const dataset = valid.length ? valid : results;
  const correctTrials = dataset.filter(r => r.ok);
  const correct = correctTrials.length;
  const accuracy = Math.round((correct / dataset.length) * 100);

  const mean = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
  const meanRtMs = mean(correctTrials.map(r => r.rtMs));
  const congRt = mean(correctTrials.filter(r => r.isCongruent).map(r => r.rtMs));
  const incongRt = mean(correctTrials.filter(r => !r.isCongruent).map(r => r.rtMs));
  const interferenceMs = (congRt > 0 && incongRt > 0) ? Math.max(0, incongRt - congRt) : 0;
  const score = Math.max(0, correct * 10 - (dataset.length - correct) * 5);

  return {
    trials: dataset.length,
    correct,
    accuracy,
    meanRtMs,
    congruentMeanRtMs: congRt,
    incongruentMeanRtMs: incongRt,
    interferenceMs,
    score
  };
}

export function createStroopTest({
  durationS = 60,
  onTrial,
  onTick,
  onFinish
} = {}) {
  let active = false;
  let timerId = null;
  let currentTrial = null;
  const results = [];
  let remainingS = durationS;
  let startTime = 0;

  function next() {
    if (!active) return;
    currentTrial = generateTrial();
    if (typeof onTrial === 'function') onTrial(currentTrial, results.length);
  }

  return {
    start() {
      if (active) return;
      active = true;
      results.length = 0;
      remainingS = durationS;
      startTime = performance.now();
      next();

      if (typeof onTick === 'function') onTick(remainingS, durationS);
      timerId = setInterval(() => {
        remainingS--;
        if (typeof onTick === 'function') onTick(remainingS, durationS);
        if (remainingS <= 0) {
          this.stop();
        }
      }, 1000);
    },

    answer(colorName) {
      if (!active || !currentTrial) return null;
      const res = evaluateResponse(currentTrial, colorName);
      results.push(res);
      next();
      return res;
    },

    handleKey(e) {
      if (!active || !currentTrial) return null;
      const key = e.key.toLowerCase();
      const match = STROOP_COLORS.find(c =>
        c.key === key ||
        c.num === key ||
        c.arrow.toLowerCase() === key ||
        c.name.toLowerCase() === key
      );
      if (match) {
        e.preventDefault?.();
        return this.answer(match.name);
      }
      return null;
    },

    stop() {
      if (!active) return aggregateStroop(results);
      active = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      currentTrial = null;
      const summary = aggregateStroop(results);
      if (typeof onFinish === 'function') onFinish(summary);
      return summary;
    },

    isActive() {
      return active;
    },

    getResults() {
      return [...results];
    }
  };
}
