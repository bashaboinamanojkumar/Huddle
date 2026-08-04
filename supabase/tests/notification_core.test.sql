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
      'America/New_York'::text,
      10
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
  $$values (true, 'America/New_York'::text, 10)$$,
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

select * from finish();
rollback;
