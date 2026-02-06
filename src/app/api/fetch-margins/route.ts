import { NextRequest, NextResponse } from 'next/server';

import { fetchMargins, scoreMargins } from '@/lib/api/margins';
import { insertSnapshot, getSnapshotHistory } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import { getMetalConfig, parseMetal } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert, Metal } from '@/types/database';
import type { MarginData } from '@/lib/api/margins/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Increased for Browser Use

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  const indicatorId = INDICATOR_IDS.MARGIN_REQUIREMENTS;

  try {
    const result = await fetchMargins(config);

    if (!result.success || !result.data) {
      await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl, metal);
      return NextResponse.json({
        success: false,
        metal: config.displayName,
        indicatorId,
        error: result.error,
      });
    }

    // Get prior snapshots for scoring context
    const priorSnapshots = await getSnapshotHistory(indicatorId, 30, metal);
    const priorData = priorSnapshots.map((s) => s.raw_value as unknown as MarginData);

    const score = scoreMargins(result.data, priorData);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
      fetched_at: new Date(),
      data_date: result.data.reportDate,
      raw_value: { ...result.data },
      computed_value: result.data.initialMarginPercent,
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
      marginPercent: result.data.initialMarginPercent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await insertErrorSnapshot(indicatorId, errorMsg, 'cmegroup.com', metal);

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
