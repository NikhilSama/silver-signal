/**
 * OHLC (Open, High, Low, Close) fetcher for CVOL proxy calculation
 *
 * Fetches daily price data from Yahoo Finance for volatility analysis
 * For Gold, also supports fetching CBOE GVZ from FRED
 */

import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig } from '@/lib/constants/metals';

/** Yahoo Finance API base URL */
const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
/** FRED API for CBOE Gold Volatility Index */
const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export interface OHLCResult {
  high: number;
  low: number;
  close: number;
  source: string;
  gvzValue?: number; // Gold volatility index from FRED
  error?: string;
}

/** Fetch daily OHLC data for CVOL proxy calculation */
export async function fetchDailyOHLC(
  config: MetalConfig = getMetalConfig()
): Promise<OHLCResult> {
  // For gold, try to fetch CBOE GVZ from FRED first if available
  if (config.id === 'gold' && config.fredVolatilityId) {
    const gvzResult = await fetchGVZFromFRED(config.fredVolatilityId);
    if (gvzResult.success && gvzResult.value) {
      // Still fetch OHLC for price data, but include GVZ
      const futuresOHLC = await fetchYahooOHLC(config.futuresSymbol);
      if (futuresOHLC.success) {
        return {
          ...futuresOHLC.data,
          source: `Yahoo Finance ${config.futuresSymbol} + FRED GVZ`,
          gvzValue: gvzResult.value,
        };
      }
    }
  }

  // Primary: Yahoo Finance futures (SI=F or GC=F)
  const futuresOHLC = await fetchYahooOHLC(config.futuresSymbol);
  if (futuresOHLC.success) {
    return { ...futuresOHLC.data, source: `Yahoo Finance ${config.futuresSymbol}` };
  }

  // Fallback: ETFs (SLV or GLD)
  const etfSymbol = config.id === 'silver' ? 'SLV' : 'GLD';
  const etfOHLC = await fetchYahooOHLC(etfSymbol);
  if (etfOHLC.success) {
    return { ...etfOHLC.data, source: `Yahoo Finance ${etfSymbol}` };
  }

  return {
    high: 0,
    low: 0,
    close: 0,
    source: 'none',
    error: 'Failed to fetch OHLC from all sources',
  };
}

/** Fetch CBOE Gold Volatility Index from FRED */
async function fetchGVZFromFRED(seriesId: string): Promise<{
  success: boolean;
  value?: number;
}> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { success: false };
  }

  try {
    const url = `${FRED_API_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc`;
    const response = await fetch(url, { next: { revalidate: 0 } });

    if (!response.ok) return { success: false };

    const data = await response.json();
    const observation = data?.observations?.[0];
    if (observation && observation.value !== '.') {
      return { success: true, value: parseFloat(observation.value) };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

/** Fetch OHLC from Yahoo Finance for a given symbol */
async function fetchYahooOHLC(symbol: string): Promise<{
  success: boolean;
  data: { high: number; low: number; close: number };
}> {
  const empty = { success: false, data: { high: 0, low: 0, close: 0 } };

  try {
    const url = `${YAHOO_FINANCE_BASE}/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!response.ok) return empty;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const meta = result?.meta;

    const high = quote?.high?.[0] ?? meta?.regularMarketDayHigh ?? 0;
    const low = quote?.low?.[0] ?? meta?.regularMarketDayLow ?? 0;
    const close = quote?.close?.[0] ?? meta?.regularMarketPrice ?? 0;

    if (high > 0 && low > 0 && close > 0) {
      return { success: true, data: { high, low, close } };
    }
    return empty;
  } catch {
    return empty;
  }
}
