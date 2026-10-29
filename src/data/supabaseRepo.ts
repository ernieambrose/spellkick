import type { SupabaseClient } from '@supabase/supabase-js';
import {
  attemptFromRow,
  attemptToRow,
  awardFromRow,
  awardToRow,
  listFromRow,
  listToRow,
  profileFromRow,
  profileToRow,
  sessionFromRow,
  sessionToRow,
  type AttemptRow,
  type AwardRow,
  type ProfileRow,
  type SessionRow,
  type WordListRow,
} from './mappers';
import { fetchAllPages } from './paging';
import type { Repo } from './repo';

/** An error from Supabase that keeps the Postgres code and HTTP status so callers can tell permanent failures from transient ones. */
export class SupabaseRepoError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'SupabaseRepoError';
    this.code = code;
    this.status = status;
  }
}

// Row-level security limits every query to the signed-in parent's rows (owner = auth.uid()).
export function createSupabaseRepo(db: SupabaseClient): Repo {
  function check<T>(res: { data: T; error: { message: string; code?: string } | null; status?: number }): T {
    if (res.error) throw new SupabaseRepoError(res.error.message, res.error.code, res.status);
    return res.data;
  }

  async function ownerId(): Promise<string> {
    const { data, error } = await db.auth.getUser();
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Not signed in');
    return data.user.id;
  }

  return {
    async listProfiles() {
      const rows = await fetchAllPages<ProfileRow>((from, to) =>
        db.from('profiles').select('*').order('created_at').order('id').range(from, to),
      );
      return rows.map(profileFromRow);
    },
    async saveProfile(p) {
      check(await db.from('profiles').upsert(profileToRow(p), { onConflict: 'id' }));
    },
    async deleteProfile(id) {
      check(await db.from('profiles').delete().eq('id', id));
    },
    async listLists(profileId) {
      const rows = await fetchAllPages<WordListRow>((from, to) =>
        db.from('word_lists').select('*').eq('profile_id', profileId).order('created_at').order('id').range(from, to),
      );
      return rows.map(listFromRow);
    },
    async saveList(l) {
      check(await db.from('word_lists').upsert(listToRow(l), { onConflict: 'id' }));
    },
    async deleteList(id) {
      check(await db.from('word_lists').delete().eq('id', id));
    },
    async listAttempts(profileId) {
      const rows = await fetchAllPages<AttemptRow>((from, to) =>
        db.from('attempts').select('*').eq('profile_id', profileId).order('created_at').order('id').range(from, to),
      );
      return rows.map(attemptFromRow);
    },
    async addAttempts(a) {
      if (a.length === 0) return;
      check(await db.from('attempts').upsert(a.map(attemptToRow), { onConflict: 'id', ignoreDuplicates: true }));
    },
    async listSessions(profileId) {
      const rows = await fetchAllPages<SessionRow>((from, to) =>
        db.from('sessions').select('*').eq('profile_id', profileId).order('started_at').order('id').range(from, to),
      );
      return rows.map(sessionFromRow);
    },
    async saveSession(s) {
      check(await db.from('sessions').upsert(sessionToRow(s), { onConflict: 'id' }));
    },
    async listAwards(profileId) {
      const rows = await fetchAllPages<AwardRow>((from, to) =>
        db.from('awards').select('*').eq('profile_id', profileId).order('earned_at').order('badge_id').range(from, to),
      );
      return rows.map(awardFromRow);
    },
    async addAwards(a) {
      if (a.length === 0) return;
      check(
        await db
          .from('awards')
          .upsert(a.map(awardToRow), { onConflict: 'profile_id,badge_id', ignoreDuplicates: true }),
      );
    },
    async getParentPinHash() {
      const owner = await ownerId();
      const row = check(await db.from('parent_settings').select('pin_hash').eq('owner', owner).maybeSingle());
      return (row as { pin_hash: string | null } | null)?.pin_hash ?? null;
    },
    async setParentPinHash(h) {
      const owner = await ownerId();
      check(await db.from('parent_settings').upsert({ owner, pin_hash: h }, { onConflict: 'owner' }));
    },
  };
}
