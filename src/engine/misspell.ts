import { shuffle, type Rng } from './rng';
import { containsBlocked } from './safety';
import { normalizeWord } from './words';

export interface MisspellOptions {
  rng: Rng;
  /** Receives a lowercase candidate. */
  isRealWord: (w: string) => boolean;
  /** Lowercase words to steer clear of (the kid's other words). */
  avoid?: Set<string>;
}

type Rule = (w: string) => string[];

const CONSONANT = /[bcdfghjklmnpqrstvwxyz]/;
const DOUBLABLE = /[bcdfglmnprstz]/;
const LETTER = /\p{L}/u;
const SHORT = 4;

const at = (w: string, i: number, len: number, rep: string) => w.slice(0, i) + rep + w.slice(i + len);

/** Every index >= 1 where `re` matches (the first letter is never touched). */
function matches(w: string, re: RegExp): number[] {
  const out: number[] = [];
  for (const m of w.matchAll(new RegExp(re.source, 'g'))) if (m.index >= 1) out.push(m.index);
  return out;
}

const swapAdjacent: Rule = (w) => {
  const out: string[] = [];
  for (let i = 1; i + 2 < w.length; i++) {
    const [a, b] = [w[i], w[i + 1]];
    if (a !== b && LETTER.test(a) && LETTER.test(b)) out.push(at(w, i, 2, b + a));
  }
  return out;
};

const ieEi: Rule = (w) => [
  ...matches(w, /ie/).map((i) => at(w, i, 2, 'ei')),
  ...matches(w, /ei/).map((i) => at(w, i, 2, 'ie')),
];

const doubling: Rule = (w) => {
  const out: string[] = [];
  for (let i = 1; i < w.length; i++) {
    const c = w[i];
    if (w[i + 1] === c && CONSONANT.test(c)) out.push(at(w, i, 1, ''));
    else if (w[i - 1] !== c && w[i + 1] !== c && DOUBLABLE.test(c)) out.push(at(w, i, 1, c + c));
  }
  return out;
};

const dropSilent: Rule = (w) => {
  const idx = [
    ...matches(w, /(?<=[bcdfgklmnprstvz])e$/), // final silent e
    ...matches(w, /(?<=[cgprtw])h/), // ch, gh, ph, rh, th, wh
    ...matches(w, /k(?=n)/),
    ...matches(w, /(?<=s)w|w(?=r)/),
    ...matches(w, /(?<=m)b|b(?=t)/),
  ];
  return w.length > 3 ? idx.map((i) => at(w, i, 1, '')) : [];
};

const VOWEL_SWAP: Record<string, string[]> = { a: ['e'], e: ['a', 'i'], i: ['e'] };
/** Vowel swaps, skipping the first vowel (usually the stressed one in kids' words). */
const vowelSwap: Rule = (w) => {
  const vowels = matches(w, /[aeiou]/);
  const first = w.search(/[aeiouy]/);
  return vowels
    .filter((i) => i !== first)
    .flatMap((i) => (VOWEL_SWAP[w[i]] ?? []).map((v) => at(w, i, 1, v)));
};

const SUFFIXES: [string, string][] = [
  ['able', 'ible'],
  ['ance', 'ence'],
  ['ant', 'ent'],
  ['tion', 'sion'],
];
const suffixSwap: Rule = (w) =>
  SUFFIXES.flatMap(([a, b]) => {
    const out: string[] = [];
    if (w.endsWith(a) && w.length > a.length + 1) out.push(w.slice(0, -a.length) + b);
    if (w.endsWith(b) && w.length > b.length + 1) out.push(w.slice(0, -b.length) + a);
    return out;
  });

const cs: Rule = (w) => [
  ...matches(w, /c(?=[eiy])/).map((i) => at(w, i, 1, 's')),
  ...matches(w, /s(?=[ei])/).map((i) => at(w, i, 1, 'c')),
];

const phF: Rule = (w) => [
  ...matches(w, /ph/).map((i) => at(w, i, 2, 'f')),
  ...matches(w, /f/).map((i) => at(w, i, 1, 'ph')),
];

const shortWord: Rule = (w) => {
  const last = w[w.length - 1];
  if (w.length > SHORT || !CONSONANT.test(last)) return [];
  const out = [w + 'e'];
  if (w[w.length - 2] !== last) out.push(w + last);
  return out;
};

const RULES: Rule[] = [swapAdjacent, ieEi, doubling, dropSilent, vowelSwap, suffixSwap, cs, phF, shortWord];

/**
 * Produce a plausible misspelling: rules are tried in random order, the first
 * letter (and its casing) is kept, punctuation is never changed. Candidates
 * that are unchanged, blocked, or in `avoid` are skipped for free; up to
 * maxTries of the rest are checked against the dictionary. Returns null for
 * fewer than 3 letters, multi-word entries, or when nothing qualifies.
 */
export function makeMisspelling(word: string, opts: MisspellOptions, maxTries = 30): string | null {
  const w = normalizeWord(word);
  if (w.includes(' ') || (w.match(/\p{L}/gu) ?? []).length < 3) return null;
  const first = word.trim()[0];

  let tries = 0;
  for (const rule of shuffle(RULES, opts.rng)) {
    for (const c of shuffle(rule(w), opts.rng)) {
      if (c === w || containsBlocked(c) || opts.avoid?.has(c)) continue;
      if (tries++ >= maxTries) return null;
      if (!opts.isRealWord(c)) return first + c.slice(1);
    }
  }
  return null;
}
