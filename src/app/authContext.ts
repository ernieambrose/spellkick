import { createContext, useContext } from 'react';
import type { AuthError } from './authClient';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export interface AuthContextValue {
  status: AuthStatus;
  sendCode(email: string): Promise<{ error: AuthError | null }>;
  verifyCode(email: string, token: string): Promise<{ error: AuthError | null }>;
  signOut(): Promise<void>;
  getUserId(): Promise<string | null>; // the signed-in owner's id; null in demo mode
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
