import { act, fireEvent, render, screen } from '@testing-library/react';
import type { SessionWord } from '../../src/engine/selection';
import { SpotMisspelling } from '../../src/screens/Games/SpotMisspelling';

const WORDS = ['necessary', 'because', 'friend', 'island', 'answer', 'separate'];
const dictionary = new Set(WORDS.map((w) => w.toLowerCase()));

function sessionWord(word: string): SessionWord {
  return { word, role: 'current', listId: 'list-1', state: 'new' };
}

async function setup(opts: { word?: string; allWords?: string[]; fallbackWords?: string[] } = {}) {
  const word = opts.word ?? 'necessary';
  const onResult = vi.fn();
  const onSkip = vi.fn();
  render(
    <SpotMisspelling
      word={sessionWord(word)}
      allWords={opts.allWords ?? WORDS}
      fallbackWords={opts.fallbackWords ?? []}
      onResult={onResult}
      onSkip={onSkip}
      timerOn={false}
      dictionary={dictionary}
      seed={7}
    />,
  );
  await act(async () => {}); // let the stub dictionary resolve (waitFor polls with timers, which are faked)
  expect(screen.getByText('Which word is spelled wrong?')).toBeInTheDocument();
  return { onResult, onSkip };
}

const choices = () => screen.getAllByRole('button').map((b) => b.textContent!);
const misspelled = () => choices().find((c) => !dictionary.has(c.toLowerCase()))!;
const tapChoice = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

describe('SpotMisspelling', () => {
  it('shows four choices and exactly one is misspelled', async () => {
    await setup();
    const all = choices();
    expect(all).toHaveLength(4);
    expect(all.filter((c) => !dictionary.has(c.toLowerCase()))).toHaveLength(1);
    expect(all.filter((c) => c.toLowerCase() === 'necessary')).toHaveLength(0); // the correct target is never shown
  });

  it('tapping the misspelling records practice without ending the word, then offers the fix box', async () => {
    const { onResult, onSkip } = await setup();
    tapChoice(misspelled());
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'practice' });
    const input = screen.getByLabelText(/Fix it for a bonus/);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    act(() => vi.advanceTimersByTime(5000));
    expect(onResult).toHaveBeenCalledOnce();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('a correct fix (any case) flashes success then reports clean with the bonus', async () => {
    const { onResult } = await setup();
    tapChoice(misspelled());
    fireEvent.change(screen.getByLabelText(/Fix it for a bonus/), { target: { value: '  Necessary ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText(/Great fix/)).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledTimes(1); // only practice so far
    act(() => vi.advanceTimersByTime(600));
    expect(onResult).toHaveBeenLastCalledWith({ kind: 'clean', spotFix: true });
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('a wrong fix shows the correct spelling then skips', async () => {
    const { onResult, onSkip } = await setup();
    tapChoice(misspelled());
    fireEvent.change(screen.getByLabelText(/Fix it for a bonus/), { target: { value: 'neccesary' } });
    fireEvent.submit(screen.getByLabelText(/Fix it for a bonus/));
    expect(screen.getByText('necessary')).toBeInTheDocument();
    expect(onSkip).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'practice' });
  });

  it('Skip on the fix box shows the correct spelling then skips', async () => {
    const { onSkip } = await setup();
    tapChoice(misspelled());
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('necessary')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('tapping a distractor highlights the real misspelling, shows the word, then reports miss', async () => {
    const { onResult } = await setup();
    const wrong = choices().find((c) => dictionary.has(c.toLowerCase()))!;
    tapChoice(wrong);
    expect(screen.getByText('necessary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: misspelled() }).className).toContain('bg-mastered-bg');
    expect(screen.getByRole('button', { name: wrong }).className).toContain('bg-tricky-bg');
    expect(onResult).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1999));
    expect(onResult).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({ kind: 'miss' });
  });

  it('draws distractors from fallbackWords when allWords has only the target', async () => {
    await setup({ allWords: ['necessary'], fallbackWords: ['because', 'friend', 'island', 'necessary'] });
    const real = choices().filter((c) => dictionary.has(c.toLowerCase()));
    expect(real).toHaveLength(3);
    expect(real.every((c) => ['because', 'friend', 'island'].includes(c))).toBe(true);
  });

  it('keeps distractors distinct and never shows the target', async () => {
    await setup({ allWords: ['necessary', 'Because', 'because', 'friend'], fallbackWords: ['island', 'BECAUSE'] });
    const real = choices().filter((c) => dictionary.has(c.toLowerCase()));
    expect(new Set(real.map((c) => c.toLowerCase())).size).toBe(3);
    expect(real).not.toContain('necessary');
  });

  it('skips once without a result when no misspelling can be made', async () => {
    const onResult = vi.fn();
    const onSkip = vi.fn();
    render(
      <SpotMisspelling
        word={sessionWord('a')}
        allWords={['a']}
        fallbackWords={[]}
        onResult={onResult}
        onSkip={onSkip}
        timerOn={false}
        dictionary={new Set(['a'])}
      />,
    );
    await act(async () => {});
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });
});
