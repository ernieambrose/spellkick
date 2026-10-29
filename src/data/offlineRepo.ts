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

/** Lets screens that don't build the repo (sign-in, sign-out) reach the queue when there is one. */
export const isOfflineRepo = (r: Repo): r is OfflineRepo =>
  typeof (r as Partial<OfflineRepo>).flush === 'function' && typeof (r as Partial<OfflineRepo>).pending === 'function';

const QUEUE_KEY = 'queue';
const DEADLETTER_KEY = 'deadletter';

/** Permanent: retrying can never succeed (constraint/RLS violation, or a 4xx other than auth/timeout/rate-limit). */
function isPermanent(err: unknown): boolean {
  const { code, status } = (err ?? {}) as { code?: unknown; status?: unknown };
  if (status === 401) return false; // sent without a session (an RLS 42501 with the anon key): retry once signed in
  if (typeof code === 'string' && (code.startsWith('23') || code === '42501')) return true;
  return typeof status === 'number' && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}
const readKey = (name: string, arg = '') => `read:${name}:${arg}`;

/** Merge by key; later list entries (pending writes) win. */
function mergeBy<T>(base: T[], pending: T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of base) m.set(key(x), x);
  for (const x of pending) m.set(key(x), x);
  return [...m.values()];
}

/**
 * `canSend` says whether the server can accept writes right now (Supabase: a session exists).
 * Without one every write is sent with the anon key and rejected by RLS, so flushing waits.
 */
export function createOfflineRepo(
  inner: Repo,
  store: KeyValueStore,
  canSend: () => Promise<boolean> = async () => true,
): OfflineRepo {
  let queue: QueueItem[] = [];
  let nextSeq = 1;
  const loaded = (async () => {
    try {
      const saved = (await store.get(QUEUE_KEY)) as QueueItem[] | undefined;
      if (saved?.length) {
        // Anything queued before the load finished sits after the saved items.
        queue = [...saved, ...queue];
        nextSeq = Math.max(nextSeq, ...saved.map((i) => i.seq + 1));
      }
    } catch (err) {
      console.warn('offlineRepo: could not load the saved queue, starting empty', err);
    }
  })();
  const persist = () =>
    store.set(QUEUE_KEY, queue).catch((err) => console.warn('offlineRepo: could not persist the queue', err));

  async function deadLetter(item: QueueItem, err: unknown) {
    console.warn('offlineRepo: dropping an item the server permanently rejected', item, err);
    try {
      const dead = ((await store.get(DEADLETTER_KEY)) as QueueItem[] | undefined) ?? [];
      await store.set(DEADLETTER_KEY, [...dead, item]);
    } catch (e) {
      console.warn('offlineRepo: could not save the dead letter', e);
    }
  }

  async function enqueue(item: NewItem) {
    await loaded;
    queue.push({ ...item, seq: nextSeq++ } as QueueItem);
    await persist();
    await flush(); // a failed send stays queued; flush never rejects
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
        if (queue.length === 0 || !(await canSend().catch(() => false))) return;
        while (queue.length > 0) {
          const head = queue[0];
          try {
            await send(head);
          } catch (err) {
            if (!isPermanent(err)) {
              console.warn('offlineRepo: send failed, will retry', err);
              return; // offline or server error: keep it and everything behind it
            }
            await deadLetter(head, err);
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
    deleteProfile: async (id) => {
      await inner.deleteProfile(id);
      await loaded;
      // Queued writes for a deleted kid would fail RLS, or (saveProfile) resurrect them.
      const forProfile = (i: QueueItem) =>
        i.kind === 'profile'
          ? i.data.id === id
          : i.kind === 'session'
            ? i.data.profileId === id
            : i.data.every((x) => x.profileId === id);
      queue = queue.filter((i) => !forProfile(i));
      await persist();
    },
    setParentPinHash: (h) => inner.setParentPinHash(h),

    flush,
    pending: async () => {
      await loaded;
      return queue.length;
    },
  };
}
