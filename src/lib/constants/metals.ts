/** Supported metals for the monitoring system */
export type Metal = 'silver' | 'gold';

/** Configuration for a metal's data sources and display */
export interface MetalConfig {
  /** Metal identifier */
  id: Metal;
  /** Display name for UI */
  displayName: string;
  /** Chemical symbol */
  symbol: string;
  /** Ounces per futures contract */
  contractSize: number;
  /** CFTC contract market code for COT reports */
  cftcCode: string;
  /** CFTC market name for filtering */
  cftcName: string;
  /** CME vault stocks XLS filename */
  vaultStocksFile: string;
  /** Yahoo Finance futures symbol (generic) */
  futuresSymbol: string;
  /** Delivery months (0-indexed: 0=Jan, 11=Dec) */
  deliveryMonths: number[];
  /** Goldprice.org API field for spot price */
  spotPriceField: 'xagPrice' | 'xauPrice';
  /** CME margins URL product code */
  marginsProductCode: string;
  /** Header/theme color */
  headerColor: string;
  /** FRED series ID for volatility (gold uses GVZ) */
  fredVolatilityId: string | null;
}

/** Silver configuration */
const SILVER_CONFIG: MetalConfig = {
  id: 'silver',
  displayName: 'Silver',
  symbol: 'Ag',
  contractSize: 5000,
  cftcCode: '084691',
  cftcName: 'SILVER - COMMODITY EXCHANGE INC.',
  vaultStocksFile: 'Silver_stocks.xls',
  futuresSymbol: 'SI=F',
  // Silver: Mar(2), May(4), Jul(6), Sep(8), Dec(11)
  deliveryMonths: [2, 4, 6, 8, 11],
  spotPriceField: 'xagPrice',
  marginsProductCode: '5454',
  headerColor: 'bg-navy',
  fredVolatilityId: null, // Uses OHLC proxy
};

/** Gold configuration */
const GOLD_CONFIG: MetalConfig = {
  id: 'gold',
  displayName: 'Gold',
  symbol: 'Au',
  contractSize: 100,
  cftcCode: '088691',
  cftcName: 'GOLD - COMMODITY EXCHANGE INC.',
  vaultStocksFile: 'Gold_stocks.xls',
  futuresSymbol: 'GC=F',
  // Gold: Feb(1), Apr(3), Jun(5), Aug(7), Oct(9), Dec(11)
  deliveryMonths: [1, 3, 5, 7, 9, 11],
  spotPriceField: 'xauPrice',
  marginsProductCode: '437',
  headerColor: 'bg-amber-800',
  fredVolatilityId: 'GVZCLS', // CBOE Gold Volatility Index
};

/** All metal configurations indexed by metal ID */
export const METAL_CONFIGS: Record<Metal, MetalConfig> = {
  silver: SILVER_CONFIG,
  gold: GOLD_CONFIG,
};

/** Get configuration for a metal, defaulting to silver */
export function getMetalConfig(metal?: Metal | string | null): MetalConfig {
  if (metal === 'gold') return METAL_CONFIGS.gold;
  return METAL_CONFIGS.silver;
}

/** Validate metal parameter from URL/request */
export function parseMetal(value: unknown): Metal {
  if (value === 'gold') return 'gold';
  return 'silver';
}

/** Get Yahoo Finance symbol for a specific contract month */
export function getYahooFuturesSymbol(
  config: MetalConfig,
  targetMonth: number,
  targetYear: number
): string {
  const monthCodes: Record<number, string> = {
    0: 'F', 1: 'G', 2: 'H', 3: 'J', 4: 'K', 5: 'M',
    6: 'N', 7: 'Q', 8: 'U', 9: 'V', 10: 'X', 11: 'Z',
  };

  const symbol = config.id === 'silver' ? 'SI' : 'GC';
  const monthCode = monthCodes[targetMonth];
  const yearCode = String(targetYear).slice(-2);

  return `${symbol}${monthCode}${yearCode}.CMX`;
}

/** Get next delivery month for a metal */
export function getNextDeliveryMonth(config: MetalConfig): {
  month: number;
  year: number;
  monthName: string;
} {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Find next delivery month
  for (const dm of config.deliveryMonths) {
    if (dm > currentMonth || (dm === currentMonth && now.getDate() < 20)) {
      return { month: dm, year: currentYear, monthName: monthNames[dm] };
    }
  }

  // Wrap to next year's first delivery month
  const firstDelivery = config.deliveryMonths[0];
  return { month: firstDelivery, year: currentYear + 1, monthName: monthNames[firstDelivery] };
}

/** Check if current month is a delivery month for a metal */
export function isMetalDeliveryMonth(config: MetalConfig): boolean {
  const currentMonth = new Date().getMonth();
  return config.deliveryMonths.includes(currentMonth);
}
