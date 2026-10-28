// Builds public/dictionary.txt from wordlist-english (run: npm run build:dict).
import { writeFileSync } from 'node:fs';
import wordlist from 'wordlist-english';

const FREQUENCIES = [10, 20, 35, 40, 50, 55, 60, 70];
const DIALECTS = ['english', 'english/american'];
const MAX_BYTES = 2 * 1024 * 1024;

const words = new Set<string>();
for (const dialect of DIALECTS) {
  for (const f of FREQUENCIES) {
    const list = wordlist[`${dialect}/${f}`];
    if (!list) throw new Error(`wordlist-english has no key ${dialect}/${f}`);
    for (const w of list) words.add(w.toLowerCase());
  }
}

const text = [...words].sort().join('\n') + '\n';
const bytes = Buffer.byteLength(text);
if (bytes >= MAX_BYTES) throw new Error(`dictionary is ${bytes} bytes, over 2 MB`);
writeFileSync(new URL('../public/dictionary.txt', import.meta.url), text);
console.log(`wrote ${words.size} words (${bytes} bytes) to public/dictionary.txt`);
