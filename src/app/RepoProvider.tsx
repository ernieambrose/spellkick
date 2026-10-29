import type { ReactNode } from 'react';
import { createMemoryRepo } from '../data/memoryRepo';
import { createOfflineRepo, idbStore } from '../data/offlineRepo';
import type { Repo } from '../data/repo';
import { createSupabaseRepo } from '../data/supabaseRepo';
import { RepoContext } from './repoContext';
import { supabase } from './supabase';

// Without Supabase env vars, fall back to an in-memory repo so `npm run dev` works (demo mode).
const demoMode = supabase === null;
function createDefaultRepo(): Repo {
  const db = supabase;
  if (!db) return createMemoryRepo();
  // Queued writes wait for a session: sent with the anon key, RLS would reject them.
  return createOfflineRepo(createSupabaseRepo(db), idbStore, async () => {
    const { data } = await db.auth.getSession();
    return data.session !== null;
  });
}
const defaultRepo = createDefaultRepo();

interface Props {
  repo?: Repo; // injected in tests
  children: ReactNode;
}

export function RepoProvider({ repo, children }: Props) {
  return (
    <RepoContext.Provider value={repo ?? defaultRepo}>
      {!repo && demoMode && (
        <div role="status" className="bg-tricky-bg px-4 py-2 text-center text-sm text-tricky-text">
          Demo mode: Supabase isn't configured, so nothing is saved after a reload.
        </div>
      )}
      {children}
    </RepoContext.Provider>
  );
}
