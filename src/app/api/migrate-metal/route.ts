import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Migration endpoint to add metal column to all tables.
 * Safe to run multiple times - uses IF NOT EXISTS/ADD COLUMN IF NOT EXISTS.
 */
export async function GET(): Promise<NextResponse> {
  const migrations: { table: string; success: boolean; error?: string }[] = [];

  // 1. Add metal column to indicator_snapshots
  try {
    await sql`
      ALTER TABLE indicator_snapshots
      ADD COLUMN IF NOT EXISTS metal TEXT DEFAULT 'silver'
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_snapshots_metal
      ON indicator_snapshots(metal)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_snapshots_metal_indicator
      ON indicator_snapshots(metal, indicator_id, fetched_at DESC)
    `;
    migrations.push({ table: 'indicator_snapshots', success: true });
  } catch (error) {
    migrations.push({
      table: 'indicator_snapshots',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 2. Add metal column to indicator_metadata
  try {
    await sql`
      ALTER TABLE indicator_metadata
      ADD COLUMN IF NOT EXISTS metal TEXT DEFAULT 'silver'
    `;
    // Update primary key to composite (metal, indicator_id)
    // Note: This is complex in Postgres, so we create a unique index instead
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_metal_indicator
      ON indicator_metadata(metal, indicator_id)
    `;
    migrations.push({ table: 'indicator_metadata', success: true });
  } catch (error) {
    migrations.push({
      table: 'indicator_metadata',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 3. Add metal column to daily_briefings
  try {
    await sql`
      ALTER TABLE daily_briefings
      ADD COLUMN IF NOT EXISTS metal TEXT DEFAULT 'silver'
    `;
    // Drop old unique constraint (it's a constraint, not just an index)
    try {
      await sql`
        ALTER TABLE daily_briefings
        DROP CONSTRAINT IF EXISTS daily_briefings_briefing_date_key
      `;
    } catch {
      // Constraint may not exist, that's okay
    }
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_briefings_metal_date
      ON daily_briefings(metal, briefing_date)
    `;
    migrations.push({ table: 'daily_briefings', success: true });
  } catch (error) {
    migrations.push({
      table: 'daily_briefings',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 4. Add metal column to key_dates
  try {
    await sql`
      ALTER TABLE key_dates
      ADD COLUMN IF NOT EXISTS metal TEXT DEFAULT 'silver'
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_key_dates_metal
      ON key_dates(metal, event_date)
    `;
    migrations.push({ table: 'key_dates', success: true });
  } catch (error) {
    migrations.push({
      table: 'key_dates',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 5. Add metal column to browser_prompts
  try {
    await sql`
      ALTER TABLE browser_prompts
      ADD COLUMN IF NOT EXISTS metal TEXT DEFAULT 'silver'
    `;
    // Create new composite primary key index
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_browser_prompts_metal_indicator
      ON browser_prompts(metal, indicator_id)
    `;
    migrations.push({ table: 'browser_prompts', success: true });
  } catch (error) {
    migrations.push({
      table: 'browser_prompts',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const allSuccess = migrations.every((m) => m.success);
  const failCount = migrations.filter((m) => !m.success).length;

  return NextResponse.json({
    success: allSuccess,
    message: allSuccess
      ? 'All migrations completed successfully'
      : `${failCount} migration(s) failed`,
    migrations,
    timestamp: new Date().toISOString(),
  });
}
