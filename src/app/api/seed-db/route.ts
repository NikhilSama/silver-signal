import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

import { INDICATOR_METADATA } from '@/lib/constants/indicators';
import { KEY_DATES_SEED } from '@/lib/constants/keyDates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  try {
    // Seed indicator_metadata
    for (let i = 0; i < INDICATOR_METADATA.length; i++) {
      const indicator = INDICATOR_METADATA[i];
      const indicatorId = i + 1;

      await sql`
        INSERT INTO indicator_metadata (
          indicator_id, name, short_description, full_description,
          why_it_works, green_criteria, yellow_criteria, red_criteria,
          update_frequency, source_name
        ) VALUES (
          ${indicatorId},
          ${indicator.name},
          ${indicator.short_description},
          ${indicator.full_description},
          ${indicator.why_it_works},
          ${indicator.green_criteria},
          ${indicator.yellow_criteria},
          ${indicator.red_criteria},
          ${indicator.update_frequency},
          ${indicator.source_name}
        )
        ON CONFLICT (indicator_id) DO UPDATE SET
          name = EXCLUDED.name,
          short_description = EXCLUDED.short_description,
          full_description = EXCLUDED.full_description,
          why_it_works = EXCLUDED.why_it_works,
          green_criteria = EXCLUDED.green_criteria,
          yellow_criteria = EXCLUDED.yellow_criteria,
          red_criteria = EXCLUDED.red_criteria,
          update_frequency = EXCLUDED.update_frequency,
          source_name = EXCLUDED.source_name
      `;
    }

    // Seed key_dates
    for (const date of KEY_DATES_SEED) {
      await sql`
        INSERT INTO key_dates (event_date, event_name, event_type, description, active)
        VALUES (${date.event_date}, ${date.event_name}, ${date.event_type}, ${date.description}, TRUE)
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${INDICATOR_METADATA.length} indicators and ${KEY_DATES_SEED.length} key dates`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
