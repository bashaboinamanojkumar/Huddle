-- Bound the final application predicates and prevent idle/overlapping background scans.

create index if not exists activities_university_approved_start_idx
  on public.activities (university_id, start_time, id)
  where status = 'approved';

create index if not exists safety_reports_open_created_idx
  on public.safety_reports (created_at desc, id desc)
  where status = 'open';

create or replace function public.notification_producers_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select config.notification_core_enabled
    from public.notification_runtime_config config
    where config.id
  ), false);
$$;

revoke execute on function public.notification_producers_enabled()
  from public, anon, authenticated;
grant execute on function public.notification_producers_enabled() to service_role;

create or replace function public.request_push_dispatch()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  if not exists (
    select 1
    from public.notification_runtime_config config
    where config.id
      and config.notification_core_enabled
      and config.push_enabled
      and config.push_rollout_percentage > 0
  ) then
    return pg_catalog.jsonb_build_object('status', 'disabled');
  end if;

  if not exists (
    select 1
    from public.notification_deliveries delivery
    join public.push_subscriptions subscription
      on subscription.id = delivery.subscription_id
    where delivery.state in ('pending', 'deferred')
      and delivery.deliver_after <= now()
      and subscription.disabled_at is null
  ) then
    return pg_catalog.jsonb_build_object('status', 'no_work');
  end if;

  select decrypted_secret
  into dispatch_url
  from vault.decrypted_secrets
  where name = 'huddle_send_push_url'
  limit 1;

  select decrypted_secret
  into dispatch_secret
  from vault.decrypted_secrets
  where name = 'huddle_notification_dispatch_secret'
  limit 1;

  dispatch_url := pg_catalog.btrim(dispatch_url);
  dispatch_secret := pg_catalog.btrim(dispatch_secret);

  if dispatch_url is null
    or dispatch_url = ''
    or dispatch_secret is null
    or dispatch_secret = ''
  then
    return pg_catalog.jsonb_build_object('status', 'not_configured');
  end if;

  if dispatch_url !~ '^https://[^/]+/functions/v1/send-push$' then
    return pg_catalog.jsonb_build_object('status', 'invalid_configuration');
  end if;

  perform net.http_post(
    url := dispatch_url,
    headers := pg_catalog.jsonb_build_object(
      'content-type', 'application/json',
      'x-dispatch-secret', dispatch_secret
    ),
    body := pg_catalog.jsonb_build_object('source', 'database'),
    timeout_milliseconds := 5000
  );

  return pg_catalog.jsonb_build_object('status', 'queued');
exception
  when others then
    -- Push infrastructure must never roll back durable inbox creation. Do not
    -- include exception text because it can contain an endpoint or header.
    return pg_catalog.jsonb_build_object('status', 'unavailable');
end;
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

  if not public.notification_producers_enabled() then
    result.skipped := result.skipped + 1;
    return result;
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('huddle:producer:event-reminders', 0)
  ) then
    result.skipped := result.skipped + 1;
    return result;
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

  if not public.notification_producers_enabled() then
    result.skipped := result.skipped + 1;
    return result;
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('huddle:producer:pulse-prompts', 0)
  ) then
    result.skipped := result.skipped + 1;
    return result;
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

  if not public.notification_producers_enabled() then
    result.skipped := result.skipped + 1;
    return result;
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('huddle:producer:activity-match-digests', 0)
  ) then
    result.skipped := result.skipped + 1;
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
      jsonb_build_object(
        'matchCount', match_count,
        'localDate', pg_catalog.to_char(local_now, 'YYYY-MM-DD')
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

  if not public.notification_producers_enabled() then
    result.skipped := result.skipped + 1;
    return result;
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('huddle:producer:weekly-recaps', 0)
  ) then
    result.skipped := result.skipped + 1;
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
      jsonb_build_object(
        'meetupCount', meetup_count,
        'isoWeek', pg_catalog.to_char(local_now, 'IYYY-IW')
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
