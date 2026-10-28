import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import gradeWordsJson from '../../data/gradeWords.json';
import type { Repo } from '../../data/repo';
import { BADGES, evaluateBadges, type BadgeDef } from '../../engine/badges';
import { clampLevel, adaptGeneratedLevel } from '../../engine/difficulty';
import { loadDictionary } from '../../engine/dictionary';
import { summarize } from '../../engine/mastery';
import { makeMisspelling } from '../../engine/misspell';
import type { Rng } from '../../engine/rng';
import { computeStats, scoreAnswer, starsFor } from '../../engine/scoring';
import { makeScramble } from '../../engine/scramble';
import { selectSessionWords, type SessionWord } from '../../engine/selection';
import { computeStreak, localDate } from '../../engine/streak';
import type { Attempt, AttemptKind, Award, GameId, Profile, Session, WordList } from '../../engine/types';
import { normalizeWord } from '../../engine/words';

const GRADE_WORDS = gradeWordsJson as Record<string, string[]>;

export interface SessionSummary {
  masteredToday: string[];
  stillTricky: string[];
  points: number;
  stars: number;
  streak: { current: number; best: number; isNewBest: boolean };
  newBadges: BadgeDef[];
}

export interface RecordInput {
  word: string;
  kind: AttemptKind;
  ms: number | null;
  spotFix?: boolean;
}

export interface SessionOptions {
  mode?: 'normal' | 'extra';
  rng?: Rng;
  now?: () => Date;
}

export interface SessionState {
  words: SessionWord[];
  index: number;
  current: SessionWord | undefined; // undefined while loading and once done
  record(r: RecordInput): void;
  skip(): void;
  next(): void;
  done: boolean;
  loading: boolean;
  summary: SessionSummary;
  timerOn: boolean;
  allWords: string[]; // every word in the kid's lists, display casing
  fallbackWords: string[]; // grade words at the kid's generated level
}

interface Setup {
  profile: Profile;
  sessionId: string;
  startedAt: string;
  words: SessionWord[];
  trickyCount: number;
  priorAttempts: Attempt[];
  priorSessions: Session[];
  earned: Set<string>;
  allWords: string[];
  fallbackWords: string[];
}

const EMPTY_SUMMARY: SessionSummary = {
  masteredToday: [],
  stillTricky: [],
  points: 0,
  stars: 0,
  streak: { current: 0, best: 0, isNewBest: false },
  newBadges: [],
};

const ignore = () => {}; // Task 15's offline repo retries failed writes; until then a failed write is dropped.

function uniqueWords(lists: WordList[]): string[] {
  const seen = new Map<string, string>();
  for (const l of lists) for (const w of l.words) if (!seen.has(normalizeWord(w))) seen.set(normalizeWord(w), w);
  return [...seen.values()];
}

/** Which words this game can make a puzzle from. Without the dictionary, Spot can't check, so it allows all. */
async function usableFor(game: GameId, rng: Rng, allWords: string[]): Promise<(w: string) => boolean> {
  if (game === 'scramble') return (w) => makeScramble(w, rng) !== null;
  try {
    const dict = await loadDictionary();
    const avoid = new Set(allWords.map(normalizeWord));
    return (w) => makeMisspelling(w, { rng, isRealWord: (c) => dict.has(c), avoid }) !== null;
  } catch {
    return () => true;
  }
}

async function loadSetup(
  repo: Repo,
  fallback: Profile,
  game: GameId,
  mode: 'normal' | 'extra',
  rng: Rng,
  now: Date,
): Promise<Setup> {
  const id = fallback.id;
  const [profiles, lists, priorAttempts, priorSessions, awards] = await Promise.all([
    repo.listProfiles(),
    repo.listLists(id),
    repo.listAttempts(id),
    repo.listSessions(id),
    repo.listAwards(id),
  ]);
  // Read the stored profile so a level change from the last session is used.
  const profile = profiles.find((p) => p.id === id) ?? fallback;
  const allWords = uniqueWords(lists);
  const usable = await usableFor(game, rng, allWords);
  const words = selectSessionWords({
    lists,
    attempts: priorAttempts,
    today: localDate(now),
    generatedLevel: profile.generatedLevel,
    mode,
    usable,
    rng,
  });
  return {
    profile,
    sessionId: crypto.randomUUID(),
    startedAt: now.toISOString(),
    words,
    trickyCount: words.filter((w) => w.state === 'tricky').length,
    priorAttempts,
    priorSessions,
    earned: new Set(awards.map((a) => a.badgeId)),
    allWords,
    fallbackWords: GRADE_WORDS[String(clampLevel(profile.generatedLevel))] ?? [],
  };
}

export function useSession(game: GameId, opts: SessionOptions = {}): SessionState {
  const repo = useRepo();
  const { profile: activeProfile } = useActiveProfile();
  const mode = opts.mode ?? 'normal';
  const rngRef = useRef<Rng>(opts.rng ?? Math.random);
  const nowRef = useRef(opts.now ?? (() => new Date()));

  const [setup, setSetup] = useState<Setup | null>(null);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<SessionSummary>(EMPTY_SUMMARY);
  const recorded = useRef<Attempt[]>([]);
  const score = useRef({ points: 0, stars: 0 });
  const finished = useRef(false);

  useEffect(() => {
    if (!activeProfile) return;
    let live = true;
    loadSetup(repo, activeProfile, game, mode, rngRef.current, nowRef.current()).then(
      (s) => live && setSetup(s),
      ignore, // offline before Task 15: stay on the loading state
    );
    return () => {
      live = false;
    };
  }, [repo, activeProfile, game, mode]);

  const words = setup?.words ?? [];
  const done = setup !== null && index >= words.length;
  const current = setup && !done ? words[index] : undefined;

  const record = useCallback(
    (r: RecordInput) => {
      if (!setup) return;
      const key = normalizeWord(r.word);
      const sw = setup.words.find((w) => normalizeWord(w.word) === key);
      const ms = r.ms === null ? null : Math.round(r.ms);
      const at = nowRef.current();
      const attempt: Attempt = {
        id: crypto.randomUUID(),
        profileId: setup.profile.id,
        sessionId: setup.sessionId,
        word: key,
        listId: sw?.listId ?? null,
        game,
        kind: r.kind,
        ms,
        localDate: localDate(at),
        createdAt: at.toISOString(),
      };
      recorded.current.push(attempt);
      score.current.points += scoreAnswer({ kind: r.kind, ms, timerOn: setup.profile.timerOn });
      score.current.stars += starsFor({ kind: r.kind, spotFix: r.spotFix });
      repo.addAttempts([attempt]).catch(ignore);
    },
    [setup, repo, game],
  );

  const next = useCallback(() => setIndex((i) => i + 1), []);
  const skip = next; // a skipped word leaves no attempt

  useEffect(() => {
    if (!done || !setup || finished.current) return;
    finished.current = true;
    const end = nowRef.current();
    const today = localDate(end);
    const session: Session = {
      id: setup.sessionId,
      profileId: setup.profile.id,
      game,
      mode,
      startedAt: setup.startedAt,
      completedAt: end.toISOString(),
      localDate: today,
      points: score.current.points,
      stars: score.current.stars,
      trickyCount: setup.trickyCount,
    };
    const attempts = [...setup.priorAttempts, ...recorded.current];
    const sessions = [...setup.priorSessions, session];

    const before = summarize(setup.priorAttempts);
    const after = summarize(attempts);
    const practiced = new Set(recorded.current.map((a) => a.word));
    const wordsWhere = (test: (key: string) => boolean) =>
      setup.words.filter((w) => practiced.has(normalizeWord(w.word)) && test(normalizeWord(w.word))).map((w) => w.word);

    const priorDates = setup.priorSessions.filter((s) => s.completedAt !== null).map((s) => s.localDate);
    const priorBest = computeStreak(priorDates, today).best;
    const streak = computeStreak([...priorDates, today], today);

    const newIds = evaluateBadges(computeStats(attempts, sessions, today), setup.earned);
    setSummary({
      masteredToday: wordsWhere((k) => after.get(k) === 'mastered' && before.get(k) !== 'mastered'),
      stillTricky: wordsWhere((k) => after.get(k) === 'tricky'),
      points: session.points,
      stars: session.stars,
      // A first-ever streak of 1 isn't a "personal best" worth announcing.
      streak: { ...streak, isNewBest: priorBest > 0 && streak.best > priorBest },
      newBadges: BADGES.filter((b) => newIds.includes(b.id)),
    });

    repo.saveSession(session).catch(ignore);
    if (newIds.length > 0) {
      const awards: Award[] = newIds.map((badgeId) => ({
        profileId: setup.profile.id,
        badgeId,
        earnedAt: end.toISOString(),
      }));
      repo.addAwards(awards).catch(ignore);
    }
    try {
      const level = adaptGeneratedLevel(
        setup.profile.generatedLevel,
        attempts.filter((a) => a.listId === null),
      );
      if (level !== setup.profile.generatedLevel) {
        repo.saveProfile({ ...setup.profile, generatedLevel: level }).catch(ignore);
      }
    } catch {
      // the level update must never block the done screen
    }
  }, [done, setup, repo, game, mode]);

  return {
    words,
    index,
    current,
    record,
    skip,
    next,
    done,
    loading: setup === null,
    summary,
    timerOn: setup?.profile.timerOn ?? false,
    allWords: setup?.allWords ?? [],
    fallbackWords: setup?.fallbackWords ?? [],
  };
}
