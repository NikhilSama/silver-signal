import { sql } from '@vercel/postgres';

import type {
  IndicatorSnapshot,
  IndicatorSnapshotInsert,
  IndicatorMetadata,
  KeyDate,
  DailyBriefing,
  BrowserPrompt,
  Metal,
} from '@/types/database';

/** Insert a new snapshot (append-only, never update) */
export async function insertSnapshot(
  snapshot: IndicatorSnapshotInsert
): Promise<IndicatorSnapshot> {
  const metal = snapshot.metal ?? 'silver';
  const result = await sql<IndicatorSnapshot>`
    INSERT INTO indicator_snapshots (
      indicator_id, metal, fetched_at, data_date, raw_value, computed_value,
      signal, signal_reason, source_url, fetch_status, error_detail
    ) VALUES (
      ${snapshot.indicator_id},
      ${metal},
      ${snapshot.fetched_at.toISOString()},
      ${snapshot.data_date.toISOString().split('T')[0]},
      ${JSON.stringify(snapshot.raw_value)},
      ${snapshot.computed_value},
      ${snapshot.signal},
      ${snapshot.signal_reason},
      ${snapshot.source_url},
      ${snapshot.fetch_status},
      ${snapshot.error_detail}
    )
    RETURNING *
  `;
  return result.rows[0];
}

/** Get latest snapshot for each indicator for a specific metal */
export async function getLatestSnapshots(
  metal: Metal = 'silver'
): Promise<IndicatorSnapshot[]> {
  const result = await sql<IndicatorSnapshot>`
    SELECT s.*
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY indicator_id ORDER BY id DESC) as rn
      FROM indicator_snapshots
      WHERE metal = ${metal}
    ) s
    WHERE s.rn = 1
    ORDER BY s.indicator_id
  `;
  return result.rows;
}

/** Get latest snapshot for a specific indicator and metal */
export async function getLatestSnapshot(
  indicatorId: number,
  metal: Metal = 'silver'
): Promise<IndicatorSnapshot | null> {
  const result = await sql<IndicatorSnapshot>`
    SELECT * FROM indicator_snapshots
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
    ORDER BY fetched_at DESC
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/** Get snapshot history for trend analysis (last N days) */
export async function getSnapshotHistory(
  indicatorId: number,
  days: number = 90,
  metal: Metal = 'silver'
): Promise<IndicatorSnapshot[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  const result = await sql<IndicatorSnapshot>`
    SELECT * FROM indicator_snapshots
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
      AND fetched_at > ${cutoffStr}
    ORDER BY data_date ASC
  `;
  return result.rows;
}

/** Check if a snapshot already exists for a date (deduplication) */
export async function snapshotExists(
  indicatorId: number,
  dataDate: Date,
  metal: Metal = 'silver'
): Promise<boolean> {
  const dateStr = dataDate.toISOString().split('T')[0];
  const result = await sql`
    SELECT 1 FROM indicator_snapshots
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
      AND data_date = ${dateStr}
    LIMIT 1
  `;
  return result.rows.length > 0;
}

/** Get all indicator metadata for a specific metal */
export async function getAllMetadata(
  metal: Metal = 'silver'
): Promise<IndicatorMetadata[]> {
  const result = await sql<IndicatorMetadata>`
    SELECT * FROM indicator_metadata
    WHERE metal = ${metal}
    ORDER BY indicator_id
  `;
  return result.rows;
}

/** Get metadata for a specific indicator and metal */
export async function getMetadata(
  indicatorId: number,
  metal: Metal = 'silver'
): Promise<IndicatorMetadata | null> {
  const result = await sql<IndicatorMetadata>`
    SELECT * FROM indicator_metadata
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
  `;
  return result.rows[0] ?? null;
}

/** Get upcoming key dates (next N days) for a specific metal */
export async function getUpcomingDates(
  days: number = 30,
  metal: Metal = 'silver'
): Promise<KeyDate[]> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  const endDateStr = endDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const result = await sql<KeyDate>`
    SELECT * FROM key_dates
    WHERE metal = ${metal}
      AND event_date >= ${todayStr}
      AND event_date <= ${endDateStr}
      AND active = TRUE
    ORDER BY event_date ASC
  `;
  return result.rows;
}

/** Get the latest daily briefing for a specific metal */
export async function getLatestBriefing(
  metal: Metal = 'silver'
): Promise<DailyBriefing | null> {
  const result = await sql<DailyBriefing>`
    SELECT * FROM daily_briefings
    WHERE metal = ${metal}
    ORDER BY briefing_date DESC
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/** Get yesterday's briefing for a specific metal */
export async function getYesterdayBriefing(
  metal: Metal = 'silver'
): Promise<DailyBriefing | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const result = await sql<DailyBriefing>`
    SELECT * FROM daily_briefings
    WHERE metal = ${metal}
      AND briefing_date = ${yesterdayStr}
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/** Insert a new daily briefing for a specific metal */
export async function insertBriefing(briefing: {
  metal?: Metal;
  briefing_date: Date;
  overall_posture: string;
  posture_reason: string;
  briefing_text: string;
  indicator_summary: Record<string, unknown>;
}): Promise<DailyBriefing> {
  const metal = briefing.metal ?? 'silver';
  const dateStr = briefing.briefing_date.toISOString().split('T')[0];

  const result = await sql<DailyBriefing>`
    INSERT INTO daily_briefings (
      metal, briefing_date, overall_posture, posture_reason,
      briefing_text, indicator_summary, generated_at
    ) VALUES (
      ${metal},
      ${dateStr},
      ${briefing.overall_posture},
      ${briefing.posture_reason},
      ${briefing.briefing_text},
      ${JSON.stringify(briefing.indicator_summary)},
      NOW()
    )
    ON CONFLICT (metal, briefing_date)
    DO UPDATE SET
      overall_posture = ${briefing.overall_posture},
      posture_reason = ${briefing.posture_reason},
      briefing_text = ${briefing.briefing_text},
      indicator_summary = ${JSON.stringify(briefing.indicator_summary)},
      generated_at = NOW()
    RETURNING *
  `;
  return result.rows[0];
}

/** Get browser prompt for an indicator and metal */
export async function getBrowserPrompt(
  indicatorId: number,
  metal: Metal = 'silver'
): Promise<BrowserPrompt | null> {
  const result = await sql<BrowserPrompt>`
    SELECT * FROM browser_prompts
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
  `;
  return result.rows[0] ?? null;
}

/** Get all browser prompts for a specific metal */
export async function getAllBrowserPrompts(
  metal: Metal = 'silver'
): Promise<BrowserPrompt[]> {
  const result = await sql<BrowserPrompt>`
    SELECT * FROM browser_prompts
    WHERE metal = ${metal}
    ORDER BY indicator_id
  `;
  return result.rows;
}

/** Update browser prompt for an indicator and metal */
export async function updateBrowserPrompt(
  indicatorId: number,
  prompt: string,
  targetUrl: string,
  metal: Metal = 'silver'
): Promise<BrowserPrompt> {
  const result = await sql<BrowserPrompt>`
    INSERT INTO browser_prompts (indicator_id, metal, prompt, target_url, enabled, last_updated)
    VALUES (${indicatorId}, ${metal}, ${prompt}, ${targetUrl}, TRUE, NOW())
    ON CONFLICT (indicator_id, metal)
    DO UPDATE SET
      prompt = ${prompt},
      target_url = ${targetUrl},
      last_updated = NOW()
    RETURNING *
  `;
  return result.rows[0];
}

/** Update browser prompt run status */
export async function updateBrowserPromptRunStatus(
  indicatorId: number,
  success: boolean,
  error: string | null,
  metal: Metal = 'silver'
): Promise<void> {
  await sql`
    UPDATE browser_prompts
    SET last_run_at = NOW(),
        last_run_success = ${success},
        last_run_error = ${error}
    WHERE indicator_id = ${indicatorId}
      AND metal = ${metal}
  `;
}
