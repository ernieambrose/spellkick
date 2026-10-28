import { BLOCKED_TERMS, INAPPROPRIATE_WORDS } from './blocklist';
import { normalizeWord } from './words';

const INAPPROPRIATE_SET = new Set(INAPPROPRIATE_WORDS);

/** Substring check on generated output (scrambles, misspellings). */
export function containsBlocked(s: string): boolean {
  const letters = s.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKED_TERMS.some((t) => letters.includes(t));
}

/** Whole-word check for screening the built-in word pool. */
export function isInappropriateWord(w: string): boolean {
  return INAPPROPRIATE_SET.has(normalizeWord(w));
}
