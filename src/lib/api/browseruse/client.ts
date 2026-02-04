import { BrowserUseClient } from 'browser-use-sdk';

// Timeout for Browser Use tasks (30 seconds) - if exceeded, fall back to other methods
const BROWSER_USE_TIMEOUT_MS = 30000;

/** Get Browser Use client instance */
function getClient(): BrowserUseClient | null {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  console.log('[BrowserUse] API Key present:', !!apiKey);
  if (!apiKey) {
    console.warn('[BrowserUse] BROWSER_USE_API_KEY not configured');
    return null;
  }
  return new BrowserUseClient({ apiKey });
}

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

export interface BrowserFetchResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  sourceUrl?: string;
}

// URLs used by Browser Use
const CME_MARGINS_URL = 'https://www.cmegroup.com/markets/metals/precious/silver.margins.html';
const CME_VOLUME_URL = 'https://www.cmegroup.com/markets/metals/precious/silver.volume.html';
const CME_SETTLEMENTS_URL = 'https://www.cmegroup.com/markets/metals/precious/silver.settlements.html';

/** Fetch silver margin percentage from CME using Browser Use */
export async function fetchMarginsViaBrowser(): Promise<BrowserFetchResult<number>> {
  console.log('[BrowserUse] fetchMarginsViaBrowser called');
  const client = getClient();
  if (!client) {
    console.log('[BrowserUse] No client available');
    return { success: false, data: null, error: 'Browser Use not configured' };
  }

  try {
    console.log('[BrowserUse] Creating margins task...');
    const task = await client.tasks.createTask({
      task: `Go to ${CME_MARGINS_URL}
             Wait for the margins table to fully load.
             Look for the row with 'SI' or 'Silver Futures' in the Outright section.
             Find the 'Start Period Maintenance Rate' or 'Initial Rate' column which shows the margin as a percentage.
             This should be a number between 10 and 20 (like 15% or 15.0%).
             Return ONLY that percentage number, nothing else.`,
    });

    console.log('[BrowserUse] Waiting for task completion (timeout: 30s)...');
    const result = await withTimeout(
      task.complete(),
      BROWSER_USE_TIMEOUT_MS,
      'Browser Use task timed out after 30 seconds'
    );
    console.log('[BrowserUse] Task completed, output:', result.output);
    const output = String(result.output || '').trim();
    const marginPercent = parseFloat(output.replace(/[^0-9.]/g, ''));

    if (isNaN(marginPercent) || marginPercent <= 0 || marginPercent > 100) {
      console.log('[BrowserUse] Invalid margin value:', output);
      return { success: false, data: null, error: `Invalid margin value: ${output}`, sourceUrl: CME_MARGINS_URL };
    }

    console.log('[BrowserUse] Success, margin:', marginPercent);
    return { success: true, data: marginPercent, sourceUrl: CME_MARGINS_URL };
  } catch (error) {
    console.error('[BrowserUse] Error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Browser task failed',
      sourceUrl: CME_MARGINS_URL,
    };
  }
}

/** Fetch silver open interest from CME using Browser Use */
export async function fetchOIViaBrowser(): Promise<BrowserFetchResult<number>> {
  const client = getClient();
  if (!client) {
    return { success: false, data: null, error: 'Browser Use not configured' };
  }

  try {
    const task = await client.tasks.createTask({
      task: `Go to ${CME_VOLUME_URL}
             Wait for the Volume and Open Interest data table to fully load.
             Find the 'Total' row at the bottom of the table.
             Look for the 'Open Interest' column value in the Total row.
             This is the total number of open contracts, should be a number like 150000 or 160000.
             Return ONLY that number without commas, nothing else.`,
    });

    const result = await withTimeout(
      task.complete(),
      BROWSER_USE_TIMEOUT_MS,
      'Browser Use OI task timed out after 30 seconds'
    );
    const output = String(result.output || '').trim();
    const oi = parseInt(output.replace(/[^0-9]/g, ''), 10);

    if (isNaN(oi) || oi <= 0) {
      return { success: false, data: null, error: `Invalid OI value: ${output}`, sourceUrl: CME_VOLUME_URL };
    }

    return { success: true, data: oi, sourceUrl: CME_VOLUME_URL };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Browser task failed',
      sourceUrl: CME_VOLUME_URL,
    };
  }
}

/** Fetch silver settlement prices from CME using Browser Use */
export async function fetchSettlementsViaBrowser(): Promise<BrowserFetchResult<{
  byMonth: Array<{ month: string; oi: number; settle: number }>;
  totalOI: number;
}>> {
  const client = getClient();
  if (!client) {
    return { success: false, data: null, error: 'Browser Use not configured' };
  }

  try {
    const task = await client.tasks.createTask({
      task: `Go to ${CME_SETTLEMENTS_URL}
             Wait for the settlements table to load.
             Extract the first 5 contract months with their Open Interest and Settlement prices.
             Return as JSON array: [{"month": "MAR 26", "oi": 12345, "settle": 32.50}, ...]
             Return ONLY the JSON array, no other text.`,
    });

    const result = await withTimeout(
      task.complete(),
      BROWSER_USE_TIMEOUT_MS,
      'Browser Use settlements task timed out after 30 seconds'
    );
    const output = String(result.output || '').trim();

    // Try to parse JSON from output
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, data: null, error: 'No JSON found in response', sourceUrl: CME_SETTLEMENTS_URL };
    }

    const byMonth = JSON.parse(jsonMatch[0]) as Array<{
      month: string;
      oi: number;
      settle: number;
    }>;
    const totalOI = byMonth.reduce((sum, m) => sum + (m.oi || 0), 0);

    return { success: true, data: { byMonth, totalOI }, sourceUrl: CME_SETTLEMENTS_URL };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Browser task failed',
      sourceUrl: CME_SETTLEMENTS_URL,
    };
  }
}
