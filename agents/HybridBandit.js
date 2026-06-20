// starts off heuristic
// then introduces bandits
// blends two based on confidence 
// banidt always learning in the background
// strong priors on safe defaults 
// model should not be trusted early 

export class ContextualBanditAgent {
  constructor() {
    this.actions = ['do_nothing', 'simplify_ui', 'encourage', 'suggest_break', 'focus_mode'];
    this.models = {};
    this.history = [];
    this.baseline = 'hybrid';
    
    // strong priors - encode safe defaults
    this.priors = {
      'do_nothing': { alpha: 3, beta: 1 },
      'encourage': { alpha: 2, beta: 1 },
      'suggest_break': { alpha: 2, beta: 2 },
      'focus_mode': { alpha: 2, beta: 1 },
      'simplify_ui': { alpha: 1.5, beta: 1.5 }
    };
    
    console.log("hybrid cold-start agent initialised");
  }
  
  extractContext(metrics) {
    const focus = (metrics.rhythmConsistency * 0.5) + 
                  ((1 - Math.min(metrics.pauseFrequency / 5, 1)) * 0.3) +
                  ((1 - Math.min(metrics.correctionsCount / 4, 1)) * 0.2);
    
    const focusLevel = focus < 0.33 ? 'low' : focus < 0.66 ? 'medium' : 'high';
    const rhythmLevel = metrics.rhythmConsistency < 0.33 ? 'poor' : 
                        metrics.rhythmConsistency < 0.66 ? 'fair' : 'good';
    
    return `${focusLevel}_focus_${rhythmLevel}_rhythm`;
  }
  
  initializeContext(context) {
    if (this.models[context]) return;
    
    this.models[context] = {};
    this.actions.forEach(action => {
      const prior = this.priors[action];
      this.models[context][action] = {
        alpha: prior.alpha,
        beta: prior.beta,
        trials: 0
      };
    });
  }
  
  // instant decision based on current typing metrics
  // no historical data needed, works from first second
  heuristicAction(metrics) {
    const rhythm = metrics.rhythmConsistency;
    const pauses = metrics.pauseFrequency;
    const corrections = metrics.correctionsCount;
    
    // detect fatigue: frequent pauses + many corrections
    const isFatigued = pauses > 4 && corrections > 3;
    if (isFatigued) {
      return 'suggest_break';
    }
    
    // detect unfocused but struggling: poor rhythm + mistakes
    const isStruggling = rhythm < 0.3 && corrections > 2;
    if (isStruggling && pauses > 5) {
      return 'encourage';
    } else if (isStruggling) {
      return 'simplify_ui';
    }
    
    // detect flow state: good rhythm, few mistakes
    const isFlowing = rhythm > 0.7 && corrections < 1;
    if (isFlowing) {
      return 'do_nothing';
    }
    
    // neutral: let them be
    return 'do_nothing';
  }
  
  getContextConfidence(context) {
    if (!this.models[context]) return 0;
    return Object.values(this.models[context])
      .reduce((sum, m) => sum + m.trials, 0);
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
  
  chooseAction(metrics) {
    const decisionCount = this.history.length;
    const context = this.extractContext(metrics);
    
    let action;
    
    // phase 1: decisions 0-5 = pure heuristic
    if (decisionCount < 5) {
      action = this.heuristicAction(metrics);
      this.lastPhase = 'heuristic_only';
    }
    // phase 2: decisions 5-20 = mostly heuristic, test bandit 20% of time
    else if (decisionCount < 20) {
      const heurAction = this.heuristicAction(metrics);
      
      if (Math.random() < 0.2) {
        action = this.thompsonSampling(context);
        this.lastPhase = 'test_bandit';
      } else {
        action = heurAction;
        this.lastPhase = 'heuristic_primary';
      }
    }
    // phase 3: decisions 20+ = blend based on confidence
    else {
      const confidence = this.getContextConfidence(context);
      const banditWeight = Math.min(confidence / 12, 0.8);
      
      if (Math.random() < banditWeight) {
        action = this.thompsonSampling(context);
        this.lastPhase = 'bandit_primary';
      } else {
        action = this.heuristicAction(metrics);
        this.lastPhase = 'heuristic_safety';
      }
    }
    
    this.lastContext = context;
    this.lastAction = action;
    
    return action;
  }
  
  calculateReward(prevMetrics, currentMetrics, actionTaken) {
    const prevRhythm = prevMetrics.rhythmConsistency;
    const currRhythm = currentMetrics.rhythmConsistency;
    const improvement = currRhythm - prevRhythm;
    
    let reward = 0;
    
    // handle no typing
    const noTyping = prevRhythm < 0.1 && currRhythm < 0.1;
    if (noTyping) {
      return actionTaken === 'suggest_break' ? 0.5 : 
             actionTaken === 'do_nothing' ? 0 : -0.3;
    }
    
    // base reward: does action match state?
    if (prevRhythm > 0.7) {
      reward = (actionTaken === 'do_nothing' || actionTaken === 'encourage') ? 2.5 : -1.5;
    } else if (prevRhythm > 0.4) {
      reward = actionTaken === 'do_nothing' ? 1.0 : 
               actionTaken === 'encourage' ? 0.5 : -0.3;
    } else if (prevRhythm > 0.2) {
      reward = (actionTaken === 'encourage' || actionTaken === 'simplify_ui') ? 1.0 : 
               actionTaken === 'do_nothing' ? -0.5 : 0.3;
    } else {
      reward = actionTaken === 'focus_mode' ? 2.0 : 
               (actionTaken === 'simplify_ui' || actionTaken === 'suggest_break') ? 1.0 : -3.0;
    }
    
    // improvement bonus
    if (improvement > 0.1) {
      reward += actionTaken !== 'do_nothing' ? 3.0 : 0.5;
    } else if (improvement > 0.05 && actionTaken !== 'do_nothing') {
      reward += 1.5;
    } else if (improvement < -0.1 && actionTaken !== 'do_nothing') {
      reward -= 2.0;
    }
    
    // action cost
    if (actionTaken !== 'do_nothing') {
      reward -= 0.2;
    }
    
    return reward;
  }
  
  learn(reward) {
    if (!this.lastContext || !this.lastAction) return;
    
    const context = this.lastContext;
    const action = this.lastAction;
    
    this.initializeContext(context);
    
    const model = this.models[context][action];
    
    // bandit learns quietly from all decisions (heuristic or bandit)
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
      timestamp: Date.now()
    });
    
    this.lastContext = null;
    this.lastAction = null;
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
      
      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v;
      }
      
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
      
      return sampleGamma(shape);
    };
    
    return sampleGamma(alpha) / (sampleGamma(alpha) + sampleGamma(beta));
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
      currentPhase: this.lastPhase
    };
  }
  
  save() {
    return JSON.stringify({
      models: this.models,
      baseline: this.baseline,
      history: this.history.slice(-100)
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
