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
import type { Repo } from './repo';

// Row-level security limits every query to the signed-in parent's rows (owner = auth.uid()).
export function createSupabaseRepo(db: SupabaseClient): Repo {
  function check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message);
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
      const rows = check(await db.from('profiles').select('*').order('created_at'));
      return (rows as ProfileRow[]).map(profileFromRow);
    },
    async saveProfile(p) {
      check(await db.from('profiles').upsert(profileToRow(p), { onConflict: 'id' }));
    },
    async deleteProfile(id) {
      check(await db.from('profiles').delete().eq('id', id));
    },
    async listLists(profileId) {
      const rows = check(await db.from('word_lists').select('*').eq('profile_id', profileId).order('created_at'));
      return (rows as WordListRow[]).map(listFromRow);
    },
    async saveList(l) {
      check(await db.from('word_lists').upsert(listToRow(l), { onConflict: 'id' }));
    },
    async deleteList(id) {
      check(await db.from('word_lists').delete().eq('id', id));
    },
    async listAttempts(profileId) {
      const rows = check(await db.from('attempts').select('*').eq('profile_id', profileId).order('created_at'));
      return (rows as AttemptRow[]).map(attemptFromRow);
    },
    async addAttempts(a) {
      if (a.length === 0) return;
      check(await db.from('attempts').upsert(a.map(attemptToRow), { onConflict: 'id', ignoreDuplicates: true }));
    },
    async listSessions(profileId) {
      const rows = check(await db.from('sessions').select('*').eq('profile_id', profileId).order('started_at'));
      return (rows as SessionRow[]).map(sessionFromRow);
    },
    async saveSession(s) {
      check(await db.from('sessions').upsert(sessionToRow(s), { onConflict: 'id' }));
    },
    async listAwards(profileId) {
      const rows = check(await db.from('awards').select('*').eq('profile_id', profileId).order('earned_at'));
      return (rows as AwardRow[]).map(awardFromRow);
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
