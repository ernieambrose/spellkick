import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Attempt, Award, Profile, Session, WordList } from '../../src/engine/types';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  name: 'Felix',
  grade: 3,
  generatedLevel: 3,
  pinHash: null,
  timerOn: false,
  theme: 'default',
  createdAt: '2026-10-28T12:00:00.000Z',
  ...over,
});

const list = (over: Partial<WordList> = {}): WordList => ({
  id: 'l1',
  profileId: 'p1',
  name: 'Week 1',
  testDate: '2026-10-30',
  source: 'school',
  author: null,
  words: ['cat', 'dog'],
  createdAt: '2026-10-28T12:00:00.000Z',
  ...over,
});

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: 'a1',
  profileId: 'p1',
  sessionId: 's1',
  word: 'cat',
  listId: 'l1',
  game: 'scramble',
  kind: 'clean',
  ms: 1200,
  localDate: '2026-10-28',
  createdAt: '2026-10-28T12:01:00.000Z',
  ...over,
});

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  profileId: 'p1',
  game: 'scramble',
  mode: 'normal',
  startedAt: '2026-10-28T12:00:00.000Z',
  completedAt: null,
  localDate: '2026-10-28',
  points: 0,
  stars: 0,
  trickyCount: 0,
  ...over,
});

const award = (over: Partial<Award> = {}): Award => ({
  profileId: 'p1',
  badgeId: 'first-kick',
  earnedAt: '2026-10-28T12:05:00.000Z',
  ...over,
});

describe('createMemoryRepo', () => {
  it('saves and lists a profile', async () => {
    const repo = createMemoryRepo();
    await repo.saveProfile(profile());
    expect(await repo.listProfiles()).toEqual([profile()]);
  });

  it('saveProfile upserts by id', async () => {
    const repo = createMemoryRepo();
    await repo.saveProfile(profile());
    await repo.saveProfile(profile({ name: 'Junie' }));
    expect((await repo.listProfiles()).map((p) => p.name)).toEqual(['Junie']);
  });

  it('saveList replaces words', async () => {
    const repo = createMemoryRepo();
    await repo.saveList(list());
    await repo.saveList(list({ words: ['fish'] }));
    expect((await repo.listLists('p1')).map((l) => l.words)).toEqual([['fish']]);
  });

  it('listLists only returns that profile', async () => {
    const repo = createMemoryRepo();
    await repo.saveList(list());
    await repo.saveList(list({ id: 'l2', profileId: 'p2' }));
    expect((await repo.listLists('p1')).map((l) => l.id)).toEqual(['l1']);
  });

  it('deleteList removes only that list', async () => {
    const repo = createMemoryRepo();
    await repo.saveList(list());
    await repo.saveList(list({ id: 'l2' }));
    await repo.deleteList('l1');
    expect((await repo.listLists('p1')).map((l) => l.id)).toEqual(['l2']);
  });

  it('addAttempts with the same id twice stores one', async () => {
    const repo = createMemoryRepo();
    await repo.addAttempts([attempt()]);
    await repo.addAttempts([attempt({ kind: 'miss' })]);
    expect(await repo.listAttempts('p1')).toEqual([attempt()]);
  });

  it('saveSession is idempotent by id', async () => {
    const repo = createMemoryRepo();
    await repo.saveSession(session());
    await repo.saveSession(session({ points: 40, completedAt: '2026-10-28T12:09:00.000Z' }));
    const sessions = await repo.listSessions('p1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].points).toBe(40);
  });

  it('addAwards duplicate stores one', async () => {
    const repo = createMemoryRepo();
    await repo.addAwards([award(), award({ earnedAt: '2026-10-29T00:00:00.000Z' })]);
    await repo.addAwards([award()]);
    expect(await repo.listAwards('p1')).toEqual([award()]);
  });

  it('deleting a profile removes its lists, attempts, sessions, awards', async () => {
    const repo = createMemoryRepo();
    await repo.saveProfile(profile());
    await repo.saveProfile(profile({ id: 'p2', name: 'Junie' }));
    await repo.saveList(list());
    await repo.saveList(list({ id: 'l2', profileId: 'p2' }));
    await repo.addAttempts([attempt(), attempt({ id: 'a2', profileId: 'p2' })]);
    await repo.saveSession(session());
    await repo.saveSession(session({ id: 's2', profileId: 'p2' }));
    await repo.addAwards([award(), award({ profileId: 'p2' })]);

    await repo.deleteProfile('p1');

    expect((await repo.listProfiles()).map((p) => p.id)).toEqual(['p2']);
    expect(await repo.listLists('p1')).toEqual([]);
    expect(await repo.listAttempts('p1')).toEqual([]);
    expect(await repo.listSessions('p1')).toEqual([]);
    expect(await repo.listAwards('p1')).toEqual([]);
    expect(await repo.listLists('p2')).toHaveLength(1);
    expect(await repo.listAttempts('p2')).toHaveLength(1);
    expect(await repo.listSessions('p2')).toHaveLength(1);
    expect(await repo.listAwards('p2')).toHaveLength(1);
  });

  it('returns copies, not internal references', async () => {
    const repo = createMemoryRepo();
    await repo.saveList(list());
    const [l] = await repo.listLists('p1');
    l.words.push('mutated');
    expect((await repo.listLists('p1'))[0].words).toEqual(['cat', 'dog']);
  });

  it('stores the parent pin hash', async () => {
    const repo = createMemoryRepo();
    expect(await repo.getParentPinHash()).toBeNull();
    await repo.setParentPinHash('abc');
    await repo.setParentPinHash('def');
    expect(await repo.getParentPinHash()).toBe('def');
  });

  it('setGeneratedLevel changes only the level, and ignores an unknown profile', async () => {
    const repo = createMemoryRepo();
    await repo.saveProfile(profile());
    await repo.setGeneratedLevel('p1', 4);
    await repo.setGeneratedLevel('nobody', 7);
    expect(await repo.listProfiles()).toEqual([profile({ generatedLevel: 4 })]);
  });
});
