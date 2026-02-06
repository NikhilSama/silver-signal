import type { DeliveryData, CMEFetchResult } from './types';
import { isDeliveryMonth, getFrontMonthCode } from './types';
import { parseDeliveryPDF } from './pdfParser';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig, isMetalDeliveryMonth, getNextDeliveryMonth } from '@/lib/constants/metals';

// CME delivery notices PDF (daily report with Issues & Stops)
const DELIVERY_PDF_URL = 'https://www.cmegroup.com/delivery_reports/MetalsIssuesAndStopsReport.pdf';

/** Fetch delivery (issues & stops) data from CME PDF report for a metal */
export async function fetchDeliveries(
  config: MetalConfig = getMetalConfig()
): Promise<CMEFetchResult<DeliveryData>> {
  try {
    // Always try to fetch PDF - CME publishes delivery data even outside primary months
    const pdfResult = await fetchDeliveryPDF(config);
    if (pdfResult.success && pdfResult.data) {
      // Mark whether this is a primary delivery month for this metal
      pdfResult.data.isDeliveryMonth = isMetalDeliveryMonth(config);
      return pdfResult;
    }

    // Fallback: return zero delivery activity
    console.log(`[Deliveries] PDF parse failed for ${config.displayName}, using fallback`);
    return {
      success: true,
      data: createFallbackData(config),
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
function createFallbackData(config: MetalConfig): DeliveryData {
  const delivery = getNextDeliveryMonth(config);
  return {
    reportDate: new Date(),
    contractMonth: `${delivery.monthName}${String(delivery.year).slice(-2)}`,
    issues: 0,
    stops: 0,
    cumulativeIssues: 0,
    cumulativeStops: 0,
    isDeliveryMonth: isMetalDeliveryMonth(config),
    topIssuers: [],
    topStoppers: [],
  };
}

/** Fetch and parse the daily delivery notices PDF for a metal */
async function fetchDeliveryPDF(
  config: MetalConfig
): Promise<CMEFetchResult<DeliveryData>> {
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
    // Pass metal type to parser to filter for correct metal section
    const data = await parseDeliveryPDF(arrayBuffer, config.id);

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
