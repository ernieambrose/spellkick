const DAY_MS = 86_400_000;

/** "Test today" / "Test tomorrow" / "Test in N days" for YYYY-MM-DD dates. */
export function countdownText(testDate: string, today: string): string {
  const days = Math.round((Date.parse(`${testDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (days <= 0) return 'Test today';
  if (days === 1) return 'Test tomorrow';
  return `Test in ${days} days`;
}
