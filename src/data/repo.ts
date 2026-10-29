import type { Attempt, Award, Profile, Session, WordList } from '../engine/types';

export interface Repo {
  listProfiles(): Promise<Profile[]>;
  saveProfile(p: Profile): Promise<void>; // upsert
  deleteProfile(id: string): Promise<void>;
  setGeneratedLevel(profileId: string, level: number): Promise<void>; // only this field, so other edits survive
  listLists(profileId: string): Promise<WordList[]>;
  saveList(l: WordList): Promise<void>; // upsert (words array included)
  deleteList(id: string): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
  addAttempts(a: Attempt[]): Promise<void>; // idempotent by id
  listSessions(profileId: string): Promise<Session[]>;
  saveSession(s: Session): Promise<void>; // idempotent by id
  listAwards(profileId: string): Promise<Award[]>;
  addAwards(a: Award[]): Promise<void>; // idempotent by (profileId, badgeId)
  getParentPinHash(): Promise<string | null>;
  setParentPinHash(h: string): Promise<void>;
}
