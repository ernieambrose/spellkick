import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { ProfileContext } from '../../src/app/profileContext';
import { RepoContext } from '../../src/app/repoContext';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Repo } from '../../src/data/repo';
import { seededRng } from '../../src/engine/rng';
import type { Attempt, Profile, WordList } from '../../src/engine/types';
import { useSession } from '../../src/screens/Session/useSession';

const NOW = new Date(2026, 9, 28, 12, 0, 0); // local noon, so localDate is 2026-10-28 in any zone
const now = () => NOW;

const felix: Profile = {
  id: 'p1',
  name: 'Felix',
  grade: 5,
  generatedLevel: 5,
  pinHash: null,
  timerOn: true,
  theme: 'default',
  createdAt: '2026-10-01T12:00:00.000Z',
};

function wrapper(repo: Repo) {
  const active = { activeId: felix.id, profile: felix, select() {}, clear() {} };
  return ({ children }: { children: ReactNode }) =>
    createElement(
      RepoContext.Provider,
      { value: repo },
      createElement(ProfileContext.Provider, { value: active }, children),
    );
}

async function setup(seed: (repo: Repo) => Promise<void> = async () => {}) {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  await seed(repo);
  const hook = renderHook(() => useSession('scramble', { rng: seededRng(7), now }), {
    wrapper: wrapper(repo),
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { repo, hook };
}

function answerAll(hook: Awaited<ReturnType<typeof setup>>['hook']) {
  const count = hook.result.current.words.length;
  for (let i = 0; i < count; i++) {
    act(() => {
      const { current } = hook.result.current;
      hook.result.current.record({ word: current!.word, kind: 'clean', ms: 3000.4 });
    });
    act(() => hook.result.current.next());
  }
}

const cleanAttempt = (word: string, day: string): Attempt => ({
  id: crypto.randomUUID(),
  profileId: felix.id,
  sessionId: 'old',
  word,
  listId: 'l1',
  game: 'scramble',
  kind: 'clean',
  ms: null,
  localDate: day,
  createdAt: `${day}T12:00:00.000Z`,
});

describe('useSession', () => {
  it('yields 10 words', async () => {
    const { hook } = await setup();
    expect(hook.result.current.words).toHaveLength(10);
    expect(hook.result.current.index).toBe(0);
    expect(hook.result.current.done).toBe(false);
  });

  it('marks done after 10 answers and saves one session and 10 attempts', async () => {
    const { repo, hook } = await setup();
    answerAll(hook);
    expect(hook.result.current.done).toBe(true);
    await waitFor(async () => expect(await repo.listSessions(felix.id)).toHaveLength(1));
    const attempts = await repo.listAttempts(felix.id);
    expect(attempts).toHaveLength(10);
    expect(attempts.every((a) => a.ms === 3000 && a.localDate === '2026-10-28')).toBe(true);
    const [session] = await repo.listSessions(felix.id);
    expect(session.completedAt).not.toBeNull();
    expect(session.localDate).toBe('2026-10-28');
    expect(session.points).toBe(150); // 10 clean answers, 10 + 5 fast bonus each
    expect(session.stars).toBe(10);
    expect(hook.result.current.summary.points).toBe(150);
  });

  it('lists a word that reaches its third clean day in masteredToday', async () => {
    const list: WordList = {
      id: 'l1',
      profileId: felix.id,
      name: 'Week 9',
      testDate: '2026-10-30',
      source: 'school',
      author: null,
      words: ['Necessary'],
      createdAt: '2026-10-20T12:00:00.000Z',
    };
    const { hook } = await setup(async (repo) => {
      await repo.saveList(list);
      await repo.addAttempts([cleanAttempt('necessary', '2026-10-26'), cleanAttempt('necessary', '2026-10-27')]);
    });
    expect(hook.result.current.words.map((w) => w.word)).toContain('Necessary');
    answerAll(hook);
    await waitFor(() => expect(hook.result.current.summary.masteredToday).toEqual(['Necessary']));
  });

  it("gives first-kick on the kid's first session", async () => {
    const { repo, hook } = await setup();
    answerAll(hook);
    await waitFor(() =>
      expect(hook.result.current.summary.newBadges.map((b) => b.id)).toContain('first-kick'),
    );
    await waitFor(async () =>
      expect((await repo.listAwards(felix.id)).map((a) => a.badgeId)).toContain('first-kick'),
    );
  });

  it('keeps a parent edit made mid-session when the level moves at session end', async () => {
    const { repo, hook } = await setup();
    expect(hook.result.current.words.every((w) => w.listId === null)).toBe(true);
    await repo.saveProfile({ ...felix, name: 'Felix R', timerOn: false }); // parent edits during play
    answerAll(hook);
    await waitFor(async () => expect((await repo.listProfiles())[0].generatedLevel).toBe(6));
    expect((await repo.listProfiles())[0]).toMatchObject({ name: 'Felix R', timerOn: false });
  });

  it('does not move the generated level in a session with no generated words', async () => {
    const mk = (id: string, words: string[], testDate: string | null): WordList => ({
      id,
      profileId: felix.id,
      name: id,
      testDate,
      source: 'school',
      author: null,
      words,
      createdAt: '2026-10-20T12:00:00.000Z',
    });
    const oldGenerated: Attempt[] = Array.from({ length: 10 }, (_, i) => ({
      ...cleanAttempt(`oldword${i}`, '2026-10-20'),
      listId: null,
    }));
    const { repo, hook } = await setup(async (r) => {
      await r.saveList(mk('cur', ['planet', 'garden', 'window', 'bridge', 'castle', 'pencil', 'rocket', 'basket'], '2026-10-30'));
      await r.saveList(mk('old', ['carrot', 'monkey', 'butter', 'ladder'], null));
      await r.addAttempts(oldGenerated);
    });
    expect(hook.result.current.words.every((w) => w.listId !== null)).toBe(true);
    answerAll(hook);
    await waitFor(async () => expect(await repo.listSessions(felix.id)).toHaveLength(1));
    const [stored] = await repo.listProfiles();
    expect(stored.generatedLevel).toBe(5);
  });
});
