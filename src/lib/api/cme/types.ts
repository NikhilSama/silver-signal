/** CME Silver Vault Stocks data structure */
export interface VaultStocksData {
  reportDate: Date;
  depositories: DepositoryRow[];
  totalRegistered: number;
  totalEligible: number;
  totalOunces: number;
  registeredRatio: number; // registered / total as decimal
}

export interface DepositoryRow {
  name: string;
  registered: number;
  eligible: number;
}

/** CME Open Interest data by contract month */
export interface OpenInterestData {
  reportDate: Date;
  totalOI: number;
  byMonth: ContractMonthOI[];
}

export interface ContractMonthOI {
  month: string; // e.g., "MAR 26", "MAY 26"
  year: number;
  oi: number;
  volume: number;
  settlement: number;
}

/** CME Delivery notices data */
export interface DeliveryData {
  reportDate: Date;
  contractMonth: string;
  issues: number; // warrants issued by shorts
  stops: number; // warrants received by longs
  cumulativeIssues: number;
  cumulativeStops: number;
  isDeliveryMonth: boolean;
  topIssuers: ClearingMemberDelivery[];
  topStoppers: ClearingMemberDelivery[];
}

export interface ClearingMemberDelivery {
  name: string;
  contracts: number;
  percentage: number;
}

/** Roll pattern analysis result */
export interface RollPatternData {
  reportDate: Date;
  frontMonth: string;
  nextMonth: string;
  frontMonthOI: number;
  nextMonthOI: number;
  frontMonthChange: number; // change from prior day
  nextMonthChange: number;
  rollDirection: 'forward' | 'backward' | 'neutral';
  daysToFND: number;
}

/** Parsed result from CME data fetch */
export interface CMEFetchResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  sourceUrl: string;
}

/** Silver contract delivery months */
export const SILVER_DELIVERY_MONTHS = ['MAR', 'MAY', 'JUL', 'SEP', 'DEC'] as const;
export type SilverDeliveryMonth = typeof SILVER_DELIVERY_MONTHS[number];

/** Check if current date is in a delivery month */
export function isDeliveryMonth(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 0-indexed
  // Mar=2, May=4, Jul=6, Sep=8, Dec=11
  return [2, 4, 6, 8, 11].includes(month);
}

/** Get the current front-month contract code */
export function getFrontMonthCode(date: Date = new Date()): string {
  const month = date.getMonth();
  const year = date.getFullYear() % 100;

  // Map current month to front delivery month
  const monthToDelivery: Record<number, string> = {
    0: 'MAR', 1: 'MAR', 2: 'MAR',
    3: 'MAY', 4: 'MAY',
    5: 'JUL', 6: 'JUL',
    7: 'SEP', 8: 'SEP',
    9: 'DEC', 10: 'DEC', 11: 'DEC',
  };

  return `${monthToDelivery[month]} ${year}`;
}
