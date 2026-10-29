import { BADGES, evaluateBadges } from '../../src/engine/badges';
import type { Stats } from '../../src/engine/scoring';

const zero: Stats = { sessions: 0, streakBest: 0, mastered: 0, comebacks: 0, stars: 0, trickySessions: 0 };

describe('evaluateBadges', () => {
  it('awards newly crossed badges only', () =>
    expect(evaluateBadges({ ...zero, sessions: 1 }, new Set())).toEqual(['first-kick']));
  it('does not re-award', () =>
    expect(evaluateBadges({ ...zero, sessions: 5 }, new Set(['first-kick']))).toEqual([]));
  it('returns multiple in catalog order', () =>
    expect(evaluateBadges({ ...zero, streakBest: 7, mastered: 10 }, new Set())).toEqual([
      'streak-3',
      'streak-7',
      'mastered-10',
    ]));
  it('nothing for zero stats', () => expect(evaluateBadges(zero, new Set())).toEqual([]));
});

describe('BADGES', () => {
  it('has the specified ids and goals', () => {
    const goals = Object.fromEntries(
      BADGES.map((b) => {
        const p = b.progress({ sessions: 999, streakBest: 999, mastered: 999, comebacks: 999, stars: 999, trickySessions: 999 });
        return [b.id, p.goal];
      }),
    );
    expect(goals).toEqual({
      'first-kick': 1,
      'streak-3': 3,
      'streak-7': 7,
      'streak-master': 10,
      'streak-30': 30,
      'mastered-10': 10,
      'mastered-25': 25,
      'mastered-50': 50,
      'mastered-100': 100,
      comeback: 1,
      'comeback-10': 10,
      'stars-50': 50,
      'stars-250': 250,
      'tricky-tamer': 5,
    });
  });
  it('caps progress value at goal', () => {
    const b = BADGES.find((x) => x.id === 'stars-50')!;
    expect(b.progress({ ...zero, stars: 20 })).toEqual({ value: 20, goal: 50 });
    expect(b.progress({ ...zero, stars: 500 })).toEqual({ value: 50, goal: 50 });
  });
  it('has unique ids and non-empty text', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) expect(b.name && b.emoji && b.description).toBeTruthy();
  });
});
