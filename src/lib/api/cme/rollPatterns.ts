import type { OpenInterestData, RollPatternData, ContractMonthOI } from './types';
import { SILVER_DELIVERY_MONTHS } from './types';

/** FND dates for 2026 (last business day of prior month) */
const FND_DATES_2026: Record<string, Date> = {
  'MAR 26': new Date('2026-02-27'),
  'MAY 26': new Date('2026-04-30'),
  'JUL 26': new Date('2026-06-30'),
  'SEP 26': new Date('2026-08-28'),
  'DEC 26': new Date('2026-11-30'),
};

/** Analyze roll patterns from current and prior OI data */
export function analyzeRollPatterns(
  currentOI: OpenInterestData,
  priorOI: OpenInterestData | null
): RollPatternData {
  const today = new Date();
  const { frontMonth, nextMonth } = identifyActiveContracts(currentOI.byMonth, today);

  const frontMonthOI = getOIForMonth(currentOI.byMonth, frontMonth);
  const nextMonthOI = getOIForMonth(currentOI.byMonth, nextMonth);

  let frontMonthChange = 0;
  let nextMonthChange = 0;

  if (priorOI) {
    const priorFrontOI = getOIForMonth(priorOI.byMonth, frontMonth);
    const priorNextOI = getOIForMonth(priorOI.byMonth, nextMonth);
    frontMonthChange = frontMonthOI - priorFrontOI;
    nextMonthChange = nextMonthOI - priorNextOI;
  }

  const rollDirection = determineRollDirection(frontMonthChange, nextMonthChange);
  const daysToFND = calculateDaysToFND(frontMonth, today);

  return {
    reportDate: today,
    frontMonth,
    nextMonth,
    frontMonthOI,
    nextMonthOI,
    frontMonthChange,
    nextMonthChange,
    rollDirection,
    daysToFND,
  };
}

/** Identify front month and next month from available contracts */
function identifyActiveContracts(
  byMonth: ContractMonthOI[],
  today: Date
): { frontMonth: string; nextMonth: string } {
  // Sort by date
  const sorted = [...byMonth].sort((a, b) => {
    const dateA = parseMonthToDate(a.month);
    const dateB = parseMonthToDate(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  // Find first contract that hasn't expired
  const active = sorted.filter((m) => {
    const monthDate = parseMonthToDate(m.month);
    return monthDate >= today;
  });

  if (active.length >= 2) {
    return { frontMonth: active[0].month, nextMonth: active[1].month };
  } else if (active.length === 1) {
    return { frontMonth: active[0].month, nextMonth: active[0].month };
  }

  // Fallback: use first two from list
  const currentYear = today.getFullYear() % 100;
  return {
    frontMonth: `MAR ${currentYear}`,
    nextMonth: `MAY ${currentYear}`,
  };
}

/** Parse month string like "MAR 26" to approximate date */
function parseMonthToDate(month: string): Date {
  const parts = month.split(' ');
  if (parts.length !== 2) return new Date();

  const monthName = parts[0].toUpperCase();
  const year = 2000 + parseInt(parts[1], 10);

  const monthIndex = getMonthIndex(monthName);
  return new Date(year, monthIndex, 1);
}

/** Get 0-indexed month number from abbreviation */
function getMonthIndex(abbr: string): number {
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  return months[abbr] ?? 0;
}

/** Get OI for a specific contract month */
function getOIForMonth(byMonth: ContractMonthOI[], month: string): number {
  const contract = byMonth.find(
    (m) => m.month.toUpperCase() === month.toUpperCase()
  );
  return contract?.oi ?? 0;
}

/** Determine roll direction based on OI changes */
function determineRollDirection(
  frontChange: number,
  nextChange: number
): 'forward' | 'backward' | 'neutral' {
  // Forward roll: front month OI decreasing, next month OI increasing
  if (frontChange < -1000 && nextChange > 1000) {
    return 'forward';
  }

  // Backward roll: front month OI increasing or stable while next month decreasing
  if (frontChange > 500 && nextChange < 0) {
    return 'backward';
  }

  // Unusual: both increasing into front month
  if (frontChange > 1000 && Math.abs(nextChange) < 500) {
    return 'backward';
  }

  return 'neutral';
}

/** Calculate days until FND for the front month */
function calculateDaysToFND(frontMonth: string, today: Date): number {
  const fndDate = FND_DATES_2026[frontMonth];
  if (!fndDate) {
    // Estimate: last business day of prior month
    const monthDate = parseMonthToDate(frontMonth);
    const lastDayPriorMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0);
    return Math.max(0, Math.floor((lastDayPriorMonth.getTime() - today.getTime()) / 86400000));
  }

  return Math.max(0, Math.floor((fndDate.getTime() - today.getTime()) / 86400000));
}

/** Check if roll pattern indicates stress (high OI near FND) */
export function isRollStress(pattern: RollPatternData): boolean {
  // RED: backward rolls or >20% of OI held within 5 days of FND
  if (pattern.rollDirection === 'backward') {
    return true;
  }

  if (pattern.daysToFND <= 5 && pattern.frontMonthOI > 10000) {
    return true;
  }

  return false;
}
