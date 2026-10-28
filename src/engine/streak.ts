/** YYYY-MM-DD for `d` in `timeZone` (defaults to the device zone). */
export function localDate(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
