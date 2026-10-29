import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Profile } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

// The real Scramble, mounted by the session shell through the game registry.
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

// Two lists (current + review) with 10 words each fill every session slot, so each word is known.
const current = ['necessary', 'because', 'friend', 'island', 'answer', 'library', 'February', 'beautiful', 'calendar', 'weird'];
const review = ['separate', 'believe', 'tomorrow', 'different', 'surprise', 'thought', 'enough', 'people', 'favorite', 'minute'];
const listWords = [...current, ...review];
const sorted = (s: string) => [...s.toUpperCase().replace(/[\s'’-]/g, '')].sort().join('');

beforeEach(() => localStorage.clear());

it('plays one word of a real Scramble session and records a clean attempt', async () => {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  const list = { profileId: felix.id, source: 'school' as const, author: null, createdAt: '2026-10-20T12:00:00.000Z' };
  await repo.saveList({ ...list, id: 'list-1', name: 'Week 9', testDate: '2099-01-01', words: current });
  await repo.saveList({ ...list, id: 'list-2', name: 'Week 8', testDate: null, words: review });
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', `/kid/${felix.id}/play/scramble`);
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);

  const tray = within(await screen.findByRole('group', { name: 'Letter tiles' }));
  const tiles = tray
    .getAllByRole('button')
    .map((b) => b.textContent)
    .join('');
  // Work out which list word it is from its tiles (the word is never shown before an answer).
  const matches = listWords.filter((w) => sorted(w) === sorted(tiles));
  expect(matches).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Type the word' }), { target: { value: matches[0] } });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  expect(screen.getByText(/Great job/)).toBeInTheDocument();

  expect(await screen.findByText('2 of 10')).toBeInTheDocument(); // after the 600 ms success flash
  const attempts = await repo.listAttempts(felix.id);
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ word: matches[0].toLowerCase(), kind: 'clean' }); // the repo stores words normalized
});
