import gradeWords from '../../src/data/gradeWords.json';
import { seededRng } from '../../src/engine/rng';
import { currentList, selectSessionWords, type SessionWord } from '../../src/engine/selection';
import type { AttemptKind, AttemptLike, WordList } from '../../src/engine/types';
import { normalizeWord } from '../../src/engine/words';

const grades = gradeWords as Record<string, string[]>;

const list = (id: string, words: string[], testDate: string | null, createdAt = '2026-10-01T00:00:00Z'): WordList => ({
  id,
  profileId: 'p1',
  name: id,
  testDate,
  source: 'school',
  author: null,
  words,
  createdAt,
});

const att = (word: string, kind: AttemptKind, day: string, time = '12:00:00Z'): AttemptLike => ({
  word,
  kind,
  localDate: day,
  createdAt: `${day}T${time}`,
});
const mastered = (word: string, start = 1): AttemptLike[] =>
  [0, 1, 2].map((i) => att(word, 'clean', `2026-10-${String(start + i).padStart(2, '0')}`));
const tricky = (word: string): AttemptLike[] => [att(word, 'miss', '2026-10-20')];

const count = (s: SessionWord[], role: SessionWord['role']) => s.filter((w) => w.role === role).length;

const TODAY = '2026-11-02';
const friWords = ['kumquat', 'papaya', 'guava', 'lychee', 'durian', 'quince', 'persimmon', 'tamarind', 'rambutan', 'jackfruit'];
const fri = list('fri', friWords, '2026-11-06');
const nextWeek = list('next', ['zebra', 'tiger'], '2026-11-13');
const past = list('past', ['river', 'ocean', 'lake', 'stream', 'pond'], '2026-10-23');
const undated = list('undated', ['cloud', 'storm'], null, '2026-10-25T00:00:00Z');

type Input = Parameters<typeof selectSessionWords>[0];
const select = (over: Partial<Input> = {}) =>
  selectSessionWords({
    lists: [fri, nextWeek, past],
    attempts: [],
    today: TODAY,
    generatedLevel: 3,
    rng: seededRng(7),
    ...over,
  });

describe('currentList', () => {
  it('picks the earliest upcoming test list', () =>
    expect(currentList([nextWeek, past, fri, undated], TODAY)!.id).toBe('fri'));
  it('counts a test today as upcoming', () =>
    expect(currentList([fri, nextWeek], '2026-11-06')!.id).toBe('fri'));
  it('falls back to the most recently created undated list', () => {
    const older = list('older', ['a'], null, '2026-09-01T00:00:00Z');
    expect(currentList([older, past, undated], TODAY)!.id).toBe('undated');
  });
  it('returns null when only past lists exist', () => expect(currentList([past], TODAY)).toBeNull());
});

describe('selectSessionWords', () => {
  it('returns 10 words by default and respects size', () => {
    expect(select()).toHaveLength(10);
    expect(select({ size: 6 })).toHaveLength(6);
  });

  it('fills 7 current + 3 review when available', () => {
    const s = select();
    expect(count(s, 'current')).toBe(7);
    expect(count(s, 'review')).toBe(3);
    for (const w of s.filter((x) => x.role === 'current')) expect(w.listId).toBe('fri');
    for (const w of s.filter((x) => x.role === 'review')) expect(['next', 'past']).toContain(w.listId);
  });

  it('puts tricky current words first', () => {
    const trickyWords = ['lychee', 'rambutan', 'jackfruit'];
    const attempts = [
      ...trickyWords.flatMap(tricky),
      ...['kumquat', 'papaya', 'guava', 'durian'].flatMap((w) => [att(w, 'clean', '2026-10-28')]),
    ];
    for (let seed = 0; seed < 10; seed++) {
      const current = select({ attempts, rng: seededRng(seed) })
        .filter((w) => w.role === 'current')
        .map((w) => w.word);
      expect(current).toEqual(expect.arrayContaining(trickyWords));
    }
  });

  it('prefers new over learning and learning over mastered current words', () => {
    const attempts = [
      ...['kumquat', 'papaya', 'guava'].flatMap((w) => mastered(w)),
      ...['lychee', 'durian'].map((w) => att(w, 'clean', '2026-10-28')),
    ];
    const current = select({ attempts }).filter((w) => w.role === 'current');
    expect(current.map((w) => w.word).sort()).toEqual(
      ['lychee', 'durian', 'quince', 'persimmon', 'tamarind', 'rambutan', 'jackfruit'].sort(),
    );
  });

  it('reports each word state from attempts, including generated words', () => {
    const gen = grades['3'][0];
    const attempts = [...tricky('Apple'), ...mastered(gen)];
    const s = select({ attempts, lists: [list('fri', ['Apple'], '2026-11-06')] });
    const apple = s.find((w) => normalizeWord(w.word) === 'apple')!;
    expect(apple).toMatchObject({ word: 'Apple', role: 'current', listId: 'fri', state: 'tricky' });
    for (const w of s.filter((x) => x.role === 'generated')) {
      expect(w.listId).toBeNull();
      expect(w.state).toBe('new'); // the mastered generated word is not preferred
    }
  });

  it('orders review: tricky first, then oldest last attempt', () => {
    const review = list('old', ['alpha', 'bravo', 'charlie', 'delta', 'echo'], '2026-10-16');
    const attempts = [
      ...tricky('echo'),
      att('alpha', 'clean', '2026-10-30'),
      att('bravo', 'clean', '2026-10-10'),
      att('charlie', 'clean', '2026-10-29'),
      att('delta', 'clean', '2026-10-12'),
    ];
    const s = select({ lists: [fri, review], attempts });
    expect(s.filter((w) => w.role === 'review').map((w) => w.word).sort()).toEqual(['bravo', 'delta', 'echo']);
  });

  it('treats never-attempted review words as oldest', () => {
    const review = list('old', ['alpha', 'bravo', 'charlie', 'delta'], '2026-10-16');
    const attempts = ['alpha', 'bravo', 'charlie'].map((w, i) => att(w, 'clean', `2026-10-1${i}`));
    const s = select({ lists: [fri, review], attempts });
    expect(s.filter((w) => w.role === 'review').map((w) => w.word).sort()).toEqual(['alpha', 'bravo', 'delta']);
  });

  it('fills from generated pool when there are no lists', () => {
    const s = select({ lists: [] });
    expect(s).toHaveLength(10);
    expect(s.every((w) => w.role === 'generated')).toBe(true);
    expect(s.every((w) => grades['3'].includes(w.word))).toBe(true);
  });

  it('fills from generated pool when the list has 2 words', () => {
    const s = select({ lists: [list('fri', ['Apple', 'pear'], '2026-11-06')] });
    expect(s).toHaveLength(10);
    expect(count(s, 'current')).toBe(2);
    expect(count(s, 'generated')).toBe(8);
  });

  it('caps review at 3 when there is no current list', () => {
    const s = select({ lists: [past] });
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(7);
  });

  it('caps review at 3 when the current list is short', () => {
    const s = select({ lists: [list('fri', ['kumquat', 'papaya'], '2026-11-06'), past] });
    expect(count(s, 'current')).toBe(2);
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(5);
  });

  it('sends leftover current slots to generated when ≥80% of the list is mastered', () => {
    const attempts = friWords.slice(0, 8).flatMap((w) => mastered(w));
    const s = select({ attempts });
    expect(count(s, 'current')).toBe(2); // only the 2 unmastered words
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(5);
  });

  it('falls back to mastered current words when generated words run out under the 80% rule', () => {
    const attempts = friWords.slice(0, 8).flatMap((w) => mastered(w));
    const s = select({ attempts, usable: (w) => friWords.includes(w) || ['zebra', 'tiger', 'river'].includes(w) });
    expect(s).toHaveLength(10);
    expect(count(s, 'current')).toBe(7);
    expect(count(s, 'review')).toBe(3);
  });

  it('prefers unmastered generated words', () => {
    const pool = grades['3'];
    const attempts = pool.slice(0, pool.length - 10).flatMap((w) => mastered(w));
    const s = select({ lists: [], attempts });
    expect(s.map((w) => w.word).sort()).toEqual(pool.slice(-10).sort());
  });

  it('uses adjacent levels when the level pool is short', () => {
    const level3 = new Set(grades['3']);
    const s = select({ lists: [], usable: (w) => !level3.has(w) });
    expect(s).toHaveLength(10);
    expect(s.every((w) => grades['2'].includes(w.word) || grades['4'].includes(w.word))).toBe(true);
  });

  it('never duplicates a word across roles', () => {
    const a = list('a', ['Apple', 'banana', 'cat', 'dog', grades['3'][0]], '2026-11-06');
    const b = list('b', ['apple', 'BANANA', 'cat ', 'dog', 'egg', grades['3'][1]], '2026-10-01');
    const c = list('c', ['egg', 'Cat', grades['3'][1]], null);
    const s = select({ lists: [a, b, c] });
    expect(s).toHaveLength(10);
    expect(new Set(s.map((w) => normalizeWord(w.word))).size).toBe(s.length);
  });

  it('respects usable and still returns 10', () => {
    const s = select({ usable: (w) => w.length > 4 });
    expect(s).toHaveLength(10);
    expect(s.every((w) => w.word.length > 4)).toBe(true);
  });

  it('extra mode returns only generated words', () => {
    const s = select({ mode: 'extra' });
    expect(s).toHaveLength(10);
    expect(s.every((w) => w.role === 'generated')).toBe(true);
  });

  it('is deterministic for a given rng seed and shuffles the final order', () => {
    expect(select({ rng: seededRng(3) })).toEqual(select({ rng: seededRng(3) }));
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => select({ rng: seededRng(seed) }).map((w) => w.role).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});
