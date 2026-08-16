begin;
select plan(6);

select has_index(
  'public', 'activities', 'activities_university_approved_start_idx',
  'core campus activity query has one supporting partial index'
);
select has_index(
  'public', 'safety_reports', 'safety_reports_open_created_idx',
  'open moderation reports have one supporting partial index'
);
select has_function(
  'public', 'notification_producers_enabled', array[]::text[],
  'scheduled producers have a shared runtime gate'
);
select matches(
  pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
  'no_work',
  'push recovery has an explicit no-work exit'
);
select matches(
  pg_get_functiondef('public.produce_event_reminders(timestamptz)'::regprocedure),
  'pg_try_advisory_xact_lock',
  'event reminders have a non-overlap guard'
);
select is(
  (select count(*)::integer from cron.job where jobname like 'huddle-%'),
  6,
  'all six Huddle schedules remain installed'
);

select * from finish();
rollback;
