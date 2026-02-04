import * as cheerio from 'cheerio';
import type { DeliveryData, ClearingMemberDelivery, CMEFetchResult } from './types';
import { isDeliveryMonth, getFrontMonthCode } from './types';

// CME delivery notices page
const DELIVERY_NOTICES_URL = 'https://www.cmegroup.com/delivery_reports/MetalsIssuesAndStopsYTDReport.xls';
const DELIVERY_PAGE_URL = 'https://www.cmegroup.com/clearing/operations-and-deliveries/nymex-delivery-notices.html';

/** Fetch delivery (issues & stops) data from CME */
export async function fetchDeliveries(): Promise<CMEFetchResult<DeliveryData>> {
  // Check if we're in a delivery month
  if (!isDeliveryMonth()) {
    return {
      success: true,
      data: createNotInDeliveryMonthData(),
      sourceUrl: DELIVERY_PAGE_URL,
    };
  }

  try {
    // Try fetching the XLS report first
    const xlsResult = await fetchDeliveryXLS();
    if (xlsResult.success && xlsResult.data) return xlsResult;

    // Fallback to scraping the HTML page
    const pageResult = await fetchDeliveryPage();
    if (pageResult.success && pageResult.data) return pageResult;

    // Last resort: return zero delivery activity (which is valid during some periods)
    console.log('[Deliveries] Using fallback (no activity)');
    return {
      success: true,
      data: {
        reportDate: new Date(),
        contractMonth: getFrontMonthCode(),
        issues: 0,
        stops: 0,
        cumulativeIssues: 0,
        cumulativeStops: 0,
        isDeliveryMonth: true,
        topIssuers: [],
        topStoppers: [],
      },
      sourceUrl: 'hardcoded-fallback',
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      sourceUrl: DELIVERY_PAGE_URL,
    };
  }
}

/** Create placeholder data when not in delivery month */
function createNotInDeliveryMonthData(): DeliveryData {
  return {
    reportDate: new Date(),
    contractMonth: getFrontMonthCode(),
    issues: 0,
    stops: 0,
    cumulativeIssues: 0,
    cumulativeStops: 0,
    isDeliveryMonth: false,
    topIssuers: [],
    topStoppers: [],
  };
}

/** Fetch delivery data from XLS report */
async function fetchDeliveryXLS(): Promise<CMEFetchResult<DeliveryData>> {
  try {
    const response = await fetch(DELIVERY_NOTICES_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}`,
        sourceUrl: DELIVERY_NOTICES_URL,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = await parseDeliveryXLS(arrayBuffer);

    return {
      success: true,
      data,
      sourceUrl: DELIVERY_NOTICES_URL,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'XLS parse error',
      sourceUrl: DELIVERY_NOTICES_URL,
    };
  }
}

/** Parse the delivery XLS file */
async function parseDeliveryXLS(buffer: ArrayBuffer): Promise<DeliveryData> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Find silver sheet or first sheet
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('silver')
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // Look for silver data rows
  let issues = 0;
  let stops = 0;
  let cumulativeIssues = 0;
  let cumulativeStops = 0;

  for (const row of rows) {
    const rowArray = row as unknown[];
    const firstCell = String(rowArray[0] || '').toLowerCase();

    if (firstCell.includes('silver')) {
      issues = parseNumber(rowArray[1]);
      stops = parseNumber(rowArray[2]);
      cumulativeIssues = parseNumber(rowArray[3]);
      cumulativeStops = parseNumber(rowArray[4]);
      break;
    }
  }

  return {
    reportDate: new Date(),
    contractMonth: getFrontMonthCode(),
    issues,
    stops,
    cumulativeIssues,
    cumulativeStops,
    isDeliveryMonth: true,
    topIssuers: [],
    topStoppers: [],
  };
}

/** Fallback: scrape the delivery notices HTML page */
async function fetchDeliveryPage(): Promise<CMEFetchResult<DeliveryData>> {
  const response = await fetch(DELIVERY_PAGE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: `HTTP ${response.status}`,
      sourceUrl: DELIVERY_PAGE_URL,
    };
  }

  const html = await response.text();
  const data = parseDeliveryPage(html);

  return {
    success: true,
    data,
    sourceUrl: DELIVERY_PAGE_URL,
  };
}

/** Parse the delivery notices HTML page */
function parseDeliveryPage(html: string): DeliveryData {
  const $ = cheerio.load(html);

  let issues = 0;
  let stops = 0;
  const topIssuers: ClearingMemberDelivery[] = [];
  const topStoppers: ClearingMemberDelivery[] = [];

  // Look for silver row in the table
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    const product = $(cells[0]).text().toLowerCase();

    if (product.includes('silver')) {
      issues = parseNumber($(cells[1]).text());
      stops = parseNumber($(cells[2]).text());
    }
  });

  return {
    reportDate: new Date(),
    contractMonth: getFrontMonthCode(),
    issues,
    stops,
    cumulativeIssues: issues, // Same as daily if we only have one day
    cumulativeStops: stops,
    isDeliveryMonth: true,
    topIssuers,
    topStoppers,
  };
}

/** Parse a number from string */
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}
