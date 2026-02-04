import type { SpotPriceData, SpotPriceFetchResult } from './types';

// Primary API - goldprice.org (reliable, no key required)
const GOLDPRICE_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD';

// CME settlement prices API
const CME_SETTLEMENTS_URL = 'https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/5454/FUT';

/** Fetch spot price and calculate backwardation */
export async function fetchSpotPrices(): Promise<SpotPriceFetchResult> {
  try {
    // Fetch spot price from goldprice.org API
    const spotResult = await fetchSpotPrice();
    if (!spotResult.success || spotResult.price === 0) {
      return {
        success: false,
        data: null,
        error: spotResult.error ?? 'Failed to fetch spot price',
        sourceUrl: GOLDPRICE_API_URL,
      };
    }

    // Fetch front-month futures price from CME
    const futuresResult = await fetchFuturesPrice();
    if (!futuresResult.success) {
      // Use spot as fallback - assume flat
      return {
        success: true,
        data: {
          reportDate: new Date(),
          spotPrice: spotResult.price,
          frontMonthFuturesPrice: spotResult.price,
          frontMonthContract: getFrontMonthContract(),
          spread: 0,
          spreadPercent: 0,
          isBackwardation: false,
          daysToExpiry: getDaysToExpiry(),
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
        daysToExpiry: getDaysToExpiry(),
      },
      sourceUrl: GOLDPRICE_API_URL,
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

/** Fetch silver spot price from goldprice.org API */
async function fetchSpotPrice(): Promise<{ success: boolean; price: number; error?: string }> {
  try {
    const response = await fetch(GOLDPRICE_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return { success: false, price: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // API returns: { items: [{ curr: "USD", xagPrice: 90.147, ... }] }
    const item = data.items?.[0];
    if (!item || typeof item.xagPrice !== 'number') {
      return { success: false, price: 0, error: 'Invalid API response' };
    }

    // xagPrice is silver price per oz in USD
    return { success: true, price: item.xagPrice };
  } catch (error) {
    return {
      success: false,
      price: 0,
      error: error instanceof Error ? error.message : 'API error',
    };
  }
}

/** Fetch front-month futures price from CME */
async function fetchFuturesPrice(): Promise<{
  success: boolean;
  price: number;
  contract: string;
}> {
  try {
    const response = await fetch(CME_SETTLEMENTS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return { success: false, price: 0, contract: '' };
    }

    const data = await response.json();
    const settlements = data.settlements ?? [];

    // Find front-month contract (first with volume)
    for (const settlement of settlements) {
      const month = settlement.month ?? '';
      const settle = parseFloat(settlement.settle ?? '0');

      if (settle > 0 && month) {
        return {
          success: true,
          price: settle,
          contract: month,
        };
      }
    }

    return { success: false, price: 0, contract: '' };
  } catch {
    return { success: false, price: 0, contract: '' };
  }
}

/** Get current front-month contract string */
function getFrontMonthContract(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear() % 100;

  const monthMap: Record<number, string> = {
    0: 'MAR', 1: 'MAR', 2: 'MAR',
    3: 'MAY', 4: 'MAY',
    5: 'JUL', 6: 'JUL',
    7: 'SEP', 8: 'SEP',
    9: 'DEC', 10: 'DEC', 11: 'DEC',
  };

  return `${monthMap[month]} ${year}`;
}

/** Get days until front-month expiry */
function getDaysToExpiry(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // Approximate FND dates (last business day before delivery month)
  const fndDates: Record<number, Date> = {
    2: new Date(year, 1, 28), // Mar FND ~Feb 28
    4: new Date(year, 3, 30), // May FND ~Apr 30
    6: new Date(year, 5, 30), // Jul FND ~Jun 30
    8: new Date(year, 7, 31), // Sep FND ~Aug 31
    11: new Date(year, 10, 30), // Dec FND ~Nov 30
  };

  // Find next FND
  const deliveryMonths = [2, 4, 6, 8, 11];
  for (const dm of deliveryMonths) {
    const fnd = fndDates[dm];
    if (fnd && fnd > now) {
      return Math.ceil((fnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // If past all FNDs this year, return days to next year's March
  const nextMarchFnd = new Date(year + 1, 1, 28);
  return Math.ceil((nextMarchFnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
