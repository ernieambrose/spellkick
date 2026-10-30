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

  it('Hear it speaks the word in US English and does not count as a hint', () => {
    const { speak, cancel } = mockSpeech();
    const { onResult } = setup('necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Hear it' }));
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'necessary', lang: 'en-US', rate: 0.85 });
    expect(answer().getAllByRole('button')[0]).toHaveTextContent('');
    solve('NECESSARY');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'clean' });
  });

  it('Hear it is hidden when speech is unsupported', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    setup('necessary');
    expect(screen.queryByRole('button', { name: 'Hear it' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument();
  });

  it('Hint twice locks two letters, then is disabled, and solving reports hinted', () => {
    mockSpeech();
    const { onResult } = setup('necessary');
    const hint = screen.getByRole('button', { name: 'Hint' });
    fireEvent.click(hint);
    fireEvent.click(hint);
    const slots = answer().getAllByRole('button');
    expect(slots[0]).toHaveTextContent('N');
    expect(slots[1]).toHaveTextContent('E');
    expect(hint).toBeDisabled();
    solve('NECESSARY');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'hinted' });
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

  describe('Hint reveals the letter the kid is stuck on', () => {
    const clickTile = (letter: string) => fireEvent.click(tray().getAllByRole('button', { name: letter })[0]);
    const hintButton = () => screen.getByRole('button', { name: 'Hint' });
    const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    it('skips the kid\'s correct letters and reveals the third; result is hinted', () => {
      const { onResult } = setup('necessary');
      clickTile('N');
      clickTile('E');
      fireEvent.click(hintButton());
      const slots = answer().getAllByRole('button');
      expect(slots[0]).toHaveTextContent('N');
      expect(slots[1]).toHaveTextContent('E');
      expect(slots[2]).toHaveTextContent('C');
      fireEvent.click(slots[1]); // own correct letters before the hint are locked too
      expect(slots[1]).toHaveTextContent('E');
      solve('NECESSARY');
      check();
      act(() => vi.advanceTimersByTime(600));
      expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'hinted' });
    });

    it('replaces a wrong letter and returns the wrong tile to the tray', () => {
      setup('necessary');
      clickTile('N');
      clickTile('S'); // wrong: slot 1 should be E
      const before = trayLetters().length;
      fireEvent.click(hintButton());
      const slots = answer().getAllByRole('button');
      expect(slots[0]).toHaveTextContent('N');
      expect(slots[1]).toHaveTextContent('E');
      expect(trayLetters()).toHaveLength(before); // E left the tray, S came back
      expect(trayLetters()).toContain('S');
    });

    it('typing mode: with "NE" typed, reveals the third letter', () => {
      setup('necessary');
      fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
      const input = screen.getByRole('textbox', { name: 'Type the word' });
      fireEvent.change(input, { target: { value: 'ne' } });
      fireEvent.click(hintButton());
      expect(input).toHaveValue('NEC');
      expect(screen.getByText('NEC')).toBeInTheDocument(); // "Starts with" line
      fireEvent.change(input, { target: { value: 'x' } }); // can't erase the locked prefix
      expect(input).toHaveValue('NEC');
    });

    it('is disabled after two uses', () => {
      setup('necessary');
      fireEvent.click(hintButton());
      fireEvent.click(hintButton());
      expect(hintButton()).toBeDisabled();
    });

    it('is disabled when every letter is already correct', () => {
      setup('necessary');
      solve('NECESSARY');
      expect(hintButton()).toBeDisabled();
    });

    it('solving with only the kid\'s own letters and no Hint taps reports clean', () => {
      const { onResult } = setup('necessary');
      clickTile('N');
      clickTile('E');
      solve('NECESSARY');
      check();
      act(() => vi.advanceTimersByTime(600));
      expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'clean' });
    });

    it('switching between typing and tiles keeps the locked prefix', () => {
      setup('necessary');
      clickTile('N');
      fireEvent.click(hintButton()); // locks N, then reveals E in slot 1
      fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
      expect(screen.getByRole('textbox', { name: 'Type the word' })).toHaveValue('NE');
      fireEvent.click(screen.getByRole('button', { name: 'Use tiles' }));
      const slots = answer().getAllByRole('button');
      expect(slots[0]).toHaveTextContent('N');
      expect(slots[1]).toHaveTextContent('E');
    });
  });
});
