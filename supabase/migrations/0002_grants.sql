-- New Supabase projects don't auto-grant table access to API roles.
-- Signed-in parents (authenticated) get table privileges; row-level security still limits them to their own rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.word_lists, public.attempts, public.sessions, public.awards, public.parent_settings to authenticated;
-- TRUNCATE ignores row-level security; API roles never need it (or REFERENCES/TRIGGER).
revoke truncate, references, trigger on public.profiles, public.word_lists, public.attempts, public.sessions, public.awards, public.parent_settings from anon, authenticated;
