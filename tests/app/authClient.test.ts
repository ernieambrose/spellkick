import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { createSupabaseAuthClient } from '../../src/app/authClient';
import { fakeSupabaseAuth } from '../helpers/fakeSupabaseAuth';

const stored = { user: { id: 'owner-1', email: 'mom@example.com' } };

describe('createSupabaseAuthClient', () => {
  it('reports a live session as signed in', async () => {
    const { db } = fakeSupabaseAuth({ stored });
    expect(await createSupabaseAuthClient(db).getSession()).toEqual({
      signedIn: true,
      userId: 'owner-1',
      email: 'mom@example.com',
    });
  });

  it('opened offline after the token expired: still signed in, with the stored user', async () => {
    const { db } = fakeSupabaseAuth({ stored, offlineExpired: true });
    expect(await createSupabaseAuthClient(db).getSession()).toEqual({
      signedIn: true,
      userId: 'owner-1',
      email: 'mom@example.com',
    });
  });

  it('a retryable error with nothing stored is signed out', async () => {
    const { db } = fakeSupabaseAuth({ offlineExpired: true });
    expect((await createSupabaseAuthClient(db).getSession()).signedIn).toBe(false);
  });

  it('no session and no error is signed out', async () => {
    const { db } = fakeSupabaseAuth();
    expect((await createSupabaseAuthClient(db).getSession()).signedIn).toBe(false);
  });

  it('ignores the null INITIAL_SESSION event (getSession decides), but passes SIGNED_OUT on', () => {
    const { db, emit } = fakeSupabaseAuth({ stored, offlineExpired: true });
    const cb = vi.fn();
    createSupabaseAuthClient(db).onAuthStateChange(cb);
    emit('INITIAL_SESSION', null);
    expect(cb).not.toHaveBeenCalled();
    emit('SIGNED_IN', stored);
    emit('SIGNED_OUT', null);
    expect(cb.mock.calls).toEqual([[true], [false]]);
  });

  describe('signOut', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('offline: signs out locally only', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const { db, auth } = fakeSupabaseAuth({ stored });
      expect(await createSupabaseAuthClient(db).signOut()).toEqual({ error: null });
      expect(auth.signOut.mock.calls).toEqual([[{ scope: 'local' }]]);
      expect(auth.storage.getItem(auth.storageKey)).toBeNull();
    });

    it('online: a global sign-out (revokes the refresh token) and nothing else', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const { db, auth } = fakeSupabaseAuth({ stored });
      expect(await createSupabaseAuthClient(db).signOut()).toEqual({ error: null });
      expect(auth.signOut.mock.calls).toEqual([[]]);
    });

    it('online but the request fails on the network: falls back to a local sign-out', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const { db, auth } = fakeSupabaseAuth({ stored });
      auth.signOut.mockResolvedValueOnce({ error: new AuthRetryableFetchError('Failed to fetch', 0) as never });
      expect(await createSupabaseAuthClient(db).signOut()).toEqual({ error: null });
      expect(auth.signOut.mock.calls).toEqual([[], [{ scope: 'local' }]]);
      expect(auth.storage.getItem(auth.storageKey)).toBeNull();
    });

    it('online with a non-network error: returns that error without retrying', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const { db, auth } = fakeSupabaseAuth({ stored });
      auth.signOut.mockResolvedValueOnce({ error: { message: 'boom' } as never });
      expect(await createSupabaseAuthClient(db).signOut()).toEqual({ error: { message: 'boom' } });
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });
  });
});
