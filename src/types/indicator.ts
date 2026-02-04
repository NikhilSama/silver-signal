import type { SignalType, FetchStatus } from './database';

/** Indicator IDs as defined in PRD */
export const INDICATOR_IDS = {
  OPEN_INTEREST: 1,
  VAULT_INVENTORY: 2,
  DELIVERY_ACTIVITY: 3,
  COT_SPECULATOR: 4,
  COT_COMMERCIAL: 5,
  MARGIN_REQUIREMENTS: 6,
  BACKWARDATION: 7,
  ROLL_PATTERNS: 8,
  LEASE_RATES: 9,
  SHANGHAI_PREMIUM: 10,
  FND_RATIO: 11,
  CVOL: 12,
} as const;

export type IndicatorId = (typeof INDICATOR_IDS)[keyof typeof INDICATOR_IDS];

/** Display state for an indicator card */
export type IndicatorDisplayState =
  | 'success'
  | 'error'
  | 'awaiting'
  | 'stale'
  | 'not_applicable';

/** Props for rendering an indicator card */
export interface IndicatorCardData {
  indicatorId: number;
  name: string;
  shortDescription: string;
  displayState: IndicatorDisplayState;
  signal: SignalType | null;
  signalLabel: string;
  currentValue: string;
  rawValue: number | null;
  dataDate: Date | null;
  fetchedAt: Date | null;
  fetchStatus: FetchStatus | null;
  errorDetail: string | null;
  trendDirection: 'up' | 'down' | 'flat' | null;
  weekOverWeekChange: number | null;
  fullDescription: string;
  whyItWorks: string;
  signalReason: string | null;
  sourceUrl: string | null;
  hasBrowserPrompt: boolean;
}

/** Trend calculation result */
export interface TrendInfo {
  direction: 'up' | 'down' | 'flat';
  weekOverWeekChange: number | null;
  priorValue: number | null;
}

/** Pre-slam risk checklist item */
export interface SlamRiskItem {
  id: string;
  label: string;
  active: boolean;
  reason?: string;
}
