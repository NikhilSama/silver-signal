import type { EventType } from '@/types/database';

interface KeyDateSeed {
  event_date: string;
  event_name: string;
  event_type: EventType;
  description: string;
}

/** Silver FND dates for 2026 (Mar, May, Jul, Sep, Dec delivery months) */
const FND_DATES_2026: KeyDateSeed[] = [
  { event_date: '2026-02-27', event_name: 'March 2026 FND', event_type: 'FND', description: 'First Notice Day for March 2026 silver contract' },
  { event_date: '2026-04-30', event_name: 'May 2026 FND', event_type: 'FND', description: 'First Notice Day for May 2026 silver contract' },
  { event_date: '2026-06-30', event_name: 'July 2026 FND', event_type: 'FND', description: 'First Notice Day for July 2026 silver contract' },
  { event_date: '2026-08-28', event_name: 'September 2026 FND', event_type: 'FND', description: 'First Notice Day for September 2026 silver contract' },
  { event_date: '2026-11-27', event_name: 'December 2026 FND', event_type: 'FND', description: 'First Notice Day for December 2026 silver contract' },
];

/** Silver contract expiry dates for 2026 */
const EXPIRY_DATES_2026: KeyDateSeed[] = [
  { event_date: '2026-03-27', event_name: 'March 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'March 2026 silver contract expiration' },
  { event_date: '2026-05-28', event_name: 'May 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'May 2026 silver contract expiration' },
  { event_date: '2026-07-29', event_name: 'July 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'July 2026 silver contract expiration' },
  { event_date: '2026-09-28', event_name: 'September 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'September 2026 silver contract expiration' },
  { event_date: '2026-12-29', event_name: 'December 2026 Expiry', event_type: 'CONTRACT_EXPIRY', description: 'December 2026 silver contract expiration' },
];

/** Generate all Fridays for COT releases in 2026 */
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

/** All key dates for seeding */
export const KEY_DATES_SEED: KeyDateSeed[] = [
  ...FND_DATES_2026,
  ...EXPIRY_DATES_2026,
  ...generateCOTDates2026(),
];
