import { BLOCKED_TERMS, INAPPROPRIATE_WORDS } from '../../src/engine/blocklist';
import { containsBlocked, isInappropriateWord } from '../../src/engine/safety';

describe('containsBlocked', () => {
  it('catches the mockup case', () => expect(containsBlocked('RAPESTAE')).toBe(true));
  it('matches inside a longer string, any case', () => expect(containsBlocked('xxSeXyy')).toBe(true));
  it('ignores separators', () => expect(containsBlocked('s-e x')).toBe(true));
  it('passes clean strings', () => expect(containsBlocked('rhythm')).toBe(false));
});

describe('lists', () => {
  it('every blocked term is lowercase letters only', () =>
    BLOCKED_TERMS.forEach((t) => expect(t).toMatch(/^[a-z]+$/)));
  it('every inappropriate word is lowercase letters only', () =>
    INAPPROPRIATE_WORDS.forEach((t) => expect(t).toMatch(/^[a-z]+$/)));
  it('both lists are alphabetized without duplicates', () => {
    for (const list of [BLOCKED_TERMS, INAPPROPRIATE_WORDS]) {
      expect([...list]).toEqual([...new Set(list)].sort());
    }
  });
});

describe('isInappropriateWord', () => {
  it('flags whole words, any case and padding', () => {
    expect(isInappropriateWord('  Naked ')).toBe(true);
    expect(isInappropriateWord('kill')).toBe(true);
  });
  it('does not flag words containing a term', () => {
    expect(isInappropriateWord('class')).toBe(false);
    expect(isInappropriateWord('grape')).toBe(false);
    expect(isInappropriateWord('title')).toBe(false);
    expect(isInappropriateWord('speech')).toBe(false);
  });
});
