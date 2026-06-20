import { config } from './config.js';

export function isNoTyping(prevRhythm, currRhythm) {
  const thresh = config.reward.noTypingThreshold;
  return prevRhythm < thresh && currRhythm < thresh;
}

export function getNoTypingReward(action) {
  const map = config.reward.noTyping;
  return map[action] ?? map.other;
}

export function getBaseReward(prevRhythm, action) {
  if (prevRhythm > 0.7) {
    return ['do_nothing', 'encourage'].includes(action) ? 2.5 : -1.5;
  }
  if (prevRhythm > 0.4) {
    if (action === 'do_nothing') return 1.0;
    if (action === 'encourage') return 0.5;
    return -0.3;
  }
  if (prevRhythm > 0.2) {
    if (['encourage', 'simplify_ui'].includes(action)) return 1.0;
    if (action === 'do_nothing') return -0.5;
    return 0.3;
  }
  if (action === 'focus_mode') return 2.0;
  if (['simplify_ui', 'suggest_break'].includes(action)) return 1.0;
  return -3.0;
}

export function getImprovementBonus(improvement, wasActive) {
  const big = config.reward.improvementBig;
  const small = config.reward.improvementSmall;
  const decline = config.reward.decline;

  if (improvement > big.threshold) {
    return wasActive ? big.activeBonus : big.passiveBonus;
  }
  if (improvement > small.threshold && wasActive) {
    return small.bonus;
  }
  if (improvement < decline.threshold && wasActive) {
    return -decline.penalty;
  }
  return 0;
}

export function calculateReward(prevMetrics, currentMetrics, actionTaken) {
  const prevRhythm = prevMetrics.rhythmConsistency;
  const currRhythm = currentMetrics.rhythmConsistency;
  const improvement = currRhythm - prevRhythm;
  const wasActive = actionTaken !== 'do_nothing';

  if (isNoTyping(prevRhythm, currRhythm)) {
    return getNoTypingReward(actionTaken);
  }

  let reward = getBaseReward(prevRhythm, actionTaken);
  reward += getImprovementBonus(improvement, wasActive);

  if (wasActive) {
    reward -= config.reward.actionCost;
  }

  return reward;
}
