import gradeWords from '../../src/data/gradeWords.json';
import { seededRng } from '../../src/engine/rng';
import { currentList, hasUpcomingTest, selectSessionWords, type SessionWord } from '../../src/engine/selection';
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

// Same words as `fri`/`next`, but no upcoming test: exercises the 70/30 mix.
const friNT = list('fri', friWords, null, '2026-10-30T00:00:00Z');
const nextNT = list('next', ['zebra', 'tiger'], '2026-10-13');
const noTest = [friNT, nextNT, past];

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
  it('keeps the only past list current (was: null)', () => expect(currentList([past], TODAY)!.id).toBe('past'));
  it('returns null only when there are no lists', () => expect(currentList([], TODAY)).toBeNull());
  it('picks the later-dated of two past lists', () => {
    const earlier = list('earlier', ['a'], '2026-10-01', '2026-09-30T00:00:00Z');
    expect(currentList([earlier, past], TODAY)!.id).toBe('past');
    expect(currentList([past, earlier], TODAY)!.id).toBe('past');
  });
  it('prefers a more recently created undated list over a past dated one', () => {
    expect(currentList([past, undated], TODAY)!.id).toBe('undated');
  });
  it('prefers a past dated list created after an undated one', () => {
    const newPast = list('newPast', ['a'], '2026-10-30', '2026-10-31T00:00:00Z');
    expect(currentList([undated, newPast], TODAY)!.id).toBe('newPast');
  });
  it('hasUpcomingTest is true only for testDate >= today', () => {
    expect(hasUpcomingTest(fri, TODAY)).toBe(true);
    expect(hasUpcomingTest(list('t', ['a'], TODAY), TODAY)).toBe(true);
    expect(hasUpcomingTest(past, TODAY)).toBe(false);
    expect(hasUpcomingTest(undated, TODAY)).toBe(false);
    expect(hasUpcomingTest(null, TODAY)).toBe(false);
  });
});

describe('selectSessionWords', () => {
  it('returns 10 words by default and respects size', () => {
    expect(select()).toHaveLength(10);
    expect(select({ size: 6 })).toHaveLength(6);
  });

  it('fills all 10 from the current list when its test is upcoming', () => {
    const s = select();
    expect(count(s, 'current')).toBe(10);
    for (const w of s.filter((x) => x.role === 'current')) expect(w.listId).toBe('fri');
  });

  it('fills 7 current + 3 review when there is no upcoming test', () => {
    const cur = list('cur', friWords, null, '2026-10-30T00:00:00Z');
    const s = select({ lists: [cur, past] });
    expect(count(s, 'current')).toBe(7);
    expect(count(s, 'review')).toBe(3);
    for (const w of s.filter((x) => x.role === 'review')) expect(w.listId).toBe('past');
  });

  it('uses only list words for a 23-word list with an upcoming test and no other lists', () => {
    const words = Array.from({ length: 23 }, (_, i) => `listword${i}`);
    const s = select({ lists: [list('big', words, '2026-11-06')] });
    expect(count(s, 'current')).toBe(10);
    expect(count(s, 'generated')).toBe(0);
  });

  it('takes 6 current, then review, then generated for a short upcoming list', () => {
    const six = list('six', ['aa1', 'bb2', 'cc3', 'dd4', 'ee5', 'ff6'], '2026-11-06');
    const older = list('old', ['alpha', 'bravo'], '2026-10-01');
    const s = select({ lists: [six, older] });
    expect(count(s, 'current')).toBe(6);
    expect(count(s, 'review')).toBe(2);
    expect(count(s, 'generated')).toBe(2);
  });

  it('still uses 10 list words when all are mastered and the test is upcoming', () => {
    const attempts = friWords.flatMap((w) => mastered(w));
    const s = select({ lists: [fri], attempts });
    expect(count(s, 'current')).toBe(10);
    expect(count(s, 'generated')).toBe(0);
  });

  it('uses the no-test mix for a list dated yesterday with no other lists', () => {
    const words = Array.from({ length: 23 }, (_, i) => `listword${i}`);
    const yesterday = list('y', words, '2026-11-01');
    expect(currentList([yesterday], TODAY)!.id).toBe('y');
    const s = select({ lists: [yesterday] });
    expect(count(s, 'current')).toBe(7);
    expect(count(s, 'generated')).toBe(3);
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
    const current = select({ lists: noTest, attempts }).filter((w) => w.role === 'current');
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
    const s = select({ lists: [friNT, review], attempts });
    expect(s.filter((w) => w.role === 'review').map((w) => w.word).sort()).toEqual(['bravo', 'delta', 'echo']);
  });

  it('treats never-attempted review words as oldest', () => {
    const review = list('old', ['alpha', 'bravo', 'charlie', 'delta'], '2026-10-16');
    const attempts = ['alpha', 'bravo', 'charlie'].map((w, i) => att(w, 'clean', `2026-10-1${i}`));
    const s = select({ lists: [friNT, review], attempts });
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

  it('caps review at 3 when the current list has no upcoming test', () => {
    const older = list('older', ['alpha', 'bravo', 'charlie', 'delta', 'echo'], '2026-10-01');
    const s = select({ lists: [past, older] });
    expect(count(s, 'current')).toBe(5);
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(2);
  });

  it('caps review at 3 when the current list is short', () => {
    const s = select({ lists: [list('fri', ['kumquat', 'papaya'], null, '2026-10-30T00:00:00Z'), past] });
    expect(count(s, 'current')).toBe(2);
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(5);
  });

  it('sends leftover current slots to generated when ≥80% of the list is mastered', () => {
    const attempts = friWords.slice(0, 8).flatMap((w) => mastered(w));
    const s = select({ lists: noTest, attempts });
    expect(count(s, 'current')).toBe(2); // only the 2 unmastered words
    expect(count(s, 'review')).toBe(3);
    expect(count(s, 'generated')).toBe(5);
  });

  it('falls back to mastered current words when generated words run out under the 80% rule', () => {
    const attempts = friWords.slice(0, 8).flatMap((w) => mastered(w));
    const s = select({ lists: noTest, attempts, usable: (w) => friWords.includes(w) || ['zebra', 'tiger', 'river'].includes(w) });
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
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => select({ lists: noTest, rng: seededRng(seed) }).map((w) => w.role).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});
