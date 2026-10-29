import { render, screen, within } from '@testing-library/react';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { BADGES } from '../../src/engine/badges';
import type { Profile, Session } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

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

const day = (n: number) => `2026-10-${String(10 + n).padStart(2, '0')}`;
const sessionOn = (n: number): Session => ({
  id: `s${n}`,
  profileId: felix.id,
  game: 'scramble',
  mode: 'normal',
  startedAt: `${day(n)}T12:00:00.000Z`,
  completedAt: `${day(n)}T12:05:00.000Z`,
  localDate: day(n),
  points: 0,
  stars: 0,
  trickyCount: 0,
});

async function renderAwards(sessions: Session[] = [], earned: string[] = []) {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  for (const s of sessions) await repo.saveSession(s);
  await repo.addAwards(earned.map((badgeId) => ({ profileId: felix.id, badgeId, earnedAt: '2026-10-12T12:00:00.000Z' })));
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', `/kid/${felix.id}/awards`);
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);
}

beforeEach(() => localStorage.clear());

describe('Awards', () => {
  it('shows the earned count and marks unearned badges as locked', async () => {
    await renderAwards([sessionOn(0)], ['first-kick']);
    expect(await screen.findByText(`1 of ${BADGES.length} earned`)).toBeInTheDocument();
    const earned = screen.getByRole('listitem', { name: /First Kick/ });
    expect(within(earned).queryByText('Locked')).not.toBeInTheDocument();
    const locked = screen.getByRole('listitem', { name: /Word Wizard/ });
    expect(within(locked).getByText('Locked')).toBeInTheDocument();
  });

  it('shows Next up with a 6 of 10 progress bar for a best streak of 6', async () => {
    // Best streak 6 with the 3 and 7 day badges already earned: Kickflip Streak (6/10) is the closest unearned badge.
    await renderAwards([0, 1, 2, 3, 4, 5].map(sessionOn), ['first-kick', 'streak-3', 'streak-7']);
    const next = await screen.findByRole('region', { name: 'Next up' });
    expect(within(next).getByText('Kickflip Streak')).toBeInTheDocument();
    expect(within(next).getByText('6 of 10')).toBeInTheDocument();
    expect(within(next).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6');
  });

  it('links back to kid home', async () => {
    await renderAwards();
    expect(await screen.findByRole('link', { name: /Back/ })).toHaveAttribute('href', `/kid/${felix.id}`);
  });
});
