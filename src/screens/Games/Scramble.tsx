import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { ProfileContext } from '../../app/profileContext';
import { readScrambleMode, writeScrambleMode } from '../../app/scrambleMode';
import { speak, speechSupported } from '../../app/speech';
import { LetterTiles } from '../../components/LetterTiles';
import { loadDictionary } from '../../engine/dictionary';
import { seededRng } from '../../engine/rng';
import { makeScramble } from '../../engine/scramble';
import type { GameProps } from '../Session/games';

const SUCCESS_MS = 600;
const REVEAL_MS = 2000;
const SHAKE_MS = 400;
const MAX_HINTS = 2; // hint taps allowed; each reveals the letter the kid is stuck on

// Uppercase with spaces, hyphens and apostrophes removed: the letters a scramble is made of.
const letters = (s: string) => s.toUpperCase().replace(/[\s'’-]/g, '');

const sorted = (s: string) => [...s].sort().join('');

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Put the right tile in slot `i` (the hint slot), returning whatever was there to the tray.
function lockSlot(slots: (number | null)[], tiles: string[], i: number, letter: string): (number | null)[] {
  const next = [...slots];
  const current = next[i];
  if (current !== null && tiles[current] === letter) return next;
  let tile = tiles.findIndex((l, k) => l === letter && !next.includes(k));
  if (tile === -1) {
    tile = tiles.findIndex((l, k) => l === letter && next.indexOf(k) > i);
    next[next.indexOf(tile)] = null;
  }
  next[i] = tile;
  return next;
}

type Status = 'playing' | 'correct' | 'reveal';

// `seed` makes the scramble deterministic in tests; otherwise each mount gets a fresh one.
export function Scramble({ word, onResult, onSkip, seed }: GameProps & { seed?: number }) {
  const target = letters(word.word);
  const [tiles] = useState<string[] | null>(() => {
    const s = makeScramble(word.word, seededRng(hash(word.word) ^ (seed ?? Math.floor(Math.random() * 2 ** 32))));
    return s === null ? null : [...s];
  });
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(target.length).fill(null));
  const [typed, setTyped] = useState('');
  // Read the context directly (not useActiveProfile) so the game still renders without a provider;
  // with no profile the choice just isn't remembered.
  const profileId = useContext(ProfileContext)?.activeId ?? null;
  const [typing, setTyping] = useState(() => readScrambleMode(profileId) === 'type');
  const input = useRef<HTMLInputElement>(null);
  const [locked, setLocked] = useState(0); // length of the locked prefix (hinted letters + the kid's own correct ones before them)
  const [hintsUsed, setHintsUsed] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState<Status>('playing');
  const timers = useRef<number[]>([]);
  const skipped = useRef(false);
  const dictionary = useRef<Set<string> | null>(null); // null until loaded, or if it can't load
  const [otherWord, setOtherWord] = useState(false);
  const canSpeak = speechSupported();

  // Only used to recognize a different real word (EARTH for HEART); without it, that's just a wrong try.
  useEffect(() => {
    let live = true;
    loadDictionary().then(
      (d) => {
        if (live) dictionary.current = d;
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (tiles === null && !skipped.current) {
      skipped.current = true; // StrictMode runs effects twice
      onSkip();
    }
  }, [tiles, onSkip]);

  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing, tiles]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  if (tiles === null) return null;

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const playing = status === 'playing';

  const prefix = target.slice(0, locked);

  // First position the kid is stuck on: empty or wrong (tiles), or differing/missing (typing). null = all correct.
  const stuckAt = (() => {
    if (typing) {
      const t = letters(typed);
      for (let i = 0; i < target.length; i++) if (t[i] !== target[i]) return i;
      return null;
    }
    for (let i = locked; i < target.length; i++) {
      const t = slots[i];
      if (t === null || tiles[t] !== target[i]) return i;
    }
    return null;
  })();

  function hint() {
    if (stuckAt === null || hintsUsed >= MAX_HINTS) return;
    // Slots before stuckAt already hold the kid's correct letters: locking them is free.
    if (typing) setTyped(target.slice(0, stuckAt + 1));
    else setSlots((s) => lockSlot(s, tiles!, stuckAt, target[stuckAt]));
    setLocked(stuckAt + 1);
    setHintsUsed(hintsUsed + 1);
  }

  // Keep the locked prefix consistent in whichever mode the kid switches to.
  function toggleMode() {
    if (typing) {
      setSlots((s) => {
        let next = s;
        for (let i = 0; i < locked; i++) next = lockSlot(next, tiles!, i, target[i]);
        return next;
      });
    } else if (!letters(typed).startsWith(prefix)) {
      setTyped(prefix);
    }
    setTyping(!typing);
    writeScrambleMode(profileId, typing ? 'tiles' : 'type');
  }

  function tapTile(tile: number) {
    setSlots((s) => {
      const i = s.indexOf(null);
      if (i === -1) return s;
      const next = [...s];
      next[i] = tile;
      return next;
    });
  }

  function tapSlot(i: number) {
    if (i < locked) return;
    setSlots((s) => s.map((t, k) => (k === i ? null : t)));
  }

  function isOtherWord(guess: string): boolean {
    return guess !== target && sorted(guess) === sorted(target) && !!dictionary.current?.has(guess.toLowerCase());
  }

  function check(answer: string) {
    const guess = letters(answer);
    setOtherWord(false);
    if (guess === target) {
      setStatus('correct');
      later(SUCCESS_MS, () => onResult({ kind: hintsUsed > 0 ? 'hinted' : 'clean' }));
    } else if (isOtherWord(guess)) {
      setOtherWord(true); // a real word, just not this one: no try used
      setSlots((s) => s.map((t, k) => (k < locked ? t : null)));
      setTyped(prefix);
    } else if (wrong === 0) {
      setWrong(1);
      setShaking(true);
      later(SHAKE_MS, () => setShaking(false));
      setSlots((s) => s.map((t, k) => (k < locked ? t : null)));
      setTyped(prefix);
    } else {
      setStatus('reveal');
      later(REVEAL_MS, () => onResult({ kind: 'miss' }));
    }
  }

  const answer = slots.map((t) => (t === null ? '' : tiles[t])).join('');
  const full = !slots.includes(null);
  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    if (playing && letters(typed).length > locked) check(typed);
  };

  const pill = 'min-h-12 rounded-full px-6 text-lg font-semibold transition active:scale-95 disabled:opacity-40';

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-semibold text-slate-600">Unscramble the word</p>

      {typing ? (
        <form onSubmit={submitTyped} className="flex w-full max-w-sm flex-col items-center gap-3">
          {locked > 0 && (
            <p className="text-slate-600">
              Starts with <span className="font-bold text-primary">{prefix}</span>
            </p>
          )}
          <p className="text-2xl font-bold tracking-widest text-review-text">{tiles.join(' ')}</p>
          <input
            ref={input}
            aria-label="Type the word"
            value={typed}
            onChange={(e) => setTyped(letters(e.target.value).startsWith(prefix) ? e.target.value : prefix)}
            disabled={!playing}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`min-h-14 w-full rounded-2xl border-2 px-4 text-center text-2xl font-semibold outline-none focus:border-primary ${
              status === 'correct' ? 'border-mastered bg-mastered-bg text-mastered-text' : 'border-slate-300'
            } ${shaking ? 'motion-safe:animate-shake' : ''}`}
          />
          <button type="submit" disabled={!playing || letters(typed).length <= locked} className={`${pill} w-full bg-primary text-white`}>
            Check
          </button>
        </form>
      ) : (
        <>
          <LetterTiles
            tiles={tiles}
            slots={slots}
            locked={locked}
            tone={status === 'correct' ? 'correct' : shaking ? 'shake' : 'normal'}
            disabled={!playing}
            onTapTile={tapTile}
            onTapSlot={tapSlot}
          />
          <button
            type="button"
            disabled={!playing || !full}
            onClick={() => check(answer)}
            className={`${pill} w-full max-w-sm bg-primary text-white`}
          >
            Check
          </button>
        </>
      )}

      <div aria-live="polite" className="min-h-8 text-center text-xl font-bold">
        {status === 'correct' && <p className="text-mastered-text">Great job!</p>}
        {status === 'reveal' && (
          <p className="text-tricky-text">
            The word is <span className="text-2xl">{word.word}</span>
          </p>
        )}
        {playing && otherWord && <p className="text-slate-600">That's a different word — tap Hear it!</p>}
        {playing && !otherWord && wrong === 1 && <p className="text-slate-600">Not quite. One more try!</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {canSpeak && (
          <button type="button" onClick={() => speak(word.word)} className={`${pill} bg-review-bg text-review-text`}>
            <span aria-hidden="true">🔊 </span>Hear it
          </button>
        )}
        <button
          type="button"
          disabled={!playing || hintsUsed >= MAX_HINTS || stuckAt === null}
          onClick={hint}
          className={`${pill} bg-tricky-bg text-tricky-text`}
        >
          <span aria-hidden="true">💡 </span>Hint
        </button>
        <button
          type="button"
          disabled={!playing}
          onClick={toggleMode}
          className={`${pill} border border-slate-300 text-slate-600`}
        >
          {typing ? 'Use tiles' : 'Type instead'}
        </button>
      </div>
    </div>
  );
}
