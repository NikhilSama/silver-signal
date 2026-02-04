import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getLatestSnapshots } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const INDICATOR_NAMES: Record<number, string> = {
  1: 'Open Interest',
  2: 'Vault Inventory',
  3: 'Delivery Activity',
  4: 'Speculator Positioning',
  5: 'Commercial Short',
  6: 'Margin Requirements',
  7: 'Backwardation',
  8: 'Roll Patterns',
  9: 'Lease Rates',
  10: 'Shanghai Premium',
  11: 'FND Ratio',
  12: 'CVOL',
};

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const indicatorId = searchParams.get('id');

  // If specific indicator requested, show all snapshots for it
  if (indicatorId) {
    const result = await sql`
      SELECT * FROM indicator_snapshots
      WHERE indicator_id = ${parseInt(indicatorId)}
      ORDER BY id DESC
      LIMIT 15
    `;

    // Also count total for this indicator
    const countResult = await sql`
      SELECT COUNT(*) as total FROM indicator_snapshots
      WHERE indicator_id = ${parseInt(indicatorId)}
    `;

    return NextResponse.json({
      indicatorId,
      totalCount: countResult.rows[0]?.total ?? 0,
      showing: result.rows.length,
      snapshots: result.rows.map((s) => ({
        id: s.id,
        value: s.computed_value,
        signal: s.signal,
        reason: s.signal_reason?.substring(0, 50),
        source: s.source_url,
        fetched: s.fetched_at,
      })),
    });
  }

  // Default: show latest for each indicator
  const snapshots = await getLatestSnapshots();

  const summary = snapshots.map((s) => ({
    id: s.indicator_id,
    name: INDICATOR_NAMES[s.indicator_id] || `Indicator ${s.indicator_id}`,
    signal: s.signal,
    value: s.computed_value,
    reason: s.signal_reason?.substring(0, 60),
    source: s.source_url,
    fetched: s.fetched_at,
  }));

  return NextResponse.json({ snapshots: summary });
}
