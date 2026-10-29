import { createContext, useContext } from 'react';
import type { Profile } from '../engine/types';

export interface ActiveProfile {
  activeId: string | null; // known synchronously, before the profile loads
  profile: Profile | null;
  loadFailed: boolean; // the active profile couldn't be read (usually offline with nothing cached)
  reload(): void;
  select(id: string): void;
  clear(): void;
}

export const ProfileContext = createContext<ActiveProfile | null>(null);

export function useActiveProfile(): ActiveProfile {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useActiveProfile must be used inside <ProfileProvider>');
  return ctx;
}
