import { createMemoryRepo } from '../../src/data/memoryRepo';
import { createOfflineRepo, type KeyValueStore } from '../../src/data/offlineRepo';
import type { Repo } from '../../src/data/repo';
import { deriveWordState } from '../../src/engine/mastery';
import type { Attempt, Award, Profile, Session, WordList } from '../../src/engine/types';

const mapStore = (): KeyValueStore => {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
  };
};

// Wraps a repo so every call rejects while `down` is true.
function flaky(inner: Repo) {
  const state = { down: false };
  const repo = new Proxy(inner, {
    get(target, prop: keyof Repo) {
      const fn = target[prop] as (...a: unknown[]) => Promise<unknown>;
      return (...args: unknown[]) =>
        state.down ? Promise.reject(new Error('network down')) : fn.apply(target, args);
    },
  });
  return { repo, state };
}

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: crypto.randomUUID(),
  profileId: 'p1',
  sessionId: 's1',
  word: 'friend',
  listId: null,
  game: 'scramble',
  kind: 'clean',
  ms: null,
  localDate: '2026-10-28',
  createdAt: '2026-10-28T12:00:00.000Z',
  ...over,
});

const list: WordList = {
  id: 'l1',
  profileId: 'p1',
  name: 'Week 1',
  testDate: null,
  source: 'school',
  author: null,
  words: ['friend'],
  createdAt: '2026-10-28T12:00:00.000Z',
};

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  profileId: 'p1',
  game: 'scramble',
  mode: 'normal',
  startedAt: '2026-10-28T12:00:00.000Z',
  completedAt: '2026-10-28T12:05:00.000Z',
  localDate: '2026-10-28',
  points: 10,
  stars: 1,
  trickyCount: 0,
  ...over,
});

const profile: Profile = {
  id: 'p1',
  name: 'Felix',
  grade: 3,
  generatedLevel: 3,
  pinHash: null,
  timerOn: false,
  theme: 'default',
  createdAt: '2026-10-28T12:00:00.000Z',
};

const award = (badgeId: string): Award => ({ profileId: 'p1', badgeId, earnedAt: '2026-10-28T12:00:00.000Z' });

describe('createOfflineRepo', () => {
  it('returns the last cached result when a read fails', async () => {
    const { repo, state } = flaky(createMemoryRepo());
    await repo.saveList(list);
    const offline = createOfflineRepo(repo, mapStore());
    expect(await offline.listLists('p1')).toEqual([list]);
    state.down = true;
    expect(await offline.listLists('p1')).toEqual([list]);
  });

  it('throws the original error when a read fails with nothing cached', async () => {
    const { repo, state } = flaky(createMemoryRepo());
    state.down = true;
    const offline = createOfflineRepo(repo, mapStore());
    await expect(offline.listLists('p1')).rejects.toThrow('network down');
  });

  it('keeps 3 attempts pending offline, then flushes all 3 on recovery without duplicating', async () => {
    const mem = createMemoryRepo();
    const { repo, state } = flaky(mem);
    state.down = true;
    const offline = createOfflineRepo(repo, mapStore());
    const three = [attempt(), attempt(), attempt()];
    for (const a of three) await offline.addAttempts([a]); // does not throw
    expect(await offline.pending()).toBe(3);
    // offline reads show the pending writes even with nothing cached
    state.down = false;
    await offline.listAttempts('p1'); // prime cache then go down again
    state.down = true;
    expect((await offline.listAttempts('p1')).map((a) => a.id).sort()).toEqual(three.map((a) => a.id).sort());

    state.down = false;
    await offline.flush();
    await offline.flush();
    expect(await offline.pending()).toBe(0);
    expect(await mem.listAttempts('p1')).toHaveLength(3);
  });

  it('stops flushing at the first failure and keeps the rest queued in order', async () => {
    const sent: string[] = [];
    const inner = createMemoryRepo();
    let failOn: string | null = null;
    const wrapped: Repo = {
      ...inner,
      addAttempts: async (a) => {
        if (a[0].id === failOn) throw new Error('boom');
        sent.push(a[0].id);
        return inner.addAttempts(a);
      },
    };
    const offline = createOfflineRepo(wrapped, mapStore());
    const [a, b, c] = [attempt({ id: 'a' }), attempt({ id: 'b' }), attempt({ id: 'c' })];
    failOn = 'b';
    for (const x of [a, b, c]) await offline.addAttempts([x]);
    expect(sent).toEqual(['a']);
    expect(await offline.pending()).toBe(2);
    failOn = null;
    await offline.flush();
    expect(sent).toEqual(['a', 'b', 'c']);
    expect(await offline.pending()).toBe(0);
  });

  it('does not double-send on concurrent flush calls', async () => {
    const inner = createMemoryRepo();
    let calls = 0;
    const wrapped: Repo = {
      ...inner,
      saveSession: async (s) => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        return inner.saveSession(s);
      },
    };
    const store = mapStore();
    const offline = createOfflineRepo(wrapped, store);
    const queued = offline.saveSession(session()); // starts a flush of its own
    await new Promise((r) => setTimeout(r, 0));
    await Promise.all([queued, offline.flush(), offline.flush(), offline.flush()]);
    expect(calls).toBe(1);
    expect(await offline.pending()).toBe(0);
  });

  it('merges pending sessions, awards and profiles into offline reads', async () => {
    const { repo, state } = flaky(createMemoryRepo());
    const offline = createOfflineRepo(repo, mapStore());
    await offline.listSessions('p1');
    await offline.listAwards('p1');
    await offline.listProfiles();
    state.down = true;
    await offline.saveSession(session());
    await offline.addAwards([award('first-kick')]);
    await offline.saveProfile(profile);
    expect(await offline.listSessions('p1')).toEqual([session()]);
    expect((await offline.listAwards('p1')).map((a) => a.badgeId)).toEqual(['first-kick']);
    expect(await offline.listProfiles()).toEqual([profile]);
  });

  it('survives a restart: a new offline repo on the same store flushes the old queue', async () => {
    const mem = createMemoryRepo();
    const { repo, state } = flaky(mem);
    const store = mapStore();
    state.down = true;
    await createOfflineRepo(repo, store).addAttempts([attempt({ id: 'x' })]);
    state.down = false;
    const second = createOfflineRepo(repo, store);
    await second.flush();
    expect(await mem.listAttempts('p1')).toHaveLength(1);
  });

  it('passes parent-area writes straight through and propagates errors', async () => {
    const { repo, state } = flaky(createMemoryRepo());
    const offline = createOfflineRepo(repo, mapStore());
    await offline.saveList(list);
    expect(await repo.listLists('p1')).toEqual([list]);
    state.down = true;
    await expect(offline.saveList(list)).rejects.toThrow('network down');
    await expect(offline.deleteList('l1')).rejects.toThrow('network down');
    await expect(offline.deleteProfile('p1')).rejects.toThrow('network down');
    await expect(offline.setParentPinHash('h')).rejects.toThrow('network down');
    expect(await offline.pending()).toBe(0);
  });

  it('merges attempts from two offline devices and counts a shared day once', async () => {
    const mem = createMemoryRepo();
    const a = flaky(mem);
    const b = flaky(mem);
    a.state.down = b.state.down = true;
    const deviceA = createOfflineRepo(a.repo, mapStore());
    const deviceB = createOfflineRepo(b.repo, mapStore());
    await deviceA.addAttempts([attempt({ localDate: '2026-10-27', createdAt: '2026-10-27T10:00:00.000Z' })]);
    await deviceB.addAttempts([attempt({ localDate: '2026-10-27', createdAt: '2026-10-27T11:00:00.000Z' })]);
    await deviceA.addAttempts([attempt({ localDate: '2026-10-28', createdAt: '2026-10-28T10:00:00.000Z' })]);
    a.state.down = b.state.down = false;
    await Promise.all([deviceA.flush(), deviceB.flush()]);
    const all = await deviceA.listAttempts('p1');
    expect(all).toHaveLength(3);
    // 3 attempts but only 2 distinct days: not mastered
    expect(deriveWordState(all)).toBe('learning');
  });

  describe('failure handling', () => {
    beforeEach(() => void vi.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => vi.restoreAllMocks());

    const failing = (inner: Repo, failId: string, err: unknown): Repo => ({
      ...inner,
      addAttempts: async (a) => {
        if (a[0].id === failId) throw err;
        return inner.addAttempts(a);
      },
    });

    it('dead-letters a permanently rejected head item and still sends the next', async () => {
      const mem = createMemoryRepo();
      const store = mapStore();
      const offline = createOfflineRepo(
        failing(mem, 'bad', Object.assign(new Error('rls'), { code: '42501', status: 403 })),
        store,
      );
      await offline.addAttempts([attempt({ id: 'bad' })]);
      await offline.addAttempts([attempt({ id: 'good' })]);
      expect((await mem.listAttempts('p1')).map((a) => a.id)).toEqual(['good']);
      expect(await offline.pending()).toBe(0);
      expect(((await store.get('deadletter')) as unknown[]).length).toBe(1);
    });

    it.each([
      ['a 23xxx code', { code: '23503' }],
      ['a 4xx status', { status: 400 }],
    ])('treats %s as permanent', async (_n, extra) => {
      const mem = createMemoryRepo();
      const offline = createOfflineRepo(failing(mem, 'bad', Object.assign(new Error('x'), extra)), mapStore());
      await offline.addAttempts([attempt({ id: 'bad' })]);
      expect(await offline.pending()).toBe(0);
    });

    it.each([
      ['a network error', new Error('Failed to fetch')],
      ['a 500', Object.assign(new Error('x'), { status: 500 })],
      ['a 401', Object.assign(new Error('x'), { status: 401 })],
      ['a 429', Object.assign(new Error('x'), { status: 429 })],
    ])('keeps %s queued and stops the flush', async (_n, err) => {
      const mem = createMemoryRepo();
      const offline = createOfflineRepo(failing(mem, 'bad', err), mapStore());
      await offline.addAttempts([attempt({ id: 'bad' })]);
      await offline.addAttempts([attempt({ id: 'after' })]);
      expect(await offline.pending()).toBe(2);
      expect(await mem.listAttempts('p1')).toHaveLength(0);
    });

    it('purges a deleted profile\'s queued items so it is not resurrected', async () => {
      const mem = createMemoryRepo();
      const { repo, state } = flaky(mem);
      await mem.saveProfile(profile);
      const offline = createOfflineRepo(repo, mapStore());
      state.down = true;
      await offline.saveProfile({ ...profile, name: 'Renamed' });
      await offline.addAttempts([attempt()]);
      await offline.saveSession(session());
      await offline.addAwards([award('first-kick')]);
      await offline.addAttempts([attempt({ profileId: 'other' })]);
      state.down = false;
      await offline.deleteProfile('p1');
      expect(await offline.pending()).toBe(1);
      await offline.flush();
      expect(await mem.listProfiles()).toEqual([]);
      expect(await mem.listAttempts('p1')).toEqual([]);
      expect(await mem.listAttempts('other')).toHaveLength(1);
    });

    it('still sends writes when the store cannot be read', async () => {
      const mem = createMemoryRepo();
      const store: KeyValueStore = { ...mapStore(), get: () => Promise.reject(new Error('idb')) };
      const offline = createOfflineRepo(mem, store);
      await offline.addAttempts([attempt()]);
      expect(await mem.listAttempts('p1')).toHaveLength(1);
    });

    it('still sends writes when the store cannot be written', async () => {
      const mem = createMemoryRepo();
      const store: KeyValueStore = { ...mapStore(), set: () => Promise.reject(new Error('idb')) };
      const offline = createOfflineRepo(mem, store);
      await offline.addAttempts([attempt()]);
      expect(await mem.listAttempts('p1')).toHaveLength(1);
      expect(await offline.pending()).toBe(0);
    });
  });
});
