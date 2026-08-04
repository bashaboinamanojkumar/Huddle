-- Owner-safe notification access, idempotent creation, and push subscription RPCs.

create or replace function public.notification_category_for_type(
  p_type public.notification_type
)
returns public.notification_category
language sql
immutable
strict
set search_path = ''
as $$
  select case p_type
    when 'chat_message' then 'chat'::public.notification_category
    when 'chat_opened' then 'chat'::public.notification_category
    when 'activity_joined' then 'activities'::public.notification_category
    when 'activity_approved' then 'activities'::public.notification_category
    when 'activity_rejected' then 'activities'::public.notification_category
    when 'waitlist_promoted' then 'activities'::public.notification_category
    when 'event_reminder_24h' then 'reminders'::public.notification_category
    when 'event_reminder_1h' then 'reminders'::public.notification_category
    when 'pulse_prompt' then 'reminders'::public.notification_category
    when 'friend_request' then 'social'::public.notification_category
    when 'friend_accepted' then 'social'::public.notification_category
    when 'friend_rsvp' then 'social'::public.notification_category
    when 'safety_review' then 'safety'::public.notification_category
    when 'safety_report_status' then 'safety'::public.notification_category
    when 'activity_match_digest' then 'digest'::public.notification_category
    when 'weekly_recap' then 'digest'::public.notification_category
    when 'streak_at_risk' then 'rewards'::public.notification_category
    when 'points_milestone' then 'rewards'::public.notification_category
    when 'badge_unlocked' then 'rewards'::public.notification_category
    when 'leaderboard_placement' then 'rewards'::public.notification_category
  end;
$$;

create or replace function public.is_safe_notification_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_path is not null
    and pg_catalog.char_length(p_path) between 4 and 2048
    and p_path ~ '^/app($|[/?#])'
    and p_path !~ '//'
    and p_path !~ '[[:cntrl:][:space:]]'
    and pg_catalog.strpos(p_path, pg_catalog.chr(92)) = 0
    and pg_catalog.lower(p_path) !~ '%(00|0a|0d|5c)'
    and pg_catalog.lower(p_path)
      !~ '(^|/)([.]|%2e)([.]|%2e)($|/|%2f|[?#])';
$$;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_url text,
  p_data jsonb,
  p_dedupe_key text,
  p_last_event_at timestamptz default now(),
  p_reopen boolean default false
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_title text := pg_catalog.btrim(p_title);
  clean_body text := pg_catalog.btrim(p_body);
  clean_dedupe_key text := pg_catalog.btrim(p_dedupe_key);
  result public.notifications;
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Notification recipient does not exist' using errcode = '22023';
  end if;

  if p_type is null then
    raise exception 'Notification type is required' using errcode = '22023';
  end if;

  if clean_title is null or clean_title = '' then
    raise exception 'Notification title is required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(clean_title) > 120 then
    raise exception 'Notification title exceeds 120 characters' using errcode = '22023';
  end if;

  if clean_body is null or clean_body = '' then
    raise exception 'Notification body is required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(clean_body) > 1000 then
    raise exception 'Notification body exceeds 1000 characters' using errcode = '22023';
  end if;

  if clean_dedupe_key is null or clean_dedupe_key = '' then
    raise exception 'Notification dedupe key is required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(clean_dedupe_key) > 255 then
    raise exception 'Notification dedupe key exceeds 255 characters' using errcode = '22023';
  end if;

  if not coalesce(public.is_safe_notification_path(p_url), false) then
    raise exception 'Unsafe notification path' using errcode = '22023';
  end if;

  if p_data is null or pg_catalog.jsonb_typeof(p_data) <> 'object' then
    raise exception 'Notification data must be a JSON object' using errcode = '22023';
  end if;

  if p_last_event_at is null then
    raise exception 'Notification event time is required' using errcode = '22023';
  end if;

  if p_reopen is null then
    raise exception 'Notification reopen flag is required' using errcode = '22023';
  end if;

  insert into public.notifications (
    user_id,
    type,
    category,
    title,
    body,
    url,
    data,
    dedupe_key,
    last_event_at
  )
  values (
    p_user_id,
    p_type,
    public.notification_category_for_type(p_type),
    clean_title,
    clean_body,
    p_url,
    p_data,
    clean_dedupe_key,
    p_last_event_at
  )
  on conflict (user_id, dedupe_key)
  do update set
    body = case
      when p_reopen and excluded.last_event_at > notifications.last_event_at
        then excluded.body
      else notifications.body
    end,
    data = case
      when p_reopen and excluded.last_event_at > notifications.last_event_at
        then excluded.data
      else notifications.data
    end,
    last_event_at = case
      when p_reopen and excluded.last_event_at > notifications.last_event_at
        then excluded.last_event_at
      else notifications.last_event_at
    end,
    read_at = case
      when p_reopen and excluded.last_event_at > notifications.last_event_at
        then null
      else notifications.read_at
    end,
    seen_at = case
      when p_reopen and excluded.last_event_at > notifications.last_event_at
        then null
      else notifications.seen_at
    end
  returning * into result;

  return result;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result public.notifications;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now()),
      seen_at = coalesce(seen_at, now())
  where id = p_notification_id
    and user_id = actor
  returning * into result;

  if result.id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return result;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  changed integer;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.notifications
  set read_at = now(),
      seen_at = coalesce(seen_at, now())
  where user_id = actor
    and read_at is null;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.update_notification_preferences(
  p_push_enabled boolean,
  p_chat_enabled boolean,
  p_activities_enabled boolean,
  p_reminders_enabled boolean,
  p_social_enabled boolean,
  p_safety_enabled boolean,
  p_digest_enabled boolean,
  p_rewards_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_timezone text,
  p_daily_push_cap integer
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_timezone text := pg_catalog.btrim(p_timezone);
  result public.notification_preferences;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_push_enabled is null
    or p_chat_enabled is null
    or p_activities_enabled is null
    or p_reminders_enabled is null
    or p_social_enabled is null
    or p_safety_enabled is null
    or p_digest_enabled is null
    or p_rewards_enabled is null
  then
    raise exception 'Notification preference values are required' using errcode = '22023';
  end if;

  if clean_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = clean_timezone
    )
  then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;

  if p_daily_push_cap is null or p_daily_push_cap not between 1 and 50 then
    raise exception 'Daily push cap must be between 1 and 50' using errcode = '22023';
  end if;

  insert into public.notification_preferences (
    user_id,
    push_enabled,
    chat_enabled,
    activities_enabled,
    reminders_enabled,
    social_enabled,
    safety_enabled,
    digest_enabled,
    rewards_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone,
    daily_push_cap
  )
  values (
    actor,
    p_push_enabled,
    p_chat_enabled,
    p_activities_enabled,
    p_reminders_enabled,
    p_social_enabled,
    p_safety_enabled,
    p_digest_enabled,
    p_rewards_enabled,
    p_quiet_hours_start,
    p_quiet_hours_end,
    clean_timezone,
    p_daily_push_cap
  )
  on conflict (user_id)
  do update set
    push_enabled = excluded.push_enabled,
    chat_enabled = excluded.chat_enabled,
    activities_enabled = excluded.activities_enabled,
    reminders_enabled = excluded.reminders_enabled,
    social_enabled = excluded.social_enabled,
    safety_enabled = excluded.safety_enabled,
    digest_enabled = excluded.digest_enabled,
    rewards_enabled = excluded.rewards_enabled,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    timezone = excluded.timezone,
    daily_push_cap = excluded.daily_push_cap
  returning * into result;

  return result;
end;
$$;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_subscription public.push_subscriptions;
  result public.push_subscriptions;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_endpoint is null or pg_catalog.btrim(p_endpoint) = '' then
    raise exception 'Push endpoint is required' using errcode = '22023';
  end if;
  if pg_catalog.lower(p_endpoint) like 'retired:%' then
    raise exception 'Reserved push endpoint' using errcode = '22023';
  end if;
  if p_p256dh is null or pg_catalog.btrim(p_p256dh) = '' then
    raise exception 'Push p256dh key is required' using errcode = '22023';
  end if;
  if p_auth is null or pg_catalog.btrim(p_auth) = '' then
    raise exception 'Push auth key is required' using errcode = '22023';
  end if;

  -- Serializes first registration as well as transfers; the row lock below protects
  -- the endpoint owner and keys once a row exists.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_endpoint, 0)
  );

  select *
  into current_subscription
  from public.push_subscriptions
  where endpoint = p_endpoint
  for update;

  if current_subscription.id is null then
    insert into public.push_subscriptions (
      user_id, endpoint, p256dh, auth, user_agent
    )
    values (
      actor, p_endpoint, p_p256dh, p_auth, p_user_agent
    )
    returning * into result;

    return result;
  end if;

  if current_subscription.user_id = actor then
    update public.push_subscriptions
    set p256dh = p_p256dh,
        auth = p_auth,
        user_agent = p_user_agent,
        last_seen_at = now(),
        failure_count = 0,
        disabled_at = null
    where id = current_subscription.id
    returning * into result;

    return result;
  end if;

  if current_subscription.p256dh is distinct from p_p256dh
    or current_subscription.auth is distinct from p_auth
  then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.push_subscriptions
  set endpoint = 'retired:' || id::text,
      p256dh = 'retired',
      auth = 'retired',
      user_agent = null,
      disabled_at = coalesce(disabled_at, now())
  where id = current_subscription.id;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent
  )
  values (
    actor, p_endpoint, p_p256dh, p_auth, p_user_agent
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.disable_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  changed integer;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_endpoint is null or pg_catalog.btrim(p_endpoint) = '' then
    raise exception 'Push endpoint is required' using errcode = '22023';
  end if;

  update public.push_subscriptions
  set disabled_at = now()
  where user_id = actor
    and endpoint = p_endpoint
    and disabled_at is null;

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Preserve the existing profile derivation behavior and add notification defaults.
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

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

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

  insert into public.notification_preferences (user_id)
  values (auth_user.id)
  on conflict (user_id) do nothing;

  select * into result from public.profiles where id = auth_user.id;
  return result;
end;
$$;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_runtime_config enable row level security;

drop policy if exists "Owners read notifications" on public.notifications;
create policy "Owners read notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners read notification preferences"
  on public.notification_preferences;
create policy "Owners read notification preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners read push subscriptions"
  on public.push_subscriptions;
create policy "Owners read push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authenticated read notification runtime config"
  on public.notification_runtime_config;
create policy "Authenticated read notification runtime config"
  on public.notification_runtime_config for select to authenticated
  using (true);

revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
revoke all on table public.notification_runtime_config from anon, authenticated;

grant select on table public.notifications to authenticated;
grant select on table public.notification_preferences to authenticated;
grant select on table public.push_subscriptions to authenticated;
grant select on table public.notification_runtime_config to authenticated;

revoke execute on function public.notification_category_for_type(public.notification_type)
  from public, anon, authenticated;
revoke execute on function public.is_safe_notification_path(text)
  from public, anon, authenticated;
revoke execute on function public.create_notification(
  uuid,
  public.notification_type,
  text,
  text,
  text,
  jsonb,
  text,
  timestamptz,
  boolean
) from public, anon, authenticated;
revoke execute on function public.mark_notification_read(uuid)
  from public, anon, authenticated;
revoke execute on function public.mark_all_notifications_read()
  from public, anon, authenticated;
revoke execute on function public.update_notification_preferences(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  time,
  time,
  text,
  integer
) from public, anon, authenticated;
revoke execute on function public.save_push_subscription(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.disable_push_subscription(text)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.ensure_profile()
  from public, anon, authenticated;
revoke execute on function public.handle_updated_at()
  from public, anon, authenticated;

grant execute on function public.create_notification(
  uuid,
  public.notification_type,
  text,
  text,
  text,
  jsonb,
  text,
  timestamptz,
  boolean
) to service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.update_notification_preferences(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  time,
  time,
  text,
  integer
) to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text)
  to authenticated;
grant execute on function public.disable_push_subscription(text) to authenticated;

-- Preserve the pre-existing authenticated profile repair RPC.
grant execute on function public.ensure_profile() to authenticated;
