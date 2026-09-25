-- Vault-backed Web Push dispatch and scheduled recovery.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists supabase_vault with schema vault;

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

create or replace function public.dispatch_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from inserted_deliveries) then
    perform public.request_push_dispatch();
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists dispatch_notification_deliveries_after_insert
  on public.notification_deliveries;
create trigger dispatch_notification_deliveries_after_insert
  after insert on public.notification_deliveries
  referencing new table as inserted_deliveries
  for each statement execute function public.dispatch_notification_deliveries();

do $$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'huddle-notification-delivery-retry',
      'huddle-notification-cleanup'
    )
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'huddle-notification-delivery-retry',
    '* * * * *',
    'select public.request_push_dispatch();'
  );

  perform cron.schedule(
    'huddle-notification-cleanup',
    '20 8 * * *',
    'select public.cleanup_notification_data();'
  );
end
$$;

revoke execute on function public.request_push_dispatch()
  from public, anon, authenticated;
revoke execute on function public.dispatch_notification_deliveries()
  from public, anon, authenticated;

grant execute on function public.request_push_dispatch() to service_role;

