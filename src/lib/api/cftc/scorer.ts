import type { SignalType } from '@/types/database';
import type { ParsedCOTData } from './types';

interface ScoreResult {
  signal: SignalType;
  reason: string;
}

/** Calculate percentile of a value within a sorted array */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 50;

  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
  }

  return (count / sortedValues.length) * 100;
}

/** Score indicator #4: Speculator Net Position */
export function scoreSpeculatorNet(
  current: ParsedCOTData,
  history: ParsedCOTData[],
  priorWeek: ParsedCOTData | null
): ScoreResult {
  const currentNet = current.speculatorNet;
  const historicalNets = history.map((d) => d.speculatorNet).sort((a, b) => a - b);
  const percentile = calculatePercentile(currentNet, historicalNets);

  // Check week-over-week change
  let wowChange: number | null = null;
  if (priorWeek) {
    wowChange = ((currentNet - priorWeek.speculatorNet) / Math.abs(priorWeek.speculatorNet)) * 100;
  }

  // RED: >80th percentile OR drops >20% WoW
  if (percentile > 80) {
    return {
      signal: 'red',
      reason: `CRITICAL: Speculator net long at ${percentile.toFixed(0)}th percentile (${currentNet.toLocaleString()} contracts) - extremely crowded, vulnerable to slam`,
    };
  }

  if (wowChange !== null && wowChange < -20) {
    return {
      signal: 'red',
      reason: `CRITICAL: Speculator net long dropped ${Math.abs(wowChange).toFixed(1)}% week-over-week (${currentNet.toLocaleString()} contracts) - forced liquidation`,
    };
  }

  // YELLOW: >60th percentile OR <20th percentile
  if (percentile > 60) {
    return {
      signal: 'yellow',
      reason: `WATCH: Speculator net long at ${percentile.toFixed(0)}th percentile (${currentNet.toLocaleString()} contracts) - crowded positioning`,
    };
  }

  if (percentile < 20) {
    return {
      signal: 'yellow',
      reason: `WATCH: Speculator net long at ${percentile.toFixed(0)}th percentile (${currentNet.toLocaleString()} contracts) - washed out`,
    };
  }

  // GREEN: 20th-60th percentile
  return {
    signal: 'green',
    reason: `BULLISH: Speculator net long at ${percentile.toFixed(0)}th percentile (${currentNet.toLocaleString()} contracts) - healthy positioning`,
  };
}

/** Score indicator #5: Commercial Short Position */
export function scoreCommercialShort(
  current: ParsedCOTData,
  history: ParsedCOTData[],
  priorWeek: ParsedCOTData | null
): ScoreResult {
  const currentShort = current.commercialNetShort;
  const historicalShorts = history.map((d) => d.commercialNetShort).sort((a, b) => a - b);
  const percentile = calculatePercentile(currentShort, historicalShorts);

  // Check week-over-week change in shorts
  let wowIncrease: number | null = null;
  if (priorWeek) {
    wowIncrease = currentShort - priorWeek.commercialNetShort;
  }

  // RED: >80th percentile OR shorts increase >10,000 WoW
  if (percentile > 80) {
    return {
      signal: 'red',
      reason: `CRITICAL: Commercial net short at ${percentile.toFixed(0)}th percentile (${currentShort.toLocaleString()} contracts) - maximum slam ammunition`,
    };
  }

  if (wowIncrease !== null && wowIncrease > 10000) {
    return {
      signal: 'red',
      reason: `CRITICAL: Commercial shorts increased by ${wowIncrease.toLocaleString()} contracts week-over-week - aggressive short building`,
    };
  }

  // YELLOW: 60th-80th percentile
  if (percentile > 60) {
    return {
      signal: 'yellow',
      reason: `WATCH: Commercial net short at ${percentile.toFixed(0)}th percentile (${currentShort.toLocaleString()} contracts) - elevated`,
    };
  }

  // GREEN: <60th percentile
  return {
    signal: 'green',
    reason: `BULLISH: Commercial net short at ${percentile.toFixed(0)}th percentile (${currentShort.toLocaleString()} contracts) - low slam risk`,
  };
}
