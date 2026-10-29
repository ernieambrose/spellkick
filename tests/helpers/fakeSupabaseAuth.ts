import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

type Session = { user: { id: string; email?: string } } | null;
type Listener = (event: string, session: Session) => void;

/**
 * The slice of a Supabase client's `auth` that createSupabaseAuthClient touches, with a local
 * storage of the saved session. `offlineExpired` mimics an installed app opened offline after the
 * access token expired: getSession can't refresh, so it reports no session plus a retryable error,
 * while the session stays saved.
 */
export function fakeSupabaseAuth(opts: { stored?: Session; offlineExpired?: boolean } = {}) {
  const saved = new Map<string, string>();
  if (opts.stored) saved.set('sb-test-auth-token', JSON.stringify(opts.stored));
  const listeners = new Set<Listener>();
  const auth = {
    storageKey: 'sb-test-auth-token',
    storage: { getItem: (k: string) => saved.get(k) ?? null },
    getSession: vi.fn(async () => {
      if (opts.offlineExpired) {
        return { data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) };
      }
      return { data: { session: opts.stored ?? null }, error: null };
    }),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signOut: vi.fn(async (_opts?: { scope?: string }) => {
      saved.clear();
      return { error: null };
    }),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
  };
  const emit = (event: string, session: Session) => listeners.forEach((l) => l(event, session));
  return { db: { auth } as unknown as SupabaseClient, auth, emit };
}
