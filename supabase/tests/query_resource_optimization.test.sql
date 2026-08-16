begin;
select plan(22);

-- 1
select has_index(
  'public', 'activities', 'activities_university_approved_start_idx',
  'core campus activity query has one supporting partial index'
);

-- 2
select has_index(
  'public', 'safety_reports', 'safety_reports_open_created_idx',
  'open moderation reports have one supporting partial index'
);

-- 3
select results_eq(
  $$
    select indexname, count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'activities_university_approved_start_idx',
        'safety_reports_open_created_idx'
      )
    group by indexname order by indexname
  $$,
  $$values
    ('activities_university_approved_start_idx'::name, 1),
    ('safety_reports_open_created_idx'::name, 1)$$,
  'optimization indexes are singular under migration replay'
);

-- 4
select results_eq(
  $$select jobname, schedule, command from cron.job
    where jobname in (
      'huddle-notification-delivery-retry', 'huddle-notification-cleanup',
      'huddle-event-reminders', 'huddle-pulse-prompts',
      'huddle-activity-match-digests', 'huddle-weekly-recaps'
    ) order by jobname$$,
  $$values
    ('huddle-activity-match-digests'::text, '0 * * * *'::text, 'select public.produce_activity_match_digests();'::text),
    ('huddle-event-reminders'::text, '*/5 * * * *'::text, 'select public.produce_event_reminders();'::text),
    ('huddle-notification-cleanup'::text, '20 8 * * *'::text, 'select public.cleanup_notification_data();'::text),
    ('huddle-notification-delivery-retry'::text, '* * * * *'::text, 'select public.request_push_dispatch();'::text),
    ('huddle-pulse-prompts'::text, '*/15 * * * *'::text, 'select public.produce_pulse_prompts();'::text),
    ('huddle-weekly-recaps'::text, '0 * * * *'::text, 'select public.produce_weekly_recaps();'::text)$$,
  'all required schedules and cadences are unchanged'
);

-- 5
select has_function(
  'public', 'notification_producers_enabled', array[]::text[],
  'scheduled producers have a shared runtime gate'
);

-- 6
select matches(
  pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
  'no_work',
  'push recovery has an explicit no-work exit'
);

create temporary table dispatch_observations (
  scenario text primary key,
  status text not null,
  http_delta bigint not null
) on commit drop;

update public.notification_runtime_config
set notification_core_enabled = false,
    push_enabled = true,
    push_rollout_percentage = 100
where id;

do $$
declare
  before_count bigint;
  response jsonb;
begin
  select count(*) into before_count from net.http_request_queue;
  response := public.request_push_dispatch();
  insert into dispatch_observations (scenario, status, http_delta)
  values (
    'disabled',
    response ->> 'status',
    (select count(*) from net.http_request_queue) - before_count
  );
end;
$$;

-- 7
select results_eq(
  $$select status, http_delta from dispatch_observations where scenario = 'disabled'$$,
  $$values ('disabled'::text, 0::bigint)$$,
  'disabled push exits before creating an HTTP request'
);

select vault.create_secret(
  'https://local.example/functions/v1/send-push',
  'huddle_send_push_url'
);
select vault.create_secret(
  'local-dispatch-secret',
  'huddle_notification_dispatch_secret'
);

update public.notification_runtime_config
set notification_core_enabled = true,
    push_enabled = true,
    push_rollout_percentage = 100
where id;

do $$
declare
  before_count bigint;
  response jsonb;
begin
  select count(*) into before_count from net.http_request_queue;
  response := public.request_push_dispatch();
  insert into dispatch_observations (scenario, status, http_delta)
  values (
    'no-work',
    response ->> 'status',
    (select count(*) from net.http_request_queue) - before_count
  );
end;
$$;

-- 8
select results_eq(
  $$select status, http_delta from dispatch_observations where scenario = 'no-work'$$,
  $$values ('no_work'::text, 0::bigint)$$,
  'enabled push with no due delivery exits before creating an HTTP request'
);

update public.notification_runtime_config
set notification_core_enabled = false
where id;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '81000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'resource-guard@umd.edu', '', now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Resource Guard"}'::jsonb,
  now(), now()
);

insert into public.notifications (
  id, user_id, type, category, title, body, url, dedupe_key
)
values (
  '81000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001',
  'chat_message', 'chat', 'Due delivery', 'Ready to dispatch.',
  '/app', 'resource-guard:due'
);

insert into public.push_subscriptions (
  id, user_id, endpoint, p256dh, auth, user_agent
)
values (
  '81000000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000001',
  'https://push.example.test/resource-guard',
  'resource-guard-p256dh', 'resource-guard-auth', 'pgTAP resource guard'
);

insert into public.notification_deliveries (
  id, notification_id, subscription_id, user_id, state, deliver_after
)
values (
  '81000000-0000-4000-8000-000000000004',
  '81000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000001',
  'pending', now() - interval '1 minute'
);

update public.notification_runtime_config
set notification_core_enabled = true
where id;

do $$
declare
  before_count bigint;
  response jsonb;
begin
  select count(*) into before_count from net.http_request_queue;
  response := public.request_push_dispatch();
  insert into dispatch_observations (scenario, status, http_delta)
  values (
    'due-work',
    response ->> 'status',
    (select count(*) from net.http_request_queue) - before_count
  );
end;
$$;

-- 9
select results_eq(
  $$select status, http_delta from dispatch_observations where scenario = 'due-work'$$,
  $$values ('queued'::text, 1::bigint)$$,
  'one due delivery queues exactly one HTTP request'
);

update public.notification_runtime_config
set notification_core_enabled = false
where id;

-- 10
select results_eq(
  $$
    select producer, scanned, created, deduped, failed, skipped
    from (
      select 'activity-match'::text as producer,
        (public.produce_activity_match_digests('2026-08-04 21:00:00+00')).*
      union all
      select 'event-reminder'::text,
        (public.produce_event_reminders('2026-08-04 12:00:00+00')).*
      union all
      select 'pulse-prompt'::text,
        (public.produce_pulse_prompts('2026-08-04 12:05:00+00')).*
      union all
      select 'weekly-recap'::text,
        (public.produce_weekly_recaps('2026-08-03 13:00:00+00')).*
    ) disabled_producers
    order by producer
  $$,
  $$values
    ('activity-match'::text, 0, 0, 0, 0, 1),
    ('event-reminder'::text, 0, 0, 0, 0, 1),
    ('pulse-prompt'::text, 0, 0, 0, 0, 1),
    ('weekly-recap'::text, 0, 0, 0, 0, 1)$$,
  'disabled scheduled producers exit without scanning'
);

-- 11
select results_eq(
  $$
    select function_name, has_guard, has_unique_lock
    from (values
      ('produce_activity_match_digests', 'huddle:producer:activity-match-digests'),
      ('produce_event_reminders', 'huddle:producer:event-reminders'),
      ('produce_pulse_prompts', 'huddle:producer:pulse-prompts'),
      ('produce_weekly_recaps', 'huddle:producer:weekly-recaps')
    ) expected(function_name, lock_name)
    cross join lateral (
      select
        pg_get_functiondef(('public.' || function_name || '(timestamptz)')::regprocedure)
          like '%pg_try_advisory_xact_lock%' as has_guard,
        pg_get_functiondef(('public.' || function_name || '(timestamptz)')::regprocedure)
          like '%' || lock_name || '%' as has_unique_lock
    ) definition
    order by function_name
  $$,
  $$values
    ('produce_activity_match_digests'::text, true, true),
    ('produce_event_reminders'::text, true, true),
    ('produce_pulse_prompts'::text, true, true),
    ('produce_weekly_recaps'::text, true, true)$$,
  'every producer has a non-overlap guard and a distinct lock key'
);

-- 12
select ok(
  strpos(
    pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
    'notification_runtime_config'
  ) < strpos(
    pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
    'vault.decrypted_secrets'
  )
  and strpos(
    pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
    'notification_deliveries'
  ) < strpos(
    pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
    'vault.decrypted_secrets'
  ),
  'dispatch runtime and no-work guards run before Vault access'
);

-- 13
select results_eq(
  $$
    select function_name,
      strpos(definition, 'notification_producers_enabled') < strpos(definition, first_scan)
    from (values
      ('produce_activity_match_digests', 'from public.profiles'),
      ('produce_event_reminders', 'from public.activities'),
      ('produce_pulse_prompts', 'from public.activities'),
      ('produce_weekly_recaps', 'from public.profiles')
    ) expected(function_name, first_scan)
    cross join lateral (
      select pg_get_functiondef(
        ('public.' || function_name || '(timestamptz)')::regprocedure
      ) as definition
    ) source
    order by function_name
  $$,
  $$values
    ('produce_activity_match_digests'::text, true),
    ('produce_event_reminders'::text, true),
    ('produce_pulse_prompts'::text, true),
    ('produce_weekly_recaps'::text, true)$$,
  'producer runtime gates run before source-table scans'
);

-- 14
select is(
  (
    select count(*)::integer
    from (values
      ('public.notification_producers_enabled()'),
      ('public.request_push_dispatch()'),
      ('public.produce_activity_match_digests(timestamptz)'),
      ('public.produce_event_reminders(timestamptz)'),
      ('public.produce_pulse_prompts(timestamptz)'),
      ('public.produce_weekly_recaps(timestamptz)')
    ) functions(signature)
    where pg_catalog.has_function_privilege(
        'anon', signature::regprocedure, 'execute'
      )
      or pg_catalog.has_function_privilege(
        'authenticated', signature::regprocedure, 'execute'
      )
      or not pg_catalog.has_function_privilege(
        'service_role', signature::regprocedure, 'execute'
      )
  ),
  0,
  'optimized functions retain service-only execute grants'
);

-- 15
select is(
  (
    select count(*)::integer
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_producers_enabled',
        'request_push_dispatch',
        'produce_activity_match_digests',
        'produce_event_reminders',
        'produce_pulse_prompts',
        'produce_weekly_recaps'
      )
      and proc.prosecdef
      and proc.proconfig @> array['search_path=""']
  ),
  6,
  'optimized functions remain security definer with an empty search path'
);

-- 16
select results_eq(
  $$
    select count(*)::integer, count(*) filter (where class.relrowsecurity)::integer
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind = 'r'
      and class.relname in (
        'activities', 'friend_connections', 'locations', 'messages',
        'notification_deliveries', 'notification_preferences',
        'notification_runtime_config', 'notifications', 'profiles', 'pulses',
        'push_subscriptions', 'rsvps', 'safety_flags', 'safety_keywords',
        'safety_reports', 'student_details'
      )
  $$,
  $$values (16, 16)$$,
  'RLS remains enabled on every application and notification table'
);

-- 17
select results_eq(
  $$
    select proname, count(*)::integer
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'notification_producers_enabled',
        'request_push_dispatch',
        'produce_activity_match_digests',
        'produce_event_reminders',
        'produce_pulse_prompts',
        'produce_weekly_recaps'
      )
    group by proname
    order by proname
  $$,
  $$values
    ('notification_producers_enabled'::name, 1),
    ('produce_activity_match_digests'::name, 1),
    ('produce_event_reminders'::name, 1),
    ('produce_pulse_prompts'::name, 1),
    ('produce_weekly_recaps'::name, 1),
    ('request_push_dispatch'::name, 1)$$,
  'optimized function signatures are singular under migration replay'
);

-- 18
select results_eq(
  $$
    select indexname,
      case indexname
        when 'activities_university_approved_start_idx' then
          indexdef like '%(university_id, start_time, id)%'
          and indexdef like '%WHERE (status = ''approved''%'
        when 'safety_reports_open_created_idx' then
          indexdef like '%(created_at DESC, id DESC)%'
          and indexdef like '%WHERE (status = ''open''%'
      end as matches_contract
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'activities_university_approved_start_idx',
        'safety_reports_open_created_idx'
      )
    order by indexname
  $$,
  $$values
    ('activities_university_approved_start_idx'::name, true),
    ('safety_reports_open_created_idx'::name, true)$$,
  'optimization indexes match the final filter and ordering predicates'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '89000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'friend-delete-sender@umd.edu', '', now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Friend Delete Sender"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '89000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'friend-delete-recipient@umd.edu', '', now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Friend Delete Recipient"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '89000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'friend-delete-outsider@umd.edu', '', now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Friend Delete Outsider"}'::jsonb,
    now(), now()
  );

insert into public.friend_connections (id, user_id, friend_id, status)
values
  (
    '89000000-0000-4000-8000-000000000004',
    '89000000-0000-4000-8000-000000000001',
    '89000000-0000-4000-8000-000000000002',
    'accepted'
  ),
  (
    '89000000-0000-4000-8000-000000000005',
    '89000000-0000-4000-8000-000000000002',
    '89000000-0000-4000-8000-000000000001',
    'pending'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-4000-8000-000000000002","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

-- 19
select lives_ok(
  $$delete from public.friend_connections
    where id = '89000000-0000-4000-8000-000000000004'$$,
  'either participant can delete an existing friendship'
);

reset role;

-- 20
select results_eq(
  $$select count(*)::integer from public.friend_connections
    where id = '89000000-0000-4000-8000-000000000004'$$,
  $$values (0)$$,
  'participant deletion removes the friendship'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-4000-8000-000000000003","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

-- 21
select lives_ok(
  $$delete from public.friend_connections
    where id = '89000000-0000-4000-8000-000000000005'$$,
  'an unrelated authenticated user receives an RLS-filtered delete result'
);

reset role;

-- 22
select results_eq(
  $$select count(*)::integer from public.friend_connections
    where id = '89000000-0000-4000-8000-000000000005'$$,
  $$values (1)$$,
  'RLS prevents an unrelated user from deleting a connection'
);

select * from finish();
rollback;
