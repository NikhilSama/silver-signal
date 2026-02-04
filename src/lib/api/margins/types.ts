/** Margin requirements data structure */
export interface MarginData {
  reportDate: Date;
  initialMarginPercent: number;
  maintenanceMarginPercent: number;
  initialMarginDollars: number; // computed from percent * contract value
  contractValue: number; // current contract value (5000 oz * spot)
  lastChangeDate: Date | null;
  changePercent: number | null; // % change from prior level
  recentChanges: MarginChange[];
}

export interface MarginChange {
  effectiveDate: Date;
  oldPercent: number;
  newPercent: number;
  changePercent: number; // relative change (newPercent - oldPercent) / oldPercent
}

export interface MarginFetchResult {
  success: boolean;
  data: MarginData | null;
  error?: string;
  sourceUrl: string;
}
