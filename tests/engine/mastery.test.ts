import { deriveWordState, summarize } from '../../src/engine/mastery';
import { localDate } from '../../src/engine/streak';
import type { AttemptKind } from '../../src/engine/types';

const a = (kind: AttemptKind, day: string, t = day + 'T12:00:00Z') => ({
  word: 'rhythm',
  kind,
  localDate: day,
  createdAt: t,
});

describe('deriveWordState', () => {
  it('new with no attempts', () => expect(deriveWordState([])).toBe('new'));
  it('three clean days = mastered', () =>
    expect(
      deriveWordState([a('clean', '2026-11-01'), a('clean', '2026-11-02'), a('clean', '2026-11-03')]),
    ).toBe('mastered'));
  it('three clean on one day is not mastered', () =>
    expect(
      deriveWordState([
        a('clean', '2026-11-01', '2026-11-01T01:00Z'),
        a('clean', '2026-11-01', '2026-11-01T02:00Z'),
        a('clean', '2026-11-01', '2026-11-01T03:00Z'),
      ]),
    ).toBe('learning'));
  it('a miss after mastery drops to tricky', () =>
    expect(
      deriveWordState([
        a('clean', '2026-11-01'),
        a('clean', '2026-11-02'),
        a('clean', '2026-11-03'),
        a('miss', '2026-11-04'),
      ]),
    ).toBe('tricky'));
  it('hinted solves are tricky and do not count toward mastery', () =>
    expect(
      deriveWordState([a('hinted', '2026-11-01'), a('hinted', '2026-11-02'), a('hinted', '2026-11-03')]),
    ).toBe('tricky'));
  it('practice never changes state', () => expect(deriveWordState([a('practice', '2026-11-01')])).toBe('new'));
  it('a hinted solve voids that day for mastery', () =>
    expect(
      deriveWordState([
        a('clean', '2026-11-01'),
        a('clean', '2026-11-02'),
        a('hinted', '2026-11-03', '2026-11-03T10:00Z'),
        a('clean', '2026-11-03', '2026-11-03T11:00Z'),
      ]),
    ).not.toBe('mastered'));
  it('is order independent', () =>
    expect(
      deriveWordState([a('clean', '2026-11-03'), a('clean', '2026-11-01'), a('clean', '2026-11-02')]),
    ).toBe('mastered'));
  it('mastery can be rebuilt after a miss', () =>
    expect(
      deriveWordState([
        a('miss', '2026-11-01'),
        a('clean', '2026-11-02'),
        a('clean', '2026-11-03'),
        a('clean', '2026-11-04'),
      ]),
    ).toBe('mastered'));
});

describe('summarize', () => {
  it('groups by normalized word', () => {
    const m = summarize([
      { ...a('clean', '2026-11-01'), word: 'Ice Cream' },
      { ...a('miss', '2026-11-02'), word: 'ice  cream' },
      a('clean', '2026-11-01'),
    ]);
    expect(m.get('ice cream')).toBe('tricky');
    expect(m.get('rhythm')).toBe('learning');
    expect(m.size).toBe(2);
  });
});

describe('localDate', () => {
  it('uses local zone near midnight', () =>
    expect(localDate(new Date('2026-11-02T03:58:00Z'), 'America/New_York')).toBe('2026-11-01'));
});
