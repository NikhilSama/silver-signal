import { NextRequest, NextResponse } from 'next/server';

import { fetchSpotPrices, scoreBackwardation } from '@/lib/api/spotprices';
import { insertSnapshot } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import { getMetalConfig, parseMetal } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert, Metal } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  const indicatorId = INDICATOR_IDS.BACKWARDATION;

  try {
    const result = await fetchSpotPrices(config);

    if (!result.success || !result.data) {
      await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl, metal);
      return NextResponse.json({
        success: false,
        metal: config.displayName,
        indicatorId,
        error: result.error,
      });
    }

    const score = scoreBackwardation(result.data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
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
      metal: config.displayName,
      indicatorId,
      signal: score.signal,
      spotPrice: result.data.spotPrice,
      futuresPrice: result.data.frontMonthFuturesPrice,
      spread: result.data.spread,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await insertErrorSnapshot(indicatorId, errorMsg, 'goldprice.org', metal);

    return NextResponse.json({
      success: false,
      metal: config.displayName,
      indicatorId,
      error: errorMsg,
    });
  }
}

async function insertErrorSnapshot(
  indicatorId: number,
  error: string,
  sourceUrl: string,
  metal: Metal
): Promise<void> {
  const snapshot: IndicatorSnapshotInsert = {
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

  await insertSnapshot(snapshot);
}
