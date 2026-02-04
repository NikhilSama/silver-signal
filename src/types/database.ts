/** Signal state for traffic light scoring */
export type SignalType = 'green' | 'yellow' | 'red' | 'error';

/** Fetch status for data pulls */
export type FetchStatus = 'success' | 'error' | 'timeout' | 'parse_error';

/** Event types for key_dates table */
export type EventType = 'FND' | 'COT_RELEASE' | 'CONTRACT_EXPIRY' | 'HOLIDAY_WINDOW' | 'OTHER';

/** Overall market posture */
export type PostureType = 'BUY' | 'SELL' | 'CAUTION' | 'NEUTRAL' | 'INSUFFICIENT_DATA';

/** Core time-series data row from indicator_snapshots */
export interface IndicatorSnapshot {
  id: number;
  indicator_id: number;
  fetched_at: Date;
  data_date: Date;
  raw_value: Record<string, unknown>;
  computed_value: number;
  signal: SignalType;
  signal_reason: string;
  source_url: string;
  fetch_status: FetchStatus;
  error_detail: string | null;
}

/** Static reference data for each indicator */
export interface IndicatorMetadata {
  indicator_id: number;
  name: string;
  short_description: string;
  full_description: string;
  why_it_works: string;
  green_criteria: string;
  yellow_criteria: string;
  red_criteria: string;
  update_frequency: string;
  source_name: string;
}

/** LLM-generated daily briefing */
export interface DailyBriefing {
  id: number;
  briefing_date: Date;
  overall_posture: PostureType;
  posture_reason: string;
  briefing_text: string;
  indicator_summary: Record<string, unknown>;
  generated_at: Date;
}

/** Market-critical dates */
export interface KeyDate {
  id: number;
  event_date: Date;
  event_name: string;
  event_type: EventType;
  description: string;
  active: boolean;
}

/** Insert payload for indicator_snapshots (no id, auto-generated) */
export type IndicatorSnapshotInsert = Omit<IndicatorSnapshot, 'id'>;

/** Browser Use prompt configuration for an indicator */
export interface BrowserPrompt {
  indicator_id: number;
  prompt: string;
  target_url: string;
  enabled: boolean;
  last_updated: Date;
  last_run_at: Date | null;
  last_run_success: boolean | null;
  last_run_error: string | null;
}
