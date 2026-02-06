import { NextRequest, NextResponse } from 'next/server';

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
import { getMetalConfig, parseMetal } from '@/lib/constants/metals';
import type { MetalConfig } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert, Metal } from '@/types/database';
import type { CVOLProxyData } from '@/lib/api/derived/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ComputeResult {
  indicatorId: number;
  success: boolean;
  signal?: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  const results: ComputeResult[] = [];

  // Compute all three derived indicators
  results.push(await computeAndStoreLeaseRate(metal, config));
  results.push(await computeAndStoreFNDRatio(metal, config));
  results.push(await computeAndStoreCVOLProxy(metal, config));

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    success: successCount === results.length,
    metal: config.displayName,
    message: `Computed ${successCount}/${results.length} derived indicators`,
    results,
    timestamp: new Date().toISOString(),
  });
}

/** Compute and store implied lease rate (#9) */
async function computeAndStoreLeaseRate(
  metal: Metal,
  config: MetalConfig
): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.LEASE_RATES;

  try {
    // Get backwardation data for lease rate calculation
    const spotSnapshot = await getLatestSnapshot(INDICATOR_IDS.BACKWARDATION, metal);

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

    const spotPrice = spotData.spotPrice ?? (metal === 'silver' ? 30 : 2900);
    const futuresPrice = spotData.frontMonthFuturesPrice ?? spotPrice;
    const daysToExpiry = spotData.daysToExpiry ?? 30;

    // Fetch current SOFR rate for lease rate calculation
    const sofrResult = await fetchSofrRate();
    const sofrRate = sofrResult.rate;

    const data = computeLeaseRate(spotPrice, futuresPrice, daysToExpiry, sofrRate);
    const score = scoreLeaseRate(data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
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
async function computeAndStoreFNDRatio(
  metal: Metal,
  config: MetalConfig
): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.FND_RATIO;

  try {
    // Get OI and vault data for FND ratio
    const [oiSnapshot, vaultSnapshot] = await Promise.all([
      getLatestSnapshot(INDICATOR_IDS.OPEN_INTEREST, metal),
      getLatestSnapshot(INDICATOR_IDS.VAULT_INVENTORY, metal),
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

    const data = computeFNDRatio(frontMonthOI, registeredOunces, frontMonthContract, config);
    const score = scoreFNDRatio(data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
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
async function computeAndStoreCVOLProxy(
  metal: Metal,
  config: MetalConfig
): Promise<ComputeResult> {
  const indicatorId = INDICATOR_IDS.CVOL;

  try {
    // Fetch daily OHLC from Yahoo Finance
    const ohlc = await fetchDailyOHLC(config);

    if (ohlc.error || ohlc.close === 0) {
      return { indicatorId, success: false, error: ohlc.error ?? 'No OHLC data' };
    }

    // Get prior CVOL data for trend comparison
    const priorSnapshots = await getSnapshotHistory(indicatorId, 30, metal);
    const priorRanges = priorSnapshots
      .map((s) => (s.raw_value as unknown as CVOLProxyData)?.rangePercent)
      .filter((r): r is number => typeof r === 'number');

    const data = computeCVOLProxy(ohlc.high, ohlc.low, ohlc.close, priorRanges);
    // Add data source and GVZ value (for gold) to the data object
    const dataWithSource = {
      ...data,
      dataSource: ohlc.source,
      gvzValue: ohlc.gvzValue ?? null,
    };
    const score = scoreCVOLProxy(data);

    // Build appropriate source URL
    let sourceUrl = `https://finance.yahoo.com/quote/${config.futuresSymbol}`;
    if (ohlc.gvzValue) {
      sourceUrl = 'https://fred.stlouisfed.org/series/GVZCLS';
    }

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
      fetched_at: new Date(),
      data_date: data.reportDate,
      raw_value: { ...dataWithSource },
      computed_value: ohlc.gvzValue ?? data.rangePercent,
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
