import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { createOfflineRepo, type KeyValueStore } from '../../src/data/offlineRepo';
import type { Repo } from '../../src/data/repo';
import { hashPin } from '../../src/engine/pin';
import { localDate } from '../../src/engine/streak';
import type { Attempt, Profile, WordList } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

const PARENT_PIN = '1234';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: crypto.randomUUID(),
  name: 'Felix',
  grade: 3,
  generatedLevel: 3,
  pinHash: null,
  timerOn: false,
  theme: 'default',
  createdAt: '2026-10-28T12:00:00.000Z',
  ...over,
});

const list = (profileId: string, over: Partial<WordList> = {}): WordList => ({
  id: crypto.randomUUID(),
  profileId,
  name: 'Week 1',
  testDate: null,
  source: 'school',
  author: null,
  words: ['rhythm'],
  createdAt: '2026-10-28T12:00:00.000Z',
  ...over,
});

const attempt = (profileId: string, word: string, day: string): Attempt => ({
  id: crypto.randomUUID(),
  profileId,
  sessionId: 's1',
  word,
  listId: null,
  game: 'scramble',
  kind: 'clean',
  ms: null,
  localDate: day,
  createdAt: `${day}T12:00:00.000Z`,
});

// The stub auth has no user id, so the parent PIN salt falls back to 'parent'.
async function repoWith(profiles: Profile[] = [], opts: { pinSet?: boolean } = {}): Promise<Repo> {
  const repo = createMemoryRepo();
  for (const p of profiles) await repo.saveProfile(p);
  if (opts.pinSet ?? true) await repo.setParentPinHash(await hashPin(PARENT_PIN, 'parent'));
  return repo;
}

function renderAt(path: string, repo: Repo, auth = stubAuth({ signedIn: true })) {
  window.history.pushState({}, '', path);
  render(<App repo={repo} authClient={auth} />);
  return userEvent.setup();
}

async function typePin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) await user.click(await screen.findByRole('button', { name: d }));
}

const mapStore = (): KeyValueStore => {
  const m = new Map<string, unknown>();
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v), del: async (k) => void m.delete(k) };
};

beforeEach(() => localStorage.clear());

describe('Parent gate', () => {
  it('first visit sets a parent PIN (entered twice), then opens the parent area', async () => {
    const repo = await repoWith([], { pinSet: false });
    const user = renderAt('/parent', repo);
    expect(await screen.findByText('Set a parent PIN')).toBeInTheDocument();
    await typePin(user, '4321');
    expect(await screen.findByText('Enter it again')).toBeInTheDocument();
    await typePin(user, '4321');
    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();
    expect(await repo.getParentPinHash()).toBe(await hashPin('4321', 'parent'));
  });

  it('a wrong parent PIN blocks entry', async () => {
    const user = renderAt('/parent', await repoWith([profile()]));
    expect(await screen.findByText('Parent PIN')).toBeInTheDocument();
    await typePin(user, '9999');
    expect(await screen.findByText('Try again')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Parent' })).not.toBeInTheDocument();
    expect(screen.queryByText('Felix')).not.toBeInTheDocument();
  });

  it('the right PIN shows the kids, and the gate covers deep links too', async () => {
    const felix = profile();
    const user = renderAt(`/parent/progress/${felix.id}`, await repoWith([felix]));
    expect(await screen.findByText('Parent PIN')).toBeInTheDocument();
    await typePin(user, PARENT_PIN);
    expect(await screen.findByRole('heading', { name: /Felix/ })).toBeInTheDocument();
  });

  it('Sign out clears the active kid and lands on /signin', async () => {
    const felix = profile();
    localStorage.setItem('spellkick.activeProfile', felix.id);
    const user = renderAt('/parent', await repoWith([felix]));
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/signin');
    expect(localStorage.getItem('spellkick.activeProfile')).toBeNull();
  });

  it('Sign out sends unsynced practice first, then signs out without asking', async () => {
    const mem = await repoWith([profile()]);
    let canSend = false;
    const repo = createOfflineRepo(mem, mapStore(), async () => canSend);
    await repo.addAttempts([attempt('p1', 'rhythm', '2026-10-28')]);
    canSend = true;
    const user = renderAt('/parent', repo);
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(await mem.listAttempts('p1')).toHaveLength(1);
  });

  it('Sign out warns when practice still has not synced, and only signs out on confirm', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mem = await repoWith([profile()]);
    const down: Repo = { ...mem, addAttempts: () => Promise.reject(new Error('network down')) };
    const repo = createOfflineRepo(down, mapStore());
    await repo.addAttempts([attempt('p1', 'rhythm', '2026-10-28')]);
    const auth = stubAuth({ signedIn: true });
    const user = renderAt('/parent', repo, auth);
    await typePin(user, PARENT_PIN);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText("Some practice hasn't synced yet. Sign out anyway?")).toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/hasn't synced yet/)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/parent');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out anyway' }));
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('ProfileEditor', () => {
  it('creates a kid with generatedLevel = grade and the timer on for grade >= 4', async () => {
    const repo = await repoWith();
    const user = renderAt('/parent/profile/new', repo);
    await typePin(user, PARENT_PIN);
    await user.type(await screen.findByLabelText('Name'), 'Junie');
    const timer = screen.getByRole('checkbox', { name: /timer/i });
    expect(timer).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText('Grade'), '5');
    expect(timer).toBeChecked();
    await user.selectOptions(screen.getByLabelText('Theme'), 'fishing');
    await user.type(screen.getByLabelText(/Kid PIN/), '2468');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();
    const [saved] = await repo.listProfiles();
    expect(saved).toMatchObject({ name: 'Junie', grade: 5, generatedLevel: 5, timerOn: true, theme: 'fishing' });
    expect(saved.pinHash).toBe(await hashPin('2468', saved.id));
  });

  it('deleting a kid asks "Are you sure?" first', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    const user = renderAt(`/parent/profile/${felix.id}`, repo);
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByRole('button', { name: 'Delete Felix' }));
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    expect(await repo.listProfiles()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();
    expect(await repo.listProfiles()).toHaveLength(0);
  });
});

describe('ListEditor', () => {
  it('previews exactly two pills for "1. necessary\\n2. rhythm\\nnecessary"', async () => {
    const felix = profile();
    const user = renderAt(`/parent/list/new?profile=${felix.id}`, await repoWith([felix]));
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByLabelText('Words'));
    await user.paste('1. necessary\n2. rhythm\nnecessary');
    const preview = screen.getByRole('list', { name: 'Preview' });
    expect(within(preview).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['necessary', 'rhythm']);
  });

  it('saving creates a list in the repo with its source and test date', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    const user = renderAt(`/parent/list/new?profile=${felix.id}`, repo);
    await typePin(user, PARENT_PIN);
    await user.type(await screen.findByLabelText('List name'), 'Week 3');
    fireEvent.change(screen.getByLabelText(/Test date/), { target: { value: '2026-11-05' } });
    await user.selectOptions(screen.getByLabelText('Source'), 'teacher');
    await user.click(screen.getByLabelText('Words'));
    await user.paste('1. necessary\n2. rhythm\nnecessary');
    await user.click(screen.getByRole('button', { name: 'Save list' }));

    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();
    const [saved] = await repo.listLists(felix.id);
    expect(saved).toMatchObject({
      profileId: felix.id,
      name: 'Week 3',
      testDate: '2026-11-05',
      source: 'teacher',
      words: ['necessary', 'rhythm'],
    });
  });

  it('105 pasted words shows the truncation note and saves 100', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    const user = renderAt(`/parent/list/new?profile=${felix.id}`, repo);
    await typePin(user, PARENT_PIN);
    await user.type(await screen.findByLabelText('List name'), 'Big');
    const words = Array.from({ length: 105 }, (_, i) => `word${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'abcde'[Math.floor(i / 26)]}`);
    await user.click(screen.getByLabelText('Words'));
    await user.paste(words.join('\n'));
    expect(screen.getByText(/only the first 100 were kept/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save list' }));
    await screen.findByRole('heading', { name: 'Parent' });
    const [saved] = await repo.listLists(felix.id);
    expect(saved.words).toHaveLength(100);
  });

  it('shows dropped entries', async () => {
    const felix = profile();
    const user = renderAt(`/parent/list/new?profile=${felix.id}`, await repoWith([felix]));
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByLabelText('Words'));
    await user.paste('rhythm\nr2d2');
    expect(screen.getByText(/Skipped/)).toHaveTextContent('r2d2');
  });

  it('marks future-dated lists as Upcoming on the parent home', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    await repo.saveList(list(felix.id, { name: 'Next week', testDate: '2999-01-01' }));
    await repo.saveList(list(felix.id, { name: 'Old one', testDate: '2020-01-01' }));
    const user = renderAt('/parent', repo);
    await typePin(user, PARENT_PIN);
    const upcoming = await screen.findByRole('list', { name: 'Upcoming' });
    expect(within(upcoming).getByText('Next week')).toBeInTheDocument();
    expect(within(upcoming).queryByText('Old one')).not.toBeInTheDocument();
  });

  it('deleting a list asks "Are you sure?" first', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    const wl = list(felix.id, { name: 'Week 1' });
    await repo.saveList(wl);
    const user = renderAt(`/parent/list/${wl.id}`, repo);
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByRole('button', { name: 'Delete list' }));
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    expect(await repo.listLists(felix.id)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await screen.findByRole('heading', { name: 'Parent' });
    expect(await repo.listLists(felix.id)).toHaveLength(0);
  });
});

describe('ProgressView', () => {
  it('shows "Mastered 1" for one word mastered over three days, and colors its pill', async () => {
    const felix = profile();
    const repo = await repoWith([felix]);
    await repo.saveList(list(felix.id, { words: ['Rhythm', 'necessary'] }));
    await repo.addAttempts(['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => attempt(felix.id, 'rhythm', d)));
    await repo.saveSession({
      id: 's1',
      profileId: felix.id,
      game: 'scramble',
      mode: 'normal',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      localDate: localDate(new Date()),
      points: 10,
      stars: 3,
      trickyCount: 0,
    });
    const user = renderAt(`/parent/progress/${felix.id}`, repo);
    await typePin(user, PARENT_PIN);

    expect(await screen.findByText('Mastered 1')).toBeInTheDocument();
    expect(screen.getByText('New 1')).toBeInTheDocument();
    expect(screen.getByText('Rhythm')).toHaveClass('bg-mastered-bg');
    expect(screen.getByText(/Current streak/)).toHaveTextContent('1');
  });
});

describe('Forgot / change parent PIN', () => {
  it('Forgot PIN? re-verifies by emailed code, then sets a new PIN; the old one stops working', async () => {
    const repo = await repoWith([profile()], { pinSet: false });
    await repo.setParentPinHash(await hashPin(PARENT_PIN, 'owner-1'));
    const auth = stubAuth({ signedIn: true, userId: 'owner-1', email: 'mom@example.com' });
    const user = renderAt('/parent', repo, auth);

    await user.click(await screen.findByRole('button', { name: 'Forgot PIN?' }));
    await user.click(await screen.findByRole('button', { name: 'Email me a code' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'mom@example.com', options: { shouldCreateUser: false } });

    auth.verifyOtp.mockResolvedValueOnce({ error: { message: 'Token has expired or is invalid' } });
    await user.type(await screen.findByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('6-digit code'));
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ email: 'mom@example.com', token: '123456', type: 'email' });

    expect(await screen.findByText('Set a parent PIN')).toBeInTheDocument();
    await typePin(user, '5678');
    await screen.findByText('Enter it again');
    await typePin(user, '5678');
    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();

    const stored = await repo.getParentPinHash();
    expect(stored).toBe(await hashPin('5678', 'owner-1'));
    expect(stored).not.toBe(await hashPin(PARENT_PIN, 'owner-1'));
  });

  it('in demo mode (no auth client), Forgot PIN? goes straight to setting a new PIN', async () => {
    const repo = await repoWith();
    window.history.pushState({}, '', '/parent');
    render(<App repo={repo} authClient={null} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Forgot PIN?' }));
    expect(await screen.findByText('Set a parent PIN')).toBeInTheDocument();
  });

  it('Change parent PIN from the parent home sets a new PIN', async () => {
    const repo = await repoWith([profile()]);
    const user = renderAt('/parent', repo);
    await typePin(user, PARENT_PIN);
    await user.click(await screen.findByRole('button', { name: 'Change parent PIN' }));
    expect(await screen.findByText('Set a parent PIN')).toBeInTheDocument();
    await typePin(user, '8642');
    await screen.findByText('Enter it again');
    await typePin(user, '8642');
    expect(await screen.findByRole('heading', { name: 'Parent' })).toBeInTheDocument();
    expect(await repo.getParentPinHash()).toBe(await hashPin('8642', 'parent'));
  });
});
