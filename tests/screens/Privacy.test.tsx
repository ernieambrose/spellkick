import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { stubAuth } from '../helpers/auth';

function renderAt(path: string, signedIn: boolean) {
  window.history.pushState({}, '', path);
  render(<App repo={createMemoryRepo()} authClient={stubAuth({ signedIn })} />);
}

describe('Privacy', () => {
  it('can be read while signed out', async () => {
    renderAt('/privacy', false);
    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText('We never sell or share your information.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'hello@spellkick.app' })[0]).toHaveAttribute(
      'href',
      'mailto:hello@spellkick.app',
    );
  });

  it('is linked from the sign-in screen', async () => {
    const user = userEvent.setup();
    renderAt('/signin', false);
    await user.click(await screen.findByRole('link', { name: 'Privacy' }));
    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
  });
});
