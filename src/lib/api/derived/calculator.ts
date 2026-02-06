import type { LeaseRateData, FNDRatioData, CVOLProxyData } from './types';

const OUNCES_PER_CONTRACT = 5000;

/**
 * Compute implied lease rate from SOFR minus forward rate (#9)
 *
 * Excel spec: Forward Rate = (Futures/Spot - 1) x (360/days) x 100
 *             Lease Rate = SOFR - Forward Rate
 *
 * In contango (futures > spot): Forward rate positive, lease rate lower (normal)
 * In backwardation (spot > futures): Forward rate negative, lease rate higher (scarcity)
 *
 * A high lease rate indicates nobody is lending physical silver - scarcity signal.
 */
export function computeLeaseRate(
  spotPrice: number,
  futuresPrice: number,
  daysToExpiry: number,
  sofrRate: number = 4.3 // default SOFR rate if fetch fails
): LeaseRateData {
  const safeDays = Math.max(daysToExpiry, 1);
  const safeSpot = Math.max(spotPrice, 0.01);
  const safeFutures = Math.max(futuresPrice, 0.01);

  // Forward rate per Excel spec: (Futures/Spot - 1) x (360/days) x 100
  const forwardRate = ((safeFutures / safeSpot) - 1) * (360 / safeDays) * 100;

  // Implied lease rate = SOFR - Forward Rate
  // Positive when in backwardation (scarcity), lower in contango (normal)
  const impliedLeaseRate = sofrRate - forwardRate;

  return {
    reportDate: new Date(),
    impliedLeaseRate: Math.max(impliedLeaseRate, 0), // Floor at 0%
    forwardRate,
    sofrRate,
    spotPrice,
    futuresPrice,
    daysToExpiry,
  };
}

/**
 * Compute FND proximity and delivery pressure ratio (#11)
 *
 * Ratio = (delivery_month_OI * 5000) / registered_ounces
 * Shows theoretical delivery claims vs available metal
 */
export function computeFNDRatio(
  deliveryMonthOI: number,
  registeredOunces: number,
  frontMonthContract: string
): FNDRatioData {
  const daysToFND = getDaysToNextFND();
  const nextFNDDate = getNextFNDDate();

  // Compute delivery pressure ratio
  const oiInOunces = deliveryMonthOI * OUNCES_PER_CONTRACT;
  const safeRegistered = Math.max(registeredOunces, 1);
  const deliveryPressureRatio = oiInOunces / safeRegistered;

  return {
    reportDate: new Date(),
    daysToFND,
    deliveryMonthOI,
    registeredOunces,
    deliveryPressureRatio,
    frontMonthContract,
    nextFNDDate,
  };
}

/**
 * Compute CVOL proxy from daily price range (#12)
 *
 * Uses (high - low) / close * 100 as volatility proxy
 * Range >5% = elevated, >10% = extreme
 */
export function computeCVOLProxy(
  high: number,
  low: number,
  close: number,
  priorRanges: number[] = []
): CVOLProxyData {
  const safeClose = Math.max(close, 0.01);
  const rangePercent = ((high - low) / safeClose) * 100;

  // Get prior range if available
  const priorRangePercent = priorRanges.length > 0 ? priorRanges[0] : null;

  // Compute 30-day average if we have enough history
  const thirtyDayAvgRange = priorRanges.length >= 30
    ? priorRanges.slice(0, 30).reduce((a, b) => a + b, 0) / 30
    : null;

  return {
    reportDate: new Date(),
    dailyHigh: high,
    dailyLow: low,
    dailyClose: close,
    rangePercent,
    priorRangePercent,
    thirtyDayAvgRange,
  };
}

/** Get days to next First Notice Day */
function getDaysToNextFND(): number {
  const now = new Date();
  const nextFND = getNextFNDDate();
  return Math.ceil((nextFND.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get the next FND date */
function getNextFNDDate(): Date {
  const now = new Date();
  const year = now.getFullYear();

  // Silver FND dates for delivery months (approximate - last business day before)
  // March FND: ~Feb 28
  // May FND: ~Apr 30
  // July FND: ~Jun 30
  // September FND: ~Aug 29
  // December FND: ~Nov 28
  const fndDates = [
    new Date(year, 1, 28),  // Mar FND
    new Date(year, 3, 30),  // May FND
    new Date(year, 5, 30),  // Jul FND
    new Date(year, 7, 29),  // Sep FND
    new Date(year, 10, 28), // Dec FND
  ];

  // Find next FND
  for (const fnd of fndDates) {
    if (fnd > now) {
      return fnd;
    }
  }

  // If past all this year's FNDs, return next year's March FND
  return new Date(year + 1, 1, 28);
}
