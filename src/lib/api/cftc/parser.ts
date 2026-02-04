import type { CFTCCOTRow, ParsedCOTData } from './types';

/** Parse a single COT row into structured data */
function parseCOTRow(row: CFTCCOTRow): ParsedCOTData {
  // CFTC uses abbreviated field names (noncomm_ not noncommercial_)
  const speculatorLong = parseInt(row.noncomm_positions_long_all, 10) || 0;
  const speculatorShort = parseInt(row.noncomm_positions_short_all, 10) || 0;
  const commercialLong = parseInt(row.comm_positions_long_all, 10) || 0;
  const commercialShort = parseInt(row.comm_positions_short_all, 10) || 0;

  return {
    reportDate: new Date(row.report_date_as_yyyy_mm_dd),
    openInterest: parseInt(row.open_interest_all, 10) || 0,
    speculatorLong,
    speculatorShort,
    speculatorNet: speculatorLong - speculatorShort,
    commercialLong,
    commercialShort,
    commercialNetShort: commercialShort - commercialLong,
  };
}

/** Parse multiple COT rows */
export function parseCOTRows(rows: CFTCCOTRow[]): ParsedCOTData[] {
  return rows.map(parseCOTRow);
}

/** Validate parsed COT data has reasonable values */
export function validateCOTData(data: ParsedCOTData): boolean {
  // Basic sanity checks
  if (data.openInterest < 0) return false;
  if (data.speculatorLong < 0 || data.speculatorShort < 0) return false;
  if (data.commercialLong < 0 || data.commercialShort < 0) return false;
  if (isNaN(data.reportDate.getTime())) return false;

  return true;
}
