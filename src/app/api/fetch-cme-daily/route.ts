import { NextResponse } from 'next/server';

import {
  fetchVaultStocks,
  fetchOpenInterest,
  fetchDeliveries,
  analyzeRollPatterns,
  scoreOpenInterest,
  scoreVaultInventory,
  scoreDeliveryActivity,
  scoreRollPatterns,
} from '@/lib/api/cme';
import { insertSnapshot, getLatestSnapshot } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import type { IndicatorSnapshotInsert } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Increased for Browser Use fallback

interface FetchResult {
  indicatorId: number;
  success: boolean;
  signal?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse> {
  const results: FetchResult[] = [];

  // Fetch all CME data in parallel
  const [vaultResult, oiResult, deliveryResult] = await Promise.all([
    fetchVaultStocks(),
    fetchOpenInterest(),
    fetchDeliveries(),
  ]);

  // Process Vault Stocks (Indicator #2)
  results.push(await processVaultStocks(vaultResult));

  // Process Open Interest (Indicator #1)
  results.push(await processOpenInterest(oiResult));

  // Process Deliveries (Indicator #3)
  results.push(await processDeliveries(deliveryResult, vaultResult.data?.totalRegistered ?? 0));

  // Process Roll Patterns (Indicator #8) - requires OI data
  results.push(await processRollPatterns(oiResult));

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: failCount === 0,
    message: `Fetched ${successCount} indicators, ${failCount} failed`,
    results,
    timestamp: new Date().toISOString(),
  });
}

async function processVaultStocks(
  result: Awaited<ReturnType<typeof fetchVaultStocks>>
): Promise<FetchResult> {
  const indicatorId = INDICATOR_IDS.VAULT_INVENTORY;

  if (!result.success || !result.data) {
    await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl);
    return { indicatorId, success: false, error: result.error };
  }

  // Get prior snapshot for comparison
  const prior = await getLatestSnapshot(indicatorId);
  const priorData = prior?.raw_value as { totalRegistered?: number } | null;

  const score = scoreVaultInventory(result.data, priorData ? {
    ...result.data,
    totalRegistered: priorData.totalRegistered ?? 0,
  } : null);

  const snapshot: IndicatorSnapshotInsert = {
    indicator_id: indicatorId,
    fetched_at: new Date(),
    data_date: result.data.reportDate,
    raw_value: { ...result.data },
    computed_value: result.data.totalRegistered,
    signal: score.signal,
    signal_reason: score.reason,
    source_url: result.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  await insertSnapshot(snapshot);
  return { indicatorId, success: true, signal: score.signal };
}

async function processOpenInterest(
  result: Awaited<ReturnType<typeof fetchOpenInterest>>
): Promise<FetchResult> {
  const indicatorId = INDICATOR_IDS.OPEN_INTEREST;

  if (!result.success || !result.data) {
    await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl);
    return { indicatorId, success: false, error: result.error };
  }

  // Get prior snapshot for comparison
  const prior = await getLatestSnapshot(indicatorId);
  const priorData = prior?.raw_value as { totalOI?: number } | null;

  const score = scoreOpenInterest(result.data, priorData ? {
    ...result.data,
    totalOI: priorData.totalOI ?? 0,
  } : null);

  const snapshot: IndicatorSnapshotInsert = {
    indicator_id: indicatorId,
    fetched_at: new Date(),
    data_date: result.data.reportDate,
    raw_value: { ...result.data },
    computed_value: result.data.totalOI,
    signal: score.signal,
    signal_reason: score.reason,
    source_url: result.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  await insertSnapshot(snapshot);
  return { indicatorId, success: true, signal: score.signal };
}

async function processDeliveries(
  result: Awaited<ReturnType<typeof fetchDeliveries>>,
  registeredOunces: number
): Promise<FetchResult> {
  const indicatorId = INDICATOR_IDS.DELIVERY_ACTIVITY;

  if (!result.success || !result.data) {
    await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl);
    return { indicatorId, success: false, error: result.error };
  }

  const score = scoreDeliveryActivity(result.data, registeredOunces);

  const snapshot: IndicatorSnapshotInsert = {
    indicator_id: indicatorId,
    fetched_at: new Date(),
    data_date: result.data.reportDate,
    raw_value: { ...result.data },
    computed_value: result.data.stops,
    signal: score.signal,
    signal_reason: score.reason,
    source_url: result.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  await insertSnapshot(snapshot);
  return { indicatorId, success: true, signal: score.signal };
}

async function processRollPatterns(
  oiResult: Awaited<ReturnType<typeof fetchOpenInterest>>
): Promise<FetchResult> {
  const indicatorId = INDICATOR_IDS.ROLL_PATTERNS;

  if (!oiResult.success || !oiResult.data) {
    await insertErrorSnapshot(indicatorId, 'OI data required for roll analysis', oiResult.sourceUrl);
    return { indicatorId, success: false, error: 'OI data required' };
  }

  // Get prior OI snapshot for roll comparison
  const prior = await getLatestSnapshot(INDICATOR_IDS.OPEN_INTEREST);
  const priorOI = prior?.raw_value as { totalOI?: number; byMonth?: unknown[] } | null;

  const rollData = analyzeRollPatterns(
    oiResult.data,
    prior && priorOI ? {
      reportDate: new Date(prior.data_date),
      totalOI: priorOI.totalOI ?? 0,
      byMonth: (priorOI.byMonth ?? []) as typeof oiResult.data.byMonth,
    } : null
  );

  const score = scoreRollPatterns(rollData);

  const snapshot: IndicatorSnapshotInsert = {
    indicator_id: indicatorId,
    fetched_at: new Date(),
    data_date: rollData.reportDate,
    raw_value: { ...rollData },
    computed_value: rollData.frontMonthOI,
    signal: score.signal,
    signal_reason: score.reason,
    source_url: oiResult.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  await insertSnapshot(snapshot);
  return { indicatorId, success: true, signal: score.signal };
}

async function insertErrorSnapshot(
  indicatorId: number,
  error: string,
  sourceUrl: string
): Promise<void> {
  const snapshot: IndicatorSnapshotInsert = {
    indicator_id: indicatorId,
    fetched_at: new Date(),
    data_date: new Date(),
    raw_value: { error },
    computed_value: 0,
    signal: 'error',
    signal_reason: `FETCH FAILED: ${error}`,
    source_url: sourceUrl,
    fetch_status: 'error',
    error_detail: error,
  };

  await insertSnapshot(snapshot);
}
