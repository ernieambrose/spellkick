import type { SupabaseClient } from '@supabase/supabase-js';
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
  getSession(): Promise<{ signedIn: boolean; userId?: string | null }>;
  onAuthStateChange(cb: (signedIn: boolean) => void): () => void; // returns unsubscribe
  signOut(): Promise<{ error: AuthError | null }>;
}

export function createSupabaseAuthClient(db: SupabaseClient): AuthClient {
  return {
    signInWithOtp: (args) => db.auth.signInWithOtp(args),
    verifyOtp: (args) => db.auth.verifyOtp(args),
    async getSession() {
      const { data } = await db.auth.getSession();
      return { signedIn: data.session !== null, userId: data.session?.user.id ?? null };
    },
    onAuthStateChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => cb(session !== null));
      return () => data.subscription.unsubscribe();
    },
    signOut: () => db.auth.signOut(),
  };
}

// null in demo mode (no Supabase env vars): the app treats the user as signed in.
export const defaultAuthClient: AuthClient | null = supabase ? createSupabaseAuthClient(supabase) : null;
