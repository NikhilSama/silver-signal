/** Spot price and backwardation data */
export interface SpotPriceData {
  reportDate: Date;
  spotPrice: number; // USD per oz
  frontMonthFuturesPrice: number; // nearest delivery month
  frontMonthContract: string; // e.g., "MAR 26"
  spread: number; // spot - futures (positive = backwardation)
  spreadPercent: number; // spread as % of spot
  isBackwardation: boolean;
  daysToExpiry: number;
}

export interface SpotPriceFetchResult {
  success: boolean;
  data: SpotPriceData | null;
  error?: string;
  sourceUrl: string;
}
