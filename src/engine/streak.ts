/** YYYY-MM-DD for `d` in `timeZone` (defaults to the device zone). */
export function localDate(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

/**
 * Consecutive-day streaks over YYYY-MM-DD strings (pure UTC date math).
 * `current` is the run ending today or yesterday (else 0); `best` is the longest run ever.
 */
export function computeStreak(
  sessionDates: string[],
  today: string,
): { current: number; best: number } {
  const days = [...new Set(sessionDates)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = NaN;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  // `run` is now the run ending at the latest date.
  const t = dayNumber(today);
  const current = days.length > 0 && (prev === t || prev === t - 1) ? run : 0;
  return { current, best };
}
