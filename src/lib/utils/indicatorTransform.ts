import type { IndicatorSnapshot, IndicatorMetadata, SignalType } from '@/types/database';
import type { IndicatorCardData, IndicatorDisplayState } from '@/types/indicator';
import { formatCompact } from './format';

/** Determine display state based on snapshot data */
function getDisplayState(
  snapshot: IndicatorSnapshot | null,
  metadata: IndicatorMetadata
): IndicatorDisplayState {
  if (!snapshot) return 'awaiting';

  if (snapshot.fetch_status !== 'success') return 'error';

  // Check for stale data (2x update frequency)
  const now = new Date();
  const fetchedAt = new Date(snapshot.fetched_at);
  const hoursSinceFetch = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);

  // Weekly indicators are stale after 14 days (2x 7 days)
  if (metadata.update_frequency.includes('Weekly') && hoursSinceFetch > 336) {
    return 'stale';
  }

  // Daily indicators are stale after 48 hours (2x 24 hours)
  if (metadata.update_frequency.includes('Daily') && hoursSinceFetch > 48) {
    return 'stale';
  }

  return 'success';
}

/** Get signal label from signal reason */
function getSignalLabel(signal: SignalType, reason: string): string {
  if (signal === 'error') return 'ERROR';

  // Extract first word (BULLISH, WATCH, CRITICAL, etc)
  const match = reason.match(/^(\w+):/);
  return match ? match[1] : signal.toUpperCase();
}

/** Format computed value for display based on indicator */
function formatValue(indicatorId: number, value: number): string {
  switch (indicatorId) {
    case 1: // Open Interest
      return `${formatCompact(value)} contracts`;
    case 2: // Vault Inventory (registered ounces)
      return formatOunces(value);
    case 3: // Delivery Activity (stops)
      return `${formatCompact(value)} stops`;
    case 4: // Speculator net
    case 5: // Commercial short
      return `Net ${formatCompact(value)} contracts`;
    case 6: // Margin
      return `${value.toFixed(1)}% margin`;
    case 7: // Backwardation
      return value >= 0 ? `$${value.toFixed(2)} contango` : `$${Math.abs(value).toFixed(2)} backwardation`;
    case 8: // Roll patterns (front month OI)
      return `${formatCompact(value)} front-month OI`;
    case 9: // Lease rates
      return `${value.toFixed(1)}% annualized`;
    case 10: // Shanghai premium
      return `${value.toFixed(1)}% premium`;
    case 11: // FND ratio
      return `${value.toFixed(2)} ratio`;
    case 12: // CVOL
      return `${value.toFixed(1)}% range`;
    default:
      return formatCompact(value);
  }
}

/** Format ounces in human-readable format */
function formatOunces(oz: number): string {
  if (oz >= 1_000_000) {
    return `${(oz / 1_000_000).toFixed(1)}M oz`;
  }
  if (oz >= 1_000) {
    return `${(oz / 1_000).toFixed(0)}K oz`;
  }
  return `${oz.toLocaleString()} oz`;
}

/** Transform snapshot and metadata into card display data */
export function transformToCardData(
  indicatorId: number,
  snapshot: IndicatorSnapshot | null,
  metadata: IndicatorMetadata,
  priorSnapshot?: IndicatorSnapshot | null,
  hasBrowserPrompt: boolean = false
): IndicatorCardData {
  const displayState = getDisplayState(snapshot, metadata);

  // Calculate trend if we have prior data
  let trendDirection: 'up' | 'down' | 'flat' | null = null;
  let weekOverWeekChange: number | null = null;

  if (snapshot && priorSnapshot && displayState === 'success') {
    const currentVal = Number(snapshot.computed_value);
    const priorVal = Number(priorSnapshot.computed_value);

    if (priorVal !== 0) {
      weekOverWeekChange = ((currentVal - priorVal) / Math.abs(priorVal)) * 100;
    }

    if (currentVal > priorVal) trendDirection = 'up';
    else if (currentVal < priorVal) trendDirection = 'down';
    else trendDirection = 'flat';
  }

  return {
    indicatorId,
    name: metadata.name,
    shortDescription: metadata.short_description,
    displayState,
    signal: snapshot?.signal as SignalType ?? null,
    signalLabel: snapshot ? getSignalLabel(snapshot.signal as SignalType, snapshot.signal_reason) : '',
    currentValue: snapshot ? formatValue(indicatorId, Number(snapshot.computed_value)) : '',
    rawValue: snapshot ? Number(snapshot.computed_value) : null,
    dataDate: snapshot ? new Date(snapshot.data_date) : null,
    fetchedAt: snapshot ? new Date(snapshot.fetched_at) : null,
    fetchStatus: snapshot?.fetch_status ?? null,
    errorDetail: snapshot?.error_detail ?? null,
    trendDirection,
    weekOverWeekChange,
    fullDescription: metadata.full_description,
    whyItWorks: metadata.why_it_works,
    signalReason: snapshot?.signal_reason ?? null,
    sourceUrl: snapshot?.source_url ?? null,
    hasBrowserPrompt,
  };
}
