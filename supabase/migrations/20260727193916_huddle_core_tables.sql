-- Shared, read-only catalog of vetted public meet-points.
create table if not exists public.locations (
  id text primary key,
  university_id text not null default 'umd' check (university_id in ('umd', 'umb')),
  name text not null check (btrim(name) <> ''),
  area text not null,
  safety_note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  category public.category not null,
  location_id text not null references public.locations (id) on delete restrict,
  host_id uuid not null references public.profiles (id) on delete cascade,
  capacity integer not null check (capacity between 2 and 50),
  start_time timestamptz not null,
  availability_block public.availability_block not null,
  source public.activity_source not null default 'user',
  status public.activity_status not null default 'pending',
  university_id text not null default 'umd' check (university_id in ('umd', 'umb')),
  cohort text not null default 'umd-pilot',
  comfort_size public.comfort_size not null default 'either',
  safety_preference public.safety_preference not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_status_start_time_idx
  on public.activities (status, start_time);
create index if not exists activities_host_id_idx on public.activities (host_id);

create table if not exists public.rsvps (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists rsvps_user_id_idx on public.rsvps (user_id);
create index if not exists rsvps_activity_going_idx
  on public.rsvps (activity_id) where status = 'going';

-- user_id is nullable so the automated chat opener can be authored by no one.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  is_system boolean not null default false,
  body text not null check (btrim(body) <> '' and char_length(body) <= 2000),
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_author_check check (is_system or user_id is not null)
);

create index if not exists messages_activity_created_idx
  on public.messages (activity_id, created_at);

create table if not exists public.safety_flags (
  id uuid primary key default gen_random_uuid(),
  type public.flag_type not null,
  ref_id uuid not null,
  reason text not null,
  status public.flag_status not null default 'open',
  reviewer text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists safety_flags_open_idx
  on public.safety_flags (created_at desc) where status = 'open';
create index if not exists safety_flags_ref_idx on public.safety_flags (type, ref_id);

create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete set null,
  context text not null check (btrim(context) <> '' and char_length(context) <= 2000),
  status public.flag_status not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists safety_reports_reporter_idx on public.safety_reports (reporter_id);

create table if not exists public.pulses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  did_meet boolean not null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create table if not exists public.friend_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  constraint friend_connections_not_self check (user_id <> friend_id)
);

create index if not exists friend_connections_friend_id_idx
  on public.friend_connections (friend_id);

-- Moderation terms live in the database so the scan cannot be bypassed by a client.
create table if not exists public.safety_keywords (
  term text primary key check (btrim(term) <> '' and term = lower(term)),
  created_at timestamptz not null default now()
);

drop trigger if exists handle_activities_updated_at on public.activities;
create trigger handle_activities_updated_at
  before update on public.activities
  for each row execute function public.handle_updated_at();

drop trigger if exists handle_rsvps_updated_at on public.rsvps;
create trigger handle_rsvps_updated_at
  before update on public.rsvps
  for each row execute function public.handle_updated_at();
