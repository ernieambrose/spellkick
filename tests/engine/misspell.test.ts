import { seededRng } from '../../src/engine/rng';
import { containsBlocked } from '../../src/engine/safety';
import { makeMisspelling } from '../../src/engine/misspell';

describe('makeMisspelling', () => {
  const dict = new Set(['form', 'from', 'receive', 'separate']);
  const opts = (seed: number) => ({ rng: seededRng(seed), isRealWord: (w: string) => dict.has(w) });

  it('changes the word', () => expect(makeMisspelling('receive', opts(1))).not.toBe('receive'));
  it('never produces a real word', () => {
    for (let i = 0; i < 300; i++) expect(makeMisspelling('form', opts(i))).not.toBe('from');
  });
  it('produces common error patterns', () => {
    const outs = new Set(Array.from({ length: 200 }, (_, i) => makeMisspelling('receive', opts(i))));
    expect(outs).toContain('recieve');
  });
  it('returns null for 2-letter words', () => expect(makeMisspelling('at', opts(1))).toBeNull());
  it('misspells 3-letter words', () => expect(makeMisspelling('sun', opts(1))).not.toBeNull());
  it('never changes the first letter', () => {
    for (let i = 0; i < 200; i++) expect(makeMisspelling('wrist', opts(i))?.[0]).toBe('w');
  });
  it('keeps a leading capital', () => expect(makeMisspelling('Wednesday', opts(3))![0]).toBe('W'));

  it('returns null for multi-word entries', () =>
    expect(makeMisspelling('ice cream', opts(1))).toBeNull());
  it('never alters punctuation in hyphenated or apostrophe words', () => {
    for (let i = 0; i < 100; i++) {
      const a = makeMisspelling("don't", opts(i));
      expect(a).not.toBeNull();
      expect(a!.replace(/\p{L}/gu, '')).toBe("'");
      expect(a).toMatch(/^\p{L}+'\p{L}+$/u);
      const b = makeMisspelling('well-known', opts(i));
      expect(b).not.toBeNull();
      expect(b).toMatch(/^\p{L}+-\p{L}+$/u);
    }
  });
  it('never returns a word in avoid', () => {
    const avoid = new Set(['recieve']);
    for (let i = 0; i < 200; i++)
      expect(makeMisspelling('receive', { ...opts(i), avoid })).not.toBe('recieve');
  });
  it('returns null when every candidate is a real word', () =>
    expect(makeMisspelling('sun', { rng: seededRng(1), isRealWord: () => true })).toBeNull());
  it('alters a blocked region instead of giving up', () => {
    for (const w of ['class', 'shell', 'title', 'Saturday']) {
      const m = makeMisspelling(w, opts(1));
      expect(m, w).not.toBeNull();
      expect(containsBlocked(m!), `${w} -> ${m}`).toBe(false);
    }
  });
  it('is deterministic for a seed', () =>
    expect(makeMisspelling('separate', opts(7))).toBe(makeMisspelling('separate', opts(7))));
});
