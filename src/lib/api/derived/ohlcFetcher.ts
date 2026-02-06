/**
 * OHLC (Open, High, Low, Close) fetcher for CVOL proxy calculation
 *
 * Fetches daily price data from Yahoo Finance for volatility analysis
 */

/** Yahoo Finance API base URL */
const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export interface OHLCResult {
  high: number;
  low: number;
  close: number;
  source: string;
  error?: string;
}

/** Fetch daily OHLC data for CVOL proxy calculation */
export async function fetchDailyOHLC(): Promise<OHLCResult> {
  // Primary: Yahoo Finance silver futures (SI=F)
  const futuresOHLC = await fetchYahooOHLC('SI=F');
  if (futuresOHLC.success) {
    return { ...futuresOHLC.data, source: 'Yahoo Finance SI=F' };
  }

  // Fallback: SLV ETF (tracks silver price)
  const slvOHLC = await fetchYahooOHLC('SLV');
  if (slvOHLC.success) {
    return { ...slvOHLC.data, source: 'Yahoo Finance SLV' };
  }

  return {
    high: 0,
    low: 0,
    close: 0,
    source: 'none',
    error: 'Failed to fetch OHLC from all sources',
  };
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
