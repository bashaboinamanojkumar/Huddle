begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path = public, extensions, auth;

select no_plan();

-- Stable identities keep producer dedupe keys and assertions readable.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  '2026-08-04 12:00:00+00'::timestamptz,
  fixture.app_metadata,
  jsonb_build_object('full_name', fixture.full_name),
  '2026-08-04 12:00:00+00'::timestamptz,
  '2026-08-04 12:00:00+00'::timestamptz
from (values
  ('81000000-0000-4000-8000-000000000001'::uuid, 'host@umd.edu', 'Harper Host', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000002'::uuid, 'sender@umd.edu', 'Sam Sender', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000003'::uuid, 'attendee@umd.edu', 'Avery Attendee', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000004'::uuid, 'waitlist@umd.edu', 'Wren Waitlist', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000005'::uuid, 'friend@umd.edu', 'Frankie Friend', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000006'::uuid, 'owner@umd.edu', 'Safety Owner', '{"role":"safety_owner"}'::jsonb),
  ('81000000-0000-4000-8000-000000000007'::uuid, 'reporter@umd.edu', 'Riley Reporter', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000008'::uuid, 'outsider@umaryland.edu', 'Olive Outsider', '{}'::jsonb)
) as fixture(id, email, full_name, app_metadata);

update public.profiles
set university_id = case
      when id = '81000000-0000-4000-8000-000000000008' then 'umb'
      else 'umd'
    end,
    interests = array['coffee']::public.category[],
    availability_blocks = array['weekday_afternoon']::public.availability_block[]
where id::text like '81000000-%';

insert into public.locations (id, university_id, name, area, safety_note, created_at)
values (
  'notification-producer-fixture', 'umd', 'Producer Fixture', 'Campus',
  'Meet in a public place.', '2026-08-04 12:00:00+00'
);

insert into public.activities (
  id, title, category, location_id, host_id, capacity, start_time,
  availability_block, source, status, university_id, created_at, updated_at
)
values
  (
    '82000000-0000-4000-8000-000000000001', 'Coffee Chat', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    6, '2026-08-06 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umd', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  ),
  (
    '82000000-0000-4000-8000-000000000002', 'Second Seat', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    4, current_timestamp + interval '3 days', 'weekday_afternoon', 'seeded', 'approved',
    'umd', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  ),
  (
    '82000000-0000-4000-8000-000000000003', 'Waitlist Proof', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    2, '2026-08-08 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umd', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  ),
  (
    '82000000-0000-4000-8000-000000000004', 'Pending Review', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    5, '2026-08-09 17:00:00+00', 'weekday_afternoon', 'user', 'pending',
    'umd', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  );

insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at, last_seen_at)
values
  (
    '83000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004',
    'https://push.example.test/producer/waitlist/a', 'key-a', 'auth-a',
    '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000004',
    'https://push.example.test/producer/waitlist/b', 'key-b', 'auth-b',
    '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'
  );

insert into public.rsvps (activity_id, user_id, status, created_at, updated_at)
values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','going','2026-08-04 12:00:00+00','2026-08-04 12:00:00+00'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','going','2026-08-04 12:00:01+00','2026-08-04 12:00:01+00'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','going','2026-08-04 12:00:00+00','2026-08-04 12:00:00+00'),
  ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000002','going','2026-08-04 12:00:00+00','2026-08-04 12:00:00+00'),
  ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','going','2026-08-04 12:00:01+00','2026-08-04 12:00:01+00'),
  ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000004','waitlisted','2026-08-04 12:00:02+00','2026-08-04 12:00:02+00');

insert into public.friend_connections (id, user_id, friend_id, status, created_at)
values (
  '84000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000005',
  '81000000-0000-4000-8000-000000000003',
  'accepted',
  '2026-08-04 12:00:00+00'
);

-- Chat recipients are going attendees other than the author. A five-minute key reopens.
insert into public.messages (id, activity_id, user_id, body, created_at)
values (
  '85000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '  First    message  ',
  '2026-08-04 12:01:00+00'
);

update public.notifications
set read_at = '2026-08-04 12:02:00+00', seen_at = '2026-08-04 12:02:00+00'
where user_id = '81000000-0000-4000-8000-000000000003'
  and type = 'chat_message';

insert into public.messages (id, activity_id, user_id, body, created_at)
values
  (
    '85000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'Second message',
    '2026-08-04 12:04:00+00'
  ),
  (
    '85000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'Different bucket',
    '2026-08-04 12:06:00+00'
  );

select results_eq(
  $$
    select user_id, count(*)::integer
    from public.notifications
    where type = 'chat_message'
    group by user_id
    order by user_id
  $$,
  $$values ('81000000-0000-4000-8000-000000000003'::uuid, 2)$$,
  'chat messages target only other going attendees and split across five-minute buckets'
);

select results_eq(
  $$
    select data ->> 'messageId', (data ->> 'count')::integer, body,
           last_event_at, read_at is null, seen_at is null
    from public.notifications
    where user_id = '81000000-0000-4000-8000-000000000003'
      and dedupe_key = 'chat:82000000-0000-4000-8000-000000000001:202608041200'
  $$,
  $$
    values (
      '85000000-0000-4000-8000-000000000002'::text,
      2,
      'Sam: Second message'::text,
      '2026-08-04 12:04:00+00'::timestamptz,
      true,
      true
    )
  $$,
  'chat coalescing keeps the newest preview, increments count, advances time, and reopens'
);

-- Exactly the second RSVP opens chat and fans out transactional notifications.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;
select is(
  public.rsvp_activity('82000000-0000-4000-8000-000000000002')::text,
  'going',
  'second attendee RSVP succeeds'
);
reset role;

select results_eq(
  $$select count(*)::integer from public.messages where activity_id = '82000000-0000-4000-8000-000000000002' and is_system$$,
  $$values (1)$$,
  'the exact second going attendee creates one system opener'
);

select results_eq(
  $$
    select user_id from public.notifications
    where type = 'chat_opened'
      and dedupe_key = 'chat-opened:82000000-0000-4000-8000-000000000002'
    order by user_id
  $$,
  $$
    values
      ('81000000-0000-4000-8000-000000000002'::uuid),
      ('81000000-0000-4000-8000-000000000003'::uuid)
  $$,
  'chat opening notifies every current attendee once'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notifications
    where user_id = '81000000-0000-4000-8000-000000000001'
      and type = 'activity_joined'
  $$,
  $$values (1)$$,
  'a non-host RSVP notifies the host'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notifications
    where user_id = '81000000-0000-4000-8000-000000000005'
      and type = 'friend_rsvp'
      and data ->> 'activityId' = '82000000-0000-4000-8000-000000000002'
  $$,
  $$values (1)$$,
  'an accepted same-university friend receives the approved future RSVP update'
);

-- Leaving a full activity promotes the oldest waiter in the same transaction.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.leave_activity('82000000-0000-4000-8000-000000000003')$$,
  'leaving a full activity succeeds'
);
reset role;

select results_eq(
  $$
    select user_id, status::text
    from public.rsvps
    where activity_id = '82000000-0000-4000-8000-000000000003'
      and user_id in (
        '81000000-0000-4000-8000-000000000003',
        '81000000-0000-4000-8000-000000000004'
      )
    order by user_id
  $$,
  $$
    values
      ('81000000-0000-4000-8000-000000000003'::uuid, 'left'::text),
      ('81000000-0000-4000-8000-000000000004'::uuid, 'going'::text)
  $$,
  'leave_activity atomically moves the oldest waiter into the available seat'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notifications n
    where n.user_id = '81000000-0000-4000-8000-000000000004'
      and n.dedupe_key = 'waitlist-promoted:82000000-0000-4000-8000-000000000003:81000000-0000-4000-8000-000000000004'
  $$,
  $$values (1)$$,
  'waitlist promotion creates one durable inbox row'
);

-- Review is transition-based: repeated review calls do not produce a second row.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000006","app_metadata":{"role":"safety_owner"}}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.review_activity('82000000-0000-4000-8000-000000000004', 'approved')$$,
  'a safety owner can approve a pending activity'
);
select lives_ok(
  $$select public.review_activity('82000000-0000-4000-8000-000000000004', 'approved')$$,
  'replaying the same review remains idempotent'
);
reset role;

select results_eq(
  $$
    select type::text, count(*)::integer
    from public.notifications
    where user_id = '81000000-0000-4000-8000-000000000001'
      and dedupe_key = 'activity-review:82000000-0000-4000-8000-000000000004:approved'
    group by type
  $$,
  $$values ('activity_approved'::text, 1)$$,
  'only the real pending-to-approved transition notifies the host'
);

-- Friendship inserts and accepted transitions notify opposite sides exactly once.
insert into public.friend_connections (id, user_id, friend_id, status, created_at)
values (
  '84000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000007',
  'pending',
  '2026-08-04 12:10:00+00'
);

update public.friend_connections
set status = 'accepted'
where id = '84000000-0000-4000-8000-000000000002';

select results_eq(
  $$
    select user_id, type::text
    from public.notifications
    where dedupe_key like 'friend:%84000000-0000-4000-8000-000000000002%'
    order by type
  $$,
  $$
    values
      ('81000000-0000-4000-8000-000000000001'::uuid, 'friend_accepted'::text),
      ('81000000-0000-4000-8000-000000000007'::uuid, 'friend_request'::text)
  $$,
  'friend requests notify recipients and acceptance notifies requesters'
);

-- Safety content never enters a notification. Only safety owners and the reporter are told.
insert into public.safety_reports (
  id, reporter_id, reported_user_id, context, status, created_at
)
values (
  '86000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000007',
  '81000000-0000-4000-8000-000000000008',
  'PRIVATE REPORT CONTEXT MUST NEVER LEAK',
  'open',
  '2026-08-04 12:20:00+00'
);

select results_eq(
  $$
    select user_id
    from public.notifications
    where type = 'safety_review'
      and data ->> 'refId' = '86000000-0000-4000-8000-000000000001'
  $$,
  $$values ('81000000-0000-4000-8000-000000000006'::uuid)$$,
  'new safety flags notify only app-metadata safety owners'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000006","app_metadata":{"role":"safety_owner"}}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.resolve_flag(
      (select id from public.safety_flags where type = 'report' and ref_id = '86000000-0000-4000-8000-000000000001'),
      'dismissed'
    )
  $$,
  'a safety owner can resolve the linked report flag'
);
reset role;

select results_eq(
  $$select status::text from public.safety_reports where id = '86000000-0000-4000-8000-000000000001'$$,
  $$values ('dismissed'::text)$$,
  'report resolution keeps the source report status synchronized'
);

select results_eq(
  $$
    select user_id, type::text,
           body !~* '(PRIVATE REPORT CONTEXT|Olive Outsider|Safety Owner)',
           data ? 'reportId' and not (data ? 'reportedUserId') and not (data ? 'context')
    from public.notifications
    where dedupe_key = 'safety-report-status:86000000-0000-4000-8000-000000000001:dismissed'
  $$,
  $$
    values (
      '81000000-0000-4000-8000-000000000007'::uuid,
      'safety_report_status'::text,
      true,
      true
    )
  $$,
  'reporters receive a neutral status update with no report or identity content'
);

select results_eq(
  $$
    select count(*)::integer
    from public.notifications
    where body like '%PRIVATE REPORT CONTEXT%'
       or data::text like '%PRIVATE REPORT CONTEXT%'
  $$,
  $$values (0)$$,
  'safety context is absent from every notification body and data object'
);

-- Two independent database sessions leaving the same full activity must not
-- deadlock, oversubscribe, skip the queue, or duplicate promotion messages.
select lives_ok(
  $$
    select extensions.dblink_connect(
      'notification_promotion_a',
      'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
    )
  $$,
  'first concurrent promotion worker connects'
);

select lives_ok(
  $$
    select extensions.dblink_connect(
      'notification_promotion_b',
      'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres connect_timeout=3'
    )
  $$,
  'second concurrent promotion worker connects'
);

select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_promotion_a',
      $remote$
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        )
        select
          '00000000-0000-0000-0000-000000000000'::uuid,
          fixture.id,
          'authenticated', 'authenticated', fixture.email, '', now(),
          '{}'::jsonb, jsonb_build_object('full_name', fixture.full_name), now(), now()
        from (values
          ('87000000-0000-4000-8000-000000000001'::uuid, 'race-host@umd.edu', 'Race Host'),
          ('87000000-0000-4000-8000-000000000002'::uuid, 'race-leaver-a@umd.edu', 'Race Leaver A'),
          ('87000000-0000-4000-8000-000000000003'::uuid, 'race-leaver-b@umd.edu', 'Race Leaver B'),
          ('87000000-0000-4000-8000-000000000004'::uuid, 'race-waiter-a@umd.edu', 'Race Waiter A'),
          ('87000000-0000-4000-8000-000000000005'::uuid, 'race-waiter-b@umd.edu', 'Race Waiter B')
        ) as fixture(id, email, full_name);

        insert into public.locations (id, university_id, name, area, safety_note)
        values ('notification-promotion-race', 'umd', 'Promotion Race', 'Campus', 'Public fixture.');

        insert into public.activities (
          id, title, category, location_id, host_id, capacity, start_time,
          availability_block, source, status, university_id
        ) values (
          '88000000-0000-4000-8000-000000000001', 'Concurrent Queue', 'coffee',
          'notification-promotion-race', '87000000-0000-4000-8000-000000000001',
          2, now() + interval '2 days', 'weekday_afternoon', 'seeded', 'approved', 'umd'
        );

        insert into public.rsvps (activity_id, user_id, status, created_at)
        values
          ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000002','going','2026-08-04 12:00:00+00'),
          ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000003','going','2026-08-04 12:00:01+00'),
          ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000004','waitlisted','2026-08-04 12:00:02+00'),
          ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000005','waitlisted','2026-08-04 12:00:03+00');

        update public.notification_runtime_config
        set notification_core_enabled = true,
            push_enabled = true,
            push_rollout_percentage = 100
        where id;

        insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
        values
          ('87000000-0000-4000-8000-000000000004','https://push.example.test/promotion-race/a','race-a','auth-a'),
          ('87000000-0000-4000-8000-000000000005','https://push.example.test/promotion-race/b','race-b','auth-b')
      $remote$
    )
  $test$,
  'committed concurrent promotion fixtures are created'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_promotion_a', 'set role authenticated')$$,
  'first worker assumes the authenticated role'
);
select lives_ok(
  $$select extensions.dblink_exec('notification_promotion_b', 'set role authenticated')$$,
  'second worker assumes the authenticated role'
);
select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_promotion_a',
      'set request.jwt.claim.sub = ''87000000-0000-4000-8000-000000000002'''
    )
  $$,
  'first worker receives its JWT subject'
);
select lives_ok(
  $$
    select extensions.dblink_exec(
      'notification_promotion_b',
      'set request.jwt.claim.sub = ''87000000-0000-4000-8000-000000000003'''
    )
  $$,
  'second worker receives its JWT subject'
);

select is(
  extensions.dblink_send_query(
    'notification_promotion_a',
    $$select public.leave_activity('88000000-0000-4000-8000-000000000001')$$
  ),
  1,
  'first leave is dispatched asynchronously'
);
select is(
  extensions.dblink_send_query(
    'notification_promotion_b',
    $$select public.leave_activity('88000000-0000-4000-8000-000000000001')$$
  ),
  1,
  'second leave is dispatched while the first holds the activity lock'
);

select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_promotion_a') as result(value text)
  ),
  1::bigint,
  'first concurrent leave completes and its result is fully consumed'
);
select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_promotion_b') as result(value text)
  ),
  1::bigint,
  'second concurrent leave completes without deadlock and is fully consumed'
);

-- libpq exposes a final empty result marker for an asynchronous command. Drain
-- it before reusing either named connection for fixture cleanup.
select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_promotion_a') as result(value text)
  ),
  0::bigint,
  'first async connection is fully drained'
);
select is(
  (
    select count(*)
    from extensions.dblink_get_result('notification_promotion_b') as result(value text)
  ),
  0::bigint,
  'second async connection is fully drained'
);

select results_eq(
  $$
    select user_id, status::text
    from public.rsvps
    where activity_id = '88000000-0000-4000-8000-000000000001'
    order by created_at, user_id
  $$,
  $$
    values
      ('87000000-0000-4000-8000-000000000002'::uuid, 'left'::text),
      ('87000000-0000-4000-8000-000000000003'::uuid, 'left'::text),
      ('87000000-0000-4000-8000-000000000004'::uuid, 'going'::text),
      ('87000000-0000-4000-8000-000000000005'::uuid, 'going'::text)
  $$,
  'concurrent leaves promote both waiters once in committed queue order'
);

select results_eq(
  $$
    select count(*)::integer,
           count(distinct n.user_id)::integer,
           count(d.id)::integer
    from public.notifications n
    left join public.notification_deliveries d on d.notification_id = n.id
    where n.type = 'waitlist_promoted'
      and n.user_id in (
        '87000000-0000-4000-8000-000000000004',
        '87000000-0000-4000-8000-000000000005'
      )
  $$,
  $$values (2, 2, 2)$$,
  'each concurrently promoted waiter gets one inbox row and one device delivery'
);

select lives_ok(
  $$select extensions.dblink_exec('notification_promotion_a', 'reset role')$$,
  'fixture worker restores its database role'
);
select lives_ok(
  $test$
    select extensions.dblink_exec(
      'notification_promotion_a',
      $remote$
        delete from auth.users where id in (
          '87000000-0000-4000-8000-000000000001',
          '87000000-0000-4000-8000-000000000002',
          '87000000-0000-4000-8000-000000000003',
          '87000000-0000-4000-8000-000000000004',
          '87000000-0000-4000-8000-000000000005'
        );
        delete from public.locations where id = 'notification-promotion-race';
        update public.notification_runtime_config set push_rollout_percentage = 0 where id
      $remote$
    )
  $test$,
  'committed concurrent promotion fixtures are removed'
);
select lives_ok(
  $$select extensions.dblink_disconnect('notification_promotion_a')$$,
  'first concurrent promotion worker disconnects'
);
select lives_ok(
  $$select extensions.dblink_disconnect('notification_promotion_b')$$,
  'second concurrent promotion worker disconnects'
);

-- Scheduled fixtures are anchored so every producer window is deterministic.
update public.profiles
set completed_onboarding = true,
    interests = array['coffee']::public.category[],
    availability_blocks = array['weekday_afternoon']::public.availability_block[],
    comfort_size = 'either',
    safety_preference = 'none'
where id = '81000000-0000-4000-8000-000000000008';

insert into public.activities (
  id, title, category, location_id, host_id, capacity, start_time,
  availability_block, source, status, university_id, comfort_size,
  safety_preference, created_at, updated_at
)
values
  (
    '89000000-0000-4000-8000-000000000001', 'Reminder Window', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    6, '2026-08-05 12:02:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umd', 'either', 'none', '2026-08-01 12:00:00+00', '2026-08-01 12:00:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000002', 'Pulse Window', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000001',
    6, '2026-08-04 10:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umd', 'either', 'none', '2026-08-01 12:00:00+00', '2026-08-01 12:00:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000003', 'Current Match', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-08-06 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-08-04 20:00:00+00', '2026-08-04 20:00:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000004', 'Already Joined Match', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-08-06 18:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-08-04 20:10:00+00', '2026-08-04 20:10:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000005', 'Stale Match', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-08-06 19:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-08-02 20:00:00+00', '2026-08-02 20:00:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000006', 'Winter DST Match', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-01-16 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-01-15 21:30:00+00', '2026-01-15 21:30:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000007', 'Summer DST Match', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-07-16 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-07-15 20:30:00+00', '2026-07-15 20:30:00+00'
  ),
  (
    '89000000-0000-4000-8000-000000000008', 'Weekly Completed Huddle', 'coffee',
    'notification-producer-fixture', '81000000-0000-4000-8000-000000000006',
    6, '2026-07-30 17:00:00+00', 'weekday_afternoon', 'seeded', 'approved',
    'umb', 'either', 'none', '2026-07-25 20:00:00+00', '2026-07-25 20:00:00+00'
  );

insert into public.rsvps (activity_id, user_id, status, created_at, updated_at)
values
  ('89000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','going','2026-08-01 12:00:00+00','2026-08-01 12:00:00+00'),
  ('89000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','going','2026-08-01 12:00:01+00','2026-08-01 12:00:01+00'),
  ('89000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','going','2026-08-01 12:00:00+00','2026-08-01 12:00:00+00'),
  ('89000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000008','going','2026-08-04 20:15:00+00','2026-08-04 20:15:00+00'),
  ('89000000-0000-4000-8000-000000000008','81000000-0000-4000-8000-000000000008','going','2026-07-28 12:00:00+00','2026-07-28 12:00:00+00');

select results_eq(
  $$select * from public.produce_event_reminders('2026-08-04 12:00:00+00')$$,
  $$values (2, 2, 0, 0, 0)$$,
  'the 24-hour reminder scans and creates once per going attendee'
);
select results_eq(
  $$select * from public.produce_event_reminders('2026-08-04 12:00:00+00')$$,
  $$values (2, 0, 2, 0, 0)$$,
  'rerunning the same reminder window reports deduped rows'
);
select results_eq(
  $$select * from public.produce_event_reminders('2026-08-05 11:00:00+00')$$,
  $$values (2, 2, 0, 0, 0)$$,
  'the slightly wider five-minute one-hour window cannot miss attendees'
);

select results_eq(
  $$select * from public.produce_pulse_prompts('2026-08-04 12:05:00+00')$$,
  $$values (1, 1, 0, 0, 0)$$,
  'the fifteen-minute post-event pulse window targets going attendees'
);
select results_eq(
  $$select * from public.produce_pulse_prompts('2026-08-04 12:05:00+00')$$,
  $$values (1, 0, 1, 0, 0)$$,
  'pulse prompt reruns are idempotent'
);

select results_eq(
  $$select * from public.produce_activity_match_digests('2026-08-04 20:00:00+00')$$,
  $$values (0, 0, 0, 0, 0)$$,
  'daily matching stays closed before 17:00 New York time'
);
select results_eq(
  $$select * from public.produce_activity_match_digests('2026-08-04 21:00:00+00')$$,
  $$values (1, 1, 0, 0, 0)$$,
  'daily matching creates one digest and excludes joined stale and wrong-university activities'
);
select results_eq(
  $$
    select (data ->> 'matchCount')::integer
    from public.notifications
    where user_id = '81000000-0000-4000-8000-000000000008'
      and dedupe_key = 'activity-match:81000000-0000-4000-8000-000000000008:2026-08-04'
  $$,
  $$values (1)$$,
  'the daily digest summarizes only eligible activities from the prior window'
);
select results_eq(
  $$select * from public.produce_activity_match_digests('2026-08-04 21:00:00+00')$$,
  $$values (1, 0, 1, 0, 0)$$,
  'daily digest reruns report their deduped row'
);

select results_eq(
  $$select * from public.produce_activity_match_digests('2026-01-15 21:00:00+00')$$,
  $$values (0, 0, 0, 0, 0)$$,
  'the winter gate does not run at 16:00 EST'
);
select results_eq(
  $$select * from public.produce_activity_match_digests('2026-01-15 22:00:00+00')$$,
  $$values (1, 1, 0, 0, 0)$$,
  'the winter gate runs at 17:00 EST'
);
select results_eq(
  $$select * from public.produce_activity_match_digests('2026-07-15 21:00:00+00')$$,
  $$values (1, 1, 0, 0, 0)$$,
  'the summer gate runs at 17:00 EDT without a cron rewrite'
);

select results_eq(
  $$select * from public.produce_weekly_recaps('2026-08-03 12:00:00+00')$$,
  $$values (0, 0, 0, 0, 0)$$,
  'the Monday recap stays closed before 09:00 New York time'
);
select results_eq(
  $$select * from public.produce_weekly_recaps('2026-08-03 13:00:00+00')$$,
  $$values (1, 1, 0, 0, 0)$$,
  'the Monday 09:00 EDT recap summarizes completed Huddles'
);
select results_eq(
  $$select * from public.produce_weekly_recaps('2026-08-03 13:00:00+00')$$,
  $$values (1, 0, 1, 0, 0)$$,
  'weekly recap reruns report their deduped row'
);

select results_eq(
  $$
    select total, eligible
    from public.activity_match_score_at(
      '81000000-0000-4000-8000-000000000008',
      '89000000-0000-4000-8000-000000000003',
      '2026-08-04 21:00:00+00'
    )
  $$,
  $$values (100, true)$$,
  'SQL match scoring at a fixed instant mirrors exact interest availability and comfort weights'
);
select results_eq(
  $$
    select total, eligible
    from public.activity_match_score_at(
      '81000000-0000-4000-8000-000000000008',
      '89000000-0000-4000-8000-000000000004',
      '2026-08-04 21:00:00+00'
    )
  $$,
  $$values (100, false)$$,
  'match scoring preserves score while excluding an activity already joined'
);
select results_eq(
  $$
    select wrapper.total = explicit.total,
           wrapper.eligible = explicit.eligible
    from public.activity_match_score(
      '81000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000001'
    ) wrapper
    cross join public.activity_match_score_at(
      '81000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000001',
      now()
    ) explicit
  $$,
  $$values (true, true)$$,
  'the public score wrapper delegates to current-time scoring'
);

select results_eq(
  $$
    select jobname, count(*)::integer
    from cron.job
    where jobname in (
      'huddle-event-reminders', 'huddle-pulse-prompts',
      'huddle-activity-match-digests', 'huddle-weekly-recaps'
    )
    group by jobname
    order by jobname
  $$,
  $$
    values
      ('huddle-activity-match-digests'::text, 1),
      ('huddle-event-reminders'::text, 1),
      ('huddle-pulse-prompts'::text, 1),
      ('huddle-weekly-recaps'::text, 1)
  $$,
  'all four producer schedules are installed exactly once'
);

-- Pulse responses are private, one-shot, and written only through a narrow RPC.
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select activity_id, user_id, did_meet, rating
    from public.submit_pulse_response(
      '82000000-0000-4000-8000-000000000001', true, 5
    )
  $$,
  $$
    values (
      '82000000-0000-4000-8000-000000000001'::uuid,
      '81000000-0000-4000-8000-000000000002'::uuid,
      true,
      5::smallint
    )
  $$,
  'a going attendee can submit a rated pulse response'
);

select results_eq(
  $$
    with replay as (
      select *
      from public.submit_pulse_response(
        '82000000-0000-4000-8000-000000000001', true, 5
      )
    )
    select replay.id = stored.id, replay.created_at = stored.created_at
    from replay
    join public.pulses stored
      on stored.activity_id = replay.activity_id and stored.user_id = replay.user_id
  $$,
  $$values (true, true)$$,
  'an identical pulse replay returns the original immutable row'
);

select throws_ok(
  $$
    select public.submit_pulse_response(
      '82000000-0000-4000-8000-000000000001', false, 5
    )
  $$,
  '22023'::char(5),
  'Pulse response already submitted with different values',
  'a conflicting pulse replay is rejected'
);

select throws_ok(
  $$
    select public.submit_pulse_response(
      '82000000-0000-4000-8000-000000000001', true, 0
    )
  $$,
  '22023'::char(5),
  'Pulse rating must be between 1 and 5',
  'pulse ratings outside one through five are rejected'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000007","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.submit_pulse_response(
      '82000000-0000-4000-8000-000000000001', true, null
    )
  $$,
  '42501'::char(5),
  'Only going attendees can submit a pulse response',
  'a non-attendee cannot submit a pulse response'
);

select results_eq(
  $$select count(*)::integer from public.pulses$$,
  $$values (0)$$,
  'RLS prevents another user from reading the stored pulse response'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","app_metadata":{"role":"student"}}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select did_meet, rating is null
    from public.submit_pulse_response(
      '82000000-0000-4000-8000-000000000001', false, null
    )
  $$,
  $$values (false, true)$$,
  'an eligible attendee may submit an unrated response'
);

select results_eq(
  $$
    select user_id, did_meet, rating
    from public.pulses
    order by created_at
  $$,
  $$
    values (
      '81000000-0000-4000-8000-000000000003'::uuid,
      false,
      null::smallint
    )
  $$,
  'owners can select only their own pulse response'
);

reset role;

select results_eq(
  $$
    select
      bool_or(pg_catalog.has_column_privilege('authenticated', 'public.pulses', column_name, 'INSERT')),
      bool_or(pg_catalog.has_column_privilege('authenticated', 'public.pulses', column_name, 'UPDATE'))
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pulses'
  $$,
  $$values (false, false)$$,
  'authenticated users have no direct pulse insert or update column grants'
);

select results_eq(
  $$
    select proc.prosecdef,
           coalesce(proc.proconfig, '{}'::text[]) @> array['search_path=""'],
           pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute'),
           pg_catalog.has_function_privilege('anon', proc.oid, 'execute')
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'submit_pulse_response'
  $$,
  $$values (true, true, true, false)$$,
  'the pulse RPC uses fixed-path definer rights and authenticated-only execution'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'try_create_notification', 'notify_chat_message',
        'notify_friend_connection', 'notify_safety_flag'
      )
      and (
        not proc.prosecdef
        or not coalesce(proc.proconfig, '{}'::text[]) @> array['search_path=""']
        or pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute')
        or pg_catalog.has_function_privilege('anon', proc.oid, 'execute')
      )
  $$,
  $$values (0)$$,
  'producer helpers use definer rights, a fixed path, and no client execution grant'
);

select * from finish();
rollback;
