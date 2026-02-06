import * as cheerio from 'cheerio';
import type { MarginData, MarginChange, MarginFetchResult } from './types';
import { fetchMarginsViaBrowser } from '../browseruse';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig } from '@/lib/constants/metals';

// CME margins base URLs
const MARGINS_BASE = 'https://www.cmegroup.com/markets/metals/precious';
const MARGINS_API_BASE = 'https://www.cmegroup.com/CmeWS/mvc/Margins/OUTRIGHT';

/** Get margins page URL for a metal */
function getMarginsUrl(config: MetalConfig): string {
  const metal = config.id === 'silver' ? 'silver' : 'gold';
  return `${MARGINS_BASE}/${metal}.margins.html`;
}

/** Get margins API URL for a metal */
function getMarginsApiUrl(config: MetalConfig): string {
  return `${MARGINS_API_BASE}/${config.marginsProductCode}/${config.marginsProductCode}`;
}

/** Fetch current margin requirements for a metal */
export async function fetchMargins(
  config: MetalConfig = getMetalConfig()
): Promise<MarginFetchResult> {
  const marginsUrl = getMarginsUrl(config);
  const marginsApiUrl = getMarginsApiUrl(config);
  try {
    // Try the API endpoint first
    console.log(`[Margins] Trying CME API for ${config.displayName}...`);
    const apiResult = await fetchMarginsAPI(marginsApiUrl);
    if (apiResult.success && apiResult.data && apiResult.data.initialMarginPercent > 0) {
      console.log(`[Margins] CME API success for ${config.displayName}:`, apiResult.data.initialMarginPercent);
      return apiResult;
    }
    console.log(`[Margins] CME API failed for ${config.displayName}:`, apiResult.error);

    // Fallback to scraping the margins page
    console.log(`[Margins] Trying page scrape for ${config.displayName}...`);
    const pageResult = await fetchMarginsPage(marginsUrl);
    if (pageResult.success && pageResult.data && pageResult.data.initialMarginPercent > 0) {
      console.log(`[Margins] Page scrape success for ${config.displayName}:`, pageResult.data.initialMarginPercent);
      return pageResult;
    }
    console.log(`[Margins] Page scrape failed or zero for ${config.displayName}`);

    // Try Browser Use Cloud (real browser automation) - only for silver for now
    if (config.id === 'silver') {
      console.log('[Margins] Trying Browser Use Cloud...');
      const browserResult = await fetchMarginsViaBrowser();
      console.log('[Margins] Browser Use result:', browserResult);
      if (browserResult.success && browserResult.data && browserResult.data > 0) {
        const marginPercent = browserResult.data;
        const contractValue = 150000;
        console.log('[Margins] Browser Use success:', marginPercent);
        return {
          success: true,
          data: {
            reportDate: new Date(),
            initialMarginPercent: marginPercent,
            maintenanceMarginPercent: marginPercent * 0.9,
            initialMarginDollars: (marginPercent / 100) * contractValue,
            contractValue,
            lastChangeDate: null,
            changePercent: null,
            recentChanges: [],
          },
          sourceUrl: browserResult.sourceUrl || marginsUrl,
        };
      }
    }

    // Last resort: use known margin values
    console.log(`[Margins] Using hardcoded fallback for ${config.displayName}`);
    const fallbackData = getFallbackMarginData(config);
    return {
      success: true,
      data: fallbackData,
      sourceUrl: 'hardcoded-fallback',
    };
  } catch (error) {
    console.error(`[Margins] Error for ${config.displayName}:`, error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      sourceUrl: marginsUrl,
    };
  }
}

/** Get fallback margin data for a metal */
function getFallbackMarginData(config: MetalConfig): MarginData {
  // Default margin percentages (approximate)
  const margins: Record<string, { percent: number; dollars: number; contractValue: number }> = {
    silver: { percent: 15, dollars: 22500, contractValue: 150000 },
    gold: { percent: 8, dollars: 23200, contractValue: 290000 },
  };
  const m = margins[config.id] ?? margins.silver;

  return {
    reportDate: new Date(),
    initialMarginPercent: m.percent,
    maintenanceMarginPercent: m.percent * 0.9,
    initialMarginDollars: m.dollars,
    contractValue: m.contractValue,
    lastChangeDate: null,
    changePercent: null,
    recentChanges: [],
  };
}

/** Fetch margins from CME API */
async function fetchMarginsAPI(apiUrl: string): Promise<MarginFetchResult> {
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetalMonitor/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}`,
        sourceUrl: apiUrl,
      };
    }

    const json = await response.json() as Record<string, unknown>;

    // Check if response is a blocking/error message (CME returns 200 with error JSON)
    if (json.message && typeof json.message === 'string') {
      return {
        success: false,
        data: null,
        error: 'CME API blocked',
        sourceUrl: apiUrl,
      };
    }

    const data = parseMarginsAPIResponse(json);

    return {
      success: true,
      data,
      sourceUrl: apiUrl,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'API parse error',
      sourceUrl: apiUrl,
    };
  }
}

/** Parse the CME margins API response */
function parseMarginsAPIResponse(json: unknown): MarginData {
  const data = json as { margins?: Array<{ initial?: string; maintenance?: string }> };
  const margins = data.margins?.[0] ?? {};

  // Extract margin percentages (CME now uses percentages since Jan 2026)
  const initialStr = margins.initial ?? '0';
  const maintenanceStr = margins.maintenance ?? '0';

  const initialMarginPercent = parseMarginValue(initialStr);
  const maintenanceMarginPercent = parseMarginValue(maintenanceStr);

  // Estimate contract value (5000 oz * ~$30 spot)
  const estimatedSpot = 30;
  const contractValue = 5000 * estimatedSpot;
  const initialMarginDollars = (initialMarginPercent / 100) * contractValue;

  return {
    reportDate: new Date(),
    initialMarginPercent,
    maintenanceMarginPercent,
    initialMarginDollars,
    contractValue,
    lastChangeDate: null,
    changePercent: null,
    recentChanges: [],
  };
}

/** Fallback: scrape the margins HTML page */
async function fetchMarginsPage(pageUrl: string): Promise<MarginFetchResult> {
  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MetalMonitor/1.0)',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: `HTTP ${response.status}`,
      sourceUrl: pageUrl,
    };
  }

  const html = await response.text();
  const data = parseMarginsPage(html);

  return {
    success: true,
    data,
    sourceUrl: pageUrl,
  };
}

/** Parse the margins HTML page */
function parseMarginsPage(html: string): MarginData {
  const $ = cheerio.load(html);

  let initialMarginPercent = 0;
  let maintenanceMarginPercent = 0;

  // Look for margin values in the page
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    const label = $(cells[0]).text().toLowerCase();

    if (label.includes('initial') || label.includes('start')) {
      initialMarginPercent = parseMarginValue($(cells[1]).text());
    }
    if (label.includes('maintenance') || label.includes('maint')) {
      maintenanceMarginPercent = parseMarginValue($(cells[1]).text());
    }
  });

  // Try alternate selectors if table didn't work
  if (initialMarginPercent === 0) {
    const marginText = $('[data-margin], .margin-value, .initial-margin').first().text();
    initialMarginPercent = parseMarginValue(marginText);
  }

  const estimatedSpot = 30;
  const contractValue = 5000 * estimatedSpot;
  const initialMarginDollars = (initialMarginPercent / 100) * contractValue;

  return {
    reportDate: new Date(),
    initialMarginPercent,
    maintenanceMarginPercent,
    initialMarginDollars,
    contractValue,
    lastChangeDate: null,
    changePercent: null,
    recentChanges: [],
  };
}

/** Parse margin value from string (handles both % and dollar amounts) */
function parseMarginValue(value: string): number {
  if (!value) return 0;

  const cleaned = value.replace(/[$,%,\s]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) return 0;

  // If value contains %, it's already a percentage
  if (value.includes('%')) return num;

  // If it's a large number (>100), it's probably dollars - need to convert
  // Assuming ~$150k contract value, 15% margin = ~$22,500
  if (num > 100) {
    const contractValue = 150000;
    return (num / contractValue) * 100;
  }

  return num;
}

/** Fetch recent margin change advisories from CME notices */
export async function fetchMarginChanges(): Promise<MarginChange[]> {
  // CME Notices search would go here
  // For now, return empty array - this would require searching PDF notices
  return [];
}
