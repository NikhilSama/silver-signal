import type { ShanghaiPremiumData, ShanghaiFetchResult } from './types';

// Primary API - goldprice.org provides CNY silver prices
const GOLDPRICE_API_URL = 'https://data-asg.goldprice.org/dbXRates/CNY';

// Grams per troy ounce
const GRAMS_PER_OZ = 31.1035;

/** Fetch Shanghai premium vs COMEX spot */
export async function fetchShanghaiPremium(
  comexSpot: number
): Promise<ShanghaiFetchResult> {
  try {
    // Fetch CNY silver price from goldprice.org API
    const result = await fetchGoldPriceAPI();

    if (!result.success || result.priceCNY === 0) {
      return {
        success: false,
        data: null,
        error: result.error ?? 'Failed to fetch SGE price',
        sourceUrl: GOLDPRICE_API_URL,
      };
    }

    // goldprice.org gives price per oz in CNY already
    // Convert to USD/oz using their implicit rate
    const cnyUsdRate = result.cnyUsdRate ?? 7.2;
    const sgePriceUSD = result.priceCNY / cnyUsdRate;

    const premiumDollars = sgePriceUSD - comexSpot;
    const premiumPercent = comexSpot > 0 ? (premiumDollars / comexSpot) * 100 : 0;

    return {
      success: true,
      data: {
        reportDate: new Date(),
        sgePrice: sgePriceUSD,
        sgePriceCNY: result.priceCNY,
        comexSpotPrice: comexSpot,
        premiumDollars,
        premiumPercent,
        cnyUsdRate,
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

/** Fetch silver price in CNY from goldprice.org API */
async function fetchGoldPriceAPI(): Promise<{
  success: boolean;
  priceCNY: number;
  cnyUsdRate?: number;
  error?: string;
}> {
  try {
    const response = await fetch(GOLDPRICE_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return { success: false, priceCNY: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // API returns: { items: [{ curr: "CNY", xagPrice: 625.0644, ... }] }
    const item = data.items?.[0];
    if (!item || typeof item.xagPrice !== 'number') {
      return { success: false, priceCNY: 0, error: 'Invalid API response' };
    }

    // xagPrice is silver price per oz in CNY
    const priceCNY = item.xagPrice;

    // We can estimate CNY/USD rate from gold prices if needed
    // For now, use a reasonable estimate
    const cnyUsdRate = 7.2;

    return { success: true, priceCNY, cnyUsdRate };
  } catch (error) {
    return {
      success: false,
      priceCNY: 0,
      error: error instanceof Error ? error.message : 'API error',
    };
  }
}
