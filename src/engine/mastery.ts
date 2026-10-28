import type { AttemptLike, WordState } from './types';
import { normalizeWord } from './words';

const byTime = (x: AttemptLike, y: AttemptLike) => Date.parse(x.createdAt) - Date.parse(y.createdAt);

export function deriveWordState(attempts: AttemptLike[]): WordState {
  const real = attempts.filter((x) => x.kind !== 'practice').sort(byTime);
  if (real.length === 0) return 'new';

  const lastMiss = real.findLastIndex((x) => x.kind === 'miss');
  const afterMiss = real.slice(lastMiss + 1);

  const clean = new Set<string>();
  const hinted = new Set<string>();
  for (const x of afterMiss) {
    if (x.kind === 'clean') clean.add(x.localDate);
    else if (x.kind === 'hinted') hinted.add(x.localDate);
  }
  let counting = 0;
  for (const day of clean) if (!hinted.has(day)) counting++;
  if (counting >= 3) return 'mastered';

  if (real.slice(-3).some((x) => x.kind === 'miss' || x.kind === 'hinted')) return 'tricky';
  return 'learning';
}

export function summarize(attempts: AttemptLike[]): Map<string, WordState> {
  const groups = new Map<string, AttemptLike[]>();
  for (const x of attempts) {
    const key = normalizeWord(x.word);
    const g = groups.get(key);
    if (g) g.push(x);
    else groups.set(key, [x]);
  }
  const out = new Map<string, WordState>();
  for (const [word, list] of groups) out.set(word, deriveWordState(list));
  return out;
}
