import { del, get, set } from 'idb-keyval';
import type { Attempt, Award, Profile, Session } from '../engine/types';
import type { Repo } from './repo';

export type KeyValueStore = {
  get(k: string): Promise<unknown>;
  set(k: string, v: unknown): Promise<void>;
  del(k: string): Promise<void>;
};

export const idbStore: KeyValueStore = {
  get: (k) => get(k),
  set: (k, v) => set(k, v),
  del: (k) => del(k),
};

type QueueItem =
  | { seq: number; kind: 'attempts'; data: Attempt[] }
  | { seq: number; kind: 'session'; data: Session }
  | { seq: number; kind: 'awards'; data: Award[] }
  | { seq: number; kind: 'profile'; data: Profile };

type NewItem = QueueItem extends infer T ? (T extends QueueItem ? Omit<T, 'seq'> : never) : never;

export type OfflineRepo = Repo & { flush(): Promise<void>; pending(): Promise<number> };

const QUEUE_KEY = 'queue';
const readKey = (name: string, arg = '') => `read:${name}:${arg}`;

/** Merge by key; later list entries (pending writes) win. */
function mergeBy<T>(base: T[], pending: T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of base) m.set(key(x), x);
  for (const x of pending) m.set(key(x), x);
  return [...m.values()];
}

export function createOfflineRepo(inner: Repo, store: KeyValueStore): OfflineRepo {
  let queue: QueueItem[] = [];
  let nextSeq = 1;
  const loaded = (async () => {
    const saved = (await store.get(QUEUE_KEY)) as QueueItem[] | undefined;
    if (saved?.length) {
      // Anything queued before the load finished sits after the saved items.
      queue = [...saved, ...queue];
      nextSeq = Math.max(nextSeq, ...saved.map((i) => i.seq + 1));
    }
  })();
  const persist = () => store.set(QUEUE_KEY, queue);

  async function enqueue(item: NewItem) {
    await loaded;
    queue.push({ ...item, seq: nextSeq++ } as QueueItem);
    await persist();
    await flush().catch(() => {}); // a failed send stays queued
  }

  function send(item: QueueItem): Promise<void> {
    switch (item.kind) {
      case 'attempts':
        return inner.addAttempts(item.data);
      case 'session':
        return inner.saveSession(item.data);
      case 'awards':
        return inner.addAwards(item.data);
      case 'profile':
        return inner.saveProfile(item.data);
    }
  }

  let inFlight: Promise<void> | null = null;
  function flush(): Promise<void> {
    inFlight ??= (async () => {
      await loaded;
      try {
        while (queue.length > 0) {
          const head = queue[0];
          try {
            await send(head);
          } catch {
            return; // offline or server error: keep it and everything behind it
          }
          queue = queue.filter((i) => i.seq !== head.seq);
          await persist();
        }
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function pendingOf<K extends QueueItem['kind']>(kind: K) {
    await loaded;
    return queue.filter((i): i is Extract<QueueItem, { kind: K }> => i.kind === kind);
  }

  /** Try inner, cache on success; on failure fall back to the cache (or rethrow if empty). */
  async function cachedRead<T>(key: string, fetch: () => Promise<T>): Promise<T> {
    try {
      const result = await fetch();
      await store.set(key, result).catch(() => {});
      return result;
    } catch (err) {
      const cached = (await store.get(key)) as T | undefined;
      if (cached === undefined) throw err;
      return cached;
    }
  }

  // Merging needs the base even when the read fails and nothing is cached, so reads with
  // pending writes fall back to an empty base only when something is pending.
  async function mergedRead<T>(
    key: string,
    fetch: () => Promise<T[]>,
    pending: () => Promise<T[]>,
    id: (x: T) => string,
  ): Promise<T[]> {
    let base: T[];
    try {
      base = await cachedRead(key, fetch);
    } catch (err) {
      const p = await pending();
      if (p.length === 0) throw err;
      base = [];
    }
    return mergeBy(base, await pending(), id);
  }

  const awardKey = (a: Award) => `${a.profileId}|${a.badgeId}`;

  void flush();
  if (typeof window !== 'undefined') window.addEventListener('online', () => void flush());

  return {
    listProfiles: () =>
      mergedRead(
        readKey('listProfiles'),
        () => inner.listProfiles(),
        async () => (await pendingOf('profile')).map((i) => i.data),
        (p) => p.id,
      ),
    listLists: (profileId) =>
      cachedRead(readKey('listLists', profileId), () => inner.listLists(profileId)),
    listAttempts: (profileId) =>
      mergedRead(
        readKey('listAttempts', profileId),
        () => inner.listAttempts(profileId),
        async () => (await pendingOf('attempts')).flatMap((i) => i.data).filter((a) => a.profileId === profileId),
        (a) => a.id,
      ),
    listSessions: (profileId) =>
      mergedRead(
        readKey('listSessions', profileId),
        () => inner.listSessions(profileId),
        async () => (await pendingOf('session')).map((i) => i.data).filter((s) => s.profileId === profileId),
        (s) => s.id,
      ),
    listAwards: (profileId) =>
      mergedRead(
        readKey('listAwards', profileId),
        () => inner.listAwards(profileId),
        async () => (await pendingOf('awards')).flatMap((i) => i.data).filter((a) => a.profileId === profileId),
        awardKey,
      ),
    getParentPinHash: () => cachedRead(readKey('getParentPinHash'), () => inner.getParentPinHash()),

    saveProfile: (data) => enqueue({ kind: 'profile', data }),
    addAttempts: (data) => enqueue({ kind: 'attempts', data }),
    saveSession: (data) => enqueue({ kind: 'session', data }),
    addAwards: (data) => enqueue({ kind: 'awards', data }),

    saveList: (l) => inner.saveList(l),
    deleteList: (id) => inner.deleteList(id),
    deleteProfile: (id) => inner.deleteProfile(id),
    setParentPinHash: (h) => inner.setParentPinHash(h),

    flush,
    pending: async () => {
      await loaded;
      return queue.length;
    },
  };
}
