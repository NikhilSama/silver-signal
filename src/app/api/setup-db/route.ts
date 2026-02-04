import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  try {
    // Create indicator_snapshots table
    await sql`
      CREATE TABLE IF NOT EXISTS indicator_snapshots (
        id BIGSERIAL PRIMARY KEY,
        indicator_id INTEGER NOT NULL CHECK (indicator_id >= 1 AND indicator_id <= 12),
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data_date DATE NOT NULL,
        raw_value JSONB NOT NULL,
        computed_value NUMERIC NOT NULL,
        signal TEXT NOT NULL CHECK (signal IN ('green', 'yellow', 'red', 'error')),
        signal_reason TEXT NOT NULL,
        source_url TEXT NOT NULL,
        fetch_status TEXT NOT NULL CHECK (fetch_status IN ('success', 'error', 'timeout', 'parse_error')),
        error_detail TEXT
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_snapshots_indicator_date
      ON indicator_snapshots(indicator_id, data_date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_snapshots_indicator_fetched
      ON indicator_snapshots(indicator_id, fetched_at DESC)
    `;

    // Create indicator_metadata table
    await sql`
      CREATE TABLE IF NOT EXISTS indicator_metadata (
        indicator_id INTEGER PRIMARY KEY CHECK (indicator_id >= 1 AND indicator_id <= 12),
        name TEXT NOT NULL,
        short_description TEXT NOT NULL,
        full_description TEXT NOT NULL,
        why_it_works TEXT NOT NULL,
        green_criteria TEXT NOT NULL,
        yellow_criteria TEXT NOT NULL,
        red_criteria TEXT NOT NULL,
        update_frequency TEXT NOT NULL,
        source_name TEXT NOT NULL
      )
    `;

    // Create daily_briefings table
    await sql`
      CREATE TABLE IF NOT EXISTS daily_briefings (
        id BIGSERIAL PRIMARY KEY,
        briefing_date DATE NOT NULL UNIQUE,
        overall_posture TEXT NOT NULL CHECK (overall_posture IN ('BUY', 'SELL', 'CAUTION', 'NEUTRAL', 'INSUFFICIENT_DATA')),
        posture_reason TEXT NOT NULL,
        briefing_text TEXT NOT NULL,
        indicator_summary JSONB NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_briefings_date ON daily_briefings(briefing_date DESC)
    `;

    // Create key_dates table
    await sql`
      CREATE TABLE IF NOT EXISTS key_dates (
        id BIGSERIAL PRIMARY KEY,
        event_date DATE NOT NULL,
        event_name TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('FND', 'COT_RELEASE', 'CONTRACT_EXPIRY', 'HOLIDAY_WINDOW', 'OTHER')),
        description TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_key_dates_date ON key_dates(event_date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_key_dates_active ON key_dates(active, event_date)
    `;

    // Create browser_prompts table for Browser Use automation
    await sql`
      CREATE TABLE IF NOT EXISTS browser_prompts (
        indicator_id INTEGER PRIMARY KEY CHECK (indicator_id >= 1 AND indicator_id <= 12),
        prompt TEXT NOT NULL,
        target_url TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_run_at TIMESTAMPTZ,
        last_run_success BOOLEAN,
        last_run_error TEXT
      )
    `;

    // Seed default browser prompts for indicators that support Browser Use
    await sql`
      INSERT INTO browser_prompts (indicator_id, prompt, target_url, enabled)
      VALUES
        (1, 'Go to the URL above. Wait for the Volume and Open Interest data table to fully load. Find the ''Total'' row at the bottom of the table. Look for the ''Open Interest'' column value in the Total row. This is the total number of open contracts, should be a number like 150000 or 160000. Return ONLY that number without commas, nothing else.',
         'https://www.cmegroup.com/markets/metals/precious/silver.volume.html', TRUE),
        (6, 'Go to the URL above. Wait for the margins table to fully load. Look for the row with ''SI'' or ''Silver Futures'' in the Outright section. Find the ''Start Period Maintenance Rate'' or ''Initial Rate'' column which shows the margin as a percentage. This should be a number between 10 and 20 (like 15% or 15.0%). Return ONLY that percentage number, nothing else.',
         'https://www.cmegroup.com/markets/metals/precious/silver.margins.html', TRUE)
      ON CONFLICT (indicator_id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
