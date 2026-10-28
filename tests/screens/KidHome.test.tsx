import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Repo } from '../../src/data/repo';
import { localDate } from '../../src/engine/streak';
import type { Profile, WordList } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

// This file tests the home-to-done flow, not a real game: answer each word with one tap.
vi.mock('../../src/screens/Session/games', async () => {
  const { PlaceholderGame } = await import('../../src/screens/Session/PlaceholderGame');
  return { GAMES: { scramble: PlaceholderGame, misspell: PlaceholderGame } };
});

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

const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDate(d);
};

const list = (over: Partial<WordList> = {}): WordList => ({
  id: crypto.randomUUID(),
  profileId: felix.id,
  name: 'Week 9',
  testDate: null,
  source: 'school',
  author: null,
  words: ['necessary', 'because', 'friend'],
  createdAt: '2026-10-20T12:00:00.000Z',
  ...over,
});

async function renderKid(...lists: WordList[]): Promise<Repo> {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  for (const l of lists) await repo.saveList(l);
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', `/kid/${felix.id}`);
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);
  return repo;
}

beforeEach(() => localStorage.clear());

describe('KidHome', () => {
  it('shows the countdown for a list dated 3 days out', async () => {
    await renderKid(list({ testDate: daysFromToday(3) }));
    expect(await screen.findByText('Test in 3 days')).toBeInTheDocument();
    expect(screen.getByText('Week 9')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 mastered')).toBeInTheDocument();
  });

  it('says "Test tomorrow" for 1 day out', async () => {
    await renderKid(list({ testDate: daysFromToday(1) }));
    expect(await screen.findByText('Test tomorrow')).toBeInTheDocument();
  });

  it('says "Test today" for 0 days out', async () => {
    await renderKid(list({ testDate: daysFromToday(0) }));
    expect(await screen.findByText('Test today')).toBeInTheDocument();
  });

  it('hides the countdown when the list has no date', async () => {
    await renderKid(list());
    expect(await screen.findByText('Week 9')).toBeInTheDocument();
    expect(screen.queryByText(/^Test /)).not.toBeInTheDocument();
  });

  it('offers both games, extra words, and an Awards link', async () => {
    await renderKid();
    expect(await screen.findByText('Hi, Felix!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scramble/ })).toHaveAttribute('href', `/kid/${felix.id}/play/scramble`);
    expect(screen.getByRole('link', { name: /Spot the Misspelling/ })).toHaveAttribute(
      'href',
      `/kid/${felix.id}/play/misspell`,
    );
    expect(screen.getByRole('link', { name: /Practice extra words/ })).toHaveAttribute(
      'href',
      `/kid/${felix.id}/play/scramble?mode=extra`,
    );
    expect(screen.getByRole('link', { name: /Awards/ })).toHaveAttribute('href', `/kid/${felix.id}/awards`);
  });

  it('plays a whole session from home to the done screen', async () => {
    const user = userEvent.setup();
    const repo = await renderKid();
    await user.click(await screen.findByRole('link', { name: /Scramble/ }));
    for (let i = 0; i < 10; i++) await user.click(await screen.findByRole('button', { name: 'Correct' }));
    expect(await screen.findByRole('button', { name: 'Play again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See my awards' })).toBeInTheDocument();
    expect(await screen.findByText(/First Kick/)).toBeInTheDocument();
    expect(await repo.listAttempts(felix.id)).toHaveLength(10);
  });
});
