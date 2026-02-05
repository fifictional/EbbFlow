/**
 * ContextualBanditAgent - Each 10-30s window is an independent decision, 
 * using typing metrics and context, optimises for immediate outcomes in the next window,
 * uses thompson sampling, has a do_nothing baseline. 
 */

export class ContextualBanditAgent {
  constructor() {
    // action space
    this.actions = ['do_nothing', 'simplify_ui', 'encourage', 'suggest_break', 'focus_mode'];
    
    // {contextString: {action: {alpha, beta, trials}}}
    this.models = {}; 
    
    // uniform prior
    this.priorAlpha = 1;
    this.priorBeta = 1;
    
    this.history = [];
    
    // current baseline 
    this.baseline = 'bandit'; // 'bandit', 'random', 'do_nothing', 'rule_based'
    
    console.log("Contextual Bandit Agent initialised");
  }
  
  /**
   * extract context from typing metrics and converts continuous 
   * typing metrics into discrete context string, best guesses the user's state
   */
  extractContext(metrics) {
    // focus estimate, how focused is the user?
    const focus = (metrics.rhythmConsistency * 0.5) + 
                  ((1 - Math.min(metrics.pauseFrequency / 5, 1)) * 0.3) +
                  ((1 - Math.min(metrics.correctionsCount / 4, 1)) * 0.2);
    
    // discretise 
    const focusLevel = focus < 0.33 ? 'low' : focus < 0.66 ? 'medium' : 'high';
    
    // discretise rhythm 
    const rhythmLevel = metrics.rhythmConsistency < 0.33 ? 'poor' : 
                        metrics.rhythmConsistency < 0.66 ? 'fair' : 'good';
    
    // context string
    return `${focusLevel}_focus_${rhythmLevel}_rhythm`;
  }
  
  ruleBasedAction(context) {
    if (context.includes('low_focus') && context.includes('poor_rhythm')) {
      return 'suggest_break';
    } else if (context.includes('low_focus')) {
      return 'encourage';
    } else if (context.includes('poor_rhythm')) {
      return 'focus_mode';
    } else if (context.includes('medium_focus')) {
      return 'do_nothing'; 
    } else {
      return 'do_nothing'; 
    }
  }
  
  thompsonSampling(context) {
    // initialise context if new
    if (!this.models[context]) {
      this.models[context] = {};
      this.actions.forEach(action => {
        this.models[context][action] = {
          alpha: this.priorAlpha,
          beta: this.priorBeta,
          trials: 0
        };
      });
    }
    
    let bestAction = 'do_nothing';
    let bestSample = -1;
    
    for (const action of this.actions) {
      const model = this.models[context][action];
      
      // sample success probability from Beta(alpha, beta)
      const sample = this.sampleBeta(model.alpha, model.beta);
      
      // best sample
      if (sample > bestSample) {
        bestSample = sample;
        bestAction = action;
      }
    }
    
    return bestAction;
  }
  

  chooseAction(metrics) {
    const context = this.extractContext(metrics);
    
    let action;
    let method;
    
    switch(this.baseline) {
      case 'random':
        action = this.actions[Math.floor(Math.random() * this.actions.length)];
        method = 'random';
        break;
        
      case 'do_nothing':
        action = 'do_nothing';
        method = 'do_nothing';
        break;
        
      case 'rule_based':
        action = this.ruleBasedAction(context);
        method = 'rule_based';
        break;
        
      case 'bandit':
      default:
        action = this.thompsonSampling(context);
        method = 'thompson';
        break;
    }
    
    this.lastContext = context;
    this.lastAction = action;
    
    console.log(`${method}: ${context} → ${action}`);
    return action;
  }
  

  // bandit update
  learn(reward) {
    if (!this.lastContext || !this.lastAction) return;
    
    const context = this.lastContext;
    const action = this.lastAction;
    
    if (!this.models[context]) {
      this.models[context] = {};
    }
    if (!this.models[context][action]) {
      this.models[context][action] = {
        alpha: this.priorAlpha,
        beta: this.priorBeta,
        trials: 0
      };
    }
    
    const model = this.models[context][action];
    
    // bayesian update - treat positive reward as success, negative as failure
    if (reward > 0) {
      model.alpha += 1; // success
    } else {
      model.beta += 1;  // failure
    }
    model.trials += 1;
    
    this.history.push({
      context,
      action,
      reward,
      timestamp: Date.now()
    });
    
    this.lastContext = null;
    this.lastAction = null;
  }
    
  calculateReward(prevMetrics, currentMetrics, actionTaken) {
    let reward = 0;
    
    // no typing
    const isNoTyping = prevMetrics.rhythmConsistency < 0.1 && 
                      currentMetrics.rhythmConsistency < 0.1;
    
    if (isNoTyping) {
      if (actionTaken === 'suggest_break') {
        reward += 0.5;
      } else if (actionTaken === 'do_nothing') {
        reward += 0;
      } else if (actionTaken === 'encourage') {
        reward -= 0.3;
      }
      return reward;
    }
    
    if (prevMetrics.rhythmConsistency < 0.1 && 
        currentMetrics.rhythmConsistency > 0.3 && 
        actionTaken === 'encourage') {
      reward += 2.0;  
    }
    
    // rhythm quality rewards
    if (prevMetrics.rhythmConsistency > 0.7) {
      if (actionTaken === 'do_nothing' || actionTaken === 'encourage') {
        reward += 2.5;
      } else {
        reward -= 1.5;
      }
    } else if (prevMetrics.rhythmConsistency > 0.4) {
      if (actionTaken === 'do_nothing') {
        reward += 1.0;
      } else if (actionTaken === 'encourage') {
        reward += 0.5;
      }
    } else if (prevMetrics.rhythmConsistency > 0.2) {
      if (actionTaken === 'encourage' || actionTaken === 'simplify_ui') {
        reward += 1.0;
      } else if (actionTaken === 'do_nothing') {
        reward -= 0.5;
      }
    } else {
      if (actionTaken === 'focus_mode') {
        reward += 2.0;
      } else if (actionTaken === 'simplify_ui' || actionTaken === 'suggest_break') {
        reward += 1.0;
      } else if (actionTaken === 'do_nothing') {
        reward -= 3.0;
      }
    }
    
    // improvement rewards
    const rhythmImproved = currentMetrics.rhythmConsistency - prevMetrics.rhythmConsistency;
    if (rhythmImproved > 0.1 && actionTaken !== 'do_nothing') {
      reward += 3.0;
    } else if (rhythmImproved > 0.05 && actionTaken !== 'do_nothing') {
      reward += 1.5;
    } else if (rhythmImproved < -0.1 && actionTaken !== 'do_nothing') {
      reward -= 2.0;
    }
    
    // action cost
    if (actionTaken !== 'do_nothing') {
      reward -= 0.2;
    }
    
    return reward;
  }
  
  sampleBeta(alpha, beta) {
    const sampleGamma = (shape) => {
      let d, c, x, v, u;
      d = shape - 1/3;
      c = 1 / Math.sqrt(9 * d);
      
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
    
    const x = sampleGamma(alpha);
    const y = sampleGamma(beta);
    return x / (x + y);
  }
  
  setBaseline(mode) {
    const validModes = ['bandit', 'random', 'do_nothing', 'rule_based'];
    if (validModes.includes(mode)) {
      this.baseline = mode;
      console.log(`Baseline set to: ${mode}`);
    }
  }
  
  getStats() {
    if (this.history.length === 0) return null;
    
    const totalReward = this.history.reduce((sum, h) => sum + h.reward, 0);
    const avgReward = totalReward / this.history.length;
    
    const actionCounts = {};
    this.history.forEach(h => {
      actionCounts[h.action] = (actionCounts[h.action] || 0) + 1;
    });
    
    return {
      totalDecisions: this.history.length,
      averageReward: avgReward,
      actionDistribution: actionCounts,
      contextsLearned: Object.keys(this.models).length
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
      this.baseline = saved.baseline || 'bandit';
      this.history = saved.history || [];
      console.log(`📁 Loaded ${Object.keys(this.models).length} contexts`);
      return true;
    } catch {
      return false;
    }
  }
}