-- Production notification defaults and explicit privilege convergence.
--
-- Earlier notification migrations may already exist in a linked environment,
-- so production policy changes are forward-only.

alter table public.notification_preferences
  alter column digest_enabled set default false,
  alter column rewards_enabled set default false,
  alter column quiet_hours_start set default '22:00'::time,
  alter column quiet_hours_end set default '08:00'::time,
  alter column timezone set default 'America/New_York'::text,
  alter column daily_push_cap set default 6;

-- Notification preferences were not exposed in the client before this
-- milestone. Move rows that still carry the legacy defaults to the approved
-- production defaults while preserving non-default quiet hours and caps.
update public.notification_preferences
set digest_enabled = false,
    rewards_enabled = false,
    quiet_hours_start = coalesce(quiet_hours_start, '22:00'::time),
    quiet_hours_end = coalesce(quiet_hours_end, '08:00'::time),
    daily_push_cap = case when daily_push_cap = 10 then 6 else daily_push_cap end;

-- Rewards remain reserved but disabled at both control layers. Push is dark
-- launched through deterministic rollout rather than an application flag.
update public.notification_runtime_config
set rewards_enabled = false,
    push_rollout_percentage = 0
where id;

-- Repeat the intended access boundary explicitly so a replayed database and a
-- previously hand-hardened local database converge on identical privileges.
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
revoke all on table public.notification_runtime_config from anon, authenticated;

grant select on table public.notifications to authenticated;
grant select on table public.notification_preferences to authenticated;
grant select (
  id,
  user_id,
  endpoint,
  user_agent,
  created_at,
  updated_at,
  last_seen_at,
  disabled_at
) on table public.push_subscriptions to authenticated;
grant select on table public.notification_runtime_config to authenticated;

