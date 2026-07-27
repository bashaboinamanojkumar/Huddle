-- Mirrors the name derivation that used to live in lib/store/profile-bridge.ts.
create or replace function public.huddle_derive_names(
  p_full_name text,
  p_email text,
  out out_first_name text,
  out out_last_initial text
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  name_parts text[];
  local_part text;
  local_parts text[];
  fallback_first text;
  fallback_initial text;
begin
  local_part := split_part(coalesce(p_email, ''), '@', 1);
  local_parts := array_remove(regexp_split_to_array(local_part, '[._-]+'), '');

  fallback_first := case
    when coalesce(local_parts[1], '') = '' then 'Student'
    else upper(left(local_parts[1], 1)) || substr(local_parts[1], 2)
  end;
  fallback_initial := case
    when coalesce(local_parts[2], '') = '' then 'T'
    else upper(left(local_parts[2], 1))
  end;

  name_parts := array_remove(regexp_split_to_array(btrim(coalesce(p_full_name, '')), '\s+'), '');

  out_first_name := coalesce(nullif(name_parts[1], ''), fallback_first);
  out_last_initial := case
    when coalesce(array_length(name_parts, 1), 0) > 1
      then upper(left(name_parts[array_length(name_parts, 1)], 1))
    else fallback_initial
  end;
end;
$$;

-- Matches the app_metadata.role check in lib/auth/admin.ts.
create or replace function public.is_safety_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'safety_owner';
$$;

-- Definer rights keep these helpers from recursing back through the policies that call them.
create or replace function public.can_view_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
      and (
        a.status = 'approved'
        or a.host_id = (select auth.uid())
        or public.is_safety_owner()
      )
  );
$$;

create or replace function public.is_activity_participant(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rsvps r
    where r.activity_id = p_activity_id
      and r.user_id = (select auth.uid())
      and r.status = 'going'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived record;
begin
  select *
  into derived
  from public.huddle_derive_names(
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  );

  insert into public.profiles (id, email, first_name, last_name, last_initial, avatar_url, university_id)
  values (
    new.id,
    new.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), ''),
    case when new.email like '%@umaryland.edu' then 'umb' else 'umd' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Self-heals accounts created before the signup trigger existed, without granting
-- clients any direct insert privilege on profiles.
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users;
  derived record;
  result public.profiles;
begin
  select * into auth_user from auth.users where id = (select auth.uid());
  if auth_user.id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select *
  into derived
  from public.huddle_derive_names(
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'name'),
    auth_user.email
  );

  insert into public.profiles (id, email, first_name, last_name, last_initial, avatar_url, university_id)
  values (
    auth_user.id,
    auth_user.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(coalesce(auth_user.raw_user_meta_data ->> 'avatar_url', auth_user.raw_user_meta_data ->> 'picture'), ''),
    case when auth_user.email like '%@umaryland.edu' then 'umb' else 'umd' end
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = auth_user.id;
  return result;
end;
$$;

-- Capacity has to be evaluated under a row lock, otherwise two simultaneous RSVPs
-- both read the same count and oversell the activity.
create or replace function public.rsvp_activity(p_activity_id uuid)
returns public.rsvp_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  activity public.activities;
  going_count integer;
  previous public.rsvp_status;
  next_status public.rsvp_status;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into activity from public.activities where id = p_activity_id for update;

  if not found or activity.status <> 'approved' then
    raise exception 'Activity is not open for RSVP' using errcode = '22023';
  end if;

  select status into previous
  from public.rsvps
  where activity_id = p_activity_id and user_id = actor;

  select count(*) into going_count
  from public.rsvps
  where activity_id = p_activity_id and status = 'going';

  if previous is not distinct from 'going'::public.rsvp_status then
    next_status := 'going';
  elsif going_count >= activity.capacity then
    next_status := 'waitlisted';
  else
    next_status := 'going';
  end if;

  insert into public.rsvps (activity_id, user_id, status)
  values (p_activity_id, actor, next_status)
  on conflict (activity_id, user_id)
  do update set status = excluded.status, updated_at = now();

  if next_status = 'going' then
    select count(*) into going_count
    from public.rsvps
    where activity_id = p_activity_id and status = 'going';

    if going_count >= 2 and not exists (
      select 1 from public.messages where activity_id = p_activity_id and is_system
    ) then
      insert into public.messages (activity_id, user_id, is_system, body)
      values (
        p_activity_id,
        null,
        true,
        'You are set for ' || activity.title || '. Use this chat for public meet-point logistics.'
      );
    end if;
  end if;

  return next_status;
end;
$$;

create or replace function public.leave_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.rsvps
  set status = 'left', updated_at = now()
  where activity_id = p_activity_id and user_id = actor;
end;
$$;

create or replace function public.flag_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.flagged := exists (
    select 1 from public.safety_keywords k
    where position(k.term in lower(new.body)) > 0
  );
  return new;
end;
$$;

create or replace function public.record_message_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched text;
begin
  if new.flagged then
    select k.term into matched
    from public.safety_keywords k
    where position(k.term in lower(new.body)) > 0
    order by char_length(k.term) desc
    limit 1;

    insert into public.safety_flags (type, ref_id, reason)
    values ('chat', new.id, 'Matched safety keyword: ' || coalesce(matched, 'unknown'));
  end if;
  return new;
end;
$$;

create or replace function public.record_activity_review_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'user' and new.status = 'pending' then
    insert into public.safety_flags (type, ref_id, reason)
    values ('event', new.id, 'User-created activity pending checklist review.');
  end if;
  return new;
end;
$$;

create or replace function public.record_report_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.safety_flags (type, ref_id, reason)
  values ('report', new.id, new.context);
  return new;
end;
$$;

create or replace function public.review_activity(
  p_activity_id uuid,
  p_status public.activity_status
)
returns public.activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.activities;
begin
  if not public.is_safety_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported review status' using errcode = '22023';
  end if;

  update public.activities
  set status = p_status
  where id = p_activity_id
  returning * into result;

  if result.id is null then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  update public.safety_flags
  set status = case when p_status = 'approved' then 'dismissed'::public.flag_status else 'removed'::public.flag_status end,
      reviewer = 'Safety owner',
      resolved_at = now()
  where type = 'event' and ref_id = p_activity_id and status = 'open';

  return result;
end;
$$;

create or replace function public.resolve_flag(
  p_flag_id uuid,
  p_status public.flag_status
)
returns public.safety_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.safety_flags;
begin
  if not public.is_safety_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.safety_flags
  set status = p_status,
      reviewer = 'Safety owner',
      resolved_at = now()
  where id = p_flag_id
  returning * into result;

  if result.id is null then
    raise exception 'Flag not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

drop trigger if exists messages_flag_before_insert on public.messages;
create trigger messages_flag_before_insert
  before insert on public.messages
  for each row execute function public.flag_message();

drop trigger if exists messages_flag_after_insert on public.messages;
create trigger messages_flag_after_insert
  after insert on public.messages
  for each row execute function public.record_message_flag();

drop trigger if exists activities_review_flag on public.activities;
create trigger activities_review_flag
  after insert on public.activities
  for each row execute function public.record_activity_review_flag();

drop trigger if exists safety_reports_flag on public.safety_reports;
create trigger safety_reports_flag
  after insert on public.safety_reports
  for each row execute function public.record_report_flag();

-- Definer functions must never be world-executable.
revoke execute on function public.huddle_derive_names(text, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.flag_message() from public, anon, authenticated;
revoke execute on function public.record_message_flag() from public, anon, authenticated;
revoke execute on function public.record_activity_review_flag() from public, anon, authenticated;
revoke execute on function public.record_report_flag() from public, anon, authenticated;

revoke execute on function public.is_safety_owner() from public, anon;
revoke execute on function public.can_view_activity(uuid) from public, anon;
revoke execute on function public.is_activity_participant(uuid) from public, anon;
revoke execute on function public.ensure_profile() from public, anon;
revoke execute on function public.rsvp_activity(uuid) from public, anon;
revoke execute on function public.leave_activity(uuid) from public, anon;
revoke execute on function public.review_activity(uuid, public.activity_status) from public, anon;
revoke execute on function public.resolve_flag(uuid, public.flag_status) from public, anon;

grant execute on function public.is_safety_owner() to authenticated;
grant execute on function public.can_view_activity(uuid) to authenticated;
grant execute on function public.is_activity_participant(uuid) to authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.rsvp_activity(uuid) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;
grant execute on function public.review_activity(uuid, public.activity_status) to authenticated;
grant execute on function public.resolve_flag(uuid, public.flag_status) to authenticated;
