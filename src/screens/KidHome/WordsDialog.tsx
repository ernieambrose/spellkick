import { useEffect, useRef } from 'react';
import { type PillTone, WordPill } from '../../components/WordPill';

const TITLES: Record<PillTone, string> = {
  mastered: 'Mastered words',
  tricky: 'Tricky words',
  review: 'Words to review',
};

const BLURBS: Record<PillTone, string> = {
  mastered: 'You spelled these right on 3 different days. Nice!',
  tricky: "These keep coming back until you've got them.",
  review: 'Older words that get mixed into your practice.',
};

// The words behind one of the home counts. Look only: the app still picks what to practice.
export function WordsDialog({ tone, words, onClose }: { tone: PillTone; words: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Focus the Close button when it opens, close on Escape, and give focus back to the count after.
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      back?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[tone]}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-800">{TITLES[tone]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 px-5 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-slate-600">{BLURBS[tone]}</p>
        <ul className="mt-4 flex flex-wrap gap-2 overflow-y-auto">
          {words.map((w) => (
            <li key={w}>
              <WordPill tone={tone}>{w}</WordPill>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
