import { NextResponse } from 'next/server';

import {
  computeLeaseRate,
  computeFNDRatio,
  computeCVOLProxy,
  fetchDailyOHLC,
  scoreLeaseRate,
  scoreFNDRatio,
  scoreCVOLProxy,
} from '@/lib/api/derived';
import { fetchSofrRate } from '@/lib/api/derived/sofrFetcher';
import { insertSnapshot, getLatestSnapshot, getSnapshotHistory } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import type { IndicatorSnapshotInsert } from '@/types/database';
import type { CVOLProxyData } from '@/lib/api/derived/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ComputeResult {
  indicatorId: number;
  success: boolean;
  signal?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse> {
  const results: ComputeResult[] = [];

  // Compute all three derived indicators
  results.push(await computeAndStoreLeaseRate());
  results.push(await computeAndStoreFNDRatio());
  results.push(await computeAndStoreCVOLProxy());

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    success: successCount === results.length,
    message: `Computed ${successCount}/${results.length} derived indicators`,
    results,
    timestamp: new Date().toISOString(),
  });
}

/** Compute and store implied lease rate (#9) */
async function computeAndStoreLeaseRate(): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.LEASE_RATES;

  try {
    // Get backwardation data for lease rate calculation
    const spotSnapshot = await getLatestSnapshot(INDICATOR_IDS.BACKWARDATION);

    if (!spotSnapshot?.raw_value) {
      return {
        indicatorId,
        success: false,
        error: 'Backwardation data required for lease rate calculation',
      };
    }

    const spotData = spotSnapshot.raw_value as {
      spotPrice?: number;
      frontMonthFuturesPrice?: number;
      daysToExpiry?: number;
    };

    const spotPrice = spotData.spotPrice ?? 30;
    const futuresPrice = spotData.frontMonthFuturesPrice ?? spotPrice;
    const daysToExpiry = spotData.daysToExpiry ?? 30;

    // Fetch current SOFR rate for lease rate calculation
    const sofrResult = await fetchSofrRate();
    const sofrRate = sofrResult.rate;

    const data = computeLeaseRate(spotPrice, futuresPrice, daysToExpiry, sofrRate);
    const score = scoreLeaseRate(data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: data.reportDate,
      raw_value: { ...data },
      computed_value: data.impliedLeaseRate,
      signal: score.signal,
      signal_reason: score.reason,
      source_url: 'derived from spot/futures spread',
      fetch_status: 'success',
      error_detail: null,
    };

    await insertSnapshot(snapshot);

    return { indicatorId, success: true, signal: score.signal };
  } catch (error) {
    return {
      indicatorId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Compute and store FND ratio (#11) */
async function computeAndStoreFNDRatio(): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.FND_RATIO;

  try {
    // Get OI and vault data for FND ratio
    const [oiSnapshot, vaultSnapshot] = await Promise.all([
      getLatestSnapshot(INDICATOR_IDS.OPEN_INTEREST),
      getLatestSnapshot(INDICATOR_IDS.VAULT_INVENTORY),
    ]);

    if (!oiSnapshot?.raw_value || !vaultSnapshot?.raw_value) {
      return {
        indicatorId,
        success: false,
        error: 'OI and vault data required for FND ratio',
      };
    }

    const oiData = oiSnapshot.raw_value as {
      totalOI?: number;
      byMonth?: Array<{ month: string; oi: number }>;
    };
    const vaultData = vaultSnapshot.raw_value as { totalRegistered?: number };

    // Get front-month OI (or use total if not available)
    const frontMonthOI = oiData.byMonth?.[0]?.oi ?? oiData.totalOI ?? 0;
    const registeredOunces = vaultData.totalRegistered ?? 0;
    const frontMonthContract = oiData.byMonth?.[0]?.month ?? 'UNKNOWN';

    const data = computeFNDRatio(frontMonthOI, registeredOunces, frontMonthContract);
    const score = scoreFNDRatio(data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: data.reportDate,
      raw_value: { ...data },
      computed_value: data.deliveryPressureRatio,
      signal: score.signal,
      signal_reason: score.reason,
      source_url: 'derived from OI and vault data',
      fetch_status: 'success',
      error_detail: null,
    };

    await insertSnapshot(snapshot);

    return { indicatorId, success: true, signal: score.signal };
  } catch (error) {
    return {
      indicatorId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Compute and store CVOL proxy (#12) */
async function computeAndStoreCVOLProxy(): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.CVOL;

  try {
    // Fetch daily OHLC from Yahoo Finance
    const ohlc = await fetchDailyOHLC();

    if (ohlc.error || ohlc.close === 0) {
      return { indicatorId, success: false, error: ohlc.error ?? 'No OHLC data' };
    }

    // Get prior CVOL data for trend comparison
    const priorSnapshots = await getSnapshotHistory(indicatorId, 30);
    const priorRanges = priorSnapshots
      .map((s) => (s.raw_value as unknown as CVOLProxyData)?.rangePercent)
      .filter((r): r is number => typeof r === 'number');

    const data = computeCVOLProxy(ohlc.high, ohlc.low, ohlc.close, priorRanges);
    // Add data source to the data object
    const dataWithSource = { ...data, dataSource: ohlc.source };
    const score = scoreCVOLProxy(data);

    const sourceUrl = ohlc.source.includes('SI=F')
      ? 'https://finance.yahoo.com/quote/SI=F'
      : 'https://finance.yahoo.com/quote/SLV';

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: data.reportDate,
      raw_value: { ...dataWithSource },
      computed_value: data.rangePercent,
      signal: score.signal,
      signal_reason: score.reason,
      source_url: sourceUrl,
      fetch_status: 'success',
      error_detail: null,
    };

    await insertSnapshot(snapshot);

    return { indicatorId, success: true, signal: score.signal };
  } catch (error) {
    return {
      indicatorId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
