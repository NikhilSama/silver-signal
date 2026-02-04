/** Convert UTC date to Eastern Time string */
export function toEasternTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET';
}

/** Get current date in Eastern Time */
export function getCurrentET(): Date {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

/** Check if current time is within market hours (roughly 8 AM - 6 PM ET) */
export function isMarketHours(): boolean {
  const et = getCurrentET();
  const hour = et.getHours();
  return hour >= 8 && hour < 18;
}
