import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRepo, SupabaseRepoError } from '../../src/data/supabaseRepo';

// Records the query chain; the final .eq() resolves with `result`.
function fakeDb(result: { data: null; error: { message: string; code?: string } | null; status: number }) {
  const calls: unknown[][] = [];
  const builder = {
    update(v: unknown) {
      calls.push(['update', v]);
      return builder;
    },
    eq(col: string, v: unknown) {
      calls.push(['eq', col, v]);
      return Promise.resolve(result);
    },
  };
  const db = {
    from(table: string) {
      calls.push(['from', table]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe('createSupabaseRepo.setGeneratedLevel', () => {
  it('updates only generated_level on that profile row', async () => {
    const { db, calls } = fakeDb({ data: null, error: null, status: 204 });
    await createSupabaseRepo(db).setGeneratedLevel('p1', 6);
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['update', { generated_level: 6 }],
      ['eq', 'id', 'p1'],
    ]);
  });

  it('throws a SupabaseRepoError carrying the code and status', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'rls', code: '42501' }, status: 401 });
    const err = await createSupabaseRepo(db).setGeneratedLevel('p1', 6).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SupabaseRepoError);
    expect(err).toMatchObject({ code: '42501', status: 401 });
  });
});
