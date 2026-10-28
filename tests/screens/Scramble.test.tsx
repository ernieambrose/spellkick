import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionWord } from '../../src/engine/selection';
import { Scramble } from '../../src/screens/Games/Scramble';

function sessionWord(word: string): SessionWord {
  return { word, role: 'current', listId: 'list-1', state: 'new' };
}

function setup(word: string) {
  const onResult = vi.fn();
  const onSkip = vi.fn();
  render(
    <Scramble
      word={sessionWord(word)}
      allWords={[word]}
      fallbackWords={[]}
      onResult={onResult}
      onSkip={onSkip}
      timerOn={false}
      seed={42}
    />,
  );
  return { onResult, onSkip };
}

const tray = () => within(screen.getByRole('group', { name: 'Letter tiles' }));
const answer = () => within(screen.getByRole('group', { name: 'Your answer' }));
const trayLetters = () =>
  tray()
    .queryAllByRole('button')
    .map((b) => b.textContent);

// Fill every empty slot with the right letter, taking the first matching tile in the tray.
function solve(target: string) {
  const slots = answer().getAllByRole('button');
  for (let i = 0; i < target.length; i++) {
    if (slots[i].textContent) continue;
    fireEvent.click(tray().getAllByRole('button', { name: target[i] })[0]);
  }
}

// Fill the slots in tray order: always wrong, since a scramble is never the word itself.
function fillInTrayOrder() {
  while (tray().queryAllByRole('button').length > 0) fireEvent.click(tray().getAllByRole('button')[0]);
}

function mockSpeech() {
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
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
  return { speak, cancel };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Scramble', () => {
  it('shows tiles with exactly the word letters', () => {
    setup('necessary');
    expect(trayLetters().sort().join('')).toBe('ACEENRSSY');
    expect(answer().getAllByRole('button')).toHaveLength(9);
  });

  it('strips punctuation from the tiles', () => {
    setup("don't");
    expect(trayLetters().sort().join('')).toBe('DNOT');
  });

  it('a tapped tile fills the next slot and a tapped slot returns it to the tray', () => {
    setup('cat');
    const first = trayLetters()[0];
    fireEvent.click(tray().getAllByRole('button')[0]);
    expect(answer().getAllByRole('button')[0]).toHaveTextContent(first!);
    expect(trayLetters()).toHaveLength(2);
    fireEvent.click(answer().getAllByRole('button')[0]);
    expect(answer().getAllByRole('button')[0]).toHaveTextContent('');
    expect(trayLetters()).toHaveLength(3);
  });

  it('solving with tiles and no hints reports clean after a success flash', () => {
    const { onResult } = setup('necessary');
    solve('NECESSARY');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText(/Great job/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'clean' });
  });

  it('a hint locks the first letter and solving then reports hinted', () => {
    const { onResult } = setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    const firstSlot = answer().getAllByRole('button')[0];
    expect(firstSlot).toHaveTextContent('N');
    fireEvent.click(firstSlot); // locked: stays put
    expect(firstSlot).toHaveTextContent('N');
    solve('NECESSARY');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'hinted' });
  });

  it('the second hint speaks the word when speech is available', () => {
    const { speak, cancel } = mockSpeech();
    const { onResult } = setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hear it' }));
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'necessary', lang: 'en-US', rate: 0.85 });
    expect(answer().getAllByRole('button')[1]).toHaveTextContent('');
    solve('NECESSARY');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'hinted' });
  });

  it('without speech, Hear it is hidden and the second hint reveals the next letter', () => {
    setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.queryByRole('button', { name: 'Hear it' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next letter' }));
    const slots = answer().getAllByRole('button');
    expect(slots[0]).toHaveTextContent('N');
    expect(slots[1]).toHaveTextContent('E');
  });

  it('a wrong check clears the slots for one retry; a second wrong shows the word, then miss', () => {
    const { onResult } = setup('necessary');
    fillInTrayOrder();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onResult).not.toHaveBeenCalled();
    expect(trayLetters()).toHaveLength(9);
    fillInTrayOrder();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('necessary')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1999));
    expect(onResult).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'miss' });
  });

  it('a wrong check keeps a locked hint letter', () => {
    setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    fillInTrayOrder();
    const filled = answer()
      .getAllByRole('button')
      .map((b) => b.textContent)
      .join('');
    expect(filled).not.toBe('NECESSARY'); // seed 42 leaves the tray in a wrong order
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(answer().getAllByRole('button')[0]).toHaveTextContent('N');
    expect(trayLetters()).toHaveLength(8);
  });

  it('typing mode accepts "Necessary" for "necessary"', () => {
    const { onResult } = setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    const input = screen.getByRole('textbox', { name: 'Type the word' });
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    fireEvent.change(input, { target: { value: 'Necessary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'clean' });
  });

  it('typing mode ignores the apostrophe: "dont" matches "don\'t"', () => {
    const { onResult } = setup("don't");
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    const input = screen.getByRole('textbox', { name: 'Type the word' });
    fireEvent.change(input, { target: { value: 'dont' } });
    fireEvent.submit(input);
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'clean' });
  });

  it('typing mode: two wrong tries is a miss', () => {
    const { onResult } = setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    const input = screen.getByRole('textbox', { name: 'Type the word' });
    fireEvent.change(input, { target: { value: 'neccesary' } });
    fireEvent.submit(input);
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'nesesary' } });
    fireEvent.submit(input);
    act(() => vi.advanceTimersByTime(2000));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'miss' });
  });

  it('an unscramblable word is skipped once without a result', () => {
    const { onResult, onSkip } = setup('aa');
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });
});
