import type { GameProps } from './games';

const button = 'min-h-14 rounded-2xl px-6 text-lg font-semibold transition active:scale-95';

// Stand-in until the real games land (Tasks 13-14): shows the word and reports a chosen result.
export function PlaceholderGame({ word, onResult, onSkip }: GameProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-4xl font-bold text-slate-800">{word.word}</p>
      <div className="grid w-full grid-cols-3 gap-3">
        <button type="button" onClick={() => onResult({ kind: 'clean' })} className={`${button} bg-mastered-bg text-mastered-text`}>
          Correct
        </button>
        <button type="button" onClick={() => onResult({ kind: 'hinted' })} className={`${button} bg-review-bg text-review-text`}>
          Hinted
        </button>
        <button type="button" onClick={() => onResult({ kind: 'miss' })} className={`${button} bg-tricky-bg text-tricky-text`}>
          Miss
        </button>
      </div>
      <button type="button" onClick={onSkip} className="min-h-11 rounded-full px-6 font-semibold text-slate-500 hover:bg-white">
        Skip
      </button>
    </div>
  );
}
