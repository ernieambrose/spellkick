-- SpellKick initial schema.
-- Every table carries `owner` (the signed-in parent's auth user id) and row-level security
-- so a parent can only ever see or change their own family's rows.

create table public.profiles (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  grade int not null check (grade between 1 and 8),
  generated_level int not null,
  pin_hash text null,
  timer_on boolean not null,
  theme text not null,
  created_at timestamptz not null default now()
);

create table public.word_lists (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  test_date date null,
  source text not null check (source in ('school', 'parent', 'teacher', 'other')),
  author text null, -- hook for future teacher accounts
  words text[] not null check (cardinality(words) <= 100),
  created_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  word text not null,
  list_id uuid null, -- null = generated-pool word
  game text not null,
  kind text not null,
  ms int null,
  local_date date not null,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game text not null,
  mode text not null,
  started_at timestamptz not null,
  completed_at timestamptz null,
  local_date date not null,
  points int not null,
  stars int not null,
  tricky_count int not null
);

create table public.awards (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null,
  primary key (profile_id, badge_id)
);

create table public.parent_settings (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pin_hash text
);

create index word_lists_profile_id_idx on public.word_lists (profile_id);
create index attempts_profile_id_idx on public.attempts (profile_id);
create index sessions_profile_id_idx on public.sessions (profile_id);

-- Row-level security: owner = auth.uid() for select, insert, update, delete on every table.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'word_lists', 'attempts', 'sessions', 'awards', 'parent_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner = auth.uid())',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner = auth.uid())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner = auth.uid())',
      t || '_delete', t);
  end loop;
end
$$;
