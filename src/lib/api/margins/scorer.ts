import type { MarginData } from './types';

export interface ScoreResult {
  signal: 'green' | 'yellow' | 'red';
  reason: string;
}

/**
 * Score margin requirements indicator (#6)
 *
 * GREEN: Margins stable for 30+ days, no recent changes
 * YELLOW: One margin change in past 14 days, or level above historical median
 * RED: Two+ hikes within 14 days, or single hike >25% relative increase
 */
export function scoreMargins(
  current: MarginData,
  priorSnapshots: MarginData[] = []
): ScoreResult {
  const { initialMarginPercent, recentChanges, lastChangeDate } = current;

  // Check for recent hikes
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentHikes = recentChanges.filter(
    (c) => c.effectiveDate >= fourteenDaysAgo && c.changePercent > 0
  );

  // RED: Multiple hikes or large single hike
  if (recentHikes.length >= 2) {
    return {
      signal: 'red',
      reason: `CRITICAL: ${recentHikes.length} margin hikes in past 14 days. Escalating pressure on leveraged longs.`,
    };
  }

  const largeHike = recentHikes.find((h) => h.changePercent >= 25);
  if (largeHike) {
    return {
      signal: 'red',
      reason: `CRITICAL: Major margin hike of ${largeHike.changePercent.toFixed(0)}%. Forced liquidation risk elevated.`,
    };
  }

  // YELLOW: Recent change or elevated level
  if (lastChangeDate && lastChangeDate >= fourteenDaysAgo) {
    return {
      signal: 'yellow',
      reason: `WATCH: Margin change within past 14 days. Current initial margin: ${initialMarginPercent.toFixed(1)}%.`,
    };
  }

  // Historical median for silver is roughly 10-12%
  const historicalMedian = 11;
  if (initialMarginPercent > historicalMedian * 1.2) {
    return {
      signal: 'yellow',
      reason: `WATCH: Margin at ${initialMarginPercent.toFixed(1)}%, above historical median (~${historicalMedian}%).`,
    };
  }

  // GREEN: Stable margins
  if (lastChangeDate && lastChangeDate < thirtyDaysAgo) {
    return {
      signal: 'green',
      reason: `BULLISH: Margins stable at ${initialMarginPercent.toFixed(1)}% for 30+ days. No forced liquidation catalyst.`,
    };
  }

  // Default: stable if we have no change history
  return {
    signal: 'green',
    reason: `BULLISH: Current margin ${initialMarginPercent.toFixed(1)}%. No recent changes detected.`,
  };
}
