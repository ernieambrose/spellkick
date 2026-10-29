import { deriveWordState, summarize } from './mastery';
import { computeStreak } from './streak';
import type { Attempt, AttemptKind, Session } from './types';
import { normalizeWord } from './words';

const BASE_POINTS: Record<AttemptKind, number> = { clean: 10, hinted: 5, practice: 3, miss: 0 };

export function scoreAnswer(a: { kind: AttemptKind; ms: number | null; timerOn: boolean }): number {
  let points = BASE_POINTS[a.kind];
  if (a.timerOn && a.kind === 'clean' && a.ms !== null) {
    if (a.ms <= 5000) points += 5;
    else if (a.ms <= 10000) points += 2;
  }
  return points;
}

export function starsFor(a: { kind: AttemptKind; spotFix?: boolean }): number {
  if (a.kind !== 'clean') return 0;
  return a.spotFix ? 2 : 1;
}

export type Stats = {
  sessions: number;
  streakBest: number;
  mastered: number;
  comebacks: number;
  stars: number;
  trickySessions: number;
};

const TRICKY_SESSION_MIN = 3;

export function computeStats(attempts: Attempt[], sessions: Session[], today: string): Stats {
  const done = sessions.filter((s) => s.completedAt !== null);

  const byWord = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const key = normalizeWord(a.word);
    const list = byWord.get(key);
    if (list) list.push(a);
    else byWord.set(key, [a]);
  }

  let comebacks = 0;
  for (const list of byWord.values()) {
    const ordered = [...list].sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt));
    if (deriveWordState(ordered) !== 'mastered') continue;
    let wasTricky = false;
    for (let i = 1; i <= ordered.length && !wasTricky; i++) {
      wasTricky = deriveWordState(ordered.slice(0, i)) === 'tricky';
    }
    if (wasTricky) comebacks++;
  }

  return {
    sessions: done.length,
    streakBest: computeStreak(
      done.map((s) => s.localDate),
      today,
    ).best,
    mastered: [...summarize(attempts).values()].filter((s) => s === 'mastered').length,
    comebacks,
    stars: done.reduce((n, s) => n + s.stars, 0),
    trickySessions: done.filter((s) => s.trickyCount >= TRICKY_SESSION_MIN).length,
  };
}
