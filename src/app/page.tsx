import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { PostureBanner } from '@/components/data-display/PostureBanner';
import { SlamRiskChecklist, DEFAULT_SLAM_RISK_ITEMS } from '@/components/data-display/SlamRiskChecklist';
import { IndicatorGrid } from '@/components/data-display/IndicatorGrid';
import { UpcomingEvents } from '@/components/data-display/UpcomingEvents';
import { DailyBriefing } from '@/components/data-display/DailyBriefing';
import { INDICATOR_METADATA } from '@/lib/constants/indicators';
import { GOLD_INDICATOR_METADATA } from '@/lib/constants/indicators-gold';
import { INDICATOR_IDS } from '@/types/indicator';
import { parseMetal, getMetalConfig } from '@/lib/constants/metals';
import type { Metal } from '@/lib/constants/metals';
import type { IndicatorCardData, SlamRiskItem } from '@/types/indicator';
import type { KeyDate, DailyBriefing as DailyBriefingType, IndicatorSnapshot, IndicatorMetadata } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ metal?: string }>;
}

/** Check if database is configured */
function isDatabaseConfigured(): boolean {
  return !!process.env.POSTGRES_URL;
}

// Indicators that support browser automation
const BROWSER_PROMPT_INDICATORS = new Set([1, 6]); // Open Interest, Margins

/** Get metadata for a metal */
function getMetadataForMetal(metal: Metal): Omit<IndicatorMetadata, 'indicator_id' | 'metal'>[] {
  return metal === 'gold' ? GOLD_INDICATOR_METADATA : INDICATOR_METADATA;
}

/** Create fallback card data when database is not available */
function createFallbackCards(metal: Metal): IndicatorCardData[] {
  const metadata = getMetadataForMetal(metal);
  return metadata.map((meta, index) => ({
    indicatorId: index + 1,
    name: meta.name,
    shortDescription: meta.short_description,
    displayState: 'awaiting' as const,
    signal: null,
    signalLabel: '',
    currentValue: '',
    rawValue: null,
    dataDate: null,
    fetchedAt: null,
    fetchStatus: null,
    errorDetail: null,
    trendDirection: null,
    weekOverWeekChange: null,
    fullDescription: meta.full_description,
    whyItWorks: meta.why_it_works,
    signalReason: null,
    sourceUrl: null,
    hasBrowserPrompt: BROWSER_PROMPT_INDICATORS.has(index + 1),
  }));
}

interface SnapshotData {
  snapshots: IndicatorSnapshot[];
  priorSnapshots: (IndicatorSnapshot | null)[];
}

async function getIndicatorData(metal: Metal): Promise<SnapshotData | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const { getLatestSnapshots, getSnapshotHistory } = await import('@/lib/db/queries');

    const snapshots = await getLatestSnapshots(metal);

    const priorSnapshots = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(async (id) => {
        const history = await getSnapshotHistory(id, 14, metal);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return history.find(
          (s) => Math.abs(new Date(s.data_date).getTime() - weekAgo.getTime()) < 86400000 * 3
        ) ?? null;
      })
    );

    return { snapshots, priorSnapshots };
  } catch {
    return null;
  }
}

async function getIndicatorCards(
  data: SnapshotData | null,
  metal: Metal
): Promise<IndicatorCardData[]> {
  if (!data) return createFallbackCards(metal);

  try {
    const { getAllMetadata, getAllBrowserPrompts } = await import('@/lib/db/queries');
    const { transformToCardData } = await import('@/lib/utils/indicatorTransform');

    const metadata = await getAllMetadata(metal);

    // If no metadata in DB, use constants as fallback
    if (metadata.length === 0) {
      const fallbackMeta = getMetadataForMetal(metal);
      return fallbackMeta.map((meta, index) => {
        const metaId = index + 1;
        const snapshot = data.snapshots.find((s) => Number(s.indicator_id) === metaId) ?? null;
        const priorSnapshot = data.priorSnapshots[metaId - 1];
        const fullMeta = { ...meta, indicator_id: metaId, metal };
        return transformToCardData(metaId, snapshot, fullMeta, priorSnapshot, BROWSER_PROMPT_INDICATORS.has(metaId));
      });
    }

    // Get browser prompts
    let browserPromptIds = new Set<number>();
    try {
      const prompts = await getAllBrowserPrompts(metal);
      browserPromptIds = new Set(prompts.map(p => p.indicator_id));
    } catch {
      browserPromptIds = BROWSER_PROMPT_INDICATORS;
    }

    const cards = metadata.map((meta) => {
      const metaId = Number(meta.indicator_id);
      const snapshot = data.snapshots.find((s) => Number(s.indicator_id) === metaId) ?? null;
      const priorSnapshot = data.priorSnapshots[metaId - 1];
      const hasBrowserPrompt = browserPromptIds.has(metaId) || BROWSER_PROMPT_INDICATORS.has(metaId);
      return transformToCardData(metaId, snapshot, meta, priorSnapshot, hasBrowserPrompt);
    });

    return cards;
  } catch {
    return createFallbackCards(metal);
  }
}

async function getEvents(metal: Metal): Promise<KeyDate[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { getUpcomingDates } = await import('@/lib/db/queries');
    return await getUpcomingDates(30, metal);
  } catch {
    return [];
  }
}

async function getBriefing(metal: Metal): Promise<DailyBriefingType | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { getLatestBriefing } = await import('@/lib/db/queries');
    return await getLatestBriefing(metal);
  } catch {
    return null;
  }
}

function calculatePosture(cards: IndicatorCardData[]) {
  const availableCards = cards.filter((c) => c.displayState === 'success');
  const redCount = availableCards.filter((c) => c.signal === 'red').length;
  const greenCount = availableCards.filter((c) => c.signal === 'green').length;

  if (availableCards.length < 8) {
    return {
      posture: 'INSUFFICIENT_DATA' as const,
      reason: `Only ${availableCards.length} of 12 indicators available. Need at least 8 for confident posture.`,
      count: { total: 12, available: availableCards.length },
    };
  }

  if (redCount >= 4) {
    return {
      posture: 'SELL' as const,
      reason: `${redCount} indicators showing critical signals. Elevated risk.`,
      count: { total: 12, available: availableCards.length },
    };
  }

  if (greenCount >= 7 && redCount === 0) {
    return {
      posture: 'BUY' as const,
      reason: `${greenCount} indicators bullish with no critical signals.`,
      count: { total: 12, available: availableCards.length },
    };
  }

  if (redCount >= 3 || (redCount > 0 && greenCount < 5)) {
    return {
      posture: 'CAUTION' as const,
      reason: `Mixed signals: ${greenCount} bullish, ${redCount} critical.`,
      count: { total: 12, available: availableCards.length },
    };
  }

  return {
    posture: 'NEUTRAL' as const,
    reason: `${greenCount} bullish, ${redCount} critical. No strong signal.`,
    count: { total: 12, available: availableCards.length },
  };
}

function computeSlamRisk(
  data: SnapshotData | null,
  upcomingDates: KeyDate[]
): SlamRiskItem[] {
  if (!data) return DEFAULT_SLAM_RISK_ITEMS;

  const getSnapshot = (id: number) =>
    data.snapshots.find((s) => Number(s.indicator_id) === id) ?? null;
  const getPrior = (id: number) => data.priorSnapshots[id - 1] ?? null;

  const items: SlamRiskItem[] = [];

  // 1. COT Short Build (#5 commercial short)
  const cotShort = getSnapshot(INDICATOR_IDS.COT_COMMERCIAL);
  const priorCotShort = getPrior(INDICATOR_IDS.COT_COMMERCIAL);
  items.push(checkCotShortBuild(cotShort, priorCotShort));

  // 2. Margin Hike (#6)
  const margin = getSnapshot(INDICATOR_IDS.MARGIN_REQUIREMENTS);
  const priorMargin = getPrior(INDICATOR_IDS.MARGIN_REQUIREMENTS);
  items.push(checkMarginHike(margin, priorMargin));

  // 3. OI Drop (#1)
  const oi = getSnapshot(INDICATOR_IDS.OPEN_INTEREST);
  const priorOi = getPrior(INDICATOR_IDS.OPEN_INTEREST);
  items.push(checkOiDrop(oi, priorOi));

  // 4. Spread Widens (#7)
  const spread = getSnapshot(INDICATOR_IDS.BACKWARDATION);
  const priorSpread = getPrior(INDICATOR_IDS.BACKWARDATION);
  items.push(checkSpreadWidens(spread, priorSpread));

  // 5. Thin Liquidity
  items.push(checkThinLiquidity(upcomingDates));

  return items;
}

function checkCotShortBuild(
  current: IndicatorSnapshot | null,
  prior: IndicatorSnapshot | null
): SlamRiskItem {
  const item: SlamRiskItem = { id: 'cot-short', label: 'COT Short Build', active: false };
  if (!current || !prior) return item;

  const currentVal = Number(current.computed_value);
  const priorVal = Number(prior.computed_value);

  if (currentVal > priorVal) {
    item.active = true;
    item.reason = `Shorts up ${(currentVal - priorVal).toLocaleString()} contracts`;
  }
  return item;
}

function checkMarginHike(
  current: IndicatorSnapshot | null,
  prior: IndicatorSnapshot | null
): SlamRiskItem {
  const item: SlamRiskItem = { id: 'margin-hike', label: 'Margin Hike', active: false };
  if (!current) return item;

  if (current.signal === 'red') {
    item.active = true;
    item.reason = 'Recent margin hike detected';
    return item;
  }

  if (prior) {
    const curr = Number(current.computed_value);
    const prev = Number(prior.computed_value);
    if (curr > prev) {
      item.active = true;
      item.reason = `Margin up from ${prev.toFixed(1)}% to ${curr.toFixed(1)}%`;
    }
  }
  return item;
}

function checkOiDrop(
  current: IndicatorSnapshot | null,
  prior: IndicatorSnapshot | null
): SlamRiskItem {
  const item: SlamRiskItem = { id: 'oi-drop', label: 'OI Drop (no news)', active: false };
  if (!current || !prior) return item;

  const curr = Number(current.computed_value);
  const prev = Number(prior.computed_value);
  if (prev === 0) return item;

  const change = ((curr - prev) / prev) * 100;
  if (change < -5) {
    item.active = true;
    item.reason = `OI down ${Math.abs(change).toFixed(1)}%`;
  }
  return item;
}

function checkSpreadWidens(
  current: IndicatorSnapshot | null,
  prior: IndicatorSnapshot | null
): SlamRiskItem {
  const item: SlamRiskItem = { id: 'spread-widen', label: 'Spread Widens', active: false };
  if (!current || !prior) return item;

  const curr = Number(current.computed_value);
  const prev = Number(prior.computed_value);

  if (curr > prev && curr > 0.5) {
    item.active = true;
    item.reason = `Backwardation widened to $${curr.toFixed(2)}`;
  }
  return item;
}

function checkThinLiquidity(upcomingDates: KeyDate[]): SlamRiskItem {
  const item: SlamRiskItem = { id: 'thin-liquidity', label: 'Thin Liquidity', active: false };

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const holiday = upcomingDates.find((d) => {
    const eventDate = new Date(d.event_date);
    const type = (d.event_type ?? '').toUpperCase();
    return (type.includes('HOLIDAY') || type.includes('LIQUIDITY')) &&
      eventDate >= now && eventDate <= threeDays;
  });

  if (holiday) {
    item.active = true;
    item.reason = holiday.event_name;
  } else if (now.getDay() === 5) {
    item.active = true;
    item.reason = 'Weekend approaching';
  }

  return item;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const metal = parseMetal(params.metal);
  const config = getMetalConfig(metal);

  const [indicatorData, upcomingEvents, briefing] = await Promise.all([
    getIndicatorData(metal),
    getEvents(metal),
    getBriefing(metal),
  ]);

  const cards = await getIndicatorCards(indicatorData, metal);
  const slamRiskItems = computeSlamRisk(indicatorData, upcomingEvents);

  const { posture, reason, count } = calculatePosture(cards);

  const lastUpdated = cards
    .filter((c) => c.fetchedAt)
    .map((c) => c.fetchedAt!)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // Get spot price from backwardation indicator if available
  const spotSnapshot = indicatorData?.snapshots.find(
    (s) => Number(s.indicator_id) === INDICATOR_IDS.BACKWARDATION
  );
  const spotPrice = spotSnapshot?.raw_value
    ? (spotSnapshot.raw_value as { spotPrice?: number }).spotPrice ?? null
    : null;

  return (
    <>
      <Header metal={metal} config={config} spotPrice={spotPrice} lastUpdated={lastUpdated} />

      <PageShell>
        <PostureBanner posture={posture} reason={reason} indicatorCount={count} />
        <SlamRiskChecklist items={slamRiskItems} />
        <IndicatorGrid indicators={cards} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyBriefing briefing={briefing} />
          <UpcomingEvents events={upcomingEvents} />
        </div>
      </PageShell>
    </>
  );
}
