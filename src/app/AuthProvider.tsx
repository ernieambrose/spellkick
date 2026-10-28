import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext';
import { defaultAuthClient, type AuthClient } from './authClient';

interface Props {
  client?: AuthClient | null; // undefined = the Supabase client (or demo mode when unconfigured)
  children: ReactNode;
}

export function AuthProvider({ client: clientProp, children }: Props) {
  const client = clientProp === undefined ? defaultAuthClient : clientProp;
  const [status, setStatus] = useState<AuthStatus>(client ? 'loading' : 'signedIn');

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
        if (!res.error) setStatus('signedIn');
        return res;
      },
      async signOut() {
        if (!client) return;
        await client.signOut();
        setStatus('signedOut');
      },
      async getUserId() {
        if (!client) return null;
        return (await client.getSession()).userId ?? null;
      },
    }),
    [client, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
