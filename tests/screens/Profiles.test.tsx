import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Repo } from '../../src/data/repo';
import { hashPin } from '../../src/engine/pin';
import type { Profile } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

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

async function repoWith(...profiles: Profile[]): Promise<Repo> {
  const repo = createMemoryRepo();
  for (const p of profiles) await repo.saveProfile(p);
  return repo;
}

function renderAt(path: string, repo: Repo) {
  window.history.pushState({}, '', path);
  return render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);
}

beforeEach(() => localStorage.clear());

describe('Profiles', () => {
  it('shows each profile name', async () => {
    renderAt('/profiles', await repoWith(profile({ name: 'Felix' }), profile({ name: 'Junie' })));
    expect(await screen.findByText('Felix')).toBeInTheDocument();
    expect(screen.getByText('Junie')).toBeInTheDocument();
  });

  it('shows a friendly empty state and a Parent button when there are no profiles', async () => {
    renderAt('/profiles', await repoWith());
    expect(await screen.findByText(/No kids yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parent' })).toHaveAttribute('href', '/parent');
  });

  it('routes straight to /kid/:id for a profile without a PIN, and remembers it', async () => {
    const felix = profile({ name: 'Felix' });
    const user = userEvent.setup();
    renderAt('/profiles', await repoWith(felix));
    await user.click(await screen.findByRole('button', { name: /Felix/ }));
    expect(await screen.findByText('Hi, Felix!')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/kid/${felix.id}`);
    expect(localStorage.getItem('spellkick.activeProfile')).toBe(felix.id);
  });

  it('with a PIN: a wrong PIN shows "Try again" and does not route; the right PIN routes', async () => {
    const junie = profile({ name: 'Junie' });
    junie.pinHash = await hashPin('2468', junie.id);
    const user = userEvent.setup();
    renderAt('/profiles', await repoWith(junie));

    await user.click(await screen.findByRole('button', { name: /Junie/ }));
    for (const d of '1111') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByText('Try again')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profiles');

    for (const d of '2468') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByText('Hi, Junie!')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/kid/${junie.id}`);
  });

  it('sends a signed-in user with an active profile from / to that kid', async () => {
    const felix = profile({ name: 'Felix' });
    localStorage.setItem('spellkick.activeProfile', felix.id);
    renderAt('/', await repoWith(felix));
    expect(await screen.findByText('Hi, Felix!')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/kid/${felix.id}`);
  });

  it('does not open a kid screen that is not the active profile (no PIN bypass by URL)', async () => {
    const junie = profile({ name: 'Junie', pinHash: 'x' });
    renderAt(`/kid/${junie.id}`, await repoWith(junie));
    expect(await screen.findByText('Junie')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profiles');
  });

  it('Switch kid clears the active profile and returns to the picker', async () => {
    const felix = profile({ name: 'Felix' });
    localStorage.setItem('spellkick.activeProfile', felix.id);
    const user = userEvent.setup();
    renderAt(`/kid/${felix.id}`, await repoWith(felix));
    await user.click(await screen.findByRole('button', { name: 'Switch kid' }));
    expect(window.location.pathname).toBe('/profiles');
    expect(localStorage.getItem('spellkick.activeProfile')).toBeNull();
  });
});
