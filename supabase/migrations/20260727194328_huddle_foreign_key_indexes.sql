-- Covering indexes for foreign keys that would otherwise force sequential scans on
-- cascade checks and reverse lookups.
create index if not exists activities_location_id_idx on public.activities (location_id);
create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists pulses_user_id_idx on public.pulses (user_id);
create index if not exists safety_reports_reported_user_id_idx
  on public.safety_reports (reported_user_id);
