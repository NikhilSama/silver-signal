import { NextResponse } from 'next/server';

import { fetchMargins, scoreMargins } from '@/lib/api/margins';
import { insertSnapshot, getSnapshotHistory } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import type { IndicatorSnapshotInsert } from '@/types/database';
import type { MarginData } from '@/lib/api/margins/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Increased for Browser Use

export async function GET(): Promise<NextResponse> {
  const indicatorId = INDICATOR_IDS.MARGIN_REQUIREMENTS;

  try {
    const result = await fetchMargins();

    if (!result.success || !result.data) {
      await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl);
      return NextResponse.json({
        success: false,
        indicatorId,
        error: result.error,
      });
    }

    // Get prior snapshots for scoring context
    const priorSnapshots = await getSnapshotHistory(indicatorId, 30);
    const priorData = priorSnapshots.map((s) => s.raw_value as unknown as MarginData);

    const score = scoreMargins(result.data, priorData);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
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
      indicatorId,
      signal: score.signal,
      marginPercent: result.data.initialMarginPercent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await insertErrorSnapshot(indicatorId, errorMsg, 'cmegroup.com');

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
