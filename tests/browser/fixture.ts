import { spawnSync } from "node:child_process"

export const FIXTURE_EMAIL = "notification-browser-fixture@umd.edu"
export const FIXTURE_PASSWORD = "Browser-fixture-password-2026!"
export const SECOND_FIXTURE_EMAIL = "notification-browser-friend@umd.edu"
export const SECOND_FIXTURE_USER_ID = "99100000-0000-4000-8000-000000000002"
export const DETAIL_ACTIVITY_ID = "99200000-0000-4000-8000-000000000001"
export const RSVP_ACTIVITY_ID = "99200000-0000-4000-8000-000000000002"
export const INELIGIBLE_ACTIVITY_ID = "99200000-0000-4000-8000-000000000003"
export const PAST_ACTIVITY_ID = "99200000-0000-4000-8000-000000000006"
export const PENDING_ACTIVITY_ID = "99200000-0000-4000-8000-000000000007"
export const SAFETY_REPORT_ID = "99400000-0000-4000-8000-000000000001"
export const SAFETY_FLAG_ID = "99400000-0000-4000-8000-000000000002"
export const FRIEND_CONNECTION_ID = "99500000-0000-4000-8000-000000000001"
export const FIXTURE_LOCATION_ID = "notification-browser-fixture"

export function runFixtureSql(sql: string): void {
  const result = spawnSync(
    "docker",
    [
      "exec", "-i", "supabase_db_huddle-notifications",
      "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-q", "-f", "-",
    ],
    { input: sql, encoding: "utf8", windowsHide: true },
  )

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Could not prepare browser fixtures")
  }
}

export function cleanupFixtureSql(): void {
  runFixtureSql(`
    delete from public.safety_flags
    where id = '${SAFETY_FLAG_ID}';
    delete from public.safety_reports
    where id = '${SAFETY_REPORT_ID}';
    delete from public.messages
    where activity_id in (
      select id from public.activities where location_id = '${FIXTURE_LOCATION_ID}'
    );
    delete from public.pulses
    where activity_id in (
      select id from public.activities where location_id = '${FIXTURE_LOCATION_ID}'
    );
    delete from public.rsvps
    where activity_id in (
      select id from public.activities where location_id = '${FIXTURE_LOCATION_ID}'
    );
    delete from public.friend_connections
    where user_id = '${SECOND_FIXTURE_USER_ID}'
       or friend_id = '${SECOND_FIXTURE_USER_ID}'
       or user_id in (select id from auth.users where email = '${FIXTURE_EMAIL}')
       or friend_id in (select id from auth.users where email = '${FIXTURE_EMAIL}');
    delete from public.activities where location_id = '${FIXTURE_LOCATION_ID}';
    delete from auth.users where email in ('${FIXTURE_EMAIL}', '${SECOND_FIXTURE_EMAIL}');
    delete from public.locations where id = '${FIXTURE_LOCATION_ID}';
  `)
}
