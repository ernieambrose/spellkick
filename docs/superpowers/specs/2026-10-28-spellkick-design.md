# SpellKick — Design

Date: 2026-10-28
Status: Draft for review

## Intent and the why

SpellKick is a spelling practice web app, built first for two kids in one family and possibly shared more widely later.

- **The 11-year-old** is in a gifted program, strong at most things, and struggles with spelling. He avoids hard work that makes him feel slow and picks the easiest homework first. What keeps him at hobbies like fishing and skateboarding is **progression**: being able to do something this time that he couldn't do last time. He is competitive and reward-driven.
- **The 7-year-old** is also in a gifted program and spells well, but benefits from practice. She loves arts and crafts, storytelling, and being social.
- **Both** need small wins to build confidence and respond to rewards.

The app's real job is not drilling. It is getting a kid to *choose* to work on the words they find hard, by making progress on those words visible and worth chasing. Tricky words should feel like the next trick to land, not a pile of failures.

## Goals

1. Kids practice their actual school spelling words for the next test, with older and previously-missed words mixed in.
2. Visible progression: words mastered, streaks, badges on an awards shelf.
3. Two games at launch: **Scramble** and **Spot the Misspelling**. More later (flash cards, crossword, word search).
4. Works in a browser on iPads, school laptops, and phones. Installable to the home screen.
5. Progress syncs across devices.

## Non-goals (for v1)

- Native iOS/Android apps (keep the path open; see Constraints).
- Photo upload of word lists (wanted later).
- Flash cards, crossword, word search (later games).
- Kid-vs-kid leaderboards.
- Multi-family / public sign-up flows beyond what the account model naturally allows.

## Anti-goals (failure even if it works)

- **A scramble or generated misspelling that spells or contains a bad word, slur, or adult topic.** Example from the mockup: "separate" scrambled to "RAPESTAE". Kids will spot it instantly and it derails them. This must be prevented systematically and tested.
- The struggling kid feeling singled out or punished: rewards that only go to whoever gets things right.
- A design that lets a kid dodge their hard words by choosing easy ones.

## Constraints

- Up to **100 words per list**.
- Kids are under 13. If shared publicly, US COPPA applies. The parent owns the account; kids never provide email, passwords, or personal information.
- School laptops may be locked down and block new sites. Test early on one.
- Code should be reusable inside a native wrapper (e.g., Capacitor) later without a rewrite.

## Decisions made with the user

### Users and accounts
- **One parent account, with a profile per kid** (Netflix-style). The parent signs in once per device; kids tap their profile, optionally protected by a simple PIN.
- Each kid has their own words, progress, settings, and awards. Kids don't see each other's scores.

### Words and lists
- Every word a kid ever practices is kept permanently with its history.
- Words are grouped into **lists, one per test**. Tests happen every week or two.
- A list has: name, words (≤100), optional **test date** (drives a countdown on the kid's home screen), and a **source** (school, parent, other).
- Lists can be **pre-loaded for future tests**.
- Entry by **typing or pasting** (paste accepts newline-, comma-, or space-separated words).
- **Auto-generated words**: a separate pool that starts at the kid's grade level and **adapts** up or down based on how they're doing.

### Who picks what
- **The kid picks the game. The app picks the words.**
- Word selection for a session (~10 words): mostly the current (next upcoming test) list, weighted toward "tricky" words, with older words sprinkled in, preferring ones the kid struggled with before.

### Word states (shown with consistent colors)
- **Mastered** (green), **Tricky** (orange), **Review** — older words mixed in (blue/indigo). The user specifically liked these color categories.

### Progress and rewards
- End-of-session screen shows: words mastered today, words still tricky (coming back tomorrow), current streak, any new badge.
- **Awards tab**: badges/stickers earned at milestones, with locked badges and progress toward the next one visible.
- **Optional speed bonus** (Duolingo-style): extra points for answering quickly. Each kid can turn the timer off.

### Game: Scramble (layout A, chosen over a worksheet list)
- One word at a time, with a progress bar (e.g., "4 of 10").
- Kid taps scrambled letter tiles into slots to build the word, or switches to typing.
- "Hear it" (reads the word aloud) and "Hint" buttons.

### Game: Spot the Misspelling (layout approved)
- Four words shown, one misspelled. Kid taps the wrong one.
- Then the kid can type the correct spelling for a bonus star.
- Misspellings are generated automatically from common error patterns.

### Visual direction
- Clean, modern, friendly; large tap targets for iPad. Mockups used soft rounded cards, an indigo primary color, and the green/orange/indigo word-state pills.

## Builder's calls (not confirmed by the user; flag if they matter)

**Stack**
- React + TypeScript + Vite, built as an installable PWA (offline-capable).
- Supabase for auth and Postgres storage (free tier). Parent signs in with email (magic link or password).
- Hosting on Vercel or GitHub Pages, auto-deploying from GitHub.
- Text-to-speech via the browser's built-in Web Speech API for "Hear it" (free, no server). Voice quality varies by device; acceptable for v1.

**Rules**
- **Mastered** = spelled correctly without hints on at least 3 separate days. A miss after mastery moves the word back to Tricky.
- **Tricky** = missed recently or solved with hints.
- **Streak** = consecutive calendar days (kid's local time) with at least one completed session.
- Badges reward effort too: streaks, words mastered, sessions on tricky words, comebacks (mastering a word that was tricky). Some badges can be themed to the kid's interests (fishing, skateboarding for one; art and crafts for the other).
- **Timer only adds bonus points**, never subtracts. Slow correct answers count fully toward mastery. Default: timer off for the 7-year-old's profile, on for the 11-year-old's.
- **Scramble hints**: first hint reveals the first letter, second plays the word aloud. Hinted solves count as correct but don't count toward mastery that day.
- **Spot the Misspelling**: the three correct words also come from the kid's own lists.
- Session length defaults to ~10 words.
- **Spot the Misspelling and mastery**: a correct tap counts as practice for the misspelled word but not toward mastery. Typing the correct fix counts as a correct, unhinted spelling (toward mastery). A wrong tap marks the misspelled word Tricky. The three correct words shown alongside get no credit either way. A word *can* be mastered through this game alone, via typed fixes.
- **Points and stars**: points (including speed bonus) are a session score that feeds personal bests and some badge thresholds. Stars are a lifetime count that also unlocks badges. No spendable currency or store in v1 (possible later, e.g., themes or stickers for the 7-year-old).
- **Auto-generated words**: used to fill a session when there is no upcoming list or the current list is mostly mastered, and via a "Practice extra words" option on the home screen. They count toward mastery and badges like any word. Grade level is set per profile by the parent.
- **Misspellings must not be any real English word** (e.g., "form" → "from" is rejected). Bundle a compact English word list for this check, lazy-loaded with the game.

**Content safety (the anti-goal)**
- Maintain a blocklist of profanity, slurs, and adult-topic terms.
- Every scramble and every generated misspelling is checked for **any blocklisted term as a substring** (case-insensitive). On a match, reshuffle / regenerate; if no safe arrangement exists after N tries, skip that word for that game.
- The scramble must also never equal the original word.
- The auto-generated word pool is pre-screened for kid-appropriateness.
- Words the parent types in are never filtered.
- Automated test: scramble and misspell a large corpus of real grade-level spelling words many times and assert zero blocklist hits reach output.

**Auto-generated words**
- Source: a bundled, curated, grade-leveled word list (no external API needed). Difficulty adapts by moving between grade bands based on the kid's mastery rate.

**Misspelling generator**
- Rules such as: swapped adjacent letters, ie/ei swaps, dropped or doubled consonants, vowel substitutions (e.g., -able/-ible, -ant/-ent), silent letter removal. The output must differ from the real word and must not be another real word from the kid's lists.

## Resolved with the user (after review)

1. **Family-only v1.** Sign-up is gated by an invite/allowlist; no public sign-up, so no COPPA consent flow yet. Keep the account model open to real account creation later.
2. **Parent area behind a parent PIN**, with list management plus a simple per-kid progress view. Kids can't edit lists.
3. **School laptops**: the user will test once a deployed build exists. If blocked, the kids' iPads are the fallback; not a v1 blocker.
4. **GitHub repo is public.**
5. Name: **SpellKick** (spellkick.com and spellkick.app were unregistered on 2026-10-28). "SpellUp" was dropped because an existing app uses it.

## Future: teachers

The user wants to pin the idea of teacher accounts: a teacher could add word lists to their students' libraries. Don't build it in v1, but avoid data-model choices that make it hard (e.g., lists should have an owner/author separate from the kid profile that practices them, which the `source` field already hints at).

## Left to the builder

- Data model specifics, folder structure, component library choice, styling approach.
- Exact badge list and art.
- Exact adaptive-difficulty math.
- PIN implementation details.
- Offline sync conflict handling (last-write-wins is acceptable for v1).

## Future (captured, not v1)

- Flash cards with definitions and example sentences (needs a kid-safe dictionary source).
- Crossword with auto-generated clues; word search with tap-to-select.
- Photo upload of word lists (OCR).
- Native iOS/Android via Capacitor.
- Asking the 11-year-old which games he'd pick (user plans to ask him).
