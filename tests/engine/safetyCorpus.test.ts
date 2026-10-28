import { seededRng } from '../../src/engine/rng';
import { makeMisspelling } from '../../src/engine/misspell';
import { containsBlocked } from '../../src/engine/safety';
import { makeScramble } from '../../src/engine/scramble';
import { SPELLING_WORDS } from '../fixtures/spellingWords';
import dictionaryText from '../../public/dictionary.txt?raw';

const DICT = new Set(dictionaryText.split('\n').filter(Boolean));
const isRealWord = (w: string) => DICT.has(w);

describe('safety corpus', () => {
  it('has a corpus of roughly 200 words', () =>
    expect(SPELLING_WORDS.length).toBeGreaterThanOrEqual(190));
  it('no scramble of any corpus word contains a blocked term', () => {
    for (const w of SPELLING_WORDS) {
      for (let seed = 0; seed < 50; seed++) {
        const s = makeScramble(w, seededRng(seed));
        expect(s, `${w} seed ${seed}`).not.toBeNull();
        expect(containsBlocked(s!), `${w} -> ${s}`).toBe(false);
      }
    }
  });
  it('no misspelling of any corpus word is blocked or a real word', () => {
    for (const w of SPELLING_WORDS) {
      for (let seed = 0; seed < 50; seed++) {
        const m = makeMisspelling(w, { rng: seededRng(seed), isRealWord });
        if (m === null) continue;
        expect(containsBlocked(m), `${w} -> ${m}`).toBe(false);
        expect(isRealWord(m.toLowerCase()), `${w} -> ${m}`).toBe(false);
      }
    }
  });
  it('misspells at least 95% of single-word corpus entries within 10 seeds', () => {
    const eligible = SPELLING_WORDS.filter(
      (w) => !/\s/.test(w) && (w.match(/\p{L}/gu) ?? []).length >= 3,
    );
    const starved = eligible.filter((w) => {
      for (let seed = 0; seed < 10; seed++) {
        if (makeMisspelling(w, { rng: seededRng(seed), isRealWord }) !== null)
          return false;
      }
      return true;
    });
    expect(starved.length / eligible.length, starved.join(', ')).toBeLessThanOrEqual(0.05);
  });
});
