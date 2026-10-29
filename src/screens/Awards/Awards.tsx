import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { ProgressBar } from '../../components/ProgressBar';
import { BADGES, type BadgeDef } from '../../engine/badges';
import { computeStats, type Stats } from '../../engine/scoring';
import { localDate } from '../../engine/streak';

interface AwardsData {
  earned: Set<string>;
  stats: Stats;
}

/** The unearned badge closest to its goal (highest value/goal); ties go to catalog order. */
function nextUp(stats: Stats, earned: Set<string>): { badge: BadgeDef; value: number; goal: number } | null {
  let best: { badge: BadgeDef; value: number; goal: number } | null = null;
  for (const badge of BADGES) {
    if (earned.has(badge.id)) continue;
    const { value, goal } = badge.progress(stats);
    if (!best || value / goal > best.value / best.goal) best = { badge, value, goal };
  }
  return best;
}

export function Awards() {
  const repo = useRepo();
  const { activeId } = useActiveProfile();
  const [data, setData] = useState<AwardsData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    Promise.all([repo.listAwards(activeId), repo.listAttempts(activeId), repo.listSessions(activeId)]).then(
      ([awards, attempts, sessions]) =>
        live &&
        setData({
          earned: new Set(awards.map((a) => a.badgeId)),
          stats: computeStats(attempts, sessions, localDate(new Date())),
        }),
      () => live && setLoadFailed(true), // offline with nothing cached
    );
    return () => {
      live = false;
    };
  }, [repo, activeId]);

  const earned = data?.earned ?? new Set<string>();
  const next = data ? nextUp(data.stats, earned) : null;

  const backLink = (
    <Link
      to={`/kid/${activeId}`}
      className="flex min-h-11 items-center rounded-full border border-slate-300 px-6 font-semibold text-slate-600 hover:bg-white"
    >
      ← Back
    </Link>
  );

  if (loadFailed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
        <h1 className="text-3xl font-bold text-primary sm:text-4xl">Awards</h1>
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-700">Can't load your awards right now.</p>
          <p className="mt-1 text-slate-500">Check your connection and try again in a bit.</p>
          <Link
            to={`/kid/${activeId}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-6 font-semibold text-white"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-primary sm:text-4xl">Awards</h1>
        {backLink}
      </div>

      {data ? (
        <p className="text-xl font-semibold text-slate-700">
          {earned.size} of {BADGES.length} earned
        </p>
      ) : (
        <div role="status" aria-label="Loading your awards" className="h-7 w-40 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
      )}

      {next && (
        <section aria-label="Next up" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Next up</h2>
          <div className="mt-3 flex items-center gap-4">
            <span aria-hidden className="text-4xl">{next.badge.emoji}</span>
            <div>
              <p className="text-xl font-bold text-slate-800">{next.badge.name}</p>
              <p className="text-slate-600">{next.badge.description}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={next.value} max={next.goal} label={`${next.badge.name} progress`} />
            <p className="mt-2 text-slate-600">
              {next.value} of {next.goal}
            </p>
          </div>
        </section>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!data &&
          BADGES.map((b) => (
            <li key={b.id} aria-hidden className="h-36 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
          ))}
        {data && BADGES.map((b) => {
          const isEarned = earned.has(b.id);
          return (
            <li
              key={b.id}
              aria-label={isEarned ? b.name : `${b.name} (locked)`}
              className={`flex flex-col items-center gap-1 rounded-3xl p-4 text-center shadow-sm ${
                isEarned ? 'bg-white' : 'bg-slate-100 opacity-60 grayscale'
              }`}
            >
              <span aria-hidden className="text-4xl">{b.emoji}</span>
              <p className="font-bold text-slate-800">{b.name}</p>
              <p className="text-sm text-slate-600">{b.description}</p>
              {!isEarned && <p className="text-xs font-semibold uppercase text-slate-500">Locked</p>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
