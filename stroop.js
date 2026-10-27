// stroop.js: Standardized Stroop Color-Word cognitive stressor engine and trial generator.
// Evaluates cognitive interference (reaction time delay on incongruent trials), dynamic color rotation, and catch trials.

export const STROOP_COLORS = [
  { name: 'Red',    inkHex: '#FF453A', btnHex: '#D70015', key: 'r', class: 'red' },
  { name: 'Green',  inkHex: '#30D158', btnHex: '#248A3D', key: 'g', class: 'green' },
  { name: 'Blue',   inkHex: '#0A84FF', btnHex: '#0058D0', key: 'b', class: 'blue' },
  { name: 'Yellow', inkHex: '#FFD60A', btnHex: '#CC8800', key: 'y', class: 'yellow' },
  { name: 'Purple', inkHex: '#BF5AF2', btnHex: '#8944AB', key: 'p', class: 'purple' },
  { name: 'Orange', inkHex: '#FF9F0A', btnHex: '#C96800', key: 'o', class: 'orange' },
  { name: 'Cyan',   inkHex: '#64D2FF', btnHex: '#0082A8', key: 'c', class: 'cyan' }
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

export function generateTrial(congruentRatio = 0.20, noneRatio = 0.20) {
  // 1. Pick 4 rotating button options from the 7-color pool
  const shuffled = shuffle(STROOP_COLORS);
  const buttonOptions = shuffled.slice(0, 4);
  const absentColors = shuffled.slice(4);

  const isNone = Math.random() < noneRatio;
  let targetColor;
  let word;
  let isCongruent = false;

  if (isNone) {
    // Ink color is deliberately chosen from absentColors so NO button matches
    targetColor = absentColors[Math.floor(Math.random() * absentColors.length)];
    // Word can be any color name (often one of the button names as a strong distractor)
    word = shuffled[Math.floor(Math.random() * shuffled.length)].name;
  } else {
    // Ink color is one of the 4 displayed buttons
    targetColor = buttonOptions[Math.floor(Math.random() * buttonOptions.length)];
    isCongruent = Math.random() < congruentRatio;
    if (isCongruent) {
      word = targetColor.name;
    } else {
      const otherNames = STROOP_COLORS.filter(c => c.name !== targetColor.name).map(c => c.name);
      word = otherNames[Math.floor(Math.random() * otherNames.length)];
    }
  }

  return {
    word,
    colorName: targetColor.name,
    inkHex: targetColor.inkHex,
    colorHex: targetColor.inkHex, // backward compat
    btnHex: targetColor.btnHex,
    buttonOptions,
    isNone,
    isCongruent: !isNone && isCongruent,
    presentedAt: performance.now()
  };
}

export function evaluateResponse(trial, chosenName, answeredAt = performance.now()) {
  const rtMs = Math.max(0, Math.round(answeredAt - (trial.presentedAt || answeredAt)));
  const norm = s => (s || '').toLowerCase().trim();
  const cNorm = norm(chosenName);
  const ok = trial.isNone
    ? (cNorm === 'none' || cNorm === 'none of the above')
    : (cNorm === norm(trial.colorName));

  return {
    word: trial.word,
    colorName: trial.colorName,
    chosenName,
    ok,
    rtMs,
    isNone: !!trial.isNone,
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
      noneMeanRtMs: 0,
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
  const congRt = mean(correctTrials.filter(r => r.isCongruent && !r.isNone).map(r => r.rtMs));
  const incongRt = mean(correctTrials.filter(r => !r.isCongruent && !r.isNone).map(r => r.rtMs));
  const noneRt = mean(correctTrials.filter(r => r.isNone).map(r => r.rtMs));
  const interferenceMs = (congRt > 0 && incongRt > 0) ? Math.max(0, incongRt - congRt) : 0;
  const score = Math.max(0, correct * 10 - (dataset.length - correct) * 5);

  return {
    trials: dataset.length,
    correct,
    accuracy,
    meanRtMs,
    congruentMeanRtMs: congRt,
    incongruentMeanRtMs: incongRt,
    noneMeanRtMs: noneRt,
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
      // 1, 2, 3, 4 map to the currently displayed 4 buttonOptions
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = Number(key) - 1;
        if (currentTrial.buttonOptions && currentTrial.buttonOptions[idx]) {
          e.preventDefault?.();
          return this.answer(currentTrial.buttonOptions[idx].name);
        }
      }
      // 5, Space, or 'n' maps to 'None'
      if (key === '5' || key === ' ' || key === 'n') {
        e.preventDefault?.();
        return this.answer('None');
      }
      // Hotkey matching by first letter of visible buttons
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
