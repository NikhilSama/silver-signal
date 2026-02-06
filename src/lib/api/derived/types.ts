/** Implied lease rate data (derived from forward rate - SOFR) */
export interface LeaseRateData {
  reportDate: Date;
  impliedLeaseRate: number; // annualized percentage
  forwardRate: number; // annualized forward premium (before SOFR)
  sofrRate: number; // current SOFR rate used
  spotPrice: number;
  futuresPrice: number;
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
  dataSource?: string; // Yahoo Finance SI=F or SLV
}

export interface DerivedFetchResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  sourceUrl: string;
}
