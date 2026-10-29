import type { AttemptLike } from './types';

const WINDOW = 20;
const MIN_ATTEMPTS = 10;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 8;

export const clampLevel = (level: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));

/** Callers pass generated-pool attempts only (listId === null). */
export function adaptGeneratedLevel(level: number, recentGenerated: AttemptLike[]): number {
  const recent = recentGenerated
    .filter((x) => x.kind !== 'practice')
    .sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt))
    .slice(-WINDOW);
  if (recent.length < MIN_ATTEMPTS) return clampLevel(level);
  const accuracy = recent.filter((x) => x.kind === 'clean').length / recent.length;
  if (accuracy >= 0.9) return clampLevel(level + 1);
  if (accuracy <= 0.6) return clampLevel(level - 1);
  return clampLevel(level);
}
