export interface ParsedWordList {
  words: string[];
  truncated: boolean;
  dropped: string[];
}

export function normalizeWord(w: string): string {
  return w.trim().toLowerCase().replace(/\s+/g, ' ');
}

const SPLIT = /[\n,\t;]/;
const LEADING_MARK = /^(?:\d+\s*[.)]|[-•*])\s*/;
const TRAILING_PUNCT = /[.!?:]+$/;
const VALID = /^[\p{L} '-]+$/u;

export function parseWordList(text: string, max = 100): ParsedWordList {
  const words: string[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const piece of text.split(SPLIT)) {
    const stripped = piece.trim().replace(LEADING_MARK, '').replace(/’/g, "'").trim();
    if (!stripped) continue;
    const word = stripped.replace(TRAILING_PUNCT, '').trim().replace(/\s+/g, ' ');
    if (!VALID.test(word) || !/\p{L}/u.test(word)) {
      dropped.push(stripped);
      continue;
    }
    const key = normalizeWord(word);
    if (seen.has(key)) continue;
    if (words.length >= max) {
      truncated = true;
      continue;
    }
    seen.add(key);
    words.push(word);
  }
  return { words, truncated, dropped };
}
