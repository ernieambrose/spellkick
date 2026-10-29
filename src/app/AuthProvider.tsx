import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isOfflineRepo } from '../data/offlineRepo';
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext';
import { defaultAuthClient, type AuthClient } from './authClient';
import { RepoContext } from './repoContext';

interface Props {
  client?: AuthClient | null; // undefined = the Supabase client (or demo mode when unconfigured)
  children: ReactNode;
}

export function AuthProvider({ client: clientProp, children }: Props) {
  const client = clientProp === undefined ? defaultAuthClient : clientProp;
  const [status, setStatus] = useState<AuthStatus>(client ? 'loading' : 'signedIn');
  const repo = useContext(RepoContext);

  useEffect(() => {
    if (!client) return;
    let live = true;
    const unsubscribe = client.onAuthStateChange((signedIn) => {
      if (live) setStatus(signedIn ? 'signedIn' : 'signedOut');
    });
    client.getSession().then(
      ({ signedIn }) => live && setStatus(signedIn ? 'signedIn' : 'signedOut'),
      () => live && setStatus('signedOut'),
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      async sendCode(email) {
        if (!client) return { error: null };
        return client.signInWithOtp({ email, options: { shouldCreateUser: false } });
      },
      async verifyCode(email, token) {
        if (!client) return { error: null };
        const res = await client.verifyOtp({ email, token, type: 'email' });
        if (!res.error) {
          setStatus('signedIn');
          if (repo && isOfflineRepo(repo)) void repo.flush(); // practice queued while signed out
        }
        return res;
      },
      async signOut() {
        if (!client) return;
        await client.signOut();
        setStatus('signedOut');
      },
      async getUser() {
        if (!client) return null;
        const s = await client.getSession();
        return { id: s.userId ?? null, email: s.email ?? null };
      },
    }),
    [client, status, repo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
