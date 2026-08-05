-- Reliable notification delivery eligibility, leases, retries, cleanup, and operations.

alter table public.notification_deliveries
  add column if not exists claim_expires_at timestamptz;

create index if not exists notification_deliveries_claim_expiry_idx
  on public.notification_deliveries (claim_expires_at, id)
  where state = 'processing' and claim_expires_at is not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type
    where typname = 'notification_delivery_claim'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.notification_delivery_claim as (
      delivery_id uuid,
      claim_token uuid,
      notification_id uuid,
      user_id uuid,
      subscription_id uuid,
      endpoint text,
      p256dh text,
      auth text,
      title text,
      body text,
      url text,
      type public.notification_type,
      category public.notification_category,
      unread_badge_count integer,
      attempt_count integer
    );
  end if;
end
$$;

create or replace function public.notification_rollout_eligible(
  p_user_id uuid,
  p_percentage integer
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  rollout_bucket integer;
begin
  if p_user_id is null then
    raise exception 'Rollout user is required' using errcode = '22023';
  end if;

  if p_percentage is null or p_percentage not between 0 and 100 then
    raise exception 'Rollout percentage must be between 0 and 100'
      using errcode = '22023';
  end if;

  if p_percentage = 0 then
    return false;
  end if;
  if p_percentage = 100 then
    return true;
  end if;

  rollout_bucket := (
    ('x' || pg_catalog.substr(pg_catalog.md5(p_user_id::text), 1, 8))::bit(32)::bigint
      % 100
  )::integer;

  return rollout_bucket < p_percentage;
end;
$$;

create or replace function public.notification_deliver_after(
  p_now timestamptz,
  p_timezone text,
  p_start time,
  p_end time
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_now timestamp;
  local_day date;
  local_clock time;
  end_day date;
begin
  if p_now is null then
    raise exception 'Delivery time is required' using errcode = '22023';
  end if;

  if p_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;

  if p_start is null or p_end is null or p_start = p_end then
    return p_now;
  end if;

  local_now := p_now at time zone p_timezone;
  local_day := local_now::date;
  local_clock := local_now::time;

  if p_start < p_end then
    if local_clock < p_start or local_clock >= p_end then
      return p_now;
    end if;
    end_day := local_day;
  else
    if local_clock >= p_end and local_clock < p_start then
      return p_now;
    end if;
    end_day := case
      when local_clock < p_end then local_day
      else local_day + 1
    end;
  end if;

  return (end_day + p_end) at time zone p_timezone;
end;
$$;

create or replace function public.notification_push_allowed(
  p_user_id uuid,
  p_category public.notification_category,
  p_now timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  runtime public.notification_runtime_config;
  preference public.notification_preferences;
  category_enabled boolean;
  sent_notifications integer;
begin
  if p_user_id is null or p_category is null or p_now is null then
    return false;
  end if;

  select * into runtime
  from public.notification_runtime_config
  where id;

  select * into preference
  from public.notification_preferences
  where user_id = p_user_id;

  if runtime.id is null or preference.user_id is null then
    return false;
  end if;

  category_enabled := case p_category
    when 'chat' then preference.chat_enabled
    when 'activities' then preference.activities_enabled
    when 'reminders' then preference.reminders_enabled
    when 'social' then preference.social_enabled
    when 'safety' then preference.safety_enabled
    when 'digest' then preference.digest_enabled
    when 'rewards' then preference.rewards_enabled
    else false
  end;

  if not runtime.notification_core_enabled
    or not runtime.push_enabled
    or not preference.push_enabled
    or not category_enabled
    or (p_category = 'rewards' and not runtime.rewards_enabled)
    or not public.notification_rollout_eligible(
      p_user_id,
      runtime.push_rollout_percentage
    )
  then
    return false;
  end if;

  select count(distinct delivery.notification_id)::integer
  into sent_notifications
  from public.notification_deliveries as delivery
  where delivery.user_id = p_user_id
    and delivery.state = 'sent'
    and delivery.sent_at is not null
    and (delivery.sent_at at time zone preference.timezone)::date
      = (p_now at time zone preference.timezone)::date;

  return sent_notifications < preference.daily_push_cap;
end;
$$;

create or replace function public.enqueue_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  preference public.notification_preferences;
  next_delivery_at timestamptz;
  initial_state public.notification_delivery_state;
begin
  if not public.notification_push_allowed(
    new.user_id,
    new.category,
    v_now
  ) then
    return new;
  end if;

  select * into preference
  from public.notification_preferences
  where user_id = new.user_id;

  if preference.user_id is null then
    return new;
  end if;

  next_delivery_at := public.notification_deliver_after(
    v_now,
    preference.timezone,
    preference.quiet_hours_start,
    preference.quiet_hours_end
  );
  initial_state := case
    when next_delivery_at > v_now
      then 'deferred'::public.notification_delivery_state
    else 'pending'::public.notification_delivery_state
  end;

  insert into public.notification_deliveries (
    notification_id,
    subscription_id,
    user_id,
    state,
    deliver_after
  )
  select
    new.id,
    subscription.id,
    new.user_id,
    initial_state,
    next_delivery_at
  from public.push_subscriptions as subscription
  where subscription.user_id = new.user_id
    and subscription.disabled_at is null
    and pg_catalog.lower(subscription.endpoint) not like 'retired:%'
  on conflict (notification_id, subscription_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_notification_deliveries_after_insert
  on public.notifications;
create trigger enqueue_notification_deliveries_after_insert
  after insert on public.notifications
  for each row execute function public.enqueue_notification_deliveries();

create or replace function public.claim_notification_deliveries(
  p_limit integer default 50,
  p_lease_seconds integer default 120
)
returns setof public.notification_delivery_claim
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  candidate record;
  preference public.notification_preferences;
  next_delivery_at timestamptz;
  new_claim_token uuid;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Claim limit must be between 1 and 100'
      using errcode = '22023';
  end if;

  if p_lease_seconds is null or p_lease_seconds not between 30 and 600 then
    raise exception 'Lease seconds must be between 30 and 600'
      using errcode = '22023';
  end if;

  for candidate in
    select delivery.id
    from public.notification_deliveries as delivery
    where (
      delivery.state in ('pending', 'deferred')
      and delivery.deliver_after <= v_now
    ) or (
      delivery.state = 'processing'
      and coalesce(
        delivery.claim_expires_at,
        delivery.claimed_at
          + pg_catalog.make_interval(secs => p_lease_seconds)
      ) <= v_now
    )
    order by delivery.deliver_after, delivery.id
    for update skip locked
    limit p_limit
  loop
    if not exists (
      select 1
      from public.push_subscriptions as subscription
      join public.notification_deliveries as delivery
        on delivery.subscription_id = subscription.id
       and delivery.user_id = subscription.user_id
      where delivery.id = candidate.id
        and subscription.disabled_at is null
        and pg_catalog.lower(subscription.endpoint) not like 'retired:%'
    ) then
      update public.notification_deliveries
      set state = 'skipped',
          last_error_code = 'subscription_disabled',
          claimed_at = null,
          claim_token = null,
          claim_expires_at = null
      where id = candidate.id;
      continue;
    end if;

    if not exists (
      select 1
      from public.notification_deliveries as delivery
      join public.notifications as notification
        on notification.id = delivery.notification_id
       and notification.user_id = delivery.user_id
      where delivery.id = candidate.id
        and public.notification_push_allowed(
          delivery.user_id,
          notification.category,
          v_now
        )
    ) then
      update public.notification_deliveries
      set state = 'skipped',
          last_error_code = 'push_ineligible',
          claimed_at = null,
          claim_token = null,
          claim_expires_at = null
      where id = candidate.id;
      continue;
    end if;

    select preference_row.* into preference
    from public.notification_preferences as preference_row
    join public.notification_deliveries as delivery
      on delivery.user_id = preference_row.user_id
    where delivery.id = candidate.id;

    next_delivery_at := public.notification_deliver_after(
      v_now,
      preference.timezone,
      preference.quiet_hours_start,
      preference.quiet_hours_end
    );

    if next_delivery_at > v_now then
      update public.notification_deliveries
      set state = 'deferred',
          deliver_after = next_delivery_at,
          last_error_code = null,
          claimed_at = null,
          claim_token = null,
          claim_expires_at = null
      where id = candidate.id;
      continue;
    end if;

    new_claim_token := gen_random_uuid();

    update public.notification_deliveries
    set state = 'processing',
        claimed_at = v_now,
        claim_token = new_claim_token,
        claim_expires_at = v_now
          + pg_catalog.make_interval(secs => p_lease_seconds),
        attempts = attempts + 1,
        last_error_code = null
    where id = candidate.id;

    return query
    select
      delivery.id,
      delivery.claim_token,
      notification.id,
      delivery.user_id,
      subscription.id,
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth,
      notification.title,
      notification.body,
      notification.url,
      notification.type,
      notification.category,
      (
        select count(*)::integer
        from public.notifications as unread
        where unread.user_id = delivery.user_id
          and unread.read_at is null
      ),
      delivery.attempts
    from public.notification_deliveries as delivery
    join public.notifications as notification
      on notification.id = delivery.notification_id
     and notification.user_id = delivery.user_id
    join public.push_subscriptions as subscription
      on subscription.id = delivery.subscription_id
     and subscription.user_id = delivery.user_id
    where delivery.id = candidate.id
      and delivery.claim_token = new_claim_token;
  end loop;
end;
$$;

create or replace function public.record_notification_delivery_result(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_http_status integer,
  p_error_code text default null
)
returns public.notification_delivery_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  delivery public.notification_deliveries;
  clean_error text;
  next_state public.notification_delivery_state;
  retry_delay interval;
begin
  select * into delivery
  from public.notification_deliveries
  where id = p_delivery_id
  for update;

  if delivery.id is null
    or delivery.state <> 'processing'
    or delivery.claim_token is distinct from p_claim_token
    or delivery.claim_expires_at is null
    or delivery.claim_expires_at <= v_now
  then
    raise exception 'Stale or expired notification delivery claim'
      using errcode = '40001';
  end if;

  clean_error := pg_catalog.left(
    pg_catalog.regexp_replace(
      coalesce(
        nullif(pg_catalog.btrim(p_error_code), ''),
        case
          when p_http_status is null then 'network_error'
          else 'http_' || p_http_status::text
        end
      ),
      '[^A-Za-z0-9_.:-]+',
      '',
      'g'
    ),
    100
  );

  if p_http_status between 200 and 299 then
    next_state := 'sent';
    update public.notification_deliveries
    set state = next_state,
        sent_at = v_now,
        last_error_code = null,
        claimed_at = null,
        claim_token = null,
        claim_expires_at = null
    where id = delivery.id;
  elsif p_http_status in (404, 410) then
    next_state := 'skipped';
    update public.notification_deliveries
    set state = next_state,
        last_error_code = clean_error,
        claimed_at = null,
        claim_token = null,
        claim_expires_at = null
    where id = delivery.id;

    update public.push_subscriptions
    set disabled_at = coalesce(disabled_at, v_now),
        failure_count = failure_count + 1
    where id = delivery.subscription_id
      and user_id = delivery.user_id;
  elsif p_http_status is null
    or p_http_status = 429
    or p_http_status between 500 and 599
  then
    if delivery.attempts >= 5 then
      next_state := 'failed';
      update public.notification_deliveries
      set state = next_state,
          last_error_code = clean_error,
          claimed_at = null,
          claim_token = null,
          claim_expires_at = null
      where id = delivery.id;
    else
      next_state := 'deferred';
      retry_delay := case delivery.attempts
        when 1 then interval '1 minute'
        when 2 then interval '5 minutes'
        when 3 then interval '15 minutes'
        else interval '1 hour'
      end;
      update public.notification_deliveries
      set state = next_state,
          deliver_after = v_now + retry_delay,
          last_error_code = clean_error,
          claimed_at = null,
          claim_token = null,
          claim_expires_at = null
      where id = delivery.id;
    end if;
  else
    next_state := 'failed';
    update public.notification_deliveries
    set state = next_state,
        last_error_code = clean_error,
        claimed_at = null,
        claim_token = null,
        claim_expires_at = null
    where id = delivery.id;
  end if;

  return next_state;
end;
$$;

create or replace function public.notification_operations_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  result jsonb;
begin
  if not public.is_safety_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'opted_in_users', (
      select count(*)
      from public.notification_preferences
      where push_enabled
    ),
    'active_subscriptions', (
      select count(*)
      from public.push_subscriptions
      where disabled_at is null
    ),
    'disabled_subscriptions', (
      select count(*)
      from public.push_subscriptions
      where disabled_at is not null
    ),
    'pending_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state = 'pending'
    ),
    'due_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state in ('pending', 'deferred')
        and deliver_after <= v_now
    ),
    'processing_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state = 'processing'
    ),
    'sent_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state = 'sent'
    ),
    'failed_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state = 'failed'
    ),
    'retry_deliveries', (
      select count(*)
      from public.notification_deliveries
      where state = 'deferred'
    ),
    'recent_errors', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'category', grouped.category,
          'code', grouped.code,
          'count', grouped.error_count
        )
        order by grouped.category, grouped.code
      )
      from (
        select
          notification.category::text as category,
          delivery.last_error_code as code,
          count(*) as error_count
        from public.notification_deliveries as delivery
        join public.notifications as notification
          on notification.id = delivery.notification_id
         and notification.user_id = delivery.user_id
        where delivery.last_error_code is not null
          and delivery.updated_at >= v_now - interval '24 hours'
        group by notification.category, delivery.last_error_code
      ) as grouped
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.cleanup_notification_data(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deliveries_deleted integer;
  notifications_deleted integer;
  subscriptions_deleted integer;
begin
  if p_now is null then
    raise exception 'Cleanup time is required' using errcode = '22023';
  end if;

  with deleted as (
    delete from public.notification_deliveries
    where state in ('sent', 'failed', 'skipped')
      and updated_at < p_now - interval '30 days'
    returning 1
  )
  select count(*)::integer into deliveries_deleted from deleted;

  with deleted as (
    delete from public.notifications as notification
    where notification.read_at is not null
      and notification.created_at < p_now - interval '30 days'
      and not exists (
        select 1
        from public.notification_deliveries as delivery
        where delivery.notification_id = notification.id
          and delivery.user_id = notification.user_id
      )
    returning 1
  )
  select count(*)::integer into notifications_deleted from deleted;

  with deleted as (
    delete from public.push_subscriptions as subscription
    where subscription.disabled_at < p_now - interval '60 days'
      and not exists (
        select 1
        from public.notification_deliveries as delivery
        where delivery.subscription_id = subscription.id
          and delivery.user_id = subscription.user_id
      )
    returning 1
  )
  select count(*)::integer into subscriptions_deleted from deleted;

  return pg_catalog.jsonb_build_object(
    'notifications_deleted', notifications_deleted,
    'deliveries_deleted', deliveries_deleted,
    'subscriptions_deleted', subscriptions_deleted
  );
end;
$$;

revoke execute on function public.notification_rollout_eligible(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.notification_deliver_after(
  timestamptz, text, time, time
) from public, anon, authenticated;
revoke execute on function public.notification_push_allowed(
  uuid, public.notification_category, timestamptz
) from public, anon, authenticated;
revoke execute on function public.enqueue_notification_deliveries()
  from public, anon, authenticated;
revoke execute on function public.claim_notification_deliveries(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.record_notification_delivery_result(
  uuid, uuid, integer, text
) from public, anon, authenticated;
revoke execute on function public.notification_operations_summary()
  from public, anon, authenticated;
revoke execute on function public.cleanup_notification_data(timestamptz)
  from public, anon, authenticated;

grant execute on function public.claim_notification_deliveries(integer, integer)
  to service_role;
grant execute on function public.record_notification_delivery_result(
  uuid, uuid, integer, text
) to service_role;
grant execute on function public.cleanup_notification_data(timestamptz)
  to service_role;
grant execute on function public.notification_operations_summary()
  to authenticated;
