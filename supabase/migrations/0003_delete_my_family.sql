-- "Delete my family's data": a signed-in parent deletes their own account.
-- The client can't delete auth users, so this runs as the function owner (security definer).
-- Every table's owner column references auth.users with on delete cascade, so removing the
-- user removes their profiles, lists, attempts, sessions, awards, and parent settings too.
create function public.delete_my_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_family() from public, anon;
grant execute on function public.delete_my_family() to authenticated;
