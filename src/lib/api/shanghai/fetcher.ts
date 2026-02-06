import type { ShanghaiPremiumData, ShanghaiFetchResult } from './types';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig } from '@/lib/constants/metals';

// goldprice.org APIs for CNY and USD prices
const GOLDPRICE_CNY_URL = 'https://data-asg.goldprice.org/dbXRates/CNY';
const GOLDPRICE_USD_URL = 'https://data-asg.goldprice.org/dbXRates/USD';

/** Fetch Shanghai premium vs COMEX spot for a metal */
export async function fetchShanghaiPremium(
  comexSpot: number,
  config: MetalConfig = getMetalConfig()
): Promise<ShanghaiFetchResult> {
  try {
    // Fetch CNY price from goldprice.org API
    const result = await fetchGoldPriceAPI(config);

    if (!result.success || result.priceCNY === 0) {
      return {
        success: false,
        data: null,
        error: result.error ?? `Failed to fetch SGE ${config.displayName} price`,
        sourceUrl: GOLDPRICE_CNY_URL,
      };
    }

    // Convert CNY/oz to USD/oz using derived exchange rate
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
      sourceUrl: 'https://goldprice.org',
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceUrl: GOLDPRICE_CNY_URL,
    };
  }
}

/** Fetch metal prices from goldprice.org and derive CNY/USD rate from gold */
async function fetchGoldPriceAPI(config: MetalConfig): Promise<{
  success: boolean;
  priceCNY: number;
  cnyUsdRate?: number;
  error?: string;
}> {
  try {
    // Fetch both CNY and USD prices in parallel to derive exchange rate
    const [cnyResponse, usdResponse] = await Promise.all([
      fetch(GOLDPRICE_CNY_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetalMonitor/1.0)',
          'Accept': 'application/json',
        },
        next: { revalidate: 0 },
      }),
      fetch(GOLDPRICE_USD_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetalMonitor/1.0)',
          'Accept': 'application/json',
        },
        next: { revalidate: 0 },
      }),
    ]);

    if (!cnyResponse.ok) {
      return { success: false, priceCNY: 0, error: `CNY HTTP ${cnyResponse.status}` };
    }

    const cnyData = await cnyResponse.json();
    const cnyItem = cnyData.items?.[0];
    const priceField = config.spotPriceField;
    if (!cnyItem || typeof cnyItem[priceField] !== 'number') {
      return { success: false, priceCNY: 0, error: 'Invalid CNY API response' };
    }

    // Get price in CNY using the config's spot price field
    const priceCNY = cnyItem[priceField];

    // Derive CNY/USD rate from gold prices (more stable than using silver)
    let cnyUsdRate = 7.2; // Fallback
    if (usdResponse.ok) {
      const usdData = await usdResponse.json();
      const usdItem = usdData.items?.[0];
      if (usdItem?.xauPrice > 0 && cnyItem?.xauPrice > 0) {
        cnyUsdRate = cnyItem.xauPrice / usdItem.xauPrice;
      }
    }

    return { success: true, priceCNY, cnyUsdRate };
  } catch (error) {
    return {
      success: false,
      priceCNY: 0,
      error: error instanceof Error ? error.message : 'API error',
    };
  }
}
