-- Words per practice session, set per kid in the parent area.
-- null means "not set yet": the app picks a default from the kid's grade.
alter table public.profiles
  add column session_size int null check (session_size between 5 and 30);
