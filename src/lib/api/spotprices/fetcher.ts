import type { SpotPriceData, SpotPriceFetchResult } from './types';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig, getNextDeliveryMonth } from '@/lib/constants/metals';

// Primary API - goldprice.org (reliable, no key required)
const GOLDPRICE_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD';

// Yahoo Finance API for futures prices (CME API is blocked)
const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** Fetch spot price and calculate backwardation for a metal */
export async function fetchSpotPrices(
  config: MetalConfig = getMetalConfig()
): Promise<SpotPriceFetchResult> {
  try {
    // Fetch spot price from goldprice.org API
    const spotResult = await fetchSpotPrice(config);
    if (!spotResult.success || spotResult.price === 0) {
      return {
        success: false,
        data: null,
        error: spotResult.error ?? 'Failed to fetch spot price',
        sourceUrl: GOLDPRICE_API_URL,
      };
    }

    // Fetch front-month futures price from Yahoo Finance
    const futuresResult = await fetchFuturesPrice(config);
    if (!futuresResult.success) {
      // Use spot as fallback - assume flat
      return {
        success: true,
        data: {
          reportDate: new Date(),
          spotPrice: spotResult.price,
          frontMonthFuturesPrice: spotResult.price,
          frontMonthContract: getFrontMonthContract(config),
          spread: 0,
          spreadPercent: 0,
          isBackwardation: false,
          daysToExpiry: getDaysToExpiry(config),
        },
        sourceUrl: GOLDPRICE_API_URL,
      };
    }

    const spread = spotResult.price - futuresResult.price;
    const spreadPercent = (spread / spotResult.price) * 100;

    return {
      success: true,
      data: {
        reportDate: new Date(),
        spotPrice: spotResult.price,
        frontMonthFuturesPrice: futuresResult.price,
        frontMonthContract: futuresResult.contract,
        spread,
        spreadPercent,
        isBackwardation: spread > 0,
        daysToExpiry: getDaysToExpiry(config),
      },
      sourceUrl: futuresResult.sourceUrl,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceUrl: GOLDPRICE_API_URL,
    };
  }
}

/** Fetch spot price from goldprice.org API for a metal */
async function fetchSpotPrice(
  config: MetalConfig
): Promise<{ success: boolean; price: number; error?: string }> {
  try {
    const response = await fetch(GOLDPRICE_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetalMonitor/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return { success: false, price: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // API returns: { items: [{ curr: "USD", xagPrice: 30.14, xauPrice: 2900.5, ... }] }
    const item = data.items?.[0];
    const priceField = config.spotPriceField;
    if (!item || typeof item[priceField] !== 'number') {
      return { success: false, price: 0, error: 'Invalid API response' };
    }

    return { success: true, price: item[priceField] };
  } catch (error) {
    return {
      success: false,
      price: 0,
      error: error instanceof Error ? error.message : 'API error',
    };
  }
}

/** Month codes for futures contracts */
const MONTH_CODES: Record<number, { code: string; name: string }> = {
  0: { code: 'F', name: 'JAN' },
  1: { code: 'G', name: 'FEB' },
  2: { code: 'H', name: 'MAR' },
  3: { code: 'J', name: 'APR' },
  4: { code: 'K', name: 'MAY' },
  5: { code: 'M', name: 'JUN' },
  6: { code: 'N', name: 'JUL' },
  7: { code: 'Q', name: 'AUG' },
  8: { code: 'U', name: 'SEP' },
  9: { code: 'V', name: 'OCT' },
  10: { code: 'X', name: 'NOV' },
  11: { code: 'Z', name: 'DEC' },
};

/** Get Yahoo Finance symbol for front-month futures for a metal */
function getYahooFuturesSymbol(config: MetalConfig): { symbol: string; contract: string } {
  const delivery = getNextDeliveryMonth(config);
  const monthInfo = MONTH_CODES[delivery.month];
  const yearCode = String(delivery.year).slice(-2);

  // Silver = SI, Gold = GC
  const symbolPrefix = config.id === 'silver' ? 'SI' : 'GC';
  const symbol = `${symbolPrefix}${monthInfo.code}${yearCode}.CMX`;
  const contract = `${monthInfo.name} ${yearCode}`;

  return { symbol, contract };
}

/** Fetch front-month futures price from Yahoo Finance */
async function fetchFuturesPrice(config: MetalConfig): Promise<{
  success: boolean;
  price: number;
  contract: string;
  sourceUrl: string;
}> {
  const { symbol, contract } = getYahooFuturesSymbol(config);
  const url = `${YAHOO_FINANCE_BASE}/${symbol}?interval=1d&range=1d`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return { success: false, price: 0, contract: '', sourceUrl: url };
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return { success: false, price: 0, contract: '', sourceUrl: url };
    }

    return {
      success: true,
      price: meta.regularMarketPrice,
      contract: meta.longName ?? contract,
      sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
    };
  } catch {
    return { success: false, price: 0, contract: '', sourceUrl: url };
  }
}

/** Get current front-month contract string for a metal */
function getFrontMonthContract(config: MetalConfig): string {
  const delivery = getNextDeliveryMonth(config);
  const yearCode = delivery.year % 100;
  return `${delivery.monthName} ${yearCode}`;
}

/** Get days until front-month expiry for a metal */
function getDaysToExpiry(config: MetalConfig): number {
  const now = new Date();
  const delivery = getNextDeliveryMonth(config);

  // Approximate FND is last business day of month before delivery month
  // Delivery month is 1-indexed in the Date constructor
  const fndMonth = delivery.month === 0 ? 11 : delivery.month - 1;
  const fndYear = delivery.month === 0 ? delivery.year - 1 : delivery.year;

  // Get last day of the month before delivery
  const fnd = new Date(fndYear, fndMonth + 1, 0); // Day 0 of next month = last day of this month

  // Adjust for weekends
  const day = fnd.getDay();
  if (day === 0) fnd.setDate(fnd.getDate() - 2); // Sunday -> Friday
  if (day === 6) fnd.setDate(fnd.getDate() - 1); // Saturday -> Friday

  return Math.max(0, Math.ceil((fnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
