import type { LeaseRateData, FNDRatioData, CVOLProxyData } from './types';

export interface ScoreResult {
  signal: 'green' | 'yellow' | 'red';
  reason: string;
}

/**
 * Score lease rate indicator (#9)
 *
 * GREEN: Below 2% annualized (normal lending)
 * YELLOW: 2-10% (elevated, worth monitoring)
 * RED: Above 10% (acute scarcity), above 50% = crisis
 */
export function scoreLeaseRate(current: LeaseRateData): ScoreResult {
  const { impliedLeaseRate, backwardation } = current;

  // No backwardation = no lease rate signal
  if (backwardation <= 0) {
    return {
      signal: 'green',
      reason: `BULLISH: No backwardation, implied lease rate ~0%. Normal lending conditions.`,
    };
  }

  // RED: Crisis-level scarcity
  if (impliedLeaseRate > 50) {
    return {
      signal: 'red',
      reason: `EXTREME: Implied lease rate at ${impliedLeaseRate.toFixed(0)}% annualized. Crisis-level scarcity - holders hoarding metal.`,
    };
  }

  if (impliedLeaseRate > 10) {
    return {
      signal: 'red',
      reason: `CRITICAL: Implied lease rate at ${impliedLeaseRate.toFixed(1)}%. Acute scarcity - nobody lending physical silver.`,
    };
  }

  // YELLOW: Elevated
  if (impliedLeaseRate > 2) {
    return {
      signal: 'yellow',
      reason: `WATCH: Implied lease rate at ${impliedLeaseRate.toFixed(1)}%. Elevated borrowing costs suggest tightening supply.`,
    };
  }

  // GREEN: Normal
  return {
    signal: 'green',
    reason: `BULLISH: Implied lease rate at ${impliedLeaseRate.toFixed(1)}%. Normal lending conditions.`,
  };
}

/**
 * Score FND ratio indicator (#11)
 *
 * GREEN: Ratio below 0.3, or >30 days to FND
 * YELLOW: Ratio 0.3-0.7, or 10-30 days with ratio >0.3
 * RED: Ratio above 0.7 with <10 days to FND, or ratio >1.0 any time
 */
export function scoreFNDRatio(current: FNDRatioData): ScoreResult {
  const { deliveryPressureRatio, daysToFND, deliveryMonthOI, registeredOunces } = current;

  const oiInOunces = deliveryMonthOI * 5000;
  const ratioStr = deliveryPressureRatio.toFixed(2);

  // RED: More claims than metal (ratio > 1.0)
  if (deliveryPressureRatio > 1.0) {
    return {
      signal: 'red',
      reason: `CRITICAL: Delivery pressure ratio at ${ratioStr}. OI claims ${(oiInOunces / 1_000_000).toFixed(1)}M oz vs ${(registeredOunces / 1_000_000).toFixed(1)}M oz registered. Theoretical default territory.`,
    };
  }

  // RED: High ratio close to FND
  if (deliveryPressureRatio > 0.7 && daysToFND < 10) {
    return {
      signal: 'red',
      reason: `CRITICAL: Ratio ${ratioStr} with only ${daysToFND} days to FND. High delivery stress imminent.`,
    };
  }

  // YELLOW: Elevated ratio or approaching FND
  if (deliveryPressureRatio > 0.3 && daysToFND < 30) {
    return {
      signal: 'yellow',
      reason: `WATCH: Ratio ${ratioStr} with ${daysToFND} days to FND. Delivery claims building relative to registered stocks.`,
    };
  }

  if (deliveryPressureRatio > 0.5) {
    return {
      signal: 'yellow',
      reason: `WATCH: Ratio at ${ratioStr}. Half of registered stocks claimed by delivery-month OI.`,
    };
  }

  // GREEN: Low ratio or far from FND
  if (daysToFND > 30) {
    return {
      signal: 'green',
      reason: `BULLISH: ${daysToFND} days to FND, ratio at ${ratioStr}. Plenty of time for rolls or inventory adjustment.`,
    };
  }

  return {
    signal: 'green',
    reason: `BULLISH: Ratio at ${ratioStr}. Registered stocks adequately cover delivery claims.`,
  };
}

/**
 * Score CVOL proxy indicator (#12)
 *
 * GREEN: Below 30-day average AND below 1-year median
 * YELLOW: Above 30-day average but below 80th percentile
 * RED: Above 80th percentile, or spikes 30%+ in a single day
 */
export function scoreCVOLProxy(current: CVOLProxyData): ScoreResult {
  const { rangePercent, priorRangePercent, thirtyDayAvgRange } = current;

  const rangeStr = rangePercent.toFixed(1);

  // Check for spike vs prior day
  if (priorRangePercent !== null) {
    const change = ((rangePercent - priorRangePercent) / priorRangePercent) * 100;
    if (change > 30) {
      return {
        signal: 'red',
        reason: `CRITICAL: Daily range spiked ${change.toFixed(0)}% to ${rangeStr}%. Market pricing big moves.`,
      };
    }
  }

  // RED: Extreme volatility (>10% daily range)
  if (rangePercent > 10) {
    return {
      signal: 'red',
      reason: `CRITICAL: Daily range at ${rangeStr}% of close. Extreme volatility - institutional positioning likely.`,
    };
  }

  // Check vs 30-day average
  if (thirtyDayAvgRange !== null) {
    if (rangePercent > thirtyDayAvgRange * 1.5) {
      return {
        signal: 'yellow',
        reason: `WATCH: Range at ${rangeStr}%, 50%+ above 30-day average (${thirtyDayAvgRange.toFixed(1)}%).`,
      };
    }

    if (rangePercent < thirtyDayAvgRange) {
      return {
        signal: 'green',
        reason: `BULLISH: Range at ${rangeStr}%, below 30-day average (${thirtyDayAvgRange.toFixed(1)}%). Low volatility.`,
      };
    }
  }

  // YELLOW: Elevated but not extreme
  if (rangePercent > 5) {
    return {
      signal: 'yellow',
      reason: `WATCH: Daily range at ${rangeStr}%. Elevated volatility signals active positioning.`,
    };
  }

  // GREEN: Normal volatility
  return {
    signal: 'green',
    reason: `BULLISH: Daily range at ${rangeStr}%. Normal market volatility.`,
  };
}
