import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import fixtures from "../tests/fixtures/activity-match-scores.json" with { type: "json" }
import { scoreFit } from "../lib/scoring/score-fit.ts"

const config = readFileSync(new globalThis.URL("../supabase/config.toml", import.meta.url), "utf8")
const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/mu)?.[1]

if (!projectId) throw new Error("supabase/config.toml does not define a safe project_id.")

const databaseContainer = `supabase_db_${projectId}`

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlEnumArray(values, type) {
  if (values.length === 0) return `array[]::public.${type}[]`
  return `array[${values.map(sqlLiteral).join(",")}]::public.${type}[]`
}

function runSql(sql, context) {
  const result = spawnSync(
    "docker",
    [
      "exec", "-i", databaseContainer,
      "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-qAt", "-F", "|", "-f", "-",
    ],
    { encoding: "utf8", input: sql, windowsHide: true },
  )

  if (result.status !== 0) {
    const diagnostic = result.stderr.trim().split(/\r?\n/u).slice(-3).join(" ")
    throw new Error(`${context}: ${diagnostic || "local psql command failed"}`)
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
}

for (const [index, fixture] of fixtures.entries()) {
  const userId = `99000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
  const activityId = `99100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
  const browserScore = scoreFit(fixture.profile, fixture.activity)

  if (browserScore.total !== fixture.expected.total) {
    throw new Error(
      `${fixture.name}: TypeScript returned ${browserScore.total}; expected ${fixture.expected.total}`,
    )
  }

  const sql = `
    begin;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      ${sqlLiteral(userId)},
      'authenticated', 'authenticated',
      ${sqlLiteral(`score-parity-${index}@umd.edu`)}, '', now(),
      '{}'::jsonb, '{"full_name":"Score Parity"}'::jsonb, now(), now()
    );

    update public.profiles
    set interests = ${sqlEnumArray(fixture.profile.interests, "category")},
        availability_blocks = ${sqlEnumArray(fixture.profile.availabilityBlocks, "availability_block")},
        comfort_size = ${sqlLiteral(fixture.profile.comfortSize)}::public.comfort_size,
        safety_preference = ${sqlLiteral(fixture.profile.safetyPreference)}::public.safety_preference,
        university_id = ${sqlLiteral(fixture.profile.universityId)}
    where id = ${sqlLiteral(userId)};

    insert into public.locations (id, university_id, name, area, safety_note)
    values (
      'activity-score-parity-fixture', 'umd', 'Score parity fixture',
      'Local database', 'Rollback-only automated fixture.'
    );

    insert into public.activities (
      id, title, description, category, location_id, host_id, capacity,
      start_time, availability_block, source, status, university_id,
      comfort_size, safety_preference
    ) values (
      ${sqlLiteral(activityId)},
      ${sqlLiteral(`Parity: ${fixture.name}`)},
      'Local SQL and TypeScript score parity fixture.',
      ${sqlLiteral(fixture.activity.category)}::public.category,
      'activity-score-parity-fixture',
      ${sqlLiteral(userId)},
      6,
      now() + interval '30 days',
      ${sqlLiteral(fixture.activity.availabilityBlock)}::public.availability_block,
      'seeded',
      ${sqlLiteral(fixture.activity.status)}::public.activity_status,
      ${sqlLiteral(fixture.activity.universityId)},
      ${sqlLiteral(fixture.activity.comfortSize)}::public.comfort_size,
      ${sqlLiteral(fixture.activity.safetyPreference)}::public.safety_preference
    );

    ${fixture.activity.joined ? `
      insert into public.rsvps (activity_id, user_id, status)
      values (${sqlLiteral(activityId)}, ${sqlLiteral(userId)}, 'going');
    ` : ""}

    select (public.activity_match_score(
        ${sqlLiteral(userId)}, ${sqlLiteral(activityId)}
      )).total::text || '|' ||
      (public.activity_match_score(
        ${sqlLiteral(userId)}, ${sqlLiteral(activityId)}
      )).eligible::text || '|' ||
      score_at.eligible::text || '|' ||
      (profile.university_id = activity.university_id)::text || '|' ||
      (activity.status = 'approved')::text || '|' ||
      (activity.start_time > now())::text || '|' ||
      exists (
        select 1 from public.rsvps r
        where r.activity_id = activity.id
          and r.user_id = profile.id
          and r.status in ('going', 'waitlisted')
      )::text || '|' ||
      (
        activity.safety_preference = 'women_only'
        and profile.safety_preference <> 'women_only'
      )::text
    from public.activity_match_score_at(
      ${sqlLiteral(userId)}, ${sqlLiteral(activityId)}, now()
    ) score_at
    cross join public.profiles profile
    cross join public.activities activity
    where profile.id = ${sqlLiteral(userId)}
      and activity.id = ${sqlLiteral(activityId)};

    rollback;
  `

  const result = runSql(sql, `score ${fixture.name}`)
  const [
    sqlTotal,
    sqlEligible,
    directEligible,
    sameUniversity,
    approved,
    future,
    joined,
    safetyBlocked,
  ] = result.split("|")
  const actual = {
    total: Number(sqlTotal),
    eligible: sqlEligible === "true" || sqlEligible === "t",
  }

  if (
    actual.total !== fixture.expected.total ||
    actual.eligible !== fixture.expected.eligible
  ) {
    throw new Error(
      `${fixture.name}: SQL returned ${JSON.stringify(actual)}; expected ${JSON.stringify(fixture.expected)}; ` +
      `eligibility predicates=${JSON.stringify({ directEligible, sameUniversity, approved, future, joined, safetyBlocked })}`,
    )
  }

  globalThis.console.log(`PASS ${fixture.name}: score=${actual.total}, eligible=${actual.eligible}`)
}

globalThis.console.log(`All ${fixtures.length} activity match score fixtures agree.`)
