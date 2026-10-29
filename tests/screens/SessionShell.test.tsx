import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Repo } from '../../src/data/repo';
import type { Profile } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

// A test game whose buttons misbehave on purpose: two calls from one handler, or double taps.
vi.mock('../../src/screens/Session/games', () => {
  function TestGame({ word, onResult, onSkip }: import('../../src/screens/Session/games').GameProps) {
    return (
      <div>
        <p>{word.word}</p>
        <button type="button" onClick={() => onResult({ kind: 'clean' })}>
          Correct
        </button>
        <button
          type="button"
          onClick={() => {
            onResult({ kind: 'miss' });
            onSkip();
          }}
        >
          Miss then skip
        </button>
      </div>
    );
  }
  return { GAMES: { scramble: TestGame, misspell: TestGame } };
});

vi.mock('../../src/engine/dictionary', () => ({
  loadDictionary: () => Promise.reject(new Error('offline')),
}));

const felix: Profile = {
  id: 'kid-1',
  name: 'Felix',
  grade: 3,
  generatedLevel: 3,
  pinHash: null,
  timerOn: false,
  theme: 'default',
  createdAt: '2026-10-01T12:00:00.000Z',
};

async function renderAt(path: string, tweak: (repo: Repo) => Repo = (r) => r): Promise<Repo> {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', path);
  render(<App repo={tweak(repo)} authClient={stubAuth({ signedIn: true })} />);
  return repo;
}

beforeEach(() => localStorage.clear());

describe('SessionShell', () => {
  it('onResult(miss) + onSkip() in one handler advances one word and records one attempt', async () => {
    const user = userEvent.setup();
    const repo = await renderAt(`/kid/${felix.id}/play/scramble`);
    await user.click(await screen.findByRole('button', { name: 'Miss then skip' }));
    expect(await screen.findByText('2 of 10')).toBeInTheDocument();
    const attempts = await repo.listAttempts(felix.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].kind).toBe('miss');
  });

  it('a double tap on Correct records one attempt', async () => {
    const repo = await renderAt(`/kid/${felix.id}/play/scramble`);
    const correct = await screen.findByRole('button', { name: 'Correct' });
    correct.click();
    correct.click(); // same render, before React re-renders
    expect(await screen.findByText('2 of 10')).toBeInTheDocument();
    expect(await repo.listAttempts(felix.id)).toHaveLength(1);
  });

  it('shows an error with Try again and a working Go home link when loading fails', async () => {
    const user = userEvent.setup();
    let fail = true;
    await renderAt(`/kid/${felix.id}/play/scramble`, (repo) => ({
      ...repo,
      listLists: (id) => (fail ? Promise.reject(new Error('offline')) : repo.listLists(id)),
    }));
    expect(await screen.findByText(/Couldn't get your words/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 of 10')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to home' }));
    expect(await screen.findByText('Hi, Felix!')).toBeInTheDocument();
  });

  it('Go home leaves the error screen', async () => {
    const user = userEvent.setup();
    await renderAt(`/kid/${felix.id}/play/scramble`, (repo) => ({
      ...repo,
      listLists: () => Promise.reject(new Error('offline')),
    }));
    await user.click(await screen.findByRole('link', { name: 'Go home' }));
    expect(await screen.findByText('Hi, Felix!')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/kid/${felix.id}`);
  });

  it('offers Scramble when Spot the Misspelling cannot load its dictionary', async () => {
    const user = userEvent.setup();
    await renderAt(`/kid/${felix.id}/play/misspell`);
    expect(
      await screen.findByText('Spot the Misspelling needs its word list. Try Scramble instead.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Play Scramble' }));
    expect(await screen.findByText('1 of 10')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/kid/${felix.id}/play/scramble`);
  });

  it('always shows a way home while loading', async () => {
    await renderAt(`/kid/${felix.id}/play/scramble`, (repo) => ({
      ...repo,
      listLists: () => new Promise(() => {}),
    }));
    expect(await screen.findByText(/Getting your words ready/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', `/kid/${felix.id}`);
  });

  it('shows "Couldn\'t get your words" (not a forever spinner) when the kid profile fails to load, and Try again recovers', async () => {
    const user = userEvent.setup();
    let fail = true;
    await renderAt(`/kid/${felix.id}/play/scramble`, (r) => ({
      ...r,
      listProfiles: () => (fail ? Promise.reject(new Error('offline')) : r.listProfiles()),
    }));
    expect(await screen.findByText(/Couldn't get your words/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 of 10')).toBeInTheDocument();
  });
});
