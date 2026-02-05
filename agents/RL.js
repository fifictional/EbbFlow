// agent/RL.js
export class MinimalRL {
  constructor() {
    // Q-table
    this.qTable = {};
    this.learningRate = 0.1;    // How fast to learn
    this.discountFactor = 0.9;  // Value of future rewards
    this.explorationRate = 0.3; // Start with 30% exploration
    
    // Define possible actions
    this.actions = [
      'do_nothing',      // Action 0
      'simplify_ui',     // Action 1: Hide distractions
      'encourage',       // Action 2: Show gentle prompt
      'suggest_break'    // Action 3: Suggest micro-break
    ];
    
    console.log("MinimalRL Agent initialized with actions:", this.actions);
  }
  
  // Discretize continuous metrics into a state string
  getState(metrics) {
    // Create a simple 4-bit state from your key metrics
    const rhythm = metrics.rhythmConsistency < 0.3 ? 'low' : 
                   metrics.rhythmConsistency < 0.7 ? 'mid' : 'high';
    
    const pauses = metrics.pauseFrequency > 2 ? 'high_pauses' : 'low_pauses';
    
    const corrections = metrics.correctionsCount > 3 ? 'many' : 'few';
    
    const speed = metrics.avgInterKeyInterval > 250 ? 'slow' : 'fast';
    
    return `${rhythm}_${pauses}_${corrections}_${speed}`;
  }
  
  // Choose action using ε-greedy policy
  chooseAction(state) {
    // Initialize Q-values for new state
    if (!this.qTable[state]) {
      this.qTable[state] = {};
      this.actions.forEach(action => {
        this.qTable[state][action] = 0; // Initial value
      });
    }
    
    // Exploration vs Exploitation
    if (Math.random() < this.explorationRate) {
      // Explore: random action
      const randomIndex = Math.floor(Math.random() * this.actions.length);
      return {
        action: this.actions[randomIndex],
        actionIndex: randomIndex,
        wasRandom: true
      };
    } else {
      // Exploit: best known action
      const stateActions = this.qTable[state];
      let bestAction = 'do_nothing';
      let bestValue = -Infinity;
      
      Object.entries(stateActions).forEach(([action, value]) => {
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      });
      
      return {
        action: bestAction,
        actionIndex: this.actions.indexOf(bestAction),
        wasRandom: false
      };
    }
  }
  
  // Calculate reward based on what happened after the action
  calculateReward(prevMetrics, currentMetrics, actionTaken) {
    let reward = 0;
    
    // Reward improvements in rhythm
    if (currentMetrics.rhythmConsistency > prevMetrics.rhythmConsistency) {
      reward += 1.0;
    } else if (currentMetrics.rhythmConsistency < prevMetrics.rhythmConsistency * 0.8) {
      reward -= 0.5;
    }
    
    // Reward reduced pauses
    if (currentMetrics.pauseFrequency < prevMetrics.pauseFrequency) {
      reward += 0.5;
    }
    
    // Penalize annoying actions too often
    if (actionTaken !== 'do_nothing') {
      reward -= 0.1; // Small penalty for intervening
    }
    
    // Big reward for returning from "stuck" state
    if (prevMetrics.rhythmConsistency < 0.1 && currentMetrics.rhythmConsistency > 0.3) {
      reward += 2.0;
    }
    
    return reward;
  }
  
  // Q-learning update rule
  updateQValue(state, action, reward, nextState) {
    if (!this.qTable[state]) this.qTable[state] = {};
    if (!this.qTable[state][action]) this.qTable[state][action] = 0;
    
    // Get best Q-value for next state
    let maxNextQ = 0;
    if (this.qTable[nextState]) {
      maxNextQ = Math.max(...Object.values(this.qTable[nextState]));
    }
    
    // Q-learning formula: Q(s,a) = Q(s,a) + α[r + γ*maxQ(s',a') - Q(s,a)]
    const currentQ = this.qTable[state][action];
    this.qTable[state][action] = currentQ + 
      this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    
    console.log(`🔄 Q-update: ${state}/${action}: ${currentQ.toFixed(3)} → ${this.qTable[state][action].toFixed(3)}`);
  }
  
  // Decrease exploration over time
  decayExploration() {
    this.explorationRate = Math.max(0.05, this.explorationRate * 0.995);
  }
  
  // Save/Load Q-table
  save() {
    return JSON.stringify({
      qTable: this.qTable,
      explorationRate: this.explorationRate
    });
  }
  
  load(savedData) {
    const data = JSON.parse(savedData);
    this.qTable = data.qTable || {};
    this.explorationRate = data.explorationRate || 0.3;
  }
}