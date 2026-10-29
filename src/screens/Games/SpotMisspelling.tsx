import { useEffect, useRef, useState, type FormEvent } from 'react';
import { loadDictionary } from '../../engine/dictionary';
import { makeMisspelling } from '../../engine/misspell';
import { seededRng, shuffle, type Rng } from '../../engine/rng';
import { normalizeWord } from '../../engine/words';
import type { GameProps } from '../Session/games';

const SUCCESS_MS = 600;
const REVEAL_MS = 2000;
const CHOICES = 4;

interface Round {
  choices: string[];
  misspelling: string;
}

// The misspelled target plus correct distractors (the kid's own words first, then grade words), shuffled.
function buildRound(word: string, allWords: string[], fallbackWords: string[], dict: Set<string>, rng: Rng): Round | null {
  const target = normalizeWord(word);
  const avoid = new Set(allWords.map(normalizeWord));
  const misspelling = makeMisspelling(word, { rng, isRealWord: (w) => dict.has(w), avoid });
  if (misspelling === null) return null;
  const seen = new Set([target, normalizeWord(misspelling)]);
  const distractors: string[] = [];
  for (const pool of [shuffle(allWords, rng), shuffle(fallbackWords, rng)]) {
    for (const w of pool) {
      if (distractors.length === CHOICES - 1) break;
      const key = normalizeWord(w);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(w);
    }
  }
  return { choices: shuffle([misspelling, ...distractors], rng), misspelling };
}

type Stage =
  | 'choose' // waiting for a tap
  | 'missed' // wrong tap: showing the correct spelling
  | 'fix' // correct tap: the bonus text box is open
  | 'fixed' // correct fix: success flash
  | 'revealed'; // wrong or skipped fix: showing the correct spelling

// `dictionary` and `seed` are test hooks: otherwise the dictionary is loaded and each mount gets a fresh rng.
export function SpotMisspelling({
  word,
  allWords,
  fallbackWords,
  onResult,
  onSkip,
  dictionary,
  seed,
}: GameProps & { dictionary?: Set<string>; seed?: number }) {
  const [round, setRound] = useState<Round | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [tapped, setTapped] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const alive = useRef(true);
  const callbacks = useRef({ onSkip, allWords, fallbackWords });
  useEffect(() => {
    callbacks.current = { onSkip, allWords, fallbackWords };
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the round is built once per mount
    started.current = true;
    const rng = seededRng(seed ?? Math.floor(Math.random() * 2 ** 32));
    (dictionary ? Promise.resolve(dictionary) : loadDictionary()).then(
      (dict) => {
        if (!alive.current) return;
        const r = buildRound(word.word, callbacks.current.allWords, callbacks.current.fallbackWords, dict, rng);
        if (r === null) callbacks.current.onSkip();
        else setRound(r);
      },
      () => {
        if (alive.current) callbacks.current.onSkip(); // the shell checks the dictionary at setup; this is a safety net
      },
    );
  }, [word.word, dictionary, seed]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  if (round === null) return <p className="text-center text-lg font-semibold text-slate-600">Getting your word ready...</p>;

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const choosing = stage === 'choose';
  const fixing = stage === 'fix';

  function tap(choice: string) {
    if (!choosing) return;
    setTapped(choice);
    if (choice === round!.misspelling) {
      onResult({ kind: 'practice' }); // does not end the word
      setStage('fix');
    } else {
      setStage('missed');
      later(REVEAL_MS, () => onResult({ kind: 'miss' }));
    }
  }

  function reveal() {
    setStage('revealed');
    later(REVEAL_MS, onSkip);
  }

  function submitFix(e: FormEvent) {
    e.preventDefault();
    if (!fixing || !typed.trim()) return;
    if (normalizeWord(typed) === normalizeWord(word.word)) {
      setStage('fixed');
      later(SUCCESS_MS, () => onResult({ kind: 'clean', spotFix: true }));
    } else {
      reveal();
    }
  }

  function choiceClass(choice: string) {
    const real = choice === round!.misspelling;
    if (stage === 'fix' || stage === 'fixed' || stage === 'revealed') {
      return real ? 'border-mastered bg-mastered-bg text-mastered-text' : 'border-slate-200 bg-white text-slate-400';
    }
    if (stage === 'missed') {
      if (real) return 'border-mastered bg-mastered-bg text-mastered-text';
      if (choice === tapped) return 'border-tricky bg-tricky-bg text-tricky-text';
      return 'border-slate-200 bg-white text-slate-400';
    }
    return 'border-slate-300 bg-white text-slate-800 active:scale-95';
  }

  const pill = 'min-h-12 rounded-full px-6 text-lg font-semibold transition active:scale-95 disabled:opacity-40';

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-semibold text-slate-600">Which word is spelled wrong?</p>

      <div className="grid w-full max-w-md grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {round.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={!choosing}
            onClick={() => tap(choice)}
            className={`min-h-16 rounded-2xl border-2 px-4 text-2xl font-semibold transition ${choiceClass(choice)}`}
          >
            {choice}
          </button>
        ))}
      </div>

      {(fixing || stage === 'fixed') && (
        <form onSubmit={submitFix} className="flex w-full max-w-sm flex-col items-center gap-3">
          <label htmlFor="spot-fix" className="text-lg font-semibold text-slate-700">
            Fix it for a bonus <span aria-hidden="true">⭐</span>
          </label>
          <input
            id="spot-fix"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!fixing}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`min-h-14 w-full rounded-2xl border-2 px-4 text-center text-2xl font-semibold outline-none focus:border-primary ${
              stage === 'fixed' ? 'border-mastered bg-mastered-bg text-mastered-text' : 'border-slate-300'
            }`}
          />
          <div className="flex w-full gap-3">
            <button type="submit" disabled={!fixing || !typed.trim()} className={`${pill} flex-1 bg-primary text-white`}>
              Check
            </button>
            <button
              type="button"
              disabled={!fixing}
              onClick={reveal}
              className={`${pill} border border-slate-300 text-slate-600`}
            >
              Skip
            </button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="min-h-8 text-center text-xl font-bold">
        {stage === 'fix' && <p className="text-mastered-text">Right! That one is wrong.</p>}
        {stage === 'fixed' && <p className="text-mastered-text">Great fix! ⭐</p>}
        {(stage === 'missed' || stage === 'revealed') && (
          <p className="text-tricky-text">
            The word is <span className="text-2xl">{word.word}</span>
          </p>
        )}
      </div>
    </div>
  );
}
