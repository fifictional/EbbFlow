// actions/index.js - Exports all actions
export { GoogleDocsFocusMode } from './GoogleDocsFocusMode.js';
export { TypingAnalyser } from './TypingAnalyser.js';

export class Agent {
  constructor() {
    this.actions = [];
    this.state = {};
  }
  
  registerAction(action) {
    this.actions.push(action);
  }
  
  decide(state) {
    // Simple rule-based agent
    if (state.focusLevel < 3) {
      return ['enable_focus_mode'];
    }
    return [];
  }
}