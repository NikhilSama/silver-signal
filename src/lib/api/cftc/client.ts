import type { CFTCCOTRow, COTFetchResult } from './types';
import { parseCOTRows } from './parser';

const CFTC_BASE_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
const SILVER_EXCHANGE_NAME = 'SILVER - COMMODITY EXCHANGE INC.';
const DEFAULT_LIMIT = 1000;
const FETCH_TIMEOUT_MS = 15000;

/** Build CFTC API URL with query parameters */
function buildUrl(limit: number, offset: number, startDate?: string): string {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: 'report_date_as_yyyy_mm_dd DESC',
  });

  // Filter for COMEX silver (exclude MICRO SILVER contract)
  let whereClause = `market_and_exchange_names='${SILVER_EXCHANGE_NAME}'`;

  if (startDate) {
    whereClause += ` AND report_date_as_yyyy_mm_dd >= '${startDate}'`;
  }

  params.set('$where', whereClause);

  return `${CFTC_BASE_URL}?${params.toString()}`;
}

/** Fetch COT data from CFTC SODA API */
export async function fetchCOTData(
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
  startDate?: string
): Promise<COTFetchResult> {
  const url = buildUrl(limit, offset, startDate);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SilverMonitor/1.0 (compatible)',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        sourceUrl: url,
      };
    }

    const rows = (await response.json()) as CFTCCOTRow[];
    const parsed = parseCOTRows(rows);

    return {
      success: true,
      data: parsed,
      error: null,
      sourceUrl: url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      data: null,
      error: message.includes('abort') ? 'Request timeout' : message,
      sourceUrl: url,
    };
  }
}

/** Fetch latest COT report only */
export async function fetchLatestCOT(): Promise<COTFetchResult> {
  return fetchCOTData(1, 0);
}

/** Fetch COT history for backfill (paginated) */
export async function fetchCOTHistory(
  years: number = 3
): Promise<COTFetchResult> {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Fetch all records from start date (may need pagination for large datasets)
  return fetchCOTData(2000, 0, startDateStr);
}
