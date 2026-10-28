import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRepo } from '../../app/repoContext';
import { summarize } from '../../engine/mastery';
import { computeStreak, localDate } from '../../engine/streak';
import type { Attempt, Profile, Session, WordList, WordState } from '../../engine/types';
import { normalizeWord } from '../../engine/words';
import { groupLists } from './listGroups';
import { Card, ParentPage } from './ui';

interface Data {
  profile: Profile;
  lists: WordList[];
  attempts: Attempt[];
  sessions: Session[];
  now: Date; // captured at load, so renders stay pure
}

const STATES: { state: WordState; label: string; pill: string }[] = [
  { state: 'mastered', label: 'Mastered', pill: 'bg-mastered-bg text-mastered-text' },
  { state: 'tricky', label: 'Tricky', pill: 'bg-tricky-bg text-tricky-text' },
  { state: 'learning', label: 'Learning', pill: 'bg-slate-100 text-slate-700' },
  { state: 'new', label: 'New', pill: 'bg-white text-slate-500 ring-1 ring-slate-200' },
];
const pillClass = (s: WordState) => STATES.find((x) => x.state === s)!.pill;

// The last 7 local dates, oldest first, ending today.
function lastSevenDays(now: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i), 12)),
  );
}

export function ProgressView() {
  const { profileId } = useParams();
  const repo = useRepo();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const profile = (await repo.listProfiles()).find((p) => p.id === profileId);
      if (!profile) throw new Error('not found');
      const [lists, attempts, sessions] = await Promise.all([
        repo.listLists(profile.id),
        repo.listAttempts(profile.id),
        repo.listSessions(profile.id),
      ]);
      return { profile, lists, attempts, sessions, now: new Date() };
    })().then(
      (d) => live && setData(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [repo, profileId]);

  if (failed) {
    return (
      <ParentPage title="Progress">
        <p className="text-tricky-text">Couldn't load this kid's progress.</p>
      </ParentPage>
    );
  }
  if (!data) return null;

  const { now } = data;
  const today = localDate(now);
  const summary = summarize(data.attempts);
  const stateOf = (w: string): WordState => summary.get(normalizeWord(w)) ?? 'new';

  // Every word the kid has met: all list words plus any practiced word.
  const allWords = new Set(summary.keys());
  for (const l of data.lists) for (const w of l.words) allWords.add(normalizeWord(w));
  const counts = new Map<WordState, number>(STATES.map((s) => [s.state, 0]));
  for (const w of allWords) counts.set(stateOf(w), counts.get(stateOf(w))! + 1);

  const completed = data.sessions.filter((s) => s.completedAt !== null);
  const streak = computeStreak(completed.map((s) => s.localDate), today);
  const perDay = new Map<string, number>();
  for (const s of completed) perDay.set(s.localDate, (perDay.get(s.localDate) ?? 0) + 1);

  const { upcoming, earlier } = groupLists(data.lists, today);

  return (
    <ParentPage title={`${data.profile.name}'s progress`}>
      <Card>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-lg text-slate-700">
          <p>
            Current streak <strong className="text-2xl text-primary">{streak.current}</strong>
          </p>
          <p>
            Best streak <strong className="text-2xl text-primary">{streak.best}</strong>
          </p>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {STATES.map((s) => (
            <li key={s.state} className={`rounded-full px-4 py-2 font-semibold ${s.pill}`}>
              {`${s.label} ${counts.get(s.state)}`}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold text-slate-800">Last 7 days</h2>
        <ol className="grid grid-cols-7 gap-2">
          {lastSevenDays(now).map((day) => {
            const n = perDay.get(day) ?? 0;
            const weekday = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <li key={day} className="flex flex-col items-center gap-1" aria-label={`${day}: ${n} sessions`}>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                    n > 0 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {n > 0 ? n : ''}
                </span>
                <span className="text-xs text-slate-500">{weekday}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      {[...upcoming, ...earlier].map((l) => (
        <Card key={l.id}>
          <h2 className="text-lg font-bold text-slate-800">
            {l.name}
            {l.testDate && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {l.testDate >= today ? 'Upcoming test' : 'Test'} {l.testDate}
              </span>
            )}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {l.words.map((w) => (
              <li key={w} className={`rounded-full px-3 py-1 ${pillClass(stateOf(w))}`}>
                {w}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {data.lists.length === 0 && <p className="text-slate-500">No word lists yet.</p>}
    </ParentPage>
  );
}
