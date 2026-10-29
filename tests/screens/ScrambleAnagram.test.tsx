import { fireEvent, render, screen } from '@testing-library/react';
import type { SessionWord } from '../../src/engine/selection';
import { Scramble } from '../../src/screens/Games/Scramble';

const dict = vi.hoisted(() => ({ load: (): Promise<Set<string>> => Promise.resolve(new Set(['heart', 'earth'])) }));
vi.mock('../../src/engine/dictionary', () => ({ loadDictionary: () => dict.load() }));

const word: SessionWord = { word: 'heart', role: 'current', listId: 'list-1', state: 'new' };

async function setup() {
  const onResult = vi.fn();
  render(
    <Scramble word={word} allWords={['heart']} fallbackWords={[]} onResult={onResult} onSkip={vi.fn()} timerOn={false} seed={42} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
  await new Promise((r) => setTimeout(r, 0)); // let the dictionary load settle
  return { onResult };
}

function typeAnswer(text: string) {
  fireEvent.change(screen.getByLabelText('Type the word'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}

describe('Scramble: a different real word made of the same letters', () => {
  afterEach(() => {
    dict.load = () => Promise.resolve(new Set(['heart', 'earth']));
  });

  it('says so without using a try', async () => {
    await setup();
    typeAnswer('earth');
    expect(screen.getByText("That's a different word — tap Hear it!")).toBeInTheDocument();
    typeAnswer('hreat'); // a real wrong answer is still the first try
    expect(screen.getByText('Not quite. One more try!')).toBeInTheDocument();
    expect(screen.queryByText(/The word is/)).not.toBeInTheDocument();
  });

  it('a non-word anagram still uses a try', async () => {
    await setup();
    typeAnswer('hreat');
    expect(screen.getByText('Not quite. One more try!')).toBeInTheDocument();
    expect(screen.queryByText(/different word/)).not.toBeInTheDocument();
  });

  it('without the dictionary, falls back to counting it as a try', async () => {
    dict.load = () => Promise.reject(new Error('offline'));
    await setup();
    typeAnswer('earth');
    expect(screen.getByText('Not quite. One more try!')).toBeInTheDocument();
    expect(screen.queryByText(/different word/)).not.toBeInTheDocument();
  });
});
