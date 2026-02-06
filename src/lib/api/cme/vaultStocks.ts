import * as XLSX from 'xlsx';
import type { VaultStocksData, DepositoryRow, CMEFetchResult } from './types';
import type { MetalConfig } from '@/lib/constants/metals';
import { getMetalConfig } from '@/lib/constants/metals';

const CME_VAULT_BASE = 'https://www.cmegroup.com/delivery_reports';

/** Get vault stocks URL for a metal */
function getVaultStocksUrl(config: MetalConfig): string {
  return `${CME_VAULT_BASE}/${config.vaultStocksFile}`;
}

/** Fetch and parse CME vault stocks XLS file for a metal */
export async function fetchVaultStocks(
  config: MetalConfig = getMetalConfig()
): Promise<CMEFetchResult<VaultStocksData>> {
  const url = getVaultStocksUrl(config);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SilverMonitor/1.0)',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        sourceUrl: url,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = parseVaultStocksXLS(arrayBuffer);

    return {
      success: true,
      data,
      sourceUrl: url,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
      sourceUrl: url,
    };
  }
}

/** Parse the Silver_stocks.xls file content */
function parseVaultStocksXLS(buffer: ArrayBuffer): VaultStocksData {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // Find the "TOTAL TODAY" column index from header row
  const valueColIndex = findValueColumnIndex(rows);

  const depositories: DepositoryRow[] = [];
  let totalRegistered = 0;
  let totalEligible = 0;
  let reportDate = new Date();

  // Parse the report date from the header
  for (const row of rows.slice(0, 15)) {
    const dateMatch = findReportDate(row);
    if (dateMatch) {
      reportDate = dateMatch;
      break;
    }
  }

  // Parse depositories and totals
  let currentDepository = '';
  let currentRegistered = 0;
  let currentEligible = 0;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const rawLabel = String(row[0] || '');
    const label = rawLabel.trim();
    const value = parseNumericValue(row[valueColIndex]);

    // Grand total rows
    if (label.toUpperCase() === 'TOTAL REGISTERED') {
      totalRegistered = value;
      continue;
    }
    if (label.toUpperCase() === 'TOTAL ELIGIBLE') {
      totalEligible = value;
      continue;
    }

    // Sub-rows for current depository (indented with spaces in original)
    if (rawLabel.startsWith('  ')) {
      const subLabel = label.toLowerCase();
      if (subLabel === 'registered') {
        currentRegistered = value;
      } else if (subLabel === 'eligible') {
        currentEligible = value;
      } else if (subLabel === 'total' && currentDepository) {
        // End of depository section, save it
        depositories.push({
          name: currentDepository,
          registered: currentRegistered,
          eligible: currentEligible,
        });
        currentDepository = '';
        currentRegistered = 0;
        currentEligible = 0;
      }
      continue;
    }

    // Depository name row (not indented, not a header/total)
    if (label && !label.includes('DEPOSITORY') && !label.includes('TOTAL') &&
        !label.includes('COMMODITY') && !label.includes('METAL') &&
        !label.includes('SILVER') && !label.includes('Troy')) {
      currentDepository = label;
    }
  }

  const totalOunces = totalRegistered + totalEligible;
  const registeredRatio = totalOunces > 0 ? totalRegistered / totalOunces : 0;

  return {
    reportDate,
    depositories,
    totalRegistered,
    totalEligible,
    totalOunces,
    registeredRatio,
  };
}

/** Find the column index for "TOTAL TODAY" values */
function findValueColumnIndex(rows: unknown[][]): number {
  for (const row of rows.slice(0, 15)) {
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toUpperCase();
      if (cell.includes('TOTAL TODAY')) {
        return j;
      }
    }
  }
  // Default to column 7 based on known file structure
  return 7;
}

/** Extract report date from header rows */
function findReportDate(row: unknown[]): Date | null {
  for (const cell of row) {
    const text = String(cell || '');
    const match = text.match(/Activity Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
    }
  }
  return null;
}

/** Parse a cell value as a number (handles commas, etc.) */
function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}
