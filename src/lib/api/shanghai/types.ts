/** Shanghai Gold Exchange silver premium data */
export interface ShanghaiPremiumData {
  reportDate: Date;
  sgePrice: number; // SGE Ag(T+D) price in USD/oz
  sgePriceCNY: number; // Original price in CNY/gram
  comexSpotPrice: number; // COMEX spot in USD/oz
  premiumDollars: number; // SGE - COMEX in USD
  premiumPercent: number; // (SGE - COMEX) / COMEX * 100
  cnyUsdRate: number; // Exchange rate used
}

export interface ShanghaiFetchResult {
  success: boolean;
  data: ShanghaiPremiumData | null;
  error?: string;
  sourceUrl: string;
}
