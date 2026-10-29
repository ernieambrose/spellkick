import { useEffect, useState } from 'react';

const PIN_LENGTH = 4;
const MAX_TRIES = 3;
const COOLDOWN_MS = 30_000;

// Kept outside the component so closing and reopening the pad doesn't reset the cooldown.
const locks = new Map<string, { fails: number; until: number }>();

// Counts a wrong try; the third starts the cooldown. Returns the time it was recorded.
function recordFailure(key: string): { at: number; lockedNow: boolean } {
  const at = Date.now();
  const fails = (locks.get(key)?.fails ?? 0) + 1;
  const lockedNow = fails >= MAX_TRIES;
  locks.set(key, { fails: lockedNow ? 0 : fails, until: lockedNow ? at + COOLDOWN_MS : 0 });
  return { at, lockedNow };
}

interface Props {
  title: string;
  lockKey: string; // whose PIN this is; wrong tries and cooldowns are tracked per key
  onSubmit(pin: string): boolean | Promise<boolean>; // true = correct
  onCancel(): void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

export function PinPad({ title, lockKey, onSubmit, onCancel }: Props) {
  const [digits, setDigits] = useState('');
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now);

  const remaining = Math.ceil(((locks.get(lockKey)?.until ?? 0) - now) / 1000);
  const locked = remaining > 0;

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  function fail() {
    const { at, lockedNow } = recordFailure(lockKey);
    setNow(at);
    setDigits('');
    setWrong(!lockedNow);
    setChecking(false);
  }

  function submit(pin: string) {
    setChecking(true);
    Promise.resolve(onSubmit(pin)).then(
      (ok) => {
        if (!ok) return fail();
        locks.delete(lockKey);
        setChecking(false);
      },
      () => fail(),
    );
  }

  function press(key: string) {
    if (locked || checking) return;
    setWrong(false);
    if (key === 'back') return setDigits((d) => d.slice(0, -1));
    const next = digits + key;
    setDigits(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  return (
    <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl">
      <h2 className="text-center text-xl font-bold text-slate-800">{title}</h2>

      <div className="my-5 flex justify-center gap-4" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-primary ${i < digits.length ? 'bg-primary' : ''}`}
          />
        ))}
      </div>

      <p role="status" className="mb-3 h-6 text-center font-semibold text-tricky-text">
        {locked ? `Too many tries. Wait ${remaining}s` : wrong ? 'Try again' : ''}
      </p>

      <div className="grid grid-cols-3 justify-items-center gap-3">
        {KEYS.map((key, i) =>
          key === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={locked}
              aria-label={key === 'back' ? 'Backspace' : undefined}
              className="h-16 w-16 rounded-full bg-review-bg text-2xl font-bold text-review-text transition active:scale-95 disabled:opacity-40"
            >
              {key === 'back' ? '⌫' : key}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-5 min-h-11 w-full rounded-xl font-semibold text-slate-500 hover:bg-slate-100"
      >
        Cancel
      </button>
    </div>
  );
}
