import { computeStats, scoreAnswer, starsFor } from '../../src/engine/scoring';
import type { Attempt, AttemptKind, Session } from '../../src/engine/types';

const att = (word: string, kind: AttemptKind, day: string): Attempt => ({
  id: `${word}-${kind}-${day}`,
  profileId: 'p',
  sessionId: 's',
  word,
  listId: null,
  game: 'scramble',
  kind,
  ms: null,
  localDate: day,
  createdAt: `${day}T12:00:00Z`,
});

const sess = (over: Partial<Session>): Session => ({
  id: 's',
  profileId: 'p',
  game: 'scramble',
  mode: 'normal',
  startedAt: '2026-11-01T12:00:00Z',
  completedAt: '2026-11-01T12:10:00Z',
  localDate: '2026-11-01',
  points: 0,
  stars: 0,
  trickyCount: 0,
  ...over,
});

describe('scoreAnswer', () => {
  it('timer adds bonus only to clean answers', () => {
    expect(scoreAnswer({ kind: 'clean', ms: 3000, timerOn: true })).toBe(15);
    expect(scoreAnswer({ kind: 'clean', ms: 3000, timerOn: false })).toBe(10);
    expect(scoreAnswer({ kind: 'hinted', ms: 1000, timerOn: true })).toBe(5);
    expect(scoreAnswer({ kind: 'clean', ms: 60000, timerOn: true })).toBe(10);
  });
  it('speed tiers and boundaries', () => {
    expect(scoreAnswer({ kind: 'clean', ms: 5000, timerOn: true })).toBe(15);
    expect(scoreAnswer({ kind: 'clean', ms: 5001, timerOn: true })).toBe(12);
    expect(scoreAnswer({ kind: 'clean', ms: 10000, timerOn: true })).toBe(12);
    expect(scoreAnswer({ kind: 'clean', ms: 10001, timerOn: true })).toBe(10);
    expect(scoreAnswer({ kind: 'clean', ms: null, timerOn: true })).toBe(10);
  });
  it('base values', () => {
    expect(scoreAnswer({ kind: 'practice', ms: 1, timerOn: true })).toBe(3);
    expect(scoreAnswer({ kind: 'miss', ms: 1, timerOn: true })).toBe(0);
  });
});

describe('starsFor', () => {
  it('one star per clean, one more for a spot fix', () => {
    expect(starsFor({ kind: 'clean' })).toBe(1);
    expect(starsFor({ kind: 'clean', spotFix: true })).toBe(2);
    expect(starsFor({ kind: 'hinted', spotFix: true })).toBe(0);
    expect(starsFor({ kind: 'miss' })).toBe(0);
  });
});

describe('computeStats', () => {
  it('counts a comeback when a tricky word becomes mastered', () => {
    const attempts = [
      att('rhythm', 'miss', '2026-11-01'),
      att('rhythm', 'clean', '2026-11-02'),
      att('rhythm', 'clean', '2026-11-03'),
      att('rhythm', 'clean', '2026-11-04'),
    ];
    const s = computeStats(attempts, [], '2026-11-04');
    expect(s.comebacks).toBe(1);
    expect(s.mastered).toBe(1);
  });
  it('no comeback for a word never tricky', () => {
    const attempts = ['01', '02', '03'].map((d) => att('cat', 'clean', `2026-11-${d}`));
    const s = computeStats(attempts, [], '2026-11-03');
    expect(s.comebacks).toBe(0);
    expect(s.mastered).toBe(1);
  });
  it('no comeback while still tricky', () => {
    const s = computeStats([att('rhythm', 'miss', '2026-11-01')], [], '2026-11-01');
    expect(s.comebacks).toBe(0);
    expect(s.mastered).toBe(0);
  });
  it('derives session stats from completed sessions only', () => {
    const sessions = [
      sess({ id: 'a', localDate: '2026-11-01', stars: 4, trickyCount: 3 }),
      sess({ id: 'b', localDate: '2026-11-02', stars: 6, trickyCount: 2 }),
      sess({ id: 'c', localDate: '2026-11-03', stars: 9, trickyCount: 5, completedAt: null }),
    ];
    const s = computeStats([], sessions, '2026-11-03');
    expect(s).toEqual({
      sessions: 2,
      streakBest: 2,
      mastered: 0,
      comebacks: 0,
      stars: 10,
      trickySessions: 1,
    });
  });
});
