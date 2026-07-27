-- Baseline for the schema that existed before Huddle moved off localStorage. These objects
-- were created through the Supabase dashboard, so this file reconstructs them to keep the
-- migration history replayable from an empty database. It is already recorded as applied on
-- the hosted project, and every statement is guarded so re-running it is a no-op.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  username text unique,
  avatar_url text,
  bio text,
  graduation_year integer,
  major text,
  minor text,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_details (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete cascade,
  college text,
  academic_year text check (
    academic_year in ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD')
  ),
  skills text[],
  interests text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Superseded by the name-deriving version in 20260727194105_huddle_functions.sql; kept here
-- so a replay of this migration alone still populates a profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'first_name',
      split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1),
      ''
    ),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists handle_profiles_updated_at on public.profiles;
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists handle_student_details_updated_at on public.student_details;
create trigger handle_student_details_updated_at
  before update on public.student_details
  for each row execute function public.handle_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.student_details enable row level security;

-- The profiles policies here are replaced in 20260727194227_huddle_rls_policies.sql once the
-- app needs to render other students.
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own student details" on public.student_details;
create policy "Users can view their own student details"
  on public.student_details for select to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Users can insert their own student details" on public.student_details;
create policy "Users can insert their own student details"
  on public.student_details for insert to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can update their own student details" on public.student_details;
create policy "Users can update their own student details"
  on public.student_details for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
