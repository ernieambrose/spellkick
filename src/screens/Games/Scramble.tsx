import { useEffect, useRef, useState, type FormEvent } from 'react';
import { speak, speechSupported } from '../../app/speech';
import { LetterTiles } from '../../components/LetterTiles';
import { seededRng } from '../../engine/rng';
import { makeScramble } from '../../engine/scramble';
import type { GameProps } from '../Session/games';

const SUCCESS_MS = 600;
const REVEAL_MS = 2000;
const SHAKE_MS = 400;
const MAX_HINTS = 2; // each hint locks one more letter; a scramble always has at least 3

// Uppercase with spaces, hyphens and apostrophes removed: the letters a scramble is made of.
const letters = (s: string) => s.toUpperCase().replace(/[\s'’-]/g, '');

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Put the right tile in slot `i` (the next hint slot), returning whatever was there to the tray.
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
  const [typing, setTyping] = useState(false);
  const [locked, setLocked] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState<Status>('playing');
  const timers = useRef<number[]>([]);
  const skipped = useRef(false);
  const canSpeak = speechSupported();

  useEffect(() => {
    if (tiles === null && !skipped.current) {
      skipped.current = true; // StrictMode runs effects twice
      onSkip();
    }
  }, [tiles, onSkip]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  if (tiles === null) return null;

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const playing = status === 'playing';

  function hint() {
    if (locked >= MAX_HINTS) return;
    setSlots((s) => lockSlot(s, tiles!, locked, target[locked]));
    setLocked(locked + 1);
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

  function check(answer: string) {
    if (letters(answer) === target) {
      setStatus('correct');
      later(SUCCESS_MS, () => onResult({ kind: locked > 0 ? 'hinted' : 'clean' }));
    } else if (wrong === 0) {
      setWrong(1);
      setShaking(true);
      later(SHAKE_MS, () => setShaking(false));
      setSlots((s) => s.map((t, k) => (k < locked ? t : null)));
      setTyped('');
    } else {
      setStatus('reveal');
      later(REVEAL_MS, () => onResult({ kind: 'miss' }));
    }
  }

  const answer = slots.map((t) => (t === null ? '' : tiles[t])).join('');
  const full = !slots.includes(null);
  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    if (playing && typed.trim()) check(typed);
  };

  const pill = 'min-h-12 rounded-full px-6 text-lg font-semibold transition active:scale-95 disabled:opacity-40';

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-semibold text-slate-600">Unscramble the word</p>

      {typing ? (
        <form onSubmit={submitTyped} className="flex w-full max-w-sm flex-col items-center gap-3">
          {locked > 0 && (
            <p className="text-slate-600">
              Starts with <span className="font-bold text-primary">{target.slice(0, locked)}</span>
            </p>
          )}
          <p className="text-2xl font-bold tracking-widest text-review-text">{tiles.join(' ')}</p>
          <input
            aria-label="Type the word"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!playing}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`min-h-14 w-full rounded-2xl border-2 px-4 text-center text-2xl font-semibold outline-none focus:border-primary ${
              status === 'correct' ? 'border-mastered bg-mastered-bg text-mastered-text' : 'border-slate-300'
            } ${shaking ? 'motion-safe:animate-shake' : ''}`}
          />
          <button type="submit" disabled={!playing || !typed.trim()} className={`${pill} w-full bg-primary text-white`}>
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
        {playing && wrong === 1 && <p className="text-slate-600">Not quite. One more try!</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {canSpeak && (
          <button type="button" onClick={() => speak(word.word)} className={`${pill} bg-review-bg text-review-text`}>
            <span aria-hidden="true">🔊 </span>Hear it
          </button>
        )}
        <button
          type="button"
          disabled={!playing || locked >= MAX_HINTS}
          onClick={hint}
          className={`${pill} bg-tricky-bg text-tricky-text`}
        >
          <span aria-hidden="true">💡 </span>Hint
        </button>
        <button
          type="button"
          disabled={!playing}
          onClick={() => setTyping(!typing)}
          className={`${pill} border border-slate-300 text-slate-600`}
        >
          {typing ? 'Use tiles' : 'Type instead'}
        </button>
      </div>
    </div>
  );
}
