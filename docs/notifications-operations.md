# Huddle Notification Operations

Huddle stores every inbox notification independently from Web Push. Production
starts with Push rollout at `0`; an unavailable Edge Function, Vault secret, or
push provider must not interrupt inbox or source transactions.

## Required configuration

Set the public VAPID key in Vercel as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Set these
Edge Function secrets in the linked Supabase project:

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY=<public-key> VAPID_PRIVATE_KEY=<private-key> VAPID_SUBJECT=mailto:ops@example.com NOTIFICATION_DISPATCH_SECRET=<random-secret>
```

The `NOTIFICATION_DISPATCH_SECRET` value must exactly match the Vault secret
named `huddle_notification_dispatch_secret`. Store the deployed function URL
as `huddle_send_push_url`.

```sql
select vault.create_secret(
  'https://PROJECT_REF.supabase.co/functions/v1/send-push',
  'huddle_send_push_url'
);
select vault.create_secret(
  'MATCHING_RANDOM_SECRET',
  'huddle_notification_dispatch_secret'
);
```

Never place the VAPID private key, dispatch secret, service-role key, endpoint,
or subscription encryption keys in Vercel public variables, application logs,
support exports, or screenshots.

## Deployment order

1. Confirm the linked migration ledger before any production write.
2. Apply database migrations with `npx supabase db push`.
3. Set Edge secrets and the two Vault values.
4. Deploy the worker:

   ```powershell
   npx supabase functions deploy send-push --no-verify-jwt
   ```

5. Deploy the web application with `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set.
6. Confirm the runtime row still has `push_rollout_percentage = 0`.
7. Complete Android Chrome and installed iOS Safari PWA delivery checks before
   raising rollout.

## Inspection and smoke commands

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'huddle-notification-delivery-retry',
  'huddle-notification-cleanup',
  'huddle-event-reminders',
  'huddle-pulse-prompts',
  'huddle-activity-match-digests',
  'huddle-weekly-recaps'
)
order by jobname;

select public.request_push_dispatch();
select public.notification_operations_summary();

-- Manual producer smoke calls. Repeating a call should move created counts
-- to deduped counts without adding another inbox row.
select * from public.produce_event_reminders();
select * from public.produce_pulse_prompts();
select * from public.produce_activity_match_digests();
select * from public.produce_weekly_recaps();

select notification_core_enabled, push_enabled, rewards_enabled,
       push_rollout_percentage
from public.notification_runtime_config
where id;
```

Expected delivery jobs are `huddle-notification-delivery-retry` every minute
and `huddle-notification-cleanup` at `08:20 UTC` daily. Event reminders run
every five minutes, pulse prompts every fifteen minutes, and both digest gates
run hourly. The digest functions act only at `17:00 America/New_York`; weekly
recaps act only Monday at `09:00 America/New_York`, so EST/EDT changes need no
cron rewrite.

Producer results are `{scanned, created, deduped, failed, skipped}`. A healthy
rerun has the same `scanned` count, zero `created`, and the prior created count
under `deduped`. `skipped` means no eligible content for a scanned user;
`failed` means one isolated recipient write failed and needs investigation.
The operations summary is restricted to validated safety owners and contains
aggregates/error codes only.

## Rollout and kill switch

Keep inbox delivery enabled throughout rollout. Increase Push only after the
previous stage meets its duration and delivery-count gate:

1. `0%` while validating one Android and one installed iOS PWA delivery.
2. `5%` for at least 48 hours and 100 attempts.
3. `25%` for at least 72 hours and 500 attempts.
4. `100%` only with send success at least 95%, duplicates below 0.1%, terminal
   non-endpoint failures below 2%, no sensitive log content, and no source
   transaction rollback regressions.

```sql
update public.notification_runtime_config
set push_rollout_percentage = 5
where id;

-- Immediate Push kill switch. Durable inbox creation remains enabled.
update public.notification_runtime_config
set push_enabled = false
where id;
```

Activate the kill switch immediately when duplicates exceed 0.5%, send success
stays below 90% for 30 minutes, the worker sustains `5xx`, or any private content
appears in Push or logs.

## Real-device release checklist

- Chrome desktop: permission, replacement tag, click navigation, offline return.
- Android Chrome: delivery, click navigation, quiet hours, and current-device disable.
- Installed iOS/iPadOS PWA 16.4+: install-first prompt, delivery, and click navigation.
- Two devices: one inbox item and one delivery per active subscription.
- Disabled endpoint: `404`/`410` retires only that subscription.
- Logout: protected caches are removed; the server subscription is explicitly disabled.
- Daily cap: six distinct notifications, independent of device count.
- Privacy: payload/log review contains no message, activity, profile, safety, endpoint,
  or encryption-key values.

Live Web Push remains pending until the linked production project, Vercel
deployment, and real devices have completed this checklist.
