export type AttemptKind = 'clean' | 'hinted' | 'miss' | 'practice';
export type GameId = 'scramble' | 'misspell';
export type WordState = 'new' | 'learning' | 'tricky' | 'mastered';
export type Theme = 'default' | 'skate' | 'fishing' | 'art';
export type ListSource = 'school' | 'parent' | 'teacher' | 'other';

// ids are crypto.randomUUID() strings; dates are YYYY-MM-DD; timestamps are ISO strings.

export interface Profile {
  id: string;
  name: string;
  grade: number; // 1-8
  generatedLevel: number;
  pinHash: string | null;
  timerOn: boolean;
  theme: Theme;
  createdAt: string;
}

export interface WordList {
  id: string;
  profileId: string;
  name: string;
  testDate: string | null;
  source: ListSource;
  author: string | null;
  words: string[]; // parent casing, <= 100
  createdAt: string;
}

export interface Attempt {
  id: string;
  profileId: string;
  sessionId: string;
  word: string; // normalizeWord form
  listId: string | null; // null = generated-pool word
  game: GameId;
  kind: AttemptKind;
  ms: number | null;
  localDate: string;
  createdAt: string;
}

export interface Session {
  id: string;
  profileId: string;
  game: GameId;
  mode: 'normal' | 'extra';
  startedAt: string;
  completedAt: string | null;
  localDate: string;
  points: number;
  stars: number;
  trickyCount: number; // words that were tricky at start
}

export interface Award {
  profileId: string;
  badgeId: string;
  earnedAt: string;
}

// What pure engine functions accept, so tests can pass minimal objects.
export type AttemptLike = Pick<Attempt, 'word' | 'kind' | 'localDate' | 'createdAt'>;
