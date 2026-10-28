import { seededRng } from '../../src/engine/rng';
import { containsBlocked } from '../../src/engine/safety';
import { makeScramble } from '../../src/engine/scramble';
import { SPELLING_WORDS } from '../fixtures/spellingWords';

describe('safety corpus', () => {
  it('has a corpus of roughly 200 words', () =>
    expect(SPELLING_WORDS.length).toBeGreaterThanOrEqual(190));
  it('no scramble of any corpus word contains a blocked term', () => {
    for (const w of SPELLING_WORDS) {
      for (let seed = 0; seed < 50; seed++) {
        const s = makeScramble(w, seededRng(seed));
        if (s !== null) expect(containsBlocked(s), `${w} -> ${s}`).toBe(false);
      }
    }
  });
});
