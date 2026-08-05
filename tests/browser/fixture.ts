import { spawnSync } from "node:child_process"

export const FIXTURE_EMAIL = "notification-browser-fixture@umd.edu"
export const FIXTURE_PASSWORD = "Browser-fixture-password-2026!"
export const DETAIL_ACTIVITY_ID = "99200000-0000-4000-8000-000000000001"
export const RSVP_ACTIVITY_ID = "99200000-0000-4000-8000-000000000002"
export const INELIGIBLE_ACTIVITY_ID = "99200000-0000-4000-8000-000000000003"
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
    delete from auth.users where email = '${FIXTURE_EMAIL}';
    delete from public.locations where id = '${FIXTURE_LOCATION_ID}';
  `)
}
