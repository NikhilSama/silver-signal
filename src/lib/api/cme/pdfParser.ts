import type { DeliveryData, ClearingMemberDelivery } from './types';
import { getFrontMonthCode } from './types';

/** Parse the delivery PDF buffer and extract silver delivery data */
export async function parseDeliveryPDF(buffer: ArrayBuffer): Promise<DeliveryData> {
  const { PDFParse } = await import('pdf-parse');
  const uint8Array = new Uint8Array(buffer);
  const parser = new PDFParse(uint8Array);

  // In pdf-parse v2.x, load() is called internally by getText()
  const textResult = await parser.getText();
  await parser.destroy();

  return extractSilverData(textResult.text);
}

/** Extract silver delivery data from PDF text */
function extractSilverData(text: string): DeliveryData {
  const result = createDefaultData();

  // Extract report date from "BUSINESS DATE: MM/DD/YYYY"
  const dateMatch = text.match(/BUSINESS DATE:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    result.reportDate = parseDate(dateMatch[1]);
  }

  // Find silver section - look for "SILVER FUTURES" contract
  const silverMatch = text.match(
    /CONTRACT:.*?SILVER FUTURES[\s\S]*?TOTAL:\s*(\d+)\s+(\d+)[\s\S]*?MONTH TO DATE:\s*([\d,]+)/i
  );

  if (silverMatch) {
    result.issues = parseInt(silverMatch[1], 10);
    result.stops = parseInt(silverMatch[2], 10);
    const mtd = parseInt(silverMatch[3].replace(/,/g, ''), 10);
    result.cumulativeIssues = mtd;
    result.cumulativeStops = mtd;
    result.topIssuers = extractClearingMembers(text, 'issued');
    result.topStoppers = extractClearingMembers(text, 'stopped');
  }

  // Extract contract month from "CONTRACT: FEBRUARY 2026 COMEX 5000 SILVER FUTURES"
  const contractMatch = text.match(/CONTRACT:\s*(\w+)\s+(\d{4}).*?SILVER FUTURES/i);
  if (contractMatch) {
    const monthAbbr = contractMatch[1].substring(0, 3).toUpperCase();
    const yearShort = contractMatch[2].substring(2);
    result.contractMonth = `${monthAbbr} ${yearShort}`;
  }

  return result;
}

/** Create default delivery data structure */
function createDefaultData(): DeliveryData {
  return {
    reportDate: new Date(),
    contractMonth: getFrontMonthCode(),
    issues: 0,
    stops: 0,
    cumulativeIssues: 0,
    cumulativeStops: 0,
    isDeliveryMonth: true,
    topIssuers: [],
    topStoppers: [],
  };
}

/** Parse MM/DD/YYYY date format */
function parseDate(dateStr: string): Date {
  const [month, day, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/** Extract clearing member deliveries from PDF text */
function extractClearingMembers(
  text: string,
  type: 'issued' | 'stopped'
): ClearingMemberDelivery[] {
  const members: ClearingMemberDelivery[] = [];
  const silverSection = extractSilverSection(text);
  if (!silverSection) return members;

  // Parse each firm line (format: "FIRM ORG FIRM_NAME ISSUED STOPPED")
  const lines = silverSection.split('\n');
  for (const line of lines) {
    const match = line.match(/^\d{3}\s+[CH]\s+(.+?)\s+(\d+)?\s*(\d+)?$/);
    if (match) {
      const name = match[1].trim();
      const issued = parseInt(match[2] || '0', 10);
      const stopped = parseInt(match[3] || '0', 10);

      if (type === 'issued' && issued > 0) {
        members.push({ name, contracts: issued, percentage: 0 });
      } else if (type === 'stopped' && stopped > 0) {
        members.push({ name, contracts: stopped, percentage: 0 });
      }
    }
  }

  // Calculate percentages and return top 5
  const total = members.reduce((sum, m) => sum + m.contracts, 0);
  for (const member of members) {
    member.percentage = total > 0 ? (member.contracts / total) * 100 : 0;
  }

  return members.sort((a, b) => b.contracts - a.contracts).slice(0, 5);
}

/** Extract just the silver section from the full PDF text */
function extractSilverSection(text: string): string | null {
  const start = text.indexOf('SILVER FUTURES');
  if (start === -1) return null;

  // Find the end (next contract or end of report)
  const endMarkers = ['<<< End of Report >>>', 'EXCHANGE:', 'CONTRACT:'];
  let end = text.length;

  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + 20);
    if (idx !== -1 && idx < end) {
      end = idx;
    }
  }

  return text.substring(start, end);
}
