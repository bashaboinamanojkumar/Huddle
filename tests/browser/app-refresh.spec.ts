import { expect, test, type Page } from "@playwright/test"
import {
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_PASSWORD,
  runFixtureSql,
} from "./fixture"

const BASE_TITLE = "Browser Detail Huddle"
const REFRESH_ACTIVITY_IDS = [
  "99200000-0000-4000-8000-000000000004",
  "99200000-0000-4000-8000-000000000005",
] as const
const mobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
] as const
const navigationLabels = ["Feed", "Community", "Host", "Chats", "Profile"] as const

test.describe.configure({ mode: "serial" })
test.use({ serviceWorkers: "block" })

function setDetailTitle(title: string): void {
  runFixtureSql(`
    update public.activities
    set title = '${title.replaceAll("'", "''")}'
    where id = '${DETAIL_ACTIVITY_ID}';
  `)
}

function insertRefreshActivity(id: string, title: string): void {
  runFixtureSql(`
    insert into public.activities (
      id, title, description, category, location_id, host_id, capacity,
      start_time, availability_block, source, status, university_id,
      cohort, comfort_size, safety_preference
    )
    select
      '${id}', '${title.replaceAll("'", "''")}', description, category,
      location_id, host_id, capacity, start_time + interval '1 hour',
      availability_block, source, status, university_id, cohort,
      comfort_size, safety_preference
    from public.activities
    where id = '${DETAIL_ACTIVITY_ID}';
  `)
}

function deleteRefreshActivities(): void {
  runFixtureSql(`
    delete from public.activities
    where id in (${REFRESH_ACTIVITY_IDS.map((id) => `'${id}'`).join(", ")});
  `)
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/verify")
  await page.getByLabel("Campus email").fill(FIXTURE_EMAIL)
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/app(?:$|\/)/u)
  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
}

async function expectStableShell(page: Page): Promise<void> {
  await expect(page.locator("header").first()).toBeVisible()
  const navigation = page.getByRole("navigation")
  await expect(navigation.getByRole("link")).toHaveCount(5)
  for (const label of navigationLabels) {
    await expect(navigation.getByRole("link").filter({ hasText: label })).toBeVisible()
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
}

async function dispatchTouchGesture(
  page: Page,
  points: Array<{ x: number; y: number }>,
): Promise<void> {
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  })

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...points[0], id: 1 }],
  })
  for (const point of points.slice(1)) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...point, id: 1 }],
    })
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await client.detach()
}

async function dispatchPull(
  page: Page,
  options: { deltaX?: number; deltaY: number },
): Promise<void> {
  const mainBox = await page.locator("main").boundingBox()
  if (!mainBox) throw new Error("Authenticated main has no rendered box")
  const start = {
    x: Math.round(mainBox.x + mainBox.width / 2),
    y: Math.round(mainBox.y + Math.min(120, mainBox.height / 3)),
  }
  const end = {
    x: start.x + (options.deltaX ?? 0),
    y: start.y + options.deltaY,
  }
  await dispatchTouchGesture(page, [
    start,
    {
      x: Math.round((start.x + end.x) / 2),
      y: Math.round((start.y + end.y) / 2),
    },
    end,
  ])
}

async function dispatchMultitouchPull(page: Page): Promise<void> {
  const mainBox = await page.locator("main").boundingBox()
  if (!mainBox) throw new Error("Authenticated main has no rendered box")
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  })
  const x = Math.round(mainBox.x + mainBox.width / 2)
  const y = Math.round(mainBox.y + Math.min(120, mainBox.height / 3))
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 20, y, id: 1 },
      { x: x + 20, y, id: 2 },
    ],
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 20, y: y + 180, id: 1 },
      { x: x + 20, y: y + 180, id: 2 },
    ],
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await client.detach()
}

test.beforeEach(async ({ page }) => {
  deleteRefreshActivities()
  setDetailTitle(BASE_TITLE)
  await page.setViewportSize(mobileViewports[0])
})

test.afterEach(() => {
  deleteRefreshActivities()
  setDetailTitle(BASE_TITLE)
})

test("data-only pull refreshes content without reloading or moving the shell", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")

  for (const [index, viewport] of mobileViewports.entries()) {
    await page.setViewportSize(viewport)
    setDetailTitle(BASE_TITLE)
    await page.reload()
    await expect(page.getByText(BASE_TITLE, { exact: true })).toBeVisible()
    const timeOrigin = await page.evaluate(() => performance.timeOrigin)
    const url = page.url()
    const refreshedTitle = `Browser Pull Refresh ${index + 1}`
    insertRefreshActivity(REFRESH_ACTIVITY_IDS[index], refreshedTitle)

    await dispatchPull(page, { deltaY: 180 })

    await expect(page.getByText(refreshedTitle, { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
    await expect(page).toHaveURL(url)
    await expect(page.getByText(/Confirming your verified campus profile/u)).toHaveCount(0)
    await expect(page.locator("main")).toHaveAttribute("data-refresh-phase", "idle")
    await expectStableShell(page)
  }
})

test("invalid pulls and repeated pulls during one request never start another refresh", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")
  await expect(page.getByText(BASE_TITLE, { exact: true })).toBeVisible()
  const main = page.locator("main")
  let profileRequests = 0
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/rest/v1/profiles")) {
      profileRequests += 1
    }
  })

  await dispatchPull(page, { deltaY: 80 })
  expect(profileRequests, "short pull").toBe(0)
  await dispatchPull(page, { deltaX: 120, deltaY: 30 })
  expect(profileRequests, "horizontal pull").toBe(0)
  await dispatchMultitouchPull(page)
  expect(profileRequests, "multitouch pull").toBe(0)
  await main.evaluate((element) => { element.scrollTop = 120 })
  await dispatchPull(page, { deltaY: 180 })
  expect(profileRequests, "mid-scroll pull").toBe(0)
  await main.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await dispatchPull(page, { deltaY: -180 })
  expect(profileRequests, "bottom upward pull").toBe(0)

  await main.evaluate((element) => { element.scrollTop = 0 })
  let releaseProfiles: (() => void) | undefined
  let gatedProfileRequests = 0
  const profilesGate = new Promise<void>((resolve) => { releaseProfiles = resolve })
  await page.route("**/rest/v1/profiles*", async (route) => {
    gatedProfileRequests += 1
    await profilesGate
    await route.continue()
  })

  await dispatchPull(page, { deltaY: 180 })
  await expect(main).toHaveAttribute("aria-busy", "true")
  await dispatchPull(page, { deltaY: 180 })
  expect(gatedProfileRequests).toBe(1)
  releaseProfiles?.()
  await page.unroute("**/rest/v1/profiles*")
  await expect(main).toHaveAttribute("aria-busy", "false")
  await expectStableShell(page)
})

test("manual failure preserves content and the next pull retries", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")
  await expect(page.getByText(BASE_TITLE, { exact: true })).toBeVisible()

  await page.route("**/rest/v1/activities*", (route) => route.abort("failed"), { times: 1 })
  await dispatchPull(page, { deltaY: 180 })

  await expect(page.getByText("Couldn't refresh. Check your connection and try again.")).toBeVisible()
  await expect(page.getByText(BASE_TITLE, { exact: true })).toBeVisible()
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false")

  const retryTitle = "Browser Pull Retry"
  setDetailTitle(retryTitle)
  await dispatchPull(page, { deltaY: 180 })
  await expect(page.getByText(retryTitle, { exact: true })).toBeVisible()
  await expectStableShell(page)
})

test("foreground restoration is throttled while online restoration bypasses the throttle", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")
  const main = page.locator("main")
  await main.evaluate((element) => { element.scrollTop = 100 })
  const savedScrollTop = await main.evaluate((element) => element.scrollTop)

  const foregroundTitle = "Browser Foreground Refresh"
  setDetailTitle(foregroundTitle)
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByText(foregroundTitle, { exact: true })).toBeVisible()
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(savedScrollTop)

  const throttledTitle = "Browser Throttled Refresh"
  setDetailTitle(throttledTitle)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
  await expect(page.getByText(throttledTitle, { exact: true })).toHaveCount(0)

  await main.evaluate((element) => { element.scrollTop = 0 })
  await dispatchPull(page, { deltaY: 180 })
  await expect(page.getByText(throttledTitle, { exact: true })).toBeVisible()

  const onlineTitle = "Browser Online Refresh"
  setDetailTitle(onlineTitle)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(page.getByText(onlineTitle, { exact: true })).toBeVisible()
  await expectStableShell(page)
})

test("persisted pageshow refreshes a restored page", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")
  const restoredTitle = "Browser Pageshow Refresh"
  setDetailTitle(restoredTitle)

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))

  await expect(page.getByText(restoredTitle, { exact: true })).toBeVisible()
  await expectStableShell(page)
})

test("viewport diagnostics are opt-in, bounded to the shell, copyable, and disable cleanly", async ({ page, context }) => {
  const diagnosticLogs: string[] = []
  page.on("console", (message) => {
    if (message.text().includes("[Huddle diagnostics]")) {
      diagnosticLogs.push(message.text())
    }
  })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  })
  await signIn(page)
  await expect(page.getByRole("button", { name: "Open viewport diagnostics" })).toHaveCount(0)

  await page.goto("/app?viewportDebug=1")
  const trigger = page.getByRole("button", { name: "Open viewport diagnostics" })
  await expect(trigger).toBeVisible()
  await expect.poll(() => diagnosticLogs.length).toBeGreaterThan(0)
  await trigger.click()
  const panel = page.getByRole("complementary", { name: "Viewport diagnostics" })
  await expect(panel).toBeVisible()
  const panelBox = await panel.boundingBox()
  expect(panelBox).not.toBeNull()
  expect(panelBox!.y).toBeGreaterThanOrEqual(0)
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(mobileViewports[0].height)

  await page.getByRole("button", { name: "Copy JSON" }).click()
  await expect(page.getByText("Copied diagnostics", { exact: true })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain("timeOrigin")
  expect(copied).toContain("navigationBottom")
  expect(copied).not.toContain(FIXTURE_EMAIL)
  expect(diagnosticLogs.length).toBeGreaterThan(0)
  await expectStableShell(page)

  await page.getByRole("button", { name: "Disable" }).click()
  await expect(panel).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("button", { name: "Open viewport diagnostics" })).toHaveCount(0)
})
