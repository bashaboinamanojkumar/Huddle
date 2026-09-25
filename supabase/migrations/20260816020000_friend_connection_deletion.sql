drop policy if exists "Delete connections on either side"
  on public.friend_connections;
create policy "Delete connections on either side"
  on public.friend_connections for delete to authenticated
  using (
    user_id = (select auth.uid())
    or friend_id = (select auth.uid())
  );

grant delete on public.friend_connections to authenticated;
