export const APP_TIME_ZONE = 'Asia/Bangkok';

/** Format a date for display in Thai locale using the Asia/Bangkok time zone. */
export function formatThaiDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
