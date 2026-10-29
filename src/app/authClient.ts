import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthError {
  message: string;
  code?: string;
}

// The slice of supabase.auth the app uses, so tests can stub it.
export interface AuthClient {
  signInWithOtp(args: {
    email: string;
    options: { shouldCreateUser: false };
  }): Promise<{ error: AuthError | null }>;
  verifyOtp(args: { email: string; token: string; type: 'email' }): Promise<{ error: AuthError | null }>;
  getSession(): Promise<{ signedIn: boolean; userId?: string | null; email?: string | null }>;
  onAuthStateChange(cb: (signedIn: boolean) => void): () => void; // returns unsubscribe
  signOut(): Promise<{ error: AuthError | null }>;
}

type StoredUser = { id: string; email?: string | null };

/**
 * The session supabase-js keeps in its storage. A refresh that fails offline leaves it there but
 * getSession reports none, so this reads it directly (`storage`/`storageKey` are protected fields).
 */
async function readStoredUser(db: SupabaseClient): Promise<StoredUser | null> {
  try {
    const { storage, storageKey } = db.auth as unknown as {
      storage: { getItem(k: string): string | null | Promise<string | null> };
      storageKey: string;
    };
    const raw = await storage.getItem(storageKey);
    const user = raw ? (JSON.parse(raw) as { user?: StoredUser }).user : undefined;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function createSupabaseAuthClient(db: SupabaseClient): AuthClient {
  return {
    signInWithOtp: (args) => db.auth.signInWithOtp(args),
    verifyOtp: (args) => db.auth.verifyOtp(args),
    async getSession() {
      const { data, error } = await db.auth.getSession();
      // Opened offline after the token expired: the refresh can't reach the server, so keep the
      // stored session (the app works offline; the next online refresh settles it).
      const user =
        data.session?.user ??
        (error && (isAuthRetryableFetchError(error) || offline()) ? await readStoredUser(db) : null);
      return { signedIn: !!user, userId: user?.id ?? null, email: user?.email ?? null };
    },
    onAuthStateChange(cb) {
      // A null INITIAL_SESSION is what an offline failed refresh looks like; getSession decides that.
      const { data } = db.auth.onAuthStateChange((event, session) => {
        if (session) cb(true);
        else if (event === 'SIGNED_OUT') cb(false);
      });
      return () => data.subscription.unsubscribe();
    },
    signOut: () => db.auth.signOut(),
  };
}

// null in demo mode (no Supabase env vars): the app treats the user as signed in.
export const defaultAuthClient: AuthClient | null = supabase ? createSupabaseAuthClient(supabase) : null;
