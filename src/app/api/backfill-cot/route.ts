import { NextResponse } from 'next/server';

import { fetchCOTHistory, scoreSpeculatorNet, scoreCommercialShort } from '@/lib/api/cftc';
import type { ParsedCOTData } from '@/lib/api/cftc';
import { insertSnapshot, snapshotExists } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import type { IndicatorSnapshotInsert } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for backfill

/** Process a batch of COT data and insert snapshots */
async function processCOTBatch(
  data: ParsedCOTData[],
  sourceUrl: string
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Sort oldest first for proper history building
  const sorted = [...data].sort(
    (a, b) => a.reportDate.getTime() - b.reportDate.getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    // Check if already exists
    const exists = await snapshotExists(INDICATOR_IDS.COT_SPECULATOR, current.reportDate);
    if (exists) {
      skipped++;
      continue;
    }

    // Get prior week for WoW calculation
    const priorWeek = i > 0 ? sorted[i - 1] : null;

    // Use all prior data as history for percentile
    const history = sorted.slice(0, i);

    // Score with available history
    const speculatorScore = scoreSpeculatorNet(current, history, priorWeek);
    const commercialScore = scoreCommercialShort(current, history, priorWeek);

    // Insert speculator snapshot
    const speculatorSnapshot: IndicatorSnapshotInsert = {
      indicator_id: INDICATOR_IDS.COT_SPECULATOR,
      fetched_at: new Date(),
      data_date: current.reportDate,
      raw_value: { ...current },
      computed_value: current.speculatorNet,
      signal: speculatorScore.signal,
      signal_reason: speculatorScore.reason,
      source_url: sourceUrl,
      fetch_status: 'success',
      error_detail: null,
    };

    // Insert commercial snapshot
    const commercialSnapshot: IndicatorSnapshotInsert = {
      indicator_id: INDICATOR_IDS.COT_COMMERCIAL,
      fetched_at: new Date(),
      data_date: current.reportDate,
      raw_value: { ...current },
      computed_value: current.commercialNetShort,
      signal: commercialScore.signal,
      signal_reason: commercialScore.reason,
      source_url: sourceUrl,
      fetch_status: 'success',
      error_detail: null,
    };

    await insertSnapshot(speculatorSnapshot);
    await insertSnapshot(commercialSnapshot);
    inserted++;
  }

  return { inserted, skipped };
}

export async function GET(): Promise<NextResponse> {
  const result = await fetchCOTHistory(3);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { success: false, error: result.error ?? 'Failed to fetch COT history' },
      { status: 500 }
    );
  }

  const stats = await processCOTBatch(result.data, result.sourceUrl);

  return NextResponse.json({
    success: true,
    totalRecords: result.data.length,
    inserted: stats.inserted,
    skipped: stats.skipped,
    message: `Backfill complete: ${stats.inserted} records inserted, ${stats.skipped} already existed`,
  });
}
