import gradeWordsJson from '../data/gradeWords.json';
import { clampLevel, MAX_LEVEL, MIN_LEVEL } from './difficulty';
import { summarize } from './mastery';
import { shuffle, type Rng } from './rng';
import type { AttemptLike, WordList, WordState } from './types';
import { normalizeWord } from './words';

const GRADE_WORDS = gradeWordsJson as Record<string, string[]>;

export interface SessionWord {
  word: string; // display casing
  role: 'current' | 'review' | 'generated';
  listId: string | null;
  state: WordState;
}

export interface SelectInput {
  lists: WordList[];
  attempts: AttemptLike[];
  today: string;
  generatedLevel: number;
  size?: number;
  mode?: 'normal' | 'extra';
  usable?: (word: string) => boolean;
  rng: Rng;
}

const CURRENT_SHARE = 0.7;
const MASTERED_SHARE = 0.8;

/** Earliest list with testDate >= today; else the newest undated list; else null. */
export function currentList(lists: WordList[], today: string): WordList | null {
  const byNewest = (x: WordList, y: WordList) => Date.parse(y.createdAt) - Date.parse(x.createdAt);
  const upcoming = lists
    .filter((l) => l.testDate !== null && l.testDate >= today)
    .sort((x, y) => x.testDate!.localeCompare(y.testDate!) || byNewest(x, y));
  if (upcoming.length > 0) return upcoming[0];
  return lists.filter((l) => l.testDate === null).sort(byNewest)[0] ?? null;
}

interface Candidate {
  word: string;
  listId: string | null;
  state: WordState;
}

export function selectSessionWords(input: SelectInput): SessionWord[] {
  const { lists, attempts, today, rng } = input;
  const size = input.size ?? 10;
  const usable = input.usable ?? (() => true);
  const states = summarize(attempts);
  const stateOf = (w: string): WordState => states.get(normalizeWord(w)) ?? 'new';

  const lastAttempt = new Map<string, number>();
  for (const x of attempts) {
    const key = normalizeWord(x.word);
    lastAttempt.set(key, Math.max(lastAttempt.get(key) ?? -Infinity, Date.parse(x.createdAt)));
  }

  const picked: SessionWord[] = [];
  const seen = new Set<string>();
  const take = (c: Candidate, role: SessionWord['role'], limit: number) => {
    const key = normalizeWord(c.word);
    if (picked.length >= limit || seen.has(key) || !usable(c.word)) return;
    seen.add(key);
    picked.push({ ...c, role });
  };
  const fromList = (l: WordList): Candidate[] =>
    l.words.map((word) => ({ word, listId: l.id, state: stateOf(word) }));

  let masteredCurrent: Candidate[] = [];
  if (input.mode !== 'extra') {
    // 1. Current list, by tier.
    const cur = currentList(lists, today);
    const currentSlots = Math.round(size * CURRENT_SHARE);
    let reviewLimit = size;
    if (cur) {
      const words = shuffle(fromList(cur), rng);
      const unique = new Set(words.map((c) => normalizeWord(c.word))).size;
      const masteredCount = new Set(
        words.filter((c) => c.state === 'mastered').map((c) => normalizeWord(c.word)),
      ).size;
      const mostlyMastered = unique > 0 && masteredCount / unique >= MASTERED_SHARE;
      const tiers: WordState[] = mostlyMastered
        ? ['tricky', 'new', 'learning']
        : ['tricky', 'new', 'learning', 'mastered'];
      for (const tier of tiers) for (const c of words) if (c.state === tier) take(c, 'current', currentSlots);
      if (mostlyMastered) {
        // Leftover current slots are reserved for generated words.
        reviewLimit = size - (currentSlots - picked.length);
        masteredCurrent = words.filter((c) => c.state === 'mastered');
      }
    }

    // 2. Review: tricky first, then oldest last attempt; shuffle gives the random tiebreak.
    const others = shuffle(
      lists.filter((l) => l !== cur).flatMap(fromList),
      rng,
    );
    const last = (c: Candidate) => lastAttempt.get(normalizeWord(c.word)) ?? -Infinity;
    const rank = (c: Candidate) => (c.state === 'tricky' ? 0 : 1);
    others.sort((x, y) => rank(x) - rank(y) || last(x) - last(y));
    for (const c of others) take(c, 'review', reviewLimit);
  }

  // 3. Generated pool: chosen level, then adjacent levels outward; unmastered first within a level.
  const level = clampLevel(input.generatedLevel);
  for (let d = 0; picked.length < size && d <= MAX_LEVEL - MIN_LEVEL; d++) {
    for (const lv of d === 0 ? [level] : [level - d, level + d]) {
      if (lv < MIN_LEVEL || lv > MAX_LEVEL) continue;
      const pool = shuffle(GRADE_WORDS[String(lv)] ?? [], rng).map((word) => ({
        word,
        listId: null,
        state: stateOf(word),
      }));
      for (const c of pool) if (c.state !== 'mastered') take(c, 'generated', size);
      for (const c of pool) if (c.state === 'mastered') take(c, 'generated', size);
    }
  }

  // Under the 80% rule, mastered current words are the last resort before leaving slots empty.
  for (const c of masteredCurrent) take(c, 'current', size);

  return shuffle(picked, rng);
}
