import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileContext, type ActiveProfile } from '../../src/app/profileContext';
import type { SessionWord } from '../../src/engine/selection';
import { Scramble } from '../../src/screens/Games/Scramble';

const sessionWord = (word: string): SessionWord => ({ word, role: 'current', listId: 'list-1', state: 'new' });

const profileCtx = (id: string): ActiveProfile => ({
  activeId: id,
  profile: null,
  loadFailed: false,
  reload: () => {},
  select: () => {},
  clear: () => {},
});

function mount(profileId: string, word = 'necessary') {
  return render(
    <ProfileContext.Provider value={profileCtx(profileId)}>
      <Scramble
        key={word}
        word={sessionWord(word)}
        allWords={[word]}
        fallbackWords={[]}
        onResult={vi.fn()}
        onSkip={vi.fn()}
        timerOn={false}
        seed={42}
      />
    </ProfileContext.Provider>,
  );
}

const input = () => screen.queryByRole('textbox', { name: 'Type the word' });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Scramble: remembers tap or type per kid', () => {
  it('starts on tiles by default', () => {
    mount('kid-1');
    expect(input()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeInTheDocument();
  });

  it('keeps typing mode on the next word, focused, and stores it', () => {
    const { rerender } = mount('kid-1', 'necessary');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(localStorage.getItem('spellkick.scrambleMode.kid-1')).toBe('type');
    rerender(
      <ProfileContext.Provider value={profileCtx('kid-1')}>
        <Scramble
          key="because"
          word={sessionWord('because')}
          allWords={[]}
          fallbackWords={[]}
          onResult={vi.fn()}
          onSkip={vi.fn()}
          timerOn={false}
          seed={42}
        />
      </ProfileContext.Provider>,
    );
    expect(input()).toBeInTheDocument();
    expect(input()).toHaveFocus();
  });

  it('keeps tiles mode on the next word after toggling back', () => {
    const first = mount('kid-1');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use tiles' }));
    expect(localStorage.getItem('spellkick.scrambleMode.kid-1')).toBe('tiles');
    first.unmount();
    mount('kid-1', 'because');
    expect(input()).not.toBeInTheDocument();
  });

  it('persists for the same profile across a fresh mount', () => {
    const first = mount('kid-1');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    first.unmount();
    mount('kid-1');
    expect(input()).toHaveFocus();
  });

  it('keeps separate modes per profile', () => {
    const first = mount('kid-1');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    first.unmount();
    mount('kid-2');
    expect(input()).not.toBeInTheDocument();
  });

  it('falls back to tiles and still toggles when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    mount('kid-1');
    expect(input()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(input()).toBeInTheDocument();
  });
});
