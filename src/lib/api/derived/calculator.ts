import type { LeaseRateData, FNDRatioData, CVOLProxyData } from './types';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig, getNextDeliveryMonth } from '@/lib/constants/metals';

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
 * Ratio = (delivery_month_OI * contractSize) / registered_ounces
 * Shows theoretical delivery claims vs available metal
 */
export function computeFNDRatio(
  deliveryMonthOI: number,
  registeredOunces: number,
  frontMonthContract: string,
  config: MetalConfig = getMetalConfig()
): FNDRatioData {
  const daysToFND = getDaysToNextFND(config);
  const nextFNDDate = getNextFNDDate(config);

  // Compute delivery pressure ratio using config's contract size
  const oiInOunces = deliveryMonthOI * config.contractSize;
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

/** Get days to next First Notice Day for a metal */
function getDaysToNextFND(config: MetalConfig): number {
  const now = new Date();
  const nextFND = getNextFNDDate(config);
  return Math.max(0, Math.ceil((nextFND.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Get the next FND date for a metal */
function getNextFNDDate(config: MetalConfig): Date {
  const delivery = getNextDeliveryMonth(config);

  // FND is last business day of the month before the delivery month
  const fndMonth = delivery.month === 0 ? 11 : delivery.month - 1;
  const fndYear = delivery.month === 0 ? delivery.year - 1 : delivery.year;

  // Get last day of the month before delivery
  const fnd = new Date(fndYear, fndMonth + 1, 0);

  // Adjust for weekends (move to Friday)
  const day = fnd.getDay();
  if (day === 0) fnd.setDate(fnd.getDate() - 2); // Sunday -> Friday
  if (day === 6) fnd.setDate(fnd.getDate() - 1); // Saturday -> Friday

  return fnd;
}
