export const config = {
  actions: ['do_nothing', 'simplify_ui', 'encourage', 'suggest_break', 'focus_mode'],

  priors: {
    'do_nothing': { alpha: 3, beta: 1 },
    'encourage': { alpha: 2, beta: 1 },
    'suggest_break': { alpha: 2, beta: 2 },
    'focus_mode': { alpha: 2, beta: 1 },
    'simplify_ui': { alpha: 1.5, beta: 1.5 },
  },

  context: {
    rhythmWeight: 0.5,
    pauseWeight: 0.3,
    correctionWeight: 0.2,
    focusLow: 0.33,
    focusMedium: 0.66,
    rhythmPoor: 0.33,
    rhythmFair: 0.66,
  },

  phaseSchedule: {
    decisionsHeuristicOnly: 5,
    decisionsTestBandit: 20,
    banditExploreRate: 0.2,
    banditMaxWeight: 0.8,
    confidencePerTrial: 12,
  },

  reward: {
    actionCost: 0.2,
    noTypingThreshold: 0.1,
    noTyping: { suggest_break: 0.5, do_nothing: 0, other: -0.3 },
    improvementBig: { threshold: 0.1, activeBonus: 3.0, passiveBonus: 0.5 },
    improvementSmall: { threshold: 0.05, bonus: 1.5 },
    decline: { threshold: -0.1, penalty: 2.0 },
  },
};
