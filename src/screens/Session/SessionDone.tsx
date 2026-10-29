import { Link } from 'react-router-dom';
import { WordPill } from '../../components/WordPill';
import type { SessionSummary } from './useSession';

interface Props {
  summary: SessionSummary;
  awardsHref: string;
  homeHref: string;
  onPlayAgain(): void;
}

export function SessionDone({ summary, awardsHref, homeHref, onPlayAgain }: Props) {
  const { streak, masteredToday, stillTricky, newBadges } = summary;
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-3xl font-bold text-primary">Nice work!</h1>

      <div className="flex flex-col items-center">
        <span aria-hidden className="text-7xl">🔥</span>
        <p className="text-4xl font-bold text-slate-800">
          {streak.current} day{streak.current === 1 ? '' : 's'}
        </p>
        <p className="text-slate-500">streak</p>
        {streak.isNewBest && <p className="mt-1 font-semibold text-tricky-text">New personal best!</p>}
      </div>

      <p className="text-lg text-slate-600">
        {summary.points} points · {summary.stars} ⭐
      </p>

      {newBadges.map((b) => (
        <div key={b.id} className="flex w-full items-center gap-4 rounded-3xl bg-primary p-4 text-left text-white shadow-sm">
          <span aria-hidden className="text-4xl">{b.emoji}</span>
          <div>
            <p className="text-sm uppercase tracking-wide opacity-80">New badge!</p>
            <p className="text-xl font-bold">{b.name}</p>
            <p className="opacity-90">{b.description}</p>
          </div>
        </div>
      ))}

      {masteredToday.length > 0 && (
        <section className="w-full rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-700">Mastered today</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {masteredToday.map((w) => (
              <WordPill key={w} tone="mastered">{w}</WordPill>
            ))}
          </div>
        </section>
      )}

      {stillTricky.length > 0 && (
        <section className="w-full rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700">Still tricky</h2>
          <p className="mb-3 text-sm text-slate-500">Coming back tomorrow</p>
          <div className="flex flex-wrap justify-center gap-2">
            {stillTricky.map((w) => (
              <WordPill key={w} tone="tricky">{w}</WordPill>
            ))}
          </div>
        </section>
      )}

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onPlayAgain}
          className="min-h-14 flex-1 rounded-full bg-primary px-6 text-lg font-semibold text-white transition active:scale-95"
        >
          Play again
        </button>
        <Link
          to={awardsHref}
          className="flex min-h-14 flex-1 items-center justify-center rounded-full border-2 border-primary px-6 text-lg font-semibold text-primary hover:bg-white"
        >
          See my awards
        </Link>
      </div>
      <Link to={homeHref} className="flex min-h-11 items-center font-semibold text-slate-500">
        Home
      </Link>
    </div>
  );
}
