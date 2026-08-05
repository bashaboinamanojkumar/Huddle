-- Transactional notification producers for chat, RSVP, moderation, friendship,
-- safety review, and waitlist promotion. Critical state transitions fail closed;
-- social fan-out is isolated per recipient through try_create_notification().

create or replace function public.try_create_notification(
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
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_notification(
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_url,
    p_data,
    p_dedupe_key,
    p_last_event_at,
    p_reopen
  );
  return true;
exception when others then
  -- Deliberately exclude title, body, URL, data, and the database exception.
  raise warning 'notification producer failed: type=%, recipient=%, key=%',
    p_type, p_user_id, p_dedupe_key;
  return false;
end;
$$;

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_title text;
  sender_first_name text;
  preview text;
  bucket_key text;
  recipient record;
  message_count integer;
begin
  if new.is_system or new.user_id is null then
    return new;
  end if;

  select a.title, p.first_name
  into activity_title, sender_first_name
  from public.activities a
  join public.profiles p on p.id = new.user_id
  where a.id = new.activity_id;

  preview := pg_catalog.left(
    pg_catalog.regexp_replace(pg_catalog.btrim(new.body), '\s+', ' ', 'g'),
    120
  );
  bucket_key := 'chat:' || new.activity_id || ':' ||
    pg_catalog.to_char(
      pg_catalog.date_bin(
        '5 minutes'::interval,
        new.created_at,
        '2000-01-01 00:00:00+00'::timestamptz
      ),
      'YYYYMMDDHH24MI'
    );

  for recipient in
    select r.user_id
    from public.rsvps r
    where r.activity_id = new.activity_id
      and r.status = 'going'
      and r.user_id <> new.user_id
    order by r.user_id
  loop
    -- Serialize the read/increment/upsert sequence for concurrent messages in
    -- the same recipient and bucket so data.count cannot lose an increment.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(recipient.user_id::text || ':' || bucket_key, 0)
    );

    select coalesce((n.data ->> 'count')::integer, 0) + 1
    into message_count
    from public.notifications n
    where n.user_id = recipient.user_id
      and n.dedupe_key = bucket_key;

    message_count := coalesce(message_count, 1);

    perform public.try_create_notification(
      recipient.user_id,
      'chat_message',
      'New Huddle message',
      coalesce(nullif(sender_first_name, ''), 'A student') || ': ' || preview,
      '/app/chats/' || new.activity_id,
      jsonb_build_object(
        'activityId', new.activity_id,
        'messageId', new.id,
        'count', message_count,
        'senderFirstName', coalesce(nullif(sender_first_name, ''), 'Student')
      ),
      bucket_key,
      new.created_at,
      true
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists messages_notification_after_insert on public.messages;
create trigger messages_notification_after_insert
  after insert on public.messages
  for each row execute function public.notify_chat_message();

-- Capacity and all notification-producing transitions are serialized through
-- the activity row. That makes the exact-second opener deterministic.
create or replace function public.rsvp_activity(p_activity_id uuid)
returns public.rsvp_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  activity public.activities;
  actor_profile public.profiles;
  going_count integer;
  previous public.rsvp_status;
  next_status public.rsvp_status;
  event_at timestamptz := pg_catalog.clock_timestamp();
  host_key text;
  host_count integer;
  friend record;
  attendee record;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or activity.status <> 'approved' then
    raise exception 'Activity is not open for RSVP' using errcode = '22023';
  end if;

  select * into actor_profile from public.profiles where id = actor;
  if actor_profile.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  select status into previous
  from public.rsvps
  where activity_id = p_activity_id and user_id = actor
  for update;

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

  -- Replays of an already-going RSVP must not look like a new join.
  if next_status = 'going'
    and previous is distinct from 'going'::public.rsvp_status
  then
    select count(*) into going_count
    from public.rsvps
    where activity_id = p_activity_id and status = 'going';

    if activity.host_id <> actor then
      host_key := 'activity-joined:' || activity.id || ':' ||
        pg_catalog.to_char(event_at, 'YYYYMMDDHH24');

      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(activity.host_id::text || ':' || host_key, 0)
      );
      select coalesce((n.data ->> 'count')::integer, 0) + 1
      into host_count
      from public.notifications n
      where n.user_id = activity.host_id and n.dedupe_key = host_key;
      host_count := coalesce(host_count, 1);

      perform public.try_create_notification(
        activity.host_id,
        'activity_joined',
        'New activity RSVP',
        coalesce(nullif(actor_profile.first_name, ''), 'A student') ||
          ' joined ' || activity.title || '.',
        '/app/activity/' || activity.id,
        jsonb_build_object(
          'activityId', activity.id,
          'userId', actor,
          'count', host_count
        ),
        host_key,
        event_at,
        true
      );
    end if;

    -- A friend update is useful only while the activity can still accept them.
    if activity.start_time > event_at and going_count < activity.capacity then
      for friend in
        select distinct
          case
            when fc.user_id = actor then fc.friend_id
            else fc.user_id
          end as user_id
        from public.friend_connections fc
        join public.profiles friend_profile
          on friend_profile.id = case
            when fc.user_id = actor then fc.friend_id
            else fc.user_id
          end
        where fc.status = 'accepted'
          and (fc.user_id = actor or fc.friend_id = actor)
          and friend_profile.university_id = activity.university_id
          and case when fc.user_id = actor then fc.friend_id else fc.user_id end <> actor
      loop
        perform public.try_create_notification(
          friend.user_id,
          'friend_rsvp',
          'A friend joined a Huddle',
          coalesce(nullif(actor_profile.first_name, ''), 'Your friend') ||
            ' joined ' || activity.title || '.',
          '/app/activity/' || activity.id,
          jsonb_build_object('activityId', activity.id, 'friendId', actor),
          'friend-rsvp:' || friend.user_id || ':' || activity.id,
          event_at,
          false
        );
      end loop;
    end if;

    if going_count = 2 and not exists (
      select 1
      from public.messages
      where activity_id = p_activity_id and is_system
    ) then
      insert into public.messages (activity_id, user_id, is_system, body, created_at)
      values (
        p_activity_id,
        null,
        true,
        'You are set for ' || activity.title ||
          '. Use this chat for public meet-point logistics.',
        event_at
      );

      for attendee in
        select r.user_id
        from public.rsvps r
        where r.activity_id = p_activity_id and r.status = 'going'
        order by r.user_id
      loop
        perform public.create_notification(
          attendee.user_id,
          'chat_opened',
          'Your Huddle chat is open',
          'Your group chat for ' || activity.title || ' is ready.',
          '/app/chats/' || activity.id,
          jsonb_build_object('activityId', activity.id),
          'chat-opened:' || activity.id,
          event_at,
          false
        );
      end loop;
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
  activity public.activities;
  previous public.rsvp_status;
  going_count integer;
  promoted record;
  event_at timestamptz := pg_catalog.clock_timestamp();
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  -- Lock the whole active queue in stable order. The activity lock serializes
  -- concurrent leaves; the row locks make the promotion set explicit.
  perform 1
  from public.rsvps
  where activity_id = p_activity_id
    and status in ('going', 'waitlisted')
  order by created_at, user_id
  for update;

  select status into previous
  from public.rsvps
  where activity_id = p_activity_id and user_id = actor;

  if previous is null or previous = 'left' then
    return;
  end if;

  update public.rsvps
  set status = 'left', updated_at = event_at
  where activity_id = p_activity_id and user_id = actor;

  if previous <> 'going' then
    return;
  end if;

  select count(*) into going_count
  from public.rsvps
  where activity_id = p_activity_id and status = 'going';

  if going_count < activity.capacity then
    select r.user_id, r.created_at
    into promoted
    from public.rsvps r
    where r.activity_id = p_activity_id and r.status = 'waitlisted'
    order by r.created_at, r.user_id
    for update skip locked
    limit 1;

    if promoted.user_id is not null then
      update public.rsvps
      set status = 'going', updated_at = event_at
      where activity_id = p_activity_id and user_id = promoted.user_id;

      perform public.create_notification(
        promoted.user_id,
        'waitlist_promoted',
        'You are in',
        'A spot opened for ' || activity.title || '.',
        '/app/activity/' || activity.id,
        jsonb_build_object('activityId', activity.id),
        'waitlist-promoted:' || activity.id || ':' || promoted.user_id,
        event_at,
        false
      );
    end if;
  end if;
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
  previous_status public.activity_status;
  event_at timestamptz := pg_catalog.clock_timestamp();
begin
  if not public.is_safety_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported review status' using errcode = '22023';
  end if;

  select status into previous_status
  from public.activities
  where id = p_activity_id
  for update;

  if not found then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  update public.activities
  set status = p_status
  where id = p_activity_id
  returning * into result;

  update public.safety_flags
  set status = case
        when p_status = 'approved' then 'dismissed'::public.flag_status
        else 'removed'::public.flag_status
      end,
      reviewer = 'Safety owner',
      resolved_at = event_at
  where type = 'event' and ref_id = p_activity_id and status = 'open';

  if previous_status = 'pending' then
    perform public.create_notification(
      result.host_id,
      case
        when p_status = 'approved' then 'activity_approved'::public.notification_type
        else 'activity_rejected'::public.notification_type
      end,
      case
        when p_status = 'approved' then 'Activity approved'
        else 'Activity needs changes'
      end,
      case
        when p_status = 'approved' then result.title || ' is now live.'
        else result.title || ' was not approved.'
      end,
      '/app/activity/' || result.id,
      jsonb_build_object('activityId', result.id, 'status', p_status),
      'activity-review:' || result.id || ':' || p_status,
      event_at,
      false
    );
  end if;

  return result;
end;
$$;

create or replace function public.notify_friend_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester public.profiles;
  recipient public.profiles;
begin
  select * into requester from public.profiles where id = new.user_id;
  select * into recipient from public.profiles where id = new.friend_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.try_create_notification(
      new.friend_id,
      'friend_request',
      'New friend request',
      coalesce(nullif(requester.first_name, ''), 'A student') ||
        ' sent you a friend request.',
      '/app/community',
      jsonb_build_object('connectionId', new.id, 'requesterId', new.user_id),
      'friend:request:' || new.id,
      new.created_at,
      false
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from 'accepted'
    and new.status = 'accepted'
  then
    perform public.try_create_notification(
      new.user_id,
      'friend_accepted',
      'Friend request accepted',
      coalesce(nullif(recipient.first_name, ''), 'A student') ||
        ' accepted your friend request.',
      '/app/community',
      jsonb_build_object('connectionId', new.id, 'friendId', new.friend_id),
      'friend:accepted:' || new.id,
      pg_catalog.clock_timestamp(),
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists friend_connections_notification_after_change
  on public.friend_connections;
create trigger friend_connections_notification_after_change
  after insert or update of status on public.friend_connections
  for each row execute function public.notify_friend_connection();

create or replace function public.notify_safety_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner record;
begin
  for owner in
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.raw_app_meta_data ->> 'role' = 'safety_owner'
    order by u.id
  loop
    perform public.try_create_notification(
      owner.id,
      'safety_review',
      'Safety review needed',
      'A Huddle safety item is ready for review.',
      '/app/admin/review',
      jsonb_build_object('flagId', new.id, 'flagType', new.type, 'refId', new.ref_id),
      'safety-review:' || new.id,
      new.created_at,
      false
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists safety_flags_notification_after_insert on public.safety_flags;
create trigger safety_flags_notification_after_insert
  after insert on public.safety_flags
  for each row execute function public.notify_safety_flag();

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
  report public.safety_reports;
  event_at timestamptz := pg_catalog.clock_timestamp();
begin
  if not public.is_safety_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into result
  from public.safety_flags
  where id = p_flag_id
  for update;

  if result.id is null then
    raise exception 'Flag not found' using errcode = 'P0002';
  end if;

  update public.safety_flags
  set status = p_status,
      reviewer = 'Safety owner',
      resolved_at = event_at
  where id = p_flag_id
  returning * into result;

  if result.type = 'report' then
    select * into report
    from public.safety_reports
    where id = result.ref_id
    for update;

    if report.id is not null and report.status is distinct from p_status then
      update public.safety_reports
      set status = p_status
      where id = report.id
      returning * into report;

      perform public.create_notification(
        report.reporter_id,
        'safety_report_status',
        'Safety report updated',
        'A safety report you submitted has been updated.',
        '/app/settings',
        jsonb_build_object('reportId', report.id, 'status', report.status),
        'safety-report-status:' || report.id || ':' || report.status,
        event_at,
        false
      );
    end if;
  end if;

  return result;
end;
$$;

-- Definer helpers are internal. Existing authenticated RPC contracts remain.
revoke execute on function public.try_create_notification(
  uuid, public.notification_type, text, text, text, jsonb, text, timestamptz, boolean
) from public, anon, authenticated;
revoke execute on function public.notify_chat_message() from public, anon, authenticated;
revoke execute on function public.notify_friend_connection() from public, anon, authenticated;
revoke execute on function public.notify_safety_flag() from public, anon, authenticated;

revoke execute on function public.rsvp_activity(uuid) from public, anon;
revoke execute on function public.leave_activity(uuid) from public, anon;
revoke execute on function public.review_activity(uuid, public.activity_status) from public, anon;
revoke execute on function public.resolve_flag(uuid, public.flag_status) from public, anon;

grant execute on function public.rsvp_activity(uuid) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;
grant execute on function public.review_activity(uuid, public.activity_status) to authenticated;
grant execute on function public.resolve_flag(uuid, public.flag_status) to authenticated;
