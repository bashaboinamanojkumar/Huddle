-- Durable notification inbox, per-device push subscriptions, and delivery outbox.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type
    where typname = 'notification_category'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.notification_category as enum (
      'chat',
      'activities',
      'reminders',
      'social',
      'safety',
      'digest',
      'rewards'
    );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_type
    where typname = 'notification_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.notification_type as enum (
      'chat_message',
      'chat_opened',
      'activity_joined',
      'activity_approved',
      'activity_rejected',
      'event_reminder_24h',
      'event_reminder_1h',
      'waitlist_promoted',
      'pulse_prompt',
      'friend_request',
      'friend_accepted',
      'friend_rsvp',
      'safety_review',
      'safety_report_status',
      'activity_match_digest',
      'weekly_recap',
      'streak_at_risk',
      'points_milestone',
      'badge_unlocked',
      'leaderboard_placement'
    );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_type
    where typname = 'notification_delivery_state'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.notification_delivery_state as enum (
      'pending',
      'deferred',
      'processing',
      'sent',
      'failed',
      'skipped'
    );
  end if;
end
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  category public.notification_category not null,
  title text not null,
  body text not null,
  url text not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  constraint notifications_user_dedupe_key_key unique (user_id, dedupe_key),
  constraint notifications_title_check check (
    btrim(title) <> '' and char_length(title) <= 120
  ),
  constraint notifications_body_check check (
    btrim(body) <> '' and char_length(body) <= 1000
  ),
  constraint notifications_safe_url_check check (
    url ~ '^/[^/]' and char_length(url) <= 2048
  ),
  constraint notifications_data_object_check check (
    jsonb_typeof(data) = 'object'
  ),
  constraint notifications_dedupe_key_check check (
    btrim(dedupe_key) <> '' and char_length(dedupe_key) <= 255
  )
);

create index if not exists notifications_user_last_event_idx
  on public.notifications (user_id, last_event_at desc, id desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  chat_enabled boolean not null default true,
  activities_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  social_enabled boolean not null default true,
  safety_enabled boolean not null default true,
  digest_enabled boolean not null default false,
  rewards_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'America/New_York',
  daily_push_cap integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_timezone_check check (
    btrim(timezone) <> '' and char_length(timezone) <= 255
  ),
  constraint notification_preferences_daily_push_cap_check check (
    daily_push_cap between 1 and 50
  )
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failure_count integer not null default 0,
  disabled_at timestamptz,
  constraint push_subscriptions_endpoint_check check (btrim(endpoint) <> ''),
  constraint push_subscriptions_p256dh_check check (btrim(p256dh) <> ''),
  constraint push_subscriptions_auth_check check (btrim(auth) <> ''),
  constraint push_subscriptions_failure_count_check check (failure_count >= 0)
);

create index if not exists push_subscriptions_active_owner_idx
  on public.push_subscriptions (user_id, last_seen_at desc, id)
  where disabled_at is null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  state public.notification_delivery_state not null default 'pending',
  deliver_after timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  attempts integer not null default 0,
  last_error_code text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_notification_subscription_key
    unique (notification_id, subscription_id),
  constraint notification_deliveries_attempts_check check (attempts >= 0)
);

create index if not exists notification_deliveries_due_idx
  on public.notification_deliveries (deliver_after, id)
  where state in ('pending', 'deferred');

create index if not exists notification_deliveries_expired_lease_idx
  on public.notification_deliveries (claimed_at, id)
  where state = 'processing' and claimed_at is not null;

create table if not exists public.notification_runtime_config (
  id boolean primary key default true,
  notification_core_enabled boolean not null default true,
  push_enabled boolean not null default true,
  rewards_enabled boolean not null default false,
  push_rollout_percentage integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_runtime_config_singleton_check check (id),
  constraint notification_runtime_config_rollout_check check (
    push_rollout_percentage between 0 and 100
  )
);

insert into public.notification_runtime_config (id)
values (true)
on conflict (id) do nothing;

drop trigger if exists handle_notification_preferences_updated_at
  on public.notification_preferences;
create trigger handle_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.handle_updated_at();

drop trigger if exists handle_push_subscriptions_updated_at
  on public.push_subscriptions;
create trigger handle_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists handle_notification_deliveries_updated_at
  on public.notification_deliveries;
create trigger handle_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function public.handle_updated_at();

drop trigger if exists handle_notification_runtime_config_updated_at
  on public.notification_runtime_config;
create trigger handle_notification_runtime_config_updated_at
  before update on public.notification_runtime_config
  for each row execute function public.handle_updated_at();

alter table public.notifications replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
