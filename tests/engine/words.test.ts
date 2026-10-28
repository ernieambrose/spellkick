import { normalizeWord, parseWordList } from '../../src/engine/words';

describe('normalizeWord', () => {
  it('trims, lowercases, and collapses inner whitespace', () =>
    expect(normalizeWord('  Ice   CREAM ')).toBe('ice cream'));
});

describe('parseWordList', () => {
  it('splits on newlines, commas, tabs, and semicolons', () =>
    expect(parseWordList('cat, dog\tbird;fish\nant').words).toEqual(['cat', 'dog', 'bird', 'fish', 'ant']));
  it('strips numbering, bullets, and trailing punctuation', () =>
    expect(parseWordList('1. necessary\n2) rhythm.\n- separate\n• receive!').words)
      .toEqual(['necessary', 'rhythm', 'separate', 'receive']));
  it('keeps two-word, hyphenated, and apostrophe entries intact', () =>
    expect(parseWordList("ice cream\nwell-known\ndon't").words).toEqual(['ice cream', 'well-known', "don't"]));
  it('normalizes curly apostrophes', () =>
    expect(parseWordList('don’t').words).toEqual(["don't"]));
  it('dedupes case-insensitively, keeping first casing', () =>
    expect(parseWordList('Monday\nmonday\nMONDAY').words).toEqual(['Monday']));
  it('ignores blank lines', () => expect(parseWordList('\n\n cat \n\n').words).toEqual(['cat']));
  it('caps at 100 and reports truncation', () => {
    const letters = 'abcdefghij';
    const list = Array.from({ length: 105 }, (_, i) => `w${letters[Math.floor(i / 100)]}${letters[Math.floor(i / 10) % 10]}${letters[i % 10]}`);
    const r = parseWordList(list.join('\n'));
    expect(r.words).toHaveLength(100);
    expect(r.truncated).toBe(true);
  });
  it('does not report truncation at exactly the cap', () => {
    const list = Array.from({ length: 3 }, (_, i) => 'a'.repeat(i + 1));
    expect(parseWordList(list.join('\n'), 3).truncated).toBe(false);
  });
  it('drops entries with digits or no letters', () =>
    expect(parseWordList('cat\n123\n???').dropped).toEqual(['123', '???']));
  it('drops entries that mix digits into letters, keeping numbered ones', () => {
    const r = parseWordList('1. necessary\nword5');
    expect(r.words).toEqual(['necessary']);
    expect(r.dropped).toEqual(['word5']);
  });
});
