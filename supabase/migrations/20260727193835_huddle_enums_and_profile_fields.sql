-- Huddle domain enums, mirroring the union types in lib/types/huddle.ts.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'category' and typnamespace = 'public'::regnamespace) then
    create type public.category as enum (
      'study', 'coffee', 'outdoors', 'fitness', 'games', 'arts',
      'faith', 'language', 'volunteering', 'hangout', 'sports'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'availability_block' and typnamespace = 'public'::regnamespace) then
    create type public.availability_block as enum (
      'weekday_morning', 'weekday_afternoon', 'weekday_evening',
      'weekend_morning', 'weekend_afternoon', 'weekend_evening'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'student_status' and typnamespace = 'public'::regnamespace) then
    create type public.student_status as enum (
      'undergrad_1', 'undergrad_2', 'undergrad_3', 'undergrad_4',
      'masters', 'phd', 'postdoc', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gender' and typnamespace = 'public'::regnamespace) then
    create type public.gender as enum (
      'male', 'female', 'transgender_woman', 'transgender_man',
      'lesbian', 'gay', 'bisexual', 'non_binary', 'prefer_not_to_say'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'comfort_size' and typnamespace = 'public'::regnamespace) then
    create type public.comfort_size as enum ('small', 'medium', 'either');
  end if;

  if not exists (select 1 from pg_type where typname = 'safety_preference' and typnamespace = 'public'::regnamespace) then
    create type public.safety_preference as enum ('none', 'mixed', 'women_only', 'same_gender');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_source' and typnamespace = 'public'::regnamespace) then
    create type public.activity_source as enum ('seeded', 'org', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_status' and typnamespace = 'public'::regnamespace) then
    create type public.activity_status as enum ('draft', 'pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'rsvp_status' and typnamespace = 'public'::regnamespace) then
    create type public.rsvp_status as enum ('going', 'waitlisted', 'left');
  end if;

  if not exists (select 1 from pg_type where typname = 'flag_type' and typnamespace = 'public'::regnamespace) then
    create type public.flag_type as enum ('chat', 'event', 'report');
  end if;

  if not exists (select 1 from pg_type where typname = 'flag_status' and typnamespace = 'public'::regnamespace) then
    create type public.flag_status as enum ('open', 'dismissed', 'warned', 'removed', 'frozen');
  end if;
end
$$;

-- Matching and gamification fields the app needs on every profile.
alter table public.profiles
  add column if not exists last_initial text not null default '',
  add column if not exists status public.student_status not null default 'other',
  add column if not exists interests public.category[] not null default '{}',
  add column if not exists availability_blocks public.availability_block[] not null default '{}',
  add column if not exists comfort_size public.comfort_size not null default 'either',
  add column if not exists safety_preference public.safety_preference not null default 'none',
  add column if not exists photo_color text not null default '#d05b47',
  add column if not exists points integer not null default 0,
  add column if not exists streak_days integer not null default 0,
  add column if not exists meetups_this_week integer not null default 0,
  add column if not exists completed_onboarding boolean not null default false,
  add column if not exists university_id text not null default 'umd',
  add column if not exists cohort text not null default 'umd-pilot';

-- Derived so the rendered name can never drift from its parts.
alter table public.profiles
  add column if not exists display_name text generated always as (
    btrim(
      coalesce(nullif(btrim(first_name), ''), 'Student')
      || ' '
      || btrim(last_initial)
      || case when btrim(last_initial) = '' then '' else '.' end
    )
  ) stored;

alter table public.profiles
  drop constraint if exists profiles_university_id_check,
  drop constraint if exists profiles_points_check,
  drop constraint if exists profiles_streak_days_check,
  drop constraint if exists profiles_meetups_this_week_check,
  drop constraint if exists profiles_interests_length_check,
  drop constraint if exists profiles_photo_color_check,
  drop constraint if exists profiles_last_initial_check;

alter table public.profiles
  add constraint profiles_university_id_check check (university_id in ('umd', 'umb')),
  add constraint profiles_points_check check (points >= 0),
  add constraint profiles_streak_days_check check (streak_days >= 0),
  add constraint profiles_meetups_this_week_check check (meetups_this_week >= 0),
  add constraint profiles_interests_length_check check (coalesce(array_length(interests, 1), 0) <= 8),
  add constraint profiles_photo_color_check check (photo_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint profiles_last_initial_check check (char_length(last_initial) <= 1);

-- Backfill the university from the verified campus address on rows that predate this column.
update public.profiles
set university_id = case when email like '%@umaryland.edu' then 'umb' else 'umd' end
where university_id = 'umd' and email like '%@umaryland.edu';

-- student_details becomes the owner-only companion table, so gender lives here rather than
-- on the world-readable profiles row.
alter table public.student_details
  add column if not exists gender public.gender;

delete from public.student_details where profile_id is null;

alter table public.student_details
  alter column profile_id set not null;
