import type { ReactNode } from 'react';

export type PillTone = 'mastered' | 'tricky' | 'review';

const TONES: Record<PillTone, string> = {
  mastered: 'bg-mastered-bg text-mastered-text',
  tricky: 'bg-tricky-bg text-tricky-text',
  review: 'bg-review-bg text-review-text',
};

const PILL = 'inline-flex min-h-9 items-center rounded-full px-4 text-base font-semibold';

// A rounded pill in a word-state color: a word, or a count like "5 mastered".
// With onClick it becomes a button (e.g. tap a count to see its words).
export function WordPill({ tone, children, onClick }: { tone: PillTone; children: ReactNode; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${PILL} ${TONES[tone]} min-h-11 shadow-sm transition hover:shadow-md active:scale-[0.97]`}
      >
        {children}
      </button>
    );
  }
  return <span className={`${PILL} ${TONES[tone]}`}>{children}</span>;
}
