import { config } from './config.js';

export function extractContext(metrics) {
  const c = config.context;
  const focus = (metrics.rhythmConsistency * c.rhythmWeight) +
                ((1 - Math.min(metrics.pauseFrequency / 5, 1)) * c.pauseWeight) +
                ((1 - Math.min(metrics.correctionsCount / 4, 1)) * c.correctionWeight);

  const focusLevel = focus < c.focusLow ? 'low' : focus < c.focusMedium ? 'medium' : 'high';
  const rhythmLevel = metrics.rhythmConsistency < c.rhythmPoor ? 'poor' :
                      metrics.rhythmConsistency < c.rhythmFair ? 'fair' : 'good';

  return `${focusLevel}_focus_${rhythmLevel}_rhythm`;
}
