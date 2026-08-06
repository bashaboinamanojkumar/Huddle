begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path = public, extensions, auth;

select no_plan();

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

-- Delivery claims must remain disjoint even when two workers race. These
-- fixtures are committed through dblink because this pgTAP file itself runs
-- inside a transaction that the remote sessions cannot observe.
create temporary table notification_claim_race_results (
  worker text primary key,
  delivery_id uuid not null
);

select lives_ok(
  $$
    select extensions.dblink_connect(
      'notification_claim_race_a',
      'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
    )
  $$,
  'first delivery claim worker connects'
);

select lives_ok(
  $$
    select extensions.dblink_connect(
      'notification_claim_race_b',
      'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
    )
  $$,
  'second delivery claim worker connects'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_claim_race_a',
      $remote$
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        )
        values (
          '00000000-0000-0000-0000-000000000000',
          '71000000-0000-4000-8000-000000000001',
          'authenticated', 'authenticated', 'claim-race@umd.edu', '', now(),
          '{"provider":"google","providers":["google"]}'::jsonb,
          '{"full_name":"Claim Race"}'::jsonb,
          now(), now()
        );

        update public.notification_runtime_config
        set notification_core_enabled = true,
            push_enabled = true,
            rewards_enabled = true,
            push_rollout_percentage = 100
        where id;

        insert into public.push_subscriptions (
          id, user_id, endpoint, p256dh, auth
        )
        values
          (
            '71000000-0000-4000-8000-000000000021',
            '71000000-0000-4000-8000-000000000001',
            'https://push.example.test/claim-race/a', 'race-key-a', 'race-auth-a'
          ),
          (
            '71000000-0000-4000-8000-000000000022',
            '71000000-0000-4000-8000-000000000001',
            'https://push.example.test/claim-race/b', 'race-key-b', 'race-auth-b'
          );

        insert into public.notifications (
          id, user_id, type, category, title, body, url, dedupe_key
        )
        values
          (
            '71000000-0000-4000-8000-000000000011',
            '71000000-0000-4000-8000-000000000001',
            'chat_message', 'chat', 'Race one', 'First race delivery.',
            '/app/chats/race-one', 'delivery:claim-race:one'
          ),
          (
            '71000000-0000-4000-8000-000000000012',
            '71000000-0000-4000-8000-000000000001',
            'chat_message', 'chat', 'Race two', 'Second race delivery.',
            '/app/chats/race-two', 'delivery:claim-race:two'
          )
      $remote$
    )
  $test$,
  'committed delivery claim race fixtures are created'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_claim_race_a', 'begin')$$,
  'first delivery claim worker begins a transaction'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_claim_race_b', 'begin')$$,
  'second delivery claim worker begins a transaction'
);

insert into notification_claim_race_results (worker, delivery_id)
select 'a', claimed.delivery_id
from extensions.dblink(
  'notification_claim_race_a',
  'select delivery_id from public.claim_notification_deliveries(1, 120)'
) as claimed(delivery_id uuid);

insert into notification_claim_race_results (worker, delivery_id)
select 'b', claimed.delivery_id
from extensions.dblink(
  'notification_claim_race_b',
  'select delivery_id from public.claim_notification_deliveries(1, 120)'
) as claimed(delivery_id uuid);

select results_eq(
  $$
    select count(*)::integer, count(distinct delivery_id)::integer
    from notification_claim_race_results
  $$,
  $$values (2, 2)$$,
  'two concurrent claim workers never receive the same delivery'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_claim_race_a', 'commit')$$,
  'first delivery claim worker commits'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_claim_race_b', 'commit')$$,
  'second delivery claim worker commits'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_claim_race_a',
      $remote$
        delete from auth.users
        where id = '71000000-0000-4000-8000-000000000001';
        update public.notification_runtime_config
        set push_rollout_percentage = 0,
            rewards_enabled = false
        where id
      $remote$
    )
  $test$,
  'committed delivery claim race fixtures are removed'
);

select lives_ok(
  $$select extensions.dblink_disconnect('notification_claim_race_a')$$,
  'first delivery claim worker disconnects'
);

select lives_ok(
  $$select extensions.dblink_disconnect('notification_claim_race_b')$$,
  'second delivery claim worker disconnects'
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
  '30000000-0000-4000-8000-000000000009',
  'authenticated',
  'authenticated',
  'trigger-provision@umaryland.edu',
  '',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Trigger Provision"}'::jsonb,
  now(),
  now()
);

select results_eq(
  $$
    select id, email, first_name, last_initial, university_id
    from public.profiles
    where id = '30000000-0000-4000-8000-000000000009'
  $$,
  $$
    values (
      '30000000-0000-4000-8000-000000000009'::uuid,
      'trigger-provision@umaryland.edu'::text,
      'Trigger'::text,
      'P'::text,
      'umb'::text
    )
  $$,
  'the auth user trigger creates a derived profile for a fresh user'
);

select results_eq(
  $$
    select
      user_id,
      push_enabled,
      digest_enabled,
      rewards_enabled,
      quiet_hours_start,
      quiet_hours_end,
      timezone,
      daily_push_cap
    from public.notification_preferences
    where user_id = '30000000-0000-4000-8000-000000000009'
  $$,
  $$
    values (
      '30000000-0000-4000-8000-000000000009'::uuid,
      true,
      false,
      false,
      '22:00'::time,
      '08:00'::time,
      'America/New_York'::text,
      6
    )
  $$,
  'the auth user trigger provisions default notification preferences'
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
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'friend_request',
  'social',
  'New friend request',
  'Another student sent you a friend request.',
  '/app/friends',
  'fixture:social:other-owner'
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
      false,
      '22:00'::time,
      '08:00'::time,
      'America/New_York'::text,
      6
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

-- Access control is verified with the same role and JWT claims PostgREST uses.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$select id from public.notifications order by id$$,
  $$values ('10000000-0000-4000-8000-000000000002'::uuid)$$,
  'authenticated owners can select only their own notifications'
);

select results_eq(
  $$select user_id from public.notification_preferences order by user_id$$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid)$$,
  'authenticated owners can select only their own notification preferences'
);

select results_eq(
  $$
    select id, user_id, endpoint, user_agent
    from public.push_subscriptions
    order by id
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'https://push.example.test/subscriptions/fixed-fixture'::text,
      'pgTAP fixture browser'::text
    )
  $$,
  'authenticated owners can select only their own push subscriptions'
);

select throws_like(
  $$
    select p256dh, auth
    from public.push_subscriptions
    where id = '10000000-0000-4000-8000-000000000003'
  $$,
  '%permission denied for table push_subscriptions%',
  'authenticated direct reads cannot select push subscription secrets'
);

select results_eq(
  $$select id from public.notification_runtime_config$$,
  $$values (true)$$,
  'authenticated clients can read the singleton notification runtime config'
);

select throws_like(
  $$
    insert into public.notifications (
      user_id, type, category, title, body, url, dedupe_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'chat',
      'Forbidden insert',
      'Clients cannot create notification content.',
      '/app',
      'fixture:forbidden:insert'
    )
  $$,
  '%permission denied for table notifications%',
  'authenticated clients cannot directly insert notifications'
);

select throws_like(
  $$
    update public.notifications
    set body = 'Forbidden content update'
    where id = '10000000-0000-4000-8000-000000000002'
  $$,
  '%permission denied for table notifications%',
  'authenticated clients cannot directly update notification content'
);

select throws_like(
  $$
    update public.notifications
    set read_at = now()
    where id = '10000000-0000-4000-8000-000000000002'
  $$,
  '%permission denied for table notifications%',
  'authenticated clients cannot directly update notification read state'
);

select throws_like(
  $$
    insert into public.notification_deliveries (
      notification_id, subscription_id, user_id
    ) values (
      (
        select id
        from public.notifications
        where user_id = '10000000-0000-4000-8000-000000000001'
          and dedupe_key = 'fixture:forbidden:insert'
      ),
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '%permission denied for table notification_deliveries%',
  'authenticated clients cannot directly insert notification deliveries'
);

select throws_like(
  $$
    update public.notification_deliveries
    set state = 'sent'
    where id = '10000000-0000-4000-8000-000000000004'
  $$,
  '%permission denied for table notification_deliveries%',
  'authenticated clients cannot directly update notification deliveries'
);

select throws_like(
  $$
    update public.notification_runtime_config
    set push_enabled = false
    where id
  $$,
  '%permission denied for table notification_runtime_config%',
  'authenticated clients cannot mutate notification runtime config'
);

reset role;

select ok(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.mark_notification_read(uuid)'
      ),
      'execute'
    ),
    false
  ),
  'authenticated can execute mark_notification_read'
);

select ok(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.mark_all_notifications_read()'
      ),
      'execute'
    ),
    false
  ),
  'authenticated can execute mark_all_notifications_read'
);

select ok(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.update_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,time without time zone,time without time zone,text,integer)'
      ),
      'execute'
    ),
    false
  ),
  'authenticated can execute update_notification_preferences'
);

select ok(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.save_push_subscription(text,text,text,text)'
      ),
      'execute'
    ),
    false
  ),
  'authenticated can execute save_push_subscription'
);

select ok(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.disable_push_subscription(text)'
      ),
      'execute'
    ),
    false
  ),
  'authenticated can execute disable_push_subscription'
);

select is(
  coalesce(
    pg_catalog.has_function_privilege(
      'anon',
      pg_catalog.to_regprocedure('public.mark_notification_read(uuid)'),
      'execute'
    ),
    false
  ),
  false,
  'anon cannot execute notification owner RPCs'
);

select is(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.create_notification(uuid,public.notification_type,text,text,text,jsonb,text,timestamp with time zone,boolean)'
      ),
      'execute'
    ),
    false
  ),
  false,
  'authenticated cannot execute create_notification'
);

select is(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.notification_category_for_type(public.notification_type)'
      ),
      'execute'
    ),
    false
  ),
  false,
  'authenticated cannot execute notification category helpers'
);

select is(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure('public.is_safe_notification_path(text)'),
      'execute'
    ),
    false
  ),
  false,
  'authenticated cannot execute notification path helpers'
);

select is(
  coalesce(
    pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure('public.is_safe_push_endpoint(text)'),
      'execute'
    ),
    false
  ),
  false,
  'authenticated cannot execute push endpoint helpers'
);

select ok(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.push_subscriptions',
    'endpoint',
    'select'
  ),
  'authenticated has direct SELECT privilege on safe subscription columns'
);

select is(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.push_subscriptions',
    'p256dh',
    'select'
  ),
  false,
  'authenticated has no direct SELECT privilege on p256dh'
);

select is(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.push_subscriptions',
    'auth',
    'select'
  ),
  false,
  'authenticated has no direct SELECT privilege on auth'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.handle_new_user()'::regprocedure,
    'execute'
  ),
  false,
  'authenticated cannot execute the signup trigger function'
);

select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.ensure_profile()'::regprocedure,
    'execute'
  ),
  false,
  'anon cannot execute ensure_profile'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_category_for_type',
        'is_safe_notification_path',
        'is_safe_push_endpoint',
        'create_notification',
        'mark_notification_read',
        'mark_all_notifications_read',
        'update_notification_preferences',
        'save_push_subscription',
        'disable_push_subscription',
        'handle_new_user',
        'ensure_profile'
      )
      and not coalesce(proc.proconfig, '{}'::text[]) @> array['search_path=""']
  $$,
  $$values (0)$$,
  'all notification security-definer functions fix an empty search_path'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_category_for_type',
        'is_safe_notification_path',
        'is_safe_push_endpoint',
        'create_notification',
        'mark_notification_read',
        'mark_all_notifications_read',
        'update_notification_preferences',
        'save_push_subscription',
        'disable_push_subscription',
        'handle_new_user',
        'ensure_profile'
      )
      and not proc.prosecdef
  $$,
  $$values (0)$$,
  'every expected notification definer function is SECURITY DEFINER'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'mark_notification_read',
        'mark_all_notifications_read',
        'update_notification_preferences',
        'save_push_subscription',
        'disable_push_subscription',
        'ensure_profile'
      )
      and pg_catalog.pg_get_functiondef(proc.oid) !~ 'auth[.]uid[(][)]'
  $$,
  $$values (0)$$,
  'authenticated security-definer RPCs explicitly authorize auth.uid()'
);

delete from public.notification_preferences
where user_id = '10000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.ensure_profile()$$,
  'ensure_profile repairs an existing authenticated profile'
);

select results_eq(
  $$
    select user_id
    from public.notification_preferences
    where user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid)$$,
  'ensure_profile provisions missing notification preferences'
);

reset role;

select matches(
  pg_catalog.pg_get_functiondef('public.handle_new_user()'::regprocedure),
  'insert into public[.]notification_preferences',
  'handle_new_user provisions notification preferences for new users'
);

select results_eq(
  $$
    select notification_type::text, public.notification_category_for_type(notification_type)::text
    from unnest(enum_range(null::public.notification_type)) as notification_type
    order by notification_type::text
  $$,
  $$
    values
      ('activity_approved', 'activities'),
      ('activity_joined', 'activities'),
      ('activity_match_digest', 'digest'),
      ('activity_rejected', 'activities'),
      ('badge_unlocked', 'rewards'),
      ('chat_message', 'chat'),
      ('chat_opened', 'chat'),
      ('event_reminder_1h', 'reminders'),
      ('event_reminder_24h', 'reminders'),
      ('friend_accepted', 'social'),
      ('friend_request', 'social'),
      ('friend_rsvp', 'social'),
      ('leaderboard_placement', 'rewards'),
      ('points_milestone', 'rewards'),
      ('pulse_prompt', 'reminders'),
      ('safety_report_status', 'safety'),
      ('safety_review', 'safety'),
      ('streak_at_risk', 'rewards'),
      ('waitlist_promoted', 'activities'),
      ('weekly_recap', 'digest')
  $$,
  'every approved notification type maps to its server-derived category'
);

select results_eq(
  $$
    select candidate, public.is_safe_notification_path(candidate)
    from (
      values
        ('/app'::text),
        ('/app/activities'::text),
        ('/app?tab=inbox'::text),
        ('/app#notifications'::text),
        ('/app?message=hello%20world&email=student%40umd.edu'::text),
        ('/app?return=%2Fapp%2Ffriends'::text),
        ('/app#progress=100%25'::text),
        ('/app/../admin'::text),
        ('/app/%2e%2e/admin'::text),
        ('/app/%2f%2fevil.example'::text),
        ('/app/%5cadmin'::text),
        ('/app/%09tab'::text),
        ('/app/%1funit-separator'::text),
        ('/app/%7fdelete'::text),
        ('/app/%252e%252e/admin'::text),
        ('/app/%255cadmin'::text),
        ('/app/%250aadmin'::text),
        ('/app/%252f%252fevil.example'::text),
        ('//evil.example/path'::text),
        ('https://evil.example/app'::text),
        (E'/app\\evil'::text),
        (''::text),
        (E'/app/line\nbreak'::text)
    ) as paths(candidate)
  $$,
  $$
    values
      ('/app'::text, true),
      ('/app/activities'::text, true),
      ('/app?tab=inbox'::text, true),
      ('/app#notifications'::text, true),
      ('/app?message=hello%20world&email=student%40umd.edu'::text, true),
      ('/app?return=%2Fapp%2Ffriends'::text, true),
      ('/app#progress=100%25'::text, true),
      ('/app/../admin'::text, false),
      ('/app/%2e%2e/admin'::text, false),
      ('/app/%2f%2fevil.example'::text, false),
      ('/app/%5cadmin'::text, false),
      ('/app/%09tab'::text, false),
      ('/app/%1funit-separator'::text, false),
      ('/app/%7fdelete'::text, false),
      ('/app/%252e%252e/admin'::text, false),
      ('/app/%255cadmin'::text, false),
      ('/app/%250aadmin'::text, false),
      ('/app/%252f%252fevil.example'::text, false),
      ('//evil.example/path'::text, false),
      ('https://evil.example/app'::text, false),
      (E'/app\\evil'::text, false),
      (''::text, false),
      (E'/app/line\nbreak'::text, false)
  $$,
  'notification paths accept app-local forms and reject redirects or unsafe characters'
);

select results_eq(
  $$
    select candidate, public.is_safe_push_endpoint(candidate)
    from (
      values
        ('https://fcm.googleapis.com/fcm/send/AbC_123?token=CaseSensitive'::text),
        ('https://updates.push.services.mozilla.com/wpush/v2/AbC_123'::text),
        ('https://web.push.apple.com/QHAbC_123'::text),
        ('https://push.example.com:65535/subscriptions/port-boundary'::text),
        ('http://fcm.googleapis.com/fcm/send/insecure'::text),
        ('ftp://push.example.com/subscriptions/wrong-scheme'::text),
        ('https://localhost/subscriptions/local'::text),
        ('https://push.localhost/subscriptions/local'::text),
        ('https://device.local/subscriptions/local'::text),
        ('https://8.8.8.8/subscriptions/ip-literal'::text),
        ('https://0.1.2.3/subscriptions/reserved'::text),
        ('https://10.1.2.3/subscriptions/private'::text),
        ('https://100.64.0.1/subscriptions/carrier-nat'::text),
        ('https://127.0.0.1/subscriptions/loopback'::text),
        ('https://169.254.1.1/subscriptions/link-local'::text),
        ('https://172.16.0.1/subscriptions/private'::text),
        ('https://192.168.1.1/subscriptions/private'::text),
        ('https://224.0.0.1/subscriptions/multicast'::text),
        ('https://240.0.0.1/subscriptions/reserved'::text),
        ('https://[2606:4700:4700::1111]/subscriptions/ipv6'::text),
        ('https://user:password@push.example.com/subscriptions/credentials'::text),
        ('https://push.example.com:abc/subscriptions/bad-port'::text),
        ('https://push.example.com:65536/subscriptions/bad-port'::text),
        ('https://push.example.com:443:444/subscriptions/bad-authority'::text),
        ('https://push.example.com'::text),
        ('https://push.example.com/'::text),
        ('https://push.example.com/subscriptions/fragment#secret'::text),
        (' https://push.example.com/subscriptions/leading-space'::text),
        ('https://push.example.com/subscriptions/trailing-space '::text),
        (E'https://push.example.com/subscriptions/line\nbreak'::text),
        ('retired:10000000-0000-4000-8000-000000000003'::text)
    ) as endpoints(candidate)
  $$,
  $$
    values
      ('https://fcm.googleapis.com/fcm/send/AbC_123?token=CaseSensitive'::text, true),
      ('https://updates.push.services.mozilla.com/wpush/v2/AbC_123'::text, true),
      ('https://web.push.apple.com/QHAbC_123'::text, true),
      ('https://push.example.com:65535/subscriptions/port-boundary'::text, true),
      ('http://fcm.googleapis.com/fcm/send/insecure'::text, false),
      ('ftp://push.example.com/subscriptions/wrong-scheme'::text, false),
      ('https://localhost/subscriptions/local'::text, false),
      ('https://push.localhost/subscriptions/local'::text, false),
      ('https://device.local/subscriptions/local'::text, false),
      ('https://8.8.8.8/subscriptions/ip-literal'::text, false),
      ('https://0.1.2.3/subscriptions/reserved'::text, false),
      ('https://10.1.2.3/subscriptions/private'::text, false),
      ('https://100.64.0.1/subscriptions/carrier-nat'::text, false),
      ('https://127.0.0.1/subscriptions/loopback'::text, false),
      ('https://169.254.1.1/subscriptions/link-local'::text, false),
      ('https://172.16.0.1/subscriptions/private'::text, false),
      ('https://192.168.1.1/subscriptions/private'::text, false),
      ('https://224.0.0.1/subscriptions/multicast'::text, false),
      ('https://240.0.0.1/subscriptions/reserved'::text, false),
      ('https://[2606:4700:4700::1111]/subscriptions/ipv6'::text, false),
      ('https://user:password@push.example.com/subscriptions/credentials'::text, false),
      ('https://push.example.com:abc/subscriptions/bad-port'::text, false),
      ('https://push.example.com:65536/subscriptions/bad-port'::text, false),
      ('https://push.example.com:443:444/subscriptions/bad-authority'::text, false),
      ('https://push.example.com'::text, false),
      ('https://push.example.com/'::text, false),
      ('https://push.example.com/subscriptions/fragment#secret'::text, false),
      (' https://push.example.com/subscriptions/leading-space'::text, false),
      ('https://push.example.com/subscriptions/trailing-space '::text, false),
      (E'https://push.example.com/subscriptions/line\nbreak'::text, false),
      ('retired:10000000-0000-4000-8000-000000000003'::text, false)
  $$,
  'push endpoint validation permits public Web Push URLs and rejects unsafe egress targets'
);

select throws_ok(
  $$
    select public.create_notification(
      '30000000-0000-4000-8000-000000000001',
      'chat_message',
      'Missing recipient',
      'No profile owns this notification.',
      '/app',
      '{}'::jsonb,
      'fixture:missing-recipient'
    )
  $$,
  '22023'::char(5),
  'Notification recipient does not exist',
  'create_notification rejects recipients without a profile'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      ' ',
      'Valid body',
      '/app',
      '{}'::jsonb,
      'fixture:empty-title'
    )
  $$,
  '22023'::char(5),
  'Notification title is required',
  'create_notification rejects an empty title'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      repeat('t', 121),
      'Valid body',
      '/app',
      '{}'::jsonb,
      'fixture:long-title'
    )
  $$,
  '22023'::char(5),
  'Notification title exceeds 120 characters',
  'create_notification rejects an over-limit title'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Valid title',
      ' ',
      '/app',
      '{}'::jsonb,
      'fixture:empty-body'
    )
  $$,
  '22023'::char(5),
  'Notification body is required',
  'create_notification rejects an empty body'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Valid title',
      repeat('b', 1001),
      '/app',
      '{}'::jsonb,
      'fixture:long-body'
    )
  $$,
  '22023'::char(5),
  'Notification body exceeds 1000 characters',
  'create_notification rejects an over-limit body'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Valid title',
      'Valid body',
      '/app',
      '{}'::jsonb,
      ' '
    )
  $$,
  '22023'::char(5),
  'Notification dedupe key is required',
  'create_notification rejects an empty dedupe key'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Valid title',
      'Valid body',
      '/app',
      '{}'::jsonb,
      repeat('k', 256)
    )
  $$,
  '22023'::char(5),
  'Notification dedupe key exceeds 255 characters',
  'create_notification rejects an over-limit dedupe key'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Unsafe path',
      'Absolute redirect paths are forbidden.',
      '//evil.example/path',
      '{}'::jsonb,
      'fixture:unsafe-path'
    )
  $$,
  '22023'::char(5),
  'Unsafe notification path',
  'create_notification rejects unsafe notification paths'
);

select throws_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Invalid data',
      'Array payloads are forbidden.',
      '/app',
      '[]'::jsonb,
      'fixture:invalid-data'
    )
  $$,
  '22023'::char(5),
  'Notification data must be a JSON object',
  'create_notification rejects non-object data'
);

select lives_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'friend_request',
      'Friend request',
      'A student would like to connect.',
      '/app/friends?tab=requests#pending',
      '{"request_id":"40000000-0000-4000-8000-000000000001"}'::jsonb,
      'fixture:create:derived-category',
      '2026-08-01 12:00:00+00'::timestamptz,
      false
    )
  $$,
  'create_notification accepts valid notification content'
);

select results_eq(
  $$
    select category::text
    from public.notifications
    where user_id = '10000000-0000-4000-8000-000000000001'
      and dedupe_key = 'fixture:create:derived-category'
  $$,
  $$values ('social'::text)$$,
  'create_notification derives category from type instead of trusting callers'
);

select lives_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Original title',
      'Original body',
      '/app/chats/original',
      '{"version":1}'::jsonb,
      'fixture:create:idempotent',
      '2026-08-01 13:00:00+00'::timestamptz,
      false
    )
  $$,
  'create_notification inserts the first deduplicated notification'
);

update public.notifications
set read_at = '2026-08-01 14:00:00+00'::timestamptz,
    seen_at = '2026-08-01 14:00:00+00'::timestamptz
where user_id = '10000000-0000-4000-8000-000000000001'
  and dedupe_key = 'fixture:create:idempotent';

select lives_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Replacement title',
      'Replacement body',
      '/app/chats/replacement',
      '{"version":2}'::jsonb,
      'fixture:create:idempotent',
      '2026-08-02 13:00:00+00'::timestamptz,
      false
    )
  $$,
  'duplicate creation without reopen returns the existing notification'
);

select results_eq(
  $$
    select
      count(*)::integer,
      min(title),
      min(body),
      min(url),
      min(data::text),
      min(last_event_at),
      bool_and(read_at is not null),
      bool_and(seen_at is not null)
    from public.notifications
    where user_id = '10000000-0000-4000-8000-000000000001'
      and dedupe_key = 'fixture:create:idempotent'
  $$,
  $$
    values (
      1,
      'Original title'::text,
      'Original body'::text,
      '/app/chats/original'::text,
      '{"version": 1}'::text,
      '2026-08-01 13:00:00+00'::timestamptz,
      true,
      true
    )
  $$,
  'p_reopen false preserves existing content event time and read state'
);

select lives_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Ignored reopened title',
      'Reopened body',
      '/app/chats/ignored-reopen-url',
      '{"version":3}'::jsonb,
      'fixture:create:idempotent',
      '2026-08-03 13:00:00+00'::timestamptz,
      true
    )
  $$,
  'duplicate creation with reopen returns the reopened notification'
);

select results_eq(
  $$
    select
      count(*)::integer,
      min(body),
      min(data::text),
      min(last_event_at),
      bool_and(read_at is null),
      bool_and(seen_at is null)
    from public.notifications
    where user_id = '10000000-0000-4000-8000-000000000001'
      and dedupe_key = 'fixture:create:idempotent'
  $$,
  $$
    values (
      1,
      'Reopened body'::text,
      '{"version": 3}'::text,
      '2026-08-03 13:00:00+00'::timestamptz,
      true,
      true
    )
  $$,
  'p_reopen true updates body data and time while clearing read and seen state'
);

update public.notifications
set read_at = '2026-08-03 14:00:00+00'::timestamptz,
    seen_at = '2026-08-03 14:00:00+00'::timestamptz
where user_id = '10000000-0000-4000-8000-000000000001'
  and dedupe_key = 'fixture:create:idempotent';

select lives_ok(
  $$
    select public.create_notification(
      '10000000-0000-4000-8000-000000000001',
      'chat_message',
      'Stale title',
      'Stale body',
      '/app/chats/stale',
      '{"version":2}'::jsonb,
      'fixture:create:idempotent',
      '2026-08-02 13:00:00+00'::timestamptz,
      true
    )
  $$,
  'an older reopen event returns the current notification'
);

select results_eq(
  $$
    select
      body,
      data::text,
      last_event_at,
      read_at is not null,
      seen_at is not null
    from public.notifications
    where user_id = '10000000-0000-4000-8000-000000000001'
      and dedupe_key = 'fixture:create:idempotent'
  $$,
  $$
    values (
      'Reopened body'::text,
      '{"version": 3}'::text,
      '2026-08-03 13:00:00+00'::timestamptz,
      true,
      true
    )
  $$,
  'an older reopen event cannot overwrite newer content or clear read state'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$
    select id, read_at is not null, seen_at is not null
    from public.mark_notification_read(
      '10000000-0000-4000-8000-000000000002'
    )
  $$,
  $$values ('10000000-0000-4000-8000-000000000002'::uuid, true, true)$$,
  'mark_notification_read sets read and seen for an owned notification'
);

select throws_ok(
  $$
    select public.mark_notification_read(
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501'::char(5),
  'Not authorized',
  'mark_notification_read rejects another owner notification'
);

reset role;

update public.notifications
set read_at = coalesce(read_at, now()),
    seen_at = coalesce(seen_at, now())
where user_id = '10000000-0000-4000-8000-000000000001';

insert into public.notifications (
  id, user_id, type, category, title, body, url, dedupe_key
)
values
  (
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'pulse_prompt',
    'reminders',
    'Pulse one',
    'First unread notification.',
    '/app',
    'fixture:mark-all:1'
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000001',
    'pulse_prompt',
    'reminders',
    'Pulse two',
    'Second unread notification.',
    '/app',
    'fixture:mark-all:2'
  );

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$select public.mark_all_notifications_read()$$,
  $$values (2)$$,
  'mark_all_notifications_read returns the number of caller-owned unread rows'
);

reset role;

select results_eq(
  $$
    select
      count(*) filter (
        where user_id = '10000000-0000-4000-8000-000000000001'
          and read_at is null
      )::integer,
      count(*) filter (
        where user_id = '20000000-0000-4000-8000-000000000001'
          and read_at is null
      )::integer
    from public.notifications
  $$,
  $$values (0, 1)$$,
  'mark_all_notifications_read changes only the caller owned rows'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

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
    from public.update_notification_preferences(
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      '22:30'::time,
      '07:15'::time,
      'America/Los_Angeles',
      25
    )
  $$,
  $$
    values (
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      '22:30'::time,
      '07:15'::time,
      'America/Los_Angeles'::text,
      25
    )
  $$,
  'update_notification_preferences accepts approved scalar values'
);

select throws_ok(
  $$
    select public.update_notification_preferences(
      true, true, true, true, true, true, false, true,
      null, null, 'Mars/Olympus_Mons', 10
    )
  $$,
  '22023'::char(5),
  'Unsupported timezone',
  'update_notification_preferences validates pg_timezone_names'
);

select throws_ok(
  $$
    select public.update_notification_preferences(
      true, true, true, true, true, true, false, true,
      null, null, 'UTC', 0
    )
  $$,
  '22023'::char(5),
  'Daily push cap must be between 1 and 50',
  'update_notification_preferences rejects a cap below one'
);

select throws_ok(
  $$
    select public.update_notification_preferences(
      true, true, true, true, true, true, false, true,
      null, null, 'UTC', 51
    )
  $$,
  '22023'::char(5),
  'Daily push cap must be between 1 and 50',
  'update_notification_preferences rejects a cap above fifty'
);

reset role;

select results_eq(
  $$
    select push_enabled, timezone, daily_push_cap
    from public.notification_preferences
    where user_id = '20000000-0000-4000-8000-000000000001'
  $$,
  $$values (true, 'America/New_York'::text, 6)$$,
  'preference updates cannot change another owner row'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$
    select
      user_id,
      endpoint,
      p256dh,
      auth,
      user_agent,
      disabled_at is null,
      failure_count
    from public.save_push_subscription(
      'https://push.example.test/subscriptions/fixed-fixture',
      'owner-updated-p256dh',
      'owner-updated-auth',
      'updated fixture browser'
    )
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'https://push.example.test/subscriptions/fixed-fixture'::text,
      'owner-updated-p256dh'::text,
      'owner-updated-auth'::text,
      'updated fixture browser'::text,
      true,
      0
    )
  $$,
  'save_push_subscription refreshes the caller current endpoint and keys'
);

select lives_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/fixed-fixture',
      'owner-updated-p256dh',
      'owner-updated-auth',
      'updated fixture browser'
    )
  $$,
  'save_push_subscription is idempotent for the caller current subscription'
);

select results_eq(
  $$
    select count(*)::integer
    from public.push_subscriptions
    where endpoint = 'https://push.example.test/subscriptions/fixed-fixture'
  $$,
  $$values (1)$$,
  'idempotent subscription saves keep one endpoint row'
);

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://localhost/subscriptions/new-unsafe-endpoint',
      'unsafe-new-p256dh',
      'unsafe-new-auth',
      null
    )
  $$,
  '22023'::char(5),
  'Unsafe push endpoint',
  'new subscription registration rejects unsafe egress endpoints'
);

reset role;

insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, user_agent
)
values
  (
    '10000000-0000-4000-8000-000000000015',
    '10000000-0000-4000-8000-000000000001',
    'https://127.0.0.1/subscriptions/same-owner-unsafe',
    'unsafe-same-owner-p256dh',
    'unsafe-same-owner-auth',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000015',
    '20000000-0000-4000-8000-000000000001',
    'https://10.0.0.1/subscriptions/transfer-unsafe',
    'unsafe-transfer-p256dh',
    'unsafe-transfer-auth',
    null
  );

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://127.0.0.1/subscriptions/same-owner-unsafe',
      'unsafe-same-owner-p256dh',
      'unsafe-same-owner-auth',
      null
    )
  $$,
  '22023'::char(5),
  'Unsafe push endpoint',
  'same-owner refresh rejects unsafe egress endpoints'
);

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://10.0.0.1/subscriptions/transfer-unsafe',
      'unsafe-transfer-p256dh',
      'unsafe-transfer-auth',
      null
    )
  $$,
  '22023'::char(5),
  'Unsafe push endpoint',
  'endpoint transfer rejects unsafe egress endpoints before ownership changes'
);

select results_eq(
  $$
    select
      pg_catalog.char_length(endpoint),
      pg_catalog.char_length(p256dh),
      pg_catalog.char_length(auth),
      pg_catalog.char_length(user_agent)
    from public.save_push_subscription(
      'https://push.example.test/boundary/'
        || repeat(
          'e',
          4096 - pg_catalog.char_length('https://push.example.test/boundary/')
        ),
      repeat('p', 1024),
      repeat('a', 1024),
      repeat('u', 512)
    )
  $$,
  $$values (4096, 1024, 1024, 512)$$,
  'save_push_subscription accepts every input at its exact size limit'
);

select throws_ok(
  $$
    select public.save_push_subscription(
      repeat('e', 4097),
      'endpoint-limit-p256dh',
      'endpoint-limit-auth',
      null
    )
  $$,
  '22023'::char(5),
  'Push endpoint exceeds 4096 characters',
  'save_push_subscription rejects an over-limit endpoint'
);

select lives_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/same-owner-bounds',
      'same-owner-p256dh',
      'same-owner-auth',
      null
    )
  $$,
  'same-owner bounds fixture is registered'
);

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/same-owner-bounds',
      repeat('p', 1025),
      'same-owner-auth',
      null
    )
  $$,
  '22023'::char(5),
  'Push p256dh key exceeds 1024 characters',
  'same-owner subscription refresh rejects an over-limit p256dh key'
);

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/auth-bounds',
      'auth-limit-p256dh',
      repeat('a', 1025),
      null
    )
  $$,
  '22023'::char(5),
  'Push auth key exceeds 1024 characters',
  'new subscription registration rejects an over-limit auth key'
);

reset role;

insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, user_agent
)
values (
  '20000000-0000-4000-8000-000000000014',
  '20000000-0000-4000-8000-000000000001',
  'https://push.example.test/subscriptions/transfer-bounds',
  'transfer-bounds-p256dh',
  'transfer-bounds-auth',
  'old transfer browser'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/transfer-bounds',
      'transfer-bounds-p256dh',
      'transfer-bounds-auth',
      repeat('u', 513)
    )
  $$,
  '22023'::char(5),
  'Push user agent exceeds 512 characters',
  'subscription transfer rejects an over-limit user agent before ownership changes'
);

select lives_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/disable-me',
      'disable-p256dh',
      'disable-auth',
      null
    )
  $$,
  'save_push_subscription creates a second caller device'
);

select is(
  public.disable_push_subscription(
    'https://push.example.test/subscriptions/other-owner'
  ),
  false,
  'disable_push_subscription does not affect another owner endpoint'
);

select is(
  public.disable_push_subscription(
    'https://push.example.test/subscriptions/disable-me'
  ),
  true,
  'disable_push_subscription disables the caller endpoint'
);

reset role;

select results_eq(
  $$
    select
      count(*) filter (
        where endpoint = 'https://push.example.test/subscriptions/other-owner'
          and disabled_at is null
      )::integer,
      count(*) filter (
        where endpoint = 'https://push.example.test/subscriptions/disable-me'
          and disabled_at is not null
      )::integer
    from public.push_subscriptions
  $$,
  $$values (1, 1)$$,
  'disable_push_subscription changes only the caller matching endpoint'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.save_push_subscription(
      'https://push.example.test/subscriptions/fixed-fixture',
      'wrong-p256dh',
      'wrong-auth',
      'attacker browser'
    )
  $$,
  '42501'::char(5),
  'Not authorized',
  'endpoint transfer rejects callers that do not possess the current keys'
);

select results_eq(
  $$
    select user_id, endpoint, p256dh, auth, disabled_at is null
    from public.save_push_subscription(
      'https://push.example.test/subscriptions/fixed-fixture',
      'owner-updated-p256dh',
      'owner-updated-auth',
      'new owner browser'
    )
  $$,
  $$
    values (
      '20000000-0000-4000-8000-000000000001'::uuid,
      'https://push.example.test/subscriptions/fixed-fixture'::text,
      'owner-updated-p256dh'::text,
      'owner-updated-auth'::text,
      true
    )
  $$,
  'a caller proving endpoint and key possession receives a new active subscription'
);

reset role;

select results_eq(
  $$
    select
      user_id,
      endpoint,
      p256dh,
      auth,
      disabled_at is not null
    from public.push_subscriptions
    where id = '10000000-0000-4000-8000-000000000003'
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'retired:10000000-0000-4000-8000-000000000003'::text,
      'retired'::text,
      'retired'::text,
      true
    )
  $$,
  'referenced endpoint transfer retires the old owner row with non-secret tombstones'
);

select results_eq(
  $$
    select subscription_id, user_id
    from public.notification_deliveries
    where id = '10000000-0000-4000-8000-000000000004'
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid
    )
  $$,
  'referenced endpoint transfer preserves the historical delivery owner and subscription'
);

select results_eq(
  $$
    select count(*)::integer
    from public.push_subscriptions
    where endpoint = 'https://push.example.test/subscriptions/fixed-fixture'
      and disabled_at is null
  $$,
  $$values (1)$$,
  'a transferred referenced endpoint has exactly one globally active row'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.save_push_subscription(
      'retired:10000000-0000-4000-8000-000000000003',
      'replacement-p256dh',
      'replacement-auth',
      'old owner browser'
    )
  $$,
  '22023'::char(5),
  'Reserved push endpoint',
  'callers cannot reactivate or squat internal tombstone endpoints'
);

reset role;

-- Keep the remaining assertions independent when this regression is run RED.
update public.push_subscriptions
set p256dh = 'retired',
    auth = 'retired',
    user_agent = null,
    disabled_at = coalesce(disabled_at, now())
where id = '10000000-0000-4000-8000-000000000003';

insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, user_agent
)
values (
  '10000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000001',
  'https://push.example.test/subscriptions/unreferenced-transfer',
  'unreferenced-p256dh',
  'unreferenced-auth',
  'unreferenced old owner browser'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$
    select user_id, endpoint, disabled_at is null
    from public.save_push_subscription(
      'https://push.example.test/subscriptions/unreferenced-transfer',
      'unreferenced-p256dh',
      'unreferenced-auth',
      'unreferenced new owner browser'
    )
  $$,
  $$
    values (
      '20000000-0000-4000-8000-000000000001'::uuid,
      'https://push.example.test/subscriptions/unreferenced-transfer'::text,
      true
    )
  $$,
  'unreferenced endpoint transfer creates a new active row for the caller'
);

select results_eq(
  $$
    select endpoint
    from public.push_subscriptions
    where endpoint in (
      'https://push.example.test/subscriptions/unreferenced-transfer',
      'retired:10000000-0000-4000-8000-000000000013'
    )
    order by endpoint
  $$,
  $$values ('https://push.example.test/subscriptions/unreferenced-transfer'::text)$$,
  'endpoint transfer never exposes another owner retired row through RLS'
);

reset role;

select results_eq(
  $$
    select
      user_id,
      endpoint,
      p256dh,
      auth,
      disabled_at is not null
    from public.push_subscriptions
    where id = '10000000-0000-4000-8000-000000000013'
  $$,
  $$
    values (
      '10000000-0000-4000-8000-000000000001'::uuid,
      'retired:10000000-0000-4000-8000-000000000013'::text,
      'retired'::text,
      'retired'::text,
      true
    )
  $$,
  'unreferenced endpoint transfer also retires the old owner row safely'
);

select results_eq(
  $$
    select
      count(*) filter (
        where endpoint = 'https://push.example.test/subscriptions/unreferenced-transfer'
          and disabled_at is null
      )::integer,
      count(*) filter (
        where subscription_id = '10000000-0000-4000-8000-000000000013'
      )::integer
    from public.push_subscriptions
    left join public.notification_deliveries
      on notification_deliveries.subscription_id = push_subscriptions.id
  $$,
  $$values (1, 0)$$,
  'unreferenced transfer keeps one active endpoint and introduces no historical delivery'
);

select results_eq(
  $$
    select count(*)::integer
    from (
      values
        ('anon'::name),
        ('authenticated'::name)
    ) as roles(role_name)
    cross join lateral (
      values
        (pg_catalog.to_regprocedure(
          'public.create_notification(uuid,public.notification_type,text,text,text,jsonb,text,timestamp with time zone,boolean)'
        )),
        (pg_catalog.to_regprocedure(
          'public.notification_category_for_type(public.notification_type)'
        )),
        (pg_catalog.to_regprocedure('public.is_safe_notification_path(text)')),
        (pg_catalog.to_regprocedure('public.is_safe_push_endpoint(text)')),
        ('public.handle_new_user()'::regprocedure),
        ('public.handle_updated_at()'::regprocedure)
    ) as functions(function_oid)
    where coalesce(
      pg_catalog.has_function_privilege(
        roles.role_name,
        functions.function_oid,
        'execute'
      ),
      false
    )
  $$,
  $$values (0)$$,
  'internal notification creation helpers and trigger functions are unavailable to clients'
);

-- Bounded two-session checks prove the advisory/row locks under real contention.
reset role;

select is(
  extensions.dblink_connect(
    'notification_concurrency_a',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
  ),
  'OK'::text,
  'first concurrency connection opens'
);

select is(
  extensions.dblink_connect(
    'notification_concurrency_b',
    'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
  ),
  'OK'::text,
  'second concurrency connection opens'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      $remote$
        delete from auth.users
        where id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      $remote$
    )
  $test$,
  'stale committed concurrency fixtures are removed before setup'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      $remote$
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
        values
          (
            '00000000-0000-0000-0000-000000000000',
            '40000000-0000-4000-8000-000000000001',
            'authenticated',
            'authenticated',
            'notification-concurrency@umd.edu',
            '',
            now(),
            '{"provider":"google","providers":["google"]}'::jsonb,
            '{"full_name":"Notification Concurrency"}'::jsonb,
            now(),
            now()
          ),
          (
            '00000000-0000-0000-0000-000000000000',
            '50000000-0000-4000-8000-000000000001',
            'authenticated',
            'authenticated',
            'transfer-old-owner@umd.edu',
            '',
            now(),
            '{"provider":"google","providers":["google"]}'::jsonb,
            '{"full_name":"Transfer Old"}'::jsonb,
            now(),
            now()
          ),
          (
            '00000000-0000-0000-0000-000000000000',
            '60000000-0000-4000-8000-000000000001',
            'authenticated',
            'authenticated',
            'transfer-new-owner@umd.edu',
            '',
            now(),
            '{"provider":"google","providers":["google"]}'::jsonb,
            '{"full_name":"Transfer New"}'::jsonb,
            now(),
            now()
          );

        insert into public.notifications (
          id, user_id, type, category, title, body, url, dedupe_key
        )
        values (
          '50000000-0000-4000-8000-000000000002',
          '50000000-0000-4000-8000-000000000001',
          'chat_message',
          'chat',
          'Transfer audit notification',
          'Delivery audit must survive endpoint transfer.',
          '/app',
          'fixture:concurrency:transfer-audit'
        );

        insert into public.push_subscriptions (
          id, user_id, endpoint, p256dh, auth, user_agent
        )
        values (
          '50000000-0000-4000-8000-000000000003',
          '50000000-0000-4000-8000-000000000001',
          'https://fcm.googleapis.com/fcm/send/concurrency-transfer',
          'concurrency-transfer-p256dh',
          'concurrency-transfer-auth',
          'old concurrency browser'
        );

        insert into public.notification_deliveries (
          id, notification_id, subscription_id, user_id
        )
        values (
          '50000000-0000-4000-8000-000000000004',
          '50000000-0000-4000-8000-000000000002',
          '50000000-0000-4000-8000-000000000003',
          '50000000-0000-4000-8000-000000000001'
        );
      $remote$
    )
  $test$,
  'committed concurrency fixtures are created outside the pgTAP transaction'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      'begin; set local statement_timeout = ''5s''; set local lock_timeout = ''3s'''
    )
  $$,
  'first notification transaction starts with bounded timeouts'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_b',
      'begin; set local statement_timeout = ''5s''; set local lock_timeout = ''3s'''
    )
  $$,
  'second notification transaction starts with bounded timeouts'
);

select lives_ok(
  $test$
    select *
    from extensions.dblink(
      'notification_concurrency_a',
      $remote$
        select (
          public.create_notification(
            '40000000-0000-4000-8000-000000000001',
            'chat_message',
            'Concurrent message',
            'First concurrent body',
            '/app',
            '{"source":"first"}'::jsonb,
            'fixture:concurrency:same-dedupe',
            '2026-08-04 12:00:00+00'::timestamptz,
            false
          )
        ).id
      $remote$
    ) as created(id uuid)
  $test$,
  'first transaction creates the deduplicated notification while holding its lock'
);

select is(
  extensions.dblink_send_query(
    'notification_concurrency_b',
    $remote$
      select (
        public.create_notification(
          '40000000-0000-4000-8000-000000000001',
          'chat_message',
          'Concurrent message duplicate',
          'Second concurrent body',
          '/app',
          '{"source":"second"}'::jsonb,
          'fixture:concurrency:same-dedupe',
          '2026-08-04 12:00:01+00'::timestamptz,
          false
        )
      ).id
    $remote$
  ),
  1,
  'second concurrent notification request is dispatched asynchronously'
);

select is(
  extensions.dblink_is_busy('notification_concurrency_b'),
  1,
  'second notification request waits on the first transaction lock'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_concurrency_a', 'commit')$$,
  'first notification transaction commits and releases its lock'
);

select lives_ok(
  $$
    select *
    from extensions.dblink_get_result('notification_concurrency_b')
      as created(id uuid)
  $$,
  'second notification request completes after the first commit'
);

select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_concurrency_b')
      as drained(id uuid)
  ),
  0::bigint,
  'second notification connection drains its asynchronous result'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_concurrency_b', 'commit')$$,
  'second notification transaction commits'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notifications
    where user_id = '40000000-0000-4000-8000-000000000001'
      and dedupe_key = 'fixture:concurrency:same-dedupe'
  $$,
  $$values (1)$$,
  'simultaneous same-user same-dedupe creation leaves one notification'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      'begin; set local statement_timeout = ''5s''; set local lock_timeout = ''3s'''
    )
  $$,
  'first transfer transaction starts with bounded timeouts'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_b',
      'begin; set local statement_timeout = ''5s''; set local lock_timeout = ''3s'''
    )
  $$,
  'second transfer transaction starts with bounded timeouts'
);

select lives_ok(
  $test$
    select *
    from extensions.dblink(
      'notification_concurrency_a',
      $remote$
        select set_config(
          'request.jwt.claim.sub',
          '60000000-0000-4000-8000-000000000001',
          true
        )
      $remote$
    ) as configured(value text)
  $test$,
  'first transfer transaction receives the new owner auth claim'
);

select lives_ok(
  $test$
    select *
    from extensions.dblink(
      'notification_concurrency_b',
      $remote$
        select set_config(
          'request.jwt.claim.sub',
          '60000000-0000-4000-8000-000000000001',
          true
        )
      $remote$
    ) as configured(value text)
  $test$,
  'second transfer transaction receives the new owner auth claim'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      'set local role authenticated'
    )
  $$,
  'first transfer transaction assumes the authenticated role'
);

select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_concurrency_b',
      'set local role authenticated'
    )
  $$,
  'second transfer transaction assumes the authenticated role'
);

select lives_ok(
  $test$
    select *
    from extensions.dblink(
      'notification_concurrency_a',
      $remote$
        select (
          public.save_push_subscription(
            'https://fcm.googleapis.com/fcm/send/concurrency-transfer',
            'concurrency-transfer-p256dh',
            'concurrency-transfer-auth',
            'new concurrency browser'
          )
        ).id
      $remote$
    ) as saved(id uuid)
  $test$,
  'first endpoint transfer holds the endpoint lock before commit'
);

select is(
  extensions.dblink_send_query(
    'notification_concurrency_b',
    $remote$
      select (
        public.save_push_subscription(
          'https://fcm.googleapis.com/fcm/send/concurrency-transfer',
          'concurrency-transfer-p256dh',
          'concurrency-transfer-auth',
          'new concurrency browser'
        )
      ).id
    $remote$
  ),
  1,
  'second same-endpoint transfer is dispatched asynchronously'
);

select is(
  extensions.dblink_is_busy('notification_concurrency_b'),
  1,
  'second same-endpoint transfer waits on the endpoint lock'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_concurrency_a', 'commit')$$,
  'first endpoint transfer commits and releases its lock'
);

select lives_ok(
  $$
    select *
    from extensions.dblink_get_result('notification_concurrency_b')
      as saved(id uuid)
  $$,
  'second same-endpoint transfer completes idempotently'
);

select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_concurrency_b')
      as drained(id uuid)
  ),
  0::bigint,
  'second transfer connection drains its asynchronous result'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_concurrency_b', 'commit')$$,
  'second endpoint transfer transaction commits'
);

select results_eq(
  $$
    select
      (
        select count(*)::integer
        from public.push_subscriptions
        where endpoint = 'https://fcm.googleapis.com/fcm/send/concurrency-transfer'
          and user_id = '60000000-0000-4000-8000-000000000001'
          and disabled_at is null
      ),
      (
        select count(*)::integer
        from public.push_subscriptions
        where id = '50000000-0000-4000-8000-000000000003'
          and user_id = '50000000-0000-4000-8000-000000000001'
          and endpoint = 'retired:50000000-0000-4000-8000-000000000003'
          and disabled_at is not null
      ),
      (
        select count(*)::integer
        from public.notification_deliveries
        where id = '50000000-0000-4000-8000-000000000004'
          and subscription_id = '50000000-0000-4000-8000-000000000003'
          and user_id = '50000000-0000-4000-8000-000000000001'
      )
  $$,
  $$values (1, 1, 1)$$,
  'simultaneous transfer leaves one active endpoint and preserves old delivery audit'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_concurrency_a',
      $remote$
        delete from auth.users
        where id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      $remote$
    )
  $test$,
  'committed concurrency fixtures are removed'
);

select results_eq(
  $$
    select
      (
        select count(*)::integer
        from auth.users
        where id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      ),
      (
        select count(*)::integer
        from public.notifications
        where user_id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      ),
      (
        select count(*)::integer
        from public.push_subscriptions
        where user_id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      ),
      (
        select count(*)::integer
        from public.notification_deliveries
        where user_id in (
          '40000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001'
        )
      )
  $$,
  $$values (0, 0, 0, 0)$$,
  'remote concurrency cleanup leaves no committed fixtures'
);

select lives_ok(
  $$select extensions.dblink_disconnect('notification_concurrency_a')$$,
  'first concurrency connection closes'
);

select lives_ok(
  $$select extensions.dblink_disconnect('notification_concurrency_b')$$,
  'second concurrency connection closes'
);

select results_eq(
  $$
    select
      public.notification_rollout_eligible(
        '10000000-0000-4000-8000-000000000001', 0
      ),
      public.notification_rollout_eligible(
        '10000000-0000-4000-8000-000000000001', 100
      ),
      public.notification_rollout_eligible(
        '10000000-0000-4000-8000-000000000001', 33
      ),
      public.notification_rollout_eligible(
        '10000000-0000-4000-8000-000000000001', 34
      ),
      public.notification_rollout_eligible(
        '10000000-0000-4000-8000-000000000001', 34
      )
  $$,
  $$values (false, true, false, true, true)$$,
  'rollout bucketing is deterministic with stable zero hundred and representative boundaries'
);

select throws_ok(
  $$
    select public.notification_rollout_eligible(
      '10000000-0000-4000-8000-000000000001', 101
    )
  $$,
  '22023'::char(5),
  'Rollout percentage must be between 0 and 100',
  'rollout eligibility validates percentage bounds'
);

select results_eq(
  $$
    select public.notification_deliver_after(
      '2026-08-04 16:00:00+00', 'UTC', null, null
    )
    union all
    select public.notification_deliver_after(
      '2026-08-04 16:00:00+00', 'UTC', '12:00', '12:00'
    )
  $$,
  $$
    values
      ('2026-08-04 16:00:00+00'::timestamptz),
      ('2026-08-04 16:00:00+00'::timestamptz)
  $$,
  'missing or equal quiet hour bounds disable deferral'
);

select results_eq(
  $$
    select public.notification_deliver_after(
      '2026-08-04 16:00:00+00', 'UTC', '09:00', '17:00'
    )
    union all
    select public.notification_deliver_after(
      '2026-08-04 18:00:00+00', 'UTC', '09:00', '17:00'
    )
  $$,
  $$
    values
      ('2026-08-04 17:00:00+00'::timestamptz),
      ('2026-08-04 18:00:00+00'::timestamptz)
  $$,
  'daytime quiet hours defer only instants inside the interval'
);

select results_eq(
  $$
    select public.notification_deliver_after(
      '2026-08-04 23:00:00+00', 'UTC', '22:00', '07:00'
    )
    union all
    select public.notification_deliver_after(
      '2026-08-05 02:00:00+00', 'UTC', '22:00', '07:00'
    )
    union all
    select public.notification_deliver_after(
      '2026-08-05 12:00:00+00', 'UTC', '22:00', '07:00'
    )
  $$,
  $$
    values
      ('2026-08-05 07:00:00+00'::timestamptz),
      ('2026-08-05 07:00:00+00'::timestamptz),
      ('2026-08-05 12:00:00+00'::timestamptz)
  $$,
  'cross midnight quiet hours handle both sides of local midnight'
);

select results_eq(
  $$
    select public.notification_deliver_after(
      '2026-03-08 06:45:00+00',
      'America/New_York',
      '22:00',
      '02:30'
    )
    union all
    select public.notification_deliver_after(
      '2026-11-01 05:15:00+00',
      'America/New_York',
      '22:00',
      '01:30'
    )
  $$,
  $$
    values
      ('2026-03-08 07:30:00+00'::timestamptz),
      ('2026-11-01 06:30:00+00'::timestamptz)
  $$,
  'New York spring forward and fall back quiet ends resolve to future real instants'
);

select throws_ok(
  $$
    select public.notification_deliver_after(
      now(), 'Mars/Olympus_Mons', '22:00', '07:00'
    )
  $$,
  '22023'::char(5),
  'Unsupported timezone',
  'quiet hour calculation fails safely for an unsupported timezone'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '70000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'delivery-fixture@umd.edu', '', now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Delivery Fixture"}'::jsonb,
  now(), now()
);

update public.notification_runtime_config
set notification_core_enabled = true,
    push_enabled = true,
    rewards_enabled = true,
    push_rollout_percentage = 100
where id;

update public.notification_preferences
set push_enabled = true,
    chat_enabled = true,
    activities_enabled = true,
    reminders_enabled = true,
    social_enabled = true,
    safety_enabled = true,
    digest_enabled = true,
    rewards_enabled = true,
    quiet_hours_start = null,
    quiet_hours_end = null,
    timezone = 'UTC',
    daily_push_cap = 50
where user_id = '70000000-0000-4000-8000-000000000001';

insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, disabled_at
)
values
  (
    '70000000-0000-4000-8000-000000000021',
    '70000000-0000-4000-8000-000000000001',
    'https://push.example.test/delivery/device-a', 'delivery-key-a', 'delivery-auth-a', null
  ),
  (
    '70000000-0000-4000-8000-000000000022',
    '70000000-0000-4000-8000-000000000001',
    'https://push.example.test/delivery/device-b', 'delivery-key-b', 'delivery-auth-b', null
  ),
  (
    '70000000-0000-4000-8000-000000000023',
    '70000000-0000-4000-8000-000000000001',
    'https://push.example.test/delivery/disabled', 'delivery-key-c', 'delivery-auth-c', now()
  ),
  (
    '70000000-0000-4000-8000-000000000024',
    '70000000-0000-4000-8000-000000000001',
    'retired:70000000-0000-4000-8000-000000000024', 'retired', 'retired', now()
  );

select lives_ok(
  $$
    select public.create_notification(
      '70000000-0000-4000-8000-000000000001',
      'chat_message', 'Two devices', 'Deliver this to both active devices.',
      '/app/chats/two-devices', '{}'::jsonb,
      'delivery:enqueue:two-device'
    )
  $$,
  'an eligible notification is inserted with its inbox row intact'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.notifications
       where user_id = '70000000-0000-4000-8000-000000000001'
         and dedupe_key = 'delivery:enqueue:two-device'),
      (select count(*)::integer from public.notification_deliveries as delivery
       join public.notifications as notification
         on notification.id = delivery.notification_id
       where notification.dedupe_key = 'delivery:enqueue:two-device'),
      (select count(distinct subscription_id)::integer
       from public.notification_deliveries as delivery
       join public.notifications as notification
         on notification.id = delivery.notification_id
       where notification.dedupe_key = 'delivery:enqueue:two-device'),
      (select count(*)::integer from public.notification_deliveries as delivery
       join public.notifications as notification
         on notification.id = delivery.notification_id
       where notification.dedupe_key = 'delivery:enqueue:two-device'
         and delivery.state = 'pending'),
      (select count(*)::integer from public.notification_deliveries
       where subscription_id in (
         '70000000-0000-4000-8000-000000000023',
         '70000000-0000-4000-8000-000000000024'
       ))
  $$,
  $$values (1, 2, 2, 2, 0)$$,
  'enqueue creates pending delivery per active same owner subscription and excludes disabled or tombstoned devices'
);

select lives_ok(
  $$
    select public.create_notification(
      '70000000-0000-4000-8000-000000000001',
      'chat_message', 'Ignored replacement', 'Reopened inbox body.',
      '/app/chats/two-devices', '{}'::jsonb,
      'delivery:enqueue:two-device', now() + interval '1 minute', true
    )
  $$,
  'reopening an inbox notification does not fire the insert delivery trigger again'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notification_deliveries as delivery
    join public.notifications as notification
      on notification.id = delivery.notification_id
    where notification.dedupe_key = 'delivery:enqueue:two-device'
  $$,
  $$values (2)$$,
  'notification reopen update does not duplicate device deliveries'
);

update public.notification_runtime_config set notification_core_enabled = false where id;
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Core off', 'Inbox only.', '/app', '{}'::jsonb, 'delivery:suppressed:core'
);
update public.notification_runtime_config
set notification_core_enabled = true, push_enabled = false where id;
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Push off', 'Inbox only.', '/app', '{}'::jsonb, 'delivery:suppressed:push'
);
update public.notification_runtime_config
set push_enabled = true, push_rollout_percentage = 0 where id;
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Rollout off', 'Inbox only.', '/app', '{}'::jsonb, 'delivery:suppressed:rollout'
);
update public.notification_runtime_config set push_rollout_percentage = 100 where id;
update public.notification_preferences set push_enabled = false
where user_id = '70000000-0000-4000-8000-000000000001';
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Master off', 'Inbox only.', '/app', '{}'::jsonb, 'delivery:suppressed:master'
);
update public.notification_preferences set push_enabled = true, chat_enabled = false
where user_id = '70000000-0000-4000-8000-000000000001';
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Category off', 'Inbox only.', '/app', '{}'::jsonb, 'delivery:suppressed:category'
);
update public.notification_preferences set chat_enabled = true
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_runtime_config set rewards_enabled = false where id;
select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'streak_at_risk',
  'Rewards off', 'Inbox only.', '/app/rewards', '{}'::jsonb,
  'delivery:suppressed:rewards'
);
update public.notification_runtime_config set rewards_enabled = true where id;

select results_eq(
  $$
    select
      count(*)::integer,
      coalesce(sum((select count(*) from public.notification_deliveries d
                    where d.notification_id = n.id)), 0)::integer
    from public.notifications n
    where n.user_id = '70000000-0000-4000-8000-000000000001'
      and n.dedupe_key like 'delivery:suppressed:%'
  $$,
  $$values (6, 0)$$,
  'runtime rollout master category and rewards switches suppress only deliveries while retaining inbox rows'
);

update public.notification_preferences
set timezone = 'UTC',
    quiet_hours_start = ((now() at time zone 'UTC') - interval '1 hour')::time,
    quiet_hours_end = ((now() at time zone 'UTC') + interval '1 hour')::time
where user_id = '70000000-0000-4000-8000-000000000001';

select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Quiet now', 'Defer both active devices.', '/app', '{}'::jsonb,
  'delivery:quiet:deferred'
);

select results_eq(
  $$
    select state::text, count(*)::integer, bool_and(deliver_after > now())
    from public.notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    where n.dedupe_key = 'delivery:quiet:deferred'
    group by state
  $$,
  $$values ('deferred'::text, 2, true)$$,
  'notifications created during quiet hours enqueue deferred future deliveries'
);

update public.notification_preferences
set quiet_hours_start = null, quiet_hours_end = null, daily_push_cap = 1
where user_id = '70000000-0000-4000-8000-000000000001';

update public.notification_deliveries d
set state = 'sent', sent_at = now(), deliver_after = now()
from public.notifications n
where n.id = d.notification_id
  and n.dedupe_key = 'delivery:enqueue:two-device';

select results_eq(
  $$
    select
      count(*)::integer,
      count(distinct d.notification_id)::integer,
      public.notification_push_allowed(
        '70000000-0000-4000-8000-000000000001', 'chat', now()
      )
    from public.notification_deliveries d
    where d.user_id = '70000000-0000-4000-8000-000000000001'
      and d.state = 'sent'
  $$,
  $$values (2, 1, false)$$,
  'two sent device rows consume one distinct notification cap unit'
);

update public.notification_preferences set timezone = 'America/New_York'
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_deliveries d
set sent_at = '2026-08-05 03:30:00+00'
from public.notifications n
where n.id = d.notification_id
  and n.dedupe_key = 'delivery:enqueue:two-device';

select results_eq(
  $$
    select
      public.notification_push_allowed(
        '70000000-0000-4000-8000-000000000001',
        'chat',
        '2026-08-05 03:45:00+00'
      ),
      public.notification_push_allowed(
        '70000000-0000-4000-8000-000000000001',
        'chat',
        '2026-08-05 04:15:00+00'
      )
  $$,
  $$values (false, true)$$,
  'daily cap uses the preference timezone local calendar date rather than the UTC date'
);

update public.notification_preferences set timezone = 'UTC'
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_deliveries d
set sent_at = now()
from public.notifications n
where n.id = d.notification_id
  and n.dedupe_key = 'delivery:enqueue:two-device';

update public.notification_preferences set daily_push_cap = 2
where user_id = '70000000-0000-4000-8000-000000000001';

select is(
  public.notification_push_allowed(
    '70000000-0000-4000-8000-000000000001', 'chat', now()
  ),
  true,
  'a distinct notification cap leaves capacity after one two-device notification'
);

select public.create_notification(
  '70000000-0000-4000-8000-000000000001', 'chat_message',
  'Cap after enqueue', 'This becomes ineligible before claim.', '/app',
  '{}'::jsonb, 'delivery:claim-recheck:cap'
);
update public.notification_preferences set daily_push_cap = 1
where user_id = '70000000-0000-4000-8000-000000000001';
select count(*) from public.claim_notification_deliveries(100, 120);

select results_eq(
  $$
    select
      count(*) filter (where d.state = 'skipped')::integer,
      count(distinct n.id)::integer
    from public.notifications n
    left join public.notification_deliveries d on d.notification_id = n.id
    where n.dedupe_key = 'delivery:claim-recheck:cap'
    group by n.id
  $$,
  $$values (2, 1)$$,
  'claim-time cap changes skip device deliveries without deleting the inbox notification'
);

delete from public.notification_deliveries
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_preferences set daily_push_cap = 50
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_runtime_config set push_rollout_percentage = 0 where id;

insert into public.notifications (
  id, user_id, type, category, title, body, url, dedupe_key
)
values
  ('70000000-0000-4000-8000-000000000031','70000000-0000-4000-8000-000000000001','chat_message','chat','Due pending','Due pending body.','/app','delivery:claim:pending'),
  ('70000000-0000-4000-8000-000000000032','70000000-0000-4000-8000-000000000001','chat_message','chat','Future deferred','Future deferred body.','/app','delivery:claim:future'),
  ('70000000-0000-4000-8000-000000000033','70000000-0000-4000-8000-000000000001','chat_message','chat','Live processing','Live processing body.','/app','delivery:claim:live'),
  ('70000000-0000-4000-8000-000000000034','70000000-0000-4000-8000-000000000001','chat_message','chat','Expired processing','Expired processing body.','/app','delivery:claim:expired');

update public.notification_runtime_config set push_rollout_percentage = 100 where id;
insert into public.notification_deliveries (
  id, notification_id, subscription_id, user_id, state, deliver_after,
  claimed_at, claim_token, claim_expires_at, attempts
)
values
  ('70000000-0000-4000-8000-000000000131','70000000-0000-4000-8000-000000000031','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','pending',now() - interval '10 minutes',null,null,null,0),
  ('70000000-0000-4000-8000-000000000132','70000000-0000-4000-8000-000000000032','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','deferred',now() + interval '1 hour',null,null,null,0),
  ('70000000-0000-4000-8000-000000000133','70000000-0000-4000-8000-000000000033','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000233',now() + interval '1 hour',1),
  ('70000000-0000-4000-8000-000000000134','70000000-0000-4000-8000-000000000034','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now() - interval '10 minutes','70000000-0000-4000-8000-000000000234',now() - interval '1 minute',1);

select results_eq(
  $$
    select delivery_id, attempt_count
    from public.claim_notification_deliveries(10, 120)
    order by delivery_id
  $$,
  $$
    values
      ('70000000-0000-4000-8000-000000000131'::uuid, 1),
      ('70000000-0000-4000-8000-000000000134'::uuid, 2)
  $$,
  'claim selects due pending work and expired processing leases only'
);

select results_eq(
  $$
    select
      count(*) filter (
        where id in ('70000000-0000-4000-8000-000000000131','70000000-0000-4000-8000-000000000134')
          and state = 'processing' and claimed_at is not null
          and claim_token is not null and claim_expires_at > claimed_at
      )::integer,
      count(*) filter (
        where id = '70000000-0000-4000-8000-000000000134'
          and claim_token <> '70000000-0000-4000-8000-000000000234'
          and attempts = 2
      )::integer,
      count(*) filter (
        where id = '70000000-0000-4000-8000-000000000132'
          and state = 'deferred' and attempts = 0
      )::integer,
      count(*) filter (
        where id = '70000000-0000-4000-8000-000000000133'
          and state = 'processing' and attempts = 1
      )::integer
    from public.notification_deliveries
    where id between '70000000-0000-4000-8000-000000000131'
      and '70000000-0000-4000-8000-000000000134'
  $$,
  $$values (2, 1, 1, 1)$$,
  'claim tokens timestamps attempt increments lease recovery and exclusions are exact'
);

select throws_ok(
  $$select count(*) from public.claim_notification_deliveries(0, 120)$$,
  '22023'::char(5), 'Claim limit must be between 1 and 100',
  'claim validates its limit'
);

select throws_ok(
  $$select count(*) from public.claim_notification_deliveries(1, 29)$$,
  '22023'::char(5), 'Lease seconds must be between 30 and 600',
  'claim validates its lease duration'
);

-- Each recheck fixture is enqueued while eligible and becomes ineligible only
-- after insertion. Claim must mutate it but never return it to a worker.
select public.create_notification(
  '70000000-0000-4000-8000-000000000001','chat_message','Core changed',
  'Core changed after enqueue.','/app','{}','delivery:recheck:core'
);
update public.notification_runtime_config set notification_core_enabled = false where id;
select is((select count(*) from public.claim_notification_deliveries(10,120)),0::bigint,
  'claim does not return deliveries suppressed by a runtime core change');
update public.notification_runtime_config set notification_core_enabled = true where id;

select public.create_notification(
  '70000000-0000-4000-8000-000000000001','chat_message','Category changed',
  'Category changed after enqueue.','/app','{}','delivery:recheck:category'
);
update public.notification_preferences set chat_enabled = false
where user_id = '70000000-0000-4000-8000-000000000001';
select is((select count(*) from public.claim_notification_deliveries(10,120)),0::bigint,
  'claim does not return deliveries suppressed by a category preference change');
update public.notification_preferences set chat_enabled = true
where user_id = '70000000-0000-4000-8000-000000000001';

select public.create_notification(
  '70000000-0000-4000-8000-000000000001','chat_message','Rollout changed',
  'Rollout changed after enqueue.','/app','{}','delivery:recheck:rollout'
);
update public.notification_runtime_config set push_rollout_percentage = 0 where id;
select is((select count(*) from public.claim_notification_deliveries(10,120)),0::bigint,
  'claim does not return deliveries suppressed by a rollout change');
update public.notification_runtime_config set push_rollout_percentage = 100 where id;

select public.create_notification(
  '70000000-0000-4000-8000-000000000001','chat_message','Subscription changed',
  'Subscription disabled after enqueue.','/app','{}','delivery:recheck:subscription'
);
update public.push_subscriptions set disabled_at = now()
where id in ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000022');
select is((select count(*) from public.claim_notification_deliveries(10,120)),0::bigint,
  'claim does not return deliveries for subscriptions disabled after enqueue');
update public.push_subscriptions set disabled_at = null
where id in ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000022');

select public.create_notification(
  '70000000-0000-4000-8000-000000000001','chat_message','Quiet changed',
  'Quiet hours enabled after enqueue.','/app','{}','delivery:recheck:quiet'
);
update public.notification_preferences
set quiet_hours_start = ((now() at time zone 'UTC') - interval '1 hour')::time,
    quiet_hours_end = ((now() at time zone 'UTC') + interval '1 hour')::time
where user_id = '70000000-0000-4000-8000-000000000001';
select is((select count(*) from public.claim_notification_deliveries(10,120)),0::bigint,
  'claim does not return work newly covered by quiet hours');

select results_eq(
  $$
    select count(*)::integer, bool_and(d.deliver_after > now())
    from public.notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    where n.dedupe_key = 'delivery:recheck:quiet'
      and d.state = 'deferred'
  $$,
  $$values (2, true)$$,
  'claim-time quiet hours defer work to a new future deliver_after'
);

update public.notification_preferences
set quiet_hours_start = null, quiet_hours_end = null
where user_id = '70000000-0000-4000-8000-000000000001';

delete from public.notification_deliveries
where user_id = '70000000-0000-4000-8000-000000000001';
update public.notification_runtime_config set push_rollout_percentage = 0 where id;

insert into public.notifications (
  id, user_id, type, category, title, body, url, dedupe_key
)
values
  ('70000000-0000-4000-8000-000000000061','70000000-0000-4000-8000-000000000001','chat_message','chat','Success result','Success body.','/app','delivery:result:success'),
  ('70000000-0000-4000-8000-000000000062','70000000-0000-4000-8000-000000000001','chat_message','chat','Gone 404','Gone 404 body.','/app','delivery:result:404'),
  ('70000000-0000-4000-8000-000000000063','70000000-0000-4000-8000-000000000001','chat_message','chat','Gone 410','Gone 410 body.','/app','delivery:result:410'),
  ('70000000-0000-4000-8000-000000000064','70000000-0000-4000-8000-000000000001','chat_message','chat','Network retry','Network retry body.','/app','delivery:result:network'),
  ('70000000-0000-4000-8000-000000000065','70000000-0000-4000-8000-000000000001','chat_message','chat','Rate retry','Rate retry body.','/app','delivery:result:429'),
  ('70000000-0000-4000-8000-000000000066','70000000-0000-4000-8000-000000000001','chat_message','chat','Server retry','Server retry body.','/app','delivery:result:503'),
  ('70000000-0000-4000-8000-000000000067','70000000-0000-4000-8000-000000000001','chat_message','chat','Permanent failure','Permanent failure body.','/app','delivery:result:400'),
  ('70000000-0000-4000-8000-000000000068','70000000-0000-4000-8000-000000000001','chat_message','chat','Fifth failure','Fifth failure body.','/app','delivery:result:fifth'),
  ('70000000-0000-4000-8000-000000000069','70000000-0000-4000-8000-000000000001','chat_message','chat','Stale token','Stale token body.','/app','delivery:result:stale'),
  ('70000000-0000-4000-8000-000000000070','70000000-0000-4000-8000-000000000001','chat_message','chat','Expired token','Expired token body.','/app','delivery:result:expired'),
  ('70000000-0000-4000-8000-000000000071','70000000-0000-4000-8000-000000000001','chat_message','chat','Partial devices','Partial device body.','/app','delivery:result:partial');

update public.notification_runtime_config set push_rollout_percentage = 100 where id;
update public.push_subscriptions set disabled_at = null, failure_count = 0
where id in ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000022');

insert into public.notification_deliveries (
  id, notification_id, subscription_id, user_id, state, deliver_after,
  claimed_at, claim_token, claim_expires_at, attempts
)
values
  ('70000000-0000-4000-8000-000000000161','70000000-0000-4000-8000-000000000061','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000261',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000162','70000000-0000-4000-8000-000000000062','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000262',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000163','70000000-0000-4000-8000-000000000063','70000000-0000-4000-8000-000000000022','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000263',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000164','70000000-0000-4000-8000-000000000064','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000264',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000165','70000000-0000-4000-8000-000000000065','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000265',now()+interval '10 minutes',2),
  ('70000000-0000-4000-8000-000000000166','70000000-0000-4000-8000-000000000066','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000266',now()+interval '10 minutes',3),
  ('70000000-0000-4000-8000-000000000167','70000000-0000-4000-8000-000000000067','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000267',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000168','70000000-0000-4000-8000-000000000068','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000268',now()+interval '10 minutes',5),
  ('70000000-0000-4000-8000-000000000169','70000000-0000-4000-8000-000000000069','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000269',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000170','70000000-0000-4000-8000-000000000070','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now()-interval '10 minutes','70000000-0000-4000-8000-000000000270',now()-interval '1 minute',1),
  ('70000000-0000-4000-8000-000000000171','70000000-0000-4000-8000-000000000071','70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000271',now()+interval '10 minutes',1),
  ('70000000-0000-4000-8000-000000000172','70000000-0000-4000-8000-000000000071','70000000-0000-4000-8000-000000000022','70000000-0000-4000-8000-000000000001','processing',now(),now(),'70000000-0000-4000-8000-000000000272',now()+interval '10 minutes',1);

select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000161',
    '70000000-0000-4000-8000-000000000261', 204, null
  )::text,
  'sent',
  'a successful HTTP result marks the matching current claim sent'
);

select results_eq(
  $$
    select state::text, sent_at is not null, claim_token is null,
           claimed_at is null, claim_expires_at is null
    from public.notification_deliveries
    where id = '70000000-0000-4000-8000-000000000161'
  $$,
  $$values ('sent'::text, true, true, true, true)$$,
  'sent result stores sent_at and clears all lease fields'
);

select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000162',
    '70000000-0000-4000-8000-000000000262', 404, 'push_gone'
  )::text,
  'skipped',
  'HTTP 404 skips the delivery'
);
select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000163',
    '70000000-0000-4000-8000-000000000263', 410, 'push_expired'
  )::text,
  'skipped',
  'HTTP 410 skips the delivery'
);

select results_eq(
  $$
    select count(*)::integer, bool_and(disabled_at is not null),
           bool_and(failure_count = 1)
    from public.push_subscriptions
    where id in ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000022')
  $$,
  $$values (2, true, true)$$,
  '404 and 410 disable only their subscriptions and increment failure counters'
);

select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000164',
    '70000000-0000-4000-8000-000000000264', null, 'network timeout'
  )::text,
  'deferred',
  'a network result schedules a retry below attempt five'
);
select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000165',
    '70000000-0000-4000-8000-000000000265', 429, 'rate-limited'
  )::text,
  'deferred',
  'HTTP 429 schedules a retry below attempt five'
);
select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000166',
    '70000000-0000-4000-8000-000000000266', 503, ' bad code ! '
  )::text,
  'deferred',
  'HTTP 5xx schedules a retry below attempt five'
);

select results_eq(
  $$
    select count(*)::integer, bool_and(deliver_after > now()),
           bool_and(deliver_after <= now() + interval '1 hour'),
           max(last_error_code) filter (
             where id = '70000000-0000-4000-8000-000000000166'
           )
    from public.notification_deliveries
    where id in (
      '70000000-0000-4000-8000-000000000164',
      '70000000-0000-4000-8000-000000000165',
      '70000000-0000-4000-8000-000000000166'
    ) and state = 'deferred'
  $$,
  $$values (3, true, true, 'badcode'::text)$$,
  'network rate and server retries use bounded backoff and sanitized error codes'
);

select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000167',
    '70000000-0000-4000-8000-000000000267', 400, 'bad_request'
  )::text,
  'failed',
  'a permanent HTTP 4xx marks the delivery failed'
);
select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000168',
    '70000000-0000-4000-8000-000000000268', 503, 'still_down'
  )::text,
  'failed',
  'a transient result on attempt five becomes terminal failed'
);

select throws_ok(
  $$
    select public.record_notification_delivery_result(
      '70000000-0000-4000-8000-000000000169',
      '70000000-0000-4000-8000-000000000999', 200, null
    )
  $$,
  '40001'::char(5),
  'Stale or expired notification delivery claim',
  'a stale claim token cannot overwrite the current claim'
);
select throws_ok(
  $$
    select public.record_notification_delivery_result(
      '70000000-0000-4000-8000-000000000170',
      '70000000-0000-4000-8000-000000000270', 200, null
    )
  $$,
  '40001'::char(5),
  'Stale or expired notification delivery claim',
  'an expired matching token cannot record a result'
);

update public.notification_deliveries
set state = 'failed',
    claimed_at = null,
    claim_token = null,
    claim_expires_at = null
where id = '70000000-0000-4000-8000-000000000170';

select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000171',
    '70000000-0000-4000-8000-000000000271', 201, null
  )::text,
  'sent',
  'the successful device in a multi-device notification is sent'
);
select is(
  public.record_notification_delivery_result(
    '70000000-0000-4000-8000-000000000172',
    '70000000-0000-4000-8000-000000000272', 503, 'temporary'
  )::text,
  'deferred',
  'the transient device in a multi-device notification remains retryable'
);

select results_eq(
  $$
    select state::text, count(*)::integer
    from public.notification_deliveries
    where notification_id = '70000000-0000-4000-8000-000000000071'
    group by state order by state
  $$,
  $$values ('deferred'::text, 1), ('sent'::text, 1)$$,
  'multi-device partial outcomes remain independent rows'
);

update public.push_subscriptions set disabled_at = null
where id in ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000022');
update public.notification_deliveries set deliver_after = now() - interval '1 second'
where id = '70000000-0000-4000-8000-000000000172';

select results_eq(
  $$select delivery_id from public.claim_notification_deliveries(10, 120)$$,
  $$values ('70000000-0000-4000-8000-000000000172'::uuid)$$,
  'retry claims only the transient device and never reclaims its sent sibling'
);

select throws_ok(
  $$
    select public.record_notification_delivery_result(
      '70000000-0000-4000-8000-000000000172',
      '70000000-0000-4000-8000-000000000272', 200, null
    )
  $$,
  '40001'::char(5),
  'Stale or expired notification delivery claim',
  'an old token cannot overwrite a reclaimed delivery'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '72000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'cleanup-fixture@umd.edu', '', now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Cleanup Fixture"}'::jsonb,
  now(), now()
);

update public.notification_runtime_config set push_rollout_percentage = 0 where id;
insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, disabled_at
)
values
  ('72000000-0000-4000-8000-000000000021','72000000-0000-4000-8000-000000000001','https://push.example.test/cleanup/removable','cleanup-key-1','cleanup-auth-1','2026-05-01 00:00:00+00'),
  ('72000000-0000-4000-8000-000000000022','72000000-0000-4000-8000-000000000001','https://push.example.test/cleanup/nonterminal','cleanup-key-2','cleanup-auth-2','2026-05-01 00:00:00+00'),
  ('72000000-0000-4000-8000-000000000023','72000000-0000-4000-8000-000000000001','https://push.example.test/cleanup/recent-audit','cleanup-key-3','cleanup-auth-3','2026-05-01 00:00:00+00');

insert into public.notifications (
  id, user_id, type, category, title, body, url, dedupe_key,
  read_at, created_at, last_event_at
)
values
  ('72000000-0000-4000-8000-000000000031','72000000-0000-4000-8000-000000000001','chat_message','chat','Old read removable','Old read removable body.','/app','delivery:cleanup:removable','2026-06-01','2026-06-01','2026-06-01'),
  ('72000000-0000-4000-8000-000000000032','72000000-0000-4000-8000-000000000001','chat_message','chat','Old unread retained','Old unread retained body.','/app','delivery:cleanup:unread',null,'2026-06-01','2026-06-01'),
  ('72000000-0000-4000-8000-000000000033','72000000-0000-4000-8000-000000000001','chat_message','chat','Old pending retained','Old pending retained body.','/app','delivery:cleanup:pending','2026-06-01','2026-06-01','2026-06-01'),
  ('72000000-0000-4000-8000-000000000034','72000000-0000-4000-8000-000000000001','chat_message','chat','Recent audit retained','Recent audit retained body.','/app','delivery:cleanup:recent-audit','2026-06-01','2026-06-01','2026-06-01');

insert into public.notification_deliveries (
  id, notification_id, subscription_id, user_id, state, deliver_after,
  sent_at, updated_at
)
values
  ('72000000-0000-4000-8000-000000000131','72000000-0000-4000-8000-000000000031','72000000-0000-4000-8000-000000000021','72000000-0000-4000-8000-000000000001','sent','2026-06-01','2026-06-01','2026-06-01'),
  ('72000000-0000-4000-8000-000000000133','72000000-0000-4000-8000-000000000033','72000000-0000-4000-8000-000000000022','72000000-0000-4000-8000-000000000001','pending','2026-06-01',null,'2026-06-01'),
  ('72000000-0000-4000-8000-000000000134','72000000-0000-4000-8000-000000000034','72000000-0000-4000-8000-000000000023','72000000-0000-4000-8000-000000000001','sent','2026-08-01','2026-08-01','2026-08-01');

select is(
  public.cleanup_notification_data('2026-08-04 12:00:00+00'),
  '{"notifications_deleted":1,"deliveries_deleted":1,"subscriptions_deleted":1}'::jsonb,
  'cleanup returns exact deletion counts in dependency-safe order'
);

select results_eq(
  $$
    select
      count(*) filter (where n.id = '72000000-0000-4000-8000-000000000032')::integer,
      count(*) filter (where n.id = '72000000-0000-4000-8000-000000000033')::integer,
      count(*) filter (where n.id = '72000000-0000-4000-8000-000000000034')::integer,
      (select count(*)::integer from public.notification_deliveries
       where id in ('72000000-0000-4000-8000-000000000133','72000000-0000-4000-8000-000000000134')),
      (select count(*)::integer from public.push_subscriptions
       where id in ('72000000-0000-4000-8000-000000000022','72000000-0000-4000-8000-000000000023'))
    from public.notifications n
    where n.user_id = '72000000-0000-4000-8000-000000000001'
  $$,
  $$values (1, 1, 1, 2, 2)$$,
  'cleanup retains unread inbox nonterminal work recent audit and their disabled subscriptions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.notification_operations_summary()$$,
  '42501'::char(5),
  'Not authorized',
  'ordinary authenticated users cannot read notification operations aggregates'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","app_metadata":{"role":"safety_owner"}}',
  true
);
set local role authenticated;

select results_eq(
  $$select key from jsonb_object_keys(public.notification_operations_summary()) as key order by key$$,
  $$
    values
      ('active_subscriptions'::text),
      ('disabled_subscriptions'::text),
      ('due_deliveries'::text),
      ('failed_deliveries'::text),
      ('opted_in_users'::text),
      ('pending_deliveries'::text),
      ('processing_deliveries'::text),
      ('recent_errors'::text),
      ('retry_deliveries'::text),
      ('sent_deliveries'::text)
  $$,
  'operations summary exposes every required aggregate and no extra raw records'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.notification_operations_summary() -> 'recent_errors'
    ) as error_item
    where error_item ->> 'category' = 'chat'
      and error_item ->> 'code' = 'badcode'
      and (error_item ->> 'count')::integer >= 1
  ),
  'operations summary groups recent errors by notification category and sanitized code'
);

select ok(
  public.notification_operations_summary()::text
    !~ '"(body|endpoint|p256dh|auth|user_id|notification_id|data)"',
  'operations summary contains no message subscription secret notification data or raw identifier fields'
);

reset role;

select results_eq(
  $$
    with summary as (
      select public.notification_operations_summary() as value
    )
    select
      (value ->> 'opted_in_users')::bigint
        = (select count(*) from public.notification_preferences where push_enabled),
      (value ->> 'active_subscriptions')::bigint
        = (select count(*) from public.push_subscriptions where disabled_at is null),
      (value ->> 'disabled_subscriptions')::bigint
        = (select count(*) from public.push_subscriptions where disabled_at is not null),
      (value ->> 'pending_deliveries')::bigint
        = (select count(*) from public.notification_deliveries where state = 'pending'),
      (value ->> 'due_deliveries')::bigint
        = (select count(*) from public.notification_deliveries
           where state in ('pending','deferred') and deliver_after <= now()),
      (value ->> 'processing_deliveries')::bigint
        = (select count(*) from public.notification_deliveries where state = 'processing'),
      (value ->> 'sent_deliveries')::bigint
        = (select count(*) from public.notification_deliveries where state = 'sent'),
      (value ->> 'failed_deliveries')::bigint
        = (select count(*) from public.notification_deliveries where state = 'failed'),
      (value ->> 'retry_deliveries')::bigint
        = (select count(*) from public.notification_deliveries where state = 'deferred')
    from summary
  $$,
  $$values (true, true, true, true, true, true, true, true, true)$$,
  'operations summary counts match the underlying privacy-safe aggregates'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_rollout_eligible',
        'notification_deliver_after',
        'notification_push_allowed',
        'enqueue_notification_deliveries',
        'claim_notification_deliveries',
        'record_notification_delivery_result',
        'notification_operations_summary',
        'cleanup_notification_data'
      )
      and (
        not proc.prosecdef
        or not coalesce(proc.proconfig, '{}'::text[]) @> array['search_path=""']
      )
  $$,
  $$values (0)$$,
  'every delivery helper is SECURITY DEFINER with a fixed empty search_path'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_rollout_eligible',
        'notification_deliver_after',
        'notification_push_allowed',
        'enqueue_notification_deliveries',
        'claim_notification_deliveries',
        'record_notification_delivery_result',
        'cleanup_notification_data'
      )
      and (
        pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute')
        or pg_catalog.has_function_privilege('anon', proc.oid, 'execute')
      )
  $$,
  $$values (0)$$,
  'trusted delivery helpers and trigger functions are never client executable'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.notification_operations_summary()'::regprocedure, 'execute'
  ),
  'authenticated may invoke the self-authorizing operations summary'
);

select is(
  pg_catalog.has_function_privilege(
    'anon', 'public.notification_operations_summary()'::regprocedure, 'execute'
  ),
  false,
  'anon cannot invoke the operations summary'
);

select results_eq(
  $$
    select
      pg_catalog.has_function_privilege(
        'service_role', 'public.claim_notification_deliveries(integer,integer)'::regprocedure, 'execute'
      ),
      pg_catalog.has_function_privilege(
        'service_role', 'public.record_notification_delivery_result(uuid,uuid,integer,text)'::regprocedure, 'execute'
      ),
      pg_catalog.has_function_privilege(
        'service_role', 'public.cleanup_notification_data(timestamp with time zone)'::regprocedure, 'execute'
      )
  $$,
  $$values (true, true, true)$$,
  'claim result and cleanup execution is granted to service_role'
);

select results_eq(
  $$
    select array_agg(attribute.attname order by attribute.attnum)
    from pg_catalog.pg_type as type
    join pg_catalog.pg_class as relation on relation.oid = type.typrelid
    join pg_catalog.pg_attribute as attribute on attribute.attrelid = relation.oid
    where type.typnamespace = 'public'::regnamespace
      and type.typname = 'notification_delivery_claim'
      and attribute.attnum > 0 and not attribute.attisdropped
  $$,
  $$
    values (array[
      'delivery_id','claim_token','notification_id','user_id','subscription_id',
      'endpoint','p256dh','auth','title','body','url','type','category',
      'unread_badge_count','attempt_count'
    ]::name[])
  $$,
  'delivery claim type contains only the worker contract and excludes arbitrary notification data'
);

select results_eq(
  $$
    select
      (select count(*)::integer from pg_catalog.pg_type
       where typnamespace = 'public'::regnamespace
         and typname = 'notification_delivery_claim'),
      (select count(*)::integer from pg_catalog.pg_trigger
       where tgrelid = 'public.notifications'::regclass
         and tgname = 'enqueue_notification_deliveries_after_insert'
         and not tgisinternal)
  $$,
  $$values (1, 1)$$,
  'delivery type and enqueue trigger remain singular under migration replay'
);

select has_extension('pg_net', 'pg_net is enabled for asynchronous Edge dispatch');
select has_extension('pg_cron', 'pg_cron is enabled for recovery and cleanup jobs');
select has_extension('supabase_vault', 'Supabase Vault is enabled for dispatch configuration');

select function_returns(
  'public',
  'request_push_dispatch',
  array[]::text[],
  'jsonb',
  'request_push_dispatch returns an operational status without blocking inbox writes'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_trigger
    where tgrelid = 'public.notification_deliveries'::regclass
      and tgname = 'dispatch_notification_deliveries_after_insert'
      and not tgisinternal
      and pg_catalog.pg_get_triggerdef(oid) like '%FOR EACH STATEMENT%'
      and pg_catalog.pg_get_triggerdef(oid) like '%REFERENCING NEW TABLE AS inserted_deliveries%'
  $$,
  $$values (1)$$,
  'delivery inserts request one asynchronous dispatch per insert statement'
);

select results_eq(
  $$
    select jobname, count(*)::integer
    from cron.job
    where jobname in (
      'huddle-notification-delivery-retry',
      'huddle-notification-cleanup'
    )
    group by jobname
    order by jobname
  $$,
  $$
    values
      ('huddle-notification-cleanup'::text, 1),
      ('huddle-notification-delivery-retry'::text, 1)
  $$,
  'exactly one retry job and one cleanup job are installed'
);

select results_eq(
  $$select public.request_push_dispatch() ->> 'status'$$,
  $$values ('not_configured'::text)$$,
  'missing Vault values make push dispatch a non-fatal no-op'
);

select results_eq(
  $$
    select
      pg_catalog.has_function_privilege(
        'anon', 'public.request_push_dispatch()'::regprocedure, 'execute'
      ),
      pg_catalog.has_function_privilege(
        'authenticated', 'public.request_push_dispatch()'::regprocedure, 'execute'
      ),
      pg_catalog.has_function_privilege(
        'service_role', 'public.request_push_dispatch()'::regprocedure, 'execute'
      )
  $$,
  $$values (false, false, true)$$,
  'only service-role infrastructure may invoke dispatch directly'
);

select * from finish();
rollback;
