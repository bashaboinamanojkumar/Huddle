-- Profiles are readable by any signed-in student because the leaderboard, activity cards
-- and chat threads all render other people. Email is withheld with a column grant instead
-- of a policy, since RLS cannot restrict individual columns. The app reads the signed-in
-- user's own address from the Supabase session, not from this table.
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

revoke all on public.profiles from anon, authenticated;

grant select (
  id, first_name, last_name, last_initial, display_name, username, avatar_url, bio,
  graduation_year, major, minor, is_verified, status, interests, availability_blocks,
  comfort_size, safety_preference, photo_color, points, streak_days, meetups_this_week,
  completed_onboarding, university_id, cohort, created_at, updated_at
) on public.profiles to authenticated;

-- Points, streaks and meetup counts are deliberately absent so a client cannot award
-- itself progress, and email / university are immutable from the browser.
grant update (
  first_name, last_name, last_initial, username, avatar_url, bio, graduation_year,
  major, minor, status, interests, availability_blocks, comfort_size, safety_preference,
  photo_color, completed_onboarding
) on public.profiles to authenticated;

revoke all on public.student_details from anon;
grant select, insert, update on public.student_details to authenticated;

alter table public.locations enable row level security;
create policy "Authenticated can view locations"
  on public.locations for select to authenticated using (true);
revoke all on public.locations from anon, authenticated;
grant select on public.locations to authenticated;

alter table public.activities enable row level security;
create policy "View approved own or reviewable activities"
  on public.activities for select to authenticated
  using (
    status = 'approved'
    or host_id = (select auth.uid())
    or public.is_safety_owner()
  );
create policy "Hosts create pending activities"
  on public.activities for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and status = 'pending'
    and source = 'user'
  );
revoke all on public.activities from anon, authenticated;
grant select on public.activities to authenticated;
-- status and source are omitted so the defaults stand and a host cannot self-approve.
grant insert (
  title, description, category, location_id, host_id, capacity, start_time,
  availability_block, comfort_size, safety_preference, university_id, cohort
) on public.activities to authenticated;

alter table public.rsvps enable row level security;
create policy "View rsvps for visible activities"
  on public.rsvps for select to authenticated
  using (public.can_view_activity(activity_id));
revoke all on public.rsvps from anon, authenticated;
-- Writes go through rsvp_activity / leave_activity so capacity stays authoritative.
grant select on public.rsvps to authenticated;

alter table public.messages enable row level security;
create policy "Participants read the thread"
  on public.messages for select to authenticated
  using (public.is_activity_participant(activity_id) or public.is_safety_owner());
create policy "Participants post to the thread"
  on public.messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not is_system
    and public.is_activity_participant(activity_id)
  );
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
-- flagged is omitted; the before-insert trigger is the only writer.
grant insert (activity_id, user_id, body) on public.messages to authenticated;

alter table public.safety_flags enable row level security;
create policy "Safety owners read flags"
  on public.safety_flags for select to authenticated
  using (public.is_safety_owner());
revoke all on public.safety_flags from anon, authenticated;
grant select on public.safety_flags to authenticated;

alter table public.safety_reports enable row level security;
create policy "Reporters and safety owners read reports"
  on public.safety_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_safety_owner());
create policy "Users file their own reports"
  on public.safety_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
revoke all on public.safety_reports from anon, authenticated;
grant select on public.safety_reports to authenticated;
grant insert (reporter_id, reported_user_id, context) on public.safety_reports to authenticated;

alter table public.pulses enable row level security;
create policy "Read own pulses"
  on public.pulses for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Log own pulses"
  on public.pulses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_activity_participant(activity_id)
  );
revoke all on public.pulses from anon, authenticated;
grant select on public.pulses to authenticated;
grant insert (activity_id, user_id, did_meet, rating) on public.pulses to authenticated;

alter table public.friend_connections enable row level security;
create policy "View connections on either side"
  on public.friend_connections for select to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
create policy "Create own connection requests"
  on public.friend_connections for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Recipient can accept"
  on public.friend_connections for update to authenticated
  using (friend_id = (select auth.uid()))
  with check (friend_id = (select auth.uid()));
revoke all on public.friend_connections from anon, authenticated;
grant select on public.friend_connections to authenticated;
grant insert (user_id, friend_id) on public.friend_connections to authenticated;
grant update (status) on public.friend_connections to authenticated;

-- No policies and no grants: only the definer-rights moderation functions may read this.
alter table public.safety_keywords enable row level security;
revoke all on public.safety_keywords from anon, authenticated;
