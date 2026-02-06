import { NextRequest, NextResponse } from 'next/server';

import { fetchLatestCOT, scoreSpeculatorNet, scoreCommercialShort } from '@/lib/api/cftc';
import { insertSnapshot, getSnapshotHistory, snapshotExists } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import { getMetalConfig, parseMetal } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert, Metal } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Create error snapshot for failed fetch */
function createErrorSnapshot(
  indicatorId: number,
  error: string,
  sourceUrl: string,
  metal: Metal
): IndicatorSnapshotInsert {
  return {
    indicator_id: indicatorId,
    metal,
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
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  const result = await fetchLatestCOT(config);

  // Handle fetch failure
  if (!result.success || !result.data || result.data.length === 0) {
    const errorMsg = result.error ?? 'No data returned';

    // Store error snapshots for both indicators
    await insertSnapshot(
      createErrorSnapshot(INDICATOR_IDS.COT_SPECULATOR, errorMsg, result.sourceUrl, metal)
    );
    await insertSnapshot(
      createErrorSnapshot(INDICATOR_IDS.COT_COMMERCIAL, errorMsg, result.sourceUrl, metal)
    );

    return NextResponse.json({
      success: false,
      error: errorMsg,
      metal: config.displayName,
    }, { status: 500 });
  }

  const latest = result.data[0];

  // Check for duplicate (same data_date already exists)
  const speculatorExists = await snapshotExists(
    INDICATOR_IDS.COT_SPECULATOR,
    latest.reportDate,
    metal
  );

  if (speculatorExists) {
    return NextResponse.json({
      success: true,
      message: 'Data for this report date already exists, skipping',
      reportDate: latest.reportDate.toISOString(),
      metal: config.displayName,
    });
  }

  // Get historical data for percentile calculations
  const speculatorHistory = await getSnapshotHistory(INDICATOR_IDS.COT_SPECULATOR, 1095, metal);
  const commercialHistory = await getSnapshotHistory(INDICATOR_IDS.COT_COMMERCIAL, 1095, metal);

  // Find prior week's data for WoW comparison
  const priorWeekDate = new Date(latest.reportDate);
  priorWeekDate.setDate(priorWeekDate.getDate() - 7);
  const priorWeek = result.data.find(
    (d) => Math.abs(d.reportDate.getTime() - priorWeekDate.getTime()) < 86400000 * 2
  ) ?? null;

  // Convert history to ParsedCOTData format for scorer
  const speculatorHistoryParsed = speculatorHistory.map((s) => ({
    reportDate: new Date(s.data_date),
    openInterest: 0,
    speculatorLong: 0,
    speculatorShort: 0,
    speculatorNet: Number(s.computed_value),
    commercialLong: 0,
    commercialShort: 0,
    commercialNetShort: 0,
  }));

  const commercialHistoryParsed = commercialHistory.map((s) => ({
    reportDate: new Date(s.data_date),
    openInterest: 0,
    speculatorLong: 0,
    speculatorShort: 0,
    speculatorNet: 0,
    commercialLong: 0,
    commercialShort: 0,
    commercialNetShort: Number(s.computed_value),
  }));

  // Score indicators
  const speculatorScore = scoreSpeculatorNet(latest, speculatorHistoryParsed, priorWeek);
  const commercialScore = scoreCommercialShort(latest, commercialHistoryParsed, priorWeek);

  // Insert snapshots
  const speculatorSnapshot: IndicatorSnapshotInsert = {
    indicator_id: INDICATOR_IDS.COT_SPECULATOR,
    metal,
    fetched_at: new Date(),
    data_date: latest.reportDate,
    raw_value: { ...latest },
    computed_value: latest.speculatorNet,
    signal: speculatorScore.signal,
    signal_reason: speculatorScore.reason,
    source_url: result.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  const commercialSnapshot: IndicatorSnapshotInsert = {
    indicator_id: INDICATOR_IDS.COT_COMMERCIAL,
    metal,
    fetched_at: new Date(),
    data_date: latest.reportDate,
    raw_value: { ...latest },
    computed_value: latest.commercialNetShort,
    signal: commercialScore.signal,
    signal_reason: commercialScore.reason,
    source_url: result.sourceUrl,
    fetch_status: 'success',
    error_detail: null,
  };

  await insertSnapshot(speculatorSnapshot);
  await insertSnapshot(commercialSnapshot);

  return NextResponse.json({
    success: true,
    metal: config.displayName,
    reportDate: latest.reportDate.toISOString(),
    speculator: { net: latest.speculatorNet, signal: speculatorScore.signal },
    commercial: { netShort: latest.commercialNetShort, signal: commercialScore.signal },
  });
}
