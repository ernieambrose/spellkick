import { computeStreak, localDate } from '../../src/engine/streak';

describe('localDate', () => {
  it('formats in the given zone', () =>
    expect(localDate(new Date('2026-11-01T02:00:00Z'), 'America/New_York')).toBe('2026-10-31'));
});

describe('computeStreak', () => {
  it('survives until end of the next day', () =>
    expect(computeStreak(['2026-11-01', '2026-11-02'], '2026-11-03').current).toBe(2));
  it('breaks after a missed day', () =>
    expect(computeStreak(['2026-11-01'], '2026-11-03').current).toBe(0));
  it('duplicate dates count once', () =>
    expect(computeStreak(['2026-11-03', '2026-11-03'], '2026-11-03').current).toBe(1));
  it('empty history', () => expect(computeStreak([], '2026-11-03')).toEqual({ current: 0, best: 0 }));
  it('best is the longest run anywhere', () => {
    const r = computeStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'], '2026-10-11');
    expect(r).toEqual({ current: 2, best: 3 });
  });
  it('unsorted input and month/year boundaries', () => {
    const r = computeStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-02');
    expect(r).toEqual({ current: 3, best: 3 });
  });
  it('leap day', () =>
    expect(computeStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01').best).toBe(3));
});
