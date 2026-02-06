/**
 * SOFR (Secured Overnight Financing Rate) fetcher
 *
 * Fetches current SOFR rate from Federal Reserve Economic Data (FRED)
 * Used in lease rate calculation: Lease Rate = SOFR - Forward Rate
 */

// FRED API endpoint for SOFR rate (series ID: SOFR)
const FRED_SOFR_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR&cosd=&coed=&fq=Daily';

/** Default SOFR rate if fetch fails (historical average around 4-5% in 2024-2025) */
const DEFAULT_SOFR_RATE = 4.5;

/** Cache for SOFR rate (update once per day) */
let cachedSofr: { rate: number; fetchedAt: Date } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SofrFetchResult {
  success: boolean;
  rate: number;
  date: Date | null;
  error?: string;
  isDefault: boolean;
}

/**
 * Fetch current SOFR rate from FRED
 *
 * Returns annualized rate as percentage (e.g., 4.5 for 4.5%)
 */
export async function fetchSofrRate(): Promise<SofrFetchResult> {
  // Check cache
  if (cachedSofr && Date.now() - cachedSofr.fetchedAt.getTime() < CACHE_TTL_MS) {
    return {
      success: true,
      rate: cachedSofr.rate,
      date: cachedSofr.fetchedAt,
      isDefault: false,
    };
  }

  try {
    const response = await fetch(FRED_SOFR_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
        'Accept': 'text/csv',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return createDefaultResult(`FRED API error: HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rate = parseFredeCSV(csvText);

    if (rate === null) {
      return createDefaultResult('Failed to parse SOFR from FRED CSV');
    }

    // Update cache
    cachedSofr = { rate, fetchedAt: new Date() };

    return {
      success: true,
      rate,
      date: new Date(),
      isDefault: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createDefaultResult(`SOFR fetch failed: ${message}`);
  }
}

/** Parse FRED CSV response to extract latest SOFR rate */
function parseFredeCSV(csv: string): number | null {
  const lines = csv.trim().split('\n');

  // CSV format: DATE,SOFR\n2025-01-01,4.33\n...
  // Get the last non-empty line with data
  for (let i = lines.length - 1; i >= 1; i--) {
    const line = lines[i].trim();
    if (!line || line.startsWith('.')) continue;

    const [, value] = line.split(',');
    if (value && value !== '.') {
      const rate = parseFloat(value);
      if (!isNaN(rate)) {
        return rate;
      }
    }
  }

  return null;
}

/** Create default result when SOFR fetch fails */
function createDefaultResult(error: string): SofrFetchResult {
  return {
    success: false,
    rate: DEFAULT_SOFR_RATE,
    date: null,
    error,
    isDefault: true,
  };
}
