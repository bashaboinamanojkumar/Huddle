-- Bounded, rerunnable scheduled producers. Hourly digest jobs gate on New York
-- wall-clock time so daylight-saving changes never require cron edits.

create type public.notification_producer_result as (
  scanned integer,
  created integer,
  deduped integer,
  failed integer,
  skipped integer
);

create type public.activity_match_score_result as (
  total integer,
  eligible boolean
);

create or replace function public.activity_match_score_at(
  p_user_id uuid,
  p_activity_id uuid,
  p_now timestamptz
)
returns public.activity_match_score_result
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile public.profiles;
  activity public.activities;
  interest_score integer;
  availability_score integer;
  comfort_score integer;
  safety_blocked boolean;
  result public.activity_match_score_result;
begin
  select * into profile from public.profiles where id = p_user_id;
  select * into activity from public.activities where id = p_activity_id;

  if profile.id is null or activity.id is null then
    raise exception 'Match score subject not found' using errcode = 'P0002';
  end if;
  if p_now is null then
    raise exception 'Match score time is required' using errcode = '22023';
  end if;

  safety_blocked := activity.safety_preference = 'women_only'
    and profile.safety_preference <> 'women_only';

  if safety_blocked then
    result.total := -1;
  else
    interest_score := case
      when activity.category = any(profile.interests) then 45
      else 8
    end;
    availability_score := case
      when activity.availability_block = any(profile.availability_blocks) then 35
      else 6
    end;
    comfort_score := case
      when profile.comfort_size = 'either'
        or activity.comfort_size = 'either'
        or profile.comfort_size = activity.comfort_size
      then 20
      else 5
    end;
    result.total := interest_score + availability_score + comfort_score;
  end if;

  result.eligible := not safety_blocked
    and profile.university_id = activity.university_id
    and activity.status = 'approved'
    and activity.start_time > p_now
    and not exists (
      select 1
      from public.rsvps r
      where r.activity_id = activity.id
        and r.user_id = profile.id
        and r.status in ('going', 'waitlisted')
    );

  return result;
end;
$$;

create or replace function public.activity_match_score(
  p_user_id uuid,
  p_activity_id uuid
)
returns public.activity_match_score_result
language sql
stable
security definer
set search_path = ''
as $$
  select public.activity_match_score_at(p_user_id, p_activity_id, now());
$$;

create or replace function public.produce_event_reminders(
  p_now timestamptz default now()
)
returns public.notification_producer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.notification_producer_result := (0, 0, 0, 0, 0);
  candidate record;
  notification_key text;
  already_exists boolean;
  succeeded boolean;
begin
  if p_now is null then
    raise exception 'Producer time is required' using errcode = '22023';
  end if;

  for candidate in
    select a.id as activity_id, a.title, a.start_time, r.user_id, '24h'::text as window_name
    from public.activities a
    join public.rsvps r on r.activity_id = a.id and r.status = 'going'
    where a.status = 'approved'
      and a.start_time >= p_now + interval '23 hours 55 minutes'
      and a.start_time < p_now + interval '24 hours 5 minutes'
    union all
    select a.id, a.title, a.start_time, r.user_id, '1h'::text
    from public.activities a
    join public.rsvps r on r.activity_id = a.id and r.status = 'going'
    where a.status = 'approved'
      and a.start_time >= p_now + interval '55 minutes'
      and a.start_time < p_now + interval '65 minutes'
    order by activity_id, user_id, window_name
  loop
    result.scanned := result.scanned + 1;
    notification_key := 'event-reminder:' || candidate.activity_id || ':' ||
      candidate.user_id || ':' || candidate.window_name;
    select exists (
      select 1 from public.notifications n
      where n.user_id = candidate.user_id and n.dedupe_key = notification_key
    ) into already_exists;

    succeeded := public.try_create_notification(
      candidate.user_id,
      case
        when candidate.window_name = '24h' then 'event_reminder_24h'::public.notification_type
        else 'event_reminder_1h'::public.notification_type
      end,
      case
        when candidate.window_name = '24h' then 'Huddle tomorrow'
        else 'Huddle in one hour'
      end,
      candidate.title || case
        when candidate.window_name = '24h' then ' starts in about 24 hours.'
        else ' starts in about one hour.'
      end,
      '/app/activity/' || candidate.activity_id,
      jsonb_build_object(
        'activityId', candidate.activity_id,
        'startsAt', candidate.start_time,
        'window', candidate.window_name
      ),
      notification_key,
      p_now,
      false
    );

    if not succeeded then
      result.failed := result.failed + 1;
    elsif already_exists then
      result.deduped := result.deduped + 1;
    else
      result.created := result.created + 1;
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.produce_pulse_prompts(
  p_now timestamptz default now()
)
returns public.notification_producer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.notification_producer_result := (0, 0, 0, 0, 0);
  candidate record;
  notification_key text;
  already_exists boolean;
  succeeded boolean;
begin
  if p_now is null then
    raise exception 'Producer time is required' using errcode = '22023';
  end if;

  for candidate in
    select a.id as activity_id, a.title, r.user_id
    from public.activities a
    join public.rsvps r on r.activity_id = a.id and r.status = 'going'
    where a.status = 'approved'
      and a.start_time > p_now - interval '2 hours 15 minutes'
      and a.start_time <= p_now - interval '2 hours'
    order by a.id, r.user_id
  loop
    result.scanned := result.scanned + 1;
    notification_key := 'pulse-prompt:' || candidate.activity_id || ':' || candidate.user_id;
    select exists (
      select 1 from public.notifications n
      where n.user_id = candidate.user_id and n.dedupe_key = notification_key
    ) into already_exists;

    succeeded := public.try_create_notification(
      candidate.user_id,
      'pulse_prompt',
      'How did your Huddle go?',
      'Share a quick private response for ' || candidate.title || '.',
      '/app/activity/' || candidate.activity_id || '/pulse',
      jsonb_build_object('activityId', candidate.activity_id),
      notification_key,
      p_now,
      false
    );

    if not succeeded then
      result.failed := result.failed + 1;
    elsif already_exists then
      result.deduped := result.deduped + 1;
    else
      result.created := result.created + 1;
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.produce_activity_match_digests(
  p_now timestamptz default now()
)
returns public.notification_producer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.notification_producer_result := (0, 0, 0, 0, 0);
  local_now timestamp;
  candidate record;
  match_count integer;
  notification_key text;
  already_exists boolean;
  succeeded boolean;
begin
  if p_now is null then
    raise exception 'Producer time is required' using errcode = '22023';
  end if;

  local_now := pg_catalog.timezone('America/New_York', p_now);
  if extract(hour from local_now) <> 17 then
    return result;
  end if;

  for candidate in
    select p.id
    from public.profiles p
    where p.completed_onboarding
    order by p.id
  loop
    result.scanned := result.scanned + 1;

    select count(*)::integer
    into match_count
    from public.activities a
    cross join lateral public.activity_match_score_at(candidate.id, a.id, p_now) score
    where a.created_at > p_now - interval '24 hours'
      and a.created_at <= p_now
      and score.eligible;

    if match_count = 0 then
      result.skipped := result.skipped + 1;
      continue;
    end if;

    notification_key := 'activity-match:' || candidate.id || ':' ||
      pg_catalog.to_char(local_now, 'YYYY-MM-DD');
    select exists (
      select 1 from public.notifications n
      where n.user_id = candidate.id and n.dedupe_key = notification_key
    ) into already_exists;

    succeeded := public.try_create_notification(
      candidate.id,
      'activity_match_digest',
      'New Huddles for you',
      match_count || case when match_count = 1
        then ' new Huddle matches your interests.'
        else ' new Huddles match your interests.'
      end,
      '/app',
      jsonb_build_object('matchCount', match_count, 'localDate', pg_catalog.to_char(local_now, 'YYYY-MM-DD')),
      notification_key,
      p_now,
      false
    );

    if not succeeded then
      result.failed := result.failed + 1;
    elsif already_exists then
      result.deduped := result.deduped + 1;
    else
      result.created := result.created + 1;
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.produce_weekly_recaps(
  p_now timestamptz default now()
)
returns public.notification_producer_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.notification_producer_result := (0, 0, 0, 0, 0);
  local_now timestamp;
  candidate record;
  meetup_count integer;
  notification_key text;
  already_exists boolean;
  succeeded boolean;
begin
  if p_now is null then
    raise exception 'Producer time is required' using errcode = '22023';
  end if;

  local_now := pg_catalog.timezone('America/New_York', p_now);
  if extract(isodow from local_now) <> 1
    or extract(hour from local_now) <> 9
  then
    return result;
  end if;

  for candidate in
    select p.id
    from public.profiles p
    where p.completed_onboarding
    order by p.id
  loop
    result.scanned := result.scanned + 1;

    select count(*)::integer
    into meetup_count
    from public.rsvps r
    join public.activities a on a.id = r.activity_id
    where r.user_id = candidate.id
      and r.status = 'going'
      and a.status = 'approved'
      and a.start_time >= p_now - interval '7 days'
      and a.start_time < p_now;

    if meetup_count = 0 then
      result.skipped := result.skipped + 1;
      continue;
    end if;

    notification_key := 'weekly-recap:' || candidate.id || ':' ||
      pg_catalog.to_char(local_now, 'IYYY-IW');
    select exists (
      select 1 from public.notifications n
      where n.user_id = candidate.id and n.dedupe_key = notification_key
    ) into already_exists;

    succeeded := public.try_create_notification(
      candidate.id,
      'weekly_recap',
      'Your Huddle week',
      'You joined ' || meetup_count || case when meetup_count = 1
        then ' Huddle in the past week.'
        else ' Huddles in the past week.'
      end,
      '/app/profile',
      jsonb_build_object('meetupCount', meetup_count, 'isoWeek', pg_catalog.to_char(local_now, 'IYYY-IW')),
      notification_key,
      p_now,
      false
    );

    if not succeeded then
      result.failed := result.failed + 1;
    elsif already_exists then
      result.deduped := result.deduped + 1;
    else
      result.created := result.created + 1;
    end if;
  end loop;

  return result;
end;
$$;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'huddle-event-reminders',
      'huddle-pulse-prompts',
      'huddle-activity-match-digests',
      'huddle-weekly-recaps'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'huddle-event-reminders',
  '*/5 * * * *',
  'select public.produce_event_reminders();'
);
select cron.schedule(
  'huddle-pulse-prompts',
  '*/15 * * * *',
  'select public.produce_pulse_prompts();'
);
select cron.schedule(
  'huddle-activity-match-digests',
  '0 * * * *',
  'select public.produce_activity_match_digests();'
);
select cron.schedule(
  'huddle-weekly-recaps',
  '0 * * * *',
  'select public.produce_weekly_recaps();'
);

revoke execute on function public.activity_match_score_at(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.activity_match_score(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.produce_event_reminders(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.produce_pulse_prompts(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.produce_activity_match_digests(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.produce_weekly_recaps(timestamptz)
  from public, anon, authenticated;

grant execute on function public.activity_match_score(uuid, uuid) to service_role;
grant execute on function public.produce_event_reminders(timestamptz) to service_role;
grant execute on function public.produce_pulse_prompts(timestamptz) to service_role;
grant execute on function public.produce_activity_match_digests(timestamptz) to service_role;
grant execute on function public.produce_weekly_recaps(timestamptz) to service_role;
