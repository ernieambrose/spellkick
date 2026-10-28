import { seededRng } from '../../src/engine/rng';
import { containsBlocked } from '../../src/engine/safety';
import { makeScramble } from '../../src/engine/scramble';

describe('makeScramble', () => {
  const rng = seededRng(1);
  it('uses exactly the word letters', () =>
    expect([...makeScramble('separate', rng)!].sort().join('')).toBe('AAEEPRST'));
  it('never returns the word itself', () => {
    for (let i = 0; i < 500; i++) expect(makeScramble('tab', seededRng(i))).not.toBe('TAB');
  });
  it('returns null for unscramblable words', () => {
    expect(makeScramble('aa', rng)).toBeNull();
    expect(makeScramble('at', rng)).toBeNull();
  });
  it('strips punctuation and spaces', () =>
    expect([...makeScramble("don't", rng)!].sort().join('')).toBe('DNOT'));
  it('never returns a blocked arrangement for separate', () => {
    for (let i = 0; i < 2000; i++) {
      const s = makeScramble('separate', seededRng(i));
      expect(s && containsBlocked(s)).toBeFalsy();
    }
  });
  it('is deterministic for a seed', () =>
    expect(makeScramble('separate', seededRng(7))).toBe(makeScramble('separate', seededRng(7))));
});
