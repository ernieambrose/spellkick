import type { ReactNode } from 'react';

export type PillTone = 'mastered' | 'tricky' | 'review';

const TONES: Record<PillTone, string> = {
  mastered: 'bg-mastered-bg text-mastered-text',
  tricky: 'bg-tricky-bg text-tricky-text',
  review: 'bg-review-bg text-review-text',
};

// A rounded pill in a word-state color: a word, or a count like "5 mastered".
export function WordPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex min-h-9 items-center rounded-full px-4 text-base font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
