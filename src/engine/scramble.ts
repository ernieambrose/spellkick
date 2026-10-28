import { shuffle, type Rng } from './rng';
import { containsBlocked } from './safety';

/**
 * Scramble a word's letters into uppercase tiles. Returns null when the word
 * has fewer than 3 letters, all-identical letters, or no safe arrangement is
 * found within maxTries.
 */
export function makeScramble(word: string, rng: Rng, maxTries = 50): string | null {
  const letters = [...word.toUpperCase().replace(/[\s'’-]/g, '')];
  if (letters.length < 3 || letters.every((l) => l === letters[0])) return null;
  const original = letters.join('');
  for (let i = 0; i < maxTries; i++) {
    const candidate = shuffle(letters, rng).join('');
    if (candidate !== original && !containsBlocked(candidate)) return candidate;
  }
  return null;
}
