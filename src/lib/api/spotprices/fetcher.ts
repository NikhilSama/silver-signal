import type { SpotPriceData, SpotPriceFetchResult } from './types';

// Primary API - goldprice.org (reliable, no key required)
const GOLDPRICE_API_URL = 'https://data-asg.goldprice.org/dbXRates/USD';

// Yahoo Finance API for futures prices (CME API is blocked)
const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

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

    // Fetch front-month futures price from Yahoo Finance
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

/** Get Yahoo Finance symbol for front-month silver futures */
function getYahooFuturesSymbol(): { symbol: string; contract: string } {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // Silver delivery months: Mar(H), May(K), Jul(N), Sep(U), Dec(Z)
  // Month codes: H=March, K=May, N=July, U=September, Z=December
  const deliveryMonths = [
    { monthNum: 2, code: 'H', name: 'MAR' },  // March
    { monthNum: 4, code: 'K', name: 'MAY' },  // May
    { monthNum: 6, code: 'N', name: 'JUL' },  // July
    { monthNum: 8, code: 'U', name: 'SEP' },  // September
    { monthNum: 11, code: 'Z', name: 'DEC' }, // December
  ];

  // Find next delivery month
  let targetYear = year;
  let targetMonth = deliveryMonths[0];

  for (const dm of deliveryMonths) {
    // If we're before this delivery month (with some buffer for FND)
    if (month < dm.monthNum || (month === dm.monthNum && now.getDate() < 20)) {
      targetMonth = dm;
      break;
    }
  }

  // If we're past all delivery months this year, use next year's March
  if (month >= 11 || (month === 11 && now.getDate() >= 20)) {
    targetYear = year + 1;
    targetMonth = deliveryMonths[0]; // March
  }

  const yearCode = String(targetYear).slice(-2);
  const symbol = `SI${targetMonth.code}${yearCode}.CMX`;
  const contract = `${targetMonth.name} ${yearCode}`;

  return { symbol, contract };
}

/** Fetch front-month futures price from Yahoo Finance */
async function fetchFuturesPrice(): Promise<{
  success: boolean;
  price: number;
  contract: string;
  sourceUrl: string;
}> {
  const { symbol, contract } = getYahooFuturesSymbol();
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
