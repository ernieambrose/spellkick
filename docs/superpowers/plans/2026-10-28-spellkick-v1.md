# SpellKick v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family-only, installable spelling practice web app with kid profiles, per-test word lists, two games (Scramble, Spot the Misspelling), mastery tracking, streaks, and badges, synced across devices.

**Architecture:** All learning rules live in pure, fully unit-tested TypeScript modules under `src/engine/` (no React, no network). A thin data layer (`src/data/`) exposes one `Repo` interface with an in-memory implementation (tests) and a Supabase implementation (app). Attempts and sessions are append-only records with client-generated UUIDs; word states are *derived* from attempts, so syncing two devices never conflicts. React screens under `src/screens/` only call engine functions and the repo.

**Tech Stack:** Vite + React 18 + TypeScript (strict), React Router (BrowserRouter, with a `vercel.json` SPA rewrite), Tailwind CSS, Vitest + Testing Library, `vite-plugin-pwa`, `@supabase/supabase-js`, `idb-keyval` (offline cache + write queue), `wordlist-english` (dictionary source, build-time only). Hosting: Vercel (free Hobby tier), auto-deploying from GitHub with a preview URL per pull request; GitHub Actions runs CI.

**Spec:** `docs/superpowers/specs/2026-10-28-spellkick-design.md`

## Global Constraints

- Max **100 words per list** (a guardrail against accidental pastes). **No limit on a kid's total vocabulary**; all words are kept forever.
- **Family-only**: no public sign-up. Supabase "Allow new users to sign up" is OFF; the parent is invited from the Supabase dashboard.
- Kids never enter email, passwords, or personal info. Kid profile = display name, grade, optional 4-digit PIN.
- **The kid picks the game; the app picks the words.** No kid-facing word chooser.
- Session length default **10 words**.
- Word-state colors: **Mastered = green** (`#d9f5e3` bg / `#16703b` text), **Tricky = orange** (`#ffe7d1` / `#a04b00`), **Review = indigo** (`#e5e8ff` / `#3a45a8`). Primary `#4f5bd5`.
- **Mastered** = correct with no hints on **≥3 distinct local days** since the most recent miss. A miss after mastery → Tricky.
- **Timer only adds points**, never subtracts. Default timer **on** for grade ≥ 4, **off** below; per-profile toggle.
- **No scramble or generated misspelling may contain a blocklisted term as a case-insensitive substring.** Parent-entered words are never filtered.
- Generated misspellings must not be any real English word.
- Large tap targets (min 44×44 px); layouts work from 360 px phone width to iPad landscape.
- Repo is public: never commit secrets. The Supabase anon key and URL are public by design and go in Vercel environment variables (and `.env.local` for dev, git-ignored), not source.
- Commit email for this repo is the GitHub noreply address (already set in local git config).

## Review Focus

1. **Messy pasted lists**: numbered lines ("1. necessary"), bullets, commas, tabs, blank lines, duplicates, trailing punctuation, mixed case, >100 words. Expect a clean, de-duplicated list and a visible "only the first 100 were kept" message. → tests in Task 2.
2. **Odd words**: very short words ("at"), all-same-letter or unscramblable words ("aa", "eye"), hyphenated ("well-known"), apostrophes ("don't"), two-word entries ("ice cream"). Expect the game to skip a word it can't make a safe puzzle from, never crash or show the answer. → tests in Tasks 4 and 5.
3. **Too few words**: a list with 1–3 words, or a brand-new profile with no lists. Spot the Misspelling needs 4 words; sessions need 10. Expect fill from the generated pool at the kid's grade. → tests in Task 7.
4. **Near-midnight and time zones**: a session finishing at 11:58 pm, or on a device in another time zone. Expect streaks and mastery days to use the kid's local date recorded at attempt time. → tests in Tasks 6 and 8.
5. **Offline then reconnect / two devices**: attempts made offline on the iPad and online on the laptop the same day. Expect no lost attempts and no double counting. → tests in Task 15.

---

## File Structure

```
src/
  engine/              pure logic, no React, no I/O
    types.ts           shared domain types
    words.ts           parseWordList, normalizeWord
    blocklist.ts       BLOCKED_TERMS data
    safety.ts          containsBlocked
    rng.ts             seeded RNG
    scramble.ts        makeScramble
    misspell.ts        makeMisspelling
    dictionary.ts      loadDictionary (lazy)
    mastery.ts         deriveWordState, summarize
    selection.ts       selectSessionWords, currentList
    difficulty.ts      adaptGeneratedLevel
    scoring.ts         scoreAnswer
    streak.ts          computeStreak, localDate
    badges.ts          BADGES, evaluateBadges
  data/
    repo.ts            Repo interface
    memoryRepo.ts      in-memory Repo (tests, dev)
    supabaseRepo.ts    Supabase Repo
    offlineRepo.ts     Repo wrapper: read cache + offline write queue
    gradeWords.json    curated grade 1–8 word pool
  app/                 providers, router, auth
  screens/             one folder per screen
  components/          shared UI (WordPill, ProgressBar, LetterTiles, Timer, PinPad)
public/dictionary.txt  generated word list, lazy-loaded
supabase/migrations/0001_init.sql
scripts/build-dictionary.ts
tests/                 mirrors src/
docs/setup.md          Supabase + Vercel setup for the parent
.github/workflows/ci.yml
vercel.json            SPA rewrite to index.html
```

---

### Task 1: Project scaffold, CI, and deploy pipeline

**Files:**
- Create: Vite React-TS app at repo root, `tailwind.config.ts`, `src/index.css`, `src/App.tsx`, `vitest.config.ts`, `tests/setup.ts`, `tests/App.test.tsx`, `.github/workflows/ci.yml`, `vercel.json`, `docs/setup.md`, `.env.example`
- Modify: `README.md` (dev commands)

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run build`, `npm run dev`, `npm run lint`, `npm run typecheck`. Tailwind theme tokens `mastered`, `tricky`, `review`, `primary` with the Global Constraints hex values.

- [ ] **Step 1: Scaffold** with `npm create vite@latest . -- --template react-ts`, add Tailwind, Vitest, Testing Library, jsdom, React Router, `vite-plugin-pwa`. TS `strict: true`.
- [ ] **Step 2: Write the failing test** `tests/App.test.tsx`:

```tsx
it('renders the SpellKick name', () => {
  render(<App />);
  expect(screen.getByText(/SpellKick/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run** `npm test` → FAIL (text not found).
- [ ] **Step 4: Implement** `App.tsx` as a BrowserRouter shell with a placeholder home that shows "SpellKick". PWA manifest: name "SpellKick", `display: standalone`, theme color `#4f5bd5`, 192/512 icons (simple generated placeholder).
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run build` → all pass.
- [ ] **Step 6: CI + deploy.** `ci.yml`: on push/PR run install, lint, typecheck, test, build. `vercel.json`: rewrite all paths to `/index.html`. `.env.example` lists `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `docs/setup.md` explains in plain language: in Vercel, "Add New → Project → Import" the `spellkick` GitHub repo (framework preset Vite), and add the two env vars for Production and Preview.
- [ ] **Step 7: Commit** `feat: scaffold app, CI, and Vercel config` and push; confirm the CI run is green with `gh run watch`.

> **Parent action:** import the repo in Vercel per `docs/setup.md` (one-time, ~2 minutes). After that every push to `main` deploys.

---

### Task 2: Word list parsing

**Files:** Create `src/engine/types.ts`, `src/engine/words.ts`; Test `tests/engine/words.test.ts`

**Interfaces:**
- Produces:
  - `normalizeWord(w: string): string` — trim, lowercase, collapse inner whitespace. Used as the identity key for a word everywhere.
  - `parseWordList(text: string, max = 100): { words: string[]; truncated: boolean; dropped: string[] }` — `words` keep the parent's original casing, de-duplicated by `normalizeWord`, in first-seen order.
  - `types.ts` (all ids are client-generated `crypto.randomUUID()` strings; dates are `YYYY-MM-DD`, timestamps ISO strings):
    - `AttemptKind = 'clean' | 'hinted' | 'miss' | 'practice'`; `GameId = 'scramble' | 'misspell'`; `WordState = 'new' | 'learning' | 'tricky' | 'mastered'`; `Theme = 'default' | 'skate' | 'fishing' | 'art'`; `ListSource = 'school' | 'parent' | 'teacher' | 'other'`
    - `Profile { id; name; grade: number /*1–8*/; generatedLevel: number; pinHash: string | null; timerOn: boolean; theme: Theme; createdAt }`
    - `WordList { id; profileId; name; testDate: string | null; source: ListSource; author: string | null; words: string[] /*parent casing, ≤100*/; createdAt }`
    - `Attempt { id; profileId; sessionId; word: string /*normalizeWord form*/; listId: string | null /*null = generated-pool word*/; game: GameId; kind: AttemptKind; ms: number | null; localDate; createdAt }`
    - `Session { id; profileId; game: GameId; mode: 'normal' | 'extra'; startedAt; completedAt: string | null; localDate; points: number; stars: number; trickyCount: number /*words that were tricky at start*/ }`
    - `Award { profileId; badgeId; earnedAt }`
    - `AttemptLike = Pick<Attempt, 'word' | 'kind' | 'localDate' | 'createdAt'>` — what pure engine functions accept, so tests can pass minimal objects.

- [ ] **Step 1: Write the failing tests**

```ts
it('splits on newlines, commas, tabs, and semicolons', () =>
  expect(parseWordList('cat, dog\tbird;fish\nant').words).toEqual(['cat','dog','bird','fish','ant']));
it('strips numbering, bullets, and trailing punctuation', () =>
  expect(parseWordList('1. necessary\n2) rhythm.\n- separate\n• receive!').words)
    .toEqual(['necessary','rhythm','separate','receive']));
it('keeps two-word, hyphenated, and apostrophe entries intact', () =>
  expect(parseWordList("ice cream\nwell-known\ndon't").words).toEqual(['ice cream','well-known',"don't"]));
it('dedupes case-insensitively, keeping first casing', () =>
  expect(parseWordList('Monday\nmonday\nMONDAY').words).toEqual(['Monday']));
it('ignores blank lines', () => expect(parseWordList('\n\n cat \n\n').words).toEqual(['cat']));
it('caps at 100 and reports truncation', () => {
  const r = parseWordList(Array.from({length:105},(_,i)=>`word${i}`).join('\n'));
  expect(r.words).toHaveLength(100); expect(r.truncated).toBe(true);
});
it('drops entries with digits or no letters', () =>
  expect(parseWordList('cat\n123\n???').dropped).toEqual(['123','???']));
```

Note: a line containing a space is one entry only when separated by newline; spaces never split (so "ice cream" survives). Splitting is on `\n , \t ;`.

- [ ] **Step 2: Run** `npx vitest run tests/engine/words.test.ts` → FAIL.
- [ ] **Step 3: Implement** `parseWordList` and `normalizeWord`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): parse pasted word lists`

---

### Task 3: Content safety filter

**Files:** Create `src/engine/blocklist.ts`, `src/engine/safety.ts`; Test `tests/engine/safety.test.ts`

**Interfaces:**
- Produces:
  - `BLOCKED_TERMS: readonly string[]` (lowercase); `containsBlocked(s: string): boolean` — true if any term appears as a substring of `s.toLowerCase()` with non-letters removed. Used **only on generated output** (scrambles, misspellings).
  - `INAPPROPRIATE_WORDS: readonly string[]`; `isInappropriateWord(w: string): boolean` — whole-word match after `normalizeWord`. Used to screen the generated word pool. Never substring, so `class`, `grape`, `title`, `speech` remain usable.

The list covers profanity, slurs, sexual terms, and violent/drug terms, including short ones (`ass`, `fag`, `rape`, `kkk`, `nazi`, `sex`, `cum`, `tit`, `poo`, `pee`, `fart` — kid-distracting is enough to qualify). Short terms will cause frequent reshuffles; that is intended. Keep the file one term per line, alphabetized, with a header comment explaining it's matched as substrings.

- [ ] **Step 1: Write the failing tests**

```ts
it('catches the mockup case', () => expect(containsBlocked('RAPESTAE')).toBe(true));
it('matches inside a longer string, any case', () => expect(containsBlocked('xxSeXyy')).toBe(true));
it('ignores separators', () => expect(containsBlocked('s-e x')).toBe(true));
it('passes clean strings', () => expect(containsBlocked('rhythm')).toBe(false));
it('every term is lowercase letters only', () =>
  BLOCKED_TERMS.forEach(t => expect(t).toMatch(/^[a-z]+$/)));
it('whole-word check does not flag words containing a term', () => {
  expect(isInappropriateWord('class')).toBe(false);
  expect(isInappropriateWord('grape')).toBe(false);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): content safety filters`

---

### Task 4: Seeded RNG and scramble generator

**Files:** Create `src/engine/rng.ts`, `src/engine/scramble.ts`; Test `tests/engine/scramble.test.ts`, `tests/engine/safetyCorpus.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` (0 ≤ n < 1); `seededRng(seed: number): Rng` (mulberry32); `shuffle<T>(arr: T[], rng: Rng): T[]` (new array).
  - `makeScramble(word: string, rng: Rng, maxTries = 50): string | null` — returns uppercase letters only (spaces, hyphens, apostrophes removed from the tiles), never equal to the word's letters in order, never `containsBlocked`. `null` if impossible within `maxTries` or fewer than 3 letters or all letters identical.

- [ ] **Step 1: Write the failing tests**

```ts
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
  for (let i = 0; i < 2000; i++) { const s = makeScramble('separate', seededRng(i)); expect(s && containsBlocked(s)).toBeFalsy(); }
});
```

`tests/engine/safetyCorpus.test.ts`: for every word in `src/data/gradeWords.json` (Task 7 creates it; until then use a fixture of 200 common spelling words in `tests/fixtures/spellingWords.ts`), run `makeScramble` with 50 seeds and assert no output `containsBlocked`. (Task 5 extends this file to misspellings.)

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): safe scramble generator`

---

### Task 5: Dictionary and misspelling generator

**Files:** Create `scripts/build-dictionary.ts`, `public/dictionary.txt` (generated, committed), `src/engine/dictionary.ts`, `src/engine/misspell.ts`; Modify `tests/engine/safetyCorpus.test.ts`; Test `tests/engine/misspell.test.ts`

**Interfaces:**
- Produces:
  - `scripts/build-dictionary.ts` (`npm run build:dict`): merges `english/10`…`english/70` and `english/american/10`…`english/american/70` from `wordlist-english`, lowercased, deduped, one per line (must stay under 2 MB).
  - `loadDictionary(): Promise<Set<string>>` — fetches `${import.meta.env.BASE_URL}dictionary.txt` once and caches.
  - `makeMisspelling(word: string, opts: { rng: Rng; isRealWord: (w: string) => boolean; avoid?: Set<string> }, maxTries = 30): string | null` — `isRealWord` and `avoid` receive/contain lowercase strings. **The first letter is never changed** (keeps the parent's casing). Result differs from `normalizeWord(word)`, is not `isRealWord`, not in `avoid` (the kid's other words), not `containsBlocked`. `null` for words under 3 letters, multi-word entries, or if no rule yields a valid result.

Rules, tried in random order: swap two adjacent interior letters; `ie`↔`ei`; double a single consonant / undouble a double consonant; drop a silent `e`, `h`, `k`, `w`, `b` where present; vowel swap in an unstressed spot (`a↔e`, `e↔i`); suffix swaps `able↔ible`, `ant↔ent`, `ance↔ence`, `tion↔sion`; `c↔s` before e/i; `ph↔f`; for short words, double the final consonant (`sun`→`sunn`) or add a silent final `e` (`dog`→`doge` is rejected as real; `sun`→`sune`). Rules apply only after the first letter.

- [ ] **Step 1: Write the failing tests**

```ts
const dict = new Set(['form','from','receive','separate']);
const opts = (seed: number) => ({ rng: seededRng(seed), isRealWord: (w: string) => dict.has(w) });
it('changes the word', () => expect(makeMisspelling('receive', opts(1))).not.toBe('receive'));
it('never produces a real word', () => {
  for (let i = 0; i < 300; i++) expect(makeMisspelling('form', opts(i))).not.toBe('from');
});
it('produces common error patterns', () => {
  const outs = new Set(Array.from({length:200},(_,i)=>makeMisspelling('receive', opts(i))));
  expect(outs).toContain('recieve');
});
it('returns null for 2-letter words', () => expect(makeMisspelling('at', opts(1))).toBeNull());
it('misspells 3-letter words', () => expect(makeMisspelling('sun', opts(1))).not.toBeNull());
it('never changes the first letter', () => {
  for (let i = 0; i < 200; i++) expect(makeMisspelling('wrist', opts(i))?.[0]).toBe('w');
});
it('keeps a leading capital', () => expect(makeMisspelling('Wednesday', opts(3))![0]).toBe('W'));
```

Extend `safetyCorpus.test.ts`: same corpus, 50 seeds each, `makeMisspelling` outputs never `containsBlocked`; and ≥95% of single-word corpus entries with ≥3 letters get a non-null misspelling within 10 seeds (guards against the blocklist starving long words like `competition`).

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, run `npm run build:dict`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): dictionary-checked misspelling generator`

---

### Task 6: Mastery and word states

**Files:** Create `src/engine/mastery.ts`, `src/engine/streak.ts` (only `localDate` here); Test `tests/engine/mastery.test.ts`

**Interfaces:**
- Consumes: `AttemptLike` (Task 2)
- Produces:
  - `localDate(d: Date, timeZone?: string): string` — `YYYY-MM-DD` in the device's zone (use `Intl.DateTimeFormat('en-CA')`).
  - `deriveWordState(attempts: AttemptLike[]): WordState` (attempts for one word, any order)
  - `summarize(attempts: AttemptLike[]): Map<string, WordState>` keyed by normalized word.

Rules (from spec + Global Constraints):
- no attempts → `new`
- let `afterMiss` = attempts after the latest `miss`. A day **counts** if it has ≥1 `clean` and no `hinted` attempt that day (spec: hinted solves don't count toward mastery that day). If counting days in `afterMiss` ≥ 3 → `mastered`
- else if any of the last 3 attempts (by `createdAt`, ignoring `practice`) is `miss` or `hinted` → `tricky`
- else → `learning`
- `practice` attempts never change state.

- [ ] **Step 1: Write the failing tests**

```ts
const a = (kind: AttemptKind, day: string, t = day + 'T12:00:00Z') => ({ word: 'rhythm', kind, localDate: day, createdAt: t });
it('new with no attempts', () => expect(deriveWordState([])).toBe('new'));
it('three clean days = mastered', () =>
  expect(deriveWordState([a('clean','2026-11-01'),a('clean','2026-11-02'),a('clean','2026-11-03')])).toBe('mastered'));
it('three clean on one day is not mastered', () =>
  expect(deriveWordState([a('clean','2026-11-01','2026-11-01T01:00Z'),a('clean','2026-11-01','2026-11-01T02:00Z'),a('clean','2026-11-01','2026-11-01T03:00Z')])).toBe('learning'));
it('a miss after mastery drops to tricky', () =>
  expect(deriveWordState([a('clean','2026-11-01'),a('clean','2026-11-02'),a('clean','2026-11-03'),a('miss','2026-11-04')])).toBe('tricky'));
it('hinted solves are tricky and do not count toward mastery', () =>
  expect(deriveWordState([a('hinted','2026-11-01'),a('hinted','2026-11-02'),a('hinted','2026-11-03')])).toBe('tricky'));
it('practice never changes state', () => expect(deriveWordState([a('practice','2026-11-01')])).toBe('new'));
it('a hinted solve voids that day for mastery', () =>
  expect(deriveWordState([a('clean','2026-11-01'),a('clean','2026-11-02'),a('hinted','2026-11-03','2026-11-03T10:00Z'),a('clean','2026-11-03','2026-11-03T11:00Z')])).not.toBe('mastered'));
it('localDate uses local zone near midnight', () =>
  expect(localDate(new Date('2026-11-02T03:58:00Z'), 'America/New_York')).toBe('2026-11-01'));
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): derive word mastery states`

---

### Task 7: Grade word pool, adaptive level, and session word selection

**Files:** Create `src/data/gradeWords.json`, `src/engine/difficulty.ts`, `src/engine/selection.ts`; Modify `tests/engine/safetyCorpus.test.ts` (switch corpus to gradeWords); Test `tests/engine/selection.test.ts`, `tests/engine/difficulty.test.ts`, `tests/data/gradeWords.test.ts`

**Interfaces:**
- Consumes: `summarize` (Task 6), `WordList { id; name; testDate: string | null; words: string[]; createdAt }`
- Produces:
  - `gradeWords.json`: `{ "1": string[], …, "8": string[] }`, ≥150 kid-appropriate words per grade, written by the implementer from general knowledge of grade-level spelling (no copyrighted list copied wholesale).
  - `currentList(lists: WordList[], today: string): WordList | null` — earliest list with `testDate ≥ today`; else the most recently created list with no `testDate`; else `null`.
  - `selectSessionWords(input: { lists: WordList[]; attempts: AttemptLike[]; today: string; generatedLevel: number; size?: number /*10*/; mode?: 'normal' | 'extra'; usable?: (word: string) => boolean; rng: Rng }): SessionWord[]` — `usable` excludes words the chosen game can't make a puzzle from *before* filling, so sessions backfill instead of shrinking. `mode: 'extra'` = generated pool only ("Practice extra words"). where `SessionWord = { word: string /*display casing*/; role: 'current' | 'review' | 'generated'; listId: string | null; state: WordState }`.
  - `adaptGeneratedLevel(level: number, recentGenerated: AttemptLike[]): number` (callers pass attempts with `listId === null`) — over the last 20 non-practice generated attempts: accuracy (clean ÷ total) ≥ 0.9 → `level+1`; ≤ 0.6 → `level-1`; clamp 1–8; fewer than 10 attempts → unchanged.

Selection algorithm (size N=10):
1. `cur = currentList(...)`. Current slots = `round(N*0.7)`. Fill from `cur.words` by tier: `tricky`, `new`, `learning`, then `mastered` — but if ≥80% of `cur` is mastered, leftover current slots go to generated words instead of mastered ones.
2. Review slots = remaining. Candidates: words from all other lists. Order: `tricky` first, then `learning`/`mastered` by oldest last-attempt; random tiebreak.
3. Any slots still empty (no `cur`, short list, the 80% rule, or `usable` exclusions): fill from `gradeWords[generatedLevel]`, preferring generated words not mastered; then from adjacent levels if still short.
4. No duplicates by `normalizeWord`. Final order shuffled.

- [ ] **Step 1: Write the failing tests**

```ts
it('picks the earliest upcoming test list', () => …expect(currentList(lists,'2026-11-03')!.id).toBe('fri'));
it('fills 7 current + 3 review when available', () => { const s = select(...); expect(count(s,'current')).toBe(7); expect(count(s,'review')).toBe(3); });
it('puts tricky current words first', () => expect(select(...).filter(w=>w.role==='current').map(w=>w.word)).toEqual(expect.arrayContaining(trickyWords)));
it('fills from generated pool when there are no lists', () => { const s = select({ lists: [], ... }); expect(s).toHaveLength(10); expect(s.every(w=>w.role==='generated')).toBe(true); });
it('fills from generated pool when the list has 2 words', () => expect(select({ lists:[twoWordList], ... })).toHaveLength(10));
it('never duplicates a word across roles', () => { const s = select({ lists: [overlappingLists], ... }); expect(new Set(s.map(w => normalizeWord(w.word))).size).toBe(s.length); });
it('adapts level up at 90% and down at 60%, clamped', () => { expect(adaptGeneratedLevel(3, nClean(18,2))).toBe(4); expect(adaptGeneratedLevel(1, nClean(5,15))).toBe(1); });
it('every grade has ≥150 words and none are isInappropriateWord', () => …);
it('respects usable and still returns 10', () => expect(select({ ..., usable: w => w.length > 3 }).every(w => w.word.length > 3)).toBe(true));
it('extra mode returns only generated words', () => expect(select({ ..., mode: 'extra' }).every(w => w.role === 'generated')).toBe(true));
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** all engine tests → PASS (corpus test now uses gradeWords).
- [ ] **Step 5: Commit** `feat(engine): grade pool and session word selection`

---

### Task 8: Scoring, streaks, and badges

**Files:** Create `src/engine/scoring.ts`, `src/engine/badges.ts`; Modify `src/engine/streak.ts`; Test `tests/engine/scoring.test.ts`, `tests/engine/streak.test.ts`, `tests/engine/badges.test.ts`

**Interfaces:**
- Produces:
  - `scoreAnswer(a: { kind: AttemptKind; ms: number | null; timerOn: boolean }): number` — `clean` 10, `hinted` 5, `practice` 3, `miss` 0; speed bonus only when `timerOn` and `kind==='clean'`: `ms ≤ 5000` → +5, `ms ≤ 10000` → +2.
  - `computeStreak(sessionDates: string[], today: string): { current: number; best: number }` — consecutive distinct dates ending at `today` or yesterday.
  - `BADGES: readonly BadgeDef[]`, `BadgeDef = { id: string; name: string; emoji: string; description: string; progress(stats: Stats): { value: number; goal: number } }`
  - `starsFor(a: { kind: AttemptKind; spotFix?: boolean }): number` — 1 star per `clean` answer, +1 more when it's a Spot the Misspelling fix. Both games earn stars.
  - `Stats = { sessions: number; streakBest: number; mastered: number; comebacks: number; stars: number; trickySessions: number }`
  - `computeStats(attempts: Attempt[], sessions: Session[], today: string): Stats` — derives every `Stats` field from records (comebacks via replaying each word's attempts in `createdAt` order through `deriveWordState`).
  - `evaluateBadges(stats: Stats, earned: Set<string>): string[]` — newly earned ids.

Badge set (id → goal): `first-kick` sessions 1; `streak-3`, `streak-7`, `streak-master` (streakBest 10), `streak-30`; `mastered-10`, `-25`, `-50`, `-100`; `comeback` (comebacks 1), `comeback-10`; `stars-50`, `stars-250`; `tricky-tamer` (trickySessions 5). A *comeback* = a word that was `tricky` at some point and is now `mastered`. A *tricky session* = a completed session with `trickyCount ≥ 3` (stored on the session by Task 12). `stars` = sum of `session.stars`. Names/emoji are the implementer's call; include a few with skate 🛹, fishing 🎣, and art 🎨 themes.

- [ ] **Step 1: Write the failing tests**

```ts
it('timer adds bonus only to clean answers', () => {
  expect(scoreAnswer({kind:'clean',ms:3000,timerOn:true})).toBe(15);
  expect(scoreAnswer({kind:'clean',ms:3000,timerOn:false})).toBe(10);
  expect(scoreAnswer({kind:'hinted',ms:1000,timerOn:true})).toBe(5);
  expect(scoreAnswer({kind:'clean',ms:60000,timerOn:true})).toBe(10); // slow is never penalized
});
it('streak survives until end of the next day', () =>
  expect(computeStreak(['2026-11-01','2026-11-02'],'2026-11-03').current).toBe(2));
it('streak breaks after a missed day', () =>
  expect(computeStreak(['2026-11-01'],'2026-11-03').current).toBe(0));
it('duplicate dates count once', () => expect(computeStreak(['2026-11-03','2026-11-03'],'2026-11-03').current).toBe(1));
it('awards newly crossed badges only', () =>
  expect(evaluateBadges({...zero, sessions:1}, new Set())).toEqual(['first-kick']));
it('does not re-award', () => expect(evaluateBadges({...zero, sessions:5}, new Set(['first-kick']))).toEqual([]));
it('counts a comeback when a tricky word becomes mastered', () =>
  expect(computeStats([miss('d1'), clean('d2'), clean('d3'), clean('d4')], [], 'd4').comebacks).toBe(1));
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): scoring, streaks, badges`

---

### Task 9: Database schema and Repo layer

**Files:** Create `supabase/migrations/0001_init.sql`, `src/data/repo.ts`, `src/data/memoryRepo.ts`, `src/data/supabaseRepo.ts`, `src/app/supabase.ts`; Modify `docs/setup.md`; Test `tests/data/memoryRepo.test.ts`

**Interfaces:**
- Produces `Repo`:

```ts
interface Repo {
  listProfiles(): Promise<Profile[]>;
  saveProfile(p: Profile): Promise<void>;           // upsert
  deleteProfile(id: string): Promise<void>;
  listLists(profileId: string): Promise<WordList[]>;
  saveList(l: WordList): Promise<void>;             // upsert (words array included)
  deleteList(id: string): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
  addAttempts(a: Attempt[]): Promise<void>;         // idempotent by id
  listSessions(profileId: string): Promise<Session[]>;
  saveSession(s: Session): Promise<void>;           // idempotent by id
  listAwards(profileId: string): Promise<Award[]>;
  addAwards(a: Award[]): Promise<void>;             // idempotent by (profileId, badgeId)
  getParentPinHash(): Promise<string | null>;
  setParentPinHash(h: string): Promise<void>;
}
```

Schema (all tables have `owner uuid not null default auth.uid()` and RLS `owner = auth.uid()` for select/insert/update/delete):
- `profiles(id uuid pk, name text, grade int check 1–8, generated_level int, pin_hash text null, timer_on bool, theme text, created_at timestamptz)`
- `word_lists(id uuid pk, profile_id uuid fk on delete cascade, name text, test_date date null, source text check in ('school','parent','teacher','other'), author text null, words text[] not null check (cardinality(words) <= 100), created_at timestamptz)` — one atomic upsert per save; `author` is the hook for future teacher accounts.
- `attempts(id uuid pk, profile_id uuid fk, session_id uuid, word text, list_id uuid null, game text, kind text, ms int null, local_date date, created_at timestamptz)`
- `sessions(id uuid pk, profile_id uuid fk, game text, mode text, started_at, completed_at null, local_date date, points int, stars int, tricky_count int)`
- `awards(profile_id uuid fk, badge_id text, earned_at timestamptz, pk(profile_id, badge_id))`
- `parent_settings(owner uuid pk, pin_hash text)`

`docs/setup.md` adds, in plain steps: create a free Supabase project, run the migration in the SQL editor, turn **off** "Allow new users to sign up", invite the parent email, edit the "Magic Link" email template to show the 6-digit code (`{{ .Token }}`), set Site URL to the Vercel production URL, copy the project URL + anon key into Vercel env vars and `.env.local`.

- [ ] **Step 1: Write the failing tests** against `createMemoryRepo()`: save/list a profile; `saveList` replaces words; `addAttempts` with the same id twice stores one; `addAwards` duplicate stores one; deleting a profile removes its lists, attempts, sessions, awards.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** memory repo, then Supabase repo with the same behavior (`upsert` with `onConflict`; `ignoreDuplicates: true` for attempts and awards). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(data): schema and repo layer`

> **Parent action needed before Task 10 can be tried for real:** finish the Supabase settings per `docs/setup.md` (project already created 2026-10-28). All automated tests use the memory repo and don't need it.

---

### Task 10: Sign-in, profile picker, kid PIN

**Files:** Create `src/app/AuthProvider.tsx`, `src/app/RepoProvider.tsx`, `src/app/ProfileProvider.tsx`, `src/components/PinPad.tsx`, `src/engine/pin.ts`, `src/screens/SignIn/`, `src/screens/Profiles/`; Test `tests/screens/Profiles.test.tsx`, `tests/engine/pin.test.ts`

**Interfaces:**
- Consumes: `Repo`
- Produces: `useRepo(): Repo`, `useActiveProfile(): { profile: Profile | null; select(id: string): void; clear(): void }` (active profile id persisted in `localStorage` per device, try/catch wrapped). `hashPin(pin: string, salt: string): Promise<string>` (SHA-256 via `crypto.subtle`, salt = profile id or owner id). Routes: `/signin`, `/profiles`, `/kid/:id/*`.

Behavior: SignIn = email field → `signInWithOtp({ email, options: { shouldCreateUser: false } })` → 6-digit code field → `verifyOtp({ email, token, type: 'email' })`. A code (not a link) is required because on iPad a tapped link opens Safari, whose storage the home-screen app can't see. No password, no sign-up wording; an unknown email shows "This email isn't set up for SpellKick." Profiles = big avatar tiles; tapping a PIN-protected profile opens `PinPad` (4 digits, 3 wrong tries → 30 s cooldown). A "Parent" button at the bottom leads to Task 11.

- [ ] **Step 1: Write the failing tests** (memory repo + stubbed auth client injected): SignIn calls `signInWithOtp` with `shouldCreateUser: false` then `verifyOtp` with the typed code; shows each profile name; tapping a profile without PIN routes to `/kid/:id`; with PIN, wrong PIN shows "Try again" and does not route, right PIN routes; `hashPin('1234','a') !== hashPin('1234','b')`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: sign-in and kid profile picker`

---

### Task 11: Parent area (PIN, profiles, lists, progress)

**Files:** Create `src/screens/Parent/{ParentGate,ParentHome,ProfileEditor,ListEditor,ProgressView}.tsx`; Test `tests/screens/Parent.test.tsx`

**Interfaces:**
- Consumes: `Repo`, `parseWordList`, `summarize`, `hashPin`, `computeStreak`
- Produces: routes `/parent`, `/parent/profile/:id`, `/parent/list/:id`, `/parent/progress/:profileId`.

Behavior:
- **ParentGate**: first visit sets a 4-digit parent PIN; afterward requires it each time the parent area opens.
- **ProfileEditor**: name, grade 1–8, optional kid PIN, timer default (on if grade ≥ 4), theme (`default | skate | fishing | art`). Sets `generatedLevel = grade` on create.
- **ListEditor**: name, optional test date, source (school/parent/teacher/other), one big textarea that accepts typing or paste; live preview of parsed words as pills; shows `dropped` entries and the "only the first 100 were kept" note when `truncated`. Lists with future test dates show as "Upcoming". Lists sorted by test date.
- **ProgressView**: per kid, current streak/best, counts of mastered/tricky/learning/new, list-by-list word pills colored by state, last 7 days of sessions.

- [ ] **Step 1: Write the failing tests**: pasting `"1. necessary\n2. rhythm\nnecessary"` previews exactly two pills; saving creates a list in the repo with source and date; 105 pasted words shows the truncation note and saves 100; wrong parent PIN blocks entry; ProgressView shows "Mastered 1" given seeded attempts for one mastered word.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: parent area with list entry and progress`

---

### Task 12: Kid home and session engine

**Files:** Create `src/screens/KidHome/`, `src/screens/Session/{useSession.ts,SessionShell.tsx,SessionDone.tsx}`, `src/components/{WordPill,ProgressBar,Timer}.tsx`; Test `tests/screens/useSession.test.ts`, `tests/screens/KidHome.test.tsx`

**Interfaces:**
- Consumes: `selectSessionWords`, `currentList`, `summarize`, `scoreAnswer`, `computeStreak`, `computeStats`, `evaluateBadges`, `adaptGeneratedLevel`, `Repo`
- Produces:
  - `useSession(game: GameId, opts?: { mode?: 'normal' | 'extra'; rng?: Rng; now?: () => Date }): { words: SessionWord[]; index: number; current: SessionWord; record(r: { word: string; kind: AttemptKind; ms: number | null; spotFix?: boolean }): void; skip(): void; next(): void; done: boolean; loading: boolean; summary: SessionSummary }` — stores `normalizeWord(word)` on the attempt, writes each attempt via `repo.addAttempts` as it's recorded (Task 15 makes the repo offline-safe). Before selecting words it builds a game-specific `usable` (Scramble: `makeScramble(w) !== null`; Spot: awaits `loadDictionary()` then `makeMisspelling(w) !== null`) and passes it to `selectSessionWords`. Sets `trickyCount` from word states at start. On finish saves the `Session`, evaluates and saves new awards, updates `generatedLevel` via `adaptGeneratedLevel` (failure here must not block the done screen).
  - `SessionSummary = { masteredToday: string[]; stillTricky: string[]; points: number; stars: number; streak: { current: number; best: number; isNewBest: boolean }; newBadges: BadgeDef[] }`
  - `<Timer running onTick />` shows elapsed seconds subtly; hidden when the profile's timer is off.
  - Game components receive `{ word: SessionWord; allWords: string[] /*every word in the kid's lists, display casing*/; fallbackWords: string[] /*gradeWords at the kid's generatedLevel*/; onResult(r): void; onSkip(): void; timerOn: boolean }`.

KidHome (matches the approved mockup): name, next test + countdown in days (hidden when no date), current list progress bar "X of Y mastered", pills for mastered/tricky/review counts, game buttons (Scramble, Spot the Misspelling, Practice extra words → generated-only session), Awards link.

SessionDone (matches mockup): big 🔥 streak with "new personal best!" when applicable, mastered-today pills (green), still-tricky pills (orange) with "coming back tomorrow", new badge banner, buttons "Play again" and "See my awards".

- [ ] **Step 1: Write the failing tests**: `useSession` with memory repo and seeded rng yields 10 words; recording 10 answers marks `done` and saves one session and 10 attempts; a word reaching its third clean day appears in `masteredToday`; first ever session yields `first-kick` in `newBadges`; KidHome shows "Test in 3 days" for a list dated 3 days out and hides the countdown with no date.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: kid home and session flow`

---

### Task 13: Scramble game

**Files:** Create `src/screens/Games/Scramble.tsx`, `src/components/LetterTiles.tsx`, `src/app/speech.ts`; Test `tests/screens/Scramble.test.tsx`

**Interfaces:**
- Consumes: game component props (Task 12), `makeScramble`, `seededRng`
- Produces: `speak(word: string): void` (Web Speech API, `en-US`, rate 0.85; no-op if unsupported, and the "Hear it" button is hidden then).

Behavior (layout A, approved): progress "4 of 10"; scrambled tiles; tapping a tile moves it to the next empty slot, tapping a filled slot returns it; "Type instead" switches to a text input; **Check** compares case-insensitively ignoring the stripped punctuation (`don't` ↔ `DONT`). Hints: first tap reveals and locks the first letter; second tap speaks the word (or, if speech is unavailable, reveals the next letter). Correct with no hints → `clean`; with hints → `hinted`; wrong → shake, one retry, second wrong → `miss` and show the correct spelling for 2 s. If `makeScramble` returns `null`, skip the word without recording.

- [ ] **Step 1: Write the failing tests**: tiles contain exactly the word's letters; tapping tiles in correct order then Check calls `onResult({kind:'clean'})`; using Hint once then solving → `hinted`; two wrong checks → `miss`; typing mode accepts "Necessary" for "necessary"; unscramblable word calls `onSkip`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: scramble game`

---

### Task 14: Spot the Misspelling game

**Files:** Create `src/screens/Games/SpotMisspelling.tsx`; Test `tests/screens/SpotMisspelling.test.tsx`

**Interfaces:**
- Consumes: game component props, `makeMisspelling`, `loadDictionary`, `seededRng`

Behavior (approved layout): 4 choices — the misspelled target plus 3 correct distractors drawn from `allWords`, topped up from `fallbackWords` if fewer than 3, shuffled. Tap the wrong one: correct tap → record `practice`, then a text box "Fix it for a bonus ⭐": correct typed fix → record `clean` with `star: true`; wrong or skipped fix → nothing further. Wrong tap → record `miss` for the target, highlight the real misspelling, show the correct spelling. Distractors get no attempts. Show a loading state while the dictionary loads; if `makeMisspelling` returns `null`, call `onSkip`.

- [ ] **Step 1: Write the failing tests** (stub dictionary): exactly one choice differs from its source word; correct tap records `practice`; correct fix records `clean` with star; wrong tap records `miss` for the target; distractors come from `fallbackWords` when `allWords` has 1 entry.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: spot the misspelling game`

---

### Task 15: Awards shelf, offline support, and installability

**Files:** Create `src/screens/Awards/`, `src/data/offlineRepo.ts`; Modify `src/app/RepoProvider.tsx`, `vite.config.ts`; Test `tests/data/offlineRepo.test.ts`, `tests/screens/Awards.test.tsx`

**Interfaces:**
- Consumes: `BADGES`, `Repo`
- Produces:
  - `type KeyValueStore = { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void>; del(k: string): Promise<void> }` (prod: `idb-keyval`; tests: a Map).
  - `createOfflineRepo(inner: Repo, store: KeyValueStore): Repo & { flush(): Promise<void>; pending(): Promise<number> }` — every successful read is cached; a failed read returns the cache merged with pending writes by id. Writes (`addAttempts`, `saveSession`, `addAwards`, `saveProfile`) queue first, then flush; failures stay queued; flush on the `online` event and app start. Parent-area writes (`saveList`, `deleteList`, `deleteProfile`, PIN) go straight through and show an error offline. `RepoProvider` wraps the Supabase repo with it.

Awards screen (matches mockup): earned count, badge grid (locked badges greyed), "Next up" badge with progress bar from `progress(stats)`.

PWA: `vite-plugin-pwa` `registerType: 'autoUpdate'`, `workbox.globPatterns` must include `**/*.{js,css,html,svg,png,txt}` so `dictionary.txt` is precached (confirm it is under the 2 MB `maximumFileSizeToCacheInBytes` default); Supabase calls network-only.

- [ ] **Step 1: Write the failing tests**: with an inner repo that throws, `listLists` returns the last cached result; offline repo keeps 3 attempts pending, then flushes all 3 when the repo recovers; flushing twice doesn't duplicate (repo idempotency); attempts from two offline repos (two devices) on the same day both appear in `listAttempts` and `deriveWordState` counts the day once; Awards shows locked state for unearned badges and "6 of 10" for `streak-master` with streakBest 6.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; wrap the Supabase repo in `RepoProvider`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: awards shelf and offline support`

---

### Task 16: Visual polish and device pass

**Files:** Modify screens/components as needed; Create `tests/e2e/smoke.test.tsx` (full flow on memory repo).

- [ ] **Step 1: Write the failing smoke test**: create profile in parent area → paste list → open kid home → finish a 10-word scramble session → SessionDone shows streak 1 and `first-kick`.
- [ ] **Step 2: Run** → FAIL or PASS; fix until PASS.
- [ ] **Step 3: Polish** to match the approved mockups: rounded cards, indigo primary, state colors, 44 px targets, check layouts at 360 px, 768 px, 1024 px (Chrome DevTools device mode); respect `prefers-reduced-motion` for shake/confetti.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build` → PASS. Push; confirm the Vercel deploy succeeds and the production URL loads.
- [ ] **Step 5: Commit** `chore: v1 polish and smoke test`

> **Parent action:** open the Vercel URL on a school laptop and an iPad (Add to Home Screen) and report what's blocked, if anything.
