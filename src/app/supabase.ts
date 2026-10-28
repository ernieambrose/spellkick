import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null when the env vars are missing (tests, or a build without them), so nothing crashes on import.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/setup.md).',
    );
  }
  return supabase;
}
