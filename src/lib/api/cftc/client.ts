import type { CFTCCOTRow, COTFetchResult } from './types';
import { parseCOTRows } from './parser';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig } from '@/lib/constants/metals';

const CFTC_BASE_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
const DEFAULT_LIMIT = 1000;
const FETCH_TIMEOUT_MS = 15000;

/** Build CFTC API URL with query parameters */
function buildUrl(
  config: MetalConfig,
  limit: number,
  offset: number,
  startDate?: string
): string {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: 'report_date_as_yyyy_mm_dd DESC',
  });

  // Filter for COMEX metal using config's cftcName
  let whereClause = `market_and_exchange_names='${config.cftcName}'`;

  if (startDate) {
    whereClause += ` AND report_date_as_yyyy_mm_dd >= '${startDate}'`;
  }

  params.set('$where', whereClause);

  return `${CFTC_BASE_URL}?${params.toString()}`;
}

/** Fetch COT data from CFTC SODA API */
export async function fetchCOTData(
  config: MetalConfig = getMetalConfig(),
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
  startDate?: string
): Promise<COTFetchResult> {
  const url = buildUrl(config, limit, offset, startDate);

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
export async function fetchLatestCOT(
  config: MetalConfig = getMetalConfig()
): Promise<COTFetchResult> {
  return fetchCOTData(config, 1, 0);
}

/** Fetch COT history for backfill (paginated) */
export async function fetchCOTHistory(
  config: MetalConfig = getMetalConfig(),
  years: number = 3
): Promise<COTFetchResult> {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Fetch all records from start date (may need pagination for large datasets)
  return fetchCOTData(config, 2000, 0, startDateStr);
}
