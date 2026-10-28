import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createMemoryRepo } from '../../src/data/memoryRepo';
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

    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'mom@example.com',
      token: '123456',
      type: 'email',
    });
    expect(await screen.findByText(/No kids yet/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profiles');
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
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument();
  });

  it('shows an error and stays put when the code is wrong', async () => {
    const auth = stubAuth();
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    const user = userEvent.setup();
    render(<App repo={createMemoryRepo()} authClient={auth} />);

    await user.type(await screen.findByLabelText('Email'), 'mom@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/signin');
  });
});
