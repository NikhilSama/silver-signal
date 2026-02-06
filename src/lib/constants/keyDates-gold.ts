import type { EventType } from '@/types/database';

interface KeyDateSeed {
  event_date: string;
  event_name: string;
  event_type: EventType;
  description: string;
}

/** Gold FND dates for 2026 (Feb, Apr, Jun, Aug, Oct, Dec delivery months) */
const FND_DATES_2026: KeyDateSeed[] = [
  { event_date: '2026-01-30', event_name: 'February 2026 FND', event_type: 'FND', description: 'First Notice Day for February 2026 gold contract' },
  { event_date: '2026-03-31', event_name: 'April 2026 FND', event_type: 'FND', description: 'First Notice Day for April 2026 gold contract' },
  { event_date: '2026-05-29', event_name: 'June 2026 FND', event_type: 'FND', description: 'First Notice Day for June 2026 gold contract' },
  { event_date: '2026-07-31', event_name: 'August 2026 FND', event_type: 'FND', description: 'First Notice Day for August 2026 gold contract' },
  { event_date: '2026-09-30', event_name: 'October 2026 FND', event_type: 'FND', description: 'First Notice Day for October 2026 gold contract' },
  { event_date: '2026-11-27', event_name: 'December 2026 FND', event_type: 'FND', description: 'First Notice Day for December 2026 gold contract' },
];

/** Gold contract expiry dates for 2026 */
const EXPIRY_DATES_2026: KeyDateSeed[] = [
  { event_date: '2026-02-26', event_name: 'February 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'February 2026 gold contract expiration' },
  { event_date: '2026-04-28', event_name: 'April 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'April 2026 gold contract expiration' },
  { event_date: '2026-06-26', event_name: 'June 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'June 2026 gold contract expiration' },
  { event_date: '2026-08-27', event_name: 'August 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'August 2026 gold contract expiration' },
  { event_date: '2026-10-28', event_name: 'October 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'October 2026 gold contract expiration' },
  { event_date: '2026-12-29', event_name: 'December 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'December 2026 gold contract expiration' },
];

/** Generate all Fridays for COT releases in 2026 (same as silver - shared report) */
function generateCOTDates2026(): KeyDateSeed[] {
  const dates: KeyDateSeed[] = [];
  const startDate = new Date('2026-01-02'); // First Friday of 2026
  const endDate = new Date('2026-12-31');

  const current = new Date(startDate);
  while (current <= endDate) {
    if (current.getDay() === 5) { // Friday
      dates.push({
        event_date: current.toISOString().split('T')[0],
        event_name: 'COT Release',
        event_type: 'COT_RELEASE',
        description: 'Weekly CFTC Commitments of Traders report release',
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** All key dates for gold seeding */
export const GOLD_KEY_DATES_SEED: KeyDateSeed[] = [
  ...FND_DATES_2026,
  ...EXPIRY_DATES_2026,
  ...generateCOTDates2026(),
];
