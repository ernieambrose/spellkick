import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { ProgressBar } from '../../components/ProgressBar';
import { WordPill } from '../../components/WordPill';
import { summarize } from '../../engine/mastery';
import { currentList } from '../../engine/selection';
import { computeStreak, localDate } from '../../engine/streak';
import type { Attempt, Session, WordList, WordState } from '../../engine/types';
import { normalizeWord } from '../../engine/words';
import { countdownText } from './countdown';

interface HomeData {
  lists: WordList[];
  attempts: Attempt[];
  sessions: Session[];
}

const unique = (words: string[]) => [...new Set(words.map(normalizeWord))];

const gameButton =
  'flex min-h-16 items-center gap-4 rounded-3xl px-6 text-xl font-bold shadow-sm transition hover:shadow-md active:scale-[0.98]';

export function KidHome() {
  const repo = useRepo();
  const { profile, activeId, clear } = useActiveProfile();
  const navigate = useNavigate();
  const [data, setData] = useState<HomeData | null>(null);
  const [today] = useState(() => localDate(new Date()));

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    Promise.all([repo.listLists(activeId), repo.listAttempts(activeId), repo.listSessions(activeId)]).then(
      ([lists, attempts, sessions]) => live && setData({ lists, attempts, sessions }),
      () => {}, // couldn't load: show the home without stats
    );
    return () => {
      live = false;
    };
  }, [repo, activeId]);

  const lists = data?.lists ?? [];
  const states = summarize(data?.attempts ?? []);
  const stateOf = (w: string): WordState => states.get(w) ?? 'new';
  const cur = currentList(lists, today);
  const curWords = unique(cur?.words ?? []);
  const curMastered = curWords.filter((w) => stateOf(w) === 'mastered').length;
  const allWords = unique(lists.flatMap((l) => l.words));
  const reviewWords = unique(lists.filter((l) => l !== cur).flatMap((l) => l.words)).filter(
    (w) => !curWords.includes(w) && stateOf(w) !== 'mastered',
  );
  const streak = computeStreak(
    (data?.sessions ?? []).filter((s) => s.completedAt !== null).map((s) => s.localDate),
    today,
  ).current;
  const base = `/kid/${activeId}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        {profile && <h1 className="text-3xl font-bold text-primary sm:text-4xl">Hi, {profile.name}!</h1>}
        {streak > 0 && (
          <span className="text-2xl font-bold text-tricky-text" aria-label={`${streak} day streak`}>
            🔥 {streak}
          </span>
        )}
      </div>

      {cur && (
        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-800">{cur.name}</h2>
            {cur.testDate && (
              <span className="font-semibold text-primary">{countdownText(cur.testDate, today)}</span>
            )}
          </div>
          <div className="mt-4">
            <ProgressBar
              value={curMastered}
              max={curWords.length}
              label="Words mastered"
            />
            <p className="mt-2 text-slate-600">
              {curMastered} of {curWords.length} mastered
            </p>
          </div>
        </section>
      )}

      {allWords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <WordPill tone="mastered">{allWords.filter((w) => stateOf(w) === 'mastered').length} mastered</WordPill>
          <WordPill tone="tricky">{allWords.filter((w) => stateOf(w) === 'tricky').length} tricky</WordPill>
          <WordPill tone="review">{reviewWords.length} to review</WordPill>
        </div>
      )}

      <nav className="flex flex-col gap-3" aria-label="Games">
        <Link to={`${base}/play/scramble`} className={`${gameButton} bg-primary text-white`}>
          <span aria-hidden>🔀</span> Scramble
        </Link>
        <Link to={`${base}/play/misspell`} className={`${gameButton} bg-primary text-white`}>
          <span aria-hidden>🔍</span> Spot the Misspelling
        </Link>
        <Link to={`${base}/play/scramble?mode=extra`} className={`${gameButton} bg-white text-primary`}>
          <span aria-hidden>➕</span> Practice extra words
        </Link>
      </nav>

      <div className="mt-auto flex flex-wrap justify-between gap-3">
        <Link
          to={`${base}/awards`}
          className="flex min-h-11 items-center rounded-full bg-review-bg px-6 font-semibold text-review-text"
        >
          🏆 Awards
        </Link>
        <button
          type="button"
          onClick={() => {
            clear();
            navigate('/profiles');
          }}
          className="min-h-11 rounded-full border border-slate-300 px-6 font-semibold text-slate-600 hover:bg-white"
        >
          Switch kid
        </button>
      </div>
    </main>
  );
}
