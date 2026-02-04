/** Implied lease rate data (derived from backwardation) */
export interface LeaseRateData {
  reportDate: Date;
  impliedLeaseRate: number; // annualized percentage
  backwardation: number; // dollar spread
  spotPrice: number;
  daysToExpiry: number;
}

/** FND proximity and delivery pressure ratio */
export interface FNDRatioData {
  reportDate: Date;
  daysToFND: number;
  deliveryMonthOI: number; // contracts
  registeredOunces: number;
  deliveryPressureRatio: number; // (OI * 5000) / registered
  frontMonthContract: string;
  nextFNDDate: Date;
}

/** CVOL proxy using daily price range */
export interface CVOLProxyData {
  reportDate: Date;
  dailyHigh: number;
  dailyLow: number;
  dailyClose: number;
  rangePercent: number; // (high - low) / close * 100
  priorRangePercent: number | null;
  thirtyDayAvgRange: number | null;
}

export interface DerivedFetchResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  sourceUrl: string;
}
