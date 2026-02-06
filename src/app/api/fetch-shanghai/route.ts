import { NextRequest, NextResponse } from 'next/server';

import { fetchShanghaiPremium, scoreShanghaiPremium } from '@/lib/api/shanghai';
import { fetchSpotPrices } from '@/lib/api/spotprices';
import { insertSnapshot, getLatestSnapshot } from '@/lib/db/queries';
import { INDICATOR_IDS } from '@/types/indicator';
import { getMetalConfig, parseMetal } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert, Metal } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  const indicatorId = INDICATOR_IDS.SHANGHAI_PREMIUM;

  try {
    // First get COMEX spot price (needed for premium calculation)
    let comexSpot = metal === 'silver' ? 30 : 2900; // Default fallback

    // Try to get from latest backwardation snapshot
    const spotSnapshot = await getLatestSnapshot(INDICATOR_IDS.BACKWARDATION, metal);
    if (spotSnapshot?.raw_value) {
      const spotData = spotSnapshot.raw_value as { spotPrice?: number };
      if (spotData.spotPrice && spotData.spotPrice > 0) {
        comexSpot = spotData.spotPrice;
      }
    }

    // If no snapshot, fetch fresh
    if ((metal === 'silver' && comexSpot === 30) || (metal === 'gold' && comexSpot === 2900)) {
      const spotResult = await fetchSpotPrices(config);
      if (spotResult.success && spotResult.data) {
        comexSpot = spotResult.data.spotPrice;
      }
    }

    const result = await fetchShanghaiPremium(comexSpot, config);

    if (!result.success || !result.data) {
      await insertErrorSnapshot(indicatorId, result.error ?? 'Fetch failed', result.sourceUrl, metal);
      return NextResponse.json({
        success: false,
        metal: config.displayName,
        indicatorId,
        error: result.error,
      });
    }

    const score = scoreShanghaiPremium(result.data);

    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      metal,
      fetched_at: new Date(),
      data_date: result.data.reportDate,
      raw_value: { ...result.data },
      computed_value: result.data.premiumPercent,
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
      premiumPercent: result.data.premiumPercent,
      sgePrice: result.data.sgePrice,
      comexSpot: result.data.comexSpotPrice,
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
