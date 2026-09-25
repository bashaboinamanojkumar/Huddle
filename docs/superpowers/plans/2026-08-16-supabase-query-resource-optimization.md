# Supabase Query and Resource Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every Huddle feature while reducing routine Supabase boot/refresh work, eliminating generic post-mutation reloads, bounding feature queries, and preventing idle notification jobs from consuming database and Edge Function resources.

**Architecture:** Keep `HuddleState` and `HuddleProvider` as the compatibility boundary, but replace the ten-read snapshot with a staged six-request core loader and feature-owned loaders for chat, safety review, pulse, and out-of-window activity detail. Add one backward-compatible migration that supplies the exact indexes used by those predicates, exits Push recovery before Vault/network work when nothing is due, and gives scheduled producers runtime and non-overlap guards. Apply the database commit before the application commits during release.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Supabase JS/PostgREST, PostgreSQL, pg_cron, pg_net, Vitest, pgTAP, Playwright.

---

## Scope and sequencing

This stays one coordinated plan because the migration's indexes must match the final client predicates and the final browser evidence must measure both sides together. The work still has independent checkpoints:

1. Query contracts and database guards are backward-compatible and independently testable.
2. Core query slicing is independently testable before route-owned data is moved.
3. Feature loaders preserve chat, safety, pulse, and detail behavior without returning those datasets to boot.
4. Mutation reconciliation removes generic refreshes only after the focused state helpers are covered.
5. Browser and operations evidence is captured only after all prior checkpoints pass.

Do not apply migrations to production, deploy Vercel, push the branch, or change Supabase settings as part of this plan.

## File structure

### Create

- `lib/supabase/query-contracts.ts` — named projections, page sizes, cursors, and the canonical list of core tables.
- `lib/store/huddle-state.ts` — pure, immutable merge/remove helpers for focused mutation and feature reconciliation.
- `tests/supabase/query-contracts.test.ts` — projection coverage and global browser-side wildcard prohibition.
- `tests/supabase/queries.test.ts` — recording-client tests for the core request budget, filters, fallback, pagination, and optional-loader isolation.
- `tests/store/huddle-state.test.ts` — exact state reconciliation behavior for every mutation slice.
- `tests/store/huddle-provider-source.test.ts` — source-level guard that no mutation callback calls generic `refresh()`.
- `supabase/migrations/20260816010000_query_resource_optimization.sql` — query indexes, no-work Push guard, producer runtime gates, and advisory locks.
- `supabase/tests/query_resource_optimization.test.sql` — pgTAP coverage for indexes, schedules, no-work/due dispatch, gates, locks, grants, and RLS invariants.
- `tests/browser/query-resource-optimization.spec.ts` — authenticated request-count and feature-isolation browser coverage.
- `docs/performance/2026-08-16-supabase-query-resource-evidence.md` — reproducible before/after counts, plans, and operations checklist.

### Modify

- `lib/supabase/queries.ts` — staged core loader and scoped feature loaders.
- `lib/supabase/mutations.ts` — explicit returning projections and useful mutation results.
- `lib/store/huddle-store.tsx` — preserve optional slices on core refresh, single-flight feature loads, and focused state reconciliation.
- `lib/notifications/api.ts` — explicit notification-preference projection.
- `app/app/chats/page.tsx` — load bounded chat previews only on the chat list.
- `app/app/chats/[id]/page.tsx` — cursor-paginated thread loading, retry, and older-message action.
- `app/app/admin/review/page.tsx` — authorized route-owned safety queue loading and retry.
- `app/app/activity/[id]/page.tsx` — focused activity-detail fallback when the activity is outside the core window.
- `app/app/activity/[id]/pulse/page.tsx` — focused activity fallback while keeping the owner-only response query local.
- `app/app/profile/[id]/page.tsx` — focused profile fallback when a linked friend is outside the campus core profile set.
- `tests/browser/fixture.ts` — deterministic IDs and SQL helpers for chat, moderation, friend, and activity fixtures.
- `tests/browser/global-setup.ts` — seed the additional backward-compatible browser fixtures.
- `tests/browser/global-teardown.ts` — delete all added fixture rows through the existing fixture cleanup path.

### Preserve unchanged

- Existing RLS policy intent, grants, role checks, auth providers, notification schedules, dedupe keys, quiet hours, caps, leases, retries, and cleanup cadence.
- The original dirty checkout at `C:\Users\manoj\files7\projects\hurdle`.

---

### Task 1: Lock down explicit query contracts

**Files:**
- Create: `lib/supabase/query-contracts.ts`
- Create: `tests/supabase/query-contracts.test.ts`
- Modify: `lib/supabase/queries.ts:30-38`
- Modify: `lib/notifications/api.ts:1-165`

- [ ] **Step 1: Write the failing projection contract test**

Create `tests/supabase/query-contracts.test.ts` with these assertions:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  ACTIVITY_COLUMNS,
  CHAT_MESSAGE_COLUMNS,
  CORE_TABLES,
  FRIEND_CONNECTION_COLUMNS,
  LOCATION_COLUMNS,
  NOTIFICATION_PREFERENCE_COLUMNS,
  PROFILE_COLUMNS,
  PULSE_RESPONSE_COLUMNS,
  RSVP_COLUMNS,
  SAFETY_FLAG_COLUMNS,
  SAFETY_REPORT_COLUMNS,
} from "@/lib/supabase/query-contracts"

const sourceFiles = ["lib/notifications/api.ts"]

describe("Supabase query contracts", () => {
  it("defines the exact six core datasets", () => {
    expect(CORE_TABLES).toEqual([
      "profiles",
      "locations",
      "activities",
      "rsvps",
      "friend_connections",
      "student_details",
    ])
  })

  it("uses named projections and never requests protected profile email", () => {
    for (const projection of [
      PROFILE_COLUMNS,
      LOCATION_COLUMNS,
      ACTIVITY_COLUMNS,
      RSVP_COLUMNS,
      FRIEND_CONNECTION_COLUMNS,
      CHAT_MESSAGE_COLUMNS,
      SAFETY_FLAG_COLUMNS,
      SAFETY_REPORT_COLUMNS,
      PULSE_RESPONSE_COLUMNS,
      NOTIFICATION_PREFERENCE_COLUMNS,
    ]) {
      expect(projection).not.toContain("*")
    }
    expect(PROFILE_COLUMNS.split(",").map((column) => column.trim()))
      .not.toContain("email")
  })

  it("contains no wildcard select in the notification query changed here", () => {
    for (const file of sourceFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8")
      expect(source, file).not.toMatch(/\.select\(["']\*["']\)/u)
    }
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\query-contracts.test.ts
```

Expected: FAIL because `lib/supabase/query-contracts.ts` does not exist and wildcard selects remain.

- [ ] **Step 3: Create the canonical projection module**

Create `lib/supabase/query-contracts.ts` with the exact mapper-required columns:

```ts
export const PROFILE_COLUMNS = [
  "id", "first_name", "last_name", "last_initial", "display_name", "username",
  "avatar_url", "bio", "graduation_year", "major", "minor", "is_verified",
  "status", "interests", "availability_blocks", "comfort_size", "safety_preference",
  "photo_color", "points", "streak_days", "meetups_this_week",
  "completed_onboarding", "university_id", "cohort", "created_at", "updated_at",
].join(",")

export const LOCATION_COLUMNS = "id,university_id,name,area,safety_note"
export const ACTIVITY_COLUMNS = [
  "id", "title", "description", "category", "location_id", "host_id",
  "external_id", "external_url", "capacity", "start_time", "availability_block",
  "source", "status", "university_id", "cohort", "comfort_size",
  "safety_preference", "created_at", "updated_at",
].join(",")
export const RSVP_COLUMNS = "activity_id,user_id,status,created_at,updated_at"
export const FRIEND_CONNECTION_COLUMNS = "id,user_id,friend_id,status,created_at"
export const CHAT_MESSAGE_COLUMNS =
  "id,activity_id,user_id,is_system,body,flagged,created_at"
export const SAFETY_FLAG_COLUMNS =
  "id,type,ref_id,reason,status,reviewer,created_at,resolved_at"
export const SAFETY_REPORT_COLUMNS =
  "id,reporter_id,reported_user_id,context,status,created_at"
export const PULSE_RESPONSE_COLUMNS =
  "id,activity_id,user_id,did_meet,rating,created_at"
export const NOTIFICATION_PREFERENCE_COLUMNS = [
  "user_id", "push_enabled", "chat_enabled", "activities_enabled",
  "reminders_enabled", "social_enabled", "safety_enabled", "digest_enabled",
  "rewards_enabled", "quiet_hours_start", "quiet_hours_end", "timezone",
  "daily_push_cap", "created_at", "updated_at",
].join(",")

export const CORE_TABLES = [
  "profiles",
  "locations",
  "activities",
  "rsvps",
  "friend_connections",
  "student_details",
] as const

export const CHAT_PAGE_SIZE = 50
export const CHAT_PREVIEW_ACTIVITY_LIMIT = 20
export const CHAT_PREVIEW_MESSAGE_LIMIT = 200
export const SAFETY_QUEUE_LIMIT = 100

export interface MessageCursor {
  createdAt: string
  id: string
}
```

Import these constants from `lib/supabase/queries.ts` and remove its local `PROFILE_COLUMNS` declaration.

- [ ] **Step 4: Replace the notification preference wildcard**

In `lib/notifications/api.ts`, import `NOTIFICATION_PREFERENCE_COLUMNS` and change `fetchNotificationPreferences` to:

```ts
export async function fetchNotificationPreferences(
  supabase: HuddleBrowserClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(NOTIFICATION_PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .single()
  throwOnError(error, "Could not load notification settings")
  return toNotificationPreferences(data as NotificationPreferenceRow)
}
```

- [ ] **Step 5: Run the focused projection test**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\query-contracts.test.ts
```

Expected: all assertions PASS. Tasks 2 and 5 expand the source scan only after their wildcard replacements are implemented, so this checkpoint remains green.

- [ ] **Step 6: Commit the contract checkpoint**

```powershell
git add lib/supabase/query-contracts.ts lib/supabase/queries.ts lib/notifications/api.ts tests/supabase/query-contracts.test.ts
git commit -m "test: define Supabase query contracts"
```

---

### Task 2: Replace the monolithic snapshot with a six-request core loader

**Files:**
- Create: `tests/supabase/queries.test.ts`
- Modify: `lib/supabase/queries.ts:40-143`
- Modify: `lib/store/huddle-store.tsx:17-291`

- [ ] **Step 1: Add a recording Supabase client inside the query test**

In `tests/supabase/queries.test.ts`, implement a deterministic thenable query recorder. Its recorded shape and seed data must be:

```ts
interface RecordedCall {
  table: string
  select: string | null
  filters: Array<[string, string, unknown]>
  orders: Array<[string, boolean]>
  limit: number | null
}

const seed = {
  profiles: [profileRow({ id: "user-1", university_id: "umd" })],
  locations: [locationRow({ id: "location-1", university_id: "umd" })],
  activities: [activityRow({ id: "activity-1", university_id: "umd" })],
  rsvps: [rsvpRow({ activity_id: "activity-1", user_id: "user-1" })],
  friend_connections: [],
  student_details: [{ profile_id: "user-1", gender: "non_binary" }],
}
```

The fake builder must record `.select`, `.eq`, `.gte`, `.in`, `.or`, `.order`, `.limit`, `.single`, and `.maybeSingle`, and resolve to `{ data: seed[table], error: null }`. Record RPC names separately so the test can count `ensure_profile` calls.

- [ ] **Step 2: Write failing request-budget and fallback tests**

Add these exact behavioral assertions:

```ts
describe("fetchCoreHuddleSnapshot", () => {
  it("uses no more than six approved table requests", async () => {
    const { client, calls, rpcs } = recordingClient(seed)
    const snapshot = await fetchCoreHuddleSnapshot(
      client,
      "user-1",
      "umd",
      new Date("2026-08-16T12:00:00.000Z"),
    )

    expect(calls).toHaveLength(6)
    expect(new Set(calls.map(({ table }) => table))).toEqual(new Set(CORE_TABLES))
    expect(rpcs).toEqual([])
    expect(snapshot).toMatchObject({ messages: [], flags: [], reports: [], pulses: [] })
  })

  it("scopes campus rows, visible activities, related RSVPs, and either-side friendships", async () => {
    const { client, calls } = recordingClient(seed)
    await fetchCoreHuddleSnapshot(
      client,
      "user-1",
      "umd",
      new Date("2026-08-16T12:00:00.000Z"),
    )

    expect(findCall(calls, "locations").filters).toContainEqual(["eq", "university_id", "umd"])
    expect(findCall(calls, "activities").filters).toEqual(expect.arrayContaining([
      ["eq", "university_id", "umd"],
      ["eq", "status", "approved"],
      ["gte", "start_time", "2026-08-16T12:00:00.000Z"],
    ]))
    expect(findCall(calls, "rsvps").filters).toContainEqual(["in", "activity_id", ["activity-1"]])
    expect(findCall(calls, "friend_connections").filters)
      .toContainEqual(["or", "user_id.eq.user-1,friend_id.eq.user-1", null])
  })

  it("calls ensure_profile once only when the viewer profile is absent", async () => {
    const missing = { ...seed, profiles: [] }
    const { client, rpcs } = recordingClient(missing)
    await fetchCoreHuddleSnapshot(client, "user-1", "umd")
    expect(rpcs).toEqual(["ensure_profile"])
  })

  it("never requests messages, moderation rows, or pulses during core load", async () => {
    const { client, calls } = recordingClient(seed)
    await fetchCoreHuddleSnapshot(client, "user-1", "umd")
    expect(calls.map(({ table }) => table)).not.toEqual(expect.arrayContaining([
      "messages", "safety_flags", "safety_reports", "pulses",
    ]))
  })
})
```

- [ ] **Step 3: Run the query tests and verify the old snapshot behavior fails**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\queries.test.ts
```

Expected: FAIL because `fetchCoreHuddleSnapshot` is not exported and the current snapshot still requests optional datasets.

- [ ] **Step 4: Implement the staged core loader**

Replace `HuddleSnapshot`/`fetchHuddleSnapshot` with `HuddleSnapshot` plus `fetchCoreHuddleSnapshot`. The function must use this dependency shape:

```ts
export async function fetchCoreHuddleSnapshot(
  supabase: HuddleBrowserClient,
  userId: string,
  universityId: UniversityId,
  now = new Date(),
): Promise<HuddleSnapshot> {
  const [locations, activities, friends, gender] = await Promise.all([
    supabase.from("locations").select(LOCATION_COLUMNS)
      .eq("university_id", universityId).order("name"),
    supabase.from("activities").select(ACTIVITY_COLUMNS)
      .eq("university_id", universityId).eq("status", "approved")
      .gte("start_time", now.toISOString()).order("start_time").order("id"),
    supabase.from("friend_connections").select(FRIEND_CONNECTION_COLUMNS)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    fetchOwnGender(supabase, userId),
  ])

  throwOnError(locations.error, "Could not load meet-points")
  throwOnError(activities.error, "Could not load activities")
  throwOnError(friends.error, "Could not load connections")

  const activityRows = (activities.data ?? []) as ActivityRow[]
  const friendRows = (friends.data ?? []) as FriendConnectionRow[]
  const relatedProfileIds = new Set([userId])
  for (const row of friendRows) {
    relatedProfileIds.add(row.user_id)
    relatedProfileIds.add(row.friend_id)
  }

  const profileFilter = [
    `university_id.eq.${universityId}`,
    `id.in.(${[...relatedProfileIds].join(",")})`,
  ].join(",")
  const profileQuery = supabase.from("profiles").select(PROFILE_COLUMNS).or(profileFilter)
  const rsvpQuery = activityRows.length === 0
    ? Promise.resolve({ data: [], error: null })
    : supabase.from("rsvps").select(RSVP_COLUMNS)
      .in("activity_id", activityRows.map(({ id }) => id))

  const [profiles, rsvps] = await Promise.all([profileQuery, rsvpQuery])
  throwOnError(profiles.error, "Could not load profiles")
  throwOnError(rsvps.error, "Could not load RSVPs")

  let profileRows = (profiles.data ?? []) as unknown as PublicProfile[]
  if (!profileRows.some(({ id }) => id === userId)) {
    await ensureProfile(supabase)
    const ownProfile = await fetchProfileRowById(supabase, userId)
    if (!ownProfile) throw new Error("Could not load your profile")
    profileRows = [...profileRows, ownProfile]
  }

  return {
    profiles: profileRows.map((row) =>
      toHuddleProfile(row, row.id === userId ? gender : undefined)),
    locations: (locations.data ?? []).map(toHuddleLocation),
    activities: activityRows.map(toHuddleActivity),
    rsvps: (rsvps.data ?? []).map(toHuddleRsvp),
    friends: friendRows.map(toFriendConnection),
    messages: [],
    flags: [],
    reports: [],
    pulses: [],
  }
}
```

Add a private `fetchProfileRowById` using `PROFILE_COLUMNS`, `.eq("id", userId)`, and `.maybeSingle()`; it returns `PublicProfile | null` for the missing-profile fallback. Task 3 adds the mapped public `fetchProfileById` route loader. Import `ActivityRow`, `FriendConnectionRow`, `UniversityId`, and the query constants. Do not use a wildcard or add a seventh normal-path request.

- [ ] **Step 5: Wire initial load and refresh without erasing optional slices**

In `lib/store/huddle-store.tsx`:

1. Replace the `ensureProfile`/`fetchHuddleSnapshot` import with `fetchCoreHuddleSnapshot`.
2. Remove the unconditional `await ensureProfile(supabase)` from `load`.
3. Pass `universityFor(email)` to the core loader.
4. On refresh, merge only core keys so chat/safety data survives:

```ts
setState((previous) => ({
  ...previous,
  profiles: snapshot.profiles,
  locations: snapshot.locations,
  activities: snapshot.activities,
  rsvps: snapshot.rsvps,
  friends: snapshot.friends,
  session: previous.session,
}))
```

Keep `refreshFlight`, generation checks, session retry behavior, and the existing thirty-second lifecycle throttle unchanged.

- [ ] **Step 6: Run the focused query and refresh tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\queries.test.ts tests\store\single-flight.test.ts tests\app\app-refresh-main.test.ts
```

Expected: all selected files PASS; the normal fixture records at most six table calls and zero RPCs.

- [ ] **Step 7: Commit the core loader**

```powershell
git add lib/supabase/queries.ts lib/store/huddle-store.tsx tests/supabase/queries.test.ts
git commit -m "perf: slice Supabase core loading"
```

---

### Task 3: Add bounded feature-owned query loaders

**Files:**
- Modify: `lib/supabase/queries.ts:145-187`
- Modify: `tests/supabase/queries.test.ts`

- [ ] **Step 1: Write failing scoped-loader tests**

Extend `tests/supabase/queries.test.ts` to prove:

```ts
it("paginates one chat thread by created_at and id", async () => {
  const { client, calls } = recordingClient({ messages: [messageRow()] })
  const page = await fetchActivityMessagePage(client, "activity-1", {
    createdAt: "2026-08-16T12:00:00.000Z",
    id: "message-9",
  })

  const call = findCall(calls, "messages")
  expect(call.select).toBe(CHAT_MESSAGE_COLUMNS)
  expect(call.filters).toEqual(expect.arrayContaining([
    ["eq", "activity_id", "activity-1"],
    ["or", "created_at.lt.2026-08-16T12:00:00.000Z,and(created_at.eq.2026-08-16T12:00:00.000Z,id.lt.message-9)", null],
  ]))
  expect(call.orders).toEqual([["created_at", false], ["id", false]])
  expect(call.limit).toBe(CHAT_PAGE_SIZE + 1)
  expect(page.items).toHaveLength(1)
})

it("bounds chat previews to visible chat activities", async () => {
  const { client, calls } = recordingClient({ messages: [messageRow()] })
  await fetchChatPreviews(client, ["activity-1", "activity-2"])
  const call = findCall(calls, "messages")
  expect(call.filters).toContainEqual(["in", "activity_id", ["activity-1", "activity-2"]])
  expect(call.limit).toBe(CHAT_PREVIEW_MESSAGE_LIMIT)
})

it("loads only open bounded moderation rows", async () => {
  const { client, calls } = recordingClient({
    activities: [], safety_flags: [], safety_reports: [],
  })
  await fetchSafetyReviewQueue(client)
  expect(calls.map(({ table }) => table)).toEqual([
    "activities", "safety_flags", "safety_reports",
  ])
  for (const call of calls) expect(call.limit).toBe(SAFETY_QUEUE_LIMIT)
})

it("loads an out-of-window activity without expanding core", async () => {
  const { client, calls } = recordingClient({ activities: [activityRow()] })
  await fetchActivityById(client, "activity-1")
  expect(calls).toHaveLength(1)
  expect(calls[0].filters).toContainEqual(["eq", "id", "activity-1"])
})
```

- [ ] **Step 2: Run the loader tests and verify they fail**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\queries.test.ts
```

Expected: FAIL because the new loader exports and pagination result types do not exist.

- [ ] **Step 3: Implement message keyset pagination**

Replace `fetchActivityMessages` with:

```ts
export interface MessagePage {
  items: ChatMessage[]
  nextCursor: MessageCursor | null
}

export async function fetchActivityMessagePage(
  supabase: HuddleBrowserClient,
  activityId: string,
  cursor: MessageCursor | null = null,
  pageSize = CHAT_PAGE_SIZE,
): Promise<MessagePage> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > CHAT_PAGE_SIZE) {
    throw new RangeError(`Message page size must be between 1 and ${CHAT_PAGE_SIZE}`)
  }

  let query = supabase.from("messages").select(CHAT_MESSAGE_COLUMNS)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  throwOnError(error, "Could not load messages")
  const rows = (data ?? []) as MessageRow[]
  const hasMore = rows.length > pageSize
  const visible = rows.slice(0, pageSize)
  const oldest = visible.at(-1)
  return {
    items: visible.map(toChatMessage).reverse(),
    nextCursor: hasMore && oldest
      ? { createdAt: oldest.created_at, id: oldest.id }
      : null,
  }
}
```

Update `fetchMessageById` and `fetchOwnPulseResponse` to use `CHAT_MESSAGE_COLUMNS` and `PULSE_RESPONSE_COLUMNS`.

- [ ] **Step 4: Implement bounded preview, safety, activity, and profile loaders**

Add:

```ts
export async function fetchChatPreviews(
  supabase: HuddleBrowserClient,
  activityIds: string[],
): Promise<ChatMessage[]> {
  const ids = [...new Set(activityIds)].slice(0, CHAT_PREVIEW_ACTIVITY_LIMIT)
  if (ids.length === 0) return []
  const { data, error } = await supabase.from("messages")
    .select(CHAT_MESSAGE_COLUMNS).in("activity_id", ids)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(CHAT_PREVIEW_MESSAGE_LIMIT)
  throwOnError(error, "Could not load chat previews")
  return (data ?? []).map(toChatMessage)
}

export interface SafetyReviewQueue {
  pendingActivities: HuddleActivity[]
  flags: SafetyFlag[]
  reports: SafetyReport[]
}

export async function fetchSafetyReviewQueue(
  supabase: HuddleBrowserClient,
): Promise<SafetyReviewQueue> {
  const [activities, flags, reports] = await Promise.all([
    supabase.from("activities").select(ACTIVITY_COLUMNS).eq("status", "pending")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
    supabase.from("safety_flags").select(SAFETY_FLAG_COLUMNS).eq("status", "open")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
    supabase.from("safety_reports").select(SAFETY_REPORT_COLUMNS).eq("status", "open")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
  ])
  throwOnError(activities.error, "Could not load pending activities")
  throwOnError(flags.error, "Could not load safety flags")
  throwOnError(reports.error, "Could not load safety reports")
  return {
    pendingActivities: (activities.data ?? []).map(toHuddleActivity),
    flags: (flags.data ?? []).map(toSafetyFlag),
    reports: (reports.data ?? []).map(toSafetyReport),
  }
}
```

Also add `fetchActivityById` and a public `fetchProfileById`; each uses its named projection, `.eq("id", id)`, `.maybeSingle()`, and its existing mapper/error context. `fetchProfileById` maps the returned `PublicProfile` with `toHuddleProfile` and never exposes email or another user's gender.

- [ ] **Step 5: Run the query suite**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\supabase\queries.test.ts tests\supabase\query-contracts.test.ts tests\pulses\page.test.tsx
```

Expected: all selected tests PASS. Extend the source list in `query-contracts.test.ts` to include `lib/supabase/queries.ts` at this checkpoint and confirm it has no wildcard select.

- [ ] **Step 6: Commit the feature query layer**

```powershell
git add lib/supabase/queries.ts tests/supabase/queries.test.ts
git commit -m "perf: add bounded Supabase feature loaders"
```

---

### Task 4: Wire route-owned feature loading with isolated retry state

**Files:**
- Modify: `lib/store/huddle-store.tsx:85-624`
- Modify: `lib/store/single-flight.ts`
- Modify: `app/app/chats/page.tsx:1-71`
- Modify: `app/app/chats/[id]/page.tsx:1-230`
- Modify: `app/app/admin/review/page.tsx:1-157`
- Modify: `app/app/activity/[id]/page.tsx`
- Modify: `app/app/activity/[id]/pulse/page.tsx:162-232`
- Modify: `app/app/profile/[id]/page.tsx:33-90`
- Modify: `tests/supabase/queries.test.ts`

- [ ] **Step 1: Add failing single-flight feature-load assertions**

Test a provider-independent helper built from `createSingleFlight`:

```ts
it("shares concurrent loads per feature key and retries after failure", async () => {
  const flights = createFeatureFlights<string>()
  const operation = vi.fn(async () => "loaded")
  const first = flights.run("chat:activity-1", operation)
  const second = flights.run("chat:activity-1", operation)
  await expect(Promise.all([first, second])).resolves.toEqual(["loaded", "loaded"])
  expect(operation).toHaveBeenCalledTimes(1)

  await expect(flights.run("safety", async () => {
    throw new Error("offline")
  })).rejects.toThrow("offline")
  await expect(flights.run("safety", async () => "retry")).resolves.toBe("retry")
})
```

Implement `createFeatureFlights` in `lib/store/single-flight.ts` as a keyed map of existing `createSingleFlight` instances; `reset()` must detach and clear every key on sign-out/session replacement.

- [ ] **Step 2: Run the test and verify the keyed helper is missing**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\store\single-flight.test.ts
```

Expected: FAIL because `createFeatureFlights` is not exported.

- [ ] **Step 3: Expose focused loaders from `HuddleContextValue`**

Add these exact contracts:

```ts
interface FeatureLoadResult {
  status: "ready"
}

interface HuddleContextValue {
  // retain every existing member
  loadChatPreviews(activityIds: string[]): Promise<FeatureLoadResult>
  loadActivityMessages(activityId: string, cursor?: MessageCursor | null): Promise<MessageCursor | null>
  loadSafetyReview(): Promise<FeatureLoadResult>
  loadActivity(activityId: string): Promise<HuddleActivity | null>
  loadProfile(profileId: string): Promise<HuddleProfile | null>
}
```

Use one `featureFlights` ref. Each loader must call the matching query function, merge only its slice with a functional `setState`, and leave all current state untouched on rejection. Reset the keyed flights in `load` before a session replacement and in `clearLocalSession`.

For message pages, merge by message ID and sort ascending; when `cursor` is null replace only that activity's loaded message slice, and for older pages prepend deduplicated rows. Realtime inserts continue to merge by ID.

- [ ] **Step 4: Load previews only on the chat list**

In `app/app/chats/page.tsx`, add local `idle/loading/ready/error` state and call `loadChatPreviews(chatActivities.map(({ id }) => id))` in an effect keyed by a stable joined ID string. Render the existing fallback preview while loading, keep the existing list on error, and render a `Retry chat previews` button that increments a local retry token.

Use:

```ts
const chatActivityKey = chatActivities.map(({ id }) => id).join(",")
useEffect(() => {
  if (!chatActivityKey) return
  let active = true
  setPreviewStatus("loading")
  void loadChatPreviews(chatActivityKey.split(","))
    .then(() => { if (active) setPreviewStatus("ready") })
    .catch(() => { if (active) setPreviewStatus("error") })
  return () => { active = false }
}, [chatActivityKey, loadChatPreviews, retryToken])
```

- [ ] **Step 5: Load and paginate one chat thread**

In `app/app/chats/[id]/page.tsx`:

- Load the activity with `loadActivity(params.id)` if it is missing from `activities`.
- Load the newest page with `loadActivityMessages(params.id, null)` after the activity becomes available.
- Store `nextCursor`, `loading`, and `error` locally.
- Add a `Load earlier messages` button above the message list when `nextCursor` is non-null.
- Keep send, report, leave, archive, realtime, and message-ID deduplication behavior unchanged.
- On failure, retain already loaded messages and render `Retry messages`.

- [ ] **Step 6: Load moderation data only inside the authorized admin page**

In `app/app/admin/review/page.tsx`, call `loadSafetyReview()` in an effect. The server `app/app/admin/layout.tsx` remains the authorization gate and is not weakened. Render loading, error with `Retry review queue`, and ready states. Continue reading `pendingActivities`, `state.flags`, and `state.reports` from the provider after the focused merge.

- [ ] **Step 7: Add activity/profile detail fallbacks**

For `app/app/activity/[id]/page.tsx`, `app/app/activity/[id]/pulse/page.tsx`, and `app/app/profile/[id]/page.tsx`, call `loadActivity`/`loadProfile` only when the requested entity is absent after hydration. Preserve the current not-found screen only after the focused request returns `null`; render a loading state before that decision. Pulse response fetching remains in the pulse page and stays owner-scoped.

- [ ] **Step 8: Run focused route and store tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\store\single-flight.test.ts tests\pulses\page.test.tsx tests\pulses\model.test.ts tests\auth\admin.test.ts
```

Expected: all selected tests PASS. A simulated optional-loader failure must not change the core snapshot.

- [ ] **Step 9: Commit route-owned loading**

```powershell
git add lib/store/single-flight.ts lib/store/huddle-store.tsx app/app/chats/page.tsx app/app/chats/[id]/page.tsx app/app/admin/review/page.tsx app/app/activity/[id]/page.tsx app/app/activity/[id]/pulse/page.tsx app/app/profile/[id]/page.tsx tests/store/single-flight.test.ts
git commit -m "perf: load Supabase feature data on demand"
```

---

### Task 5: Replace post-mutation core reloads with focused reconciliation

**Files:**
- Create: `lib/store/huddle-state.ts`
- Create: `tests/store/huddle-state.test.ts`
- Create: `tests/store/huddle-provider-source.test.ts`
- Modify: `lib/supabase/mutations.ts:1-340`
- Modify: `lib/store/huddle-store.tsx:400-554`

- [ ] **Step 1: Write failing pure state reconciliation tests**

Create fixtures for one profile, activity, RSVP, message, flag, report, and friend connection, then assert:

```ts
describe("focused Huddle state reconciliation", () => {
  it("replaces records by stable key without duplicating them", () => {
    expect(mergeProfiles(state, changedProfile).profiles).toEqual([changedProfile])
    expect(mergeActivities(state, changedActivity).activities).toEqual([changedActivity])
    expect(mergeMessages(state, changedMessage).messages).toEqual([changedMessage])
    expect(mergeFlags(state, changedFlag).flags).toEqual([changedFlag])
    expect(mergeFriends(state, changedFriend).friends).toEqual([changedFriend])
  })

  it("adds or removes only the selected user's RSVP", () => {
    expect(mergeRsvp(state, changedRsvp).rsvps).toContainEqual(changedRsvp)
    expect(removeRsvp(state, changedRsvp.activityId, changedRsvp.userId).rsvps)
      .not.toContainEqual(expect.objectContaining({
        activityId: changedRsvp.activityId,
        userId: changedRsvp.userId,
      }))
  })

  it("removes one connection without touching unrelated connections", () => {
    const next = removeFriend(state, "connection-1")
    expect(next.friends.map(({ id }) => id)).toEqual(["connection-2"])
  })
})
```

Create `tests/store/huddle-provider-source.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Huddle mutation resource budget", () => {
  it("does not invoke generic refresh from mutation callbacks", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/store/huddle-store.tsx"),
      "utf8",
    )
    const mutationSection = source.slice(
      source.indexOf("const completeOnboarding"),
      source.indexOf("const value = useMemo"),
    )
    expect(mutationSection).not.toContain("await refresh()")
  })
})
```

- [ ] **Step 2: Run the tests and verify the current full refreshes fail**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\store\huddle-state.test.ts tests\store\huddle-provider-source.test.ts
```

Expected: FAIL because the helper module is absent and the provider contains multiple `await refresh()` calls.

- [ ] **Step 3: Implement immutable keyed helpers**

Create `lib/store/huddle-state.ts` with a generic private `upsertBy` and exported helpers:

```ts
function upsertBy<T>(items: T[], item: T, key: (value: T) => string): T[] {
  const itemKey = key(item)
  const index = items.findIndex((value) => key(value) === itemKey)
  if (index < 0) return [...items, item]
  const next = [...items]
  next[index] = item
  return next
}

export const mergeProfiles = (state: HuddleState, profile: HuddleProfile): HuddleState => ({
  ...state, profiles: upsertBy(state.profiles, profile, ({ userId }) => userId),
})
export const mergeActivities = (state: HuddleState, activity: HuddleActivity): HuddleState => ({
  ...state, activities: upsertBy(state.activities, activity, ({ id }) => id),
})
export const mergeRsvp = (state: HuddleState, rsvp: HuddleRsvp): HuddleState => ({
  ...state,
  rsvps: upsertBy(state.rsvps, rsvp, ({ activityId, userId }) => `${activityId}:${userId}`),
})
export const removeRsvp = (
  state: HuddleState, activityId: string, userId: string,
): HuddleState => ({
  ...state,
  rsvps: state.rsvps.filter((item) =>
    item.activityId !== activityId || item.userId !== userId),
})
export const mergeMessages = (state: HuddleState, message: ChatMessage): HuddleState => ({
  ...state, messages: upsertBy(state.messages, message, ({ id }) => id),
})
export const mergeFlags = (state: HuddleState, flag: SafetyFlag): HuddleState => ({
  ...state, flags: upsertBy(state.flags, flag, ({ id }) => id),
})
export const mergeReports = (state: HuddleState, report: SafetyReport): HuddleState => ({
  ...state, reports: upsertBy(state.reports, report, ({ id }) => id),
})
export const mergeFriends = (state: HuddleState, friend: FriendConnection): HuddleState => ({
  ...state, friends: upsertBy(state.friends, friend, ({ id }) => id),
})
export const removeFriend = (state: HuddleState, connectionId: string): HuddleState => ({
  ...state, friends: state.friends.filter(({ id }) => id !== connectionId),
})
```

- [ ] **Step 4: Return explicit rows from mutations**

Use projection constants in every returning clause. Change these contracts:

- `updateProfile` and `completeOnboarding` return `Promise<HuddleProfile>`; a non-empty profile patch uses `.select(PROFILE_COLUMNS).single()` and passes the saved/unchanged gender to `toHuddleProfile`. A gender-only update performs `saveGender`, then one focused `fetchProfileById` read and attaches the saved gender.
- `createActivity` uses `.select(ACTIVITY_COLUMNS)`.
- `sendMessage` uses `.select(CHAT_MESSAGE_COLUMNS)`.
- `reportSafetyConcern` uses `.select(SAFETY_REPORT_COLUMNS)`.
- `addFriend` uses `.select(FRIEND_CONNECTION_COLUMNS)`.
- `resolveFlag` maps the RPC return with `toSafetyFlag` and returns `Promise<SafetyFlag>`.
- `reviewActivity` maps the RPC return with `toHuddleActivity` and returns `Promise<HuddleActivity>`.
- `acceptFriend` uses `.select(FRIEND_CONNECTION_COLUMNS).single()` and returns `Promise<FriendConnection>`.
- `declineFriend` chains `.delete().eq("id", connectionId).select(FRIEND_CONNECTION_COLUMNS).single()` and returns the deleted connection.
- `unfriend` returns the affected friend ID supplied by the caller after successful RPC completion.

No browser-side query or returning clause may use `select("*")`. Extend `sourceFiles` in `tests/supabase/query-contracts.test.ts` to include `lib/supabase/queries.ts` and `lib/supabase/mutations.ts` now that both files have explicit projections.

- [ ] **Step 5: Reconcile each provider mutation locally**

Replace every generic refresh in the mutation section with a functional update:

- onboarding/profile: `setState((current) => mergeProfiles(current, profile))`;
- RSVP going/waitlisted: merge `{ activityId, userId, status: outcome, timestamp: new Date().toISOString() }`; on `full`, leave state unchanged;
- leave: `removeRsvp`;
- create: `mergeActivities`;
- report: merge only into reports for an authorized viewer; ordinary users may omit the local report because it is not rendered;
- resolve/review: merge returned flag/activity;
- add/accept: merge returned connection;
- decline: remove returned connection ID;
- unfriend: find the either-side connection and remove it;
- message: retain the existing ID-deduplicated merge.

If an RPC returns too little to reconcile a trigger result, call at most one matching focused loader. Do not call `refresh()`.

- [ ] **Step 6: Run mutation, state, and wildcard tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\store\huddle-state.test.ts tests\store\huddle-provider-source.test.ts tests\supabase\query-contracts.test.ts tests\supabase\mappers.test.ts
```

Expected: all selected tests PASS; the source scan finds zero wildcard selects and the provider mutation section contains zero generic refreshes.

- [ ] **Step 7: Commit focused mutation reconciliation**

```powershell
git add lib/store/huddle-state.ts lib/store/huddle-store.tsx lib/supabase/mutations.ts tests/store/huddle-state.test.ts tests/store/huddle-provider-source.test.ts
git commit -m "perf: reconcile Huddle mutations by slice"
```

---

### Task 6: Add backward-compatible database resource guards and query indexes

**Files:**
- Create: `supabase/migrations/20260816010000_query_resource_optimization.sql`
- Create: `supabase/tests/query_resource_optimization.test.sql`

- [ ] **Step 1: Start/reset local Supabase and record the pre-migration index/schedule state**

Run:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset
```

Expected: local services become healthy and every existing migration applies. If Docker is unavailable, record that as a blocker and do not claim database verification.

Record read-only baselines:

```powershell
docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -c "select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('activities','messages','safety_reports','friend_connections') order by tablename,indexname;"
docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -c "select jobname,schedule,command from cron.job where jobname like 'huddle-%' order by jobname;"
```

- [ ] **Step 2: Write the failing database resource contract**

Create `supabase/tests/query_resource_optimization.test.sql` before the migration:

```sql
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
select like(
  pg_get_functiondef('public.request_push_dispatch()'::regprocedure),
  '%no_work%',
  'Push recovery has an explicit no-work exit'
);
select like(
  pg_get_functiondef('public.produce_event_reminders(timestamptz)'::regprocedure),
  '%pg_try_advisory_xact_lock%',
  'event reminders have a non-overlap guard'
);
select is(
  (select count(*)::integer from cron.job where jobname like 'huddle-%'),
  6,
  'all six Huddle schedules remain installed'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run the database contract and verify the pre-migration failure**

Run:

```powershell
pnpm exec supabase test db
```

Expected: FAIL on the two missing indexes, the missing gate function, and the missing no-work/advisory-lock function text while the existing schedule-count assertion passes.

- [ ] **Step 4: Create only indexes mapped to final predicates**

Add:

```sql
create index if not exists activities_university_approved_start_idx
  on public.activities (university_id, start_time, id)
  where status = 'approved';

create index if not exists safety_reports_open_created_idx
  on public.safety_reports (created_at desc, id desc)
  where status = 'open';
```

Mapping:

- `activities_university_approved_start_idx` serves the core equality filter on `university_id`, the constant partial predicate `status='approved'`, and the `start_time` range/order.
- `safety_reports_open_created_idx` serves the authorized moderation loader's open-only newest-first bounded queue.
- Do not add friend, RSVP, message, flag, or pulse indexes: the unique/primary, `friend_connections_friend_id_idx`, `rsvps_activity_going_idx`, `messages_activity_created_idx`, `safety_flags_open_idx`, and pulse primary key already cover their predicates closely enough to avoid duplicate write/storage cost.

- [ ] **Step 5: Add a shared producer gate**

Create a locked-down helper:

```sql
create or replace function public.notification_producers_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select config.notification_core_enabled
    from public.notification_runtime_config config
    where config.id
  ), false);
$$;

revoke execute on function public.notification_producers_enabled()
  from public, anon, authenticated;
grant execute on function public.notification_producers_enabled() to service_role;
```

- [ ] **Step 6: Replace `request_push_dispatch` with early no-work exits**

Copy the current function body into the new migration, but place these guards before either Vault lookup:

```sql
if not exists (
  select 1
  from public.notification_runtime_config config
  where config.id
    and config.notification_core_enabled
    and config.push_enabled
    and config.push_rollout_percentage > 0
) then
  return pg_catalog.jsonb_build_object('status', 'disabled');
end if;

if not exists (
  select 1
  from public.notification_deliveries delivery
  join public.push_subscriptions subscription
    on subscription.id = delivery.subscription_id
  where delivery.state in ('pending', 'deferred')
    and delivery.deliver_after <= now()
    and subscription.disabled_at is null
) then
  return pg_catalog.jsonb_build_object('status', 'no_work');
end if;
```

Retain the current configuration validation, five-second timeout, secret-safe exception handling, trigger behavior, one-minute cron schedule, grants, and function signature.

- [ ] **Step 7: Guard every scheduled producer against disabled and overlapping work**

Redefine the four functions from `20260804100100_scheduled_notification_producers.sql`. Keep their candidate queries, dedupe keys, copy, counters, and return types unchanged. Insert this exact sequence after argument/time validation and before the first source-table scan:

```sql
if not public.notification_producers_enabled() then
  result.skipped := result.skipped + 1;
  return result;
end if;

if not pg_catalog.pg_try_advisory_xact_lock(
  pg_catalog.hashtextextended('huddle:producer:event-reminders', 0)
) then
  result.skipped := result.skipped + 1;
  return result;
end if;
```

Use the event-reminder block exactly as shown. Duplicate that guard in the other three function bodies with these exact lock names:

- `huddle:producer:event-reminders`
- `huddle:producer:pulse-prompts`
- `huddle:producer:activity-match-digests`
- `huddle:producer:weekly-recaps`

For activity-match and weekly-recap producers, retain their local hour/day checks before acquiring the lock so off-schedule hourly invocations perform neither scans nor lock work.

- [ ] **Step 8: Apply the migration locally, rerun the contract, and inspect query plans**

Run:

```powershell
pnpm exec supabase db reset
pnpm exec supabase test db
```

Then run read-only plans with representative fixture constants:

```powershell
docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -c "explain (analyze,buffers) select id,title,start_time from public.activities where university_id='umd' and status='approved' and start_time >= now() order by start_time,id;"
docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -c "explain (analyze,buffers) select id,created_at from public.safety_reports where status='open' order by created_at desc,id desc limit 100;"
```

Expected: migrations apply cleanly and the six-assertion resource contract turns green. On tiny fixtures PostgreSQL may still choose a sequential scan; record that honestly. The indexes must exist and match the predicates even if the small-table cost model does not select them.

- [ ] **Step 9: Commit the migration and its red-green contract**

```powershell
git add supabase/migrations/20260816010000_query_resource_optimization.sql supabase/tests/query_resource_optimization.test.sql
git commit -m "perf: guard idle Supabase background work"
```

---

### Task 7: Prove database guards, schedules, security, and index uniqueness with pgTAP

**Files:**
- Modify: `supabase/tests/query_resource_optimization.test.sql`
- Modify only if an existing assertion's expected operational status legitimately changed: `supabase/tests/notification_core.test.sql:3959-3963`

- [ ] **Step 1: Expand the red-green resource contract into the full pgTAP suite**

Replace the six-assertion file from Task 6 with an 18-assertion suite that begins with these exact assertions and then covers the dynamic checks listed below:

```sql
begin;
select plan(18);

select has_index(
  'public', 'activities', 'activities_university_approved_start_idx',
  'core campus activity query has one supporting partial index'
);
select has_index(
  'public', 'safety_reports', 'safety_reports_open_created_idx',
  'open moderation reports have one supporting partial index'
);

select results_eq(
  $$
    select indexname, count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'activities_university_approved_start_idx',
        'safety_reports_open_created_idx'
      )
    group by indexname order by indexname
  $$,
  $$values
    ('activities_university_approved_start_idx'::name, 1),
    ('safety_reports_open_created_idx'::name, 1)$$,
  'optimization indexes are singular under migration replay'
);

select results_eq(
  $$select jobname, schedule, command from cron.job
    where jobname in (
      'huddle-notification-delivery-retry', 'huddle-notification-cleanup',
      'huddle-event-reminders', 'huddle-pulse-prompts',
      'huddle-activity-match-digests', 'huddle-weekly-recaps'
    ) order by jobname$$,
  $$values
    ('huddle-activity-match-digests'::text, '0 * * * *'::text, 'select public.produce_activity_match_digests();'::text),
    ('huddle-event-reminders'::text, '*/5 * * * *'::text, 'select public.produce_event_reminders();'::text),
    ('huddle-notification-cleanup'::text, '20 8 * * *'::text, 'select public.cleanup_notification_data();'::text),
    ('huddle-notification-delivery-retry'::text, '* * * * *'::text, 'select public.request_push_dispatch();'::text),
    ('huddle-pulse-prompts'::text, '*/15 * * * *'::text, 'select public.produce_pulse_prompts();'::text),
    ('huddle-weekly-recaps'::text, '0 * * * *'::text, 'select public.produce_weekly_recaps();'::text)$$,
  'all required schedules and cadences are unchanged'
);
```

The remaining assertions must:

1. Set rollout/config off and expect `request_push_dispatch()->>'status' = 'disabled'` with no new row in `net._http_request`.
2. Enable runtime with valid test Vault secrets but no due delivery and expect `no_work` with no new HTTP row.
3. Insert one due eligible delivery and expect `queued` with exactly one new HTTP row.
4. Disable notification core, call each producer at an otherwise eligible time, and expect `(0,0,0,1,0)`.
5. Use `pg_get_functiondef` to assert each producer contains `pg_try_advisory_xact_lock` and its unique lock name.
6. Use `strpos(pg_get_functiondef(...), ...)` to prove the runtime/no-work guard appears before `vault.decrypted_secrets` in dispatch and before each producer's first source-table scan.
7. Assert helper/producer execute grants remain absent for `anon`/`authenticated` and present only where currently intended for `service_role`.
8. Assert all optimized functions remain `SECURITY DEFINER` with `search_path=""`, and RLS remains enabled on every current application and notification table.

End with `select * from finish(); rollback;`.

- [ ] **Step 2: Run the expanded pgTAP suite**

Run:

```powershell
pnpm exec supabase test db
```

Expected: the expanded suite PASSes. If a dynamic no-work, due-work, grant, RLS, or schedule assertion fails, fix only the corresponding migration behavior and rerun this file before continuing.

- [ ] **Step 3: Run the full database suite with the migration**

Run:

```powershell
pnpm exec supabase db reset
pnpm exec supabase test db
```

Expected: `notification_core.test.sql`, `notification_producers.test.sql`, and `query_resource_optimization.test.sql` all PASS. Existing dedupe, caps, quiet hours, leases, retries, cleanup, and RLS assertions remain green.

- [ ] **Step 4: Prove a concurrent producer invocation exits without scanning**

Use two local PostgreSQL sessions: one holds the event-reminder advisory lock, and the other calls the producer.

```powershell
$lockSql = "begin; select pg_advisory_xact_lock(hashtextextended('huddle:producer:event-reminders',0)); select pg_sleep(5); commit;"
$lockJob = Start-Job -ScriptBlock {
  param($sql)
  docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c $sql
} -ArgumentList $lockSql
Start-Sleep -Seconds 1
$producerResult = docker exec supabase_db_huddle-notifications psql -U postgres -d postgres -At -F "|" -c "select (public.produce_event_reminders(now())).*;"
Wait-Job $lockJob | Out-Null
Receive-Job $lockJob | Out-Null
Remove-Job $lockJob
if ($producerResult.Trim() -ne "0|0|0|1|0") {
  throw "Concurrent producer did not return the expected skipped result: $producerResult"
}
```

Expected: the second session returns `0|0|0|1|0` promptly while the first session still owns the lock, proving the producer skipped before its candidate scan.

- [ ] **Step 5: Replay the migration and prove idempotent singular objects**

Run the migration SQL a second time against local Postgres, then rerun the new test:

```powershell
Get-Content supabase\migrations\20260816010000_query_resource_optimization.sql | docker exec -i supabase_db_huddle-notifications psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm exec supabase test db
```

Expected: PASS with exactly one copy of each index, function signature, trigger, and cron job.

- [ ] **Step 6: Commit database verification**

```powershell
git add supabase/tests/query_resource_optimization.test.sql supabase/tests/notification_core.test.sql
git commit -m "test: verify Supabase resource guards"
```

---

### Task 8: Add authenticated browser request budgets and feature-parity flows

**Files:**
- Modify: `tests/browser/fixture.ts`
- Modify: `tests/browser/global-setup.ts`
- Modify: `tests/browser/global-teardown.ts`
- Create: `tests/browser/query-resource-optimization.spec.ts`

- [ ] **Step 1: Extend local-only fixtures**

Add deterministic IDs for:

- second student profile and accepted friend connection;
- two chat messages in `DETAIL_ACTIVITY_ID`;
- one past approved activity and going RSVP for pulse/detail fallback;
- one pending activity, open safety report, and open safety flag;
- a safety-owner role on the existing browser fixture user.

Keep `runFixtureSql` restricted to the local Docker database and extend `cleanupFixtureSql` so auth-user cascade plus explicit location cleanup removes every fixture. Do not add production credentials or external URLs.

- [ ] **Step 2: Write the failing boot and refresh budget test**

Create a helper that records `/rest/v1/{table}` and `/rest/v1/rpc/{function}` requests after sign-in. Assert:

```ts
expect(coreRequests).toHaveLength(6)
expect(new Set(coreRequests.map(({ table }) => table))).toEqual(new Set([
  "profiles", "locations", "activities", "rsvps",
  "friend_connections", "student_details",
]))
expect(optionalRequests).toEqual([])
expect(ensureProfileRequests).toBe(0)
expect(allRestRequests.some(({ url }) => new URL(url).searchParams.get("select") === "*"))
  .toBe(false)
```

Also collect `response.headers()["content-length"]` when present and `performance.getEntriesByType("resource")` transfer/encoded body sizes. Record a value only when the browser exposes it; label unavailable byte counts as unavailable rather than zero.

Trigger one valid pull-to-refresh and assert the same bounds. Keep the existing repeated-pull single-flight assertion.

- [ ] **Step 3: Write feature-owned request assertions**

In separate serial tests:

- `/app/chats` issues bounded message preview work only after navigating there.
- `/app/chats/{activityId}` loads only that activity's messages, sends one message, and realtime/state reconciliation does not start a core reload.
- `/app/admin/review` issues safety queries only after the authorized layout permits navigation; resolving a flag and reviewing an activity do not start a core reload.
- a past activity/pulse deep link performs focused activity and owner pulse queries without expanding core.
- RSVP, leave, activity creation, friend accept/decline/unfriend, notification inbox/settings, and profile update continue to work without a generic refresh.

For each mutation, snapshot the core request counter before the action and assert it is unchanged after the server confirms success.

- [ ] **Step 4: Run the browser spec and observe the red state before final wiring**

Run:

```powershell
pnpm exec playwright test tests/browser/query-resource-optimization.spec.ts --project=chromium
```

Expected before Tasks 2-5 are present: FAIL on request budgets or missing loader states. Expected after integration: PASS.

- [ ] **Step 5: Run the existing browser suites that cover refresh, notifications, and mobile shell**

Run:

```powershell
pnpm exec playwright test tests/browser/app-refresh.spec.ts tests/browser/notifications.spec.ts tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: all selected tests PASS with no feature regression.

- [ ] **Step 6: Commit browser coverage**

```powershell
git add tests/browser/fixture.ts tests/browser/global-setup.ts tests/browser/global-teardown.ts tests/browser/query-resource-optimization.spec.ts
git commit -m "test: measure Supabase browser request budgets"
```

---

### Task 9: Capture evidence and run the complete verification gate

**Files:**
- Create: `docs/performance/2026-08-16-supabase-query-resource-evidence.md`

- [ ] **Step 1: Record reproducible before/after evidence**

Create the evidence document with:

```markdown
# Supabase query and resource evidence

## Revisions
- Baseline: `09bfaa1`
- Optimized: run `git rev-parse HEAD` after the final implementation commit and record that exact hash.

## Browser request counts
| Flow | Baseline core calls | Optimized core calls | Optional calls at boot | Wildcard selects |
|---|---:|---:|---:|---:|
| Initial authenticated load | 10 | 6 or fewer | 0 | 0 |
| Pull-to-refresh | 10 | 6 or fewer | 0 | 0 |

## Mutation counts
Record each action as one write plus zero or one focused reconciliation read and zero core reloads.

## Database evidence
Paste local index definitions, pgTAP totals, and `EXPLAIN (ANALYZE, BUFFERS)` output. State when fixture size causes a sequential scan.

## Production release checklist
- Deploy the backward-compatible migration first.
- Confirm cron names/cadences and no-work job history.
- Confirm API/Auth health and Edge invocation counts.
- Deploy the application build.
- Run authenticated production smoke tests.
- Monitor CPU, RAM, disk I/O, connections, API latency, cron history, and Edge invocations.
```

Record only actual command/browser evidence. Do not invent production metrics.

- [ ] **Step 2: Run all unit tests with the direct binary**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run
```

Expected: every Vitest file passes with zero failed tests.

- [ ] **Step 3: Run typecheck, lint, and production build**

Run independently so each result is attributable:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\next.cmd build
```

Expected: each command exits 0. Report pre-existing warnings separately; do not call a nonzero result clean.

- [ ] **Step 4: Run database and browser suites**

Run:

```powershell
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec playwright test --project=chromium
```

Expected: all migrations, pgTAP tests, and Playwright tests pass. If local Docker/browser infrastructure blocks a suite, report it as untested rather than passed.

- [ ] **Step 5: Run static resource-budget guards**

Run:

```powershell
rg -n "\.select\((\"|')\*(\"|')\)" app components lib -g "*.ts" -g "*.tsx"
rg -n "await refresh\(\)" lib/store/huddle-store.tsx
git diff origin/main...HEAD --check
git status --short --branch
```

Expected:

- wildcard search returns no matches;
- any remaining `await refresh()` is only the public manual/lifecycle refresh path, never a mutation callback;
- diff check exits 0;
- branch contains only intended committed work.

- [ ] **Step 6: Review the final diff against every design requirement**

Confirm line by line:

- every user-facing feature and security boundary remains present;
- normal boot/refresh uses at most six core requests;
- established profiles skip `ensure_profile`;
- chat/safety/pulse are absent from boot;
- optional loaders are scoped, bounded, retryable, and single-flight;
- mutation callbacks use local/focused reconciliation;
- no browser query uses a wildcard projection;
- idle Push recovery performs no Vault lookup or HTTP request;
- producer gates/locks preserve schedules and results;
- indexes map to actual predicates without duplicates;
- database-first rollout and forward-only rollback instructions remain accurate.

- [ ] **Step 7: Commit evidence and request code review**

```powershell
git add docs/performance/2026-08-16-supabase-query-resource-evidence.md
git commit -m "docs: record Supabase optimization evidence"
```

Then invoke `superpowers:requesting-code-review`. Address validated findings with new focused tests and commits. Do not squash or deploy without the user's separate direction.
