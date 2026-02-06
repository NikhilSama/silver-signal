import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

import { INDICATOR_METADATA } from '@/lib/constants/indicators';
import { GOLD_INDICATOR_METADATA } from '@/lib/constants/indicators-gold';
import { KEY_DATES_SEED } from '@/lib/constants/keyDates';
import { GOLD_KEY_DATES_SEED } from '@/lib/constants/keyDates-gold';
import { parseMetal } from '@/lib/constants/metals';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Parse metal from query params
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));

  // Select appropriate metadata based on metal
  const indicatorMetadata = metal === 'gold' ? GOLD_INDICATOR_METADATA : INDICATOR_METADATA;
  const keyDates = metal === 'gold' ? GOLD_KEY_DATES_SEED : KEY_DATES_SEED;

  try {
    // Seed indicator_metadata
    for (let i = 0; i < indicatorMetadata.length; i++) {
      const indicator = indicatorMetadata[i];
      const indicatorId = i + 1;

      await sql`
        INSERT INTO indicator_metadata (
          indicator_id, metal, name, short_description, full_description,
          why_it_works, green_criteria, yellow_criteria, red_criteria,
          update_frequency, source_name
        ) VALUES (
          ${indicatorId},
          ${metal},
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
        ON CONFLICT (metal, indicator_id) DO UPDATE SET
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
    for (const date of keyDates) {
      await sql`
        INSERT INTO key_dates (event_date, event_name, event_type, description, metal, active)
        VALUES (${date.event_date}, ${date.event_name}, ${date.event_type}, ${date.description}, ${metal}, TRUE)
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({
      success: true,
      metal,
      message: `Seeded ${indicatorMetadata.length} ${metal} indicators and ${keyDates.length} key dates`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
