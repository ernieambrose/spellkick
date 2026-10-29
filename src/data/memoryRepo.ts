import type { Attempt, Award, Profile, Session, WordList } from '../engine/types';
import type { Repo } from './repo';

// In-memory Repo for tests and offline development. Mirrors the Supabase repo's behavior.
export function createMemoryRepo(): Repo {
  const profiles = new Map<string, Profile>();
  const lists = new Map<string, WordList>();
  const attempts = new Map<string, Attempt>();
  const sessions = new Map<string, Session>();
  const awards = new Map<string, Award>();
  let parentPinHash: string | null = null;

  const awardKey = (a: Award) => `${a.profileId}|${a.badgeId}`;
  const copyList = (l: WordList): WordList => ({ ...l, words: [...l.words] });
  const forProfile = <T extends { profileId: string }>(m: Map<string, T>, profileId: string) =>
    [...m.values()].filter((v) => v.profileId === profileId);
  const dropProfile = <T extends { profileId: string }>(m: Map<string, T>, profileId: string) => {
    for (const [k, v] of m) if (v.profileId === profileId) m.delete(k);
  };

  return {
    async listProfiles() {
      return [...profiles.values()].map((p) => ({ ...p }));
    },
    async saveProfile(p) {
      profiles.set(p.id, { ...p });
    },
    async deleteProfile(id) {
      profiles.delete(id);
      dropProfile(lists, id);
      dropProfile(attempts, id);
      dropProfile(sessions, id);
      dropProfile(awards, id);
    },
    async setGeneratedLevel(profileId, level) {
      const p = profiles.get(profileId);
      if (p) profiles.set(profileId, { ...p, generatedLevel: level });
    },
    async listLists(profileId) {
      return forProfile(lists, profileId).map(copyList);
    },
    async saveList(l) {
      lists.set(l.id, copyList(l));
    },
    async deleteList(id) {
      lists.delete(id);
    },
    async listAttempts(profileId) {
      return forProfile(attempts, profileId).map((a) => ({ ...a }));
    },
    async addAttempts(a) {
      for (const x of a) if (!attempts.has(x.id)) attempts.set(x.id, { ...x });
    },
    async listSessions(profileId) {
      return forProfile(sessions, profileId).map((s) => ({ ...s }));
    },
    async saveSession(s) {
      sessions.set(s.id, { ...s });
    },
    async listAwards(profileId) {
      return forProfile(awards, profileId).map((a) => ({ ...a }));
    },
    async addAwards(a) {
      for (const x of a) if (!awards.has(awardKey(x))) awards.set(awardKey(x), { ...x });
    },
    async getParentPinHash() {
      return parentPinHash;
    },
    async setParentPinHash(h) {
      parentPinHash = h;
    },
  };
}
