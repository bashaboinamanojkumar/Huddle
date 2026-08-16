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
