import { config } from './config.js';
import { extractContext } from './context-extractor.js';
import { getHeuristicAction } from './heuristic-policy.js';
import { calculateReward } from './reward-calculator.js';

export class ContextualBanditAgent {
  constructor() {
    this.actions = config.actions;
    this.models = {};
    this.history = [];
    this.baseline = 'hybrid';
    this.priors = config.priors;
    console.log("hybrid cold-start agent initialised");
  }

  initializeContext(context) {
    if (this.models[context]) return;

    this.models[context] = {};
    this.actions.forEach(action => {
      const prior = this.priors[action];
      this.models[context][action] = {
        alpha: prior.alpha,
        beta: prior.beta,
        trials: 0,
      };
    });
  }

  getContextConfidence(context) {
    if (!this.models[context]) return 0;
    return Object.values(this.models[context])
      .reduce((sum, m) => sum + m.trials, 0);
  }

  chooseAction(metrics) {
    const schedule = config.phaseSchedule;
    const decisionCount = this.history.length;
    const context = extractContext(metrics);

    let action;

    if (decisionCount < schedule.decisionsHeuristicOnly) {
      action = getHeuristicAction(metrics);
      this.lastPhase = 'heuristic_only';
    } else if (decisionCount < schedule.decisionsTestBandit) {
      if (Math.random() < schedule.banditExploreRate) {
        action = this.thompsonSampling(context);
        this.lastPhase = 'test_bandit';
      } else {
        action = getHeuristicAction(metrics);
        this.lastPhase = 'heuristic_primary';
      }
    } else {
      const confidence = this.getContextConfidence(context);
      const banditWeight = Math.min(confidence / schedule.confidencePerTrial, schedule.banditMaxWeight);

      if (Math.random() < banditWeight) {
        action = this.thompsonSampling(context);
        this.lastPhase = 'bandit_primary';
      } else {
        action = getHeuristicAction(metrics);
        this.lastPhase = 'heuristic_safety';
      }
    }

    this.lastContext = context;
    this.lastAction = action;
    return action;
  }

  thompsonSampling(context) {
    this.initializeContext(context);

    let bestAction = 'do_nothing';
    let bestSample = -1;

    for (const action of this.actions) {
      const model = this.models[context][action];
      const sample = this.sampleBeta(model.alpha, model.beta);

      if (sample > bestSample) {
        bestSample = sample;
        bestAction = action;
      }
    }

    return bestAction;
  }

  sampleBeta(alpha, beta) {
    const sampleGamma = (shape) => {
      let d = shape - 1/3;
      let c = 1 / Math.sqrt(9 * d);

      let x, v, u;
      do {
        do {
          x = Math.random() * 2 - 1;
        } while (Math.abs(x) < 1e-10);
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;

      return sampleGamma(shape);
    };

    return sampleGamma(alpha) / (sampleGamma(alpha) + sampleGamma(beta));
  }

  calculateReward(prevMetrics, currentMetrics, actionTaken) {
    return calculateReward(prevMetrics, currentMetrics, actionTaken);
  }

  learn(reward) {
    if (!this.lastContext || !this.lastAction) return;

    const context = this.lastContext;
    const action = this.lastAction;

    this.initializeContext(context);

    const model = this.models[context][action];

    if (reward > 0) {
      model.alpha += 1;
    } else {
      model.beta += 1;
    }
    model.trials += 1;

    this.history.push({
      context,
      action,
      reward,
      phase: this.lastPhase,
      timestamp: Date.now(),
    });

    this.lastContext = null;
    this.lastAction = null;
  }

  getStats() {
    if (this.history.length === 0) return null;

    const totalReward = this.history.reduce((sum, h) => sum + h.reward, 0);
    const avgReward = totalReward / this.history.length;

    const phaseDistribution = {};
    const actionCounts = {};
    const contextCounts = {};

    this.history.forEach(h => {
      phaseDistribution[h.phase] = (phaseDistribution[h.phase] || 0) + 1;
      actionCounts[h.action] = (actionCounts[h.action] || 0) + 1;
      contextCounts[h.context] = (contextCounts[h.context] || 0) + 1;
    });

    const contextConfidence = {};
    for (const [ctx, actions] of Object.entries(this.models)) {
      const trials = Object.values(actions).reduce((sum, m) => sum + m.trials, 0);
      contextConfidence[ctx] = trials;
    }

    return {
      totalDecisions: this.history.length,
      averageReward: avgReward,
      phaseDistribution,
      actionDistribution: actionCounts,
      contextConfidence,
      uniqueContexts: Object.keys(this.models).length,
      currentPhase: this.lastPhase,
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
      this.baseline = saved.baseline || 'hybrid';
      this.history = saved.history || [];
      console.log(`loaded ${Object.keys(this.models).length} contexts`);
      return true;
    } catch {
      return false;
    }
  }
}
