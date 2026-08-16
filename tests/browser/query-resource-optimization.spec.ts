import { expect, test, type Page } from "@playwright/test"
import {
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_PASSWORD,
  FRIEND_CONNECTION_ID,
  PAST_ACTIVITY_ID,
  RSVP_ACTIVITY_ID,
  SECOND_FIXTURE_USER_ID,
  runFixtureSql,
} from "./fixture"

const CORE_TABLES = [
  "profiles",
  "locations",
  "activities",
  "rsvps",
  "friend_connections",
  "student_details",
] as const
const OPTIONAL_TABLES = ["messages", "safety_flags", "safety_reports", "pulses"]

interface RestRequest {
  table: string
  rpc: boolean
  method: string
  url: string
  contentLength: number | null
}

test.describe.configure({ mode: "serial" })
test.use({ serviceWorkers: "block" })

function recordRestRequests(page: Page): RestRequest[] {
  const requests: RestRequest[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/rest\/v1\/(rpc\/)?([^/]+)$/u)
    if (!match) return
    requests.push({
      table: match[2],
      rpc: Boolean(match[1]),
      method: request.method(),
      url: request.url(),
      contentLength: null,
    })
  })
  page.on("response", (response) => {
    const recorded = [...requests].reverse().find((request) =>
      request.url === response.url()
        && request.method === response.request().method()
        && request.contentLength === null
    )
    if (!recorded) return
    const value = response.headers()["content-length"]
    recorded.contentLength = value && Number.isFinite(Number(value)) ? Number(value) : null
  })
  return requests
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/verify")
  await page.getByLabel("Campus email").fill(FIXTURE_EMAIL)
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/app(?:$|\/)/u)
  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
}

function coreRequests(requests: RestRequest[]): RestRequest[] {
  return requests.filter((request) =>
    !request.rpc
      && request.method === "GET"
      && CORE_TABLES.includes(request.table as (typeof CORE_TABLES)[number])
  )
}

function expectNoWildcardSelect(requests: RestRequest[]): void {
  expect(requests.some(({ url }) => new URL(url).searchParams.get("select") === "*"))
    .toBe(false)
}

async function dispatchPull(page: Page): Promise<void> {
  const mainBox = await page.locator("main.authenticated-main").boundingBox()
  if (!mainBox) throw new Error("Authenticated main has no rendered box")
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  })
  const x = Math.round(mainBox.x + mainBox.width / 2)
  const y = Math.round(mainBox.y + Math.min(120, mainBox.height / 3))
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + 180, id: 1 }],
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await client.detach()
}

async function attachRequestEvidence(page: Page, requests: RestRequest[]): Promise<void> {
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/rest/v1/"))
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming
        return {
          name: resource.name,
          transferSize: resource.transferSize || null,
          encodedBodySize: resource.encodedBodySize || null,
        }
      })
  )
  await test.info().attach("supabase-request-budget.json", {
    body: JSON.stringify({ requests, resources }, null, 2),
    contentType: "application/json",
  })
}

test("authenticated boot and pull refresh stay inside the six-request core budget", async ({ page }) => {
  const requests = recordRestRequests(page)
  await signIn(page)
  await expect.poll(() => coreRequests(requests).length).toBe(6)
  await page.waitForTimeout(300)

  const bootCore = coreRequests(requests)
  expect(bootCore).toHaveLength(6)
  expect(new Set(bootCore.map(({ table }) => table))).toEqual(new Set(CORE_TABLES))
  expect(requests.filter(({ table }) => OPTIONAL_TABLES.includes(table))).toEqual([])
  expect(requests.filter(({ rpc, table }) => rpc && table === "ensure_profile")).toEqual([])
  expectNoWildcardSelect(requests)

  requests.length = 0
  const authenticatedMain = page.locator("main.authenticated-main")
  await authenticatedMain.evaluate((element) => { element.scrollTop = 0 })
  await dispatchPull(page)
  await expect(authenticatedMain).toHaveAttribute("data-refresh-phase", "idle")
  await expect.poll(() => coreRequests(requests).length).toBe(6)
  await page.waitForTimeout(300)

  const refreshCore = coreRequests(requests)
  expect(refreshCore).toHaveLength(6)
  expect(new Set(refreshCore.map(({ table }) => table))).toEqual(new Set(CORE_TABLES))
  expect(requests.filter(({ table }) => OPTIONAL_TABLES.includes(table))).toEqual([])
  expect(requests.filter(({ rpc, table }) => rpc && table === "ensure_profile")).toEqual([])
  expectNoWildcardSelect(requests)
  await attachRequestEvidence(page, requests)
})

test("chat preview, thread pagination, send, and realtime reconciliation stay scoped", async ({ page }) => {
  const requests = recordRestRequests(page)
  await signIn(page)
  requests.length = 0

  await page.goto("/app/chats")
  await expect(page.getByRole("heading", { name: "Group chats" })).toBeVisible()
  await expect.poll(() => requests.filter(({ table }) => table === "messages").length).toBe(1)
  const preview = requests.find(({ table }) => table === "messages")!
  expect(new URL(preview.url).searchParams.get("activity_id")).toContain("in.")
  expect(new URL(preview.url).searchParams.get("limit")).toBe("200")

  requests.length = 0
  await page.goto(`/app/chats/${DETAIL_ACTIVITY_ID}`)
  await expect(page.getByText("Browser fixture logistics", { exact: true })).toBeVisible()
  await expect.poll(() => requests.filter(({ table }) => table === "messages").length).toBe(1)
  const thread = requests.find(({ table }) => table === "messages")!
  expect(new URL(thread.url).searchParams.get("activity_id")).toBe(`eq.${DETAIL_ACTIVITY_ID}`)
  expect(new URL(thread.url).searchParams.get("limit")).toBe("51")

  const beforeCore = coreRequests(requests).length
  const sendResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/messages")
      && response.request().method() === "POST"
  )
  await page.getByPlaceholder("Message the group").fill("Scoped browser message")
  await page.getByRole("button", { name: "Send message" }).click()
  await sendResponse
  await expect(page.getByText("Scoped browser message", { exact: true })).toHaveCount(1)
  await page.waitForTimeout(300)
  expect(coreRequests(requests)).toHaveLength(beforeCore)
  expectNoWildcardSelect(requests)
})

test("authorized safety review loads and reconciles only moderation slices", async ({ page }) => {
  const requests = recordRestRequests(page)
  await signIn(page)

  await page.getByRole("link", { name: "Open profile" }).click()
  const reviewLink = page.getByRole("link", { name: "Safety review queue" })
  await expect(reviewLink).toBeVisible()
  requests.length = 0
  await reviewLink.click()
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible()
  await expect(page.getByText("Browser Pending Review", { exact: true })).toBeVisible()
  await expect.poll(() =>
    requests.filter(({ table }) => ["activities", "safety_flags", "safety_reports"].includes(table)).length
  ).toBe(3)
  const moderationRequests = requests.filter(({ table }) =>
    ["activities", "safety_flags", "safety_reports"].includes(table)
  )
  expect(new Set(moderationRequests.map(({ table }) => table))).toEqual(new Set([
    "activities",
    "safety_flags",
    "safety_reports",
  ]))
  for (const request of moderationRequests) {
    expect(new URL(request.url).searchParams.get("limit")).toBe("100")
  }

  const coreBeforeFlag = coreRequests(requests).length
  const flagCard = page.getByText("Browser message flag", { exact: true }).locator("..")
  const resolveResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/resolve_flag")
      && response.request().method() === "POST"
  )
  await flagCard.getByRole("button", { name: "Warn" }).click()
  await resolveResponse
  await expect(page.getByText("Browser message flag", { exact: true })).toHaveCount(0)
  expect(coreRequests(requests)).toHaveLength(coreBeforeFlag)

  const activityCard = page.getByText("Browser Pending Review", { exact: true }).locator("..")
  const reviewResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/review_activity")
      && response.request().method() === "POST"
  )
  await activityCard.getByRole("button", { name: "Approve" }).click()
  await reviewResponse
  await expect(page.getByText("Browser Pending Review", { exact: true })).toHaveCount(0)
  expect(coreRequests(requests)).toHaveLength(coreBeforeFlag)
})

test("past pulse, RSVP, activity creation, and friendship mutations avoid core reloads", async ({ page }) => {
  const requests = recordRestRequests(page)
  await signIn(page)
  requests.length = 0

  await page.goto(`/app/activity/${PAST_ACTIVITY_ID}/pulse`)
  await expect(page.getByRole("heading", { name: "Browser Past Huddle" })).toBeVisible()
  await expect.poll(() => requests.filter(({ table }) => table === "pulses").length).toBe(1)
  expect(requests.filter(({ table, url }) =>
    table === "activities"
      && new URL(url).searchParams.get("id") === `eq.${PAST_ACTIVITY_ID}`
  )).toHaveLength(1)
  expect(requests.filter(({ table, url }) =>
    table === "rsvps"
      && new URL(url).searchParams.get("activity_id") === `eq.${PAST_ACTIVITY_ID}`
  )).toHaveLength(1)
  const pulseCore = coreRequests(requests).length
  const pulseResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/submit_pulse_response")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Yes" }).click()
  await page.getByRole("button", { name: "Submit response" }).click()
  await pulseResponse
  await expect(page.getByText("Your response is saved and cannot be edited.", { exact: true })).toBeVisible()
  expect(coreRequests(requests)).toHaveLength(pulseCore)

  await page.goto(`/app/activity/${RSVP_ACTIVITY_ID}`)
  await expect(page.getByRole("heading", { name: "Browser RSVP Huddle" })).toBeVisible()
  requests.length = 0
  const rsvpResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/rsvp_activity")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: /Huddle up|Join waitlist/u }).click()
  await rsvpResponse
  await expect(page.getByRole("button", { name: /Leave|Leave waitlist/u })).toBeVisible()
  expect(coreRequests(requests)).toEqual([])

  const leaveResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/leave_activity")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: /Leave|Leave waitlist/u }).click()
  await leaveResponse
  expect(coreRequests(requests)).toEqual([])

  await page.goto("/app/host")
  requests.length = 0
  await page.getByLabel(/Title/u).fill("Browser scoped creation")
  await page.getByLabel(/Short description/u).fill("Created without a core reload.")
  await page.getByRole("button", { name: /Browser Test Commons/u }).click()
  await page.getByLabel("Date and time").fill("2026-08-20T14:00")
  const createResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/activities")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Send to review" }).click()
  await createResponse
  await expect(page.getByRole("heading", { name: "Thanks for your submission!" })).toBeVisible()
  expect(coreRequests(requests)).toEqual([])

  await page.goto(`/app/profile/${SECOND_FIXTURE_USER_ID}`)
  await expect(page.getByRole("heading", { name: "Friend T." })).toBeVisible()
  requests.length = 0
  const unfriendResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/rpc/unfriend")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Unfriend" }).click()
  await unfriendResponse
  expect(coreRequests(requests)).toEqual([])

  runFixtureSql(`
    insert into public.friend_connections (id, user_id, friend_id, status)
    values (
      '99500000-0000-4000-8000-000000000002',
      '${SECOND_FIXTURE_USER_ID}',
      (select id from auth.users where email = '${FIXTURE_EMAIL}'),
      'pending'
    );
  `)
  await page.goto(`/app/profile/${SECOND_FIXTURE_USER_ID}`)
  await expect(page.getByRole("button", { name: "Accept request" })).toBeVisible()
  requests.length = 0
  const acceptResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/friend_connections")
      && response.request().method() === "PATCH"
  )
  await page.getByRole("button", { name: "Accept request" }).click()
  await acceptResponse
  expect(coreRequests(requests)).toEqual([])

  runFixtureSql(`
    delete from public.friend_connections
    where id in ('${FRIEND_CONNECTION_ID}', '99500000-0000-4000-8000-000000000002');
    insert into public.friend_connections (id, user_id, friend_id, status)
    values (
      '99500000-0000-4000-8000-000000000003',
      '${SECOND_FIXTURE_USER_ID}',
      (select id from auth.users where email = '${FIXTURE_EMAIL}'),
      'pending'
    );
  `)
  await page.reload()
  await expect(page.getByRole("button", { name: "Decline request" })).toBeVisible()
  requests.length = 0
  const declineResponse = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/friend_connections")
      && response.request().method() === "DELETE"
  )
  await page.getByRole("button", { name: "Decline request" }).click()
  await declineResponse
  expect(coreRequests(requests)).toEqual([])
  expectNoWildcardSelect(requests)
})
