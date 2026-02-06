import type { OpenInterestData, CMEFetchResult } from './types';

// CFTC COT API (primary - FREE, no API key, reliable weekly data)
const CFTC_API_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
// CME settlements API (secondary fallback - often blocked)
const SETTLEMENT_URL = 'https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/5454/FUT';

const FETCH_TIMEOUT_MS = 15000;

/**
 * Fetch Open Interest data - CFTC Socrata API primary, CME as fallback
 *
 * Per Excel spec: CFTC Socrata is FREE and reliable (weekly data)
 * Databento would cost $179/mo and CME direct APIs are typically blocked
 */
export async function fetchOpenInterest(): Promise<CMEFetchResult<OpenInterestData>> {
  try {
    // Primary: CFTC Socrata API (FREE, no auth, reliable)
    const cftcResult = await fetchFromCFTCSocrata();
    if (cftcResult.success && cftcResult.data && cftcResult.data.totalOI > 0) {
      console.log('[OpenInterest] Using CFTC Socrata data');
      return cftcResult;
    }
    console.log('[OpenInterest] CFTC failed, trying CME API...');

    // Secondary: CME settlements API (often blocked)
    const cmeResult = await fetchFromCMESettlements();
    if (cmeResult.success && cmeResult.data && cmeResult.data.totalOI > 0) {
      console.log('[OpenInterest] Using CME settlements data');
      return cmeResult;
    }

    // Return CFTC error if both failed
    return cftcResult.success ? cftcResult : cmeResult;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      sourceUrl: CFTC_API_URL,
    };
  }
}

/** Fetch OI from CFTC Socrata API (weekly COT data) */
async function fetchFromCFTCSocrata(): Promise<CMEFetchResult<OpenInterestData>> {
  // Filter for COMEX Silver futures only (contract code 084691)
  const whereClause = "commodity_name='SILVER' AND cftc_contract_market_code='084691'";
  const url = `${CFTC_API_URL}?$where=${encodeURIComponent(whereClause)}&$order=report_date_as_yyyy_mm_dd DESC&$limit=1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SilverMonitor/1.0',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `CFTC API HTTP ${response.status}`,
        sourceUrl: url,
      };
    }

    const rows = await response.json() as CFTCRow[];
    if (!rows || rows.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No CFTC data returned',
        sourceUrl: url,
      };
    }

    const row = rows[0];
    const reportDate = new Date(row.report_date_as_yyyy_mm_dd);
    const totalOI = parseNumber(row.open_interest_all);

    return {
      success: true,
      data: {
        reportDate,
        totalOI,
        byMonth: [], // CFTC provides aggregate OI only
      },
      sourceUrl: url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CFTC fetch error';
    return {
      success: false,
      data: null,
      error: message.includes('abort') ? 'Request timeout' : message,
      sourceUrl: url,
    };
  }
}

interface CFTCRow {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string | number;
}

/** Fetch OI from CME settlements API (secondary fallback) */
async function fetchFromCMESettlements(): Promise<CMEFetchResult<OpenInterestData>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(SETTLEMENT_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `CME HTTP ${response.status}`,
        sourceUrl: SETTLEMENT_URL,
      };
    }

    const json = await response.json() as CMESettlementsResponse;

    // CME often returns 200 with blocking message
    if (json.message && typeof json.message === 'string') {
      return {
        success: false,
        data: null,
        error: 'CME API blocked',
        sourceUrl: SETTLEMENT_URL,
      };
    }

    const data = parseSettlementsResponse(json);
    return {
      success: true,
      data,
      sourceUrl: SETTLEMENT_URL,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CME API error';
    return {
      success: false,
      data: null,
      error: message.includes('abort') ? 'Request timeout' : message,
      sourceUrl: SETTLEMENT_URL,
    };
  }
}

interface CMESettlementsResponse {
  message?: string;
  settlements?: CMESettlementRow[];
}

interface CMESettlementRow {
  month?: string;
  openInterest?: string | number;
  volume?: string | number;
  settle?: string | number;
}

/** Parse CME settlements response */
function parseSettlementsResponse(json: CMESettlementsResponse): OpenInterestData {
  const settlements = json.settlements || [];
  let totalOI = 0;

  for (const row of settlements) {
    if (!row.month || row.month === 'TOTAL') continue;
    totalOI += parseNumber(row.openInterest);
  }

  return {
    reportDate: new Date(),
    totalOI,
    byMonth: [], // Simplified - not parsing per-month for now
  };
}

/** Parse a number from string or number, handling commas */
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}
