import { NextResponse } from 'next/server';
import { insertSnapshot, getLatestSnapshot } from '@/lib/db/queries';
import type { IndicatorSnapshotInsert } from '@/types/database';

export const dynamic = 'force-dynamic';

interface ManualEditRequest {
  indicatorId: number;
  newValue: number;
  reason?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as ManualEditRequest;
    const { indicatorId, newValue, reason } = body;

    if (!indicatorId || typeof newValue !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing indicatorId or newValue' },
        { status: 400 }
      );
    }

    // Get the latest snapshot to preserve other fields
    const latest = await getLatestSnapshot(indicatorId);

    // Create a new snapshot with the manual edit
    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: new Date(),
      raw_value: {
        manualEdit: true,
        previousValue: latest?.computed_value ?? null,
        editReason: reason || 'Manual correction',
        originalRawValue: latest?.raw_value ?? null,
      },
      computed_value: newValue,
      signal: latest?.signal ?? 'yellow', // Keep existing signal or default to yellow
      signal_reason: `MANUAL EDIT: ${reason || 'Value corrected manually'}`,
      source_url: 'manual-edit',
      fetch_status: 'success',
      error_detail: null,
    };

    const inserted = await insertSnapshot(snapshot);

    return NextResponse.json({
      success: true,
      message: 'Value updated successfully',
      snapshot: {
        id: inserted.id,
        indicatorId: inserted.indicator_id,
        newValue: inserted.computed_value,
        fetchedAt: inserted.fetched_at,
      },
    });
  } catch (error) {
    console.error('[ManualEdit] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
