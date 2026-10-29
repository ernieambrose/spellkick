import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { stubAuth } from '../helpers/auth';

// The whole app on a memory repo: parent sets a PIN, adds a kid and a list, the kid plays a
// Scramble session, and the done screen shows a 1 day streak and the first badge.
// Two 10-word lists (current + review) fill all ten session slots, so every word on screen is known.
const lists = [
  { name: 'Week 9', words: ['necessary', 'because', 'friend', 'island', 'answer', 'library', 'February', 'beautiful', 'calendar', 'weird'] },
  { name: 'Week 8', words: ['separate', 'believe', 'tomorrow', 'different', 'surprise', 'thought', 'enough', 'people', 'favorite', 'minute'] },
];
const known = lists.flatMap((l) => l.words);
const sorted = (s: string) => [...s.toUpperCase().replace(/[\s'’-]/g, '')].sort().join('');

beforeEach(() => localStorage.clear());

it('parent sets up a kid and a list, the kid finishes a Scramble session and earns First Kick', async () => {
  const repo = createMemoryRepo();
  window.history.pushState({}, '', '/parent');
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);
  const user = userEvent.setup();

  // Parent PIN: set, then confirm.
  for (let round = 0; round < 2; round++) {
    for (const d of '1234') await user.click(await screen.findByRole('button', { name: d }));
  }

  // Add a kid.
  await user.click(await screen.findByRole('link', { name: '+ Add kid' }));
  await user.type(await screen.findByLabelText('Name'), 'Felix');
  await user.selectOptions(screen.getByLabelText('Grade'), '3');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  // Add word lists by pasting them. The first is dated in the future so it is the current list.
  for (const [i, list] of lists.entries()) {
    await user.click((await screen.findAllByRole('link', { name: 'Add word list' }))[0]);
    await user.type(await screen.findByLabelText('List name'), list.name);
    if (i === 0) await user.type(screen.getByLabelText('Test date (optional)'), '2099-01-01');
    await user.click(screen.getByLabelText('Words'));
    await user.paste(list.words.join('\n'));
    expect(screen.getByText(`${list.words.length} words`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save list' }));
    expect(await screen.findByText(list.name)).toBeInTheDocument();
  }

  // Pick the kid and start Scramble.
  await user.click(screen.getByRole('link', { name: 'Back to kids' }));
  await user.click(await screen.findByRole('button', { name: /Felix/ }));
  expect(await screen.findByRole('heading', { name: 'Hi, Felix!' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: /Scramble/ }));

  // Solve ten words by reading the tiles (the word is never shown before an answer).
  for (let n = 1; n <= 10; n++) {
    expect(await screen.findByText(`${n} of 10`, {}, { timeout: 3000 })).toBeInTheDocument();
    const tray = within(await screen.findByRole('group', { name: 'Letter tiles' }));
    const tiles = tray
      .getAllByRole('button')
      .map((b) => b.textContent)
      .join('');
    const matches = known.filter((w) => sorted(w) === sorted(tiles));
    expect(matches).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    await user.type(screen.getByRole('textbox', { name: 'Type the word' }), matches[0]);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    if (n < 10) await waitFor(() => expect(screen.queryByText(/Great job/)).not.toBeInTheDocument(), { timeout: 3000 });
  }

  // Done: streak 1 and the First Kick badge.
  expect(await screen.findByRole('heading', { name: 'Nice work!' }, { timeout: 3000 })).toBeInTheDocument();
  expect(screen.getByText('1 day')).toBeInTheDocument();
  expect(screen.getByText('First Kick')).toBeInTheDocument();
}, 40_000);
