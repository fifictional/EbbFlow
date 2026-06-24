import { config } from './config.js';
import { getHeuristicAction } from './heuristic-policy.js';
import { calculateReward } from './reward-calculator.js';

// ========================================
//  Linear algebra helpers (d <= 4)
// ========================================

function matIdentity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

function matCopy(A) {
  return A.map(row => [...row]);
}

function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(A[i][i] - sum);
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

function forwardSub(L, b) {
  const n = b.length;
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * x[j];
    x[i] = (b[i] - sum) / L[i][i];
  }
  return x;
}

function backSub(U, b) {
  const n = b.length;
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += U[i][j] * x[j];
    x[i] = (b[i] - sum) / U[i][i];
  }
  return x;
}

function transpose(A) {
  const n = A.length;
  return Array.from({ length: n }, (_, i) => A.map(row => row[i]));
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function outerAdd(A, x) {
  const n = x.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] += x[i] * x[j];
    }
  }
}

function vecAdd(v, s, x) {
  for (let i = 0; i < v.length; i++) v[i] += s * x[i];
}

// Box-Muller standard normal draw
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ========================================
//  Main agent
// ========================================

export class ContextualBanditAgent {
  constructor() {
    const lc = config.lints;
    this.d = lc.featureCount;
    this.lambda = lc.lambda;
    this.alpha = lc.alpha;
    this.heuristicDecisions = lc.heuristicDecisions;
    this.actions = [...config.actions];
    this.history = [];
    this.baseline = 'lints';
    this.reset();
    console.log("LinTS agent initialised");
  }

  reset() {
    const I = matIdentity(this.d);
    this.models = {};
    this.actions.forEach(action => {
      this.models[action] = {
        A: matCopy(I).map(row => row.map(v => v * this.lambda)),
        b: new Array(this.d).fill(0),
        trials: 0,
      };
    });
    this.lastAction = null;
    this.lastFeatures = null;
    this.lastPhase = null;
  }

  extractFeatures(metrics) {
    return [
      1,
      metrics.rhythmConsistency,
      metrics.pauseFrequency,
      metrics.correctionsCount,
    ];
  }

  solveLin(A, b) {
    const L = cholesky(A);
    const y = forwardSub(L, b);
    return backSub(transpose(L), y);
  }

  samplePosterior(A) {
    const L = cholesky(A);
    const z = Array.from({ length: this.d }, () => randn());
    const y = backSub(transpose(L), z);
    return y.map(v => v * this.alpha);
  }

  chooseAction(metrics) {
    const x = this.extractFeatures(metrics);
    this.lastFeatures = x;
    this.lastPhase = null;

    if (this.history.length < this.heuristicDecisions) {
      const action = getHeuristicAction(metrics);
      this.lastAction = action;
      this.lastPhase = 'heuristic';
      return action;
    }

    let bestAction = 'do_nothing';
    let bestScore = -Infinity;

    for (const action of this.actions) {
      const m = this.models[action];
      const theta = this.solveLin(m.A, m.b);
      const perturbation = this.samplePosterior(m.A);
      const score = dot(theta, x) + dot(perturbation, x);

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    this.lastAction = bestAction;
    this.lastPhase = 'lints';
    return bestAction;
  }

  calculateReward(prevMetrics, currentMetrics, actionTaken) {
    return calculateReward(prevMetrics, currentMetrics, actionTaken);
  }

  learn(reward) {
    if (!this.lastAction || !this.lastFeatures) return;

    const m = this.models[this.lastAction];
    const x = this.lastFeatures;

    outerAdd(m.A, x);
    vecAdd(m.b, reward, x);
    m.trials += 1;

    this.history.push({
      action: this.lastAction,
      features: [...x],
      reward,
      phase: this.lastPhase,
      timestamp: Date.now(),
    });

    this.lastAction = null;
    this.lastFeatures = null;
  }

  getStats() {
    if (this.history.length === 0) return null;

    const totalReward = this.history.reduce((sum, h) => sum + h.reward, 0);
    const avgReward = totalReward / this.history.length;

    const phaseDistribution = {};
    const actionCounts = {};

    this.history.forEach(h => {
      phaseDistribution[h.phase] = (phaseDistribution[h.phase] || 0) + 1;
      actionCounts[h.action] = (actionCounts[h.action] || 0) + 1;
    });

    const weights = {};
    const totalTrials = {};
    for (const [action, m] of Object.entries(this.models)) {
      const theta = this.solveLin(m.A, m.b);
      weights[action] = theta;
      totalTrials[action] = m.trials;
    }

    return {
      totalDecisions: this.history.length,
      averageReward: avgReward,
      phaseDistribution,
      actionDistribution: actionCounts,
      weights,
      totalTrials,
    };
  }

  save() {
    return JSON.stringify({
      models: this.models,
      baseline: this.baseline,
      history: this.history.slice(-100),
    });
  }

  load(data) {
    try {
      const saved = JSON.parse(data);
      this.models = saved.models || {};
      this.baseline = saved.baseline || 'lints';
      this.history = saved.history || [];
      console.log(`loaded LinTS models for ${Object.keys(this.models).length} actions`);
      return true;
    } catch {
      return false;
    }
  }
}
