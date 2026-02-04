import { NextResponse } from 'next/server';

import { checkConnection } from '@/lib/db';
import { getLatestSnapshots } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

interface IndicatorHealth {
  id: number;
  status: 'success' | 'error' | 'stale' | 'missing';
  lastFetch: string | null;
  signal: string | null;
}

export async function GET(): Promise<NextResponse> {
  const dbConnected = await checkConnection();

  if (!dbConnected) {
    return NextResponse.json(
      { status: 'unhealthy', database: false, indicators: [] },
      { status: 503 }
    );
  }

  const snapshots = await getLatestSnapshots();
  const now = new Date();

  const indicatorHealth: IndicatorHealth[] = Array.from({ length: 12 }, (_, i) => {
    const id = i + 1;
    const snapshot = snapshots.find((s) => s.indicator_id === id);

    if (!snapshot) {
      return { id, status: 'missing', lastFetch: null, signal: null };
    }

    const hoursSinceFetch = (now.getTime() - new Date(snapshot.fetched_at).getTime()) / (1000 * 60 * 60);
    const isStale = hoursSinceFetch > 48;

    return {
      id,
      status: snapshot.fetch_status === 'success' ? (isStale ? 'stale' : 'success') : 'error',
      lastFetch: snapshot.fetched_at.toISOString(),
      signal: snapshot.signal,
    };
  });

  const healthyCount = indicatorHealth.filter((i) => i.status === 'success').length;

  return NextResponse.json({
    status: healthyCount >= 2 ? 'healthy' : 'degraded',
    database: true,
    timestamp: now.toISOString(),
    indicators: indicatorHealth,
    summary: {
      success: indicatorHealth.filter((i) => i.status === 'success').length,
      error: indicatorHealth.filter((i) => i.status === 'error').length,
      stale: indicatorHealth.filter((i) => i.status === 'stale').length,
      missing: indicatorHealth.filter((i) => i.status === 'missing').length,
    },
  });
}
