begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth;

select plan(24);

select has_table('public', 'notifications', 'public.notifications exists');
select has_table(
  'public',
  'notification_preferences',
  'public.notification_preferences exists'
);
select has_table(
  'public',
  'push_subscriptions',
  'public.push_subscriptions exists'
);
select has_table(
  'public',
  'notification_deliveries',
  'public.notification_deliveries exists'
);
select col_is_pk('public', 'notifications', 'id', 'notifications.id is the primary key');
select col_is_pk(
  'public',
  'notification_preferences',
  'user_id',
  'notification_preferences.user_id is the primary key'
);
select col_is_pk(
  'public',
  'push_subscriptions',
  'id',
  'push_subscriptions.id is the primary key'
);
select col_is_pk(
  'public',
  'notification_deliveries',
  'id',
  'notification_deliveries.id is the primary key'
);
select col_is_unique('public', 'notifications', array['user_id', 'dedupe_key']);
select col_is_unique(
  'public',
  'push_subscriptions',
  'endpoint',
  'push subscription endpoints are globally unique'
);
select col_is_unique(
  'public',
  'notification_deliveries',
  array['notification_id', 'subscription_id']
);
select results_eq(
  $$
    select
      index_catalog.indpred is null,
      pg_catalog.pg_get_indexdef(index_catalog.indexrelid, 1, true)
    from pg_catalog.pg_index as index_catalog
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_catalog.indexrelid
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = index_catalog.indrelid
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where table_namespace.nspname = 'public'
      and table_relation.relname = 'push_subscriptions'
      and index_relation.relname = 'push_subscriptions_user_id_idx'
  $$,
  $$values (true, 'user_id'::text)$$,
  'push subscriptions have a full owner index'
);
select results_eq(
  $$
    select
      index_catalog.indpred is null,
      pg_catalog.pg_get_indexdef(index_catalog.indexrelid, 1, true)
    from pg_catalog.pg_index as index_catalog
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_catalog.indexrelid
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = index_catalog.indrelid
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where table_namespace.nspname = 'public'
      and table_relation.relname = 'notification_deliveries'
      and index_relation.relname = 'notification_deliveries_subscription_id_idx'
  $$,
  $$values (true, 'subscription_id'::text)$$,
  'notification deliveries have a full subscription cascade index'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'notification-fixture@umd.edu',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Notification","last_name":"Fixture"}'::jsonb,
  now(),
  now()
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'notification-other-owner@umd.edu',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Other","last_name":"Owner"}'::jsonb,
  now(),
  now()
);

insert into public.notifications (
  id,
  user_id,
  type,
  category,
  title,
  body,
  url,
  dedupe_key
)
values (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'chat_message',
  'chat',
  'New message',
  'A student sent you a message.',
  '/app/chats/10000000-0000-4000-8000-000000000099',
  'fixture:chat:1'
);

insert into public.notification_preferences (user_id)
values ('10000000-0000-4000-8000-000000000001');

insert into public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth,
  user_agent
)
values (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'https://push.example.test/subscriptions/fixed-fixture',
  'fixture-p256dh',
  'fixture-auth',
  'pgTAP fixture browser'
);

insert into public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth,
  user_agent
)
values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  'https://push.example.test/subscriptions/other-owner',
  'other-owner-p256dh',
  'other-owner-auth',
  'pgTAP other-owner browser'
);

select lives_ok(
  $$
    insert into public.notification_deliveries (
      id, notification_id, subscription_id, user_id
    )
    values (
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  'a delivery may pair a notification with a subscription owned by the same user'
);

select throws_ok(
  $$
    insert into public.notification_deliveries (
      id, notification_id, subscription_id, user_id
    )
    values (
      '20000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503'::char(5),
  'insert or update on table "notification_deliveries" violates foreign key constraint "notification_deliveries_subscription_owner_fk"',
  'a delivery cannot pair a notification with another user''s subscription'
);

select throws_like(
  $$
    insert into public.notifications (
      id, user_id, type, category, title, body, url, dedupe_key
    )
    values (
      '10000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001',
      'chat_opened',
      'chat',
      'Chat opened',
      'Your group chat is ready.',
      '//attacker.example/path',
      'fixture:chat:unsafe-url'
    )
  $$,
  '%notifications_safe_url_check%',
  'notification URLs must be safe same-origin paths'
);

select throws_like(
  $$
    insert into public.notifications (
      id, user_id, type, category, title, body, url, data, dedupe_key
    )
    values (
      '10000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000001',
      'chat_opened',
      'chat',
      'Chat opened',
      'Your group chat is ready.',
      '/app/chats',
      '[]'::jsonb,
      'fixture:chat:array-data'
    )
  $$,
  '%notifications_data_object_check%',
  'notification data must be a JSON object'
);

select results_eq(
  $$
    select
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
    from public.notification_preferences
    where user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  $$
    values (
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      true,
      null::time,
      null::time,
      'America/New_York'::text,
      10
    )
  $$,
  'notification preference defaults are internally consistent'
);

select is(
  enum_range(null::public.notification_category)::text[],
  array['chat', 'activities', 'reminders', 'social', 'safety', 'digest', 'rewards']::text[],
  'notification categories match the approved contract'
);

select is(
  enum_range(null::public.notification_type)::text[],
  array[
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
  ]::text[],
  'notification types match the approved contract'
);

select is(
  enum_range(null::public.notification_delivery_state)::text[],
  array['pending', 'deferred', 'processing', 'sent', 'failed', 'skipped']::text[],
  'delivery states match the approved state machine'
);

select results_eq(
  $$
    select
      id,
      notification_core_enabled,
      push_enabled,
      rewards_enabled,
      push_rollout_percentage
    from public.notification_runtime_config
  $$,
  $$values (true, true, true, false, 0)$$,
  'the singleton runtime row exists with dark-launch defaults'
);

select throws_like(
  $$
    insert into public.notification_runtime_config (id)
    values (false)
  $$,
  '%notification_runtime_config_singleton_check%',
  'runtime configuration rejects a non-singleton key'
);

select results_eq(
  $$
    select
      exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
      ),
      (
        select relreplident = 'f'
        from pg_catalog.pg_class
        where oid = 'public.notifications'::regclass
      )
  $$,
  $$values (true, true)$$,
  'notifications use full replica identity and are published to Realtime'
);

select * from finish();
rollback;
