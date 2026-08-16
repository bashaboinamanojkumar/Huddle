import { describe, expect, it } from "vitest"
import {
  CHAT_MESSAGE_COLUMNS,
  CHAT_PAGE_SIZE,
  CHAT_PREVIEW_MESSAGE_LIMIT,
  CORE_TABLES,
  PROFILE_COLUMNS,
  SAFETY_QUEUE_LIMIT,
} from "@/lib/supabase/query-contracts"
import {
  fetchActivityById,
  fetchActivityMessagePage,
  fetchChatPreviews,
  fetchCoreHuddleSnapshot,
  fetchProfileById,
  fetchSafetyReviewQueue,
} from "@/lib/supabase/queries"
import type { HuddleBrowserClient } from "@/lib/supabase/client"
import type {
  ActivityRow,
  FriendConnectionRow,
  LocationRow,
  MessageRow,
  PublicProfile,
  RsvpRow,
  SafetyFlagRow,
  SafetyReportRow,
} from "@/lib/types/database"

interface RecordedCall {
  table: string
  select: string | null
  filters: Array<[string, string, unknown]>
  orders: Array<[string, boolean]>
  limit: number | null
}

interface RecordedRpc {
  name: string
}

type DataSet = Record<string, unknown[]>

function profileRow(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: "user-1",
    first_name: "Ada",
    last_name: "",
    last_initial: "L",
    display_name: "Ada L.",
    username: null,
    avatar_url: null,
    bio: null,
    graduation_year: null,
    major: null,
    minor: null,
    is_verified: false,
    status: "masters",
    interests: ["study", "coffee"],
    availability_blocks: ["weekday_evening"],
    comfort_size: "medium",
    safety_preference: "none",
    photo_color: "#d05b47",
    points: 12,
    streak_days: 3,
    meetups_this_week: 1,
    completed_onboarding: true,
    university_id: "umd",
    cohort: "umd-pilot",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

function locationRow(overrides: Partial<LocationRow> = {}): LocationRow {
  return {
    id: "location-1",
    university_id: "umd",
    name: "Testudo Plaza",
    area: "College Park",
    safety_note: "Meet in the staffed public area.",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

function activityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "activity-1",
    title: "Coffee for new Terps",
    description: "Public meetup",
    category: "coffee",
    location_id: "location-1",
    host_id: "user-1",
    external_id: null,
    external_url: null,
    capacity: 4,
    start_time: "2026-08-17T12:00:00.000Z",
    availability_block: "weekday_afternoon",
    source: "user",
    status: "approved",
    university_id: "umd",
    cohort: "umd-pilot",
    comfort_size: "medium",
    safety_preference: "none",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

function rsvpRow(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    activity_id: "activity-1",
    user_id: "user-1",
    status: "going",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

function friendRow(overrides: Partial<FriendConnectionRow> = {}): FriendConnectionRow {
  return {
    id: "friend-1",
    user_id: "user-1",
    friend_id: "user-2",
    status: "accepted",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

export function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "message-1",
    activity_id: "activity-1",
    user_id: "user-1",
    is_system: false,
    body: "See you there",
    flagged: false,
    created_at: "2026-08-16T11:00:00.000Z",
    ...overrides,
  }
}

function safetyFlagRow(overrides: Partial<SafetyFlagRow> = {}): SafetyFlagRow {
  return {
    id: "flag-1",
    type: "chat",
    ref_id: "message-1",
    reason: "Needs review",
    status: "open",
    reviewer: null,
    created_at: "2026-08-16T11:00:00.000Z",
    resolved_at: null,
    ...overrides,
  }
}

function safetyReportRow(overrides: Partial<SafetyReportRow> = {}): SafetyReportRow {
  return {
    id: "report-1",
    reporter_id: "user-1",
    reported_user_id: "user-2",
    context: "Please review this interaction",
    status: "open",
    created_at: "2026-08-16T11:00:00.000Z",
    ...overrides,
  }
}

const defaultSeed: DataSet = {
  profiles: [profileRow(), profileRow({ id: "user-2", display_name: "Grace H." })],
  locations: [locationRow()],
  activities: [activityRow()],
  rsvps: [rsvpRow()],
  friend_connections: [friendRow()],
  student_details: [{ profile_id: "user-1", gender: "non_binary" }],
}

class RecordingQuery implements PromiseLike<{ data: unknown; error: null }> {
  constructor(
    private readonly call: RecordedCall,
    private readonly dataSets: DataSet,
  ) {}

  select(columns: string): this {
    this.call.select = columns
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push(["eq", column, value])
    return this
  }

  gte(column: string, value: unknown): this {
    this.call.filters.push(["gte", column, value])
    return this
  }

  in(column: string, value: unknown[]): this {
    this.call.filters.push(["in", column, value])
    return this
  }

  or(filters: string): this {
    this.call.filters.push(["or", filters, null])
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.call.orders.push([column, options?.ascending ?? true])
    return this
  }

  limit(value: number): this {
    this.call.limit = value
    return this
  }

  maybeSingle(): Promise<{ data: unknown; error: null }> {
    return Promise.resolve({
      data: this.dataSets[this.call.table]?.[0] ?? null,
      error: null,
    })
  }

  single(): Promise<{ data: unknown; error: null }> {
    return this.maybeSingle()
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({
      data: this.dataSets[this.call.table] ?? [],
      error: null,
    }).then(onfulfilled, onrejected)
  }
}

function recordingClient(seed: DataSet = defaultSeed): {
  client: HuddleBrowserClient
  calls: RecordedCall[]
  rpcs: RecordedRpc[]
} {
  const dataSets = Object.fromEntries(
    Object.entries(seed).map(([table, rows]) => [table, [...rows]]),
  )
  const calls: RecordedCall[] = []
  const rpcs: RecordedRpc[] = []
  const client = {
    from(table: string) {
      const call: RecordedCall = {
        table,
        select: null,
        filters: [],
        orders: [],
        limit: null,
      }
      calls.push(call)
      return new RecordingQuery(call, dataSets)
    },
    async rpc(name: string) {
      rpcs.push({ name })
      if (name === "ensure_profile") {
        const created = profileRow()
        dataSets.profiles = [created]
        return { data: created, error: null }
      }
      return { data: null, error: null }
    },
  } as unknown as HuddleBrowserClient

  return { client, calls, rpcs }
}

function findCall(calls: RecordedCall[], table: string): RecordedCall {
  const call = calls.find((candidate) => candidate.table === table)
  if (!call) throw new Error(`No query recorded for ${table}`)
  return call
}

describe("fetchCoreHuddleSnapshot", () => {
  it("uses no more than six approved table requests", async () => {
    const { client, calls, rpcs } = recordingClient()
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
    const { client, calls } = recordingClient()
    await fetchCoreHuddleSnapshot(
      client,
      "user-1",
      "umd",
      new Date("2026-08-16T12:00:00.000Z"),
    )

    expect(findCall(calls, "locations").filters)
      .toContainEqual(["eq", "university_id", "umd"])
    expect(findCall(calls, "activities").filters).toEqual(expect.arrayContaining([
      ["eq", "university_id", "umd"],
      ["eq", "status", "approved"],
      ["gte", "start_time", "2026-08-16T12:00:00.000Z"],
    ]))
    expect(findCall(calls, "rsvps").filters)
      .toContainEqual(["in", "activity_id", ["activity-1"]])
    expect(findCall(calls, "friend_connections").filters)
      .toContainEqual(["or", "user_id.eq.user-1,friend_id.eq.user-1", null])
  })

  it("calls ensure_profile once only when the viewer profile is absent", async () => {
    const { client, rpcs } = recordingClient({ ...defaultSeed, profiles: [] })
    const snapshot = await fetchCoreHuddleSnapshot(client, "user-1", "umd")

    expect(rpcs).toEqual([{ name: "ensure_profile" }])
    expect(snapshot.profiles.some(({ userId }) => userId === "user-1")).toBe(true)
  })

  it("never requests messages, moderation rows, or pulses during core load", async () => {
    const { client, calls } = recordingClient()
    await fetchCoreHuddleSnapshot(client, "user-1", "umd")

    expect(calls.map(({ table }) => table)).not.toEqual(expect.arrayContaining([
      "messages",
      "safety_flags",
      "safety_reports",
      "pulses",
    ]))
  })
})

describe("feature-owned Supabase loaders", () => {
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
      [
        "or",
        "created_at.lt.2026-08-16T12:00:00.000Z,and(created_at.eq.2026-08-16T12:00:00.000Z,id.lt.message-9)",
        null,
      ],
    ]))
    expect(call.orders).toEqual([["created_at", false], ["id", false]])
    expect(call.limit).toBe(CHAT_PAGE_SIZE + 1)
    expect(page.items).toHaveLength(1)
  })

  it("bounds chat previews to visible unique chat activities", async () => {
    const { client, calls } = recordingClient({ messages: [messageRow()] })
    await fetchChatPreviews(client, ["activity-1", "activity-1", "activity-2"])

    const call = findCall(calls, "messages")
    expect(call.select).toBe(CHAT_MESSAGE_COLUMNS)
    expect(call.filters).toContainEqual([
      "in",
      "activity_id",
      ["activity-1", "activity-2"],
    ])
    expect(call.limit).toBe(CHAT_PREVIEW_MESSAGE_LIMIT)
  })

  it("loads only open bounded moderation rows", async () => {
    const { client, calls } = recordingClient({
      activities: [activityRow({ status: "pending" })],
      safety_flags: [safetyFlagRow()],
      safety_reports: [safetyReportRow()],
    })
    const queue = await fetchSafetyReviewQueue(client)

    expect(calls.map(({ table }) => table)).toEqual([
      "activities",
      "safety_flags",
      "safety_reports",
    ])
    expect(findCall(calls, "activities").filters)
      .toContainEqual(["eq", "status", "pending"])
    expect(findCall(calls, "safety_flags").filters)
      .toContainEqual(["eq", "status", "open"])
    expect(findCall(calls, "safety_reports").filters)
      .toContainEqual(["eq", "status", "open"])
    for (const call of calls) expect(call.limit).toBe(SAFETY_QUEUE_LIMIT)
    expect(queue).toMatchObject({
      pendingActivities: [{ id: "activity-1" }],
      flags: [{ id: "flag-1" }],
      reports: [{ id: "report-1" }],
    })
  })

  it("loads an out-of-window activity without expanding core", async () => {
    const { client, calls } = recordingClient({ activities: [activityRow()] })
    const activity = await fetchActivityById(client, "activity-1")

    expect(calls).toHaveLength(1)
    expect(calls[0].filters).toContainEqual(["eq", "id", "activity-1"])
    expect(activity?.id).toBe("activity-1")
  })

  it("loads a mapped public profile with the protected projection", async () => {
    const { client, calls } = recordingClient({ profiles: [profileRow()] })
    const profile = await fetchProfileById(client, "user-1")

    expect(calls).toHaveLength(1)
    expect(calls[0].select).toBe(PROFILE_COLUMNS)
    expect(calls[0].filters).toContainEqual(["eq", "id", "user-1"])
    expect(profile).toMatchObject({ userId: "user-1", displayName: "Ada L." })
    expect(profile).not.toHaveProperty("email")
    expect(profile?.gender).toBeUndefined()
  })
})
