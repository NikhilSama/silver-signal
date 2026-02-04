import type { SpotPriceData } from './types';

export interface ScoreResult {
  signal: 'green' | 'yellow' | 'red';
  reason: string;
}

/**
 * Score backwardation/contango indicator (#7)
 *
 * GREEN: Normal contango of $0.10-$0.50
 * YELLOW: Near zero (flat) or mild backwardation up to -$0.50
 * RED: Backwardation exceeding $0.50 (spot > futures by >$0.50)
 */
export function scoreBackwardation(current: SpotPriceData): ScoreResult {
  const { spread, spotPrice, frontMonthFuturesPrice, isBackwardation } = current;

  // spread = spot - futures
  // positive spread = backwardation (spot > futures)
  // negative spread = contango (futures > spot)

  // RED: Significant backwardation (spot > futures by >$0.50)
  if (spread > 0.5) {
    return {
      signal: 'red',
      reason: `CRITICAL: Backwardation at $${spread.toFixed(2)}. Spot ($${spotPrice.toFixed(2)}) > futures ($${frontMonthFuturesPrice.toFixed(2)}). Physical shortage signal.`,
    };
  }

  // Beyond $2 is historically extreme
  if (spread > 2.0) {
    return {
      signal: 'red',
      reason: `EXTREME: Backwardation at $${spread.toFixed(2)} - largest since Hunt Brothers era (1980). Acute physical shortage.`,
    };
  }

  // YELLOW: Near flat or mild backwardation
  if (spread > -0.1 && spread <= 0.5) {
    if (isBackwardation) {
      return {
        signal: 'yellow',
        reason: `WATCH: Mild backwardation at $${spread.toFixed(2)}. Physical demand elevated but not acute.`,
      };
    }
    return {
      signal: 'yellow',
      reason: `WATCH: Near-flat spread at $${Math.abs(spread).toFixed(2)}. Contango unusually tight.`,
    };
  }

  // GREEN: Normal contango ($0.10-$0.50)
  if (spread >= -0.5 && spread <= -0.1) {
    return {
      signal: 'green',
      reason: `BULLISH: Normal contango at $${Math.abs(spread).toFixed(2)}. Cost of carry reflects storage/insurance.`,
    };
  }

  // Wide contango (unusual, may indicate oversupply or high storage)
  if (spread < -0.5) {
    return {
      signal: 'yellow',
      reason: `WATCH: Wide contango at $${Math.abs(spread).toFixed(2)}. May indicate elevated storage costs or low near-term demand.`,
    };
  }

  // Default green for normal conditions
  return {
    signal: 'green',
    reason: `BULLISH: Spot at $${spotPrice.toFixed(2)}, futures at $${frontMonthFuturesPrice.toFixed(2)}. Normal market structure.`,
  };
}
