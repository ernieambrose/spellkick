import type { Attempt, AttemptKind, Award, GameId, ListSource, Profile, Session, Theme, WordList } from '../engine/types';

// Row shapes match supabase/migrations/0001_init.sql. `owner` is set by the database default
// (auth.uid()), so it is never written and is ignored when reading.

export interface ProfileRow {
  id: string;
  name: string;
  grade: number;
  generated_level: number;
  pin_hash: string | null;
  timer_on: boolean;
  theme: string;
  created_at: string;
}

export interface WordListRow {
  id: string;
  profile_id: string;
  name: string;
  test_date: string | null;
  source: string;
  author: string | null;
  words: string[];
  created_at: string;
}

export interface AttemptRow {
  id: string;
  profile_id: string;
  session_id: string;
  word: string;
  list_id: string | null;
  game: string;
  kind: string;
  ms: number | null;
  local_date: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  profile_id: string;
  game: string;
  mode: string;
  started_at: string;
  completed_at: string | null;
  local_date: string;
  points: number;
  stars: number;
  tricky_count: number;
}

export interface AwardRow {
  profile_id: string;
  badge_id: string;
  earned_at: string;
}

export const profileToRow = (p: Profile): ProfileRow => ({
  id: p.id,
  name: p.name,
  grade: p.grade,
  generated_level: p.generatedLevel,
  pin_hash: p.pinHash,
  timer_on: p.timerOn,
  theme: p.theme,
  created_at: p.createdAt,
});

export const profileFromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  grade: r.grade,
  generatedLevel: r.generated_level,
  pinHash: r.pin_hash,
  timerOn: r.timer_on,
  theme: r.theme as Theme,
  createdAt: r.created_at,
});

export const listToRow = (l: WordList): WordListRow => ({
  id: l.id,
  profile_id: l.profileId,
  name: l.name,
  test_date: l.testDate,
  source: l.source,
  author: l.author,
  words: l.words,
  created_at: l.createdAt,
});

export const listFromRow = (r: WordListRow): WordList => ({
  id: r.id,
  profileId: r.profile_id,
  name: r.name,
  testDate: r.test_date,
  source: r.source as ListSource,
  author: r.author,
  words: r.words,
  createdAt: r.created_at,
});

export const attemptToRow = (a: Attempt): AttemptRow => ({
  id: a.id,
  profile_id: a.profileId,
  session_id: a.sessionId,
  word: a.word,
  list_id: a.listId,
  game: a.game,
  kind: a.kind,
  ms: a.ms,
  local_date: a.localDate,
  created_at: a.createdAt,
});

export const attemptFromRow = (r: AttemptRow): Attempt => ({
  id: r.id,
  profileId: r.profile_id,
  sessionId: r.session_id,
  word: r.word,
  listId: r.list_id,
  game: r.game as GameId,
  kind: r.kind as AttemptKind,
  ms: r.ms,
  localDate: r.local_date,
  createdAt: r.created_at,
});

export const sessionToRow = (s: Session): SessionRow => ({
  id: s.id,
  profile_id: s.profileId,
  game: s.game,
  mode: s.mode,
  started_at: s.startedAt,
  completed_at: s.completedAt,
  local_date: s.localDate,
  points: s.points,
  stars: s.stars,
  tricky_count: s.trickyCount,
});

export const sessionFromRow = (r: SessionRow): Session => ({
  id: r.id,
  profileId: r.profile_id,
  game: r.game as GameId,
  mode: r.mode as Session['mode'],
  startedAt: r.started_at,
  completedAt: r.completed_at,
  localDate: r.local_date,
  points: r.points,
  stars: r.stars,
  trickyCount: r.tricky_count,
});

export const awardToRow = (a: Award): AwardRow => ({
  profile_id: a.profileId,
  badge_id: a.badgeId,
  earned_at: a.earnedAt,
});

export const awardFromRow = (r: AwardRow): Award => ({
  profileId: r.profile_id,
  badgeId: r.badge_id,
  earnedAt: r.earned_at,
});
