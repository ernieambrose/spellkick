import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
import { createOfflineRepo, type KeyValueStore } from '../../src/data/offlineRepo';
import type { Attempt } from '../../src/engine/types';
import { stubAuth } from '../helpers/auth';

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('SignIn', () => {
  it('sends users who are not signed in to /signin', async () => {
    render(<App repo={createMemoryRepo()} authClient={stubAuth()} />);
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/signin');
    expect(screen.queryByText(/sign up|password/i)).not.toBeInTheDocument();
  });

  it('asks for a code (no new users), then verifies the typed code and leaves /signin', async () => {
    const auth = stubAuth();
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={auth} />);

    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'mom@example.com',
      options: { shouldCreateUser: false },
    });

    await user.type(await screen.findByLabelText('Code from the email'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'mom@example.com',
      token: '123456',
      type: 'email',
    });
    expect(await screen.findByText(/No kids yet/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profiles');
  });

  it.each(['123456', '1234567', '12345678'])('accepts the code %s (Supabase codes are 6 to 8 digits)', async (code) => {
    const auth = stubAuth();
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={auth} />);
    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code from the email'), code);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'mom@example.com', token: code, type: 'email' });
  });

  it('keeps Sign in off under 6 digits and stops at 8', async () => {
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={stubAuth()} />);
    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    const input = await screen.findByLabelText('Code from the email');
    await user.type(input, '12345');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await user.type(input, '6789');
    expect(input).toHaveValue('12345678');
  });

  it('tells an unknown email it is not set up', async () => {
    const auth = stubAuth();
    auth.signInWithOtp.mockResolvedValue({
      error: { message: 'Signups not allowed for otp', code: 'otp_disabled' },
    });
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={auth} />);

    await user.type(await screen.findByLabelText('Email'), 'stranger@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText("This email isn't set up for SpellKick.")).toBeInTheDocument();
    expect(screen.queryByLabelText('Code from the email')).not.toBeInTheDocument();
  });

  it('shows an error and stays put when the code is wrong', async () => {
    const auth = stubAuth();
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={auth} />);

    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code from the email'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/signin');
  });

  it('sends practice queued while signed out as soon as the code is verified', async () => {
    const m = new Map<string, unknown>();
    const store: KeyValueStore = { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v), del: async (k) => void m.delete(k) };
    const mem = createMemoryRepo();
    const auth = stubAuth();
    const repo = createOfflineRepo(mem, store, async () => (await auth.getSession()).signedIn);
    const queued: Attempt = {
      id: 'a1', profileId: 'p1', sessionId: 's1', word: 'rhythm', listId: null, game: 'scramble',
      kind: 'clean', ms: null, localDate: '2026-10-28', createdAt: '2026-10-28T12:00:00.000Z',
    };
    await repo.addAttempts([queued]);
    expect(await repo.pending()).toBe(1);

    const user = userEvent.setup();
    render(<App repo={repo} authClient={auth} />);
    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code from the email'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText(/No kids yet/);
    await vi.waitFor(async () => expect(await mem.listAttempts('p1')).toHaveLength(1));
    expect(await repo.pending()).toBe(0);
  });
});
