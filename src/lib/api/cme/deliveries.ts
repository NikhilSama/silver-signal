import type { DeliveryData, CMEFetchResult } from './types';
import { isDeliveryMonth, getFrontMonthCode } from './types';
import { parseDeliveryPDF } from './pdfParser';

// CME delivery notices PDF (daily report with Issues & Stops)
const DELIVERY_PDF_URL = 'https://www.cmegroup.com/delivery_reports/MetalsIssuesAndStopsReport.pdf';

/** Fetch delivery (issues & stops) data from CME PDF report */
export async function fetchDeliveries(): Promise<CMEFetchResult<DeliveryData>> {
  try {
    // Always try to fetch PDF - CME publishes delivery data even outside primary months
    const pdfResult = await fetchDeliveryPDF();
    if (pdfResult.success && pdfResult.data) {
      // Mark whether this is a primary silver delivery month
      pdfResult.data.isDeliveryMonth = isDeliveryMonth();
      return pdfResult;
    }

    // Fallback: return zero delivery activity
    console.log('[Deliveries] PDF parse failed, using fallback');
    return {
      success: true,
      data: createFallbackData(),
      sourceUrl: 'hardcoded-fallback',
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      sourceUrl: DELIVERY_PDF_URL,
    };
  }
}

/** Create fallback data when fetch fails */
function createFallbackData(): DeliveryData {
  return {
    reportDate: new Date(),
    contractMonth: getFrontMonthCode(),
    issues: 0,
    stops: 0,
    cumulativeIssues: 0,
    cumulativeStops: 0,
    isDeliveryMonth: true,
    topIssuers: [],
    topStoppers: [],
  };
}

/** Fetch and parse the daily delivery notices PDF */
async function fetchDeliveryPDF(): Promise<CMEFetchResult<DeliveryData>> {
  try {
    const response = await fetch(DELIVERY_PDF_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}`,
        sourceUrl: DELIVERY_PDF_URL,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = await parseDeliveryPDF(arrayBuffer);

    return {
      success: true,
      data,
      sourceUrl: DELIVERY_PDF_URL,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'PDF parse error',
      sourceUrl: DELIVERY_PDF_URL,
    };
  }
}
