import { NextResponse } from 'next/server';

import { fetchSpotPrices, scoreBackwardation } from '@/lib/api/spotprices';
import { insertSnapshot } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import type { IndicatorSnapshotInsert } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(): Promise<NextResponse> {
  const indicatorId = INDICATOR_IDS.BACKWARDATION;

  try {
    const result = await fetchSpotPrices();

    if (!result.success || !result.data) {
      await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl);
      return NextResponse.json({
        success: false,
        indicatorId,
        error: result.error,
      });
    }

    const score = scoreBackwardation(result.data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: result.data.reportDate,
      raw_value: { ...result.data },
      computed_value: result.data.spread,
      signal: score.signal,
      signal_reason: score.reason,
      source_url: result.sourceUrl,
      fetch_status: 'success',
      error_detail: null,
    };

    await insertSnapshot(snapshot);

    return NextResponse.json({
      success: true,
      indicatorId,
      signal: score.signal,
      spotPrice: result.data.spotPrice,
      futuresPrice: result.data.frontMonthFuturesPrice,
      spread: result.data.spread,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await insertErrorSnapshot(indicatorId, errorMsg, 'metals.live');

    return NextResponse.json({
      success: false,
      indicatorId,
      error: errorMsg,
    });
  }
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
