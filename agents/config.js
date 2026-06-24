export const config = {
  actions: ['do_nothing', 'simplify_ui', 'encourage', 'suggest_break', 'focus_mode'],

  reward: {
    actionCost: 0.2,
    noTypingThreshold: 0.1,
    noTyping: { suggest_break: 0.5, do_nothing: 0, other: -0.3 },
    improvementBig: { threshold: 0.1, activeBonus: 3.0, passiveBonus: 0.5 },
    improvementSmall: { threshold: 0.05, bonus: 1.5 },
    decline: { threshold: -0.1, penalty: 2.0 },
  },

  lints: {
    featureCount: 4,
    lambda: 1.0,
    alpha: 0.5,
    heuristicDecisions: 5,
  },
};
