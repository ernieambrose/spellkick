import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import type { Repo } from '../../src/data/repo';
import { localDate } from '../../src/engine/streak';
import type { Attempt, Profile, WordList } from '../../src/engine/types';
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

const miss = (word: string, listId: string | null = null): Attempt => ({
  id: crypto.randomUUID(),
  profileId: felix.id,
  sessionId: 's-1',
  word,
  listId,
  game: 'scramble',
  kind: 'miss',
  ms: null,
  localDate: daysFromToday(-1),
  createdAt: '2026-10-30T12:00:00.000Z',
});

async function renderKid(...lists: WordList[]): Promise<Repo> {
  return renderKidWith(lists, []);
}

async function renderKidWith(lists: WordList[], attempts: Attempt[]): Promise<Repo> {
  const repo = createMemoryRepo();
  await repo.saveProfile(felix);
  for (const l of lists) await repo.saveList(l);
  await repo.addAttempts(attempts);
  localStorage.setItem('spellkick.activeProfile', felix.id);
  window.history.pushState({}, '', `/kid/${felix.id}`);
  render(<App repo={repo} authClient={stubAuth({ signedIn: true })} />);
  return repo;
}

function mockSpeech() {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return speak;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

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

  it('counts a missed generated word as tricky, not just list words', async () => {
    await renderKidWith([list()], [miss('because', 'x'), miss('ocean')]);
    expect(await screen.findByRole('button', { name: '2 tricky' })).toBeInTheDocument();
  });

  it('opens the tricky words when the count is tapped, and closes on Escape', async () => {
    const user = userEvent.setup();
    await renderKidWith([list()], [miss('because', 'x'), miss('ocean')]);
    const pill = await screen.findByRole('button', { name: '2 tricky' });
    await user.click(pill);
    const dialog = screen.getByRole('dialog', { name: 'Tricky words' });
    expect(within(dialog).getByText('because')).toBeInTheDocument();
    expect(within(dialog).getByText('ocean')).toBeInTheDocument();
    expect(within(dialog).queryByText('friend')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pill).toHaveFocus();
  });

  it('lists older words to review and closes with the Close button', async () => {
    const user = userEvent.setup();
    await renderKid(
      list({ name: 'Week 8', words: ['island'], createdAt: '2026-10-10T12:00:00.000Z' }),
      list({ testDate: daysFromToday(3) }),
    );
    await user.click(await screen.findByRole('button', { name: '1 to review' }));
    const dialog = screen.getByRole('dialog', { name: 'Words to review' });
    expect(within(dialog).getByText('island')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not make an empty count tappable', async () => {
    await renderKid(list());
    expect(await screen.findByText('0 mastered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '0 mastered' })).not.toBeInTheDocument();
  });

  it('labels built-in words as bonus words and reads a word aloud', async () => {
    const user = userEvent.setup();
    const speak = mockSpeech();
    await renderKidWith([list()], [miss('because', 'x'), miss('ocean')]);
    await user.click(await screen.findByRole('button', { name: '2 tricky' }));
    const dialog = screen.getByRole('dialog', { name: 'Tricky words' });
    const [because, ocean] = within(dialog).getAllByRole('listitem');
    expect(within(because).queryByText('bonus word')).not.toBeInTheDocument();
    expect(within(ocean).getByText('bonus word')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Hear ocean' }));
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'ocean' });
  });
});
