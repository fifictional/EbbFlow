export function getHeuristicAction(metrics) {
  const rhythm = metrics.rhythmConsistency;
  const pauses = metrics.pauseFrequency;
  const corrections = metrics.correctionsCount;

  const isFatigued = pauses > 4 && corrections > 3;
  if (isFatigued) return 'suggest_break';

  const isStruggling = rhythm < 0.3 && corrections > 2;
  if (isStruggling && pauses > 5) return 'encourage';
  if (isStruggling) return 'simplify_ui';

  const isFlowing = rhythm > 0.7 && corrections < 1;
  if (isFlowing) return 'do_nothing';

  return 'do_nothing';
}
