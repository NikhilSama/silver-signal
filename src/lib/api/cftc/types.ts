/** Raw CFTC COT API response row */
export interface CFTCCOTRow {
  report_date_as_yyyy_mm_dd: string;
  commodity_name: string;
  market_and_exchange_names: string;
  open_interest_all: string;
  // CFTC uses abbreviated field names
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
}

/** Parsed COT data for silver */
export interface ParsedCOTData {
  reportDate: Date;
  openInterest: number;
  speculatorLong: number;
  speculatorShort: number;
  speculatorNet: number;
  commercialLong: number;
  commercialShort: number;
  commercialNetShort: number;
}

/** COT fetch result */
export interface COTFetchResult {
  success: boolean;
  data: ParsedCOTData[] | null;
  error: string | null;
  sourceUrl: string;
}
