// stroop.js: Standardized Stroop Color-Word cognitive stressor engine and trial generator.
// Uses a 7-color high-contrast palette (Red, Green, Blue, Yellow, Purple, Orange, Pink)
// with chromatic dissonance (distinct inkHex vs button swatch btnHex) and 4 dynamically rotating response buttons.

export const STROOP_COLORS = [
  { name: 'Red',    inkHex: '#FF453A', btnHex: '#D70015', key: 'r', class: 'red' },
  { name: 'Green',  inkHex: '#30D158', btnHex: '#248A3D', key: 'g', class: 'green' },
  { name: 'Blue',   inkHex: '#409CFF', btnHex: '#0051D5', key: 'b', class: 'blue' },
  { name: 'Yellow', inkHex: '#FFD60A', btnHex: '#CC8800', key: 'y', class: 'yellow' },
  { name: 'Purple', inkHex: '#D97BFF', btnHex: '#7B2CBF', key: 'p', class: 'purple' },
  { name: 'Orange', inkHex: '#FF9F0A', btnHex: '#C96800', key: 'o', class: 'orange' },
  { name: 'Pink',   inkHex: '#FF375F', btnHex: '#C2185B', key: 'k', class: 'pink' }
];

// Backward-compatibility hex alias
STROOP_COLORS.forEach(c => { c.hex = c.btnHex; });

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateTrial(congruentRatio = 0.25) {
  // 1. Sample 4 rotating button options from the 7-color pool
  const buttonOptions = shuffle(STROOP_COLORS).slice(0, 4);

  // 2. Target ink color is always one of the 4 displayed options
  const targetColor = buttonOptions[Math.floor(Math.random() * buttonOptions.length)];
  const isCongruent = Math.random() < congruentRatio;
  let word;
  if (isCongruent) {
    word = targetColor.name;
  } else {
    const otherNames = STROOP_COLORS.filter(c => c.name !== targetColor.name).map(c => c.name);
    word = otherNames[Math.floor(Math.random() * otherNames.length)];
  }

  return {
    word,
    colorName: targetColor.name,
    inkHex: targetColor.inkHex,
    colorHex: targetColor.inkHex,
    btnHex: targetColor.btnHex,
    buttonOptions,
    isCongruent,
    presentedAt: performance.now()
  };
}

export function evaluateResponse(trial, chosenName, answeredAt = performance.now()) {
  const rtMs = Math.max(0, Math.round(answeredAt - (trial.presentedAt || answeredAt)));
  const norm = s => (s || '').toLowerCase().trim();
  const ok = norm(chosenName) === norm(trial.colorName);

  return {
    word: trial.word,
    colorName: trial.colorName,
    chosenName,
    ok,
    rtMs,
    isCongruent: !!trial.isCongruent
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
      next();

      if (typeof onTick === 'function') onTick(remainingS, durationS);
      timerId = setInterval(() => {
        remainingS--;
        if (typeof onTick === 'function') onTick(remainingS, durationS);
        if (remainingS <= 0) {
          this.stop();
        }
      }, 1000);
      timerId.unref?.();
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
      const key = (e.key || '').toLowerCase();
      // Keys 1-4 map directly to the 4 rotating response buttons
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = Number(key) - 1;
        if (currentTrial.buttonOptions && currentTrial.buttonOptions[idx]) {
          e.preventDefault?.();
          return this.answer(currentTrial.buttonOptions[idx].name);
        }
      }
      // First-letter hotkey fallback for currently displayed options
      const match = currentTrial.buttonOptions?.find(c => c.key === key || c.name.toLowerCase() === key);
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

    getCurrentTrial() {
      return currentTrial;
    },

    getResults() {
      return [...results];
    }
  };
}
