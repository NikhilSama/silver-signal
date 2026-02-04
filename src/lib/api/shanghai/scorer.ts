import type { ShanghaiPremiumData } from './types';

export interface ScoreResult {
  signal: 'green' | 'yellow' | 'red';
  reason: string;
}

/**
 * Score Shanghai premium indicator (#10)
 *
 * GREEN: Premium below 2% (normal transaction/shipping costs)
 * YELLOW: Premium 2-5% (elevated Asian demand)
 * RED: Premium above 5% (significant tightness, above 10% = structural disconnect)
 */
export function scoreShanghaiPremium(current: ShanghaiPremiumData): ScoreResult {
  const { premiumPercent, sgePrice, comexSpotPrice, premiumDollars } = current;

  // RED: Large premium indicates physical metal flowing East
  if (premiumPercent > 10) {
    return {
      signal: 'red',
      reason: `CRITICAL: Shanghai premium at ${premiumPercent.toFixed(1)}% ($${premiumDollars.toFixed(2)}/oz). Structural paper-physical disconnect. Asian buyers paying $${sgePrice.toFixed(2)} vs COMEX $${comexSpotPrice.toFixed(2)}.`,
    };
  }

  if (premiumPercent > 5) {
    return {
      signal: 'red',
      reason: `CRITICAL: Shanghai premium at ${premiumPercent.toFixed(1)}%. Physical metal flowing to Asia where buyers pay more. Supply tightness confirmed.`,
    };
  }

  // YELLOW: Elevated premium
  if (premiumPercent > 2) {
    return {
      signal: 'yellow',
      reason: `WATCH: Shanghai premium at ${premiumPercent.toFixed(1)}%. Elevated Asian demand. If arbitrage can't close the gap, supply is tight.`,
    };
  }

  // Handle negative premium (COMEX > SGE)
  if (premiumPercent < -2) {
    return {
      signal: 'yellow',
      reason: `WATCH: Shanghai discount at ${Math.abs(premiumPercent).toFixed(1)}%. Metal flowing West. Unusual pattern.`,
    };
  }

  // GREEN: Normal spread
  return {
    signal: 'green',
    reason: `BULLISH: Shanghai premium at ${premiumPercent.toFixed(1)}%. Normal transaction and shipping costs. No arbitrage pressure.`,
  };
}
