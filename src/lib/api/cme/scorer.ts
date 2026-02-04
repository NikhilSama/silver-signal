import type { SignalType } from '@/types/database';
import type { VaultStocksData, OpenInterestData, DeliveryData, RollPatternData } from './types';

export interface ScoreResult {
  signal: SignalType;
  reason: string;
}

/** Score indicator #1: Open Interest */
export function scoreOpenInterest(
  current: OpenInterestData,
  prior: OpenInterestData | null
): ScoreResult {
  const totalOI = current.totalOI;

  if (!prior) {
    return {
      signal: 'yellow',
      reason: `WATCH: OI at ${formatNumber(totalOI)} contracts - insufficient history for trend`,
    };
  }

  const priorOI = prior.totalOI;
  const change = totalOI - priorOI;
  const changePercent = priorOI > 0 ? (change / priorOI) * 100 : 0;

  // RED: OI drops >10% in a week
  if (changePercent < -10) {
    return {
      signal: 'red',
      reason: `CRITICAL: OI dropped ${Math.abs(changePercent).toFixed(1)}% (${formatNumber(Math.abs(change))} contracts) - forced liquidation`,
    };
  }

  // YELLOW: OI dropping 5-10%
  if (changePercent < -5) {
    return {
      signal: 'yellow',
      reason: `WATCH: OI down ${Math.abs(changePercent).toFixed(1)}% (${formatNumber(Math.abs(change))} contracts) - monitoring`,
    };
  }

  // GREEN: OI stable or rising
  if (changePercent >= 0) {
    return {
      signal: 'green',
      reason: `BULLISH: OI at ${formatNumber(totalOI)} contracts (+${changePercent.toFixed(1)}%) - healthy positioning`,
    };
  }

  return {
    signal: 'yellow',
    reason: `WATCH: OI at ${formatNumber(totalOI)} contracts (${changePercent.toFixed(1)}%)`,
  };
}

/** Score indicator #2: Vault Inventory (Registered vs Eligible) */
export function scoreVaultInventory(
  current: VaultStocksData,
  prior: VaultStocksData | null
): ScoreResult {
  const registered = current.totalRegistered;
  const total = current.totalOunces;
  const ratio = current.registeredRatio;
  const ratioPercent = ratio * 100;

  // Calculate weekly change if we have prior data
  let weeklyChange = 0;
  if (prior) {
    weeklyChange = registered - prior.totalRegistered;
  }

  // RED: Registered <25%, or drawdowns >5M oz/week
  if (ratioPercent < 25) {
    return {
      signal: 'red',
      reason: `CRITICAL: Registered at ${ratioPercent.toFixed(1)}% of total (${formatOunces(registered)}) - delivery default risk`,
    };
  }

  if (weeklyChange < -5_000_000) {
    return {
      signal: 'red',
      reason: `CRITICAL: Registered dropped ${formatOunces(Math.abs(weeklyChange))} this week - accelerating drain`,
    };
  }

  // YELLOW: Registered 25-40%, or declining 1-5M oz per week
  if (ratioPercent < 40) {
    return {
      signal: 'yellow',
      reason: `WATCH: Registered at ${ratioPercent.toFixed(1)}% of total (${formatOunces(registered)}) - below comfort zone`,
    };
  }

  if (weeklyChange < -1_000_000) {
    return {
      signal: 'yellow',
      reason: `WATCH: Registered declined ${formatOunces(Math.abs(weeklyChange))} this week (now ${formatOunces(registered)})`,
    };
  }

  // GREEN: Registered >40% and stable/increasing
  return {
    signal: 'green',
    reason: `BULLISH: Registered at ${ratioPercent.toFixed(1)}% of total (${formatOunces(registered)}) - healthy levels`,
  };
}

/** Score indicator #3: Delivery Activity (Issues & Stops) */
export function scoreDeliveryActivity(
  current: DeliveryData,
  registeredOunces: number
): ScoreResult {
  if (!current.isDeliveryMonth) {
    return {
      signal: 'green', // Not applicable - normal state
      reason: 'NOT IN DELIVERY MONTH - Issues & Stops not active',
    };
  }

  const stopsOunces = current.stops * 5000; // 5000 oz per contract
  const stopsPercent = registeredOunces > 0 ? (stopsOunces / registeredOunces) * 100 : 0;

  const cumulativeStopsOunces = current.cumulativeStops * 5000;
  const cumulativePercent = registeredOunces > 0 ? (cumulativeStopsOunces / registeredOunces) * 100 : 0;

  // RED: Stops >15% of registered per week, or cumulative >50%
  if (stopsPercent > 15 || cumulativePercent > 50) {
    return {
      signal: 'red',
      reason: `CRITICAL: ${current.stops} stops today (${stopsPercent.toFixed(1)}% of registered) - high delivery demand`,
    };
  }

  // YELLOW: Stops 5-15%
  if (stopsPercent > 5 || cumulativePercent > 25) {
    return {
      signal: 'yellow',
      reason: `WATCH: ${current.stops} stops today (${stopsPercent.toFixed(1)}% of registered) - elevated demand`,
    };
  }

  // GREEN: Stops below 5%
  return {
    signal: 'green',
    reason: `BULLISH: ${current.stops} stops today (${stopsPercent.toFixed(1)}% of registered) - normal delivery`,
  };
}

/** Score indicator #8: Roll Patterns */
export function scoreRollPatterns(pattern: RollPatternData): ScoreResult {
  const { rollDirection, daysToFND, frontMonthOI, frontMonthChange, nextMonthChange } = pattern;

  // RED: Backward rolls or >20% OI held within 5 days of FND
  if (rollDirection === 'backward') {
    return {
      signal: 'red',
      reason: `CRITICAL: Backward roll detected - longs moving INTO ${pattern.frontMonth} (unusual)`,
    };
  }

  if (daysToFND <= 5 && frontMonthOI > 10000) {
    return {
      signal: 'red',
      reason: `CRITICAL: ${formatNumber(frontMonthOI)} contracts still open with ${daysToFND} days to FND`,
    };
  }

  // YELLOW: Roll pace slower than typical
  if (daysToFND <= 10 && frontMonthChange > -1000) {
    return {
      signal: 'yellow',
      reason: `WATCH: Slow roll - ${pattern.frontMonth} OI only down ${formatNumber(Math.abs(frontMonthChange))} with ${daysToFND} days to FND`,
    };
  }

  // GREEN: Normal forward roll
  if (rollDirection === 'forward') {
    return {
      signal: 'green',
      reason: `BULLISH: Normal forward roll - ${pattern.frontMonth} down ${formatNumber(Math.abs(frontMonthChange))}, ${pattern.nextMonth} up ${formatNumber(nextMonthChange)}`,
    };
  }

  return {
    signal: 'green',
    reason: `NEUTRAL: Roll pattern normal - ${daysToFND} days to FND, ${formatNumber(frontMonthOI)} OI in ${pattern.frontMonth}`,
  };
}

/** Format number with commas */
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString('en-US');
}

/** Format ounces in millions */
function formatOunces(oz: number): string {
  if (oz >= 1_000_000) {
    return `${(oz / 1_000_000).toFixed(1)}M oz`;
  }
  return `${formatNumber(oz)} oz`;
}
