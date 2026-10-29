import {
  attemptFromRow,
  attemptToRow,
  awardFromRow,
  awardToRow,
  listFromRow,
  listToRow,
  profileFromRow,
  profileToRow,
  sessionFromRow,
  sessionToRow,
} from '../../src/data/mappers';
import type { Attempt, Award, Profile, Session, WordList } from '../../src/engine/types';

const p: Profile = {
  id: 'p1',
  name: 'Felix',
  grade: 4,
  generatedLevel: 5,
  pinHash: 'h',
  timerOn: true,
  theme: 'skate',
  createdAt: '2026-10-28T12:00:00.000Z',
};
const l: WordList = {
  id: 'l1',
  profileId: 'p1',
  name: 'Week 1',
  testDate: null,
  source: 'teacher',
  author: 'Ms. B',
  words: ['Cat'],
  createdAt: '2026-10-28T12:00:00.000Z',
};
const a: Attempt = {
  id: 'a1',
  profileId: 'p1',
  sessionId: 's1',
  word: 'cat',
  listId: null,
  game: 'misspell',
  kind: 'hinted',
  ms: null,
  localDate: '2026-10-28',
  createdAt: '2026-10-28T12:01:00.000Z',
};
const s: Session = {
  id: 's1',
  profileId: 'p1',
  game: 'scramble',
  mode: 'extra',
  startedAt: '2026-10-28T12:00:00.000Z',
  completedAt: '2026-10-28T12:09:00.000Z',
  localDate: '2026-10-28',
  points: 120,
  stars: 3,
  trickyCount: 2,
};
const w: Award = { profileId: 'p1', badgeId: 'streak-3', earnedAt: '2026-10-28T12:05:00.000Z' };

describe('row mappers', () => {
  it('maps profile to snake_case columns', () =>
    expect(profileToRow(p)).toEqual({
      id: 'p1',
      name: 'Felix',
      grade: 4,
      generated_level: 5,
      pin_hash: 'h',
      timer_on: true,
      theme: 'skate',
      created_at: '2026-10-28T12:00:00.000Z',
    }));
  it('maps word list to snake_case columns', () =>
    expect(listToRow(l)).toEqual({
      id: 'l1',
      profile_id: 'p1',
      name: 'Week 1',
      test_date: null,
      source: 'teacher',
      author: 'Ms. B',
      words: ['Cat'],
      created_at: '2026-10-28T12:00:00.000Z',
    }));
  it('maps attempt to snake_case columns', () =>
    expect(attemptToRow(a)).toEqual({
      id: 'a1',
      profile_id: 'p1',
      session_id: 's1',
      word: 'cat',
      list_id: null,
      game: 'misspell',
      kind: 'hinted',
      ms: null,
      local_date: '2026-10-28',
      created_at: '2026-10-28T12:01:00.000Z',
    }));
  it('maps session to snake_case columns', () =>
    expect(sessionToRow(s)).toEqual({
      id: 's1',
      profile_id: 'p1',
      game: 'scramble',
      mode: 'extra',
      started_at: '2026-10-28T12:00:00.000Z',
      completed_at: '2026-10-28T12:09:00.000Z',
      local_date: '2026-10-28',
      points: 120,
      stars: 3,
      tricky_count: 2,
    }));
  it('maps award to snake_case columns', () =>
    expect(awardToRow(w)).toEqual({ profile_id: 'p1', badge_id: 'streak-3', earned_at: '2026-10-28T12:05:00.000Z' }));

  it('round-trips every type, ignoring the owner column', () => {
    const owner = { owner: 'u1' };
    expect(profileFromRow({ ...profileToRow(p), ...owner })).toEqual(p);
    expect(listFromRow({ ...listToRow(l), ...owner })).toEqual(l);
    expect(attemptFromRow({ ...attemptToRow(a), ...owner })).toEqual(a);
    expect(sessionFromRow({ ...sessionToRow(s), ...owner })).toEqual(s);
    expect(awardFromRow({ ...awardToRow(w), ...owner })).toEqual(w);
  });
});
