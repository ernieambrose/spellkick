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

/** True when the list has a test dated today or later. */
export function hasUpcomingTest(list: WordList | null, today: string): boolean {
  return list !== null && list.testDate !== null && list.testDate >= today;
}

/**
 * Earliest list with testDate >= today; else the most recent list overall (latest testDate,
 * undated lists by createdAt; a dated past list vs an undated one goes to the newer-created).
 * Null only when there are no lists.
 */
export function currentList(lists: WordList[], today: string): WordList | null {
  const created = (l: WordList) => Date.parse(l.createdAt);
  const byNewest = (x: WordList, y: WordList) => created(y) - created(x);
  const upcoming = lists
    .filter((l) => hasUpcomingTest(l, today))
    .sort((x, y) => x.testDate!.localeCompare(y.testDate!) || byNewest(x, y));
  if (upcoming.length > 0) return upcoming[0];
  const recent = (x: WordList, y: WordList) =>
    x.testDate !== null && y.testDate !== null
      ? y.testDate.localeCompare(x.testDate) || byNewest(x, y)
      : byNewest(x, y);
  // Not a total order across dated/undated mixes, so pick by a linear scan.
  let best: WordList | null = null;
  for (const l of lists) if (best === null || recent(l, best) < 0) best = l;
  return best;
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
    const testUpcoming = hasUpcomingTest(cur, today);
    // With a test coming up, the kid's list comes first and fills every slot (mastered included).
    const currentSlots = testUpcoming ? size : Math.round(size * CURRENT_SHARE);
    if (cur) {
      const words = shuffle(fromList(cur), rng);
      const unique = new Set(words.map((c) => normalizeWord(c.word))).size;
      const masteredCount = new Set(
        words.filter((c) => c.state === 'mastered').map((c) => normalizeWord(c.word)),
      ).size;
      const mostlyMastered = !testUpcoming && unique > 0 && masteredCount / unique >= MASTERED_SHARE;
      const tiers: WordState[] = mostlyMastered
        ? ['tricky', 'new', 'learning']
        : ['tricky', 'new', 'learning', 'mastered'];
      for (const tier of tiers) for (const c of words) if (c.state === tier) take(c, 'current', currentSlots);
      if (mostlyMastered) masteredCurrent = words.filter((c) => c.state === 'mastered');
    }

    // Review never takes more than its own share; unfilled current slots go to generated words.
    const reviewLimit = testUpcoming ? size : picked.length + (size - currentSlots);

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
