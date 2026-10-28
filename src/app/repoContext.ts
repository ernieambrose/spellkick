import { createContext, useContext } from 'react';
import type { Repo } from '../data/repo';

export const RepoContext = createContext<Repo | null>(null);

export function useRepo(): Repo {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepo must be used inside <RepoProvider>');
  return repo;
}
