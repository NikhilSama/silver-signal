/**
 * Database seed script
 * Run with: npm run db:seed
 */
import { sql } from '@vercel/postgres';

import { INDICATOR_METADATA } from '@/lib/constants/indicators';
import { KEY_DATES_SEED } from '@/lib/constants/keyDates';

async function seedIndicatorMetadata(): Promise<void> {
  console.log('Seeding indicator_metadata...');

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

  console.log(`Seeded ${INDICATOR_METADATA.length} indicators`);
}

async function seedKeyDates(): Promise<void> {
  console.log('Seeding key_dates...');

  for (const date of KEY_DATES_SEED) {
    await sql`
      INSERT INTO key_dates (event_date, event_name, event_type, description, active)
      VALUES (${date.event_date}, ${date.event_name}, ${date.event_type}, ${date.description}, TRUE)
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`Seeded ${KEY_DATES_SEED.length} key dates`);
}

async function main(): Promise<void> {
  console.log('Starting database seed...\n');

  try {
    await seedIndicatorMetadata();
    await seedKeyDates();
    console.log('\nSeed completed successfully!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

main();
