import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Profile } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

// The real Spot the Misspelling, mounted by the session shell through the game registry.
const current = ['necessary', 'because', 'friend', 'island', 'answer', 'library', 'February', 'beautiful', 'calendar', 'weird'];
const review = ['separate', 'believe', 'tomorrow', 'different', 'surprise', 'thought', 'enough', 'people', 'favorite', 'minute'];
const listWords = [...current, ...review];
const dict = new Set(listWords.map((w) => w.toLowerCase()));

vi.mock('../../src/engine/dictionary', () => ({ loadDictionary: () => Promise.resolve(dict) }));

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

beforeEach(() => localStorage.clear());

it('plays one word of a real Spot the Misspelling session and records a practice attempt', async () => {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  const list = { profileId: felix.id, source: 'school' as const, author: null, createdAt: '2026-10-20T12:00:00.000Z' };
  await repo.saveList({ ...list, id: 'list-1', name: 'Week 9', testDate: '2099-01-01', words: current });
  await repo.saveList({ ...list, id: 'list-2', name: 'Week 8', testDate: null, words: review });
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', `/kid/${felix.id}/play/misspell`);
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);

  await screen.findByText('Which word is spelled wrong?');
  const bad = screen
    .getAllByRole('button')
    .map((b) => b.textContent!)
    .find((c) => !dict.has(c.toLowerCase()))!;
  fireEvent.click(screen.getByRole('button', { name: bad }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

  expect(await screen.findByText('2 of 10', {}, { timeout: 4000 })).toBeInTheDocument(); // after the 2 s reveal
  const attempts = await repo.listAttempts(felix.id);
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ kind: 'practice' });
});
