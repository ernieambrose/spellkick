import type { AuthClient } from '../../src/app/authClient';

// A stubbed auth client: starts signed out (or in), records calls, and lets tests set responses.
export function stubAuth(opts: { signedIn?: boolean; userId?: string; email?: string } = {}) {
  let signedIn = opts.signedIn ?? false;
  const listeners = new Set<(signedIn: boolean) => void>();
  const client = {
    signInWithOtp: vi.fn<AuthClient['signInWithOtp']>(async () => ({ error: null })),
    verifyOtp: vi.fn<AuthClient['verifyOtp']>(async () => {
      signedIn = true;
      listeners.forEach((l) => l(true));
      return { error: null };
    }),
    getSession: vi.fn<AuthClient['getSession']>(async () => ({
      signedIn,
      userId: signedIn ? (opts.userId ?? null) : null,
      email: signedIn ? (opts.email ?? null) : null,
    })),
    onAuthStateChange: vi.fn<AuthClient['onAuthStateChange']>((cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }),
    signOut: vi.fn<AuthClient['signOut']>(async () => {
      signedIn = false;
      listeners.forEach((l) => l(false));
      return { error: null };
    }),
  } satisfies AuthClient;
  return client;
}
