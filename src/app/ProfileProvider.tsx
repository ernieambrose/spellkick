import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '../engine/types';
import { useAuth } from './authContext';
import { ProfileContext } from './profileContext';
import { useRepo } from './repoContext';

const STORAGE_KEY = 'spellkick.activeProfile';

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
function readActiveId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore: the choice just won't survive a reload
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const repo = useRepo();
  const { status } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(readActiveId);
  const [profile, setProfile] = useState<Profile | null>(null);

  const select = useCallback((id: string) => {
    writeActiveId(id);
    setActiveId(id);
  }, []);

  const clear = useCallback(() => {
    writeActiveId(null);
    setActiveId(null);
  }, []);

  useEffect(() => {
    if (!activeId || status !== 'signedIn') return; // `value` below already hides a stale profile
    let live = true;
    repo.listProfiles().then(
      (profiles) => {
        if (!live) return;
        const found = profiles.find((p) => p.id === activeId) ?? null;
        setProfile(found);
        if (!found) clear(); // the profile was deleted
      },
      () => {}, // offline or signed out: keep the id, show no profile
    );
    return () => {
      live = false;
    };
  }, [activeId, status, repo, clear]);

  const value = useMemo(
    () => ({ activeId, profile: profile?.id === activeId ? profile : null, select, clear }),
    [activeId, profile, select, clear],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
