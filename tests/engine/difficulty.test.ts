import { adaptGeneratedLevel } from '../../src/engine/difficulty';
import type { AttemptKind, AttemptLike } from '../../src/engine/types';

let t = 0;
const at = (kind: AttemptKind): AttemptLike => {
  t++;
  return {
    word: `w${t}`,
    kind,
    localDate: '2026-11-01',
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, t)).toISOString(),
  };
};
const nClean = (clean: number, miss: number): AttemptLike[] => [
  ...Array.from({ length: clean }, () => at('clean')),
  ...Array.from({ length: miss }, () => at('miss')),
];

describe('adaptGeneratedLevel', () => {
  it('adapts level up at 90% and down at 60%, clamped', () => {
    expect(adaptGeneratedLevel(3, nClean(18, 2))).toBe(4);
    expect(adaptGeneratedLevel(3, nClean(12, 8))).toBe(2);
    expect(adaptGeneratedLevel(1, nClean(5, 15))).toBe(1);
    expect(adaptGeneratedLevel(8, nClean(20, 0))).toBe(8);
  });
  it('stays put between the thresholds', () =>
    expect(adaptGeneratedLevel(5, nClean(15, 5))).toBe(5));
  it('is unchanged with fewer than 10 attempts', () =>
    expect(adaptGeneratedLevel(4, nClean(9, 0))).toBe(4));
  it('counts hinted as not clean and ignores practice', () => {
    const practice = Array.from({ length: 5 }, () => at('practice'));
    expect(adaptGeneratedLevel(4, [...nClean(8, 0), at('hinted'), at('hinted'), ...practice])).toBe(4);
    expect(adaptGeneratedLevel(4, [...nClean(9, 0), ...practice])).toBe(4); // 9 real -> unchanged
  });
  it('uses only the most recent 20 attempts, by time', () => {
    const old = nClean(0, 20);
    const recent = nClean(20, 0);
    expect(adaptGeneratedLevel(3, [...recent, ...old])).toBe(4);
  });
});
